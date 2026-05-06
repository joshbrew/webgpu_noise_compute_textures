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
  fovY:f32,         // vertical FOV in radians
  aspect:f32,       // width / height
  exposure:f32,
  sunBloom:f32,     // extra sun glow scale

  // sun as directional light in world space
  sunDir:vec3<f32>, _p7:f32,

  // simple sky tint
  sky:vec3<f32>,    _p8:f32
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

fn luminanceRGB(c:vec3<f32>)->f32 {
  return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn sunsetFilmGrade(mapped:vec3<f32>, sunsetAmt:f32, sunFacing:f32, horizonAmt:f32)->vec3<f32> {
  var c = clamp(mapped, vec3<f32>(0.0), vec3<f32>(1.0));
  let l = luminanceRGB(c);

  let shadowMask = (1.0 - smoothstep(0.10, 0.50, l)) * (0.45 + 0.55 * horizonAmt);
  let midMask = smoothstep(0.08, 0.42, l) * (1.0 - smoothstep(0.60, 0.95, l));
  let highlightMask = smoothstep(0.38, 0.96, l);

  let warmHighlights = vec3<f32>(1.10, 0.95, 0.82);
  let peachMids = vec3<f32>(1.04, 0.94, 0.96);
  let violetShadows = vec3<f32>(0.90, 0.86, 1.08);

  c = mix(c, c * violetShadows, 0.10 * sunsetAmt * shadowMask);
  c = mix(c, c * peachMids, 0.08 * sunsetAmt * midMask);
  c = mix(c, c * warmHighlights, 0.16 * sunsetAmt * highlightMask);

  let sunGlow = smoothstep(0.65, 1.0, sunFacing) * sunsetAmt;
  c += vec3<f32>(0.025, 0.010, 0.004) * sunGlow * highlightMask;
  c += vec3<f32>(0.012, 0.000, 0.016) * sunsetAmt * horizonAmt * shadowMask;

  return clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
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
  let lowSun = lowSunRaw * 0.42;
  let towardSunSky = clamp(dot(rayDir, sunDir), 0.0, 1.0);

  let sunsetAmt = saturate(lowSunRaw);
  let skyHeight = saturate(rayDir.y * 0.62 + 0.52);
  let horizonGlow = exp(-pow(rayDir.y / 0.32, 2.0));
  let belowHorizon = saturate(-rayDir.y * 2.0);

  let zenithSky = mix(
    R.sky * 0.92 + vec3<f32>(0.010, 0.018, 0.040),
    vec3<f32>(0.50, 0.62, 0.92),
    sunsetAmt * 0.32
  );
  let horizonSky = mix(
    R.sky * 0.72 + vec3<f32>(0.055, 0.065, 0.080),
    vec3<f32>(1.00, 0.56, 0.34),
    sunsetAmt * 0.78
  );
  let lowerViolet = mix(
    vec3<f32>(0.58, 0.64, 0.82),
    vec3<f32>(0.54, 0.42, 0.70),
    sunsetAmt * 0.42
  );

  let sunWash = mix(vec3<f32>(1.0, 0.94, 0.88), vec3<f32>(1.10, 0.56, 0.34), sunsetAmt * 0.88);
  let sunColor = mix(vec3<f32>(1.0, 0.92, 0.80), vec3<f32>(1.12, 0.62, 0.36), sunsetAmt * 0.86);
  let shadowCool = mix(vec3<f32>(0.92, 0.96, 1.0), vec3<f32>(0.82, 0.82, 1.00), sunsetAmt * 0.38);
  let edgeWarm = mix(vec3<f32>(1.0, 0.97, 0.92), vec3<f32>(1.10, 0.78, 0.58), sunsetAmt * 0.62);

  var sky = mix(horizonSky, zenithSky, smoothstep(0.12, 0.92, skyHeight));
  sky = mix(sky, lowerViolet, belowHorizon * 0.28);
  sky += sunWash * horizonGlow * sunsetAmt * 0.045;
  sky += sunWash * pow(towardSunSky, 7.0) * mix(0.025, 0.120, sunsetAmt);
  sky += vec3<f32>(0.018, 0.006, 0.030) * horizonGlow * sunsetAmt * 0.20;

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
      sunGlow = (innerGlow * (0.18 + 0.08 * R.sunBloom) + outerGlow * (0.03 + 0.05 * R.sunBloom)) * sunThrough;
    }
  }

  if (cloudA < 0.003) {
    let clearLinear = sky + sunColor * (1.18 * sunDisk + 0.22 * sunGlow);
    let clearMapped = toneMapFilmic(clearLinear * max(R.exposure * 0.80, 0.0));
    let clearGraded = sunsetFilmGrade(clearMapped, sunsetAmt, towardSunSky, horizonGlow);
    return vec4<f32>(pow(clearGraded, vec3<f32>(0.99, 0.995, 1.0)), 1.0);
  }

  var sunEdgeSilver = 0.0;
  var bodyShadow = 0.0;
  var cavity = 0.0;
  var ridge = 0.0;

  if (R.renderQuality >= 1u) {
    let grad = alphaGradLite(in.uv, layer);
    let gradLen = length(grad);
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

    let dSun = distance(in.uv, uvSun);
    let edge = smoothstep(0.012, 0.065, gradLen);
    let edgeBand = silverEdgeBand(cloudA);
    let occ = alphaOccLite(in.uv, layer);
    let powder = 0.34 + 0.66 * pow(clamp(occ * (1.0 - occ) * 4.0, 0.0, 1.0), 0.72);
    let sunOnScreen = fwdDot > 0.0 && all(uvSun >= vec2<f32>(-0.40, -0.40)) && all(uvSun <= vec2<f32>(1.40, 1.40));
    let nearSun = select(0.0, mix(0.20, 1.0, exp(-pow(dSun / 0.32, 2.0))), sunOnScreen);
    let forwardCone = smoothstep(0.55, 0.985, towardSun);
    sunEdgeSilver = edge * edgeBand * mix(0.38, 1.0, facing) * powder * nearSun * forwardCone * mix(0.76, 1.0, upperExposure);

    let coreMask = cloudCoreMask(cloudA, occ, edge);
    let awayFromSun = 1.0 - towardSun;
    bodyShadow = coreMask * mix(0.055, 0.18, awayFromSun) * mix(1.0, 0.72, facing);
    ridge = edge * edgeBand * 0.55;
    cavity = smoothstep(0.55, 0.96, occ) * smoothstep(0.35, 0.98, cloudA) * 0.22;
  } else {
    if (fwdDot > 0.0 && all(uvSun >= vec2<f32>(-0.40, -0.40)) && all(uvSun <= vec2<f32>(1.40, 1.40))) {
      let dSun = distance(in.uv, uvSun);
      let grad = alphaGradAt(in.uv, layer);
      let gradLen = length(grad);
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
      let powder = 0.34 + 0.66 * pow(clamp(occ * (1.0 - occ) * 4.0, 0.0, 1.0), 0.72);
      let nearSun = mix(0.18, 1.0, exp(-pow(dSun / 0.30, 2.0)));
      let forwardCone = smoothstep(0.55, 0.985, towardSun);
      let exposedGate = openSoft * mix(0.70, 1.0, upperExposure);

      sunEdgeSilver = edge * edgeBand * facing * powder * nearSun * forwardCone * exposedGate;

      let coreMask = cloudCoreMask(cloudA, occ, edge);
      let sunFacing = smoothstep(0.38, 0.96, towardSun);
      let silhouette = coreMask * sunFacing * nearSun * mix(0.10, 0.32, 1.0 - facing) * smoothstep(0.12, 0.92, 1.0 - openSoft);
      let awayFromSun = 1.0 - towardSun;
      bodyShadow = coreMask * mix(0.06, 0.20, awayFromSun) + silhouette;
    }

    let relief = alphaReliefStats(in.uv, layer);
    cavity = smoothstep(0.015, 0.110, relief.x) * smoothstep(0.22, 0.92, cloudA);
    ridge = smoothstep(0.010, 0.080, relief.y) * smoothstep(0.16, 0.86, cloudA);
  }

  let bodyMask = smoothstep(0.22, 0.92, cloudA);
  let bodyCore = smoothstep(0.48, 0.96, cloudA) * (1.0 - smoothstep(0.010, 0.050, length(alphaGradLite(in.uv, layer))));
  let cavityShadow = cavity * bodyMask * mix(0.08, 0.22, bodyShadow) * mix(1.0, 0.82, bodyCore);
  let ridgeLift = ridge * (1.0 - cavity) * (0.030 + 0.060 * (1.0 - bodyShadow));
  let finalShadow = clamp(bodyShadow + cavityShadow, 0.0, mix(0.72, 0.62, bodyCore));

  var cloudShaded = mix(cloudRGB, cloudRGB * (1.0 - finalShadow), mix(1.0, 0.82, bodyCore));
  cloudShaded *= mix(vec3<f32>(1.0, 1.0, 1.0), shadowCool, clamp(finalShadow * 0.14 + cavity * 0.055, 0.0, 1.0));
  cloudShaded += sunColor * ridgeLift * cloudA;
  cloudShaded += edgeWarm * sunEdgeSilver * 0.70;
  cloudShaded += sunWash * sunGlow * 0.035;

  var linear = sky * (1.0 - cloudA) + cloudShaded;
  linear += sunColor * (1.18 * sunDisk + 0.22 * sunGlow + 1.20 * sunEdgeSilver);

  let mapped = toneMapFilmic(linear * max(R.exposure * 0.80, 0.0));
  let sunsetMapped = sunsetFilmGrade(mapped, sunsetAmt, towardSunSky, horizonGlow);
  let graded = pow(sunsetMapped, vec3<f32>(0.99, 0.995, 1.0));
  return vec4<f32>(graded, 1.0);
}
