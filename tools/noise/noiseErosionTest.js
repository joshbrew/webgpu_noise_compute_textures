import { NoiseComputeBuilder } from "./noiseCompute.js";

const APP_HTML = `
<div id="erosion-demo-app">
  <style>
    :root {
      color-scheme: dark;
      --bg: #050505;
      --panel: #111;
      --border: #2a2a2a;
      --text: #f3f3f3;
      --muted: #a8a8a8;
      --accent: #58b6ff;
      --accent2: #2575fc;
      --radius: 12px;
      --sidebar-w: 390px;
      --gap: 16px;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      min-height: 100%;
      background: #000;
      color: var(--text);
      font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    #erosion-demo-app {
      min-height: 100dvh;
      display: grid;
      grid-template-columns: var(--sidebar-w) 1fr;
      gap: var(--gap);
      padding: var(--gap);
      background: #000;
    }

    #erosion-sidebar {
      background: radial-gradient(circle at top left, #171717 0, #090909 55%, #020202 100%);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      overflow: auto;
      max-height: calc(100dvh - (var(--gap) * 2));
    }

    #erosion-main {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .panel {
      background: radial-gradient(circle at top left, #181818 0, #0c0c0c 60%, #050505 100%);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px;
    }

    .title {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.02em;
      margin-bottom: 4px;
    }

    .subtitle {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.35;
      margin-bottom: 14px;
    }

    details.group {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.02);
      margin-bottom: 12px;
      overflow: hidden;
    }

    details.group > summary {
      list-style: none;
      cursor: pointer;
      padding: 11px 12px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      border-bottom: 1px solid var(--border);
      user-select: none;
    }

    details.group[open] > summary {
      background: rgba(88, 182, 255, 0.08);
    }

    details.group > summary::-webkit-details-marker {
      display: none;
    }

    .group-body {
      padding: 12px;
    }

    .field {
      display: grid;
      grid-template-columns: 1fr 120px;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    }

    .field label,
    .stack-label {
      font-size: 13px;
      color: #e9e9e9;
    }

    .field input[type="number"],
    .field select {
      width: 100%;
      background: #0c0c0c;
      color: #fff;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 6px 8px;
      font-size: 13px;
    }

    .field input[type="checkbox"] {
      justify-self: end;
      transform: translateY(1px);
    }

    .mode-list {
      display: grid;
      gap: 6px;
      max-height: 240px;
      overflow: auto;
      padding: 2px 2px 2px 0;
      margin-bottom: 10px;
    }

    .mode-list label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #e8e8e8;
      padding: 4px 0;
    }

    .actions {
      display: grid;
      gap: 10px;
      margin-top: 8px;
    }

    button {
      border: 1px solid var(--accent);
      background: linear-gradient(135deg, var(--accent2), var(--accent));
      color: #000;
      font-weight: 700;
      border-radius: 999px;
      padding: 10px 14px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 12px;
    }

    button:hover {
      filter: brightness(1.06);
    }

    .secondary {
      background: #161616;
      color: #fff;
      border-color: #4a4a4a;
    }

    #preview-meta {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
    }

    #preview-stats {
      font-size: 12px;
      color: var(--muted);
    }

    .preview-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      padding: 2px 4px 0 4px;
    }

    .stage-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(260px, 1fr));
      gap: 14px;
    }

    .stage-card {
      background: radial-gradient(circle at top left, #171717 0, #0b0b0b 65%, #040404 100%);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
    }

    .stage-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #fff;
    }

    .stage-subtitle {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.35;
      min-height: 32px;
    }

    .canvas-wrap {
      aspect-ratio: 1 / 1;
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      background: #000;
      box-shadow: 0 10px 22px rgba(0, 0, 0, 0.35);
    }

    .stage-canvas {
      display: block;
      width: 100%;
      height: 100%;
      background: #000;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }

    .hint {
      margin-top: 8px;
      font-size: 12px;
      line-height: 1.45;
      color: var(--muted);
    }

    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    @media (max-width: 1400px) {
      .stage-grid {
        grid-template-columns: repeat(2, minmax(260px, 1fr));
      }
    }

    @media (max-width: 1200px) {
      #erosion-demo-app {
        grid-template-columns: 1fr;
      }

      #erosion-sidebar {
        max-height: none;
      }

      .stage-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>

  <aside id="erosion-sidebar">
    <div class="title">Hydrology Erosion Stages</div>
    <div class="subtitle">
      Primitive base layers first, guide field second, erosion third, then drainage,
      final composite, and a 3D terrain preview.
    </div>

    <details class="group" open>
      <summary>Resolution</summary>
      <div class="group-body">
        <div class="field">
          <label for="res-size">Output size</label>
          <input id="res-size" type="number" min="128" step="64" value="1024" />
        </div>

        <div class="field">
          <label for="export-bg">Export background</label>
          <select id="export-bg">
            <option value="transparent" selected>Transparent</option>
            <option value="black">Black</option>
            <option value="white">White</option>
          </select>
        </div>
      </div>
    </details>

    <details class="group" open>
      <summary>Base stack</summary>
      <div class="group-body">
        <div class="stack-label">Base modes</div>
        <div id="base-mode-list" class="mode-list"></div>

        <div class="field">
          <label for="base-seed">Base seed</label>
          <input id="base-seed" type="number" step="1" value="123456789" />
        </div>

        <div class="field">
          <label for="base-zoom">Zoom</label>
          <input id="base-zoom" type="number" step="0.01" value="1.0" />
        </div>

        <div class="field">
          <label for="base-freq">Frequency</label>
          <input id="base-freq" type="number" step="0.01" value="3.0" />
        </div>

        <div class="field">
          <label for="base-octaves">Octaves</label>
          <input id="base-octaves" type="number" min="1" step="1" value="3" />
        </div>

        <div class="field">
          <label for="base-lacunarity">Lacunarity</label>
          <input id="base-lacunarity" type="number" step="0.01" value="2.0" />
        </div>

        <div class="field">
          <label for="base-gain">Gain</label>
          <input id="base-gain" type="number" step="0.01" value="0.10" />
        </div>

        <div class="two-col">
          <div class="field">
            <label for="base-xShift">X shift</label>
            <input id="base-xShift" type="number" step="0.01" value="0.0" />
          </div>
          <div class="field">
            <label for="base-yShift">Y shift</label>
            <input id="base-yShift" type="number" step="0.01" value="0.0" />
          </div>
        </div>

        <div class="field">
          <label for="base-zShift">Z shift</label>
          <input id="base-zShift" type="number" step="0.01" value="0.0" />
        </div>

        <div class="field">
          <label for="base-threshold">Threshold</label>
          <input id="base-threshold" type="number" step="0.01" value="0.10" />
        </div>

        <div class="field">
          <label for="base-edgeK">EdgeK</label>
          <input id="base-edgeK" type="number" step="0.01" value="0.0" />
        </div>

        <div class="field">
          <label for="base-voroMode">Voronoi mode</label>
          <select id="base-voroMode">
            <option value="0" selected>Cell</option>
            <option value="1">F1</option>
            <option value="2">Interior</option>
            <option value="3">Edges</option>
            <option value="4">Edge threshold</option>
            <option value="5">Flat cells</option>
            <option value="6">Flat edges</option>
          </select>
        </div>

        <div class="field">
          <label for="base-warpAmp">Warp amp</label>
          <input id="base-warpAmp" type="number" step="0.01" value="0.5" />
        </div>

        <div class="field">
          <label for="base-gaborRadius">Gabor radius</label>
          <input id="base-gaborRadius" type="number" step="0.01" value="4.0" />
        </div>

        <div class="field">
          <label for="base-turbulence">Turbulence</label>
          <input id="base-turbulence" type="checkbox" />
        </div>
      </div>
    </details>

    <details class="group" open>
  <summary>Guide field</summary>
  <div class="group-body">
    <div class="field">
      <label for="guide-enabled">Enable guide smoothing</label>
      <input id="guide-enabled" type="checkbox" checked />
    </div>

    <div class="field">
      <label for="guide-blend">Guide blend</label>
      <input id="guide-blend" type="number" step="0.01" value="0.85" />
    </div>

    <div class="field">
      <label for="guide-sigma">Guide sigma</label>
      <input id="guide-sigma" type="number" step="0.01" value="1.15" />
    </div>
  </div>
</details>

<details class="group" open>
  <summary>Erosion pass</summary>
  <div class="group-body">
    <div class="field">
      <label for="erosion-enabled">Enable erosion</label>
      <input id="erosion-enabled" type="checkbox" checked />
    </div>

    <div class="field">
      <label for="erosion-seed">Erosion seed</label>
      <input id="erosion-seed" type="number" step="1" value="246813579" />
    </div>

    <div class="field">
      <label for="erosion-scale">Erosion scale</label>
      <input id="erosion-scale" type="number" step="0.01" value="0.18" />
    </div>

    <div class="field">
      <label for="erosion-domainScale">Domain scale</label>
      <input id="erosion-domainScale" type="number" step="0.01" value="0.85" />
    </div>

    <div class="field">
      <label for="erosion-strength">Strength</label>
      <input id="erosion-strength" type="number" step="0.01" value="1.10" />
    </div>

    <div class="field">
      <label for="erosion-gullyWeight">Gully weight</label>
      <input id="erosion-gullyWeight" type="number" step="0.01" value="0.50" />
    </div>

    <div class="field">
      <label for="erosion-detail">Detail</label>
      <input id="erosion-detail" type="number" step="0.01" value="1.35" />
    </div>

    <div class="field">
      <label for="erosion-octaves">Octaves</label>
      <input id="erosion-octaves" type="number" min="1" step="1" value="4" />
    </div>

    <div class="field">
      <label for="erosion-lacunarity">Lacunarity</label>
      <input id="erosion-lacunarity" type="number" step="0.01" value="1.90" />
    </div>

    <div class="field">
      <label for="erosion-gain">Gain</label>
      <input id="erosion-gain" type="number" step="0.01" value="0.55" />
    </div>

    <div class="field">
      <label for="erosion-fadeScale">Fade scale</label>
      <input id="erosion-fadeScale" type="number" step="0.01" value="1.6666667" />
    </div>

    <div class="field">
      <label for="erosion-heightBias">Height bias</label>
      <input id="erosion-heightBias" type="number" step="0.01" value="0.0" />
    </div>

    <div class="field">
      <label for="erosion-cellScale">Cell scale</label>
      <input id="erosion-cellScale" type="number" step="0.01" value="0.90" />
    </div>

    <div class="field">
      <label for="erosion-normalization">Normalization</label>
      <input id="erosion-normalization" type="number" step="0.01" value="0.45" />
    </div>

    <div class="field">
      <label for="erosion-assumedSlopeValue">Assumed slope</label>
      <input id="erosion-assumedSlopeValue" type="number" step="0.01" value="0.70" />
    </div>

    <div class="field">
      <label for="erosion-assumedSlopeMix">Assumed slope mix</label>
      <input id="erosion-assumedSlopeMix" type="number" step="0.01" value="1.0" />
    </div>

    <div class="field">
      <label for="erosion-onsetScale">Onset scale</label>
      <input id="erosion-onsetScale" type="number" step="0.01" value="8.0" />
    </div>

    <div class="field">
      <label for="erosion-constOffset">Const offset</label>
      <input id="erosion-constOffset" type="number" step="0.01" value="-0.65" />
    </div>

    <div class="field">
      <label for="erosion-followFadeOffset">Follow fade offset</label>
      <input id="erosion-followFadeOffset" type="number" step="0.01" value="0.0" />
    </div>

    <div class="two-col">
      <div class="field">
        <label for="erosion-xShift">X shift</label>
        <input id="erosion-xShift" type="number" step="0.01" value="0.0" />
      </div>
      <div class="field">
        <label for="erosion-yShift">Y shift</label>
        <input id="erosion-yShift" type="number" step="0.01" value="0.0" />
      </div>
    </div>

    <div class="field">
      <label for="erosion-time">Time</label>
      <input id="erosion-time" type="number" step="0.01" value="0.0" />
    </div>
  </div>
</details>

<details class="group" open>
  <summary>Drainage extraction</summary>
  <div class="group-body">
    <div class="field">
      <label for="drainage-width">Width</label>
      <input id="drainage-width" type="number" step="0.01" value="0.18" />
    </div>

    <div class="field">
      <label for="drainage-concavity">Concavity gain</label>
      <input id="drainage-concavity" type="number" step="0.01" value="3.0" />
    </div>

    <div class="field">
      <label for="drainage-slopeOnset">Slope onset</label>
      <input id="drainage-slopeOnset" type="number" step="0.01" value="0.25" />
    </div>

    <div class="field">
      <label for="drainage-contrast">Contrast</label>
      <input id="drainage-contrast" type="number" step="0.01" value="0.25" />
    </div>

    <div class="field">
      <label for="drainage-gain">Gain</label>
      <input id="drainage-gain" type="number" step="0.01" value="0.90" />
    </div>
  </div>
</details>

    <div class="actions">
      <button id="render-btn" type="button">Render stages</button>
      <button id="save-btn" type="button" class="secondary">Save final composite</button>
    </div>

    <div class="hint">
      Load order: clear, selected primitive base modes, guide field, erosion, drainage,
      then CPU composite and 3D preview.
    </div>
  </aside>

  <main id="erosion-main">
    <div class="panel">
      <div class="preview-head">
        <div id="preview-meta">Waiting for render</div>
        <div id="preview-stats"></div>
      </div>
    </div>

    <div class="stage-grid">
      <div class="stage-card">
        <div class="stage-title">1. Base field</div>
        <div class="stage-subtitle">Primitive seed terrain before guide smoothing.</div>
        <div class="canvas-wrap">
          <canvas id="stage-base" class="stage-canvas" width="1024" height="1024"></canvas>
        </div>
      </div>

      <div class="stage-card">
        <div class="stage-title">2. Guide field</div>
        <div class="stage-subtitle">Smoothed steering field used for erosion direction.</div>
        <div class="canvas-wrap">
          <canvas id="stage-guide" class="stage-canvas" width="1024" height="1024"></canvas>
        </div>
      </div>

      <div class="stage-card">
        <div class="stage-title">3. Eroded height</div>
        <div class="stage-subtitle">Hydrology erosion applied with guide slope steering.</div>
        <div class="canvas-wrap">
          <canvas id="stage-eroded" class="stage-canvas" width="1024" height="1024"></canvas>
        </div>
      </div>

      <div class="stage-card">
        <div class="stage-title">4. Ridge map</div>
        <div class="stage-subtitle">Ridge and crease structure exported from erosion.</div>
        <div class="canvas-wrap">
          <canvas id="stage-ridge" class="stage-canvas" width="1024" height="1024"></canvas>
        </div>
      </div>

      <div class="stage-card">
        <div class="stage-title">5. Drainage mask</div>
        <div class="stage-subtitle">Downstream drainage extracted from the eroded field.</div>
        <div class="canvas-wrap">
          <canvas id="stage-drainage" class="stage-canvas" width="1024" height="1024"></canvas>
        </div>
      </div>

      <div class="stage-card">
        <div class="stage-title">6. Final composite</div>
        <div class="stage-subtitle">CPU composite of height, ridge structure, and drainage.</div>
        <div class="canvas-wrap">
          <canvas id="stage-final" class="stage-canvas" width="1024" height="1024"></canvas>
        </div>
      </div>

      <div class="stage-card">
        <div class="stage-title">7. 3D terrain preview</div>
        <div class="stage-subtitle">Oblique terrain render from the final eroded heightfield.</div>
        <div class="canvas-wrap">
          <canvas id="stage-3d" class="stage-canvas" width="1024" height="1024"></canvas>
        </div>
      </div>
    </div>
  </main>
</div>
`;

const BASE_MODE_ORDER = [
  "computeRidgedMultifractal",
  "computeRidgedMultifractal2",
  "computeRidgedMultifractal3",
  "computeRidgedMultifractal4",
  "computePerlin",
  "computeBillow",
  "computeLanczosBillow",
  "computeRidge",
  "computeSimplex",
  "computeWorley",
  "computeCellular",
  "computeVoronoiBM1",
  "computeVoronoiBM2",
  "computeVoronoiBM3",
];

const DEFAULT_BASE_SELECTION = new Set(["computeRidgedMultifractal"]);

const LABEL_OVERRIDES = {
  computeRidgedMultifractal: "Ridged MF",
  computeRidgedMultifractal2: "Ridged MF 2",
  computeRidgedMultifractal3: "Ridged MF 3",
  computeRidgedMultifractal4: "Ridged MF 4",
  computePerlin: "Perlin",
  computeBillow: "Billow",
  computeLanczosBillow: "Lanczos Billow",
  computeRidge: "Ridge",
  computeSimplex: "Simplex",
  computeWorley: "Worley",
  computeCellular: "Cellular",
  computeVoronoiBM1: "Voronoi BM1",
  computeVoronoiBM2: "Voronoi BM2",
  computeVoronoiBM3: "Voronoi BM3",
};

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function num(id, fallback) {
  const v = Number($(id).value);
  return Number.isFinite(v) ? v : fallback;
}

function intNum(id, fallback) {
  const v = Math.floor(num(id, fallback));
  return Number.isFinite(v) ? v : fallback;
}

function checked(id) {
  return !!$(id).checked;
}

function selectedValue(id, fallback = "") {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const v = String(el.value ?? "");
  return v || fallback;
}

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

function makeLabel(entryPoint) {
  return LABEL_OVERRIDES[entryPoint] || entryPoint.replace(/^compute/, "");
}

function insertAppHtml() {
  document.body.insertAdjacentHTML("afterbegin", APP_HTML);
}

function populateBaseModeList(entryPoints) {
  const root = $("base-mode-list");
  root.innerHTML = "";

  const available = BASE_MODE_ORDER.filter((ep) => entryPoints.includes(ep));

  for (const ep of available) {
    const label = document.createElement("label");
    const input = document.createElement("input");

    input.type = "checkbox";
    input.name = "base-mode";
    input.value = ep;
    input.checked = DEFAULT_BASE_SELECTION.has(ep);

    label.appendChild(input);
    label.appendChild(document.createTextNode(` ${makeLabel(ep)}`));
    root.appendChild(label);
  }

  if (!root.querySelector('input[name="base-mode"]:checked')) {
    const first = root.querySelector('input[name="base-mode"]');
    if (first) first.checked = true;
  }
}

function getSelectedBaseModes() {
  const els = Array.from(
    document.querySelectorAll('input[name="base-mode"]:checked'),
  );
  const values = els.map((el) => String(el.value || "")).filter(Boolean);
  return values.length ? values : ["computeRidgedMultifractal"];
}

function readBaseParams() {
  return {
    seed: Math.max(1, intNum("base-seed", 123456789)),
    zoom: num("base-zoom", 1.0),
    freq: num("base-freq", 3.0),
    octaves: Math.max(1, intNum("base-octaves", 3)),
    lacunarity: num("base-lacunarity", 2.0),
    gain: num("base-gain", 0.1),
    xShift: num("base-xShift", 0.0),
    yShift: num("base-yShift", 0.0),
    zShift: num("base-zShift", 0.0),
    turbulence: checked("base-turbulence") ? 1 : 0,
    seedAngle: 0.0,
    exp1: 1.0,
    exp2: 0.0,
    threshold: num("base-threshold", 0.1),
    rippleFreq: 10.0,
    time: 0.0,
    warpAmp: num("base-warpAmp", 0.5),
    gaborRadius: num("base-gaborRadius", 4.0),
    terraceStep: 8.0,
    toroidal: 0,
    voroMode: Math.max(0, intNum("base-voroMode", 0)),
    edgeK: num("base-edgeK", 0.0),
  };
}

function readGuideParams(baseSeed) {
  return {
    seed: baseSeed,
    zoom: 1.0,
    freq: 1.0,
    octaves: 1,
    lacunarity: 2.0,
    gain: 1.0,
    xShift: 0.0,
    yShift: 0.0,
    zShift: 0.0,
    turbulence: 0,
    seedAngle: 0.0,
    exp1: checked("guide-enabled") ? num("guide-blend", 0.85) : 0.0,
    exp2: 0.0,
    threshold: num("guide-sigma", 1.15),
    rippleFreq: 0.0,
    time: 0.0,
    warpAmp: 0.0,
    gaborRadius: 0.0,
    terraceStep: 8.0,
    toroidal: 0,
    voroMode: 0,
    edgeK: 0.0,
  };
}

function readErosionParams() {
  return {
    enabled: checked("erosion-enabled"),
    seed: Math.max(1, intNum("erosion-seed", 246813579)),
    scale: num("erosion-scale", 0.18),
    domainScale: num("erosion-domainScale", 0.85),
    strength: num("erosion-strength", 1.1),
    gullyWeight: num("erosion-gullyWeight", 0.5),
    detail: num("erosion-detail", 1.35),
    octaves: Math.max(1, intNum("erosion-octaves", 4)),
    lacunarity: num("erosion-lacunarity", 1.9),
    gain: num("erosion-gain", 0.55),
    fadeScale: num("erosion-fadeScale", 1.6666667),
    heightBias: num("erosion-heightBias", 0.0),
    cellScale: num("erosion-cellScale", 0.9),
    normalization: num("erosion-normalization", 0.45),
    assumedSlopeValue: num("erosion-assumedSlopeValue", 0.7),
    assumedSlopeMix: num("erosion-assumedSlopeMix", 1.0),
    onsetScale: num("erosion-onsetScale", 8.0),
    constOffset: num("erosion-constOffset", -0.65),
    followFadeOffset: num("erosion-followFadeOffset", 0.0),
    xShift: num("erosion-xShift", 0.0),
    yShift: num("erosion-yShift", 0.0),
    time: num("erosion-time", 0.0),
  };
}

function readDrainageParams() {
  return {
    width: num("drainage-width", 0.18),
    concavity: num("drainage-concavity", 3.0),
    slopeOnset: num("drainage-slopeOnset", 0.25),
    contrast: num("drainage-contrast", 0.25),
    gain: num("drainage-gain", 0.9),
  };
}

function getOutputSize(builder) {
  const devMax = Math.min(
    builder.device.limits.maxTextureDimension2D ?? 8192,
    builder.device.limits.maxStorageTextureDimension2D ?? 8192,
  );

  let size = intNum("res-size", 1024);
  size = clamp(size, 128, devMax);

  if (String($("res-size").value) !== String(size)) {
    $("res-size").value = String(size);
  }

  return size;
}

function ensure2DCanvasSize(canvas, size) {
  const s = Math.max(1, size | 0);
  if (canvas.width !== s || canvas.height !== s) {
    canvas.width = s;
    canvas.height = s;
  }
}

function setStatus(meta, stats = "") {
  $("preview-meta").textContent = meta;
  $("preview-stats").textContent = stats;
}

async function waitForGpu(builder) {
  const q = builder?.queue || builder?.device?.queue;
  if (!q || typeof q.onSubmittedWorkDone !== "function") return;
  try {
    await q.onSubmittedWorkDone();
  } catch (_) {}
}

function formatModeList(modes) {
  return modes.map(makeLabel).join(" + ");
}

async function exportCurrentStageToCanvas(builder, size, channel, canvas) {
  const blob = await builder.exportCurrent2DToPNGBlob(size, size, {
    layer: 0,
    channel,
    background: "black",
  });

  const bmp = await createImageBitmap(blob);

  ensure2DCanvasSize(canvas, size);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(bmp, 0, 0, size, size);
  bmp.close();

  return ctx.getImageData(0, 0, size, size);
}

function blankCanvas(canvas, size) {
  ensure2DCanvasSize(canvas, size);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function mix3(c1, c2, t) {
  return [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];
}

function terrainPalette(h) {
  const t = clamp(h, 0, 1);

  if (t < 0.25) {
    return mix3([18, 16, 18], [60, 48, 38], t / 0.25);
  }

  if (t < 0.55) {
    return mix3([60, 48, 38], [138, 113, 86], (t - 0.25) / 0.3);
  }

  if (t < 0.82) {
    return mix3([138, 113, 86], [128, 130, 136], (t - 0.55) / 0.27);
  }

  return mix3([128, 130, 136], [244, 244, 248], (t - 0.82) / 0.18);
}

function composeTerrain(
  baseData,
  guideData,
  erodedData,
  ridgeData,
  drainageData,
) {
  const width = erodedData.width;
  const height = erodedData.height;

  const out = new ImageData(width, height);

  const bd = baseData.data;
  const gd = guideData.data;
  const ed = erodedData.data;
  const rd = ridgeData.data;
  const dd = drainageData.data;
  const od = out.data;

  const light = (() => {
    let x = -0.65;
    let y = 0.72;
    let z = -0.24;
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  })();

  const sampleH = (x, y) => {
    const cx = clamp(x, 0, width - 1);
    const cy = clamp(y, 0, height - 1);
    return ed[(cy * width + cx) * 4] / 255;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      const baseH = bd[i] / 255;
      const guideH = gd[i] / 255;
      const h = ed[i] / 255;
      const ridge = rd[i] / 255;
      const drainage = dd[i] / 255;

      const hL = sampleH(x - 1, y);
      const hR = sampleH(x + 1, y);
      const hD = sampleH(x, y - 1);
      const hU = sampleH(x, y + 1);

      const dx = hR - hL;
      const dy = hU - hD;

      let nx = -dx * 4.0;
      let ny = 1.0;
      let nz = -dy * 4.0;
      const nl = Math.hypot(nx, ny, nz) || 1.0;
      nx /= nl;
      ny /= nl;
      nz /= nl;

      const shade =
        0.35 +
        0.65 * Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);

      let color = terrainPalette(h);

      const baseBreakup = (baseH - 0.5) * 36.0;
      const guideBias = (guideH - 0.5) * 20.0;
      color[0] += baseBreakup + guideBias;
      color[1] += baseBreakup * 0.85 + guideBias * 0.8;
      color[2] += baseBreakup * 0.65 + guideBias * 0.7;

      const ridgeBoost = ridge * 42.0;
      color[0] += ridgeBoost;
      color[1] += ridgeBoost * 0.85;
      color[2] += ridgeBoost * 0.75;

      const drainTint = drainage * 0.85;
      color[0] = mix(color[0], 175, drainTint * 0.35);
      color[1] = mix(color[1], 220, drainTint * 0.65);
      color[2] = mix(color[2], 255, drainTint * 0.95);

      color[0] *= shade;
      color[1] *= shade;
      color[2] *= shade;

      od[i] = clamp(Math.round(color[0]), 0, 255);
      od[i + 1] = clamp(Math.round(color[1]), 0, 255);
      od[i + 2] = clamp(Math.round(color[2]), 0, 255);
      od[i + 3] = 255;
    }
  }

  return out;
}

function drawImageData(canvas, imageData) {
  ensure2DCanvasSize(canvas, imageData.width);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.putImageData(imageData, 0, 0);
}

function renderTerrain3D(heightData, colorData, canvas) {
  const width = colorData.width;
  const height = colorData.height;

  ensure2DCanvasSize(canvas, width);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  ctx.clearRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#101922");
  sky.addColorStop(1, "#030303");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const hd = heightData.data;
  const cd = colorData.data;

  const srcW = width;
  const srcH = height;

  const targetGrid = Math.min(220, Math.max(90, Math.floor(width / 4)));
  const step = Math.max(1, Math.ceil(Math.max(srcW, srcH) / targetGrid));

  const sxScale = width * 0.34;
  const syScale = width * 0.16;
  const elevScale = width * 0.24;
  const yBase = height * 0.78;

  const light = (() => {
    let x = -0.48;
    let y = 0.77;
    let z = -0.42;
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  })();

  const sampleH = (x, y) => {
    const cx = clamp(x, 0, srcW - 1);
    const cy = clamp(y, 0, srcH - 1);
    return hd[(cy * srcW + cx) * 4] / 255;
  };

  const sampleColor = (x, y) => {
    const cx = clamp(x, 0, srcW - 1);
    const cy = clamp(y, 0, srcH - 1);
    const i = (cy * srcW + cx) * 4;
    return [cd[i], cd[i + 1], cd[i + 2]];
  };

  function project(ix, iy, h) {
    const x = ix / (srcW - 1) - 0.5;
    const z = iy / (srcH - 1) - 0.5;
    return {
      x: (x - z) * sxScale + width * 0.5,
      y: (x + z) * syScale + yBase - (h - 0.5) * elevScale,
    };
  }

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (let y = srcH - step - 1; y >= 0; y -= step) {
    for (let x = 0; x < srcW - step; x += step) {
      const h00 = sampleH(x, y);
      const h10 = sampleH(x + step, y);
      const h11 = sampleH(x + step, y + step);
      const h01 = sampleH(x, y + step);

      const p00 = project(x, y, h00);
      const p10 = project(x + step, y, h10);
      const p11 = project(x + step, y + step, h11);
      const p01 = project(x, y + step, h01);

      const dx = (h10 + h11 - (h00 + h01)) * 0.5;
      const dz = (h01 + h11 - (h00 + h10)) * 0.5;

      let nx = -dx * 4.0;
      let ny = 1.0;
      let nz = -dz * 4.0;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;

      const shade =
        0.35 +
        0.65 * Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);

      const c00 = sampleColor(x, y);
      const c10 = sampleColor(x + step, y);
      const c11 = sampleColor(x + step, y + step);
      const c01 = sampleColor(x, y + step);

      const r = (c00[0] + c10[0] + c11[0] + c01[0]) * 0.25 * shade;
      const g = (c00[1] + c10[1] + c11[1] + c01[1]) * 0.25 * shade;
      const b = (c00[2] + c10[2] + c11[2] + c01[2]) * 0.25 * shade;

      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.closePath();

      ctx.fillStyle = `rgb(${clamp(Math.round(r), 0, 255)}, ${clamp(Math.round(g), 0, 255)}, ${clamp(Math.round(b), 0, 255)})`;
      ctx.fill();

      ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

async function renderStages(builder, stageCanvases) {
  const size = getOutputSize(builder);

  Object.values(stageCanvases).forEach((canvas) =>
    ensure2DCanvasSize(canvas, size),
  );

  const baseModes = getSelectedBaseModes();
  const baseParams = readBaseParams();
  const guideParams = readGuideParams(baseParams.seed);
  const erosion = readErosionParams();
  const drainage = readDrainageParams();

  const t0 = performance.now();

  builder.buildPermTable(baseParams.seed);

  await builder.computeToTexture(size, size, baseParams, {
    noiseChoices: ["clearTexture"],
    outputChannel: 1,
    baseRadius: 0.0,
    heightScale: 1.0,
    useCustomPos: 0,
    ioFlags: 0,
    squareWorld: true,
    worldMode: "crop",
  });

  for (const mode of baseModes) {
    await builder.computeToTexture(size, size, baseParams, {
      noiseChoices: [mode],
      outputChannel: 1,
      baseRadius: 0.0,
      heightScale: 1.0,
      useCustomPos: 0,
      ioFlags: 0,
      squareWorld: true,
      worldMode: "crop",
    });
  }

  await waitForGpu(builder);

  const baseImage = await exportCurrentStageToCanvas(
    builder,
    size,
    0,
    stageCanvases.base,
  );

  let guideImage = baseImage;
  let erodedImage = baseImage;
  let ridgeImage = blankCanvas(stageCanvases.ridge, size);
  let drainageImage = blankCanvas(stageCanvases.drainage, size);

  if (builder.entryPoints.includes("computeHydrologyGuideField")) {
    await builder.computeToTexture(size, size, guideParams, {
      noiseChoices: ["computeHydrologyGuideField"],
      outputChannel: 1,
      baseRadius: 0.0,
      heightScale: 1.0,
      useCustomPos: 0,
      ioFlags: 0,
      squareWorld: true,
      worldMode: "crop",
    });

    await waitForGpu(builder);
    guideImage = await exportCurrentStageToCanvas(
      builder,
      size,
      0,
      stageCanvases.guide,
    );
  } else {
    const guideCtx = stageCanvases.guide.getContext("2d", {
      willReadFrequently: true,
    });
    guideCtx.putImageData(baseImage, 0, 0);
    guideImage = baseImage;
  }

  if (erosion.enabled) {
    const erosionParams = {
      seed: erosion.seed,
      zoom: erosion.scale,
      freq: erosion.domainScale,
      octaves: erosion.octaves,
      lacunarity: erosion.lacunarity,
      gain: erosion.gain,
      xShift: erosion.xShift,
      yShift: erosion.yShift,
      zShift: erosion.heightBias,
      turbulence: builder.entryPoints.includes("computeHydrologyGuideField")
        ? 1
        : 0,
      seedAngle: erosion.detail,
      exp1: erosion.gullyWeight,
      exp2: erosion.fadeScale,
      threshold: erosion.cellScale,
      rippleFreq: erosion.normalization,
      time: erosion.time,
      warpAmp: erosion.assumedSlopeValue,
      gaborRadius: erosion.assumedSlopeMix,
      terraceStep: erosion.onsetScale,
      toroidal: 0,
      voroMode: 0,
      edgeK: erosion.followFadeOffset,
    };

    await builder.computeToTexture(size, size, erosionParams, {
      noiseChoices: ["computeHydrologyErosionHeightfield"],
      outputChannel: 1,
      baseRadius: erosion.constOffset,
      heightScale: erosion.strength,
      useCustomPos: 0,
      ioFlags: 0,
      squareWorld: true,
      worldMode: "crop",
    });

    await waitForGpu(builder);

    erodedImage = await exportCurrentStageToCanvas(
      builder,
      size,
      0,
      stageCanvases.eroded,
    );
    ridgeImage = await exportCurrentStageToCanvas(
      builder,
      size,
      3,
      stageCanvases.ridge,
    );

    if (builder.entryPoints.includes("computeHydrologyDrainageMask")) {
      const drainageParams = {
        seed: erosion.seed,
        zoom: 1.0,
        freq: 1.0,
        octaves: 1,
        lacunarity: 2.0,
        gain: 1.0,
        xShift: 0.0,
        yShift: 0.0,
        zShift: 0.0,
        turbulence: 0,
        seedAngle: 0.0,
        exp1: drainage.contrast,
        exp2: drainage.gain,
        threshold: drainage.width,
        rippleFreq: 0.0,
        time: 0.0,
        warpAmp: drainage.slopeOnset,
        gaborRadius: 0.0,
        terraceStep: 8.0,
        toroidal: 0,
        voroMode: 0,
        edgeK: drainage.concavity,
      };

      await builder.computeToTexture(size, size, drainageParams, {
        noiseChoices: ["computeHydrologyDrainageMask"],
        outputChannel: 1,
        baseRadius: 0.0,
        heightScale: 1.0,
        useCustomPos: 0,
        ioFlags: 0,
        squareWorld: true,
        worldMode: "crop",
      });

      await waitForGpu(builder);
      drainageImage = await exportCurrentStageToCanvas(
        builder,
        size,
        0,
        stageCanvases.drainage,
      );
    } else {
      drainageImage = blankCanvas(stageCanvases.drainage, size);
    }
  } else {
    const erodedCtx = stageCanvases.eroded.getContext("2d", {
      willReadFrequently: true,
    });
    erodedCtx.putImageData(baseImage, 0, 0);
    erodedImage = baseImage;
  }

  const t1 = performance.now();

  const finalImage = composeTerrain(
    baseImage,
    guideImage,
    erodedImage,
    ridgeImage,
    drainageImage,
  );
  drawImageData(stageCanvases.final, finalImage);
  renderTerrain3D(erodedImage, finalImage, stageCanvases.render3d);

  const t2 = performance.now();

  setStatus(
    `Stages · ${size}×${size} · base: ${formatModeList(baseModes)}${erosion.enabled ? " · erosion on" : " · erosion off"}`,
    `GPU + capture ${(t1 - t0).toFixed(1)} ms · CPU composite ${(t2 - t1).toFixed(1)} ms`,
  );
}

async function saveFinalComposite(stageCanvas) {
  const bg = selectedValue("export-bg", "transparent");
  const src = stageCanvas;
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;

  const octx = out.getContext("2d", { willReadFrequently: true });

  if (bg === "black") {
    octx.fillStyle = "#000";
    octx.fillRect(0, 0, out.width, out.height);
  } else if (bg === "white") {
    octx.fillStyle = "#fff";
    octx.fillRect(0, 0, out.width, out.height);
  }

  octx.drawImage(src, 0, 0);

  const blob = await new Promise((resolve, reject) => {
    out.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Failed to export final composite"));
    }, "image/png");
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "erosion-final-composite.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function init() {
  insertAppHtml();

  if (!navigator.gpu) {
    setStatus("WebGPU not available", "");
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    setStatus("Failed to get GPU adapter", "");
    return;
  }

  const device = await adapter.requestDevice({
    requiredLimits: {
      maxBufferSize: adapter.limits.maxBufferSize,
    },
  });

  const builder = new NoiseComputeBuilder(device, device.queue);

  if (!builder.entryPoints.includes("computeHydrologyErosionHeightfield")) {
    throw new Error(
      "computeHydrologyErosionHeightfield is missing from noiseCompute.wgsl or builder.entryPoints",
    );
  }

  populateBaseModeList(builder.entryPoints);

  const stageCanvases = {
    base: $("stage-base"),
    guide: $("stage-guide"),
    eroded: $("stage-eroded"),
    ridge: $("stage-ridge"),
    drainage: $("stage-drainage"),
    final: $("stage-final"),
    render3d: $("stage-3d"),
  };

  let busy = false;
  let queued = false;

  const scheduleRender = () => {
    queued = true;
    if (busy) return;

    busy = true;
    requestAnimationFrame(async () => {
      queued = false;
      try {
        await renderStages(builder, stageCanvases);
      } catch (err) {
        console.error(err);
        setStatus("Render failed", String(err));
      } finally {
        busy = false;
        if (queued) scheduleRender();
      }
    });
  };

  const rerenderIds = [
    "res-size",
    "base-seed",
    "base-zoom",
    "base-freq",
    "base-octaves",
    "base-lacunarity",
    "base-gain",
    "base-xShift",
    "base-yShift",
    "base-zShift",
    "base-threshold",
    "base-edgeK",
    "base-voroMode",
    "base-warpAmp",
    "base-gaborRadius",
    "base-turbulence",
    "guide-enabled",
    "guide-blend",
    "guide-sigma",
    "erosion-enabled",
    "erosion-seed",
    "erosion-scale",
    "erosion-domainScale",
    "erosion-strength",
    "erosion-gullyWeight",
    "erosion-detail",
    "erosion-octaves",
    "erosion-lacunarity",
    "erosion-gain",
    "erosion-fadeScale",
    "erosion-heightBias",
    "erosion-cellScale",
    "erosion-normalization",
    "erosion-assumedSlopeValue",
    "erosion-assumedSlopeMix",
    "erosion-onsetScale",
    "erosion-constOffset",
    "erosion-followFadeOffset",
    "erosion-xShift",
    "erosion-yShift",
    "erosion-time",
    "drainage-width",
    "drainage-concavity",
    "drainage-slopeOnset",
    "drainage-contrast",
    "drainage-gain",
  ];

  for (const id of rerenderIds) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("input", scheduleRender);
    el.addEventListener("change", scheduleRender);
  }

  $("base-mode-list").addEventListener("change", scheduleRender);
  $("render-btn").addEventListener("click", scheduleRender);

  $("save-btn").addEventListener("click", async () => {
    try {
      await saveFinalComposite(stageCanvases.final);
    } catch (err) {
      console.error(err);
      setStatus("Save failed", String(err));
    }
  });

  scheduleRender();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    console.error(err);
    const meta = document.getElementById("preview-meta");
    const stats = document.getElementById("preview-stats");
    if (meta) meta.textContent = "Init failed";
    if (stats) stats.textContent = String(err);
  });
});
