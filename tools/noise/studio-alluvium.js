export const alluviumAtlasSide = 257;

export function sampleStudioAlluvium(atlas, [x, y, z]) {
  if (!atlas) return 0;
  const { side, values } = atlas;
  const longitude = Math.atan2(z, x) / (2 * Math.PI);
  const u = (longitude - Math.floor(longitude)) * (side - 1);
  const v = Math.atan2(Math.hypot(x, z), y) / Math.PI * (side - 1);
  const i = Math.min(side - 2, Math.floor(u)), j = Math.min(side - 2, Math.floor(v));
  const f = u - i, g = v - j;
  const row = (offset) => values[offset + i] * (1 - f) + values[offset + i + 1] * f;
  return row(j * side) * (1 - g) + row((j + 1) * side) * g;
}
