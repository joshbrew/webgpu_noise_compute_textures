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
