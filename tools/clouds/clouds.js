// clouds.js
// CloudComputeBuilder matching updated clouds.wgsl uniform layout (CloudOptions, CloudParams, NoiseTransforms, CloudTuning)

import cloudWGSL from "./shaders/clouds.wgsl";
import baseCommonWGSL from "./shaders/cloudCommon.wgsl";
import aircraftWGSL from "./shaders/cloudAircraft.wgsl";
const commonWGSL = baseCommonWGSL + '\n' + aircraftWGSL;
import layerWGSL from "./shaders/cloudLayer.wgsl";
import resolveWGSL from "./shaders/cloudResolve.wgsl";
import scratchWGSL from "./shaders/cloudScratch.wgsl";
import rayOutputWGSL from "./shaders/cloudRayOutput.wgsl";
import fieldWGSL from "./shaders/cloudFields.wgsl";
import planetWGSL from "./shaders/cloudPlanet.wgsl";
import gasAppearanceWGSL from "./shaders/planetGasAppearance.wgsl";
import gasFlowWGSL from "./shaders/planetGasFlow.wgsl";
import previewWGSL from "./shaders/cloudsRender.wgsl";
import { CLOUD_FIELD_QUALITIES, supportsCloudFieldQuality } from "./cloudFieldQuality.js";
import { intendedCloudShading } from './cloudLookPresets.js';

const CLOUD_GPU_CACHE = new WeakMap();
const INLINE_LAYER_OUTPUT = `fn beginLayerSample(pix: vec2<i32>) {}
fn storeLayerSample(pix: vec2<i32>, color: vec4<f32>, farHistory: f32, historyActive: bool) {
  resolveCloudColor(pix, color, farHistory, historyActive);
}`;

function createTimedCloudModule(device, label, code, timing) {
  const started = performance.now();
  const module = device.createShaderModule({ label, code });
  Object.assign(timing, { sourceBytes: code.length, createMs: performance.now() - started, validationMs: null, status: "created" });
  if (typeof module.getCompilationInfo === "function") {
    const validationStarted = performance.now();
    module.getCompilationInfo().then(info => {
      timing.validationMs = performance.now() - validationStarted;
      const errors = info.messages.filter(message => message.type === "error");
      timing.status = errors.length ? "error" : "validated";
      if (errors.length) timing.error = errors.map(message => message.message).join("\n");
    }).catch(error => {
      timing.validationMs = performance.now() - validationStarted;
      timing.status = "error";
      timing.error = String(error?.message || error);
    });
  }
  return module;
}

function getCloudGpuCache(device) {
  let cache = CLOUD_GPU_CACHE.get(device);
  if (!cache) {
    cache = {
      module: null,
      fieldModule: null,
      moduleTiming: null,
      computeTimings: new Map(),
      flatStagesByFormat: new Map(),
      previewModule: null,
      bgl1: null,
      samplers: null,
      computeByFormat: new Map(),
      previewByFormat: new Map(),
      previewPromises: new Map(),
      bootstrapComputeByFormat: new Map(),
      bootstrapComputePromises: new Map(),
      bootstrapPreviewByFormat: new Map(),
      bootstrapPreviewPromises: new Map(),
      upsampleByFormat: new Map(),
      historyCopy: null,
    };
    CLOUD_GPU_CACHE.set(device, cache);
  }
  return cache;
}

const _has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
const DEG_TO_RAD = Math.PI / 180;
const radDeg = (d) => d * DEG_TO_RAD;
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
function writeVec3Padded(dv, ofs, v) {
  dv.setFloat32(ofs, v[0], true);
  dv.setFloat32(ofs + 4, v[1], true);
  dv.setFloat32(ofs + 8, v[2], true);
  dv.setFloat32(ofs + 12, 0.0, true);
}

const normalizeTemporalRate = (value) => {
  const n = Math.max(1, Number(value) | 0);
  if (n >= 64) return 64;
  if (n >= 32) return 32;
  if (n >= 16) return 16;
  if (n >= 8) return 8;
  if (n >= 4) return 4;
  if (n >= 2) return 2;
  return 1;
};

export class CloudComputeBuilder {
  constructor(device, queue) {
    this.device = device;
    this.queue = queue;

    // ---- external resources (setInputMaps) ----
    this.weatherView = null;
    this.shape3DView = null;
    this.detail3DView = null;
    this.blueTex = null;
    this.blueView = null;
    this.motionView = null;
    this.depthPrevView = null;
    this.historyPrevView = null;
    this.historyOutView = null;
    this._retiredTextures = [];
    this._retireFlushPromise = null;

    // ---- outputs / sizes ----
    this.outTexture = null;
    this.outView = null;
    this.outFormat = "rgba16float";
    this.width = 0;
    this.height = 0;
    this.layers = 0;

    // coarse
    this._coarseTexture = null;
    this._coarseView = null;
    this._coarseW = 0;
    this._coarseH = 0;
    this._coarseLayers = 0;
    this._coarseFormat = this.outFormat;

    // workgroups
    this._wgX = 1;
    this._wgY = 1;

    // GPU objects filled in _init*
    this.module = null;
    this.pipeline = null;
    this._computePipelineKey = -1;
    this._computePipelineLayout = null;
    this._computePipelines = new Map();
    this._computePipelinePromises = new Map();
    this._historyCopy = null;
    this._historyCopyBgCache = new Map();
    this._historyCopyBgKeys = [];
    this.bgl0 = null;
    this.bgl1 = null;

    // samplers
    this._samp2D = null;
    this._sampShape = null;
    this._sampDetail = null;
    this._sampBN = null;

    // staging ABs (match WGSL layouts)
    this._abOptions = new ArrayBuffer(32);
    this._dvOptions = new DataView(this._abOptions);

    // CloudParams (updated shader): 112 bytes
    this._abParams = new ArrayBuffer(112);
    this._dvParams = new DataView(this._abParams);

    // NoiseTransforms (updated shader): 128 bytes
    this._abNTransform = new ArrayBuffer(128);
    this._dvNTransform = new DataView(this._abNTransform);

    // Frame: 64 bytes
    this._abFrame = new ArrayBuffer(64);
    this._dvFrame = new DataView(this._abFrame);

    // Light: 32 bytes
    this._abLight = new ArrayBuffer(32);
    this._dvLight = new DataView(this._abLight);

    // View: 128 bytes
    this._abView = new ArrayBuffer(128);
    this._dvView = new DataView(this._abView);

    // Box: 32 bytes
    this._abBox = new ArrayBuffer(32);
    this._dvBox = new DataView(this._abBox);

    // Reproj: 64 bytes
    this._abReproj = new ArrayBuffer(64);
    this._dvReproj = new DataView(this._abReproj);

    // Perf: 16 bytes
    this._abPerf = new ArrayBuffer(16);
    this._dvPerf = new DataView(this._abPerf);

    // TUNE: 256 bytes
    this._abTuning = new ArrayBuffer(256);
    this._dvTuning = new DataView(this._abTuning);


    // Preview render params: 304 bytes
    this._abRender = new ArrayBuffer(304);
    this._dvRender = new DataView(this._abRender);

    // Upsample params: 32 bytes
    this._abUpsample = new ArrayBuffer(32);
    this._dvUpsample = new DataView(this._abUpsample);

    // GPU buffers (created in _initBuffers)
    this.optionsBuffer = null;
    this.paramsBuffer = null;
    this.nTransformBuffer = null;
    this.posBuffer = null;
    this.frameBuffer = null;
    this.lightBuffer = null;
    this.viewBuffer = null;
    this.boxBuffer = null;
    this.reprojBuffer = null;
    this.perfBuffer = null;
    this.tuningBuffer = null;
    this.renderParams = null;

    // upsample resources
    this._upsample = null; // { pipe, bgl, samp, format, bgCache: Map }
    this._upsampleParamsBuffer = null;

    // bookkeeping & caches
    this._lastSums = new Map();
    this._u8Views = new WeakMap();
    this._u32Views = new WeakMap();
    this._resId = new WeakMap();
    this._nextResId = 1;

    this._bg0Cache = new Map();
    this._bg0Keys = [];
    this._bg1Cache = new Map();
    this._bg1Keys = [];
    this._bg0Dirty = true;
    this._bg1Dirty = true;
    this._currentBg0 = null;
    this._currentBg1 = null;
    this._lastInterleaveStats = null;

    this._render = null;
    this._renderSourceView = null;
    this._ctxCache = new WeakMap();
    this._canvasStates = new WeakMap();
    this._renderBgCache = new WeakMap();
    this._renderBundleCache = new WeakMap();
    this._bootstrapRenderBgCache = new WeakMap();

    // tiny dummies
    this._ownsBlue = false;
    this._dummy2DMotion = null;
    this._dummy2DMotionView = null;
    this._dummy2DDepth = null;
    this._dummy2DDepthView = null;
    this._dummyHistoryPrev = null;
    this._dummyHistoryPrevView = null;
    this._dummyHistoryOut = null;
    this._dummyHistoryOutView = null;

    // reproj tracking
    this._lastHadWork = false;
    this._reprojFullW = 0;
    this._reprojFullH = 0;

    // sticky state
    this._state = {
      options: {
        useCustomPos: false,
        outputChannel: 0,
        writeRGB: true,
        r0: 0.0,
        r1: 0.0,
        r2: 0.0,
        r3: 0.0,
      },
      params: {
        globalCoverage: 1.0,
        globalDensity: 1000.0,
        cloudAnvilAmount: 0.0,
        cloudBeer: 6.0,
        attenuationClamp: 0.015,
        inScatterG: 0.55,
        silverIntensity: 1.15,
        silverExponent: 1.65,
        outScatterG: 0.08,
        inVsOut: 0.55,
        outScatterAmbientAmt: 0.06,
        ambientMinimum: 0.04,
        sunColor: [1.0, 0.985, 0.95],
        frontLightColor: [1.10, 1.12, 1.16],
        shadowLightColor: [0.58, 0.63, 0.72],
        densityDivMin: 0.001,
        silverDirectionBias: 0.9,
        silverHorizonBoost: 0.35,
      },
      ntransform: {
        shapeOffsetWorld: [0, 0, 0],
        detailOffsetWorld: [0, 0, 0],
        shapeScale: 0.13,
        detailScale: 1.35,
        weatherScale: 1.0,
        shapeAxisScale: [1, 1.22, 1],
        detailAxisScale: [1, 1.48, 1],
        weatherOffsetWorld: [0, 0, 0],
        weatherAxisScale: [1, 1, 1],
        shapeBias: 0.0,
        detailBias: 0.0,
        weatherBias: 0.0,
      },
      reproj: {
        enabled: 0,
        subsample: 1,
        sampleOffset: 0,
        motionIsNormalized: 0,
        temporalBlend: 0.0,
        depthTest: 0,
        depthTolerance: 0.0,
        frameIndex: 0,
        fullWidth: 0,
        fullHeight: 0,
        temporalCellRate: 1,
        temporalCellPhase: 0,
        compactInterleave: 0,
      },
      perf: {
        lodBiasMul: 1.0,
        coarseMipBias: 0.0,
      },
      light: {
        sunDir: [0.65, 0.37, -0.65],
        camPos: [0, 0, 2],
      },
      box: {
        center: [0, 0, 0],
        half: [18, 0.6, 18],
        uvScale: 1.0,
      },
      tuning: {
        maxSteps: 224,
        minStep: 0.003,
        maxStep: 0.16,
        sunSteps: 5,
        sunStride: 4,
        sunMinTr: 0.003,
        phaseJitter: 1.0,
        stepJitter: 0.3,
        baseJitterFrac: 0.02,
        topJitterFrac: 0.1,
        lodBiasWeather: 1.5,
        aabbFaceOffset: 0.0015,
        weatherRejectGate: 0.985,
        weatherRejectMip: 1.0,
        emptySkipMult: 4.75,
        nearFluffDist: 60.0,
        nearStepScale: 0.3,
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
        raySmoothDens: 0.26,
        raySmoothSun: 0.34,
        fluffFactor: 3.4,
        anvilLift: 0.6,
        alphaCutoff: 0.98,
        thickBoxPerf: 0.65,
        thickStepBoost: 1.46,
        thickDetailSkip: 0.18,
        thickLightSkip: 0.34,
        verticalStepBoost: 3.0,
        verticalTextureHomogeneity: 0.46,
        verticalLightingStepBoost: 1.35,
        frontOcclusionStrength: 0.82,
        frontOcclusionAlpha: 0.58,
        frontOcclusionStepBoost: 4.2,
        sliceJitterStrength: 0.08,
        verticalLayerDecorrelation: 0.35,
        directLightBlend: 0.78,
        directLightBoost: 0.58,
        alphaBoostThreshold: 0.20,
        alphaBoostAmount: 0.14,
        minOutputAlpha: 0.12,
        outputAlphaFeather: 0.50,
        sparsity: 0.42,
        definition: 0.62,
        formType: 0,
        puffScale: 3.6,
        aoStrength: 0,
        towerHeightVariation: 0.35,
      },
    };

    this._initCompute();
    this._initBuffers();

    // defaults & initial uploads
    this.setOptions();
    this.setParams();
    this.setNoiseTransforms(this._state.ntransform);
    this.setReprojSettings(this._state.reproj);
    this.setPerfParams(this._state.perf);
    this.setSunByAngles();
    this.setBox(this._state.box);
    this.setTuning(this._state.tuning);
  }

  // -------------------- helpers --------------------
  _getResId(obj) {
    if (!obj) return "null";
    if (this._resId.has(obj)) return this._resId.get(obj);
    const id = `r${this._nextResId++}`;
    this._resId.set(obj, id);
    return id;
  }

  _ensureBindGroupCaches() {
    if (!this._bg0Cache) this._bg0Cache = new Map();
    if (!this._bg0Keys) this._bg0Keys = [];
    if (!this._bg1Cache) this._bg1Cache = new Map();
    if (!this._bg1Keys) this._bg1Keys = [];
  }

  _clearBindGroupCaches() {
    this._ensureBindGroupCaches();
    this._bg0Cache.clear();
    this._bg1Cache.clear();
    this._bg0Keys.length = 0;
    this._bg1Keys.length = 0;
    if (this._historyCopyBgCache) this._historyCopyBgCache.clear();
    if (this._historyCopyBgKeys) this._historyCopyBgKeys.length = 0;
    this._bg0Dirty = true;
    this._bg1Dirty = true;
    this._currentBg0 = null;
    this._currentBg1 = null;
  }

  _u8(ab) {
    let v = this._u8Views.get(ab);
    if (!v) {
      v = new Uint8Array(ab);
      this._u8Views.set(ab, v);
    }
    return v;
  }

  _u32(ab) {
    let v = this._u32Views.get(ab);
    if (!v) {
      v = new Uint32Array(ab);
      this._u32Views.set(ab, v);
    }
    return v;
  }

  _sum32(ab) {
    const u = this._u32(ab);
    let s = 2166136261 >>> 0;
    for (let i = 0; i < u.length; ++i) {
      s = (s ^ u[i]) >>> 0;
      s = (s + ((s << 1) + (s << 4) + (s << 7) + (s << 8) + (s << 24))) >>> 0;
    }
    return s >>> 0;
  }

  _writeIfChanged(tag, gpuBuf, ab) {
    const sum = this._sum32(ab);
    const prev = this._lastSums.get(tag);
    if (!prev || prev.sum !== sum || prev.len !== ab.byteLength) {
      this.queue.writeBuffer(gpuBuf, 0, this._u8(ab));
      this._lastSums.set(tag, { sum, len: ab.byteLength });
    }
  }

  _ensureComputeFormat(format) {
    const fmt = format || this.outFormat;
    if (fmt === this.outFormat && this.bgl0) return;
    this.outFormat = fmt;

    const d = this.device;
    const deviceCache = getCloudGpuCache(d);
    const cachedCompute = deviceCache.computeByFormat.get(this.outFormat);
    if (cachedCompute) {
      this.bgl0 = cachedCompute.bgl0;
      this._computePipelineLayout = cachedCompute.layout;
      this._computePipelines = cachedCompute.pipelines || new Map();
      this._computePipelinePromises = cachedCompute.pipelinePromises || new Map();
      cachedCompute.pipelinePromises = this._computePipelinePromises;
      this._computePipelineKey = this._currentComputeVariantKey();
      this.pipeline = this._computePipelines.get(this._computePipelineKey) || null;
      if (!this.pipeline) this._computePipelineKey = -1;

      this._destroyDummyHistory();
      this._createDummyHistory();

      this._clearBindGroupCaches();
      return;
    }

    // group(0) bindings must match updated shader:
    // 0 opt, 1 C, 3 NTransform, 4 outTex, 5 posBuf, 6 frame, 7 historyOut, 8 reproj, 9 perf, 10 TUNE
    this.bgl0 = d.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: "write-only",
            format: this.outFormat,
            viewDimension: "2d-array",
          },
        },
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 6,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 7,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: "write-only",
            format: this.outFormat,
            viewDimension: "2d-array",
          },
        },
        {
          binding: 8,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 9,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 10,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });

    this._computePipelineLayout = d.createPipelineLayout({
      bindGroupLayouts: [this.bgl0, this.bgl1],
    });
    this._computePipelines = new Map();
    this._computePipelinePromises = new Map();
    this.pipeline = null;
    this._computePipelineKey = -1;

    deviceCache.computeByFormat.set(this.outFormat, {
      bgl0: this.bgl0,
      layout: this._computePipelineLayout,
      pipelines: this._computePipelines,
      pipelinePromises: this._computePipelinePromises,
    });

    this._destroyDummyHistory();
    this._createDummyHistory();

    this._clearBindGroupCaches();
  }

  _currentComputeMode() {
    const spherical = this._dvOptions.getFloat32(16, true) >= 0.5;
    return spherical ? 1 : 0;
  }

  _currentComputeVariantKey({ coarseFactor = 1 } = {}) {
    const mode = Math.max(0, Math.min(2, this._currentComputeMode()));
    const customPos = this._dvOptions.getUint32(0, true) !== 0;
    const writeRGB = this._dvOptions.getUint32(8, true) !== 0;
    // Read the packed integer, exactly as the GPU does (including <= 0 inputs).
    // Adaptive lighting only adds to this stride, so detailed probes cannot run
    // when it is > 1. Do not compile their large call graph for that case.
    const useFields = mode === 0 && this._dvTuning.getFloat32(240, true) > 0;
    const planetStyle = mode !== 0 && this._planetStyleMode === true && this._dvTuning.getFloat32(240, true) > 0.5 && (this._dvView?.getFloat32(92,true) ?? 1) <= 1.5;
    const detailedLighting = !useFields && !planetStyle && this._dvTuning.getInt32(8, true) <= 1;
    const divider = Math.max(1, coarseFactor | 0);
    const scratchBytes = Math.max(1, Math.ceil((this.width || 1) / divider)) * Math.max(1, Math.ceil((this.height || 1) / divider)) * Math.max(1, this.layers || 1) * 32;
    const stagedResolve = mode === 0 && scratchBytes <= (this.device.limits?.maxStorageBufferBindingSize ?? 134217728);
    return mode | (customPos ? 4 : 0) | (writeRGB ? 8 : 0) | (detailedLighting ? 16 : 0) | (stagedResolve ? 32 : 0) | (useFields ? 64 : 0) | (planetStyle ? 128 : 0);
  }

  _computePipelineDescriptorForKey(key = this._currentComputeVariantKey()) {
    const mode = key & 3;
    const isSpherical = mode !== 0;
    const entryPoint = (key & 128) ? "computeCloudPlanet" : isSpherical ? "computeCloudSphere" : "computeCloudBox";
    return {
      layout: (key & 96) ? this._getFlatStageSetup().layout : this._computePipelineLayout,
      compute: {
        module: (key & 128) ? this._getPlanetShaderModule() : (key & 64) ? this._getFieldShaderModule() : (key & 32) ? this._getStagedLayerShaderModule() : this.module,
        entryPoint,
        constants: {
          CLOUD_IS_SPHERICAL: isSpherical ? 1 : 0,
          CLOUD_USE_CUSTOM_POS: (key & 4) ? 1 : 0,
          CLOUD_WRITE_RGB: (key & 8) ? 1 : 0,
          CLOUD_DETAILED_LIGHTING: (key & 16) ? 1 : 0,
          CLOUD_STAGED_RESOLVE: (key & 32) ? 1 : 0,
          CLOUD_USE_FIELDS: (key & 64) ? 1 : 0,
        },
      },
    };
  }

  _beginComputePipelineTiming(key, async, entryPoint = (key & 128) ? "computeCloudPlanet" : (key & 3) ? "computeCloudSphere" : "computeCloudBox") {
    const started = performance.now();
    const timing = {
      key,
      format: this.outFormat,
      entryPoint,
      detailedLighting: !!(key & 16),
      sharedFields: typeof key === "number" ? !!(key & 64) : entryPoint !== "resolveCloudFlat",
      async,
      status: "compiling",
      compileMs: null,
    };
    getCloudGpuCache(this.device).computeTimings.set(`${this.outFormat}:${key}`, timing);
    return (error) => {
      timing.compileMs = performance.now() - started;
      timing.status = error ? "error" : "ready";
      if (error) timing.error = String(error?.message || error);
    };
  }

  // Structured-cloneable; times are CPU/API wall time, not GPU timestamps.
  // Cached pipelines keep their original compilation measurement.
  getComputePipelineTimings() {
    const cache = getCloudGpuCache(this.device);
    return {
      activeKey: this._currentComputeVariantKey(),
      installedKey: this._computePipelineKey,
      module: cache.moduleTiming ? { ...cache.moduleTiming } : null,
      stagedModule: cache.stagedModuleTiming ? { ...cache.stagedModuleTiming } : null,
      fieldModule: cache.fieldModuleTiming ? { ...cache.fieldModuleTiming } : null,
      resolveModule: cache.resolveModuleTiming ? { ...cache.resolveModuleTiming } : null,
      planetModule: cache.planetModuleTiming ? { ...cache.planetModuleTiming } : null,
      variants: [...cache.computeTimings.values()].map(timing => ({ ...timing })),
    };
  }

  _ensureComputePipelineForKey(key = this._currentComputeVariantKey()) {
    const cached = this._computePipelines.get(key);
    if (cached) return cached;

    const finish = this._beginComputePipelineTiming(key, false);
    try {
      const pipeline = this.device.createComputePipeline(
        this._computePipelineDescriptorForKey(key),
      );
      this._computePipelines.set(key, pipeline);
      finish();
      return pipeline;
    } catch (error) {
      finish(error);
      throw error;
    }
  }

  async _ensureComputePipelineForKeyAsync(key = this._currentComputeVariantKey()) {
    const pipelines = this._computePipelines;
    const pipelinePromises = this._computePipelinePromises;
    const descriptor = this._computePipelineDescriptorForKey(key);
    const cached = pipelines.get(key);
    if (cached) return cached;

    const existing = pipelinePromises.get(key);
    if (existing) return existing;

    const create = async () => {
      const async = typeof this.device.createComputePipelineAsync === "function";
      const finish = this._beginComputePipelineTiming(key, async);
      try {
        const pipeline = async
          ? await this.device.createComputePipelineAsync(descriptor)
          : this.device.createComputePipeline(descriptor);
        const installed = pipelines.get(key);
        if (!installed) pipelines.set(key, pipeline);
        finish();
        return installed || pipeline;
      } catch (error) {
        finish(error);
        throw error;
      }
    };

    const pending = create();
    pipelinePromises.set(key, pending);
    try {
      return await pending;
    } finally {
      if (pipelinePromises.get(key) === pending) {
        pipelinePromises.delete(key);
      }
    }
  }

  ensureComputePipelineReady(dispatch = {}) {
    const key = this._currentComputeVariantKey(dispatch);
    if (this.pipeline && this._computePipelineKey === key) return this.pipeline;
    this.pipeline = this._ensureComputePipelineForKey(key);
    if (key & 32) this._ensureFlatStagePipeline("resolveCloudFlat");
    if (key & 64) {
      this._ensureFlatStagePipeline("buildCloudDensityField");
      this._ensureFlatStagePipeline("buildCloudLightField");
    }
    this._computePipelineKey = key;
    return this.pipeline;
  }

  async ensureComputePipelineReadyAsync(dispatch = {}) {
    const key = this._currentComputeVariantKey(dispatch);
    const pipelines = this._computePipelines;
    if (this.pipeline && this._computePipelineKey === key) return this.pipeline;
    const [pipeline] = await Promise.all([
      this._ensureComputePipelineForKeyAsync(key),
      (key & 32) ? this._ensureFlatStagePipelineAsync("resolveCloudFlat") : null,
      (key & 64) ? this._ensureFlatStagePipelineAsync("buildCloudDensityField") : null,
      (key & 64) ? this._ensureFlatStagePipelineAsync("buildCloudLightField") : null,
    ]);
    if (this._computePipelines === pipelines && this._currentComputeVariantKey(dispatch) === key) {
      this.pipeline = pipeline;
      this._computePipelineKey = key;
    }
    return pipeline;
  }

  async prewarmComputePipelineVariantAsync({
    spherical = false,
    aurora = false,
    useCustomPos = false,
    writeRGB = true,
    sunStride = this._dvTuning.getInt32(8, true),
    formType = this._dvTuning.getFloat32(240, true),
    planetStyleMode = this._planetStyleMode === true,
  } = {}) {
    const mode = aurora || spherical ? 1 : 0;
    const fields = mode === 0 && formType > 0;
    const planetStyle = mode !== 0 && !aurora && planetStyleMode && formType > 0.5;
    const key = mode | (useCustomPos ? 4 : 0) | (writeRGB ? 8 : 0) | (!fields && !planetStyle && (sunStride | 0) <= 1 ? 16 : 0) | (mode === 0 ? 32 : 0) | (fields ? 64 : 0) | (planetStyle ? 128 : 0);
    const [pipeline] = await Promise.all([
      this._ensureComputePipelineForKeyAsync(key),
      (key & 32) ? this._ensureFlatStagePipelineAsync("resolveCloudFlat") : null,
      fields ? this._ensureFlatStagePipelineAsync("buildCloudDensityField") : null,
      fields ? this._ensureFlatStagePipelineAsync("buildCloudLightField") : null,
    ]);
    return pipeline;
  }

  _getPlanetShaderModule() {
    const cache=getCloudGpuCache(this.device);
    if(!cache.planetModule)cache.planetModule=createTimedCloudModule(this.device,'cloud-planet-styles',commonWGSL+'\n'+scratchWGSL+'\n'+gasFlowWGSL+'\n'+gasAppearanceWGSL+'\n'+planetWGSL+'\n'+resolveWGSL+'\n'+INLINE_LAYER_OUTPUT,cache.planetModuleTiming={});
    return cache.planetModule;
  }

  _getFlatStageSetup() {
    const cache = getCloudGpuCache(this.device).flatStagesByFormat;
    if (cache.has(this.outFormat)) return cache.get(this.outFormat);
    const bgl = this.device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "3d" } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "3d" } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, sampler: { type: "filtering" } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
    ] });
    const densityBgl = this.device.createBindGroupLayout({ entries: [
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "rgba16float", viewDimension: "3d" } },
    ] });
    const lightBgl = this.device.createBindGroupLayout({ entries: [
      { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "3d" } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, sampler: { type: "filtering" } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      { binding: 6, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "rgba16float", viewDimension: "3d" } },
    ] });
    const setup = {
      bgl,
      densityBgl, lightBgl,
      sampler: this.device.createSampler({ minFilter: "linear", magFilter: "linear", mipmapFilter:"linear", addressModeU: "repeat", addressModeV: "clamp-to-edge", addressModeW: "repeat" }),
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bgl0, this.bgl1, bgl] }),
      densityLayout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bgl0, this.bgl1, densityBgl] }),
      lightLayout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bgl0, this.bgl1, lightBgl] }),
      pipelines: new Map(), promises: new Map(),
    };
    cache.set(this.outFormat, setup);
    return setup;
  }

  _flatStageDescriptor(entryPoint) {
    const setup = this._getFlatStageSetup();
    const fields = entryPoint !== "resolveCloudFlat";
    return {
      label: entryPoint,
      layout: entryPoint === "buildCloudDensityField" ? setup.densityLayout : entryPoint === "buildCloudLightField" ? setup.lightLayout : setup.layout,
      compute: { module: fields ? this._getFieldShaderModule() : this._getResolveShaderModule(), entryPoint, constants: { CLOUD_IS_SPHERICAL: 0, CLOUD_USE_FIELDS: fields ? 1 : 0 } },
    };
  }

  _ensureFlatStagePipeline(entryPoint) {
    const setup = this._getFlatStageSetup();
    if (setup.pipelines.has(entryPoint)) return setup.pipelines.get(entryPoint);
    const finish = this._beginComputePipelineTiming(entryPoint, false, entryPoint);
    try {
      const pipeline = this.device.createComputePipeline(this._flatStageDescriptor(entryPoint));
      setup.pipelines.set(entryPoint, pipeline);
      finish();
      return pipeline;
    } catch (error) { finish(error); throw error; }
  }

  async _ensureFlatStagePipelineAsync(entryPoint) {
    const setup = this._getFlatStageSetup();
    if (setup.pipelines.has(entryPoint)) return setup.pipelines.get(entryPoint);
    if (setup.promises.has(entryPoint)) return setup.promises.get(entryPoint);
    const descriptor = this._flatStageDescriptor(entryPoint);
    const async = typeof this.device.createComputePipelineAsync === "function";
    const finish = this._beginComputePipelineTiming(entryPoint, async, entryPoint);
    const pending = Promise.resolve().then(() => async ? this.device.createComputePipelineAsync(descriptor) : this.device.createComputePipeline(descriptor))
      .then(pipeline => { setup.pipelines.set(entryPoint, pipeline); finish(); return pipeline; })
      .catch(error => { finish(error); throw error; })
      .finally(() => { setup.promises.delete(entryPoint); });
    setup.promises.set(entryPoint, pending);
    return pending;
  }

  _getFlatStageBindGroup() {
    this._ensureFlatFieldResources();
    const bytes = (this._computePipelineKey & 32) ? Math.max(1, this.width * this.height * this.layers) * 32 : 32;
    if (!this._resolveScratch || this._resolveScratch.size < bytes) {
      const old = this._resolveScratch;
      this._resolveScratch = this.device.createBuffer({ label: "cloud-ray-radiance", size: bytes, usage: GPUBufferUsage.STORAGE });
      this._flatStageBindGroup = null;
      if (old) this.queue.onSubmittedWorkDone().then(() => old.destroy()).catch(() => {});
    }
    if (!this._flatStageBindGroup) this._flatStageBindGroup = this.device.createBindGroup({
      layout: this._getFlatStageSetup().bgl,
      entries: [
        { binding: 0, resource: { buffer: this._resolveScratch } },
        { binding: 1, resource: this._fieldResources.densityView },
        { binding: 2, resource: this._fieldResources.lightView },
        { binding: 3, resource: this._getFlatStageSetup().sampler },
        { binding: 4, resource: { buffer: this._fieldParamsBuffer } },
      ],
    });
    return this._flatStageBindGroup;
  }

  _getFieldShaderModule() {
    const cache = getCloudGpuCache(this.device);
    if (!cache.fieldModule) cache.fieldModule = createTimedCloudModule(this.device, "cloud-rounded-fields",
      commonWGSL + "\n" + scratchWGSL + "\n" + cloudWGSL + "\n" + resolveWGSL + "\n" + fieldWGSL,
      cache.fieldModuleTiming = {});
    return cache.fieldModule;
  }

  _getStagedLayerShaderModule() {
    const cache = getCloudGpuCache(this.device);
    if (!cache.stagedModule) {
      const code = commonWGSL + "\n" + scratchWGSL + "\n" + layerWGSL + "\n" + rayOutputWGSL;
      cache.stagedModule = createTimedCloudModule(this.device, "cloud-layer-raymarch", code, cache.stagedModuleTiming = {});
    }
    return cache.stagedModule;
  }

  _getResolveShaderModule() {
    const cache = getCloudGpuCache(this.device);
    return cache.resolveModule ||= createTimedCloudModule(this.device, "cloud-temporal-resolve", commonWGSL + "\n" + scratchWGSL + "\n" + resolveWGSL, cache.resolveModuleTiming = {});
  }

  invalidateCloudFields() {
    this._fieldDensitySignature = null;
    this._fieldLightSignature = null;
  }

  setFieldQuality(quality = 'balanced') {
    if (!Object.hasOwn(CLOUD_FIELD_QUALITIES, quality)) throw new RangeError(`Unknown cloud field quality: ${quality}`);
    if (!supportsCloudFieldQuality(quality, this.device.limits)) throw new RangeError(`Cloud field quality ${quality} is unavailable with this GPU device's limits`);
    if ((this._state.fieldQuality || 'balanced') === quality) return;
    this._state.fieldQuality = quality;
    // Allocation is deferred to the next encode, not interleaved with a frame.
    // The dimension uniform invalidates both fields when resources are replaced.
  }

  // Fine visible-edge erosion reuses the tiled detail map at ray time. It does
  // not alter the macro geometry/light cache or allocate a larger volume.
  setCloudTurbulence(amount = 0) {
    this._state.cloudTurbulence = Number.isFinite(amount) ? Math.min(1.5, Math.max(0, amount)) : 0;
  }

  // Arbitrary-volume examples clip the same cached noise/lighting fields. The
  // rotation is geometry, not camera motion, and never resets the wind domain.
  setVolumeMask({ shape = this._state.volumeMask?.shape ?? "box", rotationAngle = this._state.volumeMask?.rotationAngle ?? 1.05 } = {}) {
    if (!["box", "torus", "gallery"].includes(shape)) throw new Error(`Unknown cloud volume: ${shape}`);
    this._state.volumeMask = { shape, rotationAngle: Number.isFinite(rotationAngle) ? rotationAngle : 1.05 };
  }

  // Optional continuous weather morphology. All profiles share cached fields.
  // Zero weights preserve every standalone preset and arbitrary volume.
  setWeatherProfile({shelf=0,deck=0,wisps=0,cirrus=0,fluctus=0,asperitas=0} = {}) {
    const keys=['shelf','deck','wisps','cirrus','fluctus','asperitas'];
    const values=[shelf,deck,wisps,cirrus,fluctus,asperitas].map(v=>Number.isFinite(v)?Math.min(1,Math.max(0,v)):0);
    const scale=Math.max(1,values.reduce((sum,v)=>sum+v,0));
    this._state.weatherProfile=Object.fromEntries(keys.map((key,i)=>[key,values[i]/scale]));
  }

  _ensureFlatFieldResources() {
    const active = this._currentComputeVariantKey() & 64;
    const dimensions = active ? CLOUD_FIELD_QUALITIES[this._state.fieldQuality || 'balanced'].dimensions : (this._fieldResources?.dimensions || [1, 1, 1]);
    if (this._fieldResources?.dimensions.join() === dimensions.join()) return;
    const old = this._fieldResources;
    // Sculpted layers bind a one-texel placeholder before any volume is baked.
    // Complete the tiny tail of the mip chain for conservative empty-space
    // queries. The first four levels still serve visible cloud filtering.
    const mipLevelCount=1+Math.floor(Math.log2(Math.max(...dimensions)));
    const create = label => this.device.createTexture({ label, dimension: "3d", size: dimensions, mipLevelCount, format: "rgba16float", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING });
    const density = create("cloud-density-field");
    const light = create("cloud-shadow-ao-field");
    this._fieldResources = { dimensions, density, light, densityView: density.createView(), lightView: light.createView() };
    const cache=getCloudGpuCache(this.device);
    if(!cache.fieldMipPipelines){
      const module=this.device.createShaderModule({code:`
      override DENSITY:bool=false;
      @group(0) @binding(0) var source:texture_3d<f32>;
      @group(0) @binding(1) var mipOut:texture_storage_3d<rgba16float,write>;
      @compute @workgroup_size(4,4,4) fn downsample(@builtin(global_invocation_id) p:vec3<u32>){
        if(any(p>=textureDimensions(mipOut))){return;}
        let sourceSize=textureDimensions(source);
        let targetSize=textureDimensions(mipOut);
        let lo=p*sourceSize/targetSize;
        let hi=(p+vec3<u32>(1u))*sourceSize/targetSize;
        var value=vec4<f32>(0.0);var occupied=0.0;var count=0.0;
        for(var z=lo.z;z<hi.z;z++){for(var y=lo.y;y<hi.y;y++){for(var x=lo.x;x<hi.x;x++){
          let child=textureLoad(source,vec3<i32>(i32(x),i32(y),i32(z)),0);
          value+=child;occupied=max(occupied,child.b);count+=1.0;
        }}}
        value/=max(count,1.0);
        if(DENSITY){value.b=occupied;}
        textureStore(mipOut,vec3<i32>(p),value);
      }`});
      cache.fieldMipPipelines=[true,false].map(density=>this.device.createComputePipeline({layout:'auto',compute:{entryPoint:'downsample',module,constants:{DENSITY:density}}}));
    }
    this._fieldMipPipelines=cache.fieldMipPipelines;
    this._fieldMipGroups=[density,light].map((texture,field)=>Array.from({length:mipLevelCount-1},(_,i)=>this.device.createBindGroup({layout:cache.fieldMipPipelines[field].getBindGroupLayout(0),entries:[
      {binding:0,resource:texture.createView({baseMipLevel:i,mipLevelCount:1})},
      {binding:1,resource:texture.createView({baseMipLevel:i+1,mipLevelCount:1})},
    ]})));
    this._fieldParamsBuffer ||= this.device.createBuffer({ label: "cloud-field-bounds", size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this._fieldParamsAB ||= new ArrayBuffer(80);
    const setup = this._getFlatStageSetup();
    this._fieldDensityBg = this.device.createBindGroup({ layout: setup.densityBgl, entries: [
      { binding: 4, resource: { buffer: this._fieldParamsBuffer } }, { binding: 5, resource: density.createView({baseMipLevel:0,mipLevelCount:1}) },
    ] });
    this._fieldLightBg = this.device.createBindGroup({ layout: setup.lightBgl, entries: [
      { binding: 1, resource: this._fieldResources.densityView }, { binding: 3, resource: setup.sampler },
      { binding: 4, resource: { buffer: this._fieldParamsBuffer } }, { binding: 6, resource: light.createView({baseMipLevel:0,mipLevelCount:1}) },
    ] });
    this._flatStageBindGroup = null;
    this.invalidateCloudFields();
    if (old) { this._retireTexture(old.density); this._retireTexture(old.light); }
  }

  _encodeFlatFields(pass, timings) {
    this._ensureFlatFieldResources();
    const started = performance.now();
    const { dimensions } = this._fieldResources;
    const dv = new DataView(this._fieldParamsAB);
    const mask = this._state.volumeMask;
    const arbitrary = mask?.shape === "torus" || mask?.shape === "gallery";
    const tiled = !arbitrary && Math.max(this._state.box.half[0],this._state.box.half[2])>36;
    const cell=Math.max(this._state.tuning.puffScale,0.75);
    const tileSpan=Math.ceil(36/cell/2)*2*cell;
    for (let i = 0; i < 3; i++) {
      const half=tiled&&i!==1?tileSpan/2:this._state.box.half[i];
      dv.setFloat32(i * 4, this._state.box.center[i] - half, true);
      dv.setFloat32(16 + i * 4, half * 2, true);
      dv.setUint32(32 + i * 4, dimensions[i], true);
    }
    dv.setUint32(44,tiled?1:0,true);
    const profile = this._state.weatherProfile;
    dv.setFloat32(12, arbitrary ? 0 : profile?.shelf || 0, true);
    dv.setFloat32(28, arbitrary ? 0 : profile?.deck || 0, true);
    dv.setFloat32(48, mask?.shape === "gallery" ? 2 : mask?.shape === "torus" ? 1 : 0, true);
    dv.setFloat32(52, arbitrary ? mask.rotationAngle : 0, true);
    dv.setFloat32(56, 0.58, true); // major radius / smallest half extent
    dv.setFloat32(60, arbitrary ? 0.22 : profile?.wisps || 0, true); // tube radius, or high-wisp weight
    for (const [i,key] of ['cirrus','fluctus','asperitas'].entries()) {
      dv.setFloat32(64+i*4, arbitrary ? 0 : profile?.[key] || 0, true);
    }
    dv.setFloat32(76, this._state.cloudTurbulence || 0, true);
    this._writeIfChanged("fieldParams", this._fieldParamsBuffer, this._fieldParamsAB);
    // AO is a lighting blend, not geometry. Changing its strength or the camera
    // must not rebake either field.
    const densitySignature = [this._abParams.slice(0,12), this._abNTransform, this._abTuning.slice(0,12), this._abTuning.slice(16, 248), this._abTuning.slice(252), this._abBox, this._fieldParamsAB.slice(0, 76)].map(ab => this._sum32(ab)).concat(
      this._getResId(this.weatherView), this._getResId(this.shape3DView), this._getResId(this.detail3DView),
      this._dvView.getFloat32(96, true), this._dvView.getFloat32(92, true),
    ).join("|");
    const densityChanged = densitySignature !== this._fieldDensitySignature;
    const lightSignature = densitySignature + "|" + this._state.light.sunDir.join("|")+"|"+new DataView(this._abParams).getFloat32(12,true);
    const lightChanged = densityChanged || lightSignature !== this._fieldLightSignature;
    const dispatch = entry => {
      const encodeStarted = performance.now();
      pass.setPipeline(this._ensureFlatStagePipeline(entry));
      pass.setBindGroup(0, this._currentBg0);
      pass.setBindGroup(1, this._currentBg1);
      pass.setBindGroup(2, entry === "buildCloudDensityField" ? this._fieldDensityBg : this._fieldLightBg);
      pass.dispatchWorkgroups(...dimensions.map(n => Math.ceil(n / 4)));
      timings.push({ stage: entry, encodeMs: performance.now() - encodeStarted, dispatched: true, dimensions });
    };
    if (densityChanged) dispatch("buildCloudDensityField");
    else timings.push({ stage: "buildCloudDensityField", encodeMs: 0, dispatched: false, cached: true });
    if (lightChanged) dispatch("buildCloudLightField");
    else timings.push({ stage: "buildCloudLightField", encodeMs: 0, dispatched: false, cached: true });
    if(densityChanged||lightChanged){
      this._fieldMipGroups.forEach((groups,field)=>{
        if(!groups.length||!(field===0?densityChanged:lightChanged))return;
        pass.setPipeline(getCloudGpuCache(this.device).fieldMipPipelines[field]);
        groups.forEach((group,i)=>{pass.setBindGroup(0,group);pass.dispatchWorkgroups(...dimensions.map(n=>Math.ceil(Math.max(1,n>>(i+1))/4)));});
      });
    }
    this._fieldDensitySignature = densitySignature;
    this._fieldLightSignature = lightSignature;
    timings.push({ stage: "field-cache-check", encodeMs: performance.now() - started });
  }

  ensureUpsamplePipelineReady(format = this.outFormat) {
    return this._ensureUpsamplePipeline(format);
  }

  _createBootstrapComputePipelineSetup(format = this.outFormat) {
    const fmt = format || "rgba16float";
    const code = `
      const PI: f32 = 3.141592653589793;

      struct CloudParams {
        globalCoverage: f32,
        globalDensity: f32,
        cloudAnvilAmount: f32,
        cloudBeer: f32,
        attenuationClamp: f32,
        inScatterG: f32,
        silverIntensity: f32,
        silverExponent: f32,
        outScatterG: f32,
        inVsOut: f32,
        outScatterAmbientAmt: f32,
        ambientMinimum: f32,
        sunColor: vec3<f32>,
        _sunColorPad: f32,
        densityDivMin: f32,
        silverDirectionBias: f32,
        silverHorizonBoost: f32,
        _pad0: f32,
        frontLightColor: vec3<f32>,
        _frontLightPad: f32,
        shadowLightColor: vec3<f32>,
        _shadowLightPad: f32,
      };

      struct NoiseTransforms {
        shapeOffsetWorld: vec3<f32>, _pad0: f32,
        detailOffsetWorld: vec3<f32>, _pad1: f32,
        shapeScale: f32, detailScale: f32, weatherScale: f32, _pad2: f32,
        shapeAxisScale: vec3<f32>, _pad3: f32,
        detailAxisScale: vec3<f32>, _pad4: f32,
        weatherOffsetWorld: vec3<f32>, _pad5: f32,
        weatherAxisScale: vec3<f32>, _pad6: f32,
        shapeBias: f32, detailBias: f32, weatherBias: f32, _pad7: f32,
      };

      struct Frame {
        fullWidth: u32, fullHeight: u32,
        tileWidth: u32, tileHeight: u32,
        originX: i32, originY: i32, originZ: i32,
        fullDepth: u32, tileDepth: u32,
        layerIndex: i32, layers: u32, _pad0: u32,
        originXf: f32, originYf: f32, _pad1: f32, _pad2: f32,
      };

      struct LightInputs {
        sunDir: vec3<f32>, _0: f32,
        camPos: vec3<f32>, _1: f32,
      };

      struct View {
        camPos: vec3<f32>, _v0: f32,
        right: vec3<f32>, _v1: f32,
        up: vec3<f32>, _v2: f32,
        fwd: vec3<f32>, _v3: f32,
        fovY: f32, aspect: f32, stepBase: f32, stepInc: f32,
        planetRadius: f32, cloudBottom: f32, cloudTop: f32, volumeLayers: f32,
        worldToUV: f32, _a: f32, _b: f32, _c: f32,
      };

      struct Box {
        center: vec3<f32>, _b0: f32,
        half: vec3<f32>, uvScale: f32,
      };

      @group(0) @binding(1) var<uniform> C: CloudParams;
      @group(0) @binding(3) var<uniform> N: NoiseTransforms;
      @group(0) @binding(4) var outTex: texture_storage_2d_array<${fmt}, write>;
      @group(0) @binding(6) var<uniform> frame: Frame;

      @group(1) @binding(0) var weather2D: texture_2d_array<f32>;
      @group(1) @binding(1) var samp2D: sampler;
      @group(1) @binding(2) var shape3D: texture_3d<f32>;
      @group(1) @binding(3) var sampShape: sampler;
      @group(1) @binding(6) var detail3D: texture_3d<f32>;
      @group(1) @binding(7) var sampDetail: sampler;
      @group(1) @binding(8) var<uniform> L: LightInputs;
      @group(1) @binding(9) var<uniform> V: View;
      @group(1) @binding(10) var<uniform> B: Box;

      fn weatherUvForDirection(n: vec3<f32>) -> vec2<f32> {
        let lon = atan2(n.z, n.x) / (2.0 * PI) + 0.5;
        let lat = asin(clamp(n.y, -1.0, 1.0)) / PI + 0.5;
        return fract(vec2<f32>(lon, lat) * max(N.weatherScale, 0.001) + N.weatherOffsetWorld.xz * 0.0025);
      }

      fn bootstrapDensity(p: vec3<f32>, height01: f32) -> f32 {
        let n = normalize(p);
        let weather = textureSampleLevel(weather2D, samp2D, weatherUvForDirection(n), 0, 0.0);
        let axis = max(abs(N.shapeAxisScale), vec3<f32>(0.05));
        let shapeUv = fract(p * axis * max(N.shapeScale, 0.004) * 0.12 + N.shapeOffsetWorld * 0.004 + vec3<f32>(0.5));
        let shape = textureSampleLevel(shape3D, sampShape, shapeUv, 0.0);
        let body = shape.r * 0.64 + shape.g * 0.22 + shape.b * 0.14 + N.shapeBias * 0.08;
        let coverage = clamp(C.globalCoverage, 0.0, 1.5);
        let combined = body * 0.72 + weather.r * 0.66 + coverage * 0.16 + N.weatherBias * 0.05;
        let vertical = smoothstep(0.0, 0.16, height01) * (1.0 - smoothstep(0.72, 1.0, height01));
        return smoothstep(0.22, 0.72, combined) * vertical;
      }

      fn intersectBootstrapBox(ro: vec3<f32>, rd: vec3<f32>) -> vec2<f32> {
        let bmin = B.center - max(abs(B.half), vec3<f32>(0.001));
        let bmax = B.center + max(abs(B.half), vec3<f32>(0.001));
        let parallel = abs(rd) <= vec3<f32>(0.00001);
        if (
          (parallel.x && (ro.x < bmin.x || ro.x > bmax.x)) ||
          (parallel.y && (ro.y < bmin.y || ro.y > bmax.y)) ||
          (parallel.z && (ro.z < bmin.z || ro.z > bmax.z))
        ) {
          return vec2<f32>(1.0, -1.0);
        }
        let epsSigned = select(vec3<f32>(-0.00001), vec3<f32>(0.00001), rd >= vec3<f32>(0.0));
        let rdSafe = select(epsSigned, rd, abs(rd) > vec3<f32>(0.00001));
        let inv = vec3<f32>(1.0) / rdSafe;
        let ta = (bmin - ro) * inv;
        let tb = (bmax - ro) * inv;
        let near3 = min(ta, tb);
        let far3 = max(ta, tb);
        return vec2<f32>(max(max(near3.x, near3.y), near3.z), min(min(far3.x, far3.y), far3.z));
      }

      fn planarDensityAt(p: vec3<f32>) -> vec4<f32> {
        let weatherAxis = max(abs(N.weatherAxisScale.xz), vec2<f32>(0.05));
        let weatherUv = fract(
          (p.xz - B.center.xz) * weatherAxis * max(B.uvScale, 0.001) * max(N.weatherScale, 0.001) * 0.18 +
          N.weatherOffsetWorld.xz * 0.0025
        );
        let weather = textureSampleLevel(weather2D, samp2D, weatherUv, 0, 0.0);
        let shapeAxis = max(abs(N.shapeAxisScale), vec3<f32>(0.05));
        let shapeUv0 = fract(
          (p - B.center) * shapeAxis * max(N.shapeScale, 0.004) * 0.15 +
          N.shapeOffsetWorld * 0.006 + vec3<f32>(0.5)
        );
        let shapeUv1 = fract(shapeUv0 * vec3<f32>(1.73, 1.41, 1.29) + vec3<f32>(0.17, 0.37, 0.11));
        let shape0 = textureSampleLevel(shape3D, sampShape, shapeUv0, 0.0);
        let shape1 = textureSampleLevel(shape3D, sampShape, shapeUv1, 0.0);
        let detailAxis = max(abs(N.detailAxisScale), vec3<f32>(0.05));
        let detailUv = fract(
          (p - B.center) * detailAxis * max(N.detailScale, 0.004) * 0.46 +
          N.detailOffsetWorld * 0.008 + vec3<f32>(0.31, 0.57, 0.73)
        );
        let detail = textureSampleLevel(detail3D, sampDetail, detailUv, 0.0);
        let base =
          shape0.r * 0.48 + shape0.g * 0.16 + shape0.b * 0.08 +
          shape1.r * 0.17 + shape1.g * 0.07 + detail.r * 0.04;
        let combined = base * 0.70 + weather.r * 0.39 + N.shapeBias * 0.05 + N.weatherBias * 0.035;
        let coverage = clamp(C.globalCoverage, 0.0, 1.25);
        let threshold = mix(0.65, 0.33, min(coverage, 1.0));
        var density = smoothstep(threshold - 0.07, threshold + 0.17, combined);
        density = clamp(density + (detail.r - 0.5) * 0.11, 0.0, 1.0);
        let halfSafe = max(abs(B.half), vec3<f32>(0.001));
        let height01 = clamp((p.y - (B.center.y - halfSafe.y)) / (halfSafe.y * 2.0), 0.0, 1.0);
        let vertical = smoothstep(0.0, 0.13, height01) * (1.0 - smoothstep(0.70, 1.0, height01));
        return vec4<f32>(density * vertical, weather.rgb);
      }

      fn planarPreview(pixelUv: vec2<f32>) -> vec4<f32> {
        let ndc = vec2<f32>(pixelUv.x * 2.0 - 1.0, 1.0 - pixelUv.y * 2.0);
        let tanHalf = tan(max(V.fovY, 0.001) * 0.5);
        let rayDir = normalize(V.fwd + V.right * (ndc.x * V.aspect * tanHalf) + V.up * (ndc.y * tanHalf));
        let hit = intersectBootstrapBox(V.camPos, rayDir);
        let tStart = max(hit.x, 0.0);
        let tEnd = hit.y;
        if (tEnd <= tStart) { return vec4<f32>(0.0); }

        // Combine a few depth slices into one shaded proxy. Accumulating them as
        // march steps exposes horizontal strata in the intentionally coarse frame.
        let segment = tEnd - tStart;
        let p0 = V.camPos + rayDir * (tStart + segment * 0.30);
        let p1 = V.camPos + rayDir * (tStart + segment * 0.52);
        let p2 = V.camPos + rayDir * (tStart + segment * 0.74);
        let field0 = planarDensityAt(p0);
        let field1 = planarDensityAt(p1);
        let field2 = planarDensityAt(p2);
        let density = clamp(field0.x * 0.24 + field1.x * 0.52 + field2.x * 0.24, 0.0, 1.0);
        let weather = field1.yzw;
        let lightProbe = planarDensityAt(p1 + normalize(L.sunDir) * 0.22).x;
        let shadowColor = max(C.shadowLightColor, vec3<f32>(0.48, 0.54, 0.66));
        let lightColor = max(C.frontLightColor * 0.82, vec3<f32>(0.82, 0.85, 0.90));
        let sunUp = max(dot(normalize(L.sunDir), vec3<f32>(0.0, 1.0, 0.0)), 0.0);
        let lightEscape = clamp((density - lightProbe) * 1.8 + 0.45, 0.0, 1.0);
        let lightAmount = clamp(0.30 + weather.g * 0.22 + sunUp * 0.16 + lightEscape * 0.24, 0.0, 1.0);
        var color = mix(shadowColor, lightColor, lightAmount) * mix(1.22, 0.80, density);
        let silverEdge = smoothstep(0.035, 0.20, density) * (1.0 - smoothstep(0.34, 0.72, density));
        color = color + max(C.sunColor, vec3<f32>(0.8)) * silverEdge * (0.18 + lightEscape * 0.18);
        let alpha = clamp(smoothstep(0.015, 0.88, density) * 0.80, 0.0, 0.80);
        return vec4<f32>(color, alpha);
      }

      @compute @workgroup_size(8, 8, 1)
      fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
        if (gid.x >= frame.fullWidth || gid.y >= frame.fullHeight) { return; }
        let dims = vec2<f32>(max(f32(frame.fullWidth), 1.0), max(f32(frame.fullHeight), 1.0));
        let pixelUv = (vec2<f32>(gid.xy) + vec2<f32>(0.5)) / dims;

        if (V.planetRadius <= 0.001) {
          textureStore(outTex, vec2<i32>(gid.xy), frame.layerIndex, planarPreview(pixelUv));
          return;
        }

        let ndc = vec2<f32>(pixelUv.x * 2.0 - 1.0, 1.0 - pixelUv.y * 2.0);
        let tanHalf = tan(max(V.fovY, 0.001) * 0.5);
        let rayDir = normalize(V.fwd + V.right * (ndc.x * V.aspect * tanHalf) + V.up * (ndc.y * tanHalf));
        let outerRadius = V.planetRadius + max(V.cloudTop, V.cloudBottom + 0.01);
        let innerRadius = V.planetRadius + max(V.cloudBottom, 0.0);
        let b = dot(V.camPos, rayDir);
        let outerH = b * b - (dot(V.camPos, V.camPos) - outerRadius * outerRadius);
        if (outerH <= 0.0) {
          textureStore(outTex, vec2<i32>(gid.xy), frame.layerIndex, vec4<f32>(0.0));
          return;
        }

        let outerRoot = sqrt(outerH);
        var tStart = max(0.0, -b - outerRoot);
        var tEnd = -b + outerRoot;
        let innerH = b * b - (dot(V.camPos, V.camPos) - innerRadius * innerRadius);
        if (innerH > 0.0) {
          let innerNear = -b - sqrt(innerH);
          if (innerNear > tStart) { tEnd = min(tEnd, innerNear); }
        }
        if (tEnd <= tStart) {
          textureStore(outTex, vec2<i32>(gid.xy), frame.layerIndex, vec4<f32>(0.0));
          return;
        }

        let segment = tEnd - tStart;
        let stepLength = segment / 8.0;
        var alpha = 0.0;
        var color = vec3<f32>(0.0);
        for (var i = 0u; i < 8u; i = i + 1u) {
          let t = tStart + (f32(i) + 0.5) * stepLength;
          let p = V.camPos + rayDir * t;
          let height01 = clamp((length(p) - innerRadius) / max(outerRadius - innerRadius, 0.001), 0.0, 1.0);
          let density = bootstrapDensity(p, height01);
          let stepAlpha = 1.0 - exp(-density * stepLength * 1.10);
          let normal = normalize(p);
          let sun = clamp(dot(normal, normalize(L.sunDir)) * 0.5 + 0.5, 0.0, 1.0);
          let sampleColor = mix(C.shadowLightColor, C.frontLightColor * C.sunColor, 0.24 + sun * 0.76);
          color = color + (1.0 - alpha) * sampleColor * stepAlpha;
          alpha = alpha + (1.0 - alpha) * stepAlpha;
          if (alpha > 0.96) { break; }
        }
        textureStore(outTex, vec2<i32>(gid.xy), frame.layerIndex, vec4<f32>(color, clamp(alpha, 0.0, 1.0)));
      }
    `;
    const module = this.device.createShaderModule({ code });
    const descriptor = {
      layout: this._computePipelineLayout,
      compute: { module, entryPoint: "main" },
    };
    return { descriptor, format: fmt };
  }

  _ensureBootstrapComputePipeline(format = this.outFormat) {
    const fmt = format || this.outFormat;
    const cache = getCloudGpuCache(this.device).bootstrapComputeByFormat;
    const cached = cache.get(fmt);
    if (cached) return cached;
    const { descriptor } = this._createBootstrapComputePipelineSetup(fmt);
    const pipeline = this.device.createComputePipeline(descriptor);
    cache.set(fmt, pipeline);
    return pipeline;
  }

  async ensureBootstrapComputePipelineReadyAsync(format = this.outFormat) {
    const fmt = format || this.outFormat;
    const deviceCache = getCloudGpuCache(this.device);
    const cached = deviceCache.bootstrapComputeByFormat.get(fmt);
    if (cached) return cached;
    const existing = deviceCache.bootstrapComputePromises.get(fmt);
    if (existing) return existing;
    const { descriptor } = this._createBootstrapComputePipelineSetup(fmt);
    const pending = (async () => {
      const pipeline = typeof this.device.createComputePipelineAsync === "function"
        ? await this.device.createComputePipelineAsync(descriptor)
        : this.device.createComputePipeline(descriptor);
      const installed = deviceCache.bootstrapComputeByFormat.get(fmt);
      if (installed) return installed;
      deviceCache.bootstrapComputeByFormat.set(fmt, pipeline);
      return pipeline;
    })();
    deviceCache.bootstrapComputePromises.set(fmt, pending);
    try {
      return await pending;
    } finally {
      if (deviceCache.bootstrapComputePromises.get(fmt) === pending) {
        deviceCache.bootstrapComputePromises.delete(fmt);
      }
    }
  }

  encodeBootstrapPreviewPass(encoder) {
    if (!encoder || !this.outView) return null;
    this._writeCommonComputeUniforms();
    this._makeBindGroups();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this._ensureBootstrapComputePipeline(this.outFormat));
    pass.setBindGroup(0, this._currentBg0);
    pass.setBindGroup(1, this._currentBg1);
    pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8), Math.max(1, this.layers));
    pass.end();
    return { width: this.width, height: this.height, layers: this.layers };
  }

  async dispatchBootstrapPreview({ wait = false } = {}) {
    const encoder = this.device.createCommandEncoder();
    const encoded = this.encodeBootstrapPreviewPass(encoder);
    if (!encoded) throw new Error("dispatchBootstrapPreview: createOutputTexture/setOutputView first.");
    this.queue.submit([encoder.finish()]);
    if (wait && typeof this.queue.onSubmittedWorkDone === "function") {
      await this.queue.onSubmittedWorkDone();
    }
    this._lastHadWork = true;
    return this.outView;
  }

  _createBootstrapRenderPipelineSetup(format = "bgra8unorm") {
    const code = `
      @group(0) @binding(0) var samp: sampler;
      @group(0) @binding(1) var tex: texture_2d_array<f32>;

      struct VSOut {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
      };

      @vertex
      fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VSOut {
        var positions = array<vec2<f32>, 6>(
          vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
          vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
        );
        var uvs = array<vec2<f32>, 6>(
          vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 0.0),
          vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(1.0, 0.0)
        );
        var output: VSOut;
        output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
        output.uv = uvs[vertexIndex];
        return output;
      }

      @fragment
      fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
        let cloud = textureSampleLevel(tex, samp, input.uv, 0, 0.0);
        let alpha = clamp(cloud.a, 0.0, 1.0);
        let mapped = clamp(
          vec3<f32>(1.0) - exp(-max(cloud.rgb, vec3<f32>(0.0)) * 1.22),
          vec3<f32>(0.0),
          vec3<f32>(1.0)
        );
        return vec4<f32>(mapped * alpha, alpha);
      }
    `;
    const module = this.device.createShaderModule({ code });
    const bgl = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float", viewDimension: "2d-array" } },
      ],
    });
    const descriptor = {
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      vertex: { module, entryPoint: "vs_main" },
      fragment: {
        module,
        entryPoint: "fs_main",
        targets: [{
          format,
          blend: {
            color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
          },
        }],
      },
      primitive: { topology: "triangle-list" },
    };
    const sampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
    return { descriptor, bgl, sampler, format };
  }

  _ensureBootstrapRenderPipeline(format = "bgra8unorm") {
    const deviceCache = getCloudGpuCache(this.device);
    const cached = deviceCache.bootstrapPreviewByFormat.get(format);
    if (cached) return cached;
    const setup = this._createBootstrapRenderPipelineSetup(format);
    const pipeline = this.device.createRenderPipeline(setup.descriptor);
    const result = { pipeline, bgl: setup.bgl, sampler: setup.sampler, format };
    deviceCache.bootstrapPreviewByFormat.set(format, result);
    return result;
  }

  async ensureBootstrapRenderPipelineReadyAsync(format = "bgra8unorm") {
    const deviceCache = getCloudGpuCache(this.device);
    const cached = deviceCache.bootstrapPreviewByFormat.get(format);
    if (cached) return cached;
    const existing = deviceCache.bootstrapPreviewPromises.get(format);
    if (existing) return existing;
    const setup = this._createBootstrapRenderPipelineSetup(format);
    const pending = (async () => {
      const pipeline = typeof this.device.createRenderPipelineAsync === "function"
        ? await this.device.createRenderPipelineAsync(setup.descriptor)
        : this.device.createRenderPipeline(setup.descriptor);
      const installed = deviceCache.bootstrapPreviewByFormat.get(format);
      if (installed) return installed;
      const result = { pipeline, bgl: setup.bgl, sampler: setup.sampler, format };
      deviceCache.bootstrapPreviewByFormat.set(format, result);
      return result;
    })();
    deviceCache.bootstrapPreviewPromises.set(format, pending);
    try {
      return await pending;
    } finally {
      if (deviceCache.bootstrapPreviewPromises.get(format) === pending) {
        deviceCache.bootstrapPreviewPromises.delete(format);
      }
    }
  }

  encodeBootstrapRenderPass(encoder, targetView, {
    format = "bgra8unorm",
    clearValue = { r: 0.5, g: 0.6, b: 0.8, a: 1.0 },
  } = {}) {
    if (!encoder || !targetView || !this.outView) return false;
    const { pipeline, bgl, sampler } = this._ensureBootstrapRenderPipeline(format);
    let bindGroup = this._bootstrapRenderBgCache.get(this.outView);
    if (!bindGroup) {
      bindGroup = this.device.createBindGroup({
        layout: bgl,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: this.outView },
        ],
      });
      this._bootstrapRenderBgCache.set(this.outView, bindGroup);
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: targetView,
        loadOp: "clear",
        clearValue,
        storeOp: "store",
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6, 1, 0, 0);
    pass.end();
    return true;
  }

  _destroyDummyHistory() {
    const prev = this._dummyHistoryPrev;
    const out = this._dummyHistoryOut;

    this._dummyHistoryPrev = null;
    this._dummyHistoryPrevView = null;
    this._dummyHistoryOut = null;
    this._dummyHistoryOutView = null;

    try {
      if (prev) this._retireTexture(prev);
    } catch (_) {}
    try {
      if (out) this._retireTexture(out);
    } catch (_) {}
  }

  _createDummyHistory() {
    const d = this.device;
    const histDesc = {
      size: [1, 1, 1],
      format: this.outFormat,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.STORAGE_BINDING,
    };
    this._dummyHistoryPrev = d.createTexture(histDesc);
    this._dummyHistoryPrevView = this._dummyHistoryPrev.createView({
      dimension: "2d-array",
      arrayLayerCount: 1,
    });
    this._dummyHistoryOut = d.createTexture(histDesc);
    this._dummyHistoryOutView = this._dummyHistoryOut.createView({
      dimension: "2d-array",
      arrayLayerCount: 1,
    });
    this.queue.writeTexture(
      { texture: this._dummyHistoryPrev },
      new Float32Array([0, 0, 0, 0]),
      { bytesPerRow: 4 * 4 },
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    );
    this.queue.writeTexture(
      { texture: this._dummyHistoryOut },
      new Float32Array([0, 0, 0, 0]),
      { bytesPerRow: 4 * 4 },
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    );
  }

  // -------------------- init compute + resources --------------------
  _initCompute() {
    const d = this.device;
    const deviceCache = getCloudGpuCache(d);
    if (!deviceCache.module) {
      const started = performance.now();
      const code = commonWGSL + "\n" + scratchWGSL + "\n" + layerWGSL + "\n" + resolveWGSL + "\n" + INLINE_LAYER_OUTPUT;
      deviceCache.module = d.createShaderModule({ label: "cloud-raymarch", code });
      const timing = deviceCache.moduleTiming = {
        sourceBytes: code.length,
        createMs: performance.now() - started,
        validationMs: null,
        status: "created",
      };
      if (typeof deviceCache.module.getCompilationInfo === "function") {
        const validationStarted = performance.now();
        deviceCache.module.getCompilationInfo().then(info => {
          timing.validationMs = performance.now() - validationStarted;
          const errors = info.messages.filter(message => message.type === "error");
          timing.status = errors.length ? "error" : "validated";
          if (errors.length) timing.error = errors.map(message => message.message).join("\n");
        }).catch(error => {
          timing.validationMs = performance.now() - validationStarted;
          timing.status = "error";
          timing.error = String(error?.message || error);
        });
      }
    }
    this.module = deviceCache.module;

    // group(1) must match updated shader:
    // 0 weather2D, 1 samp2D, 2 shape3D, 3 sampShape, 4 blueTex, 5 sampBN, 6 detail3D, 7 sampDetail,
    // 8 L, 9 V, 10 B, 11 historyPrev, 13 motionTex, 15 depthPrev
    if (!deviceCache.bgl1) {
      deviceCache.bgl1 = d.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "2d-array" },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            sampler: { type: "filtering" },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "3d" },
          },
          {
            binding: 3,
            visibility: GPUShaderStage.COMPUTE,
            sampler: { type: "filtering" },
          },
          {
            binding: 4,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "2d-array" },
          },
          {
            binding: 5,
            visibility: GPUShaderStage.COMPUTE,
            sampler: { type: "filtering" },
          },
          {
            binding: 6,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "3d" },
          },
          {
            binding: 7,
            visibility: GPUShaderStage.COMPUTE,
            sampler: { type: "filtering" },
          },
          {
            binding: 8,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" },
          },
          {
            binding: 9,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" },
          },
          {
            binding: 10,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" },
          },
          {
            binding: 11,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "2d-array" },
          },
          {
            binding: 13,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "2d" },
          },
          {
            binding: 15,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "2d" },
          },
        ],
      });
    }
    this.bgl1 = deviceCache.bgl1;


    // samplers (shader uses manual wrap helpers anyway, keep repeat for maps)
    if (!deviceCache.samplers) {
      deviceCache.samplers = {
        samp2D: d.createSampler({
          magFilter: "linear",
          minFilter: "linear",
          mipmapFilter: "linear",
          addressModeU: "repeat",
          addressModeV: "repeat",
        }),
        sampShape: d.createSampler({
          magFilter: "linear",
          minFilter: "linear",
          mipmapFilter: "linear",
          addressModeU: "repeat",
          addressModeV: "repeat",
          addressModeW: "repeat",
        }),
        sampDetail: d.createSampler({
          magFilter: "linear",
          minFilter: "linear",
          mipmapFilter: "linear",
          addressModeU: "repeat",
          addressModeV: "repeat",
          addressModeW: "repeat",
        }),
        sampBN: d.createSampler({
          magFilter: "linear",
          minFilter: "linear",
          mipmapFilter: "linear",
          addressModeU: "repeat",
          addressModeV: "repeat",
        }),
      };
    }
    this._samp2D = deviceCache.samplers.samp2D;
    this._sampShape = deviceCache.samplers.sampShape;
    this._sampDetail = deviceCache.samplers.sampDetail;
    this._sampBN = deviceCache.samplers.sampBN;

    // dummy motion/depth textures
    const tex2Desc = {
      size: [1, 1, 1],
      format: "r8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    };
    this._dummy2DMotion = d.createTexture(tex2Desc);
    this._dummy2DMotionView = this._dummy2DMotion.createView({
      dimension: "2d",
    });
    this._dummy2DDepth = d.createTexture(tex2Desc);
    this._dummy2DDepthView = this._dummy2DDepth.createView({ dimension: "2d" });
    this.queue.writeTexture(
      { texture: this._dummy2DMotion },
      // Motion is decoded as a direct pixel/UV offset, not a signed UNORM.
      // 128 meant a half-pixel horizontal shift on every stationary frame.
      new Uint8Array([0]),
      { bytesPerRow: 1 },
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    );
    this.queue.writeTexture(
      { texture: this._dummy2DDepth },
      new Uint8Array([128]),
      { bytesPerRow: 1 },
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    );

    this._ensureComputeFormat(this.outFormat);
  }

  _initBuffers() {
    const d = this.device;

    this.optionsBuffer = d.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.paramsBuffer = d.createBuffer({
      size: this._abParams.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.nTransformBuffer = d.createBuffer({
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.posBuffer = d.createBuffer({
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.frameBuffer = d.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.lightBuffer = d.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.viewBuffer = d.createBuffer({
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.boxBuffer = d.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.reprojBuffer = d.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.perfBuffer = d.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.tuningBuffer = d.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });


    this.renderParams = d.createBuffer({
      size: this._abRender.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this._upsampleParamsBuffer = d.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  // -------------------- UBO setters --------------------
  setOptions(opts = {}) {
    if (typeof opts.planetStyleMode === 'boolean') this._planetStyleMode = opts.planetStyleMode;
    const s = this._state.options;

    if (_has(opts, "useCustomPos")) s.useCustomPos = !!opts.useCustomPos;
    if (_has(opts, "outputChannel"))
      s.outputChannel = opts.outputChannel >>> 0 || 0;
    if (_has(opts, "writeRGB")) s.writeRGB = !!opts.writeRGB;

    // Accept either r0..r3, or legacy names mapped into _r0.._r3.
    // r0 >= 0.5 enables spherical shell marching in clouds.wgsl.
    if (_has(opts, "sphericalMode")) s.r0 = opts.sphericalMode ? 1.0 : 0.0;
    else if (_has(opts, "r0")) s.r0 = +opts.r0 || 0.0;
    else if (_has(opts, "debugForceFog")) s.r0 = +opts.debugForceFog || 0.0;

    if (_has(opts, "r1")) s.r1 = +opts.r1 || 0.0;
    else if (_has(opts, "temporalSeed")) s.r1 = +opts.temporalSeed || 0.0;

    if (_has(opts, "r2")) s.r2 = +opts.r2 || 0.0;
    else if (_has(opts, "windDisp")) s.r2 = +opts.windDisp || 0.0;

    if (_has(opts, "r3")) s.r3 = +opts.r3 || 0.0;
    else if (_has(opts, "windAngleRad")) s.r3 = +opts.windAngleRad || 0.0;

    const dv = this._dvOptions;
    dv.setUint32(0, s.useCustomPos ? 1 : 0, true);
    dv.setUint32(4, s.outputChannel >>> 0, true);
    dv.setUint32(8, s.writeRGB ? 1 : 0, true);
    dv.setUint32(12, 0, true);
    dv.setFloat32(16, s.r0, true);
    dv.setFloat32(20, s.r1, true);
    dv.setFloat32(24, s.r2, true);
    dv.setFloat32(28, s.r3, true);

    this._writeIfChanged("options", this.optionsBuffer, this._abOptions);
  }

  setTemporalSeed(seed = 0) {
    this.setOptions({ r1: seed });
  }

  setParams(p = {}) {
    const s = this._state.params;

    if (_has(p, "globalCoverage")) s.globalCoverage = +p.globalCoverage;
    if (_has(p, "globalDensity")) s.globalDensity = +p.globalDensity;
    if (_has(p, "cloudAnvilAmount")) s.cloudAnvilAmount = +p.cloudAnvilAmount;
    if (_has(p, "cloudBeer")) s.cloudBeer = +p.cloudBeer;

    if (_has(p, "attenuationClamp")) s.attenuationClamp = +p.attenuationClamp;
    if (_has(p, "inScatterG")) s.inScatterG = +p.inScatterG;
    if (_has(p, "silverIntensity")) s.silverIntensity = +p.silverIntensity;
    if (_has(p, "silverExponent")) s.silverExponent = +p.silverExponent;

    if (_has(p, "outScatterG")) s.outScatterG = +p.outScatterG;
    if (_has(p, "inVsOut")) s.inVsOut = +p.inVsOut;
    if (_has(p, "outScatterAmbientAmt"))
      s.outScatterAmbientAmt = +p.outScatterAmbientAmt;
    if (_has(p, "ambientMinimum")) s.ambientMinimum = +p.ambientMinimum;

    if (_has(p, "sunColor")) {
      const sc = p.sunColor || [1, 1, 1];
      s.sunColor = [+(sc[0] ?? 1), +(sc[1] ?? 1), +(sc[2] ?? 1)];
    }
    if (_has(p, "frontLightColor")) {
      const fc = p.frontLightColor || [1, 1, 1];
      s.frontLightColor = [+(fc[0] ?? 1), +(fc[1] ?? 1), +(fc[2] ?? 1)];
    }
    if (_has(p, "shadowLightColor")) {
      const sh = p.shadowLightColor || [0.62, 0.68, 0.78];
      s.shadowLightColor = [+(sh[0] ?? 0.62), +(sh[1] ?? 0.68), +(sh[2] ?? 0.78)];
    }

    if (_has(p, "densityDivMin")) s.densityDivMin = +p.densityDivMin;
    if (_has(p, "silverDirectionBias"))
      s.silverDirectionBias = +p.silverDirectionBias;
    if (_has(p, "silverHorizonBoost"))
      s.silverHorizonBoost = +p.silverHorizonBoost;

    const dv = this._dvParams;

    // 0..47
    dv.setFloat32(0, s.globalCoverage, true);
    dv.setFloat32(4, s.globalDensity, true);
    dv.setFloat32(8, s.cloudAnvilAmount, true);
    dv.setFloat32(12, s.cloudBeer, true);

    dv.setFloat32(16, s.attenuationClamp, true);
    dv.setFloat32(20, s.inScatterG, true);
    dv.setFloat32(24, s.silverIntensity, true);
    dv.setFloat32(28, s.silverExponent, true);

    dv.setFloat32(32, s.outScatterG, true);
    dv.setFloat32(36, s.inVsOut, true);
    dv.setFloat32(40, s.outScatterAmbientAmt, true);
    dv.setFloat32(44, s.ambientMinimum, true);

    // sunColor vec3 + pad
    dv.setFloat32(48, s.sunColor[0], true);
    dv.setFloat32(52, s.sunColor[1], true);
    dv.setFloat32(56, s.sunColor[2], true);
    dv.setFloat32(60, 0.0, true);

    // tail
    dv.setFloat32(64, s.densityDivMin, true);
    dv.setFloat32(68, s.silverDirectionBias, true);
    dv.setFloat32(72, s.silverHorizonBoost, true);
    dv.setFloat32(76, 0.0, true);

    dv.setFloat32(80, s.frontLightColor[0], true);
    dv.setFloat32(84, s.frontLightColor[1], true);
    dv.setFloat32(88, s.frontLightColor[2], true);
    dv.setFloat32(92, 0.0, true);

    dv.setFloat32(96, s.shadowLightColor[0], true);
    dv.setFloat32(100, s.shadowLightColor[1], true);
    dv.setFloat32(104, s.shadowLightColor[2], true);
    dv.setFloat32(108, 0.0, true);

    this._writeIfChanged("params", this.paramsBuffer, this._abParams);
  }

  _retireTexture(tex) {
    if (!tex || typeof tex.destroy !== "function") return;
    if (!this._retiredTextures) this._retiredTextures = [];
    this._retiredTextures.push(tex);

    if (this._retireFlushPromise) return;
    if (typeof this.queue.onSubmittedWorkDone !== "function") {
      const list = this._retiredTextures.splice(0);
      for (const t of list) {
        try {
          t.destroy();
        } catch (_) {}
      }
      return;
    }

    this._retireFlushPromise = this.queue
      .onSubmittedWorkDone()
      .then(() => {
        this._retireFlushPromise = null;
        const list = this._retiredTextures.splice(0);
        for (const t of list) {
          try {
            t.destroy();
          } catch (_) {}
        }
      })
      .catch(() => {
        this._retireFlushPromise = null;
      });
  }

  // NoiseTransforms (binding 3)
  setNoiseTransforms(v = {}) {
    const s = this._state.ntransform;

    const v3 = (a, d0, d1, d2) => [
      +(a?.[0] ?? d0),
      +(a?.[1] ?? d1),
      +(a?.[2] ?? d2),
    ];

    if (_has(v, "shapeOffsetWorld"))
      s.shapeOffsetWorld = v3(v.shapeOffsetWorld, 0, 0, 0);
    if (_has(v, "detailOffsetWorld"))
      s.detailOffsetWorld = v3(v.detailOffsetWorld, 0, 0, 0);
    if (_has(v, "shapeScale")) s.shapeScale = +v.shapeScale;
    if (_has(v, "detailScale")) s.detailScale = +v.detailScale;
    if (_has(v, "weatherScale")) s.weatherScale = +v.weatherScale;

    if (_has(v, "shapeAxisScale"))
      s.shapeAxisScale = v3(v.shapeAxisScale, 1, 1, 1);
    if (_has(v, "detailAxisScale"))
      s.detailAxisScale = v3(v.detailAxisScale, 1, 1, 1);
    if (_has(v, "weatherOffsetWorld"))
      s.weatherOffsetWorld = v3(v.weatherOffsetWorld, 0, 0, 0);
    if (_has(v, "weatherAxisScale"))
      s.weatherAxisScale = v3(v.weatherAxisScale, 1, 1, 1);
    if (_has(v, "shapeBias")) s.shapeBias = +v.shapeBias;
    if (_has(v, "detailBias")) s.detailBias = +v.detailBias;
    if (_has(v, "weatherBias")) s.weatherBias = +v.weatherBias;

    const dv = this._dvNTransform;

    // shapeOffsetWorld (0..15)
    dv.setFloat32(0, s.shapeOffsetWorld[0] || 0.0, true);
    dv.setFloat32(4, s.shapeOffsetWorld[1] || 0.0, true);
    dv.setFloat32(8, s.shapeOffsetWorld[2] || 0.0, true);
    dv.setFloat32(12, 0.0, true);

    // detailOffsetWorld (16..31)
    dv.setFloat32(16, s.detailOffsetWorld[0] || 0.0, true);
    dv.setFloat32(20, s.detailOffsetWorld[1] || 0.0, true);
    dv.setFloat32(24, s.detailOffsetWorld[2] || 0.0, true);
    dv.setFloat32(28, 0.0, true);

    // shapeScale, detailScale, weatherScale, pad (32..47)
    dv.setFloat32(32, +s.shapeScale || 0.0, true);
    dv.setFloat32(36, +s.detailScale || 0.0, true);
    dv.setFloat32(40, +s.weatherScale || 0.0, true);
    dv.setFloat32(44, 0.0, true);

    // shapeAxisScale (48..63)
    dv.setFloat32(48, s.shapeAxisScale[0] || 1.0, true);
    dv.setFloat32(52, s.shapeAxisScale[1] || 1.0, true);
    dv.setFloat32(56, s.shapeAxisScale[2] || 1.0, true);
    dv.setFloat32(60, 0.0, true);

    // detailAxisScale (64..79)
    dv.setFloat32(64, s.detailAxisScale[0] || 1.0, true);
    dv.setFloat32(68, s.detailAxisScale[1] || 1.0, true);
    dv.setFloat32(72, s.detailAxisScale[2] || 1.0, true);
    dv.setFloat32(76, 0.0, true);

    // weatherOffsetWorld (80..95)
    dv.setFloat32(80, s.weatherOffsetWorld[0] || 0.0, true);
    dv.setFloat32(84, s.weatherOffsetWorld[1] || 0.0, true);
    dv.setFloat32(88, s.weatherOffsetWorld[2] || 0.0, true);
    dv.setFloat32(92, 0.0, true);

    // weatherAxisScale (96..111)
    dv.setFloat32(96, s.weatherAxisScale[0] || 1.0, true);
    dv.setFloat32(100, s.weatherAxisScale[1] || 1.0, true);
    dv.setFloat32(104, s.weatherAxisScale[2] || 1.0, true);
    dv.setFloat32(108, 0.0, true);

    // shapeBias, detailBias, weatherBias, pad (112..127)
    dv.setFloat32(112, +s.shapeBias || 0.0, true);
    dv.setFloat32(116, +s.detailBias || 0.0, true);
    dv.setFloat32(120, +s.weatherBias || 0.0, true);
    dv.setFloat32(124, 0.0, true);

    this._writeIfChanged(
      "ntransform",
      this.nTransformBuffer,
      this._abNTransform,
    );
  }

  // Back-compat alias
  setTileScaling(v = {}) {
    this.setNoiseTransforms(v);
  }

  setReprojSettings(v = {}) {
    const s = this._state.reproj;

    if (_has(v, "enabled")) s.enabled = v.enabled >>> 0;
    if (_has(v, "subsample")) s.subsample = v.subsample >>> 0;
    if (_has(v, "sampleOffset")) s.sampleOffset = v.sampleOffset >>> 0;
    if (_has(v, "motionIsNormalized"))
      s.motionIsNormalized = v.motionIsNormalized >>> 0;
    if (_has(v, "temporalBlend")) s.temporalBlend = +v.temporalBlend;
    if (_has(v, "depthTest")) s.depthTest = v.depthTest >>> 0;
    if (_has(v, "depthTolerance")) s.depthTolerance = +v.depthTolerance;
    if (_has(v, "frameIndex")) s.frameIndex = v.frameIndex >>> 0;
    if (_has(v, "fullWidth")) s.fullWidth = v.fullWidth >>> 0;
    if (_has(v, "fullHeight")) s.fullHeight = v.fullHeight >>> 0;
    if (_has(v, "temporalCellRate")) s.temporalCellRate = normalizeTemporalRate(v.temporalCellRate);
    if (_has(v, "temporalCellPhase")) s.temporalCellPhase = Math.max(0, v.temporalCellPhase | 0);
    if (_has(v, "compactInterleave")) s.compactInterleave = v.compactInterleave ? 1 : 0;

    s.temporalCellRate = normalizeTemporalRate(s.temporalCellRate);
    if (s.temporalCellRate <= 1) s.temporalCellPhase = 0;
    else s.temporalCellPhase = s.temporalCellPhase % s.temporalCellRate;

    const dv = this._dvReproj;
    dv.setUint32(0, s.enabled >>> 0, true);
    dv.setUint32(4, s.subsample >>> 0, true);
    dv.setUint32(8, s.sampleOffset >>> 0, true);
    dv.setUint32(12, s.motionIsNormalized >>> 0, true);
    dv.setFloat32(16, s.temporalBlend, true);
    dv.setUint32(20, s.depthTest >>> 0, true);
    dv.setFloat32(24, s.depthTolerance, true);
    dv.setUint32(28, s.frameIndex >>> 0, true);
    dv.setUint32(32, s.fullWidth >>> 0, true);
    dv.setUint32(36, s.fullHeight >>> 0, true);
    dv.setUint32(40, s.temporalCellRate >>> 0, true);
    dv.setUint32(44, s.temporalCellPhase >>> 0, true);
    dv.setUint32(48, s.compactInterleave ? 1 : 0, true);
    dv.setUint32(52, 0, true);
    dv.setUint32(56, 0, true);
    dv.setUint32(60, 0, true);

    this._reprojFullW = s.fullWidth | 0;
    this._reprojFullH = s.fullHeight | 0;

    this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
  }


  setPerfParams(v = {}) {
    const s = this._state.perf;
    if (_has(v, "lodBiasMul")) s.lodBiasMul = +v.lodBiasMul;
    if (_has(v, "coarseMipBias")) s.coarseMipBias = +v.coarseMipBias;

    const dv = this._dvPerf;
    dv.setFloat32(0, s.lodBiasMul, true);
    dv.setFloat32(4, s.coarseMipBias, true);
    dv.setFloat32(8, 0.0, true);
    dv.setFloat32(12, 0.0, true);

    this._writeIfChanged("perf", this.perfBuffer, this._abPerf);
  }

  setLight(v = {}) {
    const s = this._state.light;
    if (_has(v, "sunDir")) {
      const a = v.sunDir || [0, 1, 0];
      s.sunDir = [+(a[0] ?? 0), +(a[1] ?? 1), +(a[2] ?? 0)];
    }
    if (_has(v, "camPos")) {
      const a = v.camPos || [0, 0, 2];
      s.camPos = [+(a[0] ?? 0), +(a[1] ?? 0), +(a[2] ?? 2)];
    }

    const dv = this._dvLight;
    dv.setFloat32(0, s.sunDir[0], true);
    dv.setFloat32(4, s.sunDir[1], true);
    dv.setFloat32(8, s.sunDir[2], true);
    dv.setFloat32(12, 0.0, true);
    dv.setFloat32(16, s.camPos[0], true);
    dv.setFloat32(20, s.camPos[1], true);
    dv.setFloat32(24, s.camPos[2], true);
    dv.setFloat32(28, 0.0, true);

    this._writeIfChanged("light", this.lightBuffer, this._abLight);
  }

  setSunByAngles({
    azimuthDeg = 45,
    elevationDeg = 35,
    camPos = [0, 0, 2],
  } = {}) {
    const az = (azimuthDeg * Math.PI) / 180;
    const el = (elevationDeg * Math.PI) / 180;
    const sd = [
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az),
    ];
    this.setLight({ sunDir: sd, camPos });
  }

  setBox(v = {}) {
    const s = this._state.box;
    const prevKey = `${s.center[0]},${s.center[1]},${s.center[2]}|${s.half[0]},${s.half[1]},${s.half[2]}|${s.uvScale}`;
    if (_has(v, "center")) {
      const a = v.center || [0, 0, 0];
      s.center = [+(a[0] ?? 0), +(a[1] ?? 0), +(a[2] ?? 0)];
    }
    if (_has(v, "half")) {
      const a = v.half || [1, 0.6, 1];
      s.half = [+(a[0] ?? 1), +(a[1] ?? 0.6), +(a[2] ?? 1)];
    }
    if (_has(v, "uvScale")) s.uvScale = +v.uvScale;

    const dv = this._dvBox;
    dv.setFloat32(0, s.center[0], true);
    dv.setFloat32(4, s.center[1], true);
    dv.setFloat32(8, s.center[2], true);
    dv.setFloat32(12, 0.0, true);
    dv.setFloat32(16, s.half[0], true);
    dv.setFloat32(20, s.half[1], true);
    dv.setFloat32(24, s.half[2], true);
    dv.setFloat32(28, s.uvScale, true);

    this._writeIfChanged("box", this.boxBuffer, this._abBox);
    const nextKey = `${s.center[0]},${s.center[1]},${s.center[2]}|${s.half[0]},${s.half[1]},${s.half[2]}|${s.uvScale}`;
  }

  setFrame(v = {}) {
    const dv = this._dvFrame;

    const prev = {
      fullWidth: dv.getUint32(0, true),
      fullHeight: dv.getUint32(4, true),
      tileWidth: dv.getUint32(8, true),
      tileHeight: dv.getUint32(12, true),
      originX: dv.getInt32(16, true),
      originY: dv.getInt32(20, true),
      originZ: dv.getInt32(24, true),
      fullDepth: dv.getUint32(28, true),
      tileDepth: dv.getUint32(32, true),
      layerIndex: dv.getInt32(36, true),
      layers: dv.getUint32(40, true),
      originXf: dv.getFloat32(48, true),
      originYf: dv.getFloat32(52, true),
    };

    const fullWidth = _has(v, "fullWidth") ? v.fullWidth >>> 0 : prev.fullWidth;
    const fullHeight = _has(v, "fullHeight")
      ? v.fullHeight >>> 0
      : prev.fullHeight;
    const tileWidth = _has(v, "tileWidth") ? v.tileWidth >>> 0 : prev.tileWidth;
    const tileHeight = _has(v, "tileHeight")
      ? v.tileHeight >>> 0
      : prev.tileHeight;

    const originX = _has(v, "originX") ? v.originX | 0 : prev.originX;
    const originY = _has(v, "originY") ? v.originY | 0 : prev.originY;
    const originZ = _has(v, "originZ") ? v.originZ | 0 : prev.originZ;

    const defaultLayers =
      ((this.layers | 0) > 0
        ? this.layers | 0
        : (prev.layers | 0) > 0
          ? prev.layers | 0
          : 1) >>> 0;

    const layers = _has(v, "layers")
      ? v.layers >>> 0
      : prev.layers >>> 0 || defaultLayers;

    const fullDepth = _has(v, "fullDepth")
      ? v.fullDepth >>> 0
      : prev.fullDepth >>> 0 || 1;

    const tileDepth = _has(v, "tileDepth")
      ? v.tileDepth >>> 0
      : prev.tileDepth >>> 0 || 1;

    const layerIndex = _has(v, "layerIndex")
      ? v.layerIndex | 0
      : prev.layerIndex;

    const originXf = _has(v, "originXf") ? +(v.originXf ?? 0.0) : prev.originXf;
    const originYf = _has(v, "originYf") ? +(v.originYf ?? 0.0) : prev.originYf;

    dv.setUint32(0, fullWidth >>> 0, true);
    dv.setUint32(4, fullHeight >>> 0, true);
    dv.setUint32(8, tileWidth >>> 0, true);
    dv.setUint32(12, tileHeight >>> 0, true);
    dv.setInt32(16, originX | 0, true);
    dv.setInt32(20, originY | 0, true);
    dv.setInt32(24, originZ | 0, true);
    dv.setUint32(28, fullDepth >>> 0, true);
    dv.setUint32(32, tileDepth >>> 0, true);
    dv.setInt32(36, layerIndex | 0, true);
    dv.setUint32(40, layers >>> 0, true);
    dv.setUint32(44, 0, true);
    dv.setFloat32(48, originXf, true);
    dv.setFloat32(52, originYf, true);
    dv.setFloat32(56, 0.0, true);
    dv.setFloat32(60, 0.0, true);

    this._writeIfChanged("frame", this.frameBuffer, this._abFrame);

    const w = tileWidth || fullWidth;
    const h = tileHeight || fullHeight;
    if (w && h) {
      this._wgX = Math.max(1, Math.ceil(w / 8));
      this._wgY = Math.max(1, Math.ceil(h / 8));
    }
  }

  setLayerIndex(i) {
    this._dvFrame.setInt32(36, i | 0, true);
    this._writeIfChanged("frame", this.frameBuffer, this._abFrame);
  }

  setViewFromCamera(opts = {}) {
    const {
      camPos = [0, 0, 3],
      right = [1, 0, 0],
      up = [0, 1, 0],
      fwd = [0, 0, 1],
      fovYDeg = 60,
      aspect,
      planetRadius = 0.0,
      cloudBottom = -1.0,
      cloudTop = 1.0,
      worldToUV = 1.0,
      stepBase = 0.02,
      stepInc = 0.04,
      volumeLayers = 1,
      viewExtraA = 0.0,
      viewExtraB = 0.0,
      viewExtraC = 0.0,
      aircraft = {},
    } = opts;

    const dv = this._dvView;

    const norm = (v) => {
      const L = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / L, v[1] / L, v[2] / L];
    };

    const f = norm(fwd);
    const u0 = norm(up);
    const r = norm([
      u0[1] * f[2] - u0[2] * f[1],
      u0[2] * f[0] - u0[0] * f[2],
      u0[0] * f[1] - u0[1] * f[0],
    ]);
    const u = [
      f[1] * r[2] - f[2] * r[1],
      f[2] * r[0] - f[0] * r[2],
      f[0] * r[1] - f[1] * r[0],
    ];

    let a = +aspect;
    if (!(a > 0)) {
      const w = this.width | 0;
      const h = this.height | 0;
      a = w > 0 && h > 0 ? w / h : 1.0;
    }

    const floats = [
      camPos[0],
      camPos[1],
      camPos[2],
      aircraft.enabled ? 1 : 0,
      r[0],
      r[1],
      r[2],
      aircraft.bank || 0,
      u[0],
      u[1],
      u[2],
      aircraft.pitch || 0,
      f[0],
      f[1],
      f[2],
      0,
      (fovYDeg * Math.PI) / 180,
      a,
      stepBase,
      stepInc,
      planetRadius,
      cloudBottom,
      cloudTop,
      volumeLayers,
      worldToUV,
      viewExtraA,
      viewExtraB,
      viewExtraC,
      aircraft.position?.[0] ?? camPos[0]+f[0]*2.4-u[0]*.55,
      aircraft.position?.[1] ?? camPos[1]+f[1]*2.4-u[1]*.55,
      aircraft.position?.[2] ?? camPos[2]+f[2]*2.4-u[2]*.55,
      aircraft.yaw || 0,
    ];

    for (let i = 0; i < floats.length; i++)
      dv.setFloat32(i * 4, floats[i], true);
    this._writeIfChanged("view", this.viewBuffer, this._abView);
  }

  // -------------------- TUNE setter (CloudTuning) --------------------
  setTuning(t = {}) {
    const s = this._state.tuning;
    for (const k in t) if (_has(t, k)) s[k] = t[k];

    const dv = this._dvTuning;
    const putI = (ofs, v) => dv.setInt32(ofs, v | 0, true);
    const putF = (ofs, v) => dv.setFloat32(ofs, Number.isFinite(+v) ? +v : 0.0, true);

    // Keep this layout in 16-byte rows to match the WGSL CloudTuning struct.
    putI(0, s.maxSteps);
    putI(4, s.sunSteps);
    putI(8, s.sunStride);
    putI(12, s.lightingFinish || 0);

    putF(16, s.minStep);
    putF(20, s.maxStep);
    putF(24, s.sunMinTr);
    putF(28, s.phaseJitter);

    putF(32, s.stepJitter);
    putF(36, s.baseJitterFrac);
    putF(40, s.topJitterFrac);
    putF(44, s.lodBiasWeather);

    putF(48, s.aabbFaceOffset);
    putF(52, s.weatherRejectGate);
    putF(56, s.weatherRejectMip);
    putF(60, s.emptySkipMult);

    putF(64, s.nearFluffDist);
    putF(68, s.nearStepScale);
    putF(72, s.nearLodBias);
    putF(76, s.nearDensityMult);

    putF(80, s.nearDensityRange);
    putF(84, s.lodBlendThreshold);
    putF(88, s.sunDensityGate);
    putF(92, s.fflyRelClamp);

    putF(96, s.fflyAbsFloor);
    putF(100, s.taaRelMin);
    putF(104, s.taaRelMax);
    putF(108, s.taaAbsEps);

    putF(112, s.farStart);
    putF(116, s.farFull);
    putF(120, s.farLodPush);
    putF(124, s.farDetailAtten);

    putF(128, s.farStepMult);
    putF(132, s.bnFarScale);
    putF(136, s.farTaaHistoryBoost);
    putF(140, s.raySmoothDens);

    putF(144, s.raySmoothSun);
    putF(148, s.fluffFactor);
    putF(152, s.anvilLift);
    putF(156, s.alphaCutoff);

    putF(160, s.thickBoxPerf);
    putF(164, s.thickStepBoost);
    putF(168, s.thickDetailSkip);
    putF(172, s.thickLightSkip);

    putF(176, s.verticalStepBoost ?? 3.0);
    putF(180, s.verticalTextureHomogeneity ?? 0.0);
    putF(184, s.verticalLightingStepBoost ?? 1.35);
    putF(188, s.frontOcclusionStrength ?? 0.72);

    putF(192, s.frontOcclusionAlpha ?? 0.66);
    putF(196, s.frontOcclusionStepBoost ?? 3.0);
    putF(200, s.sliceJitterStrength ?? 0.08);
    putF(204, s.verticalLayerDecorrelation ?? 0.35);

    putF(208, s.directLightBlend ?? 0.78);
    putF(212, s.directLightBoost ?? 0.58);
    putF(216, s.alphaBoostThreshold ?? 0.20);
    putF(220, s.alphaBoostAmount ?? 0.14);
    putF(224, s.minOutputAlpha ?? 0.12);
    putF(228, s.outputAlphaFeather ?? 0.50);
    putF(232, s.sparsity ?? 0.42);
    putF(236, s.definition ?? 0.62);

    putF(240, Math.max(0, Math.min(7, s.formType ?? 0)));
    putF(244, Math.max(0.75, s.puffScale ?? 3.6));
    putF(248, Math.max(0, Math.min(1, s.aoStrength ?? 0)));
    putF(252, Math.max(0, Math.min(0.9, s.towerHeightVariation ?? 0.35)));

    this._writeIfChanged("tuning", this.tuningBuffer, this._abTuning);
  }

  // -------------------- input maps and history hooks --------------------
  setInputMaps({
    weatherView,
    shape3DView,
    detail3DView,
    blueTex,
    blueView,
    motionView,
    depthPrevView,
    historyPrevView,
    historyOutView,
  } = {}) {
    let bg1Changed = false;
    let bg0Changed = false;

    if (
      typeof weatherView !== "undefined" &&
      weatherView !== this.weatherView
    ) {
      this.weatherView = weatherView;
      bg1Changed = true;
    }
    if (
      typeof shape3DView !== "undefined" &&
      shape3DView !== this.shape3DView
    ) {
      this.shape3DView = shape3DView;
      bg1Changed = true;
    }
    if (
      typeof detail3DView !== "undefined" &&
      detail3DView !== this.detail3DView
    ) {
      this.detail3DView = detail3DView;
      bg1Changed = true;
    }

    if (typeof blueTex !== "undefined" && blueTex !== this.blueTex) {
      if (this._ownsBlue && this.blueTex && this.blueTex !== blueTex) {
        try {
          this._retireTexture(this.blueTex);
        } catch (_) {}
      }
      this.blueTex = blueTex || null;
      this._ownsBlue = false;
      if (typeof blueView === "undefined") this.blueView = null;
      bg1Changed = true;
    }

    if (typeof blueView !== "undefined" && blueView !== this.blueView) {
      this.blueView = blueView || null;
      bg1Changed = true;
    }

    if (typeof motionView !== "undefined" && motionView !== this.motionView) {
      this.motionView = motionView;
      bg1Changed = true;
    }
    if (
      typeof depthPrevView !== "undefined" &&
      depthPrevView !== this.depthPrevView
    ) {
      this.depthPrevView = depthPrevView;
      bg1Changed = true;
    }
    if (
      typeof historyPrevView !== "undefined" &&
      historyPrevView !== this.historyPrevView
    ) {
      this.historyPrevView = historyPrevView;
      bg1Changed = true;
    }

    if (
      typeof historyOutView !== "undefined" &&
      historyOutView !== this.historyOutView
    ) {
      this.historyOutView = historyOutView;
      bg0Changed = true;
    }

    if (bg1Changed) this._bg1Dirty = true;
    if (bg0Changed) this._bg0Dirty = true;
  }

  setHistoryPrevView(view) {
    if (view !== this.historyPrevView) {
      this.historyPrevView = view;
      this._bg1Dirty = true;
    }
  }

  setHistoryOutView(view) {
    if (view !== this.historyOutView) {
      this.historyOutView = view || null;
      this._bg0Dirty = true;
    }
  }

  // -------------------- outputs --------------------
  // Records the logical full-resolution extent without requiring a matching
  // allocation. Direct coarse presentation uses this to avoid an unused target.
  setOutputExtent(
    width,
    height,
    layers = 1,
    format = "rgba16float",
    { releaseOutput = false } = {},
  ) {
    const nextWidth = Math.max(1, width | 0);
    const nextHeight = Math.max(1, height | 0);
    const nextLayers = Math.max(1, layers | 0);
    const extentChanged =
      this.width !== nextWidth ||
      this.height !== nextHeight ||
      this.layers !== nextLayers ||
      this.outFormat !== format;

    this._ensureComputeFormat(format);

    if ((extentChanged || releaseOutput) && this.outTexture) {
      const oldOutTex = this.outTexture;
      this.outTexture = null;
      this.outView = null;
      try {
        this._retireTexture(oldOutTex);
      } catch (_) {}
    }

    this.width = nextWidth;
    this.height = nextHeight;
    this.layers = nextLayers;

    this._reprojFullW = nextWidth;
    this._reprojFullH = nextHeight;
    this._dvReproj.setUint32(32, this._reprojFullW >>> 0, true);
    this._dvReproj.setUint32(36, this._reprojFullH >>> 0, true);
    this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);

    this.setFrame({
      fullWidth: nextWidth,
      fullHeight: nextHeight,
      tileWidth: nextWidth,
      tileHeight: nextHeight,
      originX: 0,
      originY: 0,
      originZ: 0,
      layerIndex: 0,
      originXf: 0.0,
      originYf: 0.0,
    });

    this._renderSourceView = null;
    this._bg0Dirty = true;
    this._bg1Dirty = true;
    this._renderBgCache = new WeakMap();
    this._renderBundleCache = new WeakMap();
    this._lastHadWork = false;

    return this.outView;
  }

  createOutputTexture(width, height, layers = 1, format = "rgba16float") {
    const previousFormat = this.outFormat;
    this._ensureComputeFormat(format);

    if (
      this.outTexture &&
      this.width === width &&
      this.height === height &&
      this.layers === layers &&
      previousFormat === format
    ) {
      return this.outView;
    }

    const oldOutTex = this.outTexture;

    this.outTexture = null;
    this.outView = null;

    if (oldOutTex) {
      try {
        this._retireTexture(oldOutTex);
      } catch (_) {}
    }

    this.setOutputExtent(width, height, layers, format);

    this.outTexture = this.device.createTexture({
      size: [this.width, this.height, this.layers],
      format: this.outFormat,
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.outView = this.outTexture.createView({
      dimension: "2d-array",
      arrayLayerCount: this.layers,
    });

    return this.outView;
  }

  setOutputView(
    view,
    { width, height, layers = 1, format = "rgba16float" } = {},
  ) {
    if (!view) throw new Error("setOutputView: view required");
    this._ensureComputeFormat(format);

    this.outTexture = null;
    this.outView = view;

    if (width && height) {
      this.width = width;
      this.height = height;
      this.layers = layers;

      this.setFrame({
        fullWidth: width,
        fullHeight: height,
        tileWidth: width,
        tileHeight: height,
        originX: 0,
        originY: 0,
        originZ: 0,
        layerIndex: 0,
        originXf: 0.0,
        originYf: 0.0,
      });

      this._reprojFullW = width;
      this._reprojFullH = height;
      this._dvReproj.setUint32(32, this._reprojFullW >>> 0, true);
      this._dvReproj.setUint32(36, this._reprojFullH >>> 0, true);
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
    }

    this._bg0Dirty = true;
    this._renderBgCache = new WeakMap();
    this._renderBundleCache = new WeakMap();
    this._lastHadWork = false;

    return this.outView;
  }

  // -------------------- bind group keys --------------------
  _buildBg0Key() {
    const ids = [
      this._getResId(this.outView),
      this._getResId(this.optionsBuffer),
      this._getResId(this.paramsBuffer),
      this._getResId(this.nTransformBuffer),
      this._getResId(this.posBuffer),
      this._getResId(this.frameBuffer),
      this._getResId(this.historyOutView || this._dummyHistoryOutView),
      this._getResId(this.reprojBuffer),
      this._getResId(this.perfBuffer),
      this._getResId(this.tuningBuffer),
      this.outFormat,
    ];
    return ids.join("|");
  }

  _buildBg1Key() {
    const blueViewId = this._getResId(this.blueView || this._ensureBlueView());
    const ids = [
      this._getResId(this.weatherView),
      this._getResId(this._samp2D),
      this._getResId(this.shape3DView),
      this._getResId(this._sampShape),
      blueViewId,
      this._getResId(this._sampBN),
      this._getResId(this.detail3DView),
      this._getResId(this._sampDetail),
      this._getResId(this.lightBuffer),
      this._getResId(this.viewBuffer),
      this._getResId(this.boxBuffer),
      this._getResId(this.historyPrevView || this._dummyHistoryPrevView),
      this._getResId(this.motionView || this._dummy2DMotionView),
      this._getResId(this.depthPrevView || this._dummy2DDepthView),
    ];
    return ids.join("|");
  }


  _ensureBlueView() {
    if (this.blueView) return this.blueView;
    if (!this.blueTex) {
      const tex = this.device.createTexture({
        size: [1, 1, 1],
        format: "r8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
      this.queue.writeTexture(
        { texture: tex },
        new Uint8Array([128]),
        { bytesPerRow: 1 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      );
      this.blueTex = tex;
      this._ownsBlue = true;
    }
    this.blueView = this.blueTex.createView({
      dimension: "2d-array",
      baseArrayLayer: 0,
      arrayLayerCount: 1,
    });
    return this.blueView;
  }

  _createBg0ForKey() {
    if (!this.outView)
      throw new Error(
        "No output view: call createOutputTexture or setOutputView first",
      );

    const canUseExplicitHistoryOut =
      this.historyOutView &&
      this._getResId(this.historyOutView) !== this._getResId(this.outView);
    const historyOutForBind = canUseExplicitHistoryOut
      ? this.historyOutView
      : this._dummyHistoryOutView;

    return this.device.createBindGroup({
      layout: this.bgl0,
      entries: [
        { binding: 0, resource: { buffer: this.optionsBuffer } },
        { binding: 1, resource: { buffer: this.paramsBuffer } },
        { binding: 3, resource: { buffer: this.nTransformBuffer } },
        { binding: 4, resource: this.outView },
        { binding: 5, resource: { buffer: this.posBuffer } },
        { binding: 6, resource: { buffer: this.frameBuffer } },
        { binding: 7, resource: historyOutForBind },
        { binding: 8, resource: { buffer: this.reprojBuffer } },
        { binding: 9, resource: { buffer: this.perfBuffer } },
        { binding: 10, resource: { buffer: this.tuningBuffer } },
      ],
    });
  }

  _createBg1ForKey() {
    if (!this.weatherView)
      throw new Error(
        "Missing weatherView (texture_2d_array view). Call setInputMaps().",
      );
    if (!this.shape3DView)
      throw new Error(
        "Missing shape3DView (texture_3d view). Call setInputMaps().",
      );
    if (!this.detail3DView)
      throw new Error(
        "Missing detail3DView (texture_3d view). Call setInputMaps().",
      );

    const blueView = this.blueView || this._ensureBlueView();
    const motionView = this.motionView || this._dummy2DMotionView;
    const depthView = this.depthPrevView || this._dummy2DDepthView;
    const historyPrev = this.historyPrevView || this._dummyHistoryPrevView;

    return this.device.createBindGroup({
      layout: this.bgl1,
      entries: [
        { binding: 0, resource: this.weatherView },
        { binding: 1, resource: this._samp2D },
        { binding: 2, resource: this.shape3DView },
        { binding: 3, resource: this._sampShape },
        { binding: 4, resource: blueView },
        { binding: 5, resource: this._sampBN },
        { binding: 6, resource: this.detail3DView },
        { binding: 7, resource: this._sampDetail },
        { binding: 8, resource: { buffer: this.lightBuffer } },
        { binding: 9, resource: { buffer: this.viewBuffer } },
        { binding: 10, resource: { buffer: this.boxBuffer } },
        { binding: 11, resource: historyPrev },
        { binding: 13, resource: motionView },
        { binding: 15, resource: depthView },
      ],
    });
  }

  _makeBindGroups() {
    this._ensureBindGroupCaches();

    if (this._bg0Dirty || !this._currentBg0) {
      const k0 = this._buildBg0Key();
      if (this._bg0Cache.has(k0)) {
        this._currentBg0 = this._bg0Cache.get(k0);
      } else {
        const bg0 = this._createBg0ForKey();
        this._bg0Cache.set(k0, bg0);
        this._bg0Keys.push(k0);
        this._currentBg0 = bg0;
        while (this._bg0Keys.length > 16) {
          const oldest = this._bg0Keys.shift();
          this._bg0Cache.delete(oldest);
        }
      }
      this._bg0Dirty = false;
    }

    if (this._bg1Dirty || !this._currentBg1) {
      const k1 = this._buildBg1Key();
      if (this._bg1Cache.has(k1)) {
        this._currentBg1 = this._bg1Cache.get(k1);
      } else {
        const bg1 = this._createBg1ForKey();
        this._bg1Cache.set(k1, bg1);
        this._bg1Keys.push(k1);
        this._currentBg1 = bg1;
        while (this._bg1Keys.length > 16) {
          const oldest = this._bg1Keys.shift();
          this._bg1Cache.delete(oldest);
        }
      }
      this._bg1Dirty = false;
    }
  }

  // -------------------- dispatch (coarse integrated) --------------------
  async dispatchRect({ x, y, w, h, wait = false, coarseFactor = 1 } = {}) {
    if (!this.outView)
      throw new Error("dispatchRect: createOutputTexture/setOutputView first.");

    const baseX = Math.max(0, Math.floor(x ?? 0));
    const baseY = Math.max(0, Math.floor(y ?? 0));
    const tw = Math.max(0, Math.floor(w ?? this.width - baseX));
    const th = Math.max(0, Math.floor(h ?? this.height - baseY));

    const cf = Math.max(1, coarseFactor | 0);
    if (cf < 2 || !this.outTexture)
      return this.dispatchRectNoCoarse({
        x: baseX,
        y: baseY,
        w: tw,
        h: th,
        wait,
      });

    const cW = Math.max(1, Math.ceil(tw / cf));
    const cH = Math.max(1, Math.ceil(th / cf));
    this._ensureCoarseTexture(cW, cH, this.layers);

    const savedOutTexture = this.outTexture;
    const savedOutView = this.outView;
    const savedWidth = this.width;
    const savedHeight = this.height;
    const savedFormat = this.outFormat;

    this.outTexture = this._coarseTexture;
    this.outView = this._coarseView;
    this.width = cW;
    this.height = cH;
    this.outFormat = savedFormat;
    this._bg0Dirty = true;

    this.setFrame({
      fullWidth: cW,
      fullHeight: cH,
      tileWidth: cW,
      tileHeight: cH,
      originX: 0,
      originY: 0,
      originZ: 0,
      layerIndex: this._dvFrame.getInt32(36, true) | 0,
      originXf: baseX,
      originYf: baseY,
    });

    const curFW = this._dvReproj.getUint32(32, true) || 0;
    const curFH = this._dvReproj.getUint32(36, true) || 0;
    if (curFW !== cW >>> 0 || curFH !== cH >>> 0) {
      this._dvReproj.setUint32(32, cW >>> 0, true);
      this._dvReproj.setUint32(36, cH >>> 0, true);
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
      this._bg0Dirty = true;
    }

    const enc = this.device.createCommandEncoder();
    const savedReprojStateForCoarse = Object.assign({}, this._state.reproj || {});
    const savedReprojBytesForCoarse = new Uint8Array(this._abReproj).slice();
    const savedReprojFullWForCoarse = this._reprojFullW;
    const savedReprojFullHForCoarse = this._reprojFullH;
    this.setReprojSettings({
      enabled: 0,
      subsample: 1,
      sampleOffset: 0,
      motionIsNormalized: 0,
      temporalBlend: 0.0,
      depthTest: 0,
      depthTolerance: 0.0,
      frameIndex: 0,
      fullWidth: cW,
      fullHeight: cH,
      temporalCellRate: 1,
      temporalCellPhase: 0,
      compactInterleave: 0,
    });
    this._encodeCurrentComputePass(enc);
    this._state.reproj = savedReprojStateForCoarse;
    new Uint8Array(this._abReproj).set(savedReprojBytesForCoarse);
    this._reprojFullW = savedReprojFullWForCoarse;
    this._reprojFullH = savedReprojFullHForCoarse;
    this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);

    this.outTexture = savedOutTexture;
    this.outView = savedOutView;
    this.width = savedWidth;
    this.height = savedHeight;
    this.outFormat = savedFormat;
    this._bg0Dirty = true;

    const layerForRestore = this._dvFrame.getInt32(36, true) | 0;
    const preparedUpsample = this._prepareUpsamplePass({
      srcW: cW,
      srcH: cH,
      dstX: baseX,
      dstY: baseY,
      dstW: tw,
      dstH: th,
    });
    this._encodeUpsamplePass(enc, preparedUpsample);
    this.queue.submit([enc.finish()]);

    this.setFrame({
      fullWidth: savedWidth,
      fullHeight: savedHeight,
      tileWidth: tw,
      tileHeight: th,
      originX: baseX,
      originY: baseY,
      originZ: 0,
      layerIndex: layerForRestore,
      originXf: 0.0,
      originYf: 0.0,
    });

    if (wait && typeof this.queue.onSubmittedWorkDone === "function")
      await this.queue.onSubmittedWorkDone();

    this._lastHadWork = true;
    return this.outView;
  }

  async dispatchRectNoCoarse({ x, y, w, h, wait = false } = {}) {
    if (!this.outView)
      throw new Error(
        "dispatchRectNoCoarse: createOutputTexture/setOutputView first.",
      );

    const baseX = Math.max(0, Math.floor(x ?? 0));
    const baseY = Math.max(0, Math.floor(y ?? 0));
    const tw = Math.max(0, Math.floor(w ?? this.width - baseX));
    const th = Math.max(0, Math.floor(h ?? this.height - baseY));

    if (tw === 0 || th === 0) {
      this._lastHadWork = false;
      return this.outView;
    }

    this.setFrame({
      fullWidth: this.width,
      fullHeight: this.height,
      tileWidth: tw,
      tileHeight: th,
      originX: baseX,
      originY: baseY,
      originZ: 0,
      layerIndex: this._dvFrame.getInt32(36, true) | 0,
      originXf: 0.0,
      originYf: 0.0,
    });

    if (!this._reprojFullW) {
      this._dvReproj.setUint32(32, this.width >>> 0, true);
      this._dvReproj.setUint32(36, this.height >>> 0, true);
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
      this._bg0Dirty = true;
    }

    await this._dispatchComputeInternal({ wait });
    this._lastHadWork = true;
    return this.outView;
  }

  async dispatch({ wait = false, coarseFactor = 1 } = {}) {
    const enc = this.device.createCommandEncoder();
    const encoded = this.encodeDispatchPasses(enc, { coarseFactor });
    this.queue.submit([enc.finish()]);
    encoded?.restoreAfterSubmit?.();
    if (wait && typeof this.queue.onSubmittedWorkDone === "function")
      await this.queue.onSubmittedWorkDone();
    return this.outView;
  }

  async dispatchAllLayers({ wait = false } = {}) {
    if (!this.outView)
      throw new Error(
        "Nothing to dispatch: createOutputTexture/setOutputView first.",
      );

    this._writeIfChanged("options", this.optionsBuffer, this._abOptions);
    this._writeIfChanged("params", this.paramsBuffer, this._abParams);
    this._writeIfChanged(
      "ntransform",
      this.nTransformBuffer,
      this._abNTransform,
    );
    this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
    this._writeIfChanged("perf", this.perfBuffer, this._abPerf);
    this._writeIfChanged("tuning", this.tuningBuffer, this._abTuning);

    this._makeBindGroups();

    const enc = this.device.createCommandEncoder();
    for (let layer = 0; layer < this.layers; ++layer) {
      this.setLayerIndex(layer);
      this._encodeCurrentComputePass(enc);
    }
    this.queue.submit([enc.finish()]);
    if (wait && typeof this.queue.onSubmittedWorkDone === "function")
      await this.queue.onSubmittedWorkDone();
    this._lastHadWork = true;
    return this.outView;
  }

  _writeCommonComputeUniforms() {
    this._writeIfChanged("options", this.optionsBuffer, this._abOptions);
    this._writeIfChanged("params", this.paramsBuffer, this._abParams);
    this._writeIfChanged(
      "ntransform",
      this.nTransformBuffer,
      this._abNTransform,
    );
    this._writeIfChanged("frame", this.frameBuffer, this._abFrame);
    this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
    this._writeIfChanged("perf", this.perfBuffer, this._abPerf);
    this._writeIfChanged("tuning", this.tuningBuffer, this._abTuning);
  }


  _temporalRateForDispatch() {
    const r = normalizeTemporalRate(this._state?.reproj?.temporalCellRate ?? 1);
    return r > 1 ? r : 1;
  }

  _canUseCompactInterleave() {
    const r = this._temporalRateForDispatch();
    const s = this._state?.reproj || {};
    return !!(
      r > 1 &&
      (s.frameIndex >>> 0) > 0 &&
      this.historyPrevView &&
      this.historyOutView &&
      this.width > 0 &&
      this.height > 0
    );
  }

  _setCompactInterleaveUniform(enabled) {
    const s = this._state.reproj;
    const next = enabled ? 1 : 0;
    if ((s.compactInterleave ? 1 : 0) === next) return;
    s.compactInterleave = next;
    this._dvReproj.setUint32(48, next >>> 0, true);
    this._dvReproj.setUint32(52, 0, true);
    this._dvReproj.setUint32(56, 0, true);
    this._dvReproj.setUint32(60, 0, true);
    this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
  }

  _compactInterleaveDispatchShape() {
    const rate = this._temporalRateForDispatch();
    const fullW = Math.max(1, this.width || 1);
    const fullH = Math.max(1, this.height || 1);
    const ownersPerBlock = Math.max(1, Math.floor(64 / Math.max(1, rate)));
    const blocksX = Math.max(1, Math.ceil(fullW / 8));
    const blocksY = Math.max(1, Math.ceil(fullH / 8));
    return {
      w: blocksX * ownersPerBlock,
      h: blocksY,
      wgX: Math.max(1, Math.ceil((blocksX * ownersPerBlock) / 8)),
      wgY: Math.max(1, Math.ceil(blocksY / 8)),
      updatedPixels: blocksX * blocksY * ownersPerBlock,
      totalPixels: fullW * fullH,
      tile: 8,
    };
  }

  _ensureHistoryCopyPipeline() {
    if (this._historyCopy && this._historyCopy.format === "rgba16float") return this._historyCopy;
    const deviceCache = getCloudGpuCache(this.device);
    if (deviceCache.historyCopy) {
      this._historyCopy = deviceCache.historyCopy;
      this._historyCopyBgCache.clear();
      this._historyCopyBgKeys.length = 0;
      return this._historyCopy;
    }

    const wgsl = `
      struct Frame {
        fullWidth: u32, fullHeight: u32,
        tileWidth: u32, tileHeight: u32,
        originX: i32, originY: i32, originZ: i32,
        fullDepth: u32, tileDepth: u32,
        layerIndex: i32, layers: u32,
        _pad0: u32,
        originXf: f32, originYf: f32, _pad1: f32, _pad2: f32
      };

      struct ReprojSettings {
        enabled: u32,
        subsample: u32,
        sampleOffset: u32,
        motionIsNormalized: u32,
        temporalBlend: f32,
        depthTest: u32,
        depthTolerance: f32,
        frameIndex: u32,
        fullWidth: u32,
        fullHeight: u32,
        temporalCellRate: u32,
        temporalCellPhase: u32,
        compactInterleave: u32,
        _pad0: u32,
        _pad1: u32,
        _pad2: u32
      };

      @group(0) @binding(0) var srcTex: texture_2d_array<f32>;
      @group(0) @binding(1) var dstTex: texture_storage_2d_array<rgba16float, write>;
      @group(0) @binding(2) var<uniform> frame: Frame;
      @group(0) @binding(3) var<uniform> reproj: ReprojSettings;

      @compute @workgroup_size(16, 16, 1)
      fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
        let fullW = max(reproj.fullWidth, frame.fullWidth);
        let fullH = max(reproj.fullHeight, frame.fullHeight);
        if (gid.x >= fullW || gid.y >= fullH) { return; }
        let p = vec2<i32>(i32(gid.x), i32(gid.y));
        let layer = frame.layerIndex;
        let c = textureLoad(srcTex, p, layer, 0);
        textureStore(dstTex, p, layer, c);
      }
    `;

    const module = this.device.createShaderModule({ code: wgsl });
    const bgl = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "2d-array" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "rgba16float", viewDimension: "2d-array" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      ],
    });
    const pipe = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      compute: { module, entryPoint: "main" },
    });
    deviceCache.historyCopy = { format: "rgba16float", bgl, pipe };
    this._historyCopy = deviceCache.historyCopy;
    this._historyCopyBgCache.clear();
    this._historyCopyBgKeys.length = 0;
    return this._historyCopy;
  }

  _getHistoryCopyBindGroup() {
    if (!this.historyPrevView || !this.historyOutView) return null;
    const h = this._ensureHistoryCopyPipeline();
    const key = [
      this._getResId(this.historyPrevView),
      this._getResId(this.historyOutView),
      this._getResId(this.frameBuffer),
      this._getResId(this.reprojBuffer),
    ].join("|");
    if (this._historyCopyBgCache.has(key)) return this._historyCopyBgCache.get(key);

    const bg = this.device.createBindGroup({
      layout: h.bgl,
      entries: [
        { binding: 0, resource: this.historyPrevView },
        { binding: 1, resource: this.historyOutView },
        { binding: 2, resource: { buffer: this.frameBuffer } },
        { binding: 3, resource: { buffer: this.reprojBuffer } },
      ],
    });
    this._historyCopyBgCache.set(key, bg);
    this._historyCopyBgKeys.push(key);
    while (this._historyCopyBgKeys.length > 8) {
      const oldest = this._historyCopyBgKeys.shift();
      this._historyCopyBgCache.delete(oldest);
    }
    return bg;
  }

  _encodeHistoryCopyPass(enc) {
    const h = this._ensureHistoryCopyPipeline();
    const bg = this._getHistoryCopyBindGroup();
    if (!bg) return;
    const pass = enc.beginComputePass();
    pass.setPipeline(h.pipe);
    pass.setBindGroup(0, bg);
    const fullW = Math.max(1, this.width || 1);
    const fullH = Math.max(1, this.height || 1);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(fullW / 16)), Math.max(1, Math.ceil(fullH / 16)), 1);
    pass.end();
  }

  _encodeCurrentComputePass(enc) {
    const compactInterleave = this._canUseCompactInterleave();
    this._setCompactInterleaveUniform(compactInterleave);
    this._writeCommonComputeUniforms();
    if (compactInterleave) this._encodeHistoryCopyPass(enc);
    this._makeBindGroups();

    const compactShape = compactInterleave ? this._compactInterleaveDispatchShape() : null;
    const fullPixels = Math.max(1, (this.width || 1) * (this.height || 1));
    this._lastInterleaveStats = {
      enabled: !!compactInterleave,
      rate: this._temporalRateForDispatch(),
      phase: this._state?.reproj?.temporalCellPhase >>> 0,
      updatedPixels: compactShape ? compactShape.updatedPixels : fullPixels,
      totalPixels: fullPixels,
      fraction: compactShape ? Math.min(1, compactShape.updatedPixels / fullPixels) : 1,
      tile: compactShape ? compactShape.tile : 1,
    };
    const pipeline = this.ensureComputePipelineReady();
    const stageBindGroup = (this._computePipelineKey & 96) ? this._getFlatStageBindGroup() : null;
    const timings = [];
    const pass = enc.beginComputePass();
    if (this._computePipelineKey & 64) this._encodeFlatFields(pass, timings);
    const rayStarted = performance.now();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, this._currentBg0);
    pass.setBindGroup(1, this._currentBg1);
    const staged = !!(this._computePipelineKey & 32);
    if (stageBindGroup) pass.setBindGroup(2, stageBindGroup);
    pass.dispatchWorkgroups(compactShape ? compactShape.wgX : this._wgX, compactShape ? compactShape.wgY : this._wgY, 1);
    timings.push({ stage: "cloud-raymarch", encodeMs: performance.now() - rayStarted, dispatched: true });
    if (staged) {
      const resolveStarted = performance.now();
      pass.setPipeline(this._ensureFlatStagePipeline("resolveCloudFlat"));
      pass.dispatchWorkgroups(compactShape ? compactShape.wgX : this._wgX, compactShape ? compactShape.wgY : this._wgY, 1);
      timings.push({ stage: "cloud-temporal-resolve", encodeMs: performance.now() - resolveStarted, dispatched: true });
    }
    pass.end();
    this._lastStageTimings = timings;
  }

  encodeDispatchPasses(enc, { coarseFactor = 1, reconstructAtPresentation = false } = {}) {
    if (!enc) throw new Error("encodeDispatchPasses: command encoder required.");
    const cf = Math.max(1, coarseFactor | 0);
    const directCoarse = cf >= 2 && !!reconstructAtPresentation;
    if (!this.outView && !directCoarse)
      throw new Error("encodeDispatchPasses: createOutputTexture/setOutputView first.");

    this._renderSourceView = this.outView;
    if (cf < 2) {
      const layer = this._dvFrame.getInt32(36, true) | 0;
      this.setFrame({
        fullWidth: this.width,
        fullHeight: this.height,
        tileWidth: this.width,
        tileHeight: this.height,
        originX: 0,
        originY: 0,
        originZ: 0,
        layerIndex: layer,
        originXf: 0.0,
        originYf: 0.0,
      });
    }
    if (cf >= 2 && (this.outTexture || directCoarse)) {
      const cW = Math.max(1, Math.ceil(this.width / cf));
      const cH = Math.max(1, Math.ceil(this.height / cf));
      this._ensureCoarseTexture(cW, cH, this.layers);

      // Coarse compute keeps temporal history in coarse space. Presentation
      // reconstructs onto the full-resolution canvas without displaying the coarse target.
      const savedOutTexture = this.outTexture;
      const savedOutView = this.outView;
      const savedWidth = this.width;
      const savedHeight = this.height;
      const savedFormat = this.outFormat;
      const savedLayer = this._dvFrame.getInt32(36, true) | 0;

      this.outTexture = this._coarseTexture;
      this.outView = this._coarseView;
      this.width = cW;
      this.height = cH;
      this.outFormat = savedFormat;
      this._bg0Dirty = true;

      this.setFrame({
        fullWidth: cW,
        fullHeight: cH,
        tileWidth: cW,
        tileHeight: cH,
        originX: 0,
        originY: 0,
        originZ: 0,
        layerIndex: savedLayer,
        originXf: 0.0,
        originYf: 0.0,
      });

      const curFW = this._dvReproj.getUint32(32, true) || 0;
      const curFH = this._dvReproj.getUint32(36, true) || 0;
      if (curFW !== cW >>> 0 || curFH !== cH >>> 0) {
        this._dvReproj.setUint32(32, cW >>> 0, true);
        this._dvReproj.setUint32(36, cH >>> 0, true);
        this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
      }

      this._encodeCurrentComputePass(enc);

      this.outTexture = savedOutTexture;
      this.outView = savedOutView;
      this.width = savedWidth;
      this.height = savedHeight;
      this.outFormat = savedFormat;
      this._bg0Dirty = true;

      if (reconstructAtPresentation) {
        this._renderSourceView = this._coarseView;
      } else {
        const preparedUpsample = this._prepareUpsamplePass({
          srcW: cW,
          srcH: cH,
          dstX: 0,
          dstY: 0,
          dstW: savedWidth,
          dstH: savedHeight,
        });
        this._encodeUpsamplePass(enc, preparedUpsample);
        this._renderSourceView = this.outView;
      }
      this._lastHadWork = true;

      return {
        coarseFactor: cf,
        directFullResReconstruction: !!reconstructAtPresentation,
        previewView: this._renderSourceView,
        interleaveStats: this._lastInterleaveStats,
        stageTimings: this._lastStageTimings,
        restoreAfterSubmit: () => {
          this._bg0Dirty = true;
        },
      };
    }

    this._encodeCurrentComputePass(enc);
    this._lastHadWork = true;
    return {
      coarseFactor: 1,
      restoreAfterSubmit: null,
      interleaveStats: this._lastInterleaveStats,
      stageTimings: this._lastStageTimings,
    };
  }

  async _dispatchComputeInternal({ wait = false } = {}) {
    const enc = this.device.createCommandEncoder();
    this.encodeDispatchPasses(enc, { coarseFactor: 1 });
    this.queue.submit([enc.finish()]);
    if (wait && typeof this.queue.onSubmittedWorkDone === "function")
      await this.queue.onSubmittedWorkDone();
  }

  // -------------------- coarse helpers --------------------
  _ensureCoarseTexture(w, h, layers = 1) {
    if (
      this._coarseTexture &&
      this._coarseW === w &&
      this._coarseH === h &&
      this._coarseLayers === layers &&
      this._coarseFormat === this.outFormat
    ) {
      return;
    }

    const old = this._coarseTexture;

    this._coarseTexture = null;
    this._coarseView = null;

    if (old) {
      try {
        this._retireTexture(old);
      } catch (_) {}
    }

    this._coarseW = w;
    this._coarseH = h;
    this._coarseLayers = layers;
    this._coarseFormat = this.outFormat;

    this._coarseTexture = this.device.createTexture({
      size: [w, h, layers],
      format: this.outFormat,
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC,
    });

    this._coarseView = this._coarseTexture.createView({
      dimension: "2d-array",
      arrayLayerCount: layers,
    });

    this._bg0Dirty = true;
    this._bg1Dirty = true;
  }

  // -------------------- coarse upsample pipeline --------------------
  _ensureUpsamplePipeline(format = this.outFormat) {
    if (this._upsample && this._upsample.format === format)
      return this._upsample;

    const fmt = format || "rgba16float";
    const deviceCache = getCloudGpuCache(this.device);
    const cachedUpsample = deviceCache.upsampleByFormat.get(fmt);
    if (cachedUpsample) {
      this._upsample = { ...cachedUpsample, bgCache: new Map() };
      return this._upsample;
    }

    const wgsl = `
      struct UpsampleParams {
        srcW : u32,
        srcH : u32,
        dstX : u32,
        dstY : u32,
        dstW : u32,
        dstH : u32,
        layer: u32,
        _pad0: u32,
      }

      @group(0) @binding(0) var samp : sampler;
      @group(0) @binding(1) var srcTex : texture_2d_array<f32>;
      @group(0) @binding(2) var dstTex : texture_storage_2d_array<${fmt}, write>;
      @group(0) @binding(3) var<uniform> P : UpsampleParams;

      @compute @workgroup_size(16, 16, 1)
      fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
        let x = gid.x;
        let y = gid.y;
        if (x >= P.dstW || y >= P.dstH) { return; }

        let uv = (vec2<f32>(f32(x) + 0.5, f32(y) + 0.5)) / vec2<f32>(max(f32(P.dstW), 1.0), max(f32(P.dstH), 1.0));
        let srcDim = vec2<f32>(max(f32(P.srcW), 1.0), max(f32(P.srcH), 1.0));
        let dstDim = vec2<f32>(max(f32(P.dstW), 1.0), max(f32(P.dstH), 1.0));
        let texel = 1.0 / srcDim;
        let c0 = textureSampleLevel(srcTex, samp, uv, i32(P.layer), 0.0);
        let c1 = textureSampleLevel(srcTex, samp, uv + vec2<f32>( texel.x, 0.0), i32(P.layer), 0.0);
        let c2 = textureSampleLevel(srcTex, samp, uv + vec2<f32>(-texel.x, 0.0), i32(P.layer), 0.0);
        let c3 = textureSampleLevel(srcTex, samp, uv + vec2<f32>(0.0,  texel.y), i32(P.layer), 0.0);
        let c4 = textureSampleLevel(srcTex, samp, uv + vec2<f32>(0.0, -texel.y), i32(P.layer), 0.0);
        let a0 = clamp(c0.a, 0.0, 1.0);
        let w0 = 0.48;
        let w1 = 0.13 / (1.0 + abs(clamp(c1.a, 0.0, 1.0) - a0) * 16.0);
        let w2 = 0.13 / (1.0 + abs(clamp(c2.a, 0.0, 1.0) - a0) * 16.0);
        let w3 = 0.13 / (1.0 + abs(clamp(c3.a, 0.0, 1.0) - a0) * 16.0);
        let w4 = 0.13 / (1.0 + abs(clamp(c4.a, 0.0, 1.0) - a0) * 16.0);
        let wSum = max(w0 + w1 + w2 + w3 + w4, 1e-5);
        let crossAvg = (c0 * w0 + c1 * w1 + c2 * w2 + c3 * w3 + c4 * w4) / wSum;
        let divider = max(dstDim.x / srcDim.x, dstDim.y / srcDim.y);
        let resolveF = smoothstep(2.0, 4.5, divider) * smoothstep(0.02, 0.40, a0);
        let c = mix(c0, crossAvg, resolveF * 0.22);

        let outX = i32(P.dstX + x);
        let outY = i32(P.dstY + y);
        textureStore(dstTex, vec2<i32>(outX, outY), i32(P.layer), c);
      }
    `;

    const mod = this.device.createShaderModule({ code: wgsl });

    const bgl = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          sampler: { type: "filtering" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float", viewDimension: "2d-array" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: "write-only",
            format: fmt,
            viewDimension: "2d-array",
          },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });

    const pipe = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      compute: { module: mod, entryPoint: "main" },
    });

    const samp = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    deviceCache.upsampleByFormat.set(fmt, { pipe, bgl, samp, format: fmt });
    this._upsample = { ...deviceCache.upsampleByFormat.get(fmt), bgCache: new Map() };
    return this._upsample;
  }

  _getOrCreateUpsampleBindGroup(srcView, dstView) {
    const u = this._upsample;
    const key = `${this._getResId(srcView)}|${this._getResId(dstView)}|${this._getResId(u.samp)}|${this._getResId(this._upsampleParamsBuffer)}`;
    const map = u.bgCache;
    if (map.has(key)) return map.get(key);
    const bg = this.device.createBindGroup({
      layout: u.bgl,
      entries: [
        { binding: 0, resource: u.samp },
        { binding: 1, resource: srcView },
        { binding: 2, resource: dstView },
        { binding: 3, resource: { buffer: this._upsampleParamsBuffer } },
      ],
    });
    map.set(key, bg);
    if (map.size > 16) {
      const firstKey = map.keys().next().value;
      map.delete(firstKey);
    }
    return bg;
  }

  _prepareUpsamplePass({ srcW, srcH, dstX, dstY, dstW, dstH } = {}) {
    if (!this._coarseView || !this.outView) return null;

    const u = this._ensureUpsamplePipeline(this.outFormat);
    const dv = this._dvUpsample;

    dv.setUint32(0, srcW >>> 0, true);
    dv.setUint32(4, srcH >>> 0, true);
    dv.setUint32(8, dstX >>> 0, true);
    dv.setUint32(12, dstY >>> 0, true);
    dv.setUint32(16, dstW >>> 0, true);
    dv.setUint32(20, dstH >>> 0, true);

    const layer = (this._dvFrame.getInt32(36, true) | 0) >>> 0;
    dv.setUint32(24, layer >>> 0, true);
    dv.setUint32(28, 0, true);

    this.queue.writeBuffer(
      this._upsampleParamsBuffer,
      0,
      this._u8(this._abUpsample),
    );

    const bg = this._getOrCreateUpsampleBindGroup(
      this._coarseView,
      this.outView,
    );

    return {
      pipe: u.pipe,
      bg,
      wgX: Math.max(1, Math.ceil(dstW / 16)),
      wgY: Math.max(1, Math.ceil(dstH / 16)),
    };
  }

  _encodeUpsamplePass(enc, prepared) {
    if (!prepared) return;
    const pass = enc.beginComputePass();
    pass.setPipeline(prepared.pipe);
    pass.setBindGroup(0, prepared.bg);
    pass.dispatchWorkgroups(prepared.wgX, prepared.wgY, 1);
    pass.end();
  }

  // -------------------- preview render --------------------
  _createRenderPipelineSetup(format = "bgra8unorm") {
    const deviceCache = getCloudGpuCache(this.device);
    if (!deviceCache.previewModule) {
      deviceCache.previewModule = this.device.createShaderModule({ code: previewWGSL + '\n' + aircraftWGSL });
    }

    const bgl = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { viewDimension: "2d-array" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });
    const descriptor = {
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      vertex: { module: deviceCache.previewModule, entryPoint: "vs_main" },
      fragment: { module: deviceCache.previewModule, entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    };
    const samp = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
    return { descriptor, bgl, samp };
  }

  _ensureRenderPipeline(format = "bgra8unorm") {
    if (this._render && this._render.format === format) return this._render;
    const deviceCache = getCloudGpuCache(this.device);
    const cachedRender = deviceCache.previewByFormat.get(format);
    if (cachedRender) {
      this._render = cachedRender;
      return this._render;
    }

    const { descriptor, bgl, samp } = this._createRenderPipelineSetup(format);
    const pipe = this.device.createRenderPipeline(descriptor);
    deviceCache.previewByFormat.set(format, { pipe, bgl, samp, format });
    this._render = deviceCache.previewByFormat.get(format);
    return this._render;
  }

  async ensureRenderPipelineReadyAsync(format = "bgra8unorm") {
    if (this._render && this._render.format === format) return this._render;
    const renderAtStart = this._render;
    const deviceCache = getCloudGpuCache(this.device);
    const cachedRender = deviceCache.previewByFormat.get(format);
    if (cachedRender) {
      this._render = cachedRender;
      return this._render;
    }

    let pending = deviceCache.previewPromises.get(format);
    if (!pending) {
      const { descriptor, bgl, samp } = this._createRenderPipelineSetup(format);
      const create = async () => {
        const pipe = typeof this.device.createRenderPipelineAsync === "function"
          ? await this.device.createRenderPipelineAsync(descriptor)
          : this.device.createRenderPipeline(descriptor);
        const installed = deviceCache.previewByFormat.get(format);
        if (installed) return installed;
        const render = { pipe, bgl, samp, format };
        deviceCache.previewByFormat.set(format, render);
        return render;
      };
      pending = create();
      deviceCache.previewPromises.set(format, pending);
    }

    try {
      const render = await pending;
      if (this._render === renderAtStart || this._render?.format === format) {
        this._render = render;
      }
      return render;
    } finally {
      if (deviceCache.previewPromises.get(format) === pending) {
        deviceCache.previewPromises.delete(format);
      }
    }
  }

  _getRenderSourceView() {
    return this._renderSourceView || this.outView;
  }

  _getOrCreateRenderBindGroup(canvas, bgl, samp) {
    let map = this._renderBgCache.get(canvas);
    if (!map) {
      map = new Map();
      this._renderBgCache.set(canvas, map);
    }
    const sourceView = this._getRenderSourceView();
    const key =
      this._getResId(sourceView) +
      "|" +
      this._getResId(samp) +
      "|" +
      this._getResId(this.renderParams);
    if (map.has(key)) return map.get(key);
    const bg = this.device.createBindGroup({
      layout: bgl,
      entries: [
        { binding: 0, resource: samp },
        { binding: 1, resource: sourceView },
        {
          binding: 2,
          resource: { buffer: this.renderParams, offset: 0, size: this._abRender.byteLength },
        },
      ],
    });
    map.set(key, bg);
    if (map.size > 8) {
      const firstKey = map.keys().next().value;
      map.delete(firstKey);
    }
    return bg;
  }

  _getOrCreateRenderBundle(canvas, pipe, bgl, samp) {
    let map = this._renderBundleCache.get(canvas);
    if (!map) {
      map = new Map();
      this._renderBundleCache.set(canvas, map);
    }
    const key =
      this._getResId(this._getRenderSourceView()) +
      "|" +
      this._getResId(samp) +
      "|" +
      this._getResId(this.renderParams) +
      "|" +
      this._getResId(pipe);
    if (map.has(key)) return map.get(key);
    const bg = this._getOrCreateRenderBindGroup(canvas, bgl, samp);
    const format = this._render.format;
    const rbe = this.device.createRenderBundleEncoder({
      colorFormats: [format],
    });
    rbe.setPipeline(pipe);
    rbe.setBindGroup(0, bg);
    rbe.draw(6, 1, 0, 0);
    const bundle = rbe.finish();
    map.set(key, bundle);
    if (map.size > 8) {
      const firstKey = map.keys().next().value;
      map.delete(firstKey);
    }
    return bundle;
  }

  _writeRenderUniforms(opts = {}) {
    const dv = this._dvRender;
    const layerIndex = (opts.layerIndex ?? 0) >>> 0;
    const exposure = opts.exposure ?? 1.28;
    const sunBloom = opts.sunBloom ?? 0.0;
    const skyColor = opts.skyColor ?? [0.55, 0.7, 0.95];
    const gradeStyle = (opts.gradeStyle ?? 0) >>> 0;
    const sunColorTint = opts.sunColorTint ?? [1.0, 1.0, 1.0];
    const lightTint = opts.lightTint ?? [1.0, 1.0, 1.0];
    const shadowTint = opts.shadowTint ?? [0.0, 0.0, 0.0];
    const edgeTint = opts.edgeTint ?? [1.0, 1.0, 1.0];
    const styleShadowStrength = opts.styleShadowStrength ?? 0.96;
    const styleShadowEdge = opts.styleShadowEdge ?? 0.0;
    const styleShadowDarkness = opts.styleShadowDarkness ?? 0.06;
    const styleColorLift = opts.styleColorLift ?? 1.08;
    const styleSaturation = opts.styleSaturation ?? 1.02;
    const styleRimStrength = opts.styleRimStrength ?? 0.86;
    const styleSunBleed = opts.styleSunBleed ?? 0.82;
    const styleMidLift = opts.styleMidLift ?? 0.88;
    const silverIntensity = opts.silverIntensity ?? 1.15;
    const silverExponent = opts.silverExponent ?? 1.65;
    const outputWidth = Math.max(1, opts.outputWidth ?? this.width ?? 1);
    const outputHeight = Math.max(1, opts.outputHeight ?? this.height ?? 1);
    const godRaysEnabled = opts.godRaysEnabled ?? false;
    const godRayStrength = opts.godRayStrength ?? 0.0;
    const godRayLength = opts.godRayLength ?? 1.0;
    const godRayFalloff = opts.godRayFalloff ?? 1.55;
    const fogDensity = Math.max(0, Math.min(2.0, opts.fogDensity ?? 0.34));
    const fogHorizon = Math.max(0, Math.min(2.0, opts.fogHorizon ?? 0.30));
    const fogSun = Math.max(0, Math.min(2.0, opts.fogSun ?? 1.50));
    const renderBox = opts.box ?? this._state.box ?? { center: [0, 0, 0], half: [18, 0.6, 18] };
    const boxCenter = renderBox.center ?? [0, 0, 0];
    const boxHalf = renderBox.half ?? [18, 0.6, 18];

    let camPos, right, up, fwd, fovYRad, aspect, sunDir;

    if (
      opts.cam &&
      opts.cam.camPos &&
      opts.cam.right &&
      opts.cam.up &&
      opts.cam.fwd
    ) {
      camPos = opts.cam.camPos;
      right = opts.cam.right;
      up = opts.cam.up;
      fwd = opts.cam.fwd;
      fovYRad = radDeg(opts.cam.fovYDeg ?? 60);
      aspect = opts.cam.aspect ?? 1.0;
      sunDir = opts.sunDir ?? [0, 1, 0];
    } else {
      const yaw = radDeg(opts.yawDeg ?? 0);
      const pitch = radDeg(opts.pitchDeg ?? 0);
      const cp = Math.cos(pitch),
        sp = Math.sin(pitch);
      const cy = Math.cos(yaw),
        sy = Math.sin(yaw);
      fwd = norm3([sy * cp, sp, cy * cp]);
      const upRef =
        Math.abs(dot3(fwd, [0, 1, 0])) > 0.999 ? [0, 0, 1] : [0, 1, 0];
      right = norm3(cross3(upRef, fwd));
      up = cross3(fwd, right);
      const zoom = opts.zoom ?? 3.0;
      camPos = [-fwd[0] * zoom, -fwd[1] * zoom, -fwd[2] * zoom];
      fovYRad = radDeg(opts.fovYDeg ?? 60);
      aspect = opts.aspect ?? 1.0;
      const sAz = radDeg(opts.sunAzimuthDeg ?? 45);
      const sEl = radDeg(opts.sunElevationDeg ?? 20);
      const cel = Math.cos(sEl);
      sunDir = norm3([cel * Math.sin(sAz), Math.sin(sEl), cel * Math.cos(sAz)]);
    }

    const compositeQuality = Math.max(0, Math.min(2, opts.compositeQuality ?? 2)) >>> 0;
    const alphaFloor = Math.max(0, Math.min(1.0, opts.alphaFloor ?? 0.12));

    dv.setUint32(0, layerIndex, true);
    dv.setUint32(4, compositeQuality, true);
    dv.setFloat32(8, styleShadowDarkness, true);
    // The field raymarch already shades its volume. Keep the legacy finishing
    // pass for layer/spherical clouds, rather than painting over these normals.
    dv.setFloat32(12, (this._currentComputeVariantKey() & 64) !== 0 ? 1.0 : 0.0, true);
    writeVec3Padded(dv, 16, camPos);
    dv.setFloat32(28, Math.max(0,Math.min(1,opts.nightAmount ?? 0)), true);
    writeVec3Padded(dv, 32, right);
    dv.setFloat32(44, opts.aircraft?.enabled ? 1 : 0, true);
    writeVec3Padded(dv, 48, up);
    dv.setFloat32(60, opts.aircraft?.bank || 0, true);
    writeVec3Padded(dv, 64, fwd);
    dv.setFloat32(76, opts.aircraft?.pitch || 0, true);
    dv.setFloat32(80, fovYRad, true);
    dv.setFloat32(84, aspect, true);
    dv.setFloat32(88, exposure, true);
    dv.setFloat32(92, sunBloom, true);
    writeVec3Padded(dv, 96, sunDir);
    dv.setFloat32(108, Math.max(0,Math.min(1,opts.celestialVisibility ?? 1)), true);
    writeVec3Padded(dv, 112, skyColor);
    dv.setFloat32(124, opts.skyCycle ? 1 : 0, true);
    dv.setUint32(128, gradeStyle, true);
    dv.setFloat32(132, styleShadowStrength, true);
    dv.setFloat32(136, styleColorLift, true);
    dv.setFloat32(140, styleSaturation, true);
    writeVec3Padded(dv, 144, sunColorTint);
    const finish = !opts.cloudShading || opts.cloudShading === 'auto' ? intendedCloudShading(gradeStyle) : opts.cloudShading;
    dv.setFloat32(156, finish === 'soft' ? 1 : finish === 'sculpted' ? 2 : 0, true);
    writeVec3Padded(dv, 160, lightTint);
    writeVec3Padded(dv, 176, shadowTint);
    writeVec3Padded(dv, 192, edgeTint);
    // Reuse vec3 padding; the preview uniform remains 304 bytes.
    dv.setFloat32(204, opts.styleSkyOverride ? 1 : 0, true);
    dv.setFloat32(208, styleRimStrength, true);
    dv.setFloat32(212, styleSunBleed, true);
    dv.setFloat32(216, styleShadowEdge, true);
    dv.setFloat32(220, styleMidLift, true);
    dv.setFloat32(224, godRaysEnabled ? 1.0 : 0.0, true);
    dv.setFloat32(228, godRayStrength, true);
    dv.setFloat32(232, godRayLength, true);
    dv.setFloat32(236, godRayFalloff, true);
    dv.setFloat32(240, alphaFloor, true);
    dv.setFloat32(244, fogDensity, true);
    dv.setFloat32(248, fogHorizon, true);
    dv.setFloat32(252, fogSun, true);
    dv.setFloat32(256, silverIntensity, true);
    dv.setFloat32(260, silverExponent, true);
    dv.setFloat32(264, outputWidth, true);
    dv.setFloat32(268, outputHeight, true);
    writeVec3Padded(dv, 272, boxCenter);
    writeVec3Padded(dv, 288, boxHalf);
    const aircraftPosition=opts.aircraft?.position || camPos.map((v,i)=>v+fwd[i]*2.4-up[i]*.55);
    dv.setFloat32(172, aircraftPosition[0], true);
    dv.setFloat32(188, aircraftPosition[1], true);
    dv.setFloat32(284, aircraftPosition[2], true);
    dv.setFloat32(300, opts.aircraft?.yaw || 0, true);

    this._writeIfChanged("render", this.renderParams, this._abRender);
  }

  _ensureCanvasConfigured(canvas, format = "bgra8unorm", opts = {}) {
    if (!canvas) throw new Error("_ensureCanvasConfigured: canvas required");

    const max2D =
      (this.device &&
        this.device.limits &&
        this.device.limits.maxTextureDimension2D) ||
      16384;

    const cssW0 = opts.cssWidth ?? canvas.clientWidth ?? canvas.width ?? 1;
    const cssH0 = opts.cssHeight ?? canvas.clientHeight ?? canvas.height ?? 1;

    const cssW = Math.max(1, Math.round(cssW0));
    const cssH = Math.max(1, Math.round(cssH0));

    const dprRaw = opts.dpr ?? (window.devicePixelRatio || 1);
    const dpr = Math.max(1, Math.floor(dprRaw));

    let displayW =
      opts.pixelWidth != null
        ? Math.max(1, opts.pixelWidth | 0)
        : Math.max(1, Math.floor(cssW * dpr));
    let displayH =
      opts.pixelHeight != null
        ? Math.max(1, opts.pixelHeight | 0)
        : Math.max(1, Math.floor(cssH * dpr));

    if (displayW > max2D || displayH > max2D) {
      const s = Math.min(max2D / displayW, max2D / displayH);
      displayW = Math.max(1, Math.floor(displayW * s));
      displayH = Math.max(1, Math.floor(displayH * s));
    }

    let ctxRec = this._ctxCache.get(canvas);
    if (!ctxRec) {
      const ctx = canvas.getContext("webgpu");
      if (!ctx) throw new Error("failed to get webgpu context");
      ctxRec = { ctx, format: null };
      this._ctxCache.set(canvas, ctxRec);
    }
    const { ctx } = ctxRec;

    let state = this._canvasStates.get(canvas);
    if (!state) {
      state = { lastSize: [0, 0], hasContent: false };
      this._canvasStates.set(canvas, state);
    }

    if (
      state.lastSize[0] !== displayW ||
      state.lastSize[1] !== displayH ||
      ctxRec.format !== format
    ) {
      ctx.configure({
        device: this.device,
        format,
        alphaMode: "opaque",
        size: [displayW, displayH],
      });
      state.lastSize = [displayW, displayH];
      state.hasContent = false;
      ctxRec.format = format;
    }

    return { ctx, state, displayW, displayH };
  }

  renderToCanvas(canvas, opts = {}) {
    if (!this.outView)
      throw new Error(
        "Nothing to render: run dispatch() first or setOutputView().",
      );

    const { pipe, bgl, samp, format } =
      this._ensureRenderPipeline("bgra8unorm");

    if (opts.displayWidth || opts.displayHeight) {
      const w =
        opts.displayWidth ||
        Math.round((opts.displayHeight * this.width) / this.height);
      const h =
        opts.displayHeight ||
        Math.round((opts.displayWidth * this.height) / this.width);
      canvas.style.width = `${Math.max(1, Math.floor(w))}px`;
      canvas.style.height = `${Math.max(1, Math.floor(h))}px`;
      canvas.style.removeProperty("aspect-ratio");
    }

    const { ctx, state, displayW, displayH } = this._ensureCanvasConfigured(
      canvas,
      format,
      opts,
    );

    const skyColor = opts.skyColor ?? [0.55, 0.7, 0.95];

    if (!this._lastHadWork || !this.outView) {
      const enc = this.device.createCommandEncoder();
      const tex = ctx.getCurrentTexture();
      const pass = enc.beginRenderPass({
        colorAttachments: [
          {
            view: tex.createView(),
            loadOp: "clear",
            clearValue: {
              r: skyColor[0],
              g: skyColor[1],
              b: skyColor[2],
              a: 1,
            },
            storeOp: "store",
          },
        ],
      });
      pass.end();
      this.queue.submit([enc.finish()]);
      state.hasContent = true;
      return;
    }

    const inferredAspect = (displayH > 0 ? displayW / displayH : 1.0) || 1.0;

    let renderOpts = opts;
    const hasAspect =
      Object.prototype.hasOwnProperty.call(opts || {}, "aspect") ||
      (opts.cam && Object.prototype.hasOwnProperty.call(opts.cam, "aspect"));

    if (!hasAspect) {
      renderOpts = { ...opts, aspect: inferredAspect };
      if (
        opts.cam &&
        opts.cam.camPos &&
        opts.cam.right &&
        opts.cam.up &&
        opts.cam.fwd
      ) {
        renderOpts.cam = { ...opts.cam, aspect: inferredAspect };
        delete renderOpts.aspect;
      }
    }

    this._writeRenderUniforms(renderOpts);
    const bundle = this._getOrCreateRenderBundle(canvas, pipe, bgl, samp);

    const enc = this.device.createCommandEncoder();
    const tex = ctx.getCurrentTexture();
    const loadOp = state.hasContent ? "load" : "clear";
    const pass = enc.beginRenderPass({
      colorAttachments: [
        {
          view: tex.createView(),
          loadOp,
          clearValue: { r: skyColor[0], g: skyColor[1], b: skyColor[2], a: 1 },
          storeOp: "store",
        },
      ],
    });
    pass.executeBundles([bundle]);
    pass.end();
    this.queue.submit([enc.finish()]);
    state.hasContent = true;
  }
}
