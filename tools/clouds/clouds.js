// clouds.js
// Streamlined CloudComputeBuilder with CloudTuning (TUNE) UBO support
import cloudWGSL from "./clouds.wgsl";
import previewWGSL from "./cloudsRender.wgsl";

export class CloudComputeBuilder {
  constructor(device, queue) {
    this.device = device;
    this.queue = queue;

    // ---- external resources (setInputMaps) ----
    this.weatherView = null;
    this.shape3DView = null;
    this.detail3DView = null;
    this.blueTex = null; // optionally owned
    this.blueView = null;
    this.motionView = null;
    this.depthPrevView = null;
    this.historyPrevView = null;
    this.historyOutView = null;

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

    // buffers (UBOs, staging ABs)
    // sizes chosen to match prior layout, keep for compatibility
    this._abOptions = new ArrayBuffer(32);
    this._dvOptions = new DataView(this._abOptions);

    // NOTE: extended CloudParams to 96 bytes to include shapeScale & detailScale
    this._abParams = new ArrayBuffer(96);
    this._dvParams = new DataView(this._abParams); // CloudParams (96 bytes)

    this._abOffsets = new ArrayBuffer(48);
    this._dvOffsets = new DataView(this._abOffsets);
    this._abFrame = new ArrayBuffer(64);
    this._dvFrame = new DataView(this._abFrame);
    this._abLight = new ArrayBuffer(32);
    this._dvLight = new DataView(this._abLight);
    this._abView = new ArrayBuffer(128);
    this._dvView = new DataView(this._abView);
    this._abBox = new ArrayBuffer(32);
    this._dvBox = new DataView(this._abBox);
    this._abSampling = new ArrayBuffer(16);
    this._dvSampling = new DataView(this._abSampling);
    this._abReproj = new ArrayBuffer(48);
    this._dvReproj = new DataView(this._abReproj);
    this._abPerf = new ArrayBuffer(16);
    this._dvPerf = new DataView(this._abPerf);

    // TUNE staging - roomy (256) to match prior
    this._abTuning = new ArrayBuffer(256);
    this._dvTuning = new DataView(this._abTuning);

    this._abRender = new ArrayBuffer(128);
    this._dvRender = new DataView(this._abRender);
    // useful small buffers
    this._abDummy32 = new ArrayBuffer(4);

    // actual GPU buffers (created in _initBuffers)
    this.optionsBuffer = null;
    this.paramsBuffer = null;
    this.offsetsBuffer = null;
    this.dummyBuffer = null;
    this.posBuffer = null;
    this.frameBuffer = null;
    this.lightBuffer = null;
    this.viewBuffer = null;
    this.boxBuffer = null;
    this.samplingBuffer = null;
    this.reprojBuffer = null;
    this.perfBuffer = null;
    this.tuningBuffer = null;
    this.renderParams = null;

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
    this._upsampleBgCache = new Map();

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

    // init GPU objects
    this._initCompute();
    this._initBuffers();

    // defaults & initial uploads
    this.setOptions();
    this.setParams();
    this.setTileScaling({
      shapeOffsetWorld: [0, 0],
      detailOffsetWorld: [0, 0],
    });
    this.setSamplingOpts({ useManualWrap: 0, weatherLayer: 0 });
    this.setReprojSettings({
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
    });
    this.setPerfParams();
    this.setSunByAngles();
    this.setBox();
    this.setTuning(); // write initial TUNE defaults
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

  _forceWrite(tag, gpuBuf, ab) {
    this.queue.writeBuffer(gpuBuf, 0, new Uint8Array(ab));
    const sum = this._sum32(ab);
    this._lastSums.set(tag, { sum, len: ab.byteLength });
  }

  // -------------------- init compute + resources --------------------
  _initCompute() {
    const d = this.device;
    this.module = d.createShaderModule({ code: cloudWGSL });

    // bgl0: UBOs + writable out + historyOut + reproj + perf + TUNE @10
    this.bgl0 = d.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // options
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // params
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        }, // dummy storage
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // offsets
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: "write-only",
            format: this.outFormat,
            viewDimension: "2d-array",
          },
        }, // out
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        }, // pos
        {
          binding: 6,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // frame
        {
          binding: 7,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: "write-only",
            format: this.outFormat,
            viewDimension: "2d-array",
          },
        }, // historyOut or dummy
        {
          binding: 8,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // reproj
        {
          binding: 9,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // perf
        {
          binding: 10,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // tuning
      ],
    });

    // bgl1: textures, samplers, light, view, box, historyPrev, motion, depth
    this.bgl1 = d.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float", viewDimension: "2d-array" },
        }, // weather
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          sampler: { type: "filtering" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float", viewDimension: "3d" },
        }, // shape3D
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          sampler: { type: "filtering" },
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float", viewDimension: "2d-array" },
        }, // blue
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          sampler: { type: "filtering" },
        },
        {
          binding: 6,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float", viewDimension: "3d" },
        }, // detail3D
        {
          binding: 7,
          visibility: GPUShaderStage.COMPUTE,
          sampler: { type: "filtering" },
        },
        {
          binding: 8,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // light
        {
          binding: 9,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // view
        {
          binding: 10,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // box
        {
          binding: 11,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float", viewDimension: "2d-array" },
        }, // historyPrev
        {
          binding: 12,
          visibility: GPUShaderStage.COMPUTE,
          sampler: { type: "filtering" },
        },
        {
          binding: 13,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float", viewDimension: "2d" },
        }, // motion
        {
          binding: 14,
          visibility: GPUShaderStage.COMPUTE,
          sampler: { type: "filtering" },
        },
        {
          binding: 15,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float", viewDimension: "2d" },
        }, // depthPrev
        {
          binding: 16,
          visibility: GPUShaderStage.COMPUTE,
          sampler: { type: "filtering" },
        },
      ],
    });

    this.pipeline = d.createComputePipeline({
      layout: d.createPipelineLayout({
        bindGroupLayouts: [this.bgl0, this.bgl1],
      }),
      compute: { module: this.module, entryPoint: "computeCloud" },
    });

    // samplers
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

    // small dummy textures: motion/depth and tiny history
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

    // tiny dummy historyPrev/out (rgba16float 1x1)
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

  _initBuffers() {
    const d = this.device;
    this.optionsBuffer = d.createBuffer({
      size: 32,
      usage:
        GPUBufferUsage.UNIFORM |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    // paramsBuffer expanded to 96 to match new CloudParams layout
    this.paramsBuffer = d.createBuffer({
      size: 96,
      usage:
        GPUBufferUsage.UNIFORM |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    this.offsetsBuffer = d.createBuffer({
      size: 48,
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

    this.samplingBuffer = d.createBuffer({
      size: 16,
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

    // write a zero to dummy buffer
    this.queue.writeBuffer(this.dummyBuffer, 0, new Uint8Array(4));
  }

  // -------------------- UBO setters --------------------
  setOptions({
    useCustomPos = false,
    outputChannel = 0,
    writeRGB = true,
    debugForceFog = 0,
    temporalSeed = 0,
    windDisp = 0.0,
    windAngleRad = 0.0,
  } = {}) {
    const dv = this._dvOptions;
    dv.setUint32(0, useCustomPos ? 1 : 0, true);
    dv.setUint32(4, outputChannel >>> 0, true);
    dv.setUint32(8, writeRGB ? 1 : 0, true);
    dv.setUint32(12, 0, true);
    dv.setFloat32(16, debugForceFog, true);
    dv.setFloat32(20, temporalSeed, true);
    dv.setFloat32(24, windDisp, true);
    dv.setFloat32(28, windAngleRad, true);
    this._writeIfChanged("options", this.optionsBuffer, this._abOptions);
    this._bg0Dirty = true;
  }
  setTemporalSeed(seed = 0) {
    this._dvOptions.setFloat32(20, seed, true);
    this._writeIfChanged("options", this.optionsBuffer, this._abOptions);
    this._bg0Dirty = true;
  }

  setParams(p = {}) {
    // defaults updated to include the new CloudParams tunables
    const defaults = {
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
      // new fields (defaults chosen to be sensible; tweak as needed)
      densityDivMin: 0.001, // corresponds to thesis divmin (Eq.36)
      silverDirectionBias: 0.0, // bias applied to silver/backscatter dot
      silverHorizonBoost: 0.0,
      // tiling scales (new artist controls)
      shapeScale: 1.0,
      detailScale: 1.0,
    };
    const c = Object.assign({}, defaults, p);
    const dv = this._dvParams;

    // CloudParams layout (bytes):
    //  0..15   -> globalCoverage, globalDensity, cloudAnvilAmount, cloudBeer
    // 16..31   -> attenuationClamp, inScatterG, silverIntensity, silverExponent
    // 32..47   -> outScatterG, inVsOut, outScatterAmbientAmt, ambientMinimum
    // 48..63   -> sunColor (vec3) + padding at 60
    // 64..95   -> densityDivMin, silverDirectionBias, silverHorizonBoost, shapeScale, detailScale, padding...

    dv.setFloat32(0, c.globalCoverage, true); // 0
    dv.setFloat32(4, c.globalDensity, true); // 4
    dv.setFloat32(8, c.cloudAnvilAmount, true); // 8
    dv.setFloat32(12, c.cloudBeer, true); // 12

    dv.setFloat32(16, c.attenuationClamp, true); // 16
    dv.setFloat32(20, c.inScatterG, true); // 20
    dv.setFloat32(24, c.silverIntensity, true); // 24
    dv.setFloat32(28, c.silverExponent, true); // 28

    dv.setFloat32(32, c.outScatterG, true); // 32
    dv.setFloat32(36, c.inVsOut, true); // 36
    dv.setFloat32(40, c.outScatterAmbientAmt, true); // 40
    dv.setFloat32(44, c.ambientMinimum, true); // 44

    // sunColor is a vec3<f32> (occupies 16 bytes). write RGB into 48/52/56 and clear padding at 60.
    dv.setFloat32(48, c.sunColor[0], true); // 48
    dv.setFloat32(52, c.sunColor[1], true); // 52
    dv.setFloat32(56, c.sunColor[2], true); // 56
    dv.setFloat32(60, 0.0, true); // 60 padding (vec3 -> vec4 slot)

    // new CloudParams fields begin at byte 64
    dv.setFloat32(64, c.densityDivMin, true); // 64
    dv.setFloat32(68, c.silverDirectionBias, true); // 68
    dv.setFloat32(72, c.silverHorizonBoost, true); // 72
    dv.setFloat32(76, c.shapeScale, true); // 76
    dv.setFloat32(80, c.detailScale, true); // 80

    // pad out remaining bytes to keep buffer deterministic
    dv.setFloat32(84, 0.0, true); // 84
    dv.setFloat32(88, 0.0, true); // 88
    dv.setFloat32(92, 0.0, true); // 92

    // commit if changed
    this._writeIfChanged("params", this.paramsBuffer, this._abParams);
    this._bg0Dirty = true;
  }

  setTileScaling({
    shapeOffsetWorld = [0, 0, 0],
    detailOffsetWorld = [0, 0, 0],
    shapeScale = 0.1,
    detailScale = 1.0,
  } = {}) {
    const dv = this._dvOffsets;
    // shapeOffsetWorld : vec3<f32> at bytes 0..11
    dv.setFloat32(0, shapeOffsetWorld[0] || 0.0, true);
    dv.setFloat32(4, shapeOffsetWorld[1] || 0.0, true);
    dv.setFloat32(8, shapeOffsetWorld[2] || 0.0, true);
    // _pad0 : f32 at bytes 12..15
    dv.setFloat32(12, 0.0, true);

    // detailOffsetWorld : vec3<f32> at bytes 16..27
    dv.setFloat32(16, detailOffsetWorld[0] || 0.0, true);
    dv.setFloat32(20, detailOffsetWorld[1] || 0.0, true);
    dv.setFloat32(24, detailOffsetWorld[2] || 0.0, true);
    // _pad1 : f32 at bytes 28..31
    dv.setFloat32(28, 0.0, true);

    // shapeScale, detailScale and pad2 (vec2) at bytes 32..47
    dv.setFloat32(32, shapeScale, true); // shapeScale
    dv.setFloat32(36, detailScale, true); // detailScale
    dv.setFloat32(40, 0.0, true); // _pad2.x
    dv.setFloat32(44, 0.0, true); // _pad2.y

    this._writeIfChanged("offsets", this.offsetsBuffer, this._abOffsets);
    this._bg0Dirty = true;
  }

  setSamplingOpts({ useManualWrap = 0, weatherLayer = 0 } = {}) {
    const dv = this._dvSampling;
    dv.setUint32(0, useManualWrap >>> 0, true);
    dv.setUint32(4, weatherLayer >>> 0, true);
    dv.setUint32(8, 0, true);
    dv.setUint32(12, 0, true);
    this._writeIfChanged("sampling", this.samplingBuffer, this._abSampling);
  }
  setWeatherLayer(layer = 0) {
    this.setSamplingOpts({
      useManualWrap: this._dvSampling.getUint32(0, true),
      weatherLayer: layer,
    });
  }
  setManualWrap(on = true) {
    this.setSamplingOpts({
      useManualWrap: on ? 1 : 0,
      weatherLayer: this.getWeatherLayer(),
    });
  }
  getWeatherLayer() {
    return this._dvSampling.getUint32(4, true) || 0;
  }

  setReprojSettings({
    enabled = 0,
    subsample = 1,
    sampleOffset = 0,
    motionIsNormalized = 0,
    temporalBlend = 0.0,
    depthTest = 0,
    depthTolerance = 0.0,
    frameIndex = 0,
    fullWidth = 0,
    fullHeight = 0,
  } = {}) {
    const dv = this._dvReproj;
    dv.setUint32(0, enabled >>> 0, true);
    dv.setUint32(4, subsample >>> 0, true);
    dv.setUint32(8, sampleOffset >>> 0, true);
    dv.setUint32(12, motionIsNormalized >>> 0, true);
    dv.setFloat32(16, temporalBlend, true);
    dv.setUint32(20, depthTest >>> 0, true);
    dv.setFloat32(24, depthTolerance, true);
    dv.setUint32(28, frameIndex >>> 0, true);
    if (fullWidth) {
      dv.setUint32(32, fullWidth >>> 0, true);
      this._reprojFullW = fullWidth;
    }
    if (fullHeight) {
      dv.setUint32(36, fullHeight >>> 0, true);
      this._reprojFullH = fullHeight;
    }
    this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
    this._bg0Dirty = true;
  }
  setReprojFullResSize(fullWidth, fullHeight) {
    this._reprojFullW = fullWidth | 0;
    this._reprojFullH = fullHeight | 0;
    this._dvReproj.setUint32(32, this._reprojFullW >>> 0, true);
    this._dvReproj.setUint32(36, this._reprojFullH >>> 0, true);
    this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
    this._bg0Dirty = true;
  }

  setPerfParams({ lodBiasMul = 1.0, coarseMipBias = 0.0 } = {}) {
    const dv = this._dvPerf;
    dv.setFloat32(0, lodBiasMul, true);
    dv.setFloat32(4, coarseMipBias, true);
    dv.setFloat32(8, 0.0, true);
    dv.setFloat32(12, 0.0, true);
    this._writeIfChanged("perf", this.perfBuffer, this._abPerf);
    this._bg0Dirty = true;
  }

  setLight({ sunDir = [-0.4, 0.8, 0.45], camPos = [0, 0, 2] } = {}) {
    const dv = this._dvLight;
    dv.setFloat32(0, sunDir[0], true);
    dv.setFloat32(4, sunDir[1], true);
    dv.setFloat32(8, sunDir[2], true);
    dv.setFloat32(12, 0.0, true);
    dv.setFloat32(16, camPos[0], true);
    dv.setFloat32(20, camPos[1], true);
    dv.setFloat32(24, camPos[2], true);
    dv.setFloat32(28, 0.0, true);
    this._writeIfChanged("light", this.lightBuffer, this._abLight);
    this._bg1Dirty = true;
  }
  setSunByAngles({
    azimuthDeg = 45,
    elevationDeg = 35,
    camPos = [0, 0, 2],
  } = {}) {
    const az = (azimuthDeg * Math.PI) / 180,
      el = (elevationDeg * Math.PI) / 180;
    const sd = [
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az),
    ];
    this.setLight({ sunDir: sd, camPos });
  }

  setBox({ center = [0, 0, 0], half = [1, 0.6, 1], uvScale = 1.5 } = {}) {
    const dv = this._dvBox;
    dv.setFloat32(0, center[0], true);
    dv.setFloat32(4, center[1], true);
    dv.setFloat32(8, center[2], true);
    dv.setFloat32(12, 0.0, true);
    dv.setFloat32(16, half[0], true);
    dv.setFloat32(20, half[1], true);
    dv.setFloat32(24, half[2], true);
    dv.setFloat32(28, uvScale, true);
    this._writeIfChanged("box", this.boxBuffer, this._abBox);
    this._bg1Dirty = true;
  }

  setFrame({
    fullWidth = 0,
    fullHeight = 0,
    tileWidth = 0,
    tileHeight = 0,
    originX = 0,
    originY = 0,
    originZ = 0,
    fullDepth = 1,
    tileDepth = 1,
    layerIndex = 0,
    layers = 1,
    originXf = 0.0,
    originYf = 0.0,
  } = {}) {
    const dv = this._dvFrame;

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
    dv.setFloat32(48, originXf ?? 0.0, true);
    dv.setFloat32(52, originYf ?? 0.0, true);
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
  setSunByDirection({ dir = [0, 1, 0], camPos = [0, 0, 3] } = {}) {
    this.setLight({ sunDir: dir, camPos });
  }

  // -------------------- TUNE setter --------------------
  setTuning(t = {}) {
    // defaults (kept consistent with previous) + new styleBlend default
    const defaults = {
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
      // NEW: styleBlend slider (0 = old flat, 1 = new bulgy)
      styleBlend: 0.0,
    };
    const c = Object.assign({}, defaults, t);

    const dv = this._dvTuning;

    // write fields sequentially — keep layout stable for WGSL struct
    let o = 0;
    dv.setInt32(o, c.maxSteps | 0, true);
    o += 4;
    dv.setInt32(o, 0, true);
    o += 4; // pad
    dv.setFloat32(o, c.minStep, true);
    o += 4;
    dv.setFloat32(o, c.maxStep, true);
    o += 4;

    dv.setInt32(o, c.sunSteps | 0, true);
    o += 4;
    dv.setInt32(o, c.sunStride | 0, true);
    o += 4;
    dv.setFloat32(o, c.sunMinTr, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, c.phaseJitter, true);
    o += 4;
    dv.setFloat32(o, c.stepJitter, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, c.baseJitterFrac, true);
    o += 4;
    dv.setFloat32(o, c.topJitterFrac, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, c.lodBiasWeather, true);
    o += 4;
    dv.setFloat32(o, c.aabbFaceOffset, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, c.weatherRejectGate, true);
    o += 4;
    dv.setFloat32(o, c.weatherRejectMip, true);
    o += 4;
    dv.setFloat32(o, c.emptySkipMult, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, c.nearFluffDist, true);
    o += 4;
    dv.setFloat32(o, c.nearStepScale, true);
    o += 4;
    dv.setFloat32(o, c.nearLodBias, true);
    o += 4;
    dv.setFloat32(o, c.nearDensityMult, true);
    o += 4;
    dv.setFloat32(o, c.nearDensityRange, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, c.lodBlendThreshold, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, c.sunDensityGate, true);
    o += 4;
    dv.setFloat32(o, c.fflyRelClamp, true);
    o += 4;
    dv.setFloat32(o, c.fflyAbsFloor, true);
    o += 4;
    dv.setFloat32(o, c.taaRelMin, true);
    o += 4;
    dv.setFloat32(o, c.taaRelMax, true);
    o += 4;
    dv.setFloat32(o, c.taaAbsEps, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, c.farStart, true);
    o += 4;
    dv.setFloat32(o, c.farFull, true);
    o += 4;
    dv.setFloat32(o, c.farLodPush, true);
    o += 4;
    dv.setFloat32(o, c.farDetailAtten, true);
    o += 4;
    dv.setFloat32(o, c.farStepMult, true);
    o += 4;
    dv.setFloat32(o, c.bnFarScale, true);
    o += 4;
    dv.setFloat32(o, c.farTaaHistoryBoost, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

    dv.setFloat32(o, c.raySmoothDens, true);
    o += 4;
    dv.setFloat32(o, c.raySmoothSun, true);
    o += 4;

    // NEW: styleBlend float (0..1) to morph between old(flat) and new(bulgy) styles
    dv.setFloat32(o, c.styleBlend, true);
    o += 4;

    // pad vec2 (8 bytes) to match WGSL vec2<f32> _pad10
    dv.setFloat32(o, 0.0, true);
    o += 4;
    dv.setFloat32(o, 0.0, true);
    o += 4;

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
          this.blueTex.destroy();
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
    // if identical, update frame + reproj full size
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
        layerIndex: 0,
        originXf: 0.0,
        originYf: 0.0,
      });
      this._reprojFullW = width;
      this._reprojFullH = height;
      const curFW = this._dvReproj.getUint32(32, true) || 0,
        curFH = this._dvReproj.getUint32(36, true) || 0;
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

    // destroy existing
    if (this.outTexture)
      try {
        this.outTexture.destroy();
      } catch (_) {}
    this.outTexture = null;
    this.outView = null;

    this.outFormat = format;
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

    // update reproj nominal full size
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
      layerIndex: 0,
      originXf: 0.0,
      originYf: 0.0,
    });

    // invalidate caches
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
    this.outTexture = null;
    this.outView = view;
    this.outFormat = format;
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

  // -------------------- bind group key building --------------------
  _buildBg0Key() {
    const ids = [
      this._getResId(this.outView),
      this._getResId(this.optionsBuffer),
      this._getResId(this.paramsBuffer),
      this._getResId(this.dummyBuffer),
      this._getResId(this.offsetsBuffer),
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
        { binding: 3, resource: { buffer: this.offsetsBuffer } },
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
    // BG0
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

    // BG1
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

  // -------------------- rect/visibility helpers --------------------
  _projectWorldToPixel(p, view, width, height) {
    const cx = view.camPos[0],
      cy = view.camPos[1],
      cz = view.camPos[2];
    const rx = view.right[0],
      ry = view.right[1],
      rz = view.right[2];
    const ux = view.up[0],
      uy = view.up[1],
      uz = view.up[2];
    const fx = view.fwd[0],
      fy = view.fwd[1],
      fz = view.fwd[2];
    const tanYhalf = Math.tan(0.5 * (view.fovYRad || 0.5));
    const aspect = view.aspect || 1;
    const dx = p[0] - cx,
      dy = p[1] - cy,
      dz = p[2] - cz;
    const xCam = dx * rx + dy * ry + dz * rz;
    const yCam = dx * ux + dy * uy + dz * uz;
    const zCam = -(dx * fx + dy * fy + dz * fz);
    const eps = 1e-6;
    if (zCam <= eps) return { ok: false, x: 0, y: 0, zCam };
    const ndcX = xCam / (zCam * aspect * tanYhalf),
      ndcY = yCam / (zCam * tanYhalf);
    const px = (ndcX * 0.5 + 0.5) * width;
    const py = (ndcY * 0.5 + 0.5) * height;
    return { ok: true, x: px, y: py, zCam };
  }

  _computeAABBScreenRect(view, box, width, height, padPx = 4) {
    const cx = box.center[0],
      cy = box.center[1],
      cz = box.center[2];
    const hx = box.half[0],
      hy = box.half[1],
      hz = box.half[2];
    const corners = [
      [cx - hx, cy - hy, cz - hz],
      [cx + hx, cy - hy, cz - hz],
      [cx - hx, cy + hy, cz - hz],
      [cx + hx, cy + hy, cz - hz],
      [cx - hx, cy - hy, cz + hz],
      [cx + hx, cy - hy, cz + hz],
      [cx - hx, cy + hy, cz + hz],
      [cx + hx, cy + hy, cz + hz],
    ];
    let minX = 1e9,
      minY = 1e9,
      maxX = -1e9,
      maxY = -1e9;
    let anyFront = false;
    for (const C of corners) {
      const q = this._projectWorldToPixel(C, view, width, height);
      if (!q.ok) continue;
      anyFront = true;
      if (q.x < minX) minX = q.x;
      if (q.y < minY) minY = q.y;
      if (q.x > maxX) maxX = q.x;
      if (q.y > maxY) maxY = q.y;
    }
    if (!anyFront) return { visible: false };
    minX = Math.max(0, Math.floor(minX) - padPx);
    minY = Math.max(0, Math.floor(minY) - padPx);
    maxX = Math.min(width, Math.ceil(maxX) + padPx);
    maxY = Math.min(height, Math.ceil(maxY) + padPx);
    const w = Math.max(0, maxX - minX),
      h = Math.max(0, maxY - minY);
    return { visible: w > 0 && h > 0, x: minX, y: minY, w, h };
  }

  // -------------------- dispatch helpers (coarse integrated) --------------------
  async dispatchRect({ x, y, w, h, wait = false, coarseFactor = 1 } = {}) {
    if (!this.outView)
      throw new Error("dispatchRect: createOutputTexture/setOutputView first.");
    const cf = Math.max(1, coarseFactor | 0);
    if (cf < 2) return await this.dispatchRectNoCoarse({ x, y, w, h, wait });

    // coarse path
    const cW = Math.max(1, Math.ceil((w || this.width) / cf));
    const cH = Math.max(1, Math.ceil((h || this.height) / cf));
    const baseX = Math.floor((x || 0) / cf),
      baseY = Math.floor((y || 0) / cf);
    this._ensureCoarseTexture(cW, cH, this.layers);

    // save full-res
    const savedFullW = this._reprojFullW || this.width;
    const savedFullH = this._reprojFullH || this.height;

    // swap output -> coarse
    const savedOutTexture = this.outTexture,
      savedOutView = this.outView,
      savedWidth = this.width,
      savedHeight = this.height,
      savedFormat = this.outFormat;
    this.outTexture = this._coarseTexture;
    this.outView = this._coarseView;
    this.width = cW;
    this.height = cH;
    this.outFormat = this._coarseTexture?.format || savedFormat;

    this.setFrame({
      fullWidth: cW,
      fullHeight: cH,
      tileWidth: cW,
      tileHeight: cH,
      originX: baseX,
      originY: baseY,
      layerIndex: this._dvFrame.getInt32(36, true) | 0,
      originXf: 0.0,
      originYf: 0.0,
    });

    // ensure reproj UBO reflects full-res for normalization if necessary
    const curFW = this._dvReproj.getUint32(32, true) || 0,
      curFH = this._dvReproj.getUint32(36, true) || 0;
    if (curFW !== savedFullW >>> 0 || curFH !== savedFullH >>> 0) {
      this._dvReproj.setUint32(32, savedFullW >>> 0, true);
      this._dvReproj.setUint32(36, savedFullH >>> 0, true);
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
      this._bg0Dirty = true;
    }

    await this._dispatchComputeInternal({ wait });

    // restore outputs
    this.outTexture = savedOutTexture;
    this.outView = savedOutView;
    this.width = savedWidth;
    this.height = savedHeight;
    this.outFormat = savedFormat;

    // restore frame for full-res region and upsample
    this.setFrame({
      fullWidth: savedWidth,
      fullHeight: savedHeight,
      tileWidth: w || savedWidth,
      tileHeight: h || savedHeight,
      originX: x || 0,
      originY: y || 0,
      layerIndex: this._dvFrame.getInt32(36, true) | 0,
      originXf: 0.0,
      originYf: 0.0,
    });

    await this._upsampleCoarseToOut({
      srcX: baseX,
      srcY: baseY,
      srcW: cW,
      srcH: cH,
      dstX: x || 0,
      dstY: y || 0,
      dstW: w || this.width,
      dstH: h || this.height,
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
    const baseX = Math.max(0, Math.floor(x || 0)),
      baseY = Math.max(0, Math.floor(y || 0));
    const tw = Math.max(0, Math.floor(w || 0)),
      th = Math.max(0, Math.floor(h || 0));
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

  async dispatchForBox({ padPx = 8, wait = false, coarseFactor = 1 } = {}) {
    if (!this.outView)
      throw new Error(
        "dispatchForBox: createOutputTexture/setOutputView first.",
      );
    const view = {
      camPos: [
        this._dvView.getFloat32(0, true),
        this._dvView.getFloat32(4, true),
        this._dvView.getFloat32(8, true),
      ],
      right: [
        this._dvView.getFloat32(16, true),
        this._dvView.getFloat32(20, true),
        this._dvView.getFloat32(24, true),
      ],
      up: [
        this._dvView.getFloat32(32, true),
        this._dvView.getFloat32(36, true),
        this._dvView.getFloat32(40, true),
      ],
      fwd: [
        this._dvView.getFloat32(48, true),
        this._dvView.getFloat32(52, true),
        this._dvView.getFloat32(56, true),
      ],
      fovYRad: this._dvView.getFloat32(64, true),
      aspect: this._dvView.getFloat32(68, true),
    };
    const box = {
      center: [
        this._dvBox.getFloat32(0, true),
        this._dvBox.getFloat32(4, true),
        this._dvBox.getFloat32(8, true),
      ],
      half: [
        this._dvBox.getFloat32(16, true),
        this._dvBox.getFloat32(20, true),
        this._dvBox.getFloat32(24, true),
      ],
    };
    const rect = this._computeAABBScreenRect(
      view,
      box,
      this.width,
      this.height,
      padPx,
    );
    if (!rect.visible) {
      this._lastHadWork = false;
      return null;
    }
    const cf = Math.max(1, coarseFactor | 0);
    return await this.dispatchRect({
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      wait,
      coarseFactor: cf,
    });
  }

  async dispatch({ wait = false, coarseFactor = 1 } = {}) {
    const cf = Math.max(1, coarseFactor | 0);
    if (cf >= 2) {
      const cW = Math.max(1, Math.ceil(this.width / cf));
      const cH = Math.max(1, Math.ceil(this.height / cf));
      this._ensureCoarseTexture(cW, cH, this.layers);
      const savedFullW = this._reprojFullW || this.width,
        savedFullH = this._reprojFullH || this.height;
      const savedOutTexture = this.outTexture,
        savedOutView = this.outView,
        savedWidth = this.width,
        savedHeight = this.height,
        savedFormat = this.outFormat;
      this.outTexture = this._coarseTexture;
      this.outView = this._coarseView;
      this.width = cW;
      this.height = cH;
      this.outFormat = this._coarseTexture?.format || savedFormat;
      this.setFrame({
        fullWidth: cW,
        fullHeight: cH,
        tileWidth: cW,
        tileHeight: cH,
        originX: 0,
        originY: 0,
        layerIndex: 0,
        originXf: 0.0,
        originYf: 0.0,
      });
      const curFW = this._dvReproj.getUint32(32, true) || 0,
        curFH = this._dvReproj.getUint32(36, true) || 0;
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
        srcX: 0,
        srcY: 0,
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
    this._writeIfChanged("offsets", this.offsetsBuffer, this._abOffsets);
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
    // upload UBOs (including tuning)
    this._writeIfChanged("options", this.optionsBuffer, this._abOptions);
    this._writeIfChanged("params", this.paramsBuffer, this._abParams);
    this._writeIfChanged("offsets", this.offsetsBuffer, this._abOffsets);
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

  // -------------------- render / preview blit --------------------
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
      const yaw = rad(opts.yawDeg ?? 0),
        pitch = rad(opts.pitchDeg ?? 0);
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
      const sAz = rad(opts.sunAzimuthDeg ?? 45),
        sEl = rad(opts.sunElevationDeg ?? 20);
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
    wv3(96, opts.sunDir ?? [0, 1, 0]);
    wv3(112, skyColor);
    this._writeIfChanged("render", this.renderParams, this._abRender);
  }

  _ensureCanvasConfigured(canvas, format = "bgra8unorm") {
    if (!canvas) throw new Error("_ensureCanvasConfigured: canvas required");
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const clientW = Math.max(1, Math.round(canvas.clientWidth)),
      clientH = Math.max(1, Math.round(canvas.clientHeight));
    const displayW = Math.max(1, Math.floor(clientW * dpr)),
      displayH = Math.max(1, Math.floor(clientH * dpr));
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

  renderToCanvasWorld(
    canvas,
    {
      layerIndex = 0,
      cam,
      sunDir = [0, 1, 0],
      exposure = 1.2,
      skyColor = [0.55, 0.7, 0.95],
      sunBloom = 0.0,
    } = {},
  ) {
    if (!this.outView)
      throw new Error(
        "Nothing to render: run dispatch() first or setOutputView().",
      );
    const { pipe, bgl, samp, format } =
      this._ensureRenderPipeline("bgra8unorm");
    const { ctx, state } = this._ensureCanvasConfigured(canvas, format);

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

    this._writeRenderUniforms({
      layerIndex,
      cam,
      sunDir,
      exposure,
      skyColor,
      sunBloom,
    });
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

  // -------------------- coarse helpers --------------------
  _ensureCoarseTexture(w, h, layers = 1) {
    if (
      this._coarseTexture &&
      this._coarseW === w &&
      this._coarseH === h &&
      this._coarseLayers === layers
    )
      return;
    try {
      if (this._coarseTexture?.destroy) this._coarseTexture.destroy();
    } catch (_) {}
    this._coarseW = w;
    this._coarseH = h;
    this._coarseLayers = layers;
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

  // upsample pipeline for coarse->full
  _ensureUpsamplePipeline(format = this.outFormat) {
    if (this._upsample && this._upsample.format === format)
      return this._upsample;
    const blitWGSL = `
      struct RenderParams { layerIndex : u32, _pad:u32, _pad2:u32, _pad3:u32, };
      @group(0) @binding(0) var samp : sampler;
      @group(0) @binding(1) var tex : texture_2d_array<f32>;
      @group(0) @binding(2) var<uniform> R : RenderParams;
      struct VSOut { @builtin(position) pos : vec4<f32>, @location(0) uv : vec2<f32> };
      @vertex fn vs_main(@builtin(vertex_index) vid : u32) -> VSOut {
        var positions = array<vec2<f32>, 6>(vec2<f32>(-1.0,-1.0), vec2<f32>( 1.0,-1.0), vec2<f32>(-1.0, 1.0), vec2<f32>(-1.0, 1.0), vec2<f32>( 1.0,-1.0), vec2<f32>( 1.0, 1.0));
        var uvs = array<vec2<f32>, 6>(vec2<f32>(0.0,1.0), vec2<f32>(1.0,1.0), vec2<f32>(0.0,0.0), vec2<f32>(0.0,0.0), vec2<f32>(1.0,1.0), vec2<f32>(1.0,0.0));
        var o : VSOut; o.pos = vec4<f32>(positions[vid], 0.0, 1.0); o.uv = uvs[vid]; return o;
      }
      @fragment fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
        let layer = i32(R.layerIndex);
        let c = textureSampleLevel(tex, samp, in.uv, layer, 0.0);
        return c;
      }
    `;
    const mod = this.device.createShaderModule({ code: blitWGSL });
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
    this._upsample = { pipe, bgl, samp, format };
    return this._upsample;
  }

  _getOrCreateUpsampleBindGroup(coarseView, layerIndex) {
    const key = this._getResId(coarseView) + "|" + (layerIndex | 0);
    if (this._upsampleBgCache.has(key)) return this._upsampleBgCache.get(key);
    const up = this._ensureUpsamplePipeline(this.outFormat);
    const bg = this.device.createBindGroup({
      layout: up.bgl,
      entries: [
        { binding: 0, resource: up.samp },
        { binding: 1, resource: coarseView },
        {
          binding: 2,
          resource: { buffer: this.renderParams, offset: 0, size: 128 },
        },
      ],
    });
    this._upsampleBgCache.set(key, bg);
    if (this._upsampleBgCache.size > 32) {
      const firstKey = this._upsampleBgCache.keys().next().value;
      this._upsampleBgCache.delete(firstKey);
    }
    return bg;
  }

  async _upsampleCoarseToOut({
    srcX = 0,
    srcY = 0,
    srcW,
    srcH,
    dstX = 0,
    dstY = 0,
    dstW,
    dstH,
    wait = false,
  } = {}) {
    if (!this._coarseView || !this.outTexture) return;
    const up = this._ensureUpsamplePipeline(this.outFormat);
    const enc = this.device.createCommandEncoder();
    for (let layer = 0; layer < this.layers; ++layer) {
      this._dvRender.setUint32(0, layer >>> 0, true);
      this._writeIfChanged("render", this.renderParams, this._abRender);
      const bg = this._getOrCreateUpsampleBindGroup(this._coarseView, layer);
      const colorView = this.outTexture.createView({
        baseArrayLayer: layer,
        arrayLayerCount: 1,
      });
      const pass = enc.beginRenderPass({
        colorAttachments: [
          { view: colorView, loadOp: "load", storeOp: "store" },
        ],
      });
      pass.setPipeline(up.pipe);
      pass.setBindGroup(0, bg);
      pass.draw(6, 1, 0, 0);
      pass.end();
    }
    this.queue.submit([enc.finish()]);
    if (wait && typeof this.queue.onSubmittedWorkDone === "function")
      await this.queue.onSubmittedWorkDone();
  }

  // -------------------- cleanup --------------------
  destroy() {
    const toDestroy = [
      "optionsBuffer",
      "paramsBuffer",
      "offsetsBuffer",
      "dummyBuffer",
      "posBuffer",
      "frameBuffer",
      "lightBuffer",
      "viewBuffer",
      "boxBuffer",
      "samplingBuffer",
      "reprojBuffer",
      "perfBuffer",
      "renderParams",
      "tuningBuffer",
    ];
    for (const k of toDestroy)
      try {
        if (this[k]?.destroy) this[k].destroy();
      } catch (_) {
      } finally {
        this[k] = null;
      }
    try {
      if (this.outTexture?.destroy) this.outTexture.destroy();
    } catch (_) {}
    try {
      if (this._coarseTexture?.destroy) this._coarseTexture.destroy();
    } catch (_) {}
    this.outTexture = null;
    this.outView = null;
    this._coarseTexture = null;
    this._coarseView = null;

    if (this._ownsBlue && this.blueTex)
      try {
        this.blueTex.destroy();
      } catch (_) {}
    this.blueTex = null;
    this.blueView = null;
    this._ownsBlue = false;

    try {
      if (this._dummy2DMotion?.destroy) this._dummy2DMotion.destroy();
    } catch (_) {}
    try {
      if (this._dummy2DDepth?.destroy) this._dummy2DDepth.destroy();
    } catch (_) {}
    try {
      if (this._dummyHistoryPrev?.destroy) this._dummyHistoryPrev.destroy();
    } catch (_) {}
    try {
      if (this._dummyHistoryOut?.destroy) this._dummyHistoryOut.destroy();
    } catch (_) {}

    this._bg0Cache.clear();
    this._bg0Keys.length = 0;
    this._bg1Cache.clear();
    this._bg1Keys.length = 0;
    this._render = null;
    this._currentBg0 = null;
    this._currentBg1 = null;
    this._canvasStates = new WeakMap();
    this._ctxCache = new WeakMap();
    this._renderBgCache = new WeakMap();
    this._renderBundleCache = new WeakMap();
    this._upsampleBgCache.clear();
    this._lastSums.clear();
  }
}
