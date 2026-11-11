import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {advancePlanetCloudTime,planetCloudMotion,planetCloudWarp,regeneratePlanetCloudWeather} from '../planetCloudMotion.js';
import {planetCloudStyleOptions,PLANET_CLOUD_STYLES} from '../planetCloudStyles.js';

test('warp controls are independent of wind, bounded and share the paused clock',()=>{
 const baseline=planetCloudWarp({},60);
 assert.equal(baseline.warpAmount,1);
 assert.equal(planetCloudWarp({warpAmount:0,warpSpeed:0},60).warpPhase,0);
 assert.equal(planetCloudWarp({warpAmount:0},60).warpAmount,0);
 assert.equal(planetCloudWarp({warpSpeed:2},60).warpPhase,baseline.warpPhase*2);
 assert.equal(planetCloudWarp({warpSpeed:50},60).warpPhase,baseline.warpPhase*50);
 assert.equal(planetCloudWarp({warpSpeed:99},60).warpPhase,baseline.warpPhase*50);
 assert.equal(planetCloudMotion({spinSpeed:0},60).warpPhase,baseline.warpPhase);
 assert.deepEqual(planetCloudWarp({warpAmount:Infinity,warpSpeed:NaN},60),baseline);
 assert.equal(planetCloudWarp({warpAmount:99,warpSpeed:-2},60).warpAmount,2);
 const layer={options:{animate:false}};
 advancePlanetCloudTime(layer,10);
 assert.equal(planetCloudWarp({},advancePlanetCloudTime(layer,11)).warpPhase,0);
});

test('cloud clock starts locally, pauses both wind and evolution, and ignores hidden-tab jumps',()=>{
 const layer={options:{}};
 assert.equal(advancePlanetCloudTime(layer,5000),0);
 assert.equal(advancePlanetCloudTime(layer,5000.125),.125);
 layer.options.animate=false;assert.equal(advancePlanetCloudTime(layer,5010),.125);
 layer.options.animate=true;assert.equal(advancePlanetCloudTime(layer,5020),.375);
});

test('planet presets drift slowly while billows evolve independently even without wind',()=>{
 for(const {id} of PLANET_CLOUD_STYLES.slice(1)){
  const options=planetCloudStyleOptions(id,50),motion=planetCloudMotion(options,60);
  assert.ok(motion.weatherOffsetWorld[0]<.05,'less than 18 degrees of wind per minute');
  assert.equal(motion.shapeOffsetWorld[0],motion.weatherOffsetWorld[0]);
  assert.ok(motion.shapeOffsetWorld[1]>1);
  const stationary=planetCloudMotion({...options,spinSpeed:0},60);
  assert.equal(stationary.weatherOffsetWorld[0],0);assert.ok(stationary.evolution>0);
  assert.equal(planetCloudMotion({...options,evolutionSpeed:0},60).evolution,0);
 }
});

test('both renderers use the same single-read evolution and MC33 normals use cached scalar data',async()=>{
 const [ray,mc,surface]=await Promise.all(['shaders/cloudPlanet.wgsl','shaders/planetCloudSurfaceMC33.wgsl','planetCloudSurface.js'].map(x=>readFile(new URL('../'+x,import.meta.url),'utf8')));
 const body=x=>x.slice(x.indexOf('fn planetEvolvingDomain'),x.indexOf('\n}',x.indexOf('fn planetEvolvingDomain'))).replace(/\s/g,'');
 assert.equal(body(ray),body(mc));
 const normal=mc.slice(mc.indexOf('fn smooth_world_normal'),mc.indexOf('fn planetEvolvingDomain'));
 assert.match(normal,/cached_field_world/);assert.doesNotMatch(normal,/scalar_field_world|textureSample/);
 assert.match(surface,/surfaceFieldUpdateHz: 60/);assert.match(surface,/surfaceMeshUpdateHz: 60/);
 const projection=surface.slice(surface.indexOf('layer.projectBindGroups'),surface.indexOf('layer.indirectBindGroup'));
 assert.doesNotMatch(projection,/weatherView|shapeView/);
 const reserve=mc.slice(mc.indexOf('fn reserve_vertices'),mc.indexOf('fn extract_active'));
 assert.match(reserve,/atomicAdd\(&outCounter,count\)/);assert.doesNotMatch(reserve,/atomicCompareExchange|loop\s*\{/);
 assert.match(mc,/writableTriCount=min\(safeTriCount,\(params.maxVertices-base\)\/3u\)/);
});

test('clamped parallel allocations initialize every drawn vertex at capacity overflow',()=>{
 for(const capacity of [36,72,144]){
  let counter=0;const written=new Set();
  for(const count of [9,36,6,33,18,30,3,36,12]){
   const base=counter;counter+=count;
   if(base>=capacity)continue;
   const triangles=Math.min(count/3,Math.floor((capacity-base)/3));
   for(let i=0;i<triangles*3;i++)written.add(base+i);
  }
  assert.equal(written.size,Math.min(counter,capacity));
  for(let i=0;i<Math.min(counter,capacity);i++)assert.ok(written.has(i));
 }
});


test('regeneration runs each frame in place, freezes on pause and changes speed without a phase jump',()=>{
 const calls=[],noise={resources:new Map([['map',{}]]),regenerateWeather:(key,phase)=>{calls.push({key,phase});return true;}};
 const layer={options:{textureMotion:'warp_regenerate',textureScrollSpeed:1}};
 const tick=now=>regeneratePlanetCloudWeather(layer,noise,'map',advancePlanetCloudTime(layer,now));
 tick(10);tick(10.01);tick(10.02);
 assert.equal(calls.length,3);
 assert.ok(Math.abs(calls[2].phase-.00024)<1e-12);
 layer.options.textureScrollSpeed=2;tick(10.03);
 assert.ok(Math.abs(calls[3].phase-.00048)<1e-12);
 layer.options.animate=false;tick(100);assert.equal(calls.length,4);
 layer.options.animate=true;tick(100.01);assert.ok(Math.abs(calls[4].phase-.00072)<1e-12);
 layer.options.textureMotion='warp';tick(100.02);assert.equal(calls.length,5);
 layer.options.textureMotion='warp_regenerate';tick(100.03);assert.ok(Math.abs(calls[5].phase-.00096)<1e-12);
 layer.options.textureScrollSpeed=0;tick(100.04);assert.equal(calls.length,6);
 layer.options.textureScrollSpeed=Infinity;tick(100.05);assert.equal(calls.length,6);
 assert.equal(regeneratePlanetCloudWeather(layer,noise,'missing',100.06),false);
});


test('Off disables warp and regeneration while preserving independently configured drift',()=>{
 const options={textureMotion:'off',warpAmount:2,warpSpeed:50,spinSpeed:.01};
 assert.deepEqual(planetCloudWarp(options,50),{warpAmount:0,warpPhase:0});
 assert.equal(planetCloudMotion(options,50).weatherOffsetWorld[0],.5);
 const layer={options,animationClock:{time:1,last:1}};
 assert.equal(regeneratePlanetCloudWeather(layer,{resources:new Map()},'map',1),false);
});
