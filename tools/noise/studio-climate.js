import { studioHash } from "./studio-ocean.js";

export function studioClimate(seed) {
  const sample = (channel) => studioHash(channel, 0, 0, seed) / 4294967296;
  const frost = sample(47);
  // A zero snowline disables frost. A zero axis keeps it altitude-only.
  if (frost >= 0.55) return [0, 0, 0, 0];
  if (frost >= 0.30) return [0, 0, 0, 1.18 + 0.42 * sample(37)];
  const x = 0.48 * (sample(21) - 0.5), z = 0.48 * (sample(23) - 0.5);
  const length = Math.hypot(x, 1, z);
  return [x / length, 1 / length, z / length, 0.65 + 0.48 * sample(37)];
}

// Match frost_margin in render.wgsl. Altitudes are in baked height units.
export function frostMargin(x, y, z, height, climate) {
  if (climate[3] === 0) return -Infinity;
  const latitude = Math.abs(x * climate[0] + y * climate[1] + z * climate[2]);
  const wind = Math.sin(9 * x + 4 * y - 7 * z + 14 * climate[0]);
  return height - climate[3] + 1.08 * latitude * latitude - 0.115 * wind;
}
