import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const AsyncFunction=(async()=>{}).constructor;

const ui=await readFile(new URL('../cloudTestThreaded.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../cloudTest.worker.js',import.meta.url),'utf8');
const pump=ui.slice(ui.indexOf('let _frameRunActive ='),ui.indexOf('let _liveAnimationUpdateTimer ='));
const fences=worker.slice(worker.indexOf('function enqueueLoopGpuFence()'),worker.indexOf('function startLoop()'));

test('rapid camera input keeps the latest pose while a render is pending',async()=>{
  let release,entered;
  const firstEntered=new Promise(r=>entered=r),blocked=new Promise(r=>release=r);
  const calls=[],ticks=[];
  const run=new Function('rpc','nextAnimationFrame',`${pump};return runFrameLatest;`)(async(type,payload)=>{
    calls.push(payload.pose);
    if(calls.length===1){entered();await blocked;}
    return payload.pose;
  },async()=>ticks.push(calls.length));
  const initial=run({pose:0});
  await firstEntered;
  const updates=Array.from({length:100},(_,i)=>run({pose:i+1}));
  release();
  await Promise.all([initial,...updates]);
  assert.deepEqual(calls,[0,100]);
  assert.ok(ticks.length>=2,'input batches yield to another display tick');
});

test('navigation backpressure waits for the oldest GPU frame before allowing more work',async()=>{
  const releases=[];
  const queue={onSubmittedWorkDone:()=>new Promise(r=>releases.push(r))};
  const control=new Function('queue',`let loopGpuFences=[];const LOOP_MAX_GPU_FRAMES_IN_FLIGHT=3;
    ${fences};return {enqueue:enqueueLoopGpuFence,wait:waitForLoopGpuBackpressure,size:()=>loopGpuFences.length};`)(queue);
  control.enqueue();control.enqueue();
  let ready=false;
  const waiting=control.wait(1).then(()=>ready=true);
  await Promise.resolve();
  assert.equal(ready,false,'slow GPU applies backpressure instead of submitting obsolete views');
  releases[0]();await waiting;
  assert.equal(control.size(),1);
  control.enqueue();assert.equal(control.size(),2);
  releases[1]();releases[2]();await control.wait(0);
  assert.equal(control.size(),0);
});

test('navigation timing updates are bounded without suppressing manual progress',()=>{
 const source=worker.slice(worker.indexOf('function emitTimingProgress('),worker.indexOf('let lastPermSeed'));
 let now=0,snapshots=0;const posts=[];
 const emit=new Function('performance','postMessage',`let loopRunning=false,lastFrameTimingPost=-Infinity;${source};return emitTimingProgress;`)(
  {now:()=>now},event=>posts.push(event));
 const report={snapshot:()=>{snapshots++;return {};}};
 for(let i=0;i<60;i++){now=i*1000/60;emit(report,'frame:start',true);emit(report,'frame:complete',true);}
 assert.equal(posts.length,4);assert.equal(snapshots,4);
 emit(report,'frame:start');assert.equal(posts.length,5);
 emit(report,'startup:compiling',true);assert.equal(posts.length,6);
});

test('camera RPC acknowledges completed GPU work so the UI can coalesce the latest pose',async()=>{
 const handler=worker.slice(worker.indexOf('    if (type === "runFrame")'),worker.indexOf('    respond(false, new Error("Unknown worker message:'));
 let release,entered;const gpu=new Promise(r=>release=r),started=new Promise(r=>entered=r),responses=[],waits=[];
 const run=new AsyncFunction('payload','runFrame','respond','waitForLoopGpuBackpressure','performance','postMessage',`
  const type='runFrame';let navigationStatsStart=0,navigationStatsLast=0,navigationStatsFrames=0;const mergeTuningPatch=()=>{};
  ${handler}
 `);
 const pending=run({navigationFrame:true,preview:{camera:'latest'}},async payload=>{
  assert.equal(payload.waitForGpu,true);assert.equal(payload.preview.camera,'latest');entered();await gpu;return {completed:true};
 },(...args)=>responses.push(args),async target=>waits.push(target),{now:()=>100},()=>{});
 await started;assert.deepEqual(waits,[0]);assert.equal(responses.length,0);
 release();await pending;assert.equal(responses.length,1);assert.equal(responses[0][1].timings.completed,true);
});

test('pause acknowledgement drains queued GPU work',async()=>{
 const handler=worker.slice(worker.indexOf('    if (type === "stopLoop")'),worker.indexOf('    if (type === "runFrame")'));
 let release;const gpu=new Promise(r=>release=r),responses=[],fences=[1,2];
 const run=new AsyncFunction('queue','loopGpuFences','respond',`const type='stopLoop',stopLoop=()=>{},waitForLoopStopped=async()=>{};${handler}`);
 const pending=run({onSubmittedWorkDone:()=>gpu},fences,(...args)=>responses.push(args));
 await Promise.resolve();assert.equal(responses.length,0);
 release();await pending;assert.equal(responses.length,1);assert.equal(fences.length,0);
});

test('the paused UI notification follows GPU completion too',async()=>{
 const start=worker.indexOf('\n    await waitForLoopGpuBackpressure(0);')+1;
 const end=worker.slice(start,worker.indexOf('    const waiters = loopStopWaiters;',start));
 let release;const gpu=new Promise(r=>release=r),posts=[];
 const run=new AsyncFunction('queue','postMessage',`let loopRunning=true;const waitForLoopGpuBackpressure=async()=>{},log=()=>{};${end};return loopRunning;`);
 const pending=run({onSubmittedWorkDone:()=>gpu},message=>posts.push(message));
 await Promise.resolve();assert.equal(posts.length,0);
 release();assert.equal(await pending,false);assert.equal(posts[0].type,'loop-stopped');
});

test('hidden worker animation waits, resumes on visibility, and can be stopped while hidden',async()=>{
 const gate=worker.slice(worker.indexOf('let workerPageVisible ='),worker.indexOf('function emitTimingProgress('));
 const stop=worker.slice(worker.indexOf('function stopLoop()'),worker.indexOf('function waitForLoopStopped()'));
 const control=new Function(`${gate};let loopEnabled=true;const loopGpuFences=[];${stop};return {set:setWorkerPageVisibility,wait:waitForWorkerVisibility,stop:stopLoop,enabled:()=>loopEnabled};`)();
 control.set(false);let resumed=false;const waiting=control.wait().then(()=>resumed=true);
 await Promise.resolve();assert.equal(resumed,false);
 control.set(false);await Promise.resolve();await Promise.resolve();assert.equal(resumed,false);
 control.set(true);await waiting;assert.equal(resumed,true);
 control.set(false);const stopped=control.wait();control.stop();await stopped;
 assert.equal(control.enabled(),false);control.set(true);assert.equal(control.enabled(),false,'visibility never restarts a user-paused loop');
});

test('frame statistics do not reset active UI controls',()=>{
 const handler=ui.slice(ui.indexOf('    if (type === "frame")'),ui.indexOf('    if (type === "loop-stopped")'));
 const fps={textContent:''};let updates=0;
 new Function('$','updateCloudQuickStatus','updateCloudQuickDockState',`const type='frame',data={loopFps:31.2};${handler}`)(
  ()=>fps,()=>updates++,()=>{throw new Error('statistics repopulated controls');});
 assert.equal(fps.textContent,'31.2 fps');assert.equal(updates,1);
});

test('temporal Off explicitly clears a worker rate left by an earlier scene',()=>{
 const helper=ui.slice(ui.indexOf('function useFreshFullFrameReproj('),ui.indexOf('function ensureCoarseInPayload('));
 const apply=new Function('cloudHistoryEnabled','getFreshFullFrameReprojPayload','currentPreviewCoarseFactor',`${helper};return useFreshFullFrameReproj;`)(
  ()=>false,()=>({resetHistory:true,temporalCellRate:1,temporalBlend:0}),()=>1);
 const payload={preview:{temporalCellRate:1}};
 assert.equal(apply(payload),payload);assert.equal(payload.reproj.temporalCellRate,1);
 assert.equal(payload.reproj.resetHistory,true);assert.equal(payload.reproj.temporalBlend,0);
});

test('slow paused frames finish compute before acquiring the next canvas image',async()=>{
 const start=worker.indexOf('  if (deferPresentation) {');
 const submit=worker.slice(start,worker.indexOf('  const tC1 =',start));
 for(const enabled of [false,true]){
  const order=[];let release;
  const gpu=new Promise(r=>release=r),original={finish:()=>{order.push('finish-compute');return 'compute';}},next={};
  const queue={submit:buffers=>order.push(buffers[0]),onSubmittedWorkDone:()=>gpu};
  const device={createCommandEncoder:()=>{order.push('new-render-encoder');return next;}};
  const run=new AsyncFunction('enc','queue','device','deferPresentation','encodedDispatch',`${submit};return enc;`);
  const pending=run(original,queue,device,enabled,{restoreAfterSubmit:()=>order.push('restore')}).then(encoder=>{order.push('acquire-canvas');return encoder;});
  if(enabled){assert.deepEqual(order,['finish-compute','compute','restore']);release();}
  assert.equal(await pending,enabled?next:original);
  assert.deepEqual(order,enabled?['finish-compute','compute','restore','new-render-encoder','acquire-canvas']:['acquire-canvas']);
 }
});

test('frozen playback scrolls the held pattern while weather and independent noise clocks stay fixed',()=>{
 const start=worker.indexOf('        const dt = Math.max('),end=worker.indexOf('        if (workerReproj && workerReproj.enabled)',start);
 const step=new Function('enabled',`
  const advances=[],cb={_frozenPattern:{enabled},advanceFrozenPattern:(dt,velocity)=>advances.push({dt,velocity})};
  const t0=1000;let prevTime=0,weatherCycleSeconds=3,volumeRotationAngle=4;
  const weatherCycle={enabled:true},lastVolumeShape='box';
  const shapeOffsetWorld=[0,0,0],detailOffsetWorld=[0,0,0],weatherOffsetWorld=[0,0,0];
  const shapeVel=[.1,0,.2],detailVel=[.3,0,.4],weatherVel=[.5,0,.6];
  ${worker.slice(start,end)}
  return {advances,weatherCycleSeconds,volumeRotationAngle,shapeOffsetWorld,detailOffsetWorld,weatherOffsetWorld};
 `);
 const frozen=step(true);assert.equal(frozen.advances.length,1);assert.equal(frozen.weatherCycleSeconds,3);assert.equal(frozen.volumeRotationAngle,4);
 for(const key of ['shapeOffsetWorld','detailOffsetWorld','weatherOffsetWorld'])assert.deepEqual(frozen[key],[0,0,0]);
 const live=step(false);assert.equal(live.advances.length,0);assert.equal(live.weatherCycleSeconds,3.25);assert.deepEqual(live.shapeOffsetWorld,[.1,0,.2]);
});

