const PI: f32 = 3.141592653589793;
const EPS: f32 = 1e-6;
const LN2: f32 = 0.6931471805599453;
const INV_LN2: f32 = 1.4426950408889634;
const VIEW_EXTINCTION_SCALE: f32 = 0.075;
const SUN_EXTINCTION_SCALE: f32 = 0.014;
const DENSITY_LIGHT_SCALE: f32 = 0.01;

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
  thickLightSkip: f32
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
  _pad0: f32
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
  fullHeight: u32
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
fn wrap2D(tex: texture_2d_array<f32>, samp: sampler, uv: vec2<f32>, layer_idx: i32, lod: f32) -> vec4<f32> {
  let v = textureSampleLevel(tex, samp, uv * wg_weatherUvMul + wg_weatherUvAdd, layer_idx, lod);
  let b = NTransform.weatherBias;
  return vec4<f32>(
    clamp(v.r + b, 0.0, 1.0),
    clamp(v.g + b, 0.0, 1.0),
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
  return saturate(C.cloudAnvilAmount) * max(TUNE.anvilLift, 0.0);
}

fn anvilLiftWorld() -> f32 {
  // Keep a modest amount of vertical headroom so stronger anvils do not clip,
  // but avoid turning the control into a simple Y stretch.
  let boxH = max(B.half.y * 2.0, EPS);
  return boxH * anvilStrength() * 0.18;
}

fn boxMin() -> vec3<f32> { return B.center - B.half; }
fn boxMax() -> vec3<f32> { return B.center + B.half + vec3<f32>(0.0, anvilLiftWorld(), 0.0); }

fn anvilShapePos(pos: vec3<f32>, ph: f32) -> vec3<f32> {
  let anvil = anvilStrength();
  if (anvil <= 0.0) {
    return pos;
  }

  let spreadMask = saturate(remap(ph, 0.55, 0.92, 0.0, 1.0));
  let flattenMask = saturate(remap(ph, 0.72, 0.99, 0.0, 1.0));

  var local = pos - B.center;
  let spread = 1.0 + anvil * spreadMask * 2.2;
  local = vec3<f32>(local.x / spread, local.y, local.z / spread);

  // Flatten and shelf the upper plume so the top spreads outward instead of
  // only stretching upward.
  let flatten = anvil * flattenMask * 0.55;
  local.y = mix_f(local.y, local.y * (1.0 + flatten), flattenMask);
  local.y = local.y - anvil * flattenMask * max(B.half.y, 1.0) * 0.12;

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

  return vec2<f32>(ox, oz) * warpAmp + rot * mix_f(0.3, 1.2, ph) + user;
}

fn tallBoxBlend() -> f32 {
  return saturate(remap(B.half.y, 0.34, 1.60, 0.0, 1.0));
}

fn thickBoxPerfStrength() -> f32 {
  let tall = saturate(remap(B.half.y, 0.36, 2.40, 0.0, 1.0));
  return tall * clamp(TUNE.thickBoxPerf, 0.0, 2.0);
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
  let signed = (n0 - 0.5) * 0.52 + (n1 - 0.5) * 0.33 + (ridge - 0.5) * 0.15;
  let edgeDamp = smoothstep(0.02, 0.18, ph) * (1.0 - smoothstep(0.88, 1.0, ph));
  let amp = max(B.half.y * 0.32, 0.12) * tall * edgeDamp;
  return signed * amp;
}

fn phLayerBreakup(ph: f32, wm: vec4<f32>, s: vec4<f32>, det: vec3<f32>) -> f32 {
  if (ph < 0.0 || wm.b >= 1.0) {
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
  if (ph < 0.0 || wm.b >= 1.0) {
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
  let ap = anvilShapePos(pos, ph);
  let tall = tallBoxBlend();
  let yBreak = worldWarpY(pos.xz, ph, wg_boxMaxXZ);
  let yPhase = ph * mix_f(7.0, 3.10, tall);
  let pW = vec3<f32>(
    ap.x + w.x + NTransform.shapeOffsetWorld.x,
    ap.y + yBreak + yPhase + NTransform.shapeOffsetWorld.y,
    ap.z + w.y + NTransform.shapeOffsetWorld.z
  );

  let axis = axisOrOne3(NTransform.shapeAxisScale);
  let sMul = select(NTransform.shapeScale, 1.0, NTransform.shapeScale == 0.0);
  return (pW * axis) * (scaleS * max(sMul, EPS));
}

fn detailUVW_fromWarp(pos: vec3<f32>, ph: f32, w: vec2<f32>) -> vec3<f32> {
  let scaleD = max(wg_scaleD, EPS);
  let ap = anvilShapePos(pos, ph);
  let tall = tallBoxBlend();
  let yBreak = worldWarpY(pos.xz, ph, wg_boxMaxXZ) * mix_f(0.65, 1.45, tall);
  let pW = vec3<f32>(
    ap.x + w.x + NTransform.detailOffsetWorld.x,
    ap.y + yBreak + NTransform.detailOffsetWorld.y,
    ap.z + w.y + NTransform.detailOffsetWorld.z
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

// ---------------------- weather mapping
fn weatherUV_from(pos_world: vec3<f32>, squareOrigin_xz: vec2<f32>, invSide: f32, wScale: f32) -> vec2<f32> {
  let wAxis = axisOrOne3(NTransform.weatherAxisScale);
  let p = pos_world + NTransform.weatherOffsetWorld;
  let rel = (p.xz - B.center.xz) * vec2<f32>(wAxis.x, wAxis.z);

  // Keep the current weather-map scale when the cloud box is stretched outward.
  // The map repeats through the existing wrap sampler instead of being rebaked larger.
  let tileInvWorld = 0.5 * max(B.uvScale, EPS);
  return rel * tileInvWorld * wScale;
}

// ---------------------- height shape and density
fn heightShape(ph: f32, wBlue: f32) -> f32 {
  let sr_bottom = saturate(remap(ph, 0.0, 0.07, 0.0, 1.0));
  let stop_h = saturate(wBlue + 0.12);
  let sr_top = saturate(remap(ph, stop_h * 0.2, stop_h, 1.0, 0.0));
  var base = sr_bottom * sr_top;
  let anvilFactor = saturate(C.cloudAnvilAmount) * saturate(C.globalCoverage);
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
  let topY = boxTop + jTop + anvilLiftWorld();

  return vec2<f32>(baseY, topY);
}

fn weatherCutY(wm: vec4<f32>) -> f32 {
  let boxH = max(B.half.y * 2.0, EPS);
  let boxBottom = (B.center.y - B.half.y);
  let b = clamp(wm.b, 0.0, 1.0);
  return boxBottom + b * boxH;
}

fn activeColumnYRange(wm: vec4<f32>) -> vec2<f32> {
  let bt = weatherBaseTopY(wm);
  let cutY = weatherCutY(wm);
  return vec2<f32>(max(bt.x, cutY), bt.y);
}

fn activeColumnGuard() -> f32 {
  let boxH = max(B.half.y * 2.0, EPS);
  let jitterRoom = abs(TUNE.baseJitterFrac) + abs(TUNE.topJitterFrac) * 0.75;
  return clamp(boxH * (0.055 + jitterRoom) + wg_finestWorld * 2.0, 0.02, boxH * 0.48);
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
  if (wm.b >= 1.0) {
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
  if (wm.b >= 1.0) { return -1.0; }

  let bt = weatherBaseTopY(wm);
  let baseY = bt.x;
  let topY = bt.y;
  if (topY - baseY <= EPS) { return -1.0; }

  // null outside the jittered slab
  if (p_world.y < baseY || p_world.y > topY) { return -1.0; }

  // hard cutout: forbid everything below wm.b cut height, without renormalizing ph
  let cutY = weatherCutY(wm);
  if (p_world.y < cutY) { return -1.0; }

  let wAxisY = max(abs(axisOrOne3(NTransform.weatherAxisScale).y), EPS);
  let denom = max(topY - baseY, EPS) * wAxisY;

  return saturate((p_world.y - baseY) / denom);
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

fn densityHeight(ph: f32) -> f32 {
  var ret = ph;
  ret *= saturate(remap(ph, 0.0, 0.2, 0.0, 1.0));
  let anvil = anvilStrength();
  let capSupport = smoothstep(0.56, 0.86, saturate(ph)) * (1.0 - smoothstep(0.94, 1.0, saturate(ph)));
  ret *= 1.0 + anvil * capSupport * 0.30;
  ret *= saturate(remap(ph, mix_f(0.90, 0.96, anvil), 1.0, 1.0, 0.0));
  ret *= max(C.globalDensity * 10.0, 0.0);
  return ret;
}

fn weatherCoverageGate(wm: vec4<f32>) -> f32 {
  if (wm.b >= 1.0) { return 1.0; }
  let wHi = saturate(remap(C.globalCoverage, 0.0, 1.0, 0.0, 1.0) - 0.5) * wm.g * 2.0;
  let WMc = max(wm.r, wHi);
  return 1.0 - C.globalCoverage * saturate(WMc - opt._r1);
}

fn densityFromSamples(ph: f32, wm: vec4<f32>, s: vec4<f32>, det: vec3<f32>) -> f32 {
  if (ph < 0.0) { return 0.0; }
  if (wm.b >= 1.0) { return 0.0; }

  let phD = phLayerBreakup(ph, wm, s, det);

  // base shape
  var shape = saturate(s.r);
  shape = contrast01(shape, 1.35);

  // "fbm" from the other channels if present, otherwise still sane
  let fbm_s = saturate(s.g * 0.625 + s.b * 0.25 + s.a * 0.125);

  // treat fbm_s as an erosion threshold for the base shape
  let SNsample = saturate(remap(shape, fbm_s, 1.0, 0.0, 1.0));

  var SA = saturate(heightShape(phD, 1.0));
  let tallLayerBreak = tallBoxBlend();
  let bodyNoise = saturate(s.g * 0.45 + s.b * 0.35 + s.a * 0.20);
  let bodyLift3D = mix_f(1.0, mix_f(0.92, 1.08, bodyNoise), tallLayerBreak);
  SA = saturate(SA * bodyLift3D);

  let gate = weatherCoverageGate(wm);
  let SNnd = saturate(remap(SNsample * SA, gate, 1.0, 0.0, 1.0));

  let DN = detailMod(phD, det);

  var core = saturate(remap(SNnd, DN, 1.0, 0.0, 1.0));

  let fluff = max(TUNE.fluffFactor, 0.0);
  let fluff01 = saturate(fluff / (fluff + 1.45));
  let dHi = saturate(max(det.r, max(det.g, det.b)));
  let dLo = saturate(min(det.r, min(det.g, det.b)));
  let dMid = saturate((det.r + det.g + det.b) * 0.3333333333);
  let scallopSignal = saturate(mix_f(dHi, 1.0 - dLo, 0.42) * 0.72 + ridge01(contrast01(dMid, 2.35)) * 0.28);
  let scallop = pow(saturate(ridge01(contrast01(scallopSignal, 2.75))), mix_f(1.25, 0.62, fluff01));
  let shellMask = pow(saturate(1.0 - core), mix_f(1.35, 0.58, fluff01));
  let bodyMask = mix_f(0.76, 1.0, saturate(remap(phD, 0.0, 0.95, 0.0, 1.0)));
  core = saturate(core - scallop * shellMask * bodyMask * (0.015 + 0.145 * fluff01));
  core = pow(core, mix_f(1.35, 1.58, fluff01));

  return max(core * densityHeight(phD), 0.0);
}

fn densityMacroFromSamples(ph: f32, wm: vec4<f32>, s: vec4<f32>) -> f32 {
  if (ph < 0.0) { return 0.0; }
  if (wm.b >= 1.0) { return 0.0; }

  let phD = phLayerBreakupMacro(ph, wm, s);

  var shape = saturate(s.r);
  shape = contrast01(shape, 1.18);

  let fbm_s = saturate(s.g * 0.625 + s.b * 0.25 + s.a * 0.125);
  let SNsample = saturate(remap(shape, fbm_s * 0.68, 1.0, 0.0, 1.0));

  var SA = saturate(heightShape(phD, 1.0));
  let tallLayerBreak = tallBoxBlend();
  let bodyNoise = saturate(s.g * 0.45 + s.b * 0.35 + s.a * 0.20);
  let bodyLift3D = mix_f(1.0, mix_f(0.94, 1.06, bodyNoise), tallLayerBreak);
  SA = saturate(SA * bodyLift3D);

  let gate = weatherCoverageGate(wm);
  let SNnd = saturate(remap(SNsample * SA, gate * 0.88, 1.0, 0.0, 1.0));

  let detProxy = detailProxyFromShape(max(phD, 0.0), s);
  let breakup = detailMod(phD, detProxy);

  // Keep far/proxy LODs scalloped, but do not let the proxy become a solid
  // filler that erases detail erosion from the real detail volume.
  var core = saturate(remap(SNnd, 0.12 + breakup * 0.16, 1.0, 0.0, 1.0));
  core = pow(core, 1.16);

  let contour = ridge01(contrast01(saturate(shape * 0.64 + fbm_s * 0.36), 2.10));
  let carveMask = mix_f(0.48, 1.0, saturate(remap(phD, 0.0, 0.96, 0.0, 1.0)));
  let carve = 1.0 - (0.18 * saturate(breakup) + 0.10 * contour) * carveMask;
  core *= saturate(carve);
  return max(core * densityHeight(phD), 0.0);
}

fn densityWeatherProxy(ph: f32, wm: vec4<f32>) -> f32 {
  if (ph < 0.0) { return 0.0; }
  if (wm.b >= 1.0) { return 0.0; }

  let phD = saturate(ph + (wm.g - 0.5) * 0.030 + (wm.r - 0.5) * 0.018);
  let gate = weatherCoverageGate(wm);
  let cloudField = saturate(max(wm.r, wm.g * 0.92) * (0.82 + wm.a * 0.22));
  let heightField = heightShape(phD, 1.0) * densityHeight(phD);
  var core = saturate(remap(cloudField * heightField, gate * 0.78, 1.0, 0.0, 1.0));

  let edgeGrain = ridge01(contrast01(saturate(wm.r * 0.58 + wm.g * 0.34 + wm.a * 0.08), 2.15));
  let topCarve = smoothstep(0.48, 0.96, phD);
  let baseCarve = 1.0 - smoothstep(0.0, 0.18, phD) * 0.20;
  core = pow(core, 1.12);
  core *= saturate(1.0 - edgeGrain * mix_f(0.055, 0.145, topCarve));
  core *= baseCarve;

  return max(core, 0.0);
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
  squareOrigin_xz: vec2<f32>,
  invSide: f32,
  wScale: f32
) -> f32 {
  let uv = weatherUV_from(pos, squareOrigin_xz, invSide, wScale);
  let wm = wrap2D(weather2D, samp2D, uv, 0i, weatherLOD);
  let phL = computePH(pos, wm);
  if (phL < 0.0 || wm.b >= 1.0) { return 0.0; }

  let w = worldWarpXZ(pos.xz, phL, wg_boxMaxXZ);
  let s = sampleShapeRGBAWarp(pos, phL, lodShape, w);
  let det = sampleDetailRGBWarp(pos, phL, lodDetail, w);

  var d = densityFromSamples(phL, wm, s, det);
  d *= insideFaceFade(pos, boxMin(), boxMax());
  return max(d, 0.0);
}

fn approxLightingNormal(
  pos: vec3<f32>,
  weatherLOD: f32,
  lodShape: f32,
  lodDetail: f32,
  squareOrigin_xz: vec2<f32>,
  invSide: f32,
  wScale: f32
) -> vec3<f32> {
  let probe = max(wg_finestWorld * 0.9, 1e-3);

  let dx =
    sampleLightingDensity(pos + vec3<f32>(probe, 0.0, 0.0), weatherLOD, lodShape, lodDetail, squareOrigin_xz, invSide, wScale) -
    sampleLightingDensity(pos - vec3<f32>(probe, 0.0, 0.0), weatherLOD, lodShape, lodDetail, squareOrigin_xz, invSide, wScale);

  let dy =
    sampleLightingDensity(pos + vec3<f32>(0.0, probe, 0.0), weatherLOD, lodShape, lodDetail, squareOrigin_xz, invSide, wScale) -
    sampleLightingDensity(pos - vec3<f32>(0.0, probe, 0.0), weatherLOD, lodShape, lodDetail, squareOrigin_xz, invSide, wScale);

  let dz =
    sampleLightingDensity(pos + vec3<f32>(0.0, 0.0, probe), weatherLOD, lodShape, lodDetail, squareOrigin_xz, invSide, wScale) -
    sampleLightingDensity(pos - vec3<f32>(0.0, 0.0, probe), weatherLOD, lodShape, lodDetail, squareOrigin_xz, invSide, wScale);

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
  squareOrigin_xz: vec2<f32>,
  invSide: f32,
  wScale: f32
) -> f32 {
  let probe = max(wg_finestWorld * 2.25, 2e-3);

  let d0 = sampleLightingDensity(pos, weatherLOD, lodShape, lodDetail, squareOrigin_xz, invSide, wScale);
  if (d0 <= 1e-5) { return 0.0; }

  let dFront = sampleLightingDensity(pos + sunDir * probe, weatherLOD, lodShape, lodDetail, squareOrigin_xz, invSide, wScale);
  let dBack = sampleLightingDensity(pos - sunDir * probe, weatherLOD, lodShape, lodDetail, squareOrigin_xz, invSide, wScale);

  let opensToSun = saturate((d0 - dFront) / max(d0, 0.06));
  let buriedFromBehind = saturate((dBack - d0) / max(max(dBack, d0), 0.06));

  return saturate(opensToSun * (1.0 - 0.65 * buriedFromBehind));
}

// ---------------------- scattering and lighting
fn BeerLaw(opticalDepth: f32, absorption: f32) -> f32 {
  return exp2(-max(opticalDepth, 0.0) * max(absorption, EPS) * INV_LN2);
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
  return saturate(x / (x + 6.0));
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
  let lobeExp = mix_f(1.6, 18.0, sharp01);
  let towardLobe = pow(max(towardSun, 0.02), lobeExp);
  let awayLobe = pow(max(awaySun, 0.02), lobeExp);
  let directional = mix_f(awayLobe, towardLobe, bias01);
  let angular = max(directional, towardLobe * mix_f(0.58, 0.88, sharp01));

  let upness = saturate(shapeUp * 0.5 + 0.5);
  let upperExposure = smoothstep(0.52, 0.92, upness);
  let exposedSun = mix_f(0.30, 1.0, pow(saturate(sunVisibility), 0.30));

  let viewEdge = smoothstep(0.10, 0.98, pow(saturate(viewRim), mix_f(0.72, 0.24, sharp01)));
  let lightEdge = smoothstep(0.08, 0.98, pow(saturate(sunRim), mix_f(0.88, 0.28, sharp01)));
  let edge = viewEdge * mix_f(0.18, 1.0, lightEdge) * mix_f(0.18, 1.0, upperExposure);

  let thin = pow(saturate(1.0 - sampleAlpha), mix_f(0.80, 0.22, sharp01));
  let thinGate = smoothstep(0.05, 0.88, thin);
  let sunOcc = 1.0 - saturate(sunVisibility);
  let powder = mix_f(0.42, 1.0, BeerPowderBand(sunOcc));
  let heightGate = smoothstep(0.06, 0.96, saturate(percent_height));
  let horizonMix = saturate(C.silverHorizonBoost);
  let horizon = mix_f(1.0, pow(1.0 - abs(cos_angle), 0.75), horizonMix);

  let strength = SilverControl() * 1.85;
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

  let frontShell = pow(saturate(viewTransmittance), 0.42);
  let exposedToSun = saturate(sunExposure);
  let upperGate = saturate(upperExposure);

  let phaseGlow = phase * mix_f(0.15, 0.42, pow(towardSun, 1.10));
  let broadDirect = 0.22 + 0.38 * lightDensity * mix_f(0.84, 1.10, lightSideRaw);

  let reliefDiffuse = sunVisibility
    * mix_f(0.035, 0.28, exposedToSun)
    * pow(lightSideRaw, 0.82)
    * pow(body, 0.58)
    * mix_f(0.72, 1.0, frontShell);

  let silhouetteCore = pow(body, 1.18) * pow(towardSun, 1.05);
  let reliefShadow = silhouetteCore
    * mix_f(0.28, 0.90, 1.0 - lightSideRaw)
    * mix_f(0.48, 0.96, 1.0 - rim)
    * mix_f(0.48, 0.92, 1.0 - rawSunVisibility);

  let cavityShadow = pow(1.0 - lightSideRaw, 1.45)
    * mix_f(0.035, 0.22, body)
    * mix_f(0.52, 0.90, 1.0 - exposedToSun);

  let bodyShadow = clamp(mix_f(0.0, 0.44, reliefShadow) + cavityShadow, 0.0, 0.74);

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
    * mix_f(0.14, 0.82, edgeThin)
    * mix_f(0.48, 1.0, 1.0 - bodyShadow);

  let ambientRelief = mix_f(0.0, 0.04, exposedToSun) * mix_f(1.0, 0.80, bodyShadow);
  let ambientHeight = mix_f(0.86, 1.05, saturate(percent_height));
  let ambientVis = AmbientVisibility(density, rawSunVisibility, lightSide, dist_along_ray);
  let ambientOcclusion = 1.0 - bodyShadow * 0.50;
  let ambient = (ambientBase + ambientEdgeFill + ambientRelief) * ambientHeight * ambientVis * ambientOcclusion;

  let bodyLift = 0.052
    * pow(lightSideRaw, 1.02)
    * pow(body, 0.78)
    * mix_f(0.60, 1.0, 1.0 - bodyShadow)
    * mix_f(0.78, 1.0, rawSunVisibility);

  let silverSharpness = SilverSharpness();
  let exposedShell = smoothstep(0.05, 0.82, exposedToSun) * pow(frontShell, 0.48) * mix_f(0.42, 1.0, upperGate);
  let alphaCoherence = smoothstep(0.006, 0.055, sampleAlpha);
  let silverBase = SilverPhase(ca, rawSunVisibility, sampleAlpha, rimBoost, sunRim, percent_height, upperGate * 2.0 - 1.0) * exposedShell * alphaCoherence;
  let sunEdge = pow(saturate(rimBoost * sunRim), 0.42);

  let silverCrest = silverBase
    * mix_f(0.78, 1.12, edgeThin)
    * mix_f(0.78, 1.04, lightSideRaw)
    * mix_f(0.55, 1.0, sunEdge);

  let throughSunGlint = SilverControl()
    * 0.26
    * exposedShell
    * alphaCoherence
    * pow(max(towardSun, 0.05), 1.25 + silverSharpness * 0.20)
    * mix_f(0.35, 1.0, sunEdge)
    * mix_f(0.82, 1.0, rawSunVisibility);

  let silver = silverCrest + throughSunGlint;

  let lowSunRaw = 1.0 - saturate((L.sunDir.y + 0.08) / 0.82);
  let lowSun = lowSunRaw * 0.42;

  let sunCol = C.sunColor * mix_v3(vec3<f32>(1.02, 1.0, 0.99), vec3<f32>(1.0, 0.92, 0.86), lowSun);
  let silverCol = mix_v3(vec3<f32>(1.02, 1.01, 1.0), vec3<f32>(1.0, 0.94, 0.90), lowSun);
  let skyCol = mix_v3(vec3<f32>(0.58, 0.66, 0.78), vec3<f32>(0.64, 0.64, 0.82), lowSun * 0.28);
  let shadowCol = mix_v3(vec3<f32>(0.62, 0.68, 0.78), vec3<f32>(0.66, 0.68, 0.80), lowSun * 0.28);

  let directEnergy = direct + multiScatter + forwardWrap + backWrap;
  let silverEnergy = silver + bodyLift * mix_f(0.72, 1.02, pow(towardSun, 1.10));
  let ambientEnergy = ambient;

  let shadowTint = shadowCol * (bodyShadow * 0.08 + reliefShadow * 0.035 + cavityShadow * 0.08);
  let radiance = sunCol * directEnergy + silverCol * silverEnergy + skyCol * ambientEnergy - shadowTint;
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
  let res = vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));
  let fullRes = vec2<f32>(f32(reproj.fullWidth), f32(reproj.fullHeight));
  let xf = floor((vec2<f32>(pix) + 0.5) * (fullRes / res));
  return vec2<i32>(
    i32(clamp(xf.x, 0.0, fullRes.x - 1.0)),
    i32(clamp(xf.y, 0.0, fullRes.y - 1.0))
  );
}

fn store_history_full_res_if_owner(pixCurr: vec2<i32>, layer: i32, color: vec4<f32>) {
  if (reproj.enabled == 0u) {
    textureStore(historyOut, fullPixFromCurrent(pixCurr), layer, color);
    return;
  }

  let ss = i32(max(reproj.subsample, 1u));
  let off = i32(reproj.sampleOffset % u32(ss * ss));
  let sx = off % ss;
  let sy = off / ss;

  let fullPix = fullPixFromCurrent(pixCurr);
  if ((fullPix.x % ss) == sx && (fullPix.y % ss) == sy) {
    textureStore(historyOut, fullPix, layer, color);
  }
}

fn insideFaceFade(p: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>) -> f32 {
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
  lodDetailBase: f32,
  squareOrigin_xz: vec2<f32>,
  invSide: f32,
  wScale: f32,
  stepIndex: i32
) -> f32 {
  let uv = weatherUV_from(p, squareOrigin_xz, invSide, wScale);
  let wm = wrap2D(weather2D, samp2D, uv, 0i, weatherLOD);

  let ph = computePH(p, wm);
  if (ph < 0.0 || wm.b >= 1.0) { return 0.0; }

  let lodShape = clamp(lodShapeBase + 0.65, 0.0, wg_maxMipS);
  let s = sampleShapeRGBA(p, ph, lodShape);
  let d = densityMacroFromSamples(ph, wm, s) * insideFaceFade(p, boxMin(), boxMax());

  return max(d, 0.0);
}

fn sunTransmittance(
  p0: vec3<f32>,
  sunDir: vec3<f32>,
  weatherLOD: f32,
  lodShapeBase: f32,
  lodDetailBase: f32,
  nominalStepLen: f32,
  squareOrigin_xz: vec2<f32>,
  invSide: f32,
  wScale: f32,
  stepsIn: i32,
  jitter01: f32
) -> f32 {
  let start = p0 + sunDir * max(TUNE.aabbFaceOffset, EPS);
  let hit = intersectAABB_robust(start, sunDir, boxMin(), boxMax());
  let hitDist = max(hit.y, 0.0);

  // Use a local light-cone distance instead of tracing the whole horizon box.
  // Very tall or horizon-sized boxes can make the full AABB exit distance huge,
  // which turns every lit sample into a long secondary ray. Local cloud shading
  // only needs nearby occluders for convincing silver-lining and body shadowing.
  let sunHorizon = 1.0 - abs(sunDir.y);
  let localLightReach = clamp(
    1.45 + B.half.y * 0.62 + max(B.half.x, B.half.z) * 0.010 + sunHorizon * 0.85,
    1.65,
    4.60
  );
  let availableDist = min(hitDist, localLightReach);
  if (availableDist <= TUNE.minStep) { return 1.0; }

  let targetStep = max(nominalStepLen, TUNE.minStep);
  let distSteps = i32(ceil(availableDist / targetStep));
  let steps = clamp(max(max(stepsIn, 1), distSteps), 1, 28);
  let lightStep = availableDist / f32(steps);

  var opticalDepth = 0.0;
  let phase = 0.15 + 0.70 * saturate(fract(jitter01));
  var p = start + sunDir * (phase * lightStep);
  var sideARaw = cross(sunDir, vec3<f32>(0.0, 1.0, 0.0));
  if (dot(sideARaw, sideARaw) < 1e-5) {
    sideARaw = cross(sunDir, vec3<f32>(1.0, 0.0, 0.0));
  }
  let sideA = normalize(sideARaw);
  let sideB = normalize(cross(sideA, sunDir));
  let jitterAmp = min(lightStep * 0.16, max(wg_finestWorld * 0.85, B.half.y * 0.010));

  for (var i: i32 = 0; i < steps; i = i + 1) {
    let jf = f32(i) + jitter01 * 23.17;
    let jx = fract(sin(jf * 12.9898 + 78.233) * 43758.5453) * 2.0 - 1.0;
    let jy = fract(sin(jf * 39.3467 + 11.135) * 24634.6345) * 2.0 - 1.0;
    let pj = p + (sideA * jx + sideB * jy) * jitterAmp;
    let d = sampleCloudDensityAt(
      pj, weatherLOD, lodShapeBase, lodDetailBase,
      squareOrigin_xz, invSide, wScale, i
    );
    opticalDepth += d * lightStep * SUN_EXTINCTION_SCALE;
    if (BeerLaw(opticalDepth, C.cloudBeer) < TUNE.sunMinTr) { break; }
    p += sunDir * lightStep;
  }

  return BeerLaw(opticalDepth, C.cloudBeer);
}

// quick empty probe
fn weatherProbeEmpty(
  p_start: vec3<f32>,
  rd: vec3<f32>,
  stepLen: f32,
  nProbes: i32,
  coarseMip: f32,
  squareOrigin_xz: vec2<f32>,
  invSide: f32,
  wScale: f32
) -> bool {
  var pos = p_start;
  var emptyCount: i32 = 0;

  for (var i: i32 = 0; i < nProbes; i = i + 1) {
    let uv = weatherUV_from(pos, squareOrigin_xz, invSide, wScale);
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
    // Keep jitter/warp amplitude at the original local-cloud scale even when the
    // horizon box tiles outward.
    wg_boxMaxXZ = min(max(B.half.x, B.half.z), 1.0);
  }
  workgroupBarrier();

  // pixel and guard
  let pixI = vec2<i32>(i32(gid_in.x), i32(gid_in.y)) + vec2<i32>(frame.originX, frame.originY);
  if (pixI.x < 0 || pixI.y < 0 || pixI.x >= i32(frame.fullWidth) || pixI.y >= i32(frame.fullHeight)) {
    return;
  }

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
  if (opt.useCustomPos == 1u) {
    let idx = u32(pixI.x) + u32(pixI.y) * frame.fullWidth;
    rayRo = posBuf[idx].xyz;
  }

  // ray direction
  let ndc = uvPix * 2.0 - vec2<f32>(1.0, 1.0);
  let tanY = tan(0.5 * V.fovY);

  let rd_camera = normalize(vec3<f32>(ndc.x * V.aspect * tanY, -ndc.y * tanY, -1.0));
  let rayRd = normalize(basisRight * rd_camera.x + basisUp * rd_camera.y - camFwd * rd_camera.z);

  // intersect volume
  let bmin = boxMin();
  let bmax = boxMax();
  let ti = intersectAABB_robust(rayRo, rayRd, bmin, bmax);

  if (ti.x > ti.y || ti.y <= 0.0) {
    let z = vec4<f32>(0.0);
    textureStore(outTex, pixI, frame.layerIndex, z);
    if (reproj.enabled == 1u) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }
    return;
  }

  var t0 = max(ti.x - TUNE.aabbFaceOffset, 0.0);
  var t1 = ti.y + TUNE.aabbFaceOffset;
  if (t0 >= t1) {
    let z = vec4<f32>(0.0);
    textureStore(outTex, pixI, frame.layerIndex, z);
    if (reproj.enabled == 1u) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }
    return;
  }

  // ---------------------- precompute weather mapping and LOD
  let aabb = max(bmax - bmin, vec3<f32>(EPS, EPS, EPS));
  let side = max(aabb.x, aabb.z);
  let invSide = 1.0 / max(side, EPS);
  let squareOrigin_xz = B.center.xz - vec2<f32>(0.5 * side);

  let wScale = select(NTransform.weatherScale, 1.0, NTransform.weatherScale == 0.0);
  let wAxis = axisOrOne3(NTransform.weatherAxisScale);

  let weatherTileInvWorld = 0.5 * max(B.uvScale, EPS);
  let texelsPerWorld_u = wg_weatherDim.x * abs(wAxis.x) * wScale * weatherTileInvWorld;
  let texelsPerWorld_v = wg_weatherDim.y * abs(wAxis.z) * wScale * weatherTileInvWorld;
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
  let nearMetricScale = max(horizonFarScale, max(B.half.y * 2.0, 1.0));
  let effectiveNearFluffDist = clamp(min(TUNE.nearFluffDist, nearMetricScale * 0.10), 0.35, 6.0);
  let effectiveNearDensityRange = clamp(min(TUNE.nearDensityRange, nearMetricScale * 0.08), 0.35, 5.0);
  let nearFineDist = clamp(effectiveNearFluffDist * 0.12, 0.08, 0.35);

  // noise and jitter
  let bnPix = distanceBlueScreen(pixI, entryRayDistance, effectiveNearFluffDist);
  let rand0 = bnPix;
  let entryNearF = 1.0 - smoothstep(0.0, max(effectiveNearFluffDist, EPS), entryRayDistance);
  let nearJitterScale = mix_f(1.0, 0.32, entryNearF);

  // step sizing
  let viewDir = normalize(-rayRd);
  let cosVF = max(dot(rayRd, camFwd), EPS);

  let voxelBound = wg_finestWorld / max(abs(dot(rayRd, basisUp)), 0.15);

  let raySegmentLength = max(t1 - t0, TUNE.minStep);
  let segmentAspect = raySegmentLength / max(max(B.half.x, B.half.z), max(B.half.y * 2.0, 1.0));
  let thickPerfF = saturate(thickBoxPerfStrength() * saturate(remap(segmentAspect, 0.35, 1.45, 0.0, 1.0)));
  let maxStepsF = max(f32(max(TUNE.maxSteps, 1)), 1.0);
  let horizonPerfF = smoothstep(24.0, 120.0, horizonFarScale) * smoothstep(0.30, 1.10, segmentAspect);
  let reachStepLimit = (raySegmentLength / maxStepsF) * mix_f(1.10, 1.55, horizonPerfF);
  let thickStepLimit = TUNE.maxStep * mix_f(1.0, max(TUNE.thickStepBoost, 1.0), thickPerfF);
  let effectiveMaxStep = max(max(TUNE.maxStep, thickStepLimit), reachStepLimit);

  var baseStep = clamp(V.stepBase, TUNE.minStep, effectiveMaxStep);
  baseStep = min(baseStep, voxelBound * mix_f(1.0, 1.65, thickPerfF));
  baseStep = baseStep * mix_f(1.0, 1.0 + TUNE.stepJitter * nearJitterScale, rand0 * 2.0 - 1.0);
  baseStep = clamp(baseStep, TUNE.minStep, effectiveMaxStep);

  let farStartWorld = max(TUNE.farStart * horizonFarScale, TUNE.farStart);
  let farFullWorld = max(TUNE.farFull * horizonFarScale, farStartWorld + 0.001);

  let rayExitDepth = max(t1, entryRayDistance);
  let rayFarHistoryF = saturate(remap(rayExitDepth, farStartWorld, farFullWorld, 0.0, 1.0));
  let thickBudgetBoost = mix_f(1.08, max(1.08, TUNE.thickStepBoost), thickPerfF);
  let rayBudgetStep = clamp((raySegmentLength / maxStepsF) * thickBudgetBoost, TUNE.minStep, effectiveMaxStep);

  let startPhaseJitter = TUNE.phaseJitter * mix_f(1.0, 0.30, entryNearF);
  var t = clamp(t0 + (rand0 * startPhaseJitter) * min(baseStep, rayBudgetStep), t0, t1);

  // lighting setup. rayRd points from camera into the volume, matching the blog-style phase convention.
  let sunDir = normalize(L.sunDir);
  let cosVS = dot(rayRd, sunDir);

  // sun shadowing samples should cover neighboring cloud volume, not only the vertical slab thickness.
  let sunNominalSpan = max(min(length(B.half * 2.0) * 0.5, 4.0), EPS);
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

  loop {
    if (iter >= TUNE.maxSteps) { break; }
    if (t >= t1 || Tr < transmittanceCutoff()) { break; }

    let p = rayRo + rayRd * t;
    let sampleRayDistance = max(length(p - rayRo), 0.0);
    let samplePixelWorld = max(sampleRayDistance * rayPixelWorldScale, wg_finestWorld * 0.50);
    let farF = saturate(remap(sampleRayDistance, farStartWorld, farFullWorld, 0.0, 1.0));
    let screenFarF = saturate(remap(samplePixelWorld / max(wg_finestWorld, EPS), 2.0, 18.0, 0.0, 1.0));
    let coverageStep = max(
      rayBudgetStep,
      baseStep * mix_f(1.0, min(TUNE.farStepMult, 2.05), screenFarF)
    );
    let nearStepF = 1.0 - smoothstep(0.0, nearFineDist, sampleRayDistance);
    let fineStep = baseStep * mix_f(1.0, clamp(TUNE.nearStepScale, 0.12, 1.0), nearStepF);
    let stepLen = clamp(mix_f(coverageStep, fineStep, nearStepF), TUNE.minStep, effectiveMaxStep);
    let thickLodExtra = thickPerfF * saturate(TUNE.thickDetailSkip) * smoothstep(0.28, 0.96, sampleRayDistance);
    let weatherLOD = clamp(weatherLOD_base + min(TUNE.farLodPush * farF, 0.18), 0.0, wg_maxMipW);

    let uv_weather = weatherUV_from(p, squareOrigin_xz, invSide, wScale);
    let weatherDensityLOD = 0.0;
    let wm_primary = wrap2D(weather2D, samp2D, uv_weather, 0i, weatherDensityLOD);

    let ph_coarse = computePH(p, wm_primary);

    let columnSkip = verticalColumnSkipDistance(p, rayRd, wm_primary, stepLen, effectiveMaxStep, thickPerfF, screenFarF);
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
    if (weatherGateFast >= TUNE.weatherRejectGate && sampleRayDistance > nearFineDist * 2.0) {
      let rejectF = smoothstep(TUNE.weatherRejectGate, 1.0, weatherGateFast);
      let rejectPerfF = max(max(rejectF, thickPerfF * 0.45), screenFarF * 0.50);
      let rejectBoost = mix_f(1.18, min(max(TUNE.emptySkipMult, 1.0), 4.35), rejectPerfF);
      var rejectStep = clamp(stepLen * rejectBoost, TUNE.minStep, effectiveMaxStep * 2.2);
      let runProbeF = max(thickPerfF, screenFarF) * smoothstep(nearFineDist * 4.0, nearFineDist * 12.0, sampleRayDistance);
      if (runProbeF > 0.36) {
        let probeStep = clamp(rejectStep * mix_f(1.55, 2.65, runProbeF), TUNE.minStep, effectiveMaxStep * 5.5);
        let probeMip = clamp(weatherLOD + 1.25 + runProbeF * 1.50, 0.0, wg_maxMipW);
        if (weatherProbeEmpty(p + rayRd * rejectStep, rayRd, probeStep, 3, probeMip, squareOrigin_xz, invSide, wScale)) {
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
    let farLodExtra = min(TUNE.farLodPush * farF, 0.18);
    let thickShapeLodExtra = thickLodExtra * 0.10;
    let thickDetailLodExtra = thickLodExtra * 0.28;
    let lodShapeLighting = clamp(baseLOD + lodBias + farLodExtra + thickShapeLodExtra, 0.0, wg_maxMipS);
    let lodDetailLighting = clamp(baseLOD + lodBias + farLodExtra + nearDetailSoftLod + thickDetailLodExtra, 0.0, wg_maxMipD);
    let lodShapeBase = min(lodShapeLighting, min(wg_maxMipS, 1.0));
    let lodDetailBase = min(lodDetailLighting, min(wg_maxMipD, 1.0));

    let wm = wm_primary;
    let ph = ph_coarse;
    let stepWarp = worldWarpXZ(p.xz, max(ph, 0.0), wg_boxMaxXZ);

    let visibleLodEase = smoothstep(0.08, 0.98, max(farF, screenFarF));
    let lodShapeVisible = clamp(min(lodShapeLighting, mix_f(1.05, 1.35, visibleLodEase)), 0.0, wg_maxMipS);
    let lodDetailVisibleBase = clamp(min(lodDetailLighting, mix_f(1.10, 1.70, visibleLodEase)), 0.0, wg_maxMipD);

    let faceFade = insideFaceFade(p, bmin, bmax);
    let nearDense = mix_f(TUNE.nearDensityMult, 1.0, saturate(nearDepth / effectiveNearDensityRange));

    let verticalInteriorF = smoothstep(0.10, 0.28, ph) * (1.0 - smoothstep(0.78, 0.98, ph));
    let weatherFilledF = 1.0 - smoothstep(TUNE.weatherRejectGate * 0.54, TUNE.weatherRejectGate * 0.94, weatherGateFast);
    let noShapeFarF = smoothstep(0.76, 1.0, max(farF, screenFarF))
      * smoothstep(nearFineDist * 5.0, nearFineDist * 12.0, sampleRayDistance)
      * verticalInteriorF
      * weatherFilledF
      * max(thickPerfF, screenFarF * 0.65);

    var s: vec4<f32>;
    var densMacro: f32;
    var usedWeatherProxy: f32 = 0.0;
    if (noShapeFarF > 0.62) {
      s = syntheticShapeFromWeather(ph, wm);
      densMacro = densityWeatherProxy(ph, wm) * faceFade * nearDense;
      usedWeatherProxy = noShapeFarF;
    } else {
      s = sampleShapeRGBAWarp(p, max(ph, 0.0), lodShapeVisible, stepWarp);
      densMacro = densityMacroFromSamples(ph, wm, s) * faceFade * nearDense;
    }

    // Conservative macro-empty acceleration. Detail noise only erodes the macro
    // field, so when the macro field is genuinely absent there is no useful
    // detail/lighting work to do. Keep the threshold tiny and only use a short
    // jump so silhouettes and wisps survive.
    let macroEmptyThreshold = max(TUNE.sunDensityGate * mix_f(0.38, 0.82, thickPerfF), 0.00005);
    let macroMissF = smoothstep(macroEmptyThreshold * 2.5, macroEmptyThreshold * 0.45, max(densMacro, prevMacroDens));
    let macroMissAllowed = macroMissF * smoothstep(nearFineDist * 1.25, nearFineDist * 3.0, sampleRayDistance) * max(thickPerfF, screenFarF * 0.55);
    if (macroMissAllowed > 0.72 && densMacro < macroEmptyThreshold) {
      let missBoost = mix_f(1.20, min(max(TUNE.emptySkipMult, 1.0), 2.85), macroMissAllowed);
      let missStep = clamp(stepLen * missBoost, TUNE.minStep, effectiveMaxStep * 2.15);
      prevDens = 0.0;
      prevMacroDens = max(densMacro, 0.0);
      prevTsun = Tsun_cached;
      t = min(t + missStep, t1);
      iter = iter + 1;
      continue;
    }

    let thickEmptyF = 0.0;
    let macroEmpty = false;

    let farLightingFastF = saturate(remap(max(farF, screenFarF), 0.62, 1.0, 0.0, 1.0));
    let denseLightingFastF = saturate(remap(max(densMacro, prevMacroDens), 0.15, 0.35, 0.0, 1.0));
    let macroOnly = (farLightingFastF * denseLightingFastF) > 0.72;

    let farProxyRawF = smoothstep(0.66, 1.0, max(farF, screenFarF)) * smoothstep(nearFineDist * 2.0, nearFineDist * 6.0, sampleRayDistance);
    let farProxyEdgeProtect = 1.0 - smoothstep(0.025, 0.16, densMacro);
    let farProxySafeF = max(farProxyRawF * (1.0 - farProxyEdgeProtect * 0.65), usedWeatherProxy * 0.86);
    let proxyOnlyF = farProxySafeF;

    let detailProxy = detailProxyFromShape(max(ph, 0.0), s);
    let denseInteriorF = smoothstep(0.12, 0.34, densMacro);
    let thickInteriorFilterF = thickPerfF * smoothstep(0.14, 0.52, densMacro) * smoothstep(0.14, 0.94, sampleRayDistance);
    let lodDetailVisible = clamp(lodDetailVisibleBase + thickInteriorFilterF * 0.55 + farProxySafeF * 0.70, 0.0, wg_maxMipD);
    var detailRaw = detailProxy;
    if (farProxySafeF < 0.62 && usedWeatherProxy < 0.52) {
      detailRaw = sampleDetailRGBWarp(p, max(ph, 0.0), lodDetailVisible, stepWarp);
    }
    let thickDetailProxyF = thickPerfF * saturate(TUNE.thickDetailSkip) * smoothstep(0.18, 0.96, sampleRayDistance) * denseInteriorF;
    let detailProxyMixF = max(min(thickDetailProxyF, 0.24), farProxySafeF * 0.64);
    var det = mix_v3(detailRaw, detailProxy, min(detailProxyMixF, 0.68));

    let detailMean = (det.r + det.g + det.b) * 0.3333333333;
    let thickDetailFilterF = thickPerfF * smoothstep(0.12, 0.82, sampleRayDistance) * smoothstep(0.05, 0.32, densMacro) * 0.34;
    det = mix_v3(det, vec3<f32>(detailMean), max(thickDetailFilterF, farProxySafeF * 0.28));

    var dens: f32 = densityFromSamples(ph, wm, s, det) * faceFade * nearDense;

    let thickBodySmoothF = thickPerfF * smoothstep(0.10, 0.42, densMacro) * smoothstep(0.10, 0.90, sampleRayDistance) * 0.30;
    dens = mix_f(dens, densMacro, thickBodySmoothF);

    let farSilhouetteKeep = smoothstep(0.36, 1.0, screenFarF) * saturate(remap(densMacro, 0.025, 0.20, 0.0, 1.0));
    dens = max(dens, densMacro * farSilhouetteKeep * 0.30);

    let bodySmooth = smoothstep(0.08, 0.42, max(densMacro, prevMacroDens));
    let raySmoothDensAdaptive = saturate(mix_f(TUNE.raySmoothDens * 0.30, TUNE.raySmoothDens, bodySmooth));
    let densSmoothed = mix_f(dens, prevDens, raySmoothDensAdaptive);
    let densMacroSmoothed = mix_f(densMacro, prevMacroDens, saturate(raySmoothDensAdaptive * 0.90));
    let denseInteriorStepF = thickPerfF * smoothstep(0.22, 0.62, densMacroSmoothed) * smoothstep(0.20, 0.90, sampleRayDistance);
    let farProxyStepF = farProxySafeF * smoothstep(0.07, 0.28, densMacroSmoothed);
    let weatherProxyStepF = usedWeatherProxy * smoothstep(0.06, 0.26, densMacroSmoothed);
    let adaptiveStepF = max(max(denseInteriorStepF, farProxyStepF * 0.72), weatherProxyStepF * 0.86);
    let sampleStepLen = clamp(stepLen * mix_f(1.0, max(1.0, TUNE.thickStepBoost * 0.88), adaptiveStepF), TUNE.minStep, effectiveMaxStep);

    if (densSmoothed > 0.00008) {
      let bnLocal = distanceBlueScreen(pixI, sampleRayDistance, effectiveNearFluffDist);
      let shadowInteriorProbe = saturate(remap(densMacroSmoothed, 0.05, 0.32, 0.0, 1.0));
      let proxyPerfF = max(proxyOnlyF, saturate(remap(max(farF, screenFarF), 0.45, 0.95, 0.0, 1.0)));
      let closeRayProtect = 1.0 - smoothstep(effectiveNearFluffDist * 1.00, effectiveNearFluffDist * 2.40, sampleRayDistance);
      let silhouetteProtect = 1.0 - smoothstep(0.12, 0.34, densMacroSmoothed);
      let lightingEdgeProtect = saturate(max(closeRayProtect * 0.90, silhouetteProtect * (1.0 - shadowInteriorProbe * 0.55)));
      let thickLightF = thickPerfF * saturate(TUNE.thickLightSkip) * smoothstep(0.10, 0.72, sampleRayDistance);
      let thickLightPerfF = thickLightF * (1.0 - lightingEdgeProtect);
      let adaptiveStrideAdd = i32(floor(farF * 4.0 + shadowInteriorProbe * farF * 2.5 + proxyPerfF * 2.0 + thickLightPerfF * mix_f(1.0, 4.8, shadowInteriorProbe)));
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
              p, sunDir, weatherDensityLOD, lodShapeLighting, lodDetailLighting, sunStepAdaptive,
              squareOrigin_xz, invSide, wScale, sunStepsAdaptive,
              fract(bnLocal + rand0 * 0.61803398875 + f32(iter) * 0.131)
            );
          }
        } else {
          Tsun_cached = 1.0;
        }

        let fastLighting = (sunStrideSafe > TUNE.sunStride && lightingEdgeProtect < 0.22) || macroOnly || (farF > 0.34) || (proxyPerfF > 0.42) || (thickLightPerfF > 0.45 && shadowInteriorProbe > 0.18);
        let ultraFastLighting = fastLighting && (((thickLightPerfF > 0.38 && shadowInteriorProbe > 0.18) && lightingEdgeProtect < 0.14) || proxyPerfF > 0.70 || Tr < 0.48);
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
            squareOrigin_xz,
            invSide,
            wScale
          );
          lightN_cached = normalize(mix_v3(shapeN_cached, densityN, mix_f(0.62, 0.22, shadowInteriorProbe)));
          sunExposure_cached = directionalExposure(
            p,
            weatherDensityLOD,
            max(0.0, lodShapeLighting + 0.55),
            max(0.0, lodDetailLighting + 1.05),
            sunDir,
            squareOrigin_xz,
            invSide,
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

      let rawSampleODFine = densSmoothed * sampleStepLen * VIEW_EXTINCTION_SCALE;
      let rawSampleODMacro = densMacroSmoothed * sampleStepLen * VIEW_EXTINCTION_SCALE;
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

      let shadowLift = vec3<f32>(0.045, 0.050, 0.058) * shadowInterior;
      lightCol = lightCol + shadowLift * alpha;

      let lNow = luminance(lightCol);
      let meanL = select(lNow, runMeanL / max(runN, 1.0), runN > 0.0);
      let allow = max(meanL * (1.0 + TUNE.fflyRelClamp), TUNE.fflyAbsFloor);
      if (lNow > allow) { lightCol *= allow / max(lNow, 1e-6); }

      rgb += Tr * lightCol * alpha;
      Tr *= absorb;

      runMeanL += lNow;
      runN += 1.0;

      if (Tr < transmittanceCutoff()) { break; }
    }

    prevDens = densSmoothed;
    prevMacroDens = densMacroSmoothed;
    prevTsun = Tsun_cached;

    t = min(t + sampleStepLen, t1);
    iter = iter + 1;
  }

  // compose
  var newCol: vec4<f32>;
  if (opt.writeRGB == 1u) {
    newCol = vec4<f32>(rgb, 1.0 - Tr);
  } else {
    let a = 1.0 - Tr;
    if (opt.outputChannel == 0u) { newCol = vec4<f32>(a, 0.0, 0.0, 1.0); }
    else if (opt.outputChannel == 1u) { newCol = vec4<f32>(0.0, a, 0.0, 1.0); }
    else if (opt.outputChannel == 2u) { newCol = vec4<f32>(0.0, 0.0, a, 1.0); }
    else { newCol = vec4<f32>(0.0, 0.0, 0.0, a); }
  }

  // Preserve compute output as premultiplied volumetric radiance.
  // The preview pass composites this over the procedural sky.
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

        let historyA = clamp(prevCol.a, newCol.a - 0.12, newCol.a + 0.12);
        let historyCol = vec4<f32>(prevClampedRGB, historyA);
        let blended = mix_v4(newCol, historyCol, tbSafe);
        textureStore(outTex, pixI, frame.layerIndex, blended);
        store_history_full_res_if_owner(pixI, frame.layerIndex, blended);
      }
    }
  } else {
    textureStore(outTex, pixI, frame.layerIndex, newCol);
    store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);
  }
}
