// Exercise the real deformation against deliberately steep filtered noise.
// A negative determinant means the sampling domain has folded through itself.
import current from '../../shaders/clouds.wgsl';
import previous from './clouds_turbulence-baseline.wgsl';
async function run(){
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice();
 const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const count=32**3,bytes=count*64;
 const field=device.createBuffer({size:128,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
 const transforms=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
 device.queue.writeBuffer(transforms,0,new Float32Array([.2,0,-.3,0,-.15,0,.25,0]));
 const tuning=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
 device.queue.writeBuffer(tuning,0,new Float32Array([5.8,6,0,0]));
 const noise=device.createTexture({dimension:'3d',size:[16,16,16],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 const values=new Uint8Array(16**3*4);let seed=17;
 for(let i=0;i<values.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;values[i]=seed>>>24;}
 device.queue.writeTexture({texture:noise},values,{bytesPerRow:64,rowsPerImage:16},[16,16,16]);
 const sampler=device.createSampler({addressModeU:'repeat',addressModeV:'repeat',addressModeW:'repeat',magFilter:'linear',minFilter:'linear'});
 const output=device.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const read=device.createBuffer({size:bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const rows=[];
 for(const [label,source] of [['previous',previous],['bounded',current]]){
  const domain=source.slice(source.indexOf('fn cachedDomainStrength()'),source.indexOf('// Bound the deformed interval'));
  const erosionEnd=source.includes('// Filter along the plane only')?source.indexOf('// Filter along the plane only'):source.includes('// Optional stylistic slices')?source.indexOf('// Optional stylistic slices'):source.indexOf('@compute @workgroup_size(8, 8, 1)');
  const erosion=source.slice(source.indexOf('fn turbulentCloudDensity('),erosionEnd);
  const module=device.createShaderModule({code:`
   struct Field {gridMin:vec4<f32>,gridSize:vec4<f32>,dimensions:vec4<u32>,volume:vec4<f32>,morphology:vec4<f32>,pattern:vec4<f32>,patternMotion:vec4<f32>,patternStyle:vec4<f32>};
   struct Box {center:vec3<f32>}; const B=Box(vec3<f32>(0.0)); const CLOUD_FROZEN_PATTERN:u32=0u;
   struct Transforms {shapeOffsetWorld:vec3<f32>,pad:f32,detailOffsetWorld:vec3<f32>,pad2:f32};
   struct Tuning {puffScale:f32,formType:f32};
   @group(0) @binding(0) var<uniform> FIELD:Field;
   @group(0) @binding(1) var<uniform> NTransform:Transforms;
   @group(0) @binding(2) var<uniform> TUNE:Tuning;
   @group(0) @binding(3) var shape3D:texture_3d<f32>;
   @group(0) @binding(4) var detail3D:texture_3d<f32>;
   @group(0) @binding(5) var sampShape:sampler;
   @group(0) @binding(6) var sampDetail:sampler;
   @group(0) @binding(7) var<storage,read_write> output:array<vec4<f32>>;
   ${domain}
   ${erosion}
   @compute @workgroup_size(64) fn probe(@builtin(global_invocation_id) id:vec3<u32>){
    if(id.x>=32768u){return;}
    let xyz=vec3<f32>(f32(id.x%32u),f32((id.x/32u)%32u),f32(id.x/1024u));
    let p=vec3<f32>(-100.0+xyz.x*6.37,xyz.y*(8.0/31.0),-100.0+xyz.z*6.13);
    // Probe above the hardware interpolation-fraction quantization scale.
    let h=0.125;
    let dx=(cachedDomainPosition(p+vec3<f32>(h,0,0))-cachedDomainPosition(p-vec3<f32>(h,0,0)))/(2.0*h);
    let dy=(cachedDomainPosition(p+vec3<f32>(0,h,0))-cachedDomainPosition(p-vec3<f32>(0,h,0)))/(2.0*h);
    let dz=(cachedDomainPosition(p+vec3<f32>(0,0,h))-cachedDomainPosition(p-vec3<f32>(0,0,h)))/(2.0*h);
    let rows=abs(dx-vec3<f32>(1,0,0))+abs(dy-vec3<f32>(0,1,0))+abs(dz-vec3<f32>(0,0,1));
    output[id.x*4u]=vec4<f32>(dot(dx,cross(dy,dz)),max(max(rows.x,rows.y),rows.z),length(cachedDomainPosition(p)-p),turbulentCloudDensity(p,vec4<f32>(0.2,0.2,1.0,0.0),0.001)/0.2);
    output[id.x*4u+1u]=vec4<f32>(dx,0);output[id.x*4u+2u]=vec4<f32>(dy,0);output[id.x*4u+3u]=vec4<f32>(dz,0);
   }`});
  const info=await module.getCompilationInfo();for(const m of info.messages)if(m.type==='error')errors.push(m.message);
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'probe'}});
  const bg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:{buffer:field}},{binding:1,resource:{buffer:transforms}},{binding:2,resource:{buffer:tuning}},
   {binding:3,resource:noise.createView()},{binding:4,resource:noise.createView()},
   {binding:5,resource:sampler},{binding:6,resource:sampler},{binding:7,resource:{buffer:output}},
  ]});
  for(const wide of [true,false])for(const amount of [0,.35,.75,1.25,1.5]){
   const data=new ArrayBuffer(128),f=new Float32Array(data),u=new Uint32Array(data);
   f.set([0,0,0,0,38,8,38,0]);u.set([128,64,128,wide?1:0],8);f[19]=amount;
   device.queue.writeBuffer(field,0,data);
   const enc=device.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bg);pass.dispatchWorkgroups(count/64);pass.end();
   enc.copyBufferToBuffer(output,0,read,0,bytes);device.queue.submit([enc.finish()]);await read.mapAsync(GPUMapMode.READ);
   const result=new Float32Array(read.getMappedRange());let minimumDeterminant=Infinity,maximumGradient=0,maximumDisplacement=0,minimumDensityRetained=1,folded=0,worst=[];
   for(let i=0;i<result.length;i+=16){if(result[i+1]>maximumGradient)worst=Array.from(result.slice(i,i+16));minimumDeterminant=Math.min(minimumDeterminant,result[i]);maximumGradient=Math.max(maximumGradient,result[i+1]);maximumDisplacement=Math.max(maximumDisplacement,result[i+2]);minimumDensityRetained=Math.min(minimumDensityRetained,result[i+3]);if(result[i]<=0)folded++;}
   read.unmap();rows.push({label,wide,amount,minimumDeterminant,maximumGradient,maximumDisplacement,minimumDensityRetained,folded,worst,
    pass:label==='previous'||(folded===0&&maximumGradient<.605&&minimumDensityRetained>.55&&(amount!==0||maximumDisplacement===0))});
  }
 }
 const negativeControl=rows.some(r=>r.label==='previous'&&r.wide&&r.amount===.75&&r.folded>0);
 const report={complete:true,pointsPerCase:count,rows,negativeControl,errors,pass:negativeControl&&rows.every(r=>r.pass)&&errors.length===0};
 document.querySelector('#result').textContent=JSON.stringify(report,null,2);
}
run().catch(error=>document.querySelector('#result').textContent=JSON.stringify({complete:true,pass:false,error:String(error.stack)}));
