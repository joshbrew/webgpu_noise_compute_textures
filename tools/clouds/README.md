# WebGPU Volumetric Clouds



Realtime WebGPU volumetric clouds with GPU-baked procedural noise, compute-shader raymarching, temporal reprojection, large cloud boxes, and a browser tuning playground.



The core renderer is `CloudComputeBuilder` in `clouds.js`. It consumes a weather map, a shape volume, a detail volume, and optional blue noise, then writes volumetric cloud color and alpha into a WebGPU texture. You can composite that texture in your own renderer or use the included preview compositor.



The tuning playground uses `NoiseComputeBuilder` from [`webgpu_noise_compute_textures`](https://github.com/joshbrew/webgpu_noise_compute_textures) to generate the input textures on the GPU.



## [Try it](https://webgpuclouds.netlify.app/)



[https://webgpuclouds.netlify.app/](https://webgpuclouds.netlify.app/)



## Related projects



- [webgpu_noise_compute_textures](https://github.com/joshbrew/webgpu_noise_compute_textures)

- Fredrik Häggström, [Real-time rendering of volumetric clouds](https://www.diva-portal.org/smash/record.jsf?pid=diva2:1223894&dswid=7420)



## Demo videos



- [5/7 demo](https://www.youtube.com/watch?v=HtLoZ3gxX-E)

- [5/6 demo](https://www.youtube.com/watch?v=ShBe7HvlEb8)



# Screenshots



<img  width="800" alt="cloud-wide-fine-traversal" src="https://github.com/user-attachments/assets/969c6765-d9a4-479f-9d4e-159a7b8563c6" />

<img  width="800" alt="Screenshot 2026-10-04 121156" src="https://github.com/user-attachments/assets/ee527653-a534-4d2a-a4bc-fb98e4d52d96" />

<img width="1854" height="1615" alt="Screenshot 2026-10-04 135801" src="https://github.com/user-attachments/assets/355a93cc-2d9f-47be-a93c-333ef27437c6" />

<img  width="800" alt="Screenshot 2026-10-04 121303" src="https://github.com/user-attachments/assets/74983f29-ed81-40af-a2d7-d53ba1cd4244" />

<img width="800" alt="image" src="https://github.com/user-attachments/assets/85a8a9e9-8cc8-41e1-bd49-d9fa5681ba0b" />

<img width="800" alt="Screenshot 2026-06-06 172156" src="https://github.com/user-attachments/assets/36306a95-fda1-4f0a-8a09-7c8dc0115241" />

<img width="800" alt="Screenshot 2026-05-29 105041" src="https://github.com/user-attachments/assets/96fae4fd-ba58-42bb-a2a0-728086c8c8b5" />

<img width="800" alt="image" src="https://github.com/user-attachments/assets/a926c419-e17f-46c3-a9c5-4ce5a9c38733" />

<img width="800" alt="Screenshot 2026-05-28 232111" src="https://github.com/user-attachments/assets/279b50ee-960e-4b7a-bf00-42cdefcf65b7" />

<img width="800" alt="image" src="https://github.com/user-attachments/assets/52a1366b-5a81-4e0c-9fe9-1c5f00676911" />

<img width="800" alt="image" src="https://github.com/user-attachments/assets/14edd013-c56c-4cb4-8d60-d8a474a2b356" />

<img width="800" alt="image" src="https://github.com/user-attachments/assets/d043386e-a4e3-4c38-9b6f-1b9e8f0eb76e" />

<img width="800" alt="Screenshot 2026-05-07 180853" src="https://github.com/user-attachments/assets/99f87b1f-0159-414a-93d2-d9a071f82448" />

<img width="800" alt="image" src="https://github.com/user-attachments/assets/e7b3e377-1c31-45d8-b200-42e2a2b0da93" />

<img width="800" alt="image" src="https://github.com/user-attachments/assets/ef959ab5-070b-4fc1-bf39-444d091674c6" />

<img width="800" alt="Screenshot 2026-05-07 223522" src="https://github.com/user-attachments/assets/939b4692-5aea-4238-93ba-84015ded4231" />





---



## Install and run



Run the build/dev commands from the shared `noiseCompute` project root (two

directories above this folder). The renderer and demos use its bundler to load

WGSL as text and produce the separate worker bundle.



```bash

npm install

```



If `tinybuild` is not installed globally:



```bash

npm i -g tinybuild

```



Run the local demo:



```bash

tinybuild

```



Then open the page served by your local dev setup.



You can also serve prebuilt files with any static server:



```bash

python -m http.server 8080

```



Open:



```text

http://localhost:8080/

```



## Browser requirements



Use a current Chromium-based browser with:



- WebGPU enabled.

- JavaScript module worker support.

- `OffscreenCanvas` support.

- Enough GPU memory for the weather map, 3D shape/detail volumes, blue noise, history textures, and output texture.



---



## File layout



```text

clouds.js                      CloudComputeBuilder library entry point.

cloudTestThreaded.js            Flat playground UI entry point.

cloudTest.worker.js             Worker-owned WebGPU demo backend.

clouds.html                    Playground markup.

cloudDemoNavigation.js         Flat / planet demo navigation.

cloudTiming.js                 Startup/frame timing reports.

cloudVolumeMips.js             Filtered volume mip generation.

cloudFieldQuality.js           Flat-volume density/lighting fidelity presets.

cloudLookPresets.js             Reference color and lighting looks.

planetClouds.js                Planet raymarch layer entry point.

planetCloudSurface.js          Planet MC33 mesh layer entry point.

planetCloudNoise.js            Planet noise and gas curl baking.

planetCloudStyles.js           Shared planet style presets.

planetCloudSimStyles.js        Planet simulation preset integration.

planetCloudColors.js           Live color / HDR brightness helpers.

planetCloudMotion.js           Shared planet weather motion.

mc33Tables.js                  MC33 lookup tables.

weather/

  cloudAnvilLook.js            Shared standalone / cycle anvil look.

  cloudWeatherCycle.js         Weather and time-of-day director.

  cloudWeatherGPU.js           Cached weather-map blending.

shaders/

  cloudCommon.wgsl             Shared uniforms, sampling and lighting.

  cloudLayer.wgsl              Original layer/spherical raymarch / Rain Shelf.

  clouds.wgsl                  Cached-field flat raymarch.

  cloudFields.wgsl             Density and shadow/AO field entry points.

  cloudPlanet.wgsl             Compact styled planet raymarch.

  cloudScratch.wgsl            Shared raymarch/resolve storage layout.

  cloudRayOutput.wgsl          Staged raymarch output.

  cloudResolve.wgsl            Temporal resolve.

  cloudsRender.wgsl            Preview/composite.

  cloudWeatherBlend.wgsl       Weather-map blend.

  planetCloudSurfaceMC33.wgsl  Planet mesh extraction.

  planetCloudSurfaceRender.wgsl Planet mesh rendering.

  planetGasAppearance.wgsl     Shared gas-planet palette.

tests/

  *.test.mjs                  Node regression tests (no GPU required).

  browser/                    Manual WebGPU checks / demo review server.

```



Public renderer, demo and planet integration entry points remain at their

existing paths. Shaders are grouped under `shaders/`; weather-only modules live

under `weather/`. This is a file-layout change, not a rendering change.



## Testing



From this `tools/clouds` folder:



```bash

node --test tests/*.test.mjs

```



Tests cover preset parity, phase continuity, cache/pipeline behavior, planet

styles, MC33, temporal history and local import paths. To check the complete

demo and worker bundles, run `npm run build` from the `noiseCompute` project root.



For the manual WebGPU anvil check:



```bash

node tests/browser/serveWeatherAnvil.mjs

```



Open `http://127.0.0.1:8766/check` to compare density, lighting and rendered pixels

against the standalone anvil with identical inputs. `/demo` is the actual flat

demo with only its weather clock held at the mature anvil phase for visual

review; enable **Evolving weather** to view it. Wind still runs normally.

Stop the server with Ctrl+C when finished.



The GPU check also sweeps weather G across its full range, samples all twelve

phase joins and midpoints, checks time-step convergence at the largest change,

and straddles positive/negative wind-cell boundaries. `WEATHER_REVIEW_LIVE=1`

leaves the visual demo's weather clock running. For a negative control, run a

second server with `CLOUD_POP_BASELINE=1` and `CLOUD_REVIEW_PORT=8767`: only its

diagnostic bundle restores the old weather-dependent storm identity, which

must fail the G-channel continuity check. Production files are not modified.



`http://127.0.0.1:8766/planet-gas` checks the production Hail Mary weather bake

across three seeds, reports equal-area rust/thread coverage, and previews the

shared palette on a diagnostic globe (not the full cloud/terrain compositor).

For repeatable full-simulation review, start the same server with

`PLANET_REVIEW=1` and open `/demo?demo=planet`. That test-only mode selects Hail

Mary with terrain seed 17 and holds the sun fixed; ordinary production weather

shaders, cloud animation, terrain and camera controls are unchanged.



The check requires a WebGPU-capable browser and the project's existing esbuild

installation (local esbuild or the Windows global tinybuild dependency).

`ESBUILD_MODULE` can point to another existing esbuild installation. Bundled

diagnostic outputs stay in a temporary directory, not the source tree.



---



# What the renderer does



The renderer is a compute-based volumetric cloud pass.



1. Intersect each camera ray with a world-space cloud box.

2. Sample weather, shape, and detail textures to estimate cloud density.

3. March through the box with adaptive step lengths.

4. Evaluate sun transmittance and phase lighting at protected intervals.

5. Accumulate color and alpha into an output storage texture.

6. Optionally reuse temporal history for animated/reprojected rendering.

7. Optionally composite the output through `shaders/cloudsRender.wgsl`.



The renderer includes performance-oriented shader logic for large and tall boxes:



- Weather-column empty skipping.

- Column-style Y-bounds acceleration derived from the weather field.

- Active-Y ray clipping plus a global active-Y early-out for rays that cross the tall AABB but never cross the actual cloud profile band.

- Protected near/edge lighting so close silhouettes do not smear or card out.

- Far proxy sampling for safe horizon/interior cloud samples.

- Adaptive thick-box stepping and lighting skip.



- Original-style cloud body sampling is preserved by default. The experimental Y-domain compensation remains opt-in through `verticalTextureHomogeneity`.

- Compact temporal interleave dispatch when history is available. Skipped pixels are not launched as cloud rays. The previous history is copied forward before the owned subset overwrites it.



The far proxy path is intentionally conservative. It keeps the same weather and shape style but avoids some full 3D/detail work where the cloud is far, screen-small, and visually safe.



---



# Library usage



## 1. Create WebGPU objects



```js

const adapter = await navigator.gpu.requestAdapter();

if (!adapter) throw new Error('WebGPU adapter unavailable');



const device = await adapter.requestDevice();

const queue = device.queue;

```



The playground requests a larger `maxBufferSize` when available because high-resolution noise baking and debug readbacks can need large staging buffers.



## 2. Create a `CloudComputeBuilder`



```js

import { CloudComputeBuilder } from './clouds.js';



const clouds = new CloudComputeBuilder(device, queue);

```



`CloudComputeBuilder` owns its compute pipeline, uniform buffers, bind groups, optional output textures, cached coarse/upsample resources, and the optional preview compositor.



## 3. Provide cloud input textures



```js

clouds.setInputMaps({

  weatherView,      // texture_2d_array view

  shape3DView,      // texture_3d view

  detail3DView,     // texture_3d view

  blueView,         // optional blue-noise texture view

  motionView,       // optional reprojection motion texture

  depthPrevView,    // optional previous depth texture

  historyPrevView,  // optional previous cloud history

  historyOutView,   // optional output history target

});

```



Optional views can be omitted. The builder binds safe dummy textures when a view is missing.



## 4. Create or attach an output texture



Let the builder allocate the output texture:



```js

clouds.createOutputTexture(width, height, 1, 'rgba16float');

```



Or attach a texture owned by your renderer:



```js

clouds.setOutputView(existingView, {

  width,

  height,

  layers: 1,

  format: 'rgba16float',

});

```



If you allocate the texture yourself, use flags compatible with your pipeline. A typical texture needs storage writes and later sampling or copy usage:



```js

const outTex = device.createTexture({

  size: [width, height, 1],

  format: 'rgba16float',

  usage:

    GPUTextureUsage.STORAGE_BINDING |

    GPUTextureUsage.TEXTURE_BINDING |

    GPUTextureUsage.COPY_SRC |

    GPUTextureUsage.COPY_DST,

});

```



## 5. Set the world-space cloud box



```js

clouds.setBox({

  center: [0, 0, 0],

  half: [18, 0.3, 18],

  uvScale: 1.0,

});

```



`center` and `half` define the raymarched world-space AABB. `uvScale` controls weather-map mapping over the cloud box. For horizon-scale clouds, increase X/Z size and rely on render scale, adaptive stepping, far proxy, and temporal accumulation rather than hard visible-density culling.



## 6. Set camera and sun



The flat demo has a camera toolbar over the cloud view. **Orbit** uses drag to

rotate, right-drag or Shift-drag to pan, and scroll or a two-finger pinch to zoom.

**Frame clouds** fits the current cloud box. Switching modes preserves the view;

manual camera inputs and preset cameras remain usable.



**Flight** starts automatic forward cruise with smooth steering, momentum and

banking, with a close chase camera 2.4 units behind the aircraft. Its polygonal

aircraft is ray-intersected in the scene: the existing

cloud march stops at the opaque hull and composites intervening cloud radiance

and transmission over it. It can disappear inside cloud, on both cloud paths.

Click the cloud view to focus it: drag, WASD or arrows steer, Q/E descend/climb,

and Shift boosts. Choose Slow, Cruise, Fast or Travel speed. **Pause flight**

stops movement and **Launch** resumes it. Escape, leaving the view for sidebar controls,

or hiding the page stops movement. Camera updates reuse the existing density and

light caches and work with either paused clouds or the evolving weather cycle.



Reference color presets are grouped by intended lighting: **Fluffy lighting**

uses soft volume finishing; **Sculpted lighting** uses illustrated three-tone

relief and luminous silhouettes. Auto follows that intent. An explicit Lighting

finish overrides it on the same cloud shape. Sculpted reference looks include

Molten Gold, Gilded Violet, Electric Cyan, Solar Copper Classic, Lavender Ink,

Silver Outline and Cobalt Ink. Fluffy detail/turbulence controls are disabled on

the procedural Rain Shelf path; either lighting finish still works on fluffy

volume shapes without changing their geometry or cached voxel resolution.



```js

clouds.setViewFromCamera({

  camPos,

  right,

  up,

  fwd,

  fovYDeg,

  aspect,

});



clouds.setSunByAngles({

  azimuthDeg: 45,

  elevationDeg: 41,

  camPos,

});

```



You can also pass a sun vector directly:



```js

clouds.setLight({

  sunDir,

  camPos,

});

```



## 7. Set appearance, transforms, tuning, and reprojection



```js

clouds.setParams({

  globalCoverage: 1.0,

  globalDensity: 1000.0,

  cloudAnvilAmount: 0.1,

  cloudBeer: 6.0,

  silverIntensity: 12.0,

  silverExponent: 12.0,

});



clouds.setNoiseTransforms({

  shapeScale: 0.1,

  detailScale: 1.0,

  weatherScale: 1.0,

  shapeBias: 0.4,

  weatherBias: 0.3,

});



clouds.setTuning({

  maxSteps: 256,

  sunSteps: 6,

  sunStride: 3,

  fluffFactor: 2.0,

  alphaCutoff: 0.98,

  frontOcclusionStrength: 0.72,

  frontOcclusionAlpha: 0.66,

  frontOcclusionStepBoost: 3.0,

  sliceJitterStrength: 0.18,

  verticalLayerDecorrelation: 0.35,

  directLightBlend: 0.78,

  directLightBoost: 0.58,

  alphaBoostThreshold: 0.22,

  alphaBoostAmount: 0.16,

});



clouds.setReprojSettings({

  enabled: 1,

  subsample: 4,

  temporalBlend: 0.94,

  frameIndex,

  fullWidth: width,

  fullHeight: height,

});

```



## 8. Dispatch



Full resolution:



```js

await clouds.dispatch({

  coarseFactor: 1,

  wait: true,

});

```



Reduced resolution, upsampled to the output size:



```js

await clouds.dispatch({

  coarseFactor: 4,

  wait: true,

});

```



`coarseFactor` is the render scale divider. `1` means full resolution. `2` means half resolution per axis. `5` means one fifth resolution per axis, then upsampled to the full output texture.



Rectangular dispatch:



```js

await clouds.dispatchRect({

  x,

  y,

  w,

  h,

  coarseFactor: 4,

  wait: true,

});

```



## 9. Composite to a canvas



```js

clouds.renderToCanvas(canvas, {

  cam: { camPos, right, up, fwd, fovYDeg, aspect },

  sunDir,

  skyColor: [0.60, 0.75, 0.98],

  exposure: 1.18,

  gradeStyle: 3,

  sunBloom: 0.18,

  godRaysEnabled: true,

  godRayStrength: 1.0,

  layerIndex: 0,

});

```



In a full renderer, you can skip `renderToCanvas()` and sample the cloud output texture from your own composite pass.



## 10. Cleanup



```js

clouds.dispose();

```



The builder destroys resources it created internally. Textures passed into `setInputMaps()` or `setOutputView()` remain the caller's responsibility.



---



# Minimal direct integration



```js

import { CloudComputeBuilder } from './clouds.js';



const clouds = new CloudComputeBuilder(device, queue);



clouds.setInputMaps({

  weatherView,

  shape3DView,

  detail3DView,

  blueView,

});



clouds.createOutputTexture(width, height, 1, 'rgba16float');



clouds.setBox({

  center: [0, 0, 0],

  half: [18, 0.3, 18],

  uvScale: 1.0,

});



clouds.setParams({

  globalCoverage: 1.0,

  globalDensity: 1000.0,

  cloudAnvilAmount: 0.1,

  cloudBeer: 6.0,

  attenuationClamp: 0.015,

  inScatterG: 0.55,

  outScatterG: 0.08,

  inVsOut: 0.55,

  silverIntensity: 12.0,

  silverExponent: 12.0,

  silverDirectionBias: 0.9,

  silverHorizonBoost: 0.35,

  ambientMinimum: 0.04,

  outScatterAmbientAmt: 0.08,

  sunColor: [1.0, 0.985, 0.95],

  frontLightColor: [1.10, 1.12, 1.16],

  shadowLightColor: [0.62, 0.68, 0.78],

});



clouds.setNoiseTransforms({

  shapeScale: 0.1,

  detailScale: 1.0,

  weatherScale: 1.0,

  shapeBias: 0.4,

  detailBias: 0.0,

  weatherBias: 0.3,

});



clouds.setTuning({

  maxSteps: 256,

  minStep: 0.003,

  maxStep: 0.16,

  sunSteps: 6,

  sunStride: 3,

  baseJitterFrac: 0.02,

  topJitterFrac: 0.1,

  raySmoothDens: 0.34,

  raySmoothSun: 0.34,

  fluffFactor: 2.0,

  alphaCutoff: 0.98,

  frontOcclusionStrength: 0.72,

  frontOcclusionAlpha: 0.66,

  frontOcclusionStepBoost: 3.0,

  sliceJitterStrength: 0.18,

  verticalLayerDecorrelation: 0.35,

  directLightBlend: 0.78,

  directLightBoost: 0.58,

  alphaBoostThreshold: 0.22,

  alphaBoostAmount: 0.16,

});



function frame(frameIndex) {

  clouds.setViewFromCamera({

    camPos,

    right,

    up,

    fwd,

    fovYDeg: 60,

    aspect: width / height,

  });



  clouds.setSunByAngles({

    azimuthDeg: 45,

    elevationDeg: 41,

    camPos,

  });



  clouds.setReprojSettings({

    enabled: 1,

    subsample: 5,

    temporalBlend: 0.94,

    frameIndex,

    fullWidth: width,

    fullHeight: height,

  });



  clouds.dispatch({ coarseFactor: 4 });

}

```



---



# Noise texture library integration



The playground bakes all procedural input maps with `NoiseComputeBuilder` from the companion noise library:



```js

import { NoiseComputeBuilder } from '../noise/noiseCompute.js';

import { CloudComputeBuilder } from './clouds.js';



const noise = new NoiseComputeBuilder(device, queue);

const clouds = new CloudComputeBuilder(device, queue);



noise.initBlitRender?.();

noise.buildPermTable(seed);

```



The cloud renderer itself does not require `NoiseComputeBuilder`. It only needs valid texture views. The playground uses the noise library because it is convenient to bake and preview the weather, shape, detail, and blue-noise textures entirely on the GPU.



## Weather map baking



The weather map is a `512 x 512` 2D array texture. The playground uses one texture key, `weather2d`, and writes channels separately:



- Output channel `1`: weather R, base coverage.

- Output channel `2`: weather G, billow modulation.

- Output channel `3`: weather B, optional extra modulation.



```js

const weatherRView = await noise.computeToTexture(512, 512, {

  mode: 'computeFBM4D',

  seed: 123456789001,

  zoom: 4,

  freq: 1,

  octaves: 5,

  lacunarity: 2,

  gain: 0.5,

  threshold: 0,

  seedAngle: Math.PI / 2,

  time: 0,

  voroMode: 0,

  edgeK: 0,

  warpAmp: 0,

  toroidal: 1,

}, {

  noiseChoices: ['clearTexture', 'computeFBM4D'],

  outputChannel: 1,

  textureKey: 'weather2d',

  viewDimension: '2d-array',

});



await noise.computeToTexture(512, 512, {

  seed: 123456789000,

  zoom: 4,

  freq: 1.5,

  octaves: 4,

  lacunarity: 2,

  gain: 0.5,

  threshold: 0,

  seedAngle: Math.PI / 2,

  time: 0,

  toroidal: 1,

}, {

  noiseChoices: ['clearTexture', 'computeBillow4D'],

  outputChannel: 2,

  textureKey: 'weather2d',

  viewDimension: '2d-array',

});



const weatherView = noise.get2DView('weather2d', { dimension: '2d-array' }) || weatherRView;

```



The worker uses `sanitizeEntry()` before baking. If a requested entry point is unavailable, it falls back to a compatible default. 4D weather modes get `toroidal: 1` so the weather map can tile across a horizon-scale box without visibly stretching.



## Shape volume baking



The shape volume is a `128 x 128 x 128` 3D texture. It stores the main cloud body and lower-frequency sculpting bands.



```js

await noise.computeToTexture3D(128, 128, 128, {

  seed,

  zoom: 4,

  freq: 1,

  octaves: 2,

  lacunarity: 2,

  gain: 0.5,

  threshold: 0,

  seedAngle: Math.PI / 2,

  time: 0,

  voroMode: 4,

  edgeK: 0,

  warpAmp: 0,

  toroidal: 1,

  band: 'base',

}, {

  noiseChoices: ['clearTexture', 'computeAntiWorley4D'],

  outputChannel: 1,

  id: 'shape128',

});



await noise.computeToTexture3D(128, 128, 128, { seed, zoom: 2, toroidal: 1 }, {

  noiseChoices: ['clearTexture', 'computeAntiWorley4D'],

  outputChannel: 2,

  id: 'shape128',

});



await noise.computeToTexture3D(128, 128, 128, { seed, zoom: 1, toroidal: 1 }, {

  noiseChoices: ['clearTexture', 'computeAntiWorley4D'],

  outputChannel: 3,

  id: 'shape128',

});



await noise.computeToTexture3D(128, 128, 128, { seed, zoom: 0.5, toroidal: 1 }, {

  noiseChoices: ['clearTexture', 'computeAntiWorley4D'],

  outputChannel: 4,

  id: 'shape128',

});



const shape3DView = noise.get3DView('shape128');

```



The playground restricts shape/detail modes to 4D-capable entry points. That keeps 3D volumes tileable and lets animation use offsets or time without reseeding the whole texture every frame.



## Detail volume baking



The detail volume is a `32 x 32 x 32` 3D texture. It is used mainly for edge erosion and small-scale turbulence.



```js

await noise.computeToTexture3D(32, 32, 32, { seed, zoom: 4, toroidal: 1 }, {

  noiseChoices: ['clearTexture', 'computeWorley4D'],

  outputChannel: 1,

  id: 'detail32',

});



await noise.computeToTexture3D(32, 32, 32, { seed, zoom: 2, toroidal: 1 }, {

  noiseChoices: ['clearTexture', 'computeWorley4D'],

  outputChannel: 2,

  id: 'detail32',

});



await noise.computeToTexture3D(32, 32, 32, { seed, zoom: 1, toroidal: 1 }, {

  noiseChoices: ['clearTexture', 'computeWorley4D'],

  outputChannel: 3,

  id: 'detail32',

});



const detail3DView = noise.get3DView('detail32');

```



## Blue noise baking



The playground bakes `256 x 256` blue noise with `computeBlueNoise`, then applies a small blur/contrast preprocess before binding it to the cloud shader. Blue noise drives ray jitter and temporal sampling. Close-up jitter is attenuated in the cloud shader so near clouds do not look peppered.



```js

const rawBlueView = await noise.computeToTexture(256, 256, {

  seed,

}, {

  noiseChoices: ['clearTexture', 'computeBlueNoise'],

  outputChannel: 1,

  textureKey: 'blue2d',

  viewDimension: '2d-array',

});

```



The worker then binds the filtered view as `blueView`. The cloud shader uses blue noise for screen-space ray jitter, slice jitter, local lighting jitter, sun-transmittance jitter, and a tiny lighting-noise lift. Do not remove it globally unless you also retune the near-edge and far-cloud stability path.



## Binding noise output to the cloud renderer



```js

clouds.setInputMaps({

  weatherView,

  shape3DView,

  detail3DView,

  blueView,

});

```



Use `setNoiseTransforms()` for animation and style adjustment. Do not re-bake 3D textures every frame unless you are intentionally changing seed, size, entry point, or noise construction.



---



# Playground baseline settings



These are the tuned starting points in `cloudTestThreaded.js`.



## Playground UI



The playground now starts with a sticky quick dock above the renderer. Use it for the high-frequency controls: render tab, tuning tab, texture tabs, layer preset, color grade, render divider, render, rebake, and advanced-control visibility. The original detailed panels are still present underneath. With Advanced off, lower-priority lighting and tuning fields are tucked away so the main workflow stays focused.



The 3D shape and detail texture previews each have their own Z slice slider directly under the canvas. The old shared slice slider still works and drives both previews together, but the per-texture sliders are easier for inspecting the actual volume textures.



Texture preview canvases render once after startup baking and can be refreshed from the worker with `refreshDebug`, so they should no longer stay blank after the first frame.



Startup keeps the UI responsive while shader compilation and GPU noise baking run in the worker. The playground immediately clears the canvas to the configured sky, but it deliberately does not display a simplified cloud proxy: the first cloud-bearing image comes from the regular raymarch and the same full-size resources used by later frames. This avoids a visible scene/layout swap when the expensive shader finishes compiling. The raymarch compiles asynchronously, so controls, progress text, and timing diagnostics continue updating during a cold driver compile.



The complete startup trace is exposed as `window.cloudStartupTiming` and is also emitted through the `cloud-startup-timing` window event. Its `stages` array covers UI/worker setup, the loading-sky clear, uniform uploads, every noise buffer/dispatch stage, pipeline warmup, output/history allocation, cloud dispatch encoding, command-buffer finish, queue submission, and GPU queue drains. `metadata.loadingSkyVisibleMs` reports the responsive loading state; `metadata.timeToFirstFrameMs` reports the first real raymarched cloud image. While work is still running, `window.cloudWorkerTiming` identifies the exact active worker stage and `window.cloudWorkerTimingHistory` keeps recent snapshots. Noise bake submission timings and GPU completion waits are labeled separately so an expensive GPU bake is not misreported as JavaScript buffering time.



`pipelineWarmup.computePipelines` now reports shader module creation/validation and each compute variant's `compileMs`, entrypoint, quality flag, and status. The same structured-cloneable object is available from `CloudComputeBuilder.getComputePipelineTimings()`. These are API wall times, not GPU execution timestamps; cached variants retain their original compile measurement. A large warmup `computeMs` with a small frame dispatch/queue wait means pipeline compilation, not texture buffering or raymarch resolution, is delaying startup.



Normal/exposure probes use compact loops to avoid repeatedly expanding the density/warp call graph during compilation. The regular pipeline excludes detailed density lighting only when the uploaded `sunStride > 1`, where that branch was already unreachable. Stride 1 (and lower values) selects the full lighting variant; tuning changes are awaited before worker dispatch. This does not introduce a separate low-quality first cloud image. Run the variant/cache regression tests with `node --test tests/cloudPipeline.test.mjs`.



### Rounded flat-volume clouds



Fair Cumulus, Broken Cumulus, Towering Cu, and Cumulonimbus Anvil use a hybrid of rounded growth envelopes and Rain Shelf-style volumetric noise. Individual billows grow outward in all axes and gain density gradually, with upper tiers developing after the lower ones. The full tower height stays fixed: weather does not stretch a pancake into a tall cloud. Wider lower shoulders and randomly leaning upper tiers avoid a repeated straight column. Cumulonimbus Anvil is a mixed weather population: stable random material-cell identities select 24% for tall storms, while other cells produce lower cumulus. Storm shoulders feed broad, shallow, staggered outflow fans before the upper turrets can hide their silhouette. Anvil amount and exaggeration control lateral spread, and the same volumetric breakup carves both canopy and body. The preset camera frames this scattered population more closely rather than presenting the box as one distant object. Cell classification travels with wind and never switches with evolving weather.



The shape base is remapped against its three FBM bands, and detail scallops/valleys carve density throughout the volume, not just the skin of solid ellipsoids. Independently advected detail also bends the scaffold and the shape-sampling domain, producing continuous billowing without height pumping. Cached lighting normals follow this noise-shaped signed field, independently of young-billow opacity limits. Detail uses a volume-appropriate scale (`0.04` times the thin-layer detail transform) so voxel filtering retains meaningful structure instead of collapsing to the final 1x1 mip. Y transforms preserve their sign but use square-root compression to avoid exaggerated horizontal rings on tall towers. All of this reuses the existing single shape/detail samples per density voxel, adding no raymarch noise or lighting probes. Tenuous output alpha and premultiplied radiance fade smoothly before temporal history using Min Alpha, attenuating pale scaffold outlines without a hard birth cutoff.



Developed rounded clouds retain connected optical mass beneath that breakup. A smooth interior support follows the noisy body and each billow's development limit; it gradually adds core density as maturity rises from 0.20 to 1.00. Fine and shadow density share this support, so the thicker body also casts thicker volume shadows. It is not a compositing alpha boost, and newborn puffs/outer wisps remain soft. Broad shape noise samples at `0.35` times the layer transform, while fine detail deformation is gentler; high-frequency noise no longer shreds the entire body. Noise still modulates interior density and lighting as well as the silhouette. These adjustments only affect cached flat-volume fields, not Rain Shelf or Wispy High.



Shape wind translates the entire cell lattice and its surface noise together (`world center = material center - shapeOffsetWorld.xz`). Weather is sampled in the co-moving domain, with its own slower offset controlling development. Per-voxel edge fading allows drifting cells to enter and leave the box without whole-center culling pops. Noise is filtered to the field's voxel footprint, without applying the thin layer's vertical/anvil distortions a second time. Preset cameras frame the volume from outside. Returning to a layer preset restores the saved layer camera, original thin volume, and original lighting. Wispy High keeps gentle erosion, no additive opacity boost, and a low alpha cutoff so translucent wisps survive. Rain Shelf's density and lighting path is unchanged. Preset changes pause an active animation until baking and a fresh full frame finish, then resume it.



Rounded forms split work into `buildCloudDensityField`, `buildCloudLightField`, a small field-reading `computeCloudBox`, and `resolveCloudFlat`. These dispatches share bindings/resources and execute in one compute pass and queue submission, with no CPU readback between them. Density and shadow/AO use two `128 x 64 x 128` RGBA16F textures (16 MiB combined), allocated lazily only when a rounded form is selected. Moving the camera reuses both fields; changing the sun rebuilds lighting only; changing scene/noise inputs rebuilds both. In-place noise rebakes explicitly invalidate the fields.



The lighting texture stores filterable sun-facing and sky-facing responses in RG, sun visibility in B and ambient visibility in A. It does not interpolate compressed normal coordinates: their encoding seam previously caused moving patches to flip shading. Broad form gradients are evaluated over 1.5 voxels, and empty cells bordering density also receive lighting to avoid a full-sun discontinuity at moving edges. Sun integration uses midpoint samples at approximately two per crossed density voxel, bounded to 16–48 samples during the cached bake; each screen-space ray step reads one density and, when occupied, one lighting sample. Optional Cloud turbulence adds two detail-noise reads only at resolved shoulders. The grid remains world-aligned. Normal volumes cover their box; wide skies repeat a bounded tile and select filtered cache levels by pixel and march-step footprint. This is not a camera-relative clipmap.



The Puffs controls expose size, height variation, and ambient occlusion. AO takes twelve neighboring density probes (six directions at two radii), weighted toward the outward hemisphere, during the cached lighting bake, not during each ray step. This emphasizes creases between billows instead of uniformly darkening opaque interiors. Changing AO strength blends that cached term without rebaking. A low-order scattering fill reuses cached sun visibility to reveal shaded billows without additional texture probes. Ray jitter reads the existing blue-noise map once per pixel, avoiding diagonal stripes from a correlated screen hash. Rounded preset cameras initially show sunlit shoulders; backlit angles remain available through camera controls. These changes affect rounded forms only, leaving the default layer look and call graph intact.



Rounded flat clouds use volume-aware preview finishing: the compositor retains their premultiplied volume radiance rather than reconstructing a painted surface from screen-space alpha. Broad noise folds drive cached normals, with stronger crease AO and less ambient fill, so shadow-side billows retain depth. A lighter aerial-fog treatment avoids washing out that lighting. Exposure, shadow contrast/darkness, color lift, saturation and lit/shadow tints still shape the result; the legacy screen-space rim/edge styling belongs to the layer compositor. The mode flag reuses render-uniform padding (the buffer remains 304 bytes), and changing forms refreshes it even when the camera and grade are unchanged. No new field samples, passes or bindings are needed. Rain Shelf and spherical clouds retain their original finishing path.



Cloud and weather preset changes preserve the current playback state. **Animate clouds** starts scrolling and **Pause clouds** freezes the scene. Normal-width volumes use an unbounded co-moving cell lattice, with seeded forms, weather and heights fading through the box edges. Skies wider than 72 world units instead repeat a bounded cloud tile, keeping voxel detail independent of the viewing span. This is a repeating weather field, not a unique streamed world. The worker advances wind using elapsed time without resetting offsets each frame.



Select **Rotating Cloud Donut** in the layer preset menu for an arbitrary-volume example. Its rotating torus boundary clips a fully 3D, independently scrolling noise population, not an extruded horizontal cloud layer or a marching-cubes mesh. The hole remains empty; cached lighting follows the moving boundary and noisy cloud folds. Rotation runs at 0.22 radians/second, initialized to a readable tilted view when entering the example. Leaving it restores the previous horizontal bounds and clears the torus mask. Other rounded presets still use the square volume and Rain Shelf remains unchanged.



`CloudComputeBuilder.setVolumeMask({ shape: "torus", rotationAngle: 1.05 })` configures the example; `shape: "box"` removes it. Partial updates retain existing values. A 64-byte field uniform includes mask parameters in the density/light cache signature, so rotating the boundary rebakes both fields while an irrelevant box rotation does not. `cloudTorusDistance` is the small signed-distance mask to replace when adding another arbitrary shape. There are no extra raymarch texture probes or CPU readbacks.



Flat raymarch and temporal resolve also use separate shader modules, passing unquantized f32 radiance through a 32-byte-per-pixel scratch buffer. Outputs exceeding the device's storage-binding limit retain inline resolve. `computeStages` in worker frame timings records density/light dispatches or cache hits, raymarch encoding, and temporal resolve encoding. Stage `encodeMs` values are CPU/API times; GPU queue completion remains separately reported. Pipeline timings list each entrypoint's compilation wall time. Cold driver compilation and disk-cache hits must be compared separately.



The maintained WebGPU anvil parity check and visual review server live in

`tests/browser/`; see [Testing](#testing). The older `.compile-diagnostics`

experiment snapshots/server are not included in this source tree.



## Preview



| Parameter | Default | Meaning |

|---|---:|---|

| Camera position | `[-0.75, -1.2, -0.95]` | Initial camera position. |

| Camera yaw | `35` | Initial horizontal view angle in degrees. |

| Camera pitch | `28` | Initial vertical view angle in degrees. |

| FOV Y | `60` | Vertical field of view in degrees. |

| Exposure | `1.18` | Composite exposure. |

| Sky | `[0.60, 0.75, 0.98]` | Clear sky color. |

| Cloud box center | `[0, 0, 0]` | World-space AABB center. |

| Cloud box half | `[18, 0.3, 18]` | World-space AABB half extents. |

| Cloud box uvScale | `1` | Weather mapping scale over the box. |

| Render Scale Divider / Coarse Factor | `4` | `1` full res, `4` default coarse compute per axis, then upsampled to the full presentation canvas. |

| Alpha Floor | `0.085` | Composite alpha floor. Faint alpha below the threshold fades out before sky compositing to remove low-alpha glow haze. |

| Temporal Interleave | `1 / 4` | Compact temporal update rate. `1` updates all pixels, `4` updates one quarter of the 8x8 temporal cell pattern per frame after the history seed. |

| Layer Preset | `rain_shelf` | Startup coordinated weather, shape, detail, density, anvil, and vertical-tuning preset. |

| Grade Style | `3` | Preview color grade preset. |

| Shadow Strength | `1.00` | Composite shadow weight. |

| Shadow Edge | `1.00` | Edge shadow emphasis. |

| Shadow Darkness | `0.50` | Shadow darkening amount. |

| Color Lift | `1.28` | Brightness/lift in the composite. |

| Saturation | `1.24` | Composite saturation. |

| Rim Strength | `1.04` | Rim/edge highlight strength. |

| Sun Bleed | `0.66` | Sun bleed through lit cloud areas. |

| Mid Lift | `1.26` | Midtone lift. |

| God Rays Enabled | `true` | Enables preview god rays. |

| God Ray Strength | `1.00` | God-ray intensity. |

| God Ray Length | `1.10` | God-ray sample length. |

| God Ray Falloff | `1.10` | God-ray falloff. |

| Sun azimuth | `45` | Sun azimuth in degrees. |

| Sun elevation | `21` | Sun elevation in degrees. |

| Sun bloom | `0.18` | Preview bloom around sun direction. |

| Sun Tint | `[1.0, 1.0, 1.0]` | Sun color tint passed into the preview/composite profile. |

| Transmissive Light Tint | `[0.94, 1.00, 1.08]` | Backlit/transmissive volume lighting tint. |

| Front Light Tint | `[1.18, 1.24, 1.32]` | Direct/front-lit cloud-top and sun-facing cloud-face lighting tint. |

| Volume Shadow Tint | `[0.60, 0.68, 0.82]` | Internal volumetric shadow tint. |

| Direct Light Blend | `0.90` | Blend amount from transmissive lighting toward the direct/front-lit profile. |

| Direct Light Boost | `0.72` | Brightness boost for directly lit surfaces. |

| Cloud Lit Tint | `[1.0, 1.0, 1.0]` | Preview lit-cloud color tint. |

| Cloud Shadow Tint | `[0.0, 0.0, 0.0]` | Preview shadow color tint. |

| Edge Tint | `[1.0, 1.0, 1.0]` | Rim and edge color tint. |



## Weather R channel



| Parameter | Default | Meaning |

|---|---:|---|

| mode | `computeFBM4D` | Base weather coverage mode. |

| seed | `123456789001` | Weather permutation seed. |

| zoom | `4.0` | Weather scale in noise space. |

| freq | `1.0` | Base frequency. |

| octaves | `5` | Fractal octave count. |

| lacunarity | `2.0` | Frequency multiplier per octave. |

| gain | `0.5` | Amplitude multiplier per octave. |

| threshold | `0.0` | Noise threshold passed to the noise shader. |

| seedAngle | `Math.PI / 2` | 4D seed rotation angle. |

| time | `0.0` | 4D time coordinate. |

| voroMode | `0` | Voronoi mode where supported. |

| edgeK | `0.0` | Edge shaping value where supported. |

| warpAmp | `0.0` | Domain warp amplitude. |



## Weather G channel



| Parameter | Default | Meaning |

|---|---:|---|

| enabled | `true` | Enables G channel baking. |

| mode | `computeBillow4D` | Billow modulation mode. |

| seed | `123456789000` | G channel seed. |

| zoom | `4.0` | G channel scale. |

| freq | `1.5` | Base frequency. |

| octaves | `4` | Octave count. |

| lacunarity | `2.0` | Frequency multiplier. |

| gain | `0.5` | Amplitude multiplier. |

| threshold | `0.0` | Noise threshold. |

| seedAngle | `Math.PI / 2` | 4D seed rotation angle. |

| time | `0.0` | 4D time coordinate. |

| voroMode | `0` | Voronoi mode where supported. |

| edgeK | `0.0` | Edge shaping value. |

| warpAmp | `0.0` | Domain warp amplitude. |



## Weather B channel



| Parameter | Default | Meaning |

|---|---:|---|

| enabled | `false` | Disabled by default. |

| mode | `computeBillow` | Optional extra weather modulation. |

| seed | `123456789003` | B channel seed. |

| zoom | `4.0` | B channel scale. |

| freq | `1.5` | Base frequency. |

| octaves | `4` | Octave count. |

| lacunarity | `2.0` | Frequency multiplier. |

| gain | `0.5` | Amplitude multiplier. |

| threshold | `0.0` | Noise threshold. |

| seedAngle | `Math.PI / 2` | 4D seed rotation angle. |

| time | `0.0` | Time coordinate. |

| voroMode | `0` | Voronoi mode where supported. |

| edgeK | `0.0` | Edge shaping value. |

| warpAmp | `0.0` | Domain warp amplitude. |



## Shape volume



| Parameter | Default | Meaning |

|---|---:|---|

| texture size | `128³` | 3D shape volume size. |

| seed | `Date.now() >>> 0` | Shape seed. |

| zoom | `4` | Shape noise scale. |

| freq | `1.0` | Base frequency. |

| octaves | `2` | Octave count. |

| lacunarity | `2.0` | Frequency multiplier. |

| gain | `0.5` | Amplitude multiplier. |

| threshold | `0.0` | Noise threshold. |

| seedAngle | `Math.PI / 2` | 4D seed rotation angle. |

| time | `0.0` | 4D time coordinate. |

| voroMode | `4` | Voronoi/cellular mode. |

| edgeK | `0.0` | Edge shaping value. |

| warpAmp | `0.0` | Domain warp amplitude. |

| baseModeA | `computeAntiWorley4D` | First base shape mode. |

| baseModeB | `computeAntiWorley4D` | Optional second base shape mode. |

| bandMode2 | `computeAntiWorley4D` | Lower frequency band, channel 2. |

| bandMode3 | `computeAntiWorley4D` | Lower frequency band, channel 3. |

| bandMode4 | `computeAntiWorley4D` | Lower frequency band, channel 4. |



## Detail volume



| Parameter | Default | Meaning |

|---|---:|---|

| texture size | `32³` | 3D detail volume size. |

| seed | `Date.now() >>> 0` | Detail seed. |

| zoom | `4` | Detail scale. |

| freq | `1.0` | Base frequency. |

| octaves | `4` | Octave count. |

| lacunarity | `2.0` | Frequency multiplier. |

| gain | `0.5` | Amplitude multiplier. |

| threshold | `0.0` | Noise threshold. |

| seedAngle | `Math.PI / 2` | 4D seed rotation angle. |

| time | `0.0` | 4D time coordinate. |

| voroMode | `7` | Voronoi/cellular mode. |

| edgeK | `0.0` | Edge shaping value. |

| warpAmp | `0.0` | Domain warp amplitude. |

| mode1 | `computeWorley4D` | Detail band 1. |

| mode2 | `computeWorley4D` | Detail band 2. |

| mode3 | `computeWorley4D` | Detail band 3. |



## Noise transforms and animation



| Parameter | Default | Meaning |

|---|---:|---|

| shapeOffsetWorld | `[0, 0, 0]` | Shape sample offset. |

| detailOffsetWorld | `[0, 0, 0]` | Detail sample offset. |

| weatherOffsetWorld | `[0, 0, 0]` | Weather sample offset. |

| shapeScale | `0.1` | Shape texture world scale. |

| detailScale | `1.0` | Detail texture world scale. |

| weatherScale | `1.0` | Weather texture world scale. |

| shapeAxisScale | `[1, 1, 1]` | Per-axis shape scaling. |

| detailAxisScale | `[1, 1, 1]` | Per-axis detail scaling. |

| weatherAxisScale | `[1, 1, 1]` | Per-axis weather scaling. |

| shapeBias | `0.4` in playground | Adds a flat bias to shape samples. |

| detailBias | `0.0` | Adds a flat bias to detail samples. |

| weatherBias | `0.3` in playground | Adds a flat bias to weather samples. |

| shapeVel | `[0.1, 0, 0]` | Playground animation velocity. |

| detailVel | `[0.03, 0, 0]` | Playground animation velocity. |

| weatherVel | `[0.01, 0, 0]` | Playground animation velocity. |



---



# `CloudComputeBuilder` parameter reference



## `setParams(params)`



Cloud appearance and lighting parameters. Builder defaults are shown.



| Parameter | Default | Meaning |

|---|---:|---|

| globalCoverage | `1.0` | Overall cloud coverage multiplier. |

| globalDensity | `1000.0` | Density/extinction scale. |

| cloudAnvilAmount | `0.0` | Single anvil/cumulonimbus amount. Higher values continue to overdrive tower height, lift/headroom, soft cap taper, and anvil spread. |

| cloudBeer | `6.0` | Beer/Powder style density response. |

| attenuationClamp | `0.015` | Minimum light transmittance clamp. |

| inScatterG | `0.55` | Forward/in-scatter phase anisotropy. |

| silverIntensity | `12.0` | Silver lining intensity. |

| silverExponent | `12.0` | Silver lining falloff exponent. |

| outScatterG | `0.08` | Out-scatter phase anisotropy. |

| inVsOut | `0.55` | Blend between in-scatter and out-scatter phase. |

| outScatterAmbientAmt | `0.08` | Ambient contribution from out-scatter side. |

| ambientMinimum | `0.04` | Minimum ambient light. |

| sunColor | `[1.0, 0.985, 0.95]` | Sun light color. |

| frontLightColor | `[1.10, 1.12, 1.16]` | Direct/front-lit cloud profile color. |

| shadowLightColor | `[0.62, 0.68, 0.78]` | Volumetric shadow lighting color. |

| densityDivMin | `0.001` | Small denominator guard for density response. |

| silverDirectionBias | `0.9` | Directional bias for silver highlight. |

| silverHorizonBoost | `0.35` | Extra silver boost near horizon angles. |



## `setNoiseTransforms(transforms)`



World-space texture sampling and bias parameters. `setTileScaling()` is an alias.



| Parameter | Default | Meaning |

|---|---:|---|

| shapeOffsetWorld | `[0, 0, 0]` | Shape volume offset in world units. |

| detailOffsetWorld | `[0, 0, 0]` | Detail volume offset in world units. |

| weatherOffsetWorld | `[0, 0, 0]` | Weather map offset in world units. |

| shapeScale | `0.1` | Shape sampling scale. |

| detailScale | `1.0` | Detail sampling scale. |

| weatherScale | `1.0` | Weather sampling scale. |

| shapeAxisScale | `[1, 1, 1]` | Per-axis shape scaling. |

| detailAxisScale | `[1, 1, 1]` | Per-axis detail scaling. |

| weatherAxisScale | `[1, 1, 1]` | Per-axis weather scaling. |

| shapeBias | `0.0` | Flat additive bias after shape sampling. |

| detailBias | `0.0` | Flat additive bias after detail sampling. |

| weatherBias | `0.0` | Flat additive bias after weather sampling. |



## `setTuning(tuning)`



Raymarch and visual stability parameters. These control quality, performance, LOD, near/far behavior, and the thick-box/far-proxy path.



| Parameter | Default | Meaning |

|---|---:|---|

| maxSteps | `256` | Primary ray maximum step count. |

| minStep | `0.003` | Minimum primary step length. |

| maxStep | `0.16` | Maximum primary step length before adaptive boosts. |

| sunSteps | `6` | Maximum sun-shadow samples per lighting update. |

| sunStride | `3` | Primary steps between lighting updates. |

| sunMinTr | `0.003` | Early cutoff for sun transmittance. |

| phaseJitter | `1.0` | Jitter amount for phase/light sampling. |

| stepJitter | `0.3` | Raymarch step jitter amount. |

| baseJitterFrac | `0.02` | Base jitter fraction. |

| topJitterFrac | `0.1` | Jitter fraction near top/cloud edge regions. |

| lodBiasWeather | `1.5` | Weather mip bias. |

| aabbFaceOffset | `0.0015` | Offset to avoid AABB face self artifacts. |

| weatherRejectGate | `0.985` | Conservative empty weather gate. Higher rejects less. |

| weatherRejectMip | `1.0` | Mip level used for weather rejection checks. |

| emptySkipMult | `4.25` | Empty-space skip multiplier. |

| nearFluffDist | `60.0` | Distance range for protected near-cloud behavior. |

| nearStepScale | `0.3` | Near-cloud step scale. Lower means finer near sampling. |

| nearLodBias | `-1.5` | Near-cloud LOD bias. |

| nearDensityMult | `2.5` | Near-cloud density compensation. |

| nearDensityRange | `45.0` | Distance range for near density compensation. |

| lodBlendThreshold | `0.46` | Density/LOD blend threshold. |

| sunDensityGate | `0.0025` | Density gate before running sun-shadow work. |

| fflyRelClamp | `1.6` | Firefly relative clamp. |

| fflyAbsFloor | `0.85` | Firefly absolute floor. |

| taaRelMin | `0.22` | Minimum temporal relative clamp. |

| taaRelMax | `1.1` | Maximum temporal relative clamp. |

| taaAbsEps | `0.02` | Temporal absolute epsilon. |

| farStart | `1.05` | Distance where far behavior begins. |

| farFull | `4.2` | Distance where far behavior reaches full strength. |

| farLodPush | `0.55` | Extra LOD push for far samples. |

| farDetailAtten | `0.72` | Far detail attenuation. |

| farStepMult | `2.05` | Far sample step multiplier. |

| bnFarScale | `0.28` | Far blue-noise scale. |

| farTaaHistoryBoost | `1.8` | Stronger history blend for far clouds. |

| raySmoothDens | `0.34` | Density smoothing along the ray. |

| raySmoothSun | `0.34` | Sun lighting smoothing along the ray. |

| fluffFactor | `2.0` | Edge erosion/scallop strength. |

| anvilLift | `0.6` | Internal anvil lift/headroom helper used by the cumulonimbus/anvil profile. |

| alphaCutoff | `0.98` | Early ray termination alpha. When accumulated opacity reaches this cutoff, output alpha is clamped to `1.0` and the ray stops. Higher values march deeper. |

| thickBoxPerf | `0.65` | Internal strength of thick-box acceleration. |

| thickStepBoost | `1.28` | Internal step boost for thick boxes. |

| thickDetailSkip | `0.18` | Internal detail-skip strength in safe interiors. |

| thickLightSkip | `0.42` | Internal light-skip strength in safe interiors. |

| verticalStepBoost | `3.0` | Extra primary ray step budget for tall boxes. Keeps Y expansion closer to X/Z cost. |

| verticalTextureHomogeneity | `0.0` | Enables homogeneous tall-Y behavior. Tall boxes use repeated warped Y phases and tiled shape/detail sampling instead of stretching one 3D texture slab through the whole raw AABB. `0` keeps raw box-height profiling. |

| verticalLightingStepBoost | `1.35` | Mild sun-step boost for tall boxes after vertical texture normalization. |

| frontOcclusionStrength | `0.72` | Close-cloud behind-body acceleration. `0` disables it; higher values cut hidden rays sooner after front opacity builds. |

| frontOcclusionAlpha | `0.66` | Accumulated alpha where front-occlusion acceleration starts. |

| frontOcclusionStepBoost | `3.0` | Maximum step multiplier used behind an already opaque close cloud front. |

| sliceJitterStrength | `0.08` | Stable per-step ray jitter that breaks up horizontal slice bands in tall boxes. |

| verticalLayerDecorrelation | `0.35` | Subtle non-planar Y perturbation for shape/detail sampling so tall boxes do not produce horizontal sheets. |

| directLightBlend | `0.78` | Blend amount for the direct/front-lit cloud-lighting profile. |

| directLightBoost | `0.58` | Brightness boost for the direct/front-lit cloud-lighting profile. |

| alphaBoostThreshold | `0.22` | Final alpha threshold before post-light alpha boost is applied. |

| alphaBoostAmount | `0.16` | Post-light alpha boost amount above `alphaBoostThreshold`. |



## `setReprojSettings(reprojection)`



Temporal and reduced-resolution rendering parameters.



| Parameter | Default | Meaning |

|---|---:|---|

| enabled | `0` | Enables temporal reprojection when nonzero. |

| subsample | `1` | Reprojection/render scale divider. |

| sampleOffset | `0` | Subsample pattern offset. |

| motionIsNormalized | `0` | Interprets motion vectors as normalized UV motion. |

| temporalBlend | `0.9` | History blend factor. |

| depthTest | `0` | Enables depth compatibility check. |

| depthTolerance | `0.0` | Depth test tolerance. |

| frameIndex | `0` | Frame counter for jitter/reprojection. |

| fullWidth | `0` | Full output width for reprojection math. |

| fullHeight | `0` | Full output height for reprojection math. |

| temporalCellRate | `4` | Interleaved update rate. Use `1`, `2`, `4`, `8`, `16`, `32`, or `64`. `1` means full march. `4` means one quarter of the compact 8x8 cell pattern is updated per frame after history is seeded. |

| temporalCellPhase | `0` | Current phase for the interleaved cell update pattern. The worker advances this per frame. |

| compactInterleave | `0` | Enables compact 8x8 temporal interleave dispatch when the worker has valid history. The worker manages this internally for animation. |



## `setPerfParams(perf)`



Low-level LOD bias controls.



| Parameter | Default | Meaning |

|---|---:|---|

| lodBiasMul | `1.0` | Multiplies computed LOD bias. |

| coarseMipBias | `0.0` | Additional mip bias for coarse rendering. |



## `setBox(box)`



| Parameter | Default | Meaning |

|---|---:|---|

| center | `[0, 0, 0]` | Cloud AABB center in world units. |

| half | `[18, 0.6, 18]` | Cloud AABB half extents in world units. |

| uvScale | `1.0` | Weather map mapping scale. |



The playground baseline overrides `half` to `[18, 0.3, 18]`.



## `setViewFromCamera(view)`



| Parameter | Default | Meaning |

|---|---:|---|

| camPos | `[0, 0, 3]` | Camera position. |

| right | `[1, 0, 0]` | Camera right vector. |

| up | `[0, 1, 0]` | Camera up vector. |

| fwd | `[0, 0, 1]` | Camera forward vector. |

| fovYDeg | `60` | Vertical field of view. |

| aspect | output aspect | Width divided by height. |

| planetRadius | `0.0` | Reserved for curved/planet style setups. |

| cloudBottom | `-1.0` | Reserved cloud bottom reference. |

| cloudTop | `1.0` | Reserved cloud top reference. |

| worldToUV | `1.0` | World to UV scale helper. |

| stepBase | `0.02` | Base view step helper. |

| stepInc | `0.04` | Step increment helper. |

| volumeLayers | `1` | Number of output layers. |



## `renderToCanvas(canvas, options)`



Preview/composite parameters.



| Parameter | Default | Meaning |

|---|---:|---|

| cam | optional | `{ camPos, right, up, fwd, fovYDeg, aspect }`. |

| yawDeg | `0` | Used only if `cam` is not provided. |

| pitchDeg | `0` | Used only if `cam` is not provided. |

| zoom | `3.0` | Used only if `cam` is not provided. |

| fovYDeg | `60` | Used only if `cam` is not provided. |

| aspect | canvas aspect | Used only if `cam` is not provided. |

| sunDir | `[0, 1, 0]` | Sun direction if `cam` is provided. |

| sunAzimuthDeg | `45` | Used only if `sunDir` is not provided. |

| sunElevationDeg | `20` | Used only if `sunDir` is not provided. |

| layerIndex | `0` | Output texture layer to display. |

| compositeQuality | `2` | Preview composite quality, clamped `0..2`. |

| exposure | `1.28` | Exposure multiplier. |

| sunBloom | `0.0` | Sun bloom amount. |

| skyColor | `[0.55, 0.7, 0.95]` | Background sky color. |

| gradeStyle | `0` | Composite color-grade style. |

| sunColorTint | `[1, 1, 1]` | Sun color tint. |

| lightTint | `[1, 1, 1]` | Lit cloud tint. |

| shadowTint | `[0, 0, 0]` | Shadow tint. |

| edgeTint | `[1, 1, 1]` | Edge/rim tint. |

| styleShadowStrength | `0.74` | Shadow strength. |

| styleShadowEdge | `0.0` | Edge shadow shaping. |

| styleShadowDarkness | `0.0` | Shadow darkness. |

| styleColorLift | `1.18` | Color lift. |

| styleSaturation | `1.04` | Saturation. |

| styleRimStrength | `1.08` | Rim highlight strength. |

| styleSunBleed | `0.96` | Sun bleed strength. |

| styleMidLift | `0.94` | Midtone lift. |

| alphaFloor | `0.085` | Composite alpha floor used to fade out faint low-alpha haze before sky compositing. |

| godRaysEnabled | `false` | Enables god-ray composite. |

| godRayStrength | `0.0` | God-ray strength. |

| godRayLength | `1.0` | God-ray length. |

| godRayFalloff | `1.55` | God-ray falloff. |

| displayWidth | optional | CSS display width. |

| displayHeight | optional | CSS display height. |

| pixelWidth | optional | Canvas pixel width. |

| pixelHeight | optional | Canvas pixel height. |

| dpr | `devicePixelRatio` | Device pixel ratio override. |



---



# Worker/playground RPC commands



The playground keeps WebGPU ownership in `cloudTest.worker.js`. The main thread sends plain parameter objects.



Common commands:



| Command | Purpose |

|---|---|

| `init` | Initialize WebGPU, `NoiseComputeBuilder`, `CloudComputeBuilder`, canvases, and default resources. |

| `resize` | Resize output/history resources. |

| `bakeWeather` | Rebuild weather R/G/B channels. |

| `bakeBlue` | Rebuild blue noise. |

| `bakeShape` | Rebuild the `128³` shape volume. |

| `bakeDetail` | Rebuild the `32³` detail volume. |

| `bakeAll` | Rebuild all procedural textures. |

| `setNoiseTransforms` | Update offsets, scales, biases, axis scales, and velocities. |

| `setTileTransforms` | Compatibility alias for `setNoiseTransforms`. |

| `setTuning` | Update cloud raymarch tuning. |

| `setSlice` | Compatibility shared debug slice index for shape/detail preview canvases. |

| `setDebugSlice` | Update the shape or detail debug preview slice independently. |

| `refreshDebug` | Repaint weather, shape, detail, and blue-noise preview canvases without rebaking. |

| `setReproj` | Update reprojection settings. |

| `setLiveFrameState` | Coalesced live preview, cloud, tuning, transform, and reprojection updates consumed by the animation loop. |

| `runFrame` | Dispatch one cloud frame and composite. |

| `startLoop` | Start animated rendering. |

| `stopLoop` | Stop animated rendering. |

| `shutdown` | Dispose resources. |



---



# Animation loop, visual FPS, and live editing



The playground animation loop is worker-owned. The main thread sends state, and the worker advances the cloud offsets, updates temporal phases, dispatches the cloud pass, and composites the result.



Key runtime rules:



- `Render Scale Divider` is the active cloud compute coarse factor for both still renders and animation. The final presentation canvas stays full size.

- Coarse animation computes the current reduced-resolution cloud buffer every frame, then upsamples it to the full presentation canvas.

- Temporal Interleave is a full-resolution history mode. It is automatically bypassed when `Render Scale Divider` is greater than `1`, because stacking interleave on top of coarse rendering can leave stale coarse texels that upsample into vertical or horizontal streaks.

- The worker keeps a small non-blocking GPU in-flight window for backpressure. The default window is `2` GPU frames in flight. The hot animation loop does not use a fixed every-N-frame `queue.onSubmittedWorkDone()` stall.

- Resize requests are coalesced and applied at frame boundaries so the WebGPU context and history textures are not reallocated repeatedly during a drag.

- Preview, cloud parameter, tuning, and transform edits are coalesced through `setLiveFrameState` while animation is running. Noise edits that require rebaking textures are still expensive.

- Camera edits do not reset the evolved `shapeOffsetWorld`, `detailOffsetWorld`, or `weatherOffsetWorld`. Transform controls update offsets explicitly; camera/tuning edits do not overwrite animated cloud time.

- The visible FPS ticker reports browser visual `requestAnimationFrame` cadence only. Worker timing, GPU completion observation, and present-scale details are internal diagnostics.





# Performance notes



## Render scale divider



`Render Scale Divider` is the first performance knob.



```text

1 = full resolution

2 = half resolution per axis

4 = quarter resolution per axis

5 = one fifth resolution per axis

```



The playground default is `4`. This computes one quarter resolution per axis and upsamples the current cloud buffer to the full presentation canvas. Coarse rendering does not sample temporal history by default, so it avoids stale coarse-cell reprojection streaks.



## Screen interleave



Screen Interleave is a full-resolution temporal sampling mode. When `Render Scale Divider` is `1`, temporal history can compact-dispatch only the owned 8x8-cell subset for the current phase, so `1 / 4 rays per frame` launches roughly one quarter of the cloud ray work instead of launching all pixels and branching inside the shader.



When `Render Scale Divider` is greater than `1`, the divider already reduces the ray grid. In that mode the renderer bypasses both temporal cell interleave and reprojection history sampling inside the coarse pass. The entire coarse cloud grid is refreshed every frame before upsampling. This avoids stale coarse texels being stretched into vertical, horizontal, or blocky reprojection streaks.



The first full-resolution history-seeding frame always renders all active pixels.



## Tall boxes



This is WIP along with better storm cell formation. Increasing `Box Half Y` is expensive because rays can spend more time inside the vertical cloud slab. The renderer reduces this cost with active-Y ray clipping, a global active-Y early-out, weather-derived column bounds, empty weather skipping, adaptive thick-box stepping, and far-proxy sampling. Still, very tall boxes should use:



- Render Scale Divider `4` or `5`.

- Reprojection enabled while animating.

- Temporal Interleave `1 / 2` or `1 / 4` when animating and history is stable. `1 / 32` and `1 / 64` are included as stress-test modes for evaluating the compact dispatch path.

- Conservative `maxSteps`.

- Protected near detail, but cheaper far interiors.



The default path preserves the original cloud sampling style. `verticalTextureHomogeneity` defaults to `0`, so the extra Y-domain compensation is opt-in.



If you see horizontal layer bands in very tall volumes, keep `verticalTextureHomogeneity` at `0` first to confirm the original look. The slice and Y-decorrelation controls are still available as experimental visual tools, but they are no longer part of the default look.



## Horizon boxes



For clouds stretching to the horizon, prefer larger X/Z cloud boxes plus tiled 4D weather. Do not make the 3D shape/detail textures huge just because the box is huge. The noise transforms and tiling handle the scale and randomness.



The quick dock's **Sky span (X/Z)** sets the full square horizontal width in

world units (default 36). It changes both horizontal extents, leaving the cloud

height, cell size and wind unchanged. **Render → Cloud Box → Half X / Z** lets

you set rectangular bounds separately. The cycle preserves those extents.



### Fluffy cloud fidelity



**Cloud turbulence** adds fine procedural erosion to the thin shoulders of

puffy clouds, arbitrary volumes and weather layers. **Natural turbulence** is

the demo default; choose **Gentle wisps**, **Wind-torn wisps** or **Off · smooth

volume** independently of color grade and Cloud shading. Two reads from the

existing tiled detail texture bend and carve the visible edges, following the

detail wind domain. Dense interiors and empty space skip those reads; sample

footprints filter the noise and fade unresolved distant detail.



This effect works at Balanced or High detail without additional 3D textures or

new shadow marches. Switching turbulence reuses the density/light cache and

resets screen history. It adds ray sampling work, so its speed depends on visible

cloud coverage. Standalone Rain Shelf and planets keep their existing noise

paths. API users can opt in with `clouds.setCloudTurbulence(.75)`; `0` restores

the original cached volume result.



Scrolling tiled weather maps or replacing generated weather inputs continues to

drive the voxel body's evolution. Fine turbulence uses world-space coordinates

and the existing independent detail-wind offset, rather than camera or voxel/tile

indices. It therefore remains stable as the camera travels, and does not need a

new fine grid when the view changes. Changing weather/noise still updates the

macro density and lighting normally; this layer adds no weather-map streaming

or paging system of its own.



**Fluffy cloud detail** controls the cached 3D density and lighting resolution

independently of **Render divider**, which only changes screen-space ray count.

This applies to rounded/convective clouds, weather-cycle layers and arbitrary

volumes; the standalone Rain Shelf and planetary paths are unchanged.



| Detail | Density and lighting grid | Combined texture memory | Relative voxel count |

| --- | --- | ---: | ---: |

| Low / fast | 96×48×96 | 7.7 MiB | 0.42× |

| Balanced / default | 128×64×128 | 18.3 MiB | 1× |

| High / finer clouds | 192×96×192 | 61.7 MiB | 3.375× |

| Screenshot / 256 | 256×128×256 | 146 MiB | 8× |

| Capture / 384 | 384×192×384 | 494 MiB | 27× |

| Reference / 512 | 512×256×512 | 1.14 GiB | 64× |



Higher settings reduce voxel-shaped silhouettes and coarse lighting. Voxel

counts are not measured frame-time multipliers; occupied volume and shadow

work also affect cost. Four filtered cache levels soften distant clouds without

extra ray samples. The remaining small mip levels complete an empty-space

hierarchy; density B stores the maximum child density while R/G/A and lighting

retain averaged filtering. The full chain adds about 14% texture memory and

rebuilds only when its source density or lighting changes. Wide skies take large

steps only through intervals proven empty by that hierarchy. Inside clouds,

steps follow voxel spacing and pixel footprint instead of growing unconditionally

with travel distance, avoiding distant lighting grain. The existing maximum ray

budget still bounds work; unusually long, tenuous grazing paths can exhaust it.

Wide skies retain a bounded tile instead of

stretching these voxels across the whole box. **Capture / 384** and **Reference / 512** provide higher

detail targets for still captures and performance comparisons. Reference doubles

each axis of the old screenshot grid, with eight times its voxels and texture

memory. Texture memory excludes output buffers, noise maps and textures awaiting

retirement after a quality switch. These are opt-in tiers; they do not change

cloud shape, style, puff size or the animation clocks.

Unsupported tiers are disabled using the active GPU device's limits. The demo

requests up to 512 MiB of buffer allowance when the adapter supports it, because

some backends use a texture-sized staging buffer to initialize Reference fields.

Direct API users can pass `cloudFieldDeviceDescriptor(adapter.limits)` to

`adapter.requestDevice()` before creating their cloud builder.



For stills, pause animation, choose **Screenshot**, **Capture** or **Reference**,

set **Render divider 1** and **Temporal Off / full quality**. Changing detail

reuses pipelines, replaces both fields on the next frame, retires old textures

after queued work completes, and reseeds temporal history. It does not rebake

the noise maps. Defaults retain the original performance/memory cost.



For direct use: `clouds.setFieldQuality('high')` or `'low'`, `'balanced'`, `'ultra'`,

`'cinematic'` (384) and `'reference'` (512). Compare the same paused scene at each

tier when tuning performance; pipeline timing reports include field dimensions

and cache reuse. Their CPU/API timings are not GPU execution timings.



## Noise baking



Re-bake only when changing:



- Noise mode.

- Seed.

- Texture size.

- Octave/frequency/warp settings that should be baked into the texture.



Animate with:



- `shapeOffsetWorld`

- `detailOffsetWorld`

- `weatherOffsetWorld`

- `shapeVel`

- `detailVel`

- `weatherVel`

- `time`, when intentionally using 4D noise animation





---

## Coarse rendering and temporal interleave



`Render Scale Divider` controls the internal cloud compute resolution. Values above `1` render to a coarse cloud buffer, then upsample to the full presentation canvas. Temporal interleave is allowed in coarse mode, but coarse updated pixels do not use TAA color blending. This keeps the performance benefit of updating a subset of coarse rays without letting stale color history smear into long vertical or horizontal blocks.



For stable animation, start with Render Scale Divider `4` and Temporal Interleave `1 / 4`. Set Temporal Interleave to `Off / full quality` to test the raw coarse upsample path. If an artifact is unchanged by the interleave selector, it is coming from coarse rendering, upsampling, or the raymarch itself rather than the interleave owner pattern.



## Planet overlay adaptive performance



`planetClouds.js` keeps the presentation canvas at display resolution while adapting the internal spherical raymarch target to projected planet coverage and a pixel budget.



Planet cloud layers start in the regular volumetric `raymarch` mode. Set `cloudRenderMode: 'mc33-shell'` explicitly, or use the render-toggle controller, when the extracted surface renderer is desired.



Both planet renderers use progressive startup by default. The raymarcher returns after a confirmed bootstrap frame built from `128 x 64` weather, `32³` shape, `16³` detail, `64²` blue noise, an internal render divider of `8`, and the small bootstrap cloud pipeline. The expensive full raymarch pipeline compiles concurrently and is awaited only by background refinement. The MC33 renderer starts with `128 x 64` spherical maps and a `28 x 28 x 6` shell field. Full maps, volumes, and geometry buffers refine asynchronously in `layer.refinementPromise`; the confirmed bootstrap image remains visible and animation/extraction dispatch is paused until the swap. Set `progressiveStartup: false` to retain blocking full-quality creation, or await `layer.refinementPromise` when downstream work requires final resources immediately.



`layer.startupTiming` is a live structured report during startup and a completed snapshot afterward. The render-toggle controller forwards both `startupTiming` and `refinementPromise`. Listen for `planet-cloud-startup-timing` or supply `onStartupTiming(report, layer)` for telemetry. Each resource stage includes a separate `gpuWaitMs`, making weather, shape, detail, blue-noise, pipeline, and first-frame stalls directly attributable.



Default controls:



| Option | Default | Purpose |

| --- | ---: | --- |

| `cloudRenderMode` | `raymarch` | Starts with regular volumetric clouds; `mc33-shell` remains opt-in. |

| `renderScaleDivider` | `1` | Allows full internal resolution when the pixel budget permits it. |

| `maxDpr` | `2` | Caps overlay canvas device-pixel ratio. |

| `maxRaymarchPixels` | `1400000` | Internal raymarch pixel budget when the planet occupies a smaller part of the view. |

| `fullscreenRaymarchPixels` | `1050000` | Internal raymarch pixel budget when the globe fills most of the screen. |

| `adaptiveScreenQuality` | `true` | Raises the effective render divider as projected globe coverage grows. |

| `adaptiveMarchQuality` | `true` | Reduces primary and sun march work under high screen coverage. |

| `animatedTemporalCellRate` | `2` | Updates half of the stationary animated cloud cells per frame. |

| `animatedTemporalBlend` | `0.45` | Keeps half-rate animated sampling while reducing stale lighting and shadow history. |

| `movingFullscreenCoarseFactor` | `1` | Keeps the same coarse factor during and after camera motion. |



The layer creates its default reprojection history explicitly. Initial frames use a lower march budget at the final output resolution, so the atmosphere appears quickly without a low-resolution texture swap. The first stationary frame after camera motion resets history weights in place instead of reallocating history textures.



### Aurora shell motion and palette



The aurora shell uses independent polar spin and side-axis roll. The defaults favor roll over spin:



```js

auroraSpinSpeed: 0.0024,

auroraRollSpeed: 0.0065,

```



The default aurora palette lowers the green channel and gives gold and red bands more range. These colors remain overridable through `params.frontLightColor`, `params.sunColor`, and `params.shadowLightColor`.



Runtime diagnostics are available through `getPlanetCloudPerformanceStats(layer)` or `layer.performanceStats`:



```js

const stats = getPlanetCloudPerformanceStats(planetCloudLayer);

console.table(stats);

```



# Credits

WebGPU implementation by Joshua Brewster (MIT License)



Inspired by Fredrik Häggström's [Real-time rendering of volumetric clouds](https://www.diva-portal.org/smash/record.jsf?pid=diva2:1223894&dswid=7420).



This implementation uses the companion WebGPU procedural texture work in [webgpu_noise_compute_textures](https://github.com/joshbrew/webgpu_noise_compute_textures).





### Randomized aurora gradients



Aurora gradients use full-spectrum palette families, including green/gold, cyan/blue, violet/magenta, teal/purple, sunset, ruby, rose, and mixed solar palettes.



```js

randomizePlanetAuroraGradient(auroraLayer, {

  auroraGradientRandomAmount: 0.72,

  auroraGreenBoost: 1.0,

});

```



Set `auroraGradientSeed` for a repeatable palette. Set `auroraPaletteFamily` to force a family, or set `auroraRandomizeGradient: false` to use the fixed preset.



## Planet cloud MC33 shell mode



The planet simulation starts in regular raymarch mode. Its bottom-left **Clouds: Raymarch / Clouds: MC33 Shell** button switches renderers and caches the inactive one. Rebaking terrain preserves the selected renderer. Aurora remains raymarched independently.



MC33 now uses the fast `PlanetCloudNoise` setup baker: a periodic 64³ Cartesian shape texture and spherical weather map. Scaling/rotation happen in 3D, not longitude UV, so the field and its detail do not reset at the sphere seam. The signed field follows the regular planet presets, including thin layers, oversized diorama puffs, hemisphere coverage, scattered clouds and gas bands. Changing the style updates both cached renderers.



The thin realistic MC33 mesh additionally hides texture tiling with an oblique Cartesian domain, broad noise warping and a second rotated, offset sample at an incommensurate scale. Contrast compensation retains dense cloud patches. This costs two extra shape reads per field point, not per output vertex; normal projection still uses the cached field. Other mesh styles and the regular raymarcher retain their existing sampling cost. All domains remain continuous across longitude and cube-face boundaries and move with the cloud material, not the camera.



Swirling gas giant uses a separately compiled, cached `gasWeatherNoise` bake. Two smooth-noise gradient octaves drive tangential sphere-curl backtracing, plus seeded vortices and fine filament bands over broad zonal banks. This is the spherical counterpart of the flat curl-FBM technique, not a per-frame fluid simulation or a longitude-space curl warp. The resulting weather texture is shared by raymarch and MC33; the latter also samples its pigment in the fragment shader so fine curls need not become extra triangles. Neighboring latitude bands drift east/west at slightly different speeds, without north/south texture rotation. Differential shear is bounded to 0.12 radians, preserving the baked curls during long animation sessions rather than stretching them into stripes. Aurora and other styles keep their existing motion. Gas curl computation and integration run only during baking; frame work is texture sampling and a small zonal shear calculation.



Default quality remains 96 angular cells per cube face, 11 radial cells, 900,000 vertex capacity and 200,000 active-cell capacity. Field evaluation, compacted MC33 extraction and smooth cached-field normal projection target 60 Hz; the mesh is drawn at the display frame rate. Only one refresh can be in flight, and queue contention lowers the refresh rate to respect a 35% compute budget. A small scheduling tolerance prevents RAF timing jitter from accidentally halving the mesh rate. Camera visibility changes still refresh paused clouds. All stages reuse their GPU buffers. Extraction reserves vertices with one atomic addition per cell instead of a globally contended compare/exchange retry loop; partial overflow reservations emit complete triangles, and draw/dispatch counts are safely clamped.



Styled clouds now use slow common wind (`spinSpeed: 0.00065` turns/second, roughly one revolution per 26 minutes) plus independent Cartesian billow evolution (`evolutionSpeed: 0.03`). Evolution deforms the existing periodic volume without extra texture reads or rebaking. Setting `spinSpeed: 0` leaves evolving clouds stationary; `evolutionSpeed: 0` keeps their shapes fixed. `animate: false` pauses both. Renderer toggles transfer the local animation clock instead of restarting it. Legacy/custom and aurora motion are unchanged. Explicit `surfaceWeatherSpeed` / `surfaceShapeSpeed` overrides retain radians/second units.



```js

updatePlanetCloudLayerOptions(cloudLayer, {

  surfaceAngularCells: 96,

  surfaceRadialCells: 11,

  surfaceFieldUpdateHz: 60,

  surfaceMeshUpdateHz: 60,

  surfaceComputeBudget: 0.35,

  surfaceAnimateTopology: true,

  surfaceMaxVertices: 900000,

  surfaceMaxActiveCells: 200000,

  params: { globalCoverage: 0.82 },

});

await setPlanetCloudStyle(cloudLayer, 'diorama');

```



In the planet simulation's advanced cloud JSON, optional `surface` settings forward these MC33-specific options. Spatial resolution remains fixed as the camera moves. Optional tile culling uses conservative shell bounds rather than a 2D occupancy heuristic that could remove 3D puffs.



`layer.startupTiming` reports setup, async pipeline preparation, noise buffering/dispatch, allocation and first presentation. `layer.performanceStats` includes CPU encoding/submission times, requested and drawn vertex counts, triangle/active-cell counts, overflow flags, requested/effective refresh rates, observed render/field/mesh rates over one-second windows and `computeCompletionMs`. The latter is asynchronous submit-to-completion latency including shared-queue contention, not a hardware GPU timestamp. Counts use a 24-byte asynchronous GPU readback at most once per second; no GPU wait is inserted into the animation loop. Overflow emits a warning rather than silently hiding missing geometry.



Analytic planet occlusion is kept below the cloud base so a tall mountain cannot erase an entire thin layer. This remains a spherical horizon approximation, not per-pixel terrain-depth occlusion. Near-plane triangles use normal GPU clipping when flying through the shell.



The old 2D extrusion controls (`surfaceBulgeStrength`, `surfaceCavityStrength`, `surfaceLowPush`, etc.) no longer define the new 3D morphology; use the shared planet style, shell, coverage and shape scale settings instead.



### Convective shape variation and spherical filtering



Towering Cu and storm cells now vary their base breadth independently of crown

width, including broad lower banks and narrower columns. Material-cell seeds

also vary billow aspect, lean, orientation, canopy thickness and downwind reach.

Those identities move with the wind; they do not get reselected per frame.

Storm-versus-cumulus identity comes only from a material-cell seed (27% storm

cells), never a hard threshold against an advecting weather-map sample. The old

weather-G comparison could replace a small cloud with a whole thunderhead in

one frame. Coverage and storm development still evolve smoothly. An independent

width seed gives about 30% of convective cells full broad bases, 28% intermediate

bases and the rest narrower forms; radius multipliers span 0.68–1.35. Broad

families are also 15% shorter, without stretching their height during evolution.

Fair cumulus and the original Rain Shelf retain their existing density closure.

The field still uses its 3×3 cell neighborhood and existing shape/detail samples.

A soft footprint bound includes the noisy outer lobes so wide clouds cannot pop

when a cell leaves that neighborhood.



The raymarched planet shell samples shape and detail in continuous, rotated

Cartesian coordinates, rather than fading or resampling them at a longitude

seam. Spherical weather scale blends neighboring integer longitude windings;

fractional scale settings remain seamless. Longitude scales below one retain

one full winding. Aurora ribbon/color frequencies are periodic, and its march

no longer snaps sample radii to discrete shell slices.



`CloudVolumeMips` builds reusable filtered 3D mip chains after planetary noise

bakes, not during camera updates. The shell's visible texture LOD follows actual

texel footprint, retaining close detail and filtering subpixel erosion. This

uses an additional mipmapped copy of each shape/detail volume (roughly 18 MiB

for a 128³ rgba16float volume); obsolete copies are released with their layers.



Validation: `node --test tests/*.test.mjs`, including sphere seam/filtering and

planet surface regressions. Orbit/close captures and GPU timestamp comparisons

from the earlier `/sphere` experiment required diagnostic snapshots that are

not included here; the maintained browser check does not provide that route.

Cloud-pass timings are not full planet-scene FPS or cold startup measurements.



### Cloud variety and regular planet styles



The flat lab adds feather cirrus and a connected, rolling asperitas ceiling.

The automatic weather loop now visits twelve states using the same six cached

weather maps. Kelvin–Helmholtz remains a manual **Experimental** preset; its

curling shapes are still too regular for the automatic cycle. Storm cells vary

their height, width and selection independently and share broken feeder banks.

The original Rain Shelf closure is unchanged.



Regular raymarched planets have a **Planet cloud style** selector:



The planet's **Color / lighting** control also includes all thirteen reference

looks from the flat cloud demo. These change palettes, soft/sculpted lighting

and silvering while retaining shell shape, density, motion and render budget.

Silvering now emphasizes thin backlit silhouettes near the sun in both flat

lighting finishes; empty sky and opaque cloud interiors receive no added

compositor rim. Fluffy scattering reuses cached sun visibility and edge distance.



The shared demo entry now has bottom-right **Flat clouds / Planet clouds** links

(`?demo=flat` or `?demo=planet`). A switch navigates to a fresh document so the

previous GPU scene and worker are released. The planet simulation starts with

the thin realistic raymarch style; choose the other styles at the top of its

Clouds controls. Style switches prepare cloud maps without rebuilding terrain,

update the nested settings editor, and preserve the independent aurora settings.



- Thin realistic layer (`realistic`)

- Big diorama clouds (`diorama`)

- Cloudy hemisphere (`hemisphere`)

- A few puffy clouds (`scattered`)

- Jupiter / curled storms (`gas_giant`): cream/rust banks, an elliptical storm and fine curls

- Neptune / blue storm bands (`neptune`): deep blue, calmer jets, a dark oval and pale ice-cloud streaks

- Hail Mary / green-orange swirls (`hail_mary`): predominantly green with scattered rusty-orange weather regions and fine curling filaments

- Current / custom clouds (`legacy`)



Pass `options.cloudStyle` when creating a layer, or switch an existing layer:



```js

await setPlanetCloudStyle(cloudLayer, 'gas_giant');

```



Use this asynchronous API, not `updatePlanetCloudLayerOptions`, to change a

style: it prepares the new maps, keeps the last completed image visible and

then swaps the bindings. Failed bakes restore the previous style. Camera

movement does not rebake maps. Set `showCloudStyleControl: false` to hide the

selector. Unspecified styles retain the caller's existing/custom settings.

MC33 uses the same presets and baked pigment maps. Aurora remains independent.



In the planet simulation, the Clouds tab starts with live **Lit color** and

**Shadow color** pickers, separate HDR brightness controls, and ray/mesh opacity.

They update existing uniforms without rebaking terrain or cloud textures and

stay synchronized with style changes and the advanced RGB controls. Gas presets

retain their pigment palettes; these colors tint their lighting. The renderer

switch sits at the bottom right, above demo navigation and clear of the sidebar.

Hail Mary's default opacity is 0.78 for raymarch and 0.72 for MC33, giving its

green/orange atmosphere more presence while retaining some terrain visibility.



All seven non-legacy styles share the compact `computeCloudPlanet` entrypoint. Their

small setup-only shape and weather shaders produce smooth, periodic noise;

gas bands include localized spherical vortices. Shape/detail use filtered 3D

mips and continuous Cartesian coordinates. Coverage and gas bands rotate in

a continuous spherical domain. Rounded radial profiles keep the large puffs

from reading as straight-sided slabs. Lighting normals use the unsaturated

shape field, preserving relief inside opaque clouds with the same three shape

reads. Close views refresh those normals more often while sun probes remain

capped at three. The new presets

disable the visibly different bootstrap image and unused legacy noise warmups.



The gas variants share one lazy setup pipeline, selected by a bake uniform.

Jupiter has unequal, locally disturbed belts, pale equatorial zones, ochre

poles and a distinctly red storm core. Neptune takes a shorter bake path:

gentle blue variation, a few thin broken ice-cloud lanes and a small dark spot,

without the giant-eddy integration. Its lighting is predominantly radial so

the quiet atmosphere does not look like lumpy blue terrain; the raymarcher also

skips the unnecessary three shape-normal probes. Hail Mary adds a small-scale

curl octave and eighteen uneven local vortices to the broad flow. A separate

low-frequency noise field selects scattered rusty-orange regions, replacing

the previous half-planet red/green split. Long oblique threads follow the

backtraced flow at two scales; gentler integration keeps them resolved instead

of folding into sub-texel speckles. Its brighter emerald palette has tangerine

patches and golden lime highlights, without latitude stripes.

Lower extinction and translucent raymarch

and mesh presets let the mountain surface show through instead of replacing it

with an opaque neon shell. These extra curl calculations are still setup-only.

Their palette is shared between raymarch and MC33 in `shaders/planetGasAppearance.wgsl`;

switching variants adds no frame-time texture reads or render pipelines. Oval

storms are warped in a continuous Cartesian tangent frame. The expensive curl

integration remains setup-only. `shaders/planetGasFlow.wgsl` adds two bounded,

animated spherical twists to the existing weather lookup for Jupiter and Hail

Mary. Jupiter uses a smaller displacement to retain its belts; Neptune keeps

its quiet latitude shear. Raymarch, MC33 extraction and mesh color use exactly

the same coordinates. The small-angle rotations add arithmetic without extra

texture reads or per-frame map generation, and remain continuous at the poles

and longitude seam. Wind speed controls both advection and this deformation.



The same bounded flow also animates **Thin realistic layer**, **Big diorama

clouds**, **Cloudy hemisphere**, and **A few puffy clouds**. These use gentler

eddies (38% of Hail Mary's strength) without gas-planet latitude jets. Coverage,

3D billows and detail erosion share the deformation, preserving cloud radius

and keeping the raymarch and MC33 paths aligned. Custom/legacy clouds retain

their original motion. No extra texture reads, bakes, voxels or simulation

buffers are introduced; paused animation and zero wind remain stationary.



Planet temporal history is allocated at the actual coarse raymarch dimensions,

not the reconstructed overlay size. Changing that size seeds one full fresh

frame before interleaving resumes; this avoids a smaller corner-copy ghost when

the camera stops. `performanceStats.historyWidth`, `historyHeight` and

`historyWarmupActive` expose those decisions without GPU readback.

An absent motion-vector input is zero; the old half-UNORM fallback shifted

stationary history horizontally by half a pixel every frame.



The earlier `/planet-styles` experiment used a simple diagnostic globe for

orbit/inside captures, GPU timestamps and seam probes; its server/snapshots are

not included here. Use **Planet clouds** in the shared demo to review the actual

planet simulation. The layer's startup timing object and performance stats

remain available for measuring setup and cloud-pass work separately from

whole-scene FPS.



The planet panel keeps cloud shape and lighting presets at the top. Both

selectors preview automatically, with serialized bakes when changing shapes

quickly. Number/text edits are staged separately and require **Apply edits**;

previewing a preset does not apply unrelated staged settings. Texture-related

manual edits request a fresh cloud bake on Apply. Diagnostics and advanced

controls are collapsed by default.



For repeatable GPU comparisons, run `node tests/browser/serveWeatherAnvil.mjs`

and open `/planet-flow-benchmark`. It measures the actual warm production bake

pipeline and the shared production flow function at 512² and 1024². Seven

measurements follow two warmups; multiple dispatches per measurement overcome

the browser's timestamp quantization. Texture allocation, compilation and CPU

waits are excluded from GPU timings. Separate setup-plus-bake wall times are

reported, along with a heavier workload making 16 weather lookups per pixel.

These sampling measurements are microbenchmarks, not total frame times.



On the tested NVIDIA Lovelace GPU, the recorded 1024² medians were:



| Weather map | Full weather generation | Existing map sampling | Flow warp + sampling | 16 lookups: added warp cost |

| --- | ---: | ---: | ---: | ---: |

| Jupiter | 2.384 ms | 0.018 ms | 0.029 ms | 0.254 ms |

| Hail Mary | 4.669 ms | 0.020 ms | 0.034 ms | 0.246 ms |



The separate 128³ shape bake measured about 2.2 ms. The benchmark also checks

the actual WGSL flow at zero time, across longitude/poles, and at long-running

wind phases. See `tests/browser/planet-flow-benchmark-results.json` for the

raw measurements and error bounds; results depend on GPU and workload.



`tests/browser/planet-ordinary-flow-benchmark-results.json` extends those

measurements to ordinary clouds and validates all seven styled forms on the

GPU. On the same GPU, the 1024² realistic map measured 0.303 ms to generate,

0.018 ms to sample, and 0.029 ms to warp and sample (about 0.010 ms added).

Sixteen lookups added 0.156 ms. These are weather-lookup microbenchmarks;

ordinary cloud shape/detail deformation adds arithmetic in their existing

lookups too, so the numbers do not represent whole-frame overhead.



The flat demo's **Color grade → Watercolor / Gouache lighting** group contains

Lavender Gouache, Lavender Glaze, Violet Underpainting, Lavender Sunwash,

Indigo Gouache, Rose Gold Wash and Copper Ochre Gouache. These use

softly terraced pigment washes driven by existing cloud radiance and optical

depth, plus a cream/gold backlit shoulder. HDR compression keeps the bright

Rain Shelf lighting from washing out the painted shadows. Reconstruction

reuses the compositor's four neighbor samples, with a softer footprint for

these looks; there are no new textures, passes or raymarch samples. The same

palettes also finish fluffy volumes. Selecting a grade preserves cloud shape,

camera, animation state and quality settings; Rain Shelf with Sculpted lighting

is the intended starting point for the layered reference look. Both preset

selectors retain the appearance-family headings and apply immediately.



**Ink Wash lighting** adds Silver Ink Wash and Lilac Ink Wash, with darker

indigo bodies, more distinct pigment layers and selective pale fold highlights.

The highlights reuse the same four neighboring radiance samples and fade out

when their contours are too fine to resolve. **Flowing Shelf** is a separate

layer preset with stretched folds and a gentler alpha cutoff for translucent

streamers. Try it with Ink Wash for the wavy reference, or keep Rain Shelf with

Lavender Gouache for the fuller watercolor look. Shape and grade remain

independently selectable; neither family changes raymarch resolution or starts

animation automatically.



**Indigo Ink Currents** and **Pearl Ink Wisps** add softer blue-gray pigment

planes and directional cream highlights on sun-facing contours. They keep the

earlier watercolor and ink looks intact. **Wind-folded Shelf** uses a small

world-space material warp to curve the folds without additional texture reads.

The Tuning panel's **Curved folds** control is zero for the original layers;

it affects procedural layer shapes only, not fluffy voxels or planets.



The **Layer preset** selector also offers **Rising Ink Shelf**, **Billowing Ink

Bank**, and **Wind-torn Curtains**: progressively taller sculpted formations

with upright folds, fuller banks, or connected turbulent curtains. These presets change

height and material structure independently of the selected color grade. They

frame the taller layers from below and restore the original shelf camera

when switching back. They preserve playback and raymarch resolution settings.

**Dense Wind-folded Shelf** fills the gaps in the original low shelf while

retaining its swept silhouette. **Dense Wind-folded Bank** offers a taller

version and keeps the turbulent shelf domain but broadens its

connected masses with shape support, less erosion, and higher density. Flowing

shelves use a slower continuous height distortion to avoid repeated horizontal

ribs in taller layers. The taller folds also bend their weather coverage mask

through height, so coverage holes do not extrude into straight columns. These

warps reuse the existing textures and sampling budget; the original thin

Wind-folded Shelf keeps its coverage mapping.



### Satellite planet clouds and flow controls



**Satellite / weather fronts**, **Satellite / spiral storms**, and

**Satellite / trade-wind clouds** add thin white cloud shields, stretched

fronts, local comma-shaped storms and smaller broken maritime clouds. A lazy

GPU weather bake backtraces seamless spherical curl fields and seeded local

vortices once. Both raymarch and MC33 then reuse the same coverage field;

neither renderer simulates fluid flow each frame. These are procedural visual

approximations, rather than a meteorological simulation or satellite data.



In the planet demo, open **Cloud shape, motion & quality** for **Animate clouds**,

**Warp amount** (0 off, 1 default, 2 strong) and **Warp speed** (0 still, 1 default,

up to 50). Numeric edits wait for **Apply edits**. Speed is independent of the

global cloud drift; pausing animation stops both. Preset selections preserve

the chosen warp controls and playback state. Neptune keeps its gentler zonal

shear, while ordinary clouds, Jupiter and Hail Mary also use spherical eddies.

Amount controls this animated deformation, not the curls already baked into

the selected weather pattern. Legacy/custom clouds retain their original motion.



Jupiter, Neptune, Hail Mary and the satellite presets use **2048 × 1024**

weather maps in the demo (previous gas maps were 1024 × 1024). The 3D texture

sizes and marching budgets remain unchanged. Explicit resolution edits in the

menu still wait for Apply. The weather texture itself grows from 8 to 16 MiB.



The local GPU diagnostic at `/planet-flow-benchmark` compares the original

1024² map with 2048 × 1024. On the current test GPU, warm generation of the

larger satellite maps took 4.4–4.6 ms, Jupiter 6.3 ms, Neptune 1.5 ms and Hail

Mary 10.8 ms. These are setup-only GPU dispatch timings, excluding allocation

and compilation, and will vary by device and load. Sampling timings remain

microbenchmarks, not full-frame performance. Results are saved in

`tests/browser/planet-satellite-flow-benchmark-results.json`.

`/planet-controls-smoke` additionally extracts and renders actual MC33 clouds

for all six presets at zero, 12× and 50× warp speed, checking GPU validation

and nonempty geometry. Its results are saved beside the benchmark report.





### Per-frame planet weather regeneration



In **Cloud shape, motion & quality**, **Cloud motion preset** offers **Off (warp + texture regeneration)**, **Warp texture**, and **Warp + texture regeneration**. The combined mode dispatches weather generation every animated frame. **Texture scroll speed** pans the continuous Cartesian noise domain (0 freezes it, 1 is gentle, up to 50). The texture, view, bindings and seed are reused; shape/detail volumes stay cached. This works with ordinary styled clouds, satellite patterns, Jupiter, Neptune and Hail Mary in raymarch and MC33 modes. **Animate clouds** pauses motion. The selector previews automatically; numeric speed edits require **Apply edits**. Warp-only remains the default; global drift is independent of this preset.



`tests/browser/planetRegeneration.js` verifies evolving pixels, exact restoration at phase zero, unchanged shape data and in-place reuse, and measures warm 2048 x 1024 weather dispatches using GPU timestamps. `tests/browser/planet-regeneration-results.json` records the local result. Dispatch timings exclude rendering and do not imply total scene FPS.





### Connected shelf opacity and layered painting



Flat procedural clouds now integrate camera extinction over the sampled distance without the old per-step lighting clamp. Dense banks therefore occlude the far side even in close horizontal views or with a smaller march budget. Faint wisps keep their physical transmission; changing Soft/Sculpted finishing does not change opacity. Planet and aurora paths keep their existing treatment.



Flowing shelves also retain a continuous broad 3D core underneath fine erosion. The shared macro/fine support follows shape, weather and height, without camera-dependent density or extra texture reads. **Painted Folded Bank** adds a thicker swept silhouette with less vertical breakup and slower edge erosion. Pair it with the new **Indigo Layered Ink**, **Cyan Layered Ink**, or **Lavender Layered Wash** color grades. Existing palettes remain available. These grades terrace ray-lit relief into pigment planes and reuse the current four reconstruction taps for fine highlights; selecting a grade does not change cloud geometry, playback or rendering resolution.



`/flat-opacity` runs the production camera raymarch with GPU readback from outside and inside a dense bank at 16, 32 and 96 march steps, checking both lighting finishes, translucent material, clear sky and paused repeatability. The local result is saved in `tests/browser/flat-opacity-results.json`.



### Side-on ray intervals and Indigo Layered Ink



Flat layer clouds still march along each camera ray. Occupied coarse intervals now retry from their start with local world-space surface steps, and accumulation uses the interval actually sampled instead of enlarging it afterwards. Empty regions retain coarse coverage; the latter half of the iteration budget gradually reserves enough distance to reach the far boundary even for thin clouds. The default 224-step limit and spherical/aurora marching remain unchanged. New flat surfaces also initialize their lighting cache immediately.



Indigo Layered Ink alone now uses a diluted indigo underpainting with five softened pigment planes, cooler muted highlights, and the existing directional wispy crests. Other painting palettes and layer presets are preserved.



The `/flat-opacity` GPU check includes thin folded 3D surfaces at three shallow angles, comparison against 1024 steps, and far-side coverage of a tenuous wide cloud. `CLOUD_MARCH_BASELINE=1` restores the coarse surface behavior in this diagnostic bundle only as a negative control. The corrected marcher has mean absolute errors around 0.0091-0.0094 versus 0.0508-0.0533 for that control; the pass threshold is 0.035. These are numerical convergence checks, not FPS measurements.



### Indigo ink reference preset



`Indigo Sumi Crests` (grade 43) adds a dark indigo underpainting with four unequal pigment washes and pale cream crests. The crest follows the light direction and the projected world-up shoulder, with neighboring cloud occupancy suppressing glare on isolated fine strands. It reuses the existing four reconstruction taps with a slightly broader footprint; it adds no texture, pass, raymarch samples, or screen-space grain. The generic decorative light-contour stripes are omitted for this grade. Both finishing paths compress HDR radiance before applying its washes.



`Ink Wave Shelf` is an independent layer preset for broader swept folds and less fine erosion. It selects sculpted lighting but does not select a color grade, change resolution/step budgets, or start animation. Pair it with Indigo Sumi Crests; the grade also works with the previous cloud layer presets. All previous palettes, including the approved Indigo Layered Ink and pink/lavender washes, are retained.



### Fine Sumi variant



The approved grade 43 and Ink Wave Shelf are preserved. `Indigo Sumi Filaments` (grade 44) retains their palette and broad pigment washes with a finer reconstruction footprint, less smoothing on thin edges, and derivative thresholds matched to that smaller footprint. It keeps the same four existing neighboring texture reads. `Ink Wave Filaments` is a separate anatomy variant: the broad shape/weather fields and density settings are inherited, while a finer elongated detail domain erodes smaller edge features and a lower alpha cutoff retains faint wisps. No additional passes, textures, or raymarch steps are introduced; no preset changes the render divider or animation state. For stills, manually selecting divider 1 and temporal Off reveals details the reduced preview cannot resolve.



A deterministic comparison of the approved grade 43/broad shelf render against the preceding build produced zero pixel difference in the cloud view.



### Internal ink-wash layering



Grade 44 (Indigo Sumi Filaments) now opts into `paintedLayers` lighting. It uses the existing shape channels and cloud-height phase to bend broad overlapping wash bands through the material, with a restrained finer ripple. The modulation happens before ray-light accumulation; density, transmission, alpha, and marching remain unchanged. Softer pigment-plane transitions retain the within-fold relief. Grade 43 and all earlier palettes leave this lighting flag off.



The new scalar occupies the previously unused tuning lane at byte 260, keeping the 272-byte uniform layout. It is excluded from cached density/light-field identity because the direct layer material applies it after density/shadow evaluation; cached rounded forms and spherical clouds retain their previous paths. No textures, passes, ray samples, or screenshot resolution changes are required by the preset. The GPU regression checks identical alpha with shading on/off, nonzero lighting changes, exact restoration after toggling, and exact restoration after moving/returning the camera. The approved Sumi Crests cloud view again matched its earlier capture with zero pixel difference.



### Brighter Sumi washes and navigation pacing



Grade 44 now uses Storm Cool's front, ambient and transmissive lighting, a brighter blue-gray pigment range, and warmer yellow crests. Narrower material wash transitions and less RGB-only interior reconstruction smoothing make overlapping washes more distinct; silhouette filtering, density and transmission are unchanged. Grade 43 and previous looks are preserved.



Paused orbit and flight submissions now share GPU backpressure, with at most two navigation frames queued. Pending input batches yield to another display tick and retain the latest camera pose. Animated frame timing messages are sampled at four updates per second. The FPS display uses worker render cadence rather than measuring the UI window's refresh rate; paused flight also reports cadence without advancing cloud animation. Camera changes still invalidate history to avoid stale trails, so moving views can cost more than stationary sparse-history frames.



Validation: 123 Node tests pass, including slow-render/latest-pose coalescing and blocked-GPU backpressure. The actual GPU opacity/march check passes with zero painted alpha difference, exact restoration after toggling/moving the camera, and no validation errors. Live flight with animation enabled showed 58.8 FPS at divider 4 in one sample; paused flight showed 41.6 FPS in a separate view. These are smoke-check samples, not a controlled before/after performance benchmark. The full-detail comparison still is saved as sumi-storm-cool-firm-washes.jpg; the live demo is returned to divider 4, temporal 4 and paused playback.



### Cloud-level ink comparison



Ink Wave Filaments reduces stochastic phase jitter from 1 to 0.25, step jitter from 0.3 to 0.08, and slice jitter from 0.035 to 0.012. Density/light ray smoothing is reduced to 0.06/0.10. Material warp, cloud density, broad shelf anatomy and step/resolution budgets remain unchanged. Grade 44 uses narrower unequal pigment transitions with a small within-wash gradient, and opaque-interior RGB filtering is reduced to 0.08; alpha reconstruction and the approved grade 43 are preserved.



Use close-ups near the cloud layer for reference comparisons rather than the low wide overview. The captured view uses camera (-0.75, -0.18, -0.95), yaw 45, pitch 8 and FOV 28. The cloud box spans Y=-0.3..0.5, so the camera is within the layer's lower height range. The paused full-detail still is sumi-cloud-level-low-jitter.jpg. The live preview retains that camera, with divider 4 and temporal 4 restored. All 123 Node checks pass; the live shader compiled and rendered without validation errors.



### Inside-cloud rotation artifacts



Flat-layer lighting now uses a fixed 0.02-world-unit material probe for powder/silver response, the shadow-density gate, and the shadow lift. View opacity still integrates the actual unclamped march interval. Front transmission is evaluated at the absorption-weighted mean across that interval. Previously, longer camera coverage steps could more than double the same opaque material's radiance. The spherical path retains its original lighting alpha and transmission inputs.



Flat shape/detail mip selection accounts for texture dimensions, axis transforms, the projected pixel cone and the integration interval. It applies to small shelves as well as wide skies, overriding close-view mip caps only when detail cannot be resolved. Material coordinates remain in world space. The legacy vertical-domain scale is excluded because verticalScaledDomainPos no longer compresses Y. No rays, texture reads, passes or textures are added; the normal 224-step budget and divider 4 are retained. Faint detail can soften when it is smaller than the preview can resolve.



The GPU regression includes a uniform opaque material at integration steps 0.005/0.02/0.08, plus four inside-volume yaw/pitch views of a fine 3D folded field against 4096-step references. The old build failed with a maximum lighting-step difference of 0.9106; the corrected build measures 0.0176 (threshold 0.025), with alpha 1 throughout. After texture filtering, the worst rotation RGB mean error is 0.00083 and alpha mean error remains below 0.00015. Dense opacity, shallow folds, empty sky, thin wide coverage and painted-alpha/restoration checks pass without GPU validation errors. Results are in tests/browser/flat-opacity-results.json; the failing lighting control is flat-turn-baseline-results.json. All 123 Node tests pass.



Actual demo review used inside-cloud height 0.1 with yaw 110/pitch 20/FOV 60, then returned to the close reference view (-0.75,-0.18,-0.95), yaw 45/pitch 8/FOV 28. The resulting captures are cloud-turn-filtered-inside.jpg and cloud-level-artifact-fix.jpg. The live preview is left paused at divider 4 and temporal 4.



### Sculpted relief at cloud height



Side-on comparison now uses matching cloud-height cameras with a fixed Storm Cool palette, rather than comparing the distant overview. The sculpted renderer previously differentiated only the coverage-clipped R channel to obtain its lighting normal. Flat regions in that signal switched to a fixed fallback direction and produced artificial slab boundaries. Shape normals now differentiate an unclamped combination of the existing R/G/B/A material channels (0.55/0.28/0.12/0.05). Density, opacity, palettes, six-tap normal probes, lighting reuse, the 224-step budget and divider 4 are unchanged. Cumulus field lighting and spherical normals retain their existing paths.



The GPU regression samples the production normal functions across a clipped shape plateau. Continuous material relief must point in the same direction on both sides of the clipping boundary. The old R-only negative control fails this check; the new shader passes, along with opacity, shallow march, rotation, empty sky and painted-alpha checks. The normal test deliberately supplies the clipping boundary rather than relying on random noise to encounter it. `CLOUD_RELIEF_BASELINE=1` selects that failing control for the diagnostic bundle only. All 123 Node tests pass. This fixes the large relief discontinuities; it does not establish that every low-budget grazing-angle integration artifact is eliminated.



### Full-resolution painterly reference review



Review the gray ink and lavender watercolor references paused at render divider 1 with temporal interleave Off. Use a camera beside the cloud at layer height, rather than inside an opaque core or in the distant overview. The current exterior review uses camera (-2.65, 0.1, -0.27), yaw 110, pitch 8, FOV 60, sun azimuth 110/elevation 21. Presets retain divider 4 and never start playback automatically.



Flat-layer spacing now grows with camera distance rather than the ray's exit-face distance. Visible density refines the interval by optical depth; empty-space skips clear refinement, and dense surfaces no longer receive a late coverage-budget step expansion. The configured maximum step and 224-step default are retained. Flat shelves keep their material-derived normals instead of switching to a separate channel-normal approximation at a density threshold. Spherical and cached natural-cloud marching keep their existing paths. Jittered weather-column bounds include their top/base support so they cannot be clipped at the nominal volume face.



Indigo Sumi Filaments (44) retains continuous fine pigment variation between ten washes and no longer subtracts opaque coverage from the interior's low lighting values. Fine silver threads require neighboring cloud support and have a restrained gain. This uses existing ray lighting and reconstruction taps; the earlier ink and lavender palettes remain available and unchanged. These are review iterations, not a claim of an exact reference match.



The GPU suite retains full dense opacity at 16/32/96 steps, passes shallow and rotated views against finer references, preserves painted alpha/restoration, and reports no validation errors. The new horizontal-ray regression renders weather support above the nominal box top with alpha 1; the nominal-boundary negative control returns alpha 0. All 123 Node tests pass. See tests/browser/flat-opacity-results.json and CLOUD_FLAT_BOUNDS_BASELINE=1 in the diagnostic server for reproduction.



Flat opacity also excludes the old camera-progress-dependent front-card fill. A bounds-padding regression measures alpha drift of 0.00067, versus 0.00537 with that fill restored (`CLOUD_FLAT_CARD_BASELINE=1`; `tests/browser/flat-card-baseline-results.json`). Flat shadow quadrature uses a fixed sample count, the shadow-density gate blends smoothly, and near-zero relief gradients use a regularized direction. These reduce discontinuities without changing the spherical path. Flat dense lighting uses the existing six-tap material normal rather than the cheaper channel approximation, so its cost should not be described as unchanged.



Known review limits: Wind-torn Curtains still shows a horizontal seam from some cloud-height views, including at full resolution with fine integration. The ink review still has more bright grain around distant wisps than the reference; the lavender interior is flatter than the watercolor reference. Passing the GPU regressions does not establish that these visual issues are resolved. Both saved style captures use divider 1, no temporal interleave, paused playback, and the same exterior cloud-height camera.



### Continuous pigment and stable procedural sampling



Indigo Sumi Filaments (44) and Lavender Layered Wash (41) now use continuous multi-color pigment ramps instead of terraced plateaus. Their opaque interiors retain ray-lit value and subtle source color variation; coverage no longer subtracts from the lavender relief. Earlier grades remain available. Painted Folded Bank and Ink Wave Shelf/Filaments include Alpha Boost Add 0.35 above alpha 0.20. This strengthens pigment coverage after lighting while leaving faint wisps alone. The resolve control is labeled Faint Cloud Cutoff to distinguish removal of faint pixels from boosting opacity.



Flat procedural rays use pixel-centered directions and a fixed integration phase, with smooth world-coordinate slice/lighting dither and a midpoint sun-shadow phase. Noise no longer depends on screen pixels or the march iteration for flat clouds. Fine ink jitter is reduced. This retains procedural density and erosion, the existing step budget and texture sizes; it does not add a voxel density cache or guarantee identical quadrature across camera poses. The existing spherical path and cached fluffy clouds remain unchanged. World dither adds integer arithmetic but no texture reads.



The GPU suite checks the actual palette functions across 256 lighting values: neither reference ramp has a flat interval. It verifies alpha boosting raises a partially covered pixel from 0.3694 to 0.4436 while leaving a faint wisp unchanged. All existing opacity/rotation tests pass without validation errors. Uniform-material lighting-step variation is 0.00049 after the sampling change, versus 0.00391 in the preceding build. This is an integration consistency check, not a measured flight-stability or frame-rate result. Full-resolution review captures are indigo-continuous-pigment.jpg and lavender-continuous-pigment.jpg in the chat visualization directory. The unresolved tall-preset horizon seam remains a separate issue.



### Richer color families, smaller aircraft and planet variations



The shared painterly finish now covers grades 30–44. It combines authored pigment, bounded ray-lit material chroma and a diluted sun tint in brighter washes. A continuous pigment contribution retains gradients within the broader terraced styles. Saturation applies after the painted replacement so the control actually affects final pigment. Fine interior lighting contrast reuses the four existing reconstruction taps, with an opacity gate to protect silhouettes. Original Lavender Gouache (29) retains its existing finish. Source/transmitted light and pigment colors were also tuned for Violet Underpainting, Lavender Sunwash, Indigo Ink Currents, Indigo Layered Ink, Lavender Layered Wash and the Sumi family. The two main reference ramps expand their midrange without clipping broad intervals to flat endpoint colors.



The aircraft model scale is 0.08 instead of 0.30: about 73% smaller in world space. The chase camera is now 0.38 units behind and 0.055 above, with the same field of view, bringing the viewpoint close to the smaller aircraft. Navigation and builder fallbacks share the chase constants. Both render paths still intersect the same world-space hull and integrate cloud transmission up to it.



Randomize planet is beside the planet preset selectors. It regenerates terrain, planet colors, atmosphere wavelengths and cloud variation while preserving cloud morphology, lighting and motion. Unrelated manual edits remain staged, and later selector changes cannot be overwritten by completion of an older randomization. The live check retained Cyclonic + Storm Cool and an unapplied warp-speed value of 7 while changing the terrain and planet palette. Unit coverage exercises all 11 shape options, full-scene variation and draft preservation.



Final review captures use render divider 1, temporal interleave Off and the same close cloud-height camera: richer-ink-review.jpg, richer-lavender-review.jpg and richer-sunwash-review.jpg. smaller-plane-cloud-scale.jpg shows the parked aircraft against the bank; planet-randomize-shape-preserved.jpg shows the new planet control. These remain visual iterations toward the supplied reference, especially its fine interior detail. The existing tall-preset horizon seam is still unresolved.



### Catalog-wide color refinement



All 44 artistic color presets now use more distinct reflected, transmitted, shadow and highlight hues. The RGB Spectrum diagnostic remains unchanged. Legacy palettes 0–14 are matched between the flat and planet demos; reference palettes 16–44 remain shared. Daylight and porcelain retain restrained warm/cool whites, copper families introduce plum/burgundy shadows, and ink/lavender families separate blue-violet underpainting from warmer pigment shoulders. The original Gouache finish is retained.



The painterly glaze preserves its incoming luminance while adding bounded material and rim chroma, so extra color does not wash out the value relief. The two reference-focused continuous ramps have stronger midrange contrast without endpoint clamps or new texture samples. All 45 selector entries were captured on Ink Wave Filaments, paused at divider 1 and temporal interleave Off, camera (-2.35, 0.05, -0.27), yaw 110, pitch 5, FOV 60, sun 110/21. This comparison deliberately holds morphology and sculpted shading fixed; it does not validate every shape/finish pairing.



The actual GPU pigment-finish checks report zero flat intervals and maximum luminance drift of 0.00000012 at saturation 1. Opacity and camera-rotation regressions pass with no validation errors; all 125 Node checks pass, including every classic and reference look in the appearance-switching check. The local cloud-color-review.html artifact contains all 45 full-resolution captures. Color refinement does not resolve the previously documented horizon seam or establish a frame-rate improvement.



### Cloud types, coarse reconstruction and Blue Sky Dawn



The UI separates cloud type from shading finish. Layered clouds evaluate procedural shelves and flowing sheets along their rays. 3D volume clouds cache their density and lighting; Volume detail and turbulence apply to this type. Soft lighting and Painted lighting change the finish without selecting a different geometry path. Ray resolution ÷4 means quarter width and height (one ray per 4×4 output pixels) for both types.



Coarse procedural presentation uses bounded Catmull–Rom reconstruction before the painted finish. Its edge probes cover source texels; coarse HDR filtering compares relative lighting contrast, and the fine ink finish attenuates its local detail boost at reduced resolution. Full-resolution sampling and cached-volume reconstruction retain their previous behavior. This adds nine bilinear center reads instead of one on the affected path, with no extra rays or history allocation. It improves reconstruction but cannot recover features omitted by the coarse ray grid.



The GPU test uses the production reconstruction on a quantized analytic field: alpha RMSE falls from 0.00234 to 0.00100, with bounded results and identical cached/full-resolution bypass samples. Its small-kernel submit-to-completion timings are diagnostic, not a demo FPS benchmark. Existing opacity, pigment and rotation checks pass without validation errors; all 125 Node checks pass.



Blue Sky Dawn (45) is a photo-inspired natural lighting palette: blue sky, warm ivory light, slate-blue shadows and a narrow peach-gold horizon tied to world elevation. Morning Cloudlets is its independent companion shape. Review with low sun elevation around 8 degrees, paused, divider 1 and temporal interleave Off. Shape/color selection preserves the user's animation and quality choices.



Morning Cloudlets now uses dedicated cached form 8: a broad, dense lower front and a much finer broken upper deck. Irregular material-space noise creates the ruffles without repeating sinusoidal rows or camera-facing planes. This form filters the thin deck using its horizontal voxel spacing so its fine structure is not blurred by the finer vertical grid. Existing cached cloud forms retain their filtering. The full-resolution review uses Screenshot / 256 volume detail; this is a review setting, not a new preset quality default. The two cloud scales are more distinct, but the result remains softer and the lower bank simpler than the photo. All 127 Node checks and the GPU opacity, rotation, palette and reconstruction checks pass with no validation errors.



Animate clouds also evolves this morning shape: independently advected detail bends and reforms the ruffles while a slower weather domain changes the broad bank. Shape, Detail and Weather transform velocities control the existing motion domains; no frame counter or camera position enters the anatomy. Pause freezes those offsets. The cached GPU density and lighting are updated in place through the existing animation loop, without regenerating the source noise textures. A fixed-camera GPU regression changes only the independent evolution offsets, checks that cloud opacity changes, and verifies exact repeatability when paused and after restoring offsets.



### Tiled morning skies and cached painted folds



Morning Cloudlets now uses periodic material noise and a periodic front mask in wide skies. Quantized cell periods match value and slope across X/Z joins while independently moving domains still evolve the pattern. The existing bounded volume tile is repeated once Sky span exceeds 72 world units; expanding the box does not spread a fixed field over the entire new width. The underlying bake remains periodic; ray-time world-space noise deformation now varies neighboring repetitions rather than duplicating an identical sky region. It is still a bounded repeated field, not a separate simulation for every horizon region. New variation reseeds weather, shape and detail while preserving the chosen preset, palette, span and camera.



Cached Ink Folds (form 9) adds thick connected folds through the fluffy-cloud density/lighting cache. Its periodic 3D textures, continuous density and unsaturated normal field replace the procedural ray-layer slices. It uses up to 24 cached shadow samples rather than 48; existing natural forms retain their prior budget. Soft lighting with a painterly grade retains the existing 3D-light-driven pigment finish. This is a softer alternative to the procedural ink shapes, not an exact replacement for their intricate internal terraces. The older procedural presets remain available and retain their documented horizon/banding limitations.



Both preset selectors group the catalog by actual calculation method: cached natural shapes, cached painted folds, cached geometry demos, and procedural ray layers. A catalog test ensures every preset appears once in the correct method group. All 129 Node checks pass. The actual GPU suite checks animation repeatability, nonuniform rays one 38-unit tile apart, and continuity across the base tile join. With turbulence enabled, neighboring repetitions differ (maximum alpha differences 0.079 morning / 0.099 folded); join changes for a 0.0002-unit camera move remain below 0.0005. Returning the camera restores identical pixels. Turning turbulence off restores the regular repeated domain. No GPU validation errors were recorded.



The method diagnostic measures completed cloud compute work at 512×288, using Low / fast (96×48×96) cached fields, 12 warmed samples and side-on panning. Procedural medians were 64.0 ms stationary and 64.7 ms with evolving offsets; cached-fold medians were 4.0 and 4.3 ms. These are different anatomies with shared test inputs and are not a matched visual-quality or full-demo FPS benchmark. Review captures use divider 1, temporal Off and Balanced volume detail. The live New variation check changed all three primary noise seeds while retaining Cached Ink Folds, Indigo Sumi Crests and span 360.





Cached-volume sampling now reuses the existing periodic shape/detail noise tiles for broad horizontal deformation in wide skies and finer cell-scale bends. The existing Cloud turbulence control adjusts both deformation and erosion; Off retains the regular field coordinates. Geometry masks retain their original shape. Density and lighting always use the same deformed coordinates, with vertical displacement fading before the volume boundary. Empty-space skip bounds include deformation and reconstruction support. No additional density/light volumes or per-frame noise bakes are allocated.



Cached Ink Folds uses positive cubic B-spline reconstruction near the camera for both density and light (eight trilinear reads per field), transitioning to the regular mip chain at larger footprints. This blends cell boundaries without negative density or overshoot halos; it does not recover detail missing from a coarse bake. Other cached natural forms retain their existing reconstruction. All procedural ray-layer presets remain available under their own calculation-method group.



The updated 512×288 Low-field diagnostic measured wide cached-fold compute at 4.1 ms median with turbulence Off and 3.6 ms with Natural turbulence, with p90 6.2 / 4.0 ms. This is a short scene-specific completed-work measurement, not evidence that distortion makes rendering faster or a full-demo FPS guarantee.


### Alpine basin and twelve sky scenes

Surroundings offers Open sky or Mountain basin / caldera. The terrain is a reusable indexed triangle mesh (294,920 triangles, including the extended floor), generated once on the CPU and rasterized with a normal depth attachment. A full-output color/distance target supplies one depth lookup to each cloud ray and the final background. Clouds in front of a ridge remain visible; clouds behind it are clipped in both the cached-volume and procedural-layer paths. There is no terrain raymarch. Enabling the basin raises the cloud bank and camera by six world units into the alpine zone; disabling it reverses that offset. The mesh is finite and intentionally simple.

Eight cached sky scenes add Caldera Crown, Sunlit Cloud Streets, Rolling Storm Sea, Breaking Wave Front, High Feather Veil, Cathedral Towers, Islands in Mist and Folded Monsoon. Four procedural scenes add Ribbon Confluence, Torn Silver Canopy, Layered Thunder Wall and Rose Painted Shelves. These have coordinated palettes, wide sky spans and distinct shape settings; all earlier presets remain available in their method groups. Procedural selections start at ray divider 4 and one-quarter temporal rays. Full-resolution reference comparisons remain a manual divider-1/temporal-Off override.

The wide cached-volume march now budgets logarithmically growing distance intervals so dense or conservative skip bounds cannot exhaust the step budget before the far volume face. Midpoint sampling, a 0.15 phase-jitter cap and a matching detail-filter footprint reduce moving-camera perturbation. Cached Ink Folds now has a thicker connected body and a rolling secondary shoulder. The flight chase camera shares its closer 0.38/0.055 offset with the aircraft placement fallback.

All 133 Node checks pass. The actual GPU suite reports no validation errors. Three inside-volume horizon directions agree with the 1,024-step opacity reference (zero alpha error); terrain tests hide clouds below the basin floor and preserve clouds in front, for both marching methods. Moving-camera phase comparisons stay below 0.0026 average alpha error and 0.0068 average RGB error. These are regression checks, not a guarantee that all visible flight flicker is eliminated. Full-resolution alpine review captures are alpine-caldera-final.jpg and alpine-flight-close-start.jpg in the chat artifact directory.

### Base-anchored cloud size

Cloud size is an independent 1x-8x slider in the flat demo, beside Surroundings. It enlarges clouds horizontally and upward from their lowest supported altitude. Terrain and the camera stay fixed. Procedural clouds anchor below their base-jitter support; cached volumes anchor at the volume base. The value persists across preset and surroundings changes. Return to 1x for the original scale.

The camera ray is transformed once into the unchanged cloud material coordinates. Opaque terrain and aircraft distances are converted to the same units for correct occlusion. The cached density/light fields are reused without rebuilding, and the textures, ray budget, render resolution and temporal rate are unchanged. Changing size invalidates the old temporal history. Atmosphere and planet rendering retain their own scale. The fixed budget avoids extra samples or allocations; actual frame time can vary with screen coverage and early exits.

Validation: all 134 Node checks pass. GPU comparisons at 2x, 5x and 8x reproduce the original material view exactly for procedural shelves, cached thunderheads and cached ink folds when the camera undergoes the matching transform. All nine cases retain their field dimensions/cache signatures and zero cloud opacity below the fixed base. Terrain occlusion passes at 1x and 2x on both methods, with no GPU validation errors.

### Moving-camera sampling and horizon pass

Flat cached volumes now integrate near intervals between fixed material-cell crossings. Far intervals use coarser cells of the same nested grid, rather than moving a sample ladder with the camera. The near crossing budget is reserved before planning the remaining distance, and the existing maximum ray budget remains in force. The old extra warped level-zero density probe was removed from each horizon iteration; the visible density read now also drives conservative empty-space queries. Visible cached mips retain a bounded filter width to avoid thinning horizontally viewed cloud banks.

Procedural shelves use material-cell intervals too, with a fixed near noise scale, midpoint sampling and world-cell lighting refresh instead of a camera-relative iteration cadence. Flat entry/step/slice jitter no longer changes the sampling lattice. Near intervals avoid causal along-ray density/shadow smoothing and speculative empty-space jumps. Planet sampling retains its existing behavior. Wide flat clouds taper at the outer horizontal bounds to avoid a hard rectangular cloud edge; smaller boxes retain their original boundary behavior. These changes preserve both rendering methods and all presets.

The basin mesh now has four times its former interior triangle count, keeping the same height profile and shading. Four flat skirt quads extend the ground to 16,384 units, replacing the old 192-unit floor edge that could draw a false horizon through the fog. Terrain remains rasterized; its cloud depth clipping still uses a single texture lookup.

The GPU regression moves a camera through empty air toward controlled transparent wisps with temporal history disabled. Bounded/tiled opacity ranges fall from 0.000283/0.002939 in the preserved camera-ladder baseline to below 0.000002 with fixed cells. A separate smooth procedural camera sweep reduces maximum alpha second differences from 0.000192 to 0.000046 and red second differences from 0.000167 to 0.000067. These controlled comparisons isolate integration instability, not all possible visual flicker. Existing opacity, scale, palette, tile continuity and terrain occlusion checks pass without GPU validation errors. The far-floor probe sees ground 2,638 units away instead of the old missing rectangle. The negative control is reproducible with CLOUD_STABILITY_BASELINE=1; it only replaces the diagnostic shaders, not the demo.

### LOD reconstruction experiment

The marching-cubes LOD and local Babylon AVBD H-PLOC implementation were reviewed for continuous-field reconstruction and conservative spatial traversal. The paired-density reconstruction and navigation scheduling experiment was reverted because the visual improvement did not establish a reliable full-demo performance gain. The established renderer, camera queue, both cloud methods and all presets remain intact. A controlled 224-versus-2048-step cached-field reconstruction comparison remains in the browser diagnostic for future changes; it is not a frame-rate benchmark. All 134 Node checks pass.

### Restore pre-grid cached-volume marching

At the user's request, the flat 3D-volume marcher has returned to camera-ray sampling with a finite distance/step budget. The material-cell DDA, nested power-of-two traversal grid, near/far grid reservations and logarithmic horizon coverage have been removed from this path. Near samples again use the original midpoint integration and fixed pixel phase jitter. Empty-space bounds, cached field reconstruction, noise deformation, terrain clipping and base-anchored cloud scaling remain. Distant clouds can again disappear when the ray budget runs out; that tradeoff is intentional for this rollback. The procedural ray-layer renderer is unchanged. All 134 Node checks pass; the later fixed-grid movement and full-horizon diagnostics are no longer acceptance criteria for this older method.

### Near ray intervals, inside-cloud reach and terrain

The cached-volume march now integrates adjacent density endpoints, reusing the previous endpoint. Close intervals also use a midpoint with positive Simpson weights, fading to the endpoint integral farther away. Lighting samples the density-weighted interval centroid. This replaces the old extra occupancy-only density probe; the density/lighting textures and maximum ray count are unchanged. Near intervals are phase-anchored along each actual camera ray under translation, with the first partial interval integrated instead of leaving a jittered gap. There is no axis-aligned cell traversal or nested voxel grid. Rotation can still perturb the sampling pattern.

Beyond the near region, a continuous cubic distance schedule reaches the remaining volume boundary within the same ray budget. Conservative empty-space tests remain; the procedural ray-layer renderer is unchanged. Three inside-volume horizon directions now match the 1,024-step uniform-opacity reference, where the restored short-distance baseline lost roughly 90% of the optical depth. Distant fine structure still has a limited sampling budget.

The terrain uses irregular warped ridges, finer slope and snow transitions, and a nonuniformly spaced triangle mesh. Geometry is generated once; cached heights also supply the normals. The default mesh falls from 294,920 to 165,896 triangles, with finer spacing around the basin and coarser spacing on its flat outer apron. The extended floor and cloud-depth clipping remain rasterized.

The transparent-wisp movement check reduces bounded-volume alpha fluctuation from 0.000283 to 0.000057 and RGB fluctuation from 0.000498 to 0.000075. The wide repeated-field case improves less, so the original strict fixed-grid stability thresholds remain unmet; this pass does not claim elimination of movement flicker. The reproducible pre-pass shader is selected in the browser harness with CLOUD_INTERVAL_BASELINE=1. All 135 Node checks pass.

Terrain color/lighting is evaluated at mesh vertices and interpolated, while fragment depth remains the true camera-to-surface distance. Clockwise front faces match the existing projection; hidden backs are culled. Final GPU checks retain the 2,638-unit floor hit, terrain occlusion on both cloud methods, cloud scaling and animation repeatability, with no validation errors. The 1280x720 isolated terrain benchmark measured recent medians of 0.99-1.05 ms versus 1.11 ms for the larger per-fragment-shaded baseline, but earlier runs varied substantially; this is not evidence of a large full-demo FPS gain. Cloud compute medians at 512x288 were 3.2/3.9 ms for horizontal/upward views versus 3.4/3.8 ms before this pass. The benefit is greater inside-cloud reach and less near flicker at broadly similar measured cloud cost.

Paused camera navigation now uses the same four-per-second timing-report limit as continuous playback, instead of snapshotting and posting detailed reports twice per camera frame. Manual render/startup progress is retained. A burst regression verifies 60 navigation frames produce four report snapshots instead of 120, while manual progress still posts immediately. All 136 Node checks pass. The strict sparse-movement GPU diagnostics still fail their prior fixed-grid thresholds, as documented above; no thresholds were relaxed.

The final actual-demo flight review used Balanced fields, ray divider 1, temporal Off, cloud size 3x and the mountain basin. Its navigation HUD sampled 46.8 fps near camera [0, 13.63, 4.53]; this is one observed flight sample, not a matched full-demo before/after benchmark or a 60 fps guarantee. The scene was left paused after checking flight, with no console errors.

### Continuous aerial fog and eroded terrain

The preview now integrates its existing vertical aerosol density analytically instead of changing a jittered quadrature count in whole steps. Nearly horizontal rays blend continuously into the midpoint limit. Cloud-box grazing and the faint procedural-cloud compositor also join continuously into clear sky. The GPU comparison reduces the color jump across alpha 0.003 from 0.01318 to zero, and normalized aerosol-path reference error from 0.04236 to 0.00000067. The preserved negative control is cloudsRender_fog-baseline.wgsl; /fog-continuity runs both full preview pipelines and validates the terrain blocker, without GPU validation errors.

Terrain keeps its actual rasterized surface distance for aerial fog. Existing screen-space god-ray samples now include terrain depth, reject occluders behind the receiving surface, and limit shaft intensity on mountains to the haze in front of them. Distant ground can fade fully into the atmosphere instead of retaining a hard floor horizon. These remain screen-space shafts, not a separate terrain shadow march.

cloudTerrainErosion.js adapts phacelleNoise and erosionFilter from ../noise/noiseCompute.wgsl: overlapping slope-directed carriers, octave steering and footprint filtering carve branching gully detail into the mountain mesh. This is procedural erosion-shaped detail rather than simulated water erosion. Geometry and normals are generated once, with unresolved stripes removed at coarse mesh spacing. The basin floor, outer apron, extended floor and 165,896-triangle budget remain. All 138 Node checks pass, including deterministic erosion, preserved floor, bounded displacement, valid normals and coarse-detail filtering. There is no additional per-frame terrain noise or terrain raymarch.

The remaining ground/sky horizon mismatch is handled separately: the distant flat apron converges to the same sky color, aerial distance and shaft response as open sky, over 144-768 world units. Nearby mountains retain full surface depth and fog; the fade does not change cloud clipping or ray budgets. A full-compositor GPU regression at low fog density measures a 0.02002 ground/sky color jump in the old renderer and zero after the change, for cached and procedural clouds with empty and partially transparent cloud pixels. This verifies the background discontinuity, not every possible cloud-volume boundary.

Cloud height is now a separate quick-dock slider (-6 to 80 world units). It moves the cloud box center vertically through the existing live view update, independently of cloud size, thickness, terrain and camera; no extra uniform, texture or field rebake is needed. It stays synchronized with the advanced center-Y control and reflects each shape preset's altitude and the alpine surroundings offset. A preset selection still installs that preset's authored height. The browser check raises 10.3 to 18.9 while camera coordinates, 8x scale and 4.6 half-height remain unchanged.

### Procedural ray-cloud fog planes

The broad stripe reproduced in Ribbon Confluence at 8x size was a separate foreground-cloud fog artifact. Turning fog off removed it with the compute march unchanged. Preview fog bounds were still in material space while camera positions and cloud radiance were in world space. They now use the marcher's same lower-support scale anchor; planet bounds are unchanged.

Correcting scale alone still exposed a stripe above the layer: the preview used a proxy AABB hit/miss to estimate cloud depth, and that face transition overrode continuous resolved density. Cloud fog now uses a continuous opacity-dependent distance estimate and camera approach distance, without intersecting a proxy plane. Immersion fades continuously as the camera leaves the layer. This remains an artistic depth estimate because the resolved RGBA cloud texture does not carry surface depth. There is no new texture, march or sample loop, and the procedural density/lighting calculation is unchanged.

/ray-fog-band renders the actual procedural compositor with fixed cloud radiance, sweeping 512 directions at 1x/8x size, two camera altitudes and alpha 0.08/0.4/0.98. The dense 8x case's largest adjacent-row color jump falls from 0.33514 to 0.00034 inside the layer; the above-layer case also passes. All twelve after cases meet absolute continuity limits with no GPU validation errors. The negative control retains the former shader and unscaled preview bounds. The existing aerosol-reference, faint-cloud and terrain-horizon GPU checks still pass; all 139 Node checks pass. Actual Ribbon Confluence before/after captures are procedural-ray-band-before.jpg and procedural-ray-band-after.jpg in the chat artifact directory. Fine procedural density creases are separate from this fog stripe and are still visible with fog disabled.

### Remove Cartesian planes from procedural painted clouds

The flat procedural marcher no longer traverses Cartesian integration cells or rounds far sample pitches to powers of two. Near intervals are phase-anchored along the actual viewing ray; farther intervals use the existing continuous adaptive step. Lighting normals and sun response refresh at each occupied flat-ray sample instead of waiting for a separate XYZ lighting-cell crossing. This removes two sources of crossing planes in the painterly finish without changing the density functions, palettes, fog fix, textures or maximum step budget. The cached-volume marcher and spherical/planet sampling are unchanged.

The matched Ribbon Confluence close-up at 8x size, render divider 1 and temporal Off no longer shows the former straight crossing seams. Before/after images are procedural-planes-before.jpg and procedural-planes-after.jpg in the chat artifact directory; the final camera turn is procedural-planes-final.jpg. The previous procedural shader is preserved in cloudLayer_planes-baseline.wgsl and can be selected in the browser harness with CLOUD_PLANES_BASELINE=1.

At 512x288, warmed procedural panning medians changed from 28.5/29.4 ms to 24.1/23.9 ms for fixed/evolving noise offsets. These are controlled completed-kernel timings, not a full-demo FPS guarantee. The smooth procedural translation check remains within its existing tolerance: alpha/red second differences are 0.000099/0.000124 (previously 0.000046/0.000066). Removing the grid trades a small increase in that controlled motion error for less spatial structure; it does not claim better temporal error. The full GPU report has no new failures and no validation errors: optical-depth, padding, cloud scaling, terrain occlusion and animation checks pass. The two pre-existing strict cached sparse-motion checks remain failing with identical results. All 139 Node checks pass.

### Restore axis-aligned procedural sampling after visual regression

The preceding ray-aligned experiment was rejected after broader user camera views exposed radial rings and degraded the painterly structure. cloudLayer.wgsl is restored byte-for-byte from cloudLayer_planes-baseline.wgsl, including the original Cartesian near/far integration cells and lighting-cell refresh. No speculative blending is applied in this rollback. The world-space fog bounds, continuous cloud-fog estimate, height control and terrain changes remain. All 139 Node checks pass. The earlier close-up and smooth-motion checks did not cover the radial-band failure and do not establish acceptance of the reverted experiment.


### Grazing-angle integration across the full view

Procedural flat clouds retain their fixed Cartesian sampling grid. Each pixel uses its actual perspective ray to suppress separate cell crossings within 30 degrees of parallel; contributions return smoothly by about 53 degrees. Unintegrated optical distance carries forward rather than fading cloud density. The same rule now covers the full ray, including coarser cells beyond the former near-only fade. Small contributions accumulate before density/light evaluation. Texture interval filtering uses a continuous footprint rather than the arbitrarily short interval at a cell corner. No card rotation, new texture taps or additional rendering pass is introduced. Broad cell-shaped creases can still remain; this reduces the grid rather than claiming to eliminate it.

The compositor repairs isolated thin extrema using its existing four neighbors for procedural clouds only, preserving tested smooth ramps and silhouettes. God-ray strength now emphasizes light transmitted through cloud openings instead of predominantly illuminating occlusion edges, using the existing sample loop; uniform clear sky receives no shaft contribution. Cached-volume integration is unchanged.

GPU checks at /cell-seams preserve uniform optical coverage to 0.000001 across 512 directions and reduce synthetic thin-seam RMSE from 0.06572 to 0.02015. At 512x288, controlled procedural fixed/evolving medians were 29.6/27.5 ms versus 29.6/29.9 ms for the unchanged Cartesian baseline; these are completed-kernel measurements, not full-demo FPS. The finer-cell trial was rejected after measuring 38.6/40.4 ms. Existing strict cached sparse-motion failures remain unchanged; GPU validation reports no errors. The original layer and compositor are retained as cloudLayer_planes-baseline.wgsl and cloudsRender_cell-baseline.wgsl for CLOUD_PLANES_BASELINE=1 comparisons.


### Painted-cloud horizon scheduling

Procedural flat rays now run in 16x8 workgroups instead of 8x8. Grouping more neighboring horizontal rays reduces the cost of long horizon marches while retaining the accepted grazing-angle sampling, density, lighting, draw distance and resolution. Cached-volume, spherical and temporal-resolve groups remain 8x8. The shader defaults to width 8 for standalone consumers; the builder supplies the width override and dispatches accordingly. Both ray and resolve stages guard partial tile bounds, and compact temporal dispatch keeps its existing pixel ownership.

/horizon-performance compares the production kernel against accepted snapshots in cloudCommon_horizon-baseline.wgsl and cloudLayer_horizon-baseline.wgsl, using paired GPU timestamps, alternating execution order and raw pixel readback. At 773x435, transparent, tower and oblique horizon medians changed from 44.76/66.98/44.83 ms to 41.22/61.73/40.96 ms (about 8% less GPU time). Medium and thicker horizons improved too; dense, upward and downward medians stayed level. All eight views, nonzero warp controls, six compact temporal rates and partial-tile checks passed exact pixel/coverage comparisons with no validation errors. These are local kernel measurements, not a full-demo FPS guarantee.

32x8 groups improved the longest rays more but slowed dense and short rays, so they were rejected. Arithmetic shortcuts, hash/subgroup sharing and shadow reuse were also discarded after inconsistent or negative timings. The earlier roughly 4% shortcut result did not repeat; those changes are absent from production. The existing two strict cached sparse-motion checks remain failing with identical values; all 140 Node checks pass.

### Paused UI and camera presentation

Rendering already runs in the OffscreenCanvas worker. The actual-demo probe reproduced long UI presentation gaps during full-resolution procedural camera movement without main-thread long tasks. Settled paused views submitted no work. Acquiring the next canvas image before a long cloud compute tied browser presentation to that pending frame.

Slow paused frames now finish their ordinary cloud/terrain compute submission before acquiring the next canvas image. The browser keeps the previous completed image available in the meantime. This activates after a completed paused frame exceeds 100 ms; fast views, startup previews and animation retain fused submissions. No ray samples, texture filtering, lighting, resolution or draw distance are reduced. The row-batching experiments were removed: late canvas acquisition achieved the responsiveness improvement with one unchanged cloud dispatch.

Camera RPCs acknowledge GPU completion so intervening input coalesces into the latest pose instead of queuing another obsolete view; they skip a redundant pre-frame queue drain. Pause notifications and acknowledgements follow GPU completion too. Temporal Off always sends an explicit worker reset, fixing a stale temporal rate left by previous scenes. FPS updates refresh only status text rather than repopulating controls, and navigation does not emit a benchmark log on every completed frame.

Hidden pages suspend their worker animation loop after existing GPU work drains. The playback intent is retained, wind/weather clocks freeze, and returning to the page resumes without a large time jump. Explicitly pausing while hidden wakes and stops the loop; making the page visible afterward never restarts paused playback. Manual still-frame requests remain available. This prevents background previews from continuously consuming GPU time behind a paused foreground view.

/ui-responsiveness runs the real demo and records worker traffic, UI animation-frame gaps and long tasks. With Ribbon Confluence at 8x, divider 1 and temporal Off, an original-grouping fused control measured a 533.1 ms maximum UI gap. Final adaptive presentation measured 41.7 ms maximum and 8.5 ms p95; both settled idle phases sent/received no messages or frames. Full cloud frames remained around 300 ms in this deliberately heavy view: this fixes presentation responsiveness and queued-input latency, not the underlying full-resolution horizon cost. Fast clear-sky views return to fused rendering. Timing results are local measurements, not a universal FPS guarantee.

All 147 Node checks pass. Split-submission GPU output matches accepted pixels exactly across seven procedural views, terrain, coarse terrain rendering, odd frame sizes and partial tiles; direct rendering still works afterward. GPU validation reports no errors. The full flat-opacity suite retains only its two pre-existing cached sparse-motion failures with unchanged values. Existing cached-volume and painterly shader math is unchanged.

Remaining limitation: a later default Rain Shelf probe still recorded occasional idle animation-frame gaps with no worker messages, no rendered frames and no main-thread long tasks. A repeated idle probe measured 17–19 ms p95 with roughly 100–113 ms outliers. These observations do not establish the cause or prove all frozen-frame lag is fixed. The heavy-view improvement above is a controlled camera-presentation result; the unresolved idle scheduling outliers and expensive full-resolution horizon rendering remain separate issues.

### Bounded cached-volume turbulence

The turbulence control previously applied a hard-clipped displacement of up to 40% of the repeated tile width. The displacement had no slope limit, so the sampling domain could fold through itself, pulling thin Kelvin–Helmholtz crests into oversized ribbons. Its edge erosion could also remove nearly the entire density of a thin crest, since that whole feature classified as a shoulder.

The same broad and fine noise reads now use amplitudes limited by their filtered texel rates and the vertical boundary fade. For normalized noise, the maximum displacement-gradient row budget is 0.60 at strength 1.5. Thin cirrus, fluctus and morning ruffles receive 35% of the former erosion strength; at maximum turbulence their point density retains at least 55.375% before integration. Thick-body erosion is unchanged. Density and lighting still share the same deformed coordinates, and existing conservative skip bounds cover the smaller displacement. No new texture, cache bake, ray sample or render pass is added. Off retains exact output.

The /turbulence-safety GPU probe checks 32,768 material positions for each of 20 old/new, narrow/wide and strength combinations against deliberately steep normalized noise. The old wide Natural setting folded at 11,347 points; the bounded version has no foldovers at any tested strength and preserves the thin-density floor. Finite differences use a resolved interval to avoid mistaking hardware interpolation-fraction quantization for a derivative. The /turbulence-performance probe alternates old/new production kernels on one device with identical cached fields. At 512x288 Low field quality, the latest Kelvin–Helmholtz Natural / Wind-torn medians were 0.85 / 0.85 ms before and 0.79 / 0.79 ms after; these short controlled kernel timings are not a full-demo FPS guarantee. One cumulus Natural measurement was one timer quantum slower; the remaining active cases were similar or faster. All three Off comparisons are bit-identical and field resources are reused.

All 147 Node checks pass. The full GPU regression suite reports no validation errors and retains only the same two strict cached sparse-motion failures with unchanged values. Matched actual-demo views use the reported Kelvin–Helmholtz camera, 8x size and Wind-torn turbulence. The wave preset still intentionally contains open hooks and broken crests; this change limits deformation and excessive erosion rather than replacing its anatomy. Diagnostic baseline source is clouds_turbulence-baseline.wgsl; CLOUD_TURBULENCE_BASELINE=1 selects it in the review worker.

### Cloud patterns: live slices and frozen repeating volumes

Open **Cloud patterns** in the quick controls. Slice layout and freezing are independent: live slices work with cached 3D volume presets and procedural ray layers. Presets cover a single horizontal plane, spaced horizontal decks, vertical X/Z curtains, sparse layers and a continuous slice range, with live and frozen versions of each. The frozen repeating volume preset keeps the whole 3D shape.

First/last slice select exact grid indices; equal indices select one plane. Every N slices sets the skip interval, and Layer thickness controls optical thickness. Cached slices use the selected field resolution; procedural slices use 128 evenly spaced planes on each axis. These intersect the selected world planes directly and retain the existing density, detail and lighting methods. Unselected space is skipped rather than masked after a full march. Tangent-only filtering on cached planes and projected footprint filtering on procedural planes reduce horizon aliasing. Nearly edge-on planes fade smoothly. Terrain depth still occludes both modes.

**Freeze shape and lighting** holds the existing cached density and light textures, plus their material clocks. Animate clouds scrolls the held tile using the shape wind; Scroll speed scales that motion. Repeat size changes its horizontal period, and Sky span controls the extent of the repeating sky. The full 3D volume scrolls and repeats as well as the slice layouts. Turbulence follows the repeated tile rather than giving each copy a different shape. Capture current clouds again rebuilds with the current authored settings while preserving the scroll offset. Live clouds restores normal evolution. Capturing requires a cached volume preset; procedural layers can use every live slice layout.

This reuses the existing field textures and mip chain. The field uniform grows by 48 bytes; no additional 3D texture is allocated. Separate shader variants compile slice/capture logic out of normal clouds. Frozen fields skip density, lighting and mip rebuilding, while live cached slices continue updating normally. Cached slice traversal is bounded to 512 plane intersections per ray. This is an optional visual style, not a replacement for the accepted full-volume rendering.

The flat-layer style and horizon footprint treatment were informed by the two thin cloud layers in [Noniv/web-ocean's sky shader](https://github.com/Noniv/web-ocean/blob/main/js/wgsl/sky.js). This implementation uses this project's own density fields, procedural march and lighting.

The /frozen-pattern GPU check covers single planes from both sides on all axes, interval selection, optical depth, terrain occlusion, deterministic scrolling, repeat ownership, unchanged field allocations, live field evolution and procedural slice rendering. Node tests also verify independent live/frozen shader variants and prewarming. The full GPU regression suite retains its two previously recorded cached sparse-motion failures; those remain separate from this feature.


Final pattern validation: all 153 Node checks and all 25 dedicated GPU checks pass, with no GPU validation errors. Normal procedural output remains bit-identical to the accepted horizon baseline across the comparison views and temporal rates. Turbulence Off remains bit-identical in the paired cached-volume probe. The two pre-existing cached sparse-motion failures retain their exact previously recorded alpha/red ranges.

Frozen slice patterns scroll within their plane: wind normal to a held slice does not substitute another cross-section or change its tangent deformation. The full frozen volume retains ordinary three-dimensional translation within the cloud layer. Preset slice thicknesses are deliberately stronger than one grid cell, so the existing opacity cutoff does not erase most of a sparse layout; the slider still supports thin sheets.


The main **Layer preset** selectors now include three explicit pattern categories: Cached 3D volumes · Live 2D / 2.5D slices; Cached 3D volumes · Frozen scrolling patterns; and Procedural ray layers · Live 2D / 2.5D slices. Their 25 complete scene presets install the source anatomy, camera, palette and slice/capture settings together. Cloud patterns opens for further adjustments. Frozen selections force a fresh capture of the new source, and ordinary layer presets restore the full live volume. All 155 Node checks pass, including catalog coverage and preset transaction checks.

### Vertical ranges and showcase scenes

Continuous vertical ranges on X and Z join the continuous horizontal range in all three main pattern categories. They select an uninterrupted subset of adjacent grid slices; First slice, Last slice, Every N slices and Layer thickness remain editable. Frozen ranges retain scrolling and repeating behavior. Live cached and procedural ranges retain their existing animation and sampling methods.

The twelve sky scenes now have individual camera compositions and sun angles, with Sunlit Ivory, Storm Silver, Apricot Gouache and Coral Porcelain showcase palettes. New slice presets also start with these brighter looks. Ink Wash palettes remain available as independent color choices. Scenes retain the current screen resolution and field-quality budgets.

Rain Shelf has broader weather billows, more shape/detail octaves, fuller coverage, less sparse erosion and a lower opening camera angle. Its thin layer bounds, texture dimensions, maximum march steps and sun-sample budget remain unchanged. Extra noise octaves affect texture baking rather than adding per-ray noise probes; fuller coverage can still change actual frame cost. The selected color grade remains independent of this anatomy preset.

Validation: all 155 Node checks pass. Browser review covered Rain Shelf, Ribbon Confluence, Cathedral Towers, Sunlit Cloud Streets, cached live X ranges, frozen Z ranges and procedural live X ranges, with no logged browser errors. This preset-only pass does not alter the cloud shaders or resolve the two previously documented cached sparse-motion diagnostic failures.

### Breaking waves, parallel bands and finite storms

Breaking Wave Front and the experimental Kelvin–Helmholtz form now have a broad triangular rising body underneath a curled crest. Breaking Wave Front opens from the side of a finite bank so the profile is visible. Parallel Cloud Bands (previously Sunlit Cloud Streets) uses a dedicated continuous roll scaffold rather than independently scattered cumulus cells. Islands in Mist uses low, broad cloud islands with stronger fog and a sun-facing view through the gaps.

Cached volumes now use the authored atmosphere strength: their old 0.24 fog multiplier and 0.14 cloud-fog cap suppressed the controls. Soft lighting also retains the god-ray shadow contrast. Cached ray quadrature uses reduced jitter to limit grain in still mist. Ray sample counts and texture allocations are unchanged. These remain the existing analytic atmosphere and screen-space shafts; cloud aerial distance is an optical-thickness estimate, not a new volumetric atmosphere simulation.

**Cached 3D volumes · finite rotating storms** contains Supercell · Rotating Rain Curtain and Hurricane Eye · Rising Spiral Wall. The supercell has layered shoulders, a lowered wall cloud and a translucent, streaked precipitation sector. The hurricane has a hollow core, an eyewall widening upward and helical ridges. Both retain a complete finite volume when enlarged. Animate clouds advances slow rotation and billow evolution through the existing material clocks; Pause and frozen capture hold those clocks. No new volume textures, ray samples or camera-facing cards are added. The rain curtain is volumetric density, not a particle rainfall simulation.

The /storm-shape-checks GPU fixture evaluates the production scaffolds independently of noise and palettes: rising wave mass, uninterrupted bands/open lanes, hollow hurricane core, dense wall, finite bounds, translucent precipitation, rotation and deterministic clocks. /god-ray-checks additionally renders the real cached soft-lighting composite at fog strengths 0, 0.4 and 2 to guard against hidden fog suppression. The existing Node suite also checks that enlarged storms stay finite and paused fields remain cached.

### Cloud sea, surroundings and sun controls

Sloshing Cloud Sea is a filled cached volume with three crossing periodic swells, gentle crest breakup and independent material-clock phases. It repeats over the existing bounded cache and evolves with Animate clouds; it is not a thin surface mesh or a fluid simulation. Freeze shape and lighting can still hold and scroll the sea as a repeating volume. No extra 3D textures or per-ray shape probes are added.

Switching Surroundings now preserves the authored cloud dimensions. The old basin handler silently increased every span below 180, stretching finite hurricane eyes and supercells until their preset was reapplied. It now only changes the terrain flag and lifts the camera/cloud layer together by six world units. Sun height is available directly below Sky span in the quick controls, drives the existing sun-elevation parameter and synchronizes with preset changes.

Terrain depth still blocks god rays, but its sharp silhouette no longer feeds the cloud-opening emission signal. The terrain-only GPU fixture now produces zero bright shaft emission while retaining a nonzero occlusion shadow. This removes the bright mountain fans in heavy fog without extra sampling or an additional pass; the shafts retain their existing screen-space limitations.

Validation: all 157 Node checks, all 10 storm/sea GPU shape checks, and the god-ray/atmosphere fixture pass without GPU validation errors. Browser checks confirmed that the hurricane retains span 52 when switching mountains on/off, Sun height updates the advanced elevation, and the sea animates and pauses. The earlier two cached sparse-motion diagnostic failures remain separately documented above.

### Rougher shaped clouds and regional sea variation

Shaped volumes now use stronger filtered billows and edge breakup from their existing noise samples. Surface-local erosion keeps the sea filled underneath and the hurricane core open; geometry demos also get irregular boundaries without additional texture reads.

Sloshing Cloud Sea now has broad calm and energetic regions, bent crossing swells, varying billow strength and a slow regional height change. The coordinate warp and all organizing waves are periodic over the cache tile, preserving repeat boundaries during motion. The cache dimensions and ray sample budgets are unchanged; the density bake does more arithmetic.

Validation: all 157 Node checks and all 15 storm/sea GPU shape checks pass. The GPU fixture checks both repeat axes at different material clocks, solid sea / open eye preservation, finite output and distinct regional surface relief. Browser review of the varied sea reported no errors. The earlier two cached sparse-motion diagnostic failures remain separately documented above.

### Spiral storm canopies and finer sea crests

Supercell and Hurricane Eye now include broad upper outflow decks with rotating spiral ridges, varying thickness and feathered radial edges. The lower storm bodies leave room for these wider canopies; the hurricane core stays open through the upper layer. Stronger filtered billows and scalloping roughen the storms, with positive displacement restricted to the existing cloud boundary so noise cannot seed detached exterior puffs.

Sloshing Cloud Sea shifts more relief from its smooth carrier waves into irregular billows, finer crossing ripples, scalloped ridges and stronger surface erosion. All new analytic ripples use periodic integer harmonics, retaining the existing seamless repeating volume and material-clock animation. Noise filtering follows the volume footprint. Cache allocations and per-ray sample budgets are unchanged; density baking does additional arithmetic.

Validation: all 157 Node checks and all 17 storm/sea GPU checks pass without GPU errors. New checks cover both upper canopies extending beyond the lower body, rotating canopy contours and empty finite boundaries. Existing tests cover the hollow eye, filled sea, deterministic clocks and repeats along both axes while moving. Browser review covered the supercell, hurricane and sea; the existing two cached sparse-motion diagnostic failures remain documented above.

### Continuous hurricane eyewall, stable shafts and slower surface motion

Hurricane Eye now keeps a full, continuous widening wall. Its deep radial terraces and density folds are replaced by shallow, closely spaced helical riffles. Hurricane-only shape/detail mapping is tighter, its random surface displacement is smaller, and ray-side wispy erosion is reduced to 22% strength. The broad upper canopy and empty eye remain. Supercell and cloud-sea anatomy are unaffected by this eyewall adjustment.

God rays now filter cloud and terrain coverage over each radial segment, use fixed sun-relative intervals so blocker silhouettes are not repeatedly projected at changing distances, and integrate a partial final interval smoothly. Extinction and brightness weighting account for interval length. Smooth output compression replaces clipped bright/dark plateaus. The maximum 8/12/16 ray steps and four cloud-alpha reads per step remain; terrain filtering uses four depth taps per segment rather than one, and opaque attenuation no longer changes normalization through an early exit. These are still screen-space shafts and cannot recover off-screen occluders.

Supercell, Hurricane Eye and Sloshing Cloud Sea use roughly one-quarter of their former fine-detail drift speeds. Baked shape billows advect at 35% of the broad shape clock. Broad storm spin and sea swell phase now follow the shape clock independently of detail drift, preserving approximately their previous preset speeds. Pause and frozen captures still hold all material clocks.

Validation: all 157 Node checks, all 19 storm/sea GPU checks and the god-ray/atmosphere GPU fixture pass. Eyewall probes retain full density around the circumference with noise enabled; radial profiles resolve nine shallow ridge turns rather than deep folds. Ray checks cover quality-level brightness consistency, unclipped strength response, empty clear-sky output and terrain blockage without emission. Browser reviews of the hurricane and misty basin reported no errors. The earlier two cached sparse-motion diagnostic failures remain documented above.

### Storm detail rotation at Balanced quality

Supercell and Hurricane Eye now both start at UV scale 0.4. Their fine material no longer rotates at the full storm spin rate: supercell texture rotation uses 10% and hurricane texture rotation 5%, while the analytic storm anatomy retains its spin clock. Fine shape advection is 2.5% of the shape offset and detail advection is 15% of its offset. A conservative filter footprint accounts for the sheared material mapping, reducing unresolved bands without increasing cache dimensions or adding samples. Cloud-sea motion and anatomy retain their accepted settings.

The new /storm-motion-checks diagnostic bakes the actual production density shader at Balanced 128×64×128, UV scale 0.4, one 30 Hz frame apart. It holds the analytic pose and compares against a negative control with the previous fine-material clocks, using the same synthetic periodic mipmapped noise and filtering for both. Mean fine-density change drops to 18.27% of the control for the supercell and 12.21% for the hurricane (about 82% / 88% less). This measures fine-density stability, not universal screen-space flicker or FPS. Diagnostic readback uses a separate capture texture; production caches gain no readback resources.

### Cloud Lab Studio UI

Integrated the supplied Cloud Lab Studio template into the flat and planet demos while retaining the current cloud shaders, presets and motion. Both demos now use a floating control rail, a Studio preset/export card, collapsible advanced sections, and shared styling. The flat Studio keeps sun height, cloud size, lighting and image quality in easy reach; planet manual edits retain their Apply workflow.

Save image exports the canvas without controls. Copy/Paste look and Download/Open .json store and restore editable settings; flat looks also include custom frozen/slice layouts. Image exports were visually checked for both renderers and a flat JSON look was restored through the UI.

The header offers Fullscreen and Clean view. Clean view hides the rail and camera overlays while preserving camera interaction. Press H to toggle the UI; Escape or a double-click restores it. A brief exit hint disappears automatically. Leaving fullscreen restores the UI. Narrow screens use the same rail as a bottom sheet.

### Studio pattern and renderer controls

Cloud patterns is now a visible Studio dropdown, with a separate Slice & repeat settings disclosure. The planet renderer toggle mounts inside Studio, so both Hide and Clean view hide it along with the other controls.

Returning from Hail Mary to Current / custom explicitly resets the styled form flag. Style transactions now honor the requested editor values before rebaking both cached renderers, and the shell renderer resolves presets from a saved baseline instead of layering them onto the previous preset. Each cached renderer retains its own render mode. The two methods still approximate cloud density differently; this fixes stale preset state rather than promising identical pixels.

Validation: 158 Node checks pass, including a Hail Mary → custom → Hail Mary regression across both cached renderers. Browser checks verified the Studio dropdown, slice controls, renderer switching, and hiding the moved renderer toggle with both Hide and Clean view; no console errors were reported.
