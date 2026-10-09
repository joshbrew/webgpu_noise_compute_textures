import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {advancePlanetCloudTime,planetCloudMotion} from '../planetCloudMotion.js';
import {planetCloudStyleOptions,PLANET_CLOUD_STYLES} from '../planetCloudStyles.js';

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
