import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../planetClouds.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function wantsCloudHistory'),source.indexOf('function makeDefaultCameraState'));
const [ensure,swap]=new Function('normalizeTemporalRateLocal',code+';return [ensureCloudHistory,swapCloudHistory];')(r=>Math.max(1,r));
globalThis.GPUTextureUsage={TEXTURE_BINDING:4,STORAGE_BINDING:8,COPY_SRC:1,COPY_DST:2};

function fixture(){
 const allocations=[];
 const layer={options:{reprojection:{enabled:1,temporalCellRate:4,compactInterleave:1}},
  device:{createTexture(desc){const tex={desc,destroy(){tex.destroyed=true},createView:v=>({tex,...v})};allocations.push(tex);return tex}},
  queue:{writeTexture(){}},cloudBuilder:{outFormat:'rgba16float',setInputMaps(m){layer.bound=m}}};
 return {layer,allocations};
}

test('planet history matches coarse dispatch dimensions, including odd output sizes',()=>{
 const {layer,allocations}=fixture();
 const history=ensure(layer,1001,701,3);
 assert.deepEqual([history.width,history.height],[334,234]);
 assert.deepEqual(allocations.map(t=>t.desc.size),[[334,234,1],[334,234,1]]);
 assert.equal(layer.historyWarmupFrames,1);
 layer.historyWarmupFrames=0;
 assert.equal(ensure(layer,1001,701,3),history);
 assert.equal(layer.historyWarmupFrames,0,'unchanged sizes must not restart accumulation');
 swap(layer);
 assert.equal(layer.bound.historyPrevView,history.prevView);
 assert.deepEqual(history.prevTex.desc.size,[334,234,1]);
});

test('camera-stop coarse/full transitions discard incompatible history and reseed',()=>{
 const {layer,allocations}=fixture();
 ensure(layer,1000,700,2); // Moving full-screen planet.
 const old=layer.history;
 layer.historyWarmupFrames=0;
 ensure(layer,1000,700,1); // Stopped camera returns to full quality.
 assert.equal(old.prevTex.destroyed,true);assert.equal(old.outTex.destroyed,true);
 assert.deepEqual([layer.history.width,layer.history.height],[1000,700]);
 assert.equal(layer.historyWarmupFrames,1);
 ensure(layer,1000,700,3); // Close shell stays coarse even when stationary.
 assert.deepEqual([layer.history.width,layer.history.height],[334,234]);
 assert.equal(allocations.length,6);
 layer.options.reprojection={enabled:0,temporalCellRate:1,compactInterleave:0};
 ensure(layer,1000,700,3);
 assert.equal(layer.history,null);assert.equal(layer.bound.historyPrevView,null);
});

test('history sizing precedes warmup/interleave decisions in the production update',()=>{
 const update=source.slice(source.indexOf('export async function updatePlanetCloudLayer'),source.indexOf('function normalizeVecArray'));
 const allocate=update.indexOf('ensureCloudHistory(layer, outW, outH, coarseFactor)');
 assert.ok(allocate>update.indexOf('const coarseFactor ='));
 assert.ok(allocate<update.indexOf('const historyWarmupActive ='));
 assert.match(update,/cameraIsMoving \|\| auroraAnimating \|\| historyWarmupActive\s*\? 1/);
 assert.match(update,/const temporalBlend = historyWarmupActive \? 0/);
 assert.match(update,/fullWidth: Math.max\(1, Math.ceil\(outW \/ coarseFactor\)\)/);
});

test('missing motion input is exactly zero, not half a pixel of phantom reprojection',async()=>{
 const builder=await readFile(new URL('../clouds.js',import.meta.url),'utf8');
 const code=builder.slice(builder.indexOf('    const tex2Desc ='),builder.indexOf('  _initBuffers()'));
 const body=code.slice(0,code.lastIndexOf('  }'));
 const writes=[],device={createTexture:()=>({createView:()=>({})})};
 const initialize=new Function('d',body);
 initialize.call({queue:{writeTexture(_tex,data){writes.push([...data])}},outFormat:'rgba16float',_ensureComputeFormat(){}},device);
 assert.deepEqual(writes,[[0],[128]]);
});
