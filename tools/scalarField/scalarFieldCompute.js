import sfWGSL from './scalarField.wgsl';

/* tiny helper */
function gpuBufferFromArray(device, arr, usage = GPUBufferUsage.STORAGE) {
    const buf = device.createBuffer({
        size: arr.byteLength,
        usage: usage | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    });
    new arr.constructor(buf.getMappedRange()).set(arr);
    buf.unmap();
    return buf;
}

export class ScalarFieldGPU {
    constructor(device) {
        this.device = device;

        this._pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({ code: sfWGSL }),
                entryPoint: 'cs'
            }
        });
        this._bgLayout = this._pipeline.getBindGroupLayout(0);

        /* 64‑byte uniform buffer */
        this._uniRaw = new ArrayBuffer(64);
        this._uniF32 = new Float32Array(this._uniRaw);
        this._uniU32 = new Uint32Array(this._uniRaw);
        this._uniBuf = device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this._pointsBuf = null;
        this._pointsCount = 0;
        this._ownsPointBuf = false;      /* free only if we created it */
    }

    /**
     * Generate a metaball scalar field for one brick.
     *
     * @param {number}        gx,gy,gz
     * @param {Float32Array|GPUBuffer} points   – either a flat [x,y,z,w …] array
     *                                           OR an already‑uploaded buffer
     * @param {number}        k, r2
     * @param {GPUBuffer}     fieldBuf
     * @param {number}        fieldOff
     * @param {{x,y,z}}       origin   (default {0,0,0})
     * @param {{x,y,z}}       scale    (default {1,1,1})
     * @param {number=}       pointCount   – **required** when `points`
     *                                       is a GPUBuffer
     */
    generate(
        gx, gy, gz,
        points, k, r2,
        fieldBuf, fieldOff = 0,
        origin = { x: 0, y: 0, z: 0 },
        scale = { x: 1, y: 1, z: 1 },
        pointCount = undefined
    ) {

        /* ── resolve / upload point buffer ───────────────────────── */
        let nPts;

        if (points instanceof GPUBuffer) {
            if (pointCount === undefined)
                throw new Error('pointCount must be supplied when points is a GPUBuffer');
            nPts = pointCount;
            /* reuse the external buffer as‑is */
            if (points !== this._pointsBuf) {
                /* drop old owned buffer if any */
                if (this._ownsPointBuf) this._pointsBuf?.destroy();
                this._pointsBuf = points;
                this._pointsCount = nPts;
                this._ownsPointBuf = false;
            }
        } else if (points instanceof Float32Array) {
            nPts = points.length >> 2; /* 4 floats / centre */
            if (!this._pointsBuf || this._pointsCount !== nPts || !this._ownsPointBuf) {
                /* allocate new internal buffer */
                if (this._ownsPointBuf) this._pointsBuf?.destroy();
                this._pointsBuf = gpuBufferFromArray(this.device, points);
                this._pointsCount = nPts;
                this._ownsPointBuf = true;
            } else {
                /* same size → just update */
                this.device.queue.writeBuffer(this._pointsBuf, 0, points);
            }
        } else {
            throw new Error('points must be Float32Array or GPUBuffer');
        }

        /* ── uniforms (exact order matches MetaBallUniforms) ───────────── */
        this._uniF32[0] = k;                 // k
        this._uniF32[1] = 1 / (gx - 1);      // invX
        this._uniF32[2] = 1 / (gy - 1);      // invY
        this._uniF32[3] = 1 / (gz - 1);      // invZ
        this._uniF32[4] = r2;                // r2

        /* uints start right after the first 5 floats */
        this._uniU32[5] = nPts;              // nPts
        this._uniU32[6] = gx;                // gx
        this._uniU32[7] = gy;                // gy
        this._uniU32[8] = gz;                // gz
        this._uniU32[9] = fieldOff;          // fieldOff

        /* last six floats: brick origin then scale */
        this._uniF32[10] = origin.x;         // ox
        this._uniF32[11] = origin.y;         // oy
        this._uniF32[12] = origin.z;         // oz
        this._uniF32[13] = scale.x;          // sx
        this._uniF32[14] = scale.y;          // sy
        this._uniF32[15] = scale.z;          // sz

        /* push to GPU */
        this.device.queue.writeBuffer(this._uniBuf, 0, this._uniRaw);

        /* ── bind & dispatch ──────────────────────────────────────── */
        const bg = this.device.createBindGroup({
            layout: this._bgLayout,
            entries: [
                { binding: 0, resource: { buffer: this._uniBuf } },
                { binding: 1, resource: { buffer: this._pointsBuf } },
                { binding: 2, resource: { buffer: fieldBuf } }
            ]
        });

        const enc = this.device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(this._pipeline);
        pass.setBindGroup(0, bg);
        pass.dispatchWorkgroups(
            Math.ceil(gx / 8),
            Math.ceil(gy / 8),
            Math.ceil(gz / 2)
        );
        pass.end();
        this.device.queue.submit([enc.finish()]);
    }

    destroy() {
        if (this._ownsPointBuf) this._pointsBuf?.destroy();
        this._uniBuf.destroy();
    }
}
