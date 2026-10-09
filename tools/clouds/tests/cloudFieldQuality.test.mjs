import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CLOUD_FIELD_QUALITIES,normalizeCloudFieldQuality,cloudFieldDeviceDescriptor,supportsCloudFieldQuality} from '../cloudFieldQuality.js';
import {cyclePreview,sampleWeatherCycle} from '../weather/cloudWeatherCycle.js';

test('quality presets keep the old default and expose higher capture budgets',()=>{
 assert.equal(normalizeCloudFieldQuality(undefined),'balanced');
 assert.equal(normalizeCloudFieldQuality('bad'),'balanced');
  assert.equal(normalizeCloudFieldQuality('ultra'),'ultra');
 assert.equal(normalizeCloudFieldQuality('cinematic'),'cinematic');
 assert.equal(normalizeCloudFieldQuality('reference'),'reference');
 assert.deepEqual(CLOUD_FIELD_QUALITIES.balanced.dimensions,[128,64,128]);
 const memory=key=>CLOUD_FIELD_QUALITIES[key].dimensions.reduce((a,b)=>a*b,16)/1024**2;
 assert.equal(memory('balanced'),16);assert.equal(memory('high'),54);assert.equal(memory('ultra'),128);
 assert.equal(memory('cinematic'),432);assert.equal(memory('reference'),1024);
 for(const preset of Object.values(CLOUD_FIELD_QUALITIES)){
  assert.ok(preset.dimensions.every(v=>v%4===0&&v<=512));assert.ok(Object.isFrozen(preset.dimensions));
 }
});

test('capture tiers respect texture and staging limits without asking for the adapter maximum',()=>{
 const defaultLimits={maxTextureDimension3D:2048,maxBufferSize:256*1024**2};
 assert.ok(supportsCloudFieldQuality('cinematic',defaultLimits));
 assert.equal(supportsCloudFieldQuality('reference',defaultLimits),false);
 assert.deepEqual(cloudFieldDeviceDescriptor(defaultLimits),{});
 const adapterLimits={...defaultLimits,maxBufferSize:2*1024**3};
 const descriptor=cloudFieldDeviceDescriptor(adapterLimits);
 assert.deepEqual(descriptor,{requiredLimits:{maxBufferSize:512*1024**2}});
 assert.ok(supportsCloudFieldQuality('reference',{...defaultLimits,...descriptor.requiredLimits}));
 assert.equal(supportsCloudFieldQuality('cinematic',{...adapterLimits,maxTextureDimension3D:256}),false);
 assert.equal(supportsCloudFieldQuality('bad',adapterLimits),false);
 assert.equal(adapterLimits.maxBufferSize,2*1024**3);
});

test('quick sky span installs both extents before rendering and preserves vertical bounds through weather',async()=>{
 const ui=await readFile(new URL('../cloudTestThreaded.js',import.meta.url),'utf8');
 const start=ui.indexOf('const updateSkySpan ='),end=ui.indexOf('$("quick-sky-span")?.addEventListener',start);
 const values=new Map([['quick-sky-span',{value:'72'}],['v-box-hy',{value:'5.8'}]]),events=[];
 const update=new Function('$','setFieldValue','dispatchInput',`${ui.slice(start,end)};return updateSkySpan;`)(
  id=>values.get(id),(id,value)=>values.set(id,{value}),id=>events.push([id,values.get('v-box-hx').value,values.get('v-box-hz').value]));
 update();assert.deepEqual(events,[['v-box-hx',36,36]]);assert.equal(values.get('v-box-hy').value,'5.8');
 values.get('quick-sky-span').value='bad';update();assert.equal(events.length,1);
 const base={fieldQuality:'ultra',box:{center:[2,5.5,-3],half:[36,5.8,42],uvScale:1}};
 const preview=cyclePreview(base,sampleWeatherCycle(105),false);
 assert.deepEqual(preview.box.half,[36,5.8,42]);assert.equal(preview.fieldQuality,'ultra');
});

test('field quality reaches the worker and reseeds temporal history in manual and cycling scenes',async()=>{
 const worker=await readFile(new URL('../cloudTest.worker.js',import.meta.url),'utf8');
 const start=worker.indexOf('function makeViewSignature('),end=worker.indexOf('\nfunction ',start+10);
 const signature=new Function('roundSig','makeColorSignature','normalizeTemporalCellRate','previewRenderScaleDivider',`${worker.slice(start,end)};return makeViewSignature;`)(
  v=>v,a=>String(a),v=>v,p=>p.renderScaleDivider||4);
 for(const weatherCycle of [false,true]){
  const preview={weatherCycle,cam:{x:1,y:2,z:3},fieldQuality:'balanced'};
  const before=signature(preview,1920,1080);
  assert.equal(before,signature({...preview},1920,1080));
  for(const fieldQuality of ['ultra','cinematic','reference'])
   assert.notEqual(before,signature({...preview,fieldQuality},1920,1080));
  assert.notEqual(before,signature({...preview,cloudTurbulence:0},1920,1080));
  assert.notEqual(before,signature({...preview,cloudTurbulence:1.25},1920,1080));
 }
 assert.match(worker,/cb.setFieldQuality\(preview\?\.fieldQuality \|\| 'balanced'\)/);
 assert.match(worker,/cb.setCloudTurbulence\(preview\?\.cloudTurbulence \?\? .75\)/);
 const ui=await readFile(new URL('../cloudTestThreaded.js',import.meta.url),'utf8');
 assert.match(ui,/cloneOptions\("v-field-quality", "quick-field-quality"\)/);
 assert.match(ui,/preview.fieldQuality = normalizeCloudFieldQuality/);
 assert.match(ui,/"v-field-quality"\)\?\.dispatchEvent/);
});
