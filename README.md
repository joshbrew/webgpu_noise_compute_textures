
# WebGPU Noise Compute Shaders

### TRY ME [https://webgpunoise.netlify.app/](https://webgpunoise.netlify.app/)

GPU driven noise toolkit for 2D tiled textures and true 3D volumes, plus a small UI for inspecting stacks of noise modes and a toroidal 4D slice viewer.

This repo has two main parts:

- A reusable compute helper: `NoiseComputeBuilder` in `noiseComputeBuilder.js`
- A small test UI: `noiseComputeTest.js` + `noiseComponent.html` for interactive exploration

The helper aims to:

- Compose many noise modes into a single height field using GPU compute
- Generate toroidal 3D volumes from 4D noise kernels
- Visualize 2D array textures and 3D slices in WebGPU canvases
- Reuse GPU resources where possible and dispose them explicitly when you are done

To run the demo, run `npm install` then `tinybuild` within this repository. `npm i -g tinybuild` if you don't have it. You can also locally host the index.html with prebuilt files.

<img width="500" alt="Screenshot 2025-11-18 234820" src="https://github.com/user-attachments/assets/fb6c8b0e-d84f-4565-a551-84388159ef26" />

<img width="500" alt="Screenshot 2025-11-18 233631" src="https://github.com/user-attachments/assets/bf2fcc37-2f73-483c-96c4-56a994a50fce" />

<img width="500" alt="Screenshot 2025-11-18 211645" src="https://github.com/user-attachments/assets/6d657cb2-e4c0-4849-8da8-0dc694f05aaf" />

<img width="500" alt="Screenshot 2025-11-18 232951" src="https://github.com/user-attachments/assets/35fc121b-a5d2-47e9-bdc7-4f67b1941373" />

---

## Noise kernels and coverage

`NoiseComputeBuilder` ships with a broad set of kernels wired into `NoiseComputeBuilder.entryPoints`. These cover classic scalar noise, fractal variants, Voronoi and cellular patterns, curl and domain warp fields, 4D toroidal kernels, plus normal map and filter utilities.

Entry points are separate so pipelines compile fast. You never have to use every kernel in one run.

| Entry point                      | Description                                      |
| -------------------------------- | ------------------------------------------------ |
| `computePerlin`                  | Classic Perlin scalar noise, tile friendly.      |
| `computeBillow`                  | Soft billow style ridged Perlin variant.         |
| `computeAntiBillow`              | Inverted billow, valleys instead of bumps.       |
| `computeRidge`                   | Sharp ridge noise, mountain chains.              |
| `computeAntiRidge`               | Inverted ridge, basins and trenches.             |
| `computeRidgedMultifractal`      | Multifractal ridges, layered terrain detail.     |
| `computeRidgedMultifractal2`     | Higher frequency multifractal ridges variant.    |
| `computeRidgedMultifractal3`     | Third multifractal ridge tuning flavor.          |
| `computeRidgedMultifractal4`     | Fourth multifractal ridge shaping variant.       |
| `computeAntiRidgedMultifractal`  | Multifractal ridges with inverted contribution.  |
| `computeAntiRidgedMultifractal2` | Second inverted multifractal ridge flavor.       |
| `computeAntiRidgedMultifractal3` | Third inverted multifractal ridge flavor.        |
| `computeAntiRidgedMultifractal4` | Fourth inverted multifractal ridge flavor.       |
| `computeFBM`                     | Fractal Brownian motion, base variant.           |
| `computeFBM2`                    | FBM with alternate lacunarity and gain.          |
| `computeFBM3`                    | Higher order FBM configuration.                  |
| `computeCellularBM1`             | Cellular basis, Brownian style blend one.        |
| `computeCellularBM2`             | Cellular Brownian blend, variant two.            |
| `computeCellularBM3`             | Cellular Brownian blend, smoother variant three. |
| `computeVoronoiBM1`              | Voronoi distance blend, configuration one.       |
| `computeVoronoiBM2`              | Voronoi distance blend, configuration two.       |
| `computeVoronoiBM3`              | Voronoi distance blend, configuration three.     |
| `computeCellular`                | Cellular distance field, raw pattern.            |
| `computeWorley`                  | Worley distance field, raw pattern.              |
| `computeAntiCellular`            | Inverted cellular distance field pattern.        |
| `computeAntiWorley`              | Inverted Worley distance field pattern.          |
| `computeLanczosBillow`           | Billow style noise with Lanczos sharpening.      |
| `computeLanczosAntiBillow`       | Inverted billow with Lanczos accentuation.       |
| `computeVoronoiTileNoise`        | Voronoi cells tiled seamlessly across texture.   |
| `computeVoronoiCircleNoise`      | Circular Voronoi cells, bubble like.             |
| `computeVoronoiCircle2`          | Alternative circular Voronoi packing layout.     |
| `computeVoronoiFlatShade`        | Flat shaded Voronoi cell regions.                |
| `computeVoronoiRipple3D`         | 3D Voronoi ripple pattern along distance.        |
| `computeVoronoiRipple3D2`        | Alternate tuning of 3D Voronoi ripples.          |
| `computeVoronoiCircularRipple`   | Circular ripples driven by Voronoi distance.     |
| `computeFVoronoiRipple3D`        | Fractal Voronoi ripples with layered detail.     |
| `computeFVoronoiCircularRipple`  | Fractal circular Voronoi ripples variant.        |
| `computeRippleNoise`             | Concentric ripple noise field, waterlike.        |
| `computeFractalRipples`          | Multi scale ripples, fractal interference.       |
| `computeHexWorms`                | Hex grid based worm like bands.                  |
| `computePerlinWorms`             | Perlin driven worm like streaks.                 |
| `computeWhiteNoise`              | Uniform random noise, each pixel independent.    |
| `computeBlueNoise`               | Blue noise distribution, minimal clumping.       |
| `computeSimplex`                 | Classic simplex gradient noise.                  |
| `computeCurl2D`                  | 2D curl field from scalar noise.                 |
| `computeCurlFBM2D`               | 2D curl field built from FBM.                    |
| `computeDomainWarpFBM1`          | Domain warped FBM, configuration one.            |
| `computeDomainWarpFBM2`          | Domain warped FBM, configuration two.            |
| `computeGaborAnisotropic`        | Anisotropic Gabor kernel, oriented textures.     |
| `computeTerraceNoise`            | Step based terrace shaping of heights.           |
| `computeFoamNoise`               | Foamy blobby noise useful for clouds.            |
| `computeTurbulence`              | Turbulence wrapper, absolute value style.        |
| `computePerlin4D`                | 4D Perlin for toroidal 3D volumes.               |
| `computeWorley4D`                | 4D Worley driving toroidal cell volumes.         |
| `computeAntiWorley4D`            | Inverted 4D Worley for hollow structures.        |
| `computeGauss5x5`                | Five by five Gaussian blur filter.               |
| `computeNormal`                  | Scalar normal map from height channel.           |
| `computeNormal8`                 | Eight tap normal map estimator.                  |
| `computeSphereNormal`            | Normal from spherical height interpretation.     |
| `computeNormalVolume`            | Volume normal field from 3D scalar.              |
| `clearTexture`                   | Clear target texture to zero.                    |

At runtime you pass indices or names in `noiseChoices` to select and stack any subset of these. The UI wires this through bit indexed checkboxes and always includes `clearTexture` as the first pass so every mode composites onto a clean buffer.


---

## Files

### Core compute

- `noiseComputeBuilder.js`  
  WebGPU helper that manages:

  - 2D array textures with automatic tiling when width or height exceeds `MAX_2D_TILE`
  - 3D volumes with chunking when any dimension exceeds `MAX_3D_TILE`
  - Shared parameter UBO for all noise kernels
  - Shared options UBO that controls output channel, gradient mode, and flags
  - Permutation tables and dummy resources for inactive paths
  - Ping pong storage for both 2D and 3D compute paths
  - Lazy bind group recreation using dirty flags instead of discarding groups on every change
  - Explicit disposal entry points for both 2D texture pairs and 3D volumes

- `noiseCompute.wgsl`  
  Compute shader file. Entry points match `NoiseComputeBuilder.entryPoints` and include:

  - Classic gradient noise (Perlin, Simplex)
  - Ridged, billow, FBM variants
  - Cellular, Worley, Voronoi patterns
  - 4D toroidal kernels like `computePerlin4D`, `computeWorley4D`, `computeAntiWorley4D`
  - Filters, normals, and `clearTexture`

- `noiseBlit.wgsl`  
  Vertex and fragment shaders for previewing 2D array layers into a WebGPU canvas.

- `noiseBlit3D.wgsl`  
  Vertex and fragment shaders for previewing Z slices from a 3D volume.

### Test UI

- `noiseComputeTest.js`  

  - Imports the component HTML and injects it into the page
  - Creates a `NoiseComputeBuilder` instance
  - Reads UI state from `noiseComponent.html`
  - Drives 2D height field rendering and 3D toroidal volume generation
  - Applies per mode overrides on top of global parameters
  - Renders a 3 by 3 mosaic of a single Z slice from a toroidal volume
  - Keeps a small state object for the most recent volume so Z slice scrubbing only reblits, not recomputes

- `noiseComponent.html`  

  - Sidebar based layout
  - Main preview canvas for the height field
  - Mosaic view for toroidal 3D Z slices
  - Controls for:
    - Global noise parameters
    - Mode selection
    - Per mode overrides
    - Resolution
    - Z slice scrubbing


---

## Requirements

- Browser with WebGPU support (Chrome, Edge, or a recent Chromium build)
- A bundler that can import HTML as a string and handle ES modules

The UI is wired like:

```js
// noiseComputeTEst.js
import html from './noiseComponent.html';
import { NoiseComputeBuilder } from './noiseComputeBuilder.js';

document.body.insertAdjacentHTML('afterbegin', html);
```

Adapt this pattern to your bundler or framework as needed.

---

## Parameters and inputs

`NoiseComputeBuilder` exposes three main parameter layers:

1. Shared noise parameters (`setNoiseParams`)
2. Compute options and IO flags (`setOptions`)
3. Per call options for 2D and 3D (`computeToTexture`, `computeToTexture3D`)

### Shared noise parameters (`setNoiseParams`)

These drive the WGSL `params` uniform and are used by both 2D and 3D compute paths.

| Field         | Type  | Default     | Description                                                 |                                         |
| ------------- | ----- | ----------- | ----------------------------------------------------------- | --------------------------------------- |
| `seed`        | `u32` | `Date.now() | 0`                                                          | Seed for `BaseNoise` permutation table. |
| `zoom`        | `f32` | `1.0`       | Global UV scale, larger zoom gives coarser features.        |                                         |
| `freq`        | `f32` | `1.0`       | Base frequency in noise space.                              |                                         |
| `octaves`     | `u32` | `8`         | Number of FBM or multifractal layers.                       |                                         |
| `lacunarity`  | `f32` | `2.0`       | Frequency multiplier per octave.                            |                                         |
| `gain`        | `f32` | `0.5`       | Amplitude multiplier per octave.                            |                                         |
| `xShift`      | `f32` | `0.0`       | Offset in X for noise domain.                               |                                         |
| `yShift`      | `f32` | `0.0`       | Offset in Y for noise domain.                               |                                         |
| `zShift`      | `f32` | `0.0`       | Offset in Z or slice offset.                                |                                         |
| `turbulence`  | `u32` | `0`         | If nonzero, use absolute valued turbulence.                 |                                         |
| `seedAngle`   | `f32` | `0.0`       | Angle used by anisotropic kernels.                          |                                         |
| `exp1`        | `f32` | `1.0`       | Primary exponent shaping for curves.                        |                                         |
| `exp2`        | `f32` | `0.0`       | Secondary exponent shaping term.                            |                                         |
| `threshold`   | `f32` | `0.1`       | Threshold for Voronoi and pattern cuts.                     |                                         |
| `rippleFreq`  | `f32` | `10.0`      | Base ripple frequency in ripple modes.                      |                                         |
| `time`        | `f32` | `0.0`       | Time parameter for animated modes.                          |                                         |
| `warpAmp`     | `f32` | `0.5`       | Domain warp amplitude when used.                            |                                         |
| `gaborRadius` | `f32` | `4.0`       | Radius for Gabor kernel sampling.                           |                                         |
| `terraceStep` | `f32` | `8.0`       | Step size for terrace quantization.                         |                                         |
| `toroidal`    | `u32` | `0`         | If `1`, use toroidal addressing in kernels that support it. |                                         |
| `voroMode`    | `u32` | `0`         | Mode selector inside Voronoi kernels.                       |                                         |
| `edgeK`       | `f32` | `0.0`       | Edge contrast scaling for Voronoi.                          |                                         |

You can pass a single object and share it across all kernels or pass an array of param objects per call so each kernel gets different settings.

### Compute options (`setOptions`)

These control IO behavior and stack selection. They drive the WGSL `options` uniform.

| Field           | Type                     | Default | Description                                                  |
| --------------- | ------------------------ | ------- | ------------------------------------------------------------ |
| `noiseChoices`  | `number[]` or `string[]` | `[0]`   | List of kernel indices or entry point names to run in order. |
| `getGradient`   | `u32`                    | `0`     | If nonzero, output gradients instead of scalar.              |
| `outputChannel` | `u32`                    | `1`     | Target channel index in the RGBA16F output.                  |
| `baseRadius`    | `f32`                    | `0`     | Base radius used by spherical kernels.                       |
| `heightScale`   | `f32`                    | `1`     | Scalar multiplier on final noise output.                     |
| `useCustomPos`  | `u32`                    | `0`     | If `1`, sample from a custom position buffer.                |
| `ioFlags`       | `u32`                    | `0`     | `0` for 2D path, `3` for 3D volume path.                     |

`noiseChoices` can also be overridden in the per call options if you want a one off stack without touching global options.

### 2D compute parameters (`computeToTexture`)

Signature:

```ts
await builder.computeToTexture(
  width: number,
  height: number,
  params?: NoiseParams | NoiseParams[],
  options?: Compute2DOptions
);
```

2D specific arguments:

| Argument / field          | Type                             | Required | Description                                           |
| ------------------------- | -------------------------------- | -------- | ----------------------------------------------------- |
| `width`                   | `number`                         | yes      | Logical width of the target surface in pixels.        |
| `height`                  | `number`                         | yes      | Logical height of the target surface in pixels.       |
| `params`                  | `NoiseParams` or `NoiseParams[]` | no       | Shared or per kernel parameters.                      |
| `options.customData`      | `Float32Array`                   | no       | Optional per pixel custom positions (x,y,z,w).        |
| `options.frameFullWidth`  | `number`                         | no       | World width used in frame UBO, defaults to `width`.   |
| `options.frameFullHeight` | `number`                         | no       | World height used in frame UBO, defaults to `height`. |
| `options.useCustomPos`    | `number`                         | no       | Overrides `useCustomPos` for this compute.            |
| `options.noiseChoices`    | `number[]` or `string[]`         | no       | Per call override for `noiseChoices`.                 |

Notes:

* If `width` or `height` is larger than `MAX_2D_TILE`, the builder auto tiles into a 2D array texture and processes tiles layer by layer.
* When `params` is an array, its length must match `noiseChoices`. The builder calls `setNoiseParams` for each kernel in sequence.
* Return value is a `GPUTextureView` for the active ping pong 2D array texture.

### 3D compute parameters (`computeToTexture3D`)

Signature:

```ts
await builder.computeToTexture3D(
  width: number,
  height: number,
  depth: number,
  params?: NoiseParams | NoiseParams[],
  options?: Compute3DOptions
);
```

3D specific arguments:

| Argument / field          | Type                             | Required | Description                                       |
| ------------------------- | -------------------------------- | -------- | ------------------------------------------------- |
| `width`                   | `number`                         | yes      | Logical volume width.                             |
| `height`                  | `number`                         | yes      | Logical volume height.                            |
| `depth`                   | `number`                         | yes      | Logical volume depth.                             |
| `params`                  | `NoiseParams` or `NoiseParams[]` | no       | Shared or per kernel parameters.                  |
| `options.id`              | `string` or `number`             | no       | Volume cache id. Reuses or creates a volume.      |
| `options.frameFullWidth`  | `number`                         | no       | World width for frame UBO, defaults to `width`.   |
| `options.frameFullHeight` | `number`                         | no       | World height for frame UBO, defaults to `height`. |
| `options.frameFullDepth`  | `number`                         | no       | World depth for frame UBO, defaults to `depth`.   |
| `options.useCustomPos`    | `number`                         | no       | Overrides `useCustomPos` for this compute.        |
| `options.noiseChoices`    | `number[]` or `string[]`         | no       | Per call override for `noiseChoices`.             |

Notes:

* Volumes are packed into texture3D objects when they fit within `MAX_3D_TILE`. Otherwise the builder chunks them into smaller texture3Ds that respect device buffer limits and `BYTES_PER_VOXEL`.
* World extents and fractional origins keep coordinates continuous across chunks.
* `id` lets you keep several named volumes alive without automatic eviction. Use `destroyVolume(id)` or `destroyAllVolumes()` to free them.
* Return value is either a single 3D `GPUTextureView` or an object `{ views, meta }` for chunked volumes.

### Blit helper parameters

The blit helpers let you preview textures in canvases.

#### `renderTextureToCanvas`

```ts
builder.renderTextureToCanvas(view, canvas, {
  layer?: number,
  channel?: number,
  preserveCanvasSize?: boolean,
  clear?: boolean
});
```

| Field                | Type                | Default  | Description                               |
| -------------------- | ------------------- | -------- | ----------------------------------------- |
| `view`               | `GPUTextureView`    | required | 2D array texture view to sample.          |
| `canvas`             | `HTMLCanvasElement` | required | WebGPU configured canvas.                 |
| `layer`              | `number`            | `0`      | Layer index in the 2D array.              |
| `channel`            | `number`            | `0`      | Channel index from RGBA16F.               |
| `preserveCanvasSize` | `boolean`           | `true`   | If false, resizes canvas to texture size. |
| `clear`              | `boolean`           | `true`   | Whether to clear before drawing.          |

#### `renderTexture3DSliceToCanvas`

```ts
builder.renderTexture3DSliceToCanvas(target, canvas, {
  depth: number,
  slice?: number,
  zNorm?: number,
  channel?: number,
  chunk?: number,
  preserveCanvasSize?: boolean,
  clear?: boolean
});
```

`target` can be a single 3D `GPUTextureView` or the `{ views, meta }` object returned by `computeToTexture3D`.

| Field                | Type      | Default  | Description                                  |
| -------------------- | --------- | -------- | -------------------------------------------- |
| `depth`              | `number`  | required | Logical depth of the volume.                 |
| `slice`              | `number`  | `0`      | Slice index if `zNorm` is not provided.      |
| `zNorm`              | `number`  | `null`   | Normalized depth in [0, 1).                  |
| `channel`            | `number`  | `0`      | Channel index from RGBA16F.                  |
| `chunk`              | `number`  | `0`      | Chunk index when `target.views` is an array. |
| `preserveCanvasSize` | `boolean` | `true`   | If false, resizes canvas to slice size.      |
| `clear`              | `boolean` | `true`   | Whether to clear before drawing.             |

---

## Core concepts

### 1. 2D tiled array textures

Basic pattern:

```js
const builder = new NoiseComputeBuilder(device, device.queue);

const view = await builder.computeToTexture(width, height, params, {
  noiseChoices: ['clearTexture', 'computePerlin']
});

const canvas = document.querySelector('#noise-canvas');
builder.configureCanvas(canvas);
builder.renderTextureToCanvas(view, canvas, {
  layer: 0,
  channel: 0,
  preserveCanvasSize: true
});
```

`NoiseComputeBuilder` will:

* Tile the logical `width x height` surface into one or more array layers when a side exceeds `MAX_2D_TILE`
* Allocate a ping pong pair of `rgba16float` 2D array textures
* Build per tile frame uniforms with origin, tile size, and world extents
* For each tile, run all selected kernels in a single batched compute pass

The compositing model is:

1. Run `clearTexture` to zero the target texture.
2. For each selected mode, update parameters and dispatch that entry point over the storage texture.

Each subsequent kernel sees the accumulated result from previous kernels.

### 2. 3D volumes with chunking

Example:

```js
const volumeView = await builder.computeToTexture3D(
  W, H, D,
  params,
  {
    id: 'shape128',
    frameFullWidth: W,
    frameFullHeight: H,
    frameFullDepth: D,
    noiseChoices: ['clearTexture', 'computePerlin4D', 'computeWorley4D']
  }
);
```

The builder will:

* Use a single 3D texture if the volume fits within `MAX_3D_TILE`
* Otherwise chunk into several 3D textures with per chunk frame uniforms and origins
* Cache the volume in `_volumeCache` under `id`
* Maintain ping pong storage per chunk and reuse it between calls
* Batch all kernel dispatches per chunk into a single command encoder submission

Slice preview:

```js
builder.renderTexture3DSliceToCanvas(volumeView, canvas, {
  depth: D,
  zNorm: 0.5,
  channel: 0,
  chunk: 0
});
```

The UI uses this to show a single toroidal slice in a 3 by 3 mosaic.

### 3. Toroidal 4D kernels

Toroidal behavior in the WGSL is driven entirely by uniform parameters. For 4D kernels the common pattern is:

```js
await builder.computeToTexture3D(
  128, 128, 128,
  { ...params, toroidal: 1 },
  {
    id: 'toroidalDemo',
    noiseChoices: ['clearTexture', 'computePerlin4D', 'computeWorley4D'],
    outputChannel: 1
  }
);
```

The UI mirrors this with constants:

```js
const TOROIDAL_VOLUME_CHOICES = [
  'clearTexture',
  'computePerlin4D',
  'computeWorley4D'
];

const TOROIDAL_VOLUME_ID = 'toroidalDemo';
```

A Z index slider maps to a normalized depth coordinate for the 3D blit shader so you can scrub slices without rerunning `computeToTexture3D`.

---

## Noise parameters, constraints, and overrides

### Global parameters in the UI

The sidebar exposes global controls mapped to the `params` UBO. Typical IDs include:

* `noise-seed`
* `noise-zoom`
* `noise-freq`
* `noise-octaves`
* `noise-lacunarity`
* `noise-gain`
* `noise-xShift`
* `noise-yShift`
* `noise-zShift`
* `noise-threshold`

`readGlobalParamsFromUI()` collects these and returns an object that matches `setNoiseParams`:

```js
{
  seed,
  zoom,
  freq,
  octaves,
  lacunarity,
  gain,
  xShift,
  yShift,
  zShift,
  threshold,
  turbulence,
  seedAngle,
  exp1,
  exp2,
  rippleFreq,
  time,
  warpAmp,
  gaborRadius,
  terraceStep,
  toroidal,
  voroMode,
  edgeK
}
```

### Per mode constraints

`NOISE_CONSTRAINTS_BY_BIT` describes per mode clamps and forced flags. Examples:

* Ridge modes clamp `freq`, `gain`, and `octaves` to keep terrain stable.
* FBM variants clamp `gain` and `octaves`.
* Cellular and Worley variants clamp `threshold`.
* Curl and domain warp modes force `turbulence = 1` and clamp `warpAmp`.
* Gabor filters clamp `gaborRadius`.
* Turbulence mode keeps `gain` near 1 and forces `turbulence = 1`.

`buildParamsForBit(bit, globalParams)` applies these constraints then merges in any overrides from `MODE_OVERRIDES`.

### Per mode overrides in the UI

The override panel provides:

* A select box to choose a mode by index and label
* Numeric fields for:

  * `zoom`
  * `freq`
  * `gain`
  * `octaves`
  * `warpAmp`
  * `threshold`
  * `gaborRadius`
  * `xShift`
  * `yShift`
  * `zShift`

Overrides are stored in `MODE_OVERRIDES[bit]`. When present they apply only to that mode on top of the global parameters and constraint clamps.

---

## UI behavior

The front end wiring lives in `noiseComputeTEst.js`.

On load it:

* Injects `noiseComponent.html` into the document
* Requests a WebGPU adapter and device
* Constructs a `NoiseComputeBuilder`
* Locates the main preview canvas and the nine mosaic canvases
* Configures all canvases for WebGPU

Render path:

* `render-btn` and `apply-res` both call `doRender()`.
* `doRender()` calls:

  * `renderMainNoise(builder, mainCanvas)`
  * `renderToroidalDemo(builder, mosaicCanvases, state)`

### Main noise stack

`renderMainNoise` steps:

1. Reads `res-width` and `res-height`.
2. Reads globals via `readGlobalParamsFromUI()`.
3. Rebuilds the permutation table using the current seed.
4. Collects selected modes from the checkbox list and prepends `clearTexture`.
5. Builds per mode parameters using constraints and overrides.
6. Runs the compositing sequence on the 2D texture.
7. Blits the final result into `#noise-canvas`.
8. Updates `#preview-meta` and `#preview-stats` with resolution, modes, and timing.

### Toroidal 3D volume and mosaic

`renderToroidalDemo`:

1. Reads the same global parameters.
2. Forces `toroidal: 1` in `params`.
3. Calls `computeToTexture3D` with `TOROIDAL_VOLUME_CHOICES` and `id: TOROIDAL_VOLUME_ID`.
4. Stores the returned volume view and timing in `state`.
5. Calls `renderToroidalSlice` to draw the current Z slice into the 3 by 3 mosaic canvases.

Slice controls:

* Range slider `#z-slice`
* Numeric input `#z-slice-num`

Both handlers only reblit from the cached volume. Recompute only happens when `doRender()` runs again.

---

## Resource reuse, disposal, and recycling

The compute helper is built to minimize GPU allocations and make lifetimes explicit.

### Bind group and buffer reuse

* Options, params, perm table, and null position buffers are created once and reused.

* For 2D tiling:

  * Frame uniform buffers and position buffers per tile are created once and reused.
  * Bind groups per tile are recreated only when a dirty flag is set, for example when you change options or params.

* For 3D volumes:

  * Each chunk owns its frame buffer, position buffer, and two bind groups for ping pong.
  * When noise parameters change, the volume is marked dirty and `_recreate3DBindGroups` rebuilds only those bind groups.

This keeps WebGPU object counts stable under interactive use instead of constantly allocating and throwing away bind groups.

### Dummy textures

The builder keeps minimal dummy textures for whatever path is inactive:

* A 2D array dummy bound when only 3D is in use
* A 3D dummy bound when only 2D is in use

These occupy the unused bindings so a single bind group layout can drive both 2D and 3D paths without allocating throwaway textures per dispatch.

### Explicit disposal

For long lived apps or tools that churn many resolutions or volumes, you should explicitly destroy GPU resources.

Helper methods:

* `destroyTexturePair(tid)`
  Destroy a single 2D texture pair and its per tile resources.

* `destroyAllTexturePairs()`
  Destroy all 2D texture pairs managed by the builder.

* `destroyVolume(id)`
  Destroy a single 3D volume by id, including chunks, views, frame buffers, and custom position buffers.

* `destroyAllVolumes()`
  Destroy every 3D volume in the internal cache.

Typical usage:

```js
// When main preview resolution changes a lot
builder.destroyAllTexturePairs();

// When a named 3D volume is no longer needed
builder.destroyVolume('toroidalDemo');

// When tearing down the builder
builder.destroyAllTexturePairs();
builder.destroyAllVolumes();
```

WebGPU will free resources when the page is closed, but explicit destruction is recommended for editors, playgrounds, and long running apps. `BaseNoise` stays on the CPU and does not need disposal.

---

## Minimal example without the UI

If you only want the compute helper:

```js
import { NoiseComputeBuilder, BaseNoise } from './noiseComputeBuilder.js';

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const builder = new NoiseComputeBuilder(device, device.queue);

// permutation table
builder.buildPermTable(123456789);

// options and params
builder.setOptions({
  noiseChoices: ['clearTexture', 'computePerlin'],
  outputChannel: 1
});

builder.setNoiseParams({
  seed: 123456789,
  zoom: 1.0,
  freq: 1.0,
  octaves: 6,
  lacunarity: 2.0,
  gain: 0.5
});

// 2D compute
const canvas = document.querySelector('canvas');
builder.configureCanvas(canvas);

const view2D = await builder.computeToTexture(1024, 1024, null, {});
builder.renderTextureToCanvas(view2D, canvas, { layer: 0, channel: 0 });

// later, clean up
builder.destroyAllTexturePairs();
builder.destroyAllVolumes();
```

You can adopt the same pattern for 3D volumes and slice previews and plug `NoiseComputeBuilder` into your own engine or scene graph without using the demo UI.






