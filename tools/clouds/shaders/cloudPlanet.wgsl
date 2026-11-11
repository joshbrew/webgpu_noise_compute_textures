// Compact regular planet styles. Independent of flat morphology, detailed
// legacy lighting and aurora call graphs; all seven styles share this entry.
fn planetShape(p:vec3<f32>,lod:f32)->vec4<f32> {
 var moved=sphericalSampleDriftedWorld(p,vec3<f32>(NTransform.shapeOffsetWorld.x,0,NTransform.shapeOffsetWorld.z))-B.center;
 if(TUNE.formType>=.5 && TUNE.formType<4.5){
  moved=planetWarpPosition(p-B.center,NTransform.shapeOffsetWorld.x*6.283185307,TUNE.formType,NTransform.planetWarpAmount,NTransform.planetWarpPhase);
  moved=sphericalDriftedWorld(B.center+moved,vec3<f32>(0,0,NTransform.shapeOffsetWorld.z))-B.center;
 }
 let scale=max(V.worldToUV*B.uvScale,EPS)*max(NTransform.shapeScale,EPS);
 let domain=moved*axisOrOne3(NTransform.shapeAxisScale)*scale;
 return textureSampleLevel(shape3D,sampShape,planetEvolvingDomain(domain,NTransform.shapeOffsetWorld.y),lod);
}
// Continuous Cartesian deformation, one texture read and no rebake/extra march.
fn planetEvolvingDomain(p:vec3<f32>,phase:f32)->vec3<f32> {
 let warp=vec3<f32>(sin(p.y*5.7+phase),sin(p.z*6.3-phase*.71),sin(p.x*5.1+phase*.47));
 return p+vec3<f32>(.018,.011,-.014)*phase+warp*.055;
}
fn planetPhase(p:vec3<f32>)->f32 {return (length(p-B.center)-V.planetRadius-V.cloudBottom)/max(V.cloudTop-V.cloudBottom,EPS);}
fn planetWeather(p:vec3<f32>)->vec4<f32> {
 // Rotate the unit-sphere domain, not the equirectangular UV. Gas bands and
 // coverage travel with the shell without sliding through a longitude seam.
 let wind=NTransform.weatherOffsetWorld;
 var moved=sphericalDriftedWorld(p,wind);
 if(TUNE.formType>=.5){
  moved=B.center+planetWarpDirection(normalize(p-B.center),wind.x*6.283185307,TUNE.formType,NTransform.planetWarpAmount,NTransform.planetWarpPhase);
  if(TUNE.formType<4.5){moved=sphericalDriftedWorld(moved,vec3<f32>(0,wind.y,wind.z));}
 }
 let uv=sphereUVFromWorld(moved);
 let latitudeScale=axisOrOne3(NTransform.weatherAxisScale).z*max(NTransform.weatherScale,EPS);
 return wrap2D(weather2D,samp2D,(uv-vec2<f32>(.5))*vec2<f32>(1,latitudeScale)+vec2<f32>(.5),0,0.0);
}
fn planetMass(p:vec3<f32>,lod:f32)->f32 {
 let ph=planetPhase(p);if(ph<=0.0||ph>=1.0){return 0.0;}
 return styledPlanetDensity(ph,planetWeather(p),planetShape(p,lod),0.0)/max(C.globalDensity*10.0,EPS);
}
fn planetPixelRandom(p:vec2<u32>)->f32 {
 var h=(p.x*0x9e3779b9u)^(p.y*0x85ebca6bu)^0x68bc21ebu;
 h=(h^(h>>16u))*0x7feb352du;h=(h^(h>>15u))*0x846ca68bu;return f32((h^(h>>16u))>>8u)*(1.0/16777216.0);
}
@compute @workgroup_size(8,8,1)
fn computeCloudPlanet(@builtin(global_invocation_id) gid:vec3<u32>,@builtin(local_invocation_id) local:vec3<u32>) {
 if(all(local==vec3<u32>(0u))){
  wg_weatherDim=vec2<f32>(textureDimensions(weather2D));wg_maxMipW=f32(textureNumLevels(weather2D))-1.0;
  wg_boxMaxXZ=1.0;wg_verticalRefHalfY=max(B.half.y,EPS);wg_verticalRefBoxH=wg_verticalRefHalfY*2.0;
 }
 workgroupBarrier();
 var pix=vec2<i32>(gid.xy)+vec2<i32>(frame.originX,frame.originY);
 if(reproj.compactInterleave!=0u && temporalCellRateNormalized()>1u && reproj.frameIndex>0u){
  let mapped=compactTemporalPixel(gid.xy,temporalCellRateNormalized());if(mapped.z==0u){return;}pix=vec2<i32>(mapped.xy);
 }
 if(any(pix<vec2<i32>(0))||any(pix>=vec2<i32>(i32(frame.fullWidth),i32(frame.fullHeight)))){return;}
 let uv=(vec2<f32>(pix)+0.5)/vec2<f32>(f32(frame.fullWidth),f32(frame.fullHeight));let ndc=uv*2.0-1.0;
 var ro=V.camPos;if(CLOUD_USE_CUSTOM_POS!=0u){ro=posBuf[u32(pix.y)*frame.fullWidth+u32(pix.x)].xyz;}
 let rd=normalize(V.fwd+V.right*(ndc.x*V.aspect*tan(V.fovY*0.5))-V.up*(ndc.y*tan(V.fovY*0.5)));
 let hit=intersectSphericalCloudShellView(ro,rd);
 let historyActive=reproj.enabled==1u||temporalCellRateNormalized()>1u||reproj.temporalBlend>0.0001;
 if(hit.x>=hit.y){storeLayerSample(pix,vec4<f32>(0.0),0.0,historyActive);return;}
 let h=max(V.cloudTop-V.cloudBottom,EPS);let shapeDims=vec3<f32>(textureDimensions(shape3D));
 let scale=max(V.worldToUV*B.uvScale*NTransform.shapeScale,EPS);
 let rayPixelScale=2.0*tan(V.fovY*0.5)/f32(frame.fullHeight);
 let steps=clamp(TUNE.maxSteps,16,160);let step=max((hit.y-hit.x)/f32(steps),h/64.0);
 let probe=clamp(1.25/(scale*shapeDims.x),h*.012,h*.15);
 let extinction=max(C.globalDensity,0.0)*0.34/h;
 var t=hit.x+step*planetPixelRandom(vec2<u32>(pix));var tr=1.0;var color=vec3<f32>(0.0);
 var sunVisibility=1.0;var normal=normalize(ro+rd*hit.x-B.center);
 let sun=normalize(L.sunDir);var litSamples=0;
 let neptune=TUNE.formType>=5.5&&TUNE.formType<6.5;
 let sunStride=max(TUNE.sunStride,1);
 let normalStride=select(sunStride,min(sunStride,2),length(ro-B.center)<V.planetRadius+V.cloudTop+h*0.5);
 for(var i=0;i<steps;i++){
  if(t>=hit.y||tr<0.012){break;}
  let p=ro+rd*t;let ph=planetPhase(p);
  if(ph>0.0&&ph<1.0){
   let footprint=max(t*rayPixelScale,0.25/(scale*shapeDims.x));
   let lod=clamp(log2(max(footprint*scale*shapeDims.x,1.0)),0.0,f32(textureNumLevels(shape3D))-1.0);
   let s=planetShape(p,lod);let weather=planetWeather(p);
   var density=styledPlanetDensity(ph,weather,s,0.0)/max(C.globalDensity*10.0,EPS);
   if(density>0.0001){
    // Fine noise only erodes the skin; dense interiors remain coherent. Real
    // mip filtering limits subpixel shimmer without a camera-relative reset.
    let detailScale=max(V.worldToUV*B.uvScale*4.0*NTransform.detailScale,EPS);
    let detailLod=clamp(log2(max(footprint*detailScale*f32(textureDimensions(detail3D).x),1.0)),0.0,f32(textureNumLevels(detail3D))-1.0);
    var detailPos=sphericalSampleDriftedWorld(p,NTransform.detailOffsetWorld)-B.center;
    if(TUNE.formType>=.5 && TUNE.formType<4.5){
     detailPos=planetWarpPosition(p-B.center,NTransform.detailOffsetWorld.x*6.283185307,TUNE.formType,NTransform.planetWarpAmount,NTransform.planetWarpPhase);
     detailPos=sphericalDriftedWorld(B.center+detailPos,vec3<f32>(0,NTransform.detailOffsetWorld.y,NTransform.detailOffsetWorld.z))-B.center;
    }
    let detail=textureSampleLevel(detail3D,sampDetail,detailPos*detailScale,detailLod).rgb;
    density=styledPlanetDensity(ph,weather,s,dot(detail,vec3<f32>(.42,.34,.24))*.035)/max(C.globalDensity*10.0,EPS);
    if(!neptune&&litSamples%normalStride==0){
     let radial=normalize(p-B.center);
     // Reuse weather and analytically shift radial phase. Only three shape
     // probes: no extra weather/detail reads or nested normal raymarch.
     let baseline=styledPlanetForm(ph,weather,s).x;
     let gradient=vec3<f32>(
      styledPlanetForm(ph+radial.x*probe/h,weather,planetShape(p+vec3<f32>(probe,0,0),lod)).x,
      styledPlanetForm(ph+radial.y*probe/h,weather,planetShape(p+vec3<f32>(0,probe,0),lod)).x,
      styledPlanetForm(ph+radial.z*probe/h,weather,planetShape(p+vec3<f32>(0,0,probe),lod)).x)-vec3<f32>(baseline);
     normal=normalizeOr(-gradient,radial);
    }
    if(litSamples%sunStride==0){
     var od=0.0;var previous=0.0;
     for(var j=0;j<clamp(TUNE.sunSteps,1,3);j++){
      let distance=h*(0.12+f32(j)*0.25+f32(j*j)*0.16);
      od+=planetMass(p+sun*distance,min(lod+0.6,3.0))*(distance-previous)*extinction;previous=distance;
     }sunVisibility=exp(-od*1.15);
    }litSamples++;
    let radial=normalize(p-B.center);let day=smoothstep(-.16,.28,dot(radial,sun));
    let lightNormal=normalizeOr(mix(normal,radial,select(0.0,.94,neptune)),radial);
    let diffuse=max(dot(lightNormal,sun),0.0);let ao=clamp(1.0-density*.28+(s.g-.5)*.18,.55,1.0);
    // A small forward fill keeps silhouettes readable without washing out
    // the shape gradient. Scattering still lifts shadowed cloud interiors.
    let direct=sunVisibility*(.12+.88*diffuse)*day;
    let bounce=(.07+.12*sqrt(sunVisibility))*day;
    let ambient=(.12+.10*max(dot(lightNormal,radial),0.0))*ao;
    var light=C.frontLightColor*(direct+bounce)+C.shadowLightColor*ambient;
    if(TUNE.lightingFinish==2){
      let bands=0.18+smoothstep(0.25,0.35,diffuse)*0.40+smoothstep(0.65,0.75,diffuse)*0.42;
      light=mix(C.shadowLightColor*0.28,C.frontLightColor,bands*sunVisibility*day)+C.shadowLightColor*0.06;
    }
    let forwardScatter=pow(max(dot(rd,sun),0.0),max(8.0,C.silverExponent*6.0));
    let edgeScatter=pow(1.0-abs(dot(lightNormal,-rd)),2.0);
    light+=C.sunColor*max(C.silverIntensity,0.0)*pow(sunVisibility,0.50)*day*forwardScatter*(0.08+edgeScatter*1.1);
    if(TUNE.formType>=4.5){light*=gasWeatherColor(weather,TUNE.formType);}
    let alpha=1.0-exp(-density*extinction*min(step,hit.y-t));
    color+=tr*alpha*light;tr*=1.0-alpha;
   }
  }t+=step;
 }
 let alpha=1.0-tr;let feather=smoothstep(0.0,max(TUNE.minOutputAlpha,0.0001),alpha);
 var result=vec4<f32>(color*feather,alpha*feather);
 if(CLOUD_WRITE_RGB==0u){result=vec4<f32>(0,0,0,result.a);}
 storeLayerSample(pix,result,0.0,historyActive);
}
