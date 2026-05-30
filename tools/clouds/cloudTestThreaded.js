// tools/clouds/cloudTestThreaded.js
// clouds-ui.js
// Debounced UI -> worker sync. Per-texture mode selectors.
// Shape/detail 3D selectors are filtered to 4D entry points only.

import html from "./clouds.html";
import wrkr from "./cloudTest.worker.js";

let worker;

// Constants (mirror worker). Mobile keeps the same shader path but lowers
// startup texture/canvas pressure so first load does not stall the browser.
function isMobileLikeDevice() {
  const params = new URLSearchParams(location.search || "");
  if (params.has("desktop") || params.get("profile") === "desktop") return false;
  if (params.has("mobile") || params.get("profile") === "mobile") return true;

  const ua = navigator.userAgent || "";
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const coarse = typeof matchMedia === "function" ? !!matchMedia("(pointer: coarse)").matches : false;
  const noHover = typeof matchMedia === "function" ? !!matchMedia("(hover: none)").matches : false;
  const touchPoints = Number(navigator.maxTouchPoints || 0);
  const smallSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  const shortScreenSide = Math.min(screen?.width || 0, screen?.height || 0);
  const lowMem = Number(navigator.deviceMemory || 8) <= 4;

  // Do not classify desktop Chrome as mobile only because deviceMemory is 4 GB.
  // Mobile caps are for touch/small-screen devices unless explicitly forced with ?mobile=1.
  const touchSmallViewport = touchPoints > 0 && coarse && smallSide <= 980;
  const touchSmallScreen = touchPoints > 0 && coarse && shortScreenSide > 0 && shortScreenSide <= 900;
  const constrainedTouchDevice = touchPoints > 0 && coarse && noHover && lowMem && smallSide <= 1200;

  return uaMobile || touchSmallViewport || touchSmallScreen || constrainedTouchDevice;
}

const MOBILE_PROFILE = isMobileLikeDevice();
const STARTUP_PROFILE = MOBILE_PROFILE
  ? {
      shapeSize: 96,
      detailSize: 32,
      weatherW: 384,
      weatherH: 384,
      blueW: 128,
      blueH: 128,
      dbgSize: 128,
      maxDpr: 1.35,
      maxMainPixels: 900_000,
      maxMainSide: 1280,
      renderScaleDivider: 4,
      temporalCellRate: 4,
      debugCanvases: true,
      skipStartupDebug: true,
      capMainCanvas: true,
    }
  : {
      shapeSize: 128,
      detailSize: 32,
      weatherW: 512,
      weatherH: 512,
      blueW: 256,
      blueH: 256,
      dbgSize: 224,
      renderScaleDivider: 4,
      temporalCellRate: 4,
      debugCanvases: true,
      skipStartupDebug: true,
      capMainCanvas: false,
    };

const SHAPE_SIZE = STARTUP_PROFILE.shapeSize,
  DETAIL_SIZE = STARTUP_PROFILE.detailSize,
  WEATHER_W = STARTUP_PROFILE.weatherW,
  WEATHER_H = STARTUP_PROFILE.weatherH,
  BN_W = STARTUP_PROFILE.blueW,
  BN_H = STARTUP_PROFILE.blueH;
const DBG_SIZE = STARTUP_PROFILE.dbgSize;
const DPR = () => {
  const raw = Math.max(1, window.devicePixelRatio || 1);
  return STARTUP_PROFILE.capMainCanvas ? Math.min(STARTUP_PROFILE.maxDpr, raw) : raw;
};

let ENTRY_POINTS = [];

// Default preview + noise param blocks (each has seed)
const preview = {
  cam: { x: -0.75, y: -1.2, z: -0.95, yawDeg: 35, pitchDeg: 28, fovYDeg: 60 },
  exposure: 1.18,
  sky: [0.60, 0.75, 0.98],
  layer: 0,
  box: {
    center: [0, 0, 0],
    half: [18, 0.3, 18],
    uvScale: 1,
  },
  renderScaleDivider: STARTUP_PROFILE.renderScaleDivider,
  temporalCellRate: STARTUP_PROFILE.temporalCellRate,
  layerPreset: "rain_shelf",
  gradeStyle: 3,
  sunTint: [1.0, 1.0, 1.0],
  transmissiveLightTint: [0.94, 1.00, 1.08],
  frontLightTint: [1.18, 1.24, 1.32],
  volumeShadowTint: [0.60, 0.68, 0.82],
  directLightBlend: 0.90,
  directLightBoost: 0.72,
  cloudLitTint: [1.0, 1.0, 1.0],
  cloudShadowTint: [0.0, 0.0, 0.0],
  edgeTint: [1.0, 1.0, 1.0],
  styleShadowStrength: 1.00,
  styleShadowEdge: 1.00,
  styleShadowDarkness: 0.50,
  styleColorLift: 1.28,
  styleSaturation: 1.24,
  styleRimStrength: 1.04,
  styleSunBleed: 0.66,
  styleMidLift: 1.26,
  alphaFloor: 0.0,
  godRaysEnabled: true,
  godRayStrength: 1.00,
  godRayLength: 1.10,
  godRayFalloff: 1.10,
  sun: { azDeg: 45, elDeg: 21, bloom: 0.18 },
};

// Weather params (R channel)
const weatherParams = {
  mode: "computeFBM4D",
  seed: 123456789001,
  zoom: 4.0,
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
  mode: "computeBillow4D",
  seed: 123456789000,
  scale: 1.0,
  zoom: 4.0,
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
  seed: 123456789003,
  scale: 1.0,
  zoom: 4.0,
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
  voroMode: 4,
  edgeK: 0.0,
  warpAmp: 0.0,
  baseModeA: "computeAntiWorley4D",
  baseModeB: "computeAntiWorley4D",
  bandMode2: "computeAntiWorley4D",
  bandMode3: "computeAntiWorley4D",
  bandMode4: "computeAntiWorley4D",
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
  mode1: "computeWorley4D",
  mode2: "computeWorley4D",
  mode3: "computeWorley4D",
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

  shapeBias: 0.4,
  detailBias: 0.0,
  weatherBias: 0.3,

  shapeVel: [0.1, 0.0, 0.0],
  detailVel: [0.03, 0.0, 0.0],
  weatherVel: [0.01, 0.0, 0.0],
};

function normalizeRenderScaleDivider(value, fallback = 5) {
  const v = Number.isFinite(+value) ? Math.floor(+value) : fallback;
  return Math.max(1, Math.min(8, v));
}

function previewRenderScaleDivider() {
  return normalizeRenderScaleDivider(preview.renderScaleDivider, 4);
}

preview.renderScaleDivider = previewRenderScaleDivider();

let reprojEnabled = false;
const reprojDefaultScale = 1 / 16;

const reprojTemporalBlend = 0.94;
let animRunning = false;
let visualFpsRaf = 0;
let visualFpsLastT = 0;
let visualFpsEma = null;

function stopVisualFpsTicker() {
  if (visualFpsRaf) cancelAnimationFrame(visualFpsRaf);
  visualFpsRaf = 0;
  visualFpsLastT = 0;
  visualFpsEma = null;
}

function startVisualFpsTicker() {
  stopVisualFpsTicker();
  const fpsEl = $("fpsDisplay");
  const tick = (t) => {
    if (!animRunning) {
      stopVisualFpsTicker();
      return;
    }
    if (visualFpsLastT > 0) {
      const dt = Math.max(0.001, t - visualFpsLastT);
      const fps = 1000 / dt;
      visualFpsEma = visualFpsEma === null ? fps : visualFpsEma * 0.86 + fps * 0.14;
      if (fpsEl) fpsEl.textContent = `${Math.round(visualFpsEma * 10) / 10} fps`;
    }
    visualFpsLastT = t;
    visualFpsRaf = requestAnimationFrame(tick);
  };
  visualFpsRaf = requestAnimationFrame(tick);
}

function currentReprojectionTemporalBlend(enabled = cloudHistoryEnabled()) {
  return enabled ? reprojTemporalBlend : 0.0;
}

function currentPreviewCoarseFactor() {
  return previewRenderScaleDivider();
}

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

function temporalCellUpdateEnabled() {
  return normalizeTemporalCellRate(preview.temporalCellRate ?? 1) > 1;
}

function cloudHistoryEnabled() {
  return reprojEnabled || temporalCellUpdateEnabled();
}

// ---- DOM helpers ----
function mountCloudHtml() {
  if ($("gpuCanvas")) return;

  const styleMatch = String(html).match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (styleMatch && !document.getElementById("clouds-inline-style")) {
    const style = document.createElement("style");
    style.id = "clouds-inline-style";
    style.textContent = styleMatch[1];
    document.head.appendChild(style);
  }

  const bodyMatch = String(html).match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  document.body.insertAdjacentHTML("beforeend", bodyMatch ? bodyMatch[1] : String(html));
}

function installCloudUiPolish() {
  if (document.getElementById("cloud-ui-polish")) return;

  const style = document.createElement("style");
  style.id = "cloud-ui-polish";
  style.textContent = `
    :root {
      color-scheme: dark;
      --cloud-ui-bg: #070b13;
      --cloud-ui-panel: rgba(14, 20, 32, 0.86);
      --cloud-ui-panel-strong: rgba(24, 32, 48, 0.94);
      --cloud-ui-line: rgba(180, 205, 255, 0.16);
      --cloud-ui-line-strong: rgba(180, 205, 255, 0.28);
      --cloud-ui-text: rgba(235, 242, 255, 0.94);
      --cloud-ui-muted: rgba(198, 212, 236, 0.68);
      --cloud-ui-accent: #84b8ff;
    }
    body {
      background:
        radial-gradient(circle at 30% 0%, rgba(68, 104, 160, 0.20), transparent 42rem),
        linear-gradient(180deg, #08101d 0%, var(--cloud-ui-bg) 100%);
      color: var(--cloud-ui-text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
    }
    button, input, select, textarea {
      font: inherit;
    }
    button {
      border: 1px solid var(--cloud-ui-line-strong);
      border-radius: 10px;
      background: rgba(132, 184, 255, 0.10);
      color: var(--cloud-ui-text);
      padding: 8px 10px;
      cursor: pointer;
    }
    button:hover {
      background: rgba(132, 184, 255, 0.18);
    }
    button:disabled {
      cursor: wait;
      opacity: 0.55;
    }
    input, select, textarea {
      border: 1px solid var(--cloud-ui-line);
      border-radius: 9px;
      background: rgba(4, 8, 15, 0.72);
      color: var(--cloud-ui-text);
      padding: 7px 8px;
      min-width: 0;
    }
    input[type="range"] {
      padding: 0;
      height: 28px;
      accent-color: var(--cloud-ui-accent);
    }
    label {
      color: var(--cloud-ui-muted);
      font-size: 12px;
    }
    label > span:first-child {
      color: var(--cloud-ui-text);
      font-weight: 600;
    }
    select {
      min-height:35px;
    }
    #cloud-quick-dock {
      position: sticky;
      top: 0;
      z-index: 30;
      display: grid;
      gap: 10px;
      margin: 0 auto 14px;
      padding: 12px 14px;
      width: min(1500px, calc(100vw - 24px));
      box-sizing: border-box;
      border: 1px solid var(--cloud-ui-line);
      border-radius: 0 0 18px 18px;
      background: linear-gradient(180deg, rgba(13, 20, 33, 0.96), rgba(10, 15, 24, 0.92));
      backdrop-filter: blur(18px);
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.32);
    }
    .cloud-quick-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      font-size: 13px;
      letter-spacing: 0.01em;
    }
    .cloud-quick-title strong {
      font-size: 15px;
    }
    #cloud-quick-status {
      color: var(--cloud-ui-muted);
      text-align: right;
    }
    .cloud-quick-row {
      display: grid;
      grid-template-columns: minmax(260px, 1.4fr) minmax(170px, 0.8fr) minmax(150px, 0.65fr) minmax(180px, 0.7fr) auto auto;
      gap: 10px;
      align-items: end;
    }
    .cloud-tabs {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 6px;
    }
    .cloud-tab {
      padding: 8px 6px;
      white-space: nowrap;
    }
    .cloud-tab.active {
      background: rgba(132, 184, 255, 0.24);
      border-color: rgba(132, 184, 255, 0.58);
      box-shadow: inset 0 0 0 1px rgba(132, 184, 255, 0.25);
    }
    .cloud-quick-field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }
    .cloud-quick-field select, .cloud-quick-field input {
      width: 100%;
      box-sizing: border-box;
    }
    .cloud-quick-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid var(--cloud-ui-line);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.04);
      white-space: nowrap;
    }
    .cloud-panel {
      border: 1px solid var(--cloud-ui-line);
      border-radius: 16px;
      background: var(--cloud-ui-panel);
      padding: 14px;
      box-sizing: border-box;
    }
    .cloud-panel-shell {
      width: min(1500px, calc(100vw - 24px));
      margin: 0 auto 18px;
      display: grid;
      gap: 14px;
    }
    .cloud-panel-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 2px 2px 8px;
      border-bottom: 1px solid var(--cloud-ui-line);
      margin-bottom: 12px;
    }
    .cloud-panel-heading strong {
      color: var(--cloud-ui-text);
      font-size: 14px;
      letter-spacing: 0.02em;
    }
    .cloud-panel-heading span {
      color: var(--cloud-ui-muted);
      font-size: 12px;
    }
    .cloud-panel-fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      align-items: end;
    }
    .cloud-texture-panel {
      display: grid;
      grid-template-columns: minmax(260px, 320px) minmax(320px, 1fr);
      gap: 14px;
      align-items: start;
    }
    .cloud-texture-preview-card {
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px solid var(--cloud-ui-line);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.045);
      box-sizing: border-box;
    }
    .cloud-debug-preview-stack {
      display: grid;
      gap: 12px;
      align-items: start;
    }
    #cloud-texture-preview-menu {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      margin: 0 0 18px;
      padding: 14px;
      border: 1px solid var(--cloud-ui-line);
      border-radius: 16px;
      background: var(--cloud-ui-panel);
      box-sizing: border-box;
      overflow: hidden;
    }
    #cloud-texture-preview-menu .cloud-panel-heading {
      margin: 0 0 12px;
      padding: 2px 2px 8px;
    }
    #cloud-texture-preview-menu .cloud-debug-preview-stack {
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
      min-width: 0;
    }
    #cloud-texture-preview-menu .cloud-texture-preview-card {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      padding: 12px;
      border-radius: 16px;
      overflow: hidden;
    }
    #cloud-texture-preview-menu canvas[id^="dbg-"] {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      aspect-ratio: 1 / 1;
      justify-self: stretch;
    }
    .cloud-texture-preview-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      color: var(--cloud-ui-text);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .cloud-texture-preview-title small {
      color: var(--cloud-ui-muted);
      font-size: 11px;
      font-weight: 600;
      text-transform: none;
      letter-spacing: 0;
    }

    .cloud-persistent-texture-previews {
      align-self: stretch;
      justify-self: stretch;
      min-width: 0;
    }
    .cloud-persistent-texture-previews * {
      box-sizing: border-box;
    }
    .cloud-texture-controls {
      min-width: 0;
    }
    .cloud-field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }
    .cloud-field input, .cloud-field select {
      width: 100%;
      box-sizing: border-box;
    }
    #gpuCanvas {
      display: block;
      width: min(100%, 1360px);
      min-height: 420px;
      margin: 0 auto 12px;
      border-radius: 18px;
      border: 1px solid var(--cloud-ui-line-strong);
      background: #02050a;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
    }
    canvas[id^="dbg-"] {
      display: block;
      width: 100%;
      max-width: 100%;
      height: auto;
      aspect-ratio: 1 / 1;
      border-radius: 13px;
      border: 1px solid var(--cloud-ui-line);
      background: #02050a;
      image-rendering: pixelated;
    }
    .cloud-texture-slice-control {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px 8px;
      align-items: center;
      width: 100%;
      margin: 0;
      padding: 8px;
      border: 1px solid var(--cloud-ui-line);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.045);
      box-sizing: border-box;
    }
    .cloud-texture-slice-control span {
      font-size: 11px;
      color: var(--cloud-ui-text);
      font-weight: 800;
      letter-spacing: 0.035em;
      text-transform: uppercase;
    }
    .cloud-texture-slice-value {
      color: var(--cloud-ui-muted);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    .cloud-texture-slice-control input[type="range"] {
      grid-column: 1 / -1;
      width: 100%;
    }
    .cloud-texture-slice-control input[type="number"] {
      display: none;
    }
    .cloud-legacy-slice-hidden,
    .cloud-empty-original-shell,
    #slice,
    #sliceLabel,
    label[for="slice"],
    .cloud-control-group[data-cloud-control-group="Slice"],
    .cloud-control-group:has(#slice),
    .cloud-control-group:has(#sliceLabel),
    .cloud-control-group:has(label[for="slice"]) {
      display: none !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      min-height: 0 !important;
      height: 0 !important;
      overflow: hidden !important;
    }
    @media (max-width: 1180px) {
      .cloud-quick-row {
        grid-template-columns: 1fr 1fr;
      }
      .cloud-tabs {
        grid-column: 1 / -1;
      }
      .cloud-texture-panel {
        grid-template-columns: 1fr;
      }
    }
    #cloud-quick-dock {
      position: static;
      top: auto;
      z-index: auto;
      width: 100%;
      margin: 0 0 14px;
      border-radius: 16px;
      box-shadow: none;
      background: linear-gradient(180deg, rgba(19, 28, 44, 0.96), rgba(9, 14, 24, 0.94));
    }
    .cloud-quick-row {
      grid-template-columns: 1fr;
      align-items: stretch;
    }
    .cloud-tabs {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .cloud-tab {
      text-align: center;
    }
    .cloud-quick-title {
      align-items: flex-start;
    }
    #cloud-quick-status {
      max-width: 13rem;
      line-height: 1.35;
    }
    .cloud-control-group {
      display: grid;
      gap: 9px;
      margin: 0 0 12px;
      padding: 11px;
      border: 1px solid var(--cloud-ui-line);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.035);
    }
    .cloud-control-group-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: var(--cloud-ui-text);
      font-size: 11px;
      font-weight: 850;
      letter-spacing: 0.055em;
      text-transform: uppercase;
    }
    .cloud-control-group-hint {
      color: var(--cloud-ui-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
    }
    .cloud-control-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      align-items: end;
    }
    .cloud-control-grid-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .cloud-control-grid-1 {
      grid-template-columns: 1fr;
    }
    .cloud-control-grid label,
    .cloud-control-grid button,
    .cloud-control-grid select,
    .cloud-control-grid input {
      min-width: 0;
    }
    .cloud-control-grid label {
      margin: 0;
    }
    .cloud-panel-fields:empty,
    .cloud-empty-original-group,
    .cloud-empty-original-shell,
    #preview-look-controls.cloud-empty-original-group {
      display: none !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      min-height: 0 !important;
      height: 0 !important;
      overflow: hidden !important;
    }
    #preview-look-controls {
      margin-top: 0 !important;
      padding-top: 0 !important;
      border-top: 0 !important;
    }
    .cloud-ui-hidden-fragment,
    .cloud-orphan-label,
    .cloud-panel [aria-hidden="true"].cloud-legacy-slice-hidden,
    .cloud-panel [aria-hidden="true"].cloud-empty-original-group,
    .cloud-panel [aria-hidden="true"].cloud-empty-original-shell,
    .cloud-panel-fields.cloud-empty-original-group,
    #preview-look-controls.cloud-empty-original-group {
      display: none !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      min-height: 0 !important;
      height: 0 !important;
      overflow: hidden !important;
    }
    #cloud-quick-dock {
      padding: 10px;
      gap: 8px;
    }
    .cloud-quick-title {
      font-size: 12px;
      line-height: 1.15;
    }
    .cloud-quick-title strong {
      font-size: 13px;
    }
    #cloud-quick-status {
      font-size: 11px;
    }
    .cloud-quick-row {
      gap: 8px;
    }
    .cloud-tabs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 5px;
    }
    .cloud-tab,
    #quick-render-button,
    #quick-rebake-button {
      min-height: 30px;
      padding: 6px 7px;
      border-radius: 8px;
      font-size: 12px;
    }
    .cloud-quick-field {
      font-size: 11px;
    }
    .cloud-quick-field span {
      font-size: 10px;
      color: var(--cloud-ui-muted);
      font-weight: 750;
      letter-spacing: 0.045em;
      text-transform: uppercase;
    }
    .cloud-panel {
      padding: 10px;
      border-radius: 14px;
    }
    .cloud-panel-heading {
      margin-bottom: 10px;
      padding-bottom: 8px;
      align-items: flex-start;
    }
    .cloud-panel-heading strong {
      font-size: 12px;
      letter-spacing: 0.045em;
      text-transform: uppercase;
    }
    .cloud-panel-heading span {
      font-size: 11px;
      line-height: 1.25;
    }
    .cloud-control-group {
      gap: 8px;
      margin: 0 0 10px;
      padding: 9px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.032);
    }
    .cloud-control-group-title {
      min-height: 18px;
      font-size: 10px;
      letter-spacing: 0.075em;
    }
    .cloud-control-group-hint {
      font-size: 10px;
    }
    .cloud-control-group-body {
      display: grid;
      gap: 7px;
    }
    .cloud-control-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 5px;
      align-items: stretch;
    }
    .cloud-control-row-no-label {
      grid-template-columns: minmax(0, 1fr);
    }
    .cloud-control-row-label {
      display: block;
      min-height: 0;
      padding: 0 2px;
      border: 0;
      border-radius: 0;
      color: var(--cloud-ui-muted);
      background: transparent;
      font-size: 9px;
      font-weight: 850;
      letter-spacing: 0.06em;
      line-height: 1;
      text-transform: uppercase;
    }
    .cloud-control-row-fields {
      display: grid;
      gap: 5px;
      min-width: 0;
    }
    .cloud-control-grid-1 {
      grid-template-columns: minmax(0, 1fr);
    }
    .cloud-control-grid-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .cloud-control-grid-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .cloud-control-field {
      display: grid !important;
      grid-template-rows: auto minmax(30px, auto);
      gap: 4px !important;
      min-width: 0;
      margin: 0 !important;
      padding: 6px;
      border: 1px solid rgba(180, 205, 255, 0.12);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.035);
      color: var(--cloud-ui-muted);
      font-size: 10px;
      box-sizing: border-box;
    }
    .cloud-control-field > span:first-child {
      overflow: hidden;
      color: var(--cloud-ui-muted) !important;
      font-size: 9px;
      font-weight: 850;
      letter-spacing: 0.06em;
      line-height: 1.05;
      text-overflow: ellipsis;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .cloud-control-field input,
    .cloud-control-field select,
    .cloud-control-field textarea {
      display: block !important;
      width: 100% !important;
      min-width: 0;
      min-height: 30px;
      padding: 5px 6px;
      border-radius: 8px;
      font-size: 12px;
      line-height: 1.1;
      box-sizing: border-box;
    }
    .cloud-control-field select {
      min-height: 32px;
      padding-right: 20px;
    }
    .cloud-checkbox-field {
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-rows: 1fr;
      align-items: center;
      gap: 7px !important;
      min-height: 42px;
    }
    .cloud-checkbox-field > span:first-child {
      grid-column: 2;
      grid-row: 1;
      white-space: normal;
    }
    .cloud-checkbox-field input[type="checkbox"] {
      grid-column: 1;
      grid-row: 1;
      width: 16px !important;
      height: 16px;
      min-height: 0;
      padding: 0;
    }
    .cloud-panel-fields {
      gap: 8px;
    }
    .cloud-panel-fields > label:not(.cloud-control-field):not(:has(input, select, textarea, button)) {
      display: none !important;
    }

    @media (max-width: 680px) {
      #cloud-quick-dock {
        width: 100%;
        border-radius: 14px;
      }
      .cloud-quick-row {
        grid-template-columns: 1fr;
      }
      .cloud-tabs {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .cloud-control-grid,
      .cloud-control-grid-3 {
        grid-template-columns: 1fr;
      }
      #gpuCanvas {
        min-height: 320px;
        border-radius: 14px;
      }
    }

    /* Tight sidebar controls. The controls are intentionally dense because the
       renderer needs fast numerical iteration while the canvas remains dominant. */
    :root {
      --cloud-ui-sidebar-pad: 6px;
      --cloud-ui-gap-xs: 3px;
      --cloud-ui-gap-sm: 4px;
      --cloud-ui-field-h: 24px;
    }
    #cloud-quick-dock {
      display: grid !important;
      width: 100% !important;
      margin: 0 0 6px !important;
      padding: 6px !important;
      gap: 5px !important;
      border-radius: 10px !important;
      background: rgba(8, 13, 22, 0.94) !important;
      box-shadow: none !important;
    }
    .cloud-quick-title {
      gap: 6px !important;
      min-height: 0 !important;
      font-size: 10px !important;
      line-height: 1 !important;
    }
    .cloud-quick-title strong {
      font-size: 11px !important;
      letter-spacing: 0.04em !important;
      text-transform: uppercase !important;
    }
    #cloud-quick-status {
      max-width: 11rem !important;
      font-size: 9px !important;
      line-height: 1.1 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    .cloud-quick-row {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 5px !important;
      align-items: stretch !important;
    }
    .cloud-tabs {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 3px !important;
    }
    .cloud-tab,
    #quick-render-button,
    #quick-rebake-button {
      min-height: 24px !important;
      padding: 3px 4px !important;
      border-radius: 6px !important;
      font-size: 10px !important;
      line-height: 1 !important;
    }
    .cloud-quick-field {
      gap: 3px !important;
      padding: 0 !important;
      font-size: 9px !important;
      background: transparent !important;
      border: 0 !important;
    }
    .cloud-quick-field span {
      font-size: 8px !important;
      line-height: 1 !important;
    }
    .cloud-quick-field select,
    .cloud-quick-field input {
      min-height: var(--cloud-ui-field-h) !important;
      height: var(--cloud-ui-field-h) !important;
      padding: 3px 5px !important;
      border-radius: 6px !important;
      font-size: 10px !important;
    }
    .cloud-panel {
      padding: var(--cloud-ui-sidebar-pad) !important;
      border-radius: 10px !important;
    }
    .cloud-panel-heading {
      margin: 0 0 5px !important;
      padding: 0 0 5px !important;
      gap: 5px !important;
    }
    .cloud-panel-heading strong {
      font-size: 10px !important;
      line-height: 1 !important;
    }
    .cloud-panel-heading span {
      display: none !important;
    }
    .cloud-control-group {
      gap: 4px !important;
      margin: 0 0 5px !important;
      padding: 5px !important;
      border-radius: 8px !important;
      background: rgba(255, 255, 255, 0.025) !important;
    }
    .cloud-control-group-title {
      min-height: 0 !important;
      font-size: 9px !important;
      line-height: 1 !important;
      letter-spacing: 0.06em !important;
    }
    .cloud-control-group-hint {
      display: none !important;
    }
    .cloud-control-group-body {
      display: grid !important;
      gap: 4px !important;
    }
    .cloud-control-row {
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 3px !important;
      align-items: stretch !important;
    }
    .cloud-control-row-no-label {
      grid-template-columns: minmax(0, 1fr) !important;
    }
    .cloud-control-row-label {
      min-height: 0 !important;
      padding: 0 2px !important;
      border: 0 !important;
      background: transparent !important;
      font-size: 7.5px !important;
      line-height: 1 !important;
      letter-spacing: 0.045em !important;
    }
    .cloud-control-row-fields {
      gap: 3px !important;
    }
    .cloud-control-grid-1,
    .cloud-control-grid-2,
    .cloud-control-grid-3 {
      gap: 3px !important;
    }
    .cloud-control-field {
      grid-template-rows: auto minmax(var(--cloud-ui-field-h), auto) !important;
      gap: 2px !important;
      padding: 3px !important;
      border-radius: 7px !important;
      font-size: 9px !important;
    }
    .cloud-control-field > span:first-child {
      font-size: 7.5px !important;
      line-height: 1 !important;
      letter-spacing: 0.045em !important;
    }
    .cloud-control-field input,
    .cloud-control-field select,
    .cloud-control-field textarea {
      min-height: var(--cloud-ui-field-h) !important;
      height: var(--cloud-ui-field-h) !important;
      padding: 3px 4px !important;
      border-radius: 6px !important;
      font-size: 10px !important;
      line-height: 1 !important;
    }
    .cloud-control-field input[type="checkbox"] {
      width: 13px !important;
      height: 13px !important;
      min-height: 13px !important;
    }
    .cloud-checkbox-field {
      min-height: 28px !important;
      gap: 5px !important;
    }
    .cloud-panel-fields {
      gap: 4px !important;
    }
    .cloud-texture-panel {
      grid-template-columns: minmax(130px, 0.55fr) minmax(0, 1fr) !important;
      gap: 6px !important;
    }
    .cloud-texture-preview-card {
      gap: 5px !important;
      padding: 5px !important;
      border-radius: 9px !important;
    }
    #cloud-texture-preview-menu {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      margin: 0 0 12px !important;
      padding: 10px !important;
      border-radius: 14px !important;
      overflow: hidden !important;
    }
    #cloud-texture-preview-menu .cloud-debug-preview-stack {
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 10px !important;
      min-width: 0 !important;
    }
    #cloud-texture-preview-menu .cloud-texture-preview-card {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      padding: 9px !important;
      gap: 8px !important;
      overflow: hidden !important;
    }
    #cloud-texture-preview-menu canvas[id^="dbg-"] {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      justify-self: stretch !important;
    }
    .cloud-texture-preview-title {
      font-size: 9px !important;
      line-height: 1 !important;
    }
    .cloud-texture-preview-title small {
      display: none !important;
    }
    .cloud-texture-slice-control {
      grid-template-columns: 1fr auto !important;
      gap: 3px 5px !important;
      padding: 5px !important;
      border-radius: 8px !important;
    }
    .cloud-texture-slice-control span,
    .cloud-texture-slice-value {
      font-size: 9px !important;
      line-height: 1 !important;
    }
    .cloud-texture-slice-control input[type="range"] {
      height: 20px !important;
    }
    .cloud-texture-slice-control input[type="number"] {
      min-height: 23px !important;
      height: 23px !important;
      padding: 2px 4px !important;
      font-size: 10px !important;
    }
    #gpuCanvas {
      border-radius: 10px !important;
      margin-bottom: 6px !important;
    }

  `;
  document.head.appendChild(style);
}

function addCloudUiClasses() {
  ["p-weather", "p-shape128", "p-detail32", "p-blue", "p-cloudParams", "p-preview"].forEach((id) => {
    const panel = $(id);
    if (panel) panel.classList.add("cloud-panel");
  });
  document.querySelectorAll("label").forEach((label) => label.classList.add("cloud-field"));
}

function createCloudQuickDock() {
  if (document.getElementById("cloud-quick-dock")) return;

  const dock = document.createElement("div");
  dock.id = "cloud-quick-dock";
  dock.innerHTML = `
    <div class="cloud-quick-title">
      <strong>Cloud Lab</strong>
      <span id="cloud-quick-status">Ready</span>
    </div>
    <div class="cloud-quick-row">
      <div class="cloud-tabs" aria-label="Cloud tool panels">
        <button type="button" class="cloud-tab" data-cloud-pass="preview">Render</button>
        <button type="button" class="cloud-tab" data-cloud-pass="clouds">Tuning</button>
        <button type="button" class="cloud-tab" data-cloud-pass="weather">Weather</button>
        <button type="button" class="cloud-tab" data-cloud-pass="shape128">Shape 3D</button>
        <button type="button" class="cloud-tab" data-cloud-pass="detail32">Detail 3D</button>
        <button type="button" class="cloud-tab" data-cloud-pass="blue">Blue Noise</button>
      </div>
      <label class="cloud-quick-field"><span>Layer preset</span><select id="quick-layer-preset"></select></label>
      <label class="cloud-quick-field"><span>Color grade</span><select id="quick-grade"></select></label>
      <label class="cloud-quick-field"><span>Render divider <b id="quick-render-scale-label">4</b></span><input id="quick-render-scale" type="range" min="1" max="8" step="1" value="4"></label>
      <button type="button" id="quick-render-button">Render</button>
      <button type="button" id="quick-rebake-button">Rebake</button>
    </div>
  `;

  const anchor = $("p-preview") || $("p-cloudParams") || $("p-weather") || document.body.firstElementChild;
  if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(dock, anchor);
  else document.body.prepend(dock);
}

function cloneOptions(fromId, toId) {
  const source = $(fromId);
  const target = $(toId);
  if (!source || !target) return;
  const sourceOptions = Array.from(source.options || []);
  const targetOptions = Array.from(target.options || []);
  const sameOptions =
    sourceOptions.length === targetOptions.length &&
    sourceOptions.every((option, index) => targetOptions[index]?.value === option.value && targetOptions[index]?.textContent === option.textContent);
  if (sameOptions) return;
  const current = target.value || source.value;
  target.innerHTML = "";
  sourceOptions.forEach((option) => {
    target.appendChild(option.cloneNode(true));
  });
  target.value = current || source.value;
}

function setFieldValue(id, value) {
  const el = $(id);
  if (!el) return;
  if (el.type === "checkbox") el.checked = !!value;
  else el.value = String(value);
}

function dispatchInput(id) {
  const el = $(id);
  if (!el) return;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function populateCloudQuickDock() {
  cloneOptions("v-layer-preset", "quick-layer-preset");
  cloneOptions("v-grade", "quick-grade");
  setFieldValue("quick-layer-preset", $("v-layer-preset")?.value || preview.layerPreset || "custom");
  setFieldValue("quick-grade", $("v-grade")?.value || preview.gradeStyle || 0);
  const scale = String($("v-render-scale-divider")?.value || preview.renderScaleDivider || 4);
  setFieldValue("quick-render-scale", scale);
  const scaleLabel = $("quick-render-scale-label");
  if (scaleLabel) scaleLabel.textContent = scale;
}

function updateCloudQuickDockState() {
  const passValue = $("pass")?.value || "preview";
  document.querySelectorAll("[data-cloud-pass]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-cloud-pass") === passValue);
  });
  const status = $("cloud-quick-status");
  if (status && status.dataset.manual !== "true") {
    const layer = $("v-layer-preset")?.selectedOptions?.[0]?.textContent || "Custom";
    const grade = $("v-grade")?.selectedOptions?.[0]?.textContent || "Grade";
    const fps = $("fpsDisplay")?.textContent || "-";
    status.textContent = `${layer} | ${grade} | ${fps}`;
  }
  populateCloudQuickDock();
}

function wireCloudQuickDock() {
  const dock = $("cloud-quick-dock");
  if (!dock || dock.dataset.wired === "true") return;
  dock.dataset.wired = "true";

  dock.querySelectorAll("[data-cloud-pass]").forEach((button) => {
    button.addEventListener("click", () => {
      const pass = button.getAttribute("data-cloud-pass") || "preview";
      const select = $("pass");
      if (select) {
        select.value = pass;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        showPanelsFor(pass);
      }
      updateCloudQuickDockState();
      refreshDebugPreviews().catch(() => {});
    });
  });

  $("quick-layer-preset")?.addEventListener("change", () => {
    setFieldValue("v-layer-preset", $("quick-layer-preset").value);
    $("v-layer-preset")?.dispatchEvent(new Event("change", { bubbles: true }));
    updateCloudQuickDockState();
  });
  $("quick-grade")?.addEventListener("change", () => {
    setFieldValue("v-grade", $("quick-grade").value);
    $("v-grade")?.dispatchEvent(new Event("change", { bubbles: true }));
    updateCloudQuickDockState();
  });
  $("quick-render-scale")?.addEventListener("input", () => {
    const value = $("quick-render-scale").value;
    setFieldValue("v-render-scale-divider", value);
    const label = $("quick-render-scale-label");
    if (label) label.textContent = value;
    dispatchInput("v-render-scale-divider");
  });
  $("quick-render-button")?.addEventListener("click", () => $("render")?.click());
  $("quick-rebake-button")?.addEventListener("click", () => $("rebake-all")?.click());
  ["pass", "v-layer-preset", "v-grade", "v-render-scale-divider"].forEach((id) => {
    $(id)?.addEventListener("change", updateCloudQuickDockState);
    $(id)?.addEventListener("input", updateCloudQuickDockState);
  });
  updateCloudQuickDockState();
}

function hideLegacySliceControl() {
  const legacySlice = $("slice");
  if (!legacySlice) return;

  legacySlice.min = "0";
  legacySlice.max = String(Math.max(0, SHAPE_SIZE - 1));
  legacySlice.step = "1";
  legacySlice.tabIndex = -1;
  legacySlice.setAttribute("aria-hidden", "true");
  legacySlice.classList.add("cloud-legacy-slice-hidden");

  const label = $("sliceLabel");
  if (label) {
    label.setAttribute("aria-hidden", "true");
    label.classList.add("cloud-legacy-slice-hidden");
  }

  const wrappers = [
    legacySlice.closest(".cloud-control-field"),
    legacySlice.closest(".cloud-field"),
    legacySlice.closest("label"),
    label?.closest(".cloud-control-field"),
    label?.closest(".cloud-field"),
    label?.closest("label"),
  ].filter(Boolean);

  wrappers.forEach((wrapper) => {
    wrapper.classList.add("cloud-legacy-slice-hidden");
    wrapper.setAttribute("aria-hidden", "true");
  });

  hideEmptyLegacySliceContainers();
}

function hasNonLegacyInteractiveContent(el) {
  if (!el) return false;
  return Array.from(el.querySelectorAll("input, select, button, textarea, canvas")).some((node) => {
    if (node.id === "slice" || node.id === "sliceLabel") return false;
    if (node.classList?.contains("cloud-legacy-slice-hidden")) return false;
    if (node.closest?.(".cloud-legacy-slice-hidden")) return false;
    return true;
  });
}

function hideEmptyLegacySliceContainers(root = document) {
  const legacy = [$("slice"), $("sliceLabel")].filter(Boolean);
  const containers = new Set();

  legacy.forEach((node) => {
    [
      node.closest(".cloud-control-row"),
      node.closest(".cloud-control-group-body"),
      node.closest(".cloud-control-group"),
      node.closest(".cloud-panel-fields"),
    ].filter(Boolean).forEach((el) => containers.add(el));
  });

  Array.from(root.querySelectorAll(".cloud-control-row, .cloud-control-group-body, .cloud-control-group, .cloud-panel-fields")).forEach((el) => {
    if (el.querySelector?.("#slice, #sliceLabel, label[for='slice']")) containers.add(el);
  });

  containers.forEach((el) => {
    if (!el || hasNonLegacyInteractiveContent(el)) return;
    el.classList.add("cloud-legacy-slice-hidden");
    el.setAttribute("aria-hidden", "true");
  });

  hideLegacySliceTextBlocks(root);
  hideEmptyControlShells(root);
}

function normalizedUiText(el) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function isUiNodeHidden(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  if (node.hidden) return true;
  if (node.getAttribute?.("aria-hidden") === "true") return true;
  if (node.classList?.contains("cloud-legacy-slice-hidden")) return true;
  if (node.classList?.contains("cloud-ui-hidden-fragment")) return true;
  if (node.classList?.contains("cloud-empty-original-group")) return true;
  if (node.classList?.contains("cloud-empty-original-shell")) return true;
  const style = node.style || {};
  return style.display === "none" || style.visibility === "hidden" || style.height === "0px";
}

function hasVisibleControlContent(el) {
  if (!el) return false;
  return Array.from(el.querySelectorAll("input, select, button, textarea, canvas")).some((node) => {
    if (node.id === "slice" || node.id === "sliceLabel") return false;
    if (node.closest?.("#slice, #sliceLabel, label[for='slice']")) return false;
    if (isUiNodeHidden(node)) return false;
    if (node.closest?.(".cloud-legacy-slice-hidden, .cloud-ui-hidden-fragment, .cloud-empty-original-group, .cloud-empty-original-shell")) return false;
    return true;
  });
}

function visibleUiTextWithoutControls(el) {
  if (!el) return "";
  const clone = el.cloneNode(true);
  clone.querySelectorAll([
    "input",
    "select",
    "button",
    "textarea",
    "canvas",
    "#slice",
    "#sliceLabel",
    "label[for='slice']",
    ".cloud-legacy-slice-hidden",
    ".cloud-ui-hidden-fragment",
    ".cloud-empty-original-group",
    ".cloud-empty-original-shell",
    ".cloud-texture-slice-control",
  ].join(",")).forEach((node) => node.remove());
  return normalizedUiText(clone);
}

function isLegacySliceTextOnly(el) {
  if (!el) return false;
  if (el.closest?.(".cloud-texture-slice-control")) return false;
  if (el.querySelector?.("#shape-z-slice, #detail-z-slice, .cloud-texture-slice-control")) return false;

  const text = (visibleUiTextWithoutControls(el) || normalizedUiText(el)).toLowerCase();
  if (!text || !text.includes("slice")) return false;
  if (text.includes("slice jitter") || text.includes("shape z") || text.includes("detail z")) return false;
  if (hasVisibleControlContent(el)) return false;

  const compact = text.replace(/[0-9]+/g, "").replace(/[/:–—-]+/g, " ").replace(/\s+/g, " ").trim();
  return compact === "slice" || compact === "slice slice" || compact === "slice slice slice";
}

function markHiddenShell(el) {
  if (!el) return;
  el.classList?.add("cloud-empty-original-shell");
  el.classList?.add("cloud-legacy-slice-hidden");
  el.setAttribute?.("aria-hidden", "true");
  if (el.style) {
    el.style.display = "none";
    el.style.margin = "0";
    el.style.padding = "0";
    el.style.border = "0";
    el.style.minHeight = "0";
    el.style.height = "0";
    el.style.overflow = "hidden";
  }
}

function removeLegacySliceArtifacts(root = document) {
  const scope = root || document;
  [$("slice"), $("sliceLabel")].filter(Boolean).forEach((node) => {
    markHiddenShell(node);
    [
      node.closest("label"),
      node.closest(".cloud-field"),
      node.closest(".cloud-control-field"),
      node.closest(".cloud-control-row"),
      node.closest(".cloud-control-group-body"),
      node.closest(".cloud-control-group"),
      node.closest(".cloud-panel-fields"),
    ].filter(Boolean).forEach((el) => {
      if (!hasVisibleControlContent(el) && isLegacySliceTextOnly(el)) markHiddenShell(el);
    });
  });

  Array.from(scope.querySelectorAll("label[for='slice'], .cloud-control-group, .cloud-control-group-body, .cloud-control-row, .cloud-panel-fields, .cloud-field, label, section, div")).forEach((el) => {
    if (el.id === "cloud-texture-preview-menu") return;
    if (el.closest?.("#cloud-texture-preview-menu, .cloud-texture-slice-control")) return;
    if (isLegacySliceTextOnly(el)) markHiddenShell(el);
  });

  hideEmptyControlShells(scope);
}

function hideLegacySliceTextBlocks(root = document) {
  Array.from(root.querySelectorAll(".cloud-control-group, .cloud-control-row, .cloud-control-group-body, .cloud-panel-fields, .cloud-field, label")).forEach((el) => {
    if (!isLegacySliceTextOnly(el)) return;
    el.classList.add("cloud-legacy-slice-hidden");
    el.setAttribute("aria-hidden", "true");
  });
}

function hideEmptyControlShells(root = document) {
  Array.from(root.querySelectorAll(".cloud-control-group, .cloud-control-group-body, .cloud-control-row, .cloud-panel-fields")).forEach((el) => {
    if (el.classList?.contains("cloud-debug-preview-stack")) return;
    if (el.closest?.("#cloud-texture-preview-menu, .cloud-texture-slice-control")) return;
    if (hasVisibleControlContent(el)) return;

    const visibleText = Array.from(el.childNodes).some((node) => {
      if (node.nodeType === Node.TEXT_NODE) return !!node.textContent.trim();
      if (node.nodeType !== Node.ELEMENT_NODE) return false;
      if (isUiNodeHidden(node)) return false;
      return !!visibleUiTextWithoutControls(node);
    });

    if (!visibleText || isLegacySliceTextOnly(el)) {
      el.classList.add("cloud-empty-original-group");
      el.setAttribute("aria-hidden", "true");
      if (isLegacySliceTextOnly(el)) markHiddenShell(el);
    }
  });
}

function isLegacySliceUi(el) {
  if (!el) return false;
  if (el.id === "slice" || el.id === "sliceLabel") return true;
  if (el.classList?.contains("cloud-legacy-slice-hidden")) return true;
  return !!el.querySelector?.("#slice, #sliceLabel");
}

function debugCanvasFallbackSize(id) {
  if (id === "dbg-weather" || id === "dbg-weather-g" || id === "dbg-weather-b") {
    return [WEATHER_W, WEATHER_H];
  }
  if (id === "dbg-blue") return [BN_W, BN_H];
  return [DBG_SIZE, DBG_SIZE];
}

function ensureDebugCanvasElement(id) {
  let canvas = $(id);
  if (canvas) return canvas;

  const [width, height] = debugCanvasFallbackSize(id);
  canvas = document.createElement("canvas");
  canvas.id = id;
  canvas.width = width;
  canvas.height = height;
  canvas.setAttribute("aria-label", id);

  const host = $("p-blue") || $("p-weather") || $("p-shape128") || $("p-detail32") || document.body;
  host.appendChild(canvas);
  return canvas;
}


function installTextureSliceControls() {
  hideLegacySliceControl();
  ensureDebugCanvasElement("dbg-r");
  ensureDebugCanvasElement("dbg-g");
  ensureDebugCanvasElement("dbg-blue");
  installTextureSliceControl("dbg-r", "shape-z-slice", "Shape Z", SHAPE_SIZE - 1, "shape");
  installTextureSliceControl("dbg-g", "detail-z-slice", "Detail Z", DETAIL_SIZE - 1, "detail");
  hideLegacySliceControl();
}

function installTextureSliceControl(canvasId, inputId, label, maxSlice, target) {
  const canvas = $(canvasId);
  if (!canvas || $(inputId)) return;

  const control = document.createElement("label");
  control.className = "cloud-texture-slice-control";
  control.innerHTML = `
    <span>${label} slice</span>
    <output class="cloud-texture-slice-value" id="${inputId}-value">0 / ${maxSlice}</output>
    <input id="${inputId}" type="range" min="0" max="${maxSlice}" step="1" value="0" aria-label="${label} slice">
    <input id="${inputId}-number" type="number" min="0" max="${maxSlice}" step="1" value="0" aria-label="${label} numeric slice">
  `;
  canvas.insertAdjacentElement("afterend", control);

  const range = $(inputId);
  const number = $(`${inputId}-number`);
  const output = $(`${inputId}-value`);
  const apply = (raw) => {
    const value = Math.max(0, Math.min(maxSlice, Number(raw) | 0));
    range.value = String(value);
    number.value = String(value);
    if (output) output.textContent = `${value} / ${maxSlice}`;
    if (worker) {
      rpc("setDebugSlice", { target, slice: value }).catch((e) => console.warn("setDebugSlice failed", e));
    }
  };
  range.addEventListener("input", () => apply(range.value));
  range.addEventListener("change", () => apply(range.value));
  number.addEventListener("input", () => apply(number.value));
  number.addEventListener("change", () => apply(number.value));
}

function syncTextureSliceControlsFromShape(shapeSlice) {
  const shape = Math.max(0, Math.min(SHAPE_SIZE - 1, shapeSlice | 0));
  const detail = Math.max(0, Math.min(DETAIL_SIZE - 1, Math.floor((shape * DETAIL_SIZE) / Math.max(1, SHAPE_SIZE))));
  [
    ["shape-z-slice", shape, SHAPE_SIZE - 1],
    ["shape-z-slice-number", shape, SHAPE_SIZE - 1],
    ["detail-z-slice", detail, DETAIL_SIZE - 1],
    ["detail-z-slice-number", detail, DETAIL_SIZE - 1],
  ].forEach(([id, value]) => setFieldValue(id, value));
  const sv = $("shape-z-slice-value");
  if (sv) sv.textContent = `${shape} / ${SHAPE_SIZE - 1}`;
  const dv = $("detail-z-slice-value");
  if (dv) dv.textContent = `${detail} / ${DETAIL_SIZE - 1}`;
}

function addPanelHeading(panelId, title, hint) {
  const panel = $(panelId);
  if (!panel || panel.querySelector(":scope > .cloud-panel-heading")) return;
  const heading = document.createElement("div");
  heading.className = "cloud-panel-heading";
  heading.innerHTML = `<strong>${title}</strong><span>${hint || ""}</span>`;
  panel.prepend(heading);
}

function makeFieldsGrid(panel) {
  if (!panel || panel.querySelector(":scope > .cloud-texture-panel")) return;
  if (panel.querySelector(":scope > .cloud-panel-fields")) return;
  const grid = document.createElement("div");
  grid.className = "cloud-panel-fields";
  const movable = Array.from(panel.children).filter((el) => {
    if (isLegacySliceUi(el)) return false;
    if (el.classList?.contains("cloud-panel-heading")) return false;
    if (el.id && /^dbg-/.test(el.id)) return false;
    if (el.classList?.contains("cloud-texture-slice-control")) return false;
    if (el.id === "preview-look-controls") return true;
    return el.tagName === "LABEL" || el.tagName === "BUTTON" || el.tagName === "SELECT" || el.tagName === "INPUT" || el.tagName === "TEXTAREA";
  });
  movable.forEach((el) => grid.appendChild(el));
  panel.appendChild(grid);
}

function debugSliceControlForCanvas(canvasId) {
  if (canvasId === "dbg-r") return $("shape-z-slice")?.closest(".cloud-texture-slice-control") || null;
  if (canvasId === "dbg-g") return $("detail-z-slice")?.closest(".cloud-texture-slice-control") || null;
  return null;
}

function insertAfterNode(reference, node) {
  if (!reference?.parentElement || !node) return false;
  reference.parentElement.insertBefore(node, reference.nextSibling);
  return true;
}

function placePersistentTexturePreviewPanel(panel) {
  if (!panel) return;
  panel.classList.add("cloud-panel", "cloud-persistent-texture-previews");

  const panels = ["p-preview", "p-cloudParams", "p-weather", "p-shape128", "p-detail32", "p-blue"]
    .map((id) => $(id))
    .filter((el) => el && el !== panel && el.parentElement);

  const anchor = panels.reduce((latest, el) => {
    if (!latest) return el;
    return latest.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING ? el : latest;
  }, null);

  if (anchor?.parentElement) {
    insertAfterNode(anchor, panel);
    return;
  }

  const dock = $("cloud-quick-dock");
  if (dock?.parentElement) {
    insertAfterNode(dock, panel);
    return;
  }

  document.body.appendChild(panel);
}

function createPersistentTexturePreviewPanel() {
  let panel = $("cloud-texture-preview-menu");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "cloud-texture-preview-menu";
    panel.innerHTML = `
      <div class="cloud-panel-heading">
        <strong>Texture previews</strong>
        <span>Shape, detail, and blue-noise debug textures</span>
      </div>
    `;
  }

  placePersistentTexturePreviewPanel(panel);
  panel.style.display = "";
  return panel;
}

function debugTexturePreviewHost() {
  return createPersistentTexturePreviewPanel();
}


function ensureDebugPreviewStack(host) {
  if (!host) return null;
  let stack = host.querySelector(":scope > .cloud-debug-preview-stack");
  if (stack) return stack;

  stack = document.createElement("div");
  stack.className = "cloud-debug-preview-stack";
  const heading = host.querySelector(":scope > .cloud-panel-heading");
  const fields = host.querySelector(":scope > .cloud-panel-fields");
  if (fields) host.insertBefore(stack, fields);
  else if (heading?.nextSibling) host.insertBefore(stack, heading.nextSibling);
  else host.appendChild(stack);
  return stack;
}

function nearbyDebugHeadingFor(canvas, title) {
  const titleNeedle = String(title || "").split(" ")[0]?.toLowerCase() || "";
  let el = canvas?.previousElementSibling || null;
  while (el && el.classList?.contains("cloud-texture-slice-control")) el = el.previousElementSibling;
  if (!el || el.querySelector?.("input, select, textarea, button, canvas")) return null;
  const text = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!text || (titleNeedle && !text.includes(titleNeedle))) return null;
  return el;
}

function removeOrphanDebugHeadings(host) {
  if (!host) return;
  const needles = ["weather r", "weather g", "weather b", "weather map", "shape128", "shape volume", "detail32", "detail volume", "blue noise"];
  Array.from(host.children).forEach((el) => {
    if (el.classList?.contains("cloud-panel-heading")) return;
    if (el.classList?.contains("cloud-debug-preview-stack")) return;
    if (el.classList?.contains("cloud-texture-preview-card")) return;
    if (isLegacySliceUi(el)) {
      el.classList.add("cloud-legacy-slice-hidden");
      return;
    }
    if (el.querySelector?.("input, select, textarea, button, canvas")) return;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (needles.some((needle) => text.includes(needle))) el.remove();
  });
}

function cleanupTexturePreviewSourcePanels() {
  ["p-weather", "p-blue", "p-shape128", "p-detail32", "p-preview", "p-cloudParams"].forEach((id) => {
    const panel = $(id);
    if (!panel) return;
    removeOrphanDebugHeadings(panel);
    Array.from(panel.querySelectorAll(".cloud-texture-preview-card")).forEach((card) => {
      if (!card.querySelector("canvas")) card.remove();
    });
    Array.from(panel.querySelectorAll(".cloud-legacy-slice-hidden")).forEach((el) => {
      el.setAttribute("aria-hidden", "true");
    });
    hideLegacySliceTextBlocks(panel);
    hideEmptyControlShells(panel);
  });
  hideLegacySliceControl();
  hideEmptyLegacySliceContainers();
  removeLegacySliceArtifacts(document);
}


function createTexturePreviewCard(canvasId, title, hint, stack) {
  const canvas = ensureDebugCanvasElement(canvasId);
  if (!canvas || !stack) return null;

  const slice = debugSliceControlForCanvas(canvasId);
  const heading = nearbyDebugHeadingFor(canvas, title);
  const existing = canvas.closest(".cloud-texture-preview-card");
  const card = existing || document.createElement("div");
  card.className = "cloud-texture-preview-card";

  let titleEl = card.querySelector(":scope > .cloud-texture-preview-title");
  if (!titleEl) {
    titleEl = document.createElement("div");
    titleEl.className = "cloud-texture-preview-title";
    card.insertBefore(titleEl, card.firstChild);
  }
  titleEl.innerHTML = `<span>${title}</span><small>${hint || ""}</small>`;

  if (heading) heading.remove();
  if (card.parentElement !== stack) stack.appendChild(card);
  if (titleEl.parentElement !== card) card.insertBefore(titleEl, card.firstChild);
  if (canvas.parentElement !== card) card.appendChild(canvas);
  if (slice && slice.parentElement !== card) card.appendChild(slice);
  return card;
}


function organizeDebugTexturePreviews() {
  ensureDebugCanvasElement("dbg-weather");
  ensureDebugCanvasElement("dbg-weather-g");
  ensureDebugCanvasElement("dbg-weather-b");
  ensureDebugCanvasElement("dbg-r");
  ensureDebugCanvasElement("dbg-g");
  ensureDebugCanvasElement("dbg-blue");

  const host = debugTexturePreviewHost();
  const stack = ensureDebugPreviewStack(host);
  if (!host || !stack) return;

  host.classList.add("cloud-debug-preview-panel");
  createTexturePreviewCard("dbg-weather", "Weather R Map", `${WEATHER_W} x ${WEATHER_H}`, stack);
  createTexturePreviewCard("dbg-weather-g", "Weather G Map", `${WEATHER_W} x ${WEATHER_H}`, stack);
  createTexturePreviewCard("dbg-weather-b", "Weather B Map", `${WEATHER_W} x ${WEATHER_H}`, stack);
  createTexturePreviewCard("dbg-r", "Shape128 - R channel", `Z slice 0-${SHAPE_SIZE - 1}`, stack);
  createTexturePreviewCard("dbg-g", "Detail32 - R channel", `Z slice 0-${DETAIL_SIZE - 1}`, stack);
  createTexturePreviewCard("dbg-blue", "Blue Noise 2D", `${BN_W} x ${BN_H}`, stack);
  cleanupTexturePreviewSourcePanels();
  removeOrphanDebugHeadings(host);
  hideEmptyLegacySliceContainers();
}

function organizeCloudPanels() {
  normalizeAllCloudControls();
  addPanelHeading("p-preview", "Render", "Camera, box, lighting, and performance controls");
  addPanelHeading("p-cloudParams", "Cloud tuning", "Density, lighting, anvil, rain shelf, and march controls");
  addPanelHeading("p-weather", "Weather texture", "Large scale coverage masks");
  addPanelHeading("p-shape128", "Shape 3D texture", "Base cloud volume controls");
  addPanelHeading("p-detail32", "Detail 3D texture", "Small scale erosion volume controls");
  addPanelHeading("p-blue", "Blue noise", "Dither texture controls and generated noise source");

  organizeDebugTexturePreviews();
  ["p-preview", "p-cloudParams", "p-weather", "p-shape128", "p-detail32", "p-blue"].forEach((id) => makeFieldsGrid($(id)));
  cleanupTexturePreviewSourcePanels();
  removeLegacySliceArtifacts(document);
}

function controlLabelTextFromId(id) {
  return String(id || "")
    .replace(/^v-/, "")
    .replace(/^p-/, "")
    .replace(/^t-/, "")
    .replace(/^we-/, "")
    .replace(/^sh-/, "")
    .replace(/^de-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function textFromLooseLabel(label) {
  if (!label) return "";
  const clone = label.cloneNode(true);
  clone.querySelectorAll("input, select, textarea, button").forEach((node) => node.remove());
  return clone.textContent.trim();
}

function ensureControlLabelWrapper(id, labelText) {
  const el = $(id);
  if (!el) return null;

  let wrapper = el.closest("label");
  let text = labelText || textFromLooseLabel(wrapper) || "";

  if (!wrapper) {
    const looseFor = document.querySelector(`label[for="${id}"]`);
    const loosePrev = el.previousElementSibling?.tagName === "LABEL" ? el.previousElementSibling : null;
    const looseLabel = looseFor || loosePrev;
    text = text || textFromLooseLabel(looseLabel) || controlLabelTextFromId(id);

    wrapper = document.createElement("label");
    wrapper.className = "cloud-field cloud-control-field";
    if (looseLabel && looseLabel.parentElement) {
      looseLabel.parentElement.insertBefore(wrapper, looseLabel);
      looseLabel.remove();
    } else if (el.parentElement) {
      el.parentElement.insertBefore(wrapper, el);
    }
    wrapper.appendChild(el);
  }

  wrapper.classList.add("cloud-field", "cloud-control-field");
  wrapper.dataset.controlId = id;
  wrapper.removeAttribute("style");

  let span = Array.from(wrapper.children).find((child) => child.tagName === "SPAN" && !child.contains(el));
  if (!span) {
    span = document.createElement("span");
    wrapper.insertBefore(span, wrapper.firstChild);
  }
  Array.from(wrapper.childNodes).forEach((node) => {
    if (node !== span && node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.remove();
  });
  span.textContent = text || textFromLooseLabel(wrapper) || controlLabelTextFromId(id);

  if (el.type === "checkbox") wrapper.classList.add("cloud-checkbox-field");
  return wrapper;
}

function normalizePanelLooseControls(panel) {
  if (!panel) return;
  Array.from(panel.querySelectorAll("input[id], select[id], textarea[id]")).forEach((el) => {
    if (isLegacySliceUi(el)) {
      hideLegacySliceControl();
      return;
    }
    if (el.id && !el.closest(".cloud-texture-slice-control")) ensureControlLabelWrapper(el.id);
  });
  Array.from(panel.querySelectorAll("label")).forEach((label) => {
    if (!label.querySelector("input, select, textarea, button")) label.classList.add("cloud-orphan-label");
  });
}

function normalizeAllCloudControls() {
  ["p-preview", "p-cloudParams", "p-weather", "p-shape128", "p-detail32", "p-blue"].forEach((id) => normalizePanelLooseControls($(id)));
}

function controlElementForId(id, labelText) {
  return ensureControlLabelWrapper(id, labelText);
}

function makeControlRow(row) {
  const fields = (row.fields || []).map((field) => {
    const spec = typeof field === "string" ? { id: field } : field;
    return controlElementForId(spec.id, spec.label);
  }).filter(Boolean);
  if (!fields.length) return null;

  const wrap = document.createElement("div");
  wrap.className = "cloud-control-row";
  if (row.label) {
    const label = document.createElement("div");
    label.className = "cloud-control-row-label";
    label.textContent = row.label;
    wrap.appendChild(label);
  } else {
    wrap.classList.add("cloud-control-row-no-label");
  }

  const grid = document.createElement("div");
  const columns = row.columns || Math.min(3, fields.length || 1);
  grid.className = `cloud-control-row-fields cloud-control-grid-${columns}`;
  fields.forEach((field) => grid.appendChild(field));
  wrap.appendChild(grid);
  return wrap;
}

function makeControlGroup(title, rows, options = {}) {
  const group = document.createElement("section");
  group.className = "cloud-control-group";
  if (options.dense) group.classList.add("cloud-control-group-dense");

  const heading = document.createElement("div");
  heading.className = "cloud-control-group-title";
  heading.innerHTML = `<span>${title}</span>${options.hint ? `<span class="cloud-control-group-hint">${options.hint}</span>` : ""}`;
  group.appendChild(heading);

  const body = document.createElement("div");
  body.className = "cloud-control-group-body";
  rows.forEach((row) => {
    const rowEl = makeControlRow(row);
    if (rowEl) body.appendChild(rowEl);
  });
  if (!body.children.length) return null;
  group.appendChild(body);
  return group;
}

function appendControlGroup(panel, title, rows, options) {
  if (!panel || panel.querySelector(`[data-cloud-control-group="${title}"]`)) return;
  const group = makeControlGroup(title, rows, options);
  if (!group) return;
  group.dataset.cloudControlGroup = title;
  panel.appendChild(group);
}

function hideOriginalControlFragments(panel) {
  if (!panel) return;
  Array.from(panel.querySelectorAll(".cloud-panel-fields, #preview-look-controls")).forEach((el) => {
    if (!el.querySelector("input, select, button, textarea, canvas")) el.classList.add("cloud-empty-original-group");
  });
  Array.from(panel.children).forEach((el) => {
    if (isLegacySliceUi(el) || isLegacySliceTextOnly(el)) {
      el.classList?.add("cloud-legacy-slice-hidden");
      el.setAttribute?.("aria-hidden", "true");
      return;
    }
    if (el.classList?.contains("cloud-panel-heading")) return;
    if (el.classList?.contains("cloud-control-group")) return;
    if (el.classList?.contains("cloud-texture-panel")) return;
    if (el.id === "cloud-quick-dock") return;
    if (el.querySelector?.("input, select, button, textarea, canvas")) return;
    el.classList?.add("cloud-ui-hidden-fragment");
  });
  Array.from(panel.querySelectorAll(".cloud-orphan-label")).forEach((label) => label.classList.add("cloud-ui-hidden-fragment"));
  hideLegacySliceTextBlocks(panel);
  hideEmptyControlShells(panel);
}

function rgbRow(label, prefix, labels = ["R", "G", "B"]) {
  return {
    label,
    columns: 3,
    fields: [
      { id: `${prefix}-r`, label: labels[0] },
      { id: `${prefix}-g`, label: labels[1] },
      { id: `${prefix}-b`, label: labels[2] },
    ],
  };
}

function xyzRow(label, prefix, labels = ["X", "Y", "Z"]) {
  return {
    label,
    columns: 3,
    fields: [
      { id: `${prefix}-x`, label: labels[0] },
      { id: `${prefix}-y`, label: labels[1] },
      { id: `${prefix}-z`, label: labels[2] },
    ],
  };
}

function organizeSidebarControlGroups() {
  normalizeAllCloudControls();

  const previewPanel = $("p-preview");
  appendControlGroup(previewPanel, "Scene", [
    { label: "Preset", columns: 1, fields: [{ id: "v-layer-preset", label: "Layer" }] },
    { label: "Grade", columns: 1, fields: [{ id: "v-grade", label: "Color" }] },
    { label: "Render", columns: 2, fields: [{ id: "v-render-scale-divider", label: "Divider" }, { id: "v-temporal-cell-rate", label: "Temporal" }] },
  ]);
  appendControlGroup(previewPanel, "Camera", [
    { label: "Cam", columns: 3, fields: [{ id: "v-cx", label: "X" }, { id: "v-cy", label: "Y" }, { id: "v-cz", label: "Z" }] },
    { label: "Look", columns: 3, fields: [{ id: "v-yaw", label: "Yaw" }, { id: "v-pitch", label: "Pitch" }, { id: "v-fov", label: "FOV" }] },
  ], { hint: "world camera" });
  appendControlGroup(previewPanel, "Cloud Box", [
    { label: "Center", columns: 3, fields: [{ id: "v-box-cx", label: "X" }, { id: "v-box-cy", label: "Y" }, { id: "v-box-cz", label: "Z" }] },
    { label: "Half", columns: 3, fields: [{ id: "v-box-hx", label: "X" }, { id: "v-box-hy", label: "Y" }, { id: "v-box-hz", label: "Z" }] },
    { label: "Map", columns: 1, fields: [{ id: "v-box-uv", label: "UV scale" }] },
  ]);
  appendControlGroup(previewPanel, "Sun and Sky", [
    { label: "Sun", columns: 3, fields: [{ id: "c-az", label: "Az" }, { id: "c-el", label: "El" }, { id: "c-bloom", label: "Bloom" }] },
    rgbRow("Sky", "v-s", ["R", "G", "B"]),
    rgbRow("Sun tint", "v-sun", ["R", "G", "B"]),
  ]);
  appendControlGroup(previewPanel, "Resolve", [
    { label: "Image", columns: 3, fields: [{ id: "v-exposure", label: "Exposure" }, { id: "v-alpha-floor", label: "Alpha floor" }, { id: "t-minOutputAlpha", label: "Min alpha" }] },
    { label: "Contrast", columns: 3, fields: [{ id: "v-shadow-strength", label: "Strength" }, { id: "v-shadow-edge", label: "Edge" }, { id: "v-shadow-darkness", label: "Dark" }] },
    { label: "Grade", columns: 3, fields: [{ id: "v-color-lift", label: "Lift" }, { id: "v-saturation", label: "Sat" }, { id: "v-mid-lift", label: "Mid" }] },
    { label: "Rim", columns: 3, fields: [{ id: "v-rim-strength", label: "Rim" }, { id: "v-sun-bleed", label: "Bleed" }, { id: "v-god-rays-enabled", label: "God rays" }] },
    { label: "Rays", columns: 3, fields: [{ id: "v-god-ray-strength", label: "Strength" }, { id: "v-god-ray-length", label: "Length" }, { id: "v-god-ray-falloff", label: "Falloff" }] },
  ]);
  appendControlGroup(previewPanel, "Color", [
    rgbRow("Trans", "v-trans"),
    rgbRow("Front", "v-front"),
    rgbRow("Vol shad", "v-vol-shad"),
    rgbRow("Lit", "v-lit"),
    rgbRow("Shadow", "v-shad"),
    rgbRow("Edge", "v-edge"),
  ], { hint: "RGB triples" });
  hideOriginalControlFragments(previewPanel);

  const tuningPanel = $("p-cloudParams");
  appendControlGroup(tuningPanel, "Density", [
    { label: "Body", columns: 3, fields: [{ id: "p-coverage", label: "Coverage" }, { id: "p-density", label: "Density" }, { id: "p-anvil", label: "Anvil" }] },
    { label: "Shell", columns: 3, fields: [{ id: "t-fluffFactor", label: "Fluff" }, { id: "t-baseJitter", label: "Base" }, { id: "t-topJitter", label: "Top" }] },
    { label: "Alpha", columns: 3, fields: [{ id: "t-alphaCutoff", label: "Cutoff" }, { id: "t-alphaBoostThreshold", label: "Boost min" }, { id: "t-alphaBoostAmount", label: "Boost add" }] },
  ]);
  appendControlGroup(tuningPanel, "Lighting", [
    { label: "Scatter", columns: 3, fields: [{ id: "p-ins", label: "In" }, { id: "p-outs", label: "Out" }, { id: "p-ivo", label: "Mix" }] },
    { label: "Silver", columns: 3, fields: [{ id: "p-sI", label: "Int" }, { id: "p-sE", label: "Exp" }, { id: "p-beer", label: "Beer" }] },
    { label: "Ambient", columns: 3, fields: [{ id: "p-ambMin", label: "Min" }, { id: "p-ambOut", label: "Out" }, { id: "p-clamp", label: "Clamp" }] },
    { label: "Direct", columns: 2, fields: [{ id: "t-directLightBlend", label: "Blend" }, { id: "t-directLightBoost", label: "Boost" }] },
  ]);
  appendControlGroup(tuningPanel, "Vertical Form", [
    { label: "Layer", columns: 3, fields: [{ id: "t-verticalTextureHomogeneity", label: "Homo" }, { id: "t-verticalLayerDecorrelation", label: "Decorr" }, { id: "t-sliceJitterStrength", label: "Jitter" }] },
    { label: "Steps", columns: 2, fields: [{ id: "t-verticalStepBoost", label: "March" }, { id: "t-verticalLightingStepBoost", label: "Light" }] },
  ]);
  appendControlGroup(tuningPanel, "March", [
    { label: "Steps", columns: 3, fields: [{ id: "t-maxSteps", label: "Max" }, { id: "t-minStep", label: "Min" }, { id: "t-maxStep", label: "Step" }] },
    { label: "Far", columns: 3, fields: [{ id: "t-farStepMult", label: "Mult" }, { id: "t-farStart", label: "Start" }, { id: "t-farFull", label: "Full" }] },
    { label: "LOD", columns: 2, fields: [{ id: "t-lodBiasWeather", label: "Weather" }, { id: "t-lodBlendThreshold", label: "Blend" }] },
    { label: "Jitter", columns: 2, fields: [{ id: "t-stepJitter", label: "Step" }, { id: "t-phaseJitter", label: "Phase" }] },
    { label: "Near", columns: 2, fields: [{ id: "t-nearFluffDist", label: "Dist" }, { id: "t-nearDensityMult", label: "Density" }] },
  ]);
  appendControlGroup(tuningPanel, "Lighting Performance", [
    { label: "Sun", columns: 2, fields: [{ id: "t-sunSteps", label: "Steps" }, { id: "t-sunStride", label: "Stride" }] },
    { label: "Smooth", columns: 2, fields: [{ id: "t-raySmoothDens", label: "Density" }, { id: "t-raySmoothSun", label: "Sun" }] },
    { label: "Occlusion", columns: 3, fields: [{ id: "t-frontOcclusionStrength", label: "Strength" }, { id: "t-frontOcclusionAlpha", label: "Alpha" }, { id: "t-frontOcclusionStepBoost", label: "Boost" }] },
  ]);
  hideOriginalControlFragments(tuningPanel);

  const weatherPanel = $("p-weather");
  appendControlGroup(weatherPanel, "Weather R", [
    { label: "Mode", columns: 1, fields: [{ id: "we-mode", label: "Mode" }] },
    { label: "Seed", columns: 2, fields: [{ id: "we-seed", label: "Seed" }, { id: "we-seedAngle", label: "Angle" }] },
    { label: "FBM", columns: 3, fields: [{ id: "we-zoom", label: "Zoom" }, { id: "we-freq", label: "Freq" }, { id: "we-oct", label: "Oct" }] },
    { label: "Shape", columns: 3, fields: [{ id: "we-lac", label: "Lac" }, { id: "we-gain", label: "Gain" }, { id: "we-bias", label: "Bias" }] },
    { label: "Cut", columns: 3, fields: [{ id: "we-scale", label: "Scale" }, { id: "we-thr", label: "Thr" }, { id: "we-edgeK", label: "Edge" }] },
    { label: "Warp", columns: 2, fields: [{ id: "we-voroMode", label: "Voro" }, { id: "we-warpAmp", label: "Warp" }] },
  ]);
  appendControlGroup(weatherPanel, "Billow G", [
    { label: "Use", columns: 1, fields: [{ id: "we-billow-enable", label: "Enabled" }] },
    { label: "Seed", columns: 2, fields: [{ id: "we-billow-seed", label: "Seed" }, { id: "we-billow-seedAngle", label: "Angle" }] },
    { label: "FBM", columns: 3, fields: [{ id: "we-billow-zoom", label: "Zoom" }, { id: "we-billow-freq", label: "Freq" }, { id: "we-billow-oct", label: "Oct" }] },
    { label: "Shape", columns: 3, fields: [{ id: "we-billow-lac", label: "Lac" }, { id: "we-billow-gain", label: "Gain" }, { id: "we-billow-thr", label: "Thr" }] },
    { label: "Warp", columns: 3, fields: [{ id: "we-billow-edgeK", label: "Edge" }, { id: "we-billow-voroMode", label: "Voro" }, { id: "we-billow-warpAmp", label: "Warp" }] },
  ]);
  appendControlGroup(weatherPanel, "Band B", [
    { label: "Use", columns: 1, fields: [{ id: "we-bandb-enable", label: "Enabled" }] },
    { label: "Seed", columns: 2, fields: [{ id: "we-bandb-seed", label: "Seed" }, { id: "we-bandb-seedAngle", label: "Angle" }] },
    { label: "FBM", columns: 3, fields: [{ id: "we-bandb-zoom", label: "Zoom" }, { id: "we-bandb-freq", label: "Freq" }, { id: "we-bandb-oct", label: "Oct" }] },
    { label: "Shape", columns: 3, fields: [{ id: "we-bandb-lac", label: "Lac" }, { id: "we-bandb-gain", label: "Gain" }, { id: "we-bandb-thr", label: "Thr" }] },
    { label: "Warp", columns: 3, fields: [{ id: "we-bandb-edgeK", label: "Edge" }, { id: "we-bandb-voroMode", label: "Voro" }, { id: "we-bandb-warpAmp", label: "Warp" }] },
  ]);
  appendControlGroup(weatherPanel, "Weather Transform", [
    xyzRow("Axis", "we-axis"),
    xyzRow("Offset", "we-pos"),
    xyzRow("Velocity", "we-vel"),
    { label: "Time", columns: 1, fields: [{ id: "we-time", label: "Time" }] },
  ]);
  hideOriginalControlFragments(weatherPanel);

  const shapePanel = $("p-shape128")?.querySelector(".cloud-texture-controls") || $("p-shape128");
  appendControlGroup(shapePanel, "Shape Modes", [
    { label: "Base", columns: 2, fields: [{ id: "sh-mode-a", label: "A" }, { id: "sh-mode-b", label: "B" }] },
    { label: "Bands", columns: 3, fields: [{ id: "sh-mode-2", label: "2" }, { id: "sh-mode-3", label: "3" }, { id: "sh-mode-4", label: "4" }] },
  ]);
  appendControlGroup(shapePanel, "Shape Noise", [
    { label: "Seed", columns: 2, fields: [{ id: "sh-seed", label: "Seed" }, { id: "sh-seedAngle", label: "Angle" }] },
    { label: "FBM", columns: 3, fields: [{ id: "sh-zoom", label: "Zoom" }, { id: "sh-freq", label: "Freq" }, { id: "sh-oct", label: "Oct" }] },
    { label: "Shape", columns: 3, fields: [{ id: "sh-lac", label: "Lac" }, { id: "sh-gain", label: "Gain" }, { id: "sh-thr", label: "Thr" }] },
    { label: "Warp", columns: 3, fields: [{ id: "sh-edgeK", label: "Edge" }, { id: "sh-voroMode", label: "Voro" }, { id: "sh-warpAmp", label: "Warp" }] },
  ]);
  appendControlGroup(shapePanel, "Shape Transform", [
    { label: "Map", columns: 2, fields: [{ id: "sh-scale", label: "Scale" }, { id: "sh-bias", label: "Bias" }] },
    xyzRow("Axis", "sh-axis"),
    xyzRow("Offset", "sh-pos"),
    xyzRow("Velocity", "sh-vel"),
    { label: "Time", columns: 1, fields: [{ id: "sh-time", label: "Time" }] },
  ]);
  hideOriginalControlFragments(shapePanel);

  const detailPanel = $("p-detail32")?.querySelector(".cloud-texture-controls") || $("p-detail32");
  appendControlGroup(detailPanel, "Detail Modes", [
    { label: "Modes", columns: 3, fields: [{ id: "de-mode-1", label: "1" }, { id: "de-mode-2", label: "2" }, { id: "de-mode-3", label: "3" }] },
  ]);
  appendControlGroup(detailPanel, "Detail Noise", [
    { label: "Seed", columns: 2, fields: [{ id: "de-seed", label: "Seed" }, { id: "de-seedAngle", label: "Angle" }] },
    { label: "FBM", columns: 3, fields: [{ id: "de-zoom", label: "Zoom" }, { id: "de-freq", label: "Freq" }, { id: "de-oct", label: "Oct" }] },
    { label: "Shape", columns: 3, fields: [{ id: "de-lac", label: "Lac" }, { id: "de-gain", label: "Gain" }, { id: "de-thr", label: "Thr" }] },
    { label: "Warp", columns: 3, fields: [{ id: "de-edgeK", label: "Edge" }, { id: "de-voroMode", label: "Voro" }, { id: "de-warpAmp", label: "Warp" }] },
  ]);
  appendControlGroup(detailPanel, "Detail Transform", [
    { label: "Map", columns: 2, fields: [{ id: "de-scale", label: "Scale" }, { id: "de-bias", label: "Bias" }] },
    xyzRow("Axis", "de-axis"),
    xyzRow("Offset", "de-pos"),
    xyzRow("Velocity", "de-vel"),
    { label: "Time", columns: 1, fields: [{ id: "de-time", label: "Time" }] },
  ]);
  hideOriginalControlFragments(detailPanel);
  organizeDebugTexturePreviews();
  cleanupTexturePreviewSourcePanels();
}

let _debugRefreshRafPending = false;
let _debugRefreshQueuedKind = "all";

function refreshDebugPreviewsSoon(kind = "all") {
  if (kind === "all" || !_debugRefreshQueuedKind) _debugRefreshQueuedKind = "all";
  else if (_debugRefreshQueuedKind !== "all") _debugRefreshQueuedKind = kind;
  if (_debugRefreshRafPending) return;
  _debugRefreshRafPending = true;
  requestAnimationFrame(() => {
    _debugRefreshRafPending = false;
    const queuedKind = _debugRefreshQueuedKind || "all";
    _debugRefreshQueuedKind = "all";
    sendSizes();
    flushQueuedResize()
      .catch(() => {})
      .finally(() => refreshDebugPreviews(queuedKind).catch(() => {}));
  });
}

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

const clamp01 = (v) => Math.max(0, Math.min(4, Number.isFinite(+v) ? +v : 1));

const CLOUD_LAYER_PRESETS = {
  fair_cumulus: {
    description: "Puffy fair-weather cumulus with a balanced body and soft tops.",
    values: {
      "p-coverage": 0.86,
      "p-density": 8.5,
      "p-anvil": 0.0,
      "p-beer": 5.8,
      "p-sI": 10.5,
      "p-sE": 10.0,
      "t-fluffFactor": 3.15,
      "t-baseJitter": 0.055,
      "t-topJitter": 0.22,
      "t-verticalTextureHomogeneity": 0.62,
      "t-verticalLayerDecorrelation": 0.76,
      "t-sliceJitterStrength": 0.10,
      "t-alphaBoostThreshold": 0.20,
      "t-alphaBoostAmount": 0.12,
      "we-zoom": 3.7,
      "we-freq": 1.05,
      "we-oct": 5,
      "we-gain": 0.52,
      "we-billow-enable": true,
      "we-billow-zoom": 4.4,
      "we-billow-freq": 1.55,
      "we-billow-oct": 4,
      "sh-zoom": 4.2,
      "sh-freq": 1.02,
      "sh-oct": 2,
      "sh-scale": 0.115,
      "sh-bias": 0.42,
      "sh-axis-y": 1.18,
      "de-zoom": 4.8,
      "de-freq": 1.18,
      "de-oct": 4,
      "de-scale": 1.12,
      "de-bias": 0.0,
      "de-axis-y": 1.38,
    },
  },
  broken_cumulus: {
    description: "Open-cell broken cumulus with deeper erosion and more gaps.",
    values: {
      "p-coverage": 0.72,
      "p-density": 8.0,
      "p-anvil": 0.0,
      "p-beer": 6.2,
      "p-sI": 11.0,
      "p-sE": 12.0,
      "t-fluffFactor": 4.2,
      "t-baseJitter": 0.075,
      "t-topJitter": 0.28,
      "t-verticalTextureHomogeneity": 0.72,
      "t-verticalLayerDecorrelation": 0.88,
      "t-sliceJitterStrength": 0.12,
      "we-zoom": 4.7,
      "we-freq": 1.24,
      "we-oct": 5,
      "we-gain": 0.54,
      "we-thr": 0.04,
      "we-billow-enable": true,
      "we-billow-zoom": 5.4,
      "we-billow-freq": 1.8,
      "we-billow-oct": 4,
      "sh-zoom": 5.0,
      "sh-freq": 1.12,
      "sh-oct": 2,
      "sh-scale": 0.13,
      "sh-bias": 0.34,
      "sh-axis-y": 1.45,
      "de-zoom": 5.8,
      "de-freq": 1.45,
      "de-oct": 4,
      "de-scale": 1.38,
      "de-axis-y": 1.75,
    },
  },
  stratus_sheet: {
    description: "Low smooth layered stratus sheet with reduced vertical relief.",
    values: {
      "p-coverage": 1.0,
      "p-density": 6.8,
      "p-anvil": 0.0,
      "p-beer": 5.2,
      "p-sI": 5.5,
      "p-sE": 7.0,
      "t-fluffFactor": 1.25,
      "t-baseJitter": 0.018,
      "t-topJitter": 0.045,
      "t-verticalTextureHomogeneity": 0.22,
      "t-verticalLayerDecorrelation": 0.30,
      "t-sliceJitterStrength": 0.055,
      "t-alphaBoostThreshold": 0.16,
      "t-alphaBoostAmount": 0.10,
      "we-zoom": 2.7,
      "we-freq": 0.82,
      "we-oct": 4,
      "we-gain": 0.46,
      "we-billow-enable": true,
      "we-billow-zoom": 3.2,
      "we-billow-freq": 1.15,
      "we-billow-oct": 3,
      "sh-zoom": 3.0,
      "sh-freq": 0.86,
      "sh-oct": 2,
      "sh-scale": 0.075,
      "sh-bias": 0.48,
      "sh-axis-y": 0.58,
      "de-zoom": 3.8,
      "de-freq": 0.88,
      "de-oct": 3,
      "de-scale": 0.58,
      "de-axis-y": 0.72,
    },
  },
  towering_cu: {
    description: "Strong vertical cumulus towers without a fully spread anvil.",
    values: {
      "p-coverage": 0.88,
      "p-density": 10.5,
      "p-anvil": 0.42,
      "p-beer": 6.3,
      "p-sI": 14.0,
      "p-sE": 14.0,
      "t-fluffFactor": 4.15,
      "t-baseJitter": 0.05,
      "t-topJitter": 0.26,
      "t-verticalTextureHomogeneity": 0.92,
      "t-verticalLayerDecorrelation": 0.92,
      "t-sliceJitterStrength": 0.12,
      "t-alphaBoostThreshold": 0.22,
      "t-alphaBoostAmount": 0.15,
      "we-zoom": 3.9,
      "we-freq": 1.10,
      "we-oct": 5,
      "we-gain": 0.52,
      "we-billow-enable": true,
      "we-billow-zoom": 4.8,
      "we-billow-freq": 1.7,
      "we-billow-oct": 4,
      "sh-zoom": 4.8,
      "sh-freq": 1.15,
      "sh-oct": 2,
      "sh-scale": 0.12,
      "sh-bias": 0.38,
      "sh-axis-y": 2.05,
      "de-zoom": 5.2,
      "de-freq": 1.42,
      "de-oct": 4,
      "de-scale": 1.45,
      "de-axis-y": 2.25,
    },
  },
  cumulonimbus_anvil: {
    description: "Tall storm tower with connected body and upper anvil, with extra vertical erosion.",
    values: {
      "p-coverage": 0.94,
      "p-density": 11.8,
      "p-anvil": 1.15,
      "p-beer": 6.8,
      "p-sI": 16.5,
      "p-sE": 18.0,
      "t-fluffFactor": 5.0,
      "t-baseJitter": 0.045,
      "t-topJitter": 0.32,
      "t-verticalTextureHomogeneity": 1.0,
      "t-verticalLayerDecorrelation": 1.0,
      "t-sliceJitterStrength": 0.14,
      "t-alphaCutoff": 0.965,
      "t-alphaBoostThreshold": 0.22,
      "t-alphaBoostAmount": 0.18,
      "we-zoom": 3.55,
      "we-freq": 1.00,
      "we-oct": 5,
      "we-gain": 0.50,
      "we-billow-enable": true,
      "we-billow-zoom": 4.3,
      "we-billow-freq": 1.55,
      "we-billow-oct": 4,
      "sh-zoom": 4.6,
      "sh-freq": 1.05,
      "sh-oct": 2,
      "sh-scale": 0.112,
      "sh-bias": 0.36,
      "sh-axis-y": 2.65,
      "de-zoom": 5.7,
      "de-freq": 1.55,
      "de-oct": 4,
      "de-scale": 1.65,
      "de-axis-y": 3.0,
    },
  },
  wispy_high: {
    description: "Thin high broken wisps with stronger erosion and low density.",
    values: {
      "p-coverage": 0.52,
      "p-density": 4.4,
      "p-anvil": 0.05,
      "p-beer": 4.2,
      "p-sI": 8.0,
      "p-sE": 20.0,
      "t-fluffFactor": 5.8,
      "t-baseJitter": 0.04,
      "t-topJitter": 0.18,
      "t-verticalTextureHomogeneity": 0.78,
      "t-verticalLayerDecorrelation": 1.0,
      "t-sliceJitterStrength": 0.12,
      "t-alphaCutoff": 0.985,
      "t-alphaBoostThreshold": 0.30,
      "t-alphaBoostAmount": 0.06,
      "we-zoom": 5.8,
      "we-freq": 1.55,
      "we-oct": 5,
      "we-gain": 0.58,
      "we-thr": 0.08,
      "we-billow-enable": false,
      "sh-zoom": 6.0,
      "sh-freq": 1.45,
      "sh-oct": 2,
      "sh-scale": 0.16,
      "sh-bias": 0.28,
      "sh-axis-y": 1.10,
      "de-zoom": 8.0,
      "de-freq": 1.85,
      "de-oct": 4,
      "de-scale": 2.0,
      "de-axis-y": 1.65,
    },
  },
  rain_shelf: {
    description: "Dense shelf/rain-bank body with broad lower mass and a bright upper rim.",
    values: {
      "p-coverage": 1.0,
      "p-density": 12.5,
      "p-anvil": 0.5,
      "p-beer": 7.2,
      "p-sI": 13.5,
      "p-sE": 14.0,
      "t-fluffFactor": 2.55,
      "t-baseJitter": 0.026,
      "t-topJitter": 0.16,
      "t-verticalTextureHomogeneity": 0.74,
      "t-verticalLayerDecorrelation": 0.70,
      "t-sliceJitterStrength": 0.08,
      "t-alphaCutoff": 0.955,
      "t-sunSteps": 4,
      "t-sunStride": 4,
      "t-frontOcclusionStrength": 0.82,
      "t-frontOcclusionAlpha": 0.58,
      "t-frontOcclusionStepBoost": 3.6,
      "t-alphaBoostThreshold": 0.18,
      "t-alphaBoostAmount": 0.22,
      "we-zoom": 3.1,
      "we-freq": 0.95,
      "we-oct": 5,
      "we-gain": 0.47,
      "we-billow-enable": true,
      "we-billow-zoom": 3.7,
      "we-billow-freq": 1.28,
      "we-billow-oct": 4,
      "sh-zoom": 3.8,
      "sh-freq": 0.95,
      "sh-oct": 2,
      "sh-scale": 0.092,
      "sh-bias": 0.44,
      "sh-axis-y": 1.25,
      "de-zoom": 4.2,
      "de-freq": 1.05,
      "de-oct": 4,
      "de-scale": 0.86,
      "de-axis-y": 1.15,
    },
  },
};

function injectPreviewLookControls() {
  const panel = $("p-preview");
  if (!panel || $("v-grade")) return;

  const wrap = document.createElement("div");
  wrap.id = "preview-look-controls";
  wrap.style.marginTop = "16px";
  wrap.style.paddingTop = "12px";
  wrap.style.borderTop = "1px solid rgba(255,255,255,0.08)";
  wrap.innerHTML = `
    <div style="font-size:12px; letter-spacing:0.04em; text-transform:uppercase; opacity:0.82; margin-bottom:10px;">Look / Grade</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; align-items:end;">
      <label style="display:flex; flex-direction:column; gap:6px;">
        <span>Cloud Layer</span>
        <select id="v-layer-preset" title="Applies a coordinated cloud-structure preset across weather, shape/detail noise, transforms, density, and vertical/anvil tuning. Presets rebake the procedural textures.">
          <option value="custom">Custom / Manual</option>
          <option value="fair_cumulus">Fair Cumulus</option>
          <option value="broken_cumulus">Broken Cumulus</option>
          <option value="stratus_sheet">Stratus Sheet</option>
          <option value="towering_cu">Towering Cu</option>
          <option value="cumulonimbus_anvil">Cumulonimbus Anvil</option>
          <option value="wispy_high">Wispy High</option>
          <option value="rain_shelf">Rain Shelf</option>
        </select>
      </label>
      <label style="display:flex; flex-direction:column; gap:6px;">
        <span>Color Grade</span>
        <select id="v-grade">
          <option value="0">Default Gray</option>
          <option value="1">Sunset Punch</option>
          <option value="2">Dusky Purple</option>
          <option value="3">Storm Cool</option>
          <option value="4">Firestorm</option>
          <option value="5">Ember Violet</option>
          <option value="6">Solar Copper</option>
          <option value="7">Moonlit Cyan</option>
          <option value="8">Aurora Teal</option>
          <option value="9">Ash Gold</option>
          <option value="10">Rose Storm</option>
          <option value="11">Deep Ocean</option>
          <option value="12">Natural Daylight</option>
          <option value="13">Silver Daylight</option>
          <option value="14">Soft Overcast</option>
          <option value="15">RGB Spectrum</option>
        </select>
      </label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Render Scale Divider / Coarse Factor</span><input id="v-render-scale-divider" type="number" step="1" min="1" max="8" title="Compute coarse factor for still and animated renders. 1 = full resolution, 4 is the default coarse compute scale, then upsampled to the full presentation canvas."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Temporal Interleave</span><select id="v-temporal-cell-rate" title="Compact history-backed screen interleave. After the first history frame, only a rotated 8x8 scattered subset is dispatched as cloud rays; previous history is copied forward for the rest."><option value="1">Off / full quality</option><option value="2">1 / 2 rays per frame</option><option value="4">1 / 4 rays per frame</option><option value="8">1 / 8 rays per frame</option><option value="16">1 / 16 rays per frame</option><option value="32">1 / 32 rays per frame</option><option value="64">1 / 64 rays per frame</option></select></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Alpha Floor</span><input id="v-alpha-floor" type="number" step="0.005" min="0" max="0.24" title="Composite alpha floor. Faint cloud alpha below this threshold fades out before sky compositing, reducing glow haze without running the removed cream resolve."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Min Output Alpha</span><input id="t-minOutputAlpha" type="number" step="0.005" min="0" max="0.45" title="Compute-side alpha cutoff. Pixels below this alpha are written transparent before temporal history so low-opacity speckle cannot accumulate."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Front Occlusion</span><input id="t-frontOcclusionStrength" type="number" step="0.01" min="0" max="1" title="Close opaque cloud acceleration. 0 disables it; higher values cut behind-cloud work sooner once the front body has accumulated alpha."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Occ. Alpha Start</span><input id="t-frontOcclusionAlpha" type="number" step="0.01" min="0" max="0.98" title="Accumulated alpha where front-occlusion acceleration starts."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Occ. Step Boost</span><input id="t-frontOcclusionStepBoost" type="number" step="0.05" min="1" max="8" title="Maximum behind-front-cloud step multiplier."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Slice Jitter</span><input id="t-sliceJitterStrength" type="number" step="0.01" min="0" max="1" title="Low-amplitude ray jitter that breaks residual march bands without turning tall clouds into screen-space speckle."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Y Decorrelation</span><input id="t-verticalLayerDecorrelation" type="number" step="0.01" min="0" max="1" title="Tiles and bends Y-domain shape/detail sampling so taller volumes read like repeated fluffy structure instead of horizontal shelves."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Direct Light Blend</span><input id="t-directLightBlend" type="number" step="0.01" min="0" max="1" title="Blends in a brighter top-lit cloud color profile for direct sun views, while keeping the current stormy backlit profile for transmissive views."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Direct Light Boost</span><input id="t-directLightBoost" type="number" step="0.01" min="0" max="2" title="Brightness boost for the direct-light profile used when looking at sunlit cloud tops and faces."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Alpha Boost Min</span><input id="t-alphaBoostThreshold" type="number" step="0.01" min="0" max="1" title="Only cloud pixels with final alpha above this threshold receive the additive end-stage alpha boost."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Alpha Boost Add</span><input id="t-alphaBoostAmount" type="number" step="0.01" min="0" max="1" title="Additive alpha applied after cloud lighting and transmission, ramped from the Alpha Boost Min threshold upward."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Shadow Strength</span><input id="v-shadow-strength" type="number" step="0.01" min="0" max="5"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Shadow Edge</span><input id="v-shadow-edge" type="number" step="0.01" min="0" max="2.2"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Shadow Darkness</span><input id="v-shadow-darkness" type="number" step="0.01" min="0" max="6"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Color Lift</span><input id="v-color-lift" type="number" step="0.01" min="0" max="2.2"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Saturation</span><input id="v-saturation" type="number" step="0.01" min="0" max="2.2"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Rim Strength</span><input id="v-rim-strength" type="number" step="0.01" min="0" max="2.2"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Sun Bleed</span><input id="v-sun-bleed" type="number" step="0.01" min="0" max="2.2"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Mid Lift</span><input id="v-mid-lift" type="number" step="0.01" min="0" max="2.2"></label>
      <label style="display:flex; flex-direction:row; gap:8px; align-items:center; align-self:center;"><input id="v-god-rays-enabled" type="checkbox"><span>God Rays</span></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>God Ray Strength</span><input id="v-god-ray-strength" type="number" step="0.01" min="0" max="3"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>God Ray Length</span><input id="v-god-ray-length" type="number" step="0.01" min="0.1" max="2"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>God Ray Falloff</span><input id="v-god-ray-falloff" type="number" step="0.01" min="0.2" max="4"></label>
      <div></div>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Sun Tint R</span><input id="v-sun-r" type="number" step="0.01" min="0" max="4"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Sun Tint G</span><input id="v-sun-g" type="number" step="0.01" min="0" max="4"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Sun Tint B</span><input id="v-sun-b" type="number" step="0.01" min="0" max="4"></label>
      <div></div>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Trans Light R</span><input id="v-trans-r" type="number" step="0.01" min="0" max="4" title="Transmissive/backlit cloud light tint used by the storm/shadow lighting profile."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Trans Light G</span><input id="v-trans-g" type="number" step="0.01" min="0" max="4" title="Transmissive/backlit cloud light tint used by the storm/shadow lighting profile."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Trans Light B</span><input id="v-trans-b" type="number" step="0.01" min="0" max="4" title="Transmissive/backlit cloud light tint used by the storm/shadow lighting profile."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Front Light R</span><input id="v-front-r" type="number" step="0.01" min="0" max="4" title="Direct/front-lit cloud surface tint used when looking at sunlit cloud tops/faces."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Front Light G</span><input id="v-front-g" type="number" step="0.01" min="0" max="4" title="Direct/front-lit cloud surface tint used when looking at sunlit cloud tops/faces."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Front Light B</span><input id="v-front-b" type="number" step="0.01" min="0" max="4" title="Direct/front-lit cloud surface tint used when looking at sunlit cloud tops/faces."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Vol. Shadow R</span><input id="v-vol-shad-r" type="number" step="0.01" min="0" max="4" title="March-time shadow/ambient tint for the volume lighting profile."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Vol. Shadow G</span><input id="v-vol-shad-g" type="number" step="0.01" min="0" max="4" title="March-time shadow/ambient tint for the volume lighting profile."></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Vol. Shadow B</span><input id="v-vol-shad-b" type="number" step="0.01" min="0" max="4" title="March-time shadow/ambient tint for the volume lighting profile."></label>
      <div></div>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Cloud Lit R</span><input id="v-lit-r" type="number" step="0.01" min="0" max="4"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Cloud Lit G</span><input id="v-lit-g" type="number" step="0.01" min="0" max="4"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Cloud Lit B</span><input id="v-lit-b" type="number" step="0.01" min="0" max="4"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Cloud Shadow R</span><input id="v-shad-r" type="number" step="0.01" min="0" max="4"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Cloud Shadow G</span><input id="v-shad-g" type="number" step="0.01" min="0" max="4"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Cloud Shadow B</span><input id="v-shad-b" type="number" step="0.01" min="0" max="4"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Edge Tint R</span><input id="v-edge-r" type="number" step="0.01" min="0" max="4"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Edge Tint G</span><input id="v-edge-g" type="number" step="0.01" min="0" max="4"></label>
      <label style="display:flex; flex-direction:column; gap:6px;"><span>Edge Tint B</span><input id="v-edge-b" type="number" step="0.01" min="0" max="4"></label>
    </div>`;
  panel.appendChild(wrap);
}


const GRADE_PRESETS = {
  0: {
    sky: [0.56, 0.72, 1.02],
    sunBloom: 0.18,
    sunTint: [1.00, 0.99, 0.97],
    transmissiveLightTint: [0.96, 0.98, 1.06],
    frontLightTint: [1.22, 1.20, 1.16],
    volumeShadowTint: [0.72, 0.80, 0.94],
    directLightBlend: 0.84,
    directLightBoost: 0.64,
    cloudLitTint: [1.08, 1.08, 1.09],
    cloudShadowTint: [0.80, 0.88, 0.98],
    edgeTint: [1.06, 1.05, 1.03],
    styleShadowStrength: 2.30,
    styleShadowEdge: 0.44,
    styleShadowDarkness: 0.10,
    styleColorLift: 1.18,
    styleSaturation: 0.98,
    styleRimStrength: 1.20,
    styleSunBleed: 0.42,
    styleMidLift: 1.12,
    godRaysEnabled: true,
    godRayStrength: 0.58,
    godRayLength: 1.0,
    godRayFalloff: 1.62,
  },
  1: {
    sky: [0.44, 0.24, 0.56],
    sunBloom: 0.70,
    sunTint: [1.34, 1.04, 0.52],
    transmissiveLightTint: [1.12, 0.70, 0.46],
    frontLightTint: [1.68, 1.34, 0.82],
    volumeShadowTint: [0.18, 0.10, 0.24],
    directLightBlend: 0.84,
    directLightBoost: 0.94,
    cloudLitTint: [1.62, 1.12, 0.62],
    cloudShadowTint: [0.24, 0.12, 0.30],
    edgeTint: [1.42, 1.02, 0.52],
    styleShadowStrength: 2.10,
    styleShadowEdge: 0.56,
    styleShadowDarkness: 0.16,
    styleColorLift: 1.30,
    styleSaturation: 1.78,
    styleRimStrength: 1.44,
    styleSunBleed: 1.08,
    styleMidLift: 0.98,
    godRaysEnabled: true,
    godRayStrength: 0.66,
    godRayLength: 1.10,
    godRayFalloff: 1.18,
  },
  2: {
    sky: [0.46, 0.40, 0.74],
    sunBloom: 0.54,
    sunTint: [1.02, 0.92, 1.06],
    transmissiveLightTint: [0.88, 0.80, 1.10],
    frontLightTint: [1.36, 1.14, 1.40],
    volumeShadowTint: [0.30, 0.26, 0.56],
    directLightBlend: 0.82,
    directLightBoost: 0.84,
    cloudLitTint: [1.20, 0.98, 1.18],
    cloudShadowTint: [0.34, 0.28, 0.66],
    edgeTint: [1.14, 0.96, 1.18],
    styleShadowStrength: 1.70,
    styleShadowEdge: 0.18,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.18,
    styleSaturation: 1.26,
    styleRimStrength: 1.10,
    styleSunBleed: 0.64,
    styleMidLift: 1.18,
    godRaysEnabled: true,
    godRayStrength: 0.70,
    godRayLength: 1.02,
    godRayFalloff: 1.42,
  },
  3: {
    sky: [0.46, 0.56, 0.82],
    sunBloom: 0.34,
    sunTint: [0.96, 1.00, 1.04],
    transmissiveLightTint: [0.96, 1.04, 1.30],
    frontLightTint: [1.44, 1.42, 1.38],
    volumeShadowTint: [0.28, 0.36, 0.52],
    directLightBlend: 0.92,
    directLightBoost: 1.02,
    cloudLitTint: [1.42, 1.34, 1.28],
    cloudShadowTint: [0.72, 0.84, 1.08],
    edgeTint: [1.22, 1.22, 1.18],
    styleShadowStrength: 2.56,
    styleShadowEdge: 0.48,
    styleShadowDarkness: 0.12,
    styleColorLift: 1.18,
    styleSaturation: 1.06,
    styleRimStrength: 1.58,
    styleSunBleed: 0.94,
    styleMidLift: 1.00,
    godRaysEnabled: true,
    godRayStrength: 0.38,
    godRayLength: 0.94,
    godRayFalloff: 1.86,
  },
  4: {
    sky: [0.42, 0.30, 0.42],
    sunBloom: 0.58,
    sunTint: [1.12, 0.82, 0.62],
    transmissiveLightTint: [0.98, 0.54, 0.32],
    frontLightTint: [1.58, 1.04, 0.62],
    volumeShadowTint: [0.18, 0.08, 0.10],
    directLightBlend: 0.88,
    directLightBoost: 1.00,
    cloudLitTint: [1.34, 0.80, 0.42],
    cloudShadowTint: [0.16, 0.08, 0.10],
    edgeTint: [1.34, 0.92, 0.56],
    styleShadowStrength: 2.12,
    styleShadowEdge: 0.34,
    styleShadowDarkness: 0.28,
    styleColorLift: 1.10,
    styleSaturation: 1.74,
    styleRimStrength: 1.62,
    styleSunBleed: 0.78,
    styleMidLift: 1.00,
    godRaysEnabled: true,
    godRayStrength: 0.88,
    godRayLength: 0.96,
    godRayFalloff: 1.36,
  },
  5: {
    sky: [0.50, 0.34, 0.64],
    sunBloom: 0.58,
    sunTint: [1.10, 0.84, 0.86],
    transmissiveLightTint: [0.96, 0.70, 0.98],
    frontLightTint: [1.42, 1.00, 1.20],
    volumeShadowTint: [0.28, 0.18, 0.52],
    directLightBlend: 0.82,
    directLightBoost: 0.86,
    cloudLitTint: [1.26, 0.88, 1.02],
    cloudShadowTint: [0.34, 0.24, 0.60],
    edgeTint: [1.20, 0.86, 1.00],
    styleShadowStrength: 1.24,
    styleShadowEdge: 0.12,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.28,
    styleSaturation: 1.32,
    styleRimStrength: 1.10,
    styleSunBleed: 0.60,
    styleMidLift: 1.30,
    godRaysEnabled: true,
    godRayStrength: 0.72,
    godRayLength: 1.02,
    godRayFalloff: 1.34,
  },
  6: {
    sky: [0.52, 0.42, 0.30],
    sunBloom: 0.62,
    sunTint: [1.24, 0.96, 0.62],
    transmissiveLightTint: [1.04, 0.82, 0.44],
    frontLightTint: [1.54, 1.14, 0.64],
    volumeShadowTint: [0.20, 0.12, 0.08],
    directLightBlend: 0.84,
    directLightBoost: 0.90,
    cloudLitTint: [1.36, 1.00, 0.56],
    cloudShadowTint: [0.20, 0.14, 0.10],
    edgeTint: [1.38, 1.06, 0.64],
    styleShadowStrength: 1.42,
    styleShadowEdge: 0.26,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.22,
    styleSaturation: 1.52,
    styleRimStrength: 1.36,
    styleSunBleed: 0.92,
    styleMidLift: 0.96,
    godRaysEnabled: true,
    godRayStrength: 0.66,
    godRayLength: 1.06,
    godRayFalloff: 1.26,
  },
  7: {
    sky: [0.22, 0.34, 0.54],
    sunBloom: 0.42,
    sunTint: [0.76, 1.06, 1.22],
    transmissiveLightTint: [0.62, 0.98, 1.18],
    frontLightTint: [0.98, 1.40, 1.56],
    volumeShadowTint: [0.08, 0.16, 0.28],
    directLightBlend: 0.82,
    directLightBoost: 0.82,
    cloudLitTint: [0.90, 1.22, 1.42],
    cloudShadowTint: [0.10, 0.18, 0.30],
    edgeTint: [0.84, 1.38, 1.58],
    styleShadowStrength: 1.48,
    styleShadowEdge: 0.30,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.06,
    styleSaturation: 1.46,
    styleRimStrength: 1.20,
    styleSunBleed: 0.50,
    styleMidLift: 1.10,
    godRaysEnabled: true,
    godRayStrength: 0.42,
    godRayLength: 0.94,
    godRayFalloff: 1.66,
  },
  8: {
    sky: [0.22, 0.54, 0.50],
    sunBloom: 0.52,
    sunTint: [0.88, 1.14, 0.98],
    transmissiveLightTint: [0.58, 1.06, 0.92],
    frontLightTint: [1.02, 1.46, 1.16],
    volumeShadowTint: [0.08, 0.24, 0.22],
    directLightBlend: 0.84,
    directLightBoost: 0.88,
    cloudLitTint: [0.92, 1.34, 1.08],
    cloudShadowTint: [0.12, 0.26, 0.24],
    edgeTint: [0.78, 1.52, 1.16],
    styleShadowStrength: 1.22,
    styleShadowEdge: 0.20,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.34,
    styleSaturation: 1.60,
    styleRimStrength: 1.32,
    styleSunBleed: 0.62,
    styleMidLift: 1.20,
    godRaysEnabled: true,
    godRayStrength: 0.58,
    godRayLength: 1.16,
    godRayFalloff: 1.44,
  },
  9: {
    sky: [0.58, 0.50, 0.36],
    sunBloom: 0.46,
    sunTint: [1.18, 1.08, 0.74],
    transmissiveLightTint: [0.98, 0.88, 0.50],
    frontLightTint: [1.44, 1.28, 0.84],
    volumeShadowTint: [0.22, 0.18, 0.12],
    directLightBlend: 0.80,
    directLightBoost: 0.76,
    cloudLitTint: [1.28, 1.10, 0.72],
    cloudShadowTint: [0.26, 0.22, 0.16],
    edgeTint: [1.34, 1.14, 0.78],
    styleShadowStrength: 1.54,
    styleShadowEdge: 0.40,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.00,
    styleSaturation: 1.08,
    styleRimStrength: 1.16,
    styleSunBleed: 0.54,
    styleMidLift: 0.80,
    godRaysEnabled: false,
    godRayStrength: 0.22,
    godRayLength: 0.86,
    godRayFalloff: 1.96,
  },
  10: {
    sky: [0.44, 0.28, 0.38],
    sunBloom: 0.68,
    sunTint: [1.16, 0.82, 0.88],
    transmissiveLightTint: [0.96, 0.60, 0.88],
    frontLightTint: [1.46, 1.04, 1.18],
    volumeShadowTint: [0.18, 0.10, 0.22],
    directLightBlend: 0.84,
    directLightBoost: 0.80,
    cloudLitTint: [1.32, 0.90, 0.98],
    cloudShadowTint: [0.22, 0.12, 0.26],
    edgeTint: [1.40, 0.96, 1.10],
    styleShadowStrength: 1.34,
    styleShadowEdge: 0.26,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.22,
    styleSaturation: 1.42,
    styleRimStrength: 1.28,
    styleSunBleed: 0.76,
    styleMidLift: 1.18,
    godRaysEnabled: true,
    godRayStrength: 0.60,
    godRayLength: 1.00,
    godRayFalloff: 1.34,
  },
  11: {
    sky: [0.14, 0.22, 0.42],
    sunBloom: 0.38,
    sunTint: [0.62, 0.86, 1.30],
    transmissiveLightTint: [0.42, 0.74, 1.18],
    frontLightTint: [0.86, 1.16, 1.56],
    volumeShadowTint: [0.02, 0.06, 0.18],
    directLightBlend: 0.82,
    directLightBoost: 0.80,
    cloudLitTint: [0.78, 1.00, 1.42],
    cloudShadowTint: [0.04, 0.08, 0.20],
    edgeTint: [0.74, 1.02, 1.60],
    styleShadowStrength: 1.70,
    styleShadowEdge: 0.48,
    styleShadowDarkness: 0.0,
    styleColorLift: 0.96,
    styleSaturation: 1.34,
    styleRimStrength: 1.14,
    styleSunBleed: 0.36,
    styleMidLift: 0.72,
    godRaysEnabled: false,
    godRayStrength: 0.18,
    godRayLength: 0.82,
    godRayFalloff: 2.14,
  },
  12: {
    sky: [0.36, 0.66, 1.24],
    sunBloom: 0.22,
    sunTint: [0.94, 0.99, 1.06],
    transmissiveLightTint: [0.82, 1.02, 1.34],
    frontLightTint: [1.06, 1.18, 1.42],
    volumeShadowTint: [0.42, 0.64, 1.14],
    directLightBlend: 0.86,
    directLightBoost: 0.74,
    cloudLitTint: [0.98, 1.08, 1.28],
    cloudShadowTint: [0.48, 0.70, 1.18],
    edgeTint: [0.88, 1.02, 1.34],
    styleShadowStrength: 1.70,
    styleShadowEdge: 0.24,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.16,
    styleSaturation: 1.12,
    styleRimStrength: 1.20,
    styleSunBleed: 0.34,
    styleMidLift: 1.14,
    godRaysEnabled: true,
    godRayStrength: 0.44,
    godRayLength: 0.98,
    godRayFalloff: 1.62,
  },
  13: {
    sky: [0.30, 0.62, 1.28],
    sunBloom: 0.26,
    sunTint: [0.92, 0.99, 1.08],
    transmissiveLightTint: [0.76, 1.04, 1.42],
    frontLightTint: [1.02, 1.20, 1.54],
    volumeShadowTint: [0.34, 0.56, 1.18],
    directLightBlend: 0.90,
    directLightBoost: 0.84,
    cloudLitTint: [0.96, 1.10, 1.38],
    cloudShadowTint: [0.40, 0.64, 1.22],
    edgeTint: [0.78, 0.98, 1.46],
    styleShadowStrength: 1.50,
    styleShadowEdge: 0.20,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.24,
    styleSaturation: 1.12,
    styleRimStrength: 1.36,
    styleSunBleed: 0.42,
    styleMidLift: 1.18,
    godRaysEnabled: true,
    godRayStrength: 0.50,
    godRayLength: 1.02,
    godRayFalloff: 1.48,
  },
  14: {
    sky: [0.70, 0.76, 0.94],
    sunBloom: 0.18,
    sunTint: [0.98, 0.98, 0.98],
    transmissiveLightTint: [0.94, 0.98, 1.08],
    frontLightTint: [1.14, 1.14, 1.14],
    volumeShadowTint: [0.54, 0.60, 0.74],
    directLightBlend: 0.80,
    directLightBoost: 0.54,
    cloudLitTint: [1.06, 1.06, 1.06],
    cloudShadowTint: [0.68, 0.74, 0.86],
    edgeTint: [1.04, 1.04, 1.04],
    styleShadowStrength: 1.92,
    styleShadowEdge: 0.32,
    styleShadowDarkness: 0.10,
    styleColorLift: 1.10,
    styleSaturation: 0.80,
    styleRimStrength: 0.98,
    styleSunBleed: 0.22,
    styleMidLift: 1.00,
    godRaysEnabled: false,
    godRayStrength: 0.18,
    godRayLength: 0.90,
    godRayFalloff: 1.86,
  },
  15: {
    sky: [0.08, 0.18, 0.72],
    sunBloom: 0.42,
    sunTint: [1.24, 0.84, 0.78],
    transmissiveLightTint: [0.06, 1.70, 0.20],
    frontLightTint: [2.20, 0.10, 0.08],
    volumeShadowTint: [0.04, 0.12, 1.70],
    directLightBlend: 0.74,
    directLightBoost: 1.08,
    cloudLitTint: [2.05, 0.12, 0.10],
    cloudShadowTint: [0.04, 0.12, 1.58],
    edgeTint: [0.08, 1.86, 0.18],
    styleShadowStrength: 1.54,
    styleShadowEdge: 0.18,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.18,
    styleSaturation: 2.20,
    styleRimStrength: 1.66,
    styleSunBleed: 0.60,
    styleMidLift: 0.92,
    godRaysEnabled: true,
    godRayStrength: 0.42,
    godRayLength: 1.00,
    godRayFalloff: 1.42,
  },
};

function colorVec3(v, fallback) {
  const f = fallback || [1.0, 1.0, 1.0];
  return [
    +(v?.[0] ?? f[0] ?? 1.0),
    +(v?.[1] ?? f[1] ?? 1.0),
    +(v?.[2] ?? f[2] ?? 1.0),
  ];
}

function mulVec3(a, b, c) {
  return [
    +(a?.[0] ?? 1.0) * +(b?.[0] ?? 1.0) * +(c?.[0] ?? 1.0),
    +(a?.[1] ?? 1.0) * +(b?.[1] ?? 1.0) * +(c?.[1] ?? 1.0),
    +(a?.[2] ?? 1.0) * +(b?.[2] ?? 1.0) * +(c?.[2] ?? 1.0),
  ];
}

function lightingProfileForGrade(style) {
  const preset = GRADE_PRESETS[style] || GRADE_PRESETS[0];
  const sunTint = colorVec3(preset.sunTint, [1.0, 1.0, 1.0]);
  const litTint = colorVec3(preset.cloudLitTint, [1.0, 1.0, 1.0]);
  const shadowTint = colorVec3(preset.cloudShadowTint, [0.62, 0.68, 0.78]);

  return {
    transmissiveLightTint: colorVec3(preset.transmissiveLightTint, sunTint),
    frontLightTint: colorVec3(
      preset.frontLightTint,
      [
        Math.max(1.0, litTint[0] * 0.72 + sunTint[0] * 0.40),
        Math.max(1.0, litTint[1] * 0.72 + sunTint[1] * 0.40),
        Math.max(1.0, litTint[2] * 0.72 + sunTint[2] * 0.40),
      ],
    ),
    volumeShadowTint: colorVec3(preset.volumeShadowTint, shadowTint),
    directLightBlend: +(preset.directLightBlend ?? 0.78),
    directLightBoost: +(preset.directLightBoost ?? 0.58),
  };
}


function setControlValue(id, val) {
  const el = $(id);
  if (!el) return;
  if (el.type === "checkbox") {
    el.checked = !!val;
  } else {
    el.value = `${val}`;
  }
}

function applyCloudLayerPresetValues(key) {
  const preset = CLOUD_LAYER_PRESETS[key];
  if (!preset) return false;
  preview.layerPreset = key;
  setControlValue("v-layer-preset", key);
  for (const [id, val] of Object.entries(preset.values || {})) {
    setControlValue(id, val);
  }
  return true;
}

async function applyCloudLayerPreset(key, render = true) {
  if (!key || key === "custom") {
    preview.layerPreset = "custom";
    return;
  }

  const preset = CLOUD_LAYER_PRESETS[key];
  if (!preset) return;

  applyCloudLayerPresetValues(key);

  if (!render) return;

  setBusy(true, `Applying ${key.replaceAll("_", " ")}...`);
  try {
    readWeather();
    readWeatherG();
    readWeatherB();
    readShape();
    readShapeTransform();
    readDetail();
    readDetailTransform();
    readPreview();

    await rpc("bakeAll", {
      weatherParams: safeClone(weatherParams),
      billowParams: safeClone(billowParams),
      weatherBParams: safeClone(weatherBParams),
      blueParams: safeClone(blueParams),
      shapeParams: safeClone(shapeParams),
      detailParams: safeClone(detailParams),
      tileTransforms: safeClone(tileTransforms),
    });

    await sendTuningNow(true);
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
    useFreshFullFrameReproj(payload);
    ensureCoarseInPayload(payload);
    payload.skipFinalDebug = true;
    await runFrameLatest(payload);
    await refreshDebugPreviews();
  } finally {
    setBusy(false);
  }
}

function syncPreviewLookInputs() {
  setFieldValue("v-layer-preset", preview.layerPreset || "custom");
  setFieldValue("v-grade", preview.gradeStyle);
  setFieldValue("v-render-scale-divider", preview.renderScaleDivider ?? 4);
  setFieldValue("v-temporal-cell-rate", normalizeTemporalCellRate(preview.temporalCellRate ?? 1));
  setFieldValue("v-alpha-floor", preview.alphaFloor ?? 0.0);
  setFieldValue("v-sr", preview.sky[0]);
  setFieldValue("v-sg", preview.sky[1]);
  setFieldValue("v-sb", preview.sky[2]);
  const box = preview.box || (preview.box = { center: [0, 0, 0], half: [18, 0.3, 18], uvScale: 1 });
  box.center = box.center || [0, 0, 0];
  box.half = box.half || [18, 0.3, 18];
  setFieldValue("v-box-cx", box.center[0]);
  setFieldValue("v-box-cy", box.center[1]);
  setFieldValue("v-box-cz", box.center[2]);
  setFieldValue("v-box-hx", box.half[0]);
  setFieldValue("v-box-hy", box.half[1]);
  setFieldValue("v-box-hz", box.half[2]);
  setFieldValue("v-box-uv", box.uvScale ?? 1);
  setFieldValue("c-bloom", preview.sun.bloom);
  setFieldValue("v-shadow-strength", preview.styleShadowStrength);
  setFieldValue("v-shadow-edge", preview.styleShadowEdge ?? 0.0);
  setFieldValue("v-shadow-darkness", preview.styleShadowDarkness ?? 0.0);
  setFieldValue("v-color-lift", preview.styleColorLift);
  setFieldValue("v-saturation", preview.styleSaturation);
  setFieldValue("v-rim-strength", preview.styleRimStrength);
  setFieldValue("v-sun-bleed", preview.styleSunBleed);
  setFieldValue("v-mid-lift", preview.styleMidLift);
  const godEnabled = $("v-god-rays-enabled");
  if (godEnabled) godEnabled.checked = !!preview.godRaysEnabled;
  setFieldValue("v-god-ray-strength", preview.godRayStrength);
  setFieldValue("v-god-ray-length", preview.godRayLength);
  setFieldValue("v-god-ray-falloff", preview.godRayFalloff);
  setFieldValue("v-sun-r", preview.sunTint[0]);
  setFieldValue("v-sun-g", preview.sunTint[1]);
  setFieldValue("v-sun-b", preview.sunTint[2]);
  setFieldValue("v-trans-r", preview.transmissiveLightTint?.[0] ?? 1.0);
  setFieldValue("v-trans-g", preview.transmissiveLightTint?.[1] ?? 1.0);
  setFieldValue("v-trans-b", preview.transmissiveLightTint?.[2] ?? 1.0);
  setFieldValue("v-front-r", preview.frontLightTint?.[0] ?? 1.10);
  setFieldValue("v-front-g", preview.frontLightTint?.[1] ?? 1.12);
  setFieldValue("v-front-b", preview.frontLightTint?.[2] ?? 1.16);
  setFieldValue("v-vol-shad-r", preview.volumeShadowTint?.[0] ?? 0.62);
  setFieldValue("v-vol-shad-g", preview.volumeShadowTint?.[1] ?? 0.68);
  setFieldValue("v-vol-shad-b", preview.volumeShadowTint?.[2] ?? 0.78);
  setFieldValue("t-directLightBlend", preview.directLightBlend ?? 0.78);
  setFieldValue("t-directLightBoost", preview.directLightBoost ?? 0.58);
  setFieldValue("v-lit-r", preview.cloudLitTint[0]);
  setFieldValue("v-lit-g", preview.cloudLitTint[1]);
  setFieldValue("v-lit-b", preview.cloudLitTint[2]);
  setFieldValue("v-shad-r", preview.cloudShadowTint[0]);
  setFieldValue("v-shad-g", preview.cloudShadowTint[1]);
  setFieldValue("v-shad-b", preview.cloudShadowTint[2]);
  setFieldValue("v-edge-r", preview.edgeTint[0]);
  setFieldValue("v-edge-g", preview.edgeTint[1]);
  setFieldValue("v-edge-b", preview.edgeTint[2]);
}

function applyGradePreset(style, syncInputs = true) {
  const preset = GRADE_PRESETS[style] || GRADE_PRESETS[0];
  preview.gradeStyle = style >>> 0;
  preview.renderScaleDivider = normalizeRenderScaleDivider(preset.renderScaleDivider ?? preview.renderScaleDivider ?? 4);
  preview.sky = preset.sky.slice();
  preview.sun.bloom = preset.sunBloom;
  const lighting = lightingProfileForGrade(style);
  preview.sunTint = preset.sunTint.slice();
  preview.transmissiveLightTint = lighting.transmissiveLightTint.slice();
  preview.frontLightTint = lighting.frontLightTint.slice();
  preview.volumeShadowTint = lighting.volumeShadowTint.slice();
  preview.directLightBlend = lighting.directLightBlend;
  preview.directLightBoost = lighting.directLightBoost;
  preview.cloudLitTint = preset.cloudLitTint.slice();
  preview.cloudShadowTint = preset.cloudShadowTint.slice();
  preview.edgeTint = preset.edgeTint.slice();
  preview.styleShadowStrength = preset.styleShadowStrength ?? preview.styleShadowStrength ?? 0.88;
  preview.styleShadowEdge = preset.styleShadowEdge ?? preview.styleShadowEdge ?? 0.0;
  preview.styleShadowDarkness = preset.styleShadowDarkness ?? preview.styleShadowDarkness ?? 0.0;
  preview.styleColorLift = preset.styleColorLift ?? preview.styleColorLift ?? 1.12;
  preview.styleSaturation = preset.styleSaturation ?? preview.styleSaturation ?? 1.10;
  preview.styleRimStrength = preset.styleRimStrength ?? preview.styleRimStrength ?? 1.0;
  preview.styleSunBleed = preset.styleSunBleed ?? preview.styleSunBleed ?? 0.85;
  preview.styleMidLift = preset.styleMidLift ?? preview.styleMidLift ?? 1.10;
  preview.godRaysEnabled = preset.godRaysEnabled ?? preview.godRaysEnabled ?? false;
  preview.godRayStrength = preset.godRayStrength ?? preview.godRayStrength ?? 0.0;
  preview.godRayLength = preset.godRayLength ?? preview.godRayLength ?? 1.0;
  preview.godRayFalloff = preset.godRayFalloff ?? preview.godRayFalloff ?? 1.55;

  if (!syncInputs) return;
  syncPreviewLookInputs();
}
const safeClone = (o) => {
  if (o == null || typeof o !== "object") return o;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(o);
    } catch {}
  }
  try {
    return JSON.parse(JSON.stringify(o));
  } catch {
    return Array.isArray(o) ? o.slice() : Object.assign({}, o);
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
  if (!hasDefault && defaultValue) {
    const opt = document.createElement("option");
    opt.value = defaultValue;
    opt.textContent = makeNoiseLabel(defaultValue);
    el.appendChild(opt);
  }
  el.value = hasDefault ? defaultValue : defaultValue || (allowNone ? "" : list[0] || "");
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
    maxStep: +($("t-maxStep")?.value || 0.16),
    sunSteps: +($("t-sunSteps")?.value || 4) | 0,
    sunStride: +($("t-sunStride")?.value || 4) | 0,
    phaseJitter: +($("t-phaseJitter")?.value || 1.0),
    stepJitter: +($("t-stepJitter")?.value || 0.3),
    baseJitterFrac: +($("t-baseJitter")?.value || 0.02),
    topJitterFrac: +($("t-topJitter")?.value || 0.1),
    lodBiasWeather: +($("t-lodBiasWeather")?.value || 1.5),
    nearFluffDist: +($("t-nearFluffDist")?.value || 60.0),
    nearDensityMult: +($("t-nearDensityMult")?.value || 2.5),
    lodBlendThreshold: +($("t-lodBlendThreshold")?.value || 0.46),
    farStart: +($("t-farStart")?.value || 1.05),
    farFull: +($("t-farFull")?.value || 4.2),
    farStepMult: +($("t-farStepMult")?.value || 2.05),
    raySmoothDens: +($("t-raySmoothDens")?.value || 0.40),
    raySmoothSun: +($("t-raySmoothSun")?.value || 0.40),
    fluffFactor: +($("t-fluffFactor")?.value || 4.0),
    alphaCutoff: +($("t-alphaCutoff")?.value || 0.98),
    verticalStepBoost: +($("t-verticalStepBoost")?.value || 3.0),
    verticalTextureHomogeneity: +($("t-verticalTextureHomogeneity")?.value || 0.0),
    verticalLightingStepBoost: +($("t-verticalLightingStepBoost")?.value || 1.35),
    frontOcclusionStrength: +($("t-frontOcclusionStrength")?.value || 0.82),
    frontOcclusionAlpha: +($("t-frontOcclusionAlpha")?.value || 0.58),
    frontOcclusionStepBoost: +($("t-frontOcclusionStepBoost")?.value || 3.6),
    sliceJitterStrength: +($("t-sliceJitterStrength")?.value || 0.08),
    verticalLayerDecorrelation: +($("t-verticalLayerDecorrelation")?.value || 0.35),
    directLightBlend: +($("t-directLightBlend")?.value || preview.directLightBlend || 0.78),
    directLightBoost: +($("t-directLightBoost")?.value || preview.directLightBoost || 0.58),
    alphaBoostThreshold: +($("t-alphaBoostThreshold")?.value || 0.22),
    alphaBoostAmount: +($("t-alphaBoostAmount")?.value || 0.16),
    minOutputAlpha: +($("t-minOutputAlpha")?.value || 0.05),
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

  const sunColorByGrade = {
    1: [1.06, 0.82, 0.68],
    2: [1.00, 0.80, 1.00],
    3: [0.92, 0.96, 1.0],
    4: [1.12, 0.74, 0.44],
    5: [1.06, 0.80, 0.76],
    6: [1.18, 0.86, 0.52],
    7: [0.70, 1.02, 1.18],
    8: [0.82, 1.12, 0.94],
    9: [1.12, 1.02, 0.68],
    10: [1.14, 0.74, 0.82],
    11: [0.62, 0.84, 1.22],
    12: [0.86, 0.96, 1.14],
    13: [0.76, 0.92, 1.20],
    14: [0.96, 0.98, 1.02],
    15: [1.34, 0.10, 0.08],
  };
  const baseSunColor = sunColorByGrade[preview.gradeStyle] || [1.0, 0.95, 0.87];
  const sunTint = preview.sunTint || [1.0, 1.0, 1.0];
  const lightingProfile = lightingProfileForGrade(preview.gradeStyle);
  const transmissiveTint = preview.transmissiveLightTint || lightingProfile.transmissiveLightTint;
  const frontTint = preview.frontLightTint || lightingProfile.frontLightTint;
  const volumeShadowTint = preview.volumeShadowTint || lightingProfile.volumeShadowTint;

  return {
    globalCoverage: num("p-coverage", 1.0),
    globalDensity: num("p-density", 100.0),
    cloudAnvilAmount: num("p-anvil", 0.1),
    cloudBeer: num("p-beer", 6.0),
    attenuationClamp: num("p-clamp", 0.005),
    inScatterG: num("p-ins", 0.72),
    silverIntensity: num("p-sI", 12.0),
    silverExponent: num("p-sE", 12.0),
    outScatterG: num("p-outs", 1.0),
    inVsOut: num("p-ivo", 0.5),
    outScatterAmbientAmt: num("p-ambOut", 0.12),
    ambientMinimum: num("p-ambMin", 0.055),
    sunColor: mulVec3(baseSunColor, sunTint, transmissiveTint),
    frontLightColor: mulVec3(baseSunColor, sunTint, frontTint),
    shadowLightColor: colorVec3(volumeShadowTint, [0.62, 0.68, 0.78]),
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
  tileTransforms.weatherBias = num("we-bias", tileTransforms.weatherBias ?? 0.3);

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

  tileTransforms.weatherVel = tileTransforms.weatherVel || [0, 0, 0];
  tileTransforms.weatherVel[0] = num("we-vel-x", tileTransforms.weatherVel[0]);
  tileTransforms.weatherVel[1] = num("we-vel-y", tileTransforms.weatherVel[1]);
  tileTransforms.weatherVel[2] = num("we-vel-z", tileTransforms.weatherVel[2]);

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
  tileTransforms.shapeBias = num("sh-bias", tileTransforms.shapeBias ?? 0.4);
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
  tileTransforms.detailBias = num("de-bias", tileTransforms.detailBias ?? 0.0);
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
  preview.box = preview.box || { center: [0, 0, 0], half: [18, 0.3, 18], uvScale: 1 };
  preview.box.center = preview.box.center || [0, 0, 0];
  preview.box.half = preview.box.half || [18, 0.3, 18];
  preview.box.center[0] = num("v-box-cx", preview.box.center[0]);
  preview.box.center[1] = num("v-box-cy", preview.box.center[1]);
  preview.box.center[2] = num("v-box-cz", preview.box.center[2]);
  preview.box.half[0] = Math.max(0.001, num("v-box-hx", preview.box.half[0]));
  preview.box.half[1] = Math.max(0.001, num("v-box-hy", preview.box.half[1]));
  preview.box.half[2] = Math.max(0.001, num("v-box-hz", preview.box.half[2]));
  preview.box.uvScale = Math.max(0.001, num("v-box-uv", preview.box.uvScale ?? 1));
  preview.layerPreset = $("v-layer-preset")?.value || preview.layerPreset || "custom";
  preview.gradeStyle = u32("v-grade", preview.gradeStyle);
  preview.renderScaleDivider = normalizeRenderScaleDivider(u32("v-render-scale-divider", preview.renderScaleDivider ?? 4));
  preview.temporalCellRate = normalizeTemporalCellRate(u32("v-temporal-cell-rate", preview.temporalCellRate ?? 1));
  preview.alphaFloor = Math.max(0, Math.min(0.24, num("v-alpha-floor", preview.alphaFloor ?? 0.0)));
  preview.sunTint[0] = clamp01(num("v-sun-r", preview.sunTint[0]));
  preview.sunTint[1] = clamp01(num("v-sun-g", preview.sunTint[1]));
  preview.sunTint[2] = clamp01(num("v-sun-b", preview.sunTint[2]));
  preview.transmissiveLightTint = preview.transmissiveLightTint || [1, 1, 1];
  preview.transmissiveLightTint[0] = clamp01(num("v-trans-r", preview.transmissiveLightTint[0]));
  preview.transmissiveLightTint[1] = clamp01(num("v-trans-g", preview.transmissiveLightTint[1]));
  preview.transmissiveLightTint[2] = clamp01(num("v-trans-b", preview.transmissiveLightTint[2]));
  preview.frontLightTint = preview.frontLightTint || [1.10, 1.12, 1.16];
  preview.frontLightTint[0] = clamp01(num("v-front-r", preview.frontLightTint[0]));
  preview.frontLightTint[1] = clamp01(num("v-front-g", preview.frontLightTint[1]));
  preview.frontLightTint[2] = clamp01(num("v-front-b", preview.frontLightTint[2]));
  preview.volumeShadowTint = preview.volumeShadowTint || [0.62, 0.68, 0.78];
  preview.volumeShadowTint[0] = clamp01(num("v-vol-shad-r", preview.volumeShadowTint[0]));
  preview.volumeShadowTint[1] = clamp01(num("v-vol-shad-g", preview.volumeShadowTint[1]));
  preview.volumeShadowTint[2] = clamp01(num("v-vol-shad-b", preview.volumeShadowTint[2]));
  preview.cloudLitTint[0] = clamp01(num("v-lit-r", preview.cloudLitTint[0]));
  preview.cloudLitTint[1] = clamp01(num("v-lit-g", preview.cloudLitTint[1]));
  preview.cloudLitTint[2] = clamp01(num("v-lit-b", preview.cloudLitTint[2]));
  preview.cloudShadowTint[0] = clamp01(num("v-shad-r", preview.cloudShadowTint[0]));
  preview.cloudShadowTint[1] = clamp01(num("v-shad-g", preview.cloudShadowTint[1]));
  preview.cloudShadowTint[2] = clamp01(num("v-shad-b", preview.cloudShadowTint[2]));
  preview.edgeTint[0] = clamp01(num("v-edge-r", preview.edgeTint[0]));
  preview.edgeTint[1] = clamp01(num("v-edge-g", preview.edgeTint[1]));
  preview.edgeTint[2] = clamp01(num("v-edge-b", preview.edgeTint[2]));
  preview.styleShadowStrength = Math.max(0, Math.min(5.0, num("v-shadow-strength", preview.styleShadowStrength ?? 0.88)));
  preview.styleShadowEdge = Math.max(0, Math.min(2.2, num("v-shadow-edge", preview.styleShadowEdge ?? 0.0)));
  preview.styleShadowDarkness = Math.max(0, Math.min(6.0, num("v-shadow-darkness", preview.styleShadowDarkness ?? 0.0)));
  preview.styleColorLift = Math.max(0, Math.min(2.2, num("v-color-lift", preview.styleColorLift ?? 1.12)));
  preview.styleSaturation = Math.max(0, Math.min(2.2, num("v-saturation", preview.styleSaturation ?? 1.10)));
  preview.styleRimStrength = Math.max(0, Math.min(2.2, num("v-rim-strength", preview.styleRimStrength ?? 1.0)));
  preview.styleSunBleed = Math.max(0, Math.min(2.2, num("v-sun-bleed", preview.styleSunBleed ?? 0.85)));
  preview.styleMidLift = Math.max(0, Math.min(2.2, num("v-mid-lift", preview.styleMidLift ?? 1.10)));
  preview.godRaysEnabled = !!$("v-god-rays-enabled")?.checked;
  preview.godRayStrength = Math.max(0, Math.min(3.0, num("v-god-ray-strength", preview.godRayStrength ?? 0.0)));
  preview.godRayLength = Math.max(0.1, Math.min(2.0, num("v-god-ray-length", preview.godRayLength ?? 1.0)));
  preview.godRayFalloff = Math.max(0.2, Math.min(4.0, num("v-god-ray-falloff", preview.godRayFalloff ?? 1.55)));
}

// ---- reproj helpers ----
function computeCoarseFactorFromScale(scale) {
  if (!scale || scale <= 0) return 1;
  return Math.max(1, Math.round(1.0 / Math.sqrt(scale)));
}

function getReprojPayload() {
  const enabled = !!reprojEnabled;
  const temporalCellRate = normalizeTemporalCellRate(preview.temporalCellRate ?? 1);
  const historyEnabled = enabled || temporalCellRate > 1;
  const coarseFactor = currentPreviewCoarseFactor();
  const scale = historyEnabled ? 1 / Math.max(1, coarseFactor * coarseFactor) : reprojDefaultScale;
  return {
    enabled,
    scale,
    coarseFactor,
    frameIndex: 0,
    sampleOffset: 0,
    temporalCellRate,
    temporalCellPhase: 0,
    temporalBlend: currentReprojectionTemporalBlend(historyEnabled),
  };
}

function getFreshReprojPayload() {
  const rp = getReprojPayload();
  rp.frameIndex = 0;
  rp.sampleOffset = 0;
  rp.resetHistory = true;
  rp.temporalBlend = 0.0;
  return rp;
}

function getFreshFullFrameReprojPayload() {
  const rp = getFreshReprojPayload();
  rp.temporalCellRate = 1;
  rp.temporalCellPhase = 0;
  rp.compactInterleave = 0;
  rp.temporalBlend = 0.0;
  return rp;
}

function useFreshFullFrameReproj(payload) {
  if (!payload || !cloudHistoryEnabled()) return payload;
  payload.reproj = getFreshFullFrameReprojPayload();
  payload.coarseFactor = currentPreviewCoarseFactor();
  return payload;
}

function ensureCoarseInPayload(payload) {
  if (!payload) return payload;
  const qCoarse = currentPreviewCoarseFactor();
  if (payload.reproj && typeof payload.reproj.coarseFactor === "number") {
    payload.coarseFactor = qCoarse;
    payload.reproj.coarseFactor = qCoarse;
    payload.reproj.scale = 1;
  } else if (cloudHistoryEnabled()) {
    const rp = getReprojPayload();
    payload.reproj = payload.reproj || rp;
    payload.coarseFactor = qCoarse;
  } else {
    payload.coarseFactor = qCoarse;
  }
  return payload;
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

let _frameRunActive = false;
let _frameRunQueued = null;
let _frameRunRafPending = false;

async function _pumpRunFrameLatest() {
  if (_frameRunActive || _frameRunRafPending) return;
  _frameRunRafPending = true;
  await nextAnimationFrame();
  _frameRunRafPending = false;
  if (_frameRunActive) return;
  _frameRunActive = true;
  try {
    while (_frameRunQueued) {
      const batch = _frameRunQueued;
      _frameRunQueued = null;
      try {
        const res = await rpc("runFrame", batch.payload);
        for (const waiter of batch.waiters) waiter.resolve(res);
      } catch (err) {
        for (const waiter of batch.waiters) waiter.reject(err);
      }
    }
  } finally {
    _frameRunActive = false;
    if (_frameRunQueued) {
      _pumpRunFrameLatest().catch((err) => console.warn("runFrameLatest pump failed", err));
    }
  }
}

function runFrameLatest(payload) {
  return new Promise((resolve, reject) => {
    if (_frameRunQueued) {
      _frameRunQueued.payload = payload;
      _frameRunQueued.waiters.push({ resolve, reject });
      if (_frameRunQueued.waiters.length > 64) {
        const dropped = _frameRunQueued.waiters.splice(0, _frameRunQueued.waiters.length - 64);
        for (const waiter of dropped) waiter.resolve({ skipped: true, coalesced: true });
      }
    } else {
      _frameRunQueued = { payload, waiters: [{ resolve, reject }] };
    }
    _pumpRunFrameLatest().catch((err) => console.warn("runFrameLatest failed", err));
  });
}

let _liveAnimationUpdateTimer = 0;
let _liveAnimationUpdateInFlight = false;
let _liveAnimationUpdateQueued = false;
let _liveAnimationUpdateSeq = 0;

function buildLiveAnimationPayload(options = {}) {
  const cloudParams = readCloudParams();
  const tuning = readTuning();
  const rp = getReprojPayload();
  rp.resetHistory = false;
  rp.coarseFactor = currentPreviewCoarseFactor();
  rp.scale = 1 / Math.max(1, rp.coarseFactor * rp.coarseFactor);

  const payload = {
    preview: safeClone(preview),
    cloudParams,
    tuning,
    reproj: rp,
    seq: ++_liveAnimationUpdateSeq,
  };

  if (options.includeTransforms) {
    payload.tileTransforms = Object.assign(safeClone(tileTransforms), { explicit: true });
  }

  return payload;
}

let _liveAnimationUpdateIncludeTransforms = false;

function queueLiveAnimationUpdate(delayMs = 90, options = {}) {
  if (!animRunning) return false;
  _liveAnimationUpdateQueued = true;
  _liveAnimationUpdateIncludeTransforms = _liveAnimationUpdateIncludeTransforms || !!options.includeTransforms;
  if (_liveAnimationUpdateTimer) clearTimeout(_liveAnimationUpdateTimer);
  _liveAnimationUpdateTimer = setTimeout(() => {
    _liveAnimationUpdateTimer = 0;
    flushLiveAnimationUpdate().catch((err) => console.warn("live animation update failed", err));
  }, delayMs);
  return true;
}

async function flushLiveAnimationUpdate() {
  if (!animRunning) return;
  if (_liveAnimationUpdateInFlight) {
    _liveAnimationUpdateQueued = true;
    return;
  }
  _liveAnimationUpdateInFlight = true;
  try {
    do {
      _liveAnimationUpdateQueued = false;
      const includeTransforms = _liveAnimationUpdateIncludeTransforms;
      _liveAnimationUpdateIncludeTransforms = false;
      const payload = buildLiveAnimationPayload({ includeTransforms });
      await rpc("setLiveFrameState", payload);
      lastTuningSent = cloneTuning(payload.tuning);
    } while (_liveAnimationUpdateQueued && animRunning);
  } finally {
    _liveAnimationUpdateInFlight = false;
    if (_liveAnimationUpdateQueued && animRunning) {
      queueLiveAnimationUpdate(40);
    }
  }
}

// ---- UI wiring helpers ----
function debounce(fn, delayMs = 80) {
  let timer = 0;
  const wrapped = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = 0;
      fn(...args);
    }, delayMs);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = 0;
  };
  return wrapped;
}

function debounceAsync(fn, delayMs = 90) {
  let timer = 0;
  let running = false;
  let rerun = false;
  let lastArgs = [];

  const run = async () => {
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    try {
      do {
        rerun = false;
        await fn(...lastArgs);
      } while (rerun);
    } finally {
      running = false;
    }
  };

  const wrapped = (...args) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = 0;
      run().catch((err) => console.warn("debounced UI task failed", err));
    }, delayMs);
  };

  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = 0;
  };

  wrapped.flush = (...args) => {
    lastArgs = args;
    wrapped.cancel();
    return run();
  };

  return wrapped;
}

function attachByIds(ids, handler, opts = {}) {
  const delayMs = opts.delayMs ?? 90;
  const onInput = debounceAsync(handler, delayMs);
  const onChange = (ev) => {
    onInput.flush(ev).catch((err) => console.warn("UI change handler failed", err));
  };

  for (const id of ids) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener("input", onInput);
    el.addEventListener("change", onChange);
  }
}

function attachPanelInputs(panel, handler, delayMs = 90) {
  if (!panel) return;
  const onInput = debounceAsync(handler, delayMs);
  const onChange = (ev) => {
    onInput.flush(ev).catch((err) => console.warn("panel change handler failed", err));
  };
  panel.querySelectorAll("input,select,textarea").forEach((inp) => {
    inp.addEventListener("input", onInput);
    inp.addEventListener("change", onChange);
  });
}

function attachTuningInputs() {
  const inputs = Array.from(
    document.querySelectorAll(
      'input[id^="t-"], select[id^="t-"], textarea[id^="t-"]',
    ),
  );
  if (!inputs.length) return;
  const sendDebounced = debounce(() => {
    if (animRunning) {
      readPreview();
      queueLiveAnimationUpdate(80);
      return;
    }
    sendTuningIfChanged();
  }, 100);
  inputs.forEach((inp) => {
    inp.addEventListener("input", sendDebounced);
    inp.addEventListener("change", () => {
      sendDebounced.cancel();
      if (animRunning) {
        readPreview();
        queueLiveAnimationUpdate(40);
        return;
      }
      sendTuningIfChanged();
    });
  });
}

const _latestBakeJobs = new Map();
let _latestBakePumpActive = false;

function latestBakeKey(bakeRpcType) {
  return String(bakeRpcType || "bake");
}

function runAfterBakeAndTuning(
  bakeRpcType,
  bakePayload = {},
  extraPayload = {},
) {
  return new Promise((resolve, reject) => {
    const key = latestBakeKey(bakeRpcType);
    const existing = _latestBakeJobs.get(key);
    if (existing) existing.resolve({ skipped: true, replaced: true });
    _latestBakeJobs.set(key, {
      key,
      bakeRpcType,
      bakePayload: safeClone(bakePayload),
      extraPayload: safeClone(extraPayload || {}),
      resolve,
      reject,
    });
    pumpLatestBakeJobs().catch((err) => console.warn("latest bake pump failed", err));
  });
}

async function pumpLatestBakeJobs() {
  if (_latestBakePumpActive) return;
  _latestBakePumpActive = true;
  setBusy(true, "Baking...");
  try {
    while (_latestBakeJobs.size) {
      const [key, job] = _latestBakeJobs.entries().next().value;
      _latestBakeJobs.delete(key);
      try {
        await runBakeJobAndFrame(job);
        job.resolve({ ok: true });
      } catch (err) {
        job.reject(err);
      }
      await nextAnimationFrame();
    }
  } finally {
    _latestBakePumpActive = false;
    setBusy(false);
    if (_latestBakeJobs.size) {
      pumpLatestBakeJobs().catch((err) => console.warn("latest bake pump failed", err));
    }
  }
}

async function runBakeJobAndFrame(job) {
  await rpc(job.bakeRpcType, safeClone(job.bakePayload));
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
    job.extraPayload || {},
  );

  useFreshFullFrameReproj(payload);
  ensureCoarseInPayload(payload);
  await runFrameLatest(payload);
}


async function runFrameEnsuringTuning(payload = {}) {
  await sendTuningNow();
  ensureCoarseInPayload(payload);
  return runFrameLatest(payload);
}

// ---- UI busy indicator ----
function nextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function setBusy(on, msg = "Working...") {
  const ov = $("busyOverlay"),
    m = $("busyMsg");
  if (!ov) return;
  if (m) m.textContent = msg;
  ov.style.display = on ? "flex" : "none";
  const status = $("cloud-quick-status");
  if (status) {
    status.dataset.manual = on ? "true" : "false";
    if (on) status.textContent = msg;
    else updateCloudQuickDockState();
  }

  [
    "bake-weather",
    "bake-blue",
    "bake-shape128",
    "bake-detail32",
    "rebake-all",
    "render",
    "reproj-anim-toggle",
    "quick-render-button",
    "quick-rebake-button",
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
  const value = currentSlice();
  const s = $("sliceLabel");
  if (s) s.textContent = String(value);
}

async function refreshDebugPreviews(kind = "all") {
  if (!worker || !STARTUP_PROFILE.debugCanvases) return;
  await rpc("refreshDebug", { kind });
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

  organizeDebugTexturePreviews();
  removeLegacySliceArtifacts(document);
  const textureMenu = $("cloud-texture-preview-menu");
  if (textureMenu) textureMenu.style.display = "";

  updateCloudQuickDockState();
  if (STARTUP_PROFILE.debugCanvases) refreshDebugPreviewsSoon();
}


function clampCanvasPixelSize(pixelW, pixelH) {
  let w = Math.max(1, Math.floor(pixelW));
  let h = Math.max(1, Math.floor(pixelH));
  if (!STARTUP_PROFILE.capMainCanvas) {
    return { width: w, height: h, scale: 1 };
  }

  const maxSide = Math.max(256, STARTUP_PROFILE.maxMainSide | 0);
  const maxPixels = Math.max(256 * 256, STARTUP_PROFILE.maxMainPixels | 0);
  const sideScale = Math.min(1, maxSide / Math.max(w, h));
  const pixelScale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, w * h)));
  const scale = Math.min(sideScale, pixelScale);
  if (scale < 1) {
    w = Math.max(1, Math.floor(w * scale));
    h = Math.max(1, Math.floor(h * scale));
  }
  return { width: w, height: h, scale };
}

let _resizeInFlight = false;
let _resizeQueuedPayload = null;
let _resizeQueuedSig = "";
let _resizeLastSentSig = "";
let _resizeRafPending = false;
let _resizeSerial = 0;

function resizePayloadSignature(payload) {
  const main = payload?.main || {};
  const dbg = payload?.dbg || {};
  const profile = payload?.profile || {};
  return [
    main.width | 0,
    main.height | 0,
    dbg.width | 0,
    dbg.height | 0,
    Number(profile.dpr || 0).toFixed(4),
    profile.cssWidth | 0,
    profile.cssHeight | 0,
  ].join("x");
}

function scheduleResizeFlush() {
  if (_resizeRafPending) return;
  _resizeRafPending = true;
  requestAnimationFrame(() => {
    _resizeRafPending = false;
    flushQueuedResize().catch((e) => console.warn("resize rpc failed", e));
  });
}

async function flushQueuedResize() {
  if (_resizeInFlight || !_resizeQueuedPayload) return;

  const payload = _resizeQueuedPayload;
  const sig = _resizeQueuedSig;
  _resizeQueuedPayload = null;
  _resizeQueuedSig = "";

  if (sig === _resizeLastSentSig) return;

  _resizeInFlight = true;
  try {
    await rpc("resize", payload);
    _resizeLastSentSig = sig;
  } finally {
    _resizeInFlight = false;
    if (_resizeQueuedPayload && _resizeQueuedSig !== _resizeLastSentSig) {
      scheduleResizeFlush();
    }
  }
}

function queueResizePayload(payload) {
  const sig = resizePayloadSignature(payload);
  if (sig === _resizeLastSentSig && !_resizeInFlight) return;
  _resizeQueuedPayload = Object.assign({}, payload, { serial: ++_resizeSerial });
  _resizeQueuedSig = sig;
  scheduleResizeFlush();
}

function sendSizes() {
  const dpr = DPR();
  const canvas = $("gpuCanvas");
  if (!canvas) return;
  const cW = Math.max(1, Math.round(canvas.clientWidth));
  const cH = Math.max(1, Math.round(canvas.clientHeight));
  const main = clampCanvasPixelSize(cW * dpr, cH * dpr);
  const dbgSizePx = Math.max(1, Math.round(DBG_SIZE * dpr));

  queueResizePayload({
    main,
    dbg: { width: dbgSizePx, height: dbgSizePx },
    profile: { mobile: MOBILE_PROFILE, dpr, cssWidth: cW, cssHeight: cH },
  });
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

  $("v-layer-preset")?.addEventListener("change", async () => {
    const key = $("v-layer-preset")?.value || "custom";
    try {
      await applyCloudLayerPreset(key, true);
    } catch (err) {
      console.warn("cloud layer preset failed", err);
    }
  });

  $("v-grade")?.addEventListener("change", () => {
    const style = u32("v-grade", preview.gradeStyle);
    applyGradePreset(style, true);
  });

  const reprojBtn = $("reproj-anim-toggle");
  const fpsSpan = $("fpsDisplay");

  reprojEnabled = false;
  animRunning = false;
  if (reprojBtn) reprojBtn.textContent = "Start Reproject Anim";
  if (fpsSpan) fpsSpan.textContent = "-";

  reprojBtn?.addEventListener("click", async () => {
    if (!animRunning) {
      reprojEnabled = true;
      const rp = getFreshReprojPayload();
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
        payload.skipFinalDebug = true;
        await runFrameLatest(payload);
        const loopReproj = getReprojPayload();
        await rpc("setReproj", { reproj: loopReproj, perf: null });
        await rpc("startLoop", {});
        animRunning = true;
        startVisualFpsTicker();
        if (reprojBtn) reprojBtn.textContent = "Stop Reproject Anim";
      } catch (e) {
        console.warn("start animation failed", e);
        reprojEnabled = false;
        animRunning = false;
        stopVisualFpsTicker();
        try {
          await rpc("setReproj", {
            reproj: {
              enabled: false,
              scale: reprojDefaultScale,
              coarseFactor: currentPreviewCoarseFactor(),
            },
            perf: null,
          });
        } catch {}
        if (reprojBtn) reprojBtn.textContent = "Start Reproject Anim";
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
      stopVisualFpsTicker();
      reprojEnabled = false;
      try {
        await rpc("setReproj", {
          reproj: {
            enabled: false,
            scale: reprojDefaultScale,
            coarseFactor: currentPreviewCoarseFactor(),
          },
          perf: null,
        });
      } catch (e) {
        console.warn("Failed unset reproj", e);
      }
      if (reprojBtn) reprojBtn.textContent = "Start Reproject Anim";
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

      useFreshFullFrameReproj(payload);
      ensureCoarseInPayload(payload);

      payload.waitForGpu = true;
      payload.logFrame = true;
      const { timings } = await rpc("runFrame", payload);
      console.log(
        timings.waitedForGpu ? "[BENCH waited] compute(ms):" : "[BENCH submitted] compute(ms):",
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
      "we-bias",
      "we-pos-x",
      "we-pos-y",
      "we-pos-z",
      "we-vel-x",
      "we-vel-y",
      "we-vel-z",
      "we-axis-x",
      "we-axis-y",
      "we-axis-z",
    ],
    async () => {
      try {
        readWeatherTransform();
        if (queueLiveAnimationUpdate(80, { includeTransforms: true })) return;
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
        useFreshFullFrameReproj(payload);
        ensureCoarseInPayload(payload);
        payload.skipFinalDebug = true;
        await runFrameLatest(payload);
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
      "sh-bias",
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
        if (queueLiveAnimationUpdate(80, { includeTransforms: true })) return;
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
        useFreshFullFrameReproj(payload);
        ensureCoarseInPayload(payload);
        payload.skipFinalDebug = true;
        await runFrameLatest(payload);
      } catch (e) {
        console.warn("shape transform update failed", e);
      }
    },
  );

  attachByIds(
    [
      "de-scale",
      "de-bias",
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
        if (queueLiveAnimationUpdate(80, { includeTransforms: true })) return;
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
        useFreshFullFrameReproj(payload);
        ensureCoarseInPayload(payload);
        payload.skipFinalDebug = true;
        await runFrameLatest(payload);
      } catch (e) {
        console.warn("detail transform update failed", e);
      }
    },
  );

  // cloud params panel: debounce high-frequency sliders and run one latest frame.
  attachPanelInputs($("p-cloudParams"), async () => {
    readPreview();
    const cloudParams = readCloudParams();
    const tuning = readTuning();
    if (queueLiveAnimationUpdate(80)) return;
    const payload = {
      weatherParams: safeClone(weatherParams),
      billowParams: safeClone(billowParams),
      weatherBParams: safeClone(weatherBParams),
      shapeParams: safeClone(shapeParams),
      detailParams: safeClone(detailParams),
      tileTransforms: safeClone(tileTransforms),
      preview: safeClone(preview),
      cloudParams,
      tuning,
    };
    useFreshFullFrameReproj(payload);
    ensureCoarseInPayload(payload);
    payload.skipFinalDebug = true;
    try {
      await runFrameLatest(payload);
      lastTuningSent = cloneTuning(tuning);
    } catch (e) {
      console.warn("runFrame failed (cloudParams)", e);
    }
  }, 70);

  // preview panel: debounce camera/light edits and avoid a separate tuning RPC.
  attachPanelInputs($("p-preview"), async (ev) => {
    if (ev?.target?.id === "v-layer-preset") return;
    readPreview();
    const cloudParams = readCloudParams();
    const tuning = readTuning();
    if (queueLiveAnimationUpdate(80)) return;
    const payload = {
      weatherParams: safeClone(weatherParams),
      billowParams: safeClone(billowParams),
      weatherBParams: safeClone(weatherBParams),
      shapeParams: safeClone(shapeParams),
      detailParams: safeClone(detailParams),
      tileTransforms: safeClone(tileTransforms),
      preview: safeClone(preview),
      cloudParams,
      tuning,
    };
    useFreshFullFrameReproj(payload);
    ensureCoarseInPayload(payload);
    payload.skipFinalDebug = true;
    try {
      await runFrameLatest(payload);
      if (cloudHistoryEnabled()) {
        const rp = getReprojPayload();
        await rpc("setReproj", { reproj: rp, perf: null });
      }
      lastTuningSent = cloneTuning(tuning);
    } catch (e) {
      console.warn("runFrame failed (preview)", e);
    }
  }, 55);

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

      useFreshFullFrameReproj(payload);
      ensureCoarseInPayload(payload);
      await runFrameLatest(payload);
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

  const sendSizesDebounced = debounce(() => sendSizes(), 80);
  window.addEventListener("resize", sendSizesDebounced);
  const mainCanvas = $("gpuCanvas");
  if (mainCanvas && typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(() => sendSizesDebounced());
    ro.observe(mainCanvas);
  }
}

let initialBakePromise = null;

function scheduleInitialBakeAndRender() {
  if (initialBakePromise) return initialBakePromise;

  initialBakePromise = (async () => {
    await nextPaint();
    await new Promise((resolve) => setTimeout(resolve, 0));

    setBusy(true, MOBILE_PROFILE ? "Preparing mobile cloud preview..." : "Preparing cloud preview...");
    try {
      refreshSliceLabel();
      readWeather();
      readWeatherG();
      readWeatherB();
      readShape();
      readShapeTransform();
      readDetail();
      readDetailTransform();
      readPreview();

      await rpc("bakeAll", {
        weatherParams: safeClone(weatherParams),
        billowParams: safeClone(billowParams),
        weatherBParams: safeClone(weatherBParams),
        blueParams: safeClone(blueParams),
        shapeParams: safeClone(shapeParams),
        detailParams: safeClone(detailParams),
        tileTransforms: safeClone(tileTransforms),
        progressive: true,
        skipDebug: !!STARTUP_PROFILE.skipStartupDebug,
        skipFinalDebug: false,
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

      useFreshFullFrameReproj(payload);
      ensureCoarseInPayload(payload);

      const { timings } = await rpc("runFrame", payload);
      await refreshDebugPreviews();
      console.log("[BENCH] init frame timings:", timings);
    } catch (err) {
      console.error("initial cloud bake/render failed", err);
      const pre = document.createElement("pre");
      pre.textContent = err && err.stack ? err.stack : String(err);
      document.body.appendChild(pre);
    } finally {
      setBusy(false);
    }
  })();

  return initialBakePromise;
}

// ---- init ----
async function init() {
  mountCloudHtml();
  installCloudUiPolish();
  injectPreviewLookControls();
  addCloudUiClasses();
  createCloudQuickDock();
  installTextureSliceControls();
  organizeCloudPanels();
  removeLegacySliceArtifacts(document);
  organizeSidebarControlGroups();
  applyGradePreset(preview.gradeStyle, false);

  const setIf = (id, val) => {
    const el = $(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!val;
    else el.value = String(val);
  };

  // defaults for numeric fields (modes are populated after worker init)
  setIf("we-seed", weatherParams.seed);
  setIf("we-zoom", 4.0);
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
  setIf("we-billow-zoom", 4.0);
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
  setIf("we-bias", tileTransforms.weatherBias ?? 0.3);
  setIf("we-pos-x", tileTransforms.weatherOffset[0]);
  setIf("we-pos-y", tileTransforms.weatherOffset[1]);
  setIf("we-pos-z", tileTransforms.weatherOffset[2]);
  setIf("we-vel-x", tileTransforms.weatherVel?.[0] ?? 0.01);
  setIf("we-vel-y", tileTransforms.weatherVel?.[1] ?? 0);
  setIf("we-vel-z", tileTransforms.weatherVel?.[2] ?? 0);
  setIf("we-axis-x", tileTransforms.weatherAxisScale[0]);
  setIf("we-axis-y", tileTransforms.weatherAxisScale[1]);
  setIf("we-axis-z", tileTransforms.weatherAxisScale[2]);

  setIf("sh-axis-x", tileTransforms.shapeAxisScale[0]);
  setIf("sh-axis-y", tileTransforms.shapeAxisScale[1]);
  setIf("sh-axis-z", tileTransforms.shapeAxisScale[2]);

  setIf("de-axis-x", tileTransforms.detailAxisScale[0]);
  setIf("de-axis-y", tileTransforms.detailAxisScale[1]);
  setIf("de-axis-z", tileTransforms.detailAxisScale[2]);

  setIf("we-bandb-enable", false);
  setIf("we-bandb-seed", weatherBParams.seed);
  setIf("we-bandb-zoom", 4.0);
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
  setIf("sh-bias", tileTransforms.shapeBias ?? 0.4);
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
  setIf("de-bias", tileTransforms.detailBias ?? 0.0);
  setIf("de-pos-x", tileTransforms.detailOffset[0]);
  setIf("de-pos-y", tileTransforms.detailOffset[1]);
  setIf("de-pos-z", tileTransforms.detailOffset[2]);
  setIf("de-vel-x", tileTransforms.detailVel[0] ?? 0.03);
  setIf("de-vel-y", tileTransforms.detailVel[1]);
  setIf("de-vel-z", tileTransforms.detailVel[2]);

  // cloud params & tuning defaults
  setIf("c-az", preview.sun.azDeg);
  setIf("c-el", preview.sun.elDeg);
  setIf("c-bloom", preview.sun.bloom);

  setIf("p-coverage", 1.0);
  setIf("p-density", 10.0);
  setIf("p-beer", 6);
  setIf("p-clamp", 0.015);
  setIf("p-ins", 1.0);
  setIf("p-outs", 0.1);
  setIf("p-ivo", 0.5);
  setIf("p-sI", 12.0);
  setIf("p-sE", 12.0);
  setIf("p-ambOut", 0.08);
  setIf("p-ambMin", 0.045);
  setIf("p-anvil", 0.5);

  setIf("t-maxSteps", 256);
  setIf("t-minStep", 0.003);
  setIf("t-maxStep", 0.16);
  setIf("t-sunSteps", 4);
  setIf("t-sunStride", 4);
  setIf("t-phaseJitter", 1.0);
  setIf("t-stepJitter", 0.3);
  setIf("t-baseJitter", 0.02);
  setIf("t-topJitter", 0.1);
  setIf("t-lodBiasWeather", 1.5);
  setIf("t-lodBlendThreshold", 0.46);
  setIf("t-nearFluffDist", 60);
  setIf("t-nearDensityMult", 2.5);
  setIf("t-farStart", 1.05);
  setIf("t-farFull", 4.2);
  setIf("t-farStepMult", 2.05);
  setIf("t-raySmoothDens", 0.40);
  setIf("t-raySmoothSun", 0.40);
  setIf("t-fluffFactor", 2.0);
  setIf("t-anvilLift", 0.6);
  setIf("t-alphaCutoff", 0.98);
  setIf("t-verticalStepBoost", 3.0);
  setIf("t-verticalTextureHomogeneity", 0.0);
  setIf("t-verticalLightingStepBoost", 1.35);
  setIf("t-frontOcclusionStrength", 0.82);
  setIf("t-frontOcclusionAlpha", 0.58);
  setIf("t-frontOcclusionStepBoost", 3.6);
  setIf("t-sliceJitterStrength", 0.08);
  setIf("t-verticalLayerDecorrelation", 0.35);
  setIf("t-directLightBlend", preview.directLightBlend ?? 0.78);
  setIf("t-directLightBoost", preview.directLightBoost ?? 0.58);
  setIf("t-alphaBoostThreshold", 0.22);
  setIf("t-alphaBoostAmount", 0.16);
  setIf("t-minOutputAlpha", 0.05);

  const anvilInput = $("p-anvil");
  if (anvilInput) {
    anvilInput.removeAttribute("max");
    anvilInput.min = "0";
    anvilInput.step = "0.01";
    anvilInput.title = "Single cloud anvil/cumulonimbus amount. Higher values continue to overdrive tower height and cap spread.";
  }

  const anvilLiftInput = $("t-anvilLift");
  if (anvilLiftInput) {
    anvilLiftInput.disabled = true;
    const wrap = anvilLiftInput.closest("label") || anvilLiftInput.parentElement;
    if (wrap) wrap.style.display = "none";
  }

  syncPreviewLookInputs();

  // preview
  setIf("v-cx", preview.cam.x);
  setIf("v-cy", preview.cam.y);
  setIf("v-cz", preview.cam.z);
  setIf("v-fov", preview.cam.fovYDeg);
  setIf("v-yaw", preview.cam.yawDeg);
  setIf("v-pitch", preview.cam.pitchDeg);
  setIf("v-exposure", preview.exposure);
  setIf("v-box-cx", preview.box.center[0]);
  setIf("v-box-cy", preview.box.center[1]);
  setIf("v-box-cz", preview.box.center[2]);
  setIf("v-box-hx", preview.box.half[0]);
  setIf("v-box-hy", preview.box.half[1]);
  setIf("v-box-hz", preview.box.half[2]);
  setIf("v-box-uv", preview.box.uvScale);
  setIf("v-temporal-cell-rate", normalizeTemporalCellRate(preview.temporalCellRate ?? 1));
  syncPreviewLookInputs();

  setBusy(true, MOBILE_PROFILE ? "Starting mobile WebGPU worker..." : "Starting WebGPU worker...");
  await nextPaint();

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
    if (type === "progress") {
      const msg = data?.message || data || "Working...";
      const status = $("cloud-quick-status");
      if (status) {
        status.dataset.manual = "true";
        status.textContent = msg;
      }
      const ov = $("busyOverlay");
      if (ov && ov.style.display !== "none") setBusy(true, msg);
    }
    if (type === "frame") {
      if (!animRunning) {
        const info = data || {};
        const fmt = (v) => (Number.isFinite(v) ? String(Math.round(v * 10) / 10) : "-");
        const fpsEl = $("fpsDisplay");
        if (fpsEl) {
          const loop = fmt(info.loopFps ?? info.fps);
          fpsEl.textContent = `${loop} fps`;
        }
        updateCloudQuickDockState();
      }
    }
    if (type === "loop-stopped") {
      animRunning = false;
      stopVisualFpsTicker();
      const btn = $("reproj-anim-toggle");
      if (btn) btn.textContent = "Start Reproject Anim";
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
      constants: {
        SHAPE_SIZE,
        DETAIL_SIZE,
        WEATHER_W,
        WEATHER_H,
        BN_W,
        BN_H,
        DEBUG_ENABLED: STARTUP_PROFILE.debugCanvases,
        MOBILE_PROFILE,
      },
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

  if (preview.layerPreset && preview.layerPreset !== "custom") {
    applyCloudLayerPresetValues(preview.layerPreset);
    readWeather();
    readWeatherG();
    readWeatherB();
    readShape();
    readShapeTransform();
    readDetail();
    readDetailTransform();
    readPreview();
  }

  sendSizes();
  await nextPaint();
  await flushQueuedResize();

  try {
    await setTileTransformsRPC(tileTransforms);
  } catch {}

  await wireUI();
  removeLegacySliceArtifacts(document);
  populateCloudQuickDock();
  wireCloudQuickDock();
  updateCloudQuickDockState();
  refreshSliceLabel();
  setBusy(false);
  scheduleInitialBakeAndRender();
}

// start
init().catch((err) => {
  console.error(err);
  const pre = document.createElement("pre");
  pre.textContent = err && err.stack ? err.stack : String(err);
  document.body.appendChild(pre);
});
