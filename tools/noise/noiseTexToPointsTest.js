/* noiseIsoDemo.js  –  2‑D + 3‑D isometric noise demo
   ───────────────────────────────────────────────────────────────
   Requires (import paths match your repo):
     • noiseComponent.html
     • noiseCompute.js
     • scalarField_TexToPoints.js
     • scalarField_TexToPoints.wgsl               (already imported by class)
   Everything else is vanilla WebGPU. */

import html from './noiseComponent.html';
import { NoiseComputeBuilder } from './noiseCompute.js';
import { TexToPointsChunkedGPU } from '../scalarField/scalarField_TexToPoints.js';

/* ── constants ───────────────────────────────────────────────────*/
const MAX_POS_VERTICES = 8_000_000;
const BYTES_PER_POINT = 16;   // sizeof(vec4<f32>)
const PAD = 256;
const STEP = 4;    // down-sample factor → ¼ res mesh
const CHANNEL_MODE = 1;    // height-map verts (x,y from tex, z=h)

/* ── globals ────────────────────────────────────────────────────*/
let device, queue, builder, t2p;
let ctx, canvas3D, vpBuf, vpBind, isoPipe;
let finalViewPromise;

/* ── tiny matrix helpers (no external libs) ─────────────────────*/
function mat4Identity() {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
}
function mat4Mul(a, b) {    // column-major multiply a·b
  const o = new Float32Array(16);
  for (let r = 0; r < 4; ++r) {
    for (let c = 0; c < 4; ++c) {
      o[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return o;
}
function mat4Ortho(l, r, b, t, n, f) {
  const m = mat4Identity();
  m[0] = 2 / (r - l);
  m[5] = 2 / (t - b);
  m[10] = -2 / (f - n);
  m[12] = -(r + l) / (r - l);
  m[13] = -(t + b) / (t - b);
  m[14] = -(f + n) / (f - n);
  return m;
}
function mat4RotateX(a) {
  const m = mat4Identity(), c = Math.cos(a), s = Math.sin(a);
  m[5] = c; m[6] = s;
  m[9] = -s; m[10] = c;
  return m;
}
function mat4RotateY(a) {
  const m = mat4Identity(), c = Math.cos(a), s = Math.sin(a);
  m[0] = c; m[2] = -s;
  m[8] = s; m[10] = c;
  return m;
}
function mat4RotateZ(a) {
  const m = mat4Identity(), c = Math.cos(a), s = Math.sin(a);
  m[0] = c; m[1] = s;
  m[4] = -s; m[5] = c;
  return m;
}
/* ── UI scaffold ────────────────────────────────────────────────*/
document.body.insertAdjacentHTML('afterbegin', html);

const canvas2D = document.getElementById('gpuCanvas') ?? (() => {
  const c = document.createElement('canvas');
  c.id = 'gpu-canvas';
  document.body.appendChild(c);
  return c;
})();
canvas3D = document.createElement('canvas');
canvas3D.id = 'meshCanvas';
canvas3D.width = canvas2D.width;
canvas3D.height = canvas2D.height;
document.body.appendChild(canvas3D);

/* grab every input once */
const $ = id => document.getElementById(id);
const resWidthInput = $('res-width');
const resHeightInput = $('res-height');
const noiseSeedInput = $('noise-seed');
const applyResBtn = $('apply-res');
const renderBtn = $('render-btn');
const noiseTypeChecks = Array.from(document.querySelectorAll('input[name="noise-type"]'));
const zoomInput = $('noise-zoom');
const freqInput = $('noise-freq');
const octavesInput = $('noise-octaves');
const lacunarityInput = $('noise-lacunarity');
const gainInput = $('noise-gain');
const xShiftInput = $('noise-xShift');
const yShiftInput = $('noise-yShift');
const zShiftInput = $('noise-zShift');
const thresholdInput = $('noise-threshold');
let lastSeed;

/* ── init WebGPU, pipelines, etc. ────────────────────────────*/
async function init() {
  if (!navigator.gpu) throw Error('WebGPU not supported');
  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();
  queue = device.queue;

  /* 2-D noise builder */
  builder = new NoiseComputeBuilder(device, queue);
  builder.configureCanvas(canvas2D, device);
  builder.initBlitRender();

  /* point-extractor for 3-D */
  t2p = new TexToPointsChunkedGPU(device);

  /* 3-D canvas context */
  ctx = canvas3D.getContext('webgpu');
  const preferredFormat = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({
    device,
    format: preferredFormat,
    alphaMode: 'opaque'
  });

  /* view-projection uniform (64 B) */
  vpBuf = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  /* minimal point-cloud render pipeline */
  const vs = /* wgsl */`
       struct VP { m : mat4x4<f32> }
       @group(0) @binding(0) var<uniform> Model : VP;
   
       struct VIn {
         @location(0) pos : vec3<f32>,
         @location(1) val : f32,
       }
       struct VOut {
         @builtin(position) pos : vec4<f32>,
         @location(0) v    : f32,
       }
   
       @vertex
       fn main(v : VIn) -> VOut {
         var o : VOut;
         o.pos = Model.m * vec4<f32>(v.pos, 1.0);
         o.v   = v.val;
         return o;
       }`;

  const fs = /* wgsl */`
       @fragment
       fn main(@location(0) v : f32) -> @location(0) vec4<f32> {
         return vec4<f32>(v, v, v, 1.0);
       }`;

  isoPipe = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({ code: vs }),
      entryPoint: 'main',
      buffers: [{
        arrayStride: 16,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32' }
        ]
      }]
    },
    fragment: {
      module: device.createShaderModule({ code: fs }),
      entryPoint: 'main',
      targets: [{ format: preferredFormat }]
    },
    primitive: { topology: 'point-list' },
    depthStencil: undefined
  });

  vpBind = device.createBindGroup({
    layout: isoPipe.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: vpBuf } }]
  });
}

/* ── build isometric VP matrix each frame ───────────────────*/
// replace your existing updateIsoVP() with this:
function updateIsoVP() {
  // 1) build your orthographic + rotation just as before
  const ortho = mat4Ortho(-1, 1, -1, 1, -10, 5);
  const rx = mat4RotateX(-0.25);
  const ry = mat4RotateY(0.25);
  const rz = mat4RotateZ(Math.PI);

  // 2) build a simple 4×4 that
  //    • scales X by 2/srcW  (maps [0…srcW] → [0…2])
  //    • scales Y by 2/srcH  (maps [0…srcH] → [0…2])
  //    • then offsets both by –1 (maps [0…2] → [–1…1])
  // const sx = 2 / srcW;
  // const sy = 2 / srcH;
  const S = new Float32Array([
    -1.5, 0, 0, 0,   // scale X from [0…1]→[0…2]
    0, 1.5, 0, 0,   // scale Y from [0…1]→[0…2]
    0, 0, -1.5, 0,
    1, -.5, -0.5, 1    // offset [0…2]→[−1…1]
  ]);

  // 3) chain them together:    ortho · (RY · (RX · S))
  // model = Rz · Ry · Rx · S
  const model = mat4Mul(rz, mat4Mul(ry, mat4Mul(rx, S)));

  // vp = ortho · model
  const vpMat = mat4Mul(ortho, model);

  // 4) upload
  queue.writeBuffer(vpBuf, 0, vpMat);
}


/* ── main render loop (2-D + 3-D) ───────────────────────────*/
async function render() {
  // wait for all in‑flight GPU work to finish before starting a new frame
  await queue.onSubmittedWorkDone();

  // if a compute is already in flight, skip
  if (finalViewPromise) return;

  const width = +resWidthInput.value;
  const height = +resHeightInput.value;
  const seed = +noiseSeedInput.value || Date.now();
  const noiseMask = noiseTypeChecks.filter(cb => cb.checked).map(cb => +cb.dataset.bit);

  // clamp threshold to include full heightmap if ≥0
  const rawThresh = +thresholdInput.value;
  const thresh = isNaN(rawThresh) || rawThresh >= 0
    ? -1.0
    : rawThresh;

  const params = {
    zoom: +zoomInput.value,
    freq: +freqInput.value,
    octaves: +octavesInput.value,
    lacunarity: +lacunarityInput.value,
    gain: +gainInput.value,
    xShift: +xShiftInput.value,
    yShift: +yShiftInput.value,
    zShift: +zShiftInput.value,
    threshold: +thresholdInput.value,
    time: 0,
    turbulence: 0,
    exp1: 1,
    exp2: 0,
    rippleFreq: 10,
    seedAngle: seed * 2 * Math.PI
  };

  if (seed !== lastSeed) {
    builder.buildPermTable(seed);
    lastSeed = seed;
  }

  // 1) compute noise → texture
  finalViewPromise = builder.computeToTexture(
    width, height, params,
    { noiseChoices: ['clearTexture', ...noiseMask], outputChannel: CHANNEL_MODE }
  );
  const view = await finalViewPromise;
  finalViewPromise = undefined;

  // 2-D preview
  builder.renderTextureToCanvas(
    builder.getCurrentView(), canvas2D
  );

  // 2) extract point cloud (down‑sample STEP×STEP)
  const chunks = t2p.generate(
    view,
    {
      srcW: width,
      srcH: height,
      layers: 1,
      step: STEP,
      channelMode: CHANNEL_MODE,
      heightScale: 1.0,
      thresh: -1.0 //used to skip verts in the point cloud that fall below a certain h
    },
    MAX_POS_VERTICES * 4,
    BYTES_PER_POINT,
    PAD
  );

  // **read every counter _before_ we grab the swap‑chain texture**
  const counts = new Uint32Array(chunks.length);
  for (let i = 0; i < chunks.length; ++i) {
    counts[i] = await readBackU32(device, chunks[i].counter);
  }

  // 3) draw point cloud – now entirely synchronous from getCurrentTexture → submit
  updateIsoVP()
  const enc = device.createCommandEncoder();
  const rt = ctx.getCurrentTexture().createView();
  const pass = enc.beginRenderPass({
    colorAttachments: [{
      view: rt,
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0.05, g: 0.05, b: 0.06, a: 1 }
    }]
  });
  pass.setPipeline(isoPipe);
  pass.setBindGroup(0, vpBind);

  for (let i = 0; i < chunks.length; ++i) {
    pass.setVertexBuffer(0, chunks[i].points);
    pass.draw(counts[i], 1, 0, 0);
  }

  pass.end();
  queue.submit([enc.finish()]);
}

/* ── util to read a single u32 counter buffer ───────────────*/
async function readBackU32(dev, buf) {
  const stage = dev.createBuffer({
    size: 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });
  const enc = dev.createCommandEncoder();
  enc.copyBufferToBuffer(buf, 0, stage, 0, 4);
  dev.queue.submit([enc.finish()]);
  await stage.mapAsync(GPUMapMode.READ);
  const n = new Uint32Array(stage.getMappedRange())[0];
  stage.unmap();
  stage.destroy();
  return n;
}

/* ── boot ­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­­*/
init().then(() => {
  applyResBtn.onclick = render;
  renderBtn.onclick = render;
  noiseTypeChecks.forEach(cb => cb.addEventListener('input', render));
  [
    zoomInput, freqInput, octavesInput, lacunarityInput,
    gainInput, xShiftInput, yShiftInput, zShiftInput,
    thresholdInput, noiseSeedInput
  ].forEach(el => el.addEventListener('input', render));
  render();
});
