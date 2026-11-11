import current from '../../shaders/cloudsRender.wgsl';
import baseline from './cloudsRender_ray-fog-baseline.wgsl';
import terrain from '../../shaders/cloudTerrain.wgsl';
import aircraft from '../../shaders/cloudAircraft.wgsl';
import {CloudComputeBuilder} from '../../clouds.js';
async function run(){
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice(),errors=[];
 device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const W=32,H=512,rowBytes=256,b=new CloudComputeBuilder(device,device.queue);
 b.createOutputTexture(W,H);b.setTuning({formType:0,baseJitterFrac:.02});
 const input=device.createTexture({size:[1,1,1],format:'rgba16float',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 const ground=device.createTexture({size:[1,1],format:'rgba16float',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 const output=device.createTexture({size:[W,H],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
 const read=device.createBuffer({size:rowBytes*H,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const half=v=>{if(v<2**-14)return Math.round(v*2**24);const e=Math.floor(Math.log2(v));return ((e+15)<<10)+Math.round((v/2**e-1)*1024);};
 const float=v=>{const e=(v>>10)&31,m=v&1023;return e===0?m*2**-24:(1+m/1024)*2**(e-15);};
 const results=[];
 for(const [label,source] of [['before',baseline],['after',current]]){
  const module=device.createShaderModule({code:source+'\n'+terrain+'\n'+aircraft});
  const pipe=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vs_main'},fragment:{module,entryPoint:'fs_main',targets:[{format:'rgba16float'}]},primitive:{topology:'triangle-list'}});
  const group=device.createBindGroup({layout:pipe.getBindGroupLayout(0),entries:[{binding:0,resource:device.createSampler({magFilter:'linear',minFilter:'linear'})},{binding:1,resource:input.createView({dimension:'2d-array'})},{binding:2,resource:{buffer:b.renderParams}},{binding:3,resource:ground.createView()}]});
  for(const scale of [1,8])for(const altitude of [9.0851,23])for(const alpha of [.08,.4,.98]){
   b._writeRenderUniforms({box:{center:[0,6.45,0],half:[90,.75,90]},cloudScale:label==='before'?1:scale,
    cam:{camPos:[0,altitude,0],right:[1,0,0],up:[0,1,0],fwd:[0,0,1],fovYDeg:30,aspect:W/H},
    alphaFloor:0,cloudShading:'sculpted',gradeStyle:36,compositeQuality:0,fogDensity:.045,fogHorizon:.3,fogSun:.04,sunDir:[1,.3,0],terrainEnabled:false});
   device.queue.writeTexture({texture:input},new Uint16Array([half(.03*alpha),half(.04*alpha),half(.08*alpha),half(alpha)]),{},[1,1,1]);
   const e=device.createCommandEncoder(),p=e.beginRenderPass({colorAttachments:[{view:output.createView(),loadOp:'clear',storeOp:'store'}]});
   p.setPipeline(pipe);p.setBindGroup(0,group);p.draw(6);p.end();e.copyTextureToBuffer({texture:output},{buffer:read,bytesPerRow:rowBytes},[W,H]);device.queue.submit([e.finish()]);
   await read.mapAsync(GPUMapMode.READ);const data=new Uint16Array(read.getMappedRange());
   const curve=Array.from({length:H},(_,y)=>Array.from(data.slice(y*128+W*2,y*128+W*2+3),float));read.unmap();
   let curvature=0,jump=0;for(let y=2;y<H;y++)for(let c=0;c<3;c++){
    curvature=Math.max(curvature,Math.abs(curve[y][c]-2*curve[y-1][c]+curve[y-2][c]));
    jump=Math.max(jump,Math.abs(curve[y][c]-curve[y-1][c]));
   }
   results.push({label,scale,altitude,alpha,curvature,jump});
  }
 }
 const paired=results.filter(r=>r.label==='after').map(r=>({scale:r.scale,altitude:r.altitude,alpha:r.alpha,before:results.find(p=>p.label==='before'&&p.scale===r.scale&&p.altitude===r.altitude&&p.alpha===r.alpha).curvature,after:r.curvature}));
 document.querySelector('#result').textContent=JSON.stringify({results,paired,errors,pass:!errors.length&&results.filter(r=>r.label==='after').every(r=>r.curvature<.005&&r.jump<.01)&&paired.filter(p=>p.alpha===.98).every(p=>p.after<p.before*.5)},null,2);
 device.destroy();
}
run().catch(e=>document.querySelector('#result').textContent=JSON.stringify({error:e.stack}));
