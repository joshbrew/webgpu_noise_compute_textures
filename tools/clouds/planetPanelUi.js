// Planet rail specifics. The shared look lives in cloudLabUi.js; this only
// pins the apply bar to the bottom of the planet rail and sizes the
// advanced editor grids for the 360px rail.
export function stylePlanetPanel(hud) {
  hud.id = 'planet-controls';
  const style = document.createElement('style');
  style.textContent = `
    #planet-controls #planet-edit-actions { position:sticky; bottom:calc(-1 * var(--space-5)); z-index:2;
      margin:var(--space-5) calc(-1 * var(--space-5)) calc(-1 * var(--space-5)); border-top:1px solid var(--line); }
    #planet-controls .cl-tabs { margin-top:var(--space-4); }
    #planet-controls .cl-legacy > div[style*="display: grid"], #planet-controls .cl-legacy > div[style*="display:grid"] { gap:var(--space-4) !important; }
    #planet-controls .cl-disclosure + .cl-disclosure, #planet-controls .cl-legacy .cl-disclosure { margin-top:var(--space-4); }
    #planet-controls .cl-legacy label { gap:var(--space-2) !important; }
  `;
  hud.prepend(style);
}

export function planetDisclosure(title, ...nodes) {
  const details = document.createElement('details');
  details.className = 'cl-disclosure';
  const summary = document.createElement('summary');
  summary.textContent = title;
  const body = document.createElement('div');
  body.className = 'cl-disclosure__body';
  body.append(...nodes);
  details.append(summary, body);
  return details;
}
