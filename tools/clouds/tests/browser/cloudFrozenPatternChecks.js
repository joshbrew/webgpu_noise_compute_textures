import {CloudComputeBuilder} from '../../clouds.js';
import {frozenPatternIndices} from '../../cloudFrozenPattern.js';
async function run(){
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice(),errors=[];
 device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const b=new CloudComputeBuilder(device,device.queue),W=64,H=32,checks=[];
 const map=(dimension,color)=>{const t=device.createTexture({dimension,size:[1,1,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});device.queue.writeTexture({texture:t},new Uint8Array(color),{},[1,1,1]);return t.createView({dimension:dimension==='3d'?'3d':'2d-array'});};
 b.setInputMaps({weatherView:map('2d',[255,255,0,255]),shape3DView:map('3d',[240,50,60,70]),detail3DView:map('3d',[20,30,40,255])});
 b.createOutputTexture(W,H);b.setBox({center:[0,0,0],half:[18,3,18]});b.setFieldQuality('low');
 b.setReprojSettings({enabled:0,temporalCellRate:1,temporalBlend:0});b.setParams({globalCoverage:1,globalDensity:8});
 b.setTuning({formType:9,puffScale:3.8,maxSteps:224,lightingFinish:1,minOutputAlpha:0,alphaBoostAmount:0,outputAlphaFeather:0});b.setCloudTurbulence(0);
 b.setViewFromCamera({camPos:[0,-6,0],fwd:[0,1,0],up:[0,0,-1],aspect:2,fovYDeg:2});await b.dispatch();await device.queue.onSubmittedWorkDone();
 const resources=b._fieldResources,dimensions=resources.dimensions.slice();
 b.setFrozenPattern({enabled:true,axis:2,first:.5,last:.5,spacing:1,thickness:2});
 // Analytic constant-density fixtures isolate the plane intersection/integral
 // from anatomy. A ramp then verifies scrolling and repeat-period ownership.
 const module=device.createShaderModule({code:`
  override RAMP:bool=false;
  override SCALE:f32=1.0;
  @group(0) @binding(0) var density:texture_storage_3d<rgba16float,write>;
  @group(0) @binding(1) var light:texture_storage_3d<rgba16float,write>;
  @compute @workgroup_size(4,4,4) fn fill(@builtin(global_invocation_id) p:vec3<u32>){
   if(any(p>=textureDimensions(density))){return;}
   let d=select(40.0,10.0+50.0*f32(p.x)/f32(textureDimensions(density).x),RAMP)*SCALE;
   textureStore(density,vec3<i32>(p),vec4<f32>(d,d,1.0,0.5));textureStore(light,vec3<i32>(p),vec4<f32>(0.5,0.8,0.7,1.0));
  }`});
 const fill=async (ramp,scale=1)=>{const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'fill',constants:{RAMP:ramp,SCALE:scale}}});const bg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:resources.density.createView({baseMipLevel:0,mipLevelCount:1})},{binding:1,resource:resources.light.createView({baseMipLevel:0,mipLevelCount:1})}]});const enc=device.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bg);pass.dispatchWorkgroups(...dimensions.map(n=>Math.ceil(n/4)));pass.end();device.queue.submit([enc.finish()]);await device.queue.onSubmittedWorkDone();};
 const read=device.createBuffer({size:W*H*8,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const half=v=>{const e=(v>>10)&31,m=v&1023;return e===0?m*2**-24:(1+m/1024)*2**(e-15);};
 const snapshot=async()=>{const enc=device.createCommandEncoder(),dispatch=b.encodeDispatchPasses(enc);enc.copyTextureToBuffer({texture:b.outTexture},{buffer:read,bytesPerRow:W*8},[W,H,1]);device.queue.submit([enc.finish()]);dispatch.restoreAfterSubmit?.();await read.mapAsync(GPUMapMode.READ);const pixels=new Uint16Array(read.getMappedRange()).slice();read.unmap();return {pixels,alpha:half(pixels[(H/2*W+W/2)*4+3]),stages:dispatch.stageTimings};};
 await fill(false);
 for(const axis of [1,2,3])for(const direction of [-1,1]){
  const coord=axis-1,pos=[0,0,0],fwd=[0,0,0];pos[coord]=-direction*(axis===2?6:24);fwd[coord]=direction;
  b.setViewFromCamera({camPos:pos,fwd,up:axis===2?[0,0,-1]:[0,1,0],aspect:2,fovYDeg:2});
  const p={enabled:true,axis,first:.5,last:.5,spacing:1,thickness:2};b.setFrozenPattern(p);const shot=await snapshot();
  const cell=(axis===2?6:36)/dimensions[coord],expected=1-Math.exp(-40*cell*2*.075);
  checks.push({name:'single slice optical depth',axis,direction,alpha:shot.alpha,expected,pass:Math.abs(shot.alpha-expected)<.001});
 }
 b.setViewFromCamera({camPos:[0,-6,0],fwd:[0,1,0],up:[0,0,-1],aspect:2,fovYDeg:2});
 const subset={enabled:true,axis:2,first:.25,last:.75,spacing:8,thickness:2};b.setFrozenPattern(subset);const layers=frozenPatternIndices(subset,dimensions[1]).length,many=await snapshot();
 const expected=1-Math.exp(-40*(6/dimensions[1])*2*.075*layers);checks.push({name:'spaced subset optical depth',layers,alpha:many.alpha,expected,pass:Math.abs(many.alpha-expected)<.001});
 await fill(true);b.setFrozenPattern({enabled:true,axis:2,first:.5,last:.5,spacing:1,thickness:2});
 const start=await snapshot();b.advanceFrozenPattern(.25,[4,0,0]);const scrolled=await snapshot();b.advanceFrozenPattern(.25,[-4,0,0]);const returned=await snapshot();
 checks.push({name:'scrolls deterministically without rebaking',pass:start.pixels.some((v,i)=>v!==scrolled.pixels[i])&&start.pixels.every((v,i)=>v===returned.pixels[i])&&scrolled.stages.some(s=>s.stage==='frozen-cloud-fields')&&!scrolled.stages.some(s=>s.dispatched&&s.stage==='buildCloudDensityField')});
 b.setBox({center:[0,0,0],half:[90,3,90]});const tiled=await snapshot();b.setViewFromCamera({camPos:[36,-6,0],fwd:[0,1,0],up:[0,0,-1],aspect:2,fovYDeg:2});const repeated=await snapshot();
 let repeatError=0;for(let i=0;i<tiled.pixels.length;i++)repeatError=Math.max(repeatError,Math.abs(half(tiled.pixels[i])-half(repeated.pixels[i])));
 checks.push({name:'repeats at the held cell width',repeatError,pass:repeatError<.001});
 b.setViewFromCamera({camPos:[0,10,0],fwd:[0,-1,0],up:[0,0,1],aspect:2,fovYDeg:2,terrainEnabled:true});
 const inFront=await snapshot();b.setBox({center:[0,-20,0],half:[90,3,90]});const behind=await snapshot();
 checks.push({name:'terrain occludes frozen planes',inFront:inFront.alpha,behind:behind.alpha,pass:inFront.alpha>.01&&behind.alpha<.0001});
 b.setBox({center:[0,0,0],half:[90,3,90]});b.setViewFromCamera({camPos:[0,-6,0],fwd:[0,1,0],up:[0,0,-1],aspect:2,fovYDeg:2,terrainEnabled:false});
 b.setFrozenPattern({enabled:true,axis:0});await fill(true,.01);
 const volumeStart=await snapshot();b.advanceFrozenPattern(.25,[4,0,0]);const volumeScroll=await snapshot();b.advanceFrozenPattern(.25,[-4,0,0]);const volumeReturn=await snapshot();
 checks.push({name:'full 3D volume scrolls without changing its shape or rebaking',pass:volumeStart.pixels.some((v,i)=>v!==volumeScroll.pixels[i])&&volumeStart.pixels.every((v,i)=>v===volumeReturn.pixels[i])&&volumeScroll.stages.some(s=>s.stage==='frozen-cloud-fields')});
 b.setViewFromCamera({camPos:[36,-6,0],fwd:[0,1,0],up:[0,0,-1],aspect:2,fovYDeg:2});const volumeRepeat=await snapshot();
 let volumeRepeatError=0;for(let i=0;i<volumeStart.pixels.length;i++)volumeRepeatError=Math.max(volumeRepeatError,Math.abs(half(volumeStart.pixels[i])-half(volumeRepeat.pixels[i])));
 checks.push({name:'full 3D volume repeats at the captured cell width',volumeRepeatError,pass:volumeRepeatError<.001});
 const noise=device.createTexture({dimension:'3d',size:[8,8,8],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 const noiseData=Uint8Array.from({length:8**3*4},(_,i)=>(i*79+(i>>4)*43)%256);
 device.queue.writeTexture({texture:noise},noiseData,{bytesPerRow:32,rowsPerImage:8},[8,8,8]);
 b.setInputMaps({shape3DView:noise.createView(),detail3DView:noise.createView()});
 new DataView(b._frozenFieldCapture).setFloat32(76,1.25,true);
 const turbulentRepeat=await snapshot();b.setViewFromCamera({camPos:[0,-6,0],fwd:[0,1,0],up:[0,0,-1],aspect:2,fovYDeg:2});const turbulentOrigin=await snapshot();
 let turbulentRepeatError=0;for(let i=0;i<turbulentOrigin.pixels.length;i++)turbulentRepeatError=Math.max(turbulentRepeatError,Math.abs(half(turbulentOrigin.pixels[i])-half(turbulentRepeat.pixels[i])));
 checks.push({name:'frozen turbulence repeats with the held volume',turbulentRepeatError,pass:turbulentRepeatError<.001});
 b.setFrozenPattern({enabled:true,axis:2,first:.5,last:.5,spacing:1,thickness:2});const fixedPlane=await snapshot();
 b.advanceFrozenPattern(.25,[0,4,0]);const normalWind=await snapshot();b.advanceFrozenPattern(.25,[0,-4,0]);
 checks.push({name:'normal wind does not morph a frozen 2D slice',pass:fixedPlane.pixels.every((v,i)=>v===normalWind.pixels[i])});
 b.setInputMaps({shape3DView:map('3d',[240,50,60,70]),detail3DView:map('3d',[20,30,40,255])});
 checks.push({name:'same field textures and dimensions',pass:b._fieldResources===resources&&dimensions.every((n,i)=>n===b._fieldResources.dimensions[i])});
 b.setFrozenPattern({enabled:false});const live=await snapshot();checks.push({name:'returning live rebuilds current fields',pass:live.stages.some(s=>s.stage==='buildCloudDensityField'&&s.dispatched)&&live.stages.some(s=>s.stage==='buildCloudLightField'&&s.dispatched)});
 b.setFrozenPattern({enabled:false,axis:2,first:.5,last:.5,spacing:1,thickness:2});await fill(false);const livePlane=await snapshot();
 checks.push({name:'cached live slices do not require capture',alpha:livePlane.alpha,pass:livePlane.alpha>.01&&!livePlane.stages.some(s=>s.stage==='frozen-cloud-fields')});
 b.setNoiseTransforms({shapeOffsetWorld:[1,0,0]});const evolved=await snapshot();
 checks.push({name:'cached live slices retain evolving field updates',pass:evolved.stages.some(s=>s.stage==='buildCloudDensityField'&&s.dispatched)});
 b.setTuning({formType:0,phaseJitter:0,baseJitterFrac:0,topJitterFrac:0,maxSteps:224,alphaCutoff:.999});
 b.setParams({globalDensity:.1});b.setBox({center:[0,0,0],half:[1,.75,1]});
 b.setViewFromCamera({camPos:[0,-2,0],fwd:[0,1,0],up:[0,0,-1],aspect:2,fovYDeg:2});
 b.setFrozenPattern({enabled:false,axis:2,first:.5,last:.5,spacing:1,thickness:2});const proceduralOne=await snapshot();
 b.setFrozenPattern({enabled:false,axis:2,first:.25,last:.75,spacing:8,thickness:2});const proceduralMany=await snapshot();
 checks.push({name:'procedural march samples selected live slices and skip intervals',single:proceduralOne.alpha,subset:proceduralMany.alpha,pass:proceduralOne.alpha>0&&proceduralMany.alpha>proceduralOne.alpha&&!proceduralMany.stages.some(s=>s.stage==='frozen-cloud-fields')});
 for(const axis of [1,2,3])for(const direction of [-1,1]){
  const coord=axis-1,pos=[0,0,0],fwd=[0,0,0];pos[coord]=-direction*2;fwd[coord]=direction;
  b.setViewFromCamera({camPos:pos,fwd,up:axis===2?[0,0,-1]:[0,1,0],aspect:2,fovYDeg:2});
  b.setFrozenPattern({enabled:false,axis,first:.5,last:.5,spacing:1,thickness:2});const shot=await snapshot();
  checks.push({name:'procedural live plane renders from either side',axis,direction,alpha:shot.alpha,pass:shot.alpha>0});
 }
 document.querySelector('#result').textContent=JSON.stringify({complete:true,checks,errors,pass:checks.every(c=>c.pass)&&errors.length===0},null,2);device.destroy();
}
run().catch(error=>document.querySelector('#result').textContent=JSON.stringify({complete:true,pass:false,error:String(error.stack)}));
