// buildPlaneGrid.js  (type: module)
// Async, worker-driven builder that:
//
// • Pre-allocates **SharedArrayBuffer-backed** vertex/index arrays
//   when SAB support is available (fastest: no copies, no transfers back).
// • Falls back to the old “worker allocates → main receives” path
//   when SAB is unavailable (ordinary ArrayBuffer transfers).
//
// smartBuffers.js gives us `hasSAB`, `allocTyped`, and `transferList`.

import { WorkerPool }        from './WorkerPool.js';
import { hasSAB, allocTyped, transferList } from './smartBuffers.js';

import gridwrkr from './quadBuilder.worker.js'

const pool = new WorkerPool(
    gridwrkr,
    4 // threads — tweak or derive from navigator.hardwareConcurrency
);

/**
 * Build a plane grid split into stripes capped by `maxVerts` (default 8 million, which approaches limits of webgpu buffers).
 *
 * @param {GPUDevice} device
 * @param {number}    divs
 * @param {number}    [maxVerts=8_000_000]
 * @returns {Promise<Array<{vbuf:GPUBuffer,ibuf:GPUBuffer,indexCount:number,y0:number,y1:number}>>}
 */
export async function buildPlaneGridChunks(device, divs, maxVerts = 8_000_000) {
  const vertsPerRow   = divs + 1;
  const rowsPerStripe = Math.max(1, Math.floor(maxVerts / vertsPerRow));

  const jobs = [];
  let y0 = 0;

  while (y0 < divs) {
    const quadRows    = Math.min(rowsPerStripe, divs - y0);
    const ownFirstRow = (y0 === 0);

    /* ── SAB path: pre-allocate, share the buffers ─────────────────────── */
    if (hasSAB) {
      const vertRows   = quadRows + (ownFirstRow ? 1 : 2);
      const localVerts = vertRows * vertsPerRow;
      const localIdx   = quadRows * divs * 6;

      const vArr = allocTyped(Float32Array, localVerts * 5);
      const iArr = allocTyped(Uint32Array,  localIdx);

      jobs.push(
        pool
          .exec(
            { divs, y0, quadRows, ownFirstRow,
              vBuf: vArr.buffer, iBuf: iArr.buffer },
            /* SABs are *not* transferable but we still pass the list
               so AB fallback code stays symmetric. */
            transferList([vArr.buffer, iArr.buffer])
          )
          .then(meta => ({ ...meta, vArr, iArr }))
      );
    }

    /* ── Fallback path: let worker allocate and send buffers back ──────── */
    else {
      jobs.push(
        pool
          .exec({ divs, y0, quadRows, ownFirstRow })
          .then(({ vArray, iArray, indexCount, y0, y1 }) => ({
            vArr: new Float32Array(vArray),
            iArr: new Uint32Array(iArray),
            indexCount, y0, y1
          }))
      );
    }

    y0 += quadRows;
  }

  /* wait for all stripes and upload to GPU ----------------------------------- */
  const chunks = await Promise.all(jobs);

  return chunks.map(({ vArr, iArr, indexCount, y0, y1 }) => {
    const vbuf = device.createBuffer({
      size  : vArr.byteLength,
      usage : GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    const ibuf = device.createBuffer({
      size  : iArr.byteLength,
      usage : GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(vbuf, 0, vArr);
    device.queue.writeBuffer(ibuf, 0, iArr);

    return { vbuf, ibuf, indexCount, y0, y1 };
  });
}

/* dispose when done */
export function disposePlaneGridPool() {
  return pool.terminate();
}
