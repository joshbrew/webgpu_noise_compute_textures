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
  shadowDarkness:f32,
  _pad2:f32,

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
  shadowStrength:f32,
  colorLift:f32,
  saturationBoost:f32,

  sunColorTint:vec3<f32>, _p12:f32,
  lightTint:vec3<f32>, _p13:f32,
  shadowTint:vec3<f32>, _p14:f32,
  edgeTint:vec3<f32>, _p15:f32,
  styleControls:vec4<f32>,
  godRayControls:vec4<f32>,
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

fn sampleCloudFiltered(uv:vec2<f32>, layer:i32)->vec4<f32> {
  return textureSampleLevel(tex, samp, uv, layer, 0.0);
}

fn applyStyleGrade(cIn:vec3<f32>, style:u32, cloudMask:f32)->vec3<f32> {
  var c = clamp(cIn, vec3<f32>(0.0), vec3<f32>(1.0));
  let lum = luma(c);
  let hi = smoothstep(0.56, 0.96, lum);
  let mid = smoothstep(0.16, 0.56, lum) * (1.0 - smoothstep(0.62, 0.92, lum));
  let sh = 1.0 - smoothstep(0.14, 0.44, lum);
  let gradeAmt = mix(0.012, 0.085, clamp(cloudMask, 0.0, 1.0));

  var shadowTint = vec3<f32>(1.0, 1.0, 1.0);
  var midTint = vec3<f32>(1.0, 1.0, 1.0);
  var highTint = vec3<f32>(1.0, 1.0, 1.0);
  var contrast = 1.0;
  var saturation = 1.0;

  if (style == 1u) {
    shadowTint = vec3<f32>(0.92, 0.88, 1.18);
    midTint = vec3<f32>(1.08, 0.96, 1.02);
    highTint = vec3<f32>(1.18, 1.06, 0.78);
    contrast = 1.065;
    saturation = 1.18;
  } else if (style == 2u) {
    shadowTint = vec3<f32>(0.98, 0.96, 1.04);
    midTint = vec3<f32>(1.00, 0.98, 1.02);
    highTint = vec3<f32>(1.02, 0.98, 1.04);
    contrast = 1.02;
    saturation = 1.04;
  } else if (style == 3u) {
    shadowTint = vec3<f32>(0.98, 1.00, 1.02);
    midTint = vec3<f32>(0.99, 1.00, 1.01);
    highTint = vec3<f32>(1.01, 1.02, 1.02);
    contrast = 1.01;
    saturation = 1.01;
  } else if (style == 4u) {
    shadowTint = vec3<f32>(0.98, 0.96, 0.94);
    midTint = vec3<f32>(1.02, 0.98, 0.94);
    highTint = vec3<f32>(1.05, 0.99, 0.92);
    contrast = 1.03;
    saturation = 1.05;
  } else if (style == 5u) {
    shadowTint = vec3<f32>(0.98, 0.96, 1.04);
    midTint = vec3<f32>(1.00, 0.98, 1.00);
    highTint = vec3<f32>(1.03, 0.99, 1.02);
    contrast = 1.02;
    saturation = 1.03;
  }

  c = mix(c, c * highTint, hi * gradeAmt * 0.16);
  c = mix(c, c * midTint, mid * gradeAmt * 0.10);
  c = mix(c, c * shadowTint, sh * gradeAmt * 0.12);

  let pivot = vec3<f32>(0.50, 0.50, 0.50);
  c = clamp((c - pivot) * mix(1.0, contrast, gradeAmt) + pivot, vec3<f32>(0.0), vec3<f32>(1.0));
  let gray = vec3<f32>(luma(c));
  c = mix(gray, c, mix(1.0, saturation, gradeAmt));
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


fn inside01(uv:vec2<f32>)->f32 {
  return select(0.0, 1.0, all(uv >= vec2<f32>(0.0, 0.0)) && all(uv <= vec2<f32>(1.0, 1.0)));
}

fn hash12(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453123);
}

fn sampleAlphaWide(
  uv: vec2<f32>,
  layer: i32,
  lod: f32,
  width: f32,
  dir: vec2<f32>,
  perp: vec2<f32>
) -> f32 {
  let uv0 = clamp(uv, vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999));
  let uv1 = clamp(uv + perp * width, vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999));
  let uv2 = clamp(uv - perp * width, vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999));
  let uv3 = clamp(uv + dir * width * 0.85, vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999));
  let uv4 = clamp(uv - dir * width * 0.55, vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999));

  let a0 = clamp(textureSampleLevel(tex, samp, uv0, layer, lod).a, 0.0, 1.0);
  let a1 = clamp(textureSampleLevel(tex, samp, uv1, layer, lod).a, 0.0, 1.0);
  let a2 = clamp(textureSampleLevel(tex, samp, uv2, layer, lod).a, 0.0, 1.0);
  let a3 = clamp(textureSampleLevel(tex, samp, uv3, layer, lod).a, 0.0, 1.0);
  let a4 = clamp(textureSampleLevel(tex, samp, uv4, layer, lod).a, 0.0, 1.0);

  return clamp(a0 * 0.34 + (a1 + a2) * 0.22 + (a3 + a4) * 0.11, 0.0, 1.0);
}

fn godRayShaft(
  uv: vec2<f32>,
  uvSun: vec2<f32>,
  layer: i32,
  fwdDot: f32,
  towardSun: f32,
  cloudA: f32,
  lowSun: f32
) -> vec2<f32> {
  let enabled = clamp(R.godRayControls.x, 0.0, 1.0);
  let strength = clamp(R.godRayControls.y, 0.0, 3.0) * enabled;
  if (strength <= 0.0001 || fwdDot <= -0.08) {
    return vec2<f32>(0.0, 0.0);
  }

  let sunHint = stableSunHintUV(uvSun);
  let fromSun = uv - sunHint;
  let dist = length(fromSun);
  if (dist <= 1e-5) {
    return vec2<f32>(0.0, 0.0);
  }

  let dir = fromSun / dist;
  let perp = vec2<f32>(-dir.y, dir.x);

  let rayLength = clamp(R.godRayControls.z, 0.10, 2.0);
  let falloff = clamp(R.godRayControls.w, 0.20, 4.0);

  let screenGate = select(
    0.70,
    1.0,
    all(uvSun >= vec2<f32>(-0.25, -0.25)) && all(uvSun <= vec2<f32>(1.25, 1.25))
  ) * smoothstep(-0.08, 0.22, fwdDot);

  if (screenGate <= 0.0001) {
    return vec2<f32>(0.0, 0.0);
  }

  let span = mix(0.52, 1.55, clamp(rayLength * 0.60, 0.0, 1.0));
  let reach = min(dist, span);
  let radialGate = exp(-pow(dist / max(span, 0.001), mix(1.10, 1.58, clamp(falloff * 0.22, 0.0, 1.0))));
  let angularGate = smoothstep(0.08, 0.88, towardSun) * mix(0.68, 1.22, lowSun);

  let horizonFog = pow(clamp(1.0 - abs(uv.y - 0.55) * 2.0, 0.0, 1.0), 0.48);
  let upperFog = pow(clamp(1.0 - uv.y, 0.0, 1.0), 0.30);
  let fogDensity = mix(0.34, 0.92, max(horizonFog, upperFog * 0.42)) * mix(0.74, 1.18, lowSun);

  let localFadeA = pow(max(1.0 - cloudA, 0.0), 1.10);
  let localFadeB = pow(max(1.0 - cloudA, 0.0), 1.95);
  let edgeBand = smoothstep(0.035, 0.22, cloudA) * (1.0 - smoothstep(0.24, 0.62, cloudA));
  let localFade = mix(localFadeA, localFadeB, smoothstep(0.22, 0.82, cloudA)) * (1.0 - 0.62 * edgeBand);

  var samples: u32 = 16u;
  if (R.renderQuality >= 1u) {
    samples = 24u;
  }
  if (R.renderQuality >= 2u) {
    samples = 36u;
  }

  let dims = vec2<f32>(textureDimensions(tex, 0));
  let pix = 1.0 / max(min(dims.x, dims.y), 1.0);
  let jitterCell = floor(uv * dims * 0.35);
  let baseRand = hash12(jitterCell + sunHint * 19.1);
  let stepBase = reach / max(f32(samples), 1.0);
  let windowPre = radialGate * angularGate * screenGate * fogDensity * strength;
  if (windowPre <= 0.00001) {
    return vec2<f32>(0.0, 0.0);
  }

  var transmittance = 1.0;
  var brightAccum = 0.0;
  var blockerAccum = 0.0;
  var edgeAccum = 0.0;
  var weightAccum = 0.0;

  var prevOcc = clamp(textureSampleLevel(
    tex,
    samp,
    clamp(sunHint, vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999)),
    layer,
    2.5
  ).a, 0.0, 1.0);

  for (var i: u32 = 0u; i < 36u; i = i + 1u) {
    if (i >= samples) {
      break;
    }

    let u = (f32(i) + baseRand) / f32(samples);
    let t = pow(u, 0.88);
    let along = reach * t;

    let beamWidth = max(
      mix(0.0048, 0.026, sqrt(t)) *
      mix(0.90, 1.30, lowSun) *
      mix(0.96, 1.20, clamp(dist / max(span, 0.001), 0.0, 1.0)),
      pix * mix(2.0, 5.0, sqrt(t))
    );

    let jitter =
      (hash12(jitterCell + vec2<f32>(f32(i) * 7.13, f32(i) * 3.17)) * 2.0 - 1.0) *
      beamWidth *
      0.18;

    let suv = clamp(
      sunHint + dir * along + perp * jitter,
      vec2<f32>(0.001, 0.001),
      vec2<f32>(0.999, 0.999)
    );

    let lod = mix(3.0, 1.0, t);
    let occ = sampleAlphaWide(suv, layer, lod, beamWidth, dir, perp);
    let edge = abs(occ - prevOcc);

    let stepLen = max(stepBase * mix(0.88, 1.12, t), 1e-4);
    let extinction =
      occ *
      mix(1.45, 2.30, lowSun) *
      mix(0.90, 1.20, smoothstep(0.015, 0.14, edge)) *
      (stepLen / max(stepBase, 1e-4));

    let stepTr = exp(-extinction);

    let scatterW =
      (1.0 - occ) *
      mix(0.62, 0.84, smoothstep(0.015, 0.14, edge)) *
      mix(1.0, 0.86, pow(t, 1.4));

    brightAccum += transmittance * (1.0 - stepTr) * scatterW;
    blockerAccum += (1.0 - stepTr) * mix(0.60, 1.0, t);
    edgeAccum += edge;
    weightAccum += 1.0;

    transmittance *= stepTr;
    prevOcc = occ;

    if (transmittance < 0.01) {
      break;
    }
  }

  let brightBase = brightAccum / max(weightAccum * 0.085, 0.0001);
  let blocker = blockerAccum / max(weightAccum * 0.16, 0.0001);
  let edgeLift = smoothstep(0.016, 0.120, edgeAccum / max(weightAccum, 1.0));

  let shaft = brightBase * mix(0.92, 1.06, edgeLift) * pow(max(transmittance, 0.0), 0.34);
  let shadow = clamp(blocker * mix(0.68, 1.08, edgeLift), 0.0, 1.0);

  return vec2<f32>(
    clamp(shaft * windowPre * localFade, 0.0, 1.0),
    clamp(shadow * windowPre, 0.0, 1.0)
  );
}

@fragment
fn fs_main(in:VSOut)->@location(0) vec4<f32> {
  let layer = i32(R.layerIndex);
  let texel = sampleCloudFiltered(in.uv, layer);
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
    zenithSky = mix(R.sky * 0.92 + vec3<f32>(0.018, 0.012, 0.044), vec3<f32>(0.58, 0.40, 0.74), lowSun * 0.62);
    horizonSky = mix(R.sky * 0.68 + vec3<f32>(0.094, 0.050, 0.070), vec3<f32>(1.12, 0.60, 0.42), lowSun * 0.88);
    sunWash = mix(vec3<f32>(1.0, 0.94, 0.88), vec3<f32>(1.16, 0.68, 0.46), lowSun * 0.86);
    sunColor = mix(vec3<f32>(1.0, 0.96, 0.90), vec3<f32>(1.12, 0.74, 0.52), lowSun * 0.78);
    shadowCool = mix(vec3<f32>(0.94, 0.96, 1.0), vec3<f32>(0.62, 0.56, 0.82), lowSun * 0.84);
    edgeWarm = mix(vec3<f32>(1.0, 0.97, 0.92), vec3<f32>(1.20, 0.84, 0.58), lowSun * 0.82);
    litTintBase = mix(vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(1.20, 0.88, 0.68), lowSun * 0.82);
    shadowTintBase = mix(vec3<f32>(0.96, 0.97, 1.0), vec3<f32>(0.40, 0.34, 0.58), lowSun * 0.86);
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
  } else if (style == 6u) {
    zenithSky = mix(R.sky * 0.82 + vec3<f32>(0.028, 0.020, 0.012), vec3<f32>(0.44, 0.26, 0.14), lowSun * 0.70);
    horizonSky = mix(R.sky * 0.58 + vec3<f32>(0.080, 0.046, 0.020), vec3<f32>(1.04, 0.62, 0.24), lowSun * 0.86);
    sunWash = mix(vec3<f32>(1.04, 0.94, 0.80), vec3<f32>(1.18, 0.72, 0.30), lowSun * 0.86);
    sunColor = mix(vec3<f32>(1.06, 0.94, 0.74), vec3<f32>(1.18, 0.72, 0.34), lowSun * 0.84);
    shadowCool = mix(vec3<f32>(0.82, 0.78, 0.74), vec3<f32>(0.30, 0.16, 0.12), lowSun * 0.88);
    edgeWarm = mix(vec3<f32>(1.04, 0.96, 0.84), vec3<f32>(1.28, 0.82, 0.34), lowSun * 0.88);
    litTintBase = mix(vec3<f32>(1.0, 0.98, 0.90), vec3<f32>(1.22, 0.86, 0.48), lowSun * 0.86);
    shadowTintBase = mix(vec3<f32>(0.72, 0.62, 0.58), vec3<f32>(0.18, 0.08, 0.06), lowSun * 0.90);
  } else if (style == 7u) {
    zenithSky = mix(R.sky * 0.86 + vec3<f32>(0.004, 0.016, 0.034), vec3<f32>(0.10, 0.24, 0.42), lowSun * 0.32);
    horizonSky = mix(R.sky * 0.58 + vec3<f32>(0.008, 0.052, 0.072), vec3<f32>(0.24, 0.64, 0.88), lowSun * 0.42);
    sunWash = mix(vec3<f32>(0.78, 0.96, 1.08), vec3<f32>(0.46, 0.86, 1.12), lowSun * 0.44);
    sunColor = mix(vec3<f32>(0.78, 0.96, 1.12), vec3<f32>(0.42, 0.78, 1.16), lowSun * 0.40);
    shadowCool = mix(vec3<f32>(0.70, 0.86, 1.0), vec3<f32>(0.06, 0.20, 0.36), lowSun * 0.62);
    edgeWarm = mix(vec3<f32>(0.72, 0.98, 1.16), vec3<f32>(0.38, 1.08, 1.38), lowSun * 0.54);
    litTintBase = mix(vec3<f32>(0.94, 0.98, 1.0), vec3<f32>(0.56, 0.96, 1.22), lowSun * 0.56);
    shadowTintBase = mix(vec3<f32>(0.72, 0.84, 1.0), vec3<f32>(0.03, 0.12, 0.26), lowSun * 0.72);
  } else if (style == 8u) {
    zenithSky = mix(R.sky * 0.88 + vec3<f32>(0.004, 0.030, 0.028), vec3<f32>(0.08, 0.38, 0.34), lowSun * 0.50);
    horizonSky = mix(R.sky * 0.62 + vec3<f32>(0.008, 0.074, 0.056), vec3<f32>(0.32, 0.92, 0.64), lowSun * 0.62);
    sunWash = mix(vec3<f32>(0.80, 1.06, 0.96), vec3<f32>(0.50, 1.18, 0.80), lowSun * 0.58);
    sunColor = mix(vec3<f32>(0.84, 1.04, 0.94), vec3<f32>(0.58, 1.16, 0.72), lowSun * 0.56);
    shadowCool = mix(vec3<f32>(0.74, 0.92, 0.94), vec3<f32>(0.04, 0.24, 0.22), lowSun * 0.72);
    edgeWarm = mix(vec3<f32>(0.78, 1.06, 0.96), vec3<f32>(0.38, 1.28, 0.78), lowSun * 0.68);
    litTintBase = mix(vec3<f32>(0.96, 1.0, 0.96), vec3<f32>(0.64, 1.18, 0.82), lowSun * 0.68);
    shadowTintBase = mix(vec3<f32>(0.76, 0.92, 0.92), vec3<f32>(0.04, 0.18, 0.18), lowSun * 0.78);
  } else if (style == 9u) {
    zenithSky = mix(R.sky * 0.90 + vec3<f32>(0.018, 0.018, 0.012), vec3<f32>(0.48, 0.40, 0.24), lowSun * 0.38);
    horizonSky = mix(R.sky * 0.62 + vec3<f32>(0.052, 0.046, 0.026), vec3<f32>(0.92, 0.70, 0.34), lowSun * 0.54);
    sunWash = mix(vec3<f32>(1.0, 0.96, 0.82), vec3<f32>(1.10, 0.88, 0.44), lowSun * 0.58);
    sunColor = mix(vec3<f32>(1.0, 0.96, 0.80), vec3<f32>(1.12, 0.90, 0.50), lowSun * 0.52);
    shadowCool = mix(vec3<f32>(0.84, 0.82, 0.76), vec3<f32>(0.34, 0.28, 0.18), lowSun * 0.64);
    edgeWarm = mix(vec3<f32>(1.02, 0.98, 0.84), vec3<f32>(1.20, 0.98, 0.52), lowSun * 0.60);
    litTintBase = mix(vec3<f32>(1.0, 0.98, 0.90), vec3<f32>(1.18, 0.98, 0.58), lowSun * 0.58);
    shadowTintBase = mix(vec3<f32>(0.72, 0.70, 0.64), vec3<f32>(0.20, 0.16, 0.10), lowSun * 0.68);
  } else if (style == 10u) {
    zenithSky = mix(R.sky * 0.86 + vec3<f32>(0.020, 0.010, 0.024), vec3<f32>(0.34, 0.14, 0.28), lowSun * 0.58);
    horizonSky = mix(R.sky * 0.62 + vec3<f32>(0.064, 0.024, 0.040), vec3<f32>(1.02, 0.46, 0.58), lowSun * 0.74);
    sunWash = mix(vec3<f32>(1.0, 0.88, 0.94), vec3<f32>(1.16, 0.60, 0.76), lowSun * 0.74);
    sunColor = mix(vec3<f32>(1.0, 0.88, 0.94), vec3<f32>(1.12, 0.60, 0.80), lowSun * 0.72);
    shadowCool = mix(vec3<f32>(0.86, 0.82, 0.96), vec3<f32>(0.30, 0.12, 0.34), lowSun * 0.82);
    edgeWarm = mix(vec3<f32>(1.0, 0.92, 0.98), vec3<f32>(1.18, 0.70, 0.96), lowSun * 0.74);
    litTintBase = mix(vec3<f32>(1.0, 0.96, 0.98), vec3<f32>(1.16, 0.78, 0.88), lowSun * 0.76);
    shadowTintBase = mix(vec3<f32>(0.84, 0.78, 0.96), vec3<f32>(0.20, 0.08, 0.28), lowSun * 0.86);
  } else if (style == 11u) {
    zenithSky = mix(R.sky * 0.84 + vec3<f32>(0.004, 0.008, 0.030), vec3<f32>(0.04, 0.10, 0.30), lowSun * 0.22);
    horizonSky = mix(R.sky * 0.58 + vec3<f32>(0.006, 0.014, 0.060), vec3<f32>(0.14, 0.30, 0.74), lowSun * 0.30);
    sunWash = mix(vec3<f32>(0.72, 0.84, 1.10), vec3<f32>(0.38, 0.54, 1.16), lowSun * 0.36);
    sunColor = mix(vec3<f32>(0.74, 0.86, 1.14), vec3<f32>(0.44, 0.58, 1.18), lowSun * 0.34);
    shadowCool = mix(vec3<f32>(0.62, 0.72, 1.0), vec3<f32>(0.02, 0.04, 0.18), lowSun * 0.58);
    edgeWarm = mix(vec3<f32>(0.72, 0.86, 1.18), vec3<f32>(0.38, 0.62, 1.42), lowSun * 0.46);
    litTintBase = mix(vec3<f32>(0.90, 0.94, 1.0), vec3<f32>(0.52, 0.72, 1.28), lowSun * 0.50);
    shadowTintBase = mix(vec3<f32>(0.58, 0.66, 0.96), vec3<f32>(0.015, 0.030, 0.14), lowSun * 0.64);
  }

  let userSunTint = max(R.sunColorTint, vec3<f32>(0.0));
  let userLightTint = max(R.lightTint, vec3<f32>(0.0));
  let userShadowTint = max(R.shadowTint, vec3<f32>(0.0));
  let userEdgeTint = max(R.edgeTint, vec3<f32>(0.0));

  sunColor *= mix(vec3<f32>(1.0, 1.0, 1.0), userSunTint, 0.72);
  sunWash *= mix(vec3<f32>(1.0, 1.0, 1.0), userSunTint, 0.26);

  var sky = mix(horizonSky, zenithSky, pow(clamp(v, 0.0, 1.0), 1.35));
  sky += vec3<f32>(0.010, 0.014, 0.025) * horizon;
  sky += sunWash * pow(towardSunSky, 5.0) * mix(0.020, 0.090, lowSun);

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

  let godRayFog = godRayShaft(in.uv, uvSun, layer, fwdDot, towardSunSky, cloudA, lowSun);
  let godRays = godRayFog.x;
  let godRayShadow = godRayFog.y;
  let godRayColor = mix(sunWash, sunColor, 0.72);

  if (cloudA < 0.003) {
    let clearLinear =
      sky * (1.0 - godRayShadow * (0.16 + 0.34 * lowSun)) +
      sunColor * (1.18 * sunDisk + 0.22 * sunGlow) +
      godRayColor * godRays * (0.40 + 0.86 * lowSun);

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

  let userShadowStrength = clamp(R.shadowStrength, 0.0, 5.00);
  let userColorLift = clamp(R.colorLift, 0.0, 2.20);
  let userSaturation = clamp(R.saturationBoost, 0.0, 2.20);
  let userRimStrength = clamp(R.styleControls.x, 0.0, 2.20);
  let userSunBleed = clamp(R.styleControls.y, 0.0, 2.20);
  let userShadowEdge = clamp(R.styleControls.z, 0.0, 2.20);
  let userMidLift = clamp(R.styleControls.w, 0.0, 2.20);
  let userShadowDarkness = clamp(R.shadowDarkness, 0.0, 6.00);

  var styleLightBoost = 1.00;
  var styleShadowDarkness = 0.22;
  var styleRimBoost = 1.00;
  var styleShadowColorAmt = 0.82;
  var styleBaseMix = 0.86;
  var styleMidLift = 0.10;
  var styleSunInfluence = 0.22;
  if (style == 1u) {
    styleLightBoost = 1.22;
    styleShadowDarkness = 0.26;
    styleRimBoost = 1.18;
    styleShadowColorAmt = 0.96;
    styleBaseMix = 0.94;
    styleMidLift = 0.13;
    styleSunInfluence = 0.08;
  } else if (style == 2u) {
    styleLightBoost = 1.05;
    styleShadowDarkness = 0.28;
    styleRimBoost = 1.03;
    styleShadowColorAmt = 0.92;
    styleBaseMix = 0.91;
    styleMidLift = 0.16;
    styleSunInfluence = 0.12;
  } else if (style == 3u) {
    styleLightBoost = 0.98;
    styleShadowDarkness = 0.18;
    styleRimBoost = 0.96;
    styleShadowColorAmt = 0.80;
    styleBaseMix = 0.84;
    styleMidLift = 0.08;
    styleSunInfluence = 0.08;
  } else if (style == 4u) {
    styleLightBoost = 1.14;
    styleShadowDarkness = 0.46;
    styleRimBoost = 1.14;
    styleShadowColorAmt = 0.96;
    styleBaseMix = 0.94;
    styleMidLift = 0.06;
    styleSunInfluence = 0.16;
  } else if (style == 5u) {
    styleLightBoost = 1.06;
    styleShadowDarkness = 0.30;
    styleRimBoost = 1.05;
    styleShadowColorAmt = 0.92;
    styleBaseMix = 0.91;
    styleMidLift = 0.15;
    styleSunInfluence = 0.12;
  } else if (style == 6u) {
    styleLightBoost = 1.16;
    styleShadowDarkness = 0.38;
    styleRimBoost = 1.12;
    styleShadowColorAmt = 0.94;
    styleBaseMix = 0.92;
    styleMidLift = 0.10;
    styleSunInfluence = 0.14;
  } else if (style == 7u) {
    styleLightBoost = 0.98;
    styleShadowDarkness = 0.34;
    styleRimBoost = 1.18;
    styleShadowColorAmt = 0.92;
    styleBaseMix = 0.90;
    styleMidLift = 0.12;
    styleSunInfluence = 0.10;
  } else if (style == 8u) {
    styleLightBoost = 1.08;
    styleShadowDarkness = 0.28;
    styleRimBoost = 1.20;
    styleShadowColorAmt = 0.90;
    styleBaseMix = 0.90;
    styleMidLift = 0.16;
    styleSunInfluence = 0.10;
  } else if (style == 9u) {
    styleLightBoost = 1.00;
    styleShadowDarkness = 0.42;
    styleRimBoost = 1.02;
    styleShadowColorAmt = 0.96;
    styleBaseMix = 0.93;
    styleMidLift = 0.06;
    styleSunInfluence = 0.12;
  } else if (style == 10u) {
    styleLightBoost = 1.10;
    styleShadowDarkness = 0.36;
    styleRimBoost = 1.10;
    styleShadowColorAmt = 0.94;
    styleBaseMix = 0.92;
    styleMidLift = 0.13;
    styleSunInfluence = 0.12;
  } else if (style == 11u) {
    styleLightBoost = 0.92;
    styleShadowDarkness = 0.48;
    styleRimBoost = 1.06;
    styleShadowColorAmt = 0.98;
    styleBaseMix = 0.94;
    styleMidLift = 0.05;
    styleSunInfluence = 0.10;
  }

  let shadowTintTarget = max(mix(shadowTintBase, userShadowTint, styleShadowColorAmt), vec3<f32>(0.015, 0.015, 0.015));
  let litTintTarget = max(mix(litTintBase, userLightTint, 0.86), vec3<f32>(0.02, 0.02, 0.02));
  let litCloudTint = litTintTarget * mix(vec3<f32>(1.0, 1.0, 1.0), sunColor, styleSunInfluence);
  let coolAmbientTint = mix(shadowTintTarget, shadowTintTarget * max(R.sky + vec3<f32>(0.10, 0.11, 0.16), vec3<f32>(0.20, 0.20, 0.24)), 0.28);
  let sunsetMidMix = select(mix(0.58, 0.76, bodyCore), mix(0.70, 0.84, bodyCore), style == 1u);
  let midCloudTint = mix(litCloudTint, coolAmbientTint, sunsetMidMix);
  let rimTint = max(mix(edgeWarm, userEdgeTint, 0.82), vec3<f32>(0.02, 0.02, 0.02)) * mix(vec3<f32>(1.0, 1.0, 1.0), sunColor, 0.10);

  let rawLum = max(luma(cloudRGB), 1e-4);
  let unpremulCloud = cloudRGB / max(cloudA, 0.08);
  let unpremulLum = max(luma(unpremulCloud), 1e-4);
  let opticalDepth = clamp(cloudA * 0.86 + occCached * 0.34 + bodyCore * 0.26, 0.0, 1.0);
  let imageCavity = clamp(1.0 - smoothstep(0.16, 0.72, unpremulLum), 0.0, 1.0) * smoothstep(0.18, 0.84, cloudA);
  let baseBodyLum = clamp(mix(rawLum * 1.18, unpremulLum * cloudA, 0.62), 0.025, 1.45);
  let detailTint = mix(vec3<f32>(1.0, 1.0, 1.0), clamp(unpremulCloud / max(vec3<f32>(unpremulLum), vec3<f32>(0.001)), vec3<f32>(0.92), vec3<f32>(1.08)), 0.18);

  let directSurface = clamp(surfaceLit * (0.72 + 0.28 * bodyMask) + ridgeLift * 0.64 + softWrap * 0.18, 0.0, 1.0);
  let rimBand = clamp(sunEdgeSilver * (0.62 + 0.38 * (1.0 - bodyCore)), 0.0, 1.0);
  let lightBand = clamp(directSurface * (1.0 - cavity * 0.42) + ridgeLift * 0.48 + rimBand * 0.16, 0.0, 1.0);
  let lightBlock = clamp(1.0 - lightBand * 0.88 - rimBand * 0.36, 0.0, 1.0);
  let shadowRaw = (finalShadow * 0.76 + cavity * 0.30 + imageCavity * 0.40 + opticalDepth * lightBlock * 0.34) * (0.66 + 0.20 * bodyCore);
  let shadowSoftBand = clamp(shadowRaw * userShadowStrength, 0.0, 1.0);
  let shadowEdgeAmt = clamp(userShadowEdge / 2.20, 0.0, 1.0);
  let shadowHardLo = mix(0.04, 0.30, shadowEdgeAmt);
  let shadowHardHi = mix(0.96, 0.58, shadowEdgeAmt);
  let shadowHardBand = smoothstep(shadowHardLo, max(shadowHardLo + 0.05, shadowHardHi), shadowSoftBand);
  let shadowBand = mix(shadowSoftBand, shadowHardBand, shadowEdgeAmt);
  let midBand = clamp((1.0 - lightBand * 0.66) * (1.0 - shadowBand * 0.44) * (0.50 + 0.50 * opticalDepth), 0.0, 1.0);
  let highlightBand = clamp(lightBand * (1.0 - shadowBand * 0.42) + rimBand * 0.24, 0.0, 1.0);

  let paletteBody = mix(midCloudTint, litCloudTint, highlightBand);
  let shadowBodyDarkness = clamp(styleShadowDarkness + userShadowDarkness * 0.16, 0.0, 1.35);
  let shadowBody = coolAmbientTint * (0.64 + 0.34 * baseBodyLum) * max(0.0, 1.0 - shadowBodyDarkness * clamp(shadowBand, 0.0, 1.0));
  let bodyTint = mix(paletteBody, shadowBody, clamp(shadowBand * 0.70, 0.0, 0.88));
  let retainedShape = vec3<f32>(baseBodyLum) * mix(0.68, 0.96, highlightBand) * mix(1.0, 0.82, shadowBand);

  var cloudShaded = mix(cloudRGB * vec3<f32>(0.18), bodyTint * retainedShape * detailTint, styleBaseMix);
  cloudShaded += litCloudTint * cloudA * highlightBand * (0.060 + 0.080 * styleLightBoost) * (1.0 - shadowBand * 0.62);
  cloudShaded += midCloudTint * cloudA * midBand * styleMidLift * userMidLift * select(1.0, 0.78, style == 1u);
  cloudShaded += rimTint * rimBand * (0.40 + 0.30 * R.sunBloom) * styleRimBoost * userRimStrength;
  cloudShaded += sunColor * cloudA * (fluffyLight * 0.026 + ridgeLift * 0.034 + softWrap * 0.014) * (1.0 - shadowBand * 0.90) * userSunBleed;
  cloudShaded = mix(cloudShaded, shadowBody * baseBodyLum, clamp(shadowBand * 0.22 + imageCavity * 0.10, 0.0, 0.48));

  let liftBand = clamp(midBand * 0.60 + highlightBand * 0.36 + (1.0 - shadowBand) * 0.12, 0.0, 1.0);
  let liftTint = mix(midCloudTint, litCloudTint, clamp(highlightBand * 0.58 + softWrap * 0.20, 0.0, 1.0));
  cloudShaded += liftTint * cloudA * liftBand * (0.040 + 0.075 * userColorLift);
  let shadedLum = luma(cloudShaded);
  cloudShaded = clamp(mix(vec3<f32>(shadedLum), cloudShaded, userSaturation), vec3<f32>(0.0), vec3<f32>(8.0));

  if (style == 4u) {
    let charMix = clamp(shadowBand * (0.92 + 0.08 * bodyCore) * (1.0 - highlightBand * 0.70), 0.0, 1.0);
    let charTint = mix(vec3<f32>(0.075, 0.042, 0.034), shadowTintTarget, 0.44);
    cloudShaded = mix(cloudShaded, cloudShaded * charTint, charMix * 0.36 * userShadowStrength);

    let litRecover = clamp(highlightBand * (1.0 - shadowBand * 0.78) * (0.32 + 0.68 * bodyMask) + rimBand * 0.18, 0.0, 1.0);
    let emberTint = mix(vec3<f32>(0.90, 0.24, 0.05), vec3<f32>(1.12, 0.54, 0.14), clamp(highlightBand + rimBand, 0.0, 1.0));
    cloudShaded += emberTint * cloudA * litRecover * 0.056 * userColorLift;
  }

  let sunLeak = (1.0 - shadowBand * 0.92) * (0.42 + 0.58 * (1.0 - bodyCore)) * userSunBleed;
  cloudShaded += sunWash * sunGlow * (0.008 + 0.014 * R.sunBloom) * sunLeak;

  let shadowDarknessNorm = clamp(userShadowDarkness / 6.0, 0.0, 1.0);
  let shadowDarknessBase = clamp(shadowBand * (0.58 + 0.42 * opticalDepth) + imageCavity * 0.24 + cavity * 0.18, 0.0, 1.0);
  let shadowDarknessBand = clamp(pow(shadowDarknessBase, mix(1.35, 0.42, shadowDarknessNorm)) * userShadowDarkness, 0.0, 1.0);
  let shadowDarknessFloor = mix(1.0, 0.012, shadowDarknessBand);
  cloudShaded *= vec3<f32>(shadowDarknessFloor);

  let skyMask = max(1.0 - cloudA, 0.0);
  let skyFogMask = pow(skyMask, 0.90);
  let edgeAlphaBand = smoothstep(0.03, 0.20, cloudA) * (1.0 - smoothstep(0.22, 0.58, cloudA));
  let rayBodyMask =
    pow(max(1.0 - max(cloudA, occCached), 0.0), 1.95) *
    pow(max(1.0 - cloudA, 0.0), 0.65) *
    (1.0 - 0.90 * bodyCore) *
    (1.0 - 0.72 * edgeAlphaBand) *
    mix(1.0, 0.72, shadowBand);

  var linear =
    sky * skyMask * (1.0 - godRayShadow * (0.13 + 0.30 * lowSun) * skyFogMask) +
    cloudShaded;

  linear += sunColor * (
    1.04 * sunDisk +
    (0.095 + 0.085 * R.sunBloom) * sunGlow * userSunBleed +
    (0.18 + 0.06 * R.sunBloom) * rimBand * sunLeak
  );

  linear +=
    godRayColor *
    godRays *
    (0.32 + 0.68 * lowSun) *
    skyFogMask *
    rayBodyMask;

  let mapped = toneMapFilmic(linear * max(R.exposure * 0.82, 0.0));
  let styled = applyStyleGrade(mapped, style, clamp(cloudA * 1.15 + bodyCore * 0.35, 0.0, 1.0));
  let graded = pow(styled, vec3<f32>(0.99, 0.995, 1.0));
  return vec4<f32>(graded, 1.0);
}
