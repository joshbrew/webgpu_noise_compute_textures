// clouds.js
// CloudComputeBuilder matching updated clouds.wgsl uniform layout (CloudOptions, CloudParams, NoiseTransforms, CloudTuning)

import cloudWGSL from "./clouds.wgsl";
import previewWGSL from "./cloudsRender.wgsl";

const _has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);

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

    // CloudParams (updated shader): 80 bytes
    this._abParams = new ArrayBuffer(80);
    this._dvParams = new DataView(this._abParams);

    // NoiseTransforms (updated shader): 112 bytes
    this._abNTransform = new ArrayBuffer(112);
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

    // Reproj: 48 bytes (40 used, 8 padding)
    this._abReproj = new ArrayBuffer(48);
    this._dvReproj = new DataView(this._abReproj);

    // Perf: 16 bytes
    this._abPerf = new ArrayBuffer(16);
    this._dvPerf = new DataView(this._abPerf);

    // TUNE: 256 bytes
    this._abTuning = new ArrayBuffer(256);
    this._dvTuning = new DataView(this._abTuning);

    // Preview render params: 128 bytes
    this._abRender = new ArrayBuffer(128);
    this._dvRender = new DataView(this._abRender);

    // Upsample params: 32 bytes
    this._abUpsample = new ArrayBuffer(32);
    this._dvUpsample = new DataView(this._abUpsample);

    // GPU buffers (created in _initBuffers)
    this.optionsBuffer = null;
    this.paramsBuffer = null;
    this.nTransformBuffer = null;
    this.dummyBuffer = null;
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

    this._render = null;
    this._ctxCache = new WeakMap();
    this._canvasStates = new WeakMap();
    this._renderBgCache = new WeakMap();
    this._renderBundleCache = new WeakMap();

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
        globalCoverage: 0.6,
        globalDensity: 1.0,
        cloudAnvilAmount: 0.0,
        cloudBeer: 6.0,
        attenuationClamp: 0.2,
        inScatterG: 0.2,
        silverIntensity: 2.5,
        silverExponent: 2.0,
        outScatterG: 0.1,
        inVsOut: 0.5,
        outScatterAmbientAmt: 0.9,
        ambientMinimum: 0.2,
        sunColor: [1.0, 0.95, 0.9],
        densityDivMin: 0.001,
        silverDirectionBias: 0.0,
        silverHorizonBoost: 0.0,
      },
      ntransform: {
        shapeOffsetWorld: [0, 0, 0],
        detailOffsetWorld: [0, 0, 0],
        shapeScale: 0.1,
        detailScale: 1.0,
        weatherScale: 1.0,
        shapeAxisScale: [1, 1, 1],
        detailAxisScale: [1, 1, 1],
        weatherOffsetWorld: [0, 0, 0],
        weatherAxisScale: [1, 1, 1],
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
      },
      perf: {
        lodBiasMul: 1.0,
        coarseMipBias: 0.0,
      },
      light: {
        sunDir: [-0.4, 0.8, 0.45],
        camPos: [0, 0, 2],
      },
      box: {
        center: [0, 0, 0],
        half: [1, 0.6, 1],
        uvScale: 1.5,
      },
      tuning: {
        maxSteps: 256,
        minStep: 0.003,
        maxStep: 0.1,
        sunSteps: 4,
        sunStride: 4,
        sunMinTr: 0.005,
        phaseJitter: 1.0,
        stepJitter: 0.08,
        baseJitterFrac: 0.15,
        topJitterFrac: 0.1,
        lodBiasWeather: 1.5,
        aabbFaceOffset: 0.0015,
        weatherRejectGate: 0.99,
        weatherRejectMip: 1.0,
        emptySkipMult: 3.0,
        nearFluffDist: 60.0,
        nearStepScale: 0.3,
        nearLodBias: -1.5,
        nearDensityMult: 2.5,
        nearDensityRange: 45.0,
        lodBlendThreshold: 0.05,
        sunDensityGate: 0.015,
        fflyRelClamp: 2.5,
        fflyAbsFloor: 1.5,
        taaRelMin: 0.22,
        taaRelMax: 1.1,
        taaAbsEps: 0.02,
        farStart: 800.0,
        farFull: 2500.0,
        farLodPush: 0.8,
        farDetailAtten: 0.5,
        farStepMult: 1.6,
        bnFarScale: 0.35,
        farTaaHistoryBoost: 1.35,
        raySmoothDens: 0.5,
        raySmoothSun: 0.5,
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

  _sum32(ab) {
    const u = new Uint32Array(ab);
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
      this.queue.writeBuffer(gpuBuf, 0, new Uint8Array(ab));
      this._lastSums.set(tag, { sum, len: ab.byteLength });
    }
  }

  _ensureComputeFormat(format) {
    const fmt = format || this.outFormat;
    if (fmt === this.outFormat && this.pipeline && this.bgl0) return;
    this.outFormat = fmt;

    const d = this.device;

    // group(0) bindings must match updated shader:
    // 0 opt, 1 C, 2 unused storage, 3 NTransform, 4 outTex, 5 posBuf, 6 frame, 7 historyOut, 8 reproj, 9 perf, 10 TUNE
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
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
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

    this.pipeline = d.createComputePipeline({
      layout: d.createPipelineLayout({
        bindGroupLayouts: [this.bgl0, this.bgl1],
      }),
      compute: { module: this.module, entryPoint: "computeCloud" },
    });

    this._destroyDummyHistory();
    this._createDummyHistory();

    this._bg0Cache.clear();
    this._bg0Keys.length = 0;
    this._bg0Dirty = true;
    this._currentBg0 = null;

    this._ensureUpsamplePipeline(this.outFormat);
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
    this.module = d.createShaderModule({ code: cloudWGSL });

    // group(1) must match updated shader:
    // 0 weather2D, 1 samp2D, 2 shape3D, 3 sampShape, 4 blueTex, 5 sampBN, 6 detail3D, 7 sampDetail,
    // 8 L, 9 V, 10 B, 11 historyPrev, 12 sampHistory, 13 motionTex, 14 sampMotion, 15 depthPrev, 16 sampDepth
    this.bgl1 = d.createBindGroupLayout({
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
          binding: 12,
          visibility: GPUShaderStage.COMPUTE,
          sampler: { type: "filtering" },
        },
        {
          binding: 13,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float", viewDimension: "2d" },
        },
        {
          binding: 14,
          visibility: GPUShaderStage.COMPUTE,
          sampler: { type: "filtering" },
        },
        {
          binding: 15,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float", viewDimension: "2d" },
        },
        {
          binding: 16,
          visibility: GPUShaderStage.COMPUTE,
          sampler: { type: "filtering" },
        },
      ],
    });

    // samplers (shader uses manual wrap helpers anyway, keep repeat for maps)
    this._samp2D = d.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
    });
    this._sampShape = d.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
      addressModeW: "repeat",
    });
    this._sampDetail = d.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
      addressModeW: "repeat",
    });
    this._sampBN = d.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
    });

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
      new Uint8Array([128]),
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
      usage:
        GPUBufferUsage.UNIFORM |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    this.paramsBuffer = d.createBuffer({
      size: 80,
      usage:
        GPUBufferUsage.UNIFORM |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    this.nTransformBuffer = d.createBuffer({
      size: 112,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.dummyBuffer = d.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
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
      usage:
        GPUBufferUsage.UNIFORM |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
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
      size: 48,
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
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this._upsampleParamsBuffer = d.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.queue.writeBuffer(this.dummyBuffer, 0, new Uint8Array(4));
  }

  // -------------------- UBO setters --------------------
  setOptions(opts = {}) {
    const s = this._state.options;

    if (_has(opts, "useCustomPos")) s.useCustomPos = !!opts.useCustomPos;
    if (_has(opts, "outputChannel"))
      s.outputChannel = opts.outputChannel >>> 0 || 0;
    if (_has(opts, "writeRGB")) s.writeRGB = !!opts.writeRGB;

    // Accept either r0..r3, or legacy names mapped into _r0.._r3
    if (_has(opts, "r0")) s.r0 = +opts.r0 || 0.0;
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
    this._bg0Dirty = true;
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

    // tail (16 bytes)
    dv.setFloat32(64, s.densityDivMin, true);
    dv.setFloat32(68, s.silverDirectionBias, true);
    dv.setFloat32(72, s.silverHorizonBoost, true);
    dv.setFloat32(76, 0.0, true);

    this._writeIfChanged("params", this.paramsBuffer, this._abParams);
    this._bg0Dirty = true;
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

    this._writeIfChanged(
      "ntransform",
      this.nTransformBuffer,
      this._abNTransform,
    );
    this._bg0Dirty = true;
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
    dv.setUint32(40, 0, true);
    dv.setUint32(44, 0, true);

    this._reprojFullW = s.fullWidth | 0;
    this._reprojFullH = s.fullHeight | 0;

    this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
    this._bg0Dirty = true;
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
    this._bg0Dirty = true;
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
    this._bg1Dirty = true;
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
    this._bg1Dirty = true;
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

  setViewFromCamera({
    camPos = [0, 0, 3],
    right = [1, 0, 0],
    up = [0, 1, 0],
    fwd = [0, 0, 1],
    fovYDeg = 60,
    aspect = 1,
    planetRadius = 0.0,
    cloudBottom = -1.0,
    cloudTop = 1.0,
    worldToUV = 1.0,
    stepBase = 0.02,
    stepInc = 0.04,
    volumeLayers = 1,
  } = {}) {
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

    const floats = [
      camPos[0],
      camPos[1],
      camPos[2],
      0,
      r[0],
      r[1],
      r[2],
      0,
      u[0],
      u[1],
      u[2],
      0,
      f[0],
      f[1],
      f[2],
      0,
      (fovYDeg * Math.PI) / 180,
      aspect,
      stepBase,
      stepInc,
      planetRadius,
      cloudBottom,
      cloudTop,
      volumeLayers,
      worldToUV,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ];

    for (let i = 0; i < floats.length; i++)
      dv.setFloat32(i * 4, floats[i], true);
    this._writeIfChanged("view", this.viewBuffer, this._abView);
    this._bg1Dirty = true;
  }

  // -------------------- TUNE setter (CloudTuning) --------------------
  setTuning(t = {}) {
    const s = this._state.tuning;
    for (const k in t) if (_has(t, k)) s[k] = t[k];

    const dv = this._dvTuning;
    let o = 0;

    dv.setInt32(o, s.maxSteps | 0, true);
    o += 4;
    dv.setInt32(o, 0, true);
    o += 4;
    dv.setFloat32(o, +s.minStep, true);
    o += 4;
    dv.setFloat32(o, +s.maxStep, true);
    o += 4;

    dv.setInt32(o, s.sunSteps | 0, true);
    o += 4;
    dv.setInt32(o, s.sunStride | 0, true);
    o += 4;
    dv.setFloat32(o, +s.sunMinTr, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, +s.phaseJitter, true);
    o += 4;
    dv.setFloat32(o, +s.stepJitter, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, +s.baseJitterFrac, true);
    o += 4;
    dv.setFloat32(o, +s.topJitterFrac, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, +s.lodBiasWeather, true);
    o += 4;
    dv.setFloat32(o, +s.aabbFaceOffset, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, +s.weatherRejectGate, true);
    o += 4;
    dv.setFloat32(o, +s.weatherRejectMip, true);
    o += 4;
    dv.setFloat32(o, +s.emptySkipMult, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, +s.nearFluffDist, true);
    o += 4;
    dv.setFloat32(o, +s.nearStepScale, true);
    o += 4;
    dv.setFloat32(o, +s.nearLodBias, true);
    o += 4;
    dv.setFloat32(o, +s.nearDensityMult, true);
    o += 4;
    dv.setFloat32(o, +s.nearDensityRange, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, +s.lodBlendThreshold, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, +s.sunDensityGate, true);
    o += 4;
    dv.setFloat32(o, +s.fflyRelClamp, true);
    o += 4;
    dv.setFloat32(o, +s.fflyAbsFloor, true);
    o += 4;
    dv.setFloat32(o, +s.taaRelMin, true);
    o += 4;
    dv.setFloat32(o, +s.taaRelMax, true);
    o += 4;
    dv.setFloat32(o, +s.taaAbsEps, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, +s.farStart, true);
    o += 4;
    dv.setFloat32(o, +s.farFull, true);
    o += 4;
    dv.setFloat32(o, +s.farLodPush, true);
    o += 4;
    dv.setFloat32(o, +s.farDetailAtten, true);
    o += 4;
    dv.setFloat32(o, +s.farStepMult, true);
    o += 4;
    dv.setFloat32(o, +s.bnFarScale, true);
    o += 4;
    dv.setFloat32(o, +s.farTaaHistoryBoost, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, +s.raySmoothDens, true);
    o += 4;
    dv.setFloat32(o, +s.raySmoothSun, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    for (let i = o; i < this._abTuning.byteLength; i += 4)
      dv.setUint32(i, 0, true);

    this._writeIfChanged("tuning", this.tuningBuffer, this._abTuning);
    this._bg0Dirty = true;
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
    this.historyOutView = view;
    this._bg0Dirty = true;
  }

  // -------------------- outputs --------------------
  createOutputTexture(width, height, layers = 1, format = "rgba16float") {
    this._ensureComputeFormat(format);

    if (
      this.outTexture &&
      this.width === width &&
      this.height === height &&
      this.layers === layers &&
      this.outFormat === format
    ) {
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

      const curFW = this._dvReproj.getUint32(32, true) || 0;
      const curFH = this._dvReproj.getUint32(36, true) || 0;
      if (
        curFW !== this._reprojFullW >>> 0 ||
        curFH !== this._reprojFullH >>> 0
      ) {
        this._dvReproj.setUint32(32, this._reprojFullW >>> 0, true);
        this._dvReproj.setUint32(36, this._reprojFullH >>> 0, true);
        this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
        this._bg0Dirty = true;
      }
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

    this.outTexture = this.device.createTexture({
      size: [width, height, layers],
      format: this.outFormat,
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.outView = this.outTexture.createView({
      dimension: "2d-array",
      arrayLayerCount: layers,
    });

    this.width = width;
    this.height = height;
    this.layers = layers;

    this._reprojFullW = width;
    this._reprojFullH = height;
    this._dvReproj.setUint32(32, this._reprojFullW >>> 0, true);
    this._dvReproj.setUint32(36, this._reprojFullH >>> 0, true);
    this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);

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

    this._bg0Dirty = true;
    this._bg1Dirty = true;
    this._renderBgCache = new WeakMap();
    this._renderBundleCache = new WeakMap();
    this._lastHadWork = false;

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
      this._getResId(this.dummyBuffer),
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
      this._getResId(this._samp2D),
      this._getResId(this.motionView || this._dummy2DMotionView),
      this._getResId(this._samp2D),
      this._getResId(this.depthPrevView || this._dummy2DDepthView),
      this._getResId(this._samp2D),
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
        { binding: 2, resource: { buffer: this.dummyBuffer } },
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
        { binding: 12, resource: this._samp2D },
        { binding: 13, resource: motionView },
        { binding: 14, resource: this._samp2D },
        { binding: 15, resource: depthView },
        { binding: 16, resource: this._samp2D },
      ],
    });
  }

  _makeBindGroups() {
    const k0 = this._buildBg0Key();
    if (!this._bg0Dirty && this._bg0Cache.has(k0))
      this._currentBg0 = this._bg0Cache.get(k0);
    else {
      if (this._bg0Cache.has(k0) && this._bg0Dirty) {
        const idx = this._bg0Keys.indexOf(k0);
        if (idx >= 0) this._bg0Keys.splice(idx, 1);
        this._bg0Cache.delete(k0);
      }
      const bg0 = this._createBg0ForKey();
      this._bg0Cache.set(k0, bg0);
      this._bg0Keys.push(k0);
      this._currentBg0 = bg0;
      this._bg0Dirty = false;
      while (this._bg0Keys.length > 12) {
        const oldest = this._bg0Keys.shift();
        this._bg0Cache.delete(oldest);
      }
    }

    const k1 = this._buildBg1Key();
    if (!this._bg1Dirty && this._bg1Cache.has(k1))
      this._currentBg1 = this._bg1Cache.get(k1);
    else {
      if (this._bg1Cache.has(k1) && this._bg1Dirty) {
        const idx = this._bg1Keys.indexOf(k1);
        if (idx >= 0) this._bg1Keys.splice(idx, 1);
        this._bg1Cache.delete(k1);
      }
      const bg1 = this._createBg1ForKey();
      this._bg1Cache.set(k1, bg1);
      this._bg1Keys.push(k1);
      this._currentBg1 = bg1;
      this._bg1Dirty = false;
      while (this._bg1Keys.length > 12) {
        const oldest = this._bg1Keys.shift();
        this._bg1Cache.delete(oldest);
      }
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
      return await this.dispatchRectNoCoarse({
        x: baseX,
        y: baseY,
        w: tw,
        h: th,
        wait,
      });

    const cW = Math.max(1, Math.ceil(tw / cf));
    const cH = Math.max(1, Math.ceil(th / cf));
    this._ensureCoarseTexture(cW, cH, this.layers);

    const savedFullW = this._reprojFullW || this.width;
    const savedFullH = this._reprojFullH || this.height;

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
    if (curFW !== savedFullW >>> 0 || curFH !== savedFullH >>> 0) {
      this._dvReproj.setUint32(32, savedFullW >>> 0, true);
      this._dvReproj.setUint32(36, savedFullH >>> 0, true);
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
      this._bg0Dirty = true;
    }

    await this._dispatchComputeInternal({ wait });

    this.outTexture = savedOutTexture;
    this.outView = savedOutView;
    this.width = savedWidth;
    this.height = savedHeight;
    this.outFormat = savedFormat;

    this.setFrame({
      fullWidth: savedWidth,
      fullHeight: savedHeight,
      tileWidth: tw,
      tileHeight: th,
      originX: baseX,
      originY: baseY,
      originZ: 0,
      layerIndex: this._dvFrame.getInt32(36, true) | 0,
      originXf: 0.0,
      originYf: 0.0,
    });

    await this._upsampleCoarseToOut({
      srcW: cW,
      srcH: cH,
      dstX: baseX,
      dstY: baseY,
      dstW: tw,
      dstH: th,
      wait,
    });

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
    const cf = Math.max(1, coarseFactor | 0);

    if (cf >= 2 && this.outTexture) {
      const cW = Math.max(1, Math.ceil(this.width / cf));
      const cH = Math.max(1, Math.ceil(this.height / cf));
      this._ensureCoarseTexture(cW, cH, this.layers);

      const savedFullW = this._reprojFullW || this.width;
      const savedFullH = this._reprojFullH || this.height;

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

      this.setFrame({
        fullWidth: cW,
        fullHeight: cH,
        tileWidth: cW,
        tileHeight: cH,
        originX: 0,
        originY: 0,
        originZ: 0,
        layerIndex: 0,
        originXf: 0.0,
        originYf: 0.0,
      });

      const curFW = this._dvReproj.getUint32(32, true) || 0;
      const curFH = this._dvReproj.getUint32(36, true) || 0;
      if (curFW !== savedFullW >>> 0 || curFH !== savedFullH >>> 0) {
        this._dvReproj.setUint32(32, savedFullW >>> 0, true);
        this._dvReproj.setUint32(36, savedFullH >>> 0, true);
        this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
        this._bg0Dirty = true;
      }

      await this._dispatchComputeInternal({ wait });

      this.outTexture = savedOutTexture;
      this.outView = savedOutView;
      this.width = savedWidth;
      this.height = savedHeight;
      this.outFormat = savedFormat;

      await this._upsampleCoarseToOut({
        srcW: cW,
        srcH: cH,
        dstX: 0,
        dstY: 0,
        dstW: this.width,
        dstH: this.height,
        wait,
      });

      this._lastHadWork = true;
      return this.outView;
    }

    await this._dispatchComputeInternal({ wait });
    this._lastHadWork = true;
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
      const pass = enc.beginComputePass();
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this._currentBg0);
      pass.setBindGroup(1, this._currentBg1);
      pass.dispatchWorkgroups(this._wgX, this._wgY, 1);
      pass.end();
    }
    this.queue.submit([enc.finish()]);
    if (wait && typeof this.queue.onSubmittedWorkDone === "function")
      await this.queue.onSubmittedWorkDone();
    this._lastHadWork = true;
    return this.outView;
  }

  async _dispatchComputeInternal({ wait = false } = {}) {
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

    this._makeBindGroups();

    const enc = this.device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this._currentBg0);
    pass.setBindGroup(1, this._currentBg1);
    pass.dispatchWorkgroups(this._wgX, this._wgY, 1);
    pass.end();
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

      @compute @workgroup_size(8, 8, 1)
      fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
        let x = gid.x;
        let y = gid.y;
        if (x >= P.dstW || y >= P.dstH) { return; }

        let uv = (vec2<f32>(f32(x) + 0.5, f32(y) + 0.5)) / vec2<f32>(max(f32(P.dstW), 1.0), max(f32(P.dstH), 1.0));
        let c = textureSampleLevel(srcTex, samp, uv, i32(P.layer), 0.0);

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
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    this._upsample = { pipe, bgl, samp, format: fmt, bgCache: new Map() };
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

  async _upsampleCoarseToOut({
    srcW,
    srcH,
    dstX,
    dstY,
    dstW,
    dstH,
    wait = false,
  } = {}) {
    if (!this._coarseView || !this.outView) return;

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
      new Uint8Array(this._abUpsample),
    );

    const bg = this._getOrCreateUpsampleBindGroup(
      this._coarseView,
      this.outView,
    );

    const wgX = Math.max(1, Math.ceil(dstW / 8));
    const wgY = Math.max(1, Math.ceil(dstH / 8));

    const enc = this.device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(u.pipe);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgX, wgY, 1);
    pass.end();
    this.queue.submit([enc.finish()]);

    if (wait && typeof this.queue.onSubmittedWorkDone === "function")
      await this.queue.onSubmittedWorkDone();
  }

  // -------------------- preview render --------------------
  _ensureRenderPipeline(format = "bgra8unorm") {
    if (this._render && this._render.format === format) return this._render;
    const mod = this.device.createShaderModule({ code: previewWGSL });
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
    const pipe = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      vertex: { module: mod, entryPoint: "vs_main" },
      fragment: { module: mod, entryPoint: "fs_main", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });
    const samp = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
    this._render = { pipe, bgl, samp, format };
    return this._render;
  }

  _getOrCreateRenderBindGroup(canvas, bgl, samp) {
    let map = this._renderBgCache.get(canvas);
    if (!map) {
      map = new Map();
      this._renderBgCache.set(canvas, map);
    }
    const key =
      this._getResId(this.outView) +
      "|" +
      this._getResId(samp) +
      "|" +
      this._getResId(this.renderParams);
    if (map.has(key)) return map.get(key);
    const bg = this.device.createBindGroup({
      layout: bgl,
      entries: [
        { binding: 0, resource: samp },
        { binding: 1, resource: this.outView },
        {
          binding: 2,
          resource: { buffer: this.renderParams, offset: 0, size: 128 },
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
      this._getResId(this.outView) +
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
    const exposure = opts.exposure ?? 1.2;
    const sunBloom = opts.sunBloom ?? 0.0;
    const skyColor = opts.skyColor ?? [0.55, 0.7, 0.95];

    const rad = (d) => (d * Math.PI) / 180;
    const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const len = (a) => Math.hypot(a[0], a[1], a[2]) || 1;
    const norm = (a) => {
      const L = len(a);
      return [a[0] / L, a[1] / L, a[2] / L];
    };
    const wv3 = (ofs, v) => {
      dv.setFloat32(ofs, v[0], true);
      dv.setFloat32(ofs + 4, v[1], true);
      dv.setFloat32(ofs + 8, v[2], true);
      dv.setFloat32(ofs + 12, 0.0, true);
    };

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
      fovYRad = ((opts.cam.fovYDeg ?? 60) * Math.PI) / 180;
      aspect = opts.cam.aspect ?? 1.0;
      sunDir = opts.sunDir ?? [0, 1, 0];
    } else {
      const yaw = rad(opts.yawDeg ?? 0);
      const pitch = rad(opts.pitchDeg ?? 0);
      const cp = Math.cos(pitch),
        sp = Math.sin(pitch);
      const cy = Math.cos(yaw),
        sy = Math.sin(yaw);
      fwd = norm([sy * cp, sp, cy * cp]);
      const upRef =
        Math.abs(dot(fwd, [0, 1, 0])) > 0.999 ? [0, 0, 1] : [0, 1, 0];
      right = norm(cross(upRef, fwd));
      up = cross(fwd, right);
      const zoom = opts.zoom ?? 3.0;
      camPos = [-fwd[0] * zoom, -fwd[1] * zoom, -fwd[2] * zoom];
      fovYRad = rad(opts.fovYDeg ?? 60);
      aspect = opts.aspect ?? 1.0;
      const sAz = rad(opts.sunAzimuthDeg ?? 45);
      const sEl = rad(opts.sunElevationDeg ?? 20);
      const cel = Math.cos(sEl);
      sunDir = norm([cel * Math.sin(sAz), Math.sin(sEl), cel * Math.cos(sAz)]);
    }

    dv.setUint32(0, layerIndex, true);
    dv.setUint32(4, 0, true);
    dv.setUint32(8, 0, true);
    dv.setUint32(12, 0, true);
    wv3(16, camPos);
    wv3(32, right);
    wv3(48, up);
    wv3(64, fwd);
    dv.setFloat32(80, fovYRad, true);
    dv.setFloat32(84, aspect, true);
    dv.setFloat32(88, exposure, true);
    dv.setFloat32(92, sunBloom, true);
    wv3(96, sunDir);
    wv3(112, skyColor);

    this._writeIfChanged("render", this.renderParams, this._abRender);
  }

  _ensureCanvasConfigured(canvas, format = "bgra8unorm") {
    if (!canvas) throw new Error("_ensureCanvasConfigured: canvas required");
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const clientW = Math.max(1, Math.round(canvas.clientWidth));
    const clientH = Math.max(1, Math.round(canvas.clientHeight));
    const displayW = Math.max(1, Math.floor(clientW * dpr));
    const displayH = Math.max(1, Math.floor(clientH * dpr));

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
    return { ctx, state };
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

    const { ctx, state } = this._ensureCanvasConfigured(canvas, format);
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

    this._writeRenderUniforms(opts);
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
