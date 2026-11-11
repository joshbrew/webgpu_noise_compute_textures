// Actual-demo probe. Instrumentation is confined to this diagnostic page.
const NativeWorker = window.Worker;
const traffic = {sent: {}, received: {}, frames: [], pending: new Map()};
let observedWorker, probeId=1000000000;
const probeReplies=new Map();
window.Worker = class extends NativeWorker {
  constructor(...args) {
    super(...args);
    observedWorker=this;
    this.addEventListener('message', ({data}) => {
      if(probeReplies.has(data.id)){probeReplies.get(data.id)(data.data);probeReplies.delete(data.id);}
      const name = data.type || traffic.pending.get(data.id)?.type || 'reply';
      traffic.received[name] = (traffic.received[name] || 0) + 1;
      const pending = traffic.pending.get(data.id);
      if (pending) {
        if (pending.type === 'runFrame') traffic.frames.push({ms: performance.now()-pending.at, ...data.data?.timings});
        traffic.pending.delete(data.id);
      }
    });
  }
  postMessage(data, ...args) {
    traffic.sent[data.type] = (traffic.sent[data.type] || 0) + 1;
    traffic.pending.set(data.id, {type: data.type, at: performance.now()});
    super.postMessage(data, ...args);
  }
};
const longTasks = [];
new PerformanceObserver(list => longTasks.push(...list.getEntries().map(e=>({at:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const sample = async (name, action) => {
  const start = performance.now(), sent = {...traffic.sent}, received = {...traffic.received}, frames = traffic.frames.length;
  const gaps = []; let previous = start, running = true;
  const tick = now => {gaps.push(now-previous);previous=now;if(running)requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
  await action(); running=false;
  gaps.sort((a,b)=>a-b);
  const difference = (after,before) => Object.fromEntries(Object.entries(after).map(([k,v])=>[k,v-(before[k]||0)]).filter(([,v])=>v));
  return {name,ms:performance.now()-start,sent:difference(traffic.sent,sent),received:difference(traffic.received,received),rafMedianMs:gaps[Math.floor(gaps.length/2)],rafP95Ms:gaps[Math.floor(gaps.length*.95)],rafMaxMs:gaps.at(-1),longTasks:longTasks.filter(t=>t.at>=start),frames:traffic.frames.slice(frames).map(f=>({roundTripMs:f.ms,coarseFactor:f.coarseFactor,temporalCellRate:f.temporalCellRate,resetHistory:f.resetReprojection,frame:f.frame,deferredPresentation:f.deferredPresentation,computeGpuWaitMs:f.computeGpuWaitMs}))};
};
async function probe() {
  document.querySelector('#ui-probe-result').textContent='Measuring…';
  const results=[];
  results.push(await sample('paused idle',()=>wait(3000)));
  results.push(await sample('paused orbit',async()=>{
    const canvas=document.querySelector('#gpuCanvas'),r=canvas.getBoundingClientRect(),x=r.x+r.width*.5,y=r.y+r.height*.5;
    // Native pointer capture requires a trusted pointer. Wheel follows the
    // same real navigation commit and worker path without pointer capture.
    for(let i=0;i<90;i++){canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:i%2?-.2:.2,clientX:x,clientY:y,bubbles:true,cancelable:true}));await wait(1000/60);}
    await wait(1500);
  }));
  results.push(await sample('settled idle',()=>wait(3000)));
  const settings=Object.fromEntries(['v-cloud-scale','v-render-scale-divider','v-temporal-cell-rate','v-cx','v-cy','v-cz','v-yaw','v-pitch'].map(id=>[id,document.getElementById(id).value]));
  const canvas=document.querySelector('#gpuCanvas');
  const report={complete:true,settings,viewport:{cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,dpr:devicePixelRatio},results};
  document.querySelector('#ui-probe-result').textContent=JSON.stringify(report,null,2);
  await fetch('/test-result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({test:'ui-responsiveness',report})});
}
const visibility = visible => new Promise(resolve => {
  const id=probeId++;probeReplies.set(id,resolve);
  observedWorker.postMessage({id,type:'setPageVisibility',payload:{visible}});
});
const until = async predicate => {for(let i=0;i<100;i++){if(predicate())return;await wait(100);}throw new Error('Playback did not change state');};
async function probeBackground(){
  document.querySelector('#ui-probe-result').textContent='Measuring background suspension…';
  const playback=document.querySelector('#reproj-anim-toggle');
  if(playback.textContent.includes('Animate'))playback.click();
  await until(()=>playback.textContent.includes('Pause'));
  await visibility(true);await wait(750);
  await visibility(false);await wait(750);
  const hiddenStart=await visibility(false);await wait(750);const hiddenEnd=await visibility(false);
  await visibility(true);await wait(750);const resumed=await visibility(true);
  playback.click();await until(()=>playback.textContent.includes('Animate'));
  const paused=await visibility(false);await visibility(true);await wait(500);const returned=await visibility(true);
  const report={complete:true,hiddenStart,hiddenEnd,resumed,paused,returned,
    pass:hiddenStart.frame===hiddenEnd.frame&&JSON.stringify(hiddenStart.wind)===JSON.stringify(hiddenEnd.wind)&&resumed.frame>hiddenEnd.frame&&!returned.enabled&&returned.frame===paused.frame};
  document.querySelector('#ui-probe-result').textContent=JSON.stringify(report,null,2);
  await fetch('/test-result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({test:'ui-visibility',report})});
}
const mount = setInterval(()=>{
  if(!document.querySelector('#quick-render-button')||document.querySelector('#quick-render-button').disabled)return;
  clearInterval(mount);
  const panel=document.createElement('details');panel.style.cssText='position:fixed;left:8px;bottom:8px;z-index:100;width:310px;max-height:50vh;overflow:auto;background:#101827;color:white;padding:8px';
  panel.innerHTML='<summary>UI responsiveness probe</summary><button id="ui-probe-run">Measure idle and orbit</button><button id="ui-probe-background">Test background suspension</button><pre id="ui-probe-result">Ready</pre>';
  document.body.append(panel);panel.open=true;
  panel.querySelector('#ui-probe-run').onclick=()=>probe().catch(error=>panel.querySelector('pre').textContent=String(error.stack));
  panel.querySelector('#ui-probe-background').onclick=()=>probeBackground().catch(error=>panel.querySelector('pre').textContent=String(error.stack));
},250);
