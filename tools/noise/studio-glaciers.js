const tau = 2 * Math.PI;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const smooth = (a, b, value) => {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function iceCanyonOffset(t, bend, cirque) {
  return bend * (.9 * Math.sin(tau * t) + .34 * Math.sin(1.7 * tau * t + cirque * tau));
}

function carveIceCanyons(values, side, ice, patch, strength, random) {
  const { x, y, xScale, yScale, dx, dy, length, width, bend, branch, cirque, head, outlet } = patch;
  const span = side - 1;
  const iceSpan = ice.side - 1;
  const relief = clamp(head - outlet, .14, .73);
  const lateralBend = bend / length;
  const floor = (t) => outlet - .04 * relief + .70 * relief * (1 - clamp(t, 0, 1)) ** 2;
  const channels = [];
  const forks = 4 + Math.floor(4 * cirque);
  for (let i = 0; i < forks; i++) {
    const end = .16 + .79 * (i + .15 + .7 * random()) / forks;
    const run = .10 + .24 * random();
    const offset = branch * (i % 2 ? -1 : 1) * (.065 + .14 * random());
    const start = end - run;
    const bank = (.31 + .30 * random()) * width / length;
    channels.push({ start, end, offset, root: 0, bank, depth: .43 + .24 * random() });
    if (random() < .74) {
      const join = .33 + .32 * random();
      const tip = start + run * join;
      const root = offset * (1 - join) ** 1.3;
      channels.push({ start: tip - (.055 + .105 * random()), end: tip,
        offset: -offset * (.24 + .28 * random()), root, bank: .63 * bank, depth: .32 });
    }
  }

  const pathX = dx * length / xScale, pathY = dy * length / yScale;
  const padding = .39 * length;
  const firstRow = Math.max(1, Math.floor(y + Math.min(-.37 * pathY, 1.11 * pathY) - padding / yScale));
  const lastRow = Math.min(span - 1, Math.ceil(y + Math.max(-.37 * pathY, 1.11 * pathY) + padding / yScale));
  const firstColumn = Math.floor(x + Math.min(-.37 * pathX, 1.11 * pathX) - padding / xScale);
  const lastColumn = Math.ceil(x + Math.max(-.37 * pathX, 1.11 * pathX) + padding / xScale);
  const minWidth = .58 * Math.hypot(dy * xScale, dx * yScale) / length;
  for (let row = firstRow; row <= lastRow; row++) {
    const iceRow = Math.round(row * iceSpan / span) * ice.side;
    for (let col = firstColumn; col <= lastColumn; col++) {
      const east = (col - x) * xScale, south = (row - y) * yScale;
      const along = (east * dx + south * dy) / length;
      if (along <= -.37 || along >= 1.11) continue;
      const across = (-east * dy + south * dx) / length - iceCanyonOffset(along, lateralBend, cirque);
      if (Math.abs(across) > .30) continue;
      const column = ((col % span) + span) % span;
      const at = row * side + column;
      const height = values[at];
      const taper = smooth(-.02, .23, along);
      const widthAt = Math.max(minWidth, width / length * (.32 + .68 * taper) *
        (1 + .22 * Math.sin(13 * along + cirque * tau)));
      const sideOfFault = across * branch < 0 ? .69 : 1.13;
      const wall = Math.max(0, 1 - Math.abs(across) / (widthAt * sideOfFault));
      const run = smooth(-.03, .14, along) * (1 - smooth(.94, 1.11, along));
      let cut = run * wall ** 1.25 * clamp(height - floor(along) + .24 * relief, 0, .88);
      let cover = run * wall;

      for (const channel of channels) {
        if (along <= channel.start || along >= channel.end + .025) continue;
        const t = clamp((along - channel.start) / (channel.end - channel.start), 0, 1);
        const offset = channel.root + channel.offset * (1 - t) ** 1.3;
        const bank = Math.max(minWidth * .75, channel.bank * (.22 + .78 * t));
        const incision = Math.max(0, 1 - Math.abs(across - offset) / bank);
        const join = smooth(0, .46, t) * (1 - smooth(channel.end, channel.end + .025, along));
        const hangingFloor = floor(channel.end) + relief * .42 * (1 - t);
        cut = Math.max(cut, join * incision * clamp(height - hangingFloor + .10 * relief, 0, .72) * channel.depth);
        cover = Math.max(cover, .72 * join * incision);
      }
      values[at] = height - strength * cut;
      if (cover > 0) {
        const iceCol = Math.round(column * iceSpan / span) % iceSpan;
        const iceAt = iceRow + iceCol;
        ice.values[iceAt] = Math.max(ice.values[iceAt], strength * cover);
        if (iceCol === 0) ice.values[iceRow + iceSpan] = ice.values[iceAt];
      }
    }
    values[row * side + span] = values[row * side];
  }
}

// These valleys are cut into the height bake before runoff, so streams can
// follow their floors. Each patch uses a local angular scale and wraps in X.
export function carveStudioGlacialValleys(values, side, seed, variation, ice) {
  const icy = !!ice;
  const strength = smooth(0.18, 0.84, variation);
  if (side < 257 || strength === 0) return [];
  const span = side - 1;
  const wrap = (x) => ((x % span) + span) % span;
  const heightAt = (x, y) => values[clamp(Math.round(y), 0, span) * side + wrap(Math.round(x))];
  const direction = (x, y) => {
    const longitude = x / span * tau, latitude = y / span * Math.PI;
    return [Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude)];
  };
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const candidates = [], uplandCandidates = [];
  const elevations = [];
  for (let j = 0; j < 24; j++) {
    const y = Math.acos(1 - (j + 0.5) / 12) * span / Math.PI;
    for (let i = 0; i < 48; i++) elevations.push(heightAt((i + 0.5) * span / 48, y));
  }
  elevations.sort((a, b) => a - b);
  const inlandFloor = elevations[Math.floor(elevations.length * 0.71)] + 0.19;
  const columns = 32, rows = 20;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const x = (i + random()) * span / columns;
      const y = (0.23 + 0.54 * (j + random()) / rows) * span;
      const xScale = tau * Math.sin(y / span * Math.PI) / span;
      const yScale = Math.PI / span;
      const length = (icy ? 0.195 : 0.075) + (icy ? 0.25 : 0.055) * random();
      const widthRoll = random();
      const width = icy ? 0.005 + length * (0.019 + 0.023 * widthRoll)
        : length * (0.17 + 0.065 * widthRoll);
      const bend = (icy ? length * .12 : width * 1.25) * (random() - 0.5);
      const branch = random() < 0.5 ? -1 : 1;
      const cirque = random();
      const phase = random() * tau;
      const head = heightAt(x, y);
      const dir = direction(x, y);
      const light = dir[0] * 0.54 + dir[1] * 0.45 + dir[2] * 0.71;
      let best, bestUpland;
      for (let heading = 0; heading < 8; heading++) {
        const angle = phase + heading * tau / 8;
        const dx = Math.cos(angle), dy = Math.sin(angle);
        const outlet = heightAt(x + dx * length / xScale, y + dy * length / yScale);
        const drop = head - outlet;
        if (drop < (icy ? 0.085 : 0.25)) continue;
        const mid = heightAt(x + dx * length * 0.52 / xScale, y + dy * length * 0.52 / yScale);
        const sideA = heightAt(x + (dx * length * 0.40 - dy * width) / xScale,
          y + (dy * length * 0.40 + dx * width) / yScale);
        const sideB = heightAt(x + (dx * length * 0.40 + dy * width) / xScale,
          y + (dy * length * 0.40 - dx * width) / yScale);
        const walls = Math.min(sideA, sideB) - outlet;
        const score = 0.65 * clamp(drop, 0, 1.3) + 0.58 * clamp(walls, -0.35, 0.85) +
          0.24 * clamp(mid - outlet, -0.45, 0.65) + 0.46 * light + 0.16 * random() +
          (icy ? 0.60 * length : 0);
        const candidate = { x, y, xScale, yScale, dx, dy, length, width, bend, branch, cirque, head, outlet, score };
        if (!best || score > best.score) best = candidate;
        if (outlet >= inlandFloor && (!bestUpland || score > bestUpland.score))
          bestUpland = candidate;
      }
      if (best) candidates.push(best);
      if (bestUpland) uplandCandidates.push(bestUpland);
    }
  }

  const patches = [];
  const byElevation = candidates.map(({ outlet }) => outlet).sort((a, b) => a - b);
  const nearCoast = byElevation[Math.floor(byElevation.length * 0.76)];
  const lowland = byElevation[Math.floor(byElevation.length * 0.44)];
  candidates.sort((a, b) => b.score - a.score);
  const separated = (patch) => patches.every(({ x, y }) => Math.hypot(
      Math.min(Math.abs(x - patch.x), span - Math.abs(x - patch.x)) * patch.xScale,
      (y - patch.y) * patch.yScale,
    ) >= (icy ? 0.20 : 0.31));
  // Seek both high troughs and low outlets. On wet worlds, the latter can flood.
  const upland = uplandCandidates.sort((a, b) => b.score - a.score)[0];
  if (upland) patches.push(upland);
  const low = candidates.find((patch) => patch.outlet <= nearCoast && patch.outlet >= lowland && separated(patch));
  if (low) patches.push(low);
  for (const patch of candidates) {
    if (!separated(patch)) continue;
    patches.push(patch);
    if (patches.length === (icy ? 11 + (seed >>> 5) % 5 : 4)) break;
  }

  return patches.map((patch) => {
    const { x, y, xScale, yScale, dx, dy, length, width, bend, branch, cirque, head, outlet } = patch;
    const alongPath = (t) => {
      const offset = ice ? iceCanyonOffset(t, bend, cirque) : 0;
      return direction(x + (t * dx * length - dy * offset) / xScale,
        y + (t * dy * length + dx * offset) / yScale);
    };
    const site = { overlook: alongPath(.93), head: alongPath(.12) };
    if (ice) {
      carveIceCanyons(values, side, ice, patch, strength, random);
      return site;
    }
    const relief = clamp(head - outlet, 0.26, 1.14);
    const pathX = dx * length / xScale, pathY = dy * length / yScale;
    const startX = Math.floor(x + Math.min(0, pathX) - 3.2 * width / xScale);
    const endX = Math.ceil(x + Math.max(0, pathX) + 3.2 * width / xScale);
    const startY = Math.max(1, Math.floor(y + Math.min(0, pathY) - 3.2 * width / yScale));
    const endY = Math.min(span - 1, Math.ceil(y + Math.max(0, pathY) + 3.2 * width / yScale));
    const floorAt = (t) => outlet - 0.09 * relief + 0.63 * relief * (1 - t) ** 2;
    for (let row = startY; row <= endY; row++) {
      for (let col = startX; col <= endX; col++) {
        const east = (col - x) * xScale, south = (row - y) * yScale;
        const along = (east * dx + south * dy) / length;
        const meander = bend * Math.sin(Math.PI * along);
        const across = (-east * dy + south * dx - meander) / width;
        const t = clamp(along, 0, 1);
        // Wide headwall cirques narrow into a deep trunk, then widen again at its mouth.
        const spanAt = 0.68 + (0.28 + 0.37 * cirque) * (1 - smooth(0.04, 0.36, t)) +
          (0.22 + 0.24 * (1 - cirque)) * smooth(0.56, 0.97, t);
        const footprint = smooth(-0.17, 0.07, along) * (1 - smooth(0.83, 1.19, along));
        const trough = footprint * (1 - smooth(0.25, 1.0, Math.abs(across) / spanAt));
        const at = row * side + wrap(col);
        const h = values[at];
        let cut = trough * clamp(h - floorAt(t), 0, 0.95);

        // Two shorter cirques hang above the trunk and open into its walls.
        const forks = cirque > 0.28 ? 2 : 1;
        for (let fork = 0; fork < forks; fork++) {
          const armSide = fork === 0 ? branch : -branch;
          const junction = 0.25 + 0.14 * cirque + fork * 0.31;
          const rise = across * armSide;
          const arm = along - junction + 0.16 * rise - 0.021 * rise * rise;
          const bowl = 1 - smooth(0.047, 0.16 + 0.07 * cirque, Math.abs(arm));
          const reach = 2.0 + 0.55 * cirque - 0.3 * fork;
          const mask = bowl * smooth(0.21, 0.72, rise) * (1 - smooth(reach * 0.59, reach, rise));
          const hangingFloor = floorAt(junction) + relief * (0.18 + 0.09 * clamp(rise, 0, 2.6));
          cut = Math.max(cut, mask * clamp(h - hangingFloor, 0, 0.62));
        }
        // A low, broken moraine arcs around the mouth of some troughs.
        const terminal = 0.89 - 0.11 * across * across;
        const moraine = (1 - smooth(0.015, 0.067, Math.abs(along - terminal))) *
          (1 - smooth(0.56, 0.97, Math.abs(across))) *
          smooth(-0.70, 0.28, across * branch) * relief * cirque * 0.075;
        values[at] = h + strength * (moraine - cut);
      }
      values[row * side + span] = values[row * side];
    }
    return site;
  });
}
