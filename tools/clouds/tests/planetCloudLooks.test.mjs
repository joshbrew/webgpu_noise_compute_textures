import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {REFERENCE_LOOK_PRESETS,SCULPTED_LOOK_IDS} from '../cloudLookPresets.js';

// Exercise the planet's actual palette converter without initializing terrain
// or Babylon. Applying a look must preserve cloud anatomy and sampling budget.
const source=await readFile(new URL('../../noise/noisePlanetTest.js',import.meta.url),'utf8');
const registry=source.slice(source.indexOf('export const CLOUD_LIGHTING_COLOR_PRESETS'),source.indexOf('function makeFullNoiseLayer')).replaceAll('export const','const');
const converter=source.slice(source.indexOf('function colorVec3FromPreset'),source.indexOf('function makeNoiseLayerFromMode'));
const convert=new Function('REFERENCE_LOOK_PRESETS','SCULPTED_LOOK_IDS',registry+converter+'return cloudColorPresetToConfigPatch;')(REFERENCE_LOOK_PRESETS,SCULPTED_LOOK_IDS);

test('planet reference looks transfer lighting without changing cloud shapes or performance',()=>{
 for(const [id,look] of Object.entries(REFERENCE_LOOK_PRESETS)){
  const patch=convert(id);
  assert.equal(patch.style.colorPresetLabel,look.label);
  assert.equal(patch.tuning.lightingFinish,SCULPTED_LOOK_IDS.includes(Number(id))?2:1);
  assert.deepEqual(Object.keys(patch).sort(),['params','style','tuning']);
  assert.deepEqual(Object.keys(patch.params).sort(),['frontLightColor','shadowLightColor','silverIntensity','sunBloom','sunColor']);
  assert.ok(patch.params.sunColor.every(Number.isFinite));
  assert.ok(Number.isFinite(patch.params.silverIntensity));
  assert.equal(patch.tuning.formType,undefined);
 }
 assert.notDeepEqual(convert('20').params.frontLightColor,convert('21').params.frontLightColor);
});
