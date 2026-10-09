// Scoped styles keep the experimental planet controls readable without
// changing the flat cloud lab or the renderer's controls.
export function stylePlanetPanel(hud) {
  hud.id = 'planet-controls';
  const style = document.createElement('style');
  style.textContent = `
    #planet-controls { width:min(370px,calc(100vw - 16px)) !important;
      min-width:0 !important; max-width:370px !important; padding:14px !important;
      color:#e8eefc; font:12px/1.4 system-ui,sans-serif; scrollbar-width:thin; }
    #planet-controls button { min-height:30px; font:11px/1.3 system-ui,sans-serif !important;
      padding:6px 9px !important; border-radius:7px !important; }
    #planet-controls button:hover { background:#263c56 !important; }
    #planet-controls button:focus-visible, #planet-controls input:focus-visible,
    #planet-controls select:focus-visible { outline:2px solid #9bd5ff !important; outline-offset:2px; }
    #planet-controls label { font-size:11px !important; line-height:1.4; gap:5px !important; }
    #planet-controls label > span { white-space:normal !important; }
    #planet-controls select { min-height:36px !important; padding:7px 9px !important;
      font:12px/1.3 system-ui,sans-serif !important; background:#101c2b !important; color:#eef6ff; }
    #planet-controls option { background:#101c2b; color:#eef6ff; }
    #planet-controls input:not([type=checkbox]):not([type=color]) { min-height:30px; padding:5px 7px !important;
      font:12px/1.3 system-ui,sans-serif !important; }
    #planet-controls details { border:1px solid #2c3b4f; border-radius:8px; margin:8px 0; padding:8px; }
    #planet-controls summary { cursor:pointer; font:600 12px/1.4 system-ui,sans-serif; color:#bdd9f2; }
    #planet-controls details[open] > summary { margin-bottom:10px; }
    #planet-presets { display:grid; gap:12px; padding:14px; margin:12px 0;
      border:1px solid #3c5a77; border-radius:10px; background:linear-gradient(145deg,#192c40,#101b2a); }
    #planet-presets label { display:grid !important; grid-template-columns:1fr !important; }
    #planet-presets label > span { color:#c2d9ee; font-weight:600; }
    #planet-presets select { min-height:40px !important; font-size:13px !important; }
    #planet-edit-actions { position:sticky; bottom:-14px; display:grid; gap:8px; padding:12px 0;
      background:#0c1420; border-top:1px solid #304158; z-index:2; }
    #planet-apply-edits { background:#244c70 !important; border-color:#6da8d9 !important; }
    #planet-edit-status { font:11px/1.4 system-ui,sans-serif !important; color:#b6cce0 !important; }
    #planet-controls [data-panel-title] { font:600 14px/1.3 system-ui,sans-serif !important; }
  `;
  hud.prepend(style);
}

export function planetDisclosure(title, ...nodes) {
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = title;
  details.append(summary, ...nodes);
  return details;
}
