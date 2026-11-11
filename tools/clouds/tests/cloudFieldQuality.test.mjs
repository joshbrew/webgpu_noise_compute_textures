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

test('surroundings switches preserve a finite storm box and the camera-relative volume',async()=>{
 const ui=await readFile(new URL('../cloudTestThreaded.js',import.meta.url),'utf8');
 const start=ui.indexOf("$('quick-terrain')?.addEventListener('change'"),end=ui.indexOf('  $("quick-rebake-button")',start);
 let handler,frames=0;
 const controls=new Map(Object.entries({'quick-terrain':{value:'basin',addEventListener:(_,fn)=>handler=fn},
  'quick-sky-span':{value:52},'v-box-hx':{value:26},'v-box-hy':{value:10},'v-box-hz':{value:26},
  'v-box-cy':{value:9.7},'v-cy':{value:4},render:{click:()=>frames++}}));
 const preview={terrainEnabled:false};
 new Function('$','setFieldValue','preview',ui.slice(start,end))(id=>controls.get(id),(id,v)=>controls.get(id).value=v,preview);
 handler();assert.equal(preview.terrainEnabled,true);assert.equal(controls.get('v-cy').value,10);
 for(const [key,value] of [['quick-sky-span',52],['v-box-hx',26],['v-box-hy',10],['v-box-hz',26]])assert.equal(controls.get(key).value,value);
 assert.ok(Math.abs(controls.get('v-box-cy').value-controls.get('v-cy').value-5.7)<1e-9);
 controls.get('quick-terrain').value='off';handler();
 assert.equal(preview.terrainEnabled,false);assert.equal(controls.get('v-cy').value,4);
 assert.ok(Math.abs(controls.get('v-box-cy').value-9.7)<1e-9);assert.equal(frames,2);
});

test('quick sun height edits relight through the existing control and sync from presets',async()=>{
 const ui=await readFile(new URL('../cloudTestThreaded.js',import.meta.url),'utf8');
 const start=ui.indexOf("$('quick-sun-height')?.addEventListener('input'"),end=ui.indexOf("  $('quick-terrain')?.addEventListener",start);
 let handler;const events=[],controls=new Map(Object.entries({'quick-sun-height':{value:'34.5',addEventListener:(_,fn)=>handler=fn},'c-el':{value:21},'quick-sun-height-label':{textContent:''}}));
 const get=id=>controls.get(id),set=(id,v)=>controls.get(id).value=v;
 new Function('$','setFieldValue','dispatchInput',ui.slice(start,end))(get,set,id=>events.push(id));
 handler();assert.equal(get('c-el').value,34.5);assert.equal(get('quick-sun-height-label').textContent,'Sun height 34.5°');assert.deepEqual(events,['c-el']);
 get('c-el').value=12;
 const syncStart=ui.indexOf("  const sunHeight=Number($('c-el')"),syncEnd=ui.indexOf('  const cloudScale=',syncStart);
 new Function('$','setFieldValue','preview',ui.slice(syncStart,syncEnd))(get,set,{sun:{elDeg:21}});
 assert.equal(get('quick-sun-height').value,12);assert.equal(get('quick-sun-height-label').textContent,'Sun height 12.0°');
});
