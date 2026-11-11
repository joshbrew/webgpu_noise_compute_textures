import layer from '../../shaders/cloudLayer.wgsl';
import source from '../../shaders/cloudsRender.wgsl';
import aircraft from '../../shaders/cloudAircraft.wgsl';
import terrain from '../../shaders/cloudTerrain.wgsl';
async function run(){
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice();
 const full=device.createShaderModule({code:source+'\n'+aircraft+'\n'+terrain});
 const compilation=await full.getCompilationInfo();
 const errors=compilation.messages.filter(m=>m.type==='error').map(m=>({line:m.lineNum,message:m.message}));
 if(errors.length){document.querySelector('#result').textContent=JSON.stringify({errors},null,2);device.destroy();return;}
 const helper=source.slice(source.indexOf('fn cloudLineMetric('),source.indexOf('struct CloudNeighborhood'));
 const width=128,height=96,count=width*height;
 const out=device.createBuffer({size:count*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const read=device.createBuffer({size:count*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const module=device.createShaderModule({code:`
 @group(0) @binding(0) var<storage,read_write> result:array<vec4<f32>>;
 fn luma(c:vec3<f32>)->f32{return dot(c,vec3<f32>(0.2126,0.7152,0.0722));}
 ${helper}
 fn smoothField(p:vec2<i32>)->vec4<f32>{
  let q=vec2<f32>(p)/vec2<f32>(${width}.0,${height}.0);
  let a=.55+.20*q.x;
  return vec4<f32>(vec3<f32>(.20+.35*q.y,.28+.12*q.x,.42-.08*q.y)*a,a);
 }
 fn field(p:vec2<i32>,kind:u32)->vec4<f32>{
  let c=smoothField(p);
  if(kind==0u){return c;}
  if(kind==2u){return select(vec4<f32>(0.0),c,p.x>64);}
  let seam=(p.x+2*p.y)%19==0 || (2*p.x-p.y+400)%23==0;
  return select(c,c*vec4<f32>(.62,.62,.62,.78),seam);
 }
 fn repair(p:vec2<i32>,kind:u32)->vec4<f32>{return cloudLineRepair(field(p,kind),field(p+vec2<i32>(-1,0),kind),field(p+vec2<i32>(1,0),kind),field(p+vec2<i32>(0,-1),kind),field(p+vec2<i32>(0,1),kind));}
 @compute @workgroup_size(8,8) fn main(@builtin(global_invocation_id) id:vec3<u32>){
  let p=vec2<i32>(id.xy);let truth=smoothField(p);let raw=field(p,1u);let fixed=repair(p,1u);
  let ramp=length(repair(p,0u)-field(p,0u));let silhouette=length(repair(p,2u)-field(p,2u));
  result[id.y*${width}u+id.x]=vec4<f32>(dot(raw-truth,raw-truth),dot(fixed-truth,fixed-truth),ramp,silhouette);
 }`});
 const pipe=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
 const group=device.createBindGroup({layout:pipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:out}}]});
 const dispatch=(copies=1)=>{const encoder=device.createCommandEncoder();for(let i=0;i<copies;i++){const pass=encoder.beginComputePass();pass.setPipeline(pipe);pass.setBindGroup(0,group);pass.dispatchWorkgroups(width/8,height/8);pass.end();}return encoder;};
 const enc=dispatch();enc.copyBufferToBuffer(out,0,read,0,count*16);device.queue.submit([enc.finish()]);
 await read.mapAsync(GPUMapMode.READ);const values=new Float32Array(read.getMappedRange()).slice();read.unmap();
 let before=0,after=0,ramp=0,silhouette=0;
 for(let i=0;i<count;i++){before+=values[i*4];after+=values[i*4+1];ramp=Math.max(ramp,values[i*4+2]);silhouette=Math.max(silhouette,values[i*4+3]);}
 const timing=[];device.queue.submit([dispatch(8).finish()]);await device.queue.onSubmittedWorkDone();
 for(let i=0;i<5;i++){let start=performance.now();device.queue.submit([dispatch(64).finish()]);await device.queue.onSubmittedWorkDone();timing.push((performance.now()-start)/64);}
 const nearHelper=layer.slice(0,layer.indexOf('// ---------------------- Main compute'));
 const merging=layer.slice(layer.indexOf('    var integrationStepLen='),layer.indexOf('    let flatSliceP'));
 const coverageModule=device.createShaderModule({code:`
 const EPS:f32=0.000001; fn mix_f(a:f32,b:f32,t:f32)->f32{return mix(a,b,t);}
 fn sphericalCloudMode()->bool{return false;}
 @group(0) @binding(0) var<storage,read_write> result:array<vec4<f32>>;
 ${nearHelper}
 @compute @workgroup_size(64) fn coverage(@builtin(global_invocation_id) id:vec3<u32>){
  let yaw=f32(id.x%64u)*6.283185/64.0;let pitch=(f32(id.x/64u)/7.0-.5)*2.8;
  let rd=normalize(vec3<f32>(sin(yaw)*cos(pitch),sin(pitch),cos(yaw)*cos(pitch)));
  let ro=vec3<f32>(.123+f32(id.x%7u)*.07,.236,-.413);
  let origin=vec3<f32>(0.0);let nearCellPitch=.3;let stableNearEnd=3.0;let t1=3.0;let t0=0.0;
  let stableNearSample=true;var t=0.0;var pendingNearLength=0.0;var integrated=0.0;var probes=0.0;var crossings=0.0;var iter=0i;
  for(var i=0u;i<256u;i++){
   if(t>=t1){break;}crossings+=1.0;
   let crossing=nearMaterialCellInterval(ro,rd,t,origin,nearCellPitch);
   let nearFacing=crossing.y;let stepLen=min(crossing.x,t1-t);let materialPitch=nearCellPitch;
   ${merging}
   integrated+=integrationStepLen;probes+=1.0;t=min(t+stepLen,t1);
  }
  result[id.x]=vec4<f32>(abs(integrated-3.0),probes/max(crossings,1.0),integrated,t);
 }`});
 const coveragePipe=await device.createComputePipelineAsync({layout:'auto',compute:{module:coverageModule,entryPoint:'coverage'}});
 const coverageGroup=device.createBindGroup({layout:coveragePipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:out}}]});
 const coverageEnc=device.createCommandEncoder(),coveragePass=coverageEnc.beginComputePass();coveragePass.setPipeline(coveragePipe);coveragePass.setBindGroup(0,coverageGroup);coveragePass.dispatchWorkgroups(8);coveragePass.end();coverageEnc.copyBufferToBuffer(out,0,read,0,512*16);device.queue.submit([coverageEnc.finish()]);
 await read.mapAsync(GPUMapMode.READ);const coverageValues=new Float32Array(read.getMappedRange()).slice(0,512*4);read.unmap();
 let coverageMaxError=0,averageProbeRatio=0;
 for(let i=0;i<512;i++){coverageMaxError=Math.max(coverageMaxError,coverageValues[i*4]);averageProbeRatio+=coverageValues[i*4+1]/512;}
 const report={coverageMaxError,averageProbeRatio,errors,beforeRmse:Math.sqrt(before/count),afterRmse:Math.sqrt(after/count),rampMaxChange:ramp,silhouetteMaxChange:silhouette,msPer128x96:timing.sort((a,b)=>a-b)[2],pass:coverageMaxError<.00001 && averageProbeRatio<.98 && after<before*.45 && ramp<.000001 && silhouette<.000001};
 document.querySelector('#result').textContent=JSON.stringify(report,null,2);
 out.destroy();read.destroy();
 device.destroy();
}
run().catch(e=>document.querySelector('#result').textContent=JSON.stringify({error:e.stack}));
