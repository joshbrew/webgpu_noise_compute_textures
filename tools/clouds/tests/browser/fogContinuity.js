import current from '../../shaders/cloudsRender.wgsl';
import baseline from './cloudsRender_fog-baseline.wgsl';
import terrain from '../../shaders/cloudTerrain.wgsl';
import aircraft from '../../shaders/cloudAircraft.wgsl';
import {CloudComputeBuilder} from '../../clouds.js';
async function run(){
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice(),errors=[];
 device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const count=768,texture=device.createTexture({size:[4,1],format:'rgba32float',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 device.queue.writeTexture({texture},new Float32Array([0,0,0,0,0,0,0,5,0,0,0,20,0,0,0,1000]),{},[4,1]);
 const results={};
 for(const [name,source] of [['before',baseline],['after',current]]){
  const functions=source.slice(source.indexOf('fn previewBoxInterval('),source.indexOf('// ---- faster alpha gather'));
  const blocker=source.includes('fn terrainGodRayBlocker(')?source.slice(source.indexOf('fn terrainGodRayBlocker('),source.indexOf('fn godRayShaft(')):'fn terrainGodRayBlocker(uv:vec2<f32>,d:f32)->f32{return 0.0;}';
  const out=device.createBuffer({size:count*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
  const read=device.createBuffer({size:count*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const module=device.createShaderModule({code:`
   struct State{boxHalf:vec3<f32>,boxCenter:vec3<f32>,camPos:vec3<f32>,terrain:vec4<f32>};var<private> R:State;
   @group(0) @binding(0) var terrainTexture:texture_2d<f32>;
   @group(0) @binding(1) var<storage,read_write> result:array<vec4<f32>>;
   fn inside01(uv:vec2<f32>)->f32{return select(0.0,1.0,all(uv>=vec2<f32>(0.0))&&all(uv<=vec2<f32>(1.0)));}
   ${terrain} ${functions} ${blocker}
   @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3<u32>){
    let i=id.x;if(i>=${count}u){return;}
    R.boxHalf=vec3<f32>(180.0,0.4,180.0);R.boxCenter=vec3<f32>(0.0);R.camPos=vec3<f32>(0.0,-0.8,0.0);R.terrain=vec4<f32>(1.0);
    var angle=0.05+f32(i%256u)/255.0*0.33;
    if(i>=256u && i<512u){angle=0.002+f32(i%256u)/255.0*0.0005;}
    if(i>=512u){angle=-0.4+f32(i%256u)/255.0*0.8;}
    let ray=normalize(vec3<f32>(0.0,angle,1.0));
    let path=previewAerosolPathDistance(240.0,ray,1.2,0.13)/240.0;
    let cloudDistance=previewCloudAerialDistance(ray,0.25,1.2);
    let fog=previewAerialFogAmount(cloudDistance,ray,0.4,1.2,0.5,0.2,0.3,0.13);
    let occ=terrainGodRayBlocker(vec2<f32>((f32(i%4u)+0.5)/4.0,0.5),10.0);
    result[i]=vec4<f32>(path,cloudDistance,fog,occ);
   }`});
  const pipe=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
  const group=device.createBindGroup({layout:pipe.getBindGroupLayout(0),entries:[...(name==='after'?[{binding:0,resource:texture.createView()}]:[]),{binding:1,resource:{buffer:out}}]});
  const enc=device.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(pipe);pass.setBindGroup(0,group);pass.dispatchWorkgroups(count/64);pass.end();enc.copyBufferToBuffer(out,0,read,0,count*16);device.queue.submit([enc.finish()]);
  await read.mapAsync(GPUMapMode.READ);const values=new Float32Array(read.getMappedRange()).slice();read.unmap();
  let pathCurvature=0,grazingFogJump=0,referenceError=0;
  for(let i=2;i<256;i++)pathCurvature=Math.max(pathCurvature,Math.abs(values[i*4]-2*values[(i-1)*4]+values[(i-2)*4]));
  for(let i=257;i<512;i++)grazingFogJump=Math.max(grazingFogJump,Math.abs(values[i*4+2]-values[(i-1)*4+2]));
  const half=.4,h=.6,scale=180,baseY=-half*(1.15+(2.25-1.15)*h)-.08,H=half*(.95+(2.65-.95)*h)+scale*(.010+(.022-.010)*h);
  for(let i=512;i<768;i+=7){
   const a=-.4+(i%256)/255*.8,dy=a/Math.hypot(a,1);let total=0;
   for(let j=0;j<8192;j++){
    const rel=(-.8+dy*240*(j+.5)/8192-baseY)/H;
    const density=rel<0?1/(1-rel*.16):Math.exp(-rel);
    total+=density+(.028+(.070-.028)*h)*Math.exp(-Math.max(rel,0)*(.15+(.08-.15)*h));
   }
   const band=Math.max(0,1-Math.abs(dy)*(3.15+(8.75-3.15)*h))**(1.55+(.92-1.55)*h);
   const expected=Math.min(1.3,total/8192*(.82+(1.18-.82)*h)+band*(.035+(.12-.035)*h));
   referenceError=Math.max(referenceError,Math.abs(values[i*4]-expected));
  }
  // Render the actual compositor immediately below/above its former faint
  // opacity early-out. A fog seam must not appear at a cloud-volume boundary.
  const builder=new CloudComputeBuilder(device,device.queue);builder.createOutputTexture(4,4);builder.setTuning({formType:0});
  builder._writeRenderUniforms({alphaFloor:0,gradeStyle:2,compositeQuality:0,fogDensity:.4,fogHorizon:1.2,fogSun:.5,
   box:{center:[0,0,0],half:[180,.4,180]},cam:{camPos:[0,-.8,0],right:[1,0,0],up:[0,1,0],fwd:[0,.0022,1],aspect:1,fovYDeg:.01},sunDir:[0,.2,1],terrainEnabled:false});
  const input=device.createTexture({size:[1,1,1],format:'rgba16float',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
  const target=device.createTexture({size:[4,4],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
  const renderModule=device.createShaderModule({code:source+'\n'+aircraft+'\n'+terrain});
  const renderPipe=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:renderModule,entryPoint:'vs_main'},fragment:{module:renderModule,entryPoint:'fs_main',targets:[{format:'rgba16float'}]},primitive:{topology:'triangle-list'}});
  const renderGroup=device.createBindGroup({layout:renderPipe.getBindGroupLayout(0),entries:[{binding:0,resource:device.createSampler({magFilter:'linear',minFilter:'linear',mipmapFilter:'linear'})},{binding:1,resource:input.createView({dimension:'2d-array'})},{binding:2,resource:{buffer:builder.renderParams}},{binding:3,resource:texture.createView()}]});
  const colors=[];
  const toHalf=v=>{if(v<2**-14)return Math.round(v*2**24);const e=Math.floor(Math.log2(v));return ((e+15)<<10)+Math.round((v/2**e-1)*1024);};
  const fromHalf=v=>{const e=(v>>10)&31,m=v&1023;return e===0?m*2**-24:(1+m/1024)*2**(e-15);};
  const pixels=device.createBuffer({size:1024,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  for(const alpha of [.0029,.0031]){
   device.queue.writeTexture({texture:input},new Uint16Array([toHalf(alpha*.15),toHalf(alpha*.2),toHalf(alpha*.3),toHalf(alpha)]),{},[1,1,1]);
   const encoder=device.createCommandEncoder(),render=encoder.beginRenderPass({colorAttachments:[{view:target.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:'clear',storeOp:'store'}]});
   render.setPipeline(renderPipe);render.setBindGroup(0,renderGroup);render.draw(6);render.end();encoder.copyTextureToBuffer({texture:target},{buffer:pixels,bytesPerRow:256},[4,4]);device.queue.submit([encoder.finish()]);
   await pixels.mapAsync(GPUMapMode.READ);const data=new Uint16Array(pixels.getMappedRange());colors.push(Array.from(data.slice(128,131),fromHalf));pixels.unmap();
  }
  const faintCloudJump=Math.max(...colors[0].map((v,i)=>Math.abs(v-colors[1][i])));
  // Same ray/cloud radiance with sky versus distant ground behind it. Their
  // background limits must agree even at low fog density and with cached clouds.
  let terrainHorizonJump=0;
  device.queue.writeTexture({texture},new Float32Array([0,0,0,30000,0,0,0,30000,0,0,0,30000,0,0,0,30000]),{},[4,1]);
  for(const formType of [0,1])for(const alpha of [0,.4]){
   builder.setTuning({formType});const pair=[];
   for(const enabled of [false,true]){
    builder._writeRenderUniforms({alphaFloor:0,gradeStyle:13,compositeQuality:0,cloudShading:formType?'soft':'sculpted',fogDensity:.18,fogHorizon:.3,fogSun:.5,
     box:{center:[0,10.3,0],half:[90,4.6,90]},cam:{camPos:[0,12,0],right:[1,0,0],up:[0,1,0],fwd:[0,0,1],aspect:1,fovYDeg:.01},sunDir:[1,.3,0],terrainEnabled:enabled});
    device.queue.writeTexture({texture:input},new Uint16Array([toHalf(alpha*.6),toHalf(alpha*.65),toHalf(alpha*.7),toHalf(alpha)]),{},[1,1,1]);
    const e=device.createCommandEncoder(),r=e.beginRenderPass({colorAttachments:[{view:target.createView(),loadOp:'clear',storeOp:'store'}]});
    r.setPipeline(renderPipe);r.setBindGroup(0,renderGroup);r.draw(6);r.end();e.copyTextureToBuffer({texture:target},{buffer:pixels,bytesPerRow:256},[4,4]);device.queue.submit([e.finish()]);
    await pixels.mapAsync(GPUMapMode.READ);pair.push(Array.from(new Uint16Array(pixels.getMappedRange()).slice(128,131),fromHalf));pixels.unmap();
   }
   terrainHorizonJump=Math.max(terrainHorizonJump,...pair[0].map((v,i)=>Math.abs(v-pair[1][i])));
  }
  device.queue.writeTexture({texture},new Float32Array([0,0,0,0,0,0,0,5,0,0,0,20,0,0,0,1000]),{},[4,1]);
  input.destroy();target.destroy();pixels.destroy();
  results[name]={terrainHorizonJump,faintCloudJump,pathCurvature,grazingFogJump,referenceError,terrainBlockers:Array.from({length:4},(_,i)=>values[i*4+3])};
  out.destroy();read.destroy();
 }
 results.errors=errors;results.pass=!errors.length&&results.after.terrainHorizonJump<.001&&results.after.pathCurvature<results.before.pathCurvature&&results.after.referenceError<.0001&&results.after.faintCloudJump<.001&&results.after.grazingFogJump<.002&&results.after.terrainBlockers.join()==='0,1,0,0';
 document.querySelector('#result').textContent=JSON.stringify(results,null,2);device.destroy();
}
run().catch(e=>document.querySelector('#result').textContent=JSON.stringify({error:e.stack}));
