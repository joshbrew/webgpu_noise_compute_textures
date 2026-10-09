import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeWeatherCycle, sampleWeatherCycle, cyclePreview, WEATHER_STATES, WEATHER_MAP_COUNT} from '../weather/cloudWeatherCycle.js';
import {ANVIL_FORM,ANVIL_PARAMS,ANVIL_TUNING} from '../weather/cloudAnvilLook.js';

test('mature cycling anvils use the standalone anatomy, optical thickness and occlusion',()=>{
  const phase=WEATHER_STATES.findIndex(s=>s.name==='Anvil storms');
  const state=sampleWeatherCycle(phase*420/WEATHER_STATES.length);
  assert.deepEqual(state.cloudParams,ANVIL_PARAMS);
  assert.deepEqual(state.tuning,{...ANVIL_TUNING,formType:4});
  assert.ok(Object.values(state.fieldProfile).every(v=>v===0));
  assert.equal(cyclePreview({},state,false).box.half[1],ANVIL_FORM.halfY);
  for(let t=0;t<420;t+=.25){
    const s=sampleWeatherCycle(t);
    assert.equal(s.tuning.puffScale,ANVIL_FORM.puffScale);
    assert.equal(s.tuning.towerHeightVariation,ANVIL_FORM.heightVariation);
  }
});

test('shared anvil uniforms remain continuous at every weather transition',()=>{
  for(let phase=0;phase<=WEATHER_STATES.length;phase++){
    const t=phase*420/WEATHER_STATES.length,a=sampleWeatherCycle(t-1e-4),b=sampleWeatherCycle(t+1e-4);
    for(const group of ['tuning','cloudParams'])for(const key of Object.keys(a[group]))
      assert.ok(Math.abs(a[group][key]-b[group][key])<1e-5,`${group}.${key}`);
  }
});

test('cached weather retains authored storm/detail channels and invalidates only on input changes',async()=>{
  const worker=await readFile(new URL('../cloudTest.worker.js',import.meta.url),'utf8');
  const code=worker.slice(worker.indexOf('async function configureWeatherCycle('),worker.indexOf('// NoiseTransforms'));
  const input={weatherParams:{time:.7,zoom:3},billowParams:{enabled:true,time:.2,zoom:4},weatherBParams:{enabled:true,time:.3,zoom:2}};
  const saved=structuredClone(input),bakes=[];
  class GPU {
    constructor(){this.size=256;this.signature='';this.groups=[];}
    async prepare(views,signature){this.groups=views;this.signature=signature;}
  }
  class Report {start(){return 0;}end(){}finish(){return{};}}
  const hooks={normalizeWeatherCycle,CloudWeatherGPU:GPU,CloudTimingReport:Report,WEATHER_MAP_COUNT,
    device:{},lastRunPayload:input,nb:{get2DView:key=>key},cb:{invalidateCloudFields(){}},log(){},invalidateReprojectionHistory(){},
    bakeWeather2D:async(...args)=>bakes.push(structuredClone(args)),
  };
  const configure=new Function(...Object.keys(hooks),`let weatherCycle=normalizeWeatherCycle(),weatherCycleSeconds=0,weatherCycleGPU=null,weatherCycleState=null,lastAppliedTuningSignature='';${code};return configureWeatherCycle;`)(...Object.values(hooks));
  await configure({enabled:true});
  assert.equal(bakes.length,6);
  for(const [i,args] of bakes.entries()){
    assert.equal(args[0].time,input.weatherParams.time+i*1.25);
    assert.deepEqual(args[2],input.billowParams);assert.deepEqual(args[3],input.weatherBParams);
    assert.equal(args[4].assign,false);assert.equal(args[4].waitForGpu,false);
  }
  assert.deepEqual(input,saved);
  await configure({enabled:true,weatherSeconds:60});assert.equal(bakes.length,6);
  input.billowParams.zoom=5;await configure({enabled:true});assert.equal(bakes.length,12);
  input.weatherBParams.enabled=false;await configure({enabled:true});assert.equal(bakes.length,18);
});

test('weather controls sanitize invalid periods and wrap the start hour',()=>{
  assert.deepEqual(normalizeWeatherCycle(),{enabled:false,timeOfDay:true,weatherSeconds:420,daySeconds:180,startHour:9});
  const c=normalizeWeatherCycle({enabled:true,timeOfDay:false,weatherSeconds:-1,daySeconds:Infinity,startHour:49});
  assert.deepEqual(c,{enabled:true,timeOfDay:false,weatherSeconds:30,daySeconds:180,startHour:1});
});
test('all weather systems and the loop seam blend continuously',()=>{
  for(let i=0;i<=WEATHER_STATES.length;i++) {
    const t=i*420/WEATHER_STATES.length,a=sampleWeatherCycle(t-1e-4),b=sampleWeatherCycle(t+1e-4);
    for(const k of Object.keys(a.weather)) assert.ok(Math.abs(a.weather[k]-b.weather[k])<1e-5,k);
    assert.equal(b.tuning.formType,4);
  }
  const start=sampleWeatherCycle(0),loop=sampleWeatherCycle(420);
  assert.deepEqual(start.weather,loop.weather);
});
test('shelf, overcast and wispy phases have distinct morphologies with only six maps',()=>{
  assert.equal(WEATHER_STATES.length,12);assert.equal(WEATHER_MAP_COUNT,6);
  assert.ok(!WEATHER_STATES.some(state=>state.fluctus>0),'experimental rolls stay out of the natural weather cycle');
  for(const [name,key] of [['Rain Shelf','shelf'],['Overcast stratus','deck'],['Wispy high','wisps'],['Asperitas waves','asperitas'],['Feather cirrus','cirrus']]) {
    const index=WEATHER_STATES.findIndex(s=>s.name===name),state=sampleWeatherCycle(index*420/WEATHER_STATES.length);
    assert.equal(state.fieldProfile[key],1);
  }
  for(let t=0;t<420;t+=.19) {
    const s=sampleWeatherCycle(t),total=Object.values(s.fieldProfile).reduce((a,b)=>a+b,0);
    assert.ok(total>=0&&total<=1.000001);
    assert.ok(s.mapIndex>=0&&s.mapIndex<6&&s.mapBlend>=0&&s.mapBlend<=1);
  }
  assert.deepEqual(sampleWeatherCycle(0).fieldProfile,sampleWeatherCycle(420).fieldProfile);
});
test('weather and celestial clocks are independent, finite and periodic',()=>{
  for(let t=0;t<840;t+=.13) {
    const s=sampleWeatherCycle(t);
    for(const v of [...s.lightColor,...s.shadowColor,...s.sky,s.sun.elDeg,s.sun.azDeg,s.hour,s.blend]) assert.ok(Number.isFinite(v));
    assert.ok(s.hour>=0&&s.hour<24&&s.blend>=0&&s.blend<=1);
  }
  assert.deepEqual(sampleWeatherCycle(42,{daySeconds:60}).weather,sampleWeatherCycle(42,{daySeconds:90}).weather);
  assert.notEqual(sampleWeatherCycle(42,{daySeconds:60}).hour,sampleWeatherCycle(42,{daySeconds:90}).hour);
  assert.ok(Math.abs(sampleWeatherCycle(0).hour-sampleWeatherCycle(180).hour)<1e-9);
});
test('sun-to-moon handoffs fade to zero instead of flipping a bright shadow',()=>{
  for(const hour of [6,18]) {
    const a=sampleWeatherCycle(0,{startHour:hour-1e-5}),b=sampleWeatherCycle(0,{startHour:hour+1e-5});
    assert.ok(Math.max(...a.lightColor,...b.lightColor)<1e-7);
    for(let i=0;i<3;i++) assert.ok(Math.abs(a.sky[i]-b.sky[i])<1e-5);
  }
});
test('cycle overrides do not mutate the saved scene, and TOD can stay manual',()=>{
  const base={box:{center:[3,2,-4],half:[18,2,18],uvScale:2},sun:{elDeg:35},sky:[.3,.4,.5],gradeStyle:12};
  const saved=structuredClone(base),s=sampleWeatherCycle(25),on=cyclePreview(base,s,true),off=cyclePreview(base,s,false);
  assert.deepEqual(base,saved);
  assert.equal(on.skyCycle,true);assert.equal(on.volumeShape,'box');assert.equal(on.box.center[0],3);
  assert.deepEqual(off.sun,base.sun);assert.equal(off.gradeStyle,12);assert.equal(off.skyCycle,undefined);
  assert.ok(cyclePreview(base,sampleWeatherCycle(0,{startHour:0}),true).exposure>on.exposure);
});

test('map cache allocates once and blends at 10 Hz without new per-frame resources',async()=>{
  const source=(await readFile(new URL('../weather/cloudWeatherGPU.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/,'').replace('export class','class');
  const calls={pipelines:0,textures:0,buffers:0,groups:0,submits:0,writes:[]};
  const pass={setPipeline(){},setBindGroup(){},dispatchWorkgroups(x,y){assert.equal(x*y,1024)},end(){}};
  const device={createShaderModule(){return{}},async createComputePipelineAsync(){calls.pipelines++;return{getBindGroupLayout(){return{}}}},
    createTexture(){calls.textures++;return{createView(){return{}}}},createBuffer(d){assert.equal(d.size,32);calls.buffers++;return{}},
    createBindGroup(){calls.groups++;return{}},createCommandEncoder(){return{beginComputePass(){return pass},finish(){return{}}}},
    queue:{writeBuffer(b,o,v){calls.writes.push(v[0])},submit(){calls.submits++}}};
  const Class=new Function('blendWGSL','GPUTextureUsage','GPUBufferUsage',`${source};return CloudWeatherGPU;`)('',{STORAGE_BINDING:1,TEXTURE_BINDING:2},{UNIFORM:1,COPY_DST:2});
  const gpu=new Class(device),views=Array.from({length:6},()=>({}));
  assert.equal(await gpu.prepare(views,'a'),true);assert.equal(await gpu.prepare(views,'a'),false);
  for(let i=0;i<100;i++)gpu.blend({index:9,blend:.9,mapIndex:1,mapBlend:.25},i/100);
  assert.equal(calls.submits,10);assert.equal(calls.writes.length,10);
  assert.equal(calls.writes[0],.25);
  assert.equal(await gpu.prepare(views,'b'),true);
  assert.deepEqual([calls.pipelines,calls.textures,calls.buffers,calls.groups],[1,1,1,12]);
  assert.equal(gpu.blend({index:0,blend:.5},0),true);
});

const uiSource=await readFile(new URL('../cloudTestThreaded.js',import.meta.url),'utf8');
const transaction=uiSource.slice(uiSource.indexOf('async function changeWeatherCycle('),uiSource.indexOf('// ---- wire UI & initialization ----'));
function cycleFixture({failPrepare=false}={}) {
  const events=[],controls={
    'weather-cycle-enabled':{checked:true},'weather-cycle-status':{textContent:''},
    'reproj-anim-toggle':{textContent:'Animate clouds'},
    'v-layer-preset':{id:'v-layer-preset',value:'rain_shelf'},
    'v-cx':{id:'v-cx',value:'17'},'p-density':{id:'p-density',value:'2'},
  };
  const preview={layerPreset:'rain_shelf',cam:{x:17}},tileTransforms={weatherScale:3};
  const hooks={
    $:id=>controls[id],document:{querySelectorAll:()=>[controls['v-layer-preset'],controls['v-cx'],controls['p-density']]},
    safeClone:structuredClone,preview,tileTransforms,weatherParams:{},billowParams:{},weatherBParams:{},blueParams:{},shapeParams:{},detailParams:{},
    weatherCycleConfig:()=>({enabled:true}),stopVisualFpsTicker(){},startVisualFpsTicker(){},setBusy(){},
    applyCloudLayerPreset:async()=>{events.push('preset');preview.layerPreset='cumulonimbus_anvil';controls['v-cx'].value='4';tileTransforms.weatherScale=1},
    rpc:async(type,p)=>{events.push(type);if(failPrepare&&type==='setWeatherCycle'&&p.enabled)throw new Error('prepare failed')},
    useFreshFullFrameReproj(){},ensureCoarseInPayload(){},runFrameLatest:async()=>events.push('frame'),getReprojPayload:()=>({}),readCloudParams:()=>({}),
    runBakeJobsAndFrame:async()=>events.push('restoreBake'),console:{warn(){}},
  };
  for(const name of ['readWeather','readWeatherG','readWeatherB','readBlue','readShape','readShapeTransform','readDetail','readDetailTransform','readPreview'])hooks[name]=()=>{};
  const api=new Function(...Object.keys(hooks),`let savedWeatherScene=null,weatherCycleUIBusy=false,animRunning=false,savedLayerCamera=null,savedDonutBounds=null,savedGalleryTemporal=null;${transaction};return{change:changeWeatherCycle,state:()=>({animRunning,savedWeatherScene,weatherCycleUIBusy})};`)(...Object.values(hooks));
  return{api,events,controls,preview,tileTransforms};
}
test('weather UI restores controls, scene transforms and prior paused state',async()=>{
  const f=cycleFixture();await f.api.change(true);assert.equal(f.api.state().animRunning,false);
  assert.ok(!f.events.includes('startLoop'));
  assert.ok(f.events.indexOf('setWeatherCycle')<f.events.indexOf('frame'));
  await f.api.change(false);
  assert.equal(f.controls['v-cx'].value,'17');assert.equal(f.preview.layerPreset,'rain_shelf');assert.equal(f.tileTransforms.weatherScale,3);
  assert.equal(f.api.state().animRunning,false);assert.equal(f.api.state().savedWeatherScene,null);assert.equal(f.controls['weather-cycle-enabled'].checked,false);
});
test('changing an active cycle uses cached maps without rebaking the scene',async()=>{
  const f=cycleFixture();await f.api.change(true);f.events.length=0;await f.api.change(true);
  assert.deepEqual(f.events,['setWeatherCycle']);
});
test('failed weather preparation rolls back once and leaves controls usable',async()=>{
  const f=cycleFixture({failPrepare:true});await f.api.change(true);
  assert.equal(f.preview.layerPreset,'rain_shelf');assert.equal(f.controls['v-cx'].value,'17');assert.equal(f.api.state().savedWeatherScene,null);
  assert.equal(f.api.state().weatherCycleUIBusy,false);assert.equal(f.controls['weather-cycle-enabled'].disabled,false);
  assert.equal(f.events.filter(x=>x==='restoreBake').length,1);
});
