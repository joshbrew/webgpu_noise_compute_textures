import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {REFERENCE_LOOK_PRESETS,PAINTERLY_LOOK_IDS,INK_LOOK_IDS} from '../cloudLookPresets.js';

test('camera extinction integrates distance without the per-sample lighting clamp on flat clouds',async()=>{
 const source=await readFile(new URL('../shaders/cloudLayer.wgsl',import.meta.url),'utf8');
 assert.match(source,/let integratedOD = mix_f\(rawSampleODFine, rawSampleODMacro/);
 assert.match(source,/select\(integratedOD, min\(integratedOD, max\(C.attenuationClamp, 0.001\)\), sphericalCloudMode\(\)\)/);
});

test('folded bank support is material based, preserves empty weather and never changes planet density',async()=>{
 const common=await readFile(new URL('../shaders/cloudCommon.wgsl',import.meta.url),'utf8');
 const core=common.slice(common.indexOf('fn foldedShelfCore'),common.indexOf('fn densityFromSamples'));
 assert.match(core,/sphericalCloudMode\(\) \|\| TUNE.formType > 0.5/);
 assert.doesNotMatch(core,/V\.|textureSample|wrap3D|cam|ray/);
 assert.match(core,/smoothstep\(0.44, 0.76, mass\)/);
 assert.match(core,/smoothstep\(0.07, 0.25, ph\)/);
 assert.equal((common.match(/core = max\(core, foldedShelfCore\(phD, wm, s\)\)/g)||[]).length,2,'fine and macro paths share the connected body');
});

test('new layered palettes remain appearance only and preserve all previous looks',()=>{
 for(const id of [40,41,42]){
  assert.ok(PAINTERLY_LOOK_IDS.includes(id));assert.ok(REFERENCE_LOOK_PRESETS[id]);
  for(const key of ['density','formType','shelfFlow','camera','maxSteps','renderScaleDivider'])assert.equal(REFERENCE_LOOK_PRESETS[id][key],undefined);
 }
 assert.ok(INK_LOOK_IDS.includes(40)&&INK_LOOK_IDS.includes(42));assert.ok(!INK_LOOK_IDS.includes(41));
 assert.equal(REFERENCE_LOOK_PRESETS[29].label,'Lavender Gouache');assert.equal(REFERENCE_LOOK_PRESETS[38].label,'Indigo Ink Currents');
});
