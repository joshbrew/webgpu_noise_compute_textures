import { NoiseComputeBuilder } from '../noise/noiseCompute.js';
import { CloudComputeBuilder } from './clouds.js';
import { CloudTimingReport } from './cloudTiming.js';
import { CloudVolumeMips } from './cloudVolumeMips.js';
import { PlanetCloudNoise } from './planetCloudNoise.js';
import { advancePlanetCloudTime, planetCloudMotion } from './planetCloudMotion.js';
import { PLANET_CLOUD_STYLES, planetCloudStyleOptions } from './planetCloudStyles.js';
export { PLANET_CLOUD_STYLES, planetCloudStyleOptions } from './planetCloudStyles.js';
import {
  createPlanetCloudSurfaceLayer,
  updatePlanetCloudSurfaceLayer,
  updatePlanetCloudSurfaceOptions,
  setPlanetCloudSurfaceStyle,
  disposePlanetCloudSurfaceLayer,
} from './planetCloudSurface.js';

const DEFAULT_WEATHER_WIDTH = 1024;
const DEFAULT_WEATHER_HEIGHT = 512;
const DEFAULT_SHAPE_SIZE = 128;
const DEFAULT_DETAIL_SIZE = 32;
const DEFAULT_BLUE_SIZE = 256;
const DEFAULT_RENDER_SCALE_DIVIDER = 1;
const DEFAULT_MAX_DPR = 2;
const DEFAULT_MAX_RAYMARCH_PIXELS = 1400000;
const DEFAULT_FULLSCREEN_RAYMARCH_PIXELS = 1050000;
const OVERLAY_GPU_CACHE = new WeakMap();
const PLANET_NOISE_BUILDER_CACHE = new WeakMap();
const PLANET_VOLUME_MIPS = new WeakMap();
const PLANET_STYLE_NOISE = new WeakMap();
function planetStyleNoise(noiseBuilder) {
  let baker=PLANET_STYLE_NOISE.get(noiseBuilder);
  if(!baker){baker=new PlanetCloudNoise(noiseBuilder.device);PLANET_STYLE_NOISE.set(noiseBuilder,baker);}
  return baker;
}

function planetVolumeMips(noiseBuilder) {
  let mips = PLANET_VOLUME_MIPS.get(noiseBuilder);
  if (!mips) { mips = new CloudVolumeMips(noiseBuilder.device); PLANET_VOLUME_MIPS.set(noiseBuilder,mips); }
  return mips;
}

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
    raySmoothDens: 0.46,
    raySmoothSun: 0.66,
    fluffFactor: 2.45,
    anvilLift: 0.6,
    alphaCutoff: 0.985,
    thickBoxPerf: 0.65,
    thickStepBoost: 1.58,
    thickDetailSkip: 0.34,
    thickLightSkip: 0.40,
    verticalStepBoost: 3.0,
    verticalTextureHomogeneity: 0.14,
    verticalLightingStepBoost: 1.35,
    frontOcclusionStrength: 0.82,
    frontOcclusionAlpha: 0.58,
    frontOcclusionStepBoost: 4.2,
    sliceJitterStrength: 0.032,
    verticalLayerDecorrelation: 0.46,
    directLightBlend: 0.88,
    directLightBoost: 0.78,
    alphaBoostThreshold: 0.20,
    alphaBoostAmount: 0.10,
    minOutputAlpha: 0.035,
    outputAlphaFeather: 0.52,
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

export const PLANET_AURORA_FAST_PRESET = Object.freeze({
  params: {
    sunColor: [1.34, 0.54, 0.09],
    frontLightColor: [0.10, 0.88, 0.50],
    shadowLightColor: [1.18, 0.075, 0.04],
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

function clamp01Local(v) {
  return Math.max(0, Math.min(1, finiteNumber(v, 0)));
}

function mixNumber(a, b, t) {
  return a + (b - a) * clamp01Local(t);
}

function smoothstepLocal(edge0, edge1, value) {
  if (edge1 <= edge0) return value >= edge1 ? 1 : 0;
  const t = clamp01Local((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function estimatePlanetScreenCoverage(camera, outerRadius) {
  const camPos = camera?.camPos || [0, 0, outerRadius * 4];
  const distance = Math.max(Math.hypot(camPos[0], camPos[1], camPos[2]), 0.0001);
  if (distance <= outerRadius * 1.001) {
    return {
      coverage: 1,
      pressure: 1,
      radiusNdcX: 2,
      radiusNdcY: 2,
    };
  }

  const fovY = Math.max(1, Math.min(175, finiteNumber(camera?.fovYDeg, 60))) * Math.PI / 180;
  const aspect = Math.max(0.05, finiteNumber(camera?.aspect, 1));
  const angularRadius = Math.asin(Math.max(0, Math.min(0.999999, outerRadius / distance)));
  const tanRadius = Math.tan(angularRadius);
  const tanHalfY = Math.max(Math.tan(fovY * 0.5), 0.000001);
  const radiusNdcY = tanRadius / tanHalfY;
  const radiusNdcX = radiusNdcY / aspect;
  const clippedRadiusX = Math.min(Math.max(radiusNdcX, 0), 1.25);
  const clippedRadiusY = Math.min(Math.max(radiusNdcY, 0), 1.25);
  const coverage = clamp01Local(Math.PI * clippedRadiusX * clippedRadiusY * 0.25);
  const pressure = smoothstepLocal(0.24, 0.92, coverage);

  return { coverage, pressure, radiusNdcX, radiusNdcY };
}

function resolveAdaptiveRenderDivider(layer, width, height, screenMetrics) {
  const opt = layer.options || {};
  const perf = opt.performance || opt.perf || {};
  const baseDivider = Math.max(1, Math.floor(opt.renderScaleDivider ?? DEFAULT_RENDER_SCALE_DIVIDER));
  const adaptiveEnabled = perf.adaptiveScreenQuality ?? opt.adaptiveScreenQuality ?? true;
  if (!adaptiveEnabled) {
    layer.adaptiveRenderDivider = baseDivider;
    return baseDivider;
  }

  const maxPixels = Math.max(65536, finiteNumber(
    perf.maxRaymarchPixels ?? opt.maxRaymarchPixels,
    DEFAULT_MAX_RAYMARCH_PIXELS,
  ));
  const fullscreenPixels = Math.max(65536, Math.min(maxPixels, finiteNumber(
    perf.fullscreenRaymarchPixels ?? opt.fullscreenRaymarchPixels,
    DEFAULT_FULLSCREEN_RAYMARCH_PIXELS,
  )));
  const pixelBudget = mixNumber(maxPixels, fullscreenPixels, screenMetrics.pressure);
  const requiredDivider = Math.max(baseDivider, Math.ceil(Math.sqrt((width * height) / Math.max(pixelBudget, 1))));
  const maxDivider = Math.max(baseDivider, Math.floor(finiteNumber(
    perf.maxRenderScaleDivider ?? opt.maxRenderScaleDivider,
    8,
  )));
  const desiredDivider = Math.min(requiredDivider, maxDivider);

  const state = layer.adaptiveQualityState || {
    divider: baseDivider,
    releaseFrames: 0,
  };
  layer.adaptiveQualityState = state;

  if (desiredDivider > state.divider) {
    state.divider = desiredDivider;
    state.releaseFrames = 0;
  } else if (desiredDivider < state.divider) {
    state.releaseFrames += 1;
    const releaseDelay = Math.max(1, Math.floor(finiteNumber(
      perf.qualityReleaseFrames ?? opt.qualityReleaseFrames,
      45,
    )));
    if (state.releaseFrames >= releaseDelay) {
      state.divider = Math.max(desiredDivider, state.divider - 1);
      state.releaseFrames = 0;
    }
  } else {
    state.releaseFrames = 0;
  }

  layer.adaptiveRenderDivider = state.divider;
  return state.divider;
}

function resolveScreenPerformanceTuning(baseTuning, options, screenMetrics, cameraIsMoving) {
  const perf = options.performance || options.perf || {};
  const enabled = perf.adaptiveMarchQuality ?? options.adaptiveMarchQuality ?? true;
  if (!enabled || screenMetrics.pressure <= 0.0001) return baseTuning;

  const pressure = screenMetrics.pressure;
  const motionPressure = cameraIsMoving ? pressure : pressure * 0.72;
  const staticMaxSteps = Math.max(32, finiteNumber(
    perf.fullscreenMaxSteps ?? options.fullscreenMaxSteps,
    112,
  ));
  const movingMaxSteps = Math.max(24, finiteNumber(
    perf.movingFullscreenMaxSteps ?? options.movingFullscreenMaxSteps,
    80,
  ));
  const targetMaxSteps = cameraIsMoving ? movingMaxSteps : staticMaxSteps;
  const targetSunSteps = cameraIsMoving
    ? Math.max(1, finiteNumber(perf.movingFullscreenSunSteps ?? options.movingFullscreenSunSteps, 2))
    : Math.max(1, finiteNumber(perf.fullscreenSunSteps ?? options.fullscreenSunSteps, 3));
  const targetSunStride = cameraIsMoving
    ? Math.max(1, finiteNumber(perf.movingFullscreenSunStride ?? options.movingFullscreenSunStride, 8))
    : Math.max(1, finiteNumber(perf.fullscreenSunStride ?? options.fullscreenSunStride, 6));

  return {
    ...baseTuning,
    maxSteps: Math.max(24, Math.round(mixNumber(
      finiteNumber(baseTuning.maxSteps, 196),
      Math.min(finiteNumber(baseTuning.maxSteps, 196), targetMaxSteps),
      motionPressure,
    ))),
    sunSteps: Math.max(1, Math.round(mixNumber(
      finiteNumber(baseTuning.sunSteps, 5),
      Math.min(finiteNumber(baseTuning.sunSteps, 5), targetSunSteps),
      motionPressure,
    ))),
    sunStride: Math.max(1, Math.round(mixNumber(
      finiteNumber(baseTuning.sunStride, 4),
      Math.max(finiteNumber(baseTuning.sunStride, 4), targetSunStride),
      motionPressure,
    ))),
    nearStepScale: mixNumber(
      finiteNumber(baseTuning.nearStepScale, 0.30),
      Math.max(finiteNumber(baseTuning.nearStepScale, 0.30), cameraIsMoving ? 0.72 : 0.56),
      motionPressure,
    ),
    farStepMult: mixNumber(
      finiteNumber(baseTuning.farStepMult, 2.05),
      Math.max(finiteNumber(baseTuning.farStepMult, 2.05), cameraIsMoving ? 2.90 : 2.55),
      motionPressure,
    ),
    lodBiasWeather: finiteNumber(baseTuning.lodBiasWeather, 1.5) + motionPressure * 0.34,
    nearLodBias: finiteNumber(baseTuning.nearLodBias, -1.5) + motionPressure * 0.46,
    thickDetailSkip: mixNumber(
      finiteNumber(baseTuning.thickDetailSkip, 0.34),
      Math.max(finiteNumber(baseTuning.thickDetailSkip, 0.34), cameraIsMoving ? 0.68 : 0.54),
      motionPressure,
    ),
    thickLightSkip: mixNumber(
      finiteNumber(baseTuning.thickLightSkip, 0.40),
      Math.max(finiteNumber(baseTuning.thickLightSkip, 0.40), cameraIsMoving ? 0.74 : 0.60),
      motionPressure,
    ),
  };
}

function resolvePlanetCloudTuning(options = {}) {
  if (options.auroraMode) {
    return options.tuning || PLANET_CLOUD_FLAT_LAB_PRESET.tuning;
  }

  const tuning = mergePlain(PLANET_CLOUD_FLAT_LAB_PRESET.tuning, options.tuning || {});
  const fidelity = options.volumetricFidelity === false
    ? 0
    : clamp01Local(options.volumetricFidelity ?? 1);
  if (fidelity <= 0) return tuning;

  // Planet presets created before the spherical renderer tended to reuse the
  // same vertical sample across too much of the shell. These guardrails retain
  // their density/lighting character while restoring independent volume slices.
  return {
    ...tuning,
    verticalTextureHomogeneity: mixNumber(
      finiteNumber(tuning.verticalTextureHomogeneity, 0.46),
      Math.min(finiteNumber(tuning.verticalTextureHomogeneity, 0.46), 0.14),
      fidelity,
    ),
    sliceJitterStrength: mixNumber(
      finiteNumber(tuning.sliceJitterStrength, 0.0008),
      Math.max(finiteNumber(tuning.sliceJitterStrength, 0.0008), 0.032),
      fidelity,
    ),
    verticalLayerDecorrelation: mixNumber(
      finiteNumber(tuning.verticalLayerDecorrelation, 0.22),
      Math.max(finiteNumber(tuning.verticalLayerDecorrelation, 0.22), 0.46),
      fidelity,
    ),
    minOutputAlpha: mixNumber(
      finiteNumber(tuning.minOutputAlpha, 0.18),
      Math.min(finiteNumber(tuning.minOutputAlpha, 0.18), 0.05),
      fidelity,
    ),
    definition: mixNumber(
      finiteNumber(tuning.definition, 0.76),
      Math.min(finiteNumber(tuning.definition, 0.76), 0.58),
      fidelity,
    ),
  };
}

function nextVisualPaint() {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
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

function createSeededRandom(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampColorArray(color, minValue = 0.0, maxValue = 2.5) {
  return [
    Math.max(minValue, Math.min(maxValue, finiteNumber(color?.[0], 0))),
    Math.max(minValue, Math.min(maxValue, finiteNumber(color?.[1], 0))),
    Math.max(minValue, Math.min(maxValue, finiteNumber(color?.[2], 0))),
  ];
}

function mixColorArray(a, b, t) {
  return [
    mixNumber(finiteNumber(a?.[0], 0), finiteNumber(b?.[0], 0), t),
    mixNumber(finiteNumber(a?.[1], 0), finiteNumber(b?.[1], 0), t),
    mixNumber(finiteNumber(a?.[2], 0), finiteNumber(b?.[2], 0), t),
  ];
}

function resolveRandomizedAuroraParams(baseParams = {}, seed = 0, options = {}) {
  const amount = clamp01Local(finiteNumber(options.auroraGradientRandomAmount, 0.72));
  const greenBoost = Math.max(0.35, finiteNumber(options.auroraGreenBoost, 1.0));
  const rand = createSeededRandom(addSeed(seed >>> 0, 0x41A7));
  const paletteFamilies = {
    emerald_gold: {
      sunColor: [1.34, 0.70, 0.14],
      frontLightColor: [0.08, 0.98, 0.44],
      shadowLightColor: [1.16, 0.14, 0.08],
    },
    arctic_cyan: {
      sunColor: [0.58, 0.90, 1.22],
      frontLightColor: [0.10, 0.86, 1.06],
      shadowLightColor: [0.26, 0.42, 1.14],
    },
    violet_magenta: {
      sunColor: [0.98, 0.56, 1.24],
      frontLightColor: [0.36, 0.74, 1.00],
      shadowLightColor: [1.28, 0.18, 0.98],
    },
    teal_purple: {
      sunColor: [0.46, 0.96, 1.06],
      frontLightColor: [0.06, 0.82, 0.92],
      shadowLightColor: [0.96, 0.22, 1.14],
    },
    sunset_fire: {
      sunColor: [1.48, 0.84, 0.20],
      frontLightColor: [0.22, 0.72, 0.34],
      shadowLightColor: [1.34, 0.12, 0.18],
    },
    ruby_fire: {
      sunColor: [1.52, 0.72, 0.12],
      frontLightColor: [0.20, 0.62, 0.26],
      shadowLightColor: [1.42, 0.06, 0.36],
    },
    rose_purple: {
      sunColor: [1.16, 0.62, 0.92],
      frontLightColor: [0.50, 0.58, 0.96],
      shadowLightColor: [1.34, 0.22, 0.58],
    },
    solar_rainbow: {
      sunColor: [1.26, 0.82, 0.18],
      frontLightColor: [0.12, 0.92, 0.62],
      shadowLightColor: [0.98, 0.24, 1.06],
    },
  };
  const familyNames = Object.keys(paletteFamilies);
  const forcedFamily = typeof options.auroraPaletteFamily === 'string' && paletteFamilies[options.auroraPaletteFamily]
    ? options.auroraPaletteFamily
    : null;
  const familyAName = forcedFamily || familyNames[Math.floor(rand() * familyNames.length) % familyNames.length];
  const familyA = paletteFamilies[familyAName];
  const allowBlendFamilies = options.auroraBlendFamilies === true;
  const blendChance = allowBlendFamilies ? 0.45 : 0.0;
  const useBlend = rand() < blendChance;
  const familyBName = familyNames[Math.floor(rand() * familyNames.length) % familyNames.length];
  const familyB = paletteFamilies[familyBName];
  const blendT = useBlend ? (0.10 + rand() * 0.25) : 0.0;

  const sunVariant = mixColorArray(familyA.sunColor, familyB.sunColor, blendT);
  const frontVariant = mixColorArray(familyA.frontLightColor, familyB.frontLightColor, blendT);
  const shadowVariant = mixColorArray(familyA.shadowLightColor, familyB.shadowLightColor, blendT);

  const jitter = (scale) => (0.88 + rand() * scale);
  sunVariant[0] *= jitter(0.22);
  sunVariant[1] *= jitter(0.22);
  sunVariant[2] *= jitter(0.22);

  frontVariant[0] *= jitter(0.28);
  frontVariant[1] *= jitter(0.28);
  frontVariant[2] *= jitter(0.28);
  frontVariant[1] *= greenBoost;

  shadowVariant[0] *= jitter(0.26);
  shadowVariant[1] *= jitter(0.26);
  shadowVariant[2] *= jitter(0.26);

  const base = mergePlain(PLANET_AURORA_FAST_PRESET.params, baseParams || {});
  return mergePlain(base, {
    sunColor: clampColorArray(mixColorArray(base.sunColor || familyA.sunColor, sunVariant, amount), 0.0, 2.5),
    frontLightColor: clampColorArray(mixColorArray(base.frontLightColor || familyA.frontLightColor, frontVariant, amount), 0.0, 2.5),
    shadowLightColor: clampColorArray(mixColorArray(base.shadowLightColor || familyA.shadowLightColor, shadowVariant, amount), 0.0, 2.5),
  });
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

  const view = noiseBuilder.get3DView(textureId);
  // Oversized chunked volumes retain their existing representation.
  return view?.views ? view : planetVolumeMips(noiseBuilder).bake(view,size,textureId);
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

  const view = noiseBuilder.get3DView(textureId);
  return view?.views ? view : planetVolumeMips(noiseBuilder).bake(view,size,textureId);
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

function createPlanetCloudLoadingMessage(parent, options = {}) {
  if (options.loadingMessage === false) return null;
  const message = document.createElement('div');
  message.dataset.planetCloudLoading = 'true';
  message.textContent = typeof options.loadingMessage === 'string'
    ? options.loadingMessage
    : (options.auroraMode ? 'Preparing planetary aurora…' : 'Preparing planetary clouds…');
  message.style.cssText = [
    'position:absolute',
    'left:50%',
    'top:50%',
    'transform:translate(-50%,-50%)',
    'z-index:40',
    'pointer-events:none',
    'padding:10px 14px',
    'border-radius:10px',
    'border:1px solid rgba(150,190,255,0.35)',
    'background:rgba(4,8,15,0.82)',
    'color:#e8f2ff',
    'font:600 13px/1.3 system-ui,sans-serif',
    'letter-spacing:0.02em',
    'box-shadow:0 8px 30px rgba(0,0,0,0.28)',
    'backdrop-filter:blur(8px)',
  ].join(';');
  parent.appendChild(message);
  return message;
}

function setPlanetCloudLoadingMessage(message, text) {
  if (message) message.textContent = text;
}

async function prewarmPlanetCloudPipeline(layer) {
  const started = performance.now();
  const cb = layer.cloudBuilder;
  let pipelinePromise;
  if (typeof cb.prewarmComputePipelineVariantAsync === 'function') {
    pipelinePromise = cb.prewarmComputePipelineVariantAsync({
      spherical: true,
      aurora: !!layer.options.auroraMode,
      useCustomPos: false,
      writeRGB: true,
      sunStride: layer.options.tuning?.sunStride ?? cb._state?.tuning?.sunStride ?? 4,
    });
  } else if (typeof cb.ensureComputePipelineReadyAsync === 'function') {
    pipelinePromise = cb.ensureComputePipelineReadyAsync();
  } else {
    pipelinePromise = Promise.resolve(cb.ensureComputePipelineReady?.());
  }
  // Planet presets render coarsely on their first frame, so compile the tiny
  // reconstruction pass while the loading message is already visible too.
  cb.ensureUpsamplePipelineReady?.(
    layer.options.textures?.outputFormat || layer.options.outputFormat || 'rgba16float',
  );
  await pipelinePromise;
  return performance.now() - started;
}

async function prewarmPlanetBootstrapPipeline(layer) {
  if (layer.options.progressiveStartup === false) return 0;
  const started = performance.now();
  const cb = layer.cloudBuilder;
  if (typeof cb.ensureBootstrapComputePipelineReadyAsync === 'function') {
    await cb.ensureBootstrapComputePipelineReadyAsync(
      layer.options.textures?.outputFormat || layer.options.outputFormat || 'rgba16float',
    );
  }
  return performance.now() - started;
}

function getSharedPlanetNoiseBuilder(device, queue) {
  let builder = PLANET_NOISE_BUILDER_CACHE.get(device);
  if (!builder) {
    builder = new NoiseComputeBuilder(device, queue);
    PLANET_NOISE_BUILDER_CACHE.set(device, builder);
  }
  return builder;
}

function collectPlanetNoisePipelineEntries(options = {}) {
  const entries = new Set(['clearTexture', 'computeBlueNoise']);
  const styled = !options.auroraMode && options.cloudStyle && options.cloudStyle !== 'legacy';
  if (!styled) {
    const weather = mergePlain(PLANET_CLOUD_NOISE.weather, options.weather);
    const weatherG = mergePlain(PLANET_CLOUD_NOISE.weatherG, options.weatherG);
    const weatherB = mergePlain(PLANET_CLOUD_NOISE.weatherB, options.weatherB);
    entries.add(weather.mode || 'computeFBM');
    if (weatherG.enabled !== false) entries.add(weatherG.mode || 'computeBillow');
    if (weatherB.enabled === true) entries.add(weatherB.mode || 'computeBillow');

    const shapeDefaults = options.auroraMode
      ? mergePlain(PLANET_CLOUD_NOISE.shape, PLANET_AURORA_NOISE.shape)
      : PLANET_CLOUD_NOISE.shape;
    const shape = mergePlain(shapeDefaults, options.shape);
    entries.add(shape.baseModeA || 'computeAntiWorley4D');
    entries.add(shape.baseModeB || shape.baseModeA || 'computeAntiWorley4D');
    entries.add(shape.bandMode2 || 'computeWorley4D');
    entries.add(shape.bandMode3 || 'computeWorley4D');
    entries.add(shape.bandMode4 || 'computeWorley4D');
  }

  const detailDefaults = options.auroraMode
    ? mergePlain(PLANET_CLOUD_NOISE.detail, PLANET_AURORA_NOISE.detail)
    : PLANET_CLOUD_NOISE.detail;
  const detail = mergePlain(detailDefaults, options.detail);
  entries.add(detail.mode1 || 'computeWorley4D');
  entries.add(detail.mode2 || 'computeWorley4D');
  entries.add(detail.mode3 || 'computeWorley4D');
  return [...entries];
}

async function prewarmPlanetNoisePipelines(layer) {
  const started = performance.now();
  const nb = layer.noiseBuilder;
  if (!nb?.shaderModule || !nb?.pipelineLayout || !nb?.pipelines) return 0;
  const pendingByEntry = nb._planetCloudPipelinePromises || new Map();
  nb._planetCloudPipelinePromises = pendingByEntry;

  const compileEntry = (entry) => {
    if (nb.pipelines.has(entry)) return Promise.resolve(nb.pipelines.get(entry));
    const existing = pendingByEntry.get(entry);
    if (existing) return existing;
    const descriptor = {
      layout: nb.pipelineLayout,
      compute: { module: nb.shaderModule, entryPoint: entry },
    };
    const create = async () => {
      const pipeline = typeof nb.device.createComputePipelineAsync === 'function'
        ? await nb.device.createComputePipelineAsync(descriptor)
        : nb.device.createComputePipeline(descriptor);
      const installed = nb.pipelines.get(entry);
      if (installed) return installed;
      nb.pipelines.set(entry, pipeline);
      return pipeline;
    };
    const pending = create();
    pendingByEntry.set(entry, pending);
    const clearPending = () => {
      if (pendingByEntry.get(entry) === pending) pendingByEntry.delete(entry);
    };
    pending.then(clearPending, clearPending);
    return pending;
  };

  const pending = collectPlanetNoisePipelineEntries(layer.options).map(compileEntry);
  if (!layer.options.auroraMode && layer.options.cloudStyle && layer.options.cloudStyle !== 'legacy') {
    pending.push(planetStyleNoise(nb).prepare());
  }
  await Promise.all(pending);
  return performance.now() - started;
}

function resizeOverlayCanvas(canvas, sourceCanvas, options = {}) {
  const requestedDpr = Math.max(0.25, finiteNumber(options.dpr, window.devicePixelRatio || 1));
  const maxDpr = Math.max(0.25, finiteNumber(
    options.performance?.maxDpr ?? options.perf?.maxDpr ?? options.maxDpr,
    DEFAULT_MAX_DPR,
  ));
  const dpr = Math.min(requestedDpr, maxDpr);
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

  const sourceView = layer.cloudBuilder.outView;
  if (!layer.overlayBindGroup || layer.overlayBindGroupView !== sourceView) {
    layer.overlayBindGroup = layer.device.createBindGroup({
      layout: layer.overlayPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: layer.overlaySampler },
        { binding: 1, resource: sourceView },
        { binding: 2, resource: { buffer: layer.overlayParams } },
      ],
    });
    layer.overlayBindGroupView = sourceView;
  }

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
  pass.setBindGroup(0, layer.overlayBindGroup);
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

function ensureCloudHistory(layer, width, height, coarseFactor = 1) {
  if (!wantsCloudHistory(layer)) {
    destroyCloudHistory(layer);
    layer.cloudBuilder.setInputMaps({ historyPrevView: null, historyOutView: null });
    return null;
  }

  // Dispatch writes and samples history in its actual raymarch dimensions,
  // not the upsampled presentation size. A full-size history here left the
  // coarse image in its corner, then sampled it as a second smaller planet.
  const factor = Math.max(1, Math.floor(coarseFactor));
  const w = Math.max(1, Math.ceil(width / factor));
  const h = Math.max(1, Math.ceil(height / factor));
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
  layer.historyWarmupFrames = Math.max(1, layer.historyWarmupFrames | 0);

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


function normalizePlanetCloudRenderMode(mode) {
  return String(mode || '').toLowerCase() === 'mc33-shell' ? 'mc33-shell' : 'raymarch';
}

function setPlanetCloudLayerVisible(layer, visible) {
  if (!layer?.canvas) return;
  layer.canvas.style.display = visible ? '' : 'none';
  layer.canvas.style.visibility = visible ? 'visible' : 'hidden';
}

function updatePlanetCloudToggleButton(controller) {
  const button = controller?.toggleButton;
  if (!button) return;
  const mode = controller.activeMode || 'raymarch';
  const alternateMode = mode === 'mc33-shell' ? 'raymarch' : 'mc33-shell';
  const alternateReady = !!controller?.renderers?.get?.(alternateMode) && !controller.renderers.get(alternateMode)?.disposed;
  button.textContent = mode === 'mc33-shell' ? 'Clouds: MC33 Shell' : 'Clouds: Raymarch';
  button.dataset.cloudRenderMode = mode;
  button.dataset.alternateReady = alternateReady ? 'true' : 'false';
  button.title = mode === 'mc33-shell' ? 'Switch planet clouds to raymarch' : 'Switch planet clouds to MC33 shell';
  button.disabled = !!controller.switchPromise;
  button.style.opacity = button.disabled ? '0.66' : '1';
}

function ensureToggleParentPosition(parent) {
  if (!parent || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return;
  try {
    const computed = window.getComputedStyle(parent);
    if (computed?.position === 'static' || !computed?.position) {
      parent.style.position = 'relative';
    }
  } catch {}
}

function queuePlanetCloudAlternatePreload(controller) {
  if (!controller || controller.disposed || controller._alternatePreloadQueued) return;
  if (controller.options.preloadAlternateCloudRenderer === true) return;
  if (controller.options.preloadAlternateCloudRendererOnIdle === false) return;
  controller._alternatePreloadQueued = true;
  const preload = async () => {
    controller._alternatePreloadQueued = false;
    if (controller.disposed) return;
    const alternateMode = controller.activeMode === 'mc33-shell' ? 'raymarch' : 'mc33-shell';
    const cached = controller.renderers.get(alternateMode);
    if (cached && !cached.disposed) {
      updatePlanetCloudToggleButton(controller);
      return;
    }
    try {
      if (controller.activeLayer?.refinementPromise) {
        await controller.activeLayer.refinementPromise;
        if (controller.disposed) return;
      }
      const alternateLayer = await createPlanetCloudRendererImplementation({
        ...controller.creationConfig,
        radius: controller.radius,
        atmosphereRadius: controller.atmosphereRadius,
        options: controller.options,
      }, alternateMode);
      controller.renderers.set(alternateMode, alternateLayer);
      setPlanetCloudLayerVisible(alternateLayer, false);
      updatePlanetCloudToggleButton(controller);
    } catch (error) {
      console.warn('Planet cloud alternate renderer preload failed:', error);
    }
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => { preload(); }, { timeout: 1800 });
  } else {
    setTimeout(() => { preload(); }, 300);
  }
}

function createPlanetCloudToggleButton(controller) {
  if (!controller?.parent || controller.options.showRenderModeToggle === false) return null;
  ensureToggleParentPosition(controller.parent);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = controller.options.renderModeToggleClassName || 'planet-cloud-render-mode-toggle';
  Object.assign(button.style, {
    position: 'absolute',
    right: '12px',
    bottom: '64px',
    zIndex: String(finiteNumber(controller.options.renderModeToggleZIndex, 40)),
    padding: '7px 10px',
    border: '1px solid rgba(255,255,255,0.32)',
    borderRadius: '7px',
    background: 'rgba(7,11,18,0.72)',
    color: '#f4f7ff',
    font: '12px/1.2 system-ui, sans-serif',
    letterSpacing: '0.02em',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
  });
  button.addEventListener('click', async () => {
    try {
      await togglePlanetCloudRenderMode(controller);
    } catch (error) {
      console.error('Failed to toggle planet cloud renderer:', error);
    }
  });
  controller.parent.appendChild(button);
  controller.toggleButton = button;
  updatePlanetCloudToggleButton(controller);
  return button;
}

function createPlanetCloudStyleControl(layer) {
  if (!layer?.parent || layer.options.auroraMode || layer.options.showCloudStyleControl === false || layer.styleControl) return;
  ensureToggleParentPosition(layer.parent);
  const select = document.createElement('select');
  select.setAttribute('aria-label','Planet cloud style');
  Object.assign(select.style,{position:'absolute',right:'12px',bottom:'100px',zIndex:'40',
    padding:'7px 10px',border:'1px solid rgba(255,255,255,.32)',borderRadius:'7px',
    background:'rgba(7,11,18,.82)',color:'#f4f7ff',font:'12px system-ui'});
  for (const style of PLANET_CLOUD_STYLES) {
    const option=document.createElement('option');option.value=style.id;option.textContent=style.label;select.appendChild(option);
  }
  select.value=layer.options.cloudStyle || 'legacy';
  select.addEventListener('change',async()=>{
    const previous=layer.options.cloudStyle || 'legacy';select.disabled=true;
    try { await setPlanetCloudStyle(layer,select.value); }
    catch(error) { select.value=previous;console.error('Planet cloud style could not be applied:',error); }
    finally { if(!layer.disposed)select.disabled=false; }
  });
  layer.parent.appendChild(select);layer.styleControl=select;
  const target=layer.activeLayer || layer;
  if(target.refinementPromise) {
    select.disabled=true;
    target.refinementPromise.finally(()=>{if(!layer.disposed)select.disabled=false;});
  }
}

// A deliberate one-time texture rebake, with the last complete image retained
// until all maps are ready. Ordinary camera/sun/option changes still never bake.
export async function setPlanetCloudStyle(layer, style) {
  if(!layer || layer.disposed)return null;
  const target=layer;
  if(target._stylePromise){await target._stylePromise;return setPlanetCloudStyle(layer,style);}
  const transaction=applyPlanetCloudStyle(layer,style);
  target._stylePromise=transaction;
  try{return await transaction;}
  finally{if(target._stylePromise===transaction)target._stylePromise=null;}
}

async function applyPlanetCloudStyle(layer, style) {
  if (!layer || layer.disposed) return null;
  if(layer.kind === 'planet-cloud-render-toggle') {
    if(layer.switchPromise)await layer.switchPromise;
    // Keep cached peers coherent; returning to raymarch must not resurrect
    // an old weather map after editing the style in mesh mode.
    for(const renderer of layer.renderers.values())await applyPlanetCloudStyle(renderer,style);
    layer.options=mergePlain(layer.options,{...layer.activeLayer.options,cloudRenderMode:layer.activeMode});
    if(layer.styleControl)layer.styleControl.value=style;
    return layer.options;
  }
  const target=layer.activeLayer || layer;
  if(target.kind==='mc33-shell')return setPlanetCloudSurfaceStyle(target,style);
  if(target.options.auroraMode) throw new Error('Cloud styles do not apply to aurora.');
  const overrides=planetCloudStyleOptions(style,target.radius);
  if(target.refinementPromise) await target.refinementPromise;
  if(layer.disposed || target.disposed) return null;
  target._styleBaseOptions ||= clonePlain(target.options);
  const previous=target.options,previousKeys=target.resourceKeys,previousTextures=target.textures;
  const base=target._styleBaseOptions;
  const next=mergePlain(base,{...overrides,cloudStyle:style,
    resourceNonce:`${base.resourceNonce}-style-${(target._styleRevision=(target._styleRevision||0)+1)}`});
  const nextKeys=Object.fromEntries(['weather','shape','detail','blue'].map(kind=>[kind,cloudResourceKey(next,kind,target.seed)]));
  target.styleChanging=true;
  const release=keys=>{
    if(!keys)return;
    PLANET_STYLE_NOISE.get(target.noiseBuilder)?.release(keys.shape);
    for(const key of [keys.weather,keys.blue])target.noiseBuilder.destroyTexturePair?.(key);
    for(const key of [keys.shape,keys.detail]) {
      target.noiseBuilder.destroyVolume?.(key);PLANET_VOLUME_MIPS.get(target.noiseBuilder)?.release(key);
    }
  };
  const transaction=(async()=>{
    await bakePlanetCloudResources(target,{options:next});
    await target.queue.onSubmittedWorkDone();
    if(layer.disposed || target.disposed) {release(target.resourceKeys);return null;}
    target.options=next;configurePlanetCloudBuilder(target);
    // A first switch from custom clouds must not compile synchronously in the
    // animation loop. Keep the previous canvas image until the variant is ready.
    await target.cloudBuilder.ensureComputePipelineReadyAsync?.();
    if(layer.disposed || target.disposed) {release(target.resourceKeys);return null;}
    destroyCloudHistory(target);
    if(layer.activeLayer) layer.options=mergePlain(layer.options,next);
    if(layer.styleControl)layer.styleControl.value=style;
    release(previousKeys);
    return next;
  })();
  try { return await transaction; }
  catch(error) {
    release(nextKeys);
    if(!target.disposed) {
      target.options=previous;target.resourceKeys=previousKeys;target.textures=previousTextures;
      if(previousTextures)target.cloudBuilder.setInputMaps(previousTextures);
      configurePlanetCloudBuilder(target);
    }
    throw error;
  }
  finally {target.styleChanging=false;}
}

async function createPlanetCloudRendererImplementation(config, mode) {
  const normalizedMode = normalizePlanetCloudRenderMode(mode);
  const options = mergePlain(config.options || {}, {
    cloudRenderMode: normalizedMode,
    enableRenderModeToggle: false,
    showRenderModeToggle: false,
    showCloudStyleControl: false,
    auroraMode: false,
  });
  return createPlanetCloudLayer({ ...config, options });
}

export async function createPlanetCloudRenderToggleLayer(config = {}) {
  const initialMode = normalizePlanetCloudRenderMode(config.options?.cloudRenderMode || 'raymarch');
  const controller = {
    kind: 'planet-cloud-render-toggle',
    device: config.device,
    queue: config.queue,
    parent: config.parent,
    sourceCanvas: config.sourceCanvas,
    _radius: config.radius ?? 50,
    _atmosphereRadius: config.atmosphereRadius ?? 68,
    getCameraState: config.getCameraState,
    getSunDir: config.getSunDir,
    options: mergePlain(
      { preloadAlternateCloudRendererOnIdle: false },
      mergePlain(config.options || {}, {
        cloudRenderMode: initialMode,
        enableRenderModeToggle: true,
      }),
    ),
    creationConfig: { ...config },
    renderers: new Map(),
    activeLayer: null,
    activeMode: initialMode,
    switchPromise: null,
    toggleButton: null,
    disposed: false,
  };

  Object.defineProperties(controller, {
    radius: {
      enumerable: true,
      get() { return controller._radius; },
      set(value) {
        const resolved = finiteNumber(value, controller._radius);
        controller._radius = resolved;
        controller.creationConfig.radius = resolved;
        for (const renderer of controller.renderers.values()) renderer.radius = resolved;
      },
    },
    atmosphereRadius: {
      enumerable: true,
      get() { return controller._atmosphereRadius; },
      set(value) {
        const resolved = finiteNumber(value, controller._atmosphereRadius);
        controller._atmosphereRadius = resolved;
        controller.creationConfig.atmosphereRadius = resolved;
        for (const renderer of controller.renderers.values()) renderer.atmosphereRadius = resolved;
      },
    },
    canvas: {
      enumerable: true,
      get() { return controller.activeLayer?.canvas || null; },
    },
    performanceStats: {
      enumerable: true,
      get() { return controller.activeLayer?.performanceStats || null; },
    },
    timings: {
      enumerable: true,
      get() { return controller.activeLayer?.timings || null; },
    },
    startupTiming: {
      enumerable: true,
      get() { return controller.activeLayer?.startupTiming || null; },
    },
    refinementPromise: {
      enumerable: true,
      get() { return controller.activeLayer?.refinementPromise || null; },
    },
    configSummary: {
      enumerable: true,
      get() { return controller.activeLayer?.configSummary || null; },
    },
    textures: {
      enumerable: true,
      get() { return controller.activeLayer?.textures || null; },
    },
    seed: {
      enumerable: true,
      get() { return controller.activeLayer?.seed ?? controller.options.seed; },
    },
  });

  const initialLayer = await createPlanetCloudRendererImplementation({
    ...controller.creationConfig,
    radius: controller.radius,
    atmosphereRadius: controller.atmosphereRadius,
  }, initialMode);
  controller.renderers.set(initialMode, initialLayer);
  controller.activeLayer = initialLayer;
  controller.options = mergePlain(initialLayer.options || controller.options, {
    enableRenderModeToggle: true,
    showRenderModeToggle: controller.options.showRenderModeToggle,
    preloadAlternateCloudRenderer: controller.options.preloadAlternateCloudRenderer,
    preloadAlternateCloudRendererOnIdle: controller.options.preloadAlternateCloudRendererOnIdle,
    cloudRenderMode: initialMode,
  });
  setPlanetCloudLayerVisible(initialLayer, true);
  createPlanetCloudToggleButton(controller);
  createPlanetCloudStyleControl(controller);

  if (controller.options.preloadAlternateCloudRenderer === true) {
    if (initialLayer?.refinementPromise) await initialLayer.refinementPromise;
    const alternateMode = initialMode === 'mc33-shell' ? 'raymarch' : 'mc33-shell';
    const alternateLayer = await createPlanetCloudRendererImplementation({
      ...controller.creationConfig,
      radius: controller.radius,
      atmosphereRadius: controller.atmosphereRadius,
      options: controller.options,
    }, alternateMode);
    controller.renderers.set(alternateMode, alternateLayer);
    setPlanetCloudLayerVisible(alternateLayer, false);
  } else {
    queuePlanetCloudAlternatePreload(controller);
  }

  updatePlanetCloudToggleButton(controller);
  return controller;
}

export function getPlanetCloudRenderMode(layer) {
  if (layer?.kind === 'planet-cloud-render-toggle') return layer.activeMode;
  return layer?.kind === 'mc33-shell' ? 'mc33-shell' : 'raymarch';
}

export async function setPlanetCloudRenderMode(layer, mode, overrides = {}) {
  const normalizedMode = normalizePlanetCloudRenderMode(mode);
  if (!layer || layer.disposed) return layer;
  if (layer.options?.auroraMode === true) return layer;
  if (layer._stylePromise) await layer._stylePromise;

  if (layer.kind !== 'planet-cloud-render-toggle') {
    const currentMode = getPlanetCloudRenderMode(layer);
    if (currentMode === normalizedMode) return layer;
    const cachedPeer = layer._planetCloudTogglePeer;
    if (cachedPeer && !cachedPeer.disposed && getPlanetCloudRenderMode(cachedPeer) === normalizedMode) {
      if (Object.keys(overrides || {}).length > 0) {
        updatePlanetCloudLayerOptions(cachedPeer, overrides);
      }
      setPlanetCloudLayerVisible(layer, false);
      setPlanetCloudLayerVisible(cachedPeer, true);
      if(layer.animationClock)cachedPeer.animationClock={...layer.animationClock,last:performance.now()*0.001};
      await updatePlanetCloudLayer(cachedPeer);
      return cachedPeer;
    }
    const creationConfig = layer._planetCloudCreationConfig || {
      device: layer.device,
      queue: layer.queue,
      noiseBuilder: null,
      parent: layer.parent || layer.canvas?.parentElement,
      sourceCanvas: layer.sourceCanvas,
      getCameraState: layer.getCameraState,
      getSunDir: layer.getSunDir,
      radius: layer.radius,
      atmosphereRadius: layer.atmosphereRadius,
      options: layer.options,
    };
    const nextLayer = await createPlanetCloudRendererImplementation({
      ...creationConfig,
      options: mergePlain(creationConfig.options || {}, overrides || {}),
    }, normalizedMode);
    setPlanetCloudLayerVisible(layer, false);
    setPlanetCloudLayerVisible(nextLayer, true);
    layer._planetCloudTogglePeer = nextLayer;
    nextLayer._planetCloudTogglePeer = layer;
    if(layer.animationClock)nextLayer.animationClock={...layer.animationClock,last:performance.now()*0.001};
    await updatePlanetCloudLayer(nextLayer);
    return nextLayer;
  }

  if (layer.activeMode === normalizedMode && Object.keys(overrides || {}).length === 0) return layer;
  if (layer.switchPromise) {
    await layer.switchPromise;
    if (layer.activeMode === normalizedMode && Object.keys(overrides || {}).length === 0) return layer;
  }

  if (layer.toggleButton) layer.toggleButton.disabled = true;
  layer.switchPromise = (async () => {
    let renderer = layer.renderers.get(normalizedMode);
    if (!renderer || renderer.disposed) {
      const creationConfig = {
        ...layer.creationConfig,
        radius: layer.radius,
        atmosphereRadius: layer.atmosphereRadius,
        options: mergePlain(layer.options || {}, overrides || {}),
      };
      renderer = await createPlanetCloudRendererImplementation(creationConfig, normalizedMode);
      layer.renderers.set(normalizedMode, renderer);
    } else if (Object.keys(overrides || {}).length > 0) {
      updatePlanetCloudLayerOptions(renderer, overrides);
    }

    if(layer.activeLayer?.animationClock && renderer !== layer.activeLayer){
      renderer.animationClock={...layer.activeLayer.animationClock,last:performance.now()*0.001};
      if(renderer.kind==='mc33-shell'){renderer.fieldValid=false;renderer.topologyDirty=true;}
    }
    for (const cachedRenderer of layer.renderers.values()) {
      setPlanetCloudLayerVisible(cachedRenderer, cachedRenderer === renderer);
    }
    layer.activeLayer = renderer;
    layer.activeMode = normalizedMode;
    layer.options = mergePlain(renderer.options || layer.options || {}, {
      ...overrides,
      enableRenderModeToggle: true,
      showRenderModeToggle: layer.options.showRenderModeToggle,
      preloadAlternateCloudRenderer: layer.options.preloadAlternateCloudRenderer,
      preloadAlternateCloudRendererOnIdle: layer.options.preloadAlternateCloudRendererOnIdle,
      cloudRenderMode: normalizedMode,
    });
    await updatePlanetCloudLayer(renderer);
  })();

  try {
    await layer.switchPromise;
  } finally {
    layer.switchPromise = null;
    updatePlanetCloudToggleButton(layer);
  }
  return layer;
}

export async function togglePlanetCloudRenderMode(layer, overrides = {}) {
  const nextMode = getPlanetCloudRenderMode(layer) === 'mc33-shell' ? 'raymarch' : 'mc33-shell';
  return setPlanetCloudRenderMode(layer, nextMode, overrides);
}

export function getPlanetCloudAvailableRenderModes(layer) {
  if (layer?.kind === 'planet-cloud-render-toggle') {
    return {
      activeMode: layer.activeMode,
      cachedModes: Array.from(layer.renderers.keys()),
      preloadAlternateCloudRendererOnIdle: layer.options.preloadAlternateCloudRendererOnIdle !== false,
      alternateReady: layer.renderers.has(layer.activeMode === 'mc33-shell' ? 'raymarch' : 'mc33-shell'),
    };
  }
  const mode = getPlanetCloudRenderMode(layer);
  return {
    activeMode: mode,
    cachedModes: [mode],
    preloadAlternateCloudRendererOnIdle: false,
    alternateReady: false,
  };
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
  const resolvedCloudRenderMode = options?.auroraMode === true
    ? 'raymarch'
    : normalizePlanetCloudRenderMode(options?.cloudRenderMode || 'raymarch');
  options = mergePlain(options || {}, {
    cloudRenderMode: resolvedCloudRenderMode,
  });

  if (
    options.auroraMode !== true &&
    options.enableRenderModeToggle !== false
  ) {
    return createPlanetCloudRenderToggleLayer({
      device,
      queue,
      noiseBuilder,
      parent,
      sourceCanvas,
      getCameraState,
      getSunDir,
      radius,
      atmosphereRadius,
      options,
    });
  }
  if (options?.cloudRenderMode === 'mc33-shell' && options?.auroraMode !== true) {
    const surfaceLayer = await createPlanetCloudSurfaceLayer({
      device,
      queue,
      noiseBuilder,
      parent,
      sourceCanvas,
      getCameraState,
      getSunDir,
      radius,
      atmosphereRadius,
      options,
    });
    surfaceLayer._planetCloudCreationConfig = {
      device,
      queue,
      noiseBuilder,
      parent,
      sourceCanvas,
      getCameraState,
      getSunDir,
      radius,
      atmosphereRadius,
      options,
    };
    return surfaceLayer;
  }
  if (!device || !queue) throw new Error('createPlanetCloudLayer requires a GPUDevice and GPUQueue.');
  if (!parent || !sourceCanvas) throw new Error('createPlanetCloudLayer requires parent and sourceCanvas.');

  const seed = Math.floor(options.seed ?? Date.now()) >>> 0;
  const visualPreset = options.auroraMode
    ? mergePlain(PLANET_CLOUD_FLAT_LAB_PRESET, PLANET_AURORA_FAST_PRESET)
    : mergePlain(PLANET_CLOUD_FLAT_LAB_PRESET, planetCloudStyleOptions(options.cloudStyle || 'legacy', radius));
  const defaultOptions = {
    enabled: true,
    weatherWidth: DEFAULT_WEATHER_WIDTH,
    weatherHeight: DEFAULT_WEATHER_HEIGHT,
    shapeSize: DEFAULT_SHAPE_SIZE,
    detailSize: DEFAULT_DETAIL_SIZE,
    blueWidth: DEFAULT_BLUE_SIZE,
    blueHeight: DEFAULT_BLUE_SIZE,
    renderScaleDivider: 4,
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
    auroraSpinSpeed: 0.0024,
    auroraRollSpeed: 0.0065,
    auroraShapeFlowSpeed: 0.0032,
    auroraShapeRollSpeed: 0.0014,
    auroraDetailFlowSpeed: -0.0054,
    auroraDetailRollSpeed: -0.0028,
    auroraRandomizeGradient: true,
    auroraGradientRandomAmount: 0.72,
    auroraGreenBoost: 1.0,
    meridionalDrift: 0.0,
    shapeSpinFactor: 0.68,
    detailSpinFactor: 1.27,
    shapeMeridionalDrift: 0.0025,
    detailMeridionalDrift: -0.004,
    weatherMeridionalDrift: 0.0008,
    nearSurfaceAdaptiveQuality: false,
    nearSurfaceCoarseFactor: 2,
    nearSurfaceMovingCoarseFactor: 2,
    nearSurfaceMaxSteps: 96,
    nearSurfaceSunSteps: 2,
    nearSurfaceSunStride: 8,
    nearSurfaceNearStepScale: 0.78,
    nearSurfaceLodBias: 0.10,
    maxDpr: DEFAULT_MAX_DPR,
    maxRaymarchPixels: DEFAULT_MAX_RAYMARCH_PIXELS,
    fullscreenRaymarchPixels: DEFAULT_FULLSCREEN_RAYMARCH_PIXELS,
    adaptiveScreenQuality: false,
    adaptiveMarchQuality: false,
    motionAdaptiveMarchQuality: false,
    dynamicCoarseQuality: false,
    cameraAdaptiveTemporalQuality: false,
    coarseFactor: 2,
    animatedTemporalCellRate: 2,
    animatedTemporalBlend: 0.45,
    auroraTemporalBlend: 0.22,
    movingFullscreenCoarseFactor: 1,
    bootstrapFrames: 2,
    bootstrapMaxSteps: 64,
    bootstrapSunSteps: 1,
    bootstrapSunStride: 10,
    progressiveStartup: true,
    bootstrapWeatherWidth: 128,
    bootstrapWeatherHeight: 64,
    bootstrapShapeSize: 32,
    bootstrapDetailSize: 16,
    bootstrapBlueSize: 64,
    bootstrapRenderScaleDivider: 8,
    reprojection: {
      enabled: 1,
      temporalCellRate: 4,
      temporalBlend: 0.94,
      compactInterleave: 1,
    },
    resourceNonce: options.resourceNonce ?? `${seed}-${Date.now()}`,
  };
  // Keep an unstyled baseline even when the layer starts in a new style.
  const customBaseOptions = mergePlain(mergePlain(defaultOptions,PLANET_CLOUD_FLAT_LAB_PRESET),{...options,cloudStyle:'legacy'});
  const mergedOptions = mergePlain(mergePlain(defaultOptions,visualPreset), options || {});
  if (!mergedOptions.resourceNonce) mergedOptions.resourceNonce = `${seed}-${Date.now()}`;
  if (mergedOptions.auroraMode) {
    const auroraGradientSeed = Math.floor(mergedOptions.auroraGradientSeed ?? seed) >>> 0;
    mergedOptions.auroraGradientSeed = auroraGradientSeed;
    if (mergedOptions.auroraRandomizeGradient !== false) {
      mergedOptions.params = resolveRandomizedAuroraParams(
        PLANET_AURORA_FAST_PRESET.params,
        auroraGradientSeed,
        mergedOptions,
      );
    }
  }

  const startupTiming = new CloudTimingReport('planet-cloud-first-load', {
    seed,
    progressive: mergedOptions.progressiveStartup !== false,
    fullSizes: {
      weather: [mergedOptions.weatherWidth, mergedOptions.weatherHeight],
      shape: mergedOptions.shapeSize,
      detail: mergedOptions.detailSize,
      blue: [mergedOptions.blueWidth, mergedOptions.blueHeight],
    },
  });
  const setupStage = startupTiming.start('create-canvas-builders-and-layer-state', undefined, 'setup');

  const canvas = createOverlayCanvas(parent, sourceCanvas, mergedOptions);
  const loadingMessage = createPlanetCloudLoadingMessage(parent, mergedOptions);
  const cloudBuilder = new CloudComputeBuilder(device, queue);
  cloudBuilder.setOutputExtent?.(
    1,
    1,
    1,
    mergedOptions.textures?.outputFormat || mergedOptions.outputFormat || 'rgba16float',
    { releaseOutput: true },
  );
  const nb = noiseBuilder || getSharedPlanetNoiseBuilder(device, queue);

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
    ownsNoiseBuilder: false,
    sharedNoiseBuilder: !noiseBuilder,
    cloudBuilder,
    options: mergedOptions,
    _styleBaseOptions: customBaseOptions,
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
    overlayBindGroup: null,
    overlayBindGroupView: null,
    textures: null,
    timings: null,
    loadingMessage,
    startupTiming: startupTiming.snapshot(),
    refinementPromise: null,
    bootstrapResourceKeys: null,
    useBootstrapPreview: false,
    pipelineWarmupMs: 0,
    bootstrapPipelineWarmupMs: 0,
    nearSurfaceFactor: 0,
    adaptiveRenderDivider: Math.max(1, Math.floor(mergedOptions.renderScaleDivider ?? DEFAULT_RENDER_SCALE_DIVIDER)),
    adaptiveQualityState: null,
    performanceStats: null,
    history: null,
    historyWarmupFrames: 1,
    wasCameraMoving: false,
    configSummary: {
      preset: clonePlain(visualPreset),
      noise: clonePlain(PLANET_CLOUD_NOISE),
      resourceNonce: mergedOptions.resourceNonce,
    },
  };
  startupTiming.end(setupStage);
  layer._planetCloudCreationConfig = {
    device,
    queue,
    noiseBuilder,
    parent,
    sourceCanvas,
    getCameraState,
    getSunDir,
    radius,
    atmosphereRadius,
    options,
  };

  configurePlanetCloudBuilder(layer);
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
  setPlanetCloudLoadingMessage(
    loadingMessage,
    mergedOptions.auroraMode ? 'Compiling aurora and baking textures…' : 'Compiling clouds and baking textures…',
  );
  await nextVisualPaint();
  try {
    let stage = startupTiming.start('full-cloud-pipeline-background-warmup', undefined, 'pipeline');
    const fullCloudPipelineStage = stage;
    let pipelineWarmupMs = null;
    const pipelineWarmupPromise = prewarmPlanetCloudPipeline(layer).then((elapsedMs) => {
      pipelineWarmupMs = elapsedMs;
      layer.pipelineWarmupMs = elapsedMs;
      startupTiming.end(fullCloudPipelineStage, { pipelineWarmupMs: elapsedMs });
      publishStartupTiming(startupTiming.snapshot(), false);
      return elapsedMs;
    });
    stage = startupTiming.start('noise-pipeline-warmup', undefined, 'pipeline');
    const noisePipelineStage = stage;
    const noisePipelineWarmupPromise = prewarmPlanetNoisePipelines(layer);
    stage = startupTiming.start('bootstrap-cloud-pipeline-warmup', undefined, 'pipeline');
    const bootstrapPipelineStage = stage;
    const bootstrapPipelineWarmupPromise = prewarmPlanetBootstrapPipeline(layer);
    const [noisePipelineWarmupMs, bootstrapPipelineWarmupMs] = await Promise.all([
      noisePipelineWarmupPromise,
      bootstrapPipelineWarmupPromise,
    ]);
    startupTiming.end(noisePipelineStage, { noisePipelineWarmupMs });
    startupTiming.end(bootstrapPipelineStage, { bootstrapPipelineWarmupMs });
    layer.bootstrapPipelineWarmupMs = bootstrapPipelineWarmupMs;
    setPlanetCloudLoadingMessage(
      loadingMessage,
      mergedOptions.auroraMode ? 'Baking quick aurora preview…' : 'Baking quick cloud preview…',
    );

    if (mergedOptions.progressiveStartup !== false) {
      const bootstrapOptions = {
        weatherWidth: Math.max(16, Math.min(mergedOptions.weatherWidth, Math.floor(mergedOptions.bootstrapWeatherWidth || 128))),
        weatherHeight: Math.max(8, Math.min(mergedOptions.weatherHeight, Math.floor(mergedOptions.bootstrapWeatherHeight || 64))),
        shapeSize: Math.max(16, Math.min(mergedOptions.shapeSize, Math.floor(mergedOptions.bootstrapShapeSize || 32))),
        detailSize: Math.max(8, Math.min(mergedOptions.detailSize, Math.floor(mergedOptions.bootstrapDetailSize || 16))),
        blueWidth: Math.max(16, Math.min(mergedOptions.blueWidth, Math.floor(mergedOptions.bootstrapBlueSize || 64))),
        blueHeight: Math.max(16, Math.min(mergedOptions.blueHeight, Math.floor(mergedOptions.bootstrapBlueSize || 64))),
        resourceNonce: `${mergedOptions.resourceNonce}-bootstrap`,
      };
      await bakePlanetCloudResources(layer, {
        quality: 'bootstrap',
        options: bootstrapOptions,
        timingReport: startupTiming,
        waitForGpu: true,
        onTiming: (snapshot) => publishStartupTiming(snapshot, false),
      });
      layer.bootstrapResourceKeys = { ...(layer.resourceKeys || {}) };

      const originalOptions = layer.options;
      layer.options = mergePlain(originalOptions, {
        renderScaleDivider: Math.max(
          Math.floor(originalOptions.renderScaleDivider || 1),
          Math.floor(originalOptions.bootstrapRenderScaleDivider || 8),
        ),
        adaptiveScreenQuality: false,
        dynamicCoarseQuality: false,
      });
      setPlanetCloudLoadingMessage(loadingMessage, 'Rendering first cloud frame…');
      stage = startupTiming.start('bootstrap-frame-buffer-dispatch-and-present', {
        renderScaleDivider: layer.options.renderScaleDivider,
      }, 'first-frame');
      publishStartupTiming(startupTiming.snapshot(), false);
      try {
        layer.useBootstrapPreview = true;
        await updatePlanetCloudLayer(layer);
        let gpuWaitMs = 0;
        if (typeof queue.onSubmittedWorkDone === 'function') {
          startupTiming.mark('bootstrap-frame-gpu-wait-start');
          publishStartupTiming(startupTiming.snapshot(), false);
          const waitStarted = performance.now();
          await queue.onSubmittedWorkDone();
          gpuWaitMs = performance.now() - waitStarted;
        }
        startupTiming.end(stage, { gpuWaitMs });
      } finally {
        layer.useBootstrapPreview = false;
        layer.options = originalOptions;
      }
      startupTiming.mark('first-frame-visible');
      layer.timings = {
        ...(layer.timings || {}),
        pipelineWarmupMs,
        bootstrapPipelineWarmupMs,
        noisePipelineWarmupMs,
        timeToFirstFrameMs: startupTiming.snapshot().totalMs,
      };
      publishStartupTiming(startupTiming.snapshot(), false);
      setPlanetCloudLoadingMessage(loadingMessage, 'Clouds visible — refining detail…');
      await nextVisualPaint();

      layer.refining = true;
      layer.refinementPromise = new Promise((resolve) => setTimeout(resolve, 0))
        .then(async () => {
          if (layer.disposed) {
            layer.refining = false;
            startupTiming.mark('refinement-cancelled');
            publishStartupTiming(startupTiming.finish({ cancelled: true }), true);
            return layer;
          }
          const fullBakePromise = bakePlanetCloudResources(layer, {
            quality: 'full',
            timingReport: startupTiming,
            waitForGpu: true,
            onTiming: (snapshot) => publishStartupTiming(snapshot, false),
          });
          await Promise.all([pipelineWarmupPromise, fullBakePromise]);
          if (layer.disposed) {
            if (layer.sharedNoiseBuilder && layer.resourceKeys) {
              try { nb.destroyTexturePair?.(layer.resourceKeys.weather); } catch {}
              try { nb.destroyTexturePair?.(layer.resourceKeys.blue); } catch {}
              try { nb.destroyVolume?.(layer.resourceKeys.shape); } catch {}
              try { nb.destroyVolume?.(layer.resourceKeys.detail); } catch {}
              PLANET_VOLUME_MIPS.get(nb)?.release(layer.resourceKeys.shape);
              PLANET_STYLE_NOISE.get(nb)?.release(layer.resourceKeys.shape);
              PLANET_VOLUME_MIPS.get(nb)?.release(layer.resourceKeys.detail);
            }
            layer.refining = false;
            startupTiming.mark('refinement-cancelled');
            publishStartupTiming(startupTiming.finish({ cancelled: true }), true);
            return layer;
          }
          layer.refining = false;
          stage = startupTiming.start('refined-frame-buffer-dispatch-and-present', {
            renderScaleDivider: layer.options.renderScaleDivider,
          }, 'refined-frame');
          publishStartupTiming(startupTiming.snapshot(), false);
          await updatePlanetCloudLayer(layer);
          let gpuWaitMs = 0;
          if (typeof queue.onSubmittedWorkDone === 'function') {
            startupTiming.mark('refined-frame-gpu-wait-start');
            publishStartupTiming(startupTiming.snapshot(), false);
            const waitStarted = performance.now();
            await queue.onSubmittedWorkDone();
            gpuWaitMs = performance.now() - waitStarted;
          }
          startupTiming.end(stage, { gpuWaitMs });
          startupTiming.mark('full-quality-frame-visible');

          const bootstrapKeys = layer.bootstrapResourceKeys;
          if (layer.sharedNoiseBuilder && bootstrapKeys) {
            try { nb.destroyTexturePair?.(bootstrapKeys.weather); } catch {}
            try { nb.destroyTexturePair?.(bootstrapKeys.blue); } catch {}
            try { nb.destroyVolume?.(bootstrapKeys.shape); } catch {}
            try { nb.destroyVolume?.(bootstrapKeys.detail); } catch {}
            PLANET_VOLUME_MIPS.get(nb)?.release(bootstrapKeys.shape);
            PLANET_STYLE_NOISE.get(nb)?.release(bootstrapKeys.shape);
            PLANET_VOLUME_MIPS.get(nb)?.release(bootstrapKeys.detail);
          }
          layer.bootstrapResourceKeys = null;
          const finalTiming = startupTiming.finish({
            timeToFirstFrameMs: startupTiming.milestones.find((mark) => mark.name === 'first-frame-visible')?.atMs ?? null,
          });
          layer.timings = {
            ...(layer.timings || {}),
            pipelineWarmupMs,
            bootstrapPipelineWarmupMs,
            noisePipelineWarmupMs,
            timeToFirstFrameMs: finalTiming.metadata.timeToFirstFrameMs,
            startupTotalMs: finalTiming.totalMs,
          };
          publishStartupTiming(finalTiming, true);
          return layer;
        })
        .catch((error) => {
          layer.refining = false;
          layer.refinementError = error;
          startupTiming.mark('refinement-failed', { error: String(error?.message || error) });
          publishStartupTiming(startupTiming.finish({ failed: true }), true);
          console.warn('Planet cloud full-resolution refinement failed; keeping bootstrap textures', error);
          return layer;
        });
      return layer;
    }

    await pipelineWarmupPromise;
    await bakePlanetCloudResources(layer, {
      quality: 'full',
      timingReport: startupTiming,
      waitForGpu: true,
      onTiming: (snapshot) => publishStartupTiming(snapshot, false),
    });
    layer.timings = {
      ...(layer.timings || {}),
      pipelineWarmupMs,
      bootstrapPipelineWarmupMs,
      noisePipelineWarmupMs,
    };
    setPlanetCloudLoadingMessage(loadingMessage, 'Planet atmosphere ready');
    stage = startupTiming.start('initial-frame-buffer-dispatch-and-present', undefined, 'first-frame');
    await updatePlanetCloudLayer(layer);
    if (typeof queue.onSubmittedWorkDone === 'function') await queue.onSubmittedWorkDone();
    startupTiming.end(stage);
    startupTiming.mark('first-frame-visible');
    publishStartupTiming(startupTiming.finish({
      timeToFirstFrameMs: startupTiming.milestones.find((mark) => mark.name === 'first-frame-visible')?.atMs ?? null,
    }), true);
    await nextVisualPaint();
    return layer;
  } catch (error) {
    startupTiming.mark('startup-failed', { error: String(error?.message || error) });
    publishStartupTiming(startupTiming.finish({ failed: true }), true);
    try { canvas.remove?.(); } catch {}
    throw error;
  } finally {
    try { loadingMessage?.remove?.(); } catch {}
    layer.loadingMessage = null;
    if(startupTiming.milestones.some(mark=>mark.name==='first-frame-visible'))createPlanetCloudStyleControl(layer);
  }
}

export async function bakePlanetCloudResources(layer, bakeOptions = {}) {
  const started = performance.now();
  const nb = layer.noiseBuilder;
  const opt = bakeOptions.options
    ? mergePlain(layer.options, bakeOptions.options)
    : layer.options;
  const seed = layer.seed;
  const quality = bakeOptions.quality || 'full';
  const timingReport = bakeOptions.timingReport || null;
  const waitForGpu = !!bakeOptions.waitForGpu;
  const publishTiming = () => {
    if (!timingReport || typeof bakeOptions.onTiming !== 'function') return;
    try { bakeOptions.onTiming(timingReport.snapshot()); } catch {}
  };

  const finishStage = async (stage, detail = {}) => {
    let gpuWaitMs = 0;
    if (waitForGpu && typeof layer.queue?.onSubmittedWorkDone === 'function') {
      const waitStarted = performance.now();
      await layer.queue.onSubmittedWorkDone();
      gpuWaitMs = performance.now() - waitStarted;
    }
    timingReport?.end(stage, { ...detail, gpuWaitMs });
    publishTiming();
    return gpuWaitMs;
  };

  try {
    nb?.buildPermTable?.(seed);
  } catch {}

  const resourceKeys = {
    weather: cloudResourceKey(opt, 'weather', seed),
    shape: cloudResourceKey(opt, 'shape', seed),
    detail: cloudResourceKey(opt, 'detail', seed),
    blue: cloudResourceKey(opt, 'blue', seed),
  };

  try {
  const weatherStarted = performance.now();
  let stage = timingReport?.start(`${quality}-weather-buffer-and-dispatch`, {
    size: [opt.weatherWidth, opt.weatherHeight],
  }, 'gpu-submit');
  publishTiming();
  const styled = !opt.auroraMode && opt.cloudStyle && opt.cloudStyle !== 'legacy';
  const styledMaps = styled ? await planetStyleNoise(nb).bake({key:resourceKeys.shape,seed,
    shapeSize:opt.shapeSize || DEFAULT_SHAPE_SIZE,weatherWidth:opt.weatherWidth || DEFAULT_WEATHER_WIDTH,
    weatherHeight:opt.weatherHeight || DEFAULT_WEATHER_HEIGHT,weatherStyle:opt.cloudStyle}) : null;
  const weatherView = styledMaps?.weatherView || await bakeSphericalWeather(nb, {
    ...opt,
    seed,
    textureKey: resourceKeys.weather,
  });
  const weatherGpuWaitMs = await finishStage(stage, { resourceKey: resourceKeys.weather });

  const shapeStarted = performance.now();
  stage = timingReport?.start(`${quality}-shape-buffer-and-dispatch`, {
    size: opt.shapeSize,
  }, 'gpu-submit');
  publishTiming();
  const shape3DView = styledMaps ? await planetVolumeMips(nb).bake(styledMaps.shapeView,opt.shapeSize || DEFAULT_SHAPE_SIZE,resourceKeys.shape) : await bakeShapeVolume(nb, {
    ...opt,
    seed,
    textureId: resourceKeys.shape,
  });
  const shapeGpuWaitMs = await finishStage(stage, { resourceKey: resourceKeys.shape });

  const detailStarted = performance.now();
  stage = timingReport?.start(`${quality}-detail-buffer-and-dispatch`, {
    size: opt.detailSize,
  }, 'gpu-submit');
  publishTiming();
  const detail3DView = await bakeDetailVolume(nb, {
    ...opt,
    seed,
    textureId: resourceKeys.detail,
  });
  const detailGpuWaitMs = await finishStage(stage, { resourceKey: resourceKeys.detail });

  const blueStarted = performance.now();
  stage = timingReport?.start(`${quality}-blue-buffer-and-dispatch`, {
    size: [opt.blueWidth, opt.blueHeight],
  }, 'gpu-submit');
  publishTiming();
  const blueView = await bakeBlueNoise(nb, {
    ...opt,
    seed,
    textureKey: resourceKeys.blue,
  });
  const blueGpuWaitMs = await finishStage(stage, { resourceKey: resourceKeys.blue });

  layer.resourceKeys = resourceKeys;
  layer.textures = { weatherView, shape3DView, detail3DView, blueView };
  layer.timings = {
    quality,
    weatherMs: shapeStarted - weatherStarted,
    shapeMs: detailStarted - shapeStarted,
    detailMs: blueStarted - detailStarted,
    blueMs: performance.now() - blueStarted,
    weatherGpuWaitMs,
    shapeGpuWaitMs,
    detailGpuWaitMs,
    blueGpuWaitMs,
    totalMs: performance.now() - started,
  };

  stage = timingReport?.start(`${quality}-bind-cloud-input-textures`, undefined, 'buffering');
  publishTiming();
  layer.cloudBuilder.setInputMaps({ weatherView, shape3DView, detail3DView, blueView });
  timingReport?.end(stage, { resourceKeys });
  publishTiming();
  layer.configSummary.resourceKeys = resourceKeys;
  layer.configSummary.resourceNonce = opt.resourceNonce;
  return layer.textures;
  } catch (error) {
    // Initial setup can fail before resourceKeys are published on the layer.
    // Release partial allocations as well as failed style transactions.
    PLANET_STYLE_NOISE.get(nb)?.release(resourceKeys.shape);
    for (const key of [resourceKeys.weather,resourceKeys.blue]) nb.destroyTexturePair?.(key);
    for (const key of [resourceKeys.shape,resourceKeys.detail]) {
      nb.destroyVolume?.(key);PLANET_VOLUME_MIPS.get(nb)?.release(key);
    }
    throw error;
  }
}

export function configurePlanetCloudBuilder(layer) {
  const opt = layer.options;
  const cb = layer.cloudBuilder;
  cb.setOptions({ sphericalMode: true, planetStyleMode:!opt.auroraMode && !!opt.cloudStyle && opt.cloudStyle!=='legacy', writeRGB: true, outputChannel: 0, r1: 0.0 });
  cb.setParams(opt.params || PLANET_CLOUD_FLAT_LAB_PRESET.params);
  cb.setNoiseTransforms(opt.transforms || PLANET_CLOUD_FLAT_LAB_PRESET.transforms);
  cb.setTuning(resolvePlanetCloudTuning(opt));
  cb.setPerfParams?.(opt.performance || opt.perf || { lodBiasMul: 1.0, coarseMipBias: 0.0 });
  cb.setReprojSettings?.(opt.reprojection || { enabled: 1, temporalCellRate: 4, temporalBlend: 0.94, compactInterleave: 1 });
}


export function randomizePlanetAuroraGradient(layer, options = {}) {
  if (!layer || layer.disposed) return null;
  const baseOptions = layer.options || {};
  if (!baseOptions.auroraMode && options.auroraMode !== true) return null;
  const auroraGradientSeed = Math.floor(options.auroraGradientSeed ?? options.seed ?? Date.now()) >>> 0;
  const merged = mergePlain(baseOptions, options || {});
  const params = resolveRandomizedAuroraParams(
    PLANET_AURORA_FAST_PRESET.params,
    auroraGradientSeed,
    merged,
  );
  return updatePlanetCloudLayerOptions(layer, {
    ...options,
    auroraGradientSeed,
    auroraRandomizeGradient: true,
    params,
  });
}

export function getPlanetAuroraGradient(layer) {
  if (!layer?.options?.auroraMode) return null;
  const params = layer.options.params || {};
  return {
    auroraGradientSeed: Math.floor(layer.options.auroraGradientSeed ?? 0) >>> 0,
    sunColor: clampColorArray(params.sunColor || PLANET_AURORA_FAST_PRESET.params.sunColor, 0.0, 2.5),
    frontLightColor: clampColorArray(params.frontLightColor || PLANET_AURORA_FAST_PRESET.params.frontLightColor, 0.0, 2.5),
    shadowLightColor: clampColorArray(params.shadowLightColor || PLANET_AURORA_FAST_PRESET.params.shadowLightColor, 0.0, 2.5),
  };
}

export function updatePlanetCloudLayerOptions(layer, options = {}, { resetHistory = false } = {}) {
  if (layer?.kind === 'planet-cloud-render-toggle') {
    if (!layer || layer.disposed) return null;
    const { cloudRenderMode: ignoredMode, ...sharedOptions } = options || {};
    layer.options = mergePlain(layer.options || {}, sharedOptions);
    for (const [mode, renderer] of layer.renderers.entries()) {
      updatePlanetCloudLayerOptions(renderer, {
        ...sharedOptions,
        cloudRenderMode: mode,
      }, { resetHistory });
    }
    return layer.options;
  }
  if (layer?.kind === 'mc33-shell') {
    return updatePlanetCloudSurfaceOptions(layer, options);
  }
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
  if (layer?.kind === 'planet-cloud-render-toggle') {
    if (!layer || layer.disposed || !layer.activeLayer) return;
    return updatePlanetCloudLayer(layer.activeLayer);
  }
  if (layer?.kind === 'mc33-shell') {
    return updatePlanetCloudSurfaceLayer(layer);
  }
  if (!layer || layer.disposed || layer.options.enabled === false) return;
  // Keep the confirmed bootstrap image on screen while full-size noise is being
  // generated. This also prevents animation frames from filling the queue ahead
  // of the one-time refinement work.
  if (layer.refining || layer.styleChanging) return;
  const opt = layer.options;
  const { width, height } = resizeOverlayCanvas(layer.canvas, layer.sourceCanvas, opt);
  const camera = layer.getCameraState?.() || makeDefaultCameraState();
  const camPos = normalizeVecArray(camera.camPos, [0, 0, layer.radius * 4]);
  const fwd = normalize(normalizeVecArray(camera.fwd, [0, 0, -1]), [0, 0, -1]);
  const right = normalize(normalizeVecArray(camera.right, [1, 0, 0]), [1, 0, 0]);
  const up = normalize(normalizeVecArray(camera.up, [0, 1, 0]), [0, 1, 0]);
  const aspect = finiteNumber(camera.aspect, width / Math.max(height, 1));
  const fovYDeg = finiteNumber(camera.fovYDeg, 60);
  const defaultCloudBottom = Math.max(0.75, (layer.atmosphereRadius - layer.radius) * 0.09);
  const cloudBottom = finiteNumber(opt.cloudBottom, defaultCloudBottom);
  const cloudTop = finiteNumber(opt.cloudTop, Math.max(cloudBottom + 2.15, (layer.atmosphereRadius - layer.radius) * 0.24));
  const outer = layer.radius + cloudTop + Math.max(2.0, Math.abs(PLANET_CLOUD_FLAT_LAB_PRESET.tuning.anvilLift || 0));
  const screenMetrics = estimatePlanetScreenCoverage({ camPos, fovYDeg, aspect }, outer);
  const divider = resolveAdaptiveRenderDivider(layer, width, height, screenMetrics);
  const outW = Math.max(1, Math.ceil(width / divider));
  const outH = Math.max(1, Math.ceil(height / divider));
  if (outW !== layer.lastOutputWidth || outH !== layer.lastOutputHeight) {
    layer.cloudBuilder.createOutputTexture(outW, outH, 1, opt.textures?.outputFormat || opt.outputFormat || 'rgba16float');
    layer.lastOutputWidth = outW;
    layer.lastOutputHeight = outH;
    layer.contextConfigured = false;
    layer.overlayBindGroup = null;
    layer.overlayBindGroupView = null;
    destroyCloudHistory(layer);
  }

  const frameStride = Math.max(1, Math.floor(opt.updateEvery ?? 1));
  layer.frame += 1;
  if ((layer.frame % frameStride) !== 0 && layer.cloudBuilder.outView) {
    renderOverlay(layer);
    return;
  }

  const cameraHistoryState = { camPos, fwd, right, up, fovYDeg, aspect };
  const cameraIsMoving = cameraMovedForHistory(layer.lastCameraHistoryState, cameraHistoryState, layer.radius, opt);
  if (layer.wasCameraMoving && !cameraIsMoving && wantsCloudHistory(layer)) {
    layer.historyWarmupFrames = Math.max(1, layer.historyWarmupFrames | 0);
  }
  layer.wasCameraMoving = cameraIsMoving;
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
  const auroraCap = opt.auroraCap || {};
  const auroraHemisphere = String(auroraCap.hemisphere || 'north').toLowerCase() === 'south' ? -1.0 : 1.0;
  const auroraEnabled = !!opt.auroraMode;

  const styledMotion = !auroraEnabled && opt.cloudStyle && opt.cloudStyle !== 'legacy';
  if (opt.animate !== false || styledMotion) {
    const configuredSpin = finiteNumber(opt.spinSpeed, Array.isArray(vel.weather) ? finiteNumber(vel.weather[0], 0.14) : 0.14);
    const meridionalDrift = finiteNumber(opt.meridionalDrift, Array.isArray(vel.weather) ? finiteNumber(vel.weather[2], 0.0) : 0.0);

    if (auroraEnabled) {
      const shellSpinSpeed = finiteNumber(opt.auroraSpinSpeed, 0.0024);
      const shellRollSpeed = finiteNumber(opt.auroraRollSpeed, 0.0065);
      const shapeFlow = [
        finiteNumber(opt.auroraShapeFlowSpeed, 0.0032),
        0.0,
        finiteNumber(opt.auroraShapeRollSpeed, 0.0014),
      ];
      const detailFlow = [
        finiteNumber(opt.auroraDetailFlowSpeed, -0.0054),
        0.0,
        finiteNumber(opt.auroraDetailRollSpeed, -0.0028),
      ];
      transforms.weatherOffsetWorld = addScaled(
        addScaled(baseTransforms.weatherOffsetWorld || [0, 0, 0], [shellSpinSpeed, 0.0, shellRollSpeed], t),
        vel.weather || [0, 0, 0],
        t,
      );
      transforms.shapeOffsetWorld = addScaled(
        addScaled(baseTransforms.shapeOffsetWorld || [0, 0, 0], shapeFlow, t),
        vel.shape || [0, 0, 0],
        t,
      );
      transforms.detailOffsetWorld = addScaled(
        addScaled(baseTransforms.detailOffsetWorld || [0, 0, 0], detailFlow, t),
        vel.detail || [0, 0, 0],
        t,
      );
    } else if (opt.cloudStyle && opt.cloudStyle !== 'legacy') {
      // Styled clouds share one slow wind and evolve locally, not by rotating
      // their shape/detail fields at different (often additive) angular speeds.
      const motion = planetCloudMotion(opt, advancePlanetCloudTime(layer, t));
      transforms.weatherOffsetWorld = addScaled(baseTransforms.weatherOffsetWorld || [0, 0, 0], motion.weatherOffsetWorld, 1);
      transforms.shapeOffsetWorld = addScaled(baseTransforms.shapeOffsetWorld || [0, 0, 0], motion.shapeOffsetWorld, 1);
      transforms.detailOffsetWorld = addScaled(baseTransforms.detailOffsetWorld || [0, 0, 0], motion.detailOffsetWorld, 1);
    } else {
      const spinSpeed = configuredSpin;
      const shapeSpinFactor = finiteNumber(opt.shapeSpinFactor, 0.68);
      const detailSpinFactor = finiteNumber(opt.detailSpinFactor, 1.27);
      const shapeDrift = [spinSpeed * shapeSpinFactor, 0.0, meridionalDrift * shapeSpinFactor + finiteNumber(opt.shapeMeridionalDrift, 0.0025)];
      const detailDrift = [spinSpeed * detailSpinFactor, 0.0, meridionalDrift * detailSpinFactor + finiteNumber(opt.detailMeridionalDrift, -0.004)];
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
      transforms.weatherOffsetWorld = addScaled(
        addScaled(
          baseTransforms.weatherOffsetWorld || [0, 0, 0],
          [spinSpeed, 0.0, meridionalDrift + finiteNumber(opt.weatherMeridionalDrift, 0.0008)],
          t,
        ),
        vel.weather || [0, 0, 0],
        t,
      );
    }
  }

  const cameraAltitude = Math.max(0, Math.hypot(camPos[0], camPos[1], camPos[2]) - layer.radius);
  const nearQualityFull = finiteNumber(opt.nearSurfaceQualityFull, Math.max(0.1, cloudBottom * 0.65));
  const nearQualityStart = finiteNumber(opt.nearSurfaceQualityStart, Math.max(cloudTop * 2.25, nearQualityFull + 1.0));
  const nearSurfaceFactor = opt.nearSurfaceAdaptiveQuality === false
    ? 0
    : 1.0 - smoothstepLocal(nearQualityFull, nearQualityStart, cameraAltitude);
  layer.nearSurfaceFactor = nearSurfaceFactor;
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
  const baseTuning = resolvePlanetCloudTuning(opt);
  let runtimeTuning = baseTuning;
  if (nearSurfaceFactor > 0) {
    const baseMaxSteps = finiteNumber(baseTuning.maxSteps, 196);
    const baseSunSteps = finiteNumber(baseTuning.sunSteps, 5);
    const baseSunStride = finiteNumber(baseTuning.sunStride, 4);
    const baseNearStepScale = finiteNumber(baseTuning.nearStepScale, 0.30);
    const baseNearLodBias = finiteNumber(baseTuning.nearLodBias, -1.5);
    runtimeTuning = {
      ...baseTuning,
      maxSteps: Math.round(mixNumber(baseMaxSteps, finiteNumber(opt.nearSurfaceMaxSteps, 96), nearSurfaceFactor)),
      sunSteps: Math.round(mixNumber(baseSunSteps, finiteNumber(opt.nearSurfaceSunSteps, 2), nearSurfaceFactor)),
      sunStride: Math.round(mixNumber(baseSunStride, Math.max(baseSunStride, finiteNumber(opt.nearSurfaceSunStride, 8)), nearSurfaceFactor)),
      nearStepScale: mixNumber(baseNearStepScale, Math.max(baseNearStepScale, finiteNumber(opt.nearSurfaceNearStepScale, 0.78)), nearSurfaceFactor),
      nearLodBias: mixNumber(baseNearLodBias, Math.max(baseNearLodBias, finiteNumber(opt.nearSurfaceLodBias, 0.10)), nearSurfaceFactor),
    };
  }
  runtimeTuning = resolveScreenPerformanceTuning(runtimeTuning, opt, screenMetrics, cameraIsMoving);
  const bootstrapFrames = Math.max(0, Math.floor(finiteNumber(opt.bootstrapFrames, 2)));
  const bootstrapActive = layer.frame <= bootstrapFrames;
  if (bootstrapActive) {
    runtimeTuning = {
      ...runtimeTuning,
      maxSteps: Math.min(
        finiteNumber(runtimeTuning.maxSteps, 196),
        Math.max(24, Math.floor(finiteNumber(opt.bootstrapMaxSteps, 64))),
      ),
      sunSteps: Math.min(
        finiteNumber(runtimeTuning.sunSteps, 5),
        Math.max(1, Math.floor(finiteNumber(opt.bootstrapSunSteps, 1))),
      ),
      sunStride: Math.max(
        finiteNumber(runtimeTuning.sunStride, 4),
        Math.max(1, Math.floor(finiteNumber(opt.bootstrapSunStride, 10))),
      ),
    };
  }
  layer.cloudBuilder.setTuning(runtimeTuning);
  layer.cloudBuilder.setBox({
    center: [0, 0, 0],
    half: [outer, shellHalf, outer],
    uvScale: 1.0,
  });
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

  const baseCoarseFactor = Math.max(1, Math.floor(opt.performance?.coarseFactor ?? opt.coarseFactor ?? 1));
  const nearSurfaceCoarseFactor = Math.max(1, Math.floor(
    opt.performance?.nearSurfaceCoarseFactor ?? opt.nearSurfaceCoarseFactor ?? 3,
  ));
  const nearSurfaceActive = nearSurfaceFactor > 0.15;
  const adaptiveCoarseFactor = nearSurfaceActive ? nearSurfaceCoarseFactor : 1;
  const movingFullscreenCoarseFactor = cameraIsMoving && screenMetrics.pressure > 0.30
    ? Math.max(1, Math.floor(
      opt.performance?.movingFullscreenCoarseFactor ?? opt.movingFullscreenCoarseFactor ?? 2,
    ))
    : 1;
  const coarseFactor = Math.max(baseCoarseFactor, adaptiveCoarseFactor, movingFullscreenCoarseFactor);
  ensureCloudHistory(layer, outW, outH, coarseFactor);

  // Allocating a new history (including a coarse/full-size transition) must
  // happen before this warmup decision. Seed it with one fresh complete frame.
  const reprojBase = opt.reprojection || {};
  const auroraAnimating = auroraEnabled && opt.animate !== false;
  const historyWarmupActive = (layer.historyWarmupFrames | 0) > 0;
  const velocityMagnitude = [vel.shape, vel.detail, vel.weather]
    .filter(Array.isArray)
    .reduce((sum, v) => sum + Math.abs(finiteNumber(v[0], 0)) + Math.abs(finiteNumber(v[1], 0)) + Math.abs(finiteNumber(v[2], 0)), 0);
  const configuredSpinMagnitude = Math.abs(finiteNumber(
    auroraEnabled ? opt.auroraSpinSpeed : opt.spinSpeed,
    auroraEnabled ? 0.0024 : 0.14,
  ));
  const auroraRollMagnitude = auroraEnabled ? Math.abs(finiteNumber(opt.auroraRollSpeed, 0.0065)) : 0.0;
  const cloudAnimating = opt.animate !== false && (
    configuredSpinMagnitude > 0.000001 || auroraRollMagnitude > 0.000001 || velocityMagnitude > 0.000001
  );
  const baseTemporalCellRate = normalizeTemporalRateLocal(reprojBase.temporalCellRate ?? 4);
  const animatedTemporalCellRate = normalizeTemporalRateLocal(
    opt.animatedTemporalCellRate ?? Math.min(baseTemporalCellRate, 2),
  );
  const temporalCellRate = cameraIsMoving || auroraAnimating || historyWarmupActive
    ? 1
    : (cloudAnimating ? animatedTemporalCellRate : baseTemporalCellRate);
  const frameIndex = Math.max(0, (layer.frame | 0) - 1);
  const temporalBlendRaw = cameraIsMoving
    ? Math.max(0.0, Math.min(finiteNumber(opt.movingTemporalBlend, 0.0), finiteNumber(reprojBase.temporalBlend, 0.94)))
    : (reprojBase.temporalBlend ?? 0.94);
  const animatedTemporalBlend = cloudAnimating
    ? Math.min(finiteNumber(temporalBlendRaw, 0.94), finiteNumber(opt.animatedTemporalBlend, 0.82))
    : temporalBlendRaw;
  const temporalBlendResolved = auroraAnimating
    ? Math.min(finiteNumber(animatedTemporalBlend, 0.82), finiteNumber(opt.auroraTemporalBlend ?? opt.maxAuroraTemporalBlend, 0.58))
    : animatedTemporalBlend;
  const temporalBlend = historyWarmupActive ? 0 : temporalBlendResolved;
  layer.cloudBuilder.setReprojSettings?.({
    ...reprojBase,
    enabled: cameraIsMoving ? 0 : (reprojBase.enabled ?? 1),
    temporalBlend,
    temporalCellRate,
    temporalCellPhase: temporalCellRate > 1 ? frameIndex % temporalCellRate : 0,
    compactInterleave: cameraIsMoving || auroraAnimating ? 0 : (reprojBase.compactInterleave ?? (temporalCellRate > 1 ? 1 : 0)),
    frameIndex,
    fullWidth: Math.max(1, Math.ceil(outW / coarseFactor)),
    fullHeight: Math.max(1, Math.ceil(outH / coarseFactor)),
  });
  layer.performanceStats = {
    canvasWidth: width,
    canvasHeight: height,
    outputWidth: outW,
    outputHeight: outH,
    raymarchPixels: outW * outH,
    renderScaleDivider: divider,
    screenCoverage: screenMetrics.coverage,
    screenPressure: screenMetrics.pressure,
    projectedRadiusNdcX: screenMetrics.radiusNdcX,
    projectedRadiusNdcY: screenMetrics.radiusNdcY,
    cameraIsMoving,
    cloudAnimating,
    bootstrapActive,
    maxSteps: runtimeTuning.maxSteps,
    sunSteps: runtimeTuning.sunSteps,
    sunStride: runtimeTuning.sunStride,
    temporalCellRate,
    temporalBlend,
    coarseFactor,
    historyWidth: layer.history?.width || 0,
    historyHeight: layer.history?.height || 0,
    historyWarmupActive,
  };
  if (layer.useBootstrapPreview && typeof layer.cloudBuilder.dispatchBootstrapPreview === 'function') {
    await layer.cloudBuilder.dispatchBootstrapPreview({ wait: false });
    layer.performanceStats.bootstrapPreviewPipeline = true;
  } else {
    await layer.cloudBuilder.dispatch({ wait: false, coarseFactor });
    swapCloudHistory(layer);
    if (historyWarmupActive) {
      layer.historyWarmupFrames = Math.max(0, (layer.historyWarmupFrames | 0) - 1);
    }
  }
  renderOverlay(layer);
}

function normalizeVecArray(v, fallback) {
  if (Array.isArray(v)) {
    return [finiteNumber(v[0], fallback[0]), finiteNumber(v[1], fallback[1]), finiteNumber(v[2], fallback[2])];
  }
  return v3FromBabylon(v, fallback);
}

export function getPlanetCloudPerformanceStats(layer) {
  if (layer?.kind === 'planet-cloud-render-toggle') {
    const activeStats = getPlanetCloudPerformanceStats(layer.activeLayer) || {};
    const cachedModeStats = {};
    for (const [mode, renderer] of layer.renderers.entries()) {
      const rendererStats = getPlanetCloudPerformanceStats(renderer);
      if (rendererStats) cachedModeStats[mode] = rendererStats;
    }
    return {
      ...activeStats,
      mode: layer.activeMode,
      activeMode: layer.activeMode,
      cachedModes: Array.from(layer.renderers.keys()),
      cachedModeStats,
      alternateReady: layer.renderers.has(layer.activeMode === 'mc33-shell' ? 'raymarch' : 'mc33-shell'),
      toggleable: true,
    };
  }
  return layer?.performanceStats ? {
    ...layer.performanceStats,
    refining: !!layer.refining,
    startupComplete: !!layer.startupTiming?.complete,
    timeToFirstFrameMs: layer.startupTiming?.metadata?.timeToFirstFrameMs
      ?? layer.timings?.timeToFirstFrameMs
      ?? null,
    startupTotalMs: layer.startupTiming?.complete ? layer.startupTiming.totalMs : null,
  } : null;
}

export function disposePlanetCloudLayer(layer) {
  if (layer?.kind === 'planet-cloud-render-toggle') {
    if (!layer || layer.disposed) return;
    layer.disposed = true;
    try { layer.toggleButton?.remove?.(); } catch {}
    try { layer.styleControl?.remove?.(); } catch {}
    const renderers = Array.from(new Set(layer.renderers.values()));
    layer.renderers.clear();
    for (const renderer of renderers) {
      renderer._planetCloudTogglePeer = null;
      disposePlanetCloudLayer(renderer);
    }
    layer.activeLayer = null;
    return;
  }
  if (layer?._planetCloudTogglePeer && !layer._planetCloudPeerDisposing) {
    const peer = layer._planetCloudTogglePeer;
    layer._planetCloudTogglePeer = null;
    if (peer && !peer.disposed) {
      peer._planetCloudTogglePeer = null;
      peer._planetCloudPeerDisposing = true;
      disposePlanetCloudLayer(peer);
    }
  }
  if (layer?.kind === 'mc33-shell') {
    disposePlanetCloudSurfaceLayer(layer);
    return;
  }
  if (!layer || layer.disposed) return;
  layer.disposed = true;
  try { layer.styleControl?.remove?.(); } catch {}
  try { layer.loadingMessage?.remove?.(); } catch {}
  try { layer.canvas?.remove?.(); } catch {}
  try { layer.overlayParams?.destroy?.(); } catch {}
  destroyCloudHistory(layer);
  try { layer.cloudBuilder?.outTexture?.destroy?.(); } catch {}
  if (layer.sharedNoiseBuilder && layer.resourceKeys) {
    try { layer.noiseBuilder?.destroyTexturePair?.(layer.resourceKeys.weather); } catch {}
    try { layer.noiseBuilder?.destroyTexturePair?.(layer.resourceKeys.blue); } catch {}
    try { layer.noiseBuilder?.destroyVolume?.(layer.resourceKeys.shape); } catch {}
    try { layer.noiseBuilder?.destroyVolume?.(layer.resourceKeys.detail); } catch {}
    PLANET_VOLUME_MIPS.get(layer.noiseBuilder)?.release(layer.resourceKeys.shape);
    PLANET_STYLE_NOISE.get(layer.noiseBuilder)?.release(layer.resourceKeys.shape);
    PLANET_VOLUME_MIPS.get(layer.noiseBuilder)?.release(layer.resourceKeys.detail);
    const bootstrapKeys = layer.bootstrapResourceKeys;
    if (bootstrapKeys) {
      try { layer.noiseBuilder?.destroyTexturePair?.(bootstrapKeys.weather); } catch {}
      try { layer.noiseBuilder?.destroyTexturePair?.(bootstrapKeys.blue); } catch {}
      try { layer.noiseBuilder?.destroyVolume?.(bootstrapKeys.shape); } catch {}
      try { layer.noiseBuilder?.destroyVolume?.(bootstrapKeys.detail); } catch {}
      PLANET_VOLUME_MIPS.get(layer.noiseBuilder)?.release(bootstrapKeys.shape);
      PLANET_STYLE_NOISE.get(layer.noiseBuilder)?.release(bootstrapKeys.shape);
      PLANET_VOLUME_MIPS.get(layer.noiseBuilder)?.release(bootstrapKeys.detail);
    }
  } else if (layer.ownsNoiseBuilder) {
    PLANET_VOLUME_MIPS.get(layer.noiseBuilder)?.destroy();
    PLANET_STYLE_NOISE.get(layer.noiseBuilder)?.destroy();
    try { layer.noiseBuilder?.destroyAllTexturePairs?.(); } catch {}
  }
}
