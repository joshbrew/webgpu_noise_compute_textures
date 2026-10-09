// Spin is turns/second; evolution is a noise-domain phase in radians/second.
// Wind advects the system, while evolution independently changes its billows.
export function advancePlanetCloudTime(layer, nowSeconds) {
  const previous = layer.animationClock;
  const delta = previous ? Math.max(0, Math.min(0.25, nowSeconds - previous.last)) : 0;
  const time = (previous?.time || 0) + (layer.options.animate === false ? 0 : delta);
  layer.animationClock = {last: nowSeconds, time};
  return time;
}

export function planetCloudMotion(options, time) {
  const value = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const wind = time * value(options.spinSpeed, 0.00065);
  const evolution = time * Math.max(0, value(options.evolutionSpeed, 0.03));
  return {weatherOffsetWorld: [wind, 0, 0], shapeOffsetWorld: [wind, evolution, 0],
    detailOffsetWorld: [wind, 0, 0], evolution};
}
