import { MC33_ALL_TABLES } from './mc33Tables.js';
import { CloudTimingReport } from './cloudTiming.js';
import { PlanetCloudNoise } from './planetCloudNoise.js';
import { planetCloudStyleOptions } from './planetCloudStyles.js';
import { advancePlanetCloudTime } from './planetCloudMotion.js';
import planetCloudSurfaceMC33WGSL from './shaders/planetCloudSurfaceMC33.wgsl';
import planetCloudSurfaceRenderWGSL from './shaders/planetCloudSurfaceRender.wgsl';
import gasAppearanceWGSL from './shaders/planetGasAppearance.wgsl';
import gasFlowWGSL from './shaders/planetGasFlow.wgsl';

const DEFAULT_ANGULAR_CELLS = 96;
const DEFAULT_RADIAL_CELLS = 11;
const DEFAULT_TILE_CELLS = 8;
const DEFAULT_MAX_VERTICES = 900000;
const PIPELINE_CACHE = new WeakMap();

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalize3(value, fallback = [0, 0, 1]) {
  const x = finiteNumber(value?.[0] ?? value?.x, fallback[0]);
  const y = finiteNumber(value?.[1] ?? value?.y, fallback[1]);
  const z = finiteNumber(value?.[2] ?? value?.z, fallback[2]);
  const length = Math.hypot(x, y, z);
  if (length < 1e-8) return fallback.slice();
  return [x / length, y / length, z / length];
}

function raiseUiAboveSurfaceCanvas(parent, sourceCanvas, surfaceCanvas, options) {
  if (options.surfaceRaiseUiAboveCanvas === false) return;
  const uiZIndex = String(Math.max(10, finiteNumber(options.surfaceUiZIndex, 30)));
  for (const child of parent.children) {
    if (child === sourceCanvas || child === surfaceCanvas || child.tagName === 'CANVAS' || child.contains?.(sourceCanvas)) continue;
    if (!child.querySelector?.('button,input,select,textarea,[role="button"],[role="dialog"],[role="toolbar"]')) continue;
    const computed = getComputedStyle(child);
    if (computed.position === 'static') child.style.position = 'relative';
    if (computed.zIndex === 'auto' || finiteNumber(computed.zIndex, 0) < Number(uiZIndex)) {
      child.style.zIndex = uiZIndex;
    }
  }
}

function createOverlayCanvas(parent, sourceCanvas, options) {
  const canvas = document.createElement('canvas');
  canvas.className = options.surfaceCanvasClassName || 'planet-cloud-surface-overlay';
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: String(finiteNumber(options.canvasZIndex, 2)),
  });
  const parentStyle = getComputedStyle(parent);
  if (parentStyle.position === 'static') parent.style.position = 'relative';
  parent.appendChild(canvas);
  raiseUiAboveSurfaceCanvas(parent, sourceCanvas, canvas, options);
  resizeOverlayCanvas(canvas, sourceCanvas, options);
  return canvas;
}

function resizeOverlayCanvas(canvas, sourceCanvas, options) {
  const maximumDpr = Math.max(1, finiteNumber(options.maxDpr, 2));
  const dpr = Math.min(globalThis.devicePixelRatio || 1, maximumDpr);
  const cssWidth = Math.max(1, sourceCanvas.clientWidth || sourceCanvas.width || 1);
  const cssHeight = Math.max(1, sourceCanvas.clientHeight || sourceCanvas.height || 1);
  const width = Math.max(1, Math.round(cssWidth * dpr));
  const height = Math.max(1, Math.round(cssHeight * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return { width, height };
}

async function assertShaderModuleValid(module, label) {
  if (typeof module?.getCompilationInfo !== 'function') return;
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter((message) => message.type === 'error');
  if (errors.length === 0) return;
  const details = errors.map((message) => {
    const location = message.lineNum ? `${message.lineNum}:${message.linePos || 1}` : 'unknown';
    return `${location} ${message.message}`;
  }).join('\n');
  throw new Error(`${label} WGSL compilation failed:\n${details}`);
}

async function getPipelines(device, colorFormat, sampleCount = 1) {
  let byFormat = PIPELINE_CACHE.get(device);
  if (!byFormat) {
    byFormat = new Map();
    PIPELINE_CACHE.set(device, byFormat);
  }
  const pipelineKey = `${colorFormat}:${sampleCount}`;
  if (byFormat.has(pipelineKey)) return byFormat.get(pipelineKey);

  const promise = (async () => {
    const computeModule = device.createShaderModule({
      code: gasFlowWGSL+'\n'+planetCloudSurfaceMC33WGSL,
      label: 'Planet cloud MC33 shell shader',
    });
    const renderModule = device.createShaderModule({
      code: gasFlowWGSL+'\n'+gasAppearanceWGSL+'\n'+planetCloudSurfaceRenderWGSL,
      label: 'Planet cloud surface render shader',
    });
    await Promise.all([
      assertShaderModuleValid(computeModule, 'Planet cloud MC33 shell'),
      assertShaderModuleValid(renderModule, 'Planet cloud MC33 surface render'),
    ]);
    const [
      tilePipeline,
      fieldPipeline,
      classifyPipeline,
      prepareExtractPipeline,
      extractPipeline,
      projectPipeline,
      indirectPipeline,
      renderPipeline,
    ] = await Promise.all([
      device.createComputePipelineAsync({
        label: 'Planet cloud visible occupied-tile classification',
        layout: 'auto',
        compute: { module: computeModule, entryPoint: 'classify_tiles' },
      }),
      device.createComputePipelineAsync({
        label: 'Planet cloud shell field evaluation',
        layout: 'auto',
        compute: { module: computeModule, entryPoint: 'evaluate_field' },
      }),
      device.createComputePipelineAsync({
        label: 'Planet cloud visible active-cell classification',
        layout: 'auto',
        compute: { module: computeModule, entryPoint: 'classify_cells' },
      }),
      device.createComputePipelineAsync({
        label: 'Planet cloud active-cell dispatch preparation',
        layout: 'auto',
        compute: { module: computeModule, entryPoint: 'prepare_extract_dispatch' },
      }),
      device.createComputePipelineAsync({
        label: 'Planet cloud MC33 active-cell extraction',
        layout: 'auto',
        compute: { module: computeModule, entryPoint: 'extract_active' },
      }),
      device.createComputePipelineAsync({
        label: 'Planet cloud MC33 vertex projection',
        layout: 'auto',
        compute: { module: computeModule, entryPoint: 'project_vertices' },
      }),
      device.createComputePipelineAsync({
        label: 'Planet cloud MC33 draw preparation',
        layout: 'auto',
        compute: { module: computeModule, entryPoint: 'prepare_draw_indirect' },
      }),
      device.createRenderPipelineAsync({
        label: 'Planet cloud MC33 surface render',
        layout: 'auto',
        vertex: { module: renderModule, entryPoint: 'vs_main' },
        fragment: {
          module: renderModule,
          entryPoint: 'fs_main',
          targets: [{
            format: colorFormat,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          }],
        },
        primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none' },
        depthStencil: {
          format: 'depth24plus',
          depthWriteEnabled: true,
          depthCompare: 'less',
        },
        multisample: { count: sampleCount },
      }),
    ]);
    return {
      tilePipeline,
      fieldPipeline,
      classifyPipeline,
      prepareExtractPipeline,
      extractPipeline,
      projectPipeline,
      indirectPipeline,
      renderPipeline,
    };
  })();

  const pending=promise.catch(error=>{
    if(byFormat.get(pipelineKey)===pending)byFormat.delete(pipelineKey);
    throw error;
  });
  byFormat.set(pipelineKey, pending);
  return pending;
}


async function bakeSurfaceTextures(layer, bakeOptions = {}) {
  const options = { ...layer.options, ...bakeOptions.options };
  layer.surfaceNoise ||= new PlanetCloudNoise(layer.device);
  const key = `${options.resourceNonce || 'mc33'}-${bakeOptions.quality || 'full'}`;
  const stage = bakeOptions.timingReport?.start('surface-3d-noise-buffer-compile-and-dispatch', {
    shapeSize: options.surfaceShapeSize ?? 64,
    weatherSize: [options.surfaceMapWidth ?? 512, options.surfaceMapHeight ?? 256],
  }, 'gpu-submit');
  const maps = await layer.surfaceNoise.bake({key, seed:layer.seed,
    shapeSize:options.surfaceShapeSize ?? 64,
    weatherWidth:options.surfaceMapWidth ?? 512, weatherHeight:options.surfaceMapHeight ?? 256,
    weatherStyle:options.cloudStyle});
  if(layer.disposed){layer.surfaceNoise.release(key);throw new Error('MC33 layer disposed during texture preparation');}
  if (bakeOptions.waitForGpu) await layer.queue.onSubmittedWorkDone();
  layer.textures = {weatherView:maps.weatherView, shapeView:maps.shapeView, detailView:maps.shapeView};
  layer.resourceKeys = {noise:key};
  bakeOptions.timingReport?.end(stage);
  bakeOptions.onTiming?.(bakeOptions.timingReport?.snapshot());
  return {textures:layer.textures, resourceKeys:layer.resourceKeys};
}


function createBufferWithData(device, data, usage, label) {
  const buffer = device.createBuffer({
    label,
    size: Math.max(4, Math.ceil(data.byteLength / 4) * 4),
    usage,
    mappedAtCreation: true,
  });
  const mapped = new Uint8Array(buffer.getMappedRange());
  mapped.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  buffer.unmap();
  return buffer;
}

function destroyGpuResources(layer) {
  const keys = [
    'tableBuffer', 'positionBuffer', 'normalBuffer', 'counterBuffer',
    'indirectBuffer', 'computeParamsBuffer', 'renderParamsBuffer',
    'activeCellBuffer', 'activeCounterBuffer', 'extractDispatchBuffer',
    'statusBuffer', 'projectionDispatchBuffer',
  ];
  for (const key of keys) {
    try { layer[key]?.destroy?.(); } catch {}
    layer[key] = null;
  }
  for (const buffer of layer.tileFlagBuffers || []) {
    try { buffer?.destroy?.(); } catch {}
  }
  layer.tileFlagBuffers = [];
  for (const buffer of layer.fieldBuffers || []) {
    try { buffer?.destroy?.(); } catch {}
  }
  layer.fieldBuffers = [];
  layer.tileBindGroups = [];
  layer.fieldBindGroups = [];
  layer.classifyBindGroups = [];
  layer.extractBindGroups = [];
}

function createGpuResources(layer) {
  destroyGpuResources(layer);
  const { device, options } = layer;
  const requestedMaxVertices = Math.max(30_000, Math.floor(options.surfaceMaxVertices ?? DEFAULT_MAX_VERTICES));
  const maxVertices = Math.max(36, Math.floor(requestedMaxVertices / 36) * 36);
  const angularPoints = layer.angularCells + 1;
  const radialPoints = layer.radialCells + 1;
  const fieldPointCount = 6 * angularPoints * angularPoints * radialPoints;
  const totalCellCount = 6 * layer.angularCells * layer.angularCells * layer.radialCells;
  const tilesPerAxis = Math.max(1, Math.ceil(layer.angularCells / layer.tileCells));
  const totalTiles = 6 * tilesPerAxis * tilesPerAxis;
  const requestedMaxActiveCells = Math.floor(options.surfaceMaxActiveCells ?? Math.min(totalCellCount, 2_000_000));
  const maxActiveCells = clamp(requestedMaxActiveCells, 1024, totalCellCount);

  layer.maxVertices = maxVertices;
  layer.pointsPerFace = angularPoints * angularPoints * radialPoints;
  layer.fieldPointCount = fieldPointCount;
  layer.totalCellCount = totalCellCount;
  layer.maxActiveCells = maxActiveCells;
  layer.tilesPerAxis = tilesPerAxis;
  layer.totalTiles = totalTiles;
  layer.currentFieldIndex = 0;
  layer.fieldHistoryCount = 0;
  layer.currentTileIndex = 0;
  layer.tileHistoryValid = false;
  layer.currentFieldFaceMask = 0;
  layer.fieldValid = false;
  layer.topologyDirty = true;
  layer.lastFieldUpdateTime = -Infinity;
  layer.lastExtractionTime = -Infinity;

  layer.tableBuffer = createBufferWithData(
    device,
    MC33_ALL_TABLES,
    GPUBufferUsage.STORAGE,
    'MC33 table buffer',
  );
  layer.positionBuffer = device.createBuffer({
    label: 'Planet cloud MC33 positions',
    size: maxVertices * 16,
    usage: GPUBufferUsage.STORAGE,
  });
  layer.normalBuffer = device.createBuffer({
    label: 'Planet cloud MC33 normals',
    size: maxVertices * 16,
    usage: GPUBufferUsage.STORAGE,
  });
  layer.counterBuffer = device.createBuffer({
    label: 'Planet cloud MC33 vertex counter',
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  layer.indirectBuffer = device.createBuffer({
    label: 'Planet cloud MC33 indirect draw',
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT,
  });
  layer.activeCellBuffer = device.createBuffer({
    label: 'Planet cloud MC33 compacted active cells',
    size: maxActiveCells * 4,
    usage: GPUBufferUsage.STORAGE,
  });
  layer.activeCounterBuffer = device.createBuffer({
    label: 'Planet cloud MC33 active-cell counter',
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  layer.extractDispatchBuffer = device.createBuffer({
    label: 'Planet cloud MC33 indirect extraction dispatch',
    size: 12,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT,
  });
  layer.statusBuffer = device.createBuffer({
    label: 'Planet cloud MC33 overflow status',
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  layer.projectionDispatchBuffer = device.createBuffer({
    label: 'Planet cloud MC33 indirect projection dispatch',
    size: 12,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT,
  });
  layer.tileFlagBuffers = [0, 1].map((index) => device.createBuffer({
    label: `Planet cloud visible occupied tile flags ${index}`,
    size: Math.max(4, totalTiles * 4),
    usage: GPUBufferUsage.STORAGE,
  }));
  layer.fieldBuffers = [0, 1, 2].map((index) => device.createBuffer({
    label: `Planet cloud stable shell field ${index}`,
    size: fieldPointCount * 4,
    usage: GPUBufferUsage.STORAGE,
  }));
  layer.computeParamsBuffer = device.createBuffer({
    label: 'Planet cloud MC33 compute params',
    size: 256,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  layer.renderParamsBuffer = device.createBuffer({
    label: 'Planet cloud MC33 render params',
    size: 160,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  layer.sampler = device.createSampler({
    label: 'Planet cloud surface sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    addressModeW: 'repeat',
  });
}

function computeVisibleFaceMask(cameraPosition, options = {}) {
  if (options.surfaceUseFaceCulling !== true) return 0x3f;
  const cameraDirection = normalize3(cameraPosition, [0, 0, 1]);
  const normals = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1],
  ];
  let mask = 0;
  for (let face = 0; face < normals.length; face += 1) {
    const normal = normals[face];
    const facing = normal[0] * cameraDirection[0] + normal[1] * cameraDirection[1] + normal[2] * cameraDirection[2];
    if (facing > -0.62) mask |= 1 << face;
  }
  return mask || 0x3f;
}

function countBits32(value) {
  let bits = value >>> 0;
  let count = 0;
  while (bits !== 0) {
    bits &= bits - 1;
    count += 1;
  }
  return count;
}

function writeComputeParams(layer, camera, elapsedSeconds, fieldBlend) {
  const options = layer.options;
  const cameraPosition = normalizeVectorInput(camera.camPos, [0, 0, layer.radius * 4]);
  const cameraRight = normalize3(normalizeVectorInput(camera.right, [1, 0, 0]), [1, 0, 0]);
  const cameraUp = normalize3(normalizeVectorInput(camera.up, [0, 1, 0]), [0, 1, 0]);
  const cameraForward = normalize3(normalizeVectorInput(camera.fwd, [0, 0, -1]), [0, 0, -1]);
  const fovY = clamp(finiteNumber(camera.fovYDeg, 60), 1, 175) * Math.PI / 180;
  const aspect = Math.max(0.05, finiteNumber(camera.aspect, layer.canvas.width / Math.max(layer.canvas.height, 1)));
  const buffer = new ArrayBuffer(256);
  const view = new DataView(buffer);
  view.setUint32(0, layer.angularCells, true);
  view.setUint32(4, layer.radialCells, true);
  const visibleFaceMask = computeVisibleFaceMask(cameraPosition, options);
  layer.visibleFaceMask = visibleFaceMask;
  layer.visibleFaceCount = countBits32(visibleFaceMask);
  view.setUint32(8, visibleFaceMask, true);
  view.setUint32(12, layer.maxVertices, true);
  view.setFloat32(16, layer.radius, true);
  view.setFloat32(20, finiteNumber(options.cloudBottom, 1.6), true);
  view.setFloat32(24, finiteNumber(options.cloudTop, 6.0), true);
  view.setFloat32(28, finiteNumber(options.params?.globalCoverage, 0.82), true);
  view.setFloat32(32, finiteNumber(options.surfaceHeightScale, 1.0), true);
  view.setFloat32(36, finiteNumber(options.surfaceMinThickness, 0.58), true);
  view.setFloat32(40, finiteNumber(options.surfaceMaxThickness, 2.35), true);
  view.setFloat32(44, finiteNumber(options.surfaceBulgeStrength, 1.25), true);
  view.setFloat32(48, finiteNumber(options.surfaceCavityStrength, 0.34), true);
  view.setFloat32(52, finiteNumber(options.surfaceLowPush, 0.028), true);
  view.setFloat32(56, finiteNumber(options.surfaceCurlPush, 0.015), true);
  view.setFloat32(60, finiteNumber(options.surfaceDetailPush, 0.0), true);
  // Public spinSpeed is turns/second, as in the raymarch renderer. Explicit
  // surface angular overrides remain radians/second for compatibility.
  const windSpeed=finiteNumber(options.spinSpeed,0.00065)*2*Math.PI;
  view.setFloat32(64, elapsedSeconds * finiteNumber(options.surfaceWeatherSpeed, windSpeed), true);
  view.setFloat32(68, elapsedSeconds * finiteNumber(options.surfaceShapeSpeed, windSpeed), true);
  view.setFloat32(72, elapsedSeconds * Math.max(0,finiteNumber(options.evolutionSpeed,0.03)), true);
  view.setFloat32(76, finiteNumber(options.surfaceNormalEpsilon, 0.035), true);
  writeVec3(view, 80, cameraPosition);
  view.setFloat32(92, Math.tan(fovY * 0.5), true);
  writeVec3(view, 96, cameraRight);
  view.setFloat32(108, aspect, true);
  writeVec3(view, 112, cameraUp);
  view.setFloat32(124, finiteNumber(options.surfaceFrustumGuard, 1.22), true);
  writeVec3(view, 128, cameraForward);
  view.setFloat32(140, finiteNumber(options.surfaceHorizonGuard, -0.16), true);
  writeVec2(view, 144, options.surfaceWeatherScale || [1, 1]);
  writeVec2(view, 152, options.surfaceShapeScale || [1, 1]);
  writeVec2(view, 160, options.surfaceDetailScale || [1, 1]);
  view.setFloat32(168, clamp(finiteNumber(fieldBlend, 1.0), 0, 1), true);
  view.setUint32(172, layer.fieldValid ? 1 : 0, true);
  view.setUint32(176, layer.maxActiveCells, true);
  view.setFloat32(180, clamp(finiteNumber(options.surfaceProjectionStrength, 0.012), 0, 1), true);
  view.setFloat32(184, Math.max(0, finiteNumber(options.surfaceProjectionMaxStep, 0.004)), true);
  view.setFloat32(188, clamp(finiteNumber(options.surfaceOcclusionRadiusScale, 1.04), 0.90, 1.10), true);
  view.setUint32(192, layer.currentFieldFaceMask || 0, true);
  view.setUint32(196, layer.tileCells, true);
  view.setUint32(200, layer.tilesPerAxis, true);
  view.setUint32(204, layer.totalTiles, true);
  view.setUint32(208, layer.tileHistoryValid ? 1 : 0, true);
  view.setFloat32(212, Math.max(0, finiteNumber(options.surfaceIsoHysteresis, 0.0)), true);
  view.setFloat32(216, Math.max(0, finiteNumber(options.surfaceTileCoverageGuard, 0.30)), true);
  view.setFloat32(220, Math.max(1, finiteNumber(options.surfaceTileFrustumGuard, 1.35)), true);
  view.setFloat32(224, finiteNumber(options.surfaceTileHorizonGuard, -0.22), true);
  view.setFloat32(228, Math.max(0, finiteNumber(options.surfaceTileRadialGuard, 1.10)), true);
  view.setUint32(232, options.surfaceUseTileCulling === true ? 1 : 0, true);
  view.setUint32(236, Math.min(2, Math.max(0, layer.fieldHistoryCount || 0)), true);
  view.setFloat32(240, Math.max(0, finiteNumber(options.surfaceVoxelPersistenceBand, 0.035)), true);
  view.setFloat32(244, clamp(finiteNumber(options.surfaceVoxelHistoryWeight, 0.82), 0, 0.98), true);
  view.setFloat32(248, finiteNumber(options.tuning?.formType, 2), true);
  view.setFloat32(252, finiteNumber(options.worldToUV, 2.4/layer.radius) * finiteNumber(options.transforms?.shapeScale, 0.44), true);
  layer.queue.writeBuffer(layer.computeParamsBuffer, 0, buffer);
  return { cameraPosition, cameraRight, cameraUp, cameraForward, fovY, aspect };
}

function writeRenderParams(layer, cameraValues, sunDirection, elapsedSeconds) {
  const options = layer.options;
  const buffer = new ArrayBuffer(160);
  const view = new DataView(buffer);
  writeVec3(view, 0, cameraValues.cameraPosition);
  view.setFloat32(12, Math.tan(cameraValues.fovY * 0.5), true);
  writeVec3(view, 16, cameraValues.cameraRight);
  view.setFloat32(28, cameraValues.aspect, true);
  writeVec3(view, 32, cameraValues.cameraUp);
  view.setFloat32(44, finiteNumber(options.surfaceNearPlane, 0.05), true);
  writeVec3(view, 48, cameraValues.cameraForward);
  view.setFloat32(60, finiteNumber(options.surfaceFarPlane, layer.radius * 16), true);
  writeVec3(view, 64, normalize3(sunDirection, [0.65, 0.37, -0.65]));
  view.setFloat32(76, clamp(finiteNumber(options.surfaceOpacity, 0.995), 0, 1), true);
  writeVec3(view, 80, options.surfaceLightColor || options.params?.frontLightColor || [1.30, 1.30, 1.22]);
  view.setFloat32(92, finiteNumber(options.surfaceSilverStrength, 0.82), true);
  writeVec3(view, 96, options.surfaceShadowColor || options.params?.shadowLightColor || [0.34, 0.42, 0.56]);
  view.setFloat32(108, finiteNumber(options.surfaceAmbient, 0.08), true);
  view.setFloat32(112, layer.radius, true);
  view.setFloat32(116, finiteNumber(options.worldToUV, 2.4/layer.radius) * finiteNumber(options.transforms?.shapeScale, 0.44), true);
  view.setFloat32(120, finiteNumber(options.surfaceFragmentDetailStrength, 0.38), true);
  view.setFloat32(124, elapsedSeconds * finiteNumber(options.surfaceFragmentDetailSpeed, finiteNumber(options.surfaceShapeSpeed, finiteNumber(options.spinSpeed, 0.00065)*2*Math.PI)), true);
  const fallbackTerrainRadius = layer.radius + Math.max(0.32, layer.radius * 0.006);
  // A global maximum terrain height is not a depth map: treating the highest
  // mountain as a solid planet erased every thin-layer cloud. Keep analytic
  // horizon occlusion below the shell's base, independently of terrain peaks.
  const shellOcclusionLimit=layer.radius+Math.max(0,finiteNumber(options.cloudBottom,1.6))*0.5;
  view.setFloat32(128, Math.min(shellOcclusionLimit, Math.max(layer.radius, finiteNumber(options.surfaceTerrainOcclusionRadius, fallbackTerrainRadius))), true);
  view.setFloat32(132, Math.max(0, finiteNumber(options.surfaceTerrainDepthBias, 0.06)), true);
  view.setFloat32(136, elapsedSeconds*Math.max(0,finiteNumber(options.evolutionSpeed,0.03)), true);
  view.setFloat32(140, finiteNumber(options.tuning?.formType, 2), true);
  view.setFloat32(144, elapsedSeconds*finiteNumber(options.surfaceWeatherSpeed,finiteNumber(options.spinSpeed,0.00065)*2*Math.PI), true);
  layer.queue.writeBuffer(layer.renderParamsBuffer, 0, buffer);
}

function normalizeVectorInput(value, fallback) {
  if (Array.isArray(value)) return [finiteNumber(value[0], fallback[0]), finiteNumber(value[1], fallback[1]), finiteNumber(value[2], fallback[2])];
  return [finiteNumber(value?.x, fallback[0]), finiteNumber(value?.y, fallback[1]), finiteNumber(value?.z, fallback[2])];
}

function writeVec2(view, offset, value) {
  view.setFloat32(offset, finiteNumber(value?.[0] ?? value?.x, 1), true);
  view.setFloat32(offset + 4, finiteNumber(value?.[1] ?? value?.y, 1), true);
}

function writeVec3(view, offset, value) {
  view.setFloat32(offset, finiteNumber(value?.[0] ?? value?.x, 0), true);
  view.setFloat32(offset + 4, finiteNumber(value?.[1] ?? value?.y, 0), true);
  view.setFloat32(offset + 8, finiteNumber(value?.[2] ?? value?.z, 0), true);
}

function ensureContext(layer) {
  const { width, height } = resizeOverlayCanvas(layer.canvas, layer.sourceCanvas, layer.options);
  if (!layer.context) layer.context = layer.canvas.getContext('webgpu');
  if (!layer.contextConfigured || layer.contextWidth !== width || layer.contextHeight !== height) {
    layer.context.configure({
      device: layer.device,
      format: layer.colorFormat,
      alphaMode: 'premultiplied',
    });
    layer.depthTexture?.destroy?.();
    layer.msaaTexture?.destroy?.();
    layer.depthTexture = layer.device.createTexture({
      label: 'Planet cloud surface depth',
      size: [width, height, 1],
      sampleCount: layer.sampleCount,
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    layer.msaaTexture = layer.sampleCount > 1 ? layer.device.createTexture({
      label: 'Planet cloud surface MSAA color',
      size: [width, height, 1],
      sampleCount: layer.sampleCount,
      format: layer.colorFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    }) : null;
    layer.contextConfigured = true;
    layer.contextWidth = width;
    layer.contextHeight = height;
  }
}

function createBindGroups(layer) {
  layer.tileBindGroups = [0, 1].map((destinationIndex) => layer.device.createBindGroup({
    label: `Planet cloud visible occupied tile bind group ${destinationIndex}`,
    layout: layer.pipelines.tilePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 8, resource: { buffer: layer.computeParamsBuffer } },
      { binding: 17, resource: { buffer: layer.tileFlagBuffers[destinationIndex] } },
      { binding: 15, resource: { buffer: layer.statusBuffer } },
    ],
  }));

  layer.fieldBindGroups = [0, 1, 2].map((destinationIndex) => {
    const previousIndex = (destinationIndex + 2) % 3;
    const olderIndex = (destinationIndex + 1) % 3;
    return layer.device.createBindGroup({
      label: `Planet cloud shell field bind group ${destinationIndex}`,
      layout: layer.pipelines.fieldPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: layer.textures.weatherView },
        { binding: 1, resource: layer.textures.shapeView },
        { binding: 3, resource: layer.sampler },
        { binding: 8, resource: { buffer: layer.computeParamsBuffer } },
        { binding: 10, resource: { buffer: layer.fieldBuffers[previousIndex] } },
        { binding: 11, resource: { buffer: layer.fieldBuffers[destinationIndex] } },
        { binding: 17, resource: { buffer: layer.tileFlagBuffers[destinationIndex % 2] } },
        { binding: 18, resource: { buffer: layer.tileFlagBuffers[1 - (destinationIndex % 2)] } },
        { binding: 19, resource: { buffer: layer.fieldBuffers[olderIndex] } },
      ],
    });
  });

  layer.classifyBindGroups = [0, 1, 2].map((fieldIndex) => layer.device.createBindGroup({
    label: `Planet cloud active-cell classification bind group ${fieldIndex}`,
    layout: layer.pipelines.classifyPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 8, resource: { buffer: layer.computeParamsBuffer } },
      { binding: 11, resource: { buffer: layer.fieldBuffers[fieldIndex] } },
      { binding: 12, resource: { buffer: layer.activeCellBuffer } },
      { binding: 13, resource: { buffer: layer.activeCounterBuffer } },
      { binding: 15, resource: { buffer: layer.statusBuffer } },
      { binding: 17, resource: { buffer: layer.tileFlagBuffers[fieldIndex % 2] } },
    ],
  }));

  layer.prepareExtractBindGroup = layer.device.createBindGroup({
    label: 'Planet cloud active-cell dispatch bind group',
    layout: layer.pipelines.prepareExtractPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 8, resource: { buffer: layer.computeParamsBuffer } },
      { binding: 13, resource: { buffer: layer.activeCounterBuffer } },
      { binding: 14, resource: { buffer: layer.extractDispatchBuffer } },
    ],
  });

  layer.extractBindGroups = [0, 1, 2].map((fieldIndex) => layer.device.createBindGroup({
    label: `Planet cloud MC33 extraction bind group ${fieldIndex}`,
    layout: layer.pipelines.extractPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 4, resource: { buffer: layer.tableBuffer } },
      { binding: 5, resource: { buffer: layer.positionBuffer } },
      { binding: 6, resource: { buffer: layer.normalBuffer } },
      { binding: 7, resource: { buffer: layer.counterBuffer } },
      { binding: 8, resource: { buffer: layer.computeParamsBuffer } },
      { binding: 11, resource: { buffer: layer.fieldBuffers[fieldIndex] } },
      { binding: 12, resource: { buffer: layer.activeCellBuffer } },
      { binding: 13, resource: { buffer: layer.activeCounterBuffer } },
      { binding: 15, resource: { buffer: layer.statusBuffer } },
    ],
  }));

  layer.projectBindGroups = [0, 1, 2].map((fieldIndex) => layer.device.createBindGroup({
    label: `Planet cloud MC33 vertex projection bind group ${fieldIndex}`,
    layout: layer.pipelines.projectPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 5, resource: { buffer: layer.positionBuffer } },
      { binding: 6, resource: { buffer: layer.normalBuffer } },
      { binding: 7, resource: { buffer: layer.counterBuffer } },
      { binding: 8, resource: { buffer: layer.computeParamsBuffer } },
      { binding: 11, resource: { buffer: layer.fieldBuffers[fieldIndex] } },
    ],
  }));

  layer.indirectBindGroup = layer.device.createBindGroup({
    label: 'Planet cloud MC33 draw bind group',
    layout: layer.pipelines.indirectPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 7, resource: { buffer: layer.counterBuffer } },
      { binding: 8, resource: { buffer: layer.computeParamsBuffer } },
      { binding: 9, resource: { buffer: layer.indirectBuffer } },
      { binding: 16, resource: { buffer: layer.projectionDispatchBuffer } },
    ],
  });
  layer.renderBindGroup = layer.device.createBindGroup({
    label: 'Planet cloud surface render bind group',
    layout: layer.pipelines.renderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: layer.positionBuffer } },
      { binding: 1, resource: { buffer: layer.normalBuffer } },
      { binding: 2, resource: { buffer: layer.renderParamsBuffer } },
      { binding: 3, resource: layer.textures.detailView },
      { binding: 4, resource: layer.sampler },
      { binding: 5, resource: layer.textures.weatherView },
    ],
  });
}

function encodeSurfaceCompute(layer, encoder, {
  updateField,
  updateMesh,
  destinationFieldIndex,
  destinationTileIndex,
  meshFieldIndex,
  candidateCells,
  projectVertices,
}) {
  if (updateField) {
    if (layer.options.surfaceUseTileCulling === true) {
      const tilePass = encoder.beginComputePass({ label: 'Planet cloud visible occupied tile pass' });
      tilePass.setPipeline(layer.pipelines.tilePipeline);
      tilePass.setBindGroup(0, layer.tileBindGroups[destinationTileIndex]);
      tilePass.dispatchWorkgroups(Math.ceil(layer.totalTiles / 64));
      tilePass.end();
    }

    const fieldPass = encoder.beginComputePass({ label: 'Planet cloud stable shell field pass' });
    fieldPass.setPipeline(layer.pipelines.fieldPipeline);
    fieldPass.setBindGroup(0, layer.fieldBindGroups[destinationFieldIndex]);
    const visibleFieldPointCount = layer.pointsPerFace * Math.max(1, layer.visibleFaceCount || 1);
    fieldPass.dispatchWorkgroups(Math.ceil(visibleFieldPointCount / 128));
    fieldPass.end();
  }

  if (updateMesh) {
    const classifyPass = encoder.beginComputePass({ label: 'Planet cloud visible active-cell classification pass' });
    classifyPass.setPipeline(layer.pipelines.classifyPipeline);
    classifyPass.setBindGroup(0, layer.classifyBindGroups[meshFieldIndex]);
    classifyPass.dispatchWorkgroups(Math.ceil(candidateCells / 128));
    classifyPass.end();

    const prepareExtractPass = encoder.beginComputePass({ label: 'Planet cloud active-cell dispatch preparation pass' });
    prepareExtractPass.setPipeline(layer.pipelines.prepareExtractPipeline);
    prepareExtractPass.setBindGroup(0, layer.prepareExtractBindGroup);
    prepareExtractPass.dispatchWorkgroups(1);
    prepareExtractPass.end();

    const extractPass = encoder.beginComputePass({ label: 'Planet cloud compacted MC33 extraction pass' });
    extractPass.setPipeline(layer.pipelines.extractPipeline);
    extractPass.setBindGroup(0, layer.extractBindGroups[meshFieldIndex]);
    extractPass.dispatchWorkgroupsIndirect(layer.extractDispatchBuffer, 0);
    extractPass.end();

    const indirectPass = encoder.beginComputePass({ label: 'Planet cloud MC33 draw preparation pass' });
    indirectPass.setPipeline(layer.pipelines.indirectPipeline);
    indirectPass.setBindGroup(0, layer.indirectBindGroup);
    indirectPass.dispatchWorkgroups(1);
    indirectPass.end();
  }
  if (projectVertices) {
    const projectPass = encoder.beginComputePass({ label: 'Planet cloud MC33 vertex projection pass' });
    projectPass.setPipeline(layer.pipelines.projectPipeline);
    projectPass.setBindGroup(0, layer.projectBindGroups[meshFieldIndex]);
    projectPass.dispatchWorkgroupsIndirect(layer.projectionDispatchBuffer, 0);
    projectPass.end();
  }
}

function encodeRenderSurface(layer, encoder) {
  const currentView = layer.context.getCurrentTexture().createView();
  const pass = encoder.beginRenderPass({
    label: 'Planet cloud surface render pass',
    colorAttachments: [{
      view: layer.msaaTexture ? layer.msaaTexture.createView() : currentView,
      resolveTarget: layer.msaaTexture ? currentView : undefined,
      clearValue: { r: 0, g: 0, b: 0, a: 0 },
      loadOp: 'clear',
      storeOp: layer.msaaTexture ? 'discard' : 'store',
    }],
    depthStencilAttachment: {
      view: layer.depthTexture.createView(),
      depthClearValue: 1,
      depthLoadOp: 'clear',
      depthStoreOp: 'discard',
    },
  });
  pass.setPipeline(layer.pipelines.renderPipeline);
  pass.setBindGroup(0, layer.renderBindGroup);
  pass.drawIndirect(layer.indirectBuffer, 0);
  pass.end();
}

export async function createPlanetCloudSurfaceLayer({
  device,
  queue,
  noiseBuilder = null,
  parent,
  sourceCanvas,
  getCameraState,
  getSunDir,
  radius = 50,
  atmosphereRadius = 68,
  options = {},
} = {}) {
  if (!device || !queue) throw new Error('createPlanetCloudSurfaceLayer requires a GPUDevice and GPUQueue.');
  if (!parent || !sourceCanvas) throw new Error('createPlanetCloudSurfaceLayer requires parent and sourceCanvas.');

  const defaultCloudBottom = Math.max(0.75, (atmosphereRadius - radius) * 0.09);
  const defaultCloudTop = Math.max(Math.max(0.75, (atmosphereRadius - radius) * 0.09) + 2.90, (atmosphereRadius - radius) * 0.285);
  const mergedOptions = {
    cloudRenderMode: 'mc33-shell',
    enabled: true,
    maxDpr: 1.5,
    surfaceMsaaSamples: 1,
    cloudBottom: defaultCloudBottom,
    cloudTop: defaultCloudTop,
    surfaceAngularCells: DEFAULT_ANGULAR_CELLS,
    surfaceRadialCells: DEFAULT_RADIAL_CELLS,
    surfaceTileCells: DEFAULT_TILE_CELLS,
    surfaceIsoHysteresis: 0.0,
    surfaceTileCoverageGuard: 0.30,
    surfaceUseTileCulling: false,
    surfaceUseFaceCulling: false,
    surfaceTileFrustumGuard: 1.35,
    surfaceTileHorizonGuard: -0.22,
    surfaceTileRadialGuard: 1.10,
    surfaceFieldUpdateHz: 60,
    surfaceMeshUpdateHz: 60,
    surfaceComputeBudget: 0.35,
    surfaceAnimateTopology: true,
    surfaceFieldResponseTime: 0.34,
    surfaceVoxelPersistenceBand: 0.035,
    surfaceVoxelHistoryWeight: 0.82,
    surfaceVertexProjection: true,
    surfaceProjectionStrength: 0.012,
    surfaceProjectionMaxStep: 0.004,
    surfaceOcclusionRadiusScale: 1.0,
    surfaceTerrainOcclusionRadius: radius + Math.max(0.32, radius * 0.006),
    surfaceTerrainDepthBias: 0.06,
    surfaceHeightScale: 1.10,
    surfaceWeatherScale: [0.90, 0.90],
    surfaceShapeScale: [1.28, 1.28],
    surfaceDetailScale: [1.65, 1.65],
    surfaceCoverageThreshold: 0.42,
    surfaceMaxVertices: DEFAULT_MAX_VERTICES,
    surfaceMaxActiveCells: 200000,
    surfaceSilverStrength: 0.82,
    surfaceAmbient: 0.08,
    surfaceFragmentDetailStrength: 0.34,
    progressiveStartup: false,
    bootstrapSurfaceMapWidth: 128,
    bootstrapSurfaceMapHeight: 64,
    bootstrapSurfaceDetailWidth: 128,
    bootstrapSurfaceDetailHeight: 64,
    bootstrapSurfaceAngularCells: 28,
    bootstrapSurfaceRadialCells: 6,
    bootstrapSurfaceMaxVertices: 90000,
    bootstrapSurfaceMaxActiveCells: 18000,
    surfaceMinThickness: Math.max(0.58, (defaultCloudTop - defaultCloudBottom) * 0.24),
    surfaceMaxThickness: Math.max(2.10, (defaultCloudTop - defaultCloudBottom) * 0.72),
    surfaceBulgeStrength: Math.max(1.10, (defaultCloudTop - defaultCloudBottom) * 0.46),
    resourceNonce: options.resourceNonce || `surface-${Math.floor(options.seed ?? Date.now()) >>> 0}`,
    ...options,
  };
  const seed = Math.floor(mergedOptions.seed ?? Date.now()) >>> 0;
  const startupTiming = new CloudTimingReport('planet-cloud-surface-first-load', {
    seed,
    progressive: mergedOptions.progressiveStartup !== false,
    fullResolution: {
      map: [mergedOptions.surfaceMapWidth ?? 512, mergedOptions.surfaceMapHeight ?? 256],
      shape: [mergedOptions.surfaceShapeSize ?? 64, mergedOptions.surfaceShapeSize ?? 64, mergedOptions.surfaceShapeSize ?? 64],
      angularCells: mergedOptions.surfaceAngularCells,
      radialCells: mergedOptions.surfaceRadialCells,
    },
  });
  const setupStage = startupTiming.start('surface-canvas-builder-and-layer-state', undefined, 'setup');
  const canvas = createOverlayCanvas(parent, sourceCanvas, mergedOptions);
  const colorFormat = navigator.gpu.getPreferredCanvasFormat?.() || 'bgra8unorm';
  try { builder.buildPermTable?.(seed); } catch {}

  const layer = {
    kind: 'mc33-shell',
    device,
    queue,
    parent,
    sourceCanvas,
    canvas,
    colorFormat,
    context: null,
    contextConfigured: false,
    depthTexture: null,
    msaaTexture: null,
    noiseBuilder,
    options: mergedOptions,
    sampleCount: Number(mergedOptions.surfaceMsaaSamples) >= 4 ? 4 : 1,
    seed,
    radius,
    atmosphereRadius,
    getCameraState: getCameraState || (() => ({
      camPos: [0, 0, radius * 4],
      right: [1, 0, 0],
      up: [0, 1, 0],
      fwd: [0, 0, -1],
      fovYDeg: 60,
      aspect: sourceCanvas.width / Math.max(sourceCanvas.height, 1),
    })),
    getSunDir: getSunDir || (() => [0.65, 0.37, -0.65]),
    angularCells: clamp(Math.floor(mergedOptions.surfaceAngularCells), 16, 256),
    radialCells: clamp(Math.floor(mergedOptions.surfaceRadialCells), 4, 64),
    tileCells: clamp(Math.floor(mergedOptions.surfaceTileCells ?? DEFAULT_TILE_CELLS), 2, 32),
    lastFieldUpdateTime: -Infinity,
    lastExtractionTime: -Infinity,
    currentFieldIndex: 0,
    currentTileIndex: 0,
    tileHistoryValid: false,
    currentFieldFaceMask: 0,
    fieldValid: false,
    topologyDirty: true,
    disposed: false,
    refining: false,
    startupTiming: startupTiming.snapshot(),
    refinementPromise: null,
    bootstrapResourceKeys: null,
  };
  startupTiming.end(setupStage);

  const publishStartupTiming = (snapshot, complete = false) => {
    layer.startupTiming = snapshot;
    try { layer.options.onStartupTiming?.(snapshot, layer); } catch {}
    try {
      window.dispatchEvent?.(new CustomEvent('planet-cloud-startup-timing', {
        detail: { layer, report: snapshot, complete },
      }));
    } catch {}
    return snapshot;
  };

  try {
    const pipelineStage = startupTiming.start('surface-pipeline-warmup', undefined, 'pipeline');
    const pipelinePromise = getPipelines(device, colorFormat, layer.sampleCount).then((pipelines) => {
      startupTiming.end(pipelineStage);
      return pipelines;
    });

    if (mergedOptions.progressiveStartup !== false) {
      const bootstrapOptions = {
        surfaceMapWidth: Math.max(128, Math.min(mergedOptions.surfaceMapWidth ?? 1024, mergedOptions.bootstrapSurfaceMapWidth || 128)),
        surfaceMapHeight: Math.max(64, Math.min(mergedOptions.surfaceMapHeight ?? 512, mergedOptions.bootstrapSurfaceMapHeight || 64)),
        surfaceDetailWidth: Math.max(128, Math.min(mergedOptions.surfaceDetailWidth ?? 512, mergedOptions.bootstrapSurfaceDetailWidth || 128)),
        surfaceDetailHeight: Math.max(64, Math.min(mergedOptions.surfaceDetailHeight ?? 256, mergedOptions.bootstrapSurfaceDetailHeight || 64)),
        surfaceMaxVertices: Math.min(mergedOptions.surfaceMaxVertices, mergedOptions.bootstrapSurfaceMaxVertices || 90000),
        surfaceMaxActiveCells: Math.min(mergedOptions.surfaceMaxActiveCells, mergedOptions.bootstrapSurfaceMaxActiveCells || 18000),
        resourceNonce: `${mergedOptions.resourceNonce}-bootstrap`,
      };
      await bakeSurfaceTextures(layer, {
        quality: 'bootstrap',
        options: bootstrapOptions,
        timingReport: startupTiming,
        waitForGpu: true,
        onTiming: (snapshot) => publishStartupTiming(snapshot, false),
      });
      layer.bootstrapResourceKeys = { ...(layer.resourceKeys || {}) };
      layer.pipelines = await pipelinePromise;

      const originalOptions = layer.options;
      layer.options = { ...originalOptions, ...bootstrapOptions };
      layer.angularCells = clamp(
        Math.floor(originalOptions.bootstrapSurfaceAngularCells || 28),
        16,
        Math.floor(originalOptions.surfaceAngularCells),
      );
      layer.radialCells = clamp(
        Math.floor(originalOptions.bootstrapSurfaceRadialCells || 6),
        4,
        Math.floor(originalOptions.surfaceRadialCells),
      );
      layer.tileCells = clamp(Math.floor(originalOptions.surfaceTileCells ?? DEFAULT_TILE_CELLS), 2, 32);

      let stage = startupTiming.start('bootstrap-surface-gpu-buffer-allocation', {
        angularCells: layer.angularCells,
        radialCells: layer.radialCells,
      }, 'buffering');
      createGpuResources(layer);
      createBindGroups(layer);
      startupTiming.end(stage, {
        fieldPointCount: layer.fieldPointCount,
        maxVertices: layer.maxVertices,
      });
      stage = startupTiming.start('bootstrap-surface-field-extract-and-present', undefined, 'first-frame');
      publishStartupTiming(startupTiming.snapshot(), false);
      await updatePlanetCloudSurfaceLayer(layer, { forceExtract: true });
      let gpuWaitMs = 0;
      if (typeof queue.onSubmittedWorkDone === 'function') {
        startupTiming.mark('bootstrap-surface-gpu-wait-start');
        publishStartupTiming(startupTiming.snapshot(), false);
        const waitStarted = performance.now();
        await queue.onSubmittedWorkDone();
        gpuWaitMs = performance.now() - waitStarted;
      }
      startupTiming.end(stage, { gpuWaitMs });
      layer.options = originalOptions;
      startupTiming.mark('first-frame-visible');
      publishStartupTiming(startupTiming.snapshot(), false);

      layer.refining = true;
      layer.refinementPromise = new Promise((resolve) => setTimeout(resolve, 0))
        .then(async () => {
          if (layer.disposed) {
            layer.refining = false;
            startupTiming.mark('refinement-cancelled');
            publishStartupTiming(startupTiming.finish({ cancelled: true }), true);
            return layer;
          }
          await bakeSurfaceTextures(layer, {
            quality: 'full',
            timingReport: startupTiming,
            waitForGpu: true,
            onTiming: (snapshot) => publishStartupTiming(snapshot, false),
          });
          if (layer.disposed) {
            if (layer.resourceKeys) {
              for (const key of Object.values(layer.resourceKeys)) {
                try { layer.surfaceNoise?.release(key); } catch {}
              }
            }
            layer.refining = false;
            startupTiming.mark('refinement-cancelled');
            publishStartupTiming(startupTiming.finish({ cancelled: true }), true);
            return layer;
          }

          layer.angularCells = clamp(Math.floor(layer.options.surfaceAngularCells), 16, 256);
          layer.radialCells = clamp(Math.floor(layer.options.surfaceRadialCells), 4, 64);
          layer.tileCells = clamp(Math.floor(layer.options.surfaceTileCells ?? DEFAULT_TILE_CELLS), 2, 32);
          stage = startupTiming.start('full-surface-gpu-buffer-allocation', {
            angularCells: layer.angularCells,
            radialCells: layer.radialCells,
          }, 'buffering');
          createGpuResources(layer);
          createBindGroups(layer);
          layer._pendingSurfaceResourceRebuild = false;
          startupTiming.end(stage, {
            fieldPointCount: layer.fieldPointCount,
            maxVertices: layer.maxVertices,
          });
          layer.refining = false;
          stage = startupTiming.start('refined-surface-field-extract-and-present', undefined, 'refined-frame');
          publishStartupTiming(startupTiming.snapshot(), false);
          await updatePlanetCloudSurfaceLayer(layer, { forceExtract: true });
          gpuWaitMs = 0;
          if (typeof queue.onSubmittedWorkDone === 'function') {
            startupTiming.mark('refined-surface-gpu-wait-start');
            publishStartupTiming(startupTiming.snapshot(), false);
            const waitStarted = performance.now();
            await queue.onSubmittedWorkDone();
            gpuWaitMs = performance.now() - waitStarted;
          }
          startupTiming.end(stage, { gpuWaitMs });
          startupTiming.mark('full-quality-frame-visible');

          const bootstrapKeys = layer.bootstrapResourceKeys;
          if (bootstrapKeys) {
            for (const key of Object.values(bootstrapKeys)) {
              try { layer.surfaceNoise?.release(key); } catch {}
            }
          }
          layer.bootstrapResourceKeys = null;
          const finalTiming = startupTiming.finish({
            timeToFirstFrameMs: startupTiming.milestones.find((mark) => mark.name === 'first-frame-visible')?.atMs ?? null,
          });
          publishStartupTiming(finalTiming, true);
          return layer;
        })
        .catch((error) => {
          layer.refining = false;
          layer.refinementError = error;
          startupTiming.mark('refinement-failed', { error: String(error?.message || error) });
          publishStartupTiming(startupTiming.finish({ failed: true }), true);
          console.warn('Planet cloud surface full-resolution refinement failed; keeping bootstrap frame', error);
          return layer;
        });
      return layer;
    }

    await bakeSurfaceTextures(layer, {
      quality: 'full',
      timingReport: startupTiming,
      waitForGpu: true,
      onTiming: (snapshot) => publishStartupTiming(snapshot, false),
    });
    layer.pipelines = await pipelinePromise;
    let stage = startupTiming.start('surface-gpu-buffer-allocation', undefined, 'buffering');
    createGpuResources(layer);
    createBindGroups(layer);
    startupTiming.end(stage);
    stage = startupTiming.start('surface-field-extract-and-present', undefined, 'first-frame');
    await updatePlanetCloudSurfaceLayer(layer, { forceExtract: true });
    if (typeof queue.onSubmittedWorkDone === 'function') await queue.onSubmittedWorkDone();
    startupTiming.end(stage);
    startupTiming.mark('first-frame-visible');
    publishStartupTiming(startupTiming.finish({
      timeToFirstFrameMs: startupTiming.milestones.find((mark) => mark.name === 'first-frame-visible')?.atMs ?? null,
    }), true);
    return layer;
  } catch (error) {
    startupTiming.mark('startup-failed', { error: String(error?.message || error) });
    publishStartupTiming(startupTiming.finish({ failed: true }), true);
    disposePlanetCloudSurfaceLayer(layer);
    throw error;
  }
}

export function updatePlanetCloudSurfaceOptions(layer, options = {}) {
  if (!layer || layer.disposed) return null;
  const oldAngular = layer.angularCells;
  const oldRadial = layer.radialCells;
  const oldTileCells = layer.tileCells;
  const oldMaxVertices = layer.maxVertices;
  const oldMaxActiveCells = layer.maxActiveCells;
  layer.options = { ...layer.options, ...options };
  if (layer.refining) {
    layer._pendingSurfaceResourceRebuild = true;
    return layer.options;
  }
  layer.angularCells = clamp(Math.floor(layer.options.surfaceAngularCells ?? oldAngular), 16, 256);
  layer.radialCells = clamp(Math.floor(layer.options.surfaceRadialCells ?? oldRadial), 4, 64);
  layer.tileCells = clamp(Math.floor(layer.options.surfaceTileCells ?? oldTileCells), 2, 32);
  const requestedMaxVertices = Math.max(30_000, Math.floor(layer.options.surfaceMaxVertices ?? DEFAULT_MAX_VERTICES));
  const nextMaxVertices = Math.max(36, Math.floor(requestedMaxVertices / 36) * 36);
  const totalCellCount = 6 * layer.angularCells * layer.angularCells * layer.radialCells;
  const nextMaxActiveCells = clamp(
    Math.floor(layer.options.surfaceMaxActiveCells ?? Math.min(totalCellCount, 2_000_000)),
    1024,
    totalCellCount,
  );
  const resourceShapeChanged =
    layer.angularCells !== oldAngular ||
    layer.radialCells !== oldRadial ||
    layer.tileCells !== oldTileCells ||
    nextMaxVertices !== oldMaxVertices ||
    nextMaxActiveCells !== oldMaxActiveCells;
  if (resourceShapeChanged) {
    createGpuResources(layer);
    createBindGroups(layer);
  }
  layer.topologyDirty = true;
  layer.lastFieldUpdateTime = -Infinity;
  layer.lastExtractionTime = -Infinity;
  return layer.options;
}

export async function setPlanetCloudSurfaceStyle(layer, style) {
  const previousOptions=layer.options, previousTextures=layer.textures, previousKeys=layer.resourceKeys;
  const overrides=planetCloudStyleOptions(style,layer.radius);
  layer.styleChanging=true;
  try {
    layer.styleRevision=(layer.styleRevision || 0)+1;
    layer.options={...layer.options,...overrides,cloudStyle:style,cloudRenderMode:'mc33-shell',
      resourceNonce:`mc33-style-${layer.styleRevision}`};
    await bakeSurfaceTextures(layer,{waitForGpu:true});
    if(layer.disposed)return null;
    createBindGroups(layer);
    updatePlanetCloudSurfaceOptions(layer);
    layer.fieldValid=false;
    layer.diagnosticsPublished=false;
    layer.overflowReported=false;
    if(previousKeys)for(const key of Object.values(previousKeys))layer.surfaceNoise.release(key);
    return layer.options;
  } catch(error) {
    if(layer.resourceKeys !== previousKeys)for(const key of Object.values(layer.resourceKeys || {}))layer.surfaceNoise.release(key);
    layer.options=previousOptions;layer.textures=previousTextures;layer.resourceKeys=previousKeys;
    if(!layer.disposed)createBindGroups(layer);
    throw error;
  } finally {layer.styleChanging=false;}
}

export async function updatePlanetCloudSurfaceLayer(layer, { forceExtract = false } = {}) {
  if (!layer || layer.disposed || layer.options.enabled === false) return;
  // The bootstrap frame remains in the configured canvas while full maps and
  // field buffers are prepared; avoid queueing old-resolution extraction work.
  if (layer.refining || layer.styleChanging) return;
  ensureContext(layer);

  const now = performance.now();
  const encodeStarted = now;
  const elapsedSeconds = advancePlanetCloudTime(layer, now * 0.001);
  const camera = layer.getCameraState?.() || {};
  const cameraPositionForMask = normalizeVectorInput(camera.camPos, [0, 0, layer.radius * 4]);
  const requestedFaceMask = computeVisibleFaceMask(cameraPositionForMask, layer.options);
  const newlyVisibleFaces = requestedFaceMask & ~(layer.currentFieldFaceMask || 0);
  const cameraForwardForMesh=normalize3(normalizeVectorInput(camera.fwd,[0,0,-1]));
  const oldCamera=layer.meshCamera;
  // Classification is view-dependent even if face culling is disabled. Refresh
  // on a meaningful camera move, including when weather animation is paused.
  const cameraChanged=oldCamera && (Math.hypot(...cameraPositionForMask.map((v,i)=>v-oldCamera.position[i]))>layer.radius*0.025 ||
    cameraForwardForMesh.reduce((sum,v,i)=>sum+v*oldCamera.forward[i],0)<0.99);
  const fieldUpdateHz = Math.max(0.05, finiteNumber(layer.options.surfaceFieldUpdateHz, 60));
  const meshUpdateHz = Math.max(0.05, finiteNumber(layer.options.surfaceMeshUpdateHz, 60));
  const budget=clamp(finiteNumber(layer.options.surfaceComputeBudget,0.35),0.01,1);
  const budgetInterval=(layer.computeCompletionMs || 0)/budget;
  const fieldUpdateInterval = Math.max(1000 / fieldUpdateHz,budgetInterval);
  const meshUpdateInterval = Math.max(1000 / meshUpdateHz,budgetInterval);
  const canCompute=forceExtract || !layer.computePending;
  const animationActive=layer.options.animate !== false;
  // RAF intervals jitter slightly around 16.67 ms. Requiring an exact >= would
  // turn a 60 Hz target into every-other-frame updates on a 60 Hz display.
  const meshTolerance=Math.min(2,meshUpdateInterval*0.08);
  const fieldTolerance=Math.min(2,fieldUpdateInterval*0.08);
  const animatedTopologyDue = animationActive && layer.options.surfaceAnimateTopology === true && now - layer.lastExtractionTime >= meshUpdateInterval-meshTolerance;
  const updateMesh = canCompute && (forceExtract || !layer.fieldValid || newlyVisibleFaces !== 0 || cameraChanged || layer.topologyDirty === true || animatedTopologyDue);
  const updateField = canCompute && (forceExtract || !layer.fieldValid || newlyVisibleFaces !== 0 || updateMesh || (animationActive && now - layer.lastFieldUpdateTime >= fieldUpdateInterval-fieldTolerance));
  const fieldDeltaSeconds = Number.isFinite(layer.lastFieldUpdateTime)
    ? Math.max(0.0001, (now - layer.lastFieldUpdateTime) * 0.001)
    : 1.0;
  const responseTime = Math.max(0.001, finiteNumber(layer.options.surfaceFieldResponseTime, 0.34));
  const fieldBlend = layer.fieldValid
    ? 1.0 - Math.exp(-fieldDeltaSeconds / responseTime)
    : 1.0;

  const cameraValues = writeComputeParams(layer, camera, elapsedSeconds, fieldBlend);
  writeRenderParams(layer, cameraValues, layer.getSunDir?.() || [0.65, 0.37, -0.65], elapsedSeconds);

  const destinationFieldIndex = updateField ? (layer.currentFieldIndex + 1) % 3 : layer.currentFieldIndex;
  const destinationTileIndex = updateField ? 1 - layer.currentTileIndex : layer.currentTileIndex;
  const meshFieldIndex = updateField ? destinationFieldIndex : layer.currentFieldIndex;
  const projectVertices = (updateMesh || (layer.fieldValid && updateField)) && layer.options.surfaceVertexProjection !== false;
  const candidateCells = layer.angularCells * layer.angularCells * layer.radialCells * Math.max(1, layer.visibleFaceCount || 1);

  if (updateField || updateMesh) {
    layer.queue.writeBuffer(layer.statusBuffer, 0, new Uint32Array([0, 0, 0, 0]));
  }
  if (updateMesh) {
    layer.queue.writeBuffer(layer.activeCounterBuffer, 0, new Uint32Array([0]));
    layer.queue.writeBuffer(layer.counterBuffer, 0, new Uint32Array([0]));
  }

  const encoder = layer.device.createCommandEncoder({ label: 'Planet cloud MC33 shell frame encoder' });
  encodeSurfaceCompute(layer, encoder, {
    updateField,
    updateMesh,
    destinationFieldIndex,
    destinationTileIndex,
    meshFieldIndex,
    candidateCells,
    projectVertices,
  });
  encodeRenderSurface(layer, encoder);
  // Tiny, asynchronous diagnostic readback. Never wait for the GPU inside
  // the animation loop, and never read the full vertex/voxel buffers.
  let readback=null;
  if(updateMesh && !layer.diagnosticPending && now-(layer.lastDiagnosticTime || -Infinity)>1000) {
    readback=layer.device.createBuffer({label:'MC33 count/overflow diagnostic',size:24,
      usage:GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ});
    encoder.copyBufferToBuffer(layer.counterBuffer,0,readback,0,4);
    encoder.copyBufferToBuffer(layer.activeCounterBuffer,0,readback,4,4);
    encoder.copyBufferToBuffer(layer.statusBuffer,0,readback,8,16);
    layer.diagnosticPending=true;layer.lastDiagnosticTime=now;
  }
  const encodeMs=performance.now()-encodeStarted;
  const submitStarted=performance.now();
  layer.queue.submit([encoder.finish()]);
  const submitMs=performance.now()-submitStarted;
  // One in-flight refresh; never stall rendering or pile up extraction work.
  // This is submit-to-completion latency (including queue contention), not a
  // hardware timestamp. Use it conservatively to cap the refresh duty cycle.
  if((updateField || updateMesh) && layer.queue.onSubmittedWorkDone) {
    layer.computePending=true;
    layer.queue.onSubmittedWorkDone().then(()=>{
      if(!layer.disposed){
        const completion=performance.now()-submitStarted;
        layer.computeCompletionMs=layer.computeCompletionMs ? layer.computeCompletionMs*.7+completion*.3 : completion;
        Object.assign(layer.performanceStats || {},{computeCompletionMs:layer.computeCompletionMs,computePending:false});
      }
    }).catch(()=>{}).finally(()=>{layer.computePending=false;});
  }
  if(readback)readback.mapAsync(GPUMapMode.READ).then(()=>{
    const counts=new Uint32Array(readback.getMappedRange());
    if(layer.disposed)return;
    const vertices=Math.min(counts[0],layer.maxVertices);
    layer.meshDiagnostics={vertexCount:vertices,triangleCount:vertices/3,requestedVertexCount:counts[0],activeCellCount:counts[1],
      vertexOverflow:!!counts[2],activeCellOverflow:!!counts[3]};
    Object.assign(layer.performanceStats || {},layer.meshDiagnostics);
    if(!layer.diagnosticsPublished){console.info('[MC33 MESH]',JSON.stringify(layer.meshDiagnostics));layer.diagnosticsPublished=true;}
    if((counts[2] || counts[3]) && !layer.overflowReported){
      console.warn('[MC33] mesh capacity reached; increase surfaceMaxVertices / surfaceMaxActiveCells',layer.meshDiagnostics);
      layer.overflowReported=true;
    }
  }).catch(error=>{if(!layer.disposed)console.warn('MC33 diagnostic readback failed',error);})
    .finally(()=>{readback.destroy();layer.diagnosticPending=false;});

  if (updateField) {
    layer.currentFieldIndex = destinationFieldIndex;
    layer.fieldHistoryCount = Math.min(2, (layer.fieldHistoryCount || 0) + 1);
    layer.currentTileIndex = destinationTileIndex;
    layer.tileHistoryValid = true;
    layer.currentFieldFaceMask = layer.visibleFaceMask || requestedFaceMask;
    layer.fieldValid = true;
    layer.lastFieldUpdateTime = now;
  }
  if (updateMesh) {
    layer.topologyDirty = false;
    layer.lastExtractionTime = now;
    layer.meshCamera={position:cameraPositionForMask.slice(),forward:cameraForwardForMesh.slice()};
  }

  // Report delivered cadence as well as the requested/budgeted ceilings. This
  // exposes driver backpressure or a slow scene without any extra GPU readback.
  const rates=layer.refreshWindow ||= {start:now,frames:0,fields:0,meshes:0};
  rates.frames++;rates.fields+=Number(updateField);rates.meshes+=Number(updateMesh);
  if(now-rates.start>=1000){
    const seconds=(now-rates.start)*0.001;
    layer.measuredRates={observedRenderHz:rates.frames/seconds,observedFieldUpdateHz:rates.fields/seconds,observedMeshUpdateHz:rates.meshes/seconds};
    layer.refreshWindow={start:now,frames:0,fields:0,meshes:0};
  }

  layer.performanceStats = {
    ...layer.meshDiagnostics,
    ...layer.measuredRates,
    cpuEncodeMs:encodeMs,
    submitMs,
    mode: 'mc33-shell',
    msaaSamples: layer.sampleCount,
    angularCells: layer.angularCells,
    radialCells: layer.radialCells,
    tileCells: layer.tileCells,
    tilesPerAxis: layer.tilesPerAxis,
    totalTiles: layer.totalTiles,
    visibleFaceMask: layer.visibleFaceMask || 0,
    visibleFaceCount: layer.visibleFaceCount || 0,
    fieldPointCount: layer.pointsPerFace * Math.max(1, layer.visibleFaceCount || 1),
    fullShellFieldPointCount: layer.fieldPointCount,
    candidateCells,
    maxActiveCells: layer.maxActiveCells,
    maxVertices: layer.maxVertices,
    fieldUpdateHz,
    meshUpdateHz,
    effectiveFieldUpdateHz:1000/fieldUpdateInterval,
    effectiveMeshUpdateHz:1000/meshUpdateInterval,
    computeCompletionMs:layer.computeCompletionMs || 0,
    computePending:!!layer.computePending,
    cachedFieldNormals:true,
    fieldBlend,
    fieldUpdated: updateField,
    meshUpdated: updateMesh,
    vertexProjection: projectVertices,
    projectionRunsOnlyAfterFieldUpdates: true,
    fixedSpatialQuality: true,
    compactedActiveCells: true,
    visibleOccupiedTileCulling: layer.options.surfaceUseTileCulling === true,
    tileCullingDisabledForSeamStability: layer.options.surfaceUseTileCulling !== true,
    isoSignHysteresis: finiteNumber(layer.options.surfaceIsoHysteresis, 0.0),
    tileRadialBounds: true,
    worldSpaceFieldHistory: true,
    uses3DNoiseTextures: true,
  };
}

export function disposePlanetCloudSurfaceLayer(layer) {
  if (!layer || layer.disposed) return;
  layer.disposed = true;
  layer.surfaceNoise?.destroy();
  destroyGpuResources(layer);
  try { layer.depthTexture?.destroy?.(); } catch {}
  try { layer.msaaTexture?.destroy?.(); } catch {}
  try { layer.canvas?.remove?.(); } catch {}
}
