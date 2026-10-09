import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planetCloudStyleOptions} from '../planetCloudStyles.js';
import {planetCloudSimStylePatch} from '../planetCloudSimStyles.js';

test('Hail Mary has a fuller atmosphere without becoming opaque in either renderer',()=>{
 const hail=planetCloudStyleOptions('hail_mary'),jupiter=planetCloudStyleOptions('gas_giant');
 assert.equal(hail.opacity,.78);assert.equal(hail.surfaceOpacity,.72);
 assert.ok(hail.opacity<jupiter.opacity);assert.ok(hail.surfaceOpacity<jupiter.surfaceOpacity);
 assert.ok(hail.params.globalDensity<jupiter.params.globalDensity*.4);
 assert.equal(jupiter.opacity,.98);assert.equal(jupiter.surfaceOpacity,.995);
 const sim=planetCloudSimStylePatch('hail_mary');
 assert.equal(sim.render.opacity,hail.opacity);assert.equal(sim.surface.surfaceOpacity,hail.surfaceOpacity);
 assert.equal(sim.params.globalDensity,hail.params.globalDensity);
});

test('gas atmospheres have distinct identifiers but share zonal morphology and bounded quality',()=>{
 for(const [style,form] of [['gas_giant',5],['neptune',6],['hail_mary',7]]){
  const p=planetCloudStyleOptions(style,50);
  assert.equal(p.tuning.formType,form);
  assert.equal(p.cloudTop,2.75);
  assert.equal(p.tuning.maxSteps,96);
  assert.equal(p.spinSpeed,.00065);
  assert.equal(p.params.globalCoverage,1.12);
 }
});

test('raymarch and mesh share a single gas palette without extra texture reads',async()=>{
 const read=x=>readFile(new URL('../'+x,import.meta.url),'utf8');
 const [ray,mesh,builder,surface,palette]=await Promise.all(['shaders/cloudPlanet.wgsl','shaders/planetCloudSurfaceRender.wgsl','clouds.js','planetCloudSurface.js','shaders/planetGasAppearance.wgsl'].map(read));
 assert.match(ray,/gasWeatherColor\(weather,TUNE.formType\)/);
 assert.match(mesh,/gasWeatherColor\(weather,params.formType\)/);
 for(const host of [builder,surface])assert.match(host,/gasAppearanceWGSL\+'\\n'\+/);
 assert.match(palette,/if\(form>=6\.5\)/);
 assert.match(palette,/if\(form>=5\.5\)/);
 assert.doesNotMatch(palette,/textureSample|for\s*\(/);
 assert.match(surface,/weatherStyle:options.cloudStyle/);
 assert.match(await read('planetClouds.js'),/weatherStyle:opt.cloudStyle/);
});

test('gas atmosphere structure is setup-only and uses continuous sphere coordinates',async()=>{
 const noise=await readFile(new URL('../planetCloudNoise.js',import.meta.url),'utf8');
 assert.match(noise,/fn stormFrame/);
 assert.match(noise,/stormCore=stormFrame\(originalDirection,stormAxis\)/);
 assert.match(noise,/mode==2u/);
 assert.match(noise,/mode==3u/);
 assert.match(noise,/1\.0-rustPatches/);
 assert.doesNotMatch(noise,/dot\(direction,normalize\(vec3<f32>\(\.73,\.23,\.64\)\)\)/);
 const frame=noise.slice(noise.indexOf('fn stormFrame'),noise.indexOf('@compute @workgroup_size(4'));
 assert.doesNotMatch(frame,/atan2|longitude|latitude/);
});

test('Hail Mary has isolated warm weather regions and curl-carried threads, not latitude stripes',async()=>{
 const noise=await readFile(new URL('../planetCloudNoise.js',import.meta.url),'utf8');
 const hail=noise.slice(noise.indexOf('let regions=fbm'),noise.indexOf('let bandPhase='));
 assert.match(hail,/regions=fbm\(p,4,seed\+6029u\)/);
 assert.match(hail,/rustPatches=smoothstep\(\.53,\.66/);
 assert.match(hail,/threadPhase=dot\(direction,vec3<f32>\(\.37,\.83,-\.41\)\)/);
 assert.match(hail,/threadPhase\*1\.93\+broad\*3\.0/);
 assert.match(hail,/return;/);
 assert.doesNotMatch(hail,/direction\.y|bandPhase|stormAxis/);
 assert.match(noise,/if\(mode==3u\)\{direction=hailMaryVortices/);
 const palette=await readFile(new URL('../shaders/planetGasAppearance.wgsl',import.meta.url),'utf8');
 const alien=palette.slice(palette.indexOf('if(form>=6.5)'),palette.indexOf('if(form>=5.5)'));
 assert.match(alien,/1\.12,\.48,\.045/);
 assert.doesNotMatch(alien,/textureSample|for\s*\(/);
});

test('Neptune uses sparse fine streaks and a smooth normal without the expensive giant curl bake',async()=>{
 const read=x=>readFile(new URL('../'+x,import.meta.url),'utf8');
 const [noise,ray,mesh]=await Promise.all(['planetCloudNoise.js','shaders/cloudPlanet.wgsl','shaders/planetCloudSurfaceRender.wgsl'].map(read));
 const neptune=noise.slice(noise.indexOf('if(mode==2u)'),noise.indexOf('direction=stormWarp'));
 assert.match(neptune,/fbm\(p,64/);
 assert.match(neptune,/ridge\+stormWisps/);
 assert.match(neptune,/smoothstep\(\.47,\.65,banks\)/);
 assert.match(neptune,/return;/);
 assert.doesNotMatch(neptune,/for\s*\(/);
 assert.match(ray,/mix\(normal,radial,select\(0\.0,\.94,neptune\)\)/);
 assert.match(mesh,/select\(\.88,\.06,neptune\)/);
});

test('Jovian belts are nonuniform and extra alien curl octaves remain bake-only',async()=>{
 const noise=await readFile(new URL('../planetCloudNoise.js',import.meta.url),'utf8');
 assert.match(noise,/northBelt=exp/);
 assert.match(noise,/southBelt=exp/);
 assert.match(noise,/poles=smoothstep/);
 assert.doesNotMatch(noise,/let zonal=.*sin/);
 const curl=noise.slice(noise.indexOf('fn gasCurl'),noise.indexOf('fn vortex'));
 assert.match(curl,/if\(mode==3u\)/);
 assert.match(curl,/direction\*12\.7/);
});
