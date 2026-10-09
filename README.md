
# WebGPU Noise Playground

GPU driven noise toolkit for 2D tiled textures and true 3D volumes, plus a small UI for inspecting stacks of noise modes and a toroidal 4D slice viewer.

This repo has two main parts:

- A reusable compute helper: `NoiseComputeBuilder` in `noiseComputeBuilder.js`
- A small test UI: `noiseComputeTest.js` + `noiseComponent.html` for interactive exploration

The helper aims to:

- Compose many noise modes into a single height field using GPU compute
- Generate toroidal 3D volumes from 4D noise kernels
- Visualize 2D array textures and 3D slices in WebGPU canvases
- Reuse GPU resources where possible and dispose them explicitly when you are done

To run the demo, run `npm install` then `tinybuild` within this repository. `npm i -g tinybuild` if you do not have it. You can also locally host `index.html` with prebuilt files.

---

## Noise kernels and coverage

`NoiseComputeBuilder` ships with a broad set of kernels wired into `NoiseComputeBuilder.entryPoints`. These cover classic scalar noise, fractal variants, Voronoi and cellular patterns, curl and domain warp fields, 4D toroidal kernels (for seamless 3D volumes), plus normal map and filter utilities.

Entry points are separate so pipelines compile fast. You never have to use every kernel in one run.

At runtime you pass indices or names in `noiseChoices` to select and stack any subset of these. The UI wires this through bit indexed checkboxes and always includes `clearTexture` as the first pass so every mode composites onto a clean buffer.

### Supported entry points

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
| `computeSimplexFBM`              | Simplex based FBM configuration.                 |
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
| `computeCellular4D`              | 4D Cellular distance field for toroidal volumes. |
| `computeAntiCellular4D`          | Inverted 4D Cellular distance field.             |
| `computeBillow4D`                | 4D Billow variant for toroidal volumes.          |
| `computeAntiBillow4D`            | Inverted 4D Billow variant.                      |
| `computeLanczosBillow4D`         | 4D Billow with Lanczos sharpening.               |
| `computeLanczosAntiBillow4D`     | Inverted 4D Billow with Lanczos accentuation.    |
| `computeFBM4D`                   | 4D FBM for toroidal volumes.                     |
| `computeVoronoi4D`               | 4D Voronoi for toroidal volumes.                 |
| `computeVoronoiBM1_4D`           | 4D Voronoi Brownian blend, configuration one.    |
| `computeVoronoiBM2_4D`           | 4D Voronoi Brownian blend, configuration two.    |
| `computeVoronoiBM3_4D`           | 4D Voronoi Brownian blend, configuration three.  |
| `computeVoronoiBM1_4D_vec`       | 4D Voronoi BM (vector output flavor), config 1.  |
| `computeVoronoiBM2_4D_vec`       | 4D Voronoi BM (vector output flavor), config 2.  |
| `computeVoronoiBM3_4D_vec`       | 4D Voronoi BM (vector output flavor), config 3.  |
| `computeWorleyBM1_4D`            | 4D Worley Brownian blend, configuration one.     |
| `computeWorleyBM2_4D`            | 4D Worley Brownian blend, configuration two.     |
| `computeWorleyBM3_4D`            | 4D Worley Brownian blend, configuration three.   |
| `computeWorleyBM1_4D_vec`        | 4D Worley BM (vector output flavor), config 1.   |
| `computeWorleyBM2_4D_vec`        | 4D Worley BM (vector output flavor), config 2.   |
| `computeWorleyBM3_4D_vec`        | 4D Worley BM (vector output flavor), config 3.   |
| `computeCellularBM1_4D`          | 4D Cellular Brownian blend, configuration one.   |
| `computeCellularBM2_4D`          | 4D Cellular Brownian blend, configuration two.   |
| `computeCellularBM3_4D`          | 4D Cellular Brownian blend, configuration three. |
| `computeCellularBM1_4D_vec`      | 4D Cellular BM (vector output flavor), config 1. |
| `computeCellularBM2_4D_vec`      | 4D Cellular BM (vector output flavor), config 2. |
| `computeCellularBM3_4D_vec`      | 4D Cellular BM (vector output flavor), config 3. |
| `computeTerraceNoise4D`          | 4D terrace shaping for toroidal volumes.         |
| `computeFoamNoise4D`             | 4D foam noise for toroidal volumes.              |
| `computeTurbulence4D`            | 4D turbulence wrapper for toroidal volumes.      |
| `computeGauss5x5`                | Five by five Gaussian blur filter.               |
| `computeNormal`                  | Scalar normal map from height channel.           |
| `computeNormal8`                 | Eight tap normal map estimator.                  |
| `computeSphereNormal`            | Normal from spherical height interpretation.     |
| `computeNormalVolume`            | Volume normal field from 3D scalar.              |
| `clearTexture`                   | Clear target texture to zero.                    |

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
  - 4D toroidal kernels
  - Filters, normals, and `clearTexture`

- `noiseBlit.wgsl`  
  Vertex and fragment shaders for previewing 2D array layers into a WebGPU canvas.

- `noiseBlit3D.wgsl`  
  Vertex and fragment shaders for previewing Z slices from a 3D volume.

### Test UI

- `noiseUI.js`

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
// noiseUI.js
import html from "./noiseComponent.html";
import { NoiseComputeBuilder } from "./noiseComputeBuilder.js";

document.body.insertAdjacentHTML("afterbegin", html);
````

Adapt this pattern to your bundler or framework as needed.

---

## Parameters and inputs

`NoiseComputeBuilder` exposes three main parameter layers:

1. Shared noise parameters (`setNoiseParams`)
2. Compute options and IO flags (`setOptions`)
3. Per call options for 2D and 3D (`computeToTexture`, `computeToTexture3D`)

### Shared noise parameters (`setNoiseParams`)

These drive the WGSL `params` uniform and are used by both 2D and 3D compute paths.

| Field         | Type  | Default           | Description                                                 |
| ------------- | ----- | ----------------- | ----------------------------------------------------------- |
| `seed`        | `u32` | `Date.now() \| 0` | Seed for `BaseNoise` permutation table.                     |
| `zoom`        | `f32` | `1.0`             | Global UV scale, larger zoom gives coarser features.        |
| `freq`        | `f32` | `1.0`             | Base frequency in noise space.                              |
| `octaves`     | `u32` | `8`               | Number of FBM or multifractal layers.                       |
| `lacunarity`  | `f32` | `2.0`             | Frequency multiplier per octave.                            |
| `gain`        | `f32` | `0.5`             | Amplitude multiplier per octave.                            |
| `xShift`      | `f32` | `0.0`             | Offset in X for noise domain.                               |
| `yShift`      | `f32` | `0.0`             | Offset in Y for noise domain.                               |
| `zShift`      | `f32` | `0.0`             | Offset in Z or slice offset.                                |
| `turbulence`  | `u32` | `0`               | If nonzero, use absolute valued turbulence.                 |
| `seedAngle`   | `f32` | `0.0`             | Angle used by anisotropic kernels.                          |
| `exp1`        | `f32` | `1.0`             | Primary exponent shaping for curves.                        |
| `exp2`        | `f32` | `0.0`             | Secondary exponent shaping term.                            |
| `threshold`   | `f32` | `0.1`             | Threshold for Voronoi derived outputs and pattern cuts.     |
| `rippleFreq`  | `f32` | `10.0`            | Base ripple frequency in ripple modes.                      |
| `time`        | `f32` | `0.0`             | Time parameter for animated modes.                          |
| `warpAmp`     | `f32` | `0.5`             | Domain warp amplitude when used.                            |
| `gaborRadius` | `f32` | `4.0`             | Radius for Gabor kernel sampling.                           |
| `terraceStep` | `f32` | `8.0`             | Step size for terrace quantization.                         |
| `toroidal`    | `u32` | `0`               | If `1`, use toroidal addressing in kernels that support it. |
| `voroMode`    | `u32` | `0`               | Voronoi derived output selector (see below).                |
| `edgeK`       | `f32` | `0.0`             | Voronoi edge scale/strength/feather, depends on mode.       |

You can pass a single object and share it across all kernels or pass an array of param objects per call so each kernel gets different settings.

#### Voronoi derived outputs (`voroMode`)

`voroMode` selects which derived value to return from the same F1/F2 Voronoi sample. `threshold` and `edgeK` are used for edge and mask modes.

| `voroMode` | Name                     | Output semantics                                                                      |
| ---------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `0`        | `VORO_CELL`              | Cell value (granite).                                                                 |
| `1`        | `VORO_F1`                | F1 distance (nearest feature).                                                        |
| `2`        | `VORO_INTERIOR`          | `gap = F2 - F1`.                                                                      |
| `3`        | `VORO_EDGES`             | `clamp(gap * edgeK)` (if `edgeK <= 0` uses default scale).                            |
| `4`        | `VORO_EDGE_THRESH`       | `(gap >= threshold) ? gap : 0`.                                                       |
| `5`        | `VORO_FLAT_SHADE`        | Cells = 1, edges = 0 where edges defined by `(gap < threshold)`, feather = `edgeK`.   |
| `6`        | `VORO_FLAT_SHADE_INV`    | Edges = 1, cells = 0 where edges defined by `(gap < threshold)`, feather = `edgeK`.   |
| `7`        | `VORO_INTERIOR_SQ`       | `gapSq = F2^2 - F1^2` (legacy cellular3D semantics).                                  |
| `8`        | `VORO_EDGES_SQ`          | `clamp(gapSq * edgeK)` (if `edgeK <= 0` uses default scale).                          |
| `9`        | `VORO_EDGE_THRESH_SQ`    | `(gapSq >= threshold) ? gapSq : 0`.                                                   |
| `10`       | `VORO_FLAT_SHADE_SQ`     | Cells = 1, edges = 0 where edges defined by `(gapSq < threshold)`, feather = `edgeK`. |
| `11`       | `VORO_FLAT_SHADE_INV_SQ` | Edges = 1, cells = 0 where edges defined by `(gapSq < threshold)`, feather = `edgeK`. |
| `12`       | `VORO_F1_THRESH`         | `(F1 >= threshold) ? F1 : 0`.                                                         |
| `13`       | `VORO_F1_MASK`           | Smooth mask 0..1 ramp from `threshold` to `threshold + edgeK`.                        |
| `14`       | `VORO_F1_MASK_INV`       | Inverted smooth mask.                                                                 |
| `15`       | `VORO_EDGE_RCP`          | `1 / (1 + gap * edgeK)`.                                                              |
| `16`       | `VORO_EDGE_RCP_SQ`       | `1 / (1 + gapSq * edgeK)`.                                                            |

Notes:

* `threshold` is used by the threshold, flat shade, and mask modes.
* `edgeK` acts as scale (edges) or feather width (flat shade and mask modes). For modes 3 and 8, if `edgeK <= 0` the shader uses a default scale.

