const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const number=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback;
export const FROZEN_PATTERN_PRESETS=Object.freeze({
 live:{label:'Live clouds',enabled:false,axis:0},
 volume:{label:'Frozen repeating volume',enabled:true,axis:0},
 live_plane:{label:'Live · single horizontal plane',enabled:false,axis:2,first:.5,last:.5,spacing:1,thickness:32},
 live_decks:{label:'Live · spaced horizontal decks',enabled:false,axis:2,first:.25,last:.8,spacing:16,thickness:16},
 live_curtains_x:{label:'Live · vertical curtains · X',enabled:false,axis:1,first:.15,last:.85,spacing:16,thickness:16},
 live_curtains_z:{label:'Live · vertical curtains · Z',enabled:false,axis:3,first:.15,last:.85,spacing:16,thickness:16},
 live_sparse:{label:'Live · sparse horizontal layers',enabled:false,axis:2,first:0,last:1,spacing:32,thickness:32},
 live_subset:{label:'Live · continuous horizontal range',enabled:false,axis:2,first:.35,last:.65,spacing:1,thickness:1},
 live_subset_x:{label:'Live · continuous vertical range · X',enabled:false,axis:1,first:.35,last:.65,spacing:1,thickness:1},
 live_subset_z:{label:'Live · continuous vertical range · Z',enabled:false,axis:3,first:.35,last:.65,spacing:1,thickness:1},
 plane:{label:'Frozen · single horizontal plane',enabled:true,axis:2,first:.5,last:.5,spacing:1,thickness:32},
 decks:{label:'Frozen · spaced horizontal decks',enabled:true,axis:2,first:.25,last:.8,spacing:16,thickness:16},
 curtains_x:{label:'Frozen · vertical curtains · X',enabled:true,axis:1,first:.15,last:.85,spacing:16,thickness:16},
 curtains_z:{label:'Frozen · vertical curtains · Z',enabled:true,axis:3,first:.15,last:.85,spacing:16,thickness:16},
 sparse:{label:'Frozen · sparse horizontal layers',enabled:true,axis:2,first:0,last:1,spacing:32,thickness:32},
 subset:{label:'Frozen · continuous horizontal range',enabled:true,axis:2,first:.35,last:.65,spacing:1,thickness:1},
 subset_x:{label:'Frozen · continuous vertical range · X',enabled:true,axis:1,first:.35,last:.65,spacing:1,thickness:1},
 subset_z:{label:'Frozen · continuous vertical range · Z',enabled:true,axis:3,first:.35,last:.65,spacing:1,thickness:1},
});
export function normalizeFrozenPattern(value={}){
 const first=clamp(number(value.first,0),0,1);
 return {enabled:!!value.enabled,preset:value.preset||(value.enabled?'custom':'live'),axis:clamp(Math.round(number(value.axis,0)),0,3),
  first,last:clamp(number(value.last,1),first,1),spacing:clamp(Math.round(number(value.spacing,8)),1,128),
  thickness:clamp(number(value.thickness,1.5),.1,128),repeat:clamp(number(value.repeat,1),.25,8),
  speed:clamp(number(value.speed,1),0,8),capture:Math.max(0,Math.floor(number(value.capture,0)))};
}
export function frozenPatternPreset(name,previous={}){
 const preset=FROZEN_PATTERN_PRESETS[name]||FROZEN_PATTERN_PRESETS.live;
 return normalizeFrozenPattern({...previous,...preset,preset:name});
}
// Shared interval selection for diagnostics and the controls' layer count.
export function frozenPatternIndices(pattern,count){
 const p=normalizeFrozenPattern(pattern),first=Math.round(p.first*(count-1)),last=Math.round(p.last*(count-1));
 return Array.from({length:Math.floor((last-first)/p.spacing)+1},(_,i)=>first+i*p.spacing);
}
