import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PLANET_CLOUD_STYLES,planetCloudStyleOptions} from '../planetCloudStyles.js';
import {PlanetCloudNoise} from '../planetCloudNoise.js';

test('planet styles scale with radius and keep one regular shader variant',()=>{
 assert.equal(PLANET_CLOUD_STYLES.length,8);
 for(const {id} of PLANET_CLOUD_STYLES.slice(1)){
  const small=planetCloudStyleOptions(id,50),large=planetCloudStyleOptions(id,100);
  assert.equal(large.cloudBottom,small.cloudBottom*2);
  assert.equal(large.cloudTop,small.cloudTop*2);
  assert.equal(large.worldToUV,small.worldToUV/2);
  assert.equal(small.cloudRenderMode,'raymarch');
  assert.equal(small.progressiveStartup,false);
  assert.equal(small.bootstrapFrames,0);
  assert.ok(small.tuning.maxSteps<=128);
 }
 assert.deepEqual(planetCloudStyleOptions('legacy'),{});
 assert.throws(()=>planetCloudStyleOptions('unknown'),RangeError);
 assert.deepEqual(planetCloudStyleOptions('realistic',NaN),planetCloudStyleOptions('realistic',50));
 assert.ok(planetCloudStyleOptions('diorama').cloudTop>planetCloudStyleOptions('realistic').cloudTop*4);
 assert.ok(planetCloudStyleOptions('diorama').cloudTop>planetCloudStyleOptions('hemisphere').cloudTop*1.4);
});

test('styled planet warmup skips unused legacy shape and weather entries',async()=>{
 const source=await readFile(new URL('../planetClouds.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function collectPlanetNoisePipelineEntries'),source.indexOf('async function prewarmPlanetNoisePipelines'));
 const noise={weather:{},weatherG:{},weatherB:{},shape:{},detail:{}};
 const collect=new Function('mergePlain','PLANET_CLOUD_NOISE','PLANET_AURORA_NOISE',code+';return collectPlanetNoisePipelineEntries;')((a,b)=>({...a,...b}),noise,noise);
 assert.deepEqual(collect({cloudStyle:'gas_giant'}).sort(),['clearTexture','computeBlueNoise','computeWorley4D'].sort());
 assert.ok(collect({cloudStyle:'legacy'}).includes('computeAntiWorley4D'));
 assert.ok(collect({cloudStyle:'gas_giant',auroraMode:true}).includes('computeAntiWorley4D'));
});

test('styled planet close normals stay cheap and weather rotates in a continuous domain',async()=>{
 const source=await readFile(new URL('../shaders/cloudPlanet.wgsl',import.meta.url),'utf8');
 assert.match(source,/let wind=NTransform.weatherOffsetWorld/);
 assert.match(source,/moved=sphericalDriftedWorld\(p,wind\)/);
 assert.match(source,/gasWeatherDirection\(normalize\(p-B.center\)/);
 assert.match(source,/min\(sunStride,2\)/);
 assert.match(source,/clamp\(TUNE.sunSteps,1,3\)/);
 assert.doesNotMatch(source,/frameIndex.*planetPixelRandom|planetPixelRandom.*frameIndex/);
});

test('opaque planet normals retain the unsaturated shape slope without extra texture reads',async()=>{
 const source=await readFile(new URL('../shaders/cloudPlanet.wgsl',import.meta.url),'utf8');
 const normals=source.slice(source.indexOf('if(!neptune&&litSamples%normalStride'),source.indexOf('if(litSamples%sunStride'));
 assert.equal((normals.match(/planetShape\(/g)||[]).length,3);
 assert.equal((normals.match(/styledPlanetForm\(/g)||[]).length,4);
 assert.doesNotMatch(normals,/styledPlanetDensity|planetWeather|textureSample/);
 const common=await readFile(new URL('../shaders/cloudCommon.wgsl',import.meta.url),'utf8');
 const form=common.slice(common.indexOf('fn styledPlanetForm'),common.indexOf('fn styledPlanetDensity'));
 assert.match(form,/if\(cute>0\.5&&!gas\)/);
 assert.match(form,/form-=radial\*radial\*0\.16/);
 assert.doesNotMatch(form,/textureSample|for\s*\(/);
});

test('planet setup noise shares tiny stages, records dimensions/seed and releases rebakes',async()=>{
 globalThis.GPUShaderStage={COMPUTE:4};globalThis.GPUTextureUsage={TEXTURE_BINDING:4,STORAGE_BINDING:8};globalThis.GPUBufferUsage={UNIFORM:64,COPY_DST:8};
 const allocations=[],calls={compile:0,submit:0,groups:[]};
 const device={queue:{submit(){calls.submit++},writeBuffer(_b,_o,v){calls.uniform=[...v]}},
  createBindGroupLayout:x=>x,createPipelineLayout:x=>x,createShaderModule:x=>x,createBindGroup:x=>x,
  async createComputePipelineAsync(x){calls.compile++;return x},
  createTexture(desc){const r={desc,createView:x=>({r,...x}),destroy(){r.destroyed=true}};allocations.push(r);return r},
  createBuffer(){const r={destroy(){r.destroyed=true}};allocations.push(r);return r},
  createCommandEncoder:()=>({beginComputePass:()=>({setPipeline(){},setBindGroup(){},dispatchWorkgroups(...groups){calls.groups.push(groups)},end(){}}),finish:()=>({})})};
 const bake=new PlanetCloudNoise(device);
 await assert.rejects(bake.bake({key:'invalid',shapeSize:0}),RangeError);
 await Promise.all([bake.prepare(),bake.prepare()]);assert.equal(calls.compile,2);
 await bake.bake({key:'a',seed:724189,shapeSize:32,weatherWidth:64,weatherHeight:32,gas:true});
 assert.deepEqual(calls.uniform,[32,64,32,0,724189,1,0,0]);
 assert.deepEqual(calls.groups,[[8,8,8],[8,4,1]]);
 assert.equal(calls.compile,3,'gas curl compiles lazily, not during ordinary preparation');
 await bake.bake({key:'a',shapeSize:32});assert.equal(calls.compile,3);assert.equal(calls.submit,2);
 assert.ok(allocations.slice(0,3).every(r=>r.destroyed));
 await bake.bake({key:'gas-again',shapeSize:32,gas:true});assert.equal(calls.compile,3,'gas bake pipeline must be reused');
 for(const [weatherStyle,mode] of [['gas_giant',1],['neptune',2],['hail_mary',3]]){
  await bake.bake({key:weatherStyle,seed:17,shapeSize:32,weatherWidth:64,weatherHeight:32,weatherStyle});
  assert.deepEqual(calls.uniform,[32,64,32,0,17,mode,0,0]);
  assert.equal(calls.compile,3,'all gas atmospheres reuse the same pipeline');
 }
 bake.destroy();assert.ok(allocations.every(r=>r.destroyed));assert.equal(bake.resources.size,0);
});

async function styleHarness(){
 const source=await readFile(new URL('../planetClouds.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('export async function setPlanetCloudStyle'),source.indexOf('async function createPlanetCloudRendererImplementation')).replace('export async','async');
 const records={bakes:[],mcBakes:[],released:[],configured:0,warmups:0};let fail=false;
 const clone=x=>structuredClone(x),merge=(a,b)=>({...a,...b});
 const noise={destroyTexturePair:k=>records.released.push(k),destroyVolume:k=>records.released.push(k)};
 const target={radius:50,seed:123,options:{resourceNonce:'old'},resourceKeys:{weather:'w',shape:'s',detail:'d',blue:'b'},textures:{old:true},noiseBuilder:noise,
  queue:{async onSubmittedWorkDone(){}},cloudBuilder:{setInputMaps(x){records.restored=x},async ensureComputePipelineReadyAsync(){records.warmups++}}};
 const apply=new Function('planetCloudStyleOptions','clonePlain','mergePlain','cloudResourceKey','PLANET_VOLUME_MIPS','PLANET_STYLE_NOISE','bakePlanetCloudResources','configurePlanetCloudBuilder','destroyCloudHistory','setPlanetCloudSurfaceStyle',code+';return setPlanetCloudStyle;')(
  planetCloudStyleOptions,clone,merge,(o,k)=>o.resourceNonce+'-'+k,new WeakMap(),new WeakMap(),
  async(t,{options})=>{records.bakes.push(options.cloudStyle);if(fail)throw Error('bake failed');t.resourceKeys=Object.fromEntries(['weather','shape','detail','blue'].map(k=>[k,options.resourceNonce+'-'+k]));t.textures={new:true};},
  ()=>records.configured++,()=>{},async(t,style)=>{records.mcBakes.push(style);t.options={...t.options,...planetCloudStyleOptions(style,t.radius),cloudRenderMode:'mc33-shell'};return t.options});
 return {target,records,apply,setFail:x=>fail=x};
}

test('planet style switches serialize even while waiting for initial refinement',async()=>{
 const h=await styleHarness();let ready;
 h.target.refinementPromise=new Promise(resolve=>ready=resolve);
 const first=h.apply(h.target,'diorama'),second=h.apply(h.target,'realistic');
 assert.equal(h.records.bakes.length,0);ready();await Promise.all([first,second]);
 assert.deepEqual(h.records.bakes,['diorama','realistic']);assert.equal(h.target.options.cloudStyle,'realistic');
 assert.equal(h.records.warmups,2);
 assert.equal(h.target._stylePromise,null);assert.equal(h.target.styleChanging,false);
});

test('MC33 preset changes update both cached renderers and preserve the active mode',async()=>{
 const h=await styleHarness();
 const mesh={kind:'mc33-shell',radius:50,options:{cloudStyle:'realistic',cloudRenderMode:'mc33-shell'}};
 const layer={kind:'planet-cloud-render-toggle',activeMode:'mc33-shell',activeLayer:mesh,
  options:mesh.options,renderers:new Map([['raymarch',h.target],['mc33-shell',mesh]])};
 await h.apply(layer,'diorama');
 assert.deepEqual(h.records.bakes,['diorama']);assert.deepEqual(h.records.mcBakes,['diorama']);
 assert.equal(layer.options.cloudStyle,'diorama');assert.equal(layer.options.cloudRenderMode,'mc33-shell');
 assert.equal(h.target.options.cloudStyle,'diorama');assert.equal(layer._stylePromise,null);
});

test('failed planet style bake restores old maps and leaves a retry possible',async()=>{
 const h=await styleHarness();h.setFail(true);
 await assert.rejects(h.apply(h.target,'diorama'),/bake failed/);
 assert.equal(h.target.options.resourceNonce,'old');assert.deepEqual(h.records.restored,{old:true});assert.equal(h.target._stylePromise,null);
 h.setFail(false);await h.apply(h.target,'diorama');assert.equal(h.target.options.cloudStyle,'diorama');
 h.target.disposed=true;assert.equal(await h.apply(h.target,'realistic'),null);
});

test('a layer initialized in a new style can restore the unstyled custom baseline',async()=>{
 const h=await styleHarness();
 h.target.options={resourceNonce:'old',cloudStyle:'diorama',tuning:{formType:2}};
 h.target._styleBaseOptions={resourceNonce:'original',cloudStyle:'legacy',tuning:{formType:0},cloudTop:3};
 await h.apply(h.target,'legacy');
 assert.equal(h.target.options.cloudStyle,'legacy');assert.equal(h.target.options.tuning.formType,0);
 assert.equal(h.target.options.cloudTop,3);
 const source=await readFile(new URL('../planetClouds.js',import.meta.url),'utf8');
 assert.match(source,/_styleBaseOptions: customBaseOptions/);
});
