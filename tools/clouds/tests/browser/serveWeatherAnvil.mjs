// Manual WebGPU parity test and actual flat-demo visual review. Build outputs
// live in a temporary directory; production code has no test clock/readback.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdtemp,readFile} from 'node:fs/promises';
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
// Optional negative control for the identity regression. Only the diagnostic
// bundle is changed; the production shader and /demo remain untouched.
const checkPlugins=process.env.CLOUD_POP_BASELINE==='1'?[{name:'old-storm-identity',setup(b){
 b.onLoad({filter:/cloudFields\.wgsl$/},async({path})=>({loader:'text',contents:(await readFile(path,'utf8'))
  .replace('cloudCellRandom(id, 237.9) < 0.27','cloudCellRandom(id, 237.9) < mix_f(0.12, 0.36, saturate(weather.g))')}));
}}]:[];
await build({entryPoints:[source('./weatherAnvil.js')],outfile:join(temp,'check.js'),bundle:true,format:'esm',platform:'browser',loader,plugins:checkPlugins});
await build({entryPoints:[source('./planetGas.js')],outfile:join(temp,'planet-gas.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('./planetFlowBenchmark.js')],outfile:join(temp,'planet-flow-benchmark.js'),bundle:true,format:'esm',platform:'browser',loader});
await build({entryPoints:[source('../../cloudTest.worker.js')],outfile:join(temp,'worker.js'),bundle:true,format:'iife',platform:'browser',loader});
await build({entryPoints:[source('../../../../index.js')],outfile:join(temp,'demo.js'),bundle:true,format:'esm',platform:'browser',loader,
 plugins:[{name:'test-worker-url',setup(b){
  b.onLoad({filter:/cloudTest\.worker\.js$/},()=>({contents:'export default "/worker.js";',loader:'js'}));
  if(process.env.PLANET_REVIEW==='1')b.onLoad({filter:/noisePlanetTest\.js$/},async({path})=>({
   contents:(await readFile(path,'utf8')).replace('const t = performance.now() * 0.00008;','const t = 1.1;'),loader:'js',
  }));
 }}]});
const html=script=>`<!doctype html><meta charset="utf-8"><title>Weather anvil verification</title><body style="margin:0;background:#101722;color:#eef"><pre id="result">Checking…</pre><script type="module" src="${script}"></script></body>`;
createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/check'||path==='/demo'||path==='/planet-gas'||path==='/planet-flow-benchmark'){
   let page=path==='/demo'?html('/demo.js').replace('<pre id="result">Checking…</pre>',''):html(path==='/planet-flow-benchmark'?'/planet-flow-benchmark.js':path==='/planet-gas'?'/planet-gas.js':'/check.js');
   // A repeatable actual-simulation review: fixed terrain seed and sun only.
   // Production shader, noise, scene and camera remain the real demo.
   if(path==='/demo'&&process.env.PLANET_REVIEW==='1')page=page.replace('<script type="module"','<script>window.NOISE_PLANET_TEST_OPTIONS={seed:17,clouds:{cloudStyle:"hail_mary"}};</script><script type="module"');
   res.writeHead(200,{'content-type':'text/html'}).end(page);return;
  }
  const routes={'/check.js':'check.js','/demo.js':'demo.js','/worker.js':'worker.js','/planet-gas.js':'planet-gas.js','/planet-flow-benchmark.js':'planet-flow-benchmark.js'};
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
