import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraBasis,orbitAnchor,orbitCamera,flyCamera,advanceFlight,flightAircraft,chaseFlight} from '../cloudNavigation.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const cam={x:4,y:.8,z:32,yawDeg:187,pitchDeg:12,fovYDeg:60};
test('chase camera preserves entry pose then follows a separate turning aircraft',()=>{
  const ship=flightAircraft(cam);
  const separation=Math.hypot(ship.x-cam.x,ship.y-cam.y,ship.z-cam.z);
  assert.ok(separation>2&&separation<3,'close chase camera stays outside the small hull');
  const initial=chaseFlight(cam,ship,.016);
  for(const key of ['x','y','z','yawDeg','pitchDeg'])near(initial[key],cam[key]);
  ship.yawDeg+=30;ship.x+=2;
  const followed=chaseFlight(cam,ship,.016);
  assert.ok(followed.yawDeg>cam.yawDeg&&followed.yawDeg<ship.yawDeg);
  assert.ok(Math.hypot(ship.x-followed.x,ship.y-followed.y,ship.z-followed.z)>2);
});

test('orbit initializes from any camera pose without snapping to a different view',()=>{
  const anchor=orbitAnchor(cam,[0,0,0]);
  const result=orbitCamera(cam,anchor);
  for(const key of ['x','y','z','yawDeg','pitchDeg'])near(result[key],cam[key]);
});
test('orbit keeps its target and radius while rotating, and zoom changes only distance',()=>{
  const anchor=orbitAnchor(cam,[0,0,0]),target=anchor.target.slice(),distance=anchor.distance;
  const turned=orbitCamera(cam,anchor,75,20);
  near(Math.hypot(turned.x-target[0],turned.y-target[1],turned.z-target[2]),distance);
  const forward=cameraBasis(turned).forward;
  for(let i=0;i<3;i++)near([turned.x,turned.y,turned.z][i]+forward[i]*distance,target[i]);
  const zoomed=orbitCamera(turned,anchor,0,0,.5);
  near(Math.hypot(zoomed.x-target[0],zoomed.y-target[1],zoomed.z-target[2]),distance*.5);
  assert.deepEqual(anchor.target,target);
});
test('flight follows the worker camera convention and normalizes diagonal speed',()=>{
  const origin={...cam,x:0,y:0,z:0,yawDeg:90,pitchDeg:0};
  const straight=flyCamera(origin,{forward:1},4,.05);
  near(straight.x,.2);near(straight.z,0);
  const diagonal=flyCamera(origin,{forward:1,right:1,up:1},4,.05);
  near(Math.hypot(diagonal.x,diagonal.y,diagonal.z),.2);
  const up=flyCamera(origin,{up:1},4,.05);near(up.y,.2);
});
test('flight cannot leap after a background pause or flip at a pole',()=>{
  const next=flyCamera({...cam,pitchDeg:84},{forward:1,pitch:1},4,10);
  near(Math.hypot(next.x-cam.x,next.y-cam.y,next.z-cam.z),.2);
  assert.equal(next.pitchDeg,85);
  assert.equal(orbitCamera(cam,orbitAnchor(cam,[0,0,0]),0,-1000).pitchDeg,-85);
  assert.deepEqual(flyCamera(cam,{forward:1},4,-1),cam);
});

test('automatic flight accelerates and keeps drifting through a smooth turn',()=>{
  const state={velocity:[0,0,0],turn:0,pitch:0,bank:0};
  let current={...cam,x:0,y:0,z:0,yawDeg:0,pitchDeg:0};
  current=advanceFlight(current,state,{},4,.016);
  assert.ok(current.z>0&&current.z<4*.016);
  for(let i=0;i<120;i++)current=advanceFlight(current,state,{},4,1/60);
  near(state.turn,0);assert.ok(state.velocity[2]>3.8);
  for(let i=0;i<60;i++)current=advanceFlight(current,state,{turn:1},4,1/60);
  assert.ok(current.yawDeg>20&&current.yawDeg<48);assert.ok(state.bank<-10);
  const before=state.turn;
  current=advanceFlight(current,state,{},4,1/60);
  assert.ok(state.turn>0&&state.turn<before);assert.ok(state.velocity[2]>0);
  const short={velocity:[0,0,0],turn:0,pitch:0,bank:0};
  const long=structuredClone(short);
  assert.deepEqual(advanceFlight(cam,short,{turn:1},4,.05),advanceFlight(cam,long,{turn:1},4,10));
});
