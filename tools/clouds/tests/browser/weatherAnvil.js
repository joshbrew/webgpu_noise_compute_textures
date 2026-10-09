import {CloudComputeBuilder} from '../../clouds.js';
import {ANVIL_FORM,ANVIL_PARAMS,ANVIL_TUNING} from '../../weather/cloudAnvilLook.js';
import {sampleWeatherCycle,WEATHER_STATES} from '../../weather/cloudWeatherCycle.js';
import {cloudFieldDeviceDescriptor,supportsCloudFieldQuality} from '../../cloudFieldQuality.js';

async function run(){
 const adapter=await navigator.gpu.requestAdapter();
 const device=await adapter.requestDevice(cloudFieldDeviceDescriptor(adapter.limits));
 const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const builder=new CloudComputeBuilder(device,device.queue);
 await builder.ensureRenderPipelineReadyAsync();
 let weatherTexture;
 const map=(dimension,color)=>{
  const texture=device.createTexture({dimension,size:[1,1,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
  device.queue.writeTexture({texture},new Uint8Array(color),{},[1,1,1]);
  if(dimension==='2d')weatherTexture=texture;
  return texture.createView({dimension:dimension==='3d'?'3d':'2d-array'});
 };
 builder.setInputMaps({weatherView:map('2d',[220,160,0,255]),shape3DView:map('3d',[150,125,140,115]),detail3DView:map('3d',[110,145,125,255])});
 builder.setBox({center:[0,ANVIL_FORM.halfY-.3,0],half:[18,ANVIL_FORM.halfY,18]});
 builder.setViewFromCamera({camPos:[4,.6,26],fwd:[-.14,.1,-1],aspect:1.5});
 builder.createOutputTexture(96,64);
 const size=32*32*32*32;
 const storage=device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const readback=device.createBuffer({size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const pixels=device.createBuffer({size:96*64*8,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{entryPoint:'read',module:device.createShaderModule({code:`
  @group(0) @binding(0) var density:texture_3d<f32>;
  @group(0) @binding(1) var light:texture_3d<f32>;
  @group(0) @binding(2) var<storage,read_write> result:array<vec4<f32>>;
  @compute @workgroup_size(4,4,4) fn read(@builtin(global_invocation_id) gid:vec3<u32>){
   let i=(gid.z*32u+gid.y)*32u+gid.x;let p=vec3<i32>(gid*vec3<u32>(4,2,4));
   result[i*2u]=textureLoad(density,p,0);result[i*2u+1u]=textureLoad(light,p,0);
  }`})}});
 const sample=async()=>{
  await builder.dispatch();
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:builder._fieldResources.densityView},{binding:1,resource:builder._fieldResources.lightView},{binding:2,resource:{buffer:storage}}]});
  const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
  pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(8,8,8);pass.end();
  encoder.copyBufferToBuffer(storage,0,readback,0,size);
  encoder.copyTextureToBuffer({texture:builder.outTexture},{buffer:pixels,bytesPerRow:768},[96,64,1]);device.queue.submit([encoder.finish()]);
  await Promise.all([readback.mapAsync(GPUMapMode.READ),pixels.mapAsync(GPUMapMode.READ)]);
  const result={field:new Float32Array(readback.getMappedRange()).slice(),pixels:new Uint16Array(pixels.getMappedRange()).slice()};readback.unmap();pixels.unmap();return result;
 };
 builder.setTuning({...ANVIL_TUNING,formType:3});builder.setParams(ANVIL_PARAMS);const manual=await sample();
 const phase=WEATHER_STATES.findIndex(s=>s.name==='Anvil storms'),peak=phase*420/WEATHER_STATES.length;
 const state=sampleWeatherCycle(peak);builder.setWeatherProfile(state.fieldProfile);builder.setTuning(state.tuning);builder.setParams(state.cloudParams);const cycle=await sample();
 let densityMaxDelta=0,lightMaxDelta=0,changedPixels=0,occupied=0;
 for(let i=0;i<manual.field.length;i++){
  const delta=Math.abs(manual.field[i]-cycle.field[i]);
  if(i%8<4)densityMaxDelta=Math.max(densityMaxDelta,delta);else lightMaxDelta=Math.max(lightMaxDelta,delta);
  if(i%8===0&&manual.field[i]>.1)occupied++;
 }
 for(let i=0;i<manual.pixels.length;i++)if(manual.pixels[i]!==cycle.pixels[i])changedPixels++;
 // Backlighting is an appearance change: it must brighten resolved cloud
 // edges while preserving silhouettes and both cached fields.
 const lightCacheBeforeSilver=builder._fieldLightSignature,densityCacheBeforeSilver=builder._fieldDensitySignature;
 builder.setViewFromCamera({camPos:[-18,-5,18],fwd:[.65,.37,-.65],aspect:1.5});
 builder.setParams({silverIntensity:0});const silverOff=await sample();
 builder.setParams({silverIntensity:2.5});const silverOn=await sample();
 let silverChangedPixels=0,silverGain=0,silverAlphaDelta=0;
 for(let i=0;i<silverOn.pixels.length;i+=4){
  // Positive half-float bit ordering is sufficient for a brightness comparison.
  if(silverOn.pixels[i]>silverOff.pixels[i])silverChangedPixels++;
  silverGain=Math.max(silverGain,silverOn.pixels[i]-silverOff.pixels[i]);
  silverAlphaDelta=Math.max(silverAlphaDelta,Math.abs(silverOn.pixels[i+3]-silverOff.pixels[i+3]));
 }
 const silverPass=silverChangedPixels>20&&silverGain>100&&silverAlphaDelta===0&&builder._fieldLightSignature===lightCacheBeforeSilver&&builder._fieldDensitySignature===densityCacheBeforeSilver;
 builder.setParams(state.cloudParams);builder.setViewFromCamera({camPos:[4,.6,26],fwd:[-.14,.1,-1],aspect:1.5});
 // Fine erosion changes the visible result while retaining both cached fields.
 // It must be deterministic at a paused material position, subtractive in
 // density (including empty sky), and restore the exact original when disabled.
 const densityCache=builder._fieldDensitySignature,lightCache=builder._fieldLightSignature;
 builder.setCloudTurbulence(.75);const turbulent=await sample(),repeat=await sample();
 let turbulenceChangedPixels=0,turbulenceFieldDelta=0,turbulenceRepeatDelta=0,turbulenceAlphaDelta=0,turbulenceEmptySkyAdded=0;
 const halfAlpha=bits=>{const exponent=(bits>>10)&31,mantissa=bits&1023;return exponent===0?mantissa*2**-24:(1+mantissa/1024)*2**(exponent-15);};
 for(let i=0;i<cycle.field.length;i++)turbulenceFieldDelta=Math.max(turbulenceFieldDelta,Math.abs(cycle.field[i]-turbulent.field[i]));
 for(let i=0;i<cycle.pixels.length;i++){
  if(cycle.pixels[i]!==turbulent.pixels[i])turbulenceChangedPixels++;
  if(turbulent.pixels[i]!==repeat.pixels[i])turbulenceRepeatDelta++;
  if(i%4===3){
   turbulenceAlphaDelta=Math.max(turbulenceAlphaDelta,halfAlpha(turbulent.pixels[i])-halfAlpha(cycle.pixels[i]));
   if(cycle.pixels[i]===0&&turbulent.pixels[i]!==0)turbulenceEmptySkyAdded++;
  }
 }
 const turbulenceCachesReused=densityCache===builder._fieldDensitySignature&&lightCache===builder._fieldLightSignature;
 builder.setViewFromCamera({camPos:[4.5,.6,26],fwd:[-.14,.1,-1],aspect:1.5});await sample();
 const turbulenceCameraReusesFields=densityCache===builder._fieldDensitySignature&&lightCache===builder._fieldLightSignature;
 builder.setViewFromCamera({camPos:[4,.6,26],fwd:[-.14,.1,-1],aspect:1.5});const cameraRestored=await sample();
 const turbulenceCameraRestored=cameraRestored.pixels.every((value,i)=>value===turbulent.pixels[i]);
 builder.setCloudTurbulence(0);const restored=await sample();
 const turbulenceOffRestored=restored.pixels.every((value,i)=>value===cycle.pixels[i]);
 // Lower density may reach the transmittance early-out on a different step;
 // allow that .008 opaque-tail bound plus half-float rounding, never new sky.
 const turbulencePass=turbulenceChangedPixels>0&&turbulenceFieldDelta===0&&turbulenceRepeatDelta===0&&turbulenceAlphaDelta<=.009&&turbulenceEmptySkyAdded===0&&turbulenceCachesReused&&turbulenceCameraReusesFields&&turbulenceCameraRestored&&turbulenceOffRestored;
 let transitionMaxDelta=0,worstTransition=0;
 // Phase joins alone missed the old bug: identity changed inside a phase
 // when an advecting green sample crossed the hard storm-selection threshold.
 for(const boundary of Array.from({length:24},(_,i)=>i*420/24)){
  const samples=[];for(const offset of [-1/60,1/60]){
   const s=sampleWeatherCycle(boundary+offset);builder.setWeatherProfile(s.fieldProfile);builder.setTuning(s.tuning);builder.setParams(s.cloudParams);samples.push(await sample());
  }
  for(let i=0;i<samples[0].field.length;i+=8){
   const delta=Math.abs(samples[0].field[i]-samples[1].field[i]);
   if(delta>transitionMaxDelta){transitionMaxDelta=delta;worstTransition=boundary;}
  }
 }
 // A smooth steep change converges with dt; a hard pop does not. Half the
 // frame interval at the worst point rather than hiding it under a big bound.
 const refined=[];for(const offset of [-1/120,1/120]){
  const s=sampleWeatherCycle(worstTransition+offset);builder.setWeatherProfile(s.fieldProfile);builder.setTuning(s.tuning);builder.setParams(s.cloudParams);refined.push(await sample());
 }
 let refinedTransitionMaxDelta=0;
 for(let i=0;i<refined[0].field.length;i+=8)refinedTransitionMaxDelta=Math.max(refinedTransitionMaxDelta,Math.abs(refined[0].field[i]-refined[1].field[i]));
 builder.setWeatherProfile(state.fieldProfile);builder.setTuning(state.tuning);builder.setParams(state.cloudParams);
 let identityMaxDelta=0;
 for(const green of [0,64,128,192,255]){
  device.queue.writeTexture({texture:weatherTexture},new Uint8Array([220,green,0,255]),{},[1,1,1]);
  builder.invalidateCloudFields();const varied=await sample();
  // All density AND light channels must agree. Weather G is not anatomy.
  for(let i=0;i<cycle.field.length;i++)identityMaxDelta=Math.max(identityMaxDelta,Math.abs(cycle.field[i]-varied.field[i]));
 }
 let windMaxDelta=0;
 // Straddle the material-lattice boundaries: dropping a neighbor must not
 // abruptly remove its anvil footprint. Test both signs and X/Z directions.
 for(const axis of [0,2])for(const boundary of [-7,0,7]){
  const frames=[];for(const delta of [-.001,.001]){
   const offset=[0,0,0];offset[axis]=boundary+delta;
   builder.setNoiseTransforms({shapeOffsetWorld:offset});frames.push(await sample());
  }
  for(let i=0;i<frames[0].field.length;i+=8){
   windMaxDelta=Math.max(windMaxDelta,Math.abs(frames[0].field[i]-frames[1].field[i]));
  }
 }
 const compiledBefore=builder.getComputePipelineTimings().variants.length,qualityGrids={},unsupportedQualities=[];
 for(const quality of ['low','high','ultra','cinematic','reference','balanced']){
  if(!supportsCloudFieldQuality(quality,device.limits)){unsupportedQualities.push(quality);continue;}
  builder.setFieldQuality(quality);await sample();qualityGrids[quality]=builder._fieldResources.dimensions;
 }
 const compiledAfter=builder.getComputePipelineTimings().variants.length;
 const qualityPass=compiledBefore===compiledAfter&&Object.entries(qualityGrids).every(([key,grid])=>grid.join()===({low:'96,48,96',high:'192,96,192',ultra:'256,128,256',cinematic:'384,192,384',reference:'512,256,512',balanced:'128,64,128'})[key]);
 // Controlled volume verifies depth ordering: a clear hull is visible, while
 // a dense intervening cloud erases its RGB contribution. Camera/aircraft
 // changes must not rebuild either field. Test data stays in this diagnostic.
 const shipView={camPos:[0,5,0],fwd:[0,0,1],aspect:1.5,fovYDeg:30};
 const fillValue=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
 const fillPipeline=await device.createComputePipelineAsync({layout:'auto',compute:{entryPoint:'fill',module:device.createShaderModule({code:`
  @group(0) @binding(0) var density:texture_storage_3d<rgba16float,write>;
  @group(0) @binding(1) var<uniform> value:vec4<f32>;
  @compute @workgroup_size(4,4,4) fn fill(@builtin(global_invocation_id) p:vec3<u32>){textureStore(density,vec3<i32>(p),value);}
 `})}});
 const fillGroup=device.createBindGroup({layout:fillPipeline.getBindGroupLayout(0),entries:[
  {binding:0,resource:builder._fieldResources.density.createView({baseMipLevel:0,mipLevelCount:1})},{binding:1,resource:{buffer:fillValue}}]});
 const writeDensity=bits=>{
  const [w,h,d]=builder._fieldResources.dimensions;
  device.queue.writeBuffer(fillValue,0,new Float32Array([halfAlpha(bits),0,0,bits?1:0]));
  const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
  pass.setPipeline(fillPipeline);pass.setBindGroup(0,fillGroup);pass.dispatchWorkgroups(w/4,h/4,d/4);pass.end();
  device.queue.submit([encoder.finish()]);
 };
 const shipDensitySignature=builder._fieldDensitySignature,shipLightSignature=builder._fieldLightSignature;
 writeDensity(0);builder.setViewFromCamera(shipView);const clearWithoutShip=await sample();
  builder.setViewFromCamera({...shipView,aircraft:{enabled:true,position:[0,5,2]}});const clearWithShip=await sample();
 const hullPixels=[];
 for(let i=3;i<clearWithShip.pixels.length;i+=4)if(clearWithShip.pixels[i]===0x3c00&&clearWithoutShip.pixels[i]===0)hullPixels.push(i-3);
 writeDensity(0x5a40);const foggedShip=await sample();
 builder.setViewFromCamera(shipView);const denseWithoutShip=await sample();
 let shipFogRGBDelta=0,shipFogTransmission=0;
 for(const i of hullPixels){
  for(let c=0;c<3;c++)shipFogRGBDelta=Math.max(shipFogRGBDelta,Math.abs(halfAlpha(foggedShip.pixels[i+c])-halfAlpha(denseWithoutShip.pixels[i+c])));
  shipFogTransmission=Math.max(shipFogTransmission,Math.max(0,(halfAlpha(foggedShip.pixels[i+3])-.5)*2));
 }
 const shipCachesReused=shipDensitySignature===builder._fieldDensitySignature&&shipLightSignature===builder._fieldLightSignature;
 const shipFogPass=hullPixels.length>20&&shipFogRGBDelta<.01&&shipFogTransmission<.008&&shipCachesReused;
 const fieldResource=builder._fieldResources;
 builder.setBox({center:[0,5.5,0],half:[256,5.8,256],uvScale:1});
 await sample();
 const wideParams=new DataView(builder._fieldParamsAB);
 const wideTileSpan=wideParams.getFloat32(16,true);
 const wideSignature=builder._fieldDensitySignature;
 builder.setViewFromCamera({...shipView,camPos:[12,5,8]});await sample();
 const wideSkyPass=wideParams.getUint32(44,true)===1&&wideTileSpan<=50&&builder._fieldResources===fieldResource&&builder._fieldDensitySignature===wideSignature;
 // A smooth illuminated bank starts after >100 world units of empty sky.
 // Changing the random starting phase must not produce visible lighting grain.
 // This grazing synthetic ray needs a larger traversal budget than the demo;
 // use 1024 here to isolate sampling accuracy from budget exhaustion, then
 // compare against 4096. Production settings remain unchanged.
 const bankFill=await device.createComputePipelineAsync({layout:'auto',compute:{entryPoint:'fill',module:device.createShaderModule({code:`
  @group(0) @binding(0) var density:texture_storage_3d<rgba16float,write>;
  @group(0) @binding(1) var light:texture_storage_3d<rgba16float,write>;
  @compute @workgroup_size(4,4,4) fn fill(@builtin(global_invocation_id) p:vec3<u32>){
   let dims=textureDimensions(density);if(any(p>=dims)){return;}
   let y=-0.3+(f32(p.y)+0.5)*11.6/f32(dims.y);
   let d=smoothstep(4.0,4.35,y)*10.0;
   textureStore(density,vec3<i32>(p),vec4<f32>(d,d,d,0.3));
   textureStore(light,vec3<i32>(p),vec4<f32>(smoothstep(4.0,4.6,y),0.5,1.0,1.0));
  }`})}});
 const bankGroup=device.createBindGroup({layout:bankFill.getBindGroupLayout(0),entries:[
  {binding:0,resource:fieldResource.density.createView({baseMipLevel:0,mipLevelCount:1})},
  {binding:1,resource:fieldResource.light.createView({baseMipLevel:0,mipLevelCount:1})}]});
 const bankView={camPos:[0,0,-180],fwd:[0,.035,1],aspect:1.5,fovYDeg:.1};
 const renderBank=async tuning=>{
  builder.setTuning(tuning);builder.setViewFromCamera(bankView);await sample();
  const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
  pass.setPipeline(bankFill);pass.setBindGroup(0,bankGroup);pass.dispatchWorkgroups(32,16,32);pass.end();
  for(let field=0;field<2;field++)for(let level=0;level<builder._fieldMipGroups[field].length;level++){
   const mipPass=encoder.beginComputePass();
   // Reuse the real production reductions (including the conservative bound).
   mipPass.setPipeline(builder._fieldMipPipelines[field]);mipPass.setBindGroup(0,builder._fieldMipGroups[field][level]);
   mipPass.dispatchWorkgroups(...fieldResource.dimensions.map(n=>Math.ceil(Math.max(1,n>>(level+1))/4)));
   mipPass.end();
  }
  device.queue.submit([encoder.finish()]);
  return sample();
 };
 const bankPhase0=await renderBank({maxSteps:1024,phaseJitter:0});
 const bankPhase1=await renderBank({maxSteps:1024,phaseJitter:1});
 const bankReference=await renderBank({maxSteps:4096,phaseJitter:1});
 let bankPhaseDelta=0,bankReferenceDelta=0,bankAlpha=0;
 for(let i=0;i<bankPhase1.pixels.length;i++){
  bankPhaseDelta=Math.max(bankPhaseDelta,Math.abs(halfAlpha(bankPhase0.pixels[i])-halfAlpha(bankPhase1.pixels[i])));
  bankReferenceDelta=Math.max(bankReferenceDelta,Math.abs(halfAlpha(bankReference.pixels[i])-halfAlpha(bankPhase1.pixels[i])));
  if(i%4===3)bankAlpha+=halfAlpha(bankPhase1.pixels[i]);
 }
 bankAlpha/=96*64;
 const bankPass=bankPhaseDelta<.02&&bankReferenceDelta<.01&&bankAlpha>.98;
 document.querySelector('#result').dataset.farBank=JSON.stringify({bankPass,bankPhaseDelta,bankReferenceDelta,bankAlpha});
 // Actual preview reconstruction at divider 4: suppress fine radiance noise
 // in an opaque cloud without spreading it into a clear-sky patch. This is
 // deliberately independent of ray placement, camera, density and lighting.
 const noisyTexture=device.createTexture({size:[96,64,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 const noisyPixels=new Uint8Array(96*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<48;x++){
  const i=(y*96+x)*4,value=102+((x+y)%2?20:-20);
  noisyPixels.set([value,value,value,255],i);
 }
 device.queue.writeTexture({texture:noisyTexture},noisyPixels,{bytesPerRow:384},[96,64,1]);
 const preview=builder._render;
 const previewGroup=device.createBindGroup({layout:preview.bgl,entries:[
  {binding:0,resource:preview.samp},{binding:1,resource:noisyTexture.createView({dimension:'2d-array'})},{binding:2,resource:{buffer:builder.renderParams}}]});
 const previewTarget=device.createTexture({size:[384,256,1],format:preview.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
 const previewReadback=device.createBuffer({size:384*256*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const reconstruct=async compositeQuality=>{
  builder._writeRenderUniforms({cloudShading:'soft',compositeQuality,outputWidth:384,outputHeight:256,fogDensity:0,fogHorizon:0,fogSun:0,silverIntensity:0,styleRimStrength:0});
  const encoder=device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:previewTarget.createView(),loadOp:'clear',storeOp:'store',clearValue:[0,0,0,0]}]});
  pass.setPipeline(preview.pipe);pass.setBindGroup(0,previewGroup);pass.draw(6);pass.end();
  encoder.copyTextureToBuffer({texture:previewTarget},{buffer:previewReadback,bytesPerRow:1536},[384,256,1]);device.queue.submit([encoder.finish()]);
  await previewReadback.mapAsync(GPUMapMode.READ);const result=new Uint8Array(previewReadback.getMappedRange()).slice();previewReadback.unmap();return result;
 };
 const unfilteredPreview=await reconstruct(0),filteredPreview=await reconstruct(2);
 const patchStats=data=>{
  let sum=0,squared=0,n=0;
  for(let y=64;y<192;y++)for(let x=64;x<144;x++){
   const value=data[(y*384+x)*4];sum+=value;squared+=value*value;n++;
  }
  const mean=sum/n;return {mean,deviation:Math.sqrt(Math.max(0,squared/n-mean*mean))};
 };
 const beforeReconstruction=patchStats(unfilteredPreview),afterReconstruction=patchStats(filteredPreview);
 let clearSkyDelta=0;
 for(let y=64;y<192;y++)for(let x=256;x<352;x++)for(let c=0;c<3;c++){
  const i=(y*384+x)*4+c;clearSkyDelta=Math.max(clearSkyDelta,Math.abs(unfilteredPreview[i]-filteredPreview[i]));
 }
 const reconstructionPass=beforeReconstruction.deviation>1&&afterReconstruction.deviation<beforeReconstruction.deviation*.75&&Math.abs(afterReconstruction.mean-beforeReconstruction.mean)<3&&clearSkyDelta===0;
 // Compile and execute the spherical style path with the new sculpted finish.
 builder.setOptions({sphericalMode:true,planetStyleMode:true});
 builder.setTuning({formType:3,lightingFinish:2});
 builder.setViewFromCamera({camPos:[0,0,30],fwd:[0,0,-1],aspect:1.5,planetRadius:10,cloudBottom:1,cloudTop:3});
 await builder.dispatch();await device.queue.onSubmittedWorkDone();
 const pass=densityMaxDelta===0&&lightMaxDelta===0&&changedPixels===0&&occupied>100&&transitionMaxDelta<.25&&refinedTransitionMaxDelta<transitionMaxDelta*.65+.005&&identityMaxDelta===0&&windMaxDelta<.5&&qualityPass&&turbulencePass&&shipFogPass&&wideSkyPass&&bankPass&&reconstructionPass&&silverPass&&errors.length===0;
 document.querySelector('#result').dataset.silver=JSON.stringify({silverPass,silverChangedPixels,silverGain,silverAlphaDelta});
 document.querySelector('#result').dataset.reconstruction=JSON.stringify({reconstructionPass,beforeReconstruction,afterReconstruction,clearSkyDelta});
 document.querySelector('#result').dataset.wideSky=JSON.stringify({wideSkyPass,wideTileSpan,skySpan:512,cameraReusesFields:builder._fieldDensitySignature===wideSignature});
 document.querySelector('#result').dataset.shipFog=JSON.stringify({shipFogPass,hullPixels:hullPixels.length,shipFogRGBDelta,shipFogTransmission,shipCachesReused});
 document.querySelector('#result').textContent=JSON.stringify({complete:true,pass,densityMaxDelta,lightMaxDelta,changedPixels,occupied,transitionMaxDelta,worstTransition,refinedTransitionMaxDelta,identityMaxDelta,windMaxDelta,qualityGrids,unsupportedQualities,compiledBefore,compiledAfter,turbulenceChangedPixels,turbulenceFieldDelta,turbulenceRepeatDelta,turbulenceAlphaDelta,turbulenceEmptySkyAdded,turbulenceCachesReused,turbulenceCameraReusesFields,turbulenceCameraRestored,turbulenceOffRestored,errors},null,2);
 device.destroy();
}
run().catch(error=>document.querySelector('#result').textContent=JSON.stringify({error:error.stack}));
