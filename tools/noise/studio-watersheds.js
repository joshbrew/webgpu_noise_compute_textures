import { erodeSphericalTerrain } from "./studio-erosion.js";
import { carveStudioGlacialValleys } from "./studio-glaciers.js";
import { regularizeStudioPoles, studioPolarErosionWeight } from "./studio-poles.js";
import { studioHash, studioSeaDatum, weatherStudioShore } from "./studio-ocean.js";
import { frostMargin, studioClimate } from "./studio-climate.js";
import { alluviumAtlasSide } from "./studio-alluvium.js";
import { studioRegionWeights } from "./studio.js";
import { bakePlanetImpacts, giantImpactSites } from "./studio-impacts.js";

export function applyStudioRunoff(
  values, side, geology, seed, variation, regions, featureDensity = 1,
  oceanCoverage, lunar = false, craterDetail = 0, cryoGlaciers = false,
) {
  const impactBasins = lunar || variation > 0 ? giantImpactSites(seed, lunar) : [];
  if (lunar) {
    regularizeStudioPoles(values, side);
    const depositSide = Math.min(side, alluviumAtlasSide);
    const impactMaterial = craterDetail >= 1 ? { side: depositSide, values: new Float32Array(depositSide ** 2) } : undefined;
    const sampleIndex = (i) => Math.round(i * (side - 1) / (depositSide - 1));
    if (impactMaterial) {
      for (let y = 0; y < depositSide; y++) {
        for (let x = 0; x < depositSide; x++)
          impactMaterial.values[y * depositSide + x] = values[sampleIndex(y) * side + sampleIndex(x)];
      }
    }
    bakePlanetImpacts(values, side, seed, variation, featureDensity, true, impactBasins, craterDetail);
    if (impactMaterial) {
      // Signed displacement distinguishes rim material from excavated floors at any camera distance.
      for (let y = 0; y < depositSide; y++) {
        for (let x = 0; x < depositSide; x++) {
          const at = y * depositSide + x;
          impactMaterial.values[at] = values[sampleIndex(y) * side + sampleIndex(x)] - impactMaterial.values[at];
        }
      }
    }
    const glacialIce = cryoGlaciers ? { side: depositSide, values: new Float32Array(depositSide ** 2) } : undefined;
    const glacialSites = glacialIce ? carveStudioGlacialValleys(values, side, seed, .87, glacialIce) : [];
    return { values, glacialSites, glacialIce, impactMaterial, impactBasins, ocean: { seed, datum: null } };
  }
  bakePlanetImpacts(values, side, seed, variation, featureDensity, false, impactBasins);
  const sea = studioSeaDatum(values, side, seed, { coverage: oceanCoverage });
  const sedimentSide = Math.min(side, alluviumAtlasSide);
  const alluvium = { side: sedimentSide, values: new Float32Array(sedimentSide ** 2) };
  const inversion = regions && variation > 0 ? { seed, variation, regions, sites: [] } : null;
  erodeRegionalWatersheds(values, side, geology === "volcanic" ? .84 : 1.32, sea,
    studioClimate(seed), alluvium, inversion, { seed, geology, regions });
  erodeSphericalTerrain(values, side, geology === "alpine" ? 0.94 : 0.74);
  if (sea !== null) weatherStudioShore(values, side, sea, oceanCoverage === undefined ? undefined : geology);
  regularizeStudioPoles(values, side);
  return { values, impactBasins, alluvium, invertedRidges: inversion?.sites, ocean: { seed, datum: sea } };
}

// Route water over a smoothed globe before adding the local gullies. A
// priority flood finds the lowest spill path out of each enclosed basin.
export function erodeRegionalWatersheds(values, side, strength = 1, seaDatum = null, climate = null, alluvium = null, inversion = null, terrain = null) {
  const span = side - 1;
  const width = Math.min(256, Math.floor(span / 3.5));
  if (width < 12) return values;
  const count = width * (width - 1);
  const step = span / width;
  const heights = new Float32Array(count);
  const rowArea = Float32Array.from({ length: width + 1 }, (_, y) =>
    Math.sin((Math.PI * y) / width),
  );
  const wrap = (x, period) => (x + period) % period;
  const heightAt = (x, y) =>
    values[Math.round(y) * side + wrap(Math.round(x), span)];

  for (let y = 1; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const u = x * step, v = y * step, h = step * 0.48;
      heights[(y - 1) * width + x] =
        0.4 * heightAt(u, v) +
        0.15 * (heightAt(u - h, v) + heightAt(u + h, v) +
          heightAt(u, v - h) + heightAt(u, v + h));
    }
  }

  const sorted = heights.slice().sort();
  const baseLevel = sorted[Math.floor(count * 0.20)];
  const spill = new Float32Array(count).fill(Infinity);
  const receiver = new Int32Array(count).fill(-1);
  const order = new Uint32Array(count);
  const rank = new Uint32Array(count).fill(count);
  const flow = new Float32Array(count);
  const heap = new Uint32Array(count);
  let length = 0;
  function push(id) {
    let i = length++;
    while (i) {
      const parent = (i - 1) >> 1;
      if (spill[heap[parent]] <= spill[id]) break;
      heap[i] = heap[parent];
      i = parent;
    }
    heap[i] = id;
  }
  function pop() {
    const first = heap[0], last = heap[--length];
    let i = 0;
    while (i * 2 + 1 < length) {
      let child = i * 2 + 1;
      if (child + 1 < length && spill[heap[child + 1]] < spill[heap[child]]) child++;
      if (spill[last] <= spill[heap[child]]) break;
      heap[i] = heap[child];
      i = child;
    }
    heap[i] = last;
    return first;
  }
  for (let i = 0; i < count; i++) {
    if (heights[i] <= baseLevel) {
      spill[i] = heights[i];
      push(i);
    }
  }
  for (let at = 0; length; at++) {
    const id = pop();
    const x = id % width, y = Math.floor(id / width) + 1;
    const area = rowArea[y];
    const eastWest = Math.max(0.08, 2 * area);
    const diagonal = 1 / Math.hypot(eastWest, 1);
    order[at] = id;
    rank[id] = at;
    flow[id] = area;
    let best = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const row = y + dy;
      if (row < 1 || row >= width) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const other = (row - 1) * width + wrap(x + dx, width);
        if (spill[other] === Infinity) {
          spill[other] = Math.max(heights[other], spill[id] + 0.00002);
          receiver[other] = id;
          push(other);
        } else if (rank[other] < at) {
          const slope = (spill[id] - spill[other]) *
            (dy ? (dx ? diagonal : 1) : 1 / eastWest);
          if (slope > best) {
            best = slope;
            receiver[id] = other;
          }
        }
      }
    }
  }
  const mainInflow = alluvium && new Float32Array(count);
  const junction = alluvium && new Float32Array(count);
  const areaScale = (1000 / width) ** 2;
  for (let i = count - 1; i >= 0; i--) {
    const id = order[i], downstream = receiver[id];
    if (downstream < 0) continue;
    const discharge = flow[id];
    flow[downstream] += discharge;
    if (junction) {
      junction[downstream] = Math.max(junction[downstream], Math.min(mainInflow[downstream], discharge));
      mainInflow[downstream] = Math.max(mainInflow[downstream], discharge);
    }
  }
  if (junction) {
    const minTributary = (2 ** 6.75 - 1) / areaScale;
    for (let id = 0; id < count; id++) {
      // Widen at the meeting of established valleys. A lone trunk that
      // gathers many tiny gullies keeps its ordinary cross section.
      const tributary = junction[id];
      if (tributary <= minTributary) {
        junction[id] = 0;
        continue;
      }
      const size = Math.min(1, (Math.log2(1 + tributary * areaScale) - 6.75) / 4.6);
      const balance = Math.min(1, tributary / Math.max(1, mainInflow[id] * 0.58));
      junction[id] = size * balance;
    }
  }

  // Sweep a valley profile along each trunk and tributary. Take the deepest
  // cut at junctions so neighboring branches cannot stack into a spike.
  const cut = new Float32Array(side * side);
  const deposit = seaDatum === null && !alluvium ? null : new Float32Array(side * side);
  const ice = climate && climate[3] !== 0 && new Float32Array(count);
  const resistance = inversion && new Float32Array(count);
  const canyons = terrain && (terrain.regions || terrain.geology === "mesa") && new Float32Array(count);
  const eastShift = canyons && new Float32Array(count);
  const southShift = canyons && new Float32Array(count);
  const preserved = inversion && new Float32Array(side * side);
  const inverted = [];
  if (ice || resistance || canyons) {
    const cos = Float64Array.from({ length: width }, (_, x) => Math.cos(2 * Math.PI * x / width));
    const sin = Float64Array.from({ length: width }, (_, x) => Math.sin(2 * Math.PI * x / width));
    const phase = inversion ? studioHash(53, 0, 0, inversion.seed) * (2 * Math.PI / 4294967296) : 0;
    const bendPhase = canyons ? studioHash(61, 0, 0, terrain.seed) * (2 * Math.PI / 4294967296) : 0;
    const bendFrequency = Math.min(1, width / 160);
    for (let y = 1; y < width; y++) {
      const radial = rowArea[y], vertical = Math.cos(Math.PI * y / width);
      for (let x = 0; x < width; x++) {
        const at = (y - 1) * width + x;
        const height = heights[at];
        const worldX = radial * cos[x], worldZ = radial * sin[x];
        if (ice) {
          const margin = frostMargin(worldX, vertical, worldZ, height, climate);
          const cold = Math.max(0, Math.min(1, (margin - 0.015) / 0.48));
          const high = Math.max(0, Math.min(1, (height - baseLevel - 0.16) / 0.54));
          ice[at] = cold * cold * (3 - 2 * cold) * high;
        }
        const hardRock = resistance && radial > 0.19 && height > (seaDatum ?? baseLevel) + 0.12;
        const rock = canyons || hardRock
          ? studioRegionWeights(terrain || inversion, [worldX, vertical, worldZ], terrain?.geology) : null;
        if (canyons) {
          const shore = seaDatum === null ? 1 : Math.max(0, Math.min(1, (height - seaDatum - 0.02) / 0.22));
          const canyon = Math.max(0, (rock[1] - 0.18) / 0.82) * (1 - (ice?.[at] ?? 0));
          canyons[at] = canyon;
          // Move each node once in the same smooth, seeded field. Every
          // incoming branch still ends at the exact start of its receiver.
          const amount = canyon * shore * studioPolarErosionWeight(y, width) * step;
          if (amount > 0) {
            const bend = bendFrequency * (35 * worldX - 52 * vertical + 28 * worldZ) + bendPhase;
            const eddy = bendFrequency * (-67 * worldX + 21 * vertical + 49 * worldZ) - bendPhase;
            eastShift[at] = amount * (1.36 * Math.sin(bend) + 0.38 * Math.sin(eddy)) / Math.max(0.5, 2 * radial);
            southShift[at] = amount * (0.76 * Math.cos(eddy) + 0.29 * Math.cos(bend));
          }
        }
        if (hardRock) {
          const [, canyon, granite, volcanic] = rock;
          const cement = 0.45 * canyon + 0.27 * granite + 0.91 * volcanic;
          const age = 0.69 * Math.sin(9 * worldX + 3 * vertical - 7 * worldZ + phase) +
            0.31 * Math.cos(15 * worldX - 8 * vertical + 9 * worldZ - phase);
          const erosionAge = Math.max(0, Math.min(1, (age - 0.10) / 0.73));
          const hard = Math.max(0, Math.min(1, (cement - 0.26) / 0.57));
          resistance[at] = inversion.variation * hard * erosionAge * erosionAge * (1 - 0.85 * (ice?.[at] ?? 0));
        }
      }
    }
  }
  const channelSize = (id) =>
    Math.max(0, Math.min(1, (Math.log2(1 + flow[id] * areaScale) - 6.45) / 6.4 + 0.17 * (canyons?.[id] ?? 0)));
  const channelDepth = (id, size) => {
    const upland = Math.min(1, Math.max(0, (heights[id] - baseLevel + 0.12) / 0.36));
    return strength * size * (0.095 + 0.24 * size) * (0.46 + 0.54 * upland) * (1 + 0.32 * (canyons?.[id] ?? 0));
  };
  const benchWeight = (id, size) => {
    const downstream = receiver[id];
    if (downstream < 0 || size <= 0.53) return 0;
    const grade = Math.abs(heights[id] - heights[downstream]) * width / 256;
    const trunk = (size - 0.53) / 0.47;
    const gentle = Math.max(0, 1 - grade / 0.065);
    const dry = seaDatum === null ? 1 : Math.max(0, Math.min(1, (heights[id] - seaDatum - 0.04) / 0.17));
    return trunk * gentle * gentle * dry * (1 - (ice?.[id] ?? 0));
  };
  for (let id = 0; id < count; id++) {
    const next = receiver[id];
    if (next < 0) continue;
    const size = channelSize(id);
    if (size <= 0) continue;
    const downstreamSize = channelSize(next);
    const row = Math.floor(id / width) + 1;
    const x = (id % width) * step + (eastShift?.[id] ?? 0), y = row * step + (southShift?.[id] ?? 0);
    const dx = (wrap((next % width) - (id % width) + 1, width) - 1) * step + (eastShift?.[next] ?? 0) - (eastShift?.[id] ?? 0);
    const dy = (Math.floor(next / width) - row + 1) * step + (southShift?.[next] ?? 0) - (southShift?.[id] ?? 0);
    const longitude = Math.max(0.35, 2 * rowArea[row]);
    const metricX = dx * longitude;
    const segmentLength2 = Math.max(1e-6, metricX * metricX + dy * dy);
    const glacier = (ice?.[id] ?? 0) * size * size;
    const downstreamGlacier = (ice?.[next] ?? 0) * downstreamSize * downstreamSize;
    const startCanyon = canyons?.[id] ?? 0, endCanyon = canyons?.[next] ?? 0;
    const startMerge = (junction?.[id] ?? 0) * (1 - glacier);
    const endMerge = (junction?.[next] ?? 0) * (1 - downstreamGlacier);
    const startWidth = (0.43 + 1.44 * size) * step * (1 + 0.57 * glacier + 0.43 * startMerge);
    const endWidth = (0.43 + 1.44 * downstreamSize) * step * (1 + 0.57 * downstreamGlacier + 0.43 * endMerge);
    const valleyWidth = Math.max(startWidth, endWidth);
    const startDepth = channelDepth(id, size) * (1 + 0.72 * glacier);
    const endDepth = channelDepth(next, downstreamSize) * (1 + 0.72 * downstreamGlacier);
    const startFloor = heights[id] - startDepth;
    const endFloor = Math.min(startFloor, heights[next] - endDepth);
    const startBench = alluvium ? benchWeight(id, size) : 0;
    const endBench = alluvium ? benchWeight(next, downstreamSize) : 0;
    const hasBench = startBench > 0 || endBench > 0;
    const capStart = size * size * (resistance?.[id] ?? 0);
    const capEnd = downstreamSize * downstreamSize * (resistance?.[next] ?? 0);
    const capRock = Math.max(capStart, capEnd) > 0.025;
    if (capStart > 0.17 && capEnd > 0.17) {
      inverted.push({ x: id % width, y: row, score: (capStart + capEnd) / 2 });
    }
    const mouth = seaDatum !== null && size > 0.57 && heights[id] >= seaDatum && heights[id] < seaDatum + 0.24 &&
      heights[next] < seaDatum && heights[next] > seaDatum - 0.20;
    let load = 0;
    const downstream = receiver[next];
    if (alluvium && size > 0.59 && downstream >= 0 && glacier < 0.22 &&
        (seaDatum === null || heights[next] > seaDatum + 0.05)) {
      const drop = heights[id] - heights[next];
      const downstreamDrop = Math.max(0, heights[next] - heights[downstream]);
      // Deposit at a break in grade, scaled by the size of the catchment.
      const flattening = Math.max(0, Math.min(1, (0.76 * drop - downstreamDrop - 0.016) / 0.075));
      load = strength * size * flattening * Math.min(0.20, 0.73 * drop);
    }
    const fan = load > 0.005;
    let fanTurn = 0;
    if (fan) {
      const nextX = ((wrap((downstream % width) - (next % width) + 1, width) - 1) * step +
        (eastShift?.[downstream] ?? 0) - (eastShift?.[next] ?? 0)) * longitude;
      const nextY = (Math.floor(downstream / width) - Math.floor(next / width)) * step +
        (southShift?.[downstream] ?? 0) - (southShift?.[next] ?? 0);
      fanTurn = (metricX * nextY - dy * nextX) / Math.sqrt(segmentLength2 * Math.max(1e-6, nextX ** 2 + nextY ** 2));
    }
    const searchWidth = valleyWidth * (fan ? 2.04 : mouth ? 1.65 : capRock ? 1.35 : 1);
    const reach = fan ? 3.3 : mouth ? 2.65 : 1;
    const extent = searchWidth / longitude;
    const segmentLength = mouth || fan ? Math.sqrt(segmentLength2) : 0;
    const firstY = Math.max(1, Math.floor(Math.min(y, y + reach * dy) - searchWidth));
    const lastY = Math.min(span - 1, Math.ceil(Math.max(y, y + reach * dy) + searchWidth));
    const firstX = Math.floor(Math.min(x, x + reach * dx) - extent);
    const lastX = Math.ceil(Math.max(x, x + reach * dx) + extent);
    for (let v = firstY; v <= lastY; v++) {
      const fade = studioPolarErosionWeight(v, span);
      const py = v - y;
      for (let u = firstX; u <= lastX; u++) {
        const px = (u - x) * longitude;
        const projection = (px * metricX + py * dy) / segmentLength2;
        const t = Math.min(1, Math.max(0, projection));
        const at = v * side + wrap(u, span);
        if (mouth && projection > 0.2 && projection < reach) {
          // A river loses its carrying power offshore. The fan widens
          // downstream, leaving a channel between its depositional lobes.
          const progress = (projection - 0.2) / (reach - 0.2);
          const across = Math.abs(px * dy - py * metricX) / segmentLength;
          const fanWidth = endWidth * (0.52 + progress);
          const bed = values[at] - seaDatum;
          if (across < fanWidth && bed > -0.19 && bed < 0.034) {
            const lateral = across / fanWidth;
            const profile = (1 - lateral) * Math.min(1, lateral * 4);
            const shelf = Math.min(0.15, 0.034 - bed);
            deposit[at] = Math.max(deposit[at], shelf * profile * 4 * progress * (1 - progress) * size * fade);
          }
        }
        if (fan && projection > 0.42 && projection < reach) {
          const progress = (projection - 0.42) / (reach - 0.42);
          const across = (px * dy - py * metricX) / segmentLength;
          const fanWidth = endWidth * (0.48 + 1.27 * progress);
          const floor = heights[next] - 0.068 * (projection - 1);
          const aboveFloor = Math.max(0, values[at] - floor);
          if (Math.abs(across) < fanWidth && aboveFloor < 0.28) {
            const lateral = across / fanWidth;
            // Where the wash turns, its straighter spill path carries more gravel.
            const imbalance = 1 + 0.46 * fanTurn * lateral;
            const edge = Math.abs(lateral);
            const sides = (1 - edge) ** 2 * Math.min(1, 5.0 * edge);
            const fork = Math.min(1, 0.28 + 8 * Math.abs(edge - 0.58 * progress));
            const lobe = sides * fork * 4 * progress * (1 - progress);
            const fill = load * lobe * imbalance * (1 - aboveFloor / 0.28) * fade;
            deposit[at] = Math.max(deposit[at], fill);
          }
        }
        const halfWidth = startWidth + t * (endWidth - startWidth);
        const d = Math.hypot(px - t * metricX, py - t * dy) / halfWidth;
        if (capRock && d < 1.35) {
          // The older channel fill survives while neighboring softer rock
          // erodes into parallel washes. Taper the cap into the next reach.
          const rock = (capStart + t * (capEnd - capStart)) * fade;
          const rim = Math.max(0, Math.min(1, (0.54 - d) / 0.30));
          const flank = Math.max(0, 1 - Math.abs(d - 0.84) / 0.51);
          preserved[at] = Math.max(preserved[at], 0.35 * rock * rim * rim * (3 - 2 * rim));
          cut[at] = Math.max(cut[at], 0.19 * rock * flank * flank);
        }
        if (d >= 1) continue;
        const depth = startDepth + t * (endDepth - startDepth);
        // Small tributaries have a V profile. The larger trunks open into
        // broad floors. The junction opens smoothly into a shared floor
        // where the wider cuts of both branches meet.
        const merge = startMerge + t * (endMerge - startMerge);
        const flat = 0.27 * (size + t * (downstreamSize - size)) ** 2 + 0.19 * merge;
        let riverBank = 1 - Math.max(0, (d - flat) / (1 - flat));
        if (startCanyon > 0 || endCanyon > 0) {
          const canyon = startCanyon + t * (endCanyon - startCanyon);
          const wall = Math.max(0, Math.min(1, (d - 0.19) / 0.59));
          const slot = 1 - wall * wall * (3 - 2 * wall);
          riverBank += 0.77 * canyon * (slot - riverBank);
        }
        const frozen = glacier + t * (downstreamGlacier - glacier);
        const d2 = d * d;
        const glacialBank = 1 - d2 * d2 * (3 - 2 * d2);
        const bank = riverBank + frozen * (glacialBank - riverBank);
        const floor = startFloor + t * (endFloor - startFloor);
        const incision = Math.min(1.65 * depth, Math.max(0.40 * depth, values[at] - floor));
        let channelCut = incision * fade * bank;
        if (hasBench && d > 0.28 && d < 0.94) {
          // Regrade the shoulders of low-gradient trunks toward a low terrace.
          // The center stays incised and the outer edge meets the original wall.
          const edge = Math.min(1, (d - 0.28) / 0.21, (0.94 - d) / 0.22);
          const blend = edge * edge * (3 - 2 * edge) * (startBench + t * (endBench - startBench));
          const terrace = floor + depth * (0.24 + 0.18 * d);
          const delta = (terrace - (values[at] - channelCut)) * blend;
          const regrade = Math.max(-0.073 * strength, Math.min(0.14 * strength, -delta));
          channelCut = Math.max(0, channelCut + regrade * fade);
        }
        cut[at] = Math.max(cut[at], channelCut);
      }
    }
  }
  const atlasScale = alluvium ? (alluvium.side - 1) / span : 0;
  for (let y = 1; y < span; y++) {
    const row = y * side;
    for (let x = 0; x < span; x++) {
      const at = row + x;
      const sediment = deposit?.[at] ?? 0;
      const cap = preserved?.[at] ?? 0;
      values[at] += sediment + cap - cut[at] * (1 - 0.89 * Math.min(1, cap / 0.115));
      if (alluvium && sediment > 0) {
        const j = Math.round(y * atlasScale);
        if (j === 0 || j === alluvium.side - 1) continue;
        const i = Math.round(x * atlasScale) % (alluvium.side - 1);
        const cell = j * alluvium.side + i;
        const retained = sediment * (1 - 0.50 * Math.min(1, cut[at] / 0.24));
        alluvium.values[cell] = Math.max(alluvium.values[cell], Math.min(1, retained * 9));
      }
    }
    values[row + span] = values[row];
  }
  if (inverted.length) {
    inverted.sort((a, b) => b.score - a.score);
    for (const { x, y } of inverted) {
      const latitude = Math.PI * y / width, longitude = 2 * Math.PI * x / width;
      const radial = Math.sin(latitude);
      const target = [radial * Math.cos(longitude), Math.cos(latitude), radial * Math.sin(longitude)];
      if (inversion.sites.some((p) => p[0] * target[0] + p[1] * target[1] + p[2] * target[2] > 0.998)) continue;
      inversion.sites.push(target);
      if (inversion.sites.length >= 48) break;
    }
  }
  if (alluvium) {
    for (let y = 1; y < alluvium.side - 1; y++) {
      const row = y * alluvium.side;
      alluvium.values[row + alluvium.side - 1] = alluvium.values[row];
    }
  }
  return values;
}
