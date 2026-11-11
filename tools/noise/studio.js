export const studioSeed = 123456789;
export const studioSegments = 1000;
export const studioLandscapes = Object.freeze({ natural: 0, mesas: 1, fractal: 2, mosaic: 3 });

export function studioMosaic(seed) {
  const key = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const selection = key >>> 30;
  const phase = (key & 65535) * (2 * Math.PI / 65536);
  const weight = (v) => {
    const t = Math.max(0, Math.min(1, (v - 0.15) / 0.63));
    return t * t * (3 - 2 * t);
  };
  return {
    mesas: selection !== 1,
    fractal: selection !== 0,
    // Match studio_mosaic in noiseCompute.wgsl so Explore region sees the bake's regions.
    score([x, y, z]) {
      const bend = Math.sin(-3.4 * x + 6.2 * y + 4.1 * z - phase);
      const belt = 0.72 * Math.sin(7.2 * x - 4.6 * y + 3.8 * z + phase + 0.94 * bend) +
        0.28 * Math.sin(11.8 * x + 5.7 * y - 7.3 * z - phase);
      return [selection === 1 ? 0 : weight(belt), selection === 0 ? 0 : weight(-belt)];
    },
  };
}

export function studioPlanetRelief(seed) {
  let value = (seed ^ 0x50a86d25) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  const roll = ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  return 0.24 + 0.88 * roll ** 1.12;
}

export function studioRegionWeights({ regions }, [x, y, z], geology) {
  if (!regions) {
    if (geology === "mesa") return [0, 1, 0, 0];
    if (geology === "volcanic") return [0, 0, 0, 1];
    return [1, 0, 0, 0];
  }
  const { side, values } = regions;
  const span = side - 1;
  const horizontal = Math.hypot(x, z);
  const longitude = horizontal > 0 ? Math.atan2(z, x) / (2 * Math.PI) : 0;
  const u = (longitude - Math.floor(longitude)) * span;
  const v = Math.atan2(horizontal, y) * span / Math.PI;
  const col = Math.floor(u), row = Math.floor(v);
  const nextRow = Math.min(span, row + 1);
  const dx = u - col, dy = v - row;
  const a = values[row * side + col], b = values[row * side + Math.min(span, col + 1)];
  const c = values[nextRow * side + col], d = values[nextRow * side + Math.min(span, col + 1)];
  const band = (shift) => (
    ((a >>> shift) & 255) * (1 - dx) * (1 - dy) +
    ((b >>> shift) & 255) * dx * (1 - dy) +
    ((c >>> shift) & 255) * (1 - dx) * dy +
    ((d >>> shift) & 255) * dx * dy
  ) / 255;
  const canyon = band(0), granite = band(8), volcanic = band(16);
  const total = canyon + granite + volcanic;
  const scale = 1 / Math.max(1, total);
  return [Math.max(0, 1 - total), canyon * scale, granite * scale, volcanic * scale];
}

// Bake a low-pass atlas for views where a full-resolution texel is smaller
// than the projected footprint. The duplicate longitude and poles stay closed.
export function coarsenStudioPlanetNoise({ side, values }) {
  const span = side - 1;
  const segments = Math.max(1, Math.floor(span / 4));
  const coarseSide = segments + 1;
  const coarse = new Float32Array(coarseSide ** 2);
  const weights = [1, 4, 6, 4, 1];
  const rows = new Float32Array(side * segments);
  for (let x = 0; x < segments; x++) {
    const center = Math.round(x * span / segments);
    const columns = weights.map((_, tap) => (center + (tap - 2) * 2 + span) % span);
    for (let y = 0; y < side; y++) {
      const row = y * side;
      let sum = 0;
      for (let tap = 0; tap < 5; tap++) sum += weights[tap] * values[row + columns[tap]];
      rows[y * segments + x] = sum / 16;
    }
  }
  coarse.fill(values[0], 0, coarseSide);
  coarse.fill(values[span * side], segments * coarseSide);
  for (let y = 1; y < segments; y++) {
    const center = Math.round(y * span / segments);
    const offsets = weights.map((_, tap) => Math.min(span, Math.max(0, center + (tap - 2) * 2)) * segments);
    for (let x = 0; x < segments; x++) {
      let sum = 0;
      for (let tap = 0; tap < 5; tap++) sum += weights[tap] * rows[offsets[tap] + x];
      coarse[y * coarseSide + x] = sum / 16;
    }
    coarse[y * coarseSide + segments] = coarse[y * coarseSide];
  }
  return coarse;
}

// Planet Studio's default stack, including its seeded sphere domain offsets.
export function createStudioPlanetNoise(
  seed = studioSeed,
  { reseedLayers = seed !== studioSeed } = {},
) {
  let state = seed >>> 0;
  function random() {
    state += 0x6d2b79f5;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }
  const signed = (magnitude) =>
    (random() < 0.5 ? -1 : 1) * random() * magnitude;
  const sphereOffset = signed(0.3);
  const sphereOffset2 = signed(0.1);
  const ridgeShift = random() * 0.4 - 0.2 + 0.65;
  const billowShift = random() * 0.2 - 0.1 + 0.65;
  const fbmShift = random() * 0.2 - 0.1;
  const zoom = 2.4;
  const layers = [
    ["computeFBM", 0.8, 6, 2, 0.75, fbmShift + 2],
    ["computeFBM2", 1, 8, 2, 0.75, fbmShift + 1.3],
    ["computeVoronoiTileNoise", 0.35, 2, 2, 0.9, ridgeShift],
    ["computeRidgedMultifractal4", 0.2, 6, 2.1, 1, ridgeShift],
    ["computeLanczosBillow", 0.5, 6, 2, 1, billowShift],
  ].map(([entryPoint, scale, octaves, lacunarity, scalar, shift], index) => ({
    entryPoint,
    params: {
      seed: reseedLayers ? (seed + (index + 1) * 15485863) >>> 0 : seed,
      zoom: zoom * scale,
      freq: 1,
      octaves,
      lacunarity,
      gain: 0.5,
      scalar,
      transform: 0,
      xShift: shift,
      yShift: shift,
      zShift: shift,
      seedAngle: Math.PI / 2,
      threshold: 0.3,
      voroMode: 2,
      warpAmp: 0,
    },
  }));
  return { seed, sphereOffset, sphereOffset2, layers };
}

function cubic(a, b, c, d, t) {
  return (
    b +
    t *
      (0.5 * (c - a) +
        t *
          (a - 2.5 * b + 2 * c - 0.5 * d + t * (0.5 * (d - a) + 1.5 * (b - c))))
  );
}
function cubicSlope(a, b, c, d, t) {
  return 0.5 * (c - a) +
    t * (2 * (a - 2.5 * b + 2 * c - 0.5 * d) + t * (1.5 * (d - a) + 4.5 * (b - c)));
}

// The last longitude column duplicates the first. Cubic interpolation wraps
// across that seam and gives the near terrain a continuous broad slope.
export function sampleStudioPlanetNoise({ side, values }, [x, y, z], slope) {
  const horizontal = Math.hypot(x, z);
  const longitude = horizontal > 0 ? Math.atan2(z, x) / (2 * Math.PI) : 0;
  const u = (longitude - Math.floor(longitude)) * (side - 1);
  const v = (Math.atan2(horizontal, y) * (side - 1)) / Math.PI;
  const j = Math.floor(v);
  const wrap = (column) => (column + side - 1) % (side - 1);
  const ring = (latitude, longitude, sample = cubic) => {
    if (latitude < 0 || latitude >= side) {
      latitude = latitude < 0 ? -latitude : 2 * (side - 1) - latitude;
      longitude += (side - 1) * 0.5;
    }
    const col = Math.floor(longitude);
    const base = latitude * side;
    return sample(
      values[base + wrap(col - 1)],
      values[base + wrap(col)],
      values[base + wrap(col + 1)],
      values[base + wrap(col + 2)],
      longitude - col,
    );
  };
  const row = (offset, sample = cubic) => ring(j + offset, u, sample);
  const a = row(-1), b = row(0), c = row(1), d = row(2);
  if (slope && horizontal > 1e-5) {
    const du = cubic(row(-1, cubicSlope), row(0, cubicSlope), row(1, cubicSlope), row(2, cubicSlope), v - j);
    const dv = cubicSlope(a, b, c, d, v - j);
    const uScale = du / (2 * Math.PI * horizontal ** 2);
    const vScale = dv / (Math.PI * horizontal);
    const scale = (side - 1) * 0.023;
    slope[0] = (-z * uScale + x * y * vScale) * scale;
    slope[1] = -horizontal * horizontal * vScale * scale;
    slope[2] = (x * uScale + z * y * vScale) * scale;
  } else if (slope) {
    const span = side - 1;
    const first = y > 0 ? 1 : span - 1;
    const scale = 0.023 / (2 * Math.sin(Math.PI / span));
    slope[0] = (ring(first, 0) - ring(first, span * 0.5)) * scale;
    slope[1] = 0;
    slope[2] = (ring(first, span * 0.25) - ring(first, span * 0.75)) * scale;
  }
  return cubic(a, b, c, d, v - j);
}
