import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ANVIL_FORM,ANVIL_PRESET_VALUES} from '../weather/cloudAnvilLook.js';
import {FROZEN_PATTERN_PRESETS} from '../cloudFrozenPattern.js';

const source=await readFile(new URL('../cloudTestThreaded.js',import.meta.url),'utf8');
const catalogSource=source.slice(source.indexOf('const CLOUD_LAYER_PRESETS ='),source.indexOf('function injectPreviewLookControls()'));
const catalog=Function('ANVIL_FORM','ANVIL_PRESET_VALUES',`${catalogSource}; return CLOUD_LAYER_PRESETS;`)(ANVIL_FORM,ANVIL_PRESET_VALUES);
const menu=source.slice(source.indexOf('<select id="v-layer-preset"'),source.indexOf('</select>',source.indexOf('<select id="v-layer-preset"')));

test('every cloud preset appears once under its actual calculation method',()=>{
  const seen=new Set();
  for(const [,label,body] of menu.matchAll(/<optgroup label="([^"]+)">([\s\S]*?)<\/optgroup>/g)){
    for(const [,key] of body.matchAll(/<option value="([^"]+)"/g)){
      assert.ok(catalog[key],key);
      assert.ok(!seen.has(key),`duplicate ${key}`);seen.add(key);
      assert.equal((catalog[key].form?.type||0)>0,label.startsWith('Cached'),key);
    }
  }
  assert.deepEqual([...seen].sort(),Object.keys(catalog).sort());
});

test('cached painted folds preserve animation and quality choices',()=>{
  const preset=catalog.cached_ink_folds;
  assert.equal(preset.form.type,9);
  for(const key of Object.keys(preset.values))assert.ok(!/anim|field-quality|render-scale|temporal-cell/.test(key),key);
  assert.equal(preset.values['sh-vel-y'],0);
  assert.notEqual(preset.values['sh-vel-x'],preset.values['de-vel-x']);
});

test('main layer categories contain complete live and frozen pattern examples',()=>{
  const patterns=Object.entries(catalog).filter(([,p])=>p.patternPreset);
  assert.equal(patterns.length,25);
  assert.match(menu,/Cached 3D volumes · Live 2D \/ 2.5D slices/);
  assert.match(menu,/Cached 3D volumes · Frozen scrolling patterns/);
  assert.match(menu,/Procedural ray layers · Live 2D \/ 2.5D slices/);
  for(const [key,p] of patterns){
    assert.ok(FROZEN_PATTERN_PRESETS[p.patternPreset],key);
    assert.equal(p.form.type>0,!key.startsWith('procedural_'),key);
    assert.equal(FROZEN_PATTERN_PRESETS[p.patternPreset].enabled,key.startsWith('frozen_'),key);
    assert.equal(p.form.camera.length,5);assert.equal(p.form.span,180);
  }
});

 test('curated sky scenes and finite storms cover both methods without changing render budgets',()=>{
   const demos=Object.values(catalog).filter(p=>p.demoGrade!==undefined);
   assert.equal(demos.length,15);
   assert.equal(demos.filter(p=>p.form.type>0).length,11);
   assert.equal(demos.filter(p=>p.form.type===0).length,4);
   for(const demo of demos){
     assert.ok(demo.form.span>=36);assert.ok(demo.form.halfY>0);
     assert.equal(demo.form.camera.length,5);
     for(const key of Object.keys(demo.values))assert.ok(!/anim|field-quality|render-scale|temporal-cell/.test(key),key);
   }
 });
