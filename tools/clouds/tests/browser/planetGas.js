// Actual production weather bake and shared palette, with equal-area coverage
// measurements. Readback and diagnostic globe rendering exist only in this test.
import {PlanetCloudNoise} from '../../planetCloudNoise.js';
import palette from '../../shaders/planetGasAppearance.wgsl';

async function run(){
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice();
 const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const baker=new PlanetCloudNoise(device),width=1024,height=512,size=width*height*16;
 const out=device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const readback=device.createBuffer({size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const sample=await device.createComputePipelineAsync({layout:'auto',compute:{entryPoint:'sample',module:device.createShaderModule({code:`
  @group(0) @binding(0) var weather:texture_2d_array<f32>;
  @group(0) @binding(1) var<storage,read_write> result:array<vec4<f32>>;
  @compute @workgroup_size(8,8) fn sample(@builtin(global_invocation_id) p:vec3<u32>){
   result[p.y*textureDimensions(weather).x+p.x]=textureLoad(weather,vec2<i32>(p.xy),0,0);
  }`})}});
 const measurements=[];let visible;
 for(const seed of [17,43,89]){
  const started=performance.now();
  const resource=await baker.bake({key:'probe',seed,shapeSize:16,weatherWidth:width,weatherHeight:height,weatherStyle:'hail_mary'});
  const group=device.createBindGroup({layout:sample.getBindGroupLayout(0),entries:[{binding:0,resource:resource.weatherView},{binding:1,resource:{buffer:out}}]});
  const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(sample);pass.setBindGroup(0,group);pass.dispatchWorkgroups(width/8,height/8);pass.end();
  encoder.copyBufferToBuffer(out,0,readback,0,size);device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPUMapMode.READ);const pixels=new Float32Array(readback.getMappedRange()).slice();readback.unmap();
  let total=0,rust=0,threads=0,invalid=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const weight=Math.sin((y+.5)/height*Math.PI),i=(y*width+x)*4;
   total+=weight;if(pixels[i+3]<.5)rust+=weight;if(pixels[i+2]>.55)threads+=weight;
   for(let c=0;c<4;c++)if(!Number.isFinite(pixels[i+c])||pixels[i+c]<0||pixels[i+c]>1)invalid++;
  }
  measurements.push({seed,rustCoverage:rust/total,brightThreadCoverage:threads/total,invalid,setupAndReadbackMs:performance.now()-started});
  if(seed!==89)baker.release('probe');else visible=resource;
 }
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=700;canvas.style.cssText='display:block;max-width:100%;margin:auto;background:#030605';document.body.append(canvas);
 const context=canvas.getContext('webgpu'),format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});
 const module=device.createShaderModule({code:palette+`
  @group(0) @binding(0) var weather:texture_2d_array<f32>;
  @group(0) @binding(1) var linearSampler:sampler;
  struct Vertex { @builtin(position) pos:vec4<f32>, @location(0) uv:vec2<f32> };
  @vertex fn vertex(@builtin(vertex_index) i:u32)->Vertex {
   let p=array<vec2<f32>,3>(vec2<f32>(-1,-1),vec2<f32>(3,-1),vec2<f32>(-1,3));
   var v:Vertex;v.pos=vec4<f32>(p[i],0,1);v.uv=p[i];return v;
  }
  @fragment fn fragment(v:Vertex)->@location(0) vec4<f32> {
   let xy=v.uv*vec2<f32>(1.428571,1)/.92;let r=dot(xy,xy);
   if(r>=1.0){return vec4<f32>(.001,.002,.001,1);}
   let direction=vec3<f32>(xy.x,xy.y,sqrt(1.0-r));
   let inset=.5/f32(textureDimensions(weather).y);
   let uv=vec2<f32>(fract(atan2(direction.z,direction.x)/6.283185307),clamp(acos(direction.y)/3.141592654,inset,1.0-inset));
   let gas=textureSampleLevel(weather,linearSampler,uv,0,0.0);
   let lit=.12+max(dot(direction,normalize(vec3<f32>(-.35,.55,1))),0.0)*1.2;
   return vec4<f32>(pow(gasWeatherColor(gas,7.0)*lit,vec3<f32>(1.0/2.2)),1);
  }`});
 const render=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vertex'},fragment:{module,entryPoint:'fragment',targets:[{format}]},primitive:{topology:'triangle-list'}});
 const group=device.createBindGroup({layout:render.getBindGroupLayout(0),entries:[{binding:0,resource:visible.weatherView},{binding:1,resource:device.createSampler({minFilter:'linear',magFilter:'linear',addressModeU:'repeat'})}]});
 const encoder=device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});
 pass.setPipeline(render);pass.setBindGroup(0,group);pass.draw(3);pass.end();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();
 const check=measurements.every(m=>m.rustCoverage>.05&&m.rustCoverage<.35&&m.brightThreadCoverage>.05&&m.brightThreadCoverage<.4&&m.invalid===0)&&errors.length===0;
 document.querySelector('#result').textContent=JSON.stringify({complete:true,pass:check,measurements,errors},null,2);
}
run().catch(error=>document.querySelector('#result').textContent=JSON.stringify({error:error.stack}));
