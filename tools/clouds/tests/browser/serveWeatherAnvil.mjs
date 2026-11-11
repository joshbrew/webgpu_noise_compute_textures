// Manual WebGPU parity test and actual flat-demo visual review. Build outputs
// live in a temporary directory; production code has no test clock/readback.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
let esbuild;
try{esbuild=require(process.env.ESBUILD_MODULE||'esbuild');}
catch(error){
 if(process.env.ESBUILD_MODULE||!process.env.APPDATA)throw error;
 esbuild=require(join(process.env.APPDATA,'npm/node_modules/tinybuild/node_modules/esbuild'));
}
const {build}=esbuild;
const temp=await mkdtemp(join(tmpdir(),'cloud-anvil-check-'));
const source=x=>fileURLToPath(new URL(x,import.meta.url));
const loader={'.wgsl':'text','.glsl':'text','.html':'text'};
await build({entryPoints:[source('./cloudTurbulenceSafety.js')],outfile:join(temp,'turbulence-safety.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('./cloudTurbulencePerformance.js')],outfile:join(temp,'turbulence-performance.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('./cloudFrozenPatternChecks.js')],outfile:join(temp,'frozen-pattern.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('./cloudHorizonPerformance.js')],outfile:join(temp,'horizon-performance.js'),bundle:true,format:'esm',platform:'browser',loader});
// Optional negative control for the identity regression. Only the diagnostic
// bundle is changed; the production shader and /demo remain untouched.
const checkPlugins=process.env.CLOUD_POP_BASELINE==='1'?[{name:'old-storm-identity',setup(b){
 b.onLoad({filter:/cloudFields\.wgsl$/},async({path})=>({loader:'text',contents:(await readFile(path,'utf8'))
  .replace('cloudCellRandom(id, 237.9) < 0.27','cloudCellRandom(id, 237.9) < mix_f(0.12, 0.36, saturate(weather.g))')}));
}}]:[];
const marchPlugins=process.env.CLOUD_MARCH_BASELINE==='1'?[{name:'coarse-surface-negative-control',setup(b){
 b.onLoad({filter:/cloudLayer\.wgsl$/},async({path})=>({loader:'text',contents:(await readFile(path,'utf8'))
  .replace('refineCloudInterval && !sphericalCloudMode()', 'false')
  .replace('!sphericalCloudMode() && !refineCloudInterval && surfaceNeedsRefinement', 'false')
  .replace('let sampleStepLen = select(stepLen, clamp(stepLen * stepBoost, TUNE.minStep, auroraStepLimit), sphericalCloudMode());', 'let sampleStepLen = clamp(stepLen * stepBoost, TUNE.minStep, auroraStepLimit);')}));
}}]:[];
const reliefPlugins=process.env.CLOUD_RELIEF_BASELINE==='1'?[{name:'clipped-relief-negative-control',setup(b){
 b.onLoad({filter:/cloudCommon\.wgsl$/},async({path})=>({loader:'text',contents:(await readFile(path,'utf8'))
  .replace(/fn sampleShapeRelief\([\s\S]*?(?=fn approxShapeNormal\()/,'fn sampleShapeRelief(pos:vec3<f32>,ph:f32,lod:f32)->f32 { return sampleShapeRGBA(pos,ph,lod).r; }\n')}));
}}]:[];
const boundsPlugins=process.env.CLOUD_FLAT_BOUNDS_BASELINE==='1'?[{name:'clipped-weather-headroom-negative-control',setup(b){
 b.onLoad({filter:/cloudLayer\.wgsl$/},async({path})=>({loader:'text',contents:(await readFile(path,'utf8'))
  .replace('let topHeadroom = select(layerHeight * abs(TUNE.topJitterFrac), 0.0, sphericalCloudMode());','let topHeadroom = 0.0;')}));
}}]:[];
const cardPlugins=process.env.CLOUD_FLAT_CARD_BASELINE==='1'?[{name:'view-dependent-opacity-negative-control',setup(b){
 b.onLoad({filter:/cloudLayer\.wgsl$/},async({path})=>({loader:'text',contents:(await readFile(path,'utf8'))
  .replace('cloudModeF32(0.0, shellFrontCardOcclusion, shellFrontCardOcclusion)','cloudModeF32(viewFrontCardOcclusion, shellFrontCardOcclusion, shellFrontCardOcclusion)')}));
}}]:[];
const stabilityPlugins=process.env.CLOUD_STABILITY_BASELINE==='1'?[{name:'camera-ladder-negative-control',setup(b){
 b.onLoad({filter:/[\\/]shaders[\\/]clouds\.wgsl$/},async()=>({loader:'text',contents:await readFile(source('./clouds_default-baseline.wgsl'),'utf8')}));
 b.onLoad({filter:/[\\/]shaders[\\/]cloudLayer\.wgsl$/},async()=>({loader:'text',contents:await readFile(source('./cloudLayer_default-baseline.wgsl'),'utf8')}));
}}]:[];
const planesPlugins=process.env.CLOUD_PLANES_BASELINE==='1'?[{name:'procedural-planes-negative-control',setup(b){
 b.onLoad({filter:/[\\/]shaders[\\/]cloudsRender\.wgsl$/},async()=>({loader:'text',contents:await readFile(source('./cloudsRender_cell-baseline.wgsl'),'utf8')}));
 b.onLoad({filter:/[\\/]shaders[\\/]cloudLayer\.wgsl$/},async()=>({loader:'text',contents:await readFile(source('./cloudLayer_planes-baseline.wgsl'),'utf8')}));
}}]:[];
const intervalPlugins=process.env.CLOUD_INTERVAL_BASELINE==='1'?[{name:'camera-interval-baseline',setup(b){
 b.onLoad({filter:/[\\/]shaders[\\/]clouds\.wgsl$/},async()=>({loader:'text',contents:await readFile(source('./clouds_interval-baseline.wgsl'),'utf8')}));
 b.onLoad({filter:/cloudTerrainMesh\.js$/},async()=>({loader:'js',contents:await readFile(source('./terrain_interval-baseline.txt'),'utf8')}));
 b.onLoad({filter:/[\\/]clouds\.js$/},async({path})=>({loader:'js',contents:(await readFile(path,'utf8'))
  .replace("frontFace:'cw',cullMode:'back'","cullMode:'none'")
  .replace('@location(1) color:vec3<f32>','@location(1) normal:vec3<f32>')
  .replace('out.world=p;out.color=cloudTerrainColor(p,n,normalize(sun.direction));return out;','out.world=p;out.normal=n;return out;')
  .replace('vec4<f32>(v.color,length(v.world-V.camPos))','vec4<f32>(cloudTerrainColor(v.world,normalize(v.normal),normalize(sun.direction)),length(v.world-V.camPos))')}));

}}]:[];
await build({entryPoints:[source('./cloudGodRayChecks.js')],outfile:join(temp,'god-ray-checks.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('./cloudStormShapeChecks.js')],outfile:join(temp,'storm-shape-checks.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('./cloudStormMotionChecks.js')],outfile:join(temp,'storm-motion-checks.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('./cloudCellSeams.js')],outfile:join(temp,'cell-seams.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('./flatOpacity.js')],outfile:join(temp,'flat-opacity.js'),bundle:true,format:'esm',platform:'browser',loader,plugins:[...planesPlugins,...marchPlugins,...reliefPlugins,...boundsPlugins,...cardPlugins,...stabilityPlugins,...intervalPlugins]});
await build({entryPoints:[source('./rayFogBand.js')],outfile:join(temp,'ray-fog-band.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('./fogContinuity.js')],outfile:join(temp,'fog-continuity.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('./navigationCost.js')],outfile:join(temp,'navigation-cost.js'),bundle:true,format:'esm',platform:'browser',loader,plugins:intervalPlugins});
await build({entryPoints:[source('./weatherAnvil.js')],outfile:join(temp,'check.js'),bundle:true,format:'esm',platform:'browser',loader,plugins:checkPlugins});
await build({entryPoints:[source('./planetGas.js')],outfile:join(temp,'planet-gas.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('./planetFlowBenchmark.js')],outfile:join(temp,'planet-flow-benchmark.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('./planetRegeneration.js')],outfile:join(temp,'planet-regeneration.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('./planetControlsSmoke.js')],outfile:join(temp,'planet-controls-smoke.js'),bundle:true,format:'esm',platform:'browser',loader});
const flatDiagnosticPlugins=(process.env.CLOUD_FLAT_UNLIT==='1'||process.env.CLOUD_FLAT_LIGHT_EVERY_STEP==='1'||process.env.CLOUD_FLAT_DIAGNOSTIC)?[{name:'flat-light-diagnostic',setup(b){
 b.onLoad({filter:/cloudLayer\.wgsl$/},async({path})=>({loader:'text',contents:(await readFile(path,'utf8'))
  .replace('rgb += Tr * lightCol * alpha;', process.env.CLOUD_FLAT_UNLIT==='1'?'rgb += Tr * vec3<f32>(1.0) * alpha;':process.env.CLOUD_FLAT_DIAGNOSTIC==='normal'?'rgb += Tr * (shapeN_cached * 0.5 + vec3<f32>(0.5)) * alpha;':process.env.CLOUD_FLAT_DIAGNOSTIC==='sun'?'rgb += Tr * vec3<f32>(Tsun_cached) * alpha;':'rgb += Tr * lightCol * alpha;')
  .replace('let TsunSmoothed = mix_f(Tsun_cached, prevTsun, raySmoothSunAdaptive);',process.env.CLOUD_FLAT_DIAGNOSTIC==='no-sun-shadow'?'let TsunSmoothed = 1.0;':'let TsunSmoothed = mix_f(Tsun_cached, prevTsun, raySmoothSunAdaptive);')
  .replace('stableNearSample || (!sphericalCloudMode() && (prevDens <= 0.00008 || refreshMaterialLighting))',process.env.CLOUD_FLAT_LIGHT_EVERY_STEP==='1'?'!sphericalCloudMode()':'stableNearSample || (!sphericalCloudMode() && (prevDens <= 0.00008 || refreshMaterialLighting))')}));
}}]:[];
const uiPacingPlugins=[{name:'ui-pacing-controls',setup(b){
 if(process.env.CLOUD_TURBULENCE_BASELINE==='1')b.onLoad({filter:/[\\/]shaders[\\/]clouds\.wgsl$/},async()=>({loader:'text',contents:await readFile(source('./clouds_turbulence-baseline.wgsl'),'utf8')}));
 if(['0','1'].includes(process.env.CLOUD_DEFER_PRESENT))b.onLoad({filter:/cloudTest\.worker\.js$/},async({path})=>{
  let contents=await readFile(path,'utf8');
  contents=contents.replace('const deferPresentation = !loopRunning && !bootstrapPreviewMode && pausedFrameGpuMs > 100;',
   process.env.CLOUD_DEFER_PRESENT==='0'?'const deferPresentation = false;':'const deferPresentation = !loopRunning && !bootstrapPreviewMode;');
  return {loader:'js',contents};
 });
 if(process.env.CLOUD_RAY_GROUP_WIDTH==='8')b.onLoad({filter:/clouds\.js$/},async({path})=>({loader:'js',contents:(await readFile(path,'utf8')).replace('const PROCEDURAL_RAY_GROUP_WIDTH = 16;','const PROCEDURAL_RAY_GROUP_WIDTH = 8;')}));
}}];
await build({entryPoints:[source('../../cloudTest.worker.js')],outfile:join(temp,'worker.js'),bundle:true,format:'iife',platform:'browser',loader,plugins:[...planesPlugins,...flatDiagnosticPlugins,...intervalPlugins,...uiPacingPlugins]});
// Keep this cloud review independent of the lab's scratchpad index entry.
await build({stdin:{contents:`
 import {selectedCloudDemo,mountCloudDemoNavigation} from './tools/clouds/cloudDemoNavigation.js';
 mountCloudDemoNavigation();
 if(selectedCloudDemo()==='planet') import('./tools/noise/noisePlanetTest.js');
 else import('./tools/clouds/cloudTestThreaded.js');
 `,resolveDir:source('../../../../'),sourcefile:'cloud-review-entry.js',loader:'js'},
 outfile:join(temp,'demo.js'),bundle:true,format:'esm',platform:'browser',loader,
 plugins:[{name:'test-worker-url',setup(b){
  b.onLoad({filter:/cloudTest\.worker\.js$/},()=>({contents:'export default "/worker.js";',loader:'js'}));
  if(process.env.FLAT_REVIEW==='1')b.onLoad({filter:/cloudTestThreaded\.js$/},async({path})=>({
   contents:(await readFile(path,'utf8')).replaceAll('Date.now() >>> 0','17').replaceAll('(Date.now() & 0xffffffff) >>> 0','17'),loader:'js',
  }));
  if(process.env.PLANET_REVIEW_FREEZE_SUN==='1')b.onLoad({filter:/noisePlanetTest\.js$/},async({path})=>({
   contents:(await readFile(path,'utf8')).replace('const t = performance.now() * 0.00008;','const t = 1.1;'),loader:'js',
  }));
 }}]});
const html=script=>`<!doctype html><meta charset="utf-8"><title>Weather anvil verification</title><body style="margin:0;background:#101722;color:#eef"><pre id="result">Checking…</pre><script>
 const reportNode=document.querySelector('#result');
 if(reportNode)new MutationObserver(()=>{try{const report=JSON.parse(reportNode.textContent);fetch('/test-result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({test:location.pathname.slice(1),report})});}catch{}}).observe(reportNode,{childList:true,characterData:true,subtree:true});
 </script><script type="module" src="${script}"></script></body>`;
createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/test-result'&&req.method==='POST'){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>1000000)throw new Error('Diagnostic report too large');}
   const {test,report}=JSON.parse(body);
   if(!['frozen-pattern','turbulence-performance','turbulence-safety','flat-opacity','cell-seams','god-ray-checks','fog-continuity','ray-fog-band','horizon-performance','ui-responsiveness','ui-visibility'].includes(test)){res.writeHead(400).end();return;}
   await writeFile(source('./diagnostic-'+Number(process.env.CLOUD_REVIEW_PORT||8766)+'-'+test+'.json'),JSON.stringify(report,null,2));res.writeHead(204).end();return;
  }
  if(path==='/frozen-pattern'){res.writeHead(200,{'content-type':'text/html'}).end(html('/frozen-pattern.js'));return;}
  if(path==='/frozen-pattern.js'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'}).end(await readFile(join(temp,'frozen-pattern.js'),'utf8'));return;}
  if(path==='/turbulence-performance'){res.writeHead(200,{'content-type':'text/html'}).end(html('/turbulence-performance.js'));return;}
  if(path==='/turbulence-performance.js'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'}).end(await readFile(join(temp,'turbulence-performance.js'),'utf8'));return;}
  if(path==='/turbulence-safety'){res.writeHead(200,{'content-type':'text/html'}).end(html('/turbulence-safety.js'));return;}
  if(path==='/turbulence-safety.js'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'}).end(await readFile(join(temp,'turbulence-safety.js'),'utf8'));return;}
  if(path==='/horizon-performance'){res.writeHead(200,{'content-type':'text/html'}).end(html('/horizon-performance.js'));return;}
  if(path==='/ui-responsiveness'){res.writeHead(200,{'content-type':'text/html'}).end(html('/demo.js').replace('<pre id="result">Checking…</pre>','<script src="/ui-responsiveness.js"></script>'));return;}
  if(path==='/ui-responsiveness.js'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'}).end(await readFile(source('./cloudUiResponsiveness.js'),'utf8'));return;}
  if(path==='/horizon-performance.js'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'}).end(await readFile(join(temp,'horizon-performance.js'),'utf8'));return;}
  if(path==='/god-ray-checks'){res.writeHead(200,{'content-type':'text/html'}).end(html('/god-ray-checks.js'));return;}
  if(path==='/storm-shape-checks'){res.writeHead(200,{'content-type':'text/html'}).end(html('/storm-shape-checks.js'));return;}
  if(path==='/storm-motion-checks'){res.writeHead(200,{'content-type':'text/html'}).end(html('/storm-motion-checks.js'));return;}
  if(path==='/storm-motion-checks.js'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'}).end(await readFile(join(temp,'storm-motion-checks.js'),'utf8'));return;}
  if(path==='/storm-shape-checks.js'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'}).end(await readFile(join(temp,'storm-shape-checks.js'),'utf8'));return;}
  if(path==='/cell-seams'){res.writeHead(200,{'content-type':'text/html'}).end(html('/cell-seams.js'));return;}
  if(path==='/ray-fog-band'||path==='/fog-continuity'||path==='/navigation-cost'||path==='/check'||path==='/demo'||path==='/planet-gas'||path==='/planet-flow-benchmark'||path==='/planet-controls-smoke'||path==='/planet-regeneration'||path==='/flat-opacity'){
   let page=path==='/demo'?html('/demo.js').replace('<pre id="result">Checking…</pre>',''):html(path==='/ray-fog-band'?'/ray-fog-band.js':path==='/fog-continuity'?'/fog-continuity.js':path==='/navigation-cost'?'/navigation-cost.js':path==='/flat-opacity'?'/flat-opacity.js':path==='/planet-regeneration'?'/planet-regeneration.js':path==='/planet-controls-smoke'?'/planet-controls-smoke.js':path==='/planet-flow-benchmark'?'/planet-flow-benchmark.js':path==='/planet-gas'?'/planet-gas.js':'/check.js');
   // A repeatable actual-simulation review: fixed terrain seed and sun only.
   // Production shader, noise, scene and camera remain the real demo.
   if(path==='/demo'&&process.env.PLANET_REVIEW==='1')page=page.replace('<script type="module"','<script>window.NOISE_PLANET_TEST_OPTIONS={seed:17,clouds:{cloudStyle:"hail_mary"}};</script><script type="module"');
   res.writeHead(200,{'content-type':'text/html'}).end(page);return;
  }
  const routes={'/god-ray-checks.js':'god-ray-checks.js','/cell-seams.js':'cell-seams.js','/ray-fog-band.js':'ray-fog-band.js','/fog-continuity.js':'fog-continuity.js','/navigation-cost.js':'navigation-cost.js','/flat-opacity.js':'flat-opacity.js','/planet-regeneration.js':'planet-regeneration.js','/planet-controls-smoke.js':'planet-controls-smoke.js','/check.js':'check.js','/demo.js':'demo.js','/worker.js':'worker.js','/planet-gas.js':'planet-gas.js','/planet-flow-benchmark.js':'planet-flow-benchmark.js'};
  if(!routes[path]){res.writeHead(404).end();return;}
  let body=await readFile(join(temp,routes[path]),'utf8');
  if(path==='/worker.js'&&process.env.WEATHER_REVIEW_LIVE!=='1'){
   // Freeze only the weather director at its mature anvil phase for review;
   // ordinary animation/wind and the production shader remain unchanged.
   body=body.replace('weatherCycleState = sampleWeatherCycle(weatherCycleSeconds, weatherCycle);','weatherCycleSeconds = 105; weatherCycleState = sampleWeatherCycle(weatherCycleSeconds, weatherCycle);');
  }
  res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'}).end(body);
 }catch(error){res.writeHead(500).end(String(error));}
}).listen(Number(process.env.CLOUD_REVIEW_PORT||8766),'127.0.0.1',()=>console.log(`Weather anvil verification: http://127.0.0.1:${process.env.CLOUD_REVIEW_PORT||8766}/check and /demo`));
