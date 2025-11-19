// noiseUI.js
import html from './noiseComponent.html';
import { NoiseComputeBuilder } from './noiseCompute.js';

document.body.insertAdjacentHTML('afterbegin', html);

const NOISE_LABELS_BY_BIT = {
  0: 'Perlin',
  1: 'Billow',
  2: 'AntiBillow',
  3: 'Ridge',
  4: 'AntiRidge',
  5: 'RidgedMultifractal',
  6: 'RidgedMultifractal2',
  7: 'RidgedMultifractal3',
  8: 'RidgedMultifractal4',
  9: 'AntiRidgedMultifractal',
  10: 'AntiRidgedMultifractal2',
  11: 'AntiRidgedMultifractal3',
  12: 'AntiRidgedMultifractal4',
  13: 'FBM',
  14: 'FBM2',
  15: 'FBM3',
  16: 'CellularBM1',
  17: 'CellularBM2',
  18: 'CellularBM3',
  19: 'VoronoiBM1',
  20: 'VoronoiBM2',
  21: 'VoronoiBM3',
  22: 'CellularPattern',
  23: 'WorleyPattern',
  24: 'AntiCellularPattern',
  25: 'AntiWorleyPattern',
  26: 'LanczosBillow',
  27: 'LanczosAntiBillow',
  28: 'VoronoiTileNoise',
  29: 'VoronoiCircleNoise',
  30: 'VoronoiCircle2',
  31: 'VoronoiFlatShade',
  32: 'VoronoiRipple3D',
  33: 'VoronoiRipple3D2',
  34: 'VoronoiCircularRipple',
  35: 'FVoronoiRipple3D',
  36: 'FVoronoiCircularRipple',
  37: 'RippleNoise',
  38: 'FractalRipples',
  39: 'HexWorms',
  40: 'PerlinWorms',
  41: 'White Noise',
  42: 'Blue Noise',
  43: 'Simplex',
  44: 'Curl2D',
  45: 'CurlFBM2D',
  46: 'DomainWarpFBM1',
  47: 'DomainWarpFBM2',
  48: 'GaborAnisotropic',
  49: 'TerraceNoise',
  50: 'FoamNoise',
  51: 'Turbulence',
  52: 'Perlin4D',
  53: 'Worley4D',
  54: 'AntiWorley4D'
};

const NOISE_CONSTRAINTS_BY_BIT = {
  3: {
    clamp: { freq: [0.25, 8.0], gain: [0.2, 0.8], octaves: [1, 12] }
  },
  4: {
    clamp: { freq: [0.25, 8.0], gain: [0.2, 0.8], octaves: [1, 12] }
  },
  5: {
    clamp: { freq: [0.25, 8.0], gain: [0.2, 0.9], octaves: [2, 14] }
  },
  6: {
    clamp: { freq: [0.25, 8.0], gain: [0.2, 0.9], octaves: [2, 14] }
  },
  7: {
    clamp: { freq: [0.25, 8.0], gain: [0.2, 0.9], octaves: [2, 14] }
  },
  8: {
    clamp: { freq: [0.25, 8.0], gain: [0.2, 0.9], octaves: [2, 14] }
  },

  13: {
    clamp: { gain: [0.2, 0.8], octaves: [2, 10] }
  },
  14: {
    clamp: { gain: [0.2, 0.8], octaves: [2, 10] }
  },
  15: {
    clamp: { gain: [0.2, 0.8], octaves: [2, 10] }
  },

  19: {
    clamp: { threshold: [0.0, 1.0] }
  },
  20: {
    clamp: { threshold: [0.0, 1.0] }
  },
  21: {
    clamp: { threshold: [0.0, 1.0] }
  },
  22: {
    clamp: { threshold: [0.0, 1.0] }
  },
  23: {
    clamp: { threshold: [0.0, 1.0] }
  },
  24: {
    clamp: { threshold: [0.0, 1.0] }
  },
  25: {
    clamp: { threshold: [0.0, 1.0] }
  },

  44: {
    force: { turbulence: 1 },
    clamp: { warpAmp: [0.1, 2.0], freq: [0.25, 6.0] }
  },
  45: {
    force: { turbulence: 1 },
    clamp: { warpAmp: [0.1, 2.0], freq: [0.25, 6.0] }
  },
  46: {
    force: { turbulence: 1 },
    clamp: { warpAmp: [0.1, 3.0] }
  },
  47: {
    force: { turbulence: 1 },
    clamp: { warpAmp: [0.1, 3.0] }
  },

  48: {
    clamp: { gaborRadius: [0.5, 6.0] }
  },

  51: {
    force: { turbulence: 1 },
    clamp: { gain: [0.5, 0.95] }
  }
};

const TOROIDAL_VOLUME_CHOICES = [
  'clearTexture',
  'computePerlin4D',
  'computeWorley4D'
];

const TOROIDAL_SIZE = 128;
const TOROIDAL_VOLUME_KEY = 'toroidalDemo';

const MODE_OVERRIDES = new Map();

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
  const cfg = NOISE_CONSTRAINTS_BY_BIT[bit];

  if (cfg && cfg.clamp) {
    const c = cfg.clamp;
    if (c.freq) clampField(local, 'freq', c.freq[0], c.freq[1]);
    if (c.gain) clampField(local, 'gain', c.gain[0], c.gain[1]);
    if (c.octaves) clampField(local, 'octaves', c.octaves[0], c.octaves[1]);
    if (c.threshold) clampField(local, 'threshold', c.threshold[0], c.threshold[1]);
    if (c.warpAmp) clampField(local, 'warpAmp', c.warpAmp[0], c.warpAmp[1]);
    if (c.gaborRadius) clampField(local, 'gaborRadius', c.gaborRadius[0], c.gaborRadius[1]);
  }

  if (cfg && cfg.force) {
    for (const [k, v] of Object.entries(cfg.force)) {
      local[k] = v;
    }
  }

  const overrideObj = MODE_OVERRIDES.get(bit);
  if (overrideObj) {
    for (const [k, v] of Object.entries(overrideObj)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
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

  const seed = Math.max(1, Math.floor(getNum('noise-seed', 1234567890)));

  return {
    seed,
    zoom: getNum('noise-zoom', 1.0),
    freq: getNum('noise-freq', 1.0),
    octaves: Math.max(1, Math.floor(getNum('noise-octaves', 8))),
    lacunarity: getNum('noise-lacunarity', 2.0),
    gain: getNum('noise-gain', 0.5),
    xShift: getNum('noise-xShift', 0.0),
    yShift: getNum('noise-yShift', 0.0),
    zShift: getNum('noise-zShift', 0.0),
    threshold: getNum('noise-threshold', 0.1),
    turbulence: 0,
    seedAngle: 0.0,
    exp1: 1.0,
    exp2: 0.0,
    rippleFreq: 10.0,
    time: 0.0,
    warpAmp: 0.5,
    gaborRadius: 4.0,
    terraceStep: 8.0,
    toroidal: 0,
    voroMode: 0,
    edgeK: 0.0
  };
}

function collectSelectedBitsFromUI() {
  const boxes = document.querySelectorAll('input[type="checkbox"][name="noise-type"]');
  const bits = [];
  boxes.forEach(box => {
    if (box.checked) {
      const bit = Number(box.dataset.bit);
      if (Number.isInteger(bit)) bits.push(bit);
    }
  });
  return bits;
}

function initMainAndMosaicCanvases() {
  let mainCanvas = document.getElementById('noise-canvas');
  const stack = document.getElementById('view-stack');

  if (!mainCanvas && stack) {
    mainCanvas = document.createElement('canvas');
    mainCanvas.id = 'noise-canvas';
    mainCanvas.width = 800;
    mainCanvas.height = 800;
    stack.appendChild(mainCanvas);
  }

  if (!mainCanvas) {
    throw new Error('Missing main preview canvas (#noise-canvas)');
  }

  const mosaicRoot = document.getElementById('mosaic');
  if (!mosaicRoot) {
    throw new Error('Missing #mosaic container');
  }

  const mosaicCanvases = [];
  const existing = mosaicRoot.querySelectorAll('canvas');
  if (!existing.length) {
    for (let i = 0; i < 9; i++) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      mosaicRoot.appendChild(c);
      mosaicCanvases.push(c);
    }
  } else {
    existing.forEach(c => mosaicCanvases.push(c));
  }

  return { mainCanvas, mosaicCanvases };
}

function buildModeLabelList(bits) {
  if (!bits.length) return 'Perlin';
  const labels = bits.map(bit => NOISE_LABELS_BY_BIT[bit] || String(bit));
  return labels.join(', ');
}

function populateOverrideModeSelect() {
  const select = document.getElementById('override-mode');
  if (!select) return;
  select.innerHTML = '';

  const bits = Object.keys(NOISE_LABELS_BY_BIT)
    .map(k => Number(k))
    .filter(bit => Number.isInteger(bit) && bit >= 0 && bit <= 54)
    .sort((a, b) => a - b);

  for (const bit of bits) {
    const opt = document.createElement('option');
    opt.value = String(bit);
    opt.textContent = `${bit}: ${NOISE_LABELS_BY_BIT[bit]}`;
    select.appendChild(opt);
  }

  if (bits.length) {
    select.value = String(bits[0]);
  }
}

function populateOverrideFieldsForBit(bit) {
  const overrides = MODE_OVERRIDES.get(bit) || {};
  const setVal = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = overrides[key];
    el.value = typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
  };

  setVal('ov-zoom', 'zoom');
  setVal('ov-freq', 'freq');
  setVal('ov-gain', 'gain');
  setVal('ov-octaves', 'octaves');
  setVal('ov-warp', 'warpAmp');
  setVal('ov-threshold', 'threshold');
  setVal('ov-gabor', 'gaborRadius');
  setVal('ov-xShift', 'xShift');
  setVal('ov-yShift', 'yShift');
  setVal('ov-zShift', 'zShift');
}

function updateOverridesFromFields() {
  const select = document.getElementById('override-mode');
  if (!select) return;
  const bit = Number(select.value);
  if (!Number.isInteger(bit)) return;

  const readNum = id => {
    const el = document.getElementById(id);
    if (!el) return null;
    const trimmed = String(el.value).trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return null;
    return num;
  };

  const obj = {};
  const zoom = readNum('ov-zoom');
  const freq = readNum('ov-freq');
  const gain = readNum('ov-gain');
  const octaves = readNum('ov-octaves');
  const warpAmp = readNum('ov-warp');
  const threshold = readNum('ov-threshold');
  const gaborRadius = readNum('ov-gabor');
  const xShift = readNum('ov-xShift');
  const yShift = readNum('ov-yShift');
  const zShift = readNum('ov-zShift');

  if (zoom !== null) obj.zoom = zoom;
  if (freq !== null) obj.freq = freq;
  if (gain !== null) obj.gain = gain;
  if (octaves !== null) obj.octaves = octaves;
  if (warpAmp !== null) obj.warpAmp = warpAmp;
  if (threshold !== null) obj.threshold = threshold;
  if (gaborRadius !== null) obj.gaborRadius = gaborRadius;
  if (xShift !== null) obj.xShift = xShift;
  if (yShift !== null) obj.yShift = yShift;
  if (zShift !== null) obj.zShift = zShift;

  if (Object.keys(obj).length) {
    MODE_OVERRIDES.set(bit, obj);
  } else {
    MODE_OVERRIDES.delete(bit);
  }
}

function getZSliceIndexFromUI() {
  const slider = document.getElementById('z-slice');
  const num = document.getElementById('z-slice-num');

  let idx = 0;
  if (slider) {
    idx = Number(slider.value);
  } else if (num) {
    idx = Number(num.value);
  }

  if (!Number.isFinite(idx)) idx = 0;
  idx = Math.min(Math.max(Math.round(idx), 0), TOROIDAL_SIZE - 1);

  if (slider && String(slider.value) !== String(idx)) {
    slider.value = String(idx);
  }
  if (num && String(num.value) !== String(idx)) {
    num.value = String(idx);
  }

  return idx;
}

async function renderMainNoise(builder, mainCanvas) {
  const resW = Number(document.getElementById('res-width')?.value) || 800;
  const resH = Number(document.getElementById('res-height')?.value) || 800;
  mainCanvas.width = resW;
  mainCanvas.height = resH;

  const previewMeta = document.getElementById('preview-meta');
  const previewStats = document.getElementById('preview-stats');

  const globalParams = readGlobalParamsFromUI();
  builder.buildPermTable(globalParams.seed | 0);

  const selectedBits = collectSelectedBitsFromUI();
  const noiseBits = selectedBits.length ? selectedBits : [0];

  const commonOptions = {
    getGradient: 0,
    outputChannel: 1,
    baseRadius: 0,
    heightScale: 1,
    useCustomPos: 0
  };

  const tComputeStart = performance.now();

  await builder.computeToTexture(
    resW,
    resH,
    globalParams,
    {
      ...commonOptions,
      noiseChoices: ['clearTexture'],
      frameFullWidth: resW,
      frameFullHeight: resH
    }
  );

  for (const bit of noiseBits) {
    const params = buildParamsForBit(bit, globalParams);
    await builder.computeToTexture(
      resW,
      resH,
      params,
      {
        ...commonOptions,
        noiseChoices: [bit],
        frameFullWidth: resW,
        frameFullHeight: resH
      }
    );
  }

  const tComputeEnd = performance.now();

  const view = builder.getCurrentView();
  const tBlitStart = performance.now();
  if (view) {
    builder.renderTextureToCanvas(view, mainCanvas, {
      layer: 0,
      channel: 0,
      preserveCanvasSize: true,
      clear: true
    });
  }
  const tBlitEnd = performance.now();

  if (previewMeta) {
    previewMeta.textContent = `Height field preview · ${resW}×${resH} · modes: ${buildModeLabelList(noiseBits)}`;
  }
  if (previewStats) {
    const computeMs = (tComputeEnd - tComputeStart).toFixed(1);
    const blitMs = (tBlitEnd - tBlitStart).toFixed(1);
    previewStats.textContent = `GPU compute ${computeMs} ms · blit ${blitMs} ms`;
  }

  return { resW, resH, noiseBits };
}

function renderToroidalSlice(builder, volumeView, mosaicCanvases) {
  if (!volumeView) return;
  const depth = TOROIDAL_SIZE;
  const zIndex = getZSliceIndexFromUI();
  const zNorm = (zIndex + 0.5) / depth;

  const count = mosaicCanvases.length || 9;

  for (let i = 0; i < count; i++) {
    const canvas = mosaicCanvases[i];
    canvas.width = TOROIDAL_SIZE;
    canvas.height = TOROIDAL_SIZE;

    builder.renderTexture3DSliceToCanvas(volumeView, canvas, {
      depth,
      zNorm,
      channel: 0,
      chunk: 0,
      preserveCanvasSize: true,
      clear: true
    });
  }
}

async function renderToroidalDemo(builder, mosaicCanvases, state) {
  const globalParams = readGlobalParamsFromUI();

  const shapeParams = {
    ...globalParams,
    toroidal: 1
  };

  const t0 = performance.now();
  const volumeView = await builder.computeToTexture3D(
    TOROIDAL_SIZE,
    TOROIDAL_SIZE,
    TOROIDAL_SIZE,
    shapeParams,
    {
      noiseChoices: TOROIDAL_VOLUME_CHOICES,
      outputChannel: 1,
      id: TOROIDAL_VOLUME_KEY
    }
  );
  const t1 = performance.now();

  state.lastToroidalVolumeView = volumeView;
  state.lastToroidalComputeMs = t1 - t0;

  renderToroidalSlice(builder, volumeView, mosaicCanvases);
}

async function initNoiseDemo() {
  const statsEl = document.getElementById('preview-stats');

  if (!navigator.gpu) {
    console.error('WebGPU not available in this browser.');
    if (statsEl) statsEl.textContent = 'WebGPU not available in this browser.';
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error('Failed to get GPU adapter.');
    if (statsEl) statsEl.textContent = 'Failed to get GPU adapter.';
    return;
  }

  const device = await adapter.requestDevice();
  const builder = new NoiseComputeBuilder(device, device.queue);

  const { mainCanvas, mosaicCanvases } = initMainAndMosaicCanvases();

  builder.configureCanvas(mainCanvas);
  mosaicCanvases.forEach(c => builder.configureCanvas(c));

  populateOverrideModeSelect();
  const overrideModeSelect = document.getElementById('override-mode');
  if (overrideModeSelect) {
    const bit = Number(overrideModeSelect.value);
    if (Number.isInteger(bit)) populateOverrideFieldsForBit(bit);
  }

  const overrideInputs = [
    'ov-zoom', 'ov-freq', 'ov-gain', 'ov-octaves',
    'ov-warp', 'ov-threshold', 'ov-gabor',
    'ov-xShift', 'ov-yShift', 'ov-zShift'
  ];

  let mainRenderPending = false;
  const scheduleMainRender = () => {
    if (mainRenderPending) return;
    mainRenderPending = true;
    requestAnimationFrame(() => {
      mainRenderPending = false;
      renderMainNoise(builder, mainCanvas).catch(err => {
        console.error(err);
        if (statsEl) statsEl.textContent = String(err);
      });
    });
  };

  overrideInputs.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      updateOverridesFromFields();
      scheduleMainRender();
    });
  });

  if (overrideModeSelect) {
    overrideModeSelect.addEventListener('change', () => {
      const bit = Number(overrideModeSelect.value);
      if (!Number.isInteger(bit)) return;
      populateOverrideFieldsForBit(bit);
    });
  }

  const ovClear = document.getElementById('ov-clear');
  if (ovClear) {
    ovClear.addEventListener('click', () => {
      const select = document.getElementById('override-mode');
      if (!select) return;
      const bit = Number(select.value);
      if (!Number.isInteger(bit)) return;
      MODE_OVERRIDES.delete(bit);
      populateOverrideFieldsForBit(bit);
      scheduleMainRender();
    });
  }

  const overridesBtn = document.getElementById('noise-overrides-btn');
  if (overridesBtn) {
    overridesBtn.addEventListener('click', () => {
      const group = document.getElementById('overrides-group');
      if (!group) return;
      group.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const state = {
    lastToroidalVolumeView: null,
    lastToroidalComputeMs: 0
  };

  const renderBtn = document.getElementById('render-btn');
  const applyResBtn = document.getElementById('apply-res');

  if (renderBtn) {
    renderBtn.addEventListener('click', () => {
      renderMainNoise(builder, mainCanvas)
        .then(() => renderToroidalDemo(builder, mosaicCanvases, state))
        .catch(err => {
          console.error(err);
          if (statsEl) statsEl.textContent = String(err);
        });
    });
  }

  if (applyResBtn) {
    applyResBtn.addEventListener('click', () => {
      scheduleMainRender();
    });
  }

  const zSlider = document.getElementById('z-slice');
  const zInput = document.getElementById('z-slice-num');

  const rerenderSliceOnly = () => {
    if (!state.lastToroidalVolumeView) return;
    renderToroidalSlice(builder, state.lastToroidalVolumeView, mosaicCanvases);
  };

  if (zSlider) {
    zSlider.addEventListener('input', () => {
      const v = Number(zSlider.value);
      if (zInput) zInput.value = String(v);
      rerenderSliceOnly();
    });
  }

  if (zInput) {
    zInput.addEventListener('change', () => {
      let idx = Number(zInput.value);
      if (!Number.isFinite(idx)) idx = 0;
      idx = Math.min(Math.max(Math.round(idx), 0), TOROIDAL_SIZE - 1);
      zInput.value = String(idx);
      if (zSlider) zSlider.value = String(idx);
      rerenderSliceOnly();
    });
  }

  const GLOBAL_PARAM_IDS = [
    'noise-seed',
    'noise-zoom',
    'noise-freq',
    'noise-octaves',
    'noise-lacunarity',
    'noise-gain',
    'noise-xShift',
    'noise-yShift',
    'noise-zShift',
    'noise-threshold'
  ];

  GLOBAL_PARAM_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', scheduleMainRender);
    el.addEventListener('change', scheduleMainRender);
  });

  const noiseBoxes = document.querySelectorAll('input[type="checkbox"][name="noise-type"]');
  noiseBoxes.forEach(box => {
    box.addEventListener('change', scheduleMainRender);
  });

  await renderMainNoise(builder, mainCanvas);
  await renderToroidalDemo(builder, mosaicCanvases, state);
}

document.addEventListener('DOMContentLoaded', () => {
  initNoiseDemo().catch(err => console.error(err));
});
