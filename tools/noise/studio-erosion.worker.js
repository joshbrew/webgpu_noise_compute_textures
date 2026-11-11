import { applyStudioRunoff } from "./studio-watersheds.js";

self.onmessage = ({ data: { values, side, settings } }) => {
  const { geology, seed, variation, regions, featureDensity,
    oceanCoverage, lunar, craterDetail, cryoGlaciers } = settings;
  const terrain = applyStudioRunoff(values, side, geology, seed, variation, regions, featureDensity,
    oceanCoverage, lunar, craterDetail, cryoGlaciers);
  const transfer = [terrain.values.buffer];
  if (terrain.alluvium) transfer.push(terrain.alluvium.values.buffer);
  if (terrain.glacialIce) transfer.push(terrain.glacialIce.values.buffer);
  if (terrain.impactMaterial) transfer.push(terrain.impactMaterial.values.buffer);
  self.postMessage(terrain, transfer);
};
