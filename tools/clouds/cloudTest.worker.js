// tools/clouds/cloudTest.worker.js
// cloudTest.worker.js (seed-aware, generic per-texture noise selectors, 4D-only for 3D volumes)
// Updated: supports full NoiseTransforms (weather scale/offset + per-axis scale vectors for shape/detail/weather)
import { NoiseComputeBuilder } from "../noise/noiseCompute.js";
import { CloudComputeBuilder } from "./clouds.js";

let device = null,
  queue = null,
  nb = null,
  cb = null;

let canvasMain = null,
  ctxMain = null;

const dbg = {
  weather: null,
  weatherG: null,
  weatherB: null,
  shapeR: null,
  detailR: null,
  blue: null,
};

// sizes (mirrored from UI)
let MAIN_W = 1,
  MAIN_H = 1,
  PRESENT_W = 1,
  PRESENT_H = 1,
  DBG_W = 1,
  DBG_H = 1;

let SHAPE_SIZE = 128,
  DETAIL_SIZE = 32,
  WEATHER_W = 512,
  WEATHER_H = 512,
  BN_W = 256,
  BN_H = 256;

let debugPreviewEnabled = true;
let mobileProfileEnabled = false;
let lastResizeProfile = null;

// baked noise resources
const noise = {
  weather: { arrayView: null, dirty: false, gCleared: false, bCleared: false },
  blue: { arrayView: null, dirty: false },
  shape128: { view3D: null, size: 128, dirty: false },
  detail32: { view3D: null, size: 32, dirty: false },
};

const BLUE_NOISE_SHARPNESS = 0.12;
const BLUE_NOISE_CONTRAST = 0.68;
let blueBlurPipeline = null;
let blueBlurSampler = null;
let blueBlurUniform = null;
let blueBlurTexture = null;
let blueBlurView = null;
let blueBlurW = 0;
let blueBlurH = 0;

let currentSlice = 0;

// reprojection/history resources
let historyTexA = null,
  historyTexB = null,
  historyViewA = null,
  historyViewB = null;

let historyPrevView = null,
  historyOutView = null,
  historyUsesAasOut = true,
  historyAllocated = false;

let historyTexWidth = 0,
  historyTexHeight = 0,
  historyTexLayers = 0;

let motionTex = null,
  motionView = null,
  depthTex = null,
  depthView = null;

let workerReproj = null,
  workerPerf = null;

// tuning
let workerTuning = null;
let workerTuningVersion = 0;
let lastAppliedTuningVersion = -1;
let lastAppliedTuningSignature = "";

// loop and transform state
let loopEnabled = false,
  loopRunning = false,
  lastRunPayload = null,
  emaSubmitFps = null,
  emaLoopFps = null,
  emaMaxRoundTripFps = null;

let pendingResizePayload = null;
let pendingResizeSerial = 0;

// NoiseTransforms (world-space offsets/scales + per-axis scaling)
let shapeOffsetWorld = [0, 0, 0],
  detailOffsetWorld = [0, 0, 0],
  weatherOffsetWorld = [0, 0, 0];

let shapeVel = [0.2, 0, 0],
  detailVel = [0.03, 0, 0],
  weatherVel = [0.01, 0, 0];

let shapeScale = 0.1,
  detailScale = 1.0,
  weatherScale = 1.0;

let shapeBias = 0.0,
  detailBias = 0.0,
  weatherBias = 0.0;

let shapeAxisScale = [1, 1, 1],
  detailAxisScale = [1, 1, 1],
  weatherAxisScale = [1, 1, 1];

const renderBundleCache = new Map();
const log = (...a) => postMessage({ type: "log", data: a });

let lastPermSeed = null;
let cachedEntryPointsRef = null;
let cachedEntrySet = null;

const LOOP_TARGET_MS = 1000 / 60;
const FRAME_LOG_EVERY = 240;
const LOOP_MAX_GPU_FRAMES_IN_FLIGHT = 3;
const CAMERA_RESET_FRAMES = 1;
const CAMERA_SIG_EPS = 1e-4;
let submittedFrameCount = 0;
let loopGpuFences = [];
let lastViewSignature = null;
let lastCloudSceneSignature = "";
let lastCloudViewSignature = "";
let lastRenderUniformSignature = "";
let lastNoiseTransformSignature = "";
let lastBaseWeatherView = null;
let lastBaseBlueView = null;
let lastBaseShapeView = null;
let lastBaseDetailView = null;
let reprojResetFrames = 0;

// -----------------------------------------------------------------------------
// startup deferral helpers
// -----------------------------------------------------------------------------
const STARTUP_DEFER_MS = 0;

function deferToBrowser(ms = STARTUP_DEFER_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function progressiveYield(enabled, message = "Working...") {
  if (!enabled) return;
  try {
    postMessage({ type: "progress", data: { message } });
  } catch {}
  await deferToBrowser();
}

function renderDebugIfEnabled(kind = "all") {
  if (!debugPreviewEnabled) return;
  if (kind === "weather") {
    renderWeatherDebug();
    return;
  }
  if (kind === "slices") {
    renderDebugSlices();
    return;
  }
  renderWeatherDebug();
  renderDebugSlices();
}

// -----------------------------------------------------------------------------
// device and builders
// -----------------------------------------------------------------------------
async function ensureDevice() {
  if (device) return;

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: mobileProfileEnabled ? "low-power" : "high-performance" });
  if (!adapter) throw new Error("No suitable GPU adapter (worker)");

  const maxBufferSize = adapter.limits?.maxBufferSize || 0;
  const defaultSafeBufferSize = 256 * 1024 * 1024;
  const wantedBufferSize = Math.min(maxBufferSize || defaultSafeBufferSize, mobileProfileEnabled ? defaultSafeBufferSize : 1024 * 1024 * 1024);

  try {
    device = await adapter.requestDevice(
      wantedBufferSize > defaultSafeBufferSize
        ? { requiredLimits: { maxBufferSize: wantedBufferSize } }
        : {},
    );
  } catch (err) {
    console.warn("requestDevice with custom limits failed; retrying with defaults", err);
    device = await adapter.requestDevice();
  }
  queue = device.queue;

  nb = new NoiseComputeBuilder(device, queue);
  cb = new CloudComputeBuilder(device, queue);

  nb.initBlitRender?.();

  try {
    nb.buildPermTable(Date.now());
  } catch (e) {
    console.warn("nb.buildPermTable initial failed", e);
  }

  try {
    cb.setTuning?.();
  } catch (e) {
    console.warn("Initial cb.setTuning failed", e);
  }
}

function configureMainContext(width = MAIN_W, height = MAIN_H) {
  if (!canvasMain) return;

  const w = Math.max(1, width | 0);
  const h = Math.max(1, height | 0);

  ctxMain = canvasMain.getContext("webgpu");
  if (!ctxMain) throw new Error("Failed to get webgpu context for main canvas");

  if (canvasMain.width !== w) canvasMain.width = w;
  if (canvasMain.height !== h) canvasMain.height = h;

  const fmt = cb?._ensureRenderPipeline?.("bgra8unorm")?.format ?? "bgra8unorm";
  ctxMain.configure({
    device,
    format: fmt,
    alphaMode: "opaque",
    size: [w, h],
  });

  PRESENT_W = w;
  PRESENT_H = h;
  renderBundleCache.clear();
  return ctxMain;
}

function normalizeResizePayload(payload = {}) {
  const main = payload.main || {};
  const dbgSize = payload.dbg || {};
  return {
    main: {
      width: Math.max(1, main.width | 0),
      height: Math.max(1, main.height | 0),
    },
    dbg: {
      width: Math.max(1, dbgSize.width | 0),
      height: Math.max(1, dbgSize.height | 0),
    },
    profile: payload.profile || null,
    serial: payload.serial || 0,
  };
}

function resizePayloadSignature(payload = {}) {
  const p = normalizeResizePayload(payload);
  const dpr = Number(p.profile?.dpr || 0).toFixed(4);
  const cssW = p.profile?.cssWidth | 0;
  const cssH = p.profile?.cssHeight | 0;
  return [p.main.width, p.main.height, p.dbg.width, p.dbg.height, dpr, cssW, cssH].join("x");
}

async function applyResizePayloadNow(payload = {}) {
  const p = normalizeResizePayload(payload);
  const sameSize =
    MAIN_W === p.main.width &&
    MAIN_H === p.main.height &&
    DBG_W === p.dbg.width &&
    DBG_H === p.dbg.height &&
    canvasMain?.width === p.main.width &&
    canvasMain?.height === p.main.height &&
    PRESENT_W === p.main.width &&
    PRESENT_H === p.main.height;

  lastResizeProfile = p.profile;
  if (sameSize) {
    return { ok: true, unchanged: true, serial: p.serial };
  }

  MAIN_W = p.main.width;
  MAIN_H = p.main.height;
  DBG_W = p.dbg.width;
  DBG_H = p.dbg.height;

  if (canvasMain) {
    canvasMain.width = MAIN_W;
    canvasMain.height = MAIN_H;
    PRESENT_W = MAIN_W;
    PRESENT_H = MAIN_H;
  }

  Object.values(dbg).forEach((c) => {
    if (c) {
      c.width = DBG_W;
      c.height = DBG_H;
    }
  });

  if (ctxMain) {
    configureMainContext(MAIN_W, MAIN_H);
  }

  renderBundleCache.clear();
  resetFrameStateCaches();
  if (cb) cb._bg0Dirty = cb._bg1Dirty = true;
  invalidateReprojectionHistory();

  return { ok: true, resized: true, serial: p.serial, width: MAIN_W, height: MAIN_H };
}

async function applyPendingResizeIfAny() {
  if (!pendingResizePayload) return null;
  const payload = pendingResizePayload;
  pendingResizePayload = null;
  return applyResizePayloadNow(payload);
}

function ensureMainPresentSize(width = MAIN_W, height = MAIN_H) {
  const w = Math.max(1, width | 0);
  const h = Math.max(1, height | 0);
  if (!ctxMain || PRESENT_W !== w || PRESENT_H !== h || canvasMain?.width !== w || canvasMain?.height !== h) {
    configureMainContext(w, h);
  }
  return ctxMain;
}

function previewPresentDivider(preview, coarseFactor, fastPreview) {
  if (!fastPreview) return 1;
  const cf = Math.max(1, coarseFactor | 0);
  if (cf < 2) return 1;
  return Math.max(1, Math.min(cf, 6));
}

// -----------------------------------------------------------------------------
// debug rendering
// -----------------------------------------------------------------------------
function renderDebugSlices() {
  if (!nb) return;

  const s = Math.max(0, Math.min(SHAPE_SIZE - 1, currentSlice | 0));
  const d = Math.max(0, Math.min(DETAIL_SIZE - 1, Math.floor((s * DETAIL_SIZE) / SHAPE_SIZE)));

  if (dbg.shapeR && noise.shape128.view3D) {
    nb.renderTexture3DSliceToCanvas(noise.shape128.view3D, dbg.shapeR, {
      depth: SHAPE_SIZE,
      slice: s,
      channel: 1,
      clear: true,
      width: DBG_W,
      height: DBG_H,
    });
  }

  if (dbg.detailR && noise.detail32.view3D) {
    nb.renderTexture3DSliceToCanvas(noise.detail32.view3D, dbg.detailR, {
      depth: DETAIL_SIZE,
      slice: d,
      channel: 1,
      clear: true,
      width: DBG_W,
      height: DBG_H,
    });
  }
}

function renderWeatherDebug() {
  if (!nb || !noise.weather.arrayView) return;

  if (dbg.weather) {
    nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weather, {
      preserveCanvasSize: true,
      clear: true,
      channel: 1,
      width: DBG_W,
      height: DBG_H,
    });
  }

  if (dbg.weatherG) {
    nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weatherG, {
      preserveCanvasSize: true,
      clear: true,
      channel: 2,
      width: DBG_W,
      height: DBG_H,
    });
  }

  if (dbg.weatherB) {
    nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weatherB, {
      preserveCanvasSize: true,
      clear: true,
      channel: 3,
      width: DBG_W,
      height: DBG_H,
    });
  }
}

// -----------------------------------------------------------------------------
// seed helper
// -----------------------------------------------------------------------------
function maybeApplySeedToPermTable(params) {
  if (!params) return;
  const seedVal = params.seed;
  if (seedVal === undefined || seedVal === null) return;

  const s = typeof seedVal === "string" ? Number(seedVal) || 0 : Number(seedVal) || 0;
  if (!Number.isFinite(s) || s === 0) return;
  if (lastPermSeed === s) return;

  try {
    nb.buildPermTable?.(s);
    lastPermSeed = s;
  } catch (e) {
    console.warn("buildPermTable(seed) failed", e);
  }
}

// -----------------------------------------------------------------------------
// entrypoint filtering/sanitizing
// -----------------------------------------------------------------------------
function isEntry4D(ep) {
  return typeof ep === "string" && /4D/.test(ep);
}

function getEntrySet() {
  const eps = Array.isArray(nb?.entryPoints) ? nb.entryPoints : [];
  if (cachedEntryPointsRef === eps && cachedEntrySet) return cachedEntrySet;
  cachedEntryPointsRef = eps;
  cachedEntrySet = new Set(eps.filter((x) => typeof x === "string" && x.length));
  return cachedEntrySet;
}

function sanitizeEntry(entry, fallback, opts = {}) {
  const { require4D = false } = opts;
  const set = getEntrySet();
  let s = typeof entry === "string" ? entry : "";
  if (s === "computeBillow4D" && !set.has(s) && set.has("computeBillow")) s = "computeBillow";
  if (!s) return fallback;
  if (!set.has(s)) return fallback;
  if (require4D && !isEntry4D(s)) return fallback;
  return s;
}

function stripKeys(src, keys) {
  const out = {};
  const o = src && typeof src === "object" ? src : {};
  for (const k of Object.keys(o)) {
    if (keys.has(k)) continue;
    out[k] = o[k];
  }
  return out;
}

function withToroidalFromMode(params, mode) {
  const p = params && typeof params === "object" ? { ...params } : {};
  p.toroidal = isEntry4D(mode) ? 1 : 0;
  return p;
}

// -----------------------------------------------------------------------------
// baking
// -----------------------------------------------------------------------------
async function bakeWeather2D(weatherParams = {}, force = false, billowParams = {}, weatherBParams = null) {
  if (noise.weather.arrayView && !force && !noise.weather.dirty) {
    renderDebugIfEnabled("weather");
    noise.weather.dirty = false;
    return { baseMs: 0, gMs: 0, bMs: 0, totalMs: 0 };
  }

  const T0 = performance.now();

  const WEATHER_DROP = new Set(["mode"]);
  const baseMode = sanitizeEntry(weatherParams.mode, "computeFBM", { require4D: false });
  const baseParamsRaw = stripKeys(weatherParams, WEATHER_DROP);
  const baseParams = withToroidalFromMode(baseParamsRaw, baseMode);
  maybeApplySeedToPermTable(baseParams);

  const t0 = performance.now();
  const baseView = await nb.computeToTexture(WEATHER_W, WEATHER_H, baseParams, {
    noiseChoices: ["clearTexture", baseMode],
    outputChannel: 1,
    textureKey: "weather2d",
    viewDimension: "2d-array",
  });
  const baseMs = performance.now() - t0;

  const enabledG = !!(billowParams && billowParams.enabled === true);
  let gMs = 0;

  if (enabledG) {
    const G_DROP = new Set(["mode", "enabled"]);
    const gMode = sanitizeEntry(billowParams.mode, "computeBillow", { require4D: false });
    const gParamsRaw = stripKeys(billowParams, G_DROP);
    const gParams = withToroidalFromMode(gParamsRaw, gMode);
    maybeApplySeedToPermTable(gParams);

    const tg0 = performance.now();
    await nb.computeToTexture(WEATHER_W, WEATHER_H, gParams, {
      noiseChoices: ["clearTexture", gMode],
      outputChannel: 2,
      textureKey: "weather2d",
      viewDimension: "2d-array",
    });
    gMs = performance.now() - tg0;
    noise.weather.gCleared = false;
  } else if (!noise.weather.gCleared) {
    const tc0 = performance.now();
    await nb.computeToTexture(
      WEATHER_W,
      WEATHER_H,
      { zoom: 1.0 },
      {
        noiseChoices: ["clearTexture"],
        outputChannel: 2,
        textureKey: "weather2d",
        viewDimension: "2d-array",
      },
    );
    noise.weather.gCleared = true;
    gMs = performance.now() - tc0;
  }

  const enabledB = !!(weatherBParams && typeof weatherBParams === "object" && weatherBParams.enabled === true);
  let bMs = 0;

  if (enabledB) {
    const B_DROP = new Set(["mode", "enabled"]);
    const bMode = sanitizeEntry(weatherBParams.mode, "computeBillow", { require4D: false });
    const bParamsRaw = stripKeys(weatherBParams, B_DROP);
    const bParams = withToroidalFromMode(bParamsRaw, bMode);
    maybeApplySeedToPermTable(bParams);

    const tb0 = performance.now();
    await nb.computeToTexture(WEATHER_W, WEATHER_H, bParams, {
      noiseChoices: ["clearTexture", bMode],
      outputChannel: 3,
      textureKey: "weather2d",
      viewDimension: "2d-array",
    });
    bMs = performance.now() - tb0;
    noise.weather.bCleared = false;
  } else if (!noise.weather.bCleared) {
    const tc0 = performance.now();
    await nb.computeToTexture(
      WEATHER_W,
      WEATHER_H,
      { zoom: 1.0 },
      {
        noiseChoices: ["clearTexture"],
        outputChannel: 3,
        textureKey: "weather2d",
        viewDimension: "2d-array",
      },
    );
    noise.weather.bCleared = true;
    bMs = performance.now() - tc0;
  }

  noise.weather.arrayView =
    (typeof nb.get2DView === "function" ? nb.get2DView("weather2d", { dimension: "2d-array" }) : baseView) || baseView;
  noise.weather.dirty = false;

  renderDebugIfEnabled("weather");

  const totalMs = performance.now() - T0;
  log(
    "[BENCH] weather base(ms):",
    baseMs.toFixed(2),
    " g(ms):",
    gMs.toFixed(2),
    " b(ms):",
    bMs.toFixed(2),
    " total(ms):",
    totalMs.toFixed(2),
    " baseMode:",
    baseMode,
    " gEnabled:",
    enabledG,
    " bEnabled:",
    enabledB,
  );
  return { baseMs, gMs, bMs, totalMs };
}


function getBlueBlurPipeline() {
  if (blueBlurPipeline) return blueBlurPipeline;

  blueBlurSampler = blueBlurSampler || device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "repeat",
    addressModeV: "repeat",
  });

  blueBlurUniform = blueBlurUniform || device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const code = `
struct BlueBlurParams {
  dim: vec2<f32>,
  sharpness: f32,
  contrast: f32,
};

@group(0) @binding(0) var inTex: texture_2d_array<f32>;
@group(0) @binding(1) var inSamp: sampler;
@group(0) @binding(2) var outTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var<uniform> P: BlueBlurParams;

fn wrapCoord(p: vec2<i32>) -> vec2<i32> {
  let d = vec2<i32>(max(i32(P.dim.x), 1), max(i32(P.dim.y), 1));
  return vec2<i32>(((p.x % d.x) + d.x) % d.x, ((p.y % d.y) + d.y) % d.y);
}

fn readBlue(p: vec2<i32>) -> f32 {
  let q = wrapCoord(p);
  let uv = (vec2<f32>(q) + vec2<f32>(0.5, 0.5)) / max(P.dim, vec2<f32>(1.0, 1.0));
  return textureSampleLevel(inTex, inSamp, uv, 0i, 0.0).r;
}

fn blueWeight1D(o: i32) -> f32 {
  let a = abs(o);
  if (a == 0) { return 6.0; }
  if (a == 1) { return 4.0; }
  return 1.0;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let w = u32(max(P.dim.x, 1.0));
  let h = u32(max(P.dim.y, 1.0));
  if (gid.x >= w || gid.y >= h) { return; }

  let p = vec2<i32>(i32(gid.x), i32(gid.y));
  let c = readBlue(p);
  var gaussian = 0.0;

  for (var oy = -2; oy <= 2; oy = oy + 1) {
    for (var ox = -2; ox <= 2; ox = ox + 1) {
      let w2 = blueWeight1D(ox) * blueWeight1D(oy);
      gaussian = gaussian + readBlue(p + vec2<i32>(ox, oy)) * w2;
    }
  }

  gaussian = gaussian / 256.0;
  let softened = mix(gaussian, c, clamp(P.sharpness, 0.0, 1.0));
  let v = clamp((softened - 0.5) * clamp(P.contrast, 0.0, 2.0) + 0.5, 0.0, 1.0);
  textureStore(outTex, vec2<i32>(i32(gid.x), i32(gid.y)), vec4<f32>(v, v, v, 1.0));
}
`;

  blueBlurPipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code }),
      entryPoint: "main",
    },
  });

  return blueBlurPipeline;
}

function blurBlueNoiseView(inputView, width, height, sharpness = BLUE_NOISE_SHARPNESS) {
  if (!device || !queue || !inputView) return inputView;

  try {
    const pipeline = getBlueBlurPipeline();
    const w = Math.max(1, width | 0);
    const h = Math.max(1, height | 0);

    if (!blueBlurTexture || blueBlurW !== w || blueBlurH !== h) {
      if (blueBlurTexture) {
        try { blueBlurTexture.destroy?.(); } catch {}
      }

      blueBlurTexture = device.createTexture({
        size: [w, h, 1],
        format: "rgba16float",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      blueBlurW = w;
      blueBlurH = h;
      blueBlurView = blueBlurTexture.createView({
        dimension: "2d-array",
        baseArrayLayer: 0,
        arrayLayerCount: 1,
      });
    }

    const storageView = blueBlurTexture.createView({ dimension: "2d" });

    const params = new Float32Array([
      w,
      h,
      Math.max(0, Math.min(1, sharpness)),
      BLUE_NOISE_CONTRAST,
    ]);
    queue.writeBuffer(blueBlurUniform, 0, params.buffer, params.byteOffset, params.byteLength);

    const bg = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputView },
        { binding: 1, resource: blueBlurSampler },
        { binding: 2, resource: storageView },
        { binding: 3, resource: { buffer: blueBlurUniform } },
      ],
    });

    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8), 1);
    pass.end();
    queue.submit([enc.finish()]);
    return blueBlurView || inputView;
  } catch (err) {
    try { console.warn("blue noise blur preprocess failed", err); } catch {}
    return inputView;
  }
}

async function bakeBlue2D(blueParams = {}, force = false) {
  maybeApplySeedToPermTable(blueParams);

  if (noise.blue.arrayView && !force && !noise.blue.dirty) {
    noise.blue.dirty = false;
    if (debugPreviewEnabled && dbg.blue) {
      nb.renderTextureToCanvas(noise.blue.arrayView, dbg.blue, {
        preserveCanvasSize: true,
        clear: true,
        width: DBG_W,
        height: DBG_H,
      });
    }
    return { blueMs: 0, totalMs: 0 };
  }

  const T0 = performance.now();
  const t0 = performance.now();
  const arrView = await nb.computeToTexture(BN_W, BN_H, blueParams, {
    noiseChoices: ["clearTexture", "computeBlueNoise"],
    outputChannel: 0,
    textureKey: "blue2d",
  });
  const blueMs = performance.now() - t0;

  const rawBlueView = (typeof nb.get2DView === "function" ? nb.get2DView("blue2d") : arrView) || arrView;
  const blurT0 = performance.now();
  const filteredBlueView = blurBlueNoiseView(rawBlueView, BN_W, BN_H, BLUE_NOISE_SHARPNESS);
  const blurMs = performance.now() - blurT0;
  noise.blue.arrayView = filteredBlueView || rawBlueView;
  noise.blue.dirty = false;

  if (debugPreviewEnabled && dbg.blue) {
    nb.renderTextureToCanvas(noise.blue.arrayView, dbg.blue, {
      preserveCanvasSize: true,
      clear: true,
      width: DBG_W,
      height: DBG_H,
    });
  }

  const totalMs = performance.now() - T0;
  log("[BENCH] blue noise(ms):", blueMs.toFixed(2), " blur(ms):", blurMs.toFixed(2), " total(ms):", totalMs.toFixed(2));
  return { blueMs, blurMs, totalMs };
}

async function bakeShape128(shapeParams = {}, force = false) {
  maybeApplySeedToPermTable(shapeParams);

  if (noise.shape128.view3D && !force && !noise.shape128.dirty) {
    noise.shape128.dirty = false;
    if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
    renderDebugIfEnabled("slices");
    return { baseMs: 0, bandsMs: [0, 0, 0], totalMs: 0 };
  }

  const T0 = performance.now();

  const drop = new Set(["baseModeA", "baseModeB", "bandMode2", "bandMode3", "bandMode4"]);
  const baseParamsRaw = stripKeys(shapeParams, drop);
  const baseParams = { ...baseParamsRaw, toroidal: 1, band: "base" };

  const baseModeA = sanitizeEntry(shapeParams.baseModeA, "computePerlin4D", { require4D: true });
  const baseModeB = sanitizeEntry(shapeParams.baseModeB, "computeAntiWorley4D", { require4D: true });

  const baseChoices = ["clearTexture", baseModeA];
  if (baseModeB && baseModeB !== baseModeA) baseChoices.push(baseModeB);

  const t0 = performance.now();
  await nb.computeToTexture3D(SHAPE_SIZE, SHAPE_SIZE, SHAPE_SIZE, baseParams, {
    noiseChoices: baseChoices,
    outputChannel: 1,
    id: "shape128",
  });
  const baseMs = performance.now() - t0;

  const z = Number(shapeParams.zoom) || 1;
  const bandSpecs = [
    { ch: 2, zm: z / 2, mode: sanitizeEntry(shapeParams.bandMode2, "computeWorley4D", { require4D: true }) },
    { ch: 3, zm: z / 4, mode: sanitizeEntry(shapeParams.bandMode3, "computeWorley4D", { require4D: true }) },
    { ch: 4, zm: z / 8, mode: sanitizeEntry(shapeParams.bandMode4, "computeWorley4D", { require4D: true }) },
  ];

  const bandsMs = [];
  for (const b of bandSpecs) {
    const tb0 = performance.now();
    await nb.computeToTexture3D(
      SHAPE_SIZE,
      SHAPE_SIZE,
      SHAPE_SIZE,
      { ...baseParamsRaw, zoom: b.zm, toroidal: 1 },
      {
        noiseChoices: ["clearTexture", b.mode],
        outputChannel: b.ch,
        id: "shape128",
      },
    );
    bandsMs.push(performance.now() - tb0);
  }

  noise.shape128.view3D = nb.get3DView("shape128");
  noise.shape128.dirty = false;

  if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
  renderDebugIfEnabled("slices");

  const totalMs = performance.now() - T0;
  log(
    "[BENCH] shape base(ms):",
    baseMs.toFixed(2),
    " bands(ms):",
    bandsMs.map((x) => x.toFixed(2)).join(", "),
    " total(ms):",
    totalMs.toFixed(2),
    " base:",
    baseModeA,
    "+",
    baseModeB,
    " bands:",
    bandSpecs.map((b) => `${b.ch}:${b.mode}`).join(" "),
  );
  return { baseMs, bandsMs, totalMs };
}

async function bakeDetail32(detailParams = {}, force = false) {
  maybeApplySeedToPermTable(detailParams);

  if (noise.detail32.view3D && !force && !noise.detail32.dirty) {
    noise.detail32.dirty = false;
    if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
    renderDebugIfEnabled("slices");
    return { bandsMs: [0, 0, 0], totalMs: 0 };
  }

  const T0 = performance.now();

  const drop = new Set(["mode1", "mode2", "mode3"]);
  const baseParamsRaw = stripKeys(detailParams, drop);

  const z = Number(detailParams.zoom) || 1;
  const m1 = sanitizeEntry(detailParams.mode1, "computeAntiWorley4D", { require4D: true });
  const m2 = sanitizeEntry(detailParams.mode2, "computeAntiWorley4D", { require4D: true });
  const m3 = sanitizeEntry(detailParams.mode3, "computeAntiWorley4D", { require4D: true });

  const bands = [
    { ch: 1, zm: z, mode: m1 },
    { ch: 2, zm: z / 2, mode: m2 },
    { ch: 3, zm: z / 4, mode: m3 },
  ];

  const bandsMs = [];
  for (const b of bands) {
    const tb0 = performance.now();
    await nb.computeToTexture3D(
      DETAIL_SIZE,
      DETAIL_SIZE,
      DETAIL_SIZE,
      { ...baseParamsRaw, zoom: b.zm, toroidal: 1 },
      {
        noiseChoices: ["clearTexture", b.mode],
        outputChannel: b.ch,
        id: "detail32",
      },
    );
    bandsMs.push(performance.now() - tb0);
  }

  noise.detail32.view3D = nb.get3DView("detail32");
  noise.detail32.dirty = false;

  if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
  renderDebugIfEnabled("slices");

  const totalMs = performance.now() - T0;
  log(
    "[BENCH] detail bands(ms):",
    bandsMs.map((x) => x.toFixed(2)).join(", "),
    " total(ms):",
    totalMs.toFixed(2),
    " modes:",
    `${m1},${m2},${m3}`,
  );
  return { bandsMs, totalMs };
}

// -----------------------------------------------------------------------------
// history helpers
// -----------------------------------------------------------------------------
function ensureHistoryTextures(w, h, layers = 1) {
  if (historyAllocated && historyTexWidth === w && historyTexHeight === h && historyTexLayers === layers) return;

  historyTexWidth = w;
  historyTexHeight = h;
  historyTexLayers = layers;

  try {
    historyTexA?.destroy?.();
  } catch {}
  try {
    historyTexB?.destroy?.();
  } catch {}

  historyTexA = historyTexB = null;
  historyViewA = historyViewB = null;
  historyPrevView = null;
  historyOutView = null;

  const desc = {
    size: [w, h, layers],
    format: "rgba16float",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC,
  };

  historyTexA = device.createTexture(desc);
  historyTexB = device.createTexture(desc);
  historyViewA = historyTexA.createView({ dimension: "2d-array", arrayLayerCount: layers });
  historyViewB = historyTexB.createView({ dimension: "2d-array", arrayLayerCount: layers });

  historyUsesAasOut = true;
  historyOutView = historyViewA;
  historyPrevView = null;
  historyAllocated = true;
}

// -----------------------------------------------------------------------------
// transforms (NoiseTransforms + legacy tileTransforms)
// -----------------------------------------------------------------------------
function toVec3(v, fallback = null) {
  if (Array.isArray(v)) {
    const x = Number(v[0]),
      y = Number(v[1]),
      z = Number(v[2] ?? 0);
    if ([x, y, z].some((n) => Number.isNaN(n))) return fallback;
    return [x, y, z];
  }
  if (v && typeof v === "object") {
    const x = Number(v.x),
      y = Number(v.y),
      z = Number(v.z ?? 0);
    if ([x, y, z].some((n) => Number.isNaN(n))) return fallback;
    return [x, y, z];
  }
  return fallback;
}

function applyNoiseTransforms(nt, opts = {}) {
  if (!nt || typeof nt !== "object") return;

  const allowPositions = opts.allowPositions !== undefined ? !!opts.allowPositions : true;
  const allowScale = opts.allowScale !== undefined ? !!opts.allowScale : true;
  const allowVel = opts.allowVel !== undefined ? !!opts.allowVel : true;
  const additive = !!opts.additive || !!nt.additive;

  const readScale = (x, fb) => {
    const v = Number(x);
    return Number.isFinite(v) ? v : fb;
  };

  const pickOffset = (o, legacy) => {
    const a = toVec3(o, null);
    if (a) return a;
    const b = toVec3(legacy, null);
    if (b) return b;
    return null;
  };

  const pickAxis = (v) => {
    const a = toVec3(v, null);
    return a ? a : null;
  };

  if (allowPositions) {
    const sOff = pickOffset(nt.shapeOffsetWorld, nt.shapeOffset);
    if (sOff) {
      if (additive) {
        shapeOffsetWorld[0] += sOff[0];
        shapeOffsetWorld[1] += sOff[1];
        shapeOffsetWorld[2] += sOff[2];
      } else {
        shapeOffsetWorld = sOff;
      }
    }

    const dOff = pickOffset(nt.detailOffsetWorld, nt.detailOffset);
    if (dOff) {
      if (additive) {
        detailOffsetWorld[0] += dOff[0];
        detailOffsetWorld[1] += dOff[1];
        detailOffsetWorld[2] += dOff[2];
      } else {
        detailOffsetWorld = dOff;
      }
    }

    const wOff = pickOffset(nt.weatherOffsetWorld, nt.weatherOffset);
    if (wOff) {
      if (additive) {
        weatherOffsetWorld[0] += wOff[0];
        weatherOffsetWorld[1] += wOff[1];
        weatherOffsetWorld[2] += wOff[2];
      } else {
        weatherOffsetWorld = wOff;
      }
    }
  }

  if (allowScale) {
    if (nt.shapeScale !== undefined) shapeScale = readScale(nt.shapeScale, shapeScale);
    if (nt.detailScale !== undefined) detailScale = readScale(nt.detailScale, detailScale);
    if (nt.weatherScale !== undefined) weatherScale = readScale(nt.weatherScale, weatherScale);
  }

  if (nt.shapeBias !== undefined) shapeBias = Number(nt.shapeBias) || 0.0;
  if (nt.detailBias !== undefined) detailBias = Number(nt.detailBias) || 0.0;
  if (nt.weatherBias !== undefined) weatherBias = Number(nt.weatherBias) || 0.0;

  if (allowVel) {
    const sv = toVec3(nt.shapeVel, null);
    if (sv) shapeVel = sv;

    const dv = toVec3(nt.detailVel, null);
    if (dv) detailVel = dv;

    const wv = toVec3(nt.weatherVel, null);
    if (wv) weatherVel = wv;
  }

  const sAx = pickAxis(nt.shapeAxisScale);
  if (sAx) shapeAxisScale = sAx;

  const dAx = pickAxis(nt.detailAxisScale);
  if (dAx) detailAxisScale = dAx;

  const wAx = pickAxis(nt.weatherAxisScale);
  if (wAx) weatherAxisScale = wAx;

}

function transformStateSignature() {
  return [
    shapeOffsetWorld[0], shapeOffsetWorld[1], shapeOffsetWorld[2],
    detailOffsetWorld[0], detailOffsetWorld[1], detailOffsetWorld[2],
    weatherOffsetWorld[0], weatherOffsetWorld[1], weatherOffsetWorld[2],
    shapeScale, detailScale, weatherScale,
    shapeAxisScale[0], shapeAxisScale[1], shapeAxisScale[2],
    detailAxisScale[0], detailAxisScale[1], detailAxisScale[2],
    weatherAxisScale[0], weatherAxisScale[1], weatherAxisScale[2],
    shapeBias, detailBias, weatherBias,
  ].map((v) => signatureScalar(v, 6)).join("|");
}

function pushTransformsToCloudBuilder() {
  if (!cb) return;

  const sig = transformStateSignature();
  if (sig === lastNoiseTransformSignature) return;

  const t = {
    shapeOffsetWorld,
    detailOffsetWorld,
    weatherOffsetWorld,
    shapeScale,
    detailScale,
    weatherScale,
    shapeAxisScale,
    detailAxisScale,
    weatherAxisScale,
    shapeBias,
    detailBias,
    weatherBias,
  };

  if (typeof cb.setNoiseTransforms === "function") cb.setNoiseTransforms(t);
  else if (typeof cb.setTileScaling === "function") cb.setTileScaling(t);
  else cb.noiseTransforms = t;
  lastNoiseTransformSignature = sig;
}

function syncBaseInputMaps() {
  if (!cb) return;
  const weatherView = noise.weather.arrayView;
  const blueView = noise.blue.arrayView;
  const shape3DView = noise.shape128.view3D;
  const detail3DView = noise.detail32.view3D;

  if (
    weatherView === lastBaseWeatherView &&
    blueView === lastBaseBlueView &&
    shape3DView === lastBaseShapeView &&
    detail3DView === lastBaseDetailView
  ) {
    return;
  }

  cb.setInputMaps({
    weatherView,
    blueView,
    shape3DView,
    detail3DView,
  });

  lastBaseWeatherView = weatherView;
  lastBaseBlueView = blueView;
  lastBaseShapeView = shape3DView;
  lastBaseDetailView = detail3DView;
}

function snapshotTransforms() {
  return {
    shapeOffsetWorld: shapeOffsetWorld.slice(0, 3),
    detailOffsetWorld: detailOffsetWorld.slice(0, 3),
    weatherOffsetWorld: weatherOffsetWorld.slice(0, 3),
    shapeScale,
    detailScale,
    weatherScale,
    shapeAxisScale: shapeAxisScale.slice(0, 3),
    detailAxisScale: detailAxisScale.slice(0, 3),
    weatherAxisScale: weatherAxisScale.slice(0, 3),
    shapeBias,
    detailBias,
    weatherBias,
    shapeVel: shapeVel.slice(0, 3),
    detailVel: detailVel.slice(0, 3),
    weatherVel: weatherVel.slice(0, 3),
  };
}

// -----------------------------------------------------------------------------
// reproj normalization
// -----------------------------------------------------------------------------
function normalizeTemporalCellRate(value) {
  const n = Math.max(1, Number(value) | 0);
  if (n >= 64) return 64;
  if (n >= 32) return 32;
  if (n >= 16) return 16;
  if (n >= 8) return 8;
  if (n >= 4) return 4;
  if (n >= 2) return 2;
  return 1;
}

function normalizeReproj(r) {
  if (!r) return null;

  const out = {
    enabled: (r.enabled ? 1 : 0) >>> 0,
    subsample: (r.subsample ? r.subsample >>> 0 : 0) >>> 0,
    sampleOffset: (r.sampleOffset ? r.sampleOffset >>> 0 : 0) >>> 0,
    motionIsNormalized: (r.motionIsNormalized ? 1 : 0) >>> 0,
    temporalBlend: typeof r.temporalBlend === "number" ? r.temporalBlend : ((r.enabled ? 0.9 : 0.0)),
    depthTest: (r.depthTest ? 1 : 0) >>> 0,
    depthTolerance: typeof r.depthTolerance === "number" ? r.depthTolerance : 0.0,
    frameIndex: (r.frameIndex ? r.frameIndex >>> 0 : 0) >>> 0,
    fullWidth: r.fullWidth ? r.fullWidth >>> 0 : undefined,
    fullHeight: r.fullHeight ? r.fullHeight >>> 0 : undefined,
    temporalCellRate: normalizeTemporalCellRate(r.temporalCellRate),
    temporalCellPhase: r.temporalCellPhase ? r.temporalCellPhase >>> 0 : 0,
    compactInterleave: r.compactInterleave ? 1 : 0,
    scale: typeof r.scale === "number" ? r.scale : undefined,
    coarseFactor: typeof r.coarseFactor === "number" ? Math.max(1, r.coarseFactor | 0) : undefined,
  };

  if (out.coarseFactor !== undefined) out.subsample = out.coarseFactor >>> 0;
  else if (out.scale !== undefined) {
    const s = Math.max(1e-6, out.scale);
    const ss = Math.max(1, Math.round(Math.sqrt(1.0 / s)));
    out.subsample = ss >>> 0;
  }

  if (!out.subsample || out.subsample < 1) out.subsample = 1;
  out.sampleOffset = out.sampleOffset >>> 0;
  return out;
}

function getReprojCoarseFactor(r, fallback = 1) {
  const rp = r && typeof r === "object" ? r : null;
  return Math.max(1, (rp?.coarseFactor || rp?.subsample || fallback || 1) | 0);
}

function normalizeRenderScaleDivider(value, fallback = 3) {
  const v = Number.isFinite(+value) ? Math.floor(+value) : fallback;
  return Math.max(1, Math.min(8, v));
}

function previewRenderScaleDivider(preview) {
  return normalizeRenderScaleDivider(preview?.renderScaleDivider, 3);
}

function renderScaleDividerCoarseFactor(preview, reprojecting = false) {
  return previewRenderScaleDivider(preview);
}

function finiteNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function previewCloudBox(preview = {}) {
  const box = preview.box || {};
  const center = Array.isArray(box.center) ? box.center : [0, 0, 0];
  const half = Array.isArray(box.half) ? box.half : [18, 0.3, 18];
  return {
    center: [
      finiteNumber(center[0], 0),
      finiteNumber(center[1], 0),
      finiteNumber(center[2], 0),
    ],
    half: [
      Math.max(0.001, finiteNumber(half[0], 18)),
      Math.max(0.001, finiteNumber(half[1], 0.3)),
      Math.max(0.001, finiteNumber(half[2], 18)),
    ],
    uvScale: Math.max(0.001, finiteNumber(box.uvScale, 1)),
  };
}

function signatureScalar(v, digits = 5) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const scale = 10 ** digits;
  return Math.round(n * scale) / scale;
}

function signatureValue(v) {
  if (Array.isArray(v)) return v.map((x) => signatureValue(x));
  if (v && typeof v === "object") {
    return Object.keys(v)
      .sort()
      .map((k) => [k, signatureValue(v[k])]);
  }
  return typeof v === "number" ? signatureScalar(v) : v;
}

function cloudSceneSignature(box, params) {
  return JSON.stringify({
    box: signatureValue(box),
    params: signatureValue(params || {}),
  });
}

function cloudViewSignature(preview, box, aspect) {
  const cam = preview?.cam || {};
  const sun = preview?.sun || {};
  return JSON.stringify({
    cam: {
      x: signatureScalar(cam.x || 0),
      y: signatureScalar(cam.y || 0),
      z: signatureScalar(cam.z || 0),
      yawDeg: signatureScalar(cam.yawDeg || 0),
      pitchDeg: signatureScalar(cam.pitchDeg || 0),
      fovYDeg: signatureScalar(cam.fovYDeg || 60),
      aspect: signatureScalar(aspect),
    },
    sun: {
      azDeg: signatureScalar(sun.azDeg || 0),
      elDeg: signatureScalar(sun.elDeg || 0),
    },
    boxY: [
      signatureScalar(box.center[1] - box.half[1]),
      signatureScalar(box.center[1] + box.half[1]),
      signatureScalar(box.uvScale),
    ],
  });
}

function renderUniformSignature(preview, aspect, layerIndex) {
  return JSON.stringify({
    layerIndex,
    cam: signatureValue(preview?.cam || {}),
    sun: signatureValue(preview?.sun || {}),
    aspect: signatureScalar(aspect),
    exposure: signatureScalar(preview?.exposure || 1.0),
    sky: signatureValue(preview?.sky || [0.5, 0.6, 0.8]),
    gradeStyle: preview?.gradeStyle ?? 1,
    sunTint: signatureValue(preview?.sunTint || [1.0, 1.0, 1.0]),
    cloudLitTint: signatureValue(preview?.cloudLitTint || [1.0, 1.0, 1.0]),
    cloudShadowTint: signatureValue(preview?.cloudShadowTint || [1.0, 1.0, 1.0]),
    edgeTint: signatureValue(preview?.edgeTint || [1.0, 1.0, 1.0]),
    styleShadowStrength: signatureScalar(preview?.styleShadowStrength ?? 0.88),
    styleShadowEdge: signatureScalar(preview?.styleShadowEdge ?? 0.0),
    styleShadowDarkness: signatureScalar(preview?.styleShadowDarkness ?? 0.0),
    styleColorLift: signatureScalar(preview?.styleColorLift ?? 1.12),
    styleSaturation: signatureScalar(preview?.styleSaturation ?? 1.10),
    styleRimStrength: signatureScalar(preview?.styleRimStrength ?? 1.0),
    styleSunBleed: signatureScalar(preview?.styleSunBleed ?? 0.85),
    styleMidLift: signatureScalar(preview?.styleMidLift ?? 1.10),
    godRaysEnabled: !!preview?.godRaysEnabled,
    godRayStrength: signatureScalar(preview?.godRayStrength ?? 0.0),
    godRayLength: signatureScalar(preview?.godRayLength ?? 1.0),
    godRayFalloff: signatureScalar(preview?.godRayFalloff ?? 1.55),
    alphaFloor: signatureScalar(preview?.alphaFloor ?? 0.085),
  });
}

function resetFrameStateCaches() {
  lastCloudSceneSignature = "";
  lastCloudViewSignature = "";
  lastRenderUniformSignature = "";
  lastNoiseTransformSignature = "";
  lastBaseWeatherView = null;
  lastBaseBlueView = null;
  lastBaseShapeView = null;
  lastBaseDetailView = null;
}


function smoothstep01(edge0, edge1, x) {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function autoThickBoxTuning(box) {
  const half = Array.isArray(box?.half) ? box.half : [18, 0.3, 18];
  const hx = Math.max(0.001, finiteNumber(half[0], 18));
  const hy = Math.max(0.001, finiteNumber(half[1], 0.3));
  const hz = Math.max(0.001, finiteNumber(half[2], 18));
  const xz = Math.max(hx, hz, 0.001);
  const height = Math.max(hy * 2, 0.001);

  const heightF = smoothstep01(0.85, 5.5, height);
  const aspectF = smoothstep01(0.045, 0.28, height / xz);
  const horizonF = smoothstep01(24, 120, xz);
  const thickF = Math.max(heightF, aspectF);
  const reachF = Math.max(thickF, horizonF * 0.85);

  return {
    thickBoxPerf: +(0.44 + reachF * 1.10).toFixed(4),
    thickStepBoost: +(1.22 + reachF * 1.38).toFixed(4),
    thickDetailSkip: +(0.040 + thickF * 0.10).toFixed(4),
    thickLightSkip: +(0.40 + reachF * 1.08).toFixed(4),
  };
}

function getDispatchReprojSettings(r, coarseFactor = 1) {
  if (!r) return null;
  const out = Object.assign({}, r);
  if (coarseFactor >= 2) {
    out.subsample = 1;
    out.sampleOffset = 0;
    out.temporalCellRate = normalizeTemporalCellRate(out.temporalCellRate);
    out.temporalCellPhase = out.temporalCellRate > 1 ? (out.temporalCellPhase >>> 0) % out.temporalCellRate : 0;
    out.compactInterleave = out.temporalCellRate > 1 ? 1 : 0;
    out.temporalBlend = 0.0;
    out.enabled = 0;
  }
  return out;
}

// -----------------------------------------------------------------------------
// render bundle cache
// -----------------------------------------------------------------------------
function makeRenderBundleKey(pipe, bg, samp, paramsBuffer, outView) {
  const getId =
    cb && typeof cb._getResId === "function"
      ? cb._getResId.bind(cb)
      : (o) => String(o);
  return [pipe, bg, samp, paramsBuffer, outView].map(getId).join("|");
}

function getOrCreateRenderBundle(pipe, bgl, samp, format) {
  const bg = cb._getOrCreateRenderBindGroup(canvasMain, bgl, samp);
  const sourceView = typeof cb._getRenderSourceView === "function" ? cb._getRenderSourceView() : cb.outView;
  const bundleKey = makeRenderBundleKey(pipe, bg, samp, cb.renderParams, sourceView);

  if (renderBundleCache.has(bundleKey)) return { bundle: renderBundleCache.get(bundleKey), bg };

  const rbe = device.createRenderBundleEncoder({ colorFormats: [format] });
  rbe.setPipeline(pipe);
  rbe.setBindGroup(0, bg);
  rbe.draw(6, 1, 0, 0);
  const bundle = rbe.finish();

  renderBundleCache.set(bundleKey, bundle);
  if (renderBundleCache.size > 12) {
    const first = renderBundleCache.keys().next().value;
    renderBundleCache.delete(first);
  }
  return { bundle, bg };
}

// -----------------------------------------------------------------------------
// tuning merge/apply
// -----------------------------------------------------------------------------
function mergeTuningPatch(patch) {
  if (!patch) return;
  if (!workerTuning) workerTuning = {};
  let changed = false;

  for (const k of Object.keys(patch)) {
    const newRaw = patch[k];
    const v =
      typeof newRaw === "string" && newRaw.trim() !== "" && !Number.isNaN(Number(newRaw))
        ? Number(newRaw)
        : newRaw;

    const prev = workerTuning[k];
    const isDifferent = prev !== v && !(Number.isNaN(prev) && Number.isNaN(v));
    if (isDifferent) {
      workerTuning[k] = v;
      changed = true;
    } else {
      workerTuning[k] = v;
    }
  }

  if (changed) workerTuningVersion = (workerTuningVersion + 1) >>> 0;
}

function applyWorkerTuning(cloudBox = null) {
  const base = workerTuning && typeof workerTuning === "object" ? workerTuning : {};
  const autoThick = autoThickBoxTuning(cloudBox || previewCloudBox(lastRunPayload?.preview || {}));
  const appliedTuning = Object.assign({}, base, autoThick);
  const tuningSignature = JSON.stringify([
    workerTuningVersion,
    autoThick.thickBoxPerf,
    autoThick.thickStepBoost,
    autoThick.thickDetailSkip,
    autoThick.thickLightSkip,
  ]);

  if (tuningSignature === lastAppliedTuningSignature) return false;

  try {
    if (cb && typeof cb.setTuning === "function") {
      cb.setTuning(appliedTuning);
      lastAppliedTuningVersion = workerTuningVersion;
      lastAppliedTuningSignature = tuningSignature;

      if (typeof appliedTuning.lodBiasWeather === "number" && typeof cb?.setPerfParams === "function") {
        cb.setPerfParams({
          lodBiasMul: appliedTuning.lodBiasWeather,
          coarseMipBias: 0.0,
        });
      }
      return true;
    }
    return false;
  } catch (e) {
    console.warn("applyWorkerTuning failed", e);
    log("[TUNING] apply failed", String(e));
    return false;
  }
}

// -----------------------------------------------------------------------------
// math
// -----------------------------------------------------------------------------
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function norm(a) {
  const L = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / L, a[1] / L, a[2] / L];
}

function roundSig(v, scale = 10000) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * scale) / scale : 0;
}

function makeColorSignatureArray(arr, fallback = [1, 1, 1]) {
  const a = Array.isArray(arr) ? arr : fallback;
  return [roundSig(a[0], 1000), roundSig(a[1], 1000), roundSig(a[2], 1000)];
}

function makeViewSignature(preview, w, h) {
  const cam = preview?.cam || {};
  const sun = preview?.sun || {};
  return [
    roundSig(cam.x),
    roundSig(cam.y),
    roundSig(cam.z),
    roundSig(cam.yawDeg),
    roundSig(cam.pitchDeg),
    roundSig(cam.fovYDeg),
    roundSig(sun.azDeg),
    roundSig(sun.elDeg),
    roundSig(sun.bloom, 1000),
    roundSig(preview?.exposure, 1000),
    previewRenderScaleDivider(preview, true),
    preview?.gradeStyle ?? 0,
    ...makeColorSignatureArray(preview?.sky, [0.5, 0.6, 0.8]),
    ...makeColorSignatureArray(preview?.sunTint, [1, 1, 1]),
    ...makeColorSignatureArray(preview?.cloudLitTint, [1, 1, 1]),
    ...makeColorSignatureArray(preview?.cloudShadowTint, [1, 1, 1]),
    ...makeColorSignatureArray(preview?.edgeTint, [1, 1, 1]),
    roundSig(preview?.styleShadowStrength ?? 0.88, 1000),
    roundSig(preview?.styleShadowEdge ?? 0.0, 1000),
    roundSig(preview?.styleShadowDarkness ?? 0.0, 1000),
    roundSig(preview?.styleColorLift ?? 1.12, 1000),
    roundSig(preview?.styleSaturation ?? 1.10, 1000),
    roundSig(preview?.styleRimStrength ?? 1.0, 1000),
    roundSig(preview?.styleSunBleed ?? 0.85, 1000),
    roundSig(preview?.styleMidLift ?? 1.10, 1000),
    preview?.godRaysEnabled ? 1 : 0,
    normalizeTemporalCellRate(preview?.temporalCellRate ?? 1),
    roundSig(preview?.godRayStrength ?? 0.0, 1000),
    roundSig(preview?.godRayLength ?? 1.0, 1000),
    roundSig(preview?.godRayFalloff ?? 1.55, 1000),
    w | 0,
    h | 0,
  ].join('|');
}

function invalidateReprojectionHistory() {
  historyPrevView = null;
  historyOutView = historyUsesAasOut ? historyViewA : historyViewB;
  reprojResetFrames = Math.max(reprojResetFrames, CAMERA_RESET_FRAMES);
  if (workerReproj) {
    workerReproj.frameIndex = 0;
    workerReproj.sampleOffset = 0;
    workerReproj.temporalCellPhase = 0;
  }
}

function updateViewInvalidation(preview) {
  const sig = makeViewSignature(preview, MAIN_W, MAIN_H);
  if (lastViewSignature === null) {
    lastViewSignature = sig;
    return false;
  }
  if (sig !== lastViewSignature) {
    lastViewSignature = sig;
    invalidateReprojectionHistory();
    return true;
  }
  return false;
}

function cloneReprojForReset(r) {
  if (!r) return null;
  return Object.assign({}, r, {
    enabled: r.enabled ? 1 : 0,
    sampleOffset: 0,
    temporalBlend: 0.0,
    frameIndex: 0,
    temporalCellPhase: 0,
    compactInterleave: 0,
  });
}

// -----------------------------------------------------------------------------
// runFrame
// -----------------------------------------------------------------------------
async function runFrame({
  weatherParams,
  billowParams,
  weatherBParams,
  shapeParams,
  detailParams,
  tileTransforms,
  noiseTransforms,
  preview,
  cloudParams,
  reproj = null,
  perf = null,
  motionImage = null,
  depthImage = null,
  coarseFactor = 1,
  tuning = null,
  waitForGpu = false,
  logFrame = false,
} = {}) {
  await ensureDevice();

  try {
    const loopSafeReproj =
      reproj && typeof reproj === "object"
        ? Object.assign({}, reproj, { resetHistory: false })
        : reproj;
    lastRunPayload = {
      weatherParams,
      billowParams,
      weatherBParams,
      shapeParams,
      detailParams,
      tileTransforms,
      noiseTransforms,
      preview,
      cloudParams,
      reproj: loopSafeReproj,
      perf,
      motionImage,
      depthImage,
      coarseFactor,
      tuning,
      waitForGpu,
      logFrame,
    };
  } catch {}

  if (tuning && typeof tuning === "object") mergeTuningPatch(tuning);
  const cloudBox = previewCloudBox(preview);
  applyWorkerTuning(cloudBox);

  if (tileTransforms && typeof tileTransforms === "object") {
    applyNoiseTransforms(tileTransforms, {
      allowPositions: tileTransforms.explicit ? true : false,
      allowScale: true,
      allowVel: true,
      additive: !!tileTransforms.additive,
    });
  }
  if (noiseTransforms && typeof noiseTransforms === "object") {
    applyNoiseTransforms(noiseTransforms, {
      allowPositions: true,
      allowScale: true,
      allowVel: true,
      additive: !!noiseTransforms.additive,
    });
  }

  pushTransformsToCloudBuilder();

  const cameraChanged = updateViewInvalidation(preview);

  if (reproj) {
    const nextReproj = normalizeReproj(reproj);
    if (workerReproj && nextReproj && !reproj.resetHistory && nextReproj.enabled && nextReproj.frameIndex === 0 && workerReproj.frameIndex > 0) {
      nextReproj.frameIndex = workerReproj.frameIndex >>> 0;
      nextReproj.sampleOffset = workerReproj.sampleOffset >>> 0;
      nextReproj.temporalCellPhase = workerReproj.temporalCellPhase >>> 0;
    }
    workerReproj = nextReproj;
    if (reproj.resetHistory) invalidateReprojectionHistory();
  }
  if (perf) workerPerf = perf;
  const hasTemporalHistory = !!(workerReproj && workerReproj.temporalBlend > 0.0001);
  if (cameraChanged && hasTemporalHistory) invalidateReprojectionHistory();

  if (!noise.weather.arrayView) await bakeWeather2D(weatherParams, true, billowParams, weatherBParams);
  if (!noise.blue.arrayView) await bakeBlue2D({}, true);
  if (!noise.shape128.view3D) await bakeShape128(shapeParams, true);
  if (!noise.detail32.view3D) await bakeDetail32(detailParams, true);

  syncBaseInputMaps();

  const workerTemporalCellRate = normalizeTemporalCellRate(workerReproj?.temporalCellRate);
  let effectiveCoarseFactor = Math.max(1, coarseFactor | 0, renderScaleDividerCoarseFactor(preview, !!workerReproj));
  const coarseComputeMode = effectiveCoarseFactor >= 2;
  const useReproj = !!(workerReproj && workerReproj.enabled && !coarseComputeMode);
  const useTemporalCells = workerTemporalCellRate > 1;
  const useFullResTemporalBlend = !!(workerReproj && !coarseComputeMode && workerReproj.temporalBlend > 0.0001);
  const useCoarseInterleave = !!(workerReproj && coarseComputeMode && useTemporalCells);
  const useTemporalHistory = !!(workerReproj && (useFullResTemporalBlend || useTemporalCells || useCoarseInterleave));
  const resetReprojThisFrame = useTemporalHistory && reprojResetFrames > 0;
  let effectiveReproj = workerReproj;
  if (resetReprojThisFrame) {
    effectiveReproj = cloneReprojForReset(workerReproj);
    historyPrevView = null;
  }

  if (useTemporalHistory) {
    if (!workerReproj && reproj) workerReproj = normalizeReproj(reproj);
    if (!effectiveReproj) effectiveReproj = workerReproj;
    if (effectiveReproj) {
      const ss = Math.max(1, effectiveReproj.subsample || 1);
      const cells = ss * ss;
      if (!(effectiveReproj.frameIndex === 0 && !historyPrevView)) {
        effectiveReproj.frameIndex = ((effectiveReproj.frameIndex || 0) + 1) >>> 0;
        effectiveReproj.sampleOffset = (effectiveReproj.frameIndex % cells) >>> 0;
        const temporalCellRate = normalizeTemporalCellRate(effectiveReproj.temporalCellRate);
        effectiveReproj.temporalCellRate = temporalCellRate;
        // True temporal interleave rotates the owner phase. Non-owner pixels
        // reuse and copy forward full-resolution history in the cloud shader.
        effectiveReproj.temporalCellPhase = temporalCellRate > 1 ? (effectiveReproj.frameIndex % temporalCellRate) >>> 0 : 0;
        if (workerReproj) {
          workerReproj.frameIndex = effectiveReproj.frameIndex >>> 0;
          workerReproj.sampleOffset = effectiveReproj.sampleOffset >>> 0;
          workerReproj.temporalCellRate = effectiveReproj.temporalCellRate >>> 0;
          workerReproj.temporalCellPhase = effectiveReproj.temporalCellPhase >>> 0;
        }
      }
    }
  }

  if (useTemporalHistory) {
    if (!workerReproj && reproj) workerReproj = normalizeReproj(reproj);
    if (!effectiveReproj) effectiveReproj = workerReproj;

    if (useReproj && motionImage) {
      try {
        motionTex?.destroy?.();
        motionTex = device.createTexture({
          size: [motionImage.width, motionImage.height, 1],
          format: "rg8unorm",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        queue.copyExternalImageToTexture({ source: motionImage }, { texture: motionTex }, [motionImage.width, motionImage.height, 1]);
        motionView = motionTex.createView({ dimension: "2d" });
      } catch (e) {
        console.warn("Failed to upload motionImage", e);
        motionView = null;
      }
    } else {
      motionView = null;
    }

    if (useReproj && depthImage) {
      try {
        depthTex?.destroy?.();
        depthTex = device.createTexture({
          size: [depthImage.width, depthImage.height, 1],
          format: "r8unorm",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        queue.copyExternalImageToTexture({ source: depthImage }, { texture: depthTex }, [depthImage.width, depthImage.height, 1]);
        depthView = depthTex.createView({ dimension: "2d" });
      } catch (e) {
        console.warn("Failed to upload depthImage", e);
        depthView = null;
      }
    } else {
      depthView = null;
    }

    const outputNeedsAlloc = !cb.outTexture || cb.width !== MAIN_W || cb.height !== MAIN_H || cb.layers !== 1;
    if (outputNeedsAlloc) await progressiveYield(mobileProfileEnabled, "Allocating cloud render targets...");
    cb.createOutputTexture(MAIN_W, MAIN_H, 1);

    const historyW = effectiveCoarseFactor >= 2 ? Math.max(1, Math.ceil(MAIN_W / effectiveCoarseFactor)) : (cb.width || MAIN_W);
    const historyH = effectiveCoarseFactor >= 2 ? Math.max(1, Math.ceil(MAIN_H / effectiveCoarseFactor)) : (cb.height || MAIN_H);
    const historyL = cb.layers || 1;
    const historyNeedsAlloc = !historyAllocated || historyTexWidth !== historyW || historyTexHeight !== historyH || historyTexLayers !== historyL;
    if (historyNeedsAlloc) await progressiveYield(mobileProfileEnabled, "Allocating temporal history...");
    ensureHistoryTextures(historyW, historyH, historyL);

    historyOutView = historyUsesAasOut ? historyViewA : historyViewB;

    cb.setInputMaps({
      motionView: motionView || null,
      depthPrevView: depthView || null,
      historyPrevView: historyPrevView || null,
    });

    cb.setHistoryOutView(historyOutView);

    if (workerPerf) cb.setPerfParams(workerPerf);
    if (effectiveReproj) {
      effectiveReproj.coarseFactor = 1;
      effectiveReproj.scale = 1.0;
      effectiveReproj.temporalCellRate = normalizeTemporalCellRate(effectiveReproj.temporalCellRate);
      effectiveReproj.temporalCellPhase = effectiveReproj.temporalCellRate > 1
        ? (effectiveReproj.frameIndex % effectiveReproj.temporalCellRate) >>> 0
        : 0;
      cb.setReprojSettings(getDispatchReprojSettings(effectiveReproj, effectiveCoarseFactor));
    }
  } else {
    cb.setInputMaps({
      motionView: null,
      depthPrevView: null,
      historyPrevView: null,
    });
    cb.setHistoryOutView(null);
    cb.setReprojSettings({
      enabled: 0,
      subsample: 1,
      sampleOffset: 0,
      temporalBlend: 0.0,
      frameIndex: 0,
      fullWidth: MAIN_W,
      fullHeight: MAIN_H,
      temporalCellRate: 1,
      temporalCellPhase: 0,
      compactInterleave: 0,
    });
  }

  const cloudSig = cloudSceneSignature(cloudBox, cloudParams || {});
  if (cloudSig !== lastCloudSceneSignature) {
    cb.setBox(cloudBox);
    cb.setParams(cloudParams || {});
    lastCloudSceneSignature = cloudSig;
  }

  const deg2rad = (d) => (d * Math.PI) / 180;
  const yaw = deg2rad(preview?.cam?.yawDeg || 0);
  const pit = deg2rad(preview?.cam?.pitchDeg || 0);

  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pit),
    sp = Math.sin(pit);

  const fwd = norm([sy * cp, sp, cy * cp]);
  const upRef = Math.abs(dot(fwd, [0, 1, 0])) > 0.999 ? [0, 0, 1] : [0, 1, 0];
  const right = norm(cross(upRef, fwd));
  const up = cross(fwd, right);

  const aspect = Math.max(1e-6, MAIN_W / Math.max(1, MAIN_H));

  const sAz = deg2rad(preview?.sun?.azDeg || 0);
  const sEl = deg2rad(preview?.sun?.elDeg || 0);
  const cel = Math.cos(sEl);
  const sunDir = norm([cel * Math.sin(sAz), Math.sin(sEl), cel * Math.cos(sAz)]);

  const viewSig = cloudViewSignature(preview, cloudBox, aspect);
  if (viewSig !== lastCloudViewSignature) {
    cb.setViewFromCamera({
      camPos: [preview?.cam?.x || 0, preview?.cam?.y || 0, preview?.cam?.z || 0],
      right,
      up,
      fwd,
      fovYDeg: preview?.cam?.fovYDeg || 60,
      aspect,
      planetRadius: 0.0,
      cloudBottom: cloudBox.center[1] - cloudBox.half[1],
      cloudTop: cloudBox.center[1] + cloudBox.half[1],
      worldToUV: cloudBox.uvScale,
      stepBase: 0.02,
      stepInc: 0.04,
      volumeLayers: 1,
    });

    cb.setLight({
      sunDir,
      camPos: [preview?.cam?.x || 0, preview?.cam?.y || 0, preview?.cam?.z || 0],
    });

    cb.setOptions({ writeRGB: true, outputChannel: 0, debugForceFog: 0 });
    lastCloudViewSignature = viewSig;
  }

  if (!useTemporalHistory) {
    const outputNeedsAlloc = !cb.outTexture || cb.width !== MAIN_W || cb.height !== MAIN_H || cb.layers !== 1;
    if (outputNeedsAlloc) await progressiveYield(mobileProfileEnabled, "Allocating cloud render target...");
    cb.createOutputTexture(MAIN_W, MAIN_H, 1);
  }

  const shouldWaitForGpu = !!waitForGpu;
  const tAll0 = performance.now();
  if (shouldWaitForGpu && typeof queue.onSubmittedWorkDone === "function") {
    await queue.onSubmittedWorkDone();
  }

  const cf = Math.max(1, effectiveCoarseFactor | 0);
  const enc = device.createCommandEncoder();
  const tC0 = performance.now();
  const skipUpsampleForPreview = false;
  const encodedDispatch =
    typeof cb.encodeDispatchPasses === "function"
      ? cb.encodeDispatchPasses(enc, { coarseFactor: cf, skipUpsampleForPreview })
      : null;
  if (!encodedDispatch) {
    throw new Error("CloudComputeBuilder.encodeDispatchPasses is required for fused frame submission.");
  }
  const tC1 = performance.now();

  const renderFastPreview = false;
  const presentDivider = previewPresentDivider(preview, cf, renderFastPreview);
  const presentW = Math.max(1, Math.ceil(MAIN_W / presentDivider));
  const presentH = Math.max(1, Math.ceil(MAIN_H / presentDivider));
  ensureMainPresentSize(presentW, presentH);

  const { pipe, bgl, samp, format } = cb._ensureRenderPipeline("bgra8unorm");

  const layerIndex = Math.max(0, Math.min((cb?.layers || 1) - 1, preview?.layer || 0));
  const renderSig = renderUniformSignature(preview, aspect, layerIndex);
  if (renderSig !== lastRenderUniformSignature) {
    cb._writeRenderUniforms({
      layerIndex,
      cam: {
        camPos: [preview?.cam?.x || 0, preview?.cam?.y || 0, preview?.cam?.z || 0],
        right,
        up,
        fwd,
        fovYDeg: preview?.cam?.fovYDeg || 60,
        aspect,
      },
      sunDir,
      exposure: preview?.exposure || 1.0,
      skyColor: preview?.sky || [0.5, 0.6, 0.8],
      sunBloom: preview?.sun?.bloom || 0.0,
      compositeQuality: renderFastPreview ? 0 : 2,
      gradeStyle: preview?.gradeStyle ?? 1,
      sunColorTint: preview?.sunTint || [1.0, 1.0, 1.0],
      lightTint: preview?.cloudLitTint || [1.0, 1.0, 1.0],
      shadowTint: preview?.cloudShadowTint || [1.0, 1.0, 1.0],
      edgeTint: preview?.edgeTint || [1.0, 1.0, 1.0],
      styleShadowStrength: preview?.styleShadowStrength ?? 0.88,
      styleShadowEdge: preview?.styleShadowEdge ?? 0.0,
      styleShadowDarkness: preview?.styleShadowDarkness ?? 0.0,
      styleColorLift: preview?.styleColorLift ?? 1.12,
      styleSaturation: preview?.styleSaturation ?? 1.10,
      styleRimStrength: preview?.styleRimStrength ?? 1.0,
      styleSunBleed: preview?.styleSunBleed ?? 0.85,
      styleMidLift: preview?.styleMidLift ?? 1.10,
      godRaysEnabled: !!preview?.godRaysEnabled,
      godRayStrength: (preview?.godRayStrength ?? 0.0) * (renderFastPreview ? 0.78 : 1.0),
      godRayLength: (preview?.godRayLength ?? 1.0) * (renderFastPreview ? 0.90 : 1.0),
      godRayFalloff: preview?.godRayFalloff ?? 1.55,
      alphaFloor: preview?.alphaFloor ?? 0.085,
    });
    lastRenderUniformSignature = renderSig;
  }

  const tR0 = performance.now();
  const { bundle } = getOrCreateRenderBundle(pipe, bgl, samp, format);

  const tex = ctxMain.getCurrentTexture();
  const pass = enc.beginRenderPass({
    colorAttachments: [
      {
        view: tex.createView(),
        loadOp: "clear",
        clearValue: {
          r: preview?.sky?.[0] ?? 0.5,
          g: preview?.sky?.[1] ?? 0.6,
          b: preview?.sky?.[2] ?? 0.8,
          a: 1,
        },
        storeOp: "store",
      },
    ],
  });
  pass.executeBundles([bundle]);
  pass.end();

  const tSubmit0 = performance.now();
  queue.submit([enc.finish()]);
  encodedDispatch.restoreAfterSubmit?.();

  if (useTemporalHistory && historyAllocated) {
    historyPrevView = historyOutView;
    historyUsesAasOut = !historyUsesAasOut;
    historyOutView = historyUsesAasOut ? historyViewA : historyViewB;

    cb.setInputMaps({ historyPrevView });
    cb.setHistoryOutView(historyOutView);
    if (resetReprojThisFrame) {
      reprojResetFrames = Math.max(0, reprojResetFrames - 1);
      if (workerReproj) {
        workerReproj.frameIndex = 0;
        workerReproj.sampleOffset = 0;
        workerReproj.temporalCellPhase = 0;
      }
    }
  }
  const tSubmit1 = performance.now();
  const tR1 = performance.now();

  const tWait0 = performance.now();
  if (shouldWaitForGpu && typeof queue.onSubmittedWorkDone === "function") {
    await queue.onSubmittedWorkDone();
  }
  const tWait1 = performance.now();
  const tAll1 = performance.now();

  submittedFrameCount = (submittedFrameCount + 1) >>> 0;

  const timings = {
    computeMs: tC1 - tC0,
    renderMs: tR1 - tR0,
    submitMs: tSubmit1 - tSubmit0,
    gpuWaitMs: tWait1 - tWait0,
    totalMs: tAll1 - tAll0,
    waitedForGpu: shouldWaitForGpu,
    coarseFactor: cf,
    directPreview: !!encodedDispatch.directPreview,
    presentDivider,
    presentWidth: presentW,
    presentHeight: presentH,
    resetReprojection: resetReprojThisFrame,
    temporalCellRate: workerTemporalCellRate,
    temporalCellPhase: workerReproj?.temporalCellPhase ?? 0,
    interleaveStats: encodedDispatch.interleaveStats || null,
    frame: submittedFrameCount,
  };

  if (shouldWaitForGpu || logFrame || submittedFrameCount % FRAME_LOG_EVERY === 0) {
    log(
      shouldWaitForGpu ? "[BENCH waited]" : "[BENCH submitted]",
      "compute(ms):",
      timings.computeMs.toFixed(2),
      "render-encode(ms):",
      timings.renderMs.toFixed(2),
      "submit(ms):",
      (timings.submitMs || 0).toFixed(2),
      "gpu-wait(ms):",
      (timings.gpuWaitMs || 0).toFixed(2),
      "total(ms):",
      timings.totalMs.toFixed(2),
      "coarseFactor:",
      cf,
      "directPreview:",
      !!encodedDispatch.directPreview,
      "temporalCellRate:",
      workerTemporalCellRate,
      "interleave:",
      timings.interleaveStats
        ? `${timings.interleaveStats.updatedPixels}/${timings.interleaveStats.totalPixels} tile=${timings.interleaveStats.tile}`
        : "n/a",
    );
  }

  return timings;
}

// -----------------------------------------------------------------------------
// animation loop
// -----------------------------------------------------------------------------
function enqueueLoopGpuFence() {
  if (!queue || typeof queue.onSubmittedWorkDone !== "function") return;
  const fence = queue.onSubmittedWorkDone().catch(() => {});
  loopGpuFences.push(fence);
  if (loopGpuFences.length > LOOP_MAX_GPU_FRAMES_IN_FLIGHT + 2) {
    loopGpuFences.splice(0, loopGpuFences.length - (LOOP_MAX_GPU_FRAMES_IN_FLIGHT + 2));
  }
}

async function waitForLoopGpuBackpressure(targetInFlight = LOOP_MAX_GPU_FRAMES_IN_FLIGHT - 1) {
  if (!loopGpuFences.length) return;
  const target = Math.max(0, targetInFlight | 0);
  while (loopGpuFences.length > target) {
    const fence = loopGpuFences.shift();
    try {
      await fence;
    } catch {}
  }
}

function startLoop() {
  if (loopRunning) return;

  if (!lastRunPayload) {
    log("startLoop: no last run payload; call runFrame once first.");
    loopEnabled = true;
    return;
  }

  loopEnabled = true;
  loopGpuFences.length = 0;
  loopRunning = true;

  if (workerReproj && workerReproj.temporalBlend > 0.0001 && !historyPrevView) {
    invalidateReprojectionHistory();
    reprojResetFrames = Math.max(reprojResetFrames, 1);
  }

  (async () => {
    log("animation loop started");

    let prevTime = performance.now();
    let lastPresentedTime = prevTime;
    let submitWindowStart = prevTime;
    let submitWindowFrames = 0;
    let lastStatsPostTime = 0;
    emaLoopFps = null;
    emaMaxRoundTripFps = null;
    if (workerReproj && workerReproj.enabled) {
      workerReproj = normalizeReproj(workerReproj);
      workerReproj.frameIndex = workerReproj.frameIndex >>> 0;
      workerReproj.sampleOffset = workerReproj.sampleOffset >>> 0;
    }

    while (loopEnabled) {
      if (pendingResizePayload) {
        try {
          await waitForLoopGpuBackpressure(1);
          await applyPendingResizeIfAny();
        } catch (resizeErr) {
          postMessage({ type: "log", data: ["animation resize apply failed", String(resizeErr)] });
        }
      }

      const t0 = performance.now();
      let timings = null;
      let submitFrameMs = Number.NaN;
      let frameOk = false;
      let workerFrameMs = Number.NaN;
      try {
        const dt = Math.max(0, (t0 - prevTime) / 1000);
        prevTime = t0;

        shapeOffsetWorld[0] += shapeVel[0] * dt;
        shapeOffsetWorld[1] += shapeVel[1] * dt;
        shapeOffsetWorld[2] += shapeVel[2] * dt;

        detailOffsetWorld[0] += detailVel[0] * dt;
        detailOffsetWorld[1] += detailVel[1] * dt;
        detailOffsetWorld[2] += detailVel[2] * dt;

        weatherOffsetWorld[0] += weatherVel[0] * dt;
        weatherOffsetWorld[1] += weatherVel[1] * dt;
        weatherOffsetWorld[2] += weatherVel[2] * dt;

        if (workerReproj && workerReproj.enabled) {
          workerReproj = normalizeReproj(workerReproj);
        }

        if (lastRunPayload) {
          lastRunPayload.tileTransforms = null;
          lastRunPayload.noiseTransforms = null;
          const loopUsesReproj = !!(workerReproj && workerReproj.enabled);
          const qCoarse = renderScaleDividerCoarseFactor(lastRunPayload.preview, loopUsesReproj);
          if (workerReproj) {
            lastRunPayload.reproj = Object.assign({}, workerReproj, { resetHistory: false });
            lastRunPayload.coarseFactor = Math.max(1, qCoarse | 0);
            lastRunPayload.reproj.coarseFactor = lastRunPayload.coarseFactor;
            lastRunPayload.reproj.scale = 1 / Math.max(1, lastRunPayload.coarseFactor * lastRunPayload.coarseFactor);
          } else {
            lastRunPayload.coarseFactor = Math.max(1, qCoarse | 0);
          }
          lastRunPayload.waitForGpu = false;
          lastRunPayload.logFrame = false;
        }

        await waitForLoopGpuBackpressure();
        timings = await runFrame(lastRunPayload);
        enqueueLoopGpuFence();
        submitFrameMs = performance.now() - t0 || timings.totalMs || 1;
        workerFrameMs = Math.max(
          0.001,
          timings?.totalMs || 0,
          (timings?.computeMs || 0) + (timings?.renderMs || 0) + (timings?.submitMs || 0),
          submitFrameMs,
        );
        frameOk = true;
        const maxWorkerFpsInst = 1000 / workerFrameMs;
        emaMaxRoundTripFps = emaMaxRoundTripFps === null
          ? maxWorkerFpsInst
          : emaMaxRoundTripFps * 0.82 + maxWorkerFpsInst * 0.18;

        submitWindowFrames += 1;
        const nowForSubmit = performance.now();
        if (nowForSubmit - submitWindowStart >= 250) {
          const submitFpsInst = (submitWindowFrames * 1000) / Math.max(1, nowForSubmit - submitWindowStart);
          emaSubmitFps = emaSubmitFps === null ? submitFpsInst : emaSubmitFps * 0.85 + submitFpsInst * 0.15;
          submitWindowStart = nowForSubmit;
          submitWindowFrames = 0;
        }
      } catch (err) {
        postMessage({ type: "log", data: ["animation loop error", String(err)] });
      }

      const elapsed = performance.now() - t0;
      const delay = Math.max(0, LOOP_TARGET_MS - elapsed);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      else await Promise.resolve();

      const presentedTime = performance.now();
      const cadenceMs = Math.max(0.001, presentedTime - lastPresentedTime);
      lastPresentedTime = presentedTime;
      const loopFpsInst = 1000 / cadenceMs;
      emaLoopFps = emaLoopFps === null ? loopFpsInst : emaLoopFps * 0.78 + loopFpsInst * 0.22;
      const nowForStats = performance.now();
      if (nowForStats - lastStatsPostTime >= 250) {
        lastStatsPostTime = nowForStats;
        postMessage({
          type: "frame",
          data: {
            fps: emaLoopFps,
            loopFps: emaLoopFps,
            maxRoundTripFps: emaMaxRoundTripFps,
            submitFps: emaSubmitFps,
            submitFrameMs,
            loopFrameMs: cadenceMs,
            workFrameMs: workerFrameMs,
            presentDivider: timings?.presentDivider,
            presentWidth: timings?.presentWidth,
            presentHeight: timings?.presentHeight,
            capFps: LOOP_TARGET_MS > 0 ? 1000 / LOOP_TARGET_MS : 0,
            frameOk,
            gpuQueueDepth: loopGpuFences.length,
            resetReprojection: lastRunPayload?.reproj?.resetHistory,
          },
        });
      }
    }

    loopRunning = false;
    log("animation loop stopped");
    postMessage({ type: "loop-stopped" });
  })();
}

function stopLoop() {
  loopEnabled = false;
  loopGpuFences.length = 0;
}

// -----------------------------------------------------------------------------
// RPC handlers (serialized)
// -----------------------------------------------------------------------------
let _serial = Promise.resolve();

self.onmessage = (ev) => {
  _serial = _serial
    .then(() => _handleMessage(ev))
    .catch((err) => {
      try {
        console.error(err);
      } catch {}
      try {
        postMessage({ type: "log", data: ["worker message error", String(err)] });
      } catch {}
    });
};

async function _handleMessage(ev) {
  const { id, type, payload } = ev.data || {};
  const respond = (ok, dataOrErr) =>
    postMessage({ id, ok, ...(ok ? { data: dataOrErr } : { error: String(dataOrErr) }) });

  try {
    if (type === "init") {
      const { canvases, constants } = payload;

      canvasMain = canvases.main;
      dbg.weather = canvases.dbg.weather;
      dbg.weatherG = canvases.dbg.weatherG;
      dbg.weatherB = canvases.dbg.weatherB || null;
      dbg.shapeR = canvases.dbg.shapeR;
      dbg.detailR = canvases.dbg.detailR;
      dbg.blue = canvases.dbg.blue;

      SHAPE_SIZE = constants.SHAPE_SIZE;
      DETAIL_SIZE = constants.DETAIL_SIZE;
      WEATHER_W = constants.WEATHER_W;
      WEATHER_H = constants.WEATHER_H;
      BN_W = constants.BN_W;
      BN_H = constants.BN_H;
      debugPreviewEnabled = constants.DEBUG_ENABLED !== false;
      mobileProfileEnabled = !!constants.MOBILE_PROFILE;

      await progressiveYield(true, "Starting WebGPU worker...");
      await ensureDevice();
      await progressiveYield(mobileProfileEnabled, "Configuring canvas...");
      configureMainContext();
      renderBundleCache.clear();
      resetFrameStateCaches();

      respond(true, {
        ok: true,
        entryPoints: Array.isArray(nb?.entryPoints) ? nb.entryPoints.slice() : [],
      });
      return;
    }

    if (type === "resize") {
      const incoming = Object.assign({}, payload || {}, { serial: ++pendingResizeSerial });
      const incomingSig = resizePayloadSignature(incoming);
      const currentSig = resizePayloadSignature({
        main: { width: MAIN_W, height: MAIN_H },
        dbg: { width: DBG_W, height: DBG_H },
        profile: lastResizeProfile,
      });

      if (incomingSig === currentSig && !pendingResizePayload) {
        respond(true, { ok: true, unchanged: true, serial: incoming.serial });
        return;
      }

      if (loopRunning) {
        pendingResizePayload = incoming;
        respond(true, { ok: true, queued: true, serial: incoming.serial });
        return;
      }

      const result = await applyResizePayloadNow(incoming);
      respond(true, result);
      return;
    }

    if (type === "bakeWeather") {
      await ensureDevice();
      const timings = await bakeWeather2D(
        payload.weatherParams || {},
        true,
        payload.billowParams || {},
        payload.weatherBParams || payload.weatherB || null,
      );
      invalidateReprojectionHistory();
      respond(true, { baked: "weather", timings });
      return;
    }

    if (type === "bakeBlue") {
      await ensureDevice();
      const timings = await bakeBlue2D(payload.blueParams || {}, true);
      invalidateReprojectionHistory();
      respond(true, { baked: "blue", timings });
      return;
    }

    if (type === "bakeShape") {
      await ensureDevice();
      if (payload?.tileTransforms) applyNoiseTransforms(payload.tileTransforms, { allowPositions: !!payload.tileTransforms.explicit, allowScale: true, allowVel: true, additive: !!payload.tileTransforms.additive });
      if (payload?.noiseTransforms) applyNoiseTransforms(payload.noiseTransforms, { allowPositions: true, allowScale: true, allowVel: true, additive: !!payload.noiseTransforms.additive });
      pushTransformsToCloudBuilder();
      noise.shape128.dirty = true;
      const timings = await bakeShape128(payload.shapeParams || {}, true);
      invalidateReprojectionHistory();
      respond(true, { baked: "shape128", timings });
      return;
    }

    if (type === "bakeDetail") {
      await ensureDevice();
      if (payload?.tileTransforms) applyNoiseTransforms(payload.tileTransforms, { allowPositions: !!payload.tileTransforms.explicit, allowScale: true, allowVel: true, additive: !!payload.tileTransforms.additive });
      if (payload?.noiseTransforms) applyNoiseTransforms(payload.noiseTransforms, { allowPositions: true, allowScale: true, allowVel: true, additive: !!payload.noiseTransforms.additive });
      pushTransformsToCloudBuilder();
      noise.detail32.dirty = true;
      const timings = await bakeDetail32(payload.detailParams || {}, true);
      invalidateReprojectionHistory();
      respond(true, { baked: "detail32", timings });
      return;
    }

    if (type === "bakeAll") {
      await ensureDevice();
      const t0 = performance.now();
      const progressive = !!payload?.progressive;
      const prevDebugEnabled = debugPreviewEnabled;
      if (payload?.skipDebug === true) debugPreviewEnabled = false;

      try {
        if (payload?.tileTransforms) applyNoiseTransforms(payload.tileTransforms, { allowPositions: !!payload.tileTransforms.explicit, allowScale: true, allowVel: true, additive: !!payload.tileTransforms.additive });
        if (payload?.noiseTransforms) applyNoiseTransforms(payload.noiseTransforms, { allowPositions: true, allowScale: true, allowVel: true, additive: !!payload.noiseTransforms.additive });
        pushTransformsToCloudBuilder();

        await progressiveYield(progressive, "Baking weather map...");
        const weather = await bakeWeather2D(
          payload.weatherParams || {},
          true,
          payload.billowParams || {},
          payload.weatherBParams || payload.weatherB || null,
        );

        await progressiveYield(progressive, "Baking blue noise...");
        const blue = await bakeBlue2D(payload.blueParams || {}, true);

        await progressiveYield(progressive, `Baking shape volume ${SHAPE_SIZE}³...`);
        const shape = await bakeShape128(payload.shapeParams || {}, true);

        await progressiveYield(progressive, `Baking detail volume ${DETAIL_SIZE}³...`);
        const detail = await bakeDetail32(payload.detailParams || {}, true);

        await progressiveYield(progressive, "Preparing first frame...");
        const t1 = performance.now();
        invalidateReprojectionHistory();
        respond(true, { baked: "all", timings: { weather, blue, shape, detail, totalMs: t1 - t0 } });
      } finally {
        debugPreviewEnabled = prevDebugEnabled;
        if (debugPreviewEnabled) renderDebugIfEnabled();
      }
      return;
    }

    if (type === "setTileTransforms" || type === "setNoiseTransforms") {
      await ensureDevice();
      try {
        const tObj =
          type === "setNoiseTransforms"
            ? payload?.noiseTransforms || payload?.tileTransforms || payload || {}
            : payload?.tileTransforms || payload?.noiseTransforms || payload || {};

        applyNoiseTransforms(tObj, {
          allowPositions: true,
          allowScale: true,
          allowVel: true,
          additive: !!tObj.additive,
        });

        pushTransformsToCloudBuilder();

        try {
          if (lastRunPayload && !loopRunning) {
            const merged = Object.assign({}, lastRunPayload.tileTransforms || {});
            Object.assign(merged, snapshotTransforms(), { explicit: true });
            lastRunPayload.tileTransforms = merged;
          }
        } catch {}

        respond(true, { ok: true, transforms: snapshotTransforms() });
      } catch (err) {
        console.warn("setTileTransforms/setNoiseTransforms failed", err);
        respond(false, err);
      }
      return;
    }

    if (type === "setSlice") {
      currentSlice = Math.max(0, Math.min(SHAPE_SIZE - 1, payload.slice | 0));
      renderDebugSlices();
      respond(true, { slice: currentSlice });
      return;
    }

    if (type === "setReproj") {
      workerReproj = normalizeReproj(payload.reproj || null);
      workerPerf = payload.perf || workerPerf;

      if (workerReproj && workerReproj.temporalBlend > 0.0001 && payload?.reproj?.resetHistory) {
        workerReproj.frameIndex = 0;
        workerReproj.sampleOffset = 0;
        workerReproj.temporalCellPhase = 0;
        invalidateReprojectionHistory();
      }

      if (lastRunPayload) {
        lastRunPayload.reproj = workerReproj
          ? Object.assign({}, workerReproj, { resetHistory: false })
          : workerReproj;
        const qCoarse = renderScaleDividerCoarseFactor(lastRunPayload.preview, !!(workerReproj && (workerReproj.enabled || normalizeTemporalCellRate(workerReproj.temporalCellRate) > 1)));
        if (workerReproj) {
          lastRunPayload.coarseFactor = Math.max(1, qCoarse | 0);
          lastRunPayload.reproj.coarseFactor = lastRunPayload.coarseFactor;
          lastRunPayload.reproj.scale = 1 / Math.max(1, lastRunPayload.coarseFactor * lastRunPayload.coarseFactor);
        } else {
          lastRunPayload.coarseFactor = Math.max(1, qCoarse | 0);
        }
      }

      if (cb) {
        if (workerPerf) cb.setPerfParams(workerPerf);
        if (workerReproj) {
          const qCoarse = renderScaleDividerCoarseFactor(lastRunPayload?.preview, !!(workerReproj.enabled || normalizeTemporalCellRate(workerReproj.temporalCellRate) > 1));
          const cf = Math.max(1, qCoarse | 0);
          workerReproj.coarseFactor = cf;
          workerReproj.scale = 1 / Math.max(1, cf * cf);
          cb.setReprojSettings(getDispatchReprojSettings(workerReproj, cf));
        }
      }

      renderBundleCache.clear();
      if (!workerReproj || (!workerReproj.enabled && normalizeTemporalCellRate(workerReproj.temporalCellRate) <= 1)) stopLoop();

      respond(true, { ok: true, reproj: workerReproj, perf: workerPerf });
      return;
    }

    if (type === "setLiveFrameState") {
      await ensureDevice();
      try {
        const incomingPreview = payload?.preview || null;
        const incomingCloudParams = payload?.cloudParams || null;
        const incomingTuning = payload?.tuning || null;
        const incomingTransforms = payload?.tileTransforms || payload?.noiseTransforms || null;
        const incomingReproj = payload?.reproj || null;

        if (!lastRunPayload) {
          lastRunPayload = {
            preview: incomingPreview || {},
            cloudParams: incomingCloudParams || {},
            tileTransforms: incomingTransforms || null,
            reproj: incomingReproj || workerReproj || null,
            coarseFactor: renderScaleDividerCoarseFactor(incomingPreview || {}, true),
          };
        }

        if (incomingPreview && typeof incomingPreview === "object") {
          lastRunPayload.preview = Object.assign({}, lastRunPayload.preview || {}, incomingPreview);
        }

        if (incomingCloudParams && typeof incomingCloudParams === "object") {
          lastRunPayload.cloudParams = incomingCloudParams;
        }

        if (incomingTuning && typeof incomingTuning === "object") {
          mergeTuningPatch(incomingTuning);
          lastRunPayload.tuning = Object.assign({}, lastRunPayload.tuning || {}, incomingTuning);
          try {
            applyWorkerTuning(previewCloudBox(lastRunPayload.preview || {}));
          } catch (e) {
            console.warn("setLiveFrameState tuning apply failed", e);
          }
        }

        if (incomingTransforms && typeof incomingTransforms === "object") {
          applyNoiseTransforms(incomingTransforms, {
            allowPositions: true,
            allowScale: true,
            allowVel: true,
            additive: !!incomingTransforms.additive,
          });
          pushTransformsToCloudBuilder();
          if (!loopRunning) {
            const merged = Object.assign({}, lastRunPayload.tileTransforms || {});
            Object.assign(merged, snapshotTransforms(), { explicit: true });
            lastRunPayload.tileTransforms = merged;
          }
        }

        if (incomingReproj && typeof incomingReproj === "object") {
          const nextReproj = normalizeReproj(incomingReproj);
          if (workerReproj && nextReproj && !incomingReproj.resetHistory) {
            nextReproj.frameIndex = workerReproj.frameIndex >>> 0;
            nextReproj.sampleOffset = workerReproj.sampleOffset >>> 0;
            nextReproj.temporalCellPhase = workerReproj.temporalCellPhase >>> 0;
          }
          workerReproj = nextReproj;
        }

        const previewForCoarse = lastRunPayload.preview || incomingPreview || {};
        const usesHistory = !!(workerReproj && (workerReproj.enabled || normalizeTemporalCellRate(workerReproj.temporalCellRate) > 1));
        const qCoarse = renderScaleDividerCoarseFactor(previewForCoarse, usesHistory);
        lastRunPayload.coarseFactor = Math.max(1, qCoarse);
        if (workerReproj) {
          workerReproj.coarseFactor = lastRunPayload.coarseFactor;
          workerReproj.scale = 1 / Math.max(1, workerReproj.coarseFactor * workerReproj.coarseFactor);
          lastRunPayload.reproj = Object.assign({}, workerReproj, { resetHistory: false });
        }
        lastRunPayload.waitForGpu = false;
        lastRunPayload.logFrame = false;

        respond(true, {
          ok: true,
          seq: payload?.seq || 0,
          coarseFactor: lastRunPayload.coarseFactor,
          temporalCellRate: normalizeTemporalCellRate(workerReproj?.temporalCellRate),
        });
      } catch (err) {
        console.warn("setLiveFrameState failed", err);
        respond(false, err);
      }
      return;
    }

    if (type === "setTuning") {
      const incoming = payload?.tuning || {};
      mergeTuningPatch(incoming);
      try {
        applyWorkerTuning();
      } catch (e) {
        console.warn("setTuning apply failed", e);
      }
      respond(true, { ok: true, tuning: workerTuning, version: workerTuningVersion, autoThick: autoThickBoxTuning(previewCloudBox(lastRunPayload?.preview || {})) });
      return;
    }

    if (type === "startLoop") {
      loopEnabled = true;
      startLoop();
      respond(true, { ok: true });
      return;
    }

    if (type === "stopLoop") {
      stopLoop();
      respond(true, { ok: true });
      return;
    }

    if (type === "runFrame") {
      if (payload?.tuning) mergeTuningPatch(payload.tuning);
      const timings = await runFrame(payload);
      respond(true, { timings });
      return;
    }

    respond(false, new Error("Unknown worker message: " + type));
  } catch (err) {
    console.error(err);
    respond(false, err);
  }
}

export default self;
