// ---------------------- Main compute

fn computeCloudCore(gid_in: vec3<u32>, local_id: vec3<u32>) {
  // workgroup cache
  if (local_id.x == 0u && local_id.y == 0u) {
    let wd = textureDimensions(weather2D, 0);
    wg_weatherDim = vec2<f32>(f32(wd.x), f32(wd.y));
    let weatherEp = vec2<f32>(0.5 / max(wg_weatherDim.x, 1.0), 0.5 / max(wg_weatherDim.y, 1.0));
    wg_weatherUvMul = vec2<f32>(1.0, 1.0) - 2.0 * weatherEp;
    wg_weatherUvAdd = weatherEp;

    let bd = textureDimensions(blueTex, 0);
    wg_blueDim = vec2<f32>(f32(bd.x), f32(bd.y));

    let sd = textureDimensions(shape3D);
    wg_shapeDim = vec3<f32>(f32(sd.x), f32(sd.y), f32(sd.z));
    let shapeEp = vec3<f32>(
      0.5 / max(wg_shapeDim.x, 1.0),
      0.5 / max(wg_shapeDim.y, 1.0),
      0.5 / max(wg_shapeDim.z, 1.0)
    );
    wg_shapeUvMul = vec3<f32>(1.0, 1.0, 1.0) - 2.0 * shapeEp;
    wg_shapeUvAdd = shapeEp;

    let dd = textureDimensions(detail3D);
    wg_detailDim = vec3<f32>(f32(dd.x), f32(dd.y), f32(dd.z));
    let detailEp = vec3<f32>(
      0.5 / max(wg_detailDim.x, 1.0),
      0.5 / max(wg_detailDim.y, 1.0),
      0.5 / max(wg_detailDim.z, 1.0)
    );
    wg_detailUvMul = vec3<f32>(1.0, 1.0, 1.0) - 2.0 * detailEp;
    wg_detailUvAdd = detailEp;

    wg_maxMipW = f32(textureNumLevels(weather2D)) - 1.0;
    wg_maxMipS = f32(textureNumLevels(shape3D)) - 1.0;
    wg_maxMipD = f32(textureNumLevels(detail3D)) - 1.0;

    let scaleS_local = max(V.worldToUV * B.uvScale, EPS);
    wg_scaleS = scaleS_local;
    wg_scaleD = max(scaleS_local * (128.0 / 32.0), EPS);

    let sAxis = axisOrOne3(NTransform.shapeAxisScale);
    let dAxis = axisOrOne3(NTransform.detailAxisScale);

    let sMul = select(NTransform.shapeScale, 1.0, NTransform.shapeScale == 0.0);
    let dMul = select(NTransform.detailScale, 1.0, NTransform.detailScale == 0.0);

    wg_scaleS_effMax = wg_scaleS * max(sMul, EPS) * axisMaxAbs3(sAxis);
    wg_scaleD_effMax = wg_scaleD * max(dMul, EPS) * axisMaxAbs3(dAxis);

    wg_finestWorld = min(1.0 / wg_scaleS_effMax, 1.0 / wg_scaleD_effMax) * 0.6;

    // Keep jitter/warp amplitude and the homogeneous vertical profile at the
    // original local-cloud scale even when the horizon box tiles outward.
    let rawBoxMaxXZ = max(max(B.half.x, B.half.z), 1.0);
    wg_boxMaxXZ = min(rawBoxMaxXZ, 1.0);
    wg_tallBlend = saturate(remap(B.half.y, 0.34, 1.60, 0.0, 1.0));
    wg_thickPerfStrength = saturate(remap(B.half.y, 0.36, 2.40, 0.0, 1.0)) * clamp(TUNE.thickBoxPerf, 0.0, 2.0);

    wg_verticalHomogeneity = saturate(TUNE.verticalTextureHomogeneity);
    let baseHalfY = max(B.half.y, EPS);
    let refHalfY = clamp(wg_boxMaxXZ, 0.35, 1.25);
    wg_verticalRefHalfY = mix_f(baseHalfY, min(baseHalfY, refHalfY), wg_verticalHomogeneity);
    wg_verticalRefBoxH = max(wg_verticalRefHalfY * 2.0, EPS);
    let yTileTarget = rawBoxMaxXZ / max(wg_verticalRefBoxH * 2.75, 0.25);
    wg_verticalDomainScale = mix_f(1.0, clamp(yTileTarget, 1.0, 9.0), wg_verticalHomogeneity);
    wg_weatherAxisYAbs = max(abs(axisOrOne3(NTransform.weatherAxisScale).y), EPS);
    wg_boxMinCached = B.center - B.half;
    wg_boxMaxCached = B.center + B.half + vec3<f32>(0.0, anvilLiftWorld(), 0.0);
  }
  workgroupBarrier();

  // pixel and guard
  let temporalRate = temporalCellRateNormalized();
  let temporalHistoryActive = reproj.enabled == 1u || temporalRate > 1u || reproj.temporalBlend > 0.0001;
  let compactInterleave = reproj.compactInterleave != 0u && temporalRate > 1u && reproj.frameIndex > 0u;

  var pixI = vec2<i32>(i32(gid_in.x), i32(gid_in.y)) + vec2<i32>(frame.originX, frame.originY);
  if (compactInterleave) {
    let mapped = compactTemporalPixel(gid_in.xy, temporalRate);
    if (mapped.z == 0u) { return; }
    pixI = vec2<i32>(i32(mapped.x), i32(mapped.y));
  }

  if (pixI.x < 0 || pixI.y < 0 || pixI.x >= i32(frame.fullWidth) || pixI.y >= i32(frame.fullHeight)) {
    return;
  }

  let fullPix = fullPixFromCurrent(pixI);
  beginLayerSample(pixI);

  let fullResF = vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));
  let uvPix = (vec2<f32>(pixI) + 0.5) / fullResF;

  // camera basis
  let camFwd = normalize(V.fwd);

  var basisRight = normalize(V.right);
  if (length(basisRight) < EPS) { basisRight = vec3<f32>(1.0, 0.0, 0.0); }

  var basisUp = normalize(V.up);
  if (length(basisUp) < EPS) { basisUp = vec3<f32>(0.0, 1.0, 0.0); }

  // ray origin
  var rayRo = V.camPos;
  if (CLOUD_USE_CUSTOM_POS != 0u) {
    let idx = u32(pixI.x) + u32(pixI.y) * frame.fullWidth;
    rayRo = posBuf[idx].xyz;
  }

  // ray direction
  // Keep the primary-ray dither stable per pixel. Frame-varying ray jitter was
  // good for breaking seams, but it caused subtle lighting shimmer/flicker once
  // the post resolve started blending thin cloud pixels.
  let rayJx = hash11Fast(f32(fullPix.x) * 0.06711056 + f32(fullPix.y) * 0.00583715 + 0.754877666) - 0.5;
  let rayJy = hash11Fast(f32(fullPix.x) * 0.01145137 + f32(fullPix.y) * 0.09324173 + 14.124877666) - 0.5;
  let jitterPixScreen = vec2<f32>(rayJx, rayJy) * 0.18;
  // Spherical planet clouds must stay locked to world/sphere coordinates.
  // Screen-space subpixel jitter makes the volume crawl relative to the camera.
  let jitterPix = jitterPixScreen * cloudModeF32(1.0, 0.0, 0.0);
  let jitteredUvPix = (vec2<f32>(pixI) + 0.5 + jitterPix) / fullResF;
  let ndc = jitteredUvPix * 2.0 - vec2<f32>(1.0, 1.0);
  let tanY = tan(0.5 * V.fovY);

  let rd_camera = normalize(vec3<f32>(ndc.x * V.aspect * tanY, -ndc.y * tanY, -1.0));
  let rayRd = normalize(basisRight * rd_camera.x + basisUp * rd_camera.y - camFwd * rd_camera.z);
  let aircraft=sceneAircraft(rayRo,rayRd,V.aircraftPosition,V.right,V.up,V.fwd,V._v0,V._v1,V._v2,V.aircraftYaw,normalize(L.sunDir));
  let emptyRayColor=select(vec4<f32>(aircraft.color,1.0),vec4<f32>(0.0),aircraft.distance>=1000000.0);

  // intersect volume
  let bmin = boxMin();
  let bmax = boxMax();
  var ti = intersectAABB_robust(rayRo, rayRd, bmin, bmax);
  if (sphericalCloudMode()) {
    ti = intersectSphericalCloudShellView(rayRo, rayRd);
  }

  if (ti.x > ti.y || ti.y <= 0.0) {
    if(aircraft.distance<1000000.0){storeLayerSample(pixI,emptyRayColor,0.0,temporalHistoryActive);return;}
    let z = vec4<f32>(0.0);
    textureStore(outTex, pixI, frame.layerIndex, z);
    if (temporalHistoryActive) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }
    return;
  }

  var t0 = max(ti.x - TUNE.aabbFaceOffset, 0.0);
  var t1 = ti.y + TUNE.aabbFaceOffset;
  if (t0 >= t1) {
    if(aircraft.distance<1000000.0){storeLayerSample(pixI,emptyRayColor,0.0,temporalHistoryActive);return;}
    let z = vec4<f32>(0.0);
    textureStore(outTex, pixI, frame.layerIndex, z);
    if (temporalHistoryActive) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }
    return;
  }

  let globalYR = globalActiveYRange();
  let segY0 = rayRo.y + rayRd.y * t0;
  let segY1 = rayRo.y + rayRd.y * t1;
  if (max(segY0, segY1) < globalYR.x || min(segY0, segY1) > globalYR.y) {
    if(aircraft.distance<1000000.0){storeLayerSample(pixI,emptyRayColor,0.0,temporalHistoryActive);return;}
    let z = vec4<f32>(0.0);
    textureStore(outTex, pixI, frame.layerIndex, z);
    if (temporalHistoryActive) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }
    return;
  }

  // Tall AABBs are allowed as traversal headroom, but the actual cloud profile
  // can be much thinner. Clip the ray segment to the global active Y band before
  // deriving the ray budget so vertical extent does not inflate primary steps.
  if (abs(rayRd.y) > 1e-5) {
    var ty0 = (globalYR.x - rayRo.y) / rayRd.y;
    var ty1 = (globalYR.y - rayRo.y) / rayRd.y;
    if (ty0 > ty1) {
      let tmp = ty0;
      ty0 = ty1;
      ty1 = tmp;
    }
    t0 = max(t0, ty0 - TUNE.aabbFaceOffset);
    t1 = min(t1, ty1 + TUNE.aabbFaceOffset);
    if (t0 >= t1) {
      if(aircraft.distance<1000000.0){storeLayerSample(pixI,emptyRayColor,0.0,temporalHistoryActive);return;}
      let z = vec4<f32>(0.0);
      textureStore(outTex, pixI, frame.layerIndex, z);
      if (temporalHistoryActive) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }
      return;
    }
  }

  // Only cloud in front of the opaque hull contributes to its fogging.
  if(aircraft.distance<1000000.0){
    t1=min(t1,aircraft.distance);
    if(t0>=t1){storeLayerSample(pixI,emptyRayColor,0.0,temporalHistoryActive);return;}
  }
  // ---------------------- precompute weather mapping and LOD
  let wScale = select(NTransform.weatherScale, 1.0, NTransform.weatherScale == 0.0);
  let wAxis = axisOrOne3(NTransform.weatherAxisScale);

  let weatherTileInvWorld = 0.5 * max(B.uvScale, EPS);
  let boxTexelsPerWorldU = wg_weatherDim.x * abs(wAxis.x) * wScale * weatherTileInvWorld;
  let boxTexelsPerWorldV = wg_weatherDim.y * abs(wAxis.z) * wScale * weatherTileInvWorld;
  let rMid = max(sphereRadiusBase() + (V.cloudBottom + V.cloudTop) * 0.5, 1.0);
  let sphereTexelsPerWorldU = wg_weatherDim.x * abs(wAxis.x) * wScale / max(2.0 * PI * rMid, EPS);
  let sphereTexelsPerWorldV = wg_weatherDim.y * abs(wAxis.z) * wScale / max(PI * rMid, EPS);
  let texelsPerWorld_u = select(boxTexelsPerWorldU, sphereTexelsPerWorldU, sphericalCloudMode());
  let texelsPerWorld_v = select(boxTexelsPerWorldV, sphereTexelsPerWorldV, sphericalCloudMode());
  let fp = max(texelsPerWorld_u, texelsPerWorld_v);

  let weatherLOD_base = clamp(
    log2(max(fp, 1.0)) + TUNE.lodBiasWeather * max(perf.lodBiasMul, 0.0001),
    0.0,
    wg_maxMipW
  );

  let fullHeightF = max(f32(frame.fullHeight), 1.0);
  let rayPixelWorldScale = (2.0 * tanY) / fullHeightF;

  // Use true ray distance from the active camera origin for near/far behavior.
  // Projected camera-forward depth breaks down with wide FOV and when the
  // camera enters the volume, which can make nearby cloud samples use far LODs.
  let entryRayDistance = max(t0, 0.0);

  let horizonFarScale = max(max(B.half.x, B.half.z), 1.0);
  let nearMetricScale = max(horizonFarScale, max(verticalReferenceBoxH(), 1.0));
  let effectiveNearFluffDist = clamp(min(TUNE.nearFluffDist, nearMetricScale * 0.10), 0.35, 6.0);
  let effectiveNearDensityRange = clamp(min(TUNE.nearDensityRange, nearMetricScale * 0.08), 0.35, 5.0);
  let nearFineDist = clamp(effectiveNearFluffDist * 0.12, 0.08, 0.35);

  // noise and jitter
  let bnPix = distanceBlueScreen(pixI, entryRayDistance, effectiveNearFluffDist);
  let entryWorldForNoise = rayRo + rayRd * max(t0, 0.0);
  // World/sphere-locked smooth noise. Do not include frameIndex here:
  // frame-varying jitter turns x4 interleave into visible flicker.
  var rand0 = bnPix;
  if (sphericalCloudMode()) {
    let entryUvForNoise = shellUVFromWorld(entryWorldForNoise);
    let worldRandFreq = auroraModeF32(128.0, 56.0);
    rand0 = shellHash(entryUvForNoise + vec2<f32>(13.71, 4.23), worldRandFreq);
  }
  let entryNearF = 1.0 - smoothstep(0.0, max(effectiveNearFluffDist, EPS), entryRayDistance);
  let nearJitterScale = mix_f(1.0, 0.32, entryNearF);

  // step sizing
  let viewDir = -rayRd;

  let voxelBound = wg_finestWorld / max(abs(dot(rayRd, basisUp)), 0.15);

  let raySegmentLength = max(t1 - t0, TUNE.minStep);
  let segmentAspect = raySegmentLength / max(max(B.half.x, B.half.z), max(B.half.y * 2.0, 1.0));
  let thickPerfF = saturate(thickBoxPerfStrength() * saturate(remap(segmentAspect, 0.35, 1.45, 0.0, 1.0)));
  let maxStepsF = max(f32(max(TUNE.maxSteps, 1)), 1.0);
  let horizonPerfF = smoothstep(24.0, 120.0, horizonFarScale) * smoothstep(0.30, 1.10, segmentAspect);
  let reachStepLimit = (raySegmentLength / maxStepsF) * mix_f(1.10, 1.55, horizonPerfF);
  let vStepBoost = verticalStepBoost();
  let thickStepLimit = TUNE.maxStep * mix_f(1.0, max(TUNE.thickStepBoost, 1.0), thickPerfF);
  let verticalStepLimit = TUNE.maxStep * vStepBoost;
  let effectiveMaxStep = max(max(max(TUNE.maxStep, thickStepLimit), verticalStepLimit), reachStepLimit);

  var baseStep = clamp(V.stepBase, TUNE.minStep, effectiveMaxStep);
  baseStep = min(baseStep, voxelBound * mix_f(1.0, 1.65, thickPerfF));
  let sphericalJitterScale = cloudModeF32(1.0, 0.46, 0.18);
  baseStep = baseStep * mix_f(1.0, 1.0 + TUNE.stepJitter * nearJitterScale * sphericalJitterScale, rand0 * 2.0 - 1.0);
  baseStep = clamp(baseStep, TUNE.minStep, effectiveMaxStep);

  let farStartWorld = max(TUNE.farStart * horizonFarScale, TUNE.farStart);
  let farFullWorld = max(TUNE.farFull * horizonFarScale, farStartWorld + 0.001);

  let rayExitDepth = max(t1, entryRayDistance);
  let rayFarHistoryF = saturate(remap(rayExitDepth, farStartWorld, farFullWorld, 0.0, 1.0));
  let thickBudgetBoost = mix_f(1.08, max(1.08, TUNE.thickStepBoost), thickPerfF);
  let rayBudgetStep = clamp((raySegmentLength / maxStepsF) * max(thickBudgetBoost, vStepBoost), TUNE.minStep, effectiveMaxStep);

  let startPhaseJitter = TUNE.phaseJitter * mix_f(1.0, 0.30, entryNearF) * sphericalJitterScale;
  var t = clamp(t0 + (rand0 * startPhaseJitter) * min(baseStep, rayBudgetStep), t0, t1);

  // lighting setup. rayRd points from camera into the volume, matching the blog-style phase convention.
  let sunDir = normalize(L.sunDir);
  let cosVS = dot(rayRd, sunDir);

  // sun shadowing samples should cover neighboring cloud volume, not only the vertical slab thickness.
  let sunBoxHalf = vec3<f32>(B.half.x, verticalReferenceHalfY(), B.half.z);
  let sunNominalSpan = max(min(length(sunBoxHalf * 2.0) * 0.5, 4.0) * verticalLightingStepBoost(), EPS);
  let sunStepLen = clamp(
    sunNominalSpan / f32(max(TUNE.sunSteps, 1)),
    TUNE.minStep,
    max(effectiveMaxStep, sunNominalSpan)
  );

  // accumulators
  var Tr = 1.0;
  var rgb = vec3<f32>(0.0);

  var Tsun_cached = 1.0;
  var prevDens: f32 = 0.0;
  var prevMacroDens: f32 = 0.0;
  var prevTsun: f32 = 1.0;

  var shapeN_cached = vec3<f32>(0.0, 1.0, 0.0);
  var lightN_cached = vec3<f32>(0.0, 1.0, 0.0);
  var rim_cached: f32 = 0.0;
  var sunSide_cached: f32 = 0.5;
  var sunRim_cached: f32 = 0.0;
  var sunExposure_cached: f32 = 0.0;
  var upperExposure_cached: f32 = 1.0;

  var runMeanL: f32 = 0.0;
  var runN: f32 = 0.0;

  var iter: i32 = 0;

  let maxMarchSteps = select(TUNE.maxSteps, min(TUNE.maxSteps, 56), auroraLayerMode());

  loop {
    if (iter >= maxMarchSteps) { break; }
    if (t >= t1) { break; }
    if (Tr <= transmittanceCutoff()) {
      Tr = 0.0;
      break;
    }

    let rayShallowF = 1.0 - smoothstep(0.025, 0.22, abs(rayRd.y));
    let planetSliceJitterScale = cloudModeF32(1.0, 0.58, 0.36);
    let sliceJitter = saturate(TUNE.sliceJitterStrength) * mix_f(1.0, 1.55, rayShallowF) * sphericalJitterScale * planetSliceJitterScale;
    let sliceHashScreen = hash11Fast(
      f32(fullPix.x) * 0.071324 +
      f32(fullPix.y) * 0.117913 +
      f32(iter) * 0.167351 +
      rand0 * 19.1731
    );

    let stepT = clamp(t, t0, t1);
    let stepRayDistance = max(stepT, 0.0);
    let stepPixelWorld = max(stepRayDistance * rayPixelWorldScale, wg_finestWorld * 0.50);
    let farF = saturate(remap(stepRayDistance, farStartWorld, farFullWorld, 0.0, 1.0));
    let screenFarF = saturate(remap(stepPixelWorld / max(wg_finestWorld, EPS), 2.0, 18.0, 0.0, 1.0));
    let coverageStep = max(
      rayBudgetStep,
      baseStep * mix_f(1.0, max(TUNE.farStepMult, 1.0), screenFarF)
    );
    let nearStepF = 1.0 - smoothstep(0.0, nearFineDist, stepRayDistance);
    let fineStep = baseStep * mix_f(1.0, clamp(TUNE.nearStepScale, 0.12, 1.0), nearStepF);
    let baseStepLen = clamp(mix_f(coverageStep, fineStep, nearStepF), TUNE.minStep, effectiveMaxStep);
    let auroraTargetStep = raySegmentLength / 42.0;
    let auroraStepMax = max(effectiveMaxStep, raySegmentLength / 28.0);
    let auroraStepLen = clamp(max(baseStepLen, auroraTargetStep), TUNE.minStep * 3.0, auroraStepMax);
    let stepLen = select(baseStepLen, auroraStepLen, auroraLayerMode());

    var sliceHash = sliceHashScreen;
    if (sphericalCloudMode()) {
      let sliceProbeT = clamp(t + stepLen * 0.50, t0, t1);
      let sliceProbeP = rayRo + rayRd * sliceProbeT;
      let sliceProbeUv = shellUVFromWorld(sliceProbeP);
      let sliceShellPhase = shellPhase01FromWorld(sliceProbeP);
      let sliceHashWorldA = shellHash(
        sliceProbeUv + vec2<f32>(sliceShellPhase * 0.173 + rand0 * 0.019, sliceShellPhase * 0.311),
        auroraModeF32(176.0, 104.0)
      );
      sliceHash = sliceHashWorldA;
    }

    // Keep the same march coverage, but de-correlate where each interval is
    // sampled. This breaks the straight-through shelf pattern without shrinking
    // the step length and losing the far side of the cloud box.
    let sampleWindowEnd = min(t + stepLen * 0.98, t1);
    let jitterWindow = max(sampleWindowEnd - t, TUNE.minStep);
    let jitterCenter = mix_f(0.50, 0.46, rayShallowF);
    let jitterAmp = mix_f(0.18, 0.46, rayShallowF) * sliceJitter;
    let jitterPhase = clamp(jitterCenter + (sliceHash - 0.5) * jitterAmp, 0.04, 0.96);
    var sampleT = clamp(t + jitterWindow * jitterPhase, t0, sampleWindowEnd);
    // Continuous interval quadrature, also when flying inside an aurora. The
    // old 44-shell snap re-solved a quadratic at every step and popped between
    // discrete radial sheets. Midpoint-biased jitter needs no shell re-solve.
    let p = rayRo + rayRd * sampleT;
    if (sphericalCloudMode()) {
      let camRel = rayRo - B.center;
      let sampleRel = p - B.center;
      let camLen2 = dot(camRel, camRel);
      let sampleLen2 = dot(sampleRel, sampleRel);
      if (camLen2 > EPS && sampleLen2 > EPS) {
        let hemi = dot(normalize(sampleRel), normalize(camRel));
        if (hemi < -0.020) {
          break;
        }
      }
    }
    let sampleRayDistance = max(sampleT, 0.0);
    // The flat renderer's historical tile-scale floor is intentional there.
    // On a planet it incorrectly forced a coarse mip even inside the shell.
    let minimumPixelWorld = select(wg_finestWorld * 0.50, sphericalFinestTexelWorld() * 0.50,
      sphericalCloudMode() && !auroraLayerMode());
    let samplePixelWorld = max(sampleRayDistance * rayPixelWorldScale, minimumPixelWorld);

    let thickLodExtra = thickPerfF * saturate(TUNE.thickDetailSkip) * smoothstep(0.28, 0.96, sampleRayDistance);
    let weatherLOD = clamp(weatherLOD_base + TUNE.farLodPush * farF * 0.65, 0.0, wg_maxMipW);
    let nearHorizontalRayF = rayShallowF
      * (1.0 - smoothstep(effectiveNearFluffDist * 0.85, effectiveNearFluffDist * 4.25, sampleRayDistance));
    let straightThroughViewF = rayShallowF * (1.0 - smoothstep(0.74, 1.0, farF));


    let uv_weather = weatherUV_from(p, wScale);
    let wm_primary = wrap2D(weather2D, samp2D, uv_weather, 0i, 0.0);

    let ph_coarse = computePH(p, wm_primary);

    var columnSkip = verticalColumnSkipDistance(p, rayRd, wm_primary, stepLen, effectiveMaxStep, thickPerfF, screenFarF);
    columnSkip = mix_f(columnSkip, 0.0, nearHorizontalRayF);
    if (columnSkip > stepLen * 1.12) {
      prevDens = 0.0;
      prevMacroDens = 0.0;
      prevTsun = Tsun_cached;
      t = min(t + columnSkip, t1);
      iter = iter + 1;
      continue;
    }

    // Exact vertical/weather miss for this sample. This is intentionally a
    // short conservative jump, not a long visibility cull, so clouds cannot
    // disappear from LOD shells while tall boxes avoid wasting full density work
    // above, below, or inside cut-out portions of the current weather column.
    if (ph_coarse < 0.0 || wm_primary.b >= 1.0) {
      let missBoost = mix_f(1.35, min(max(TUNE.emptySkipMult, 1.0), 2.75), max(thickPerfF, screenFarF));
      let missStep = clamp(stepLen * missBoost, TUNE.minStep, effectiveMaxStep * 2.0);
      prevDens = 0.0;
      prevMacroDens = 0.0;
      prevTsun = Tsun_cached;
      t = min(t + missStep, t1);
      iter = iter + 1;
      continue;
    }

    let weatherGateFast = weatherCoverageGate(wm_primary);
    if (weatherGateFast >= TUNE.weatherRejectGate && sampleRayDistance > nearFineDist * 2.0 && nearHorizontalRayF < 0.35) {
      let rejectF = smoothstep(TUNE.weatherRejectGate, 1.0, weatherGateFast);
      let rejectPerfF = max(max(rejectF, thickPerfF * 0.45), screenFarF * 0.50);
      let rejectBoost = mix_f(1.18, min(max(TUNE.emptySkipMult, 1.0), 4.35), rejectPerfF);
      var rejectStep = clamp(stepLen * rejectBoost, TUNE.minStep, effectiveMaxStep * 2.2);
      let runProbeF = max(thickPerfF, screenFarF) * smoothstep(nearFineDist * 4.0, nearFineDist * 12.0, sampleRayDistance);
      if (runProbeF > 0.36) {
        let probeStep = clamp(rejectStep * mix_f(1.55, 2.65, runProbeF), TUNE.minStep, effectiveMaxStep * 5.5);
        let probeMip = clamp(weatherLOD + 1.25 + runProbeF * 1.50, 0.0, wg_maxMipW);
        if (weatherProbeEmpty(p + rayRd * rejectStep, rayRd, probeStep, 3, probeMip, wScale)) {
          rejectStep = clamp(rejectStep + probeStep * mix_f(1.0, 2.45, runProbeF), TUNE.minStep, effectiveMaxStep * 8.0);
        }
      }
      prevDens = 0.0;
      prevMacroDens = 0.0;
      prevTsun = Tsun_cached;
      t = min(t + rejectStep, t1);
      iter = iter + 1;
      continue;
    }

    // LOD from actual camera distance and FOV. Step length is still allowed to
    // raise far LODs, but near/in-volume samples stay anchored to screen-space
    // pixel footprint so clouds do not vanish while the camera passes through.
    let stepLOD = clamp(log2(max(stepLen / wg_finestWorld, 1.0)), 0.0, wg_maxMipS);
    let pixelLOD = clamp(log2(max(samplePixelWorld / wg_finestWorld, 1.0)), 0.0, wg_maxMipS);
    let baseLOD = mix_f(pixelLOD, max(pixelLOD, stepLOD), smoothstep(0.70, 1.0, farF));

    let nearSmooth = pow(saturate(1.0 - sampleRayDistance / effectiveNearFluffDist), 0.85);

    let lodBias = mix_f(0.0, TUNE.nearLodBias, nearSmooth);
    let nearDetailSoftLod = smoothstep(max(effectiveNearFluffDist * 0.72, 0.10), 0.0, sampleRayDistance) * 0.55;
    let farLodExtra = TUNE.farLodPush * farF * 0.60;
    let thickShapeLodExtra = thickLodExtra * 0.10;
    let thickDetailLodExtra = thickLodExtra * 0.28;
    let lodShapeLighting = clamp(baseLOD + lodBias + farLodExtra + thickShapeLodExtra, 0.0, wg_maxMipS);
    let lodDetailLighting = clamp(baseLOD + lodBias + farLodExtra + nearDetailSoftLod + thickDetailLodExtra, 0.0, wg_maxMipD);
    let lodShapeBase = min(lodShapeLighting, min(wg_maxMipS, 2.25));
    let lodDetailBase = min(lodDetailLighting, min(wg_maxMipD, 2.75));

    let auroraMask = auroraCapMask(p);
    if (auroraMask <= 0.0001) {
      prevDens = 0.0;
      prevMacroDens = 0.0;
      prevTsun = Tsun_cached;
      t = min(t + clamp(stepLen * 2.5, TUNE.minStep, effectiveMaxStep * 5.0), t1);
      iter = iter + 1;
      continue;
    }
    var stepWarp = vec2<f32>(0.0);
    if (!auroraLayerMode()) { stepWarp = worldWarpXZ(p.xz, max(ph_coarse, 0.0), wg_boxMaxXZ); }

    let visibleLodEase = smoothstep(0.08, 0.98, max(farF, screenFarF));
    let definitionHold = cloudDefinition01();
    let sparseHold = cloudSparsity01();
    let visibleLodEaseDefined = visibleLodEase * mix_f(1.0, 0.74, definitionHold);
    var lodShapeVisible = clamp(min(lodShapeLighting, mix_f(1.10, 2.38, visibleLodEaseDefined)), 0.0, wg_maxMipS);
    var lodDetailVisibleBase = clamp(min(lodDetailLighting, mix_f(1.12, 2.72, visibleLodEaseDefined)), 0.0, wg_maxMipD);
    if(!sphericalCloudMode() && max(B.half.x,B.half.z)>36.0){
      // Wide skies must filter distant subpixel bands instead of forcing
      // fine erosion through the artistic close-view mip caps.
      lodShapeVisible=max(lodShapeVisible,clamp(log2(max(samplePixelWorld*wg_scaleS_effMax*wg_shapeDim.x,1.0)),0.0,wg_maxMipS));
      lodDetailVisibleBase=max(lodDetailVisibleBase,clamp(log2(max(samplePixelWorld*wg_scaleD_effMax*wg_detailDim.x,1.0)),0.0,wg_maxMipD));
    }
    if (sphericalCloudMode() && !auroraLayerMode()) {
      // Use the real texture texel footprint, not one whole noise tile. Retain
      // fine mip zero in close views, filter subpixel detail instead of forcing
      // high-frequency erosion back through the flat preset's mip caps.
      lodShapeVisible = clamp(log2(max(samplePixelWorld * wg_scaleS_effMax * wg_shapeDim.x,1.0)),0.0,wg_maxMipS);
      lodDetailVisibleBase = clamp(log2(max(samplePixelWorld * wg_scaleD_effMax * wg_detailDim.x,1.0)),0.0,wg_maxMipD);
    }

    let faceFade = insideFaceFade(p, bmin, bmax);
    let nearDense = mix_f(TUNE.nearDensityMult, 1.0, saturate(sampleRayDistance / effectiveNearDensityRange));

    let verticalInteriorF = smoothstep(0.10, 0.28, ph_coarse) * (1.0 - smoothstep(0.78, 0.98, ph_coarse));
    let weatherFilledF = 1.0 - smoothstep(TUNE.weatherRejectGate * 0.54, TUNE.weatherRejectGate * 0.94, weatherGateFast);
    let noShapeFarF = smoothstep(mix_f(0.76, 0.88, definitionHold), 1.0, max(farF, screenFarF))
      * smoothstep(nearFineDist * 5.0, nearFineDist * 12.0, sampleRayDistance)
      * verticalInteriorF
      * weatherFilledF
      * max(thickPerfF, screenFarF * 0.65)
      * (1.0 - nearHorizontalRayF * 0.85)
      * (1.0 - straightThroughViewF * 0.98);

    var s: vec4<f32>;
    var densMacro: f32;
    var usedWeatherProxy: f32 = 0.0;
    if (auroraLayerMode()) {
      s = sampleAuroraRibbonShape(p, max(ph_coarse, 0.0), clamp(lodShapeVisible + 0.70, 0.0, wg_maxMipS));
      let auroraDetProxy = detailProxyFromShape(max(ph_coarse, 0.0), s);
      densMacro = auroraCurtainDensity(ph_coarse, wm_primary, s, auroraDetProxy, p) * faceFade;
    } else if (noShapeFarF > 0.62) {
      s = syntheticShapeFromWeather(ph_coarse, wm_primary);
      densMacro = densityWeatherProxy(ph_coarse, wm_primary) * faceFade * nearDense * auroraMask;
      usedWeatherProxy = noShapeFarF;
    } else {
      s = sampleShapeRGBAWarp(p, max(ph_coarse, 0.0), lodShapeVisible, stepWarp);
      densMacro = densityMacroFromSamples(ph_coarse, wm_primary, s) * faceFade * nearDense * auroraMask;
    }

    // Conservative macro-empty acceleration. Detail noise only erodes the macro
    // field, so when the macro field is genuinely absent there is no useful
    // detail/lighting work to do. Keep the threshold tiny and only use a short
    // jump so silhouettes and wisps survive.
    let macroEmptyThreshold = max(TUNE.sunDensityGate * mix_f(0.46, 0.94, thickPerfF), 0.00006);
    let macroMissF = smoothstep(macroEmptyThreshold * 2.5, macroEmptyThreshold * 0.45, max(densMacro, prevMacroDens));
    let macroMissAllowed = macroMissF * smoothstep(nearFineDist * 1.25, nearFineDist * 3.0, sampleRayDistance) * max(thickPerfF, screenFarF * 0.55) * (1.0 - nearHorizontalRayF * 0.90);
    if (macroMissAllowed > 0.72 && densMacro < macroEmptyThreshold) {
      let missBoost = mix_f(1.35, min(max(TUNE.emptySkipMult, 1.0), 4.10), macroMissAllowed);
      let missStep = clamp(stepLen * missBoost, TUNE.minStep, effectiveMaxStep * 2.80);
      prevDens = 0.0;
      prevMacroDens = max(densMacro, 0.0);
      prevTsun = Tsun_cached;
      t = min(t + missStep, t1);
      iter = iter + 1;
      continue;
    }

    let farLightingFastF = saturate(remap(max(farF, screenFarF), 0.62, 1.0, 0.0, 1.0));
    let denseLightingFastF = saturate(remap(max(densMacro, prevMacroDens), 0.15, 0.35, 0.0, 1.0));
    let macroOnly = (farLightingFastF * denseLightingFastF) > 0.72;

    let farProxyRawF = smoothstep(mix_f(0.66, 0.78, definitionHold), 1.0, max(farF, screenFarF)) * smoothstep(nearFineDist * 2.0, nearFineDist * 6.0, sampleRayDistance) * (1.0 - nearHorizontalRayF * 0.75) * (1.0 - straightThroughViewF * 0.88);
    let farProxyEdgeProtect = 1.0 - smoothstep(0.025, 0.16, densMacro);
    let farProxySafeF = max(farProxyRawF * (1.0 - farProxyEdgeProtect * 0.65), usedWeatherProxy * 0.86);

    let detailProxy = detailProxyFromShape(max(ph_coarse, 0.0), s);
    let denseInteriorF = smoothstep(0.12, 0.34, densMacro);
    let thickInteriorFilterF = thickPerfF * smoothstep(0.14, 0.52, densMacro) * smoothstep(0.14, 0.94, sampleRayDistance);
    let lodDetailVisible = clamp(lodDetailVisibleBase + thickInteriorFilterF * mix_f(0.90, 0.54, definitionHold) + farProxySafeF * mix_f(1.05, 0.58, definitionHold), 0.0, wg_maxMipD);
    var detailRaw = detailProxy;
    if (!auroraLayerMode() && !macroOnly && farProxySafeF < 0.62 && usedWeatherProxy < 0.52) {
      detailRaw = sampleDetailRGBWarp(p, max(ph_coarse, 0.0), lodDetailVisible, stepWarp);
    }
    let thickDetailProxyF = thickPerfF * saturate(TUNE.thickDetailSkip) * smoothstep(0.18, 0.96, sampleRayDistance) * denseInteriorF;
    let detailProxyMixF = max(min(thickDetailProxyF, 0.16) * (1.0 - straightThroughViewF * 0.78), farProxySafeF * mix_f(0.42, 0.24, definitionHold));
    var det = mix_v3(detailRaw, detailProxy, min(detailProxyMixF, mix_f(0.72, 0.54, definitionHold)));

    let detailMean = (det.r + det.g + det.b) * 0.3333333333;
    let thickDetailFilterF = thickPerfF * smoothstep(0.12, 0.82, sampleRayDistance) * smoothstep(0.05, 0.32, densMacro) * mix_f(0.18, 0.08, definitionHold);
    det = mix_v3(det, vec3<f32>(detailMean), max(thickDetailFilterF * (1.0 - straightThroughViewF * 0.72), farProxySafeF * mix_f(0.18, 0.08, definitionHold)));

    var dens = densMacro;
    if (!auroraLayerMode()) {
      if (!macroOnly) {
        dens = densityFromSamples(ph_coarse, wm_primary, s, det) * faceFade * nearDense * auroraMask;
      } else {
        let macroBodyF = smoothstep(0.10, 0.34, densMacro) * smoothstep(0.16, 0.84, ph_coarse);
        dens = densMacro * mix_f(0.88, 1.02, macroBodyF);
      }
    }

    let thickBodySmoothF = thickPerfF * smoothstep(0.10, 0.42, densMacro) * smoothstep(0.10, 0.90, sampleRayDistance) * mix_f(0.16, 0.08, max(definitionHold, sparseHold * 0.65));
    dens = mix_f(dens, densMacro, thickBodySmoothF);

    let farSilhouetteKeep = smoothstep(0.36, 1.0, screenFarF) * saturate(remap(densMacro, 0.025, 0.20, 0.0, 1.0));
    dens = max(dens, densMacro * farSilhouetteKeep * 0.22);

    let bodySmooth = smoothstep(0.08, 0.42, max(densMacro, prevMacroDens));
    let raySmoothDensAdaptive = saturate(mix_f(TUNE.raySmoothDens * 0.18, TUNE.raySmoothDens, bodySmooth) * mix_f(1.0, 0.58, definitionHold));
    let densSmoothed = mix_f(dens, prevDens, raySmoothDensAdaptive);
    let densMacroSmoothed = mix_f(densMacro, prevMacroDens, saturate(raySmoothDensAdaptive * 0.90));
    let denseInteriorStepF = thickPerfF * smoothstep(0.22, 0.62, densMacroSmoothed) * smoothstep(0.20, 0.90, sampleRayDistance);
    let farProxyStepF = farProxySafeF * smoothstep(0.07, 0.28, densMacroSmoothed);
    let weatherProxyStepF = usedWeatherProxy * smoothstep(0.06, 0.26, densMacroSmoothed);
    var planetCardF = 0.0;
    if (auroraLayerMode()) {
      let relShellStep = p - B.center;
      let shellNStep = normalizeOr(relShellStep, vec3<f32>(0.0, 1.0, 0.0));
      let shellTangentF = 1.0 - smoothstep(0.055, 0.32, abs(dot(rayRd, shellNStep)));
      let shellInteriorF = smoothstep(0.045, 0.24, ph_coarse) * (1.0 - smoothstep(0.76, 0.98, ph_coarse));
      planetCardF = shellTangentF * shellInteriorF * 0.26;
    }
    let viewFrontOccF = frontOcclusionFactor(Tr, sampleRayDistance, effectiveNearFluffDist, densMacroSmoothed);
    let shellFrontOccF = planetCardF * smoothstep(0.040, 0.20, densMacroSmoothed) * frontOcclusionStrength() * 0.58;
    let frontOccF = cloudModeF32(viewFrontOccF, max(viewFrontOccF * 0.18, shellFrontOccF), max(viewFrontOccF * 0.18, shellFrontOccF));
    let cloudApproachProtect = cloudModeF32(
      0.0,
      (1.0 - smoothstep(effectiveNearFluffDist * 1.10, effectiveNearFluffDist * 3.40, sampleRayDistance)) *
        (1.0 - smoothstep(0.22, 0.74, max(farF, screenFarF))),
      0.0
    );
    let adaptiveStepF = max(max(max(denseInteriorStepF, farProxyStepF * 0.72), weatherProxyStepF * 0.86), frontOccF) *
      (1.0 - straightThroughViewF * 0.46) *
      (1.0 - cloudApproachProtect * 0.88);
    let occlusionStepBoost = max(1.0, TUNE.frontOcclusionStepBoost);
    let stepBoostMax = max(max(1.0, TUNE.thickStepBoost * 0.88), occlusionStepBoost);
    let stepBoost = mix_f(1.0, stepBoostMax, adaptiveStepF);
    let occStepLimit = max(effectiveMaxStep, effectiveMaxStep * mix_f(1.0, occlusionStepBoost, frontOccF));
    let auroraStepLimit = select(occStepLimit, max(occStepLimit, stepLen), auroraLayerMode());
    let sampleStepLen = clamp(stepLen * stepBoost, TUNE.minStep, auroraStepLimit);

    if (densSmoothed > 0.00008) {
      if (auroraLayerMode()) {
        let sampleOD = min(densSmoothed * sampleStepLen * VIEW_EXTINCTION_SCALE * 0.30, 0.075);
        let absorb = exp(-sampleOD);
        let alpha = 1.0 - absorb;
        let auroraColor = auroraEmissionColor(p, ph_coarse, viewDir, sunDir, auroraMask);
        rgb += Tr * auroraColor * alpha * 1.35;
        Tr *= mix_f(1.0, absorb, 0.34);

        runMeanL += luminance(auroraColor * alpha);
        runN += 1.0;

        if (Tr <= transmittanceCutoff()) {
          Tr = 0.0;
          break;
        }
        prevDens = densSmoothed;
        prevMacroDens = densMacroSmoothed;
        prevTsun = 1.0;
        t = min(t + sampleStepLen, t1);
        iter = iter + 1;
        continue;
      }

      let localNoiseScreen = hash11Fast(
        f32(fullPix.x) * 0.093427 +
        f32(fullPix.y) * 0.047971 +
        f32(iter) * 0.217873 +
        rand0 * 23.731
      );
      var localNoise = localNoiseScreen;
      if (sphericalCloudMode()) {
        let localUvForNoise = shellUVFromWorld(p);
        localNoise = shellHash(
          localUvForNoise + vec2<f32>(f32(iter) * 0.0173 + rand0 * 0.047, f32(iter) * 0.0119),
          auroraModeF32(256.0, 160.0)
        );
      }
      let bnLocal = mix_f(rand0, localNoise, 0.12);
      let shadowInteriorProbe = saturate(remap(densMacroSmoothed, 0.05, 0.32, 0.0, 1.0));
      let proxyPerfF = max(farProxySafeF, saturate(remap(max(farF, screenFarF), 0.45, 0.95, 0.0, 1.0)));
      let closeRayProtect = 1.0 - smoothstep(effectiveNearFluffDist * 1.00, effectiveNearFluffDist * 2.40, sampleRayDistance);
      let silhouetteProtect = 1.0 - smoothstep(0.12, 0.34, densMacroSmoothed);
      let lightingEdgeProtect = saturate(max(closeRayProtect * 0.90, silhouetteProtect * (1.0 - shadowInteriorProbe * 0.55)));
      let thickLightF = thickPerfF * saturate(TUNE.thickLightSkip) * smoothstep(0.10, 0.72, sampleRayDistance);
      let thickLightPerfF = thickLightF * (1.0 - lightingEdgeProtect);
      let adaptiveStrideAdd = i32(floor(farF * 4.5 + screenFarF * 1.25 + shadowInteriorProbe * farF * 2.75 + proxyPerfF * 2.35 + thickLightPerfF * mix_f(1.2, 5.2, shadowInteriorProbe)));
      let sunStrideSafe = max(TUNE.sunStride + adaptiveStrideAdd, 1);
      if ((iter % sunStrideSafe) == 0) {
        if (densMacroSmoothed * sampleStepLen > TUNE.sunDensityGate) {
          let lowTransCut = select(0i, 1i, Tr < max(transmittanceCutoff() * 1.1, 0.01));
          let cheapSun = (proxyPerfF > 0.68) && (shadowInteriorProbe < 0.16) && (sampleRayDistance > effectiveNearFluffDist * 1.40) && (lightingEdgeProtect < 0.14);
          let localConeSun = (thickLightPerfF > 0.42 && shadowInteriorProbe > 0.24 && sampleRayDistance > effectiveNearFluffDist * 1.65 && (farF > 0.22 || Tr < 0.62) && lightingEdgeProtect < 0.18);
          if (cheapSun || localConeSun) {
            let coneOcc = densMacroSmoothed
              * mix_f(0.90, 1.70, max(proxyPerfF, thickLightPerfF))
              * mix_f(0.85, 1.55, shadowInteriorProbe);
            Tsun_cached = exp(-coneOcc);
          } else {
            let sunStepsAdaptive = max(2, TUNE.sunSteps - i32(floor(farF * 3.0)) - i32(floor(shadowInteriorProbe * farF * 2.0)) - i32(floor(proxyPerfF * 2.0)) - i32(floor(thickLightPerfF * 2.0)) - lowTransCut);
            let sunStepAdaptive = sunStepLen * mix_f(1.0, 1.55 + thickLightPerfF * 0.55, max(farF, proxyPerfF));
            Tsun_cached = sunTransmittance(
              p, sunDir, 0.0, lodShapeLighting, sunStepAdaptive,
              wScale, sunStepsAdaptive,
              fract(bnLocal + rand0 * 0.61803398875 + f32(iter) * 0.131)
            );
          }
        } else {
          Tsun_cached = 1.0;
        }

        let thickDenseFastLighting = thickLightPerfF > 0.30 && shadowInteriorProbe > 0.12 && lightingEdgeProtect < 0.20;
        let fastLighting = (sunStrideSafe > TUNE.sunStride && lightingEdgeProtect < 0.22) || macroOnly || (farF > 0.34) || (proxyPerfF > 0.42) || thickDenseFastLighting;
        let ultraFastLighting = fastLighting && (thickDenseFastLighting || ((thickLightPerfF > 0.38 && shadowInteriorProbe > 0.18) && lightingEdgeProtect < 0.14) || proxyPerfF > 0.70 || Tr < 0.48);
        if (CLOUD_DETAILED_LIGHTING != 0u && !fastLighting && sunStrideSafe <= 1) {
          shapeN_cached = approxShapeNormal(p, max(ph_coarse, 0.0), max(0.0, lodShapeLighting));
        } else if (ultraFastLighting) {
          shapeN_cached = approxShapeNormalFromChannels(s, p, max(ph_coarse, 0.0), sunDir, viewDir);
        } else {
          shapeN_cached = approxShapeNormalFast(p, max(ph_coarse, 0.0), max(0.0, lodShapeLighting + 0.45));
        }

        if (CLOUD_DETAILED_LIGHTING != 0u && !fastLighting && sunStrideSafe <= 1) {
          let densityN = approxLightingNormal(
            p,
            0.0,
            max(0.0, lodShapeLighting + 0.70),
            max(0.0, lodDetailLighting + 1.35),
            wScale
          );
          lightN_cached = normalize(mix_v3(shapeN_cached, densityN, mix_f(0.62, 0.22, shadowInteriorProbe)));
          sunExposure_cached = directionalExposure(
            p,
            0.0,
            max(0.0, lodShapeLighting + 0.55),
            max(0.0, lodDetailLighting + 1.05),
            sunDir,
            wScale
          );
        } else {
          let stableLightFallback = normalize(shapeN_cached + sunDir * 0.35 + viewDir * 0.10);
          lightN_cached = normalize(mix_v3(shapeN_cached, stableLightFallback, 0.24 * shadowInteriorProbe + 0.10 * proxyPerfF));
          sunExposure_cached = saturate(dot(lightN_cached, sunDir) * 0.72 + 0.28);
        }

        rim_cached = pow(1.0 - saturate(dot(lightN_cached, viewDir)), 1.7);

        let sunFacing = saturate(dot(lightN_cached, sunDir));
        sunSide_cached = sunFacing;
        sunRim_cached = pow(1.0 - sunFacing, 1.30);

        let upperRelative = saturate(dot(lightN_cached, normalize(sunDir * 0.75 + viewDir * 0.25)) * 0.5 + 0.5);
        upperExposure_cached = smoothstep(0.36, 0.82, upperRelative);
      }

      let raySmoothSunAdaptive = saturate(mix_f(TUNE.raySmoothSun * 0.22, TUNE.raySmoothSun, bodySmooth) * mix_f(1.0, 0.45, lightingEdgeProtect));
      let TsunSmoothed = mix_f(Tsun_cached, prevTsun, raySmoothSunAdaptive);
      let shadowInterior = saturate(remap(densMacroSmoothed, 0.05, 0.32, 0.0, 1.0)) * (1.0 - saturate(TsunSmoothed * 1.35));
      let bnScaled = mix_f(bnLocal, bnLocal * TUNE.bnFarScale, farF) * mix_f(1.0, 0.18, shadowInterior);

      let rayProgress = saturate((sampleT - t0) / max(raySegmentLength, EPS));
      let frontCardWindow = 1.0 - smoothstep(0.34, 0.70, rayProgress);
      let frontCardDensity = smoothstep(0.012, 0.115, densMacroSmoothed) * (1.0 - smoothstep(0.58, 0.98, densMacroSmoothed));
      let frontCardEdge = smoothstep(0.0008, 0.045, densSmoothed);
      let viewFrontCardOcclusion = rayShallowF * frontCardWindow * frontCardDensity * frontCardEdge;
      let shellFrontCardOcclusion = planetCardF * frontCardDensity * frontCardEdge * 0.46;
      let frontCardOcclusion = cloudModeF32(viewFrontCardOcclusion, shellFrontCardOcclusion, shellFrontCardOcclusion);
      let cardOcclusionStrength = 1.0 + frontCardOcclusion * mix_f(1.15, 2.65, saturate(TUNE.frontOcclusionStrength));
      let cardMacroFill = max(densSmoothed, densMacroSmoothed * mix_f(0.72, 1.28, frontCardOcclusion));
      let densForOpacity = mix_f(densSmoothed, cardMacroFill, frontCardOcclusion * 0.74);

      let rawSampleODFine = densForOpacity * sampleStepLen * VIEW_EXTINCTION_SCALE * cardOcclusionStrength;
      let rawSampleODMacro = densMacroSmoothed * sampleStepLen * VIEW_EXTINCTION_SCALE * mix_f(1.0, cardOcclusionStrength, frontCardOcclusion * 0.42);
      let sampleOD = min(mix_f(rawSampleODFine, rawSampleODMacro, 0.58 * shadowInterior), max(C.attenuationClamp, 0.001));
      let absorb = BeerLaw(sampleOD, C.cloudBeer);
      let alpha = 1.0 - absorb;

      let lightDensity = mix_f(densSmoothed, densMacroSmoothed, 0.82 * shadowInterior);
      let rimEffective = rim_cached * mix_f(1.0, 0.20, shadowInterior);
      let exposureEffective = sunExposure_cached * mix_f(1.0, 0.28, shadowInterior);
      let sideEffective = mix_f(sunSide_cached, 0.62, 0.35 * shadowInterior);

      var lightCol = CalculateLight(
        lightDensity,
        alpha,
        TsunSmoothed,
        cosVS,
        ph_coarse,
        bnScaled,
        t - t0,
        rimEffective,
        sideEffective,
        sunRim_cached,
        Tr,
        exposureEffective,
        upperExposure_cached
      );

      if (sphericalCloudMode()) {
        let relShell = p - B.center;
        let shellN = normalizeOr(relShell, vec3<f32>(0.0, 1.0, 0.0));
        let sunDotShell = dot(shellN, sunDir);
        let spaceDay = smoothstep(-0.18, 0.42, sunDotShell);
        let spaceTerminator = smoothstep(-0.30, 0.12, sunDotShell) * (1.0 - smoothstep(0.48, 0.92, sunDotShell));
        let nightTint = C.shadowLightColor * 0.18;
        let dayTint = C.frontLightColor * mix_f(0.82, 1.08, spaceDay);
        lightCol *= mix_v3(nightTint, dayTint, spaceDay) * mix_f(0.18, 1.18, spaceDay);

        let limbRim = pow(1.0 - saturate(dot(shellN, viewDir)), 2.75) * smoothstep(-0.12, 0.38, sunDotShell);
        lightCol += C.sunColor * alpha * (limbRim * 0.12 + spaceTerminator * 0.035);

        if (auroraLayerMode()) {
          let nightBoost = 1.0 - smoothstep(-0.18, 0.42, sunDotShell);
          let auroraPalette = auroraSpectralColor(p, ph_coarse);
          let capPresence = mix_f(0.90, 1.32, auroraMask);
          let evenEmission = auroraPalette * alpha * capPresence * mix_f(1.05, 2.00, nightBoost);
          let darkSideBoost = auroraPalette * alpha * mix_f(0.16, 0.55, nightBoost);
          let limbGlow = auroraPalette * alpha * pow(1.0 - saturate(dot(shellN, viewDir)), 1.90) * 0.18;
          lightCol = evenEmission + darkSideBoost + limbGlow;
        }
      }

      let frontCardBrightnessHold = 1.0 + frontCardOcclusion * 0.18 * (1.0 - shadowInterior * 0.55);
      lightCol *= frontCardBrightnessHold;

      let shadowLift = vec3<f32>(0.045, 0.050, 0.058) * shadowInterior;
      lightCol = lightCol + shadowLift * alpha;

      let lNow = luminance(lightCol);
      let meanL = select(lNow, runMeanL / max(runN, 1.0), runN > 0.0);
      let allow = max(meanL * (1.0 + TUNE.fflyRelClamp), TUNE.fflyAbsFloor);
      if (!auroraLayerMode() && lNow > allow) { lightCol *= allow / max(lNow, 1e-6); }

      if (auroraLayerMode()) {
        let relShell2 = p - B.center;
        let shellN2 = normalizeOr(relShell2, vec3<f32>(0.0, 1.0, 0.0));
        let nightBoost2 = 1.0 - smoothstep(-0.18, 0.42, dot(shellN2, sunDir));
        let auroraPalette2 = auroraSpectralColor(p, ph_coarse);
        let emissiveFloor = auroraPalette2 * alpha * mix_f(0.85, 2.10, nightBoost2) * mix_f(0.80, 1.25, auroraMask);
        lightCol = max(lightCol, emissiveFloor);
      }

      rgb += Tr * lightCol * alpha;
      Tr *= absorb;

      runMeanL += lNow;
      runN += 1.0;

      // Once the selected opacity cutoff is reached, force the result opaque
      // and stop marching. This preserves the early-exit win without leaving
      // dense clouds slightly see-through. Front-occlusion early exits use the
      // same closure so the accelerated path also remains opaque.
      if (Tr <= transmittanceCutoff()) {
        Tr = 0.0;
        break;
      }
      if (Tr <= frontOcclusionCutoff(frontOccF)) {
        Tr = 0.0;
        break;
      }
    }

    prevDens = densSmoothed;
    prevMacroDens = densMacroSmoothed;
    prevTsun = Tsun_cached;

    t = min(t + sampleStepLen, t1);
    iter = iter + 1;
  }

  // compose
  let aMarch = saturate(1.0 - Tr);
  let alphaCutoff = clamp(TUNE.alphaCutoff, 0.0, 0.999);
  let opaqueSoftLo = max(0.0, alphaCutoff - 0.10);
  let opaqueClosure = smoothstep(opaqueSoftLo, alphaCutoff, aMarch);
  let aRaw = mix_f(aMarch, min(1.0, aMarch + (1.0 - aMarch) * 0.82), opaqueClosure);
  let surfaceOpacity = clamp(TUNE.outputAlphaFeather, 0.0, 1.0);
  let surfaceGate =
    smoothstep(0.055, 0.34, aRaw) *
    (1.0 - smoothstep(0.76, 0.97, aRaw));
  let surfaceCurve = mix_f(1.0, 0.50, surfaceOpacity);
  let surfaceAlpha = saturate(pow(max(aRaw, 1e-5), surfaceCurve) * mix_f(1.0, 1.08, surfaceOpacity));
  let aLifted = mix_f(aRaw, max(aRaw, surfaceAlpha), surfaceGate * surfaceOpacity);

  let alphaBoostThreshold = clamp(TUNE.alphaBoostThreshold, 0.0, 0.995);
  let alphaBoostAmount = max(TUNE.alphaBoostAmount, 0.0);
  let alphaBoostRamp = select(
    0.0,
    saturate((aLifted - alphaBoostThreshold) / max(1.0 - alphaBoostThreshold, 1e-5)),
    aLifted > alphaBoostThreshold
  );
  let aBoosted = min(1.0, aLifted + alphaBoostAmount * alphaBoostRamp);
  let minOutputAlphaRaw = clamp(TUNE.minOutputAlpha, 0.0, 0.45);
  let minOutputAlpha = min(minOutputAlphaRaw, auroraModeF32(0.45, 0.006));
  let alphaGateWidth = max(minOutputAlpha * 2.25, auroraModeF32(0.030, 0.055));
  let outputAlphaGate = select(
    1.0,
    smoothstep(minOutputAlpha, min(minOutputAlpha + alphaGateWidth, 1.0), aBoosted),
    minOutputAlpha > 0.0001
  );
  let outputAlpha = aBoosted * outputAlphaGate;
  let premulLift = mix_f(
    1.0,
    clamp(aBoosted / max(aRaw, 0.08), 1.0, 1.36),
    surfaceOpacity * surfaceGate * 0.42
  );
  let outputRGB = rgb * outputAlphaGate * premulLift;

  var newCol: vec4<f32>;
  if (CLOUD_WRITE_RGB != 0u) {
    newCol = vec4<f32>(outputRGB, outputAlpha);
  } else {
    if (opt.outputChannel == 0u) { newCol = vec4<f32>(outputAlpha, 0.0, 0.0, 1.0); }
    else if (opt.outputChannel == 1u) { newCol = vec4<f32>(0.0, outputAlpha, 0.0, 1.0); }
    else if (opt.outputChannel == 2u) { newCol = vec4<f32>(0.0, 0.0, outputAlpha, 1.0); }
    else { newCol = vec4<f32>(0.0, 0.0, 0.0, outputAlpha); }
  }

  // Preserve compute output as premultiplied volumetric radiance.
  // The preview pass composites this over the procedural sky.
  // Alpha boost is applied only at the end so it does not feed back into
  // march-time shadowing, transmission, or lighting.
  newCol = vec4<f32>(max(newCol.rgb, vec3<f32>(0.0)), clamp(newCol.a, 0.0, 1.0));
  if(aircraft.distance<1000000.0){newCol=vec4<f32>(rgb+Tr*aircraft.color,.5+.5*Tr);}

  storeLayerSample(pixI, newCol, rayFarHistoryF, temporalHistoryActive);
}

@compute @workgroup_size(8, 8, 1)
fn computeCloudBox(
  @builtin(global_invocation_id) gid_in: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  computeCloudCore(gid_in, local_id);
}

@compute @workgroup_size(8, 8, 1)
fn computeCloudSphere(
  @builtin(global_invocation_id) gid_in: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  computeCloudCore(gid_in, local_id);
}
