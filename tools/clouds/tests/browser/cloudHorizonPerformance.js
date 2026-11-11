// Paired GPU timings and exact before/after cloud-pixel comparisons.
import {CloudComputeBuilder} from '../../clouds.js';
import common from '../../shaders/cloudCommon.wgsl';
import aircraft from '../../shaders/cloudAircraft.wgsl';
import terrain from '../../shaders/cloudTerrain.wgsl';
import scratch from '../../shaders/cloudScratch.wgsl';
import layer from '../../shaders/cloudLayer.wgsl';
import output from '../../shaders/cloudRayOutput.wgsl';
import baselineCommon from './cloudCommon_horizon-baseline.wgsl';
import baselineLayer from './cloudLayer_horizon-baseline.wgsl';

async function run(){
 const adapter=await navigator.gpu.requestAdapter();
 const gpuTiming=adapter.features.has('timestamp-query');
 const shapes=[[8,8,0],[16,8,1]],queryCount=shapes.length*2;
 const device=await adapter.requestDevice({requiredFeatures:gpuTiming?['timestamp-query']:[]}),errors=[];
 const query=gpuTiming?device.createQuerySet({type:'timestamp',count:queryCount}):null;
 const queryBuffer=gpuTiming?device.createBuffer({size:queryCount*8,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}):null;
 const queryRead=gpuTiming?device.createBuffer({size:queryCount*8,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}):null;
 device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
 const b=new CloudComputeBuilder(device,device.queue),W=773,H=435;
 const makeMap=(dimension,n)=>{
  const depth=dimension==='3d'?n:1,data=new Uint8Array(n*n*depth*4);
  for(let z=0;z<depth;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const a=x*Math.PI*2/n,c=y*Math.PI*2/n,d=z*Math.PI*2/n,i=((z*n+y)*n+x)*4;
   data.set(dimension==='3d'?[170+55*Math.sin(a+c),145+65*Math.cos(c+d),130+75*Math.sin(d+a),150+60*Math.cos(a-c+d)]:[225+25*Math.sin(a+c),160+80*Math.cos(a-c),0,255],i);
  }
  const texture=device.createTexture({dimension,size:[n,n,depth],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
  device.queue.writeTexture({texture},data,{bytesPerRow:n*4,rowsPerImage:n},[n,n,depth]);
  return texture.createView({dimension:dimension==='3d'?'3d':'2d-array'});
 };
 b.setInputMaps({weatherView:makeMap('2d',64),shape3DView:makeMap('3d',32),detail3DView:makeMap('3d',32)});
 b.createOutputTexture(W,H);b.setBox({center:[0,0,0],half:[180,.75,180]});
 b.setReprojSettings({enabled:0,temporalCellRate:1,temporalBlend:0});
 b.setTuning({formType:0,shelfFlow:1.8,paintedLayers:.65,maxSteps:224,lightingFinish:2,baseJitterFrac:.02,topJitterFrac:.12,minOutputAlpha:0,phaseJitter:0,stepJitter:0});
 b.setNoiseTransforms({shapeScale:.14,detailScale:.4,shapeAxisScale:[.24,1,1.4],detailAxisScale:[.32,1,1]});
 b.setParams({globalCoverage:.94,globalDensity:10});
 b.setViewFromCamera({camPos:[.3,5.25,8],fwd:[.1,0,-1],aspect:W/H,fovYDeg:60,cloudScale:8});
 await b.dispatch();await device.queue.onSubmittedWorkDone();
 const key=b._currentComputeVariantKey(),descriptor=b._computePipelineDescriptorForKey(key);
 const pipelines=[];
 for(const [x,y,cache] of shapes){
  const code=[cache?common:baselineCommon,aircraft,terrain,scratch,cache?layer:baselineLayer,output].join('\n');
  const entry=cache?'computeCloudBox':`horizon_${x}_${y}_${cache}`;
  const module=device.createShaderModule({code:code+(cache?'':`\n@compute @workgroup_size(${x},${y},1) fn ${entry}(@builtin(global_invocation_id) gid:vec3<u32>,@builtin(local_invocation_id) lid:vec3<u32>){computeCloudCore(gid,lid);}`)});
  const diagnostics=await module.getCompilationInfo();
  const shaderErrors=diagnostics.messages.filter(m=>m.type==='error').map(m=>({line:m.lineNum,message:m.message}));
  if(shaderErrors.length){document.querySelector('#result').textContent=JSON.stringify({complete:true,shaderErrors},null,2);device.destroy();return;}
  const started=performance.now();
  const constants={...descriptor.compute.constants}; if(cache)constants.CLOUD_WORKGROUP_WIDTH=x;
  if(!cache){delete constants.CLOUD_WORKGROUP_WIDTH;delete constants.CLOUD_FROZEN_SLICES;}
  const pipeline=await device.createComputePipelineAsync({...descriptor,compute:{...descriptor.compute,module,entryPoint:entry,constants}});
  pipelines.push({name:`${x}x${y}`,x,y,pipeline,compileMs:performance.now()-started});
 }
 const resolve=b._ensureFlatStagePipeline('resolveCloudFlat');
 let compact=false;
 const encode=(variant,enc=device.createCommandEncoder(),queryBase=0,resolveQueries=true)=>{
  b._setCompactInterleaveUniform(compact);b._writeCommonComputeUniforms();b._makeBindGroups();
  const dispatch=compact?b._compactInterleaveDispatchShape():{w:b._dvFrame.getUint32(8,true),h:b._dvFrame.getUint32(12,true)};
  const pass=enc.beginComputePass(gpuTiming?{timestampWrites:{querySet:query,beginningOfPassWriteIndex:queryBase,endOfPassWriteIndex:queryBase+1}}:{});
  pass.setPipeline(variant.pipeline);pass.setBindGroup(0,b._currentBg0);pass.setBindGroup(1,b._currentBg1);pass.setBindGroup(2,b._getFlatStageBindGroup());
  pass.dispatchWorkgroups(Math.ceil(dispatch.w/variant.x),Math.ceil(dispatch.h/variant.y));
  pass.setPipeline(resolve);pass.dispatchWorkgroups(Math.ceil(dispatch.w/8),Math.ceil(dispatch.h/8));pass.end();
  if(gpuTiming && resolveQueries){enc.resolveQuerySet(query,0,2,queryBuffer,0);enc.copyBufferToBuffer(queryBuffer,0,queryRead,0,16);}
  return enc;
 };
 const rowBytes=Math.ceil(W*8/256)*256;
 const read=device.createBuffer({size:rowBytes*H,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const snapshot=async variant=>{
  let enc=device.createCommandEncoder();
  const clear=enc.beginRenderPass({colorAttachments:[{view:b.outTexture.createView({dimension:'2d'}),clearValue:[.125,.125,.125,.125],loadOp:'clear',storeOp:'store'}]});clear.end();
  if(variant.direct){
   device.queue.submit([enc.finish()]);await b.dispatch();enc=device.createCommandEncoder();
  }else if(variant.split||variant.builder){
   device.queue.submit([enc.finish()]);enc=device.createCommandEncoder();
   const dispatch=b.encodeDispatchPasses(enc,{coarseFactor:variant.coarseFactor||1,reconstructAtPresentation:!!variant.coarseFactor});
   if(variant.split){device.queue.submit([enc.finish()]);dispatch.restoreAfterSubmit?.();await device.queue.onSubmittedWorkDone();enc=device.createCommandEncoder();}
  }else encode(variant,enc);
  enc.copyTextureToBuffer({texture:variant.coarseFactor?b._coarseTexture:b.outTexture},{buffer:read,bytesPerRow:rowBytes},[W,H,1]);device.queue.submit([enc.finish()]);
  await read.mapAsync(GPUMapMode.READ);const padded=new Uint16Array(read.getMappedRange()),values=new Uint16Array(W*H*4);
  for(let y=0;y<H;y++)values.set(padded.subarray(y*rowBytes/2,y*rowBytes/2+W*4),y*W*4);
  read.unmap();return values;
 };
 const rows=[],parity=[];
 for(const scene of [{name:'dense horizon',pitch:0,density:10},{name:'thin horizon',pitch:0,density:.35},{name:'upward',pitch:.55,density:10},{name:'downward',pitch:-.55,density:10},{name:'tower horizon',pitch:0,density:.35,form:2},{name:'oblique horizon',pitch:-.12,density:.35},{name:'medium horizon',pitch:0,density:1},{name:'thicker horizon',pitch:0,density:3}]){
  b.setTuning({formType:scene.form??0});b.setParams({globalDensity:scene.density});b.setViewFromCamera({fwd:[.1,scene.pitch,-1]});
  const reference=await snapshot(pipelines[0]);
  for(const variant of [...pipelines.slice(1),...(scene.form?[]:[{name:'split production',split:true},{name:'direct after split',direct:true}])]){
   const values=await snapshot(variant);let changed=0,maxAlpha=0,maxRgb=0,squared=0;
   const half=v=>{const e=(v>>10)&31,m=v&1023;return e===0?m*2**-24:(1+m/1024)*2**(e-15);};
   for(let i=0;i<values.length;i++){
    if(values[i]!==reference[i])changed++;
    const delta=Math.abs(half(values[i])-half(reference[i]));
    if(i%4===3)maxAlpha=Math.max(maxAlpha,delta);else {maxRgb=Math.max(maxRgb,delta);squared+=delta*delta;}
   }
   const rgbRmse=Math.sqrt(squared/(W*H*3));
   parity.push({scene:scene.name,layout:variant.name,changedComponents:changed,maxAlpha,maxRgb,rgbRmse,pass:changed===0});
  }
  const samples=pipelines.map(()=>[]);
  for(let frame=0;frame<24;frame++){
   b.setViewFromCamera({fwd:[.1+frame*.006,scene.pitch,-1]});
   b.setNoiseTransforms({shapeOffsetWorld:[frame*.01,0,0],detailOffsetWorld:[0,0,frame*.006]});
   const enc=device.createCommandEncoder();
   for(let order=0;order<pipelines.length;order++)encode(pipelines[(order+frame)%pipelines.length],enc,order*2,false);
   if(gpuTiming){enc.resolveQuerySet(query,0,queryCount,queryBuffer,0);enc.copyBufferToBuffer(queryBuffer,0,queryRead,0,queryCount*8);}
   const start=performance.now();device.queue.submit([enc.finish()]);await device.queue.onSubmittedWorkDone();
   const elapsed=performance.now()-start;
   if(gpuTiming)await queryRead.mapAsync(GPUMapMode.READ);
   const time=gpuTiming?new BigUint64Array(queryRead.getMappedRange()):null;
   for(let order=0;order<pipelines.length;order++){
    const ms=time?Number(time[order*2+1]-time[order*2])*0.000001:elapsed/pipelines.length;
    if(frame>=4)samples[(order+frame)%pipelines.length].push(ms);
   }
   if(gpuTiming)queryRead.unmap();
  }
  for(let i=0;i<pipelines.length;i++){
   samples[i].sort((a,c)=>a-c);rows.push({scene:scene.name,layout:pipelines[i].name,medianMs:samples[i][10],p90Ms:samples[i][18]});
  }
  document.querySelector('#result').textContent=JSON.stringify({complete:false,rows,parity,errors},null,2);
 }
 // Exercise the shared direction with nonzero user displacement and wide FOV.
 for(const angle of [.4,2.1]){
  b.setOptions({r2:125,r3:angle});b.setParams({globalDensity:.35});
  b.setViewFromCamera({fwd:[.3,.04,-1],fovYDeg:90});
  const before=await snapshot(pipelines[0]);
  for(const variant of pipelines.slice(1)){
   const after=await snapshot(variant);let changed=0;
   for(let i=0;i<before.length;i++)if(before[i]!==after[i])changed++;
   parity.push({scene:`nonzero warp ${angle}`,layout:variant.name,changedComponents:changed,pass:changed===0});
  }
 }
 // Odd dimensions, every compact owner rate, and partial tiles must retain
 // the same pixels even though the primary and resolve group widths differ.
 b.setTuning({formType:0});b.setParams({globalDensity:10});
 b.setViewFromCamera({fwd:[.1,0,-1]});
 for(const rate of [2,4,8,16,32,64]){
  compact=true;b.setReprojSettings({temporalCellRate:rate,frameIndex:1,temporalCellPhase:rate-1});
  const before=await snapshot(pipelines[0]),after=await snapshot(pipelines[1]);
  let changed=0,updated=0;
  for(let i=0;i<before.length;i++){if(before[i]!==after[i])changed++;if(i%4===3&&after[i]!==0x3000)updated++;}
  parity.push({scene:`compact x${rate}`,changedComponents:changed,updatedPixels:updated,pass:changed===0&&updated>0});
 }
 compact=false;b.setReprojSettings({temporalCellRate:1,frameIndex:0});
 const full=await snapshot(pipelines[1]);
 b.setFrame({tileWidth:37,tileHeight:19,originX:12,originY:7});
 const tile=await snapshot(pipelines[1]);let wrongInside=0,wrongOutside=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)for(let c=0;c<4;c++){
  const i=(y*W+x)*4+c,inside=x>=12&&x<49&&y>=7&&y<26;
  if(inside&&tile[i]!==full[i])wrongInside++;
  if(!inside&&tile[i]!==0x3000)wrongOutside++;
 }
 parity.push({scene:'partial tile',wrongInside,wrongOutside,pass:wrongInside===0&&wrongOutside===0});
 b.setFrame({tileWidth:W,tileHeight:H,originX:0,originY:0});
 b.setViewFromCamera({terrainEnabled:true,camPos:[.3,8.25,8],fwd:[.1,-.4,-1]});
 for(const coarseFactor of [0,2]){
  if(coarseFactor)b.createOutputTexture(W*2,H*2);
  const before=await snapshot({builder:true,coarseFactor}),after=await snapshot({split:true,coarseFactor});
  let changed=0;for(let i=0;i<before.length;i++)if(before[i]!==after[i])changed++;
  parity.push({scene:coarseFactor?'coarse terrain split':'terrain split',changedComponents:changed,pass:changed===0});
 }
 document.querySelector('#result').textContent=JSON.stringify({complete:true,gpuTiming,compile:pipelines.map(p=>({layout:p.name,ms:p.compileMs})),width:W,height:H,rows,parity,errors,pass:parity.every(p=>p.pass)&&!errors.length},null,2);
 read.destroy();device.destroy();
}
run().catch(error=>document.querySelector('#result').textContent=JSON.stringify({error:error.stack}));
