import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Exercise the real builder methods without requiring a GPU or WGSL bundler.
const source = (await readFile(new URL('../clouds.js', import.meta.url), 'utf8'))
  .replace(/^import (\w+) from "\.\/[^" ]+\.wgsl";$/gm, 'const $1 = "";')
  .replace('"./cloudFieldQuality.js"',JSON.stringify(new URL('../cloudFieldQuality.js',import.meta.url).href))
  .replace("'./cloudLookPresets.js'",JSON.stringify(new URL('../cloudLookPresets.js',import.meta.url).href));
const { CloudComputeBuilder } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function fixture(device = {}) {
  const builder = Object.create(CloudComputeBuilder.prototype);
  Object.assign(builder, {
    device, outFormat: 'rgba16float', module: {}, _computePipelineLayout: {},
    _dvOptions: new DataView(new ArrayBuffer(32)),
    _abTuning: new ArrayBuffer(256), _computePipelineKey: -1,
    _computePipelines: new Map(), _computePipelinePromises: new Map(),
    _state: { tuning: {} }, _writeIfChanged() {},
    // These tests isolate main-variant caching; the stage cache is tested below.
    _getFlatStageSetup() { return { layout: {} }; },
    _ensureFlatStagePipelineAsync() { return Promise.resolve({}); },
    _ensureFlatStagePipeline() { return {}; },
    _getStagedLayerShaderModule() { return {}; },
  });
  builder._dvTuning = new DataView(builder._abTuning);
  builder._dvOptions.setUint32(8, 1, true);
  builder.setTuning({ sunStride: 4 });
  return builder;
}

test('flat field fidelity replaces both cached textures without changing shader variants',()=>{
  globalThis.GPUTextureUsage={TEXTURE_BINDING:4,STORAGE_BINDING:8};
  globalThis.GPUBufferUsage={UNIFORM:64,COPY_DST:8};
  const allocated=[],retired=[];
  const b=fixture({createTexture(desc){const texture={desc,createView:()=>({texture})};allocated.push(texture);return texture;},createBuffer:desc=>({desc}),createBindGroup:desc=>({desc}),createShaderModule:desc=>desc,createComputePipeline:()=>({getBindGroupLayout:()=>({})})});
  b._retireTexture=t=>retired.push(t);
  b.setTuning({formType:3});const key=b._currentComputeVariantKey();
  b._ensureFlatFieldResources();const original=b._fieldResources;
  assert.deepEqual(original.dimensions,[128,64,128]);
  assert.ok(allocated.every(t=>t.desc.mipLevelCount===8));
  assert.equal(b._fieldMipGroups.flat().length,14);
  b.setFieldQuality('balanced');b._ensureFlatFieldResources();assert.equal(allocated.length,2);
  b.setFieldQuality('high');assert.equal(b._fieldResources,original,'allocate only at the next frame encode');
  b._fieldDensitySignature=b._fieldLightSignature='old';b._flatStageBindGroup={};
  b._ensureFlatFieldResources();assert.deepEqual(b._fieldResources.dimensions,[192,96,192]);
  assert.deepEqual(retired,[original.density,original.light]);
  assert.equal(b._fieldDensitySignature,null);assert.equal(b._fieldLightSignature,null);assert.equal(b._flatStageBindGroup,null);
  b.setFieldQuality('ultra');b._ensureFlatFieldResources();assert.deepEqual(b._fieldResources.dimensions,[256,128,256]);
  b.setFieldQuality('cinematic');b._ensureFlatFieldResources();assert.deepEqual(b._fieldResources.dimensions,[384,192,384]);
  b.setFieldQuality('reference');b._ensureFlatFieldResources();assert.deepEqual(b._fieldResources.dimensions,[512,256,512]);
  assert.equal(b._currentComputeVariantKey(),key,'no new quality pipeline or screen-size variant');
  b.setTuning({formType:0});const count=allocated.length;b.setFieldQuality('low');b._ensureFlatFieldResources();
  assert.equal(allocated.length,count,'the legacy layer does not allocate higher-detail fields');
  b.setTuning({formType:3});b._ensureFlatFieldResources();assert.deepEqual(b._fieldResources.dimensions,[96,48,96]);
  assert.throws(()=>b.setFieldQuality('bad'),RangeError);assert.equal(b._state.fieldQuality,'low');
  b.device.limits={maxTextureDimension3D:2048,maxBufferSize:256*1024**2};
  assert.throws(()=>b.setFieldQuality('reference'),/unavailable/);
  assert.equal(b._state.fieldQuality,'low','reject unsupported capture tiers before changing scene state');
  b.setFieldQuality('cinematic');b._ensureFlatFieldResources();assert.deepEqual(b._fieldResources.dimensions,[384,192,384]);
});

test('a sculpted first frame binds valid single-level placeholder fields',()=>{
  globalThis.GPUTextureUsage={TEXTURE_BINDING:4,STORAGE_BINDING:8};
  globalThis.GPUBufferUsage={UNIFORM:64,COPY_DST:8};
  const allocated=[];
  const b=fixture({createTexture(desc){
    assert.ok(desc.mipLevelCount<=1+Math.floor(Math.log2(Math.max(...desc.size))));
    const texture={desc,createView:()=>({texture})};allocated.push(texture);return texture;
  },createBuffer:desc=>({desc}),createBindGroup:desc=>({desc}),createShaderModule:desc=>desc,createComputePipeline:()=>({getBindGroupLayout:()=>({})})});
  b._retireTexture=()=>{};
  b.setTuning({formType:0});b._ensureFlatFieldResources();
  assert.deepEqual(b._fieldResources.dimensions,[1,1,1]);
  assert.ok(allocated.every(t=>t.desc.mipLevelCount===1));
  assert.equal(b._fieldMipGroups.flat().length,0);
  b.setTuning({formType:3});b._ensureFlatFieldResources();
  assert.deepEqual(b._fieldResources.dimensions,[128,64,128]);
  assert.equal(b._fieldMipGroups.flat().length,14);
});

test('variant follows the uploaded stride and preserves all mode bits', () => {
  const builder = fixture();
  for (const [stride, detail] of [[4, false], [2, false], [1, true], [0, true], [-2, true], [1.9, true], [2.9, false]]) {
    builder.setTuning({ sunStride: stride });
    for (const spherical of [false, true]) for (const custom of [false, true]) for (const rgb of [false, true]) {
      builder._dvOptions.setFloat32(16, spherical ? 1 : 0, true);
      builder._dvOptions.setUint32(0, custom ? 1 : 0, true);
      builder._dvOptions.setUint32(8, rgb ? 1 : 0, true);
      const key = builder._currentComputeVariantKey();
      assert.equal(key, +spherical | (+custom << 2) | (+rgb << 3) | (+detail << 4) | (spherical ? 0 : 32));
      const { compute } = builder._computePipelineDescriptorForKey(key);
      assert.equal(compute.constants.CLOUD_DETAILED_LIGHTING, +detail);
      assert.equal(compute.entryPoint, spherical ? 'computeCloudSphere' : 'computeCloudBox');
    }
  }
});

test('styled planets share a compact entry while legacy and aurora retain their own path',()=>{
 const builder=fixture();builder._dvView=new DataView(new ArrayBuffer(128));
 builder._dvOptions.setFloat32(16,1,true);builder._dvView.setFloat32(92,1,true);
 builder._getPlanetShaderModule=()=>({planet:true});
 builder._planetStyleMode=true;
 for(const form of [1,2,3,4,5]){
  builder.setTuning({formType:form,sunStride:1});
  assert.equal(builder._currentComputeVariantKey(),137);
  assert.equal(builder._computePipelineDescriptorForKey().compute.entryPoint,'computeCloudPlanet');
 }
 builder._dvView.setFloat32(92,2,true);assert.equal(builder._currentComputeVariantKey(),25);
 builder._dvView.setFloat32(92,1,true);builder._planetStyleMode=false;
 assert.equal(builder._currentComputeVariantKey(),25,'custom legacy form knobs do not select the style kernel');
 builder.setTuning({formType:0,sunStride:4});assert.equal(builder._currentComputeVariantKey(),9);
});

test('async warmups share one compilation and do not install a stale variant', async () => {
  let calls = 0, resolve;
  const device = { createComputePipelineAsync: () => { calls++; return new Promise(done => { resolve = done; }); } };
  const builder = fixture(device);
  const first = builder.ensureComputePipelineReadyAsync();
  const second = builder.ensureComputePipelineReadyAsync();
  assert.equal(calls, 1);
  assert.equal(builder.getComputePipelineTimings().variants[0].status, 'compiling');
  builder.setTuning({ sunStride: 1 });
  const regular = {};
  resolve(regular);
  assert.equal(await first, regular);
  assert.equal(await second, regular);
  assert.equal(builder.pipeline, undefined);
  assert.equal(builder._computePipelinePromises.size, 0);
  builder.setTuning({ sunStride: 4 });
  assert.equal(await builder.ensureComputePipelineReadyAsync(), regular);
  assert.equal(calls, 1);
  const snapshot = builder.getComputePipelineTimings();
  assert.equal(snapshot.activeKey, 40);
  assert.equal(snapshot.variants[0].status, 'ready');
  assert.ok(snapshot.variants[0].compileMs >= 0);
  snapshot.variants[0].status = 'modified';
  assert.equal(builder.getComputePipelineTimings().variants[0].status, 'ready');
  assert.deepEqual(structuredClone(builder.getComputePipelineTimings()), builder.getComputePipelineTimings());
});

test('failed async compilation is timed, cleared and retryable', async () => {
  let fail = true;
  const device = { async createComputePipelineAsync() { if (fail) throw new Error('compile failed'); return {}; } };
  const builder = fixture(device);
  await assert.rejects(builder.ensureComputePipelineReadyAsync(), /compile failed/);
  assert.equal(builder._computePipelinePromises.size, 0);
  assert.equal(builder.getComputePipelineTimings().variants[0].status, 'error');
  fail = false;
  await builder.ensureComputePipelineReadyAsync();
  assert.equal(builder.getComputePipelineTimings().variants[0].status, 'ready');
});

test('prewarming respects explicit and current stride without changing render state', async () => {
  const descriptors = [];
  const builder = fixture({ async createComputePipelineAsync(descriptor) { descriptors.push(descriptor); return {}; } });
  await builder.prewarmComputePipelineVariantAsync({ spherical: true });
  await builder.prewarmComputePipelineVariantAsync({ aurora: true, sunStride: 1 });
  assert.deepEqual([...builder._computePipelines.keys()], [9, 25]);
  assert.deepEqual(descriptors.map(d => d.compute.constants.CLOUD_DETAILED_LIGHTING), [0, 1]);
  assert.equal(builder._currentComputeVariantKey(), 40);
});

test('sync fallback retains cache and diagnostic behavior', async () => {
  let calls = 0;
  const builder = fixture({ createComputePipeline() { calls++; return {}; } });
  const pipeline = await builder.ensureComputePipelineReadyAsync();
  assert.equal(builder.ensureComputePipelineReady(), pipeline);
  assert.equal(calls, 1);
  assert.equal(builder.getComputePipelineTimings().variants[0].async, false);
});

test('shader retains dynamic detailed lighting guard and compact probe loops', async () => {
  const shader = await readFile(new URL('../shaders/cloudCommon.wgsl', import.meta.url), 'utf8') + await readFile(new URL('../shaders/cloudLayer.wgsl', import.meta.url), 'utf8');
  assert.equal(shader.match(/CLOUD_DETAILED_LIGHTING != 0u && !fastLighting && sunStrideSafe <= 1/g)?.length, 2);
  assert.equal(shader.match(/for \(var i = 0u; i < 6u; i\+\+\)/g)?.length, 3);
  assert.match(shader, /for \(var i = 0u; i < 3u; i\+\+\)/);
});

test('rounded forms share one variant and oversized outputs fall back to inline resolve', () => {
  const builder = fixture({ limits: { maxStorageBufferBindingSize: 1024 } });
  builder._getFieldShaderModule = () => 'fields';
  builder.width = 4; builder.height = 4; builder.layers = 1;
  for (const formType of [1, 2, 3, 4, 5, 6, 7]) {
    builder.setTuning({ formType, sunStride: 1 });
    assert.equal(builder._currentComputeVariantKey(), 104);
    assert.equal(builder._computePipelineDescriptorForKey(104).compute.module, 'fields');
  }
  builder.width = 128;
  assert.equal(builder._currentComputeVariantKey(), 72);
  assert.equal(builder._currentComputeVariantKey({ coarseFactor: 8 }), 104);
  builder.setTuning({ formType: 0 });
  assert.equal(builder._currentComputeVariantKey(), 24);
  assert.equal(builder._currentComputeVariantKey({ coarseFactor: 8 }), 56);
});

test('coarse warmup prepares the dispatched variant without compiling a large logical target', async () => {
  const keys = [];
  const builder = fixture({ limits: { maxStorageBufferBindingSize: 1024 }, async createComputePipelineAsync(descriptor) { keys.push(descriptor.compute.constants.CLOUD_STAGED_RESOLVE); return {}; } });
  builder.width = 128; builder.height = 4;
  await builder.ensureComputePipelineReadyAsync({ coarseFactor: 8 });
  assert.deepEqual(keys, [1]);
  assert.equal(builder._computePipelineKey, 40);
  assert.equal(builder.ensureComputePipelineReady({ coarseFactor: 8 }), builder.pipeline);
  assert.equal(builder._currentComputeVariantKey(), 8);
});

test('field cache reuses camera/AO changes, relights the sun, and rebakes changed inputs', () => {
  const builder = fixture();
  Object.assign(builder, {
    _u32Views: new WeakMap(), _abParams: new ArrayBuffer(96), _abNTransform: new ArrayBuffer(128), _abBox: new ArrayBuffer(32),
    _dvView: new DataView(new ArrayBuffer(128)), _fieldParamsAB: new ArrayBuffer(80), _fieldResources: { dimensions: [128,64,128] },
    _ensureFlatFieldResources() {}, _getResId(resource) { return resource; }, _fieldMipGroups:[[],[]],
    weatherView: 1, shape3DView: 2, detail3DView: 3,
  });
  builder._state.box = { center: [0,1,0], half: [18,1.4,18] };
  builder._state.light = { sunDir: [0,1,0] };
  const pass = { setPipeline() {}, setBindGroup() {}, dispatchWorkgroups() {} };
  const stages = () => { const timings = []; builder._encodeFlatFields(pass, timings); return timings.filter(t => t.dispatched).map(t => t.stage); };
  const both = ['buildCloudDensityField', 'buildCloudLightField'];
  assert.deepEqual(stages(), both);
  assert.deepEqual(stages(), []);
  const appearance=new DataView(builder._abParams);
  appearance.setFloat32(24,2.5,true); // silver intensity is resolved per ray
  appearance.setFloat32(48,1.7,true); // sun tint is not cached geometry
  builder.setTuning({lightingFinish:2});
  assert.deepEqual(stages(), [], 'appearance changes preserve density and lighting');
  appearance.setFloat32(12,4.5,true); // extinction changes cached sun visibility
  assert.deepEqual(stages(), ['buildCloudLightField']);
  appearance.setFloat32(4,2,true); // density changes both fields
  assert.deepEqual(stages(), both);
  const fieldResources = builder._fieldResources;
  builder.setCloudTurbulence(.75);
  assert.deepEqual(stages(), [], 'visible turbulence must reuse density and lighting');
  assert.equal(new DataView(builder._fieldParamsAB).getFloat32(76,true), .75);
  assert.equal(builder._fieldResources, fieldResources);
  builder.setCloudTurbulence(100);assert.equal(builder._state.cloudTurbulence,1.5);
  builder.setCloudTurbulence(NaN);assert.equal(builder._state.cloudTurbulence,0);
  assert.deepEqual(stages(), []);
  builder._dvView.setFloat32(0, 12, true); // camera, not field coordinates
  builder.setTuning({ aoStrength: 0.75 });
  assert.deepEqual(stages(), []);
  builder._state.light.sunDir = [1,0,0];
  assert.deepEqual(stages(), ['buildCloudLightField']);
  builder.setTuning({ puffScale: 5 });
  assert.deepEqual(stages(), both);
  builder.weatherView = 4;
  assert.deepEqual(stages(), both);
  builder.invalidateCloudFields(); // in-place texture rebake
  assert.deepEqual(stages(), both);
  builder._dvView.setFloat32(96, 2, true); // world-to-noise scale
  assert.deepEqual(stages(), both);
  new DataView(builder._abNTransform).setFloat32(0, 2.25, true); // advected cloud-cell domain
  assert.deepEqual(stages(), both);
  builder.setVolumeMask({shape:'torus',rotationAngle:0.4});
  assert.deepEqual(stages(), both);
  builder.setVolumeMask({shape:'torus',rotationAngle:0.8});
  assert.deepEqual(stages(), both);
  builder.setVolumeMask({shape:'box',rotationAngle:0.8});
  assert.deepEqual(stages(), both);
  builder.setVolumeMask({shape:'box',rotationAngle:1.2}); // irrelevant in a box
  assert.deepEqual(stages(), []);
  builder.setWeatherProfile({shelf:1});
  assert.deepEqual(stages(),both);assert.deepEqual(stages(),[]);
  assert.equal(new DataView(builder._fieldParamsAB).getFloat32(12,true),1);
  builder.setWeatherProfile({deck:.4,wisps:.6});
  assert.deepEqual(stages(),both);
  builder.setWeatherProfile();assert.deepEqual(stages(),both);
  builder.setVolumeMask({shape:'torus'});assert.deepEqual(stages(),both);
  builder.setWeatherProfile({shelf:1});assert.deepEqual(stages(),[]); // layer weights don't touch arbitrary volumes
});

test('rounded clouds advect their scaffold and grow billows without rescaling tower height', async () => {
  const shader = await readFile(new URL('../shaders/cloudFields.wgsl', import.meta.url), 'utf8');
  assert.match(shader, /floor\(\(p\.xz \+ windOffset\) \/ cellSize\)/);
  assert.match(shader, /centerXZ = materialCenterXZ - windOffset/);
  assert.match(shader, /columnHeight = layerHeight \* heightFraction \* select\(1\.0/);
  assert.match(shader, /headRadius = fullHeadRadius \* puffGrowth/);
  assert.match(shader, /radiusY = fullRadiusY \* puffGrowth/);
  assert.match(shader, /fieldWeatherUV\(vec3<f32>\(materialCenterXZ\.x/);
  assert.match(shader, /body = max\(body, localForm/);
});

test('hybrid clouds use volume noise for density, billow deformation and cached lighting', async () => {
  const shader = await readFile(new URL('../shaders/cloudFields.wgsl', import.meta.url), 'utf8');
  assert.match(shader, /fbm = dot\(shape\.gba, vec3<f32>\(0\.625, 0\.25, 0\.125\)\)/);
  assert.match(shader, /macroSigned = localBody \* 0\.85 \+ cellStructure/);
  assert.match(shader, /fineSigned = macroSigned - erosion/);
  assert.match(shader, /localForm \* 0\.85 \+ cellStructure \* 0\.65 - erosion/);
  assert.match(shader, /p \+ detailWarp \+ NTransform\.shapeOffsetWorld/);
  assert.match(shader, /detailScale = .*\* 0\.04;/);
  // These compact density operations stay in the cached entrypoint. The
  // legacy recursive density/light graph must not return to the small raymarch.
  const rays = await readFile(new URL('../shaders/clouds.wgsl', import.meta.url), 'utf8');
  assert.doesNotMatch(rays, /densityFromSamples\(|roundedCloudBody\(/);
  assert.equal(shader.match(/let detail = wrap3D_detail/g)?.length, 1);
  assert.equal(shader.match(/let shape = wrap3D_shape/g)?.length, 1);
});

test('anvil scenes mix stable storm cells with lower cumulus and keep upper turrets below the canopy', async () => {
  const shader = await readFile(new URL('../shaders/cloudFields.wgsl', import.meta.url), 'utf8');
  assert.match(shader, /stormCell = cloudCellRandom\(id, 237\.9\) < 0\.27/);
  assert.doesNotMatch(shader, /stormCell = [^;]*weather\./);
  assert.match(shader, /anvil = select\(C\.cloudAnvilAmount > 0\.65, stormCell, stormSystem\)/);
  assert.match(shader, /mix_f\(0\.22, 0\.54, r0\), stormSystem && !stormCell/);
  assert.match(shader, /stormHeight = mix_f\(0\.52, 1\.0/);
  assert.match(shader, /capGrowth = sqrt\(smoothstep\(0\.40, 0\.84, maturity\)\)/);
  assert.match(shader, /C\.cloudAnvilAmount \* max\(TUNE\.anvilLift, 0\.0\)/);
  assert.match(shader, /columnHeight \* select\(0\.24, 0\.16, anvil\)/);
  assert.match(shader, /for \(var fan = 0; fan < 5; fan\+\+\)/);
});

test('rounded bulk develops continuously behind the noisy surface without extra samples', async () => {
  const shader = await readFile(new URL('../shaders/cloudFields.wgsl', import.meta.url), 'utf8');
  assert.match(shader, /interior = smoothstep\(0\.04, 0\.42, localBody \+ cellStructure \* 0\.40 - erosion \* 0\.20\)/);
  assert.match(shader, /smoothstep\(0\.20, 1\.00, maturity\)/);
  assert.match(shader, /coreDensity = interior \* 2\.0/);
  assert.match(shader, /fineDensity = max\(smoothstep\(-0\.025, 0\.24, fineSigned\), coreDensity\)/);
  assert.match(shader, /macroDensity = max\(smoothstep\(-0\.025, 0\.24, macroSigned\), coreDensity\)/);
  assert.match(shader, /shapeScale = .* \* 0\.35;/);
  assert.match(shader, /detailWarp = .*vec3<f32>\(0\.16, 0\.12, 0\.16\)/);
  assert.equal(shader.match(/let detail = wrap3D_detail/g)?.length, 1);
  assert.equal(shader.match(/let shape = wrap3D_shape/g)?.length, 1);
});

test('cached lighting filters scalar responses instead of compressed-normal seams', async () => {
  const fields = await readFile(new URL('../shaders/cloudFields.wgsl', import.meta.url), 'utf8');
  const rays = await readFile(new URL('../shaders/clouds.wgsl', import.meta.url), 'utf8');
  assert.doesNotMatch(fields + rays, /encodeCloudNormal|decodeCloudNormal/);
  assert.match(fields, /vec4<f32>\(diffuse, upper, sunVisibility, ambientVisibility\)/);
  assert.match(rays, /diffuse = clamp\(lighting\.r, 0\.0, 1\.0\)/);
  assert.match(rays, /upper = clamp\(lighting\.g, 0\.0, 1\.0\)/);
  assert.match(fields, /nearbyDensity = max\(nearbyDensity, neighbor\.g\)/);
  assert.match(fields, /if \(nearbyDensity < 0\.0001\)/);
  assert.match(fields, /shadowSteps = u32\(clamp\(ceil\(reach \/ sunVoxelStep \* 2\.0\), 16\.0, 48\.0\)\)/);
  assert.match(fields, /f32\(i\) \+ 0\.5/);
  assert.equal(rays.match(/textureSampleLevel\(cloudLightField/g)?.length, 1);
});

test('automatic finishing follows the form while either shading style packs independently', async () => {
  const builder = fixture();
  builder._abRender = new ArrayBuffer(304);
  builder._dvRender = new DataView(builder._abRender);
  for (const formType of [0,1,2,3]) for (const spherical of [false,true]) {
    builder.setTuning({formType});
    builder._dvOptions.setFloat32(16, spherical ? 1 : 0, true);
    for(const [cloudShading,mode] of [['auto',0],['soft',1],['sculpted',2]]) {
      builder._writeRenderUniforms({cloudShading,styleSkyOverride:true});
      assert.equal(builder._dvRender.getFloat32(12,true), formType>0 && !spherical ? 1 : 0);
      assert.equal(builder._dvRender.getFloat32(156,true),mode);
      assert.equal(builder._dvRender.getFloat32(204,true),1);
      assert.equal(builder._dvRender.getFloat32(244,true), Math.fround(.34));
    }
    builder._writeRenderUniforms();
    assert.equal(builder._dvRender.getFloat32(156,true),0);
    assert.equal(builder._dvRender.getFloat32(204,true),0);
  }
  const shader = await readFile(new URL('../shaders/cloudsRender.wgsl', import.meta.url), 'utf8');
  const volumeBranch = shader.slice(shader.indexOf('if (softVolumeFinish)'), shader.indexOf('if (cloudA < 0.003)'));
  assert.match(volumeBranch, /volumeTint = mix\(userShadowTint, userLightTint/);
  assert.match(volumeBranch, /clamp\(R\.saturationBoost, 0\.0, 2\.20\)/);
  assert.doesNotMatch(volumeBranch, /gradLenCached|bodyShadow|sunEdgeSilver/);
});

test('aircraft state uses view padding without changing the cloud field or view-extra layout',()=>{
  const b=fixture();b._abView=new ArrayBuffer(128);b._dvView=new DataView(b._abView);
  b.setViewFromCamera({aircraft:{enabled:true,bank:.25,pitch:-.125},viewExtraA:3,viewExtraB:4,viewExtraC:5});
  assert.equal(b._dvView.getFloat32(12,true),1);
  assert.equal(b._dvView.getFloat32(28,true),.25);
  assert.equal(b._dvView.getFloat32(44,true),-.125);
  assert.equal(b._dvView.getFloat32(100,true),3);
  assert.equal(b._dvView.getFloat32(104,true),4);
  assert.equal(b._dvView.getFloat32(108,true),5);
  b.setViewFromCamera();
  for(const offset of [12,28,44])assert.equal(b._dvView.getFloat32(offset,true),0);
});

test('independent stage compilation deduplicates and retries failed sync fallback', async () => {
  const builder = fixture();
  const setup = { pipelines: new Map(), promises: new Map() };
  builder._getFlatStageSetup = () => setup;
  builder._flatStageDescriptor = entryPoint => ({ compute: { entryPoint } });
  let calls = 0, fail = true;
  builder.device.createComputePipeline = () => { calls++; if (fail) throw new Error('stage failed'); return {}; };
  const ensure = CloudComputeBuilder.prototype._ensureFlatStagePipelineAsync.bind(builder);
  await assert.rejects(ensure('resolveCloudFlat'), /stage failed/);
  assert.equal(setup.promises.size, 0);
  assert.equal(builder.getComputePipelineTimings().variants[0].status, 'error');
  fail = false;
  const [first, second] = await Promise.all([ensure('resolveCloudFlat'), ensure('resolveCloudFlat')]);
  assert.equal(first, second);
  assert.equal(calls, 2);
  assert.equal(builder.getComputePipelineTimings().variants[0].status, 'ready');
});

test('arbitrary volume configuration retains partial updates and validates its mask', () => {
  const builder=fixture();
  builder.setVolumeMask({shape:'torus',rotationAngle:1.05});
  builder.setVolumeMask({rotationAngle:2});
  assert.deepEqual(builder._state.volumeMask,{shape:'torus',rotationAngle:2});
  assert.throws(()=>builder.setVolumeMask({shape:'unsupported'}),/Unknown cloud volume/);
  builder.setVolumeMask({shape:'box'});
  assert.equal(builder._state.volumeMask.shape,'box');
  builder.setVolumeMask({shape:'gallery'});
  assert.equal(builder._state.volumeMask.shape,'gallery');
});

test('continuous weather profile weights normalize and clear without changing shader variants',()=>{
  const b=fixture(),key=b._currentComputeVariantKey();
  b.setWeatherProfile({shelf:.8,deck:.8,wisps:Infinity});
  assert.deepEqual(b._state.weatherProfile,{shelf:.5,deck:.5,wisps:0,cirrus:0,fluctus:0,asperitas:0});
  assert.equal(b._currentComputeVariantKey(),key);
  b.setWeatherProfile({cirrus:1,fluctus:1,asperitas:1});
  assert.equal(b._state.weatherProfile.asperitas,1/3);
  assert.equal(b._currentComputeVariantKey(),key);
  b.setWeatherProfile();assert.deepEqual(b._state.weatherProfile,{shelf:0,deck:0,wisps:0,cirrus:0,fluctus:0,asperitas:0});
});
