import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {ANVIL_FORM,ANVIL_PRESET_VALUES} from '../weather/cloudAnvilLook.js';

// Run the real preset transaction without loading the page or creating a GPU.
const source = await readFile(new URL('../cloudTestThreaded.js', import.meta.url), 'utf8');
const presetSource = source.slice(source.indexOf('const CLOUD_LAYER_PRESETS ='), source.indexOf('\nfunction injectPreviewLookControls('));
const presets = new Function('ANVIL_FORM','ANVIL_PRESET_VALUES',`${presetSource}; return CLOUD_LAYER_PRESETS;`)(ANVIL_FORM,ANVIL_PRESET_VALUES);

test('sharing the anvil look preserves the standalone preset exactly',()=>{
  assert.deepEqual(presets.cumulonimbus_anvil.form,{type:3,halfY:5.8,puffScale:7,ao:.82,heightVariation:.18});
  assert.equal(presets.cumulonimbus_anvil.values['p-coverage'],.94);
  assert.equal(presets.cumulonimbus_anvil.values['p-density'],11.8);
  assert.equal(presets.cumulonimbus_anvil.values['t-fluffFactor'],4.9);
  assert.equal(presets.cumulonimbus_anvil.values['t-baseJitter'],.045);
  assert.equal(presets.cumulonimbus_anvil.values['t-topJitter'],.32);
  assert.equal(presets.cumulonimbus_anvil.values['sh-axis-y'],2.86);
  assert.equal(presets.cumulonimbus_anvil.values['de-scale'],2.05);
});

test('rare weather presets own distinct cached forms and resolved translucent edges',async()=>{
  for(const [key,type] of [['cirrus',5],['kelvin_helmholtz',6],['asperitas',7]]) {
    const preset=presets[key];
    assert.equal(preset.form.type,type);
    assert.equal(preset.form.camera.length,5);
    assert.ok(preset.values['p-density']>0);
    assert.equal(preset.values['t-alphaBoostAmount'],0);
    assert.ok(preset.values['t-minOutputAlpha']<=.02);
  }
  const fields=await readFile(new URL('../shaders/cloudFields.wgsl',import.meta.url),'utf8');
  const features=fields.slice(fields.indexOf('fn featureWeatherBody'),fields.indexOf('fn layeredWeatherBody'));
  assert.doesNotMatch(features,/wrap3D|textureSample/,'features reuse prefiltered shape/detail bands');
  assert.match(features,/openHook/);assert.match(features,/underside/);assert.match(features,/fibers/);
  assert.match(features,/max\(spacingY \* 1\.75, 0\.30\)/,'cirrus is thicker than the field sampling grid');
});

test('gallery uses five independently rotating volume masks and is centered like the donut',async()=>{
  assert.equal(presets.rotating_gallery.form.volumeShape,'gallery');
  assert.equal(presets.rotating_gallery.form.halfY,14);
  assert.match(source,/setControlValue\("v-box-cy", preview\.volumeShape === "torus" \|\| preview\.volumeShape === "gallery" \? 0/);
  const fields=await readFile(new URL('../shaders/cloudFields.wgsl',import.meta.url),'utf8');
  for(const rate of ['t*1.7','t*2.3','t*2.8','t*3.2'])assert.ok(fields.includes(rate));
});
test('Wispy High preserves translucent clouds instead of eroding and cutting them away', () => {
  const wispy = presets.wispy_high.values;
  assert.ok(wispy['t-minOutputAlpha'] < .01);
  assert.ok(wispy['t-fluffFactor'] < 2);
  assert.ok(wispy['p-coverage'] >= .75);
  assert.equal(wispy['t-alphaBoostAmount'], 0);
  assert.ok(wispy['t-raySmoothDens'] < presets.rain_shelf.values['t-raySmoothDens']);
});
const transaction = source.slice(source.indexOf('async function applyCloudLayerPreset('), source.indexOf('\nfunction syncPreviewLookInputs('));

function fixture({ failRender = false, animating = true, preset = {} } = {}) {
  const events = [], button = { textContent: '' };
  const hooks = {
    CLOUD_LAYER_PRESETS: { towering_cu: preset },
    preview: {}, weatherParams: {}, billowParams: {}, weatherBParams: {}, blueParams: {}, shapeParams: {}, detailParams: {}, tileTransforms: {},
    applyCloudLayerPresetValues: () => events.push('values'),
    setBusy: on => events.push(`busy:${on}`),
    stopVisualFpsTicker: () => events.push('ticker:stop'),
    startVisualFpsTicker: () => events.push('ticker:start'),
    rpc: async type => events.push(type),
    sendTuningNow: async () => events.push('tuning'),
    setBusyAndPaint: async () => {},
    runFrameLatest: async () => { events.push('frame'); if (failRender) throw new Error('render failed'); },
    refreshDebugPreviews: async () => events.push('debug'),
    readCloudParams: () => ({}), getReprojPayload: () => ({}), safeClone: v => v,
    useFreshFullFrameReproj: p => { p.reproj = { resetHistory: true }; },
    ensureCoarseInPayload: () => {}, $: () => button,
  };
  for (const name of ['readWeather','readWeatherG','readWeatherB','readShape','readShapeTransform','readDetail','readDetailTransform','readPreview']) hooks[name] = () => {};
  const factory = new Function(...Object.keys(hooks), `
    let animRunning = ${animating};
    let _liveAnimationUpdateTimer = 0, _liveAnimationUpdateQueued = true, _liveAnimationUpdateIncludeTransforms = true;
    return ${transaction};
  `);
  return { apply: factory(...Object.values(hooks)), events, button };
}

test('animated preset pauses before changing values and resumes only after a coherent frame', async () => {
  const { apply, events, button } = fixture();
  await apply('towering_cu');
  assert.deepEqual(events, ['busy:true','ticker:stop','stopLoop','values','bakeAll','tuning','frame','debug','setReproj','startLoop','ticker:start','busy:false']);
  assert.equal(button.textContent, 'Pause clouds');
});

test('a failed preset does not restart animation against a partially installed scene', async () => {
  const { apply, events } = fixture({ failRender: true });
  await assert.rejects(apply('towering_cu'), /render failed/);
  assert.ok(events.includes('stopLoop'));
  assert.ok(!events.includes('startLoop'));
  assert.equal(events.at(-1), 'busy:false');
});

test('all layer changes keep a paused scene paused', async () => {
  const flowing = fixture({animating:false,preset:presets.rotating_donut});
  await flowing.apply('towering_cu');
  assert.ok(!flowing.events.includes('stopLoop'));
  assert.ok(!flowing.events.includes('startLoop'));
  const paused = fixture({animating:false,preset:presets.rain_shelf});
  await paused.apply('towering_cu');
  assert.ok(!paused.events.includes('startLoop'));
});

test('the donut example restores volume bounds and clears its mask when leaving', () => {
  const ids = ['v-cx','v-cy','v-cz','v-yaw','v-pitch','v-box-cx','v-box-cz','v-box-hx','v-box-hz'];
  const values = ['-0.75','-1.2','-0.95','35','28','3','-2','18','16'];
  const controls = new Map(ids.map((id,i)=>[id,{value:values[i]}]));
  const preview = {};
  const valueSource = source.slice(source.indexOf('let savedLayerCamera ='), source.indexOf('async function applyCloudLayerPreset('));
  const apply = new Function('$','setControlValue','CLOUD_LAYER_PRESETS','preview', `${valueSource}; return applyCloudLayerPresetValues;`)(
    id=>controls.get(id),(id,value)=>controls.set(id,{value:String(value)}),presets,preview);
  apply('rotating_donut');
  assert.equal(preview.volumeShape, 'torus');
  assert.equal(controls.get('v-box-hy').value, '14');
  assert.equal(controls.get('v-box-cy').value, '0');
  apply('rain_shelf');
  assert.equal(preview.volumeShape, 'box');
  assert.deepEqual(ids.map(id=>controls.get(id).value),values);
  assert.equal(controls.get('v-box-hy').value, '0.3');
});

test('rounded preset framing and AO cannot leak back into Rain Shelf', () => {
  const cameraIds = ['v-cx','v-cy','v-cz','v-yaw','v-pitch'];
  const original = ['-0.75','-1.2','-0.95','35','28'];
  const controls = new Map(cameraIds.map((id, i) => [id, { value: original[i] }]));
  const setControl = (id, value) => controls.set(id, { value: String(value) });
  const valueSource = source.slice(source.indexOf('let savedLayerCamera ='), source.indexOf('async function applyCloudLayerPreset('));
  const apply = new Function('$','setControlValue','CLOUD_LAYER_PRESETS','preview', `${valueSource}; return applyCloudLayerPresetValues;`)(
    id => controls.get(id), setControl,
    { tower: {form:{type:2, halfY:3.6, puffScale:5, ao:.6, heightVariation:.28}}, anvil: {form:{type:3, halfY:5.8, puffScale:7, ao:.65, heightVariation:.18}}, rain: {} }, {},
  );
  apply('tower');
  assert.ok(Number(controls.get('v-cz').value) > 0);
  apply('anvil');
  apply('rain');
  assert.deepEqual(cameraIds.map(id => controls.get(id).value), original);
  assert.equal(controls.get('t-formType').value, '0');
  assert.equal(controls.get('t-aoStrength').value, '0');
  assert.equal(controls.get('v-box-hy').value, '0.3');
});
