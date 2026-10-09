const radians = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const chaseDistance = 2.4, chaseHeight = .55;
export function cameraBasis(cam) {
  const yaw = cam.yawDeg * radians, pitch = cam.pitchDeg * radians;
  const forward = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch)];
  return { forward, right, up };
}
export function orbitAnchor(cam, center) {
  const distance = Math.max(.1, Math.hypot(cam.x-center[0], cam.y-center[1], cam.z-center[2]));
  const {forward} = cameraBasis(cam);
  return {distance, target: forward.map((v,i) => [cam.x,cam.y,cam.z][i] + v*distance)};
}
export function orbitCamera(cam, anchor, yawDelta=0, pitchDelta=0, zoom=1) {
  const next = {...cam, yawDeg:cam.yawDeg+yawDelta, pitchDeg:clamp(cam.pitchDeg+pitchDelta,-85,85)};
  anchor.distance = clamp(anchor.distance*zoom,.1,100000);
  const {forward} = cameraBasis(next);
  [next.x,next.y,next.z] = anchor.target.map((v,i) => v-forward[i]*anchor.distance);
  return next;
}
export function flyCamera(cam, axes, speed, elapsed) {
  const next = {...cam};
  const dt = clamp(elapsed,0,.05);
  next.yawDeg += (axes.turn || 0)*65*dt;
  next.pitchDeg = clamp(next.pitchDeg+(axes.pitch || 0)*55*dt,-85,85);
  const {forward,right} = cameraBasis(next);
  const direction = forward.map((v,i)=>v*(axes.forward||0)+right[i]*(axes.right||0)+(i===1?(axes.up||0):0));
  const length = Math.hypot(...direction);
  if(length>0) [next.x,next.y,next.z] = [cam.x,cam.y,cam.z].map((v,i)=>v+direction[i]/Math.max(1,length)*speed*dt);
  return next;
}

export function advanceFlight(cam, state, input, speed, elapsed) {
  const dt=clamp(elapsed,0,.05), steer=1-Math.exp(-dt*3.2), drift=1-Math.exp(-dt*1.8);
  state.turn+=(clamp(input.turn||0,-1,1)*48-state.turn)*steer;
  state.pitch+=(clamp(input.pitch||0,-1,1)*36-state.pitch)*steer;
  const next={...cam,yawDeg:cam.yawDeg+state.turn*dt,pitchDeg:clamp(cam.pitchDeg+state.pitch*dt,-80,80)};
  const {forward}=cameraBasis(next);
  const target=forward.map((v,i)=>v*speed+(i===1?(input.up||0)*speed*.35:0));
  state.velocity=state.velocity.map((v,i)=>v+(target[i]-v)*drift);
  [next.x,next.y,next.z]=[cam.x,cam.y,cam.z].map((v,i)=>v+state.velocity[i]*dt);
  state.bank+=(-state.turn*.8-state.bank)*(1-Math.exp(-dt*5));
  return next;
}

export function flightAircraft(cam) {
  const {forward,up}=cameraBasis(cam);
  const position=[cam.x,cam.y,cam.z].map((v,i)=>v+forward[i]*chaseDistance-up[i]*chaseHeight);
  return {...cam,x:position[0],y:position[1],z:position[2]};
}
export function chaseFlight(cam, ship, elapsed) {
  const dt=clamp(elapsed,0,.05), follow=1-Math.exp(-dt*7), look=1-Math.exp(-dt*2.6);
  const {forward,up}=cameraBasis(ship);
  const target=[ship.x,ship.y,ship.z].map((v,i)=>v-forward[i]*chaseDistance+up[i]*chaseHeight);
  const next={...cam,yawDeg:cam.yawDeg+(ship.yawDeg-cam.yawDeg)*look,pitchDeg:cam.pitchDeg+(ship.pitchDeg-cam.pitchDeg)*look};
  [next.x,next.y,next.z]=[cam.x,cam.y,cam.z].map((v,i)=>v+(target[i]-v)*follow);
  return next;
}

// Native pointer controls on the display canvas; cloud rendering stays in its worker.
export function installCloudNavigation({canvas, getCamera, getBox, setCamera, setAircraft}) {
  const style = document.createElement('style');
  style.textContent = `
    #cloud-navigation {position:fixed;z-index:15;pointer-events:none;overflow:hidden;color:#e8f0ff;font:12px system-ui}
    #cloud-navigation .nav-toolbar {position:absolute;top:12px;right:12px;max-width:calc(100% - 24px);display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:8px 10px;border:1px solid #ffffff26;border-radius:12px;background:#101827dc;pointer-events:auto;box-shadow:0 4px 18px #0003}
    #cloud-navigation button,#cloud-navigation select {font:inherit;color:inherit;background:#263449;border:1px solid #ffffff26;border-radius:6px;padding:5px 8px;cursor:pointer;min-height:30px;width:auto}
    #cloud-navigation button[aria-pressed=true] {background:#355e84;border-color:#92cced}
    #cloud-navigation .nav-hint {position:absolute;bottom:64px;left:12px;right:12px;text-align:center;text-shadow:0 1px 4px #000;background:#101827b8;border-radius:8px;padding:7px}
    #cloud-navigation [hidden] {display:none!important}
    #gpuCanvas {width:calc(100vw - var(--side));touch-action:none;outline-offset:-3px}
    #gpuCanvas:focus-visible {outline:2px solid #92cced}
    @media(max-width:600px) {#cloud-navigation .nav-toolbar {top:6px;right:6px;gap:4px;padding:5px} #cloud-navigation .nav-hint {font-size:10px}}
  `;
  document.head.append(style);
  const overlay = document.createElement('div');
  overlay.id = 'cloud-navigation';
  overlay.innerHTML = `
    <div class="nav-toolbar" aria-label="Camera navigation">
      <button id="nav-orbit" type="button" aria-pressed="true">Orbit</button>
      <button id="nav-flight" type="button" aria-pressed="false">Flight</button>
      <button id="nav-frame" type="button">Frame clouds</button>
      <label id="nav-speed-label" hidden>Speed <select id="nav-speed"><option value="1">Slow</option><option value="4" selected>Cruise</option><option value="12">Fast</option><option value="32">Travel</option></select></label>
      <button id="nav-cruise" type="button" aria-pressed="false" hidden>Launch</button>
    </div>
    <div class="nav-hint" id="nav-hint"></div>`;
  document.body.append(overlay);
  const el = id => overlay.querySelector('#'+id);
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label','Cloud view. Drag to orbit. Switch to flight to fly through the clouds.');
  let mode='orbit', cruise=false, anchor=null, signature='', gesture=null, raf=0, previous=0;
  const flight={velocity:[0,0,0],turn:0,pitch:0,bank:0};
  let ship=null;
  const aircraftPose = cam => ({enabled:true,position:[ship.x,ship.y,ship.z],yaw:(ship.yawDeg-cam.yawDeg)*radians,bank:flight.bank*radians,pitch:(ship.pitchDeg-cam.pitchDeg)*radians});
  const keys=new Set(), pointers=new Map();
  const cameraSignature = cam => JSON.stringify(cam);
  const syncAnchor = () => {
    const cam=getCamera();
    if(signature!==cameraSignature(cam) || !anchor) anchor=orbitAnchor(cam,getBox().center);
    signature=cameraSignature(cam);
    return cam;
  };
  const commit = cam => {signature=cameraSignature(cam);setCamera(cam);};
  const positionOverlay = () => {
    const r=canvas.getBoundingClientRect();
    Object.assign(overlay.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
  };
  new ResizeObserver(positionOverlay).observe(canvas);
  window.addEventListener('resize',positionOverlay);
  window.addEventListener('scroll',positionOverlay,true);
  positionOverlay();
  const refresh = () => {
    el('nav-orbit').setAttribute('aria-pressed',String(mode==='orbit'));
    el('nav-flight').setAttribute('aria-pressed',String(mode==='flight'));
    for(const id of ['nav-speed-label','nav-cruise']) el(id).hidden=mode!=='flight';
    el('nav-cruise').textContent=cruise?'Pause flight':'Launch';
    el('nav-cruise').setAttribute('aria-pressed',String(cruise));
    el('nav-hint').textContent=mode==='orbit'?'Drag to orbit · Right-drag / Shift-drag to pan · Scroll / pinch to zoom':
      'Auto forward · Drag / WASD / arrows to steer · Q/E down/up · Shift boost · Esc stop';
    canvas.style.cursor=mode==='orbit'?'grab':'crosshair';
  };
  const resetMotion = () => {keys.clear();cruise=false;gesture=null;pointers.clear();flight.velocity=[0,0,0];flight.turn=0;flight.pitch=0;flight.bank=0;refresh();};
  const animate = now => {
    raf=0;
    const dt=previous?(now-previous)/1000:0;previous=now;
    const turn=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'))+(gesture?.turn||0);
    const pitch=Number(keys.has('ArrowUp')||keys.has('KeyW'))-Number(keys.has('ArrowDown')||keys.has('KeyS'))+(gesture?.pitch||0);
    if(mode==='flight') {
      const axes={turn,pitch,up:Number(keys.has('KeyE'))-Number(keys.has('KeyQ'))};
      const cam=getCamera();
      if(!ship||signature!==cameraSignature(cam))ship=flightAircraft(cam);
      ship=advanceFlight(ship,flight,axes,cruise?Number(el('nav-speed').value)*(keys.has('ShiftLeft')||keys.has('ShiftRight')?3:1):0,dt);
      const next=chaseFlight(cam,ship,dt);
      setAircraft(aircraftPose(next));
      commit(next);
    }
    const cam=getCamera();
    const catchingUp=mode==='flight'&&ship&&(Math.abs(ship.yawDeg-cam.yawDeg)>.05||Math.abs(ship.pitchDeg-cam.pitchDeg)>.05);
    if(keys.size||cruise||catchingUp||Math.abs(flight.bank)>.1||Math.abs(flight.turn)>.1||Math.abs(flight.pitch)>.1||gesture) raf=requestAnimationFrame(animate);
    else previous=0;
  };
  const wake = () => {if(!raf) raf=requestAnimationFrame(animate);};
  const switchMode = next => {
    resetMotion();mode=next;cruise=mode==='flight';anchor=null;syncAnchor();
    ship=flightAircraft(getCamera());
    setAircraft(mode==='flight'?aircraftPose(getCamera()):{enabled:false});commit(getCamera());
    refresh();if(mode==='flight')canvas.focus({preventScroll:true});wake();
  };
  el('nav-orbit').onclick=()=>switchMode('orbit');
  el('nav-flight').onclick=()=>switchMode('flight');
  el('nav-cruise').onclick=()=>{cruise=!cruise;if(!cruise)flight.velocity=[0,0,0];canvas.focus({preventScroll:true});refresh();wake();};
  el('nav-frame').onclick=()=>{
    resetMotion();
    const cam=getCamera(),box=getBox(),r=canvas.getBoundingClientRect();
    const angle=Math.atan(Math.tan(cam.fovYDeg*radians/2)*Math.min(1,r.width/Math.max(1,r.height)));
    anchor={target:box.center.slice(),distance:Math.max(.5,Math.hypot(...box.half)/Math.sin(angle)*1.1)};
    commit(orbitCamera(cam,anchor));
    ship=flightAircraft(getCamera());
    if(mode==='flight'){setAircraft(aircraftPose(getCamera()));commit(getCamera());}
  };
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(![0,1,2].includes(e.button))return;
    e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
    syncAnchor();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    gesture={id:e.pointerId,pan:e.button!==0||e.shiftKey,bank:0};
    canvas.style.cursor='grabbing';
  });
  canvas.addEventListener('pointermove',e=>{
    const old=pointers.get(e.pointerId);if(!old)return;
    const dx=e.clientX-old.x,dy=e.clientY-old.y;
    const before=[...pointers.values()];pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    let cam=syncAnchor();
    if(mode==='orbit') {
      const after=[...pointers.values()];
      if(pointers.size===2) {
        const a=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y),b=Math.hypot(after[0].x-after[1].x,after[0].y-after[1].y);
        if(a>.1&&b>.1)cam=orbitCamera(cam,anchor,0,0,a/b);
      }
      if(gesture.pan||pointers.size===2) {
        const {right,up}=cameraBasis(cam),factor=2*anchor.distance*Math.tan(cam.fovYDeg*radians/2)/Math.max(1,canvas.clientHeight)*(pointers.size===2?.5:1);
        anchor.target=anchor.target.map((v,i)=>v+(-dx*right[i]+dy*up[i])*factor);
        cam=orbitCamera(cam,anchor);
      }else cam=orbitCamera(cam,anchor,-dx*.22,dy*.22);
    }else {
      gesture.turn=clamp((gesture.turn||0)+dx/120,-1,1);
      gesture.pitch=clamp((gesture.pitch||0)-dy/120,-1,1);wake();return;
    }
    commit(cam);
  });
  const endPointer=e=>{pointers.delete(e.pointerId);if(!pointers.size){gesture=null;refresh();wake();}};
  canvas.addEventListener('pointerup',endPointer);
  canvas.addEventListener('pointercancel',endPointer);
  canvas.addEventListener('lostpointercapture',endPointer);
  canvas.addEventListener('wheel',e=>{
    if(mode!=='orbit')return;e.preventDefault();
    commit(orbitCamera(syncAnchor(),anchor,0,0,Math.exp(clamp(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1),-300,300)*.001)));
  },{passive:false});
  const flightKeys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight']);
  canvas.addEventListener('keydown',e=>{
    if(e.code==='Escape'){e.preventDefault();resetMotion();wake();return;}
    if(mode!=='flight'||!flightKeys.has(e.code))return;
    e.preventDefault();keys.add(e.code);wake();
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  canvas.addEventListener('blur',e=>{
    keys.clear();gesture=null;pointers.clear();
    if(!overlay.contains(e.relatedTarget))cruise=false;
    if(!cruise)flight.velocity=[0,0,0];
    refresh();wake();
  });
  window.addEventListener('blur',()=>{resetMotion();wake();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){resetMotion();wake();}});
  refresh();
}
