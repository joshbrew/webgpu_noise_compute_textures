// Spin is turns/second; evolution is a noise-domain phase in radians/second.
// Wind advects the system, while evolution independently changes its billows.
export function advancePlanetCloudTime(layer, nowSeconds) {
  const previous = layer.animationClock;
  const delta = previous ? Math.max(0, Math.min(0.25, nowSeconds - previous.last)) : 0;
  const time = (previous?.time || 0) + (layer.options.animate === false ? 0 : delta);
  layer.animationClock = {...previous, last: nowSeconds, time};
  return time;
}

// Pan a continuous Cartesian noise domain, preserving seeds and spherical seams.
// The active renderer calls this once per frame before sampling its weather map.
export function regeneratePlanetCloudWeather(layer, noise, key, time) {
  const clock = layer.animationClock;
  if (!clock) return false;
  const delta = Math.max(0, time - (clock.textureLastTime ?? time));
  clock.textureLastTime = time;
  const options = layer.options;
  if (options.animate === false || options.textureMotion !== 'warp_regenerate') return false;
  const speed = Number(options.textureScrollSpeed ?? 1);
  if (!Number.isFinite(speed) || speed <= 0 || !noise?.resources.has(key)) return false;
  clock.texturePhase = (clock.texturePhase || 0) + delta * 0.012 * Math.min(50, speed);
  return noise.regenerateWeather(key, clock.texturePhase);
}

// Warp phase is independent of global drift; zero speed leaves a still domain.
export function planetCloudWarp(options, time) {
  const number = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  if (options.textureMotion === 'off') return {warpAmount: 0, warpPhase: 0};
  return {warpAmount: Math.max(0, Math.min(2, number(options.warpAmount, 1))),
    warpPhase: time * 0.00065 * 2 * Math.PI * Math.max(0, Math.min(50, number(options.warpSpeed, 1)))};
}

export function planetCloudMotion(options, time) {
  const value = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const wind = time * value(options.spinSpeed, 0.00065);
  const evolution = time * Math.max(0, value(options.evolutionSpeed, 0.03));
  return {weatherOffsetWorld: [wind, 0, 0], shapeOffsetWorld: [wind, evolution, 0],
    detailOffsetWorld: [wind, 0, 0], evolution, ...planetCloudWarp(options, time)};
}
