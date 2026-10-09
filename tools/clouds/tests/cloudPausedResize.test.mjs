import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../cloudTestThreaded.js',import.meta.url),'utf8');
const flush=source.slice(source.indexOf('async function flushQueuedResize()'),source.indexOf('\nfunction queueResizePayload'));

test('canvas resize re-presents paused clouds after startup without starting their clock',async()=>{
 for(const running of [false,true]){
  const calls=[];
  const run=new Function('rpc','runFrameLatest','initialBakePromise','animRunning',`
   let _resizeInFlight=false,_resizeQueuedPayload={main:{width:100,height:100}},_resizeQueuedSig='new',_resizeLastSentSig='';
   const preview={time:17},safeClone=o=>({...o}),readCloudParams=()=>({}),readTuning=()=>({});
   const useFreshFullFrameReproj=p=>p.fresh=true,ensureCoarseInPayload=p=>p.coarseFactor=4,scheduleResizeFlush=()=>{};
   ${flush};return flushQueuedResize();
  `);
  await run(async()=>({resized:true}),async frame=>calls.push(frame),Promise.resolve(),running);
  assert.equal(calls.length,running?0:1);
  if(!running){assert.equal(calls[0].preview.time,17);assert.equal(calls[0].fresh,true);assert.equal(calls[0].coarseFactor,4);}
 }
});
