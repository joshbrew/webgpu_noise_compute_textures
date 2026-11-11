// Reseed the cloud field while retaining its authored morphology and lighting.
export function randomizePlanetCloudConfig(config, seed) {
  const next = structuredClone(config);
  next.seed = Math.floor(seed) >>> 0;
  next.noise ??= {};
  for (const [index, key] of ['weather', 'weatherG', 'weatherB', 'shape', 'detail', 'blue'].entries()) {
    next.noise[key] = { ...next.noise[key], seed: (next.seed + (index + 1) * 104729) >>> 0 };
  }
  return next;
}

// Randomize the scene's variation, retaining authored shape, lighting, motion
// and non-color atmosphere settings. A fixed explicit wavelength must not mask
// the new seed's atmosphere color.
export function randomizePlanetSceneConfig(config, seed, gradientCount) {
  const next = structuredClone(config);
  next.seed = Math.floor(seed) >>> 0;
  const count = Math.max(1, Math.floor(gradientCount) || 1);
  const previous = Math.max(0, Math.floor(Number(config.gradientIndex ?? config.gradient) || 0)) % count;
  const hash = (Math.imul(next.seed ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0;
  next.gradientIndex = count > 1 ? (previous + 1 + hash % (count - 1)) % count : 0;
  next.gradient = next.gradientIndex;
  if (Array.isArray(next.noiseConfigs)) next.noiseConfigs = next.noiseConfigs.map((layer, index) => ({
    ...layer, seed: (next.seed + (index + 1) * 15485863) >>> 0,
  }));
  if (next.clouds && typeof next.clouds === 'object') next.clouds = randomizePlanetCloudConfig(next.clouds, next.seed);
  if (next.atmosphere !== false) {
    next.atmosphere = {...next.atmosphere, randomizeWavelengths: true};
    for (const key of ['redWaveLength', 'greenWaveLength', 'blueWaveLength']) delete next.atmosphere[key];
    next.atmosphereRandomizeWavelengths = true;
  }
  return next;
}
