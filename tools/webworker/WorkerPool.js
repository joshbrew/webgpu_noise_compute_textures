// WorkerPool.js  (type: module)
// A tiny, Promise-based worker pool with zero dependencies.
//
// • Creates a fixed number of Web Workers (module type).
// • Queues jobs FIFO; each job returns a Promise that resolves with
//   whatever the worker posts back under `{ id, result }`.
// • Automatically filters the transfer-list so that
//   SharedArrayBuffer-backed data is **not** placed in it.
//
// Requires `smartBuffers.js` in the same folder (for `transferList()`):
//   export { transferList } from './smartBuffers.js';

import { transferList } from './smartBuffers.js';

export class WorkerPool {
  /**
   * @param {string | URL} workerUrl  Module worker script.
   * @param {number} [size]           #workers (defaults to hw threads or 4).
   */
  constructor(workerUrl, size = Math.max(1, navigator.hardwareConcurrency || 4)) {
    /** @type {{ w: Worker, busy: boolean }[]} */
    this.workers = [];
    /** @type {{ id:number, payload:any, transfer:ArrayBuffer[] }[]} */
    this.queue = [];
    /** @type {Map<number,{resolve:Function,reject:Function}>} */
    this.pending = new Map();
    this.nextId = 0;

    for (let i = 0; i < size; i++) {
      const w = new Worker(workerUrl, { type: 'module' });
      w.onmessage = (e) => this.#handleDone(w, e.data);
      w.onerror   = (err) => console.error('Worker error:', err);
      this.workers.push({ w, busy: false });
    }
  }

  /**
   * Enqueue work in the pool.
   * @param {any}            payload  Data posted to the worker.
   * @param {ArrayBuffer[]} [buffers] ArrayBuffers you *might* want transferred.
   *                                  SharedArrayBuffers will be auto-filtered out.
   * @returns {Promise<any>}          Resolves with worker's `result`.
   */
  exec(payload, buffers = []) {
    return new Promise((resolve, reject) => {
      const id   = this.nextId++;
      const xfer = transferList(buffers);      // strip SABs if present

      this.pending.set(id, { resolve, reject });
      this.queue.push({ id, payload, transfer: xfer });
      this.#pump();
    });
  }

  /** Kill workers and clear queues/promises. */
  async terminate() {
    for (const { w } of this.workers) w.terminate();
    this.queue.length = 0;
    this.pending.clear();
  }

  /* ───────── private helpers ───────── */

  #handleDone(worker, { id, result, error }) {
    const entry = this.pending.get(id);
    if (!entry) return;           // stray?
    error ? entry.reject(error) : entry.resolve(result);
    this.pending.delete(id);

    const slot = this.workers.find(s => s.w === worker);
    if (slot) slot.busy = false;
    this.#pump();
  }

  #pump() {
    while (this.queue.length) {
      const idle = this.workers.find(s => !s.busy);
      if (!idle) break;

      const job = this.queue.shift();
      idle.busy = true;
      idle.w.postMessage(
        { id: job.id, payload: job.payload },
        job.transfer                       // already SAB-safe
      );
    }
  }
}
