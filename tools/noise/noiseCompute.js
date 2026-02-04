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

// voroMode (u32) selects which derived value to return from the same F1/F2 Voronoi sample:
//
// 0  VORO_CELL             cell value (granite)
// 1  VORO_F1               F1 distance (nearest feature)
// 2  VORO_INTERIOR         gap = F2 - F1
// 3  VORO_EDGES            clamp(gap * edgeK)  (if edgeK<=0 uses default scale)
// 4  VORO_EDGE_THRESH      (gap >= threshold) ? gap : 0
// 5  VORO_FLAT_SHADE       cells=1, edges=0 where edges defined by (gap < threshold) with feather=edgeK
// 6  VORO_FLAT_SHADE_INV   edges=1, cells=0  where edges defined by (gap < threshold) with feather=edgeK
//
// 7  VORO_INTERIOR_SQ       gapSq = F2^2 - F1^2  (legacy cellular3D semantics)
// 8  VORO_EDGES_SQ          clamp(gapSq * edgeK) (if edgeK<=0 uses default scale)
// 9  VORO_EDGE_THRESH_SQ    (gapSq >= threshold) ? gapSq : 0
// 10 VORO_FLAT_SHADE_SQ     cells=1, edges=0 where edges defined by (gapSq < threshold) with feather=edgeK
// 11 VORO_FLAT_SHADE_INV_SQ edges=1, cells=0  where edges defined by (gapSq < threshold) with feather=edgeK
//
// 12 VORO_F1_THRESH        (F1 >= threshold) ? F1 : 0
// 13 VORO_F1_MASK          smooth mask 0..1 ramp from threshold to threshold+edgeK
// 14 VORO_F1_MASK_INV      inverted smooth mask
//
// 15 VORO_EDGE_RCP         edge falloff = 1 / (1 + gap * edgeK)
// 16 VORO_EDGE_RCP_SQ      edge falloff = 1 / (1 + gapSq * edgeK)

import noiseWGSL from "./noiseCompute.wgsl";
import blit2DWGSL from "./noiseBlit.wgsl";
import blit3DWGSL from "./noiseBlit3D.wgsl";

// Should be derived from device limits in real code
const MAX_2D_TILE = 4096;

//todo: separate compositing pipeline for higher res images with cheaper memory structures.
const COMPOSITE_TILE_2D = 2048; // scratch tile size for large outputs
const COMPOSITE_DIM_THRESHOLD = 4096; // if either side exceeds this, use composite path
//theoretical limit on modern hardware is like 12K or 16K for a total composite, we just need to compute strips to composite a final compressed texture. It's doable

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

    this.maxBufferChunkBytes = 8_000_000;

    // Keep in sync with WGSL entry points
    this.entryPoints = [
      "computePerlin",
      "computeBillow",
      "computeAntiBillow",
      "computeRidge",
      "computeAntiRidge",
      "computeRidgedMultifractal",
      "computeRidgedMultifractal2",
      "computeRidgedMultifractal3",
      "computeRidgedMultifractal4",
      "computeAntiRidgedMultifractal",
      "computeAntiRidgedMultifractal2",
      "computeAntiRidgedMultifractal3",
      "computeAntiRidgedMultifractal4",
      "computeFBM",
      "computeFBM2",
      "computeFBM3",
      "computeCellularBM1",
      "computeCellularBM2",
      "computeCellularBM3",
      "computeVoronoiBM1",
      "computeVoronoiBM2",
      "computeVoronoiBM3",
      "computeCellular",
      "computeWorley",
      "computeAntiCellular",
      "computeAntiWorley",
      "computeLanczosBillow",
      "computeLanczosAntiBillow",
      "computeVoronoiTileNoise",
      "computeVoronoiCircleNoise",
      "computeVoronoiCircle2",
      "computeVoronoiFlatShade",
      "computeVoronoiRipple3D",
      "computeVoronoiRipple3D2",
      "computeVoronoiCircularRipple",
      "computeFVoronoiRipple3D",
      "computeFVoronoiCircularRipple",
      "computeRippleNoise",
      "computeFractalRipples",
      "computeHexWorms",
      "computePerlinWorms",
      "computeWhiteNoise",
      "computeBlueNoise",
      "computeSimplex",
      "computeSimplexFBM",
      "computeCurl2D",
      "computeCurlFBM2D",
      "computeDomainWarpFBM1",
      "computeDomainWarpFBM2",

      "computeGaborAnisotropic",
      "computeGaborMagic",

      "computeTerraceNoise",
      "computeFoamNoise",
      "computeTurbulence",
      "computePerlin4D",
      "computeWorley4D",
      "computeAntiWorley4D",
      "computeCellular4D",
      "computeAntiCellular4D",
      "computeBillow4D",
      "computeAntiBillow4D",
      "computeLanczosBillow4D",
      "computeLanczosAntiBillow4D",
      "computeFBM4D",
      "computeVoronoi4D",
      "computeVoronoiBM1_4D",
      "computeVoronoiBM2_4D",
      "computeVoronoiBM3_4D",
      "computeVoronoiBM1_4D_vec",
      "computeVoronoiBM2_4D_vec",
      "computeVoronoiBM3_4D_vec",

      "computeWorleyBM1_4D",
      "computeWorleyBM2_4D",
      "computeWorleyBM3_4D",
      "computeWorleyBM1_4D_vec",
      "computeWorleyBM2_4D_vec",
      "computeWorleyBM3_4D_vec",
      "computeCellularBM1_4D",
      "computeCellularBM2_4D",
      "computeCellularBM3_4D",
      "computeCellularBM1_4D_vec",
      "computeCellularBM2_4D_vec",
      "computeCellularBM3_4D_vec",

      "computeTerraceNoise4D",
      "computeFoamNoise4D",
      "computeTurbulence4D",

      //normal map computing.
      "computeGauss5x5",
      "computeNormal",
      "computeNormal8",
      "computeSphereNormal",
      "computeNormalVolume",
      "clearTexture",
    ];

    this.shaderModule = device.createShaderModule({ code: noiseWGSL });

    // Bind group layout (matches WGSL)
    this.bindGroupLayout = device.createBindGroupLayout({
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
        }, // perm table
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float", viewDimension: "2d-array" },
        }, // input 2D-array (sampled)
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: "write-only",
            format: "rgba16float",
            viewDimension: "2d-array",
          },
        }, // output 2D-array (storage)
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        }, // positions
        {
          binding: 6,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // frame
        {
          binding: 7,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float", viewDimension: "3d" },
        }, // input 3D
        {
          binding: 8,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: "write-only",
            format: "rgba16float",
            viewDimension: "3d",
          },
        }, // output 3D
      ],
    });

    this.pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    });
    this.pipelines = new Map();

    // 2D ping-pong pairs
    this._texPairs = new Map();
    this._tid = null;
    this._tag = new WeakMap();
    this._default2DKey = "__default2d";

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
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Params UBO: 22 * 4 bytes (matches WGSL struct with new fields)
    this.paramsBuffer = this.device.createBuffer({
      size: 22 * 4, // <- updated
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Perm table: 512 u32
    this.permBuffer = this.device.createBuffer({
      size: 512 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Null pos buffer used when custom positions are not supplied
    this.nullPosBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
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
        format: "rgba16float",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
      });
      this._dummy2D_sampleView = this._dummy2D_sampleTex.createView({
        dimension: "2d-array",
        arrayLayerCount: 1,
      });
    }

    // 2D write dummy (storage-binding)
    if (!this._dummy2D_writeTex) {
      this._dummy2D_writeTex = this.device.createTexture({
        size: [1, 1, 1],
        format: "rgba16float",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST,
      });
      this._dummy2D_writeView = this._dummy2D_writeTex.createView({
        dimension: "2d-array",
        arrayLayerCount: 1,
      });
    }

    // 3D sampled dummy
    if (!this._dummy3D_sampleTex) {
      this._dummy3D_sampleTex = this.device.createTexture({
        size: { width: 1, height: 1, depthOrArrayLayers: 1 },
        dimension: "3d",
        format: "rgba16float",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
      });
      this._dummy3D_sampleView = this._dummy3D_sampleTex.createView({
        dimension: "3d",
      });
    }

    // 3D write dummy
    if (!this._dummy3D_writeTex) {
      this._dummy3D_writeTex = this.device.createTexture({
        size: { width: 1, height: 1, depthOrArrayLayers: 1 },
        dimension: "3d",
        format: "rgba16float",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST,
      });
      this._dummy3D_writeView = this._dummy3D_writeTex.createView({
        dimension: "3d",
      });
    }
  }

  _getMaxBufferChunkBytes(requested) {
    const devMax = this.device?.limits?.maxBufferSize ?? 256 * 1024 * 1024;
    const cap = Math.max(1024 * 1024, Math.floor(devMax * 0.9));

    let want = Number.isFinite(requested)
      ? Math.floor(requested)
      : this.maxBufferChunkBytes;
    if (!Number.isFinite(want) || want <= 0) want = this.maxBufferChunkBytes;

    // keep it >= 4 and 4-byte aligned for writeBuffer
    want = Math.max(4, want) & ~3;

    return Math.min(cap, want);
  }

  _writeBufferChunked(
    dstBuffer,
    dstOffsetBytes,
    srcAB,
    srcOffsetBytes,
    byteLength,
    maxChunkBytes = null,
  ) {
    const total = byteLength | 0;
    if (!(total > 0)) return;

    const chunk = this._getMaxBufferChunkBytes(maxChunkBytes);
    let off = 0;

    while (off < total) {
      let n = Math.min(chunk, total - off) | 0;
      n = n & ~3;
      if (n <= 0) break;

      this.queue.writeBuffer(
        dstBuffer,
        (dstOffsetBytes + off) | 0,
        srcAB,
        (srcOffsetBytes + off) | 0,
        n,
      );

      off = (off + n) | 0;
    }

    if (off !== total) {
      throw new Error(
        `_writeBufferChunked: incomplete write ${off}/${total} bytes`,
      );
    }
  }

  async _readBGRA8TextureToRGBA8Pixels(texture, W, H, opts = {}) {
    const width = Math.max(1, W | 0);
    const height = Math.max(1, H | 0);

    const bytesPerPixel = 4;
    const align = 256;
    const bytesPerRowUnaligned = width * bytesPerPixel;
    const bytesPerRow = Math.ceil(bytesPerRowUnaligned / align) * align;

    const maxBuf = this.device?.limits?.maxBufferSize ?? 256 * 1024 * 1024;
    const cap = Math.max(1024 * 1024, Math.floor(maxBuf * 0.9));

    let chunkBytes = this._getMaxBufferChunkBytes(opts.maxBufferChunkBytes);
    if (chunkBytes < bytesPerRow) chunkBytes = bytesPerRow;
    if (bytesPerRow > cap) {
      throw new Error(
        `_readBGRA8TextureToRGBA8Pixels: bytesPerRow=${bytesPerRow} exceeds safe buffer cap=${cap}`,
      );
    }

    const rowsPerChunk = Math.max(1, Math.floor(chunkBytes / bytesPerRow)) | 0;
    const pixels = new Uint8ClampedArray(width * height * 4);

    const chunks = [];
    const encoder = this.device.createCommandEncoder();

    for (let y0 = 0; y0 < height; y0 += rowsPerChunk) {
      const rows = Math.min(rowsPerChunk, height - y0) | 0;
      const bufSize = (bytesPerRow * rows) | 0;

      const readBuffer = this.device.createBuffer({
        size: bufSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });

      encoder.copyTextureToBuffer(
        { texture, origin: { x: 0, y: y0, z: 0 } },
        { buffer: readBuffer, bytesPerRow, rowsPerImage: rows },
        { width, height: rows, depthOrArrayLayers: 1 },
      );

      chunks.push({ readBuffer, y0, rows });
    }

    this.queue.submit([encoder.finish()]);

    if (this.queue && this.queue.onSubmittedWorkDone) {
      try {
        await this.queue.onSubmittedWorkDone();
      } catch (e) {}
    }

    for (const ch of chunks) {
      const { readBuffer, y0, rows } = ch;

      await readBuffer.mapAsync(GPUMapMode.READ);
      const mapped = readBuffer.getMappedRange();
      const src = new Uint8Array(mapped);

      for (let ry = 0; ry < rows; ry++) {
        const srcRow = ry * bytesPerRow;
        const dstRow = (y0 + ry) * width * 4;

        for (let x = 0; x < width; x++) {
          const si = srcRow + x * 4;
          const di = dstRow + x * 4;

          pixels[di + 0] = src[si + 2];
          pixels[di + 1] = src[si + 1];
          pixels[di + 2] = src[si + 0];
          pixels[di + 3] = src[si + 3];
        }
      }

      readBuffer.unmap();
      readBuffer.destroy();
    }

    return pixels;
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
        console.warn(
          "setInputTextureView: provided texture view not created with TEXTURE_BINDING; ignoring.",
        );
        return;
      }
    } catch (e) {
      /* ignore */
    }
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
        console.warn(
          "setOutputTextureView: provided texture view not created with STORAGE_BINDING; ignoring.",
        );
        return;
      }
    } catch (e) {
      /* ignore */
    }
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
      ioFlags = 0,
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
    const p = params || {};
    const prev = this._lastNoiseParams || {};
    const has = Object.prototype.hasOwnProperty;

    const pickNum = (k, fallback) => {
      const v = has.call(p, k) ? p[k] : prev[k];
      const n = Number(v);
      if (Number.isFinite(n)) return n;
      const fb = Number(fallback);
      return Number.isFinite(fb) ? fb : 0;
    };

    const pickU32 = (k, fallback) => {
      const v = has.call(p, k) ? p[k] : prev[k];
      const n = Number(v);
      if (Number.isFinite(n)) return n >>> 0;
      const fb = Number(fallback);
      return Number.isFinite(fb) ? fb >>> 0 : 0;
    };

    const pickI32 = (k, fallback) => {
      const v = has.call(p, k) ? p[k] : prev[k];
      const n = Number(v);
      if (Number.isFinite(n)) return n | 0;
      const fb = Number(fallback);
      return Number.isFinite(fb) ? fb | 0 : 0;
    };

    const pickBoolU32 = (k, fallback) => {
      const v = has.call(p, k) ? p[k] : prev[k];
      if (v === undefined) return (fallback ? 1 : 0) >>> 0;
      return (v ? 1 : 0) >>> 0;
    };

    const seed = pickI32("seed", prev.seed ?? Date.now() | 0);

    const zoomRaw = pickNum("zoom", prev.zoom ?? 1.0);
    const freqRaw = pickNum("freq", prev.freq ?? 1.0);
    const _zoom = Math.max(zoomRaw || 0, 1e-6);
    const _freq = Math.max(freqRaw || 0, 1e-6);

    const octaves = pickU32("octaves", prev.octaves ?? 8);
    const turbulence = pickBoolU32("turbulence", prev.turbulence ?? 0);

    const lacunarity = pickNum("lacunarity", prev.lacunarity ?? 2.0);
    const gain = pickNum("gain", prev.gain ?? 0.5);

    const xShift = pickNum("xShift", prev.xShift ?? 0.0);
    const yShift = pickNum("yShift", prev.yShift ?? 0.0);
    const zShift = pickNum("zShift", prev.zShift ?? 0.0);

    const seedAngle = pickNum("seedAngle", prev.seedAngle ?? 0.0);
    const exp1 = pickNum("exp1", prev.exp1 ?? 1.0);
    const exp2 = pickNum("exp2", prev.exp2 ?? 0.0);
    const threshold = pickNum("threshold", prev.threshold ?? 0.1);
    const rippleFreq = pickNum("rippleFreq", prev.rippleFreq ?? 10.0);
    const time = pickNum("time", prev.time ?? 0.0);
    const warpAmp = pickNum("warpAmp", prev.warpAmp ?? 0.5);
    const gaborRadius = pickNum("gaborRadius", prev.gaborRadius ?? 4.0);
    const terraceStep = pickNum("terraceStep", prev.terraceStep ?? 8.0);

    const toroidal = pickBoolU32("toroidal", prev.toroidal ?? 0);
    const voroMode = pickU32("voroMode", prev.voroMode ?? 0);
    const edgeK = pickNum("edgeK", prev.edgeK ?? 0.0);

    const buf = new ArrayBuffer(22 * 4);
    const dv = new DataView(buf);
    let base = 0;

    dv.setUint32(base + 0, seed >>> 0, true);
    dv.setFloat32(base + 4, _zoom, true);
    dv.setFloat32(base + 8, _freq, true);
    dv.setUint32(base + 12, octaves >>> 0, true);
    dv.setFloat32(base + 16, lacunarity, true);
    dv.setFloat32(base + 20, gain, true);
    dv.setFloat32(base + 24, xShift, true);
    dv.setFloat32(base + 28, yShift, true);
    dv.setFloat32(base + 32, zShift, true);
    dv.setUint32(base + 36, turbulence >>> 0, true);
    dv.setFloat32(base + 40, seedAngle, true);
    dv.setFloat32(base + 44, exp1, true);
    dv.setFloat32(base + 48, exp2, true);
    dv.setFloat32(base + 52, threshold, true);
    dv.setFloat32(base + 56, rippleFreq, true);
    dv.setFloat32(base + 60, time, true);
    dv.setFloat32(base + 64, warpAmp, true);
    dv.setFloat32(base + 68, gaborRadius, true);
    dv.setFloat32(base + 72, terraceStep, true);

    dv.setUint32(base + 76, toroidal >>> 0, true);
    dv.setUint32(base + 80, voroMode >>> 0, true);
    dv.setFloat32(base + 84, edgeK, true);

    this.queue.writeBuffer(this.paramsBuffer, 0, buf);

    this._lastNoiseParams = {
      seed,
      zoom: _zoom,
      freq: _freq,
      octaves,
      lacunarity,
      gain,
      xShift,
      yShift,
      zShift,
      turbulence,
      seedAngle,
      exp1,
      exp2,
      threshold,
      rippleFreq,
      time,
      warpAmp,
      gaborRadius,
      terraceStep,
      toroidal,
      voroMode,
      edgeK,
    };

    for (const pair of this._texPairs.values()) pair.bindGroupDirty = true;

    for (const [key, vol] of this._volumeCache) {
      if (!vol || !Array.isArray(vol.chunks)) continue;
      vol._bindGroupsDirty = true;
    }
  }

  _numOr0(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  _resolveScroll2D(options, outW, outH, worldFullW, worldFullH, cropMode) {
    const o = options || {};

    const outw = Math.max(1, outW | 0);
    const outh = Math.max(1, outH | 0);

    const fullw = Math.max(1, (worldFullW ?? outw) | 0);
    const fullh = Math.max(1, (worldFullH ?? outh) | 0);

    const w = cropMode ? fullw : outw;
    const h = cropMode ? fullh : outh;

    const offX = this._numOr0(o.offsetX) * w;
    const offY = this._numOr0(o.offsetY) * h;

    const baseXf =
      offX +
      this._numOr0(o.offsetXf) +
      this._numOr0(o.originXf) +
      this._numOr0(o.originX);

    const baseYf =
      offY +
      this._numOr0(o.offsetYf) +
      this._numOr0(o.originYf) +
      this._numOr0(o.originY);

    return { baseXf, baseYf };
  }

  _resolveScroll3D(options, outW, outH, outD) {
    const o = options || {};

    const w = Math.max(1, outW | 0);
    const h = Math.max(1, outH | 0);
    const d = Math.max(1, outD | 0);

    const offX = this._numOr0(o.offsetX) * w;
    const offY = this._numOr0(o.offsetY) * h;
    const offZ = this._numOr0(o.offsetZ) * d;

    const baseXf =
      offX +
      this._numOr0(o.offsetXf) +
      this._numOr0(o.originXf) +
      this._numOr0(o.originX);

    const baseYf =
      offY +
      this._numOr0(o.offsetYf) +
      this._numOr0(o.originYf) +
      this._numOr0(o.originY);

    const baseZf =
      offZ +
      this._numOr0(o.offsetZf) +
      this._numOr0(o.originZf) +
      this._numOr0(o.originZ);

    const baseZ = Math.floor(baseZf) | 0;

    return { baseXf, baseYf, baseZ };
  }

  _update2DTileFrames(tid, options = {}) {
    const pair = this._texPairs.get(tid);
    if (!pair || !Array.isArray(pair.tiles) || pair.tiles.length === 0) return;

    let worldFullW = Number.isFinite(options.frameFullWidth)
      ? options.frameFullWidth >>> 0
      : pair.fullWidth;

    let worldFullH = Number.isFinite(options.frameFullHeight)
      ? options.frameFullHeight >>> 0
      : pair.fullHeight;

    const cropMode =
      options.squareWorld ||
      String(options.worldMode || "").toLowerCase() === "crop";

    if (options.squareWorld) {
      const m =
        Math.max(worldFullW, worldFullH, pair.fullWidth, pair.fullHeight) >>> 0;
      worldFullW = m;
      worldFullH = m;
    }

    const outW = pair.fullWidth >>> 0;
    const outH = pair.fullHeight >>> 0;

    const { baseXf, baseYf } = this._resolveScroll2D(
      options,
      outW,
      outH,
      worldFullW,
      worldFullH,
      cropMode,
    );

    const scaleX = cropMode ? 1.0 : worldFullW / Math.max(1, outW);
    const scaleY = cropMode ? 1.0 : worldFullH / Math.max(1, outH);

    for (const tile of pair.tiles) {
      const fb = tile?.frames?.[0];
      if (!fb) continue;

      const ox = tile.originX | 0;
      const oy = tile.originY | 0;

      const worldX = (ox + baseXf) * scaleX;
      const worldY = (oy + baseYf) * scaleY;

      const originXf = worldFullW > 0 ? worldX / worldFullW : 0.0;
      const originYf = worldFullH > 0 ? worldY / worldFullH : 0.0;

      this._writeFrameUniform(fb, {
        fullWidth: worldFullW,
        fullHeight: worldFullH,
        tileWidth: pair.tileWidth,
        tileHeight: pair.tileHeight,
        originX: ox,
        originY: oy,
        originZ: 0,
        fullDepth: 1,
        tileDepth: 1,
        layerIndex: tile.layerIndex | 0,
        layers: pair.layers >>> 0,
        originXf,
        originYf,
      });
    }
  }

  _update3DChunkFrames(vol, worldFull = null, options = {}) {
    if (!vol || !Array.isArray(vol.chunks) || vol.chunks.length === 0) return;

    const fw =
      worldFull && Number.isFinite(worldFull?.w)
        ? worldFull.w >>> 0
        : vol.full.w;

    const fh =
      worldFull && Number.isFinite(worldFull?.h)
        ? worldFull.h >>> 0
        : vol.full.h;

    const fd =
      worldFull && Number.isFinite(worldFull?.d)
        ? worldFull.d >>> 0
        : vol.full.d;

    const outW = vol.full.w >>> 0;
    const outH = vol.full.h >>> 0;
    const outD = vol.full.d >>> 0;

    const { baseXf, baseYf, baseZ } = this._resolveScroll3D(
      options,
      outW,
      outH,
      outD,
    );

    const scaleX = fw / Math.max(1, outW);
    const scaleY = fh / Math.max(1, outH);

    for (const c of vol.chunks) {
      if (!c.fb) {
        c.fb = this.device.createBuffer({
          size: 64,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
      }

      const worldX = ((c.ox | 0) + baseXf) * scaleX;
      const worldY = ((c.oy | 0) + baseYf) * scaleY;

      const originXf = fw > 0 ? worldX / fw : 0.0;
      const originYf = fh > 0 ? worldY / fh : 0.0;

      const originZ = ((c.oz | 0) + baseZ) | 0;

      this._writeFrameUniform(c.fb, {
        fullWidth: fw,
        fullHeight: fh,
        tileWidth: c.w,
        tileHeight: c.h,
        originX: c.ox | 0,
        originY: c.oy | 0,
        originZ,
        fullDepth: fd,
        tileDepth: c.d,
        layerIndex: 0,
        layers: 1,
        originXf,
        originYf,
      });
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

  _create2DPair(W, H, tid = null) {
    const t = this._compute2DTiling(W, H);
    const usage =
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST;

    const makeTex = (label) =>
      this.device.createTexture({
        label,
        size: [t.tileW, t.tileH, t.layers],
        format: "rgba16float",
        usage,
      });

    const desc = { dimension: "2d-array", arrayLayerCount: t.layers };

    const id =
      tid !== null && tid !== undefined
        ? String(tid)
        : String(this._texPairs.size);

    const texA = makeTex(`2D texA ${W}x${H}x${t.layers} (${id})`);
    const texB = makeTex(`2D texB ${W}x${H}x${t.layers} (${id})`);
    const viewA = texA.createView(desc);
    const viewB = texB.createView(desc);

    viewA.label = `2D:viewA (${id})`;
    viewB.label = `2D:viewB (${id})`;
    this._tag.set(viewA, `2D:A (${id})`);
    this._tag.set(viewB, `2D:B (${id})`);

    this._texPairs.set(id, {
      texA,
      texB,
      viewA,
      viewB,
      fullWidth: W,
      fullHeight: H,
      tileWidth: t.tileW,
      tileHeight: t.tileH,
      tilesX: t.tilesX,
      tilesY: t.tilesY,
      layers: t.layers,
      isA: true,
      tiles: null,
      bindGroupDirty: true,
    });

    if (this._tid === null) this.setActiveTexture(id);
    return id;
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
    const id = String(tid);
    const pair = this._texPairs.get(id);
    if (!pair) return;

    try {
      pair.texA.destroy();
    } catch {}
    try {
      pair.texB.destroy();
    } catch {}

    if (Array.isArray(pair.tiles)) {
      for (const tile of pair.tiles) {
        if (Array.isArray(tile.frames)) {
          for (const fb of tile.frames) {
            try {
              fb.destroy();
            } catch {}
          }
        }
        if (tile.posBuf && tile.posBuf !== this.nullPosBuffer) {
          try {
            tile.posBuf.destroy();
          } catch {}
        }
      }
    }

    this._texPairs.delete(id);

    if (this._tid === id) {
      this._tid = null;
      this.inputTextureView = null;
      this.outputTextureView = null;
      this.viewA = null;
      this.viewB = null;
    }
  }

  destroyAllTexturePairs() {
    const ids = Array.from(this._texPairs.keys());
    for (const id of ids) this.destroyTexturePair(id);
  }

  setActiveTexture(tid) {
    const id = String(tid);
    if (!this._texPairs.has(id))
      throw new Error("setActiveTexture: invalid id");

    this._tid = id;
    const pair = this._texPairs.get(id);

    this.viewA = pair.viewA;
    this.viewB = pair.viewB;
    this.width = pair.tileWidth;
    this.height = pair.tileHeight;
    this.layers = pair.layers;

    this.inputTextureView = pair.isA ? pair.viewA : pair.viewB;
    this.outputTextureView = pair.isA ? pair.viewB : pair.viewA;
  }

  _buildPosBuffer(width, height, customData) {
    if (!(customData instanceof Float32Array) || customData.byteLength <= 0) {
      return this.nullPosBuffer;
    }

    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    const numPixels = w * h;

    const expectedLen = numPixels * 4;
    if (customData.length !== expectedLen) {
      throw new Error(
        `_buildPosBuffer: customData length ${customData.length} != expected ${expectedLen} (width=${w}, height=${h})`,
      );
    }

    const devMax = this.device?.limits?.maxBufferSize ?? 2147483648;
    const safeMax = Math.floor(devMax * 0.98);

    if (customData.byteLength > safeMax) {
      throw new Error(
        `_buildPosBuffer: ${customData.byteLength} bytes exceeds maxBufferSize ${devMax} (w=${w}, h=${h})`,
      );
    }

    const buf = this.device.createBuffer({
      size: customData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this._writeBufferChunked(
      buf,
      0,
      customData.buffer,
      customData.byteOffset,
      customData.byteLength,
      this.maxBufferChunkBytes,
    );

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
  //       options.squareWorld: if true, normalize both axes by max(fullW, fullH) and treat pixels as a crop of that space
  //       options.worldMode: "crop" | "stretch" (default stretch). "crop" maps pixel coords 1:1 into the larger world extents.
  _create2DTileBindGroups(tid, options = {}) {
    const pair = this._texPairs.get(tid);
    if (!pair) throw new Error("_create2DTileBindGroups: invalid tid");

    const wantsCustomPos = ((options.useCustomPos ?? 0) | 0) !== 0;
    const customData =
      wantsCustomPos && options.customData instanceof Float32Array
        ? options.customData
        : null;

    const hasCustomData = !!customData;

    const hadCustomBefore =
      Array.isArray(pair.tiles) && pair.tiles.some((t) => t && t.posIsCustom);

    if (!hasCustomData && hadCustomBefore) {
      pair.bindGroupDirty = true;
    }

    if (Array.isArray(pair.tiles) && !pair.bindGroupDirty && !hasCustomData) {
      return;
    }

    const tiles = [];
    for (let ty = 0; ty < pair.tilesY; ty++) {
      for (let tx = 0; tx < pair.tilesX; tx++) {
        const layerIndex = ty * pair.tilesX + tx;
        const originX = tx * pair.tileWidth;
        const originY = ty * pair.tileHeight;

        const existingTile = (pair.tiles && pair.tiles[layerIndex]) || null;

        let posBuf = this.nullPosBuffer;
        let posIsCustom = false;

        if (hasCustomData) {
          posBuf = this._buildPosBuffer(
            pair.tileWidth,
            pair.tileHeight,
            customData,
          );
          posIsCustom = posBuf !== this.nullPosBuffer;
        } else if (
          existingTile &&
          existingTile.posBuf &&
          !existingTile.posIsCustom
        ) {
          posBuf = existingTile.posBuf;
          posIsCustom = false;
        } else {
          posBuf = this.nullPosBuffer;
          posIsCustom = false;
          if (existingTile && existingTile.posBuf && existingTile.posIsCustom) {
            try {
              existingTile.posBuf.destroy();
            } catch {}
          }
        }

        let fb;
        if (existingTile && existingTile.frames && existingTile.frames[0]) {
          fb = existingTile.frames[0];
        } else {
          fb = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          });
        }

        let worldFullW = Number.isFinite(options.frameFullWidth)
          ? options.frameFullWidth >>> 0
          : pair.fullWidth;
        let worldFullH = Number.isFinite(options.frameFullHeight)
          ? options.frameFullHeight >>> 0
          : pair.fullHeight;

        const cropMode =
          options.squareWorld ||
          String(options.worldMode || "").toLowerCase() === "crop";

        if (options.squareWorld) {
          const m =
            Math.max(
              worldFullW,
              worldFullH,
              pair.fullWidth,
              pair.fullHeight,
            ) >>> 0;
          worldFullW = m;
          worldFullH = m;
        }

        let originXf, originYf;
        if (cropMode) {
          originXf = originX;
          originYf = originY;
        } else {
          const scaleX = worldFullW / pair.fullWidth;
          const scaleY = worldFullH / pair.fullHeight;
          originXf = originX * scaleX;
          originYf = originY * scaleY;
        }

        this._writeFrameUniform(fb, {
          fullWidth: worldFullW,
          fullHeight: worldFullH,
          tileWidth: pair.tileWidth,
          tileHeight: pair.tileHeight,
          originX,
          originY,
          originZ: 0,
          fullDepth: 1,
          tileDepth: 1,
          layerIndex,
          layers: pair.layers,
          originXf,
          originYf,
        });

        let bgA = existingTile?.bgs?.[0]?.bgA ?? null;
        let bgB = existingTile?.bgs?.[0]?.bgB ?? null;

        if (!bgA || !bgB || pair.bindGroupDirty) {
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
              { binding: 7, resource: this._dummy3D_sampleView },
              { binding: 8, resource: this._dummy3D_writeView },
            ],
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
            ],
          });
        }

        tiles.push({
          layerIndex,
          originX,
          originY,
          frames: [fb],
          posBuf,
          posIsCustom,
          bgs: [{ bgA, bgB }],
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
  async _runPipelines(
    bgA,
    bgB,
    tileW,
    tileH,
    tileD,
    paramsArray,
    dispatchZ = 1,
  ) {
    let current = bgA;
    let alternate = bgB;
    const isArr = Array.isArray(paramsArray);
    let i = 0;

    // Create a single encoder + compute pass to batch dispatches.
    const enc = this.device.createCommandEncoder();
    const pass = enc.beginComputePass();

    for (const choice of this.noiseChoices) {
      const entry =
        typeof choice === "number" ? this.entryPoints[choice] : choice;

      let pipe = this.pipelines.get(entry);
      if (!pipe) {
        pipe = this.device.createComputePipeline({
          layout: this.pipelineLayout,
          compute: { module: this.shaderModule, entryPoint: entry },
        });
        this.pipelines.set(entry, pipe);
      }

      if (isArr) this.setNoiseParams(paramsArray[i++]);

      pass.setPipeline(pipe);
      pass.setBindGroup(0, current);
      pass.dispatchWorkgroups(
        Math.ceil(tileW / 8),
        Math.ceil(tileH / 8),
        dispatchZ,
      );

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
    const W = width | 0;
    const H = height | 0;
    if (!(W > 0 && H > 0)) {
      throw new Error(`computeToTexture: invalid size ${width}x${height}`);
    }

    const key = this._get2DKey(options);
    const existing = this._texPairs.get(key);

    if (!existing) {
      this._create2DPair(W, H, key);
    } else if (existing.fullWidth !== W || existing.fullHeight !== H) {
      this.destroyTexturePair(key);
      this._create2DPair(W, H, key);
    }

    this.setActiveTexture(key);

    const pair = this._texPairs.get(key);
    if (!pair) throw new Error("computeToTexture: missing pair after ensure");

    if (paramsObj && !Array.isArray(paramsObj)) this.setNoiseParams(paramsObj);

    const origOpts = options || {};

    const wantsCustomPos = ((origOpts.useCustomPos ?? 0) | 0) !== 0;
    const customData =
      wantsCustomPos && origOpts.customData instanceof Float32Array
        ? origOpts.customData
        : null;

    const useCustomPos = customData ? 1 : 0;

    this.setOptions({
      ...origOpts,
      ioFlags: 0,
      useCustomPos,
    });

    const tileOpts = {
      ...origOpts,
      useCustomPos,
      customData,
    };

    if (!pair.tiles || pair.bindGroupDirty || !!customData) {
      this._create2DTileBindGroups(key, tileOpts);
    }

    this._update2DTileFrames(key, tileOpts);

    const isAStart = pair.isA;
    let finalUsed = null;
    let lastBGs = null;

    for (const tile of pair.tiles) {
      const { bgA, bgB } = tile.bgs[0];

      const start = !finalUsed
        ? isAStart
          ? bgA
          : bgB
        : finalUsed === bgA
          ? bgA
          : bgB;

      const alt = start === bgA ? bgB : bgA;

      finalUsed = await this._runPipelines(
        start,
        alt,
        pair.tileWidth,
        pair.tileHeight,
        1,
        paramsObj,
        1,
      );

      lastBGs = { bgA, bgB };
    }

    const resultsInA = finalUsed === lastBGs.bgB;
    pair.isA = resultsInA;

    this.setActiveTexture(key);
    return this.getCurrentView(key);
  }

  _get2DKey(options) {
    const k =
      options && options.textureKey !== undefined && options.textureKey !== null
        ? String(options.textureKey)
        : "";
    return k && k.length ? k : this._default2DKey;
  }

  get2DView(key) {
    const id = String(key);
    const p = this._texPairs.get(id);
    if (!p) return null;
    return p.isA ? p.viewA : p.viewB;
  }

  getCurrentView(tid = null) {
    const id = tid !== null && tid !== undefined ? String(tid) : this._tid;
    const p = this._texPairs.get(id);
    if (!p) return null;
    return p.isA ? p.viewA : p.viewB;
  }

  // ---------------------------
  // 3D compute (chunking for large volumes)
  // ---------------------------
  _compute3DTiling(W, H, D) {
    const tw = Math.min(W, MAX_3D_TILE);
    const th = Math.min(H, MAX_3D_TILE);

    const maxBuf = this.device?.limits?.maxBufferSize ?? 256 * 1024 * 1024;
    const sliceBytes = tw * th * BYTES_PER_VOXEL;
    const tdByBuf = Math.max(
      1,
      Math.floor((maxBuf * 0.8) / Math.max(1, sliceBytes)),
    );

    const td = Math.min(D, MAX_3D_TILE, tdByBuf);

    const nx = Math.ceil(W / tw);
    const ny = Math.ceil(H / th);
    const nz = Math.ceil(D / td);

    return { tw, th, td, nx, ny, nz };
  }

  _create3DChunks(W, H, D) {
    const t = this._compute3DTiling(W, H, D);
    const chunks = [];

    const usage3D =
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST;

    for (let kz = 0; kz < t.nz; kz++) {
      for (let ky = 0; ky < t.ny; ky++) {
        for (let kx = 0; kx < t.nx; kx++) {
          const ox = kx * t.tw;
          const oy = ky * t.th;
          const oz = kz * t.td;

          const texA = this.device.createTexture({
            size: { width: t.tw, height: t.th, depthOrArrayLayers: t.td },
            dimension: "3d",
            format: "rgba16float",
            usage: usage3D,
          });
          const texB = this.device.createTexture({
            size: { width: t.tw, height: t.th, depthOrArrayLayers: t.td },
            dimension: "3d",
            format: "rgba16float",
            usage: usage3D,
          });

          const viewA = texA.createView({ dimension: "3d" });
          const viewB = texB.createView({ dimension: "3d" });

          texA.label = `3D texA ${t.tw}x${t.th}x${t.td} @ (${kx},${ky},${kz})`;
          texB.label = `3D texB ${t.tw}x${t.th}x${t.td} @ (${kx},${ky},${kz})`;
          viewA.label = `3D:viewA[${kx},${ky},${kz}]`;
          viewB.label = `3D:viewB[${kx},${ky},${kz}]`;
          this._tag.set(viewA, `3D:A[${kx},${ky},${kz}]`);
          this._tag.set(viewB, `3D:B[${kx},${ky},${kz}]`);

          chunks.push({
            texA,
            texB,
            viewA,
            viewB,
            ox,
            oy,
            oz,
            w: t.tw,
            h: t.th,
            d: t.td,
            isA: true,
            fb: null,
            posBuf: null,
            bgA: null,
            bgB: null,
          });
        }
      }
    }

    return {
      chunks,
      tile: { w: t.tw, h: t.th, d: t.td },
      full: { w: W, h: H, d: D },
      grid: { nx: t.nx, ny: t.ny, nz: t.nz },
    };
  }

  _destroy3DSet(vol) {
    if (!vol) return;
    for (const c of vol.chunks) {
      try {
        c.texA.destroy();
      } catch {}
      try {
        c.texB.destroy();
      } catch {}
      c.viewA = null;
      c.viewB = null;
      c.bgA = null;
      c.bgB = null;
      if (c.fb) {
        try {
          c.fb.destroy();
        } catch {}
        c.fb = null;
      }
      if (c.posBuf && c.posBuf !== this.nullPosBuffer) {
        try {
          c.posBuf.destroy();
        } catch {}
        c.posBuf = null;
      }
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
    const views = vol.chunks.map((c) => (c.isA ? c.viewA : c.viewB));
    return views.length === 1
      ? views[0]
      : { views, meta: { full: vol.full, tile: vol.tile, grid: vol.grid } };
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
      c.fb = this.device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // allow worldFull override for consistent pixel->world mapping
      const fw =
        worldFull && Number.isFinite(worldFull?.w)
          ? worldFull.w >>> 0
          : vol.full.w;
      const fh =
        worldFull && Number.isFinite(worldFull?.h)
          ? worldFull.h >>> 0
          : vol.full.h;
      const fd =
        worldFull && Number.isFinite(worldFull?.d)
          ? worldFull.d >>> 0
          : vol.full.d;

      // fractional XY origins for chunked volumes (continuous across chunks)
      const scaleX = fw / vol.full.w;
      const scaleY = fh / vol.full.h;
      const originXf = c.ox * scaleX;
      const originYf = c.oy * scaleY;

      this._writeFrameUniform(c.fb, {
        fullWidth: fw,
        fullHeight: fh,
        tileWidth: c.w,
        tileHeight: c.h,
        originX: c.ox,
        originY: c.oy,
        originZ: c.oz,
        fullDepth: fd,
        tileDepth: c.d,
        layerIndex: 0,
        layers: 1,
        originXf,
        originYf,
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
          ],
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
          ],
        });
      } catch (e) {
        throw new Error(
          `_getOrCreate3DVolume: createBindGroup failed: ${e?.message || e}`,
        );
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
    const fw =
      worldFull && Number.isFinite(worldFull.w)
        ? worldFull.w >>> 0
        : vol.full.w;
    const fh =
      worldFull && Number.isFinite(worldFull.h)
        ? worldFull.h >>> 0
        : vol.full.h;
    const fd =
      worldFull && Number.isFinite(worldFull.d)
        ? worldFull.d >>> 0
        : vol.full.d;

    for (const c of vol.chunks) {
      // ensure per-chunk uniform buffer exists
      if (!c.fb) {
        c.fb = this.device.createBuffer({
          size: 64,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const scaleX = fw / vol.full.w;
        const scaleY = fh / vol.full.h;
        const originXf = c.ox * scaleX;
        const originYf = c.oy * scaleY;
        this._writeFrameUniform(c.fb, {
          fullWidth: fw,
          fullHeight: fh,
          tileWidth: c.w,
          tileHeight: c.h,
          originX: c.ox,
          originY: c.oy,
          originZ: c.oz,
          fullDepth: fd,
          tileDepth: c.d,
          layerIndex: 0,
          layers: 1,
          originXf,
          originYf,
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
        { binding: 8, resource: c.viewB },
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
        { binding: 8, resource: c.viewA },
      ];

      // Assign new bind groups
      try {
        c.bgA = this.device.createBindGroup({
          layout: this.bindGroupLayout,
          entries: entriesA,
        });
        c.bgB = this.device.createBindGroup({
          layout: this.bindGroupLayout,
          entries: entriesB,
        });
      } catch (e) {
        throw new Error(
          `_recreate3DBindGroups: failed to create bind groups: ${
            e?.message || e
          }`,
        );
      }
    }

    vol._bindGroupsDirty = false;
  }

  // replace your computeToTexture3D with this implementation
  async computeToTexture3D(width, height, depth, paramsObj = {}, options = {}) {
    const W = width | 0,
      H = height | 0,
      D = depth | 0;
    if (!(W > 0 && H > 0 && D > 0))
      throw new Error(
        `computeToTexture3D: invalid size ${width}x${height}x${depth}`,
      );

    if (paramsObj && !Array.isArray(paramsObj)) this.setNoiseParams(paramsObj);

    const origOpts = options || {};
    this.setOptions({
      ...origOpts,
      ioFlags: 3,
      useCustomPos: origOpts.useCustomPos ?? this.useCustomPos,
    });

    const worldFull = (() => {
      if (
        options &&
        (Number.isFinite(options.frameFullWidth) ||
          Number.isFinite(options.frameFullHeight) ||
          Number.isFinite(options.frameFullDepth))
      ) {
        return {
          w: Number.isFinite(options.frameFullWidth)
            ? options.frameFullWidth >>> 0
            : W,
          h: Number.isFinite(options.frameFullHeight)
            ? options.frameFullHeight >>> 0
            : H,
          d: Number.isFinite(options.frameFullDepth)
            ? options.frameFullDepth >>> 0
            : D,
        };
      }
      return null;
    })();

    const vol = this._getOrCreate3DVolume(W, H, D, options.id, worldFull);

    if (!vol)
      throw new Error(
        "computeToTexture3D: failed to create or retrieve volume",
      );

    if (vol._bindGroupsDirty || !vol.chunks[0].bgA || !vol.chunks[0].bgB) {
      this._recreate3DBindGroups(vol, worldFull);
    }

    this._update3DChunkFrames(vol, worldFull, options);

    let lastBG = null;
    for (const c of vol.chunks) {
      const start = c.isA ? c.bgA : c.bgB;
      const alt = c.isA ? c.bgB : c.bgA;

      if (!start || !alt) {
        throw new Error(
          "computeToTexture3D: missing bind groups (volume not initialized correctly)",
        );
      }

      lastBG = await this._runPipelines(
        start,
        alt,
        c.w,
        c.h,
        c.d,
        paramsObj,
        c.d,
      );
      c.isA = lastBG === c.bgB;
    }

    const views = vol.chunks.map((c) => (c.isA ? c.viewA : c.viewB));
    return views.length === 1
      ? views[0]
      : { views, meta: { full: vol.full, tile: vol.tile, grid: vol.grid } };
  }

  configureCanvas(canvas) {
    const format =
      (navigator.gpu.getPreferredCanvasFormat &&
        navigator.gpu.getPreferredCanvasFormat()) ||
      "bgra8unorm";
    const ctx = canvas.getContext("webgpu");
    ctx.configure({
      device: this.device,
      format,
      alphaMode: "opaque",
      size: [canvas.width, canvas.height],
    });
    this._ctxMap.set(canvas, { ctx, size: [canvas.width, canvas.height] });
  }

  // ------- blit (2D-array preview + 3D-slice preview) -------
  initBlitRender() {
    if (!this.sampler) {
      this.sampler = this.device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });
    }

    // -------- 2D ARRAY --------
    if (!this.bgl2D) {
      this.bgl2D = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float", viewDimension: "2d-array" },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" },
          },
        ],
      });

      this.pipeline2D = this.device.createRenderPipeline({
        layout: this.device.createPipelineLayout({
          bindGroupLayouts: [this.bgl2D],
        }),
        vertex: {
          module: this.device.createShaderModule({ code: blit2DWGSL }),
          entryPoint: "vs_main",
        },
        fragment: {
          module: this.device.createShaderModule({ code: blit2DWGSL }),
          entryPoint: "fs_main",
          targets: [{ format: "bgra8unorm" }],
        },
        primitive: { topology: "triangle-list" },
      });

      this.blit2DUbo = this.device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }

    // -------- 3D --------
    if (!this.bgl3D) {
      this.bgl3D = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float", viewDimension: "3d" },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" },
          },
        ],
      });

      this.pipeline3D = this.device.createRenderPipeline({
        layout: this.device.createPipelineLayout({
          bindGroupLayouts: [this.bgl3D],
        }),
        vertex: {
          module: this.device.createShaderModule({ code: blit3DWGSL }),
          entryPoint: "vs_main",
        },
        fragment: {
          module: this.device.createShaderModule({ code: blit3DWGSL }),
          entryPoint: "fs_main",
          targets: [{ format: "bgra8unorm" }],
        },
        primitive: { topology: "triangle-list" },
      });

      this.blit3DUbo = this.device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }
  }

  _renderCommonCanvasSetup(canvas, clear) {
    const format = "bgra8unorm";
    let entry = this._ctxMap.get(canvas);
    if (!entry) {
      const ctx = canvas.getContext("webgpu");
      const size = [canvas.width | 0, canvas.height | 0];
      ctx.configure({ device: this.device, format, alphaMode: "opaque", size });
      entry = { ctx, size };
      this._ctxMap.set(canvas, entry);
    } else {
      const curW = canvas.width | 0,
        curH = canvas.height | 0;
      if (entry.size[0] !== curW || entry.size[1] !== curH) {
        entry.size = [curW, curH];
        entry.ctx.configure({
          device: this.device,
          format,
          alphaMode: "opaque",
          size: entry.size,
        });
      }
    }

    const enc = this.device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [
        {
          view: entry.ctx.getCurrentTexture().createView(),
          loadOp: clear ? "clear" : "load",
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          storeOp: "store",
        },
      ],
    });

    return { enc, pass, ctxEntry: entry };
  }

  // 2D-array: pick layer and channel
  renderTextureToCanvas(textureView, canvas, opts = {}) {
    const {
      layer = 0,
      channel = 0,
      preserveCanvasSize = true,
      clear = true,
    } = opts;

    this.initBlitRender();

    if (!preserveCanvasSize) {
      try {
        const tex = textureView.texture;
        if (
          tex &&
          typeof tex.width === "number" &&
          typeof tex.height === "number"
        ) {
          canvas.width = tex.width;
          canvas.height = tex.height;
        }
      } catch {}
    }

    // write UBO (u32 layer, u32 channel, padding)
    const u = new Uint32Array([layer >>> 0, channel >>> 0, 0, 0]);
    this.queue.writeBuffer(
      this.blit2DUbo,
      0,
      u.buffer,
      u.byteOffset,
      u.byteLength,
    );

    const bg = this.device.createBindGroup({
      layout: this.bgl2D,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: textureView },
        { binding: 2, resource: { buffer: this.blit2DUbo } },
      ],
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
      clear = true,
    } = opts;

    this.initBlitRender();

    let view3D, d;
    if (target && target.views && Array.isArray(target.views)) {
      view3D =
        target.views[Math.max(0, Math.min(chunk | 0, target.views.length - 1))];
      d = target.meta?.tile?.d ?? depth;
    } else {
      view3D = target;
      d = depth;
    }
    if (!view3D || !d)
      throw new Error(
        "renderTexture3DSliceToCanvas: need a 3D view and its depth",
      );

    if (!preserveCanvasSize) {
      try {
        const tex = view3D.texture;
        if (
          tex &&
          typeof tex.width === "number" &&
          typeof tex.height === "number"
        ) {
          canvas.width = tex.width;
          canvas.height = tex.height;
        }
      } catch {}
    }

    let z =
      zNorm !== null && zNorm !== undefined
        ? zNorm
        : (Math.min(Math.max(slice, 0), d - 1) + 0.5) / d;
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
        { binding: 2, resource: { buffer: this.blit3DUbo } },
      ],
    });

    const { enc, pass } = this._renderCommonCanvasSetup(canvas, clear);
    pass.setPipeline(this.pipeline3D);
    pass.setBindGroup(0, bg);
    pass.draw(6, 1, 0, 0);
    pass.end();
    this.queue.submit([enc.finish()]);
  }

  setExportBackground(background = "black") {
    this.exportBackground = background;
  }

  _resolveExportBackground(background) {
    const bg = background === undefined ? this.exportBackground : background;

    if (bg == null) return { r: 0, g: 0, b: 0, a: 1, transparent: false };
    if (typeof bg === "string") {
      const s = bg.trim().toLowerCase();
      if (s === "transparent")
        return { r: 0, g: 0, b: 0, a: 0, transparent: true };
      if (s === "black") return { r: 0, g: 0, b: 0, a: 1, transparent: false };
      if (s === "white") return { r: 1, g: 1, b: 1, a: 1, transparent: false };
      if (s[0] === "#") return this._parseHexBackground(s);
    }

    const norm01 = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return 0;
      const x = n > 1 ? n / 255 : n;
      return Math.min(Math.max(x, 0), 1);
    };

    if (Array.isArray(bg)) {
      const r = norm01(bg[0]);
      const g = norm01(bg[1]);
      const b = norm01(bg[2]);
      const a = bg.length >= 4 ? norm01(bg[3]) : 1;
      return { r, g, b, a, transparent: a <= 0 };
    }

    if (typeof bg === "object") {
      const r = norm01(bg.r);
      const g = norm01(bg.g);
      const b = norm01(bg.b);
      const a = bg.a === undefined ? 1 : norm01(bg.a);
      return { r, g, b, a, transparent: a <= 0 };
    }

    return { r: 0, g: 0, b: 0, a: 1, transparent: false };
  }

  _parseHexBackground(hex) {
    const h = String(hex).trim().replace(/^#/, "");
    const expand = (c) => c + c;

    let r = 0,
      g = 0,
      b = 0,
      a = 255;

    if (h.length === 3 || h.length === 4) {
      r = parseInt(expand(h[0]), 16);
      g = parseInt(expand(h[1]), 16);
      b = parseInt(expand(h[2]), 16);
      if (h.length === 4) a = parseInt(expand(h[3]), 16);
    } else if (h.length === 6 || h.length === 8) {
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
      if (h.length === 8) a = parseInt(h.slice(6, 8), 16);
    } else {
      return { r: 0, g: 0, b: 0, a: 1, transparent: false };
    }

    const rf = r / 255;
    const gf = g / 255;
    const bf = b / 255;
    const af = a / 255;

    return { r: rf, g: gf, b: bf, a: af, transparent: af <= 0 };
  }

  _applyExportBackground(pixelsRGBA, bg) {
    if (!pixelsRGBA || !bg || bg.transparent) return;

    const br = Math.round(bg.r * 255);
    const bgc = Math.round(bg.g * 255);
    const bb = Math.round(bg.b * 255);
    const ba = Math.round((bg.a ?? 1) * 255);

    if (ba <= 0) return;

    const n = pixelsRGBA.length | 0;

    if (ba >= 255) {
      for (let i = 0; i < n; i += 4) {
        const a = pixelsRGBA[i + 3] | 0;
        if (a === 255) continue;
        if (a === 0) {
          pixelsRGBA[i + 0] = br;
          pixelsRGBA[i + 1] = bgc;
          pixelsRGBA[i + 2] = bb;
          pixelsRGBA[i + 3] = 255;
          continue;
        }
        const ia = 255 - a;
        pixelsRGBA[i + 0] = ((pixelsRGBA[i + 0] * a + br * ia) / 255) | 0;
        pixelsRGBA[i + 1] = ((pixelsRGBA[i + 1] * a + bgc * ia) / 255) | 0;
        pixelsRGBA[i + 2] = ((pixelsRGBA[i + 2] * a + bb * ia) / 255) | 0;
        pixelsRGBA[i + 3] = 255;
      }
      return;
    }

    for (let i = 0; i < n; i += 4) {
      const fr = pixelsRGBA[i + 0] | 0;
      const fg = pixelsRGBA[i + 1] | 0;
      const fb = pixelsRGBA[i + 2] | 0;
      const fa = pixelsRGBA[i + 3] | 0;

      const outA = (fa + (ba * (255 - fa)) / 255) | 0;

      if (outA <= 0) {
        pixelsRGBA[i + 0] = 0;
        pixelsRGBA[i + 1] = 0;
        pixelsRGBA[i + 2] = 0;
        pixelsRGBA[i + 3] = 0;
        continue;
      }

      const brp = (br * ba) | 0;
      const bgp = (bgc * ba) | 0;
      const bbp = (bb * ba) | 0;

      const frp = (fr * fa) | 0;
      const fgp = (fg * fa) | 0;
      const fbp = (fb * fa) | 0;

      const bgScale = (255 - fa) | 0;

      const outRp = (frp + (brp * bgScale) / 255) | 0;
      const outGp = (fgp + (bgp * bgScale) / 255) | 0;
      const outBp = (fbp + (bbp * bgScale) / 255) | 0;

      pixelsRGBA[i + 0] = Math.min(
        255,
        Math.max(0, ((outRp * 255) / outA) | 0),
      );
      pixelsRGBA[i + 1] = Math.min(
        255,
        Math.max(0, ((outGp * 255) / outA) | 0),
      );
      pixelsRGBA[i + 2] = Math.min(
        255,
        Math.max(0, ((outBp * 255) / outA) | 0),
      );
      pixelsRGBA[i + 3] = Math.min(255, Math.max(0, outA));
    }
  }

  _forceOpaqueAlpha(pixelsRGBA) {
    const n = pixelsRGBA.length | 0;
    for (let i = 3; i < n; i += 4) pixelsRGBA[i] = 255;
  }

  async export2DTextureToPNGBlob(textureView, width, height, opts = {}) {
    if (!textureView) {
      throw new Error("export2DTextureToPNGBlob: textureView is required");
    }

    const W = Math.max(1, width | 0);
    const H = Math.max(1, height | 0);
    const layer = opts.layer ?? 0;
    const channel = opts.channel ?? 0;

    const bgSpec = this._resolveExportBackground(opts.background);

    this.initBlitRender();

    if (this.queue && this.queue.onSubmittedWorkDone) {
      try {
        await this.queue.onSubmittedWorkDone();
      } catch (e) {}
    }

    const format = "bgra8unorm";

    const captureTexture = this.device.createTexture({
      size: [W, H, 1],
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    const u = new Uint32Array([layer >>> 0, channel >>> 0, 0, 0]);
    this.queue.writeBuffer(
      this.blit2DUbo,
      0,
      u.buffer,
      u.byteOffset,
      u.byteLength,
    );

    const bg = this.device.createBindGroup({
      layout: this.bgl2D,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: textureView },
        { binding: 2, resource: { buffer: this.blit2DUbo } },
      ],
    });

    const encoder = this.device.createCommandEncoder();

    const rpass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: captureTexture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });

    rpass.setPipeline(this.pipeline2D);
    rpass.setBindGroup(0, bg);
    rpass.draw(6, 1, 0, 0);
    rpass.end();

    this.queue.submit([encoder.finish()]);

    if (this.queue && this.queue.onSubmittedWorkDone) {
      try {
        await this.queue.onSubmittedWorkDone();
      } catch (e) {}
    }

    const pixels = await this._readBGRA8TextureToRGBA8Pixels(
      captureTexture,
      W,
      H,
      {
        maxBufferChunkBytes:
          opts.maxBufferChunkBytes ?? this.maxBufferChunkBytes,
      },
    );

    captureTexture.destroy();

    const useAlphaForBackground = opts.useAlphaForBackground === true;

    if (bgSpec.transparent || useAlphaForBackground) {
      this._applyExportBackground(pixels, bgSpec);
    } else {
      this._forceOpaqueAlpha(pixels);
    }

    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = W;
    tmpCanvas.height = H;
    const ctx2d = tmpCanvas.getContext("2d");
    if (!ctx2d) {
      throw new Error("export2DTextureToPNGBlob: unable to get 2D context");
    }

    ctx2d.putImageData(new ImageData(pixels, W, H), 0, 0);

    const blob = await new Promise((resolve, reject) => {
      tmpCanvas.toBlob((b) => {
        if (b) resolve(b);
        else
          reject(new Error("export2DTextureToPNGBlob: toBlob returned null"));
      }, "image/png");
    });

    return blob;
  }

  async exportCurrent2DToPNGBlob(width, height, opts = {}) {
    const view = this.getCurrentView();
    if (!view) {
      throw new Error("exportCurrent2DToPNGBlob: no active 2D texture view");
    }
    return this.export2DTextureToPNGBlob(view, width, height, opts);
  }

  async export3DSliceToPNGBlob(target, width, height, opts = {}) {
    if (!target) {
      throw new Error("export3DSliceToPNGBlob: target is required");
    }

    const W = Math.max(1, width | 0);
    const H = Math.max(1, height | 0);

    const { depth, slice = 0, zNorm = null, channel = 0, chunk = 0 } = opts;

    if (!depth || depth <= 0) {
      throw new Error("export3DSliceToPNGBlob: depth must be provided and > 0");
    }

    const bgSpec = this._resolveExportBackground(opts.background);

    this.initBlitRender();

    if (this.queue && this.queue.onSubmittedWorkDone) {
      try {
        await this.queue.onSubmittedWorkDone();
      } catch (e) {}
    }

    let view3D;
    let d;
    if (target && target.views && Array.isArray(target.views)) {
      const idx = Math.max(0, Math.min(chunk | 0, target.views.length - 1));
      view3D = target.views[idx];
      d = target.meta?.tile?.d ?? depth;
    } else {
      view3D = target;
      d = depth;
    }
    if (!view3D || !d) {
      throw new Error("export3DSliceToPNGBlob: need a 3D view and its depth");
    }

    let z =
      zNorm !== null && zNorm !== undefined
        ? zNorm
        : (Math.min(Math.max(slice, 0), d - 1) + 0.5) / d;
    z = Math.min(Math.max(z, 0.0), 1.0);

    const format = "bgra8unorm";

    const captureTexture = this.device.createTexture({
      size: [W, H, 1],
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

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
        { binding: 2, resource: { buffer: this.blit3DUbo } },
      ],
    });

    const encoder = this.device.createCommandEncoder();

    const rpass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: captureTexture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });

    rpass.setPipeline(this.pipeline3D);
    rpass.setBindGroup(0, bg);
    rpass.draw(6, 1, 0, 0);
    rpass.end();

    const bytesPerPixel = 4;
    const align = 256;
    const bytesPerRowUnaligned = W * bytesPerPixel;
    const bytesPerRow = Math.ceil(bytesPerRowUnaligned / align) * align;
    const bufferSize = bytesPerRow * H;

    const readBuffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    encoder.copyTextureToBuffer(
      { texture: captureTexture },
      { buffer: readBuffer, bytesPerRow, rowsPerImage: H },
      { width: W, height: H, depthOrArrayLayers: 1 },
    );

    this.queue.submit([encoder.finish()]);

    if (this.queue && this.queue.onSubmittedWorkDone) {
      await this.queue.onSubmittedWorkDone();
    }

    await readBuffer.mapAsync(GPUMapMode.READ);
    const mapped = readBuffer.getMappedRange();
    const src = new Uint8Array(mapped);
    const pixels = new Uint8ClampedArray(W * H * bytesPerPixel);

    let dst = 0;
    for (let y = 0; y < H; y++) {
      const rowStart = y * bytesPerRow;
      for (let x = 0; x < W; x++) {
        const si = rowStart + x * 4;
        pixels[dst++] = src[si + 2];
        pixels[dst++] = src[si + 1];
        pixels[dst++] = src[si + 0];
        pixels[dst++] = src[si + 3];
      }
    }

    readBuffer.unmap();
    readBuffer.destroy();
    captureTexture.destroy();

    this._applyExportBackground(pixels, bgSpec);

    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = W;
    tmpCanvas.height = H;
    const ctx2d = tmpCanvas.getContext("2d");
    if (!ctx2d) {
      throw new Error("export3DSliceToPNGBlob: unable to get 2D context");
    }

    ctx2d.putImageData(new ImageData(pixels, W, H), 0, 0);

    const blob = await new Promise((resolve, reject) => {
      tmpCanvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("export3DSliceToPNGBlob: toBlob returned null"));
      }, "image/png");
    });

    return blob;
  }

  async _render3DSliceToRGBA8Pixels(
    view3D,
    width,
    height,
    zNorm,
    channel = 0,
    bgSpec = null,
  ) {
    if (!view3D)
      throw new Error("_render3DSliceToRGBA8Pixels: view3D is required");

    const W = Math.max(1, width | 0);
    const H = Math.max(1, height | 0);

    this.initBlitRender();

    const z = Math.min(Math.max(Number(zNorm) || 0, 0.0), 1.0);

    const format = "bgra8unorm";

    const captureTexture = this.device.createTexture({
      size: [W, H, 1],
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

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
        { binding: 2, resource: { buffer: this.blit3DUbo } },
      ],
    });

    const encoder = this.device.createCommandEncoder();

    const rpass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: captureTexture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });

    rpass.setPipeline(this.pipeline3D);
    rpass.setBindGroup(0, bg);
    rpass.draw(6, 1, 0, 0);
    rpass.end();

    const bytesPerPixel = 4;
    const align = 256;
    const bytesPerRowUnaligned = W * bytesPerPixel;
    const bytesPerRow = Math.ceil(bytesPerRowUnaligned / align) * align;
    const bufferSize = bytesPerRow * H;

    const readBuffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    encoder.copyTextureToBuffer(
      { texture: captureTexture },
      { buffer: readBuffer, bytesPerRow, rowsPerImage: H },
      { width: W, height: H, depthOrArrayLayers: 1 },
    );

    this.queue.submit([encoder.finish()]);

    if (this.queue && this.queue.onSubmittedWorkDone) {
      await this.queue.onSubmittedWorkDone();
    }

    await readBuffer.mapAsync(GPUMapMode.READ);
    const mapped = readBuffer.getMappedRange();
    const src = new Uint8Array(mapped);
    const pixels = new Uint8ClampedArray(W * H * bytesPerPixel);

    let dst = 0;
    for (let y = 0; y < H; y++) {
      const rowStart = y * bytesPerRow;
      for (let x = 0; x < W; x++) {
        const si = rowStart + x * 4;
        pixels[dst++] = src[si + 2];
        pixels[dst++] = src[si + 1];
        pixels[dst++] = src[si + 0];
        pixels[dst++] = src[si + 3];
      }
    }

    readBuffer.unmap();
    readBuffer.destroy();
    captureTexture.destroy();

    if (bgSpec) this._applyExportBackground(pixels, bgSpec);

    return pixels;
  }

  async export3DTilesetToPNGBlob(target, tileWidth, tileHeight, opts = {}) {
    if (!target)
      throw new Error("export3DTilesetToPNGBlob: target is required");

    const TW = Math.max(1, tileWidth | 0);
    const TH = Math.max(1, (tileHeight ?? tileWidth) | 0);

    const {
      depth,
      channel = 0,
      chunk = 0,
      tilesAcross = 16,
      tilesDown = null,
      startSlice = 0,
      sliceCount = null,
    } = opts;

    const bgSpec = this._resolveExportBackground(opts.background);

    this.initBlitRender();

    if (this.queue && this.queue.onSubmittedWorkDone) {
      try {
        await this.queue.onSubmittedWorkDone();
      } catch (e) {}
    }

    let view3D;
    let d;
    if (target && target.views && Array.isArray(target.views)) {
      const idx = Math.max(0, Math.min(chunk | 0, target.views.length - 1));
      view3D = target.views[idx];
      d = target.meta?.tile?.d ?? depth;
    } else {
      view3D = target;
      d = depth;
    }
    if (!view3D) throw new Error("export3DTilesetToPNGBlob: missing 3D view");
    if (!d || d <= 0)
      throw new Error(
        "export3DTilesetToPNGBlob: depth must be provided and > 0",
      );

    const across = Math.max(1, tilesAcross | 0);
    const down =
      tilesDown !== null && tilesDown !== undefined
        ? Math.max(1, tilesDown | 0)
        : Math.ceil(d / across);

    const start = Math.min(Math.max(startSlice | 0, 0), d - 1);
    const count =
      sliceCount !== null && sliceCount !== undefined
        ? Math.max(0, sliceCount | 0)
        : d - start;

    const outW = TW * across;
    const outH = TH * down;

    const outPixels = new Uint8ClampedArray(outW * outH * 4);

    const maxZ = Math.min(d, start + count);
    for (let z = start; z < maxZ; z++) {
      const rel = z - start;
      const col = rel % across;
      const row = (rel / across) | 0;
      if (row >= down) break;

      const zNorm = (z + 0.5) / d;
      const tilePixels = await this._render3DSliceToRGBA8Pixels(
        view3D,
        TW,
        TH,
        zNorm,
        channel,
        bgSpec,
      );

      const dstBaseX = col * TW;
      const dstBaseY = row * TH;

      for (let y = 0; y < TH; y++) {
        const srcRowStart = y * TW * 4;
        const dstRowStart = ((dstBaseY + y) * outW + dstBaseX) * 4;
        outPixels.set(
          tilePixels.subarray(srcRowStart, srcRowStart + TW * 4),
          dstRowStart,
        );
      }
    }

    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = outW;
    tmpCanvas.height = outH;
    const ctx2d = tmpCanvas.getContext("2d");
    if (!ctx2d)
      throw new Error("export3DTilesetToPNGBlob: unable to get 2D context");

    ctx2d.putImageData(new ImageData(outPixels, outW, outH), 0, 0);

    const blob = await new Promise((resolve, reject) => {
      tmpCanvas.toBlob((b) => {
        if (b) resolve(b);
        else
          reject(new Error("export3DTilesetToPNGBlob: toBlob returned null"));
      }, "image/png");
    });

    return blob;
  }
}

// -----------------------------------------------------------------------------
// BaseNoise
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
    if (typeof z === "number") {
      idx =
        this.perm[(x & 255) + this.perm[(y & 255) + this.perm[z & 255]]] & 255;
    } else {
      idx = this.perm[(x & 255) + this.perm[y & 255]] & 255;
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
      return (x < 0 ? 1 + ~x : x) / 0xffffffff;
    };
  }

  dot(g, x = 0, y = 0, z = 0) {
    return g[0] * x + g[1] * y + g[2] * z;
  }
}
