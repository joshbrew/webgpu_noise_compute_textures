// Flat-volume fields are shared between independent compute entrypoints. Density
// is regenerated for scene/noise changes; lighting for density or sun changes.
struct CloudFieldParams {
  gridMin: vec4<f32>, // xyz bounds, w rain-shelf weight
  gridSize: vec4<f32>, // xyz extent, w stratus-deck weight
  dimensions: vec4<u32>,
  volume: vec4<f32>, // mask kind, rotation, major radius, tube radius / box wisp weight
  morphology: vec4<f32>, // cirrus, Kelvin-Helmholtz/fluctus, asperitas, ray-only turbulence
  pattern: vec4<f32>, // axis (0 volume, 1 X, 2 Y, 3 Z), first, last, stride
  patternMotion: vec4<f32>, // material-space scroll, enabled
  patternStyle: vec4<f32>, // repeat scale, slice thickness in cells
};
@group(2) @binding(1) var cloudDensityField: texture_3d<f32>;
@group(2) @binding(2) var cloudLightField: texture_3d<f32>;
@group(2) @binding(3) var cloudFieldSampler: sampler;
@group(2) @binding(4) var<uniform> FIELD: CloudFieldParams;
@group(2) @binding(5) var cloudDensityOut: texture_storage_3d<rgba16float, write>;
@group(2) @binding(6) var cloudLightOut: texture_storage_3d<rgba16float, write>;

fn cloudFieldUV(p: vec3<f32>) -> vec3<f32> {
  let uv=(p - FIELD.gridMin.xyz) / max(FIELD.gridSize.xyz, vec3<f32>(EPS));
  return select(uv,vec3<f32>(fract(uv.x),uv.y,fract(uv.z)),FIELD.dimensions.w>0u || (CLOUD_FROZEN_PATTERN!=0u && FIELD.patternMotion.w>0.5));
}
fn fieldPeriodicScale(scale:vec3<f32>)->vec3<f32> {
  if(FIELD.dimensions.w==0u){return scale;}
  return vec3<f32>(max(1.0,round(abs(scale.x)*FIELD.gridSize.x))*sign(scale.x)/FIELD.gridSize.x,
    scale.y,max(1.0,round(abs(scale.z)*FIELD.gridSize.z))*sign(scale.z)/FIELD.gridSize.z);
}
fn fieldWeatherUV(p:vec3<f32>,scale:f32)->vec2<f32> {
  if(FIELD.dimensions.w==0u){return weatherUV_from(p,scale);}
  let axis=axisOrOne3(NTransform.weatherAxisScale);
  let rate=fieldPeriodicScale(axis*0.5*max(B.uvScale,EPS)*scale);
  return (p.xz+NTransform.weatherOffsetWorld.xz-B.center.xz)*rate.xz;
}
fn fieldSampleAt(p: vec3<f32>) -> vec4<f32> {
  let uv = cloudFieldUV(p);
  if (any(uv < vec3<f32>(0.0)) || any(uv > vec3<f32>(1.0))) { return vec4<f32>(0.0, 0.0, 0.0, -0.15); }
  return textureSampleLevel(cloudDensityField, cloudFieldSampler, uv, 0.0);
}
fn fieldDensityAt(p: vec3<f32>) -> vec2<f32> {
  return fieldSampleAt(p).rg;
}
fn cloudCellRandom(cell: vec2<f32>, offset: f32) -> f32 {
  var id=cell;
  if(FIELD.dimensions.w>0u){let count=round(FIELD.gridSize.xz/max(TUNE.puffScale,0.75));id=cell-floor(cell/count)*count;}
  return hash11Fast(dot(id, vec2<f32>(127.1, 311.7)) + offset);
}
fn cloudEllipsoid(p: vec3<f32>, center: vec3<f32>, radius: vec3<f32>) -> f32 {
  return 1.0 - length((p - center) / max(radius, vec3<f32>(0.01)));
}

fn cloudSoftUnion(a: f32, b: f32) -> f32 {
  let h = max(0.26 - abs(a - b), 0.0) / 0.26;
  return max(a, b) + h * h * 0.065;
}

// Return fine density, macro density and signed form independently. Coverage
// activates growing billows from the base upward, never rescales tower height.
// Cell identity, weather and shape noise travel together with horizontal wind.
// Only the rounded presets use this field; the original layer is untouched.
fn roundedCloudBody(p: vec3<f32>, shape: vec4<f32>, detail: vec3<f32>) -> vec3<f32> {
  let cellSize = max(TUNE.puffScale, 0.75);
  let windOffset = NTransform.shapeOffsetWorld.xz;
  let cell = floor((p.xz + windOffset) / cellSize);
  let stormSystem = TUNE.formType >= 2.5;
  let layerHeight = FIELD.gridSize.y;
  var body = -1.0;
  var fine = 0.0;
  var macroAmount = 0.0;
  // Rain Shelf's useful structure comes from remapping the base against its
  // other three shape bands, not from adding noise to a filled primitive's skin.
  // Keep that small density closure in this entrypoint, outside the cell loop;
  // do not pull the legacy ray/light call graph into the field compiler.
  let definition = cloudDefinition01();
  let fbm = dot(shape.gba, vec3<f32>(0.625, 0.25, 0.125));
  let baseShape = contrast01(shape.r, 1.24 + definition * 0.38);
  let shelfShape = saturate((baseShape - fbm * 0.72) / max(1.0 - fbm * 0.72, 0.08));
  let detailMid = dot(detail, vec3<f32>(0.42, 0.34, 0.24));
  let scallopSignal = mix_f(max(max(detail.r, detail.g), detail.b),
    1.0 - min(min(detail.r, detail.g), detail.b), 0.42);
  let valley = pow(1.0 - ridge01(contrast01(scallopSignal, 2.4)), 1.35);
  // Noise shapes the entire volume, but fine erosion must not turn a mature
  // thunderhead into disconnected translucent vapor. A noisy interior support
  // below preserves bulk while the same breakup still defines its outer folds.
  let structure = (shelfShape - 0.22) * 0.55 + (fbm - 0.5) * 0.20;
  let erosion = (detailMid * 0.10 + valley * mix_f(0.08, 0.18, definition));
  for (var z = -1; z <= 1; z++) {
    for (var x = -1; x <= 1; x++) {
      let id = cell + vec2<f32>(f32(x), f32(z));
      let r0 = cloudCellRandom(id, 3.1);
      let r1 = cloudCellRandom(id, 17.3);
      let r2 = cloudCellRandom(id, 41.7);
      let materialCenterXZ = (id + 0.5 + (vec2<f32>(r0, r1) - 0.5) * 0.42) * cellSize;
      let centerXZ = materialCenterXZ - windOffset;
      let weatherScale = select(NTransform.weatherScale, 1.0, NTransform.weatherScale == 0.0);
      // Sample weather in the co-moving domain, not underneath a stationary
      // lattice. Its separate slow offset can evolve cells without wind itself
      // pumping their height. Anatomy is selected independently below.
      let weather = wrap2D(weather2D, samp2D, fieldWeatherUV(vec3<f32>(materialCenterXZ.x, B.center.y, materialCenterXZ.y), weatherScale), 0i, 0.0);
      // A storm scene is a population, not a wall of identical thunderheads.
      // Stable material-cell identity selects scattered convective storms;
      // the remaining cells form lower fair-weather cumulus in the same box.
      // Selection travels with wind and does not toggle as weather evolves.
      // Never compare the identity seed with moving weather: that replaced
      // small cumulus with a full thunderhead in one frame at the threshold.
      // Weather controls continuous development, not this cell's anatomy.
      let stormCell = cloudCellRandom(id, 237.9) < 0.27;
      let anvil = select(C.cloudAnvilAmount > 0.65, stormCell, stormSystem);
      let convective = anvil || (TUNE.formType >= 1.5 && TUNE.formType < 2.5);
      // Material-cell variation survives wind and weather transitions. Rotate
      // the anatomy, not the noise, so adjacent storms have different outflow
      // directions without seams or another texture lookup per lobe.
      let variant = cloudCellRandom(id, 312.7);
      // Independent width seed: broad storms need not share noise/lean variants.
      // 30% have a full broad base; another 28% span intermediate widths.
      let widthVariant = cloudCellRandom(id, 383.1);
      let broadBase = select(0.0, 1.0 - smoothstep(0.30,0.58,widthVariant), convective);
      let aspect = select(1.0, mix_f(0.85, 1.15, variant), convective);
      let turn = cloudCellRandom(id, 329.1) * 6.283185;
      let cs = cos(turn); let sn = sin(turn);
      let relative = p.xz - centerXZ;
      let anatomyP = select(p, vec3<f32>(centerXZ.x + (relative.x * cs + relative.y * sn) / aspect,
        p.y, centerXZ.y + (-relative.x * sn + relative.y * cs) * aspect), convective);
      let shear = select(vec2<f32>(0.0), (vec2<f32>(r1, variant) - 0.5) * cellSize * mix_f(0.29, 0.40, r0) * 0.30, convective);
      let cellBands = mix(shape.gba, shape.abg, select(0.0, variant, convective));
      let cellFbm = dot(cellBands, vec3<f32>(0.625, 0.25, 0.125));
      let cellBase = contrast01(mix_f(shape.r, shape.g, select(0.0, variant * 0.22, convective)), 1.24 + definition * 0.38);
      let cellShelf = saturate((cellBase - cellFbm * 0.72) / max(1.0 - cellFbm * 0.72, 0.08));
      let cellStructure = select(structure, (cellShelf - 0.22) * mix_f(0.49, 0.67, variant) + (cellFbm - 0.5) * 0.20, convective);
      let coverage = clamp(C.globalCoverage * mix_f(0.78, 1.0, saturate(weather.r)) * mix_f(1.0, 0.72, saturate(TUNE.sparsity)), 0.0, 1.0);
      let weatherMaturity = smoothstep(r2 - 0.38, r2 + 0.38, coverage);
      // Cycle storms develop upper billows, never stretch the whole column.
      let stormDevelopment = smoothstep(0.08, 1.0, C.cloudAnvilAmount);
      let maturity = select(weatherMaturity, mix_f(min(weatherMaturity, 0.28), weatherMaturity, stormDevelopment), TUNE.formType > 3.5 && stormCell);
      // Include noisy/scalloped lobes in the neighborhood bound, not just the
      // hidden ellipsoids. With center jitter <= .21 cells, this 1.28-cell
      // support ends before a center can drop out of the 3x3 search (.21+1.28<1.5).
      let footprintFade = select(1.0, 1.0 - smoothstep(cellSize * 1.12, cellSize * 1.28,
        max(abs(relative.x),abs(relative.y))), convective);
      let presence = maturity * footprintFade * smoothstep(0.0, 0.12, C.globalCoverage) * (1.0 - smoothstep(0.85, 1.0, weather.b));
      if (presence <= 0.00001) { continue; }
      let heightVariation = clamp(TUNE.towerHeightVariation, 0.0, 0.9);
      let heightFraction = mix_f(0.93, 0.93 - heightVariation, r1);
      // Weather-organized storm families share feeder banks, not a regiment of
      // equally tall stalks. Cell-local height/width remain stable under wind.
      let stormHeight = mix_f(0.52, 1.0, cloudCellRandom(id, 347.3));
      let columnHeight = layerHeight * heightFraction * select(1.0, stormHeight, anvil) * mix_f(1.0, 0.85, broadBase)
        * select(1.0, mix_f(0.22, 0.54, r0), stormSystem && !stormCell);
      let base = FIELD.gridMin.y + layerHeight * 0.07;
      let radiusXZ = cellSize * mix_f(0.29, select(0.43, 0.40, anvil), r0)
        * select(1.0, mix_f(0.68, 1.35, cloudCellRandom(id, 361.7)), convective);
      // The existing per-voxel edge fade lets drifting cells enter/leave the
      // volume smoothly. Rejecting whole centers here would make them pop.
      let coreGrowth = max(0.03, sqrt(smoothstep(0.0, 0.65, maturity)));
      let coreRadiusY = min(columnHeight * 0.22, radiusXZ * mix_f(0.80,0.66,broadBase));
      let coreY = base + coreRadiusY * coreGrowth;
      let coreCenter = vec3<f32>(centerXZ.x, coreY, centerXZ.y);
      // No clamped-Y extrusion: that made a dense straight stalk beneath a cap.
      // Base breadth is independent of the crown: broad storm decks feed a
      // rising neck alongside slimmer columns, rather than scaling an entire
      // cloud up/down. Broad footprints remain inside the 3x3 cell search.
      var localBody = cloudEllipsoid(anatomyP, coreCenter, vec3<f32>(radiusXZ * mix_f(1.14,1.95,broadBase), coreRadiusY, radiusXZ * mix_f(0.98,1.75,broadBase)) * coreGrowth);
      var localForm = localBody;
      // Three staggered tiers of billows wrap the whole body, including its
      // underside. The wide lower shoulders connect to the upper cauliflower.
      for (var lobe = 0; lobe < 9; lobe++) {
        let seed = f32(lobe) * 19.71 + 63.2;
        let a = cloudCellRandom(id, seed);
        let b = cloudCellRandom(id, seed + 7.9);
        let tier = f32(lobe / 3);
        let lobeAge = smoothstep(tier * 0.14, tier * 0.14 + 0.70, maturity);
        if (lobeAge <= 0.00001) { continue; }
        let puffGrowth = sqrt(lobeAge);
        let angle = f32(lobe % 3) * 2.0944 + tier * 1.12 + r0 * 6.28318;
        // Roll out of the connected parent mass, rather than materializing a
        // little sphere at its final detached position and expanding there.
        let lean = (vec2<f32>(r1, r2) - 0.5) * radiusXZ * tier * 0.65 + shear * tier;
        let offset = (vec2<f32>(cos(angle), sin(angle)) * radiusXZ * mix_f(0.52, 0.78, a) + lean) * puffGrowth;
        let lowerShoulder = 1.0 + broadBase * (1.0 - saturate(tier)) * 0.32;
        let fullHeadRadius = radiusXZ * mix_f(0.58, 0.82, b) * clamp(TUNE.fluffFactor / 4.0, 0.85, 1.15) * select(1.0, 0.86, anvil) * lowerShoulder;
        let headRadius = fullHeadRadius * puffGrowth;
        // Storm billows feed the canopy from below instead of growing rounded
        // turrets through it and hiding its flattened, spreading silhouette.
        let headY = base + columnHeight * (0.20 + tier * select(0.24, 0.215, anvil) + (a - 0.5) * 0.12);
        let fullRadiusY = min(fullHeadRadius * mix_f(0.94, 1.18, a), columnHeight * select(0.24, 0.16, anvil));
        let parentLift = fullRadiusY + columnHeight * 0.10 * tier;
        let head = vec3<f32>(centerXZ.x + offset.x, headY - parentLift * (1.0 - puffGrowth), centerXZ.y + offset.y);
        let radiusY = fullRadiusY * puffGrowth;
        // Newly born billows must gain density as well as radius; otherwise a
        // sub-voxel puff immediately has a fully opaque core and appears to pop.
        let lobeDensityLimit = mix_f(-0.12, 0.40, lobeAge);
        let lobeAspect = select(1.0, mix_f(0.74, 1.25, a), convective);
        let headForm = cloudEllipsoid(anatomyP, head, vec3<f32>(headRadius * lobeAspect, radiusY * select(1.0, mix_f(0.85, 1.18, b), convective), headRadius / lobeAspect));
        localForm = cloudSoftUnion(localForm, headForm);
        localBody = cloudSoftUnion(localBody, min(headForm, lobeDensityLimit));
        // Smaller attached buds give the large shoulders a cauliflower outline.
        // Their minimum radius stays above the field's horizontal texel size.
        let budRadius = max(fullHeadRadius * 0.55, min(FIELD.gridSize.x / f32(FIELD.dimensions.x) * 1.35, fullHeadRadius * 0.68)) * puffGrowth;
        let bud = head + vec3<f32>(offset.x * 0.24, radiusY * select(0.58, 0.35, anvil), offset.y * 0.24);
        let budForm = cloudEllipsoid(anatomyP, bud, vec3<f32>(budRadius, min(budRadius, columnHeight * select(0.17, 0.10, anvil) * puffGrowth), budRadius));
        localForm = cloudSoftUnion(localForm, budForm);
        localBody = cloudSoftUnion(localBody, min(budForm, lobeDensityLimit));
      }
      if (anvil && maturity > 0.40) {
        // The old late onset left most weather cells with only tiny caps. They
        // could never outspread the lower billows, even at the Anvil preset.
        let capGrowth = sqrt(smoothstep(0.40, 0.84, maturity));
        let capDensityLimit = mix_f(-0.12, 0.40, capGrowth * capGrowth);
        let spread = clamp(C.cloudAnvilAmount * max(TUNE.anvilLift, 0.0) / 0.60, 0.0, 1.5);
        let shoulder = vec3<f32>(centerXZ.x + radiusXZ * 0.15 + shear.x * 1.7, base + columnHeight * 0.72, centerXZ.y + shear.y * 1.7);
        let shoulderForm = cloudEllipsoid(anatomyP, shoulder, vec3<f32>(radiusXZ * 1.12, columnHeight * 0.16, radiusXZ * 1.08) * capGrowth);
        localForm = cloudSoftUnion(localForm, shoulderForm);
        localBody = cloudSoftUnion(localBody, min(shoulderForm, capDensityLimit));
        // A connected wind-spread fan, not one smooth UFO-shaped disk. Slightly
        // staggered lobes retain a broken edge as the cap spreads downwind.
        for (var fan = 0; fan < 5; fan++) {
          let f = f32(fan) / 4.0;
          let jitter = cloudCellRandom(id, 181.0 + f32(fan) * 7.3);
          // Broad and shallow at a common outflow level, with an asymmetric
          // downwind reach. Same noise closure/erosion as the body preserves
          // breakup throughout the canopy rather than adding a smooth disk.
          // Bound the footprint to the existing 3x3 neighborhood: no extra
          // field probes, loop iterations or raymarch work are introduced.
          let lateralSpread = saturate(spread / 1.15);
          let capCenter = vec3<f32>(centerXZ.x + shear.x * 1.7 + radiusXZ * mix_f(-0.55, mix_f(0.55, 0.85, variant), f) * lateralSpread,
            base + columnHeight * (mix_f(0.83, 0.87, variant) + (jitter - 0.5) * 0.045),
            centerXZ.y + shear.y * 1.7 + radiusXZ * (jitter - 0.5) * 0.42 * lateralSpread);
          let capRadius = vec3<f32>(radiusXZ * mix_f(0.55, mix_f(1.20, 1.60, f), lateralSpread),
            columnHeight * mix_f(0.095, 0.065, f) * mix_f(0.72, 1.34, r2), radiusXZ * mix_f(0.55, mix_f(1.30, 1.60, f), lateralSpread));
          let capForm = cloudEllipsoid(anatomyP, capCenter, capRadius * capGrowth);
          localForm = cloudSoftUnion(localForm, capForm);
          localBody = cloudSoftUnion(localBody, min(capForm, capDensityLimit));
        }
      }
      let macroSigned = localBody * 0.85 + cellStructure;
      let fineSigned = macroSigned - erosion;
      // Only developed, embedded material gets support. It follows the noisy
      // body and young-billow density limit, not a filled hidden ellipsoid;
      // growing lobes/edges remain tenuous and coverage zero stays empty.
      let interior = smoothstep(0.04, 0.42, localBody + cellStructure * 0.40 - erosion * 0.20)
        * smoothstep(0.20, 1.00, maturity);
      // Optical thickness belongs in the interior, not an image-space alpha
      // boost that would also turn faint edges and newborn puffs into cards.
      let coreDensity = interior * 2.0;
      let fineDensity = max(smoothstep(-0.025, 0.24, fineSigned), coreDensity);
      let macroDensity = max(smoothstep(-0.025, 0.24, macroSigned), coreDensity);
      let volumeVariation = mix_f(0.65, 1.0, shelfShape);
      fine = max(fine, presence * fineDensity * volumeVariation);
      macroAmount = max(macroAmount, presence * macroDensity * volumeVariation);
      // Opacity limits for young puffs must not flatten their shading normals.
      // Lighting follows the same noise-defined folds as density, not the
      // hidden ellipsoids. Preserve the unsaturated signed field for gradients.
      // Retain noisy folds without letting the smallest erosion valleys dominate
      // every lighting normal. Density/breakup is unchanged; broad shoulders
      // should carry coherent light and shade underneath the finer texture.
      body = max(body, localForm * 0.85 + cellStructure * 0.65 - erosion * 0.35 - (1.0 - presence) * 0.45);
    }
  }
  if (stormSystem) {
    // Broken, low feeder banks link some towers into larger storm complexes.
    // Already sampled shape bands supply the organization; no extra reads or
    // larger neighborhood are needed. Sparse coverage still opens real gaps.
    let center = FIELD.gridMin.y + layerHeight * (0.13 + fbm * 0.065);
    let band = 1.0 - abs(p.y-center) / max(layerHeight * 0.12, 0.30);
    let connected = min(band, shelfShape * 0.72 + fbm * 0.28 - mix_f(0.85, 0.34, saturate(C.globalCoverage)));
    let bank = smoothstep(-0.035, 0.22, connected - erosion * 0.45) * smoothstep(0.0, 0.12, C.globalCoverage);
    fine = max(fine, bank * 0.72);
    macroAmount = max(macroAmount, bank * 0.82);
    body = max(body, connected - erosion * 0.35);
  }
  return vec3<f32>(fine, macroAmount, body);
}

// Rare cloud features use analytic, co-moving scaffolds plus the same baked
// bands. These are cached volume fields, never extra procedural work per ray.
// Return fine/macro density and an unsaturated surface for lighting gradients.
fn featureWeatherBody(p: vec3<f32>, shape: vec4<f32>, detail: vec3<f32>, weights: vec3<f32>) -> vec3<f32> {
  let material = p + NTransform.shapeOffsetWorld;
  let u = dot(material.xz, vec2<f32>(0.94, 0.342));
  let v = dot(material.xz, vec2<f32>(-0.342, 0.94));
  let base = FIELD.gridMin.y;
  let height = FIELD.gridSize.y;
  let spacingY = height / f32(FIELD.dimensions.y);
  let coverage = saturate(C.globalCoverage);
  let weatherScale = select(NTransform.weatherScale, 1.0, NTransform.weatherScale == 0.0);
  let weather = wrap2D(weather2D, samp2D, fieldWeatherUV(material, weatherScale), 0i, 0.0);
  let presence = smoothstep(0.0, 0.12, coverage) * (1.0 - smoothstep(0.85, 1.0, weather.b));
  let grain = dot(detail, vec3<f32>(0.42, 0.34, 0.24));
  var density = 0.0;
  var macroDensity = 0.0;
  var signed = -1.0;
  if (weights.x > 0.0) {
    // Long feathered ice streaks: slow bends along wind, finer cross-wind
    // filaments. No vertical squash or sub-voxel transparent sheet.
    let feather = sin(v * 1.65 + sin(u * 0.28 + shape.g * 2.0) * 1.5 + (shape.g - 0.5) * 2.4);
    let fibers = pow(0.5 + feather * 0.5, 3.0);
    let streakMask = shape.r * 0.55 + shape.b * 0.45;
    let fragments = smoothstep(0.20, 0.68, streakMask + sin(u * 0.19 + v * 0.13) * 0.16);
    let center = base + height * 0.80 + sin(u * 0.17 + v * 0.08) * 0.32 + (shape.a - 0.5) * 0.30;
    let band = 1.0 - abs(p.y - center) / max(spacingY * 1.75, 0.30);
    let form = min(band, fibers * 0.75 + streakMask * 0.45 - mix_f(0.82, 0.39, coverage));
    density += weights.x * smoothstep(-0.055, 0.23, form - grain * 0.035) * fragments * 0.30;
    macroDensity += weights.x * smoothstep(-0.055, 0.23, form) * fragments * 0.30;
    signed = max(signed, form - (1.0 - weights.x) * 0.35);
  }
  if (weights.y > 0.0) {
    // A breaking wave has a broad sloping back and a steep forward face.
    // The curl is only its crest; the rising wedge below supplies its mass.
    let width = max(TUNE.puffScale, 3.6);
    let phase = u + sin(v * 0.21) * 0.65 + (shape.g - 0.5) * 0.45;
    let waveId = floor(phase / width);
    // Stable but independently evolving rolls, not repeated identical hooks.
    // The support ends before the cell boundary, so irregular spacing does not
    // introduce seams. Existing volume bands shear/break their whole surface.
    let seed = cloudCellRandom(vec2<f32>(waveId, 0.0), 419.7);
    let lean = cloudCellRandom(vec2<f32>(waveId, 0.0), 431.3);
    let x = (fract(phase / width) - 0.5 + (lean - 0.5) * 0.22) * width;
    let radius = width * (mix_f(0.20, 0.26, seed) + shape.g * 0.018 + 0.015 * sin(v * 0.27));
    let floorY = base + height * 0.20 + sin(v * 0.34) * 0.12 + sin(u * 0.22 + v * 0.16) * 0.16;
    let roughQ = vec2<f32>(x + (shape.g - 0.5) * width * 0.13, p.y - floorY - radius + (shape.b - 0.5) * width * 0.10);
    let turn = (lean - 0.5) * 0.90;
    let q = vec2<f32>(cos(turn)*roughQ.x+sin(turn)*roughQ.y,-sin(turn)*roughQ.x+cos(turn)*roughQ.y);
    let thickness = max(spacingY * 1.6, width * mix_f(0.038, 0.063, lean));
    let curlRadius = radius * (1.0 + sin(atan2(q.y,q.x)*2.0 + seed*6.283185) * 0.16);
    let ring = (thickness - abs(length(q) - curlRadius)) / thickness;
    let openHook = min(ring, max(-q.x - radius * mix_f(0.02,0.28,seed), q.y + radius * mix_f(0.10,0.42,lean)) / thickness);
    let rise = clamp((p.y-floorY)/max(radius*1.65,0.01),0.0,1.0);
    let back = mix_f(-width*0.46,-radius*0.42,rise);
    let face = mix_f(radius*0.42,-radius*0.30,rise);
    let wedge = min(min((x-back)/thickness,(face-x)/thickness),
      min((p.y-floorY+thickness)/thickness,(floorY+radius*1.65-p.y)/thickness));
    let crest = min(openHook,(p.y-floorY-radius*0.72)/thickness);
    let bank = (1.0 - abs(p.y - floorY - (shape.g-0.5)*0.65) / max(thickness * 0.85, spacingY * 1.6))
      - smoothstep(0.36,0.67,shape.b)*0.60;
    let row = smoothstep(0.22, 0.72, 0.5 + sin(v * 0.38 + shape.b * 1.45) * 0.5);
    let form = min(max(cloudSoftUnion(wedge,crest), bank * 0.42), row * 1.1 - mix_f(0.90, 0.20, coverage));
    let eroded = form + (shape.r - 0.5) * 0.78 - (grain - 0.35) * 0.38 - (shape.a - 0.5) * 0.24;
    density += weights.y * smoothstep(-0.055, 0.30, eroded) * 0.60;
    macroDensity += weights.y * smoothstep(-0.055, 0.30, form) * 0.60;
    signed = max(signed, eroded - (1.0 - weights.y) * 0.35);
  }
  if (weights.z > 0.0) {
    // Asperitas is a connected turbulent underside, with differently directed
    // waves and deep irregular troughs, rather than an array of hanging balls.
    let waveA = sin(u * 0.58 + sin(v * 0.23) * 1.4 + shape.g * 0.8);
    let waveB = sin(v * 0.82 + sin(u * 0.31) * 0.85 + shape.b * 0.9);
    let trough = pow(0.5 + 0.5 * sin(u * 0.82 + v * 0.41 + shape.a), 3.0);
    let underside = base + height * 0.42 + waveA * 0.42 + waveB * 0.55 - trough * 0.80 + (shape.r - 0.5) * 0.42;
    let ceiling = base + height * 0.76 + (shape.b - 0.5) * 0.40;
    let band = min(p.y - underside, ceiling - p.y) / max(height * 0.16, 0.5);
    let opening = shape.r * 0.50 + shape.g * 0.30 + weather.r * 0.20 - mix_f(0.88, 0.13, coverage);
    let form = min(band, opening);
    let eroded = form - (grain - 0.35) * 0.065;
    density += weights.z * max(smoothstep(-0.06, 0.23, eroded), smoothstep(0.08, 0.35, eroded) * 1.25);
    macroDensity += weights.z * max(smoothstep(-0.06, 0.23, form), smoothstep(0.08, 0.35, form) * 1.25);
    signed = max(signed, eroded - (1.0 - weights.z) * 0.35);
  }
  return vec3<f32>(density * presence, macroDensity * presence, signed);
}

// Continuous layer systems for the weather director. Reuse the already sampled
// four shape bands/detail, and the same co-moving weather domain. Shelf material
// has its own resolved ripple scale, without pulling in the legacy ray/light
// call graph or changing the noise domain of the remaining convective clouds.
fn layeredWeatherBody(p:vec3<f32>, shape:vec4<f32>, detail:vec3<f32>, weights:vec3<f32>, shelfShapeBands:vec4<f32>, shelfDetail:vec3<f32>) -> vec3<f32> {
  let fbm=dot(shape.gba,vec3<f32>(0.625,0.25,0.125));
  let baseShape=contrast01(shape.r,1.35);
  let shelfShape=saturate((baseShape-fbm*0.72)/max(1.0-fbm*0.72,0.08));
  let detailMid=dot(detail,vec3<f32>(0.42,0.34,0.24));
  let material=p+NTransform.shapeOffsetWorld;
  let weatherScale=select(NTransform.weatherScale,1.0,NTransform.weatherScale==0.0);
  let weather=wrap2D(weather2D,samp2D,fieldWeatherUV(material,weatherScale),0i,0.0);
  let coverage=saturate(C.globalCoverage*mix_f(0.78,1.0,saturate(weather.r)));
  let threshold=mix_f(0.62,0.06,coverage);
  let presence=smoothstep(0.0,0.12,C.globalCoverage)*(1.0-smoothstep(0.85,1.0,weather.b));
  let base=FIELD.gridMin.y;
  var fine=0.0;
  var macroDensity=0.0;
  var signed=-1.0;
  if(weights.x>0.0) {
    // Port the layer's band-remap, scallops and crease signals, not its harsh
    // high-frequency carve or thin-box height remapping. Keep folded, connected
    // rain banks with a dense body and softer rippled edges through the cycle.
    let s=shelfShapeBands;
    let d=shelfDetail;
    let shelfFBM=dot(s.gba,vec3<f32>(0.625,0.25,0.125));
    let shelfBase=contrast01(s.r,1.24+cloudDefinition01()*0.38);
    let remapped=saturate((shelfBase-shelfFBM*0.90)/max(1.0-shelfFBM*0.90,0.08));
    let mid=dot(d,vec3<f32>(0.42,0.34,0.24));
    let scallopSignal=mix_f(max(max(d.r,d.g),d.b),1.0-min(min(d.r,d.g),d.b),0.42);
    let scallop=ridge01(contrast01(scallopSignal*0.72+ridge01(contrast01(mid,2.1))*0.28,2.25));
    let valley=(1.0-scallop)*(1.0-scallop);
    let crease=ridge01(contrast01(d.r*0.36+(1.0-d.g)*0.34+d.b*0.20+(1.0-s.r)*0.10,2.15));
    let fold=ridge01(contrast01(s.g*0.54+s.b*0.30+s.a*0.16,1.9));
    let center=base+1.95+(shape.g-0.5)*0.65+(s.g-s.b)*0.38;
    let halfHeight=0.90+shelfShape*0.60+fold*0.32;
    let band=1.0-abs(p.y-center)/halfHeight;
    let structure=(remapped-0.28)*0.68+(shelfFBM-0.5)*0.14;
    let form=min(band,band*0.42+structure-threshold*0.45);
    // Erosion is bounded and reduced inside the bank: breakup exposes folds
    // without punching a mature shelf into the default preset's rough wisps.
    let shell=1.0-smoothstep(0.08,0.38,form);
    let erosion=(mid*0.035+valley*0.095+crease*0.040)*mix_f(0.55,1.0,shell);
    let eroded=form-erosion;
    fine+=weights.x*max(smoothstep(-0.045,0.24,eroded),smoothstep(0.08,0.38,eroded)*1.45);
    macroDensity+=weights.x*max(smoothstep(-0.045,0.24,form-erosion*0.45),smoothstep(0.08,0.38,eroded)*1.45);
    signed=max(signed,form-erosion*0.65-(1.0-weights.x)*0.35);
  }
  if(weights.y>0.0) {
    // A connected ceiling which opens into broken banks as coverage falls.
    let center=base+3.35+(shape.g-0.5)*0.80;
    let band=1.0-abs(p.y-center)/(0.80+fbm*0.85);
    let form=min(band,0.14+baseShape*0.45+fbm*0.30-threshold);
    let eroded=form-detailMid*0.07;
    fine+=weights.y*max(smoothstep(-0.05,0.24,eroded),smoothstep(0.06,0.34,eroded)*1.35);
    macroDensity+=weights.y*max(smoothstep(-0.05,0.24,form),smoothstep(0.06,0.34,form)*1.35);
    signed=max(signed,eroded-(1.0-weights.y)*0.35);
  }
  if(weights.z>0.0) {
    // High, sparse wisps stay above the low weather. A minimum three-voxel
    // thickness keeps the thin material resolved instead of blinking away.
    let center=base+FIELD.gridSize.y*0.82+(shape.g-0.5)*0.55;
    let halfHeight=max(FIELD.gridSize.y/f32(FIELD.dimensions.y)*1.6,0.28);
    let band=1.0-abs(p.y-center)/halfHeight;
    let form=min(band,shelfShape-threshold*0.75-detailMid*0.08);
    fine+=weights.z*smoothstep(-0.045,0.25,form)*0.22;
    macroDensity+=weights.z*smoothstep(-0.045,0.25,form)*0.22;
    signed=max(signed,form-(1.0-weights.z)*0.35);
  }
  return vec3<f32>(fine*presence,macroDensity*presence,signed);
}

// Example arbitrary domain: rotate an analytic torus in place while its cloud
// material keeps advecting independently through it. Bounds are only an
// allocation/ray intersection box; no mesh or marching cubes are involved.
// Quantized cell periods match both value and slope across a repeated field.
// Offsets remain continuous, so animated noise travels through the join.
fn fieldNoise2D(p:vec2<f32>, frequency:vec2<f32>, offset:vec2<f32>)->f32 {
  let tiled=FIELD.dimensions.w>0u;
  let cells=max(round(frequency*FIELD.gridSize.xz),vec2<f32>(1.0));
  let rate=select(frequency,cells/FIELD.gridSize.xz,tiled);
  let q=p*rate+offset; let cell=floor(q); let f=fract(q);
  var a=cell; var b=cell+vec2<f32>(1.0,0.0);
  var c=cell+vec2<f32>(0.0,1.0); var d=cell+vec2<f32>(1.0);
  if(tiled){a-=floor(a/cells)*cells;b-=floor(b/cells)*cells;
    c-=floor(c/cells)*cells;d-=floor(d/cells)*cells;}
  let u=f*f*(3.0-2.0*f);
  return mix_f(mix_f(hash13_i(vec3<i32>(vec2<i32>(a),0)),hash13_i(vec3<i32>(vec2<i32>(b),0)),u.x),
    mix_f(hash13_i(vec3<i32>(vec2<i32>(c),0)),hash13_i(vec3<i32>(vec2<i32>(d),0)),u.x),u.y);
}

// A morning sky has two distinct scales: a broad low front and a broken,
// ruffled upper deck. Both are volumetric density, not camera-facing cards or
// repeated cumulus balls. Reuse the bake's filtered material bands.
fn morningRuffleBody(p:vec3<f32>, shape:vec4<f32>, detail:vec3<f32>, spacingY:f32)->vec3<f32> {
  let material = p + NTransform.shapeOffsetWorld;
  let height = FIELD.gridSize.y; let base = FIELD.gridMin.y;
  // Independent wind domains evolve the deck instead of translating a frozen
  // pattern. Existing animation offsets supply time, so Pause really freezes
  // the field and moving the camera cannot change the cloud anatomy.
  let evolution = NTransform.detailOffsetWorld.xz - NTransform.shapeOffsetWorld.xz;
  let weatherDrift = NTransform.weatherOffsetWorld.xz - NTransform.shapeOffsetWorld.xz;
  let broad = fieldNoise2D(material.xz,vec2<f32>(0.10),vec2<f32>(7.3,19.1));
  let broadOther = fieldNoise2D(material.xz+weatherDrift,vec2<f32>(0.17),vec2<f32>(23.7,4.6));
  let coverage = saturate(C.globalCoverage);
  let presence = smoothstep(0.0, 0.12, C.globalCoverage);
  let curl = vec2<f32>(fieldNoise2D(material.xz,vec2<f32>(0.25),evolution*0.45+vec2<f32>(1.7,8.3)),
    fieldNoise2D(material.xz,vec2<f32>(0.25),evolution*0.45+vec2<f32>(19.1,2.7))) - 0.5;
  let ruffleRate=vec2<f32>(1.0,1.65)/max(TUNE.puffScale,0.30);
  let ruffleWarp=vec2<f32>(broadOther-0.5,broad-0.5)*2.8+curl*1.2;
  let ruffleCoarse=fieldNoise2D(material.xz,ruffleRate,ruffleWarp+vec2<f32>(13.7,2.1));
  let ruffleFine=fieldNoise2D(material.xz,ruffleRate*2.1,ruffleWarp*2.1-evolution*0.8+vec2<f32>(3.1,21.7));
  let ripple = ridge01(ruffleCoarse * 0.72 + ruffleFine * 0.28);
  let upperCenter = base + height * (0.74 + (broad - 0.5) * 0.11)
    + (ruffleCoarse - 0.5) * height * 0.035 + (shape.b - 0.5) * 0.12;
  let upperHalf = max(spacingY * 2.2, height * (0.018 + ripple * 0.024));
  let upperBand = 1.0 - abs(p.y - upperCenter) / upperHalf;
  let upperOpening = broad * 0.63 + broadOther * 0.24 + shape.r * 0.13
    - mix_f(0.72, 0.36, coverage);
  let upperForm = min(upperBand, min(upperOpening * 2.8,
    (ruffleCoarse * 0.65 + ruffleFine * 0.35 - 0.46) * 3.4));
  let upperFine = upperForm - (detail.r * 0.5 + detail.g * 0.3 + detail.b * 0.2) * 0.055;
  // An irregular wind front occupies one region of the sky. Its underside is
  // lower and denser than the cloudlets, giving a slate bank near the horizon.
  let frontEdge = material.z + sin(material.x * 0.13) * 3.2 + (broad - 0.5) * 4.0;
  let periodicFront=sin(material.z*6.283185/FIELD.gridSize.z)
    +sin(material.x*6.283185/FIELD.gridSize.x)*0.35+(broad-0.5)*0.4;
  let front = select(1.0-smoothstep(-7.0,-2.0,frontEdge),
    1.0-smoothstep(-0.35,0.15,periodicFront),FIELD.dimensions.w>0u);
  let lowerCenter = base + height * (0.18 + (broadOther - 0.5) * 0.06)
    + (shape.g - 0.5) * height * 0.035;
  let lowerBand = 1.0 - abs(p.y - lowerCenter) / max(spacingY * 2.5,
    height * (0.075 + (shape.r * 0.6 + ruffleCoarse * 0.4) * 0.035));
  let lowerForm = min(lowerBand, front * 1.25 - 0.22 + (shape.g - 0.5) * 0.12);
  let fine = smoothstep(-0.035, 0.22, upperFine) * 0.72
    + smoothstep(-0.035, 0.24, lowerForm - detail.g * 0.035) * 1.20;
  let macroDensity = smoothstep(-0.035, 0.22, upperForm) * 0.72
    + smoothstep(-0.035, 0.24, lowerForm) * 1.20;
  return vec3<f32>(fine * presence, macroDensity * presence, max(upperFine, lowerForm));
}

// Thick connected folds on the cached volume path. All horizontal variation
// comes from periodic material textures, so wide skies keep their voxel detail
// and join at tile boundaries without camera-dependent procedural slices.
fn cachedInkFoldBody(p:vec3<f32>, shape:vec4<f32>, detail:vec3<f32>)->vec3<f32> {
  let ph = (p.y - FIELD.gridMin.y) / FIELD.gridSize.y;
  let roll = sin(shape.g * 6.283185 + shape.b * 2.4);
  let center = 0.49 + (shape.g - shape.b) * 0.48 + roll * 0.12;
  let thickness = 0.19 + shape.r * 0.16 + shape.a * 0.08;
  let mainBand = 1.0 - abs(ph - center) / thickness;
  // A second rolling shoulder grows out of the main mass, rather than a
  // disconnected planar deck. Each noise channel shifts its height and width.
  let shoulderCenter=center+0.16+(shape.b-0.5)*0.22;
  let shoulder=1.0-abs(ph-shoulderCenter)/(thickness*0.62);
  let band=max(mainBand,shoulder*(0.45+shape.g*0.45));
  let fbm=dot(shape.gba,vec3<f32>(0.625,0.25,0.125));
  let remapped=saturate((contrast01(shape.r,1.8)-fbm*0.90)/max(1.0-fbm*0.90,0.08));
  let closure = remapped - mix_f(0.76,0.22,saturate(C.globalCoverage));
  let form = min(band, closure * 3.2);
  let grain = dot(detail, vec3<f32>(0.42,0.34,0.24));
  let crease = pow(1.0 - ridge01(detail.g * 0.55 + shape.b * 0.45), 2.0);
  let erosion = (grain * 0.07 + crease * 0.10) * (1.0 - smoothstep(0.04,0.35,form) * 0.65);
  let signedForm = form - erosion;
  let presence = smoothstep(0.0,0.12,C.globalCoverage);
  return vec3<f32>(smoothstep(-0.035,0.20,signedForm) * presence,
    smoothstep(-0.035,0.20,form-erosion*0.4) * presence,signedForm);
}

// Analytic organization reuses the bake's filtered cloud-noise bands.
fn cloudSeaBody(p:vec3<f32>,shape:vec4<f32>,detail:vec3<f32>)->vec3<f32> {
  // Integer wave vectors close exactly over the cached tile. Independent
  // phase speeds make the sea slosh, instead of translating a frozen surface.
  let k=6.283185/FIELD.gridSize.xz;
  let pos=p.xz+NTransform.shapeOffsetWorld.xz;
  // The broad swell clock is independent of the slower fine-detail drift.
  let phase=NTransform.shapeOffsetWorld.x*0.65+NTransform.shapeOffsetWorld.z*0.30;
  let q=pos*k;
  // Tile-wide weather regions bend the swells and vary their energy. Warp
  // with periodic functions, rather than rotating/scaling tile coordinates:
  // both the heights and their slopes still agree at opposite tile edges.
  let region=0.5+0.5*sin(q.x+sin(q.y)*0.65)*cos(q.y-0.4);
  let warped=q+vec2<f32>(sin(q.y+sin(q.x)*0.4),sin(q.x-q.y+0.7))*0.48;
  let a=dot(warped,vec2<f32>(3.0,2.0))+phase;
  let b=dot(warped,vec2<f32>(-2.0,5.0))-phase*0.73;
  let c=dot(warped,vec2<f32>(7.0,9.0))+phase*1.21;
  let energy=0.30+region*0.90;
  let primary=sin(a+sin(b)*0.35);
  let crest=primary+0.30*(primary*primary-0.5);
  let swell=(crest*0.066+sin(b)*0.034+sin(c)*0.016)*energy
    +sin(q.x-q.y+0.4)*0.028;
  let height=FIELD.gridSize.y;
  // Filtered volume bands break up the smooth swell into cloud-sized billows.
  // Move the surface itself, retaining a solid sea underneath the rough skin.
  // More relief comes from the filtered, irregular bands than from the smooth
  // carrier waves. Short crossing ripples fray the crests without punching
  // holes through the filled volume; integer harmonics retain exact tiling.
  let ripples=sin(dot(warped,vec2<f32>(13.0,-7.0))+phase*1.6)*0.014
    +sin(dot(warped,vec2<f32>(9.0,15.0))-phase*1.3)*0.010;
  let scallop=abs(shape.g-shape.b)-0.25;
  let billows=((shape.r-0.5)*0.18+(shape.g-0.5)*0.09
    +(shape.b-0.5)*0.055+(detail.g-0.5)*0.04+scallop*0.065)*(0.70+region*0.30)+ripples;
  let surface=FIELD.gridMin.y+height*(0.53+swell+billows);
  let band=min((surface-p.y)/(height*0.065),(p.y-FIELD.gridMin.y-height*0.04)/(height*0.08));
  let skin=1.0-smoothstep(0.1,0.8,band);
  let form=band-(dot(detail,vec3<f32>(0.12,0.09,0.07))+abs(detail.r-detail.b)*0.28)*skin;
  let presence=smoothstep(0.0,0.12,C.globalCoverage);
  return vec3<f32>(smoothstep(-0.06,0.28,form)*presence,
    smoothstep(-0.06,0.28,band)*presence,form);
}

// Stretching texture alone cannot organize independent puffs into cloud streets.
fn parallelCloudBandBody(p:vec3<f32>,shape:vec4<f32>,detail:vec3<f32>)->vec3<f32> {
  let material=p+NTransform.shapeOffsetWorld;
  let width=max(TUNE.puffScale,1.0)*2.0;
  let along=material.z*6.283185/FIELD.gridSize.z;
  let bend=sin(along*2.0)*width*0.045+(shape.g-0.5)*width*0.045;
  let stripe=cos((material.x+bend)*6.283185/width);
  let center=FIELD.gridMin.y+FIELD.gridSize.y*(0.38+(shape.b-0.5)*0.24);
  let halfHeight=FIELD.gridSize.y*(0.14+shape.g*0.15);
  let band=1.0-abs(p.y-center)/max(halfHeight,0.1);
  let cross= (stripe-mix_f(0.82,0.05,saturate(C.globalCoverage)))*1.8;
  let billows=(shape.r-0.5)*0.90+(shape.a-0.5)*0.45+(shape.b-0.5)*0.25;
  let form=min(band,cross)+billows;
  let eroded=form-dot(detail,vec3<f32>(0.09,0.06,0.04))-abs(detail.r-detail.g)*0.20;
  let presence=smoothstep(0.0,0.12,C.globalCoverage);
  return vec3<f32>(smoothstep(-0.06,0.24,eroded)*presence,
    smoothstep(-0.06,0.24,form)*presence,eroded);
}

fn stormSpin()->f32 {
  // Existing material clocks freeze with Pause/capture; camera motion cannot
  // rotate the anatomy. No independent wall clock or extra texture is needed.
  return NTransform.shapeOffsetWorld.x*0.78;
}
fn stormMaterialPosition(p:vec3<f32>)->vec3<f32> {
  let center=FIELD.gridMin.xyz+FIELD.gridSize.xyz*0.5;
  let q=p-center;
  // Fine material rotates far more slowly than the analytic storm anatomy.
  // Sharing the full spin swept high-frequency bands across Balanced voxels.
  let fineSpin=stormSpin()*select(0.10,0.05,TUNE.formType>11.5);
  let turn=fineSpin+q.y/FIELD.gridSize.y*0.9;
  return center+vec3<f32>(cos(turn)*q.x+sin(turn)*q.z,q.y,-sin(turn)*q.x+cos(turn)*q.z);
}

fn hurricaneWallRadius(angle:f32,y:f32)->f32 {
  // Shallow, closely spaced helical riffles over a continuous widening wall.
  // The former large radial terraces made the eye read as folded sheets.
  return 0.25+y*0.22+sin(angle*5.0-y*30.0)*0.016
    +sin(angle*13.0-y*62.0+sin(angle*5.0-y*30.0)*0.25)*0.007;
}

// Finite storm scaffolds. The same cached 3D bands give them volumetric
// billows, so these are neither stacked cards nor a camera-dependent shell.
fn rotatingStormBody(p:vec3<f32>,shape:vec4<f32>,detail:vec3<f32>)->vec3<f32> {
  let center=FIELD.gridMin.xyz+FIELD.gridSize.xyz*0.5;
  let extent=min(FIELD.gridSize.x,FIELD.gridSize.z)*0.5;
  let q=(p-center)/vec3<f32>(extent,FIELD.gridSize.y,extent);
  let r=length(q.xz);
  let y=q.y+0.5;
  let angle=atan2(q.z,q.x)+stormSpin();
  let hurricane=TUNE.formType>11.5;
  let grain=dot(detail,vec3<f32>(0.42,0.34,0.24));
  let billow=(shape.r-0.5)*1.45+(shape.g-0.5)*0.90+(shape.b-0.5)*0.60;
  var form=-1.0;
  var rain=0.0;
  if(TUNE.formType<11.5) {
    // A broad layered mesocyclone, sloped shoulders and a lowered wall cloud.
    let terraces=sin(y*36.0+angle*2.0-r*9.0)*0.035;
    let outer=0.22+y*0.65+terraces+sin(angle*3.0-y*9.0)*0.025+(shape.g-0.5)*0.035;
    let shelf=min((outer-r)*5.0,min((y-0.36)*9.0,(0.83-y)*9.0));
    let wall=1.0-length(vec3<f32>(q.x/0.26,(y-0.36)/0.15,q.z/0.26));
    let anvil=(1.0-length(vec3<f32>(q.x/0.77,(y-0.79)/0.15,q.z/0.77)))*2.5;
    form=cloudSoftUnion(cloudSoftUnion(shelf,wall),anvil);
    // One broad translucent precipitation sector descends from the flank.
    // Coherent vertical streaks stay thicker than the balanced field voxels.
    let sector=smoothstep(-0.25,0.45,cos(angle-0.65));
    let curtainR=0.46+sin(angle*2.0-y*4.0)*0.055+y*0.08;
    let curtain=min((0.12-abs(r-curtainR))*7.0,min((y-0.02)*8.0,(0.46-y)*8.0));
    let streak=0.58+0.42*sin(angle*19.0+r*23.0+stormSpin()*0.6);
    rain=smoothstep(-0.06,0.18,curtain)*sector*streak*0.18;
  } else {
    // A solid radial body supports the riffles: no density modulation through
    // its interior and no large displacement that separates it into folds.
    let inner=hurricaneWallRadius(angle,y)+(shape.b-0.5)*0.008;
    let outer=0.79+sin(angle*5.0-y*30.0)*0.012+(shape.g-0.5)*0.012;
    let wall=min((r-inner)*7.0,(outer-r)*6.0);
    let heightBand=min((y-0.05)*8.0,(0.96-y)*10.0);
    form=min(wall,heightBand);
    // Wispy rain on the inner wall leaves the center entirely empty.
    rain=smoothstep(-0.04,0.10,min((r-inner+0.045)*8.0,(inner+0.07-r)*8.0))
      *smoothstep(0.03,0.18,y)*(1.0-smoothstep(0.50,0.76,y))*0.04;
  }
  // A broad outflow deck wraps around the upper storm. Spiral ridges vary its
  // thickness and outer edge, instead of reading as a smooth ellipsoid. The
  // hurricane retains its open eye through this deck as well as through the wall.
  let spiral=angle*3.0-r*18.0-y*3.0;
  let arm=sin(spiral+sin(angle*2.0-r*7.0)*0.35);
  let upperCenter=0.79+arm*select(0.055,0.018,hurricane)+(r-0.6)*0.06
    +(shape.g-0.5)*select(0.060,0.014,hurricane);
  let upperHalf=0.070+smoothstep(-0.65,0.85,arm)*0.055;
  let upperOuter=0.94+arm*0.025+(shape.b-0.5)*0.035;
  let upperInner=select(0.30,hurricaneWallRadius(angle,y),hurricane);
  let upper=min(min((r-upperInner)*8.0,(upperOuter-r)*10.0),
    (upperHalf-abs(y-upperCenter))*12.0);
  form=cloudSoftUnion(form,upper);
  // Both decks taper to zero before the finite cache boundary.
  form=min(form,(0.985-r)*12.0);
  // Roughen only a bounded skin. Dense interiors and the empty eye remain
  // intact, rather than carving the whole volume into detached wisps.
  let skin=(1.0-smoothstep(0.45,1.2,max(form,0.0)))
    *(1.0-smoothstep(0.10,0.65,max(-form,0.0)));
  let looseRoughness=clamp(billow,-0.80,0.70)-(grain-0.35)*0.34-abs(detail.r-detail.b)*0.24;
  let tightRoughness=clamp((shape.r-0.5)*0.32+(shape.g-0.5)*0.20+(shape.b-0.5)*0.12,-0.16,0.14)
    -(grain-0.35)*0.06-abs(detail.r-detail.b)*0.05;
  let roughOffset=select(looseRoughness,tightRoughness,hurricane);
  // Positive noise cannot seed a second population in empty space outside the
  // storm. Keep the breakup attached to the scaffold's existing surface.
  let attachedOffset=min(roughOffset,max(form+0.04,0.0)*1.2);
  let eroded=min(form+attachedOffset*skin,
    (0.98-r)*12.0);
  let presence=smoothstep(0.0,0.15,C.globalCoverage)*(1.0-smoothstep(0.94,0.985,r));
  return vec3<f32>((smoothstep(-0.05,0.27,eroded)*0.75+rain)*presence,
    (smoothstep(-0.05,0.27,form)*0.75+rain)*presence,eroded);
}

fn cloudTorusDistance(p: vec3<f32>) -> f32 {
  let v = p - (FIELD.gridMin.xyz + FIELD.gridSize.xyz * 0.5);
  let c = cos(FIELD.volume.y);
  let s = sin(FIELD.volume.y);
  let tilted = vec3<f32>(v.x, c * v.y + s * v.z, -s * v.y + c * v.z);
  let q = vec3<f32>(cos(0.35) * tilted.x + sin(0.35) * tilted.y,
    -sin(0.35) * tilted.x + cos(0.35) * tilted.y, tilted.z);
  let extent = min(min(FIELD.gridSize.x, FIELD.gridSize.y), FIELD.gridSize.z) * 0.5;
  return length(vec2<f32>(length(q.xz) - extent * FIELD.volume.z, q.y)) - extent * FIELD.volume.w;
}

fn galleryRotate(p:vec3<f32>, angle:f32) -> vec3<f32> {
  let a=vec3<f32>(cos(angle)*p.x+sin(angle)*p.z,p.y,-sin(angle)*p.x+cos(angle)*p.z);
  let b=angle*0.73;
  return vec3<f32>(a.x,cos(b)*a.y+sin(b)*a.z,-sin(b)*a.y+cos(b)*a.z);
}
fn cloudGalleryDistance(p:vec3<f32>) -> f32 {
  let extent=min(min(FIELD.gridSize.x,FIELD.gridSize.y),FIELD.gridSize.z)*0.5;
  let v=(p-(FIELD.gridMin.xyz+FIELD.gridSize.xyz*0.5))/extent;
  let t=FIELD.volume.y;
  let ring=galleryRotate(v,t);
  var distance=length(vec2<f32>(length(ring.xz)-0.38,ring.y))-0.105;
  let cube=abs(galleryRotate(v-vec3<f32>(-.62,.39,0),t*1.7))-vec3<f32>(.175);
  distance=min(distance,length(max(cube,vec3<f32>(0)))+min(max(max(cube.x,cube.y),cube.z),0.0));
  let egg=galleryRotate(v-vec3<f32>(.62,.39,0),t*2.3);
  distance=min(distance,(length(egg/vec3<f32>(.23,.13,.17))-1.0)*.13);
  var capsule=galleryRotate(v-vec3<f32>(-.60,-.43,0),t*2.8);
  capsule.y-=clamp(capsule.y,-.16,.16);
  distance=min(distance,length(capsule)-.11);
  let diamond=abs(galleryRotate(v-vec3<f32>(.60,-.43,0),t*3.2));
  distance=min(distance,(diamond.x+diamond.y+diamond.z-.30)*0.57735);
  return distance*extent;
}

fn arbitraryCloudBody(p: vec3<f32>, shape: vec4<f32>, detail: vec3<f32>) -> vec3<f32> {
  // A fully three-dimensional noise population, rather than extruding the
  // flat layer's common base through a torus. The mask can be replaced by any
  // other signed-distance function without changing raymarch/lighting stages.
  let fbm = dot(shape.gba, vec3<f32>(0.625, 0.25, 0.125));
  let baseShape = contrast01(shape.r, 1.24 + cloudDefinition01() * 0.38);
  let shelfShape = saturate((baseShape - fbm * 0.72) / max(1.0 - fbm * 0.72, 0.08));
  let macroSigned = 0.24 + (shelfShape - 0.22) * 0.55 + (fbm - 0.5) * 0.20;
  let scallop = mix_f(max(max(detail.r, detail.g), detail.b), 1.0 - min(min(detail.r, detail.g), detail.b), 0.42);
  let erosion = dot(detail, vec3<f32>(0.42, 0.34, 0.24)) * 0.10 + pow(1.0 - ridge01(contrast01(scallop, 2.4)), 1.35) * 0.14;
  let material = p + NTransform.shapeOffsetWorld;
  let weatherScale = select(NTransform.weatherScale, 1.0, NTransform.weatherScale == 0.0);
  let weather = wrap2D(weather2D, samp2D, fieldWeatherUV(material, weatherScale), 0i, 0.0);
  let presence = smoothstep(0.0, 0.15, C.globalCoverage) * mix_f(0.65, 1.0, saturate(weather.r)) * (1.0 - smoothstep(0.85, 1.0, weather.b));
  let variation = mix_f(0.55, 1.0, shelfShape) * presence;
  return vec3<f32>(smoothstep(-0.065, 0.28, macroSigned - erosion) * variation,
    smoothstep(-0.065, 0.28, macroSigned) * variation, macroSigned - erosion * 0.65);
}

@compute @workgroup_size(4, 4, 4)
fn buildCloudDensityField(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  initCloudWorkgroup(lid);
  if (any(gid >= FIELD.dimensions.xyz)) { return; }
  let uv = (vec3<f32>(gid) + 0.5) / vec3<f32>(FIELD.dimensions.xyz);
  let p = FIELD.gridMin.xyz + uv * FIELD.gridSize.xyz;
  var materialP=p;
  if(TUNE.formType>10.5 && TUNE.formType<12.5){materialP=stormMaterialPosition(p);}
  let ph = uv.y;
  // These forms already have a vertical scaffold and an anvil. Applying the
  // thin-layer's anvil warp/vertical retiling again aliases that texture into
  // horizontal stripes/speckles, especially in tall storms. Use world-space,
  // voxel-bandlimited noise here; keep the original mapping in Layer mode.
  let shapeAxisInput = axisOrOne3(NTransform.shapeAxisScale);
  let detailAxisInput = axisOrOne3(NTransform.detailAxisScale);
  // Tall presets used thin-layer Y compression, producing horizontal noise
  // rings on the towers. In a true volume use near-isotropic rolling structure.
  let shapeAxis = vec3<f32>(shapeAxisInput.x, sign(shapeAxisInput.y) * sqrt(abs(shapeAxisInput.y)), shapeAxisInput.z);
  let detailAxis = vec3<f32>(detailAxisInput.x, sign(detailAxisInput.y) * sqrt(abs(detailAxisInput.y)), detailAxisInput.z);
  // Thin-layer noise repeated too rapidly across tall bodies, breaking every
  // shoulder into vapor. Separate the broad rolling mass from detail erosion.
  let shapeScale = wg_scaleS * select(NTransform.shapeScale, 1.0, NTransform.shapeScale == 0.0)
    * select(0.35,0.85,TUNE.formType>8.5);
  let featureShapeScale=shapeScale*select(select(select(1.0,2.2,TUNE.formType>9.5),3.2,TUNE.formType>12.5),
    select(4.0,5.2,TUNE.formType>11.5),TUNE.formType>10.5 && TUNE.formType<12.5);
  // Thin-layer detail repeats several times per world unit. At field resolution
  // that selects the final 1x1 mip and erases every valley. Map those same bands
  // to resolvable billow-sized features; still use the actual voxel footprint.
  let detailScale = wg_scaleD * select(NTransform.detailScale, 1.0, NTransform.detailScale == 0.0)
    * select(0.04,0.065,TUNE.formType>11.5 && TUNE.formType<12.5);
  let spacing = FIELD.gridSize.xyz / vec3<f32>(FIELD.dimensions.xyz);
  // Include the sheared storm material mapping in its filter footprint. This
  // keeps fine bands below the voxel limit without raising cache resolution.
  let stormFilter=select(1.0,1.6,TUNE.formType>10.5 && TUNE.formType<12.5);
  let shapeFootprint = spacing * abs(shapeAxis * featureShapeScale) * wg_shapeDim * stormFilter;
  let detailFootprint = spacing * abs(detailAxis * detailScale) * wg_detailDim * stormFilter;
  let shapeLOD = clamp(log2(max(max(shapeFootprint.x, shapeFootprint.y), max(shapeFootprint.z, 1.0))), 0.0, wg_maxMipS);
  let detailLOD = clamp(log2(max(max(detailFootprint.x, detailFootprint.y), max(detailFootprint.z, 1.0))), 0.0, wg_maxMipD);
  let detailAdvection=NTransform.detailOffsetWorld*select(1.0,0.15,TUNE.formType>10.5 && TUNE.formType<12.5);
  let detail = wrap3D_detail(detail3D, sampDetail, (materialP + detailAdvection) * fieldPeriodicScale(detailAxis * detailScale), detailLOD).rgb;
  // The independently moving detail domain bends shoulders as well as eroding
  // them. This is continuous volumetric billowing, not a time-varying Y scale.
  let detailWarp = (detail - 0.5) * max(TUNE.puffScale, 0.75) * vec3<f32>(0.16, 0.12, 0.16);
  // Tight surface billows drift more slowly than the organizing storm/sea
  // scaffold, retaining its rotation and swells without rapid small features.
  let shapeAdvection=NTransform.shapeOffsetWorld*select(select(1.0,0.35,TUNE.formType>10.5),0.025,TUNE.formType>10.5 && TUNE.formType<12.5);
  let shape = wrap3D_shape(shape3D, sampShape, (materialP + detailWarp + shapeAdvection) * fieldPeriodicScale(shapeAxis * featureShapeScale), shapeLOD);
  // All four prefiltered shape bands contribute: broad domain distortion hides
  // the scaffold; the Rain Shelf closure gives the whole volume broken density.
  // No additional texture fetches or per-ray procedural noise are required.
  let distortion = (shape.gba - 0.5) * max(TUNE.puffScale, 0.75) * vec3<f32>(0.32, 0.18, 0.32) + detailWarp;
  var body: vec3<f32>;
  var baseFade = 1.0;
  if (FIELD.volume.x > 0.5) {
    body = arbitraryCloudBody(p, shape, detail);
    var distance = cloudTorusDistance(p);
    if(FIELD.volume.x > 1.5) { distance=cloudGalleryDistance(p); }
    let feather = max(max(spacing.x, spacing.y), spacing.z) * 1.2;
    let irregularDistance=distance+(shape.g-0.5)*max(feather*2.0,TUNE.puffScale*0.16)+(detail.g-0.5)*feather*0.5;
    let mask = 1.0 - smoothstep(-feather, feather, irregularDistance);
    body = vec3<f32>(body.xy * mask, min(body.z, -irregularDistance / max(feather * 4.0, EPS)));
  } else if (TUNE.formType > 12.5) {
    body=cloudSeaBody(p,shape,detail);
  } else if (TUNE.formType > 10.5) {
    body=rotatingStormBody(p,shape,detail);
  } else if (TUNE.formType > 9.5) {
    body=parallelCloudBandBody(p,shape,detail);
  } else if (TUNE.formType > 8.5) {
    body = cachedInkFoldBody(p, shape, detail);
    baseFade = smoothstep(0.02, 0.08, ph) * (1.0 - smoothstep(0.92, 0.98, ph));
  } else if (TUNE.formType > 7.5) {
    body = morningRuffleBody(p, shape, detail, spacing.y);
    baseFade = smoothstep(0.02, 0.08, ph) * (1.0 - smoothstep(0.96, 1.0, ph));
  } else {
    let weights=clamp(vec3<f32>(FIELD.gridMin.w,FIELD.gridSize.w,FIELD.volume.w),vec3<f32>(0.0),vec3<f32>(1.0));
    var featureWeights = clamp(FIELD.morphology.xyz, vec3<f32>(0.0), vec3<f32>(1.0));
    if (TUNE.formType > 4.5) {
      featureWeights = vec3<f32>(select(0.0, 1.0, TUNE.formType < 5.5),
        select(0.0, 1.0, TUNE.formType >= 5.5 && TUNE.formType < 6.5), select(0.0, 1.0, TUNE.formType >= 6.5));
    }
    let layeredWeight=saturate(weights.x+weights.y+weights.z+featureWeights.x+featureWeights.y+featureWeights.z);
    let convectiveWeight=1.0-layeredWeight;
    body=vec3<f32>(0.0,0.0,-1.0);
    if(convectiveWeight>0.0) {
      let convective=roundedCloudBody(p+distortion,shape,detail);
      body=vec3<f32>(convective.xy*convectiveWeight,convective.z-layeredWeight*0.35);
    }
    if(weights.x+weights.y+weights.z>0.0) {
      var shelfBands=shape;
      var shelfDetail=detail;
      if(weights.x>0.0) {
        // Two shelf-only filtered reads during the cached density bake, never
        // per screen ray. Separate coordinates avoid warping the towers during
        // a crossfade; each band's LOD follows the actual density-voxel footprint.
        let rippleShapeScale=shapeScale*2.35;
        let rippleDetailScale=detailScale*2.50;
        let rippleShapeFP=spacing*abs(shapeAxis*rippleShapeScale)*wg_shapeDim;
        let rippleDetailFP=spacing*abs(detailAxis*rippleDetailScale)*wg_detailDim;
        let rippleShapeLOD=clamp(log2(max(max(rippleShapeFP.x,rippleShapeFP.y),max(rippleShapeFP.z,1.0))),0.0,wg_maxMipS);
        let rippleDetailLOD=clamp(log2(max(max(rippleDetailFP.x,rippleDetailFP.y),max(rippleDetailFP.z,1.0))),0.0,wg_maxMipD);
        shelfBands=wrap3D_shape(shape3D,sampShape,(p+detailWarp*0.45+NTransform.shapeOffsetWorld)*shapeAxis*rippleShapeScale,rippleShapeLOD);
        shelfDetail=wrap3D_detail(detail3D,sampDetail,(p+NTransform.detailOffsetWorld)*detailAxis*rippleDetailScale,rippleDetailLOD).rgb;
      }
      let layered=layeredWeatherBody(p+distortion*vec3<f32>(1.0,0.45,1.0),shape,detail,weights,shelfBands,shelfDetail);
      body=vec3<f32>(body.xy+layered.xy,max(body.z,layered.z));
    }
    if (featureWeights.x+featureWeights.y+featureWeights.z > 0.0) {
      let feature = featureWeatherBody(p, shape, detail, featureWeights);
      body = vec3<f32>(body.xy+feature.xy, max(body.z, feature.z));
    }
    baseFade = smoothstep(0.02, 0.13, ph) * (1.0 - smoothstep(0.97, 1.0, ph));
  }
  let toMin = p.xz - FIELD.gridMin.xz;
  let toMax = FIELD.gridMin.xz + FIELD.gridSize.xz - p.xz;
  let edgeDistance = min(min(toMin.x, toMin.y), min(toMax.x, toMax.y));
  let edgeFade = select(smoothstep(0.0, max(TUNE.puffScale * 0.55, 0.1), edgeDistance),1.0,FIELD.dimensions.w>0u);
  let densityScale = max(C.globalDensity, 0.0) * 1.6 * baseFade * edgeFade;
  // B is a conservative density bound. Coarser levels take its maximum;
  // R/G/A retain their average filtering for visible density and lighting.
  textureStore(cloudDensityOut, vec3<i32>(gid), vec4<f32>(body.xy * densityScale, max(body.x * densityScale, 0.0), max(body.z, -0.30)));
}

@compute @workgroup_size(4, 4, 4)
fn buildCloudLightField(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (any(gid >= FIELD.dimensions.xyz)) { return; }
  let uv = (vec3<f32>(gid) + 0.5) / vec3<f32>(FIELD.dimensions.xyz);
  let p = FIELD.gridMin.xyz + uv * FIELD.gridSize.xyz;
  let spacing = FIELD.gridSize.xyz / vec3<f32>(FIELD.dimensions.xyz);
  let current = fieldDensityAt(p).y;
  let offsets = array<vec3<f32>, 6>(vec3<f32>(1,0,0), vec3<f32>(-1,0,0), vec3<f32>(0,1,0), vec3<f32>(0,-1,0), vec3<f32>(0,0,1), vec3<f32>(0,0,-1));
  var neighbors: array<f32, 6>;
  // Signed form gradients remain meaningful inside saturated density; gradients
  // of the density plateau would fall back to a flat upward normal there.
  // A one-cell empty halo must carry real lighting too: trilinear density can
  // be nonzero there. Returning full sunlight for every empty voxel made the
  // moving boundary alternately interpolate lit and shadowed texels.
  var nearbyDensity = current;
  let normalSpacing = spacing * 1.5;
  for (var i = 0u; i < 6u; i++) {
    let neighbor = fieldSampleAt(p + offsets[i] * normalSpacing);
    neighbors[i] = neighbor.a;
    nearbyDensity = max(nearbyDensity, neighbor.g);
  }
  let sunDir = normalizeOr(L.sunDir, vec3<f32>(0.0, 1.0, 0.0));
  if (nearbyDensity < 0.0001) {
    textureStore(cloudLightOut, vec3<i32>(gid), vec4<f32>(max(sunDir.y, 0.0), 1.0, 1.0, 1.0));
    return;
  }
  let gradient = vec3<f32>(neighbors[0] - neighbors[1], neighbors[2] - neighbors[3], neighbors[4] - neighbors[5]) / max(normalSpacing, vec3<f32>(EPS));
  let normal = normalizeOr(-gradient, vec3<f32>(0.0, 1.0, 0.0));
  let reach = min(4.6, max(TUNE.puffScale * 0.95, FIELD.gridSize.y * 0.85));
  // Midpoint quadrature, with two samples per crossed density cell. The cap
  // bounds cached-field work; no secondary march is added to screen-space rays.
  let sunVoxelStep = 1.0 / max(max(abs(sunDir.x) / spacing.x, abs(sunDir.y) / spacing.y), abs(sunDir.z) / spacing.z);
  let shadowSteps = u32(clamp(ceil(reach / sunVoxelStep * 2.0), 16.0,
    select(48.0,24.0,TUNE.formType>8.5)));
  let step = reach / f32(shadowSteps);
  var opticalDepth = 0.0;
  for (var i = 0u; i < shadowSteps; i++) {
    opticalDepth += fieldDensityAt(p + sunDir * ((f32(i) + 0.5) * step)).y * step * SUN_EXTINCTION_SCALE;
  }
  let sunVisibility = exp(-opticalDepth * max(C.cloudBeer, EPS));
  let aoRadius = max(TUNE.puffScale * 0.12, min(FIELD.gridSize.y * 0.12, 0.50));
  var surrounding = 0.0;
  for (var i = 0u; i < 6u; i++) {
    // Favor the outward hemisphere: nearby shoulders darken creases, without
    // treating the opaque cloud interior as uniform ambient occlusion.
    let weight = 0.15 + 0.85 * max(dot(offsets[i], normal), 0.0);
    let near = fieldDensityAt(p + offsets[i] * aoRadius).y;
    let far = fieldDensityAt(p + offsets[i] * aoRadius * 2.4).y;
    surrounding += (max(near - current * 0.20, 0.0) * 0.6 + max(far - current * 0.10, 0.0) * 0.4) * weight;
  }
  let ambientVisibility = clamp(exp(-surrounding * aoRadius * 0.065), 0.18, 1.0);
  // Store filterable responses, not octahedral coordinates. Encoded normals
  // have a wrap seam: filtering them before decoding can flip the light across
  // a whole moving patch even when the actual normals are almost identical.
  let diffuse = max(dot(normal, sunDir), 0.0);
  let upper = saturate(normal.y * 0.5 + 0.5);
  textureStore(cloudLightOut, vec3<i32>(gid), vec4<f32>(diffuse, upper, sunVisibility, ambientVisibility));
}
