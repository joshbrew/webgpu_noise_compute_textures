import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Exercise the actual editor state transitions without creating terrain or
// a GPU. The regressions here concern staged edits and asynchronous bakes.
const source=await readFile(new URL('../../noise/noisePlanetTest.js',import.meta.url),'utf8');

test('planet motion menu exposes staged warp controls and uses readable status labels',()=>{
 assert.match(source,/addCloudTransformControl\('motion.warpAmount', 'Warp amount'/);
 assert.match(source,/addCloudTransformControl\('motion.warpSpeed', 'Warp speed'/);
 assert.match(source,/addCloudTransformControl\('motion.textureMotion', 'Cloud motion preset', 'select'/);
 assert.match(source,/addCloudTransformControl\('motion.textureScrollSpeed', 'Texture scroll speed'/);
 assert.match(source,/textureMotion: config.motion\?\.textureMotion/);
 assert.match(source,/textureScrollSpeed: config.motion\?\.textureScrollSpeed/);
 assert.match(source,/warpAmount: config.motion\?\.warpAmount/);
 assert.match(source,/warpSpeed: config.motion\?\.warpSpeed/);
 assert.match(source,/Object.assign\(cfg.motion,keptMotion\)/);
 assert.match(source,/textContent = 'Apply edits ·'/);
 assert.doesNotMatch(source,/â€/);
});
const code=source.slice(source.indexOf('  function shouldLiveApplyCloudPath('),source.indexOf('  function updateEditorPath('));
function fixture(handler=async()=>{}) {
  const window={timers:new Map(),next:0,setTimeout(fn){const id=++this.next;this.timers.set(id,fn);return id;},clearTimeout(id){this.timers.delete(id);}};
  const clouds={data:{render:{opacity:.78},style:{colorPresetId:3},textures:{weatherWidth:1024}},
    get value(){return structuredClone(this.data);},setValue(value){this.data=structuredClone(value);},showError(error){throw error;}};
  const controls=new Map([['render.opacity',[{type:'number'}]],['style.colorPresetId',[{type:'select'}]],['textures.weatherWidth',[{type:'number'}]]]);
  const make=new Function('clouds','handler','window','controls',`
    const clonePlain=structuredClone,console={error(){}};
    let liveCloudValue=clonePlain(clouds.value),liveCloudApplyHandler=handler;
    let liveCloudApplyTimer=0,liveCloudApplyChain=Promise.resolve(),pendingEdits=false,pendingCloudTextures=false;
    const editorPathInputs=new WeakMap([[clouds,controls]]),rebakeButton={},status={};
    const syncEditorPathInputs=()=>{},isCloudTextureBakePath=path=>path.startsWith('textures.');
    ${code}
    return {update:mutator=>updateEditorValue(clouds,'Numbers',mutator,{path:'render.opacity'}),
      texture:mutator=>updateEditorValue(clouds,'Resolution',mutator,{path:'textures.weatherWidth'}),
      preset:id=>updateEditorValue(clouds,'Lighting',cfg=>cfg.style.colorPresetId=id,{forceCloudLiveApply:true}),
      selector:id=>updateEditorValue(clouds,'Lighting',cfg=>cfg.style.colorPresetId=id,{path:'style.colorPresetId'}),
      markApplied,state:()=>({pendingEdits,pendingCloudTextures,button:rebakeButton.textContent,status:status.textContent}),
      settle:()=>liveCloudApplyChain};`);
  return {clouds,window,...make(clouds,handler,window,controls),
    fire(){const callbacks=[...window.timers.values()];window.timers.clear();for(const fn of callbacks)fn();}};
}

test('planet number edits wait for Apply and do not leak into preset previews',async()=>{
  const applied=[],ui=fixture(async value=>applied.push(value));
  ui.update(cfg=>cfg.render.opacity=.24);
  assert.equal(ui.window.timers.size,0);
  assert.equal(ui.state().pendingEdits,true);
  assert.equal(ui.clouds.value.render.opacity,.24);
  ui.preset(22);ui.fire();await ui.settle();
  assert.equal(applied[0].cloudConfig.style.colorPresetId,22);
  assert.equal(applied[0].cloudConfig.render.opacity,.78);
  assert.equal(ui.clouds.value.render.opacity,.24);
  assert.match(ui.state().status,/Manual edits still pending/);
  ui.markApplied();ui.preset(23);ui.fire();await ui.settle();
  assert.equal(applied[1].cloudConfig.render.opacity,.24);
  assert.equal(ui.state().pendingEdits,false);
});

test('moving a preset selector automatically previews the latest selection',async()=>{
  const applied=[],ui=fixture(async value=>applied.push(value));
  ui.selector(20);ui.selector(21);ui.selector(22);
  assert.equal(ui.window.timers.size,1);
  ui.fire();await ui.settle();
  assert.deepEqual(applied.map(x=>x.cloudConfig.style.colorPresetId),[22]);
});

test('planet preset bakes complete in order when a selection changes during a bake',async()=>{
  let finishFirst;const gate=new Promise(resolve=>finishFirst=resolve),order=[];
  const ui=fixture(async ({cloudConfig})=>{const id=cloudConfig.style.colorPresetId;order.push('start'+id);if(id===20)await gate;order.push('end'+id);});
  ui.preset(20);ui.fire();await Promise.resolve();await Promise.resolve();
  ui.preset(21);ui.fire();await Promise.resolve();
  assert.deepEqual(order,['start20']);
  finishFirst();await ui.settle();
  assert.deepEqual(order,['start20','end20','start21','end21']);
});

test('expensive texture edits remain pending and require rebuilding on Apply',()=>{
  const ui=fixture();ui.texture(cfg=>cfg.textures.weatherWidth=512);
  assert.equal(ui.window.timers.size,0);assert.equal(ui.state().pendingCloudTextures,true);
  ui.markApplied();assert.equal(ui.state().pendingCloudTextures,false);
});


test('live planet preview only freezes its sun when explicitly requested',async()=>{
 const server=await readFile(new URL('./browser/serveWeatherAnvil.mjs',import.meta.url),'utf8');
 assert.match(server,/if\(process.env.PLANET_REVIEW_FREEZE_SUN==='1'\)b.onLoad/);
 assert.match(source,/const t = performance.now\(\) \* 0.00008/);
});
