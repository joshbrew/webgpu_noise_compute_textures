// clouds-ui.js
// Immediate UI -> worker sync. No debounce. Only send tuning when values change.

import html from './clouds.html';
import wrkr from './cloudTest.worker.js';

let worker;

// Constants (mirror worker)
const SHAPE_SIZE = 128, DETAIL_SIZE = 32, WEATHER_W = 512, WEATHER_H = 512, BN_W = 256, BN_H = 256;
const DBG_SIZE = 224;
const DPR = () => Math.max(1, Math.floor(window.devicePixelRatio || 1));

// Default preview + noise param blocks (each has seed)
const preview = {
  cam: { x: -1, y: 0, z: -1, yawDeg: 35, pitchDeg: 1, fovYDeg: 60 },
  exposure: 1.35,
  sky: [0.55, 0.70, 0.95],
  layer: 0,
  sun: { azDeg: 45, elDeg: 22, bloom: 0.0 }
};

// FBM / Weather params (pure FBM)
const weatherParams = {
  zoom: 2.0,
  freq: 1.0,
  octaves: 5,
  lacunarity: 2.0,
  seedAngle: Math.PI / 2,
  gain: 0.5,
  threshold: 0.0,
  seed: 123456789000
};

// Billow (decoupled)
const billowParams = {
  enabled: true,
  zoom: 2.0,
  freq: 1.5,
  octaves: 4,
  lacunarity: 2.0,
  seedAngle: Math.PI / 2,
  gain: 0.5,
  threshold: 0.0,
  scale: 1.0,
  pos: [0.0, 0.0, 0.0],
  vel: [0.0, 0.0, 0.0],
  seed: 123456789000
};

const shapeParams = { zoom: 4, freq: 1.0, octaves: 1, lacunarity: 2.0, seedAngle: Math.PI/2, gain:0.5, seed: Date.now() };
const detailParams = { zoom: 4, freq: 1.0, octaves: 4, lacunarity: 2.0, seedAngle: Math.PI/2, gain:0.5, seed: Date.now() };
const blueParams    = { seed: Date.now() & 0xFFFFFFFF };

// Tile transforms (shape & detail)
const tileTransforms = {
  shapeOffset: [0.0, 0.0, 0.0],
  detailOffset: [0.0, 0.0, 0.0],
  shapeScale: 0.1,
  detailScale: 1.0,
  shapeVel: [ 0.2, 0.0, 0.0 ],
  detailVel: [ -0.02, 0.0, 0.0 ]
};

let reprojEnabled = false;
const reprojDefaultScale = 1/4;
let animRunning = false;

// ---- DOM helpers ----
const $ = id => document.getElementById(id);
const num = (id, fallback) => { const el = $(id); if (!el) return fallback; const v = +el.value; return Number.isFinite(v) ? v : fallback; };

// ---- small utilities ----
const safeClone = (o) => {
  try { return JSON.parse(JSON.stringify(o)); } catch (e) { return Object.assign({}, o); }
};
function setLog(...args) { try { console.log('[UI]', ...args); } catch { } }

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

// ---- Tile transforms RPC helper (NEW) ----
async function setTileTransformsRPC(tt) {
  return rpc('setTileTransforms', { tileTransforms: safeClone(tt) });
}

// ---- TUNING helpers (send only if changed) ----
let lastTuningSent = null;
function tuningChanged(curr, prev) {
  if (!prev) return true;
  const k1 = Object.keys(curr), k2 = Object.keys(prev);
  if (k1.length !== k2.length) return true;
  for (const k of k1) if (curr[k] !== prev[k]) return true;
  return false;
}
function cloneTuning(t) { return Object.assign({}, t); }

function readTuning() {
  return {
    maxSteps: +($('t-maxSteps')?.value || 256) | 0,
    minStep: +($('t-minStep')?.value || 0.003),
    maxStep: +($('t-maxStep')?.value || 0.10),
    sunSteps: +($('t-sunSteps')?.value || 4) | 0,
    phaseJitter: +($('t-phaseJitter')?.value || 1.0),
    stepJitter: +($('t-stepJitter')?.value || 0.08),
    baseJitterFrac: +($('t-baseJitter')?.value || 0.15),
    topJitterFrac: +($('t-topJitter')?.value || 0.10),
    lodBiasWeather: +($('t-lodBiasWeather')?.value || 1.5),
    nearFluffDist: +($('t-nearFluffDist')?.value || 60.0),
    nearDensityMult: +($('t-nearDensityMult')?.value || 2.5),
    farStart: +($('t-farStart')?.value || 800.0),
    farFull: +($('t-farFull')?.value || 2500.0),
    raySmoothDens: +($('t-raySmoothDens')?.value || 0.50),
    raySmoothSun: +($('t-raySmoothSun')?.value || 0.50)
  };
}

async function setTuningRPC(tuningObj) { return rpc('setTuning', { tuning: tuningObj }); }

function sendTuningIfChanged() {
  try {
    const t = readTuning();
    if (!tuningChanged(t, lastTuningSent)) return;
    setTuningRPC(t).then(res => {
      lastTuningSent = cloneTuning(t);
      if (res && res.tuning) setLog('worker ack tuning', res.tuning);
    }).catch(err => {
      console.warn('sendTuningIfChanged: setTuningRPC failed', err);
    });
  } catch (e) {
    console.warn('sendTuningIfChanged error', e);
  }
}

async function sendTuningNow(force = false) {
  const t = readTuning();
  if (!force && !tuningChanged(t, lastTuningSent)) return lastTuningSent;
  const res = await setTuningRPC(t);
  lastTuningSent = cloneTuning(t);
  if (res && res.tuning) setLog('worker ack tuning (now)', res.tuning);
  return lastTuningSent;
}

// ---- UI read helpers for other blocks ----
function readCloudParams() {
  const sunAz = num('c-az', preview.sun.azDeg), sunEl = num('c-el', preview.sun.elDeg), sunBloom = num('c-bloom', preview.sun.bloom);
  preview.sun.azDeg = sunAz; preview.sun.elDeg = sunEl; preview.sun.bloom = sunBloom;
  return {
    globalCoverage: num('p-coverage', 1),
    globalDensity: num('p-density', 100),
    cloudAnvilAmount: num('p-anvil', 0.10),
    cloudBeer: num('p-beer', 6),
    attenuationClamp: num('p-clamp', 0.15),
    inScatterG: num('p-ins', 0.70),
    silverIntensity: num('p-sI', 0.25),
    silverExponent: num('p-sE', 16.0),
    outScatterG: num('p-outs', 0.20),
    inVsOut: num('p-ivo', 0.30),
    outScatterAmbientAmt: num('p-ambOut', 1.00),
    ambientMinimum: num('p-ambMin', 0.25),
    sunColor: [1.0, 0.8, 0.5],
    sunAzDeg: sunAz, sunElDeg: sunEl, sunBloom
  };
}

function readWeather() {
  Object.assign(weatherParams, {
    zoom: num('we-zoom', weatherParams.zoom),
    freq: num('we-freq', weatherParams.freq),
    octaves: Math.max(1, num('we-oct', weatherParams.octaves) | 0),
    lacunarity: num('we-lac', weatherParams.lacunarity),
    gain: num('we-gain', weatherParams.gain),
    threshold: num('we-thr', weatherParams.threshold)
  });
}

function readBillow() {
  billowParams.enabled = !!$('we-billow-enable')?.checked;
  billowParams.zoom = num('we-billow-zoom', billowParams.zoom);
  billowParams.freq = num('we-billow-freq', billowParams.freq);
  billowParams.octaves = Math.max(1, num('we-billow-oct', billowParams.octaves) | 0);
  billowParams.lacunarity = num('we-billow-lac', billowParams.lacunarity);
  billowParams.seedAngle = Number($('we-billow-seedAngle')?.value) || billowParams.seedAngle;
  billowParams.gain = num('we-billow-gain', billowParams.gain);
  billowParams.threshold = num('we-billow-thr', billowParams.threshold);
  billowParams.scale = num('we-billow-scale', billowParams.scale);

  billowParams.pos[0] = num('we-billow-pos-x', billowParams.pos[0]);
  billowParams.pos[1] = num('we-billow-pos-y', billowParams.pos[1]);
  billowParams.pos[2] = num('we-billow-pos-z', billowParams.pos[2]);
  billowParams.vel[0] = num('we-billow-vel-x', billowParams.vel[0]);
  billowParams.vel[1] = num('we-billow-vel-y', billowParams.vel[1]);
  billowParams.vel[2] = num('we-billow-vel-z', billowParams.vel[2]);
}

function readShape() {
  Object.assign(shapeParams, {
    zoom: num('sh-zoom', shapeParams.zoom),
    freq: num('sh-freq', shapeParams.freq),
    octaves: Math.max(1, num('sh-oct', shapeParams.octaves) | 0),
    lacunarity: num('sh-lac', shapeParams.lacunarity),
    gain: num('sh-gain', shapeParams.gain),
    threshold: num('sh-thr', shapeParams.threshold)
  });
}

function readShapeTransform() {
  tileTransforms.shapeScale = num('sh-scale', tileTransforms.shapeScale);
  tileTransforms.shapeOffset[0] = num('sh-pos-x', tileTransforms.shapeOffset[0]);
  tileTransforms.shapeOffset[1] = num('sh-pos-y', tileTransforms.shapeOffset[1]);
  tileTransforms.shapeOffset[2] = num('sh-pos-z', tileTransforms.shapeOffset[2]);
  tileTransforms.shapeVel = tileTransforms.shapeVel || [0,0,0];
  tileTransforms.shapeVel[0] = num('sh-vel-x', tileTransforms.shapeVel[0]);
  tileTransforms.shapeVel[1] = num('sh-vel-y', tileTransforms.shapeVel[1]);
  tileTransforms.shapeVel[2] = num('sh-vel-z', tileTransforms.shapeVel[2]);
}

function readDetail() {
  Object.assign(detailParams, {
    zoom: num('de-zoom', detailParams.zoom),
    freq: num('de-freq', detailParams.freq),
    octaves: Math.max(1, num('de-oct', detailParams.octaves) | 0),
    lacunarity: num('de-lac', detailParams.lacunarity),
    gain: num('de-gain', detailParams.gain),
    threshold: num('de-thr', detailParams.threshold)
  });
}

function readDetailTransform() {
  tileTransforms.detailScale = num('de-scale', tileTransforms.detailScale);
  tileTransforms.detailOffset[0] = num('de-pos-x', tileTransforms.detailOffset[0]);
  tileTransforms.detailOffset[1] = num('de-pos-y', tileTransforms.detailOffset[1]);
  tileTransforms.detailOffset[2] = num('de-pos-z', tileTransforms.detailOffset[2]);
  tileTransforms.detailVel = tileTransforms.detailVel || [0,0,0];
  tileTransforms.detailVel[0] = num('de-vel-x', tileTransforms.detailVel[0]);
  tileTransforms.detailVel[1] = num('de-vel-y', tileTransforms.detailVel[1]);
  tileTransforms.detailVel[2] = num('de-vel-z', tileTransforms.detailVel[2]);
}

function readPreview() {
  preview.cam.x = num('v-cx', preview.cam.x);
  preview.cam.y = num('v-cy', preview.cam.y);
  preview.cam.z = num('v-cz', preview.cam.z);
  preview.cam.yawDeg = num('v-yaw', preview.cam.yawDeg);
  preview.cam.pitchDeg = num('v-pitch', preview.cam.pitchDeg);
  preview.cam.fovYDeg = num('v-fov', preview.cam.fovYDeg);
  preview.exposure = num('v-exposure', preview.exposure);
  preview.sky[0] = num('v-sr', preview.sky[0]);
  preview.sky[1] = num('v-sg', preview.sky[1]);
  preview.sky[2] = num('v-sb', preview.sky[2]);
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
  if (payload.reproj && typeof payload.reproj.coarseFactor === 'number') payload.coarseFactor = payload.reproj.coarseFactor;
  else if (reprojEnabled) { const rp = getReprojPayload(); payload.reproj = payload.reproj || rp; payload.coarseFactor = rp.coarseFactor; }
  else payload.coarseFactor = payload.coarseFactor || 4;
  return payload;
}

// ---- UI wiring helpers (no debounce) ----
function attachInputs(panelId, handler) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.querySelectorAll('input,select,textarea').forEach(inp => {
    inp.addEventListener('input', handler);
  });
}

function attachTuningInputs() {
  const inputs = Array.from(document.querySelectorAll('input[id^="t-"], select[id^="t-"], textarea[id^="t-"]'));
  if (!inputs.length) return;
  inputs.forEach(inp => {
    inp.addEventListener('input', () => {
      sendTuningIfChanged();
    });
  });
}

// ---- run helpers that ensure tuning presence ----
async function runAfterBakeAndTuning(bakeRpcType, bakePayload = {}, extraPayload = {}) {
  setBusy(true, 'Baking…');
  try {
    // clone to force serialization of current values (avoid stale refs)
    await rpc(bakeRpcType, safeClone(bakePayload));
    await sendTuningNow();
    readPreview();
    const cloudParams = readCloudParams();
    const payload = Object.assign({
      weatherParams: safeClone(weatherParams),
      billowParams: safeClone(billowParams),
      shapeParams: safeClone(shapeParams),
      detailParams: safeClone(detailParams),
      tileTransforms: safeClone(tileTransforms),
      preview: safeClone(preview),
      cloudParams
    }, extraPayload || {});
    if (reprojEnabled) payload.reproj = getReprojPayload();
    ensureCoarseInPayload(payload);
    await rpc('runFrame', payload);
  } finally {
    setBusy(false);
  }
}

async function runFrameEnsuringTuning(payload = {}) {
  await sendTuningNow();
  ensureCoarseInPayload(payload);
  return rpc('runFrame', payload);
}

// ---- UI busy indicator ----
function setBusy(on, msg = 'Working...') {
  const ov = $('busyOverlay'), m = $('busyMsg');
  if (!ov) return;
  if (m) m.textContent = msg;
  ov.style.display = on ? 'flex' : 'none';
  ['bake-weather','bake-blue','bake-shape128','bake-detail32','rebake-all','render'].forEach(id => { const b = $(id); if (b) b.disabled = on; });
}

// ---- seeds, slice helpers ----
function setRandomSeedFor(obj) {
  // Create a safe 32-bit integer seed (non-zero)
  const rnd32 = Math.floor(Math.random() * 10000) >>> 0;
  const t = ((Date.now() * Math.floor(Math.random()*10000)) ^ rnd32) >>> 0;
  const seed = t || 1;
  obj.seed = seed;
  return obj.seed;
}
function currentSlice() { return +$('slice')?.value | 0; }
function refreshSliceLabel() { const s = $('sliceLabel'); if (s) s.textContent = String(currentSlice()); }

// ---- wire UI & initialization ----
async function wireUI() {
  $('pass').addEventListener('change', () => showPanelsFor($('pass').value));
  showPanelsFor($('pass').value);

  const reprojBtn = $('reproj-anim-toggle'), fpsSpan = $('fpsDisplay');
  reprojEnabled = false; animRunning = false;
  if (reprojBtn) reprojBtn.textContent = 'Start x4 Anim';
  if (fpsSpan) fpsSpan.textContent = '—';

  reprojBtn?.addEventListener('click', async () => {
    if (!animRunning) {
      reprojEnabled = true;
      const rp = getReprojPayload();
      try { await rpc('setReproj', { reproj: rp, perf: null }); } catch (e) { console.warn('Failed setReproj', e); }
      readPreview();
      const cloudParams = readCloudParams();
      setBusy(true, 'Seeding animation…');
      try {
        await sendTuningNow();
        const payload = {
          weatherParams: safeClone(weatherParams),
          billowParams: safeClone(billowParams),
          shapeParams: safeClone(shapeParams),
          detailParams: safeClone(detailParams),
          tileTransforms: safeClone(tileTransforms),
          preview: safeClone(preview),
          cloudParams,
          reproj: rp
        };
        ensureCoarseInPayload(payload);
        await rpc('runFrame', payload);
        await rpc('startLoop', {});
        animRunning = true; if (reprojBtn) reprojBtn.textContent = 'Stop Anim';
      } catch (e) {
        console.warn('start animation failed', e);
        reprojEnabled = false; animRunning = false;
        try { await rpc('setReproj', { reproj: { enabled:false, scale: reprojDefaultScale, coarseFactor:Math.round(1/reprojDefaultScale) }, perf: null }); } catch {}
        if (reprojBtn) reprojBtn.textContent = 'Start x4 Anim';
      } finally { setBusy(false); }
    } else {
      try { await rpc('stopLoop', {}); } catch (e) { console.warn('stopLoop failed', e); }
      animRunning = false; reprojEnabled = false;
      try { await rpc('setReproj', { reproj: { enabled:false, scale: reprojDefaultScale, coarseFactor:Math.round(1/reprojDefaultScale) }, perf: null }); } catch (e) { console.warn('Failed unset reproj', e); }
      if (reprojBtn) reprojBtn.textContent = 'Start x4 Anim';
      const fpsEl = $('fpsDisplay'); if (fpsEl) fpsEl.textContent = '—';
    }
  });

  // render button: ensure tuning then run
  $('render')?.addEventListener('click', async () => {
    setBusy(true, 'Rendering…');
    try {
      readPreview();
      const cloudParams = readCloudParams();
      await sendTuningNow();
      const payload = {
        weatherParams: safeClone(weatherParams),
        billowParams: safeClone(billowParams),
        shapeParams: safeClone(shapeParams),
        detailParams: safeClone(detailParams),
        tileTransforms: safeClone(tileTransforms),
        preview: safeClone(preview),
        cloudParams
      };
      if (reprojEnabled) payload.reproj = getReprojPayload();
      ensureCoarseInPayload(payload);
      const { timings } = await rpc('runFrame', payload);
      console.log('[BENCH] compute(ms):', timings.computeMs.toFixed(2), 'render(ms):', timings.renderMs.toFixed(2), 'total(ms):', timings.totalMs.toFixed(2));
    } finally { setBusy(false); }
  });

  // attach handlers for bake panels (input triggers immediate bake flow)
  attachInputs('p-weather', async () => {
    readWeather();
    readBillow();
    await runAfterBakeAndTuning('bakeWeather', { weatherParams: safeClone(weatherParams), billowParams: safeClone(billowParams) });
  });

  // SHAPE transform inputs: apply transforms (no rebake) then render
  attachInputs('p-shape128', async () => {
    try {
      readShape();
      readShapeTransform();

      // apply transforms only (no rebake)
      await setTileTransformsRPC(tileTransforms);

      // ensure tuning present, then render (no bake)
      await sendTuningNow();
      readPreview();
      const cloudParams = readCloudParams();
      const payload = {
        weatherParams: safeClone(weatherParams),
        billowParams: safeClone(billowParams),
        shapeParams: safeClone(shapeParams),
        detailParams: safeClone(detailParams),
        tileTransforms: safeClone(tileTransforms),
        preview: safeClone(preview),
        cloudParams
      };
      if (reprojEnabled) payload.reproj = getReprojPayload();
      ensureCoarseInPayload(payload);
      await rpc('runFrame', payload);
    } catch (e) {
      console.warn('shape transform update failed', e);
    }
  });

  // DETAIL transform inputs: apply transforms (no rebake) then render
  attachInputs('p-detail32', async () => {
    try {
      readDetail();
      readDetailTransform();

      // apply transforms only (no rebake)
      await setTileTransformsRPC(tileTransforms);

      // ensure tuning present, then render (no bake)
      await sendTuningNow();
      readPreview();
      const cloudParams = readCloudParams();
      const payload = {
        weatherParams: safeClone(weatherParams),
        billowParams: safeClone(billowParams),
        shapeParams: safeClone(shapeParams),
        detailParams: safeClone(detailParams),
        tileTransforms: safeClone(tileTransforms),
        preview: safeClone(preview),
        cloudParams
      };
      if (reprojEnabled) payload.reproj = getReprojPayload();
      ensureCoarseInPayload(payload);
      await rpc('runFrame', payload);
    } catch (e) {
      console.warn('detail transform update failed', e);
    }
  });

  // cloud params panel: send tuning THEN runFrame
  attachInputs('p-cloudParams', async () => {
    readPreview();
    const cloudParams = readCloudParams();
    await sendTuningNow();
    const payload = {
      weatherParams: safeClone(weatherParams),
      billowParams: safeClone(billowParams),
      shapeParams: safeClone(shapeParams),
      detailParams: safeClone(detailParams),
      tileTransforms: safeClone(tileTransforms),
      preview: safeClone(preview),
      cloudParams
    };
    if (reprojEnabled) payload.reproj = getReprojPayload();
    ensureCoarseInPayload(payload);
    try { await rpc('runFrame', payload); } catch (e) { console.warn('runFrame failed (cloudParams)', e); }
  });

  // preview panel: send tuning then runFrame
  attachInputs('p-preview', async () => {
    readPreview();
    const cloudParams = readCloudParams();
    await sendTuningNow();
    const payload = {
      weatherParams: safeClone(weatherParams),
      billowParams: safeClone(billowParams),
      shapeParams: safeClone(shapeParams),
      detailParams: safeClone(detailParams),
      tileTransforms: safeClone(tileTransforms),
      preview: safeClone(preview),
      cloudParams
    };
    if (reprojEnabled) payload.reproj = getReprojPayload();
    ensureCoarseInPayload(payload);
    try { await rpc('runFrame', payload); } catch (e) { console.warn('runFrame failed (preview)', e); }
  });

  // tuning panel: immediate sends (only if changed)
  attachTuningInputs();

  // bake buttons + rebake-all (click handlers still allowed)
  $('bake-weather')?.addEventListener('click', async () => {
    readWeather(); readBillow();
    await runAfterBakeAndTuning('bakeWeather', { weatherParams: safeClone(weatherParams), billowParams: safeClone(billowParams) });
  });
  $('bake-blue')?.addEventListener('click', async () => { await runAfterBakeAndTuning('bakeBlue', { blueParams: safeClone(blueParams) }); });
  $('bake-shape128')?.addEventListener('click', async () => {
    readShape(); readShapeTransform();
    await runAfterBakeAndTuning('bakeShape', { shapeParams: safeClone(shapeParams), tileTransforms: { shapeOffset: tileTransforms.shapeOffset, shapeScale: tileTransforms.shapeScale } });
  });
  $('bake-detail32')?.addEventListener('click', async () => {
    readDetail(); readDetailTransform();
    await runAfterBakeAndTuning('bakeDetail', { detailParams: safeClone(detailParams), tileTransforms: { detailOffset: tileTransforms.detailOffset, detailScale: tileTransforms.detailScale } });
  });

  $('rebake-all')?.addEventListener('click', async () => {
    setBusy(true, 'Rebaking all...');
    try {
      await rpc('bakeAll', {
        weatherParams: safeClone(weatherParams),
        billowParams: safeClone(billowParams),
        shapeParams: safeClone(shapeParams),
        detailParams: safeClone(detailParams),
        tileTransforms: safeClone(tileTransforms)
      });
      await sendTuningNow();
      const cloudParams = readCloudParams();
      const payload = {
        weatherParams: safeClone(weatherParams),
        billowParams: safeClone(billowParams),
        shapeParams: safeClone(shapeParams),
        detailParams: safeClone(detailParams),
        tileTransforms: safeClone(tileTransforms),
        preview: safeClone(preview),
        cloudParams
      };
      if (reprojEnabled) payload.reproj = getReprojPayload();
      ensureCoarseInPayload(payload);
      await rpc('runFrame', payload);
    } finally { setBusy(false); }
  });

  // slice slider -> immediate setSlice
  $('slice')?.addEventListener('input', () => {
    refreshSliceLabel();
    rpc('setSlice', { slice: +$('slice').value | 0 }).catch(e => console.warn('setSlice failed', e));
  });

  // seed buttons (immediate) — clone payloads and log seeds
  $('seed-weather')?.addEventListener('click', async () => {
    const s = setRandomSeedFor(weatherParams);
    setLog('new weather seed', s, weatherParams);
    setBusy(true, 'Seeding weather...');
    try {
      await runAfterBakeAndTuning('bakeWeather', { weatherParams: safeClone(weatherParams), billowParams: safeClone(billowParams) });
      console.log('Weather seed set to', s);
    } finally { setBusy(false); }
  });
  $('seed-shape')?.addEventListener('click', async () => {
    const s = setRandomSeedFor(shapeParams);
    setLog('new shape seed', s, shapeParams);
    setBusy(true, 'Seeding shape...');
    try {
      await runAfterBakeAndTuning('bakeShape', { shapeParams: safeClone(shapeParams), tileTransforms: { shapeOffset: tileTransforms.shapeOffset, shapeScale: tileTransforms.shapeScale } });
      console.log('Shape seed set to', s);
    } finally { setBusy(false); }
  });
  $('seed-detail')?.addEventListener('click', async () => {
    const s = setRandomSeedFor(detailParams);
    setLog('new detail seed', s, detailParams);
    setBusy(true, 'Seeding detail...');
    try {
      await runAfterBakeAndTuning('bakeDetail', { detailParams: safeClone(detailParams), tileTransforms: { detailOffset: tileTransforms.detailOffset, detailScale: tileTransforms.detailScale } });
      console.log('Detail seed set to', s);
    } finally { setBusy(false); }
  });
  $('seed-blue')?.addEventListener('click', async () => {
    const s = setRandomSeedFor(blueParams);
    setLog('new blue seed', s, blueParams);
    setBusy(true, 'Seeding blue...');
    try {
      await runAfterBakeAndTuning('bakeBlue', { blueParams: safeClone(blueParams) });
      console.log('Blue seed set to', s);
    } finally { setBusy(false); }
  });

  // sizes: send immediately on resize (no debounce)
  window.addEventListener('resize', () => sendSizes());
}

// ---- UI utilities shown earlier ----
function showPanelsFor(pass) {
  const vis = (id, on) => { const e = $(id); if (e) e.style.display = on ? '' : 'none'; };
  vis('p-weather', pass === 'weather');
  vis('p-shape128', pass === 'shape128');
  vis('p-detail32', pass === 'detail32');
  vis('p-cloudParams', pass === 'clouds');
  vis('p-preview', pass === 'preview');
}
function sendSizes() {
  const dpr = DPR();
  const canvas = $('gpuCanvas');
  const cW = Math.max(1, Math.round(canvas.clientWidth)), cH = Math.max(1, Math.round(canvas.clientHeight));
  const pixelW = Math.max(1, Math.floor(cW * dpr)), pixelH = Math.max(1, Math.floor(cH * dpr));
  const dbgSizePx = Math.round(DBG_SIZE * dpr);
  rpc('resize', { main: { width: pixelW, height: pixelH }, dbg: { width: dbgSizePx, height: dbgSizePx } }).catch(e => console.warn('resize rpc failed', e));
}

// ---- init: populate fields, spawn worker, transfer canvases, initial bake + render ----
async function init() {
  document.body.insertAdjacentHTML('beforeend', html);

  // fill UI with defaults
  const setIf = (id, val) => { const el = $(id); if (!el) return; if (el.type === 'checkbox') el.checked = !!val; else el.value = val; };

  // weather (FBM)
  setIf('we-zoom', weatherParams.zoom); setIf('we-freq', weatherParams.freq); setIf('we-oct', weatherParams.octaves); setIf('we-lac', weatherParams.lacunarity);
  setIf('we-gain', weatherParams.gain); setIf('we-thr', weatherParams.threshold);

  // billow controls
  setIf('we-billow-enable', billowParams.enabled);
  setIf('we-billow-zoom', billowParams.zoom); setIf('we-billow-freq', billowParams.freq); setIf('we-billow-oct', billowParams.octaves); setIf('we-billow-lac', billowParams.lacunarity);
  setIf('we-billow-gain', billowParams.gain); setIf('we-billow-thr', billowParams.threshold); setIf('we-billow-scale', billowParams.scale);
  setIf('we-billow-pos-x', billowParams.pos[0]); setIf('we-billow-pos-y', billowParams.pos[1]); setIf('we-billow-pos-z', billowParams.pos[2]);
  setIf('we-billow-vel-x', billowParams.vel[0]); setIf('we-billow-vel-y', billowParams.vel[1]); setIf('we-billow-vel-z', billowParams.vel[2]);

  // shape
  setIf('sh-zoom', shapeParams.zoom); setIf('sh-freq', shapeParams.freq); setIf('sh-oct', shapeParams.octaves); setIf('sh-lac', shapeParams.lacunarity); setIf('sh-gain', shapeParams.gain); setIf('sh-thr', shapeParams.threshold);
  setIf('sh-scale', tileTransforms.shapeScale);
  setIf('sh-pos-x', tileTransforms.shapeOffset[0]); setIf('sh-pos-y', tileTransforms.shapeOffset[1]); setIf('sh-pos-z', tileTransforms.shapeOffset[2]);
  setIf('sh-vel-x', tileTransforms.shapeVel[0]); setIf('sh-vel-y', tileTransforms.shapeVel[1]); setIf('sh-vel-z', tileTransforms.shapeVel[2]);

  // detail
  setIf('de-zoom', detailParams.zoom); setIf('de-freq', detailParams.freq); setIf('de-oct', detailParams.octaves); setIf('de-lac', detailParams.lacunarity); setIf('de-gain', detailParams.gain); setIf('de-thr', detailParams.threshold);
  setIf('de-scale', tileTransforms.detailScale);
  setIf('de-pos-x', tileTransforms.detailOffset[0]); setIf('de-pos-y', tileTransforms.detailOffset[1]); setIf('de-pos-z', tileTransforms.detailOffset[2]);
  setIf('de-vel-x', tileTransforms.detailVel[0]); setIf('de-vel-y', tileTransforms.detailVel[1]); setIf('de-vel-z', tileTransforms.detailVel[2]);

  // cloud params & tuning
  setIf('c-az', preview.sun.azDeg); setIf('c-el', preview.sun.elDeg); setIf('c-bloom', preview.sun.bloom);
  setIf('p-coverage', 1); setIf('p-density', 100); setIf('p-beer', 6); setIf('p-clamp', 0.15);
  setIf('p-ins', 0.7); setIf('p-outs', 0.2); setIf('p-ivo', 0.3); setIf('p-sI', 0.25); setIf('p-sE', 16);
  setIf('p-ambOut', 1.0); setIf('p-ambMin', 0.25); setIf('p-anvil', 0.10);
  // tuning defaults
  setIf('t-maxSteps', 256); setIf('t-minStep', 0.003); setIf('t-maxStep', 0.10); setIf('t-sunSteps', 4); setIf('t-phaseJitter', 1.0);
  setIf('t-stepJitter', 0.08); setIf('t-baseJitter', 0.15); setIf('t-topJitter', 0.10); setIf('t-lodBiasWeather', 1.5);
  setIf('t-nearFluffDist', 60); setIf('t-nearDensityMult', 2.5); setIf('t-farStart', 800); setIf('t-farFull', 2500);
  setIf('t-raySmoothDens', 0.5); setIf('t-raySmoothSun', 0.5);
  // preview
  setIf('v-cx', preview.cam.x); setIf('v-cy', preview.cam.y); setIf('v-cz', preview.cam.z);
  setIf('v-fov', preview.cam.fovYDeg); setIf('v-yaw', preview.cam.yawDeg); setIf('v-pitch', preview.cam.pitchDeg);
  setIf('v-exposure', preview.exposure); setIf('v-sr', preview.sky[0]); setIf('v-sg', preview.sky[1]); setIf('v-sb', preview.sky[2]);

  // spawn worker
  worker = new Worker(wrkr, { type: 'module' });
  worker.onmessage = ev => {
    const { id, type, ok, data, error } = ev.data || {};
    if (id && _pending.has(id)) {
      const { resolve, reject } = _pending.get(id); _pending.delete(id);
      return ok ? resolve(data) : reject(error || new Error('Worker error'));
    }
    if (type === 'log') console.log(...(data || []));
    if (type === 'frame') {
      const info = data || {}; const fps = info.fps ? (Math.round(info.fps * 100) / 100) : '—';
      const fpsEl = $('fpsDisplay'); if (fpsEl) fpsEl.textContent = String(fps);
    }
    if (type === 'loop-stopped') {
      animRunning = false; const btn = $('reproj-anim-toggle'); if (btn) btn.textContent = 'Start x4 Anim'; const fpsEl = $('fpsDisplay'); if (fpsEl) fpsEl.textContent = '—';
    }
  };

  // transfer canvases to worker
  const mainCanvas = $('gpuCanvas');
  const dbgIds = ['dbg-weather','dbg-weather-g','dbg-r','dbg-g','dbg-blue'];
  const offscreenMain = mainCanvas.transferControlToOffscreen();
  const offscreenDbg = Object.fromEntries(dbgIds.map(id => [id, $(id).transferControlToOffscreen()]));
  await rpc('init', {
    canvases: {
      main: offscreenMain,
      dbg: {
        weather: offscreenDbg['dbg-weather'],
        weatherG: offscreenDbg['dbg-weather-g'],
        shapeR: offscreenDbg['dbg-r'],
        detailR: offscreenDbg['dbg-g'],
        blue: offscreenDbg['dbg-blue']
      }
    },
    constants: { SHAPE_SIZE, DETAIL_SIZE, WEATHER_W, WEATHER_H, BN_W, BN_H }
  }, [ offscreenMain, offscreenDbg['dbg-weather'], offscreenDbg['dbg-weather-g'], offscreenDbg['dbg-r'], offscreenDbg['dbg-g'], offscreenDbg['dbg-blue'] ]);

  sendSizes();

  // Sync initial tile transforms to worker (so worker starts with same defaults)
  try { await setTileTransformsRPC(tileTransforms); } catch (e) { /* non-fatal */ }

  // initial bake & render (bakeAll uses weather/shape/detail + billow where provided)
  setBusy(true, 'Initializing…');
  try {
    await rpc('bakeAll', {
      weatherParams: safeClone(weatherParams),
      billowParams: safeClone(billowParams),
      shapeParams: safeClone(shapeParams),
      detailParams: safeClone(detailParams),
      tileTransforms: safeClone(tileTransforms)
    });
    refreshSliceLabel();
    await rpc('setReproj', { reproj: getReprojPayload(), perf: null });
    try { await sendTuningNow(true); } catch (e) { console.warn('initial sendTuningNow failed', e); }
    const cloudParams = readCloudParams();
    const payload = {
      weatherParams: safeClone(weatherParams),
      billowParams: safeClone(billowParams),
      shapeParams: safeClone(shapeParams),
      detailParams: safeClone(detailParams),
      tileTransforms: safeClone(tileTransforms),
      preview: safeClone(preview),
      cloudParams
    };
    if (reprojEnabled) payload.reproj = getReprojPayload();
    ensureCoarseInPayload(payload);
    const { timings } = await rpc('runFrame', payload);
    console.log('[BENCH] init frame timings:', timings);
  } finally { setBusy(false); }

  await wireUI();
}

// start
init().catch(err => {
  console.error(err);
  const pre = document.createElement('pre');
  pre.textContent = (err && err.stack) ? err.stack : String(err);
  document.body.appendChild(pre);
});
