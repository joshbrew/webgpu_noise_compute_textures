import { sampleStudioPlanetNoise } from "./studio.js";
import { studioHash } from "./studio-ocean.js";

const tau = 2 * Math.PI;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const mix = (a, b, t) => a + (b - a) * t;
function smooth(lo, hi, value) {
  const t = clamp((value - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
}

// Separate event histories from the choice of destination. A history can
// contain a single basin, two impacts of different ages, or a fragment field.
export function createImpactHistory(seed, heightAt, primaryOnly = false) {
  let state = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b) ^ 0xc7fbac21;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const roll = random();
  const count = roll < 0.44 ? 1 : roll < 0.81 ? 2 : 3 + Math.floor(random() * 2);
  const flight = random() * tau;
  const track = [Math.cos(flight), Math.sin(flight)];
  const age = random();
  return Array.from({ length: primaryOnly ? 1 : count }, (_, event) => {
    const primary = event === 0;
    const spread = primary ? 0 : 0.51 + 0.94 * random();
    const lateral = (random() - 0.5) * spread * (count === 2 ? 0.84 : 1.6);
    const x = track[0] * spread - track[1] * lateral;
    const y = track[1] * spread + track[0] * lateral;
    const size = primary ? 0.87 + 0.24 * random() : (count === 2 ? 0.38 : 0.24) + 0.39 * random();
    const wear = primary ? age : 0.12 + 0.70 * random();
    const phase = random() * tau;
    const stretch = 0.70 + 0.30 * random();
    const cos = Math.cos(phase), sin = Math.sin(phase);
    const samples = Array.from({ length: 12 }, (_, i) => {
      const angle = i * tau / 12;
      const a = size * Math.cos(angle), b = size * stretch * Math.sin(angle);
      return heightAt(x + a * cos - b * sin, y + a * sin + b * cos);
    });
    const datum = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const low = samples.indexOf(Math.min(...samples));
    const high = samples.indexOf(Math.max(...samples));
    const depth = (0.41 + 0.38 * random()) * size ** 0.74 * mix(1, 0.69, wear);
    return {
      x, y, size, stretch, cos, sin, datum, depth, wear,
      low: low * tau / 12,
      high: high * tau / 12,
      breach: mix(0.19, 0.66, wear) + 0.12 * random(),
      rim: 0.33 + 0.25 * random(),
      harmonics: 3 + Math.floor(random() * 5),
      warp: 0.042 + 0.075 * random(),
      offset: random() * tau,
      bench: 0.60 + 0.13 * random(),
      rebound: size < 0.48 ? 0 : Math.floor(random() * 4),
      reboundAngle: random() * tau,
      reboundHeight: 0.34 + 0.41 * random(),
    };
  });
}

export function impactHeight(x, y, height, event) {
  const dx = x - event.x, dy = y - event.y;
  const reach = 1.53 * event.size * (1.021 + event.warp);
  if (dx * dx + dy * dy >= reach * reach) return height;
  const u = (dx * event.cos + dy * event.sin) / event.size;
  const v = (dy * event.cos - dx * event.sin) / (event.size * event.stretch);
  const angle = Math.atan2(v, u);
  const fold = Math.cos(event.harmonics * angle + event.offset + 0.7 * Math.sin(3 * angle));
  const rib = Math.cos((event.harmonics + 5) * angle - event.offset);
  const distance = Math.hypot(u, v) / (1 + event.warp * fold + 0.021 * rib);
  if (distance >= 1.53) return height;

  const outlet = smooth(0.76 - 0.20 * event.wear, 0.99, Math.cos(angle - event.low));
  const breakInRim = event.breach * outlet;
  const floor = event.datum - event.depth * (1 - (event.flatFloor ? .065 : .19) * distance * distance);
  const tiltedFloor = floor + event.depth * (event.flatFloor ? .045 : .14) *
    (u * Math.cos(event.high) + v * Math.sin(event.high));
  const bench = smooth(event.bench - 0.10, event.bench, distance) *
    (1 - smooth(event.bench + 0.08, event.bench + 0.18, distance));
  const wall = smooth(0.66 - 0.09 * event.wear, 0.96, distance);
  const crest = smooth(0.84 - 0.06 * event.wear, 1.0, distance) *
    (1 - smooth(1.02, 1.24 + 0.10 * event.wear, distance));
  const rim = event.depth * event.rim * crest * (1 + 0.28 * fold + 0.11 * rib) * (1 - breakInRim);

  const a = u * Math.cos(event.reboundAngle) + v * Math.sin(event.reboundAngle);
  const b = v * Math.cos(event.reboundAngle) - u * Math.sin(event.reboundAngle);
  let uplift = 0;
  if (event.rebound === 1) {
    uplift = 1 - smooth(0.035, 0.33, Math.hypot(a + 0.10, b * 1.35));
  } else if (event.rebound === 2) {
    uplift = Math.max(1 - smooth(0.02, 0.24, Math.hypot(a + 0.17, b - 0.08)),
      0.76 * (1 - smooth(0.025, 0.20, Math.hypot(a - 0.19, b + 0.07))));
  } else if (event.rebound === 3) {
    uplift = (1 - smooth(0.025, 0.14, Math.abs(Math.hypot(a, b * 0.92) - 0.29))) *
      smooth(-0.66, 0.44, fold + 0.50 * rib);
  }
  const fan = smooth(1.0, 1.16, distance) * (1 - smooth(1.16, 1.53, distance));
  const debris = event.depth * 0.11 * fan * (0.57 + 0.26 * fold + 0.15 * rib);
  const basin = tiltedFloor + event.depth * (
    (1.06 - 0.62 * breakInRim) * wall + 0.26 * bench + event.reboundHeight * uplift);
  // Keep some of the host terrain in the floors of older basins.
  const excavated = (1 - smooth(0.89, 1.20, distance)) * (event.flatFloor ? .98 : mix(0.94, 0.72, event.wear));
  return mix(height, basin, excavated) + rim + debris;
}

export function giantImpactSites(seed, lunar = false) {
  const random = (index, field) => studioHash(index, field, 613, seed) / 4294967296;
  const roll = random(-1, 0);
  const count = lunar ? 1 + Math.floor(4 * roll) : roll < .012 ? 2 : roll < .08 ? 1 : 0;
  const start = random(0, 0) * tau;
  return Array.from({ length: count }, (_, i) => {
    const y = mix(-.54, .54, random(i, 1));
    const longitude = start + i * tau / count + mix(-.39, .39, random(i, 2));
    const r = Math.sqrt(1 - y * y);
    const size = i === 0 ? mix(.32, .43, random(i, 3)) : mix(.17, .30, random(i, 3));
    return { center: [r * Math.cos(longitude), y, r * Math.sin(longitude)], longitude, size };
  });
}

export function bakePlanetImpacts(values, side, seed, variation, density = 1, lunar = false,
  basins = variation > 0 || lunar ? giantImpactSites(seed, lunar) : [], craterDetail = 0) {
  if (variation <= 0 && !basins.length) return 0;
  const atlas = { side, values };
  const span = side - 1, latitudeStep = Math.PI / span, longitudeStep = tau / span;
  const random = (site, field) => studioHash(site, field, 187, seed) / 4294967296;
  const history = random(0, 0);
  const craterDensity = lunar ? Math.max(.72, density) : density;
  const population = lunar ? mix(115, 190, random(0, 1)) : history < .48 ? mix(0, 5, random(0, 1)) :
    history < .79 ? mix(12, 31, random(0, 1)) : mix(62, 134, random(0, 1));
  const count = Math.min(640, Math.round(variation * craterDensity ** 2 * population));
  const detail = Math.min(1, craterDetail);
  const saturation = Math.max(0, craterDetail - 1);
  const crowded = detail ** 4;
  const areaScale = Math.max(1, craterDensity);
  const mediumCount = Math.round((crowded * mix(190, 255, history) +
    saturation * areaScale * mix(355, 490, history)) * mix(.72, 1, variation));
  const smallCount = Math.round((detail * mix(295, 440, history) +
    710 * crowded + 860 * saturation * areaScale) * mix(.65, 1, variation));
  const rowSin = Float64Array.from({ length: side }, (_, row) => Math.sin(row * latitudeStep));
  const rowCos = Float64Array.from({ length: side }, (_, row) => Math.cos(row * latitudeStep));
  const columnSin = Float64Array.from({ length: span }, (_, col) => Math.sin(col * longitudeStep));
  const columnCos = Float64Array.from({ length: span }, (_, col) => Math.cos(col * longitudeStep));
  const offsetSin = new Float64Array(span);
  const offsetCos = new Float64Array(span);
  const wrappedColumns = new Int32Array(span);
  let baked = 0;
  // Work from older basins to fresh impacts, so younger craters can cut
  // through earlier rims. Each impact touches only its own atlas window.
  for (let i = -basins.length; i < count + mediumCount + smallCount; i++) {
    const basin = i < 0 ? basins[i + basins.length] : undefined;
    const medium = i >= count && i < count + mediumCount;
    const small = i >= count + mediumCount;
    const sizeRoll = random(i, 2);
    const size = basin?.size ?? (small
      ? (.008 + .067 * sizeRoll ** mix(mix(3, 2.30, crowded), 1.7, saturation)) / Math.sqrt(craterDensity)
      : medium ? (.036 + .092 * sizeRoll ** mix(2.7, 1.7, saturation)) / Math.sqrt(craterDensity)
      : (.014 + .103 * sizeRoll ** 2.3) / craterDensity);
    if (size < 2.1 * latitudeStep || (!basin && size > .28)) continue;
    const margin = saturation > 0 && (medium || small) ? .998 : Math.min(.94, Math.cos(2.0 * size + .04));
    const latitude = Math.acos(basin?.center[1] ?? mix(-margin, margin, random(i, 3)));
    const longitude = basin ? (basin.longitude + tau) % tau : tau * random(i, 4);
    const r = Math.sin(latitude), y = Math.cos(latitude);
    if (size < 1.4 * longitudeStep * r) continue;
    const sin = Math.sin(longitude), cos = Math.cos(longitude);
    const center = [r * cos, y, r * sin];
    const east = [-sin, 0, cos], north = [-y * cos, r, -y * sin];
    const heightAt = (x, z) => {
      const length = Math.hypot(1, x * size, z * size);
      return sampleStudioPlanetNoise(atlas,
        center.map((v, k) => (v + size * (x * east[k] + z * north[k])) / length));
    };
    const [shape] = createImpactHistory(studioHash(i, 5, 187, seed), heightAt, true);
    const age = random(i, 6);
    const wear = basin ? mix(.38, .62, age) : small || medium ? mix(.12, .85, age) :
      mix(.86, .13, (i + age) / Math.max(1, count));
    const depth = basin ? mix(.79, 1.15, size / .43) : shape.depth * mix(1.02, .63, wear) *
      (small ? mix(.12 + .065 * crowded, .51 + .15 * crowded, sizeRoll ** 1.8) + .22 * saturation
        : medium ? mix(.42, .92, sizeRoll) + .22 * saturation
        : mix(.31, .95, (size * craterDensity - .014) / .103));
    const event = basin ? { ...shape, wear, depth, size: 1, stretch: mix(.90, .99, random(i, 7)), warp: .42 * shape.warp,
      breach: .18, rim: .38, rebound: random(i, 8) < .32 ? 3 : 0, reboundHeight: .28, flatFloor: true }
      : { ...shape, wear, depth, stretch: mix(.81, 1, random(i, 7)),
        rim: medium ? Math.max(.49, shape.rim) : shape.rim,
        rebound: small && sizeRoll < .84 ? 0 : shape.rebound };
    const reach = Math.asin(1.53 * event.size * (1.021 + event.warp) * size);
    const coversPole = reach >= Math.min(latitude, Math.PI - latitude);
    const first = Math.max(coversPole ? 0 : 1, Math.ceil((latitude - reach) / latitudeStep));
    const last = Math.min(coversPole ? span : span - 1, Math.floor((latitude + reach) / latitudeStep));
    const halfWidth = coversPole ? Math.floor(span / 2) :
      Math.ceil(Math.asin(clamp(Math.sin(reach) / r, 0, 1)) / longitudeStep) + 1;
    const column = Math.round(longitude / longitudeStep);
    const columns = Math.min(span, 2 * halfWidth + 1);
    for (let k = 0; k < columns; k++) {
      const col = (column - halfWidth + k + span) % span;
      wrappedColumns[k] = col;
      offsetSin[k] = (columnSin[col] * cos - columnCos[col] * sin) / size;
      offsetCos[k] = (columnCos[col] * cos + columnSin[col] * sin) / size;
    }
    for (let row = first; row <= last; row++) {
      const radial = row === 0 || row === span ? 0 : rowSin[row];
      const northward = r * rowCos[row] / size;
      const rowStart = row * side;
      for (let k = 0; k < columns; k++) {
        if (coversPole && y * rowCos[row] + r * radial * offsetCos[k] * size <= 0) continue;
        const u = radial * offsetSin[k];
        const v = northward - y * radial * offsetCos[k];
        const at = rowStart + wrappedColumns[k];
        values[at] = impactHeight(u, v, values[at], event);
      }
      values[rowStart + span] = values[rowStart];
    }
    baked++;
  }
  return baked;
}
