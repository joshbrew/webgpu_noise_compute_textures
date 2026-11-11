function smooth(lo, hi, value) {
  const t = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

export function studioPolarErosionWeight(row, segments) {
  return smooth(0.0175, 0.0805, Math.min(row, segments - row) / segments);
}

function circularBox(input, output, radius) {
  const length = input.length, width = 2 * radius + 1;
  let sum = 0;
  for (let i = -radius; i <= radius; i++) sum += input[(i + length) % length];
  for (let i = 0; i < length; i++) {
    output[i] = sum / width;
    sum += input[(i + radius + 1) % length] - input[(i - radius + length) % length];
  }
}

// Longitudes crowd together by sin(latitude) toward the ends of the atlas.
// Filter to a comparable physical width in the cap, then fit a tangent
// plane across the very first texels so all approach headings share a slope.
export function regularizeStudioPoles(values, side) {
  const segments = side - 1;
  if (segments < 64) return;
  const bands = Math.floor(Math.asin(0.25) / Math.PI * segments);
  const rowA = new Float32Array(segments), rowB = new Float32Array(segments);
  const cosine = Float64Array.from({ length: segments }, (_, i) => Math.cos(i * 2 * Math.PI / segments));
  const sine = Float64Array.from({ length: segments }, (_, i) => Math.sin(i * 2 * Math.PI / segments));
  const fit = Math.max(2, Math.round(segments * 0.005));
  const spacing = Math.max(1, Math.round(segments * 0.0035));
  const weights = [1, 4, 6, 4, 1];
  const cap = new Float32Array((bands + spacing * 2 + 1) * side);
  for (const pole of [0, segments]) {
    const sign = pole === 0 ? 1 : -1;
    for (let ring = 1; ring <= bands; ring++) {
      const radial = Math.sin(Math.PI * ring / segments);
      const weight = 1 - smooth(0.071, 0.25, radial);
      const radius = Math.min(Math.floor(0.23 * segments), Math.max(1, Math.round((1.5 + 2.3 * weight) / (2 * radial))));
      const at = (pole + sign * ring) * side;
      rowA.set(values.subarray(at, at + segments));
      let broadX = 0, broadZ = 0;
      for (let x = 0; x < segments; x++) {
        broadX += rowA[x] * cosine[x];
        broadZ += rowA[x] * sine[x];
      }
      circularBox(rowA, rowB, radius);
      circularBox(rowB, rowA, radius);
      circularBox(rowA, rowB, radius);
      const width = 2 * radius + 1;
      const fundamental = Math.sin(width * Math.PI / segments) / (width * Math.sin(Math.PI / segments));
      const restore = 2 * (1 - fundamental ** 3) / segments;
      for (let x = 0; x < segments; x++) {
        const broad = restore * (broadX * cosine[x] + broadZ * sine[x]);
        values[at + x] += weight * (rowB[x] + broad - values[at + x]);
      }
      values[at + segments] = values[at];
    }
    // Match the longitudinal filter with a meridional filter. Reflect
    // taps through the pole onto the opposite longitude, not the edge row.
    for (let ring = 0; ring <= bands + spacing * 2; ring++) {
      const at = (pole + sign * ring) * side;
      cap.set(values.subarray(at, at + side), ring * side);
    }
    let average = 0;
    for (const ring of [spacing, 2 * spacing]) {
      let sum = 0;
      for (let x = 0; x < segments; x++) sum += cap[ring * side + x];
      average += (ring === spacing ? 8 : 2) * sum / segments;
    }
    values.fill((6 * cap[0] + average) / 16, pole * side, (pole + 1) * side);
    const half = Math.floor(segments / 2), odd = segments % 2;
    for (let ring = 1; ring <= bands; ring++) {
      const radial = Math.sin(Math.PI * ring / segments);
      const weight = 1 - smooth(0.038, 0.21, radial);
      if (weight <= 0) break;
      const at = (pole + sign * ring) * side;
      for (let x = 0; x < segments; x++) {
        let sum = 0;
        for (let tap = 0; tap < 5; tap++) {
          const target = ring + (tap - 2) * spacing;
          const row = Math.abs(target) * side;
          const col = target < 0 ? (x + half) % segments : x;
          const value = cap[row + col];
          sum += weights[tap] * (target < 0 && odd ? (value + cap[row + (col + 1) % segments]) * 0.5 : value);
        }
        values[at + x] += weight * (sum / 16 - values[at + x]);
      }
      values[at + segments] = values[at];
    }
    const poleHeight = values[pole * side];
    const guide = (pole + sign * fit) * side;
    let mean = 0, xSlope = 0, zSlope = 0;
    for (let x = 0; x < segments; x++) {
      const height = values[guide + x] - poleHeight;
      mean += height;
      xSlope += height * cosine[x];
      zSlope += height * sine[x];
    }
    mean /= segments;
    xSlope *= 2 / segments;
    zSlope *= 2 / segments;
    for (let ring = 1; ring < fit; ring++) {
      const t = Math.sin(Math.PI * ring / segments) / Math.sin(Math.PI * fit / segments);
      const blend = 1 - smooth(0.45, 1, t);
      const at = (pole + sign * ring) * side;
      for (let x = 0; x < segments; x++) {
        const tangent = poleHeight + (xSlope * cosine[x] + zSlope * sine[x]) * t + mean * t * t;
        values[at + x] += blend * (tangent - values[at + x]);
      }
      values[at + segments] = values[at];
    }
  }
}
