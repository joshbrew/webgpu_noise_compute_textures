import { NoiseComputeBuilder } from "./noiseCompute.js";
import { applyStudioRunoff } from "./studio-watersheds.js";
import erosionWorkerURL from "./studio-erosion.worker.js";
import {
  createStudioPlanetNoise,
  studioPlanetRelief,
  studioLandscapes,
  studioSeed,
  studioSegments,
} from "./studio.js";
export const geologyMode = { mixed: 0, alpine: 1, mesa: 2, volcanic: 3 };

export function studioLayers(seed, geology, erosion, variation, rangeWeight, featureDensity, reseedLayers) {
  const recipe = createStudioPlanetNoise(seed, { reseedLayers });
  const mountainRanges = geology === "alpine" || geology === "mixed";
  const ridgeBoost = geology === "alpine" ? 2.20 : geology === "volcanic" ? 1.36 : 1.75;
  const rollingReduction = mountainRanges ? .48 : geology === "mesa" ? .43 : .25;
  const layers = recipe.layers.map(({ entryPoint, params }, index) => {
    const layer = { ...params, zoom: params.zoom / featureDensity };
    if (erosion && entryPoint === "computeRidgedMultifractal4") {
      const boost = 1 + (ridgeBoost - 1) * rangeWeight;
      layer.scalar = boost;
      layer.transform = 0.36 * (boost - 1);
    } else if (erosion) {
      // Keep the broad continental signal; leave room for the province
      // profiles to shape the hills and valleys within it.
      if (entryPoint === "computeFBM") layer.scalar *= .94;
      if (entryPoint === "computeFBM2") layer.scalar *= 1 - rollingReduction * rangeWeight;
      if (mountainRanges && entryPoint === "computeLanczosBillow") layer.scalar *= 1 - .52 * rangeWeight;
    }
    return { entryPoint, layer, blend: erosion && index > 0 ? variation : 0,
      phase: 13.7 * index + (seed >>> 0) % 997 * 0.13 };
  });
  return { ...recipe, layers, mountainRanges };
}

async function finishRunoff(values, side, settings) {
  if (typeof Worker === "function") {
    let worker;
    try {
      worker = new Worker(erosionWorkerURL);
      return await new Promise((resolve, reject) => {
        worker.onmessage = ({ data }) => resolve(data);
        worker.onerror = reject;
        worker.onmessageerror = reject;
        // Keep the original for hosts whose CSP blocks blob workers.
        worker.postMessage({ values, side, settings });
      });
    } catch {
      // The same bake also runs in Node and hosts that block workers.
    } finally {
      worker?.terminate();
    }
  }
  const { geology, seed, variation, regions, featureDensity,
    oceanCoverage, lunar, craterDetail, cryoGlaciers } = settings;
  return applyStudioRunoff(values, side, geology, seed, variation, regions, featureDensity,
    oceanCoverage, lunar, craterDetail, cryoGlaciers);
}

const halfScales = Float32Array.from({ length: 31 }, (_, exponent) => 2 ** (Math.max(1, exponent) - 25));

function floatFromHalf(word) {
  const exponent = (word >> 10) & 31;
  const fraction = word & 1023;
  const sign = word & 32768 ? -1 : 1;
  if (exponent === 31) return fraction ? NaN : sign * Infinity;
  return sign * halfScales[exponent] * (fraction + (exponent ? 1024 : 0));
}

export async function bakeStudioPlanetNoise(device, options) {
  const builder = new NoiseComputeBuilder(device, device.queue);
  try {
    return await bakeStudioMap(builder, options);
  } finally {
    builder.dispose();
  }
}

export async function bakeStudioMap(
  builder,
  {
    seed = studioSeed,
    segments = studioSegments,
    reseedLayers,
    erosion = false,
    geology = "mixed",
    variation = 0.8,
    rangeWeight = 1,
    landscape = "natural",
    landscapeStrength = 1,
    featureDensity = 1,
    oceanCoverage,
    lunar = false,
    craterDetail = 0,
    cryoGlaciers = false,
    proceduralGuide = false,
  } = {},
) {
  if (!Number.isInteger(segments) || segments < 8 || segments > 1536)
    throw new RangeError("Planet Studio noise needs 8–1536 segments.");
  if (!Number.isInteger(seed))
    throw new RangeError("Use an integer noise seed.");
  if (!Number.isFinite(craterDetail) || craterDetail < 0 || craterDetail > 2)
    throw new RangeError("Lunar crater detail must be between 0 and 2.");
  if (!Number.isFinite(featureDensity) || featureDensity < .0625 || featureDensity > 8)
    throw new RangeError("Feature density must be between 0.0625 and 8.");
  if (oceanCoverage !== undefined && !(oceanCoverage >= 0 && oceanCoverage < 1 && Number.isFinite(oceanCoverage)))
    throw new RangeError("Ocean coverage must be at least 0 and less than 1.");
  if (!Object.hasOwn(geologyMode, geology))
    throw new RangeError("Unknown planet geology.");
  if (!Object.hasOwn(studioLandscapes, landscape) || !Number.isFinite(landscapeStrength) ||
      landscapeStrength < 0 || landscapeStrength > 1)
    throw new RangeError("Use a valid planet landscape and strength from 0 to 1.");
  if (!Number.isFinite(variation) || variation < 0 || variation > 1 ||
      !Number.isFinite(rangeWeight) || rangeWeight < 0.35 || rangeWeight > 1.35)
    throw new RangeError("Planet variation must be 0–1 and range weight 0.35–1.35.");
  const side = segments + 1;
  const { sphereOffset, sphereOffset2, layers, mountainRanges } =
    studioLayers(seed, geology, erosion, variation, rangeWeight, featureDensity, reseedLayers);
  const { device } = builder;
  const textureKey = "planet-studio-height";
  let readback;
  try {
    const { messages } = await builder.shaderModule.getCompilationInfo();
    const errors = messages.filter((message) => message.type === "error");
    if (errors.length)
      throw new Error(errors.map((message) => message.message).join("\n"));
    await builder.computeToTexture(
      side,
      side,
      { scalar: 1, transform: 0 },
      {
        textureKey,
        noiseChoices: ["clearTexture"],
      },
    );
    for (const { entryPoint, layer, blend, phase } of layers) {
      builder.buildPermTable(layer.seed);
      await builder.computeToTexture(side, side, layer, {
        textureKey,
        useCustomPos: 2,
        sphereOffset,
        sphereOffset2,
        spherePolarFade: erosion ? 0.15 : 0,
        sphereBlend: blend,
        sphereBlendPhase: phase,
        noiseChoices: [entryPoint],
      });
    }
    const bytesPerRow = Math.ceil((side * 8) / 256) * 256;
    const planeBytes = bytesPerRow * side;
    readback = device.createBuffer({
      size: planeBytes * (proceduralGuide ? 3 : 1),
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    function capture(plane) {
      const { texture } = builder.getCurrentTextureResource(textureKey);
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer({ texture },
        { buffer: readback, bytesPerRow, offset: planeBytes * plane }, [side, side, 1]);
      device.queue.submit([encoder.finish()]);
    }
    if (erosion) {
      const params = { seed, voroMode: geologyMode[geology] };
      const options = { textureKey, sphereBlend: variation, sphereRangeWeight: rangeWeight,
        sphereLandscape: studioLandscapes[landscape], sphereLandscapeStrength: landscapeStrength,
        sphereFeatureDensity: featureDensity };
      const passes = ["computeStudioSphereMountainErosion",
        ...(mountainRanges && variation === 0 ? [] : ["computeStudioSphereErosion"])];
      if (proceduralGuide) {
        capture(1);
        await builder.computeToTexture(side, side, params, { ...options, noiseChoices: ["computeStudioSphereRelief"] });
        capture(2);
      } else passes.unshift("computeStudioSphereRelief");
      if (passes.length) await builder.computeToTexture(side, side, params, { ...options, noiseChoices: passes });
    }
    capture(0);
    await readback.mapAsync(GPUMapMode.READ);
    const source = new Uint16Array(readback.getMappedRange());
    const area = side * side;
    const rowWords = bytesPerRow / 2;
    const planeWords = planeBytes / 2;
    let values = new Float32Array(area);
    const guide = proceduralGuide ? new Float32Array(2 * area) : null;
    for (let y = 0; y < side; y++) {
      const sourceRow = y * rowWords;
      const targetRow = y * side;
      for (let x = 0; x < side; x++) {
        const value = floatFromHalf(source[sourceRow + x * 4]);
        if (!Number.isFinite(value))
          throw new Error("Planet Studio noise produced a nonfinite height.");
        values[targetRow + x] = value;
      }
      if (guide) {
        for (let x = 0; x < side; x++) {
          const at = sourceRow + x * 4;
          guide[targetRow + x] = floatFromHalf(source[planeWords + at]);
          guide[area + targetRow + x] = floatFromHalf(source[2 * planeWords + at]);
        }
      }
    }
    let regions;
    if (erosion) {
      const regionSide = Math.min(side, 129);
      const cells = new Uint32Array(regionSide ** 2);
      const step = segments / (regionSide - 1);
      for (let y = 0; y < regionSide; y++) {
        const row = Math.round(y * step) * rowWords;
        for (let x = 0; x < regionSide; x++) {
          const at = row + Math.round(x * step) * 4;
          const canyon = Math.round(floatFromHalf(source[at + 1]) * 255);
          const granite = Math.round(floatFromHalf(source[at + 2]) * 255);
          const volcanic = Math.round(floatFromHalf(source[at + 3]) * 255);
          // The render atlas shares a float buffer with the heights. Keep the
          // packed bits in the normal float range on GPUs that flush denormals.
          cells[y * regionSide + x] = 0x3f000000 | canyon | (granite << 8) | (volcanic << 16);
        }
      }
      regions = { side: regionSide, values: cells };
    }
    readback.destroy();
    readback = null;
    let runoff;
    const hostRelief = erosion && lunar
      ? .46 - .25 * Math.min(1, craterDetail) ** 8 - .13 * Math.max(0, craterDetail - 1)
      : 1;
    if (erosion) {
      if (lunar) {
        for (let i = 0; i < values.length; i++) values[i] *= hostRelief;
      }
      const { values: eroded, ...features } = await finishRunoff(values, side, {
        geology, seed, variation, regions, featureDensity, oceanCoverage, lunar, craterDetail, cryoGlaciers,
      });
      values = eroded;
      runoff = features;
    } else {
      // Match the original Studio texture when baking the raw noise stack.
      const blendRows = Math.min(8, Math.floor(segments / 8));
      for (const pole of [0, segments]) {
        for (let row = 1; row <= blendRows; row++) {
          const base = Math.abs(pole - row) * side;
          let mean = 0;
          for (let x = 0; x < segments; x++) mean += values[base + x] / segments;
          const blend = 0.9 * (1 - row / (blendRows + 1)) ** 2;
          for (let x = 0; x < side; x++) values[base + x] += (mean - values[base + x]) * blend;
        }
      }
    }
    let min = Infinity,
      max = -Infinity,
      sum = 0;
    for (const value of values) {
      min = Math.min(min, value);
      max = Math.max(max, value);
      sum += value;
    }
    if (max - min < 1e-7)
      throw new Error("Planet Studio noise produced a flat heightmap.");
    const map = { side, values, min, max, mean: sum / values.length, featureDensity };
    if (guide) {
      // Keep only the displacement that erosion and runoff added to the
      // relief. The mesh evaluates its own base terrain at every vertex.
      for (let i = 0; i < area; i++) guide[area + i] = values[i] - guide[area + i] * hostRelief;
      map.guide = guide;
      map.hostRelief = hostRelief;
    }
    return regions ? { ...map, regions, ...runoff, reliefScale: studioPlanetRelief(seed) } : map;
  } finally {
    readback?.destroy();
    builder.destroyTexturePair(textureKey);
  }
}
