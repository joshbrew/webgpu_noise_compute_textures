// Warm, production bake dispatches vs reusing their output through the exact
// production flow function. Timestamp queries exclude compilation/CPU waits.
import {PlanetCloudNoise} from '../../planetCloudNoise.js';
import flow from '../../shaders/planetGasFlow.wgsl';

async function run(){
 const adapter=await navigator.gpu.requestAdapter();
 const timestamps=adapter.features.has('timestamp-query');
 const device=await adapter.requestDevice({requiredFeatures:timestamps?['timestamp-query']:[]});
 const errors=[];device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
 const result=document.querySelector('#result');
 const baker=new PlanetCloudNoise(device),rows=[];
 const probeModule=device.createShaderModule({code:flow+`
  @group(0) @binding(0) var<storage,read_write> result:array<vec4<f32>>;
  @compute @workgroup_size(64) fn probe(@builtin(global_invocation_id) id:vec3<u32>){
   if(id.x>=86016u){return;}
   let i=id.x%2048u;let time=(id.x%12288u)/2048u;
   let form=f32(id.x/12288u+1u);
   let winds=array<f32,6>(0.0,.004,.65,14.7,352.8,1000.0);
   let y=1.0-2.0*(f32(i)+.5)/2048.0;
   let lon=f32(i)*2.39996323;
   var d=vec3<f32>(sqrt(1.0-y*y)*cos(lon),y,sqrt(1.0-y*y)*sin(lon));
   // Neighboring directions straddle the longitude seam and both poles.
   if(i<2u){d=normalize(vec3<f32>(1.0,.3,select(-.000001,.000001,i==1u)));}
   if(i==2u){d=vec3<f32>(0,1,0);}if(i==3u){d=vec3<f32>(0,-1,0);}
   let moved=gasWeatherDirection(d,winds[time],form);
   let next=gasWeatherDirection(d,winds[time]+.000065345,form);
   let off=planetWarpDirection(d,0.0,form,0.0,.65);
   let still=planetWarpDirection(d,0.0,form,2.0,0.0);
   let identity=max(length(moved-d),max(length(off-d),length(still-d)));
   result[id.x]=vec4<f32>(moved,select(length(next-moved),identity,time==0u));
  }`});
 const probe=await device.createComputePipelineAsync({layout:'auto',compute:{module:probeModule,entryPoint:'probe'}});
 const probeOut=device.createBuffer({size:86016*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const probeRead=device.createBuffer({size:86016*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const probeGroup=device.createBindGroup({layout:probe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:probeOut}}]});
 const probeEncoder=device.createCommandEncoder(),probePass=probeEncoder.beginComputePass();
 probePass.setPipeline(probe);probePass.setBindGroup(0,probeGroup);probePass.dispatchWorkgroups(1344);probePass.end();
 probeEncoder.copyBufferToBuffer(probeOut,0,probeRead,0,86016*16);device.queue.submit([probeEncoder.finish()]);
 await probeRead.mapAsync(GPUMapMode.READ);const probeValues=new Float32Array(probeRead.getMappedRange());
 const flowChecks={maxUnitError:0,maxIdentityError:0,maxFrameDirectionDelta:0,maxSeamGap:0,invalid:0};
 flowChecks.byForm=Array.from({length:7},(_,i)=>({form:i+1,maxLatitudeShift:0}));
 for(let i=0;i<86016;i++){
  const p=probeValues.subarray(i*4,i*4+4);
  if(!p.every(Number.isFinite))flowChecks.invalid++;
  flowChecks.maxUnitError=Math.max(flowChecks.maxUnitError,Math.abs(Math.hypot(...p.subarray(0,3))-1));
  const key=i%12288<2048?'maxIdentityError':'maxFrameDirectionDelta';flowChecks[key]=Math.max(flowChecks[key],p[3]);
  if(i%2048>=4){const check=flowChecks.byForm[Math.floor(i/12288)];check.maxLatitudeShift=Math.max(check.maxLatitudeShift,Math.abs(p[1]-(1-2*((i%2048)+.5)/2048)));}
  if(i%2048===0){const q=probeValues.subarray((i+1)*4,(i+1)*4+3);flowChecks.maxSeamGap=Math.max(flowChecks.maxSeamGap,Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]));}
 }
 probeRead.unmap();probeOut.destroy();probeRead.destroy();
 const query=timestamps?device.createQuerySet({type:'timestamp',count:2}):null;
 const resolve=timestamps?device.createBuffer({size:256,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}):null;
 const read=timestamps?device.createBuffer({size:16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}):null;
 async function timing(pipeline,group,groups,batchDispatches=8){
  const samples=[];
  for(let repeat=0;repeat<9;repeat++){
   await device.queue.onSubmittedWorkDone();
   const encoder=device.createCommandEncoder();
   const pass=encoder.beginComputePass(timestamps?{timestampWrites:{querySet:query,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1}}:{});
   pass.setPipeline(pipeline);pass.setBindGroup(0,group);
   // Browser timestamp precision is often 65.536 microseconds. Batch short
   // dispatches to measure sub-tick sampling costs instead of reporting zero.
   for(let batch=0;batch<batchDispatches;batch++)pass.dispatchWorkgroups(...groups);
   pass.end();
   if(timestamps){encoder.resolveQuerySet(query,0,2,resolve,0);encoder.copyBufferToBuffer(resolve,0,read,0,16);}
   const start=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();
   let ms=performance.now()-start;
   if(timestamps){await read.mapAsync(GPUMapMode.READ);const values=new BigUint64Array(read.getMappedRange());ms=Number(values[1]-values[0])/1e6;read.unmap();}
   if(repeat>=2)samples.push(ms/batchDispatches);
  }
  samples.sort((a,b)=>a-b);return {medianMs:samples[3],minMs:samples[0],maxMs:samples[6],batchDispatches};
 }
 const module=device.createShaderModule({code:flow+`
  override FLOW:bool=true;
  override SAMPLES:u32=1u;
  @group(0) @binding(0) var weather:texture_2d_array<f32>;
  @group(0) @binding(1) var output:texture_storage_2d<rgba16float,write>;
  @group(0) @binding(2) var linearSampler:sampler;
  @group(0) @binding(3) var<uniform> settings:vec4<f32>;
  @compute @workgroup_size(8,8) fn warp(@builtin(global_invocation_id) p:vec3<u32>){
   let dims=textureDimensions(output);if(any(p.xy>=dims)){return;}
   let uv=(vec2<f32>(p.xy)+.5)/vec2<f32>(dims);
   let lon=uv.x*6.283185307;let lat=uv.y*3.141592654;
   let direction=vec3<f32>(sin(lat)*cos(lon),cos(lat),sin(lat)*sin(lon));
   var color=vec4<f32>(0);
   for(var i=0u;i<SAMPLES;i++){
    // Vary the domain as real ray samples do, preventing loop hoisting/CSE.
    let d=normalize(direction+vec3<f32>(.003,-.002,.001)*f32(i));
    let angle=select(gasZonalAngle(d.y,settings.x),settings.x,settings.y<4.5);
    var moved=vec3<f32>(d.x*cos(angle)-d.z*sin(angle),d.y,d.x*sin(angle)+d.z*cos(angle));
    if(FLOW){moved=gasWeatherDirection(d,settings.x,settings.y);}
    let lookup=vec2<f32>(fract(atan2(moved.z,moved.x)/6.283185307),clamp(acos(clamp(moved.y,-1.0,1.0))/3.141592654,.5/f32(dims.y),1.0-.5/f32(dims.y)));
    color+=textureSampleLevel(weather,linearSampler,lookup,0,0.0);
   }
   textureStore(output,vec2<i32>(p.xy),color/f32(SAMPLES));
  }`});
 const pipelines=[];
 for(const samples of [1,16])for(const warped of [false,true]){
  pipelines.push({samples,warped,pipeline:await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'warp',constants:{FLOW:warped,SAMPLES:samples}}})});
 }
 for(const [size,height] of [[1024,1024],[2048,1024]])for(const [style,mode,form] of [['realistic',0,1],['satellite',4,1.25],['cyclonic',5,1.25],['trade_winds',6,1.25],['gas_giant',1,5],['neptune',2,6],['hail_mary',3,7]]){
  result.textContent=`Benchmarking ${style}, ${size} × ${height}…`;
  const setupStart=performance.now();
  const resource=await baker.bake({key:'benchmark',seed:17,shapeSize:128,weatherWidth:size,weatherHeight:height,weatherStyle:style});
  await device.queue.onSubmittedWorkDone();const coldSetupAndBakeMs=performance.now()-setupStart;
  const bakeGroup=device.createBindGroup({layout:baker.layout,entries:[{binding:0,resource:{buffer:resource.uniform}},{binding:1,resource:resource.shapeView},{binding:2,resource:resource.weatherView}]});
  const weather=await timing(mode>=4?await baker.satellitePipelineReady:mode?await baker.gasPipelineReady:baker.weatherPipeline,bakeGroup,[size/8,height/8,1]);
  const shape=await timing(baker.shapePipeline,bakeGroup,[32,32,32]);
  const output=device.createTexture({size:[size,height],format:'rgba16float',usage:GPUTextureUsage.STORAGE_BINDING});
  const uniform=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(uniform,0,new Float32Array([.65,form,0,0]));
  const sampler=device.createSampler({minFilter:'linear',magFilter:'linear',addressModeU:'repeat',addressModeV:'clamp-to-edge'});
  const sampling=[];
  for(const {samples,warped,pipeline} of pipelines){
   const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:resource.weatherView},{binding:1,resource:output.createView()},{binding:2,resource:sampler},{binding:3,resource:{buffer:uniform}}]});
   sampling.push({samples,warped,...await timing(pipeline,group,[size/8,height/8,1],samples===1?64:8)});
  }
  rows.push({style,size,height,weather,shape128:shape,sampling,coldSetupAndBakeMs});
  output.destroy();uniform.destroy();
 }
 const regularFlowWorks=flowChecks.byForm.slice(0,4).every(row=>row.maxLatitudeShift>.001);
 const report={complete:true,pass:errors.length===0&&regularFlowWorks&&flowChecks.invalid===0&&flowChecks.maxUnitError<1e-5&&flowChecks.maxIdentityError<1e-5&&flowChecks.maxFrameDirectionDelta<.002&&flowChecks.maxSeamGap<.0001,flowChecks,timing:timestamps?'GPU timestamp queries':'queue completion wall time (includes scheduling)',adapter:{vendor:adapter.info?.vendor,architecture:adapter.info?.architecture,device:adapter.info?.device,description:adapter.info?.description},warmupDispatches:2,measuredDispatches:7,rows,errors,
  note:'Sampling is a microbenchmark with the production flow and texture reads; it is not total frame time. Bake timings exclude allocation and shader compilation. One-read warp also represents generating an animated warped map once per frame; 16-read workload approximates repeated volume sampling.'};
 result.textContent=JSON.stringify(report,null,2);
 const table=document.createElement('table');table.style.cssText='border-collapse:collapse;font:14px system-ui;margin:24px';
 table.innerHTML='<caption style="text-align:left;margin-bottom:14px">Warm GPU time (milliseconds)</caption><thead><tr><th>Map</th><th>Size</th><th>Rebake weather</th><th>Sample existing</th><th>Warp & sample</th><th>Added warp</th></tr></thead>';
 for(const row of rows){const base=row.sampling.find(x=>x.samples===1&&!x.warped).medianMs,warp=row.sampling.find(x=>x.samples===1&&x.warped).medianMs;const tr=document.createElement('tr');tr.innerHTML=`<td>${row.style}</td><td>${row.size}×${row.height}</td><td>${row.weather.medianMs.toFixed(3)}</td><td>${base.toFixed(3)}</td><td>${warp.toFixed(3)}</td><td>${(warp-base).toFixed(3)}</td>`;table.append(tr);}
 for(const cell of table.querySelectorAll('th,td'))cell.style.cssText='padding:10px 16px;border-bottom:1px solid #40516a;text-align:left';
 document.body.prepend(table);
 baker.destroy();device.destroy();
}
run().catch(error=>document.querySelector('#result').textContent=JSON.stringify({error:error.stack}));
