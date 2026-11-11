import current from '../../shaders/cloudsRender.wgsl';
import baseline from './cloudsRender_cell-baseline.wgsl';
import aircraft from '../../shaders/cloudAircraft.wgsl';
import terrain from '../../shaders/cloudTerrain.wgsl';
import {CloudComputeBuilder} from '../../clouds.js';
async function run(){
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice(),errors=[];
 device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const W=256,H=256,b=new CloudComputeBuilder(device,device.queue);b.createOutputTexture(W,H);
 const input=device.createTexture({size:[W,H,1],mipLevelCount:9,format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 const ground=device.createTexture({size:[W,H],format:'rgba16float',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 const output=device.createTexture({size:[W,H],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
 const read=device.createBuffer({size:W*H*8,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const half=v=>{const e=(v>>10)&31,m=v&1023;return e===0?m*2**-24:(1+m/1024)*2**(e-15);};
 const pipelines=[];
 for(const [label,source] of [['before',baseline],['after',current]]){
  const module=device.createShaderModule({code:source+'\n'+terrain+'\n'+aircraft+`
   @fragment fn shaftCheck(in:VSOut)->@location(0) vec4<f32>{
    let shaft=godRayShaft(in.uv,vec2<f32>(0.5,0.15),0,1.0,0.95,0.0,0.8);
    return vec4<f32>(shaft.x,shaft.y,0.0,1.0);
   }`});
  const pipe=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vs_main'},fragment:{module,entryPoint:'shaftCheck',targets:[{format:'rgba16float'}]}});
  const group=device.createBindGroup({layout:pipe.getBindGroupLayout(0),entries:[{binding:0,resource:device.createSampler({magFilter:'linear',minFilter:'linear',mipmapFilter:'linear'})},{binding:1,resource:input.createView({dimension:'2d-array'})},{binding:2,resource:{buffer:b.renderParams}},{binding:3,resource:ground.createView()}]});
  pipelines.push({label,pipe,group});
 }
 const rows=[];
 for(const clear of [false,true]){
  let pixels=new Uint8Array(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const u=(x+.5)/W,v=(y+.5)/H;
   const gap=[.29,.46,.63,.80].some(c=>Math.abs(u-c)<.022);
   pixels[(y*W+x)*4+3]=!clear&&v>.28&&v<.40&&u>.08&&u<.92&&!gap?255:0;
  }
  let width=W,height=H;
  for(let level=0;level<9;level++){
   device.queue.writeTexture({texture:input,mipLevel:level},pixels,{bytesPerRow:width*4},[width,height,1]);
   if(level===8)break;
   const next=new Uint8Array(width/2*height/2*4);
   for(let y=0;y<height/2;y++)for(let x=0;x<width/2;x++)for(let c=0;c<4;c++){
    next[(y*width/2+x)*4+c]=Math.round((pixels[(y*2*width+x*2)*4+c]+pixels[(y*2*width+x*2+1)*4+c]+pixels[((y*2+1)*width+x*2)*4+c]+pixels[((y*2+1)*width+x*2+1)*4+c])/4);
   }
   pixels=next;width/=2;height/=2;
  }
  for(const {label,pipe,group} of pipelines)for(const quality of label==='after'&&!clear?[0,1,2]:[2])for(const strength of [0,.5,2]){
   b._writeRenderUniforms({cam:{camPos:[0,0,0],right:[1,0,0],up:[0,1,0],fwd:[0,0,1],fovYDeg:60,aspect:1},compositeQuality:quality,terrainEnabled:false,godRaysEnabled:true,godRayStrength:strength,godRayLength:1.6,godRayFalloff:1.5});
   const enc=device.createCommandEncoder(),pass=enc.beginRenderPass({colorAttachments:[{view:output.createView(),loadOp:'clear',storeOp:'store'}]});pass.setPipeline(pipe);pass.setBindGroup(0,group);pass.draw(6);pass.end();enc.copyTextureToBuffer({texture:output},{buffer:read,bytesPerRow:W*8},[W,H]);device.queue.submit([enc.finish()]);
   await read.mapAsync(GPUMapMode.READ);const data=new Uint16Array(read.getMappedRange()).slice();read.unmap();
   let max=0,sum=0,sum2=0,n=0;
   for(let y=H*.55|0;y<H;y++)for(let x=16;x<W-16;x++){const v=half(data[(y*W+x)*4]);max=Math.max(max,v);sum+=v;sum2+=v*v;n++;}
   rows.push({label,clear,quality,strength,max,mean:sum/n,contrast:Math.sqrt(Math.max(0,sum2/n-(sum/n)**2))});
  }
 }
 const before=rows.find(r=>r.label==='before'&&!r.clear&&r.strength===2),after=rows.find(r=>r.label==='after'&&!r.clear&&r.strength===2&&r.quality===2);
 const low=rows.find(r=>r.label==='after'&&!r.clear&&r.strength===.5&&r.quality===2);
 const qualityMeans=rows.filter(r=>r.label==='after'&&!r.clear&&r.strength===2).map(r=>r.mean);
 const qualityConsistent=Math.max(...qualityMeans)/Math.min(...qualityMeans)<1.5;
 // A terrain-only ridge must block shafts without manufacturing a bright
 // emission fan from its depth discontinuity. Cloud alpha is clear here.
 const ridge=new Uint16Array(W*H*4);
 for(let y=72;y<103;y++)for(let x=20;x<W-20;x++)ridge[(y*W+x)*4+3]=0x4d00; // 20 world units
 device.queue.writeTexture({texture:ground},ridge,{bytesPerRow:W*8},[W,H]);
 const final=pipelines.find(p=>p.label==='after');
 b.setTuning({formType:1});
 b._writeRenderUniforms({cam:{camPos:[0,0,0],right:[1,0,0],up:[0,1,0],fwd:[0,0,1],fovYDeg:60,aspect:1},compositeQuality:2,terrainEnabled:true,godRaysEnabled:true,godRayStrength:2,godRayLength:1.6,godRayFalloff:1.5});
 const ridgeEnc=device.createCommandEncoder(),ridgePass=ridgeEnc.beginRenderPass({colorAttachments:[{view:output.createView(),loadOp:'clear',storeOp:'store'}]});ridgePass.setPipeline(final.pipe);ridgePass.setBindGroup(0,final.group);ridgePass.draw(6);ridgePass.end();ridgeEnc.copyTextureToBuffer({texture:output},{buffer:read,bytesPerRow:W*8},[W,H]);device.queue.submit([ridgeEnc.finish()]);
 await read.mapAsync(GPUMapMode.READ);const ridgePixels=new Uint16Array(read.getMappedRange()).slice();read.unmap();
 let ridgeLight=0,ridgeShadow=0;for(let i=0;i<W*H;i++){ridgeLight=Math.max(ridgeLight,half(ridgePixels[i*4]));ridgeShadow=Math.max(ridgeShadow,half(ridgePixels[i*4+1]));}
 const terrainBlocksWithoutEmission=ridgeLight<.00001&&ridgeShadow>.001;
 // Exercise the real soft-volume composite, not only its shaft helper. A
 // distant opaque slab must respond above the old 14% cached fog ceiling.
 const fullModule=device.createShaderModule({code:current+'\n'+terrain+'\n'+aircraft});
 const fullPipe=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:fullModule,entryPoint:'vs_main'},fragment:{module:fullModule,entryPoint:'fs_main',targets:[{format:'rgba16float'}]}});
 const fullGroup=device.createBindGroup({layout:fullPipe.getBindGroupLayout(0),entries:[{binding:0,resource:device.createSampler({magFilter:'linear',minFilter:'linear',mipmapFilter:'linear'})},{binding:1,resource:input.createView({dimension:'2d-array'})},{binding:2,resource:{buffer:b.renderParams}},{binding:3,resource:ground.createView()}]});
 const slab=new Uint8Array(W*H*4);for(let i=0;i<W*H;i++)slab.set([25,30,35,255],i*4);
 device.queue.writeTexture({texture:input},slab,{bytesPerRow:W*4},[W,H,1]);
 b.setTuning({formType:1});
 const atmosphere=[];
 for(const fogDensity of [0,.4,2]){
  b._writeRenderUniforms({cam:{camPos:[0,0,-160],right:[1,0,0],up:[0,1,0],fwd:[0,0,1],fovYDeg:60,aspect:1},boxCenter:[0,0,0],boxHalf:[18,3,18],gradeStyle:46,cloudShading:'soft',skyColor:[.3,.5,.7],lightTint:[1,1,1],shadowTint:[.3,.4,.5],fogDensity,fogHorizon:1,fogSun:.3,alphaFloor:0,godRaysEnabled:false});
  const enc=device.createCommandEncoder(),pass=enc.beginRenderPass({colorAttachments:[{view:output.createView(),loadOp:'clear',storeOp:'store'}]});pass.setPipeline(fullPipe);pass.setBindGroup(0,fullGroup);pass.draw(6);pass.end();enc.copyTextureToBuffer({texture:output},{buffer:read,bytesPerRow:W*8},[W,H]);device.queue.submit([enc.finish()]);
  await read.mapAsync(GPUMapMode.READ);const data=new Uint16Array(read.getMappedRange()).slice();read.unmap();
  let mean=0,n=0;for(let y=96;y<160;y++)for(let x=96;x<160;x++){mean+=half(data[(y*W+x)*4]);n++;}atmosphere.push({fogDensity,mean:mean/n});
 }
 const fogResponds=Math.abs(atmosphere[0].mean-atmosphere[1].mean)>.01&&Math.abs(atmosphere[1].mean-atmosphere[2].mean)>.005;
 const noClippedPlateaus=rows.filter(r=>r.label==='after').every(r=>r.max<.95);
 const pass=!errors.length&&terrainBlocksWithoutEmission&&fogResponds&&qualityConsistent&&noClippedPlateaus&&after.contrast>before.contrast*1.5&&after.max>low.max*2&&rows.filter(r=>r.clear||r.strength===0).every(r=>r.max<.00001);
 document.querySelector('#result').textContent=JSON.stringify({rows,qualityConsistent,noClippedPlateaus,atmosphere,fogResponds,ridgeLight,ridgeShadow,terrainBlocksWithoutEmission,errors,pass},null,2);device.destroy();
}
run().catch(e=>document.querySelector('#result').textContent=JSON.stringify({error:e.stack}));
