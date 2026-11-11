// Controlled sparse fields exercise the production marcher independently of
// morphology changes. The camera advances through empty air on the same ray.
export async function checkSparseCloudSampling({builder,device,snapshot,half}){
 const reports=[];
 const module=device.createShaderModule({code:`
 @group(0) @binding(0) var density:texture_storage_3d<rgba16float,write>;
 @group(0) @binding(1) var light:texture_storage_3d<rgba16float,write>;
 @compute @workgroup_size(4,4,4) fn main(@builtin(global_invocation_id) p:vec3<u32>){
  let dims=textureDimensions(density);if(any(p>=dims)){return;}
  let q=(vec3<f32>(p)+.5)/vec3<f32>(dims);
  // Empty camera corridor, then thin, tilted wisps with changing light.
  let z=q.z*36.0-18.0;
  let window=smoothstep(2.0,3.0,z)*(1.0-smoothstep(5.0,6.0,z));
  let wave=.5+.5*sin(z*15.0+q.x*19.0+q.y*11.0);
  let d=window*pow(wave,6.0)*.55;
  textureStore(density,vec3<i32>(p),vec4<f32>(d,d,d,d));
  textureStore(light,vec3<i32>(p),vec4<f32>(.2+.7*wave,.5,.15+.8*wave,1.0));
 }`});
 const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});
 builder.setFieldQuality('low');builder.setCloudTurbulence(0);
 builder.setBox({center:[0,3,0],half:[18,3,18]});
 builder.setParams({globalDensity:1,globalCoverage:.9});
 builder.setTuning({formType:3,maxSteps:224,phaseJitter:0,minOutputAlpha:0});
 const synthesize=()=>{
  const field=builder._fieldResources;
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:field.density.createView({baseMipLevel:0,mipLevelCount:1})},
   {binding:1,resource:field.light.createView({baseMipLevel:0,mipLevelCount:1})}]});
  const enc=device.createCommandEncoder(),pass=enc.beginComputePass();
  pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(...field.dimensions.map(n=>Math.ceil(n/4)));
  builder._fieldMipGroups.forEach((groups,i)=>{pass.setPipeline(builder._fieldMipPipelines[i]);groups.forEach((g,level)=>{
   pass.setBindGroup(0,g);pass.dispatchWorkgroups(...field.dimensions.map(n=>Math.ceil(Math.max(1,n>>(level+1))/4)));});});
  pass.end();device.queue.submit([enc.finish()]);
 };
 for(const width of [18,180]){
  builder.setBox({center:[0,3,0],half:[width,3,width]});
  builder.setViewFromCamera({camPos:[0,3,8],fwd:[0,0,-1],aspect:2,fovYDeg:.01});
  await snapshot();synthesize();
  const alphas=[],colors=[];
  for(let i=0;i<17;i++){
   builder.setViewFromCamera({camPos:[0,3,8-i*.035],fwd:[0,0,-1],aspect:2,fovYDeg:.01});
   const sample=await snapshot();let a=0,c=0;
   for(let pixel=0;pixel<2048;pixel++){a+=half(sample.pixels[pixel*4+3]);c+=half(sample.pixels[pixel*4]);}
   alphas.push(a/2048);colors.push(c/2048);
  }
  const range=a=>Math.max(...a)-Math.min(...a);
  reports.push({width,alphaMin:Math.min(...alphas),alphaRange:range(alphas),redRange:range(colors),
   pass:Math.min(...alphas)>.01&&range(alphas)<.00005&&range(colors)<.0001});
  if(width===180){
   const view={camPos:[0,3,8],fwd:[.3,.07,-1],aspect:2,fovYDeg:52};
   builder.setTuning({maxSteps:224});builder.setViewFromCamera(view);await snapshot();synthesize();const normal=await snapshot();
   builder.setTuning({maxSteps:2048});await snapshot();synthesize();const fine=await snapshot();
   let alphaError=0,colorError=0;
   for(let i=0;i<normal.pixels.length;i++){
    const error=half(normal.pixels[i])-half(fine.pixels[i]);
    if(i%4===3)alphaError+=error*error;else colorError+=error*error;
   }
   reports.push({method:'grid-reconstruction',alphaRmse:Math.sqrt(alphaError/2048),colorRmse:Math.sqrt(colorError/6144),
    pass:Math.sqrt(alphaError/2048)<.02&&Math.sqrt(colorError/6144)<.04});
  }

 }
 // A smooth procedural material should not acquire temporal jumps when a
 // close camera advances in small, even increments through a transparent bank.
 builder.setBox({center:[0,3,0],half:[18,.6,18]});
 builder.setParams({globalDensity:.25,globalCoverage:.9,cloudAnvilAmount:0});
 builder.setTuning({formType:0,shelfFlow:1.5,maxSteps:224,phaseJitter:0,stepJitter:0,minOutputAlpha:0,alphaBoostAmount:0});
 const alphas=[],colors=[];
 for(let i=0;i<17;i++){
  builder.setViewFromCamera({camPos:[.23,3.15,8-i*.015],fwd:[.1,0,-1],aspect:2,fovYDeg:12});
  const sample=await snapshot();let a=0,c=0;
  for(let pixel=0;pixel<2048;pixel++){a+=half(sample.pixels[pixel*4+3]);c+=half(sample.pixels[pixel*4]);}
  alphas.push(a/2048);colors.push(c/2048);
 }
 const curvature=a=>Math.max(...a.slice(2).map((v,i)=>Math.abs(v-2*a[i+1]+a[i])));
 reports.push({method:'procedural',alphaMin:Math.min(...alphas),alphaCurvature:curvature(alphas),redCurvature:curvature(colors),
  pass:Math.max(...alphas)>.01&&curvature(alphas)<.003&&curvature(colors)<.003});
 // Invalidate the injected test field before the remaining production checks.
 builder._fieldDensitySignature=null;builder._fieldLightSignature=null;
 return reports;
}
