import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFrozenPattern,frozenPatternPreset,frozenPatternIndices,FROZEN_PATTERN_PRESETS} from '../cloudFrozenPattern.js';
test('frozen pattern presets cover volumes, one plane and spaced slices on all axes',()=>{
 assert.equal(frozenPatternPreset('live').enabled,false);
 assert.equal(frozenPatternPreset('volume').axis,0);
 assert.deepEqual(frozenPatternIndices(frozenPatternPreset('plane'),64),[32]);
 assert.ok(frozenPatternIndices(frozenPatternPreset('decks'),64).length>1);
 assert.deepEqual(new Set(Object.values(FROZEN_PATTERN_PRESETS).map(p=>p.axis)),new Set([0,1,2,3]));
});
test('slice ranges and spacing remain bounded for custom subsets',()=>{
 const p=normalizeFrozenPattern({enabled:true,axis:20,first:.8,last:.1,spacing:0,thickness:-5,repeat:0,speed:Infinity});
 assert.equal(p.axis,3);assert.equal(p.first,p.last);assert.equal(p.spacing,1);
 assert.equal(p.thickness,.1);assert.equal(p.repeat,.25);assert.equal(p.speed,1);
 assert.deepEqual(frozenPatternIndices({first:.2,last:.8,spacing:3},11),[2,5,8]);
});
test('layout presets retain scroll and repeat settings without requesting recapture',()=>{
 const p=frozenPatternPreset('curtains_z',{repeat:2,speed:.5,capture:7});
 assert.equal(p.repeat,2);assert.equal(p.speed,.5);assert.equal(p.capture,7);assert.equal(p.axis,3);
});
test('every slice example has an evolving and a frozen preset',()=>{
 for(const key of ['plane','decks','curtains_x','curtains_z','sparse','subset','subset_x','subset_z']){
  const held=frozenPatternPreset(key),live=frozenPatternPreset('live_'+key);
  assert.equal(held.enabled,true);assert.equal(live.enabled,false);
  for(const property of ['axis','first','last','spacing','thickness'])assert.equal(live[property],held[property]);
 }
});
