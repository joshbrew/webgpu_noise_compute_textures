
# WebGPU Volumetric Clouds

This is an attempt to replicate "Real-time rendering of volumetric clouds" by Fredrik Haggstrom in pure WebGPU and javascript. The results were a 60-150FPS real time cloud rendering with a custom compute pipeline for very fast iteration. I was impressed!

To run the demo, run `npm install` then `tinybuild` within this repository. `npm i -g tinybuild` if you don't have it. You can also locally host the index.html with prebuilt files.

See: https://www.youtube.com/watch?v=auawNwzHjFo for a live recording.

---

This repo is centered around a reusable WebGPU cloud renderer (`clouds.js` / `CloudComputeBuilder`) plus a small playground UI that lets you tune noise, shading, and temporal reprojection live in the browser.

It is an attempt to implement "Real-time rendering of volumetric clouds" by Fredrik Haggstrom. It includes 4D noise and detail textures for smooth blending of randomized cloud features.

The main pieces are:

* `clouds.js` (shown here as `cloudComputeBuilder.rewrite.withTUNE.js`)  
  A self contained `CloudComputeBuilder` utility that wraps a WebGPU compute pipeline for volumetric clouds.
* `cloudTest.worker.js`  
  A Web Worker that owns the WebGPU device, bakes noise volumes, drives `CloudComputeBuilder`, and renders to canvases.
* `cloudsTestThreaded.js` + `clouds.html`  
  A playground UI that sends RPC calls to the worker and exposes almost all of the tuning controls.

The sections below focus on `CloudComputeBuilder` first, then describe how the playground is wired on top of it.

The lighting is still a work in progress but the core raymarching work is there. the defaults used in the demo are not tuned either, just good enough for demonstration as they can be tweaked for different artistic needs. You can tweak every setting in the demo to see how the physics and lighting change, but it is missing better shadowing and light rim effects. It can definitely work though for some scenes.


---

## 1. CloudComputeBuilder (`clouds.js`)

`CloudComputeBuilder` is a high level helper for most of the WebGPU boilerplate needed to raymarch volumetric clouds. It owns:

* The cloud compute pipeline (`clouds.wgsl`)
* A compact set of uniform buffers for:
  * Cloud rendering parameters (coverage, density, phase, and similar)
  * Tile offsets and noise scaling
  * Camera and view state
  * Light and sun direction
  * Temporal reprojection and performance tuning
  * A dedicated `TUNE` UBO for raymarching knobs
* Bind group layouts for noise textures, history textures, and motion/depth reprojection inputs
* An optional preview pipeline (`cloudsRender.wgsl`) that blits the cloud volume to a canvas

The utility is written so that you can use it either:

* As a pure compute engine that writes into your own textures, or
* Together with the included preview pipeline to draw directly into a WebGPU `canvas` context.

### 1.1 Construction and lifetime

```js
import { CloudComputeBuilder } from './clouds.js';

const cb = new CloudComputeBuilder(device, queue);
```

On construction, `CloudComputeBuilder`:

* Creates the compute pipeline from `clouds.wgsl`
* Allocates all UBOs and staging `ArrayBuffer` views
* Creates default samplers and tiny dummy textures for motion, depth, and history
* Initializes all parameter UBOs with reasonable defaults:

  * `setOptions`
  * `setParams`
  * `setTileScaling`
  * `setSamplingOpts`
  * `setReprojSettings`
  * `setPerfParams`
  * `setSunByAngles`
  * `setBox`
  * `setTuning`

The builder keeps a small hash of each UBO to avoid redundant `queue.writeBuffer` calls.

For cleanup, `CloudComputeBuilder` exposes a `dispose()` method. You should call this when you are done with a cloud instance so that internal GPU resources can be released and references cleared:

```js
const cb = new CloudComputeBuilder(device, queue);

// ... configure and render clouds ...

// On scene or app shutdown:
cb.dispose();
```

The dispose behavior is described in more detail in section `1.11`.

### 1.2 Inputs: noise and external maps

Cloud density is driven by a set of textures that you provide via `setInputMaps`:

```js
cb.setInputMaps({
  weatherView,     // texture_2d_array<f32> for large scale coverage
  shape3DView,     // texture_3d<f32> for base volume structure
  detail3DView,    // texture_3d<f32> for detail breakup
  blueTex,         // optional r8unorm 2D array for blue noise
  blueView,        // or a view into an existing blue noise texture
  motionView,      // optional motion vectors for reprojection
  depthPrevView,   // optional depth buffer for history rejection
  historyPrevView  // previous cloud frame texture_2d_array<f16>
});
```

You can omit some of these:

* If `blueView` is missing, the builder will lazily create a 1x1 neutral blue noise texture.
* If `motionView` or `depthPrevView` are missing, it will bind tiny dummy textures.
* If `historyPrevView` is missing, history sampling falls back to a dummy black texture.

Whenever any of these change, the internal bind group cache is invalidated so the next dispatch sees the new resources.

### 1.3 Outputs: creating and reusing targets

The simplest path is to let `CloudComputeBuilder` own the output texture:

```js
cb.createOutputTexture(width, height, layers, 'rgba16float');
```

This allocates a `texture_2d_array` with `STORAGE_BINDING | TEXTURE_BINDING | COPY_SRC | RENDER_ATTACHMENT` usage, plus a `view` that is exposed as `cb.outView`.

If you already have a storage texture, you can attach it instead:

```js
cb.setOutputView(existingView, {
  width,
  height,
  layers,
  format: 'rgba16float'
});
```

In both cases, `createOutputTexture` or `setOutputView` will:

* Update the frame UBO with the full size and tile size
* Update the reprojection full resolution fields
* Invalidate the compute bind group caches

### 1.4 Cloud parameters (physical and artistic)

`setParams` controls high level cloud appearance and shading. The UBO has space for both core parameters and a few extra toggles:

```js
cb.setParams({
  globalCoverage,          // scalar, 0..1 like how much of the sky is filled
  globalDensity,           // base density multiplier
  cloudAnvilAmount,        // how far tops spread out
  cloudBeer,               // effective extinction coefficient
  attenuationClamp,        // clamp for transmittance
  inScatterG,              // Henyey Greenstein g for forward lobe
  silverIntensity,         // strength of silver lining
  silverExponent,          // sharpness of silver lining
  outScatterG,             // g for backscatter
  inVsOut,                 // mix between forward and back contributions
  outScatterAmbientAmt,    // how much ambient lighting to add
  ambientMinimum,          // floor for ambient lighting
  sunColor: [r, g, b],     // RGB scaling of sun illumination

  densityDivMin,           // safety floor when normalizing density
  silverDirectionBias,     // extra dot bias for silver highlight
  silverHorizonBoost,      // additional highlight near horizon
  shapeScale,              // affects low frequency noise sampling
  detailScale              // affects high frequency noise sampling
});
```

These values are stored in a 96 byte `CloudParams` struct that matches the WGSL layout. You can call `setParams` per frame or only when knobs change, since the builder does its own dirty checking.

### 1.5 Tile and noise mapping

`setTileScaling` controls how world space is mapped into the noise textures:

```js
cb.setTileScaling({
  shapeOffsetWorld: [x, y, z],
  detailOffsetWorld: [x, y, z],
  shapeScale,
  detailScale
});
```

Typical usage is:

* Animate offsets each frame to scroll the noise volumes
* Use `shapeScale` and `detailScale` in combination with `setParams` to tune how much the 3D volumes tile across the sky

The offsets are staged in a dedicated UBO so they can be updated without touching the main cloud parameter block.

### 1.6 Camera, box, and sun

The renderer treats the cloud region as an oriented box in world space that is viewed by a simple pinhole camera.

* `setBox({ center, half, uvScale })`
  Sets the world space box that will be raymarched.
* `setViewFromCamera({ camPos, right, up, fwd, fovYDeg, aspect, planetRadius, cloudBottom, cloudTop, worldToUV, stepBase, stepInc, volumeLayers })`
  Encodes the camera transform, projection, marching step sizes, and vertical layering.
* `setLight({ sunDir, camPos })` or `setSunByAngles({ azimuthDeg, elevationDeg, camPos })`
  Defines the main directional light as a unit vector plus camera position.

The playground computes `camPos`, `right`, `up`, and `fwd` in the worker, then forwards them to `setViewFromCamera` each frame.

### 1.7 Temporal reprojection and performance

Temporal reprojection and compute performance are controlled through two small UBOs:

```js
cb.setReprojSettings({
  enabled,        // 0 or 1
  subsample,      // integer, sample density reduction factor
  sampleOffset,   // current subsample pattern offset
  motionIsNormalized,
  temporalBlend,
  depthTest,
  depthTolerance,
  frameIndex,
  fullWidth,
  fullHeight
});

cb.setPerfParams({
  lodBiasMul,     // global miplevel bias for sampling
  coarseMipBias   // bias used in coarse passes
});
```

The worker maintains a `frameIndex` and uses that to march through a subsample pattern for temporal accumulation. When reprojection is disabled, these uniforms can be left at their defaults.

### 1.8 TUNE UBO: raymarching knobs

`setTuning` writes into a separate `TUNE` uniform block that gathers most of the heavy raymarching and temporal settings in one place. Examples include:

* Step count and minimum or maximum step sizes
* Sun ray marching steps and stride
* Per layer jitter and noise based dither
* Empty space skipping parameters based on weather and low density regions
* Near field density scaling and smoothing
* Far field density attenuation and LOD pushing
* Temporal anti aliasing ranges and clamps
* Final ray smoothing for density and light
* `styleBlend` which interpolates between an older flat look and a newer bulgy shape profile

The idea is that you can treat `TUNE` as a compact preset object. The playground reads tuning values from a panel and sends them directly to the worker, which calls `cb.setTuning`.

### 1.9 Dispatching work

There are several ways to drive the compute shader, depending on how much culling and coarse rendering you want.

* Full frame:

  ```js
  await cb.dispatch({ coarseFactor: 1, wait: true });
  ```

* Only a screen aligned rectangle:

  ```js
  await cb.dispatchRect({
    x, y, w, h,
    coarseFactor: 2,
    wait: true
  });
  ```

* Automatically for the projected cloud box:

  ```js
  await cb.dispatchForBox({
    padPx: 8,
    coarseFactor: 4,
    wait: true
  });
  ```

With `coarseFactor > 1`, the builder:

1. Allocates a low resolution coarse texture.
2. Runs the compute pass against that texture.
3. Upsamples into the full resolution output.

All paths keep the reprojection UBO aligned with the real full resolution size.

### 1.10 Rendering to a canvas

`CloudComputeBuilder` also contains a simple preview pipeline based on `cloudsRender.wgsl`. It is used by the worker to render the storage texture into a WebGPU canvas:

```js
const { pipe, bgl, samp, format } = cb._ensureRenderPipeline('bgra8unorm');
const bg = cb._getOrCreateRenderBindGroup(canvas, bgl, samp);

// Then inside a render pass:
pass.setPipeline(pipe);
pass.setBindGroup(0, bg);
pass.draw(6, 1, 0, 0);
```

`_writeRenderUniforms` fills in a render side UBO with camera, sun, sky color, exposure, and layer index so the preview shader can reconstruct the sky dome shading.

These methods are prefixed as internal but are stable enough for the playground to use.

### 1.11 Cleanup and resource lifetime

`CloudComputeBuilder` owns a set of GPU resources that will live until you release them:

* Output textures and views created through `createOutputTexture`
* Internal coarse, history, and dummy textures
* Samplers and bind groups that are cached for reuse
* Uniform buffers and their staging views
* The preview render pipeline and its uniform buffer

To avoid leaking GPU memory in tools that live for a long time, call `dispose()` when you no longer need a particular cloud builder:

```js
let cb = new CloudComputeBuilder(device, queue);

// configure, dispatch, render...

// On route change, scene unload, or app shutdown:
cb.dispose();
cb = null;
```

A typical `dispose()` implementation should:

* Destroy any textures the builder created internally
  For example:

  * Output texture if it was allocated by `createOutputTexture`
  * Coarse and history textures
  * Dummy textures for motion, depth, history, or blue noise
* Destroy any GPU buffers it owns, including UBOs
* Drop or clear any cached bind groups, bind group layouts, and pipelines
* Mark the instance as inactive so future calls are either safe no ops or clearly reported as errors

User provided textures passed into `setInputMaps` or `setOutputView` remain the responsibility of the caller. `dispose()` should not destroy resources it did not allocate.

---

## 2. Worker and playground

The cloud playground is built on top of this utility using two main files:

* `cloudTest.worker.js`
  Runs in a Web Worker and owns the WebGPU `device`, `queue`, `NoiseComputeBuilder`, and `CloudComputeBuilder`.
* `cloudsTestThreaded.js`
  Runs on the main thread, injects `clouds.html`, wires up DOM controls, and sends RPC messages to the worker.

### 2.1 Worker responsibilities (`cloudTest.worker.js`)

The worker handles:

* WebGPU initialization (`ensureDevice`)
* Baking and caching of all noise textures:

  * `bakeWeather2D` for weather coverage and billow modulation
  * `bakeBlue2D` for blue noise
  * `bakeShape128` for the 128³ shape volume
  * `bakeDetail32` for the 32³ detail volume
* Maintaining tiled offsets in noise space for animated clouds
* Normalizing reprojection settings and managing history textures
* Driving `CloudComputeBuilder` for each frame:

  * Setting tile scaling
  * Binding noise maps, motion, depth, and history
  * Updating camera and sun based on the preview state
  * Calling `dispatch` with a coarse factor
  * Blitting into the main canvas using the preview pipeline
* Running an animation loop when reprojection is enabled, including TAA subsampling logic
* Handling RPC messages from the UI:

  * `init`, `resize`
  * Various `bake*` commands
  * `setTileTransforms`, `setSlice`, `setReproj`, `setTuning`
  * `runFrame`, `startLoop`, `stopLoop`

All communication back to the main thread is done via `postMessage`, with a simple `{ id, ok, data | error }` protocol for RPC responses plus a few `type: 'log'` and `type: 'frame'` notifications.

### 2.2 UI responsibilities (`cloudsTestThreaded.js`)

The UI script:

* Injects the HTML from `clouds.html` into `document.body`
* Spawns the worker as a module worker
* Transfers the main canvas and debug canvases via `transferControlToOffscreen`
* Initializes default parameter values in the form fields
* Manages all RPC calls through a small `rpc(type, payload, transfer)` helper that returns a promise
* Syncs panel values into the global parameter objects:

  * `weatherParams` and `billowParams` for the 2D weather noise
  * `shapeParams` and `detailParams` for the 3D volumes
  * `blueParams` for blue noise
  * `tileTransforms` for shape or detail offsets and scales
  * `preview` for camera, exposure, sky color, and sun angles
  * Tuning fields for the `TUNE` UBO
  * Cloud shading parameters for `setParams`
* Sends tuning updates only when values change, to avoid spamming the worker
* Drives bake flows where changing a panel:

  * Reads the relevant values into the parameter object
  * Calls the appropriate `bake*` RPC in the worker
  * Forces a `setTuning`
  * Triggers a `runFrame` with the full parameter bundle
* Exposes seed buttons that randomize `seed` fields and rebake the corresponding noise
* Keeps a simple busy overlay active while bake or render operations are running
* Handles reprojection animation:

  * A button toggles reprojection on and off
  * When enabling, it sends `setReproj` with a default scale, runs a seeded frame, then tells the worker to `startLoop`
  * When disabling, it sends `stopLoop` and resets the UI state

### 2.3 Panels in the playground

The HTML panels are roughly:

* **Pass selector**
  Switches between Weather, Shape128, Detail32, Clouds, and Preview tabs.
* **Weather panel**
  Controls FBM parameters and billow overlay, plus seed and bake.
* **Shape128 / Detail32 panels**
  Control 3D noise parameters, scales, offsets, velocities, seed, and bake.
* **Cloud parameters panel**
  Controls coverage, density, phase functions, silver lining, ambient, and cloud Beer parameter.
* **Preview panel**
  Controls camera position, yaw, pitch, FOV, exposure, and sky color.
* **Tuning panel**
  Controls the `TUNE` UBO, including steps, jitter, LOD, near and far settings, TAA gates, and `styleBlend`.
* **Debug canvases**
  Render slices of the 3D noise volumes and the weather channels for inspection.

Most inputs are wired with `input` events so they have immediate effect. Larger changes like rebaking 3D volumes go through the bake handlers.

### 2.4 Worker and UI teardown

The playground has its own cleanup path layered on top of `CloudComputeBuilder.dispose()` to avoid leaving a worker and device active after navigation.

On the main thread in `clouds-ui.js`:

* Keep a reference to the worker instance.
* Provide a function that sends a best effort shutdown RPC and then terminates the worker.

Example pattern:

```js
let worker = new Worker(new URL('./cloudTest.worker.js', import.meta.url), {
  type: 'module'
});

async function shutdownCloudPlayground() {
  try {
    await rpc('shutdown', {});
  } catch (e) {
    // Worker might already be gone, safe to ignore
  }
  worker.terminate();
  worker = null;
}
```

You can call `shutdownCloudPlayground()` on page unload, when switching tools, or from your own app shell.

On the worker side in `cloudTest.worker.js`:

* Track references to `device`, `queue`, `CloudComputeBuilder`, `NoiseComputeBuilder`, and any persistent textures.
* Implement a `shutdown` RPC that:

  * Stops the render loop
  * Calls `dispose()` on `CloudComputeBuilder` and any other builders that expose it
  * Drops references to `device`, `queue`, and textures

Example sketch:

```js
let device, queue;
let cloudBuilder, noiseBuilder;
let running = false;

self.onmessage = async event => {
  const { type, payload, id } = event.data;

  if (type === 'shutdown') {
    running = false;

    if (cloudBuilder) {
      cloudBuilder.dispose();
      cloudBuilder = null;
    }
    if (noiseBuilder && typeof noiseBuilder.dispose === 'function') {
      noiseBuilder.dispose();
      noiseBuilder = null;
    }

    device = null;
    queue = null;

    postMessage({ id, ok: true, data: null });
    return;
  }

  // other message types...
};
```

With this in place, the playground lifecycle is:

1. UI script creates the worker and initializes the clouds playground.
2. Worker allocates the device, builds noise, and creates a `CloudComputeBuilder` instance.
3. When the user leaves the page or you switch tools, the UI calls `shutdownCloudPlayground()`.
4. Worker stops its loop, disposes its builders, and clears references, then the main thread terminates the worker.

---

## 3. Running and extending

### 3.1 Requirements

* Browser with WebGPU support (Chrome, Edge, or a recent Canary build).
* Module worker support and `OffscreenCanvas`.
* A bundler setup that can handle:

  * `import` of `.wgsl` shader strings
  * `new Worker(url, { type: 'module' })`
  * Relative imports between `clouds-ui.js`, `cloudTest.worker.js`, and `clouds.js`

### 3.2 Typical integration

At a high level:

1. Bundle and include `clouds-ui.js` from an entry script.
2. The `init()` inside `clouds-ui.js` will:

   * Insert the UI HTML
   * Start the worker
   * Transfer canvases
   * Bake all noise maps once
   * Send initial tuning
   * Render a first frame
3. Use the UI to explore the parameter space and find a set of presets that fit your project.

### 3.3 Using `CloudComputeBuilder` without the playground

If you want to skip the UI and drive the renderer directly, the minimal loop looks like:

```js
const cb = new CloudComputeBuilder(device, queue);

// Provide noise views:
cb.setInputMaps({ weatherView, shape3DView, detail3DView, blueView });

// Allocate an output texture:
cb.createOutputTexture(width, height, 1);

// Set static params:
cb.setParams(myCloudParams);
cb.setTileScaling({
  shapeOffsetWorld: [0, 0, 0],
  detailOffsetWorld: [0, 0, 0],
  shapeScale: 0.1,
  detailScale: 1.0
});
cb.setReprojSettings({ enabled: 0, subsample: 1 });

// Per frame:
function frame(dt) {
  // update offsets, camera, sun
  cb.setTileScaling({
    shapeOffsetWorld: shapeOffset,
    detailOffsetWorld: detailOffset,
    shapeScale,
    detailScale
  });
  cb.setViewFromCamera({ camPos, right, up, fwd, fovYDeg, aspect });
  cb.setLight({ sunDir, camPos });

  // dispatch
  cb.dispatch({ coarseFactor: 2 });

  // preview through your render pass using cb._ensureRenderPipeline(...)
}
```

You can still use `setTuning` to load presets from JSON, even if you are not using the playground sliders.

### 3.4 Cleanup in a host application

When integrating `CloudComputeBuilder` into a larger renderer, treat it like a resource owner with an explicit lifetime.

Example:

```js
// Creation and setup
const cb = new CloudComputeBuilder(device, queue);
cb.setInputMaps({ weatherView, shape3DView, detail3DView, blueView });
cb.createOutputTexture(width, height, layers);
cb.setParams(cloudParams);
cb.setTuning(tuneParams);

// Your render loop...
function frame(dt) {
  // update camera, sun, offsets
  cb.setViewFromCamera(viewParams);
  cb.setLight(lightParams);
  cb.dispatch({ coarseFactor: 2 });
}

// On scene or engine shutdown:
cb.dispose();

// Optionally, if you manage the WebGPU device directly:
device.destroy?.();
```

The important points:

* Call `dispose()` once for each `CloudComputeBuilder` instance you create.
* Only destroy textures and buffers that the builder allocated itself inside `dispose()`.
* Let your engine or platform layer handle device lifetime and any shared textures that are passed in from the outside.

This keeps memory usage predictable whether you are using the interactive playground or embedding the cloud renderer into a larger project.

---

This layout is subject to change. Additional parameters and WGSL structs may continue to evolve as the lighting model is incomplete, but the API is very optimized.

* `CloudComputeBuilder` is the core utility that owns the cloud compute pipeline and all UBO plumbing, with an explicit `dispose()` for cleanup.
* The worker and UI form a thin interactive layer on top for tuning, baking, and previewing presets that you can later reuse in your own renderer.
