import {CloudComputeBuilder} from '../../clouds.js';
async function run(){
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice(),errors=[];
 device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const builder=new CloudComputeBuilder(device,device.queue),textures=[];
 const map=(dimension,color)=>{
  const t=device.createTexture({dimension,size:[1,1,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});textures.push(t);
  device.queue.writeTexture({texture:t},new Uint8Array(color),{},[1,1,1]);return t.createView({dimension:dimension==='3d'?'3d':'2d-array'});
 };
 builder.setInputMaps({weatherView:map('2d',[255,255,0,255]),shape3DView:map('3d',[240,50,60,70]),detail3DView:map('3d',[20,30,40,255])});
 builder.createOutputTexture(1280,720);
 builder.setViewFromCamera({camPos:[0,14,8],fwd:[0,-.04,-1],aspect:1280/720,fovYDeg:60,terrainEnabled:true});
 const samples=[];
 for(let i=0;i<16;i++){
  const enc=device.createCommandEncoder();for(let j=0;j<8;j++)builder._encodeTerrainPass(enc);
  const commands=enc.finish(),start=performance.now();device.queue.submit([commands]);await device.queue.onSubmittedWorkDone();
  if(i>=4)samples.push((performance.now()-start)/8);
 }
 samples.sort((a,b)=>a-b);
 const report={complete:true,width:1280,height:720,triangles:builder._terrainMesh.count/3,medianTerrainMs:samples[6],p90TerrainMs:samples[10],errors};
 document.querySelector('#result').textContent=JSON.stringify(report,null,2);device.destroy();
}
run().catch(e=>document.querySelector('#result').textContent=JSON.stringify({error:e.stack}));
