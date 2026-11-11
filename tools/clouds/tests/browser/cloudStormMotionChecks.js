// Compare fine-material evolution in real Balanced density caches. Holding the
// analytic storm pose isolates the texture motion from intentional wall spin.
import {CloudComputeBuilder} from '../../clouds.js';
import common from '../../shaders/cloudCommon.wgsl';
import aircraft from '../../shaders/cloudAircraft.wgsl';
import terrain from '../../shaders/cloudTerrain.wgsl';
import scratch from '../../shaders/cloudScratch.wgsl';
import rays from '../../shaders/clouds.wgsl';
import resolve from '../../shaders/cloudResolve.wgsl';
import fields from '../../shaders/cloudFields.wgsl';
async function run(){
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice(),errors=[];
 device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const b=new CloudComputeBuilder(device,device.queue);
 const map=(dimension,n)=>{
  const depth=dimension==='3d'?n:1,levels=1+Math.log2(n),texture=device.createTexture({dimension,size:[n,n,depth],mipLevelCount:levels,format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
  let size=n,d=depth,data=new Uint8Array(n*n*depth*4);
  for(let z=0;z<depth;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const a=x*2*Math.PI/n,c=y*2*Math.PI/n,e=z*2*Math.PI/n,i=((z*n+y)*n+x)*4;
   data.set(dimension==='3d'?[128+65*Math.sin(a*3+c*2+e*5),128+65*Math.cos(c*5+e*3)+20*Math.sin(a*11-c*7),128+70*Math.sin(e*7+a*5),128+65*Math.cos(a*5-c*3+e*2)]:[255,255,0,255],i);
  }
  for(let level=0;level<levels;level++){
   device.queue.writeTexture({texture,mipLevel:level},data,{bytesPerRow:size*4,rowsPerImage:size},[size,size,d]);
   if(size===1)break;
   const nextSize=size/2,nextDepth=Math.max(1,d/2),next=new Uint8Array(nextSize*nextSize*nextDepth*4);
   for(let z=0;z<nextDepth;z++)for(let y=0;y<nextSize;y++)for(let x=0;x<nextSize;x++)for(let ch=0;ch<4;ch++){
    let sum=0;for(let dz=0;dz<(d>1?2:1);dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)sum+=data[(((z*2+dz)*size+y*2+dy)*size+x*2+dx)*4+ch];
    next[((z*nextSize+y)*nextSize+x)*4+ch]=Math.round(sum/(d>1?8:4));
   }data=next;size=nextSize;d=nextDepth;
  }
  return texture.createView({dimension:dimension==='3d'?'3d':'2d-array'});
 };
 b.setInputMaps({weatherView:map('2d',16),shape3DView:map('3d',64),detail3DView:map('3d',32)});
 b.createOutputTexture(16,8);b.setFieldQuality('balanced');b.setBox({center:[0,10,0],half:[26,10,26],uvScale:.4});
 b.setParams({globalCoverage:1,globalDensity:6});b.setTuning({formType:12,puffScale:4.6,minOutputAlpha:0,alphaBoostAmount:0});
 b.setNoiseTransforms({shapeScale:.10,detailScale:1.1});b.setViewFromCamera({camPos:[0,4,0],fwd:[0,.6,-.8],aspect:2});
 b.setReprojSettings({enabled:0,temporalCellRate:1,temporalBlend:0});await b.dispatch();await device.queue.onSubmittedWorkDone();
 const held=fields.replace('let angle=atan2(q.z,q.x)+stormSpin();','let angle=atan2(q.z,q.x);');
 let previous=held.replace(/let fineSpin=[^;]+;/,'let fineSpin=stormSpin();')
  .replace(/let detailAdvection=[^;]+;/,'let detailAdvection=NTransform.detailOffsetWorld;')
  .replace(/let shapeAdvection=[^;]+;/,'let shapeAdvection=NTransform.shapeOffsetWorld*0.35;');
 if(held===previous)throw new Error('Motion negative control was not applied');
 const desc=b._flatStageDescriptor('buildCloudDensityField'),pipelines=[];
 for(const [label,source] of [['previous',previous],['slow',held]]){
  const module=device.createShaderModule({code:[common,aircraft,terrain,scratch,rays,resolve,source].join('\n')});
  pipelines.push({label,pipe:await device.createComputePipelineAsync({...desc,compute:{...desc.compute,module}})});
 }
 const dims=b._fieldResources.dimensions,bytes=dims[0]*dims[1]*dims[2]*8,read=device.createBuffer({size:bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 // Readback is diagnostic-only; production caches retain their original usage.
 const capture=device.createTexture({dimension:'3d',size:dims,format:'rgba16float',usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_SRC});
 const captureGroup=device.createBindGroup({layout:b._getFlatStageSetup().densityBgl,entries:[{binding:4,resource:{buffer:b._fieldParamsBuffer}},{binding:5,resource:capture.createView()}]});
 const half=v=>{const e=v>>10&31,m=v&1023;return e===0?m*2**-24:(1+m/1024)*2**(e-15);};
 const snapshot=async(pipe,time)=>{
  b.setNoiseTransforms({shapeOffsetWorld:[time*.04,0,0],detailOffsetWorld:[0,0,time*.004]});
  const enc=device.createCommandEncoder(),pass=enc.beginComputePass();b._encodeFlatFields(pass,[]);
  pass.setPipeline(pipe);pass.setBindGroup(0,b._currentBg0);pass.setBindGroup(1,b._currentBg1);pass.setBindGroup(2,captureGroup);pass.dispatchWorkgroups(...dims.map(n=>Math.ceil(n/4)));pass.end();
  enc.copyTextureToBuffer({texture:capture},{buffer:read,bytesPerRow:dims[0]*8,rowsPerImage:dims[1]},dims);device.queue.submit([enc.finish()]);
  await read.mapAsync(GPUMapMode.READ);const raw=new Uint16Array(read.getMappedRange()),values=new Float32Array(raw.length/4);for(let i=0;i<values.length;i++)values[i]=half(raw[i*4]);read.unmap();return values;
 };
 const rows=[];
 for(const form of [11,12]){
  b.setTuning({formType:form});
  for(const {label,pipe} of pipelines){
   const a=await snapshot(pipe,3),c=await snapshot(pipe,3+1/30);let delta=0,energy=0,max=0;
   for(let i=0;i<a.length;i++){const diff=Math.abs(a[i]-c[i]);delta+=diff;energy+=a[i];max=Math.max(max,diff);}
   rows.push({form,label,meanChange:delta/a.length,relativeChange:delta/energy,maxChange:max,finite:a.every(Number.isFinite)&&c.every(Number.isFinite)});
  }
 }
 const checks=[11,12].map(form=>{const old=rows.find(r=>r.form===form&&r.label==='previous'),slow=rows.find(r=>r.form===form&&r.label==='slow');return {name:'fine motion decreases in Balanced density cache',form,ratio:slow.meanChange/old.meanChange,pass:slow.meanChange>0&&slow.meanChange<old.meanChange*.35};});
 document.querySelector('#result').textContent=JSON.stringify({complete:true,dimensions:dims,uvScale:.4,frameSeconds:1/30,rows,checks,errors,pass:checks.every(c=>c.pass)&&rows.every(r=>r.finite)&&!errors.length},null,2);device.destroy();
}
run().catch(error=>document.querySelector('#result').textContent=JSON.stringify({complete:true,pass:false,error:String(error.stack)}));
