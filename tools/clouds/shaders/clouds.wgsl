// ---------------------- Main compute

fn initCloudWorkgroup(local_id: vec3<u32>) {
  // workgroup cache
  if (all(local_id == vec3<u32>(0u))) {
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
    wg_boxMaxCached = B.center + B.half;
    if (CLOUD_USE_FIELDS == 0u) { wg_boxMaxCached.y += anvilLiftWorld(); }
  }
  workgroupBarrier();
}


fn storeRoundedSample(pix: vec2<i32>, color: vec4<f32>, farHistory: f32) {
  if (color.a <= 0.000001 && CLOUD_WRITE_RGB != 0u) {
    textureStore(outTex, pix, frame.layerIndex, vec4<f32>(0.0));
    store_history_full_res_if_owner(pix, frame.layerIndex, vec4<f32>(0.0));
    if (CLOUD_STAGED_RESOLVE != 0u) {
      let index = (u32(frame.layerIndex) * frame.fullHeight + u32(pix.y)) * frame.fullWidth + u32(pix.x);
      cloudResolveSamples[index].valid = 0u;
    }
    return;
  }
  if (CLOUD_STAGED_RESOLVE != 0u) {
    let index = (u32(frame.layerIndex) * frame.fullHeight + u32(pix.y)) * frame.fullWidth + u32(pix.x);
    cloudResolveSamples[index].color = color;
    cloudResolveSamples[index].farHistory = farHistory;
    cloudResolveSamples[index].valid = 1u;
  } else {
    let historyActive = reproj.enabled == 1u || temporalCellRateNormalized() > 1u || reproj.temporalBlend > 0.0001;
    resolveCloudColor(pix, color, farHistory, historyActive);
  }
}

// Rounded forms read shared fields; optional edge detail needs just two tiled
// noise reads near the visible surface, without a secondary sun march.
// Stable world-space density and fixed pixel jitter also work with sparse TAA.
fn cloudRayJitter(pix:vec2<u32>) -> f32 {
  // Integer avalanche avoids the diagonal correlation of scalar sin/fract
  // hashes and structured noise maps. Stable per pixel, with no frame flicker
  // or extra texture fetch. This only applies to the cached-volume ray path.
  var h=(pix.x*0x9e3779b9u) ^ (pix.y*0x85ebca6bu) ^ 0x68bc21ebu;
  h=(h ^ (h >> 16u))*0x7feb352du;
  h=(h ^ (h >> 15u))*0x846ca68bu;
  h=h ^ (h >> 16u);
  return f32(h >> 8u)*(1.0/16777216.0);
}

fn turbulentCloudDensity(p:vec3<f32>, density:vec4<f32>, footprint:f32) -> f32 {
  let base = max(density.r, 0.0);
  let amount = clamp(FIELD.morphology.w, 0.0, 1.5);
  // Empty space and dense interiors retain the cheap cached path. Subtractive
  // erosion cannot fill empty sky, expand a mask, or expose an unlit outer halo.
  let shoulder = 1.0 - smoothstep(0.04, 0.38, density.a);
  let puff = max(TUNE.puffScale, 0.75);
  let resolved = 1.0 - smoothstep(0.07, 0.32, footprint / puff);
  let strength = amount * shoulder * resolved;
  if (base < 0.0001 || strength < 0.001) { return base; }
  let dimensions = vec3<f32>(textureDimensions(detail3D));
  let scale = 0.90 / puff;
  let maxDimension = max(max(dimensions.x, dimensions.y), dimensions.z);
  let maxLOD = f32(textureNumLevels(detail3D) - 1u);
  let lod = clamp(log2(max(footprint * scale * maxDimension, 1.0)), 0.0, maxLOD);
  let warpLOD = clamp(lod - 1.8, 0.0, maxLOD);
  // Follow the existing independently advected detail domain. Smooth low-
  // frequency distortion folds the fine noise into elongated turbulent wisps.
  // No pixel hash, frame counter or new seed enters this material-space signal.
  let q = (p + NTransform.detailOffsetWorld) * scale;
  let bend = textureSampleLevel(detail3D, sampDetail, q * 0.28, warpLOD).gbr - 0.5;
  let fineUV = q * vec3<f32>(0.65, 1.35, 1.0) + bend * 0.85;
  let fine = textureSampleLevel(detail3D, sampDetail, fineUV, min(lod + 0.45, maxLOD)).rgb;
  let turbulence = dot(fine, vec3<f32>(0.55, 0.30, 0.15));
  let erosion = smoothstep(0.32, 0.70, turbulence);
  return base * max(0.08, 1.0 - strength * erosion * 0.85);
}
@compute @workgroup_size(8, 8, 1)
fn computeCloudBox(@builtin(global_invocation_id) gid: vec3<u32>) {
  var pix = vec2<i32>(gid.xy) + vec2<i32>(frame.originX, frame.originY);
  if (reproj.compactInterleave != 0u && temporalCellRateNormalized() > 1u && reproj.frameIndex > 0u) {
    let mapped = compactTemporalPixel(gid.xy, temporalCellRateNormalized());
    if (mapped.z == 0u) { return; }
    pix = vec2<i32>(mapped.xy);
  }
  if (any(pix < vec2<i32>(0)) || any(pix >= vec2<i32>(i32(frame.fullWidth), i32(frame.fullHeight)))) { return; }
  var ro = V.camPos;
  if (CLOUD_USE_CUSTOM_POS != 0u) { ro = posBuf[u32(pix.y) * frame.fullWidth + u32(pix.x)].xyz; }
  let uv = (vec2<f32>(pix) + 0.5) / vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));
  let ndc = uv * 2.0 - 1.0;
  let tanY = tan(V.fovY * 0.5);
  let rd = normalize(V.fwd + V.right * (ndc.x * V.aspect * tanY) - V.up * (ndc.y * tanY));
  let aircraft = sceneAircraft(ro,rd,V.aircraftPosition,V.right,V.up,V.fwd,V._v0,V._v1,V._v2,V.aircraftYaw,normalize(L.sunDir));
  let rayMin=select(FIELD.gridMin.xyz,B.center-B.half,FIELD.dimensions.w>0u);
  let rayMax=select(FIELD.gridMin.xyz+FIELD.gridSize.xyz,B.center+B.half,FIELD.dimensions.w>0u);
  var hit = intersectAABB_robust(ro, rd, rayMin,rayMax);
  let begin = max(hit.x, 0.0);
  if(aircraft.distance<1000000.0 && (hit.y<=begin || aircraft.distance<=begin)){
    storeRoundedSample(pix,vec4<f32>(aircraft.color,1.0),0.0);return;
  }
  hit.y=min(hit.y,aircraft.distance);
  if (hit.y <= begin) { storeRoundedSample(pix, vec4<f32>(0.0), 0.0); return; }
  let spacing = FIELD.gridSize.xyz / vec3<f32>(FIELD.dimensions.xyz);
  let voxelStep = 1.0 / max(max(abs(rd.x) / spacing.x, abs(rd.y) / spacing.y), abs(rd.z) / spacing.z);
  let budget = max(TUNE.maxSteps, 1);
  // Cover the entire segment without thin-sheet thickBox/vertical step boosts.
  let baseStep=max(voxelStep * 0.65, TUNE.minStep);
  var step = select(max(baseStep,(hit.y - begin) / f32(budget)),baseStep,FIELD.dimensions.w>0u);
  let jitter = cloudRayJitter(vec2<u32>(pix));
  var t = begin + step * jitter * clamp(TUNE.phaseJitter, 0.0, 1.0);
  var transmittance = 1.0;
  var radiance = vec3<f32>(0.0);
  let sun = normalizeOr(L.sunDir, vec3<f32>(0.0, 1.0, 0.0));
  let phase = saturate(dot(rd, sun) * 0.5 + 0.5);
  for (var i = 0; i < budget; i++) {
    if (t >= hit.y || transmittance < 0.008) { break; }
    let pixelFootprint = t * (2.0 * tanY) / f32(frame.fullHeight);
    if(FIELD.dimensions.w>0u){
      // Growing horizon steps are safe only in empty space. Sampling cloud
      // lighting with them (several world units per sample) amplified phase
      // jitter into grain even though the tiled density field stayed detailed.
      step=max(baseStep,pixelFootprint*0.65);
      let nearDensity=textureSampleLevel(cloudDensityField,cloudFieldSampler,cloudFieldUV(ro+rd*t),0.0).r;
      if(nearDensity<0.00001){
        var skip=min(max(step,(t-begin)*0.045),hit.y-t);
        var skipped=false;
        for(var attempt=0;attempt<3;attempt++){
          if(skip<=step*1.25){break;}
          // The full mip chain stores maxima in B, so a thin cloud cannot
          // disappear into an averaged empty-space test. Include interpolation
          // support around the entire proposed interval, not just its center.
          let lod=clamp(ceil(log2(max(skip/voxelStep+2.0,1.0))),0.0,f32(textureNumLevels(cloudDensityField)-1u));
          let bound=textureSampleLevel(cloudDensityField,cloudFieldSampler,cloudFieldUV(ro+rd*(t+skip*0.5)),lod).b;
          if(bound<0.00001){t+=skip;skipped=true;break;}
          skip*=0.25;
        }
        if(skipped){continue;}
      }
    }
    let p = ro + rd * t;
    let fieldUV = cloudFieldUV(p);
    let distance = min(step, hit.y - t);
    let fieldLod=clamp(log2(max(max(pixelFootprint,step*0.35)/min(min(spacing.x,spacing.y),spacing.z),1.0)),0.0,3.0);
    let density = textureSampleLevel(cloudDensityField, cloudFieldSampler, fieldUV, fieldLod);
    let fineDensity = turbulentCloudDensity(p, density, max(step * 0.65, pixelFootprint));
    let alpha = 1.0 - exp(-fineDensity * distance * VIEW_EXTINCTION_SCALE);
    if (alpha > 0.00001) {
      let lighting = textureSampleLevel(cloudLightField, cloudFieldSampler, fieldUV, fieldLod);
      let diffuse = clamp(lighting.r, 0.0, 1.0);
      let visibility = clamp(lighting.b, 0.0, 1.0);
      let ao = mix_f(1.0, lighting.a, saturate(TUNE.aoStrength));
      let upper = clamp(lighting.g, 0.0, 1.0);
      let direct = visibility * (0.20 + 0.80 * diffuse);
      let asperitasFill = select(FIELD.morphology.z, 1.0, TUNE.formType >= 6.5);
      let ambient = (0.10 + 0.19 * upper + asperitasFill * 0.22) * ao;
      // Low-order multiple-scattering fill reuses the cached sun visibility.
      // It reveals billows on the shaded face without another density probe or
      // a secondary raymarch, including grades with very dark shadow tints.
      let bounce = (0.035 + asperitasFill * 0.045 + 0.18 * sqrt(sqrt(visibility))) * (0.25 + 0.75 * upper) * ao;
      let scatter = visibility * (0.10 + 0.30 * pow(phase, 4.0));
      let silverPhase=pow(phase,max(6.0,C.silverExponent*8.0));
      let exposedEdge=1.0-smoothstep(0.02,0.20,density.w);
      let silver = silverPhase * pow(visibility,0.50) * pow(1.0 - diffuse, 0.90) * exposedEdge * max(C.silverIntensity, 0.0) * 1.4;
      let sunColor = max(C.frontLightColor, vec3<f32>(0.0));
      let skyColor = max(C.shadowLightColor, vec3<f32>(0.0));
      let color = sunColor * (direct + scatter + bounce) + skyColor * ambient + max(C.sunColor, vec3<f32>(0.0)) * silver;
      radiance += transmittance * alpha * color;
      transmittance *= 1.0 - alpha;
    }
    t += step;
  }
  let rawAlpha = clamp(1.0 - transmittance, 0.0, 1.0);
  // The hybrid has genuinely tenuous edges. Fade them before history instead
  // of retaining a pale outline of the scaffold, or using a hard alpha cutoff
  // which would make developing clouds pop. Keep radiance premultiplied.
  let edgeFade = smoothstep(0.0, max(TUNE.minOutputAlpha, 0.00001), rawAlpha);
  let a = rawAlpha * edgeFade;
  var result = vec4<f32>(radiance * edgeFade, a);
  // Hull rays encode their front transmission in alpha (.5..1); the preview
  // separates metal from cloud before grading and fogging the two components.
  if(aircraft.distance<1000000.0){result=vec4<f32>(radiance+transmittance*aircraft.color,.5+.5*transmittance);}
  if (CLOUD_WRITE_RGB == 0u) {
    if (opt.outputChannel == 0u) { result = vec4<f32>(a,0.0,0.0,1.0); }
    else if (opt.outputChannel == 1u) { result = vec4<f32>(0.0,a,0.0,1.0); }
    else if (opt.outputChannel == 2u) { result = vec4<f32>(0.0,0.0,a,1.0); }
    else { result = vec4<f32>(0.0,0.0,0.0,a); }
  }
  let farHistory = saturate((hit.y - TUNE.farStart) / max(TUNE.farFull - TUNE.farStart, EPS));
  storeRoundedSample(pix, result, farHistory);
}
