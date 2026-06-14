import { NoiseComputeBuilder } from '../noise/noiseCompute.js';
import { CloudComputeBuilder } from './clouds.js';

const DEFAULT_WEATHER_WIDTH = 1024;
const DEFAULT_WEATHER_HEIGHT = 512;
const DEFAULT_SHAPE_SIZE = 128;
const DEFAULT_DETAIL_SIZE = 32;
const DEFAULT_BLUE_SIZE = 256;
const DEFAULT_RENDER_SCALE_DIVIDER = 3;
const OVERLAY_GPU_CACHE = new WeakMap();

function getOverlayGpuCache(device) {
  let cache = OVERLAY_GPU_CACHE.get(device);
  if (!cache) {
    cache = { byFormat: new Map() };
    OVERLAY_GPU_CACHE.set(device, cache);
  }
  return cache;
}

export const PLANET_CLOUD_FLAT_LAB_PRESET = Object.freeze({
  params: {
    globalCoverage: 1.0,
    globalDensity: 1325.0,
    cloudAnvilAmount: 0.0,
    cloudBeer: 6.8,
    attenuationClamp: 0.015,
    inScatterG: 0.55,
    silverIntensity: 1.72,
    silverExponent: 2.45,
    outScatterG: 0.08,
    inVsOut: 0.55,
    outScatterAmbientAmt: 0.035,
    ambientMinimum: 0.022,
    sunColor: [1.0, 0.985, 0.95],
    frontLightColor: [1.30, 1.30, 1.22],
    shadowLightColor: [0.34, 0.42, 0.56],
    densityDivMin: 0.001,
    silverDirectionBias: 0.9,
    silverHorizonBoost: 0.35,
  },
  tuning: {
    maxSteps: 196,
    minStep: 0.0025,
    maxStep: 0.155,
    sunSteps: 5,
    sunStride: 4,
    sunMinTr: 0.003,
    phaseJitter: 0.34,
    stepJitter: 0.045,
    baseJitterFrac: 0.014,
    topJitterFrac: 0.055,
    lodBiasWeather: 1.5,
    aabbFaceOffset: 0.0015,
    weatherRejectGate: 0.985,
    weatherRejectMip: 1.0,
    emptySkipMult: 5.4,
    nearFluffDist: 60.0,
    nearStepScale: 0.30,
    nearLodBias: -1.5,
    nearDensityMult: 2.9,
    nearDensityRange: 45.0,
    lodBlendThreshold: 0.46,
    sunDensityGate: 0.0025,
    fflyRelClamp: 1.6,
    fflyAbsFloor: 0.85,
    taaRelMin: 0.22,
    taaRelMax: 1.1,
    taaAbsEps: 0.02,
    farStart: 1.05,
    farFull: 4.2,
    farLodPush: 0.55,
    farDetailAtten: 0.72,
    farStepMult: 2.05,
    bnFarScale: 0.28,
    farTaaHistoryBoost: 1.8,
    raySmoothDens: 0.58,
    raySmoothSun: 0.66,
    fluffFactor: 2.45,
    anvilLift: 0.6,
    alphaCutoff: 0.985,
    thickBoxPerf: 0.65,
    thickStepBoost: 1.58,
    thickDetailSkip: 0.34,
    thickLightSkip: 0.40,
    verticalStepBoost: 3.0,
    verticalTextureHomogeneity: 0.32,
    verticalLightingStepBoost: 1.35,
    frontOcclusionStrength: 0.82,
    frontOcclusionAlpha: 0.58,
    frontOcclusionStepBoost: 4.2,
    sliceJitterStrength: 0.018,
    verticalLayerDecorrelation: 0.24,
    directLightBlend: 0.88,
    directLightBoost: 0.78,
    alphaBoostThreshold: 0.20,
    alphaBoostAmount: 0.10,
    minOutputAlpha: 0.035,
    outputAlphaFeather: 0.72,
    sparsity: 0.20,
    definition: 0.48,
  },
  transforms: {
    shapeOffsetWorld: [0, 0, 0],
    detailOffsetWorld: [0, 0, 0],
    weatherOffsetWorld: [0, 0, 0],
    shapeScale: 0.19,
    detailScale: 1.16,
    weatherScale: 0.88,
    shapeAxisScale: [1.0, 1.0, 1.0],
    detailAxisScale: [1.0, 1.0, 1.0],
    weatherAxisScale: [1.0, 1.0, 1.0],
    shapeBias: 0.06,
    detailBias: 0.0,
    weatherBias: 0.30,
  },
  velocities: {
    shape: [0.0, 0.0, 0.0],
    detail: [0.0, 0.0, 0.0],
    weather: [0.14, 0.0, 0.0],
  },
});

export const PLANET_CLOUD_NOISE = Object.freeze({
  weather: {
    mode: 'computeFBM',
    seed: 123456789001,
    zoom: 16.0,
    freq: 1.35,
    octaves: 6,
    lacunarity: 2.0,
    seedAngle: Math.PI / 2,
    gain: 0.5,
    threshold: 0.1,
    time: 0.0,
    voroMode: 4,
    edgeK: 0.0,
    warpAmp: 0.0,
  },
  weatherG: {
    enabled: true,
    mode: 'computeBillow',
    seed: 123456789000,
    scale: 1.0,
    zoom: 16.0,
    freq: 1.9,
    octaves: 4,
    lacunarity: 2.0,
    seedAngle: Math.PI / 2,
    gain: 0.5,
    threshold: 0.1,
    time: 0.0,
    voroMode: 4,
    edgeK: 0.0,
    warpAmp: 0.0,
  },
  weatherB: {
    enabled: false,
    mode: 'computeBillow',
    seed: 123456789003,
    scale: 1.0,
    zoom: 16.0,
    freq: 1.9,
    octaves: 4,
    lacunarity: 2.0,
    seedAngle: Math.PI / 2,
    gain: 0.5,
    threshold: 0.1,
    time: 0.0,
    voroMode: 4,
    edgeK: 0.0,
    warpAmp: 0.0,
  },
  shape: {
    seed: 123456789002,
    zoom: 4.0,
    freq: 1.0,
    octaves: 2,
    lacunarity: 2.0,
    seedAngle: Math.PI / 2,
    gain: 0.5,
    threshold: 0.10,
    time: 0.0,
    voroMode: 4,
    edgeK: 0.0,
    warpAmp: 0.0,
    baseModeA: 'computeAntiWorley4D',
    baseModeB: 'computeAntiWorley4D',
    bandMode2: 'computeAntiWorley4D',
    bandMode3: 'computeAntiWorley4D',
    bandMode4: 'computeAntiWorley4D',
  },
  detail: {
    seed: 123456789003,
    zoom: 4.0,
    freq: 1.0,
    octaves: 4,
    lacunarity: 2.0,
    seedAngle: Math.PI / 2,
    gain: 0.5,
    threshold: 0.1,
    time: 0.0,
    voroMode: 4,
    edgeK: 0.0,
    warpAmp: 0.0,
    mode1: 'computeWorley4D',
    mode2: 'computeWorley4D',
    mode3: 'computeWorley4D',
  },
  blue: {
    seed: 123456789004,
  },
});

const PLANET_AURORA_NOISE = Object.freeze({
  shape: {
    zoom: 2.2,
    freq: 1.0,
    octaves: 4,
    lacunarity: 2.0,
    gain: 0.56,
    threshold: 0.08,
    voroMode: 0,
    edgeK: 0.0,
    warpAmp: 0.0,
    baseModeA: 'computeFBM4D',
    baseModeB: 'computeFBM4D',
    bandMode2: 'computeFBM4D',
    bandMode3: 'computeFBM4D',
    bandMode4: 'computeFBM4D',
  },
  detail: {
    zoom: 3.4,
    freq: 1.0,
    octaves: 4,
    lacunarity: 2.0,
    gain: 0.5,
    threshold: 0.10,
    voroMode: 0,
    edgeK: 0.0,
    warpAmp: 0.0,
    mode1: 'computeBillow4D',
    mode2: 'computeWorley4D',
    mode3: 'computeBillow4D',
  },
});

function finiteNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clonePlain(value) {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = clonePlain(v);
    return out;
  }
  return value;
}

function mergePlain(base, override) {
  const out = clonePlain(base || {});
  if (!override || typeof override !== 'object') return out;
  for (const [k, v] of Object.entries(override)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = mergePlain(out[k], v);
    } else {
      out[k] = clonePlain(v);
    }
  }
  return out;
}

function stripKeys(obj, keys) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (!keys.has(k)) out[k] = v;
  }
  return out;
}

function addSeed(baseSeed, salt) {
  return ((baseSeed >>> 0) + (salt >>> 0)) >>> 0;
}

function cloudResourceKey(layerOrOptions, kind, seed) {
  const opt = layerOrOptions?.options || layerOrOptions || {};
  const s = Math.floor(seed ?? opt.seed ?? Date.now()) >>> 0;
  const nonce = opt.resourceNonce ?? opt.textureNonce ?? opt.textureKeySuffix ?? 'stable';
  return `planet-cloud-${kind}-${s}-${nonce}`;
}

function seededParams(params, seed, salt) {
  return { ...params, seed: params.seed ?? addSeed(seed, salt) };
}

async function bakeSphericalWeather(noiseBuilder, options) {
  const width = Math.max(16, Math.floor(options.weatherWidth ?? DEFAULT_WEATHER_WIDTH));
  const height = Math.max(8, Math.floor(options.weatherHeight ?? DEFAULT_WEATHER_HEIGHT));
  const seed = options.seed >>> 0;
  const textureKey = options.textureKey || `planet-cloud-weather-${seed}`;
  const weather = seededParams(mergePlain(PLANET_CLOUD_NOISE.weather, options.weather), seed, 101);
  const weatherG = mergePlain(PLANET_CLOUD_NOISE.weatherG, options.weatherG);
  const weatherB = mergePlain(PLANET_CLOUD_NOISE.weatherB, options.weatherB);
  const sphereOptions = {
    useCustomPos: 2,
    sphereOffset: finiteNumber(options.sphereOffset, 0.0),
    sphereOffset2: finiteNumber(options.sphereOffset2, 0.0),
    textureKey,
    viewDimension: '2d-array',
  };

  await noiseBuilder.computeToTexture(width, height, weather, {
    ...sphereOptions,
    noiseChoices: ['clearTexture', weather.mode || 'computeFBM'],
    outputChannel: 1,
  });

  if (weatherG.enabled !== false) {
    const params = seededParams(stripKeys(weatherG, new Set(['enabled', 'mode'])), seed, 202);
    await noiseBuilder.computeToTexture(width, height, params, {
      ...sphereOptions,
      noiseChoices: ['clearTexture', weatherG.mode || 'computeBillow'],
      outputChannel: 2,
    });
  } else {
    await noiseBuilder.computeToTexture(width, height, { zoom: 1 }, {
      ...sphereOptions,
      noiseChoices: ['clearTexture'],
      outputChannel: 2,
    });
  }

  if (weatherB.enabled === true) {
    const params = seededParams(stripKeys(weatherB, new Set(['enabled', 'mode'])), seed, 303);
    await noiseBuilder.computeToTexture(width, height, params, {
      ...sphereOptions,
      noiseChoices: ['clearTexture', weatherB.mode || 'computeBillow'],
      outputChannel: 3,
    });
  } else {
    await noiseBuilder.computeToTexture(width, height, { zoom: 1 }, {
      ...sphereOptions,
      noiseChoices: ['clearTexture'],
      outputChannel: 3,
    });
  }

  return noiseBuilder.get2DView(textureKey) || noiseBuilder.getCurrentView(textureKey);
}

async function bakeShapeVolume(noiseBuilder, options) {
  const size = Math.max(16, Math.floor(options.shapeSize ?? DEFAULT_SHAPE_SIZE));
  const seed = options.seed >>> 0;
  const textureId = options.textureId || `planet-cloud-shape-${seed}`;
  const shapeDefaults = options.auroraMode
    ? mergePlain(PLANET_CLOUD_NOISE.shape, PLANET_AURORA_NOISE.shape)
    : PLANET_CLOUD_NOISE.shape;
  const shape = seededParams(mergePlain(shapeDefaults, options.shape), seed, 404);
  const baseParamsRaw = stripKeys(shape, new Set(['baseModeA', 'baseModeB', 'bandMode2', 'bandMode3', 'bandMode4']));
  const baseParams = { ...baseParamsRaw, toroidal: 1, band: 'base' };
  const baseModeA = shape.baseModeA || 'computeAntiWorley4D';
  const baseModeB = shape.baseModeB || baseModeA;
  const baseChoices = ['clearTexture', baseModeA];
  if (baseModeB !== baseModeA) baseChoices.push(baseModeB);

  await noiseBuilder.computeToTexture3D(size, size, size, baseParams, {
    noiseChoices: baseChoices,
    outputChannel: 1,
    id: textureId,
    useCustomPos: 0,
  });

  const z = Number(shape.zoom) || 1;
  const bands = [
    { ch: 2, zoom: z / 2, mode: shape.bandMode2 || 'computeWorley4D' },
    { ch: 3, zoom: z / 4, mode: shape.bandMode3 || 'computeWorley4D' },
    { ch: 4, zoom: z / 8, mode: shape.bandMode4 || 'computeWorley4D' },
  ];

  for (const b of bands) {
    await noiseBuilder.computeToTexture3D(size, size, size, { ...baseParamsRaw, zoom: b.zoom, toroidal: 1 }, {
      noiseChoices: ['clearTexture', b.mode],
      outputChannel: b.ch,
      id: textureId,
      useCustomPos: 0,
    });
  }

  return noiseBuilder.get3DView(textureId);
}

async function bakeDetailVolume(noiseBuilder, options) {
  const size = Math.max(8, Math.floor(options.detailSize ?? DEFAULT_DETAIL_SIZE));
  const seed = options.seed >>> 0;
  const textureId = options.textureId || `planet-cloud-detail-${seed}`;
  const detailDefaults = options.auroraMode
    ? mergePlain(PLANET_CLOUD_NOISE.detail, PLANET_AURORA_NOISE.detail)
    : PLANET_CLOUD_NOISE.detail;
  const detail = seededParams(mergePlain(detailDefaults, options.detail), seed, 505);
  const baseParamsRaw = stripKeys(detail, new Set(['mode1', 'mode2', 'mode3']));
  const z = Number(detail.zoom) || 1;
  const bands = [
    { ch: 1, zoom: z, mode: detail.mode1 || 'computeWorley4D' },
    { ch: 2, zoom: z / 2, mode: detail.mode2 || 'computeWorley4D' },
    { ch: 3, zoom: z / 4, mode: detail.mode3 || 'computeWorley4D' },
  ];

  for (const b of bands) {
    await noiseBuilder.computeToTexture3D(size, size, size, { ...baseParamsRaw, zoom: b.zoom, toroidal: 1 }, {
      noiseChoices: ['clearTexture', b.mode],
      outputChannel: b.ch,
      id: textureId,
      useCustomPos: 0,
    });
  }

  return noiseBuilder.get3DView(textureId);
}

async function bakeBlueNoise(noiseBuilder, options) {
  const width = Math.max(16, Math.floor(options.blueWidth ?? DEFAULT_BLUE_SIZE));
  const height = Math.max(16, Math.floor(options.blueHeight ?? DEFAULT_BLUE_SIZE));
  const seed = options.seed >>> 0;
  const textureKey = options.textureKey || `planet-cloud-blue-${seed}`;
  const params = seededParams(mergePlain(PLANET_CLOUD_NOISE.blue, options.blue), seed, 606);
  await noiseBuilder.computeToTexture(width, height, params, {
    noiseChoices: ['clearTexture', 'computeBlueNoise'],
    outputChannel: 0,
    textureKey,
    viewDimension: '2d-array',
  });
  return noiseBuilder.get2DView(textureKey) || noiseBuilder.getCurrentView(textureKey);
}

function createOverlayCanvas(parent, sourceCanvas, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.id = options.canvasId || 'planet-spherical-clouds-canvas';
  const zIndex = Number.isFinite(Number(options.canvasZIndex)) ? Number(options.canvasZIndex) : 2;
  const blendMode = typeof options.canvasBlendMode === 'string' && options.canvasBlendMode.trim()
    ? options.canvasBlendMode.trim()
    : 'normal';
  canvas.style.cssText = [
    'position:absolute',
    'inset:0',
    'width:100%',
    'height:100%',
    `z-index:${zIndex}`,
    'pointer-events:none',
    `mix-blend-mode:${blendMode}`,
  ].join(';');
  parent.appendChild(canvas);
  resizeOverlayCanvas(canvas, sourceCanvas, options);
  return canvas;
}

function resizeOverlayCanvas(canvas, sourceCanvas, options = {}) {
  const dpr = finiteNumber(options.dpr, window.devicePixelRatio || 1);
  const rect = sourceCanvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor((options.pixelWidth || rect.width || sourceCanvas.clientWidth || sourceCanvas.width || 1) * dpr));
  const height = Math.max(1, Math.floor((options.pixelHeight || rect.height || sourceCanvas.clientHeight || sourceCanvas.height || 1) * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return { width, height, dpr };
}

function ensureOverlayRenderer(layer) {
  if (layer.overlayPipeline) return;
  const device = layer.device;
  const format = layer.canvasFormat;
  const overlayCache = getOverlayGpuCache(device);
  const cachedOverlay = overlayCache.byFormat.get(format);
  if (cachedOverlay) {
    layer.overlaySampler = cachedOverlay.sampler;
    layer.overlayPipeline = cachedOverlay.pipeline;
    layer.overlayParams = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    return;
  }

  const shader = device.createShaderModule({
    code: `
struct OverlayParams {
  opacity: f32,
  alphaPower: f32,
  alphaCutoff: f32,
  layerIndex: u32,
};
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d_array<f32>;
@group(0) @binding(2) var<uniform> params: OverlayParams;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VSOut {
  var p = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
  );
  var t = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(1.0, 0.0)
  );
  var out: VSOut;
  out.pos = vec4<f32>(p[vid], 0.0, 1.0);
  out.uv = t[vid];
  return out;
}

fn overlayLuma(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn sampleCloudOverlay(uv: vec2<f32>) -> vec4<f32> {
  return textureSampleLevel(
    tex,
    samp,
    clamp(uv, vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999)),
    i32(params.layerIndex),
    0.0
  );
}

fn overlayTapWeight(center: vec4<f32>, tap: vec4<f32>, spatialWeight: f32) -> f32 {
  let alphaDelta = abs(clamp(tap.a, 0.0, 1.0) - clamp(center.a, 0.0, 1.0));
  let lumaDelta = abs(overlayLuma(tap.rgb) - overlayLuma(center.rgb));
  let alphaWeight = exp(-alphaDelta * 11.0);
  let lumaWeight = exp(-lumaDelta * 7.0);
  let thinVisibility = mix(0.34, 1.0, smoothstep(0.002, 0.085, tap.a));
  return spatialWeight * alphaWeight * lumaWeight * thinVisibility;
}

fn resolveCloudOverlay(uv: vec2<f32>) -> vec4<f32> {
  let center = sampleCloudOverlay(uv);
  let dimsU = textureDimensions(tex, 0);
  let dims = max(vec2<f32>(f32(dimsU.x), f32(dimsU.y)), vec2<f32>(1.0, 1.0));
  let px = 1.0 / dims;

  let left = sampleCloudOverlay(uv + vec2<f32>(-px.x, 0.0));
  let right = sampleCloudOverlay(uv + vec2<f32>(px.x, 0.0));
  let down = sampleCloudOverlay(uv + vec2<f32>(0.0, -px.y));
  let up = sampleCloudOverlay(uv + vec2<f32>(0.0, px.y));

  let wCenter = 1.0;
  let wLeft = overlayTapWeight(center, left, 0.56);
  let wRight = overlayTapWeight(center, right, 0.56);
  let wDown = overlayTapWeight(center, down, 0.56);
  let wUp = overlayTapWeight(center, up, 0.56);
  let wSum = max(wCenter + wLeft + wRight + wDown + wUp, 1e-5);
  let filtered = (center * wCenter + left * wLeft + right * wRight + down * wDown + up * wUp) / wSum;

  let a = clamp(center.a, 0.0, 1.0);
  let thinBand = 1.0 - smoothstep(0.10, 0.62, a);
  let edgeBand = smoothstep(0.006, 0.18, a) * (1.0 - smoothstep(0.42, 0.92, a));
  let resolveAmount = clamp(0.18 * thinBand + 0.36 * edgeBand, 0.0, 0.54);
  return mix(center, filtered, resolveAmount);
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let c = resolveCloudOverlay(in.uv);
  let rawA = clamp(c.a, 0.0, 1.0);
  let cutoff = clamp(params.alphaCutoff, 0.0, 0.94);
  let gate = select(1.0, smoothstep(cutoff, min(cutoff + 0.045, 1.0), rawA), cutoff > 0.0001);
  let a = pow(max(rawA * gate, 0.0), max(params.alphaPower, 0.001)) * clamp(params.opacity, 0.0, 2.0);
  let liftGate = smoothstep(0.025, 0.24, rawA);
  let premulLift = select(0.0, clamp(a / max(rawA, 0.001), 0.0, 1.55), rawA > 0.00001);
  let premulScale = mix(1.0, premulLift, liftGate);
  let rgb = max(c.rgb, vec3<f32>(0.0)) * premulScale;
  return vec4<f32>(rgb, clamp(a, 0.0, 1.0));
}
`,
  });
  layer.overlaySampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });
  layer.overlayParams = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  layer.overlayPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shader, entryPoint: 'vs_main' },
    fragment: {
      module: shader,
      entryPoint: 'fs_main',
      targets: [
        {
          format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        },
      ],
    },
    primitive: { topology: 'triangle-list' },
  });
  overlayCache.byFormat.set(format, {
    sampler: layer.overlaySampler,
    pipeline: layer.overlayPipeline,
  });
}

function renderOverlay(layer) {
  if (!layer.cloudBuilder?.outView) return;
  ensureOverlayRenderer(layer);

  const ctx = layer.canvas.getContext('webgpu');
  if (!ctx) throw new Error('Planet clouds overlay canvas could not get a WebGPU context.');
  if (!layer.contextConfigured || layer.contextWidth !== layer.canvas.width || layer.contextHeight !== layer.canvas.height) {
    ctx.configure({
      device: layer.device,
      format: layer.canvasFormat,
      alphaMode: 'premultiplied',
      size: [layer.canvas.width, layer.canvas.height],
    });
    layer.contextConfigured = true;
    layer.contextWidth = layer.canvas.width;
    layer.contextHeight = layer.canvas.height;
  }

  const opacity = finiteNumber(layer.options.opacity, 1.0);
  const alphaPower = finiteNumber(layer.options.alphaPower, 0.82);
  const alphaCutoff = finiteNumber(layer.options.alphaCutoff, 0.0);
  const data = new Float32Array([opacity, alphaPower, alphaCutoff, 0.0]);
  layer.device.queue.writeBuffer(layer.overlayParams, 0, data.buffer, data.byteOffset, data.byteLength);

  const bg = layer.device.createBindGroup({
    layout: layer.overlayPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: layer.overlaySampler },
      { binding: 1, resource: layer.cloudBuilder.outView },
      { binding: 2, resource: { buffer: layer.overlayParams } },
    ],
  });

  const enc = layer.device.createCommandEncoder();
  const pass = enc.beginRenderPass({
    colorAttachments: [
      {
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        storeOp: 'store',
      },
    ],
  });
  pass.setPipeline(layer.overlayPipeline);
  pass.setBindGroup(0, bg);
  pass.draw(6, 1, 0, 0);
  pass.end();
  layer.device.queue.submit([enc.finish()]);
}

function v3FromBabylon(v, fallback = [0, 0, 0]) {
  if (!v) return fallback.slice();
  return [finiteNumber(v.x, fallback[0]), finiteNumber(v.y, fallback[1]), finiteNumber(v.z, fallback[2])];
}

function normalize(v, fallback = [0, 0, -1]) {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (!(len > 1e-8)) return fallback.slice();
  return [v[0] / len, v[1] / len, v[2] / len];
}

function addScaled(a, b, s) {
  return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
}

function normalizeTemporalRateLocal(value) {
  const n = Math.max(1, Number(value) | 0);
  if (n >= 64) return 64;
  if (n >= 32) return 32;
  if (n >= 16) return 16;
  if (n >= 8) return 8;
  if (n >= 4) return 4;
  if (n >= 2) return 2;
  return 1;
}

function wantsCloudHistory(layer) {
  const r = layer?.options?.reprojection || {};
  const rate = normalizeTemporalRateLocal(r.temporalCellRate ?? 1);
  return !!((r.enabled ? 1 : 0) || rate > 1 || r.compactInterleave);
}

function destroyCloudHistory(layer) {
  if (!layer?.history) return;
  for (const tex of [layer.history.prevTex, layer.history.outTex]) {
    try { tex?.destroy?.(); } catch {}
  }
  layer.history = null;
}

function ensureCloudHistory(layer, width, height) {
  if (!wantsCloudHistory(layer)) {
    destroyCloudHistory(layer);
    layer.cloudBuilder.setInputMaps({ historyPrevView: null, historyOutView: null });
    return null;
  }

  const w = Math.max(1, width | 0);
  const h = Math.max(1, height | 0);
  const fmt = layer.cloudBuilder?.outFormat || 'rgba16float';
  if (layer.history && layer.history.width === w && layer.history.height === h && layer.history.format === fmt) {
    return layer.history;
  }

  destroyCloudHistory(layer);

  const desc = {
    size: [w, h, 1],
    format: fmt,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST,
  };
  const prevTex = layer.device.createTexture(desc);
  const outTex = layer.device.createTexture(desc);
  const clear = new Uint16Array(w * h * 4);
  const bytesPerRow = Math.ceil((w * 8) / 256) * 256;
  if (bytesPerRow === w * 8) {
    try {
      layer.queue.writeTexture(
        { texture: prevTex },
        clear,
        { bytesPerRow },
        { width: w, height: h, depthOrArrayLayers: 1 },
      );
      layer.queue.writeTexture(
        { texture: outTex },
        clear,
        { bytesPerRow },
        { width: w, height: h, depthOrArrayLayers: 1 },
      );
    } catch {}
  }

  layer.history = {
    width: w,
    height: h,
    format: fmt,
    prevTex,
    outTex,
    prevView: prevTex.createView({ dimension: '2d-array', arrayLayerCount: 1 }),
    outView: outTex.createView({ dimension: '2d-array', arrayLayerCount: 1 }),
  };

  layer.cloudBuilder.setInputMaps({
    historyPrevView: layer.history.prevView,
    historyOutView: layer.history.outView,
  });

  return layer.history;
}

function swapCloudHistory(layer) {
  const h = layer?.history;
  if (!h) return;
  const prevTex = h.prevTex;
  const prevView = h.prevView;
  h.prevTex = h.outTex;
  h.prevView = h.outView;
  h.outTex = prevTex;
  h.outView = prevView;
  layer.cloudBuilder.setInputMaps({
    historyPrevView: h.prevView,
    historyOutView: h.outView,
  });
}

function makeDefaultCameraState() {
  return {
    camPos: [0, 0, 200],
    right: [1, 0, 0],
    up: [0, 1, 0],
    fwd: [0, 0, -1],
    fovYDeg: 60,
    aspect: 1,
  };
}

function dotArray3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function distanceArray3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function cameraMovedForHistory(prev, next, radius, options = {}) {
  if (!prev || !next) return false;
  const posEps = finiteNumber(options.cameraHistoryPositionEpsilon, Math.max(radius * 0.00015, 0.006));
  const dirEps = finiteNumber(options.cameraHistoryDirectionEpsilon, 0.0000012);
  const fovEps = finiteNumber(options.cameraHistoryFovEpsilon, 0.0025);
  const posDelta = distanceArray3(prev.camPos, next.camPos);
  const fwdDelta = 1.0 - Math.max(-1.0, Math.min(1.0, dotArray3(prev.fwd, next.fwd)));
  const upDelta = 1.0 - Math.max(-1.0, Math.min(1.0, dotArray3(prev.up, next.up)));
  const rightDelta = 1.0 - Math.max(-1.0, Math.min(1.0, dotArray3(prev.right, next.right)));
  const fovDelta = Math.abs(prev.fovYDeg - next.fovYDeg);
  return posDelta > posEps || fwdDelta > dirEps || upDelta > dirEps || rightDelta > dirEps || fovDelta > fovEps;
}

export async function createPlanetCloudLayer({
  device,
  queue,
  noiseBuilder = null,
  parent,
  sourceCanvas,
  getCameraState = makeDefaultCameraState,
  getSunDir = () => [0.65, 0.37, -0.65],
  radius = 50,
  atmosphereRadius = 68,
  options = {},
} = {}) {
  if (!device || !queue) throw new Error('createPlanetCloudLayer requires a GPUDevice and GPUQueue.');
  if (!parent || !sourceCanvas) throw new Error('createPlanetCloudLayer requires parent and sourceCanvas.');

  const seed = Math.floor(options.seed ?? Date.now()) >>> 0;
  const mergedOptions = mergePlain({
    enabled: true,
    weatherWidth: DEFAULT_WEATHER_WIDTH,
    weatherHeight: DEFAULT_WEATHER_HEIGHT,
    shapeSize: DEFAULT_SHAPE_SIZE,
    detailSize: DEFAULT_DETAIL_SIZE,
    blueWidth: DEFAULT_BLUE_SIZE,
    blueHeight: DEFAULT_BLUE_SIZE,
    renderScaleDivider: DEFAULT_RENDER_SCALE_DIVIDER,
    cloudBottom: Math.max(0.75, (atmosphereRadius - radius) * 0.09),
    cloudTop: Math.max(Math.max(0.75, (atmosphereRadius - radius) * 0.09) + 2.15, (atmosphereRadius - radius) * 0.24),
    stepBase: 0.034,
    stepInc: 0.044,
    opacity: 0.98,
    alphaPower: 0.98,
    alphaCutoff: 0.006,
    movingTemporalBlend: 0.0,
    updateEvery: 1,
    animate: true,
    spinSpeed: 0.14,
    meridionalDrift: 0.0,
    resourceNonce: options.resourceNonce ?? `${seed}-${Date.now()}`,
    ...PLANET_CLOUD_FLAT_LAB_PRESET,
  }, options || {});
  if (!mergedOptions.resourceNonce) mergedOptions.resourceNonce = `${seed}-${Date.now()}`;

  const canvas = createOverlayCanvas(parent, sourceCanvas, mergedOptions);
  const cloudBuilder = new CloudComputeBuilder(device, queue);
  const nb = noiseBuilder || new NoiseComputeBuilder(device, queue);

  try {
    nb.buildPermTable?.(seed);
  } catch {}

  const layer = {
    device,
    queue,
    canvas,
    sourceCanvas,
    parent,
    noiseBuilder: nb,
    ownsNoiseBuilder: !noiseBuilder,
    cloudBuilder,
    options: mergedOptions,
    seed,
    radius,
    atmosphereRadius,
    getCameraState,
    getSunDir,
    canvasFormat: navigator.gpu.getPreferredCanvasFormat?.() || 'bgra8unorm',
    frame: 0,
    disposed: false,
    contextConfigured: false,
    contextWidth: 0,
    contextHeight: 0,
    lastOutputWidth: 0,
    lastOutputHeight: 0,
    overlayPipeline: null,
    overlaySampler: null,
    overlayParams: null,
    textures: null,
    timings: null,
    history: null,
    configSummary: {
      preset: clonePlain(PLANET_CLOUD_FLAT_LAB_PRESET),
      noise: clonePlain(PLANET_CLOUD_NOISE),
      resourceNonce: mergedOptions.resourceNonce,
    },
  };

  await bakePlanetCloudResources(layer);
  configurePlanetCloudBuilder(layer);
  return layer;
}

export async function bakePlanetCloudResources(layer) {
  const started = performance.now();
  const nb = layer.noiseBuilder;
  const opt = layer.options;
  const seed = layer.seed;

  try {
    nb?.buildPermTable?.(seed);
  } catch {}

  const resourceKeys = {
    weather: cloudResourceKey(opt, 'weather', seed),
    shape: cloudResourceKey(opt, 'shape', seed),
    detail: cloudResourceKey(opt, 'detail', seed),
    blue: cloudResourceKey(opt, 'blue', seed),
  };

  const weatherStarted = performance.now();
  const weatherView = await bakeSphericalWeather(nb, {
    ...opt,
    seed,
    textureKey: resourceKeys.weather,
  });

  const shapeStarted = performance.now();
  const shape3DView = await bakeShapeVolume(nb, {
    ...opt,
    seed,
    textureId: resourceKeys.shape,
  });

  const detailStarted = performance.now();
  const detail3DView = await bakeDetailVolume(nb, {
    ...opt,
    seed,
    textureId: resourceKeys.detail,
  });

  const blueStarted = performance.now();
  const blueView = await bakeBlueNoise(nb, {
    ...opt,
    seed,
    textureKey: resourceKeys.blue,
  });

  layer.resourceKeys = resourceKeys;
  layer.textures = { weatherView, shape3DView, detail3DView, blueView };
  layer.timings = {
    weatherMs: shapeStarted - weatherStarted,
    shapeMs: detailStarted - shapeStarted,
    detailMs: blueStarted - detailStarted,
    blueMs: performance.now() - blueStarted,
    totalMs: performance.now() - started,
  };

  layer.cloudBuilder.setInputMaps({ weatherView, shape3DView, detail3DView, blueView });
  layer.configSummary.resourceKeys = resourceKeys;
  layer.configSummary.resourceNonce = opt.resourceNonce;
  return layer.textures;
}

export function configurePlanetCloudBuilder(layer) {
  const opt = layer.options;
  const cb = layer.cloudBuilder;
  cb.setOptions({ sphericalMode: true, writeRGB: true, outputChannel: 0, r1: 0.0 });
  cb.setParams(opt.params || PLANET_CLOUD_FLAT_LAB_PRESET.params);
  cb.setNoiseTransforms(opt.transforms || PLANET_CLOUD_FLAT_LAB_PRESET.transforms);
  cb.setTuning(opt.tuning || PLANET_CLOUD_FLAT_LAB_PRESET.tuning);
  cb.setPerfParams?.(opt.performance || opt.perf || { lodBiasMul: 1.0, coarseMipBias: 0.0 });
  cb.setReprojSettings?.(opt.reprojection || { enabled: 1, temporalCellRate: 4, temporalBlend: 0.94, compactInterleave: 1 });
}

export function updatePlanetCloudLayerOptions(layer, options = {}, { resetHistory = false } = {}) {
  if (!layer || layer.disposed) return null;
  layer.options = mergePlain(layer.options || {}, options || {});
  if (layer.canvas) {
    if (Number.isFinite(Number(layer.options.canvasZIndex))) {
      layer.canvas.style.zIndex = String(Number(layer.options.canvasZIndex));
    }
    if (typeof layer.options.canvasBlendMode === 'string' && layer.options.canvasBlendMode.trim()) {
      layer.canvas.style.mixBlendMode = layer.options.canvasBlendMode.trim();
    }
  }
  configurePlanetCloudBuilder(layer);

  // This is a uniform/options update path. It intentionally does NOT call
  // bakePlanetCloudResources(), so weather/shape/detail/blue textures are not
  // rebuilt for color, lighting, march, shell, transform, performance, or
  // reprojection tweaks.
  if (resetHistory) {
    destroyCloudHistory(layer);
  }

  return layer.options;
}

export async function updatePlanetCloudLayer(layer) {
  if (!layer || layer.disposed || layer.options.enabled === false) return;
  const opt = layer.options;
  const { width, height } = resizeOverlayCanvas(layer.canvas, layer.sourceCanvas, opt);
  const divider = Math.max(1, Math.floor(opt.renderScaleDivider ?? DEFAULT_RENDER_SCALE_DIVIDER));
  const outW = Math.max(1, Math.ceil(width / divider));
  const outH = Math.max(1, Math.ceil(height / divider));
  if (outW !== layer.lastOutputWidth || outH !== layer.lastOutputHeight) {
    layer.cloudBuilder.createOutputTexture(outW, outH, 1, opt.textures?.outputFormat || opt.outputFormat || 'rgba16float');
    layer.lastOutputWidth = outW;
    layer.lastOutputHeight = outH;
    layer.contextConfigured = false;
    destroyCloudHistory(layer);
  }

  ensureCloudHistory(layer, outW, outH);

  const frameStride = Math.max(1, Math.floor(opt.updateEvery ?? 1));
  layer.frame += 1;
  if ((layer.frame % frameStride) !== 0 && layer.cloudBuilder.outView) {
    renderOverlay(layer);
    return;
  }

  const camera = layer.getCameraState?.() || makeDefaultCameraState();
  const camPos = normalizeVecArray(camera.camPos, [0, 0, layer.radius * 4]);
  const fwd = normalize(normalizeVecArray(camera.fwd, [0, 0, -1]), [0, 0, -1]);
  const right = normalize(normalizeVecArray(camera.right, [1, 0, 0]), [1, 0, 0]);
  const up = normalize(normalizeVecArray(camera.up, [0, 1, 0]), [0, 1, 0]);
  const aspect = finiteNumber(camera.aspect, width / Math.max(height, 1));
  const fovYDeg = finiteNumber(camera.fovYDeg, 60);
  const cameraHistoryState = { camPos, fwd, right, up, fovYDeg, aspect };
  const cameraIsMoving = cameraMovedForHistory(layer.lastCameraHistoryState, cameraHistoryState, layer.radius, opt);
  layer.lastCameraHistoryState = {
    camPos: camPos.slice(),
    fwd: fwd.slice(),
    right: right.slice(),
    up: up.slice(),
    fovYDeg,
    aspect,
  };
  const sunDir = normalize(normalizeVecArray(layer.getSunDir?.(), [0.65, 0.37, -0.65]), [0.65, 0.37, -0.65]);
  const t = performance.now() * 0.001;
  const vel = opt.velocities || PLANET_CLOUD_FLAT_LAB_PRESET.velocities;
  const baseTransforms = opt.transforms || PLANET_CLOUD_FLAT_LAB_PRESET.transforms;
  const transforms = mergePlain(baseTransforms, {});

  if (opt.animate !== false) {
    const spinSpeed = finiteNumber(opt.spinSpeed, Array.isArray(vel.weather) ? finiteNumber(vel.weather[0], 0.14) : 0.14);
    const meridionalDrift = finiteNumber(opt.meridionalDrift, Array.isArray(vel.weather) ? finiteNumber(vel.weather[2], 0.0) : 0.0);
    const shapeSpinFactor = finiteNumber(opt.shapeSpinFactor, 0.82);
    const detailSpinFactor = finiteNumber(opt.detailSpinFactor, 0.93);
    const shapeDrift = [spinSpeed * shapeSpinFactor, 0.0, meridionalDrift * shapeSpinFactor];
    const detailDrift = [spinSpeed * detailSpinFactor, 0.0, meridionalDrift * detailSpinFactor];
    transforms.shapeOffsetWorld = addScaled(
      addScaled(baseTransforms.shapeOffsetWorld || [0, 0, 0], shapeDrift, t),
      vel.shape || [0, 0, 0],
      t,
    );
    transforms.detailOffsetWorld = addScaled(
      addScaled(baseTransforms.detailOffsetWorld || [0, 0, 0], detailDrift, t),
      vel.detail || [0, 0, 0],
      t,
    );
    transforms.weatherOffsetWorld = addScaled(baseTransforms.weatherOffsetWorld || [0, 0, 0], [spinSpeed, 0.0, meridionalDrift], t);
  }

  const defaultCloudBottom = Math.max(0.75, (layer.atmosphereRadius - layer.radius) * 0.09);
  const cloudBottom = finiteNumber(opt.cloudBottom, defaultCloudBottom);
  const cloudTop = finiteNumber(opt.cloudTop, Math.max(cloudBottom + 2.15, (layer.atmosphereRadius - layer.radius) * 0.24));
  const outer = layer.radius + cloudTop + Math.max(2.0, Math.abs(PLANET_CLOUD_FLAT_LAB_PRESET.tuning.anvilLift || 0));
  const visualShellHalf = Math.max((cloudTop - cloudBottom) * 0.5, 0.25);
  const requestedMaxHalf = finiteNumber(
    opt.shellMaxHalfHeight ?? opt.maxShellHalfHeight ?? opt.shellHalfHeightMax,
    visualShellHalf,
  );
  // Box half-height optimization only: keep the old full visual shell in
  // V.cloudBottom/Top so volume/anvil/stretch still behave like the rollback.
  // B.half.y is allowed to be shallow for bounds/perf-side logic.
  const shellHalf = Math.max(0.05, Math.min(visualShellHalf, Math.max(0.05, requestedMaxHalf)));

  layer.cloudBuilder.setNoiseTransforms(transforms);
  layer.cloudBuilder.setBox({
    center: [0, 0, 0],
    half: [outer, shellHalf, outer],
    uvScale: 1.0,
  });
  const auroraCap = opt.auroraCap || {};
  const auroraHemisphere = String(auroraCap.hemisphere || 'north').toLowerCase() === 'south' ? -1.0 : 1.0;
  const auroraEnabled = !!opt.auroraMode;

  layer.cloudBuilder.setViewFromCamera({
    camPos,
    right,
    up,
    fwd,
    fovYDeg,
    aspect,
    planetRadius: layer.radius,
    cloudBottom,
    cloudTop,
    worldToUV: finiteNumber(opt.worldToUV ?? undefined, 0.78 / Math.max(cloudTop - cloudBottom, 1.0)),
    stepBase: finiteNumber(opt.stepBase, 0.034),
    stepInc: finiteNumber(opt.stepInc, 0.044),
    volumeLayers: auroraEnabled ? 2 : 1,
    viewExtraA: finiteNumber(auroraCap.halfAngleDeg, 12.0),
    viewExtraB: finiteNumber(auroraCap.featherDeg, 6.0),
    viewExtraC: auroraHemisphere,
  });
  layer.cloudBuilder.setLight({ sunDir, camPos });

  const reprojBase = opt.reprojection || {};
  const auroraAnimating = auroraEnabled && opt.animate !== false;
  const temporalCellRate = cameraIsMoving || auroraAnimating ? 1 : normalizeTemporalRateLocal(reprojBase.temporalCellRate ?? 4);
  const frameIndex = Math.max(0, (layer.frame | 0) - 1);
  const temporalBlendRaw = cameraIsMoving
    ? Math.max(0.0, Math.min(finiteNumber(opt.movingTemporalBlend, 0.0), finiteNumber(reprojBase.temporalBlend, 0.94)))
    : (reprojBase.temporalBlend ?? 0.94);
  const temporalBlend = auroraAnimating
    ? Math.min(finiteNumber(temporalBlendRaw, 0.94), finiteNumber(opt.auroraTemporalBlend ?? opt.maxAuroraTemporalBlend, 0.58))
    : temporalBlendRaw;
  layer.cloudBuilder.setReprojSettings?.({
    ...reprojBase,
    enabled: cameraIsMoving ? 0 : (reprojBase.enabled ?? 1),
    temporalBlend,
    temporalCellRate,
    temporalCellPhase: temporalCellRate > 1 ? frameIndex % temporalCellRate : 0,
    compactInterleave: cameraIsMoving || auroraAnimating ? 0 : (reprojBase.compactInterleave ?? (temporalCellRate > 1 ? 1 : 0)),
    frameIndex,
    fullWidth: outW,
    fullHeight: outH,
  });

  const coarseFactor = Math.max(1, Math.floor(opt.performance?.coarseFactor ?? opt.coarseFactor ?? 1));
  await layer.cloudBuilder.dispatch({ wait: false, coarseFactor });
  swapCloudHistory(layer);
  renderOverlay(layer);
}

function normalizeVecArray(v, fallback) {
  if (Array.isArray(v)) {
    return [finiteNumber(v[0], fallback[0]), finiteNumber(v[1], fallback[1]), finiteNumber(v[2], fallback[2])];
  }
  return v3FromBabylon(v, fallback);
}

export function disposePlanetCloudLayer(layer) {
  if (!layer || layer.disposed) return;
  layer.disposed = true;
  try { layer.canvas?.remove?.(); } catch {}
  try { layer.overlayParams?.destroy?.(); } catch {}
  destroyCloudHistory(layer);
  try { layer.cloudBuilder?.outTexture?.destroy?.(); } catch {}
  if (layer.ownsNoiseBuilder) {
    try { layer.noiseBuilder?.destroyAllTexturePairs?.(); } catch {}
  }
}
