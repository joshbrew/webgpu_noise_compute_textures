import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const shader=await readFile(new URL('../shaders/planetCloudSurfaceMC33.wgsl',import.meta.url),'utf8');

test('realistic mesh breaks periodic rows only in the cached field stage',()=>{
  const shape=shader.slice(shader.indexOf('fn realistic_shape_domain'),shader.indexOf('// Same signed billow'));
  assert.match(shape,/params.formType<0\.5 \|\| params.formType>=1\.5/);
  assert.match(shape,/q\*\.193/);
  assert.match(shape,/broad.rgb.*\.72/);
  assert.match(shape,/realistic_shape_domain\(q.zxy\)\*\.739/);
  assert.match(shape,/mix\(primary,secondary,\.26\)/);
  assert.doesNotMatch(shape,/fract|floor|atan2|camPos|for\s*\(/);
  assert.match(shader,/surface_shape\(planetEvolvingDomain\(rotate_domain\(pos,params.shapeTime\)\*params.worldScale,params.detailTime\)\)/);
  const normal=shader.slice(shader.indexOf('fn smooth_world_normal'),shader.indexOf('fn planetEvolvingDomain'));
  assert.doesNotMatch(normal,/surface_shape|textureSample/);
});

test('oblique domain preserves scale and destroys the original unit-axis tile alignment',()=>{
  const basis=[[.36,.48,.8],[-.8,.6,0],[-.48,-.64,.6]];
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(dot(basis[i],basis[j])-(i===j?1:0))<1e-12);
  for(let axis=0;axis<3;axis++){
    const shift=basis.map(row=>row[axis]);
    assert.ok(shift.filter(x=>Math.abs(x-Math.round(x))>.1).length>=2);
  }
  assert.ok(Math.abs(.739-Math.round(.739))>.2);
});
