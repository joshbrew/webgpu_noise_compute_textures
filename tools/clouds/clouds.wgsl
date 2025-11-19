const PI  : f32 = 3.141592653589793;
const EPS : f32 = 1e-6;
const LN2 : f32 = 0.6931471805599453;
const INV_LN2 : f32 = 1.4426950408889634;

// ---------------------- TUNING UNIFORM
struct CloudTuning {
  // Marching
  maxSteps         : i32,
  _pad0_i          : i32,
  minStep          : f32,
  maxStep          : f32,

  // Sun marching
  sunSteps         : i32,
  sunStride        : i32,
  sunMinTr         : f32,
  _pad1_f          : f32,

  // Dither
  phaseJitter      : f32,
  stepJitter       : f32,
  _pad2            : vec2<f32>,

  // Noise warp
  baseJitterFrac   : f32,
  topJitterFrac    : f32,
  _pad3            : vec2<f32>,

  // LOD and bounds
  lodBiasWeather   : f32,
  aabbFaceOffset   : f32,
  _pad4            : vec2<f32>,

  // Weather skipping
  weatherRejectGate: f32,
  weatherRejectMip : f32,
  emptySkipMult    : f32,
  _pad5            : f32,

  // Near tweaks
  nearFluffDist    : f32,
  nearStepScale    : f32,
  nearLodBias      : f32,
  nearDensityMult  : f32,
  nearDensityRange : f32,
  _pad6            : vec3<f32>,

  // LOD blending
  lodBlendThreshold: f32,
  _pad7            : vec3<f32>,

  // Anti-speckle & temporal
  sunDensityGate   : f32,
  fflyRelClamp     : f32,
  fflyAbsFloor     : f32,
  taaRelMin        : f32,
  taaRelMax        : f32,
  taaAbsEps        : f32,
  _pad8            : vec2<f32>,

  // Far-field calm
  farStart         : f32,
  farFull          : f32,
  farLodPush       : f32,
  farDetailAtten   : f32,
  farStepMult      : f32,
  bnFarScale       : f32,
  farTaaHistoryBoost: f32,
  _pad9            : vec2<f32>,

  // On-ray smoothing
  raySmoothDens    : f32,
  raySmoothSun     : f32,
  _pad10           : vec2<f32>,
}
@group(0) @binding(10) var<uniform> TUNE : CloudTuning;

// ---------------------- existing uniforms / resources (preserved layout)
struct CloudOptions {
  useCustomPos : u32,
  outputChannel: u32,
  writeRGB     : u32,
  _p0          : u32,
  _r0          : f32,
  _r1          : f32,
  _r2          : f32,
  _r3          : f32,
}
@group(0) @binding(0) var<uniform> opt : CloudOptions;

struct CloudParams {
  globalCoverage: f32,
  globalDensity : f32,
  cloudAnvilAmount: f32,
  cloudBeer      : f32,
  attenuationClamp: f32,
  inScatterG     : f32,
  silverIntensity: f32,
  silverExponent : f32,
  outScatterG    : f32,
  inVsOut        : f32,
  outScatterAmbientAmt: f32,
  ambientMinimum : f32,
  sunColor       : vec3<f32>,

  densityDivMin  : f32,
  silverDirectionBias: f32,
  silverHorizonBoost : f32,
  _pad0          : f32,
}
@group(0) @binding(1) var<uniform> C : CloudParams;

struct Dummy { _pad: u32, }
@group(0) @binding(2) var<storage, read> unused : Dummy;

struct NoiseTransforms {
  shapeOffsetWorld  : vec3<f32>,
  _pad0             : f32,
  detailOffsetWorld : vec3<f32>,
  _pad1             : f32,
  shapeScale        : f32,
  detailScale       : f32,
  _pad2             : vec2<f32>,
}
@group(0) @binding(3) var<uniform> NTransform : NoiseTransforms;

@group(0) @binding(4) var outTex : texture_storage_2d_array<rgba16float, write>;
@group(0) @binding(5) var<storage, read> posBuf : array<vec4<f32>>;

struct Frame {
  fullWidth : u32, fullHeight: u32,
  tileWidth : u32, tileHeight: u32,
  originX   : i32, originY   : i32, originZ: i32,
  fullDepth : u32, tileDepth : u32,
  layerIndex: i32, layers    : u32,
  _pad0     : u32,
  originXf  : f32, originYf : f32, _pad1: f32, _pad2: f32,
}
@group(0) @binding(6) var<uniform> frame : Frame;

@group(0) @binding(7) var historyOut : texture_storage_2d_array<rgba16float, write>;

struct ReprojSettings {
  enabled : u32,
  subsample: u32,
  sampleOffset: u32,
  motionIsNormalized: u32,
  temporalBlend: f32,
  depthTest: u32,
  depthTolerance: f32,
  frameIndex: u32,
  fullWidth: u32,
  fullHeight: u32,
}
@group(0) @binding(8) var<uniform> reproj : ReprojSettings;

struct PerfParams {
  lodBiasMul : f32,
  coarseMipBias : f32,
  _pad0: f32,
  _pad1: f32,
}
@group(0) @binding(9) var<uniform> perf : PerfParams;

@group(1) @binding(0) var weather2D : texture_2d_array<f32>;
@group(1) @binding(1) var samp2D    : sampler;

@group(1) @binding(2) var shape3D   : texture_3d<f32>;
@group(1) @binding(3) var sampShape : sampler;

@group(1) @binding(4) var blueTex   : texture_2d_array<f32>;
@group(1) @binding(5) var sampBN    : sampler;

@group(1) @binding(6) var detail3D  : texture_3d<f32>;
@group(1) @binding(7) var sampDetail: sampler;

struct LightInputs { sunDir: vec3<f32>, _0: f32, camPos: vec3<f32>, _1: f32, }
@group(1) @binding(8) var<uniform> L : LightInputs;

struct View {
  camPos : vec3<f32>, _v0: f32,
  right  : vec3<f32>, _v1: f32,
  up     : vec3<f32>, _v2: f32,
  fwd    : vec3<f32>, _v3: f32,
  fovY   : f32, aspect: f32, stepBase: f32, stepInc: f32,
  planetRadius: f32, cloudBottom: f32, cloudTop: f32, volumeLayers: f32,
  worldToUV: f32, _a: f32, _b: f32, _c: f32,
}
@group(1) @binding(9) var<uniform> V : View;

struct Box {
  center: vec3<f32>, _b0: f32,
  half: vec3<f32>, uvScale: f32,
}
@group(1) @binding(10) var<uniform> B : Box;

@group(1) @binding(11) var historyPrev : texture_2d_array<f32>;
@group(1) @binding(12) var sampHistory : sampler;

@group(1) @binding(13) var motionTex : texture_2d<f32>;
@group(1) @binding(14) var sampMotion: sampler;

@group(1) @binding(15) var depthPrev : texture_2d<f32>;
@group(1) @binding(16) var sampDepth: sampler;

// Workgroup cache
var<workgroup> wg_weatherDim : vec2<f32>;
var<workgroup> wg_blueDim    : vec2<f32>;
var<workgroup> wg_shapeDim   : vec3<f32>;
var<workgroup> wg_detailDim  : vec3<f32>;
var<workgroup> wg_maxMipW    : f32;
var<workgroup> wg_maxMipS    : f32;
var<workgroup> wg_maxMipD    : f32;
var<workgroup> wg_scaleS     : f32;
var<workgroup> wg_scaleD     : f32;
var<workgroup> wg_finestWorld: f32;

// ---------------------- helpers
fn saturate(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }
fn mix_f(a: f32, b: f32, t: f32) -> f32 { return a * (1.0 - t) + b * t; }
fn mix_v3(a: vec3<f32>, b: vec3<f32>, t: f32) -> vec3<f32> { return a * (1.0 - t) + b * t; }
fn mix_v4(a: vec4<f32>, b: vec4<f32>, t: f32) -> vec4<f32> { return a * (1.0 - t) + b * t; }
fn remap(v: f32, a: f32, b: f32, c: f32, d: f32) -> f32 { return c + (v - a) * (d - c) / max(b - a, EPS); }
fn luminance(c: vec3<f32>) -> f32 { return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722)); }

// tiny hash
fn hash13_i(p: vec3<i32>) -> f32 {
  var h: u32 = 374761393u * u32(p.x) + 668265263u * u32(p.y) + 362437u * u32(p.z);
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h) * 2.3283064365386963e-10;
}
fn smoothCellHash2D(p: vec2<f32>, freq: f32) -> f32 {
  let uv = p * freq;
  let i  = floor(uv);
  let f  = fract(uv);
  let h00 = hash13_i(vec3<i32>(i32(i.x),     i32(i.y),     0));
  let h10 = hash13_i(vec3<i32>(i32(i.x) + 1, i32(i.y),     0));
  let h01 = hash13_i(vec3<i32>(i32(i.x),     i32(i.y) + 1, 0));
  let h11 = hash13_i(vec3<i32>(i32(i.x) + 1, i32(i.y) + 1, 0));
  let u = f * f * (3.0 - 2.0 * f);
  return mix_f(mix_f(h00, h10, u.x), mix_f(h01, h11, u.x), u.y);
}

// texture wrappers
fn wrap2D(tex: texture_2d_array<f32>, samp: sampler, uv: vec2<f32>, layer_idx: i32, lod: f32) -> vec4<f32> {
  let d = wg_weatherDim;
  let ep = vec2<f32>(0.5 / max(d.x, 1.0), 0.5 / max(d.y, 1.0));
  let u  = uv * (vec2<f32>(1.0) - 2.0 * ep) + ep;
  return textureSampleLevel(tex, samp, u, layer_idx, lod);
}
fn wrap3D_shape(tex: texture_3d<f32>, samp: sampler, uvw: vec3<f32>, lod: f32) -> vec4<f32> {
  let d = wg_shapeDim;
  let ep = vec3<f32>(0.5 / max(d.x,1.0), 0.5 / max(d.y,1.0), 0.5 / max(d.z,1.0));
  let u  = uvw * (vec3<f32>(1.0) - 2.0 * ep) + ep;
  return textureSampleLevel(tex, samp, u, lod);
}
fn wrap3D_detail(tex: texture_3d<f32>, samp: sampler, uvw: vec3<f32>, lod: f32) -> vec4<f32> {
  let d = wg_detailDim;
  let ep = vec3<f32>(0.5 / max(d.x, 1.0), 0.5 / max(d.y, 1.0), 0.5 / max(d.z, 1.0));
  let u  = uvw * (vec3<f32>(1.0) - 2.0 * ep) + ep;
  return textureSampleLevel(tex, samp, u, lod);
}

// blue noise
fn sampleBlueScreen(pixI: vec2<i32>) -> f32 {
  let res = vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));
  let bnD = wg_blueDim;
  let uvSS = (vec2<f32>(pixI) + 0.5) / res;
  let uvBN = fract(uvSS * res / bnD);
  return textureSampleLevel(blueTex, sampBN, uvBN, 0i, 0.0).r;
}

// box helpers
fn boxMin() -> vec3<f32> { return B.center - B.half; }
fn boxMax() -> vec3<f32> { return B.center + B.half; }

// robust AABB intersect
fn intersectAABB_robust(ro: vec3<f32>, rd: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>) -> vec2<f32> {
  let rdSafe = select(sign(rd) * vec3<f32>(EPS), rd, vec3<bool>(abs(rd) > vec3<f32>(EPS)));
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
  let norm = max(boxMaxXZ, 1.0);
  let p = pos_xz / norm;
  let warpAmp  = TUNE.baseJitterFrac * boxMaxXZ * 0.5;
  let s1x = smoothCellHash2D(p + vec2<f32>(12.34, 78.9), 4.0);
  let s1y = smoothCellHash2D(p + vec2<f32>(98.7,  6.54), 4.0);
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
fn sampleShapeRGBA(pos: vec3<f32>, ph: f32, lod: f32) -> vec4<f32> {
  let scaleS = max(wg_scaleS, EPS);
  let boxMaxXZ = max(B.half.x, B.half.z);

  let w = worldWarpXZ(pos.xz, ph, boxMaxXZ);

  let pW = vec3<f32>(
    pos.x + w.x + NTransform.shapeOffsetWorld.x,
    pos.y + ph * 7.0 + NTransform.shapeOffsetWorld.y,
    pos.z + w.y + NTransform.shapeOffsetWorld.z
  );

  return wrap3D_shape(shape3D, sampShape, pW * scaleS * NTransform.shapeScale, lod);
}

fn sampleDetailRGB(pos: vec3<f32>, ph: f32, lod: f32) -> vec3<f32> {
  let scaleD = max(wg_scaleD, EPS);
  let boxMaxXZ = max(B.half.x, B.half.z);

  let w = worldWarpXZ(pos.xz, ph, boxMaxXZ);

  let pW = vec3<f32>(
    pos.x + w.x + NTransform.detailOffsetWorld.x,
    pos.y + NTransform.detailOffsetWorld.y,
    pos.z + w.y + NTransform.detailOffsetWorld.z
  );

  return wrap3D_detail(detail3D, sampDetail, pW * scaleD * NTransform.detailScale, lod).rgb;
}


// height shape and density
fn heightShape(ph: f32, wBlue: f32) -> f32 {
  let sr_bottom = saturate(remap(ph, 0.0, 0.07, 0.0, 1.0));
  let stop_h = saturate(wBlue + 0.12);
  let sr_top  = saturate(remap(ph, stop_h * 0.2, stop_h, 1.0, 0.0));
  var base = sr_bottom * sr_top;
  let anvilFactor = saturate(C.cloudAnvilAmount) * saturate(C.globalCoverage);
  let expo = saturate(remap(ph, 0.65, 0.95, 1.0, 1.0 - anvilFactor * 0.9));
  return pow(base, expo);
}
fn computePH(p_world: vec3<f32>, wm: vec4<f32>) -> f32 {
  let boxH = max(B.half.y * 2.0, EPS);
  let jBase = (wm.r * 2.0 - 1.0) * (TUNE.baseJitterFrac * boxH);
  let jTop  = (wm.g * 2.0 - 1.0) * (TUNE.topJitterFrac  * boxH);
  let baseY = (B.center.y - B.half.y) + jBase;
  let topY  = (B.center.y + B.half.y) + jTop;
  return saturate((p_world.y - baseY) / max(topY - baseY, EPS));
}
fn detailMod(ph: f32, d: vec3<f32>) -> f32 {
  let fbm = d.r * 0.625 + d.g * 0.25 + d.b * 0.125;
  return 0.35 * exp(-C.globalCoverage * 0.75) * mix_f(fbm, 1.0 - fbm, saturate(ph * 5.0));
}
fn densityHeight(ph: f32) -> f32 {
  var ret = ph;
  ret *= saturate(remap(ph, 0.0, 0.2, 0.0, 1.0));
  ret *= mix_f(1.0, saturate(remap(sqrt(max(ph,0.0)), 0.4, 0.95, 1.0, 0.2)), saturate(C.cloudAnvilAmount));
  ret *= saturate(remap(ph, 0.9, 1.0, 1.0, 0.0));
  ret *= max(C.globalDensity, 0.0);
  return ret;
}
fn weatherCoverageGate(wm: vec4<f32>) -> f32 {
  let wHi = saturate(remap(C.globalCoverage, 0.0, 1.0, 0.0, 1.0) - 0.5) * wm.g * 2.0;
  let WMc = max(wm.r, wHi);
  return 1.0 - C.globalCoverage * saturate(WMc - opt._r1);
}
fn densityFromSamples(ph: f32, wm: vec4<f32>, s: vec4<f32>, det: vec3<f32>) -> f32 {
  let fbm_s = s.g * 0.625 + s.b * 0.25 + s.a * 0.125 - 1.0;
  let SNsample = remap(s.r, fbm_s, 1.0, 0.0, 1.0);
  var SA = saturate(heightShape(ph, 1.0));
  let wVar = fract(wm.r * 1.7 + wm.g * 2.3);
  let bulge = 1.0 + 0.18 * (abs(fract(ph * (1.0 + wVar * 1.7)) - 0.5) * 2.0 - 0.5) * 0.5;
  SA = saturate(SA * bulge);
  let gate = weatherCoverageGate(wm);
  let SNnd = saturate(remap(SNsample * SA, gate, 1.0, 0.0, 1.0));
  let DN = detailMod(ph, det);
  let core = saturate(remap(SNnd, DN, 1.0, 0.0, 1.0));
  return max(core * densityHeight(ph), 0.0);
}

// phase and lighting
fn HG(cos_angle: f32, g: f32) -> f32 {
  let gg = clamp(g, -0.999, 0.999);
  let g2 = gg * gg;
  return ((1.0 - g2) / pow(1.0 + g2 - 2.0 * gg * clamp(cos_angle, -1.0, 1.0), 1.5)) / (4.0 * PI);
}
// InOutScatter updated to allow silver/backscatter to use abs(cos) so rim/backscatter is visible
fn InOutScatter(cos_angle: f32) -> f32 {
  let first_hg  = HG(cos_angle, C.inScatterG);
  // use absolute cos for silver so both forward/back directions can contribute
  let second_hg = C.silverIntensity * pow(saturate(abs(cos_angle)), C.silverExponent);
  let in_scatter_hg  = max(first_hg, second_hg);
  let out_scatter_hg = HG(cos_angle, -C.outScatterG);
  return mix_f(in_scatter_hg, out_scatter_hg, C.inVsOut);
}
fn Attenuation(density_to_sun: f32, cos_angle: f32) -> f32 {
  let prim = exp2(- (C.cloudBeer * density_to_sun) * INV_LN2);
  let scnd = exp2(- (C.cloudBeer * C.attenuationClamp) * INV_LN2) * 0.7;
  let checkval = remap(clamp(cos_angle, 0.0, 1.0), 0.0, 1.0, scnd, scnd * 0.5);
  return max(checkval, prim);
}
fn OutScatterAmbient(density: f32, percent_height: f32) -> f32 {
  let depth = C.outScatterAmbientAmt * pow(max(density, 0.0), remap(percent_height, 0.3, 0.9, 0.5, 1.0));
  let vertical = pow(saturate(remap(percent_height, 0.0, 0.3, 0.8, 1.0)), 0.8);
  return 1.0 - saturate(depth * vertical);
}

// ---------- helper: approximate surface normal from coarse shape mip
fn approxShapeNormal(pos: vec3<f32>, ph: f32, lodShape: f32) -> vec3<f32> {
  let probe = max(wg_finestWorld * 1.25, 1e-3);
  // central differences along X and Z plus a small Y probe to pick vertical slope
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

// ---------- helper: surface shadow factor (soft) from normal & sun
fn surfaceShadowFactor(n: vec3<f32>, sunDir: vec3<f32>, minLit: f32, exponent: f32) -> f32 {
  let s = saturate(dot(n, sunDir) * 0.5 + 0.5);
  let sPow = pow(s, exponent);
  return mix_f(minLit, 1.0, sPow);
}

fn CalculateLight(density: f32, density_to_sun: f32, cos_angle: f32, percent_height: f32, bluenoise: f32, dist_along_ray: f32, rimBoost: f32) -> vec3<f32> {
  var attenuation = Attenuation(density_to_sun, cos_angle) * InOutScatter(cos_angle) * OutScatterAmbient(density, percent_height);
  let amb_min = density * C.ambientMinimum * (1.0 - pow(saturate(dist_along_ray / 4000.0), 2.0));
  attenuation = max(amb_min, attenuation);
  attenuation = attenuation + bluenoise * 0.0025;
  attenuation = attenuation * (1.0 + 0.35 * rimBoost);
  return attenuation * C.sunColor;
}

// sun march
fn sunSingle(p0: vec3<f32>, sunDir: vec3<f32>, weatherLOD: f32, lodShapeBase: f32, lodDetailBase: f32, stepLen: f32) -> f32 {
  var T = 1.0;
  let parity = f32(i32(reproj.frameIndex % 2u));
  var p = p0 + sunDir * (0.5 * stepLen * parity);
  for (var i: i32 = 0; i < TUNE.sunSteps; i = i + 1) {
    let wm   = wrap2D(weather2D, samp2D, weatherUV_local(p), 0i, weatherLOD);
    let ph   = computePH(p, wm);
    let s    = sampleShapeRGBA(p, ph, lodShapeBase  + f32(i) * 0.5);
    let det  = sampleDetailRGB(p, ph, lodDetailBase + f32(i) * 0.5);
    let d    = densityFromSamples(ph, wm, s, det);
    T *= exp2(- (C.cloudBeer * d * stepLen) * INV_LN2);
    if (T < TUNE.sunMinTr) { break; }
    p += sunDir * stepLen;
  }
  return T;
}
fn sunTransmittance(p: vec3<f32>, sunDir: vec3<f32>, weatherLOD: f32, lodShapeBase: f32, lodDetailBase: f32, stepLen: f32) -> f32 {
  return 0.5 * (sunSingle(p, sunDir, weatherLOD, lodShapeBase, lodDetailBase, stepLen)
              + sunSingle(p, sunDir, weatherLOD, lodShapeBase, lodDetailBase, stepLen));
}

// weather UV
fn weatherUV_local(pos_world: vec3<f32>) -> vec2<f32> {
  let bmin = boxMin();
  let bmax = boxMax();
  let aabb = max(bmax - bmin, vec3<f32>(EPS, EPS, EPS));
  let mul = select(opt._r0, 0.2, opt._r0 == 0.0);
  return ((pos_world.xz - bmin.xz) / max(aabb.xz, vec2<f32>(EPS))) * mul;
}

// quick empty probe
fn weatherProbeEmpty(p_start: vec3<f32>, rd: vec3<f32>, stepLen: f32, nProbes: i32, coarseMip: f32) -> bool {
  var pos = p_start;
  var emptyCount: i32 = 0;
  for (var i: i32 = 0; i < nProbes; i = i + 1) {
    let wm = wrap2D(weather2D, samp2D, weatherUV_local(pos), 0i, coarseMip);
    if (weatherCoverageGate(wm) >= TUNE.weatherRejectGate) { emptyCount = emptyCount + 1; }
    pos = pos + rd * stepLen;
  }
  return (f32(emptyCount) / f32(nProbes)) > 0.66;
}

// reprojection helpers
fn fullPixFromCurrent(pix: vec2<i32>) -> vec2<i32> {
  let res = vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));
  let fullRes = vec2<f32>(f32(reproj.fullWidth), f32(reproj.fullHeight));
  let xf = floor((vec2<f32>(pix) + 0.5) * (fullRes / res));
  return vec2<i32>(i32(clamp(xf.x, 0.0, fullRes.x - 1.0)), i32(clamp(xf.y, 0.0, fullRes.y - 1.0)));
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
fn insideFaceFade(p: vec3<f32>) -> f32 {
  let bmin = boxMin();
  let bmax = boxMax();
  let dmin = p - bmin;
  let dmax = bmax - p;
  let edge = min(dmin, dmax);
  let closest = min(min(edge.x, edge.y), edge.z);
  let soft = max(0.75 * wg_finestWorld, 0.25);
  return saturate(closest / soft);
}

// ---------------------- Main compute
@compute @workgroup_size(8,8,1)
fn computeCloud(@builtin(global_invocation_id) gid_in: vec3<u32>,
                @builtin(local_invocation_id) local_id: vec3<u32>) {

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
    wg_finestWorld = min(1.0 / wg_scaleS, 1.0 / wg_scaleD) * 0.6;
  }
  workgroupBarrier();

  // pixel and guard
  let pixI = vec2<i32>(i32(gid_in.x), i32(gid_in.y)) + vec2<i32>(frame.originX, frame.originY);
  if (pixI.x < 0 || pixI.y < 0 || pixI.x >= i32(frame.fullWidth) || pixI.y >= i32(frame.fullHeight)) { return; }

  // camera basis
  let camFwd = normalize(V.fwd);
  var basisRight = normalize(V.right);
  if (length(basisRight) < EPS) { basisRight = vec3<f32>(1.0,0.0,0.0); }
  var basisUp = normalize(V.up);
  if (length(basisUp) < EPS) { basisUp = vec3<f32>(0.0,1.0,0.0); }

  // ray
  let rayRo = V.camPos;
  let ndc = ((vec2<f32>(pixI) + 0.5) / vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight))) * 2.0 - vec2<f32>(1.0, 1.0);
  let tanY = tan(0.5 * V.fovY);
  let rd_camera = normalize(vec3<f32>(ndc.x * V.aspect * tanY, -ndc.y * tanY, -1.0));
  let rayRd = normalize(basisRight * rd_camera.x + basisUp * rd_camera.y - camFwd * rd_camera.z);

  // intersect volume
  let bmin = boxMin();
  let bmax = boxMax();
  var ti = intersectAABB_robust(rayRo, rayRd, bmin, bmax);
  if (ti.x > ti.y || ti.y <= 0.0) {
    textureStore(outTex, pixI, frame.layerIndex, vec4<f32>(0.0));
    if (reproj.enabled == 1u) { store_history_full_res_if_owner(pixI, frame.layerIndex, vec4<f32>(0.0)); }
    return;
  }
  var t0 = max(ti.x - TUNE.aabbFaceOffset, 0.0);
  var t1 = ti.y + TUNE.aabbFaceOffset;
  if (t0 >= t1) {
    textureStore(outTex, pixI, frame.layerIndex, vec4<f32>(0.0));
    if (reproj.enabled == 1u) { store_history_full_res_if_owner(pixI, frame.layerIndex, vec4<f32>(0.0)); }
    return;
  }

  // precompute weather LOD
  let aabb = max(bmax - bmin, vec3<f32>(EPS, EPS, EPS));
  let mulW = select(opt._r0, 0.2, opt._r0 == 0.0);
  let worldToTex = mulW * vec2<f32>(wg_weatherDim.x / max(aabb.x, EPS), wg_weatherDim.y / max(aabb.z, EPS));
  let fp = max(worldToTex.x, worldToTex.y);
  var weatherLOD_base = clamp(log2(max(fp, 1.0)) + TUNE.lodBiasWeather * max(perf.lodBiasMul, 0.0001), 0.0, wg_maxMipW);

  // noise and jitter
  let bnPix  = sampleBlueScreen(pixI);
  let rand0 = fract(bnPix + 0.61803398875 * f32(reproj.frameIndex));

  // step sizing
  let camF = normalize(-rayRd);
  let cosVF  = max(dot(rayRd, camFwd), EPS);
  let finestWorld = wg_finestWorld;
  let voxelBound  = finestWorld / max(abs(dot(rayRd, basisUp)), 0.15);

  var baseStep = clamp(V.stepBase, TUNE.minStep, TUNE.maxStep);
  baseStep = min(baseStep, voxelBound);
  baseStep = baseStep * mix_f(1.0, 1.0 + TUNE.stepJitter, rand0 * 2.0 - 1.0);

  let entryDepth = dot((rayRo + rayRd * t0) - V.camPos, camFwd);
  let nearFactor = saturate(1.0 - entryDepth / TUNE.nearFluffDist);
  let startShrink = mix_f(1.0, TUNE.nearStepScale, nearFactor);
  baseStep = clamp(baseStep * startShrink, TUNE.minStep, TUNE.maxStep);

  let farF = saturate(remap(entryDepth, TUNE.farStart, TUNE.farFull, 0.0, 1.0));
  baseStep = clamp(baseStep * mix_f(1.0, TUNE.farStepMult, farF), TUNE.minStep, TUNE.maxStep);

  var t = clamp(t0 + (rand0 * TUNE.phaseJitter) * baseStep, t0, t1);

  // lighting setup
  let viewDir  = camF;
  let sunDir   = normalize(L.sunDir);
  let cosVS    = dot(viewDir, sunDir);

  // sun step length
  let halfSpan = 0.5 * max(B.half.y * 2.0, EPS);
  let sunStepLen = min(halfSpan / f32(max(TUNE.sunSteps, 1)), min(1.0/wg_scaleS, 1.0/wg_scaleD) * 0.6 / max(abs(sunDir.y), 0.15));

  let weatherLOD = min(wg_maxMipW, weatherLOD_base + TUNE.farLodPush * farF);

  // accumulators
  var Tr  = 1.0;
  var rgb = vec3<f32>(0.0);
  var Tsun_cached = 1.0;
  var iter: i32 = 0;
  var runMeanL : f32 = 0.0;
  var runN     : f32 = 0.0;
  var prevDens : f32 = 0.0;
  var prevTsun : f32 = 1.0;

  loop {
    if (iter >= TUNE.maxSteps) { break; }
    if (t >= t1 || Tr < 0.001) { break; }

    let p = rayRo + rayRd * t;

    // coarse weather skip
    let subsample = f32(max(reproj.subsample, 1u));
    let coarsePenalty = log2(max(subsample, 1.0));
    var coarseMip = max(0.0, wg_maxMipW - (TUNE.weatherRejectMip + max(perf.coarseMipBias, 0.0) + coarsePenalty));
    coarseMip = min(wg_maxMipW, coarseMip + farF * 1.0);
    if (weatherProbeEmpty(p, rayRd, baseStep * 2.0, 3, coarseMip)) {
      t = min(t + baseStep * TUNE.emptySkipMult, t1);
      iter += 1;
      continue;
    }

    // quick weather density proxy
    let wm_coarse = wrap2D(weather2D, samp2D, weatherUV_local(p), 0i, min(weatherLOD, max(0.0, wg_maxMipW)));
    let ph_coarse = computePH(p, wm_coarse);
    let quickCoverage = saturate((wm_coarse.r - 0.35) * 2.5);
    if (quickCoverage < 0.01 && (ph_coarse < 0.02)) {
      t = min(t + baseStep * 2.0, t1);
      iter += 1;
      continue;
    }

    // LOD from step
    let baseLOD  = clamp(log2(max(baseStep / wg_finestWorld, 1.0)), 0.0, wg_maxMipS);
    let nearDepth = max(cosVF * (t - t0), 0.0);
    let nearSmooth = pow(saturate(1.0 - nearDepth / TUNE.nearFluffDist), 0.85);
    let lodBias  = mix_f(0.0, TUNE.nearLodBias, nearSmooth);
    let lodShapeBase  = clamp(baseLOD + lodBias + TUNE.farLodPush * farF, 0.0, wg_maxMipS);
    let lodDetailBase = clamp(baseLOD + lodBias + TUNE.farLodPush * farF, 0.0, wg_maxMipD);

    // weather full
    let wm  = wrap2D(weather2D, samp2D, weatherUV_local(p), 0i, weatherLOD);
    let ph  = computePH(p, wm);

    // mip hysteresis
    let sL  : f32 = floor(lodShapeBase);
    let sF  : f32 = saturate(lodShapeBase - sL);
    let dL  : f32 = floor(lodDetailBase);
    let dF  : f32 = saturate(lodDetailBase - dL);

    var s   : vec4<f32>;
    if (sF > TUNE.lodBlendThreshold) {
      let s_lo = sampleShapeRGBA(p, ph, sL);
      let s_hi = sampleShapeRGBA(p, ph, min(sL + 1.0, wg_maxMipS));
      s = mix_v4(s_lo, s_hi, sF);
    } else {
      s = sampleShapeRGBA(p, ph, sL);
    }
    var det : vec3<f32>;
    if (dF > TUNE.lodBlendThreshold) {
      let d_lo = sampleDetailRGB(p, ph, dL);
      let d_hi = sampleDetailRGB(p, ph, min(dL + 1.0, wg_maxMipD));
      det = mix_v3(d_lo, d_hi, dF);
    } else {
      det = sampleDetailRGB(p, ph, dL);
    }
    det = mix_v3(det, det * TUNE.farDetailAtten, farF);

    // density
    var dens = densityFromSamples(ph, wm, s, det);
    dens *= insideFaceFade(p);
    let boost = mix_f(TUNE.nearDensityMult, 1.0, saturate(nearDepth / TUNE.nearDensityRange));
    dens *= boost;
    let densSmoothed = mix_f(dens, prevDens, saturate(TUNE.raySmoothDens));

    if (densSmoothed > 0.00008) {
      // cached sun
      if ((iter % TUNE.sunStride) == 0) {
        if (densSmoothed * baseStep > TUNE.sunDensityGate) {
          Tsun_cached = sunTransmittance(p, sunDir, weatherLOD, lodShapeBase, lodDetailBase, sunStepLen);
        } else {
          Tsun_cached = 1.0;
        }
      }
      let TsunSmoothed = mix_f(Tsun_cached, prevTsun, saturate(TUNE.raySmoothSun));

      // rim factor from coarse gradient every cached update to save taps
      var rimF = 0.0;

      let bnScaled = mix_f(bnPix, bnPix * TUNE.bnFarScale, farF);

      // ---------- improved sun-relative shading and silver/backscatter:
      // compute scattering cos using incident light = -sunDir and viewDir
      let cosSL = dot(viewDir, -sunDir);

      // compute base lighting with phase computed from cosSL (incident vs view)
      let lightBase = CalculateLight(densSmoothed, TsunSmoothed, cosSL, ph, bnScaled, t - t0, rimF);

      // approximate coarse surface normal from the shape mip (cheap)
      let shapeNormal = approxShapeNormal(p, ph, max(0.0, lodShapeBase));

      // surface-facing factor
      let minLit = 0.25;      // lower floor so backfacing surfaces still receive ambient scatter
      let shadeExp = 1.15;    // slightly crisper shadow boundary
      let surfShade = surfaceShadowFactor(shapeNormal, sunDir, minLit, shadeExp);

      // occlusion mixing: avoid full blacking-out by mixing an ambient floor
      let occlusion = mix_f(0.6, 1.0, saturate(TsunSmoothed));

      // combine orientation + occlusion with base scatter
      var lightCol = lightBase * surfShade * occlusion;

      // firefly limiter
      let lNow = luminance(lightCol);
      let meanL = select(lNow, runMeanL / max(runN, 1.0), runN > 0.0);
      let allow = max(meanL * (1.0 + TUNE.fflyRelClamp), TUNE.fflyAbsFloor);
      if (lNow > allow) { lightCol *= allow / max(lNow, 1e-6); }

      // integrate
      let alpha = 1.0 - exp2(- (C.cloudBeer * densSmoothed * baseStep) * INV_LN2);
      rgb += Tr * lightCol * alpha;
      Tr  *= (1.0 - alpha);
      if (Tr < 0.002) { break; }

      runMeanL += lNow;
      runN     += 1.0;
    }

    prevDens = densSmoothed;
    prevTsun = Tsun_cached;

    t = min(t + baseStep, t1);
    iter += 1;
  }

  // compose
  var newCol: vec4<f32>;
  if (opt.writeRGB == 1u) {
    newCol = vec4<f32>(rgb, 1.0 - Tr);
  } else {
    let a = 1.0 - Tr;
    if (opt.outputChannel == 0u)      { newCol = vec4<f32>(a, 0.0, 0.0, 1.0); }
    else if (opt.outputChannel == 1u) { newCol = vec4<f32>(0.0, a, 0.0, 1.0); }
    else if (opt.outputChannel == 2u) { newCol = vec4<f32>(0.0, 0.0, a, 1.0); }
    else                              { newCol = vec4<f32>(0.0, 0.0, 0.0, a); }
  }

  // soft fluff + ambient tint
  {
    let a = newCol.a;
    let fluff = clamp(0.28 * a * mix_f(1.0, 1.4, saturate(1.0 - cosVS)), 0.02, 0.50);
    let sunTint = mix_v3(vec3<f32>(0.92, 0.93, 0.96), C.sunColor, saturate(0.5 + 0.5 * cosVS));
    let ambientFill = sunTint * 0.06;
    newCol = vec4<f32>(mix_v3(newCol.rgb, newCol.rgb + ambientFill * a, fluff), smoothstep(0.0, 1.0, a * 1.03));
  }

  // TAA with variance clamp
  if (reproj.enabled == 1u) {
    let fullRes = vec2<f32>(f32(reproj.fullWidth), f32(reproj.fullHeight));
    let uv_full = (vec2<f32>(fullPixFromCurrent(pixI)) + 0.5) / fullRes;

    var motion = textureSampleLevel(motionTex, sampMotion, uv_full, 0.0).rg;
    if (reproj.motionIsNormalized == 0u) { motion = motion / fullRes; }
    let prevUV = uv_full - motion;

    if (prevUV.x < 0.0 || prevUV.y < 0.0 || prevUV.x > 1.0 || prevUV.y > 1.0) {
      textureStore(outTex, pixI, frame.layerIndex, newCol);
      store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);
    } else {
      let prevCol = textureSampleLevel(historyPrev, sampHistory, prevUV, frame.layerIndex, 0.0);
      if (reproj.frameIndex == 0u || prevCol.a < 1e-5 || reproj.temporalBlend <= 0.0001) {
        textureStore(outTex, pixI, frame.layerIndex, newCol);
        store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);
      } else {
        let motionPix = motion * fullRes;
        let motionMag = length(motionPix);
        let alphaDiff = abs(prevCol.a - newCol.a);
        var stability = exp(-motionMag * 0.9) * exp(-alphaDiff * 6.0);
        var tb = clamp(reproj.temporalBlend * stability, 0.0, 0.985);
        tb *= mix_f(1.0, TUNE.farTaaHistoryBoost, farF);

        if (reproj.depthTest == 1u) {
          let prevDepth = textureSampleLevel(depthPrev, sampDepth, prevUV, 0.0).r;
          tb *= select(1.0 - saturate(reproj.depthTolerance), 0.25, prevDepth < 1e-6 || prevDepth > 1.0);
        }

        let relBase = mix_f(TUNE.taaRelMax, TUNE.taaRelMin, saturate(stability));
        let rel     = relBase * mix_f(1.0, 0.80, farF);
        let newClampedRGB = clamp_luma_to(newCol.rgb, prevCol.rgb, rel, TUNE.taaAbsEps);
        let newClamped = vec4<f32>(newClampedRGB, newCol.a);

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

// ---------------------- Auxiliary
fn clamp_luma_to(val: vec3<f32>, refc: vec3<f32>, rel: f32, abs_eps: f32) -> vec3<f32> {
  let tL = luminance(refc);
  let vL = max(luminance(val), 1e-6);
  let hi = tL * (1.0 + rel) + abs_eps;
  let lo = max(tL * (1.0 - rel) - abs_eps, 0.0);
  if (vL > hi) { return val * (hi / vL); }
  if (vL < lo) { return val * (max(lo, 1e-6) / vL); }
  return val;
}
