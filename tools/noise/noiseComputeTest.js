// tools/noise/noiseComputeTest.js
import html from "./noiseComponent.html";
import { NoiseComputeBuilder } from "./noiseCompute.js";

document.body.insertAdjacentHTML("afterbegin", html);

const UI_EXCLUDE_TRAILING_ENTRY_POINTS = 6;

const LABEL_OVERRIDES_BY_ENTRY = {
  computeCellular: "CellularPattern",
  computeWorley: "WorleyPattern",
  computeAntiCellular: "AntiCellularPattern",
  computeAntiWorley: "AntiWorleyPattern",
  computeWhiteNoise: "White Noise",
  computeBlueNoise: "Blue Noise",
};

const NOISE_CONSTRAINTS_BY_ENTRY = {
  computeRidge: {
    clamp: { freq: [0.25, 8.0], gain: [0.2, 0.8], octaves: [1, 12] },
  },
  computeAntiRidge: {
    clamp: { freq: [0.25, 8.0], gain: [0.2, 0.8], octaves: [1, 12] },
  },

  computeRidgedMultifractal: {
    clamp: { freq: [0.25, 8.0], gain: [0.2, 0.9], octaves: [2, 14] },
  },
  computeRidgedMultifractal2: {
    clamp: { freq: [0.25, 8.0], gain: [0.2, 0.9], octaves: [2, 14] },
  },
  computeRidgedMultifractal3: {
    clamp: { freq: [0.25, 8.0], gain: [0.2, 0.9], octaves: [2, 14] },
  },
  computeRidgedMultifractal4: {
    clamp: { freq: [0.25, 8.0], gain: [0.2, 0.9], octaves: [2, 14] },
  },

  computeFBM: {
    clamp: { gain: [0.2, 0.8], octaves: [2, 10] },
  },
  computeFBM2: {
    clamp: { gain: [0.2, 0.8], octaves: [2, 10] },
  },
  computeFBM3: {
    clamp: { gain: [0.2, 0.8], octaves: [2, 10] },
  },

  computeVoronoiBM1: {
    clamp: { threshold: [0.0, 1.0], edgeK: [0.0, 64.0] },
  },
  computeVoronoiBM2: {
    clamp: { threshold: [0.0, 1.0], edgeK: [0.0, 64.0] },
  },
  computeVoronoiBM3: {
    clamp: { threshold: [0.0, 1.0], edgeK: [0.0, 64.0] },
  },
  computeCellular: {
    clamp: { threshold: [0.0, 1.0] },
  },
  computeWorley: {
    clamp: { threshold: [0.0, 1.0] },
  },
  computeAntiCellular: {
    clamp: { threshold: [0.0, 1.0] },
  },
  computeAntiWorley: {
    clamp: { threshold: [0.0, 1.0] },
  },

  computeSimplexFBM: {
    force: { turbulence: 1 },
    clamp: { warpAmp: [0.1, 2.0], freq: [0.25, 6.0] },
  },
  computeCurl2D: {
    force: { turbulence: 1 },
    clamp: { warpAmp: [0.1, 2.0], freq: [0.25, 6.0] },
  },
  computeCurlFBM2D: {
    force: { turbulence: 1 },
    clamp: { warpAmp: [0.1, 3.0] },
  },
  computeDomainWarpFBM1: {
    force: { turbulence: 1 },
    clamp: { warpAmp: [0.1, 3.0] },
  },
  computeDomainWarpFBM2: {
    force: { turbulence: 1 },
    clamp: { warpAmp: [0.1, 3.0] },
  },

  computeGaborAnisotropic: {
    clamp: { gaborRadius: [0.5, 6.0] },
  },

  computeFoamNoise: {
    force: { turbulence: 1 },
    clamp: { gain: [0.5, 0.95] },
  },
};

const TOROIDAL_SIZE = 128;
const TOROIDAL_VOLUME_KEY = "toroidalDemo";

const MODE_OVERRIDES = new Map();

let ENTRY_POINTS = [];
let NOISE_LABELS_BY_BIT = Object.create(null);

function makeNoiseLabelFromEntryPoint(ep) {
  const key = String(ep || "");
  const override = LABEL_OVERRIDES_BY_ENTRY[key];
  if (override) return override;

  let s = key;
  if (s.startsWith("compute")) s = s.slice(7);
  return s || key;
}

function buildNoiseLabelsByBit(entryPoints, excludeTrailing) {
  const out = Object.create(null);
  const eps = Array.isArray(entryPoints) ? entryPoints : [];
  const drop = Math.max(0, excludeTrailing | 0);
  const n = Math.max(0, eps.length - drop);

  for (let i = 0; i < n; i++) {
    out[i] = makeNoiseLabelFromEntryPoint(eps[i]);
  }
  return out;
}

function getSortedNoiseBits() {
  return Object.keys(NOISE_LABELS_BY_BIT)
    .map((k) => Number(k))
    .filter((bit) => Number.isInteger(bit) && bit >= 0)
    .sort((a, b) => a - b);
}

function getSortedOverrideBits() {
  const out = [];
  for (let i = 0; i < ENTRY_POINTS.length; i++) {
    const ep = ENTRY_POINTS[i];
    if (typeof ep !== "string" || !ep) continue;
    if (ep === "clearTexture") continue;
    out.push(i);
  }
  return out;
}

function getConstraintForBit(bit) {
  const ep = ENTRY_POINTS[bit];
  if (!ep) return null;
  return NOISE_CONSTRAINTS_BY_ENTRY[String(ep)] || null;
}

function clampField(obj, key, min, max) {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return;
  const v = Number(obj[key]);
  if (!Number.isFinite(v)) return;
  const lo = Number(min);
  const hi = Number(max);
  obj[key] = Math.min(Math.max(v, lo), hi);
}

function buildParamsForBit(bit, globalParams) {
  const local = { ...globalParams };
  const cfg = getConstraintForBit(bit);

  if (cfg && cfg.clamp) {
    const c = cfg.clamp;
    if (c.freq) clampField(local, "freq", c.freq[0], c.freq[1]);
    if (c.gain) clampField(local, "gain", c.gain[0], c.gain[1]);
    if (c.octaves) clampField(local, "octaves", c.octaves[0], c.octaves[1]);
    if (c.threshold)
      clampField(local, "threshold", c.threshold[0], c.threshold[1]);
    if (c.warpAmp) clampField(local, "warpAmp", c.warpAmp[0], c.warpAmp[1]);
    if (c.gaborRadius)
      clampField(local, "gaborRadius", c.gaborRadius[0], c.gaborRadius[1]);
    if (c.edgeK) clampField(local, "edgeK", c.edgeK[0], c.edgeK[1]);
  }

  if (cfg && cfg.force) {
    for (const [k, v] of Object.entries(cfg.force)) {
      local[k] = v;
    }
  }

  const overrideObj = MODE_OVERRIDES.get(bit);
  if (overrideObj) {
    for (const [k, v] of Object.entries(overrideObj)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        local[k] = v;
      }
    }
  }

  return local;
}

function readGlobalParamsFromUI() {
  const getNum = (id, fallback) => {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const v = Number(el.value);
    return Number.isFinite(v) ? v : fallback;
  };

  const getU32 = (id, fallback) => {
    const n = getNum(id, fallback);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.floor(n));
  };

  const seed = Math.max(1, Math.floor(getNum("noise-seed", 1234567890)));
  const turbEl = document.getElementById("noise-turbulence");
  const turbulence = turbEl && turbEl.checked ? 1 : 0;

  return {
    seed,
    zoom: getNum("noise-zoom", 1.0),
    freq: getNum("noise-freq", 1.0),
    octaves: Math.max(1, Math.floor(getNum("noise-octaves", 8))),
    lacunarity: getNum("noise-lacunarity", 2.0),
    gain: getNum("noise-gain", 0.5),
    xShift: getNum("noise-xShift", 0.0),
    yShift: getNum("noise-yShift", 0.0),
    zShift: getNum("noise-zShift", 0.0),

    turbulence,
    seedAngle: getNum("noise-seedAngle", 0.0),
    exp1: getNum("noise-exp1", 1.0),
    exp2: getNum("noise-exp2", 0.0),

    threshold: getNum("noise-threshold", 0.1),
    rippleFreq: getNum("noise-rippleFreq", 10.0),
    time: getNum("noise-time", 0.0),
    warpAmp: getNum("noise-warpAmp", 0.5),
    gaborRadius: getNum("noise-gaborRadius", 4.0),
    terraceStep: getNum("noise-terraceStep", 8.0),

    toroidal: 0,
    voroMode: getU32("noise-voroMode", 0),
    edgeK: getNum("noise-edgeK", 0.0),
  };
}

function collectSelectedBitsFromUI() {
  const boxes = document.querySelectorAll(
    'input[type="checkbox"][name="noise-type"]',
  );
  const bits = [];
  boxes.forEach((box) => {
    if (box.checked) {
      const bit = Number(box.dataset.bit);
      if (Number.isInteger(bit)) bits.push(bit);
    }
  });
  return bits;
}

function getZSliceIndexFromUI() {
  const slider = document.getElementById("z-slice");
  const num = document.getElementById("z-slice-num");

  let idx = 0;
  if (slider) idx = Number(slider.value);
  else if (num) idx = Number(num.value);

  if (!Number.isFinite(idx)) idx = 0;
  idx = Math.min(Math.max(Math.round(idx), 0), TOROIDAL_SIZE - 1);

  if (slider && String(slider.value) !== String(idx))
    slider.value = String(idx);
  if (num && String(num.value) !== String(idx)) num.value = String(idx);

  return idx;
}

function applyCanvasCSS(canvas, cssW = null, cssH = null) {
  canvas.style.display = "block";
  canvas.style.margin = "0";
  canvas.style.padding = "0";
  canvas.style.border = "0";
  canvas.style.outline = "0";
  canvas.style.background = "transparent";

  canvas.style.width = cssW != null ? `${cssW}px` : "100%";
  canvas.style.height = cssH != null ? `${cssH}px` : "100%";

  canvas.style.objectFit = "contain";
  canvas.style.objectPosition = "center";

  canvas.style.imageRendering = "crisp-edges";
  canvas.style.imageRendering = "pixelated";
}

function ensureCanvasSize(builder, canvas, w, h, cssW = null, cssH = null) {
  const iw = Math.max(1, w | 0);
  const ih = Math.max(1, h | 0);

  applyCanvasCSS(canvas, cssW, cssH);

  let changed = false;

  if (canvas.width !== iw || canvas.height !== ih) {
    canvas.width = iw;
    canvas.height = ih;
    changed = true;
  }

  if (builder && typeof builder.configureCanvas === "function" && changed) {
    builder.configureCanvas(canvas);
  }

  return changed;
}

function configureMosaicLayout(mosaicRoot, tileW, tileH, count) {
  const n = Math.max(1, count | 0);
  const cols = Math.max(1, Math.round(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);

  mosaicRoot.style.display = "grid";
  mosaicRoot.style.gridTemplateColumns = `repeat(${cols}, ${tileW}px)`;
  mosaicRoot.style.gridAutoRows = `${tileH}px`;
  mosaicRoot.style.gap = "0px";
  mosaicRoot.style.padding = "0";
  mosaicRoot.style.margin = "0";
  mosaicRoot.style.border = "0";
  mosaicRoot.style.lineHeight = "0";
  mosaicRoot.style.fontSize = "0";
  mosaicRoot.style.alignItems = "start";
  mosaicRoot.style.justifyItems = "start";
  mosaicRoot.style.placeItems = "start";
  mosaicRoot.style.overflow = "hidden";
}

function initMainAndMosaicCanvases() {
  let mainCanvas = document.getElementById("noise-canvas");
  const stack = document.getElementById("view-stack");

  if (!mainCanvas && stack) {
    mainCanvas = document.createElement("canvas");
    mainCanvas.id = "noise-canvas";
    mainCanvas.width = 800;
    mainCanvas.height = 800;
    stack.appendChild(mainCanvas);
  }

  if (!mainCanvas) {
    throw new Error("Missing main preview canvas (#noise-canvas)");
  }

  applyCanvasCSS(mainCanvas); // fill .squareWrap

  const mosaicRoot = document.getElementById("mosaic");
  if (!mosaicRoot) {
    throw new Error("Missing #mosaic container");
  }

  const mosaicCanvases = [];
  const existing = mosaicRoot.querySelectorAll("canvas");

  if (!existing.length) {
    for (let i = 0; i < 9; i++) {
      const c = document.createElement("canvas");
      c.width = TOROIDAL_SIZE;
      c.height = TOROIDAL_SIZE;
      applyCanvasCSS(c); // fill grid cell
      mosaicRoot.appendChild(c);
      mosaicCanvases.push(c);
    }
  } else {
    existing.forEach((c) => {
      applyCanvasCSS(c); // fill grid cell
      mosaicCanvases.push(c);
    });
  }

  configureMosaicLayout(
    mosaicRoot,
    TOROIDAL_SIZE,
    TOROIDAL_SIZE,
    mosaicCanvases.length || 9,
  );

  return { mainCanvas, mosaicCanvases };
}

function buildModeLabelList(bits) {
  if (!bits.length) return NOISE_LABELS_BY_BIT[0] || "Perlin";
  const labels = bits.map((bit) => NOISE_LABELS_BY_BIT[bit] || String(bit));
  return labels.join(", ");
}

function ensureRoot(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function populateNoiseTypeCheckboxes() {
  const root = ensureRoot("noise-type-list");
  root.innerHTML = "";

  const bits = getSortedNoiseBits();
  for (const bit of bits) {
    const label = document.createElement("label");

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "noise-type";
    input.dataset.bit = String(bit);
    if (bit === 0) input.checked = true;

    label.appendChild(input);
    label.appendChild(
      document.createTextNode(" " + (NOISE_LABELS_BY_BIT[bit] || String(bit))),
    );
    root.appendChild(label);
  }
}

function getToroidalCandidatesFromEntryPoints(entryPoints) {
  const eps = Array.isArray(entryPoints) ? entryPoints : [];
  return eps
    .filter(
      (ep) => typeof ep === "string" && /4D/.test(ep) && ep !== "clearTexture",
    )
    .slice();
}

function populateToroidalTypeCheckboxes(entryPoints) {
  const root = ensureRoot("toroidal-type-list");
  root.innerHTML = "";

  const candidates = getToroidalCandidatesFromEntryPoints(entryPoints);

  const defaults = new Set(["computePerlin4D", "computeWorley4D"]);
  let anyChecked = false;

  for (const ep of candidates) {
    const label = document.createElement("label");

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "toroidal-type";
    input.dataset.entry = ep;

    const bit = ENTRY_POINTS.indexOf(ep);
    if (Number.isInteger(bit) && bit >= 0) {
      input.dataset.bit = String(bit);
    }

    if (defaults.has(ep)) {
      input.checked = true;
      anyChecked = true;
    }

    label.appendChild(input);
    label.appendChild(
      document.createTextNode(" " + makeNoiseLabelFromEntryPoint(ep)),
    );
    root.appendChild(label);
  }

  if (!anyChecked && candidates.length) {
    const first = root.querySelector(
      'input[type="checkbox"][name="toroidal-type"]',
    );
    if (first) first.checked = true;
  }
}

function collectSelectedToroidalModesFromUI() {
  const boxes = document.querySelectorAll(
    'input[type="checkbox"][name="toroidal-type"]',
  );
  const out = [];

  boxes.forEach((box) => {
    if (!box.checked) return;
    const entry = String(box.dataset.entry || "");
    if (!entry) return;

    let bit = Number(box.dataset.bit);
    if (!Number.isInteger(bit)) bit = ENTRY_POINTS.indexOf(entry);
    if (!Number.isInteger(bit)) bit = -1;

    out.push({ bit, entry });
  });

  if (!out.length) {
    const fallbacks = ["computePerlin4D", "computeWorley4D"];
    for (const entry of fallbacks) {
      if (!ENTRY_POINTS.includes(entry)) continue;
      const bit = ENTRY_POINTS.indexOf(entry);
      out.push({ bit, entry });
    }
  }

  return out;
}

function updateMosaicCaption(selectedEntries) {
  const el = document.getElementById("mosaic-caption");
  if (!el) return;

  const modes = Array.isArray(selectedEntries) ? selectedEntries : [];
  const pretty = modes.length
    ? modes.map((ep) => makeNoiseLabelFromEntryPoint(ep)).join(" + ")
    : "None";

  el.textContent =
    `A single toroidal Z slice from a 4D volume. Modes: ${pretty}. ` +
    `Repeated in X and Y. Use the Z slice control to see different slices.`;
}

function populateOverrideModeSelect() {
  const select = document.getElementById("override-mode");
  if (!select) return;
  select.innerHTML = "";

  const bits = getSortedOverrideBits();
  for (const bit of bits) {
    const ep = ENTRY_POINTS[bit];
    const opt = document.createElement("option");
    opt.value = String(bit);
    opt.textContent = `${bit}: ${makeNoiseLabelFromEntryPoint(ep)}`;
    select.appendChild(opt);
  }

  if (bits.length) select.value = String(bits[0]);
}

function populateOverrideFieldsForBit(bit) {
  const overrides = MODE_OVERRIDES.get(bit) || {};

  const setNum = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = overrides[key];
    el.value = typeof v === "number" && Number.isFinite(v) ? String(v) : "";
  };

  const setSel = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = overrides[key];
    el.value = typeof v === "number" && Number.isFinite(v) ? String(v) : "";
  };

  setNum("ov-zoom", "zoom");
  setNum("ov-freq", "freq");
  setNum("ov-lacunarity", "lacunarity");
  setNum("ov-gain", "gain");
  setNum("ov-octaves", "octaves");

  setSel("ov-turbulence", "turbulence");

  setNum("ov-seedAngle", "seedAngle");
  setNum("ov-exp1", "exp1");
  setNum("ov-exp2", "exp2");
  setNum("ov-rippleFreq", "rippleFreq");
  setNum("ov-time", "time");

  setNum("ov-warp", "warpAmp");
  setNum("ov-threshold", "threshold");

  setSel("ov-voroMode", "voroMode");
  setNum("ov-edgeK", "edgeK");

  setNum("ov-gabor", "gaborRadius");
  setNum("ov-terraceStep", "terraceStep");

  setNum("ov-xShift", "xShift");
  setNum("ov-yShift", "yShift");
  setNum("ov-zShift", "zShift");
}

function updateOverridesFromFields() {
  const select = document.getElementById("override-mode");
  if (!select) return;
  const bit = Number(select.value);
  if (!Number.isInteger(bit)) return;

  const readNum = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const trimmed = String(el.value).trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return null;
    return num;
  };

  const readSelNum = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const trimmed = String(el.value).trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return null;
    return num;
  };

  const obj = {};

  const zoom = readNum("ov-zoom");
  const freq = readNum("ov-freq");
  const lacunarity = readNum("ov-lacunarity");
  const gain = readNum("ov-gain");
  const octaves = readNum("ov-octaves");

  const turbulence = readSelNum("ov-turbulence");

  const seedAngle = readNum("ov-seedAngle");
  const exp1 = readNum("ov-exp1");
  const exp2 = readNum("ov-exp2");
  const rippleFreq = readNum("ov-rippleFreq");
  const time = readNum("ov-time");

  const warpAmp = readNum("ov-warp");
  const threshold = readNum("ov-threshold");

  const voroMode = readSelNum("ov-voroMode");
  const edgeK = readNum("ov-edgeK");

  const gaborRadius = readNum("ov-gabor");
  const terraceStep = readNum("ov-terraceStep");

  const xShift = readNum("ov-xShift");
  const yShift = readNum("ov-yShift");
  const zShift = readNum("ov-zShift");

  if (zoom !== null) obj.zoom = zoom;
  if (freq !== null) obj.freq = freq;
  if (lacunarity !== null) obj.lacunarity = lacunarity;
  if (gain !== null) obj.gain = gain;
  if (octaves !== null) obj.octaves = octaves;

  if (turbulence !== null) obj.turbulence = Math.max(0, Math.floor(turbulence));

  if (seedAngle !== null) obj.seedAngle = seedAngle;
  if (exp1 !== null) obj.exp1 = exp1;
  if (exp2 !== null) obj.exp2 = exp2;
  if (rippleFreq !== null) obj.rippleFreq = rippleFreq;
  if (time !== null) obj.time = time;

  if (warpAmp !== null) obj.warpAmp = warpAmp;
  if (threshold !== null) obj.threshold = threshold;

  if (voroMode !== null) obj.voroMode = Math.max(0, Math.floor(voroMode));
  if (edgeK !== null) obj.edgeK = edgeK;

  if (gaborRadius !== null) obj.gaborRadius = gaborRadius;
  if (terraceStep !== null) obj.terraceStep = terraceStep;

  if (xShift !== null) obj.xShift = xShift;
  if (yShift !== null) obj.yShift = yShift;
  if (zShift !== null) obj.zShift = zShift;

  if (Object.keys(obj).length) MODE_OVERRIDES.set(bit, obj);
  else MODE_OVERRIDES.delete(bit);
}

function _isEntryPoint4D(ep) {
  return typeof ep === "string" && /4d/i.test(ep);
}

async function renderMainNoise(builder, mainCanvas) {
  const resW = Number(document.getElementById("res-width")?.value) || 800;
  const resH = Number(document.getElementById("res-height")?.value) || 800;

  ensureCanvasSize(builder, mainCanvas, resW, resH);

  const previewMeta = document.getElementById("preview-meta");
  const previewStats = document.getElementById("preview-stats");

  const globalParams = readGlobalParamsFromUI();
  builder.buildPermTable(globalParams.seed | 0);

  const selectedBits = collectSelectedBitsFromUI();
  const noiseBits = selectedBits.length ? selectedBits : [0];

  const commonOptions = {
    getGradient: 0,
    outputChannel: 1,
    baseRadius: 0,
    heightScale: 1,
    useCustomPos: 0,
    squareWorld: true,
    worldMode: "crop",
  };

  const tComputeStart = performance.now();

  await builder.computeToTexture(resW, resH, globalParams, {
    ...commonOptions,
    noiseChoices: ["clearTexture"],
  });

  for (const bit of noiseBits) {
    const ep = ENTRY_POINTS[bit];
    const params = buildParamsForBit(bit, globalParams);

    params.toroidal = _isEntryPoint4D(ep) ? 1 : 0;

    await builder.computeToTexture(resW, resH, params, {
      ...commonOptions,
      noiseChoices: [bit],
    });
  }

  const tComputeEnd = performance.now();

  const view = builder.getCurrentView();
  const tBlitStart = performance.now();
  if (view) {
    builder.renderTextureToCanvas(view, mainCanvas, {
      layer: 0,
      channel: 0,
      preserveCanvasSize: true,
      clear: true,
    });
  }
  const tBlitEnd = performance.now();

  if (previewMeta) {
    const any4D = noiseBits.some((b) => _isEntryPoint4D(ENTRY_POINTS[b]));
    const tileTag = any4D ? " · toroidal(4D)" : "";
    const worldDim = Math.max(resW, resH) | 0;
    previewMeta.textContent = `Height field preview · ${resW}×${resH} · world ${worldDim}×${worldDim} · modes: ${buildModeLabelList(noiseBits)}${tileTag}`;
  }

  if (previewStats) {
    const computeMs = (tComputeEnd - tComputeStart).toFixed(1);
    const blitMs = (tBlitEnd - tBlitStart).toFixed(1);
    previewStats.textContent = `GPU compute ${computeMs} ms · blit ${blitMs} ms`;
  }

  return { resW, resH, noiseBits };
}

async function renderToroidalDemo(builder, mosaicCanvases, state) {
  const globalParams = readGlobalParamsFromUI();
  builder.buildPermTable(globalParams.seed | 0);

  const baseParams = {
    ...globalParams,
    toroidal: 1,
  };

  const modes = collectSelectedToroidalModesFromUI();
  updateMosaicCaption(modes.map((m) => m.entry));

  const t0 = performance.now();

  let volumeView = await builder.computeToTexture3D(
    TOROIDAL_SIZE,
    TOROIDAL_SIZE,
    TOROIDAL_SIZE,
    baseParams,
    {
      noiseChoices: ["clearTexture"],
      outputChannel: 1,
      id: TOROIDAL_VOLUME_KEY,
    },
  );

  for (const m of modes) {
    const bit = m.bit;
    const entry = m.entry;

    const params =
      Number.isInteger(bit) && bit >= 0
        ? buildParamsForBit(bit, baseParams)
        : { ...baseParams };

    params.toroidal = 1;

    volumeView = await builder.computeToTexture3D(
      TOROIDAL_SIZE,
      TOROIDAL_SIZE,
      TOROIDAL_SIZE,
      params,
      {
        noiseChoices: [entry],
        outputChannel: 1,
        id: TOROIDAL_VOLUME_KEY,
      },
    );
  }

  const t1 = performance.now();

  state.lastToroidalVolumeView = volumeView;
  state.lastToroidalComputeMs = t1 - t0;

  renderToroidalSlice(
    builder,
    volumeView,
    new Array(9).fill(0).map((_, i) => mosaicCanvases[i]),
  );
}

function renderToroidalSlice(builder, volumeView, mosaicCanvases) {
  if (!volumeView) return;

  const depth = TOROIDAL_SIZE;
  const zIndex = getZSliceIndexFromUI();
  const zNorm = (zIndex + 0.5) / depth;

  const canvases = Array.isArray(mosaicCanvases) ? mosaicCanvases : [];
  const count = canvases.length || 9;

  for (let i = 0; i < count; i++) {
    const canvas = canvases[i];
    if (!canvas) continue;

    ensureCanvasSize(builder, canvas, TOROIDAL_SIZE, TOROIDAL_SIZE);

    builder.renderTexture3DSliceToCanvas(volumeView, canvas, {
      depth,
      zNorm,
      channel: 0,
      chunk: 0,
      preserveCanvasSize: true,
      clear: true,
    });
  }
}

async function initNoiseDemo() {
  const statsEl = document.getElementById("preview-stats");

  if (!navigator.gpu) {
    console.error("WebGPU not available in this browser.");
    if (statsEl) statsEl.textContent = "WebGPU not available in this browser.";
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error("Failed to get GPU adapter.");
    if (statsEl) statsEl.textContent = "Failed to get GPU adapter.";
    return;
  }

  const device = await adapter.requestDevice();
  const builder = new NoiseComputeBuilder(device, device.queue);

  ENTRY_POINTS = Array.isArray(builder.entryPoints)
    ? builder.entryPoints.slice()
    : [];
  NOISE_LABELS_BY_BIT = buildNoiseLabelsByBit(
    ENTRY_POINTS,
    UI_EXCLUDE_TRAILING_ENTRY_POINTS,
  );

  populateNoiseTypeCheckboxes();
  populateToroidalTypeCheckboxes(ENTRY_POINTS);
  populateOverrideModeSelect();

  const { mainCanvas, mosaicCanvases } = initMainAndMosaicCanvases();

  builder.configureCanvas(mainCanvas);
  mosaicCanvases.forEach((c) => builder.configureCanvas(c));

  const overrideModeSelect = document.getElementById("override-mode");
  if (overrideModeSelect) {
    const bit = Number(overrideModeSelect.value);
    if (Number.isInteger(bit)) populateOverrideFieldsForBit(bit);
  }

  const state = {
    lastToroidalVolumeView: null,
    lastToroidalComputeMs: 0,
  };

  let mainRenderPending = false;
  let toroidalRenderPending = false;

  const scheduleMainRender = () => {
    if (mainRenderPending) return;
    mainRenderPending = true;
    requestAnimationFrame(() => {
      mainRenderPending = false;
      renderMainNoise(builder, mainCanvas).catch((err) => {
        console.error(err);
        if (statsEl) statsEl.textContent = String(err);
      });
    });
  };

  const scheduleToroidalRender = () => {
    if (toroidalRenderPending) return;
    toroidalRenderPending = true;
    requestAnimationFrame(() => {
      toroidalRenderPending = false;
      renderToroidalDemo(builder, mosaicCanvases, state).catch((err) => {
        console.error(err);
        if (statsEl) statsEl.textContent = String(err);
      });
    });
  };

  const scheduleAllRender = () => {
    scheduleMainRender();
    scheduleToroidalRender();
  };

  const overrideInputs = [
    "ov-zoom",
    "ov-freq",
    "ov-lacunarity",
    "ov-gain",
    "ov-octaves",
    "ov-turbulence",
    "ov-seedAngle",
    "ov-exp1",
    "ov-exp2",
    "ov-rippleFreq",
    "ov-time",
    "ov-warp",
    "ov-threshold",
    "ov-voroMode",
    "ov-edgeK",
    "ov-gabor",
    "ov-terraceStep",
    "ov-xShift",
    "ov-yShift",
    "ov-zShift",
  ];

  overrideInputs.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      updateOverridesFromFields();
      scheduleMainRender();
      scheduleToroidalRender();
    });
  });

  if (overrideModeSelect) {
    overrideModeSelect.addEventListener("change", () => {
      const bit = Number(overrideModeSelect.value);
      if (!Number.isInteger(bit)) return;
      populateOverrideFieldsForBit(bit);
    });
  }

  const ovClear = document.getElementById("ov-clear");
  if (ovClear) {
    ovClear.addEventListener("click", () => {
      const select = document.getElementById("override-mode");
      if (!select) return;
      const bit = Number(select.value);
      if (!Number.isInteger(bit)) return;
      MODE_OVERRIDES.delete(bit);
      populateOverrideFieldsForBit(bit);
      scheduleMainRender();
      scheduleToroidalRender();
    });
  }

  const renderBtn = document.getElementById("render-btn");
  if (renderBtn) {
    renderBtn.addEventListener("click", () => {
      scheduleAllRender();
    });
  }

  const applyResBtn = document.getElementById("apply-res");
  if (applyResBtn) {
    applyResBtn.addEventListener("click", () => {
      scheduleAllRender();
    });
  }

  const GLOBAL_PARAM_IDS = [
    "noise-seed",
    "noise-zoom",
    "noise-freq",
    "noise-octaves",
    "noise-lacunarity",
    "noise-gain",
    "noise-xShift",
    "noise-yShift",
    "noise-zShift",

    "noise-voroMode",
    "noise-threshold",
    "noise-edgeK",
    "noise-seedAngle",

    "noise-turbulence",
    "noise-time",
    "noise-warpAmp",
    "noise-gaborRadius",
    "noise-terraceStep",
    "noise-exp1",
    "noise-exp2",
    "noise-rippleFreq",
  ];

  GLOBAL_PARAM_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      scheduleMainRender();
      scheduleToroidalRender();
    });
    el.addEventListener("change", () => {
      scheduleMainRender();
      scheduleToroidalRender();
    });
  });

  const noiseListRoot = document.getElementById("noise-type-list");
  if (noiseListRoot) {
    noiseListRoot.addEventListener("change", (e) => {
      const t = e.target;
      if (!t || t.name !== "noise-type") return;
      scheduleMainRender();
    });
  }

  const toroidalListRoot = document.getElementById("toroidal-type-list");
  if (toroidalListRoot) {
    toroidalListRoot.addEventListener("change", (e) => {
      const t = e.target;
      if (!t || t.name !== "toroidal-type") return;
      scheduleToroidalRender();
    });
  }

  const zSlider = document.getElementById("z-slice");
  const zInput = document.getElementById("z-slice-num");

  const rerenderSliceOnly = () => {
    if (!state.lastToroidalVolumeView) return;
    renderToroidalSlice(builder, state.lastToroidalVolumeView, mosaicCanvases);
  };

  if (zSlider) {
    zSlider.addEventListener("input", () => {
      const v = Number(zSlider.value);
      if (zInput) zInput.value = String(v);
      rerenderSliceOnly();
    });
  }

  if (zInput) {
    zInput.addEventListener("change", () => {
      let idx = Number(zInput.value);
      if (!Number.isFinite(idx)) idx = 0;
      idx = Math.min(Math.max(Math.round(idx), 0), TOROIDAL_SIZE - 1);
      zInput.value = String(idx);
      if (zSlider) zSlider.value = String(idx);
      rerenderSliceOnly();
    });
  }

  const downloadMainBtn = document.getElementById("download-main");
  if (downloadMainBtn) {
    downloadMainBtn.addEventListener("click", async () => {
      try {
        updateOverridesFromFields();

        const bg = syncExportBackgroundToBuilder(builder);

        const resW = Number(document.getElementById("res-width")?.value) || 800;
        const resH =
          Number(document.getElementById("res-height")?.value) || 800;

        ensureCanvasSize(builder, mainCanvas, resW, resH);

        await renderMainNoise(builder, mainCanvas);

        const blob = await builder.exportCurrent2DToPNGBlob(resW, resH, {
          layer: 0,
          channel: 0,
          background: bg,
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "noise-main.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("download-main failed:", e);
        if (statsEl) statsEl.textContent = "Export main PNG failed: " + e;
      }
    });
  }

  const downloadTileBtn = document.getElementById("download-tile");
  if (downloadTileBtn) {
    downloadTileBtn.addEventListener("click", async () => {
      try {
        updateOverridesFromFields();

        const bg = syncExportBackgroundToBuilder(builder);

        await renderToroidalDemo(builder, mosaicCanvases, state);

        if (!state.lastToroidalVolumeView) {
          console.warn("No toroidal volume available for export");
          return;
        }

        const tileCanvas =
          (mosaicCanvases && mosaicCanvases.length
            ? mosaicCanvases[0]
            : null) || document.getElementById("tile-canvas");

        if (!tileCanvas) {
          console.warn("No tile canvas found for export");
          return;
        }

        const w = tileCanvas.width || TOROIDAL_SIZE;
        const h = tileCanvas.height || TOROIDAL_SIZE;
        const depth = TOROIDAL_SIZE;

        const zIndex = getZSliceIndexFromUI();
        const zNorm = (zIndex + 0.5) / depth;

        const blob = await builder.export3DSliceToPNGBlob(
          state.lastToroidalVolumeView,
          w,
          h,
          {
            depth,
            zNorm,
            channel: 0,
            chunk: 0,
            background: bg,
          },
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "noise-tile.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("download-tile failed:", e);
        if (statsEl) statsEl.textContent = "Export tile PNG failed: " + e;
      }
    });
  }

  function _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function _safeFilePart(s) {
    return String(s || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]+/g, "")
      .slice(0, 120);
  }

  async function saveToroidalTileset(builder, state) {
    if (!state || !state.lastToroidalVolumeView) {
      console.warn("No toroidal volume available for tileset export");
      return;
    }

    updateOverridesFromFields();

    const bg = syncExportBackgroundToBuilder(builder);

    await renderToroidalDemo(builder, mosaicCanvases, state);

    const globalParams = readGlobalParamsFromUI();
    const modes = collectSelectedToroidalModesFromUI().map((m) => m.entry);

    const cols = 16;
    const tileW = TOROIDAL_SIZE;
    const tileH = TOROIDAL_SIZE;
    const depth = TOROIDAL_SIZE;
    const rows = Math.ceil(depth / cols);

    const blob = await builder.export3DTilesetToPNGBlob(
      state.lastToroidalVolumeView,
      tileW,
      tileH,
      {
        depth,
        channel: 0,
        chunk: 0,
        tilesAcross: cols,
        tilesDown: rows,
        startSlice: 0,
        sliceCount: depth,
        background: bg,
      },
    );

    const modeTag =
      _safeFilePart(modes.map(makeNoiseLabelFromEntryPoint).join("+")) ||
      "tileset";
    const seedTag = _safeFilePart(globalParams.seed);
    const filename = `noise-tileset_${modeTag}_seed${seedTag}_${tileW}x${tileH}_z${depth}_${cols}x${rows}.png`;

    _downloadBlob(blob, filename);
  }

  // inside initNoiseDemo(), near the other download button handlers
  const downloadTilesetBtn = document.getElementById("download-tileset");
  if (downloadTilesetBtn) {
    downloadTilesetBtn.addEventListener("click", async () => {
      try {
        await saveToroidalTileset(builder, state);
      } catch (e) {
        console.error("download-tileset failed:", e);
        if (statsEl) statsEl.textContent = "Export tileset failed: " + e;
      }
    });
  }

  function getExportBackgroundFromUI() {
    const el = document.querySelector(
      'input[type="radio"][name="export-bg"]:checked',
    );
    const v = String(el?.value || "transparent");
    if (v === "black" || v === "white" || v === "transparent") return v;
    return "transparent";
  }

  function syncExportBackgroundToBuilder(builder) {
    const bg = getExportBackgroundFromUI();
    if (builder && typeof builder.setExportBackground === "function") {
      builder.setExportBackground(bg);
    }
    return bg;
  }

  function wireExportBackgroundUI(builder) {
    syncExportBackgroundToBuilder(builder);

    const radios = document.querySelectorAll(
      'input[type="radio"][name="export-bg"]',
    );
    radios.forEach((r) => {
      r.addEventListener("change", () => {
        syncExportBackgroundToBuilder(builder);
      });
    });
  }
  wireExportBackgroundUI(builder);
  updateMosaicCaption(collectSelectedToroidalModesFromUI().map((m) => m.entry));

  await renderMainNoise(builder, mainCanvas);
  await renderToroidalDemo(builder, mosaicCanvases, state);
}

document.addEventListener("DOMContentLoaded", () => {
  initNoiseDemo().catch((err) => console.error(err));
});
