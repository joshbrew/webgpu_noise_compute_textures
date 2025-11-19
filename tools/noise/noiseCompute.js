// noiseComputeBuilder.js
// -----------------------------------------------------------------------------
// GPU-driven noise compute with 2D-array tiling and true 3D volume support
//  - Bind-group recycling improved: avoid nulling/throwaway BGs, reuse buffers,
//    batch compute dispatches into a single compute pass.
//  - 2D path: auto-tiles into array layers when W or H > 4096
//  - 3D path: uses texture3D; if any side > 2048, chunks into multiple 3D textures
//  - Supports multiple concurrent 3D volumes via a id (no auto-evict)
//  - Dummy resources bound for whichever path is not active
//  - Toroidal tiling controlled entirely by WGSL uniforms (params.toroidal / params.torusRepeats)
//  - Frame UBO = 64 bytes (includes originXf, originYf, and a trailing vec2<f32> pad)
// -----------------------------------------------------------------------------


import noiseWGSL from './noiseCompute.wgsl';
import blit2DWGSL from './noiseBlit.wgsl';
import blit3DWGSL from './noiseBlit3D.wgsl';

// Should be derived from device limits in real code
const MAX_2D_TILE = 4096;
const MAX_3D_TILE = 2048;
const BYTES_PER_VOXEL = 8; // rgba16float = 4 * 16-bit

export class NoiseComputeBuilder {
  /**
   * @param {GPUDevice} device
   * @param {GPUQueue}  queue
   */
  constructor(device, queue) {
    this.device = device;
    this.queue = queue;

    // Keep in sync with WGSL entry points
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
      'computeAntiCellular', 'computeAntiWorley',
      'computeLanczosBillow', 'computeLanczosAntiBillow',
      'computeVoronoiTileNoise',
      'computeVoronoiCircleNoise', 'computeVoronoiCircle2',
      'computeVoronoiFlatShade', 'computeVoronoiRipple3D', 'computeVoronoiRipple3D2',
      'computeVoronoiCircularRipple', 'computeFVoronoiRipple3D', 'computeFVoronoiCircularRipple',
      'computeRippleNoise', 'computeFractalRipples',
      'computeHexWorms', 'computePerlinWorms',
      'computeWhiteNoise', 'computeBlueNoise',
      'computeSimplex',
      'computeCurl2D',
      'computeCurlFBM2D',
      'computeDomainWarpFBM1', 'computeDomainWarpFBM2',
      'computeGaborAnisotropic',
      'computeTerraceNoise', 'computeFoamNoise', 'computeTurbulence',
      'computePerlin4D', 'computeWorley4D', 'computeAntiWorley4D', 
      'computeGauss5x5',
      'computeNormal', 'computeNormal8', 'computeSphereNormal', 'computeNormalVolume',
      'clearTexture'
    ];

    this.shaderModule = device.createShaderModule({ code: noiseWGSL });

    // Bind group layout (matches WGSL)
    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },                // options
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },                // params
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },      // perm table
        { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float', viewDimension: '2d-array' } }, // input 2D-array (sampled)
        { binding: 4, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d-array' } }, // output 2D-array (storage)
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },      // positions
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },                // frame
        { binding: 7, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float', viewDimension: '3d' } }, // input 3D
        { binding: 8, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '3d' } }, // output 3D
      ]
    });

    this.pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] });
    this.pipelines = new Map();

    // 2D ping-pong pairs
    this._texPairs = new Map();
    this._tid = null;
    this._tag = new WeakMap();

    // 3D volume chunks
    this._volumeCache = new Map();

    // Active pair cached refs
    this.viewA = null;
    this.viewB = null;
    this.width = 0;
    this.height = 0;
    this.layers = 1;
    this.isA = true;

    // UBO/storage buffers
    this._initBuffers();

    // dummy textures / views for the unused path
    this._ensureDummies();

    // canvas context map
    this._ctxMap = new WeakMap();
  }

  // ---------------------------
  // buffers and dummies
  // ---------------------------
  _initBuffers() {
    this.optionsBuffer?.destroy();
    this.paramsBuffer?.destroy();
    this.permBuffer?.destroy();
    this.nullPosBuffer?.destroy();

    // Options UBO: 32 bytes payload
    this.optionsBuffer = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Params UBO: 22 * 4 bytes (matches WGSL struct with new fields)
    this.paramsBuffer = this.device.createBuffer({
      size: 22 * 4, // <- updated
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Perm table: 512 u32
    this.permBuffer = this.device.createBuffer({
      size: 512 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // Null pos buffer used when custom positions are not supplied
    this.nullPosBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // Initialize with zeros / default perm
    this.queue.writeBuffer(this.optionsBuffer, 0, new ArrayBuffer(32));
    this.queue.writeBuffer(this.paramsBuffer, 0, new ArrayBuffer(22 * 4)); // <- updated
    this.queue.writeBuffer(this.permBuffer, 0, new Uint32Array(512));
  }

  _ensureDummies() {
    // 2D sampled dummy (texture-binding)
    if (!this._dummy2D_sampleTex) {
      this._dummy2D_sampleTex = this.device.createTexture({
        size: [1, 1, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
      });
      this._dummy2D_sampleView = this._dummy2D_sampleTex.createView({ dimension: '2d-array', arrayLayerCount: 1 });
    }

    // 2D write dummy (storage-binding)
    if (!this._dummy2D_writeTex) {
      this._dummy2D_writeTex = this.device.createTexture({
        size: [1, 1, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST
      });
      this._dummy2D_writeView = this._dummy2D_writeTex.createView({ dimension: '2d-array', arrayLayerCount: 1 });
    }

    // 3D sampled dummy
    if (!this._dummy3D_sampleTex) {
      this._dummy3D_sampleTex = this.device.createTexture({
        size: { width: 1, height: 1, depthOrArrayLayers: 1 },
        dimension: '3d',
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
      });
      this._dummy3D_sampleView = this._dummy3D_sampleTex.createView({ dimension: '3d' });
    }

    // 3D write dummy
    if (!this._dummy3D_writeTex) {
      this._dummy3D_writeTex = this.device.createTexture({
        size: { width: 1, height: 1, depthOrArrayLayers: 1 },
        dimension: '3d',
        format: 'rgba16float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST
      });
      this._dummy3D_writeView = this._dummy3D_writeTex.createView({ dimension: '3d' });
    }
  }

  // ---------------------------
  // public setters
  // ---------------------------
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

  // External views (optional)
  setInputTextureView(view) {
    try {
      const usage = view?.texture?.usage ?? 0;
      if ((usage & GPUTextureUsage.TEXTURE_BINDING) === 0) {
        console.warn('setInputTextureView: provided texture view not created with TEXTURE_BINDING; ignoring.');
        return;
      }
    } catch (e) { /* ignore */ }
    this.inputTextureView = view;
    if (this._tid !== null) {
      const p = this._texPairs.get(this._tid);
      if (p) p.bindGroupDirty = true;
    }
  }

  setOutputTextureView(view) {
    try {
      const usage = view?.texture?.usage ?? 0;
      if ((usage & GPUTextureUsage.STORAGE_BINDING) === 0) {
        console.warn('setOutputTextureView: provided texture view not created with STORAGE_BINDING; ignoring.');
        return;
      }
    } catch (e) { /* ignore */ }
    this.outputTextureView = view;
    if (this._tid !== null) {
      const p = this._texPairs.get(this._tid);
      if (p) p.bindGroupDirty = true;
    }
  }

  // ----------------------------------------------------------------
  // buildPermTable(seed) - simple non-periodic table (classic), 512 entries
  // ----------------------------------------------------------------
  buildPermTable(seed = Date.now()) {
    const noise = new BaseNoise(seed);
    const perm8 = noise.perm;
    const perm32 = new Uint32Array(512);
    for (let i = 0; i < 512; i++) perm32[i] = perm8[i];
    this.setPermTable(perm32);
  }

  setOptions(opts = {}) {
    if (Array.isArray(opts.noiseChoices)) {
      this.noiseChoices = opts.noiseChoices;
    } else if (!this.noiseChoices) {
      this.noiseChoices = [0];
    }

    const {
      getGradient = 0,
      outputChannel = 1,
      baseRadius = 0,
      heightScale = 1,
      useCustomPos = 0,
      ioFlags = 0
    } = opts;

    this.useCustomPos = useCustomPos >>> 0;

    const buf = new ArrayBuffer(32);
    const dv = new DataView(buf);
    dv.setUint32(0, getGradient, true);
    dv.setUint32(4, this.useCustomPos, true);
    dv.setUint32(8, outputChannel, true);
    dv.setUint32(12, ioFlags >>> 0, true);
    dv.setFloat32(16, baseRadius, true);
    dv.setFloat32(20, heightScale, true);
    dv.setFloat32(24, 0.0, true);
    dv.setFloat32(28, 0.0, true);
    this.queue.writeBuffer(this.optionsBuffer, 0, buf);

    // mark tile bind groups dirty so new options are used
    for (const pair of this._texPairs.values()) pair.bindGroupDirty = true;
  }

  setNoiseParams(params = {}) {
    const {
      seed = Date.now() | 0,
      zoom = 1.0, freq = 1.0, octaves = 8, lacunarity = 2.0, gain = 0.5,
      xShift = 0.0, yShift = 0.0, zShift = 0.0, turbulence = 0,
      seedAngle = 0.0, exp1 = 1.0, exp2 = 0.0,
      threshold = 0.1, rippleFreq = 10.0, time = 0.0,
      warpAmp = 0.5, gaborRadius = 4.0, terraceStep = 8.0,

      // Toroidal options
      toroidal = 0,       // (0/1)
      // Voronoi options (new)
      voroMode = 0,       // u32 mode selector
      edgeK = 0.0,        // f32 edge strength/scale
    } = params;

    // defensive sanitization
    const _zoom = Math.max(zoom, 1e-6);
    const _freq = Math.max(freq, 1e-6);

    // Toroidal flag (now purely driven by the `toroidal` arg)
    const toroFlag = (toroidal ? 1 : 0) >>> 0;

    // Pack into params UBO: 22 * 4 bytes
    const buf = new ArrayBuffer(22 * 4);
    const dv = new DataView(buf);
    let base = 0;

    dv.setUint32(base + 0, seed >>> 0, true);           // seed (u32)
    dv.setFloat32(base + 4, zoom, true);                // zoom (f32)
    dv.setFloat32(base + 8, freq, true);                // freq (f32)
    dv.setUint32(base + 12, octaves >>> 0, true);       // octaves (u32)
    dv.setFloat32(base + 16, lacunarity, true);         // lacunarity
    dv.setFloat32(base + 20, gain, true);               // gain
    dv.setFloat32(base + 24, xShift, true);             // xShift
    dv.setFloat32(base + 28, yShift, true);             // yShift
    dv.setFloat32(base + 32, zShift, true);             // zShift
    dv.setUint32(base + 36, turbulence ? 1 : 0, true);  // turbulence (u32)
    dv.setFloat32(base + 40, seedAngle, true);          // seedAngle
    dv.setFloat32(base + 44, exp1, true);               // exp1
    dv.setFloat32(base + 48, exp2, true);               // exp2
    dv.setFloat32(base + 52, threshold, true);          // threshold
    dv.setFloat32(base + 56, rippleFreq, true);         // rippleFreq
    dv.setFloat32(base + 60, time, true);               // time
    dv.setFloat32(base + 64, warpAmp, true);            // warpAmp
    dv.setFloat32(base + 68, gaborRadius, true);        // gaborRadius
    dv.setFloat32(base + 72, terraceStep, true);        // terraceStep

    dv.setUint32(base + 76, toroFlag >>> 0, true);      // toroidal (u32)
    dv.setUint32(base + 80, voroMode >>> 0, true);      // voroMode (u32)
    dv.setFloat32(base + 84, edgeK, true);              // edgeK (f32)

    // upload
    this.queue.writeBuffer(this.paramsBuffer, 0, buf);

    // mark bindgroups dirty so new params are used; but DO NOT null existing BGs
    for (const pair of this._texPairs.values()) pair.bindGroupDirty = true;

    // Mark existing 3D volumes as needing bind-group recreation.
    // We set a dirty flag on the volume so we can lazily re-create them.
    for (const [key, vol] of this._volumeCache) {
      if (!vol || !Array.isArray(vol.chunks)) continue;
      vol._bindGroupsDirty = true;
    }
  }

  // ---------------------------
  // 2D-array tiling (pair)
  // ---------------------------
  _compute2DTiling(W, H) {
    const tileW = Math.min(W, MAX_2D_TILE);
    const tileH = Math.min(H, MAX_2D_TILE);
    const tilesX = Math.ceil(W / tileW);
    const tilesY = Math.ceil(H / tileH);
    const layers = tilesX * tilesY;
    return { tileW, tileH, tilesX, tilesY, layers };
  }

  _create2DPair(W, H) {
    const t = this._compute2DTiling(W, H);
    const usage = GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST;

    const makeTex = () => this.device.createTexture({
      size: [t.tileW, t.tileH, t.layers],
      format: 'rgba16float',
      usage
    });

    const desc = { dimension: '2d-array', arrayLayerCount: t.layers };

    const texA = makeTex();
    const texB = makeTex();
    const viewA = texA.createView(desc);
    const viewB = texB.createView(desc);

    texA.label = `2D texA ${W}x${H}x${t.layers}`;
    texB.label = `2D texB ${W}x${H}x${t.layers}`;
    viewA.label = '2D:viewA';
    viewB.label = '2D:viewB';
    this._tag.set(viewA, '2D:A');
    this._tag.set(viewB, '2D:B');

    const tid = this._texPairs.size;
    this._texPairs.set(tid, {
      texA, texB, viewA, viewB,
      fullWidth: W, fullHeight: H,
      tileWidth: t.tileW, tileHeight: t.tileH,
      tilesX: t.tilesX, tilesY: t.tilesY,
      layers: t.layers,
      isA: true,
      tiles: null,
      bindGroupDirty: true
    });

    if (this._tid === null) this.setActiveTexture(tid);
    return tid;
  }

  createShaderTextures(width, height) {
    if (this._tid !== null && this._texPairs.has(this._tid)) {
      this.destroyTexturePair(this._tid);
    }
    const tid = this._create2DPair(width, height);
    this.setActiveTexture(tid);
    return tid;
  }

  destroyTexturePair(tid) {
    const pair = this._texPairs.get(tid);
    if (!pair) return;
    try { pair.texA.destroy(); } catch { }
    try { pair.texB.destroy(); } catch { }

    if (Array.isArray(pair.tiles)) {
      for (const tile of pair.tiles) {
        if (Array.isArray(tile.frames)) for (const fb of tile.frames) { try { fb.destroy(); } catch { } }
        if (tile.posBuf && tile.posBuf !== this.nullPosBuffer) { try { tile.posBuf.destroy(); } catch { } }
      }
    }
    this._texPairs.delete(tid);

    if (this._tid === tid) {
      this._tid = null;
      this.inputTextureView = null;
      this.outputTextureView = null;
      this.viewA = null;
      this.viewB = null;
    }
  }

  destroyAllTexturePairs() {
    const ids = Array.from(this._texPairs.keys());
    for (const tid of ids) this.destroyTexturePair(tid);
  }

  setActiveTexture(tid) {
    if (!this._texPairs.has(tid)) throw new Error('setActiveTexture: invalid id');
    this._tid = tid;
    const pair = this._texPairs.get(tid);
    this.viewA = pair.viewA;
    this.viewB = pair.viewB;
    this.width = pair.tileWidth;
    this.height = pair.tileHeight;
    this.layers = pair.layers;
    this.inputTextureView = pair.isA ? pair.viewA : pair.viewB;
    this.outputTextureView = pair.isA ? pair.viewB : pair.viewA;
  }

  _buildPosBuffer(width, height, customData) {
    if ((this.useCustomPos | 0) === 0 && !customData) return this.nullPosBuffer;
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

  // WGSL Frame struct = 64 bytes
  _writeFrameUniform(frameBuffer, f) {
    const ab = new ArrayBuffer(64);
    const dv = new DataView(ab);
    dv.setUint32(0, f.fullWidth >>> 0, true);
    dv.setUint32(4, f.fullHeight >>> 0, true);
    dv.setUint32(8, f.tileWidth >>> 0, true);
    dv.setUint32(12, f.tileHeight >>> 0, true);
    dv.setInt32(16, f.originX | 0, true);
    dv.setInt32(20, f.originY | 0, true);
    dv.setInt32(24, f.originZ | 0, true);
    dv.setUint32(28, f.fullDepth >>> 0, true);
    dv.setUint32(32, f.tileDepth >>> 0, true);
    dv.setInt32(36, f.layerIndex | 0, true);
    dv.setUint32(40, f.layers >>> 0, true);
    dv.setUint32(44, 0, true);
    dv.setFloat32(48, f.originXf ?? 0.0, true); // fractional origin X (pixel-space)
    dv.setFloat32(52, f.originYf ?? 0.0, true); // fractional origin Y (pixel-space)
    // trailing vec2<f32> pad to match WGSL struct
    dv.setFloat32(56, 0.0, true);
    dv.setFloat32(60, 0.0, true);
    this.queue.writeBuffer(frameBuffer, 0, ab);
  }

  // NOTE: options may include customData, frameFullWidth, frameFullHeight (world extents)
  _create2DTileBindGroups(tid, options = {}) {
    const pair = this._texPairs.get(tid);
    if (!pair) throw new Error('_create2DTileBindGroups: invalid tid');

    // If tiles already created and not dirty we skip full recreation.
    if (Array.isArray(pair.tiles) && !pair.bindGroupDirty) {
      // Still honor potential customData (if provided we must rebuild posBufs)
      if (!options.customData) return;
      // If customData present, we'll allow rebuild of posBuf only (below).
    }

    const tiles = [];
    for (let ty = 0; ty < pair.tilesY; ty++) {
      for (let tx = 0; tx < pair.tilesX; tx++) {
        const layerIndex = ty * pair.tilesX + tx;
        const originX = tx * pair.tileWidth;
        const originY = ty * pair.tileHeight;

        // If a tile entry exists, reuse its posBuf and fb, otherwise create.
        let existingTile = (pair.tiles && pair.tiles[layerIndex]) || null;

        // Build/Reuse pos buffer. If customData passed we create a fresh posBuf for this tile
        let posBuf;
        if (existingTile && existingTile.posBuf && !options.customData) {
          posBuf = existingTile.posBuf;
        } else {
          posBuf = this._buildPosBuffer(pair.tileWidth, pair.tileHeight, options.customData);
        }

        // Reuse or create frame UBO (fb)
        let fb;
        if (existingTile && existingTile.frames && existingTile.frames[0]) {
          fb = existingTile.frames[0];
        } else {
          fb = this.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        }

        // world extents override (keeps pixel->world mapping consistent)
        const worldFullW = Number.isFinite(options.frameFullWidth) ? (options.frameFullWidth >>> 0) : pair.fullWidth;
        const worldFullH = Number.isFinite(options.frameFullHeight) ? (options.frameFullHeight >>> 0) : pair.fullHeight;

        // fractional scaling (no flooring) -> guarantees continuity across tiles and zoom
        const scaleX = worldFullW / pair.fullWidth;
        const scaleY = worldFullH / pair.fullHeight;
        const originXf = originX * scaleX; // float pixels in "world" pixel units
        const originYf = originY * scaleY;

        this._writeFrameUniform(fb, {
          fullWidth: worldFullW, fullHeight: worldFullH,
          tileWidth: pair.tileWidth, tileHeight: pair.tileHeight,
          originX, originY, originZ: 0,
          fullDepth: 1, tileDepth: 1,
          layerIndex, layers: pair.layers,
          originXf, originYf
        });

        // If existing bind-groups exist and no global dirty flagged, reuse them.
        let bgA = existingTile?.bgs?.[0]?.bgA ?? null;
        let bgB = existingTile?.bgs?.[0]?.bgB ?? null;

        if (!bgA || !bgB || pair.bindGroupDirty) {
          // Create new BGs using current buffers/views
          try {
            bgA = this.device.createBindGroup({
              layout: this.bindGroupLayout,
              entries: [
                { binding: 0, resource: { buffer: this.optionsBuffer } },
                { binding: 1, resource: { buffer: this.paramsBuffer } },
                { binding: 2, resource: { buffer: this.permBuffer } },
                { binding: 3, resource: pair.viewA },
                { binding: 4, resource: pair.viewB },
                { binding: 5, resource: { buffer: posBuf } },
                { binding: 6, resource: { buffer: fb } },
                // 3D unused for 2D path -> provide dummies
                { binding: 7, resource: this._dummy3D_sampleView },
                { binding: 8, resource: this._dummy3D_writeView },
              ]
            });

            bgB = this.device.createBindGroup({
              layout: this.bindGroupLayout,
              entries: [
                { binding: 0, resource: { buffer: this.optionsBuffer } },
                { binding: 1, resource: { buffer: this.paramsBuffer } },
                { binding: 2, resource: { buffer: this.permBuffer } },
                { binding: 3, resource: pair.viewB },
                { binding: 4, resource: pair.viewA },
                { binding: 5, resource: { buffer: posBuf } },
                { binding: 6, resource: { buffer: fb } },
                { binding: 7, resource: this._dummy3D_sampleView },
                { binding: 8, resource: this._dummy3D_writeView },
              ]
            });
          } catch (e) {
            throw new Error(`_create2DTileBindGroups: createBindGroup failed: ${e?.message || e}`);
          }
        }

        tiles.push({
          layerIndex, originX, originY,
          frames: [fb],
          posBuf,
          bgs: [{ bgA, bgB }]
        });
      }
    }

    pair.tiles = tiles;
    pair.bindGroupDirty = false;
    if (this._tid === tid) this._tiles = tiles;
  }

  // ---------------------------
  // core compute runner
  // ---------------------------
  /**
   * Old implementation awaited per-dispatch completion via onSubmittedWorkDone which
   * forced GPU syncs and heavy CPU overhead. New behavior:
   *  - Batch all compute dispatches for the provided noiseChoices into a single
   *    compute pass and submit once. This preserves ping-pong semantics because
   *    dispatches execute in order inside the same submission.
   *
   * Returns the "alternate" bind-group object which represents where the final
   * results live (for caller to update ping-pong state).
   */
  async _runPipelines(bgA, bgB, tileW, tileH, tileD, paramsArray, dispatchZ = 1) {
    let current = bgA;
    let alternate = bgB;
    const isArr = Array.isArray(paramsArray);
    let i = 0;

    // Create a single encoder + compute pass to batch dispatches.
    const enc = this.device.createCommandEncoder();
    const pass = enc.beginComputePass();

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

      pass.setPipeline(pipe);
      pass.setBindGroup(0, current);
      pass.dispatchWorkgroups(Math.ceil(tileW / 8), Math.ceil(tileH / 8), dispatchZ);

      // flip ping-pong for next quad
      [current, alternate] = [alternate, current];
    }

    pass.end();
    this.queue.submit([enc.finish()]);

    // We don't await completion here; caller's correctness only needs the
    // identity of the last used bind group object (alternate).
    return alternate;
  }

  // ---------------------------
  // 2D compute
  //  options: customData, frameFullWidth, frameFullHeight
  // ---------------------------
  async computeToTexture(width, height, paramsObj = {}, options = {}) {
    const W = width | 0, H = height | 0;
    if (!(W > 0 && H > 0)) throw new Error(`computeToTexture: invalid size ${width}x${height}`);

    // ensure pair sized to (tileWidth,tileHeight) for this full size
    if (this._tid == null) this._create2DPair(W, H);
    let pair = this._texPairs.get(this._tid);
    if (!pair || pair.fullWidth !== W || pair.fullHeight !== H) {
      const tid = this._create2DPair(W, H);
      this.setActiveTexture(tid);
      pair = this._texPairs.get(tid);
    }

    if (paramsObj && !Array.isArray(paramsObj)) this.setNoiseParams(paramsObj);

    // 2D path: ioFlags = 0 (2D in/out)
    const origOpts = options || {};
    this.setOptions({ ...origOpts, ioFlags: 0, useCustomPos: origOpts.useCustomPos ?? this.useCustomPos });

    if (!pair.tiles || pair.bindGroupDirty || origOpts.customData) {
      this._create2DTileBindGroups(this._tid, options);
    }

    const isAStart = pair.isA;
    let finalUsed = null;
    let lastBGs = null;

    for (const tile of pair.tiles) {
      const { bgs } = tile;
      const { bgA, bgB } = bgs[0];

      // Determine start/alt based on pair.isA and previously used binder
      const start = (!finalUsed ? (isAStart ? bgA : bgB) : (finalUsed === bgA ? bgA : bgB));
      const alt = (start === bgA) ? bgB : bgA;

      finalUsed = await this._runPipelines(
        start, alt,
        pair.tileWidth, pair.tileHeight, 1,
        paramsObj,
        1
      );

      lastBGs = { bgA, bgB };
    }

    const resultsInA = (finalUsed === lastBGs.bgB);
    pair.isA = resultsInA;
    this.isA = resultsInA;
    this.setActiveTexture(this._tid);

    return this.getCurrentView();
  }

  getCurrentView() {
    const p = this._texPairs.get(this._tid);
    if (!p) return null;
    return p.isA ? p.viewA : p.viewB;
  }

  // ---------------------------
  // 3D compute (chunking for large volumes)
  // ---------------------------
  _compute3DTiling(W, H, D) {
    const tw = Math.min(W, MAX_3D_TILE);
    const th = Math.min(H, MAX_3D_TILE);

    const maxBuf = this.device?.limits?.maxBufferSize ?? (256 * 1024 * 1024);
    const sliceBytes = tw * th * BYTES_PER_VOXEL;
    const tdByBuf = Math.max(1, Math.floor((maxBuf * 0.8) / Math.max(1, sliceBytes)));

    const td = Math.min(D, MAX_3D_TILE, tdByBuf);

    const nx = Math.ceil(W / tw);
    const ny = Math.ceil(H / th);
    const nz = Math.ceil(D / td);

    return { tw, th, td, nx, ny, nz };
  }

  _create3DChunks(W, H, D) {
    const t = this._compute3DTiling(W, H, D);
    const chunks = [];

    const usage3D = GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST;

    for (let kz = 0; kz < t.nz; kz++) {
      for (let ky = 0; ky < t.ny; ky++) {
        for (let kx = 0; kx < t.nx; kx++) {
          const ox = kx * t.tw;
          const oy = ky * t.th;
          const oz = kz * t.td;

          const texA = this.device.createTexture({
            size: { width: t.tw, height: t.th, depthOrArrayLayers: t.td },
            dimension: '3d',
            format: 'rgba16float',
            usage: usage3D
          });
          const texB = this.device.createTexture({
            size: { width: t.tw, height: t.th, depthOrArrayLayers: t.td },
            dimension: '3d',
            format: 'rgba16float',
            usage: usage3D
          });

          const viewA = texA.createView({ dimension: '3d' });
          const viewB = texB.createView({ dimension: '3d' });

          texA.label = `3D texA ${t.tw}x${t.th}x${t.td} @ (${kx},${ky},${kz})`;
          texB.label = `3D texB ${t.tw}x${t.th}x${t.td} @ (${kx},${ky},${kz})`;
          viewA.label = `3D:viewA[${kx},${ky},${kz}]`;
          viewB.label = `3D:viewB[${kx},${ky},${kz}]`;
          this._tag.set(viewA, `3D:A[${kx},${ky},${kz}]`);
          this._tag.set(viewB, `3D:B[${kx},${ky},${kz}]`);

          chunks.push({ texA, texB, viewA, viewB, ox, oy, oz, w: t.tw, h: t.th, d: t.td, isA: true, fb: null, posBuf: null, bgA: null, bgB: null });
        }
      }
    }

    return {
      chunks,
      tile: { w: t.tw, h: t.th, d: t.td },
      full: { w: W, h: H, d: D },
      grid: { nx: t.nx, ny: t.ny, nz: t.nz }
    };
  }

  _destroy3DSet(vol) {
    if (!vol) return;
    for (const c of vol.chunks) {
      try { c.texA.destroy(); } catch { }
      try { c.texB.destroy(); } catch { }
      c.viewA = null; c.viewB = null; c.bgA = null; c.bgB = null;
      if (c.fb) { try { c.fb.destroy(); } catch { } c.fb = null; }
      if (c.posBuf && c.posBuf !== this.nullPosBuffer) { try { c.posBuf.destroy(); } catch { } c.posBuf = null; }
    }
  }

  destroyAllVolumes() {
    for (const [k, v] of this._volumeCache) {
      this._destroy3DSet(v);
      this._volumeCache.delete(k);
    }
  }

  get3DView(id) {
    const vol = this._volumeCache.get(String(id));
    if (!vol) return null;
    const views = vol.chunks.map(c => (c.isA ? c.viewA : c.viewB));
    return (views.length === 1) ? views[0] : { views, meta: { full: vol.full, tile: vol.tile, grid: vol.grid } };
  }

  destroyVolume(id) {
    const key = String(id);
    const vol = this._volumeCache.get(key);
    if (!vol) return;
    this._destroy3DSet(vol);
    this._volumeCache.delete(key);
  }

  _getOrCreate3DVolume(W, H, D, id = null, worldFull = null) {
    const key = id ? String(id) : `${W}x${H}x${D}`;
    let vol = this._volumeCache.get(key);
    if (vol) return vol;

    vol = this._create3DChunks(W, H, D);

    for (const c of vol.chunks) {
      c.fb = this.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

      // allow worldFull override for consistent pixel->world mapping
      const fw = (worldFull && Number.isFinite(worldFull?.w)) ? (worldFull.w >>> 0) : vol.full.w;
      const fh = (worldFull && Number.isFinite(worldFull?.h)) ? (worldFull.h >>> 0) : vol.full.h;
      const fd = (worldFull && Number.isFinite(worldFull?.d)) ? (worldFull.d >>> 0) : vol.full.d;

      // fractional XY origins for chunked volumes (continuous across chunks)
      const scaleX = fw / vol.full.w;
      const scaleY = fh / vol.full.h;
      const originXf = c.ox * scaleX;
      const originYf = c.oy * scaleY;

      this._writeFrameUniform(c.fb, {
        fullWidth: fw, fullHeight: fh,
        tileWidth: c.w, tileHeight: c.h,
        originX: c.ox, originY: c.oy, originZ: c.oz,
        fullDepth: fd, tileDepth: c.d,
        layerIndex: 0, layers: 1,
        originXf, originYf
      });

      const posBuf = this._buildPosBuffer(c.w, c.h, null);
      c.posBuf = posBuf;

      // Create BGs initially
      try {
        c.bgA = this.device.createBindGroup({
          layout: this.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: this.optionsBuffer } },
            { binding: 1, resource: { buffer: this.paramsBuffer } },
            { binding: 2, resource: { buffer: this.permBuffer } },
            // 2D path unused -> use dummy sample/write views
            { binding: 3, resource: this._dummy2D_sampleView },
            { binding: 4, resource: this._dummy2D_writeView },
            { binding: 5, resource: { buffer: posBuf } },
            { binding: 6, resource: { buffer: c.fb } },
            // 3D in/out
            { binding: 7, resource: c.viewA },
            { binding: 8, resource: c.viewB },
          ]
        });

        c.bgB = this.device.createBindGroup({
          layout: this.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: this.optionsBuffer } },
            { binding: 1, resource: { buffer: this.paramsBuffer } },
            { binding: 2, resource: { buffer: this.permBuffer } },
            { binding: 3, resource: this._dummy2D_sampleView },
            { binding: 4, resource: this._dummy2D_writeView },
            { binding: 5, resource: { buffer: c.posBuf } },
            { binding: 6, resource: { buffer: c.fb } },
            { binding: 7, resource: c.viewB },
            { binding: 8, resource: c.viewA },
          ]
        });
      } catch (e) {
        throw new Error(`_getOrCreate3DVolume: createBindGroup failed: ${e?.message || e}`);
      }
    }

    vol._bindGroupsDirty = false;
    this._volumeCache.set(key, vol);
    return vol;
  }

  // add this helper to the class (place near other helpers)
  _recreate3DBindGroups(vol, worldFull = null) {
    if (!vol || !Array.isArray(vol.chunks)) return;

    // compute world extents used for frame UBOs (fallback to vol.full)
    const fw = (worldFull && Number.isFinite(worldFull.w)) ? (worldFull.w >>> 0) : vol.full.w;
    const fh = (worldFull && Number.isFinite(worldFull.h)) ? (worldFull.h >>> 0) : vol.full.h;
    const fd = (worldFull && Number.isFinite(worldFull.d)) ? (worldFull.d >>> 0) : vol.full.d;

    for (const c of vol.chunks) {
      // ensure per-chunk uniform buffer exists
      if (!c.fb) {
        c.fb = this.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        const scaleX = fw / vol.full.w;
        const scaleY = fh / vol.full.h;
        const originXf = c.ox * scaleX;
        const originYf = c.oy * scaleY;
        this._writeFrameUniform(c.fb, {
          fullWidth: fw, fullHeight: fh,
          tileWidth: c.w, tileHeight: c.h,
          originX: c.ox, originY: c.oy, originZ: c.oz,
          fullDepth: fd, tileDepth: c.d,
          layerIndex: 0, layers: 1,
          originXf, originYf
        });
      }

      // ensure pos buffer exists
      if (!c.posBuf) {
        c.posBuf = this._buildPosBuffer(c.w, c.h, null);
      }

      // recreate bind groups (2 variants: A and B). We *always* recreate BGs when dirty
      const entriesA = [
        { binding: 0, resource: { buffer: this.optionsBuffer } },
        { binding: 1, resource: { buffer: this.paramsBuffer } },
        { binding: 2, resource: { buffer: this.permBuffer } },
        // 2D path unused -> use dummy 2D views
        { binding: 3, resource: this._dummy2D_sampleView },
        { binding: 4, resource: this._dummy2D_writeView },
        { binding: 5, resource: { buffer: c.posBuf } },
        { binding: 6, resource: { buffer: c.fb } },
        // 3D in/out
        { binding: 7, resource: c.viewA },
        { binding: 8, resource: c.viewB }
      ];

      const entriesB = [
        { binding: 0, resource: { buffer: this.optionsBuffer } },
        { binding: 1, resource: { buffer: this.paramsBuffer } },
        { binding: 2, resource: { buffer: this.permBuffer } },
        { binding: 3, resource: this._dummy2D_sampleView },
        { binding: 4, resource: this._dummy2D_writeView },
        { binding: 5, resource: { buffer: c.posBuf } },
        { binding: 6, resource: { buffer: c.fb } },
        { binding: 7, resource: c.viewB },
        { binding: 8, resource: c.viewA }
      ];

      // Assign new bind groups
      try {
        c.bgA = this.device.createBindGroup({ layout: this.bindGroupLayout, entries: entriesA });
        c.bgB = this.device.createBindGroup({ layout: this.bindGroupLayout, entries: entriesB });
      } catch (e) {
        throw new Error(`_recreate3DBindGroups: failed to create bind groups: ${e?.message || e}`);
      }
    }

    vol._bindGroupsDirty = false;
  }

  // replace your computeToTexture3D with this implementation
  async computeToTexture3D(width, height, depth, paramsObj = {}, options = {}) {
    const W = width | 0, H = height | 0, D = depth | 0;
    if (!(W > 0 && H > 0 && D > 0)) throw new Error(`computeToTexture3D: invalid size ${width}x${height}x${depth}`);

    if (paramsObj && !Array.isArray(paramsObj)) this.setNoiseParams(paramsObj);

    // 3D path: ioFlags = 3 (3D in/out)
    const origOpts = options || {};
    this.setOptions({ ...origOpts, ioFlags: 3, useCustomPos: origOpts.useCustomPos ?? this.useCustomPos });

    const worldFull = (() => {
      if (options && (Number.isFinite(options.frameFullWidth) || Number.isFinite(options.frameFullHeight) || Number.isFinite(options.frameFullDepth))) {
        return {
          w: Number.isFinite(options.frameFullWidth) ? (options.frameFullWidth >>> 0) : W,
          h: Number.isFinite(options.frameFullHeight) ? (options.frameFullHeight >>> 0) : H,
          d: Number.isFinite(options.frameFullDepth) ? (options.frameFullDepth >>> 0) : D
        };
      }
      return null;
    })();

    const vol = this._getOrCreate3DVolume(W, H, D, options.id, worldFull);

    // ensure valid bind-groups (recreate lazily when invalidated)
    if (!vol) throw new Error('computeToTexture3D: failed to create or retrieve volume');
    if (vol._bindGroupsDirty || !vol.chunks[0].bgA || !vol.chunks[0].bgB) {
      this._recreate3DBindGroups(vol, worldFull);
    }

    let lastBG = null;
    for (const c of vol.chunks) {
      const start = c.isA ? c.bgA : c.bgB;
      const alt = c.isA ? c.bgB : c.bgA;

      // defensive check: ensure we have valid bindgroups before dispatch
      if (!start || !alt) {
        throw new Error('computeToTexture3D: missing bind groups (volume not initialized correctly)');
      }

      lastBG = await this._runPipelines(
        start, alt,
        c.w, c.h, c.d,
        paramsObj,
        c.d
      );
      c.isA = (lastBG === c.bgB);
    }

    const views = vol.chunks.map(c => (c.isA ? c.viewA : c.viewB));
    return (views.length === 1) ? views[0] : { views, meta: { full: vol.full, tile: vol.tile, grid: vol.grid } };
  }


  configureCanvas(canvas) {
    const format = (navigator.gpu.getPreferredCanvasFormat && navigator.gpu.getPreferredCanvasFormat()) || 'bgra8unorm';
    const ctx = canvas.getContext('webgpu');
    ctx.configure({ device: this.device, format, alphaMode: 'opaque', size: [canvas.width, canvas.height] });
    this._ctxMap.set(canvas, { ctx, size: [canvas.width, canvas.height] });
  }

  // ------- blit (2D-array preview + 3D-slice preview) -------
  initBlitRender() {
    if (!this.sampler) {
      this.sampler = this.device.createSampler({
        magFilter: 'linear', minFilter: 'linear',
        addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge'
      });
    }

    // -------- 2D ARRAY --------
    if (!this.bgl2D) {
      this.bgl2D = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d-array' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        ]
      });

      this.pipeline2D = this.device.createRenderPipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bgl2D] }),
        vertex: { module: this.device.createShaderModule({ code: blit2DWGSL }), entryPoint: 'vs_main' },
        fragment: {
          module: this.device.createShaderModule({ code: blit2DWGSL }), entryPoint: 'fs_main',
          targets: [{ format: 'bgra8unorm' }]
        },
        primitive: { topology: 'triangle-list' }
      });

      this.blit2DUbo = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    }

    // -------- 3D --------
    if (!this.bgl3D) {
      this.bgl3D = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '3d' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        ]
      });

      this.pipeline3D = this.device.createRenderPipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bgl3D] }),
        vertex: { module: this.device.createShaderModule({ code: blit3DWGSL }), entryPoint: 'vs_main' },
        fragment: {
          module: this.device.createShaderModule({ code: blit3DWGSL }), entryPoint: 'fs_main',
          targets: [{ format: 'bgra8unorm' }]
        },
        primitive: { topology: 'triangle-list' }
      });

      this.blit3DUbo = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    }
  }

  _renderCommonCanvasSetup(canvas, clear) {
    const format = 'bgra8unorm';
    let entry = this._ctxMap.get(canvas);
    if (!entry) {
      const ctx = canvas.getContext('webgpu');
      const size = [canvas.width | 0, canvas.height | 0];
      ctx.configure({ device: this.device, format, alphaMode: 'opaque', size });
      entry = { ctx, size };
      this._ctxMap.set(canvas, entry);
    } else {
      const curW = canvas.width | 0, curH = canvas.height | 0;
      if (entry.size[0] !== curW || entry.size[1] !== curH) {
        entry.size = [curW, curH];
        entry.ctx.configure({ device: this.device, format, alphaMode: 'opaque', size: entry.size });
      }
    }

    const enc = this.device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: entry.ctx.getCurrentTexture().createView(),
        loadOp: clear ? 'clear' : 'load',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store'
      }]
    });

    return { enc, pass, ctxEntry: entry };
  }

  // 2D-array: pick layer and channel
  renderTextureToCanvas(textureView, canvas, opts = {}) {
    const {
      layer = 0, channel = 0, preserveCanvasSize = true, clear = true
    } = opts;

    this.initBlitRender();

    if (!preserveCanvasSize) {
      try {
        const tex = textureView.texture;
        if (tex && typeof tex.width === 'number' && typeof tex.height === 'number') {
          canvas.width = tex.width;
          canvas.height = tex.height;
        }
      } catch { }
    }

    // write UBO (u32 layer, u32 channel, padding)
    const u = new Uint32Array([layer >>> 0, channel >>> 0, 0, 0]);
    this.queue.writeBuffer(this.blit2DUbo, 0, u.buffer, u.byteOffset, u.byteLength);

    const bg = this.device.createBindGroup({
      layout: this.bgl2D,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: textureView },
        { binding: 2, resource: { buffer: this.blit2DUbo } }
      ]
    });

    const { enc, pass } = this._renderCommonCanvasSetup(canvas, clear);
    pass.setPipeline(this.pipeline2D);
    pass.setBindGroup(0, bg);
    pass.draw(6, 1, 0, 0);
    pass.end();
    this.queue.submit([enc.finish()]);
  }

  // 3D: pick slice via index or normalized z
  renderTexture3DSliceToCanvas(target, canvas, opts = {}) {
    const {
      depth,
      slice = 0,
      zNorm = null,
      channel = 0,
      chunk = 0,
      preserveCanvasSize = true,
      clear = true
    } = opts;

    this.initBlitRender();

    let view3D, d;
    if (target && target.views && Array.isArray(target.views)) {
      view3D = target.views[Math.max(0, Math.min(chunk | 0, target.views.length - 1))];
      d = target.meta?.tile?.d ?? depth;
    } else {
      view3D = target;
      d = depth;
    }
    if (!view3D || !d) throw new Error('renderTexture3DSliceToCanvas: need a 3D view and its depth');

    if (!preserveCanvasSize) {
      try {
        const tex = view3D.texture;
        if (tex && typeof tex.width === 'number' && typeof tex.height === 'number') {
          canvas.width = tex.width;
          canvas.height = tex.height;
        }
      } catch { }
    }

    let z = (zNorm !== null && zNorm !== undefined) ? zNorm : ((Math.min(Math.max(slice, 0), d - 1) + 0.5) / d);
    z = Math.min(Math.max(z, 0.0), 1.0);

    const ab = new ArrayBuffer(16);
    const dv = new DataView(ab);
    dv.setFloat32(0, z, true);
    dv.setUint32(4, channel >>> 0, true);
    dv.setUint32(8, 0, true);
    dv.setUint32(12, 0, true);
    this.queue.writeBuffer(this.blit3DUbo, 0, ab);

    const bg = this.device.createBindGroup({
      layout: this.bgl3D,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: view3D },
        { binding: 2, resource: { buffer: this.blit3DUbo } }
      ]
    });

    const { enc, pass } = this._renderCommonCanvasSetup(canvas, clear);
    pass.setPipeline(this.pipeline3D);
    pass.setBindGroup(0, bg);
    pass.draw(6, 1, 0, 0);
    pass.end();
    this.queue.submit([enc.finish()]);
  }

}

// -----------------------------------------------------------------------------
// BaseNoise (unchanged logic)
// -----------------------------------------------------------------------------
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
