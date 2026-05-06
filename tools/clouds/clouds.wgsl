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
  _pad1: f32,
  _pad2: f32,
  _pad3: f32
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
  _pad6: f32
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
var<workgroup> wg_maxMipW: f32;
var<workgroup> wg_maxMipS: f32;
var<workgroup> wg_maxMipD: f32;
var<workgroup> wg_scaleS: f32;
var<workgroup> wg_scaleD: f32;
var<workgroup> wg_scaleS_effMax: f32;
var<workgroup> wg_scaleD_effMax: f32;
var<workgroup> wg_finestWorld: f32;

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
  let d = wg_weatherDim;
  let ep = vec2<f32>(0.5 / max(d.x, 1.0), 0.5 / max(d.y, 1.0));
  let u = uv * (vec2<f32>(1.0) - 2.0 * ep) + ep;
  return textureSampleLevel(tex, samp, u, layer_idx, lod);
}

fn wrap3D_shape(tex: texture_3d<f32>, samp: sampler, uvw: vec3<f32>, lod: f32) -> vec4<f32> {
  let d = wg_shapeDim;
  let ep = vec3<f32>(0.5 / max(d.x, 1.0), 0.5 / max(d.y, 1.0), 0.5 / max(d.z, 1.0));
  let u = uvw * (vec3<f32>(1.0) - 2.0 * ep) + ep;
  return textureSampleLevel(tex, samp, u, lod);
}

fn wrap3D_detail(tex: texture_3d<f32>, samp: sampler, uvw: vec3<f32>, lod: f32) -> vec4<f32> {
  let d = wg_detailDim;
  let ep = vec3<f32>(0.5 / max(d.x, 1.0), 0.5 / max(d.y, 1.0), 0.5 / max(d.z, 1.0));
  let u = uvw * (vec3<f32>(1.0) - 2.0 * ep) + ep;
  return textureSampleLevel(tex, samp, u, lod);
}

// blue noise
fn frameBlueOffset() -> vec2<i32> {
  let bnW = max(i32(wg_blueDim.x), 1);
  let bnH = max(i32(wg_blueDim.y), 1);
  let fi = i32(reproj.frameIndex);
  let so = i32(reproj.sampleOffset);
  let ox = (fi * 73 + fi * fi * 19 + so * 31) % bnW;
  let oy = (fi * 151 + fi * fi * 27 + so * 17) % bnH;
  return vec2<i32>(ox, oy);
}

fn sampleBlueScreen(pixI: vec2<i32>) -> f32 {
  let bnW = max(i32(wg_blueDim.x), 1);
  let bnH = max(i32(wg_blueDim.y), 1);
  let baseOff = frameBlueOffset();
  let p0 = vec2<i32>((pixI.x + baseOff.x) % bnW, (pixI.y + baseOff.y) % bnH);
  let p1 = vec2<i32>((pixI.x + baseOff.x * 3 + 17) % bnW, (pixI.y + baseOff.y * 5 + 29) % bnH);
  let uv0 = (vec2<f32>(p0) + 0.5) / wg_blueDim;
  let uv1 = (vec2<f32>(p1) + 0.5) / wg_blueDim;
  let a = textureSampleLevel(blueTex, sampBN, uv0, 0i, 0.0).r;
  let b = textureSampleLevel(blueTex, sampBN, uv1, 0i, 0.0).r;
  let mixT = fract(0.61803398875 * f32(reproj.frameIndex) + 0.41421356237 * f32(reproj.sampleOffset));
  return mix_f(a, b, mixT);
}

// box helpers
fn boxMin() -> vec3<f32> { return B.center - B.half; }
fn boxMax() -> vec3<f32> { return B.center + B.half; }

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

// shape & detail samplers
fn shapeUVW_fromWarp(pos: vec3<f32>, ph: f32, w: vec2<f32>) -> vec3<f32> {
  let scaleS = max(wg_scaleS, EPS);
  let pW = vec3<f32>(
    pos.x + w.x + NTransform.shapeOffsetWorld.x,
    pos.y + ph * 7.0 + NTransform.shapeOffsetWorld.y,
    pos.z + w.y + NTransform.shapeOffsetWorld.z
  );

  let axis = axisOrOne3(NTransform.shapeAxisScale);
  let sMul = select(NTransform.shapeScale, 1.0, NTransform.shapeScale == 0.0);
  return (pW * axis) * (scaleS * max(sMul, EPS));
}

fn detailUVW_fromWarp(pos: vec3<f32>, ph: f32, w: vec2<f32>) -> vec3<f32> {
  let scaleD = max(wg_scaleD, EPS);
  let pW = vec3<f32>(
    pos.x + w.x + NTransform.detailOffsetWorld.x,
    pos.y + NTransform.detailOffsetWorld.y,
    pos.z + w.y + NTransform.detailOffsetWorld.z
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
  let boxMaxXZ = max(B.half.x, B.half.z);
  let w = worldWarpXZ(pos.xz, ph, boxMaxXZ);
  return sampleShapeRGBAWarp(pos, ph, lod, w);
}

fn sampleDetailRGB(pos: vec3<f32>, ph: f32, lod: f32) -> vec3<f32> {
  let boxMaxXZ = max(B.half.x, B.half.z);
  let w = worldWarpXZ(pos.xz, ph, boxMaxXZ);
  return sampleDetailRGBWarp(pos, ph, lod, w);
}

// ---------------------- weather mapping
fn weatherUV_from(pos_world: vec3<f32>, squareOrigin_xz: vec2<f32>, invSide: f32, wScale: f32) -> vec2<f32> {
  let wAxis = axisOrOne3(NTransform.weatherAxisScale);
  let p = pos_world + NTransform.weatherOffsetWorld;
  let rel = (p.xz - squareOrigin_xz) * vec2<f32>(wAxis.x, wAxis.z);
  return rel * invSide * wScale;
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
  let topY = boxTop + jTop;

  return vec2<f32>(baseY, topY);
}

fn weatherCutY(wm: vec4<f32>) -> f32 {
  let boxH = max(B.half.y * 2.0, EPS);
  let boxBottom = (B.center.y - B.half.y);
  let b = clamp(wm.b, 0.0, 1.0);
  return boxBottom + b * boxH;
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
  // robust "one channel or many channels"
  var x = max(d.r, max(d.g, d.b));
  x = saturate(x);

  // make detail bite: ridge + contrast
  x = contrast01(x, 1.75);
  let r = ridge01(x);
  let crisp = pow(saturate(r), 1.6);

  // more detail in the body of the cloud, less near the very bottom
  let h = saturate(remap(ph, 0.06, 0.85, 0.0, 1.0));

  // keep some erosion even at high coverage, but reduce it a bit for overcast
  let cov = saturate(C.globalCoverage);
  let covAtten = exp(-cov * 0.55);

  // output is a threshold in [~0.12 .. ~0.65]
  return saturate(0.12 + (0.55 * covAtten) * crisp * h);
}


fn densityHeight(ph: f32) -> f32 {
  var ret = ph;
  ret *= saturate(remap(ph, 0.0, 0.2, 0.0, 1.0));
  ret *= mix_f(1.0, saturate(remap(sqrt(max(ph, 0.0)), 0.4, 0.95, 1.0, 0.2)), saturate(C.cloudAnvilAmount));
  ret *= saturate(remap(ph, 0.9, 1.0, 1.0, 0.0));
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

  // base shape
  var shape = saturate(s.r);
  shape = contrast01(shape, 1.35);

  // "fbm" from the other channels if present, otherwise still sane
  let fbm_s = saturate(s.g * 0.625 + s.b * 0.25 + s.a * 0.125);

  // treat fbm_s as an erosion threshold for the base shape
  let SNsample = saturate(remap(shape, fbm_s, 1.0, 0.0, 1.0));

  var SA = saturate(heightShape(ph, 1.0));
  let wVar = fract(wm.r * 1.7 + wm.g * 2.3);
  let bulge = 1.0 + 0.22 * (abs(fract(ph * (1.0 + wVar * 1.7)) - 0.5) * 2.0 - 0.5) * 0.5;
  SA = saturate(SA * bulge);

  let gate = weatherCoverageGate(wm);
  let SNnd = saturate(remap(SNsample * SA, gate, 1.0, 0.0, 1.0));

  // detail-driven erosion threshold (stronger than before)
  let DN = detailMod(ph, det);

  // sharper transition from empty -> dense
  var core = saturate(remap(SNnd, DN, 1.0, 0.0, 1.0));
  core = pow(core, 1.35);

  return max(core * densityHeight(ph), 0.0);
}

fn densityMacroFromSamples(ph: f32, wm: vec4<f32>, s: vec4<f32>) -> f32 {
  if (ph < 0.0) { return 0.0; }
  if (wm.b >= 1.0) { return 0.0; }

  var shape = saturate(s.r);
  shape = contrast01(shape, 1.18);

  let fbm_s = saturate(s.g * 0.625 + s.b * 0.25 + s.a * 0.125);
  let SNsample = saturate(remap(shape, fbm_s * 0.68, 1.0, 0.0, 1.0));

  var SA = saturate(heightShape(ph, 1.0));
  let wVar = fract(wm.r * 1.7 + wm.g * 2.3);
  let bulge = 1.0 + 0.18 * (abs(fract(ph * (1.0 + wVar * 1.7)) - 0.5) * 2.0 - 0.5) * 0.5;
  SA = saturate(SA * bulge);

  let gate = weatherCoverageGate(wm);
  let SNnd = saturate(remap(SNsample * SA, gate * 0.88, 1.0, 0.0, 1.0));

  let core = pow(SNnd, 1.1);
  return max(core * densityHeight(ph), 0.0);
}


fn sampleLightingDensity(
  pos: vec3<f32>,
  wm: vec4<f32>,
  lodShape: f32,
  lodDetail: f32
) -> f32 {
  let phL = computePH(pos, wm);
  if (phL < 0.0) { return 0.0; }

  let w = worldWarpXZ(pos.xz, phL, max(B.half.x, B.half.z));
  let s = sampleShapeRGBAWarp(pos, phL, lodShape, w);
  let det = sampleDetailRGBWarp(pos, phL, lodDetail, w);

  var d = densityFromSamples(phL, wm, s, det);
  d *= insideFaceFade(pos, boxMin(), boxMax());
  return max(d, 0.0);
}

fn approxLightingNormal(
  pos: vec3<f32>,
  wm: vec4<f32>,
  lodShape: f32,
  lodDetail: f32
) -> vec3<f32> {
  let probe = max(wg_finestWorld * 0.9, 1e-3);

  let dx =
    sampleLightingDensity(pos + vec3<f32>(probe, 0.0, 0.0), wm, lodShape, lodDetail) -
    sampleLightingDensity(pos - vec3<f32>(probe, 0.0, 0.0), wm, lodShape, lodDetail);

  let dy =
    sampleLightingDensity(pos + vec3<f32>(0.0, probe, 0.0), wm, lodShape, lodDetail) -
    sampleLightingDensity(pos - vec3<f32>(0.0, probe, 0.0), wm, lodShape, lodDetail);

  let dz =
    sampleLightingDensity(pos + vec3<f32>(0.0, 0.0, probe), wm, lodShape, lodDetail) -
    sampleLightingDensity(pos - vec3<f32>(0.0, 0.0, probe), wm, lodShape, lodDetail);

  let g = vec3<f32>(dx, dy, dz);
  if (dot(g, g) < 1e-8) { return vec3<f32>(0.0, 1.0, 0.0); }

  return normalize(-g);
}

fn directionalExposure(
  pos: vec3<f32>,
  wm: vec4<f32>,
  lodShape: f32,
  lodDetail: f32,
  sunDir: vec3<f32>
) -> f32 {
  let probe = max(wg_finestWorld * 2.25, 2e-3);

  let d0 = sampleLightingDensity(pos, wm, lodShape, lodDetail);
  if (d0 <= 1e-5) { return 0.0; }

  let dFront = sampleLightingDensity(pos + sunDir * probe, wm, lodShape, lodDetail);
  let dBack = sampleLightingDensity(pos - sunDir * probe, wm, lodShape, lodDetail);

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
  return mix_f(3.0, 24.0, saturate(max(C.silverExponent, 0.0) / 24.0));
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
  let towardLobe = pow(max(towardSun, 0.08), sharpness);
  let awayLobe = pow(max(awaySun, 0.08), sharpness);
  let directional = mix_f(awayLobe, towardLobe, bias01);
  let angular = max(directional, towardLobe * 0.72);

  let upness = saturate(shapeUp * 0.5 + 0.5);
  let upperExposure = smoothstep(0.52, 0.92, upness);
  let exposedSun = mix_f(0.30, 1.0, pow(saturate(sunVisibility), 0.30));

  let viewEdge = smoothstep(0.14, 0.96, pow(saturate(viewRim), 0.58));
  let lightEdge = smoothstep(0.12, 0.96, pow(saturate(sunRim), 0.78));
  let edge = viewEdge * mix_f(0.22, 1.0, lightEdge) * mix_f(0.18, 1.0, upperExposure);

  let thin = pow(saturate(1.0 - sampleAlpha), 0.72);
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

  let direct = sunVisibility * lightSide * (broadDirect + phaseGlow + reliefDiffuse) * (1.0 - bodyShadow);

  let multiScatter = mix_f(0.16, 0.34, body)
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

  let ambientBase = 0.13 + max(C.ambientMinimum, 0.0) * 0.95;
  let ambientEdgeFill = max(C.outScatterAmbientAmt, 0.0)
    * mix_f(0.22, 1.0, edgeThin)
    * mix_f(0.48, 1.0, 1.0 - bodyShadow);

  let ambientRelief = mix_f(0.0, 0.06, exposedToSun) * mix_f(1.0, 0.76, bodyShadow);
  let ambientHeight = mix_f(0.86, 1.05, saturate(percent_height));
  let ambientVis = AmbientVisibility(density, rawSunVisibility, lightSide, dist_along_ray);
  let ambientOcclusion = 1.0 - bodyShadow * 0.42;
  let ambient = (ambientBase + ambientEdgeFill + ambientRelief) * ambientHeight * ambientVis * ambientOcclusion;

  let bodyLift = 0.052
    * pow(lightSideRaw, 1.02)
    * pow(body, 0.78)
    * mix_f(0.60, 1.0, 1.0 - bodyShadow)
    * mix_f(0.78, 1.0, rawSunVisibility);

  let silverSharpness = SilverSharpness();
  let exposedShell = smoothstep(0.05, 0.82, exposedToSun) * pow(frontShell, 0.48) * mix_f(0.42, 1.0, upperGate);
  let silverBase = SilverPhase(ca, rawSunVisibility, sampleAlpha, rimBoost, sunRim, percent_height, upperGate * 2.0 - 1.0) * exposedShell;
  let sunEdge = pow(saturate(rimBoost * sunRim), 0.42);

  let silverCrest = silverBase
    * mix_f(0.78, 1.12, edgeThin)
    * mix_f(0.78, 1.04, lightSideRaw)
    * mix_f(0.55, 1.0, sunEdge);

  let throughSunGlint = SilverControl()
    * 0.34
    * exposedShell
    * pow(max(towardSun, 0.10), 1.80 + silverSharpness * 0.10)
    * mix_f(0.35, 1.0, sunEdge)
    * mix_f(0.82, 1.0, rawSunVisibility);

  let silver = silverCrest + throughSunGlint;

  let lowSunRaw = 1.0 - saturate((L.sunDir.y + 0.08) / 0.82);
  let lowSun = lowSunRaw * 0.42;

  let sunCol = C.sunColor * mix_v3(vec3<f32>(1.0, 0.98, 0.96), vec3<f32>(1.0, 0.90, 0.84), lowSun);
  let silverCol = mix_v3(vec3<f32>(1.0, 0.985, 0.97), vec3<f32>(1.0, 0.92, 0.89), lowSun);
  let skyCol = mix_v3(vec3<f32>(0.54, 0.64, 0.79), vec3<f32>(0.60, 0.61, 0.82), lowSun * 0.35);
  let shadowCol = mix_v3(vec3<f32>(0.73, 0.79, 0.89), vec3<f32>(0.72, 0.74, 0.87), lowSun * 0.35);

  let directEnergy = direct + multiScatter + forwardWrap + backWrap;
  let silverEnergy = silver + bodyLift * mix_f(0.72, 1.02, pow(towardSun, 1.10));
  let ambientEnergy = ambient;

  let shadowTint = shadowCol * (bodyShadow * 0.14 + reliefShadow * 0.06 + cavityShadow * 0.14);
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

  let gy = (py - c) / probe;
  let gx = (px - nx) * 0.5 / probe;
  let gz = (pz - nz) * 0.5 / probe;

  var n = normalize(vec3<f32>(-gx, -gy, -gz));
  if (length(n) < 1e-4) { return vec3<f32>(0.0, 1.0, 0.0); }
  return n;
}

fn approxShapeNormalFast(pos: vec3<f32>, ph: f32, lodShape: f32) -> vec3<f32> {
  let probe = max(wg_finestWorld * 1.5, 1e-3);
  let c = sampleShapeRGBA(pos, ph, lodShape).r;
  let px = sampleShapeRGBA(pos + vec3<f32>(probe, 0.0, 0.0), ph, lodShape).r;
  let pz = sampleShapeRGBA(pos + vec3<f32>(0.0, 0.0, probe), ph, lodShape).r;
  let py = sampleShapeRGBA(pos + vec3<f32>(0.0, probe, 0.0), ph, lodShape).r;

  let g = vec3<f32>((px - c) / probe, (py - c) / probe, (pz - c) / probe);
  if (dot(g, g) < 1e-8) { return vec3<f32>(0.0, 1.0, 0.0); }
  return normalize(-g);
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

// fade near AABB faces
fn insideFaceFade(p: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>) -> f32 {
  let dmin = p - bmin;
  let dmax = bmax - p;
  let edge = min(dmin, dmax);
  let closest = min(min(edge.x, edge.y), edge.z);
  let soft = max(0.75 * wg_finestWorld, 0.25);
  return saturate(closest / soft);
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

  let lodShape = clamp(lodShapeBase + f32(stepIndex) * 0.35 + 0.50, 0.0, wg_maxMipS);
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
  stepsIn: i32
) -> f32 {
  let steps = max(stepsIn, 1);
  let start = p0 + sunDir * max(TUNE.aabbFaceOffset, EPS);
  let hit = intersectAABB_robust(start, sunDir, boxMin(), boxMax());
  let availableDist = max(hit.y, nominalStepLen * f32(steps));
  let lightStep = clamp(availableDist / f32(steps), max(nominalStepLen * 0.5, TUNE.minStep), max(nominalStepLen * 4.0, TUNE.maxStep));

  var opticalDepth = 0.0;
  var p = start + sunDir * (0.5 * lightStep);

  for (var i: i32 = 0; i < steps; i = i + 1) {
    let d = sampleCloudDensityAt(
      p, weatherLOD, lodShapeBase, lodDetailBase,
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

    let bd = textureDimensions(blueTex, 0);
    wg_blueDim = vec2<f32>(f32(bd.x), f32(bd.y));

    let sd = textureDimensions(shape3D);
    wg_shapeDim = vec3<f32>(f32(sd.x), f32(sd.y), f32(sd.z));

    let dd = textureDimensions(detail3D);
    wg_detailDim = vec3<f32>(f32(dd.x), f32(dd.y), f32(dd.z));

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

  let texelsPerWorld_u = wg_weatherDim.x * abs(wAxis.x) * wScale * invSide;
  let texelsPerWorld_v = wg_weatherDim.y * abs(wAxis.z) * wScale * invSide;
  let fp = max(texelsPerWorld_u, texelsPerWorld_v);

  let weatherLOD_base = clamp(
    log2(max(fp, 1.0)) + TUNE.lodBiasWeather * max(perf.lodBiasMul, 0.0001),
    0.0,
    wg_maxMipW
  );

  // noise and jitter
  let bnPix = sampleBlueScreen(pixI);
  let rand0 = fract(bnPix + 0.61803398875 * f32(reproj.frameIndex));

  // step sizing
  let viewDir = normalize(-rayRd);
  let cosVF = max(dot(rayRd, camFwd), EPS);

  let voxelBound = wg_finestWorld / max(abs(dot(rayRd, basisUp)), 0.15);

  var baseStep = clamp(V.stepBase, TUNE.minStep, TUNE.maxStep);
  baseStep = min(baseStep, voxelBound);
  baseStep = baseStep * mix_f(1.0, 1.0 + TUNE.stepJitter, rand0 * 2.0 - 1.0);

  let entryDepth = dot((rayRo + rayRd * t0) - V.camPos, camFwd);
  let nearFactor = saturate(1.0 - entryDepth / TUNE.nearFluffDist);
  baseStep = clamp(baseStep * mix_f(1.0, TUNE.nearStepScale, nearFactor), TUNE.minStep, TUNE.maxStep);

  let rayExitDepth = max(dot((rayRo + rayRd * t1) - V.camPos, camFwd), entryDepth);
  let rayFarHistoryF = saturate(remap(rayExitDepth, TUNE.farStart, TUNE.farFull, 0.0, 1.0));

  var t = clamp(t0 + (rand0 * TUNE.phaseJitter) * baseStep, t0, t1);

  // lighting setup. rayRd points from camera into the volume, matching the blog-style phase convention.
  let sunDir = normalize(L.sunDir);
  let cosVS = dot(rayRd, sunDir);

  // sun shadowing samples should cover neighboring cloud volume, not only the vertical slab thickness.
  let sunNominalSpan = max(length(B.half * 2.0) * 0.5, EPS);
  let sunStepLen = clamp(
    sunNominalSpan / f32(max(TUNE.sunSteps, 1)),
    TUNE.minStep,
    max(TUNE.maxStep, sunNominalSpan)
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
    if (t >= t1 || Tr < 0.001) { break; }

    let p = rayRo + rayRd * t;
    let sampleViewDepth = max(dot(p - V.camPos, camFwd), 0.0);
    let farF = saturate(remap(sampleViewDepth, TUNE.farStart, TUNE.farFull, 0.0, 1.0));
    let stepLen = clamp(baseStep * mix_f(1.0, TUNE.farStepMult, farF), TUNE.minStep, TUNE.maxStep);
    let weatherLOD = min(wg_maxMipW, weatherLOD_base + TUNE.farLodPush * farF);

    // coarse weather skip
    let subsample = f32(max(reproj.subsample, 1u));
    let coarsePenalty = log2(max(subsample, 1.0));
    var coarseMip = max(0.0, wg_maxMipW - (TUNE.weatherRejectMip + max(perf.coarseMipBias, 0.0) + coarsePenalty));
    coarseMip = min(wg_maxMipW, coarseMip + farF * 1.0);

    // Single weather proxy for this step. Shape/detail volumes carry the high-frequency structure,
    // so this can use the reject mip instead of doing both a coarse and a full weather fetch.
    let uv_coarse = weatherUV_from(p, squareOrigin_xz, invSide, wScale);
    let wm_coarse = wrap2D(weather2D, samp2D, uv_coarse, 0i, clamp(max(weatherLOD, coarseMip), 0.0, wg_maxMipW));

    if (weatherCoverageGate(wm_coarse) >= TUNE.weatherRejectGate) {
      t = min(t + stepLen * TUNE.emptySkipMult, t1);
      prevDens = 0.0;
      prevMacroDens = 0.0;
      prevTsun = 1.0;
      Tsun_cached = 1.0;
      iter = iter + 1;
      continue;
    }

    if (wm_coarse.b >= 1.0) {
      t = min(t + stepLen * 2.0, t1);
      prevDens = 0.0;
      prevMacroDens = 0.0;
      prevTsun = 1.0;
      Tsun_cached = 1.0;
      iter = iter + 1;
      continue;
    }

    let ph_coarse = computePH(p, wm_coarse);
    let quickCoverage = saturate((wm_coarse.r - 0.35) * 2.5);
    if (quickCoverage < 0.01 && (ph_coarse < 0.02)) {
      t = min(t + stepLen * 2.0, t1);
      prevDens = 0.0;
      prevMacroDens = 0.0;
      prevTsun = 1.0;
      Tsun_cached = 1.0;
      iter = iter + 1;
      continue;
    }

    // LOD from step
    let baseLOD = clamp(log2(max(stepLen / wg_finestWorld, 1.0)), 0.0, wg_maxMipS);
    let nearDepth = max(cosVF * (t - t0), 0.0);
    let nearSmooth = pow(saturate(1.0 - nearDepth / TUNE.nearFluffDist), 0.85);

    let lodBias = mix_f(0.0, TUNE.nearLodBias, nearSmooth);
    let lodShapeBase = clamp(baseLOD + lodBias + TUNE.farLodPush * farF, 0.0, wg_maxMipS);
    let lodDetailBase = clamp(baseLOD + lodBias + TUNE.farLodPush * farF, 0.0, wg_maxMipD);

    let wm = wm_coarse;
    let ph = ph_coarse;
    if (ph < 0.0) {
      t = min(t + stepLen * 2.0, t1);
      prevDens = 0.0;
      prevMacroDens = 0.0;
      prevTsun = 1.0;
      Tsun_cached = 1.0;
      iter = iter + 1;
      continue;
    }

    let stepWarp = worldWarpXZ(p.xz, ph, max(B.half.x, B.half.z));

    // mip hysteresis
    let sL: f32 = floor(lodShapeBase);
    let sF: f32 = saturate(lodShapeBase - sL);
    let dL: f32 = floor(lodDetailBase);
    let dF: f32 = saturate(lodDetailBase - dL);

    var s: vec4<f32>;
    if (sF > TUNE.lodBlendThreshold) {
      let s_lo = sampleShapeRGBAWarp(p, ph, sL, stepWarp);
      let s_hi = sampleShapeRGBAWarp(p, ph, min(sL + 1.0, wg_maxMipS), stepWarp);
      s = mix_v4(s_lo, s_hi, sF);
    } else {
      s = sampleShapeRGBAWarp(p, ph, sL, stepWarp);
    }

    let faceFade = insideFaceFade(p, bmin, bmax);
    let nearDense = mix_f(TUNE.nearDensityMult, 1.0, saturate(nearDepth / TUNE.nearDensityRange));

    var densMacro = densityMacroFromSamples(ph, wm, s) * faceFade * nearDense;

    if (densMacro <= 0.00004 && prevMacroDens <= 0.00004) {
      prevDens = 0.0;
      prevMacroDens = 0.0;
      prevTsun = 1.0;
      Tsun_cached = 1.0;
      t = min(t + stepLen * 1.5, t1);
      iter = iter + 1;
      continue;
    }

    let farMacroOnly = saturate(remap(farF, 0.62, 1.0, 0.0, 1.0));
    let denseMacroOnly = saturate(remap(max(densMacro, prevMacroDens), 0.08, 0.26, 0.0, 1.0));
    let macroOnly = (farMacroOnly * denseMacroOnly) > 0.55;

    var det: vec3<f32> = vec3<f32>(0.5, 0.5, 0.5);
    var dens: f32 = densMacro;
    if (!macroOnly) {
      if (dF > TUNE.lodBlendThreshold) {
        let d_lo = sampleDetailRGBWarp(p, ph, dL, stepWarp);
        let d_hi = sampleDetailRGBWarp(p, ph, min(dL + 1.0, wg_maxMipD), stepWarp);
        det = mix_v3(d_lo, d_hi, dF);
      } else {
        det = sampleDetailRGBWarp(p, ph, dL, stepWarp);
      }
      det = mix_v3(det, det * TUNE.farDetailAtten, farF);
      dens = densityFromSamples(ph, wm, s, det) * faceFade * nearDense;
    }

    let bodySmooth = smoothstep(0.08, 0.42, max(densMacro, prevMacroDens));
    let raySmoothDensAdaptive = saturate(mix_f(TUNE.raySmoothDens * 0.30, TUNE.raySmoothDens, bodySmooth));
    let densSmoothed = mix_f(dens, prevDens, raySmoothDensAdaptive);
    let densMacroSmoothed = mix_f(densMacro, prevMacroDens, saturate(raySmoothDensAdaptive * 0.90));

    if (densSmoothed > 0.00008) {
      let shadowInteriorProbe = saturate(remap(densMacroSmoothed, 0.05, 0.32, 0.0, 1.0));
      let adaptiveStrideAdd = i32(floor(farF * 3.0 + shadowInteriorProbe * farF * 2.0));
      let sunStrideSafe = max(TUNE.sunStride + adaptiveStrideAdd, 1);
      if ((iter % sunStrideSafe) == 0) {
        if (densMacroSmoothed * stepLen > TUNE.sunDensityGate) {
          let sunStepsAdaptive = max(2, TUNE.sunSteps - i32(floor(farF * 2.0)) - i32(floor(shadowInteriorProbe * farF * 1.5)));
          let sunStepAdaptive = sunStepLen * mix_f(1.0, 1.35, farF);
          Tsun_cached = sunTransmittance(
            p, sunDir, weatherLOD, lodShapeBase, lodDetailBase, sunStepAdaptive,
            squareOrigin_xz, invSide, wScale, sunStepsAdaptive
          );
        } else {
          Tsun_cached = 1.0;
        }

        let fastLighting = (sunStrideSafe > TUNE.sunStride) || macroOnly || (farF > 0.40);
        if (!fastLighting && sunStrideSafe <= 1) {
          shapeN_cached = approxShapeNormal(p, ph, max(0.0, lodShapeBase));
        } else {
          shapeN_cached = approxShapeNormalFast(p, ph, max(0.0, lodShapeBase + 0.35));
        }

        if (!fastLighting && sunStrideSafe <= 1) {
          let densityN = approxLightingNormal(
            p,
            wm,
            max(0.0, lodShapeBase + 0.65),
            max(0.0, lodDetailBase + 1.25)
          );
          lightN_cached = normalize(mix_v3(shapeN_cached, densityN, mix_f(0.65, 0.25, shadowInteriorProbe)));
          sunExposure_cached = directionalExposure(
            p,
            wm,
            max(0.0, lodShapeBase + 0.50),
            max(0.0, lodDetailBase + 1.00),
            sunDir
          );
        } else {
          lightN_cached = normalize(mix_v3(shapeN_cached, vec3<f32>(0.0, 1.0, 0.0), 0.18 * shadowInteriorProbe));
          sunExposure_cached = saturate(dot(lightN_cached, sunDir) * 0.72 + 0.28);
        }

        rim_cached = pow(1.0 - saturate(dot(lightN_cached, viewDir)), 1.7);

        let sunFacing = saturate(dot(lightN_cached, sunDir));
        sunSide_cached = sunFacing;
        sunRim_cached = pow(1.0 - sunFacing, 1.30);

        upperExposure_cached = smoothstep(
          0.42,
          0.78,
          saturate(lightN_cached.y * 0.5 + 0.5)
        );
      }

      let raySmoothSunAdaptive = saturate(mix_f(TUNE.raySmoothSun * 0.35, TUNE.raySmoothSun, bodySmooth));
      let TsunSmoothed = mix_f(Tsun_cached, prevTsun, raySmoothSunAdaptive);
      let shadowInterior = saturate(remap(densMacroSmoothed, 0.05, 0.32, 0.0, 1.0)) * (1.0 - saturate(TsunSmoothed * 1.35));
      let bnScaled = mix_f(bnPix, bnPix * TUNE.bnFarScale, farF) * mix_f(1.0, 0.18, shadowInterior);

      let rawSampleODFine = densSmoothed * stepLen * VIEW_EXTINCTION_SCALE;
      let rawSampleODMacro = densMacroSmoothed * stepLen * VIEW_EXTINCTION_SCALE;
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

      if (Tr < 0.002) { break; }
    }

    prevDens = densSmoothed;
    prevMacroDens = densMacroSmoothed;
    prevTsun = Tsun_cached;

    t = min(t + stepLen, t1);
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
        tb *= mix_f(1.0, TUNE.farTaaHistoryBoost, rayFarHistoryF);
        tb = clamp(tb * mix_f(1.0, 1.34, bodyStable), 0.0, 0.993);
        tb = max(tb, 0.76 * speckleStable);
        let fastConvLo = mix_f(0.62, 0.76, stableBody);
        let fastConvHi = mix_f(0.84, 0.94, max(stableBody, stableSpeckle));
        let fastConvFloor = mix_f(fastConvLo, fastConvHi, convWarm) * staticConv;
        tb = max(tb, fastConvFloor * mix_f(1.0, 1.08, rayFarHistoryF));
        tb = max(tb, 0.72 * stableBody * convWarm);
        tb = max(tb, 0.84 * stableSpeckle * convWarm);
        tb = clamp(tb, 0.0, 0.996);

        if (reproj.enabled == 1u && reproj.depthTest == 1u) {
          let prevDepth = textureSampleLevel(depthPrev, sampDepth, prevUV, 0.0).r;
          tb *= select(1.0 - saturate(reproj.depthTolerance), 0.25, prevDepth < 1e-6 || prevDepth > 1.0);
        }

        let relBase = mix_f(TUNE.taaRelMax, TUNE.taaRelMin, saturate(stability));
        let relBody = mix_f(relBase, max(TUNE.taaRelMin * 0.60, 0.035), stableBody);
        let rel = relBody * mix_f(1.0, 0.74, rayFarHistoryF);

        let newClampedRGB0 = clamp_luma_to(newCol.rgb, prevCol.rgb, rel, TUNE.taaAbsEps);
        let newClampedRGB = mix_v3(newClampedRGB0, prevCol.rgb, 0.18 * stableSpeckle + 0.10 * stableBody * convWarm);
        let newClamped = vec4<f32>(newClampedRGB, mix_f(newCol.a, prevCol.a, 0.10 * stableBody * convWarm));

        let blended = mix_v4(newClamped, prevCol, tb);
        textureStore(outTex, pixI, frame.layerIndex, blended);
        store_history_full_res_if_owner(pixI, frame.layerIndex, blended);
      }
    }
  } else {
    textureStore(outTex, pixI, frame.layerIndex, newCol);
    store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);
  }
}
