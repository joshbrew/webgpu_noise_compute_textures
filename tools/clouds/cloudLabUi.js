// Cloud Lab UI: the shared look and the artist "Studio" card for both the
// flat and planet cloud demos. Tokens mirror the Cloud Lab design system
// (night theme). Everything is scoped to .cl-root so the renderers' own
// canvases and debug overlays are untouched.

const TOKENS_CSS = `
:root {
  --ground:#070b13; --canvas:#02050a; --rail-glass:rgba(9,14,24,0.86);
  --surface:#0e1420; --surface-raised:#161e2e; --surface-inset:#05080f;
  --line:#1f2a3d; --line-strong:#5d7090;
  --ink:#ebf2ff; --ink-muted:#a9b7cf; --ink-faint:#8290a8;
  --sky:#84b8ff; --sky-soft:#16263d; --on-sky:#061224;
  --sun:#ffb35c; --sun-soft:#2b1e0e; --on-sun:#1f1203;
  --storm:#ffaaa8; --live:#6fe0b8; --focus-ring:#9bd5ff;
  --shadow-rail:0 12px 34px rgba(0,0,0,0.35); --shadow-thumb:0 1px 3px rgba(0,0,0,0.5);
  --space-1:2px; --space-2:4px; --space-3:6px; --space-4:8px; --space-5:12px; --space-6:16px; --space-7:24px; --space-8:32px;
  --radius-xs:4px; --radius-sm:6px; --radius-md:8px; --radius-lg:12px; --radius-pill:999px;
  --control-sm:28px; --control-md:32px; --control-lg:40px; --rail-width:360px;
  --font-sans:"Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono:"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  /* The flat demo's original variables now follow the tokens. */
  --cloud-ui-bg:var(--ground); --cloud-ui-panel:var(--surface); --cloud-ui-panel-strong:var(--surface-raised);
  --cloud-ui-line:var(--line); --cloud-ui-line-strong:var(--line-strong);
  --cloud-ui-text:var(--ink); --cloud-ui-muted:var(--ink-muted); --cloud-ui-accent:var(--sky);
  --fg:var(--ink); --fg2:var(--ink-muted); --bg:var(--ground); --panel:var(--surface);
}`;

const COMPONENT_CSS = `
.cl-root { font-family:var(--font-sans); font-size:13px; line-height:18px; color:var(--ink); -webkit-font-smoothing:antialiased; }
.cl-root *, .cl-root *::before, .cl-root *::after { box-sizing:border-box; }
.cl-root :focus-visible { outline:2px solid var(--focus-ring) !important; outline-offset:2px; }
.cl-root :where(button, input, select, textarea) { font:inherit; color:inherit; }

.cl-section { margin:0; font-size:11px; line-height:14px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink); }
.cl-hint { margin:0; font-size:11px; line-height:16px; color:var(--ink-faint); }
.cl-value { font-family:var(--font-mono); font-size:12px; line-height:16px; font-weight:500; font-variant-numeric:tabular-nums; color:var(--ink); }

/* Rail: the one floating panel per demo */
.cl-rail { box-sizing:border-box; position:fixed; z-index:20; left:var(--space-4); top:var(--space-4); bottom:var(--space-4);
  width:var(--rail-width); max-width:calc(100vw - 16px);
  display:block; overflow-y:auto; overflow-x:hidden; padding:0 var(--space-5) var(--space-5);
  background:var(--rail-glass); -webkit-backdrop-filter:blur(14px) saturate(1.15); backdrop-filter:blur(14px) saturate(1.15);
  border:1px solid var(--line); border-radius:var(--radius-lg); box-shadow:var(--shadow-rail);
  scrollbar-width:thin; scrollbar-color:var(--line-strong) transparent; }
.cl-rail > * + * { margin-top:var(--space-5); }
.cl-rail__head { position:sticky; top:0; z-index:3; display:grid; gap:var(--space-4);
  margin:0 calc(-1 * var(--space-5)); padding:var(--space-5); background:var(--surface); border-bottom:1px solid var(--line); }
.cl-rail__titlerow { display:flex; align-items:center; justify-content:space-between; gap:var(--space-4); min-width:0; }
.cl-rail__title { margin:0; font-size:15px; line-height:20px; font-weight:600; white-space:nowrap; color:var(--ink); }
.cl-rail.is-collapsed > :not(.cl-rail__head) { display:none !important; }
.cl-rail.is-collapsed { bottom:auto; }
.cl-view-tools { display:grid; grid-template-columns:1fr 1fr; gap:var(--space-4); }
.cl-view-tip { position:fixed; z-index:10001; left:50%; bottom:24px; transform:translateX(-50%);
  max-width:calc(100vw - 32px); padding:8px 14px; border:1px solid var(--line); border-radius:var(--radius-pill);
  background:var(--surface); color:var(--ink); font:13px/18px var(--font-sans); pointer-events:none; }
.cl-view-tip[hidden] { display:none; }
body.cl-clean-view .cl-rail, body.cl-clean-view #cloud-navigation,
body.cl-clean-view .cl-switch--floating, body.cl-clean-view #busyOverlay { visibility:hidden !important; pointer-events:none !important; }
@media (max-width:719px) {
  .cl-rail { left:0; right:0; top:auto; bottom:0; width:100%; max-width:none; max-height:62vh; border-radius:var(--radius-lg) var(--radius-lg) 0 0; }
}

.cl-rail__title + .cl-status { flex:1 1 auto; justify-content:flex-start; }
.cl-root .cl-field > .cl-field__label, .cl-root .cl-field > .cl-field__label > span { color:var(--ink-muted); font-weight:500; font-size:12px; letter-spacing:0; text-transform:none; }
.cl-status { display:inline-flex; align-items:center; gap:var(--space-3); min-width:0; height:22px; padding:0 var(--space-4);
  border:1px solid var(--line); border-radius:var(--radius-pill); background:var(--surface-inset);
  font:500 11px/16px var(--font-mono); color:var(--ink-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cl-status::before { content:""; flex:none; width:6px; height:6px; border-radius:var(--radius-pill); background:var(--ink-faint); }
.cl-status[data-state="live"]::before { background:var(--live); }
.cl-status[data-state="busy"]::before { background:var(--sun); animation:cl-pulse 1.2s ease-in-out infinite; }
.cl-status[data-state="error"] { color:var(--storm); }
.cl-status[data-state="error"]::before { background:var(--storm); }
@keyframes cl-pulse { 50% { opacity:.35; } }
@media (prefers-reduced-motion:reduce) { .cl-status[data-state="busy"]::before { animation:none; } }

.cl-switch { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:var(--space-1); padding:var(--space-1);
  border:1px solid var(--line); border-radius:var(--radius-md); background:var(--surface-inset); }
.cl-switch a { display:inline-flex; align-items:center; justify-content:center; height:var(--control-sm); padding:0 var(--space-5);
  border-radius:var(--radius-xs); color:var(--ink-muted); text-decoration:none; font-size:12px; line-height:16px; font-weight:500; white-space:nowrap; }
.cl-switch a:hover { color:var(--ink); background:var(--surface-raised); }
.cl-switch a[aria-current="page"] { color:var(--ink); background:var(--surface-raised); box-shadow:inset 0 0 0 1px var(--line-strong); cursor:default; }
.cl-switch--floating { position:fixed; right:var(--space-5); bottom:var(--space-5); z-index:10000; font-family:var(--font-sans); }

.cl-tabs { display:grid !important; grid-template-columns:repeat(3, minmax(0,1fr)) !important; gap:var(--space-1) !important; padding:var(--space-1) !important;
  border:1px solid var(--line); border-radius:var(--radius-md); background:var(--surface-inset); }
.cl-tabs > button { appearance:none; margin:0 !important; width:auto !important; height:var(--control-sm) !important; min-height:0 !important; padding:0 var(--space-3) !important;
  border:0 !important; border-radius:var(--radius-xs) !important; background:transparent !important; box-shadow:none !important;
  color:var(--ink-muted) !important; font:500 12px/16px var(--font-sans) !important; white-space:nowrap; cursor:pointer; }
.cl-tabs > button:hover { color:var(--ink) !important; background:var(--surface-raised) !important; }
.cl-tabs > button.active, .cl-tabs > button[aria-selected="true"] { color:var(--sky) !important; background:var(--sky-soft) !important; box-shadow:inset 0 0 0 1px var(--sky) !important; }

.cl-field { display:grid !important; gap:var(--space-2) !important; min-width:0; margin:0 !important; }
.cl-field__label { display:flex; align-items:baseline; justify-content:space-between; gap:var(--space-4); min-width:0;
  font-size:12px; line-height:16px; font-weight:500; color:var(--ink-muted); }
.cl-field__label > span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cl-field--full { grid-column:1 / -1; }
.cl-input, .cl-select select { width:100%; min-width:0; height:var(--control-md); padding:0 var(--space-4);
  border:1px solid var(--line-strong); border-radius:var(--radius-sm); background:var(--surface-inset); color:var(--ink); font-size:13px; line-height:18px; }
.cl-input:hover, .cl-select select:hover { border-color:var(--ink-faint); }
.cl-select { position:relative; display:block; min-width:0; }
.cl-select select { appearance:none; padding-right:28px; cursor:pointer; }
.cl-select select option { background:var(--surface); color:var(--ink); }
.cl-select::after { content:""; position:absolute; right:11px; top:50%; width:6px; height:6px; margin-top:-5px;
  border-right:1.5px solid var(--ink-muted); border-bottom:1.5px solid var(--ink-muted); transform:rotate(45deg); pointer-events:none; }
.cl-select--lg select { height:var(--control-lg); font-weight:500; }

.cl-slider { --pct:50%; appearance:none; -webkit-appearance:none; width:100%; height:20px; margin:0; padding:0 !important; background:transparent !important; border:0 !important; cursor:pointer; }
.cl-slider::-webkit-slider-runnable-track { height:4px; border-radius:var(--radius-pill);
  background:linear-gradient(to right, var(--sky) 0 var(--pct), var(--surface-inset) var(--pct) 100%); box-shadow:inset 0 0 0 1px var(--line-strong); }
.cl-slider::-moz-range-track { height:4px; border-radius:var(--radius-pill); background:var(--surface-inset); box-shadow:inset 0 0 0 1px var(--line-strong); }
.cl-slider::-moz-range-progress { height:4px; border-radius:var(--radius-pill); background:var(--sky); }
.cl-slider::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; margin-top:-5px; border-radius:var(--radius-pill);
  background:var(--ink); border:2px solid var(--sky); box-shadow:var(--shadow-thumb); }
.cl-slider::-moz-range-thumb { width:10px; height:10px; border-radius:var(--radius-pill); background:var(--ink); border:2px solid var(--sky); box-shadow:var(--shadow-thumb); }
.cl-slider:focus-visible { outline:none !important; }
.cl-slider:focus-visible::-webkit-slider-thumb { outline:2px solid var(--focus-ring); outline-offset:2px; }

.cl-toggle { display:flex !important; align-items:center; justify-content:space-between; gap:var(--space-4); min-height:var(--control-sm);
  font-size:13px; line-height:18px; color:var(--ink); cursor:pointer; }
.cl-toggle input { appearance:none; -webkit-appearance:none; flex:none; margin:0; cursor:pointer; position:relative; width:30px; height:18px;
  border:1px solid var(--line-strong); border-radius:var(--radius-pill); background:var(--surface-inset); }
.cl-toggle input::after { content:""; position:absolute; top:2px; left:2px; width:12px; height:12px; border-radius:var(--radius-pill);
  background:var(--ink-muted); box-shadow:var(--shadow-thumb); transition:transform 120ms ease; }
.cl-toggle input:checked { background:var(--sky); border-color:var(--sky); }
.cl-toggle input:checked::after { transform:translateX(12px); background:var(--on-sky); }

.cl-btn { appearance:none; cursor:pointer; margin:0; display:inline-flex; align-items:center; justify-content:center; gap:var(--space-3);
  height:var(--control-md); min-width:0; padding:0 var(--space-5);
  border:1px solid var(--line-strong); border-radius:var(--radius-sm); background:var(--surface-raised); color:var(--ink);
  font-size:13px; line-height:18px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cl-rail__titlerow > .cl-btn { flex:none; width:auto; }
.cl-btnrow > .cl-btn, .cl-export__grid > .cl-btn { width:100%; }
.cl-btn:hover { border-color:var(--ink-faint); }
.cl-btn:disabled { opacity:.5; cursor:not-allowed; }
.cl-btn[aria-busy="true"] { cursor:progress; }
.cl-btn--primary { background:var(--sun); border-color:var(--sun); color:var(--on-sun); font-weight:600; }
.cl-btn--primary:hover { border-color:var(--ink); }
.cl-btn--ghost { background:transparent; border-color:transparent; color:var(--ink-muted); }
.cl-btn--ghost:hover { color:var(--ink); background:var(--surface-raised); border-color:var(--line); }
.cl-btn--sm { height:var(--control-sm); padding:0 var(--space-4); font-size:12px; }
.cl-btn--block { width:100%; }
.cl-btnrow { display:grid; grid-template-columns:repeat(auto-fit, minmax(0,1fr)); grid-auto-flow:column; gap:var(--space-4); }

.cl-preset { display:grid; gap:var(--space-5); padding:var(--space-5); border:1px solid var(--line-strong); border-radius:var(--radius-lg); background:var(--surface); }
.cl-preset__grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:var(--space-5) var(--space-4); align-items:end; }
.cl-export { display:grid; gap:var(--space-4); padding-top:var(--space-5); border-top:1px solid var(--line); }
.cl-export__grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:var(--space-4); }
.cl-export__status:empty { display:none; }
.cl-export__status[data-state="error"] { color:var(--storm); }

.cl-disclosure { border:1px solid var(--line); border-radius:var(--radius-md); background:var(--surface); min-width:0; }
.cl-disclosure > summary { list-style:none; cursor:pointer; display:flex; align-items:center; gap:var(--space-4); min-height:40px; padding:0 var(--space-5);
  font-size:12px; line-height:16px; font-weight:600; color:var(--ink); border-radius:var(--radius-md); }
.cl-disclosure > summary::-webkit-details-marker { display:none; }
.cl-disclosure > summary::before { content:""; flex:none; width:6px; height:6px; margin-left:2px;
  border-right:1.5px solid var(--ink-muted); border-bottom:1.5px solid var(--ink-muted); transform:rotate(-45deg); transition:transform 120ms ease; }
.cl-disclosure[open] > summary::before { transform:rotate(45deg); }
.cl-disclosure > summary:hover { background:var(--surface-raised); }
.cl-disclosure__body { display:grid; gap:var(--space-5); padding:var(--space-2) var(--space-5) var(--space-5); min-width:0; }

.cl-applybar { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:var(--space-4);
  padding:var(--space-4) var(--space-5); background:var(--surface); }
.cl-applybar__status { display:flex; align-items:center; gap:var(--space-3); min-width:0; font-size:11px; line-height:16px; color:var(--ink-muted); }
.cl-applybar__status::before { content:""; flex:none; width:6px; height:6px; border-radius:var(--radius-pill); background:var(--ink-faint); }
.cl-applybar[data-dirty="true"] { background:var(--sun-soft); }
.cl-applybar[data-dirty="true"] .cl-applybar__status { color:var(--ink); }
.cl-applybar[data-dirty="true"] .cl-applybar__status::before { background:var(--sun); }

.cl-advanced-head { display:flex; align-items:baseline; justify-content:space-between; gap:var(--space-4); padding-top:var(--space-2); }
`;

// The demos' existing controls are built with inline styles at 9–10px.
// Inside .cl-legacy they are normalized onto the tokens. .cl-keep opts out.
const LEGACY_CSS = `
.cl-legacy { color:var(--ink); }
.cl-legacy :is(button):not(.cl-btn, .cl-keep *, .cl-tabs > button) {
  appearance:none; min-height:var(--control-sm) !important; height:auto !important; padding:var(--space-2) var(--space-4) !important;
  border:1px solid var(--line-strong) !important; border-radius:var(--radius-sm) !important;
  background:var(--surface-raised) !important; color:var(--ink) !important; box-shadow:none !important;
  font:500 12px/16px var(--font-sans) !important; cursor:pointer; }
.cl-legacy :is(button):not(.cl-btn, .cl-keep *, .cl-tabs > button):hover { border-color:var(--ink-faint) !important; }
.cl-legacy :is(button):not(.cl-btn, .cl-keep *):disabled { opacity:.5; }
.cl-legacy :is(input:not([type=checkbox], [type=radio], [type=range], [type=color], [type=file]), select):not(.cl-input, .cl-keep *) {
  min-height:var(--control-sm) !important; padding:var(--space-1) var(--space-3) !important;
  border:1px solid var(--line-strong) !important; border-radius:var(--radius-sm) !important;
  background:var(--surface-inset) !important; color:var(--ink) !important; font:12px/16px var(--font-sans) !important; }
.cl-legacy input[type=number]:not(.cl-keep *) { font-family:var(--font-mono) !important; font-variant-numeric:tabular-nums; }
.cl-legacy select option { background:var(--surface); color:var(--ink); }
.cl-legacy textarea:not(.cl-keep *) { border:1px solid var(--line-strong) !important; border-radius:var(--radius-sm) !important;
  background:var(--surface-inset) !important; color:var(--ink) !important; font:11px/16px var(--font-mono) !important; padding:var(--space-4) !important; }
.cl-legacy input:is([type=checkbox], [type=radio], [type=range]):not(.cl-keep *) { accent-color:var(--sky); }
.cl-legacy :is(label, div, span, b, strong, small, p, summary, h2, h3):not([class^="cl-"], [class*=" cl-"], .cl-keep *) { font-size:max(11px, 1em) !important; }
.cl-legacy :is(label, small, .hint, .smallLabel):not(.cl-keep *) { color:var(--ink-muted) !important; }
.cl-legacy details:not(.cl-disclosure, .cl-keep *) { border:1px solid var(--line) !important; border-radius:var(--radius-md) !important;
  background:var(--surface) !important; padding:var(--space-4) var(--space-5) !important; margin:0 0 var(--space-4) !important; }
.cl-legacy details:not(.cl-disclosure, .cl-keep *) > summary { cursor:pointer; font:600 12px/16px var(--font-sans) !important; color:var(--ink) !important; padding:var(--space-2) 0; }
.cl-legacy pre:not(.cl-keep *) { font:11px/16px var(--font-mono) !important; color:var(--ink-muted) !important; }
`;

// Flat demo: the sidebar becomes the floating rail and the canvas goes full-bleed.
const FLAT_LAYOUT_CSS = `
#sidebar.cl-rail { inset:var(--space-4) auto var(--space-4) var(--space-4); width:var(--rail-width); max-width:calc(100vw - 16px);
  padding:0 var(--space-5) var(--space-5); background:var(--rail-glass); border:1px solid var(--line); border-radius:var(--radius-lg); }
#sidebar.cl-rail.is-collapsed { bottom:auto; }
@media (max-width:719px) { #sidebar.cl-rail { inset:auto 0 0 0; width:100%; max-width:none; max-height:62vh; border-radius:var(--radius-lg) var(--radius-lg) 0 0; } }
body:has(#sidebar.cl-rail) #gpuCanvas { position:fixed !important; inset:0 !important; left:0 !important; width:100vw !important; height:100vh !important;
  max-width:none !important; min-height:0 !important; margin:0 !important; border:0 !important; border-radius:0 !important; box-shadow:none !important; background:var(--canvas) !important; }
#sidebar.cl-rail #cloud-quick-dock { width:100%; margin:0 !important; padding:0 !important; border:0 !important; background:transparent !important; box-shadow:none !important; backdrop-filter:none !important; }
#sidebar.cl-rail #cloud-quick-dock .cloud-quick-row { grid-template-columns:repeat(2, minmax(0,1fr)) !important; gap:var(--space-5) var(--space-4) !important; }
#sidebar.cl-rail #cloud-quick-dock .cloud-quick-row > :is(#quick-render-path, small, #frozen-pattern-panel, button) { grid-column:1 / -1; }
#sidebar.cl-rail #quick-render-path { background:var(--surface-inset) !important; border:1px solid var(--line) !important; border-radius:var(--radius-sm) !important; }
#sidebar.cl-rail .cloud-quick-field span, #sidebar.cl-rail .cloud-control-row-label, #sidebar.cl-rail .cloud-control-group-title { font-size:11px !important; letter-spacing:.04em !important; }
#sidebar.cl-rail .panel, #sidebar.cl-rail .cloud-panel { margin:0 0 var(--space-5) !important; border:1px solid var(--line) !important; border-radius:var(--radius-md) !important; background:var(--surface) !important; padding:var(--space-5) !important; }
#sidebar.cl-rail .cloud-control-group { background:transparent !important; border-color:var(--line) !important; border-radius:var(--radius-md) !important; }
#sidebar.cl-rail { z-index:10010; }
#sidebar.cl-rail .cloud-quick-title { display:none !important; }
#sidebar.cl-rail .cl-rail__head #cloud-quick-status { max-width:none; flex:1 1 auto; text-align:left; line-height:16px; }
body:has(#sidebar.cl-rail) #busyOverlay { left:0 !important; width:100vw !important; padding-left:calc(var(--rail-width) + var(--space-4)); box-sizing:border-box; }
@media (max-width:719px) { body:has(#sidebar.cl-rail) #busyOverlay { padding-left:0; } }
#sidebar.cl-rail #flat-studio .cl-btn { height:var(--control-md); min-height:0; padding:0 var(--space-5); border-radius:var(--radius-sm); font-size:13px !important; }
#sidebar.cl-rail #flat-studio .cl-export .cl-btn--sm { height:var(--control-sm); padding:0 var(--space-4); font-size:12px !important; }
#sidebar.cl-rail #flat-studio #quick-playback-slot :is(label, small) { display:none; }
#sidebar.cl-rail #flat-studio #quick-playback-slot > .inline { margin-top:0 !important; }
#sidebar.cl-rail #flat-studio #quick-playback-slot > div > div:last-child { width:auto !important; }
#sidebar.cl-rail #flat-studio #quick-playback-slot > div > div:last-child > div { margin:0 !important; font:500 11px/16px var(--font-mono) !important; color:var(--ink-faint) !important; }
#sidebar.cl-rail #flat-studio #quick-playback-slot > * { display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-4); margin:0; }
#sidebar.cl-rail #flat-studio #quick-playback-slot :is(label, span, div) { color:var(--ink-muted); font-size:12px; }
#sidebar.cl-rail #flat-studio #quick-playback-slot button { height:var(--control-sm); padding:0 var(--space-4); border:1px solid var(--line-strong); border-radius:var(--radius-sm);
  background:var(--surface-raised); color:var(--ink); font:500 12px/16px var(--font-sans); cursor:pointer; }
`;

export function installCloudLabTheme(doc = document) {
  if (!doc.head) return;
  const existing=doc.getElementById('cloud-lab-theme');
  if (existing) { doc.head.appendChild(existing); return; }
  const style = doc.createElement('style');
  style.id = 'cloud-lab-theme';
  style.textContent = TOKENS_CSS + COMPONENT_CSS + LEGACY_CSS + FLAT_LAYOUT_CSS;
  doc.head.appendChild(style);
  if (!doc.getElementById('cloud-lab-fonts')) {
    const link = doc.createElement('link');
    link.id = 'cloud-lab-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
    doc.head.appendChild(link);
  }
}

// ---------- small DOM helpers ----------
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

/** Wrap an existing labeled control as a Cloud Lab field without touching its listeners. */
export function adoptField(label, { text, value = null, caption: captionNode = null } = {}) {
  if (!label) return null;
  const control = label.querySelector('select, input, textarea');
  if (!control) return label;
  // captionNode: keep an existing element the demo writes live text into.
  const caption = el('span', { class: 'cl-field__label' }, captionNode || el('span', { text: text || label.textContent.trim().replace(/\s+/g, ' ') }));
  if (value) { value.classList.add('cl-value'); caption.append(value); }
  label.replaceChildren(caption);
  label.className = 'cl-field';
  label.removeAttribute('style');
  if (control.tagName === 'SELECT') {
    control.removeAttribute('style');
    label.append(el('span', { class: 'cl-select' }, control));
  } else if (control.type === 'range') {
    control.classList.add('cl-slider');
    control.removeAttribute('style');
    syncSliderFill(control);
    label.append(control);
  } else if (control.type === 'checkbox') {
    label.className = 'cl-toggle';
    control.removeAttribute('style');
    label.append(control);
  } else {
    control.classList.add('cl-input');
    control.removeAttribute('style');
    label.append(control);
  }
  return label;
}

export function syncSliderFill(range) {
  const update = () => {
    const min = Number(range.min || 0), max = Number(range.max || 100);
    const pct = max > min ? ((Number(range.value) - min) / (max - min)) * 100 : 0;
    range.style.setProperty('--pct', `${Math.max(0, Math.min(100, pct))}%`);
  };
  if (!range.dataset.clFill) {
    range.dataset.clFill = '1';
    range.addEventListener('input', update);
    range.addEventListener('change', update);
  }
  update();
  return update;
}

export function timestampName(prefix, ext) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function slugify(text, fallback = 'look') {
  const s = String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return s || fallback;
}

/**
 * Rail head: title, status pill, demo switcher, optional collapse button.
 * The existing status element is adopted so the demo keeps writing to it.
 */
export function createRailHead({ title, statusEl, switcher, onToggle }) {
  const titleRow = el('div', { class: 'cl-rail__titlerow' }, el('h1', { class: 'cl-rail__title', text: title }));
  if (statusEl) {
    statusEl.classList.add('cl-status');
    statusEl.removeAttribute('style');
    statusEl.setAttribute('role', 'status');
    titleRow.append(statusEl);
  }
  const head = el('header', { class: 'cl-rail__head cl-keep' }, titleRow);
  if (switcher) {
    switcher.classList.remove('cl-switch--floating');
    switcher.removeAttribute('style');
    head.append(switcher);
  }
  if (onToggle) {
    const btn = el('button', { class: 'cl-btn cl-btn--ghost cl-btn--sm', type: 'button', 'aria-expanded': 'true', text: 'Hide' });
    btn.addEventListener('click', () => {
      const collapsed = onToggle();
      btn.textContent = collapsed ? 'Show' : 'Hide';
      btn.setAttribute('aria-expanded', String(!collapsed));
    });
    titleRow.append(btn);
  }
  head.append(createViewControls());
  return head;
}

/** Screenshot framing affects the page chrome only; the canvas keeps rendering. */
function createViewControls() {
  const clean = el('button', { class: 'cl-btn cl-btn--sm', type: 'button', text: 'Clean view', title: 'Hide all UI · H to toggle, Escape or double-click to restore' });
  const fullscreen = el('button', { class: 'cl-btn cl-btn--sm', type: 'button', text: 'Fullscreen' });
  const tip = el('div', { class: 'cl-view-tip', role: 'status', hidden: true });
  document.body.append(tip);
  let tipTimer;
  const notify = (message) => {
    clearTimeout(tipTimer);
    tip.textContent = message;
    tip.hidden = false;
    tipTimer = setTimeout(() => { tip.hidden = true; }, 2400);
  };
  const showUi = () => {
    document.body.classList.remove('cl-clean-view');
    tip.hidden = true;
    clearTimeout(tipTimer);
  };
  const toggleUi = () => {
    if (document.body.classList.contains('cl-clean-view')) return showUi();
    document.activeElement?.blur();
    document.body.classList.add('cl-clean-view');
    notify('UI hidden · H, Escape or double-click to restore');
  };
  clean.addEventListener('click', toggleUi);
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify('Fullscreen unavailable here. Use your browser’s fullscreen command.');
    }
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
    if (!document.fullscreenElement) showUi();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') return showUi();
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    if (event.key.toLowerCase() === 'h') {
      event.preventDefault();
      toggleUi();
    }
  });
  document.addEventListener('dblclick', () => {
    if (document.body.classList.contains('cl-clean-view')) showUi();
  });
  return el('div', { class: 'cl-view-tools' }, clean, fullscreen);
}

/** Keep the status pill's dot in step with whatever text the demo writes. */
export function watchStatus(statusEl) {
  if (!statusEl) return;
  const classify = () => {
    const t = (statusEl.textContent || '').toLowerCase();
    let state = 'idle';
    if (/fail|error|unavailable|not available|cannot|invalid/.test(t)) state = 'error';
    else if (/start|bak|load|init|generat|compil|render(ing)?\b.*\.\.\.|…|\.\.\.|working|busy|queued/.test(t)) state = 'busy';
    else if (/fps|ms\b|ready|preview ready|animating|live/.test(t)) state = 'live';
    statusEl.dataset.state = state;
    statusEl.title = statusEl.textContent || '';
  };
  classify();
  new MutationObserver(classify).observe(statusEl, { childList: true, characterData: true, subtree: true });
}

/**
 * The artist-facing card: preset, a few look controls, and ways to get the
 * result out. Handlers are async; the card reports progress itself.
 *
 *  presetFields  labels (already adopted) shown full width at the top
 *  lookFields    labels shown in a two-column grid
 *  actions       [{label, onClick, primary}] shown as a button row
 *  extra         nodes appended after the actions (e.g. playback)
 *  look          {saveImage, getLook, applyLook, name()}  — export handlers
 */
export function createStudioCard({ presetFields = [], lookFields = [], actions = [], extra = [], look }) {
  const card = el('section', { class: 'cl-preset cl-keep', 'aria-label': 'Studio' });
  card.append(el('div', { class: 'cl-advanced-head' }, el('h2', { class: 'cl-section', text: 'Studio' }), el('span', { class: 'cl-hint', text: 'Pick a preset, adjust, export' })));
  for (const field of presetFields.filter(Boolean)) card.append(field);
  const looks = lookFields.filter(Boolean);
  if (looks.length) card.append(el('div', { class: 'cl-preset__grid' }, ...looks));
  if (actions.length) {
    const row = el('div', { class: 'cl-btnrow' });
    for (const action of actions) {
      const btn = action.button || el('button', { type: 'button', text: action.label });
      btn.className = `cl-btn${action.primary ? ' cl-btn--primary' : ''}`;
      btn.removeAttribute('style');
      if (action.label) btn.textContent = action.label;
      if (action.onClick) btn.addEventListener('click', action.onClick);
      row.append(btn);
    }
    card.append(row);
  }
  for (const node of extra.filter(Boolean)) card.append(node);

  const status = el('p', { class: 'cl-hint cl-export__status', role: 'status', 'aria-live': 'polite' });
  const setStatus = (text, state = '') => { status.textContent = text || ''; status.dataset.state = state; };

  if (look) {
    const saveBtn = el('button', { class: 'cl-btn cl-btn--primary cl-btn--block', type: 'button', text: 'Save image' });
    const copyBtn = el('button', { class: 'cl-btn cl-btn--sm', type: 'button', text: 'Copy look' });
    const pasteBtn = el('button', { class: 'cl-btn cl-btn--sm', type: 'button', text: 'Paste look' });
    const downloadBtn = el('button', { class: 'cl-btn cl-btn--sm', type: 'button', text: 'Download .json' });
    const openBtn = el('button', { class: 'cl-btn cl-btn--sm', type: 'button', text: 'Open .json' });
    const fileInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: '' });

    const busy = async (btn, label, fn) => {
      const original = btn.textContent;
      btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = label;
      try { await fn(); }
      catch (err) { console.error(err); setStatus(String(err?.message || err), 'error'); }
      finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = original; }
    };
    const lookJson = () => JSON.stringify(look.getLook(), null, 2);
    const applyText = async (text, source) => {
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`That ${source} isn't valid look JSON.`); }
      setStatus('Applying look…');
      await look.applyLook(data);
      setStatus(`Applied look from ${source}.`);
    };

    saveBtn.addEventListener('click', () => busy(saveBtn, 'Saving…', async () => {
      const blob = await look.saveImage();
      if (!blob) throw new Error('Nothing to save yet. Wait for the first render.');
      const name = timestampName(slugify(look.name?.(), 'clouds'), 'png');
      downloadBlob(blob, name);
      setStatus(`Saved ${name}`);
    }));
    copyBtn.addEventListener('click', () => busy(copyBtn, 'Copying…', async () => {
      const text = lookJson();
      window.cloudLabLastLook = JSON.parse(text);
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable. Use Download .json.');
      await navigator.clipboard.writeText(text);
      setStatus('Look copied. Paste it here later or share it.');
    }));
    pasteBtn.addEventListener('click', () => busy(pasteBtn, 'Pasting…', async () => {
      let text = '';
      try { text = await navigator.clipboard.readText(); } catch {}
      if (!text) text = window.prompt('Paste look JSON') || '';
      if (!text.trim()) return setStatus('');
      await applyText(text, 'clipboard');
    }));
    downloadBtn.addEventListener('click', () => {
      try {
        const name = timestampName(slugify(look.name?.(), 'look'), 'json');
        downloadBlob(new Blob([lookJson()], { type: 'application/json' }), name);
        setStatus(`Saved ${name}`);
      } catch (err) { setStatus(String(err?.message || err), 'error'); }
    });
    openBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      busy(openBtn, 'Opening…', async () => applyText(await file.text(), file.name));
    });

    card.append(el('div', { class: 'cl-export' },
      saveBtn,
      el('div', { class: 'cl-export__grid' }, copyBtn, pasteBtn, downloadBtn, openBtn),
      fileInput,
      status));
  } else {
    card.append(status);
  }
  return { element: card, setStatus };
}

/** Wrap nodes in a closed Cloud Lab disclosure. */
export function createDisclosure(title, nodes = [], { open = false, id } = {}) {
  const details = el('details', { class: 'cl-disclosure', id });
  details.open = open;
  details.append(el('summary', { text: title }), el('div', { class: 'cl-disclosure__body' }, ...nodes.filter(Boolean)));
  return details;
}

// ---------- generic control snapshots (flat demo looks) ----------
const SKIP_INPUT_TYPES = new Set(['button', 'submit', 'reset', 'file', 'image', 'hidden', 'password']);

/** Every id'd input/select under root as {id: value}. */
export function snapshotControls(root, { exclude = () => false } = {}) {
  const values = {};
  for (const node of root.querySelectorAll('input[id], select[id], textarea[id]')) {
    if (SKIP_INPUT_TYPES.has(node.type) || exclude(node)) continue;
    values[node.id] = node.type === 'checkbox' || node.type === 'radio' ? node.checked : node.value;
  }
  return values;
}

/**
 * Write a snapshot back, firing the same events a person would. `first`
 * ids are applied (with events) before the rest so presets that overwrite
 * other fields run first and are then refined by the saved values.
 */
export async function applyControlSnapshot(values, { first = [], settle = () => Promise.resolve() } = {}) {
  const set = (id, value) => {
    const node = document.getElementById(id);
    if (!node || node.disabled) return false;
    if (node.type === 'checkbox' || node.type === 'radio') {
      if (node.checked === !!value) return false;
      node.checked = !!value;
    } else {
      if (node.tagName === 'SELECT' && ![...node.options].some((o) => o.value === String(value))) return false;
      if (node.value === String(value)) return false;
      node.value = String(value);
    }
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  for (const id of first) {
    if (id in values && set(id, values[id])) await settle();
  }
  let changed = 0;
  for (const [id, value] of Object.entries(values)) {
    if (first.includes(id)) continue;
    if (set(id, value)) changed++;
  }
  return changed;
}
