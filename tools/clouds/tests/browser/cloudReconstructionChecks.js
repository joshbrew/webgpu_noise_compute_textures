// Exercise the production resolve against an analytic, smoothly curved field.
// Timings cover this reconstruction kernel only, not raymarch or demo FPS.
export async function checkCloudReconstruction(device, source) {
 const begin=source.indexOf('fn cloudCubicWeights('),end=source.indexOf('fn cloudDeDitherWeight(');
 const functions=source.slice(begin,end);
 const width=128,height=64,coarseWidth=32,coarseHeight=16;
 const alpha=(u,v)=>.45+.22*Math.sin(2*Math.PI*u)*Math.cos(2*Math.PI*v)+.12*Math.sin(4*Math.PI*u);
 // A filterable quantized input also checks that interpolation does not need
 // a higher-precision or higher-resolution cloud texture.
 const input=device.createTexture({size:[coarseWidth,coarseHeight,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 const values=new Uint8Array(coarseWidth*coarseHeight*4);
 for(let y=0;y<coarseHeight;y++)for(let x=0;x<coarseWidth;x++){
  const a=alpha((x+.5)/coarseWidth,(y+.5)/coarseHeight),i=(y*coarseWidth+x)*4;
  values.set([Math.round(a*255),Math.round(a*128),Math.round(a*64),Math.round(a*255)],i);
 }
 device.queue.writeTexture({texture:input},values,{bytesPerRow:coarseWidth*4},[coarseWidth,coarseHeight,1]);
 const output=device.createBuffer({size:width*height*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const read=device.createBuffer({size:width*height*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const shader=device.createShaderModule({code:`
 struct Settings{fieldLighting:f32,compositeQuality:u32,full:u32}; var<private> R:Settings;
 @group(0) @binding(0) var tex:texture_2d_array<f32>;
 @group(0) @binding(1) var samp:sampler;
 @group(0) @binding(2) var<storage,read_write> colors:array<vec4<f32>>;
 fn displayTextureDimensions()->vec2<f32>{return select(vec2<f32>(${width}.0,${height}.0),vec2<f32>(textureDimensions(tex)),R.full>0u);}
 fn sampleCloudRaw(uv:vec2<f32>,layer:i32)->vec4<f32>{return textureSampleLevel(tex,samp,uv,layer,0.0);}
 ${functions}
 @compute @workgroup_size(8,8) fn baseline(@builtin(global_invocation_id) id:vec3<u32>){
  colors[id.y*${width}u+id.x]=sampleCloudRaw((vec2<f32>(id.xy)+.5)/displayTextureDimensions(),0);
 }
 @compute @workgroup_size(8,8) fn resolved(@builtin(global_invocation_id) id:vec3<u32>){
  R.fieldLighting=0.0; R.compositeQuality=2u;
  colors[id.y*${width}u+id.x]=sampleCloudResolved((vec2<f32>(id.xy)+.5)/displayTextureDimensions(),0);
 }
 @compute @workgroup_size(8,8) fn cached(@builtin(global_invocation_id) id:vec3<u32>){
  R.fieldLighting=1.0; R.compositeQuality=2u;
  colors[id.y*${width}u+id.x]=sampleCloudResolved((vec2<f32>(id.xy)+.5)/displayTextureDimensions(),0);
 }
 @compute @workgroup_size(8,8) fn full(@builtin(global_invocation_id) id:vec3<u32>){
  R.fieldLighting=0.0; R.compositeQuality=2u; R.full=1u;
  colors[id.y*${width}u+id.x]=sampleCloudResolved((vec2<f32>(id.xy)+.5)/vec2<f32>(${width}.0,${height}.0),0);
 }`});
 const sampler=device.createSampler({minFilter:'linear',magFilter:'linear'}),results={};
 for(const entryPoint of ['baseline','resolved','cached','full']){
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:shader,entryPoint}});
  const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:input.createView({dimension:'2d-array'})},{binding:1,resource:sampler},{binding:2,resource:{buffer:output}}]});
  const dispatch=(copies=1)=>{const encoder=device.createCommandEncoder();for(let n=0;n<copies;n++){const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(width/8,height/8);pass.end();}return encoder;};
  const encoder=dispatch();encoder.copyBufferToBuffer(output,0,read,0,width*height*16);device.queue.submit([encoder.finish()]);
  await read.mapAsync(GPUMapMode.READ);const pixels=new Float32Array(read.getMappedRange()).slice();read.unmap();
  let squaredError=0,bounds=true;
  for(let y=4;y<height-4;y++)for(let x=4;x<width-4;x++){
   const a=pixels[(y*width+x)*4+3];squaredError+=(a-alpha((x+.5)/width,(y+.5)/height))**2;
   bounds&&=Number.isFinite(a)&&a>=0&&a<=1;
  }
  device.queue.submit([dispatch(4).finish()]);await device.queue.onSubmittedWorkDone();
  const timing=[];for(let run=0;run<3;run++){const commands=dispatch(32).finish(),start=performance.now();device.queue.submit([commands]);await device.queue.onSubmittedWorkDone();timing.push((performance.now()-start)/32);}
  results[entryPoint]={rmse:Math.sqrt(squaredError/((width-8)*(height-8))),bounded:bounds,submitToCompletionMs:timing.sort((a,b)=>a-b)[1],pixels};
 }
 const cachedUnchanged=results.cached.pixels.every((v,i)=>v===results.baseline.pixels[i]);
 const fullResolutionUnchanged=results.full.pixels.every((v,i)=>v===results.baseline.pixels[i]);
 const pass=results.resolved.rmse<results.baseline.rmse*.85&&cachedUnchanged&&fullResolutionUnchanged&&Object.values(results).every(r=>r.bounded);
 for(const result of Object.values(results))delete result.pixels;
 for(const resource of [input,output,read])resource.destroy();
 return {pass,cachedUnchanged,fullResolutionUnchanged,...results};
}
