// Actual production raymarch/readback: camera extinction must depend on optical
// distance, not the number of clamped samples or the selected finishing style.
import {CloudComputeBuilder} from '../../clouds.js';
import cloudCommon from '../../shaders/cloudCommon.wgsl';
import cloudRender from '../../shaders/cloudsRender.wgsl';
import {checkCloudReconstruction} from './cloudReconstructionChecks.js';
import {checkSparseCloudSampling} from './cloudSamplingChecks.js';
async function run(){
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice();
 const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const builder=new CloudComputeBuilder(device,device.queue),textures=[];
 const map=(dimension,color)=>{
  const texture=device.createTexture({dimension,size:[1,1,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});textures.push(texture);
  device.queue.writeTexture({texture},new Uint8Array(color),{},[1,1,1]);return texture.createView({dimension:dimension==='3d'?'3d':'2d-array'});
 };
 builder.setInputMaps({weatherView:map('2d',[255,255,0,255]),shape3DView:map('3d',[240,50,60,70]),detail3DView:map('3d',[20,30,40,255])});
 builder.setBox({center:[0,0,0],half:[2,.6,2]});builder.createOutputTexture(64,32);
 builder.setReprojSettings({enabled:0,temporalCellRate:1,temporalBlend:0});
 builder.setParams({globalCoverage:1,globalDensity:40,cloudAnvilAmount:0,cloudBeer:5.8,attenuationClamp:.005});
 builder.setTuning({formType:0,shelfFlow:1.2,alphaBoostAmount:0,outputAlphaFeather:0,minOutputAlpha:0,phaseJitter:0,stepJitter:0,alphaCutoff:.995,nearDensityMult:1,frontOcclusionStrength:0});
 const read=device.createBuffer({size:64*32*8,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const half=bits=>{const e=(bits>>10)&31,m=bits&1023;return e===0?m*2**-24:(1+m/1024)*2**(e-15);};
 async function snapshot(){
  await builder.dispatch();const encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture:builder.outTexture},{buffer:read,bytesPerRow:512},[64,32,1]);device.queue.submit([encoder.finish()]);
  await read.mapAsync(GPUMapMode.READ);const pixels=new Uint16Array(read.getMappedRange()).slice();read.unmap();
  return {centerAlpha:half(pixels[(16*64+32)*4+3]),pixels};
 }
 const rows=[];
 for(const cam of [[0,0,4],[0,0,0]])for(const maxSteps of [16,32,96]){
  builder.setViewFromCamera({camPos:cam,fwd:[0,0,-1],aspect:2,fovYDeg:20});builder.setTuning({maxSteps,lightingFinish:2});
  const sculpted=await snapshot();builder.setTuning({lightingFinish:1});const soft=await snapshot();
  rows.push({camera:cam,maxSteps,alpha:sculpted.centerAlpha,softAlpha:soft.centerAlpha,pass:sculpted.centerAlpha>.995&&sculpted.centerAlpha===soft.centerAlpha});
 }
 builder.setViewFromCamera({camPos:[0,0,4],fwd:[0,0,-1],aspect:2,fovYDeg:20});
 builder.setTuning({paintedLayers:0});const unpainted=await snapshot();
 builder.setTuning({paintedLayers:1});const painted=await snapshot();
 builder.setTuning({paintedLayers:0});const restored=await snapshot();
 let paintedAlphaDelta=0,paintedChangedPixels=0;
 for(let i=0;i<painted.pixels.length;i+=4){
  paintedAlphaDelta=Math.max(paintedAlphaDelta,Math.abs(half(painted.pixels[i+3])-half(unpainted.pixels[i+3])));
  if(painted.pixels[i]!==unpainted.pixels[i]||painted.pixels[i+1]!==unpainted.pixels[i+1]||painted.pixels[i+2]!==unpainted.pixels[i+2])paintedChangedPixels++;
 }
 const paintRestored=unpainted.pixels.every((v,i)=>v===restored.pixels[i]);
 builder.setTuning({paintedLayers:1});
 builder.setViewFromCamera({camPos:[.1,.12,4],fwd:[0,0,-1],aspect:2,fovYDeg:20});const shiftedPaint=await snapshot();
 builder.setViewFromCamera({camPos:[0,0,4],fwd:[0,0,-1],aspect:2,fovYDeg:20});const returnedPaint=await snapshot();
 const paintedViewRestored=painted.pixels.every((v,i)=>v===returnedPaint.pixels[i]);
 const paintedViewChanged=painted.pixels.some((v,i)=>v!==shiftedPaint.pixels[i]);
 builder.setTuning({paintedLayers:0});
 // With uniform material, changing the integration interval must not change
 // the cloud's surface lighting. Alpha is integrated separately over distance.
 const lightingTuningBefore={...builder._state.tuning};
 builder.setParams({globalDensity:8});builder.setTuning({shelfFlow:0,maxSteps:4096,baseJitterFrac:0,topJitterFrac:0,verticalTextureHomogeneity:0,verticalLayerDecorrelation:0,raySmoothDens:0,raySmoothSun:0,sunStride:4});
 const lightingSteps=[];
 for(const stepBase of [.005,.02,.08]){
  builder.setViewFromCamera({camPos:[0,0,0],fwd:[0,0,1],aspect:2,fovYDeg:2,stepBase});
  const shot=await snapshot(),i=(16*64+32)*4;
  lightingSteps.push({stepBase,rgb:Array.from(shot.pixels.slice(i,i+3),half),alpha:shot.centerAlpha});
 }
 const lightingStepDelta=Math.max(...[0,1,2].map(c=>Math.max(...lightingSteps.map(r=>r.rgb[c]))-Math.min(...lightingSteps.map(r=>r.rgb[c]))));
 builder.setTuning(lightingTuningBefore);
 builder.setViewFromCamera({camPos:[0,0,4],fwd:[0,0,-1],aspect:2,fovYDeg:20,stepBase:.02});
 builder.setParams({globalDensity:.0003});const wisps=await snapshot();
 builder.setParams({globalDensity:0});const empty=await snapshot();
 const repeat=await snapshot();
 // Nonuniform 3-D density viewed along a shallow ray: a uniform opacity test
 // cannot detect the comb bands caused by integrating coarse surface intervals.
 const size=32,data=new Uint8Array(size**3*4);
 for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const a=2*Math.PI*x/size,b=2*Math.PI*y/size,c=2*Math.PI*z/size;
  const foldedDistance=(z-size*.4-3*Math.sin(a+b*2))/1.1;
  const mass=.15+.80*Math.exp(-foldedDistance*foldedDistance);
  const i=((z*size+y)*size+x)*4;data.set([Math.round(Math.max(0,Math.min(1,mass))*255),50,60,70],i);
 }
 const patterned=device.createTexture({dimension:'3d',size:[size,size,size],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 device.queue.writeTexture({texture:patterned},data,{bytesPerRow:size*4,rowsPerImage:size},[size,size,size]);
 builder.setInputMaps({weatherView:map('2d',[255,255,0,255]),shape3DView:patterned.createView(),detail3DView:map('3d',[20,30,40,255])});
 builder.setBox({center:[0,0,0],half:[18,.6,18]});builder.setParams({globalDensity:8});
 builder.setTuning({shelfFlow:0,maxSteps:224,minStep:.003,maxStep:.16,thickStepBoost:1.5,verticalStepBoost:3,frontOcclusionStrength:.82,frontOcclusionStepBoost:3.6});
 const march=[];
 for(const pitch of [-.025,0,.025]){
  builder.setViewFromCamera({camPos:[0,.1,-4],fwd:[0,pitch,1],aspect:2,fovYDeg:20,stepBase:.02});
  builder.setTuning({maxSteps:224});const normal=await snapshot();
  builder.setTuning({maxSteps:1024});const reference=await snapshot();
  const error=normal.pixels.reduce((sum,v,i)=>sum+Math.abs(half(v)-half(reference.pixels[i])),0)/normal.pixels.length;
  march.push({pitch,meanAbsoluteError:error,pass:error<.035});
 }
 builder.setInputMaps({weatherView:map('2d',[255,255,0,255]),shape3DView:map('3d',[240,50,60,70]),detail3DView:map('3d',[20,30,40,255])});
 builder.setParams({globalDensity:.03});
 builder.setViewFromCamera({camPos:[0,0,0],fwd:[0,0,1],aspect:2,fovYDeg:2,stepBase:.02});
 builder.setTuning({maxSteps:224});const thinWide=await snapshot();
 builder.setTuning({maxSteps:1024});const thinWideReference=await snapshot();
 const thinWideError=Math.abs(thinWide.centerAlpha-thinWideReference.centerAlpha);
 // Traversal padding must not change opacity when the actual column height
 // stays fixed. The old front-card fill used progress to the padded box exit.
 const paddingTuning={...builder._state.tuning};
 builder.setInputMaps({weatherView:map('2d',[255,128,0,255])});
 builder.setBox({center:[0,0,0],half:[18,.4,18]});
 builder.setTuning({shelfFlow:0,maxSteps:224,baseJitterFrac:0,topJitterFrac:0,verticalLayerDecorrelation:0,verticalTextureHomogeneity:0,frontOcclusionStrength:.82});
 builder.setViewFromCamera({camPos:[0,0,-4],fwd:[0,.05,1],aspect:2,fovYDeg:1,stepBase:.02});
 const unpaddedOpacity=(await snapshot()).centerAlpha;
 builder.setTuning({topJitterFrac:.4});
 const paddedOpacity=(await snapshot()).centerAlpha;
 const paddingOpacityError=Math.abs(paddedOpacity-unpaddedOpacity);
 builder.setTuning(paddingTuning);
 builder.setInputMaps({weatherView:map('2d',[255,255,0,255])});
 // Fine, vertically compressed material with real mips. Turning inside this
 // field exposed integration aliasing that the broad folded surface missed.
 const turnTexture=device.createTexture({dimension:'3d',size:[32,128,32],mipLevelCount:6,format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 let td=[32,128,32],levelData=new Uint8Array(td[0]*td[1]*td[2]*4);
 for(let z=0;z<td[2];z++)for(let y=0;y<td[1];y++)for(let x=0;x<td[0];x++){
  const wave=Math.sin(y*Math.PI*.5+Math.sin(x*.4)*1.7+Math.sin(z*.35)*2.1);
  levelData.set([Math.round(128+100*wave),50,60,70],((z*td[1]+y)*td[0]+x)*4);
 }
 for(let level=0;level<6;level++){
  device.queue.writeTexture({texture:turnTexture,mipLevel:level},levelData,{bytesPerRow:td[0]*4,rowsPerImage:td[1]},td);
  const nd=td.map(n=>Math.max(1,n>>1)),next=new Uint8Array(nd[0]*nd[1]*nd[2]*4);
  for(let z=0;z<nd[2];z++)for(let y=0;y<nd[1];y++)for(let x=0;x<nd[0];x++)for(let c=0;c<4;c++){
   let sum=0;for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)sum+=levelData[((Math.min(z*2+dz,td[2]-1)*td[1]+Math.min(y*2+dy,td[1]-1))*td[0]+Math.min(x*2+dx,td[0]-1))*4+c];
   next[((z*nd[1]+y)*nd[0]+x)*4+c]=Math.round(sum/8);
  }
  td=nd;levelData=next;
 }
 builder.setInputMaps({shape3DView:turnTexture.createView()});
 builder.setBox({center:[0,0,0],half:[18,.4,18]});
 builder.setNoiseTransforms({shapeScale:.116,shapeAxisScale:[.28,1.25,.85],detailScale:.72,detailAxisScale:[.18,1.5,.9]});
 builder.setParams({globalDensity:.08});
 builder.setTuning({shelfFlow:1.5,verticalTextureHomogeneity:.7,verticalLayerDecorrelation:.18,phaseJitter:.25,stepJitter:.08,sliceJitterStrength:.012,raySmoothDens:0,raySmoothSun:0,minStep:.0005,frontOcclusionStrength:0,sunStride:4});
 const turns=[];
 for(const [yaw,pitch] of [[0,0],[.3,.1],[.3,.5],[1.1,-.4]]){
  const view={camPos:[0,-.12,0],fwd:[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)],aspect:2,fovYDeg:28};
  builder.setTuning({maxSteps:224});builder.setViewFromCamera({...view,stepBase:.02});const normal=await snapshot();
  builder.setTuning({maxSteps:4096});builder.setViewFromCamera({...view,stepBase:.001});const reference=await snapshot();
  let alphaError=0,rgbError=0;for(let i=0;i<normal.pixels.length;i++){
   const error=Math.abs(half(normal.pixels[i])-half(reference.pixels[i]));if(i%4===3)alphaError+=error;else rgbError+=error;
  }
  alphaError/=64*32;rgbError/=64*32*3;
  turns.push({yaw,pitch,alphaError,rgbError,pass:alphaError<.005&&rgbError<.025});
 }
 const report={complete:true,pass:lightingStepDelta<.025&&rows.every(r=>r.pass)&&march.every(r=>r.pass)&&turns.every(r=>r.pass)&&paintedAlphaDelta===0&&paintedChangedPixels>512&&paintRestored&&paintedViewRestored&&paintedViewChanged&&thinWideError<.02&&wisps.centerAlpha<.05&&empty.centerAlpha===0&&empty.pixels.every((v,i)=>v===repeat.pixels[i])&&!errors.length,lightingSteps,lightingStepDelta,rows,march,turns,paintedAlphaDelta,paintedChangedPixels,paintRestored,paintedViewRestored,paintedViewChanged,thinWideError,thinAlpha:wisps.centerAlpha,emptyAlpha:empty.centerAlpha,errors};
 report.paddingOpacity={unpaddedOpacity,paddedOpacity,error:paddingOpacityError,pass:paddingOpacityError<.005};
 report.pass=report.pass&&report.paddingOpacity.pass;
 // A jittered weather column can extend above the nominal box face. A
 // horizontal camera ray inside that support must not be clipped to sky.
 builder.setInputMaps({weatherView:map('2d',[255,255,0,255]),shape3DView:map('3d',[240,50,60,70]),detail3DView:map('3d',[20,30,40,255])});
 builder.setNoiseTransforms({shapeScale:.116,shapeAxisScale:[1,1,1],detailScale:1,detailAxisScale:[1,1,1]});
 builder.setBox({center:[0,.9,0],half:[18,1.2,18]});
 builder.setParams({globalDensity:8,globalCoverage:1,cloudAnvilAmount:0});
 builder.setTuning({shelfFlow:0,maxSteps:224,baseJitterFrac:.025,topJitterFrac:.20,verticalLayerDecorrelation:0,verticalTextureHomogeneity:0});
 builder.setViewFromCamera({camPos:[0,2.22,-4],fwd:[0,0,1],aspect:2,fovYDeg:2,stepBase:.02});
 report.jitteredHeadroomAlpha=(await snapshot()).centerAlpha;
 report.jitteredHeadroomPass=report.jitteredHeadroomAlpha>.95;
 report.pass=report.pass&&report.jitteredHeadroomPass;
 // Exercise the production normal functions across a coverage-clipped shape
 // plateau. Lighting must still follow the continuous material channels on
 // both sides of the clipping boundary, rather than switching fallback axes.
 const reliefTexture=device.createTexture({dimension:'3d',size:[32,1,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 const reliefData=new Uint8Array(32*4);
 for(let x=0;x<32;x++)reliefData.set([Math.round((.54+.12*x/31)*255),Math.round((.2+.6*x/31)*255),64,64],x*4);
 device.queue.writeTexture({texture:reliefTexture},reliefData,{bytesPerRow:128,rowsPerImage:1},[32,1,1]);
 const reliefFunction=cloudCommon.slice(cloudCommon.indexOf('fn sampleShapeRelief('),cloudCommon.indexOf('fn approxShapeNormal('));
 const normalFunction=cloudCommon.slice(cloudCommon.indexOf('fn approxShapeNormalFast('),cloudCommon.indexOf('fn approxShapeNormalFromChannels('));
 const reliefModule=device.createShaderModule({code:`
 @group(0) @binding(0) var shape3D:texture_3d<f32>;
 @group(0) @binding(1) var sampShape:sampler;
 @group(0) @binding(2) var<storage,read_write> normals:array<vec4<f32>>;
 const wg_shapeUvMul=vec3<f32>(1.0); const wg_shapeUvAdd=vec3<f32>(0.0); const wg_boxMaxXZ=1.0;
 fn sphericalCloudMode()->bool{return false;}
 fn worldWarpXZ(p:vec2<f32>,ph:f32,b:f32)->vec2<f32>{return vec2<f32>(0.0);}
 fn shapeUVW_fromWarp(p:vec3<f32>,ph:f32,w:vec2<f32>)->vec3<f32>{return p;}
 fn shapeNormalProbeWorld(l:f32,m:f32)->f32{return .02;}
 fn sampleShapeRGBA(p:vec3<f32>,ph:f32,l:f32)->vec4<f32>{return clamp(textureSampleLevel(shape3D,sampShape,p,l)+vec4<f32>(.4),vec4<f32>(0.0),vec4<f32>(1.0));}
 ${reliefFunction} ${normalFunction}
 @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){
 normals[id.x]=vec4<f32>(approxShapeNormalFast(vec3<f32>(.25+f32(id.x)*.25,.5,.5),.5,0.0),1.0);
 }`});
 const reliefOut=device.createBuffer({size:48,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const reliefRead=device.createBuffer({size:48,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const reliefPipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:reliefModule,entryPoint:'main'}});
 const reliefBindings=device.createBindGroup({layout:reliefPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:reliefTexture.createView()},{binding:1,resource:device.createSampler({minFilter:'linear',magFilter:'linear'})},{binding:2,resource:{buffer:reliefOut}}]});
 const reliefEncoder=device.createCommandEncoder(),reliefPass=reliefEncoder.beginComputePass();
 reliefPass.setPipeline(reliefPipeline);reliefPass.setBindGroup(0,reliefBindings);reliefPass.dispatchWorkgroups(3);reliefPass.end();
 reliefEncoder.copyBufferToBuffer(reliefOut,0,reliefRead,0,48);device.queue.submit([reliefEncoder.finish()]);await reliefRead.mapAsync(GPUMapMode.READ);
 report.reliefNormals=Array.from(new Float32Array(reliefRead.getMappedRange()));reliefRead.unmap();
 report.reliefPass=[0,4,8].every(i=>report.reliefNormals[i]<-.99&&Math.abs(report.reliefNormals[i+1])<.01&&Math.abs(report.reliefNormals[i+2])<.01);
 report.pass=report.pass&&report.reliefPass&&!errors.length;
 // Boost must strengthen existing pigment coverage without filling empty
 // sky or the faint wisps below its threshold.
 builder.setBox({center:[0,0,0],half:[2,.6,2]});
 builder.setViewFromCamera({camPos:[0,0,0],fwd:[0,0,1],aspect:2,fovYDeg:2,stepBase:.02});
 builder.setTuning({topJitterFrac:0,baseJitterFrac:0,alphaBoostThreshold:.20,alphaBoostAmount:0});
 builder.setParams({globalDensity:.18});const boostBefore=(await snapshot()).centerAlpha;
 builder.setTuning({alphaBoostAmount:.35});const boostAfter=(await snapshot()).centerAlpha;
 builder.setParams({globalDensity:.0003});const boostedWisp=(await snapshot()).centerAlpha;
 builder.setTuning({alphaBoostAmount:0});const plainWisp=(await snapshot()).centerAlpha;
 report.pigmentOpacity={before:boostBefore,after:boostAfter,plainWisp,boostedWisp,
  pass:boostBefore>.20&&boostBefore<.9&&boostAfter>boostBefore+.03&&plainWisp===boostedWisp};
 // Run the actual palette function across a continuous lighting ramp. This
 // catches large pigment plateaus without prescribing its authored colors.
 const paletteFn=cloudRender.slice(cloudRender.indexOf('fn gouachePalette('),cloudRender.indexOf('fn stableSunHintUV('));
 const pigmentFinish=cloudRender.slice(cloudRender.indexOf('fn finishPigmentColor('),cloudRender.indexOf('// Broad pigment washes'));
 const predicates=cloudRender.slice(cloudRender.indexOf('fn sumiLook('),cloudRender.indexOf('// A directional crest'));
 const paletteModule=device.createShaderModule({code:`
 struct Settings { gradeStyle:u32 }; var<private> R:Settings;
 @group(0) @binding(0) var<storage,read_write> colors:array<vec4<f32>>;
 fn luma(c:vec3<f32>)->f32 { return dot(c,vec3<f32>(0.2126,0.7152,0.0722)); }
 ${predicates} ${paletteFn} ${pigmentFinish}
 @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3<u32>){
 R.gradeStyle=select(41u,44u,id.x>=256u);
 let light=f32(id.x%256u)/255.0;
 let shadow=vec3<f32>(.13,.16,.26); let highlight=vec3<f32>(.66,.72,.86);
 let pigment=gouachePalette(light,shadow,highlight);
 let finished=finishPigmentColor(pigment,light,mix(vec3<f32>(.14,.20,.40),vec3<f32>(1.30,1.04,.80),light),shadow,highlight,vec3<f32>(1.7,1.6,1.0),1.0);
 let continuous=mix(shadow,highlight,pow(light,.85));
 let expectedLuma=luma(mix(pigment,continuous,.06));
 colors[id.x]=vec4<f32>(finished,abs(luma(finished)-expectedLuma));
 }`});
 const paletteOut=device.createBuffer({size:8192,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const paletteRead=device.createBuffer({size:8192,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const palettePipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:paletteModule,entryPoint:'main'}});
 const paletteEncoder=device.createCommandEncoder(),palettePass=paletteEncoder.beginComputePass();
 palettePass.setPipeline(palettePipeline);palettePass.setBindGroup(0,device.createBindGroup({layout:palettePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:paletteOut}}]}));palettePass.dispatchWorkgroups(8);palettePass.end();
 paletteEncoder.copyBufferToBuffer(paletteOut,0,paletteRead,0,8192);device.queue.submit([paletteEncoder.finish()]);await paletteRead.mapAsync(GPUMapMode.READ);
 const colors=new Float32Array(paletteRead.getMappedRange()).slice();paletteRead.unmap();
 report.pigmentRamps=[41,44].map((style,row)=>{
  let flatIntervals=0,maxAdjacentChange=0,maxValueDrift=0;
  for(let x=0;x<256;x++)maxValueDrift=Math.max(maxValueDrift,colors[(row*256+x)*4+3]);
  for(let x=1;x<256;x++){
   const i=(row*256+x)*4,delta=Math.max(...[0,1,2].map(c=>Math.abs(colors[i+c]-colors[i-4+c])));
   if(delta<1e-6)flatIntervals++;maxAdjacentChange=Math.max(maxAdjacentChange,delta);
  }
  return {style,flatIntervals,maxAdjacentChange,maxValueDrift,pass:flatIntervals===0&&maxAdjacentChange<.025&&maxValueDrift<1e-5};
 });
 report.pass=report.pass&&report.pigmentOpacity.pass&&report.pigmentRamps.every(r=>r.pass)&&!errors.length;
 report.reconstruction=await checkCloudReconstruction(device,cloudRender);
 report.pass=report.pass&&report.reconstruction.pass&&!errors.length;
 // Evolution must change the morning shape even with constant input maps and
 // fixed bulk advection; restoring offsets must restore the exact image.
 builder.setFieldQuality('low');
 builder.setBox({center:[0,2.7,0],half:[18,3,18]});
 builder.setInputMaps({weatherView:map('2d',[255,255,0,255]),shape3DView:map('3d',[240,50,60,70]),detail3DView:map('3d',[20,30,40,255])});
 builder.setParams({globalDensity:8.5,globalCoverage:.86});
 builder.setTuning({formType:8,puffScale:.65,phaseJitter:0,alphaBoostAmount:0,maxSteps:224});
 builder.setViewFromCamera({camPos:[0,-1.8,12],fwd:[0,.3746,-.9272],aspect:2,fovYDeg:60});
 builder.setNoiseTransforms({shapeOffsetWorld:[0,0,0],detailOffsetWorld:[0,0,0],weatherOffsetWorld:[0,0,0]});
 const morningStart=await snapshot(),morningPaused=await snapshot();
 builder.setNoiseTransforms({detailOffsetWorld:[-.8,0,.65],weatherOffsetWorld:[.2,0,-.1]});
 const morningEvolved=await snapshot();
 builder.setNoiseTransforms({detailOffsetWorld:[0,0,0],weatherOffsetWorld:[0,0,0]});
 const morningRestored=await snapshot();
 let changedAlphaPixels=0;
 for(let i=3;i<morningStart.pixels.length;i+=4)if(Math.abs(half(morningStart.pixels[i])-half(morningEvolved.pixels[i]))>.01)changedAlphaPixels++;
 report.morningEvolution={changedAlphaPixels,
   pausedStable:morningStart.pixels.every((v,i)=>v===morningPaused.pixels[i]),
   restored:morningStart.pixels.every((v,i)=>v===morningRestored.pixels[i])};
 report.morningEvolution.pass=changedAlphaPixels>20&&report.morningEvolution.pausedStable&&report.morningEvolution.restored;
 report.pass=report.pass&&report.morningEvolution.pass&&!errors.length;
 // The regular bake remains periodic; world-space deformation must vary
 // neighboring repetitions without camera-dependent changes or seam jumps.
 const tileNoise=device.createTexture({dimension:'3d',size:[16,16,16],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 const tileData=new Uint8Array(16*16*16*4);
 for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<16;x++){
   const a=x*Math.PI/8,b=y*Math.PI/8,c=z*Math.PI/8;
   tileData.set([128+60*Math.sin(a+b),128+65*Math.cos(b+c),128+70*Math.sin(c+a),128],((z*16+y)*16+x)*4);
 }
 device.queue.writeTexture({texture:tileNoise},tileData,{bytesPerRow:64,rowsPerImage:16},[16,16,16]);
 const tileChecks=[];
 for(const formType of [8,9]){
   builder.setBox({center:[0,2.7,0],half:[180,3,180]});
   builder.setTuning({formType,puffScale:3.8,phaseJitter:0,alphaBoostAmount:0,maxSteps:224});
   builder.setParams({globalDensity:.4,globalCoverage:.86});
   builder.setInputMaps({shape3DView:tileNoise.createView(),detail3DView:tileNoise.createView()});
   builder.setCloudTurbulence(.75);
   builder.setNoiseTransforms({shapeScale:.14,detailScale:1.2,shapeOffsetWorld:[.2,0,-.3],detailOffsetWorld:[-.15,0,.25],weatherOffsetWorld:[.08,0,.11]});
   builder.setViewFromCamera({camPos:[0,1.5,0],fwd:[0,.3,-1],aspect:2,fovYDeg:12});
   const tileStart=await snapshot();
   const tileSpan=new DataView(builder._fieldParamsAB).getFloat32(16,true);
   builder.setViewFromCamera({camPos:[tileSpan,1.5,0],fwd:[0,.3,-1],aspect:2,fovYDeg:12});
   const tileRepeat=await snapshot();
   let maxAlphaError=0,minAlpha=1,maxAlpha=0;
   for(let i=3;i<tileStart.pixels.length;i+=4){
     const alpha=half(tileStart.pixels[i]);minAlpha=Math.min(minAlpha,alpha);maxAlpha=Math.max(maxAlpha,alpha);
     maxAlphaError=Math.max(maxAlphaError,Math.abs(alpha-half(tileRepeat.pixels[i])));
   }
   builder.setViewFromCamera({camPos:[0,1.5,0],fwd:[0,.3,-1],aspect:2,fovYDeg:12});
   const restored=await snapshot();
   builder.setViewFromCamera({camPos:[tileSpan*.5-.0001,1.5,0],fwd:[0,.3,-1],aspect:2,fovYDeg:12});
   const seamLeft=await snapshot();
   builder.setViewFromCamera({camPos:[tileSpan*.5+.0001,1.5,0],fwd:[0,.3,-1],aspect:2,fovYDeg:12});
   const seamRight=await snapshot();
   let seamError=0;
   for(let i=3;i<seamLeft.pixels.length;i+=4)seamError=Math.max(seamError,Math.abs(half(seamLeft.pixels[i])-half(seamRight.pixels[i])));
   const deterministic=tileStart.pixels.every((v,i)=>v===restored.pixels[i]);
   builder.setCloudTurbulence(0);
   builder.setViewFromCamera({camPos:[0,1.5,0],fwd:[0,.3,-1],aspect:2,fovYDeg:12});
   const regularStart=await snapshot();
   builder.setViewFromCamera({camPos:[tileSpan,1.5,0],fwd:[0,.3,-1],aspect:2,fovYDeg:12});
   const regularRepeat=await snapshot();
   let regularError=0;
   for(let i=3;i<regularStart.pixels.length;i+=4)regularError=Math.max(regularError,Math.abs(half(regularStart.pixels[i])-half(regularRepeat.pixels[i])));

   tileChecks.push({formType,tileSpan,maxAlphaError,alphaRange:maxAlpha-minAlpha,seamError,deterministic,regularError,
     pass:regularError<.005&&maxAlphaError>.005&&maxAlpha-minAlpha>.01&&seamError<.01&&deterministic});
 }
 report.cachedTiles=tileChecks;
 report.pass=report.pass&&tileChecks.every(r=>r.pass)&&!errors.length;
 // Looking from inside a uniform, optically thin wide cloud must integrate
 // the whole distance, even without any empty-space skipping opportunities.
 builder.setInputMaps({weatherView:map('2d',[255,255,0,255]),shape3DView:map('3d',[240,50,60,70]),detail3DView:map('3d',[20,30,40,255])});
 builder.setBox({center:[0,1.4,0],half:[180,3,180]});
 builder.setParams({globalDensity:.01,globalCoverage:1});builder.setCloudTurbulence(0);
 builder.setTuning({formType:9,phaseJitter:0,minOutputAlpha:0,alphaBoostAmount:0});
 report.horizonCoverage=[];
 for(const yaw of [0,.55,1.1]){
   builder.setViewFromCamera({camPos:[0,1.4,0],fwd:[Math.sin(yaw),0,-Math.cos(yaw)],aspect:2,fovYDeg:.1});
   builder.setTuning({maxSteps:64});const fast=await snapshot();
   builder.setTuning({maxSteps:1024});const reference=await snapshot();
   const error=Math.abs(fast.centerAlpha-reference.centerAlpha);
   report.horizonCoverage.push({yaw,alpha:fast.centerAlpha,referenceAlpha:reference.centerAlpha,error,pass:fast.centerAlpha>.04&&error<.005});
 }
 report.pass=report.pass&&report.horizonCoverage.every(r=>r.pass);
 // The optional terrain must clip cloud integration behind its floor on
 // both rendering paths, while preserving an opaque cloud in front of it.
 report.terrainOcclusion=[];
 builder.setParams({globalDensity:40,globalCoverage:1});
 for(const formType of [0,9])for(const centerY of [-10,-2])for(const cloudScale of [1,2]){
   builder.setBox({center:[0,centerY,0],half:[18,1,18]});
   builder.setTuning({formType,maxSteps:224,phaseJitter:0,minOutputAlpha:0,alphaBoostAmount:0});
   const view={camPos:[0,1.4,0],fwd:[0,-1,.1],aspect:2,fovYDeg:12,cloudScale};
   builder.setViewFromCamera({...view,terrainEnabled:false});const plain=await snapshot();
   builder.setViewFromCamera({...view,terrainEnabled:true});const clipped=await snapshot();
   const behind=centerY < -6;
   report.terrainOcclusion.push({formType,cloudScale,behind,plain:plain.centerAlpha,clipped:clipped.centerAlpha,
     pass:plain.centerAlpha>.1&&(behind?clipped.centerAlpha<.001:Math.abs(plain.centerAlpha-clipped.centerAlpha)<.005)});
 }
 builder.setViewFromCamera({terrainEnabled:false});
 report.pass=report.pass&&report.terrainOcclusion.every(r=>r.pass);
 // A shallow downward ray must see the extended floor beyond the former
 // 192-unit rectangle, rather than a synthetic straight edge through the haze.
 builder.setViewFromCamera({camPos:[0,20,0],fwd:[0,0,1],aspect:2,fovYDeg:12,terrainEnabled:true});
 await snapshot();
 const floorRead=device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const floorMap=device.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
 const floorModule=device.createShaderModule({code:`
 @group(0) @binding(0) var terrain:texture_2d<f32>;
 @group(0) @binding(1) var<storage,read_write> out:array<f32>;
 @compute @workgroup_size(1) fn main(){out[0]=textureLoad(terrain,vec2<i32>(32,17),0).a;}`});
 const floorPipe=device.createComputePipeline({layout:'auto',compute:{module:floorModule,entryPoint:'main'}});
 const floorGroup=device.createBindGroup({layout:floorPipe.getBindGroupLayout(0),entries:[{binding:0,resource:builder._terrainView},{binding:1,resource:{buffer:floorRead}}]});
 const floorEncoder=device.createCommandEncoder(),floorPass=floorEncoder.beginComputePass();
 floorPass.setPipeline(floorPipe);floorPass.setBindGroup(0,floorGroup);floorPass.dispatchWorkgroups(1);floorPass.end();
 floorEncoder.copyBufferToBuffer(floorRead,0,floorMap,0,4);device.queue.submit([floorEncoder.finish()]);
 await floorMap.mapAsync(GPUMapMode.READ);const floorDistance=new Float32Array(floorMap.getMappedRange())[0];floorMap.unmap();
 report.terrainFloorHorizon={distance:floorDistance,pass:floorDistance>500&&floorDistance<10000};
 report.pass=report.pass&&report.terrainFloorHorizon.pass;
 floorRead.destroy();floorMap.destroy();
 // Cloud enlargement traces the original field without rebuilding it. Moving
 // the camera by the same base-anchored scale must reproduce the source view.
 report.cloudScaling=[];
 builder.setParams({globalDensity:8,globalCoverage:.9});
 builder.setBox({center:[0,6,0],half:[18,3,18]});
 for(const formType of [0,3,9]){
   builder.setTuning({formType,baseJitterFrac:.12,topJitterFrac:.12,maxSteps:224,phaseJitter:0,alphaBoostAmount:0,minOutputAlpha:0});
   const anchor=[0,3-(formType===0?6*.12:0),0],cam=[0,5,8];
   const view={camPos:cam,fwd:[0,.12,-1],aspect:2,fovYDeg:45};
   builder.setViewFromCamera({...view,cloudScale:1});const reference=await snapshot();
   const referenceAlpha=Math.max(...Array.from({length:2048},(_,i)=>half(reference.pixels[i*4+3])));
   const signatures=[builder._fieldDensitySignature,builder._fieldLightSignature];
   const dimensions=JSON.stringify(builder._fieldResources?.dimensions);
   for(const scale of [2,5,8]){
     const scaledCam=cam.map((v,i)=>anchor[i]+(v-anchor[i])*scale);
     builder.setViewFromCamera({...view,camPos:scaledCam,cloudScale:scale});const enlarged=await snapshot();
     let maxError=0;
     for(let i=0;i<reference.pixels.length;i++)maxError=Math.max(maxError,Math.abs(half(reference.pixels[i])-half(enlarged.pixels[i])));
     const cacheReused=formType===0 || signatures.every((value,i)=>value===[builder._fieldDensitySignature,builder._fieldLightSignature][i]);
     const dimensionsUnchanged=JSON.stringify(builder._fieldResources?.dimensions)===dimensions;
     // Horizontal rays below the fixed base must not acquire cloud as it grows.
     builder.setViewFromCamera({camPos:[0,anchor[1]-.5,0],fwd:[0,0,-1],aspect:2,fovYDeg:.1,cloudScale:scale});
     const below=await snapshot();
     report.cloudScaling.push({formType,scale,referenceAlpha,maxError,cacheReused,dimensionsUnchanged,belowBaseAlpha:below.centerAlpha,
       pass:referenceAlpha>.1&&maxError<.003&&cacheReused&&dimensionsUnchanged&&below.centerAlpha<.001});
   }
 }
 report.pass=report.pass&&report.cloudScaling.every(r=>r.pass);
 // Moving through fine cached material: compare requested full phase jitter
 // with unjittered integration at each pose, without temporal history masking it.
 report.volumeFlightSampling=[];
 builder.setBox({center:[0,2.7,0],half:[18,3,18]});
 builder.setInputMaps({shape3DView:tileNoise.createView(),detail3DView:tileNoise.createView()});
 builder.setParams({globalDensity:8,globalCoverage:.9});builder.setCloudTurbulence(.75);
 for(const formType of [2,9])for(let pose=0;pose<3;pose++){
   builder.setViewFromCamera({camPos:[pose*.25,2.5,8-pose*.35],fwd:[Math.sin(pose*.07),.04,-Math.cos(pose*.07)],aspect:2,fovYDeg:60});
   builder.setTuning({formType,maxSteps:224,phaseJitter:0,minOutputAlpha:0});const reference=await snapshot();
   builder.setTuning({phaseJitter:1});const jittered=await snapshot();
   let alphaError=0,rgbError=0;
   for(let i=0;i<reference.pixels.length;i+=4){
     alphaError+=Math.abs(half(reference.pixels[i+3])-half(jittered.pixels[i+3]));
     for(let c=0;c<3;c++)rgbError+=Math.abs(half(reference.pixels[i+c])-half(jittered.pixels[i+c]));
   }
   alphaError/=2048;rgbError/=6144;
   report.volumeFlightSampling.push({formType,pose,alphaError,rgbError,pass:alphaError<.02&&rgbError<.04});
 }
 report.pass=report.pass&&report.volumeFlightSampling.every(r=>r.pass);
 report.sparseSampling=await checkSparseCloudSampling({builder,device,snapshot,half});
 report.pass=report.pass&&report.sparseSampling.every(r=>r.pass);
 // Warmed, completed GPU work while panning, with and without evolving input
 // offsets. This includes cached-field rebuilds, not just command submission.
 // The two anatomies differ; these are scene-specific kernel timings, not FPS.
 builder.createOutputTexture(512,288);
 builder.setCloudTurbulence(.75);
 builder.setParams({globalDensity:10,globalCoverage:.88});
 report.methodTimings=[];
 for(const formType of [0,9])for(const evolving of [false,true]){
   const centerY=formType===0?0:1.4;
   builder.setBox({center:[0,centerY,0],half:[18,formType===0?.4:1.7,18]});
   builder.setTuning({formType,shelfFlow:formType===0?1.5:0,maxSteps:224,phaseJitter:.12});
   const samples=[];
   for(let frameIndex=0;frameIndex<14;frameIndex++){
     const yaw=frameIndex*.025;
     builder.setViewFromCamera({camPos:[0,centerY,0],fwd:[Math.sin(yaw),.08,-Math.cos(yaw)],aspect:512/288,fovYDeg:60});
     const drift=evolving?frameIndex*.01:0;
     builder.setNoiseTransforms({shapeOffsetWorld:[drift,0,0],detailOffsetWorld:[0,0,drift*.6]});
     const start=performance.now();await builder.dispatch();await device.queue.onSubmittedWorkDone();
     if(frameIndex>=2)samples.push(performance.now()-start);
   }
   samples.sort((a,b)=>a-b);
   report.methodTimings.push({formType,evolving,width:512,height:288,medianMs:samples[6],p90Ms:samples[10]});
 }
 report.wideWarpTimings=[];
 builder.setBox({center:[0,1.4,0],half:[180,1.7,180]});
 builder.setTuning({formType:9,maxSteps:224,phaseJitter:.12});
 for(const turbulence of [0,.75]){
   builder.setCloudTurbulence(turbulence);const samples=[];
   for(let i=0;i<14;i++){
     builder.setViewFromCamera({camPos:[0,1.4,0],fwd:[Math.sin(i*.025),.08,-Math.cos(i*.025)],aspect:512/288,fovYDeg:60});
     const start=performance.now();await builder.dispatch();await device.queue.onSubmittedWorkDone();
     if(i>=2)samples.push(performance.now()-start);
   }
   samples.sort((a,b)=>a-b);report.wideWarpTimings.push({turbulence,width:512,height:288,medianMs:samples[6],p90Ms:samples[10]});
 }
 // Matched cached-volume work, without terrain or screen interleave.
 report.volumeNavigationTimings=[];
 builder.setFieldQuality('balanced');builder.setCloudTurbulence(.75);
 builder.setBox({center:[0,3,0],half:[180,3,180]});
 builder.setParams({globalDensity:1,globalCoverage:.75});
 builder.setTuning({formType:3,maxSteps:224,phaseJitter:.12,minOutputAlpha:0,puffScale:3.6});
 for(const pitch of [0,.45]){
  const samples=[];
  for(let i=0;i<18;i++){
   builder.setViewFromCamera({camPos:[.3,3,8-i*.04],fwd:[.1,pitch,-1],aspect:512/288,fovYDeg:60});
   const start=performance.now();await builder.dispatch();await device.queue.onSubmittedWorkDone();
   if(i>=6)samples.push(performance.now()-start);
  }
  samples.sort((a,b)=>a-b);
  report.volumeNavigationTimings.push({pitch,width:512,height:288,medianMs:samples[6],p90Ms:samples[10]});
 }
 report.pass=report.pass&&!errors.length;
 document.querySelector('#result').textContent=JSON.stringify(report,null,2);device.destroy();
}
run().catch(e=>document.querySelector('#result').textContent=JSON.stringify({error:e.stack}));
