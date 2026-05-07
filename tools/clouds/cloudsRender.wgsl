// cloudsRender.wgsl - preview: world-space camera + directional sun,
// tone-map and composite the cloud layer over a procedural sky.
// Uses explicit-LOD sampling so textureSample* calls are valid in
// non-uniform control flow.

const PI : f32 = 3.141592653589793;
const SUN_UV_RADIUS : f32 = 0.018;
const SUN_GLOW_RADIUS : f32 = 0.075;
const SUN_EDGE_GLOW_RADIUS : f32 = 0.42;

// ---------- I/O ----------
struct RenderParams {
  layerIndex:u32,
  renderQuality:u32,
  _pad1:u32,
  _pad2:u32,

  // camera in world space
  camPos:vec3<f32>, _p3:f32,
  right:vec3<f32>,  _p4:f32,
  up:vec3<f32>,     _p5:f32,
  fwd:vec3<f32>,    _p6:f32,

  // frustum + exposure
  fovY:f32,
  aspect:f32,
  exposure:f32,
  sunBloom:f32,

  sunDir:vec3<f32>, _p7:f32,
  sky:vec3<f32>,    _p8:f32,

  gradeStyle:u32,
  _p9:u32,
  _p10:u32,
  _p11:u32,

  sunColorTint:vec3<f32>, _p12:f32,
  lightTint:vec3<f32>, _p13:f32,
  shadowTint:vec3<f32>, _p14:f32,
  edgeTint:vec3<f32>, _p15:f32,
};
@group(0) @binding(0) var samp : sampler;
@group(0) @binding(1) var tex  : texture_2d_array<f32>;
@group(0) @binding(2) var<uniform> R : RenderParams;

struct VSOut { @builtin(position) pos:vec4<f32>, @location(0) uv:vec2<f32>, };

@vertex
fn vs_main(@builtin(vertex_index) vid:u32)->VSOut {
  var p = array<vec2<f32>,6>(
    vec2<f32>(-1.0,-1.0), vec2<f32>( 1.0,-1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>( 1.0,-1.0), vec2<f32>( 1.0, 1.0)
  );
  var t = array<vec2<f32>,6>(
    vec2<f32>(0.0,1.0), vec2<f32>(1.0,1.0), vec2<f32>(0.0,0.0),
    vec2<f32>(0.0,0.0), vec2<f32>(1.0,1.0), vec2<f32>(1.0,0.0)
  );
  var o : VSOut;
  o.pos = vec4<f32>(p[vid], 0.0, 1.0);
  o.uv  = t[vid];
  return o;
}

// ---------- helpers ----------
fn toneMapFilmic(c:vec3<f32>)->vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c1 = 2.43;
  let d = 0.59;
  let e = 0.14;

  let x = max(c, vec3<f32>(0.0));
  return clamp((x * (a * x + b)) / (x * (c1 * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn luma(c:vec3<f32>)->f32 {
  return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn applyStyleGrade(cIn:vec3<f32>, style:u32, cloudMask:f32)->vec3<f32> {
  var c = clamp(cIn, vec3<f32>(0.0), vec3<f32>(1.0));
  let lum = luma(c);
  let hi = smoothstep(0.42, 0.96, lum);
  let mid = smoothstep(0.10, 0.58, lum) * (1.0 - smoothstep(0.58, 0.90, lum));
  let sh = 1.0 - smoothstep(0.16, 0.48, lum);
  let gradeAmt = mix(0.18, 0.66, clamp(cloudMask, 0.0, 1.0));

  var shadowTint = vec3<f32>(0.96, 0.96, 1.00);
  var midTint = vec3<f32>(1.0, 1.0, 1.0);
  var highTint = vec3<f32>(1.0, 1.0, 1.0);
  var contrast = 1.0;
  var saturation = 1.0;

  if (style == 1u) {
    shadowTint = vec3<f32>(0.68, 0.52, 1.18);
    midTint = vec3<f32>(1.04, 0.84, 0.92);
    highTint = vec3<f32>(1.18, 0.86, 0.68);
    contrast = mix(1.06, 1.16, gradeAmt);
    saturation = mix(1.10, 1.22, gradeAmt);
  } else if (style == 2u) {
    shadowTint = vec3<f32>(0.70, 0.60, 1.06);
    midTint = vec3<f32>(0.96, 0.86, 0.98);
    highTint = vec3<f32>(1.06, 0.92, 1.02);
    contrast = mix(1.06, 1.16, gradeAmt);
    saturation = mix(1.04, 1.12, gradeAmt);
  } else if (style == 3u) {
    shadowTint = vec3<f32>(0.84, 0.90, 1.02);
    midTint = vec3<f32>(0.92, 0.96, 1.00);
    highTint = vec3<f32>(1.02, 1.04, 1.06);
    contrast = mix(1.02, 1.08, gradeAmt);
    saturation = mix(1.00, 1.05, gradeAmt);
  } else if (style == 4u) {
    shadowTint = vec3<f32>(0.07, 0.028, 0.032);
    midTint = vec3<f32>(0.96, 0.70, 0.50);
    highTint = vec3<f32>(1.16, 0.84, 0.50);
    contrast = mix(1.08, 1.16, gradeAmt);
    saturation = mix(1.08, 1.18, gradeAmt);
  } else if (style == 5u) {
    shadowTint = vec3<f32>(0.66, 0.52, 1.08);
    midTint = vec3<f32>(0.98, 0.82, 0.88);
    highTint = vec3<f32>(1.10, 0.88, 0.82);
    contrast = mix(1.08, 1.16, gradeAmt);
    saturation = mix(1.08, 1.18, gradeAmt);
  }

  c = mix(c, c * highTint, (0.24 * hi + 0.08 * mid) * gradeAmt);
  c = mix(c, c * midTint, 0.18 * mid * gradeAmt);
  c = mix(c, c * shadowTint, (0.30 * sh + 0.08 * mid) * gradeAmt);

  let pivot = vec3<f32>(0.50, 0.50, 0.50);
  c = clamp((c - pivot) * contrast + pivot, vec3<f32>(0.0), vec3<f32>(1.0));

  let gray = vec3<f32>(luma(c));
  c = mix(gray, c, saturation);

  if (style == 1u) {
    c += (vec3<f32>(0.020, 0.010, 0.004) * hi + vec3<f32>(0.006, 0.002, 0.026) * sh) * gradeAmt;
  } else if (style == 2u) {
    c += (vec3<f32>(0.008, 0.004, 0.010) * hi + vec3<f32>(0.004, 0.002, 0.018) * sh) * gradeAmt;
  } else if (style == 4u) {
    c += (vec3<f32>(0.018, 0.008, 0.003) * hi + vec3<f32>(0.010, 0.002, 0.014) * sh) * gradeAmt;
  } else if (style == 5u) {
    c += (vec3<f32>(0.010, 0.005, 0.006) * hi + vec3<f32>(0.005, 0.003, 0.018) * sh) * gradeAmt;
  }

  return clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn stableSunHintUV(uvSun: vec2<f32>) -> vec2<f32> {
  return clamp(uvSun, vec2<f32>(-0.18, -0.18), vec2<f32>(1.18, 1.18));
}

fn stableSunProximity(uv: vec2<f32>, uvSun: vec2<f32>, towardSun: f32, fwdDot: f32) -> f32 {
  let sunHint = stableSunHintUV(uvSun);
  let screenNear = exp(-pow(distance(uv, sunHint) / 0.34, 2.0));
  let angular = smoothstep(0.18, 0.985, towardSun);
  let frontHemisphere = smoothstep(-0.10, 0.22, fwdDot);
  let offscreenFloor = 0.28 * angular * frontHemisphere;
  return max(screenNear * frontHemisphere, offscreenFloor);
}

// project a world-space direction onto the screen using camera basis + FOV
fn projectDirToUV(dirWS:vec3<f32>)->vec2<f32> {
  // unchanged
  let sx = dot(dirWS, R.right);
  let sy = dot(dirWS, R.up);
  let sz = dot(dirWS, R.fwd);

  let tanHalfY = tan(0.5 * R.fovY);
  let tanHalfX = tanHalfY * max(R.aspect, 0.000001);

  let invSz = 1.0 / max(sz, 0.000001);
  let ndc = vec2<f32>((sx * invSz) / tanHalfX, (sy * invSz) / tanHalfY);

  return vec2<f32>(0.5 + 0.5 * ndc.x, 0.5 - 0.5 * ndc.y);
}

fn rayDirFromUV(uv:vec2<f32>)->vec3<f32> {
  let ndc = vec2<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let tanHalfY = tan(0.5 * R.fovY);
  let tanHalfX = tanHalfY * max(R.aspect, 0.000001);
  let dir = R.fwd + R.right * (ndc.x * tanHalfX) + R.up * (ndc.y * tanHalfY);
  return normalize(dir);
}

// ---- faster alpha gather: fewer samples, lower LOD, and early-out ----
// - Uses LOD = 1 to sample a smaller mip (cheaper/more cache-friendly).
// - Uses 5 samples (center + 4 cardinal neighbors). You can reduce to 4 if needed.
// - Caller should skip this when sun is far from pixel (d > some threshold) or when clouds are fully opaque/clear.
fn alphaGatherFast(uv:vec2<f32>, layer:i32)->f32 {
  // precomputed radius in uv space
  let r = SUN_UV_RADIUS;
  // quick 5-sample kernel (center + 4)
  let k0 = vec2<f32>(0.0, 0.0);
  let k1 = vec2<f32>( r, 0.0);
  let k2 = vec2<f32>(-r, 0.0);
  let k3 = vec2<f32>(0.0, r);
  let k4 = vec2<f32>(0.0, -r);

  // sample at a lower LOD (1.0) to reduce cost & aggregate over a coarser area
  // note: textureSampleLevel returns a vec4; we only read .a
  var sum = 0.0;
  sum += clamp(textureSampleLevel(tex, samp, uv + k0, layer, 1.0).a, 0.0, 1.0);
  sum += clamp(textureSampleLevel(tex, samp, uv + k1, layer, 1.0).a, 0.0, 1.0);
  sum += clamp(textureSampleLevel(tex, samp, uv + k2, layer, 1.0).a, 0.0, 1.0);
  sum += clamp(textureSampleLevel(tex, samp, uv + k3, layer, 1.0).a, 0.0, 1.0);
  sum += clamp(textureSampleLevel(tex, samp, uv + k4, layer, 1.0).a, 0.0, 1.0);

  return sum * 0.2; // divide by 5
}

fn alphaGradAt(uv:vec2<f32>, layer:i32)->vec2<f32> {
  let dims = vec2<f32>(textureDimensions(tex, 0));
  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));

  let r1 = px * 1.5;
  let r2 = px * 3.0;

  let aL1 = textureSampleLevel(tex, samp, uv - vec2<f32>(r1.x, 0.0), layer, 0.0).a;
  let aR1 = textureSampleLevel(tex, samp, uv + vec2<f32>(r1.x, 0.0), layer, 0.0).a;
  let aD1 = textureSampleLevel(tex, samp, uv - vec2<f32>(0.0, r1.y), layer, 0.0).a;
  let aU1 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, r1.y), layer, 0.0).a;

  let aL2 = textureSampleLevel(tex, samp, uv - vec2<f32>(r2.x, 0.0), layer, 1.0).a;
  let aR2 = textureSampleLevel(tex, samp, uv + vec2<f32>(r2.x, 0.0), layer, 1.0).a;
  let aD2 = textureSampleLevel(tex, samp, uv - vec2<f32>(0.0, r2.y), layer, 1.0).a;
  let aU2 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, r2.y), layer, 1.0).a;

  let g1 = vec2<f32>(aR1 - aL1, aU1 - aD1);
  let g2 = vec2<f32>(aR2 - aL2, aU2 - aD2);

  return g1 * 0.72 + g2 * 0.28;
}

fn alphaGradLite(uv:vec2<f32>, layer:i32)->vec2<f32> {
  let dims = vec2<f32>(textureDimensions(tex, 0));
  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));
  let r = px * 2.0;
  let aL = textureSampleLevel(tex, samp, uv - vec2<f32>(r.x, 0.0), layer, 0.0).a;
  let aR = textureSampleLevel(tex, samp, uv + vec2<f32>(r.x, 0.0), layer, 0.0).a;
  let aD = textureSampleLevel(tex, samp, uv - vec2<f32>(0.0, r.y), layer, 0.0).a;
  let aU = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, r.y), layer, 0.0).a;
  return vec2<f32>(aR - aL, aU - aD);
}

fn alphaOccLite(uv:vec2<f32>, layer:i32)->f32 {
  let dims = vec2<f32>(textureDimensions(tex, 0));
  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));
  let r = px * 3.0;
  let c = textureSampleLevel(tex, samp, uv, layer, 1.0).a;
  let e = textureSampleLevel(tex, samp, uv + vec2<f32>(r.x, 0.0), layer, 1.0).a;
  let w = textureSampleLevel(tex, samp, uv - vec2<f32>(r.x, 0.0), layer, 1.0).a;
  let n = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, r.y), layer, 1.0).a;
  let so = textureSampleLevel(tex, samp, uv - vec2<f32>(0.0, r.y), layer, 1.0).a;
  return clamp(c * 0.42 + (e + w + n + so) * 0.145, 0.0, 1.0);
}

fn alphaOpenTowardSoft(uv:vec2<f32>, dir:vec2<f32>, layer:i32)->f32 {
  let dims = vec2<f32>(textureDimensions(tex, 0));
  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));
  let pix = max(px.x, px.y);
  let lenDir = max(length(dir), 1e-5);
  let d = dir / lenDir;

  let a0 = textureSampleLevel(tex, samp, uv + d * pix * 5.0, layer, 1.0).a;
  let a1 = textureSampleLevel(tex, samp, uv + d * pix * 11.0, layer, 2.0).a;
  let a2 = textureSampleLevel(tex, samp, uv + d * pix * 22.0, layer, 3.0).a;
  let a3 = textureSampleLevel(tex, samp, uv + d * pix * 40.0, layer, 3.0).a;

  let blocking = clamp(max(max(a0, a1 * 0.92), max(a2 * 0.78, a3 * 0.62)), 0.0, 1.0);
  let open = 1.0 - blocking;
  return smoothstep(0.18, 0.86, open);
}

fn alphaReliefStats(uv:vec2<f32>, layer:i32)->vec2<f32> {
  let dims = vec2<f32>(textureDimensions(tex, 0));
  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));

  let r1 = px * 2.0;
  let r2 = px * 4.0;

  let c = textureSampleLevel(tex, samp, uv, layer, 0.0).a;

  let n1 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0,  r1.y), layer, 0.0).a;
  let s1 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, -r1.y), layer, 0.0).a;
  let e1 = textureSampleLevel(tex, samp, uv + vec2<f32>( r1.x, 0.0), layer, 0.0).a;
  let w1 = textureSampleLevel(tex, samp, uv + vec2<f32>(-r1.x, 0.0), layer, 0.0).a;

  let n2 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0,  r2.y), layer, 1.0).a;
  let s2 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, -r2.y), layer, 1.0).a;
  let e2 = textureSampleLevel(tex, samp, uv + vec2<f32>( r2.x, 0.0), layer, 1.0).a;
  let w2 = textureSampleLevel(tex, samp, uv + vec2<f32>(-r2.x, 0.0), layer, 1.0).a;

  let mean1 = (n1 + s1 + e1 + w1) * 0.25;
  let mean2 = (n2 + s2 + e2 + w2) * 0.25;
  let mean = mix(mean1, mean2, 0.35);

  let cavity = clamp(mean - c, 0.0, 1.0);
  let ridge = clamp(c - mean, 0.0, 1.0);
  return vec2<f32>(cavity, ridge);
}

fn alphaReliefStatsFast(centerAlpha:f32, occ:f32, gradLen:f32)->vec2<f32> {
  let cavity = clamp(occ - centerAlpha, 0.0, 1.0);
  let ridge = clamp(centerAlpha - occ + gradLen * 1.75, 0.0, 1.0);
  return vec2<f32>(cavity, ridge);
}

fn silverEdgeBand(alpha: f32) -> f32 {
  let enter = smoothstep(0.035, 0.180, alpha);
  let leave = 1.0 - smoothstep(0.30, 0.62, alpha);
  return enter * leave;
}

fn cloudCoreMask(alpha: f32, occ: f32, edge: f32) -> f32 {
  let body = smoothstep(0.44, 0.92, alpha);
  let dense = smoothstep(0.52, 0.96, occ);
  return body * dense * (1.0 - edge);
}

@fragment
fn fs_main(in:VSOut)->@location(0) vec4<f32> {
  let layer = i32(R.layerIndex);
  let texel = textureSampleLevel(tex, samp, in.uv, layer, 0.0);
  let cloudRGB = texel.rgb;
  let cloudA = clamp(texel.a, 0.0, 1.0);

  let rayDir = rayDirFromUV(in.uv);
  let sunDir = normalize(R.sunDir);
  let uvSun = projectDirToUV(sunDir);

  let v = in.uv.y;
  let horizon = pow(clamp(1.0 - abs(v - 0.5) * 2.0, 0.0, 1.0), 1.25);
  let lowSunRaw = 1.0 - clamp((sunDir.y + 0.08) / 0.82, 0.0, 1.0);
  let lowSun = clamp(pow(lowSunRaw, 0.72) * 1.18, 0.0, 1.0);
  let towardSunSky = clamp(dot(rayDir, sunDir), 0.0, 1.0);

  let style = R.gradeStyle;
  var zenithSky = mix(R.sky * 1.00 + vec3<f32>(0.012, 0.018, 0.032), vec3<f32>(0.58, 0.60, 0.82), lowSun * 0.22);
  var horizonSky = mix(R.sky * 0.70 + vec3<f32>(0.050, 0.060, 0.080), vec3<f32>(0.88, 0.76, 0.82), lowSun * 0.26);
  var sunWash = mix(vec3<f32>(1.0, 0.94, 0.88), vec3<f32>(1.0, 0.86, 0.90), lowSun);
  var sunColor = mix(vec3<f32>(1.0, 0.92, 0.80), vec3<f32>(1.0, 0.86, 0.88), lowSun * 0.35);
  var shadowCool = mix(vec3<f32>(0.92, 0.96, 1.0), vec3<f32>(0.88, 0.90, 0.99), lowSun * 0.30);
  var edgeWarm = mix(vec3<f32>(1.0, 0.97, 0.92), vec3<f32>(1.0, 0.89, 0.91), lowSun * 0.40);
  var litTintBase = vec3<f32>(1.0, 1.0, 1.0);
  var shadowTintBase = vec3<f32>(0.98, 0.99, 1.0);

  if (style == 1u) {
    zenithSky = mix(R.sky * 0.86 + vec3<f32>(0.018, 0.010, 0.048), vec3<f32>(0.32, 0.20, 0.62), lowSun * 0.60);
    horizonSky = mix(R.sky * 0.60 + vec3<f32>(0.090, 0.038, 0.094), vec3<f32>(1.22, 0.46, 0.32), lowSun * 1.00);
    sunWash = mix(vec3<f32>(1.0, 0.94, 0.88), vec3<f32>(1.28, 0.46, 0.32), lowSun * 1.00);
    sunColor = mix(vec3<f32>(1.0, 0.94, 0.86), vec3<f32>(1.26, 0.50, 0.30), lowSun * 1.00);
    shadowCool = mix(vec3<f32>(0.92, 0.96, 1.0), vec3<f32>(0.60, 0.46, 1.02), lowSun * 1.00);
    edgeWarm = mix(vec3<f32>(1.0, 0.97, 0.92), vec3<f32>(1.24, 0.72, 0.48), lowSun * 1.00);
    litTintBase = mix(vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(1.24, 0.88, 0.78), lowSun * 1.00);
    shadowTintBase = mix(vec3<f32>(0.98, 0.99, 1.0), vec3<f32>(0.42, 0.30, 0.94), lowSun * 1.00);
  } else if (style == 2u) {
    zenithSky = mix(R.sky * 0.88 + vec3<f32>(0.014, 0.012, 0.040), vec3<f32>(0.28, 0.22, 0.52), lowSun * 0.70);
    horizonSky = mix(R.sky * 0.64 + vec3<f32>(0.042, 0.040, 0.076), vec3<f32>(0.84, 0.54, 0.82), lowSun * 0.74);
    sunWash = mix(vec3<f32>(0.96, 0.92, 0.96), vec3<f32>(0.98, 0.70, 1.06), lowSun * 0.96);
    sunColor = mix(vec3<f32>(0.98, 0.92, 0.96), vec3<f32>(1.00, 0.74, 1.08), lowSun * 0.90);
    shadowCool = mix(vec3<f32>(0.88, 0.90, 0.99), vec3<f32>(0.66, 0.58, 0.96), lowSun * 1.00);
    edgeWarm = mix(vec3<f32>(0.98, 0.94, 0.98), vec3<f32>(1.02, 0.80, 1.04), lowSun * 0.88);
    litTintBase = mix(vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(1.08, 0.92, 1.04), lowSun * 0.82);
    shadowTintBase = mix(vec3<f32>(0.96, 0.97, 1.0), vec3<f32>(0.52, 0.46, 0.88), lowSun * 1.00);
  } else if (style == 3u) {
    zenithSky = mix(R.sky * 0.94 + vec3<f32>(0.010, 0.016, 0.030), vec3<f32>(0.42, 0.48, 0.62), lowSun * 0.18);
    horizonSky = mix(R.sky * 0.66 + vec3<f32>(0.030, 0.042, 0.060), vec3<f32>(0.62, 0.68, 0.78), lowSun * 0.16);
    sunWash = mix(vec3<f32>(0.90, 0.94, 1.00), vec3<f32>(0.82, 0.88, 0.98), lowSun * 0.20);
    sunColor = mix(vec3<f32>(0.94, 0.96, 1.00), vec3<f32>(0.88, 0.92, 0.98), lowSun * 0.18);
    shadowCool = mix(vec3<f32>(0.90, 0.94, 1.0), vec3<f32>(0.78, 0.84, 0.96), lowSun * 0.42);
    edgeWarm = mix(vec3<f32>(0.96, 0.97, 1.0), vec3<f32>(0.88, 0.90, 0.96), lowSun * 0.22);
    litTintBase = vec3<f32>(0.98, 0.99, 1.0);
    shadowTintBase = vec3<f32>(0.84, 0.89, 0.97);
  } else if (style == 4u) {
    zenithSky = mix(R.sky * 0.78 + vec3<f32>(0.022, 0.012, 0.018), vec3<f32>(0.18, 0.08, 0.14), lowSun * 0.82);
    horizonSky = mix(R.sky * 0.52 + vec3<f32>(0.098, 0.026, 0.028), vec3<f32>(1.12, 0.48, 0.14), lowSun * 0.94);
    sunWash = mix(vec3<f32>(1.02, 0.92, 0.84), vec3<f32>(1.20, 0.52, 0.20), lowSun * 0.90);
    sunColor = mix(vec3<f32>(1.04, 0.92, 0.80), vec3<f32>(1.20, 0.56, 0.18), lowSun * 0.92);
    shadowCool = mix(vec3<f32>(0.74, 0.68, 0.72), vec3<f32>(0.14, 0.06, 0.10), lowSun * 0.98);
    edgeWarm = mix(vec3<f32>(1.02, 0.96, 0.90), vec3<f32>(1.24, 0.68, 0.24), lowSun * 0.96);
    litTintBase = mix(vec3<f32>(1.0, 0.98, 0.94), vec3<f32>(1.22, 0.76, 0.40), lowSun * 0.92);
    shadowTintBase = mix(vec3<f32>(0.24, 0.12, 0.10), vec3<f32>(0.04, 0.015, 0.022), lowSun * 1.00);
  } else if (style == 5u) {
    zenithSky = mix(R.sky * 0.86 + vec3<f32>(0.016, 0.012, 0.034), vec3<f32>(0.30, 0.18, 0.38), lowSun * 0.56);
    horizonSky = mix(R.sky * 0.64 + vec3<f32>(0.054, 0.030, 0.056), vec3<f32>(0.94, 0.52, 0.50), lowSun * 0.72);
    sunWash = mix(vec3<f32>(0.98, 0.92, 0.92), vec3<f32>(1.10, 0.66, 0.64), lowSun * 0.76);
    sunColor = mix(vec3<f32>(1.0, 0.92, 0.90), vec3<f32>(1.10, 0.68, 0.66), lowSun * 0.76);
    shadowCool = mix(vec3<f32>(0.90, 0.90, 1.0), vec3<f32>(0.58, 0.42, 0.96), lowSun * 0.82);
    edgeWarm = mix(vec3<f32>(1.0, 0.96, 0.96), vec3<f32>(1.12, 0.78, 0.86), lowSun * 0.76);
    litTintBase = mix(vec3<f32>(1.0, 0.98, 0.98), vec3<f32>(1.14, 0.84, 0.80), lowSun * 0.78);
    shadowTintBase = mix(vec3<f32>(0.96, 0.97, 1.0), vec3<f32>(0.46, 0.32, 0.90), lowSun * 0.86);
  }

  sunColor *= R.sunColorTint;
  sunWash *= mix(vec3<f32>(1.0, 1.0, 1.0), R.sunColorTint, 0.55);
  shadowCool *= R.shadowTint;
  edgeWarm *= R.edgeTint;
  litTintBase *= R.lightTint;
  shadowTintBase *= R.shadowTint;

  var sky = mix(horizonSky, zenithSky, pow(clamp(v, 0.0, 1.0), 1.35));
  sky += vec3<f32>(0.010, 0.014, 0.025) * horizon;
  sky += sunWash * pow(towardSunSky, 5.0) * mix(0.030, 0.145, lowSun);

  var sunGlow = 0.0;
  var sunDisk = 0.0;
  let fwdDot = dot(sunDir, R.fwd);

  if (fwdDot > 0.0 && all(uvSun >= vec2<f32>(-0.25, -0.25)) && all(uvSun <= vec2<f32>(1.25, 1.25))) {
    let d = distance(in.uv, uvSun);
    if (d <= SUN_GLOW_RADIUS) {
      var centerOcc = 0.0;
      if (d <= SUN_UV_RADIUS * 3.0) {
        centerOcc = alphaGatherFast(uvSun, layer);
      } else {
        centerOcc = textureSampleLevel(tex, samp, uvSun, layer, 2.0).a;
      }

      let localThrough = pow(max(1.0 - cloudA, 0.0), 0.9);
      let centerThrough = pow(max(1.0 - clamp(centerOcc, 0.0, 1.0), 0.0), 1.35);
      let diskGate = smoothstep(SUN_UV_RADIUS * 3.0, SUN_UV_RADIUS * 0.8, d);
      let sunThrough = mix(localThrough, centerThrough, diskGate);

      let core = smoothstep(SUN_UV_RADIUS, SUN_UV_RADIUS * 0.25, d);
      let innerGlow = exp(-pow(d / (SUN_UV_RADIUS * 1.55), 2.0));
      let outerGlow = exp(-pow(d / SUN_GLOW_RADIUS, 2.3));

      sunDisk = core * sunThrough;
      sunGlow = (innerGlow * (0.18 + 0.18 * R.sunBloom) + outerGlow * (0.03 + 0.15 * R.sunBloom)) * sunThrough;
    }
  }

  if (cloudA < 0.003) {
    let clearLinear = sky + sunColor * (1.18 * sunDisk + 0.22 * sunGlow);
    let clearMapped = toneMapFilmic(clearLinear * max(R.exposure * 0.80, 0.0));
    let clearStyled = applyStyleGrade(clearMapped, style, 0.0);
    return vec4<f32>(pow(clearStyled, vec3<f32>(0.99, 0.995, 1.0)), 1.0);
  }

  var sunEdgeSilver = 0.0;
  var bodyShadow = 0.0;
  var cavity = 0.0;
  var ridge = 0.0;
  var surfaceLit = 0.0;
  var gradLenCached = 0.0;
  var occCached = cloudA;

  if (R.renderQuality >= 1u) {
    let grad = alphaGradLite(in.uv, layer);
    let gradLen = length(grad);
    gradLenCached = gradLen;
    let towardSun = clamp(dot(rayDir, sunDir), 0.0, 1.0);
    var facing = 0.0;
    var upperExposure = 0.55;
    if (gradLen > 1e-5) {
      let gradDir = grad / gradLen;
      let outward = -gradDir;
      let toSunScreen = normalize(uvSun - in.uv + vec2<f32>(1e-5, 0.0));
      facing = clamp(dot(outward, toSunScreen), 0.0, 1.0);
      upperExposure = smoothstep(-0.22, 0.52, dot(outward, vec2<f32>(0.0, -1.0)));
    }

    let edge = smoothstep(0.012, 0.065, gradLen);
    let edgeBand = silverEdgeBand(cloudA);
    let occ = alphaOccLite(in.uv, layer);
    occCached = occ;
    let powder = 0.34 + 0.66 * pow(clamp(occ * (1.0 - occ) * 4.0, 0.0, 1.0), 0.72);
    let nearSun = stableSunProximity(in.uv, uvSun, towardSun, fwdDot);
    let forwardCone = smoothstep(0.55, 0.985, towardSun);
    sunEdgeSilver = edge * edgeBand * mix(0.42, 1.0, facing) * powder * nearSun * forwardCone * mix(0.82, 1.0, upperExposure);

    let coreMask = cloudCoreMask(cloudA, occ, edge);
    let awayFromSun = 1.0 - towardSun;
    let surfaceFacing = clamp(mix(upperExposure, facing, 0.62), 0.0, 1.0);
    let fluffySurface = pow(clamp(1.0 - occ * 0.86, 0.0, 1.0), 0.72) * mix(0.64, 1.0, upperExposure);
    surfaceLit = coreMask * smoothstep(0.18, 0.96, surfaceFacing) * fluffySurface * smoothstep(0.08, 0.92, towardSun);
    bodyShadow = coreMask * mix(0.055, 0.18, awayFromSun) * mix(1.0, 0.72, facing) * mix(1.0, 0.78, surfaceLit);
    ridge = edge * edgeBand * (0.42 + 0.22 * surfaceLit);
    cavity = smoothstep(0.55, 0.96, occ) * smoothstep(0.35, 0.98, cloudA) * 0.22;
  } else {
    if (fwdDot > -0.10) {
      let sunHint = stableSunHintUV(uvSun);
      let dSun = distance(in.uv, sunHint);
      let grad = alphaGradAt(in.uv, layer);
      let gradLen = length(grad);
      gradLenCached = gradLen;
      let towardSun = clamp(dot(rayDir, sunDir), 0.0, 1.0);

      var facing = 0.0;
      var openSoft = 1.0;
      var upperExposure = 0.55;
      if (gradLen > 1e-5 && dSun > 1e-5) {
        let toSun = (uvSun - in.uv) / dSun;
        let gradDir = grad / gradLen;
        let outward = -gradDir;
        facing = clamp(dot(outward, toSun), 0.0, 1.0);
        openSoft = alphaOpenTowardSoft(in.uv, toSun, layer);
        upperExposure = smoothstep(-0.22, 0.52, dot(outward, vec2<f32>(0.0, -1.0)));
      }

      let edge = smoothstep(0.016, 0.072, gradLen);
      let edgeBand = silverEdgeBand(cloudA);
      let occ = clamp(alphaGatherFast(in.uv, layer), 0.0, 1.0);
      occCached = occ;
      let powder = 0.34 + 0.66 * pow(clamp(occ * (1.0 - occ) * 4.0, 0.0, 1.0), 0.72);
      let nearSun = stableSunProximity(in.uv, uvSun, towardSun, fwdDot);
      let forwardCone = smoothstep(0.55, 0.985, towardSun);
      let exposedGate = openSoft * mix(0.74, 1.0, upperExposure);

      sunEdgeSilver = edge * edgeBand * facing * powder * nearSun * forwardCone * exposedGate;

      let coreMask = cloudCoreMask(cloudA, occ, edge);
      let sunFacing = smoothstep(0.38, 0.96, towardSun);
      let silhouette = coreMask * sunFacing * nearSun * mix(0.10, 0.32, 1.0 - facing) * smoothstep(0.12, 0.92, 1.0 - openSoft);
      let surfaceFacing = clamp(mix(upperExposure, facing, 0.58), 0.0, 1.0);
      let fluffySurface = pow(clamp(1.0 - occ * 0.82, 0.0, 1.0), 0.76) * mix(0.70, 1.0, openSoft) * mix(0.66, 1.0, upperExposure);
      surfaceLit = coreMask * smoothstep(0.18, 0.94, surfaceFacing) * fluffySurface * sunFacing;
      let awayFromSun = 1.0 - towardSun;
      bodyShadow = (coreMask * mix(0.06, 0.20, awayFromSun) + silhouette) * mix(1.0, 0.80, surfaceLit);
    }

    let relief = alphaReliefStatsFast(cloudA, occCached, gradLenCached);
    cavity = smoothstep(0.015, 0.110, relief.x) * smoothstep(0.22, 0.92, cloudA);
    ridge = smoothstep(0.010, 0.080, relief.y) * smoothstep(0.16, 0.86, cloudA);
  }

  let bodyMask = smoothstep(0.22, 0.92, cloudA);
  let bodyCore = smoothstep(0.48, 0.96, cloudA) * (1.0 - smoothstep(0.010, 0.050, gradLenCached));
  let cavityShadow = cavity * bodyMask * mix(0.08, 0.22, bodyShadow) * mix(1.0, 0.82, bodyCore);
  let ridgeLift = ridge * (1.0 - cavity) * (0.030 + 0.060 * (1.0 - bodyShadow));
  let finalShadow = clamp(bodyShadow + cavityShadow, 0.0, mix(0.72, 0.62, bodyCore));
  let fluffyLight = clamp(surfaceLit * (0.62 + 0.38 * bodyMask) + ridgeLift * 0.52, 0.0, 1.0);
  let softWrap = clamp((1.0 - finalShadow) * (0.28 + 0.72 * fluffyLight) * (0.20 + 0.80 * bodyMask), 0.0, 1.0);

  var styleWarmBoost = 1.0;
  var styleShadowBoost = 1.0;
  var styleShadowColor = 0.16;
  var styleRimBoost = 1.0;
  var styleLightColorMix = 0.08;
  var styleShadowDarkness = 0.10;
  var styleShadowSaturation = 0.10;
  var styleTintStrength = 0.0;
  var styleShadowLift = 0.0;
  var styleBaseBlend = 0.76;
  var midTintBase = mix(litTintBase, shadowTintBase, 0.46);
  var shadowAccent = vec3<f32>(0.66, 0.62, 0.86);
  if (style == 1u) {
    styleWarmBoost = 1.30;
    styleShadowBoost = 1.42;
    styleShadowColor = 0.60;
    styleRimBoost = 1.16;
    styleLightColorMix = 0.18;
    styleShadowDarkness = 0.30;
    styleShadowSaturation = 0.46;
    styleTintStrength = 0.38;
    styleShadowLift = 0.10;
    styleBaseBlend = 0.78;
    midTintBase = vec3<f32>(0.94, 0.72, 0.70) * mix(vec3<f32>(1.0, 1.0, 1.0), R.lightTint, 0.28) * mix(vec3<f32>(1.0, 1.0, 1.0), R.shadowTint, 0.28);
    shadowAccent = vec3<f32>(0.42, 0.28, 0.88);
  } else if (style == 2u) {
    styleWarmBoost = 1.22;
    styleShadowBoost = 1.52;
    styleShadowColor = 0.84;
    styleRimBoost = 1.12;
    styleLightColorMix = 0.18;
    styleShadowDarkness = 0.42;
    styleShadowSaturation = 0.60;
    styleTintStrength = 0.54;
    styleShadowLift = 0.28;
    styleBaseBlend = 0.78;
    midTintBase = vec3<f32>(0.78, 0.58, 0.82) * mix(vec3<f32>(1.0, 1.0, 1.0), R.lightTint, 0.28) * mix(vec3<f32>(1.0, 1.0, 1.0), R.shadowTint, 0.34);
    shadowAccent = vec3<f32>(0.34, 0.24, 0.82);
  } else if (style == 3u) {
    styleWarmBoost = 0.96;
    styleShadowBoost = 1.18;
    styleShadowColor = 0.40;
    styleRimBoost = 0.94;
    styleLightColorMix = 0.07;
    styleShadowDarkness = 0.30;
    styleShadowSaturation = 0.22;
    styleTintStrength = 0.20;
    styleShadowLift = 0.08;
    styleBaseBlend = 0.80;
    midTintBase = vec3<f32>(0.82, 0.84, 0.90) * mix(vec3<f32>(1.0, 1.0, 1.0), R.lightTint, 0.16) * mix(vec3<f32>(1.0, 1.0, 1.0), R.shadowTint, 0.18);
    shadowAccent = vec3<f32>(0.58, 0.62, 0.74);
  } else if (style == 4u) {
    styleWarmBoost = 1.42;
    styleShadowBoost = 1.92;
    styleShadowColor = 1.00;
    styleRimBoost = 1.32;
    styleLightColorMix = 0.18;
    styleShadowDarkness = 0.76;
    styleShadowSaturation = 0.12;
    styleTintStrength = 0.34;
    styleShadowLift = 0.00;
    styleBaseBlend = 0.92;
    midTintBase = vec3<f32>(0.58, 0.20, 0.12) * mix(vec3<f32>(1.0, 1.0, 1.0), R.lightTint, 0.18) * mix(vec3<f32>(1.0, 1.0, 1.0), R.shadowTint, 0.10);
    shadowAccent = vec3<f32>(0.06, 0.01, 0.03);
  } else if (style == 5u) {
    styleWarmBoost = 1.42;
    styleShadowBoost = 1.42;
    styleShadowColor = 0.72;
    styleRimBoost = 1.10;
    styleLightColorMix = 0.18;
    styleShadowDarkness = 0.32;
    styleShadowSaturation = 0.54;
    styleTintStrength = 0.34;
    styleShadowLift = 0.18;
    styleBaseBlend = 0.82;
    midTintBase = vec3<f32>(0.86, 0.66, 0.76) * mix(vec3<f32>(1.0, 1.0, 1.0), R.lightTint, 0.28) * mix(vec3<f32>(1.0, 1.0, 1.0), R.shadowTint, 0.28);
    shadowAccent = vec3<f32>(0.40, 0.26, 0.80);
  }

  let warmPenetrationBase = clamp(1.0 - finalShadow * 1.12 - cavity * 0.42 + sunEdgeSilver * 0.18 + ridgeLift * 0.10 + fluffyLight * 0.18, 0.0, 1.0);
  let warmPenetration = pow(warmPenetrationBase, 1.0 / styleWarmBoost);
  let coolDepth = clamp(bodyCore * 0.34 + finalShadow * 0.88 + cavity * 0.52, 0.0, 1.0);
  let shadowDepth = clamp(finalShadow * styleShadowBoost + cavity * (0.10 + 0.16 * styleShadowColor), 0.0, 1.0);
  let lightMix = clamp(styleLightColorMix + 0.12 * (1.0 - warmPenetration) + styleTintStrength * 0.08, 0.0, 0.82);
  let litTintTarget = mix(litTintBase * sunColor, R.lightTint * sunColor, 0.55 + 0.25 * styleTintStrength);
  let litCloudTint = mix(litTintBase, litTintTarget, clamp(lightMix + styleTintStrength * 0.22, 0.0, 0.94));
  let deepShadowTint = mix(shadowTintBase, shadowAccent * R.shadowTint, clamp(styleShadowSaturation + styleShadowLift * 0.30, 0.0, 0.96));
  let midCloudTint = mix(midTintBase, mix(litCloudTint, deepShadowTint, 0.58), 0.32 + 0.20 * styleShadowColor + 0.12 * styleTintStrength);

  let rawLum = max(luma(cloudRGB), 1e-4);
  let unpremulCloud = cloudRGB / max(cloudA, 0.10);
  let structureLum = clamp(mix(rawLum * 1.12, luma(unpremulCloud), 0.68), 0.04, 1.35);
  let detailTint = clamp(unpremulCloud / max(vec3<f32>(luma(unpremulCloud)), vec3<f32>(0.001)), vec3<f32>(0.72), vec3<f32>(1.28));

  let lightBand = clamp(warmPenetration * (0.54 + 0.46 * bodyMask) + sunEdgeSilver * 0.30 + ridgeLift * 0.20 + fluffyLight * 0.34 + softWrap * 0.16, 0.0, 1.0);
  let darkBand = clamp(shadowDepth * (0.78 + 0.22 * bodyCore) + coolDepth * 0.26 - fluffyLight * 0.14, 0.0, 1.0);
  let midBand = clamp(1.0 - max(lightBand * 0.88, 0.0) - max(darkBand * 0.82, 0.0), 0.0, 1.0);
  let bandSum = max(lightBand + midBand + darkBand, 1e-4);
  let rampTint = (litCloudTint * lightBand + midCloudTint * midBand + deepShadowTint * darkBand) / bandSum;
  let shadowDarken = mix(1.0, 1.0 - styleShadowDarkness, clamp(darkBand * (0.72 + 0.28 * coolDepth), 0.0, 1.0));
  let rampCloud = rampTint * structureLum * shadowDarken * detailTint;
  let retainOriginal = cloudRGB * mix(vec3<f32>(0.16), vec3<f32>(0.30), bodyCore);

  var cloudShaded = mix(retainOriginal, rampCloud, styleBaseBlend);
  cloudShaded *= mix(vec3<f32>(1.0, 1.0, 1.0), shadowCool, clamp(darkBand * (0.24 + 0.56 * styleShadowColor) + cavity * 0.14 + coolDepth * (0.18 + 0.38 * styleShadowColor), 0.0, 1.0));
  cloudShaded = mix(cloudShaded, cloudShaded * deepShadowTint, clamp(darkBand * (0.10 + 0.20 * styleShadowLift) + coolDepth * (0.06 + 0.16 * styleShadowLift), 0.0, 0.42));
  cloudShaded += litCloudTint * lightBand * cloudA * (0.05 + 0.10 * styleTintStrength);
  cloudShaded += mix(litCloudTint, sunColor, 0.30) * fluffyLight * cloudA * (0.04 + 0.06 * styleTintStrength);
  cloudShaded += sunColor * ridgeLift * cloudA * (0.96 + 0.54 * styleLightColorMix + 0.12 * styleTintStrength);
  cloudShaded += edgeWarm * sunEdgeSilver * (0.56 + 0.48 * R.sunBloom) * styleRimBoost;
  cloudShaded += sunColor * sunEdgeSilver * (0.05 + 0.10 * R.sunBloom + 0.12 * styleLightColorMix);
  cloudShaded += midCloudTint * bodyCore * (0.028 + 0.054 * midBand + 0.020 * styleTintStrength);
  cloudShaded += deepShadowTint * coolDepth * bodyCore * (0.036 + 0.090 * styleShadowColor + 0.040 * styleShadowLift);
  if (style == 4u) {
    let fireShadowMix = clamp((pow(darkBand, 1.16) * 0.98 + coolDepth * 0.62 + cavity * 0.56 + max(bodyCore - 0.30, 0.0) * 0.20) * (1.0 - lightBand * 0.97) * (0.40 + 0.60 * bodyCore), 0.0, 1.0);
    let fireShadowTint = mix(vec3<f32>(0.026, 0.010, 0.010), deepShadowTint, 0.24);
    cloudShaded = mix(cloudShaded, cloudShaded * fireShadowTint, fireShadowMix * 0.68);
    let interiorDepth = clamp(bodyCore * (0.56 + 0.44 * darkBand) + cavity * 0.34 - lightBand * 0.42 - sunEdgeSilver * 0.24, 0.0, 1.0);
    let charMix = clamp(interiorDepth * (0.62 + 0.38 * coolDepth), 0.0, 1.0);
    let charTint = mix(vec3<f32>(0.08, 0.02, 0.012), deepShadowTint, 0.16);
    cloudShaded = mix(cloudShaded, cloudShaded * charTint, charMix * 0.46);
    let emberRim = vec3<f32>(1.24, 0.40, 0.10) * edgeWarm;
    let rimHot = clamp(sunEdgeSilver * (0.34 + 0.66 * lightBand) * (1.0 - charMix * 0.50), 0.0, 1.0);
    cloudShaded += emberRim * rimHot * (0.16 + 0.16 * bodyMask);

    let litRecover = clamp(lightBand * (1.0 - darkBand * 0.82) * (0.46 + 0.54 * bodyMask) + ridgeLift * 0.18, 0.0, 1.0);
    let emberFace = mix(vec3<f32>(1.00, 0.24, 0.05), vec3<f32>(1.18, 0.56, 0.12), clamp(warmPenetration * 0.76 + ridgeLift * 0.24, 0.0, 1.0));
    let litSurface = clamp((lightBand * 0.70 + midBand * 0.22 + ridgeLift * 0.90 + max(structureLum - 0.26, 0.0) * 0.18) * (0.30 + 0.70 * bodyMask) * (1.0 - darkBand * 0.82) * (1.0 - charMix * 0.62), 0.0, 1.0);
    let litSurfaceTint = mix(vec3<f32>(0.94, 0.20, 0.05), vec3<f32>(1.18, 0.60, 0.14), clamp(warmPenetration * 0.78 + ridgeLift * 0.30 + sunEdgeSilver * 0.10, 0.0, 1.0));
    let litSurfaceBase = max(cloudShaded, rampCloud * 0.96 + emberFace * 0.08 + litCloudTint * 0.06);
    cloudShaded = mix(cloudShaded, litSurfaceBase + litSurfaceTint * 0.06, litRecover * 0.18 + litSurface * 0.16);

    let surfacePocket = clamp((midBand * 0.56 + cavity * 0.34 + max(0.44 - structureLum, 0.0) * 0.42) * (1.0 - lightBand * 0.64) * (1.0 - charMix * 0.54), 0.0, 1.0);
    cloudShaded = mix(cloudShaded, cloudShaded * vec3<f32>(0.76, 0.46, 0.30), surfacePocket * 0.10);

    let emberBand = clamp((midBand * 0.70 + lightBand * 0.20 + ridgeLift * 0.22) * (0.28 + 0.72 * bodyMask) * (1.0 - charMix * 0.66), 0.0, 1.0);
    let emberGlow = mix(vec3<f32>(0.92, 0.20, 0.04), vec3<f32>(1.16, 0.56, 0.10), clamp(warmPenetration * 0.84 + ridgeLift * 0.28, 0.0, 1.0));
    cloudShaded = mix(cloudShaded, max(cloudShaded, rampCloud * 0.90 + emberGlow * 0.08 + litCloudTint * 0.06), emberBand * 0.18);

    let smokeMid = clamp(midBand * (0.34 + 0.66 * bodyCore) * (0.46 + 0.54 * darkBand) * (1.0 - lightBand * 0.68), 0.0, 1.0);
    cloudShaded = mix(cloudShaded, cloudShaded * vec3<f32>(0.84, 0.56, 0.40), smokeMid * 0.12);
  }
  cloudShaded += sunWash * sunGlow * (0.028 + 0.050 * R.sunBloom);

  var linear = sky * (1.0 - cloudA) + cloudShaded;
  linear += sunColor * (1.18 * sunDisk + (0.22 + 0.24 * R.sunBloom) * sunGlow + (1.20 + 0.18 * R.sunBloom) * sunEdgeSilver);

  let mapped = toneMapFilmic(linear * max(R.exposure * 0.80, 0.0));
  let styled = applyStyleGrade(mapped, style, clamp(cloudA * 1.15 + bodyCore * 0.35, 0.0, 1.0));
  let graded = pow(styled, vec3<f32>(0.99, 0.995, 1.0));
  return vec4<f32>(graded, 1.0);
}
