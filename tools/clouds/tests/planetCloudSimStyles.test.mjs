import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planetCloudSimStylePatch,PLANET_CLOUD_STYLES} from '../planetCloudSimStyles.js';
import {planetCloudStyleOptions} from '../planetCloudStyles.js';
const merge=(a,b)=>{const o=structuredClone(a);for(const [k,v] of Object.entries(b))o[k]=v&&typeof v==='object'&&!Array.isArray(v)&&o[k]&&typeof o[k]==='object'?merge(o[k],v):structuredClone(v);return o};
test('simulation nested controls use the exact radius-relative production presets',()=>{
 for(const {id} of PLANET_CLOUD_STYLES.slice(1))for(const radius of [25,50,100]){
  const patch=planetCloudSimStylePatch(id,radius),p=planetCloudStyleOptions(id,radius);
  assert.equal(patch.shell.cloudTop,p.cloudTop);assert.equal(patch.render.worldToUV,p.worldToUV);
  assert.equal(patch.surface.surfaceOpacity,p.surfaceOpacity);
  assert.deepEqual(patch.params,p.params);assert.deepEqual(patch.transforms,p.transforms);assert.deepEqual(patch.tuning,p.tuning);
  assert.equal(patch.cloudRenderMode,'raymarch');assert.equal(patch.showCloudStyleControl,false);
 }
 assert.equal(planetCloudSimStylePatch().cloudStyle,'realistic');
 assert.equal(planetCloudSimStylePatch('legacy').shell,undefined);
});
test('simulation config preserves explicit overrides and selects the compact style kernel',async()=>{
 const source=await readFile(new URL('../../noise/noisePlanetTest.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function buildPlanetCloudConfig'),source.indexOf('async function setupPlanetClouds'));
 const legacy={enabled:true,shell:{cloudBottom:1,cloudTop:3,maxHalfHeight:.25},params:{globalDensity:1},tuning:{formType:0},motion:{offsets:{}},transforms:{shapeScale:.05},textures:{shapeSize:128}};
 const cfg=(style,radius)=>merge(legacy,planetCloudSimStylePatch(style,radius));
 const build=new Function('mergePlain','cloudConfigForStyle',code+';return buildPlanetCloudConfig')(merge,cfg);
 const result=build({}, {radius:100},123,{clouds:{cloudStyle:'diorama',params:{globalDensity:24}}});
 assert.equal(result.cloudOptions.cloudTop,22.5);assert.equal(result.cloudOptions.params.globalDensity,24);
 assert.equal(result.cloudOptions.tuning.formType,2);assert.equal(result.cloudOptions.transforms.shapeScale,.44);
 assert.equal(result.cloudOptions.progressiveStartup,false);assert.equal(result.cloudOptions.cloudRenderMode,'raymarch');
 assert.equal(build({}, {radius:50},123).cloudOptions.cloudStyle,'realistic');
 assert.equal(build({}, {radius:50},123,{clouds:{cloudStyle:'hail_mary'}}).cloudOptions.surfaceOpacity,.72);
 assert.equal(build({planetClouds:{activeMode:'mc33-shell'}}, {radius:50},123).cloudOptions.cloudRenderMode,'mc33-shell');
 assert.equal(build({planetClouds:null,cloudRenderMode:'mc33-shell'}, {radius:50},123).cloudOptions.cloudRenderMode,'mc33-shell');
 assert.equal(build({}, {radius:50},123,{clouds:{surface:{surfaceAngularCells:128}}}).cloudOptions.surfaceAngularCells,128);
 assert.equal(build({}, {radius:50},123,{clouds:{cloudStyle:'legacy'}}).cloudOptions.tuning.formType,0);
 assert.match(source,/await setPlanetCloudStyle\(runtime\.planetClouds,layerOptions\.cloudStyle,layerOptions\)/);
 assert.match(source,/label:'Cloud shape preset',type:'select'/);
 assert.match(source,/const \{aurora,textures,\.\.\.presetConfig\}=cloudConfigForStyle/);
 assert.match(source,/presetPanel\.append\(planetCloudStyleSelect\.wrap, quickColorPreset\.wrap/);
});
