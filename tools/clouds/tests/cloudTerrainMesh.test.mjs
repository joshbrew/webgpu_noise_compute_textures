import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerrainMesh,terrainHeight} from '../cloudTerrainMesh.js';
test('mountain mesh has valid indexed triangles and unit upward normals',()=>{
 const {vertices,indices}=createTerrainMesh(33,128);
 assert.equal(vertices.length,(33*33+8)*6);assert.equal(indices.length,32*32*6+24);
 for(const index of indices)assert.ok(index<33*33+8);
 for(let i=0;i<vertices.length;i+=6){
  assert.ok(Math.abs(Math.hypot(...vertices.slice(i+3,i+6))-1)<1e-6);
  assert.ok(vertices[i+4]>0);
  assert.ok(Number.isFinite(vertices[i+1]));assert.ok(vertices[i+1]>=-6);
  if(i<33*33*6){
   const x=(i/6)%33,z=Math.floor(i/6/33);
   const at=k=>vertices[k*6];
   const span=Math.max(at(Math.min(x+1,32))-at(Math.max(x-1,0)),at(Math.min(z+1,32))-at(Math.max(z-1,0)))*.5;
   assert.ok(Math.abs(vertices[i+1]-terrainHeight(vertices[i],vertices[i+2],1,span))<1e-4);
  }
 }
});

test('slope erosion carves ridges deterministically and preserves the basin and apron',()=>{
 let changed=0,carved=0;
 for(let z=-75;z<=75;z+=3)for(let x=-75;x<=75;x+=3){
  const base=terrainHeight(x,z,0),eroded=terrainHeight(x,z);
  assert.equal(eroded,terrainHeight(x,z));assert.ok(Number.isFinite(eroded));
  assert.ok(eroded>=-6 && Math.abs(eroded-base)<10);
  if(Math.abs(eroded-base)>.1)changed++;
  if(eroded<base-.5)carved++;
 }
 assert.ok(changed>500 && carved>300);
 for(const [x,z] of [[0,0],[10,0],[0,10],[180,180],[-192,0]])assert.equal(terrainHeight(x,z),-6);
});

test('erosion drops unresolved gullies rather than aliasing them into coarse terrain',()=>{
 for(const [x,z] of [[40,40],[-50,30],[65,-20]])assert.equal(terrainHeight(x,z,1,100),terrainHeight(x,z,0));
});
test('mountain basin has a lower central floor and surrounding alpine ridges',()=>{
 assert.equal(terrainHeight(0,0),-6);
 let peaks=0;
 for(let i=0;i<360;i++){const angle=i*Math.PI/180;peaks=Math.max(peaks,terrainHeight(Math.cos(angle)*52,Math.sin(angle)*52));}
 assert.ok(peaks>8);assert.equal(terrainHeight(180,180),-6);
});

test('basin geometry concentrates detail without exceeding the terrain frame budget',()=>{
 const {vertices,indices}=createTerrainMesh();
 assert.ok(indices.length/3<200000);
 // Near-floor spacing is finer than the flat, distant apron.
 const size=Math.sqrt(vertices.length/6-8),middle=(size-1)/2;
 const inner=vertices[(middle+1)*6]-vertices[middle*6];
 const outer=vertices[6]-vertices[0];
 assert.ok(inner>0 && inner<outer*.3);
});
