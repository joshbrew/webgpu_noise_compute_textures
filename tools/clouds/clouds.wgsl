const PI: f32 = 3.141592653589793;
const EPS: f32 = 1e-6;
const LN2: f32 = 0.6931471805599453;
const INV_LN2: f32 = 1.4426950408889634;
const VIEW_EXTINCTION_SCALE: f32 = 0.075;
const SUN_EXTINCTION_SCALE: f32 = 0.014;
const DENSITY_LIGHT_SCALE: f32 = 0.01;

// 0 = local AABB clouds, 1 = spherical planet clouds, 2 = aurora shell.
// The JavaScript side builds one full-detail pipeline per active mode. This is
// compile-time specialization only; it does not change the visual quality path.
override CLOUD_RENDER_MODE: u32 = 0u;
override CLOUD_USE_CUSTOM_POS: u32 = 0u;
override CLOUD_WRITE_RGB: u32 = 1u;

// ---------------------- TUNING UNIFORM
struct CloudTuning {
  maxSteps: i32,
  sunSteps: i32,
  sunStride: i32,
  _pad0_i: i32,

  minStep: f32,
  maxStep: f32,
  sunMinTr: f32,
  phaseJitter: f32,

  stepJitter: f32,
  baseJitterFrac: f32,
  topJitterFrac: f32,
  lodBiasWeather: f32,

  aabbFaceOffset: f32,
  weatherRejectGate: f32,
  weatherRejectMip: f32,
  emptySkipMult: f32,

  nearFluffDist: f32,
  nearStepScale: f32,
  nearLodBias: f32,
  nearDensityMult: f32,

  nearDensityRange: f32,
  lodBlendThreshold: f32,
  sunDensityGate: f32,
  fflyRelClamp: f32,

  fflyAbsFloor: f32,
  taaRelMin: f32,
  taaRelMax: f32,
  taaAbsEps: f32,

  farStart: f32,
  farFull: f32,
  farLodPush: f32,
  farDetailAtten: f32,

  farStepMult: f32,
  bnFarScale: f32,
  farTaaHistoryBoost: f32,
  raySmoothDens: f32,

  raySmoothSun: f32,
  fluffFactor: f32,
  anvilLift: f32,
  alphaCutoff: f32,

  thickBoxPerf: f32,
  thickStepBoost: f32,
  thickDetailSkip: f32,
  thickLightSkip: f32,

  verticalStepBoost: f32,
  verticalTextureHomogeneity: f32,
  verticalLightingStepBoost: f32,
  frontOcclusionStrength: f32,

  frontOcclusionAlpha: f32,
  frontOcclusionStepBoost: f32,
  sliceJitterStrength: f32,
  verticalLayerDecorrelation: f32,

  directLightBlend: f32,
  directLightBoost: f32,
  alphaBoostThreshold: f32,
  alphaBoostAmount: f32,

  minOutputAlpha: f32,
  outputAlphaFeather: f32,
  sparsity: f32,
  definition: f32
};
@group(0) @binding(10) var<uniform> TUNE: CloudTuning;

// ---------------------- existing uniforms / resources (preserved layout)
struct CloudOptions {
  useCustomPos: u32,
  outputChannel: u32,
  writeRGB: u32,
  _p0: u32,
  _r0: f32,
  _r1: f32,
  _r2: f32,
  _r3: f32
};
@group(0) @binding(0) var<uniform> opt: CloudOptions;

struct CloudParams {
  globalCoverage: f32,
  globalDensity: f32,
  cloudAnvilAmount: f32,
  cloudBeer: f32,
  attenuationClamp: f32,
  inScatterG: f32,
  silverIntensity: f32,
  silverExponent: f32,
  outScatterG: f32,
  inVsOut: f32,
  outScatterAmbientAmt: f32,
  ambientMinimum: f32,
  sunColor: vec3<f32>,
  _sunColorPad: f32,

  densityDivMin: f32,
  silverDirectionBias: f32,
  silverHorizonBoost: f32,
  _pad0: f32,

  frontLightColor: vec3<f32>,
  _frontLightPad: f32,

  shadowLightColor: vec3<f32>,
  _shadowLightPad: f32
};
@group(0) @binding(1) var<uniform> C: CloudParams;

struct Dummy { _pad: u32 };
@group(0) @binding(2) var<storage, read> unused: Dummy;

// ---------------------- NoiseTransforms (binding 3)
struct NoiseTransforms {
  shapeOffsetWorld: vec3<f32>,
  _pad0: f32,

  detailOffsetWorld: vec3<f32>,
  _pad1: f32,

  shapeScale: f32,
  detailScale: f32,
  weatherScale: f32,
  _pad2: f32,

  shapeAxisScale: vec3<f32>,
  _pad3: f32,

  detailAxisScale: vec3<f32>,
  _pad4: f32,

  weatherOffsetWorld: vec3<f32>,
  _pad5: f32,

  weatherAxisScale: vec3<f32>,
  _pad6: f32,

  shapeBias: f32,
  detailBias: f32,
  weatherBias: f32,
  _pad7: f32
};
@group(0) @binding(3) var<uniform> NTransform: NoiseTransforms;

@group(0) @binding(4) var outTex: texture_storage_2d_array<rgba16float, write>;
@group(0) @binding(5) var<storage, read> posBuf: array<vec4<f32>>;

struct Frame {
  fullWidth: u32, fullHeight: u32,
  tileWidth: u32, tileHeight: u32,
  originX: i32, originY: i32, originZ: i32,
  fullDepth: u32, tileDepth: u32,
  layerIndex: i32, layers: u32,
  _pad0: u32,
  originXf: f32, originYf: f32, _pad1: f32, _pad2: f32
};
@group(0) @binding(6) var<uniform> frame: Frame;

@group(0) @binding(7) var historyOut: texture_storage_2d_array<rgba16float, write>;

struct ReprojSettings {
  enabled: u32,
  subsample: u32,
  sampleOffset: u32,
  motionIsNormalized: u32,
  temporalBlend: f32,
  depthTest: u32,
  depthTolerance: f32,
  frameIndex: u32,
  fullWidth: u32,
  fullHeight: u32,
  temporalCellRate: u32,
  temporalCellPhase: u32,
  compactInterleave: u32,
  _reprojPad0: u32,
  _reprojPad1: u32,
  _reprojPad2: u32
};
@group(0) @binding(8) var<uniform> reproj: ReprojSettings;

struct PerfParams {
  lodBiasMul: f32,
  coarseMipBias: f32,
  _pad0: f32,
  _pad1: f32
};
@group(0) @binding(9) var<uniform> perf: PerfParams;

// ---------------------- textures/samplers (preserved layout)
@group(1) @binding(0) var weather2D: texture_2d_array<f32>;
@group(1) @binding(1) var samp2D: sampler;

@group(1) @binding(2) var shape3D: texture_3d<f32>;
@group(1) @binding(3) var sampShape: sampler;

@group(1) @binding(4) var blueTex: texture_2d_array<f32>;
@group(1) @binding(5) var sampBN: sampler;

@group(1) @binding(6) var detail3D: texture_3d<f32>;
@group(1) @binding(7) var sampDetail: sampler;

struct LightInputs { sunDir: vec3<f32>, _0: f32, camPos: vec3<f32>, _1: f32 };
@group(1) @binding(8) var<uniform> L: LightInputs;

struct View {
  camPos: vec3<f32>, _v0: f32,
  right: vec3<f32>, _v1: f32,
  up: vec3<f32>, _v2: f32,
  fwd: vec3<f32>, _v3: f32,
  fovY: f32, aspect: f32, stepBase: f32, stepInc: f32,
  planetRadius: f32, cloudBottom: f32, cloudTop: f32, volumeLayers: f32,
  worldToUV: f32, _a: f32, _b: f32, _c: f32
};
@group(1) @binding(9) var<uniform> V: View;

struct Box {
  center: vec3<f32>, _b0: f32,
  half: vec3<f32>, uvScale: f32
};
@group(1) @binding(10) var<uniform> B: Box;

@group(1) @binding(11) var historyPrev: texture_2d_array<f32>;
@group(1) @binding(12) var sampHistory: sampler;

@group(1) @binding(13) var motionTex: texture_2d<f32>;
@group(1) @binding(14) var sampMotion: sampler;

@group(1) @binding(15) var depthPrev: texture_2d<f32>;
@group(1) @binding(16) var sampDepth: sampler;

// ---------------------- Workgroup cache
var<workgroup> wg_weatherDim: vec2<f32>;
var<workgroup> wg_blueDim: vec2<f32>;
var<workgroup> wg_shapeDim: vec3<f32>;
var<workgroup> wg_detailDim: vec3<f32>;
var<workgroup> wg_weatherUvMul: vec2<f32>;
var<workgroup> wg_weatherUvAdd: vec2<f32>;
var<workgroup> wg_shapeUvMul: vec3<f32>;
var<workgroup> wg_shapeUvAdd: vec3<f32>;
var<workgroup> wg_detailUvMul: vec3<f32>;
var<workgroup> wg_detailUvAdd: vec3<f32>;
var<workgroup> wg_maxMipW: f32;
var<workgroup> wg_maxMipS: f32;
var<workgroup> wg_maxMipD: f32;
var<workgroup> wg_scaleS: f32;
var<workgroup> wg_scaleD: f32;
var<workgroup> wg_scaleS_effMax: f32;
var<workgroup> wg_scaleD_effMax: f32;
var<workgroup> wg_finestWorld: f32;
var<workgroup> wg_boxMaxXZ: f32;
var<workgroup> wg_tallBlend: f32;
var<workgroup> wg_thickPerfStrength: f32;
var<workgroup> wg_verticalRefHalfY: f32;
var<workgroup> wg_verticalRefBoxH: f32;
var<workgroup> wg_weatherAxisYAbs: f32;
var<workgroup> wg_verticalHomogeneity: f32;
var<workgroup> wg_verticalDomainScale: f32;
var<workgroup> wg_boxMinCached: vec3<f32>;
var<workgroup> wg_boxMaxCached: vec3<f32>;

// ---------------------- helpers
fn saturate(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }
fn mix_f(a: f32, b: f32, t: f32) -> f32 { return a * (1.0 - t) + b * t; }
fn mix_v3(a: vec3<f32>, b: vec3<f32>, t: f32) -> vec3<f32> { return a * (1.0 - t) + b * t; }
fn mix_v4(a: vec4<f32>, b: vec4<f32>, t: f32) -> vec4<f32> { return a * (1.0 - t) + b * t; }
fn remap(v: f32, a: f32, b: f32, c: f32, d: f32) -> f32 { return c + (v - a) * (d - c) / max(b - a, EPS); }
fn luminance(c: vec3<f32>) -> f32 { return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722)); }

fn clamp_luma_to(val: vec3<f32>, refc: vec3<f32>, rel: f32, abs_eps: f32) -> vec3<f32> {
  let tL = luminance(refc);
  let vL = max(luminance(val), 1e-6);
  let hi = tL * (1.0 + rel) + abs_eps;
  let lo = max(tL * (1.0 - rel) - abs_eps, 0.0);
  if (vL > hi) { return val * (hi / vL); }
  if (vL < lo) { return val * (max(lo, 1e-6) / vL); }
  return val;
}

fn axisOrOne3(v: vec3<f32>) -> vec3<f32> {
  return select(v, vec3<f32>(1.0), abs(v) < vec3<f32>(EPS));
}

fn axisMaxAbs3(v: vec3<f32>) -> f32 {
  let a = abs(v);
  return max(a.x, max(a.y, a.z));
}

// tiny hash
fn hash13_i(p: vec3<i32>) -> f32 {
  var h: u32 = 374761393u * u32(p.x) + 668265263u * u32(p.y) + 362437u * u32(p.z);
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h) * 2.3283064365386963e-10;
}

fn smoothCellHash2D(p: vec2<f32>, freq: f32) -> f32 {
  let uv = p * freq;
  let i = floor(uv);
  let f = fract(uv);
  let h00 = hash13_i(vec3<i32>(i32(i.x), i32(i.y), 0));
  let h10 = hash13_i(vec3<i32>(i32(i.x) + 1, i32(i.y), 0));
  let h01 = hash13_i(vec3<i32>(i32(i.x), i32(i.y) + 1, 0));
  let h11 = hash13_i(vec3<i32>(i32(i.x) + 1, i32(i.y) + 1, 0));
  let u = f * f * (3.0 - 2.0 * f);
  return mix_f(mix_f(h00, h10, u.x), mix_f(h01, h11, u.x), u.y);
}

// texture wrappers
fn wrap2D_raw(tex: texture_2d_array<f32>, samp: sampler, uv: vec2<f32>, layer_idx: i32, lod: f32) -> vec4<f32> {
  return textureSampleLevel(tex, samp, uv * wg_weatherUvMul + wg_weatherUvAdd, layer_idx, lod);
}

fn wrap2D_spherical_raw(tex: texture_2d_array<f32>, samp: sampler, uv: vec2<f32>, layer_idx: i32, lod: f32) -> vec4<f32> {
  // For spherical clouds, U must truly repeat. The old edge-padding path
  // compressed U away from 0/1, which made the first and last longitude columns
  // resolve differently and produced the visible vertical wrap seam.
  let epY = 0.5 / max(wg_weatherDim.y, 1.0);
  let u = fract(uv.x);
  let v = clamp(uv.y, epY, 1.0 - epY);
  return textureSampleLevel(tex, samp, vec2<f32>(u, v), layer_idx, lod);
}

fn wrap2D(tex: texture_2d_array<f32>, samp: sampler, uv: vec2<f32>, layer_idx: i32, lod: f32) -> vec4<f32> {
  var v: vec4<f32>;

  if (sphericalCloudMode()) {
    let uvS = vec2<f32>(fract(uv.x), clamp(uv.y, 0.0, 1.0));

    // Equirect weather becomes dense/pinched near poles. Raise LOD there and
    // average longitudes lightly so high coverage does not expose polar streaks.
    let poleF = max(
      1.0 - smoothstep(0.035, 0.18, uvS.y),
      smoothstep(0.82, 0.965, uvS.y)
    );
    let lodS = clamp(lod + poleF * 1.35, 0.0, wg_maxMipW);
    let base = wrap2D_spherical_raw(tex, samp, uvS, layer_idx, lodS);

    if (poleF > 0.001) {
      let a = wrap2D_spherical_raw(tex, samp, uvS + vec2<f32>(0.25, 0.0), layer_idx, lodS);
      let b = wrap2D_spherical_raw(tex, samp, uvS + vec2<f32>(-0.25, 0.0), layer_idx, lodS);
      v = mix_v4(base, (base + a + b) * (1.0 / 3.0), poleF * 0.72);
    } else {
      v = base;
    }
  } else {
    v = wrap2D_raw(tex, samp, uv, layer_idx, lod);
  }

  let bias = NTransform.weatherBias;
  return vec4<f32>(
    clamp(v.r + bias, 0.0, 1.0),
    clamp(v.g + bias, 0.0, 1.0),
    v.b,
    v.a
  );
}

fn wrap3D_shape(tex: texture_3d<f32>, samp: sampler, uvw: vec3<f32>, lod: f32) -> vec4<f32> {
  let v = textureSampleLevel(tex, samp, uvw * wg_shapeUvMul + wg_shapeUvAdd, lod);
  return clamp(v + vec4<f32>(NTransform.shapeBias), vec4<f32>(0.0), vec4<f32>(1.0));
}

fn wrap3D_detail(tex: texture_3d<f32>, samp: sampler, uvw: vec3<f32>, lod: f32) -> vec4<f32> {
  let v = textureSampleLevel(tex, samp, uvw * wg_detailUvMul + wg_detailUvAdd, lod);
  return vec4<f32>(
    clamp(v.rgb + vec3<f32>(NTransform.detailBias), vec3<f32>(0.0), vec3<f32>(1.0)),
    v.a
  );
}

// blue noise
fn frameBlueOffset() -> vec2<i32> {
  return vec2<i32>(0, 0);
}

fn sampleBlueScreenScaled(pixI: vec2<i32>, pixelScale: f32) -> f32 {
  let scale = max(pixelScale, 1.0);
  let ioff = frameBlueOffset();
  let baseOff = vec2<f32>(f32(ioff.x), f32(ioff.y));
  let p = (vec2<f32>(f32(pixI.x), f32(pixI.y)) + baseOff + vec2<f32>(0.5, 0.5)) / scale;
  let uv0 = p / wg_blueDim;
  let uv1 = (p + vec2<f32>(17.0, 29.0)) / wg_blueDim;
  let a = textureSampleLevel(blueTex, sampBN, uv0, 0i, 0.0).r;
  let b = textureSampleLevel(blueTex, sampBN, uv1, 0i, 0.0).r;
  return mix_f(a, b, 0.38196601125);
}

fn sampleBlueScreen(pixI: vec2<i32>) -> f32 {
  return sampleBlueScreenScaled(pixI, 1.0);
}

fn distanceBlueScreen(pixI: vec2<i32>, rayDistance: f32, nearDistance: f32) -> f32 {
  let distF = smoothstep(max(nearDistance * 0.12, 0.06), max(nearDistance * 0.90, 0.08), rayDistance);
  let nearScale = mix_f(4.0, 1.0, distF);
  let fine = sampleBlueScreenScaled(pixI, 1.0);
  let soft = sampleBlueScreenScaled(pixI, nearScale);
  let centered = mix_f(soft, fine, distF) - 0.5;
  let amp = mix_f(0.38, 1.0, distF);
  return clamp(0.5 + centered * amp, 0.0, 1.0);
}

// box helpers
fn anvilStrength() -> f32 {
  let a = anvilAmount();
  let overdrive = anvilOverdrive();
  return a + overdrive * 0.62;
}

fn anvilExaggeration() -> f32 {
  return clamp(max(TUNE.anvilLift, 0.0) / 0.60, 0.0, 5.0);
}

fn anvilLiftWorld() -> f32 {
  let boxH = max(verticalReferenceBoxH(), EPS);
  let tower = anvilTowerStrength();
  let overdrive = anvilOverdrive();
  let exag = anvilExaggeration();
  return boxH * anvilStrength() * exag * (mix_f(0.18, 0.46, tower) + overdrive * 0.055);
}

fn boxMin() -> vec3<f32> { return wg_boxMinCached; }
fn boxMax() -> vec3<f32> { return wg_boxMaxCached; }

fn anvilShapePos(pos: vec3<f32>, ph: f32) -> vec3<f32> {
  let anvil = anvilStrength();
  if (anvil <= 0.0) {
    return pos;
  }

  let phs = saturate(ph);
  let tower = anvilTowerStrength();
  let overdrive = anvilOverdrive();
  let exag = anvilExaggeration();

  // The lower storm body keeps its original footprint. The anvil deformation
  // only narrows the neck and spreads the upper cap, which prevents tall storm
  // cells from collapsing into a skinny column when Cloud Anvil is raised.
  let neckMask = smoothstep(0.30, 0.62, phs) * (1.0 - smoothstep(0.82, 0.985, phs));
  let spreadMask = saturate(remap(phs, mix_f(0.70, 0.58, tower), 0.96, 0.0, 1.0));
  let flattenMask = saturate(remap(phs, mix_f(0.80, 0.70, tower), 0.998, 0.0, 1.0));

  var local = pos - B.center;

  let neckTighten = 1.0 + tower * neckMask * (0.34 + overdrive * 0.14);
  local = vec3<f32>(local.x / neckTighten, local.y, local.z / neckTighten);

  let spread = 1.0 + anvil * spreadMask * exag * (2.05 + tower * 0.82 + overdrive * 0.28);
  local = vec3<f32>(local.x / spread, local.y, local.z / spread);

  let flatten = anvil * flattenMask * exag * mix_f(0.48, 0.24, tower);
  local.y = mix_f(local.y, local.y * (1.0 + flatten), flattenMask);
  local.y = local.y - anvil * flattenMask * exag * max(verticalReferenceHalfY(), 1.0) * (0.10 + tower * 0.10 + overdrive * 0.03);

  return B.center + local;
}

// robust AABB intersect
fn intersectAABB_robust(ro: vec3<f32>, rd: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>) -> vec2<f32> {
  let parallel = abs(rd) <= vec3<f32>(EPS);

  if (
    (parallel.x && (ro.x < bmin.x || ro.x > bmax.x)) ||
    (parallel.y && (ro.y < bmin.y || ro.y > bmax.y)) ||
    (parallel.z && (ro.z < bmin.z || ro.z > bmax.z))
  ) {
    return vec2<f32>(1.0, -1.0);
  }

  let epsSigned = select(vec3<f32>(-EPS), vec3<f32>(EPS), rd >= vec3<f32>(0.0));
  let rdSafe = select(epsSigned, rd, abs(rd) > vec3<f32>(EPS));
  let inv = vec3<f32>(1.0) / rdSafe;
  let t0 = (bmin - ro) * inv;
  let t1 = (bmax - ro) * inv;
  let tmin3 = min(t0, t1);
  let tmax3 = max(t0, t1);
  let tmin = max(max(tmin3.x, tmin3.y), tmin3.z);
  let tmax = min(min(tmax3.x, tmax3.y), tmax3.z);
  return vec2<f32>(tmin, tmax);
}

fn sphericalCloudMode() -> bool {
  return CLOUD_RENDER_MODE != 0u;
}


fn auroraLayerMode() -> bool {
  return CLOUD_RENDER_MODE == 2u;
}

fn cloudModeF32(boxVal: f32, sphereVal: f32, auroraVal: f32) -> f32 {
  if (auroraLayerMode()) {
    return auroraVal;
  }
  if (sphericalCloudMode()) {
    return sphereVal;
  }
  return boxVal;
}

fn auroraModeF32(baseVal: f32, auroraVal: f32) -> f32 {
  if (auroraLayerMode()) {
    return auroraVal;
  }
  return baseVal;
}

fn normalizeOr(v: vec3<f32>, fallback: vec3<f32>) -> vec3<f32> {
  if (dot(v, v) > EPS) {
    return normalize(v);
  }
  return fallback;
}

fn auroraPoleDir() -> vec3<f32> {
  return vec3<f32>(0.0, select(-1.0, 1.0, V._c >= 0.0), 0.0);
}

fn auroraCapAngleRad() -> f32 {
  return max(V._a, 0.0) * (PI / 180.0);
}

fn auroraCapFeatherRad() -> f32 {
  return max(V._b, 0.001) * (PI / 180.0);
}

fn auroraLocalPole(posWorld: vec3<f32>) -> vec3<f32> {
  let rel = normalize(posWorld - B.center);
  let basePole = auroraPoleDir();
  let hemiSign = select(-1.0, 1.0, dot(rel, basePole) >= 0.0);
  return basePole * hemiSign;
}

fn auroraTangentA(pole: vec3<f32>) -> vec3<f32> {
  let refAxis = select(vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(1.0, 0.0, 0.0), abs(pole.y) > 0.92);
  return normalize(cross(refAxis, pole));
}

fn auroraTangentB(pole: vec3<f32>, tangentA: vec3<f32>) -> vec3<f32> {
  return normalize(cross(pole, tangentA));
}

fn auroraSideSphereDir(posWorld: vec3<f32>) -> vec3<f32> {
  let rel = normalize(posWorld - B.center);
  let pole = auroraLocalPole(posWorld);
  let tangentA = auroraTangentA(pole);
  let tangentB = auroraTangentB(pole, tangentA);

  // 90 degree rotated side-view manifold: reads like a sweeping polar ribbon
  // field rather than a radial pinwheel around the pole point.
  let local = vec3<f32>(dot(rel, tangentA), dot(rel, pole), dot(rel, tangentB));
  return normalize(vec3<f32>(local.x, -local.z, local.y));
}

fn auroraAzimuth01(posWorld: vec3<f32>) -> f32 {
  let sideDir = auroraSideSphereDir(posWorld);
  return fract(0.5 + atan2(sideDir.z, sideDir.x) / (2.0 * PI));
}

fn auroraRadial01(posWorld: vec3<f32>) -> f32 {
  let sideDir = auroraSideSphereDir(posWorld);
  return 0.5 - asin(clamp(sideDir.y, -1.0, 1.0)) / PI;
}

fn auroraUVFromWorld(posWorld: vec3<f32>) -> vec2<f32> {
  return vec2<f32>(auroraAzimuth01(posWorld), auroraRadial01(posWorld));
}

fn auroraCapMask(posWorld: vec3<f32>) -> f32 {
  if (!auroraLayerMode()) {
    return 1.0;
  }

  let rel = normalize(posWorld - B.center);
  let capAngle = auroraCapAngleRad();
  let feather = auroraCapFeatherRad();
  let polarDotAbs = abs(clamp(dot(rel, auroraPoleDir()), -1.0, 1.0));
  let polarAngle = acos(polarDotAbs);

  // Dual-pole aurora, with a less plate-like fade: falloff starts halfway out
  // from the pole center instead of leaving a uniformly bright circular disc.
  // Start fading well before the edge. The older mask left broad hard islands;
  // this keeps a core but makes the outer half dissolve smoothly into curtains.
  let fadeStart = capAngle * 0.38;
  let fadeEnd = capAngle + feather * 1.35;
  let mask = 1.0 - smoothstep(fadeStart, max(fadeEnd, fadeStart + 0.001), polarAngle);
  return pow(clamp(mask, 0.0, 1.0), 1.55);
}

fn sphereRadiusBase() -> f32 {
  return max(V.planetRadius, 0.0);
}

fn shellHeight() -> f32 {
  return max(V.cloudTop - V.cloudBottom, EPS);
}

fn shellNominalRadii() -> vec2<f32> {
  let base = sphereRadiusBase();
  let r0 = max(base + V.cloudBottom, EPS);
  let r1 = max(base + V.cloudTop + anvilLiftWorld(), r0 + EPS);
  return vec2<f32>(r0, r1);
}

fn shellPhase01FromWorld(posWorld: vec3<f32>) -> f32 {
  let radii = shellNominalRadii();
  let r = length(posWorld - B.center);
  return saturate((r - radii.x) / max(radii.y - radii.x, EPS));
}

fn intersectSphere_robust(ro: vec3<f32>, rd: vec3<f32>, radius: f32) -> vec2<f32> {
  let r = max(radius, EPS);
  let b = dot(ro, rd);
  let c = dot(ro, ro) - r * r;
  let h = b * b - c;
  if (h < 0.0) {
    return vec2<f32>(1.0, -1.0);
  }
  let sh = sqrt(max(h, 0.0));
  return vec2<f32>(-b - sh, -b + sh);
}

fn intersectSphericalCloudShell(roWorld: vec3<f32>, rd: vec3<f32>) -> vec2<f32> {
  let ro = roWorld - B.center;
  let radii = shellNominalRadii();
  let outerHit = intersectSphere_robust(ro, rd, radii.y);
  if (outerHit.x > outerHit.y || outerHit.y <= 0.0) {
    return vec2<f32>(1.0, -1.0);
  }

  var t0 = max(outerHit.x, 0.0);
  var t1 = outerHit.y;

  let innerHit = intersectSphere_robust(ro, rd, radii.x);
  if (innerHit.x <= innerHit.y && innerHit.x > 0.0) {
    // Treat the planet and the lower atmosphere as opaque, so far-side clouds do
    // not draw through the planet.
    t1 = min(t1, innerHit.x);
  }

  if (t0 >= t1) {
    return vec2<f32>(1.0, -1.0);
  }
  return vec2<f32>(t0, t1);
}

fn intersectSphericalCloudShellView(roWorld: vec3<f32>, rd: vec3<f32>) -> vec2<f32> {
  var hit = intersectSphericalCloudShell(roWorld, rd);
  if (hit.x > hit.y) {
    return hit;
  }

  let rel = roWorld - B.center;
  let relLen = length(rel);
  if (relLen <= EPS) {
    return hit;
  }

  // Primary camera rays only need the visible shell plus a small limb allowance.
  // Clipping against this near-hemisphere plane avoids burning most of the march
  // budget on clouds hidden behind the planet.
  let viewAxis = rel / relLen;
  let radii = shellNominalRadii();
  let limbAllowance = 0.020;
  let planeD = -radii.y * limbAllowance;
  let denom = dot(rd, viewAxis);
  if (denom < -EPS) {
    let tPlane = (planeD - dot(rel, viewAxis)) / denom;
    if (tPlane > hit.x) {
      hit.y = min(hit.y, tPlane);
    }
  }

  if (hit.x >= hit.y) {
    return vec2<f32>(1.0, -1.0);
  }
  return hit;
}

fn rotateXZ(v: vec2<f32>, angle: f32) -> vec2<f32> {
  let s = sin(angle);
  let c = cos(angle);
  return vec2<f32>(c * v.x - s * v.y, s * v.x + c * v.y);
}

fn sphericalDriftedWorld(posWorld: vec3<f32>, offset: vec3<f32>) -> vec3<f32> {
  if (!sphericalCloudMode()) {
    return posWorld + offset;
  }

  let rel = posWorld - B.center;
  let angle = offset.x * 6.283185307179586;
  let xz = rotateXZ(rel.xz, angle);
  let y = rel.y + offset.y;
  return B.center + vec3<f32>(xz.x, y, xz.y);
}

fn sphereUVFromWorld(posWorld: vec3<f32>) -> vec2<f32> {
  let n = normalizeOr(posWorld - B.center, vec3<f32>(0.0, 1.0, 0.0));

  // Planet mesh parity: Babylon world Y is the planet polar axis, and longitude
  // runs around X/Z. This matches the CPU/GPU planet lat/lon mesh convention.
  let phi = atan2(n.z, n.x);
  let u = fract(phi / (2.0 * PI));
  let v = acos(clamp(n.y, -1.0, 1.0)) / PI;
  return vec2<f32>(u, clamp(v, 0.0, 1.0));
}

fn shellUVFromWorld(posWorld: vec3<f32>) -> vec2<f32> {
  if (auroraLayerMode()) {
    return auroraUVFromWorld(posWorld);
  }
  return sphereUVFromWorld(posWorld);
}

fn sphericalWarpDampingFromUV(uv: vec2<f32>) -> f32 {
  // Keep some organic warp on the globe, but damp it at the longitude seam and
  // poles where equirect weather/shape domains can reveal square/striped blocks.
  let seamDist = min(uv.x, 1.0 - uv.x);
  let seamDamp = smoothstep(0.010, 0.070, seamDist);
  let poleDamp = smoothstep(0.035, 0.18, uv.y) * (1.0 - smoothstep(0.82, 0.965, uv.y));
  return clamp(seamDamp * poleDamp, 0.0, 1.0);
}

// world warp in XZ
fn worldWarpXZ(pos_xz: vec2<f32>, ph: f32, boxMaxXZ: f32) -> vec2<f32> {
  let normv = max(boxMaxXZ, 1.0);
  let p = pos_xz / normv;

  let warpAmp = TUNE.baseJitterFrac * boxMaxXZ * 0.5;

  let s1x = smoothCellHash2D(p + vec2<f32>(12.34, 78.9), 4.0);
  let s1y = smoothCellHash2D(p + vec2<f32>(98.7, 6.54), 4.0);
  let s2x = smoothCellHash2D(p * 1.73 + vec2<f32>(3.21, 4.56), 8.28);
  let s2y = smoothCellHash2D(p * 1.91 + vec2<f32>(7.89, 1.23), 8.28);

  let ox = (s1x - 0.5) + 0.5 * (s2x - 0.5);
  let oz = (s1y - 0.5) + 0.5 * (s2y - 0.5);

  let ang = smoothCellHash2D(p * 3.0 + vec2<f32>(9.7, 2.3), 16.0) * 2.0 * PI;
  let rad = (smoothCellHash2D(p * 3.0 + vec2<f32>(1.1, 7.7), 16.0) - 0.5) * (TUNE.baseJitterFrac * 0.4 * boxMaxXZ);
  let rot = vec2<f32>(cos(ang), sin(ang)) * rad;

  let user = vec2<f32>(cos(opt._r3), sin(opt._r3)) * opt._r2 * 0.001;
  var warp = vec2<f32>(ox, oz) * warpAmp + rot * mix_f(0.3, 1.2, ph) + user;

  if (sphericalCloudMode()) {
    let uv = sphereUVFromWorld(vec3<f32>(pos_xz.x, B.center.y, pos_xz.y));
    warp *= mix_f(0.20, 0.62, sphericalWarpDampingFromUV(uv));
  }

  return warp;
}

fn worldWarpXZLighting(pos_xz: vec2<f32>, ph: f32, boxMaxXZ: f32) -> vec2<f32> {
  let normv = max(boxMaxXZ, 1.0);
  let p = pos_xz / normv;
  let warpAmp = TUNE.baseJitterFrac * boxMaxXZ * 0.34;

  let sx = smoothCellHash2D(p + vec2<f32>(12.34, 78.9), 4.0) - 0.5;
  let sz = smoothCellHash2D(p + vec2<f32>(98.7, 6.54), 4.0) - 0.5;
  let user = vec2<f32>(cos(opt._r3), sin(opt._r3)) * opt._r2 * 0.001;
  var warp = vec2<f32>(sx, sz) * warpAmp * mix_f(0.72, 1.04, saturate(ph)) + user;

  if (sphericalCloudMode()) {
    let uv = sphereUVFromWorld(vec3<f32>(pos_xz.x, B.center.y, pos_xz.y));
    warp *= mix_f(0.18, 0.54, sphericalWarpDampingFromUV(uv));
  }

  return warp;
}

fn tallBoxBlend() -> f32 {
  return wg_tallBlend;
}

fn thickBoxPerfStrength() -> f32 {
  return wg_thickPerfStrength;
}

fn verticalHomogeneity() -> f32 {
  return wg_verticalHomogeneity;
}

fn verticalDomainScale() -> f32 {
  return max(wg_verticalDomainScale, 1.0);
}

fn anvilAmount() -> f32 {
  return max(C.cloudAnvilAmount, 0.0);
}

fn anvilAmount01() -> f32 {
  return saturate(C.cloudAnvilAmount);
}

fn anvilTowerStrength() -> f32 {
  let a = anvilAmount();
  let baseTower = smoothstep(0.03, 0.72, a);
  let highAnvil = saturate(remap(a, 0.78, 2.10, 0.0, 1.0));
  return saturate(baseTower * 0.90 + highAnvil * 0.42);
}

fn anvilOverdrive() -> f32 {
  let a = anvilAmount();
  return max(a - 1.0, 0.0);
}

fn verticalReferenceHalfY() -> f32 {
  return max(wg_verticalRefHalfY, EPS);
}

fn verticalReferenceBoxH() -> f32 {
  return max(wg_verticalRefBoxH, EPS);
}

fn verticalReferencePos(pos: vec3<f32>) -> vec3<f32> {
  return pos;
}

fn verticalTextureScaleY() -> f32 {
  let hom = verticalHomogeneity();
  if (hom <= 0.0001) {
    return 1.0;
  }
  let rawH = max(B.half.y * 2.0, EPS);
  let refH = max(verticalReferenceBoxH(), EPS);
  return mix_f(1.0, clamp(rawH / refH, 1.0, 16.0), hom);
}

fn verticalScaledDomainPos(pos: vec3<f32>) -> vec3<f32> {
  // Keep the 3D noise in world space. Earlier passes multiplied local Y by
  // the stretched box ratio, which made tall/anvil boxes read like stacked
  // texture slices. The layer presets now control vertical character through
  // axis scale, phase decorrelation, and erosion, not by stretching the domain.
  return pos;
}

fn verticalStepBoost() -> f32 {
  let tall = tallBoxBlend();
  return mix_f(1.0, max(TUNE.verticalStepBoost, 1.0), tall);
}

fn verticalLightingStepBoost() -> f32 {
  let tall = tallBoxBlend();
  return mix_f(1.0, max(TUNE.verticalLightingStepBoost, 1.0), tall);
}

fn worldWarpY(pos_xz: vec2<f32>, ph: f32, boxMaxXZ: f32) -> f32 {
  let tall = tallBoxBlend();
  if (tall <= 0.0001) {
    return 0.0;
  }

  let normv = max(boxMaxXZ, 1.0);
  let p = pos_xz / normv;
  let n0 = smoothCellHash2D(p + vec2<f32>(41.17, 13.91), 3.25);
  let n1 = smoothCellHash2D(p * 1.91 + vec2<f32>(5.43, 71.29), 6.50);
  let n2 = smoothCellHash2D(p * 3.37 + vec2<f32>(19.81, 2.67), 13.00);
  let ridge = ridge01(n0 * 0.50 + n1 * 0.32 + n2 * 0.18);
  let signd = (n0 - 0.5) * 0.52 + (n1 - 0.5) * 0.33 + (ridge - 0.5) * 0.15 + (n2 - 0.5) * 0.08;
  let edgeDamp = smoothstep(0.02, 0.18, ph) * (1.0 - smoothstep(0.88, 1.0, ph));
  var amp = max(verticalReferenceHalfY() * 0.32, 0.12) * tall * edgeDamp;

  if (sphericalCloudMode()) {
    let uv = sphereUVFromWorld(vec3<f32>(pos_xz.x, B.center.y, pos_xz.y));
    amp *= mix_f(0.22, 0.58, sphericalWarpDampingFromUV(uv));
  }

  return signd * amp;
}

fn verticalPhaseOffset(pos_xz: vec2<f32>, ph: f32, boxMaxXZ: f32) -> f32 {
  let decor = saturate(TUNE.verticalLayerDecorrelation);
  let tall = tallBoxBlend();
  let normv = max(boxMaxXZ, 1.0);
  let p = pos_xz / normv;
  let shell = smoothstep(0.06, 0.78, ph) * (1.0 - smoothstep(0.88, 0.995, ph));
  let n0 = smoothCellHash2D(p * 0.93 + vec2<f32>(17.31, 9.27), 4.75);
  let n1 = smoothCellHash2D(p * 1.71 + vec2<f32>(3.83, 28.61) + vec2<f32>(ph * 0.85, ph * 1.33), 9.50);
  let n2 = smoothCellHash2D(p * 3.14 + vec2<f32>(21.07, 4.11) + vec2<f32>(ph * 2.10, ph * 1.62), 17.0);
  let signd = (n0 - 0.5) * 0.56 + (n1 - 0.5) * 0.31 + (n2 - 0.5) * 0.13;
  var amp = mix_f(0.045, 0.34, tall) * mix_f(0.18, 0.82, decor) * shell;

  if (sphericalCloudMode()) {
    let uv = sphereUVFromWorld(vec3<f32>(pos_xz.x, B.center.y, pos_xz.y));
    amp *= mix_f(0.22, 0.64, sphericalWarpDampingFromUV(uv));
  }

  return signd * amp;
}

fn verticalStretchFactor() -> f32 {
  let texStretch = saturate((verticalTextureScaleY() - 1.0) / 5.0);
  let tower = anvilTowerStrength();
  let overdrive = saturate(anvilOverdrive() * 0.42);
  return saturate(max(texStretch, tower * 0.72 + overdrive));
}

fn cloudSparsity01() -> f32 {
  return saturate(TUNE.sparsity);
}

fn cloudDefinition01() -> f32 {
  return saturate(TUNE.definition);
}

fn verticalResampledPhase(pos: vec3<f32>, ph: f32, boxMaxXZ: f32) -> f32 {
  let stretchF = verticalStretchFactor();
  let tower = anvilTowerStrength();
  let tall = tallBoxBlend();
  let refY = max(verticalReferenceHalfY(), EPS);
  let localY = (pos.y - B.center.y) / refY;
  let phCentered = ph - 0.5;

  // This is a small world-space phase warp, not a second vertical texture
  // scale. It lets tall clouds gain upward structure without locking the
  // erosion into evenly spaced horizontal cards.
  let worldPhase = localY * mix_f(0.18, 0.74, tower) + phCentered * mix_f(0.22, 0.78, tall);
  let profilePhase = phCentered * mix_f(0.36, 0.92, tower);
  let blendF = saturate(max(stretchF, tall * 0.24));
  return mix_f(profilePhase, worldPhase, blendF);
}

fn verticalStretchErosion(ph: f32, det: vec3<f32>, s: vec4<f32>, wm: vec4<f32>) -> f32 {
  let stretchF = verticalStretchFactor();
  if (stretchF <= 0.001) {
    return 0.0;
  }

  let phs = saturate(ph);
  let bodyBand = smoothstep(0.06, 0.34, phs) * (1.0 - smoothstep(0.84, 0.995, phs));
  let capBand = smoothstep(0.54, 0.90, phs) * (1.0 - smoothstep(0.965, 1.0, phs));
  let dHi = saturate(max(det.r, max(det.g, det.b)));
  let dLo = saturate(min(det.r, min(det.g, det.b)));
  let dMid = saturate((det.r + det.g + det.b) * 0.3333333333);
  let sMid = saturate(s.g * 0.50 + s.b * 0.32 + s.a * 0.18);
  let layerBreak = saturate(
    ridge01(contrast01(dMid * 0.72 + sMid * 0.28, 2.35)) * 0.45 +
    (1.0 - dLo) * 0.30 +
    dHi * 0.25
  );
  let weatherCore = saturate(max(wm.r, wm.g * 0.92));
  let shapeCore = saturate(max(s.r, sMid * 0.92));
  let denseMidBody = smoothstep(0.18, 0.42, phs)
    * (1.0 - smoothstep(0.62, 0.88, phs))
    * smoothstep(0.48, 0.84, weatherCore)
    * smoothstep(0.44, 0.82, shapeCore);
  let weatherEdge = 1.0 - smoothstep(0.52, 0.92, weatherCore);
  let fluff01 = saturate(max(TUNE.fluffFactor, 0.0) / (max(TUNE.fluffFactor, 0.0) + 1.65));

  // Preserve dense middle-body mass. The stretch erosion should break visible
  // layer slabs and caps, not cut a transparent horizon stripe through the
  // center of an otherwise opaque cloud bank.
  let preserveMidBody = 1.0 - denseMidBody * mix_f(0.62, 0.92, stretchF);
  let shelfDamp = mix_f(0.58, 0.34, tallBoxBlend());
  return stretchF * max(bodyBand, capBand * 0.72) * layerBreak * mix_f(0.010, 0.066, fluff01) * mix_f(1.0, 1.10, weatherEdge) * preserveMidBody * shelfDamp;
}

fn phLayerBreakup(ph: f32, wm: vec4<f32>, s: vec4<f32>, det: vec3<f32>) -> f32 {
  if (ph < 0.0 || wm.b > 1.0) {
    return ph;
  }

  let tall = tallBoxBlend();
  let fluff = max(TUNE.fluffFactor, 0.0);
  let fluff01 = saturate(fluff / (fluff + 1.45));
  let shell = smoothstep(0.015, 0.15, ph) * (1.0 - smoothstep(0.86, 1.0, ph));
  let shapeSig = (s.g * 0.45 + s.b * 0.34 + s.a * 0.21) - 0.5;
  let detMid = (det.r + det.g + det.b) * 0.3333333333 - 0.5;
  let weatherSig = wm.g - 0.5;
  let signal = shapeSig * 0.125 + detMid * 0.070 + weatherSig * 0.030;
  let amount = mix_f(0.20, 1.0, tall) * mix_f(0.65, 1.18, fluff01) * shell;
  return clamp(ph + signal * amount, 0.0, 1.0);
}

fn phLayerBreakupMacro(ph: f32, wm: vec4<f32>, s: vec4<f32>) -> f32 {
  if (ph < 0.0 || wm.b > 1.0) {
    return ph;
  }

  let tall = tallBoxBlend();
  let shell = smoothstep(0.015, 0.15, ph) * (1.0 - smoothstep(0.86, 1.0, ph));
  let shapeSig = (s.g * 0.46 + s.b * 0.33 + s.a * 0.21) - 0.5;
  let weatherSig = wm.g - 0.5;
  let amount = mix_f(0.16, 0.78, tall) * shell;
  return clamp(ph + (shapeSig * 0.105 + weatherSig * 0.030) * amount, 0.0, 1.0);
}

// shape & detail samplers
fn shapeUVW_fromWarp(pos: vec3<f32>, ph: f32, w: vec2<f32>) -> vec3<f32> {
  let scaleS = max(wg_scaleS, EPS);
  let movedPos = sphericalDriftedWorld(pos, NTransform.shapeOffsetWorld);
  let ap = verticalScaledDomainPos(anvilShapePos(movedPos, ph));
  let tall = tallBoxBlend();
  let yBreak = worldWarpY(movedPos.xz, ph, wg_boxMaxXZ);
  let phaseNoise = verticalPhaseOffset(movedPos.xz, ph, wg_boxMaxXZ);
  let yPhase = verticalResampledPhase(movedPos, ph, wg_boxMaxXZ) * mix_f(0.72, 0.46, tall) + phaseNoise * mix_f(1.08, 1.34, tall);
  let pW = vec3<f32>(
    ap.x + w.x,
    ap.y + yBreak + yPhase,
    ap.z + w.y
  );

  let axis = axisOrOne3(NTransform.shapeAxisScale);
  let sMul = select(NTransform.shapeScale, 1.0, NTransform.shapeScale == 0.0);
  return (pW * axis) * (scaleS * max(sMul, EPS));
}

fn detailUVW_fromWarp(pos: vec3<f32>, ph: f32, w: vec2<f32>) -> vec3<f32> {
  let scaleD = max(wg_scaleD, EPS);
  let movedPos = sphericalDriftedWorld(pos, NTransform.detailOffsetWorld);
  let ap = verticalScaledDomainPos(anvilShapePos(movedPos, ph));
  let tall = tallBoxBlend();
  let yBreak = worldWarpY(movedPos.xz, ph, wg_boxMaxXZ) * mix_f(0.65, 1.45, tall);
  let phaseNoise = verticalPhaseOffset(movedPos.xz + vec2<f32>(19.7, -11.3), ph, wg_boxMaxXZ) * mix_f(0.55, 0.90, tall);
  let detailPhase = verticalResampledPhase(movedPos, ph, wg_boxMaxXZ) * mix_f(0.04, 0.14, verticalStretchFactor());
  let pW = vec3<f32>(
    ap.x + w.x,
    ap.y + yBreak + phaseNoise + detailPhase,
    ap.z + w.y
  );

  let axis = axisOrOne3(NTransform.detailAxisScale);
  let dMul = select(NTransform.detailScale, 1.0, NTransform.detailScale == 0.0);
  return (pW * axis) * (scaleD * max(dMul, EPS));
}

fn sampleShapeRGBAWarp(pos: vec3<f32>, ph: f32, lod: f32, w: vec2<f32>) -> vec4<f32> {
  return wrap3D_shape(shape3D, sampShape, shapeUVW_fromWarp(pos, ph, w), lod);
}

fn sampleDetailRGBWarp(pos: vec3<f32>, ph: f32, lod: f32, w: vec2<f32>) -> vec3<f32> {
  return wrap3D_detail(detail3D, sampDetail, detailUVW_fromWarp(pos, ph, w), lod).rgb;
}

fn sampleShapeRGBA(pos: vec3<f32>, ph: f32, lod: f32) -> vec4<f32> {
  let w = worldWarpXZ(pos.xz, ph, wg_boxMaxXZ);
  return sampleShapeRGBAWarp(pos, ph, lod, w);
}

fn sampleDetailRGB(pos: vec3<f32>, ph: f32, lod: f32) -> vec3<f32> {
  let w = worldWarpXZ(pos.xz, ph, wg_boxMaxXZ);
  return sampleDetailRGBWarp(pos, ph, lod, w);
}

fn auroraRibbonUVW(pos: vec3<f32>, ph: f32, offsetWorld: vec3<f32>, scaleBase: f32) -> vec3<f32> {
  let uv = auroraUVFromWorld(pos);
  let phs = saturate(ph);
  let drift = vec2<f32>(
    offsetWorld.x * 0.055 + offsetWorld.z * 0.021,
    offsetWorld.z * 0.037 + offsetWorld.x * 0.013
  );
  let broadBend = (smoothCellHash2D(uv * vec2<f32>(1.45, 3.20) + drift + vec2<f32>(7.1, 2.3), 4.0) - 0.5) * 0.075;
  let fineLean = (smoothCellHash2D(vec2<f32>(uv.x * 4.0, uv.y * 1.35) + drift.yx + vec2<f32>(1.9, 9.4), 8.0) - 0.5) * 0.025;
  let u = uv.x + drift.x + broadBend + phs * 0.018;
  let radial = uv.y + drift.y * 0.14 + fineLean + phs * 0.035;

  // Compress the height coordinate so the 3D texture becomes tall aurora sheets
  // instead of horizontal cloud slabs.
  let heightWobble = (smoothCellHash2D(vec2<f32>(uv.x * 1.7, uv.y * 3.4) + drift + vec2<f32>(4.6, 5.8), 5.5) - 0.5) * 0.032;
  let h = phs * 0.16 + heightWobble;
  let scale = max(scaleBase, 1.0);
  let axis = axisOrOne3(NTransform.shapeAxisScale);
  return vec3<f32>(
    u * scale,
    h * max(scale * 0.42, 0.75),
    radial * max(scale * 0.62, 1.20)
  ) * axis;
}

fn sampleAuroraRibbonShape(pos: vec3<f32>, ph: f32, lod: f32) -> vec4<f32> {
  let scaleBase = max(abs(NTransform.shapeScale) * 22.0, 2.75);
  return wrap3D_shape(shape3D, sampShape, auroraRibbonUVW(pos, ph, NTransform.shapeOffsetWorld, scaleBase), lod);
}

// ---------------------- weather mapping
fn weatherUV_from(pos_world: vec3<f32>, wScale: f32) -> vec2<f32> {
  let wAxis = axisOrOne3(NTransform.weatherAxisScale);

  if (sphericalCloudMode()) {
    let uv = shellUVFromWorld(pos_world);
    let uvOffset = NTransform.weatherOffsetWorld.xz;
    let centered = (uv - vec2<f32>(0.5, 0.5)) * vec2<f32>(wAxis.x, wAxis.z) * max(wScale, EPS);
    return centered + vec2<f32>(0.5, 0.5) + uvOffset;
  }

  let p = pos_world + NTransform.weatherOffsetWorld;
  let rel = (p.xz - B.center.xz) * vec2<f32>(wAxis.x, wAxis.z);

  // Keep the current weather-map scale when the cloud box is stretched outward.
  // The map repeats through the existing wrap sampler instead of being rebaked larger.
  let tileInvWorld = 0.5 * max(B.uvScale, EPS);
  return rel * tileInvWorld * wScale;
}

fn anvilColumnFactor(wm: vec4<f32>) -> f32 {
  let tower = anvilTowerStrength();
  let cov = saturate(C.globalCoverage);
  let body = saturate(wm.r * 0.68 + wm.g * 0.32);
  let core = saturate(max(wm.r, wm.g * 0.92));
  let footprint = smoothstep(0.46, 0.82, body);
  let coreBoost = smoothstep(0.62, 0.94, core);
  return saturate(mix_f(footprint, max(footprint, coreBoost), tower) * cov);
}

// ---------------------- height shape and density
fn anvilBodyHeightSupport(ph: f32) -> f32 {
  let phs = saturate(ph);
  let tower = anvilTowerStrength();
  let footBand = smoothstep(0.018, 0.13, phs) * (1.0 - smoothstep(0.42, 0.72, phs));
  let middleBand = smoothstep(0.13, 0.34, phs) * (1.0 - smoothstep(0.58, 0.86, phs));
  return tower * max(footBand * 0.22, middleBand * 0.16);
}

fn anvilLowerBodySupport(ph: f32, wm: vec4<f32>, shapeCore: f32) -> f32 {
  let phs = saturate(ph);
  let tower = anvilTowerStrength();
  let overdrive = saturate(anvilOverdrive() * 0.35);
  let lowerBand = smoothstep(0.035, 0.18, phs) * (1.0 - smoothstep(0.48, 0.78, phs));
  let middleBand = smoothstep(0.16, 0.40, phs) * (1.0 - smoothstep(0.62, 0.88, phs));
  let bodyBand = max(lowerBand * 0.82, middleBand);
  let weatherBody = smoothstep(0.46, 0.86, saturate(max(wm.r, wm.g * 0.92)));
  let shapeBody = smoothstep(0.36, 0.80, saturate(shapeCore));
  return bodyBand * weatherBody * shapeBody * tower * (0.07 + tower * 0.12 + overdrive * 0.05);
}

fn heightShape(ph: f32, wBlue: f32) -> f32 {
  let sr_bottom = saturate(remap(ph, 0.0, 0.07, 0.0, 1.0));
  let stop_h = saturate(wBlue + 0.12);
  let sr_top = saturate(remap(ph, stop_h * 0.2, stop_h, 1.0, 0.0));
  var base = sr_bottom * sr_top;
  let anvilFactor = saturate(C.cloudAnvilAmount) * saturate(C.globalCoverage);
  base = max(base, anvilBodyHeightSupport(ph));
  let expo = saturate(remap(ph, 0.65, 0.95, 1.0, 1.0 - anvilFactor * 0.9));
  return pow(base, expo);
}

// wm.r and wm.g still drive base/top jitter.
// wm.b is a per-column CUTOUT fraction of the box height:
//   - 0.0 means no cutout
//   - 0.5 means the bottom half is forbidden (only top half can render)
//   - 1.0 means the whole column is forbidden
fn weatherBaseTopY(wm: vec4<f32>) -> vec2<f32> {
  let boxH = max(B.half.y * 2.0, EPS);
  let boxBottom = (B.center.y - B.half.y);
  let boxTop = (B.center.y + B.half.y);

  let jBase = (wm.r * 2.0 - 1.0) * (TUNE.baseJitterFrac * boxH);
  let jTop = (wm.g * 2.0 - 1.0) * (TUNE.topJitterFrac * boxH);

  let baseY = boxBottom + jBase;
  let anvilCol = anvilColumnFactor(wm);
  let topY = boxTop + jTop + anvilLiftWorld() * anvilCol;

  return vec2<f32>(baseY, topY);
}

fn weatherBaseTopRadius(wm: vec4<f32>) -> vec2<f32> {
  let h = shellHeight();
  let base = sphereRadiusBase();
  let jBase = (wm.r * 2.0 - 1.0) * (TUNE.baseJitterFrac * h);
  let jTop = (wm.g * 2.0 - 1.0) * (TUNE.topJitterFrac * h);
  let anvilCol = anvilColumnFactor(wm);

  let r0 = max(base + V.cloudBottom + jBase, EPS);
  let r1 = max(base + V.cloudTop + jTop + anvilLiftWorld() * anvilCol, r0 + EPS);
  return vec2<f32>(r0, r1);
}

fn weatherBCutoutWeight(ph: f32, wm: vec4<f32>) -> f32 {
  let b = clamp(wm.b, 0.0, 1.0);
  if (b <= 0.001) {
    return 1.0;
  }

  // The weather B channel is a soft vertical erosion mask. It must not move the
  // column base or hard-reject a whole horizontal slab, because that becomes
  // visible as rectangular shelves when the camera looks straight through the
  // cloud volume.
  let cut = mix_f(-0.18, 0.86, b);
  let feather = mix_f(0.16, 0.34, b) + tallBoxBlend() * 0.08;
  let verticalFade = smoothstep(cut - feather, cut + feather, ph);
  let keep = mix_f(1.0, verticalFade, smoothstep(0.03, 0.98, b));
  return clamp(keep, 0.0, 1.0);
}

fn activeColumnYRange(wm: vec4<f32>) -> vec2<f32> {
  return weatherBaseTopY(wm);
}

fn activeColumnGuard() -> f32 {
  var boxH = max(B.half.y * 2.0, EPS);
  if (sphericalCloudMode()) {
    boxH = shellHeight();
  }
  let jitterRoom = abs(TUNE.baseJitterFrac) + abs(TUNE.topJitterFrac) * 0.75;
  return clamp(boxH * (0.055 + jitterRoom) + wg_finestWorld * 2.0, 0.02, max(boxH * 0.48, 0.03));
}

fn globalActiveYRange() -> vec2<f32> {
  if (sphericalCloudMode()) {
    return vec2<f32>(-1.0e9, 1.0e9);
  }
  let guard = activeColumnGuard();
  return vec2<f32>(B.center.y - B.half.y - guard, B.center.y + B.half.y + anvilLiftWorld() + guard);
}

fn verticalColumnSkipDistance(
  p: vec3<f32>,
  rd: vec3<f32>,
  wm: vec4<f32>,
  stepLen: f32,
  effectiveMaxStep: f32,
  thickPerfF: f32,
  screenFarF: f32
) -> f32 {
  if (wm.b > 1.0) {
    return 0.0;
  }

  if (sphericalCloudMode()) {
    let rr = weatherBaseTopRadius(wm);
    let guard = activeColumnGuard();
    let rel = p - B.center;
    let r = length(rel);
    let n = normalizeOr(rel, vec3<f32>(0.0, 1.0, 0.0));
    let radialVel = dot(rd, n);
    let activeMinR = rr.x - guard;
    let activeMaxR = rr.y + guard;
    let perfF = max(thickPerfF, screenFarF * 0.65);
    let maxSkip = max(stepLen * 1.25, effectiveMaxStep * mix_f(2.0, 18.0, perfF));
    let tangentF = 1.0 - smoothstep(0.02, 0.22, abs(radialVel));
    let awaySkip = clamp(stepLen * mix_f(1.25, 4.85, max(perfF, tangentF * perfF)), stepLen, maxSkip);

    if (r < activeMinR) {
      if (radialVel > 0.015) {
        let dr = (activeMinR - r) / max(radialVel, 0.015);
        return clamp(dr, stepLen * 1.10, maxSkip);
      }
      return awaySkip;
    }

    if (r > activeMaxR) {
      if (radialVel < -0.015) {
        let dr = (activeMaxR - r) / min(radialVel, -0.015);
        return clamp(dr, stepLen * 1.10, maxSkip);
      }
      return awaySkip;
    }

    return 0.0;
  }

  let yr = activeColumnYRange(wm);
  let guard = activeColumnGuard();
  let activeMinY = yr.x - guard;
  let activeMaxY = yr.y + guard;
  let perfF = max(thickPerfF, screenFarF * 0.65);
  let maxSkip = max(stepLen * 1.25, effectiveMaxStep * mix_f(2.0, 22.0, perfF));
  let horizontalF = 1.0 - smoothstep(0.02, 0.22, abs(rd.y));
  let awaySkip = clamp(stepLen * mix_f(1.35, 5.65, max(perfF, horizontalF * perfF)), stepLen, maxSkip);

  if (p.y < activeMinY) {
    if (rd.y > 0.015) {
      let dy = (activeMinY - p.y) / max(rd.y, 0.015);
      return clamp(dy, stepLen * 1.15, maxSkip);
    }
    return awaySkip;
  }

  if (p.y > activeMaxY) {
    if (rd.y < -0.015) {
      let dy = (activeMaxY - p.y) / min(rd.y, -0.015);
      return clamp(dy, stepLen * 1.15, maxSkip);
    }
    return awaySkip;
  }

  return 0.0;
}

fn computePH(p_world: vec3<f32>, wm: vec4<f32>) -> f32 {
  if (wm.b > 1.0) { return -1.0; }

  if (sphericalCloudMode()) {
    let rr = weatherBaseTopRadius(wm);
    let rel = p_world - B.center;
    let r = length(rel);
    let denom = max(rr.y - rr.x, EPS) * wg_weatherAxisYAbs;
    let phRaw = (r - rr.x) / denom;
    let tall = tallBoxBlend();
    let shellGuard = max(activeColumnGuard() * 0.55, shellHeight() * mix_f(0.05, 0.30, tall));

    if (r < rr.x - shellGuard || r > rr.y + shellGuard) { return -1.0; }

    let phShell = clamp(phRaw, 0.0, 1.0);
    let body = smoothstep(0.08, 0.30, phShell) * (1.0 - smoothstep(0.72, 0.96, phShell));
    let uv = sphereUVFromWorld(p_world);
    let spherePlane = (uv - vec2<f32>(0.5, 0.5)) * max(sphereRadiusBase(), 1.0);
    let macroWarp = worldWarpY(spherePlane + vec2<f32>(17.31, -9.47) * 0.071, phShell, wg_boxMaxXZ);
    let phaseWarp = verticalPhaseOffset(spherePlane + vec2<f32>(-5.83, 23.19) * 0.047, phShell, wg_boxMaxXZ) * denom;
    let weatherWarp = ((wm.r - 0.5) * 0.68 + (wm.g - 0.5) * 0.32) * denom * mix_f(0.008, 0.038, tall) * body;
    let warpWorld = (macroWarp * mix_f(0.18, 0.72, tall) + phaseWarp * mix_f(0.22, 0.62, tall) + weatherWarp) * body;

    let ph0 = (r + warpWorld - rr.x) / denom;
    if (ph0 < -0.055 || ph0 > 1.055) { return -1.0; }

    let fineWobble = ((wm.r - 0.5) * 0.48 + (wm.g - 0.5) * 0.52) * mix_f(0.004, 0.018, tall) * body;
    return saturate(ph0 + fineWobble);
  }

  let bt = weatherBaseTopY(wm);
  let baseY = bt.x;
  let topY = bt.y;
  if (topY - baseY <= EPS) { return -1.0; }

  let denom = max(topY - baseY, EPS) * wg_weatherAxisYAbs;
  let phRaw = (p_world.y - baseY) / denom;
  let tall = tallBoxBlend();
  let shellGuard = max(activeColumnGuard() * 0.55, verticalReferenceHalfY() * mix_f(0.05, 0.34, tall));

  if (p_world.y < baseY - shellGuard || p_world.y > topY + shellGuard) { return -1.0; }

  let phShell = clamp(phRaw, 0.0, 1.0);
  let body = smoothstep(0.08, 0.30, phShell) * (1.0 - smoothstep(0.72, 0.96, phShell));
  let xzA = p_world.xz + vec2<f32>(17.31, -9.47) * max(wg_boxMaxXZ, 1.0) * 0.071;
  let xzB = p_world.xz + vec2<f32>(-5.83, 23.19) * max(wg_boxMaxXZ, 1.0) * 0.047;
  let macroWarp = worldWarpY(xzA, phShell, wg_boxMaxXZ);
  let phaseWarp = verticalPhaseOffset(xzB, phShell, wg_boxMaxXZ) * denom;
  let weatherWarp = ((wm.r - 0.5) * 0.68 + (wm.g - 0.5) * 0.32) * denom * mix_f(0.008, 0.038, tall) * body;
  let warpWorld = (macroWarp * mix_f(0.18, 0.72, tall) + phaseWarp * mix_f(0.22, 0.62, tall) + weatherWarp) * body;

  let ph0 = (p_world.y + warpWorld - baseY) / denom;
  if (ph0 < -0.055 || ph0 > 1.055) { return -1.0; }

  let fineWobble = ((wm.r - 0.5) * 0.48 + (wm.g - 0.5) * 0.52) * mix_f(0.004, 0.018, tall) * body;
  return saturate(ph0 + fineWobble);
}


fn contrast01(x: f32, k: f32) -> f32 {
  return saturate((x - 0.5) * k + 0.5);
}

fn ridge01(x: f32) -> f32 {
  return 1.0 - abs(x * 2.0 - 1.0);
}

fn detailMod(ph: f32, d: vec3<f32>) -> f32 {
  let xHi = saturate(max(d.r, max(d.g, d.b)));
  let xLo = saturate(min(d.r, min(d.g, d.b)));
  let xMid = saturate((d.r + d.g + d.b) * 0.3333333333);

  // Blend a few detail signals so breakup bites around the whole cloud body
  // instead of reading as a soft top cap.
  let edgeSignal = saturate(mix_f(xHi, 1.0 - xLo, 0.34));
  let bodySignal = saturate(mix_f(xMid, edgeSignal, 0.58));
  let c0 = contrast01(bodySignal, 2.15);
  let r0 = ridge01(c0);
  let crisp = pow(saturate(r0), 1.15);

  let fluff = max(TUNE.fluffFactor, 0.0);
  let uniformity = saturate(remap(fluff, 0.85, 1.8, 0.0, 1.0));
  let heightBias = saturate(remap(ph, 0.05, 0.82, 0.0, 1.0));

  // Keep the v3 behavior: the control raises detail erosion through the body,
  // not blanket coverage removal or edge blur.
  let bodyFloor = mix_f(0.26, 0.92, uniformity);
  let h = max(heightBias, bodyFloor);

  let cov = saturate(C.globalCoverage);
  let covAtten = mix_f(exp(-cov * 0.38), exp(-cov * 0.14), uniformity);
  let fluffStrength = 0.62 + fluff * 0.62;
  let threshold = 0.10 + 0.58 * covAtten * crisp * h * fluffStrength;

  let edgeCarve = 0.08 * uniformity * saturate(1.0 - xMid) * saturate(0.45 + 0.55 * ridge01(xHi));
  return saturate(threshold + edgeCarve);
}

fn detailProxyFromShape(ph: f32, s: vec4<f32>) -> vec3<f32> {
  let g = saturate(s.g);
  let b = saturate(s.b);
  let a = saturate(s.a);
  let fbm = saturate(g * 0.55 + b * 0.30 + a * 0.15);
  let hi = saturate(max(g, max(b, a)));
  let lo = saturate(min(g, min(b, a)));
  let ridge = ridge01(contrast01(fbm, 1.90));
  let mid = saturate(mix_f(fbm, hi, 0.45));
  let edge = saturate(mix_f(1.0 - lo, ridge, 0.35));
  let h = saturate(remap(ph, 0.04, 0.90, 0.10, 1.0));
  return vec3<f32>(
    mid,
    saturate(mix_f(edge, ridge, 0.45)),
    saturate(mix_f(1.0 - lo * 0.82, mid * 0.7 + ridge * 0.3, h))
  );
}


fn puffCellSignal(ph: f32, wm: vec4<f32>, s: vec4<f32>, det: vec3<f32>) -> f32 {
  let dHi = saturate(max(det.r, max(det.g, det.b)));
  let dLo = saturate(min(det.r, min(det.g, det.b)));
  let dMid = saturate((det.r + det.g + det.b) * 0.3333333333);
  let sMid = saturate(s.g * 0.47 + s.b * 0.34 + s.a * 0.19);
  let sEdge = saturate(mix_f(sMid, 1.0 - min(s.g, min(s.b, s.a)), 0.34));
  let dEdge = saturate(mix_f(dHi, 1.0 - dLo, 0.45));
  let phBand = ridge01(contrast01(saturate(ph), 1.36));
  return saturate(s.r * 0.20 + sEdge * 0.34 + dMid * 0.23 + dEdge * 0.17 + wm.g * 0.06 + phBand * 0.035);
}

fn puffLobeSupport(ph: f32, wm: vec4<f32>, s: vec4<f32>, det: vec3<f32>, core: f32) -> f32 {
  let phs = saturate(ph);
  let fluff = max(TUNE.fluffFactor, 0.0);
  let fluff01 = saturate(fluff / (fluff + 1.18));
  let sparse = cloudSparsity01();
  let definition = cloudDefinition01();
  let bodyBand = smoothstep(0.045, 0.28, phs) * (1.0 - smoothstep(0.82, 1.0, phs));
  let shell = pow(saturate(1.0 - core), mix_f(2.15, 1.03, fluff01));
  let coreGate = 1.0 - smoothstep(0.58, 0.96, core);
  let weatherBody = smoothstep(0.45, 0.88, saturate(max(wm.r, wm.g * 0.92)));
  let shapeBody = smoothstep(0.30, 0.84, saturate(max(s.r, s.g * 0.86)));
  let cell = puffCellSignal(phs, wm, s, det);
  let lobe = pow(saturate(ridge01(contrast01(cell, 2.55 + definition * 0.72))), mix_f(1.36, 0.70, fluff01));
  let lift = lobe * shell * coreGate * bodyBand * weatherBody * shapeBody;
  return lift * mix_f(0.014, 0.084, fluff01) * mix_f(0.98, 1.18, definition) * mix_f(1.04, 0.90, sparse);
}

fn puffValleyErosion(ph: f32, wm: vec4<f32>, s: vec4<f32>, det: vec3<f32>, core: f32) -> f32 {
  let phs = saturate(ph);
  let fluff = max(TUNE.fluffFactor, 0.0);
  let fluff01 = saturate(fluff / (fluff + 1.10));
  let sparse = cloudSparsity01();
  let definition = cloudDefinition01();
  let bodyBand = smoothstep(0.055, 0.34, phs) * (1.0 - smoothstep(0.86, 1.0, phs));
  let shell = pow(saturate(1.0 - core), mix_f(1.45, 0.58, fluff01));
  let midCore = smoothstep(0.025, 0.20, core) * (1.0 - smoothstep(0.58, 0.94, core));
  let edgeBody = max(shell * 0.82, midCore * 0.58);
  let cell = puffCellSignal(phs, wm, s, det);
  let lobe = pow(saturate(ridge01(contrast01(cell, 2.75 + definition * 0.86))), mix_f(1.46, 0.78, fluff01));
  let valley = pow(saturate(1.0 - lobe), mix_f(1.72, 0.92, fluff01));
  let creaseSignal = saturate(det.r * 0.36 + (1.0 - det.g) * 0.34 + det.b * 0.20 + (1.0 - s.r) * 0.10);
  let crease = pow(saturate(ridge01(contrast01(creaseSignal, 2.35 + definition * 0.65))), mix_f(1.12, 0.92, definition));
  let weatherEdge = 1.0 - smoothstep(0.62, 0.94, saturate(max(wm.r, wm.g * 0.92)));
  let carveSignal = saturate(valley * 0.66 + crease * 0.34);
  return carveSignal * edgeBody * bodyBand * mix_f(0.030, 0.215, fluff01) * mix_f(0.86, 1.18, weatherEdge) * mix_f(0.92, 1.44, sparse) * mix_f(0.94, 1.22, definition);
}

fn densityHeight(ph: f32) -> f32 {
  var ret = ph;
  ret *= saturate(remap(ph, 0.0, 0.2, 0.0, 1.0));

  let bodySupport = smoothstep(0.08, 0.30, saturate(ph)) * (1.0 - smoothstep(0.70, 0.94, saturate(ph)));
  let towerSupport = smoothstep(0.22, 0.54, saturate(ph)) * (1.0 - smoothstep(0.84, 0.98, saturate(ph)));
  ret *= 1.0 + bodySupport * 0.32 + towerSupport * 0.18;

  let anvil = anvilStrength();
  let tower = anvilTowerStrength();
  let bridgeSupport = smoothstep(0.28, 0.78, saturate(ph)) * (1.0 - smoothstep(0.92, 0.99, saturate(ph)));
  let capSupport = smoothstep(0.50, 0.90, saturate(ph)) * (1.0 - smoothstep(0.97, 1.0, saturate(ph)));

  // Blend the older softer cap taper into stronger anvil values so the same
  // anvil control builds a taller tower and broader top without adding another
  // redundant vertical-form knob.
  let oldAnvilTaper = saturate(remap(sqrt(max(ph, 0.0)), 0.4, 0.95, 1.0, 0.2));
  ret *= mix_f(1.0, mix_f(1.0, oldAnvilTaper, anvilAmount01()), tower);
  ret *= 1.0 + tower * bridgeSupport * 0.48;
  ret *= 1.0 + anvil * capSupport * mix_f(0.30, 0.12, tower);

  ret *= saturate(remap(ph, mix_f(0.92, 0.985, saturate(anvil)), 1.0, 1.0, 0.0));
  ret *= max(C.globalDensity * 10.0, 0.0);
  return ret;
}

fn weatherCoverageGate(wm: vec4<f32>) -> f32 {
  if (wm.b > 1.0) { return 1.0; }
  let wHi = saturate(remap(C.globalCoverage, 0.0, 1.0, 0.0, 1.0) - 0.5) * wm.g * 2.0;
  let WMc = max(wm.r, wHi);
  return 1.0 - C.globalCoverage * saturate(WMc - opt._r1);
}

fn densityFromSamples(ph: f32, wm: vec4<f32>, s: vec4<f32>, det: vec3<f32>) -> f32 {
  if (ph < 0.0) { return 0.0; }
  if (wm.b > 1.0) { return 0.0; }

  let phD = phLayerBreakup(ph, wm, s, det);
  let sparse = cloudSparsity01();
  let definition = cloudDefinition01();

  // base shape
  var shape = saturate(s.r);
  shape = contrast01(shape, 1.24 + definition * 0.38 + sparse * 0.16);

  // "fbm" from the other channels if present, otherwise still sane
  let fbm_s = saturate(s.g * 0.625 + s.b * 0.25 + s.a * 0.125);

  // treat fbm_s as an erosion threshold for the base shape
  let SNsample = saturate(remap(shape, fbm_s, 1.0, 0.0, 1.0));

  var SA = saturate(heightShape(phD, 1.0));
  let tallLayerBreak = tallBoxBlend();
  let bodyNoise = saturate(s.g * 0.45 + s.b * 0.35 + s.a * 0.20);
  let bodyLift3D = mix_f(1.0, mix_f(0.92, 1.08, bodyNoise), tallLayerBreak);
  SA = saturate(SA * bodyLift3D);

  let tower = anvilTowerStrength();
  let overdrive = anvilOverdrive();
  let wVar = fract(wm.r * 1.7 + wm.g * 2.3);
  let oldVerticalBulge = 1.0 + 0.22 * (abs(fract(phD * (1.0 + wVar * 1.7)) - 0.5) * 2.0 - 0.5) * 0.5;
  let towerColumn = smoothstep(0.06, 0.64, phD) * (1.0 - smoothstep(0.90, 1.0, phD));
  let towerLift = 1.0 + tower * towerColumn * (0.14 + bodyNoise * 0.18 + overdrive * 0.06);
  let coreNoise = saturate(s.r * 0.52 + s.g * 0.28 + (1.0 - det.g) * 0.20);
  let coreBoost = 1.0 + tower * towerColumn * coreNoise * (0.10 + overdrive * 0.18);
  SA = saturate(SA * mix_f(1.0, oldVerticalBulge, tower) * towerLift * coreBoost);

  let gate = weatherCoverageGate(wm);
  let SNnd = saturate(remap(SNsample * SA, gate, 1.0, 0.0, 1.0));

  let stretchErode = verticalStretchErosion(phD, det, s, wm);
  let DN = saturate(detailMod(phD, det) + stretchErode);

  var core = saturate(remap(SNnd, DN * mix_f(0.84, 1.10, sparse), 1.0, 0.0, 1.0));

  let midBodyBand = smoothstep(0.16, 0.40, phD) * (1.0 - smoothstep(0.64, 0.90, phD));
  let weatherBody = smoothstep(0.50, 0.90, saturate(max(wm.r, wm.g * 0.92)));
  let shapeBodyCore = saturate(s.r * 0.74 + s.g * 0.18 + s.b * 0.08);
  let shapeBody = smoothstep(0.42, 0.82, shapeBodyCore);
  let stretchBodySupport = verticalStretchFactor() * midBodyBand * weatherBody * shapeBody;
  core = max(core, stretchBodySupport * mix_f(0.09, 0.25, anvilTowerStrength()));
  core = max(core, anvilLowerBodySupport(phD, wm, shapeBodyCore));
  core = saturate(core + puffLobeSupport(phD, wm, s, det, core));

  let depthBodyBand = smoothstep(0.12, 0.38, phD) * (1.0 - smoothstep(0.76, 0.96, phD));
  let depthWeather = smoothstep(0.42, 0.90, saturate(max(wm.r, wm.g * 0.94)));
  let depthShape = smoothstep(0.38, 0.84, shapeBodyCore);
  let depthSupport = depthBodyBand * depthWeather * depthShape;
  core = max(core, depthSupport * mix_f(0.13, 0.30, saturate(TUNE.fluffFactor / (TUNE.fluffFactor + 1.45))) * mix_f(1.0, 0.78, sparse));

  let fluff = max(TUNE.fluffFactor, 0.0);
  let fluff01 = saturate(fluff / (fluff + 1.45));
  let midClosure = midBodyBand * weatherBody * shapeBody * smoothstep(0.08, 0.34, core) * mix_f(0.05, 0.16, fluff01) * mix_f(1.0, 0.58, sparse);
  let lowerClosureBand = smoothstep(0.05, 0.22, phD) * (1.0 - smoothstep(0.38, 0.68, phD));
  let lowerClosure = lowerClosureBand * weatherBody * smoothstep(0.46, 0.82, shapeBodyCore) * mix_f(0.04, 0.11, fluff01) * mix_f(1.0, 0.64, sparse);
  core = max(core, midClosure);
  core = max(core, lowerClosure);
  let dHi = saturate(max(det.r, max(det.g, det.b)));
  let dLo = saturate(min(det.r, min(det.g, det.b)));
  let dMid = saturate((det.r + det.g + det.b) * 0.3333333333);
  let scallopSignal = saturate(mix_f(dHi, 1.0 - dLo, 0.42) * 0.72 + ridge01(contrast01(dMid, 2.35)) * 0.28);
  let scallop = pow(saturate(ridge01(contrast01(scallopSignal, 2.75 + definition * 0.72))), mix_f(1.25, 0.58, fluff01));
  let shellMask = pow(saturate(1.0 - core), mix_f(1.35, 0.58, fluff01));
  let bodyMask = mix_f(0.76, 1.0, saturate(remap(phD, 0.0, 0.95, 0.0, 1.0)));
  let denseMidPreserve = stretchBodySupport * smoothstep(0.08, 0.22, core);
  let stretchCoreCarve = stretchErode * mix_f(0.08, 0.34, fluff01) * mix_f(1.0, 1.28, sparse) * (1.0 - denseMidPreserve * 0.90);
  let puffCarve = puffValleyErosion(phD, wm, s, det, core) * 0.78;
  core = saturate(core - scallop * shellMask * bodyMask * (0.008 + 0.088 * fluff01) * mix_f(0.92, 1.32, max(sparse, definition)) - stretchCoreCarve * shellMask - puffCarve);
  core = max(core, depthSupport * mix_f(0.07, 0.18, fluff01) * mix_f(1.0, 0.72, sparse));
  core = pow(core, mix_f(1.08, 1.22, fluff01) * mix_f(1.0, 1.30, sparse) * mix_f(1.0, 1.12, definition));

  return max(core * densityHeight(phD) * weatherBCutoutWeight(phD, wm), 0.0);
}

fn densityMacroFromSamples(ph: f32, wm: vec4<f32>, s: vec4<f32>) -> f32 {
  if (ph < 0.0) { return 0.0; }
  if (wm.b > 1.0) { return 0.0; }

  let phD = phLayerBreakupMacro(ph, wm, s);
  let sparse = cloudSparsity01();
  let definition = cloudDefinition01();

  var shape = saturate(s.r);
  shape = contrast01(shape, 1.10 + definition * 0.26 + sparse * 0.12);

  let fbm_s = saturate(s.g * 0.625 + s.b * 0.25 + s.a * 0.125);
  let SNsample = saturate(remap(shape, fbm_s * 0.60, 1.0, 0.0, 1.0));

  var SA = saturate(heightShape(phD, 1.0));
  let tallLayerBreak = tallBoxBlend();
  let bodyNoise = saturate(s.g * 0.45 + s.b * 0.35 + s.a * 0.20);
  let bodyLift3D = mix_f(1.0, mix_f(0.94, 1.06, bodyNoise), tallLayerBreak);
  SA = saturate(SA * bodyLift3D);

  let gate = weatherCoverageGate(wm);
  let SNnd = saturate(remap(SNsample * SA, gate * 0.88, 1.0, 0.0, 1.0));

  let detProxy = detailProxyFromShape(max(phD, 0.0), s);
  let macroStretchErode = verticalStretchErosion(phD, detProxy, s, wm);
  let breakup = saturate(detailMod(phD, detProxy) + macroStretchErode * 0.42);

  // Keep far/proxy LODs scalloped, but do not let the proxy become a solid
  // filler that erases detail erosion from the real detail volume.
  var core = saturate(remap(SNnd, 0.09 + breakup * mix_f(0.10, 0.18, sparse), 1.0, 0.0, 1.0));
  let macroShapeBodyCore = saturate(s.r * 0.72 + s.g * 0.20 + s.b * 0.08);
  let macroMidBody = verticalStretchFactor()
    * smoothstep(0.16, 0.42, phD)
    * (1.0 - smoothstep(0.64, 0.90, phD))
    * smoothstep(0.48, 0.88, saturate(max(wm.r, wm.g * 0.92)))
    * smoothstep(0.42, 0.82, macroShapeBodyCore);
  core = max(core, macroMidBody * mix_f(0.08, 0.22, anvilTowerStrength()));
  core = max(core, anvilLowerBodySupport(phD, wm, macroShapeBodyCore) * 0.82);
  let macroDepthBodyBand = smoothstep(0.12, 0.38, phD) * (1.0 - smoothstep(0.76, 0.96, phD));
  let macroDepthWeather = smoothstep(0.42, 0.90, saturate(max(wm.r, wm.g * 0.94)));
  let macroDepthShape = smoothstep(0.38, 0.84, macroShapeBodyCore);
  let macroDepthSupport = macroDepthBodyBand * macroDepthWeather * macroDepthShape;
  let macroPocket = ridge01(contrast01(saturate(shape * 0.54 + fbm_s * 0.46), 2.05));
  core = max(core, macroDepthSupport * (0.20 + 0.06 * macroPocket) * mix_f(1.0, 0.76, sparse));
  let macroClosure = macroMidBody * smoothstep(0.06, 0.30, core) * 0.13 * mix_f(1.0, 0.58, sparse);
  let macroLowerClosure = smoothstep(0.05, 0.22, phD) * (1.0 - smoothstep(0.36, 0.66, phD)) * smoothstep(0.48, 0.84, macroShapeBodyCore) * 0.08 * mix_f(1.0, 0.64, sparse);
  core = max(core, macroClosure);
  core = max(core, macroLowerClosure);
  core = pow(core, mix_f(1.04, 1.24, max(sparse, definition * 0.72)));

  let contour = ridge01(contrast01(saturate(shape * 0.64 + fbm_s * 0.36), 2.10));
  let carveMask = mix_f(0.48, 1.0, saturate(remap(phD, 0.0, 0.96, 0.0, 1.0)));
  let pocketCarve = pow(saturate(1.0 - macroPocket), mix_f(1.28, 1.02, definition)) * (0.020 + 0.038 * saturate(TUNE.fluffFactor / (TUNE.fluffFactor + 1.45))) * mix_f(0.92, 1.42, sparse);
  let carve = 1.0 - (0.08 * saturate(breakup) * mix_f(1.0, 1.32, sparse) + 0.04 * contour * mix_f(1.0, 1.28, definition) + pocketCarve) * carveMask;
  core = max(saturate(core * saturate(carve)), macroDepthSupport * 0.13 * mix_f(1.0, 0.62, sparse));
  return max(core * densityHeight(phD) * weatherBCutoutWeight(phD, wm), 0.0);
}

fn densityWeatherProxy(ph: f32, wm: vec4<f32>) -> f32 {
  if (ph < 0.0) { return 0.0; }
  if (wm.b > 1.0) { return 0.0; }

  let phD = saturate(ph + (wm.g - 0.5) * 0.030 + (wm.r - 0.5) * 0.018);
  let gate = weatherCoverageGate(wm);
  let cloudField = saturate(max(wm.r, wm.g * 0.92) * (0.82 + wm.a * 0.22));
  let heightField = heightShape(phD, 1.0) * densityHeight(phD);
  var core = saturate(remap(cloudField * heightField, gate * 0.78, 1.0, 0.0, 1.0));

  let edgeGrain = ridge01(contrast01(saturate(wm.r * 0.58 + wm.g * 0.34 + wm.a * 0.08), 2.15));
  let stretchProxy = verticalStretchFactor() * smoothstep(0.08, 0.92, phD) * edgeGrain;
  let topCarve = smoothstep(0.48, 0.96, phD);
  let baseCarve = 1.0 - smoothstep(0.0, 0.18, phD) * 0.20;
  core = pow(core, 1.12);
  let proxyMidBody = verticalStretchFactor()
    * smoothstep(0.18, 0.44, phD)
    * (1.0 - smoothstep(0.62, 0.88, phD))
    * smoothstep(0.54, 0.90, cloudField);
  let proxyAnvilBody = anvilLowerBodySupport(phD, wm, cloudField) * 0.62;
  core *= saturate(1.0 - edgeGrain * mix_f(0.055, 0.145, topCarve) - stretchProxy * 0.052 * (1.0 - proxyMidBody * 0.70));
  core = max(core, proxyMidBody * 0.06);
  core = max(core, proxyAnvilBody);
  core *= baseCarve;

  return max(core, 0.0);
}

fn auroraCurtainDensity(ph: f32, wm: vec4<f32>, s: vec4<f32>, det: vec3<f32>, pos: vec3<f32>) -> f32 {
  if (ph < 0.0) { return 0.0; }
  if (wm.b > 1.0) { return 0.0; }

  let phs = saturate(ph);
  let cap = auroraCapMask(pos);
  if (cap <= 0.0001) { return 0.0; }

  let uv = auroraUVFromWorld(pos);
  let broadWeather = saturate(wm.r * 0.60 + wm.g * 0.40);
  let weatherGate = smoothstep(0.30, 0.78, broadWeather);
  let shellBand = smoothstep(0.035, 0.18, phs) * (1.0 - smoothstep(0.82, 1.0, phs));
  let upperFade = 1.0 - smoothstep(0.78, 1.0, phs);

  let fbm = saturate(s.g * 0.58 + s.b * 0.27 + s.a * 0.15);
  let fbm2 = saturate(s.r * 0.42 + s.b * 0.37 + s.g * 0.21);
  let fbmRidge = pow(saturate(ridge01(contrast01(fbm, 2.05))), 0.78);
  let sheetBody = smoothstep(0.28, 0.76, fbm * 0.62 + fbmRidge * 0.38);
  let sheetBreak = smoothstep(0.22, 0.74, fbm2);
  let smoothShape = smoothstep(0.20, 0.88, fbm * 0.68 + sheetBody * 0.32);
  let detMean = saturate((det.r + det.g + det.b) * 0.3333333333);

  let flowWarp = (fbm2 - 0.5) * 0.20 + (smoothShape - 0.5) * 0.06;
  let ribbonPhase = (uv.x + flowWarp + phs * 0.018) * (2.0 * PI * 13.0);
  let softStripe = smoothstep(0.12, 0.94, 0.5 + 0.5 * sin(ribbonPhase));
  let ribbon = mix_f(sheetBody, max(sheetBody, softStripe * sheetBreak), 0.28);
  let curtainStrands = smoothstep(
    0.18,
    0.86,
    smoothCellHash2D(vec2<f32>(uv.x * 1.7, uv.y * 5.5 + phs * 0.55), 9.0)
  );

  let coherentCurtain =
    weatherGate *
    shellBand *
    upperFade *
    mix_f(0.68, 1.20, smoothShape) *
    mix_f(0.74, 1.24, ribbon) *
    mix_f(0.88, 1.10, curtainStrands) *
    mix_f(0.86, 1.12, sheetBreak) *
    mix_f(0.96, 1.04, detMean);

  return max(
    coherentCurtain * cap * densityHeight(phs) * weatherBCutoutWeight(phs, wm) * 0.42,
    0.0
  );
}

fn auroraEmissionColor(pos: vec3<f32>, ph: f32, viewDir: vec3<f32>, sunDir: vec3<f32>, auroraMask: f32) -> vec3<f32> {
  let relShell = pos - B.center;
  let shellN = normalizeOr(relShell, vec3<f32>(0.0, 1.0, 0.0));
  let nightBoost = 1.0 - smoothstep(-0.18, 0.42, dot(shellN, sunDir));
  let limb = pow(1.0 - saturate(dot(shellN, viewDir)), 1.85);
  let phs = saturate(ph);

  let oxygenGreen = max(C.frontLightColor, vec3<f32>(0.0));
  let shadowGreen = max(C.shadowLightColor, vec3<f32>(0.0));
  let base = mix_v3(oxygenGreen * 0.82, shadowGreen * 1.18, 0.28);
  let upperTint = mix_v3(base, max(C.sunColor, vec3<f32>(0.0)) * vec3<f32>(0.70, 1.04, 0.50), smoothstep(0.48, 0.94, phs) * 0.18);
  let capLift = mix_f(0.82, 1.18, saturate(auroraMask));
  return upperTint * capLift * mix_f(0.82, 1.85, nightBoost) + upperTint * limb * 0.20;
}

fn syntheticShapeFromWeather(ph: f32, wm: vec4<f32>) -> vec4<f32> {
  let h = heightShape(ph, 1.0);
  let cloudField = saturate(max(wm.r, wm.g * 0.92) * (0.82 + wm.a * 0.22));
  let r = saturate(cloudField * mix_f(0.82, 1.08, h));
  let g = saturate(wm.g * 0.82 + wm.r * 0.18);
  let b = saturate(wm.a * 0.70 + ridge01(wm.r) * 0.30);
  let a = saturate(wm.r * 0.55 + wm.g * 0.28 + wm.a * 0.17);
  return vec4<f32>(r, g, b, a);
}


fn sampleLightingDensity(
  pos: vec3<f32>,
  weatherLOD: f32,
  lodShape: f32,
  lodDetail: f32,
  wScale: f32
) -> f32 {
  let uv = weatherUV_from(pos, wScale);
  let wm = wrap2D(weather2D, samp2D, uv, 0i, weatherLOD);
  let phL = computePH(pos, wm);
  if (phL < 0.0 || wm.b > 1.0) { return 0.0; }

  let auroraMask = auroraCapMask(pos);
  if (auroraMask <= 0.0001) { return 0.0; }

  var d = 0.0;
  if (auroraLayerMode()) {
    let s = syntheticShapeFromWeather(phL, wm);
    let det = detailProxyFromShape(phL, s);
    d = auroraCurtainDensity(phL, wm, s, det, pos);
  } else {
    let w = worldWarpXZLighting(pos.xz, phL, wg_boxMaxXZ);
    let s = sampleShapeRGBAWarp(pos, phL, lodShape, w);
    let det = sampleDetailRGBWarp(pos, phL, lodDetail, w);
    d = densityFromSamples(phL, wm, s, det);
  }
  d *= insideFaceFade(pos, boxMin(), boxMax()) * auroraMask;
  return max(d, 0.0);
}

fn approxLightingNormal(
  pos: vec3<f32>,
  weatherLOD: f32,
  lodShape: f32,
  lodDetail: f32,
  wScale: f32
) -> vec3<f32> {
  let probe = max(wg_finestWorld * 0.9, 1e-3);

  let dx =
    sampleLightingDensity(pos + vec3<f32>(probe, 0.0, 0.0), weatherLOD, lodShape, lodDetail, wScale) -
    sampleLightingDensity(pos - vec3<f32>(probe, 0.0, 0.0), weatherLOD, lodShape, lodDetail, wScale);

  let dy =
    sampleLightingDensity(pos + vec3<f32>(0.0, probe, 0.0), weatherLOD, lodShape, lodDetail, wScale) -
    sampleLightingDensity(pos - vec3<f32>(0.0, probe, 0.0), weatherLOD, lodShape, lodDetail, wScale);

  let dz =
    sampleLightingDensity(pos + vec3<f32>(0.0, 0.0, probe), weatherLOD, lodShape, lodDetail, wScale) -
    sampleLightingDensity(pos - vec3<f32>(0.0, 0.0, probe), weatherLOD, lodShape, lodDetail, wScale);

  let g = vec3<f32>(dx, dy, dz);
  if (dot(g, g) < 1e-8) {
    let n = normalize(vec3<f32>(
      smoothCellHash2D(pos.xz + vec2<f32>(11.7, 3.9), 5.0) - 0.5,
      0.22,
      smoothCellHash2D(pos.xz + vec2<f32>(2.4, 17.1), 5.0) - 0.5
    ));
    return n;
  }

  return normalize(-g);
}

fn directionalExposure(
  pos: vec3<f32>,
  weatherLOD: f32,
  lodShape: f32,
  lodDetail: f32,
  sunDir: vec3<f32>,
  wScale: f32
) -> f32 {
  let probe = max(wg_finestWorld * 2.25, 2e-3);

  let d0 = sampleLightingDensity(pos, weatherLOD, lodShape, lodDetail, wScale);
  if (d0 <= 1e-5) { return 0.0; }

  let dFront = sampleLightingDensity(pos + sunDir * probe, weatherLOD, lodShape, lodDetail, wScale);
  let dBack = sampleLightingDensity(pos - sunDir * probe, weatherLOD, lodShape, lodDetail, wScale);

  let opensToSun = saturate((d0 - dFront) / max(d0, 0.06));
  let buriedFromBehind = saturate((dBack - d0) / max(max(dBack, d0), 0.06));

  return saturate(opensToSun * (1.0 - 0.65 * buriedFromBehind));
}

// ---------------------- scattering and lighting
fn BeerLaw(opticalDepth: f32, absorption: f32) -> f32 {
  return exp2(-max(opticalDepth, 0.0) * max(absorption, EPS) * INV_LN2);
}

fn hash11Fast(x: f32) -> f32 {
  var p = fract(x * 0.1031);
  p = p * (p + 33.33);
  p = p * (p + p);
  return fract(p);
}

// Henyey-Greenstein phase, scaled so g = 0 returns 1.0 instead of 1 / 4PI.
// The scale keeps the UI energy range practical while preserving the angular lobe.
fn HG(cos_angle: f32, g: f32) -> f32 {
  let gg = clamp(g, -0.92, 0.92);
  let g2 = gg * gg;
  let ca = clamp(cos_angle, -1.0, 1.0);
  let denom = pow(max(1.0 + g2 - 2.0 * gg * ca, 1e-5), 1.5);
  return (1.0 - g2) / denom;
}

fn transmittanceCutoff() -> f32 {
  let alphaCut = clamp(TUNE.alphaCutoff, 0.0, 0.999);
  return max(1.0 - alphaCut, 0.001);
}

fn frontOcclusionStrength() -> f32 {
  return saturate(TUNE.frontOcclusionStrength);
}

fn frontOcclusionStartTr() -> f32 {
  let alphaStart = clamp(TUNE.frontOcclusionAlpha, 0.0, 0.98);
  return 1.0 - alphaStart;
}

fn frontOcclusionFactor(Tr: f32, sampleRayDistance: f32, nearDist: f32, densMacro: f32) -> f32 {
  let strength = frontOcclusionStrength();
  if (strength <= 0.0001) {
    return 0.0;
  }

  let startTr = frontOcclusionStartTr();
  let lowTr = max(startTr * 0.24, transmittanceCutoff());
  let opacityF = 1.0 - smoothstep(lowTr, startTr, Tr);
  let closeF = 1.0 - smoothstep(nearDist * 1.65, nearDist * 4.50, sampleRayDistance);
  let bodyF = smoothstep(0.045, 0.22, densMacro);
  return saturate(opacityF * closeF * bodyF * strength);
}

fn frontOcclusionCutoff(frontOccF: f32) -> f32 {
  let base = transmittanceCutoff();
  let aggressive = max(base, mix_f(0.035, 0.095, saturate(TUNE.frontOcclusionStrength)));
  return mix_f(base, aggressive, frontOccF);
}

fn CloudPhase(cos_angle: f32) -> f32 {
  let ca = clamp(cos_angle, -1.0, 1.0);
  let towardSun = saturate(ca * 0.5 + 0.5);

  let forwardG = clamp(C.inScatterG, 0.0, 0.92);
  let backwardG = -clamp(C.outScatterG, 0.0, 0.92);

  let forwardPhase = HG(ca, forwardG);
  let backwardPhase = HG(ca, backwardG);
  let balance = saturate(C.inVsOut);

  let raw = max(mix_f(backwardPhase, forwardPhase, balance), 0.0);
  let normalized = raw / (1.0 + raw * 0.42);
  let forwardBoost = mix_f(1.0, 1.18, pow(towardSun, 2.0));
  return normalized * forwardBoost;
}

fn SilverSharpness() -> f32 {
  // Use the control more directly so exponent changes are visibly stronger.
  return clamp(max(C.silverExponent, 0.0), 0.5, 48.0);
}

fn SilverControl() -> f32 {
  let x = max(C.silverIntensity, 0.0);
  return clamp(pow(max(x, 0.0) / 12.0, 0.46) * 2.80, 0.0, 12.0);
}

fn BeerPowderBand(occlusion: f32) -> f32 {
  let occ = saturate(occlusion);
  let band = occ * (1.0 - occ) * 4.0;
  return mix_f(0.18, 1.0, pow(saturate(band), 0.64));
}

fn SilverPhase(
  cos_angle: f32,
  sunVisibility: f32,
  sampleAlpha: f32,
  viewRim: f32,
  sunRim: f32,
  percent_height: f32,
  shapeUp: f32
) -> f32 {
  let towardSun = saturate(cos_angle * 0.5 + 0.5);
  let awaySun = 1.0 - towardSun;
  let bias01 = saturate(C.silverDirectionBias * 0.5 + 0.5);

  let sharpness = SilverSharpness();
  let sharp01 = saturate((sharpness - 0.5) / 47.5);
  let lobeExp = mix_f(1.15, 22.0, pow(sharp01, 0.72));
  let towardLobe = pow(max(towardSun, 0.02), lobeExp);
  let awayLobe = pow(max(awaySun, 0.02), lobeExp);
  let directional = mix_f(awayLobe, towardLobe, bias01);
  let angular = max(directional, towardLobe * mix_f(0.58, 0.88, sharp01));

  let upness = saturate(shapeUp * 0.5 + 0.5);
  let upperExposure = smoothstep(0.52, 0.92, upness);
  let exposedSun = mix_f(0.30, 1.0, pow(saturate(sunVisibility), 0.30));

  let viewEdge = smoothstep(0.018, 0.84, pow(saturate(viewRim), mix_f(0.44, 0.08, sharp01)));
  let lightEdge = smoothstep(0.015, 0.84, pow(saturate(sunRim), mix_f(0.54, 0.10, sharp01)));
  let edge = viewEdge * mix_f(0.42, 1.0, lightEdge) * mix_f(0.40, 1.0, upperExposure);

  let thin = pow(saturate(1.0 - sampleAlpha), mix_f(0.48, 0.08, sharp01));
  let thinGate = smoothstep(0.010, 0.88, thin);
  let sunOcc = 1.0 - saturate(sunVisibility);
  let powder = mix_f(0.42, 1.0, BeerPowderBand(sunOcc));
  let heightGate = smoothstep(0.06, 0.96, saturate(percent_height));
  let horizonMix = saturate(C.silverHorizonBoost);
  let horizon = mix_f(1.0, pow(1.0 - abs(cos_angle), 0.75), horizonMix);

  let strength = SilverControl() * 5.80;
  return strength * angular * edge * thinGate * powder * heightGate * horizon * exposedSun;
}

fn AmbientVisibility(density: f32, sunVisibility: f32, sunSide: f32, dist_along_ray: f32) -> f32 {
  let d = max(density, 0.0);

  let localExtinction = BeerLaw(d * DENSITY_LIGHT_SCALE * 0.55, max(C.cloudBeer * 0.16, 0.03));
  let densityLift = mix_f(0.64, 1.0, localExtinction);
  let sunLift = mix_f(0.82, 1.0, pow(saturate(sunVisibility), 0.55));
  let sideLift = mix_f(0.86, 1.0, pow(saturate(sunSide), 0.45));
  let distanceFade = mix_f(1.0, 0.94, pow(saturate(dist_along_ray / 4500.0), 1.10));

  return densityLift * sunLift * sideLift * distanceFade;
}

fn CalculateLight(
  density: f32,
  sampleAlpha: f32,
  Tsun: f32,
  cos_angle: f32,
  percent_height: f32,
  bluenoise: f32,
  dist_along_ray: f32,
  rimBoost: f32,
  sunSide: f32,
  sunRim: f32,
  viewTransmittance: f32,
  sunExposure: f32,
  upperExposure: f32
) -> vec3<f32> {
  let ca = clamp(cos_angle, -1.0, 1.0);
  let rawSunVisibility = saturate(Tsun);
  let shadowFloor = clamp(C.attenuationClamp * 5.0, 0.075, 0.22);
  let sunVisibility = mix_f(shadowFloor, 1.0, pow(rawSunVisibility, 0.86));

  let phase = CloudPhase(ca);
  let towardSun = saturate(ca * 0.5 + 0.5);
  let awaySun = 1.0 - towardSun;

  let lightDensity = saturate(max(density, 0.0) * DENSITY_LIGHT_SCALE * 0.10);
  let lightSideRaw = saturate(sunSide);
  let lightSide = mix_f(0.56, 1.0, pow(lightSideRaw, 0.62));

  let body = pow(saturate(sampleAlpha), 0.38);
  let thin = pow(saturate(1.0 - sampleAlpha), 0.86);
  let edgeThin = pow(saturate(1.0 - sampleAlpha), 0.34);
  let rim = pow(saturate(rimBoost), 0.58);
  let densityBody = smoothstep(0.08, 0.46, lightDensity);

  let frontShell = pow(saturate(viewTransmittance), 0.42);
  let exposedToSun = saturate(sunExposure);
  let upperGate = saturate(upperExposure);
  let sunOcc = 1.0 - rawSunVisibility;

  let phaseGlow = phase * mix_f(0.15, 0.42, pow(towardSun, 1.10));
  let broadDirect = 0.22 + 0.38 * lightDensity * mix_f(0.84, 1.10, lightSideRaw);

  let reliefDiffuse = sunVisibility
    * mix_f(0.035, 0.28, exposedToSun)
    * pow(lightSideRaw, 0.82)
    * pow(body, 0.58)
    * mix_f(0.72, 1.0, frontShell);

  let silhouetteCore = pow(body, 1.18) * pow(towardSun, 1.05);
  let reliefShadow = silhouetteCore
    * mix_f(0.34, 1.02, 1.0 - lightSideRaw)
    * mix_f(0.48, 0.96, 1.0 - rim)
    * mix_f(0.58, 1.04, sunOcc);

  let cavityShadow = pow(1.0 - lightSideRaw, 1.45)
    * mix_f(0.050, 0.28, body)
    * mix_f(0.52, 0.90, 1.0 - exposedToSun);
  let powderShadow = pow(sunOcc, 0.72)
    * smoothstep(0.16, 0.86, body)
    * mix_f(0.32, 1.0, densityBody)
    * mix_f(0.38, 1.0, 1.0 - lightSideRaw)
    * mix_f(0.56, 1.0, 1.0 - rim);

  let bodyShadow = clamp(mix_f(0.0, 0.50, reliefShadow) + cavityShadow + powderShadow * 0.22, 0.0, 0.86);

  let direct = sunVisibility * lightSide * (broadDirect + phaseGlow + reliefDiffuse) * (1.0 - bodyShadow * 0.90);

  let multiScatter = mix_f(0.18, 0.38, body)
    * mix_f(0.70, 1.0, rawSunVisibility)
    * (1.0 - bodyShadow * 0.55);

  let forwardWrap = pow(towardSun, 0.62)
    * mix_f(0.02, 0.11, thin)
    * mix_f(0.78, 1.0, exposedToSun)
    * sunVisibility;

  let backWrap = pow(awaySun, 0.55)
    * 0.028
    * mix_f(1.0, 0.62, body)
    * (1.0 - reliefShadow * 0.22);

  let ambientBase = 0.09 + max(C.ambientMinimum, 0.0) * 0.72;
  let ambientEdgeFill = max(C.outScatterAmbientAmt, 0.0)
    * mix_f(0.10, 0.68, edgeThin)
    * mix_f(0.48, 1.0, 1.0 - bodyShadow);
  let ambientEdgeCoherence = smoothstep(0.035, 0.18, sampleAlpha);

  let ambientRelief = mix_f(0.0, 0.04, exposedToSun) * mix_f(1.0, 0.80, bodyShadow);
  let ambientHeight = mix_f(0.86, 1.05, saturate(percent_height));
  let ambientVis = AmbientVisibility(density, rawSunVisibility, lightSide, dist_along_ray);
  let ambientOcclusion = clamp(1.0 - bodyShadow * 0.62 - powderShadow * 0.14, 0.42, 1.0);
  let ambient = (ambientBase + ambientEdgeFill * ambientEdgeCoherence + ambientRelief) * ambientHeight * ambientVis * ambientOcclusion;

  let bodyLift = 0.052
    * pow(lightSideRaw, 1.02)
    * pow(body, 0.78)
    * mix_f(0.60, 1.0, 1.0 - bodyShadow)
    * mix_f(0.78, 1.0, rawSunVisibility);

  let silverSharpness = SilverSharpness();
  let exposedShell = smoothstep(0.05, 0.82, exposedToSun) * pow(frontShell, 0.48) * mix_f(0.42, 1.0, upperGate);
  let alphaCoherence = smoothstep(0.020, 0.120, sampleAlpha);
  let silverBase = SilverPhase(ca, rawSunVisibility, sampleAlpha, rimBoost, sunRim, percent_height, upperGate * 2.0 - 1.0) * exposedShell * alphaCoherence;
  let sunEdge = pow(saturate(rimBoost * sunRim), 0.42);

  let silverCrest = silverBase
    * mix_f(1.00, 1.55, edgeThin)
    * mix_f(1.00, 1.54, lightSideRaw)
    * mix_f(0.82, 1.28, sunEdge);

  let throughSunGlint = SilverControl()
    * 1.05
    * exposedShell
    * alphaCoherence
    * pow(max(towardSun, 0.05), 1.25 + silverSharpness * 0.20)
    * mix_f(0.35, 1.0, sunEdge)
    * mix_f(0.82, 1.0, rawSunVisibility);

  let silver = silverCrest + throughSunGlint;

  let lowSunRaw = 1.0 - saturate((L.sunDir.y + 0.08) / 0.82);
  let lowSun = lowSunRaw * 0.42;

  let transLightCol = max(C.sunColor, vec3<f32>(0.0));
  let frontLightCol = max(C.frontLightColor, vec3<f32>(0.0));
  let shadowLightCol = max(C.shadowLightColor, vec3<f32>(0.0));

  let sunCol = transLightCol * mix_v3(vec3<f32>(1.12, 1.08, 1.04), vec3<f32>(1.08, 0.98, 0.90), lowSun);
  let silverCol = mix_v3(transLightCol * vec3<f32>(1.10, 1.07, 1.04), vec3<f32>(1.04, 0.98, 0.94), lowSun * 0.35);
  let skyCol = mix_v3(shadowLightCol * vec3<f32>(0.98, 1.04, 1.14), transLightCol * vec3<f32>(0.68, 0.72, 0.84), lowSun * 0.22);
  let shadowCol = mix_v3(shadowLightCol, transLightCol * vec3<f32>(0.60, 0.66, 0.76), lowSun * 0.18);

  let directEnergy = direct + multiScatter + forwardWrap + backWrap;
  let silverEnergy = silver + bodyLift * mix_f(1.06, 1.62, pow(towardSun, 1.10));
  let ambientEnergy = ambient;

  // Keep the current stormy through-light palette for transmissive/backlit views,
  // but add a second profile-controlled top-lit path for directly sunlit cloud surfaces.
  let shadowTint = shadowCol * (bodyShadow * 0.070 + reliefShadow * 0.030 + cavityShadow * 0.070 + powderShadow * 0.026);
  let transSoftLift = transLightCol * bodyLift * mix_f(0.08, 0.18, exposedShell) + skyCol * ambientEnergy * 0.10;
  let transRadiance = sunCol * directEnergy + silverCol * silverEnergy + skyCol * ambientEnergy + transSoftLift - shadowTint;

  let directSunCol = frontLightCol * mix_v3(vec3<f32>(1.18, 1.20, 1.26), vec3<f32>(1.16, 1.10, 1.02), lowSun * 0.72);
  let directSkyCol = mix_v3(frontLightCol * vec3<f32>(0.82, 0.87, 0.96), shadowLightCol * vec3<f32>(0.90, 0.96, 1.06), lowSun * 0.24);
  let directShadowCol = mix_v3(shadowLightCol * vec3<f32>(0.82, 0.88, 0.98), frontLightCol * vec3<f32>(0.56, 0.60, 0.68), lowSun * 0.16);

  // Direct/front color should mostly appear on exposed cloud tops and faces.
  // Undersides keep the stormy transmissive profile even when the direct boost is high.
  let topSurface = smoothstep(0.36, 0.88, percent_height) * smoothstep(0.18, 0.78, upperGate);
  let directFacing = smoothstep(0.16, 0.76, lightSideRaw) * smoothstep(0.16, 0.88, rawSunVisibility);
  let directView = directFacing
    * smoothstep(0.06, 0.66, frontShell)
    * mix_f(0.42, 1.0, max(topSurface, exposedToSun * 0.45));

  let directProfileBoost = max(TUNE.directLightBoost, 0.0);
  let directSurfaceEnergy = directEnergy * (1.0 + directProfileBoost * mix_f(0.55, 1.0, topSurface))
    + silverEnergy * mix_f(0.10, 0.22, topSurface)
    + ambientEnergy * mix_f(0.34, 0.78, max(exposedToSun, topSurface))
    + bodyLift * mix_f(0.28, 0.92, max(exposedToSun, topSurface));

  let directShadowTint = directShadowCol * (bodyShadow * 0.058 + reliefShadow * 0.032 + cavityShadow * 0.040 + powderShadow * 0.018);
  let directRadiance = directSunCol * directSurfaceEnergy + directSkyCol * (ambientEnergy * 0.55) - directShadowTint;

  let directBlend = saturate(TUNE.directLightBlend) * directView;
  let radiance = mix_v3(transRadiance, directRadiance, directBlend);
  let noiseLift = (bluenoise - 0.5) * 0.00010;

  return max(radiance + vec3<f32>(noiseLift), vec3<f32>(0.0));
}
// approximate surface normal from coarse shape mip
fn approxShapeNormal(pos: vec3<f32>, ph: f32, lodShape: f32) -> vec3<f32> {
  let probe = max(wg_finestWorld * 1.25, 1e-3);

  let c = sampleShapeRGBA(pos, ph, lodShape).r;
  let px = sampleShapeRGBA(pos + vec3<f32>(probe, 0.0, 0.0), ph, lodShape).r;
  let nx = sampleShapeRGBA(pos - vec3<f32>(probe, 0.0, 0.0), ph, lodShape).r;
  let pz = sampleShapeRGBA(pos + vec3<f32>(0.0, 0.0, probe), ph, lodShape).r;
  let nz = sampleShapeRGBA(pos - vec3<f32>(0.0, 0.0, probe), ph, lodShape).r;
  let py = sampleShapeRGBA(pos + vec3<f32>(0.0, probe, 0.0), ph, lodShape).r;
  let ny = sampleShapeRGBA(pos - vec3<f32>(0.0, probe, 0.0), ph, lodShape).r;

  let gy = (py - ny) * 0.5 / probe;
  let gx = (px - nx) * 0.5 / probe;
  let gz = (pz - nz) * 0.5 / probe;

  let g = vec3<f32>(gx, gy, gz);
  if (dot(g, g) < 1e-8) {
    return normalize(vec3<f32>(0.18, 0.28, 0.94));
  }
  return normalize(-g);
}

fn approxShapeNormalFast(pos: vec3<f32>, ph: f32, lodShape: f32) -> vec3<f32> {
  let probe = max(wg_finestWorld * 1.5, 1e-3);
  let px = sampleShapeRGBA(pos + vec3<f32>(probe, 0.0, 0.0), ph, lodShape).r;
  let nx = sampleShapeRGBA(pos - vec3<f32>(probe, 0.0, 0.0), ph, lodShape).r;
  let py = sampleShapeRGBA(pos + vec3<f32>(0.0, probe, 0.0), ph, lodShape).r;
  let ny = sampleShapeRGBA(pos - vec3<f32>(0.0, probe, 0.0), ph, lodShape).r;
  let pz = sampleShapeRGBA(pos + vec3<f32>(0.0, 0.0, probe), ph, lodShape).r;
  let nz = sampleShapeRGBA(pos - vec3<f32>(0.0, 0.0, probe), ph, lodShape).r;

  let g = vec3<f32>((px - nx), (py - ny), (pz - nz)) * (0.5 / probe);
  if (dot(g, g) < 1e-8) {
    return normalize(vec3<f32>(0.18, 0.28, 0.94));
  }
  return normalize(-g);
}

fn approxShapeNormalFromChannels(s: vec4<f32>, pos: vec3<f32>, ph: f32, sunDir: vec3<f32>, viewDir: vec3<f32>) -> vec3<f32> {
  let fbm = saturate(s.g * 0.50 + s.b * 0.32 + s.a * 0.18);
  let ridge = ridge01(contrast01(fbm, 2.10));
  let n = vec3<f32>(
    (s.g - s.b) * 1.28 + (fbm - 0.5) * 0.30,
    (ridge - 0.5) * 0.38 + (ph - 0.5) * 0.10,
    (s.b - s.a) * 1.28 + (s.r - 0.5) * 0.26
  );
  let stable = n + sunDir * 0.18 + viewDir * 0.08;
  if (dot(stable, stable) < 1e-8) {
    return normalize(sunDir * 0.35 + viewDir * 0.20 + vec3<f32>(0.17, 0.08, 0.29));
  }
  return normalize(stable);
}

// reprojection helpers
fn fullPixFromCurrent(pix: vec2<i32>) -> vec2<i32> {
  let res = vec2<f32>(max(f32(frame.fullWidth), 1.0), max(f32(frame.fullHeight), 1.0));
  let fw = max(reproj.fullWidth, frame.fullWidth);
  let fh = max(reproj.fullHeight, frame.fullHeight);
  let fullRes = vec2<f32>(max(f32(fw), 1.0), max(f32(fh), 1.0));
  let xf = floor((vec2<f32>(pix) + 0.5) * (fullRes / res));
  return vec2<i32>(
    i32(clamp(xf.x, 0.0, fullRes.x - 1.0)),
    i32(clamp(xf.y, 0.0, fullRes.y - 1.0))
  );
}

fn temporalCellRateNormalized() -> u32 {
  let r = reproj.temporalCellRate;
  if (r >= 64u) { return 64u; }
  if (r >= 32u) { return 32u; }
  if (r >= 16u) { return 16u; }
  if (r >= 8u) { return 8u; }
  if (r >= 4u) { return 4u; }
  if (r >= 2u) { return 2u; }
  return 1u;
}

fn interleavePermute64(orderIn: u32) -> u32 {
  // Maps temporal order to an 8x8 local pixel. The low order bits are spread
  // across every row and column so 1/2, 1/4, and 1/8 temporal interleave do not
  // collapse into screen-aligned bands.
  let order = orderIn & 63u;
  let phase8 = order & 7u;
  let y = (order >> 3u) & 7u;
  let x = (phase8 + 8u - ((3u * y) & 7u)) & 7u;
  return y * 8u + x;
}

fn interleaveUnpermute64(localIn: u32) -> u32 {
  let local = localIn & 63u;
  let x = local & 7u;
  let y = (local >> 3u) & 7u;
  let phase8 = (x + 3u * y) & 7u;
  return phase8 + y * 8u;
}

fn temporalCellIndex(fullPix: vec2<i32>, rate: u32) -> u32 {
  let x = u32(max(fullPix.x, 0)) & 7u;
  let y = u32(max(fullPix.y, 0)) & 7u;
  let localLinear = y * 8u + x;
  let order = interleaveUnpermute64(localLinear);
  return order % max(rate, 1u);
}

fn temporalCellOwns(fullPix: vec2<i32>) -> bool {
  let rate = temporalCellRateNormalized();
  if (rate <= 1u) { return true; }
  let phase = reproj.temporalCellPhase % rate;
  return temporalCellIndex(fullPix, rate) == phase;
}

fn compactTemporalPixel(gid: vec2<u32>, rate: u32) -> vec4<u32> {
  let fullW = frame.fullWidth;
  let fullH = frame.fullHeight;
  let blocksX = (fullW + 7u) / 8u;
  let blocksY = (fullH + 7u) / 8u;
  let ownersPerBlock = max(1u, 64u / max(rate, 1u));

  let blockX = gid.x / ownersPerBlock;
  let slot = gid.x - blockX * ownersPerBlock;
  let blockY = gid.y;
  if (blockX >= blocksX || blockY >= blocksY) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }

  let phase = reproj.temporalCellPhase % max(rate, 1u);
  let order = slot * max(rate, 1u) + phase;
  if (order >= 64u) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }

  let localLinear = interleavePermute64(order);
  let px = blockX * 8u + (localLinear & 7u);
  let py = blockY * 8u + (localLinear >> 3u);
  if (px < fullW && py < fullH) {
    return vec4<u32>(px, py, 1u, 0u);
  }
  return vec4<u32>(0u, 0u, 0u, 0u);
}

fn store_history_full_res_any(pixCurr: vec2<i32>, layer: i32, color: vec4<f32>) {
  textureStore(historyOut, fullPixFromCurrent(pixCurr), layer, color);
}

fn load_history_full_res(fullPix: vec2<i32>, layer: i32) -> vec4<f32> {
  let fw = i32(max(reproj.fullWidth, frame.fullWidth));
  let fh = i32(max(reproj.fullHeight, frame.fullHeight));
  let p = vec2<i32>(
    clamp(fullPix.x, 0, max(fw - 1, 0)),
    clamp(fullPix.y, 0, max(fh - 1, 0))
  );
  return textureLoad(historyPrev, p, layer, 0);
}

fn store_history_full_res_if_owner(pixCurr: vec2<i32>, layer: i32, color: vec4<f32>) {
  if (reproj.enabled == 0u && temporalCellRateNormalized() <= 1u) {
    textureStore(historyOut, fullPixFromCurrent(pixCurr), layer, color);
    return;
  }

  let ss = i32(max(reproj.subsample, 1u));
  let off = i32(reproj.sampleOffset % u32(ss * ss));
  let sx = off % ss;
  let sy = off / ss;

  let fullPix = fullPixFromCurrent(pixCurr);
  let temporalOwner = (reproj.frameIndex == 0u) || temporalCellOwns(fullPix);
  if (((fullPix.x % ss) == sx && (fullPix.y % ss) == sy) && temporalOwner) {
    textureStore(historyOut, fullPix, layer, color);
  }
}

fn insideFaceFade(p: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>) -> f32 {
  if (sphericalCloudMode()) {
    let radii = shellNominalRadii();
    let rel = p - B.center;
    let r = length(rel);
    let feather = max(activeColumnGuard() * 0.45, shellHeight() * 0.035);
    let inner = smoothstep(radii.x - feather, radii.x + feather, r);
    let outer = 1.0 - smoothstep(radii.y - feather, radii.y + feather, r);

    let camRel = V.camPos - B.center;
    let shellN = normalizeOr(rel, vec3<f32>(0.0, 1.0, 0.0));
    let camN = normalizeOr(camRel, vec3<f32>(0.0, 0.0, 1.0));
    let hemiDot = dot(shellN, camN);
    let visibleHemisphere = select(
      smoothstep(-0.075, 0.025, hemiDot),
      mix_f(0.62, 1.0, smoothstep(-0.28, 0.18, hemiDot)),
      auroraLayerMode()
    );
    return clamp(inner * outer * visibleHemisphere, 0.0, 1.0);
  }

  return select(
    0.0,
    1.0,
    p.x >= bmin.x && p.x <= bmax.x &&
    p.y >= bmin.y && p.y <= bmax.y &&
    p.z >= bmin.z && p.z <= bmax.z
  );
}

// ---------------------- sun march
fn sampleCloudDensityAt(
  p: vec3<f32>,
  weatherLOD: f32,
  lodShapeBase: f32,
  wScale: f32
) -> f32 {
  let uv = weatherUV_from(p, wScale);
  let wm = wrap2D(weather2D, samp2D, uv, 0i, weatherLOD);

  let ph = computePH(p, wm);
  if (ph < 0.0 || wm.b > 1.0) { return 0.0; }

  let lodShape = clamp(lodShapeBase + 0.65, 0.0, wg_maxMipS);
  let w = worldWarpXZLighting(p.xz, ph, wg_boxMaxXZ);
  let s = sampleShapeRGBAWarp(p, ph, lodShape, w);
  let d = densityMacroFromSamples(ph, wm, s) * weatherBCutoutWeight(ph, wm) * insideFaceFade(p, boxMin(), boxMax());

  return max(d, 0.0);
}

fn sunTransmittance(
  p0: vec3<f32>,
  sunDir: vec3<f32>,
  weatherLOD: f32,
  lodShapeBase: f32,
  nominalStepLen: f32,
  wScale: f32,
  stepsIn: i32,
  jitter01: f32
) -> f32 {
  let start = p0 + sunDir * max(TUNE.aabbFaceOffset, EPS);
  var hit = intersectAABB_robust(start, sunDir, boxMin(), boxMax());
  if (sphericalCloudMode()) {
    hit = intersectSphericalCloudShell(start, sunDir);
  }
  let hitDist = max(hit.y, 0.0);

  // Use a local light-cone distance instead of tracing the whole horizon box.
  // Very tall or horizon-sized boxes can make the full AABB exit distance huge,
  // which turns every lit sample into a long secondary ray. Local cloud shading
  // only needs nearby occluders for convincing silver-lining and body shadowing.
  let sunHorizon = 1.0 - abs(sunDir.y);
  let localLightReach = clamp(
    1.45 + verticalReferenceHalfY() * 0.62 + max(B.half.x, B.half.z) * 0.010 + sunHorizon * 0.85,
    1.65,
    4.60
  );
  let availableDist = min(hitDist, localLightReach);
  if (availableDist <= TUNE.minStep) { return 1.0; }

  let targetStep = max(nominalStepLen, TUNE.minStep);
  let requestedSteps = max(stepsIn, 1);
  let distSteps = i32(ceil(availableDist / targetStep));
  let distLimitedSteps = min(distSteps, max(requestedSteps + 2, 4));
  let maxLightSteps = clamp(TUNE.sunSteps + 6, 8, 18);
  let steps = clamp(max(requestedSteps, distLimitedSteps), 1, maxLightSteps);
  let lightStep = availableDist / f32(steps);

  var opticalDepth = 0.0;
  let sunAbsorbScale = max(C.cloudBeer, EPS) * INV_LN2;
  let sunCutoffOD = -log2(max(TUNE.sunMinTr, 1e-6)) / sunAbsorbScale;
  let phase = 0.15 + 0.70 * saturate(fract(jitter01));
  var p = start + sunDir * (phase * lightStep);
  var sideARaw = cross(sunDir, vec3<f32>(0.0, 1.0, 0.0));
  if (dot(sideARaw, sideARaw) < 1e-5) {
    sideARaw = cross(sunDir, vec3<f32>(1.0, 0.0, 0.0));
  }
  let sideA = normalize(sideARaw);
  let sideB = normalize(cross(sideA, sunDir));
  let jitterAmpBase = min(lightStep * 0.16, max(wg_finestWorld * 0.85, verticalReferenceHalfY() * 0.010));
  let jitterAmp = jitterAmpBase * cloudModeF32(1.0, 0.42, 0.05);

  for (var i: i32 = 0; i < steps; i = i + 1) {
    let jf = f32(i) + jitter01 * 23.17;
    let jx = hash11Fast(jf + 0.17) * 2.0 - 1.0;
    let jy = hash11Fast(jf + 9.73) * 2.0 - 1.0;
    let pj = p + (sideA * jx + sideB * jy) * jitterAmp;
    let lightMipAdd = min(f32(i) * 0.5, 2.5);
    let d = sampleCloudDensityAt(
      pj,
      clamp(weatherLOD + lightMipAdd * 0.35, 0.0, wg_maxMipW),
      lodShapeBase + lightMipAdd,
      wScale
    );
    opticalDepth += d * lightStep * SUN_EXTINCTION_SCALE;
    if (opticalDepth > sunCutoffOD) { break; }
    p += sunDir * lightStep;
  }

  return exp2(-max(opticalDepth, 0.0) * sunAbsorbScale);
}

// quick empty probe
fn weatherProbeEmpty(
  p_start: vec3<f32>,
  rd: vec3<f32>,
  stepLen: f32,
  nProbes: i32,
  coarseMip: f32,
  wScale: f32
) -> bool {
  var pos = p_start;
  var emptyCount: i32 = 0;

  for (var i: i32 = 0; i < nProbes; i = i + 1) {
    let uv = weatherUV_from(pos, wScale);
    let wm = wrap2D(weather2D, samp2D, uv, 0i, coarseMip);
    if (weatherCoverageGate(wm) >= TUNE.weatherRejectGate) { emptyCount = emptyCount + 1; }
    pos = pos + rd * stepLen;
  }

  return (f32(emptyCount) / f32(nProbes)) > 0.66;
}

// ---------------------- Main compute

@compute @workgroup_size(8, 8, 1)
fn computeCloud(
  @builtin(global_invocation_id) gid_in: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  // workgroup cache
  if (local_id.x == 0u && local_id.y == 0u) {
    let wd = textureDimensions(weather2D, 0);
    wg_weatherDim = vec2<f32>(f32(wd.x), f32(wd.y));
    let weatherEp = vec2<f32>(0.5 / max(wg_weatherDim.x, 1.0), 0.5 / max(wg_weatherDim.y, 1.0));
    wg_weatherUvMul = vec2<f32>(1.0, 1.0) - 2.0 * weatherEp;
    wg_weatherUvAdd = weatherEp;

    let bd = textureDimensions(blueTex, 0);
    wg_blueDim = vec2<f32>(f32(bd.x), f32(bd.y));

    let sd = textureDimensions(shape3D);
    wg_shapeDim = vec3<f32>(f32(sd.x), f32(sd.y), f32(sd.z));
    let shapeEp = vec3<f32>(
      0.5 / max(wg_shapeDim.x, 1.0),
      0.5 / max(wg_shapeDim.y, 1.0),
      0.5 / max(wg_shapeDim.z, 1.0)
    );
    wg_shapeUvMul = vec3<f32>(1.0, 1.0, 1.0) - 2.0 * shapeEp;
    wg_shapeUvAdd = shapeEp;

    let dd = textureDimensions(detail3D);
    wg_detailDim = vec3<f32>(f32(dd.x), f32(dd.y), f32(dd.z));
    let detailEp = vec3<f32>(
      0.5 / max(wg_detailDim.x, 1.0),
      0.5 / max(wg_detailDim.y, 1.0),
      0.5 / max(wg_detailDim.z, 1.0)
    );
    wg_detailUvMul = vec3<f32>(1.0, 1.0, 1.0) - 2.0 * detailEp;
    wg_detailUvAdd = detailEp;

    wg_maxMipW = f32(textureNumLevels(weather2D)) - 1.0;
    wg_maxMipS = f32(textureNumLevels(shape3D)) - 1.0;
    wg_maxMipD = f32(textureNumLevels(detail3D)) - 1.0;

    let scaleS_local = max(V.worldToUV * B.uvScale, EPS);
    wg_scaleS = scaleS_local;
    wg_scaleD = max(scaleS_local * (128.0 / 32.0), EPS);

    let sAxis = axisOrOne3(NTransform.shapeAxisScale);
    let dAxis = axisOrOne3(NTransform.detailAxisScale);

    let sMul = select(NTransform.shapeScale, 1.0, NTransform.shapeScale == 0.0);
    let dMul = select(NTransform.detailScale, 1.0, NTransform.detailScale == 0.0);

    wg_scaleS_effMax = wg_scaleS * max(sMul, EPS) * axisMaxAbs3(sAxis);
    wg_scaleD_effMax = wg_scaleD * max(dMul, EPS) * axisMaxAbs3(dAxis);

    wg_finestWorld = min(1.0 / wg_scaleS_effMax, 1.0 / wg_scaleD_effMax) * 0.6;

    // Keep jitter/warp amplitude and the homogeneous vertical profile at the
    // original local-cloud scale even when the horizon box tiles outward.
    let rawBoxMaxXZ = max(max(B.half.x, B.half.z), 1.0);
    wg_boxMaxXZ = min(rawBoxMaxXZ, 1.0);
    wg_tallBlend = saturate(remap(B.half.y, 0.34, 1.60, 0.0, 1.0));
    wg_thickPerfStrength = saturate(remap(B.half.y, 0.36, 2.40, 0.0, 1.0)) * clamp(TUNE.thickBoxPerf, 0.0, 2.0);

    wg_verticalHomogeneity = saturate(TUNE.verticalTextureHomogeneity);
    let baseHalfY = max(B.half.y, EPS);
    let refHalfY = clamp(wg_boxMaxXZ, 0.35, 1.25);
    wg_verticalRefHalfY = mix_f(baseHalfY, min(baseHalfY, refHalfY), wg_verticalHomogeneity);
    wg_verticalRefBoxH = max(wg_verticalRefHalfY * 2.0, EPS);
    let yTileTarget = rawBoxMaxXZ / max(wg_verticalRefBoxH * 2.75, 0.25);
    wg_verticalDomainScale = mix_f(1.0, clamp(yTileTarget, 1.0, 9.0), wg_verticalHomogeneity);
    wg_weatherAxisYAbs = max(abs(axisOrOne3(NTransform.weatherAxisScale).y), EPS);
    wg_boxMinCached = B.center - B.half;
    wg_boxMaxCached = B.center + B.half + vec3<f32>(0.0, anvilLiftWorld(), 0.0);
  }
  workgroupBarrier();

  // pixel and guard
  let temporalRate = temporalCellRateNormalized();
  let temporalHistoryActive = reproj.enabled == 1u || temporalRate > 1u || reproj.temporalBlend > 0.0001;
  let compactInterleave = reproj.compactInterleave != 0u && temporalRate > 1u && reproj.frameIndex > 0u;

  var pixI = vec2<i32>(i32(gid_in.x), i32(gid_in.y)) + vec2<i32>(frame.originX, frame.originY);
  if (compactInterleave) {
    let mapped = compactTemporalPixel(gid_in.xy, temporalRate);
    if (mapped.z == 0u) { return; }
    pixI = vec2<i32>(i32(mapped.x), i32(mapped.y));
  }

  if (pixI.x < 0 || pixI.y < 0 || pixI.x >= i32(frame.fullWidth) || pixI.y >= i32(frame.fullHeight)) {
    return;
  }

  let fullPix = fullPixFromCurrent(pixI);
  let screenInterleaveF = 0.0;

  let fullResF = vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));
  let uvPix = (vec2<f32>(pixI) + 0.5) / fullResF;

  // camera basis
  let camFwd = normalize(V.fwd);

  var basisRight = normalize(V.right);
  if (length(basisRight) < EPS) { basisRight = vec3<f32>(1.0, 0.0, 0.0); }

  var basisUp = normalize(V.up);
  if (length(basisUp) < EPS) { basisUp = vec3<f32>(0.0, 1.0, 0.0); }

  // ray origin
  var rayRo = V.camPos;
  if (CLOUD_USE_CUSTOM_POS != 0u) {
    let idx = u32(pixI.x) + u32(pixI.y) * frame.fullWidth;
    rayRo = posBuf[idx].xyz;
  }

  // ray direction
  // Keep the primary-ray dither stable per pixel. Frame-varying ray jitter was
  // good for breaking seams, but it caused subtle lighting shimmer/flicker once
  // the post resolve started blending thin cloud pixels.
  let rayJx = hash11Fast(f32(fullPix.x) * 0.06711056 + f32(fullPix.y) * 0.00583715 + 0.754877666) - 0.5;
  let rayJy = hash11Fast(f32(fullPix.x) * 0.01145137 + f32(fullPix.y) * 0.09324173 + 14.124877666) - 0.5;
  let jitterPixScreen = vec2<f32>(rayJx, rayJy) * 0.18;
  // Spherical planet clouds must stay locked to world/sphere coordinates.
  // Screen-space subpixel jitter makes the volume crawl relative to the camera.
  var jitterPix = jitterPixScreen;
  if (sphericalCloudMode()) {
    jitterPix = vec2<f32>(0.0, 0.0);
  }
  let jitteredUvPix = (vec2<f32>(pixI) + 0.5 + jitterPix) / fullResF;
  let ndc = jitteredUvPix * 2.0 - vec2<f32>(1.0, 1.0);
  let tanY = tan(0.5 * V.fovY);

  let rd_camera = normalize(vec3<f32>(ndc.x * V.aspect * tanY, -ndc.y * tanY, -1.0));
  let rayRd = normalize(basisRight * rd_camera.x + basisUp * rd_camera.y - camFwd * rd_camera.z);

  // intersect volume
  let bmin = boxMin();
  let bmax = boxMax();
  var ti = intersectAABB_robust(rayRo, rayRd, bmin, bmax);
  if (sphericalCloudMode()) {
    ti = intersectSphericalCloudShellView(rayRo, rayRd);
  }

  if (ti.x > ti.y || ti.y <= 0.0) {
    let z = vec4<f32>(0.0);
    textureStore(outTex, pixI, frame.layerIndex, z);
    if (temporalHistoryActive) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }
    return;
  }

  var t0 = max(ti.x - TUNE.aabbFaceOffset, 0.0);
  var t1 = ti.y + TUNE.aabbFaceOffset;
  if (t0 >= t1) {
    let z = vec4<f32>(0.0);
    textureStore(outTex, pixI, frame.layerIndex, z);
    if (temporalHistoryActive) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }
    return;
  }

  let globalYR = globalActiveYRange();
  let segY0 = rayRo.y + rayRd.y * t0;
  let segY1 = rayRo.y + rayRd.y * t1;
  if (max(segY0, segY1) < globalYR.x || min(segY0, segY1) > globalYR.y) {
    let z = vec4<f32>(0.0);
    textureStore(outTex, pixI, frame.layerIndex, z);
    if (temporalHistoryActive) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }
    return;
  }

  // Tall AABBs are allowed as traversal headroom, but the actual cloud profile
  // can be much thinner. Clip the ray segment to the global active Y band before
  // deriving the ray budget so vertical extent does not inflate primary steps.
  if (abs(rayRd.y) > 1e-5) {
    var ty0 = (globalYR.x - rayRo.y) / rayRd.y;
    var ty1 = (globalYR.y - rayRo.y) / rayRd.y;
    if (ty0 > ty1) {
      let tmp = ty0;
      ty0 = ty1;
      ty1 = tmp;
    }
    t0 = max(t0, ty0 - TUNE.aabbFaceOffset);
    t1 = min(t1, ty1 + TUNE.aabbFaceOffset);
    if (t0 >= t1) {
      let z = vec4<f32>(0.0);
      textureStore(outTex, pixI, frame.layerIndex, z);
      if (temporalHistoryActive) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }
      return;
    }
  }

  // ---------------------- precompute weather mapping and LOD
  let wScale = select(NTransform.weatherScale, 1.0, NTransform.weatherScale == 0.0);
  let wAxis = axisOrOne3(NTransform.weatherAxisScale);

  let weatherTileInvWorld = 0.5 * max(B.uvScale, EPS);
  var texelsPerWorld_u = wg_weatherDim.x * abs(wAxis.x) * wScale * weatherTileInvWorld;
  var texelsPerWorld_v = wg_weatherDim.y * abs(wAxis.z) * wScale * weatherTileInvWorld;
  if (sphericalCloudMode()) {
    let rMid = max(sphereRadiusBase() + (V.cloudBottom + V.cloudTop) * 0.5, 1.0);
    texelsPerWorld_u = wg_weatherDim.x * abs(wAxis.x) * wScale / max(2.0 * PI * rMid, EPS);
    texelsPerWorld_v = wg_weatherDim.y * abs(wAxis.z) * wScale / max(PI * rMid, EPS);
  }
  let fp = max(texelsPerWorld_u, texelsPerWorld_v);

  let weatherLOD_base = clamp(
    log2(max(fp, 1.0)) + TUNE.lodBiasWeather * max(perf.lodBiasMul, 0.0001),
    0.0,
    wg_maxMipW
  );

  let fullHeightF = max(f32(frame.fullHeight), 1.0);
  let rayPixelWorldScale = (2.0 * tanY) / fullHeightF;

  // Use true ray distance from the active camera origin for near/far behavior.
  // Projected camera-forward depth breaks down with wide FOV and when the
  // camera enters the volume, which can make nearby cloud samples use far LODs.
  let entryRayDistance = max(t0, 0.0);

  let horizonFarScale = max(max(B.half.x, B.half.z), 1.0);
  let nearMetricScale = max(horizonFarScale, max(verticalReferenceBoxH(), 1.0));
  let effectiveNearFluffDist = clamp(min(TUNE.nearFluffDist, nearMetricScale * 0.10), 0.35, 6.0);
  let effectiveNearDensityRange = clamp(min(TUNE.nearDensityRange, nearMetricScale * 0.08), 0.35, 5.0);
  let nearFineDist = clamp(effectiveNearFluffDist * 0.12, 0.08, 0.35);

  // noise and jitter
  let bnPix = distanceBlueScreen(pixI, entryRayDistance, effectiveNearFluffDist);
  let entryWorldForNoise = rayRo + rayRd * max(t0, 0.0);
  // World/sphere-locked smooth noise. Do not include frameIndex here:
  // frame-varying jitter turns x4 interleave into visible flicker.
  var rand0 = bnPix;
  if (sphericalCloudMode()) {
    let entryUvForNoise = shellUVFromWorld(entryWorldForNoise);
    let worldRandFreq = auroraModeF32(128.0, 56.0);
    rand0 = smoothCellHash2D(entryUvForNoise + vec2<f32>(13.71, 4.23), worldRandFreq);
  }
  let entryNearF = 1.0 - smoothstep(0.0, max(effectiveNearFluffDist, EPS), entryRayDistance);
  let nearJitterScale = mix_f(1.0, 0.32, entryNearF);

  // step sizing
  let viewDir = -rayRd;

  let voxelBound = wg_finestWorld / max(abs(dot(rayRd, basisUp)), 0.15);

  let raySegmentLength = max(t1 - t0, TUNE.minStep);
  let segmentAspect = raySegmentLength / max(max(B.half.x, B.half.z), max(B.half.y * 2.0, 1.0));
  let thickPerfF = saturate(thickBoxPerfStrength() * saturate(remap(segmentAspect, 0.35, 1.45, 0.0, 1.0)));
  let maxStepsF = max(f32(max(TUNE.maxSteps, 1)), 1.0);
  let horizonPerfF = smoothstep(24.0, 120.0, horizonFarScale) * smoothstep(0.30, 1.10, segmentAspect);
  let reachStepLimit = (raySegmentLength / maxStepsF) * mix_f(1.10, 1.55, horizonPerfF);
  let vStepBoost = verticalStepBoost();
  let thickStepLimit = TUNE.maxStep * mix_f(1.0, max(TUNE.thickStepBoost, 1.0), thickPerfF);
  let verticalStepLimit = TUNE.maxStep * vStepBoost;
  let effectiveMaxStep = max(max(max(TUNE.maxStep, thickStepLimit), verticalStepLimit), reachStepLimit);

  var baseStep = clamp(V.stepBase, TUNE.minStep, effectiveMaxStep);
  baseStep = min(baseStep, voxelBound * mix_f(1.0, 1.65, thickPerfF));
  let sphericalJitterScale = cloudModeF32(1.0, 0.46, 0.18);
  baseStep = baseStep * mix_f(1.0, 1.0 + TUNE.stepJitter * nearJitterScale * sphericalJitterScale, rand0 * 2.0 - 1.0);
  baseStep = clamp(baseStep, TUNE.minStep, effectiveMaxStep);

  let farStartWorld = max(TUNE.farStart * horizonFarScale, TUNE.farStart);
  let farFullWorld = max(TUNE.farFull * horizonFarScale, farStartWorld + 0.001);

  let rayExitDepth = max(t1, entryRayDistance);
  let rayFarHistoryF = saturate(remap(rayExitDepth, farStartWorld, farFullWorld, 0.0, 1.0));
  let thickBudgetBoost = mix_f(1.08, max(1.08, TUNE.thickStepBoost), thickPerfF);
  let rayBudgetStep = clamp((raySegmentLength / maxStepsF) * max(thickBudgetBoost, vStepBoost), TUNE.minStep, effectiveMaxStep);

  let startPhaseJitter = TUNE.phaseJitter * mix_f(1.0, 0.30, entryNearF) * sphericalJitterScale;
  var t = clamp(t0 + (rand0 * startPhaseJitter) * min(baseStep, rayBudgetStep), t0, t1);

  // lighting setup. rayRd points from camera into the volume, matching the blog-style phase convention.
  let sunDir = normalize(L.sunDir);
  let cosVS = dot(rayRd, sunDir);

  // sun shadowing samples should cover neighboring cloud volume, not only the vertical slab thickness.
  let sunBoxHalf = vec3<f32>(B.half.x, verticalReferenceHalfY(), B.half.z);
  let sunNominalSpan = max(min(length(sunBoxHalf * 2.0) * 0.5, 4.0) * verticalLightingStepBoost(), EPS);
  let sunStepLen = clamp(
    sunNominalSpan / f32(max(TUNE.sunSteps, 1)),
    TUNE.minStep,
    max(effectiveMaxStep, sunNominalSpan)
  );

  // accumulators
  var Tr = 1.0;
  var rgb = vec3<f32>(0.0);

  var Tsun_cached = 1.0;
  var prevDens: f32 = 0.0;
  var prevMacroDens: f32 = 0.0;
  var prevTsun: f32 = 1.0;

  var shapeN_cached = vec3<f32>(0.0, 1.0, 0.0);
  var lightN_cached = vec3<f32>(0.0, 1.0, 0.0);
  var rim_cached: f32 = 0.0;
  var sunSide_cached: f32 = 0.5;
  var sunRim_cached: f32 = 0.0;
  var sunExposure_cached: f32 = 0.0;
  var upperExposure_cached: f32 = 1.0;

  var runMeanL: f32 = 0.0;
  var runN: f32 = 0.0;

  var iter: i32 = 0;

  var maxMarchSteps = TUNE.maxSteps;
  if (auroraLayerMode()) {
    maxMarchSteps = min(TUNE.maxSteps, 56);
  }

  loop {
    if (iter >= maxMarchSteps) { break; }
    if (t >= t1) { break; }
    if (Tr <= transmittanceCutoff()) {
      Tr = 0.0;
      break;
    }

    let rayShallowF = 1.0 - smoothstep(0.025, 0.22, abs(rayRd.y));
    let planetSliceJitterScale = cloudModeF32(1.0, 0.58, 0.36);
    let sliceJitter = saturate(TUNE.sliceJitterStrength) * mix_f(1.0, 1.55, rayShallowF) * sphericalJitterScale * planetSliceJitterScale;
    let sliceHashScreen = hash11Fast(
      f32(fullPix.x) * 0.071324 +
      f32(fullPix.y) * 0.117913 +
      f32(iter) * 0.167351 +
      rand0 * 19.1731
    );

    let stepT = clamp(t, t0, t1);
    let stepRayDistance = max(stepT, 0.0);
    let stepPixelWorld = max(stepRayDistance * rayPixelWorldScale, wg_finestWorld * 0.50);
    let farF = saturate(remap(stepRayDistance, farStartWorld, farFullWorld, 0.0, 1.0));
    let screenFarF = saturate(remap(stepPixelWorld / max(wg_finestWorld, EPS), 2.0, 18.0, 0.0, 1.0));
    let coverageStep = max(
      rayBudgetStep,
      baseStep * mix_f(1.0, max(TUNE.farStepMult, 1.0), screenFarF)
    );
    let nearStepF = 1.0 - smoothstep(0.0, nearFineDist, stepRayDistance);
    let fineStep = baseStep * mix_f(1.0, clamp(TUNE.nearStepScale, 0.12, 1.0), nearStepF);
    var stepLen = clamp(mix_f(coverageStep, fineStep, nearStepF), TUNE.minStep, effectiveMaxStep);
    let temporalMarchF = mix_f(1.0, sqrt(f32(max(temporalRate, 1u))) * 0.82 + 0.30, screenInterleaveF);
    stepLen = clamp(stepLen * temporalMarchF, TUNE.minStep, effectiveMaxStep * max(temporalMarchF, 1.0));
    if (auroraLayerMode()) {
      let auroraTargetStep = raySegmentLength / 42.0;
      let auroraStepMax = max(effectiveMaxStep, raySegmentLength / 28.0);
      stepLen = clamp(max(stepLen, auroraTargetStep), TUNE.minStep * 3.0, auroraStepMax);
    }

    var sliceHash = sliceHashScreen;
    if (sphericalCloudMode()) {
      let sliceProbeT = clamp(t + stepLen * 0.50, t0, t1);
      let sliceProbeP = rayRo + rayRd * sliceProbeT;
      let sliceProbeUv = shellUVFromWorld(sliceProbeP);
      let sliceShellPhase = shellPhase01FromWorld(sliceProbeP);
      let sliceHashWorldA = smoothCellHash2D(
        sliceProbeUv + vec2<f32>(sliceShellPhase * 0.173 + rand0 * 0.019, sliceShellPhase * 0.311),
        auroraModeF32(176.0, 104.0)
      );
      let sliceHashWorldB = smoothCellHash2D(
        vec2<f32>(sliceProbeUv.x * 2.7 + sliceShellPhase * 9.0, sliceProbeUv.y * 2.1 - sliceShellPhase * 6.0),
        auroraModeF32(72.0, 48.0)
      );
      sliceHash = mix_f(sliceHashWorldA, sliceHashWorldB, auroraModeF32(0.28, 0.42));
    }

    // Keep the same march coverage, but de-correlate where each interval is
    // sampled. This breaks the straight-through shelf pattern without shrinking
    // the step length and losing the far side of the cloud box.
    let sampleWindowEnd = min(t + stepLen * 0.98, t1);
    let jitterWindow = max(sampleWindowEnd - t, TUNE.minStep);
    let jitterCenter = mix_f(0.50, 0.46, rayShallowF);
    let jitterAmp = mix_f(0.18, 0.46, rayShallowF) * sliceJitter;
    let jitterPhase = clamp(jitterCenter + (sliceHash - 0.5) * jitterAmp, 0.04, 0.96);
    var sampleT = clamp(t + jitterWindow * jitterPhase, t0, sampleWindowEnd);
    if (auroraLayerMode()) {
      let detailedNearF = (1.0 - smoothstep(0.34, 0.92, max(farF, screenFarF))) * mix_f(0.56, 1.0, nearStepF);
      if (detailedNearF > 0.001) {
        let midT = clamp(t + jitterWindow * 0.50, t0, sampleWindowEnd);
        let midP = rayRo + rayRd * midT;
        let midShellPhase = shellPhase01FromWorld(midP);
        let shellStepPhase = 1.0 / 44.0;
        let shellJitter = (sliceHash - 0.5) * 0.30;
        let stableShellPhase = clamp((floor(midShellPhase / shellStepPhase) + 0.5 + shellJitter) * shellStepPhase, 0.0, 1.0);
        let shellRadii = shellNominalRadii();
        let stableRadius = mix_f(shellRadii.x, shellRadii.y, stableShellPhase);
        let shellHit = intersectSphere_robust(rayRo, rayRd, stableRadius);
        let hasA = shellHit.x >= t && shellHit.x <= sampleWindowEnd;
        let hasB = shellHit.y >= t && shellHit.y <= sampleWindowEnd;
        if (hasA || hasB) {
          let da = abs(shellHit.x - midT);
          let db = abs(shellHit.y - midT);
          let useB = hasB && (!hasA || db < da);
          let shellSampleT = select(shellHit.x, shellHit.y, useB);
          sampleT = mix_f(sampleT, shellSampleT, detailedNearF * 0.62);
        }
      }
    }
    let p = rayRo + rayRd * sampleT;
    if (sphericalCloudMode()) {
      let camRel = rayRo - B.center;
      let sampleRel = p - B.center;
      let camLen2 = dot(camRel, camRel);
      let sampleLen2 = dot(sampleRel, sampleRel);
      if (camLen2 > EPS && sampleLen2 > EPS) {
        let hemi = dot(normalize(sampleRel), normalize(camRel));
        if (hemi < -0.020) {
          break;
        }
      }
    }
    let sampleRayDistance = max(sampleT, 0.0);
    let samplePixelWorld = max(sampleRayDistance * rayPixelWorldScale, wg_finestWorld * 0.50);

    let thickLodExtra = thickPerfF * saturate(TUNE.thickDetailSkip) * smoothstep(0.28, 0.96, sampleRayDistance);
    let weatherLOD = clamp(weatherLOD_base + TUNE.farLodPush * farF * 0.65, 0.0, wg_maxMipW);
    let nearHorizontalRayF = rayShallowF
      * (1.0 - smoothstep(effectiveNearFluffDist * 0.85, effectiveNearFluffDist * 4.25, sampleRayDistance));
    let straightThroughViewF = rayShallowF * (1.0 - smoothstep(0.74, 1.0, farF));


    let uv_weather = weatherUV_from(p, wScale);
    let weatherDensityLOD = 0.0;
    let wm_primary = wrap2D(weather2D, samp2D, uv_weather, 0i, weatherDensityLOD);

    let ph_coarse = computePH(p, wm_primary);

    var columnSkip = verticalColumnSkipDistance(p, rayRd, wm_primary, stepLen, effectiveMaxStep, thickPerfF, screenFarF);
    columnSkip = mix_f(columnSkip, 0.0, nearHorizontalRayF);
    if (columnSkip > stepLen * 1.12) {
      prevDens = 0.0;
      prevMacroDens = 0.0;
      prevTsun = Tsun_cached;
      t = min(t + columnSkip, t1);
      iter = iter + 1;
      continue;
    }

    // Exact vertical/weather miss for this sample. This is intentionally a
    // short conservative jump, not a long visibility cull, so clouds cannot
    // disappear from LOD shells while tall boxes avoid wasting full density work
    // above, below, or inside cut-out portions of the current weather column.
    if (ph_coarse < 0.0 || wm_primary.b >= 1.0) {
      let missBoost = mix_f(1.35, min(max(TUNE.emptySkipMult, 1.0), 2.75), max(thickPerfF, screenFarF));
      let missStep = clamp(stepLen * missBoost, TUNE.minStep, effectiveMaxStep * 2.0);
      prevDens = 0.0;
      prevMacroDens = 0.0;
      prevTsun = Tsun_cached;
      t = min(t + missStep, t1);
      iter = iter + 1;
      continue;
    }

    let weatherGateFast = weatherCoverageGate(wm_primary);
    if (weatherGateFast >= TUNE.weatherRejectGate && sampleRayDistance > nearFineDist * 2.0 && nearHorizontalRayF < 0.35) {
      let rejectF = smoothstep(TUNE.weatherRejectGate, 1.0, weatherGateFast);
      let rejectPerfF = max(max(rejectF, thickPerfF * 0.45), screenFarF * 0.50);
      let rejectBoost = mix_f(1.18, min(max(TUNE.emptySkipMult, 1.0), 4.35), rejectPerfF);
      var rejectStep = clamp(stepLen * rejectBoost, TUNE.minStep, effectiveMaxStep * 2.2);
      let runProbeF = max(thickPerfF, screenFarF) * smoothstep(nearFineDist * 4.0, nearFineDist * 12.0, sampleRayDistance);
      if (runProbeF > 0.36) {
        let probeStep = clamp(rejectStep * mix_f(1.55, 2.65, runProbeF), TUNE.minStep, effectiveMaxStep * 5.5);
        let probeMip = clamp(weatherLOD + 1.25 + runProbeF * 1.50, 0.0, wg_maxMipW);
        if (weatherProbeEmpty(p + rayRd * rejectStep, rayRd, probeStep, 3, probeMip, wScale)) {
          rejectStep = clamp(rejectStep + probeStep * mix_f(1.0, 2.45, runProbeF), TUNE.minStep, effectiveMaxStep * 8.0);
        }
      }
      prevDens = 0.0;
      prevMacroDens = 0.0;
      prevTsun = Tsun_cached;
      t = min(t + rejectStep, t1);
      iter = iter + 1;
      continue;
    }

    // LOD from actual camera distance and FOV. Step length is still allowed to
    // raise far LODs, but near/in-volume samples stay anchored to screen-space
    // pixel footprint so clouds do not vanish while the camera passes through.
    let stepLOD = clamp(log2(max(stepLen / wg_finestWorld, 1.0)), 0.0, wg_maxMipS);
    let pixelLOD = clamp(log2(max(samplePixelWorld / wg_finestWorld, 1.0)), 0.0, wg_maxMipS);
    let baseLOD = mix_f(pixelLOD, max(pixelLOD, stepLOD), smoothstep(0.70, 1.0, farF));

    let nearDepth = sampleRayDistance;
    let nearSmooth = pow(saturate(1.0 - nearDepth / effectiveNearFluffDist), 0.85);

    let lodBias = mix_f(0.0, TUNE.nearLodBias, nearSmooth);
    let nearDetailSoftLod = smoothstep(max(effectiveNearFluffDist * 0.72, 0.10), 0.0, sampleRayDistance) * 0.55;
    let farLodExtra = TUNE.farLodPush * farF * 0.60;
    let thickShapeLodExtra = thickLodExtra * 0.10;
    let thickDetailLodExtra = thickLodExtra * 0.28;
    let lodShapeLighting = clamp(baseLOD + lodBias + farLodExtra + thickShapeLodExtra, 0.0, wg_maxMipS);
    let lodDetailLighting = clamp(baseLOD + lodBias + farLodExtra + nearDetailSoftLod + thickDetailLodExtra, 0.0, wg_maxMipD);
    let lodShapeBase = min(lodShapeLighting, min(wg_maxMipS, 2.25));
    let lodDetailBase = min(lodDetailLighting, min(wg_maxMipD, 2.75));

    let wm = wm_primary;
    let ph = ph_coarse;
    let auroraMask = auroraCapMask(p);
    if (auroraMask <= 0.0001) {
      prevDens = 0.0;
      prevMacroDens = 0.0;
      prevTsun = Tsun_cached;
      t = min(t + clamp(stepLen * 2.5, TUNE.minStep, effectiveMaxStep * 5.0), t1);
      iter = iter + 1;
      continue;
    }
    let stepWarp = worldWarpXZ(p.xz, max(ph, 0.0), wg_boxMaxXZ);

    let visibleLodEase = smoothstep(0.08, 0.98, max(farF, screenFarF));
    let definitionHold = cloudDefinition01();
    let sparseHold = cloudSparsity01();
    let visibleLodEaseDefined = visibleLodEase * mix_f(1.0, 0.74, definitionHold);
    let lodShapeVisible = clamp(min(lodShapeLighting + screenInterleaveF * mix_f(0.90, 0.62, definitionHold), mix_f(1.10, 2.38, visibleLodEaseDefined + screenInterleaveF * 0.18)), 0.0, wg_maxMipS);
    let lodDetailVisibleBase = clamp(min(lodDetailLighting + screenInterleaveF * mix_f(1.25, 0.82, definitionHold), mix_f(1.12, 2.72, visibleLodEaseDefined + screenInterleaveF * 0.22)), 0.0, wg_maxMipD);

    let faceFade = insideFaceFade(p, bmin, bmax);
    let nearDense = mix_f(TUNE.nearDensityMult, 1.0, saturate(nearDepth / effectiveNearDensityRange));

    let verticalInteriorF = smoothstep(0.10, 0.28, ph) * (1.0 - smoothstep(0.78, 0.98, ph));
    let weatherFilledF = 1.0 - smoothstep(TUNE.weatherRejectGate * 0.54, TUNE.weatherRejectGate * 0.94, weatherGateFast);
    let noShapeFarF = smoothstep(mix_f(0.76, 0.88, definitionHold), 1.0, max(farF, screenFarF))
      * smoothstep(nearFineDist * 5.0, nearFineDist * 12.0, sampleRayDistance)
      * verticalInteriorF
      * weatherFilledF
      * max(thickPerfF, screenFarF * 0.65)
      * (1.0 - nearHorizontalRayF * 0.85)
      * (1.0 - straightThroughViewF * 0.98);

    var s: vec4<f32>;
    var densMacro: f32;
    var usedWeatherProxy: f32 = 0.0;
    if (auroraLayerMode()) {
      s = sampleAuroraRibbonShape(p, max(ph, 0.0), clamp(lodShapeVisible + 0.70, 0.0, wg_maxMipS));
      let auroraDetProxy = detailProxyFromShape(max(ph, 0.0), s);
      densMacro = auroraCurtainDensity(ph, wm, s, auroraDetProxy, p) * faceFade;
    } else if (noShapeFarF > 0.62) {
      s = syntheticShapeFromWeather(ph, wm);
      densMacro = densityWeatherProxy(ph, wm) * faceFade * nearDense * auroraMask;
      usedWeatherProxy = noShapeFarF;
    } else {
      s = sampleShapeRGBAWarp(p, max(ph, 0.0), lodShapeVisible, stepWarp);
      densMacro = densityMacroFromSamples(ph, wm, s) * faceFade * nearDense * auroraMask;
    }

    // Conservative macro-empty acceleration. Detail noise only erodes the macro
    // field, so when the macro field is genuinely absent there is no useful
    // detail/lighting work to do. Keep the threshold tiny and only use a short
    // jump so silhouettes and wisps survive.
    let macroEmptyThreshold = max(TUNE.sunDensityGate * mix_f(0.46, 0.94, thickPerfF), 0.00006);
    let macroMissF = smoothstep(macroEmptyThreshold * 2.5, macroEmptyThreshold * 0.45, max(densMacro, prevMacroDens));
    let macroMissAllowed = macroMissF * smoothstep(nearFineDist * 1.25, nearFineDist * 3.0, sampleRayDistance) * max(thickPerfF, screenFarF * 0.55) * (1.0 - nearHorizontalRayF * 0.90);
    if (macroMissAllowed > 0.72 && densMacro < macroEmptyThreshold) {
      let missBoost = mix_f(1.35, min(max(TUNE.emptySkipMult, 1.0), 4.10), macroMissAllowed);
      let missStep = clamp(stepLen * missBoost, TUNE.minStep, effectiveMaxStep * 2.80);
      prevDens = 0.0;
      prevMacroDens = max(densMacro, 0.0);
      prevTsun = Tsun_cached;
      t = min(t + missStep, t1);
      iter = iter + 1;
      continue;
    }

    let farLightingFastF = saturate(remap(max(farF, screenFarF), 0.62, 1.0, 0.0, 1.0));
    let denseLightingFastF = saturate(remap(max(densMacro, prevMacroDens), 0.15, 0.35, 0.0, 1.0));
    let macroOnly = (farLightingFastF * denseLightingFastF) > 0.72;

    let farProxyRawF = smoothstep(mix_f(0.66, 0.78, definitionHold), 1.0, max(farF, screenFarF)) * smoothstep(nearFineDist * 2.0, nearFineDist * 6.0, sampleRayDistance) * (1.0 - nearHorizontalRayF * 0.75) * (1.0 - straightThroughViewF * 0.88);
    let farProxyEdgeProtect = 1.0 - smoothstep(0.025, 0.16, densMacro);
    let farProxySafeF = max(farProxyRawF * (1.0 - farProxyEdgeProtect * 0.65), usedWeatherProxy * 0.86);
    let proxyOnlyF = farProxySafeF;

    let detailProxy = detailProxyFromShape(max(ph, 0.0), s);
    let denseInteriorF = smoothstep(0.12, 0.34, densMacro);
    let thickInteriorFilterF = thickPerfF * smoothstep(0.14, 0.52, densMacro) * smoothstep(0.14, 0.94, sampleRayDistance);
    let lodDetailVisible = clamp(lodDetailVisibleBase + thickInteriorFilterF * mix_f(0.90, 0.54, definitionHold) + farProxySafeF * mix_f(1.05, 0.58, definitionHold), 0.0, wg_maxMipD);
    var detailRaw = detailProxy;
    if (!auroraLayerMode() && !macroOnly && farProxySafeF < 0.62 && usedWeatherProxy < 0.52 && screenInterleaveF < 0.5) {
      detailRaw = sampleDetailRGBWarp(p, max(ph, 0.0), lodDetailVisible, stepWarp);
    }
    let thickDetailProxyF = thickPerfF * saturate(TUNE.thickDetailSkip) * smoothstep(0.18, 0.96, sampleRayDistance) * denseInteriorF;
    let detailProxyMixF = max(max(min(thickDetailProxyF, 0.16) * (1.0 - straightThroughViewF * 0.78), farProxySafeF * mix_f(0.42, 0.24, definitionHold)), screenInterleaveF * mix_f(0.72, 0.50, definitionHold));
    var det = mix_v3(detailRaw, detailProxy, min(detailProxyMixF, mix_f(0.72, 0.54, definitionHold)));

    let detailMean = (det.r + det.g + det.b) * 0.3333333333;
    let thickDetailFilterF = thickPerfF * smoothstep(0.12, 0.82, sampleRayDistance) * smoothstep(0.05, 0.32, densMacro) * mix_f(0.18, 0.08, definitionHold);
    det = mix_v3(det, vec3<f32>(detailMean), max(thickDetailFilterF * (1.0 - straightThroughViewF * 0.72), farProxySafeF * mix_f(0.18, 0.08, definitionHold)));

    var dens: f32 = densMacro;
    if (auroraLayerMode()) {
      dens = densMacro;
    } else if (!macroOnly) {
      dens = densityFromSamples(ph, wm, s, det) * faceFade * nearDense * auroraMask;
    } else {
      let macroBodyF = smoothstep(0.10, 0.34, densMacro) * smoothstep(0.16, 0.84, ph);
      dens = densMacro * mix_f(0.88, 1.02, macroBodyF);
    }

    let thickBodySmoothF = thickPerfF * smoothstep(0.10, 0.42, densMacro) * smoothstep(0.10, 0.90, sampleRayDistance) * mix_f(0.16, 0.08, max(definitionHold, sparseHold * 0.65));
    dens = mix_f(dens, densMacro, thickBodySmoothF);

    let farSilhouetteKeep = smoothstep(0.36, 1.0, screenFarF) * saturate(remap(densMacro, 0.025, 0.20, 0.0, 1.0));
    dens = max(dens, densMacro * farSilhouetteKeep * 0.22);

    let bodySmooth = smoothstep(0.08, 0.42, max(densMacro, prevMacroDens));
    let raySmoothDensAdaptive = saturate(mix_f(TUNE.raySmoothDens * 0.18, TUNE.raySmoothDens, bodySmooth) * mix_f(1.0, 0.58, definitionHold));
    let densSmoothed = mix_f(dens, prevDens, raySmoothDensAdaptive);
    let densMacroSmoothed = mix_f(densMacro, prevMacroDens, saturate(raySmoothDensAdaptive * 0.90));
    let denseInteriorStepF = thickPerfF * smoothstep(0.22, 0.62, densMacroSmoothed) * smoothstep(0.20, 0.90, sampleRayDistance);
    let farProxyStepF = farProxySafeF * smoothstep(0.07, 0.28, densMacroSmoothed);
    let weatherProxyStepF = usedWeatherProxy * smoothstep(0.06, 0.26, densMacroSmoothed);
    var planetCardF = 0.0;
    if (auroraLayerMode()) {
      let relShellStep = p - B.center;
      let shellNStep = normalizeOr(relShellStep, vec3<f32>(0.0, 1.0, 0.0));
      let shellTangentF = 1.0 - smoothstep(0.055, 0.32, abs(dot(rayRd, shellNStep)));
      let shellInteriorF = smoothstep(0.045, 0.24, ph) * (1.0 - smoothstep(0.76, 0.98, ph));
      planetCardF = shellTangentF * shellInteriorF * 0.26;
    }
    let viewFrontOccF = frontOcclusionFactor(Tr, sampleRayDistance, effectiveNearFluffDist, densMacroSmoothed);
    let shellFrontOccF = planetCardF * smoothstep(0.040, 0.20, densMacroSmoothed) * frontOcclusionStrength() * 0.58;
    var frontOccF = viewFrontOccF;
    if (sphericalCloudMode()) {
      frontOccF = max(viewFrontOccF * 0.18, shellFrontOccF);
    }
    var cloudApproachProtect = 0.0;
    if (sphericalCloudMode() && !auroraLayerMode()) {
      cloudApproachProtect =
        (1.0 - smoothstep(effectiveNearFluffDist * 1.10, effectiveNearFluffDist * 3.40, sampleRayDistance)) *
        (1.0 - smoothstep(0.22, 0.74, max(farF, screenFarF)));
    }
    let adaptiveStepF = max(max(max(denseInteriorStepF, farProxyStepF * 0.72), weatherProxyStepF * 0.86), frontOccF) *
      (1.0 - straightThroughViewF * 0.46) *
      (1.0 - cloudApproachProtect * 0.88);
    let occlusionStepBoost = max(1.0, TUNE.frontOcclusionStepBoost);
    let stepBoostMax = max(max(1.0, TUNE.thickStepBoost * 0.88), occlusionStepBoost);
    let stepBoost = mix_f(1.0, stepBoostMax, adaptiveStepF);
    let occStepLimit = max(effectiveMaxStep, effectiveMaxStep * mix_f(1.0, occlusionStepBoost, frontOccF));
    var auroraStepLimit = occStepLimit;
    if (auroraLayerMode()) {
      auroraStepLimit = max(occStepLimit, stepLen);
    }
    let sampleStepLen = clamp(stepLen * stepBoost, TUNE.minStep, auroraStepLimit);

    if (densSmoothed > 0.00008) {
      if (auroraLayerMode()) {
        let sampleOD = min(densSmoothed * sampleStepLen * VIEW_EXTINCTION_SCALE * 0.30, 0.075);
        let absorb = exp(-sampleOD);
        let alpha = 1.0 - absorb;
        let auroraColor = auroraEmissionColor(p, ph, viewDir, sunDir, auroraMask);
        rgb += Tr * auroraColor * alpha * 1.35;
        Tr *= mix_f(1.0, absorb, 0.34);

        runMeanL += luminance(auroraColor * alpha);
        runN += 1.0;

        if (Tr <= transmittanceCutoff()) {
          Tr = 0.0;
          break;
        }
        prevDens = densSmoothed;
        prevMacroDens = densMacroSmoothed;
        prevTsun = 1.0;
        t = min(t + sampleStepLen, t1);
        iter = iter + 1;
        continue;
      }

      let localNoiseScreen = hash11Fast(
        f32(fullPix.x) * 0.093427 +
        f32(fullPix.y) * 0.047971 +
        f32(iter) * 0.217873 +
        rand0 * 23.731
      );
      var localNoise = localNoiseScreen;
      if (sphericalCloudMode()) {
        let localUvForNoise = shellUVFromWorld(p);
        localNoise = smoothCellHash2D(
          localUvForNoise + vec2<f32>(f32(iter) * 0.0173 + rand0 * 0.047, f32(iter) * 0.0119),
          auroraModeF32(256.0, 160.0)
        );
      }
      let bnLocal = mix_f(rand0, localNoise, 0.12);
      let shadowInteriorProbe = saturate(remap(densMacroSmoothed, 0.05, 0.32, 0.0, 1.0));
      let proxyPerfF = max(proxyOnlyF, saturate(remap(max(farF, screenFarF), 0.45, 0.95, 0.0, 1.0)));
      let closeRayProtect = 1.0 - smoothstep(effectiveNearFluffDist * 1.00, effectiveNearFluffDist * 2.40, sampleRayDistance);
      let silhouetteProtect = 1.0 - smoothstep(0.12, 0.34, densMacroSmoothed);
      let lightingEdgeProtect = saturate(max(closeRayProtect * 0.90, silhouetteProtect * (1.0 - shadowInteriorProbe * 0.55)));
      let thickLightF = thickPerfF * saturate(TUNE.thickLightSkip) * smoothstep(0.10, 0.72, sampleRayDistance);
      let thickLightPerfF = thickLightF * (1.0 - lightingEdgeProtect);
      let adaptiveStrideAdd = i32(floor(farF * 4.5 + screenFarF * 1.25 + shadowInteriorProbe * farF * 2.75 + proxyPerfF * 2.35 + thickLightPerfF * mix_f(1.2, 5.2, shadowInteriorProbe) + screenInterleaveF * f32(max(temporalRate, 1u))));
      let sunStrideSafe = max(TUNE.sunStride + adaptiveStrideAdd, 1);
      if ((iter % sunStrideSafe) == 0) {
        if (densMacroSmoothed * sampleStepLen > TUNE.sunDensityGate) {
          let lowTransCut = select(0i, 1i, Tr < max(transmittanceCutoff() * 1.1, 0.01));
          let cheapSun = (proxyPerfF > 0.68) && (shadowInteriorProbe < 0.16) && (sampleRayDistance > effectiveNearFluffDist * 1.40) && (lightingEdgeProtect < 0.14);
          let localConeSun = (thickLightPerfF > 0.42 && shadowInteriorProbe > 0.24 && sampleRayDistance > effectiveNearFluffDist * 1.65 && (farF > 0.22 || Tr < 0.62) && lightingEdgeProtect < 0.18);
          if (cheapSun || localConeSun) {
            let coneOcc = densMacroSmoothed
              * mix_f(0.90, 1.70, max(proxyPerfF, thickLightPerfF))
              * mix_f(0.85, 1.55, shadowInteriorProbe);
            Tsun_cached = exp(-coneOcc);
          } else {
            let sunStepsAdaptive = max(2, TUNE.sunSteps - i32(floor(farF * 3.0)) - i32(floor(shadowInteriorProbe * farF * 2.0)) - i32(floor(proxyPerfF * 2.0)) - i32(floor(thickLightPerfF * 2.0)) - lowTransCut);
            let sunStepAdaptive = sunStepLen * mix_f(1.0, 1.55 + thickLightPerfF * 0.55, max(farF, proxyPerfF));
            Tsun_cached = sunTransmittance(
              p, sunDir, weatherDensityLOD, lodShapeLighting, sunStepAdaptive,
              wScale, sunStepsAdaptive,
              fract(bnLocal + rand0 * 0.61803398875 + f32(iter) * 0.131)
            );
          }
        } else {
          Tsun_cached = 1.0;
        }

        let thickDenseFastLighting = thickLightPerfF > 0.30 && shadowInteriorProbe > 0.12 && lightingEdgeProtect < 0.20;
        let fastLighting = (sunStrideSafe > TUNE.sunStride && lightingEdgeProtect < 0.22) || macroOnly || (farF > 0.34) || (proxyPerfF > 0.42) || thickDenseFastLighting;
        let ultraFastLighting = fastLighting && (thickDenseFastLighting || ((thickLightPerfF > 0.38 && shadowInteriorProbe > 0.18) && lightingEdgeProtect < 0.14) || proxyPerfF > 0.70 || Tr < 0.48);
        if (!fastLighting && sunStrideSafe <= 1) {
          shapeN_cached = approxShapeNormal(p, max(ph, 0.0), max(0.0, lodShapeLighting));
        } else if (ultraFastLighting) {
          shapeN_cached = approxShapeNormalFromChannels(s, p, max(ph, 0.0), sunDir, viewDir);
        } else {
          shapeN_cached = approxShapeNormalFast(p, max(ph, 0.0), max(0.0, lodShapeLighting + 0.45));
        }

        if (!fastLighting && sunStrideSafe <= 1) {
          let densityN = approxLightingNormal(
            p,
            weatherDensityLOD,
            max(0.0, lodShapeLighting + 0.70),
            max(0.0, lodDetailLighting + 1.35),
            wScale
          );
          lightN_cached = normalize(mix_v3(shapeN_cached, densityN, mix_f(0.62, 0.22, shadowInteriorProbe)));
          sunExposure_cached = directionalExposure(
            p,
            weatherDensityLOD,
            max(0.0, lodShapeLighting + 0.55),
            max(0.0, lodDetailLighting + 1.05),
            sunDir,
            wScale
          );
        } else {
          let stableLightFallback = normalize(shapeN_cached + sunDir * 0.35 + viewDir * 0.10);
          lightN_cached = normalize(mix_v3(shapeN_cached, stableLightFallback, 0.24 * shadowInteriorProbe + 0.10 * proxyPerfF));
          sunExposure_cached = saturate(dot(lightN_cached, sunDir) * 0.72 + 0.28);
        }

        rim_cached = pow(1.0 - saturate(dot(lightN_cached, viewDir)), 1.7);

        let sunFacing = saturate(dot(lightN_cached, sunDir));
        sunSide_cached = sunFacing;
        sunRim_cached = pow(1.0 - sunFacing, 1.30);

        let upperRelative = saturate(dot(lightN_cached, normalize(sunDir * 0.75 + viewDir * 0.25)) * 0.5 + 0.5);
        upperExposure_cached = smoothstep(0.36, 0.82, upperRelative);
      }

      let raySmoothSunAdaptive = saturate(mix_f(TUNE.raySmoothSun * 0.22, TUNE.raySmoothSun, bodySmooth) * mix_f(1.0, 0.45, lightingEdgeProtect));
      let TsunSmoothed = mix_f(Tsun_cached, prevTsun, raySmoothSunAdaptive);
      let shadowInterior = saturate(remap(densMacroSmoothed, 0.05, 0.32, 0.0, 1.0)) * (1.0 - saturate(TsunSmoothed * 1.35));
      let bnScaled = mix_f(bnLocal, bnLocal * TUNE.bnFarScale, farF) * mix_f(1.0, 0.18, shadowInterior);

      let rayProgress = saturate((sampleT - t0) / max(raySegmentLength, EPS));
      let frontCardWindow = 1.0 - smoothstep(0.34, 0.70, rayProgress);
      let frontCardDensity = smoothstep(0.012, 0.115, densMacroSmoothed) * (1.0 - smoothstep(0.58, 0.98, densMacroSmoothed));
      let frontCardEdge = smoothstep(0.0008, 0.045, densSmoothed);
      let viewFrontCardOcclusion = rayShallowF * frontCardWindow * frontCardDensity * frontCardEdge;
      let shellFrontCardOcclusion = planetCardF * frontCardDensity * frontCardEdge * 0.46;
      var frontCardOcclusion = viewFrontCardOcclusion;
      if (sphericalCloudMode()) {
        frontCardOcclusion = shellFrontCardOcclusion;
      }
      let cardOcclusionStrength = 1.0 + frontCardOcclusion * mix_f(1.15, 2.65, saturate(TUNE.frontOcclusionStrength));
      let cardMacroFill = max(densSmoothed, densMacroSmoothed * mix_f(0.72, 1.28, frontCardOcclusion));
      let densForOpacity = mix_f(densSmoothed, cardMacroFill, frontCardOcclusion * 0.74);

      let rawSampleODFine = densForOpacity * sampleStepLen * VIEW_EXTINCTION_SCALE * cardOcclusionStrength;
      let rawSampleODMacro = densMacroSmoothed * sampleStepLen * VIEW_EXTINCTION_SCALE * mix_f(1.0, cardOcclusionStrength, frontCardOcclusion * 0.42);
      let sampleOD = min(mix_f(rawSampleODFine, rawSampleODMacro, 0.58 * shadowInterior), max(C.attenuationClamp, 0.001));
      let absorb = BeerLaw(sampleOD, C.cloudBeer);
      let alpha = 1.0 - absorb;

      let lightDensity = mix_f(densSmoothed, densMacroSmoothed, 0.82 * shadowInterior);
      let rimEffective = rim_cached * mix_f(1.0, 0.20, shadowInterior);
      let exposureEffective = sunExposure_cached * mix_f(1.0, 0.28, shadowInterior);
      let sideEffective = mix_f(sunSide_cached, 0.62, 0.35 * shadowInterior);

      var lightCol = CalculateLight(
        lightDensity,
        alpha,
        TsunSmoothed,
        cosVS,
        ph,
        bnScaled,
        t - t0,
        rimEffective,
        sideEffective,
        sunRim_cached,
        Tr,
        exposureEffective,
        upperExposure_cached
      );

      if (sphericalCloudMode()) {
        let relShell = p - B.center;
        let shellN = normalizeOr(relShell, vec3<f32>(0.0, 1.0, 0.0));
        let sunDotShell = dot(shellN, sunDir);
        let spaceDay = smoothstep(-0.18, 0.42, sunDotShell);
        let spaceTerminator = smoothstep(-0.30, 0.12, sunDotShell) * (1.0 - smoothstep(0.48, 0.92, sunDotShell));
        let nightTint = C.shadowLightColor * 0.18;
        let dayTint = C.frontLightColor * mix_f(0.82, 1.08, spaceDay);
        lightCol *= mix_v3(nightTint, dayTint, spaceDay) * mix_f(0.18, 1.18, spaceDay);

        let limbRim = pow(1.0 - saturate(dot(shellN, viewDir)), 2.75) * smoothstep(-0.12, 0.38, sunDotShell);
        lightCol += C.sunColor * alpha * (limbRim * 0.12 + spaceTerminator * 0.035);

        if (auroraLayerMode()) {
          let nightBoost = 1.0 - smoothstep(-0.18, 0.42, sunDotShell);
          let auroraPalette = max(mix_v3(C.frontLightColor, C.shadowLightColor, 0.30), vec3<f32>(0.0));
          let capPresence = mix_f(0.90, 1.32, auroraMask);
          let evenEmission = auroraPalette * alpha * capPresence * mix_f(1.05, 2.00, nightBoost);
          let darkSideBoost = auroraPalette * alpha * mix_f(0.16, 0.55, nightBoost);
          let limbGlow = auroraPalette * alpha * pow(1.0 - saturate(dot(shellN, viewDir)), 1.90) * 0.18;
          lightCol = evenEmission + darkSideBoost + limbGlow;
        }
      }

      let frontCardBrightnessHold = 1.0 + frontCardOcclusion * 0.18 * (1.0 - shadowInterior * 0.55);
      lightCol *= frontCardBrightnessHold;

      let shadowLift = vec3<f32>(0.045, 0.050, 0.058) * shadowInterior;
      lightCol = lightCol + shadowLift * alpha;

      let lNow = luminance(lightCol);
      let meanL = select(lNow, runMeanL / max(runN, 1.0), runN > 0.0);
      let allow = max(meanL * (1.0 + TUNE.fflyRelClamp), TUNE.fflyAbsFloor);
      if (!auroraLayerMode() && lNow > allow) { lightCol *= allow / max(lNow, 1e-6); }

      if (auroraLayerMode()) {
        let relShell2 = p - B.center;
        let shellN2 = normalizeOr(relShell2, vec3<f32>(0.0, 1.0, 0.0));
        let nightBoost2 = 1.0 - smoothstep(-0.18, 0.42, dot(shellN2, sunDir));
        let auroraPalette2 = max(mix_v3(C.frontLightColor * 1.06, C.shadowLightColor, 0.22), vec3<f32>(0.0));
        let emissiveFloor = auroraPalette2 * alpha * mix_f(0.85, 2.10, nightBoost2) * mix_f(0.80, 1.25, auroraMask);
        lightCol = max(lightCol, emissiveFloor);
      }

      rgb += Tr * lightCol * alpha;
      Tr *= absorb;

      runMeanL += lNow;
      runN += 1.0;

      // Once the selected opacity cutoff is reached, force the result opaque
      // and stop marching. This preserves the early-exit win without leaving
      // dense clouds slightly see-through. Front-occlusion early exits use the
      // same closure so the accelerated path also remains opaque.
      if (Tr <= transmittanceCutoff()) {
        Tr = 0.0;
        break;
      }
      if (Tr <= frontOcclusionCutoff(frontOccF)) {
        Tr = 0.0;
        break;
      }
    }

    prevDens = densSmoothed;
    prevMacroDens = densMacroSmoothed;
    prevTsun = Tsun_cached;

    t = min(t + sampleStepLen, t1);
    iter = iter + 1;
  }

  // compose
  let aMarch = saturate(1.0 - Tr);
  let alphaCutoff = clamp(TUNE.alphaCutoff, 0.0, 0.999);
  let opaqueSoftLo = max(0.0, alphaCutoff - 0.10);
  let opaqueSoftHi = alphaCutoff;
  let opaqueClosure = smoothstep(opaqueSoftLo, opaqueSoftHi, aMarch);
  let aRaw = mix_f(aMarch, min(1.0, aMarch + (1.0 - aMarch) * 0.82), opaqueClosure);
  let surfaceOpacity = clamp(TUNE.outputAlphaFeather, 0.0, 1.0);
  let surfaceGate =
    smoothstep(0.055, 0.34, aRaw) *
    (1.0 - smoothstep(0.76, 0.97, aRaw));
  let surfaceCurve = mix_f(1.0, 0.50, surfaceOpacity);
  let surfaceAlpha = saturate(pow(max(aRaw, 1e-5), surfaceCurve) * mix_f(1.0, 1.08, surfaceOpacity));
  let aLifted = mix_f(aRaw, max(aRaw, surfaceAlpha), surfaceGate * surfaceOpacity);

  let alphaBoostThreshold = clamp(TUNE.alphaBoostThreshold, 0.0, 0.995);
  let alphaBoostAmount = max(TUNE.alphaBoostAmount, 0.0);
  let alphaBoostRamp = select(
    0.0,
    saturate((aLifted - alphaBoostThreshold) / max(1.0 - alphaBoostThreshold, 1e-5)),
    aLifted > alphaBoostThreshold
  );
  let aBoosted = min(1.0, aLifted + alphaBoostAmount * alphaBoostRamp);
  let minOutputAlphaRaw = clamp(TUNE.minOutputAlpha, 0.0, 0.45);
  var minOutputAlpha = minOutputAlphaRaw;
  if (auroraLayerMode()) {
    minOutputAlpha = min(minOutputAlphaRaw, 0.006);
  }
  let alphaGateWidth = max(minOutputAlpha * 2.25, auroraModeF32(0.030, 0.055));
  let outputAlphaGate = select(
    1.0,
    smoothstep(minOutputAlpha, min(minOutputAlpha + alphaGateWidth, 1.0), aBoosted),
    minOutputAlpha > 0.0001
  );
  let outputAlpha = aBoosted * outputAlphaGate;
  let premulLift = mix_f(
    1.0,
    clamp(aBoosted / max(aRaw, 0.08), 1.0, 1.36),
    surfaceOpacity * surfaceGate * 0.42
  );
  let outputRGB = rgb * outputAlphaGate * premulLift;

  var newCol: vec4<f32>;
  if (CLOUD_WRITE_RGB != 0u) {
    newCol = vec4<f32>(outputRGB, outputAlpha);
  } else {
    let a = outputAlpha;
    if (opt.outputChannel == 0u) { newCol = vec4<f32>(a, 0.0, 0.0, 1.0); }
    else if (opt.outputChannel == 1u) { newCol = vec4<f32>(0.0, a, 0.0, 1.0); }
    else if (opt.outputChannel == 2u) { newCol = vec4<f32>(0.0, 0.0, a, 1.0); }
    else { newCol = vec4<f32>(0.0, 0.0, 0.0, a); }
  }

  // Preserve compute output as premultiplied volumetric radiance.
  // The preview pass composites this over the procedural sky.
  // Alpha boost is applied only at the end so it does not feed back into
  // march-time shadowing, transmission, or lighting.
  newCol = vec4<f32>(max(newCol.rgb, vec3<f32>(0.0)), clamp(newCol.a, 0.0, 1.0));

  // TAA with variance clamp
  let temporalActive = reproj.temporalBlend > 0.0001;
  if (temporalActive) {
    let fullRes = vec2<f32>(f32(reproj.fullWidth), f32(reproj.fullHeight));
    let uv_full = (vec2<f32>(fullPixFromCurrent(pixI)) + 0.5) / fullRes;

    var motion = vec2<f32>(0.0, 0.0);
    var prevUV = uv_full;
    if (reproj.enabled == 1u) {
      motion = textureSampleLevel(motionTex, sampMotion, uv_full, 0.0).rg;
      if (reproj.motionIsNormalized == 0u) { motion = motion / fullRes; }
      prevUV = uv_full - motion;
    }

    if (prevUV.x < 0.0 || prevUV.y < 0.0 || prevUV.x > 1.0 || prevUV.y > 1.0) {
      textureStore(outTex, pixI, frame.layerIndex, newCol);
      store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);
    } else {
      let prevCol = textureSampleLevel(historyPrev, sampHistory, prevUV, frame.layerIndex, 0.0);
      if (reproj.frameIndex == 0u || prevCol.a < 1e-5) {
        textureStore(outTex, pixI, frame.layerIndex, newCol);
        store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);
      } else {
        let motionPix = motion * fullRes;
        let motionMag = length(motionPix);
        let alphaDiff = abs(prevCol.a - newCol.a);
        let rgbDiff = length(prevCol.rgb - newCol.rgb);

        var stability = exp(-motionMag * 0.9) * exp(-alphaDiff * 6.0) * exp(-rgbDiff * 3.5);
        let bodyStable = smoothstep(0.38, 0.95, min(prevCol.a, newCol.a)) * exp(-motionMag * 0.35) * exp(-alphaDiff * 3.5);
        let speckleStable = bodyStable * exp(-motionMag * 1.8) * (1.0 - smoothstep(0.02, 0.16, rgbDiff));
        let convFrames = min(f32(reproj.frameIndex), 4.0);
        let convWarm = saturate((convFrames - 1.0) / 3.0);
        let staticConv = exp(-motionMag * 2.7) * exp(-alphaDiff * 9.0) * exp(-rgbDiff * 6.5);
        let stableBody = smoothstep(0.50, 0.98, bodyStable);
        let stableSpeckle = smoothstep(0.35, 0.96, speckleStable);
        var tb = clamp(reproj.temporalBlend * stability, 0.0, 0.985);
        tb *= mix_f(1.0, min(TUNE.farTaaHistoryBoost, 1.18), rayFarHistoryF);
        tb = clamp(tb * mix_f(1.0, 1.34, bodyStable), 0.0, 0.993);
        tb = max(tb, 0.76 * speckleStable);
        let fastConvLo = mix_f(0.62, 0.76, stableBody);
        let fastConvHi = mix_f(0.84, 0.94, max(stableBody, stableSpeckle));
        let fastConvFloor = mix_f(fastConvLo, fastConvHi, convWarm) * staticConv;
        tb = max(tb, fastConvFloor * mix_f(1.0, 1.08, rayFarHistoryF));
        tb = max(tb, 0.62 * stableBody * convWarm);
        tb = max(tb, 0.74 * stableSpeckle * convWarm);
        tb = clamp(tb, 0.0, 0.94);

        if (reproj.enabled == 1u && reproj.depthTest == 1u) {
          let prevDepth = textureSampleLevel(depthPrev, sampDepth, prevUV, 0.0).r;
          tb *= select(1.0 - saturate(reproj.depthTolerance), 0.25, prevDepth < 1e-6 || prevDepth > 1.0);
        }

        let relBase = mix_f(TUNE.taaRelMax, TUNE.taaRelMin, saturate(stability));
        let relBody = mix_f(relBase, max(TUNE.taaRelMin * 0.95, 0.070), stableBody);
        let rel = relBody * mix_f(1.0, 0.92, rayFarHistoryF);

        let newLum = luminance(newCol.rgb);
        let prevLum = luminance(prevCol.rgb);
        let currentIsBrighter = smoothstep(0.010, 0.160, newLum - prevLum) * smoothstep(0.08, 0.80, newCol.a);
        let currentIsDarker = smoothstep(0.020, 0.180, prevLum - newLum) * smoothstep(0.08, 0.80, newCol.a);

        let histMinLum = newLum * mix_f(0.52, 0.86, stableBody) * currentIsBrighter;
        let histLift = max(prevLum, histMinLum) / max(prevLum, 1e-5);
        let liftedPrevRGB = prevCol.rgb * mix_f(1.0, histLift, currentIsBrighter);
        let prevClampedRGB = clamp_luma_to(liftedPrevRGB, newCol.rgb, rel, max(TUNE.taaAbsEps, 0.035));

        var tbSafe = tb;
        tbSafe *= mix_f(1.0, 0.42, currentIsBrighter);
        tbSafe *= mix_f(1.0, 0.72, currentIsDarker);
        tbSafe = min(tbSafe, mix_f(0.78, 0.46, currentIsBrighter));
        tbSafe = min(tbSafe, mix_f(0.88, 0.58, currentIsDarker));
        let interleaveStable = screenInterleaveF
          * exp(-alphaDiff * 10.0)
          * exp(-rgbDiff * 6.0)
          * smoothstep(0.18, 0.86, min(prevCol.a, newCol.a));
        let interleaveFloor = screenInterleaveF * mix_f(0.30, 0.72, max(stableBody, interleaveStable));
        var auroraHistoryFloor = 0.0;
        if (auroraLayerMode()) {
          auroraHistoryFloor = 0.18 * stableBody * convWarm;
        }
        tbSafe = max(tbSafe, max(interleaveFloor, auroraHistoryFloor));
        let historyMaxLo = auroraModeF32(0.90, 0.42);
        let historyMaxHi = auroraModeF32(0.985, 0.64);
        tbSafe = min(tbSafe, mix_f(historyMaxLo, historyMaxHi, max(stableBody, interleaveStable)));

        let historyAlphaWindow = auroraModeF32(0.12, 0.08);
        let historyA = clamp(prevCol.a, newCol.a - historyAlphaWindow, newCol.a + historyAlphaWindow);
        let historyCol = vec4<f32>(prevClampedRGB, historyA);
        let blended = mix_v4(newCol, historyCol, tbSafe);
        textureStore(outTex, pixI, frame.layerIndex, blended);
        store_history_full_res_if_owner(pixI, frame.layerIndex, blended);
      }
    }
  } else {
    textureStore(outTex, pixI, frame.layerIndex, newCol);
    if (temporalHistoryActive) {
      store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);
    }
  }
}
