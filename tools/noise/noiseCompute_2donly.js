// noiseComputeBuilder.js
// -----------------------------------------------------------------------------
// GPU-driven noise compute: chunk-aware dispatch for 2D-array textures
// • Automatically reallocates buffers on resize
// • Call `resize(maxConfigs)` to change max noise configs
// • Call `setFrame(...)` to update tile dims and layer
// -----------------------------------------------------------------------------

//todo: jsdoc

import noiseWGSL from './noiseCompute.wgsl';
import blitFSWGSL from './noiseBlit.wgsl';


export class NoiseComputeBuilder {
  /**
   * @param {GPUDevice} device
   * @param {GPUQueue}  queue
   */
  constructor(device, queue) {
    this.device = device;
    this.queue = queue;

    // WGSL entrypoints available in the shader (kept for convenience)
    this.entryPoints = [
      'computePerlin',
      'computeBillow', 'computeAntiBillow',
      'computeRidge', 'computeAntiRidge',
      'computeRidgedMultifractal', 'computeRidgedMultifractal2', 'computeRidgedMultifractal3', 'computeRidgedMultifractal4',
      'computeAntiRidgedMultifractal', 'computeAntiRidgedMultifractal2', 'computeAntiRidgedMultifractal3', 'computeAntiRidgedMultifractal4',
      'computeFBM', 'computeFBM2', 'computeFBM3',
      'computeCellularBM1', 'computeCellularBM2', 'computeCellularBM3',
      'computeVoronoiBM1', 'computeVoronoiBM2', 'computeVoronoiBM3',
      'computeCellular', 'computeWorley',
      'computeLanczosBillow', 'computeLanczosAntiBillow',
      'computeVoronoiTileNoise',
      'computeVoronoiCircleNoise', 'computeVoronoiCircle2',
      'computeVoronoiFlatShade', 'computeVoronoiRipple3D', 'computeVoronoiRipple3D2',
      'computeVoronoiCircularRipple', 'computeFVoronoiRipple3D', 'computeFVoronoiCircularRipple',
      'computeRippleNoise', 'computeFractalRipples',
      'computeHexWorms', 'computePerlinWorms',
      'computeWhiteNoise', 'computeBlueNoise',
      'computeSimplex', 'computeSimplexFBM',
      'computeCurlNoise3D',
      'computeDomainWarpFBM1', 'computeDomainWarpFBM2',
      'computeGaborAnisotropic',
      'computeTerraceNoise', 'computeFoamNoise', 'computeTurbulence',
      'computeNormal', 'computeNormal8', 'computeSphereNormal',
      'clearTexture'
    ];

    // compile shader module and base pipeline layout
    this.shaderModule = device.createShaderModule({ code: noiseWGSL });

    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },         // options
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },         // params
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // perm table
        { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float', viewDimension: '2d-array' } }, // input (array)
        { binding: 4, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d-array' } }, // output (array)
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // pos buffer
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },         // frame/uniform per strip
      ]
    });

    this.pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] });

    // cache compute pipelines per entry point
    this.pipelines = new Map();

    // map of texture pairs (tid -> pair metadata)
    this._texPairs = new Map();
    this._tid = null; // active pair id

    // generic cached references for "active" pair (kept updated by setActiveTexture)
    this.viewA = null;
    this.viewB = null;
    this.width = 0;
    this.height = 0;
    this.isA = true;

    // buffers / uniforms
    this._initBuffers();

    // helper maps
    this._ctxMap = new WeakMap(); // canvas -> { ctx, size: [w,h] }
  }

  // ---------------------------
  // buffer allocation & defaults
  // ---------------------------
  _initBuffers() {
    // free previous if present
    this.optionsBuffer?.destroy();
    this.paramsBuffer?.destroy();
    this.permBuffer?.destroy();

    // NoiseMask / options (use 48 bytes to be safe)
    this.optionsBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // params buffer (80 bytes: 20 floats / 80 bytes)
    this.paramsBuffer = this.device.createBuffer({
      size: 20 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // permutation table (512 uint32)
    this.permBuffer = this.device.createBuffer({
      size: 512 * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // tiny dummy buffer to satisfy binding(5) when not using custom positions
    this.nullPosBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // zero-init sensible defaults
    this.queue.writeBuffer(this.optionsBuffer, 0, new ArrayBuffer(48));
    this.queue.writeBuffer(this.paramsBuffer, 0, new ArrayBuffer(20 * 4));
    this.queue.writeBuffer(this.permBuffer, 0, new Uint32Array(512));
  }

  resize(maxConfigs) {
    this.maxConfigs = maxConfigs;
    this._initBuffers();
  }

  setPermTable(permArray) {
    this.queue.writeBuffer(this.permBuffer, 0, permArray);
  }

  setPosBuffer(posBuffer) {
    this.posBuffer = posBuffer;
  }

  setInputTextureView(view) {
    this.inputTextureView = view;
    // mark current active pair bind groups dirty if present
    if (this._tid !== null) {
      const p = this._texPairs.get(this._tid);
      if (p) p.bindGroupDirty = true;
    }
  }

  setOutputTextureView(view) {
    this.outputTextureView = view;
    if (this._tid !== null) {
      const p = this._texPairs.get(this._tid);
      if (p) p.bindGroupDirty = true;
    }
  }

  buildPermTable(seed = Date.now()) {
    const noise = new BaseNoise(seed);
    const perm8 = noise.perm;
    const perm32 = new Uint32Array(512);
    for (let i = 0; i < 512; i++) perm32[i] = perm8[i];
    this.setPermTable(perm32);
  }

  // ---------------------------
  // options / params uploaders
  // ---------------------------
  setOptions(opts = {}) {
    const aliasChoices = Array.isArray(opts.noisechoices) ? opts.noisechoices : undefined;
    const {
      noiseChoices = aliasChoices ?? this.noiseChoices ?? [0],
      getGradient = 0,
      outputChannel = 1,
      baseRadius = 0,
      heightScale = 1,
      useCustomPos = 0
    } = opts;

    this.noiseChoices = noiseChoices;
    this.useCustomPos = useCustomPos >>> 0; // 0=no pos, 1=posBuf, 2=atlas mapping, etc.

    const buf = new ArrayBuffer(32);
    const dv = new DataView(buf);
    dv.setUint32(0, getGradient, true);
    dv.setUint32(4, this.useCustomPos, true);
    dv.setUint32(8, outputChannel, true);
    dv.setUint32(12, 0, true);
    dv.setFloat32(16, baseRadius, true);
    dv.setFloat32(20, heightScale, true);
    dv.setFloat32(24, 0.0, true);
    dv.setFloat32(28, 0.0, true);

    this.queue.writeBuffer(this.optionsBuffer, 0, buf);
    for (const pair of this._texPairs.values()) pair.bindGroupDirty = true;
  }



  setNoiseParams(params = {}) {
    const {
      seed = Date.now(), //use a big number
      zoom = 1.0, freq = 1.0, octaves = 8, lacunarity = 2.0, gain = 0.5,
      xShift = 0, yShift = 0, zShift = 0, turbulence = 0,
      seedAngle = Date.now() * 2 * Math.PI, exp1 = 1, exp2 = 0,
      threshold = 0.1, rippleFreq = 10.0, time = 0.0,
      warpAmp = 0.5, gaborRadius = 4.0, terraceStep = 8.0
    } = params;

    const buf = new ArrayBuffer(20 * 4);
    const dv = new DataView(buf);
    let base = 0;
    dv.setUint32(base + 0, seed, true);
    dv.setFloat32(base + 4, zoom, true);
    dv.setFloat32(base + 8, freq, true);
    dv.setUint32(base + 12, octaves, true);
    dv.setFloat32(base + 16, lacunarity, true);
    dv.setFloat32(base + 20, gain, true);
    dv.setFloat32(base + 24, xShift, true);
    dv.setFloat32(base + 28, yShift, true);
    dv.setFloat32(base + 32, zShift, true);
    dv.setUint32(base + 36, turbulence, true);
    dv.setFloat32(base + 40, seedAngle, true);
    dv.setFloat32(base + 44, exp1, true);
    dv.setFloat32(base + 48, exp2, true);
    dv.setFloat32(base + 52, threshold, true);
    dv.setFloat32(base + 56, rippleFreq, true);
    dv.setFloat32(base + 60, time, true);
    dv.setFloat32(base + 64, warpAmp, true);
    dv.setFloat32(base + 68, gaborRadius, true);
    dv.setFloat32(base + 72, terraceStep, true);

    this.queue.writeBuffer(this.paramsBuffer, 0, buf);
    // mark all pairs dirty if you want bind-groups rebuilt
    for (const pair of this._texPairs.values()) pair.bindGroupDirty = true;
  }

  // ---------------------------
  // texture pair lifecycle
  // ---------------------------
  /**
   * Create a new A/B ping-pong texture pair and return tid
   */
  createTexturePair(width, height, layers = 1) {
    const makeTex = () => this.device.createTexture({
      size: [width, height, layers],
      format: 'rgba16float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
    });

    const texA = makeTex();
    const texB = makeTex();
    const desc = { dimension: '2d-array', arrayLayerCount: layers };
    const viewA = texA.createView(desc);
    const viewB = texB.createView(desc);

    const tid = this._texPairs.size;
    this._texPairs.set(tid, {
      texA, texB, viewA, viewB,
      width, height, layers,
      isA: true,
      posStrips: null,
      stripBindGroups: null,
      stripFrameBuffers: null,
      bindGroupDirty: true
    });

    // if first, auto-activate
    if (this._tid === null) this.setActiveTexture(tid);
    return tid;
  }

  /**
   * Create (or recreate) the active pair at requested size; returns tid.
   * This intentionally destroys the previous active pair.
   */
  createShaderTextures(width, height, layers = 1) {
    if (this._tid !== null && this._texPairs.has(this._tid)) {
      this.destroyTexturePair(this._tid);
    }
    const tid = this.createTexturePair(width, height, layers);
    this.setActiveTexture(tid);
    return tid;
  }

  resetInputTexture(width = this.width, height = this.height) {
    if (this._tid === null) return;
    const pair = this._texPairs.get(this._tid);
    const desc = { dimension: '2d-array', arrayLayerCount: pair.layers };
    const make = () => this.device.createTexture({
      size: [width, height, pair.layers],
      format: 'rgba16float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
    });

    if (pair.isA) {
      pair.texA.destroy();
      pair.texA = make();
      pair.viewA = pair.texA.createView(desc);
    } else {
      pair.texB.destroy();
      pair.texB = make();
      pair.viewB = pair.texB.createView(desc);
    }

    this.setActiveTexture(this._tid);
  }

  destroyTexturePair(tid) {
    const pair = this._texPairs.get(tid);
    if (!pair) return;

    try { pair.texA.destroy(); } catch (e) { }
    try { pair.texB.destroy(); } catch (e) { }

    if (Array.isArray(pair.posStrips)) {
      for (const s of pair.posStrips) {
        try { s.buffer.destroy(); } catch (e) { }
      }
    }

    if (Array.isArray(pair.stripFrameBuffers)) {
      for (const fb of pair.stripFrameBuffers) {
        try { fb.destroy(); } catch (e) { }
      }
    }

    this._texPairs.delete(tid);

    if (this._tid === tid) {
      this._tid = null;
      this.inputTextureView = null;
      this.outputTextureView = null;
      this.viewA = null;
      this.viewB = null;
      this._posStrips = null;
      this._stripBindGroups = null;
    }
  }

  destroyAllTexturePairs() {
    const ids = Array.from(this._texPairs.keys());
    for (const tid of ids) this.destroyTexturePair(tid);
  }

  destroy() {
    this.optionsBuffer?.destroy();
    this.paramsBuffer?.destroy();
    this.permBuffer?.destroy();
    this.destroyAllTexturePairs();
  }

  getTextureViews(tid = this._tid) {
    const p = this._texPairs.get(tid);
    if (!p) return null;
    return p.isA ? { readView: p.viewA, writeView: p.viewB } : { readView: p.viewB, writeView: p.viewA };
  }

  swapPingPong(tid = this._tid) {
    const p = this._texPairs.get(tid);
    if (!p) return;
    p.isA = !p.isA;
    if (this._tid === tid) this.setActiveTexture(tid);
  }

  setActiveTexture(tid) {
    if (!this._texPairs.has(tid)) throw new Error('setActiveTexture: invalid id');
    this._tid = tid;
    const pair = this._texPairs.get(tid);

    this.viewA = pair.viewA;
    this.viewB = pair.viewB;
    this.width = pair.width;
    this.height = pair.height;
    this.inputTextureView = pair.isA ? pair.viewA : pair.viewB;
    this.outputTextureView = pair.isA ? pair.viewB : pair.viewA;

    // expose pair-specific state to "active" runtime variables for compatibility
    this._posStrips = pair.posStrips;
    this._stripBindGroups = pair.stripBindGroups;
    this._stripFrameBuffers = pair.stripFrameBuffers;
    this._bindGroupDirty = Boolean(pair.bindGroupDirty);
  }

  // ---------------------------
  // position strips (tile decomposition), the position buffers support arbitrary positions else it writes a blank buffer
  // ---------------------------
  _buildPosBuffer(width, height, customData) {
    if (this.useCustomPos === 0 && !customData) {
      return this.nullPosBuffer; // satisfy binding(5) cheaply
    }
    const numPixels = width * height;
    const data = (customData instanceof Float32Array && customData.length === numPixels * 4)
      ? customData
      : new Float32Array(numPixels * 4);
    const buf = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    this.queue.writeBuffer(buf, 0, data.buffer, data.byteOffset, data.byteLength);
    return buf;
  }


  _makePosStrips(width, height, MAX_POS_VERTICES = 8_000_000, customData) {
    const needPos = (this.useCustomPos !== 0) || !!customData;
    if (!needPos) {
      return [{
        buffer: this.nullPosBuffer,
        originY: 0,
        tileWidth: width,
        tileHeight: height
      }];
    }

    const cap = Number.isFinite(MAX_POS_VERTICES) && MAX_POS_VERTICES > 0 ? MAX_POS_VERTICES : 8_000_000;
    const total = width * height;
    const strips = [];

    if (total <= cap) {
      strips.push({
        buffer: this._buildPosBuffer(width, height, customData),
        originY: 0,
        tileWidth: width,
        tileHeight: height
      });
    } else {
      const maxRows = Math.max(1, Math.floor(cap / width));
      let j = 0;
      for (let y0 = 0; y0 < height; y0 += maxRows) {
        const th = Math.min(maxRows, height - y0);
        const cd = Array.isArray(customData) ? customData[j] : undefined;
        strips.push({
          buffer: this._buildPosBuffer(width, th, cd),
          originY: y0,
          tileWidth: width,
          tileHeight: th
        });
        j++;
      }
    }
    return strips;
  }


  _ensurePairStrips(tid, W, H, options = {}) {
    const pair = this._texPairs.get(tid);
    if (!pair) throw new Error('_ensurePairStrips: invalid tid');

    const needPos = (this.useCustomPos !== 0) || !!options?.customData;
    const need =
      !pair.posStrips ||
      pair.width !== W ||
      pair.height !== H ||
      pair._lastNeedPos !== needPos ||
      options?.customData;

    if (need) {
      const maxVerts = Number.isFinite(options.maxVertices) ? options.maxVertices : 8_000_000;
      pair.posStrips = this._makePosStrips(W, H, maxVerts, options.customData);
      pair.bindGroupDirty = true;
      pair.width = W;
      pair.height = H;
      pair._lastNeedPos = needPos;
    }
  }


  _writeFrameUniform(fb, {
    fullWidth, fullHeight, tileWidth, tileHeight,
    originX, originY, layerIndex, layers
  }) {
    const ab = new ArrayBuffer(32);
    const dv = new DataView(ab);
    dv.setUint32(0, fullWidth >>> 0, true);
    dv.setUint32(4, fullHeight >>> 0, true);
    dv.setUint32(8, tileWidth >>> 0, true);
    dv.setUint32(12, tileHeight >>> 0, true);
    dv.setInt32(16, originX | 0, true);
    dv.setInt32(20, originY | 0, true);
    dv.setInt32(24, layerIndex | 0, true);
    dv.setUint32(28, layers >>> 0, true);
    this.queue.writeBuffer(fb, 0, ab);
  }

  _createStripBindGroupsForPair(tid) {
    const pair = this._texPairs.get(tid);
    if (!pair) throw new Error('_createStripBindGroupsForPair: invalid tid');
    if (!pair.viewA || !pair.viewB) throw new Error('_createStripBindGroupsForPair: missing views');
    if (!pair.posStrips || !pair.posStrips.length) throw new Error('_createStripBindGroupsForPair: no strips');

    const fw = pair.width, fh = pair.height;
    const bindGroups = [];
    const frameBuffers = [];

    for (const { buffer, originY, tileWidth, tileHeight } of pair.posStrips) {
      const fb = this.device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      frameBuffers.push(fb);

      // default init: layer 0, report total layers
      this._writeFrameUniform(fb, {
        fullWidth: fw,
        fullHeight: fh,
        tileWidth,
        tileHeight,
        originX: 0,
        originY,
        layerIndex: 0,
        layers: pair.layers
      });

      const common = [
        { binding: 0, resource: { buffer: this.optionsBuffer } },
        { binding: 1, resource: { buffer: this.paramsBuffer } },
        { binding: 2, resource: { buffer: this.permBuffer } },
        { binding: 5, resource: { buffer } },
        { binding: 6, resource: { buffer: fb } }
      ];

      const bgA = this.device.createBindGroup({
        layout: this.bindGroupLayout,
        entries: [...common, { binding: 3, resource: pair.viewA }, { binding: 4, resource: pair.viewB }]
      });

      const bgB = this.device.createBindGroup({
        layout: this.bindGroupLayout,
        entries: [...common, { binding: 3, resource: pair.viewB }, { binding: 4, resource: pair.viewA }]
      });

      bindGroups.push({ bgA, bgB });
    }

    pair.stripBindGroups = bindGroups;
    pair.stripFrameBuffers = frameBuffers;
    pair.bindGroupDirty = false;

    if (this._tid === tid) {
      this._stripBindGroups = bindGroups;
      this._stripFrameBuffers = frameBuffers;
      this._bindGroupDirty = false;
      this._posStrips = pair.posStrips;
    }
  }


  // ---------------------------
  // core compute loop
  // ---------------------------
  async _runPipelines(bgA, bgB, tileW, tileH, paramsArray) {
    if (!bgA || !bgB) throw new Error('_runPipelines: missing bind groups');

    let current = bgA;
    let alternate = bgB;
    const isArr = Array.isArray(paramsArray);
    let i = 0;

    for (const choice of this.noiseChoices) {
      const entry = typeof choice === 'number' ? this.entryPoints[choice] : choice;

      let pipe = this.pipelines.get(entry);
      if (!pipe) {
        pipe = this.device.createComputePipeline({
          layout: this.pipelineLayout,
          compute: { module: this.shaderModule, entryPoint: entry }
        });
        this.pipelines.set(entry, pipe);
      }

      if (isArr) this.setNoiseParams(paramsArray[i++]);

      const enc = this.device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(pipe);
      pass.setBindGroup(0, current);
      pass.dispatchWorkgroups(Math.ceil(tileW / 8), Math.ceil(tileH / 8), 1);
      pass.end();
      this.queue.submit([enc.finish()]);

      // wait for GPU to finish submitted work before continuing to next pipeline
      if (typeof this.queue.onSubmittedWorkDone === 'function') {
        await this.queue.onSubmittedWorkDone();
      } else {
        // fallback small delay (not perfect but better than nothing)
        await new Promise(r => setTimeout(r, 8));
      }

      [current, alternate] = [alternate, current];
    }

    // return the bind group that actually ran last
    return alternate;
  }

  /**
   * computeToTexture(width, height, paramsObj = {}, options = {})
   * - Computes into an active texture pair of matching size.
   * - If active pair size doesn't match, a new pair is created and set active.
   * - Returns the read-view (GPUTextureView) that contains the result.
   */
  async computeToTexture(width, height, paramsObj = {}, options = {}) {
    const W = width | 0, H = height | 0;
    if (!(W > 0 && H > 0)) throw new Error(`computeToTexture: invalid size ${width}×${height}`);

    // Ensure an active pair exists
    if (this._tid == null) {
      this.createShaderTextures(W, H, 1);
    }

    let pair = this._texPairs.get(this._tid);
    if (!pair) throw new Error('computeToTexture: no active texture pair');

    // if active pair size differs, create a new pair for this size (preserve other tids)
    if (pair.width !== W || pair.height !== H) {
      const newTid = this.createTexturePair(W, H, 1);
      this.setActiveTexture(newTid);
      pair = this._texPairs.get(this._tid);
    }

    // ensure per-pair pos strips & bind groups exist
    this._ensurePairStrips(this._tid, W, H, options);
    if (!pair.stripBindGroups || pair.bindGroupDirty) {
      this._createStripBindGroupsForPair(this._tid);
    }

    // update params/options
    if (paramsObj && !Array.isArray(paramsObj)) this.setNoiseParams(paramsObj);
    if (options) this.setOptions(options);

    const isAStart = pair.isA;
    let finalUsed = null;
    let lastBGs = null;

    // iterate strips (often just 1)
    for (let idx = 0; idx < pair.posStrips.length; idx++) {
      const { tileWidth, tileHeight } = pair.posStrips[idx];
      const { bgA, bgB } = pair.stripBindGroups[idx];

      const start = (idx === 0 ? (isAStart ? bgA : bgB) : (finalUsed === bgA ? bgA : bgB));
      const alt = start === bgA ? bgB : bgA;

      finalUsed = await this._runPipelines(start, alt, tileWidth, tileHeight, paramsObj);
      lastBGs = { bgA, bgB };
    }

    // Map finalUsed -> which view now holds results
    const resultsInA = (finalUsed === lastBGs.bgB);
    pair.isA = resultsInA;
    this.isA = resultsInA;

    // refresh active cached refs
    this.setActiveTexture(this._tid);

    // return the GPUTextureView that contains the latest results (read side)
    return this.getCurrentView();
  }

  /**
 * computeToTextureArray3D(width, height, layers, paramsObj = {}, options = {})
 * Generates a layered 2D array volume by iterating Z and reusing strip dispatch.
 * Returns the GPUTextureView that holds the final results.
 */
  async computeToTexture3D(width, height, layers = 2, paramsObj = {}, options = {}) {
    const W = width | 0, H = height | 0, L = Math.max(1, layers | 0);
    if (!(W > 0 && H > 0)) throw new Error(`computeToTextureArray3D: invalid size ${width}×${height}`);

    if (this._tid == null) this.createShaderTextures(W, H, L);
    let pair = this._texPairs.get(this._tid);
    if (!pair) throw new Error('computeToTextureArray3D: no active texture pair');

    if (pair.width !== W || pair.height !== H || pair.layers !== L) {
      const newTid = this.createTexturePair(W, H, L);
      this.setActiveTexture(newTid);
      pair = this._texPairs.get(this._tid);
    }

    this._ensurePairStrips(this._tid, W, H, options);
    if (!pair.stripBindGroups || pair.bindGroupDirty) {
      this._createStripBindGroupsForPair(this._tid);
    }

    if (paramsObj && !Array.isArray(paramsObj)) this.setNoiseParams(paramsObj);
    if (options) this.setOptions(options);

    const isAStart = pair.isA;
    let finalUsed = null;
    let lastBGs = null;

    for (let z = 0; z < L; z++) {
      // stamp the Frame for this layer
      for (let s = 0; s < pair.posStrips.length; s++) {
        const fb = pair.stripFrameBuffers[s];
        const { tileWidth, tileHeight, originY } = pair.posStrips[s];
        this._writeFrameUniform(fb, {
          fullWidth: pair.width,
          fullHeight: pair.height,
          tileWidth, tileHeight,
          originX: 0,
          originY,
          layerIndex: z,
          layers: L
        });
      }

      // dispatch each strip for this Z
      for (let s = 0; s < pair.posStrips.length; s++) {
        const { tileWidth, tileHeight } = pair.posStrips[s];
        const { bgA, bgB } = pair.stripBindGroups[s];

        const start = (z === 0 && s === 0 ? (isAStart ? bgA : bgB) : (finalUsed === bgA ? bgA : bgB));
        const alt = start === bgA ? bgB : bgA;

        finalUsed = await this._runPipelines(start, alt, tileWidth, tileHeight, paramsObj);
        lastBGs = { bgA, bgB };
      }
    }

    const resultsInA = (finalUsed === lastBGs.bgB);
    pair.isA = resultsInA;
    this.isA = resultsInA;
    this.setActiveTexture(this._tid);
    return this.getCurrentView();
  }



  getCurrentView() {
    // convenience: return the read view of active pair
    const p = this._texPairs.get(this._tid);
    if (!p) return null;
    return p.isA ? p.viewA : p.viewB;
  }

  // ---------------------------
  // blit support (render preview)
  // ---------------------------
  initBlitRender() {
    if (this.bgl && this.pipeline && this.sampler) return;

    this.bgl = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d-array' } }
      ]
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bgl] }),
      vertex: {
        module: this.device.createShaderModule({ code: blitFSWGSL }),
        entryPoint: 'vs_main'
      },
      fragment: {
        module: this.device.createShaderModule({ code: blitFSWGSL }),
        entryPoint: 'fs_main',
        targets: [{ format: 'bgra8unorm' }]
      },
      primitive: { topology: 'triangle-list' }
    });

    this.sampler = this.device.createSampler({
      magFilter: 'linear', minFilter: 'linear',
      addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge'
    });
  }

  /**
   * Safely blit a texture-view to a canvas.
   * - preserveCanvasSize: if true, don't mutate canvas.width/height
   * - clear: whether to clear the canvas before draw
   */
  renderTextureToCanvas(textureView, canvas, opts = {}) {
    const { preserveCanvasSize = true, clear = true } = opts;
    this.initBlitRender();

    // If caller wants to match texture native size, try to set canvas physical size
    if (!preserveCanvasSize) {
      // Some GPUTexture implementations expose width/height on texture; fallback to current canvas size
      try {
        const tex = textureView.texture;
        if (tex && typeof tex.width === 'number' && typeof tex.height === 'number') {
          canvas.width = tex.width;
          canvas.height = tex.height;
        }
      } catch (e) {
        // ignore and leave canvas size as-is
      }
    }

    const format = 'bgra8unorm';

    // per-canvas ctx cache
    let entry = this._ctxMap.get(canvas);
    if (!entry) {
      const ctx = canvas.getContext('webgpu');
      const size = [canvas.width, canvas.height];
      ctx.configure({ device: this.device, format, alphaMode: 'opaque', size });
      entry = { ctx, size };
      this._ctxMap.set(canvas, entry);
    } else {
      const curW = canvas.width | 0;
      const curH = canvas.height | 0;
      if (entry.size[0] !== curW || entry.size[1] !== curH) {
        entry.size = [curW, curH];
        entry.ctx.configure({ device: this.device, format, alphaMode: 'opaque', size: entry.size });
      }
    }

    const ctx = entry.ctx;

    const bg = this.device.createBindGroup({
      layout: this.bgl,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: textureView }
      ]
    });

    const enc = this.device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: clear ? 'clear' : 'load',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store'
      }]
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.draw(6, 1, 0, 0);
    pass.end();
    this.queue.submit([enc.finish()]);
  }

  async testRenderSolidColor(canvas, color = [1, 1, 1, 1]) {
    const tex = this.device.createTexture({
      size: [1, 1, 1],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    this.device.queue.writeTexture(
      { texture: tex, mipLevel: 0, origin: [0, 0, 0] },
      new Float32Array(color),
      { bytesPerRow: 4 * Float32Array.BYTES_PER_ELEMENT },
      { width: 1, height: 1, depthOrArrayLayers: 1 }
    );

    const view = tex.createView({ dimension: '2d-array', arrayLayerCount: 1 });
    this.renderTextureToCanvas(view, canvas, { preserveCanvasSize: true });
  }
}




export class BaseNoise {
  constructor(seed = Date.now()) {
    if (seed < 10000000) seed *= 10000000;
    this.seedN = seed;
    this.seedK = seed;
    this.perm = new Uint8Array(512);
    this.seed(seed);
  }

  seed(seed) {
    const random = this.xorshift(seed);
    for (let i = 0; i < 256; i++) {
      this.perm[i] = i;
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.perm[i], this.perm[j]] = [this.perm[j], this.perm[i]];
    }
    for (let i = 0; i < 256; i++) {
      this.perm[i + 256] = this.perm[i];
    }
  }

  setSeed(seed) {
    this.seedN = seed;
    this.seed(seed);
    this.resetSeed();
  }

  random(x, y, z) {
    let idx;
    if (typeof z === 'number') {
      idx = (this.perm[(x & 255) + this.perm[(y & 255) + this.perm[z & 255]]]) & 255;
    } else {
      idx = (this.perm[(x & 255) + this.perm[y & 255]]) & 255;
    }
    return (this.perm[idx] / 255) * 2 - 1;
  }

  seededRandom() {
    this.seedK += Math.E;
    const x = 1000000000 * Math.sin(this.seedK);
    return x - Math.floor(x);
  }

  resetSeed() {
    this.seedK = this.seedN;
  }

  xorshift(seed) {
    let x = seed;
    return function () {
      x ^= x << 13;
      x ^= x >> 17;
      x ^= x << 5;
      return (x < 0 ? 1 + ~x : x) / 0xFFFFFFFF;
    };
  }

  dot(g, x = 0, y = 0, z = 0) {
    return g[0] * x + g[1] * y + g[2] * z;
  }
}


/**
const builder = new NoiseComputeBuilder(device, queue);
builder.createShaderTextures(w, h);
builder.buildPermTable(seed);
await builder.computeToTexture(w, h, params, noiseChoices, seed);
builder.initBlitRender();
builder.renderTextureToCanvas(builder.inputTextureView, canvas);
 */

/*




*/