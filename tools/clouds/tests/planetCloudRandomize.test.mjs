import test from 'node:test';
import assert from 'node:assert/strict';
import {randomizePlanetCloudConfig,randomizePlanetSceneConfig} from '../planetCloudRandomize.js';
import {PLANET_CLOUD_STYLES} from '../planetCloudSimStyles.js';
import {readFile} from 'node:fs/promises';

test('randomizing a planet cloud field preserves every selected shape, palette and motion setting',()=>{
  for(const {id:cloudStyle} of PLANET_CLOUD_STYLES){
    const original={cloudStyle,shell:{cloudTop:15},motion:{warpSpeed:4},style:{colorPresetId:41},noise:{weather:{seed:1,zoom:3},shape:{seed:2,mode:'computeFBM'}}};
    const saved=structuredClone(original),next=randomizePlanetCloudConfig(original,1234);
    assert.deepEqual(original,saved);
    for(const key of ['cloudStyle','shell','motion','style'])assert.deepEqual(next[key],original[key]);
    assert.equal(next.noise.weather.zoom,3);assert.equal(next.noise.shape.mode,'computeFBM');
    assert.notEqual(next.noise.weather.seed,original.noise.weather.seed);
    assert.equal(new Set(Object.values(next.noise).map(x=>x.seed)).size,6);
    assert.deepEqual(next,randomizePlanetCloudConfig(original,1234));
    assert.notDeepEqual(next,randomizePlanetCloudConfig(original,1235));
  }
});

test('a later preset wins while cloud randomization keeps manual edits pending',async()=>{
  const source=await readFile(new URL('../../noise/noisePlanetTest.js',import.meta.url),'utf8');
  const method=source.slice(source.indexOf('    async randomizeClouds('),source.indexOf('    syncRandomizedPlanet('))
    .trim().replace('async randomizeClouds(', 'async function randomizeClouds(').replace(/,$/,'');
  const live={cloudStyle:'cyclonic',motion:{warpSpeed:1},noise:{weather:{seed:1}}};
  const draft={...structuredClone(live),motion:{warpSpeed:7}};
  const state=new Function('randomizePlanetCloudConfig','initial','draft',`
    let liveCloudValue=initial,liveCloudApplyChain=Promise.resolve(),liveCloudApplyTimer=0;
    let pendingCloudTextures=false,pendingEdits=true;
    const window={clearTimeout(){}},clonePlain=structuredClone,syncEditorPathInputs=()=>{},setPendingEdits=()=>{pendingEdits=true};
    const clouds={value:draft,setValue(v){this.value=v}};
    ${method}
    return {randomizeClouds,select(style){liveCloudValue.cloudStyle=style;clouds.value.cloudStyle=style},
      read:()=>({live:liveCloudValue,draft:clouds.value,pendingEdits,pendingCloudTextures})};
  `)(randomizePlanetCloudConfig,live,draft);
  let entered,release,applied;
  const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  const work=state.randomizeClouds(42,async config=>{applied=config;entered();await gate});
  await started;state.select('hail_mary');release();
  assert.equal(await work,true);
  assert.equal(applied.cloudStyle,'cyclonic');assert.equal(applied.motion.warpSpeed,1);
  assert.equal(state.read().live.cloudStyle,'hail_mary');assert.equal(state.read().draft.cloudStyle,'hail_mary');
  assert.equal(state.read().draft.motion.warpSpeed,7);assert.equal(state.read().pendingEdits,true);
});

test('scene randomize varies terrain, palette and atmosphere while retaining the cloud preset',()=>{
 const original={seed:17,gradientIndex:3,noiseConfigs:[{seed:2,zoom:4,type:'computeFBM'},{seed:3,zoom:5}],
  clouds:{cloudStyle:'cyclonic',motion:{warpSpeed:7},style:{colorPresetId:41},noise:{weather:{seed:4}}},
  atmosphere:{enabled:true,height:12,intensity:8,randomizeWavelengths:false,redWaveLength:700,greenWaveLength:530,blueWaveLength:440}};
 const saved=structuredClone(original),next=randomizePlanetSceneConfig(original,42,20);
 assert.deepEqual(original,saved);assert.equal(next.seed,42);assert.notEqual(next.gradientIndex,3);
 assert.equal(next.gradient,next.gradientIndex);assert.notEqual(next.noiseConfigs[0].seed,2);
 assert.equal(next.noiseConfigs[0].zoom,4);assert.equal(next.noiseConfigs[0].type,'computeFBM');
 assert.equal(next.clouds.cloudStyle,'cyclonic');assert.deepEqual(next.clouds.motion,original.clouds.motion);
 assert.deepEqual(next.clouds.style,original.clouds.style);assert.equal(next.clouds.seed,42);
 assert.equal(next.atmosphere.height,12);assert.equal(next.atmosphere.intensity,8);
 assert.equal(next.atmosphere.randomizeWavelengths,true);assert.equal(next.atmosphereRandomizeWavelengths,true);
 for(const key of ['redWaveLength','greenWaveLength','blueWaveLength'])assert.equal(next.atmosphere[key],undefined);
 assert.deepEqual(next,randomizePlanetSceneConfig(original,42,20));
 assert.equal(randomizePlanetSceneConfig({...original,atmosphere:false},43,1).atmosphere,false);
});

test('randomized scene seeds synchronize without applying unrelated draft values',async()=>{
 const source=(await readFile(new URL('../../noise/noisePlanetTest.js',import.meta.url),'utf8')).replaceAll('\r\n','\n');
 const method=source.slice(source.indexOf('    syncRandomizedPlanet('),source.indexOf('    async flushPresetPreview('))
  .trim().replace('syncRandomizedPlanet(', 'function syncRandomizedPlanet(').replace(/,$/,'');
 const editor=value=>({value,setValue(next){this.value=next}});
 const planetRender=editor({heightScale:9,gradientIndex:1,atmosphere:{height:88,intensity:7,redWaveLength:650}});
 const planetStack=editor([{seed:4,zoom:11}]),planetNoise=editor({seed:1,gain:.9});
 const sync=new Function('randomizePlanetSceneConfig','planetRender','planetStack','planetNoise',`
  const PLANET_GRADIENTS=Array(20),syncEditorPathInputs=()=>{},refreshStackSelect=()=>{},syncSelectedStackInputs=()=>{};
  ${method};return syncRandomizedPlanet;
 `)(randomizePlanetSceneConfig,planetRender,planetStack,planetNoise);
 sync({seed:42,gradientIndex:8,gradient:8});
 assert.equal(planetRender.value.seed,42);assert.equal(planetRender.value.gradientIndex,8);
 assert.equal(planetRender.value.heightScale,9);assert.equal(planetRender.value.atmosphere.height,88);
 assert.equal(planetRender.value.atmosphere.intensity,7);assert.equal(planetStack.value[0].zoom,11);
 assert.notEqual(planetStack.value[0].seed,4);assert.equal(planetNoise.value.seed,42);assert.equal(planetNoise.value.gain,.9);
});
