// Actual MC33 extraction/render validation for controlled spherical flow.
// All clocks/readbacks here are diagnostic only, outside production rendering.
import {createPlanetCloudSurfaceLayer,updatePlanetCloudSurfaceLayer,
 updatePlanetCloudSurfaceOptions,disposePlanetCloudSurfaceLayer} from '../../planetCloudSurface.js';
import {planetCloudStyleOptions} from '../../planetCloudStyles.js';

async function run(){
 const adapter=await navigator.gpu.requestAdapter();
 const device=await adapter.requestDevice();
 const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const rows=[];
 for(const style of ['realistic','diorama','satellite','cyclonic','trade_winds','gas_giant','neptune','hail_mary']){
  const parent=document.createElement('div');parent.style.cssText='position:relative;width:192px;height:192px;display:inline-block';
  const sourceCanvas=document.createElement('canvas');sourceCanvas.width=192;sourceCanvas.height=192;parent.append(sourceCanvas);document.body.append(parent);
  device.pushErrorScope('validation');
  const layer=await createPlanetCloudSurfaceLayer({device,queue:device.queue,parent,sourceCanvas,
   getCameraState:()=>({camPos:[0,0,150],fwd:[0,0,-1],right:[1,0,0],up:[0,1,0],fovY:1,aspect:1}),getSunDir:()=>[.4,.5,1],radius:50,
   options:{...planetCloudStyleOptions(style),seed:17,animate:false,weatherWidth:512,weatherHeight:256,shapeSize:32,detailSize:16,
    surfaceAngularCells:32,surfaceRadialCells:8,surfaceMaxVertices:200000,surfaceMaxActiveCells:50000,surfaceReadbackDiagnostics:false}});
  const read=device.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  const counts=[];
  for(const [warpAmount,warpSpeed] of [[0,0],[.7,12],[2,50]]){
   updatePlanetCloudSurfaceOptions(layer,{warpAmount,warpSpeed});
   layer.animationClock={time:12,last:performance.now()*.001};
   await updatePlanetCloudSurfaceLayer(layer);await device.queue.onSubmittedWorkDone();
   const encoder=device.createCommandEncoder();encoder.copyBufferToBuffer(layer.counterBuffer,0,read,0,4);device.queue.submit([encoder.finish()]);
   await read.mapAsync(GPUMapMode.READ);counts.push(new Uint32Array(read.getMappedRange())[0]);read.unmap();
  }
  updatePlanetCloudSurfaceOptions(layer,{animate:true,textureMotion:'warp_regenerate',textureScrollSpeed:2});
  const map=layer.surfaceNoise.resources.get(layer.resourceKeys.noise);
  const originalTexture=map.weather;
  for(let frame=0;frame<3;frame++){
   layer.animationClock={...layer.animationClock,last:performance.now()*.001-.017};
   await updatePlanetCloudSurfaceLayer(layer);await device.queue.onSubmittedWorkDone();
  }
  const generatedPhase=map.weatherPhase;
  updatePlanetCloudSurfaceOptions(layer,{animate:false});
  await updatePlanetCloudSurfaceLayer(layer);await device.queue.onSubmittedWorkDone();
  const regeneration={phase:generatedPhase,paused:map.weatherPhase===generatedPhase,sameTexture:map.weather===originalTexture};
  await device.queue.onSubmittedWorkDone();
  const validation=await device.popErrorScope();if(validation)errors.push(validation.message);
  rows.push({style,counts,regeneration,pass:counts.every(n=>n>0)&&generatedPhase>0&&regeneration.paused&&regeneration.sameTexture});
  read.destroy();disposePlanetCloudSurfaceLayer(layer);parent.remove();
 }
 document.querySelector('#result').textContent=JSON.stringify({complete:true,pass:errors.length===0&&rows.every(x=>x.pass),rows,errors},null,2);
 device.destroy();
}
run().catch(error=>document.querySelector('#result').textContent=JSON.stringify({error:error.stack}));
