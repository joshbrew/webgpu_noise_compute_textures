// tools/clouds/cloudTestThreaded.js
// clouds-ui.js
// Immediate UI -> worker sync. No debounce. Per-texture mode selectors.
// Shape/detail 3D selectors are filtered to 4D entry points only.

import html from "./clouds.html";
import wrkr from "./cloudTest.worker.js";

let worker;

// Constants (mirror worker)
const SHAPE_SIZE = 128,
  DETAIL_SIZE = 32,
  WEATHER_W = 512,
  WEATHER_H = 512,
  BN_W = 256,
  BN_H = 256;
const DBG_SIZE = 224;
const DPR = () => Math.max(1, Math.floor(window.devicePixelRatio || 1));

let ENTRY_POINTS = [];

// Default preview + noise param blocks (each has seed)
const preview = {
  cam: { x: -1, y: 0, z: -1, yawDeg: 35, pitchDeg: 1, fovYDeg: 60 },
  exposure: 1.35,
  sky: [0.55, 0.7, 0.95],
  layer: 0,
  sun: { azDeg: 45, elDeg: 22, bloom: 0.0 },
};

// Weather params (R channel)
const weatherParams = {
  mode: "computeFBM",
  seed: 123456789000,
  zoom: 2.0,
  freq: 1.0,
  octaves: 5,
  lacunarity: 2.0,
  seedAngle: Math.PI / 2,
  gain: 0.5,
  threshold: 0.0,
  time: 0.0,
  voroMode: 0,
  edgeK: 0.0,
  warpAmp: 0.0,
};

// Weather params (G channel)
const billowParams = {
  enabled: true,
  mode: "computeBillow",
  seed: 123456789000,
  scale: 1.0,
  zoom: 2.0,
  freq: 1.5,
  octaves: 4,
  lacunarity: 2.0,
  seedAngle: Math.PI / 2,
  gain: 0.5,
  threshold: 0.0,
  time: 0.0,
  voroMode: 0,
  edgeK: 0.0,
  warpAmp: 0.0,
};

// Weather params (B channel)
const weatherBParams = {
  enabled: false,
  mode: "computeBillow",
  seed: 123456789000,
  scale: 1.0,
  zoom: 2.0,
  freq: 1.5,
  octaves: 4,
  lacunarity: 2.0,
  seedAngle: Math.PI / 2,
  gain: 0.5,
  threshold: 0.0,
  time: 0.0,
  voroMode: 0,
  edgeK: 0.0,
  warpAmp: 0.0,
};

const shapeParams = {
  seed: Date.now() >>> 0,
  zoom: 4,
  freq: 1.0,
  octaves: 2,
  lacunarity: 2.0,
  seedAngle: Math.PI / 2,
  gain: 0.5,
  threshold: 0.0,
  time: 0.0,
  voroMode: 7,
  edgeK: 0.0,
  warpAmp: 0.0,
  baseModeA: "computePerlin4D",
  baseModeB: "computeAntiWorley4D",
  bandMode2: "computeWorley4D",
  bandMode3: "computeWorley4D",
  bandMode4: "computeWorley4D",
};

const detailParams = {
  seed: Date.now() >>> 0,
  zoom: 4,
  freq: 1.0,
  octaves: 4,
  lacunarity: 2.0,
  seedAngle: Math.PI / 2,
  gain: 0.5,
  threshold: 0.0,
  time: 0.0,
  voroMode: 7,
  edgeK: 0.0,
  warpAmp: 0.0,
  mode1: "computeAntiWorley4D",
  mode2: "computeAntiWorley4D",
  mode3: "computeAntiWorley4D",
};

const blueParams = { seed: (Date.now() & 0xffffffff) >>> 0 };

// Tile transforms (shape & detail)
const tileTransforms = {
  shapeOffset: [0.0, 0.0, 0.0],
  detailOffset: [0.0, 0.0, 0.0],
  weatherOffset: [0.0, 0.0, 0.0],

  shapeScale: 0.1,
  detailScale: 1.0,
  weatherScale: 1.0,

  shapeAxisScale: [1.0, 1.0, 1.0],
  detailAxisScale: [1.0, 1.0, 1.0],
  weatherAxisScale: [1.0, 1.0, 1.0],

  shapeVel: [0.2, 0.0, 0.0],
  detailVel: [-0.02, 0.0, 0.0],
};

let reprojEnabled = false;
const reprojDefaultScale = 1 / 4;
let animRunning = false;

// ---- DOM helpers ----
const $ = (id) => document.getElementById(id);
const num = (id, fallback) => {
  const el = $(id);
  if (!el) return fallback;
  const v = +el.value;
  return Number.isFinite(v) ? v : fallback;
};
const u32 = (id, fallback) => {
  const v = num(id, fallback);
  const n = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : fallback;
  return n >>> 0;
};

const safeClone = (o) => {
  try {
    return JSON.parse(JSON.stringify(o));
  } catch {
    return Object.assign({}, o);
  }
};

function setLog(...args) {
  try {
    console.log("[UI]", ...args);
  } catch {}
}

// ---- RPC plumbing ----
let _msgId = 1;
const _pending = new Map();

function rpc(type, payload = {}, transfer = []) {
  return new Promise((resolve, reject) => {
    const id = _msgId++;
    _pending.set(id, { resolve, reject });
    try {
      worker.postMessage({ id, type, payload }, transfer);
    } catch (err) {
      _pending.delete(id);
      reject(err);
    }
  });
}

async function setTileTransformsRPC(tt) {
  return rpc("setTileTransforms", { tileTransforms: safeClone(tt) });
}

// ---- entry-point helpers ----
function isEntry4D(ep) {
  return typeof ep === "string" && /4D/.test(ep);
}

function isExcludedEntry(ep) {
  if (typeof ep !== "string") return true;
  if (!ep) return true;
  if (ep === "clearTexture") return true;
  if (ep === "computeGauss5x5") return true;
  if (ep === "computeNormal") return true;
  if (ep === "computeNormal8") return true;
  if (ep === "computeSphereNormal") return true;
  if (ep === "computeNormalVolume") return true;
  return false;
}

function makeNoiseLabel(ep) {
  const s = String(ep || "");
  if (!s) return "Unknown";
  if (s.startsWith("compute")) {
    const tail = s.slice(7);
    return tail || s;
  }
  return s;
}

function getWeatherCandidates() {
  return ENTRY_POINTS.filter((ep) => !isExcludedEntry(ep));
}

function get4DCandidates() {
  return ENTRY_POINTS.filter((ep) => !isExcludedEntry(ep) && isEntry4D(ep));
}

function populateSelect(id, entries, defaultValue, opts = {}) {
  const el = $(id);
  if (!el) return;

  const allowNone = !!opts.allowNone;
  el.innerHTML = "";

  if (allowNone) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "None";
    el.appendChild(opt);
  }

  const list = Array.isArray(entries) ? entries : [];
  for (const ep of list) {
    const opt = document.createElement("option");
    opt.value = ep;
    opt.textContent = makeNoiseLabel(ep);
    el.appendChild(opt);
  }

  const hasDefault = list.includes(defaultValue);
  el.value = hasDefault ? defaultValue : allowNone ? "" : list[0] || "";
}

function readMode(id, fallback) {
  const el = $(id);
  if (!el) return fallback;
  const v = String(el.value || "");
  return v || fallback;
}

// ---- TUNING helpers (send only if changed) ----
let lastTuningSent = null;
function tuningChanged(curr, prev) {
  if (!prev) return true;
  const k1 = Object.keys(curr),
    k2 = Object.keys(prev);
  if (k1.length !== k2.length) return true;
  for (const k of k1) if (curr[k] !== prev[k]) return true;
  return false;
}
function cloneTuning(t) {
  return Object.assign({}, t);
}

function readTuning() {
  return {
    maxSteps: +($("t-maxSteps")?.value || 256) | 0,
    minStep: +($("t-minStep")?.value || 0.003),
    maxStep: +($("t-maxStep")?.value || 0.1),
    sunSteps: +($("t-sunSteps")?.value || 4) | 0,
    phaseJitter: +($("t-phaseJitter")?.value || 1.0),
    stepJitter: +($("t-stepJitter")?.value || 0.08),
    baseJitterFrac: +($("t-baseJitter")?.value || 0.15),
    topJitterFrac: +($("t-topJitter")?.value || 0.1),
    lodBiasWeather: +($("t-lodBiasWeather")?.value || 1.5),
    nearFluffDist: +($("t-nearFluffDist")?.value || 60.0),
    nearDensityMult: +($("t-nearDensityMult")?.value || 2.5),
    farStart: +($("t-farStart")?.value || 800.0),
    farFull: +($("t-farFull")?.value || 2500.0),
    raySmoothDens: +($("t-raySmoothDens")?.value || 0.5),
    raySmoothSun: +($("t-raySmoothSun")?.value || 0.5),
  };
}

async function setTuningRPC(tuningObj) {
  return rpc("setTuning", { tuning: tuningObj });
}

function sendTuningIfChanged() {
  try {
    const t = readTuning();
    if (!tuningChanged(t, lastTuningSent)) return;

    setTuningRPC(t)
      .then((res) => {
        lastTuningSent = cloneTuning(t);
        if (res && res.tuning) setLog("worker ack tuning", res.tuning);
      })
      .catch((err) => {
        console.warn("sendTuningIfChanged: setTuningRPC failed", err);
      });
  } catch (e) {
    console.warn("sendTuningIfChanged error", e);
  }
}

async function sendTuningNow(force = false) {
  const t = readTuning();
  if (!force && !tuningChanged(t, lastTuningSent)) return lastTuningSent;
  const res = await setTuningRPC(t);
  lastTuningSent = cloneTuning(t);
  if (res && res.tuning) setLog("worker ack tuning (now)", res.tuning);
  return lastTuningSent;
}

// ---- UI read helpers ----
function readCloudParams() {
  const sunAz = num("c-az", preview.sun.azDeg);
  const sunEl = num("c-el", preview.sun.elDeg);
  const sunBloom = num("c-bloom", preview.sun.bloom);

  preview.sun.azDeg = sunAz;
  preview.sun.elDeg = sunEl;
  preview.sun.bloom = sunBloom;

  return {
    globalCoverage: num("p-coverage", 1),
    globalDensity: num("p-density", 100),
    cloudAnvilAmount: num("p-anvil", 0.1),
    cloudBeer: num("p-beer", 6),
    attenuationClamp: num("p-clamp", 0.15),
    inScatterG: num("p-ins", 0.7),
    silverIntensity: num("p-sI", 0.25),
    silverExponent: num("p-sE", 16.0),
    outScatterG: num("p-outs", 0.2),
    inVsOut: num("p-ivo", 0.3),
    outScatterAmbientAmt: num("p-ambOut", 1.0),
    ambientMinimum: num("p-ambMin", 0.25),
    sunColor: [1.0, 1.0, 1.0],
    sunAzDeg: sunAz,
    sunElDeg: sunEl,
    sunBloom,
  };
}

function readWeather() {
  weatherParams.mode = readMode("we-mode", weatherParams.mode);
  weatherParams.seed = u32("we-seed", weatherParams.seed);
  weatherParams.zoom = num("we-zoom", weatherParams.zoom);
  weatherParams.freq = num("we-freq", weatherParams.freq);
  weatherParams.octaves = Math.max(1, num("we-oct", weatherParams.octaves) | 0);
  weatherParams.lacunarity = num("we-lac", weatherParams.lacunarity);
  weatherParams.gain = num("we-gain", weatherParams.gain);
  weatherParams.threshold = num("we-thr", weatherParams.threshold);
  weatherParams.seedAngle = num("we-seedAngle", weatherParams.seedAngle);
  weatherParams.time = num("we-time", weatherParams.time);
  weatherParams.voroMode = u32("we-voroMode", weatherParams.voroMode);
  weatherParams.edgeK = num("we-edgeK", weatherParams.edgeK);
  weatherParams.warpAmp = num("we-warpAmp", weatherParams.warpAmp);
}

function readWeatherG() {
  billowParams.enabled = !!$("we-billow-enable")?.checked;
  billowParams.mode = readMode("we-billow-mode", billowParams.mode);
  billowParams.seed = u32("we-billow-seed", billowParams.seed);
  billowParams.scale = num("we-billow-scale", billowParams.scale);
  billowParams.zoom = num("we-billow-zoom", billowParams.zoom);
  billowParams.freq = num("we-billow-freq", billowParams.freq);
  billowParams.octaves = Math.max(
    1,
    num("we-billow-oct", billowParams.octaves) | 0,
  );
  billowParams.lacunarity = num("we-billow-lac", billowParams.lacunarity);
  billowParams.gain = num("we-billow-gain", billowParams.gain);
  billowParams.threshold = num("we-billow-thr", billowParams.threshold);
  billowParams.seedAngle = num("we-billow-seedAngle", billowParams.seedAngle);
  billowParams.time = num("we-billow-time", billowParams.time);
  billowParams.voroMode = u32("we-billow-voroMode", billowParams.voroMode);
  billowParams.edgeK = num("we-billow-edgeK", billowParams.edgeK);
  billowParams.warpAmp = num("we-billow-warpAmp", billowParams.warpAmp);
}

function readWeatherB() {
  weatherBParams.enabled = !!$("we-bandb-enable")?.checked;
  weatherBParams.mode = readMode("we-bandb-mode", weatherBParams.mode);
  weatherBParams.seed = u32("we-bandb-seed", weatherBParams.seed);
  weatherBParams.scale = num("we-bandb-scale", weatherBParams.scale);
  weatherBParams.zoom = num("we-bandb-zoom", weatherBParams.zoom);
  weatherBParams.freq = num("we-bandb-freq", weatherBParams.freq);
  weatherBParams.octaves = Math.max(
    1,
    num("we-bandb-oct", weatherBParams.octaves) | 0,
  );
  weatherBParams.lacunarity = num("we-bandb-lac", weatherBParams.lacunarity);
  weatherBParams.gain = num("we-bandb-gain", weatherBParams.gain);
  weatherBParams.threshold = num("we-bandb-thr", weatherBParams.threshold);
  weatherBParams.seedAngle = num(
    "we-bandb-seedAngle",
    weatherBParams.seedAngle,
  );
  weatherBParams.time = num("we-bandb-time", weatherBParams.time);
  weatherBParams.voroMode = u32("we-bandb-voroMode", weatherBParams.voroMode);
  weatherBParams.edgeK = num("we-bandb-edgeK", weatherBParams.edgeK);
  weatherBParams.warpAmp = num("we-bandb-warpAmp", weatherBParams.warpAmp);
}

function readWeatherTransform() {
  tileTransforms.weatherScale = num("we-scale", tileTransforms.weatherScale);

  tileTransforms.weatherOffset[0] = num(
    "we-pos-x",
    tileTransforms.weatherOffset[0],
  );
  tileTransforms.weatherOffset[1] = num(
    "we-pos-y",
    tileTransforms.weatherOffset[1],
  );
  tileTransforms.weatherOffset[2] = num(
    "we-pos-z",
    tileTransforms.weatherOffset[2],
  );

  tileTransforms.weatherAxisScale = tileTransforms.weatherAxisScale || [
    1, 1, 1,
  ];
  tileTransforms.weatherAxisScale[0] = num(
    "we-axis-x",
    tileTransforms.weatherAxisScale[0],
  );
  tileTransforms.weatherAxisScale[1] = num(
    "we-axis-y",
    tileTransforms.weatherAxisScale[1],
  );
  tileTransforms.weatherAxisScale[2] = num(
    "we-axis-z",
    tileTransforms.weatherAxisScale[2],
  );
}

function readBlue() {
  blueParams.seed = u32("bn-seed", blueParams.seed);
}

function readShape() {
  shapeParams.baseModeA = readMode("sh-mode-a", shapeParams.baseModeA);
  shapeParams.baseModeB = readMode("sh-mode-b", shapeParams.baseModeB);
  shapeParams.bandMode2 = readMode("sh-mode-2", shapeParams.bandMode2);
  shapeParams.bandMode3 = readMode("sh-mode-3", shapeParams.bandMode3);
  shapeParams.bandMode4 = readMode("sh-mode-4", shapeParams.bandMode4);

  shapeParams.seed = u32("sh-seed", shapeParams.seed);
  shapeParams.zoom = num("sh-zoom", shapeParams.zoom);
  shapeParams.freq = num("sh-freq", shapeParams.freq);
  shapeParams.octaves = Math.max(1, num("sh-oct", shapeParams.octaves) | 0);
  shapeParams.lacunarity = num("sh-lac", shapeParams.lacunarity);
  shapeParams.gain = num("sh-gain", shapeParams.gain);
  shapeParams.threshold = num("sh-thr", shapeParams.threshold);
  shapeParams.seedAngle = num("sh-seedAngle", shapeParams.seedAngle);
  shapeParams.time = num("sh-time", shapeParams.time);
  shapeParams.voroMode = u32("sh-voroMode", shapeParams.voroMode);
  shapeParams.edgeK = num("sh-edgeK", shapeParams.edgeK);
  shapeParams.warpAmp = num("sh-warpAmp", shapeParams.warpAmp);
}

function readShapeTransform() {
  tileTransforms.shapeScale = num("sh-scale", tileTransforms.shapeScale);
  tileTransforms.shapeOffset[0] = num(
    "sh-pos-x",
    tileTransforms.shapeOffset[0],
  );
  tileTransforms.shapeOffset[1] = num(
    "sh-pos-y",
    tileTransforms.shapeOffset[1],
  );
  tileTransforms.shapeOffset[2] = num(
    "sh-pos-z",
    tileTransforms.shapeOffset[2],
  );

  tileTransforms.shapeVel = tileTransforms.shapeVel || [0, 0, 0];
  tileTransforms.shapeVel[0] = num("sh-vel-x", tileTransforms.shapeVel[0]);
  tileTransforms.shapeVel[1] = num("sh-vel-y", tileTransforms.shapeVel[1]);
  tileTransforms.shapeVel[2] = num("sh-vel-z", tileTransforms.shapeVel[2]);

  tileTransforms.shapeAxisScale = tileTransforms.shapeAxisScale || [1, 1, 1];
  tileTransforms.shapeAxisScale[0] = num(
    "sh-axis-x",
    tileTransforms.shapeAxisScale[0],
  );
  tileTransforms.shapeAxisScale[1] = num(
    "sh-axis-y",
    tileTransforms.shapeAxisScale[1],
  );
  tileTransforms.shapeAxisScale[2] = num(
    "sh-axis-z",
    tileTransforms.shapeAxisScale[2],
  );
}

function readDetail() {
  detailParams.mode1 = readMode("de-mode-1", detailParams.mode1);
  detailParams.mode2 = readMode("de-mode-2", detailParams.mode2);
  detailParams.mode3 = readMode("de-mode-3", detailParams.mode3);

  detailParams.seed = u32("de-seed", detailParams.seed);
  detailParams.zoom = num("de-zoom", detailParams.zoom);
  detailParams.freq = num("de-freq", detailParams.freq);
  detailParams.octaves = Math.max(1, num("de-oct", detailParams.octaves) | 0);
  detailParams.lacunarity = num("de-lac", detailParams.lacunarity);
  detailParams.gain = num("de-gain", detailParams.gain);
  detailParams.threshold = num("de-thr", detailParams.threshold);
  detailParams.seedAngle = num("de-seedAngle", detailParams.seedAngle);
  detailParams.time = num("de-time", detailParams.time);
  detailParams.voroMode = u32("de-voroMode", detailParams.voroMode);
  detailParams.edgeK = num("de-edgeK", detailParams.edgeK);
  detailParams.warpAmp = num("de-warpAmp", detailParams.warpAmp);
}

function readDetailTransform() {
  tileTransforms.detailScale = num("de-scale", tileTransforms.detailScale);
  tileTransforms.detailOffset[0] = num(
    "de-pos-x",
    tileTransforms.detailOffset[0],
  );
  tileTransforms.detailOffset[1] = num(
    "de-pos-y",
    tileTransforms.detailOffset[1],
  );
  tileTransforms.detailOffset[2] = num(
    "de-pos-z",
    tileTransforms.detailOffset[2],
  );

  tileTransforms.detailVel = tileTransforms.detailVel || [0, 0, 0];
  tileTransforms.detailVel[0] = num("de-vel-x", tileTransforms.detailVel[0]);
  tileTransforms.detailVel[1] = num("de-vel-y", tileTransforms.detailVel[1]);
  tileTransforms.detailVel[2] = num("de-vel-z", tileTransforms.detailVel[2]);

  tileTransforms.detailAxisScale = tileTransforms.detailAxisScale || [1, 1, 1];
  tileTransforms.detailAxisScale[0] = num(
    "de-axis-x",
    tileTransforms.detailAxisScale[0],
  );
  tileTransforms.detailAxisScale[1] = num(
    "de-axis-y",
    tileTransforms.detailAxisScale[1],
  );
  tileTransforms.detailAxisScale[2] = num(
    "de-axis-z",
    tileTransforms.detailAxisScale[2],
  );
}

function readPreview() {
  preview.cam.x = num("v-cx", preview.cam.x);
  preview.cam.y = num("v-cy", preview.cam.y);
  preview.cam.z = num("v-cz", preview.cam.z);
  preview.cam.yawDeg = num("v-yaw", preview.cam.yawDeg);
  preview.cam.pitchDeg = num("v-pitch", preview.cam.pitchDeg);
  preview.cam.fovYDeg = num("v-fov", preview.cam.fovYDeg);
  preview.exposure = num("v-exposure", preview.exposure);
  preview.sky[0] = num("v-sr", preview.sky[0]);
  preview.sky[1] = num("v-sg", preview.sky[1]);
  preview.sky[2] = num("v-sb", preview.sky[2]);
}

// ---- reproj helpers ----
function computeCoarseFactorFromScale(scale) {
  if (!scale || scale <= 0) return 1;
  return Math.max(1, Math.round(1.0 / Math.sqrt(scale)));
}

function getReprojPayload() {
  const enabled = !!reprojEnabled;
  const scale = reprojDefaultScale;
  return { enabled, scale, coarseFactor: computeCoarseFactorFromScale(scale) };
}

function ensureCoarseInPayload(payload) {
  if (!payload) return payload;
  if (payload.reproj && typeof payload.reproj.coarseFactor === "number")
    payload.coarseFactor = payload.reproj.coarseFactor;
  else if (reprojEnabled) {
    const rp = getReprojPayload();
    payload.reproj = payload.reproj || rp;
    payload.coarseFactor = rp.coarseFactor;
  } else payload.coarseFactor = payload.coarseFactor || 4;
  return payload;
}

// ---- UI wiring helpers ----
function attachByIds(ids, handler) {
  for (const id of ids) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  }
}

function attachTuningInputs() {
  const inputs = Array.from(
    document.querySelectorAll(
      'input[id^="t-"], select[id^="t-"], textarea[id^="t-"]',
    ),
  );
  if (!inputs.length) return;
  inputs.forEach((inp) => {
    inp.addEventListener("input", () => {
      sendTuningIfChanged();
    });
    inp.addEventListener("change", () => {
      sendTuningIfChanged();
    });
  });
}

async function runAfterBakeAndTuning(
  bakeRpcType,
  bakePayload = {},
  extraPayload = {},
) {
  setBusy(true, "Baking...");
  try {
    await rpc(bakeRpcType, safeClone(bakePayload));
    await sendTuningNow();
    readPreview();

    const cloudParams = readCloudParams();
    const payload = Object.assign(
      {
        weatherParams: safeClone(weatherParams),
        billowParams: safeClone(billowParams),
        weatherBParams: safeClone(weatherBParams),
        shapeParams: safeClone(shapeParams),
        detailParams: safeClone(detailParams),
        tileTransforms: safeClone(tileTransforms),
        preview: safeClone(preview),
        cloudParams,
      },
      extraPayload || {},
    );

    if (reprojEnabled) payload.reproj = getReprojPayload();
    ensureCoarseInPayload(payload);
    await rpc("runFrame", payload);
  } finally {
    setBusy(false);
  }
}

async function runFrameEnsuringTuning(payload = {}) {
  await sendTuningNow();
  ensureCoarseInPayload(payload);
  return rpc("runFrame", payload);
}

// ---- UI busy indicator ----
function setBusy(on, msg = "Working...") {
  const ov = $("busyOverlay"),
    m = $("busyMsg");
  if (!ov) return;
  if (m) m.textContent = msg;
  ov.style.display = on ? "flex" : "none";

  [
    "bake-weather",
    "bake-blue",
    "bake-shape128",
    "bake-detail32",
    "rebake-all",
    "render",
  ].forEach((id) => {
    const b = $(id);
    if (b) b.disabled = on;
  });
}

// ---- seeds, slice helpers ----
function setRandomSeedFor(obj, inputId) {
  const rnd32 = Math.floor(Math.random() * 10000) >>> 0;
  const t = ((Date.now() * Math.floor(Math.random() * 10000)) ^ rnd32) >>> 0;
  const seed = (t || 1) >>> 0;
  obj.seed = seed;

  const el = $(inputId);
  if (el) el.value = String(seed);

  return obj.seed;
}

function currentSlice() {
  return (+$("slice")?.value | 0) >>> 0;
}

function refreshSliceLabel() {
  const s = $("sliceLabel");
  if (s) s.textContent = String(currentSlice());
}

// ---- UI utilities ----
function showPanelsFor(pass) {
  const vis = (id, on) => {
    const e = $(id);
    if (e) e.style.display = on ? "" : "none";
  };
  vis("p-weather", pass === "weather");
  vis("p-shape128", pass === "shape128");
  vis("p-detail32", pass === "detail32");
  vis("p-blue", pass === "blue");
  vis("p-cloudParams", pass === "clouds");
  vis("p-preview", pass === "preview");
}

function sendSizes() {
  const dpr = DPR();
  const canvas = $("gpuCanvas");
  const cW = Math.max(1, Math.round(canvas.clientWidth));
  const cH = Math.max(1, Math.round(canvas.clientHeight));
  const pixelW = Math.max(1, Math.floor(cW * dpr));
  const pixelH = Math.max(1, Math.floor(cH * dpr));
  const dbgSizePx = Math.round(DBG_SIZE * dpr);

  rpc("resize", {
    main: { width: pixelW, height: pixelH },
    dbg: { width: dbgSizePx, height: dbgSizePx },
  }).catch((e) => console.warn("resize rpc failed", e));
}

// ---- populate mode selects ----
function populateAllModeSelects() {
  const weather = getWeatherCandidates();
  const vol4d = get4DCandidates();

  populateSelect("we-mode", weather, weatherParams.mode, { allowNone: false });
  populateSelect("we-billow-mode", weather, billowParams.mode, {
    allowNone: false,
  });
  populateSelect("we-bandb-mode", weather, weatherBParams.mode, {
    allowNone: false,
  });

  populateSelect("sh-mode-a", vol4d, shapeParams.baseModeA, {
    allowNone: false,
  });
  populateSelect("sh-mode-b", vol4d, shapeParams.baseModeB, {
    allowNone: true,
  });
  populateSelect("sh-mode-2", vol4d, shapeParams.bandMode2, {
    allowNone: false,
  });
  populateSelect("sh-mode-3", vol4d, shapeParams.bandMode3, {
    allowNone: false,
  });
  populateSelect("sh-mode-4", vol4d, shapeParams.bandMode4, {
    allowNone: false,
  });

  populateSelect("de-mode-1", vol4d, detailParams.mode1, { allowNone: false });
  populateSelect("de-mode-2", vol4d, detailParams.mode2, { allowNone: false });
  populateSelect("de-mode-3", vol4d, detailParams.mode3, { allowNone: false });
}

// ---- wire UI & initialization ----
async function wireUI() {
  $("pass")?.addEventListener("change", () => showPanelsFor($("pass").value));
  showPanelsFor($("pass")?.value || "preview");

  const reprojBtn = $("reproj-anim-toggle");
  const fpsSpan = $("fpsDisplay");

  reprojEnabled = false;
  animRunning = false;
  if (reprojBtn) reprojBtn.textContent = "Start x4 Anim";
  if (fpsSpan) fpsSpan.textContent = "-";

  reprojBtn?.addEventListener("click", async () => {
    if (!animRunning) {
      reprojEnabled = true;
      const rp = getReprojPayload();
      try {
        await rpc("setReproj", { reproj: rp, perf: null });
      } catch (e) {
        console.warn("Failed setReproj", e);
      }

      readPreview();
      const cloudParams = readCloudParams();

      setBusy(true, "Seeding animation...");
      try {
        await sendTuningNow();
        const payload = {
          weatherParams: safeClone(weatherParams),
          billowParams: safeClone(billowParams),
          weatherBParams: safeClone(weatherBParams),
          shapeParams: safeClone(shapeParams),
          detailParams: safeClone(detailParams),
          tileTransforms: safeClone(tileTransforms),
          preview: safeClone(preview),
          cloudParams,
          reproj: rp,
        };
        ensureCoarseInPayload(payload);
        await rpc("runFrame", payload);
        await rpc("startLoop", {});
        animRunning = true;
        if (reprojBtn) reprojBtn.textContent = "Stop Anim";
      } catch (e) {
        console.warn("start animation failed", e);
        reprojEnabled = false;
        animRunning = false;
        try {
          await rpc("setReproj", {
            reproj: {
              enabled: false,
              scale: reprojDefaultScale,
              coarseFactor: Math.round(1 / reprojDefaultScale),
            },
            perf: null,
          });
        } catch {}
        if (reprojBtn) reprojBtn.textContent = "Start x4 Anim";
      } finally {
        setBusy(false);
      }
    } else {
      try {
        await rpc("stopLoop", {});
      } catch (e) {
        console.warn("stopLoop failed", e);
      }
      animRunning = false;
      reprojEnabled = false;
      try {
        await rpc("setReproj", {
          reproj: {
            enabled: false,
            scale: reprojDefaultScale,
            coarseFactor: Math.round(1 / reprojDefaultScale),
          },
          perf: null,
        });
      } catch (e) {
        console.warn("Failed unset reproj", e);
      }
      if (reprojBtn) reprojBtn.textContent = "Start x4 Anim";
      const fpsEl = $("fpsDisplay");
      if (fpsEl) fpsEl.textContent = "-";
    }
  });

  $("render")?.addEventListener("click", async () => {
    setBusy(true, "Rendering...");
    try {
      readPreview();
      const cloudParams = readCloudParams();
      await sendTuningNow();

      const payload = {
        weatherParams: safeClone(weatherParams),
        billowParams: safeClone(billowParams),
        weatherBParams: safeClone(weatherBParams),
        shapeParams: safeClone(shapeParams),
        detailParams: safeClone(detailParams),
        tileTransforms: safeClone(tileTransforms),
        preview: safeClone(preview),
        cloudParams,
      };

      if (reprojEnabled) payload.reproj = getReprojPayload();
      ensureCoarseInPayload(payload);

      const { timings } = await rpc("runFrame", payload);
      console.log(
        "[BENCH] compute(ms):",
        timings.computeMs.toFixed(2),
        "render(ms):",
        timings.renderMs.toFixed(2),
        "total(ms):",
        timings.totalMs.toFixed(2),
      );
    } finally {
      setBusy(false);
    }
  });

  // Weather: any change rebakes weather
  attachByIds(
    [
      "we-mode",
      "we-seed",
      "we-zoom",
      "we-freq",
      "we-oct",
      "we-lac",
      "we-gain",
      "we-thr",
      "we-seedAngle",
      "we-time",
      "we-voroMode",
      "we-edgeK",
      "we-warpAmp",
      "we-billow-enable",
      "we-billow-mode",
      "we-billow-seed",
      "we-billow-scale",
      "we-billow-zoom",
      "we-billow-freq",
      "we-billow-oct",
      "we-billow-lac",
      "we-billow-gain",
      "we-billow-thr",
      "we-billow-seedAngle",
      "we-billow-time",
      "we-billow-voroMode",
      "we-billow-edgeK",
      "we-billow-warpAmp",

      "we-bandb-enable",
      "we-bandb-mode",
      "we-bandb-seed",
      "we-bandb-scale",
      "we-bandb-zoom",
      "we-bandb-freq",
      "we-bandb-oct",
      "we-bandb-lac",
      "we-bandb-gain",
      "we-bandb-thr",
      "we-bandb-seedAngle",
      "we-bandb-time",
      "we-bandb-voroMode",
      "we-bandb-edgeK",
      "we-bandb-warpAmp",
    ],
    async () => {
      readWeather();
      readWeatherG();
      readWeatherB();
      await runAfterBakeAndTuning("bakeWeather", {
        weatherParams: safeClone(weatherParams),
        billowParams: safeClone(billowParams),
        weatherBParams: safeClone(weatherBParams),
      });
    },
  );

  attachByIds(
    [
      "we-scale",
      "we-pos-x",
      "we-pos-y",
      "we-pos-z",
      "we-axis-x",
      "we-axis-y",
      "we-axis-z",
    ],
    async () => {
      try {
        readWeatherTransform();
        await setTileTransformsRPC(tileTransforms);

        await sendTuningNow();
        readPreview();
        const cloudParams = readCloudParams();

        const payload = {
          weatherParams: safeClone(weatherParams),
          billowParams: safeClone(billowParams),
          weatherBParams: safeClone(weatherBParams),
          shapeParams: safeClone(shapeParams),
          detailParams: safeClone(detailParams),
          tileTransforms: safeClone(tileTransforms),
          preview: safeClone(preview),
          cloudParams,
        };
        if (reprojEnabled) payload.reproj = getReprojPayload();
        ensureCoarseInPayload(payload);
        await rpc("runFrame", payload);
      } catch (e) {
        console.warn("weather transform update failed", e);
      }
    },
  );

  // Blue: any change rebakes blue
  attachByIds(["bn-seed"], async () => {
    readBlue();
    await runAfterBakeAndTuning("bakeBlue", {
      blueParams: safeClone(blueParams),
    });
  });

  // Shape: modes/noise params rebake, transforms do not
  attachByIds(
    [
      "sh-mode-a",
      "sh-mode-b",
      "sh-mode-2",
      "sh-mode-3",
      "sh-mode-4",
      "sh-seed",
      "sh-zoom",
      "sh-freq",
      "sh-oct",
      "sh-lac",
      "sh-gain",
      "sh-thr",
      "sh-seedAngle",
      "sh-time",
      "sh-voroMode",
      "sh-edgeK",
      "sh-warpAmp",
    ],
    async () => {
      readShape();
      readShapeTransform();
      await runAfterBakeAndTuning("bakeShape", {
        shapeParams: safeClone(shapeParams),
        tileTransforms: safeClone(tileTransforms),
      });
    },
  );

  // Detail: modes/noise params rebake, transforms do not
  attachByIds(
    [
      "de-mode-1",
      "de-mode-2",
      "de-mode-3",
      "de-seed",
      "de-zoom",
      "de-freq",
      "de-oct",
      "de-lac",
      "de-gain",
      "de-thr",
      "de-seedAngle",
      "de-time",
      "de-voroMode",
      "de-edgeK",
      "de-warpAmp",
    ],
    async () => {
      readDetail();
      readDetailTransform();
      await runAfterBakeAndTuning("bakeDetail", {
        detailParams: safeClone(detailParams),
        tileTransforms: safeClone(tileTransforms),
      });
    },
  );

  attachByIds(
    [
      "sh-scale",
      "sh-pos-x",
      "sh-pos-y",
      "sh-pos-z",
      "sh-vel-x",
      "sh-vel-y",
      "sh-vel-z",
      "sh-axis-x",
      "sh-axis-y",
      "sh-axis-z",
    ],
    async () => {
      try {
        readShapeTransform();
        await setTileTransformsRPC(tileTransforms);

        await sendTuningNow();
        readPreview();
        const cloudParams = readCloudParams();

        const payload = {
          weatherParams: safeClone(weatherParams),
          billowParams: safeClone(billowParams),
          weatherBParams: safeClone(weatherBParams),
          shapeParams: safeClone(shapeParams),
          detailParams: safeClone(detailParams),
          tileTransforms: safeClone(tileTransforms),
          preview: safeClone(preview),
          cloudParams,
        };
        if (reprojEnabled) payload.reproj = getReprojPayload();
        ensureCoarseInPayload(payload);
        await rpc("runFrame", payload);
      } catch (e) {
        console.warn("shape transform update failed", e);
      }
    },
  );

  attachByIds(
    [
      "de-scale",
      "de-pos-x",
      "de-pos-y",
      "de-pos-z",
      "de-vel-x",
      "de-vel-y",
      "de-vel-z",
      "de-axis-x",
      "de-axis-y",
      "de-axis-z",
    ],
    async () => {
      try {
        readDetailTransform();
        await setTileTransformsRPC(tileTransforms);

        await sendTuningNow();
        readPreview();
        const cloudParams = readCloudParams();

        const payload = {
          weatherParams: safeClone(weatherParams),
          billowParams: safeClone(billowParams),
          weatherBParams: safeClone(weatherBParams),
          shapeParams: safeClone(shapeParams),
          detailParams: safeClone(detailParams),
          tileTransforms: safeClone(tileTransforms),
          preview: safeClone(preview),
          cloudParams,
        };
        if (reprojEnabled) payload.reproj = getReprojPayload();
        ensureCoarseInPayload(payload);
        await rpc("runFrame", payload);
      } catch (e) {
        console.warn("detail transform update failed", e);
      }
    },
  );

  // cloud params panel: send tuning then runFrame
  {
    const panel = $("p-cloudParams");
    if (panel) {
      panel.querySelectorAll("input,select,textarea").forEach((inp) => {
        inp.addEventListener("input", async () => {
          readPreview();
          const cloudParams = readCloudParams();
          await sendTuningNow();
          const payload = {
            weatherParams: safeClone(weatherParams),
            billowParams: safeClone(billowParams),
            weatherBParams: safeClone(weatherBParams),
            shapeParams: safeClone(shapeParams),
            detailParams: safeClone(detailParams),
            tileTransforms: safeClone(tileTransforms),
            preview: safeClone(preview),
            cloudParams,
          };
          if (reprojEnabled) payload.reproj = getReprojPayload();
          ensureCoarseInPayload(payload);
          try {
            await rpc("runFrame", payload);
          } catch (e) {
            console.warn("runFrame failed (cloudParams)", e);
          }
        });
      });
    }
  }

  // preview panel: send tuning then runFrame
  {
    const panel = $("p-preview");
    if (panel) {
      panel.querySelectorAll("input,select,textarea").forEach((inp) => {
        inp.addEventListener("input", async () => {
          readPreview();
          const cloudParams = readCloudParams();
          await sendTuningNow();
          const payload = {
            weatherParams: safeClone(weatherParams),
            billowParams: safeClone(billowParams),
            weatherBParams: safeClone(weatherBParams),
            shapeParams: safeClone(shapeParams),
            detailParams: safeClone(detailParams),
            tileTransforms: safeClone(tileTransforms),
            preview: safeClone(preview),
            cloudParams,
          };
          if (reprojEnabled) payload.reproj = getReprojPayload();
          ensureCoarseInPayload(payload);
          try {
            await rpc("runFrame", payload);
          } catch (e) {
            console.warn("runFrame failed (preview)", e);
          }
        });
      });
    }
  }

  attachTuningInputs();

  // bake buttons
  $("bake-weather")?.addEventListener("click", async () => {
    readWeather();
    readWeatherG();
    readWeatherB();
    await runAfterBakeAndTuning("bakeWeather", {
      weatherParams: safeClone(weatherParams),
      billowParams: safeClone(billowParams),
      weatherBParams: safeClone(weatherBParams),
    });
  });

  $("bake-blue")?.addEventListener("click", async () => {
    readBlue();
    await runAfterBakeAndTuning("bakeBlue", {
      blueParams: safeClone(blueParams),
    });
  });

  $("bake-shape128")?.addEventListener("click", async () => {
    readShape();
    readShapeTransform();
    await runAfterBakeAndTuning("bakeShape", {
      shapeParams: safeClone(shapeParams),
      tileTransforms: safeClone(tileTransforms),
    });
  });

  $("bake-detail32")?.addEventListener("click", async () => {
    readDetail();
    readDetailTransform();
    await runAfterBakeAndTuning("bakeDetail", {
      detailParams: safeClone(detailParams),
      tileTransforms: safeClone(tileTransforms),
    });
  });

  $("rebake-all")?.addEventListener("click", async () => {
    setBusy(true, "Rebaking all...");
    try {
      readWeather();
      readWeatherG();
      readWeatherB();
      readBlue();
      readShape();
      readShapeTransform();
      readDetail();
      readDetailTransform();

      await rpc("bakeAll", {
        weatherParams: safeClone(weatherParams),
        billowParams: safeClone(billowParams),
        weatherBParams: safeClone(weatherBParams),
        blueParams: safeClone(blueParams),
        shapeParams: safeClone(shapeParams),
        detailParams: safeClone(detailParams),
        tileTransforms: safeClone(tileTransforms),
      });

      await sendTuningNow();
      const cloudParams = readCloudParams();

      const payload = {
        weatherParams: safeClone(weatherParams),
        billowParams: safeClone(billowParams),
        weatherBParams: safeClone(weatherBParams),
        shapeParams: safeClone(shapeParams),
        detailParams: safeClone(detailParams),
        tileTransforms: safeClone(tileTransforms),
        preview: safeClone(preview),
        cloudParams,
      };

      if (reprojEnabled) payload.reproj = getReprojPayload();
      ensureCoarseInPayload(payload);
      await rpc("runFrame", payload);
    } finally {
      setBusy(false);
    }
  });

  // slice slider -> immediate setSlice
  $("slice")?.addEventListener("input", () => {
    refreshSliceLabel();
    rpc("setSlice", { slice: (+$("slice").value | 0) >>> 0 }).catch((e) =>
      console.warn("setSlice failed", e),
    );
  });

  // seed buttons
  $("seed-weather")?.addEventListener("click", async () => {
    const s = setRandomSeedFor(weatherParams, "we-seed");
    setLog("new weather seed", s);
    setBusy(true, "Seeding weather...");
    try {
      readWeather();
      readWeatherG();
      readWeatherB();
      await runAfterBakeAndTuning("bakeWeather", {
        weatherParams: safeClone(weatherParams),
        billowParams: safeClone(billowParams),
        weatherBParams: safeClone(weatherBParams),
      });
    } finally {
      setBusy(false);
    }
  });

  $("seed-blue")?.addEventListener("click", async () => {
    const s = setRandomSeedFor(blueParams, "bn-seed");
    setLog("new blue seed", s);
    setBusy(true, "Seeding blue...");
    try {
      readBlue();
      await runAfterBakeAndTuning("bakeBlue", {
        blueParams: safeClone(blueParams),
      });
    } finally {
      setBusy(false);
    }
  });

  $("seed-shape")?.addEventListener("click", async () => {
    const s = setRandomSeedFor(shapeParams, "sh-seed");
    setLog("new shape seed", s);
    setBusy(true, "Seeding shape...");
    try {
      readShape();
      readShapeTransform();
      await runAfterBakeAndTuning("bakeShape", {
        shapeParams: safeClone(shapeParams),
        tileTransforms: safeClone(tileTransforms),
      });
    } finally {
      setBusy(false);
    }
  });

  $("seed-detail")?.addEventListener("click", async () => {
    const s = setRandomSeedFor(detailParams, "de-seed");
    setLog("new detail seed", s);
    setBusy(true, "Seeding detail...");
    try {
      readDetail();
      readDetailTransform();
      await runAfterBakeAndTuning("bakeDetail", {
        detailParams: safeClone(detailParams),
        tileTransforms: safeClone(tileTransforms),
      });
    } finally {
      setBusy(false);
    }
  });

  window.addEventListener("resize", () => sendSizes());
}

// ---- init ----
async function init() {
  document.body.insertAdjacentHTML("beforeend", html);

  const setIf = (id, val) => {
    const el = $(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!val;
    else el.value = String(val);
  };

  // defaults for numeric fields (modes are populated after worker init)
  setIf("we-seed", weatherParams.seed);
  setIf("we-zoom", weatherParams.zoom);
  setIf("we-freq", weatherParams.freq);
  setIf("we-oct", weatherParams.octaves);
  setIf("we-lac", weatherParams.lacunarity);
  setIf("we-gain", weatherParams.gain);
  setIf("we-thr", weatherParams.threshold);
  setIf("we-seedAngle", weatherParams.seedAngle);
  setIf("we-time", weatherParams.time);
  setIf("we-voroMode", weatherParams.voroMode);
  setIf("we-edgeK", weatherParams.edgeK);
  setIf("we-warpAmp", weatherParams.warpAmp);

  setIf("we-billow-enable", billowParams.enabled);
  setIf("we-billow-seed", billowParams.seed);
  setIf("we-billow-scale", billowParams.scale);
  setIf("we-billow-zoom", billowParams.zoom);
  setIf("we-billow-freq", billowParams.freq);
  setIf("we-billow-oct", billowParams.octaves);
  setIf("we-billow-lac", billowParams.lacunarity);
  setIf("we-billow-gain", billowParams.gain);
  setIf("we-billow-thr", billowParams.threshold);
  setIf("we-billow-seedAngle", billowParams.seedAngle);
  setIf("we-billow-time", billowParams.time);
  setIf("we-billow-voroMode", billowParams.voroMode);
  setIf("we-billow-edgeK", billowParams.edgeK);
  setIf("we-billow-warpAmp", billowParams.warpAmp);

  setIf("we-scale", tileTransforms.weatherScale);
  setIf("we-pos-x", tileTransforms.weatherOffset[0]);
  setIf("we-pos-y", tileTransforms.weatherOffset[1]);
  setIf("we-pos-z", tileTransforms.weatherOffset[2]);
  setIf("we-axis-x", tileTransforms.weatherAxisScale[0]);
  setIf("we-axis-y", tileTransforms.weatherAxisScale[1]);
  setIf("we-axis-z", tileTransforms.weatherAxisScale[2]);

  setIf("sh-axis-x", tileTransforms.shapeAxisScale[0]);
  setIf("sh-axis-y", tileTransforms.shapeAxisScale[1]);
  setIf("sh-axis-z", tileTransforms.shapeAxisScale[2]);

  setIf("de-axis-x", tileTransforms.detailAxisScale[0]);
  setIf("de-axis-y", tileTransforms.detailAxisScale[1]);
  setIf("de-axis-z", tileTransforms.detailAxisScale[2]);

  setIf("we-bandb-enable", weatherBParams.enabled);
  setIf("we-bandb-seed", weatherBParams.seed);
  setIf("we-bandb-scale", weatherBParams.scale);
  setIf("we-bandb-zoom", weatherBParams.zoom);
  setIf("we-bandb-freq", weatherBParams.freq);
  setIf("we-bandb-oct", weatherBParams.octaves);
  setIf("we-bandb-lac", weatherBParams.lacunarity);
  setIf("we-bandb-gain", weatherBParams.gain);
  setIf("we-bandb-thr", weatherBParams.threshold);
  setIf("we-bandb-seedAngle", weatherBParams.seedAngle);
  setIf("we-bandb-time", weatherBParams.time);
  setIf("we-bandb-voroMode", weatherBParams.voroMode);
  setIf("we-bandb-edgeK", weatherBParams.edgeK);
  setIf("we-bandb-warpAmp", weatherBParams.warpAmp);

  setIf("bn-seed", blueParams.seed);

  setIf("sh-seed", shapeParams.seed);
  setIf("sh-zoom", shapeParams.zoom);
  setIf("sh-freq", shapeParams.freq);
  setIf("sh-oct", shapeParams.octaves);
  setIf("sh-lac", shapeParams.lacunarity);
  setIf("sh-gain", shapeParams.gain);
  setIf("sh-thr", shapeParams.threshold);
  setIf("sh-seedAngle", shapeParams.seedAngle);
  setIf("sh-time", shapeParams.time);
  setIf("sh-voroMode", shapeParams.voroMode);
  setIf("sh-edgeK", shapeParams.edgeK);
  setIf("sh-warpAmp", shapeParams.warpAmp);

  setIf("sh-scale", tileTransforms.shapeScale);
  setIf("sh-pos-x", tileTransforms.shapeOffset[0]);
  setIf("sh-pos-y", tileTransforms.shapeOffset[1]);
  setIf("sh-pos-z", tileTransforms.shapeOffset[2]);
  setIf("sh-vel-x", tileTransforms.shapeVel[0]);
  setIf("sh-vel-y", tileTransforms.shapeVel[1]);
  setIf("sh-vel-z", tileTransforms.shapeVel[2]);

  setIf("de-seed", detailParams.seed);
  setIf("de-zoom", detailParams.zoom);
  setIf("de-freq", detailParams.freq);
  setIf("de-oct", detailParams.octaves);
  setIf("de-lac", detailParams.lacunarity);
  setIf("de-gain", detailParams.gain);
  setIf("de-thr", detailParams.threshold);
  setIf("de-seedAngle", detailParams.seedAngle);
  setIf("de-time", detailParams.time);
  setIf("de-voroMode", detailParams.voroMode);
  setIf("de-edgeK", detailParams.edgeK);
  setIf("de-warpAmp", detailParams.warpAmp);

  setIf("de-scale", tileTransforms.detailScale);
  setIf("de-pos-x", tileTransforms.detailOffset[0]);
  setIf("de-pos-y", tileTransforms.detailOffset[1]);
  setIf("de-pos-z", tileTransforms.detailOffset[2]);
  setIf("de-vel-x", tileTransforms.detailVel[0]);
  setIf("de-vel-y", tileTransforms.detailVel[1]);
  setIf("de-vel-z", tileTransforms.detailVel[2]);

  // cloud params & tuning defaults
  setIf("c-az", preview.sun.azDeg);
  setIf("c-el", preview.sun.elDeg);
  setIf("c-bloom", preview.sun.bloom);

  setIf("p-coverage", 1);
  setIf("p-density", 100);
  setIf("p-beer", 6);
  setIf("p-clamp", 0.15);
  setIf("p-ins", 0.7);
  setIf("p-outs", 0.2);
  setIf("p-ivo", 0.3);
  setIf("p-sI", 0.25);
  setIf("p-sE", 16);
  setIf("p-ambOut", 1.0);
  setIf("p-ambMin", 0.25);
  setIf("p-anvil", 0.1);

  setIf("t-maxSteps", 256);
  setIf("t-minStep", 0.003);
  setIf("t-maxStep", 0.1);
  setIf("t-sunSteps", 4);
  setIf("t-phaseJitter", 1.0);
  setIf("t-stepJitter", 0.08);
  setIf("t-baseJitter", 0.15);
  setIf("t-topJitter", 0.1);
  setIf("t-lodBiasWeather", 1.5);
  setIf("t-nearFluffDist", 60);
  setIf("t-nearDensityMult", 2.5);
  setIf("t-farStart", 800);
  setIf("t-farFull", 2500);
  setIf("t-raySmoothDens", 0.5);
  setIf("t-raySmoothSun", 0.5);

  // preview
  setIf("v-cx", preview.cam.x);
  setIf("v-cy", preview.cam.y);
  setIf("v-cz", preview.cam.z);
  setIf("v-fov", preview.cam.fovYDeg);
  setIf("v-yaw", preview.cam.yawDeg);
  setIf("v-pitch", preview.cam.pitchDeg);
  setIf("v-exposure", preview.exposure);
  setIf("v-sr", preview.sky[0]);
  setIf("v-sg", preview.sky[1]);
  setIf("v-sb", preview.sky[2]);

  // spawn worker
  worker = new Worker(wrkr, { type: "module" });
  worker.onmessage = (ev) => {
    const { id, type, ok, data, error } = ev.data || {};
    if (id && _pending.has(id)) {
      const { resolve, reject } = _pending.get(id);
      _pending.delete(id);
      return ok ? resolve(data) : reject(error || new Error("Worker error"));
    }
    if (type === "log") console.log(...(data || []));
    if (type === "frame") {
      const info = data || {};
      const fps = info.fps ? Math.round(info.fps * 100) / 100 : "-";
      const fpsEl = $("fpsDisplay");
      if (fpsEl) fpsEl.textContent = String(fps);
    }
    if (type === "loop-stopped") {
      animRunning = false;
      const btn = $("reproj-anim-toggle");
      if (btn) btn.textContent = "Start x4 Anim";
      const fpsEl = $("fpsDisplay");
      if (fpsEl) fpsEl.textContent = "-";
    }
  };

  // transfer canvases to worker
  const mainCanvas = $("gpuCanvas");
  const dbgIds = [
    "dbg-weather",
    "dbg-weather-g",
    "dbg-weather-b",
    "dbg-r",
    "dbg-g",
    "dbg-blue",
  ];

  const offscreenMain = mainCanvas.transferControlToOffscreen();
  const offscreenDbg = Object.fromEntries(
    dbgIds.map((id) => [id, $(id).transferControlToOffscreen()]),
  );

  const initRes = await rpc(
    "init",
    {
      canvases: {
        main: offscreenMain,
        dbg: {
          weather: offscreenDbg["dbg-weather"],
          weatherG: offscreenDbg["dbg-weather-g"],
          weatherB: offscreenDbg["dbg-weather-b"],
          shapeR: offscreenDbg["dbg-r"],
          detailR: offscreenDbg["dbg-g"],
          blue: offscreenDbg["dbg-blue"],
        },
      },
      constants: { SHAPE_SIZE, DETAIL_SIZE, WEATHER_W, WEATHER_H, BN_W, BN_H },
    },
    [
      offscreenMain,
      offscreenDbg["dbg-weather"],
      offscreenDbg["dbg-weather-g"],
      offscreenDbg["dbg-weather-b"],
      offscreenDbg["dbg-r"],
      offscreenDbg["dbg-g"],
      offscreenDbg["dbg-blue"],
    ],
  );

  ENTRY_POINTS = Array.isArray(initRes?.entryPoints)
    ? initRes.entryPoints.slice()
    : [];
  populateAllModeSelects();

  // set mode selects to defaults after population
  {
    const setSel = (id, val) => {
      const el = $(id);
      if (!el) return;
      el.value = String(val || "");
    };
    setSel("we-mode", weatherParams.mode);
    setSel("we-billow-mode", billowParams.mode);
    setSel("we-bandb-mode", weatherBParams.mode);

    setSel("sh-mode-a", shapeParams.baseModeA);
    setSel("sh-mode-b", shapeParams.baseModeB);
    setSel("sh-mode-2", shapeParams.bandMode2);
    setSel("sh-mode-3", shapeParams.bandMode3);
    setSel("sh-mode-4", shapeParams.bandMode4);

    setSel("de-mode-1", detailParams.mode1);
    setSel("de-mode-2", detailParams.mode2);
    setSel("de-mode-3", detailParams.mode3);
  }

  sendSizes();

  try {
    await setTileTransformsRPC(tileTransforms);
  } catch {}

  setBusy(true, "Initializing...");
  try {
    refreshSliceLabel();

    await rpc("bakeAll", {
      weatherParams: safeClone(weatherParams),
      billowParams: safeClone(billowParams),
      weatherBParams: safeClone(weatherBParams),
      blueParams: safeClone(blueParams),
      shapeParams: safeClone(shapeParams),
      detailParams: safeClone(detailParams),
      tileTransforms: safeClone(tileTransforms),
    });

    await rpc("setReproj", { reproj: getReprojPayload(), perf: null });
    try {
      await sendTuningNow(true);
    } catch (e) {
      console.warn("initial sendTuningNow failed", e);
    }

    const cloudParams = readCloudParams();
    const payload = {
      weatherParams: safeClone(weatherParams),
      billowParams: safeClone(billowParams),
      weatherBParams: safeClone(weatherBParams),
      shapeParams: safeClone(shapeParams),
      detailParams: safeClone(detailParams),
      tileTransforms: safeClone(tileTransforms),
      preview: safeClone(preview),
      cloudParams,
    };

    if (reprojEnabled) payload.reproj = getReprojPayload();
    ensureCoarseInPayload(payload);

    const { timings } = await rpc("runFrame", payload);
    console.log("[BENCH] init frame timings:", timings);
  } finally {
    setBusy(false);
  }

  await wireUI();
}

// start
init().catch((err) => {
  console.error(err);
  const pre = document.createElement("pre");
  pre.textContent = err && err.stack ? err.stack : String(err);
  document.body.appendChild(pre);
});
