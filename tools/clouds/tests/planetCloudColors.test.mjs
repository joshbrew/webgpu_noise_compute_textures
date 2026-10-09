import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cloudColorStrength,cloudColorHex,cloudColorFromHex,scaleCloudColor} from '../planetCloudColors.js';

test('cloud color picker preserves HDR brightness and scales hue independently', () => {
  const rgb = [1.5, 1.43, 1.32];
  assert.equal(cloudColorStrength(rgb), 1.5);
  assert.equal(cloudColorHex(rgb), '#fff3e0');
  assert.deepEqual(cloudColorFromHex('#8040ff', 1.5), [128/255*1.5, 64/255*1.5, 1.5]);
  assert.deepEqual(scaleCloudColor([.2,.4,.8], 2), [.5,1,2]);
  assert.deepEqual(scaleCloudColor([0,0,0], 1.2), [1.2,1.2,1.2]);
  assert.deepEqual(scaleCloudColor(rgb, -1), [0,0,0]);
  assert.equal(cloudColorHex([0,0,0]), '#ffffff');
  assert.throws(() => cloudColorFromHex('bad'), RangeError);
});

test('planet colors/opacity are prominent, live-applied and synchronized after style switches', async () => {
  const source = await readFile(new URL('../../noise/noisePlanetTest.js', import.meta.url),'utf8');
  assert.match(source, /addQuickCloudColor\('params.frontLightColor', 'Lit'\)/);
  assert.match(source, /addQuickCloudColor\('params.shadowLightColor', 'Shadow'\)/);
  assert.match(source, /registerEditorPathInput\(clouds, path, color, 'colorVec3'\)/);
  assert.match(source, /registerEditorPathInput\(clouds, path, strength, 'colorStrength'\)/);
  assert.match(source, /addCloudControl\('render.opacity', 'Ray opacity'/);
  assert.match(source, /addCloudControl\('surface.surfaceOpacity', 'Mesh opacity'/);
  assert.ok(source.indexOf("addQuickCloudColor('params.frontLightColor'") < source.indexOf("addCloudControl('shell.cloudBottom'"));
  const toggle = await readFile(new URL('../planetClouds.js', import.meta.url),'utf8');
  const button = toggle.slice(toggle.indexOf('function createPlanetCloudToggleButton'), toggle.indexOf('function createPlanetCloudStyleControl'));
  assert.match(button, /right: '12px'/);
  assert.match(button, /bottom: '64px'/);
  assert.doesNotMatch(button, /left:/);
});
