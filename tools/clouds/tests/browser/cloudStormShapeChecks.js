// Evaluate the production analytic scaffolds on the GPU independently of the
// noise textures, so a palette or camera change cannot hide a shape regression.
import fields from '../../shaders/cloudFields.wgsl';
async function run(){
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice(),errors=[];
 device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const parts=fields.slice(fields.indexOf('fn cloudSeaBody('),fields.indexOf('fn cloudTorusDistance('));
 const feature=fields.slice(fields.indexOf('fn featureWeatherBody('),fields.indexOf('// Continuous layer systems'))
   .replace(/let weather = wrap2D\([^\n]+/,'let weather = vec4<f32>(1.0,1.0,0.0,1.0);');
 const points=[],waveRows=[];
 const push=(type,x,y,z)=>{points.push(type,x,y,z);return points.length/4-1;};
 for(const level of [.4,1.8]){
  const row=[];
  for(let i=0;i<160;i++){
   const x=-2.1+(i+.5)/160*4.2,u=2.1+x,radius=4.2*(.23+.009);
   row.push(push(6,u/.94,1.6+Math.sin(u*.22)*.16+radius*level,0));
  }waveRows.push(row);
 }
 const street=[],gap=[];
 for(let i=0;i<96;i++){
  const z=-23.5+i*47/95,bend=Math.sin(z*2*Math.PI/48*2)*8.4*.045;
  street.push(push(10,-bend,4*.38,z));gap.push(push(10,4.2-bend,4*.38,z));
 }
 const eye=[],wall=[],outside=[],storm=[],curtain=[];
 for(let y=.15;y<.85;y+=.1)for(let i=0;i<64;i++){
  const a=i/64*Math.PI*2;
  eye.push(push(12,Math.cos(a)*2,y*20,Math.sin(a)*2));
  wall.push(push(12,Math.cos(a)*14,y*20,Math.sin(a)*14));
  outside.push(push(12,Math.cos(a)*30,y*20,Math.sin(a)*30));
  storm.push(push(11,Math.cos(a)*12,y*20,Math.sin(a)*12));
  curtain.push(push(11,Math.cos(a)*12,4,Math.sin(a)*12));
 }
 const spin=[];for(let i=0;i<256;i++){
  const a=i/256*Math.PI*2;spin.push(push(12,Math.cos(a)*9.8,9,Math.sin(a)*9.8));
 }
 const wallRows=[];
 for(let j=0;j<144;j++){
  const row=[],y=.15+j/143*.7;
  for(let i=0;i<=148;i++)row.push(push(12,(.18+i*.0025)*24,y*20,0));
  wallRows.push(row);
 }
 const upperDecks=[[],[]],lowerFlanks=[[],[]],deckEdges=[];
 for(let type=11;type<=12;type++)for(let i=0;i<128;i++){
  const angle=i/128*Math.PI*2;
  upperDecks[type-11].push(push(type,Math.cos(angle)*21.6,15.8,Math.sin(angle)*21.6));
  lowerFlanks[type-11].push(push(type,Math.cos(angle)*21.6,6,Math.sin(angle)*21.6));
  deckEdges.push(push(type,Math.cos(angle)*24,16,Math.sin(angle)*24));
 }
 const sea=[],seaRepeat=[],seaRepeatZ=[],seaBelow=[],seaAbove=[],seaColumns=[];
 for(let i=0;i<128;i++){
  const x=-24+(i%16)*3,z=-24+Math.floor(i/16)*6;
  sea.push(push(13,x,10.6,z));seaRepeat.push(push(13,x+48,10.6,z));
  seaRepeatZ.push(push(13,x,10.6,z+48));
  seaBelow.push(push(13,x,3,z));seaAbove.push(push(13,x,19,z));
 }
 // Recover the visible surface through density probes, then compare the local
 // relief of regions across a whole tile (no duplicated wave formula).
 for(let z=0;z<32;z++)for(let x=0;x<32;x++){
  const column=[];
  for(let y=4;y<=17;y+=.25)column.push(push(13,-24+(x+.5)*1.5,y,-24+(z+.5)*1.5));
  seaColumns.push(column);
 }
 const n=points.length/4,input=device.createBuffer({size:points.length*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
 device.queue.writeBuffer(input,0,new Float32Array(points));
 const output=device.createBuffer({size:n*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const read=device.createBuffer({size:n*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const module=device.createShaderModule({code:`
  override PHASE:f32=0.0;
  override NOISY:bool=false;
  struct Field{gridMin:vec4<f32>,gridSize:vec4<f32>,dimensions:vec4<u32>};var<private> FIELD:Field;
  struct Tuning{formType:f32,puffScale:f32};var<private> TUNE:Tuning;
  struct Transforms{shapeOffsetWorld:vec3<f32>,detailOffsetWorld:vec3<f32>,weatherScale:f32};var<private> NTransform:Transforms;
  struct Params{globalCoverage:f32};const C=Params(1.0);
  fn mix_f(a:f32,b:f32,t:f32)->f32{return mix(a,b,t);}
  fn saturate(v:f32)->f32{return clamp(v,0.0,1.0);}
  fn cloudCellRandom(id:vec2<f32>,s:f32)->f32{return 0.5;}
  ${fields.slice(fields.indexOf('fn cloudSoftUnion('),fields.indexOf('// Return fine density'))}
  ${parts} ${feature}
  @group(0) @binding(0) var<storage,read> points:array<vec4<f32>>;
  @group(0) @binding(1) var<storage,read_write> result:array<vec4<f32>>;
  @compute @workgroup_size(64) fn probe(@builtin(global_invocation_id) id:vec3<u32>){
   if(id.x>=${n}u){return;}
   let p=points[id.x];TUNE=Tuning(p.x,4.2);
   FIELD=Field(vec4<f32>(-24.0,0.0,-24.0,0.0),vec4<f32>(48.0,20.0,48.0,0.0),vec4<u32>(128u,64u,128u,0u));
   NTransform=Transforms(vec3<f32>(PHASE,0.0,0.0),vec3<f32>(0.0),1.0);
   let q=vec3<f32>(p.y*6.283185/48.0,p.z*0.8,p.w*6.283185/48.0);
   let shape=select(vec4<f32>(0.5),0.5+0.35*sin(vec4<f32>(q.x*3.0+q.z*5.0+q.y,q.x*5.0-q.z*2.0-q.y,q.x*2.0+q.z*7.0+q.y*1.7,q.x*7.0-q.z*3.0)),NOISY);
   let detail=select(vec3<f32>(0.5),0.5+0.3*sin(vec3<f32>(q.x*13.0+q.z*7.0,q.x*11.0-q.z*17.0+q.y*2.0,q.x*19.0+q.z*5.0-q.y)),NOISY);
   var body=vec3<f32>(0.0);
   if(p.x<6.5){FIELD.gridSize.y=8.0;body=featureWeatherBody(p.yzw,shape,detail,vec3<f32>(0.0,1.0,0.0));}
   else if(p.x<10.5){FIELD.gridSize.y=4.0;body=parallelCloudBandBody(p.yzw,shape,detail);}
   else if(p.x>12.5){body=cloudSeaBody(p.yzw,shape,detail);}
   else{body=rotatingStormBody(p.yzw,shape,detail);}
   result[id.x]=vec4<f32>(body,stormSpin());
  }`});
 const sample=async (phase,noisy=false)=>{
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'probe',constants:{PHASE:phase,NOISY:noisy}}});
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:input}},{binding:1,resource:{buffer:output}}]});
  const enc=device.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(n/64));pass.end();
  enc.copyBufferToBuffer(output,0,read,0,n*16);device.queue.submit([enc.finish()]);await read.mapAsync(GPUMapMode.READ);const values=new Float32Array(read.getMappedRange()).slice();read.unmap();return values;
 };
 const a=await sample(0),b=await sample(1),c=await sample(0);
 const rough=await sample(0,true);
 const mean=(indices,data=a)=>indices.reduce((sum,i)=>sum+data[i*4],0)/indices.length;
 const widths=waveRows.map(row=>row.filter(i=>a[i*4]>.1).length*4.2/160);
 const heights=seaColumns.map(column=>4+column.filter(i=>a[i*4]>.5).length*.25);
 const wallEdges=wallRows.map(row=>.18+row.findIndex(i=>a[i*4]>.3)*.0025);
 const edgeMean=wallEdges.reduce((s,v)=>s+v,0)/wallEdges.length;
 const center=(wallEdges.length-1)/2;
 const slope=wallEdges.reduce((s,v,i)=>s+(i-center)*(v-edgeMean),0)/wallEdges.reduce((s,v,i)=>s+(i-center)**2,0);
 const edgeRelief=wallEdges.map((v,i)=>v-edgeMean-slope*(i-center));
 let riffles=0,lastSlope=0;
 for(let i=1;i<wallEdges.length;i++){
  const sign=Math.sign(wallEdges[i]-wallEdges[i-1]);
  if(sign&&lastSlope&&sign!==lastSlope)riffles++;
  if(sign)lastSlope=sign;
 }
 const relief=[];
 for(let rz=0;rz<4;rz++)for(let rx=0;rx<4;rx++){
  const patch=[];
  for(let z=rz*8;z<(rz+1)*8;z++)for(let x=rx*8;x<(rx+1)*8;x++)patch.push(heights[z*32+x]);
  const avg=patch.reduce((s,v)=>s+v,0)/patch.length;
  relief.push(Math.sqrt(patch.reduce((s,v)=>s+(v-avg)**2,0)/patch.length));
 }
 const checks=[
  {name:'wave has a broad rising body beneath the crest',widths,pass:widths[0]>.9&&widths[1]>.1},
  {name:'cloud bands remain continuous along wind with open lanes',band:mean(street),gap:mean(gap),pass:mean(street)>.8&&mean(gap)<.01},
  {name:'hurricane has an empty core and dense tall eyewall',eye:mean(eye),wall:mean(wall),pass:mean(eye)<.001&&mean(wall)>.5},
  {name:'hurricane is finite outside its wall',density:mean(outside),pass:mean(outside)<.001},
  {name:'supercell has cloud mass and translucent precipitation',body:mean(storm),rain:mean(curtain),pass:mean(storm)>.15&&mean(curtain)>.002&&mean(curtain)<.15},
  {name:'spiral wall rotates with material clocks',change:Math.max(...spin.map(i=>Math.abs(a[i*4]-b[i*4]))),pass:spin.some(i=>Math.abs(a[i*4]-b[i*4])>.01)},
  {name:'cloud sea is a filled volume with open sky above',below:mean(seaBelow),above:mean(seaAbove),pass:mean(seaBelow)>.99&&mean(seaAbove)<.001},
  {name:'cloud sea repeats at the tile boundary',error:Math.max(...sea.map((i,j)=>Math.abs(a[i*4]-a[seaRepeat[j]*4]))),pass:sea.every((i,j)=>Math.abs(a[i*4]-a[seaRepeat[j]*4])<.0001)},
  {name:'cloud sea sloshes with independent phase motion',pass:sea.some(i=>Math.abs(a[i*4]-b[i*4])>.01)},
  {name:'same clock is deterministic and finite',pass:a.every((v,i)=>Number.isFinite(v)&&v===c[i])},
  {name:'surface roughness changes the sea and storm contours',pass:sea.some(i=>Math.abs(rough[i*4]-a[i*4])>.05)&&spin.some(i=>Math.abs(rough[i*4]-a[i*4])>.05)},
  {name:'rough surfaces retain the solid sea and hollow eye',below:mean(seaBelow,rough),above:mean(seaAbove,rough),eye:mean(eye,rough),pass:mean(seaBelow,rough)>.99&&mean(seaAbove,rough)<.001&&mean(eye,rough)<.001},
  {name:'rough sea still repeats and all samples stay finite',pass:sea.every((i,j)=>Math.abs(rough[i*4]-rough[seaRepeat[j]*4])<.0001)&&rough.every(Number.isFinite)},
  {name:'sea repeats along both tile axes while moving',pass:[a,b,rough].every(data=>sea.every((i,j)=>Math.abs(data[i*4]-data[seaRepeat[j]*4])<.0001&&Math.abs(data[i*4]-data[seaRepeatZ[j]*4])<.0001))},
  {name:'tile contains distinct calm and energetic swell regions',relief,pass:Math.max(...relief)>Math.min(...relief)*1.7&&Math.min(...heights)>4&&Math.max(...heights)<17},
  {name:'both storms have a broad upper canopy beyond the lower body',upper:upperDecks.map(row=>mean(row)),lower:lowerFlanks.map(row=>mean(row)),pass:upperDecks.every((row,i)=>mean(row)>.10&&mean(row)>mean(lowerFlanks[i])+.10)},
  {name:'upper spiral canopies rotate and keep finite empty edges',pass:upperDecks.every(row=>row.some(i=>Math.abs(a[i*4]-b[i*4])>.02))&&mean(deckEdges,rough)<.001},
  {name:'hurricane wall stays dense around its circumference with noise enabled',minimum:Math.min(...wall.map(i=>rough[i*4])),pass:wall.every(i=>rough[i*4]>.60)},
  {name:'hurricane has shallow close riffles instead of deep folds',riffles,relief:Math.max(...edgeRelief)-Math.min(...edgeRelief),pass:riffles>=6&&Math.max(...edgeRelief)-Math.min(...edgeRelief)<.065&&wallRows.every(row=>row.some(i=>a[i*4]>.3))},
 ];
 document.querySelector('#result').textContent=JSON.stringify({complete:true,checks,errors,pass:checks.every(c=>c.pass)&&!errors.length},null,2);device.destroy();
}
run().catch(error=>document.querySelector('#result').textContent=JSON.stringify({complete:true,pass:false,error:String(error.stack)}));
