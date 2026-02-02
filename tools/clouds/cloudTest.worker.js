// tools/clouds/cloudTest.worker.js
// cloudTest.worker.js (seed-aware, generic per-texture noise selectors, 4D-only for 3D volumes)
import { NoiseComputeBuilder } from "../noise/noiseCompute.js";
import { CloudComputeBuilder } from "./clouds.js";

let device = null, queue = null, nb = null, cb = null;
let canvasMain = null, ctxMain = null;
const dbg = { weather: null, weatherG: null, shapeR: null, detailR: null, blue: null };

// sizes (mirrored from UI)
let MAIN_W = 1, MAIN_H = 1, DBG_W = 1, DBG_H = 1;
let SHAPE_SIZE = 128, DETAIL_SIZE = 32, WEATHER_W = 512, WEATHER_H = 512, BN_W = 256, BN_H = 256;

// baked noise resources
const noise = {
  weather: { arrayView: null, dirty: false },
  blue: { arrayView: null, dirty: false },
  shape128: { view3D: null, size: 128, dirty: false },
  detail32: { view3D: null, size: 32, dirty: false },
};

let currentSlice = 0;

// reprojection/history resources
let historyTexA = null, historyTexB = null, historyViewA = null, historyViewB = null;
let historyPrevView = null, historyOutView = null, historyUsesAasOut = true, historyAllocated = false;
let historyTexWidth = 0, historyTexHeight = 0, historyTexLayers = 0;

let motionTex = null, motionView = null, depthTex = null, depthView = null;
let workerReproj = null, workerPerf = null;

// tuning
let workerTuning = null;
let workerTuningVersion = 0;
let lastAppliedTuningVersion = -1;

// loop and tile transform state
let loopEnabled = false, loopRunning = false, lastRunPayload = null, emaFps = null;
let shapeScrollPos = [0, 0, 0], shapeScrollVel = [0.2, 0, 0];
let detailScrollPos = [0, 0, 0], detailScrollVel = [-0.02, 0, 0];
let shapeScale = 0.1, detailScale = 1;

const renderBundleCache = new Map();
const log = (...a) => postMessage({ type: "log", data: a });

// device and builders
async function ensureDevice() {
  if (device) return;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No suitable GPU adapter (worker)");
  device = await adapter.requestDevice();
  queue = device.queue;
  nb = new NoiseComputeBuilder(device, queue);
  cb = new CloudComputeBuilder(device, queue);
  nb.initBlitRender?.();
  try { nb.buildPermTable(Date.now()); } catch (e) { console.warn("nb.buildPermTable initial failed", e); }
  try { cb.setTuning?.(); } catch (e) { console.warn("Initial cb.setTuning failed", e); }
}

function configureMainContext() {
  if (!canvasMain) return;
  ctxMain = canvasMain.getContext("webgpu");
  if (!ctxMain) throw new Error("Failed to get webgpu context for main canvas");
  const format = cb?._ensureRenderPipeline?.("bgra8unorm")?.format ?? "bgra8unorm";
  ctxMain.configure({ device, format, alphaMode: "opaque", size: [MAIN_W, MAIN_H] });
  return ctxMain;
}

function renderDebugSlices() {
  if (!nb) return;
  const s = Math.max(0, Math.min(SHAPE_SIZE - 1, currentSlice | 0));
  const d = Math.max(0, Math.min(DETAIL_SIZE - 1, Math.floor((s * DETAIL_SIZE) / SHAPE_SIZE)));
  if (dbg.shapeR && noise.shape128.view3D) {
    nb.renderTexture3DSliceToCanvas(noise.shape128.view3D, dbg.shapeR, {
      depth: SHAPE_SIZE, slice: s, channel: 1, clear: true, width: DBG_W, height: DBG_H,
    });
  }
  if (dbg.detailR && noise.detail32.view3D) {
    nb.renderTexture3DSliceToCanvas(noise.detail32.view3D, dbg.detailR, {
      depth: DETAIL_SIZE, slice: d, channel: 1, clear: true, width: DBG_W, height: DBG_H,
    });
  }
}

// seed helper
function maybeApplySeedToPermTable(params) {
  if (!params) return;
  const seedVal = params.seed;
  if (seedVal === undefined || seedVal === null) return;
  const s = typeof seedVal === "string" ? (Number(seedVal) || 0) : (Number(seedVal) || 0);
  if (!Number.isFinite(s) || s === 0) return;
  try { nb.buildPermTable?.(s); } catch (e) { console.warn("buildPermTable(seed) failed", e); }
}

function isEntry4D(ep) {
  return typeof ep === "string" && /4D/.test(ep);
}

function getEntrySet() {
  const eps = Array.isArray(nb?.entryPoints) ? nb.entryPoints : [];
  return new Set(eps.filter((x) => typeof x === "string" && x.length));
}

function sanitizeEntry(entry, fallback, opts = {}) {
  const { require4D = false } = opts;
  const set = getEntrySet();
  const s = typeof entry === "string" ? entry : "";
  if (!s) return fallback;
  if (!set.has(s)) return fallback;
  if (require4D && !isEntry4D(s)) return fallback;
  return s;
}

function stripKeys(src, keys) {
  const out = {};
  const o = (src && typeof src === "object") ? src : {};
  for (const k of Object.keys(o)) {
    if (keys.has(k)) continue;
    out[k] = o[k];
  }
  return out;
}

function withToroidalFromMode(params, mode) {
  const p = (params && typeof params === "object") ? { ...params } : {};
  p.toroidal = isEntry4D(mode) ? 1 : 0;
  return p;
}

// bake helpers
async function bakeWeather2D(weatherParams = {}, force = false, billowParams = {}) {
  if (noise.weather.arrayView && !force && !noise.weather.dirty) {
    if (dbg.weather) nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weather, { preserveCanvasSize: true, clear: true, channel: 1, width: DBG_W, height: DBG_H });
    if (dbg.weatherG) nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weatherG, { preserveCanvasSize: true, clear: true, channel: 2, width: DBG_W, height: DBG_H });
    noise.weather.dirty = false;
    return { baseMs: 0, gMs: 0, totalMs: 0 };
  }

  const T0 = performance.now();

  const WEATHER_DROP = new Set(["mode"]);
  const baseMode = sanitizeEntry(weatherParams.mode, "computeFBM", { require4D: false });
  const baseParamsRaw = stripKeys(weatherParams, WEATHER_DROP);
  const baseParams = withToroidalFromMode(baseParamsRaw, baseMode);

  maybeApplySeedToPermTable(baseParams);

  const t0 = performance.now();
  const baseView = await nb.computeToTexture(
    WEATHER_W, WEATHER_H, baseParams,
    { noiseChoices: ["clearTexture", baseMode], outputChannel: 1, textureKey: "weather2d", viewDimension: "2d-array" }
  );
  const baseMs = performance.now() - t0;

  const G_DROP = new Set(["mode", "enabled"]);
  const enabledG = !!(billowParams && billowParams.enabled === true);

  let gMs = 0;
  if (enabledG) {
    const gMode = sanitizeEntry(billowParams.mode, "computeBillow", { require4D: false });
    const gParamsRaw = stripKeys(billowParams, G_DROP);
    const gParams = withToroidalFromMode(gParamsRaw, gMode);

    maybeApplySeedToPermTable(gParams);

    const tg0 = performance.now();
    await nb.computeToTexture(
      WEATHER_W, WEATHER_H, gParams,
      { noiseChoices: ["clearTexture", gMode], outputChannel: 2, textureKey: "weather2d", viewDimension: "2d-array" }
    );
    gMs = performance.now() - tg0;
  } else {
    const tc0 = performance.now();
    await nb.computeToTexture(WEATHER_W, WEATHER_H, { zoom: 1.0 }, { noiseChoices: ["clearTexture"], outputChannel: 2, textureKey: "weather2d", viewDimension: "2d-array" });
    gMs = performance.now() - tc0;
  }

  noise.weather.arrayView = (typeof nb.get2DView === "function" ? nb.get2DView("weather2d", { dimension: "2d-array" }) : baseView) || baseView;
  noise.weather.dirty = false;

  if (noise.weather.arrayView) {
    if (dbg.weather) nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weather, { preserveCanvasSize: true, clear: true, channel: 1, width: DBG_W, height: DBG_H });
    if (dbg.weatherG) nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weatherG, { preserveCanvasSize: true, clear: true, channel: 2, width: DBG_W, height: DBG_H });
  }

  const totalMs = performance.now() - T0;
  log("[BENCH] weather base(ms):", baseMs.toFixed(2), " g(ms):", gMs.toFixed(2), " total(ms):", totalMs.toFixed(2), " baseMode:", baseMode, " gEnabled:", enabledG);
  return { baseMs, gMs, totalMs };
}

async function bakeBlue2D(blueParams = {}, force = false) {
  maybeApplySeedToPermTable(blueParams);

  if (noise.blue.arrayView && !force && !noise.blue.dirty) {
    noise.blue.dirty = false;
    if (dbg.blue) nb.renderTextureToCanvas(noise.blue.arrayView, dbg.blue, { preserveCanvasSize: true, clear: true, width: DBG_W, height: DBG_H });
    return { blueMs: 0, totalMs: 0 };
  }

  const T0 = performance.now();
  const t0 = performance.now();
  const arrView = await nb.computeToTexture(BN_W, BN_H, blueParams, { noiseChoices: ["clearTexture", "computeBlueNoise"], outputChannel: 0 });
  const blueMs = performance.now() - t0;

  noise.blue.arrayView = arrView;
  noise.blue.dirty = false;

  if (dbg.blue) nb.renderTextureToCanvas(arrView, dbg.blue, { preserveCanvasSize: true, clear: true, width: DBG_W, height: DBG_H });

  const totalMs = performance.now() - T0;
  log("[BENCH] blue noise(ms):", blueMs.toFixed(2), " total(ms):", totalMs.toFixed(2));
  return { blueMs, totalMs };
}

async function bakeShape128(shapeParams = {}, force = false) {
  maybeApplySeedToPermTable(shapeParams);

  if (noise.shape128.view3D && !force && !noise.shape128.dirty) {
    noise.shape128.dirty = false;
    if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
    renderDebugSlices();
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
  await nb.computeToTexture3D(
    SHAPE_SIZE, SHAPE_SIZE, SHAPE_SIZE,
    baseParams,
    { noiseChoices: baseChoices, outputChannel: 1, id: "shape128" }
  );
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
      SHAPE_SIZE, SHAPE_SIZE, SHAPE_SIZE,
      { ...baseParamsRaw, zoom: b.zm, toroidal: 1 },
      { noiseChoices: ["clearTexture", b.mode], outputChannel: b.ch, id: "shape128" }
    );
    bandsMs.push(performance.now() - tb0);
  }

  noise.shape128.view3D = nb.get3DView("shape128");
  noise.shape128.dirty = false;
  if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
  renderDebugSlices();

  const totalMs = performance.now() - T0;
  log(
    "[BENCH] shape base(ms):", baseMs.toFixed(2),
    " bands(ms):", bandsMs.map((x) => x.toFixed(2)).join(", "),
    " total(ms):", totalMs.toFixed(2),
    " base:", baseModeA, "+", baseModeB,
    " bands:", bandSpecs.map((b) => `${b.ch}:${b.mode}`).join(" ")
  );
  return { baseMs, bandsMs, totalMs };
}

async function bakeDetail32(detailParams = {}, force = false) {
  maybeApplySeedToPermTable(detailParams);

  if (noise.detail32.view3D && !force && !noise.detail32.dirty) {
    noise.detail32.dirty = false;
    if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
    renderDebugSlices();
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
      DETAIL_SIZE, DETAIL_SIZE, DETAIL_SIZE,
      { ...baseParamsRaw, zoom: b.zm, toroidal: 1 },
      { noiseChoices: ["clearTexture", b.mode], outputChannel: b.ch, id: "detail32" }
    );
    bandsMs.push(performance.now() - tb0);
  }

  noise.detail32.view3D = nb.get3DView("detail32");
  noise.detail32.dirty = false;
  if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
  renderDebugSlices();

  const totalMs = performance.now() - T0;
  log("[BENCH] detail bands(ms):", bandsMs.map((x) => x.toFixed(2)).join(", "), " total(ms):", totalMs.toFixed(2), " modes:", `${m1},${m2},${m3}`);
  return { bandsMs, totalMs };
}

// history helpers
function ensureHistoryTextures(w, h, layers = 1) {
  if (historyAllocated && historyTexWidth === w && historyTexHeight === h && historyTexLayers === layers) return;
  historyTexWidth = w; historyTexHeight = h; historyTexLayers = layers;
  try { historyTexA?.destroy?.(); } catch (_) {}
  try { historyTexB?.destroy?.(); } catch (_) {}
  historyTexA = historyTexB = null; historyViewA = historyViewB = null; historyPrevView = null; historyOutView = null;

  const desc = {
    size: [w, h, layers],
    format: "rgba16float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
  };
  historyTexA = device.createTexture(desc);
  historyTexB = device.createTexture(desc);
  historyViewA = historyTexA.createView({ dimension: "2d-array", arrayLayerCount: layers });
  historyViewB = historyTexB.createView({ dimension: "2d-array", arrayLayerCount: layers });
  historyUsesAasOut = true; historyOutView = historyViewA; historyPrevView = null; historyAllocated = true;
}

// tile transforms
function applyTileTransforms(tt, opts = {}) {
  if (!tt || typeof tt !== "object") return;

  const allowPositions = !!opts.allowPositions || !!tt.explicit;
  const allowScale = opts.allowScale !== undefined ? !!opts.allowScale : true;
  const allowVel = opts.allowVel !== undefined ? !!opts.allowVel : true;
  const additive = !!opts.additive || !!tt.additive;

  const readVec3 = (v) => {
    if (!Array.isArray(v)) return null;
    const x = Number(v[0]); const y = Number(v[1]); const z = Number(v[2] ?? 0);
    if ([x, y, z].some((n) => Number.isNaN(n))) return null;
    return [x, y, z];
  };

  if (allowPositions) {
    const shapeOff = readVec3(tt.shapeOffset);
    if (shapeOff) {
      if (additive) { shapeScrollPos[0] += shapeOff[0]; shapeScrollPos[1] += shapeOff[1]; shapeScrollPos[2] += shapeOff[2]; }
      else { shapeScrollPos = shapeOff; }
    }

    const detailOff = readVec3(tt.detailOffset);
    if (detailOff) {
      if (additive) { detailScrollPos[0] += detailOff[0]; detailScrollPos[1] += detailOff[1]; detailScrollPos[2] += detailOff[2]; }
      else { detailScrollPos = detailOff; }
    }
  }

  if (allowScale && tt.shapeScale !== undefined) {
    const v = Number(tt.shapeScale);
    if (!Number.isNaN(v)) shapeScale = v;
  }
  if (allowScale && tt.detailScale !== undefined) {
    const v = Number(tt.detailScale);
    if (!Number.isNaN(v)) detailScale = v;
  }

  if (allowVel) {
    const sVel = readVec3(tt.shapeVel);
    if (sVel) shapeScrollVel = sVel;
    const dVel = readVec3(tt.detailVel);
    if (dVel) detailScrollVel = dVel;
  }

  if (cb) { cb._bg0Dirty = cb._bg1Dirty = true; }
}

// reproj normalization
function normalizeReproj(r) {
  if (!r) return null;
  const out = {
    enabled: (r.enabled ? 1 : 0) >>> 0,
    subsample: (r.subsample ? (r.subsample >>> 0) : 0) >>> 0,
    sampleOffset: (r.sampleOffset ? (r.sampleOffset >>> 0) : 0) >>> 0,
    motionIsNormalized: (r.motionIsNormalized ? 1 : 0) >>> 0,
    temporalBlend: (typeof r.temporalBlend === "number") ? r.temporalBlend : 0.0,
    depthTest: (r.depthTest ? 1 : 0) >>> 0,
    depthTolerance: (typeof r.depthTolerance === "number") ? r.depthTolerance : 0.0,
    frameIndex: (r.frameIndex ? (r.frameIndex >>> 0) : 0) >>> 0,
    fullWidth: r.fullWidth ? (r.fullWidth >>> 0) : undefined,
    fullHeight: r.fullHeight ? (r.fullHeight >>> 0) : undefined,
    scale: (typeof r.scale === "number") ? r.scale : undefined,
    coarseFactor: (typeof r.coarseFactor === "number") ? Math.max(1, r.coarseFactor | 0) : undefined,
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

// render bundle cache
function makeRenderBundleKey(pipe, bg, samp, paramsBuffer, outView) {
  const getId = cb && typeof cb._getResId === "function" ? cb._getResId.bind(cb) : (o) => String(o);
  return [pipe, bg, samp, paramsBuffer, outView].map(getId).join("|");
}

function getOrCreateRenderBundle(pipe, bgl, samp, format) {
  const bg = cb._getOrCreateRenderBindGroup(canvasMain, bgl, samp);
  const bundleKey = makeRenderBundleKey(pipe, bg, samp, cb.renderParams, cb.outView);

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

// tuning merge/apply
function mergeTuningPatch(patch) {
  if (!patch) return;
  if (!workerTuning) workerTuning = {};
  let changed = false;

  for (const k of Object.keys(patch)) {
    const newRaw = patch[k];
    const v = (typeof newRaw === "string" && newRaw.trim() !== "" && !Number.isNaN(Number(newRaw))) ? Number(newRaw) : newRaw;
    const prev = workerTuning[k];
    const isDifferent = (prev !== v) && !(Number.isNaN(prev) && Number.isNaN(v));
    if (isDifferent) { workerTuning[k] = v; changed = true; }
    else { workerTuning[k] = v; }
  }

  if (changed) {
    workerTuningVersion = (workerTuningVersion + 1) >>> 0;
  }
}

function applyWorkerTuning() {
  if (!workerTuning) return false;
  if (workerTuningVersion === lastAppliedTuningVersion) return false;

  try {
    if (cb && typeof cb.setTuning === "function") {
      cb.setTuning(Object.assign({}, workerTuning));
      if (cb._bg0Dirty !== undefined) cb._bg0Dirty = true;
      lastAppliedTuningVersion = workerTuningVersion;
      if (typeof workerTuning.lodBiasWeather === "number" && typeof cb?.setPerfParams === "function") {
        cb.setPerfParams({ lodBiasMul: workerTuning.lodBiasWeather, coarseMipBias: 0.0 });
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

function payloadHasTuning(obj) {
  return !!(obj && obj.tuning && typeof obj.tuning === "object");
}

// runFrame
async function runFrame({
  weatherParams, billowParams, shapeParams, detailParams,
  tileTransforms,
  preview,
  cloudParams,
  reproj = null, perf = null,
  motionImage = null, depthImage = null,
  coarseFactor = 1,
} = {}) {
  await ensureDevice();

  try { lastRunPayload = { weatherParams, billowParams, shapeParams, detailParams, tileTransforms, preview, cloudParams, reproj, perf, motionImage, depthImage, coarseFactor }; } catch {}

  if (tileTransforms) {
    applyTileTransforms(tileTransforms, {
      allowPositions: !!tileTransforms.explicit,
      allowScale: true,
      allowVel: true,
      additive: !!tileTransforms.additive,
    });
  }

  if (reproj) workerReproj = normalizeReproj(reproj);
  if (perf) workerPerf = perf;

  if (payloadHasTuning(arguments[0])) mergeTuningPatch(arguments[0].tuning);
  applyWorkerTuning();

  if (!noise.weather.arrayView) await bakeWeather2D(weatherParams, true, billowParams);
  if (!noise.blue.arrayView) await bakeBlue2D({}, true);
  if (!noise.shape128.view3D) await bakeShape128(shapeParams, true);
  if (!noise.detail32.view3D) await bakeDetail32(detailParams, true);

  cb.setInputMaps({
    weatherView: noise.weather.arrayView,
    blueView: noise.blue.arrayView,
    shape3DView: noise.shape128.view3D,
    detail3DView: noise.detail32.view3D,
  });

  cb.setTileScaling?.({ shapeOffsetWorld: shapeScrollPos, detailOffsetWorld: detailScrollPos, shapeScale, detailScale });

  const useReproj = (reproj && reproj.enabled) || (workerReproj && workerReproj.enabled);
  if (useReproj) {
    if (!workerReproj && reproj) workerReproj = normalizeReproj(reproj);

    if (motionImage) {
      try {
        motionTex?.destroy?.();
        motionTex = device.createTexture({ size: [motionImage.width, motionImage.height, 1], format: "rg8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        queue.copyExternalImageToTexture({ source: motionImage }, { texture: motionTex }, [motionImage.width, motionImage.height, 1]);
        motionView = motionTex.createView({ dimension: "2d" });
      } catch (e) { console.warn("Failed to upload motionImage", e); motionView = null; }
    } else { motionView = null; }

    if (depthImage) {
      try {
        depthTex?.destroy?.();
        depthTex = device.createTexture({ size: [depthImage.width, depthImage.height, 1], format: "r8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        queue.copyExternalImageToTexture({ source: depthImage }, { texture: depthTex }, [depthImage.width, depthImage.height, 1]);
        depthView = depthTex.createView({ dimension: "2d" });
      } catch (e) { console.warn("Failed to upload depthImage", e); depthView = null; }
    } else { depthView = null; }

    cb.createOutputTexture(MAIN_W, MAIN_H, 1);
    ensureHistoryTextures(cb.width || MAIN_W, cb.height || MAIN_H, cb.layers || 1);

    historyOutView = historyUsesAasOut ? historyViewA : historyViewB;

    cb.setInputMaps({
      motionView: motionView || undefined,
      depthPrevView: depthView || undefined,
      historyPrevView: historyPrevView || undefined,
    });
    cb.setHistoryOutView(historyOutView);

    if (workerPerf) cb.setPerfParams(workerPerf);
    if (workerReproj) cb.setReprojSettings(workerReproj);

    cb._bg0Dirty = true;
    cb._bg1Dirty = true;
  } else {
    cb.setInputMaps({ motionView: undefined, depthPrevView: undefined, historyPrevView: undefined });
    cb.setHistoryOutView(null);
    cb._bg1Dirty = true;
    cb._bg0Dirty = true;
  }

  cb.setBox({ center: [0, 0, 0], half: [1, 0.3, 1], uvScale: 1 });
  cb.setParams(cloudParams || {});

  const deg2rad = (d) => (d * Math.PI) / 180;
  const yaw = deg2rad(preview?.cam?.yawDeg || 0), pit = deg2rad(preview?.cam?.pitchDeg || 0);
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
  const fwd = norm([sy * cp, sp, cy * cp]);
  const upRef = Math.abs(dot(fwd, [0, 1, 0])) > 0.999 ? [0, 0, 1] : [0, 1, 0];
  const right = norm(cross(upRef, fwd));
  const up = cross(fwd, right);
  const aspect = Math.max(1e-6, MAIN_W / Math.max(1, MAIN_H));
  const sAz = deg2rad(preview?.sun?.azDeg || 0), sEl = deg2rad(preview?.sun?.elDeg || 0), cel = Math.cos(sEl);
  const sunDir = norm([cel * Math.sin(sAz), Math.sin(sEl), cel * Math.cos(sAz)]);

  cb.setViewFromCamera({
    camPos: [preview?.cam?.x || 0, preview?.cam?.y || 0, preview?.cam?.z || 0],
    right, up, fwd,
    fovYDeg: preview?.cam?.fovYDeg || 60, aspect,
    planetRadius: 0.0, cloudBottom: -1.0, cloudTop: 1.0,
    worldToUV: 1.0, stepBase: 0.02, stepInc: 0.04, volumeLayers: 1,
  });

  cb.setLight({ sunDir, camPos: [preview?.cam?.x || 0, preview?.cam?.y || 0, preview?.cam?.z || 0] });
  cb.setOptions({ writeRGB: true, outputChannel: 0, debugForceFog: 0 });

  if (!useReproj) cb.createOutputTexture(MAIN_W, MAIN_H, 1);

  const tAll0 = performance.now();
  if (typeof queue.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
  const tC0 = performance.now();

  const cf = Math.max(1, (coarseFactor | 0));
  await cb.dispatch({ coarseFactor: cf });

  if (typeof queue.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
  else await new Promise((r) => setTimeout(r, 8));
  const tC1 = performance.now();

  if (useReproj && historyAllocated) {
    historyPrevView = historyOutView;
    historyUsesAasOut = !historyUsesAasOut;
    historyOutView = historyUsesAasOut ? historyViewA : historyViewB;
    cb.setInputMaps({ historyPrevView });
    cb.setHistoryOutView(historyOutView);
    cb._bg1Dirty = cb._bg0Dirty = true;
  }

  const { pipe, bgl, samp, format } = cb._ensureRenderPipeline("bgra8unorm");
  if (!ctxMain) configureMainContext();

  cb._writeRenderUniforms({
    layerIndex: Math.max(0, Math.min((cb?.layers || 1) - 1, preview?.layer || 0)),
    cam: {
      camPos: [preview?.cam?.x || 0, preview?.cam?.y || 0, preview?.cam?.z || 0],
      right, up, fwd, fovYDeg: preview?.cam?.fovYDeg || 60, aspect,
    },
    sunDir,
    exposure: preview?.exposure || 1.0,
    skyColor: preview?.sky || [0.5, 0.6, 0.8],
    sunBloom: preview?.sun?.bloom || 0.0,
  });

  const { bundle } = getOrCreateRenderBundle(pipe, bgl, samp, format);

  const enc = device.createCommandEncoder();
  const tex = ctxMain.getCurrentTexture();
  const pass = enc.beginRenderPass({
    colorAttachments: [{
      view: tex.createView(),
      loadOp: "clear",
      clearValue: { r: (preview?.sky?.[0] ?? 0.5), g: (preview?.sky?.[1] ?? 0.6), b: (preview?.sky?.[2] ?? 0.8), a: 1 },
      storeOp: "store",
    }],
  });
  pass.executeBundles([bundle]);
  pass.end();
  queue.submit([enc.finish()]);

  const tR0 = performance.now();
  if (typeof queue.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
  else await new Promise((r) => setTimeout(r, 8));
  const tR1 = performance.now();
  const tAll1 = performance.now();

  const timings = { computeMs: tC1 - tC0, renderMs: tR1 - tR0, totalMs: tAll1 - tAll0 };
  log("[BENCH] compute(waited, ms):", timings.computeMs.toFixed(2), " render(waited, ms):", timings.renderMs.toFixed(2), " total(ms):", timings.totalMs.toFixed(2), " coarseFactor:", cf);
  return timings;
}

// animation loop
function startLoop() {
  if (loopRunning) return;
  if (!lastRunPayload) { log("startLoop: no last run payload; call runFrame once first."); loopEnabled = true; return; }
  loopEnabled = true; loopRunning = true;

  (async () => {
    log("animation loop started");
    let prevTime = performance.now();
    if (workerReproj && workerReproj.enabled) {
      workerReproj = normalizeReproj(workerReproj);
      if (!workerReproj.frameIndex) workerReproj.frameIndex = 0;
    }

    while (loopEnabled) {
      const t0 = performance.now();
      try {
        const dt = Math.max(0, (t0 - prevTime) / 1000);
        prevTime = t0;

        shapeScrollPos[0] += shapeScrollVel[0] * dt; shapeScrollPos[1] += shapeScrollVel[1] * dt; shapeScrollPos[2] += shapeScrollVel[2] * dt;
        detailScrollPos[0] += detailScrollVel[0] * dt; detailScrollPos[1] += detailScrollVel[1] * dt; detailScrollPos[2] += detailScrollVel[2] * dt;

        if (workerReproj && workerReproj.enabled) {
          const ss = Math.max(1, workerReproj.subsample || 1);
          const cells = ss * ss;
          workerReproj.frameIndex = ((workerReproj.frameIndex || 0) + 1) >>> 0;
          workerReproj.sampleOffset = (workerReproj.frameIndex % cells) >>> 0;
          try {
            cb?.setReprojSettings?.(workerReproj);
            if (workerPerf) cb?.setPerfParams?.(workerPerf);
            if (cb) cb._bg0Dirty = cb._bg1Dirty = true;
          } catch (e) { console.warn("startLoop reproj apply failed", e); }
        }

        if (workerTuningVersion !== lastAppliedTuningVersion) applyWorkerTuning();

        if (lastRunPayload) {
          lastRunPayload.tileTransforms = Object.assign({}, lastRunPayload.tileTransforms || {}, {
            shapeOffset: shapeScrollPos.slice(0, 3),
            detailOffset: detailScrollPos.slice(0, 3),
            shapeVel: shapeScrollVel.slice(0, 3),
            detailVel: detailScrollVel.slice(0, 3),
            shapeScale, detailScale,
          });
        }

        const timings = await runFrame(lastRunPayload);
        const frameTime = (performance.now() - t0) || timings.totalMs || 1;
        const fpsInst = 1000 / frameTime;
        emaFps = (emaFps === null) ? fpsInst : (emaFps * 0.92 + fpsInst * 0.08);
        postMessage({ type: "frame", data: { timings, fps: emaFps, frameTime } });
      } catch (err) {
        postMessage({ type: "log", data: ["animation loop error", String(err)] });
      }
      await Promise.resolve();
    }

    loopRunning = false;
    log("animation loop stopped");
    postMessage({ type: "loop-stopped" });
  })();
}

function stopLoop() { loopEnabled = false; }

// math helpers
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; }
function toVec3(a) {
  if (!Array.isArray(a)) return null;
  const x = Number(a[0]) || 0;
  const y = Number(a[1]) || 0;
  const z = a.length >= 3 ? (Number(a[2]) || 0) : 0;
  return [x, y, z];
}

// RPC handlers
self.onmessage = async (ev) => {
  const { id, type, payload } = ev.data || {};
  const respond = (ok, dataOrErr) => postMessage({ id, ok, ...(ok ? { data: dataOrErr } : { error: String(dataOrErr) }) });

  try {
    if (type === "init") {
      const { canvases, constants } = payload;
      canvasMain = canvases.main;
      dbg.weather = canvases.dbg.weather;
      dbg.weatherG = canvases.dbg.weatherG;
      dbg.shapeR = canvases.dbg.shapeR;
      dbg.detailR = canvases.dbg.detailR;
      dbg.blue = canvases.dbg.blue;

      SHAPE_SIZE = constants.SHAPE_SIZE;
      DETAIL_SIZE = constants.DETAIL_SIZE;
      WEATHER_W = constants.WEATHER_W;
      WEATHER_H = constants.WEATHER_H;
      BN_W = constants.BN_W;
      BN_H = constants.BN_H;

      await ensureDevice();
      configureMainContext();
      respond(true, { ok: true, entryPoints: Array.isArray(nb?.entryPoints) ? nb.entryPoints.slice() : [] });
      return;
    }

    if (type === "resize") {
      const { main, dbg: dbgSize } = payload;
      MAIN_W = Math.max(1, main.width | 0);
      MAIN_H = Math.max(1, main.height | 0);
      DBG_W = Math.max(1, dbgSize.width | 0);
      DBG_H = Math.max(1, dbgSize.height | 0);

      if (canvasMain) { canvasMain.width = MAIN_W; canvasMain.height = MAIN_H; }
      Object.values(dbg).forEach((c) => { if (c) { c.width = DBG_W; c.height = DBG_H; } });

      if (ctxMain) ctxMain.configure({ device, format: cb?._ensureRenderPipeline?.("bgra8unorm")?.format ?? "bgra8unorm", alphaMode: "opaque", size: [MAIN_W, MAIN_H] });
      respond(true, { ok: true });
      return;
    }

    if (type === "bakeWeather") {
      await ensureDevice();
      const timings = await bakeWeather2D(payload.weatherParams || {}, true, payload.billowParams || {});
      respond(true, { baked: "weather", timings });
      return;
    }

    if (type === "bakeBlue") {
      await ensureDevice();
      const timings = await bakeBlue2D(payload.blueParams || {}, true);
      respond(true, { baked: "blue", timings });
      return;
    }

    if (type === "bakeShape") {
      await ensureDevice();
      if (payload?.tileTransforms) applyTileTransforms(payload.tileTransforms, { allowPositions: !!payload.tileTransforms.explicit, allowScale: true, allowVel: true, additive: !!payload.tileTransforms.additive });
      noise.shape128.dirty = true;
      const timings = await bakeShape128(payload.shapeParams || {}, true);
      respond(true, { baked: "shape128", timings });
      return;
    }

    if (type === "bakeDetail") {
      await ensureDevice();
      if (payload?.tileTransforms) applyTileTransforms(payload.tileTransforms, { allowPositions: !!payload.tileTransforms.explicit, allowScale: true, allowVel: true, additive: !!payload.tileTransforms.additive });
      noise.detail32.dirty = true;
      const timings = await bakeDetail32(payload.detailParams || {}, true);
      respond(true, { baked: "detail32", timings });
      return;
    }

    if (type === "bakeAll") {
      await ensureDevice();
      const t0 = performance.now();
      if (payload?.tileTransforms) applyTileTransforms(payload.tileTransforms, { allowPositions: !!payload.tileTransforms.explicit, allowScale: true, allowVel: true, additive: !!payload.tileTransforms.additive });

      const weather = await bakeWeather2D(payload.weatherParams || {}, true, payload.billowParams || {});
      const blue = await bakeBlue2D(payload.blueParams || {}, true);
      const shape = await bakeShape128(payload.shapeParams || {}, true);
      const detail = await bakeDetail32(payload.detailParams || {}, true);

      const t1 = performance.now();
      respond(true, { baked: "all", timings: { weather, blue, shape, detail, totalMs: t1 - t0 } });
      return;
    }

    if (type === "setTileTransforms") {
      await ensureDevice();
      try {
        applyTileTransforms(payload?.tileTransforms || {}, { allowPositions: true, allowScale: true, allowVel: true, additive: !!payload?.tileTransforms?.additive });
        try { if (lastRunPayload) lastRunPayload.tileTransforms = Object.assign({}, lastRunPayload.tileTransforms || {}, payload?.tileTransforms || {}, { explicit: true }); } catch {}

        if (cb && typeof cb.setTileScaling === "function") {
          cb.setTileScaling({ shapeOffsetWorld: shapeScrollPos, detailOffsetWorld: detailScrollPos, shapeScale, detailScale });
          cb._bg0Dirty = cb._bg1Dirty = true;
        }

        respond(true, { ok: true, tileTransforms: { shapeOffset: shapeScrollPos, detailOffset: detailScrollPos, shapeScale, detailScale, shapeVel: shapeScrollVel, detailVel: detailScrollVel } });
      } catch (err) {
        console.warn("setTileTransforms failed", err);
        respond(false, err);
      }
      return;
    }

    if (type === "setSlice") {
      currentSlice = Math.max(0, Math.min(SHAPE_SIZE - 1, (payload.slice | 0)));
      renderDebugSlices();
      respond(true, { slice: currentSlice });
      return;
    }

    if (type === "setReproj") {
      workerReproj = normalizeReproj(payload.reproj || null);
      workerPerf = payload.perf || workerPerf;
      if (workerReproj && workerReproj.enabled && (workerReproj.frameIndex === 0 || typeof workerReproj.frameIndex === "undefined")) {
        workerReproj.frameIndex = 0;
        workerReproj.sampleOffset = 0;
      }
      if (cb) {
        if (workerPerf) cb.setPerfParams(workerPerf);
        if (workerReproj) { cb.setReprojSettings(workerReproj); cb._bg0Dirty = true; }
      }
      if (workerReproj && workerReproj.enabled) startLoop();
      else stopLoop();
      respond(true, { ok: true, reproj: workerReproj, perf: workerPerf });
      return;
    }

    if (type === "setTuning") {
      const incoming = payload?.tuning || {};
      mergeTuningPatch(incoming);
      try { applyWorkerTuning(); } catch (e) { console.warn("setTuning apply failed", e); }
      respond(true, { ok: true, tuning: workerTuning, version: workerTuningVersion });
      return;
    }

    if (type === "startLoop") { loopEnabled = true; startLoop(); respond(true, { ok: true }); return; }
    if (type === "stopLoop") { stopLoop(); respond(true, { ok: true }); return; }

    if (type === "setShapeScroll" || type === "setDetailScroll" || type === "setScroll") {
      const s = payload?.shape, d = payload?.detail;

      if (type === "setShapeScroll" && payload) {
        const vel3 = toVec3(payload.vel);
        const pos3 = toVec3(payload.pos);
        if (vel3) shapeScrollVel = vel3;
        if (pos3) shapeScrollPos = pos3;
        respond(true, { pos: shapeScrollPos, vel: shapeScrollVel });
        return;
      }

      if (type === "setDetailScroll" && payload) {
        const vel3 = toVec3(payload.vel);
        const pos3 = toVec3(payload.pos);
        if (vel3) detailScrollVel = vel3;
        if (pos3) detailScrollPos = pos3;
        respond(true, { pos: detailScrollPos, vel: detailScrollVel });
        return;
      }

      if (type === "setScroll") {
        if (s) {
          const sVel = toVec3(s.vel);
          const sPos = toVec3(s.pos);
          if (sVel) shapeScrollVel = sVel;
          if (sPos) shapeScrollPos = sPos;
        }
        if (d) {
          const dVel = toVec3(d.vel);
          const dPos = toVec3(d.pos);
          if (dVel) detailScrollVel = dVel;
          if (dPos) detailScrollPos = dPos;
        }
        respond(true, { shape: { pos: shapeScrollPos, vel: shapeScrollVel }, detail: { pos: detailScrollPos, vel: detailScrollVel } });
        return;
      }
    }

    if (type === "runFrame") {
      if (payload?.tuning) { mergeTuningPatch(payload.tuning); }
      const timings = await runFrame(payload);
      respond(true, { timings });
      return;
    }

    respond(false, new Error("Unknown worker message: " + type));
  } catch (err) {
    console.error(err);
    respond(false, err);
  }
};

export default self;
