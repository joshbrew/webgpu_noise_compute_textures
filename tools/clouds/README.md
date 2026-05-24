# WebGPU Volumetric Clouds

Realtime WebGPU volumetric clouds with GPU-baked procedural noise, compute-shader raymarching, temporal reprojection, large cloud boxes, and a browser tuning playground.

The core renderer is `CloudComputeBuilder` in `clouds.js`. It consumes a weather map, a shape volume, a detail volume, and optional blue noise, then writes volumetric cloud color and alpha into a WebGPU texture. You can composite that texture in your own renderer or use the included preview compositor.

The tuning playground uses `NoiseComputeBuilder` from [`webgpu_noise_compute_textures`](https://github.com/joshbrew/webgpu_noise_compute_textures) to generate the input textures on the GPU.

## Try it

[https://webgpuclouds.netlify.app/](https://webgpuclouds.netlify.app/)

## Related projects

- [webgpu_noise_compute_textures](https://github.com/joshbrew/webgpu_noise_compute_textures)
- Fredrik Häggström, [Real-time rendering of volumetric clouds](https://www.diva-portal.org/smash/record.jsf?pid=diva2:1223894&dswid=7420)

## Demo videos

- [5/7 demo](https://www.youtube.com/watch?v=HtLoZ3gxX-E)
- [5/6 demo](https://www.youtube.com/watch?v=ShBe7HvlEb8)

# Screenshots

<img width="1721" height="1695" alt="image" src="https://github.com/user-attachments/assets/52a1366b-5a81-4e0c-9fe9-1c5f00676911" />
<img width="1709" height="1627" alt="image" src="https://github.com/user-attachments/assets/14edd013-c56c-4cb4-8d60-d8a474a2b356" />
<img width="1285" height="1013" alt="image" src="https://github.com/user-attachments/assets/d043386e-a4e3-4c38-9b6f-1b9e8f0eb76e" />
<img width="2125" height="908" alt="Screenshot 2026-05-07 180853" src="https://github.com/user-attachments/assets/99f87b1f-0159-414a-93d2-d9a071f82448" />
<img width="1601" height="1035" alt="image" src="https://github.com/user-attachments/assets/e7b3e377-1c31-45d8-b200-42e2a2b0da93" />
<img width="1598" height="839" alt="image" src="https://github.com/user-attachments/assets/ef959ab5-070b-4fc1-bf39-444d091674c6" />
<img width="2600" height="1402" alt="Screenshot 2026-05-07 223522" src="https://github.com/user-attachments/assets/939b4692-5aea-4238-93ba-84015ded4231" />


---

## Install and run

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

## Active files

```text
clouds.js                CloudComputeBuilder library.
clouds.wgsl              Volumetric cloud compute shader.
cloudsRender.wgsl        Preview/composite shader.
cloudTest.worker.js      Worker-owned WebGPU demo backend.
cloudTestThreaded.js     Main-thread playground UI controller.
clouds.html              Playground UI markup.
```

Treat the root files as the active implementation. Older experiment folders are only for comparison.

---

# What the renderer does

The renderer is a compute-based volumetric cloud pass.

1. Intersect each camera ray with a world-space cloud box.
2. Sample weather, shape, and detail textures to estimate cloud density.
3. March through the box with adaptive step lengths.
4. Evaluate sun transmittance and phase lighting at protected intervals.
5. Accumulate color and alpha into an output storage texture.
6. Optionally reuse temporal history for animated/reprojected rendering.
7. Optionally composite the output through `cloudsRender.wgsl`.

The current v43 path includes performance-oriented shader logic for large and tall boxes:

- Weather-column empty skipping.
- Column-style Y-bounds acceleration derived from the weather field.
- Protected near/edge lighting so close silhouettes do not smear or card out.
- Far proxy sampling for safe horizon/interior cloud samples.
- Adaptive thick-box stepping and lighting skip.

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
  anvilLift: 0.6,
  alphaCutoff: 0.98,
});

clouds.setReprojSettings({
  enabled: 1,
  subsample: 5,
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
  coarseFactor: 5,
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
  anvilLift: 0.6,
  alphaCutoff: 0.98,
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

  clouds.dispatch({ coarseFactor: 5 });
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

The worker then binds the filtered view as `blueView`.

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

These are the current tuned starting points in `cloudTestThreaded.js`.

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
| Render Scale Divider | `5` | `1` full res, `5` one fifth res per axis. |
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
| Sun elevation | `41` | Sun elevation in degrees. |
| Sun bloom | `0.18` | Preview bloom around sun direction. |

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
| cloudAnvilAmount | `0.0` | Horizontal anvil spreading amount. |
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

Raymarch and visual stability parameters. These control quality, performance, LOD, near/far behavior, and the v43 thick-box/far-proxy path.

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
| anvilLift | `0.6` | Height influence for anvil shaping. |
| alphaCutoff | `0.98` | Early ray termination alpha. Higher marches deeper. |
| thickBoxPerf | `0.65` | Internal strength of thick-box acceleration. |
| thickStepBoost | `1.28` | Internal step boost for thick boxes. |
| thickDetailSkip | `0.18` | Internal detail-skip strength in safe interiors. |
| thickLightSkip | `0.42` | Internal light-skip strength in safe interiors. |

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
| `setReproj` | Update reprojection settings. |
| `runFrame` | Dispatch one cloud frame and composite. |
| `startLoop` | Start animated rendering. |
| `stopLoop` | Stop animated rendering. |
| `shutdown` | Dispose resources. |

---

# Performance notes

## Render scale divider

`Render Scale Divider` is the first performance knob.

```text
1 = full resolution
2 = half resolution per axis
4 = quarter resolution per axis
5 = one fifth resolution per axis
```

The v43 playground default is `5`. This is usually the right place to start while animating.

## Tall boxes

Increasing `Box Half Y` is expensive because rays can spend more time inside the vertical cloud slab. v43 reduces this cost with weather-derived column bounds, empty weather skipping, adaptive thick-box stepping, and far-proxy sampling. Still, very tall boxes should use:

- Render Scale Divider `4` or `5`.
- Reprojection enabled while animating.
- Conservative `maxSteps`.
- Protected near detail, but cheaper far interiors.

## Horizon boxes

For clouds stretching to the horizon, prefer larger X/Z cloud boxes plus tiled 4D weather. Do not make the 3D shape/detail textures huge just because the box is huge. The noise transforms and tiling handle the scale.

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

## Visual stability

If close clouds sparkle:

1. Reduce `stepJitter`.
2. Reduce `baseJitterFrac` or `topJitterFrac`.
3. Increase `raySmoothDens` slightly.
4. Check blue-noise filtering before reducing detail globally.

If distant clouds disappear:

1. Check `maxSteps`, `maxStep`, `farStepMult`, and box reach.
2. Avoid hard distance culling in visible density.
3. Keep weather rejection conservative.
4. Check camera vectors and FOV math.

If lighting cards or flat planes appear:

1. Keep the v43 protected near/edge lighting behavior.
2. Do not apply far/interior lighting shortcuts near silhouettes.
3. Increase `sunSteps` or reduce `sunStride` for debugging.
4. Reduce `thickLightSkip` temporarily if testing thick boxes.

---


---

# Credits

WebGPU implementation by Joshua Brewster (MIT License)

Inspired by Fredrik Häggström's [Real-time rendering of volumetric clouds](https://www.diva-portal.org/smash/record.jsf?pid=diva2:1223894&dswid=7420).

This implementation uses the companion WebGPU procedural texture work in [webgpu_noise_compute_textures](https://github.com/joshbrew/webgpu_noise_compute_textures).
