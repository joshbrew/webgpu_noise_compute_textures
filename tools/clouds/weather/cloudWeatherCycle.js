// A deterministic, looping weather director, not a physical atmosphere solver.
// Stable cells/noise persist; only their development, coverage and light evolve.
import { ANVIL_FORM, ANVIL_PARAMS, ANVIL_TUNING } from './cloudAnvilLook.js';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = x => { x = clamp(x, 0, 1); return x*x*(3-2*x); };
const mix = (a,b,t) => a+(b-a)*t;
const color = (a,b,t) => a.map((v,i)=>mix(v,b[i],t));
const wrap = (x,n) => ((x%n)+n)%n;
const finite = (x,fallback) => Number.isFinite(Number(x)) ? Number(x) : fallback;

// More weather systems do not require more baked textures or shader variants.
export const WEATHER_MAP_COUNT = 6;
export const WEATHER_STATES = Object.freeze([
  {name:'Broken cumulus',coverage:.64,density:8.5,storm:0,sparsity:.58,definition:.70,shelf:0,deck:0,wisps:0},
  {name:'Fair cumulus',coverage:.88,density:9,storm:.08,sparsity:.40,definition:.62,shelf:0,deck:0,wisps:0},
  {name:'Building towers',coverage:.94,density:10.5,storm:.65,sparsity:.34,definition:.68,shelf:0,deck:0,wisps:0},
  {name:'Anvil storms',coverage:ANVIL_PARAMS.globalCoverage,density:ANVIL_PARAMS.globalDensity,storm:ANVIL_PARAMS.cloudAnvilAmount,sparsity:ANVIL_TUNING.sparsity,definition:ANVIL_TUNING.definition,shelf:0,deck:0,wisps:0},
  {name:'Rain Shelf',coverage:1.06,density:11.5,storm:.85,sparsity:.18,definition:.64,shelf:1,deck:0,wisps:0},
  {name:'Widespread rain banks',coverage:1.12,density:12,storm:.75,sparsity:.10,definition:.55,shelf:.65,deck:.35,wisps:0},
  {name:'Asperitas waves',coverage:1.04,density:10.5,storm:.35,sparsity:.12,definition:.64,shelf:0,deck:0,wisps:0,asperitas:1},
  {name:'Overcast stratus',coverage:1.10,density:9,storm:.30,sparsity:.06,definition:.42,shelf:0,deck:1,wisps:0},
  {name:'Breaking stratus',coverage:.77,density:7,storm:.12,sparsity:.35,definition:.55,shelf:0,deck:.65,wisps:0},
  {name:'Wispy high',coverage:.70,density:4,storm:0,sparsity:.58,definition:.48,shelf:0,deck:0,wisps:1},
  {name:'Feather cirrus',coverage:.82,density:4.5,storm:0,sparsity:.50,definition:.56,shelf:0,deck:0,wisps:0,cirrus:1},
  {name:'Clearing cumulus',coverage:.80,density:9,storm:.04,sparsity:.46,definition:.66,shelf:0,deck:0,wisps:.15},
]);

export function normalizeWeatherCycle(config = {}) {
  return {
    enabled: config.enabled === true,
    timeOfDay: config.timeOfDay !== false,
    weatherSeconds: clamp(finite(config.weatherSeconds,420),30,7200),
    daySeconds: clamp(finite(config.daySeconds,180),12,7200),
    startHour: wrap(finite(config.startHour,9),24),
  };
}

export function sampleWeatherCycle(seconds, options = {}) {
  const config = normalizeWeatherCycle(options);
  const elapsed = Math.max(0,finite(seconds,0));
  const position = wrap(elapsed/config.weatherSeconds,1)*WEATHER_STATES.length;
  const index = Math.floor(position), next = (index+1)%WEATHER_STATES.length;
  const blend = smooth(position-index);
  const a=WEATHER_STATES[index], b=WEATHER_STATES[next];
  const weather = Object.fromEntries(['coverage','density','storm','sparsity','definition','shelf','deck','wisps','cirrus','fluctus','asperitas'].map(k=>[k,mix(a[k]??0,b[k]??0,blend)]));
  // The map clock remains continuous and bounded independently of the number
  // of morphology stages, including the wrap from the last stage to the first.
  const mapPosition=wrap(elapsed/config.weatherSeconds,1)*WEATHER_MAP_COUNT;
  const mapIndex=Math.floor(mapPosition),mapBlend=smooth(mapPosition-mapIndex);
  const hour = wrap(config.startHour+elapsed/config.daySeconds*24,24);
  const solar = Math.sin((hour-6)/24*Math.PI*2);
  const day = smooth((solar+.12)/.32);
  const dusk = Math.exp(-Math.pow(solar/.22,2));
  const moon = solar < 0;
  // The single cached directional-light source hands off at the horizon, where
  // both intensities fade to zero. No abrupt bright sun-to-moon shadow flip.
  const visibility = smooth(Math.abs(solar)/.18);
  const warmLight = hour<12 ? [1,.66,.38] : [1,.40,.18];
  const light = color([.48,.65,1],color(warmLight,[1,.97,.90],smooth(solar/.55)),day);
  const intensity = visibility*(moon ? .30 : 1.45);
  const sky = color([.010,.018,.045],color([.08,.13,.28],[.24,.48,.76],smooth(solar/.50)),day);
  const stormShade = 1-weather.storm*.18;
  const greyAmount=clamp(weather.shelf*.45+weather.deck*.55,0,.65);
  const weatherSky=color(sky,sky.map(()=>sky.reduce((sum,v)=>sum+v,0)/3),greyAmount);
  return {
    index,next,blend,mapIndex,mapBlend,weather,hour,moon,day,dusk,visibility,
    label:`${a.name} → ${b.name}`,
    sun:{azDeg:wrap(90+(hour-6)*15+(moon?180:0),360),elDeg:Math.asin(Math.abs(solar)*.90)*180/Math.PI,bloom:moon?.03:.22},
    sky:weatherSky.map(v=>v*stormShade),
    lightColor:light.map(v=>v*intensity),lightTint:light,
    lightIntensity:intensity,
    shadowColor:color([.10,.16,.28],[.31,.40,.57],day),
    celestialColor:light.map(v=>v*(moon?.22:1)),
    // Keep cell scale/height variation fixed during the loop: switching their
    // domain as a storm approaches would move/rebuild the entire population.
    // At mature anvil weather this is the exact standalone density/lighting look.
    tuning:{...ANVIL_TUNING,formType:4,sparsity:weather.sparsity,definition:weather.definition},
    cloudParams:{...ANVIL_PARAMS,globalCoverage:weather.coverage,globalDensity:weather.density,cloudAnvilAmount:weather.storm},
    fieldProfile:{shelf:weather.shelf,deck:weather.deck,wisps:weather.wisps,cirrus:weather.cirrus,fluctus:weather.fluctus,asperitas:weather.asperitas},
  };
}

export function cyclePreview(base, state, timeOfDay) {
  const preview={...base,weatherCycle:true,volumeShape:'box',box:{center:[base.box?.center?.[0]||0,ANVIL_FORM.halfY-.3,base.box?.center?.[2]||0],half:[base.box?.half?.[0]||18,ANVIL_FORM.halfY,base.box?.half?.[2]||18],uvScale:base.box?.uvScale||1}};
  if(timeOfDay) Object.assign(preview,{
    sun:state.sun,sky:state.sky,gradeStyle:0,skyCycle:true,nightAmount:1-state.day,
    celestialVisibility:state.visibility,sunTint:state.celestialColor,
    cloudLitTint:[1,1,1],cloudShadowTint:[.70,.80,1],edgeTint:[1,1,1],
    exposure:mix(2.2,1.1,state.day),fogDensity:.10,fogSun:.10,styleShadowStrength:.75,styleShadowDarkness:0,
    styleColorLift:1,styleSaturation:1,godRaysEnabled:!state.moon,godRayStrength:.12*state.visibility,
  });
  if(timeOfDay && base.cycleStyleOverride) {
    // Restore only appearance overwritten by TOD. Geometry and both clocks
    // remain the director's; never write evolving values into the saved look.
    for(const key of ['gradeStyle','cloudLitTint','cloudShadowTint','edgeTint',
      'fogDensity','fogSun','styleShadowStrength','styleShadowDarkness',
      'styleColorLift','styleSaturation']) {
      if(base[key] !== undefined) preview[key]=base[key];
    }
    preview.styleSkyOverride=true;
    const nightScale=mix(.035,1,state.day);
    preview.sky=(base.sky||[.3,.4,.6]).map(v=>v*nightScale*(1-state.weather.storm*.12));
    preview.sun={...state.sun,bloom:(base.sun?.bloom??.18)*mix(.25,1,state.day)};
    const twilightTint=color([1,1,1],state.lightTint,state.moon?0:state.dusk*.90);
    preview.sunTint=(base.sunTint||[1,1,1]).map((v,i)=>v*twilightTint[i]*(state.moon?.22:1));
    preview.exposure=(base.exposure??1.1)*mix(2,1,state.day);
    preview.godRaysEnabled=!!base.godRaysEnabled && !state.moon;
    preview.godRayStrength=(base.godRayStrength??0)*state.visibility;
  }
  return preview;
}

export function cycleCloudParams(base, state, timeOfDay, look = {}) {
  const params={...base,...state.cloudParams};
  if(!timeOfDay) return params;
  if(look.cycleStyleOverride) {
    const source=look.sunTint||[1,1,1];
    // Keep the authored palette, but allow the low sun to warm its lighting.
    // The old override changed brightness alone and hid both golden hours.
    const twilightTint=color([1,1,1],state.lightTint,state.moon?0:state.dusk*.90);
    const tintLight=tint=>(tint||[1,1,1]).map((v,i)=>v*source[i]*twilightTint[i]*state.lightIntensity);
    params.frontLightColor=tintLight(look.frontLightTint);
    params.sunColor=tintLight(look.transmissiveLightTint);
    params.shadowLightColor=(look.volumeShadowTint||[.3,.4,.6]).map(v=>v*mix(.20,1,state.day));
  } else {
    params.frontLightColor=state.lightColor;
    params.sunColor=state.lightColor;
    params.shadowLightColor=state.shadowColor;
  }
  return params;
}
