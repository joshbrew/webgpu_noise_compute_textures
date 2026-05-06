// cloudsRender.wgsl — preview: world-space camera + directional sun,
// tone-map and composite the cloud layer over a procedural sky.
// Uses explicit-LOD sampling so textureSample* calls are valid in
// non-uniform control flow.

const PI : f32 = 3.141592653589793;
const SUN_UV_RADIUS : f32 = 0.02;

// ---------- I/O ----------
struct RenderParams {
  layerIndex:u32,
  _pad0:u32,
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
fn toneMapExp(c:vec3<f32>, k:f32)->vec3<f32> {
  return vec3<f32>(1.0) - exp(-c * max(k, 0.0));
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

@fragment
fn fs_main(in:VSOut)->@location(0) vec4<f32> {
  // cloud sample (LOD 0 — compute wrote premultiplied rgb with alpha=1-Tr)
  let texel    = textureSampleLevel(tex, samp, in.uv, i32(R.layerIndex), 0.0);
  let cloudRGB = texel.rgb;
  let cloudA   = clamp(texel.a, 0.0, 1.0);

  // procedural sky (linear) — unchanged
  let v = in.uv.y;
  let horizon = pow(clamp(1.0 - abs(v - 0.5) * 2.0, 0.0, 1.0), 1.25);
  var sky = mix(R.sky * 0.55, R.sky, pow(clamp(v, 0.0, 1.0), 1.6));
  sky += vec3<f32>(0.02, 0.03, 0.06) * horizon;

  // sun in screen space
  let sunDir = normalize(R.sunDir);
  let uvSun  = projectDirToUV(sunDir);
  var sunGlow = 0.0;
  var sunDisk = 0.0;

  let fwdDot = dot(sunDir, R.fwd);

  // cheap bounding check: is the sun in front and in a small screen box?
  if (fwdDot > 0.0 && all(uvSun >= vec2<f32>(-0.2, -0.2)) && all(uvSun <= vec2<f32>(1.2, 1.2))) {
    let d = distance(in.uv, uvSun);

    // early-out: if pixel is far from sun center, skip expensive gather
    // (adjust multiplier to control how far we consider "influence" region)
    if (d <= SUN_UV_RADIUS * 2.5) {
      // If clouds are nearly fully opaque or fully clear there's no need to gather
      if (cloudA < 0.98 && cloudA > 0.02) {
        // gather at lower LOD and fewer samples
        let aAvg = alphaGatherFast(uvSun, i32(R.layerIndex));
        let sunThrough = pow(max(1.0 - aAvg, 0.0), 1.5);
        // compute disk/glow using d
        sunGlow = exp(-pow(d / (SUN_UV_RADIUS * 1.5), 2.0)) * (0.6 + 0.4 * R.sunBloom) * sunThrough;
        sunDisk = smoothstep(SUN_UV_RADIUS, 0.0, d) * sunThrough;
      } else {
        // either fully clear or fully opaque — approximate direct effect (fast)
        let baseGlow = exp(-pow(d / (SUN_UV_RADIUS * 1.5), 2.0)) * (0.6 + 0.4 * R.sunBloom);
        if (cloudA <= 0.02) {
          // mostly clear: full glow & disk
          sunGlow = baseGlow;
          sunDisk = smoothstep(SUN_UV_RADIUS, 0.0, d);
        } else {
          // mostly opaque: heavily attenuated
          sunGlow = baseGlow * 0.05;
          sunDisk = 0.0;
        }
      }
    }
  }

  // linear composite: premult clouds over sky, then add sun energy
  var linear = cloudRGB + sky * (1.0 - cloudA);
  linear += vec3<f32>(1.0) * (0.9 * sunGlow + 0.7 * sunDisk);

  // tone map once at the end
  let color = toneMapExp(linear, R.exposure);
  return vec4<f32>(color, 1.0);
}
