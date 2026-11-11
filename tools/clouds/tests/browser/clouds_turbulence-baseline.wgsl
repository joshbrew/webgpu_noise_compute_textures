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

// Reuse the periodic noise tiles as a continuous material-space deformation.
// These coordinates are shared by density and lighting; the bake stays regular.
fn cachedDomainStrength() -> f32 {
  return select(0.0,clamp(FIELD.morphology.w,0.0,1.5),FIELD.volume.x<0.5);
}
fn cachedDomainAmplitudes() -> mat2x3<f32> {
  let spacing=FIELD.gridSize.xyz/vec3<f32>(FIELD.dimensions.xyz);
  let strength=cachedDomainStrength();
  let broad=select(vec3<f32>(0.0),vec3<f32>(FIELD.gridSize.x*0.40,FIELD.gridSize.y*0.12,FIELD.gridSize.z*0.40),FIELD.dimensions.w>0u);
  return mat2x3<f32>(broad*strength,spacing*vec3<f32>(1.25,1.8,1.25)*strength);
}
fn cachedDomainPosition(p:vec3<f32>)->vec3<f32> {
  if(cachedDomainStrength()<0.001){return p;}
  let amplitudes=cachedDomainAmplitudes();
  var displacement=vec3<f32>(0.0);
  if(FIELD.dimensions.w>0u){
    let scale=1.0/(max(FIELD.gridSize.x,FIELD.gridSize.z)*4.7);
    let lod=max(f32(textureNumLevels(shape3D))-4.0,0.0);
    let noise=textureSampleLevel(shape3D,sampShape,(p+NTransform.shapeOffsetWorld)*scale+vec3<f32>(0.17,0.39,0.61),lod).gbr;
    displacement+=(clamp((noise-0.5)*3.0,vec3<f32>(-0.5),vec3<f32>(0.5))*2.0)*amplitudes[0];
  }
  let lod=max(f32(textureNumLevels(detail3D))-4.0,0.0);
  let noise=textureSampleLevel(detail3D,sampDetail,(p+NTransform.detailOffsetWorld)*(0.22/max(TUNE.puffScale,0.75)),lod).brg;
  displacement+=(clamp((noise-0.5)*3.0,vec3<f32>(-0.5),vec3<f32>(0.5))*2.0)*amplitudes[1];
  // Fade vertical displacement before the volume boundary, preserving its halo.
  let ph=clamp((p.y-FIELD.gridMin.y)/FIELD.gridSize.y,0.0,1.0);
  displacement.y*=smoothstep(0.0,0.12,ph)*(1.0-smoothstep(0.88,1.0,ph));
  return p+displacement;
}
// Bound the deformed interval using the maximum slope of filtered noise texels.
// Empty-space queries include cubic support and cannot jump warped cloud edges.
fn cachedDomainSkipFootprint(length:f32,rd:vec3<f32>,spacing:vec3<f32>)->f32 {
  let amplitudes=cachedDomainAmplitudes();
  let macroLod=max(i32(textureNumLevels(shape3D))-4,0);
  let microLod=max(i32(textureNumLevels(detail3D))-4,0);
  let macroRate=vec3<f32>(textureDimensions(shape3D,macroLod))/(max(FIELD.gridSize.x,FIELD.gridSize.z)*4.7);
  let microRate=vec3<f32>(textureDimensions(detail3D,microLod))*(0.22/max(TUNE.puffScale,0.75));
  let broadDelta=min(2.0,3.0*length*dot(abs(rd),macroRate));
  let fineDelta=min(2.0,3.0*length*dot(abs(rd),microRate));
  var extent=amplitudes[0]*broadDelta+amplitudes[1]*fineDelta;
  extent.y+=(amplitudes[0].y+amplitudes[1].y)*min(2.0,12.5*length*abs(rd.y)/FIELD.gridSize.y);
  let cells=(abs(rd)*length+extent*2.0)/spacing;
  return max(max(cells.x,cells.y),cells.z)+4.0;
}
// Positive cubic B-spline reconstruction uses eight hardware trilinear reads.
// Unlike a sharp interpolator, it cannot create negative density or bright halos.
fn cachedCubicSample(tex:texture_3d<f32>,uv:vec3<f32>)->vec4<f32> {
  let dims=vec3<f32>(textureDimensions(tex));
  let coord=uv*dims-0.5;
  let cell=floor(coord);
  let f=fract(coord);
  let w0=(1.0-f)*(1.0-f)*(1.0-f)/6.0;
  let w1=(3.0*f*f*f-6.0*f*f+4.0)/6.0;
  let w2=(-3.0*f*f*f+3.0*f*f+3.0*f+1.0)/6.0;
  let w3=f*f*f/6.0;
  let g0=w0+w1;
  let g1=w2+w3;
  let a=(cell-1.0+w1/g0+0.5)/dims;
  let b=(cell+1.0+w3/g1+0.5)/dims;
  var result=vec4<f32>(0.0);
  for(var z=0u;z<2u;z++){for(var y=0u;y<2u;y++){for(var x=0u;x<2u;x++){
    let at=vec3<f32>(select(a.x,b.x,x==1u),select(a.y,b.y,y==1u),select(a.z,b.z,z==1u));
    let weight=select(g0.x,g1.x,x==1u)*select(g0.y,g1.y,y==1u)*select(g0.z,g1.z,z==1u);
    result+=textureSampleLevel(tex,cloudFieldSampler,at,0.0)*weight;
  }}}
  return result;
}
fn cachedVisibleSample(tex:texture_3d<f32>,uv:vec3<f32>,lod:f32)->vec4<f32> {
  if(TUNE.formType>8.5 && lod<1.0){
    return mix(cachedCubicSample(tex,uv),textureSampleLevel(tex,cloudFieldSampler,uv,1.0),lod);
  }
  return textureSampleLevel(tex,cloudFieldSampler,uv,lod);
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
  var aircraft = sceneAircraft(ro,rd,V.aircraftPosition,V.right,V.up,V.fwd,V._v0,V._v1,V._v2,V.aircraftYaw,normalize(L.sunDir));
  let worldTerrainDistance=cloudTerrainDepth(cloudTerrainTexture,uv,V._v3);
  if(worldTerrainDistance<aircraft.distance){aircraft.distance=1000000.0;}
  let cloudScale=flatCloudScale();
  let terrainDistance=worldTerrainDistance/cloudScale;
  if(aircraft.distance<1000000.0){aircraft.distance/=cloudScale;}
  ro=flatCloudMaterialOrigin(ro);
  let rayMin=select(FIELD.gridMin.xyz,B.center-B.half,FIELD.dimensions.w>0u);
  let rayMax=select(FIELD.gridMin.xyz+FIELD.gridSize.xyz,B.center+B.half,FIELD.dimensions.w>0u);
  var hit = intersectAABB_robust(ro, rd, rayMin,rayMax);
  let begin = max(hit.x, 0.0);
  if(aircraft.distance<1000000.0 && (hit.y<=begin || aircraft.distance<=begin)){
    storeRoundedSample(pix,vec4<f32>(aircraft.color,1.0),0.0);return;
  }
  hit.y=min(hit.y,min(aircraft.distance,terrainDistance));
  if (hit.y <= begin) { storeRoundedSample(pix, vec4<f32>(0.0), 0.0); return; }
  let spacing = FIELD.gridSize.xyz / vec3<f32>(FIELD.dimensions.xyz);
  let voxelStep = 1.0 / max(max(abs(rd.x) / spacing.x, abs(rd.y) / spacing.y), abs(rd.z) / spacing.z);
  let budget = max(TUNE.maxSteps, 1);
  // Cover the entire segment without thin-sheet thickBox/vertical step boosts.
  let baseStep=max(voxelStep * 0.65, TUNE.minStep);
  var step=baseStep;
  let jitter=cloudRayJitter(vec2<u32>(pix))*clamp(TUNE.phaseJitter,0.0,0.15);
  var t=begin;
  // Phase-lock the near ray intervals under translation. These are intervals
  // along the actual camera ray, not cells of an axis-aligned spatial grid.
  // Integrate the first partial interval instead of leaving a jittered gap.
  let firstInterval=baseStep*(1.0-fract((dot(ro-B.center,rd)+begin)/baseStep-jitter));
  let nearCount=min(max(ceil(max(TUNE.puffScale*2.0,voxelStep*8.0)/baseStep),1.0),max(floor(f32(budget)*0.38),1.0));
  let nearEnd=begin+firstInterval+baseStep*(nearCount-1.0);
  let farCount=max(f32(budget)-nearCount,1.0);
  let farLength=max(hit.y-nearEnd-baseStep*farCount,0.0);
  var previousDensity=vec4<f32>(0.0);
  var previousDomain=vec3<f32>(0.0);
  var previousEnd=-1.0;
  var previousLod=-1.0;
  var transmittance = 1.0;
  var radiance = vec3<f32>(0.0);
  let sun = normalizeOr(L.sunDir, vec3<f32>(0.0, 1.0, 0.0));
  let phase = saturate(dot(rd, sun) * 0.5 + 0.5);
  let scatterPhase=0.10+0.30*pow(phase,4.0);
  let silverPhase=pow(phase,max(6.0,C.silverExponent*8.0));
  let sunColor=max(C.frontLightColor,vec3<f32>(0.0));
  let skyColor=max(C.shadowLightColor,vec3<f32>(0.0));
  for (var i = 0; i < budget; i++) {
    if (t >= hit.y || transmittance < 0.008) { break; }
    let pixelFootprint = t * (2.0 * tanY) / f32(frame.fullHeight);
    if(f32(i)<nearCount){
      step=max(begin+firstInterval+baseStep*f32(i)-t,0.000001);
    }else{
      let farIndex=f32(i)+1.0-nearCount;
      let progress=farIndex/farCount;
      let plannedEnd=nearEnd+baseStep*farIndex+farLength*progress*progress*progress;
      step=max(max(baseStep,pixelFootprint*0.65),plannedEnd-t);
    }
    let p = ro + rd * (t + min(step,hit.y-t)*0.5);
    let distance = min(step, hit.y - t);
    // The thin morning deck varies mostly across X/Z. Selecting isotropic
    // mips from its much smaller Y spacing blurs several horizontal cells
    // together, erasing the ruffles even in a full-resolution close-up.
    let fieldFilterSpacing=select(min(min(spacing.x,spacing.y),spacing.z),
      min(spacing.x,spacing.z),TUNE.formType>7.5&&TUNE.formType<8.5);
    let fieldLod=clamp(log2(max(max(pixelFootprint,step*0.35)/fieldFilterSpacing,1.0)),0.0,3.0);
    // Integrate a linear density segment. The previous endpoint is reused,
    // replacing the separate near-density probe rather than adding two reads
    // per interval. This smooths camera-relative slice changes in thin cloud.
    var domainStart=previousDomain;
    var densityStart=previousDensity;
    if(abs(previousEnd-t)>0.00001){
      domainStart=cachedDomainPosition(ro+rd*t);
      densityStart=cachedVisibleSample(cloudDensityField,cloudFieldUV(domainStart),fieldLod);
    }else if(abs(previousLod-fieldLod)>0.25){
      densityStart=cachedVisibleSample(cloudDensityField,cloudFieldUV(domainStart),fieldLod);
    }
    let domainEnd=cachedDomainPosition(ro+rd*(t+distance));
    let densityEnd=cachedVisibleSample(cloudDensityField,cloudFieldUV(domainEnd),fieldLod);
    previousDensity=densityEnd;previousDomain=domainEnd;
    previousEnd=t+distance;previousLod=fieldLod;
    var density=(densityStart+densityEnd)*0.5;
    var lightWeight=0.5+(densityEnd.r-densityStart.r)/(6.0*max(densityStart.r+densityEnd.r,0.000001));
    // Resolve the near integral with Simpson weights. Its midpoint read
    // replaces the old occupancy-only probe; fade to the cheaper endpoint
    // integral at distance so transparent close wisps keep their detail.
    let nearBlend=1.0-smoothstep(max(TUNE.puffScale,voxelStep*4.0),max(TUNE.puffScale*2.0,voxelStep*8.0),t-begin);
    if(nearBlend>0.001){
      let middle=cachedVisibleSample(cloudDensityField,cloudFieldUV(cachedDomainPosition(p)),fieldLod);
      let integral=(densityStart+middle*4.0+densityEnd)/6.0;
      density=mix(density,integral,nearBlend);
      let midpointWeight=(middle.r*2.0+densityEnd.r)/max(densityStart.r+middle.r*4.0+densityEnd.r,0.000001);
      lightWeight=mix(lightWeight,midpointWeight,nearBlend);
      density.b=max(density.b,middle.b);
    }
    density.b=max(density.b,max(densityStart.b,densityEnd.b));
    if(FIELD.dimensions.w>0u && f32(i)>=nearCount && density.b<0.00001){
      var skip=min(max(step,(t-begin)*0.045),hit.y-t);
      var skipped=false;
      for(var attempt=0;attempt<3;attempt++){
        if(skip<=step*1.25){break;}
        let lod=clamp(ceil(log2(max(cachedDomainSkipFootprint(skip,rd,spacing),1.0))),0.0,f32(textureNumLevels(cloudDensityField)-1u));
        let bound=textureSampleLevel(cloudDensityField,cloudFieldSampler,cloudFieldUV(cachedDomainPosition(ro+rd*(t+skip*0.5))),lod).b;
        if(bound<0.00001){t+=skip;skipped=true;break;}
        skip*=0.25;
      }
      if(skipped){continue;}
    }
    let fieldUV=cloudFieldUV(mix(domainStart,domainEnd,lightWeight));
    let fineDensity = turbulentCloudDensity(p, density, max(step, pixelFootprint));
    let alpha = 1.0 - exp(-fineDensity * distance * VIEW_EXTINCTION_SCALE);
    if (alpha > 0.00001) {
      let lighting = cachedVisibleSample(cloudLightField, fieldUV, fieldLod);
      let diffuse = clamp(lighting.r, 0.0, 1.0);
      let visibility = clamp(lighting.b, 0.0, 1.0);
      let ao = mix_f(1.0, lighting.a, saturate(TUNE.aoStrength));
      let upper = clamp(lighting.g, 0.0, 1.0);
      let direct = visibility * (0.20 + 0.80 * diffuse);
      let asperitasFill = select(FIELD.morphology.z, 1.0, TUNE.formType >= 6.5 && TUNE.formType < 7.5);
      let ambient = (0.10 + 0.19 * upper + asperitasFill * 0.22) * ao;
      // Low-order multiple-scattering fill reuses the cached sun visibility.
      // It reveals billows on the shaded face without another density probe or
      // a secondary raymarch, including grades with very dark shadow tints.
      let rootVisibility=sqrt(visibility);
      let bounce = (0.035 + asperitasFill * 0.045 + 0.18 * sqrt(rootVisibility)) * (0.25 + 0.75 * upper) * ao;
      let scatter = visibility * scatterPhase;
      let exposedEdge=1.0-smoothstep(0.02,0.20,density.w);
      let silver = silverPhase * rootVisibility * pow(1.0 - diffuse, 0.90) * exposedEdge * max(C.silverIntensity, 0.0) * 1.4;
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
  let farHistory = saturate((hit.y * cloudScale - TUNE.farStart) / max(TUNE.farFull - TUNE.farStart, EPS));
  storeRoundedSample(pix, result, farHistory);
}
