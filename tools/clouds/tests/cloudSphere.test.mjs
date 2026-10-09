import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CloudVolumeMips} from '../cloudVolumeMips.js';

test('planetary domains bypass flat anvil/vertical resampling and repeat the actual 3D texture',async()=>{
 const common=await readFile(new URL('../shaders/cloudCommon.wgsl',import.meta.url),'utf8');
 assert.match(common,/mapped = select\(uvw \* wg_shapeUvMul \+ wg_shapeUvAdd, uvw, sphericalCloudMode\(\)\)/);
 const ph=common.slice(common.indexOf('fn computePH'),common.indexOf('fn contrast01'));
 assert.doesNotMatch(ph,/spherePlane|sphereUVFromWorld/);
 for(const name of ['shapeUVW_fromWarp','detailUVW_fromWarp']){
  const code=common.slice(common.indexOf(`fn ${name}`));
  assert.ok(code.indexOf('if (sphericalCloudMode())')<code.indexOf('anvilShapePos'));
 }
 const rays=await readFile(new URL('../shaders/cloudLayer.wgsl',import.meta.url),'utf8');
 assert.doesNotMatch(rays,/stableShellPhase|floor\(midShellPhase/);
 assert.match(rays,/samplePixelWorld \* wg_scaleD_effMax \* wg_detailDim.x/);
 assert.match(common,/turns = max\(abs\(axisOrOne3/);
});

test('storm variants have independently broad bases without new texture probes or larger neighborhoods',async()=>{
 const code=await readFile(new URL('../shaders/cloudFields.wgsl',import.meta.url),'utf8');
 assert.match(code,/convective = anvil \|\| \(TUNE.formType >= 1.5 && TUNE.formType < 2.5\)/);
 assert.match(code,/widthVariant = cloudCellRandom\(id, 383.1\)/);
 assert.match(code,/broadBase = select\(0.0, 1.0 - smoothstep\(0.30,0.58,widthVariant\), convective\)/);
 assert.match(code,/mix_f\(0.68, 1.35, cloudCellRandom\(id, 361.7\)\)/);
 assert.match(code,/stormHeight, anvil\) \* mix_f\(1.0, 0.85, broadBase\)/);
 assert.match(code,/mix_f\(1.14,1.95,broadBase\)/);
 assert.match(code,/cellStructure = select\(structure,/);
 assert.match(code,/lobeAspect = select\(1.0,/);
 assert.match(code,/footprintFade = select\(1.0, 1.0 - smoothstep\(cellSize \* 1.12, cellSize \* 1.28/);
 assert.ok(0.21+1.28<1.5,'wide-cell support stays within the 3x3 search');
 assert.match(code,/for \(var z = -1; z <= 1; z\+\+\)/);
 assert.equal(code.match(/let shape = wrap3D_shape/g)?.length,1);
 assert.equal(code.match(/let detail = wrap3D_detail/g)?.length,1);
});

test('static planet mip bake shares compilation, reuses allocations, and releases obsolete textures',async()=>{
 globalThis.GPUShaderStage={COMPUTE:4};globalThis.GPUTextureUsage={TEXTURE_BINDING:4,STORAGE_BINDING:8};
 const textures=[],calls={compile:0,submit:0,passes:0};
 const device={queue:{submit(){calls.submit++}},
  createBindGroupLayout:x=>x,createPipelineLayout:x=>x,createShaderModule:x=>x,createBindGroup:x=>x,
  async createComputePipelineAsync(x){calls.compile++;return x},
  createTexture(desc){const t={desc,destroyed:false,createView:d=>({t,...d}),destroy(){this.destroyed=true}};textures.push(t);return t},
  createCommandEncoder:()=>({beginComputePass(){calls.passes++;return {setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},end(){}}},finish(){return {}}})};
 const mips=new CloudVolumeMips(device);
 await assert.rejects(mips.bake({},0,'invalid'),RangeError);
 await assert.rejects(mips.bake({},2.5,'invalid'),RangeError);
 await Promise.all([mips.prepare(),mips.prepare()]);assert.equal(calls.compile,2);
 const a=await mips.bake({},128,'shape');assert.equal(textures[0].desc.mipLevelCount,8);
 assert.equal(await mips.bake({},128,'shape'),a);assert.equal(textures.length,1);
 await mips.bake({},32,'shape');assert.ok(textures[0].destroyed);
 assert.equal(calls.passes,22);assert.equal(calls.submit,3);
 mips.release('shape');assert.ok(textures[1].destroyed);assert.equal(mips.resources.size,0);
});
