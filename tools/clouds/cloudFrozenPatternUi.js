import {FROZEN_PATTERN_PRESETS,normalizeFrozenPattern,frozenPatternPreset} from './cloudFrozenPattern.js';
import {adoptField} from './cloudLabUi.js';
export function mountFrozenPatternControls({parent,getPattern,onChange,getSupported,getCanFreeze,getSceneKey,getDimensions}){
 const panel=document.createElement('section');panel.id='frozen-pattern-panel';panel.style.cssText='display:grid;gap:8px;grid-column:1/-1';
 panel.innerHTML=`<label class="cloud-quick-field"><span>Cloud patterns</span><select id="frozen-pattern-preset">${Object.entries(FROZEN_PATTERN_PRESETS).map(([key,p])=>`<option value="${key}">${p.label}</option>`).join('')}<option value="custom">Custom slice subset</option></select></label>
  <details class="cl-disclosure"><summary>Slice & repeat settings</summary><div class="cl-disclosure__body" style="display:grid;gap:8px">
  <p class="cl-hint">Choose one plane, a range, or spaced slices. Live slices keep evolving; frozen volumes hold their shape and lighting, then scroll and repeat with Animate clouds.</p>
  <label class="cloud-quick-field"><span>Freeze shape and lighting</span><input id="frozen-pattern-held" type="checkbox"></label>
  <div id="frozen-pattern-options" style="display:grid;gap:8px;margin-top:9px">
   <label class="cloud-quick-field"><span>Slice direction</span><select id="frozen-pattern-axis"><option value="0">Full volume</option><option value="2">Horizontal · Y</option><option value="1">Vertical · X</option><option value="3">Vertical · Z</option></select></label>
   <label class="cloud-quick-field"><span>First slice <b id="frozen-pattern-first-label"></b></span><input id="frozen-pattern-first" type="range" min="0" max="100" step="1"></label>
   <label class="cloud-quick-field"><span>Last slice <b id="frozen-pattern-last-label"></b></span><input id="frozen-pattern-last" type="range" min="0" max="100" step="1"></label>
   <label class="cloud-quick-field"><span>Every N slices</span><input id="frozen-pattern-spacing" type="number" min="1" max="128" step="1"></label>
   <label class="cloud-quick-field"><span>Layer thickness <b id="frozen-pattern-thickness-label"></b></span><input id="frozen-pattern-thickness" type="range" min="0.1" max="128" step="0.1"></label>
   <label class="cloud-quick-field"><span>Repeat size × <b id="frozen-pattern-repeat-label"></b></span><input id="frozen-pattern-repeat" type="range" min="0.25" max="8" step="0.05"></label>
   <label class="cloud-quick-field"><span>Scroll speed × <b id="frozen-pattern-speed-label"></b></span><input id="frozen-pattern-speed" type="range" min="0" max="8" step="0.1"></label>
   <button id="frozen-pattern-recapture" type="button">Capture current clouds again</button>
  </div><small id="frozen-pattern-status" class="cl-hint"></small></div></details>`;
 panel.querySelectorAll('label').forEach(label=>adoptField(label,{caption:label.querySelector('span')}));
 parent.append(panel);
 const el=id=>panel.querySelector('#frozen-pattern-'+id);let scene=getSceneKey();
 const refresh=()=>{
  const supported=getSupported(),nextScene=getSceneKey();let p=normalizeFrozenPattern(getPattern());
  if(nextScene!==scene){scene=nextScene;if(p.enabled){p=frozenPatternPreset('live',p);onChange(p,{render:false});}}
  const canFreeze=getCanFreeze();
  el('preset').disabled=!supported;el('preset').value=p.preset;
  for(const option of el('preset').options)option.disabled=!canFreeze && !!FROZEN_PATTERN_PRESETS[option.value]?.enabled;
  el('held').disabled=!canFreeze;el('held').checked=p.enabled;
  const visible=p.enabled||p.axis>0;
  el('options').hidden=!visible;el('options').style.display=visible?'grid':'none';
  for(const key of ['axis','spacing','thickness','repeat','speed'])el(key).value=String(p[key]);
  const count=getDimensions()[Math.max(p.axis-1,0)];
  for(const key of ['first','last']){el(key).max=String(count-1);el(key).value=String(Math.round(p[key]*(count-1)));el(key+'-label').textContent=`${Math.round(p[key]*(count-1))} / ${count-1}`;}
  for(const key of ['thickness','repeat','speed'])el(key+'-label').textContent=p[key].toFixed(2);
  for(const key of ['first','last','spacing','thickness']){
   el(key).disabled=p.axis===0;el(key).closest('label').style.display=p.axis===0?'none':'';
  }
  for(const key of ['repeat','speed','recapture']){
   el(key).disabled=!p.enabled;(key==='recapture'?el(key):el(key).closest('label')).style.display=p.enabled?'':'none';
  }
  el('status').textContent=p.enabled?'Captured shape and lighting stay fixed. Repeat size uses the captured cloud cell; sky span controls how far it repeats.':p.axis>0?'Live slices use the current renderer and animation. Select the same first and last index for one specific plane.':'Live clouds evolve normally. Slice styles work with both renderers; freezing uses a cached 3D volume preset.';
 };
 const change=p=>{onChange(normalizeFrozenPattern(p),{render:true});refresh();};
 el('preset').addEventListener('change',()=>{const p=getPattern();change(el('preset').value==='custom'?{...p,axis:p?.axis||2,preset:'custom'}:frozenPatternPreset(el('preset').value,p));});
 el('held').addEventListener('change',()=>change({...getPattern(),enabled:el('held').checked,preset:'custom'}));
 for(const key of ['axis','first','last','spacing','thickness','repeat','speed'])el(key).addEventListener(key==='axis'?'change':'input',()=>{
  const p=normalizeFrozenPattern(getPattern());const count=getDimensions()[Math.max(p.axis-1,0)];p[key]=Number(el(key).value)/(key==='first'||key==='last'?count-1:1);p.preset='custom';change(p);
 });
 el('recapture').addEventListener('click',()=>change({...getPattern(),capture:(getPattern()?.capture||0)+1}));
 refresh();return {refresh,adoptScene(){scene=getSceneKey();refresh();}};
}
