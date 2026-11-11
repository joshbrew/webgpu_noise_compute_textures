export function studioHash(x, y, z, salt) {
  let n = Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^
    Math.imul(z, 0xcb1ab31f) ^ Math.imul(salt, 0x165667b1);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}

export function studioSeaDatum(values, side, seed, { min, max, mean, coverage } = {}) {
  if (coverage === 0) return null;
  const roll = studioHash(0, 0, 0, seed);
  if (coverage === undefined && roll >= 0x80000000) return null;
  if (min === undefined) {
    min = Infinity;
    max = -Infinity;
    let sum = 0;
    for (const height of values) {
      min = Math.min(min, height);
      max = Math.max(max, height);
      sum += height;
    }
    mean = sum / values.length;
  }
  const span = max - min;
  if (span === 0) return min;
  // Count surface area, with narrower cells toward either pole.
  const histogram = new Float64Array(96);
  const stride = Math.max(1, Math.floor((side - 1) / 160));
  let area = 0;
  for (let y = 1; y < side - 1; y += stride) {
    const rowArea = Math.sin((Math.PI * y) / (side - 1));
    for (let x = 0; x < side - 1; x += stride) {
      const bin = Math.min(95, Math.floor((values[y * side + x] - min) / span * 96));
      histogram[bin] += rowArea;
      area += rowArea;
    }
  }
  let remaining = area * (coverage ?? (0.28 + 0.36 * (roll / 0x80000000)));
  for (let bin = 0; bin < histogram.length; bin++) {
    const weight = histogram[bin];
    if (weight > 0 && remaining <= weight) return min + span * (bin + remaining / weight) / 96;
    remaining -= weight;
  }
  return mean;
}

function smooth(lo, hi, value) {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

export function weatherStudioShore(values, side, datum, geology) {
  const span = side - 1;
  const tap = Math.max(1, Math.round(span / 300));
  const fetch = span / 65;
  const slopeScale = 0.023 * span / (2 * Math.PI * tap);
  const source = values.slice();
  function openWater(x, y) {
    const west = Math.floor(x);
    const i = (west + span) % span, east = (i + 1) % span;
    const v = Math.max(0, Math.min(span, y));
    const north = Math.min(span - 1, Math.floor(v));
    const u = x - west, t = v - north;
    const row = north * side;
    const a = source[row + i] * (1 - u) + source[row + east] * u;
    const b = source[row + side + i] * (1 - u) + source[row + side + east] * u;
    return smooth(0.025, 0.22, datum - (a * (1 - t) + b * t));
  }
  for (let y = tap; y <= span - tap; y++) {
    const row = y * side;
    const radial = Math.sin(Math.PI * y / span);
    const polar = smooth(0.08, 0.24, radial);
    if (polar === 0) continue;
    const longitudeScale = 2 * radial;
    const east = Math.max(1, Math.round(tap / longitudeScale));
    for (let x = 0; x < span; x++) {
      const height = source[row + x];
      const relative = height - datum;
      if (relative < -0.20 || relative > 0.19) continue;
      const dx = (source[row + (x + east) % span] - source[row + (x + span - east) % span]) *
        tap / (east * longitudeScale);
      const dy = source[row + x + tap * side] - source[row + x - tap * side];
      const rise = Math.hypot(dx, dy), slope = rise * slopeScale;
      if (slope <= 0.025) continue;
      // Probe seaward along the local fall line and to either side. A nearby
      // barrier blocks the flanks of a bay even when its mouth stays open.
      const ux = dx / rise, uy = dy / rise;
      const offshoreX = x - ux * fetch / longitudeScale, offshoreY = y - uy * fetch;
      const flankX = uy * fetch * 0.58 / longitudeScale, flankY = -ux * fetch * 0.58;
      const open = smooth(0.19, 0.84, 0.46 * openWater(offshoreX, offshoreY) +
        0.27 * (openWater(offshoreX + flankX, offshoreY + flankY) +
          openWater(offshoreX - flankX, offshoreY - flankY)));
      const surf = smooth(0.07, 0.36, slope) * (0.26 + 0.74 * open);
      const shelter = (1 - open) * smooth(0.025, 0.13, slope) * (1 - smooth(0.23, 0.56, slope));
      // Open shores retain a cut toe. Protected shores get a shallower bank
      // and a broad, submerged sediment apron. Preserve the land-water edge.
      const cut = Math.min(relative * 0.65, 0.058 * (1 - smooth(0.035, 0.19, relative)));
      const shelf = Math.min(-relative * 0.64, 0.075 * (1 - smooth(0.055, 0.20, -relative)));
      const bank = Math.min(relative * 0.52, 0.035 * (1 - smooth(0.025, 0.13, relative)));
      const apron = Math.min(-relative * 0.68, 0.078 * (1 - smooth(0.07, 0.20, -relative)));
      let coastalChange = relative >= 0 ? -surf * cut - shelter * bank : surf * shelf + shelter * apron;
      if (geology !== undefined && relative > 0) {
        const bluff = smooth(.025, .075, relative) * (1 - smooth(.12, .19, relative));
        if (geology === "mesa") {
          // A lower bench forms where resistant beds meet an exposed bluff.
          const spacing = .05 + .035 * open;
          const layer = relative / spacing;
          const bench = (Math.floor(layer) + smooth(.16, .76, layer % 1)) * spacing;
          coastalChange += .72 * bluff * surf * (bench - relative);
        } else {
          // Eroded volcanic cliffs shed talus into lower, sheltered slopes.
          const talus = .045 * shelter * (1 - smooth(.07, .15, relative));
          coastalChange += bluff * (talus - .035 * surf);
        }
      }
      if (geology !== undefined && relative < 0) {
        const depth = -relative;
        const shoal = smooth(.012, .065, depth) * (1 - smooth(.09, .20, depth));
        coastalChange += shoal * (geology === "mesa" ? .064 : .041) * shelter;
      }
      const weathered = height + polar * coastalChange;
      values[row + x] = relative >= 0 ? Math.max(datum, weathered) : Math.min(datum, weathered);
    }
    values[row + span] = values[row];
  }
}
