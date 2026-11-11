// In-place production weather regeneration, readback parity and warm GPU cost.
import {PlanetCloudNoise} from '../../planetCloudNoise.js';
async function run(){
 const adapter=await navigator.gpu.requestAdapter();
 const timestamps=adapter.features.has('timestamp-query');
 const device=await adapter.requestDevice({requiredFeatures:timestamps?['timestamp-query']:[]});
 const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const baker=new PlanetCloudNoise(device),rows=[];
 const module=device.createShaderModule({code:`
 @group(0) @binding(0) var weather:texture_2d_array<f32>;
 @group(0) @binding(1) var shape:texture_3d<f32>;
 @group(0) @binding(2) var<storage,read_write> values:array<vec4<f32>>;
 @compute @workgroup_size(64) fn probe(@builtin(global_invocation_id) id:vec3<u32>){
  if(id.x>=512u){return;}
  let dims=textureDimensions(weather);let i=id.x;
  values[i]=textureLoad(weather,vec2<i32>(i32((i*127u)%dims.x),i32((i*79u)%dims.y)),0,0);
  values[i+512u]=textureLoad(shape,vec3<i32>(i32(i%32u),i32((i/32u)%32u),i32((i*17u)%32u)),0);
 }`});
 const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'probe'}});
 const storage=device.createBuffer({size:16384,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const read=device.createBuffer({size:16384,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
 const query=timestamps?device.createQuerySet({type:'timestamp',count:2}):null;
 const resolve=timestamps?device.createBuffer({size:256,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}):null;
 const times=timestamps?device.createBuffer({size:16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}):null;
 for(const style of ['realistic','satellite','cyclonic','trade_winds','gas_giant','neptune','hail_mary']){
  document.querySelector('#result').textContent=`Regenerating ${style}…`;
  const resource=await baker.bake({key:'map',seed:17,shapeSize:32,weatherWidth:2048,weatherHeight:1024,weatherStyle:style});
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:resource.weatherView},{binding:1,resource:resource.shapeView},{binding:2,resource:{buffer:storage}}]});
  async function snapshot(){
   const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(8);pass.end();
   encoder.copyBufferToBuffer(storage,0,read,0,16384);device.queue.submit([encoder.finish()]);
   await read.mapAsync(GPUMapMode.READ);const data=new Float32Array(read.getMappedRange()).slice();read.unmap();return data;
  }
  const initial=await snapshot();
  baker.regenerateWeather('map',.012/60);const frame=await snapshot();
  baker.regenerateWeather('map',.3);const evolved=await snapshot();
  baker.regenerateWeather('map',0);const restored=await snapshot();
  const same=(a,b,start=0,end=a.length)=>a.slice(start,end).every((v,i)=>v===b[start+i]);
  const changed=(a,b)=>a.slice(0,2048).filter((v,i)=>v!==b[i]).length;
  const samples=[];
  for(let i=0;i<12;i++){
   resource.phaseUniform[0]=i*.012/60;device.queue.writeBuffer(resource.uniform,12,resource.phaseUniform);
   const encoder=device.createCommandEncoder();const pass=encoder.beginComputePass(timestamps?{timestampWrites:{querySet:query,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1}}:{});
   pass.setPipeline(resource.weatherPipeline);pass.setBindGroup(0,resource.group);pass.dispatchWorkgroups(...resource.weatherGroups);pass.end();
   if(timestamps){encoder.resolveQuerySet(query,0,2,resolve,0);encoder.copyBufferToBuffer(resolve,0,times,0,16);}
   const start=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();let ms=performance.now()-start;
   if(timestamps){await times.mapAsync(GPUMapMode.READ);const data=new BigUint64Array(times.getMappedRange());ms=Number(data[1]-data[0])/1e6;times.unmap();}
   if(i>=3)samples.push(ms);
  }
  samples.sort((a,b)=>a-b);
  const row={style,width:2048,height:1024,frameChangedChannels:changed(initial,frame),evolvedChangedChannels:changed(initial,evolved),restoresExactly:same(initial,restored),shapeUnchanged:same(initial,evolved,2048),sameTexture:baker.resources.get('map').weather===resource.weather,medianGpuMs:samples[4],maxGpuMs:samples.at(-1)};
  row.pass=row.frameChangedChannels>0&&row.evolvedChangedChannels>0&&row.restoresExactly&&row.shapeUnchanged&&row.sameTexture;rows.push(row);
 }
 const report={complete:true,pass:!errors.length&&rows.every(r=>r.pass),timing:timestamps?'GPU timestamps, weather dispatch only':'queue wall time',rows,errors};
 document.querySelector('#result').textContent=JSON.stringify(report,null,2);baker.destroy();device.destroy();
}
run().catch(e=>document.querySelector('#result').textContent=JSON.stringify({error:e.stack}));
