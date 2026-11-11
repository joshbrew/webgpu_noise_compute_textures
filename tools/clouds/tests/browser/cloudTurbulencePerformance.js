import {CloudComputeBuilder} from '../../clouds.js';
import common from '../../shaders/cloudCommon.wgsl';
import aircraft from '../../shaders/cloudAircraft.wgsl';
import terrain from '../../shaders/cloudTerrain.wgsl';
import scratch from '../../shaders/cloudScratch.wgsl';
import current from '../../shaders/clouds.wgsl';
import previous from './clouds_turbulence-baseline.wgsl';
import resolveSource from '../../shaders/cloudResolve.wgsl';
import fields from '../../shaders/cloudFields.wgsl';
async function run(){
 const adapter=await navigator.gpu.requestAdapter(),gpuTiming=adapter.features.has('timestamp-query');
 const device=await adapter.requestDevice({requiredFeatures:gpuTiming?['timestamp-query']:[]}),errors=[];
 device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const b=new CloudComputeBuilder(device,device.queue),W=512,H=288;
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
 b.setInputMaps({weatherView:makeMap('2d',32),shape3DView:makeMap('3d',32),detail3DView:makeMap('3d',32)});
 b.createOutputTexture(W,H);b.setBox({center:[0,0,0],half:[90,4,90]});b.setFieldQuality('low');
 b.setReprojSettings({enabled:0,temporalCellRate:1,temporalBlend:0});
 b.setTuning({formType:6,puffScale:5.8,maxSteps:224,lightingFinish:1,minOutputAlpha:0,alphaBoostAmount:0});
 b.setNoiseTransforms({shapeScale:.14,detailScale:1.2});b.setParams({globalCoverage:.92,globalDensity:6.5});
 b.setViewFromCamera({camPos:[0,2,26],fwd:[0,.12,-1],aspect:W/H,fovYDeg:60});
 await b.dispatch();await device.queue.onSubmittedWorkDone();
 const key=b._currentComputeVariantKey(),descriptor=b._computePipelineDescriptorForKey(key),pipelines=[];
 for(const [name,source] of [['previous',previous],['bounded',current]]){
  const module=device.createShaderModule({code:[common,aircraft,terrain,scratch,source,resolveSource,fields].join('\n')});
  const info=await module.getCompilationInfo();for(const m of info.messages)if(m.type==='error')errors.push(m.message);
  pipelines.push({name,pipeline:await device.createComputePipelineAsync({...descriptor,compute:{...descriptor.compute,module}})});
 }
 const resolve=b._ensureFlatStagePipeline('resolveCloudFlat');
 const query=gpuTiming?device.createQuerySet({type:'timestamp',count:4}):null;
 const queryBuffer=gpuTiming?device.createBuffer({size:32,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}):null;
 const queryRead=gpuTiming?device.createBuffer({size:32,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}):null;
 const pixelsRead=device.createBuffer({size:W*H*8,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const encode=(variant,enc,q=0)=>{
  b._writeCommonComputeUniforms();b._makeBindGroups();
  const pass=enc.beginComputePass(gpuTiming?{timestampWrites:{querySet:query,beginningOfPassWriteIndex:q,endOfPassWriteIndex:q+1}}:{});
  pass.setPipeline(variant.pipeline);pass.setBindGroup(0,b._currentBg0);pass.setBindGroup(1,b._currentBg1);pass.setBindGroup(2,b._getFlatStageBindGroup());
  pass.dispatchWorkgroups(W/8,H/8);pass.setPipeline(resolve);pass.dispatchWorkgroups(W/8,H/8);pass.end();
 };
 const snapshot=async variant=>{
  const enc=device.createCommandEncoder();encode(variant,enc);enc.copyTextureToBuffer({texture:b.outTexture},{buffer:pixelsRead,bytesPerRow:W*8},[W,H,1]);device.queue.submit([enc.finish()]);
  await pixelsRead.mapAsync(GPUMapMode.READ);const values=new Uint16Array(pixelsRead.getMappedRange()).slice();pixelsRead.unmap();return values;
 };
 const rows=[],checks=[];
 for(const form of [1,6,9])for(const amount of [0,.75,1.25]){
  b.setTuning({formType:form});b.setCloudTurbulence(amount);await b.dispatch();await device.queue.onSubmittedWorkDone();
  const before=await snapshot(pipelines[0]),after=await snapshot(pipelines[1]);
  checks.push({form,amount,identical:before.every((v,i)=>v===after[i]),pass:amount!==0||before.every((v,i)=>v===after[i])});
  const density=b._fieldResources.density,light=b._fieldResources.light;
  const samples=[[],[]];
  for(let frame=0;frame<20;frame++){
   b.setViewFromCamera({fwd:[.01*Math.sin(frame*.3),.12,-1]});
   const enc=device.createCommandEncoder();for(let order=0;order<2;order++)encode(pipelines[(order+frame)%2],enc,order*2);
   if(gpuTiming){enc.resolveQuerySet(query,0,4,queryBuffer,0);enc.copyBufferToBuffer(queryBuffer,0,queryRead,0,32);}
   const start=performance.now();device.queue.submit([enc.finish()]);await device.queue.onSubmittedWorkDone();
   if(gpuTiming)await queryRead.mapAsync(GPUMapMode.READ);const time=gpuTiming?new BigUint64Array(queryRead.getMappedRange()):null;
   for(let order=0;order<2;order++)if(frame>=4)samples[(order+frame)%2].push(time?Number(time[order*2+1]-time[order*2])*1e-6:(performance.now()-start)/2);
   if(gpuTiming)queryRead.unmap();
  }
  for(let i=0;i<2;i++){samples[i].sort((a,b)=>a-b);rows.push({form,amount,variant:pipelines[i].name,medianMs:samples[i][8],p90Ms:samples[i][14]});}
  checks.push({form,amount,name:'resources reused',pass:density===b._fieldResources.density&&light===b._fieldResources.light});
 }
 const report={complete:true,gpuTiming,width:W,height:H,rows,checks,errors,pass:checks.every(c=>c.pass)&&errors.length===0};
 document.querySelector('#result').textContent=JSON.stringify(report,null,2);device.destroy();
}
run().catch(error=>document.querySelector('#result').textContent=JSON.stringify({complete:true,pass:false,error:String(error.stack)}));
