/**************************************************************************
 *  TexToPointsChunkedGPU
 *  ----------------------------------------------------------------------
 *  • Converts a very large 2‑D/2‑D‑array texture into a vec4 point list,
 *    but **never allocates a point‑buffer larger than MAX_BYTES**.
 *  • Splits the destination (coarse‑grid) domain into horizontal “stripes”.
 *    Each stripe is processed in a separate compute‑dispatch that writes
 *    into its own {counter, points} SSBO pair.
 *  • Returns an **array** of chunk objects:
 *      [{ y0, yLen, counter, points }, …]
 *
 *  Extra uniforms added to the original shader:
 *      baseYCoarse  : u32   // first coarse‑row handled by this dispatch
 *      dstHCoarse   : u32   // full coarse‑grid height (normalisation)
 *  (fields are appended after thresh → the struct stays 32‑byte aligned)
 **************************************************************************/

import t2pWGSL        from './scalarField_TexToPoints.wgsl';

// const MAX_BYTES  = 8_000_000;          // hard buffer budget (≈ 8 MiB)
// const POINT_SIZE = 16;                 // vec4<f32>
// const PAD        = 256;                // 256‑byte alignment for STORAGE

function padTo(n, a) { return (n + a - 1) & ~(a - 1); }

export class TexToPointsChunkedGPU {
  /** @param {GPUDevice} device */
  constructor(device) {
    this.device = device;

    /* pipeline + bind‑group layout */
    this._pipe   = device.createComputePipeline({
      layout : 'auto',
      compute: { module: device.createShaderModule({ code: t2pWGSL }),
                 entryPoint: 'cs' }
    });
    this._layout = this._pipe.getBindGroupLayout(0);

    /* 48‑byte uniform block (DownInfo + 2 extras) */
    this._uniRaw = new ArrayBuffer(48);
    this._u32    = new Uint32Array(this._uniRaw);
    this._f32    = new Float32Array(this._uniRaw);
    this._uniBuf = device.createBuffer({
      size : 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }

  /* ------------------------------------------------------------------ */
  /**
   * @param {GPUTextureView} view – full‑resolution texture view
   * @param {{
   *   srcW:number, srcH:number, layers:number,
   *   step:number, channelMode:number, heightScale:number, thresh:number
   * }} cfg
   * @returns {Array<{y0:number,yLen:number,counter:GPUBuffer,points:GPUBuffer}>}
   */
  generate(view, cfg, MAX_BYTES  = 8_000_000, POINT_SIZE = 16, PAD        = 256) {
    const { srcW, srcH, layers, step } = cfg;

    /* coarse‑grid size */
    const dstW = Math.floor(srcW / step);
    const dstH = Math.floor(srcH / step);

    /* how many coarse rows fit into MAX_BYTES? */
    const maxPtsPerBuf  = Math.floor(MAX_BYTES / POINT_SIZE);
    const ptsPerRow     = dstW * layers;
    const maxRowsPerBuf = Math.max(1, Math.floor(maxPtsPerBuf / ptsPerRow));

    const chunks = [];
    for (let y0 = 0; y0 < dstH; y0 += maxRowsPerBuf) {
      const yLen = Math.min(maxRowsPerBuf, dstH - y0);
      const pointsNeeded = yLen * ptsPerRow;
      const byteSize     = padTo(pointsNeeded * POINT_SIZE, PAD);

      /* allocate fresh buffers per stripe */
      const counterBuf = this.device.createBuffer({
        size : 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC |
               GPUBufferUsage.COPY_DST
      });
      const pointsBuf  = this.device.createBuffer({
        size : byteSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX
      });

      /* zero the counter */
      this.device.queue.writeBuffer(counterBuf, 0, new Uint32Array([0]));

      /* write uniforms ------------------------------------------------ */
      // DownInfo (first 7 * 4 bytes)
      this._u32[0] = srcW;
      this._u32[1] = srcH;
      this._u32[2] = step;
      this._u32[3] = layers;
      this._u32[4] = cfg.channelMode;
      this._f32[5] = cfg.heightScale;
      this._f32[6] = cfg.thresh;
      // extras
      this._u32[7] = y0;    /* baseYCoarse   */
      this._u32[8] = dstH;  /* dstHCoarse    */
      this.device.queue.writeBuffer(this._uniBuf, 0, this._uniRaw);

      /* bind group */
      const bg = this.device.createBindGroup({
        layout : this._layout,
        entries: [
          { binding: 0, resource: { buffer: this._uniBuf } },
          { binding: 1, resource: view                   },
          { binding: 2, resource: { buffer: counterBuf  } },
          { binding: 3, resource: { buffer: pointsBuf   } },
        ]
      });

      /* dispatch: work‑items only for this stripe */
      const enc  = this.device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(this._pipe);
      pass.setBindGroup(0, bg);
      pass.dispatchWorkgroups(
        Math.ceil(dstW / 8),
        Math.ceil(yLen / 8),
        layers
      );
      pass.end();
      this.device.queue.submit([enc.finish()]);

      chunks.push({ y0, yLen, counter: counterBuf, points: pointsBuf });
    }
    return chunks;
  }

  destroy() { this._uniBuf.destroy(); }
}
