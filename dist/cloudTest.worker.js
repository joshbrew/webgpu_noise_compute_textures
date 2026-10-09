(() => {
  // tools/noise/noiseCompute.wgsl
  var noiseCompute_default = `const PI : f32 = 3.141592653589793;
const TWO_PI : f32 = 6.283185307179586;

const ANGLE_INCREMENT : f32 = PI / 4.0;

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 options UBO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
struct NoiseComputeOptions {
  getGradient : u32,
  useCustomPos : u32,
  outputChannel : u32,
  ioFlags : u32,
  baseRadius : f32,
  heightScale : f32,
  sphereOffset : f32,
  sphereOffset2 : f32,
};
@group(0) @binding(0) var<uniform> options : NoiseComputeOptions;

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 params UBO (layout kept) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
struct NoiseParams {
  seed : u32,
  zoom : f32,
  freq : f32,
  octaves : u32,
  lacunarity : f32,
  gain : f32,
  xShift : f32,
  yShift : f32,
  zShift : f32,
  turbulence : u32,
  seedAngle : f32,
  exp1 : f32,
  exp2 : f32,
  threshold : f32,
  rippleFreq : f32,
  time : f32,
  warpAmp : f32,
  gaborRadius : f32,
  terraceStep : f32,
  toroidal : u32,
  voroMode : u32,
  edgeK : f32,
  scalar : f32,
  transform : f32,
};
@group(0) @binding(1) var<uniform> params : NoiseParams;

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 permutation table \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
struct PermTable { values : array<u32, 512>, };
const PERM_SIZE : u32 = 512u;
const PERM_MASK : u32 = PERM_SIZE - 1u;
const INV_255 : f32 = 1.0 / 255.0;
const INV_2_OVER_255 : f32 = 2.0 / 255.0;

@group(0) @binding(2) var<storage, read> permTable : PermTable;

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 IO resources \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@group(0) @binding(3) var inputTex : texture_2d_array<f32>;
@group(0) @binding(4) var outputTex : texture_storage_2d_array<rgba16float, write>;
@group(0) @binding(5) var<storage, read> posBuf : array<vec4<f32>>;

struct Frame {
  fullWidth : u32,
  fullHeight : u32,
  tileWidth : u32,
  tileHeight : u32,

  originX : i32,
  originY : i32,
  originZ : i32,
  fullDepth : u32,

  tileDepth : u32,
  layerIndex : i32,
  layers : u32,
  _pad : u32,

  originXf : f32,
  originYf : f32,
  originZf : f32,
  _pad1    : f32,
};
@group(0) @binding(6) var<uniform> frame : Frame;

@group(0) @binding(7) var inputTex3D : texture_3d<f32>;
@group(0) @binding(8) var outputTex3D : texture_storage_3d<rgba16float, write>;

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 small utilities \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn clampZ(z: i32)->i32 {
  let depth = i32(max(u32(frame.fullDepth), 1u));
  return clamp(z, 0, depth - 1);
}
fn layerToZ(layerIndex:i32, layers:u32)->f32 {
  if (layers <= 1u) { return 0.0; }
  let li = max(layerIndex, 0);
  return f32(li) / f32(layers - 1u);
}
fn readFrom3D()->bool { return (options.ioFlags & 0x1u) != 0u; }
fn writeTo3D()->bool { return (options.ioFlags & 0x2u) != 0u; }

fn loadPrevRGBA(fx:i32, fy:i32, fz:i32)->vec4<f32> {
  if (readFrom3D()) { return textureLoad(inputTex3D, vec3<i32>(fx, fy, clampZ(fz)), 0); }
  return textureLoad(inputTex, vec2<i32>(fx, fy), frame.layerIndex, 0);
}
fn storeRGBA(fx:i32, fy:i32, fz:i32, col:vec4<f32>) {
  if (writeTo3D()) { textureStore(outputTex3D, vec3<i32>(fx, fy, clampZ(fz)), col); }
  else { textureStore(outputTex, vec2<i32>(fx, fy), frame.layerIndex, col); }
}

fn rotateXY3(p: vec3<f32>, angle: f32) -> vec3<f32> {
  let c = cos(angle);
  let s = sin(angle);
  return vec3<f32>(
    p.x * c - p.y * s,
    p.x * s + p.y * c,
    p.z
  );
}


const STEREO_SCALE : f32 = 1.8;          // fixed packing scale for Clifford torus
const INV_SQRT2    : f32 = 0.7071067811865476; // 1/\u221A2

// add next to your other constants
const U_SCALE : f32 = 3.0;
const V_SCALE : f32 = 3.0;
const T_SCALE : f32 = 2.0;
const PACK_BIAS : vec4<f32> = vec4<f32>(0.37, 0.21, 0.29, 0.31);

fn packPeriodicUV(u: f32, v: f32, theta: f32) -> vec4<f32> {
  let aU = fract(u) * TWO_PI;
  let aV = fract(v) * TWO_PI;
  let aT = fract(theta) * TWO_PI;

  let x = cos(aU) * U_SCALE;
  let y = sin(aU) * U_SCALE;
  let z = cos(aV) * V_SCALE + cos(aT) * T_SCALE;
  let w = sin(aV) * V_SCALE + sin(aT) * T_SCALE;

  return vec4<f32>(x, y, z, w) + PACK_BIAS;
}


fn thetaFromDepth(fz: i32) -> f32 {
  let uses3D = writeTo3D() || readFrom3D();
  if (uses3D) {
    let d = max(f32(frame.fullDepth), 1.0);
    return (f32(clampZ(fz)) + 0.5) / d; // [0,1)
  }
  return layerToZ(frame.layerIndex, frame.layers);
}

fn seedOffset3(seed: u32) -> vec3<f32> {
  let a = f32((seed * 1664525u + 1013904223u) & 65535u) / 65536.0;
  let b = f32((seed * 22695477u + 1u) & 65535u) / 65536.0;
  let c = f32((seed * 1103515245u + 12345u) & 65535u) / 65536.0;

  return vec3<f32>(
    17.173 + a * 131.0,
    31.947 + b * 137.0,
    47.521 + c * 149.0
  );
}

fn fetchPlanetSpherePos(fx: i32, fy: i32) -> vec3<f32> {
  let w = i32(max(frame.fullWidth, 2u));
  let h = i32(max(frame.fullHeight, 2u));
  let segments = max(w - 1, 1);
  let maxLat = max(h - 1, 1);

  let lat = clamp(fy, 0, maxLat);
  let rawLon = fx;
  let lon = ((rawLon % segments) + segments) % segments;

  if (lat <= 0) {
    // Y-up north pole, matching sphereUVFromWorld() and the Babylon planet.
    return vec3<f32>(2.0, 3.0, 2.0);
  }

  if (lat >= maxLat) {
    // Y-up south pole, matching sphereUVFromWorld() and the Babylon planet.
    return vec3<f32>(2.0, 1.0, 2.0);
  }

  let theta = f32(lat) * PI / f32(maxLat);
  let phi = f32(lon) * TWO_PI / f32(segments);

  let sinTheta = sin(theta);
  let cosTheta = cos(theta);
  let sinPhi = sin(phi);
  let cosPhi = cos(phi);

  // Match the Babylon / spherical cloud convention: Y is the polar axis and
  // longitude runs around X/Z. This keeps the baked spherical weather field in
  // parity with sphereUVFromWorld(), so the cloud weather map is actually baked
  // onto the same manifold it is sampled from at render time.
  let x = sinTheta * cosPhi;
  let y = cosTheta;
  let z = sinTheta * sinPhi;

  // Fade the procedural offset by latitude only so it stays symmetric around the
  // seam and vanishes cleanly at the poles.
  let equatorScale = sinTheta;
  let offset = options.sphereOffset;
  let offset2 = options.sphereOffset2;

  return vec3<f32>(
    x + 2.0 + equatorScale * (offset * sin(phi + theta) + offset2 * cos(2.0 * phi)),
    y + 2.0 + equatorScale * (offset * cos(theta + phi) + offset2 * sin(2.0 * theta)),
    z + 2.0 + equatorScale * (offset * sin(2.0 * phi + theta) + offset2 * cos(2.0 * theta + phi))
  );
}


fn fetchAuroraCapPos(fx: i32, fy: i32) -> vec3<f32> {
  let w = i32(max(frame.fullWidth, 2u));
  let h = i32(max(frame.fullHeight, 2u));
  let segments = max(w - 1, 1);
  let maxRadial = max(h - 1, 1);

  let radialIndex = clamp(fy, 0, maxRadial);
  let rawLon = fx;
  let lon = ((rawLon % segments) + segments) % segments;

  let capHalfAngleDeg = max(options.baseRadius, 0.001);
  let capHalfAngle = radians(capHalfAngleDeg);
  let hemisphere = select(-1.0, 1.0, options.heightScale >= 0.0);

  let radial = f32(radialIndex) * capHalfAngle / f32(maxRadial);
  let phi = f32(lon) * TWO_PI / f32(segments);

  let sinR = sin(radial);
  let cosR = cos(radial);
  let sinPhi = sin(phi);
  let cosPhi = cos(phi);

  let x = sinR * cosPhi;
  let y = hemisphere * cosR;
  let z = sinR * sinPhi;

  let capScale = sinR;
  let offset = options.sphereOffset;
  let offset2 = options.sphereOffset2;

  return vec3<f32>(
    x + 2.0 + capScale * (offset * sin(phi + radial) + offset2 * cos(2.0 * phi)),
    y + 2.0 + capScale * (offset * cos(radial + phi) + offset2 * sin(2.0 * radial)),
    z + 2.0 + capScale * (offset * sin(2.0 * phi + radial) + offset2 * cos(2.0 * radial + phi))
  );
}

fn fetchPos(fx: i32, fy: i32, fz: i32) -> vec3<f32> {
  if (options.useCustomPos == 2u) {
    return fetchPlanetSpherePos(fx, fy);
  }

  if (options.useCustomPos == 3u) {
    return fetchAuroraCapPos(fx, fy);
  }

  if (options.useCustomPos == 1u) {
    let use3D = writeTo3D() || readFrom3D();
    let localX = u32(clamp(fx - frame.originX, 0, i32(max(frame.tileWidth, 1u)) - 1));
    let localY = u32(clamp(fy - frame.originY, 0, i32(max(frame.tileHeight, 1u)) - 1));
    let localZ = u32(max(select(frame.layerIndex, clampZ(fz) - frame.originZ, use3D), 0));
    let idx = localZ * frame.tileWidth * frame.tileHeight + localY * frame.tileWidth + localX;
    return posBuf[idx].xyz;
  }

  if (params.toroidal == 1u) {
    let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);
    let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);

    let invW = 1.0 / max(f32(frame.fullWidth), 1.0);
    let invH = 1.0 / max(f32(frame.fullHeight), 1.0);

    let U = (f32(cx) + 0.5) * invW;
    let V = (f32(cy) + 0.5) * invH;
    let theta = thetaFromDepth(fz);

    return vec3<f32>(U, V, theta);
  }

  let invW = 1.0 / max(f32(frame.fullWidth), 1.0);
  let invH = 1.0 / max(f32(frame.fullHeight), 1.0);

  var ox = frame.originXf;
  var oy = frame.originYf;
  if (ox == 0.0 && oy == 0.0) {
    ox = f32(frame.originX);
    oy = f32(frame.originY);
  }

  let x = (ox + f32(fx) + 0.5) * invW;
  let y = (oy + f32(fy) + 0.5) * invH;

  var z: f32;
  let uses3D = writeTo3D() || readFrom3D();
  if (uses3D) {
    if (frame.fullDepth <= 1u) {
      z = 0.0;
    } else {
      z = (f32(clampZ(fz)) + 0.5) / f32(frame.fullDepth);
    }
  } else {
    z = layerToZ(frame.layerIndex, frame.layers);
  }

  return vec3<f32>(x, y, z);
}



fn writeChannel(fx:i32, fy:i32, fz:i32, v0:f32, channel:u32, overwrite:u32) {
  if (!writeTo3D()) {
    if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) { return; }
  }

  let v = v0 * params.scalar + params.transform;
  let needsAccum = (overwrite == 0u);
  let writesAll = (channel == 0u);
  let skipRead = (!needsAccum) && (writesAll || channel == 5u);
  var inCol = vec4<f32>(0.0);
  if (!skipRead) { inCol = loadPrevRGBA(fx, fy, fz); }
  var outCol = inCol;

  if (channel == 0u)      { let h = select(v + inCol.x, v, overwrite == 1u); outCol = vec4<f32>(h, h, h, h); }
  else if (channel == 1u) { let h = select(v + inCol.x, v, overwrite == 1u); outCol.x = h; }
  else if (channel == 2u) { let h = select(v + inCol.y, v, overwrite == 1u); outCol.y = h; }
  else if (channel == 3u) { let h = select(v + inCol.z, v, overwrite == 1u); outCol.z = h; }
  else if (channel == 4u) { let h = select(v + inCol.w, v, overwrite == 1u); outCol.w = h; }
  else if (channel == 5u) { let p = fetchPos(fx, fy, fz); let h = select(v + inCol.w, v, overwrite == 1u); outCol = vec4<f32>(p.x, p.y, p.z, h); }
  else if (channel == 6u) { let p = fetchPos(fx, fy, fz); let h = select(v + inCol.w, v, overwrite == 1u); outCol = vec4<f32>(p.x, p.y, h, inCol.w); }

  storeRGBA(fx, fy, fz, outCol);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 math / noise bits \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
/* gradient tables */
const GRAD2 : array<vec2<f32>, 8> = array<vec2<f32>, 8>(
  vec2<f32>( 1.0,  1.0), vec2<f32>(-1.0,  1.0),
  vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0, -1.0),
  vec2<f32>( 1.0,  0.0), vec2<f32>(-1.0,  0.0),
  vec2<f32>( 0.0,  1.0), vec2<f32>( 0.0, -1.0)
);

const GRAD3 : array<vec3<f32>, 12> = array<vec3<f32>, 12>(
  vec3<f32>( 1.0,  1.0,  0.0), vec3<f32>(-1.0,  1.0,  0.0),
  vec3<f32>( 1.0, -1.0,  0.0), vec3<f32>(-1.0, -1.0,  0.0),
  vec3<f32>( 1.0,  0.0,  1.0), vec3<f32>(-1.0,  0.0,  1.0),
  vec3<f32>( 1.0,  0.0, -1.0), vec3<f32>(-1.0,  0.0, -1.0),
  vec3<f32>( 0.0,  1.0,  1.0), vec3<f32>( 0.0, -1.0,  1.0),
  vec3<f32>( 0.0,  1.0, -1.0), vec3<f32>( 0.0, -1.0, -1.0)
);
const GRAD4 : array<vec4<f32>, 32> = array<vec4<f32>, 32>(
  vec4<f32>( 0.0,  1.0,  1.0,  1.0), vec4<f32>( 0.0,  1.0,  1.0, -1.0),
  vec4<f32>( 0.0,  1.0, -1.0,  1.0), vec4<f32>( 0.0,  1.0, -1.0, -1.0),
  vec4<f32>( 0.0, -1.0,  1.0,  1.0), vec4<f32>( 0.0, -1.0,  1.0, -1.0),
  vec4<f32>( 0.0, -1.0, -1.0,  1.0), vec4<f32>( 0.0, -1.0, -1.0, -1.0),

  vec4<f32>( 1.0,  0.0,  1.0,  1.0), vec4<f32>( 1.0,  0.0,  1.0, -1.0),
  vec4<f32>( 1.0,  0.0, -1.0,  1.0), vec4<f32>( 1.0,  0.0, -1.0, -1.0),
  vec4<f32>(-1.0,  0.0,  1.0,  1.0), vec4<f32>(-1.0,  0.0,  1.0, -1.0),
  vec4<f32>(-1.0,  0.0, -1.0,  1.0), vec4<f32>(-1.0,  0.0, -1.0, -1.0),

  vec4<f32>( 1.0,  1.0,  0.0,  1.0), vec4<f32>( 1.0,  1.0,  0.0, -1.0),
  vec4<f32>( 1.0, -1.0,  0.0,  1.0), vec4<f32>( 1.0, -1.0,  0.0, -1.0),
  vec4<f32>(-1.0,  1.0,  0.0,  1.0), vec4<f32>(-1.0,  1.0,  0.0, -1.0),
  vec4<f32>(-1.0, -1.0,  0.0,  1.0), vec4<f32>(-1.0, -1.0,  0.0, -1.0),

  vec4<f32>( 1.0,  1.0,  1.0,  0.0), vec4<f32>( 1.0,  1.0, -1.0,  0.0),
  vec4<f32>( 1.0, -1.0,  1.0,  0.0), vec4<f32>( 1.0, -1.0, -1.0,  0.0),
  vec4<f32>(-1.0,  1.0,  1.0,  0.0), vec4<f32>(-1.0,  1.0, -1.0,  0.0),
  vec4<f32>(-1.0, -1.0,  1.0,  0.0), vec4<f32>(-1.0, -1.0, -1.0,  0.0)
);

/* Gradient accessors */
fn gradient(idx:u32)->vec3<f32> {
  return GRAD3[idx % 12u];
}
fn gradient2(idx:u32)->vec2<f32> {
  return GRAD2[idx % 8u];
}
fn gradient4(idx: u32) -> vec4<f32> {
  return GRAD4[idx % 32u];
}


fn fade(t:f32)->f32 { return t*t*t*(t*(t*6.0 - 15.0) + 10.0); }
fn lerp(a:f32, b:f32, t:f32)->f32 { return a + t * (b - a); }

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 perm/hash helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn perm(idx: u32) -> u32 {
  return permTable.values[idx & PERM_MASK];
}

fn rot3(p: vec3<f32>) -> vec3<f32> {
  let x = 0.00 * p.x + -0.80 * p.y + -0.60 * p.z;
  let y = 0.80 * p.x +  0.36 * p.y + -0.48 * p.z;
  let z = 0.60 * p.x + -0.48 * p.y +  0.64 * p.z;
  return vec3<f32>(x, y, z);
}

fn hash2(ix : i32, iy : i32) -> u32 {
  return perm((u32(ix) & PERM_MASK) + perm(u32(iy) & PERM_MASK)) & PERM_MASK;
}
fn rand2(ix : i32, iy : i32) -> f32 {
  let idx = hash2(ix, iy);
  return f32(perm(idx)) * INV_2_OVER_255 - 1.0;
}
fn rand2u(ix : i32, iy : i32) -> f32 {
  let idx = hash2(ix, iy);
  return f32(perm(idx)) * INV_255;
}

// 3D helpers
fn hash3(ix : i32, iy : i32, iz : i32) -> u32 {
  return perm((u32(ix) & PERM_MASK)
            + perm((u32(iy) & PERM_MASK) + perm(u32(iz) & PERM_MASK)))
         & PERM_MASK;
}
fn rand3(ix : i32, iy : i32, iz : i32) -> f32 {
  let idx = hash3(ix, iy, iz);
  return f32(perm(idx)) * INV_2_OVER_255 - 1.0;
}
fn rand3u(ix : i32, iy : i32, iz : i32) -> f32 {
  let idx = hash3(ix, iy, iz);
  return f32(perm(idx)) * INV_255;
}

// 4D helpers
fn hash4(ix : i32, iy : i32, iz : i32, iw : i32) -> u32 {
  let a = perm(u32(ix) & PERM_MASK);
  let b = perm((u32(iy) & PERM_MASK) + a);
  let c = perm((u32(iz) & PERM_MASK) + b);
  return perm((u32(iw) & PERM_MASK) + c) & PERM_MASK;
}
fn rand4(ix : i32, iy : i32, iz : i32, iw : i32) -> f32 {
  let idx = hash4(ix, iy, iz, iw);
  return f32(perm(idx)) * INV_2_OVER_255 - 1.0;
}
fn rand4u(ix : i32, iy : i32, iz : i32, iw : i32) -> f32 {
  let idx = hash4(ix, iy, iz, iw);
  return f32(perm(idx)) * INV_255;
}


/* ---------- classic 2D Perlin ---------- */
fn noise2D(p : vec2<f32>) -> f32 {
  let ix = i32(floor(p.x));
  let iy = i32(floor(p.y));
  let X: u32 = u32(ix) & PERM_MASK;
  let Y: u32 = u32(iy) & PERM_MASK;

  let xf = p.x - floor(p.x);
  let yf = p.y - floor(p.y);

  let u = fade(xf);
  let v = fade(yf);

  let A  = perm(X) + Y;
  let B  = perm((X + 1u) & PERM_MASK) + Y;

  let gAA = gradient2(perm(A & PERM_MASK));
  let gBA = gradient2(perm(B & PERM_MASK));
  let gAB = gradient2(perm((A + 1u) & PERM_MASK));
  let gBB = gradient2(perm((B + 1u) & PERM_MASK));

  let x1 = lerp(dot(gAA, vec2<f32>(xf,       yf      )),
                dot(gBA, vec2<f32>(xf - 1.0, yf      )), u);
  let x2 = lerp(dot(gAB, vec2<f32>(xf,       yf - 1.0)),
                dot(gBB, vec2<f32>(xf - 1.0, yf - 1.0)), u);
  return lerp(x1, x2, v);
}

//matches 3d z=0 slice, less multiplying
fn noise2D_from_3D(p: vec3<f32>) -> f32 {
  let ix = i32(floor(p.x));
  let iy = i32(floor(p.y));
  let X: u32 = u32(ix) & PERM_MASK;
  let Y: u32 = u32(iy) & PERM_MASK;

  let xf = p.x - floor(p.x);
  let yf = p.y - floor(p.y);
  let u = fade(xf);
  let v = fade(yf);

  // 3D hashing path with Z = 0
  let A  = perm(X) + Y;
  let AA = perm(A & PERM_MASK);                 // + Z(=0)
  let AB = perm((A + 1u) & PERM_MASK);          // + Z(=0)
  let B  = perm((X + 1u) & PERM_MASK) + Y;
  let BA = perm(B & PERM_MASK);                 // + Z(=0)
  let BB = perm((B + 1u) & PERM_MASK);          // + Z(=0)

  let gAA = gradient(perm(AA & PERM_MASK));
  let gBA = gradient(perm(BA & PERM_MASK));
  let gAB = gradient(perm(AB & PERM_MASK));
  let gBB = gradient(perm(BB & PERM_MASK));

  let n00 = dot(gAA, vec3<f32>(xf,       yf,       0.0));
  let n10 = dot(gBA, vec3<f32>(xf - 1.0, yf,       0.0));
  let n01 = dot(gAB, vec3<f32>(xf,       yf - 1.0, 0.0));
  let n11 = dot(gBB, vec3<f32>(xf - 1.0, yf - 1.0, 0.0));

  let nx0 = lerp(n00, n10, u);
  let nx1 = lerp(n01, n11, u);
  return lerp(nx0, nx1, v);
}

/* ---------- classic 3D Perlin ---------- */
fn noise3D(p: vec3<f32>) -> f32 {
  if (p.z == 0.0) { return noise2D_from_3D(p); }

  let ix = i32(floor(p.x));
  let iy = i32(floor(p.y));
  let iz = i32(floor(p.z));
  let X: u32 = u32(ix) & PERM_MASK;
  let Y: u32 = u32(iy) & PERM_MASK;
  let Z: u32 = u32(iz) & PERM_MASK;

  let xf = p.x - floor(p.x);
  let yf = p.y - floor(p.y);
  let zf = p.z - floor(p.z);

  let u = fade(xf);
  let v = fade(yf);
  let w = fade(zf);

  let A  = perm(X) + Y;
  let AA = perm(A & PERM_MASK) + Z;
  let AB = perm((A + 1u) & PERM_MASK) + Z;
  let B  = perm((X + 1u) & PERM_MASK) + Y;
  let BA = perm(B & PERM_MASK) + Z;
  let BB = perm((B + 1u) & PERM_MASK) + Z;

  let gAA  = gradient(perm(AA & PERM_MASK));
  let gBA  = gradient(perm(BA & PERM_MASK));
  let gAB  = gradient(perm(AB & PERM_MASK));
  let gBB  = gradient(perm(BB & PERM_MASK));
  let gAA1 = gradient(perm((AA + 1u) & PERM_MASK));
  let gBA1 = gradient(perm((BA + 1u) & PERM_MASK));
  let gAB1 = gradient(perm((AB + 1u) & PERM_MASK));
  let gBB1 = gradient(perm((BB + 1u) & PERM_MASK));

  let x1 = lerp(dot(gAA,  vec3<f32>(xf,       yf,       zf      )),
                dot(gBA,  vec3<f32>(xf - 1.0, yf,       zf      )), u);
  let x2 = lerp(dot(gAB,  vec3<f32>(xf,       yf - 1.0, zf      )),
                dot(gBB,  vec3<f32>(xf - 1.0, yf - 1.0, zf      )), u);
  let y1 = lerp(x1, x2, v);

  let x3 = lerp(dot(gAA1, vec3<f32>(xf,       yf,       zf - 1.0)),
                dot(gBA1, vec3<f32>(xf - 1.0, yf,       zf - 1.0)), u);
  let x4 = lerp(dot(gAB1, vec3<f32>(xf,       yf - 1.0, zf - 1.0)),
                dot(gBB1, vec3<f32>(xf - 1.0, yf - 1.0, zf - 1.0)), u);
  let y2 = lerp(x3, x4, v);

  return lerp(y1, y2, w);
}


/* ---------- 4D Perlin (hypercube corners, gradient-based) ---------- */
fn noise4D(p: vec4<f32>) -> f32 {
  // integer cell coords
  let ix = i32(floor(p.x));
  let iy = i32(floor(p.y));
  let iz = i32(floor(p.z));
  let iw = i32(floor(p.w));

  let X: u32 = u32(ix) & PERM_MASK;
  let Y: u32 = u32(iy) & PERM_MASK;
  let Z: u32 = u32(iz) & PERM_MASK;
  let W: u32 = u32(iw) & PERM_MASK;

  // fractional part
  let xf = p.x - floor(p.x);
  let yf = p.y - floor(p.y);
  let zf = p.z - floor(p.z);
  let wf = p.w - floor(p.w);

  let u = fade(xf);
  let v = fade(yf);
  let t = fade(zf);
  let s = fade(wf);

  // helper to get corner gradient and dot product
  // corner offsets are dx,dy,dz,dw in {0,1}
  // for fractional component, use (xf - dx) etc; for dw=1 use (wf - 1.0)
  // compute hash for corner using hash4(ix+dx, iy+dy, iz+dz, iw+dw)
  let d0000 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 0, iw + 0))), vec4<f32>(xf,       yf,       zf,       wf      ));
  let d1000 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 0, iw + 0))), vec4<f32>(xf - 1.0, yf,       zf,       wf      ));
  let d0100 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 0, iw + 0))), vec4<f32>(xf,       yf - 1.0, zf,       wf      ));
  let d1100 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 0, iw + 0))), vec4<f32>(xf - 1.0, yf - 1.0, zf,       wf      ));

  let d0010 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 1, iw + 0))), vec4<f32>(xf,       yf,       zf - 1.0, wf      ));
  let d1010 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 1, iw + 0))), vec4<f32>(xf - 1.0, yf,       zf - 1.0, wf      ));
  let d0110 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 1, iw + 0))), vec4<f32>(xf,       yf - 1.0, zf - 1.0, wf      ));
  let d1110 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 1, iw + 0))), vec4<f32>(xf - 1.0, yf - 1.0, zf - 1.0, wf      ));

  let d0001 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 0, iw + 1))), vec4<f32>(xf,       yf,       zf,       wf - 1.0));
  let d1001 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 0, iw + 1))), vec4<f32>(xf - 1.0, yf,       zf,       wf - 1.0));
  let d0101 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 0, iw + 1))), vec4<f32>(xf,       yf - 1.0, zf,       wf - 1.0));
  let d1101 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 0, iw + 1))), vec4<f32>(xf - 1.0, yf - 1.0, zf,       wf - 1.0));

  let d0011 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 1, iw + 1))), vec4<f32>(xf,       yf,       zf - 1.0, wf - 1.0));
  let d1011 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 1, iw + 1))), vec4<f32>(xf - 1.0, yf,       zf - 1.0, wf - 1.0));
  let d0111 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 1, iw + 1))), vec4<f32>(xf,       yf - 1.0, zf - 1.0, wf - 1.0));
  let d1111 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 1, iw + 1))), vec4<f32>(xf - 1.0, yf - 1.0, zf - 1.0, wf - 1.0));

  // interpolate along x -> y -> z for w=0 layer
  let x00 = lerp(d0000, d1000, u);
  let x10 = lerp(d0100, d1100, u);
  let y0  = lerp(x00, x10, v);

  let x01 = lerp(d0010, d1010, u);
  let x11 = lerp(d0110, d1110, u);
  let y1  = lerp(x01, x11, v);

  let zLayer0 = lerp(y0, y1, t);

  // interpolate for w=1 layer
  let x00w = lerp(d0001, d1001, u);
  let x10w = lerp(d0101, d1101, u);
  let y0w  = lerp(x00w, x10w, v);

  let x01w = lerp(d0011, d1011, u);
  let x11w = lerp(d0111, d1111, u);
  let y1w  = lerp(x01w, x11w, v);

  let zLayer1 = lerp(y0w, y1w, t);

  // final interp along w
  return lerp(zLayer0, zLayer1, s);
}

fn worley3D(p : vec3<f32>) -> f32 {
    let fx = i32(floor(p.x));
    let fy = i32(floor(p.y));
    let fz = i32(floor(p.z));
    var minD : f32 = 1e9;
    for (var dz = -1; dz <= 1; dz = dz + 1) {
      for (var dy = -1; dy <= 1; dy = dy + 1) {
        for (var dx = -1; dx <= 1; dx = dx + 1) {
          let xi = fx + dx;
          let yi = fy + dy;
          let zi = fz + dz;
          let px = f32(xi) + rand3u(xi, yi, zi);
          let py = f32(yi) + rand3u(yi, zi, xi);
          let pz = f32(zi) + rand3u(zi, xi, yi);
          let dxv = px - p.x;
          let dyv = py - p.y;
          let dzv = pz - p.z;
          let d2 = dxv*dxv + dyv*dyv + dzv*dzv;
          if (d2 < minD) { minD = d2; }
        }
      }
    }
    return sqrt(minD);
  
}


/* ---------- 4D Worley (cellular) ---------- */
// fn worley4D(p: vec4<f32>) -> f32 {
//   let fx = i32(floor(p.x));
//   let fy = i32(floor(p.y));
//   let fz = i32(floor(p.z));
//   let fw = i32(floor(p.w));

//   var minDistSq : f32 = 1e9;

//   // iterate neighbor cells in 4D (3^4 = 81)
//   for (var dw = -1; dw <= 1; dw = dw + 1) {
//     for (var dz = -1; dz <= 1; dz = dz + 1) {
//       for (var dy = -1; dy <= 1; dy = dy + 1) {
//         for (var dx = -1; dx <= 1; dx = dx + 1) {
//           let xi = fx + dx;
//           let yi = fy + dy;
//           let zi = fz + dz;
//           let wi = fw + dw;

//           // jitter within each cell using rotated rand4u calls to decorrelate axes
//           let rx = rand4u(xi, yi, zi, wi);
//           let ry = rand4u(yi, zi, wi, xi);
//           let rz = rand4u(zi, wi, xi, yi);
//           let rw = rand4u(wi, xi, yi, zi);

//           let px = f32(xi) + rx;
//           let py = f32(yi) + ry;
//           let pz = f32(zi) + rz;
//           let pw = f32(wi) + rw;

//           let dxv = px - p.x;
//           let dyv = py - p.y;
//           let dzv = pz - p.z;
//           let dwv = pw - p.w;
//           let d2 = dxv * dxv + dyv * dyv + dzv * dzv + dwv * dwv;
//           if (d2 < minDistSq) { minDistSq = d2; }
//         }
//       }
//     }
//   }

//   return sqrt(minDistSq);
// }


fn cellular3D(p : vec3<f32>) -> f32 {
    let fx = i32(floor(p.x));
    let fy = i32(floor(p.y));
    let fz = i32(floor(p.z));
    var d1 : f32 = 1e9; var d2 : f32 = 1e9;
    for (var dz = -1; dz <= 1; dz++) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          let xi = fx + dx; let yi = fy + dy; let zi = fz + dz;
          let px = f32(xi) + rand3u(xi, yi, zi);
          let py = f32(yi) + rand3u(yi, zi, xi);
          let pz = f32(zi) + rand3u(zi, xi, yi);
          let dd = (px - p.x)*(px - p.x) + (py - p.y)*(py - p.y) + (pz - p.z)*(pz - p.z);
          if (dd < d1) { d2 = d1; d1 = dd; }
          else if (dd < d2) { d2 = dd; }
        }
      }
    }
    return d2 - d1;
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  2-D Simplex  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn simplex2D(p : vec2<f32>) -> f32 {
  let F2 : f32 = 0.3660254037844386;  // (\u221A3-1)/2
  let G2 : f32 = 0.2113248654051871;  // (3-\u221A3)/6

  // Skew to simplex grid
  let s  = (p.x + p.y) * F2;
  let i  = i32(floor(p.x + s));
  let j  = i32(floor(p.y + s));
  let t  = f32(i + j) * G2;

  let X0 = f32(i) - t;
  let Y0 = f32(j) - t;
  let x0 = p.x - X0;
  let y0 = p.y - Y0;

  // Simplex corner order
  var i1u : u32 = 0u;
  var j1u : u32 = 0u;
  if (x0 > y0) { i1u = 1u; } else { j1u = 1u; }

  // Offsets for remaining corners
  let x1 = x0 - f32(i1u) + G2;
  let y1 = y0 - f32(j1u) + G2;
  let x2 = x0 - 1.0 + 2.0 * G2;
  let y2 = y0 - 1.0 + 2.0 * G2;

  // Hashed gradients (mod 8 for 2D gradient table)
  let ii  = u32(i) & PERM_MASK;
  let jj  = u32(j) & PERM_MASK;
  let gi0 = perm(ii + perm(jj)) & 7u;
  let gi1 = perm(ii + i1u + perm((jj + j1u) & PERM_MASK)) & 7u;
  let gi2 = perm((ii + 1u) + perm((jj + 1u) & PERM_MASK)) & 7u;

  // Contributions from each corner
  var t0 = 0.5 - x0 * x0 - y0 * y0;
  var n0 : f32 = 0.0;
  if (t0 > 0.0) {
    t0 *= t0;
    n0 = t0 * t0 * dot(gradient2(gi0), vec2<f32>(x0, y0));
  }

  var t1 = 0.5 - x1 * x1 - y1 * y1;
  var n1 : f32 = 0.0;
  if (t1 > 0.0) {
    t1 *= t1;
    n1 = t1 * t1 * dot(gradient2(gi1), vec2<f32>(x1, y1));
  }

  var t2 = 0.5 - x2 * x2 - y2 * y2;
  var n2 : f32 = 0.0;
  if (t2 > 0.0) {
    t2 *= t2;
    n2 = t2 * t2 * dot(gradient2(gi2), vec2<f32>(x2, y2));
  }

  // Same scale used in the standard reference implementation
  return 70.0 * (n0 + n1 + n2);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 3-D Simplex Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Call it like: let v = simplex3D(vec3<f32>(x,y,z));

fn simplex3D(pos : vec3<f32>) -> f32 {
    // Skew/\u200Bunskew factors for 3D
    let F3 : f32 = 1.0 / 3.0;
    let G3 : f32 = 1.0 / 6.0;

    // Skew the input space to find the simplex cell
    let s  = (pos.x + pos.y + pos.z) * F3;
    let i_f = floor(pos.x + s);
    let j_f = floor(pos.y + s);
    let k_f = floor(pos.z + s);

    let i = i32(i_f);
    let j = i32(j_f);
    let k = i32(k_f);

    // Unskew back to (x,y,z) space
    let t0 = f32(i + j + k) * G3;
    let X0 = f32(i) - t0;
    let Y0 = f32(j) - t0;
    let Z0 = f32(k) - t0;

    var x0 = pos.x - X0;
    var y0 = pos.y - Y0;
    var z0 = pos.z - Z0;

    // Determine which simplex we are in
    var i1: i32; var j1: i32; var k1: i32;
    var i2: i32; var j2: i32; var k2: i32;
    if (x0 >= y0) {
        if (y0 >= z0) {
            // X Y Z
            i1 = 1; j1 = 0; k1 = 0;
            i2 = 1; j2 = 1; k2 = 0;
        } else if (x0 >= z0) {
            // X Z Y
            i1 = 1; j1 = 0; k1 = 0;
            i2 = 1; j2 = 0; k2 = 1;
        } else {
            // Z X Y
            i1 = 0; j1 = 0; k1 = 1;
            i2 = 1; j2 = 0; k2 = 1;
        }
    } else {
        if (y0 < z0) {
            // Z Y X
            i1 = 0; j1 = 0; k1 = 1;
            i2 = 0; j2 = 1; k2 = 1;
        } else if (x0 < z0) {
            // Y Z X
            i1 = 0; j1 = 1; k1 = 0;
            i2 = 0; j2 = 1; k2 = 1;
        } else {
            // Y X Z
            i1 = 0; j1 = 1; k1 = 0;
            i2 = 1; j2 = 1; k2 = 0;
        }
    }

    // Offsets for the other three corners
    let x1 = x0 - f32(i1) + G3;
    let y1 = y0 - f32(j1) + G3;
    let z1 = z0 - f32(k1) + G3;

    let x2 = x0 - f32(i2) + 2.0 * G3;
    let y2 = y0 - f32(j2) + 2.0 * G3;
    let z2 = z0 - f32(k2) + 2.0 * G3;

    let x3 = x0 - 1.0 + 3.0 * G3;
    let y3 = y0 - 1.0 + 3.0 * G3;
    let z3 = z0 - 1.0 + 3.0 * G3;

    // Hash the corner indices to get gradient indices
    let ii = u32(i) & PERM_MASK;
    let jj = u32(j) & PERM_MASK;
    let kk = u32(k) & PERM_MASK;

    let gi0 = perm(ii + perm(jj + perm(kk)))        % 12u;
    let gi1 = perm(ii + u32(i1) + perm((jj + u32(j1)) + perm((kk + u32(k1))))) % 12u;
    let gi2 = perm(ii + u32(i2) + perm((jj + u32(j2)) + perm((kk + u32(k2))))) % 12u;
    let gi3 = perm(ii + 1u      + perm((jj + 1u     ) + perm((kk + 1u     )))) % 12u;

    // Compute contributions from each corner
    var n0: f32;
    var t_0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (t_0 < 0.0) {
        n0 = 0.0;
    } else {
        let t2 = t_0 * t_0;
        n0 = t2 * t2 * dot(gradient(gi0), vec3<f32>(x0, y0, z0));
    }

    var n1: f32;
    var t_1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t_1 < 0.0) {
        n1 = 0.0;
    } else {
        let t2 = t_1 * t_1;
        n1 = t2 * t2 * dot(gradient(gi1), vec3<f32>(x1, y1, z1));
    }

    var n2: f32;
    var t_2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t_2 < 0.0) {
        n2 = 0.0;
    } else {
        let t2 = t_2 * t_2;
        n2 = t2 * t2 * dot(gradient(gi2), vec3<f32>(x2, y2, z2));
    }

    var n3: f32;
    var t_3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t_3 < 0.0) {
        n3 = 0.0;
    } else {
        let t2 = t_3 * t_3;
        n3 = t2 * t2 * dot(gradient(gi3), vec3<f32>(x3, y3, z3));
    }

    // Final scale to match [-1,1]
    return 32.0 * (n0 + n1 + n2 + n3);
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  helpers  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/

fn cubicInterpolate(p0 : f32, p1 : f32, p2 : f32, p3 : f32, t : f32) -> f32 {
    return p1 + 0.5 * t *
        (p2 - p0 + t *
        (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3 + t *
        (3.0 * (p1 - p2) + p3 - p0)));
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Fast Lanczos 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn lanczos2D(pos : vec2<f32>) -> f32 {
    let ix  : i32 = i32(floor(pos.x));
    let iy  : i32 = i32(floor(pos.y));
    let dx  : f32 = pos.x - f32(ix);
    let dy  : f32 = pos.y - f32(iy);

    /* 4\xD74 neighbourhood hashed once \u2014 unrolled for speed */
    let n00 = rand2(ix - 1, iy - 1);
    let n10 = rand2(ix + 0, iy - 1);
    let n20 = rand2(ix + 1, iy - 1);
    let n30 = rand2(ix + 2, iy - 1);

    let n01 = rand2(ix - 1, iy + 0);
    let n11 = rand2(ix + 0, iy + 0);
    let n21 = rand2(ix + 1, iy + 0);
    let n31 = rand2(ix + 2, iy + 0);

    let n02 = rand2(ix - 1, iy + 1);
    let n12 = rand2(ix + 0, iy + 1);
    let n22 = rand2(ix + 1, iy + 1);
    let n32 = rand2(ix + 2, iy + 1);

    let n03 = rand2(ix - 1, iy + 2);
    let n13 = rand2(ix + 0, iy + 2);
    let n23 = rand2(ix + 1, iy + 2);
    let n33 = rand2(ix + 2, iy + 2);

    /* cubic along x (columns) */
    let col0 = cubicInterpolate(n00, n10, n20, n30, dx);
    let col1 = cubicInterpolate(n01, n11, n21, n31, dx);
    let col2 = cubicInterpolate(n02, n12, n22, n32, dx);
    let col3 = cubicInterpolate(n03, n13, n23, n33, dx);

    /* cubic along y (rows)  */
    return cubicInterpolate(col0, col1, col2, col3, dy);
}


/* helper to fetch one z-slice and cubic-interpolate along x/y */
fn slice(ix : i32, iy : i32, iz : i32, dx : f32, dy : f32) -> f32 {
    let n00 = rand3(ix - 1, iy - 1, iz);
    let n10 = rand3(ix + 0, iy - 1, iz);
    let n20 = rand3(ix + 1, iy - 1, iz);
    let n30 = rand3(ix + 2, iy - 1, iz);

    let n01 = rand3(ix - 1, iy + 0, iz);
    let n11 = rand3(ix + 0, iy + 0, iz);
    let n21 = rand3(ix + 1, iy + 0, iz);
    let n31 = rand3(ix + 2, iy + 0, iz);

    let n02 = rand3(ix - 1, iy + 1, iz);
    let n12 = rand3(ix + 0, iy + 1, iz);
    let n22 = rand3(ix + 1, iy + 1, iz);
    let n32 = rand3(ix + 2, iy + 1, iz);

    let n03 = rand3(ix - 1, iy + 2, iz);
    let n13 = rand3(ix + 0, iy + 2, iz);
    let n23 = rand3(ix + 1, iy + 2, iz);
    let n33 = rand3(ix + 2, iy + 2, iz);

    let col0 = cubicInterpolate(n00, n10, n20, n30, dx);
    let col1 = cubicInterpolate(n01, n11, n21, n31, dx);
    let col2 = cubicInterpolate(n02, n12, n22, n32, dx);
    let col3 = cubicInterpolate(n03, n13, n23, n33, dx);

    return cubicInterpolate(col0, col1, col2, col3, dy);
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Fast Lanczos 3-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn lanczos3D(pos : vec3<f32>) -> f32 {
    let ix : i32 = i32(floor(pos.x));
    let iy : i32 = i32(floor(pos.y));
    let iz : i32 = i32(floor(pos.z));
    let dx : f32 = pos.x - f32(ix);
    let dy : f32 = pos.y - f32(iy);
    let dz : f32 = pos.z - f32(iz);

    /* 4\xD74\xD74 neighbourhood \u2014 fetch & interpolate on-the-fly */

    let row0 = slice(ix, iy, iz - 1, dx, dy);
    let row1 = slice(ix, iy, iz + 0, dx, dy);
    let row2 = slice(ix, iy, iz + 1, dx, dy);
    let row3 = slice(ix, iy, iz + 2, dx, dy);

    return cubicInterpolate(row0, row1, row2, row3, dz);
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Voronoi 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn voronoi2D(pos : vec2<f32>) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));

    var minDist : f32 = 1e9;
    var minVal  : f32 = 0.0;

    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
            let xi = fx + dx;
            let yi = fy + dy;

            let px = f32(xi) + rand2u(xi, yi);
            let py = f32(yi) + rand2u(yi, xi);

            let dist = (px - pos.x) * (px - pos.x) +
                       (py - pos.y) * (py - pos.y);

            if (dist < minDist) {
                minDist = dist;
                minVal  = rand2u(xi, yi);
            }
        }
    }
    return minVal;          // in [0,1]
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Voronoi 3-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
// fn voronoi3D(pos : vec3<f32>) -> f32 {
//     let fx : i32 = i32(floor(pos.x));
//     let fy : i32 = i32(floor(pos.y));
//     let fz : i32 = i32(floor(pos.z));

//     var minDist : f32 = 1e9;
//     var minVal  : f32 = 0.0;

//     for (var dz : i32 = -1; dz <= 1; dz = dz + 1) {
//         for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
//             for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
//                 let xi = fx + dx;
//                 let yi = fy + dy;
//                 let zi = fz + dz;

//                 let px = f32(xi) + rand3u(xi, yi, zi);
//                 let py = f32(yi) + rand3u(yi, zi, xi);
//                 let pz = f32(zi) + rand3u(zi, xi, yi);

//                 let dist = (px - pos.x) * (px - pos.x) +
//                            (py - pos.y) * (py - pos.y) +
//                            (pz - pos.z) * (pz - pos.z);

//                 if (dist < minDist) {
//                     minDist = dist;
//                     minVal  = rand3u(xi, yi, zi);
//                 }
//             }
//         }
//     }
//     return minVal;          // in [0,1]
// }



// ----------------- types & mode constants -----------------
struct Voro3DMetrics { f1Sq: f32, f2Sq: f32, cellVal: f32, };
struct Voro4DMetrics { f1Sq: f32, f2Sq: f32, cellVal: f32, };

// ----------------- voro_eval: pick output depending on mode -----------------


const VORO_CELL            : u32 = 0u;
const VORO_F1              : u32 = 1u;
const VORO_INTERIOR        : u32 = 2u;  // gap = F2 - F1
const VORO_EDGES           : u32 = 3u;  // scaled gap
const VORO_EDGE_THRESH     : u32 = 4u;  // gate gap >= threshold
const VORO_FLAT_SHADE      : u32 = 5u;  // interior = 1, edges = 0 (edges defined by gap < threshold)
const VORO_FLAT_SHADE_INV  : u32 = 6u;  // edges = 1, interior = 0 (gap < threshold)

// Added: "old cellular3D" compatible squared-gap modes (F2^2 - F1^2)
const VORO_INTERIOR_SQ        : u32 = 7u;  // gapSq = F2^2 - F1^2
const VORO_EDGES_SQ           : u32 = 8u;  // scaled gapSq
const VORO_EDGE_THRESH_SQ     : u32 = 9u;  // gate gapSq >= threshold
const VORO_FLAT_SHADE_SQ      : u32 = 10u; // interior = 1, edges = 0 (gapSq < threshold)
const VORO_FLAT_SHADE_INV_SQ  : u32 = 11u; // edges = 1, interior = 0 (gapSq < threshold)

// Added: F1 threshold and masks (useful for "radius" gates, bubble masks, etc.)
const VORO_F1_THRESH      : u32 = 12u; // gate F1 >= threshold, returns F1 * gate
const VORO_F1_MASK        : u32 = 13u; // smooth mask: 0 below threshold, 1 above (feather=edgeK)
const VORO_F1_MASK_INV    : u32 = 14u; // inverted mask: 1 below threshold, 0 above (feather=edgeK)

// Added: softer edge line response (no threshold needed)
const VORO_EDGE_RCP       : u32 = 15u; // 1 / (1 + gap*k)
const VORO_EDGE_RCP_SQ    : u32 = 16u; // 1 / (1 + gapSq*k)

fn voro_edge_dist(f1Sq: f32, f2Sq: f32) -> f32 {
  let f1 = sqrt(max(f1Sq, 0.0));
  let f2 = sqrt(max(f2Sq, 0.0));
  return max(f2 - f1, 0.0);
}

// edgeDist is gap (or gapSq for *_SQ modes)
// returns 1 near edges (small edgeDist), 0 in interior
fn voro_edge_mask(edgeDist: f32, threshold: f32, feather: f32) -> f32 {
  let t = max(threshold, 0.0);
  if (t <= 0.0) { return 0.0; }

  let f = max(feather, 0.0);
  if (f > 0.0) {
    return 1.0 - smoothstep(t, t + f, edgeDist);
  }
  return select(0.0, 1.0, edgeDist < t);
}

// returns 0 below threshold, 1 above (optionally smoothed)
fn voro_thresh_mask(v: f32, threshold: f32, feather: f32) -> f32 {
  let t = max(threshold, 0.0);
  if (t <= 0.0) { return 0.0; }

  let f = max(feather, 0.0);
  if (f > 0.0) {
    return smoothstep(t, t + f, v);
  }
  return select(0.0, 1.0, v >= t);
}

fn voro_eval3D_metrics(m: Voro3DMetrics, params: NoiseParams, freqOrScale: f32) -> f32 {
  return voro_eval(
    m.f1Sq,
    m.f2Sq,
    m.cellVal,
    params.voroMode,
    max(params.edgeK, 0.0),
    max(params.threshold, 0.0),
    freqOrScale
  );
}

fn voro_legacy_cell_or_eval3D(m: Voro3DMetrics, params: NoiseParams, freqOrScale: f32, legacyCellValue: f32) -> f32 {
  let modeValue = voro_eval3D_metrics(m, params, freqOrScale);
  return select(modeValue, legacyCellValue, params.voroMode == VORO_CELL);
}


// f1Sq/f2Sq are squared distances; cellVal in [0,1].
// edgeK is scale (edges modes) or feather (mask modes). freqOrScale unused.
fn voro_eval(
  f1Sq: f32,
  f2Sq: f32,
  cellVal: f32,
  mode: u32,
  edgeK: f32,
  threshold: f32,
  freqOrScale: f32
) -> f32 {
  let f1 = sqrt(max(f1Sq, 0.0));
  let f2 = sqrt(max(f2Sq, 0.0));
  let gap = max(f2 - f1, 0.0);

  let gapSq = max(f2Sq - f1Sq, 0.0);

  switch (mode) {
    case VORO_CELL: {
      return cellVal;
    }
    case VORO_F1: {
      return f1;
    }
    case VORO_INTERIOR: {
      return gap;
    }
    case VORO_EDGES: {
      let k = max(edgeK, 0.0);
      return clamp(gap * select(10.0, k, k > 0.0), 0.0, 1.0);
    }
    case VORO_EDGE_THRESH: {
      let t = max(threshold, 0.0);
      let gate = select(0.0, 1.0, gap >= t);
      return gap * gate;
    }
    case VORO_FLAT_SHADE: {
      let edge = voro_edge_mask(gap, threshold, edgeK);
      return 1.0 - edge;
    }
    case VORO_FLAT_SHADE_INV: {
      let edge = voro_edge_mask(gap, threshold, edgeK);
      return edge;
    }

    case VORO_INTERIOR_SQ: {
      return gapSq;
    }
    case VORO_EDGES_SQ: {
      let k = max(edgeK, 0.0);
      return clamp(gapSq * select(10.0, k, k > 0.0), 0.0, 1.0);
    }
    case VORO_EDGE_THRESH_SQ: {
      let t = max(threshold, 0.0);
      let gate = select(0.0, 1.0, gapSq >= t);
      return gapSq * gate;
    }
    case VORO_FLAT_SHADE_SQ: {
      let edge = voro_edge_mask(gapSq, threshold, edgeK);
      return 1.0 - edge;
    }
    case VORO_FLAT_SHADE_INV_SQ: {
      let edge = voro_edge_mask(gapSq, threshold, edgeK);
      return edge;
    }

    case VORO_F1_THRESH: {
      let t = max(threshold, 0.0);
      let gate = select(0.0, 1.0, f1 >= t);
      return f1 * gate;
    }
    case VORO_F1_MASK: {
      return voro_thresh_mask(f1, threshold, edgeK);
    }
    case VORO_F1_MASK_INV: {
      return 1.0 - voro_thresh_mask(f1, threshold, edgeK);
    }

    case VORO_EDGE_RCP: {
      let k = max(edgeK, 0.0);
      return 1.0 / (1.0 + gap * k*10);
    }
    case VORO_EDGE_RCP_SQ: {
      let k = max(edgeK, 0.0);
      return 1.0 / (1.0 + gapSq * k*10);
    }

    default: {
      return gap;
    }
  }
}

// ----------------- helpers: metrics -----------------
fn voro3D_metrics(pos: vec3<f32>) -> Voro3DMetrics {
  let fx = i32(floor(pos.x));
  let fy = i32(floor(pos.y));
  let fz = i32(floor(pos.z));

  var d1 : f32 = 1e9;
  var d2 : f32 = 1e9;
  var lab: f32 = 0.0;

  for (var dz = -1; dz <= 1; dz = dz + 1) {
    for (var dy = -1; dy <= 1; dy = dy + 1) {
      for (var dx = -1; dx <= 1; dx = dx + 1) {
        let xi = fx + dx; let yi = fy + dy; let zi = fz + dz;

        let rx = rand3u(xi, yi, zi);
        let ry = rand3u(yi, zi, xi);
        let rz = rand3u(zi, xi, yi);

        let px = f32(xi) + rx;
        let py = f32(yi) + ry;
        let pz = f32(zi) + rz;

        let dxv = px - pos.x;
        let dyv = py - pos.y;
        let dzv = pz - pos.z;

        let d2c = dxv*dxv + dyv*dyv + dzv*dzv;

        if (d2c < d1) {
          d2 = d1;
          d1 = d2c;
          lab = rand3u(xi, yi, zi);
        } else if (d2c < d2) {
          d2 = d2c;
        }
      }
    }
  }
  return Voro3DMetrics(d1, d2, lab);
}

fn voro4D_metrics(p: vec4<f32>) -> Voro4DMetrics {
  let fx = i32(floor(p.x));
  let fy = i32(floor(p.y));
  let fz = i32(floor(p.z));
  let fw = i32(floor(p.w));

  var d1 : f32 = 1e9;
  var d2 : f32 = 1e9;
  var lab: f32 = 0.0;

  for (var dw = -1; dw <= 1; dw = dw + 1) {
    for (var dz = -1; dz <= 1; dz = dz + 1) {
      for (var dy = -1; dy <= 1; dy = dy + 1) {
        for (var dx = -1; dx <= 1; dx = dx + 1) {
          let xi = fx + dx; let yi = fy + dy; let zi = fz + dz; let wi = fw + dw;

          let rx = rand4u(xi, yi, zi, wi);
          let ry = rand4u(yi, zi, wi, xi);
          let rz = rand4u(zi, wi, xi, yi);
          let rw = rand4u(wi, xi, yi, zi);

          let px = f32(xi) + rx;
          let py = f32(yi) + ry;
          let pz = f32(zi) + rz;
          let pw = f32(wi) + rw;

          let dxv = px - p.x; let dyv = py - p.y;
          let dzv = pz - p.z; let dwv = pw - p.w;

          let d2c = dxv*dxv + dyv*dyv + dzv*dzv + dwv*dwv;

          if (d2c < d1) {
            d2 = d1;
            d1 = d2c;
            lab = rand4u(xi, yi, zi, wi);
          } else if (d2c < d2) {
            d2 = d2c;
          }
        }
      }
    }
  }
  return Voro4DMetrics(d1, d2, lab);
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Cellular 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn cellular2D(pos : vec2<f32>) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));

    var minDist1 : f32 = 1e9;
    var minDist2 : f32 = 1e9;

    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
            let xi = fx + dx;
            let yi = fy + dy;

            /* feature point */
            let px = f32(xi) + rand2u(xi, yi);
            let py = f32(yi) + rand2u(yi, xi);

            /* squared distance */
            let d = (px - pos.x) * (px - pos.x)
                  + (py - pos.y) * (py - pos.y);

            /* keep two smallest distances */
            if (d < minDist1) {
                minDist2 = minDist1;
                minDist1 = d;
            } else if (d < minDist2) {
                minDist2 = d;
            }
        }
    }
    /* return difference of 1st and 2nd nearest feature distances */
    return minDist2 - minDist1;
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Worley 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn worley2D(pos : vec2<f32>) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));

    var minDist : f32 = 1e9;

    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
            let xi = fx + dx;
            let yi = fy + dy;

            /* feature point */
            let px = f32(xi) + rand2u(xi, yi);
            let py = f32(yi) + rand2u(yi, xi);

            /* squared distance */
            let d = (px - pos.x) * (px - pos.x)
                  + (py - pos.y) * (py - pos.y);

            if (d < minDist) {
                minDist = d;
            }
        }
    }

    return sqrt(minDist);    // Euclidean distance to nearest feature
}

/* central-diff gradient of scalar simplex */
fn gradSimplex2(q: vec2<f32>, eps: f32) -> vec2<f32> {
  let dx = (simplex2D(q + vec2<f32>(eps, 0.0)) - simplex2D(q - vec2<f32>(eps, 0.0))) / (2.0 * eps);
  let dy = (simplex2D(q + vec2<f32>(0.0, eps)) - simplex2D(q - vec2<f32>(0.0, eps))) / (2.0 * eps);
  return vec2<f32>(dx, dy);
}

/* single-octave curl = grad rotated 90\xB0 (\u2202N/\u2202y, -\u2202N/\u2202x) */
fn curl2_simplex2D(pos: vec2<f32>, p: NoiseParams) -> vec2<f32> {
  let zoom = max(p.zoom, 1e-6);
  let freq = max(p.freq, 1e-6);
  let base = pos / zoom + vec2<f32>(p.xShift, p.yShift);
  let q = base * freq;

  // choose \u03B5 ~ half a cycle of current scale to avoid lattice aliasing
  let cycles_per_world = max(freq / zoom, 1e-6);
  let eps = 0.5 / cycles_per_world;

  let g = gradSimplex2(q, eps * freq);
  return vec2<f32>(g.y, -g.x);
}

/* multi-octave curl: sum derivatives per octave (no sharp creases) */
fn curl2_simplexFBM(pos: vec2<f32>, p: NoiseParams) -> vec2<f32> {
  let zoom = max(p.zoom, 1e-6);
  var q      = pos / zoom + vec2<f32>(p.xShift, p.yShift);
  var freq   : f32 = max(p.freq, 1e-6);
  var amp    : f32 = 1.0;
  var angle  : f32 = p.seedAngle;
  var curl   : vec2<f32> = vec2<f32>(0.0);

  for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {
    // \u03B5 scales with octave so the finite difference stays well-conditioned
    let cycles_per_world = max(freq / zoom, 1e-6);
    let eps = 0.5 / cycles_per_world;

    let g = gradSimplex2(q * freq, eps * freq);
    curl += vec2<f32>(g.y, -g.x) * amp;

    // next octave
    freq *= p.lacunarity;
    amp  *= p.gain;

    // decorrelate like your Perlin path (XY rotate + shift bleed into next)
    let cA = cos(angle);
    let sA = sin(angle);
    let nx = q.x * cA - q.y * sA;
    let ny = q.x * sA + q.y * cA;
    q = vec2<f32>(nx, ny) + vec2<f32>(p.xShift, p.yShift);
    angle += ANGLE_INCREMENT;
  }
  return curl;
}

/* map a non-negative magnitude to [-1,1] for your writeChannel convention */
fn mag_to_signed01(m: f32) -> f32 {
  return clamp(m, 0.0, 1.0) * 2.0 - 1.0;
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Domain-warp FBM  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn domainWarpFBM(p: vec3<f32>, params: NoiseParams,
                 warpAmp: f32, stages: u32) -> f32 {
    var q = p;
    for (var i: u32 = 0u; i < stages; i = i + 1u) {
        let w = fbm3D(q, params) * warpAmp;
        q = q + vec3<f32>(w, w, w);
    }
    return fbm3D(q, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 gabor utils \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const TAU : f32 = 6.283185307179586;

fn saturate(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }

fn hash_u32(x: u32) -> u32 {
  var v = x;
  v = (v ^ 61u) ^ (v >> 16u);
  v = v + (v << 3u);
  v = v ^ (v >> 4u);
  v = v * 0x27d4eb2du;
  v = v ^ (v >> 15u);
  return v;
}

fn hash3_u32(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> u32 {
  let x = u32(ix) * 73856093u;
  let y = u32(iy) * 19349663u;
  let z = u32(iz) * 83492791u;
  return hash_u32(x ^ y ^ z ^ seed ^ salt);
}

fn rnd01(h: u32) -> f32 {
  return f32(h) * (1.0 / 4294967295.0);
}

fn rand3_01(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> f32 {
  return rnd01(hash3_u32(ix, iy, iz, seed, salt));
}

fn rand3_vec3(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> vec3<f32> {
  let a = rand3_01(ix, iy, iz, seed, salt + 0u);
  let b = rand3_01(ix, iy, iz, seed, salt + 1u);
  let c = rand3_01(ix, iy, iz, seed, salt + 2u);
  return vec3<f32>(a, b, c);
}

fn rand_unit_vec3(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> vec3<f32> {
  let u = rand3_01(ix, iy, iz, seed, salt + 0u);
  let v = rand3_01(ix, iy, iz, seed, salt + 1u);

  let z = 1.0 - 2.0 * u;
  let r = sqrt(max(0.0, 1.0 - z * z));
  let a = TAU * v;

  return vec3<f32>(r * cos(a), r * sin(a), z);
}

fn gabor_kernel3D(d: vec3<f32>, dir: vec3<f32>, waveFreq: f32, sigma: f32, phase: f32) -> f32 {
  let s  = max(0.0005, sigma);
  let g  = exp(-dot(d, d) / (2.0 * s * s));
  let w  = cos(TAU * waveFreq * dot(dir, d) + phase);
  return g * w;
}

fn gaborWarpDomain(p: vec3<f32>, params: NoiseParams) -> vec3<f32> {
  let a = params.warpAmp;
  if (a <= 0.00001) { return p; }

  let w1 = simplex3D(p * 0.75 + vec3<f32>(13.1, 7.7, 19.3));
  let w2 = simplex3D(p * 0.75 + vec3<f32>(41.7, 23.9, 5.3));
  let w3 = simplex3D(p * 0.75 + vec3<f32>(9.9, 31.3, 17.7));

  return p + vec3<f32>(w1, w2, w3) * a;
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Gabor sparse-convolution  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn gaborOctave3D(p: vec3<f32>, waveFreq: f32, sigma: f32, params: NoiseParams) -> f32 {
  let base = vec3<i32>(
    i32(floor(p.x)),
    i32(floor(p.y)),
    i32(floor(p.z))
  );

  var sum: f32 = 0.0;

  for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {
    for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {
      for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {
        let cx = base.x + dx;
        let cy = base.y + dy;
        let cz = base.z + dz;

        let jitter = rand3_vec3(cx, cy, cz, params.seed, 11u) - vec3<f32>(0.5, 0.5, 0.5);
        let center = vec3<f32>(f32(cx), f32(cy), f32(cz)) + vec3<f32>(0.5, 0.5, 0.5) + jitter * 0.95;

        let d     = p - center;
        let dir   = rand_unit_vec3(cx, cy, cz, params.seed, 41u);
        let phase = TAU * rand3_01(cx, cy, cz, params.seed, 71u);
        let amp   = rand3_01(cx, cy, cz, params.seed, 91u) * 2.0 - 1.0;

        sum += amp * gabor_kernel3D(d, dir, waveFreq, sigma, phase);
      }
    }
  }

  return sum * (1.0 / 9.0);
}

fn gaborShape(n: f32, params: NoiseParams) -> f32 {
  var v = 0.5 + 0.5 * clamp(n, -1.0, 1.0);

  let widen = max(0.0, params.gaborRadius) * max(0.0001, params.exp2);
  v = pow(saturate(v), 1.0 / (1.0 + widen));

  let t    = saturate(params.threshold);
  let hard = max(0.0001, params.exp1);

  let a = smoothstep(t - hard, t + hard, v);
  return a * 2.0 - 1.0;
}

fn gaborCellEdgeMask2D(cellP: vec2<f32>, edgeK: f32) -> f32 {
  let k = max(0.0, edgeK);
  if (k <= 0.00001) { return 1.0; }

  let width = select(k, 0.5 / k, k > 0.5);
  let w = clamp(width, 0.00001, 0.5);

  let f  = fract(cellP);
  let dx = min(f.x, 1.0 - f.x);
  let dy = min(f.y, 1.0 - f.y);
  let d  = min(dx, dy);

  return smoothstep(0.0, w, d);
}

/* Multi-octave Gabor with per-octave cell-edge fade */
fn gaborNoise3D(p: vec3<f32>, params: NoiseParams) -> f32 {
  var x = p.x / params.zoom + params.xShift;
  var y = p.y / params.zoom + params.yShift;
  var z = p.z / params.zoom + params.zShift;

  var sum     : f32 = 0.0;
  var amp     : f32 = 1.0;
  var freqLoc : f32 = max(params.freq, 1e-6);
  var angle   : f32 = params.seedAngle;

  let waveFreq = max(0.001, params.rippleFreq);

  var minMask : f32 = 1.0;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let sigma = max(0.0005, params.gaborRadius);

    var pp = vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc);
    pp = gaborWarpDomain(pp, params);

    let edgeM = gaborCellEdgeMask2D(pp.xy, params.edgeK);
    minMask = min(minMask, edgeM);

    var n = gaborOctave3D(pp, waveFreq, sigma, params);

    if (params.turbulence == 1u) {
      n = abs(n) * edgeM;
    } else {
      n = (-1.0) + (n + 1.0) * edgeM;
    }

    sum += n * amp;

    freqLoc *= params.lacunarity;
    amp     *= params.gain;

    let c  = cos(angle);
    let s  = sin(angle);
    let nx = x * c - y * s;
    let ny = x * s + y * c;
    let nz = y * s + z * c;

    x = nx + params.xShift;
    y = ny + params.yShift;
    z = nz + params.zShift;

    angle += ANGLE_INCREMENT;
  }

  if (params.turbulence == 1u) {
    sum = mix(-1.0, sum, minMask);
  }

  var out = gaborShape(sum, params);
  if (params.turbulence == 1u) { out = out - 1.0; }
  return out;
}

fn gaborFlowKernel3D(r: vec3<f32>, d: vec2<f32>, ex: f32, ey: f32, ez: f32, c: f32, phase: f32) -> f32 {
  let rx = dot(r.xy, d);
  let ry = dot(r.xy, vec2<f32>(d.y, -d.x));
  let g  = exp(ex * rx * rx + ey * ry * ry + ez * r.z * r.z);
  let w  = cos(c * rx + phase);
  return g * w;
}

fn gaborMagicNoise3D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let sizeF = select(12.0, par.terraceStep, par.terraceStep > 0.00001);
  let size  = max(1, i32(clamp(sizeF, 1.0, 48.0) + 0.5));

  let zRad  = i32(2u);

  let sig = max(0.0005, par.gaborRadius);
  let gam = max(0.0001, par.exp2);

  let sx = sig;
  let sy = sig / gam;
  let sz = sig;

  let ex = -0.5 / (sx * sx);
  let ey = -0.5 / (sy * sy);
  let ez = -0.5 / (sz * sz);

  let lam = max(0.001, par.rippleFreq);
  let c   = TAU / lam;

  let P = 0.1963495408; // PI/16

  var cs: array<vec2<f32>, 16>;
  var ph: array<f32, 16>;
  var acc: array<f32, 16>;

  for (var k: u32 = 0u; k < 16u; k = k + 1u) {
    acc[k] = 0.0;
    let a = f32(k) * P;
    cs[k] = vec2<f32>(cos(a), sin(a));
    ph[k] = TAU * rand3_01(i32(k), 0, 0, par.seed, 71u);
  }

  let base = vec3<f32>(
    p.x / par.zoom + par.xShift,
    p.y / par.zoom + par.yShift,
    p.z / par.zoom + par.zShift
  );

  let adv = vec3<f32>(par.time * 10.0, par.time * 10.0, par.time * 3.0);

  let seedOff = vec3<f32>(
    f32(par.seed & 1023u) * 23.17,
    f32((par.seed >> 10u) & 1023u) * 19.73,
    f32((par.seed >> 20u) & 1023u) * 17.11
  );

  let fscale = 0.1 * max(0.0001, par.freq);

  let phaseT = TAU * (par.time / lam);

  for (var dz: i32 = -zRad; dz <= zRad; dz = dz + 1) {
    for (var j: i32 = -size; j <= size; j = j + 1) {
      for (var i: i32 = -size; i <= size; i = i + 1) {
        let r = vec3<f32>(f32(i), f32(j), f32(dz));

        var sp = (base + r + adv + seedOff) * fscale;
        sp = gaborWarpDomain(sp, par);

        let src = 0.6 * (0.5 + 0.5 * noise3D(sp));

        for (var k: u32 = 0u; k < 16u; k = k + 1u) {
          acc[k] += src * gaborFlowKernel3D(r, cs[k], ex, ey, ez, c, ph[k] + phaseT);
        }
      }
    }
  }

  var mx: f32 = 0.0;
  for (var k: u32 = 0u; k < 16u; k = k + 1u) {
    mx = max(mx, acc[k]);
  }

  var v01 = saturate((mx / 10.0) * max(0.0001, par.gain));

  if (par.threshold > 0.00001) {
    let t    = saturate(par.threshold);
    let hard = max(0.0001, par.exp1);
    v01 = smoothstep(t - hard, t + hard, v01);
  }

  return v01 * 2.0 - 1.0;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 flow-gabor helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

fn hash2f01(p: vec2<f32>, seed: u32) -> f32 {
  let h = sin(dot(p, vec2<f32>(12.9898, 78.233)) + f32(seed) * 0.000123);
  return fract(h * 43758.5453);
}

fn mnoise3D(p: vec3<f32>, mode: u32) -> f32 {
  let n = noise3D(p); // ~[-1,1]
  if (mode == 1u) { return -1.0 + 2.0 * abs(n); }          // cloud-like
  if (mode == 2u) { return -1.0 + 2.0 * (1.0 - abs(n)); }  // flame-like
  return n;
}

fn turb2D(U: vec2<f32>, t: f32, par: NoiseParams) -> f32 {
  var u = U;
  var tt = t;

  var f: f32 = 0.0;
  var q: f32 = 1.0;
  var s: f32 = 0.0;

  let m: f32 = 2.0;
  let iters: u32 = clamp(par.octaves, 1u, 4u);

  for (var i: u32 = 0u; i < 4u; i = i + 1u) {
    if (i >= iters) { break; }

    u -= tt * vec2<f32>(0.6, 0.2);
    f += q * mnoise3D(vec3<f32>(u, tt), par.voroMode);
    s += q;

    q *= 0.5;
    u *= m;
    tt *= 1.71;
  }

  return f / max(1e-6, s);
}

fn flowDir2D(U: vec2<f32>, t: f32, par: NoiseParams) -> vec2<f32> {
  let eps: f32 = 1e-3;
  let S: f32 = max(1e-4, par.freq);

  let a = turb2D(S * (U + vec2<f32>(0.0, -eps)), t, par);
  let b = turb2D(S * (U + vec2<f32>(0.0,  eps)), t, par);
  let c = turb2D(S * (U + vec2<f32>( eps, 0.0)), t, par);
  let d = turb2D(S * (U + vec2<f32>(-eps, 0.0)), t, par);

  var V = vec2<f32>((a - b), (c - d)) / eps;

  let l2 = dot(V, V);
  if (l2 < 1e-20) { V = vec2<f32>(1.0, 0.0); }
  else { V *= inverseSqrt(l2); }

  // optional: rotate into "normal field" (like the shadertoy toggle)
  if ((par.voroMode & 4u) != 0u) { V = vec2<f32>(-V.y, V.x); }

  return V;
}

fn gaborPhasorFlow(U: vec2<f32>, V: vec2<f32>, par: NoiseParams) -> vec2<f32> {
  let F: f32 = max(1e-4, par.rippleFreq);

  let Wf = select(12.0, par.terraceStep, par.terraceStep > 0.00001);
  let W  = max(1, i32(clamp(Wf, 1.0, 24.0) + 0.5));

  let TG: f32 = par.time * 0.5 * max(0.0, par.warpAmp);

  var s: vec2<f32> = vec2<f32>(0.0);
  var T: f32 = 0.0;

  for (var j: i32 = -W; j <= W; j = j + 1) {
    for (var i: i32 = -W; i <= W; i = i + 1) {
      let P = vec2<f32>(f32(i), f32(j));

      let h = hash2f01(U + P, par.seed);
      let ang = TWO_PI * h - F * dot(P, V) + TG;

      let v = vec2<f32>(cos(ang), sin(ang));

      let d = min(1.0, length(P) / f32(W));
      let K = 0.5 + 0.5 * cos(PI * d); // raised-cosine kernel

      s += v * K;
      T += K;
    }
  }

  return s / max(1e-6, T);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

fn generateGaborFlow(pos: vec3<f32>, par: NoiseParams) -> f32 {
  let zoom = max(par.zoom, 1e-6);

  // reconstruct pixel-ish domain like shadertoy (centered)
  let R = vec2<f32>(max(f32(frame.fullWidth), 1.0), max(f32(frame.fullHeight), 1.0));
  let uPix = vec2<f32>(pos.x * R.x, pos.y * R.y);
  let Uflow = (uPix - 0.5 * R) / R.y;

  // animated flow time
  let t = par.time * 0.2;

  // flow direction
  let V = flowDir2D(Uflow * (1.0 / zoom), t, par);

  // gabor phasor (use centered pixel coords like the reference)
  let s = gaborPhasorFlow((uPix - 0.5 * R) / zoom, V, par);

  // output mode:
  //  - turbulence==0: phasor profile (0..1)
  //  - turbulence==1: contrast (magnitude)
  let l = length(s);
  var v01: f32;

  if (par.turbulence == 1u) {
    v01 = saturate(4.0 * l * max(0.0001, par.gain));
  } else {
    let nx = select(1.0, s.x / l, l > 1e-8);
    v01 = 0.5 + 0.5 * nx;
    v01 = saturate(v01 * max(0.0001, par.gain));
  }

  if (par.threshold > 0.00001) {
    let tt = saturate(par.threshold);
    let hard = max(0.0001, par.exp1);
    v01 = smoothstep(tt - hard, tt + hard, v01);
  }

  return v01 * 2.0 - 1.0;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 compute entry \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

@compute @workgroup_size(8,8,1)
fn computeGaborFlow(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateGaborFlow(p, params), options.outputChannel, 0u);
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Terrace & Foam filters  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn terrace(v:f32, steps:f32)  -> f32 { return floor(v*steps)/steps; }
fn foamify(v: f32) -> f32 {
    let x = clamp(v, 0.0, 1.0);

    let lo = smoothstep(0.18, 0.48, x);
    let hi = 1.0 - smoothstep(0.58, 0.92, x);

    let band = clamp(lo * hi, 0.0, 1.0);
    return pow(band, 0.6);
}
fn turbulence(v:f32)          -> f32 { return abs(v); }

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Simplex (multi-octave) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn generateSimplex(pos: vec3<f32>, p: NoiseParams) -> f32 {
    let invZoom = 1.0 / max(p.zoom, 1e-6);
    let domainOffset = seedOffset3(p.seed);

    let base = vec3<f32>(
      pos.x * invZoom + p.xShift,
      pos.y * invZoom + p.yShift,
      pos.z * invZoom + p.zShift
    ) + domainOffset;

    var sum     : f32 = 0.0;
    var amp     : f32 = 1.0;
    var ampSum  : f32 = 0.0;
    var freqLoc : f32 = max(p.freq, 1e-6);
    var angle   : f32 = p.seedAngle;

    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {
        let samplePos = rotateXY3(base, angle) * freqLoc;
        var n = simplex3D(samplePos);
        if (p.turbulence == 1u) { n = abs(n); }
        sum += n * amp;
        ampSum += amp;

        freqLoc *= p.lacunarity;
        amp     *= p.gain;
        angle   += ANGLE_INCREMENT;
    }

    if (ampSum > 0.0) {
        sum = sum / ampSum;
    }
    if (p.turbulence == 1u) { sum = sum * 2.0 - 1.0; }
    return sum;
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Simplex-based fBm helper (normalized)  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn sfbm3D(pos : vec3<f32>, params: NoiseParams) -> f32 {
    let invZoom = 1.0 / max(params.zoom, 1e-6);
    let domainOffset = seedOffset3(params.seed);

    let base = vec3<f32>(
      pos.x * invZoom + params.xShift,
      pos.y * invZoom + params.yShift,
      pos.z * invZoom + params.zShift
    ) + domainOffset;

    var sum       : f32 = 0.0;
    var amplitude : f32 = 1.0;
    var maxValue  : f32 = 0.0;
    var freqLoc   : f32 = max(params.freq, 1e-6);
    var angle     : f32 = params.seedAngle;
    let angleInc  : f32 = 2.0 * PI / max(f32(params.octaves), 1.0);

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        let samplePos = rotateXY3(base, angle) * freqLoc;
        var n = simplex3D(samplePos);
        if (params.turbulence == 1u) { n = abs(n); }

        sum      += amplitude * n;
        maxValue += amplitude;

        freqLoc   *= params.lacunarity;
        amplitude *= params.gain;
        angle     += angleInc;
    }

    if (maxValue > 0.0) {
        var out = sum / maxValue;
        if (params.turbulence == 1u) {
            out = out * 2.0 - 1.0;
        }
        return out;
    }
    return 0.0;
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Simplex FBM (Perlin-style nested fBm)  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
fn generateSimplexFBM(pos: vec3<f32>, p: NoiseParams) -> f32 {
    // Same  you use for Perlin FBM: fBm once, then feed through again
    let fbm1 = sfbm3D(pos, p);
    let fbm2 = sfbm3D(vec3<f32>(fbm1, fbm1, fbm1), p);
    return 2.0 * fbm2;  // keep roughly in [-1,1]
}

fn generateDomainWarpFBM1(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let v = domainWarpFBM(pos, par, par.warpAmp, 1u);
    return v;
}

fn generateDomainWarpFBM2(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let v = domainWarpFBM(pos, par, par.warpAmp, 2u);
    return v;
}

fn generateGaborAniso(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let v = gaborNoise3D(pos, par);
    return v;
}

fn generateGaborMagic(pos: vec3<f32>, par: NoiseParams) -> f32 {
  return gaborMagicNoise3D(pos, par);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Perlin Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generatePerlin(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let invZoom = 1.0 / max(params.zoom, 1e-6);
  let domainOffset = seedOffset3(params.seed);

  let base = vec3<f32>(
    pos.x * invZoom + params.xShift,
    pos.y * invZoom + params.yShift,
    pos.z * invZoom + params.zShift
  ) + domainOffset;

  var sum: f32 = 0.0;
  var amp: f32 = 1.0;
  var freqLoc: f32 = max(params.freq, 1e-6);
  var angle: f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let samplePos = rotateXY3(base, angle) * freqLoc;

    var n: f32 = noise3D(samplePos);
    if (params.turbulence == 1u) {
      n = abs(n);
    }

    sum += n * amp;

    freqLoc *= params.lacunarity;
    amp *= params.gain;
    angle += ANGLE_INCREMENT;
  }

  if (params.turbulence == 1u) {
    sum = sum - 1.0;
  }

  return sum;
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Perlin FBM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generatePerlin4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  var base: vec4<f32>;
  if (params.toroidal == 1u) {
    base = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;
  } else {
    base = vec4<f32>(
      pos.x / zoom + params.xShift,
      pos.y / zoom + params.yShift,
      pos.z / zoom + params.zShift,
      params.time
    );
  }

  var sum     : f32 = 0.0;
  var amp     : f32 = 1.0;
  var freqLoc : f32 = max(params.freq, 1e-6);
  var angle   : f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    var n = noise4D(base * freqLoc) * amp;
    if (params.turbulence == 1u) { n = abs(n); }
    sum += n;

    freqLoc *= params.lacunarity;
    amp     *= params.gain;

    if (params.toroidal != 1u) {
      let c = cos(angle);
      let s = sin(angle);
      let xy = vec2<f32>( base.x * c - base.y * s, base.x * s + base.y * c );
      let zw = vec2<f32>( base.z * c - base.w * s, base.z * s + base.w * c );
      base = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
      angle += ANGLE_INCREMENT;
    }
  }

  if (params.turbulence == 1u) { sum -= 1.0; }
  return sum;
}


fn generateTerraceNoise(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let base = generatePerlin(pos, par);
    let v = terrace(base, par.terraceStep);
    return v;
}

fn generateFoamNoise(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let base = generateBillow(pos, par);
    let v = foamify(base);
    return v;
}

fn generateTurbulence(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let base = generatePerlin(pos, par);
    let v = turbulence(base);
    return v;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Billow Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateBillow(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);

    var p = pos / zoom + vec3<f32>(params.xShift, params.yShift, params.zShift);

    var sum: f32     = 0.0;
    var amp: f32     = 1.0;
    var freqLoc: f32 = max(params.freq, 1e-6);
    var ampSum: f32  = 0.0;
    var angle: f32   = params.seedAngle;

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let n  = noise3D(p * freqLoc);
        let b  = pow(abs(n), 0.75);
        sum    = sum + b * amp;
        ampSum = ampSum + amp;

        freqLoc = freqLoc * params.lacunarity;
        amp     = amp     * params.gain;

        let c  = cos(angle);
        let s  = sin(angle);
        let xy = vec2<f32>(p.x, p.y);
        let r  = vec2<f32>(xy.x * c - xy.y * s, xy.x * s + xy.y * c);
        p = vec3<f32>(r.x, r.y, p.z + 0.03125);

        angle = angle + ANGLE_INCREMENT;
    }

    if (ampSum > 0.0) {
        sum = sum / ampSum;
    }

    let k: f32 = 1.2;
    let cMid   = sum - 0.5;
    let shaped = 0.5 + cMid * k / (1.0 + abs(cMid) * (k - 1.0));

    return clamp(shaped, 0.0, 1.0);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti-Billow Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateAntiBillow(pos: vec3<f32>, params: NoiseParams) -> f32 {
    return 1.0 - generateBillow(pos, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridge Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// basic ridge transform of gradient noise
fn ridgeNoise(pos : vec3<f32>) -> f32 {
    let v = noise3D(pos);
    let w = 1.0 - abs(v);
    return w * w;
}

// octave\u2010sum generator using ridge noise
// sample like: let r = generateRidge(vec3<f32>(x,y,z));
fn generateRidge(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);

    var x = pos.x / zoom + params.xShift;
    var y = pos.y / zoom + params.yShift;
    var z = pos.z / zoom + params.zShift;
    var sum     : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = max(params.freq, 1e-6);

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        sum = sum + ridgeNoise(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)) * amp;
        freqLoc = freqLoc * params.lacunarity;
        amp     = amp     * params.gain;
        x = x + params.xShift;
        y = y + params.yShift;
        z = z + params.zShift;
    }

    sum = sum - 1.0;
    return -sum;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridge Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// identical ridge transform, but flips sign at output
fn generateAntiRidge(pos : vec3<f32>, params:NoiseParams) -> f32 {
    // reuse generateRidge and negate its result
    return -generateRidge(pos, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise (Fast Lanczos) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateRidgedMultifractal(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);

    var x = pos.x / zoom + params.xShift;
    var y = pos.y / zoom + params.yShift;
    var z = pos.z / zoom + params.zShift;
    var freqLoc : f32 = max(params.freq, 1e-6);

    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));
    var amp : f32 = 1.0;

    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {
        freqLoc = freqLoc * params.lacunarity;
        amp = amp * params.gain;

        var n : f32 = abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));
        if (params.exp2 != 0.0) {
            n = 1.0 - pow(n, params.exp2);
        }
        if (params.exp1 != 0.0) {
            n = pow(n, params.exp1);
        }

        sum = sum - n * amp;

        x = x + params.xShift;
        y = y + params.yShift;
        z = z + params.zShift;
    }

    return sum;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise 2 (Fast Lanczos + Rotation) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateRidgedMultifractal2(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);

    var x = (pos.x + params.xShift) / zoom;
    var y = (pos.y + params.yShift) / zoom;
    var z = (pos.z + params.zShift) / zoom;

    var freqLoc : f32 = max(params.freq, 1e-6);
    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));
    var amp : f32 = 1.0;
    var angle : f32 = params.seedAngle;

    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {
        freqLoc = freqLoc * params.lacunarity;
        amp = amp * params.gain;

        var n : f32 = abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));
        if (params.exp2 != 0.0) {
            n = 1.0 - pow(n, params.exp2);
        }
        if (params.exp1 != 0.0) {
            n = pow(n, params.exp1);
        }

        sum = sum - n * amp;

        let c = cos(angle);
        let s = sin(angle);
        let nx = x * c - y * s;
        let ny = x * s + y * c;
        let nz = z;

        x = nx + params.xShift;
        y = ny + params.yShift;
        z = nz + params.zShift;

        angle = angle + ANGLE_INCREMENT;
    }

    return sum;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise 3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateRidgedMultifractal3(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);

    var x = (pos.x + params.xShift) / zoom;
    var y = (pos.y + params.yShift) / zoom;
    var z = (pos.z + params.zShift) / zoom;
    var sum : f32 = 0.0;
    var amp : f32 = 1.0;
    var freqLoc : f32 = max(params.freq, 1e-6);

    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {
        var n : f32 = lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));
        n = max(1e-7, n + 1.0);
        n = 2.0 * pow(n * 0.5, params.exp2 + 1.5) - 1.0;
        n = 1.0 - abs(n);
        if (params.exp1 - 1.0 != 0.0) {
            n = 1.0 - pow(n, params.exp1 - 1.0);
        }

        sum = sum + n * amp;

        freqLoc = freqLoc * params.lacunarity;
        x = x + params.xShift;
        y = y + params.yShift;
        z = z + params.zShift;
        amp = amp * params.gain;
    }

    return sum - 1.0;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise 4 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateRidgedMultifractal4(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);

    var x = (pos.x + params.xShift) / zoom;
    var y = (pos.y + params.yShift) / zoom;
    var z = (pos.z + params.zShift) / zoom;
    var sum : f32 = 0.0;
    var amp : f32 = 1.0;
    var freqLoc : f32 = max(params.freq, 1e-6);

    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {
        var n : f32 = abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));
        if (params.exp2 != 0.0) {
            n = 1.0 - pow(n, params.exp2);
        }
        if (params.exp1 != 0.0) {
            n = pow(n, params.exp1);
        }

        sum = sum + n * amp;

        freqLoc = freqLoc * params.lacunarity;
        x = x + params.xShift;
        y = y + params.yShift;
        z = z + params.zShift;
        amp = amp * params.gain;
    }

    return 1.0 - sum;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateAntiRidgedMultifractal(pos : vec3<f32>, params:NoiseParams) -> f32 {
    return -generateRidgedMultifractal(pos, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise 2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateAntiRidgedMultifractal2(pos : vec3<f32>, params:NoiseParams) -> f32 {
    return -generateRidgedMultifractal2(pos, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise 3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateAntiRidgedMultifractal3(pos : vec3<f32>, params:NoiseParams) -> f32 {
    return -generateRidgedMultifractal3(pos, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise 4 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateAntiRidgedMultifractal4(pos : vec3<f32>, params:NoiseParams) -> f32 {
    return -generateRidgedMultifractal4(pos, params);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Fractal Brownian Motion (3D Simplex) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

// 3-D FBM helper: sums octaves of simplex noise with rotating shifts
fn fbm3D(pos : vec3<f32>, params:NoiseParams) -> f32 {
    // apply zoom
    var x       = (pos.x + params.xShift) / params.zoom;
    var y       = (pos.y + params.yShift) / params.zoom;
    var z       = (pos.z + params.zShift) / params.zoom;
    var sum       : f32 = 0.0;
    var amplitude : f32 = 1.0;
    var maxValue  : f32 = 0.0;
    var freqLoc   : f32 = max(params.freq, 1e-6);
    // start angle from uniform seedAngle
    var angle     : f32 = params.seedAngle;
    let angleInc  : f32 = 2.0 * PI / f32(params.octaves);

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        // accumulate weighted noise
        sum = sum + amplitude * simplex3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));
        maxValue = maxValue + amplitude;

        // next freq & amp
        freqLoc   = freqLoc * params.lacunarity;
        amplitude = amplitude * params.gain;

        // advance rotation
        angle = angle + angleInc;
        let offX = params.xShift * cos(angle);
        let offY = params.yShift * cos(angle);
        let offZ = params.zShift * cos(angle);

        // apply shift
        x = x + offX;
        y = y + offY;
        z = z + offZ;
    }
    // normalize
    return sum / maxValue;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 FBM Generator #1 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// two\u2010stage fbm, then doubled
fn generateFBM(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let fbm1 = fbm3D(pos, params);
    let fbm2 = fbm3D(vec3<f32>(fbm1, fbm1, fbm1), params);
    return 2.0 * fbm2;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 FBM Generator #2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// chained fbm with scaling by zoom
fn generateFBM2(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let fbm1 = fbm3D(pos, params);
    let s    = params.zoom;
    let fbm2 = fbm3D(vec3<f32>(fbm1 * s, fbm1 * s, fbm1 * s), params);
    let fbm3 = fbm3D(vec3<f32>(pos.x + fbm2 * s,
                               pos.y + fbm2 * s,
                               pos.z + fbm2 * s), params);
    return 2.0 * fbm3;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 FBM Generator #3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// three\u2010step chaining of fbm with offset
fn generateFBM3(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let fbm1 = fbm3D(pos, params);
    let s    = params.zoom;
    let fbm2 = fbm3D(vec3<f32>(pos.x + fbm1 * s,
                               pos.y + fbm1 * s,
                               pos.z + fbm1 * s), params);
    let fbm3 = fbm3D(vec3<f32>(pos.x + fbm2 * s,
                               pos.y + fbm2 * s,
                               pos.z + fbm2 * s), params);
    return 2.0 * fbm3;
}

/*==============================================================================
  Cellular Brownian-Motion FBM helpers & generators
==============================================================================*/

fn edgeCut(val: f32, threshold: f32) -> f32 {
  // return 0.0 when val < threshold, otherwise return val
  return select(val, 0.0, val < threshold);
}

// 3-D Cellular FBM helper: sums octaves of cellular3D with rotating shifts
fn fbmCellular3D(pos : vec3<f32>, params : NoiseParams) -> f32 {
    var x = (pos.x + params.xShift) / params.zoom;
    var y = (pos.y + params.yShift) / params.zoom;
    var z = (pos.z + params.zShift) / params.zoom;

    var sum     : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = max(params.freq, 1e-6);

    var angle   : f32 = params.seedAngle;
    let angleInc: f32 = 2.0 * PI / f32(params.octaves);

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        let n = edgeCut(cellular3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)),
                        params.threshold);
        sum = sum + amp * n;

        freqLoc = freqLoc * params.lacunarity;
        amp     = amp     * params.gain;

        angle = angle + angleInc;
        let offX = params.xShift * cos(angle);
        let offY = params.yShift * cos(angle);
        let offZ = params.zShift * cos(angle);

        x = x + offX;
        y = y + offY;
        z = z + offZ;
    }
    return sum;
}

/* ---- Three cellular FBM flavours ---------------------------------------- */
fn generateCellularBM1(pos : vec3<f32>, params : NoiseParams) -> f32 {
    let f1 = fbmCellular3D(pos, params);
    let f2 = fbmCellular3D(vec3<f32>(f1 * params.zoom), params);
    return 1.5 * f2 - 1.0;
}

fn generateCellularBM2(pos : vec3<f32>, params : NoiseParams) -> f32 {
    let f1 = fbmCellular3D(pos, params);
    let f2 = fbmCellular3D(vec3<f32>(f1 * params.zoom), params);
    let f3 = fbmCellular3D(vec3<f32>(pos + f2 * params.zoom), params);
    return 1.5 * f3 - 1.0;
}

fn generateCellularBM3(pos : vec3<f32>, params : NoiseParams) -> f32 {
    let f1 = fbmCellular3D(pos, params);
    let f2 = fbmCellular3D(vec3<f32>(pos + f1 * params.zoom), params);
    let f3 = fbmCellular3D(vec3<f32>(pos + f2 * params.zoom), params);
    return 1.5 * f3 - 1.0;
}

/* ---- Voronoi and Voronoi Brownian-Motion flavours ---------------------------------- */

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Voronoi Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateVoronoi4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  var sum: f32 = 0.0;
  var amp: f32 = 1.0;
  var freqLoc: f32 = max(params.freq, 1e-6);

  let mode: u32 = params.voroMode;
  let edgeK: f32 = max(params.edgeK, 0.0);
  let threshold: f32 = max(params.threshold, 0.0);

  var base: vec4<f32>;
  if (params.toroidal == 1u) {
    base = packPeriodicUV(pos.x, pos.y, pos.z + params.time);
  } else {
    base = vec4<f32>(
      (pos.x + params.xShift) / zoom,
      (pos.y + params.yShift) / zoom,
      (pos.z + params.zShift) / zoom,
      params.time
    );
  }

  var angle: f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let P = base * freqLoc;
    let m = voro4D_metrics(P);
    let v = voro_eval(m.f1Sq, m.f2Sq, m.cellVal, mode, edgeK, threshold, freqLoc);

    sum += v * amp;

    freqLoc *= params.lacunarity;
    amp *= params.gain;

    if (params.toroidal != 1u) {
      let c = cos(angle);
      let s = sin(angle);
      let xy = vec2<f32>(base.x * c - base.y * s, base.x * s + base.y * c);
      let zw = vec2<f32>(base.z * c - base.w * s, base.z * s + base.w * c);
      base = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
      angle += ANGLE_INCREMENT;
    }
  }

  return sum;
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Voronoi Tile Noise (Edge-Aware) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateVoronoiTileNoise(pos : vec3<f32>, params:NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);
  var sum   : f32 = 0.0;
  var amp   : f32 = 1.0;
  var freqLoc : f32 = max(params.freq, 1e-6);

  let mode : u32 = params.voroMode;
  let edgeK : f32 = max(params.edgeK, 0.0);
  let thresh : f32 = max(params.threshold, 0.0);

  var x = (pos.x + params.xShift) / zoom;
  var y = (pos.y + params.yShift) / zoom;
  var z = (pos.z + params.zShift) / zoom;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let P = vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc);
    let m = voro3D_metrics(P);
    let v = voro_eval(m.f1Sq, m.f2Sq, m.cellVal, mode, edgeK, thresh, freqLoc);

    sum = sum + v * amp;

    freqLoc = freqLoc * params.lacunarity;
    amp     = amp * params.gain;

    x = x + params.xShift;
    y = y + params.yShift;
    z = z + params.zShift;
  }

  return sum;
}


// BM1: f( f(p) )
fn generateVoronoiBM1(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateVoronoiTileNoise(p, par);
  return generateVoronoiTileNoise(vec3<f32>(f1 * par.zoom), par);
}

// BM2: f( p + f(f(p)) )
fn generateVoronoiBM2(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateVoronoiTileNoise(p, par);
  let f2 = generateVoronoiTileNoise(vec3<f32>(f1 * par.zoom), par);
  return generateVoronoiTileNoise(p + vec3<f32>(f2 * par.zoom), par);
}

// BM3: f( p + f(p + f(p)) )
fn generateVoronoiBM3(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateVoronoiTileNoise(p, par);
  let f2 = generateVoronoiTileNoise(p + vec3<f32>(f1 * par.zoom), par);
  return generateVoronoiTileNoise(p + vec3<f32>(f2 * par.zoom), par);
}

/* ---- Voronoi Brownian-Motion flavours (4D) ---------------------------------- */

// BM1 4D: f( f(p) )  (scalar feedback into XYZ, keep W/time from params)
fn generateVoronoiBM1_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateVoronoi4D(p, par);
  return generateVoronoi4D(vec3<f32>(f1 * par.zoom), par);
}

// BM2 4D: f( p + f(f(p)) )
fn generateVoronoiBM2_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateVoronoi4D(p, par);
  let f2 = generateVoronoi4D(vec3<f32>(f1 * par.zoom), par);
  return generateVoronoi4D(p + vec3<f32>(f2 * par.zoom), par);
}

// BM3 4D: f( p + f(p + f(p)) )
fn generateVoronoiBM3_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateVoronoi4D(p, par);
  let f2 = generateVoronoi4D(p + vec3<f32>(f1 * par.zoom), par);
  return generateVoronoi4D(p + vec3<f32>(f2 * par.zoom), par);
}

/* ---- vector-feedback variants (stronger, less axis-locked) ---------
   These keep it cheap but reduce the "all axes get same scalar" look by building
   a 3-vector from 3 decorrelated samples (offsets are constant, no extra params).
*/

fn _bm4D_vec(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {
  let a = generateVoronoi4D(p + vec3<f32>(17.13,  3.71,  9.23), par);
  let b = generateVoronoi4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);
  let c = generateVoronoi4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);
  return vec3<f32>(a, b, c);
}

// BM1 4D (vec): f( vec(f(p)) )
fn generateVoronoiBM1_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec(p, par);
  return generateVoronoi4D(v1 * par.zoom, par);
}

// BM2 4D (vec): f( p + vec(f(vec(f(p)))) )
fn generateVoronoiBM2_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec(p, par);
  let v2 = _bm4D_vec(v1 * par.zoom, par);
  return generateVoronoi4D(p + v2 * par.zoom, par);
}

// BM3 4D (vec): f( p + vec(f(p + vec(f(p)))) )
fn generateVoronoiBM3_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec(p, par);
  let v2 = _bm4D_vec(p + v1 * par.zoom, par);
  return generateVoronoi4D(p + v2 * par.zoom, par);
}

// Generic "Voronoi-style" sampler for Cellular/Worley so they can share voro_eval modes.

struct VoroSample {
  f1Sq    : f32,
  f2Sq    : f32,
  cellVal : f32,
};

fn voro_sample3D(p: vec3<f32>) -> VoroSample {
  let fx = i32(floor(p.x));
  let fy = i32(floor(p.y));
  let fz = i32(floor(p.z));

  var d1: f32 = 1e9;
  var d2: f32 = 1e9;
  var cv: f32 = 0.0;

  for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {
    for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {
      for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {
        let xi = fx + dx;
        let yi = fy + dy;
        let zi = fz + dz;

        let rx = rand3u(xi, yi, zi);
        let ry = rand3u(yi, zi, xi);
        let rz = rand3u(zi, xi, yi);

        let px = f32(xi) + rx;
        let py = f32(yi) + ry;
        let pz = f32(zi) + rz;

        let dxv = px - p.x;
        let dyv = py - p.y;
        let dzv = pz - p.z;
        let dd  = dxv * dxv + dyv * dyv + dzv * dzv;

        if (dd < d1) {
          d2 = d1;
          d1 = dd;
          cv = rand3u(xi, zi, yi);
        } else if (dd < d2) {
          d2 = dd;
        }
      }
    }
  }

  return VoroSample(d1, d2, cv);
}

fn voro_sample4D(p: vec4<f32>) -> VoroSample {
  let fx = i32(floor(p.x));
  let fy = i32(floor(p.y));
  let fz = i32(floor(p.z));
  let fw = i32(floor(p.w));

  var d1: f32 = 1e9;
  var d2: f32 = 1e9;
  var cv: f32 = 0.0;

  for (var dw: i32 = -1; dw <= 1; dw = dw + 1) {
    for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {
      for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {
        for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {
          let xi = fx + dx;
          let yi = fy + dy;
          let zi = fz + dz;
          let wi = fw + dw;

          let rx = rand4u(xi, yi, zi, wi);
          let ry = rand4u(yi, zi, wi, xi);
          let rz = rand4u(zi, wi, xi, yi);
          let rw = rand4u(wi, xi, yi, zi);

          let px = f32(xi) + rx;
          let py = f32(yi) + ry;
          let pz = f32(zi) + rz;
          let pw = f32(wi) + rw;

          let dxv = px - p.x;
          let dyv = py - p.y;
          let dzv = pz - p.z;
          let dwv = pw - p.w;
          let dd  = dxv * dxv + dyv * dyv + dzv * dzv + dwv * dwv;

          if (dd < d1) {
            d2 = d1;
            d1 = dd;
            cv = rand4u(xi, zi, yi, wi);
          } else if (dd < d2) {
            d2 = dd;
          }
        }
      }
    }
  }

  return VoroSample(d1, d2, cv);
}

fn cellular4D(p: vec4<f32>) -> f32 {
  let s = voro_sample4D(p);
  return voro_edge_dist(s.f1Sq, s.f2Sq);
}

fn worley4D(p: vec4<f32>) -> f32 {
  let s = voro_sample4D(p);
  return sqrt(max(s.f1Sq, 0.0));
}

// Expects you to pass the same controls you use for Voronoi: params.voroMode, params.edgeK, params.threshold.
fn generateCellular(pos: vec3<f32>, params: NoiseParams) -> f32 {
  var x = (pos.x + params.xShift) / params.zoom;
  var y = (pos.y + params.yShift) / params.zoom;
  var z = (pos.z + params.zShift) / params.zoom;

  var sum     : f32 = 0.0;
  var amp     : f32 = 1.0;
  var freqLoc : f32 = max(params.freq, 1e-6);
  var angle   : f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let s = voro_sample3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));

    var n = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);
    if (params.turbulence == 1u) { n = abs(n); }
    n = clamp(n, 0.0, 1.0);

    sum = sum + n * amp;

    freqLoc = freqLoc * params.lacunarity;
    amp     = amp     * params.gain;

    let c = cos(angle);
    let sA = sin(angle);
    let nx = x * c - y * sA;
    let ny = x * sA + y * c;
    let nz = y * sA + z * c;

    x = nx + params.xShift;
    y = ny + params.yShift;
    z = nz + params.zShift;
    angle = angle + ANGLE_INCREMENT;
  }

  if (params.turbulence == 1u) { sum = sum - 1.0; }
  return 2.0 * sum - 1.0;
}

fn generateAntiCellular(pos: vec3<f32>, params: NoiseParams) -> f32 { 
  return -generateCellular(pos,params);
}

fn generateWorley(pos: vec3<f32>, params: NoiseParams) -> f32 {
  var x = (pos.x + params.xShift) / params.zoom;
  var y = (pos.y + params.yShift) / params.zoom;
  var z = (pos.z + params.zShift) / params.zoom;

  var sum     : f32 = 0.0;
  var amp     : f32 = 1.0;
  var freqLoc : f32 = max(params.freq, 1e-6);
  var angle   : f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let s = voro_sample3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));

    var n = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);
    if (params.turbulence == 1u) { n = abs(n); }
    n = clamp(n, 0.0, 1.0);

    sum = sum + n * amp;

    freqLoc = freqLoc * params.lacunarity;
    amp     = amp     * params.gain;

    let c = cos(angle);
    let sA = sin(angle);
    let nx = x * c - y * sA;
    let ny = x * sA + y * c;
    let nz = y * sA + z * c;

    x = nx + params.xShift;
    y = ny + params.yShift;
    z = nz + params.zShift;
    angle = angle + ANGLE_INCREMENT;
  }

  if (params.turbulence == 1u) { sum = sum - 1.0; }
  return sum - 1.0;
}

fn generateAntiWorley(pos: vec3<f32>, params: NoiseParams) -> f32 { 
  return -generateWorley(pos,params);
}

fn generateCellular4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  var base: vec4<f32>;
  if (params.toroidal == 1u) {
    base = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;
  } else {
    base = vec4<f32>(
      pos.x / zoom + params.xShift,
      pos.y / zoom + params.yShift,
      pos.z / zoom + params.zShift,
      params.time
    );
  }

  var sum     : f32 = 0.0;
  var amp     : f32 = 1.0;
  var freqLoc : f32 = max(params.freq, 1e-6);
  var angle   : f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let s = voro_sample4D(base * freqLoc);

    var v = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);
    if (params.turbulence == 1u) { v = abs(v); }
    v = clamp(v, 0.0, 1.0);

    sum += v * amp;

    freqLoc *= params.lacunarity;
    amp     *= params.gain;

    if (params.toroidal != 1u) {
      let c = cos(angle);
      let sA = sin(angle);
      let xy = vec2<f32>( base.x * c - base.y * sA, base.x * sA + base.y * c );
      let zw = vec2<f32>( base.z * c - base.w * sA, base.z * sA + base.w * c );
      base = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
      angle += ANGLE_INCREMENT;
    }
  }

  if (params.turbulence == 1u) { sum -= 1.0; }
  return 2.0 * sum - 1.0;
}

fn generateAntiCellular4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  return -generateCellular4D(pos,params);
}

fn generateWorley4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  var base: vec4<f32>;
  if (params.toroidal == 1u) {
    base = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;
  } else {
    base = vec4<f32>(
      pos.x / zoom + params.xShift,
      pos.y / zoom + params.yShift,
      pos.z / zoom + params.zShift,
      params.time
    );
  }

  var sum    : f32 = 0.0;
  var amp    : f32 = 1.0;
  var ampSum : f32 = 0.0;
  var freqLoc : f32 = max(params.freq, 1e-6);
  var angle  : f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let s = voro_sample4D(base * freqLoc);

    var v = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);
    if (params.turbulence == 1u) { v = abs(v); }
    v = clamp(v, 0.0, 1.0);

    sum    += v * amp;
    ampSum += amp;

    freqLoc *= params.lacunarity;
    amp     *= params.gain;

    if (params.toroidal != 1u) {
      let c = cos(angle);
      let sA = sin(angle);
      let xy = vec2<f32>( base.x * c - base.y * sA, base.x * sA + base.y * c );
      let zw = vec2<f32>( base.z * c - base.w * sA, base.z * sA + base.w * c );
      base = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
      angle += ANGLE_INCREMENT;
    }
  }

  let out = select(0.0, sum / ampSum, ampSum > 0.0);

  if (params.turbulence == 1u) { return clamp(out - 1.0, -1.0, 1.0); }
  return clamp(1.0 - out, 0.0, 1.0);
}

fn generateAntiWorley4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  return 1-generateWorley4D(pos,params);
}

/* ---- Cellular Brownian-Motion flavours (4D) ---------------------------------- */

// BM1 4D: f( f(p) )
fn generateCellularBM1_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateCellular4D(p, par);
  return generateCellular4D(vec3<f32>(f1 * par.zoom), par);
}

// BM2 4D: f( p + f(f(p)) )
fn generateCellularBM2_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateCellular4D(p, par);
  let f2 = generateCellular4D(vec3<f32>(f1 * par.zoom), par);
  return generateCellular4D(p + vec3<f32>(f2 * par.zoom), par);
}

// BM3 4D: f( p + f(p + f(p)) )
fn generateCellularBM3_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateCellular4D(p, par);
  let f2 = generateCellular4D(p + vec3<f32>(f1 * par.zoom), par);
  return generateCellular4D(p + vec3<f32>(f2 * par.zoom), par);
}


/* ---- Worley Brownian-Motion flavours (4D) ----------------------------------- */

// BM1 4D: f( f(p) )
fn generateWorleyBM1_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateWorley4D(p, par);
  return generateWorley4D(vec3<f32>(f1 * par.zoom), par);
}

// BM2 4D: f( p + f(f(p)) )
fn generateWorleyBM2_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateWorley4D(p, par);
  let f2 = generateWorley4D(vec3<f32>(f1 * par.zoom), par);
  return generateWorley4D(p + vec3<f32>(f2 * par.zoom), par);
}

// BM3 4D: f( p + f(p + f(p)) )
fn generateWorleyBM3_4D(p: vec3<f32>, par: NoiseParams) -> f32 {
  let f1 = generateWorley4D(p, par);
  let f2 = generateWorley4D(p + vec3<f32>(f1 * par.zoom), par);
  return generateWorley4D(p + vec3<f32>(f2 * par.zoom), par);
}


/* ---- vector-feedback variants (stronger, less axis-locked) ------------------ */

fn _bm4D_vec_cellular(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {
  let a = generateCellular4D(p + vec3<f32>(17.13,  3.71,  9.23), par);
  let b = generateCellular4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);
  let c = generateCellular4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);
  return vec3<f32>(a, b, c);
}

fn _bm4D_vec_worley(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {
  let a = generateWorley4D(p + vec3<f32>(17.13,  3.71,  9.23), par);
  let b = generateWorley4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);
  let c = generateWorley4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);
  return vec3<f32>(a, b, c);
}


// BM1 4D (vec): f( vec(f(p)) )
fn generateCellularBM1_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec_cellular(p, par);
  return generateCellular4D(v1 * par.zoom, par);
}

// BM2 4D (vec): f( p + vec(f(vec(f(p)))) )
fn generateCellularBM2_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec_cellular(p, par);
  let v2 = _bm4D_vec_cellular(v1 * par.zoom, par);
  return generateCellular4D(p + v2 * par.zoom, par);
}

// BM3 4D (vec): f( p + vec(f(p + vec(f(p)))) )
fn generateCellularBM3_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec_cellular(p, par);
  let v2 = _bm4D_vec_cellular(p + v1 * par.zoom, par);
  return generateCellular4D(p + v2 * par.zoom, par);
}


// BM1 4D (vec): f( vec(f(p)) )
fn generateWorleyBM1_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec_worley(p, par);
  return generateWorley4D(v1 * par.zoom, par);
}

// BM2 4D (vec): f( p + vec(f(vec(f(p)))) )
fn generateWorleyBM2_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec_worley(p, par);
  let v2 = _bm4D_vec_worley(v1 * par.zoom, par);
  return generateWorley4D(p + v2 * par.zoom, par);
}

// BM3 4D (vec): f( p + vec(f(p + vec(f(p)))) )
fn generateWorleyBM3_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {
  let v1 = _bm4D_vec_worley(p, par);
  let v2 = _bm4D_vec_worley(p + v1 * par.zoom, par);
  return generateWorley4D(p + v2 * par.zoom, par);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Billow Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  var base: vec4<f32>;
  if (params.toroidal == 1u) {
    base = packPeriodicUV(pos.x, pos.y, pos.z + params.time) / zoom;
  } else {
    base = vec4<f32>(
      pos.x / zoom + params.xShift,
      pos.y / zoom + params.yShift,
      pos.z / zoom + params.zShift,
      params.time
    );
  }

  var sum: f32 = 0.0;
  var amp: f32 = 1.0;
  var freqLoc: f32 = max(params.freq, 1e-6);
  var ampSum: f32 = 0.0;
  var angle: f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let n = noise4D(base * freqLoc);
    let b = pow(abs(n), 0.75);
    sum += b * amp;
    ampSum += amp;

    freqLoc *= params.lacunarity;
    amp *= params.gain;

    if (params.toroidal != 1u) {
      let c = cos(angle);
      let s = sin(angle);
      let xy = vec2<f32>(base.x * c - base.y * s, base.x * s + base.y * c);
      let zw = vec2<f32>(base.z * c - base.w * s, base.z * s + base.w * c);
      base = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
      angle += ANGLE_INCREMENT;
    }
  }

  if (ampSum > 0.0) { sum /= ampSum; }

  let k: f32 = 1.2;
  let cMid = sum - 0.5;
  let shaped = 0.5 + cMid * k / (1.0 + abs(cMid) * (k - 1.0));

  return clamp(shaped, 0.0, 1.0);
}

fn generateAntiBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  return 1.0 - generateBillow4D(pos, params);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Terrace + Foam + Turbulence \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateTerraceNoise4D(pos: vec3<f32>, par: NoiseParams) -> f32 {
  let base = generatePerlin4D(pos, par);
  return terrace(base, par.terraceStep);
}

fn generateFoamNoise4D(pos: vec3<f32>, par: NoiseParams) -> f32 {
  let base = generateBillow4D(pos, par);
  return foamify(base);
}

fn generateTurbulence4D(pos: vec3<f32>, par: NoiseParams) -> f32 {
  let base = generatePerlin4D(pos, par);
  return turbulence(base);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D "Lanczos-like" Lowpass \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn lowpass4D(p: vec4<f32>) -> f32 {
  let o = vec4<f32>(0.37, 0.21, 0.29, 0.31);
  let a = noise4D(p);
  let b = noise4D(p + vec4<f32>(o.x, 0.0, 0.0, 0.0));
  let c = noise4D(p + vec4<f32>(0.0, o.y, 0.0, 0.0));
  let d = noise4D(p + vec4<f32>(0.0, 0.0, o.z, 0.0));
  let e = noise4D(p + vec4<f32>(0.0, 0.0, 0.0, o.w));
  return (a + b + c + d + e) * 0.2;
}

fn generateLanczosBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  var base: vec4<f32>;
  if (params.toroidal == 1u) {
    base = packPeriodicUV(pos.x, pos.y, pos.z + params.time) / zoom;
  } else {
    base = vec4<f32>(
      pos.x / zoom + params.xShift,
      pos.y / zoom + params.yShift,
      pos.z / zoom + params.zShift,
      params.time
    );
  }

  var sum: f32 = 0.0;
  var amp: f32 = 1.0;
  var ampSum: f32 = 0.0;
  var freqLoc: f32 = max(params.freq, 1e-6);
  var angle: f32 = params.seedAngle;

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    let n = lowpass4D(base * freqLoc);
    let b = pow(abs(n), 0.75);
    sum += b * amp;
    ampSum += amp;

    freqLoc *= params.lacunarity;
    amp *= params.gain;

    if (params.toroidal != 1u) {
      let c = cos(angle);
      let s = sin(angle);
      let xy = vec2<f32>(base.x * c - base.y * s, base.x * s + base.y * c);
      let zw = vec2<f32>(base.z * c - base.w * s, base.z * s + base.w * c);
      base = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
      angle += ANGLE_INCREMENT;
    }
  }

  if (ampSum > 0.0) { sum /= ampSum; }

  let k: f32 = 1.2;
  let cMid = sum - 0.5;
  let shaped = 0.5 + cMid * k / (1.0 + abs(cMid) * (k - 1.0));

  return clamp(shaped, 0.0, 1.0);
}

fn generateLanczosAntiBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  return 1.0 - generateLanczosBillow4D(pos, params);
}



// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D FBM core + generators \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn fbm4D_core(base: vec4<f32>, params: NoiseParams) -> f32 {
  var p = base;

  var sum: f32 = 0.0;
  var amp: f32 = 1.0;
  var maxAmp: f32 = 0.0;
  var freqLoc: f32 = max(params.freq, 1e-6);

  var angle: f32 = params.seedAngle;
  let angleInc: f32 = 2.0 * PI / max(f32(params.octaves), 1.0);

  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
    sum += amp * noise4D(p * freqLoc);
    maxAmp += amp;

    freqLoc *= params.lacunarity;
    amp *= params.gain;

    if (params.toroidal != 1u) {
      angle += angleInc;
      let c = cos(angle);
      let s = sin(angle);
      let xy = vec2<f32>(p.x * c - p.y * s, p.x * s + p.y * c);
      let zw = vec2<f32>(p.z * c - p.w * s, p.z * s + p.w * c);
      p = vec4<f32>(
        xy.x + params.xShift,
        xy.y + params.yShift,
        zw.x + params.zShift,
        zw.y + params.time
      );
    }
  }

  return select(0.0, sum / maxAmp, maxAmp > 0.0);
}

fn fbm4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let zoom = max(params.zoom, 1e-6);

  if (params.toroidal == 1u) {
    let base = packPeriodicUV(pos.x, pos.y, pos.z + params.time) / zoom;
    return fbm4D_core(base, params);
  }

  let base = vec4<f32>(
    (pos.x + params.xShift) / zoom,
    (pos.y + params.yShift) / zoom,
    (pos.z + params.zShift) / zoom,
    params.time
  );
  return fbm4D_core(base, params);
}

fn generateFBM4D(pos: vec3<f32>, params: NoiseParams) -> f32 {
  let fbm1 = fbm4D(pos, params);
  let fbm2 = fbm4D_core(vec4<f32>(fbm1, fbm1, fbm1, fbm1), params);
  return 2.0 * fbm2;
}


/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Domain-warp FBM (4D)  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/

fn domainWarpFBM4D(p: vec3<f32>, params: NoiseParams, warpAmp: f32, stages: u32) -> f32 {
  var q = p;
  for (var i: u32 = 0u; i < stages; i = i + 1u) {
    let w = fbm4D(q, params) * warpAmp;
    q = q + vec3<f32>(w, w, w);
  }
  return fbm4D(q, params);
}

fn generateDomainWarpFBM1_4D(pos: vec3<f32>, par: NoiseParams) -> f32 {
  return domainWarpFBM4D(pos, par, par.warpAmp, 1u);
}

fn generateDomainWarpFBM2_4D(pos: vec3<f32>, par: NoiseParams) -> f32 {
  return domainWarpFBM4D(pos, par, par.warpAmp, 2u);
}

fn _warpVecFrom4D(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {
  let a = fbm4D(p + vec3<f32>(17.13,  3.71,  9.23), par);
  let b = fbm4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);
  let c = fbm4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);
  return vec3<f32>(a, b, c);
}

fn domainWarpFBM4D_vec(p: vec3<f32>, params: NoiseParams, warpAmp: f32, stages: u32) -> f32 {
  var q = p;
  for (var i: u32 = 0u; i < stages; i = i + 1u) {
    let v = _warpVecFrom4D(q, params) * warpAmp;
    q = q + v;
  }
  return fbm4D(q, params);
}

fn generateDomainWarpFBM1_4D_vec(pos: vec3<f32>, par: NoiseParams) -> f32 {
  return domainWarpFBM4D_vec(pos, par, par.warpAmp, 1u);
}

fn generateDomainWarpFBM2_4D_vec(pos: vec3<f32>, par: NoiseParams) -> f32 {
  return domainWarpFBM4D_vec(pos, par, par.warpAmp, 2u);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Lanczos Billow Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateLanczosBillow(pos : vec3<f32>, p : NoiseParams) -> f32 {
    var x       = (pos.x + p.xShift) / p.zoom;
    var y       = (pos.y + p.yShift) / p.zoom;
    var z       = (pos.z + p.zShift) / p.zoom;
    var sum     : f32 = 0.0;
    var maxAmp  : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = max(p.freq, 1e-6);
    var angle   : f32 = p.seedAngle;

    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {
        let n = lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));
        sum = sum + (2.0 * abs(n) - 1.0) * amp;
        maxAmp = maxAmp + amp;

        freqLoc = freqLoc * p.lacunarity;
        amp     = amp     * p.gain;

        // rotation around Z
        let c = cos(angle);
        let s = sin(angle);
        var newX = x * c - y * s;
        var newY = x * s + y * c;
        var newZ = z;

        // rotate in XZ plane
        let rX = newX * c + newZ * s;
        let rZ = -newX * s + newZ * c;
        newX = rX; newZ = rZ;

        // rotate in YZ plane
        let rY = newY * c - newZ * s;
        let rZ2 = newY * s + newZ * c;
        newY = rY; newZ = rZ2;

        // apply shift
        x = newX + p.xShift;
        y = newY + p.yShift;
        z = newZ + p.zShift;

        angle = angle + ANGLE_INCREMENT;
    }

    return sum / maxAmp;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Lanczos Anti-Billow Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn generateLanczosAntiBillow(pos : vec3<f32>, p : NoiseParams) -> f32 {
    return -generateLanczosBillow(pos, p);
}


// Raw Voronoi circle\u2010gradient cell value
fn voronoiCircleGradient(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let m = voro3D_metrics(pos);
    let minDist = sqrt(max(m.f1Sq, 0.0));
    let secondDist = sqrt(max(m.f2Sq, 0.0));

    let centerGrad = 1.0 - min(minDist, 1.0);
    let edgeDist = max(secondDist - minDist, 0.0);
    let edgeGrad = select(1.0, 0.0, edgeDist < params.threshold);
    let legacyCellValue = centerGrad * edgeGrad;

    let modeValue = voro_legacy_cell_or_eval3D(m, params, max(params.freq, 1e-6), legacyCellValue);
    return select(modeValue * centerGrad, legacyCellValue, params.voroMode == VORO_CELL);
}

// Octaved generator matching your JS .generateNoise()
fn generateVoronoiCircleNoise(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var x       = pos.x / zoom + params.xShift;
    var y       = pos.y / zoom + params.yShift;
    var z       = pos.z / zoom + params.zShift;
    var total : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = max(params.freq, 1e-6);

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let samplePos = vec3<f32>(x * freq, y * freq, z * freq);
        total = total + voronoiCircleGradient(samplePos, params) * amp;

        // next octave
        amp  = amp  * params.gain;
        freq = freq * params.lacunarity;
        x    = x + params.xShift;
        y    = y + params.yShift;
        z    = z + params.zShift;
    }

    // match JS: return \u2211noise \u2212 1.0
    return total - 1.0;
}




// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 distance helpers (add once) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
fn euclideanDist(a: vec3<f32>, b: vec3<f32>) -> f32 {
  return length(a - b);
}
fn euclideanDistSq(a: vec3<f32>, b: vec3<f32>) -> f32 {
  let d = a - b;
  return dot(d, d);
}

fn euclideanDist2(a: vec2<f32>, b: vec2<f32>) -> f32 {
  return length(a - b);
}
fn euclideanDistSq2(a: vec2<f32>, b: vec2<f32>) -> f32 {
  let d = a - b;
  return dot(d, d);
}

fn euclideanDist4(a: vec4<f32>, b: vec4<f32>) -> f32 {
  return length(a - b);
}
fn euclideanDistSq4(a: vec4<f32>, b: vec4<f32>) -> f32 {
  let d = a - b;
  return dot(d, d);
}


// \u2500\u2500\u2500\u2500\u2500 1. Voronoi Circle\u2010Gradient Tile Noise 2 \u2500\u2500\u2500\u2500\u2500

fn voronoiCircleGradient2Raw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let m = voro3D_metrics(pos);
    let centerDist = sqrt(max(m.f1Sq, 0.0));
    let gradient = sin(centerDist * PI);
    let legacyCellValue = m.cellVal * gradient;

    let modeValue = voro_legacy_cell_or_eval3D(m, params, max(params.freq, 1e-6), legacyCellValue);
    return select(modeValue * gradient, legacyCellValue, params.voroMode == VORO_CELL);
}

fn generateVoronoiCircle2(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var x = pos.x / zoom + params.xShift;
    var y = pos.y / zoom + params.yShift;
    var z = pos.z / zoom + params.zShift;
    var total : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = max(params.freq, 1e-6);
    var angle     : f32 = params.seedAngle;
    let angleInc  : f32 = 2.0 * PI / max(f32(params.octaves), 1.0);

    for(var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let samplePos = vec3<f32>(x * freq, y * freq, z * freq);
        total = total + voronoiCircleGradient2Raw(samplePos, params) * amp;
        amp   = amp * params.gain;
        freq  = freq * params.lacunarity;
        angle = angle + angleInc;
        x = x + params.xShift * cos(angle) + params.xShift;
        y = y + params.yShift * cos(angle) + params.yShift;
        z = z + params.zShift * cos(angle) + params.zShift;
    }
    return total - 1.0;
}

// \u2500\u2500\u2500\u2500\u2500 2. Voronoi Flat\u2010Shade Tile Noise \u2500\u2500\u2500\u2500\u2500

fn voronoiFlatShadeRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));
    let fz : i32 = i32(floor(pos.z));
    var minDist    : f32 = 1e9;
    var secondDist : f32 = 1e9;

    for(var dz = -1; dz <= 1; dz = dz + 1) {
        for(var dy = -1; dy <= 1; dy = dy + 1) {
            for(var dx = -1; dx <= 1; dx = dx + 1) {
                let xi = fx + dx;
                let yi = fy + dy;
                let zi = fz + dz;
                let feature = vec3<f32>(f32(xi) + rand3u(xi, yi, zi),
                                        f32(yi) + rand3u(yi, zi, xi),
                                        f32(zi) + rand3u(zi, xi, yi));
                let d = euclideanDist(feature, pos);
                if(d < minDist) {
                    secondDist = minDist;
                    minDist    = d;
                } else if(d < secondDist) {
                    secondDist = d;
                }
            }
        }
    }
    let edgeDist = secondDist - minDist;
    return select(1.0, 0.0, edgeDist < params.threshold);
}

fn generateVoronoiFlatShade(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var pos = posIn / zoom + vec3<f32>(params.xShift, params.yShift, params.zShift);
    var total : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = max(params.freq, 1e-6);
    for(var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        total = total + voronoiFlatShadeRaw(pos * freq, params) * amp;
        amp  = amp * params.gain;
        freq = freq * params.lacunarity;
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);
    }
    return total;
}

// \u2500\u2500\u2500\u2500\u2500 3. Voronoi Ripple 3D \u2500\u2500\u2500\u2500\u2500

fn voronoiRipple3DRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let m = voro3D_metrics(pos);
    let edgeDist = voro_edge_dist(m.f1Sq, m.f2Sq);
    let ripple = sin(PI + edgeDist * PI * params.rippleFreq + params.time);
    let rippleAmp = (1.0 + ripple) * 0.5;
    let legacyCellValue = m.cellVal * rippleAmp;

    let modeValue = voro_legacy_cell_or_eval3D(m, params, max(params.freq, 1e-6), legacyCellValue);
    return select(modeValue * rippleAmp, legacyCellValue, params.voroMode == VORO_CELL);
}

fn generateVoronoiRipple3D(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var x = pos.x / zoom + params.xShift;
    var y = pos.y / zoom + params.yShift;
    var z = pos.z / zoom + params.zShift;
    var total : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = max(params.freq, 1e-6);
    for(var i: u32=0u; i<params.octaves; i=i+1u) {
        let sample = vec3<f32>(x * freq, y * freq, z * freq);
        total = total + voronoiRipple3DRaw(sample, params) * amp;
        amp   = amp * params.gain;
        freq  = freq * params.lacunarity;
        let angle = params.seedAngle * 2.0 * PI;
        x = x + params.xShift * cos(angle + f32(i));
        y = y + params.yShift * cos(angle + f32(i));
        z = z + params.zShift * cos(angle + f32(i));
    }
    return 2.0 * total - 1.0;
}


// \u2500\u2500\u2500\u2500\u2500 4. Voronoi Ripple 3D 2 \u2500\u2500\u2500\u2500\u2500
fn voronoiRipple3D2Raw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let m = voro3D_metrics(pos);
    let edgeDist = voro_edge_dist(m.f1Sq, m.f2Sq);
    let ripple = sin(PI + params.zoom * edgeDist * PI * params.rippleFreq + params.time);
    let rippleAmp = (1.0 + ripple) * 0.5;
    let legacyCellValue = m.cellVal * rippleAmp;

    let modeValue = voro_legacy_cell_or_eval3D(m, params, max(params.freq, 1e-6), legacyCellValue);
    return select(modeValue * rippleAmp, legacyCellValue, params.voroMode == VORO_CELL);
}

fn generateVoronoiRipple3D2(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var x = pos.x / zoom + params.xShift;
    var y = pos.y / zoom + params.yShift;
    var z = pos.z / zoom + params.zShift;
    var total: f32 = 0.0;
    var amp: f32 = 1.0;
    var freq: f32 = max(params.freq, 1e-6);

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let sample = vec3<f32>(x * freq, y * freq, z * freq);
        total = total + voronoiRipple3D2Raw(sample, params) * amp;
        amp = amp * params.gain;
        freq = freq * params.lacunarity;
        let angle = params.seedAngle * 2.0 * PI;
        x = x + params.xShift * cos(angle + f32(i));
        y = y + params.yShift * cos(angle + f32(i));
        z = z + params.zShift * cos(angle + f32(i));
    }
    return 2.0 * total - 1.0;
}

// \u2500\u2500\u2500\u2500\u2500 5. Voronoi Circular Ripple 3D \u2500\u2500\u2500\u2500\u2500
fn voronoiCircularRippleRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let m = voro3D_metrics(pos);
    let minDist = sqrt(max(m.f1Sq, 0.0));
    let ripple = sin(PI + minDist * PI * params.rippleFreq + params.time);
    let rippleAmp = (1.0 + ripple) * 0.5;
    let legacyCellValue = m.cellVal * rippleAmp;

    let modeValue = voro_legacy_cell_or_eval3D(m, params, max(params.freq, 1e-6), legacyCellValue);
    return select(modeValue * rippleAmp, legacyCellValue, params.voroMode == VORO_CELL);
}

fn generateVoronoiCircularRipple(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var x = pos.x / zoom + params.xShift;
    var y = pos.y / zoom + params.yShift;
    var z = pos.z / zoom + params.zShift;
    var total: f32 = 0.0;
    var amp: f32 = 1.0;
    var freq: f32 = max(params.freq, 1e-6);

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let sample = vec3<f32>(x * freq, y * freq, z * freq);
        total = total + voronoiCircularRippleRaw(sample, params) * amp;
        amp = amp * params.gain;
        freq = freq * params.lacunarity;
        let angle = params.seedAngle * 2.0 * PI;
        x = x + params.xShift * cos(angle + f32(i));
        y = y + params.yShift * cos(angle + f32(i));
        z = z + params.zShift * cos(angle + f32(i));
    }
    return 2.0 * total - 1.0;
}

// 6a. Fractal Voronoi Ripple 3D
fn generateFVoronoiRipple3D(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    // first FBM pass
    let fbm1 = generateVoronoiRipple3D(posIn, params);

    // prepare second\u2010pass params: keep everything the same except zoom=1
    var p2 = params;
    p2.zoom = 1.0;

    // second FBM pass, feeding the scalar result back into xyz
    let sample = vec3<f32>(fbm1, fbm1, fbm1);
    let fbm2   = generateVoronoiRipple3D(sample, p2);

    return 2.0 * fbm2;
}

// 6b. Fractal Voronoi Circular Ripple 3D
fn generateFVoronoiCircularRipple(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    // first FBM pass
    let fbm1 = generateVoronoiCircularRipple(posIn, params);

    // second\u2010pass with zoom=1
    var p2 = params;
    p2.zoom = 1.0;

    let sample = vec3<f32>(fbm1, fbm1, fbm1);
    let fbm2   = generateVoronoiCircularRipple(sample, p2);

    return 2.0 * fbm2;
}

// \u2014\u2014\u2014 continuousPermutation \u2014\u2014\u2014
fn continuousPermutation(value: f32) -> f32 {
    let iVal    = floor(value);
    let frac    = value - iVal;
    let i0      = i32(iVal);
    let idx1    = u32((i0 % 256 + 256) % 256);
    let idx2    = u32(((i0 + 1) % 256 + 256) % 256);
    let v1      = f32(perm(idx1));
    let v2      = f32(perm(idx2));
    return v1 + frac * (v2 - v1);
}

// \u2014\u2014\u2014 calculateRippleEffect \u2014\u2014\u2014
fn calculateRippleEffect(pos: vec3<f32>,
                         rippleFreq: f32,
                         neighborhoodSize: i32) -> f32 {
    var sum: f32 = 0.0;
    var count: f32 = 0.0;
    for (var dz = -neighborhoodSize; dz <= neighborhoodSize; dz = dz + 1) {
        for (var dy = -neighborhoodSize; dy <= neighborhoodSize; dy = dy + 1) {
            for (var dx = -neighborhoodSize; dx <= neighborhoodSize; dx = dx + 1) {
                let sample = vec3<f32>(
                    continuousPermutation(pos.x + f32(dx)),
                    continuousPermutation(pos.y + f32(dy)),
                    continuousPermutation(pos.z + f32(dz))
                );
                let d = length(sample - pos);
                sum = sum + sin(d * PI * rippleFreq);
                count = count + 1.0;
            }
        }
    }
    return sum / count;
}

// \u2014\u2014\u2014 generateRippleNoise \u2014\u2014\u2014
fn generateRippleNoise(pos: vec3<f32>, p: NoiseParams) -> f32 {
    let zoom = max(p.zoom, 1e-6);
    var x = pos.x / zoom + p.xShift;
    var y = pos.y / zoom + p.yShift;
    var z = pos.z / zoom + p.zShift;
    var sum: f32 = 0.0;
    var amp: f32 = 1.0;
    var freq: f32 = max(p.freq, 1e-6);
    var angle: f32 = p.seedAngle * 2.0 * PI;
    let angleInc = 2.0 * PI / max(f32(p.octaves), 1.0);
    let rippleFreqScaled = p.rippleFreq;
    let neigh = i32(p.exp1);

    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {
        var n = /* your base noise fn */ lanczos3D(vec3<f32>(x * freq, y * freq, z * freq)) * amp;
        if (p.turbulence == 1u) {
            n = abs(n);
        }
        let rip = calculateRippleEffect(vec3<f32>(x * freq, y * freq, z * freq),
                                        rippleFreqScaled,
                                        neigh);
        sum = sum + n * rip;

        freq   = freq * p.lacunarity;
        amp    = amp * p.gain;
        angle  = angle + angleInc;

        // simple phase offset; replace 0.0 with a hash if desired
        let phase: f32 = 0.0;
        x = x + p.xShift * cos(angle + phase);
        y = y + p.yShift * cos(angle + phase);
        z = z + p.zShift * cos(angle + phase);
    }

    if (p.turbulence == 1u) {
        sum = sum - 1.0;
    }
    return f32(p.octaves) * sum;
}

// \u2014\u2014\u2014 generateFractalRipples \u2014\u2014\u2014
fn generateFractalRipples(posIn: vec3<f32>, p: NoiseParams) -> f32 {
    // first pass at zoom scaled by exp2
    var p1 = p;
    p1.zoom = p.zoom * p.exp2+1.5;
    let fbm1 = generateRippleNoise(posIn, p1);

    // second pass feeding fbm1 back into xyz
    var p2 = p;
    let sample = vec3<f32>(fbm1, fbm1, fbm1);
    let fbm2   = generateRippleNoise(sample, p2);

    return 2.0 * fbm2;
}

// \u2014\u2014\u2014 1. HexWorms Raw \u2014\u2014\u2014
fn hexWormsRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let steps       : u32 = 5u;
    let persistence : f32 = 0.5;
    var total       : f32 = 0.0;
    var frequency   : f32 = 1.0;
    var amplitude   : f32 = 1.0;

    for (var i: u32 = 0u; i < steps; i = i + 1u) {
        // base cellular noise for direction
        let angle = generateCellular(pos * frequency, params) * 2.0 * PI;

        // step along the \u201Cworm\u201D
        let offset = vec3<f32>(
            cos(angle),
            sin(angle),
            sin(angle)
        ) * 0.5;
        let samplePos = pos + offset;

        // accumulate
        total = total + generateCellular(samplePos, params) * amplitude;

        amplitude = amplitude * persistence;
        frequency = frequency * 2.0;
    }

    // match JS: subtract 1 at the end
    return total - 1.0;
}

// \u2014\u2014\u2014 2. HexWorms Generator \u2014\u2014\u2014
fn generateHexWormsNoise(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var pos   = posIn / zoom + vec3<f32>(params.xShift, params.yShift, params.zShift);
    var sum   : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = max(params.freq, 1e-6);

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        sum = sum + hexWormsRaw(pos * freq, params) * amp;
        freq = freq * params.lacunarity;
        amp  = amp * params.gain;
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);
    }

    return sum;
}

// \u2014\u2014\u2014 3. PerlinWorms Raw \u2014\u2014\u2014
fn perlinWormsRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let steps       : u32 = 5u;
    let persistence : f32 = 0.5;
    var total       : f32 = 0.0;
    var frequency   : f32 = 1.0;
    var amplitude   : f32 = 1.0;

    for (var i: u32 = 0u; i < steps; i = i + 1u) {
        // base Perlin noise for direction
        let angle = generatePerlin(pos * frequency, params) * 2.0 * PI;

        // step along the \u201Cworm\u201D
        let offset = vec3<f32>(
            cos(angle),
            sin(angle),
            sin(angle)
        ) * 0.5;
        let samplePos = pos + offset;

        // accumulate
        total = total + generatePerlin(samplePos, params) * amplitude;

        amplitude = amplitude * persistence;
        frequency = frequency * 2.0;
    }

    return total;
}

// \u2014\u2014\u2014 PerlinWorms Generator \u2014\u2014\u2014
fn generatePerlinWormsNoise(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    let zoom = max(params.zoom, 1e-6);
    var pos   = posIn / zoom + vec3<f32>(params.xShift, params.yShift, params.zShift);
    var sum   : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = max(params.freq, 1e-6);

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        sum = sum + perlinWormsRaw(pos * freq, params) * amp;
        freq = freq * params.lacunarity;
        amp  = amp * params.gain;
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);
    }

    return sum;
}

// small helper: derive a few pseudorandom offsets from seed (u32)
fn seedOffsets(seed: u32) -> vec3<f32> {
  let s = f32(seed);
  let a = fract(sin(s * 12.9898) * 43758.5453);
  let b = fract(sin((s + 17.0) * 78.233) * 23421.631);
  let c = fract(sin((s + 31.0) * 37.719) * 97531.135);
  return vec3<f32>(a, b, c) * 0.5;
}

// safe tile sizes (u32) derived from Frame (avoid zero)
fn tileSizeX() -> u32 { return max(frame.tileWidth, 1u); }
fn tileSizeY() -> u32 { return max(frame.tileHeight, 1u); }
fn tileSizeZ() -> u32 { return max(frame.tileDepth, 1u); }

// --- helper: map pos -> integer pixel coords (uses frame uniform) ----------
// Returns wrapped pixel coords (periodic) so noise will tile across chunks.
fn posToPixelCoords_tiled(p : vec3<f32>) -> vec3<u32> {
  let fx = p.x * f32(frame.fullWidth);
  let fy = p.y * f32(frame.fullHeight);

  let ox_i : i32 = max(frame.originX, 0);
  let oy_i : i32 = max(frame.originY, 0);

  // integer pixel coords (unwrapped)
  let pxu : u32 = u32(floor(fx)) + u32(ox_i);
  let pyu : u32 = u32(floor(fy)) + u32(oy_i);

  let layer_i = max(frame.layerIndex, 0);
  let layer_u : u32 = u32(layer_i);

  // wrap coordinates into tile using modulo (cheap & correct for arbitrary tile sizes)
  let tx = tileSizeX();
  let ty = tileSizeY();
  let tz = tileSizeZ();
  let rx = pxu % tx;
  let ry = pyu % ty;
  let rz = layer_u % tz;

  return vec3<u32>(rx, ry, rz);
}

// --- deterministic integer hash that mixes seed (uses perm table) ---
// perm(...) implementation expected elsewhere (perm indexes 0..511)
fn hashed_with_seed(ix: u32, iy: u32, iz: u32, seed: u32) -> u32 {
  let a = perm((ix + seed * 1664525u) & 511u);
  let b = perm((a + (iy + seed * 22695477u)) & 511u);
  let c = perm((b + (iz + seed * 1103515245u)) & 511u);
  return c & 511u;
}
fn hashTo01_seeded(ix: u32, iy: u32, iz: u32, seed: u32) -> f32 {
  return f32(hashed_with_seed(ix, iy, iz, seed)) / 511.0;
}
fn hashToSigned01_seeded(ix: u32, iy: u32, iz: u32, seed: u32) -> f32 {
  return hashTo01_seeded(ix, iy, iz, seed) * 2.0 - 1.0;
}

// integer lattice helper consistent with the perm table, tiled by Frame sizes.
// p is continuous; freq and shifts control lattice alignment.
fn posToIntsForHash_tiled(p: vec3<f32>, freq: f32, sx: f32, sy: f32, sz: f32) -> vec3<u32> {
  let fx = floor(p.x * freq + sx);
  let fy = floor(p.y * freq + sy);
  let fz = floor(p.z * freq + sz);

  // cast and wrap to tile-size
  let tx = tileSizeX();
  let ty = tileSizeY();
  let tz = tileSizeZ();

  let ix = u32(fx) % tx;
  let iy = u32(fy) % ty;
  let iz = u32(fz) % tz;
  return vec3<u32>(ix, iy, iz);
}

// ---------------------- tiled value-noise 2D (smooth) ----------------------
// Uses posToIntsForHash_tiled internally => tiled/periodic by Frame tile sizes.
fn valueNoise2D_seeded(p : vec2<f32>, freq: f32, seed: u32, sx: f32, sy: f32) -> f32 {
  let f = max(freq, 1e-6);
  let fx = p.x * f + sx;
  let fy = p.y * f + sy;
  let ix_f = floor(fx);
  let iy_f = floor(fy);
  let txf = fx - ix_f;
  let tyf = fy - iy_f;

  // get tiled integer lattice coords (z = 0)
  let base = posToIntsForHash_tiled(vec3<f32>(ix_f, iy_f, 0.0), 1.0, 0.0, 0.0, 0.0);
  let ix = base.x;
  let iy = base.y;

  // neighbors (wrapped by tile in posToIntsForHash_tiled above)
  let ix1 = (ix + 1u) % tileSizeX();
  let iy1 = (iy + 1u) % tileSizeY();

  let h00 = hashToSigned01_seeded(ix,  iy,  0u, seed);
  let h10 = hashToSigned01_seeded(ix1, iy,  0u, seed);
  let h01 = hashToSigned01_seeded(ix,  iy1, 0u, seed);
  let h11 = hashToSigned01_seeded(ix1, iy1, 0u, seed);

  let sx_f = fade(txf);
  let sy_f = fade(tyf);
  let a = lerp(h00, h10, sx_f);
  let b = lerp(h01, h11, sx_f);
  return lerp(a, b, sy_f);
}

// ---------------------- White Noise (tiled, seeded, contrast/gain) ----
fn generateWhiteNoise(pos : vec3<f32>, params: NoiseParams) -> f32 {
  let seed : u32 = params.seed;

  // integer pixel coords (wrapped to tile)
  let ip = posToPixelCoords_tiled(pos);

  // subsampling (blocky) or per-pixel; safe cast
  let subs = max(u32(max(params.freq, 1.0)), 1u);
  let sx = (ip.x / subs) % tileSizeX();
  let sy = (ip.y / subs) % tileSizeY();
  let sz = ip.z % tileSizeZ();

  var v01 = hashTo01_seeded(sx, sy, sz, seed);

  // apply contrast around 0.5 via params.gain
  let contrast = 1.0 + params.gain;
  v01 = (v01 - 0.5) * contrast + 0.5;

  return clamp(v01, 0.0, 1.0);
}

fn wrapCoordOffset(base: u32, offset: i32, size: u32) -> u32 {
  let s = max(i32(size), 1);
  let v = ((i32(base) + offset) % s + s) % s;
  return u32(v);
}

fn blueNoiseLocalRank(ip: vec3<u32>, seed: u32, radius: i32) -> f32 {
  let center = hashTo01_seeded(ip.x, ip.y, ip.z, seed);
  var lower = 0.0;
  var total = 0.0;

  for (var dy: i32 = -radius; dy <= radius; dy = dy + 1) {
    for (var dx: i32 = -radius; dx <= radius; dx = dx + 1) {
      if (dx == 0 && dy == 0) {
        continue;
      }

      let sx = wrapCoordOffset(ip.x, dx, tileSizeX());
      let sy = wrapCoordOffset(ip.y, dy, tileSizeY());
      let n = hashTo01_seeded(sx, sy, ip.z, seed);
      lower += select(0.0, 1.0, n < center);
      total += 1.0;
    }
  }

  return (lower + center) / (total + 1.0);
}

// ---------------------- Blue Noise Generator (tiled, seeded) -------------
fn generateBlueNoise(pos : vec3<f32>, params: NoiseParams) -> f32 {
  let seed : u32 = params.seed;
  let ip0 = posToPixelCoords_tiled(pos);

  var ip = ip0;
  if (params.warpAmp > 0.0) {
    let jx = i32(round(hashToSigned01_seeded(ip0.x + 5u, ip0.y + 11u, ip0.z + 17u, seed) * params.warpAmp * 2.0));
    let jy = i32(round(hashToSigned01_seeded(ip0.x + 19u, ip0.y + 23u, ip0.z + 29u, seed) * params.warpAmp * 2.0));
    ip = vec3<u32>(
      wrapCoordOffset(ip0.x, jx, tileSizeX()),
      wrapCoordOffset(ip0.y, jy, tileSizeY()),
      ip0.z
    );
  }

  let rankSmall = blueNoiseLocalRank(ip, seed, 1);
  let rankLarge = blueNoiseLocalRank(ip, seed ^ 0x9E3779B9u, 2);
  var result = mix(rankLarge, rankSmall, 0.65);

  let micro = hashTo01_seeded(ip.x + 37u, ip.y + 61u, ip.z + 17u, seed ^ 0x85EBCA6Bu);
  result = clamp(result + (micro - 0.5) * (1.0 / 25.0), 0.0, 1.0);

  let contrast = max(1.0 + params.gain, 0.05);
  result = clamp((result - 0.5) * contrast + 0.5, 0.0, 1.0);
  return result;
}

const HYDRO_TAU : f32 = 6.283185307179586;

fn clamp01(x: f32) -> f32 {
  return clamp(x, 0.0, 1.0);
}

fn hydroHash2(p: vec2<f32>) -> vec2<f32> {
  let k = vec2<f32>(0.3183099, 0.3678794);
  let q = p * k + k.yx;
  return -1.0 + 2.0 * fract(16.0 * k * fract(q.x * q.y * (q.x + q.y)));
}

fn safeNormalize2(v: vec2<f32>) -> vec2<f32> {
  let l = length(v);
  if (l > 1e-10) {
    return v / l;
  }
  return vec2<f32>(0.0, 0.0);
}

fn powInv(t: f32, power: f32) -> f32 {
  return 1.0 - pow(1.0 - clamp01(t), power);
}

fn easeOut(t: f32) -> f32 {
  let v = 1.0 - clamp01(t);
  return 1.0 - v * v;
}

fn smoothStart(t: f32, smoothing: f32) -> f32 {
  let s = max(smoothing, 1e-6);
  if (t >= s) {
    return t - 0.5 * s;
  }
  return 0.5 * t * t / s;
}

fn loadPrevClamped2D(fx: i32, fy: i32, fz: i32) -> vec4<f32> {
  let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);
  let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);
  return loadPrevRGBA(cx, cy, fz);
}

fn fetchPosClamped2D(fx: i32, fy: i32, fz: i32) -> vec3<f32> {
  let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);
  let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);
  return fetchPos(cx, cy, fz);
}

fn resolutionScale() -> f32 {
  let refRes = 1024.0;
  let curRes = max(min(f32(frame.fullWidth), f32(frame.fullHeight)), 1.0);
  return curRes / refRes;
}

fn resolveFiniteSlope2D(fx: i32, fy: i32, fz: i32) -> vec2<f32> {
  let hL = loadPrevClamped2D(fx - 1, fy, fz).x;
  let hR = loadPrevClamped2D(fx + 1, fy, fz).x;
  let hD = loadPrevClamped2D(fx, fy - 1, fz).x;
  let hU = loadPrevClamped2D(fx, fy + 1, fz).x;

  let pL = fetchPosClamped2D(fx - 1, fy, fz);
  let pR = fetchPosClamped2D(fx + 1, fy, fz);
  let pD = fetchPosClamped2D(fx, fy - 1, fz);
  let pU = fetchPosClamped2D(fx, fy + 1, fz);

  let dx = max(abs(pR.x - pL.x), 1e-6);
  let dy = max(abs(pU.y - pD.y), 1e-6);

  let dHdX = (hR - hL) / dx;
  let dHdY = (hU - hD) / dy;

  return vec2<f32>(dHdX, dHdY);
}

fn guideGaussian(dx: i32, dy: i32, sigmaPx: f32) -> f32 {
  let s = max(sigmaPx, 0.05);
  let d2 = f32(dx * dx + dy * dy);
  return exp(-0.5 * d2 / (s * s));
}

fn guideHeightAt(fx: i32, fy: i32, fz: i32, sigmaWorld: f32) -> f32 {
  let sigmaPx = sigmaWorld * resolutionScale();

  var sumW = 0.0;
  var sumH = 0.0;

  for (var j: i32 = -4; j <= 4; j = j + 1) {
    for (var i: i32 = -4; i <= 4; i = i + 1) {
      let h = loadPrevClamped2D(fx + i, fy + j, fz).x;
      let w = guideGaussian(i, j, sigmaPx);
      sumW += w;
      sumH += h * w;
    }
  }

  return sumH / max(sumW, 1e-6);
}

fn drainBlurWeight(dx: i32, dy: i32, sigmaPx: f32) -> f32 {
  let s = max(sigmaPx, 0.05);
  let d2 = f32(dx * dx + dy * dy);
  return exp(-0.5 * d2 / (s * s));
}

fn blurredHeightAt(fx: i32, fy: i32, fz: i32, sigmaWorld: f32) -> f32 {
  let sigmaPx = sigmaWorld * resolutionScale();

  var sumW = 0.0;
  var sumH = 0.0;

  for (var j: i32 = -4; j <= 4; j = j + 1) {
    for (var i: i32 = -4; i <= 4; i = i + 1) {
      let s = loadPrevClamped2D(fx + i, fy + j, fz).x;
      let w = drainBlurWeight(i, j, sigmaPx);
      sumW += w;
      sumH += s * w;
    }
  }

  return sumH / max(sumW, 1e-6);
}

fn blurredRidgeAt(fx: i32, fy: i32, fz: i32, sigmaWorld: f32) -> f32 {
  let sigmaPx = sigmaWorld * resolutionScale();

  var sumW = 0.0;
  var sumR = 0.0;

  for (var j: i32 = -4; j <= 4; j = j + 1) {
    for (var i: i32 = -4; i <= 4; i = i + 1) {
      let s = loadPrevClamped2D(fx + i, fy + j, fz);
      let ridge = s.w * 2.0 - 1.0;
      let w = drainBlurWeight(i, j, sigmaPx);
      sumW += w;
      sumR += ridge * w;
    }
  }

  return sumR / max(sumW, 1e-6);
}

fn phacelleNoise(
  p: vec2<f32>,
  normDir: vec2<f32>,
  freq: f32,
  offset: f32,
  normalization: f32
) -> vec4<f32> {
  let sideDir = normDir.yx * vec2<f32>(-1.0, 1.0) * freq * HYDRO_TAU;
  let phaseOffset = offset * HYDRO_TAU;

  let pInt = floor(p);
  let pFrac = fract(p);

  var phaseDir = vec2<f32>(0.0);
  var weightSum = 0.0;

  for (var j: i32 = -1; j <= 2; j = j + 1) {
    for (var i: i32 = -1; i <= 2; i = i + 1) {
      let gridOffset = vec2<f32>(f32(i), f32(j));
      let gridPoint = pInt + gridOffset;
      let randomOffset = hydroHash2(gridPoint) * 0.5;
      let v = pFrac - gridOffset - randomOffset;

      let sqrDist = dot(v, v);
      var weight = exp(-sqrDist * 2.0);
      weight = max(0.0, weight - 0.01111);

      weightSum += weight;

      let waveInput = dot(v, sideDir) + phaseOffset;
      phaseDir += vec2<f32>(cos(waveInput), sin(waveInput)) * weight;
    }
  }

  let interpolated = phaseDir / max(weightSum, 1e-6);
  let mag = max(1.0 - normalization, length(interpolated));

  return vec4<f32>(interpolated / max(mag, 1e-6), sideDir);
}

fn pixelSpan2D(fx: i32, fy: i32, fz: i32) -> f32 {
  let pL = fetchPosClamped2D(fx - 1, fy, fz);
  let pR = fetchPosClamped2D(fx + 1, fy, fz);
  let pD = fetchPosClamped2D(fx, fy - 1, fz);
  let pU = fetchPosClamped2D(fx, fy + 1, fz);

  let dx = max(abs(pR.x - pL.x) * 0.5, 1e-6);
  let dy = max(abs(pU.y - pD.y) * 0.5, 1e-6);

  return max(dx, dy);
}


fn rotate2(v: vec2<f32>, angle: f32) -> vec2<f32> {
  let c = cos(angle);
  let s = sin(angle);
  return vec2<f32>(v.x * c - v.y * s, v.x * s + v.y * c);
}

fn signed01(v: f32) -> f32 {
  return v * 2.0 - 1.0;
}

fn terrainDetailMapScalar(uv: vec2<f32>, baseFreq: f32) -> f32 {
  var value = 0.0;
  var amp = 0.5;
  var ampSum = 0.0;
  var freqLoc = max(baseFreq, 1e-6);

  for (var i: u32 = 0u; i < 8u; i = i + 1u) {
    value += noise2D(uv * freqLoc) * amp;
    ampSum += amp;
    amp *= 0.95;
    freqLoc *= 2.0;
  }

  return value / max(ampSum, 1e-6);
}

fn generateSmokeNoise(pos: vec3<f32>, paramsIn: NoiseParams) -> f32 {
  let baseFreq = max(paramsIn.freq, 0.25);
  let baseOctaves = max(paramsIn.octaves, 3u);
  let lac = max(paramsIn.lacunarity, 2.0);

  var warpParams = paramsIn;
  warpParams.freq = baseFreq * 0.9;
  warpParams.octaves = max(baseOctaves, 3u);
  warpParams.gain = 0.55;
  warpParams.lacunarity = lac;

  let warpX = signed01(generateSimplex(pos + vec3<f32>(17.31, 9.73, 3.11), warpParams));
  let warpY = signed01(generatePerlin(pos + vec3<f32>(-11.37, 14.51, 5.71), warpParams));
  let warpZ = signed01(generateSimplex(pos + vec3<f32>(5.91, -7.13, 11.29), warpParams));
  let warpAmp = 0.18 + max(paramsIn.warpAmp, 0.0) * 0.35;
  let qWarp = pos + vec3<f32>(warpX, warpY, 0.35 * warpZ) * warpAmp;

  var macroParams = paramsIn;
  macroParams.freq = baseFreq * 0.5;
  macroParams.octaves = max(baseOctaves + 1u, 4u);
  macroParams.gain = 0.55;
  macroParams.lacunarity = lac;
  let macroRidge = signed01(generateRidgedMultifractal4(qWarp, macroParams));

  var continentalParams = paramsIn;
  continentalParams.freq = baseFreq * 0.28;
  continentalParams.octaves = max(baseOctaves, 3u);
  continentalParams.gain = 0.5;
  continentalParams.lacunarity = lac;
  let continental = signed01(generateBillow(qWarp + vec3<f32>(2.7, -4.1, 1.3), continentalParams));

  var ridgeParams = paramsIn;
  ridgeParams.freq = baseFreq * 1.45;
  ridgeParams.octaves = max(baseOctaves, 4u);
  ridgeParams.gain = 0.52;
  ridgeParams.lacunarity = lac;
  let detailRidge = signed01(generateRidgedMultifractal2(qWarp * 1.05 + vec3<f32>(4.2, 1.7, 0.0), ridgeParams));

  var worleyParams = paramsIn;
  worleyParams.freq = baseFreq * 1.75;
  worleyParams.octaves = 1u;
  worleyParams.gain = 1.0;
  worleyParams.lacunarity = 2.0;
  let cells = 1.0 - generateWorley(qWarp + vec3<f32>(7.5, -3.2, 0.0), worleyParams);
  let cellular = signed01(generateCellular(qWarp * 1.1 + vec3<f32>(-5.3, 6.4, 0.0), worleyParams));

  var rippleParams = paramsIn;
  rippleParams.freq = baseFreq * 2.25;
  rippleParams.octaves = 4u;
  rippleParams.gain = 0.7;
  rippleParams.lacunarity = max(lac, 2.0);
  let rippleWarpX = signed01(generatePerlin(qWarp * 1.9 + vec3<f32>(8.7, 3.1, 0.0), rippleParams));
  let rippleWarpY = signed01(generateSimplex(qWarp * 1.9 + vec3<f32>(-6.2, 5.4, 0.0), rippleParams));
  let rippleCarrier = signed01(generateBillow(qWarp * 2.3 + vec3<f32>(3.6, -8.9, 0.0), rippleParams));
  let rippleAngle = 0.6 + 0.35 * signed01(generatePerlin(qWarp + vec3<f32>(1.9, -2.7, 0.0), warpParams));
  let ripplePos = rotate2(qWarp.xy + vec2<f32>(rippleWarpX, rippleWarpY) * 0.08, rippleAngle);
  let rippleFreq = max(paramsIn.rippleFreq, 1.0);
  let ripple = sin(ripplePos.x * rippleFreq + rippleCarrier * 2.8);
  let rippleEnvelope = 0.5 + 0.5 * signed01(generatePerlin(qWarp * 1.35 + vec3<f32>(10.1, 4.8, 0.0), rippleParams));

  let cellBlend = clamp01(0.3 + paramsIn.threshold * 0.9);
  let rippleBlend = clamp01(0.02 + 0.008 * max(paramsIn.rippleFreq, 1.0));

  var terrain = 0.0;
  terrain += macroRidge * 0.46;
  terrain += continental * 0.14;
  terrain += detailRidge * 0.21;
  terrain += signed01(cells) * (0.10 * cellBlend);
  terrain += cellular * (0.06 * cellBlend);
  terrain += ripple * rippleEnvelope * rippleBlend;

  let lifted = terrain * 0.5 + 0.5 + paramsIn.zShift;
  return clamp01(lifted);
}

fn terrainVoroModeSample(pos: vec3<f32>, freqLoc: f32, mode: u32, edgeK: f32, threshold: f32) -> f32 {
  let s = voro_sample3D(pos * freqLoc);
  return clamp01(voro_eval(s.f1Sq, s.f2Sq, s.cellVal, mode, edgeK, threshold, freqLoc));
}

fn terrainVoroModeSmooth(pos: vec3<f32>, freqLoc: f32, mode: u32, edgeK: f32, threshold: f32) -> f32 {
  let step = 0.006;
  let center = terrainVoroModeSample(pos, freqLoc, mode, edgeK, threshold);
  let x1 = terrainVoroModeSample(pos + vec3<f32>( step, 0.0, 0.0), freqLoc, mode, edgeK, threshold);
  let x2 = terrainVoroModeSample(pos + vec3<f32>(-step, 0.0, 0.0), freqLoc, mode, edgeK, threshold);
  let y1 = terrainVoroModeSample(pos + vec3<f32>(0.0,  step, 0.0), freqLoc, mode, edgeK, threshold);
  let y2 = terrainVoroModeSample(pos + vec3<f32>(0.0, -step, 0.0), freqLoc, mode, edgeK, threshold);
  let d1 = terrainVoroModeSample(pos + vec3<f32>( step,  step, 0.0), freqLoc, mode, edgeK, threshold);
  let d2 = terrainVoroModeSample(pos + vec3<f32>(-step,  step, 0.0), freqLoc, mode, edgeK, threshold);
  let d3 = terrainVoroModeSample(pos + vec3<f32>( step, -step, 0.0), freqLoc, mode, edgeK, threshold);
  let d4 = terrainVoroModeSample(pos + vec3<f32>(-step, -step, 0.0), freqLoc, mode, edgeK, threshold);
  return clamp01((center * 4.0 + x1 * 2.0 + x2 * 2.0 + y1 * 2.0 + y2 * 2.0 + d1 + d2 + d3 + d4) / 16.0);
}

fn generateTerrainNoise(pos: vec3<f32>, paramsIn: NoiseParams) -> f32 {
  let baseFreq = max(paramsIn.freq, 0.24);
  let baseOctaves = max(paramsIn.octaves, 4u);
  let lac = max(paramsIn.lacunarity, 2.0);
  let warpAmount = 0.035 + max(paramsIn.warpAmp, 0.0) * 0.055;

  var warpParams = paramsIn;
  warpParams.freq = baseFreq * 0.55;
  warpParams.octaves = max(baseOctaves, 3u);
  warpParams.gain = 0.52;
  warpParams.lacunarity = lac;

  let warpA = signed01(generatePerlin(pos + vec3<f32>(7.3, -5.9, 1.7), warpParams));
  let warpB = signed01(generateSimplex(pos + vec3<f32>(-3.1, 9.4, 2.6), warpParams));
  let q = pos + vec3<f32>(warpA, warpB, 0.0) * warpAmount;

  var macroParams = paramsIn;
  macroParams.freq = baseFreq * 0.56;
  macroParams.octaves = max(baseOctaves + 1u, 5u);
  macroParams.gain = 0.58;
  macroParams.lacunarity = lac;
  let macroRidgeRaw = signed01(generateRidgedMultifractal4(q + vec3<f32>(4.2, 1.9, 0.0), macroParams));
  let macroRidge = sign(macroRidgeRaw) * pow(abs(macroRidgeRaw), 1.18);

  var sharpParams = paramsIn;
  sharpParams.freq = baseFreq * 1.08;
  sharpParams.octaves = max(baseOctaves, 5u);
  sharpParams.gain = 0.53;
  sharpParams.lacunarity = lac;
  let sharpRidgeRaw = signed01(generateRidgedMultifractal2(q * 1.04 + vec3<f32>(-3.7, 2.6, 0.0), sharpParams));
  let sharpRidge = sign(sharpRidgeRaw) * pow(abs(sharpRidgeRaw), 1.30);

  var worleyParams = paramsIn;
  worleyParams.freq = baseFreq * 0.82;
  worleyParams.octaves = 1u;
  worleyParams.gain = 1.0;
  worleyParams.lacunarity = 2.0;
  let worleyA = 1.0 - generateWorley(q + vec3<f32>(6.3, -1.7, 0.0), worleyParams);
  let worleyB = 1.0 - generateWorley(q + vec3<f32>(6.3 + 0.012, -1.7, 0.0), worleyParams);
  let worleyC = 1.0 - generateWorley(q + vec3<f32>(6.3 - 0.012, -1.7, 0.0), worleyParams);
  let worleyD = 1.0 - generateWorley(q + vec3<f32>(6.3, -1.7 + 0.012, 0.0), worleyParams);
  let worleyE = 1.0 - generateWorley(q + vec3<f32>(6.3, -1.7 - 0.012, 0.0), worleyParams);
  let smoothedWorley = (worleyA * 4.0 + worleyB + worleyC + worleyD + worleyE) / 8.0;
  let worleySignal = signed01(smoothedWorley);
  let worleyCarve = smoothstep(0.38, 0.84, smoothedWorley);
  let worleyGrad = vec2<f32>(worleyB - worleyC, worleyD - worleyE);
  let worleyTangent = safeNormalize2(vec2<f32>(-worleyGrad.y, worleyGrad.x));

  var angleParams = paramsIn;
  angleParams.freq = baseFreq * 0.72;
  angleParams.octaves = max(baseOctaves, 3u);
  angleParams.gain = 0.50;
  angleParams.lacunarity = lac;
  let angleField = signed01(generatePerlin(q + vec3<f32>(2.1, -4.7, 0.0), angleParams));
  let baseDir = safeNormalize2(vec2<f32>(cos(angleField * 1.9), sin(angleField * 1.9)));
  let joinMix = smoothstep(0.18, 0.82, smoothedWorley);
  let lineDir = safeNormalize2(mix(baseDir, worleyTangent, 0.72 * joinMix));
  let sideDir = vec2<f32>(-lineDir.y, lineDir.x);

  var rippleParams = paramsIn;
  rippleParams.freq = baseFreq * 1.7;
  rippleParams.octaves = 3u;
  rippleParams.gain = 0.62;
  rippleParams.lacunarity = max(lac, 2.0);
  let rippleWarp = vec2<f32>(
    signed01(generatePerlin(q * 1.25 + vec3<f32>(8.7, 1.3, 0.0), rippleParams)),
    signed01(generateSimplex(q * 1.25 + vec3<f32>(-6.2, 4.8, 0.0), rippleParams))
  ) * 0.024;
  let rippleCarrier = signed01(generateBillow(q * 1.85 + vec3<f32>(3.1, -7.2, 0.0), rippleParams));

  let detailMap = terrainDetailMapScalar(q.xy * 0.60 + vec2<f32>(11.7, -5.3), 2.0);
  let detailSoft = detailMap * detailMap * (3.0 - 2.0 * detailMap);
  let detailSignal = signed01(detailSoft);

  let joinedCoord = dot(q.xy + rippleWarp, sideDir);
  let branchCoord = dot(
    q.xy + rippleWarp * 0.7,
    safeNormalize2(mix(sideDir, worleyTangent, 0.35))
  );
  let rippleFreq = max(paramsIn.rippleFreq, 1.0) * 0.42;
  let ripplePrimary =
    sin(joinedCoord * rippleFreq + smoothedWorley * 4.0 + rippleCarrier * 1.1 + detailSignal * 0.28);
  let rippleBranch =
    sin(branchCoord * rippleFreq * 1.05 + smoothedWorley * 3.2 + rippleCarrier * 0.7 + detailSignal * 0.18);
  let ripple = mix(ripplePrimary, rippleBranch, 0.32 + 0.28 * joinMix);
  let rippleMask =
    smoothstep(0.08, 0.88, abs(macroRidge)) *
    (0.28 + 0.72 * joinMix) *
    (0.92 + 0.08 * detailSoft);
  let rippleBlend = clamp01(0.026 + 0.006 * max(paramsIn.rippleFreq, 1.0));

  let detailMask =
    smoothstep(0.12, 0.88, smoothedWorley) *
    smoothstep(0.04, 0.72, abs(macroRidge));

  var terrain = 0.0;
  terrain += macroRidge * 0.40;
  terrain += sharpRidge * 0.16;
  terrain += worleySignal * 0.11;
  terrain -= worleyCarve * 0.10;
  terrain += ripple * rippleMask * rippleBlend;
  terrain += detailSignal * detailMask * 0.012;

  let shaped = sign(terrain) * pow(abs(terrain), 0.96);
  let lifted = shaped * 0.5 + 0.5 + paramsIn.zShift;
  return clamp01(lifted);
}

fn erosionFilter(
  p: vec2<f32>,
  heightAndSlopeIn: vec3<f32>,
  fadeTargetIn: f32,
  strengthIn: f32,
  gullyWeightIn: f32,
  carrierWeightIn: f32,
  steeringWeightIn: f32,
  detailIn: f32,
  roundingIn: vec4<f32>,
  onsetIn: vec4<f32>,
  assumedSlopeIn: vec2<f32>,
  scaleIn: f32,
  octavesIn: u32,
  lacunarityIn: f32,
  gainIn: f32,
  cellScaleIn: f32,
  normalizationIn: f32,
  pixelSpanIn: f32,
  ridgeMapOut: ptr<function, f32>
) -> vec4<f32> {
  var heightAndSlope = heightAndSlopeIn;
  var fadeTarget = clamp(fadeTargetIn, -1.0, 1.0);

  let inputHeightAndSlope = heightAndSlopeIn;

  var strength = strengthIn * scaleIn;
  var freq = 1.0 / max(scaleIn * cellScaleIn, 1e-6);
  let carrierSharpness = 1.75;
  let slopeLength = max(length(heightAndSlopeIn.yz), 1e-10);
  var magnitude = 0.0;
  var roundingMult = 1.0;

  let roundingForInput =
    mix(roundingIn.y, roundingIn.x, clamp01(fadeTarget * 0.5 + 0.5)) * roundingIn.z;

  var combiMask =
    easeOut(smoothStart(slopeLength * onsetIn.x, roundingForInput * onsetIn.x));

  var ridgeMapCombiMask = easeOut(slopeLength * onsetIn.z);
  var ridgeMapFadeTarget = fadeTarget;

  var gullySlope =
    mix(
      heightAndSlopeIn.yz,
      safeNormalize2(heightAndSlopeIn.yz) * assumedSlopeIn.x,
      assumedSlopeIn.y
    );

  let pixelSpan = max(pixelSpanIn, 1e-6);

  for (var i: u32 = 0u; i < octavesIn; i = i + 1u) {
    let stripeStep = freq * cellScaleIn * HYDRO_TAU * pixelSpan;
    let stripeMask = 1.0 - smoothstep(1.05, 2.40, stripeStep);

    if (stripeMask <= 1e-4) {
      break;
    }

    var phacelle =
      phacelleNoise(
        p * freq,
        safeNormalize2(gullySlope),
        cellScaleIn,
        0.25,
        normalizationIn
      );

    phacelle = vec4<f32>(phacelle.xy, phacelle.z * -freq, phacelle.w * -freq);
    let sloping = abs(phacelle.y);
    let carrierRaw = clamp(phacelle.x, -1.0, 1.0);
    let carrierPhase = sign(carrierRaw) * pow(abs(carrierRaw), carrierSharpness);

    let octaveStrength = strength * stripeMask;

    gullySlope += sign(phacelle.y) * phacelle.zw * octaveStrength * gullyWeightIn * steeringWeightIn;

    let visibleGullies = vec3<f32>(carrierPhase, phacelle.y * phacelle.zw) * carrierWeightIn;
    let fadedGullies =
      mix(vec3<f32>(fadeTarget, 0.0, 0.0), visibleGullies, combiMask);

    heightAndSlope += fadedGullies * octaveStrength;
    magnitude += octaveStrength;
    let fadedCarrier = mix(fadeTarget, carrierPhase, combiMask);
    fadeTarget = mix(fadeTarget, fadedCarrier, stripeMask);

    let roundingForOctave =
      mix(roundingIn.y, roundingIn.x, clamp01(carrierPhase * 0.5 + 0.5)) * roundingMult;

    let newMask =
      easeOut(smoothStart(sloping * onsetIn.y, roundingForOctave * onsetIn.y));

    combiMask = powInv(combiMask, detailIn) * mix(1.0, newMask, stripeMask);

    ridgeMapFadeTarget = mix(ridgeMapFadeTarget, carrierPhase, ridgeMapCombiMask * stripeMask);

    let newRidgeMapMask = easeOut(sloping * onsetIn.w);
    ridgeMapCombiMask = ridgeMapCombiMask * mix(1.0, newRidgeMapMask, stripeMask);

    strength *= gainIn;
    freq *= lacunarityIn;
    roundingMult *= roundingIn.w;
  }

  *ridgeMapOut = ridgeMapFadeTarget * (1.0 - ridgeMapCombiMask);

  let delta = heightAndSlope - inputHeightAndSlope;
  return vec4<f32>(delta, magnitude);
}

@compute @workgroup_size(8, 8, 1)
fn computeTerrainNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {
    return;
  }

  let pos = fetchPos(fx, fy, fz);
  let v0 = generateTerrainNoise(pos, params);
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeSmokeNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {
    return;
  }

  let pos = fetchPos(fx, fy, fz);
  let v0 = generateSmokeNoise(pos, params);
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeHydrologyErosionHeightfield(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (readFrom3D() || writeTo3D()) {
    return;
  }

  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {
    return;
  }

  let src = loadPrevClamped2D(fx, fy, fz);
  let pos = fetchPos(fx, fy, fz);

  var baseHeight = src.x;
  var guideHeight = src.x;
  let rawSlope = resolveFiniteSlope2D(fx, fy, fz);
  var guideSlope = rawSlope;

  if (params.turbulence != 0u) {
    baseHeight = src.w;
    guideHeight = src.x;
    guideSlope = src.yz;

    if (length(guideSlope) < 1e-8) {
      guideSlope = rawSlope;
    }
  }

  let steerSlope = mix(rawSlope, guideSlope, 0.82);
  let fadeHeight = mix(baseHeight, guideHeight, 0.35);

  var erosionScale = params.zoom;
  if (abs(erosionScale) < 1e-6) {
    erosionScale = 0.15;
  }

  var domainScale = params.freq;
  if (abs(domainScale) < 1e-6) {
    domainScale = 1.0;
  }

  var erosionStrength = options.heightScale;
  if (abs(erosionStrength) < 1e-6) {
    erosionStrength = 1.0;
  }
  erosionStrength *= 0.22;

  var gullyWeight = params.exp1;
  if (abs(gullyWeight) < 1e-6) {
    gullyWeight = 0.5;
  }

  var carrierWeight = max(params.edgeK, 0.0);
  if (carrierWeight < 1e-6) {
    carrierWeight = 0.24;
  }
  carrierWeight = clamp01(carrierWeight);

  var steeringWeight = max(params.time, 0.0);
  if (steeringWeight < 1e-6) {
    steeringWeight = 1.10;
  }

  var detail = params.seedAngle;
  if (abs(detail) < 1e-6) {
    detail = 1.5;
  }

  var fadeScale = params.exp2;
  if (abs(fadeScale) < 1e-6) {
    fadeScale = 1.6666667;
  }

  var cellScale = params.threshold;
  if (abs(cellScale) < 1e-6) {
    cellScale = 0.7;
  }

  var normalization = params.rippleFreq;
  if (abs(normalization) < 1e-6) {
    normalization = 0.5;
  }
  normalization = clamp01(normalization);

  var assumedSlopeValue = params.warpAmp;
  if (abs(assumedSlopeValue) < 1e-6) {
    assumedSlopeValue = 0.7;
  }
  assumedSlopeValue = max(assumedSlopeValue, 1e-4);

  var assumedSlopeMix = params.gaborRadius;
  if (abs(assumedSlopeMix) < 1e-6) {
    assumedSlopeMix = 1.0;
  }
  assumedSlopeMix = clamp01(assumedSlopeMix);

  var onsetScale = params.terraceStep;
  if (abs(onsetScale) < 1e-6) {
    onsetScale = 8.0;
  }
  onsetScale = max(onsetScale / 8.0, 1e-4);

  let rounding = vec4<f32>(
    0.10,
    0.00,
    0.10,
    max(params.lacunarity, 1.0)
  );

  let onset = vec4<f32>(
    1.25,
    1.25,
    2.80,
    1.50
  ) * onsetScale;

  let assumedSlope = vec2<f32>(assumedSlopeValue, assumedSlopeMix);

  let seedShift = vec2<f32>(
    f32(params.seed & 65535u) * 0.00001173,
    f32((params.seed >> 16u) & 65535u) * 0.00000937
  );

  let domainP =
    pos.xy * domainScale +
    vec2<f32>(params.xShift, params.yShift) +
    seedShift;

  let fadeTarget = clamp(((fadeHeight - 0.5 + params.zShift) * 2.0) * fadeScale, -1.0, 1.0);
  let pixelSpan = pixelSpan2D(fx, fy, fz);

  var ridgeMap = 0.0;
  let h = erosionFilter(
    domainP,
    vec3<f32>(baseHeight, steerSlope.x, steerSlope.y),
    fadeTarget,
    erosionStrength,
    gullyWeight,
    carrierWeight,
    steeringWeight,
    detail,
    rounding,
    onset,
    assumedSlope,
    erosionScale,
    max(params.octaves, 1u),
    max(params.lacunarity, 1.0),
    max(params.gain, 1e-4),
    cellScale,
    normalization,
    pixelSpan,
    &ridgeMap
  );

  let terrainHeightOffsetConst = options.baseRadius;

  let offset = terrainHeightOffsetConst * h.w;

  let erodedHeight = baseHeight + h.x + offset;
  let outSlope = steerSlope + h.yz;
  let ridgeMapEncoded = clamp01(ridgeMap * 0.5 + 0.5);

  storeRGBA(
    fx,
    fy,
    fz,
    vec4<f32>(erodedHeight, outSlope.x, outSlope.y, ridgeMapEncoded)
  );
}

@compute @workgroup_size(8, 8, 1)
fn computeHydrologyGuideField(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (readFrom3D() || writeTo3D()) {
    return;
  }

  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {
    return;
  }

  let src = loadPrevClamped2D(fx, fy, fz);
  let rawHeight = src.x;

  var sigma = abs(params.threshold);
  if (sigma < 1e-6) {
    sigma = 0.90;
  }

  var guideBlend = params.exp1;
  if (abs(guideBlend) < 1e-6) {
    guideBlend = 0.35;
  }
  guideBlend = clamp01(guideBlend);

  let blurredC = guideHeightAt(fx, fy, fz, sigma);
  let blurredL = guideHeightAt(fx - 1, fy, fz, sigma);
  let blurredR = guideHeightAt(fx + 1, fy, fz, sigma);
  let blurredD = guideHeightAt(fx, fy - 1, fz, sigma);
  let blurredU = guideHeightAt(fx, fy + 1, fz, sigma);

  let guideHeight = mix(rawHeight, blurredC, guideBlend);
  let guideL = mix(loadPrevClamped2D(fx - 1, fy, fz).x, blurredL, guideBlend);
  let guideR = mix(loadPrevClamped2D(fx + 1, fy, fz).x, blurredR, guideBlend);
  let guideD = mix(loadPrevClamped2D(fx, fy - 1, fz).x, blurredD, guideBlend);
  let guideU = mix(loadPrevClamped2D(fx, fy + 1, fz).x, blurredU, guideBlend);

  let pL = fetchPosClamped2D(fx - 1, fy, fz);
  let pR = fetchPosClamped2D(fx + 1, fy, fz);
  let pD = fetchPosClamped2D(fx, fy - 1, fz);
  let pU = fetchPosClamped2D(fx, fy + 1, fz);

  let dx = max(abs(pR.x - pL.x), 1e-6);
  let dy = max(abs(pU.y - pD.y), 1e-6);

  let guideSlopeX = (guideR - guideL) / dx;
  let guideSlopeY = (guideU - guideD) / dy;

  storeRGBA(
    fx,
    fy,
    fz,
    vec4<f32>(guideHeight, guideSlopeX, guideSlopeY, rawHeight)
  );
}

fn computeHydroDrainageField(fx: i32, fy: i32, fz: i32) -> vec4<f32> {
  let coarseSigma = 1.75;

  let hC = blurredHeightAt(fx, fy, fz, coarseSigma);
  let hL = blurredHeightAt(fx - 1, fy, fz, coarseSigma);
  let hR = blurredHeightAt(fx + 1, fy, fz, coarseSigma);
  let hD = blurredHeightAt(fx, fy - 1, fz, coarseSigma);
  let hU = blurredHeightAt(fx, fy + 1, fz, coarseSigma);

  let pL = fetchPosClamped2D(fx - 1, fy, fz);
  let pR = fetchPosClamped2D(fx + 1, fy, fz);
  let pD = fetchPosClamped2D(fx, fy - 1, fz);
  let pU = fetchPosClamped2D(fx, fy + 1, fz);

  let dx = max(abs(pR.x - pL.x), 1e-6);
  let dy = max(abs(pU.y - pD.y), 1e-6);

  let slope = vec2<f32>(
    (hR - hL) / dx,
    (hU - hD) / dy
  );

  let flowDir = -safeNormalize2(slope);

  let ridgeBroad = blurredRidgeAt(fx, fy, fz, 1.6);
  let valleyPrior = 1.0 - smoothstep(-0.12, 0.08, ridgeBroad);

  let valleyDepth = max(0.0, (hL + hR + hD + hU) * 0.25 - hC);
  let concavityGain = max(abs(params.edgeK), 1e-4) * 36.0;
  let concavityMask = clamp01(valleyDepth * concavityGain);

  let slopeOnset = max(abs(params.warpAmp), 1e-4);
  let slopeMask = easeOut(clamp01(length(slope) / slopeOnset));

  let contrast = max(abs(params.exp1), 1e-4);
  let gain = max(abs(params.exp2), 1e-4);

  var drainage = valleyPrior * concavityMask * slopeMask;
  drainage = pow(clamp01(drainage), contrast);
  drainage = clamp01(drainage * gain);

  return vec4<f32>(
    drainage,
    valleyPrior,
    flowDir.x * 0.5 + 0.5,
    flowDir.y * 0.5 + 0.5
  );
}

@compute @workgroup_size(8, 8, 1)
fn computeHydrologyDrainageMask(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (readFrom3D() || writeTo3D()) {
    return;
  }

  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {
    return;
  }

  let outCol = computeHydroDrainageField(fx, fy, fz);
  storeRGBA(fx, fy, fz, outCol);
}

// Shared tiling constants
const WGX : u32 = 8u;
const WGY : u32 = 8u;
const TILE_W : u32 = WGX + 2u; // 1 texel halo on each side
const TILE_H : u32 = WGY + 2u;

// Per-kernel workgroup tiles at module scope
var<workgroup> normalTile  : array<array<f32, TILE_W>, TILE_H>;
var<workgroup> normal8Tile : array<array<f32, TILE_W>, TILE_H>;
var<workgroup> volumeTile  : array<array<f32, TILE_W>, TILE_H>;
var<workgroup> sphereTile  : array<array<f32, TILE_W>, TILE_H>;

// Height fetch 
fn sampleHeight(x: i32, y: i32, z: i32) -> f32 { if (readFrom3D()) { return textureLoad(inputTex3D, vec3<i32>(x, y, clampZ(z)), 0).x; } return textureLoad(inputTex, vec2<i32>(x, y), frame.layerIndex, 0).x; } fn safeNormalize(v: vec3<f32>) -> vec3<f32> { let len2 = dot(v, v); if (len2 > 1e-12) { return v * inverseSqrt(len2); } return vec3<f32>(0.0, 0.0, 1.0); }

@compute @workgroup_size(WGX, WGY, 1)
fn computeNormal(@builtin(global_invocation_id) gid: vec3<u32>,
                 @builtin(local_invocation_id)  lid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let wMax = i32(frame.fullWidth)  - 1;
  let hMax = i32(frame.fullHeight) - 1;

  let tx = i32(lid.x) + 1;
  let ty = i32(lid.y) + 1;

  let cx = clamp(fx, 0, wMax);
  let cy = clamp(fy, 0, hMax);

  // center
  normalTile[u32(ty)][u32(tx)] = sampleHeight(cx, cy, fz);

  // 1-texel halo
  if (lid.x == 0u)               { normalTile[u32(ty)][0u]               = sampleHeight(clamp(cx - 1, 0, wMax), cy, fz); }
  if (lid.x == WGX - 1u)         { normalTile[u32(ty)][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), cy, fz); }
  if (lid.y == 0u)               { normalTile[0u][u32(tx)]               = sampleHeight(cx, clamp(cy - 1, 0, hMax), fz); }
  if (lid.y == WGY - 1u)         { normalTile[TILE_H - 1u][u32(tx)]      = sampleHeight(cx, clamp(cy + 1, 0, hMax), fz); }
  if (lid.x == 0u && lid.y == 0u) {
    normalTile[0u][0u]            = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);
  }
  if (lid.x == WGX - 1u && lid.y == 0u) {
    normalTile[0u][TILE_W - 1u]   = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);
  }
  if (lid.x == 0u && lid.y == WGY - 1u) {
    normalTile[TILE_H - 1u][0u]   = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);
  }
  if (lid.x == WGX - 1u && lid.y == WGY - 1u) {
    normalTile[TILE_H - 1u][TILE_W - 1u] = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);
  }

  workgroupBarrier();

  // 4-neighbor central differences
  let zC = normalTile[u32(ty)][u32(tx)];
  let zL = normalTile[u32(ty)][u32(tx - 1)];
  let zR = normalTile[u32(ty)][u32(tx + 1)];
  let zD = normalTile[u32(ty - 1)][u32(tx)];
  let zU = normalTile[u32(ty + 1)][u32(tx)];

  let dx = (zR - zL) * 0.5;
  let dy = (zU - zD) * 0.5;

  let n   = normalize(vec3<f32>(dx, dy, 1.0));
  let enc = n * 0.5 + vec3<f32>(0.5);

  // pack: .r = original height, .g = enc.y, .b = enc.x, .a = enc.z
  let outCol = vec4<f32>(zC, enc.y, enc.x, enc.z);
  storeRGBA(cx, cy, fz, outCol);
}

// 8-neighbor filtered gradient using the same tile
@compute @workgroup_size(WGX, WGY, 1)
fn computeNormal8(@builtin(global_invocation_id) gid: vec3<u32>,
                  @builtin(local_invocation_id)  lid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let wMax = i32(frame.fullWidth)  - 1;
  let hMax = i32(frame.fullHeight) - 1;

  let tx = i32(lid.x) + 1;
  let ty = i32(lid.y) + 1;

  let cx = clamp(fx, 0, wMax);
  let cy = clamp(fy, 0, hMax);

  // center
  normal8Tile[u32(ty)][u32(tx)] = sampleHeight(cx, cy, fz);

  // halo
  if (lid.x == 0u)                    { normal8Tile[u32(ty)][0u]               = sampleHeight(clamp(cx - 1, 0, wMax), cy, fz); }
  if (lid.x == WGX - 1u)              { normal8Tile[u32(ty)][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), cy, fz); }
  if (lid.y == 0u)                    { normal8Tile[0u][u32(tx)]               = sampleHeight(cx, clamp(cy - 1, 0, hMax), fz); }
  if (lid.y == WGY - 1u)              { normal8Tile[TILE_H - 1u][u32(tx)]      = sampleHeight(cx, clamp(cy + 1, 0, hMax), fz); }
  if (lid.x == 0u && lid.y == 0u)     { normal8Tile[0u][0u]                    = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy - 1, 0, hMax), fz); }
  if (lid.x == WGX - 1u && lid.y == 0u) {
    normal8Tile[0u][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);
  }
  if (lid.x == 0u && lid.y == WGY - 1u) {
    normal8Tile[TILE_H - 1u][0u]      = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);
  }
  if (lid.x == WGX - 1u && lid.y == WGY - 1u) {
    normal8Tile[TILE_H - 1u][TILE_W - 1u] = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);
  }

  workgroupBarrier();

  let zC  = normal8Tile[u32(ty)][u32(tx)];
  let zL  = normal8Tile[u32(ty)][u32(tx - 1)];
  let zR  = normal8Tile[u32(ty)][u32(tx + 1)];
  let zD  = normal8Tile[u32(ty - 1)][u32(tx)];
  let zU  = normal8Tile[u32(ty + 1)][u32(tx)];
  let zUL = normal8Tile[u32(ty + 1)][u32(tx - 1)];
  let zUR = normal8Tile[u32(ty + 1)][u32(tx + 1)];
  let zDL = normal8Tile[u32(ty - 1)][u32(tx - 1)];
  let zDR = normal8Tile[u32(ty - 1)][u32(tx + 1)];

  let dx = ((zR + zUR + zDR) - (zL + zUL + zDL)) / 3.0;
  let dy = ((zU + zUR + zUL) - (zD + zDR + zDL)) / 3.0;

  let n   = normalize(vec3<f32>(dx, dy, 1.0));
  let enc = n * 0.5 + vec3<f32>(0.5);
  let outCol = vec4<f32>(zC, enc.y, enc.x, enc.z);
  storeRGBA(cx, cy, fz, outCol);
}

fn encode01(v: vec3<f32>) -> vec3<f32> {
    return v * 0.5 + vec3<f32>(0.5);
}

// Volume normals: tile the XY plane and only sample Z neighbors per pixel
@compute @workgroup_size(WGX, WGY, 1)
fn computeNormalVolume(@builtin(global_invocation_id) gid: vec3<u32>,
                       @builtin(local_invocation_id)  lid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let wMax = i32(frame.fullWidth)  - 1;
  let hMax = i32(frame.fullHeight) - 1;

  let tx = i32(lid.x) + 1;
  let ty = i32(lid.y) + 1;

  let cx = clamp(fx, 0, wMax);
  let cy = clamp(fy, 0, hMax);

  // center slice values once per tile
  volumeTile[u32(ty)][u32(tx)] = sampleHeight(cx, cy, fz);
  if (lid.x == 0u)                    { volumeTile[u32(ty)][0u]               = sampleHeight(clamp(cx - 1, 0, wMax), cy, fz); }
  if (lid.x == WGX - 1u)              { volumeTile[u32(ty)][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), cy, fz); }
  if (lid.y == 0u)                    { volumeTile[0u][u32(tx)]               = sampleHeight(cx, clamp(cy - 1, 0, hMax), fz); }
  if (lid.y == WGY - 1u)              { volumeTile[TILE_H - 1u][u32(tx)]      = sampleHeight(cx, clamp(cy + 1, 0, hMax), fz); }
  if (lid.x == 0u && lid.y == 0u)     { volumeTile[0u][0u]                    = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy - 1, 0, hMax), fz); }
  if (lid.x == WGX - 1u && lid.y == 0u) {
    volumeTile[0u][TILE_W - 1u]       = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);
  }
  if (lid.x == 0u && lid.y == WGY - 1u) {
    volumeTile[TILE_H - 1u][0u]       = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);
  }
  if (lid.x == WGX - 1u && lid.y == WGY - 1u) {
    volumeTile[TILE_H - 1u][TILE_W - 1u] = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);
  }

  workgroupBarrier();

  let zC = volumeTile[u32(ty)][u32(tx)];
  let zL = volumeTile[u32(ty)][u32(tx - 1)];
  let zR = volumeTile[u32(ty)][u32(tx + 1)];
  let zD = volumeTile[u32(ty - 1)][u32(tx)];
  let zU = volumeTile[u32(ty + 1)][u32(tx)];

  let dx = (zR - zL) * 0.5;
  let dy = (zU - zD) * 0.5;

  let zB = sampleHeight(cx, cy, clampZ(fz - 1));
  let zF = sampleHeight(cx, cy, clampZ(fz + 1));
  let dz = (zF - zB) * 0.5;

  let n   = safeNormalize(vec3<f32>(dx, dy, dz));
  let enc = encode01(n);
  storeRGBA(cx, cy, fz, vec4<f32>(enc, zC));
}


fn wrapSphereLon(lon: i32, width: i32) -> i32 {
    let segments = max(width - 1, 1);
    return ((lon % segments) + segments) % segments;
}

fn loadSphereHeight(lon: i32, lat: i32, width: i32, height: i32, layer: i32) -> f32 {
    let x = wrapSphereLon(lon, width);
    let y = clamp(lat, 0, height - 1);
    return textureLoad(inputTex, vec2<i32>(x, y), layer, 0).x;
}

fn sphereUnitFromAngles(theta: f32, phi: f32) -> vec3<f32> {
    let sTh = sin(theta);
    return vec3<f32>(sTh * cos(phi), sTh * sin(phi), cos(theta));
}

fn sphereSurfacePos(lat: i32, theta: f32, phi: f32, heightValue: f32, maxLat: i32) -> vec3<f32> {
    let r = options.baseRadius + heightValue * options.heightScale;

    if (lat <= 0) {
        return vec3<f32>(0.0, 0.0, r);
    }

    if (lat >= maxLat) {
        return vec3<f32>(0.0, 0.0, -r);
    }

    return sphereUnitFromAngles(theta, phi) * r;
}

// Sphere normals with logical longitude wrapping.
// The mesh keeps a duplicate seam column at lon == segments for Babylon/UVs, but
// the sampler treats longitude as modulo segments. This keeps lon 0 and lon N
// numerically identical and avoids the hard normal/color seam that shows up as a
// zipper around the planet.
@compute @workgroup_size(WGX, WGY, 1)
fn computeSphereNormal(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let w  = i32(frame.fullWidth);
    let h  = i32(frame.fullHeight);

    if (fx < 0 || fy < 0 || fx >= w || fy >= h) {
        return;
    }

    let segments = max(w - 1, 1);
    let maxLat = h - 1;
    let lon = wrapSphereLon(fx, w);
    let lat = clamp(fy, 0, maxLat);

    let baseH = loadSphereHeight(lon, lat, w, h, frame.layerIndex);
    let dPhi = 2.0 * PI / f32(segments);
    let dTheta = PI / f32(max(maxLat, 1));
    let theta = f32(lat) * dTheta;
    let phi = f32(lon) * dPhi;

    var n: vec3<f32>;

    if (lat <= 0) {
        n = vec3<f32>(0.0, 0.0, 1.0);
    } else if (lat >= maxLat) {
        n = vec3<f32>(0.0, 0.0, -1.0);
    } else {
        let hW = loadSphereHeight(lon - 1, lat, w, h, frame.layerIndex);
        let hE = loadSphereHeight(lon + 1, lat, w, h, frame.layerIndex);
        let hS = loadSphereHeight(lon, lat - 1, w, h, frame.layerIndex);
        let hN = loadSphereHeight(lon, lat + 1, w, h, frame.layerIndex);

        let pW = sphereSurfacePos(lat, theta, phi - dPhi, hW, maxLat);
        let pE = sphereSurfacePos(lat, theta, phi + dPhi, hE, maxLat);
        let pS = sphereSurfacePos(lat - 1, theta - dTheta, phi, hS, maxLat);
        let pN = sphereSurfacePos(lat + 1, theta + dTheta, phi, hN, maxLat);

        let tLon = pE - pW;
        let tLat = pN - pS;
        let radial = sphereUnitFromAngles(theta, phi);
        n = safeNormalize(cross(tLat, tLon));

        if (dot(n, radial) < 0.0) {
            n = -n;
        }
    }

    let enc = n * 0.5 + vec3<f32>(0.5);
    textureStore(outputTex, vec2<i32>(fx, fy), frame.layerIndex, vec4<f32>(baseH, enc.x, enc.y, enc.z));
}


// Texture clear to reset channel(s)
@compute @workgroup_size(8, 8, 1)
fn clearTexture(@builtin(global_invocation_id) gid : vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  writeChannel(fx, fy, fz, 0.0, options.outputChannel, 1u);
}

// \u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014
// 0) Perlin
// \u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014
@compute @workgroup_size(8, 8, 1)
fn computePerlin(@builtin(global_invocation_id) gid : vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);

    // fetch the 3D position for this pixel
    let p  = fetchPos(fx, fy, fz);

    // generate one sample of Perlin noise
    let v0 = generatePerlin(p, params);

    // add it into the selected channel (or all channels) of the output
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 0.1) Perlin 4D (fBM using time as W)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computePerlin4D(@builtin(global_invocation_id) gid : vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);

    // fetch the 3D position for this pixel (w comes from params.time inside the generator)
    let p  = fetchPos(fx, fy, fz);

    // generate one sample of 4D Perlin fBM (uses params.time as 4th dim)
    let v0 = generatePerlin4D(p, params);

    // write into output
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 1) Billow
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeBillow(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateBillow(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 2) AntiBillow
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiBillow(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiBillow(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 3) Ridge
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeRidge(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateRidge(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 4) AntiRidge
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidge(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiRidge(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 5) RidgedMultifractal
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeRidgedMultifractal(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateRidgedMultifractal(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 6) RidgedMultifractal2
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeRidgedMultifractal2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateRidgedMultifractal2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 7) RidgedMultifractal3
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeRidgedMultifractal3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateRidgedMultifractal3(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 8) RidgedMultifractal4
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeRidgedMultifractal4(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateRidgedMultifractal4(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 9) AntiRidgedMultifractal
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidgedMultifractal(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiRidgedMultifractal(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 10) AntiRidgedMultifractal2
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidgedMultifractal2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiRidgedMultifractal2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 11) AntiRidgedMultifractal3
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidgedMultifractal3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiRidgedMultifractal3(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 12) AntiRidgedMultifractal4
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidgedMultifractal4(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiRidgedMultifractal4(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 13) FBM (2\xB7simplex chain)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeFBM(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateFBM(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 14) FBM2 (chain+zoom FBM)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeFBM2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateFBM2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 15) FBM3 (three-stage FBM chain)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeFBM3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateFBM3(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 16) CellularBM1
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeCellularBM1(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateCellularBM1(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 17) CellularBM2
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeCellularBM2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateCellularBM2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 18) CellularBM3
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeCellularBM3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateCellularBM3(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 19) VoronoiBM1
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM1(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiBM1(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 20) VoronoiBM2
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiBM2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 21) VoronoiBM3
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiBM3(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 22) Cellular
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeCellular(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateCellular(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  22.1) AntiCellular
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
@compute @workgroup_size(8, 8, 1)
fn computeAntiCellular(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiCellular(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 22.2) Cellular
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeCellular4D(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateCellular4D(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  22.3) AntiCellular
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
@compute @workgroup_size(8, 8, 1)
fn computeAntiCellular4D(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiCellular4D(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 23) Worley
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeWorley(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateWorley(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  23.1) AntiWorley
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/
@compute @workgroup_size(8, 8, 1)
fn computeAntiWorley(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateAntiWorley(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 23.2) Worley 4D (fBM using time as W)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeWorley4D(@builtin(global_invocation_id) gid : vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);

    // fetch the 3D position for this pixel (w comes from params.time inside the generator)
    let p  = fetchPos(fx, fy, fz);

    // generate one sample of 4D Worley fBM (uses params.time as 4th dim)
    let v0 = generateWorley4D(p, params);

    // write into output
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 23.3) Worley 4D (fBM using time as W)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeAntiWorley4D(@builtin(global_invocation_id) gid : vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);

    // fetch the 3D position for this pixel (w comes from params.time inside the generator)
    let p  = fetchPos(fx, fy, fz);

    // generate one sample of 4D Worley fBM (uses params.time as 4th dim)
    let v0 = generateAntiWorley4D(p, params);

    // write into output
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Worley 4D BM variants (time as W)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeWorleyBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateWorleyBM1_4D(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeWorleyBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateWorleyBM2_4D(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeWorleyBM3_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateWorleyBM3_4D(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeWorleyBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateWorleyBM1_4D_vec(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeWorleyBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateWorleyBM2_4D_vec(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeWorleyBM3_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateWorleyBM3_4D_vec(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Cellular 4D BM variants (time as W)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeCellularBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateCellularBM1_4D(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeCellularBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateCellularBM2_4D(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeCellularBM3_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateCellularBM3_4D(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeCellularBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateCellularBM1_4D_vec(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeCellularBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateCellularBM2_4D_vec(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeCellularBM3_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let p = fetchPos(fx, fy, fz);
  let v0 = generateCellularBM3_4D_vec(p, params);

  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 24) VoronoiTileNoise
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiTileNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiTileNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 25) LanczosBillow
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeLanczosBillow(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateLanczosBillow(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 26) LanczosAntiBillow
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeLanczosAntiBillow(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateLanczosAntiBillow(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 27) Voronoi Circle-Gradient Noise
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiCircleNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiCircleNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 28) Voronoi Circle-Gradient Tile Noise 2
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiCircle2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiCircle2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 29) Voronoi Flat-Shade Tile Noise
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiFlatShade(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiFlatShade(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 30) Voronoi Ripple 3D
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiRipple3D(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiRipple3D(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 31) Voronoi Ripple 3D 2
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiRipple3D2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiRipple3D2(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 32) Voronoi Circular Ripple 3D
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiCircularRipple(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateVoronoiCircularRipple(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 33) Fractal Voronoi Ripple 3D
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeFVoronoiRipple3D(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateFVoronoiRipple3D(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 34) Fractal Voronoi Circular Ripple 3D
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeFVoronoiCircularRipple(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateFVoronoiCircularRipple(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 35) Ripple Noise
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeRippleNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateRippleNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 36) Fractal Ripples
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeFractalRipples(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateFractalRipples(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 37) HexWorms
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeHexWorms(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateHexWormsNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 38) PerlinWorms
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computePerlinWorms(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generatePerlinWormsNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 39) White Noise
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeWhiteNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateWhiteNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 40) Blue Noise
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
@compute @workgroup_size(8, 8, 1)
fn computeBlueNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let p  = fetchPos(fx, fy, fz);
    let v0 = generateBlueNoise(p, params);
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

// 41) Simplex
@compute @workgroup_size(8,8,1)
fn computeSimplex(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  let v0 = generateSimplex(p, params);
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeSimplexFBM(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  let v0 = generateSimplexFBM(p, params);
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);
}


@compute @workgroup_size(8,8,1)
fn computeCurl2D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let pos = fetchPos(fx, fy, fz).xy;
  let v   = curl2_simplex2D(pos, params);
  // gentle gain so it doesn\u2019t clip hard; tweak 0.75 if you like
  let m   = mag_to_signed01(length(v) * 0.75);

  writeChannel(fx, fy, fz, m, options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeCurlFBM2D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);

  let pos = fetchPos(fx, fy, fz).xy;
  let v   = curl2_simplexFBM(pos, params);
  let m   = mag_to_signed01(length(v) * 0.75);

  writeChannel(fx, fy, fz, m, options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeDomainWarpFBM1(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateDomainWarpFBM1(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeDomainWarpFBM2(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateDomainWarpFBM2(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeGaborAnisotropic(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateGaborAniso(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeGaborMagic(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateGaborMagic(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeTerraceNoise(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateTerraceNoise(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeFoamNoise(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateFoamNoise(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeTurbulence(@builtin(global_invocation_id) gid: vec3<u32>){
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateTurbulence(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateBillow4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeAntiBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateAntiBillow4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeLanczosBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateLanczosBillow4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeLanczosAntiBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateLanczosAntiBillow4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeFBM4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateFBM4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8,8,1)
fn computeVoronoi4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoi4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoiBM1_4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoiBM2_4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM3_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoiBM3_4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoiBM1_4D_vec(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoiBM2_4D_vec(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM3_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateVoronoiBM3_4D_vec(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeDomainWarpFBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateDomainWarpFBM1_4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeDomainWarpFBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateDomainWarpFBM2_4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeDomainWarpFBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateDomainWarpFBM1_4D_vec(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeDomainWarpFBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateDomainWarpFBM2_4D_vec(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeTerraceNoise4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateTerraceNoise4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeFoamNoise4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateFoamNoise4D(p, params), options.outputChannel, 0u);
}

@compute @workgroup_size(8, 8, 1)
fn computeTurbulence4D(@builtin(global_invocation_id) gid: vec3<u32>) {
  let fx = i32(frame.originX) + i32(gid.x);
  let fy = i32(frame.originY) + i32(gid.y);
  let fz = i32(frame.originZ) + i32(gid.z);
  let p  = fetchPos(fx, fy, fz);
  writeChannel(fx, fy, fz, generateTurbulence4D(p, params), options.outputChannel, 0u);
}



// too slow to compile all at once due to branching, had to write new entry point logic
// fn computeMixedNoise(pos : vec3<f32>) -> f32 {
//     var result   : f32 = 0.0;
//     var paramIdx : u32 = 0u;

//     // copy the mask so we can eat bits out of it
//     var bits : u32 = options.mask;

//     // while there's still a set bit, handle just that one
//     loop {
//         // bail as soon as we've consumed all bits
//         if (bits == 0u) {
//             break;
//         }

//         // find the lowest set bit index
//         let i : u32 = firstTrailingBit(bits);

//         // clear that bit so next iteration finds the next one
//         bits = bits & (bits - 1u);

//         // load this algo's params
//         let p = params[paramIdx];
//         paramIdx = paramIdx + 1u;

//         // dispatch the one selected generator
//         var v : f32 = 0.0;
//         switch(i) {
//             case 0u:  { v = generatePerlin(pos, p); }
//             // case 1u:  { v = generateBillow(pos, p); }
//             // case 2u:  { v = generateAntiBillow(pos, p); }
//             // case 3u:  { v = generateRidge(pos, p); }
//             // case 4u:  { v = generateAntiRidge(pos, p); }
//             // case 5u:  { v = generateRidgedMultifractal(pos, p); }
//             // case 6u:  { v = generateRidgedMultifractal2(pos, p); }
//             // case 7u:  { v = generateRidgedMultifractal3(pos, p); }
//             // case 8u:  { v = generateRidgedMultifractal4(pos, p); }
//             // case 9u:  { v = generateAntiRidgedMultifractal(pos, p); }
//             // case 10u: { v = generateAntiRidgedMultifractal2(pos, p); }
//             // case 11u: { v = generateAntiRidgedMultifractal3(pos, p); }
//             // case 12u: { v = generateAntiRidgedMultifractal4(pos, p); }
//             // case 13u: { v = generateFBM(pos, p); }
//             // case 14u: { v = generateFBM2(pos, p); }
//             // case 15u: { v = generateFBM3(pos, p); }
//             // case 16u: { v = generateCellularBM1(pos, p); }
//             // case 17u: { v = generateCellularBM2(pos, p); }
//             // case 18u: { v = generateCellularBM3(pos, p); }
//             // case 19u: { v = generateVoronoiBM1(pos, p); }
//             // case 20u: { v = generateVoronoiBM2(pos, p); }
//             // case 21u: { v = generateVoronoiBM3(pos, p); }
//             // case 22u: { v = generateCellular(pos, p); }
//             // case 23u: { v = generateWorley(pos, p); }
//             // case 24u: { v = generateVoronoiTileNoise(pos, p); }
//             // case 25u: { v = generateLanczosBillow(pos, p); }
//             // case 26u: { v = generateLanczosAntiBillow(pos, p); }
//             //todo port the rest, also more generic ones like white/blue noise
//             default:  { /* unsupported bit \u2192 no contribution */ }
//         }

//         result = result + v;

//         // stop if we've reached the max slots you filled
//         if (paramIdx >= MAX_NOISE_CONFIGS) {
//             break;
//         }
//     }

//     return result;
// }

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Compute Entry \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// @compute @workgroup_size(8, 8, 1)
// fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
//     // 2) compute absolute pixel coords in the full output
//     let fx = i32(frame.originX) + i32(gid.x);
//     let fy = i32(frame.originY) + i32(gid.y);
//     let p = fetchPos(fx, fy);

//     // 4) compute the mixed noise height
//     let h = computeMixedNoise(p);

//     // 5) (optional) finite-difference normal
//     var out: vec4<f32>;
//     if (options.getGradient == 1u) {
//         // let ex = options.epsilon.x;
//         // let ey = options.epsilon.y;
//         // let ez = options.epsilon.z;

//         // let hx = computeMixedNoise(p + vec3<f32>(ex, 0.0, 0.0));
//         // let lx = computeMixedNoise(p - vec3<f32>(ex, 0.0, 0.0));
//         // let hy = computeMixedNoise(p + vec3<f32>(0.0, ey, 0.0));
//         // let ly = computeMixedNoise(p - vec3<f32>(0.0, ey, 0.0));
//         // let hz = computeMixedNoise(p + vec3<f32>(0.0, 0.0, ez));
//         // let lz = computeMixedNoise(p - vec3<f32>(0.0, 0.0, ez));

//         // var dx = (hx - lx) / (2.0 * ex);
//         // var dy = (hy - ly) / (2.0 * ey);
//         // var dz = (hz - lz) / (2.0 * ez);
//         // let invLen = 1.0 / max(1e-6, sqrt(dx*dx + dy*dy + dz*dz));
//         // dx *= invLen; dy *= invLen; dz *= invLen;

//         // out = vec4<f32>(h, dx, dy, dz);
//     } else {
//         out = vec4<f32>(h, h, h, h);
//     }

//   // 6) write into the layer of the 2D-array texture
//   textureStore(
//     outputTex,
//     vec2<i32>(fx, fy),
//     frame.layerIndex,      
//     out
//   );
// }



// 5x5 Gaussian blur (separable weights via shared tile, single-pass)
// Applies per-channel convolution on RGBA and writes rgba16f
// If options.outputChannel == 0, writes all channels
// If 1..4, only that channel is replaced with blurred value, others copied from source

const WG_X : u32 = 16u;
const WG_Y : u32 = 16u;
const R    : u32 = 2u;        // kernel radius for 5x5
const TILE_SIZE : u32 = TILE_W * TILE_H;

const G5 : array<f32, 5> = array<f32,5>(1.0, 4.0, 6.0, 4.0, 1.0);
const G5NORM : f32 = 1.0 / 256.0;

var<workgroup> tileRGBA : array<vec4<f32>, TILE_SIZE>;

fn tileIndex(x: u32, y: u32)->u32 {
  return y * TILE_W + x;
}

@compute @workgroup_size(WG_X, WG_Y, 1)
fn computeGauss5x5(
  @builtin(local_invocation_id)  lid: vec3<u32>,
  @builtin(workgroup_id)         wid: vec3<u32>,
  @builtin(global_invocation_id) gid: vec3<u32>
){
  // Workgroup top-left in full image space
  let wgOx = i32(frame.originX) + i32(wid.x) * i32(WG_X);
  let wgOy = i32(frame.originY) + i32(wid.y) * i32(WG_Y);
  let fz   = i32(frame.originZ) + i32(gid.z);

  // Cooperatively load a (WG_X+4) x (WG_Y+4) tile with a 2px halo
  var ty: u32 = lid.y;
  loop {
    if (ty >= TILE_H) { break; }
    var tx: u32 = lid.x;
    loop {
      if (tx >= TILE_W) { break; }
      let sx = clamp(wgOx + i32(tx) - i32(R), 0, i32(frame.fullWidth)  - 1);
      let sy = clamp(wgOy + i32(ty) - i32(R), 0, i32(frame.fullHeight) - 1);
      tileRGBA[tileIndex(tx, ty)] = loadPrevRGBA(sx, sy, fz);
      tx += WG_X;
    }
    ty += WG_Y;
  }
  workgroupBarrier();

  // Output pixel this thread is responsible for
  let fx = wgOx + i32(lid.x);
  let fy = wgOy + i32(lid.y);

  // Guard writes that might fall off the image on the final groups
  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {
    return;
  }

  // Center within the shared tile
  let txc = u32(lid.x) + R;
  let tyc = u32(lid.y) + R;

  // 5x5 Gaussian using separable weights via outer product on the tile
  var acc : vec4<f32> = vec4<f32>(0.0);
  for (var j: u32 = 0u; j < 5u; j = j + 1u) {
    let wy = G5[j];
    let tyN = u32(i32(tyc) + i32(j) - 2);
    for (var i: u32 = 0u; i < 5u; i = i + 1u) {
      let wx = G5[i];
      let txN = u32(i32(txc) + i32(i) - 2);
      let w = (wx * wy) * G5NORM;
      acc += tileRGBA[tileIndex(txN, tyN)] * w;
    }
  }

  // Channel selection: 0 -> write all, 1..4 -> replace that channel only
  var outCol = acc;
  if (options.outputChannel != 0u) {
    let src = loadPrevRGBA(fx, fy, fz);
    let c = options.outputChannel;
    outCol = src;
    if (c == 1u) { outCol.x = acc.x; }
    else if (c == 2u) { outCol.y = acc.y; }
    else if (c == 3u) { outCol.z = acc.z; }
    else if (c == 4u) { outCol.w = acc.w; }
  }

  storeRGBA(fx, fy, fz, outCol);
}
`;

  // tools/noise/noiseBlit.wgsl
  var noiseBlit_default = "// Fullscreen quad (module-scope constant)\r\nconst kQuad : array<vec2<f32>, 6> = array<vec2<f32>, 6>(\r\n  vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),\r\n  vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)\r\n);\r\n\r\nstruct VsOut {\r\n  @builtin(position) pos : vec4<f32>,\r\n  @location(0)       uv  : vec2<f32>,\r\n};\r\n\r\n@vertex\r\nfn vs_main(@builtin(vertex_index) i : u32) -> VsOut {\r\n  let p = kQuad[i];\r\n\r\n  var o : VsOut;\r\n  o.pos = vec4<f32>(p, 0.0, 1.0);\r\n  o.uv  = p * 0.5 + vec2<f32>(0.5, 0.5);\r\n  return o;\r\n}\r\n\r\n@group(0) @binding(0) var samp : sampler;\r\n@group(0) @binding(1) var tex  : texture_2d_array<f32>;\r\n\r\nstruct UBlit2D {\r\n  layer   : u32,\r\n  channel : u32,\r\n  _pad0   : u32,\r\n  _pad1   : u32,\r\n};\r\n@group(0) @binding(2) var<uniform> U : UBlit2D;\r\n\r\n@fragment\r\nfn fs_main(in : VsOut) -> @location(0) vec4<f32> {\r\n  // For array textures the signature is (tex, sampler, uv, arrayIndex, level)\r\n  let c = textureSampleLevel(tex, samp, in.uv, i32(U.layer), 0.0);\r\n\r\n  // display a single channel directly\r\n  var v = c.r;\r\n  if (U.channel == 2u) { v = c.g; }\r\n  if (U.channel == 3u) { v = c.b; }\r\n  if (U.channel == 4u) { v = c.a; }\r\n\r\n  return vec4<f32>(clamp(v, 0.0, 1.0));\r\n}\r\n";

  // tools/noise/noiseBlit3D.wgsl
  var noiseBlit3D_default = "const kQuad : array<vec2<f32>, 6> = array<vec2<f32>, 6>(\r\n  vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),\r\n  vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)\r\n);\r\n\r\nstruct VsOut {\r\n  @builtin(position) pos : vec4<f32>,\r\n  @location(0)       uv  : vec2<f32>,\r\n};\r\n\r\n@vertex\r\nfn vs_main(@builtin(vertex_index) i : u32) -> VsOut {\r\n  let p = kQuad[i];\r\n  var o : VsOut;\r\n  o.pos = vec4<f32>(p, 0.0, 1.0);\r\n  o.uv  = p * 0.5 + vec2<f32>(0.5, 0.5);\r\n  return o;\r\n}\r\n\r\n@group(0) @binding(0) var samp : sampler;\r\n@group(0) @binding(1) var tex3d : texture_3d<f32>;\r\n\r\nstruct UBlit3D {\r\n  zNorm   : f32,  // normalized depth [0..1]\r\n  channel : u32,\r\n  _pad0   : u32,\r\n  _pad1   : u32,\r\n};\r\n@group(0) @binding(2) var<uniform> U : UBlit3D;\r\n\r\n@fragment\r\nfn fs_main(in : VsOut) -> @location(0) vec4<f32> {\r\n  let coord = vec3<f32>(in.uv, clamp(U.zNorm, 0.0, 1.0));\r\n  let c = textureSample(tex3d, samp, coord);\r\n\r\n  // display a single channel directly\r\n  var v = c.r;\r\n  if (U.channel == 2u) { v = c.g; }\r\n  if (U.channel == 3u) { v = c.b; }\r\n  if (U.channel == 4u) { v = c.a; }\r\n\r\n  return vec4<f32>(clamp(v, 0.0, 1.0));\r\n}\r\n";

  // tools/noise/noiseCompute.js
  var MAX_2D_TILE = 4096;
  var MAX_3D_TILE = 2048;
  var BYTES_PER_VOXEL = 8;
  var NoiseComputeBuilder = class {
    /**
     * @param {GPUDevice} device
     * @param {GPUQueue}  queue
     */
    constructor(device2, queue2) {
      this.device = device2;
      this.queue = queue2;
      this.maxBufferChunkBytes = 8e6;
      this.entryPoints = [
        "computePerlin",
        "computeBillow",
        "computeAntiBillow",
        "computeRidge",
        "computeAntiRidge",
        "computeRidgedMultifractal",
        "computeRidgedMultifractal2",
        "computeRidgedMultifractal3",
        "computeRidgedMultifractal4",
        "computeAntiRidgedMultifractal",
        "computeAntiRidgedMultifractal2",
        "computeAntiRidgedMultifractal3",
        "computeAntiRidgedMultifractal4",
        "computeFBM",
        "computeFBM2",
        "computeFBM3",
        "computeCellularBM1",
        "computeCellularBM2",
        "computeCellularBM3",
        "computeVoronoiBM1",
        "computeVoronoiBM2",
        "computeVoronoiBM3",
        "computeCellular",
        "computeWorley",
        "computeAntiCellular",
        "computeAntiWorley",
        "computeLanczosBillow",
        "computeLanczosAntiBillow",
        "computeVoronoiTileNoise",
        "computeVoronoiCircleNoise",
        "computeVoronoiCircle2",
        "computeVoronoiFlatShade",
        "computeVoronoiRipple3D",
        "computeVoronoiRipple3D2",
        "computeVoronoiCircularRipple",
        "computeFVoronoiRipple3D",
        "computeFVoronoiCircularRipple",
        "computeRippleNoise",
        "computeFractalRipples",
        "computeHexWorms",
        "computePerlinWorms",
        "computeWhiteNoise",
        "computeBlueNoise",
        "computeSimplex",
        "computeSimplexFBM",
        "computeCurl2D",
        "computeCurlFBM2D",
        "computeDomainWarpFBM1",
        "computeDomainWarpFBM2",
        "computeGaborAnisotropic",
        "computeGaborMagic",
        "computeGaborFlow",
        "computeTerraceNoise",
        "computeFoamNoise",
        "computeTurbulence",
        "computePerlin4D",
        "computeWorley4D",
        "computeAntiWorley4D",
        "computeCellular4D",
        "computeAntiCellular4D",
        "computeBillow4D",
        "computeAntiBillow4D",
        "computeLanczosBillow4D",
        "computeLanczosAntiBillow4D",
        "computeFBM4D",
        "computeVoronoi4D",
        "computeVoronoiBM1_4D",
        "computeVoronoiBM2_4D",
        "computeVoronoiBM3_4D",
        "computeVoronoiBM1_4D_vec",
        "computeVoronoiBM2_4D_vec",
        "computeVoronoiBM3_4D_vec",
        "computeWorleyBM1_4D",
        "computeWorleyBM2_4D",
        "computeWorleyBM3_4D",
        "computeWorleyBM1_4D_vec",
        "computeWorleyBM2_4D_vec",
        "computeWorleyBM3_4D_vec",
        "computeCellularBM1_4D",
        "computeCellularBM2_4D",
        "computeCellularBM3_4D",
        "computeCellularBM1_4D_vec",
        "computeCellularBM2_4D_vec",
        "computeCellularBM3_4D_vec",
        "computeTerraceNoise4D",
        "computeFoamNoise4D",
        "computeTurbulence4D",
        "computeSmokeNoise",
        "computeTerrainNoise",
        //erosion shader
        "computeHydrologyErosionHeightfield",
        "computeHydrologyGuideField",
        "computeHydrologyDrainageMask",
        //normal map computing.
        "computeGauss5x5",
        "computeNormal",
        "computeNormal8",
        "computeSphereNormal",
        "computeNormalVolume",
        "clearTexture"
      ];
      this.shaderModule = device2.createShaderModule({ code: noiseCompute_default });
      this.bindGroupLayout = device2.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          // options
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          // params
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "read-only-storage" }
          },
          // perm table
          {
            binding: 3,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "2d-array" }
          },
          // input 2D-array (sampled)
          {
            binding: 4,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              access: "write-only",
              format: "rgba16float",
              viewDimension: "2d-array"
            }
          },
          // output 2D-array (storage)
          {
            binding: 5,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "read-only-storage" }
          },
          // positions
          {
            binding: 6,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          // frame
          {
            binding: 7,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "3d" }
          },
          // input 3D
          {
            binding: 8,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              access: "write-only",
              format: "rgba16float",
              viewDimension: "3d"
            }
          }
          // output 3D
        ]
      });
      this.pipelineLayout = device2.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout]
      });
      this.pipelines = /* @__PURE__ */ new Map();
      this._texPairs = /* @__PURE__ */ new Map();
      this._tid = null;
      this._tag = /* @__PURE__ */ new WeakMap();
      this._default2DKey = "__default2d";
      this._volumeCache = /* @__PURE__ */ new Map();
      this.viewA = null;
      this.viewB = null;
      this.width = 0;
      this.height = 0;
      this.layers = 1;
      this.isA = true;
      this._initBuffers();
      this._ensureDummies();
      this._ctxMap = /* @__PURE__ */ new WeakMap();
    }
    // ---------------------------
    // buffers and dummies
    // ---------------------------
    _initBuffers() {
      this.optionsBuffer?.destroy();
      this.paramsBuffer?.destroy();
      this.permBuffer?.destroy();
      this.nullPosBuffer?.destroy();
      this.optionsBuffer = this.device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.paramsBuffer = this.device.createBuffer({
        size: 24 * 4,
        // <- updated
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.permBuffer = this.device.createBuffer({
        size: 512 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      this.nullPosBuffer = this.device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      this.queue.writeBuffer(this.optionsBuffer, 0, new ArrayBuffer(32));
      this.queue.writeBuffer(this.paramsBuffer, 0, new ArrayBuffer(24 * 4));
      this.queue.writeBuffer(this.permBuffer, 0, new Uint32Array(512));
    }
    _ensureDummies() {
      if (!this._dummy2D_sampleTex) {
        this._dummy2D_sampleTex = this.device.createTexture({
          size: [1, 1, 1],
          format: "rgba16float",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
        });
        this._dummy2D_sampleView = this._dummy2D_sampleTex.createView({
          dimension: "2d-array",
          arrayLayerCount: 1
        });
      }
      if (!this._dummy2D_writeTex) {
        this._dummy2D_writeTex = this.device.createTexture({
          size: [1, 1, 1],
          format: "rgba16float",
          usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST
        });
        this._dummy2D_writeView = this._dummy2D_writeTex.createView({
          dimension: "2d-array",
          arrayLayerCount: 1
        });
      }
      if (!this._dummy3D_sampleTex) {
        this._dummy3D_sampleTex = this.device.createTexture({
          size: { width: 1, height: 1, depthOrArrayLayers: 1 },
          dimension: "3d",
          format: "rgba16float",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
        });
        this._dummy3D_sampleView = this._dummy3D_sampleTex.createView({
          dimension: "3d"
        });
      }
      if (!this._dummy3D_writeTex) {
        this._dummy3D_writeTex = this.device.createTexture({
          size: { width: 1, height: 1, depthOrArrayLayers: 1 },
          dimension: "3d",
          format: "rgba16float",
          usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST
        });
        this._dummy3D_writeView = this._dummy3D_writeTex.createView({
          dimension: "3d"
        });
      }
    }
    _getMaxBufferChunkBytes(requested) {
      const devMax = this.device?.limits?.maxBufferSize ?? 256 * 1024 * 1024;
      const cap = Math.max(1024 * 1024, Math.floor(devMax * 0.9));
      let want = Number.isFinite(requested) ? Math.floor(requested) : this.maxBufferChunkBytes;
      if (!Number.isFinite(want) || want <= 0) want = this.maxBufferChunkBytes;
      want = Math.max(4, want) & ~3;
      return Math.min(cap, want);
    }
    _writeBufferChunked(dstBuffer, dstOffsetBytes, srcAB, srcOffsetBytes, byteLength, maxChunkBytes = null) {
      const total = byteLength | 0;
      if (!(total > 0)) return;
      const chunk = this._getMaxBufferChunkBytes(maxChunkBytes);
      let off = 0;
      while (off < total) {
        let n = Math.min(chunk, total - off) | 0;
        n = n & ~3;
        if (n <= 0) break;
        this.queue.writeBuffer(
          dstBuffer,
          dstOffsetBytes + off | 0,
          srcAB,
          srcOffsetBytes + off | 0,
          n
        );
        off = off + n | 0;
      }
      if (off !== total) {
        throw new Error(
          `_writeBufferChunked: incomplete write ${off}/${total} bytes`
        );
      }
    }
    async _readBGRA8TextureToRGBA8Pixels(texture, W, H, opts = {}) {
      const width = Math.max(1, W | 0);
      const height = Math.max(1, H | 0);
      const bytesPerPixel = 4;
      const align = 256;
      const bytesPerRowUnaligned = width * bytesPerPixel;
      const bytesPerRow = Math.ceil(bytesPerRowUnaligned / align) * align;
      const maxBuf = this.device?.limits?.maxBufferSize ?? 256 * 1024 * 1024;
      const cap = Math.max(1024 * 1024, Math.floor(maxBuf * 0.9));
      let chunkBytes = this._getMaxBufferChunkBytes(opts.maxBufferChunkBytes);
      if (chunkBytes < bytesPerRow) chunkBytes = bytesPerRow;
      if (bytesPerRow > cap) {
        throw new Error(
          `_readBGRA8TextureToRGBA8Pixels: bytesPerRow=${bytesPerRow} exceeds safe buffer cap=${cap}`
        );
      }
      const rowsPerChunk = Math.max(1, Math.floor(chunkBytes / bytesPerRow)) | 0;
      const pixels = new Uint8ClampedArray(width * height * 4);
      const chunks = [];
      const encoder = this.device.createCommandEncoder();
      for (let y0 = 0; y0 < height; y0 += rowsPerChunk) {
        const rows = Math.min(rowsPerChunk, height - y0) | 0;
        const bufSize = bytesPerRow * rows | 0;
        const readBuffer = this.device.createBuffer({
          size: bufSize,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        encoder.copyTextureToBuffer(
          { texture, origin: { x: 0, y: y0, z: 0 } },
          { buffer: readBuffer, bytesPerRow, rowsPerImage: rows },
          { width, height: rows, depthOrArrayLayers: 1 }
        );
        chunks.push({ readBuffer, y0, rows });
      }
      this.queue.submit([encoder.finish()]);
      if (this.queue && this.queue.onSubmittedWorkDone) {
        try {
          await this.queue.onSubmittedWorkDone();
        } catch (e) {
        }
      }
      for (const ch of chunks) {
        const { readBuffer, y0, rows } = ch;
        await readBuffer.mapAsync(GPUMapMode.READ);
        const mapped = readBuffer.getMappedRange();
        const src = new Uint8Array(mapped);
        for (let ry = 0; ry < rows; ry++) {
          const srcRow = ry * bytesPerRow;
          const dstRow = (y0 + ry) * width * 4;
          for (let x = 0; x < width; x++) {
            const si = srcRow + x * 4;
            const di = dstRow + x * 4;
            pixels[di + 0] = src[si + 2];
            pixels[di + 1] = src[si + 1];
            pixels[di + 2] = src[si + 0];
            pixels[di + 3] = src[si + 3];
          }
        }
        readBuffer.unmap();
        readBuffer.destroy();
      }
      return pixels;
    }
    // ---------------------------
    // public setters
    // ---------------------------
    resize(maxConfigs) {
      this.maxConfigs = maxConfigs;
      this._initBuffers();
    }
    setPermTable(permArray) {
      this.queue.writeBuffer(this.permBuffer, 0, permArray);
    }
    setPosBuffer(posBuffer) {
      this.posBuffer = posBuffer;
    }
    // External views (optional)
    setInputTextureView(view) {
      try {
        const usage = view?.texture?.usage ?? 0;
        if ((usage & GPUTextureUsage.TEXTURE_BINDING) === 0) {
          console.warn(
            "setInputTextureView: provided texture view not created with TEXTURE_BINDING; ignoring."
          );
          return;
        }
      } catch (e) {
      }
      this.inputTextureView = view;
      if (this._tid !== null) {
        const p = this._texPairs.get(this._tid);
        if (p) p.bindGroupDirty = true;
      }
    }
    setOutputTextureView(view) {
      try {
        const usage = view?.texture?.usage ?? 0;
        if ((usage & GPUTextureUsage.STORAGE_BINDING) === 0) {
          console.warn(
            "setOutputTextureView: provided texture view not created with STORAGE_BINDING; ignoring."
          );
          return;
        }
      } catch (e) {
      }
      this.outputTextureView = view;
      if (this._tid !== null) {
        const p = this._texPairs.get(this._tid);
        if (p) p.bindGroupDirty = true;
      }
    }
    // ----------------------------------------------------------------
    // buildPermTable(seed) - simple non-periodic table (classic), 512 entries
    // ----------------------------------------------------------------
    buildPermTable(seed = Date.now()) {
      const noise2 = new BaseNoise(seed);
      const perm8 = noise2.perm;
      const perm32 = new Uint32Array(512);
      for (let i = 0; i < 512; i++) perm32[i] = perm8[i];
      this.setPermTable(perm32);
    }
    setOptions(opts = {}) {
      if (Array.isArray(opts.noiseChoices)) {
        this.noiseChoices = opts.noiseChoices;
      } else if (!this.noiseChoices) {
        this.noiseChoices = [0];
      }
      const {
        getGradient = 0,
        outputChannel = 1,
        baseRadius = 0,
        heightScale = 1,
        useCustomPos = 0,
        ioFlags = 0,
        sphereOffset = 0,
        sphereOffset2 = 0
      } = opts;
      this.useCustomPos = useCustomPos >>> 0;
      const buf = new ArrayBuffer(32);
      const dv = new DataView(buf);
      dv.setUint32(0, getGradient, true);
      dv.setUint32(4, this.useCustomPos, true);
      dv.setUint32(8, outputChannel, true);
      dv.setUint32(12, ioFlags >>> 0, true);
      dv.setFloat32(16, baseRadius, true);
      dv.setFloat32(20, heightScale, true);
      dv.setFloat32(24, Number.isFinite(Number(sphereOffset)) ? Number(sphereOffset) : 0, true);
      dv.setFloat32(28, Number.isFinite(Number(sphereOffset2)) ? Number(sphereOffset2) : 0, true);
      this.queue.writeBuffer(this.optionsBuffer, 0, buf);
      for (const pair of this._texPairs.values()) pair.bindGroupDirty = true;
    }
    setNoiseParams(params = {}) {
      const p = params || {};
      const prev = this._lastNoiseParams || {};
      const has = Object.prototype.hasOwnProperty;
      const pickNum = (k, fallback) => {
        const v = has.call(p, k) ? p[k] : prev[k];
        const n = Number(v);
        if (Number.isFinite(n)) return n;
        const fb = Number(fallback);
        return Number.isFinite(fb) ? fb : 0;
      };
      const pickU32 = (k, fallback) => {
        const v = has.call(p, k) ? p[k] : prev[k];
        const n = Number(v);
        if (Number.isFinite(n)) return n >>> 0;
        const fb = Number(fallback);
        return Number.isFinite(fb) ? fb >>> 0 : 0;
      };
      const pickI32 = (k, fallback) => {
        const v = has.call(p, k) ? p[k] : prev[k];
        const n = Number(v);
        if (Number.isFinite(n)) return n | 0;
        const fb = Number(fallback);
        return Number.isFinite(fb) ? fb | 0 : 0;
      };
      const pickBoolU32 = (k, fallback) => {
        const v = has.call(p, k) ? p[k] : prev[k];
        if (v === void 0) return (fallback ? 1 : 0) >>> 0;
        return (v ? 1 : 0) >>> 0;
      };
      const seed = pickI32("seed", prev.seed ?? Date.now() | 0);
      const zoomRaw = pickNum("zoom", prev.zoom ?? 1);
      const freqRaw = pickNum("freq", prev.freq ?? 1);
      const _zoom = Math.max(zoomRaw || 0, 1e-6);
      const _freq = Math.max(freqRaw || 0, 1e-6);
      const octaves = pickU32("octaves", prev.octaves ?? 8);
      const turbulence = pickBoolU32("turbulence", prev.turbulence ?? 0);
      const lacunarity = pickNum("lacunarity", prev.lacunarity ?? 2);
      const gain = pickNum("gain", prev.gain ?? 0.5);
      const xShift = pickNum("xShift", prev.xShift ?? 0);
      const yShift = pickNum("yShift", prev.yShift ?? 0);
      const zShift = pickNum("zShift", prev.zShift ?? 0);
      const seedAngle = pickNum("seedAngle", prev.seedAngle ?? 0);
      const exp1 = pickNum("exp1", prev.exp1 ?? 1);
      const exp2 = pickNum("exp2", prev.exp2 ?? 0);
      const threshold = pickNum("threshold", prev.threshold ?? 0.1);
      const rippleFreq = pickNum("rippleFreq", prev.rippleFreq ?? 10);
      const time = pickNum("time", prev.time ?? 0);
      const warpAmp = pickNum("warpAmp", prev.warpAmp ?? 0.5);
      const gaborRadius = pickNum("gaborRadius", prev.gaborRadius ?? 4);
      const terraceStep = pickNum("terraceStep", prev.terraceStep ?? 8);
      const toroidal = pickBoolU32("toroidal", prev.toroidal ?? 0);
      const voroMode = pickU32("voroMode", prev.voroMode ?? 0);
      const edgeK = pickNum("edgeK", prev.edgeK ?? 0);
      const scalar = pickNum("scalar", prev.scalar ?? 1);
      const transform = pickNum("transform", prev.transform ?? 0);
      const buf = new ArrayBuffer(24 * 4);
      const dv = new DataView(buf);
      let base = 0;
      dv.setUint32(base + 0, seed >>> 0, true);
      dv.setFloat32(base + 4, _zoom, true);
      dv.setFloat32(base + 8, _freq, true);
      dv.setUint32(base + 12, octaves >>> 0, true);
      dv.setFloat32(base + 16, lacunarity, true);
      dv.setFloat32(base + 20, gain, true);
      dv.setFloat32(base + 24, xShift, true);
      dv.setFloat32(base + 28, yShift, true);
      dv.setFloat32(base + 32, zShift, true);
      dv.setUint32(base + 36, turbulence >>> 0, true);
      dv.setFloat32(base + 40, seedAngle, true);
      dv.setFloat32(base + 44, exp1, true);
      dv.setFloat32(base + 48, exp2, true);
      dv.setFloat32(base + 52, threshold, true);
      dv.setFloat32(base + 56, rippleFreq, true);
      dv.setFloat32(base + 60, time, true);
      dv.setFloat32(base + 64, warpAmp, true);
      dv.setFloat32(base + 68, gaborRadius, true);
      dv.setFloat32(base + 72, terraceStep, true);
      dv.setUint32(base + 76, toroidal >>> 0, true);
      dv.setUint32(base + 80, voroMode >>> 0, true);
      dv.setFloat32(base + 84, edgeK, true);
      dv.setFloat32(base + 88, scalar, true);
      dv.setFloat32(base + 92, transform, true);
      this.queue.writeBuffer(this.paramsBuffer, 0, buf);
      this._lastNoiseParams = {
        seed,
        zoom: _zoom,
        freq: _freq,
        octaves,
        lacunarity,
        gain,
        xShift,
        yShift,
        zShift,
        turbulence,
        seedAngle,
        exp1,
        exp2,
        threshold,
        rippleFreq,
        time,
        warpAmp,
        gaborRadius,
        terraceStep,
        toroidal,
        voroMode,
        edgeK,
        scalar,
        transform
      };
      for (const pair of this._texPairs.values()) pair.bindGroupDirty = true;
      for (const [key, vol] of this._volumeCache) {
        if (!vol || !Array.isArray(vol.chunks)) continue;
        vol._bindGroupsDirty = true;
      }
    }
    _numOr0(v) {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }
    _resolveScroll2D(options, outW, outH, worldFullW, worldFullH, cropMode) {
      const o = options || {};
      const outw = Math.max(1, outW | 0);
      const outh = Math.max(1, outH | 0);
      const fullw = Math.max(1, (worldFullW ?? outw) | 0);
      const fullh = Math.max(1, (worldFullH ?? outh) | 0);
      const w = cropMode ? fullw : outw;
      const h = cropMode ? fullh : outh;
      const offX = this._numOr0(o.offsetX) * w;
      const offY = this._numOr0(o.offsetY) * h;
      const baseXf = offX + this._numOr0(o.offsetXf) + this._numOr0(o.originXf) + this._numOr0(o.originX);
      const baseYf = offY + this._numOr0(o.offsetYf) + this._numOr0(o.originYf) + this._numOr0(o.originY);
      return { baseXf, baseYf };
    }
    _resolveScroll3D(options, outW, outH, outD) {
      const o = options || {};
      const w = Math.max(1, outW | 0);
      const h = Math.max(1, outH | 0);
      const d = Math.max(1, outD | 0);
      const offX = this._numOr0(o.offsetX) * w;
      const offY = this._numOr0(o.offsetY) * h;
      const offZ = this._numOr0(o.offsetZ) * d;
      const baseXf = offX + this._numOr0(o.offsetXf) + this._numOr0(o.originXf) + this._numOr0(o.originX);
      const baseYf = offY + this._numOr0(o.offsetYf) + this._numOr0(o.originYf) + this._numOr0(o.originY);
      const baseZf = offZ + this._numOr0(o.offsetZf) + this._numOr0(o.originZf) + this._numOr0(o.originZ);
      const baseZ = Math.floor(baseZf) | 0;
      return { baseXf, baseYf, baseZ };
    }
    _update2DTileFrames(tid, options = {}) {
      const pair = this._texPairs.get(tid);
      if (!pair || !Array.isArray(pair.tiles) || pair.tiles.length === 0) return;
      let worldFullW = Number.isFinite(options.frameFullWidth) ? options.frameFullWidth >>> 0 : pair.fullWidth;
      let worldFullH = Number.isFinite(options.frameFullHeight) ? options.frameFullHeight >>> 0 : pair.fullHeight;
      const cropMode = options.squareWorld || String(options.worldMode || "").toLowerCase() === "crop";
      if (options.squareWorld) {
        const m = Math.max(worldFullW, worldFullH, pair.fullWidth, pair.fullHeight) >>> 0;
        worldFullW = m;
        worldFullH = m;
      }
      const outW = pair.fullWidth >>> 0;
      const outH = pair.fullHeight >>> 0;
      const { baseXf, baseYf } = this._resolveScroll2D(
        options,
        outW,
        outH,
        worldFullW,
        worldFullH,
        cropMode
      );
      const scaleX = cropMode ? 1 : worldFullW / Math.max(1, outW);
      const scaleY = cropMode ? 1 : worldFullH / Math.max(1, outH);
      for (const tile of pair.tiles) {
        const fb = tile?.frames?.[0];
        if (!fb) continue;
        const ox = tile.originX | 0;
        const oy = tile.originY | 0;
        const worldX = (ox + baseXf) * scaleX;
        const worldY = (oy + baseYf) * scaleY;
        const originXf = worldFullW > 0 ? worldX / worldFullW : 0;
        const originYf = worldFullH > 0 ? worldY / worldFullH : 0;
        this._writeFrameUniform(fb, {
          fullWidth: worldFullW,
          fullHeight: worldFullH,
          tileWidth: pair.tileWidth,
          tileHeight: pair.tileHeight,
          originX: ox,
          originY: oy,
          originZ: 0,
          fullDepth: 1,
          tileDepth: 1,
          layerIndex: tile.layerIndex | 0,
          layers: pair.layers >>> 0,
          originXf,
          originYf
        });
      }
    }
    _update3DChunkFrames(vol, worldFull = null, options = {}) {
      if (!vol || !Array.isArray(vol.chunks) || vol.chunks.length === 0) return;
      const fw = worldFull && Number.isFinite(worldFull?.w) ? worldFull.w >>> 0 : vol.full.w;
      const fh = worldFull && Number.isFinite(worldFull?.h) ? worldFull.h >>> 0 : vol.full.h;
      const fd = worldFull && Number.isFinite(worldFull?.d) ? worldFull.d >>> 0 : vol.full.d;
      const outW = vol.full.w >>> 0;
      const outH = vol.full.h >>> 0;
      const outD = vol.full.d >>> 0;
      const { baseXf, baseYf, baseZ } = this._resolveScroll3D(
        options,
        outW,
        outH,
        outD
      );
      const scaleX = fw / Math.max(1, outW);
      const scaleY = fh / Math.max(1, outH);
      for (const c of vol.chunks) {
        if (!c.fb) {
          c.fb = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
          });
        }
        const worldX = ((c.ox | 0) + baseXf) * scaleX;
        const worldY = ((c.oy | 0) + baseYf) * scaleY;
        const originXf = fw > 0 ? worldX / fw : 0;
        const originYf = fh > 0 ? worldY / fh : 0;
        const originZ = (c.oz | 0) + baseZ | 0;
        this._writeFrameUniform(c.fb, {
          fullWidth: fw,
          fullHeight: fh,
          tileWidth: c.w,
          tileHeight: c.h,
          originX: c.ox | 0,
          originY: c.oy | 0,
          originZ,
          fullDepth: fd,
          tileDepth: c.d,
          layerIndex: 0,
          layers: 1,
          originXf,
          originYf
        });
      }
    }
    // ---------------------------
    // 2D-array tiling (pair)
    // ---------------------------
    _compute2DTiling(W, H) {
      const tileW = Math.min(W, MAX_2D_TILE);
      const tileH = Math.min(H, MAX_2D_TILE);
      const tilesX = Math.ceil(W / tileW);
      const tilesY = Math.ceil(H / tileH);
      const layers = tilesX * tilesY;
      return { tileW, tileH, tilesX, tilesY, layers };
    }
    _create2DPair(W, H, tid = null) {
      const t = this._compute2DTiling(W, H);
      const usage = GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST;
      const makeTex = (label) => this.device.createTexture({
        label,
        size: [t.tileW, t.tileH, t.layers],
        format: "rgba16float",
        usage
      });
      const desc = { dimension: "2d-array", arrayLayerCount: t.layers };
      const id = tid !== null && tid !== void 0 ? String(tid) : String(this._texPairs.size);
      const texA = makeTex(`2D texA ${W}x${H}x${t.layers} (${id})`);
      const texB = makeTex(`2D texB ${W}x${H}x${t.layers} (${id})`);
      const viewA = texA.createView(desc);
      const viewB = texB.createView(desc);
      viewA.label = `2D:viewA (${id})`;
      viewB.label = `2D:viewB (${id})`;
      this._tag.set(viewA, `2D:A (${id})`);
      this._tag.set(viewB, `2D:B (${id})`);
      this._texPairs.set(id, {
        texA,
        texB,
        viewA,
        viewB,
        fullWidth: W,
        fullHeight: H,
        tileWidth: t.tileW,
        tileHeight: t.tileH,
        tilesX: t.tilesX,
        tilesY: t.tilesY,
        layers: t.layers,
        isA: true,
        tiles: null,
        bindGroupDirty: true
      });
      if (this._tid === null) this.setActiveTexture(id);
      return id;
    }
    createShaderTextures(width, height) {
      if (this._tid !== null && this._texPairs.has(this._tid)) {
        this.destroyTexturePair(this._tid);
      }
      const tid = this._create2DPair(width, height);
      this.setActiveTexture(tid);
      return tid;
    }
    destroyTexturePair(tid) {
      const id = String(tid);
      const pair = this._texPairs.get(id);
      if (!pair) return;
      try {
        pair.texA.destroy();
      } catch {
      }
      try {
        pair.texB.destroy();
      } catch {
      }
      if (Array.isArray(pair.tiles)) {
        for (const tile of pair.tiles) {
          if (Array.isArray(tile.frames)) {
            for (const fb of tile.frames) {
              try {
                fb.destroy();
              } catch {
              }
            }
          }
          if (tile.posBuf && tile.posBuf !== this.nullPosBuffer) {
            try {
              tile.posBuf.destroy();
            } catch {
            }
          }
        }
      }
      this._texPairs.delete(id);
      if (this._tid === id) {
        this._tid = null;
        this.inputTextureView = null;
        this.outputTextureView = null;
        this.viewA = null;
        this.viewB = null;
      }
    }
    destroyAllTexturePairs() {
      const ids = Array.from(this._texPairs.keys());
      for (const id of ids) this.destroyTexturePair(id);
    }
    setActiveTexture(tid) {
      const id = String(tid);
      if (!this._texPairs.has(id))
        throw new Error("setActiveTexture: invalid id");
      this._tid = id;
      const pair = this._texPairs.get(id);
      this.viewA = pair.viewA;
      this.viewB = pair.viewB;
      this.width = pair.tileWidth;
      this.height = pair.tileHeight;
      this.layers = pair.layers;
      this.inputTextureView = pair.isA ? pair.viewA : pair.viewB;
      this.outputTextureView = pair.isA ? pair.viewB : pair.viewA;
    }
    _buildPosBuffer(width, height, customData) {
      if (!(customData instanceof Float32Array) || customData.byteLength <= 0) {
        return this.nullPosBuffer;
      }
      const w = Math.max(1, Math.floor(width));
      const h = Math.max(1, Math.floor(height));
      const numPixels = w * h;
      const expectedLen = numPixels * 4;
      if (customData.length !== expectedLen) {
        throw new Error(
          `_buildPosBuffer: customData length ${customData.length} != expected ${expectedLen} (width=${w}, height=${h})`
        );
      }
      const maxBufferSize = this.device?.limits?.maxBufferSize ?? 2147483648;
      const maxBindingSize = this.device?.limits?.maxStorageBufferBindingSize ?? 134217728;
      const safeMax = Math.floor(Math.min(maxBufferSize, maxBindingSize) * 0.98);
      if (customData.byteLength > safeMax) {
        throw new Error(
          `_buildPosBuffer: ${customData.byteLength} bytes exceeds the safe storage binding limit ${safeMax} (maxBufferSize=${maxBufferSize}, maxStorageBufferBindingSize=${maxBindingSize}, w=${w}, h=${h})`
        );
      }
      const buf = this.device.createBuffer({
        size: customData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      this._writeBufferChunked(
        buf,
        0,
        customData.buffer,
        customData.byteOffset,
        customData.byteLength,
        this.maxBufferChunkBytes
      );
      return buf;
    }
    // WGSL Frame struct = 64 bytes
    _writeFrameUniform(frameBuffer, f) {
      const ab = new ArrayBuffer(64);
      const dv = new DataView(ab);
      dv.setUint32(0, f.fullWidth >>> 0, true);
      dv.setUint32(4, f.fullHeight >>> 0, true);
      dv.setUint32(8, f.tileWidth >>> 0, true);
      dv.setUint32(12, f.tileHeight >>> 0, true);
      dv.setInt32(16, f.originX | 0, true);
      dv.setInt32(20, f.originY | 0, true);
      dv.setInt32(24, f.originZ | 0, true);
      dv.setUint32(28, f.fullDepth >>> 0, true);
      dv.setUint32(32, f.tileDepth >>> 0, true);
      dv.setInt32(36, f.layerIndex | 0, true);
      dv.setUint32(40, f.layers >>> 0, true);
      dv.setUint32(44, 0, true);
      dv.setFloat32(48, f.originXf ?? 0, true);
      dv.setFloat32(52, f.originYf ?? 0, true);
      dv.setFloat32(56, 0, true);
      dv.setFloat32(60, 0, true);
      this.queue.writeBuffer(frameBuffer, 0, ab);
    }
    // NOTE: options may include customData, frameFullWidth, frameFullHeight (world extents)
    //       options.squareWorld: if true, normalize both axes by max(fullW, fullH) and treat pixels as a crop of that space
    //       options.worldMode: "crop" | "stretch" (default stretch). "crop" maps pixel coords 1:1 into the larger world extents.
    _create2DTileBindGroups(tid, options = {}) {
      const pair = this._texPairs.get(tid);
      if (!pair) throw new Error("_create2DTileBindGroups: invalid tid");
      const requestedCustomPos = ((options.useCustomPos ?? 0) | 0) >>> 0;
      const wantsProceduralSpherePos = requestedCustomPos === 2 || requestedCustomPos === 3;
      const wantsCustomBufferPos = requestedCustomPos !== 0 && !wantsProceduralSpherePos;
      const customData = wantsCustomBufferPos && options.customData instanceof Float32Array ? options.customData : null;
      const hasCustomData = !!customData;
      const hadCustomBefore = Array.isArray(pair.tiles) && pair.tiles.some((t) => t && t.posIsCustom);
      const wantsReuseExistingCustomPos = wantsCustomBufferPos && !hasCustomData;
      if (!hasCustomData && hadCustomBefore && !wantsReuseExistingCustomPos) {
        pair.bindGroupDirty = true;
      }
      if (Array.isArray(pair.tiles) && !pair.bindGroupDirty && !hasCustomData) {
        return;
      }
      const tiles = [];
      for (let ty = 0; ty < pair.tilesY; ty++) {
        for (let tx = 0; tx < pair.tilesX; tx++) {
          const layerIndex = ty * pair.tilesX + tx;
          const originX = tx * pair.tileWidth;
          const originY = ty * pair.tileHeight;
          const existingTile = pair.tiles && pair.tiles[layerIndex] || null;
          let posBuf = this.nullPosBuffer;
          let posIsCustom = false;
          if (hasCustomData) {
            posBuf = this._buildPosBuffer(
              pair.tileWidth,
              pair.tileHeight,
              customData
            );
            posIsCustom = posBuf !== this.nullPosBuffer;
          } else if (wantsReuseExistingCustomPos && existingTile && existingTile.posBuf && existingTile.posIsCustom) {
            posBuf = existingTile.posBuf;
            posIsCustom = true;
          } else if (wantsReuseExistingCustomPos) {
            throw new Error(
              "_create2DTileBindGroups: useCustomPos=1 was requested without customData and no reusable custom position buffer exists."
            );
          } else if (!wantsProceduralSpherePos && existingTile && existingTile.posBuf && !existingTile.posIsCustom) {
            posBuf = existingTile.posBuf;
            posIsCustom = false;
          } else {
            posBuf = this.nullPosBuffer;
            posIsCustom = false;
            if (existingTile && existingTile.posBuf && existingTile.posIsCustom) {
              try {
                existingTile.posBuf.destroy();
              } catch {
              }
            }
          }
          let fb;
          if (existingTile && existingTile.frames && existingTile.frames[0]) {
            fb = existingTile.frames[0];
          } else {
            fb = this.device.createBuffer({
              size: 64,
              usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
          }
          let worldFullW = Number.isFinite(options.frameFullWidth) ? options.frameFullWidth >>> 0 : pair.fullWidth;
          let worldFullH = Number.isFinite(options.frameFullHeight) ? options.frameFullHeight >>> 0 : pair.fullHeight;
          const cropMode = options.squareWorld || String(options.worldMode || "").toLowerCase() === "crop";
          if (options.squareWorld) {
            const m = Math.max(
              worldFullW,
              worldFullH,
              pair.fullWidth,
              pair.fullHeight
            ) >>> 0;
            worldFullW = m;
            worldFullH = m;
          }
          let originXf, originYf;
          if (cropMode) {
            originXf = originX;
            originYf = originY;
          } else {
            const scaleX = worldFullW / pair.fullWidth;
            const scaleY = worldFullH / pair.fullHeight;
            originXf = originX * scaleX;
            originYf = originY * scaleY;
          }
          this._writeFrameUniform(fb, {
            fullWidth: worldFullW,
            fullHeight: worldFullH,
            tileWidth: pair.tileWidth,
            tileHeight: pair.tileHeight,
            originX,
            originY,
            originZ: 0,
            fullDepth: 1,
            tileDepth: 1,
            layerIndex,
            layers: pair.layers,
            originXf,
            originYf
          });
          let bgA = existingTile?.bgs?.[0]?.bgA ?? null;
          let bgB = existingTile?.bgs?.[0]?.bgB ?? null;
          if (!bgA || !bgB || pair.bindGroupDirty) {
            bgA = this.device.createBindGroup({
              layout: this.bindGroupLayout,
              entries: [
                { binding: 0, resource: { buffer: this.optionsBuffer } },
                { binding: 1, resource: { buffer: this.paramsBuffer } },
                { binding: 2, resource: { buffer: this.permBuffer } },
                { binding: 3, resource: pair.viewA },
                { binding: 4, resource: pair.viewB },
                { binding: 5, resource: { buffer: posBuf } },
                { binding: 6, resource: { buffer: fb } },
                { binding: 7, resource: this._dummy3D_sampleView },
                { binding: 8, resource: this._dummy3D_writeView }
              ]
            });
            bgB = this.device.createBindGroup({
              layout: this.bindGroupLayout,
              entries: [
                { binding: 0, resource: { buffer: this.optionsBuffer } },
                { binding: 1, resource: { buffer: this.paramsBuffer } },
                { binding: 2, resource: { buffer: this.permBuffer } },
                { binding: 3, resource: pair.viewB },
                { binding: 4, resource: pair.viewA },
                { binding: 5, resource: { buffer: posBuf } },
                { binding: 6, resource: { buffer: fb } },
                { binding: 7, resource: this._dummy3D_sampleView },
                { binding: 8, resource: this._dummy3D_writeView }
              ]
            });
          }
          tiles.push({
            layerIndex,
            originX,
            originY,
            frames: [fb],
            posBuf,
            posIsCustom,
            bgs: [{ bgA, bgB }]
          });
        }
      }
      pair.tiles = tiles;
      pair.bindGroupDirty = false;
      if (this._tid === tid) this._tiles = tiles;
    }
    // ---------------------------
    // core compute runner
    // ---------------------------
    /**
     * Old implementation awaited per-dispatch completion via onSubmittedWorkDone which
     * forced GPU syncs and heavy CPU overhead. New behavior:
     *  - Batch all compute dispatches for the provided noiseChoices into a single
     *    compute pass and submit once. This preserves ping-pong semantics because
     *    dispatches execute in order inside the same submission.
     *
     * Returns the "alternate" bind-group object which represents where the final
     * results live (for caller to update ping-pong state).
     */
    async _runPipelines(bgA, bgB, tileW, tileH, tileD, paramsArray, dispatchZ = 1) {
      let current = bgA;
      let alternate = bgB;
      const isArr = Array.isArray(paramsArray);
      let i = 0;
      const enc = this.device.createCommandEncoder();
      const pass = enc.beginComputePass();
      for (const choice of this.noiseChoices) {
        const entry = typeof choice === "number" ? this.entryPoints[choice] : choice;
        let pipe = this.pipelines.get(entry);
        if (!pipe) {
          pipe = this.device.createComputePipeline({
            layout: this.pipelineLayout,
            compute: { module: this.shaderModule, entryPoint: entry }
          });
          this.pipelines.set(entry, pipe);
        }
        if (isArr) this.setNoiseParams(paramsArray[i++]);
        pass.setPipeline(pipe);
        pass.setBindGroup(0, current);
        pass.dispatchWorkgroups(
          Math.ceil(tileW / 8),
          Math.ceil(tileH / 8),
          dispatchZ
        );
        [current, alternate] = [alternate, current];
      }
      pass.end();
      this.queue.submit([enc.finish()]);
      return alternate;
    }
    // ---------------------------
    // 2D compute
    //  options: customData, frameFullWidth, frameFullHeight
    // ---------------------------
    async computeToTexture(width, height, paramsObj = {}, options = {}) {
      const W = width | 0;
      const H = height | 0;
      if (!(W > 0 && H > 0)) {
        throw new Error(`computeToTexture: invalid size ${width}x${height}`);
      }
      const key = this._get2DKey(options);
      const existing = this._texPairs.get(key);
      if (!existing) {
        this._create2DPair(W, H, key);
      } else if (existing.fullWidth !== W || existing.fullHeight !== H) {
        this.destroyTexturePair(key);
        this._create2DPair(W, H, key);
      }
      this.setActiveTexture(key);
      const pair = this._texPairs.get(key);
      if (!pair) throw new Error("computeToTexture: missing pair after ensure");
      if (paramsObj && !Array.isArray(paramsObj)) this.setNoiseParams(paramsObj);
      const origOpts = options || {};
      const requestedCustomPos = ((origOpts.useCustomPos ?? 0) | 0) >>> 0;
      const wantsProceduralSpherePos = requestedCustomPos === 2 || requestedCustomPos === 3;
      const wantsCustomBufferPos = requestedCustomPos !== 0 && !wantsProceduralSpherePos;
      const customData = wantsCustomBufferPos && origOpts.customData instanceof Float32Array ? origOpts.customData : null;
      const useCustomPos = customData ? 1 : wantsProceduralSpherePos ? requestedCustomPos : wantsCustomBufferPos ? 1 : 0;
      this.setOptions({
        ...origOpts,
        ioFlags: 0,
        useCustomPos
      });
      const tileOpts = {
        ...origOpts,
        useCustomPos,
        customData
      };
      if (!pair.tiles || pair.bindGroupDirty || !!customData) {
        this._create2DTileBindGroups(key, tileOpts);
      }
      this._update2DTileFrames(key, tileOpts);
      const isAStart = pair.isA;
      let finalUsed = null;
      let lastBGs = null;
      for (const tile of pair.tiles) {
        const { bgA, bgB } = tile.bgs[0];
        const start = !finalUsed ? isAStart ? bgA : bgB : finalUsed === bgA ? bgA : bgB;
        const alt = start === bgA ? bgB : bgA;
        finalUsed = await this._runPipelines(
          start,
          alt,
          pair.tileWidth,
          pair.tileHeight,
          1,
          paramsObj,
          1
        );
        lastBGs = { bgA, bgB };
      }
      const resultsInA = finalUsed === lastBGs.bgB;
      pair.isA = resultsInA;
      this.setActiveTexture(key);
      return this.getCurrentView(key);
    }
    _get2DKey(options) {
      const k = options && options.textureKey !== void 0 && options.textureKey !== null ? String(options.textureKey) : "";
      return k && k.length ? k : this._default2DKey;
    }
    get2DView(key) {
      const id = String(key);
      const p = this._texPairs.get(id);
      if (!p) return null;
      return p.isA ? p.viewA : p.viewB;
    }
    getCurrentView(tid = null) {
      const id = tid !== null && tid !== void 0 ? String(tid) : this._tid;
      const p = this._texPairs.get(id);
      if (!p) return null;
      return p.isA ? p.viewA : p.viewB;
    }
    getCurrentTextureResource(tid = null) {
      const id = tid !== null && tid !== void 0 ? String(tid) : this._tid;
      const p = this._texPairs.get(id);
      if (!p) return null;
      return {
        texture: p.isA ? p.texA : p.texB,
        view: p.isA ? p.viewA : p.viewB,
        width: p.fullWidth,
        height: p.fullHeight,
        layers: p.layers,
        format: "rgba16float"
      };
    }
    // ---------------------------
    // 3D compute (chunking for large volumes)
    // ---------------------------
    _compute3DTiling(W, H, D) {
      const tw = Math.min(W, MAX_3D_TILE);
      const th = Math.min(H, MAX_3D_TILE);
      const maxBuf = this.device?.limits?.maxBufferSize ?? 256 * 1024 * 1024;
      const sliceBytes = tw * th * BYTES_PER_VOXEL;
      const tdByBuf = Math.max(
        1,
        Math.floor(maxBuf * 0.8 / Math.max(1, sliceBytes))
      );
      const td = Math.min(D, MAX_3D_TILE, tdByBuf);
      const nx = Math.ceil(W / tw);
      const ny = Math.ceil(H / th);
      const nz = Math.ceil(D / td);
      return { tw, th, td, nx, ny, nz };
    }
    _create3DChunks(W, H, D) {
      const t = this._compute3DTiling(W, H, D);
      const chunks = [];
      const usage3D = GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST;
      for (let kz = 0; kz < t.nz; kz++) {
        for (let ky = 0; ky < t.ny; ky++) {
          for (let kx = 0; kx < t.nx; kx++) {
            const ox = kx * t.tw;
            const oy = ky * t.th;
            const oz = kz * t.td;
            const texA = this.device.createTexture({
              size: { width: t.tw, height: t.th, depthOrArrayLayers: t.td },
              dimension: "3d",
              format: "rgba16float",
              usage: usage3D
            });
            const texB = this.device.createTexture({
              size: { width: t.tw, height: t.th, depthOrArrayLayers: t.td },
              dimension: "3d",
              format: "rgba16float",
              usage: usage3D
            });
            const viewA = texA.createView({ dimension: "3d" });
            const viewB = texB.createView({ dimension: "3d" });
            texA.label = `3D texA ${t.tw}x${t.th}x${t.td} @ (${kx},${ky},${kz})`;
            texB.label = `3D texB ${t.tw}x${t.th}x${t.td} @ (${kx},${ky},${kz})`;
            viewA.label = `3D:viewA[${kx},${ky},${kz}]`;
            viewB.label = `3D:viewB[${kx},${ky},${kz}]`;
            this._tag.set(viewA, `3D:A[${kx},${ky},${kz}]`);
            this._tag.set(viewB, `3D:B[${kx},${ky},${kz}]`);
            chunks.push({
              texA,
              texB,
              viewA,
              viewB,
              ox,
              oy,
              oz,
              w: t.tw,
              h: t.th,
              d: t.td,
              isA: true,
              fb: null,
              posBuf: null,
              bgA: null,
              bgB: null
            });
          }
        }
      }
      return {
        chunks,
        tile: { w: t.tw, h: t.th, d: t.td },
        full: { w: W, h: H, d: D },
        grid: { nx: t.nx, ny: t.ny, nz: t.nz }
      };
    }
    _destroy3DSet(vol) {
      if (!vol) return;
      for (const c of vol.chunks) {
        try {
          c.texA.destroy();
        } catch {
        }
        try {
          c.texB.destroy();
        } catch {
        }
        c.viewA = null;
        c.viewB = null;
        c.bgA = null;
        c.bgB = null;
        if (c.fb) {
          try {
            c.fb.destroy();
          } catch {
          }
          c.fb = null;
        }
        if (c.posBuf && c.posBuf !== this.nullPosBuffer) {
          try {
            c.posBuf.destroy();
          } catch {
          }
          c.posBuf = null;
        }
      }
    }
    destroyAllVolumes() {
      for (const [k, v] of this._volumeCache) {
        this._destroy3DSet(v);
        this._volumeCache.delete(k);
      }
    }
    get3DView(id) {
      const vol = this._volumeCache.get(String(id));
      if (!vol) return null;
      const views = vol.chunks.map((c) => c.isA ? c.viewA : c.viewB);
      return views.length === 1 ? views[0] : { views, meta: { full: vol.full, tile: vol.tile, grid: vol.grid } };
    }
    destroyVolume(id) {
      const key = String(id);
      const vol = this._volumeCache.get(key);
      if (!vol) return;
      this._destroy3DSet(vol);
      this._volumeCache.delete(key);
    }
    _getOrCreate3DVolume(W, H, D, id = null, worldFull = null) {
      const key = id ? String(id) : `${W}x${H}x${D}`;
      let vol = this._volumeCache.get(key);
      if (vol) return vol;
      vol = this._create3DChunks(W, H, D);
      for (const c of vol.chunks) {
        c.fb = this.device.createBuffer({
          size: 64,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        const fw = worldFull && Number.isFinite(worldFull?.w) ? worldFull.w >>> 0 : vol.full.w;
        const fh = worldFull && Number.isFinite(worldFull?.h) ? worldFull.h >>> 0 : vol.full.h;
        const fd = worldFull && Number.isFinite(worldFull?.d) ? worldFull.d >>> 0 : vol.full.d;
        const scaleX = fw / vol.full.w;
        const scaleY = fh / vol.full.h;
        const originXf = c.ox * scaleX;
        const originYf = c.oy * scaleY;
        this._writeFrameUniform(c.fb, {
          fullWidth: fw,
          fullHeight: fh,
          tileWidth: c.w,
          tileHeight: c.h,
          originX: c.ox,
          originY: c.oy,
          originZ: c.oz,
          fullDepth: fd,
          tileDepth: c.d,
          layerIndex: 0,
          layers: 1,
          originXf,
          originYf
        });
        const posBuf = this._buildPosBuffer(c.w, c.h, null);
        c.posBuf = posBuf;
        try {
          c.bgA = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
              { binding: 0, resource: { buffer: this.optionsBuffer } },
              { binding: 1, resource: { buffer: this.paramsBuffer } },
              { binding: 2, resource: { buffer: this.permBuffer } },
              // 2D path unused -> use dummy sample/write views
              { binding: 3, resource: this._dummy2D_sampleView },
              { binding: 4, resource: this._dummy2D_writeView },
              { binding: 5, resource: { buffer: posBuf } },
              { binding: 6, resource: { buffer: c.fb } },
              // 3D in/out
              { binding: 7, resource: c.viewA },
              { binding: 8, resource: c.viewB }
            ]
          });
          c.bgB = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
              { binding: 0, resource: { buffer: this.optionsBuffer } },
              { binding: 1, resource: { buffer: this.paramsBuffer } },
              { binding: 2, resource: { buffer: this.permBuffer } },
              { binding: 3, resource: this._dummy2D_sampleView },
              { binding: 4, resource: this._dummy2D_writeView },
              { binding: 5, resource: { buffer: c.posBuf } },
              { binding: 6, resource: { buffer: c.fb } },
              { binding: 7, resource: c.viewB },
              { binding: 8, resource: c.viewA }
            ]
          });
        } catch (e) {
          throw new Error(
            `_getOrCreate3DVolume: createBindGroup failed: ${e?.message || e}`
          );
        }
      }
      vol._bindGroupsDirty = false;
      this._volumeCache.set(key, vol);
      return vol;
    }
    // add this helper to the class (place near other helpers)
    _recreate3DBindGroups(vol, worldFull = null) {
      if (!vol || !Array.isArray(vol.chunks)) return;
      const fw = worldFull && Number.isFinite(worldFull.w) ? worldFull.w >>> 0 : vol.full.w;
      const fh = worldFull && Number.isFinite(worldFull.h) ? worldFull.h >>> 0 : vol.full.h;
      const fd = worldFull && Number.isFinite(worldFull.d) ? worldFull.d >>> 0 : vol.full.d;
      for (const c of vol.chunks) {
        if (!c.fb) {
          c.fb = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
          });
          const scaleX = fw / vol.full.w;
          const scaleY = fh / vol.full.h;
          const originXf = c.ox * scaleX;
          const originYf = c.oy * scaleY;
          this._writeFrameUniform(c.fb, {
            fullWidth: fw,
            fullHeight: fh,
            tileWidth: c.w,
            tileHeight: c.h,
            originX: c.ox,
            originY: c.oy,
            originZ: c.oz,
            fullDepth: fd,
            tileDepth: c.d,
            layerIndex: 0,
            layers: 1,
            originXf,
            originYf
          });
        }
        if (!c.posBuf) {
          c.posBuf = this._buildPosBuffer(c.w, c.h, null);
        }
        const entriesA = [
          { binding: 0, resource: { buffer: this.optionsBuffer } },
          { binding: 1, resource: { buffer: this.paramsBuffer } },
          { binding: 2, resource: { buffer: this.permBuffer } },
          // 2D path unused -> use dummy 2D views
          { binding: 3, resource: this._dummy2D_sampleView },
          { binding: 4, resource: this._dummy2D_writeView },
          { binding: 5, resource: { buffer: c.posBuf } },
          { binding: 6, resource: { buffer: c.fb } },
          // 3D in/out
          { binding: 7, resource: c.viewA },
          { binding: 8, resource: c.viewB }
        ];
        const entriesB = [
          { binding: 0, resource: { buffer: this.optionsBuffer } },
          { binding: 1, resource: { buffer: this.paramsBuffer } },
          { binding: 2, resource: { buffer: this.permBuffer } },
          { binding: 3, resource: this._dummy2D_sampleView },
          { binding: 4, resource: this._dummy2D_writeView },
          { binding: 5, resource: { buffer: c.posBuf } },
          { binding: 6, resource: { buffer: c.fb } },
          { binding: 7, resource: c.viewB },
          { binding: 8, resource: c.viewA }
        ];
        try {
          c.bgA = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: entriesA
          });
          c.bgB = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: entriesB
          });
        } catch (e) {
          throw new Error(
            `_recreate3DBindGroups: failed to create bind groups: ${e?.message || e}`
          );
        }
      }
      vol._bindGroupsDirty = false;
    }
    // replace your computeToTexture3D with this implementation
    async computeToTexture3D(width, height, depth, paramsObj = {}, options = {}) {
      const W = width | 0, H = height | 0, D = depth | 0;
      if (!(W > 0 && H > 0 && D > 0))
        throw new Error(
          `computeToTexture3D: invalid size ${width}x${height}x${depth}`
        );
      if (paramsObj && !Array.isArray(paramsObj)) this.setNoiseParams(paramsObj);
      const origOpts = options || {};
      this.setOptions({
        ...origOpts,
        ioFlags: 3,
        useCustomPos: origOpts.useCustomPos ?? this.useCustomPos
      });
      const worldFull = (() => {
        if (options && (Number.isFinite(options.frameFullWidth) || Number.isFinite(options.frameFullHeight) || Number.isFinite(options.frameFullDepth))) {
          return {
            w: Number.isFinite(options.frameFullWidth) ? options.frameFullWidth >>> 0 : W,
            h: Number.isFinite(options.frameFullHeight) ? options.frameFullHeight >>> 0 : H,
            d: Number.isFinite(options.frameFullDepth) ? options.frameFullDepth >>> 0 : D
          };
        }
        return null;
      })();
      const vol = this._getOrCreate3DVolume(W, H, D, options.id, worldFull);
      if (!vol)
        throw new Error(
          "computeToTexture3D: failed to create or retrieve volume"
        );
      if (vol._bindGroupsDirty || !vol.chunks[0].bgA || !vol.chunks[0].bgB) {
        this._recreate3DBindGroups(vol, worldFull);
      }
      this._update3DChunkFrames(vol, worldFull, options);
      let lastBG = null;
      for (const c of vol.chunks) {
        const start = c.isA ? c.bgA : c.bgB;
        const alt = c.isA ? c.bgB : c.bgA;
        if (!start || !alt) {
          throw new Error(
            "computeToTexture3D: missing bind groups (volume not initialized correctly)"
          );
        }
        lastBG = await this._runPipelines(
          start,
          alt,
          c.w,
          c.h,
          c.d,
          paramsObj,
          c.d
        );
        c.isA = lastBG === c.bgB;
      }
      const views = vol.chunks.map((c) => c.isA ? c.viewA : c.viewB);
      return views.length === 1 ? views[0] : { views, meta: { full: vol.full, tile: vol.tile, grid: vol.grid } };
    }
    configureCanvas(canvas) {
      const format = navigator.gpu.getPreferredCanvasFormat && navigator.gpu.getPreferredCanvasFormat() || "bgra8unorm";
      const ctx = canvas.getContext("webgpu");
      ctx.configure({
        device: this.device,
        format,
        alphaMode: "opaque",
        size: [canvas.width, canvas.height]
      });
      this._ctxMap.set(canvas, { ctx, size: [canvas.width, canvas.height] });
    }
    // ------- blit (2D-array preview + 3D-slice preview) -------
    initBlitRender() {
      if (!this.sampler) {
        this.sampler = this.device.createSampler({
          magFilter: "linear",
          minFilter: "linear",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge"
        });
      }
      if (!this.bgl2D) {
        this.bgl2D = this.device.createBindGroupLayout({
          entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
            {
              binding: 1,
              visibility: GPUShaderStage.FRAGMENT,
              texture: { sampleType: "float", viewDimension: "2d-array" }
            },
            {
              binding: 2,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: { type: "uniform" }
            }
          ]
        });
        this.pipeline2D = this.device.createRenderPipeline({
          layout: this.device.createPipelineLayout({
            bindGroupLayouts: [this.bgl2D]
          }),
          vertex: {
            module: this.device.createShaderModule({ code: noiseBlit_default }),
            entryPoint: "vs_main"
          },
          fragment: {
            module: this.device.createShaderModule({ code: noiseBlit_default }),
            entryPoint: "fs_main",
            targets: [{ format: "bgra8unorm" }]
          },
          primitive: { topology: "triangle-list" }
        });
        this.blit2DUbo = this.device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
      }
      if (!this.bgl3D) {
        this.bgl3D = this.device.createBindGroupLayout({
          entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
            {
              binding: 1,
              visibility: GPUShaderStage.FRAGMENT,
              texture: { sampleType: "float", viewDimension: "3d" }
            },
            {
              binding: 2,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: { type: "uniform" }
            }
          ]
        });
        this.pipeline3D = this.device.createRenderPipeline({
          layout: this.device.createPipelineLayout({
            bindGroupLayouts: [this.bgl3D]
          }),
          vertex: {
            module: this.device.createShaderModule({ code: noiseBlit3D_default }),
            entryPoint: "vs_main"
          },
          fragment: {
            module: this.device.createShaderModule({ code: noiseBlit3D_default }),
            entryPoint: "fs_main",
            targets: [{ format: "bgra8unorm" }]
          },
          primitive: { topology: "triangle-list" }
        });
        this.blit3DUbo = this.device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
      }
    }
    _renderCommonCanvasSetup(canvas, clear) {
      const format = "bgra8unorm";
      let entry = this._ctxMap.get(canvas);
      if (!entry) {
        const ctx = canvas.getContext("webgpu");
        const size = [canvas.width | 0, canvas.height | 0];
        ctx.configure({ device: this.device, format, alphaMode: "opaque", size });
        entry = { ctx, size };
        this._ctxMap.set(canvas, entry);
      } else {
        const curW = canvas.width | 0, curH = canvas.height | 0;
        if (entry.size[0] !== curW || entry.size[1] !== curH) {
          entry.size = [curW, curH];
          entry.ctx.configure({
            device: this.device,
            format,
            alphaMode: "opaque",
            size: entry.size
          });
        }
      }
      const enc = this.device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [
          {
            view: entry.ctx.getCurrentTexture().createView(),
            loadOp: clear ? "clear" : "load",
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            storeOp: "store"
          }
        ]
      });
      return { enc, pass, ctxEntry: entry };
    }
    // 2D-array: pick layer and channel
    renderTextureToCanvas(textureView, canvas, opts = {}) {
      const {
        layer = 0,
        channel = 0,
        preserveCanvasSize = true,
        clear = true
      } = opts;
      this.initBlitRender();
      if (!preserveCanvasSize) {
        try {
          const tex = textureView.texture;
          if (tex && typeof tex.width === "number" && typeof tex.height === "number") {
            canvas.width = tex.width;
            canvas.height = tex.height;
          }
        } catch {
        }
      }
      const u = new Uint32Array([layer >>> 0, channel >>> 0, 0, 0]);
      this.queue.writeBuffer(
        this.blit2DUbo,
        0,
        u.buffer,
        u.byteOffset,
        u.byteLength
      );
      const bg = this.device.createBindGroup({
        layout: this.bgl2D,
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: textureView },
          { binding: 2, resource: { buffer: this.blit2DUbo } }
        ]
      });
      const { enc, pass } = this._renderCommonCanvasSetup(canvas, clear);
      pass.setPipeline(this.pipeline2D);
      pass.setBindGroup(0, bg);
      pass.draw(6, 1, 0, 0);
      pass.end();
      this.queue.submit([enc.finish()]);
    }
    // 3D: pick slice via index or normalized z
    renderTexture3DSliceToCanvas(target, canvas, opts = {}) {
      const {
        depth,
        slice = 0,
        zNorm = null,
        channel = 0,
        chunk = 0,
        preserveCanvasSize = true,
        clear = true
      } = opts;
      this.initBlitRender();
      let view3D, d;
      if (target && target.views && Array.isArray(target.views)) {
        view3D = target.views[Math.max(0, Math.min(chunk | 0, target.views.length - 1))];
        d = target.meta?.tile?.d ?? depth;
      } else {
        view3D = target;
        d = depth;
      }
      if (!view3D || !d)
        throw new Error(
          "renderTexture3DSliceToCanvas: need a 3D view and its depth"
        );
      if (!preserveCanvasSize) {
        try {
          const tex = view3D.texture;
          if (tex && typeof tex.width === "number" && typeof tex.height === "number") {
            canvas.width = tex.width;
            canvas.height = tex.height;
          }
        } catch {
        }
      }
      let z = zNorm !== null && zNorm !== void 0 ? zNorm : (Math.min(Math.max(slice, 0), d - 1) + 0.5) / d;
      z = Math.min(Math.max(z, 0), 1);
      const ab = new ArrayBuffer(16);
      const dv = new DataView(ab);
      dv.setFloat32(0, z, true);
      dv.setUint32(4, channel >>> 0, true);
      dv.setUint32(8, 0, true);
      dv.setUint32(12, 0, true);
      this.queue.writeBuffer(this.blit3DUbo, 0, ab);
      const bg = this.device.createBindGroup({
        layout: this.bgl3D,
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: view3D },
          { binding: 2, resource: { buffer: this.blit3DUbo } }
        ]
      });
      const { enc, pass } = this._renderCommonCanvasSetup(canvas, clear);
      pass.setPipeline(this.pipeline3D);
      pass.setBindGroup(0, bg);
      pass.draw(6, 1, 0, 0);
      pass.end();
      this.queue.submit([enc.finish()]);
    }
    setExportBackground(background = "black") {
      this.exportBackground = background;
    }
    _resolveExportBackground(background) {
      const bg = background === void 0 ? this.exportBackground : background;
      if (bg == null) return { r: 0, g: 0, b: 0, a: 1, transparent: false };
      if (typeof bg === "string") {
        const s = bg.trim().toLowerCase();
        if (s === "transparent")
          return { r: 0, g: 0, b: 0, a: 0, transparent: true };
        if (s === "black") return { r: 0, g: 0, b: 0, a: 1, transparent: false };
        if (s === "white") return { r: 1, g: 1, b: 1, a: 1, transparent: false };
        if (s[0] === "#") return this._parseHexBackground(s);
      }
      const norm01 = (v) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return 0;
        const x = n > 1 ? n / 255 : n;
        return Math.min(Math.max(x, 0), 1);
      };
      if (Array.isArray(bg)) {
        const r = norm01(bg[0]);
        const g = norm01(bg[1]);
        const b = norm01(bg[2]);
        const a = bg.length >= 4 ? norm01(bg[3]) : 1;
        return { r, g, b, a, transparent: a <= 0 };
      }
      if (typeof bg === "object") {
        const r = norm01(bg.r);
        const g = norm01(bg.g);
        const b = norm01(bg.b);
        const a = bg.a === void 0 ? 1 : norm01(bg.a);
        return { r, g, b, a, transparent: a <= 0 };
      }
      return { r: 0, g: 0, b: 0, a: 1, transparent: false };
    }
    _parseHexBackground(hex) {
      const h = String(hex).trim().replace(/^#/, "");
      const expand = (c) => c + c;
      let r = 0, g = 0, b = 0, a = 255;
      if (h.length === 3 || h.length === 4) {
        r = parseInt(expand(h[0]), 16);
        g = parseInt(expand(h[1]), 16);
        b = parseInt(expand(h[2]), 16);
        if (h.length === 4) a = parseInt(expand(h[3]), 16);
      } else if (h.length === 6 || h.length === 8) {
        r = parseInt(h.slice(0, 2), 16);
        g = parseInt(h.slice(2, 4), 16);
        b = parseInt(h.slice(4, 6), 16);
        if (h.length === 8) a = parseInt(h.slice(6, 8), 16);
      } else {
        return { r: 0, g: 0, b: 0, a: 1, transparent: false };
      }
      const rf = r / 255;
      const gf = g / 255;
      const bf = b / 255;
      const af = a / 255;
      return { r: rf, g: gf, b: bf, a: af, transparent: af <= 0 };
    }
    _applyExportBackground(pixelsRGBA, bg) {
      if (!pixelsRGBA || !bg || bg.transparent) return;
      const br = Math.round(bg.r * 255);
      const bgc = Math.round(bg.g * 255);
      const bb = Math.round(bg.b * 255);
      const ba = Math.round((bg.a ?? 1) * 255);
      if (ba <= 0) return;
      const n = pixelsRGBA.length | 0;
      if (ba >= 255) {
        for (let i = 0; i < n; i += 4) {
          const a = pixelsRGBA[i + 3] | 0;
          if (a === 255) continue;
          if (a === 0) {
            pixelsRGBA[i + 0] = br;
            pixelsRGBA[i + 1] = bgc;
            pixelsRGBA[i + 2] = bb;
            pixelsRGBA[i + 3] = 255;
            continue;
          }
          const ia = 255 - a;
          pixelsRGBA[i + 0] = (pixelsRGBA[i + 0] * a + br * ia) / 255 | 0;
          pixelsRGBA[i + 1] = (pixelsRGBA[i + 1] * a + bgc * ia) / 255 | 0;
          pixelsRGBA[i + 2] = (pixelsRGBA[i + 2] * a + bb * ia) / 255 | 0;
          pixelsRGBA[i + 3] = 255;
        }
        return;
      }
      for (let i = 0; i < n; i += 4) {
        const fr = pixelsRGBA[i + 0] | 0;
        const fg = pixelsRGBA[i + 1] | 0;
        const fb = pixelsRGBA[i + 2] | 0;
        const fa = pixelsRGBA[i + 3] | 0;
        const outA = fa + ba * (255 - fa) / 255 | 0;
        if (outA <= 0) {
          pixelsRGBA[i + 0] = 0;
          pixelsRGBA[i + 1] = 0;
          pixelsRGBA[i + 2] = 0;
          pixelsRGBA[i + 3] = 0;
          continue;
        }
        const brp = br * ba | 0;
        const bgp = bgc * ba | 0;
        const bbp = bb * ba | 0;
        const frp = fr * fa | 0;
        const fgp = fg * fa | 0;
        const fbp = fb * fa | 0;
        const bgScale = 255 - fa | 0;
        const outRp = frp + brp * bgScale / 255 | 0;
        const outGp = fgp + bgp * bgScale / 255 | 0;
        const outBp = fbp + bbp * bgScale / 255 | 0;
        pixelsRGBA[i + 0] = Math.min(
          255,
          Math.max(0, outRp * 255 / outA | 0)
        );
        pixelsRGBA[i + 1] = Math.min(
          255,
          Math.max(0, outGp * 255 / outA | 0)
        );
        pixelsRGBA[i + 2] = Math.min(
          255,
          Math.max(0, outBp * 255 / outA | 0)
        );
        pixelsRGBA[i + 3] = Math.min(255, Math.max(0, outA));
      }
    }
    _forceOpaqueAlpha(pixelsRGBA) {
      const n = pixelsRGBA.length | 0;
      for (let i = 3; i < n; i += 4) pixelsRGBA[i] = 255;
    }
    async export2DTextureToPNGBlob(textureView, width, height, opts = {}) {
      if (!textureView) {
        throw new Error("export2DTextureToPNGBlob: textureView is required");
      }
      const W = Math.max(1, width | 0);
      const H = Math.max(1, height | 0);
      const layer = opts.layer ?? 0;
      const channel = opts.channel ?? 0;
      const bgSpec = this._resolveExportBackground(opts.background);
      this.initBlitRender();
      if (this.queue && this.queue.onSubmittedWorkDone) {
        try {
          await this.queue.onSubmittedWorkDone();
        } catch (e) {
        }
      }
      const format = "bgra8unorm";
      const captureTexture = this.device.createTexture({
        size: [W, H, 1],
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });
      const u = new Uint32Array([layer >>> 0, channel >>> 0, 0, 0]);
      this.queue.writeBuffer(
        this.blit2DUbo,
        0,
        u.buffer,
        u.byteOffset,
        u.byteLength
      );
      const bg = this.device.createBindGroup({
        layout: this.bgl2D,
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: textureView },
          { binding: 2, resource: { buffer: this.blit2DUbo } }
        ]
      });
      const encoder = this.device.createCommandEncoder();
      const rpass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: captureTexture.createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 0 }
          }
        ]
      });
      rpass.setPipeline(this.pipeline2D);
      rpass.setBindGroup(0, bg);
      rpass.draw(6, 1, 0, 0);
      rpass.end();
      this.queue.submit([encoder.finish()]);
      if (this.queue && this.queue.onSubmittedWorkDone) {
        try {
          await this.queue.onSubmittedWorkDone();
        } catch (e) {
        }
      }
      const pixels = await this._readBGRA8TextureToRGBA8Pixels(
        captureTexture,
        W,
        H,
        {
          maxBufferChunkBytes: opts.maxBufferChunkBytes ?? this.maxBufferChunkBytes
        }
      );
      captureTexture.destroy();
      const useAlphaForBackground = opts.useAlphaForBackground === true;
      if (bgSpec.transparent || useAlphaForBackground) {
        this._applyExportBackground(pixels, bgSpec);
      } else {
        this._forceOpaqueAlpha(pixels);
      }
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = W;
      tmpCanvas.height = H;
      const ctx2d = tmpCanvas.getContext("2d");
      if (!ctx2d) {
        throw new Error("export2DTextureToPNGBlob: unable to get 2D context");
      }
      ctx2d.putImageData(new ImageData(pixels, W, H), 0, 0);
      const blob = await new Promise((resolve, reject) => {
        tmpCanvas.toBlob((b) => {
          if (b) resolve(b);
          else
            reject(new Error("export2DTextureToPNGBlob: toBlob returned null"));
        }, "image/png");
      });
      return blob;
    }
    async exportCurrent2DToPNGBlob(width, height, opts = {}) {
      const view = this.getCurrentView();
      if (!view) {
        throw new Error("exportCurrent2DToPNGBlob: no active 2D texture view");
      }
      return this.export2DTextureToPNGBlob(view, width, height, opts);
    }
    async export3DSliceToPNGBlob(target, width, height, opts = {}) {
      if (!target) {
        throw new Error("export3DSliceToPNGBlob: target is required");
      }
      const W = Math.max(1, width | 0);
      const H = Math.max(1, height | 0);
      const { depth, slice = 0, zNorm = null, channel = 0, chunk = 0 } = opts;
      if (!depth || depth <= 0) {
        throw new Error("export3DSliceToPNGBlob: depth must be provided and > 0");
      }
      const bgSpec = this._resolveExportBackground(opts.background);
      this.initBlitRender();
      if (this.queue && this.queue.onSubmittedWorkDone) {
        try {
          await this.queue.onSubmittedWorkDone();
        } catch (e) {
        }
      }
      let view3D;
      let d;
      if (target && target.views && Array.isArray(target.views)) {
        const idx = Math.max(0, Math.min(chunk | 0, target.views.length - 1));
        view3D = target.views[idx];
        d = target.meta?.tile?.d ?? depth;
      } else {
        view3D = target;
        d = depth;
      }
      if (!view3D || !d) {
        throw new Error("export3DSliceToPNGBlob: need a 3D view and its depth");
      }
      let z = zNorm !== null && zNorm !== void 0 ? zNorm : (Math.min(Math.max(slice, 0), d - 1) + 0.5) / d;
      z = Math.min(Math.max(z, 0), 1);
      const format = "bgra8unorm";
      const captureTexture = this.device.createTexture({
        size: [W, H, 1],
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });
      const ab = new ArrayBuffer(16);
      const dv = new DataView(ab);
      dv.setFloat32(0, z, true);
      dv.setUint32(4, channel >>> 0, true);
      dv.setUint32(8, 0, true);
      dv.setUint32(12, 0, true);
      this.queue.writeBuffer(this.blit3DUbo, 0, ab);
      const bg = this.device.createBindGroup({
        layout: this.bgl3D,
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: view3D },
          { binding: 2, resource: { buffer: this.blit3DUbo } }
        ]
      });
      const encoder = this.device.createCommandEncoder();
      const rpass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: captureTexture.createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 0 }
          }
        ]
      });
      rpass.setPipeline(this.pipeline3D);
      rpass.setBindGroup(0, bg);
      rpass.draw(6, 1, 0, 0);
      rpass.end();
      const bytesPerPixel = 4;
      const align = 256;
      const bytesPerRowUnaligned = W * bytesPerPixel;
      const bytesPerRow = Math.ceil(bytesPerRowUnaligned / align) * align;
      const bufferSize = bytesPerRow * H;
      const readBuffer = this.device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      encoder.copyTextureToBuffer(
        { texture: captureTexture },
        { buffer: readBuffer, bytesPerRow, rowsPerImage: H },
        { width: W, height: H, depthOrArrayLayers: 1 }
      );
      this.queue.submit([encoder.finish()]);
      if (this.queue && this.queue.onSubmittedWorkDone) {
        await this.queue.onSubmittedWorkDone();
      }
      await readBuffer.mapAsync(GPUMapMode.READ);
      const mapped = readBuffer.getMappedRange();
      const src = new Uint8Array(mapped);
      const pixels = new Uint8ClampedArray(W * H * bytesPerPixel);
      let dst = 0;
      for (let y = 0; y < H; y++) {
        const rowStart = y * bytesPerRow;
        for (let x = 0; x < W; x++) {
          const si = rowStart + x * 4;
          pixels[dst++] = src[si + 2];
          pixels[dst++] = src[si + 1];
          pixels[dst++] = src[si + 0];
          pixels[dst++] = src[si + 3];
        }
      }
      readBuffer.unmap();
      readBuffer.destroy();
      captureTexture.destroy();
      this._applyExportBackground(pixels, bgSpec);
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = W;
      tmpCanvas.height = H;
      const ctx2d = tmpCanvas.getContext("2d");
      if (!ctx2d) {
        throw new Error("export3DSliceToPNGBlob: unable to get 2D context");
      }
      ctx2d.putImageData(new ImageData(pixels, W, H), 0, 0);
      const blob = await new Promise((resolve, reject) => {
        tmpCanvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("export3DSliceToPNGBlob: toBlob returned null"));
        }, "image/png");
      });
      return blob;
    }
    async _render3DSliceToRGBA8Pixels(view3D, width, height, zNorm, channel = 0, bgSpec = null) {
      if (!view3D)
        throw new Error("_render3DSliceToRGBA8Pixels: view3D is required");
      const W = Math.max(1, width | 0);
      const H = Math.max(1, height | 0);
      this.initBlitRender();
      const z = Math.min(Math.max(Number(zNorm) || 0, 0), 1);
      const format = "bgra8unorm";
      const captureTexture = this.device.createTexture({
        size: [W, H, 1],
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });
      const ab = new ArrayBuffer(16);
      const dv = new DataView(ab);
      dv.setFloat32(0, z, true);
      dv.setUint32(4, channel >>> 0, true);
      dv.setUint32(8, 0, true);
      dv.setUint32(12, 0, true);
      this.queue.writeBuffer(this.blit3DUbo, 0, ab);
      const bg = this.device.createBindGroup({
        layout: this.bgl3D,
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: view3D },
          { binding: 2, resource: { buffer: this.blit3DUbo } }
        ]
      });
      const encoder = this.device.createCommandEncoder();
      const rpass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: captureTexture.createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 0 }
          }
        ]
      });
      rpass.setPipeline(this.pipeline3D);
      rpass.setBindGroup(0, bg);
      rpass.draw(6, 1, 0, 0);
      rpass.end();
      const bytesPerPixel = 4;
      const align = 256;
      const bytesPerRowUnaligned = W * bytesPerPixel;
      const bytesPerRow = Math.ceil(bytesPerRowUnaligned / align) * align;
      const bufferSize = bytesPerRow * H;
      const readBuffer = this.device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      encoder.copyTextureToBuffer(
        { texture: captureTexture },
        { buffer: readBuffer, bytesPerRow, rowsPerImage: H },
        { width: W, height: H, depthOrArrayLayers: 1 }
      );
      this.queue.submit([encoder.finish()]);
      if (this.queue && this.queue.onSubmittedWorkDone) {
        await this.queue.onSubmittedWorkDone();
      }
      await readBuffer.mapAsync(GPUMapMode.READ);
      const mapped = readBuffer.getMappedRange();
      const src = new Uint8Array(mapped);
      const pixels = new Uint8ClampedArray(W * H * bytesPerPixel);
      let dst = 0;
      for (let y = 0; y < H; y++) {
        const rowStart = y * bytesPerRow;
        for (let x = 0; x < W; x++) {
          const si = rowStart + x * 4;
          pixels[dst++] = src[si + 2];
          pixels[dst++] = src[si + 1];
          pixels[dst++] = src[si + 0];
          pixels[dst++] = src[si + 3];
        }
      }
      readBuffer.unmap();
      readBuffer.destroy();
      captureTexture.destroy();
      if (bgSpec) this._applyExportBackground(pixels, bgSpec);
      return pixels;
    }
    async export3DTilesetToPNGBlob(target, tileWidth, tileHeight, opts = {}) {
      if (!target)
        throw new Error("export3DTilesetToPNGBlob: target is required");
      const TW = Math.max(1, tileWidth | 0);
      const TH = Math.max(1, (tileHeight ?? tileWidth) | 0);
      const {
        depth,
        channel = 0,
        chunk = 0,
        tilesAcross = 16,
        tilesDown = null,
        startSlice = 0,
        sliceCount = null
      } = opts;
      const bgSpec = this._resolveExportBackground(opts.background);
      this.initBlitRender();
      if (this.queue && this.queue.onSubmittedWorkDone) {
        try {
          await this.queue.onSubmittedWorkDone();
        } catch (e) {
        }
      }
      let view3D;
      let d;
      if (target && target.views && Array.isArray(target.views)) {
        const idx = Math.max(0, Math.min(chunk | 0, target.views.length - 1));
        view3D = target.views[idx];
        d = target.meta?.tile?.d ?? depth;
      } else {
        view3D = target;
        d = depth;
      }
      if (!view3D) throw new Error("export3DTilesetToPNGBlob: missing 3D view");
      if (!d || d <= 0)
        throw new Error(
          "export3DTilesetToPNGBlob: depth must be provided and > 0"
        );
      const across = Math.max(1, tilesAcross | 0);
      const down = tilesDown !== null && tilesDown !== void 0 ? Math.max(1, tilesDown | 0) : Math.ceil(d / across);
      const start = Math.min(Math.max(startSlice | 0, 0), d - 1);
      const count = sliceCount !== null && sliceCount !== void 0 ? Math.max(0, sliceCount | 0) : d - start;
      const outW = TW * across;
      const outH = TH * down;
      const outPixels = new Uint8ClampedArray(outW * outH * 4);
      const maxZ = Math.min(d, start + count);
      for (let z = start; z < maxZ; z++) {
        const rel = z - start;
        const col = rel % across;
        const row = rel / across | 0;
        if (row >= down) break;
        const zNorm = (z + 0.5) / d;
        const tilePixels = await this._render3DSliceToRGBA8Pixels(
          view3D,
          TW,
          TH,
          zNorm,
          channel,
          bgSpec
        );
        const dstBaseX = col * TW;
        const dstBaseY = row * TH;
        for (let y = 0; y < TH; y++) {
          const srcRowStart = y * TW * 4;
          const dstRowStart = ((dstBaseY + y) * outW + dstBaseX) * 4;
          outPixels.set(
            tilePixels.subarray(srcRowStart, srcRowStart + TW * 4),
            dstRowStart
          );
        }
      }
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = outW;
      tmpCanvas.height = outH;
      const ctx2d = tmpCanvas.getContext("2d");
      if (!ctx2d)
        throw new Error("export3DTilesetToPNGBlob: unable to get 2D context");
      ctx2d.putImageData(new ImageData(outPixels, outW, outH), 0, 0);
      const blob = await new Promise((resolve, reject) => {
        tmpCanvas.toBlob((b) => {
          if (b) resolve(b);
          else
            reject(new Error("export3DTilesetToPNGBlob: toBlob returned null"));
        }, "image/png");
      });
      return blob;
    }
  };
  var BaseNoise = class {
    constructor(seed = Date.now()) {
      if (seed < 1e7) seed *= 1e7;
      this.seedN = seed;
      this.seedK = seed;
      this.perm = new Uint8Array(512);
      this.seed(seed);
    }
    seed(seed) {
      const random = this.xorshift(seed);
      for (let i = 0; i < 256; i++) {
        this.perm[i] = i;
      }
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [this.perm[i], this.perm[j]] = [this.perm[j], this.perm[i]];
      }
      for (let i = 0; i < 256; i++) {
        this.perm[i + 256] = this.perm[i];
      }
    }
    setSeed(seed) {
      this.seedN = seed;
      this.seed(seed);
      this.resetSeed();
    }
    random(x, y, z) {
      let idx;
      if (typeof z === "number") {
        idx = this.perm[(x & 255) + this.perm[(y & 255) + this.perm[z & 255]]] & 255;
      } else {
        idx = this.perm[(x & 255) + this.perm[y & 255]] & 255;
      }
      return this.perm[idx] / 255 * 2 - 1;
    }
    seededRandom() {
      this.seedK += Math.E;
      const x = 1e9 * Math.sin(this.seedK);
      return x - Math.floor(x);
    }
    resetSeed() {
      this.seedK = this.seedN;
    }
    xorshift(seed) {
      let x = seed;
      return function() {
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        return (x < 0 ? 1 + ~x : x) / 4294967295;
      };
    }
    dot(g, x = 0, y = 0, z = 0) {
      return g[0] * x + g[1] * y + g[2] * z;
    }
  };

  // tools/clouds/shaders/clouds.wgsl
  var clouds_default = "// ---------------------- Main compute\n\nfn initCloudWorkgroup(local_id: vec3<u32>) {\n  // workgroup cache\n  if (all(local_id == vec3<u32>(0u))) {\n    let wd = textureDimensions(weather2D, 0);\n    wg_weatherDim = vec2<f32>(f32(wd.x), f32(wd.y));\n    let weatherEp = vec2<f32>(0.5 / max(wg_weatherDim.x, 1.0), 0.5 / max(wg_weatherDim.y, 1.0));\n    wg_weatherUvMul = vec2<f32>(1.0, 1.0) - 2.0 * weatherEp;\n    wg_weatherUvAdd = weatherEp;\n\n    let bd = textureDimensions(blueTex, 0);\n    wg_blueDim = vec2<f32>(f32(bd.x), f32(bd.y));\n\n    let sd = textureDimensions(shape3D);\n    wg_shapeDim = vec3<f32>(f32(sd.x), f32(sd.y), f32(sd.z));\n    let shapeEp = vec3<f32>(\n      0.5 / max(wg_shapeDim.x, 1.0),\n      0.5 / max(wg_shapeDim.y, 1.0),\n      0.5 / max(wg_shapeDim.z, 1.0)\n    );\n    wg_shapeUvMul = vec3<f32>(1.0, 1.0, 1.0) - 2.0 * shapeEp;\n    wg_shapeUvAdd = shapeEp;\n\n    let dd = textureDimensions(detail3D);\n    wg_detailDim = vec3<f32>(f32(dd.x), f32(dd.y), f32(dd.z));\n    let detailEp = vec3<f32>(\n      0.5 / max(wg_detailDim.x, 1.0),\n      0.5 / max(wg_detailDim.y, 1.0),\n      0.5 / max(wg_detailDim.z, 1.0)\n    );\n    wg_detailUvMul = vec3<f32>(1.0, 1.0, 1.0) - 2.0 * detailEp;\n    wg_detailUvAdd = detailEp;\n\n    wg_maxMipW = f32(textureNumLevels(weather2D)) - 1.0;\n    wg_maxMipS = f32(textureNumLevels(shape3D)) - 1.0;\n    wg_maxMipD = f32(textureNumLevels(detail3D)) - 1.0;\n\n    let scaleS_local = max(V.worldToUV * B.uvScale, EPS);\n    wg_scaleS = scaleS_local;\n    wg_scaleD = max(scaleS_local * (128.0 / 32.0), EPS);\n\n    let sAxis = axisOrOne3(NTransform.shapeAxisScale);\n    let dAxis = axisOrOne3(NTransform.detailAxisScale);\n\n    let sMul = select(NTransform.shapeScale, 1.0, NTransform.shapeScale == 0.0);\n    let dMul = select(NTransform.detailScale, 1.0, NTransform.detailScale == 0.0);\n\n    wg_scaleS_effMax = wg_scaleS * max(sMul, EPS) * axisMaxAbs3(sAxis);\n    wg_scaleD_effMax = wg_scaleD * max(dMul, EPS) * axisMaxAbs3(dAxis);\n\n    wg_finestWorld = min(1.0 / wg_scaleS_effMax, 1.0 / wg_scaleD_effMax) * 0.6;\n\n    // Keep jitter/warp amplitude and the homogeneous vertical profile at the\n    // original local-cloud scale even when the horizon box tiles outward.\n    let rawBoxMaxXZ = max(max(B.half.x, B.half.z), 1.0);\n    wg_boxMaxXZ = min(rawBoxMaxXZ, 1.0);\n    wg_tallBlend = saturate(remap(B.half.y, 0.34, 1.60, 0.0, 1.0));\n    wg_thickPerfStrength = saturate(remap(B.half.y, 0.36, 2.40, 0.0, 1.0)) * clamp(TUNE.thickBoxPerf, 0.0, 2.0);\n\n    wg_verticalHomogeneity = saturate(TUNE.verticalTextureHomogeneity);\n    let baseHalfY = max(B.half.y, EPS);\n    let refHalfY = clamp(wg_boxMaxXZ, 0.35, 1.25);\n    wg_verticalRefHalfY = mix_f(baseHalfY, min(baseHalfY, refHalfY), wg_verticalHomogeneity);\n    wg_verticalRefBoxH = max(wg_verticalRefHalfY * 2.0, EPS);\n    let yTileTarget = rawBoxMaxXZ / max(wg_verticalRefBoxH * 2.75, 0.25);\n    wg_verticalDomainScale = mix_f(1.0, clamp(yTileTarget, 1.0, 9.0), wg_verticalHomogeneity);\n    wg_weatherAxisYAbs = max(abs(axisOrOne3(NTransform.weatherAxisScale).y), EPS);\n    wg_boxMinCached = B.center - B.half;\n    wg_boxMaxCached = B.center + B.half;\n    if (CLOUD_USE_FIELDS == 0u) { wg_boxMaxCached.y += anvilLiftWorld(); }\n  }\n  workgroupBarrier();\n}\n\n\nfn storeRoundedSample(pix: vec2<i32>, color: vec4<f32>, farHistory: f32) {\n  if (color.a <= 0.000001 && CLOUD_WRITE_RGB != 0u) {\n    textureStore(outTex, pix, frame.layerIndex, vec4<f32>(0.0));\n    store_history_full_res_if_owner(pix, frame.layerIndex, vec4<f32>(0.0));\n    if (CLOUD_STAGED_RESOLVE != 0u) {\n      let index = (u32(frame.layerIndex) * frame.fullHeight + u32(pix.y)) * frame.fullWidth + u32(pix.x);\n      cloudResolveSamples[index].valid = 0u;\n    }\n    return;\n  }\n  if (CLOUD_STAGED_RESOLVE != 0u) {\n    let index = (u32(frame.layerIndex) * frame.fullHeight + u32(pix.y)) * frame.fullWidth + u32(pix.x);\n    cloudResolveSamples[index].color = color;\n    cloudResolveSamples[index].farHistory = farHistory;\n    cloudResolveSamples[index].valid = 1u;\n  } else {\n    let historyActive = reproj.enabled == 1u || temporalCellRateNormalized() > 1u || reproj.temporalBlend > 0.0001;\n    resolveCloudColor(pix, color, farHistory, historyActive);\n  }\n}\n\n// Rounded forms read shared fields; no nested noise or secondary sun marches.\n// Stable world-space density and fixed pixel jitter also work with sparse TAA.\nfn cloudRayJitter(pix:vec2<u32>) -> f32 {\n  // Integer avalanche avoids the diagonal correlation of scalar sin/fract\n  // hashes and structured noise maps. Stable per pixel, with no frame flicker\n  // or extra texture fetch. This only applies to the cached-volume ray path.\n  var h=(pix.x*0x9e3779b9u) ^ (pix.y*0x85ebca6bu) ^ 0x68bc21ebu;\n  h=(h ^ (h >> 16u))*0x7feb352du;\n  h=(h ^ (h >> 15u))*0x846ca68bu;\n  h=h ^ (h >> 16u);\n  return f32(h >> 8u)*(1.0/16777216.0);\n}\n@compute @workgroup_size(8, 8, 1)\nfn computeCloudBox(@builtin(global_invocation_id) gid: vec3<u32>) {\n  var pix = vec2<i32>(gid.xy) + vec2<i32>(frame.originX, frame.originY);\n  if (reproj.compactInterleave != 0u && temporalCellRateNormalized() > 1u && reproj.frameIndex > 0u) {\n    let mapped = compactTemporalPixel(gid.xy, temporalCellRateNormalized());\n    if (mapped.z == 0u) { return; }\n    pix = vec2<i32>(mapped.xy);\n  }\n  if (any(pix < vec2<i32>(0)) || any(pix >= vec2<i32>(i32(frame.fullWidth), i32(frame.fullHeight)))) { return; }\n  var ro = V.camPos;\n  if (CLOUD_USE_CUSTOM_POS != 0u) { ro = posBuf[u32(pix.y) * frame.fullWidth + u32(pix.x)].xyz; }\n  let uv = (vec2<f32>(pix) + 0.5) / vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));\n  let ndc = uv * 2.0 - 1.0;\n  let tanY = tan(V.fovY * 0.5);\n  let rd = normalize(V.fwd + V.right * (ndc.x * V.aspect * tanY) - V.up * (ndc.y * tanY));\n  let hit = intersectAABB_robust(ro, rd, FIELD.gridMin.xyz, FIELD.gridMin.xyz + FIELD.gridSize.xyz);\n  let begin = max(hit.x, 0.0);\n  if (hit.y <= begin) { storeRoundedSample(pix, vec4<f32>(0.0), 0.0); return; }\n  let spacing = FIELD.gridSize.xyz / vec3<f32>(FIELD.dimensions.xyz);\n  let voxelStep = 1.0 / max(max(abs(rd.x) / spacing.x, abs(rd.y) / spacing.y), abs(rd.z) / spacing.z);\n  let budget = max(TUNE.maxSteps, 1);\n  // Cover the entire segment without thin-sheet thickBox/vertical step boosts.\n  let step = max(max(voxelStep * 0.65, TUNE.minStep), (hit.y - begin) / f32(budget));\n  let jitter = cloudRayJitter(vec2<u32>(pix));\n  var t = begin + step * jitter * clamp(TUNE.phaseJitter, 0.0, 1.0);\n  var transmittance = 1.0;\n  var radiance = vec3<f32>(0.0);\n  let sun = normalizeOr(L.sunDir, vec3<f32>(0.0, 1.0, 0.0));\n  let phase = saturate(dot(rd, sun) * 0.5 + 0.5);\n  for (var i = 0; i < budget; i++) {\n    if (t >= hit.y || transmittance < 0.008) { break; }\n    let p = ro + rd * t;\n    let fieldUV = cloudFieldUV(p);\n    let density = textureSampleLevel(cloudDensityField, cloudFieldSampler, fieldUV, 0.0);\n    let distance = min(step, hit.y - t);\n    let alpha = 1.0 - exp(-max(density.r, 0.0) * distance * VIEW_EXTINCTION_SCALE);\n    if (alpha > 0.00001) {\n      let lighting = textureSampleLevel(cloudLightField, cloudFieldSampler, fieldUV, 0.0);\n      let diffuse = clamp(lighting.r, 0.0, 1.0);\n      let visibility = clamp(lighting.b, 0.0, 1.0);\n      let ao = mix_f(1.0, lighting.a, saturate(TUNE.aoStrength));\n      let upper = clamp(lighting.g, 0.0, 1.0);\n      let direct = visibility * (0.20 + 0.80 * diffuse);\n      let asperitasFill = select(FIELD.morphology.z, 1.0, TUNE.formType >= 6.5);\n      let ambient = (0.10 + 0.19 * upper + asperitasFill * 0.22) * ao;\n      // Low-order multiple-scattering fill reuses the cached sun visibility.\n      // It reveals billows on the shaded face without another density probe or\n      // a secondary raymarch, including grades with very dark shadow tints.\n      let bounce = (0.035 + asperitasFill * 0.045 + 0.18 * sqrt(sqrt(visibility))) * (0.25 + 0.75 * upper) * ao;\n      let scatter = visibility * (0.10 + 0.30 * pow(phase, 4.0));\n      let silver = pow(phase, 8.0) * visibility * pow(1.0 - diffuse, 2.0) * max(C.silverIntensity, 0.0) * 0.18;\n      let sunColor = max(C.frontLightColor, vec3<f32>(0.0));\n      let skyColor = max(C.shadowLightColor, vec3<f32>(0.0));\n      let color = sunColor * (direct + scatter + bounce) + skyColor * ambient + max(C.sunColor, vec3<f32>(0.0)) * silver;\n      radiance += transmittance * alpha * color;\n      transmittance *= 1.0 - alpha;\n    }\n    t += step;\n  }\n  let rawAlpha = clamp(1.0 - transmittance, 0.0, 1.0);\n  // The hybrid has genuinely tenuous edges. Fade them before history instead\n  // of retaining a pale outline of the scaffold, or using a hard alpha cutoff\n  // which would make developing clouds pop. Keep radiance premultiplied.\n  let edgeFade = smoothstep(0.0, max(TUNE.minOutputAlpha, 0.00001), rawAlpha);\n  let a = rawAlpha * edgeFade;\n  var result = vec4<f32>(radiance * edgeFade, a);\n  if (CLOUD_WRITE_RGB == 0u) {\n    if (opt.outputChannel == 0u) { result = vec4<f32>(a,0.0,0.0,1.0); }\n    else if (opt.outputChannel == 1u) { result = vec4<f32>(0.0,a,0.0,1.0); }\n    else if (opt.outputChannel == 2u) { result = vec4<f32>(0.0,0.0,a,1.0); }\n    else { result = vec4<f32>(0.0,0.0,0.0,a); }\n  }\n  let farHistory = saturate((hit.y - TUNE.farStart) / max(TUNE.farFull - TUNE.farStart, EPS));\n  storeRoundedSample(pix, result, farHistory);\n}\n";

  // tools/clouds/shaders/cloudCommon.wgsl
  var cloudCommon_default = `const PI: f32 = 3.141592653589793;
const EPS: f32 = 1e-6;
const LN2: f32 = 0.6931471805599453;
const INV_LN2: f32 = 1.4426950408889634;
const VIEW_EXTINCTION_SCALE: f32 = 0.075;
const SUN_EXTINCTION_SCALE: f32 = 0.014;
const DENSITY_LIGHT_SCALE: f32 = 0.01;

// Box and spherical rendering remain compile-time specializations. Planetary
// clouds and aurora share the spherical pipeline; V.volumeLayers selects the
// aurora path uniformly at runtime so the planet does not compile this shader twice.
override CLOUD_IS_SPHERICAL: u32 = 0u;
override CLOUD_USE_CUSTOM_POS: u32 = 0u;
override CLOUD_WRITE_RGB: u32 = 1u;
// Detailed density normals/exposure are unreachable when the uploaded sunStride
// is > 1 (adaptiveStrideAdd is non-negative). Keep them out of the regular
// pipeline's call graph; select the detailed variant if that setting changes.
override CLOUD_DETAILED_LIGHTING: u32 = 1u;
override CLOUD_STAGED_RESOLVE: u32 = 0u;
override CLOUD_USE_FIELDS: u32 = 0u;

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
  definition: f32,
  formType: f32,
  puffScale: f32,
  aoStrength: f32,
  towerHeightVariation: f32,
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

@group(1) @binding(13) var motionTex: texture_2d<f32>;

@group(1) @binding(15) var depthPrev: texture_2d<f32>;

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

// Longitude noise with matching value AND slope at U=0/1. Fractional
// frequencies are represented by a fixed number of cells, not a cut tile.
fn shellHash(uv: vec2<f32>, cells: f32) -> f32 {
  let period = max(round(cells), 1.0);
  let q = vec2<f32>(fract(uv.x) * period, uv.y * period);
  let i = floor(q); let f = fract(q); let s = f * f * (3.0 - 2.0 * f);
  let x0 = i32(i.x); let x1 = i32((i.x + 1.0) % period);
  let y0 = i32(i.y);
  return mix_f(mix_f(hash13_i(vec3<i32>(x0,y0,0)), hash13_i(vec3<i32>(x1,y0,0)),s.x),
    mix_f(hash13_i(vec3<i32>(x0,y0+1,0)),hash13_i(vec3<i32>(x1,y0+1,0)),s.x),s.y);
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
  // Blend adjacent whole longitude windings. Arbitrary scale controls remain
  // continuous, but every endpoint still meets at the same longitude.
  let turns = max(abs(axisOrOne3(NTransform.weatherAxisScale).x) * max(abs(NTransform.weatherScale), EPS), 1.0);
  let low = floor(turns); let blend = fract(turns);
  let offset = select(NTransform.weatherOffsetWorld.x, 0.0, auroraLayerMode());
  let u = fract((uv.x - 0.5) * low + 0.5 + offset);
  let v = clamp(uv.y, epY, 1.0 - epY);
  let a = textureSampleLevel(tex, samp, vec2<f32>(u, v), layer_idx, lod);
  if (blend < 0.00001) { return a; }
  let next = fract((uv.x - 0.5) * (low + 1.0) + 0.5 + offset);
  return mix_v4(a, textureSampleLevel(tex, samp, vec2<f32>(next,v),layer_idx,lod),blend);
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
  let mapped = select(uvw * wg_shapeUvMul + wg_shapeUvAdd, uvw, sphericalCloudMode());
  let v = textureSampleLevel(tex, samp, mapped, lod);
  return clamp(v + vec4<f32>(NTransform.shapeBias), vec4<f32>(0.0), vec4<f32>(1.0));
}

fn wrap3D_detail(tex: texture_3d<f32>, samp: sampler, uvw: vec3<f32>, lod: f32) -> vec4<f32> {
  let mapped = select(uvw * wg_detailUvMul + wg_detailUvAdd, uvw, sphericalCloudMode());
  let v = textureSampleLevel(tex, samp, mapped, lod);
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
  return CLOUD_IS_SPHERICAL != 0u;
}


fn auroraLayerMode() -> bool {
  return sphericalCloudMode() && V.volumeLayers > 1.5;
}

fn cloudModeF32(boxVal: f32, sphereVal: f32, auroraVal: f32) -> f32 {
  return select(select(boxVal, sphereVal, CLOUD_IS_SPHERICAL != 0u), auroraVal, auroraLayerMode());
}

fn auroraModeF32(baseVal: f32, auroraVal: f32) -> f32 {
  return select(baseVal, auroraVal, auroraLayerMode());
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
  let longitudeAngle = offset.x * 6.283185307179586;
  let meridionalAngle = offset.z * 6.283185307179586;
  let xz = rotateXZ(rel.xz, longitudeAngle);
  let yz = rotateXZ(vec2<f32>(rel.y, xz.y), meridionalAngle);
  return B.center + vec3<f32>(xz.x, yz.x + offset.y, yz.y);
}

fn auroraAnimatedWorld(posWorld: vec3<f32>) -> vec3<f32> {
  if (!auroraLayerMode()) {
    return posWorld;
  }
  let shellMotion = vec3<f32>(
    NTransform.weatherOffsetWorld.x,
    0.0,
    NTransform.weatherOffsetWorld.z
  );
  return sphericalDriftedWorld(posWorld, shellMotion);
}

fn auroraAnimatedUVFromWorld(posWorld: vec3<f32>) -> vec2<f32> {
  return auroraUVFromWorld(auroraAnimatedWorld(posWorld));
}

fn sphericalSampleDriftedWorld(posWorld: vec3<f32>, localOffset: vec3<f32>) -> vec3<f32> {
  if (auroraLayerMode()) {
    return sphericalDriftedWorld(auroraAnimatedWorld(posWorld), localOffset);
  }
  return sphericalDriftedWorld(posWorld, localOffset);
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
    return auroraAnimatedUVFromWorld(posWorld);
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
  if (sphericalCloudMode()) {
    // Cartesian projection is continuous across longitude and both poles.
    // One broad warp replaces the flat domain's six nested hash probes.
    let q = (pos_xz - B.center.xz) / max(sphereRadiusBase(), 1.0);
    let a = smoothCellHash2D(q + vec2<f32>(12.34,78.9), 5.0) - 0.5;
    let b = smoothCellHash2D(q + vec2<f32>(98.7,6.54), 5.0) - 0.5;
    return vec2<f32>(a,b) * TUNE.baseJitterFrac * shellHeight() * 0.35;
  }
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
  if (sphericalCloudMode()) { return worldWarpXZ(pos_xz,ph,boxMaxXZ); }
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
  let movedPos = sphericalSampleDriftedWorld(pos, NTransform.shapeOffsetWorld);
  if (sphericalCloudMode()) {
    let relative = movedPos - B.center;
    let axis = axisOrOne3(NTransform.shapeAxisScale);
    let scale = select(NTransform.shapeScale,1.0,NTransform.shapeScale == 0.0);
    return (relative + vec3<f32>(w.x,0.0,w.y)) * axis * scaleS * max(scale,EPS);
  }
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
  let movedPos = sphericalSampleDriftedWorld(pos, NTransform.detailOffsetWorld);
  if (sphericalCloudMode()) {
    let relative = movedPos - B.center;
    let axis = axisOrOne3(NTransform.detailAxisScale);
    let scale = select(NTransform.detailScale,1.0,NTransform.detailScale == 0.0);
    // Radial material coordinates retain 3D folds when flying through the
    // shell; no equirect seam, flat-Y phase resampling or camera-relative reset.
    return (relative + vec3<f32>(w.x,0.0,w.y)) * axis * scaleD * max(scale,EPS);
  }
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
  let uv = auroraAnimatedUVFromWorld(pos);
  let phs = saturate(ph);
  let drift = vec2<f32>(
    offsetWorld.x * 0.055 + offsetWorld.z * 0.021,
    offsetWorld.z * 0.037 + offsetWorld.x * 0.013
  );
  let broadBend = (shellHash(uv * vec2<f32>(1.0,3.20) + drift + vec2<f32>(7.1,2.3), 6.0) - 0.5) * 0.075;
  let fineLean = (shellHash(uv * vec2<f32>(1.0,1.35) + drift.yx + vec2<f32>(1.9,9.4),32.0) - 0.5) * 0.025;
  let u = uv.x + drift.x + broadBend + phs * 0.018;
  let radial = uv.y + drift.y * 0.14 + fineLean + phs * 0.035;

  // Compress the height coordinate so the 3D texture becomes tall aurora sheets
  // instead of horizontal cloud slabs.
  let heightWobble = (shellHash(uv * vec2<f32>(1.0,3.4) + drift + vec2<f32>(4.6,5.8),9.0) - 0.5) * 0.032;
  let h = phs * 0.16 + heightWobble;
  let scale = max(scaleBase, 1.0);
  let axis = axisOrOne3(NTransform.shapeAxisScale);
  return vec3<f32>(
    u * max(round(scale * abs(axis.x)),1.0),
    h * max(scale * 0.42, 0.75),
    radial * max(scale * 0.62, 1.20)
  ) * vec3<f32>(sign(axis.x),axis.y,axis.z);
}

fn sampleAuroraRibbonShape(pos: vec3<f32>, ph: f32, lod: f32) -> vec4<f32> {
  let scaleBase = max(abs(NTransform.shapeScale) * 22.0, 2.75);
  return wrap3D_shape(shape3D, sampShape, auroraRibbonUVW(pos, ph, NTransform.shapeOffsetWorld, scaleBase), lod);
}

// ---------------------- weather mapping
fn weatherUV_from(pos_world: vec3<f32>, wScale: f32) -> vec2<f32> {
  let wAxis = axisOrOne3(NTransform.weatherAxisScale);

  if (auroraLayerMode()) {
    let uv = auroraAnimatedUVFromWorld(pos_world);
    let centered = (uv - vec2<f32>(0.5, 0.5)) * vec2<f32>(1.0, wAxis.z * max(wScale,EPS));
    return centered + vec2<f32>(0.5, 0.5);
  }

  if (sphericalCloudMode()) {
    let uv = shellUVFromWorld(pos_world);
    let uvOffset = vec2<f32>(0.0,NTransform.weatherOffsetWorld.z);
    let centered = (uv - vec2<f32>(0.5, 0.5)) * vec2<f32>(1.0, wAxis.z * max(wScale,EPS));
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
  let boxH = select(max(B.half.y * 2.0, EPS), shellHeight(), sphericalCloudMode());
  let jitterRoom = abs(TUNE.baseJitterFrac) + abs(TUNE.topJitterFrac) * 0.75;
  return clamp(boxH * (0.055 + jitterRoom) + wg_finestWorld * 2.0, 0.02, max(boxH * 0.48, 0.03));
}

fn globalActiveYRange() -> vec2<f32> {
  let guard = activeColumnGuard();
  let boxRange = vec2<f32>(B.center.y - B.half.y - guard, B.center.y + B.half.y + anvilLiftWorld() + guard);
  return select(boxRange, vec2<f32>(-1.0e9, 1.0e9), sphericalCloudMode());
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
    let n = rel / max(r,EPS);
    let phaseNoise = smoothCellHash2D(n.xz + vec2<f32>(n.y * 0.71,n.y * 0.33) + vec2<f32>(17.31,9.47),5.0) - 0.5;
    let macroWarp = phaseNoise * denom * TUNE.baseJitterFrac;
    let phaseWarp = phaseNoise * denom * saturate(TUNE.verticalLayerDecorrelation) * 0.045;
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

// Keep a signed shape independently of the opaque density plateau. It supplies
// stable billow normals without probing weather or detail again.
fn styledPlanetForm(ph: f32, wm: vec4<f32>, s: vec4<f32>) -> vec2<f32> {
  let cute = saturate(TUNE.formType - 1.0);
  let coverage = saturate(C.globalCoverage * mix_f(0.72, 1.0, max(wm.r, wm.g * 0.65)));
  let scattered = TUNE.formType >= 3.5 && TUNE.formType < 4.5;
  let gas = TUNE.formType >= 4.5;
  let hemisphere = select(1.0,wm.a,TUNE.formType >= 2.5 && TUNE.formType < 3.5);
  let threshold = select(mix_f(0.82, 0.46, coverage), 0.63, scattered) - select(0.0,0.030,cute>0.5&&!gas);
  // Smooth volumetric FBM, not a thresholded Worley edge texture extruded
  // through a shell. Broad bands form the mass, fine erosion only the rim.
  let mass = select(s.r * 0.72 + s.g * 0.20 + s.b * 0.08, 0.58 + wm.a * 0.18 + (s.g-0.5)*0.12, gas);
  let lower = smoothstep(0.025, mix_f(0.16, 0.22, cute), ph);
  let summit = clamp(0.78 + (s.a - 0.5) * mix_f(0.24, 0.42, cute), 0.48, 0.97);
  let upper = 1.0 - smoothstep(summit - 0.28, summit, ph);
  var form = mass - threshold - (1.0 - lower * upper) * 0.24 - (1.0-hemisphere)*0.55;
  if(cute>0.5&&!gas){
    // Broad cores rise higher; weaker outskirts round back into the base.
    // Existing 3D bands vary height/width and roughen the entire hull, avoiding
    // identical spherical primitives or a uniformly extruded shell patch.
    let center=0.43+(s.a-0.5)*0.16;
    let halfHeight=0.40+(s.b-0.5)*0.10;
    let radial=(ph-center)/halfHeight;
    form-=radial*radial*0.16;
  }
  return vec2<f32>(form,lower*upper);
}

fn styledPlanetDensity(ph: f32, wm: vec4<f32>, s: vec4<f32>, erosion: f32) -> f32 {
  if (ph < 0.0 || ph > 1.0 || wm.b > 1.0) { return 0.0; }
  let cute = saturate(TUNE.formType - 1.0);
  let geometry=styledPlanetForm(ph,wm,s);let form=geometry.x;
  let skin = 1.0 - smoothstep(0.04, 0.16, form);
  let density = smoothstep(-0.018, mix_f(0.18, 0.085, cute), form - erosion * skin);
  return density * geometry.y * smoothstep(0.0, 0.10, C.globalCoverage) * max(C.globalDensity * 10.0, 0.0);
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

  let uv = auroraAnimatedUVFromWorld(pos);
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
    shellHash(vec2<f32>(uv.x, uv.y * 5.5 + phs * 0.55), 15.0)
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

fn auroraSpectralColor(pos: vec3<f32>, ph: f32) -> vec3<f32> {
  let phs = saturate(ph);
  let uv = auroraAnimatedUVFromWorld(pos);
  let colorWave = 0.5 + 0.5 * sin((uv.x * 4.0 + uv.y * 2.7 + phs * 0.48) * 2.0 * PI);
  let colorWave2 = 0.5 + 0.5 * sin((uv.x * 6.0 - uv.y * 3.4 + phs * 0.73 + 1.2) * 2.0 * PI);
  let strandWave = shellHash(vec2<f32>(uv.x, uv.y * 5.8 + phs * 0.40),17.0);
  let curtainWave = shellHash(vec2<f32>(uv.x - phs * 0.8, uv.y * 3.2 + phs * 0.2),56.0);

  let anchorA = max(C.frontLightColor, vec3<f32>(0.0));
  let anchorB = max(C.sunColor, vec3<f32>(0.0));
  let anchorC = max(C.shadowLightColor, vec3<f32>(0.0));
  let anchorD = mix_v3(anchorB, anchorC, 0.5 + 0.5 * sin((uv.x * 2.0 + uv.y * 1.1 + phs * 0.4) * 2.0 * PI));
  let lowerAccent = mix_v3(anchorA, anchorD, 0.20 + 0.18 * (1.0 - phs));

  var wA = 0.18 + 0.82 * (1.0 - smoothstep(0.56, 0.96, colorWave)) * mix_f(0.82, 1.18, strandWave);
  var wB = 0.10 + 0.72 * smoothstep(0.28, 0.82, colorWave) * mix_f(0.80, 1.14, curtainWave);
  var wC = 0.08 + 0.72 * smoothstep(0.34, 0.90, colorWave2) * mix_f(0.82, 1.16, 1.0 - strandWave);
  var wD = 0.06 + 0.42 * smoothstep(0.14, 0.64, phs) * (1.0 - smoothstep(0.78, 0.98, phs));

  let lowBand = 1.0 - smoothstep(0.22, 0.78, phs);
  let midBand = smoothstep(0.12, 0.44, phs) * (1.0 - smoothstep(0.62, 0.94, phs));
  let highBand = smoothstep(0.46, 0.90, phs);

  wA *= 0.58 + 0.82 * lowBand;
  wB *= 0.54 + 0.88 * midBand;
  wC *= 0.54 + 0.92 * highBand;
  wD *= 0.40 + 0.90 * (midBand + 0.35 * highBand);

  let spectralCore = anchorA * wA + anchorB * wB + anchorC * wC + lowerAccent * wD;
  let weightSum = max(wA + wB + wC + wD, 0.0001);
  let spectral = spectralCore / weightSum;
  return max(spectral, vec3<f32>(0.0));
}

fn auroraEmissionColor(pos: vec3<f32>, ph: f32, viewDir: vec3<f32>, sunDir: vec3<f32>, auroraMask: f32) -> vec3<f32> {
  let relShell = pos - B.center;
  let shellN = normalizeOr(relShell, vec3<f32>(0.0, 1.0, 0.0));
  let nightBoost = 1.0 - smoothstep(-0.18, 0.42, dot(shellN, sunDir));
  let limb = pow(1.0 - saturate(dot(shellN, viewDir)), 1.85);
  let spectral = auroraSpectralColor(pos, ph);
  let capLift = mix_f(0.82, 1.18, saturate(auroraMask));
  return spectral * capLift * mix_f(0.82, 1.85, nightBoost) + spectral * limb * 0.20;
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

// Keep repeated probes in loops. Expanding the whole density/warp call graph
// at every probe caused multi-second driver compilation on Windows/NVIDIA.
fn sphericalFinestTexelWorld() -> f32 {
  return min(1.0 / max(wg_scaleS_effMax * wg_shapeDim.x, EPS),
    1.0 / max(wg_scaleD_effMax * wg_detailDim.x, EPS));
}

fn shapeNormalProbeWorld(lod: f32, legacyMultiplier: f32) -> f32 {
  if (sphericalCloudMode()) {
    // Probe an actual filtered texel, not a complete repeated noise tile.
    // Cap the footprint at a fraction of the shell so opposite sides cannot
    // cancel near-surface relief. Mip changes remain continuous.
    let texel = exp2(clamp(lod, 0.0, wg_maxMipS)) / max(wg_scaleS_effMax * wg_shapeDim.x, EPS);
    return clamp(texel * 1.25, 0.002, max((V.cloudTop - V.cloudBottom) * 0.20, 0.002));
  }
  return max(wg_finestWorld * legacyMultiplier, 1e-3);
}

fn approxLightingNormal(
  pos: vec3<f32>,
  weatherLOD: f32,
  lodShape: f32,
  lodDetail: f32,
  wScale: f32
) -> vec3<f32> {

  let probe = shapeNormalProbeWorld(lodShape, 0.9);
  let offsets = array<vec3<f32>, 6>(
  vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(-1.0, 0.0, 0.0),
  vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(0.0, -1.0, 0.0),
  vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(0.0, 0.0, -1.0)
);
  var samples: array<f32, 6>;
  for (var i = 0u; i < 6u; i++) {
    samples[i] = sampleLightingDensity(pos + offsets[i] * probe, weatherLOD, lodShape, lodDetail, wScale);
  }
  let g = vec3<f32>(samples[0] - samples[1], samples[2] - samples[3], samples[4] - samples[5]);
  if (dot(g, g) < 1e-8) {
    return normalize(vec3<f32>(smoothCellHash2D(pos.xz + vec2<f32>(11.7, 3.9), 5.0) - 0.5, 0.22, smoothCellHash2D(pos.xz + vec2<f32>(2.4, 17.1), 5.0) - 0.5));
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

  let probe = max(shapeNormalProbeWorld(lodShape, 2.25), 2e-3);
  var samples: array<f32, 3>;
  let offsets = array<f32, 3>(0.0, 1.0, -1.0);
  for (var i = 0u; i < 3u; i++) {
    samples[i] = sampleLightingDensity(pos + sunDir * (probe * offsets[i]), weatherLOD, lodShape, lodDetail, wScale);
    if (i == 0u && samples[0] <= 1e-5) { return 0.0; }
  }
  let d0 = samples[0];
  let dFront = samples[1];
  let dBack = samples[2];
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

    let probe = shapeNormalProbeWorld(lodShape, 1.25);
    let offsets = array<vec3<f32>, 6>(
  vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(-1.0, 0.0, 0.0),
  vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(0.0, -1.0, 0.0),
  vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(0.0, 0.0, -1.0)
);
    var samples: array<f32, 6>;
    for (var i = 0u; i < 6u; i++) {
      samples[i] = sampleShapeRGBA(pos + offsets[i] * probe, ph, lodShape).r;
    }
    let g = vec3<f32>(samples[0] - samples[1], samples[2] - samples[3], samples[4] - samples[5]) * (0.5 / probe);
    if (dot(g, g) < 1e-8) { return normalize(vec3<f32>(0.18, 0.28, 0.94)); }
    return normalize(-g);
}

fn approxShapeNormalFast(pos: vec3<f32>, ph: f32, lodShape: f32) -> vec3<f32> {

    let probe = shapeNormalProbeWorld(lodShape, 1.5);
    let offsets = array<vec3<f32>, 6>(
  vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(-1.0, 0.0, 0.0),
  vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(0.0, -1.0, 0.0),
  vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(0.0, 0.0, -1.0)
);
    var samples: array<f32, 6>;
    for (var i = 0u; i < 6u; i++) {
      samples[i] = sampleShapeRGBA(pos + offsets[i] * probe, ph, lodShape).r;
    }
    let g = vec3<f32>(samples[0] - samples[1], samples[2] - samples[3], samples[4] - samples[5]) * (0.5 / probe);
    if (dot(g, g) < 1e-8) { return normalize(vec3<f32>(0.18, 0.28, 0.94)); }
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
`;

  // tools/clouds/shaders/cloudLayer.wgsl
  var cloudLayer_default = "// ---------------------- Main compute\n\nfn computeCloudCore(gid_in: vec3<u32>, local_id: vec3<u32>) {\n  // workgroup cache\n  if (local_id.x == 0u && local_id.y == 0u) {\n    let wd = textureDimensions(weather2D, 0);\n    wg_weatherDim = vec2<f32>(f32(wd.x), f32(wd.y));\n    let weatherEp = vec2<f32>(0.5 / max(wg_weatherDim.x, 1.0), 0.5 / max(wg_weatherDim.y, 1.0));\n    wg_weatherUvMul = vec2<f32>(1.0, 1.0) - 2.0 * weatherEp;\n    wg_weatherUvAdd = weatherEp;\n\n    let bd = textureDimensions(blueTex, 0);\n    wg_blueDim = vec2<f32>(f32(bd.x), f32(bd.y));\n\n    let sd = textureDimensions(shape3D);\n    wg_shapeDim = vec3<f32>(f32(sd.x), f32(sd.y), f32(sd.z));\n    let shapeEp = vec3<f32>(\n      0.5 / max(wg_shapeDim.x, 1.0),\n      0.5 / max(wg_shapeDim.y, 1.0),\n      0.5 / max(wg_shapeDim.z, 1.0)\n    );\n    wg_shapeUvMul = vec3<f32>(1.0, 1.0, 1.0) - 2.0 * shapeEp;\n    wg_shapeUvAdd = shapeEp;\n\n    let dd = textureDimensions(detail3D);\n    wg_detailDim = vec3<f32>(f32(dd.x), f32(dd.y), f32(dd.z));\n    let detailEp = vec3<f32>(\n      0.5 / max(wg_detailDim.x, 1.0),\n      0.5 / max(wg_detailDim.y, 1.0),\n      0.5 / max(wg_detailDim.z, 1.0)\n    );\n    wg_detailUvMul = vec3<f32>(1.0, 1.0, 1.0) - 2.0 * detailEp;\n    wg_detailUvAdd = detailEp;\n\n    wg_maxMipW = f32(textureNumLevels(weather2D)) - 1.0;\n    wg_maxMipS = f32(textureNumLevels(shape3D)) - 1.0;\n    wg_maxMipD = f32(textureNumLevels(detail3D)) - 1.0;\n\n    let scaleS_local = max(V.worldToUV * B.uvScale, EPS);\n    wg_scaleS = scaleS_local;\n    wg_scaleD = max(scaleS_local * (128.0 / 32.0), EPS);\n\n    let sAxis = axisOrOne3(NTransform.shapeAxisScale);\n    let dAxis = axisOrOne3(NTransform.detailAxisScale);\n\n    let sMul = select(NTransform.shapeScale, 1.0, NTransform.shapeScale == 0.0);\n    let dMul = select(NTransform.detailScale, 1.0, NTransform.detailScale == 0.0);\n\n    wg_scaleS_effMax = wg_scaleS * max(sMul, EPS) * axisMaxAbs3(sAxis);\n    wg_scaleD_effMax = wg_scaleD * max(dMul, EPS) * axisMaxAbs3(dAxis);\n\n    wg_finestWorld = min(1.0 / wg_scaleS_effMax, 1.0 / wg_scaleD_effMax) * 0.6;\n\n    // Keep jitter/warp amplitude and the homogeneous vertical profile at the\n    // original local-cloud scale even when the horizon box tiles outward.\n    let rawBoxMaxXZ = max(max(B.half.x, B.half.z), 1.0);\n    wg_boxMaxXZ = min(rawBoxMaxXZ, 1.0);\n    wg_tallBlend = saturate(remap(B.half.y, 0.34, 1.60, 0.0, 1.0));\n    wg_thickPerfStrength = saturate(remap(B.half.y, 0.36, 2.40, 0.0, 1.0)) * clamp(TUNE.thickBoxPerf, 0.0, 2.0);\n\n    wg_verticalHomogeneity = saturate(TUNE.verticalTextureHomogeneity);\n    let baseHalfY = max(B.half.y, EPS);\n    let refHalfY = clamp(wg_boxMaxXZ, 0.35, 1.25);\n    wg_verticalRefHalfY = mix_f(baseHalfY, min(baseHalfY, refHalfY), wg_verticalHomogeneity);\n    wg_verticalRefBoxH = max(wg_verticalRefHalfY * 2.0, EPS);\n    let yTileTarget = rawBoxMaxXZ / max(wg_verticalRefBoxH * 2.75, 0.25);\n    wg_verticalDomainScale = mix_f(1.0, clamp(yTileTarget, 1.0, 9.0), wg_verticalHomogeneity);\n    wg_weatherAxisYAbs = max(abs(axisOrOne3(NTransform.weatherAxisScale).y), EPS);\n    wg_boxMinCached = B.center - B.half;\n    wg_boxMaxCached = B.center + B.half + vec3<f32>(0.0, anvilLiftWorld(), 0.0);\n  }\n  workgroupBarrier();\n\n  // pixel and guard\n  let temporalRate = temporalCellRateNormalized();\n  let temporalHistoryActive = reproj.enabled == 1u || temporalRate > 1u || reproj.temporalBlend > 0.0001;\n  let compactInterleave = reproj.compactInterleave != 0u && temporalRate > 1u && reproj.frameIndex > 0u;\n\n  var pixI = vec2<i32>(i32(gid_in.x), i32(gid_in.y)) + vec2<i32>(frame.originX, frame.originY);\n  if (compactInterleave) {\n    let mapped = compactTemporalPixel(gid_in.xy, temporalRate);\n    if (mapped.z == 0u) { return; }\n    pixI = vec2<i32>(i32(mapped.x), i32(mapped.y));\n  }\n\n  if (pixI.x < 0 || pixI.y < 0 || pixI.x >= i32(frame.fullWidth) || pixI.y >= i32(frame.fullHeight)) {\n    return;\n  }\n\n  let fullPix = fullPixFromCurrent(pixI);\n  beginLayerSample(pixI);\n\n  let fullResF = vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));\n  let uvPix = (vec2<f32>(pixI) + 0.5) / fullResF;\n\n  // camera basis\n  let camFwd = normalize(V.fwd);\n\n  var basisRight = normalize(V.right);\n  if (length(basisRight) < EPS) { basisRight = vec3<f32>(1.0, 0.0, 0.0); }\n\n  var basisUp = normalize(V.up);\n  if (length(basisUp) < EPS) { basisUp = vec3<f32>(0.0, 1.0, 0.0); }\n\n  // ray origin\n  var rayRo = V.camPos;\n  if (CLOUD_USE_CUSTOM_POS != 0u) {\n    let idx = u32(pixI.x) + u32(pixI.y) * frame.fullWidth;\n    rayRo = posBuf[idx].xyz;\n  }\n\n  // ray direction\n  // Keep the primary-ray dither stable per pixel. Frame-varying ray jitter was\n  // good for breaking seams, but it caused subtle lighting shimmer/flicker once\n  // the post resolve started blending thin cloud pixels.\n  let rayJx = hash11Fast(f32(fullPix.x) * 0.06711056 + f32(fullPix.y) * 0.00583715 + 0.754877666) - 0.5;\n  let rayJy = hash11Fast(f32(fullPix.x) * 0.01145137 + f32(fullPix.y) * 0.09324173 + 14.124877666) - 0.5;\n  let jitterPixScreen = vec2<f32>(rayJx, rayJy) * 0.18;\n  // Spherical planet clouds must stay locked to world/sphere coordinates.\n  // Screen-space subpixel jitter makes the volume crawl relative to the camera.\n  let jitterPix = jitterPixScreen * cloudModeF32(1.0, 0.0, 0.0);\n  let jitteredUvPix = (vec2<f32>(pixI) + 0.5 + jitterPix) / fullResF;\n  let ndc = jitteredUvPix * 2.0 - vec2<f32>(1.0, 1.0);\n  let tanY = tan(0.5 * V.fovY);\n\n  let rd_camera = normalize(vec3<f32>(ndc.x * V.aspect * tanY, -ndc.y * tanY, -1.0));\n  let rayRd = normalize(basisRight * rd_camera.x + basisUp * rd_camera.y - camFwd * rd_camera.z);\n\n  // intersect volume\n  let bmin = boxMin();\n  let bmax = boxMax();\n  var ti = intersectAABB_robust(rayRo, rayRd, bmin, bmax);\n  if (sphericalCloudMode()) {\n    ti = intersectSphericalCloudShellView(rayRo, rayRd);\n  }\n\n  if (ti.x > ti.y || ti.y <= 0.0) {\n    let z = vec4<f32>(0.0);\n    textureStore(outTex, pixI, frame.layerIndex, z);\n    if (temporalHistoryActive) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }\n    return;\n  }\n\n  var t0 = max(ti.x - TUNE.aabbFaceOffset, 0.0);\n  var t1 = ti.y + TUNE.aabbFaceOffset;\n  if (t0 >= t1) {\n    let z = vec4<f32>(0.0);\n    textureStore(outTex, pixI, frame.layerIndex, z);\n    if (temporalHistoryActive) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }\n    return;\n  }\n\n  let globalYR = globalActiveYRange();\n  let segY0 = rayRo.y + rayRd.y * t0;\n  let segY1 = rayRo.y + rayRd.y * t1;\n  if (max(segY0, segY1) < globalYR.x || min(segY0, segY1) > globalYR.y) {\n    let z = vec4<f32>(0.0);\n    textureStore(outTex, pixI, frame.layerIndex, z);\n    if (temporalHistoryActive) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }\n    return;\n  }\n\n  // Tall AABBs are allowed as traversal headroom, but the actual cloud profile\n  // can be much thinner. Clip the ray segment to the global active Y band before\n  // deriving the ray budget so vertical extent does not inflate primary steps.\n  if (abs(rayRd.y) > 1e-5) {\n    var ty0 = (globalYR.x - rayRo.y) / rayRd.y;\n    var ty1 = (globalYR.y - rayRo.y) / rayRd.y;\n    if (ty0 > ty1) {\n      let tmp = ty0;\n      ty0 = ty1;\n      ty1 = tmp;\n    }\n    t0 = max(t0, ty0 - TUNE.aabbFaceOffset);\n    t1 = min(t1, ty1 + TUNE.aabbFaceOffset);\n    if (t0 >= t1) {\n      let z = vec4<f32>(0.0);\n      textureStore(outTex, pixI, frame.layerIndex, z);\n      if (temporalHistoryActive) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }\n      return;\n    }\n  }\n\n  // ---------------------- precompute weather mapping and LOD\n  let wScale = select(NTransform.weatherScale, 1.0, NTransform.weatherScale == 0.0);\n  let wAxis = axisOrOne3(NTransform.weatherAxisScale);\n\n  let weatherTileInvWorld = 0.5 * max(B.uvScale, EPS);\n  let boxTexelsPerWorldU = wg_weatherDim.x * abs(wAxis.x) * wScale * weatherTileInvWorld;\n  let boxTexelsPerWorldV = wg_weatherDim.y * abs(wAxis.z) * wScale * weatherTileInvWorld;\n  let rMid = max(sphereRadiusBase() + (V.cloudBottom + V.cloudTop) * 0.5, 1.0);\n  let sphereTexelsPerWorldU = wg_weatherDim.x * abs(wAxis.x) * wScale / max(2.0 * PI * rMid, EPS);\n  let sphereTexelsPerWorldV = wg_weatherDim.y * abs(wAxis.z) * wScale / max(PI * rMid, EPS);\n  let texelsPerWorld_u = select(boxTexelsPerWorldU, sphereTexelsPerWorldU, sphericalCloudMode());\n  let texelsPerWorld_v = select(boxTexelsPerWorldV, sphereTexelsPerWorldV, sphericalCloudMode());\n  let fp = max(texelsPerWorld_u, texelsPerWorld_v);\n\n  let weatherLOD_base = clamp(\n    log2(max(fp, 1.0)) + TUNE.lodBiasWeather * max(perf.lodBiasMul, 0.0001),\n    0.0,\n    wg_maxMipW\n  );\n\n  let fullHeightF = max(f32(frame.fullHeight), 1.0);\n  let rayPixelWorldScale = (2.0 * tanY) / fullHeightF;\n\n  // Use true ray distance from the active camera origin for near/far behavior.\n  // Projected camera-forward depth breaks down with wide FOV and when the\n  // camera enters the volume, which can make nearby cloud samples use far LODs.\n  let entryRayDistance = max(t0, 0.0);\n\n  let horizonFarScale = max(max(B.half.x, B.half.z), 1.0);\n  let nearMetricScale = max(horizonFarScale, max(verticalReferenceBoxH(), 1.0));\n  let effectiveNearFluffDist = clamp(min(TUNE.nearFluffDist, nearMetricScale * 0.10), 0.35, 6.0);\n  let effectiveNearDensityRange = clamp(min(TUNE.nearDensityRange, nearMetricScale * 0.08), 0.35, 5.0);\n  let nearFineDist = clamp(effectiveNearFluffDist * 0.12, 0.08, 0.35);\n\n  // noise and jitter\n  let bnPix = distanceBlueScreen(pixI, entryRayDistance, effectiveNearFluffDist);\n  let entryWorldForNoise = rayRo + rayRd * max(t0, 0.0);\n  // World/sphere-locked smooth noise. Do not include frameIndex here:\n  // frame-varying jitter turns x4 interleave into visible flicker.\n  var rand0 = bnPix;\n  if (sphericalCloudMode()) {\n    let entryUvForNoise = shellUVFromWorld(entryWorldForNoise);\n    let worldRandFreq = auroraModeF32(128.0, 56.0);\n    rand0 = shellHash(entryUvForNoise + vec2<f32>(13.71, 4.23), worldRandFreq);\n  }\n  let entryNearF = 1.0 - smoothstep(0.0, max(effectiveNearFluffDist, EPS), entryRayDistance);\n  let nearJitterScale = mix_f(1.0, 0.32, entryNearF);\n\n  // step sizing\n  let viewDir = -rayRd;\n\n  let voxelBound = wg_finestWorld / max(abs(dot(rayRd, basisUp)), 0.15);\n\n  let raySegmentLength = max(t1 - t0, TUNE.minStep);\n  let segmentAspect = raySegmentLength / max(max(B.half.x, B.half.z), max(B.half.y * 2.0, 1.0));\n  let thickPerfF = saturate(thickBoxPerfStrength() * saturate(remap(segmentAspect, 0.35, 1.45, 0.0, 1.0)));\n  let maxStepsF = max(f32(max(TUNE.maxSteps, 1)), 1.0);\n  let horizonPerfF = smoothstep(24.0, 120.0, horizonFarScale) * smoothstep(0.30, 1.10, segmentAspect);\n  let reachStepLimit = (raySegmentLength / maxStepsF) * mix_f(1.10, 1.55, horizonPerfF);\n  let vStepBoost = verticalStepBoost();\n  let thickStepLimit = TUNE.maxStep * mix_f(1.0, max(TUNE.thickStepBoost, 1.0), thickPerfF);\n  let verticalStepLimit = TUNE.maxStep * vStepBoost;\n  let effectiveMaxStep = max(max(max(TUNE.maxStep, thickStepLimit), verticalStepLimit), reachStepLimit);\n\n  var baseStep = clamp(V.stepBase, TUNE.minStep, effectiveMaxStep);\n  baseStep = min(baseStep, voxelBound * mix_f(1.0, 1.65, thickPerfF));\n  let sphericalJitterScale = cloudModeF32(1.0, 0.46, 0.18);\n  baseStep = baseStep * mix_f(1.0, 1.0 + TUNE.stepJitter * nearJitterScale * sphericalJitterScale, rand0 * 2.0 - 1.0);\n  baseStep = clamp(baseStep, TUNE.minStep, effectiveMaxStep);\n\n  let farStartWorld = max(TUNE.farStart * horizonFarScale, TUNE.farStart);\n  let farFullWorld = max(TUNE.farFull * horizonFarScale, farStartWorld + 0.001);\n\n  let rayExitDepth = max(t1, entryRayDistance);\n  let rayFarHistoryF = saturate(remap(rayExitDepth, farStartWorld, farFullWorld, 0.0, 1.0));\n  let thickBudgetBoost = mix_f(1.08, max(1.08, TUNE.thickStepBoost), thickPerfF);\n  let rayBudgetStep = clamp((raySegmentLength / maxStepsF) * max(thickBudgetBoost, vStepBoost), TUNE.minStep, effectiveMaxStep);\n\n  let startPhaseJitter = TUNE.phaseJitter * mix_f(1.0, 0.30, entryNearF) * sphericalJitterScale;\n  var t = clamp(t0 + (rand0 * startPhaseJitter) * min(baseStep, rayBudgetStep), t0, t1);\n\n  // lighting setup. rayRd points from camera into the volume, matching the blog-style phase convention.\n  let sunDir = normalize(L.sunDir);\n  let cosVS = dot(rayRd, sunDir);\n\n  // sun shadowing samples should cover neighboring cloud volume, not only the vertical slab thickness.\n  let sunBoxHalf = vec3<f32>(B.half.x, verticalReferenceHalfY(), B.half.z);\n  let sunNominalSpan = max(min(length(sunBoxHalf * 2.0) * 0.5, 4.0) * verticalLightingStepBoost(), EPS);\n  let sunStepLen = clamp(\n    sunNominalSpan / f32(max(TUNE.sunSteps, 1)),\n    TUNE.minStep,\n    max(effectiveMaxStep, sunNominalSpan)\n  );\n\n  // accumulators\n  var Tr = 1.0;\n  var rgb = vec3<f32>(0.0);\n\n  var Tsun_cached = 1.0;\n  var prevDens: f32 = 0.0;\n  var prevMacroDens: f32 = 0.0;\n  var prevTsun: f32 = 1.0;\n\n  var shapeN_cached = vec3<f32>(0.0, 1.0, 0.0);\n  var lightN_cached = vec3<f32>(0.0, 1.0, 0.0);\n  var rim_cached: f32 = 0.0;\n  var sunSide_cached: f32 = 0.5;\n  var sunRim_cached: f32 = 0.0;\n  var sunExposure_cached: f32 = 0.0;\n  var upperExposure_cached: f32 = 1.0;\n\n  var runMeanL: f32 = 0.0;\n  var runN: f32 = 0.0;\n\n  var iter: i32 = 0;\n\n  let maxMarchSteps = select(TUNE.maxSteps, min(TUNE.maxSteps, 56), auroraLayerMode());\n\n  loop {\n    if (iter >= maxMarchSteps) { break; }\n    if (t >= t1) { break; }\n    if (Tr <= transmittanceCutoff()) {\n      Tr = 0.0;\n      break;\n    }\n\n    let rayShallowF = 1.0 - smoothstep(0.025, 0.22, abs(rayRd.y));\n    let planetSliceJitterScale = cloudModeF32(1.0, 0.58, 0.36);\n    let sliceJitter = saturate(TUNE.sliceJitterStrength) * mix_f(1.0, 1.55, rayShallowF) * sphericalJitterScale * planetSliceJitterScale;\n    let sliceHashScreen = hash11Fast(\n      f32(fullPix.x) * 0.071324 +\n      f32(fullPix.y) * 0.117913 +\n      f32(iter) * 0.167351 +\n      rand0 * 19.1731\n    );\n\n    let stepT = clamp(t, t0, t1);\n    let stepRayDistance = max(stepT, 0.0);\n    let stepPixelWorld = max(stepRayDistance * rayPixelWorldScale, wg_finestWorld * 0.50);\n    let farF = saturate(remap(stepRayDistance, farStartWorld, farFullWorld, 0.0, 1.0));\n    let screenFarF = saturate(remap(stepPixelWorld / max(wg_finestWorld, EPS), 2.0, 18.0, 0.0, 1.0));\n    let coverageStep = max(\n      rayBudgetStep,\n      baseStep * mix_f(1.0, max(TUNE.farStepMult, 1.0), screenFarF)\n    );\n    let nearStepF = 1.0 - smoothstep(0.0, nearFineDist, stepRayDistance);\n    let fineStep = baseStep * mix_f(1.0, clamp(TUNE.nearStepScale, 0.12, 1.0), nearStepF);\n    let baseStepLen = clamp(mix_f(coverageStep, fineStep, nearStepF), TUNE.minStep, effectiveMaxStep);\n    let auroraTargetStep = raySegmentLength / 42.0;\n    let auroraStepMax = max(effectiveMaxStep, raySegmentLength / 28.0);\n    let auroraStepLen = clamp(max(baseStepLen, auroraTargetStep), TUNE.minStep * 3.0, auroraStepMax);\n    let stepLen = select(baseStepLen, auroraStepLen, auroraLayerMode());\n\n    var sliceHash = sliceHashScreen;\n    if (sphericalCloudMode()) {\n      let sliceProbeT = clamp(t + stepLen * 0.50, t0, t1);\n      let sliceProbeP = rayRo + rayRd * sliceProbeT;\n      let sliceProbeUv = shellUVFromWorld(sliceProbeP);\n      let sliceShellPhase = shellPhase01FromWorld(sliceProbeP);\n      let sliceHashWorldA = shellHash(\n        sliceProbeUv + vec2<f32>(sliceShellPhase * 0.173 + rand0 * 0.019, sliceShellPhase * 0.311),\n        auroraModeF32(176.0, 104.0)\n      );\n      sliceHash = sliceHashWorldA;\n    }\n\n    // Keep the same march coverage, but de-correlate where each interval is\n    // sampled. This breaks the straight-through shelf pattern without shrinking\n    // the step length and losing the far side of the cloud box.\n    let sampleWindowEnd = min(t + stepLen * 0.98, t1);\n    let jitterWindow = max(sampleWindowEnd - t, TUNE.minStep);\n    let jitterCenter = mix_f(0.50, 0.46, rayShallowF);\n    let jitterAmp = mix_f(0.18, 0.46, rayShallowF) * sliceJitter;\n    let jitterPhase = clamp(jitterCenter + (sliceHash - 0.5) * jitterAmp, 0.04, 0.96);\n    var sampleT = clamp(t + jitterWindow * jitterPhase, t0, sampleWindowEnd);\n    // Continuous interval quadrature, also when flying inside an aurora. The\n    // old 44-shell snap re-solved a quadratic at every step and popped between\n    // discrete radial sheets. Midpoint-biased jitter needs no shell re-solve.\n    let p = rayRo + rayRd * sampleT;\n    if (sphericalCloudMode()) {\n      let camRel = rayRo - B.center;\n      let sampleRel = p - B.center;\n      let camLen2 = dot(camRel, camRel);\n      let sampleLen2 = dot(sampleRel, sampleRel);\n      if (camLen2 > EPS && sampleLen2 > EPS) {\n        let hemi = dot(normalize(sampleRel), normalize(camRel));\n        if (hemi < -0.020) {\n          break;\n        }\n      }\n    }\n    let sampleRayDistance = max(sampleT, 0.0);\n    // The flat renderer's historical tile-scale floor is intentional there.\n    // On a planet it incorrectly forced a coarse mip even inside the shell.\n    let minimumPixelWorld = select(wg_finestWorld * 0.50, sphericalFinestTexelWorld() * 0.50,\n      sphericalCloudMode() && !auroraLayerMode());\n    let samplePixelWorld = max(sampleRayDistance * rayPixelWorldScale, minimumPixelWorld);\n\n    let thickLodExtra = thickPerfF * saturate(TUNE.thickDetailSkip) * smoothstep(0.28, 0.96, sampleRayDistance);\n    let weatherLOD = clamp(weatherLOD_base + TUNE.farLodPush * farF * 0.65, 0.0, wg_maxMipW);\n    let nearHorizontalRayF = rayShallowF\n      * (1.0 - smoothstep(effectiveNearFluffDist * 0.85, effectiveNearFluffDist * 4.25, sampleRayDistance));\n    let straightThroughViewF = rayShallowF * (1.0 - smoothstep(0.74, 1.0, farF));\n\n\n    let uv_weather = weatherUV_from(p, wScale);\n    let wm_primary = wrap2D(weather2D, samp2D, uv_weather, 0i, 0.0);\n\n    let ph_coarse = computePH(p, wm_primary);\n\n    var columnSkip = verticalColumnSkipDistance(p, rayRd, wm_primary, stepLen, effectiveMaxStep, thickPerfF, screenFarF);\n    columnSkip = mix_f(columnSkip, 0.0, nearHorizontalRayF);\n    if (columnSkip > stepLen * 1.12) {\n      prevDens = 0.0;\n      prevMacroDens = 0.0;\n      prevTsun = Tsun_cached;\n      t = min(t + columnSkip, t1);\n      iter = iter + 1;\n      continue;\n    }\n\n    // Exact vertical/weather miss for this sample. This is intentionally a\n    // short conservative jump, not a long visibility cull, so clouds cannot\n    // disappear from LOD shells while tall boxes avoid wasting full density work\n    // above, below, or inside cut-out portions of the current weather column.\n    if (ph_coarse < 0.0 || wm_primary.b >= 1.0) {\n      let missBoost = mix_f(1.35, min(max(TUNE.emptySkipMult, 1.0), 2.75), max(thickPerfF, screenFarF));\n      let missStep = clamp(stepLen * missBoost, TUNE.minStep, effectiveMaxStep * 2.0);\n      prevDens = 0.0;\n      prevMacroDens = 0.0;\n      prevTsun = Tsun_cached;\n      t = min(t + missStep, t1);\n      iter = iter + 1;\n      continue;\n    }\n\n    let weatherGateFast = weatherCoverageGate(wm_primary);\n    if (weatherGateFast >= TUNE.weatherRejectGate && sampleRayDistance > nearFineDist * 2.0 && nearHorizontalRayF < 0.35) {\n      let rejectF = smoothstep(TUNE.weatherRejectGate, 1.0, weatherGateFast);\n      let rejectPerfF = max(max(rejectF, thickPerfF * 0.45), screenFarF * 0.50);\n      let rejectBoost = mix_f(1.18, min(max(TUNE.emptySkipMult, 1.0), 4.35), rejectPerfF);\n      var rejectStep = clamp(stepLen * rejectBoost, TUNE.minStep, effectiveMaxStep * 2.2);\n      let runProbeF = max(thickPerfF, screenFarF) * smoothstep(nearFineDist * 4.0, nearFineDist * 12.0, sampleRayDistance);\n      if (runProbeF > 0.36) {\n        let probeStep = clamp(rejectStep * mix_f(1.55, 2.65, runProbeF), TUNE.minStep, effectiveMaxStep * 5.5);\n        let probeMip = clamp(weatherLOD + 1.25 + runProbeF * 1.50, 0.0, wg_maxMipW);\n        if (weatherProbeEmpty(p + rayRd * rejectStep, rayRd, probeStep, 3, probeMip, wScale)) {\n          rejectStep = clamp(rejectStep + probeStep * mix_f(1.0, 2.45, runProbeF), TUNE.minStep, effectiveMaxStep * 8.0);\n        }\n      }\n      prevDens = 0.0;\n      prevMacroDens = 0.0;\n      prevTsun = Tsun_cached;\n      t = min(t + rejectStep, t1);\n      iter = iter + 1;\n      continue;\n    }\n\n    // LOD from actual camera distance and FOV. Step length is still allowed to\n    // raise far LODs, but near/in-volume samples stay anchored to screen-space\n    // pixel footprint so clouds do not vanish while the camera passes through.\n    let stepLOD = clamp(log2(max(stepLen / wg_finestWorld, 1.0)), 0.0, wg_maxMipS);\n    let pixelLOD = clamp(log2(max(samplePixelWorld / wg_finestWorld, 1.0)), 0.0, wg_maxMipS);\n    let baseLOD = mix_f(pixelLOD, max(pixelLOD, stepLOD), smoothstep(0.70, 1.0, farF));\n\n    let nearSmooth = pow(saturate(1.0 - sampleRayDistance / effectiveNearFluffDist), 0.85);\n\n    let lodBias = mix_f(0.0, TUNE.nearLodBias, nearSmooth);\n    let nearDetailSoftLod = smoothstep(max(effectiveNearFluffDist * 0.72, 0.10), 0.0, sampleRayDistance) * 0.55;\n    let farLodExtra = TUNE.farLodPush * farF * 0.60;\n    let thickShapeLodExtra = thickLodExtra * 0.10;\n    let thickDetailLodExtra = thickLodExtra * 0.28;\n    let lodShapeLighting = clamp(baseLOD + lodBias + farLodExtra + thickShapeLodExtra, 0.0, wg_maxMipS);\n    let lodDetailLighting = clamp(baseLOD + lodBias + farLodExtra + nearDetailSoftLod + thickDetailLodExtra, 0.0, wg_maxMipD);\n    let lodShapeBase = min(lodShapeLighting, min(wg_maxMipS, 2.25));\n    let lodDetailBase = min(lodDetailLighting, min(wg_maxMipD, 2.75));\n\n    let auroraMask = auroraCapMask(p);\n    if (auroraMask <= 0.0001) {\n      prevDens = 0.0;\n      prevMacroDens = 0.0;\n      prevTsun = Tsun_cached;\n      t = min(t + clamp(stepLen * 2.5, TUNE.minStep, effectiveMaxStep * 5.0), t1);\n      iter = iter + 1;\n      continue;\n    }\n    var stepWarp = vec2<f32>(0.0);\n    if (!auroraLayerMode()) { stepWarp = worldWarpXZ(p.xz, max(ph_coarse, 0.0), wg_boxMaxXZ); }\n\n    let visibleLodEase = smoothstep(0.08, 0.98, max(farF, screenFarF));\n    let definitionHold = cloudDefinition01();\n    let sparseHold = cloudSparsity01();\n    let visibleLodEaseDefined = visibleLodEase * mix_f(1.0, 0.74, definitionHold);\n    var lodShapeVisible = clamp(min(lodShapeLighting, mix_f(1.10, 2.38, visibleLodEaseDefined)), 0.0, wg_maxMipS);\n    var lodDetailVisibleBase = clamp(min(lodDetailLighting, mix_f(1.12, 2.72, visibleLodEaseDefined)), 0.0, wg_maxMipD);\n    if (sphericalCloudMode() && !auroraLayerMode()) {\n      // Use the real texture texel footprint, not one whole noise tile. Retain\n      // fine mip zero in close views, filter subpixel detail instead of forcing\n      // high-frequency erosion back through the flat preset's mip caps.\n      lodShapeVisible = clamp(log2(max(samplePixelWorld * wg_scaleS_effMax * wg_shapeDim.x,1.0)),0.0,wg_maxMipS);\n      lodDetailVisibleBase = clamp(log2(max(samplePixelWorld * wg_scaleD_effMax * wg_detailDim.x,1.0)),0.0,wg_maxMipD);\n    }\n\n    let faceFade = insideFaceFade(p, bmin, bmax);\n    let nearDense = mix_f(TUNE.nearDensityMult, 1.0, saturate(sampleRayDistance / effectiveNearDensityRange));\n\n    let verticalInteriorF = smoothstep(0.10, 0.28, ph_coarse) * (1.0 - smoothstep(0.78, 0.98, ph_coarse));\n    let weatherFilledF = 1.0 - smoothstep(TUNE.weatherRejectGate * 0.54, TUNE.weatherRejectGate * 0.94, weatherGateFast);\n    let noShapeFarF = smoothstep(mix_f(0.76, 0.88, definitionHold), 1.0, max(farF, screenFarF))\n      * smoothstep(nearFineDist * 5.0, nearFineDist * 12.0, sampleRayDistance)\n      * verticalInteriorF\n      * weatherFilledF\n      * max(thickPerfF, screenFarF * 0.65)\n      * (1.0 - nearHorizontalRayF * 0.85)\n      * (1.0 - straightThroughViewF * 0.98);\n\n    var s: vec4<f32>;\n    var densMacro: f32;\n    var usedWeatherProxy: f32 = 0.0;\n    if (auroraLayerMode()) {\n      s = sampleAuroraRibbonShape(p, max(ph_coarse, 0.0), clamp(lodShapeVisible + 0.70, 0.0, wg_maxMipS));\n      let auroraDetProxy = detailProxyFromShape(max(ph_coarse, 0.0), s);\n      densMacro = auroraCurtainDensity(ph_coarse, wm_primary, s, auroraDetProxy, p) * faceFade;\n    } else if (noShapeFarF > 0.62) {\n      s = syntheticShapeFromWeather(ph_coarse, wm_primary);\n      densMacro = densityWeatherProxy(ph_coarse, wm_primary) * faceFade * nearDense * auroraMask;\n      usedWeatherProxy = noShapeFarF;\n    } else {\n      s = sampleShapeRGBAWarp(p, max(ph_coarse, 0.0), lodShapeVisible, stepWarp);\n      densMacro = densityMacroFromSamples(ph_coarse, wm_primary, s) * faceFade * nearDense * auroraMask;\n    }\n\n    // Conservative macro-empty acceleration. Detail noise only erodes the macro\n    // field, so when the macro field is genuinely absent there is no useful\n    // detail/lighting work to do. Keep the threshold tiny and only use a short\n    // jump so silhouettes and wisps survive.\n    let macroEmptyThreshold = max(TUNE.sunDensityGate * mix_f(0.46, 0.94, thickPerfF), 0.00006);\n    let macroMissF = smoothstep(macroEmptyThreshold * 2.5, macroEmptyThreshold * 0.45, max(densMacro, prevMacroDens));\n    let macroMissAllowed = macroMissF * smoothstep(nearFineDist * 1.25, nearFineDist * 3.0, sampleRayDistance) * max(thickPerfF, screenFarF * 0.55) * (1.0 - nearHorizontalRayF * 0.90);\n    if (macroMissAllowed > 0.72 && densMacro < macroEmptyThreshold) {\n      let missBoost = mix_f(1.35, min(max(TUNE.emptySkipMult, 1.0), 4.10), macroMissAllowed);\n      let missStep = clamp(stepLen * missBoost, TUNE.minStep, effectiveMaxStep * 2.80);\n      prevDens = 0.0;\n      prevMacroDens = max(densMacro, 0.0);\n      prevTsun = Tsun_cached;\n      t = min(t + missStep, t1);\n      iter = iter + 1;\n      continue;\n    }\n\n    let farLightingFastF = saturate(remap(max(farF, screenFarF), 0.62, 1.0, 0.0, 1.0));\n    let denseLightingFastF = saturate(remap(max(densMacro, prevMacroDens), 0.15, 0.35, 0.0, 1.0));\n    let macroOnly = (farLightingFastF * denseLightingFastF) > 0.72;\n\n    let farProxyRawF = smoothstep(mix_f(0.66, 0.78, definitionHold), 1.0, max(farF, screenFarF)) * smoothstep(nearFineDist * 2.0, nearFineDist * 6.0, sampleRayDistance) * (1.0 - nearHorizontalRayF * 0.75) * (1.0 - straightThroughViewF * 0.88);\n    let farProxyEdgeProtect = 1.0 - smoothstep(0.025, 0.16, densMacro);\n    let farProxySafeF = max(farProxyRawF * (1.0 - farProxyEdgeProtect * 0.65), usedWeatherProxy * 0.86);\n\n    let detailProxy = detailProxyFromShape(max(ph_coarse, 0.0), s);\n    let denseInteriorF = smoothstep(0.12, 0.34, densMacro);\n    let thickInteriorFilterF = thickPerfF * smoothstep(0.14, 0.52, densMacro) * smoothstep(0.14, 0.94, sampleRayDistance);\n    let lodDetailVisible = clamp(lodDetailVisibleBase + thickInteriorFilterF * mix_f(0.90, 0.54, definitionHold) + farProxySafeF * mix_f(1.05, 0.58, definitionHold), 0.0, wg_maxMipD);\n    var detailRaw = detailProxy;\n    if (!auroraLayerMode() && !macroOnly && farProxySafeF < 0.62 && usedWeatherProxy < 0.52) {\n      detailRaw = sampleDetailRGBWarp(p, max(ph_coarse, 0.0), lodDetailVisible, stepWarp);\n    }\n    let thickDetailProxyF = thickPerfF * saturate(TUNE.thickDetailSkip) * smoothstep(0.18, 0.96, sampleRayDistance) * denseInteriorF;\n    let detailProxyMixF = max(min(thickDetailProxyF, 0.16) * (1.0 - straightThroughViewF * 0.78), farProxySafeF * mix_f(0.42, 0.24, definitionHold));\n    var det = mix_v3(detailRaw, detailProxy, min(detailProxyMixF, mix_f(0.72, 0.54, definitionHold)));\n\n    let detailMean = (det.r + det.g + det.b) * 0.3333333333;\n    let thickDetailFilterF = thickPerfF * smoothstep(0.12, 0.82, sampleRayDistance) * smoothstep(0.05, 0.32, densMacro) * mix_f(0.18, 0.08, definitionHold);\n    det = mix_v3(det, vec3<f32>(detailMean), max(thickDetailFilterF * (1.0 - straightThroughViewF * 0.72), farProxySafeF * mix_f(0.18, 0.08, definitionHold)));\n\n    var dens = densMacro;\n    if (!auroraLayerMode()) {\n      if (!macroOnly) {\n        dens = densityFromSamples(ph_coarse, wm_primary, s, det) * faceFade * nearDense * auroraMask;\n      } else {\n        let macroBodyF = smoothstep(0.10, 0.34, densMacro) * smoothstep(0.16, 0.84, ph_coarse);\n        dens = densMacro * mix_f(0.88, 1.02, macroBodyF);\n      }\n    }\n\n    let thickBodySmoothF = thickPerfF * smoothstep(0.10, 0.42, densMacro) * smoothstep(0.10, 0.90, sampleRayDistance) * mix_f(0.16, 0.08, max(definitionHold, sparseHold * 0.65));\n    dens = mix_f(dens, densMacro, thickBodySmoothF);\n\n    let farSilhouetteKeep = smoothstep(0.36, 1.0, screenFarF) * saturate(remap(densMacro, 0.025, 0.20, 0.0, 1.0));\n    dens = max(dens, densMacro * farSilhouetteKeep * 0.22);\n\n    let bodySmooth = smoothstep(0.08, 0.42, max(densMacro, prevMacroDens));\n    let raySmoothDensAdaptive = saturate(mix_f(TUNE.raySmoothDens * 0.18, TUNE.raySmoothDens, bodySmooth) * mix_f(1.0, 0.58, definitionHold));\n    let densSmoothed = mix_f(dens, prevDens, raySmoothDensAdaptive);\n    let densMacroSmoothed = mix_f(densMacro, prevMacroDens, saturate(raySmoothDensAdaptive * 0.90));\n    let denseInteriorStepF = thickPerfF * smoothstep(0.22, 0.62, densMacroSmoothed) * smoothstep(0.20, 0.90, sampleRayDistance);\n    let farProxyStepF = farProxySafeF * smoothstep(0.07, 0.28, densMacroSmoothed);\n    let weatherProxyStepF = usedWeatherProxy * smoothstep(0.06, 0.26, densMacroSmoothed);\n    var planetCardF = 0.0;\n    if (auroraLayerMode()) {\n      let relShellStep = p - B.center;\n      let shellNStep = normalizeOr(relShellStep, vec3<f32>(0.0, 1.0, 0.0));\n      let shellTangentF = 1.0 - smoothstep(0.055, 0.32, abs(dot(rayRd, shellNStep)));\n      let shellInteriorF = smoothstep(0.045, 0.24, ph_coarse) * (1.0 - smoothstep(0.76, 0.98, ph_coarse));\n      planetCardF = shellTangentF * shellInteriorF * 0.26;\n    }\n    let viewFrontOccF = frontOcclusionFactor(Tr, sampleRayDistance, effectiveNearFluffDist, densMacroSmoothed);\n    let shellFrontOccF = planetCardF * smoothstep(0.040, 0.20, densMacroSmoothed) * frontOcclusionStrength() * 0.58;\n    let frontOccF = cloudModeF32(viewFrontOccF, max(viewFrontOccF * 0.18, shellFrontOccF), max(viewFrontOccF * 0.18, shellFrontOccF));\n    let cloudApproachProtect = cloudModeF32(\n      0.0,\n      (1.0 - smoothstep(effectiveNearFluffDist * 1.10, effectiveNearFluffDist * 3.40, sampleRayDistance)) *\n        (1.0 - smoothstep(0.22, 0.74, max(farF, screenFarF))),\n      0.0\n    );\n    let adaptiveStepF = max(max(max(denseInteriorStepF, farProxyStepF * 0.72), weatherProxyStepF * 0.86), frontOccF) *\n      (1.0 - straightThroughViewF * 0.46) *\n      (1.0 - cloudApproachProtect * 0.88);\n    let occlusionStepBoost = max(1.0, TUNE.frontOcclusionStepBoost);\n    let stepBoostMax = max(max(1.0, TUNE.thickStepBoost * 0.88), occlusionStepBoost);\n    let stepBoost = mix_f(1.0, stepBoostMax, adaptiveStepF);\n    let occStepLimit = max(effectiveMaxStep, effectiveMaxStep * mix_f(1.0, occlusionStepBoost, frontOccF));\n    let auroraStepLimit = select(occStepLimit, max(occStepLimit, stepLen), auroraLayerMode());\n    let sampleStepLen = clamp(stepLen * stepBoost, TUNE.minStep, auroraStepLimit);\n\n    if (densSmoothed > 0.00008) {\n      if (auroraLayerMode()) {\n        let sampleOD = min(densSmoothed * sampleStepLen * VIEW_EXTINCTION_SCALE * 0.30, 0.075);\n        let absorb = exp(-sampleOD);\n        let alpha = 1.0 - absorb;\n        let auroraColor = auroraEmissionColor(p, ph_coarse, viewDir, sunDir, auroraMask);\n        rgb += Tr * auroraColor * alpha * 1.35;\n        Tr *= mix_f(1.0, absorb, 0.34);\n\n        runMeanL += luminance(auroraColor * alpha);\n        runN += 1.0;\n\n        if (Tr <= transmittanceCutoff()) {\n          Tr = 0.0;\n          break;\n        }\n        prevDens = densSmoothed;\n        prevMacroDens = densMacroSmoothed;\n        prevTsun = 1.0;\n        t = min(t + sampleStepLen, t1);\n        iter = iter + 1;\n        continue;\n      }\n\n      let localNoiseScreen = hash11Fast(\n        f32(fullPix.x) * 0.093427 +\n        f32(fullPix.y) * 0.047971 +\n        f32(iter) * 0.217873 +\n        rand0 * 23.731\n      );\n      var localNoise = localNoiseScreen;\n      if (sphericalCloudMode()) {\n        let localUvForNoise = shellUVFromWorld(p);\n        localNoise = shellHash(\n          localUvForNoise + vec2<f32>(f32(iter) * 0.0173 + rand0 * 0.047, f32(iter) * 0.0119),\n          auroraModeF32(256.0, 160.0)\n        );\n      }\n      let bnLocal = mix_f(rand0, localNoise, 0.12);\n      let shadowInteriorProbe = saturate(remap(densMacroSmoothed, 0.05, 0.32, 0.0, 1.0));\n      let proxyPerfF = max(farProxySafeF, saturate(remap(max(farF, screenFarF), 0.45, 0.95, 0.0, 1.0)));\n      let closeRayProtect = 1.0 - smoothstep(effectiveNearFluffDist * 1.00, effectiveNearFluffDist * 2.40, sampleRayDistance);\n      let silhouetteProtect = 1.0 - smoothstep(0.12, 0.34, densMacroSmoothed);\n      let lightingEdgeProtect = saturate(max(closeRayProtect * 0.90, silhouetteProtect * (1.0 - shadowInteriorProbe * 0.55)));\n      let thickLightF = thickPerfF * saturate(TUNE.thickLightSkip) * smoothstep(0.10, 0.72, sampleRayDistance);\n      let thickLightPerfF = thickLightF * (1.0 - lightingEdgeProtect);\n      let adaptiveStrideAdd = i32(floor(farF * 4.5 + screenFarF * 1.25 + shadowInteriorProbe * farF * 2.75 + proxyPerfF * 2.35 + thickLightPerfF * mix_f(1.2, 5.2, shadowInteriorProbe)));\n      let sunStrideSafe = max(TUNE.sunStride + adaptiveStrideAdd, 1);\n      if ((iter % sunStrideSafe) == 0) {\n        if (densMacroSmoothed * sampleStepLen > TUNE.sunDensityGate) {\n          let lowTransCut = select(0i, 1i, Tr < max(transmittanceCutoff() * 1.1, 0.01));\n          let cheapSun = (proxyPerfF > 0.68) && (shadowInteriorProbe < 0.16) && (sampleRayDistance > effectiveNearFluffDist * 1.40) && (lightingEdgeProtect < 0.14);\n          let localConeSun = (thickLightPerfF > 0.42 && shadowInteriorProbe > 0.24 && sampleRayDistance > effectiveNearFluffDist * 1.65 && (farF > 0.22 || Tr < 0.62) && lightingEdgeProtect < 0.18);\n          if (cheapSun || localConeSun) {\n            let coneOcc = densMacroSmoothed\n              * mix_f(0.90, 1.70, max(proxyPerfF, thickLightPerfF))\n              * mix_f(0.85, 1.55, shadowInteriorProbe);\n            Tsun_cached = exp(-coneOcc);\n          } else {\n            let sunStepsAdaptive = max(2, TUNE.sunSteps - i32(floor(farF * 3.0)) - i32(floor(shadowInteriorProbe * farF * 2.0)) - i32(floor(proxyPerfF * 2.0)) - i32(floor(thickLightPerfF * 2.0)) - lowTransCut);\n            let sunStepAdaptive = sunStepLen * mix_f(1.0, 1.55 + thickLightPerfF * 0.55, max(farF, proxyPerfF));\n            Tsun_cached = sunTransmittance(\n              p, sunDir, 0.0, lodShapeLighting, sunStepAdaptive,\n              wScale, sunStepsAdaptive,\n              fract(bnLocal + rand0 * 0.61803398875 + f32(iter) * 0.131)\n            );\n          }\n        } else {\n          Tsun_cached = 1.0;\n        }\n\n        let thickDenseFastLighting = thickLightPerfF > 0.30 && shadowInteriorProbe > 0.12 && lightingEdgeProtect < 0.20;\n        let fastLighting = (sunStrideSafe > TUNE.sunStride && lightingEdgeProtect < 0.22) || macroOnly || (farF > 0.34) || (proxyPerfF > 0.42) || thickDenseFastLighting;\n        let ultraFastLighting = fastLighting && (thickDenseFastLighting || ((thickLightPerfF > 0.38 && shadowInteriorProbe > 0.18) && lightingEdgeProtect < 0.14) || proxyPerfF > 0.70 || Tr < 0.48);\n        if (CLOUD_DETAILED_LIGHTING != 0u && !fastLighting && sunStrideSafe <= 1) {\n          shapeN_cached = approxShapeNormal(p, max(ph_coarse, 0.0), max(0.0, lodShapeLighting));\n        } else if (ultraFastLighting) {\n          shapeN_cached = approxShapeNormalFromChannels(s, p, max(ph_coarse, 0.0), sunDir, viewDir);\n        } else {\n          shapeN_cached = approxShapeNormalFast(p, max(ph_coarse, 0.0), max(0.0, lodShapeLighting + 0.45));\n        }\n\n        if (CLOUD_DETAILED_LIGHTING != 0u && !fastLighting && sunStrideSafe <= 1) {\n          let densityN = approxLightingNormal(\n            p,\n            0.0,\n            max(0.0, lodShapeLighting + 0.70),\n            max(0.0, lodDetailLighting + 1.35),\n            wScale\n          );\n          lightN_cached = normalize(mix_v3(shapeN_cached, densityN, mix_f(0.62, 0.22, shadowInteriorProbe)));\n          sunExposure_cached = directionalExposure(\n            p,\n            0.0,\n            max(0.0, lodShapeLighting + 0.55),\n            max(0.0, lodDetailLighting + 1.05),\n            sunDir,\n            wScale\n          );\n        } else {\n          let stableLightFallback = normalize(shapeN_cached + sunDir * 0.35 + viewDir * 0.10);\n          lightN_cached = normalize(mix_v3(shapeN_cached, stableLightFallback, 0.24 * shadowInteriorProbe + 0.10 * proxyPerfF));\n          sunExposure_cached = saturate(dot(lightN_cached, sunDir) * 0.72 + 0.28);\n        }\n\n        rim_cached = pow(1.0 - saturate(dot(lightN_cached, viewDir)), 1.7);\n\n        let sunFacing = saturate(dot(lightN_cached, sunDir));\n        sunSide_cached = sunFacing;\n        sunRim_cached = pow(1.0 - sunFacing, 1.30);\n\n        let upperRelative = saturate(dot(lightN_cached, normalize(sunDir * 0.75 + viewDir * 0.25)) * 0.5 + 0.5);\n        upperExposure_cached = smoothstep(0.36, 0.82, upperRelative);\n      }\n\n      let raySmoothSunAdaptive = saturate(mix_f(TUNE.raySmoothSun * 0.22, TUNE.raySmoothSun, bodySmooth) * mix_f(1.0, 0.45, lightingEdgeProtect));\n      let TsunSmoothed = mix_f(Tsun_cached, prevTsun, raySmoothSunAdaptive);\n      let shadowInterior = saturate(remap(densMacroSmoothed, 0.05, 0.32, 0.0, 1.0)) * (1.0 - saturate(TsunSmoothed * 1.35));\n      let bnScaled = mix_f(bnLocal, bnLocal * TUNE.bnFarScale, farF) * mix_f(1.0, 0.18, shadowInterior);\n\n      let rayProgress = saturate((sampleT - t0) / max(raySegmentLength, EPS));\n      let frontCardWindow = 1.0 - smoothstep(0.34, 0.70, rayProgress);\n      let frontCardDensity = smoothstep(0.012, 0.115, densMacroSmoothed) * (1.0 - smoothstep(0.58, 0.98, densMacroSmoothed));\n      let frontCardEdge = smoothstep(0.0008, 0.045, densSmoothed);\n      let viewFrontCardOcclusion = rayShallowF * frontCardWindow * frontCardDensity * frontCardEdge;\n      let shellFrontCardOcclusion = planetCardF * frontCardDensity * frontCardEdge * 0.46;\n      let frontCardOcclusion = cloudModeF32(viewFrontCardOcclusion, shellFrontCardOcclusion, shellFrontCardOcclusion);\n      let cardOcclusionStrength = 1.0 + frontCardOcclusion * mix_f(1.15, 2.65, saturate(TUNE.frontOcclusionStrength));\n      let cardMacroFill = max(densSmoothed, densMacroSmoothed * mix_f(0.72, 1.28, frontCardOcclusion));\n      let densForOpacity = mix_f(densSmoothed, cardMacroFill, frontCardOcclusion * 0.74);\n\n      let rawSampleODFine = densForOpacity * sampleStepLen * VIEW_EXTINCTION_SCALE * cardOcclusionStrength;\n      let rawSampleODMacro = densMacroSmoothed * sampleStepLen * VIEW_EXTINCTION_SCALE * mix_f(1.0, cardOcclusionStrength, frontCardOcclusion * 0.42);\n      let sampleOD = min(mix_f(rawSampleODFine, rawSampleODMacro, 0.58 * shadowInterior), max(C.attenuationClamp, 0.001));\n      let absorb = BeerLaw(sampleOD, C.cloudBeer);\n      let alpha = 1.0 - absorb;\n\n      let lightDensity = mix_f(densSmoothed, densMacroSmoothed, 0.82 * shadowInterior);\n      let rimEffective = rim_cached * mix_f(1.0, 0.20, shadowInterior);\n      let exposureEffective = sunExposure_cached * mix_f(1.0, 0.28, shadowInterior);\n      let sideEffective = mix_f(sunSide_cached, 0.62, 0.35 * shadowInterior);\n\n      var lightCol = CalculateLight(\n        lightDensity,\n        alpha,\n        TsunSmoothed,\n        cosVS,\n        ph_coarse,\n        bnScaled,\n        t - t0,\n        rimEffective,\n        sideEffective,\n        sunRim_cached,\n        Tr,\n        exposureEffective,\n        upperExposure_cached\n      );\n\n      if (sphericalCloudMode()) {\n        let relShell = p - B.center;\n        let shellN = normalizeOr(relShell, vec3<f32>(0.0, 1.0, 0.0));\n        let sunDotShell = dot(shellN, sunDir);\n        let spaceDay = smoothstep(-0.18, 0.42, sunDotShell);\n        let spaceTerminator = smoothstep(-0.30, 0.12, sunDotShell) * (1.0 - smoothstep(0.48, 0.92, sunDotShell));\n        let nightTint = C.shadowLightColor * 0.18;\n        let dayTint = C.frontLightColor * mix_f(0.82, 1.08, spaceDay);\n        lightCol *= mix_v3(nightTint, dayTint, spaceDay) * mix_f(0.18, 1.18, spaceDay);\n\n        let limbRim = pow(1.0 - saturate(dot(shellN, viewDir)), 2.75) * smoothstep(-0.12, 0.38, sunDotShell);\n        lightCol += C.sunColor * alpha * (limbRim * 0.12 + spaceTerminator * 0.035);\n\n        if (auroraLayerMode()) {\n          let nightBoost = 1.0 - smoothstep(-0.18, 0.42, sunDotShell);\n          let auroraPalette = auroraSpectralColor(p, ph_coarse);\n          let capPresence = mix_f(0.90, 1.32, auroraMask);\n          let evenEmission = auroraPalette * alpha * capPresence * mix_f(1.05, 2.00, nightBoost);\n          let darkSideBoost = auroraPalette * alpha * mix_f(0.16, 0.55, nightBoost);\n          let limbGlow = auroraPalette * alpha * pow(1.0 - saturate(dot(shellN, viewDir)), 1.90) * 0.18;\n          lightCol = evenEmission + darkSideBoost + limbGlow;\n        }\n      }\n\n      let frontCardBrightnessHold = 1.0 + frontCardOcclusion * 0.18 * (1.0 - shadowInterior * 0.55);\n      lightCol *= frontCardBrightnessHold;\n\n      let shadowLift = vec3<f32>(0.045, 0.050, 0.058) * shadowInterior;\n      lightCol = lightCol + shadowLift * alpha;\n\n      let lNow = luminance(lightCol);\n      let meanL = select(lNow, runMeanL / max(runN, 1.0), runN > 0.0);\n      let allow = max(meanL * (1.0 + TUNE.fflyRelClamp), TUNE.fflyAbsFloor);\n      if (!auroraLayerMode() && lNow > allow) { lightCol *= allow / max(lNow, 1e-6); }\n\n      if (auroraLayerMode()) {\n        let relShell2 = p - B.center;\n        let shellN2 = normalizeOr(relShell2, vec3<f32>(0.0, 1.0, 0.0));\n        let nightBoost2 = 1.0 - smoothstep(-0.18, 0.42, dot(shellN2, sunDir));\n        let auroraPalette2 = auroraSpectralColor(p, ph_coarse);\n        let emissiveFloor = auroraPalette2 * alpha * mix_f(0.85, 2.10, nightBoost2) * mix_f(0.80, 1.25, auroraMask);\n        lightCol = max(lightCol, emissiveFloor);\n      }\n\n      rgb += Tr * lightCol * alpha;\n      Tr *= absorb;\n\n      runMeanL += lNow;\n      runN += 1.0;\n\n      // Once the selected opacity cutoff is reached, force the result opaque\n      // and stop marching. This preserves the early-exit win without leaving\n      // dense clouds slightly see-through. Front-occlusion early exits use the\n      // same closure so the accelerated path also remains opaque.\n      if (Tr <= transmittanceCutoff()) {\n        Tr = 0.0;\n        break;\n      }\n      if (Tr <= frontOcclusionCutoff(frontOccF)) {\n        Tr = 0.0;\n        break;\n      }\n    }\n\n    prevDens = densSmoothed;\n    prevMacroDens = densMacroSmoothed;\n    prevTsun = Tsun_cached;\n\n    t = min(t + sampleStepLen, t1);\n    iter = iter + 1;\n  }\n\n  // compose\n  let aMarch = saturate(1.0 - Tr);\n  let alphaCutoff = clamp(TUNE.alphaCutoff, 0.0, 0.999);\n  let opaqueSoftLo = max(0.0, alphaCutoff - 0.10);\n  let opaqueClosure = smoothstep(opaqueSoftLo, alphaCutoff, aMarch);\n  let aRaw = mix_f(aMarch, min(1.0, aMarch + (1.0 - aMarch) * 0.82), opaqueClosure);\n  let surfaceOpacity = clamp(TUNE.outputAlphaFeather, 0.0, 1.0);\n  let surfaceGate =\n    smoothstep(0.055, 0.34, aRaw) *\n    (1.0 - smoothstep(0.76, 0.97, aRaw));\n  let surfaceCurve = mix_f(1.0, 0.50, surfaceOpacity);\n  let surfaceAlpha = saturate(pow(max(aRaw, 1e-5), surfaceCurve) * mix_f(1.0, 1.08, surfaceOpacity));\n  let aLifted = mix_f(aRaw, max(aRaw, surfaceAlpha), surfaceGate * surfaceOpacity);\n\n  let alphaBoostThreshold = clamp(TUNE.alphaBoostThreshold, 0.0, 0.995);\n  let alphaBoostAmount = max(TUNE.alphaBoostAmount, 0.0);\n  let alphaBoostRamp = select(\n    0.0,\n    saturate((aLifted - alphaBoostThreshold) / max(1.0 - alphaBoostThreshold, 1e-5)),\n    aLifted > alphaBoostThreshold\n  );\n  let aBoosted = min(1.0, aLifted + alphaBoostAmount * alphaBoostRamp);\n  let minOutputAlphaRaw = clamp(TUNE.minOutputAlpha, 0.0, 0.45);\n  let minOutputAlpha = min(minOutputAlphaRaw, auroraModeF32(0.45, 0.006));\n  let alphaGateWidth = max(minOutputAlpha * 2.25, auroraModeF32(0.030, 0.055));\n  let outputAlphaGate = select(\n    1.0,\n    smoothstep(minOutputAlpha, min(minOutputAlpha + alphaGateWidth, 1.0), aBoosted),\n    minOutputAlpha > 0.0001\n  );\n  let outputAlpha = aBoosted * outputAlphaGate;\n  let premulLift = mix_f(\n    1.0,\n    clamp(aBoosted / max(aRaw, 0.08), 1.0, 1.36),\n    surfaceOpacity * surfaceGate * 0.42\n  );\n  let outputRGB = rgb * outputAlphaGate * premulLift;\n\n  var newCol: vec4<f32>;\n  if (CLOUD_WRITE_RGB != 0u) {\n    newCol = vec4<f32>(outputRGB, outputAlpha);\n  } else {\n    if (opt.outputChannel == 0u) { newCol = vec4<f32>(outputAlpha, 0.0, 0.0, 1.0); }\n    else if (opt.outputChannel == 1u) { newCol = vec4<f32>(0.0, outputAlpha, 0.0, 1.0); }\n    else if (opt.outputChannel == 2u) { newCol = vec4<f32>(0.0, 0.0, outputAlpha, 1.0); }\n    else { newCol = vec4<f32>(0.0, 0.0, 0.0, outputAlpha); }\n  }\n\n  // Preserve compute output as premultiplied volumetric radiance.\n  // The preview pass composites this over the procedural sky.\n  // Alpha boost is applied only at the end so it does not feed back into\n  // march-time shadowing, transmission, or lighting.\n  newCol = vec4<f32>(max(newCol.rgb, vec3<f32>(0.0)), clamp(newCol.a, 0.0, 1.0));\n\n  storeLayerSample(pixI, newCol, rayFarHistoryF, temporalHistoryActive);\n}\n\n@compute @workgroup_size(8, 8, 1)\nfn computeCloudBox(\n  @builtin(global_invocation_id) gid_in: vec3<u32>,\n  @builtin(local_invocation_id) local_id: vec3<u32>\n) {\n  computeCloudCore(gid_in, local_id);\n}\n\n@compute @workgroup_size(8, 8, 1)\nfn computeCloudSphere(\n  @builtin(global_invocation_id) gid_in: vec3<u32>,\n  @builtin(local_invocation_id) local_id: vec3<u32>\n) {\n  computeCloudCore(gid_in, local_id);\n}\n";

  // tools/clouds/shaders/cloudResolve.wgsl
  var cloudResolve_default = "// Temporal resolve has its own pipeline. The regular raymarch writes f32\n// radiance into scratch so this split does not quantize before history blending.\nfn resolveCloudColor(pixI: vec2<i32>, newCol: vec4<f32>, rayFarHistoryF: f32, temporalHistoryActive: bool) {\n  // TAA with variance clamp\n  let temporalActive = reproj.temporalBlend > 0.0001;\n  if (temporalActive) {\n    let fullRes = vec2<f32>(f32(reproj.fullWidth), f32(reproj.fullHeight));\n    let uv_full = (vec2<f32>(fullPixFromCurrent(pixI)) + 0.5) / fullRes;\n\n    var motion = vec2<f32>(0.0, 0.0);\n    var prevUV = uv_full;\n    if (reproj.enabled == 1u) {\n      motion = textureSampleLevel(motionTex, samp2D, uv_full, 0.0).rg;\n      if (reproj.motionIsNormalized == 0u) { motion = motion / fullRes; }\n      prevUV = uv_full - motion;\n    }\n\n    if (prevUV.x < 0.0 || prevUV.y < 0.0 || prevUV.x > 1.0 || prevUV.y > 1.0) {\n      textureStore(outTex, pixI, frame.layerIndex, newCol);\n      store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);\n    } else {\n      let prevCol = textureSampleLevel(historyPrev, samp2D, prevUV, frame.layerIndex, 0.0);\n      if (reproj.frameIndex == 0u || prevCol.a < 1e-5) {\n        textureStore(outTex, pixI, frame.layerIndex, newCol);\n        store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);\n      } else {\n        let motionPix = motion * fullRes;\n        let motionMag = length(motionPix);\n        let alphaDiff = abs(prevCol.a - newCol.a);\n        let rgbDiff = length(prevCol.rgb - newCol.rgb);\n\n        var stability = exp(-motionMag * 0.9) * exp(-alphaDiff * 6.0) * exp(-rgbDiff * 3.5);\n        let bodyStable = smoothstep(0.38, 0.95, min(prevCol.a, newCol.a)) * exp(-motionMag * 0.35) * exp(-alphaDiff * 3.5);\n        let speckleStable = bodyStable * exp(-motionMag * 1.8) * (1.0 - smoothstep(0.02, 0.16, rgbDiff));\n        let convFrames = min(f32(reproj.frameIndex), 4.0);\n        let convWarm = saturate((convFrames - 1.0) / 3.0);\n        let staticConv = exp(-motionMag * 2.7) * exp(-alphaDiff * 9.0) * exp(-rgbDiff * 6.5);\n        let stableBody = smoothstep(0.50, 0.98, bodyStable);\n        let stableSpeckle = smoothstep(0.35, 0.96, speckleStable);\n        var tb = clamp(reproj.temporalBlend * stability, 0.0, 0.985);\n        tb *= mix_f(1.0, min(TUNE.farTaaHistoryBoost, 1.18), rayFarHistoryF);\n        tb = clamp(tb * mix_f(1.0, 1.34, bodyStable), 0.0, 0.993);\n        tb = max(tb, 0.76 * speckleStable);\n        let fastConvLo = mix_f(0.62, 0.76, stableBody);\n        let fastConvHi = mix_f(0.84, 0.94, max(stableBody, stableSpeckle));\n        let fastConvFloor = mix_f(fastConvLo, fastConvHi, convWarm) * staticConv;\n        tb = max(tb, fastConvFloor * mix_f(1.0, 1.08, rayFarHistoryF));\n        tb = max(tb, 0.62 * stableBody * convWarm);\n        tb = max(tb, 0.74 * stableSpeckle * convWarm);\n        tb = clamp(tb, 0.0, 0.94);\n\n        if (reproj.enabled == 1u && reproj.depthTest == 1u) {\n          let prevDepth = textureSampleLevel(depthPrev, samp2D, prevUV, 0.0).r;\n          tb *= select(1.0 - saturate(reproj.depthTolerance), 0.25, prevDepth < 1e-6 || prevDepth > 1.0);\n        }\n\n        let relBase = mix_f(TUNE.taaRelMax, TUNE.taaRelMin, saturate(stability));\n        let relBody = mix_f(relBase, max(TUNE.taaRelMin * 0.95, 0.070), stableBody);\n        let rel = relBody * mix_f(1.0, 0.92, rayFarHistoryF);\n\n        let newLum = luminance(newCol.rgb);\n        let prevLum = luminance(prevCol.rgb);\n        let currentIsBrighter = smoothstep(0.010, 0.160, newLum - prevLum) * smoothstep(0.08, 0.80, newCol.a);\n        let currentIsDarker = smoothstep(0.020, 0.180, prevLum - newLum) * smoothstep(0.08, 0.80, newCol.a);\n\n        let histMinLum = newLum * mix_f(0.52, 0.86, stableBody) * currentIsBrighter;\n        let histLift = max(prevLum, histMinLum) / max(prevLum, 1e-5);\n        let liftedPrevRGB = prevCol.rgb * mix_f(1.0, histLift, currentIsBrighter);\n        let prevClampedRGB = clamp_luma_to(liftedPrevRGB, newCol.rgb, rel, max(TUNE.taaAbsEps, 0.035));\n\n        var tbSafe = tb;\n        tbSafe *= mix_f(1.0, 0.42, currentIsBrighter);\n        tbSafe *= mix_f(1.0, 0.72, currentIsDarker);\n        tbSafe = min(tbSafe, mix_f(0.78, 0.46, currentIsBrighter));\n        tbSafe = min(tbSafe, mix_f(0.88, 0.58, currentIsDarker));\n        let auroraHistoryFloor = auroraModeF32(0.0, 0.18 * stableBody * convWarm);\n        tbSafe = max(tbSafe, auroraHistoryFloor);\n        let historyMaxLo = auroraModeF32(0.90, 0.42);\n        let historyMaxHi = auroraModeF32(0.985, 0.64);\n        tbSafe = min(tbSafe, mix_f(historyMaxLo, historyMaxHi, stableBody));\n\n        let historyAlphaWindow = auroraModeF32(0.12, 0.08);\n        let historyA = clamp(prevCol.a, newCol.a - historyAlphaWindow, newCol.a + historyAlphaWindow);\n        let historyCol = vec4<f32>(prevClampedRGB, historyA);\n        let blended = mix_v4(newCol, historyCol, tbSafe);\n        textureStore(outTex, pixI, frame.layerIndex, blended);\n        store_history_full_res_if_owner(pixI, frame.layerIndex, blended);\n      }\n    }\n  } else {\n    textureStore(outTex, pixI, frame.layerIndex, newCol);\n    if (temporalHistoryActive) {\n      store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);\n    }\n  }\n}\n\n@compute @workgroup_size(8, 8, 1)\nfn resolveCloudFlat(@builtin(global_invocation_id) gid: vec3<u32>) {\n  var pixI = vec2<i32>(gid.xy) + vec2<i32>(frame.originX, frame.originY);\n  if (reproj.compactInterleave != 0u && temporalCellRateNormalized() > 1u && reproj.frameIndex > 0u) {\n    let mapped = compactTemporalPixel(gid.xy, temporalCellRateNormalized());\n    if (mapped.z == 0u) { return; }\n    pixI = vec2<i32>(mapped.xy);\n  }\n  if (any(pixI < vec2<i32>(0)) || any(pixI >= vec2<i32>(i32(frame.fullWidth), i32(frame.fullHeight)))) { return; }\n  let index = (u32(frame.layerIndex) * frame.fullHeight + u32(pixI.y)) * frame.fullWidth + u32(pixI.x);\n  let sample = cloudResolveSamples[index];\n  if (sample.valid == 0u) { return; } // Misses already wrote transparent output/history.\n  let historyActive = reproj.enabled == 1u || temporalCellRateNormalized() > 1u || reproj.temporalBlend > 0.0001;\n  resolveCloudColor(pixI, sample.color, sample.farHistory, historyActive);\n}\n";

  // tools/clouds/shaders/cloudScratch.wgsl
  var cloudScratch_default = "// Shared f32 storage between raymarch and temporal resolve (32 bytes/pixel).\nstruct CloudResolveSample {\n  color: vec4<f32>,\n  farHistory: f32,\n  valid: u32,\n  _pad: vec2<u32>,\n};\n@group(2) @binding(0) var<storage, read_write> cloudResolveSamples: array<CloudResolveSample>;\n";

  // tools/clouds/shaders/cloudRayOutput.wgsl
  var cloudRayOutput_default = "// The staged raymarch module contains no temporal blending call graph.\nfn beginLayerSample(pix: vec2<i32>) {\n  let index = (u32(frame.layerIndex) * frame.fullHeight + u32(pix.y)) * frame.fullWidth + u32(pix.x);\n  cloudResolveSamples[index].valid = 0u;\n}\nfn storeLayerSample(pix: vec2<i32>, color: vec4<f32>, farHistory: f32, historyActive: bool) {\n  let index = (u32(frame.layerIndex) * frame.fullHeight + u32(pix.y)) * frame.fullWidth + u32(pix.x);\n  cloudResolveSamples[index].color = color;\n  cloudResolveSamples[index].farHistory = farHistory;\n  cloudResolveSamples[index].valid = 1u;\n}\n";

  // tools/clouds/shaders/cloudFields.wgsl
  var cloudFields_default = "// Flat-volume fields are shared between independent compute entrypoints. Density\n// is regenerated for scene/noise changes; lighting for density or sun changes.\nstruct CloudFieldParams {\n  gridMin: vec4<f32>, // xyz bounds, w rain-shelf weight\n  gridSize: vec4<f32>, // xyz extent, w stratus-deck weight\n  dimensions: vec4<u32>,\n  volume: vec4<f32>, // mask kind, rotation, major radius, tube radius / box wisp weight\n  morphology: vec4<f32>, // cirrus, Kelvin-Helmholtz/fluctus, asperitas, reserved\n};\n@group(2) @binding(1) var cloudDensityField: texture_3d<f32>;\n@group(2) @binding(2) var cloudLightField: texture_3d<f32>;\n@group(2) @binding(3) var cloudFieldSampler: sampler;\n@group(2) @binding(4) var<uniform> FIELD: CloudFieldParams;\n@group(2) @binding(5) var cloudDensityOut: texture_storage_3d<rgba16float, write>;\n@group(2) @binding(6) var cloudLightOut: texture_storage_3d<rgba16float, write>;\n\nfn cloudFieldUV(p: vec3<f32>) -> vec3<f32> {\n  return (p - FIELD.gridMin.xyz) / max(FIELD.gridSize.xyz, vec3<f32>(EPS));\n}\nfn fieldSampleAt(p: vec3<f32>) -> vec4<f32> {\n  let uv = cloudFieldUV(p);\n  if (any(uv < vec3<f32>(0.0)) || any(uv > vec3<f32>(1.0))) { return vec4<f32>(0.0, 0.0, 0.0, -0.15); }\n  return textureSampleLevel(cloudDensityField, cloudFieldSampler, uv, 0.0);\n}\nfn fieldDensityAt(p: vec3<f32>) -> vec2<f32> {\n  return fieldSampleAt(p).rg;\n}\nfn cloudCellRandom(cell: vec2<f32>, offset: f32) -> f32 {\n  return hash11Fast(dot(cell, vec2<f32>(127.1, 311.7)) + offset);\n}\nfn cloudEllipsoid(p: vec3<f32>, center: vec3<f32>, radius: vec3<f32>) -> f32 {\n  return 1.0 - length((p - center) / max(radius, vec3<f32>(0.01)));\n}\n\nfn cloudSoftUnion(a: f32, b: f32) -> f32 {\n  let h = max(0.26 - abs(a - b), 0.0) / 0.26;\n  return max(a, b) + h * h * 0.065;\n}\n\n// Return fine density, macro density and signed form independently. Coverage\n// activates growing billows from the base upward, never rescales tower height.\n// Cell identity, weather and shape noise travel together with horizontal wind.\n// Only the rounded presets use this field; the original layer is untouched.\nfn roundedCloudBody(p: vec3<f32>, shape: vec4<f32>, detail: vec3<f32>) -> vec3<f32> {\n  let cellSize = max(TUNE.puffScale, 0.75);\n  let windOffset = NTransform.shapeOffsetWorld.xz;\n  let cell = floor((p.xz + windOffset) / cellSize);\n  let stormSystem = TUNE.formType >= 2.5;\n  let layerHeight = FIELD.gridSize.y;\n  var body = -1.0;\n  var fine = 0.0;\n  var macroAmount = 0.0;\n  // Rain Shelf's useful structure comes from remapping the base against its\n  // other three shape bands, not from adding noise to a filled primitive's skin.\n  // Keep that small density closure in this entrypoint, outside the cell loop;\n  // do not pull the legacy ray/light call graph into the field compiler.\n  let definition = cloudDefinition01();\n  let fbm = dot(shape.gba, vec3<f32>(0.625, 0.25, 0.125));\n  let baseShape = contrast01(shape.r, 1.24 + definition * 0.38);\n  let shelfShape = saturate((baseShape - fbm * 0.72) / max(1.0 - fbm * 0.72, 0.08));\n  let detailMid = dot(detail, vec3<f32>(0.42, 0.34, 0.24));\n  let scallopSignal = mix_f(max(max(detail.r, detail.g), detail.b),\n    1.0 - min(min(detail.r, detail.g), detail.b), 0.42);\n  let valley = pow(1.0 - ridge01(contrast01(scallopSignal, 2.4)), 1.35);\n  // Noise shapes the entire volume, but fine erosion must not turn a mature\n  // thunderhead into disconnected translucent vapor. A noisy interior support\n  // below preserves bulk while the same breakup still defines its outer folds.\n  let structure = (shelfShape - 0.22) * 0.55 + (fbm - 0.5) * 0.20;\n  let erosion = (detailMid * 0.10 + valley * mix_f(0.08, 0.18, definition));\n  for (var z = -1; z <= 1; z++) {\n    for (var x = -1; x <= 1; x++) {\n      let id = cell + vec2<f32>(f32(x), f32(z));\n      let r0 = cloudCellRandom(id, 3.1);\n      let r1 = cloudCellRandom(id, 17.3);\n      let r2 = cloudCellRandom(id, 41.7);\n      let materialCenterXZ = (id + 0.5 + (vec2<f32>(r0, r1) - 0.5) * 0.42) * cellSize;\n      let centerXZ = materialCenterXZ - windOffset;\n      let weatherScale = select(NTransform.weatherScale, 1.0, NTransform.weatherScale == 0.0);\n      // Sample weather in the co-moving domain, not underneath a stationary\n      // lattice. Its separate slow offset can evolve cells without wind itself\n      // pumping their height. Anatomy is selected independently below.\n      let weather = wrap2D(weather2D, samp2D, weatherUV_from(vec3<f32>(materialCenterXZ.x, B.center.y, materialCenterXZ.y), weatherScale), 0i, 0.0);\n      // A storm scene is a population, not a wall of identical thunderheads.\n      // Stable material-cell identity selects scattered convective storms;\n      // the remaining cells form lower fair-weather cumulus in the same box.\n      // Selection travels with wind and does not toggle as weather evolves.\n      // Never compare the identity seed with moving weather: that replaced\n      // small cumulus with a full thunderhead in one frame at the threshold.\n      // Weather controls continuous development, not this cell's anatomy.\n      let stormCell = cloudCellRandom(id, 237.9) < 0.27;\n      let anvil = select(C.cloudAnvilAmount > 0.65, stormCell, stormSystem);\n      let convective = anvil || (TUNE.formType >= 1.5 && TUNE.formType < 2.5);\n      // Material-cell variation survives wind and weather transitions. Rotate\n      // the anatomy, not the noise, so adjacent storms have different outflow\n      // directions without seams or another texture lookup per lobe.\n      let variant = cloudCellRandom(id, 312.7);\n      // Independent width seed: broad storms need not share noise/lean variants.\n      // 30% have a full broad base; another 28% span intermediate widths.\n      let widthVariant = cloudCellRandom(id, 383.1);\n      let broadBase = select(0.0, 1.0 - smoothstep(0.30,0.58,widthVariant), convective);\n      let aspect = select(1.0, mix_f(0.85, 1.15, variant), convective);\n      let turn = cloudCellRandom(id, 329.1) * 6.283185;\n      let cs = cos(turn); let sn = sin(turn);\n      let relative = p.xz - centerXZ;\n      let anatomyP = select(p, vec3<f32>(centerXZ.x + (relative.x * cs + relative.y * sn) / aspect,\n        p.y, centerXZ.y + (-relative.x * sn + relative.y * cs) * aspect), convective);\n      let shear = select(vec2<f32>(0.0), (vec2<f32>(r1, variant) - 0.5) * cellSize * mix_f(0.29, 0.40, r0) * 0.30, convective);\n      let cellBands = mix(shape.gba, shape.abg, select(0.0, variant, convective));\n      let cellFbm = dot(cellBands, vec3<f32>(0.625, 0.25, 0.125));\n      let cellBase = contrast01(mix_f(shape.r, shape.g, select(0.0, variant * 0.22, convective)), 1.24 + definition * 0.38);\n      let cellShelf = saturate((cellBase - cellFbm * 0.72) / max(1.0 - cellFbm * 0.72, 0.08));\n      let cellStructure = select(structure, (cellShelf - 0.22) * mix_f(0.49, 0.67, variant) + (cellFbm - 0.5) * 0.20, convective);\n      let coverage = clamp(C.globalCoverage * mix_f(0.78, 1.0, saturate(weather.r)) * mix_f(1.0, 0.72, saturate(TUNE.sparsity)), 0.0, 1.0);\n      let weatherMaturity = smoothstep(r2 - 0.38, r2 + 0.38, coverage);\n      // Cycle storms develop upper billows, never stretch the whole column.\n      let stormDevelopment = smoothstep(0.08, 1.0, C.cloudAnvilAmount);\n      let maturity = select(weatherMaturity, mix_f(min(weatherMaturity, 0.28), weatherMaturity, stormDevelopment), TUNE.formType > 3.5 && stormCell);\n      // Include noisy/scalloped lobes in the neighborhood bound, not just the\n      // hidden ellipsoids. With center jitter <= .21 cells, this 1.28-cell\n      // support ends before a center can drop out of the 3x3 search (.21+1.28<1.5).\n      let footprintFade = select(1.0, 1.0 - smoothstep(cellSize * 1.12, cellSize * 1.28,\n        max(abs(relative.x),abs(relative.y))), convective);\n      let presence = maturity * footprintFade * smoothstep(0.0, 0.12, C.globalCoverage) * (1.0 - smoothstep(0.85, 1.0, weather.b));\n      if (presence <= 0.00001) { continue; }\n      let heightVariation = clamp(TUNE.towerHeightVariation, 0.0, 0.9);\n      let heightFraction = mix_f(0.93, 0.93 - heightVariation, r1);\n      // Weather-organized storm families share feeder banks, not a regiment of\n      // equally tall stalks. Cell-local height/width remain stable under wind.\n      let stormHeight = mix_f(0.52, 1.0, cloudCellRandom(id, 347.3));\n      let columnHeight = layerHeight * heightFraction * select(1.0, stormHeight, anvil) * mix_f(1.0, 0.85, broadBase)\n        * select(1.0, mix_f(0.22, 0.54, r0), stormSystem && !stormCell);\n      let base = FIELD.gridMin.y + layerHeight * 0.07;\n      let radiusXZ = cellSize * mix_f(0.29, select(0.43, 0.40, anvil), r0)\n        * select(1.0, mix_f(0.68, 1.35, cloudCellRandom(id, 361.7)), convective);\n      // The existing per-voxel edge fade lets drifting cells enter/leave the\n      // volume smoothly. Rejecting whole centers here would make them pop.\n      let coreGrowth = max(0.03, sqrt(smoothstep(0.0, 0.65, maturity)));\n      let coreRadiusY = min(columnHeight * 0.22, radiusXZ * mix_f(0.80,0.66,broadBase));\n      let coreY = base + coreRadiusY * coreGrowth;\n      let coreCenter = vec3<f32>(centerXZ.x, coreY, centerXZ.y);\n      // No clamped-Y extrusion: that made a dense straight stalk beneath a cap.\n      // Base breadth is independent of the crown: broad storm decks feed a\n      // rising neck alongside slimmer columns, rather than scaling an entire\n      // cloud up/down. Broad footprints remain inside the 3x3 cell search.\n      var localBody = cloudEllipsoid(anatomyP, coreCenter, vec3<f32>(radiusXZ * mix_f(1.14,1.95,broadBase), coreRadiusY, radiusXZ * mix_f(0.98,1.75,broadBase)) * coreGrowth);\n      var localForm = localBody;\n      // Three staggered tiers of billows wrap the whole body, including its\n      // underside. The wide lower shoulders connect to the upper cauliflower.\n      for (var lobe = 0; lobe < 9; lobe++) {\n        let seed = f32(lobe) * 19.71 + 63.2;\n        let a = cloudCellRandom(id, seed);\n        let b = cloudCellRandom(id, seed + 7.9);\n        let tier = f32(lobe / 3);\n        let lobeAge = smoothstep(tier * 0.14, tier * 0.14 + 0.70, maturity);\n        if (lobeAge <= 0.00001) { continue; }\n        let puffGrowth = sqrt(lobeAge);\n        let angle = f32(lobe % 3) * 2.0944 + tier * 1.12 + r0 * 6.28318;\n        // Roll out of the connected parent mass, rather than materializing a\n        // little sphere at its final detached position and expanding there.\n        let lean = (vec2<f32>(r1, r2) - 0.5) * radiusXZ * tier * 0.65 + shear * tier;\n        let offset = (vec2<f32>(cos(angle), sin(angle)) * radiusXZ * mix_f(0.52, 0.78, a) + lean) * puffGrowth;\n        let lowerShoulder = 1.0 + broadBase * (1.0 - saturate(tier)) * 0.32;\n        let fullHeadRadius = radiusXZ * mix_f(0.58, 0.82, b) * clamp(TUNE.fluffFactor / 4.0, 0.85, 1.15) * select(1.0, 0.86, anvil) * lowerShoulder;\n        let headRadius = fullHeadRadius * puffGrowth;\n        // Storm billows feed the canopy from below instead of growing rounded\n        // turrets through it and hiding its flattened, spreading silhouette.\n        let headY = base + columnHeight * (0.20 + tier * select(0.24, 0.215, anvil) + (a - 0.5) * 0.12);\n        let fullRadiusY = min(fullHeadRadius * mix_f(0.94, 1.18, a), columnHeight * select(0.24, 0.16, anvil));\n        let parentLift = fullRadiusY + columnHeight * 0.10 * tier;\n        let head = vec3<f32>(centerXZ.x + offset.x, headY - parentLift * (1.0 - puffGrowth), centerXZ.y + offset.y);\n        let radiusY = fullRadiusY * puffGrowth;\n        // Newly born billows must gain density as well as radius; otherwise a\n        // sub-voxel puff immediately has a fully opaque core and appears to pop.\n        let lobeDensityLimit = mix_f(-0.12, 0.40, lobeAge);\n        let lobeAspect = select(1.0, mix_f(0.74, 1.25, a), convective);\n        let headForm = cloudEllipsoid(anatomyP, head, vec3<f32>(headRadius * lobeAspect, radiusY * select(1.0, mix_f(0.85, 1.18, b), convective), headRadius / lobeAspect));\n        localForm = cloudSoftUnion(localForm, headForm);\n        localBody = cloudSoftUnion(localBody, min(headForm, lobeDensityLimit));\n        // Smaller attached buds give the large shoulders a cauliflower outline.\n        // Their minimum radius stays above the field's horizontal texel size.\n        let budRadius = max(fullHeadRadius * 0.55, min(FIELD.gridSize.x / f32(FIELD.dimensions.x) * 1.35, fullHeadRadius * 0.68)) * puffGrowth;\n        let bud = head + vec3<f32>(offset.x * 0.24, radiusY * select(0.58, 0.35, anvil), offset.y * 0.24);\n        let budForm = cloudEllipsoid(anatomyP, bud, vec3<f32>(budRadius, min(budRadius, columnHeight * select(0.17, 0.10, anvil) * puffGrowth), budRadius));\n        localForm = cloudSoftUnion(localForm, budForm);\n        localBody = cloudSoftUnion(localBody, min(budForm, lobeDensityLimit));\n      }\n      if (anvil && maturity > 0.40) {\n        // The old late onset left most weather cells with only tiny caps. They\n        // could never outspread the lower billows, even at the Anvil preset.\n        let capGrowth = sqrt(smoothstep(0.40, 0.84, maturity));\n        let capDensityLimit = mix_f(-0.12, 0.40, capGrowth * capGrowth);\n        let spread = clamp(C.cloudAnvilAmount * max(TUNE.anvilLift, 0.0) / 0.60, 0.0, 1.5);\n        let shoulder = vec3<f32>(centerXZ.x + radiusXZ * 0.15 + shear.x * 1.7, base + columnHeight * 0.72, centerXZ.y + shear.y * 1.7);\n        let shoulderForm = cloudEllipsoid(anatomyP, shoulder, vec3<f32>(radiusXZ * 1.12, columnHeight * 0.16, radiusXZ * 1.08) * capGrowth);\n        localForm = cloudSoftUnion(localForm, shoulderForm);\n        localBody = cloudSoftUnion(localBody, min(shoulderForm, capDensityLimit));\n        // A connected wind-spread fan, not one smooth UFO-shaped disk. Slightly\n        // staggered lobes retain a broken edge as the cap spreads downwind.\n        for (var fan = 0; fan < 5; fan++) {\n          let f = f32(fan) / 4.0;\n          let jitter = cloudCellRandom(id, 181.0 + f32(fan) * 7.3);\n          // Broad and shallow at a common outflow level, with an asymmetric\n          // downwind reach. Same noise closure/erosion as the body preserves\n          // breakup throughout the canopy rather than adding a smooth disk.\n          // Bound the footprint to the existing 3x3 neighborhood: no extra\n          // field probes, loop iterations or raymarch work are introduced.\n          let lateralSpread = saturate(spread / 1.15);\n          let capCenter = vec3<f32>(centerXZ.x + shear.x * 1.7 + radiusXZ * mix_f(-0.55, mix_f(0.55, 0.85, variant), f) * lateralSpread,\n            base + columnHeight * (mix_f(0.83, 0.87, variant) + (jitter - 0.5) * 0.045),\n            centerXZ.y + shear.y * 1.7 + radiusXZ * (jitter - 0.5) * 0.42 * lateralSpread);\n          let capRadius = vec3<f32>(radiusXZ * mix_f(0.55, mix_f(1.20, 1.60, f), lateralSpread),\n            columnHeight * mix_f(0.095, 0.065, f) * mix_f(0.72, 1.34, r2), radiusXZ * mix_f(0.55, mix_f(1.30, 1.60, f), lateralSpread));\n          let capForm = cloudEllipsoid(anatomyP, capCenter, capRadius * capGrowth);\n          localForm = cloudSoftUnion(localForm, capForm);\n          localBody = cloudSoftUnion(localBody, min(capForm, capDensityLimit));\n        }\n      }\n      let macroSigned = localBody * 0.85 + cellStructure;\n      let fineSigned = macroSigned - erosion;\n      // Only developed, embedded material gets support. It follows the noisy\n      // body and young-billow density limit, not a filled hidden ellipsoid;\n      // growing lobes/edges remain tenuous and coverage zero stays empty.\n      let interior = smoothstep(0.04, 0.42, localBody + cellStructure * 0.40 - erosion * 0.20)\n        * smoothstep(0.20, 1.00, maturity);\n      // Optical thickness belongs in the interior, not an image-space alpha\n      // boost that would also turn faint edges and newborn puffs into cards.\n      let coreDensity = interior * 2.0;\n      let fineDensity = max(smoothstep(-0.025, 0.24, fineSigned), coreDensity);\n      let macroDensity = max(smoothstep(-0.025, 0.24, macroSigned), coreDensity);\n      let volumeVariation = mix_f(0.65, 1.0, shelfShape);\n      fine = max(fine, presence * fineDensity * volumeVariation);\n      macroAmount = max(macroAmount, presence * macroDensity * volumeVariation);\n      // Opacity limits for young puffs must not flatten their shading normals.\n      // Lighting follows the same noise-defined folds as density, not the\n      // hidden ellipsoids. Preserve the unsaturated signed field for gradients.\n      // Retain noisy folds without letting the smallest erosion valleys dominate\n      // every lighting normal. Density/breakup is unchanged; broad shoulders\n      // should carry coherent light and shade underneath the finer texture.\n      body = max(body, localForm * 0.85 + cellStructure * 0.65 - erosion * 0.35 - (1.0 - presence) * 0.45);\n    }\n  }\n  if (stormSystem) {\n    // Broken, low feeder banks link some towers into larger storm complexes.\n    // Already sampled shape bands supply the organization; no extra reads or\n    // larger neighborhood are needed. Sparse coverage still opens real gaps.\n    let center = FIELD.gridMin.y + layerHeight * (0.13 + fbm * 0.065);\n    let band = 1.0 - abs(p.y-center) / max(layerHeight * 0.12, 0.30);\n    let connected = min(band, shelfShape * 0.72 + fbm * 0.28 - mix_f(0.85, 0.34, saturate(C.globalCoverage)));\n    let bank = smoothstep(-0.035, 0.22, connected - erosion * 0.45) * smoothstep(0.0, 0.12, C.globalCoverage);\n    fine = max(fine, bank * 0.72);\n    macroAmount = max(macroAmount, bank * 0.82);\n    body = max(body, connected - erosion * 0.35);\n  }\n  return vec3<f32>(fine, macroAmount, body);\n}\n\n// Rare cloud features use analytic, co-moving scaffolds plus the same baked\n// bands. These are cached volume fields, never extra procedural work per ray.\n// Return fine/macro density and an unsaturated surface for lighting gradients.\nfn featureWeatherBody(p: vec3<f32>, shape: vec4<f32>, detail: vec3<f32>, weights: vec3<f32>) -> vec3<f32> {\n  let material = p + NTransform.shapeOffsetWorld;\n  let u = dot(material.xz, vec2<f32>(0.94, 0.342));\n  let v = dot(material.xz, vec2<f32>(-0.342, 0.94));\n  let base = FIELD.gridMin.y;\n  let height = FIELD.gridSize.y;\n  let spacingY = height / f32(FIELD.dimensions.y);\n  let coverage = saturate(C.globalCoverage);\n  let weatherScale = select(NTransform.weatherScale, 1.0, NTransform.weatherScale == 0.0);\n  let weather = wrap2D(weather2D, samp2D, weatherUV_from(material, weatherScale), 0i, 0.0);\n  let presence = smoothstep(0.0, 0.12, coverage) * (1.0 - smoothstep(0.85, 1.0, weather.b));\n  let grain = dot(detail, vec3<f32>(0.42, 0.34, 0.24));\n  var density = 0.0;\n  var macroDensity = 0.0;\n  var signed = -1.0;\n  if (weights.x > 0.0) {\n    // Long feathered ice streaks: slow bends along wind, finer cross-wind\n    // filaments. No vertical squash or sub-voxel transparent sheet.\n    let feather = sin(v * 1.65 + sin(u * 0.28 + shape.g * 2.0) * 1.5 + (shape.g - 0.5) * 2.4);\n    let fibers = pow(0.5 + feather * 0.5, 3.0);\n    let streakMask = shape.r * 0.55 + shape.b * 0.45;\n    let fragments = smoothstep(0.20, 0.68, streakMask + sin(u * 0.19 + v * 0.13) * 0.16);\n    let center = base + height * 0.80 + sin(u * 0.17 + v * 0.08) * 0.32 + (shape.a - 0.5) * 0.30;\n    let band = 1.0 - abs(p.y - center) / max(spacingY * 1.75, 0.30);\n    let form = min(band, fibers * 0.75 + streakMask * 0.45 - mix_f(0.82, 0.39, coverage));\n    density += weights.x * smoothstep(-0.055, 0.23, form - grain * 0.035) * fragments * 0.30;\n    macroDensity += weights.x * smoothstep(-0.055, 0.23, form) * fragments * 0.30;\n    signed = max(signed, form - (1.0 - weights.x) * 0.35);\n  }\n  if (weights.y > 0.0) {\n    // Curled wave crests above a thin bank, not sine-wave hills. A clipped\n    // annular cross-section leaves the hook open on its downwind underside;\n    // its leaning root remains attached to the parent layer.\n    let width = max(TUNE.puffScale, 3.6);\n    let phase = u + sin(v * 0.21) * 0.65 + (shape.g - 0.5) * 0.45;\n    let waveId = floor(phase / width);\n    // Stable but independently evolving rolls, not repeated identical hooks.\n    // The support ends before the cell boundary, so irregular spacing does not\n    // introduce seams. Existing volume bands shear/break their whole surface.\n    let seed = cloudCellRandom(vec2<f32>(waveId, 0.0), 419.7);\n    let lean = cloudCellRandom(vec2<f32>(waveId, 0.0), 431.3);\n    let x = (fract(phase / width) - 0.5 + (lean - 0.5) * 0.22) * width;\n    let radius = width * (mix_f(0.12, 0.245, seed) + shape.g * 0.018 + 0.015 * sin(v * 0.27));\n    let floorY = base + height * 0.44 + sin(v * 0.34) * 0.20 + sin(u * 0.22 + v * 0.16) * 0.28;\n    let roughQ = vec2<f32>(x + (shape.g - 0.5) * width * 0.13, p.y - floorY - radius + (shape.b - 0.5) * width * 0.10);\n    let turn = (lean - 0.5) * 0.90;\n    let q = vec2<f32>(cos(turn)*roughQ.x+sin(turn)*roughQ.y,-sin(turn)*roughQ.x+cos(turn)*roughQ.y);\n    let thickness = max(spacingY * 1.6, width * mix_f(0.038, 0.063, lean));\n    let curlRadius = radius * (1.0 + sin(atan2(q.y,q.x)*2.0 + seed*6.283185) * 0.16);\n    let ring = (thickness - abs(length(q) - curlRadius)) / thickness;\n    let openHook = min(ring, max(-q.x - radius * mix_f(0.02,0.28,seed), q.y + radius * mix_f(0.10,0.42,lean)) / thickness);\n    let root = min(1.0 - abs(x + radius - clamp(p.y - floorY, 0.0, radius) * 0.15) / thickness,\n      min((p.y - floorY + thickness) / thickness, (floorY + radius - p.y) / thickness));\n    let bank = (1.0 - abs(p.y - floorY - (shape.g-0.5)*0.65) / max(thickness * 0.85, spacingY * 1.6))\n      - smoothstep(0.36,0.67,shape.b)*0.60;\n    let row = smoothstep(0.22, 0.72, 0.5 + sin(v * 0.38 + shape.b * 1.45) * 0.5);\n    let form = min(max(max(openHook, root), bank * 0.42), row * 1.1 - mix_f(0.90, 0.20, coverage));\n    let eroded = form + (shape.r - 0.5) * 0.42 - (grain - 0.35) * 0.26 - (shape.a - 0.5) * 0.16;\n    density += weights.y * smoothstep(-0.055, 0.30, eroded) * 0.60;\n    macroDensity += weights.y * smoothstep(-0.055, 0.30, form) * 0.60;\n    signed = max(signed, eroded - (1.0 - weights.y) * 0.35);\n  }\n  if (weights.z > 0.0) {\n    // Asperitas is a connected turbulent underside, with differently directed\n    // waves and deep irregular troughs, rather than an array of hanging balls.\n    let waveA = sin(u * 0.58 + sin(v * 0.23) * 1.4 + shape.g * 0.8);\n    let waveB = sin(v * 0.82 + sin(u * 0.31) * 0.85 + shape.b * 0.9);\n    let trough = pow(0.5 + 0.5 * sin(u * 0.82 + v * 0.41 + shape.a), 3.0);\n    let underside = base + height * 0.42 + waveA * 0.42 + waveB * 0.55 - trough * 0.80 + (shape.r - 0.5) * 0.42;\n    let ceiling = base + height * 0.76 + (shape.b - 0.5) * 0.40;\n    let band = min(p.y - underside, ceiling - p.y) / max(height * 0.16, 0.5);\n    let opening = shape.r * 0.50 + shape.g * 0.30 + weather.r * 0.20 - mix_f(0.88, 0.13, coverage);\n    let form = min(band, opening);\n    let eroded = form - (grain - 0.35) * 0.065;\n    density += weights.z * max(smoothstep(-0.06, 0.23, eroded), smoothstep(0.08, 0.35, eroded) * 1.25);\n    macroDensity += weights.z * max(smoothstep(-0.06, 0.23, form), smoothstep(0.08, 0.35, form) * 1.25);\n    signed = max(signed, eroded - (1.0 - weights.z) * 0.35);\n  }\n  return vec3<f32>(density * presence, macroDensity * presence, signed);\n}\n\n// Continuous layer systems for the weather director. Reuse the already sampled\n// four shape bands/detail, and the same co-moving weather domain. Shelf material\n// has its own resolved ripple scale, without pulling in the legacy ray/light\n// call graph or changing the noise domain of the remaining convective clouds.\nfn layeredWeatherBody(p:vec3<f32>, shape:vec4<f32>, detail:vec3<f32>, weights:vec3<f32>, shelfShapeBands:vec4<f32>, shelfDetail:vec3<f32>) -> vec3<f32> {\n  let fbm=dot(shape.gba,vec3<f32>(0.625,0.25,0.125));\n  let baseShape=contrast01(shape.r,1.35);\n  let shelfShape=saturate((baseShape-fbm*0.72)/max(1.0-fbm*0.72,0.08));\n  let detailMid=dot(detail,vec3<f32>(0.42,0.34,0.24));\n  let material=p+NTransform.shapeOffsetWorld;\n  let weatherScale=select(NTransform.weatherScale,1.0,NTransform.weatherScale==0.0);\n  let weather=wrap2D(weather2D,samp2D,weatherUV_from(material,weatherScale),0i,0.0);\n  let coverage=saturate(C.globalCoverage*mix_f(0.78,1.0,saturate(weather.r)));\n  let threshold=mix_f(0.62,0.06,coverage);\n  let presence=smoothstep(0.0,0.12,C.globalCoverage)*(1.0-smoothstep(0.85,1.0,weather.b));\n  let base=FIELD.gridMin.y;\n  var fine=0.0;\n  var macroDensity=0.0;\n  var signed=-1.0;\n  if(weights.x>0.0) {\n    // Port the layer's band-remap, scallops and crease signals, not its harsh\n    // high-frequency carve or thin-box height remapping. Keep folded, connected\n    // rain banks with a dense body and softer rippled edges through the cycle.\n    let s=shelfShapeBands;\n    let d=shelfDetail;\n    let shelfFBM=dot(s.gba,vec3<f32>(0.625,0.25,0.125));\n    let shelfBase=contrast01(s.r,1.24+cloudDefinition01()*0.38);\n    let remapped=saturate((shelfBase-shelfFBM*0.90)/max(1.0-shelfFBM*0.90,0.08));\n    let mid=dot(d,vec3<f32>(0.42,0.34,0.24));\n    let scallopSignal=mix_f(max(max(d.r,d.g),d.b),1.0-min(min(d.r,d.g),d.b),0.42);\n    let scallop=ridge01(contrast01(scallopSignal*0.72+ridge01(contrast01(mid,2.1))*0.28,2.25));\n    let valley=(1.0-scallop)*(1.0-scallop);\n    let crease=ridge01(contrast01(d.r*0.36+(1.0-d.g)*0.34+d.b*0.20+(1.0-s.r)*0.10,2.15));\n    let fold=ridge01(contrast01(s.g*0.54+s.b*0.30+s.a*0.16,1.9));\n    let center=base+1.95+(shape.g-0.5)*0.65+(s.g-s.b)*0.38;\n    let halfHeight=0.90+shelfShape*0.60+fold*0.32;\n    let band=1.0-abs(p.y-center)/halfHeight;\n    let structure=(remapped-0.28)*0.68+(shelfFBM-0.5)*0.14;\n    let form=min(band,band*0.42+structure-threshold*0.45);\n    // Erosion is bounded and reduced inside the bank: breakup exposes folds\n    // without punching a mature shelf into the default preset's rough wisps.\n    let shell=1.0-smoothstep(0.08,0.38,form);\n    let erosion=(mid*0.035+valley*0.095+crease*0.040)*mix_f(0.55,1.0,shell);\n    let eroded=form-erosion;\n    fine+=weights.x*max(smoothstep(-0.045,0.24,eroded),smoothstep(0.08,0.38,eroded)*1.45);\n    macroDensity+=weights.x*max(smoothstep(-0.045,0.24,form-erosion*0.45),smoothstep(0.08,0.38,eroded)*1.45);\n    signed=max(signed,form-erosion*0.65-(1.0-weights.x)*0.35);\n  }\n  if(weights.y>0.0) {\n    // A connected ceiling which opens into broken banks as coverage falls.\n    let center=base+3.35+(shape.g-0.5)*0.80;\n    let band=1.0-abs(p.y-center)/(0.80+fbm*0.85);\n    let form=min(band,0.14+baseShape*0.45+fbm*0.30-threshold);\n    let eroded=form-detailMid*0.07;\n    fine+=weights.y*max(smoothstep(-0.05,0.24,eroded),smoothstep(0.06,0.34,eroded)*1.35);\n    macroDensity+=weights.y*max(smoothstep(-0.05,0.24,form),smoothstep(0.06,0.34,form)*1.35);\n    signed=max(signed,eroded-(1.0-weights.y)*0.35);\n  }\n  if(weights.z>0.0) {\n    // High, sparse wisps stay above the low weather. A minimum three-voxel\n    // thickness keeps the thin material resolved instead of blinking away.\n    let center=base+FIELD.gridSize.y*0.82+(shape.g-0.5)*0.55;\n    let halfHeight=max(FIELD.gridSize.y/f32(FIELD.dimensions.y)*1.6,0.28);\n    let band=1.0-abs(p.y-center)/halfHeight;\n    let form=min(band,shelfShape-threshold*0.75-detailMid*0.08);\n    fine+=weights.z*smoothstep(-0.045,0.25,form)*0.22;\n    macroDensity+=weights.z*smoothstep(-0.045,0.25,form)*0.22;\n    signed=max(signed,form-(1.0-weights.z)*0.35);\n  }\n  return vec3<f32>(fine*presence,macroDensity*presence,signed);\n}\n\n// Example arbitrary domain: rotate an analytic torus in place while its cloud\n// material keeps advecting independently through it. Bounds are only an\n// allocation/ray intersection box; no mesh or marching cubes are involved.\nfn cloudTorusDistance(p: vec3<f32>) -> f32 {\n  let v = p - (FIELD.gridMin.xyz + FIELD.gridSize.xyz * 0.5);\n  let c = cos(FIELD.volume.y);\n  let s = sin(FIELD.volume.y);\n  let tilted = vec3<f32>(v.x, c * v.y + s * v.z, -s * v.y + c * v.z);\n  let q = vec3<f32>(cos(0.35) * tilted.x + sin(0.35) * tilted.y,\n    -sin(0.35) * tilted.x + cos(0.35) * tilted.y, tilted.z);\n  let extent = min(min(FIELD.gridSize.x, FIELD.gridSize.y), FIELD.gridSize.z) * 0.5;\n  return length(vec2<f32>(length(q.xz) - extent * FIELD.volume.z, q.y)) - extent * FIELD.volume.w;\n}\n\nfn galleryRotate(p:vec3<f32>, angle:f32) -> vec3<f32> {\n  let a=vec3<f32>(cos(angle)*p.x+sin(angle)*p.z,p.y,-sin(angle)*p.x+cos(angle)*p.z);\n  let b=angle*0.73;\n  return vec3<f32>(a.x,cos(b)*a.y+sin(b)*a.z,-sin(b)*a.y+cos(b)*a.z);\n}\nfn cloudGalleryDistance(p:vec3<f32>) -> f32 {\n  let extent=min(min(FIELD.gridSize.x,FIELD.gridSize.y),FIELD.gridSize.z)*0.5;\n  let v=(p-(FIELD.gridMin.xyz+FIELD.gridSize.xyz*0.5))/extent;\n  let t=FIELD.volume.y;\n  let ring=galleryRotate(v,t);\n  var distance=length(vec2<f32>(length(ring.xz)-0.38,ring.y))-0.105;\n  let cube=abs(galleryRotate(v-vec3<f32>(-.62,.39,0),t*1.7))-vec3<f32>(.175);\n  distance=min(distance,length(max(cube,vec3<f32>(0)))+min(max(max(cube.x,cube.y),cube.z),0.0));\n  let egg=galleryRotate(v-vec3<f32>(.62,.39,0),t*2.3);\n  distance=min(distance,(length(egg/vec3<f32>(.23,.13,.17))-1.0)*.13);\n  var capsule=galleryRotate(v-vec3<f32>(-.60,-.43,0),t*2.8);\n  capsule.y-=clamp(capsule.y,-.16,.16);\n  distance=min(distance,length(capsule)-.11);\n  let diamond=abs(galleryRotate(v-vec3<f32>(.60,-.43,0),t*3.2));\n  distance=min(distance,(diamond.x+diamond.y+diamond.z-.30)*0.57735);\n  return distance*extent;\n}\n\nfn arbitraryCloudBody(p: vec3<f32>, shape: vec4<f32>, detail: vec3<f32>) -> vec3<f32> {\n  // A fully three-dimensional noise population, rather than extruding the\n  // flat layer's common base through a torus. The mask can be replaced by any\n  // other signed-distance function without changing raymarch/lighting stages.\n  let fbm = dot(shape.gba, vec3<f32>(0.625, 0.25, 0.125));\n  let baseShape = contrast01(shape.r, 1.24 + cloudDefinition01() * 0.38);\n  let shelfShape = saturate((baseShape - fbm * 0.72) / max(1.0 - fbm * 0.72, 0.08));\n  let macroSigned = 0.24 + (shelfShape - 0.22) * 0.55 + (fbm - 0.5) * 0.20;\n  let scallop = mix_f(max(max(detail.r, detail.g), detail.b), 1.0 - min(min(detail.r, detail.g), detail.b), 0.42);\n  let erosion = dot(detail, vec3<f32>(0.42, 0.34, 0.24)) * 0.10 + pow(1.0 - ridge01(contrast01(scallop, 2.4)), 1.35) * 0.14;\n  let material = p + NTransform.shapeOffsetWorld;\n  let weatherScale = select(NTransform.weatherScale, 1.0, NTransform.weatherScale == 0.0);\n  let weather = wrap2D(weather2D, samp2D, weatherUV_from(material, weatherScale), 0i, 0.0);\n  let presence = smoothstep(0.0, 0.15, C.globalCoverage) * mix_f(0.65, 1.0, saturate(weather.r)) * (1.0 - smoothstep(0.85, 1.0, weather.b));\n  let variation = mix_f(0.55, 1.0, shelfShape) * presence;\n  return vec3<f32>(smoothstep(-0.065, 0.28, macroSigned - erosion) * variation,\n    smoothstep(-0.065, 0.28, macroSigned) * variation, macroSigned - erosion * 0.65);\n}\n\n@compute @workgroup_size(4, 4, 4)\nfn buildCloudDensityField(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {\n  initCloudWorkgroup(lid);\n  if (any(gid >= FIELD.dimensions.xyz)) { return; }\n  let uv = (vec3<f32>(gid) + 0.5) / vec3<f32>(FIELD.dimensions.xyz);\n  let p = FIELD.gridMin.xyz + uv * FIELD.gridSize.xyz;\n  let ph = uv.y;\n  // These forms already have a vertical scaffold and an anvil. Applying the\n  // thin-layer's anvil warp/vertical retiling again aliases that texture into\n  // horizontal stripes/speckles, especially in tall storms. Use world-space,\n  // voxel-bandlimited noise here; keep the original mapping in Layer mode.\n  let shapeAxisInput = axisOrOne3(NTransform.shapeAxisScale);\n  let detailAxisInput = axisOrOne3(NTransform.detailAxisScale);\n  // Tall presets used thin-layer Y compression, producing horizontal noise\n  // rings on the towers. In a true volume use near-isotropic rolling structure.\n  let shapeAxis = vec3<f32>(shapeAxisInput.x, sign(shapeAxisInput.y) * sqrt(abs(shapeAxisInput.y)), shapeAxisInput.z);\n  let detailAxis = vec3<f32>(detailAxisInput.x, sign(detailAxisInput.y) * sqrt(abs(detailAxisInput.y)), detailAxisInput.z);\n  // Thin-layer noise repeated too rapidly across tall bodies, breaking every\n  // shoulder into vapor. Separate the broad rolling mass from detail erosion.\n  let shapeScale = wg_scaleS * select(NTransform.shapeScale, 1.0, NTransform.shapeScale == 0.0) * 0.35;\n  // Thin-layer detail repeats several times per world unit. At field resolution\n  // that selects the final 1x1 mip and erases every valley. Map those same bands\n  // to resolvable billow-sized features; still use the actual voxel footprint.\n  let detailScale = wg_scaleD * select(NTransform.detailScale, 1.0, NTransform.detailScale == 0.0) * 0.04;\n  let spacing = FIELD.gridSize.xyz / vec3<f32>(FIELD.dimensions.xyz);\n  let shapeFootprint = spacing * abs(shapeAxis * shapeScale) * wg_shapeDim;\n  let detailFootprint = spacing * abs(detailAxis * detailScale) * wg_detailDim;\n  let shapeLOD = clamp(log2(max(max(shapeFootprint.x, shapeFootprint.y), max(shapeFootprint.z, 1.0))), 0.0, wg_maxMipS);\n  let detailLOD = clamp(log2(max(max(detailFootprint.x, detailFootprint.y), max(detailFootprint.z, 1.0))), 0.0, wg_maxMipD);\n  let detail = wrap3D_detail(detail3D, sampDetail, (p + NTransform.detailOffsetWorld) * detailAxis * detailScale, detailLOD).rgb;\n  // The independently moving detail domain bends shoulders as well as eroding\n  // them. This is continuous volumetric billowing, not a time-varying Y scale.\n  let detailWarp = (detail - 0.5) * max(TUNE.puffScale, 0.75) * vec3<f32>(0.16, 0.12, 0.16);\n  let shape = wrap3D_shape(shape3D, sampShape, (p + detailWarp + NTransform.shapeOffsetWorld) * shapeAxis * shapeScale, shapeLOD);\n  // All four prefiltered shape bands contribute: broad domain distortion hides\n  // the scaffold; the Rain Shelf closure gives the whole volume broken density.\n  // No additional texture fetches or per-ray procedural noise are required.\n  let distortion = (shape.gba - 0.5) * max(TUNE.puffScale, 0.75) * vec3<f32>(0.32, 0.18, 0.32) + detailWarp;\n  var body: vec3<f32>;\n  var baseFade = 1.0;\n  if (FIELD.volume.x > 0.5) {\n    body = arbitraryCloudBody(p, shape, detail);\n    var distance = cloudTorusDistance(p);\n    if(FIELD.volume.x > 1.5) { distance=cloudGalleryDistance(p); }\n    let feather = max(max(spacing.x, spacing.y), spacing.z) * 1.2;\n    let mask = 1.0 - smoothstep(-feather, feather, distance);\n    body = vec3<f32>(body.xy * mask, min(body.z, -distance / max(feather * 4.0, EPS)));\n  } else {\n    let weights=clamp(vec3<f32>(FIELD.gridMin.w,FIELD.gridSize.w,FIELD.volume.w),vec3<f32>(0.0),vec3<f32>(1.0));\n    var featureWeights = clamp(FIELD.morphology.xyz, vec3<f32>(0.0), vec3<f32>(1.0));\n    if (TUNE.formType > 4.5) {\n      featureWeights = vec3<f32>(select(0.0, 1.0, TUNE.formType < 5.5),\n        select(0.0, 1.0, TUNE.formType >= 5.5 && TUNE.formType < 6.5), select(0.0, 1.0, TUNE.formType >= 6.5));\n    }\n    let layeredWeight=saturate(weights.x+weights.y+weights.z+featureWeights.x+featureWeights.y+featureWeights.z);\n    let convectiveWeight=1.0-layeredWeight;\n    body=vec3<f32>(0.0,0.0,-1.0);\n    if(convectiveWeight>0.0) {\n      let convective=roundedCloudBody(p+distortion,shape,detail);\n      body=vec3<f32>(convective.xy*convectiveWeight,convective.z-layeredWeight*0.35);\n    }\n    if(weights.x+weights.y+weights.z>0.0) {\n      var shelfBands=shape;\n      var shelfDetail=detail;\n      if(weights.x>0.0) {\n        // Two shelf-only filtered reads during the cached density bake, never\n        // per screen ray. Separate coordinates avoid warping the towers during\n        // a crossfade; each band's LOD follows the actual density-voxel footprint.\n        let rippleShapeScale=shapeScale*2.35;\n        let rippleDetailScale=detailScale*2.50;\n        let rippleShapeFP=spacing*abs(shapeAxis*rippleShapeScale)*wg_shapeDim;\n        let rippleDetailFP=spacing*abs(detailAxis*rippleDetailScale)*wg_detailDim;\n        let rippleShapeLOD=clamp(log2(max(max(rippleShapeFP.x,rippleShapeFP.y),max(rippleShapeFP.z,1.0))),0.0,wg_maxMipS);\n        let rippleDetailLOD=clamp(log2(max(max(rippleDetailFP.x,rippleDetailFP.y),max(rippleDetailFP.z,1.0))),0.0,wg_maxMipD);\n        shelfBands=wrap3D_shape(shape3D,sampShape,(p+detailWarp*0.45+NTransform.shapeOffsetWorld)*shapeAxis*rippleShapeScale,rippleShapeLOD);\n        shelfDetail=wrap3D_detail(detail3D,sampDetail,(p+NTransform.detailOffsetWorld)*detailAxis*rippleDetailScale,rippleDetailLOD).rgb;\n      }\n      let layered=layeredWeatherBody(p+distortion*vec3<f32>(1.0,0.45,1.0),shape,detail,weights,shelfBands,shelfDetail);\n      body=vec3<f32>(body.xy+layered.xy,max(body.z,layered.z));\n    }\n    if (featureWeights.x+featureWeights.y+featureWeights.z > 0.0) {\n      let feature = featureWeatherBody(p, shape, detail, featureWeights);\n      body = vec3<f32>(body.xy+feature.xy, max(body.z, feature.z));\n    }\n    baseFade = smoothstep(0.02, 0.13, ph) * (1.0 - smoothstep(0.97, 1.0, ph));\n  }\n  let toMin = p.xz - FIELD.gridMin.xz;\n  let toMax = FIELD.gridMin.xz + FIELD.gridSize.xz - p.xz;\n  let edgeDistance = min(min(toMin.x, toMin.y), min(toMax.x, toMax.y));\n  let edgeFade = smoothstep(0.0, max(TUNE.puffScale * 0.55, 0.1), edgeDistance);\n  let densityScale = max(C.globalDensity, 0.0) * 1.6 * baseFade * edgeFade;\n  textureStore(cloudDensityOut, vec3<i32>(gid), vec4<f32>(body.xy * densityScale, ph, max(body.z, -0.30)));\n}\n\n@compute @workgroup_size(4, 4, 4)\nfn buildCloudLightField(@builtin(global_invocation_id) gid: vec3<u32>) {\n  if (any(gid >= FIELD.dimensions.xyz)) { return; }\n  let uv = (vec3<f32>(gid) + 0.5) / vec3<f32>(FIELD.dimensions.xyz);\n  let p = FIELD.gridMin.xyz + uv * FIELD.gridSize.xyz;\n  let spacing = FIELD.gridSize.xyz / vec3<f32>(FIELD.dimensions.xyz);\n  let current = fieldDensityAt(p).y;\n  let offsets = array<vec3<f32>, 6>(vec3<f32>(1,0,0), vec3<f32>(-1,0,0), vec3<f32>(0,1,0), vec3<f32>(0,-1,0), vec3<f32>(0,0,1), vec3<f32>(0,0,-1));\n  var neighbors: array<f32, 6>;\n  // Signed form gradients remain meaningful inside saturated density; gradients\n  // of the density plateau would fall back to a flat upward normal there.\n  // A one-cell empty halo must carry real lighting too: trilinear density can\n  // be nonzero there. Returning full sunlight for every empty voxel made the\n  // moving boundary alternately interpolate lit and shadowed texels.\n  var nearbyDensity = current;\n  let normalSpacing = spacing * 1.5;\n  for (var i = 0u; i < 6u; i++) {\n    let neighbor = fieldSampleAt(p + offsets[i] * normalSpacing);\n    neighbors[i] = neighbor.a;\n    nearbyDensity = max(nearbyDensity, neighbor.g);\n  }\n  let sunDir = normalizeOr(L.sunDir, vec3<f32>(0.0, 1.0, 0.0));\n  if (nearbyDensity < 0.0001) {\n    textureStore(cloudLightOut, vec3<i32>(gid), vec4<f32>(max(sunDir.y, 0.0), 1.0, 1.0, 1.0));\n    return;\n  }\n  let gradient = vec3<f32>(neighbors[0] - neighbors[1], neighbors[2] - neighbors[3], neighbors[4] - neighbors[5]) / max(normalSpacing, vec3<f32>(EPS));\n  let normal = normalizeOr(-gradient, vec3<f32>(0.0, 1.0, 0.0));\n  let reach = min(4.6, max(TUNE.puffScale * 0.95, FIELD.gridSize.y * 0.85));\n  // Midpoint quadrature, with two samples per crossed density cell. The cap\n  // bounds cached-field work; no secondary march is added to screen-space rays.\n  let sunVoxelStep = 1.0 / max(max(abs(sunDir.x) / spacing.x, abs(sunDir.y) / spacing.y), abs(sunDir.z) / spacing.z);\n  let shadowSteps = u32(clamp(ceil(reach / sunVoxelStep * 2.0), 16.0, 48.0));\n  let step = reach / f32(shadowSteps);\n  var opticalDepth = 0.0;\n  for (var i = 0u; i < shadowSteps; i++) {\n    opticalDepth += fieldDensityAt(p + sunDir * ((f32(i) + 0.5) * step)).y * step * SUN_EXTINCTION_SCALE;\n  }\n  let sunVisibility = exp(-opticalDepth * max(C.cloudBeer, EPS));\n  let aoRadius = max(TUNE.puffScale * 0.12, min(FIELD.gridSize.y * 0.12, 0.50));\n  var surrounding = 0.0;\n  for (var i = 0u; i < 6u; i++) {\n    // Favor the outward hemisphere: nearby shoulders darken creases, without\n    // treating the opaque cloud interior as uniform ambient occlusion.\n    let weight = 0.15 + 0.85 * max(dot(offsets[i], normal), 0.0);\n    let near = fieldDensityAt(p + offsets[i] * aoRadius).y;\n    let far = fieldDensityAt(p + offsets[i] * aoRadius * 2.4).y;\n    surrounding += (max(near - current * 0.20, 0.0) * 0.6 + max(far - current * 0.10, 0.0) * 0.4) * weight;\n  }\n  let ambientVisibility = clamp(exp(-surrounding * aoRadius * 0.065), 0.18, 1.0);\n  // Store filterable responses, not octahedral coordinates. Encoded normals\n  // have a wrap seam: filtering them before decoding can flip the light across\n  // a whole moving patch even when the actual normals are almost identical.\n  let diffuse = max(dot(normal, sunDir), 0.0);\n  let upper = saturate(normal.y * 0.5 + 0.5);\n  textureStore(cloudLightOut, vec3<i32>(gid), vec4<f32>(diffuse, upper, sunVisibility, ambientVisibility));\n}\n";

  // tools/clouds/shaders/cloudPlanet.wgsl
  var cloudPlanet_default = "// Compact regular planet styles. Independent of flat morphology, detailed\n// legacy lighting and aurora call graphs; all seven styles share this entry.\nfn planetShape(p:vec3<f32>,lod:f32)->vec4<f32> {\n let moved=sphericalSampleDriftedWorld(p,vec3<f32>(NTransform.shapeOffsetWorld.x,0,NTransform.shapeOffsetWorld.z))-B.center;\n let scale=max(V.worldToUV*B.uvScale,EPS)*max(NTransform.shapeScale,EPS);\n let domain=moved*axisOrOne3(NTransform.shapeAxisScale)*scale;\n return textureSampleLevel(shape3D,sampShape,planetEvolvingDomain(domain,NTransform.shapeOffsetWorld.y),lod);\n}\n// Continuous Cartesian deformation, one texture read and no rebake/extra march.\nfn planetEvolvingDomain(p:vec3<f32>,phase:f32)->vec3<f32> {\n let warp=vec3<f32>(sin(p.y*5.7+phase),sin(p.z*6.3-phase*.71),sin(p.x*5.1+phase*.47));\n return p+vec3<f32>(.018,.011,-.014)*phase+warp*.055;\n}\nfn planetPhase(p:vec3<f32>)->f32 {return (length(p-B.center)-V.planetRadius-V.cloudBottom)/max(V.cloudTop-V.cloudBottom,EPS);}\nfn gasZonalAngle(latitude:f32,wind:f32)->f32 {\n return wind+sin(wind*.7)*sin(latitude*14.0)*.12;\n}\nfn planetWeather(p:vec3<f32>)->vec4<f32> {\n // Rotate the unit-sphere domain, not the equirectangular UV. Gas bands and\n // coverage travel with the shell without sliding through a longitude seam.\n var wind=NTransform.weatherOffsetWorld;\n if(TUNE.formType>=4.5){\n  let latitude=normalize(p-B.center).y;\n  // Zonal flow stays at its latitude; neighboring jets shear east/west.\n  wind=vec3<f32>(gasZonalAngle(latitude,wind.x*6.283185307)/6.283185307,0,0);\n }\n let uv=sphereUVFromWorld(sphericalDriftedWorld(p,wind));\n let latitudeScale=axisOrOne3(NTransform.weatherAxisScale).z*max(NTransform.weatherScale,EPS);\n return wrap2D(weather2D,samp2D,(uv-vec2<f32>(.5))*vec2<f32>(1,latitudeScale)+vec2<f32>(.5),0,0.0);\n}\nfn planetMass(p:vec3<f32>,lod:f32)->f32 {\n let ph=planetPhase(p);if(ph<=0.0||ph>=1.0){return 0.0;}\n return styledPlanetDensity(ph,planetWeather(p),planetShape(p,lod),0.0)/max(C.globalDensity*10.0,EPS);\n}\nfn planetPixelRandom(p:vec2<u32>)->f32 {\n var h=(p.x*0x9e3779b9u)^(p.y*0x85ebca6bu)^0x68bc21ebu;\n h=(h^(h>>16u))*0x7feb352du;h=(h^(h>>15u))*0x846ca68bu;return f32((h^(h>>16u))>>8u)*(1.0/16777216.0);\n}\n@compute @workgroup_size(8,8,1)\nfn computeCloudPlanet(@builtin(global_invocation_id) gid:vec3<u32>,@builtin(local_invocation_id) local:vec3<u32>) {\n if(all(local==vec3<u32>(0u))){\n  wg_weatherDim=vec2<f32>(textureDimensions(weather2D));wg_maxMipW=f32(textureNumLevels(weather2D))-1.0;\n  wg_boxMaxXZ=1.0;wg_verticalRefHalfY=max(B.half.y,EPS);wg_verticalRefBoxH=wg_verticalRefHalfY*2.0;\n }\n workgroupBarrier();\n var pix=vec2<i32>(gid.xy)+vec2<i32>(frame.originX,frame.originY);\n if(reproj.compactInterleave!=0u && temporalCellRateNormalized()>1u && reproj.frameIndex>0u){\n  let mapped=compactTemporalPixel(gid.xy,temporalCellRateNormalized());if(mapped.z==0u){return;}pix=vec2<i32>(mapped.xy);\n }\n if(any(pix<vec2<i32>(0))||any(pix>=vec2<i32>(i32(frame.fullWidth),i32(frame.fullHeight)))){return;}\n let uv=(vec2<f32>(pix)+0.5)/vec2<f32>(f32(frame.fullWidth),f32(frame.fullHeight));let ndc=uv*2.0-1.0;\n var ro=V.camPos;if(CLOUD_USE_CUSTOM_POS!=0u){ro=posBuf[u32(pix.y)*frame.fullWidth+u32(pix.x)].xyz;}\n let rd=normalize(V.fwd+V.right*(ndc.x*V.aspect*tan(V.fovY*0.5))-V.up*(ndc.y*tan(V.fovY*0.5)));\n let hit=intersectSphericalCloudShellView(ro,rd);\n let historyActive=reproj.enabled==1u||temporalCellRateNormalized()>1u||reproj.temporalBlend>0.0001;\n if(hit.x>=hit.y){storeLayerSample(pix,vec4<f32>(0.0),0.0,historyActive);return;}\n let h=max(V.cloudTop-V.cloudBottom,EPS);let shapeDims=vec3<f32>(textureDimensions(shape3D));\n let scale=max(V.worldToUV*B.uvScale*NTransform.shapeScale,EPS);\n let rayPixelScale=2.0*tan(V.fovY*0.5)/f32(frame.fullHeight);\n let steps=clamp(TUNE.maxSteps,16,160);let step=max((hit.y-hit.x)/f32(steps),h/64.0);\n let probe=clamp(1.25/(scale*shapeDims.x),h*.012,h*.15);\n let extinction=max(C.globalDensity,0.0)*0.34/h;\n var t=hit.x+step*planetPixelRandom(vec2<u32>(pix));var tr=1.0;var color=vec3<f32>(0.0);\n var sunVisibility=1.0;var normal=normalize(ro+rd*hit.x-B.center);\n let sun=normalize(L.sunDir);var litSamples=0;\n let neptune=TUNE.formType>=5.5&&TUNE.formType<6.5;\n let sunStride=max(TUNE.sunStride,1);\n let normalStride=select(sunStride,min(sunStride,2),length(ro-B.center)<V.planetRadius+V.cloudTop+h*0.5);\n for(var i=0;i<steps;i++){\n  if(t>=hit.y||tr<0.012){break;}\n  let p=ro+rd*t;let ph=planetPhase(p);\n  if(ph>0.0&&ph<1.0){\n   let footprint=max(t*rayPixelScale,0.25/(scale*shapeDims.x));\n   let lod=clamp(log2(max(footprint*scale*shapeDims.x,1.0)),0.0,f32(textureNumLevels(shape3D))-1.0);\n   let s=planetShape(p,lod);let weather=planetWeather(p);\n   var density=styledPlanetDensity(ph,weather,s,0.0)/max(C.globalDensity*10.0,EPS);\n   if(density>0.0001){\n    // Fine noise only erodes the skin; dense interiors remain coherent. Real\n    // mip filtering limits subpixel shimmer without a camera-relative reset.\n    let detailScale=max(V.worldToUV*B.uvScale*4.0*NTransform.detailScale,EPS);\n    let detailLod=clamp(log2(max(footprint*detailScale*f32(textureDimensions(detail3D).x),1.0)),0.0,f32(textureNumLevels(detail3D))-1.0);\n    let detail=textureSampleLevel(detail3D,sampDetail,(sphericalSampleDriftedWorld(p,NTransform.detailOffsetWorld)-B.center)*detailScale,detailLod).rgb;\n    density=styledPlanetDensity(ph,weather,s,dot(detail,vec3<f32>(.42,.34,.24))*.035)/max(C.globalDensity*10.0,EPS);\n    if(!neptune&&litSamples%normalStride==0){\n     let radial=normalize(p-B.center);\n     // Reuse weather and analytically shift radial phase. Only three shape\n     // probes: no extra weather/detail reads or nested normal raymarch.\n     let baseline=styledPlanetForm(ph,weather,s).x;\n     let gradient=vec3<f32>(\n      styledPlanetForm(ph+radial.x*probe/h,weather,planetShape(p+vec3<f32>(probe,0,0),lod)).x,\n      styledPlanetForm(ph+radial.y*probe/h,weather,planetShape(p+vec3<f32>(0,probe,0),lod)).x,\n      styledPlanetForm(ph+radial.z*probe/h,weather,planetShape(p+vec3<f32>(0,0,probe),lod)).x)-vec3<f32>(baseline);\n     normal=normalizeOr(-gradient,radial);\n    }\n    if(litSamples%sunStride==0){\n     var od=0.0;var previous=0.0;\n     for(var j=0;j<clamp(TUNE.sunSteps,1,3);j++){\n      let distance=h*(0.12+f32(j)*0.25+f32(j*j)*0.16);\n      od+=planetMass(p+sun*distance,min(lod+0.6,3.0))*(distance-previous)*extinction;previous=distance;\n     }sunVisibility=exp(-od*1.15);\n    }litSamples++;\n    let radial=normalize(p-B.center);let day=smoothstep(-.16,.28,dot(radial,sun));\n    let lightNormal=normalizeOr(mix(normal,radial,select(0.0,.94,neptune)),radial);\n    let diffuse=max(dot(lightNormal,sun),0.0);let ao=clamp(1.0-density*.28+(s.g-.5)*.18,.55,1.0);\n    // A small forward fill keeps silhouettes readable without washing out\n    // the shape gradient. Scattering still lifts shadowed cloud interiors.\n    let direct=sunVisibility*(.12+.88*diffuse)*day;\n    let bounce=(.07+.12*sqrt(sunVisibility))*day;\n    let ambient=(.12+.10*max(dot(lightNormal,radial),0.0))*ao;\n    var light=C.frontLightColor*(direct+bounce)+C.shadowLightColor*ambient;\n    if(TUNE.formType>=4.5){light*=gasWeatherColor(weather,TUNE.formType);}\n    let alpha=1.0-exp(-density*extinction*min(step,hit.y-t));\n    color+=tr*alpha*light;tr*=1.0-alpha;\n   }\n  }t+=step;\n }\n let alpha=1.0-tr;let feather=smoothstep(0.0,max(TUNE.minOutputAlpha,0.0001),alpha);\n var result=vec4<f32>(color*feather,alpha*feather);\n if(CLOUD_WRITE_RGB==0u){result=vec4<f32>(0,0,0,result.a);}\n storeLayerSample(pix,result,0.0,historyActive);\n}\n";

  // tools/clouds/shaders/planetGasAppearance.wgsl
  var planetGasAppearance_default = "// Shared by volumetric and mesh clouds. Pigments are baked in the same map;\n// palette choice is a uniform, not another shader pipeline or texture read.\nfn gasWeatherColor(weather:vec4<f32>,form:f32)->vec3<f32> {\n let pigment=clamp(weather.a,0.0,1.0);\n if(form>=6.5){\n  // Moss/emerald atmosphere with warm rusty-orange storm regions and fine\n  // yellow-green threads. Not neon red/green hemispheres. Opacity remains a\n  // separate control so mountains can show beneath both renderers.\n  let filament=smoothstep(.08,.88,weather.b);\n  let red=mix(vec3<f32>(.19,.035,.006),vec3<f32>(.48,.16,.022),filament);\n  let green=mix(vec3<f32>(.008,.19,.006),vec3<f32>(.11,.48,.016),filament);\n  let body=mix(red,green,smoothstep(.15,.85,pigment));\n  return body*(.82+weather.g*.22);\n }\n if(form>=5.5){\n  let body=mix(vec3<f32>(.012,.033,.31),vec3<f32>(.027,.090,.55),pigment);\n  let streak=weather.g*.24;\n  // One dark anticyclone, with occasional high pale-blue ice-cloud streaks.\n  return mix(body,vec3<f32>(.005,.009,.07),weather.b*.82)+vec3<f32>(.35,.55,.66)*streak;\n }\n let ochre=mix(vec3<f32>(.20,.065,.025),vec3<f32>(.73,.36,.13),smoothstep(.02,.55,pigment));\n let cream=mix(ochre,vec3<f32>(.95,.92,.82),smoothstep(.45,.91,pigment));\n let rust=mix(vec3<f32>(.35,.009,.009),vec3<f32>(.72,.038,.018),weather.g);\n return mix(cream,rust,smoothstep(.08,.62,weather.b));\n}\n";

  // tools/clouds/shaders/cloudsRender.wgsl
  var cloudsRender_default = "// cloudsRender.wgsl - preview: world-space camera + directional sun,\n// tone-map and composite the cloud layer over a procedural sky.\n// Uses explicit-LOD sampling so textureSample* calls are valid in\n// non-uniform control flow.\n\nconst PI : f32 = 3.141592653589793;\nconst SUN_UV_RADIUS : f32 = 0.018;\nconst SUN_GLOW_RADIUS : f32 = 0.075;\nconst SUN_EDGE_GLOW_RADIUS : f32 = 0.42;\n\n// ---------- I/O ----------\nstruct RenderParams {\n  layerIndex:u32,\n  compositeQuality:u32,\n  shadowDarkness:f32,\n  fieldLighting:f32,\n\n  // camera in world space\n  camPos:vec3<f32>, nightAmount:f32,\n  right:vec3<f32>,  _p4:f32,\n  up:vec3<f32>,     _p5:f32,\n  fwd:vec3<f32>,    _p6:f32,\n\n  // frustum + exposure\n  fovY:f32,\n  aspect:f32,\n  exposure:f32,\n  sunBloom:f32,\n\n  sunDir:vec3<f32>, celestialVisibility:f32,\n  sky:vec3<f32>,    skyCycle:f32,\n\n  gradeStyle:u32,\n  shadowStrength:f32,\n  colorLift:f32,\n  saturationBoost:f32,\n\n  sunColorTint:vec3<f32>, _p12:f32,\n  lightTint:vec3<f32>, _p13:f32,\n  shadowTint:vec3<f32>, _p14:f32,\n  edgeTint:vec3<f32>, _p15:f32,\n  styleControls:vec4<f32>,\n  godRayControls:vec4<f32>,\n  reservedControls:vec4<f32>,\n  silverControls:vec4<f32>,\n  boxCenter:vec3<f32>, _p16:f32,\n  boxHalf:vec3<f32>, _p17:f32,\n};\n@group(0) @binding(0) var samp : sampler;\n@group(0) @binding(1) var tex  : texture_2d_array<f32>;\n@group(0) @binding(2) var<uniform> R : RenderParams;\n\nstruct VSOut { @builtin(position) pos:vec4<f32>, @location(0) uv:vec2<f32>, };\n\n@vertex\nfn vs_main(@builtin(vertex_index) vid:u32)->VSOut {\n  var p = array<vec2<f32>,6>(\n    vec2<f32>(-1.0,-1.0), vec2<f32>( 1.0,-1.0), vec2<f32>(-1.0, 1.0),\n    vec2<f32>(-1.0, 1.0), vec2<f32>( 1.0,-1.0), vec2<f32>( 1.0, 1.0)\n  );\n  var t = array<vec2<f32>,6>(\n    vec2<f32>(0.0,1.0), vec2<f32>(1.0,1.0), vec2<f32>(0.0,0.0),\n    vec2<f32>(0.0,0.0), vec2<f32>(1.0,1.0), vec2<f32>(1.0,0.0)\n  );\n  var o : VSOut;\n  o.pos = vec4<f32>(p[vid], 0.0, 1.0);\n  o.uv  = t[vid];\n  return o;\n}\n\n// ---------- helpers ----------\nfn toneMapFilmic(c:vec3<f32>)->vec3<f32> {\n  let a = 2.51;\n  let b = 0.03;\n  let c1 = 2.43;\n  let d = 0.59;\n  let e = 0.14;\n\n  let x = max(c, vec3<f32>(0.0));\n  return clamp((x * (a * x + b)) / (x * (c1 * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));\n}\n\nfn luma(c:vec3<f32>)->f32 {\n  return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));\n}\n\nfn hash12(p: vec2<f32>) -> f32 {\n  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453123);\n}\n\nfn weatherStars(direction:vec3<f32>) -> vec3<f32> {\n  // World-direction cells keep stars fixed while flying/turning. One tiny\n  // procedural evaluation in the existing composite, no texture/pass/history.\n  let uv=vec2<f32>(atan2(direction.x,direction.z),asin(clamp(direction.y,-1.0,1.0)))*80.0;\n  let cell=floor(uv);\n  let seed=hash12(cell);\n  let center=vec2<f32>(hash12(cell+31.7),hash12(cell+83.1))*.70+.15;\n  let point=exp(-dot(fract(uv)-center,fract(uv)-center)*900.0);\n  return vec3<f32>(.44,.61,.94)*point*smoothstep(.986,.998,seed)*smoothstep(.03,.30,direction.y);\n}\n\nfn displayTextureDimensions() -> vec2<f32> {\n  let sourceDims = vec2<f32>(textureDimensions(tex, 0));\n  let requestedDims = R.silverControls.zw;\n  if (requestedDims.x >= 1.0 && requestedDims.y >= 1.0) {\n    return requestedDims;\n  }\n  return sourceDims;\n}\n\nfn previewFogJitter(uv: vec2<f32>) -> f32 {\n  let dims = displayTextureDimensions();\n  let pix = floor(uv * dims + vec2<f32>(f32(R.layerIndex) * 0.37, f32(R.compositeQuality) * 1.91));\n  return hash12(pix);\n}\n\nfn sampleCloudRaw(uv:vec2<f32>, layer:i32)->vec4<f32> {\n  return textureSampleLevel(tex, samp, uv, layer, 0.0);\n}\n\nfn cloudDeDitherWeight(center: vec4<f32>, tap: vec4<f32>, spatialWeight: f32) -> f32 {\n  let centerA = clamp(center.a, 0.0, 1.0);\n  let tapA = clamp(tap.a, 0.0, 1.0);\n  let alphaDelta = abs(tapA - centerA);\n  let lumaDelta = abs(luma(tap.rgb) - luma(center.rgb));\n  let alphaWeight = exp(-alphaDelta * 18.0);\n  let lumaWeight = exp(-lumaDelta * 14.0);\n  let visibilityWeight = smoothstep(0.01, 0.12, tapA);\n  return spatialWeight * alphaWeight * lumaWeight * visibilityWeight;\n}\n\nstruct CloudNeighborhood {\n  filtered: vec4<f32>,\n  grad: vec2<f32>,\n  occ: f32,\n}\n\nfn sampleCloudNeighborhood(uv:vec2<f32>, layer:i32, center:vec4<f32>)->CloudNeighborhood {\n  let centerA = clamp(center.a, 0.0, 1.0);\n  if (R.compositeQuality == 0u || centerA < 0.003) {\n    return CloudNeighborhood(center, vec2<f32>(0.0, 0.0), centerA);\n  }\n\n  let dims = displayTextureDimensions();\n  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));\n  let stepUv = px * 2.0;\n\n  let left = sampleCloudRaw(clamp(uv + vec2<f32>(-stepUv.x, 0.0), vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999)), layer);\n  let right = sampleCloudRaw(clamp(uv + vec2<f32>(stepUv.x, 0.0), vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999)), layer);\n  let down = sampleCloudRaw(clamp(uv + vec2<f32>(0.0, -stepUv.y), vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999)), layer);\n  let up = sampleCloudRaw(clamp(uv + vec2<f32>(0.0, stepUv.y), vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999)), layer);\n\n  let wCenter = 1.0;\n  let wLeft = cloudDeDitherWeight(center, left, 0.58);\n  let wRight = cloudDeDitherWeight(center, right, 0.58);\n  let wDown = cloudDeDitherWeight(center, down, 0.58);\n  let wUp = cloudDeDitherWeight(center, up, 0.58);\n  let wSum = max(wCenter + wLeft + wRight + wDown + wUp, 1e-5);\n  let filteredTap = (\n    center * wCenter +\n    left * wLeft +\n    right * wRight +\n    down * wDown +\n    up * wUp\n  ) / wSum;\n\n  let edgeBand = smoothstep(0.02, 0.18, centerA) * (1.0 - smoothstep(0.62, 0.98, centerA));\n  let bodyBand = smoothstep(0.18, 0.72, centerA) * (1.0 - smoothstep(0.88, 0.99, centerA));\n  let qualityF = min(f32(R.compositeQuality), 2.0) * 0.5;\n  let blend = clamp(mix(0.34, 0.54, qualityF) * edgeBand + 0.12 * bodyBand, 0.0, 0.64);\n  let filtered = mix(center, filteredTap, blend);\n\n  let grad = vec2<f32>(right.a - left.a, up.a - down.a);\n  let occ = clamp(centerA * 0.42 + (left.a + right.a + down.a + up.a) * 0.145, 0.0, 1.0);\n  return CloudNeighborhood(filtered, grad, occ);\n}\n\nfn alphaFloorGate(alpha: f32) -> f32 {\n  let floorA = clamp(R.reservedControls.x, 0.0, 0.24);\n  return select(1.0, smoothstep(floorA, floorA + 0.035, alpha), floorA > 0.0001);\n}\n\nfn alphaColorResponse(alpha: f32) -> f32 {\n  let a = clamp(alpha, 0.0, 1.0);\n  let lowGate = smoothstep(0.014, 0.120, a);\n  let highGate = 1.0 - smoothstep(0.38, 0.78, a);\n  let responseGate = lowGate * highGate;\n  let curvedA = min(pow(max(a, 0.00001), 0.66) * 0.70, a + 0.13);\n  return mix(a, max(a, curvedA), responseGate * 0.42);\n}\n\nfn alphaDisplayResponse(alpha: f32) -> f32 {\n  let a = clamp(alpha, 0.0, 1.0);\n  let lowGate = smoothstep(0.014, 0.115, a);\n  let highGate = 1.0 - smoothstep(0.48, 0.84, a);\n  let responseGate = lowGate * highGate;\n  let liftedA = min(pow(max(a, 0.00001), 0.68) * 0.72, a + 0.15);\n  let shoulderGate = smoothstep(0.16, 0.50, a) * highGate;\n  let shoulderA = min(pow(max(a, 0.00001), 0.82) * 0.96, a + 0.08);\n  return max(\n    mix(a, max(a, liftedA), responseGate * 0.42),\n    mix(a, max(a, shoulderA), shoulderGate * 0.20)\n  );\n}\n\nfn applyStyleGrade(cIn:vec3<f32>, style:u32, cloudMask:f32)->vec3<f32> {\n  var c = clamp(cIn, vec3<f32>(0.0), vec3<f32>(1.0));\n  let lum = luma(c);\n  let hi = smoothstep(0.56, 0.96, lum);\n  let mid = smoothstep(0.16, 0.56, lum) * (1.0 - smoothstep(0.62, 0.92, lum));\n  let sh = 1.0 - smoothstep(0.14, 0.44, lum);\n  let gradeAmt = mix(0.012, 0.085, clamp(cloudMask, 0.0, 1.0));\n\n  var shadowTint = vec3<f32>(1.0, 1.0, 1.0);\n  var midTint = vec3<f32>(1.0, 1.0, 1.0);\n  var highTint = vec3<f32>(1.0, 1.0, 1.0);\n  var contrast = 1.0;\n  var saturation = 1.0;\n\n  if (style == 1u) {\n    shadowTint = vec3<f32>(0.92, 0.88, 1.18);\n    midTint = vec3<f32>(1.08, 0.96, 1.02);\n    highTint = vec3<f32>(1.18, 1.06, 0.78);\n    contrast = 1.065;\n    saturation = 1.18;\n  } else if (style == 2u) {\n    shadowTint = vec3<f32>(0.98, 0.96, 1.04);\n    midTint = vec3<f32>(1.00, 0.98, 1.02);\n    highTint = vec3<f32>(1.02, 0.98, 1.04);\n    contrast = 1.02;\n    saturation = 1.04;\n  } else if (style == 3u) {\n    shadowTint = vec3<f32>(0.98, 1.00, 1.02);\n    midTint = vec3<f32>(0.99, 1.00, 1.01);\n    highTint = vec3<f32>(1.01, 1.02, 1.02);\n    contrast = 1.01;\n    saturation = 1.01;\n  } else if (style == 4u) {\n    shadowTint = vec3<f32>(0.98, 0.96, 0.94);\n    midTint = vec3<f32>(1.02, 0.98, 0.94);\n    highTint = vec3<f32>(1.05, 0.99, 0.92);\n    contrast = 1.03;\n    saturation = 1.05;\n  } else if (style == 5u) {\n    shadowTint = vec3<f32>(0.98, 0.96, 1.04);\n    midTint = vec3<f32>(1.00, 0.98, 1.00);\n    highTint = vec3<f32>(1.03, 0.99, 1.02);\n    contrast = 1.02;\n    saturation = 1.03;\n  } else if (style == 12u) {\n    shadowTint = vec3<f32>(1.02, 0.99, 0.96);\n    midTint = vec3<f32>(1.07, 1.03, 0.96);\n    highTint = vec3<f32>(1.12, 1.06, 0.96);\n    contrast = 1.010;\n    saturation = 1.050;\n  } else if (style == 13u) {\n    shadowTint = vec3<f32>(1.03, 1.00, 0.97);\n    midTint = vec3<f32>(1.08, 1.04, 0.98);\n    highTint = vec3<f32>(1.14, 1.08, 0.98);\n    contrast = 1.012;\n    saturation = 1.055;\n  } else if (style == 15u) {\n    shadowTint = vec3<f32>(0.72, 0.86, 1.38);\n    midTint = vec3<f32>(0.72, 1.34, 0.88);\n    highTint = vec3<f32>(1.42, 0.58, 0.52);\n    contrast = 1.055;\n    saturation = 1.42;\n  }\n\n  c = mix(c, c * highTint, hi * gradeAmt * 0.16);\n  c = mix(c, c * midTint, mid * gradeAmt * 0.10);\n  c = mix(c, c * shadowTint, sh * gradeAmt * 0.12);\n\n  let pivot = vec3<f32>(0.50, 0.50, 0.50);\n  c = clamp((c - pivot) * mix(1.0, contrast, gradeAmt) + pivot, vec3<f32>(0.0), vec3<f32>(1.0));\n  let gray = vec3<f32>(luma(c));\n  c = mix(gray, c, mix(1.0, saturation, gradeAmt));\n  return clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));\n}\n\nfn stableSunHintUV(uvSun: vec2<f32>) -> vec2<f32> {\n  return clamp(uvSun, vec2<f32>(-0.18, -0.18), vec2<f32>(1.18, 1.18));\n}\n\nfn stableSunProximity(uv: vec2<f32>, uvSun: vec2<f32>, towardSun: f32, fwdDot: f32) -> f32 {\n  let sunHint = stableSunHintUV(uvSun);\n  let d2 = dot(uv - sunHint, uv - sunHint);\n  let screenNear = 1.0 / (1.0 + d2 * 8.65);\n  let angular = smoothstep(0.18, 0.985, towardSun);\n  let frontHemisphere = smoothstep(-0.10, 0.22, fwdDot);\n  let offscreenFloor = 0.28 * angular * frontHemisphere;\n  return max(screenNear * frontHemisphere, offscreenFloor);\n}\n\n// project a world-space direction onto the screen using camera basis + FOV\nfn projectDirToUV(dirWS:vec3<f32>)->vec2<f32> {\n  // unchanged\n  let sx = dot(dirWS, R.right);\n  let sy = dot(dirWS, R.up);\n  let sz = dot(dirWS, R.fwd);\n\n  let tanHalfY = tan(0.5 * R.fovY);\n  let tanHalfX = tanHalfY * max(R.aspect, 0.000001);\n\n  let invSz = 1.0 / max(sz, 0.000001);\n  let ndc = vec2<f32>((sx * invSz) / tanHalfX, (sy * invSz) / tanHalfY);\n\n  return vec2<f32>(0.5 + 0.5 * ndc.x, 0.5 - 0.5 * ndc.y);\n}\n\nfn rayDirFromUV(uv:vec2<f32>)->vec3<f32> {\n  let ndc = vec2<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);\n  let tanHalfY = tan(0.5 * R.fovY);\n  let tanHalfX = tanHalfY * max(R.aspect, 0.000001);\n  let dir = R.fwd + R.right * (ndc.x * tanHalfX) + R.up * (ndc.y * tanHalfY);\n  return normalize(dir);\n}\n\nfn previewBoxInterval(ro: vec3<f32>, rd: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>) -> vec2<f32> {\n  let safeRd = vec3<f32>(\n    select(1e-6, rd.x, abs(rd.x) > 1e-6),\n    select(1e-6, rd.y, abs(rd.y) > 1e-6),\n    select(1e-6, rd.z, abs(rd.z) > 1e-6)\n  );\n  let tA = (bmin - ro) / safeRd;\n  let tB = (bmax - ro) / safeRd;\n  let tNear3 = min(tA, tB);\n  let tFar3 = max(tA, tB);\n  return vec2<f32>(\n    max(max(tNear3.x, tNear3.y), tNear3.z),\n    min(min(tFar3.x, tFar3.y), tFar3.z)\n  );\n}\n\nfn previewBoxHit(ro: vec3<f32>, rd: vec3<f32>) -> vec2<f32> {\n  let half = max(R.boxHalf, vec3<f32>(0.001, 0.001, 0.001));\n  let bmin = R.boxCenter - half;\n  let bmax = R.boxCenter + vec3<f32>(half.x, half.y * 1.55 + 0.25, half.z);\n  return previewBoxInterval(ro, rd, bmin, bmax);\n}\n\nfn previewFogBoxHit(ro: vec3<f32>, rd: vec3<f32>, fogHorizon: f32) -> vec2<f32> {\n  let half = max(R.boxHalf, vec3<f32>(0.001, 0.001, 0.001));\n  let h = clamp(fogHorizon * 0.50, 0.0, 1.0);\n  let lower = half.y * mix(3.80, 6.20, h) + 0.55;\n  let upper = half.y * mix(2.20, 3.80, h) + 0.35;\n  let side = vec3<f32>(half.x * 1.05, lower, half.z * 1.05);\n  let top = vec3<f32>(half.x * 1.05, upper, half.z * 1.05);\n  let bmin = R.boxCenter - side;\n  let bmax = R.boxCenter + top;\n  return previewBoxInterval(ro, rd, bmin, bmax);\n}\n\nfn previewAtmosScale() -> f32 {\n  let half = max(R.boxHalf, vec3<f32>(0.001, 0.001, 0.001));\n  return max(max(half.x, half.z), max(half.y * 2.0, 1.0));\n}\n\nfn previewHorizonBand(rayDir: vec3<f32>, fogHorizon: f32) -> f32 {\n  let h = clamp(fogHorizon * 0.50, 0.0, 1.0);\n  let width = mix(3.15, 8.75, h);\n  return pow(clamp(1.0 - abs(rayDir.y) * width, 0.0, 1.0), mix(1.55, 0.92, h));\n}\n\nfn previewAerosolDensityAtY(y: f32, fogHorizon: f32) -> f32 {\n  let half = max(R.boxHalf, vec3<f32>(0.001, 0.001, 0.001));\n  let scale = previewAtmosScale();\n  let h = clamp(fogHorizon * 0.50, 0.0, 1.0);\n  let baseY = R.boxCenter.y - half.y * mix(1.15, 2.25, h) - 0.08;\n  let scaleHeight = max(half.y * mix(0.95, 2.65, h) + scale * mix(0.010, 0.022, h), 0.045);\n  let rel = (y - baseY) / scaleHeight;\n  let belowLayer = 1.0 / (1.0 + max(-rel, 0.0) * 0.16);\n  let aboveLayer = exp(-max(rel, 0.0));\n  let layerDensity = select(aboveLayer, belowLayer, rel < 0.0);\n  let highMist = mix(0.028, 0.070, h) * exp(-max(rel, 0.0) * mix(0.15, 0.08, h));\n  return clamp(layerDensity + highMist, 0.0, 1.16);\n}\n\nfn previewAerosolPathDistance(distance: f32, rayDir: vec3<f32>, fogHorizon: f32, jitter: f32) -> f32 {\n  let d = max(distance, 0.0);\n  if (d <= 0.0001) {\n    return 0.0;\n  }\n\n  let scale = previewAtmosScale();\n  let h = clamp(fogHorizon * 0.50, 0.0, 1.0);\n  let shallow = 1.0 - smoothstep(0.05, 0.38, abs(rayDir.y));\n  let longPath = smoothstep(scale * 0.40, scale * 6.00, d);\n  let adaptive = clamp(shallow * 0.78 + longPath * shallow * 0.22, 0.0, 1.0);\n  let sampleCount = 10u + u32(round(adaptive * 8.0));\n  let invCount = 1.0 / max(f32(sampleCount), 1.0);\n  let jitter01 = fract(jitter);\n  let y0 = R.camPos.y;\n  let dy = rayDir.y * d;\n\n  var accum = 0.0;\n  var i: u32 = 0u;\n  loop {\n    if (i >= sampleCount || i >= 18u) {\n      break;\n    }\n    let t = min((f32(i) + jitter01) * invCount, 1.0);\n    accum += previewAerosolDensityAtY(y0 + dy * t, fogHorizon);\n    i = i + 1u;\n  }\n\n  let avgDensity = accum * invCount;\n  let horizonBand = previewHorizonBand(rayDir, fogHorizon);\n  let horizonReservoir = horizonBand * mix(0.035, 0.12, h);\n  return d * clamp(avgDensity * mix(0.82, 1.18, h) + horizonReservoir, 0.0, 1.30);\n}\n\nfn previewSkyAerialDistance(rayDir: vec3<f32>, fogHorizon: f32) -> f32 {\n  let scale = previewAtmosScale();\n  let h = clamp(fogHorizon * 0.50, 0.0, 1.0);\n  let horizonBand = previewHorizonBand(rayDir, fogHorizon);\n  let verticalEscape = scale * mix(0.92, 2.70, h) / max(abs(rayDir.y) + 0.05, 0.08);\n  let horizonReach = scale * mix(2.80, 28.0, horizonBand) * (0.74 + 0.34 * clamp(fogHorizon, 0.0, 1.0));\n  let downReach = scale * mix(1.60, 5.80, h) / max(max(-rayDir.y, 0.0) + 0.22, 0.22);\n  let skyReach = mix(verticalEscape, horizonReach, horizonBand);\n  let directionalReach = select(skyReach, max(skyReach, downReach), rayDir.y < -0.02);\n  return max(directionalReach, scale * mix(0.62, 1.35, h));\n}\n\nfn previewCloudAerialDistance(rayDir: vec3<f32>, cloudDisplayA: f32, fogHorizon: f32) -> f32 {\n  let hit = previewBoxHit(R.camPos, rayDir);\n  let hasHit = hit.x <= hit.y && hit.y > 0.0;\n  let entry = max(hit.x, 0.0);\n  let span = max(hit.y - entry, 0.0);\n  let a = smoothstep(0.02, 0.98, clamp(cloudDisplayA, 0.0, 1.0));\n  let thinThrough = pow(max(1.0 - a, 0.0), 0.58);\n  let surfaceDepth = mix(0.28, 0.86, thinThrough);\n  let hitDistance = entry + span * surfaceDepth;\n  let fallbackDistance = previewSkyAerialDistance(rayDir, fogHorizon) * mix(0.42, 0.86, thinThrough);\n  return select(fallbackDistance, max(hitDistance, fallbackDistance * 0.16), hasHit);\n}\n\nfn previewCloudBoxImmersion(fogHorizon: f32) -> f32 {\n  let half = max(R.boxHalf, vec3<f32>(0.001, 0.001, 0.001));\n  let ext = vec3<f32>(half.x, half.y * 1.55 + 0.25, half.z);\n  let q = abs(R.camPos - R.boxCenter) / max(ext, vec3<f32>(0.001, 0.001, 0.001));\n  let maxQ = max(max(q.x, q.y), q.z);\n  let inside = select(0.0, 1.0, maxQ <= 1.0);\n  let edgeEase = 1.0 - smoothstep(0.70, 1.0, maxQ);\n  let altitudeDensity = previewAerosolDensityAtY(R.camPos.y, fogHorizon);\n  return inside * max(edgeEase, 0.32) * altitudeDensity;\n}\n\nfn previewAerialFogAmount(distance: f32, rayDir: vec3<f32>, fogDensity: f32, fogHorizon: f32, fogSun: f32, lowSun: f32, towardSun: f32, jitter: f32) -> f32 {\n  if (fogDensity <= 0.0001) {\n    return 0.0;\n  }\n\n  let scale = previewAtmosScale();\n  let h = clamp(fogHorizon * 0.50, 0.0, 1.0);\n  let horizonBand = previewHorizonBand(rayDir, fogHorizon);\n  let grazing = min(1.0 / max(abs(rayDir.y) * 2.00 + 0.22, 0.22), 4.55);\n  let pathBoost = mix(1.0, grazing, horizonBand * clamp(fogHorizon * 0.48, 0.0, 0.92));\n  let lowAltitudeBoost = mix(0.92, 1.22, lowSun);\n  let aerosolDistance = previewAerosolPathDistance(distance, rayDir, fogHorizon, jitter);\n  let extinction = fogDensity * mix(1.10, 2.05, h) * lowAltitudeBoost;\n  let opticalDepth = aerosolDistance / max(scale, 0.001) * extinction * pathBoost;\n  let rayleighMie = 1.0 - exp(-opticalDepth);\n  let sun01 = clamp(towardSun, 0.0, 1.0);\n  let fogSun01 = clamp(fogSun * 0.50, 0.0, 1.0);\n  let sunCore = pow(sun01, mix(10.0, 2.65, fogSun01));\n  let sunWide = pow(sun01, mix(4.10, 1.55, fogSun01));\n  let forwardScatter =\n    (1.0 - exp(-opticalDepth * 0.66)) *\n    fogSun *\n    (sunCore * mix(0.050, 0.360, lowSun) + sunWide * mix(0.020, 0.120, lowSun));\n  return clamp(rayleighMie + forwardScatter, 0.0, 0.94);\n}\n\nfn previewSunConeHaze(towardSun: f32, fogDensity: f32, fogSun: f32, lowSun: f32) -> f32 {\n  let sun01 = clamp(towardSun, 0.0, 1.0);\n  let fogSun01 = clamp(fogSun * 0.50, 0.0, 1.0);\n  let densityGate = smoothstep(0.020, 0.38, clamp(fogDensity, 0.0, 2.0));\n  let wide = pow(sun01, mix(2.45, 1.38, fogSun01));\n  let core = pow(sun01, mix(9.00, 3.55, fogSun01));\n  let daylightScatter = 0.48 + 0.52 * lowSun;\n  return (wide * 0.145 + core * 0.205) * fogSun01 * densityGate * daylightScatter;\n}\n\nfn previewAerialFogColor(\n  horizonSky: vec3<f32>,\n  zenithSky: vec3<f32>,\n  sunWash: vec3<f32>,\n  shadowCool: vec3<f32>,\n  rayDir: vec3<f32>,\n  towardSun: f32,\n  fogHorizon: f32,\n  fogSun: f32,\n  lowSun: f32\n) -> vec3<f32> {\n  let horizonBand = previewHorizonBand(rayDir, fogHorizon);\n  let hMix = clamp(horizonBand * (0.68 + 0.24 * clamp(fogHorizon, 0.0, 1.0)) + 0.10, 0.0, 1.0);\n  let base = mix(zenithSky, horizonSky, hMix);\n  let sun01 = clamp(towardSun, 0.0, 1.0);\n  let fogSun01 = clamp(fogSun * 0.50, 0.0, 1.0);\n  let sunCore = pow(sun01, mix(9.0, 2.4, fogSun01));\n  let sunWide = pow(sun01, mix(3.8, 1.45, fogSun01));\n  let sunMix = clamp(fogSun * (sunCore * mix(0.10, 0.66, lowSun) + sunWide * mix(0.035, 0.24, lowSun)), 0.0, 0.86);\n  let coolMix = clamp((1.0 - towardSun) * 0.10 + (1.0 - lowSun) * 0.05, 0.0, 0.20);\n  return max(mix(mix(base, shadowCool, coolMix), sunWash, sunMix), vec3<f32>(0.0));\n}\n\n// ---- faster alpha gather: fewer samples, lower LOD, and early-out ----\n// - Uses LOD = 1 to sample a smaller mip (cheaper/more cache-friendly).\n// - Uses 5 samples (center + 4 cardinal neighbors). You can reduce to 4 if needed.\n// - Caller should skip this when sun is far from pixel (d > some threshold) or when clouds are fully opaque/clear.\nfn alphaGatherFast(uv:vec2<f32>, layer:i32)->f32 {\n  // precomputed radius in uv space\n  let r = SUN_UV_RADIUS;\n  // quick 5-sample kernel (center + 4)\n  let k0 = vec2<f32>(0.0, 0.0);\n  let k1 = vec2<f32>( r, 0.0);\n  let k2 = vec2<f32>(-r, 0.0);\n  let k3 = vec2<f32>(0.0, r);\n  let k4 = vec2<f32>(0.0, -r);\n\n  // sample at a lower LOD (1.0) to reduce cost & aggregate over a coarser area\n  // note: textureSampleLevel returns a vec4; we only read .a\n  var sum = 0.0;\n  sum += clamp(textureSampleLevel(tex, samp, uv + k0, layer, 1.0).a, 0.0, 1.0);\n  sum += clamp(textureSampleLevel(tex, samp, uv + k1, layer, 1.0).a, 0.0, 1.0);\n  sum += clamp(textureSampleLevel(tex, samp, uv + k2, layer, 1.0).a, 0.0, 1.0);\n  sum += clamp(textureSampleLevel(tex, samp, uv + k3, layer, 1.0).a, 0.0, 1.0);\n  sum += clamp(textureSampleLevel(tex, samp, uv + k4, layer, 1.0).a, 0.0, 1.0);\n\n  return sum * 0.2; // divide by 5\n}\n\nfn alphaGradAt(uv:vec2<f32>, layer:i32)->vec2<f32> {\n  let dims = displayTextureDimensions();\n  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));\n\n  let r1 = px * 1.5;\n  let r2 = px * 3.0;\n\n  let aL1 = textureSampleLevel(tex, samp, uv - vec2<f32>(r1.x, 0.0), layer, 0.0).a;\n  let aR1 = textureSampleLevel(tex, samp, uv + vec2<f32>(r1.x, 0.0), layer, 0.0).a;\n  let aD1 = textureSampleLevel(tex, samp, uv - vec2<f32>(0.0, r1.y), layer, 0.0).a;\n  let aU1 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, r1.y), layer, 0.0).a;\n\n  let aL2 = textureSampleLevel(tex, samp, uv - vec2<f32>(r2.x, 0.0), layer, 1.0).a;\n  let aR2 = textureSampleLevel(tex, samp, uv + vec2<f32>(r2.x, 0.0), layer, 1.0).a;\n  let aD2 = textureSampleLevel(tex, samp, uv - vec2<f32>(0.0, r2.y), layer, 1.0).a;\n  let aU2 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, r2.y), layer, 1.0).a;\n\n  let g1 = vec2<f32>(aR1 - aL1, aU1 - aD1);\n  let g2 = vec2<f32>(aR2 - aL2, aU2 - aD2);\n\n  return g1 * 0.72 + g2 * 0.28;\n}\n\nfn alphaOpenTowardSoft(uv:vec2<f32>, dir:vec2<f32>, layer:i32)->f32 {\n  let dims = displayTextureDimensions();\n  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));\n  let pix = max(px.x, px.y);\n  let lenDir = max(length(dir), 1e-5);\n  let d = dir / lenDir;\n\n  let a0 = textureSampleLevel(tex, samp, uv + d * pix * 5.0, layer, 1.0).a;\n  let a1 = textureSampleLevel(tex, samp, uv + d * pix * 11.0, layer, 2.0).a;\n  let a2 = textureSampleLevel(tex, samp, uv + d * pix * 22.0, layer, 3.0).a;\n  let a3 = textureSampleLevel(tex, samp, uv + d * pix * 40.0, layer, 3.0).a;\n\n  let blocking = clamp(max(max(a0, a1 * 0.92), max(a2 * 0.78, a3 * 0.62)), 0.0, 1.0);\n  let open = 1.0 - blocking;\n  return smoothstep(0.18, 0.86, open);\n}\n\nfn alphaReliefStats(uv:vec2<f32>, layer:i32)->vec2<f32> {\n  let dims = displayTextureDimensions();\n  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));\n\n  let r1 = px * 2.0;\n  let r2 = px * 4.0;\n\n  let c = textureSampleLevel(tex, samp, uv, layer, 0.0).a;\n\n  let n1 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0,  r1.y), layer, 0.0).a;\n  let s1 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, -r1.y), layer, 0.0).a;\n  let e1 = textureSampleLevel(tex, samp, uv + vec2<f32>( r1.x, 0.0), layer, 0.0).a;\n  let w1 = textureSampleLevel(tex, samp, uv + vec2<f32>(-r1.x, 0.0), layer, 0.0).a;\n\n  let n2 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0,  r2.y), layer, 1.0).a;\n  let s2 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, -r2.y), layer, 1.0).a;\n  let e2 = textureSampleLevel(tex, samp, uv + vec2<f32>( r2.x, 0.0), layer, 1.0).a;\n  let w2 = textureSampleLevel(tex, samp, uv + vec2<f32>(-r2.x, 0.0), layer, 1.0).a;\n\n  let mean1 = (n1 + s1 + e1 + w1) * 0.25;\n  let mean2 = (n2 + s2 + e2 + w2) * 0.25;\n  let mean = mix(mean1, mean2, 0.35);\n\n  let cavity = clamp(mean - c, 0.0, 1.0);\n  let ridge = clamp(c - mean, 0.0, 1.0);\n  return vec2<f32>(cavity, ridge);\n}\n\nfn alphaReliefStatsFast(centerAlpha:f32, occ:f32, gradLen:f32)->vec2<f32> {\n  let cavity = clamp(occ - centerAlpha, 0.0, 1.0);\n  let ridge = clamp(centerAlpha - occ + gradLen * 1.75, 0.0, 1.0);\n  return vec2<f32>(cavity, ridge);\n}\n\nfn silverEdgeBand(alpha: f32) -> f32 {\n  let enter = smoothstep(0.08, 0.24, alpha);\n  let leave = 1.0 - smoothstep(0.26, 0.62, alpha);\n  return enter * leave;\n}\n\nfn renderSilverControl() -> f32 {\n  let x = clamp(R.silverControls.x, -12.0, 12.0);\n  let normalized = abs(x) / 12.0;\n  let curved = pow(max(normalized, 0.0), 0.46) * 2.80;\n  return clamp(sign(x) * curved, -12.0, 12.0);\n}\n\nfn renderSilverSharp01() -> f32 {\n  let normalized = clamp((max(R.silverControls.y, 0.5) - 0.5) / 47.5, 0.0, 1.0);\n  return pow(normalized, 0.38);\n}\n\nfn silverEdgeBandShaped(alpha: f32, sharp01: f32) -> f32 {\n  let enterLo = mix(0.034, 0.078, sharp01);\n  let enterHi = mix(0.205, 0.290, sharp01);\n  let leaveLo = mix(0.74, 0.30, sharp01);\n  let leaveHi = mix(1.06, 0.56, sharp01);\n  let enter = smoothstep(enterLo, enterHi, alpha);\n  let leave = 1.0 - smoothstep(leaveLo, max(leaveLo + 0.035, leaveHi), alpha);\n  return enter * leave;\n}\n\nfn cloudCoreMask(alpha: f32, occ: f32, edge: f32) -> f32 {\n  let body = smoothstep(0.44, 0.92, alpha);\n  let dense = smoothstep(0.52, 0.96, occ);\n  return body * dense * (1.0 - edge);\n}\n\n\nfn inside01(uv:vec2<f32>)->f32 {\n  return select(0.0, 1.0, all(uv >= vec2<f32>(0.0, 0.0)) && all(uv <= vec2<f32>(1.0, 1.0)));\n}\n\nfn sampleAlphaWide(\n  uv: vec2<f32>,\n  layer: i32,\n  lod: f32,\n  width: f32,\n  dir: vec2<f32>,\n  perp: vec2<f32>\n) -> f32 {\n  let uv0 = clamp(uv, vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999));\n  let uv1 = clamp(uv + perp * width * 0.82, vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999));\n  let uv2 = clamp(uv - perp * width * 0.82, vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999));\n\n  let a0 = clamp(textureSampleLevel(tex, samp, uv0, layer, lod).a, 0.0, 1.0);\n  let a1 = clamp(textureSampleLevel(tex, samp, uv1, layer, lod).a, 0.0, 1.0);\n  let a2 = clamp(textureSampleLevel(tex, samp, uv2, layer, lod).a, 0.0, 1.0);\n\n  return clamp(a0 * 0.46 + (a1 + a2) * 0.27, 0.0, 1.0);\n}\n\nfn godRayShaft(\n  uv: vec2<f32>,\n  uvSun: vec2<f32>,\n  layer: i32,\n  fwdDot: f32,\n  towardSun: f32,\n  cloudA: f32,\n  lowSun: f32\n) -> vec2<f32> {\n  let enabled = clamp(R.godRayControls.x, 0.0, 1.0);\n  let strength = clamp(R.godRayControls.y, 0.0, 3.0) * enabled;\n  if (strength <= 0.0001 || fwdDot <= -0.08) {\n    return vec2<f32>(0.0, 0.0);\n  }\n\n  let sunHint = stableSunHintUV(uvSun);\n  let fromSun = uv - sunHint;\n  let dist = length(fromSun);\n  if (dist <= 1e-5) {\n    return vec2<f32>(0.0, 0.0);\n  }\n\n  let dir = fromSun / dist;\n  let perp = vec2<f32>(-dir.y, dir.x);\n\n  let rayLength = clamp(R.godRayControls.z, 0.10, 2.0);\n  let falloff = clamp(R.godRayControls.w, 0.20, 4.0);\n\n  let screenGate = select(\n    0.70,\n    1.0,\n    all(uvSun >= vec2<f32>(-0.25, -0.25)) && all(uvSun <= vec2<f32>(1.25, 1.25))\n  ) * smoothstep(-0.08, 0.22, fwdDot);\n\n  if (screenGate <= 0.0001) {\n    return vec2<f32>(0.0, 0.0);\n  }\n\n  let span = mix(0.52, 1.55, clamp(rayLength * 0.60, 0.0, 1.0));\n  let reach = min(dist, span);\n  let radialX = dist / max(span, 0.001);\n  let radialGate = 1.0 / (1.0 + radialX * radialX * mix(1.45, 2.35, clamp(falloff * 0.22, 0.0, 1.0)));\n  let angularGate = smoothstep(0.08, 0.88, towardSun) * mix(0.68, 1.22, lowSun);\n\n  let horizonFog = pow(clamp(1.0 - abs(uv.y - 0.55) * 2.0, 0.0, 1.0), 0.48);\n  let upperFog = pow(clamp(1.0 - uv.y, 0.0, 1.0), 0.30);\n  let fogDensity = mix(0.34, 0.92, max(horizonFog, upperFog * 0.42)) * mix(0.74, 1.18, lowSun);\n\n  let localFadeA = pow(max(1.0 - cloudA, 0.0), 1.10);\n  let localFadeB = pow(max(1.0 - cloudA, 0.0), 1.95);\n  let edgeBand = smoothstep(0.035, 0.22, cloudA) * (1.0 - smoothstep(0.24, 0.62, cloudA));\n  let localFade = mix(localFadeA, localFadeB, smoothstep(0.22, 0.82, cloudA)) * (1.0 - 0.62 * edgeBand);\n\n  var samples: u32 = 8u;\n  if (R.compositeQuality >= 1u) {\n    samples = 12u;\n  }\n  if (R.compositeQuality >= 2u) {\n    samples = 16u;\n  }\n\n  let dims = displayTextureDimensions();\n  let pix = 1.0 / max(min(dims.x, dims.y), 1.0);\n  let pixelCell = floor(uv * dims);\n  let coarseCell = floor(uv * dims * 0.18);\n  let baseRand = mix(hash12(coarseCell + sunHint * 19.1), hash12(pixelCell + sunHint * 7.7), 0.35);\n  let stepBase = reach / max(f32(samples), 1.0);\n  let windowPre = radialGate * angularGate * screenGate * fogDensity * strength;\n  if (windowPre <= 0.00001) {\n    return vec2<f32>(0.0, 0.0);\n  }\n\n  var transmittance = 1.0;\n  var brightAccum = 0.0;\n  var blockerAccum = 0.0;\n  var edgeAccum = 0.0;\n  var weightAccum = 0.0;\n\n  var prevOcc = clamp(textureSampleLevel(\n    tex,\n    samp,\n    clamp(sunHint, vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999)),\n    layer,\n    2.5\n  ).a, 0.0, 1.0);\n\n  for (var i: u32 = 0u; i < 16u; i = i + 1u) {\n    if (i >= samples) {\n      break;\n    }\n\n    let u = (f32(i) + baseRand) / f32(samples);\n    let t = pow(u, 0.88);\n    let along = reach * t;\n\n    let beamWidth = max(\n      mix(0.0065, 0.034, sqrt(t)) *\n      mix(0.92, 1.34, lowSun) *\n      mix(1.00, 1.26, clamp(dist / max(span, 0.001), 0.0, 1.0)),\n      pix * mix(3.5, 7.5, sqrt(t))\n    );\n\n    let jitter =\n      (hash12(pixelCell + vec2<f32>(f32(i) * 7.13, f32(i) * 3.17)) * 2.0 - 1.0) *\n      beamWidth *\n      0.10;\n\n    let suv = clamp(\n      sunHint + dir * along + perp * jitter,\n      vec2<f32>(0.001, 0.001),\n      vec2<f32>(0.999, 0.999)\n    );\n\n    let lod = mix(3.5, 1.85, t);\n    let occRaw = sampleAlphaWide(suv, layer, lod, beamWidth, dir, perp);\n    let occWide = textureSampleLevel(tex, samp, suv, layer, min(lod + 1.25, 4.0)).a;\n    let occ = mix(occRaw, clamp(occWide, 0.0, 1.0), 0.28);\n    let edge = abs(occ - prevOcc) * 0.72;\n\n    let stepLen = max(stepBase * mix(0.88, 1.12, t), 1e-4);\n    let extinction =\n      occ *\n      mix(1.45, 2.30, lowSun) *\n      mix(0.90, 1.20, smoothstep(0.015, 0.14, edge)) *\n      (stepLen / max(stepBase, 1e-4));\n\n    let stepTr = 1.0 / (1.0 + extinction * (1.0 + 0.28 * extinction));\n\n    let scatterW =\n      (1.0 - occ) *\n      mix(0.62, 0.84, smoothstep(0.015, 0.14, edge)) *\n      mix(1.0, 0.86, pow(t, 1.4));\n\n    brightAccum += transmittance * (1.0 - stepTr) * scatterW;\n    blockerAccum += (1.0 - stepTr) * mix(0.60, 1.0, t);\n    edgeAccum += edge;\n    weightAccum += 1.0;\n\n    transmittance *= stepTr;\n    prevOcc = occ;\n\n    if (transmittance < 0.01) {\n      break;\n    }\n  }\n\n  let brightBase = brightAccum / max(weightAccum * 0.110, 0.0001);\n  let blocker = blockerAccum / max(weightAccum * 0.18, 0.0001);\n  let edgeLift = smoothstep(0.024, 0.160, edgeAccum / max(weightAccum, 1.0));\n\n  let shaft = brightBase * mix(0.88, 1.02, edgeLift) * pow(max(transmittance, 0.0), 0.38);\n  let shadow = clamp(blocker * mix(0.68, 1.08, edgeLift), 0.0, 1.0);\n\n  return vec2<f32>(\n    clamp(shaft * windowPre * localFade, 0.0, 1.0),\n    clamp(shadow * windowPre, 0.0, 1.0)\n  );\n}\n\n@fragment\nfn fs_main(in:VSOut)->@location(0) vec4<f32> {\n  let layer = i32(R.layerIndex);\n  let centerTexel = sampleCloudRaw(in.uv, layer);\n  let neighborhood = sampleCloudNeighborhood(in.uv, layer, centerTexel);\n  let texel = neighborhood.filtered;\n  let alphaGate = alphaFloorGate(texel.a);\n  let cloudRGB = texel.rgb * alphaGate;\n  let cloudA = clamp(texel.a * alphaGate, 0.0, 1.0);\n  let cloudColorA = alphaColorResponse(cloudA);\n  let cloudColorLift = max(cloudColorA - cloudA, 0.0);\n\n  let rayDir = rayDirFromUV(in.uv);\n  let sunDir = normalize(R.sunDir);\n  let uvSun = projectDirToUV(sunDir);\n\n  let v = in.uv.y;\n  let horizon = pow(clamp(1.0 - abs(rayDir.y) * 7.5, 0.0, 1.0), 1.65) * 0.28;\n  let lowSunRaw = 1.0 - clamp((sunDir.y + 0.08) / 0.82, 0.0, 1.0);\n  let lowSun = clamp(pow(lowSunRaw, 0.72) * 1.18, 0.0, 1.0);\n  let towardSunSky = clamp(dot(rayDir, sunDir), 0.0, 1.0);\n\n  let style = R.gradeStyle;\n  var zenithSky = mix(R.sky * 0.98 + vec3<f32>(0.010, 0.018, 0.034), vec3<f32>(0.56, 0.66, 0.86), lowSun * 0.18);\n  var horizonSky = mix(R.sky * 0.78 + vec3<f32>(0.040, 0.056, 0.078), vec3<f32>(0.90, 0.84, 0.88), lowSun * 0.22);\n  var sunWash = mix(vec3<f32>(1.02, 0.98, 0.94), vec3<f32>(1.06, 0.90, 0.84), lowSun * 0.42);\n  var sunColor = mix(vec3<f32>(1.02, 0.98, 0.94), vec3<f32>(1.08, 0.90, 0.82), lowSun * 0.34);\n  var shadowCool = mix(vec3<f32>(0.84, 0.90, 0.98), vec3<f32>(0.76, 0.82, 0.96), lowSun * 0.26);\n  var edgeWarm = mix(vec3<f32>(1.02, 1.00, 0.98), vec3<f32>(1.08, 0.96, 0.90), lowSun * 0.34);\n  var litTintBase = vec3<f32>(0.99, 1.0, 1.0);\n  var shadowTintBase = vec3<f32>(0.84, 0.90, 0.98);\n\n  if (style == 1u) {\n    zenithSky = mix(R.sky * 0.92 + vec3<f32>(0.018, 0.012, 0.044), vec3<f32>(0.58, 0.40, 0.74), lowSun * 0.62);\n    horizonSky = mix(R.sky * 0.68 + vec3<f32>(0.094, 0.050, 0.070), vec3<f32>(1.12, 0.60, 0.42), lowSun * 0.88);\n    sunWash = mix(vec3<f32>(1.0, 0.94, 0.88), vec3<f32>(1.16, 0.68, 0.46), lowSun * 0.86);\n    sunColor = mix(vec3<f32>(1.0, 0.96, 0.90), vec3<f32>(1.12, 0.74, 0.52), lowSun * 0.78);\n    shadowCool = mix(vec3<f32>(0.94, 0.96, 1.0), vec3<f32>(0.62, 0.56, 0.82), lowSun * 0.84);\n    edgeWarm = mix(vec3<f32>(1.0, 0.97, 0.92), vec3<f32>(1.20, 0.84, 0.58), lowSun * 0.82);\n    litTintBase = mix(vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(1.20, 0.88, 0.68), lowSun * 0.82);\n    shadowTintBase = mix(vec3<f32>(0.96, 0.97, 1.0), vec3<f32>(0.40, 0.34, 0.58), lowSun * 0.86);\n  } else if (style == 2u) {\n    zenithSky = mix(R.sky * 0.88 + vec3<f32>(0.014, 0.012, 0.040), vec3<f32>(0.28, 0.22, 0.52), lowSun * 0.70);\n    horizonSky = mix(R.sky * 0.64 + vec3<f32>(0.042, 0.040, 0.076), vec3<f32>(0.84, 0.54, 0.82), lowSun * 0.74);\n    sunWash = mix(vec3<f32>(0.96, 0.92, 0.96), vec3<f32>(0.98, 0.70, 1.06), lowSun * 0.96);\n    sunColor = mix(vec3<f32>(0.98, 0.92, 0.96), vec3<f32>(1.00, 0.74, 1.08), lowSun * 0.90);\n    shadowCool = mix(vec3<f32>(0.88, 0.90, 0.99), vec3<f32>(0.66, 0.58, 0.96), lowSun * 1.00);\n    edgeWarm = mix(vec3<f32>(0.98, 0.94, 0.98), vec3<f32>(1.02, 0.80, 1.04), lowSun * 0.88);\n    litTintBase = mix(vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(1.08, 0.92, 1.04), lowSun * 0.82);\n    shadowTintBase = mix(vec3<f32>(0.96, 0.97, 1.0), vec3<f32>(0.52, 0.46, 0.88), lowSun * 1.00);\n  } else if (style == 3u) {\n    zenithSky = mix(R.sky * 0.94 + vec3<f32>(0.010, 0.016, 0.030), vec3<f32>(0.42, 0.48, 0.62), lowSun * 0.18);\n    horizonSky = mix(R.sky * 0.66 + vec3<f32>(0.030, 0.042, 0.060), vec3<f32>(0.62, 0.68, 0.78), lowSun * 0.16);\n    sunWash = mix(vec3<f32>(0.90, 0.94, 1.00), vec3<f32>(0.82, 0.88, 0.98), lowSun * 0.20);\n    sunColor = mix(vec3<f32>(0.94, 0.96, 1.00), vec3<f32>(0.88, 0.92, 0.98), lowSun * 0.18);\n    shadowCool = mix(vec3<f32>(0.90, 0.94, 1.0), vec3<f32>(0.78, 0.84, 0.96), lowSun * 0.42);\n    edgeWarm = mix(vec3<f32>(0.96, 0.97, 1.0), vec3<f32>(0.88, 0.90, 0.96), lowSun * 0.22);\n    litTintBase = vec3<f32>(0.98, 0.99, 1.0);\n    shadowTintBase = vec3<f32>(0.84, 0.89, 0.97);\n  } else if (style == 4u) {\n    zenithSky = mix(R.sky * 0.78 + vec3<f32>(0.022, 0.012, 0.018), vec3<f32>(0.18, 0.08, 0.14), lowSun * 0.82);\n    horizonSky = mix(R.sky * 0.52 + vec3<f32>(0.098, 0.026, 0.028), vec3<f32>(1.12, 0.48, 0.14), lowSun * 0.94);\n    sunWash = mix(vec3<f32>(1.02, 0.92, 0.84), vec3<f32>(1.20, 0.52, 0.20), lowSun * 0.90);\n    sunColor = mix(vec3<f32>(1.04, 0.92, 0.80), vec3<f32>(1.20, 0.56, 0.18), lowSun * 0.92);\n    shadowCool = mix(vec3<f32>(0.74, 0.68, 0.72), vec3<f32>(0.14, 0.06, 0.10), lowSun * 0.98);\n    edgeWarm = mix(vec3<f32>(1.02, 0.96, 0.90), vec3<f32>(1.24, 0.68, 0.24), lowSun * 0.96);\n    litTintBase = mix(vec3<f32>(1.0, 0.98, 0.94), vec3<f32>(1.22, 0.76, 0.40), lowSun * 0.92);\n    shadowTintBase = mix(vec3<f32>(0.24, 0.12, 0.10), vec3<f32>(0.04, 0.015, 0.022), lowSun * 1.00);\n  } else if (style == 5u) {\n    zenithSky = mix(R.sky * 0.86 + vec3<f32>(0.016, 0.012, 0.034), vec3<f32>(0.30, 0.18, 0.38), lowSun * 0.56);\n    horizonSky = mix(R.sky * 0.64 + vec3<f32>(0.054, 0.030, 0.056), vec3<f32>(0.94, 0.52, 0.50), lowSun * 0.72);\n    sunWash = mix(vec3<f32>(0.98, 0.92, 0.92), vec3<f32>(1.10, 0.66, 0.64), lowSun * 0.76);\n    sunColor = mix(vec3<f32>(1.0, 0.92, 0.90), vec3<f32>(1.10, 0.68, 0.66), lowSun * 0.76);\n    shadowCool = mix(vec3<f32>(0.90, 0.90, 1.0), vec3<f32>(0.58, 0.42, 0.96), lowSun * 0.82);\n    edgeWarm = mix(vec3<f32>(1.0, 0.96, 0.96), vec3<f32>(1.12, 0.78, 0.86), lowSun * 0.76);\n    litTintBase = mix(vec3<f32>(1.0, 0.98, 0.98), vec3<f32>(1.14, 0.84, 0.80), lowSun * 0.78);\n    shadowTintBase = mix(vec3<f32>(0.96, 0.97, 1.0), vec3<f32>(0.46, 0.32, 0.90), lowSun * 0.86);\n  } else if (style == 6u) {\n    zenithSky = mix(R.sky * 0.82 + vec3<f32>(0.028, 0.020, 0.012), vec3<f32>(0.44, 0.26, 0.14), lowSun * 0.70);\n    horizonSky = mix(R.sky * 0.58 + vec3<f32>(0.080, 0.046, 0.020), vec3<f32>(1.04, 0.62, 0.24), lowSun * 0.86);\n    sunWash = mix(vec3<f32>(1.04, 0.94, 0.80), vec3<f32>(1.18, 0.72, 0.30), lowSun * 0.86);\n    sunColor = mix(vec3<f32>(1.06, 0.94, 0.74), vec3<f32>(1.18, 0.72, 0.34), lowSun * 0.84);\n    shadowCool = mix(vec3<f32>(0.82, 0.78, 0.74), vec3<f32>(0.30, 0.16, 0.12), lowSun * 0.88);\n    edgeWarm = mix(vec3<f32>(1.04, 0.96, 0.84), vec3<f32>(1.28, 0.82, 0.34), lowSun * 0.88);\n    litTintBase = mix(vec3<f32>(1.0, 0.98, 0.90), vec3<f32>(1.22, 0.86, 0.48), lowSun * 0.86);\n    shadowTintBase = mix(vec3<f32>(0.72, 0.62, 0.58), vec3<f32>(0.18, 0.08, 0.06), lowSun * 0.90);\n  } else if (style == 7u) {\n    zenithSky = mix(R.sky * 0.86 + vec3<f32>(0.004, 0.016, 0.034), vec3<f32>(0.10, 0.24, 0.42), lowSun * 0.32);\n    horizonSky = mix(R.sky * 0.58 + vec3<f32>(0.008, 0.052, 0.072), vec3<f32>(0.24, 0.64, 0.88), lowSun * 0.42);\n    sunWash = mix(vec3<f32>(0.78, 0.96, 1.08), vec3<f32>(0.46, 0.86, 1.12), lowSun * 0.44);\n    sunColor = mix(vec3<f32>(0.78, 0.96, 1.12), vec3<f32>(0.42, 0.78, 1.16), lowSun * 0.40);\n    shadowCool = mix(vec3<f32>(0.70, 0.86, 1.0), vec3<f32>(0.06, 0.20, 0.36), lowSun * 0.62);\n    edgeWarm = mix(vec3<f32>(0.72, 0.98, 1.16), vec3<f32>(0.38, 1.08, 1.38), lowSun * 0.54);\n    litTintBase = mix(vec3<f32>(0.94, 0.98, 1.0), vec3<f32>(0.56, 0.96, 1.22), lowSun * 0.56);\n    shadowTintBase = mix(vec3<f32>(0.72, 0.84, 1.0), vec3<f32>(0.03, 0.12, 0.26), lowSun * 0.72);\n  } else if (style == 8u) {\n    zenithSky = mix(R.sky * 0.88 + vec3<f32>(0.004, 0.030, 0.028), vec3<f32>(0.08, 0.38, 0.34), lowSun * 0.50);\n    horizonSky = mix(R.sky * 0.62 + vec3<f32>(0.008, 0.074, 0.056), vec3<f32>(0.32, 0.92, 0.64), lowSun * 0.62);\n    sunWash = mix(vec3<f32>(0.80, 1.06, 0.96), vec3<f32>(0.50, 1.18, 0.80), lowSun * 0.58);\n    sunColor = mix(vec3<f32>(0.84, 1.04, 0.94), vec3<f32>(0.58, 1.16, 0.72), lowSun * 0.56);\n    shadowCool = mix(vec3<f32>(0.74, 0.92, 0.94), vec3<f32>(0.04, 0.24, 0.22), lowSun * 0.72);\n    edgeWarm = mix(vec3<f32>(0.78, 1.06, 0.96), vec3<f32>(0.38, 1.28, 0.78), lowSun * 0.68);\n    litTintBase = mix(vec3<f32>(0.96, 1.0, 0.96), vec3<f32>(0.64, 1.18, 0.82), lowSun * 0.68);\n    shadowTintBase = mix(vec3<f32>(0.76, 0.92, 0.92), vec3<f32>(0.04, 0.18, 0.18), lowSun * 0.78);\n  } else if (style == 9u) {\n    zenithSky = mix(R.sky * 0.90 + vec3<f32>(0.018, 0.018, 0.012), vec3<f32>(0.48, 0.40, 0.24), lowSun * 0.38);\n    horizonSky = mix(R.sky * 0.62 + vec3<f32>(0.052, 0.046, 0.026), vec3<f32>(0.92, 0.70, 0.34), lowSun * 0.54);\n    sunWash = mix(vec3<f32>(1.0, 0.96, 0.82), vec3<f32>(1.10, 0.88, 0.44), lowSun * 0.58);\n    sunColor = mix(vec3<f32>(1.0, 0.96, 0.80), vec3<f32>(1.12, 0.90, 0.50), lowSun * 0.52);\n    shadowCool = mix(vec3<f32>(0.84, 0.82, 0.76), vec3<f32>(0.34, 0.28, 0.18), lowSun * 0.64);\n    edgeWarm = mix(vec3<f32>(1.02, 0.98, 0.84), vec3<f32>(1.20, 0.98, 0.52), lowSun * 0.60);\n    litTintBase = mix(vec3<f32>(1.0, 0.98, 0.90), vec3<f32>(1.18, 0.98, 0.58), lowSun * 0.58);\n    shadowTintBase = mix(vec3<f32>(0.72, 0.70, 0.64), vec3<f32>(0.20, 0.16, 0.10), lowSun * 0.68);\n  } else if (style == 10u) {\n    zenithSky = mix(R.sky * 0.86 + vec3<f32>(0.020, 0.010, 0.024), vec3<f32>(0.34, 0.14, 0.28), lowSun * 0.58);\n    horizonSky = mix(R.sky * 0.62 + vec3<f32>(0.064, 0.024, 0.040), vec3<f32>(1.02, 0.46, 0.58), lowSun * 0.74);\n    sunWash = mix(vec3<f32>(1.0, 0.88, 0.94), vec3<f32>(1.16, 0.60, 0.76), lowSun * 0.74);\n    sunColor = mix(vec3<f32>(1.0, 0.88, 0.94), vec3<f32>(1.12, 0.60, 0.80), lowSun * 0.72);\n    shadowCool = mix(vec3<f32>(0.86, 0.82, 0.96), vec3<f32>(0.30, 0.12, 0.34), lowSun * 0.82);\n    edgeWarm = mix(vec3<f32>(1.0, 0.92, 0.98), vec3<f32>(1.18, 0.70, 0.96), lowSun * 0.74);\n    litTintBase = mix(vec3<f32>(1.0, 0.96, 0.98), vec3<f32>(1.16, 0.78, 0.88), lowSun * 0.76);\n    shadowTintBase = mix(vec3<f32>(0.84, 0.78, 0.96), vec3<f32>(0.20, 0.08, 0.28), lowSun * 0.86);\n  } else if (style == 11u) {\n    zenithSky = mix(R.sky * 0.84 + vec3<f32>(0.004, 0.008, 0.030), vec3<f32>(0.04, 0.10, 0.30), lowSun * 0.22);\n    horizonSky = mix(R.sky * 0.58 + vec3<f32>(0.006, 0.014, 0.060), vec3<f32>(0.14, 0.30, 0.74), lowSun * 0.30);\n    sunWash = mix(vec3<f32>(0.72, 0.84, 1.10), vec3<f32>(0.38, 0.54, 1.16), lowSun * 0.36);\n    sunColor = mix(vec3<f32>(0.74, 0.86, 1.14), vec3<f32>(0.44, 0.58, 1.18), lowSun * 0.34);\n    shadowCool = mix(vec3<f32>(0.62, 0.72, 1.0), vec3<f32>(0.02, 0.04, 0.18), lowSun * 0.58);\n    edgeWarm = mix(vec3<f32>(0.72, 0.86, 1.18), vec3<f32>(0.38, 0.62, 1.42), lowSun * 0.46);\n    litTintBase = mix(vec3<f32>(0.90, 0.94, 1.0), vec3<f32>(0.52, 0.72, 1.28), lowSun * 0.50);\n    shadowTintBase = mix(vec3<f32>(0.58, 0.66, 0.96), vec3<f32>(0.015, 0.030, 0.14), lowSun * 0.64);\n  } else if (style == 12u) {\n    zenithSky = mix(R.sky * 1.02 + vec3<f32>(0.000, 0.016, 0.052), vec3<f32>(0.34, 0.54, 0.86), lowSun * 0.16);\n    horizonSky = mix(R.sky * 0.72 + vec3<f32>(0.018, 0.064, 0.126), vec3<f32>(0.66, 0.78, 0.96), lowSun * 0.18);\n    sunWash = mix(vec3<f32>(1.15, 1.06, 0.94), vec3<f32>(1.18, 0.98, 0.86), lowSun * 0.24);\n    sunColor = mix(vec3<f32>(1.16, 1.06, 0.92), vec3<f32>(1.20, 0.98, 0.84), lowSun * 0.22);\n    shadowCool = mix(vec3<f32>(0.94, 0.86, 0.76), vec3<f32>(0.86, 0.72, 0.66), lowSun * 0.34);\n    edgeWarm = mix(vec3<f32>(1.22, 1.12, 0.98), vec3<f32>(1.26, 1.04, 0.90), lowSun * 0.24);\n    litTintBase = vec3<f32>(1.15, 1.08, 0.96);\n    shadowTintBase = vec3<f32>(0.96, 0.88, 0.78);\n  } else if (style == 13u) {\n    zenithSky = mix(R.sky * 1.06 + vec3<f32>(0.000, 0.022, 0.070), vec3<f32>(0.26, 0.48, 0.88), lowSun * 0.14);\n    horizonSky = mix(R.sky * 0.70 + vec3<f32>(0.010, 0.068, 0.150), vec3<f32>(0.58, 0.74, 1.00), lowSun * 0.16);\n    sunWash = mix(vec3<f32>(1.18, 1.08, 0.96), vec3<f32>(1.22, 1.00, 0.88), lowSun * 0.22);\n    sunColor = mix(vec3<f32>(1.20, 1.08, 0.94), vec3<f32>(1.24, 1.00, 0.86), lowSun * 0.20);\n    shadowCool = mix(vec3<f32>(0.96, 0.88, 0.80), vec3<f32>(0.88, 0.74, 0.68), lowSun * 0.34);\n    edgeWarm = mix(vec3<f32>(1.26, 1.16, 1.00), vec3<f32>(1.30, 1.08, 0.92), lowSun * 0.22);\n    litTintBase = vec3<f32>(1.18, 1.10, 0.98);\n    shadowTintBase = vec3<f32>(0.98, 0.90, 0.80);\n  } else if (style == 15u) {\n    zenithSky = R.sky * 0.92 + vec3<f32>(0.000, 0.006, 0.045);\n    horizonSky = R.sky * 0.62 + vec3<f32>(0.010, 0.030, 0.112);\n    sunWash = vec3<f32>(1.26, 0.16, 0.12);\n    sunColor = vec3<f32>(1.36, 0.12, 0.10);\n    shadowCool = vec3<f32>(0.06, 0.16, 1.10);\n    edgeWarm = vec3<f32>(0.08, 1.24, 0.20);\n    litTintBase = vec3<f32>(1.18, 0.22, 0.18);\n    shadowTintBase = vec3<f32>(0.04, 0.12, 1.10);\n  }\n\n  let userSunTint = max(R.sunColorTint, vec3<f32>(0.0));\n  let userLightTint = max(R.lightTint, vec3<f32>(0.0));\n  let userShadowTint = max(R.shadowTint, vec3<f32>(0.0));\n  let userEdgeTint = max(R.edgeTint, vec3<f32>(0.0));\n\n  sunColor *= mix(vec3<f32>(1.0, 1.0, 1.0), userSunTint, 0.72);\n  sunWash *= mix(vec3<f32>(1.0, 1.0, 1.0), userSunTint, 0.26);\n\n  // Outside-view rounded volumes need atmospheric separation, not the dense\n  // immersed haze of the original thin layer. The layer path is unchanged.\n  let fogDensity = clamp(R.reservedControls.y, 0.0, 2.0) * select(1.0, 0.24, R.fieldLighting > 0.5);\n  let fogHorizon = clamp(R.reservedControls.z, 0.0, 2.0);\n  let fogSun = clamp(R.reservedControls.w, 0.0, 2.0);\n  let sunConeHaze = previewSunConeHaze(towardSunSky, fogDensity, fogSun, lowSun);\n  let sunConeHorizon = 0.58 + 0.42 * previewHorizonBand(rayDir, fogHorizon);\n\n  var sky = mix(horizonSky, zenithSky, pow(clamp(v, 0.0, 1.0), 1.35));\n  if(R.skyCycle>0.5) {\n    // Explicit linear TOD colors must not inherit a bright daytime horizon.\n    zenithSky=R.sky;\n    let twilight=(1.0-smoothstep(.05,.55,sunDir.y))*(1.0-R.nightAmount);\n    horizonSky=mix(R.sky*1.35,vec3<f32>(.65,.22,.09),twilight*.70);\n    sunColor=max(R.sunColorTint,vec3<f32>(0));\n    sunWash=sunColor;\n    shadowCool=mix(vec3<f32>(.65,.75,.90),vec3<f32>(.08,.12,.24),R.nightAmount);\n    sky=mix(horizonSky,zenithSky,pow(clamp(v,0.0,1.0),1.35));\n  }\n  sky += vec3<f32>(0.004, 0.006, 0.011) * horizon;\n  sky += sunWash * pow(towardSunSky, 5.0) * mix(0.020, 0.090, lowSun);\n  sky += sunWash * sunConeHaze * sunConeHorizon;\n\n  var sunGlow = 0.0;\n  var sunDisk = 0.0;\n  let fwdDot = dot(sunDir, R.fwd);\n\n  if (fwdDot > 0.0 && all(uvSun >= vec2<f32>(-0.25, -0.25)) && all(uvSun <= vec2<f32>(1.25, 1.25))) {\n    let d = distance(in.uv, uvSun);\n    if (d <= SUN_GLOW_RADIUS) {\n      var centerOcc = 0.0;\n      if (d <= SUN_UV_RADIUS * 3.0) {\n        centerOcc = alphaGatherFast(uvSun, layer);\n      } else {\n        centerOcc = textureSampleLevel(tex, samp, uvSun, layer, 2.0).a;\n      }\n\n      let localThrough = pow(max(1.0 - cloudA, 0.0), 0.9);\n      let centerThrough = pow(max(1.0 - clamp(centerOcc, 0.0, 1.0), 0.0), 1.35);\n      let diskGate = smoothstep(SUN_UV_RADIUS * 3.0, SUN_UV_RADIUS * 0.8, d);\n      let sunThrough = mix(localThrough, centerThrough, diskGate);\n\n      var core = smoothstep(SUN_UV_RADIUS, SUN_UV_RADIUS * 0.25, d);\n      if(R.skyCycle>0.5 && R.nightAmount>.5) {\n        // Crescent moon uses the same celestial disk, not a second light march.\n        let cut=1.0-smoothstep(SUN_UV_RADIUS*.65,SUN_UV_RADIUS*.95,distance(in.uv,uvSun+vec2<f32>(SUN_UV_RADIUS*.55,0)));\n        core*=1.0-cut;\n      }\n      let innerGlow = exp(-pow(d / (SUN_UV_RADIUS * 1.55), 2.0));\n      let outerGlow = exp(-pow(d / SUN_GLOW_RADIUS, 2.3));\n\n      sunDisk = core * sunThrough;\n      sunGlow = (innerGlow * (0.18 + 0.18 * R.sunBloom) + outerGlow * (0.03 + 0.15 * R.sunBloom)) * sunThrough;\n    }\n  }\n\n  sunDisk*=R.celestialVisibility;\n  sunGlow*=R.celestialVisibility;\n  let godRayGate = clamp(R.godRayControls.x, 0.0, 1.0) * clamp(R.godRayControls.y, 0.0, 3.0) * smoothstep(-0.04, 0.20, fwdDot) * smoothstep(0.06, 0.72, towardSunSky);\n  var godRayFog = vec2<f32>(0.0, 0.0);\n  if (godRayGate > 0.0001) {\n    godRayFog = godRayShaft(in.uv, uvSun, layer, fwdDot, towardSunSky, cloudA, lowSun);\n  }\n  let godRays = godRayFog.x;\n  let godRayShadow = godRayFog.y;\n  let godRayColor = mix(sunWash, sunColor, 0.72);\n  // Cached-volume clouds already carry resolved ray jitter. Their inexpensive\n  // smooth aerial veil needs a deterministic midpoint, not another correlated\n  // sin-hash dither visibly stamped across bright puffs at coarse resolution.\n  let fogJitter = select(previewFogJitter(in.uv), 0.5, R.fieldLighting > 0.5);\n\n  if (R.fieldLighting > 0.5) {\n    // Premultiplied radiance already contains directional light, folded normals,\n    // sun shadows and AO. Do not infer a second painted surface from 2D alpha:\n    // that flattened the puffs and outlined their soft edges in every grade.\n    let skyDistance = previewSkyAerialDistance(rayDir, fogHorizon);\n    let skyFog = previewAerialFogAmount(skyDistance, rayDir, fogDensity, fogHorizon, fogSun, lowSun, towardSunSky, fogJitter);\n    let fogColor = previewAerialFogColor(horizonSky, zenithSky, sunWash, shadowCool, rayDir, towardSunSky, fogHorizon, fogSun, lowSun);\n    let clearSky = mix(sky, fogColor, skyFog);\n    let cloudDistance = previewCloudAerialDistance(rayDir, cloudA, fogHorizon);\n    let cloudFog = min(0.14, previewAerialFogAmount(cloudDistance, rayDir, fogDensity, fogHorizon, fogSun, lowSun, towardSunSky, fogJitter));\n    let contrast = mix(1.0, 1.35, clamp(R.shadowStrength / 5.0, 0.0, 1.0));\n    // Daylight contrast must not crush low moonlit radiance into black. Keep\n    // the existing preview pivot outside the opt-in cycle, and adapt smoothly.\n    let contrastPivot = select(0.22, mix(0.22, 0.015, R.nightAmount), R.skyCycle > 0.5);\n    let contrastedCloud = max((cloudRGB - cloudA * contrastPivot) * contrast + cloudA * contrastPivot, vec3<f32>(0.0));\n    let volumeLum = luma(cloudRGB) / max(cloudA, 0.0001);\n    let volumeTint = mix(userShadowTint, userLightTint, smoothstep(0.18, 0.70, volumeLum));\n    let liftedCloud = contrastedCloud * mix(vec3<f32>(1.0), volumeTint, 0.35)\n      * mix(1.0, clamp(R.colorLift, 0.5, 2.0), 0.25) * 1.15 * max(0.0, 1.0 - R.shadowDarkness * 0.12);\n    let litCloud = max(mix(vec3<f32>(luma(liftedCloud)), liftedCloud, clamp(R.saturationBoost, 0.0, 2.20)), vec3<f32>(0.0));\n    let cloudRadiance = mix(litCloud, fogColor * cloudA, cloudFog);\n    var linear = cloudRadiance + clearSky * (1.0 - cloudA);\n    if(R.skyCycle>0.5 && R.nightAmount>.35) {\n      linear+=weatherStars(rayDir)*smoothstep(.35,.90,R.nightAmount)*(1.0-cloudA);\n    }\n    linear += sunColor * (1.18 * sunDisk + 0.22 * sunGlow);\n    linear += godRayColor * godRays * (0.40 + 0.86 * lowSun) * (1.0 - cloudA);\n    let mapped = toneMapFilmic(linear * max(R.exposure * 0.80, 0.0));\n    return vec4<f32>(applyStyleGrade(mapped, style, cloudA), 1.0);\n  }\n\n  if (cloudA < 0.003) {\n    var clearLinear =\n      sky * (1.0 - godRayShadow * (0.16 + 0.34 * lowSun)) +\n      sunColor * (1.18 * sunDisk + 0.22 * sunGlow) +\n      godRayColor * godRays * (0.40 + 0.86 * lowSun);\n\n    let skyFogDistance = previewSkyAerialDistance(rayDir, fogHorizon);\n    let skyFogAmount = previewAerialFogAmount(skyFogDistance, rayDir, fogDensity, fogHorizon, fogSun, lowSun, towardSunSky, fogJitter);\n    let skyFogColor = previewAerialFogColor(horizonSky, zenithSky, sunWash, shadowCool, rayDir, towardSunSky, fogHorizon, fogSun, lowSun);\n    clearLinear = mix(clearLinear, skyFogColor, skyFogAmount);\n    clearLinear += sunWash * sunConeHaze * (0.34 + 0.18 * R.sunBloom) * (1.0 - skyFogAmount * 0.42);\n\n    let clearMapped = toneMapFilmic(clearLinear * max(R.exposure * 0.80, 0.0));\n    let clearStyled = applyStyleGrade(clearMapped, style, 0.0);\n    return vec4<f32>(pow(clearStyled, vec3<f32>(0.99, 0.995, 1.0)), 1.0);\n  }\n  var sunEdgeSilver = 0.0;\n  var bodyShadow = 0.0;\n  var cavity = 0.0;\n  var ridge = 0.0;\n  var surfaceLit = 0.0;\n  var gradLenCached = 0.0;\n  var occCached = cloudA;\n  var upperExposureCached = 0.55;\n\n  if (R.compositeQuality >= 1u) {\n    let grad = neighborhood.grad;\n    let gradLen = length(grad);\n    gradLenCached = gradLen;\n    let towardSun = clamp(dot(rayDir, sunDir), 0.0, 1.0);\n    var facing = 0.0;\n    var upperExposure = 0.55;\n    if (gradLen > 1e-5) {\n      let gradDir = grad / gradLen;\n      let outward = -gradDir;\n      let toSunScreen = normalize(uvSun - in.uv + vec2<f32>(1e-5, 0.0));\n      facing = clamp(dot(outward, toSunScreen), 0.0, 1.0);\n      upperExposure = smoothstep(-0.22, 0.52, dot(outward, vec2<f32>(0.0, -1.0)));\n    }\n    upperExposureCached = upperExposure;\n\n    let edge = smoothstep(0.012, 0.065, gradLen);\n    let edgeBand = silverEdgeBand(cloudA);\n    let occ = neighborhood.occ;\n    occCached = occ;\n    let powder = 0.34 + 0.66 * pow(clamp(occ * (1.0 - occ) * 4.0, 0.0, 1.0), 0.72);\n    let nearSun = stableSunProximity(in.uv, uvSun, towardSun, fwdDot);\n    let forwardCone = smoothstep(0.55, 0.985, towardSun);\n    sunEdgeSilver = edge * edgeBand * mix(0.42, 1.0, facing) * powder * nearSun * forwardCone * mix(0.82, 1.0, upperExposure);\n\n    let coreMask = cloudCoreMask(cloudA, occ, edge);\n    let awayFromSun = 1.0 - towardSun;\n    let surfaceFacing = clamp(mix(upperExposure, facing, 0.62), 0.0, 1.0);\n    let fluffySurface = pow(clamp(1.0 - occ * 0.86, 0.0, 1.0), 0.72) * mix(0.64, 1.0, upperExposure);\n    surfaceLit = coreMask * smoothstep(0.18, 0.96, surfaceFacing) * fluffySurface * smoothstep(0.08, 0.92, towardSun);\n    bodyShadow = coreMask * mix(0.055, 0.18, awayFromSun) * mix(1.0, 0.72, facing) * mix(1.0, 0.78, surfaceLit);\n    ridge = edge * edgeBand * (0.42 + 0.22 * surfaceLit);\n    cavity = smoothstep(0.55, 0.96, occ) * smoothstep(0.35, 0.98, cloudA) * 0.22;\n  } else {\n    if (fwdDot > -0.10) {\n      let sunHint = stableSunHintUV(uvSun);\n      let dSun = distance(in.uv, sunHint);\n      let grad = alphaGradAt(in.uv, layer);\n      let gradLen = length(grad);\n      gradLenCached = gradLen;\n      let towardSun = clamp(dot(rayDir, sunDir), 0.0, 1.0);\n\n      var facing = 0.0;\n      var openSoft = 1.0;\n      var upperExposure = 0.55;\n      if (gradLen > 1e-5 && dSun > 1e-5) {\n        let toSun = (uvSun - in.uv) / dSun;\n        let gradDir = grad / gradLen;\n        let outward = -gradDir;\n        facing = clamp(dot(outward, toSun), 0.0, 1.0);\n        openSoft = alphaOpenTowardSoft(in.uv, toSun, layer);\n        upperExposure = smoothstep(-0.22, 0.52, dot(outward, vec2<f32>(0.0, -1.0)));\n      }\n      upperExposureCached = upperExposure;\n\n      let edge = smoothstep(0.016, 0.072, gradLen);\n      let edgeBand = silverEdgeBand(cloudA);\n      let occ = clamp(alphaGatherFast(in.uv, layer), 0.0, 1.0);\n      occCached = occ;\n      let powder = 0.34 + 0.66 * pow(clamp(occ * (1.0 - occ) * 4.0, 0.0, 1.0), 0.72);\n      let nearSun = stableSunProximity(in.uv, uvSun, towardSun, fwdDot);\n      let forwardCone = smoothstep(0.55, 0.985, towardSun);\n      let exposedGate = openSoft * mix(0.74, 1.0, upperExposure);\n\n      sunEdgeSilver = edge * edgeBand * facing * powder * nearSun * forwardCone * exposedGate;\n\n      let coreMask = cloudCoreMask(cloudA, occ, edge);\n      let sunFacing = smoothstep(0.38, 0.96, towardSun);\n      let silhouette = coreMask * sunFacing * nearSun * mix(0.10, 0.32, 1.0 - facing) * smoothstep(0.12, 0.92, 1.0 - openSoft);\n      let surfaceFacing = clamp(mix(upperExposure, facing, 0.58), 0.0, 1.0);\n      let fluffySurface = pow(clamp(1.0 - occ * 0.82, 0.0, 1.0), 0.76) * mix(0.70, 1.0, openSoft) * mix(0.66, 1.0, upperExposure);\n      surfaceLit = coreMask * smoothstep(0.18, 0.94, surfaceFacing) * fluffySurface * sunFacing;\n      let awayFromSun = 1.0 - towardSun;\n      bodyShadow = (coreMask * mix(0.06, 0.20, awayFromSun) + silhouette) * mix(1.0, 0.80, surfaceLit);\n    }\n\n    let relief = alphaReliefStatsFast(cloudA, occCached, gradLenCached);\n    cavity = smoothstep(0.015, 0.110, relief.x) * smoothstep(0.22, 0.92, cloudA);\n    ridge = smoothstep(0.010, 0.080, relief.y) * smoothstep(0.16, 0.86, cloudA);\n  }\n\n  let bodyMask = smoothstep(0.22, 0.92, cloudA);\n  let bodyCore = smoothstep(0.48, 0.96, cloudA) * (1.0 - smoothstep(0.010, 0.050, gradLenCached));\n  let cavityShadow = cavity * bodyMask * mix(0.08, 0.22, bodyShadow) * mix(1.0, 0.82, bodyCore);\n  let ridgeLift = ridge * (1.0 - cavity) * (0.030 + 0.060 * (1.0 - bodyShadow));\n  let finalShadow = clamp(bodyShadow + cavityShadow, 0.0, mix(0.72, 0.62, bodyCore));\n  let fluffyLight = clamp(surfaceLit * (0.62 + 0.38 * bodyMask) + ridgeLift * 0.52, 0.0, 1.0);\n  let softWrap = clamp((1.0 - finalShadow) * (0.28 + 0.72 * fluffyLight) * (0.20 + 0.80 * bodyMask), 0.0, 1.0);\n\n  let userShadowStrength = clamp(R.shadowStrength, 0.0, 5.00);\n  let userColorLift = clamp(R.colorLift, 0.0, 2.20);\n  let userSaturation = clamp(R.saturationBoost, 0.0, 2.20);\n  let userRimStrength = clamp(R.styleControls.x, 0.0, 2.20);\n  let userSunBleed = clamp(R.styleControls.y, 0.0, 2.20);\n  let userShadowEdge = clamp(R.styleControls.z, 0.0, 2.20);\n  let userMidLift = clamp(R.styleControls.w, 0.0, 2.20);\n  let userShadowDarkness = clamp(R.shadowDarkness, 0.0, 6.00);\n  let rimDrive = pow(clamp(userRimStrength / 1.60, 0.0, 1.0), 0.34);\n  let bleedDrive = pow(clamp(userSunBleed / 1.60, 0.0, 1.0), 0.30);\n  let rimGain = userRimStrength * mix(1.35, 4.80, rimDrive);\n  let bleedGain = userSunBleed * mix(1.35, 5.10, bleedDrive);\n  let userSilverIntensity = renderSilverControl();\n  let userSilverAbs = abs(userSilverIntensity);\n  let userSilverSign = sign(userSilverIntensity);\n  let userSilverSharp01 = renderSilverSharp01();\n\n  var styleLightBoost = 1.10;\n  var styleShadowDarkness = 0.14;\n  var styleRimBoost = 1.16;\n  var styleShadowColorAmt = 0.68;\n  var styleBaseMix = 0.82;\n  var styleMidLift = 0.18;\n  var styleSunInfluence = 0.10;\n  if (style == 1u) {\n    styleLightBoost = 1.22;\n    styleShadowDarkness = 0.26;\n    styleRimBoost = 1.18;\n    styleShadowColorAmt = 0.96;\n    styleBaseMix = 0.94;\n    styleMidLift = 0.13;\n    styleSunInfluence = 0.08;\n  } else if (style == 2u) {\n    styleLightBoost = 1.05;\n    styleShadowDarkness = 0.28;\n    styleRimBoost = 1.03;\n    styleShadowColorAmt = 0.92;\n    styleBaseMix = 0.91;\n    styleMidLift = 0.16;\n    styleSunInfluence = 0.12;\n  } else if (style == 3u) {\n    styleLightBoost = 0.98;\n    styleShadowDarkness = 0.18;\n    styleRimBoost = 0.96;\n    styleShadowColorAmt = 0.80;\n    styleBaseMix = 0.84;\n    styleMidLift = 0.08;\n    styleSunInfluence = 0.08;\n  } else if (style == 4u) {\n    styleLightBoost = 1.14;\n    styleShadowDarkness = 0.46;\n    styleRimBoost = 1.14;\n    styleShadowColorAmt = 0.96;\n    styleBaseMix = 0.94;\n    styleMidLift = 0.06;\n    styleSunInfluence = 0.16;\n  } else if (style == 5u) {\n    styleLightBoost = 1.06;\n    styleShadowDarkness = 0.30;\n    styleRimBoost = 1.05;\n    styleShadowColorAmt = 0.92;\n    styleBaseMix = 0.91;\n    styleMidLift = 0.15;\n    styleSunInfluence = 0.12;\n  } else if (style == 6u) {\n    styleLightBoost = 1.16;\n    styleShadowDarkness = 0.38;\n    styleRimBoost = 1.12;\n    styleShadowColorAmt = 0.94;\n    styleBaseMix = 0.92;\n    styleMidLift = 0.10;\n    styleSunInfluence = 0.14;\n  } else if (style == 7u) {\n    styleLightBoost = 0.98;\n    styleShadowDarkness = 0.34;\n    styleRimBoost = 1.18;\n    styleShadowColorAmt = 0.92;\n    styleBaseMix = 0.90;\n    styleMidLift = 0.12;\n    styleSunInfluence = 0.10;\n  } else if (style == 8u) {\n    styleLightBoost = 1.08;\n    styleShadowDarkness = 0.28;\n    styleRimBoost = 1.20;\n    styleShadowColorAmt = 0.90;\n    styleBaseMix = 0.90;\n    styleMidLift = 0.16;\n    styleSunInfluence = 0.10;\n  } else if (style == 9u) {\n    styleLightBoost = 1.00;\n    styleShadowDarkness = 0.42;\n    styleRimBoost = 1.02;\n    styleShadowColorAmt = 0.96;\n    styleBaseMix = 0.93;\n    styleMidLift = 0.06;\n    styleSunInfluence = 0.12;\n  } else if (style == 10u) {\n    styleLightBoost = 1.10;\n    styleShadowDarkness = 0.36;\n    styleRimBoost = 1.10;\n    styleShadowColorAmt = 0.94;\n    styleBaseMix = 0.92;\n    styleMidLift = 0.13;\n    styleSunInfluence = 0.12;\n  } else if (style == 11u) {\n    styleLightBoost = 0.92;\n    styleShadowDarkness = 0.48;\n    styleRimBoost = 1.06;\n    styleShadowColorAmt = 0.98;\n    styleBaseMix = 0.94;\n    styleMidLift = 0.05;\n    styleSunInfluence = 0.10;\n  } else if (style == 12u) {\n    styleLightBoost = 1.14;\n    styleShadowDarkness = 0.055;\n    styleRimBoost = 1.20;\n    styleShadowColorAmt = 0.54;\n    styleBaseMix = 0.86;\n    styleMidLift = 0.24;\n    styleSunInfluence = 0.12;\n  } else if (style == 13u) {\n    styleLightBoost = 1.18;\n    styleShadowDarkness = 0.045;\n    styleRimBoost = 1.30;\n    styleShadowColorAmt = 0.50;\n    styleBaseMix = 0.86;\n    styleMidLift = 0.26;\n    styleSunInfluence = 0.12;\n  } else if (style == 15u) {\n    styleLightBoost = 1.24;\n    styleShadowDarkness = 0.26;\n    styleRimBoost = 1.62;\n    styleShadowColorAmt = 1.00;\n    styleBaseMix = 0.94;\n    styleMidLift = 0.10;\n    styleSunInfluence = 0.04;\n  }\n\n  let daylightCreamStyle = style == 12u || style == 13u;\n  var shadowTintTarget = max(mix(shadowTintBase, userShadowTint, styleShadowColorAmt), vec3<f32>(0.015, 0.015, 0.015));\n  var litTintTarget = max(mix(litTintBase, userLightTint, 0.86), vec3<f32>(0.02, 0.02, 0.02));\n  if (daylightCreamStyle) {\n    shadowTintTarget = mix(shadowTintTarget, vec3<f32>(1.02, 0.94, 0.84), 0.42);\n    litTintTarget = mix(litTintTarget, vec3<f32>(1.22, 1.12, 0.98), 0.26);\n  }\n  let litCloudTint = litTintTarget * mix(vec3<f32>(1.0, 1.0, 1.0), sunColor, styleSunInfluence);\n  let ambientSkyMix = select(0.18, 0.018, daylightCreamStyle);\n  var coolAmbientTint = mix(shadowTintTarget, shadowTintTarget * max(R.sky + vec3<f32>(0.08, 0.10, 0.14), vec3<f32>(0.18, 0.18, 0.22)), ambientSkyMix);\n  if (daylightCreamStyle) {\n    coolAmbientTint = mix(coolAmbientTint, vec3<f32>(0.98, 0.90, 0.80), 0.46);\n  }\n  let sunsetMidMix = select(mix(0.58, 0.76, bodyCore), mix(0.70, 0.84, bodyCore), style == 1u);\n  let daylightMidMix = mix(0.34, 0.50, bodyCore);\n  let midCloudMix = select(sunsetMidMix, daylightMidMix, daylightCreamStyle);\n  let midCloudTint = mix(litCloudTint, coolAmbientTint, midCloudMix);\n  let rimTint = max(mix(edgeWarm, userEdgeTint, 0.82), vec3<f32>(0.02, 0.02, 0.02)) * mix(vec3<f32>(1.0, 1.0, 1.0), sunColor, 0.10);\n\n  let rawLum = max(luma(cloudRGB), 1e-4);\n  let unpremulCloud = cloudRGB / max(cloudA, 0.08);\n  let unpremulLum = max(luma(unpremulCloud), 1e-4);\n  let coherentAlpha = smoothstep(0.095, 0.32, max(cloudA, occCached));\n  let thinHaloSuppress = smoothstep(0.080, 0.26, cloudA) * smoothstep(0.10, 0.34, occCached);\n  let opticalDepth = clamp(cloudA * 0.78 + occCached * 0.52 + bodyCore * 0.36, 0.0, 1.0);\n  let imageCavity = clamp(1.0 - smoothstep(0.16, 0.72, unpremulLum), 0.0, 1.0) * smoothstep(0.18, 0.84, cloudA);\n  let baseBodyLum = clamp(mix(rawLum * 1.18, unpremulLum * cloudColorA, 0.62), 0.025, 1.45);\n  let detailTint = mix(vec3<f32>(1.0, 1.0, 1.0), clamp(unpremulCloud / max(vec3<f32>(unpremulLum), vec3<f32>(0.001)), vec3<f32>(0.92), vec3<f32>(1.08)), 0.18);\n\n  let directSurface = clamp(surfaceLit * (0.72 + 0.28 * bodyMask) + ridgeLift * 0.64 + softWrap * 0.18, 0.0, 1.0);\n  let rimBandBase = clamp(sunEdgeSilver * (0.62 + 0.38 * (1.0 - bodyCore)) * mix(0.28, 1.0, thinHaloSuppress), 0.0, 1.0);\n  let rimBand = clamp(pow(rimBandBase, mix(0.72, 0.30, rimDrive)) * rimGain * 1.36, 0.0, 1.0);\n  let shapedSilverEdge = silverEdgeBandShaped(cloudA, userSilverSharp01);\n  let defaultSilverEdge = max(silverEdgeBand(cloudA), 0.06);\n  let silverRamp = pow(clamp(rimBandBase * (shapedSilverEdge / defaultSilverEdge), 0.0, 1.0), mix(0.54, 0.18, userSilverSharp01));\n  let silverBand = clamp(silverRamp * userSilverAbs * mix(1.30, 2.45, userSilverSharp01), 0.0, 1.0);\n  let lightBand = clamp(directSurface * (1.0 - cavity * 0.42) + ridgeLift * 0.48 + rimBand * 0.22 + silverBand * 0.30, 0.0, 1.0);\n  let lightBlock = clamp(1.0 - lightBand * 0.92 - rimBand * 0.48 - silverBand * 0.16, 0.0, 1.0);\n  let lowerFaceShadow =\n    smoothstep(0.10, 0.78, 1.0 - upperExposureCached) *\n    smoothstep(0.18, 0.82, max(cloudA, occCached)) *\n    (1.0 - directSurface * 0.62);\n  let broadFormShadow = clamp(\n    (\n      (1.0 - directSurface) * 0.34 +\n      lightBlock * 0.24 +\n      opticalDepth * 0.24 +\n      smoothstep(0.24, 0.86, occCached) * 0.22 +\n      lowerFaceShadow * 0.34\n    ) *\n    bodyMask *\n    clamp(1.0 - rimBand * 0.42 - silverBand * 0.24, 0.20, 1.0),\n    0.0,\n    1.0\n  );\n  let pocketOcclusion = clamp(\n    (\n      cavity * 0.34 +\n      imageCavity * 0.18 +\n      opticalDepth * (1.0 - directSurface) * 0.32 +\n      broadFormShadow * 0.48 +\n      lowerFaceShadow * 0.18\n    ) *\n    smoothstep(0.12, 0.82, max(cloudA, occCached)),\n    0.0,\n    1.0\n  );\n  let shadowRaw = (\n    finalShadow * 0.70 +\n    cavity * 0.20 +\n    imageCavity * 0.18 +\n    broadFormShadow * 0.42 +\n    opticalDepth * lightBlock * 0.30 +\n    pocketOcclusion * 0.16\n  ) * (0.62 + 0.22 * bodyCore);\n  let daylightShadowScale = select(1.0, 0.72, daylightCreamStyle);\n  let shadowSoftBand = clamp(shadowRaw * userShadowStrength * daylightShadowScale, 0.0, 1.0);\n  let shadowEdgeAmt = clamp(userShadowEdge / 2.20, 0.0, 1.0);\n  let shadowHardLo = mix(0.04, 0.30, shadowEdgeAmt);\n  let shadowHardHi = mix(0.96, 0.58, shadowEdgeAmt);\n  let shadowHardBand = smoothstep(shadowHardLo, max(shadowHardLo + 0.05, shadowHardHi), shadowSoftBand);\n  let shadowBand = mix(shadowSoftBand, shadowHardBand, shadowEdgeAmt);\n  let midBand = clamp((1.0 - lightBand * 0.62) * (1.0 - shadowBand * 0.36) * (0.46 + 0.54 * opticalDepth), 0.0, 1.0);\n  let highlightBand = clamp(lightBand * (1.0 - shadowBand * 0.42) + rimBand * 0.34 + silverBand * 0.30, 0.0, 1.0);\n  let shadowedEdgeSuppression = clamp(\n    mix(0.12, 1.0, highlightBand) *\n    mix(0.16, 1.0, 1.0 - shadowBand) *\n    mix(0.44, 1.0, 1.0 - cavity),\n    0.0,\n    1.0\n  );\n  let alphaEdgeColorBand =\n    smoothstep(0.035, 0.18, cloudA) *\n    (1.0 - smoothstep(0.30, 0.70, cloudA)) *\n    (0.54 + 0.46 * clamp(gradLenCached * 11.0, 0.0, 1.0)) *\n    mix(0.32, 1.0, thinHaloSuppress);\n  let edgeChroma = clamp(length(userEdgeTint - vec3<f32>(luma(userEdgeTint))) * 0.95, 0.0, 1.0);\n\n  let paletteBody = mix(midCloudTint, litCloudTint, highlightBand);\n  let shadowBodyDarkness = clamp(styleShadowDarkness + userShadowDarkness * 0.16, 0.0, 1.35);\n  let daylightShadowLift = select(0.0, 0.18, daylightCreamStyle);\n  let shadowBody = coolAmbientTint * (0.72 + 0.24 * baseBodyLum + daylightShadowLift) * max(0.0, 1.0 - shadowBodyDarkness * 0.82 * clamp(shadowBand, 0.0, 1.0));\n  let bodyShadowMix = select(0.70, 0.44, daylightCreamStyle);\n  let bodyTint = mix(paletteBody, shadowBody, clamp(shadowBand * bodyShadowMix, 0.0, 0.88));\n  let retainedShadowDim = select(0.88, 0.96, daylightCreamStyle);\n  let retainedShape = vec3<f32>(baseBodyLum) * mix(0.80, 1.08, highlightBand) * mix(1.0, retainedShadowDim, shadowBand);\n\n  var cloudShaded = mix(cloudRGB * vec3<f32>(0.10), bodyTint * retainedShape * detailTint, min(styleBaseMix + 0.03, 0.98));\n  cloudShaded += litCloudTint * cloudColorA * highlightBand * (0.085 + 0.095 * styleLightBoost) * (1.0 - shadowBand * 0.52);\n  cloudShaded += midCloudTint * cloudColorA * midBand * styleMidLift * userMidLift * 0.82 * select(1.0, 0.78, style == 1u);\n  cloudShaded += rimTint * rimBand * shadowedEdgeSuppression * (0.48 + 0.42 * R.sunBloom) * styleRimBoost * mix(0.62, 1.0, coherentAlpha);\n  let broadShadowTintDefault = mix(coolAmbientTint * 0.68, shadowTintTarget * 0.50, 0.46);\n  let broadShadowTint = select(broadShadowTintDefault, mix(vec3<f32>(1.04, 0.96, 0.86), coolAmbientTint, 0.42), daylightCreamStyle);\n  let broadShadowAmount = select(0.10 + 0.14 * userShadowStrength, 0.035 + 0.050 * userShadowStrength, daylightCreamStyle);\n  cloudShaded = mix(\n    cloudShaded,\n    cloudShaded * max(broadShadowTint, vec3<f32>(0.18, 0.18, 0.18)),\n    clamp(broadFormShadow * broadShadowAmount * (1.0 - highlightBand * 0.46), 0.0, select(0.32, 0.18, daylightCreamStyle))\n  );\n\n  let silverTint = mix(vec3<f32>(1.10, 1.05, 0.94), max(rimTint, vec3<f32>(0.02, 0.02, 0.02)), 0.12) * mix(vec3<f32>(1.0, 1.0, 1.0), sunColor, 0.06);\n  let silverBrightMode = clamp(userSilverSign, 0.0, 1.0);\n  let silverDarkMode = clamp(-userSilverSign, 0.0, 1.0);\n  let silverExposure = clamp((0.16 + 0.84 * highlightBand) * (0.14 + 0.86 * directSurface), 0.0, 1.0);\n  let silverGate = silverBand * shadowedEdgeSuppression * (1.0 - shadowBand * 0.58) * silverExposure * mix(0.62, 1.0, 1.0 - bodyCore);\n  let darkSilverGate = silverBand * (0.32 + 0.68 * shadowBand) * (0.28 + 0.72 * (1.0 - directSurface)) * (0.40 + 0.60 * (1.0 - bodyCore));\n  if (silverBrightMode > 0.0) {\n    let brightGate = silverGate * silverBrightMode;\n    cloudShaded += silverTint * cloudColorA * brightGate * (0.76 + 0.56 * R.sunBloom);\n    cloudShaded = mix(cloudShaded, max(cloudShaded, silverTint * max(baseBodyLum, 0.08) * (1.10 + userSilverAbs * 0.82)), clamp(brightGate * 0.52, 0.0, 0.82));\n  }\n  if (silverDarkMode > 0.0) {\n    let darkSilverTint = mix(shadowTintTarget * 0.26, coolAmbientTint * 0.44, 0.58);\n    let darkGate = clamp(darkSilverGate * silverDarkMode, 0.0, 1.0);\n    cloudShaded = mix(\n      cloudShaded,\n      cloudShaded * max(darkSilverTint, vec3<f32>(0.10, 0.11, 0.12)),\n      clamp(darkGate * (0.18 + 0.12 * userSilverAbs), 0.0, 0.76)\n    );\n  }\n\n  let shadowRimBand = clamp(\n    pow(rimBandBase, mix(0.92, 0.46, shadowEdgeAmt)) *\n    shadowBand *\n    (1.0 - highlightBand) *\n    (0.28 + 0.72 * (1.0 - directSurface)) *\n    (0.42 + 0.58 * (1.0 - bodyCore)),\n    0.0,\n    1.0\n  );\n  let shadowRimTintDefault = mix(coolAmbientTint * 0.42, shadowTintTarget * 0.30, 0.55);\n  let shadowRimTint = select(shadowRimTintDefault, mix(coolAmbientTint * 0.86, shadowTintTarget * 0.74, 0.45), daylightCreamStyle);\n  let shadowRimStrength = clamp(userShadowStrength * (0.22 + 0.78 * shadowEdgeAmt) + userShadowDarkness * 0.08, 0.0, 1.8);\n  cloudShaded = mix(\n    cloudShaded,\n    cloudShaded * max(shadowRimTint, vec3<f32>(0.12, 0.13, 0.14)),\n    clamp(shadowRimBand * shadowRimStrength * select(0.46, 0.24, daylightCreamStyle), 0.0, select(0.68, 0.34, daylightCreamStyle))\n  );\n\n  let undersideBand = clamp((1.0 - surfaceLit) * (0.30 + 0.70 * bodyCore) * (0.24 + 0.76 * shadowBand), 0.0, 1.0);\n  let undersideTintDefault = mix(shadowTintTarget * 0.44, coolAmbientTint * 0.62, 0.46);\n  let undersideTint = select(undersideTintDefault, mix(shadowTintTarget * 0.82, coolAmbientTint * 0.90, 0.52), daylightCreamStyle);\n  cloudShaded = mix(\n    cloudShaded,\n    cloudShaded * max(undersideTint, vec3<f32>(0.16, 0.17, 0.18)),\n    clamp(undersideBand * select(0.18 + 0.22 * userShadowStrength, 0.08 + 0.10 * userShadowStrength, daylightCreamStyle), 0.0, select(0.36, 0.22, daylightCreamStyle))\n  );\n\n  let brokenPocketBand =\n    smoothstep(0.020, 0.115, gradLenCached) *\n    smoothstep(0.035, 0.24, cloudA) *\n    (1.0 - smoothstep(0.62, 0.95, cloudA)) *\n    (0.42 + 0.58 * cavity) *\n    (0.32 + 0.68 * (1.0 - directSurface));\n  let pocketShadowGate = clamp(\n    brokenPocketBand *\n    (0.35 + 0.65 * shadowBand) *\n    (1.0 - highlightBand * 0.52) *\n    (0.58 + 0.42 * max(silverDarkMode, shadowEdgeAmt)),\n    0.0,\n    1.0\n  );\n  let pocketTint = mix(coolAmbientTint * 0.34, shadowTintTarget * 0.24, 0.54);\n  let daylightPocketTint = mix(coolAmbientTint * 0.76, shadowTintTarget * 0.68, 0.52);\n  cloudShaded = mix(\n    cloudShaded,\n    cloudShaded * max(select(pocketTint, daylightPocketTint, daylightCreamStyle), vec3<f32>(0.10, 0.11, 0.12)),\n    clamp(pocketShadowGate * select(0.20 + 0.25 * userShadowStrength + 0.18 * userSilverAbs * silverDarkMode, 0.08 + 0.12 * userShadowStrength + 0.08 * userSilverAbs * silverDarkMode, daylightCreamStyle), 0.0, select(0.64, 0.34, daylightCreamStyle))\n  );\n\n  let volumePocketGate = clamp(\n    pocketOcclusion *\n    (0.42 + 0.58 * shadowBand) *\n    (1.0 - highlightBand * 0.48) *\n    coherentAlpha,\n    0.0,\n    1.0\n  );\n  let volumePocketTintDefault = mix(coolAmbientTint * 0.54, shadowTintTarget * 0.38, 0.52);\n  let volumePocketTint = select(volumePocketTintDefault, mix(coolAmbientTint * 0.84, shadowTintTarget * 0.76, 0.52), daylightCreamStyle);\n  cloudShaded = mix(\n    cloudShaded,\n    cloudShaded * max(volumePocketTint, vec3<f32>(0.18, 0.19, 0.20)),\n    clamp(volumePocketGate * select(0.12 + 0.22 * userShadowStrength, 0.055 + 0.095 * userShadowStrength, daylightCreamStyle), 0.0, select(0.46, 0.24, daylightCreamStyle))\n  );\n\n  let innerLipBand = clamp(\n    smoothstep(0.14, 0.32, cloudA) *\n    (1.0 - smoothstep(0.48, 0.82, cloudA)) *\n    (0.35 + 0.65 * clamp(gradLenCached * 9.0 + rimBandBase * 0.55, 0.0, 1.0)) *\n    (0.28 + 0.72 * max(cavity, pocketOcclusion)) *\n    coherentAlpha,\n    0.0,\n    1.0\n  );\n  let innerLipTintDefault = mix(coolAmbientTint * 0.50, shadowTintTarget * 0.34, 0.54);\n  let innerLipTint = select(innerLipTintDefault, mix(coolAmbientTint * 0.82, shadowTintTarget * 0.72, 0.54), daylightCreamStyle);\n  cloudShaded = mix(\n    cloudShaded,\n    cloudShaded * max(innerLipTint, vec3<f32>(0.17, 0.18, 0.19)),\n    clamp(innerLipBand * select(0.14 + 0.18 * userShadowStrength, 0.065 + 0.090 * userShadowStrength, daylightCreamStyle) * (1.0 - highlightBand * 0.28), 0.0, select(0.42, 0.24, daylightCreamStyle))\n  );\n\n  let alphaColorTint = max(mix(edgeWarm, userEdgeTint, 0.84), vec3<f32>(0.02, 0.02, 0.02));\n  let alphaColorMix = clamp(\n    alphaEdgeColorBand *\n    mix(0.16, 1.0, shadowedEdgeSuppression) *\n    (0.09 + 0.20 * edgeChroma + 0.045 * rimGain) *\n    (0.55 + 0.45 * (1.0 - shadowBand)) *\n    (0.72 + 0.28 * userColorLift),\n    0.0,\n    0.13\n  );\n  let alphaColorLum = max(luma(cloudShaded), max(baseBodyLum * 0.42, 0.035));\n  cloudShaded = mix(cloudShaded, alphaColorTint * alphaColorLum * (1.02 + 0.14 * userColorLift), alphaColorMix);\n  cloudShaded += alphaColorTint * cloudColorLift * alphaEdgeColorBand * shadowedEdgeSuppression * (0.035 + 0.12 * edgeChroma + 0.030 * rimGain) * (1.0 - shadowBand * 0.56);\n\n  let bleedEdgeRaw = clamp(rimBandBase * (0.70 + 0.30 * (1.0 - bodyCore)) + directSurface * 0.46 + softWrap * 0.22, 0.0, 1.0);\n  let bleedEdge = clamp(pow(bleedEdgeRaw, mix(0.64, 0.24, bleedDrive)) * bleedGain, 0.0, 1.0);\n  cloudShaded += sunColor * cloudColorA * (fluffyLight * 0.052 + ridgeLift * 0.070 + softWrap * 0.034 + bleedEdge * 0.092) * (1.0 - shadowBand * 0.72) * bleedGain * mix(0.62, 1.0, thinHaloSuppress);\n  cloudShaded = mix(cloudShaded, shadowBody * baseBodyLum, clamp(shadowBand * 0.14 + imageCavity * 0.06, 0.0, 0.28));\n\n  let liftBand = clamp(midBand * 0.60 + highlightBand * 0.36 + (1.0 - shadowBand) * 0.12, 0.0, 1.0);\n  cloudShaded = mix(cloudShaded, max(cloudShaded, vec3<f32>(baseBodyLum) * vec3<f32>(0.98, 0.99, 1.0)), highlightBand * 0.14 + rimBand * 0.045 * shadowedEdgeSuppression + silverBand * 0.035);\n  let liftTint = mix(midCloudTint, litCloudTint, clamp(highlightBand * 0.58 + softWrap * 0.20, 0.0, 1.0));\n  cloudShaded += liftTint * cloudColorA * liftBand * (0.040 + 0.075 * userColorLift);\n  if (daylightCreamStyle) {\n    let creamRecover = clamp(\n      (midBand * 0.36 + highlightBand * 0.22 + (1.0 - shadowBand) * 0.12) *\n      coherentAlpha *\n      (1.0 - pocketOcclusion * 0.22),\n      0.0,\n      1.0\n    );\n    let creamTarget = max(cloudShaded, vec3<f32>(baseBodyLum) * vec3<f32>(1.12, 1.04, 0.92));\n    cloudShaded = mix(cloudShaded, creamTarget, creamRecover * 0.22);\n    cloudShaded += vec3<f32>(1.10, 0.92, 0.74) * cloudColorA * creamRecover * 0.025 * userColorLift;\n  }\n  let shadedLum = luma(cloudShaded);\n  cloudShaded = clamp(mix(vec3<f32>(shadedLum), cloudShaded, userSaturation), vec3<f32>(0.0), vec3<f32>(8.0));\n\n  if (style == 4u) {\n    let charMix = clamp(shadowBand * (0.92 + 0.08 * bodyCore) * (1.0 - highlightBand * 0.70), 0.0, 1.0);\n    let charTint = mix(vec3<f32>(0.075, 0.042, 0.034), shadowTintTarget, 0.44);\n    cloudShaded = mix(cloudShaded, cloudShaded * charTint, charMix * 0.36 * userShadowStrength);\n\n    let litRecover = clamp(highlightBand * (1.0 - shadowBand * 0.78) * (0.32 + 0.68 * bodyMask) + rimBand * 0.28 + silverBand * 0.12, 0.0, 1.0);\n    let emberTint = mix(vec3<f32>(0.90, 0.24, 0.05), vec3<f32>(1.12, 0.54, 0.14), clamp(highlightBand + rimBand, 0.0, 1.0));\n    cloudShaded += emberTint * cloudColorA * litRecover * 0.056 * userColorLift;\n  }\n\n  let sunLeak = (1.0 - shadowBand * 0.86) * (0.36 + 0.64 * (1.0 - bodyCore)) * bleedGain;\n  cloudShaded += sunWash * sunGlow * (0.008 + 0.014 * R.sunBloom) * sunLeak * mix(0.75, 1.0, shadowedEdgeSuppression);\n\n  let cloudDisplayA = alphaDisplayResponse(cloudA);\n  let wispyDisplayBand =\n    smoothstep(0.004, 0.13, cloudA) *\n    (1.0 - smoothstep(0.28, 0.74, cloudA));\n  let displayColorBoost = clamp(cloudDisplayA / max(cloudA, 0.065), 1.0, 1.24);\n  cloudShaded *= mix(1.0, displayColorBoost, wispyDisplayBand * 0.10);\n\n  let shadowDarknessNorm = clamp(userShadowDarkness / 6.0, 0.0, 1.0);\n  let shadowDarknessBase = clamp(\n    shadowBand * (0.50 + 0.34 * opticalDepth) +\n    broadFormShadow * 0.22 +\n    imageCavity * 0.14 +\n    cavity * 0.10 +\n    pocketOcclusion * 0.15,\n    0.0,\n    1.0\n  );\n  let shadowDarknessBand = clamp(pow(shadowDarknessBase, mix(1.35, 0.42, shadowDarknessNorm)) * userShadowDarkness, 0.0, 1.0);\n  let shadowDarknessFloor = mix(1.0, 0.028, shadowDarknessBand);\n  cloudShaded *= vec3<f32>(shadowDarknessFloor);\n\n  let skyMask = max(1.0 - cloudDisplayA, 0.0);\n  let skyFogMask = pow(skyMask, 0.90);\n  let lightingSkyMask = max(1.0 - cloudA, 0.0);\n  let lightingSkyFogMask = pow(lightingSkyMask, 0.90);\n  let edgeAlphaBand = smoothstep(0.03, 0.20, cloudA) * (1.0 - smoothstep(0.22, 0.58, cloudA));\n  let rayBodyMask =\n    pow(max(1.0 - max(cloudA, occCached), 0.0), 1.95) *\n    pow(max(1.0 - cloudA, 0.0), 0.65) *\n    (1.0 - 0.90 * bodyCore) *\n    (1.0 - 0.72 * edgeAlphaBand) *\n    mix(1.0, 0.72, shadowBand);\n\n  let skyFogDistance = previewSkyAerialDistance(rayDir, fogHorizon);\n  let skyFogAmount = previewAerialFogAmount(skyFogDistance, rayDir, fogDensity, fogHorizon, fogSun, lowSun, towardSunSky, fogJitter);\n  let fogColor = previewAerialFogColor(horizonSky, zenithSky, sunWash, shadowCool, rayDir, towardSunSky, fogHorizon, fogSun, lowSun);\n  let foggedSky = mix(sky, fogColor, skyFogAmount);\n\n  var linear =\n    foggedSky * skyMask * (1.0 - godRayShadow * (0.13 + 0.30 * lowSun) * skyFogMask) +\n    cloudShaded;\n  linear += sunWash * sunConeHaze * skyMask * skyFogMask * (0.32 + 0.22 * R.sunBloom);\n\n  linear += sunColor * (\n    1.04 * sunDisk +\n    (0.24 + 0.22 * R.sunBloom) * sunGlow * bleedGain +\n    (0.28 + 0.14 * R.sunBloom) * (rimBand + silverBand * silverBrightMode) * sunLeak * shadowedEdgeSuppression * mix(0.64, 1.0, thinHaloSuppress)\n  );\n\n  linear +=\n    godRayColor *\n    godRays *\n    (0.32 + 0.68 * lowSun) *\n    lightingSkyFogMask *\n    rayBodyMask;\n\n  let cloudFogDistance = previewCloudAerialDistance(rayDir, cloudDisplayA, fogHorizon);\n  let aerialFogRaw = previewAerialFogAmount(cloudFogDistance, rayDir, fogDensity, fogHorizon, fogSun, lowSun, towardSunSky, fogJitter);\n  let cloudMatterResponse = mix(0.98, 0.72, smoothstep(0.54, 1.0, bodyCore)) * mix(0.98, 0.78, smoothstep(0.72, 1.0, cloudDisplayA));\n  let skyBehindMix = pow(max(1.0 - cloudDisplayA, 0.0), 1.10);\n  let edgeMistLift = 1.0 + 0.14 * skyBehindMix + 0.08 * edgeAlphaBand;\n  let matterFogGate = smoothstep(0.006, 0.24, cloudDisplayA);\n  let immersedFog =\n    previewCloudBoxImmersion(fogHorizon) *\n    matterFogGate *\n    fogDensity *\n    mix(0.020, 0.095, clamp(fogHorizon * 0.50, 0.0, 1.0)) *\n    (1.0 - 0.42 * bodyCore) *\n    (0.70 + 0.30 * skyBehindMix);\n  let fogAmount = clamp(aerialFogRaw * cloudMatterResponse * edgeMistLift * matterFogGate + immersedFog, 0.0, 0.82);\n  linear = mix(linear, fogColor, fogAmount);\n\n  let mapped = toneMapFilmic(linear * max(R.exposure * 0.82, 0.0));\n  let styled = applyStyleGrade(mapped, style, clamp(cloudA * 1.15 + bodyCore * 0.35, 0.0, 1.0));\n  let graded = pow(styled, vec3<f32>(0.99, 0.995, 1.0));\n  return vec4<f32>(graded, 1.0);\n}\n";

  // tools/clouds/cloudFieldQuality.js
  var CLOUD_FIELD_QUALITIES = Object.freeze({
    low: Object.freeze({ label: "Low / fast", dimensions: Object.freeze([96, 48, 96]) }),
    balanced: Object.freeze({ label: "Balanced / default", dimensions: Object.freeze([128, 64, 128]) }),
    high: Object.freeze({ label: "High / finer clouds", dimensions: Object.freeze([192, 96, 192]) }),
    ultra: Object.freeze({ label: "Screenshot / finest", dimensions: Object.freeze([256, 128, 256]) })
  });

  // tools/clouds/clouds.js
  var CLOUD_GPU_CACHE = /* @__PURE__ */ new WeakMap();
  var INLINE_LAYER_OUTPUT = `fn beginLayerSample(pix: vec2<i32>) {}
fn storeLayerSample(pix: vec2<i32>, color: vec4<f32>, farHistory: f32, historyActive: bool) {
  resolveCloudColor(pix, color, farHistory, historyActive);
}`;
  function createTimedCloudModule(device2, label, code, timing) {
    const started = performance.now();
    const module = device2.createShaderModule({ label, code });
    Object.assign(timing, { sourceBytes: code.length, createMs: performance.now() - started, validationMs: null, status: "created" });
    if (typeof module.getCompilationInfo === "function") {
      const validationStarted = performance.now();
      module.getCompilationInfo().then((info) => {
        timing.validationMs = performance.now() - validationStarted;
        const errors = info.messages.filter((message) => message.type === "error");
        timing.status = errors.length ? "error" : "validated";
        if (errors.length) timing.error = errors.map((message) => message.message).join("\n");
      }).catch((error) => {
        timing.validationMs = performance.now() - validationStarted;
        timing.status = "error";
        timing.error = String(error?.message || error);
      });
    }
    return module;
  }
  function getCloudGpuCache(device2) {
    let cache = CLOUD_GPU_CACHE.get(device2);
    if (!cache) {
      cache = {
        module: null,
        fieldModule: null,
        moduleTiming: null,
        computeTimings: /* @__PURE__ */ new Map(),
        flatStagesByFormat: /* @__PURE__ */ new Map(),
        previewModule: null,
        bgl1: null,
        samplers: null,
        computeByFormat: /* @__PURE__ */ new Map(),
        previewByFormat: /* @__PURE__ */ new Map(),
        previewPromises: /* @__PURE__ */ new Map(),
        bootstrapComputeByFormat: /* @__PURE__ */ new Map(),
        bootstrapComputePromises: /* @__PURE__ */ new Map(),
        bootstrapPreviewByFormat: /* @__PURE__ */ new Map(),
        bootstrapPreviewPromises: /* @__PURE__ */ new Map(),
        upsampleByFormat: /* @__PURE__ */ new Map(),
        historyCopy: null
      };
      CLOUD_GPU_CACHE.set(device2, cache);
    }
    return cache;
  }
  var _has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  var DEG_TO_RAD = Math.PI / 180;
  var radDeg = (d) => d * DEG_TO_RAD;
  var cross3 = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  var dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  var norm3 = (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  function writeVec3Padded(dv, ofs, v) {
    dv.setFloat32(ofs, v[0], true);
    dv.setFloat32(ofs + 4, v[1], true);
    dv.setFloat32(ofs + 8, v[2], true);
    dv.setFloat32(ofs + 12, 0, true);
  }
  var normalizeTemporalRate = (value) => {
    const n = Math.max(1, Number(value) | 0);
    if (n >= 64) return 64;
    if (n >= 32) return 32;
    if (n >= 16) return 16;
    if (n >= 8) return 8;
    if (n >= 4) return 4;
    if (n >= 2) return 2;
    return 1;
  };
  var CloudComputeBuilder = class {
    constructor(device2, queue2) {
      this.device = device2;
      this.queue = queue2;
      this.weatherView = null;
      this.shape3DView = null;
      this.detail3DView = null;
      this.blueTex = null;
      this.blueView = null;
      this.motionView = null;
      this.depthPrevView = null;
      this.historyPrevView = null;
      this.historyOutView = null;
      this._retiredTextures = [];
      this._retireFlushPromise = null;
      this.outTexture = null;
      this.outView = null;
      this.outFormat = "rgba16float";
      this.width = 0;
      this.height = 0;
      this.layers = 0;
      this._coarseTexture = null;
      this._coarseView = null;
      this._coarseW = 0;
      this._coarseH = 0;
      this._coarseLayers = 0;
      this._coarseFormat = this.outFormat;
      this._wgX = 1;
      this._wgY = 1;
      this.module = null;
      this.pipeline = null;
      this._computePipelineKey = -1;
      this._computePipelineLayout = null;
      this._computePipelines = /* @__PURE__ */ new Map();
      this._computePipelinePromises = /* @__PURE__ */ new Map();
      this._historyCopy = null;
      this._historyCopyBgCache = /* @__PURE__ */ new Map();
      this._historyCopyBgKeys = [];
      this.bgl0 = null;
      this.bgl1 = null;
      this._samp2D = null;
      this._sampShape = null;
      this._sampDetail = null;
      this._sampBN = null;
      this._abOptions = new ArrayBuffer(32);
      this._dvOptions = new DataView(this._abOptions);
      this._abParams = new ArrayBuffer(112);
      this._dvParams = new DataView(this._abParams);
      this._abNTransform = new ArrayBuffer(128);
      this._dvNTransform = new DataView(this._abNTransform);
      this._abFrame = new ArrayBuffer(64);
      this._dvFrame = new DataView(this._abFrame);
      this._abLight = new ArrayBuffer(32);
      this._dvLight = new DataView(this._abLight);
      this._abView = new ArrayBuffer(128);
      this._dvView = new DataView(this._abView);
      this._abBox = new ArrayBuffer(32);
      this._dvBox = new DataView(this._abBox);
      this._abReproj = new ArrayBuffer(64);
      this._dvReproj = new DataView(this._abReproj);
      this._abPerf = new ArrayBuffer(16);
      this._dvPerf = new DataView(this._abPerf);
      this._abTuning = new ArrayBuffer(256);
      this._dvTuning = new DataView(this._abTuning);
      this._abRender = new ArrayBuffer(304);
      this._dvRender = new DataView(this._abRender);
      this._abUpsample = new ArrayBuffer(32);
      this._dvUpsample = new DataView(this._abUpsample);
      this.optionsBuffer = null;
      this.paramsBuffer = null;
      this.nTransformBuffer = null;
      this.posBuffer = null;
      this.frameBuffer = null;
      this.lightBuffer = null;
      this.viewBuffer = null;
      this.boxBuffer = null;
      this.reprojBuffer = null;
      this.perfBuffer = null;
      this.tuningBuffer = null;
      this.renderParams = null;
      this._upsample = null;
      this._upsampleParamsBuffer = null;
      this._lastSums = /* @__PURE__ */ new Map();
      this._u8Views = /* @__PURE__ */ new WeakMap();
      this._u32Views = /* @__PURE__ */ new WeakMap();
      this._resId = /* @__PURE__ */ new WeakMap();
      this._nextResId = 1;
      this._bg0Cache = /* @__PURE__ */ new Map();
      this._bg0Keys = [];
      this._bg1Cache = /* @__PURE__ */ new Map();
      this._bg1Keys = [];
      this._bg0Dirty = true;
      this._bg1Dirty = true;
      this._currentBg0 = null;
      this._currentBg1 = null;
      this._lastInterleaveStats = null;
      this._render = null;
      this._renderSourceView = null;
      this._ctxCache = /* @__PURE__ */ new WeakMap();
      this._canvasStates = /* @__PURE__ */ new WeakMap();
      this._renderBgCache = /* @__PURE__ */ new WeakMap();
      this._renderBundleCache = /* @__PURE__ */ new WeakMap();
      this._bootstrapRenderBgCache = /* @__PURE__ */ new WeakMap();
      this._ownsBlue = false;
      this._dummy2DMotion = null;
      this._dummy2DMotionView = null;
      this._dummy2DDepth = null;
      this._dummy2DDepthView = null;
      this._dummyHistoryPrev = null;
      this._dummyHistoryPrevView = null;
      this._dummyHistoryOut = null;
      this._dummyHistoryOutView = null;
      this._lastHadWork = false;
      this._reprojFullW = 0;
      this._reprojFullH = 0;
      this._state = {
        options: {
          useCustomPos: false,
          outputChannel: 0,
          writeRGB: true,
          r0: 0,
          r1: 0,
          r2: 0,
          r3: 0
        },
        params: {
          globalCoverage: 1,
          globalDensity: 1e3,
          cloudAnvilAmount: 0,
          cloudBeer: 6,
          attenuationClamp: 0.015,
          inScatterG: 0.55,
          silverIntensity: 1.15,
          silverExponent: 1.65,
          outScatterG: 0.08,
          inVsOut: 0.55,
          outScatterAmbientAmt: 0.06,
          ambientMinimum: 0.04,
          sunColor: [1, 0.985, 0.95],
          frontLightColor: [1.1, 1.12, 1.16],
          shadowLightColor: [0.58, 0.63, 0.72],
          densityDivMin: 1e-3,
          silverDirectionBias: 0.9,
          silverHorizonBoost: 0.35
        },
        ntransform: {
          shapeOffsetWorld: [0, 0, 0],
          detailOffsetWorld: [0, 0, 0],
          shapeScale: 0.13,
          detailScale: 1.35,
          weatherScale: 1,
          shapeAxisScale: [1, 1.22, 1],
          detailAxisScale: [1, 1.48, 1],
          weatherOffsetWorld: [0, 0, 0],
          weatherAxisScale: [1, 1, 1],
          shapeBias: 0,
          detailBias: 0,
          weatherBias: 0
        },
        reproj: {
          enabled: 0,
          subsample: 1,
          sampleOffset: 0,
          motionIsNormalized: 0,
          temporalBlend: 0,
          depthTest: 0,
          depthTolerance: 0,
          frameIndex: 0,
          fullWidth: 0,
          fullHeight: 0,
          temporalCellRate: 1,
          temporalCellPhase: 0,
          compactInterleave: 0
        },
        perf: {
          lodBiasMul: 1,
          coarseMipBias: 0
        },
        light: {
          sunDir: [0.65, 0.37, -0.65],
          camPos: [0, 0, 2]
        },
        box: {
          center: [0, 0, 0],
          half: [18, 0.6, 18],
          uvScale: 1
        },
        tuning: {
          maxSteps: 224,
          minStep: 3e-3,
          maxStep: 0.16,
          sunSteps: 5,
          sunStride: 4,
          sunMinTr: 3e-3,
          phaseJitter: 1,
          stepJitter: 0.3,
          baseJitterFrac: 0.02,
          topJitterFrac: 0.1,
          lodBiasWeather: 1.5,
          aabbFaceOffset: 15e-4,
          weatherRejectGate: 0.985,
          weatherRejectMip: 1,
          emptySkipMult: 4.75,
          nearFluffDist: 60,
          nearStepScale: 0.3,
          nearLodBias: -1.5,
          nearDensityMult: 2.9,
          nearDensityRange: 45,
          lodBlendThreshold: 0.46,
          sunDensityGate: 25e-4,
          fflyRelClamp: 1.6,
          fflyAbsFloor: 0.85,
          taaRelMin: 0.22,
          taaRelMax: 1.1,
          taaAbsEps: 0.02,
          farStart: 1.05,
          farFull: 4.2,
          farLodPush: 0.55,
          farDetailAtten: 0.72,
          farStepMult: 2.05,
          bnFarScale: 0.28,
          farTaaHistoryBoost: 1.8,
          raySmoothDens: 0.26,
          raySmoothSun: 0.34,
          fluffFactor: 3.4,
          anvilLift: 0.6,
          alphaCutoff: 0.98,
          thickBoxPerf: 0.65,
          thickStepBoost: 1.46,
          thickDetailSkip: 0.18,
          thickLightSkip: 0.34,
          verticalStepBoost: 3,
          verticalTextureHomogeneity: 0.46,
          verticalLightingStepBoost: 1.35,
          frontOcclusionStrength: 0.82,
          frontOcclusionAlpha: 0.58,
          frontOcclusionStepBoost: 4.2,
          sliceJitterStrength: 0.08,
          verticalLayerDecorrelation: 0.35,
          directLightBlend: 0.78,
          directLightBoost: 0.58,
          alphaBoostThreshold: 0.2,
          alphaBoostAmount: 0.14,
          minOutputAlpha: 0.12,
          outputAlphaFeather: 0.5,
          sparsity: 0.42,
          definition: 0.62,
          formType: 0,
          puffScale: 3.6,
          aoStrength: 0,
          towerHeightVariation: 0.35
        }
      };
      this._initCompute();
      this._initBuffers();
      this.setOptions();
      this.setParams();
      this.setNoiseTransforms(this._state.ntransform);
      this.setReprojSettings(this._state.reproj);
      this.setPerfParams(this._state.perf);
      this.setSunByAngles();
      this.setBox(this._state.box);
      this.setTuning(this._state.tuning);
    }
    // -------------------- helpers --------------------
    _getResId(obj) {
      if (!obj) return "null";
      if (this._resId.has(obj)) return this._resId.get(obj);
      const id = `r${this._nextResId++}`;
      this._resId.set(obj, id);
      return id;
    }
    _ensureBindGroupCaches() {
      if (!this._bg0Cache) this._bg0Cache = /* @__PURE__ */ new Map();
      if (!this._bg0Keys) this._bg0Keys = [];
      if (!this._bg1Cache) this._bg1Cache = /* @__PURE__ */ new Map();
      if (!this._bg1Keys) this._bg1Keys = [];
    }
    _clearBindGroupCaches() {
      this._ensureBindGroupCaches();
      this._bg0Cache.clear();
      this._bg1Cache.clear();
      this._bg0Keys.length = 0;
      this._bg1Keys.length = 0;
      if (this._historyCopyBgCache) this._historyCopyBgCache.clear();
      if (this._historyCopyBgKeys) this._historyCopyBgKeys.length = 0;
      this._bg0Dirty = true;
      this._bg1Dirty = true;
      this._currentBg0 = null;
      this._currentBg1 = null;
    }
    _u8(ab) {
      let v = this._u8Views.get(ab);
      if (!v) {
        v = new Uint8Array(ab);
        this._u8Views.set(ab, v);
      }
      return v;
    }
    _u32(ab) {
      let v = this._u32Views.get(ab);
      if (!v) {
        v = new Uint32Array(ab);
        this._u32Views.set(ab, v);
      }
      return v;
    }
    _sum32(ab) {
      const u = this._u32(ab);
      let s = 2166136261 >>> 0;
      for (let i = 0; i < u.length; ++i) {
        s = (s ^ u[i]) >>> 0;
        s = s + ((s << 1) + (s << 4) + (s << 7) + (s << 8) + (s << 24)) >>> 0;
      }
      return s >>> 0;
    }
    _writeIfChanged(tag, gpuBuf, ab) {
      const sum = this._sum32(ab);
      const prev = this._lastSums.get(tag);
      if (!prev || prev.sum !== sum || prev.len !== ab.byteLength) {
        this.queue.writeBuffer(gpuBuf, 0, this._u8(ab));
        this._lastSums.set(tag, { sum, len: ab.byteLength });
      }
    }
    _ensureComputeFormat(format) {
      const fmt = format || this.outFormat;
      if (fmt === this.outFormat && this.bgl0) return;
      this.outFormat = fmt;
      const d = this.device;
      const deviceCache = getCloudGpuCache(d);
      const cachedCompute = deviceCache.computeByFormat.get(this.outFormat);
      if (cachedCompute) {
        this.bgl0 = cachedCompute.bgl0;
        this._computePipelineLayout = cachedCompute.layout;
        this._computePipelines = cachedCompute.pipelines || /* @__PURE__ */ new Map();
        this._computePipelinePromises = cachedCompute.pipelinePromises || /* @__PURE__ */ new Map();
        cachedCompute.pipelinePromises = this._computePipelinePromises;
        this._computePipelineKey = this._currentComputeVariantKey();
        this.pipeline = this._computePipelines.get(this._computePipelineKey) || null;
        if (!this.pipeline) this._computePipelineKey = -1;
        this._destroyDummyHistory();
        this._createDummyHistory();
        this._clearBindGroupCaches();
        return;
      }
      this.bgl0 = d.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          {
            binding: 3,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          {
            binding: 4,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              access: "write-only",
              format: this.outFormat,
              viewDimension: "2d-array"
            }
          },
          {
            binding: 5,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "read-only-storage" }
          },
          {
            binding: 6,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          {
            binding: 7,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              access: "write-only",
              format: this.outFormat,
              viewDimension: "2d-array"
            }
          },
          {
            binding: 8,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          {
            binding: 9,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          {
            binding: 10,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          }
        ]
      });
      this._computePipelineLayout = d.createPipelineLayout({
        bindGroupLayouts: [this.bgl0, this.bgl1]
      });
      this._computePipelines = /* @__PURE__ */ new Map();
      this._computePipelinePromises = /* @__PURE__ */ new Map();
      this.pipeline = null;
      this._computePipelineKey = -1;
      deviceCache.computeByFormat.set(this.outFormat, {
        bgl0: this.bgl0,
        layout: this._computePipelineLayout,
        pipelines: this._computePipelines,
        pipelinePromises: this._computePipelinePromises
      });
      this._destroyDummyHistory();
      this._createDummyHistory();
      this._clearBindGroupCaches();
    }
    _currentComputeMode() {
      const spherical = this._dvOptions.getFloat32(16, true) >= 0.5;
      return spherical ? 1 : 0;
    }
    _currentComputeVariantKey({ coarseFactor = 1 } = {}) {
      const mode = Math.max(0, Math.min(2, this._currentComputeMode()));
      const customPos = this._dvOptions.getUint32(0, true) !== 0;
      const writeRGB = this._dvOptions.getUint32(8, true) !== 0;
      const useFields = mode === 0 && this._dvTuning.getFloat32(240, true) > 0;
      const planetStyle = mode !== 0 && this._planetStyleMode === true && this._dvTuning.getFloat32(240, true) > 0.5 && (this._dvView?.getFloat32(92, true) ?? 1) <= 1.5;
      const detailedLighting = !useFields && !planetStyle && this._dvTuning.getInt32(8, true) <= 1;
      const divider = Math.max(1, coarseFactor | 0);
      const scratchBytes = Math.max(1, Math.ceil((this.width || 1) / divider)) * Math.max(1, Math.ceil((this.height || 1) / divider)) * Math.max(1, this.layers || 1) * 32;
      const stagedResolve = mode === 0 && scratchBytes <= (this.device.limits?.maxStorageBufferBindingSize ?? 134217728);
      return mode | (customPos ? 4 : 0) | (writeRGB ? 8 : 0) | (detailedLighting ? 16 : 0) | (stagedResolve ? 32 : 0) | (useFields ? 64 : 0) | (planetStyle ? 128 : 0);
    }
    _computePipelineDescriptorForKey(key = this._currentComputeVariantKey()) {
      const mode = key & 3;
      const isSpherical = mode !== 0;
      const entryPoint = key & 128 ? "computeCloudPlanet" : isSpherical ? "computeCloudSphere" : "computeCloudBox";
      return {
        layout: key & 96 ? this._getFlatStageSetup().layout : this._computePipelineLayout,
        compute: {
          module: key & 128 ? this._getPlanetShaderModule() : key & 64 ? this._getFieldShaderModule() : key & 32 ? this._getStagedLayerShaderModule() : this.module,
          entryPoint,
          constants: {
            CLOUD_IS_SPHERICAL: isSpherical ? 1 : 0,
            CLOUD_USE_CUSTOM_POS: key & 4 ? 1 : 0,
            CLOUD_WRITE_RGB: key & 8 ? 1 : 0,
            CLOUD_DETAILED_LIGHTING: key & 16 ? 1 : 0,
            CLOUD_STAGED_RESOLVE: key & 32 ? 1 : 0,
            CLOUD_USE_FIELDS: key & 64 ? 1 : 0
          }
        }
      };
    }
    _beginComputePipelineTiming(key, async, entryPoint = key & 128 ? "computeCloudPlanet" : key & 3 ? "computeCloudSphere" : "computeCloudBox") {
      const started = performance.now();
      const timing = {
        key,
        format: this.outFormat,
        entryPoint,
        detailedLighting: !!(key & 16),
        sharedFields: typeof key === "number" ? !!(key & 64) : entryPoint !== "resolveCloudFlat",
        async,
        status: "compiling",
        compileMs: null
      };
      getCloudGpuCache(this.device).computeTimings.set(`${this.outFormat}:${key}`, timing);
      return (error) => {
        timing.compileMs = performance.now() - started;
        timing.status = error ? "error" : "ready";
        if (error) timing.error = String(error?.message || error);
      };
    }
    // Structured-cloneable; times are CPU/API wall time, not GPU timestamps.
    // Cached pipelines keep their original compilation measurement.
    getComputePipelineTimings() {
      const cache = getCloudGpuCache(this.device);
      return {
        activeKey: this._currentComputeVariantKey(),
        installedKey: this._computePipelineKey,
        module: cache.moduleTiming ? { ...cache.moduleTiming } : null,
        stagedModule: cache.stagedModuleTiming ? { ...cache.stagedModuleTiming } : null,
        fieldModule: cache.fieldModuleTiming ? { ...cache.fieldModuleTiming } : null,
        resolveModule: cache.resolveModuleTiming ? { ...cache.resolveModuleTiming } : null,
        planetModule: cache.planetModuleTiming ? { ...cache.planetModuleTiming } : null,
        variants: [...cache.computeTimings.values()].map((timing) => ({ ...timing }))
      };
    }
    _ensureComputePipelineForKey(key = this._currentComputeVariantKey()) {
      const cached = this._computePipelines.get(key);
      if (cached) return cached;
      const finish = this._beginComputePipelineTiming(key, false);
      try {
        const pipeline = this.device.createComputePipeline(
          this._computePipelineDescriptorForKey(key)
        );
        this._computePipelines.set(key, pipeline);
        finish();
        return pipeline;
      } catch (error) {
        finish(error);
        throw error;
      }
    }
    async _ensureComputePipelineForKeyAsync(key = this._currentComputeVariantKey()) {
      const pipelines = this._computePipelines;
      const pipelinePromises = this._computePipelinePromises;
      const descriptor = this._computePipelineDescriptorForKey(key);
      const cached = pipelines.get(key);
      if (cached) return cached;
      const existing = pipelinePromises.get(key);
      if (existing) return existing;
      const create = async () => {
        const async = typeof this.device.createComputePipelineAsync === "function";
        const finish = this._beginComputePipelineTiming(key, async);
        try {
          const pipeline = async ? await this.device.createComputePipelineAsync(descriptor) : this.device.createComputePipeline(descriptor);
          const installed = pipelines.get(key);
          if (!installed) pipelines.set(key, pipeline);
          finish();
          return installed || pipeline;
        } catch (error) {
          finish(error);
          throw error;
        }
      };
      const pending = create();
      pipelinePromises.set(key, pending);
      try {
        return await pending;
      } finally {
        if (pipelinePromises.get(key) === pending) {
          pipelinePromises.delete(key);
        }
      }
    }
    ensureComputePipelineReady(dispatch = {}) {
      const key = this._currentComputeVariantKey(dispatch);
      if (this.pipeline && this._computePipelineKey === key) return this.pipeline;
      this.pipeline = this._ensureComputePipelineForKey(key);
      if (key & 32) this._ensureFlatStagePipeline("resolveCloudFlat");
      if (key & 64) {
        this._ensureFlatStagePipeline("buildCloudDensityField");
        this._ensureFlatStagePipeline("buildCloudLightField");
      }
      this._computePipelineKey = key;
      return this.pipeline;
    }
    async ensureComputePipelineReadyAsync(dispatch = {}) {
      const key = this._currentComputeVariantKey(dispatch);
      const pipelines = this._computePipelines;
      if (this.pipeline && this._computePipelineKey === key) return this.pipeline;
      const [pipeline] = await Promise.all([
        this._ensureComputePipelineForKeyAsync(key),
        key & 32 ? this._ensureFlatStagePipelineAsync("resolveCloudFlat") : null,
        key & 64 ? this._ensureFlatStagePipelineAsync("buildCloudDensityField") : null,
        key & 64 ? this._ensureFlatStagePipelineAsync("buildCloudLightField") : null
      ]);
      if (this._computePipelines === pipelines && this._currentComputeVariantKey(dispatch) === key) {
        this.pipeline = pipeline;
        this._computePipelineKey = key;
      }
      return pipeline;
    }
    async prewarmComputePipelineVariantAsync({
      spherical = false,
      aurora = false,
      useCustomPos = false,
      writeRGB = true,
      sunStride = this._dvTuning.getInt32(8, true),
      formType = this._dvTuning.getFloat32(240, true),
      planetStyleMode = this._planetStyleMode === true
    } = {}) {
      const mode = aurora || spherical ? 1 : 0;
      const fields = mode === 0 && formType > 0;
      const planetStyle = mode !== 0 && !aurora && planetStyleMode && formType > 0.5;
      const key = mode | (useCustomPos ? 4 : 0) | (writeRGB ? 8 : 0) | (!fields && !planetStyle && (sunStride | 0) <= 1 ? 16 : 0) | (mode === 0 ? 32 : 0) | (fields ? 64 : 0) | (planetStyle ? 128 : 0);
      const [pipeline] = await Promise.all([
        this._ensureComputePipelineForKeyAsync(key),
        key & 32 ? this._ensureFlatStagePipelineAsync("resolveCloudFlat") : null,
        fields ? this._ensureFlatStagePipelineAsync("buildCloudDensityField") : null,
        fields ? this._ensureFlatStagePipelineAsync("buildCloudLightField") : null
      ]);
      return pipeline;
    }
    _getPlanetShaderModule() {
      const cache = getCloudGpuCache(this.device);
      if (!cache.planetModule) cache.planetModule = createTimedCloudModule(this.device, "cloud-planet-styles", cloudCommon_default + "\n" + cloudScratch_default + "\n" + planetGasAppearance_default + "\n" + cloudPlanet_default + "\n" + cloudResolve_default + "\n" + INLINE_LAYER_OUTPUT, cache.planetModuleTiming = {});
      return cache.planetModule;
    }
    _getFlatStageSetup() {
      const cache = getCloudGpuCache(this.device).flatStagesByFormat;
      if (cache.has(this.outFormat)) return cache.get(this.outFormat);
      const bgl = this.device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "3d" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "3d" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, sampler: { type: "filtering" } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ] });
      const densityBgl = this.device.createBindGroupLayout({ entries: [
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "rgba16float", viewDimension: "3d" } }
      ] });
      const lightBgl = this.device.createBindGroupLayout({ entries: [
        { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "3d" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, sampler: { type: "filtering" } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 6, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "rgba16float", viewDimension: "3d" } }
      ] });
      const setup = {
        bgl,
        densityBgl,
        lightBgl,
        sampler: this.device.createSampler({ minFilter: "linear", magFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge", addressModeW: "clamp-to-edge" }),
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bgl0, this.bgl1, bgl] }),
        densityLayout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bgl0, this.bgl1, densityBgl] }),
        lightLayout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bgl0, this.bgl1, lightBgl] }),
        pipelines: /* @__PURE__ */ new Map(),
        promises: /* @__PURE__ */ new Map()
      };
      cache.set(this.outFormat, setup);
      return setup;
    }
    _flatStageDescriptor(entryPoint) {
      const setup = this._getFlatStageSetup();
      const fields = entryPoint !== "resolveCloudFlat";
      return {
        label: entryPoint,
        layout: entryPoint === "buildCloudDensityField" ? setup.densityLayout : entryPoint === "buildCloudLightField" ? setup.lightLayout : setup.layout,
        compute: { module: fields ? this._getFieldShaderModule() : this._getResolveShaderModule(), entryPoint, constants: { CLOUD_IS_SPHERICAL: 0, CLOUD_USE_FIELDS: fields ? 1 : 0 } }
      };
    }
    _ensureFlatStagePipeline(entryPoint) {
      const setup = this._getFlatStageSetup();
      if (setup.pipelines.has(entryPoint)) return setup.pipelines.get(entryPoint);
      const finish = this._beginComputePipelineTiming(entryPoint, false, entryPoint);
      try {
        const pipeline = this.device.createComputePipeline(this._flatStageDescriptor(entryPoint));
        setup.pipelines.set(entryPoint, pipeline);
        finish();
        return pipeline;
      } catch (error) {
        finish(error);
        throw error;
      }
    }
    async _ensureFlatStagePipelineAsync(entryPoint) {
      const setup = this._getFlatStageSetup();
      if (setup.pipelines.has(entryPoint)) return setup.pipelines.get(entryPoint);
      if (setup.promises.has(entryPoint)) return setup.promises.get(entryPoint);
      const descriptor = this._flatStageDescriptor(entryPoint);
      const async = typeof this.device.createComputePipelineAsync === "function";
      const finish = this._beginComputePipelineTiming(entryPoint, async, entryPoint);
      const pending = Promise.resolve().then(() => async ? this.device.createComputePipelineAsync(descriptor) : this.device.createComputePipeline(descriptor)).then((pipeline) => {
        setup.pipelines.set(entryPoint, pipeline);
        finish();
        return pipeline;
      }).catch((error) => {
        finish(error);
        throw error;
      }).finally(() => {
        setup.promises.delete(entryPoint);
      });
      setup.promises.set(entryPoint, pending);
      return pending;
    }
    _getFlatStageBindGroup() {
      this._ensureFlatFieldResources();
      const bytes = this._computePipelineKey & 32 ? Math.max(1, this.width * this.height * this.layers) * 32 : 32;
      if (!this._resolveScratch || this._resolveScratch.size < bytes) {
        const old = this._resolveScratch;
        this._resolveScratch = this.device.createBuffer({ label: "cloud-ray-radiance", size: bytes, usage: GPUBufferUsage.STORAGE });
        this._flatStageBindGroup = null;
        if (old) this.queue.onSubmittedWorkDone().then(() => old.destroy()).catch(() => {
        });
      }
      if (!this._flatStageBindGroup) this._flatStageBindGroup = this.device.createBindGroup({
        layout: this._getFlatStageSetup().bgl,
        entries: [
          { binding: 0, resource: { buffer: this._resolveScratch } },
          { binding: 1, resource: this._fieldResources.densityView },
          { binding: 2, resource: this._fieldResources.lightView },
          { binding: 3, resource: this._getFlatStageSetup().sampler },
          { binding: 4, resource: { buffer: this._fieldParamsBuffer } }
        ]
      });
      return this._flatStageBindGroup;
    }
    _getFieldShaderModule() {
      const cache = getCloudGpuCache(this.device);
      if (!cache.fieldModule) cache.fieldModule = createTimedCloudModule(
        this.device,
        "cloud-rounded-fields",
        cloudCommon_default + "\n" + cloudScratch_default + "\n" + clouds_default + "\n" + cloudResolve_default + "\n" + cloudFields_default,
        cache.fieldModuleTiming = {}
      );
      return cache.fieldModule;
    }
    _getStagedLayerShaderModule() {
      const cache = getCloudGpuCache(this.device);
      if (!cache.stagedModule) {
        const code = cloudCommon_default + "\n" + cloudScratch_default + "\n" + cloudLayer_default + "\n" + cloudRayOutput_default;
        cache.stagedModule = createTimedCloudModule(this.device, "cloud-layer-raymarch", code, cache.stagedModuleTiming = {});
      }
      return cache.stagedModule;
    }
    _getResolveShaderModule() {
      const cache = getCloudGpuCache(this.device);
      return cache.resolveModule ||= createTimedCloudModule(this.device, "cloud-temporal-resolve", cloudCommon_default + "\n" + cloudScratch_default + "\n" + cloudResolve_default, cache.resolveModuleTiming = {});
    }
    invalidateCloudFields() {
      this._fieldDensitySignature = null;
      this._fieldLightSignature = null;
    }
    setFieldQuality(quality = "balanced") {
      if (!Object.hasOwn(CLOUD_FIELD_QUALITIES, quality)) throw new RangeError(`Unknown cloud field quality: ${quality}`);
      if ((this._state.fieldQuality || "balanced") === quality) return;
      this._state.fieldQuality = quality;
    }
    // Arbitrary-volume examples clip the same cached noise/lighting fields. The
    // rotation is geometry, not camera motion, and never resets the wind domain.
    setVolumeMask({ shape = this._state.volumeMask?.shape ?? "box", rotationAngle = this._state.volumeMask?.rotationAngle ?? 1.05 } = {}) {
      if (!["box", "torus", "gallery"].includes(shape)) throw new Error(`Unknown cloud volume: ${shape}`);
      this._state.volumeMask = { shape, rotationAngle: Number.isFinite(rotationAngle) ? rotationAngle : 1.05 };
    }
    // Optional continuous weather morphology. All profiles share cached fields.
    // Zero weights preserve every standalone preset and arbitrary volume.
    setWeatherProfile({ shelf = 0, deck = 0, wisps = 0, cirrus = 0, fluctus = 0, asperitas = 0 } = {}) {
      const keys = ["shelf", "deck", "wisps", "cirrus", "fluctus", "asperitas"];
      const values = [shelf, deck, wisps, cirrus, fluctus, asperitas].map((v) => Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
      const scale = Math.max(1, values.reduce((sum, v) => sum + v, 0));
      this._state.weatherProfile = Object.fromEntries(keys.map((key, i) => [key, values[i] / scale]));
    }
    _ensureFlatFieldResources() {
      const active = this._currentComputeVariantKey() & 64;
      const dimensions = active ? CLOUD_FIELD_QUALITIES[this._state.fieldQuality || "balanced"].dimensions : this._fieldResources?.dimensions || [1, 1, 1];
      if (this._fieldResources?.dimensions.join() === dimensions.join()) return;
      const old = this._fieldResources;
      const create = (label) => this.device.createTexture({ label, dimension: "3d", size: dimensions, format: "rgba16float", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING });
      const density = create("cloud-density-field");
      const light = create("cloud-shadow-ao-field");
      this._fieldResources = { dimensions, density, light, densityView: density.createView(), lightView: light.createView() };
      this._fieldParamsBuffer ||= this.device.createBuffer({ label: "cloud-field-bounds", size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this._fieldParamsAB ||= new ArrayBuffer(80);
      const setup = this._getFlatStageSetup();
      this._fieldDensityBg = this.device.createBindGroup({ layout: setup.densityBgl, entries: [
        { binding: 4, resource: { buffer: this._fieldParamsBuffer } },
        { binding: 5, resource: this._fieldResources.densityView }
      ] });
      this._fieldLightBg = this.device.createBindGroup({ layout: setup.lightBgl, entries: [
        { binding: 1, resource: this._fieldResources.densityView },
        { binding: 3, resource: setup.sampler },
        { binding: 4, resource: { buffer: this._fieldParamsBuffer } },
        { binding: 6, resource: this._fieldResources.lightView }
      ] });
      this._flatStageBindGroup = null;
      this.invalidateCloudFields();
      if (old) {
        this._retireTexture(old.density);
        this._retireTexture(old.light);
      }
    }
    _encodeFlatFields(pass, timings) {
      this._ensureFlatFieldResources();
      const started = performance.now();
      const { dimensions } = this._fieldResources;
      const dv = new DataView(this._fieldParamsAB);
      for (let i = 0; i < 3; i++) {
        dv.setFloat32(i * 4, this._state.box.center[i] - this._state.box.half[i], true);
        dv.setFloat32(16 + i * 4, this._state.box.half[i] * 2, true);
        dv.setUint32(32 + i * 4, dimensions[i], true);
      }
      const mask = this._state.volumeMask;
      const arbitrary = mask?.shape === "torus" || mask?.shape === "gallery";
      const profile = this._state.weatherProfile;
      dv.setFloat32(12, arbitrary ? 0 : profile?.shelf || 0, true);
      dv.setFloat32(28, arbitrary ? 0 : profile?.deck || 0, true);
      dv.setFloat32(48, mask?.shape === "gallery" ? 2 : mask?.shape === "torus" ? 1 : 0, true);
      dv.setFloat32(52, arbitrary ? mask.rotationAngle : 0, true);
      dv.setFloat32(56, 0.58, true);
      dv.setFloat32(60, arbitrary ? 0.22 : profile?.wisps || 0, true);
      for (const [i, key] of ["cirrus", "fluctus", "asperitas"].entries()) {
        dv.setFloat32(64 + i * 4, arbitrary ? 0 : profile?.[key] || 0, true);
      }
      this._writeIfChanged("fieldParams", this._fieldParamsBuffer, this._fieldParamsAB);
      const densitySignature = [this._abParams, this._abNTransform, this._abTuning.slice(0, 248), this._abTuning.slice(252), this._abBox, this._fieldParamsAB].map((ab) => this._sum32(ab)).concat(
        this._getResId(this.weatherView),
        this._getResId(this.shape3DView),
        this._getResId(this.detail3DView),
        this._dvView.getFloat32(96, true),
        this._dvView.getFloat32(92, true)
      ).join("|");
      const densityChanged = densitySignature !== this._fieldDensitySignature;
      const lightSignature = densitySignature + "|" + this._state.light.sunDir.join("|");
      const lightChanged = densityChanged || lightSignature !== this._fieldLightSignature;
      const dispatch = (entry) => {
        const encodeStarted = performance.now();
        pass.setPipeline(this._ensureFlatStagePipeline(entry));
        pass.setBindGroup(0, this._currentBg0);
        pass.setBindGroup(1, this._currentBg1);
        pass.setBindGroup(2, entry === "buildCloudDensityField" ? this._fieldDensityBg : this._fieldLightBg);
        pass.dispatchWorkgroups(...dimensions.map((n) => Math.ceil(n / 4)));
        timings.push({ stage: entry, encodeMs: performance.now() - encodeStarted, dispatched: true, dimensions });
      };
      if (densityChanged) dispatch("buildCloudDensityField");
      else timings.push({ stage: "buildCloudDensityField", encodeMs: 0, dispatched: false, cached: true });
      if (lightChanged) dispatch("buildCloudLightField");
      else timings.push({ stage: "buildCloudLightField", encodeMs: 0, dispatched: false, cached: true });
      this._fieldDensitySignature = densitySignature;
      this._fieldLightSignature = lightSignature;
      timings.push({ stage: "field-cache-check", encodeMs: performance.now() - started });
    }
    ensureUpsamplePipelineReady(format = this.outFormat) {
      return this._ensureUpsamplePipeline(format);
    }
    _createBootstrapComputePipelineSetup(format = this.outFormat) {
      const fmt = format || "rgba16float";
      const code = `
      const PI: f32 = 3.141592653589793;

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
        _shadowLightPad: f32,
      };

      struct NoiseTransforms {
        shapeOffsetWorld: vec3<f32>, _pad0: f32,
        detailOffsetWorld: vec3<f32>, _pad1: f32,
        shapeScale: f32, detailScale: f32, weatherScale: f32, _pad2: f32,
        shapeAxisScale: vec3<f32>, _pad3: f32,
        detailAxisScale: vec3<f32>, _pad4: f32,
        weatherOffsetWorld: vec3<f32>, _pad5: f32,
        weatherAxisScale: vec3<f32>, _pad6: f32,
        shapeBias: f32, detailBias: f32, weatherBias: f32, _pad7: f32,
      };

      struct Frame {
        fullWidth: u32, fullHeight: u32,
        tileWidth: u32, tileHeight: u32,
        originX: i32, originY: i32, originZ: i32,
        fullDepth: u32, tileDepth: u32,
        layerIndex: i32, layers: u32, _pad0: u32,
        originXf: f32, originYf: f32, _pad1: f32, _pad2: f32,
      };

      struct LightInputs {
        sunDir: vec3<f32>, _0: f32,
        camPos: vec3<f32>, _1: f32,
      };

      struct View {
        camPos: vec3<f32>, _v0: f32,
        right: vec3<f32>, _v1: f32,
        up: vec3<f32>, _v2: f32,
        fwd: vec3<f32>, _v3: f32,
        fovY: f32, aspect: f32, stepBase: f32, stepInc: f32,
        planetRadius: f32, cloudBottom: f32, cloudTop: f32, volumeLayers: f32,
        worldToUV: f32, _a: f32, _b: f32, _c: f32,
      };

      struct Box {
        center: vec3<f32>, _b0: f32,
        half: vec3<f32>, uvScale: f32,
      };

      @group(0) @binding(1) var<uniform> C: CloudParams;
      @group(0) @binding(3) var<uniform> N: NoiseTransforms;
      @group(0) @binding(4) var outTex: texture_storage_2d_array<${fmt}, write>;
      @group(0) @binding(6) var<uniform> frame: Frame;

      @group(1) @binding(0) var weather2D: texture_2d_array<f32>;
      @group(1) @binding(1) var samp2D: sampler;
      @group(1) @binding(2) var shape3D: texture_3d<f32>;
      @group(1) @binding(3) var sampShape: sampler;
      @group(1) @binding(6) var detail3D: texture_3d<f32>;
      @group(1) @binding(7) var sampDetail: sampler;
      @group(1) @binding(8) var<uniform> L: LightInputs;
      @group(1) @binding(9) var<uniform> V: View;
      @group(1) @binding(10) var<uniform> B: Box;

      fn weatherUvForDirection(n: vec3<f32>) -> vec2<f32> {
        let lon = atan2(n.z, n.x) / (2.0 * PI) + 0.5;
        let lat = asin(clamp(n.y, -1.0, 1.0)) / PI + 0.5;
        return fract(vec2<f32>(lon, lat) * max(N.weatherScale, 0.001) + N.weatherOffsetWorld.xz * 0.0025);
      }

      fn bootstrapDensity(p: vec3<f32>, height01: f32) -> f32 {
        let n = normalize(p);
        let weather = textureSampleLevel(weather2D, samp2D, weatherUvForDirection(n), 0, 0.0);
        let axis = max(abs(N.shapeAxisScale), vec3<f32>(0.05));
        let shapeUv = fract(p * axis * max(N.shapeScale, 0.004) * 0.12 + N.shapeOffsetWorld * 0.004 + vec3<f32>(0.5));
        let shape = textureSampleLevel(shape3D, sampShape, shapeUv, 0.0);
        let body = shape.r * 0.64 + shape.g * 0.22 + shape.b * 0.14 + N.shapeBias * 0.08;
        let coverage = clamp(C.globalCoverage, 0.0, 1.5);
        let combined = body * 0.72 + weather.r * 0.66 + coverage * 0.16 + N.weatherBias * 0.05;
        let vertical = smoothstep(0.0, 0.16, height01) * (1.0 - smoothstep(0.72, 1.0, height01));
        return smoothstep(0.22, 0.72, combined) * vertical;
      }

      fn intersectBootstrapBox(ro: vec3<f32>, rd: vec3<f32>) -> vec2<f32> {
        let bmin = B.center - max(abs(B.half), vec3<f32>(0.001));
        let bmax = B.center + max(abs(B.half), vec3<f32>(0.001));
        let parallel = abs(rd) <= vec3<f32>(0.00001);
        if (
          (parallel.x && (ro.x < bmin.x || ro.x > bmax.x)) ||
          (parallel.y && (ro.y < bmin.y || ro.y > bmax.y)) ||
          (parallel.z && (ro.z < bmin.z || ro.z > bmax.z))
        ) {
          return vec2<f32>(1.0, -1.0);
        }
        let epsSigned = select(vec3<f32>(-0.00001), vec3<f32>(0.00001), rd >= vec3<f32>(0.0));
        let rdSafe = select(epsSigned, rd, abs(rd) > vec3<f32>(0.00001));
        let inv = vec3<f32>(1.0) / rdSafe;
        let ta = (bmin - ro) * inv;
        let tb = (bmax - ro) * inv;
        let near3 = min(ta, tb);
        let far3 = max(ta, tb);
        return vec2<f32>(max(max(near3.x, near3.y), near3.z), min(min(far3.x, far3.y), far3.z));
      }

      fn planarDensityAt(p: vec3<f32>) -> vec4<f32> {
        let weatherAxis = max(abs(N.weatherAxisScale.xz), vec2<f32>(0.05));
        let weatherUv = fract(
          (p.xz - B.center.xz) * weatherAxis * max(B.uvScale, 0.001) * max(N.weatherScale, 0.001) * 0.18 +
          N.weatherOffsetWorld.xz * 0.0025
        );
        let weather = textureSampleLevel(weather2D, samp2D, weatherUv, 0, 0.0);
        let shapeAxis = max(abs(N.shapeAxisScale), vec3<f32>(0.05));
        let shapeUv0 = fract(
          (p - B.center) * shapeAxis * max(N.shapeScale, 0.004) * 0.15 +
          N.shapeOffsetWorld * 0.006 + vec3<f32>(0.5)
        );
        let shapeUv1 = fract(shapeUv0 * vec3<f32>(1.73, 1.41, 1.29) + vec3<f32>(0.17, 0.37, 0.11));
        let shape0 = textureSampleLevel(shape3D, sampShape, shapeUv0, 0.0);
        let shape1 = textureSampleLevel(shape3D, sampShape, shapeUv1, 0.0);
        let detailAxis = max(abs(N.detailAxisScale), vec3<f32>(0.05));
        let detailUv = fract(
          (p - B.center) * detailAxis * max(N.detailScale, 0.004) * 0.46 +
          N.detailOffsetWorld * 0.008 + vec3<f32>(0.31, 0.57, 0.73)
        );
        let detail = textureSampleLevel(detail3D, sampDetail, detailUv, 0.0);
        let base =
          shape0.r * 0.48 + shape0.g * 0.16 + shape0.b * 0.08 +
          shape1.r * 0.17 + shape1.g * 0.07 + detail.r * 0.04;
        let combined = base * 0.70 + weather.r * 0.39 + N.shapeBias * 0.05 + N.weatherBias * 0.035;
        let coverage = clamp(C.globalCoverage, 0.0, 1.25);
        let threshold = mix(0.65, 0.33, min(coverage, 1.0));
        var density = smoothstep(threshold - 0.07, threshold + 0.17, combined);
        density = clamp(density + (detail.r - 0.5) * 0.11, 0.0, 1.0);
        let halfSafe = max(abs(B.half), vec3<f32>(0.001));
        let height01 = clamp((p.y - (B.center.y - halfSafe.y)) / (halfSafe.y * 2.0), 0.0, 1.0);
        let vertical = smoothstep(0.0, 0.13, height01) * (1.0 - smoothstep(0.70, 1.0, height01));
        return vec4<f32>(density * vertical, weather.rgb);
      }

      fn planarPreview(pixelUv: vec2<f32>) -> vec4<f32> {
        let ndc = vec2<f32>(pixelUv.x * 2.0 - 1.0, 1.0 - pixelUv.y * 2.0);
        let tanHalf = tan(max(V.fovY, 0.001) * 0.5);
        let rayDir = normalize(V.fwd + V.right * (ndc.x * V.aspect * tanHalf) + V.up * (ndc.y * tanHalf));
        let hit = intersectBootstrapBox(V.camPos, rayDir);
        let tStart = max(hit.x, 0.0);
        let tEnd = hit.y;
        if (tEnd <= tStart) { return vec4<f32>(0.0); }

        // Combine a few depth slices into one shaded proxy. Accumulating them as
        // march steps exposes horizontal strata in the intentionally coarse frame.
        let segment = tEnd - tStart;
        let p0 = V.camPos + rayDir * (tStart + segment * 0.30);
        let p1 = V.camPos + rayDir * (tStart + segment * 0.52);
        let p2 = V.camPos + rayDir * (tStart + segment * 0.74);
        let field0 = planarDensityAt(p0);
        let field1 = planarDensityAt(p1);
        let field2 = planarDensityAt(p2);
        let density = clamp(field0.x * 0.24 + field1.x * 0.52 + field2.x * 0.24, 0.0, 1.0);
        let weather = field1.yzw;
        let lightProbe = planarDensityAt(p1 + normalize(L.sunDir) * 0.22).x;
        let shadowColor = max(C.shadowLightColor, vec3<f32>(0.48, 0.54, 0.66));
        let lightColor = max(C.frontLightColor * 0.82, vec3<f32>(0.82, 0.85, 0.90));
        let sunUp = max(dot(normalize(L.sunDir), vec3<f32>(0.0, 1.0, 0.0)), 0.0);
        let lightEscape = clamp((density - lightProbe) * 1.8 + 0.45, 0.0, 1.0);
        let lightAmount = clamp(0.30 + weather.g * 0.22 + sunUp * 0.16 + lightEscape * 0.24, 0.0, 1.0);
        var color = mix(shadowColor, lightColor, lightAmount) * mix(1.22, 0.80, density);
        let silverEdge = smoothstep(0.035, 0.20, density) * (1.0 - smoothstep(0.34, 0.72, density));
        color = color + max(C.sunColor, vec3<f32>(0.8)) * silverEdge * (0.18 + lightEscape * 0.18);
        let alpha = clamp(smoothstep(0.015, 0.88, density) * 0.80, 0.0, 0.80);
        return vec4<f32>(color, alpha);
      }

      @compute @workgroup_size(8, 8, 1)
      fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
        if (gid.x >= frame.fullWidth || gid.y >= frame.fullHeight) { return; }
        let dims = vec2<f32>(max(f32(frame.fullWidth), 1.0), max(f32(frame.fullHeight), 1.0));
        let pixelUv = (vec2<f32>(gid.xy) + vec2<f32>(0.5)) / dims;

        if (V.planetRadius <= 0.001) {
          textureStore(outTex, vec2<i32>(gid.xy), frame.layerIndex, planarPreview(pixelUv));
          return;
        }

        let ndc = vec2<f32>(pixelUv.x * 2.0 - 1.0, 1.0 - pixelUv.y * 2.0);
        let tanHalf = tan(max(V.fovY, 0.001) * 0.5);
        let rayDir = normalize(V.fwd + V.right * (ndc.x * V.aspect * tanHalf) + V.up * (ndc.y * tanHalf));
        let outerRadius = V.planetRadius + max(V.cloudTop, V.cloudBottom + 0.01);
        let innerRadius = V.planetRadius + max(V.cloudBottom, 0.0);
        let b = dot(V.camPos, rayDir);
        let outerH = b * b - (dot(V.camPos, V.camPos) - outerRadius * outerRadius);
        if (outerH <= 0.0) {
          textureStore(outTex, vec2<i32>(gid.xy), frame.layerIndex, vec4<f32>(0.0));
          return;
        }

        let outerRoot = sqrt(outerH);
        var tStart = max(0.0, -b - outerRoot);
        var tEnd = -b + outerRoot;
        let innerH = b * b - (dot(V.camPos, V.camPos) - innerRadius * innerRadius);
        if (innerH > 0.0) {
          let innerNear = -b - sqrt(innerH);
          if (innerNear > tStart) { tEnd = min(tEnd, innerNear); }
        }
        if (tEnd <= tStart) {
          textureStore(outTex, vec2<i32>(gid.xy), frame.layerIndex, vec4<f32>(0.0));
          return;
        }

        let segment = tEnd - tStart;
        let stepLength = segment / 8.0;
        var alpha = 0.0;
        var color = vec3<f32>(0.0);
        for (var i = 0u; i < 8u; i = i + 1u) {
          let t = tStart + (f32(i) + 0.5) * stepLength;
          let p = V.camPos + rayDir * t;
          let height01 = clamp((length(p) - innerRadius) / max(outerRadius - innerRadius, 0.001), 0.0, 1.0);
          let density = bootstrapDensity(p, height01);
          let stepAlpha = 1.0 - exp(-density * stepLength * 1.10);
          let normal = normalize(p);
          let sun = clamp(dot(normal, normalize(L.sunDir)) * 0.5 + 0.5, 0.0, 1.0);
          let sampleColor = mix(C.shadowLightColor, C.frontLightColor * C.sunColor, 0.24 + sun * 0.76);
          color = color + (1.0 - alpha) * sampleColor * stepAlpha;
          alpha = alpha + (1.0 - alpha) * stepAlpha;
          if (alpha > 0.96) { break; }
        }
        textureStore(outTex, vec2<i32>(gid.xy), frame.layerIndex, vec4<f32>(color, clamp(alpha, 0.0, 1.0)));
      }
    `;
      const module = this.device.createShaderModule({ code });
      const descriptor = {
        layout: this._computePipelineLayout,
        compute: { module, entryPoint: "main" }
      };
      return { descriptor, format: fmt };
    }
    _ensureBootstrapComputePipeline(format = this.outFormat) {
      const fmt = format || this.outFormat;
      const cache = getCloudGpuCache(this.device).bootstrapComputeByFormat;
      const cached = cache.get(fmt);
      if (cached) return cached;
      const { descriptor } = this._createBootstrapComputePipelineSetup(fmt);
      const pipeline = this.device.createComputePipeline(descriptor);
      cache.set(fmt, pipeline);
      return pipeline;
    }
    async ensureBootstrapComputePipelineReadyAsync(format = this.outFormat) {
      const fmt = format || this.outFormat;
      const deviceCache = getCloudGpuCache(this.device);
      const cached = deviceCache.bootstrapComputeByFormat.get(fmt);
      if (cached) return cached;
      const existing = deviceCache.bootstrapComputePromises.get(fmt);
      if (existing) return existing;
      const { descriptor } = this._createBootstrapComputePipelineSetup(fmt);
      const pending = (async () => {
        const pipeline = typeof this.device.createComputePipelineAsync === "function" ? await this.device.createComputePipelineAsync(descriptor) : this.device.createComputePipeline(descriptor);
        const installed = deviceCache.bootstrapComputeByFormat.get(fmt);
        if (installed) return installed;
        deviceCache.bootstrapComputeByFormat.set(fmt, pipeline);
        return pipeline;
      })();
      deviceCache.bootstrapComputePromises.set(fmt, pending);
      try {
        return await pending;
      } finally {
        if (deviceCache.bootstrapComputePromises.get(fmt) === pending) {
          deviceCache.bootstrapComputePromises.delete(fmt);
        }
      }
    }
    encodeBootstrapPreviewPass(encoder) {
      if (!encoder || !this.outView) return null;
      this._writeCommonComputeUniforms();
      this._makeBindGroups();
      const pass = encoder.beginComputePass();
      pass.setPipeline(this._ensureBootstrapComputePipeline(this.outFormat));
      pass.setBindGroup(0, this._currentBg0);
      pass.setBindGroup(1, this._currentBg1);
      pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8), Math.max(1, this.layers));
      pass.end();
      return { width: this.width, height: this.height, layers: this.layers };
    }
    async dispatchBootstrapPreview({ wait = false } = {}) {
      const encoder = this.device.createCommandEncoder();
      const encoded = this.encodeBootstrapPreviewPass(encoder);
      if (!encoded) throw new Error("dispatchBootstrapPreview: createOutputTexture/setOutputView first.");
      this.queue.submit([encoder.finish()]);
      if (wait && typeof this.queue.onSubmittedWorkDone === "function") {
        await this.queue.onSubmittedWorkDone();
      }
      this._lastHadWork = true;
      return this.outView;
    }
    _createBootstrapRenderPipelineSetup(format = "bgra8unorm") {
      const code = `
      @group(0) @binding(0) var samp: sampler;
      @group(0) @binding(1) var tex: texture_2d_array<f32>;

      struct VSOut {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
      };

      @vertex
      fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VSOut {
        var positions = array<vec2<f32>, 6>(
          vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
          vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
        );
        var uvs = array<vec2<f32>, 6>(
          vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 0.0),
          vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(1.0, 0.0)
        );
        var output: VSOut;
        output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
        output.uv = uvs[vertexIndex];
        return output;
      }

      @fragment
      fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
        let cloud = textureSampleLevel(tex, samp, input.uv, 0, 0.0);
        let alpha = clamp(cloud.a, 0.0, 1.0);
        let mapped = clamp(
          vec3<f32>(1.0) - exp(-max(cloud.rgb, vec3<f32>(0.0)) * 1.22),
          vec3<f32>(0.0),
          vec3<f32>(1.0)
        );
        return vec4<f32>(mapped * alpha, alpha);
      }
    `;
      const module = this.device.createShaderModule({ code });
      const bgl = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float", viewDimension: "2d-array" } }
        ]
      });
      const descriptor = {
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
        vertex: { module, entryPoint: "vs_main" },
        fragment: {
          module,
          entryPoint: "fs_main",
          targets: [{
            format,
            blend: {
              color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
            }
          }]
        },
        primitive: { topology: "triangle-list" }
      };
      const sampler = this.device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      return { descriptor, bgl, sampler, format };
    }
    _ensureBootstrapRenderPipeline(format = "bgra8unorm") {
      const deviceCache = getCloudGpuCache(this.device);
      const cached = deviceCache.bootstrapPreviewByFormat.get(format);
      if (cached) return cached;
      const setup = this._createBootstrapRenderPipelineSetup(format);
      const pipeline = this.device.createRenderPipeline(setup.descriptor);
      const result = { pipeline, bgl: setup.bgl, sampler: setup.sampler, format };
      deviceCache.bootstrapPreviewByFormat.set(format, result);
      return result;
    }
    async ensureBootstrapRenderPipelineReadyAsync(format = "bgra8unorm") {
      const deviceCache = getCloudGpuCache(this.device);
      const cached = deviceCache.bootstrapPreviewByFormat.get(format);
      if (cached) return cached;
      const existing = deviceCache.bootstrapPreviewPromises.get(format);
      if (existing) return existing;
      const setup = this._createBootstrapRenderPipelineSetup(format);
      const pending = (async () => {
        const pipeline = typeof this.device.createRenderPipelineAsync === "function" ? await this.device.createRenderPipelineAsync(setup.descriptor) : this.device.createRenderPipeline(setup.descriptor);
        const installed = deviceCache.bootstrapPreviewByFormat.get(format);
        if (installed) return installed;
        const result = { pipeline, bgl: setup.bgl, sampler: setup.sampler, format };
        deviceCache.bootstrapPreviewByFormat.set(format, result);
        return result;
      })();
      deviceCache.bootstrapPreviewPromises.set(format, pending);
      try {
        return await pending;
      } finally {
        if (deviceCache.bootstrapPreviewPromises.get(format) === pending) {
          deviceCache.bootstrapPreviewPromises.delete(format);
        }
      }
    }
    encodeBootstrapRenderPass(encoder, targetView, {
      format = "bgra8unorm",
      clearValue = { r: 0.5, g: 0.6, b: 0.8, a: 1 }
    } = {}) {
      if (!encoder || !targetView || !this.outView) return false;
      const { pipeline, bgl, sampler } = this._ensureBootstrapRenderPipeline(format);
      let bindGroup = this._bootstrapRenderBgCache.get(this.outView);
      if (!bindGroup) {
        bindGroup = this.device.createBindGroup({
          layout: bgl,
          entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: this.outView }
          ]
        });
        this._bootstrapRenderBgCache.set(this.outView, bindGroup);
      }
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: targetView,
          loadOp: "clear",
          clearValue,
          storeOp: "store"
        }]
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6, 1, 0, 0);
      pass.end();
      return true;
    }
    _destroyDummyHistory() {
      const prev = this._dummyHistoryPrev;
      const out = this._dummyHistoryOut;
      this._dummyHistoryPrev = null;
      this._dummyHistoryPrevView = null;
      this._dummyHistoryOut = null;
      this._dummyHistoryOutView = null;
      try {
        if (prev) this._retireTexture(prev);
      } catch (_) {
      }
      try {
        if (out) this._retireTexture(out);
      } catch (_) {
      }
    }
    _createDummyHistory() {
      const d = this.device;
      const histDesc = {
        size: [1, 1, 1],
        format: this.outFormat,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      };
      this._dummyHistoryPrev = d.createTexture(histDesc);
      this._dummyHistoryPrevView = this._dummyHistoryPrev.createView({
        dimension: "2d-array",
        arrayLayerCount: 1
      });
      this._dummyHistoryOut = d.createTexture(histDesc);
      this._dummyHistoryOutView = this._dummyHistoryOut.createView({
        dimension: "2d-array",
        arrayLayerCount: 1
      });
      this.queue.writeTexture(
        { texture: this._dummyHistoryPrev },
        new Float32Array([0, 0, 0, 0]),
        { bytesPerRow: 4 * 4 },
        { width: 1, height: 1, depthOrArrayLayers: 1 }
      );
      this.queue.writeTexture(
        { texture: this._dummyHistoryOut },
        new Float32Array([0, 0, 0, 0]),
        { bytesPerRow: 4 * 4 },
        { width: 1, height: 1, depthOrArrayLayers: 1 }
      );
    }
    // -------------------- init compute + resources --------------------
    _initCompute() {
      const d = this.device;
      const deviceCache = getCloudGpuCache(d);
      if (!deviceCache.module) {
        const started = performance.now();
        const code = cloudCommon_default + "\n" + cloudScratch_default + "\n" + cloudLayer_default + "\n" + cloudResolve_default + "\n" + INLINE_LAYER_OUTPUT;
        deviceCache.module = d.createShaderModule({ label: "cloud-raymarch", code });
        const timing = deviceCache.moduleTiming = {
          sourceBytes: code.length,
          createMs: performance.now() - started,
          validationMs: null,
          status: "created"
        };
        if (typeof deviceCache.module.getCompilationInfo === "function") {
          const validationStarted = performance.now();
          deviceCache.module.getCompilationInfo().then((info) => {
            timing.validationMs = performance.now() - validationStarted;
            const errors = info.messages.filter((message) => message.type === "error");
            timing.status = errors.length ? "error" : "validated";
            if (errors.length) timing.error = errors.map((message) => message.message).join("\n");
          }).catch((error) => {
            timing.validationMs = performance.now() - validationStarted;
            timing.status = "error";
            timing.error = String(error?.message || error);
          });
        }
      }
      this.module = deviceCache.module;
      if (!deviceCache.bgl1) {
        deviceCache.bgl1 = d.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.COMPUTE,
              texture: { sampleType: "float", viewDimension: "2d-array" }
            },
            {
              binding: 1,
              visibility: GPUShaderStage.COMPUTE,
              sampler: { type: "filtering" }
            },
            {
              binding: 2,
              visibility: GPUShaderStage.COMPUTE,
              texture: { sampleType: "float", viewDimension: "3d" }
            },
            {
              binding: 3,
              visibility: GPUShaderStage.COMPUTE,
              sampler: { type: "filtering" }
            },
            {
              binding: 4,
              visibility: GPUShaderStage.COMPUTE,
              texture: { sampleType: "float", viewDimension: "2d-array" }
            },
            {
              binding: 5,
              visibility: GPUShaderStage.COMPUTE,
              sampler: { type: "filtering" }
            },
            {
              binding: 6,
              visibility: GPUShaderStage.COMPUTE,
              texture: { sampleType: "float", viewDimension: "3d" }
            },
            {
              binding: 7,
              visibility: GPUShaderStage.COMPUTE,
              sampler: { type: "filtering" }
            },
            {
              binding: 8,
              visibility: GPUShaderStage.COMPUTE,
              buffer: { type: "uniform" }
            },
            {
              binding: 9,
              visibility: GPUShaderStage.COMPUTE,
              buffer: { type: "uniform" }
            },
            {
              binding: 10,
              visibility: GPUShaderStage.COMPUTE,
              buffer: { type: "uniform" }
            },
            {
              binding: 11,
              visibility: GPUShaderStage.COMPUTE,
              texture: { sampleType: "float", viewDimension: "2d-array" }
            },
            {
              binding: 13,
              visibility: GPUShaderStage.COMPUTE,
              texture: { sampleType: "float", viewDimension: "2d" }
            },
            {
              binding: 15,
              visibility: GPUShaderStage.COMPUTE,
              texture: { sampleType: "float", viewDimension: "2d" }
            }
          ]
        });
      }
      this.bgl1 = deviceCache.bgl1;
      if (!deviceCache.samplers) {
        deviceCache.samplers = {
          samp2D: d.createSampler({
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
            addressModeU: "repeat",
            addressModeV: "repeat"
          }),
          sampShape: d.createSampler({
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
            addressModeU: "repeat",
            addressModeV: "repeat",
            addressModeW: "repeat"
          }),
          sampDetail: d.createSampler({
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
            addressModeU: "repeat",
            addressModeV: "repeat",
            addressModeW: "repeat"
          }),
          sampBN: d.createSampler({
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
            addressModeU: "repeat",
            addressModeV: "repeat"
          })
        };
      }
      this._samp2D = deviceCache.samplers.samp2D;
      this._sampShape = deviceCache.samplers.sampShape;
      this._sampDetail = deviceCache.samplers.sampDetail;
      this._sampBN = deviceCache.samplers.sampBN;
      const tex2Desc = {
        size: [1, 1, 1],
        format: "r8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      };
      this._dummy2DMotion = d.createTexture(tex2Desc);
      this._dummy2DMotionView = this._dummy2DMotion.createView({
        dimension: "2d"
      });
      this._dummy2DDepth = d.createTexture(tex2Desc);
      this._dummy2DDepthView = this._dummy2DDepth.createView({ dimension: "2d" });
      this.queue.writeTexture(
        { texture: this._dummy2DMotion },
        // Motion is decoded as a direct pixel/UV offset, not a signed UNORM.
        // 128 meant a half-pixel horizontal shift on every stationary frame.
        new Uint8Array([0]),
        { bytesPerRow: 1 },
        { width: 1, height: 1, depthOrArrayLayers: 1 }
      );
      this.queue.writeTexture(
        { texture: this._dummy2DDepth },
        new Uint8Array([128]),
        { bytesPerRow: 1 },
        { width: 1, height: 1, depthOrArrayLayers: 1 }
      );
      this._ensureComputeFormat(this.outFormat);
    }
    _initBuffers() {
      const d = this.device;
      this.optionsBuffer = d.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.paramsBuffer = d.createBuffer({
        size: this._abParams.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.nTransformBuffer = d.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.posBuffer = d.createBuffer({
        size: 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      this.frameBuffer = d.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.lightBuffer = d.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.viewBuffer = d.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.boxBuffer = d.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.reprojBuffer = d.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.perfBuffer = d.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.tuningBuffer = d.createBuffer({
        size: 256,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.renderParams = d.createBuffer({
        size: this._abRender.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this._upsampleParamsBuffer = d.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
    }
    // -------------------- UBO setters --------------------
    setOptions(opts = {}) {
      if (typeof opts.planetStyleMode === "boolean") this._planetStyleMode = opts.planetStyleMode;
      const s = this._state.options;
      if (_has(opts, "useCustomPos")) s.useCustomPos = !!opts.useCustomPos;
      if (_has(opts, "outputChannel"))
        s.outputChannel = opts.outputChannel >>> 0 || 0;
      if (_has(opts, "writeRGB")) s.writeRGB = !!opts.writeRGB;
      if (_has(opts, "sphericalMode")) s.r0 = opts.sphericalMode ? 1 : 0;
      else if (_has(opts, "r0")) s.r0 = +opts.r0 || 0;
      else if (_has(opts, "debugForceFog")) s.r0 = +opts.debugForceFog || 0;
      if (_has(opts, "r1")) s.r1 = +opts.r1 || 0;
      else if (_has(opts, "temporalSeed")) s.r1 = +opts.temporalSeed || 0;
      if (_has(opts, "r2")) s.r2 = +opts.r2 || 0;
      else if (_has(opts, "windDisp")) s.r2 = +opts.windDisp || 0;
      if (_has(opts, "r3")) s.r3 = +opts.r3 || 0;
      else if (_has(opts, "windAngleRad")) s.r3 = +opts.windAngleRad || 0;
      const dv = this._dvOptions;
      dv.setUint32(0, s.useCustomPos ? 1 : 0, true);
      dv.setUint32(4, s.outputChannel >>> 0, true);
      dv.setUint32(8, s.writeRGB ? 1 : 0, true);
      dv.setUint32(12, 0, true);
      dv.setFloat32(16, s.r0, true);
      dv.setFloat32(20, s.r1, true);
      dv.setFloat32(24, s.r2, true);
      dv.setFloat32(28, s.r3, true);
      this._writeIfChanged("options", this.optionsBuffer, this._abOptions);
    }
    setTemporalSeed(seed = 0) {
      this.setOptions({ r1: seed });
    }
    setParams(p = {}) {
      const s = this._state.params;
      if (_has(p, "globalCoverage")) s.globalCoverage = +p.globalCoverage;
      if (_has(p, "globalDensity")) s.globalDensity = +p.globalDensity;
      if (_has(p, "cloudAnvilAmount")) s.cloudAnvilAmount = +p.cloudAnvilAmount;
      if (_has(p, "cloudBeer")) s.cloudBeer = +p.cloudBeer;
      if (_has(p, "attenuationClamp")) s.attenuationClamp = +p.attenuationClamp;
      if (_has(p, "inScatterG")) s.inScatterG = +p.inScatterG;
      if (_has(p, "silverIntensity")) s.silverIntensity = +p.silverIntensity;
      if (_has(p, "silverExponent")) s.silverExponent = +p.silverExponent;
      if (_has(p, "outScatterG")) s.outScatterG = +p.outScatterG;
      if (_has(p, "inVsOut")) s.inVsOut = +p.inVsOut;
      if (_has(p, "outScatterAmbientAmt"))
        s.outScatterAmbientAmt = +p.outScatterAmbientAmt;
      if (_has(p, "ambientMinimum")) s.ambientMinimum = +p.ambientMinimum;
      if (_has(p, "sunColor")) {
        const sc = p.sunColor || [1, 1, 1];
        s.sunColor = [+(sc[0] ?? 1), +(sc[1] ?? 1), +(sc[2] ?? 1)];
      }
      if (_has(p, "frontLightColor")) {
        const fc = p.frontLightColor || [1, 1, 1];
        s.frontLightColor = [+(fc[0] ?? 1), +(fc[1] ?? 1), +(fc[2] ?? 1)];
      }
      if (_has(p, "shadowLightColor")) {
        const sh = p.shadowLightColor || [0.62, 0.68, 0.78];
        s.shadowLightColor = [+(sh[0] ?? 0.62), +(sh[1] ?? 0.68), +(sh[2] ?? 0.78)];
      }
      if (_has(p, "densityDivMin")) s.densityDivMin = +p.densityDivMin;
      if (_has(p, "silverDirectionBias"))
        s.silverDirectionBias = +p.silverDirectionBias;
      if (_has(p, "silverHorizonBoost"))
        s.silverHorizonBoost = +p.silverHorizonBoost;
      const dv = this._dvParams;
      dv.setFloat32(0, s.globalCoverage, true);
      dv.setFloat32(4, s.globalDensity, true);
      dv.setFloat32(8, s.cloudAnvilAmount, true);
      dv.setFloat32(12, s.cloudBeer, true);
      dv.setFloat32(16, s.attenuationClamp, true);
      dv.setFloat32(20, s.inScatterG, true);
      dv.setFloat32(24, s.silverIntensity, true);
      dv.setFloat32(28, s.silverExponent, true);
      dv.setFloat32(32, s.outScatterG, true);
      dv.setFloat32(36, s.inVsOut, true);
      dv.setFloat32(40, s.outScatterAmbientAmt, true);
      dv.setFloat32(44, s.ambientMinimum, true);
      dv.setFloat32(48, s.sunColor[0], true);
      dv.setFloat32(52, s.sunColor[1], true);
      dv.setFloat32(56, s.sunColor[2], true);
      dv.setFloat32(60, 0, true);
      dv.setFloat32(64, s.densityDivMin, true);
      dv.setFloat32(68, s.silverDirectionBias, true);
      dv.setFloat32(72, s.silverHorizonBoost, true);
      dv.setFloat32(76, 0, true);
      dv.setFloat32(80, s.frontLightColor[0], true);
      dv.setFloat32(84, s.frontLightColor[1], true);
      dv.setFloat32(88, s.frontLightColor[2], true);
      dv.setFloat32(92, 0, true);
      dv.setFloat32(96, s.shadowLightColor[0], true);
      dv.setFloat32(100, s.shadowLightColor[1], true);
      dv.setFloat32(104, s.shadowLightColor[2], true);
      dv.setFloat32(108, 0, true);
      this._writeIfChanged("params", this.paramsBuffer, this._abParams);
    }
    _retireTexture(tex) {
      if (!tex || typeof tex.destroy !== "function") return;
      if (!this._retiredTextures) this._retiredTextures = [];
      this._retiredTextures.push(tex);
      if (this._retireFlushPromise) return;
      if (typeof this.queue.onSubmittedWorkDone !== "function") {
        const list = this._retiredTextures.splice(0);
        for (const t of list) {
          try {
            t.destroy();
          } catch (_) {
          }
        }
        return;
      }
      this._retireFlushPromise = this.queue.onSubmittedWorkDone().then(() => {
        this._retireFlushPromise = null;
        const list = this._retiredTextures.splice(0);
        for (const t of list) {
          try {
            t.destroy();
          } catch (_) {
          }
        }
      }).catch(() => {
        this._retireFlushPromise = null;
      });
    }
    // NoiseTransforms (binding 3)
    setNoiseTransforms(v = {}) {
      const s = this._state.ntransform;
      const v3 = (a, d0, d1, d2) => [
        +(a?.[0] ?? d0),
        +(a?.[1] ?? d1),
        +(a?.[2] ?? d2)
      ];
      if (_has(v, "shapeOffsetWorld"))
        s.shapeOffsetWorld = v3(v.shapeOffsetWorld, 0, 0, 0);
      if (_has(v, "detailOffsetWorld"))
        s.detailOffsetWorld = v3(v.detailOffsetWorld, 0, 0, 0);
      if (_has(v, "shapeScale")) s.shapeScale = +v.shapeScale;
      if (_has(v, "detailScale")) s.detailScale = +v.detailScale;
      if (_has(v, "weatherScale")) s.weatherScale = +v.weatherScale;
      if (_has(v, "shapeAxisScale"))
        s.shapeAxisScale = v3(v.shapeAxisScale, 1, 1, 1);
      if (_has(v, "detailAxisScale"))
        s.detailAxisScale = v3(v.detailAxisScale, 1, 1, 1);
      if (_has(v, "weatherOffsetWorld"))
        s.weatherOffsetWorld = v3(v.weatherOffsetWorld, 0, 0, 0);
      if (_has(v, "weatherAxisScale"))
        s.weatherAxisScale = v3(v.weatherAxisScale, 1, 1, 1);
      if (_has(v, "shapeBias")) s.shapeBias = +v.shapeBias;
      if (_has(v, "detailBias")) s.detailBias = +v.detailBias;
      if (_has(v, "weatherBias")) s.weatherBias = +v.weatherBias;
      const dv = this._dvNTransform;
      dv.setFloat32(0, s.shapeOffsetWorld[0] || 0, true);
      dv.setFloat32(4, s.shapeOffsetWorld[1] || 0, true);
      dv.setFloat32(8, s.shapeOffsetWorld[2] || 0, true);
      dv.setFloat32(12, 0, true);
      dv.setFloat32(16, s.detailOffsetWorld[0] || 0, true);
      dv.setFloat32(20, s.detailOffsetWorld[1] || 0, true);
      dv.setFloat32(24, s.detailOffsetWorld[2] || 0, true);
      dv.setFloat32(28, 0, true);
      dv.setFloat32(32, +s.shapeScale || 0, true);
      dv.setFloat32(36, +s.detailScale || 0, true);
      dv.setFloat32(40, +s.weatherScale || 0, true);
      dv.setFloat32(44, 0, true);
      dv.setFloat32(48, s.shapeAxisScale[0] || 1, true);
      dv.setFloat32(52, s.shapeAxisScale[1] || 1, true);
      dv.setFloat32(56, s.shapeAxisScale[2] || 1, true);
      dv.setFloat32(60, 0, true);
      dv.setFloat32(64, s.detailAxisScale[0] || 1, true);
      dv.setFloat32(68, s.detailAxisScale[1] || 1, true);
      dv.setFloat32(72, s.detailAxisScale[2] || 1, true);
      dv.setFloat32(76, 0, true);
      dv.setFloat32(80, s.weatherOffsetWorld[0] || 0, true);
      dv.setFloat32(84, s.weatherOffsetWorld[1] || 0, true);
      dv.setFloat32(88, s.weatherOffsetWorld[2] || 0, true);
      dv.setFloat32(92, 0, true);
      dv.setFloat32(96, s.weatherAxisScale[0] || 1, true);
      dv.setFloat32(100, s.weatherAxisScale[1] || 1, true);
      dv.setFloat32(104, s.weatherAxisScale[2] || 1, true);
      dv.setFloat32(108, 0, true);
      dv.setFloat32(112, +s.shapeBias || 0, true);
      dv.setFloat32(116, +s.detailBias || 0, true);
      dv.setFloat32(120, +s.weatherBias || 0, true);
      dv.setFloat32(124, 0, true);
      this._writeIfChanged(
        "ntransform",
        this.nTransformBuffer,
        this._abNTransform
      );
    }
    // Back-compat alias
    setTileScaling(v = {}) {
      this.setNoiseTransforms(v);
    }
    setReprojSettings(v = {}) {
      const s = this._state.reproj;
      if (_has(v, "enabled")) s.enabled = v.enabled >>> 0;
      if (_has(v, "subsample")) s.subsample = v.subsample >>> 0;
      if (_has(v, "sampleOffset")) s.sampleOffset = v.sampleOffset >>> 0;
      if (_has(v, "motionIsNormalized"))
        s.motionIsNormalized = v.motionIsNormalized >>> 0;
      if (_has(v, "temporalBlend")) s.temporalBlend = +v.temporalBlend;
      if (_has(v, "depthTest")) s.depthTest = v.depthTest >>> 0;
      if (_has(v, "depthTolerance")) s.depthTolerance = +v.depthTolerance;
      if (_has(v, "frameIndex")) s.frameIndex = v.frameIndex >>> 0;
      if (_has(v, "fullWidth")) s.fullWidth = v.fullWidth >>> 0;
      if (_has(v, "fullHeight")) s.fullHeight = v.fullHeight >>> 0;
      if (_has(v, "temporalCellRate")) s.temporalCellRate = normalizeTemporalRate(v.temporalCellRate);
      if (_has(v, "temporalCellPhase")) s.temporalCellPhase = Math.max(0, v.temporalCellPhase | 0);
      if (_has(v, "compactInterleave")) s.compactInterleave = v.compactInterleave ? 1 : 0;
      s.temporalCellRate = normalizeTemporalRate(s.temporalCellRate);
      if (s.temporalCellRate <= 1) s.temporalCellPhase = 0;
      else s.temporalCellPhase = s.temporalCellPhase % s.temporalCellRate;
      const dv = this._dvReproj;
      dv.setUint32(0, s.enabled >>> 0, true);
      dv.setUint32(4, s.subsample >>> 0, true);
      dv.setUint32(8, s.sampleOffset >>> 0, true);
      dv.setUint32(12, s.motionIsNormalized >>> 0, true);
      dv.setFloat32(16, s.temporalBlend, true);
      dv.setUint32(20, s.depthTest >>> 0, true);
      dv.setFloat32(24, s.depthTolerance, true);
      dv.setUint32(28, s.frameIndex >>> 0, true);
      dv.setUint32(32, s.fullWidth >>> 0, true);
      dv.setUint32(36, s.fullHeight >>> 0, true);
      dv.setUint32(40, s.temporalCellRate >>> 0, true);
      dv.setUint32(44, s.temporalCellPhase >>> 0, true);
      dv.setUint32(48, s.compactInterleave ? 1 : 0, true);
      dv.setUint32(52, 0, true);
      dv.setUint32(56, 0, true);
      dv.setUint32(60, 0, true);
      this._reprojFullW = s.fullWidth | 0;
      this._reprojFullH = s.fullHeight | 0;
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
    }
    setPerfParams(v = {}) {
      const s = this._state.perf;
      if (_has(v, "lodBiasMul")) s.lodBiasMul = +v.lodBiasMul;
      if (_has(v, "coarseMipBias")) s.coarseMipBias = +v.coarseMipBias;
      const dv = this._dvPerf;
      dv.setFloat32(0, s.lodBiasMul, true);
      dv.setFloat32(4, s.coarseMipBias, true);
      dv.setFloat32(8, 0, true);
      dv.setFloat32(12, 0, true);
      this._writeIfChanged("perf", this.perfBuffer, this._abPerf);
    }
    setLight(v = {}) {
      const s = this._state.light;
      if (_has(v, "sunDir")) {
        const a = v.sunDir || [0, 1, 0];
        s.sunDir = [+(a[0] ?? 0), +(a[1] ?? 1), +(a[2] ?? 0)];
      }
      if (_has(v, "camPos")) {
        const a = v.camPos || [0, 0, 2];
        s.camPos = [+(a[0] ?? 0), +(a[1] ?? 0), +(a[2] ?? 2)];
      }
      const dv = this._dvLight;
      dv.setFloat32(0, s.sunDir[0], true);
      dv.setFloat32(4, s.sunDir[1], true);
      dv.setFloat32(8, s.sunDir[2], true);
      dv.setFloat32(12, 0, true);
      dv.setFloat32(16, s.camPos[0], true);
      dv.setFloat32(20, s.camPos[1], true);
      dv.setFloat32(24, s.camPos[2], true);
      dv.setFloat32(28, 0, true);
      this._writeIfChanged("light", this.lightBuffer, this._abLight);
    }
    setSunByAngles({
      azimuthDeg = 45,
      elevationDeg = 35,
      camPos = [0, 0, 2]
    } = {}) {
      const az = azimuthDeg * Math.PI / 180;
      const el = elevationDeg * Math.PI / 180;
      const sd = [
        Math.cos(el) * Math.sin(az),
        Math.sin(el),
        Math.cos(el) * Math.cos(az)
      ];
      this.setLight({ sunDir: sd, camPos });
    }
    setBox(v = {}) {
      const s = this._state.box;
      const prevKey = `${s.center[0]},${s.center[1]},${s.center[2]}|${s.half[0]},${s.half[1]},${s.half[2]}|${s.uvScale}`;
      if (_has(v, "center")) {
        const a = v.center || [0, 0, 0];
        s.center = [+(a[0] ?? 0), +(a[1] ?? 0), +(a[2] ?? 0)];
      }
      if (_has(v, "half")) {
        const a = v.half || [1, 0.6, 1];
        s.half = [+(a[0] ?? 1), +(a[1] ?? 0.6), +(a[2] ?? 1)];
      }
      if (_has(v, "uvScale")) s.uvScale = +v.uvScale;
      const dv = this._dvBox;
      dv.setFloat32(0, s.center[0], true);
      dv.setFloat32(4, s.center[1], true);
      dv.setFloat32(8, s.center[2], true);
      dv.setFloat32(12, 0, true);
      dv.setFloat32(16, s.half[0], true);
      dv.setFloat32(20, s.half[1], true);
      dv.setFloat32(24, s.half[2], true);
      dv.setFloat32(28, s.uvScale, true);
      this._writeIfChanged("box", this.boxBuffer, this._abBox);
      const nextKey = `${s.center[0]},${s.center[1]},${s.center[2]}|${s.half[0]},${s.half[1]},${s.half[2]}|${s.uvScale}`;
    }
    setFrame(v = {}) {
      const dv = this._dvFrame;
      const prev = {
        fullWidth: dv.getUint32(0, true),
        fullHeight: dv.getUint32(4, true),
        tileWidth: dv.getUint32(8, true),
        tileHeight: dv.getUint32(12, true),
        originX: dv.getInt32(16, true),
        originY: dv.getInt32(20, true),
        originZ: dv.getInt32(24, true),
        fullDepth: dv.getUint32(28, true),
        tileDepth: dv.getUint32(32, true),
        layerIndex: dv.getInt32(36, true),
        layers: dv.getUint32(40, true),
        originXf: dv.getFloat32(48, true),
        originYf: dv.getFloat32(52, true)
      };
      const fullWidth = _has(v, "fullWidth") ? v.fullWidth >>> 0 : prev.fullWidth;
      const fullHeight = _has(v, "fullHeight") ? v.fullHeight >>> 0 : prev.fullHeight;
      const tileWidth = _has(v, "tileWidth") ? v.tileWidth >>> 0 : prev.tileWidth;
      const tileHeight = _has(v, "tileHeight") ? v.tileHeight >>> 0 : prev.tileHeight;
      const originX = _has(v, "originX") ? v.originX | 0 : prev.originX;
      const originY = _has(v, "originY") ? v.originY | 0 : prev.originY;
      const originZ = _has(v, "originZ") ? v.originZ | 0 : prev.originZ;
      const defaultLayers = ((this.layers | 0) > 0 ? this.layers | 0 : (prev.layers | 0) > 0 ? prev.layers | 0 : 1) >>> 0;
      const layers = _has(v, "layers") ? v.layers >>> 0 : prev.layers >>> 0 || defaultLayers;
      const fullDepth = _has(v, "fullDepth") ? v.fullDepth >>> 0 : prev.fullDepth >>> 0 || 1;
      const tileDepth = _has(v, "tileDepth") ? v.tileDepth >>> 0 : prev.tileDepth >>> 0 || 1;
      const layerIndex = _has(v, "layerIndex") ? v.layerIndex | 0 : prev.layerIndex;
      const originXf = _has(v, "originXf") ? +(v.originXf ?? 0) : prev.originXf;
      const originYf = _has(v, "originYf") ? +(v.originYf ?? 0) : prev.originYf;
      dv.setUint32(0, fullWidth >>> 0, true);
      dv.setUint32(4, fullHeight >>> 0, true);
      dv.setUint32(8, tileWidth >>> 0, true);
      dv.setUint32(12, tileHeight >>> 0, true);
      dv.setInt32(16, originX | 0, true);
      dv.setInt32(20, originY | 0, true);
      dv.setInt32(24, originZ | 0, true);
      dv.setUint32(28, fullDepth >>> 0, true);
      dv.setUint32(32, tileDepth >>> 0, true);
      dv.setInt32(36, layerIndex | 0, true);
      dv.setUint32(40, layers >>> 0, true);
      dv.setUint32(44, 0, true);
      dv.setFloat32(48, originXf, true);
      dv.setFloat32(52, originYf, true);
      dv.setFloat32(56, 0, true);
      dv.setFloat32(60, 0, true);
      this._writeIfChanged("frame", this.frameBuffer, this._abFrame);
      const w = tileWidth || fullWidth;
      const h = tileHeight || fullHeight;
      if (w && h) {
        this._wgX = Math.max(1, Math.ceil(w / 8));
        this._wgY = Math.max(1, Math.ceil(h / 8));
      }
    }
    setLayerIndex(i) {
      this._dvFrame.setInt32(36, i | 0, true);
      this._writeIfChanged("frame", this.frameBuffer, this._abFrame);
    }
    setViewFromCamera(opts = {}) {
      const {
        camPos = [0, 0, 3],
        right = [1, 0, 0],
        up = [0, 1, 0],
        fwd = [0, 0, 1],
        fovYDeg = 60,
        aspect,
        planetRadius = 0,
        cloudBottom = -1,
        cloudTop = 1,
        worldToUV = 1,
        stepBase = 0.02,
        stepInc = 0.04,
        volumeLayers = 1,
        viewExtraA = 0,
        viewExtraB = 0,
        viewExtraC = 0
      } = opts;
      const dv = this._dvView;
      const norm2 = (v) => {
        const L = Math.hypot(v[0], v[1], v[2]) || 1;
        return [v[0] / L, v[1] / L, v[2] / L];
      };
      const f = norm2(fwd);
      const u0 = norm2(up);
      const r = norm2([
        u0[1] * f[2] - u0[2] * f[1],
        u0[2] * f[0] - u0[0] * f[2],
        u0[0] * f[1] - u0[1] * f[0]
      ]);
      const u = [
        f[1] * r[2] - f[2] * r[1],
        f[2] * r[0] - f[0] * r[2],
        f[0] * r[1] - f[1] * r[0]
      ];
      let a = +aspect;
      if (!(a > 0)) {
        const w = this.width | 0;
        const h = this.height | 0;
        a = w > 0 && h > 0 ? w / h : 1;
      }
      const floats = [
        camPos[0],
        camPos[1],
        camPos[2],
        0,
        r[0],
        r[1],
        r[2],
        0,
        u[0],
        u[1],
        u[2],
        0,
        f[0],
        f[1],
        f[2],
        0,
        fovYDeg * Math.PI / 180,
        a,
        stepBase,
        stepInc,
        planetRadius,
        cloudBottom,
        cloudTop,
        volumeLayers,
        worldToUV,
        viewExtraA,
        viewExtraB,
        viewExtraC,
        0,
        0,
        0,
        0
      ];
      for (let i = 0; i < floats.length; i++)
        dv.setFloat32(i * 4, floats[i], true);
      this._writeIfChanged("view", this.viewBuffer, this._abView);
    }
    // -------------------- TUNE setter (CloudTuning) --------------------
    setTuning(t = {}) {
      const s = this._state.tuning;
      for (const k in t) if (_has(t, k)) s[k] = t[k];
      const dv = this._dvTuning;
      const putI = (ofs, v) => dv.setInt32(ofs, v | 0, true);
      const putF = (ofs, v) => dv.setFloat32(ofs, Number.isFinite(+v) ? +v : 0, true);
      putI(0, s.maxSteps);
      putI(4, s.sunSteps);
      putI(8, s.sunStride);
      putI(12, 0);
      putF(16, s.minStep);
      putF(20, s.maxStep);
      putF(24, s.sunMinTr);
      putF(28, s.phaseJitter);
      putF(32, s.stepJitter);
      putF(36, s.baseJitterFrac);
      putF(40, s.topJitterFrac);
      putF(44, s.lodBiasWeather);
      putF(48, s.aabbFaceOffset);
      putF(52, s.weatherRejectGate);
      putF(56, s.weatherRejectMip);
      putF(60, s.emptySkipMult);
      putF(64, s.nearFluffDist);
      putF(68, s.nearStepScale);
      putF(72, s.nearLodBias);
      putF(76, s.nearDensityMult);
      putF(80, s.nearDensityRange);
      putF(84, s.lodBlendThreshold);
      putF(88, s.sunDensityGate);
      putF(92, s.fflyRelClamp);
      putF(96, s.fflyAbsFloor);
      putF(100, s.taaRelMin);
      putF(104, s.taaRelMax);
      putF(108, s.taaAbsEps);
      putF(112, s.farStart);
      putF(116, s.farFull);
      putF(120, s.farLodPush);
      putF(124, s.farDetailAtten);
      putF(128, s.farStepMult);
      putF(132, s.bnFarScale);
      putF(136, s.farTaaHistoryBoost);
      putF(140, s.raySmoothDens);
      putF(144, s.raySmoothSun);
      putF(148, s.fluffFactor);
      putF(152, s.anvilLift);
      putF(156, s.alphaCutoff);
      putF(160, s.thickBoxPerf);
      putF(164, s.thickStepBoost);
      putF(168, s.thickDetailSkip);
      putF(172, s.thickLightSkip);
      putF(176, s.verticalStepBoost ?? 3);
      putF(180, s.verticalTextureHomogeneity ?? 0);
      putF(184, s.verticalLightingStepBoost ?? 1.35);
      putF(188, s.frontOcclusionStrength ?? 0.72);
      putF(192, s.frontOcclusionAlpha ?? 0.66);
      putF(196, s.frontOcclusionStepBoost ?? 3);
      putF(200, s.sliceJitterStrength ?? 0.08);
      putF(204, s.verticalLayerDecorrelation ?? 0.35);
      putF(208, s.directLightBlend ?? 0.78);
      putF(212, s.directLightBoost ?? 0.58);
      putF(216, s.alphaBoostThreshold ?? 0.2);
      putF(220, s.alphaBoostAmount ?? 0.14);
      putF(224, s.minOutputAlpha ?? 0.12);
      putF(228, s.outputAlphaFeather ?? 0.5);
      putF(232, s.sparsity ?? 0.42);
      putF(236, s.definition ?? 0.62);
      putF(240, Math.max(0, Math.min(7, s.formType ?? 0)));
      putF(244, Math.max(0.75, s.puffScale ?? 3.6));
      putF(248, Math.max(0, Math.min(1, s.aoStrength ?? 0)));
      putF(252, Math.max(0, Math.min(0.9, s.towerHeightVariation ?? 0.35)));
      this._writeIfChanged("tuning", this.tuningBuffer, this._abTuning);
    }
    // -------------------- input maps and history hooks --------------------
    setInputMaps({
      weatherView,
      shape3DView,
      detail3DView,
      blueTex,
      blueView,
      motionView: motionView2,
      depthPrevView,
      historyPrevView: historyPrevView2,
      historyOutView: historyOutView2
    } = {}) {
      let bg1Changed = false;
      let bg0Changed = false;
      if (typeof weatherView !== "undefined" && weatherView !== this.weatherView) {
        this.weatherView = weatherView;
        bg1Changed = true;
      }
      if (typeof shape3DView !== "undefined" && shape3DView !== this.shape3DView) {
        this.shape3DView = shape3DView;
        bg1Changed = true;
      }
      if (typeof detail3DView !== "undefined" && detail3DView !== this.detail3DView) {
        this.detail3DView = detail3DView;
        bg1Changed = true;
      }
      if (typeof blueTex !== "undefined" && blueTex !== this.blueTex) {
        if (this._ownsBlue && this.blueTex && this.blueTex !== blueTex) {
          try {
            this._retireTexture(this.blueTex);
          } catch (_) {
          }
        }
        this.blueTex = blueTex || null;
        this._ownsBlue = false;
        if (typeof blueView === "undefined") this.blueView = null;
        bg1Changed = true;
      }
      if (typeof blueView !== "undefined" && blueView !== this.blueView) {
        this.blueView = blueView || null;
        bg1Changed = true;
      }
      if (typeof motionView2 !== "undefined" && motionView2 !== this.motionView) {
        this.motionView = motionView2;
        bg1Changed = true;
      }
      if (typeof depthPrevView !== "undefined" && depthPrevView !== this.depthPrevView) {
        this.depthPrevView = depthPrevView;
        bg1Changed = true;
      }
      if (typeof historyPrevView2 !== "undefined" && historyPrevView2 !== this.historyPrevView) {
        this.historyPrevView = historyPrevView2;
        bg1Changed = true;
      }
      if (typeof historyOutView2 !== "undefined" && historyOutView2 !== this.historyOutView) {
        this.historyOutView = historyOutView2;
        bg0Changed = true;
      }
      if (bg1Changed) this._bg1Dirty = true;
      if (bg0Changed) this._bg0Dirty = true;
    }
    setHistoryPrevView(view) {
      if (view !== this.historyPrevView) {
        this.historyPrevView = view;
        this._bg1Dirty = true;
      }
    }
    setHistoryOutView(view) {
      if (view !== this.historyOutView) {
        this.historyOutView = view || null;
        this._bg0Dirty = true;
      }
    }
    // -------------------- outputs --------------------
    // Records the logical full-resolution extent without requiring a matching
    // allocation. Direct coarse presentation uses this to avoid an unused target.
    setOutputExtent(width, height, layers = 1, format = "rgba16float", { releaseOutput = false } = {}) {
      const nextWidth = Math.max(1, width | 0);
      const nextHeight = Math.max(1, height | 0);
      const nextLayers = Math.max(1, layers | 0);
      const extentChanged = this.width !== nextWidth || this.height !== nextHeight || this.layers !== nextLayers || this.outFormat !== format;
      this._ensureComputeFormat(format);
      if ((extentChanged || releaseOutput) && this.outTexture) {
        const oldOutTex = this.outTexture;
        this.outTexture = null;
        this.outView = null;
        try {
          this._retireTexture(oldOutTex);
        } catch (_) {
        }
      }
      this.width = nextWidth;
      this.height = nextHeight;
      this.layers = nextLayers;
      this._reprojFullW = nextWidth;
      this._reprojFullH = nextHeight;
      this._dvReproj.setUint32(32, this._reprojFullW >>> 0, true);
      this._dvReproj.setUint32(36, this._reprojFullH >>> 0, true);
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
      this.setFrame({
        fullWidth: nextWidth,
        fullHeight: nextHeight,
        tileWidth: nextWidth,
        tileHeight: nextHeight,
        originX: 0,
        originY: 0,
        originZ: 0,
        layerIndex: 0,
        originXf: 0,
        originYf: 0
      });
      this._renderSourceView = null;
      this._bg0Dirty = true;
      this._bg1Dirty = true;
      this._renderBgCache = /* @__PURE__ */ new WeakMap();
      this._renderBundleCache = /* @__PURE__ */ new WeakMap();
      this._lastHadWork = false;
      return this.outView;
    }
    createOutputTexture(width, height, layers = 1, format = "rgba16float") {
      const previousFormat = this.outFormat;
      this._ensureComputeFormat(format);
      if (this.outTexture && this.width === width && this.height === height && this.layers === layers && previousFormat === format) {
        return this.outView;
      }
      const oldOutTex = this.outTexture;
      this.outTexture = null;
      this.outView = null;
      if (oldOutTex) {
        try {
          this._retireTexture(oldOutTex);
        } catch (_) {
        }
      }
      this.setOutputExtent(width, height, layers, format);
      this.outTexture = this.device.createTexture({
        size: [this.width, this.height, this.layers],
        format: this.outFormat,
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT
      });
      this.outView = this.outTexture.createView({
        dimension: "2d-array",
        arrayLayerCount: this.layers
      });
      return this.outView;
    }
    setOutputView(view, { width, height, layers = 1, format = "rgba16float" } = {}) {
      if (!view) throw new Error("setOutputView: view required");
      this._ensureComputeFormat(format);
      this.outTexture = null;
      this.outView = view;
      if (width && height) {
        this.width = width;
        this.height = height;
        this.layers = layers;
        this.setFrame({
          fullWidth: width,
          fullHeight: height,
          tileWidth: width,
          tileHeight: height,
          originX: 0,
          originY: 0,
          originZ: 0,
          layerIndex: 0,
          originXf: 0,
          originYf: 0
        });
        this._reprojFullW = width;
        this._reprojFullH = height;
        this._dvReproj.setUint32(32, this._reprojFullW >>> 0, true);
        this._dvReproj.setUint32(36, this._reprojFullH >>> 0, true);
        this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
      }
      this._bg0Dirty = true;
      this._renderBgCache = /* @__PURE__ */ new WeakMap();
      this._renderBundleCache = /* @__PURE__ */ new WeakMap();
      this._lastHadWork = false;
      return this.outView;
    }
    // -------------------- bind group keys --------------------
    _buildBg0Key() {
      const ids = [
        this._getResId(this.outView),
        this._getResId(this.optionsBuffer),
        this._getResId(this.paramsBuffer),
        this._getResId(this.nTransformBuffer),
        this._getResId(this.posBuffer),
        this._getResId(this.frameBuffer),
        this._getResId(this.historyOutView || this._dummyHistoryOutView),
        this._getResId(this.reprojBuffer),
        this._getResId(this.perfBuffer),
        this._getResId(this.tuningBuffer),
        this.outFormat
      ];
      return ids.join("|");
    }
    _buildBg1Key() {
      const blueViewId = this._getResId(this.blueView || this._ensureBlueView());
      const ids = [
        this._getResId(this.weatherView),
        this._getResId(this._samp2D),
        this._getResId(this.shape3DView),
        this._getResId(this._sampShape),
        blueViewId,
        this._getResId(this._sampBN),
        this._getResId(this.detail3DView),
        this._getResId(this._sampDetail),
        this._getResId(this.lightBuffer),
        this._getResId(this.viewBuffer),
        this._getResId(this.boxBuffer),
        this._getResId(this.historyPrevView || this._dummyHistoryPrevView),
        this._getResId(this.motionView || this._dummy2DMotionView),
        this._getResId(this.depthPrevView || this._dummy2DDepthView)
      ];
      return ids.join("|");
    }
    _ensureBlueView() {
      if (this.blueView) return this.blueView;
      if (!this.blueTex) {
        const tex = this.device.createTexture({
          size: [1, 1, 1],
          format: "r8unorm",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });
        this.queue.writeTexture(
          { texture: tex },
          new Uint8Array([128]),
          { bytesPerRow: 1 },
          { width: 1, height: 1, depthOrArrayLayers: 1 }
        );
        this.blueTex = tex;
        this._ownsBlue = true;
      }
      this.blueView = this.blueTex.createView({
        dimension: "2d-array",
        baseArrayLayer: 0,
        arrayLayerCount: 1
      });
      return this.blueView;
    }
    _createBg0ForKey() {
      if (!this.outView)
        throw new Error(
          "No output view: call createOutputTexture or setOutputView first"
        );
      const canUseExplicitHistoryOut = this.historyOutView && this._getResId(this.historyOutView) !== this._getResId(this.outView);
      const historyOutForBind = canUseExplicitHistoryOut ? this.historyOutView : this._dummyHistoryOutView;
      return this.device.createBindGroup({
        layout: this.bgl0,
        entries: [
          { binding: 0, resource: { buffer: this.optionsBuffer } },
          { binding: 1, resource: { buffer: this.paramsBuffer } },
          { binding: 3, resource: { buffer: this.nTransformBuffer } },
          { binding: 4, resource: this.outView },
          { binding: 5, resource: { buffer: this.posBuffer } },
          { binding: 6, resource: { buffer: this.frameBuffer } },
          { binding: 7, resource: historyOutForBind },
          { binding: 8, resource: { buffer: this.reprojBuffer } },
          { binding: 9, resource: { buffer: this.perfBuffer } },
          { binding: 10, resource: { buffer: this.tuningBuffer } }
        ]
      });
    }
    _createBg1ForKey() {
      if (!this.weatherView)
        throw new Error(
          "Missing weatherView (texture_2d_array view). Call setInputMaps()."
        );
      if (!this.shape3DView)
        throw new Error(
          "Missing shape3DView (texture_3d view). Call setInputMaps()."
        );
      if (!this.detail3DView)
        throw new Error(
          "Missing detail3DView (texture_3d view). Call setInputMaps()."
        );
      const blueView = this.blueView || this._ensureBlueView();
      const motionView2 = this.motionView || this._dummy2DMotionView;
      const depthView2 = this.depthPrevView || this._dummy2DDepthView;
      const historyPrev = this.historyPrevView || this._dummyHistoryPrevView;
      return this.device.createBindGroup({
        layout: this.bgl1,
        entries: [
          { binding: 0, resource: this.weatherView },
          { binding: 1, resource: this._samp2D },
          { binding: 2, resource: this.shape3DView },
          { binding: 3, resource: this._sampShape },
          { binding: 4, resource: blueView },
          { binding: 5, resource: this._sampBN },
          { binding: 6, resource: this.detail3DView },
          { binding: 7, resource: this._sampDetail },
          { binding: 8, resource: { buffer: this.lightBuffer } },
          { binding: 9, resource: { buffer: this.viewBuffer } },
          { binding: 10, resource: { buffer: this.boxBuffer } },
          { binding: 11, resource: historyPrev },
          { binding: 13, resource: motionView2 },
          { binding: 15, resource: depthView2 }
        ]
      });
    }
    _makeBindGroups() {
      this._ensureBindGroupCaches();
      if (this._bg0Dirty || !this._currentBg0) {
        const k0 = this._buildBg0Key();
        if (this._bg0Cache.has(k0)) {
          this._currentBg0 = this._bg0Cache.get(k0);
        } else {
          const bg0 = this._createBg0ForKey();
          this._bg0Cache.set(k0, bg0);
          this._bg0Keys.push(k0);
          this._currentBg0 = bg0;
          while (this._bg0Keys.length > 16) {
            const oldest = this._bg0Keys.shift();
            this._bg0Cache.delete(oldest);
          }
        }
        this._bg0Dirty = false;
      }
      if (this._bg1Dirty || !this._currentBg1) {
        const k1 = this._buildBg1Key();
        if (this._bg1Cache.has(k1)) {
          this._currentBg1 = this._bg1Cache.get(k1);
        } else {
          const bg1 = this._createBg1ForKey();
          this._bg1Cache.set(k1, bg1);
          this._bg1Keys.push(k1);
          this._currentBg1 = bg1;
          while (this._bg1Keys.length > 16) {
            const oldest = this._bg1Keys.shift();
            this._bg1Cache.delete(oldest);
          }
        }
        this._bg1Dirty = false;
      }
    }
    // -------------------- dispatch (coarse integrated) --------------------
    async dispatchRect({ x, y, w, h, wait = false, coarseFactor = 1 } = {}) {
      if (!this.outView)
        throw new Error("dispatchRect: createOutputTexture/setOutputView first.");
      const baseX = Math.max(0, Math.floor(x ?? 0));
      const baseY = Math.max(0, Math.floor(y ?? 0));
      const tw = Math.max(0, Math.floor(w ?? this.width - baseX));
      const th = Math.max(0, Math.floor(h ?? this.height - baseY));
      const cf = Math.max(1, coarseFactor | 0);
      if (cf < 2 || !this.outTexture)
        return this.dispatchRectNoCoarse({
          x: baseX,
          y: baseY,
          w: tw,
          h: th,
          wait
        });
      const cW = Math.max(1, Math.ceil(tw / cf));
      const cH = Math.max(1, Math.ceil(th / cf));
      this._ensureCoarseTexture(cW, cH, this.layers);
      const savedOutTexture = this.outTexture;
      const savedOutView = this.outView;
      const savedWidth = this.width;
      const savedHeight = this.height;
      const savedFormat = this.outFormat;
      this.outTexture = this._coarseTexture;
      this.outView = this._coarseView;
      this.width = cW;
      this.height = cH;
      this.outFormat = savedFormat;
      this._bg0Dirty = true;
      this.setFrame({
        fullWidth: cW,
        fullHeight: cH,
        tileWidth: cW,
        tileHeight: cH,
        originX: 0,
        originY: 0,
        originZ: 0,
        layerIndex: this._dvFrame.getInt32(36, true) | 0,
        originXf: baseX,
        originYf: baseY
      });
      const curFW = this._dvReproj.getUint32(32, true) || 0;
      const curFH = this._dvReproj.getUint32(36, true) || 0;
      if (curFW !== cW >>> 0 || curFH !== cH >>> 0) {
        this._dvReproj.setUint32(32, cW >>> 0, true);
        this._dvReproj.setUint32(36, cH >>> 0, true);
        this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
        this._bg0Dirty = true;
      }
      const enc = this.device.createCommandEncoder();
      const savedReprojStateForCoarse = Object.assign({}, this._state.reproj || {});
      const savedReprojBytesForCoarse = new Uint8Array(this._abReproj).slice();
      const savedReprojFullWForCoarse = this._reprojFullW;
      const savedReprojFullHForCoarse = this._reprojFullH;
      this.setReprojSettings({
        enabled: 0,
        subsample: 1,
        sampleOffset: 0,
        motionIsNormalized: 0,
        temporalBlend: 0,
        depthTest: 0,
        depthTolerance: 0,
        frameIndex: 0,
        fullWidth: cW,
        fullHeight: cH,
        temporalCellRate: 1,
        temporalCellPhase: 0,
        compactInterleave: 0
      });
      this._encodeCurrentComputePass(enc);
      this._state.reproj = savedReprojStateForCoarse;
      new Uint8Array(this._abReproj).set(savedReprojBytesForCoarse);
      this._reprojFullW = savedReprojFullWForCoarse;
      this._reprojFullH = savedReprojFullHForCoarse;
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
      this.outTexture = savedOutTexture;
      this.outView = savedOutView;
      this.width = savedWidth;
      this.height = savedHeight;
      this.outFormat = savedFormat;
      this._bg0Dirty = true;
      const layerForRestore = this._dvFrame.getInt32(36, true) | 0;
      const preparedUpsample = this._prepareUpsamplePass({
        srcW: cW,
        srcH: cH,
        dstX: baseX,
        dstY: baseY,
        dstW: tw,
        dstH: th
      });
      this._encodeUpsamplePass(enc, preparedUpsample);
      this.queue.submit([enc.finish()]);
      this.setFrame({
        fullWidth: savedWidth,
        fullHeight: savedHeight,
        tileWidth: tw,
        tileHeight: th,
        originX: baseX,
        originY: baseY,
        originZ: 0,
        layerIndex: layerForRestore,
        originXf: 0,
        originYf: 0
      });
      if (wait && typeof this.queue.onSubmittedWorkDone === "function")
        await this.queue.onSubmittedWorkDone();
      this._lastHadWork = true;
      return this.outView;
    }
    async dispatchRectNoCoarse({ x, y, w, h, wait = false } = {}) {
      if (!this.outView)
        throw new Error(
          "dispatchRectNoCoarse: createOutputTexture/setOutputView first."
        );
      const baseX = Math.max(0, Math.floor(x ?? 0));
      const baseY = Math.max(0, Math.floor(y ?? 0));
      const tw = Math.max(0, Math.floor(w ?? this.width - baseX));
      const th = Math.max(0, Math.floor(h ?? this.height - baseY));
      if (tw === 0 || th === 0) {
        this._lastHadWork = false;
        return this.outView;
      }
      this.setFrame({
        fullWidth: this.width,
        fullHeight: this.height,
        tileWidth: tw,
        tileHeight: th,
        originX: baseX,
        originY: baseY,
        originZ: 0,
        layerIndex: this._dvFrame.getInt32(36, true) | 0,
        originXf: 0,
        originYf: 0
      });
      if (!this._reprojFullW) {
        this._dvReproj.setUint32(32, this.width >>> 0, true);
        this._dvReproj.setUint32(36, this.height >>> 0, true);
        this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
        this._bg0Dirty = true;
      }
      await this._dispatchComputeInternal({ wait });
      this._lastHadWork = true;
      return this.outView;
    }
    async dispatch({ wait = false, coarseFactor = 1 } = {}) {
      const enc = this.device.createCommandEncoder();
      const encoded = this.encodeDispatchPasses(enc, { coarseFactor });
      this.queue.submit([enc.finish()]);
      encoded?.restoreAfterSubmit?.();
      if (wait && typeof this.queue.onSubmittedWorkDone === "function")
        await this.queue.onSubmittedWorkDone();
      return this.outView;
    }
    async dispatchAllLayers({ wait = false } = {}) {
      if (!this.outView)
        throw new Error(
          "Nothing to dispatch: createOutputTexture/setOutputView first."
        );
      this._writeIfChanged("options", this.optionsBuffer, this._abOptions);
      this._writeIfChanged("params", this.paramsBuffer, this._abParams);
      this._writeIfChanged(
        "ntransform",
        this.nTransformBuffer,
        this._abNTransform
      );
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
      this._writeIfChanged("perf", this.perfBuffer, this._abPerf);
      this._writeIfChanged("tuning", this.tuningBuffer, this._abTuning);
      this._makeBindGroups();
      const enc = this.device.createCommandEncoder();
      for (let layer = 0; layer < this.layers; ++layer) {
        this.setLayerIndex(layer);
        this._encodeCurrentComputePass(enc);
      }
      this.queue.submit([enc.finish()]);
      if (wait && typeof this.queue.onSubmittedWorkDone === "function")
        await this.queue.onSubmittedWorkDone();
      this._lastHadWork = true;
      return this.outView;
    }
    _writeCommonComputeUniforms() {
      this._writeIfChanged("options", this.optionsBuffer, this._abOptions);
      this._writeIfChanged("params", this.paramsBuffer, this._abParams);
      this._writeIfChanged(
        "ntransform",
        this.nTransformBuffer,
        this._abNTransform
      );
      this._writeIfChanged("frame", this.frameBuffer, this._abFrame);
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
      this._writeIfChanged("perf", this.perfBuffer, this._abPerf);
      this._writeIfChanged("tuning", this.tuningBuffer, this._abTuning);
    }
    _temporalRateForDispatch() {
      const r = normalizeTemporalRate(this._state?.reproj?.temporalCellRate ?? 1);
      return r > 1 ? r : 1;
    }
    _canUseCompactInterleave() {
      const r = this._temporalRateForDispatch();
      const s = this._state?.reproj || {};
      return !!(r > 1 && s.frameIndex >>> 0 > 0 && this.historyPrevView && this.historyOutView && this.width > 0 && this.height > 0);
    }
    _setCompactInterleaveUniform(enabled) {
      const s = this._state.reproj;
      const next = enabled ? 1 : 0;
      if ((s.compactInterleave ? 1 : 0) === next) return;
      s.compactInterleave = next;
      this._dvReproj.setUint32(48, next >>> 0, true);
      this._dvReproj.setUint32(52, 0, true);
      this._dvReproj.setUint32(56, 0, true);
      this._dvReproj.setUint32(60, 0, true);
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
    }
    _compactInterleaveDispatchShape() {
      const rate = this._temporalRateForDispatch();
      const fullW = Math.max(1, this.width || 1);
      const fullH = Math.max(1, this.height || 1);
      const ownersPerBlock = Math.max(1, Math.floor(64 / Math.max(1, rate)));
      const blocksX = Math.max(1, Math.ceil(fullW / 8));
      const blocksY = Math.max(1, Math.ceil(fullH / 8));
      return {
        w: blocksX * ownersPerBlock,
        h: blocksY,
        wgX: Math.max(1, Math.ceil(blocksX * ownersPerBlock / 8)),
        wgY: Math.max(1, Math.ceil(blocksY / 8)),
        updatedPixels: blocksX * blocksY * ownersPerBlock,
        totalPixels: fullW * fullH,
        tile: 8
      };
    }
    _ensureHistoryCopyPipeline() {
      if (this._historyCopy && this._historyCopy.format === "rgba16float") return this._historyCopy;
      const deviceCache = getCloudGpuCache(this.device);
      if (deviceCache.historyCopy) {
        this._historyCopy = deviceCache.historyCopy;
        this._historyCopyBgCache.clear();
        this._historyCopyBgKeys.length = 0;
        return this._historyCopy;
      }
      const wgsl = `
      struct Frame {
        fullWidth: u32, fullHeight: u32,
        tileWidth: u32, tileHeight: u32,
        originX: i32, originY: i32, originZ: i32,
        fullDepth: u32, tileDepth: u32,
        layerIndex: i32, layers: u32,
        _pad0: u32,
        originXf: f32, originYf: f32, _pad1: f32, _pad2: f32
      };

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
        _pad0: u32,
        _pad1: u32,
        _pad2: u32
      };

      @group(0) @binding(0) var srcTex: texture_2d_array<f32>;
      @group(0) @binding(1) var dstTex: texture_storage_2d_array<rgba16float, write>;
      @group(0) @binding(2) var<uniform> frame: Frame;
      @group(0) @binding(3) var<uniform> reproj: ReprojSettings;

      @compute @workgroup_size(16, 16, 1)
      fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
        let fullW = max(reproj.fullWidth, frame.fullWidth);
        let fullH = max(reproj.fullHeight, frame.fullHeight);
        if (gid.x >= fullW || gid.y >= fullH) { return; }
        let p = vec2<i32>(i32(gid.x), i32(gid.y));
        let layer = frame.layerIndex;
        let c = textureLoad(srcTex, p, layer, 0);
        textureStore(dstTex, p, layer, c);
      }
    `;
      const module = this.device.createShaderModule({ code: wgsl });
      const bgl = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "2d-array" } },
          { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "rgba16float", viewDimension: "2d-array" } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
          { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
        ]
      });
      const pipe = this.device.createComputePipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
        compute: { module, entryPoint: "main" }
      });
      deviceCache.historyCopy = { format: "rgba16float", bgl, pipe };
      this._historyCopy = deviceCache.historyCopy;
      this._historyCopyBgCache.clear();
      this._historyCopyBgKeys.length = 0;
      return this._historyCopy;
    }
    _getHistoryCopyBindGroup() {
      if (!this.historyPrevView || !this.historyOutView) return null;
      const h = this._ensureHistoryCopyPipeline();
      const key = [
        this._getResId(this.historyPrevView),
        this._getResId(this.historyOutView),
        this._getResId(this.frameBuffer),
        this._getResId(this.reprojBuffer)
      ].join("|");
      if (this._historyCopyBgCache.has(key)) return this._historyCopyBgCache.get(key);
      const bg = this.device.createBindGroup({
        layout: h.bgl,
        entries: [
          { binding: 0, resource: this.historyPrevView },
          { binding: 1, resource: this.historyOutView },
          { binding: 2, resource: { buffer: this.frameBuffer } },
          { binding: 3, resource: { buffer: this.reprojBuffer } }
        ]
      });
      this._historyCopyBgCache.set(key, bg);
      this._historyCopyBgKeys.push(key);
      while (this._historyCopyBgKeys.length > 8) {
        const oldest = this._historyCopyBgKeys.shift();
        this._historyCopyBgCache.delete(oldest);
      }
      return bg;
    }
    _encodeHistoryCopyPass(enc) {
      const h = this._ensureHistoryCopyPipeline();
      const bg = this._getHistoryCopyBindGroup();
      if (!bg) return;
      const pass = enc.beginComputePass();
      pass.setPipeline(h.pipe);
      pass.setBindGroup(0, bg);
      const fullW = Math.max(1, this.width || 1);
      const fullH = Math.max(1, this.height || 1);
      pass.dispatchWorkgroups(Math.max(1, Math.ceil(fullW / 16)), Math.max(1, Math.ceil(fullH / 16)), 1);
      pass.end();
    }
    _encodeCurrentComputePass(enc) {
      const compactInterleave = this._canUseCompactInterleave();
      this._setCompactInterleaveUniform(compactInterleave);
      this._writeCommonComputeUniforms();
      if (compactInterleave) this._encodeHistoryCopyPass(enc);
      this._makeBindGroups();
      const compactShape = compactInterleave ? this._compactInterleaveDispatchShape() : null;
      const fullPixels = Math.max(1, (this.width || 1) * (this.height || 1));
      this._lastInterleaveStats = {
        enabled: !!compactInterleave,
        rate: this._temporalRateForDispatch(),
        phase: this._state?.reproj?.temporalCellPhase >>> 0,
        updatedPixels: compactShape ? compactShape.updatedPixels : fullPixels,
        totalPixels: fullPixels,
        fraction: compactShape ? Math.min(1, compactShape.updatedPixels / fullPixels) : 1,
        tile: compactShape ? compactShape.tile : 1
      };
      const pipeline = this.ensureComputePipelineReady();
      const stageBindGroup = this._computePipelineKey & 96 ? this._getFlatStageBindGroup() : null;
      const timings = [];
      const pass = enc.beginComputePass();
      if (this._computePipelineKey & 64) this._encodeFlatFields(pass, timings);
      const rayStarted = performance.now();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, this._currentBg0);
      pass.setBindGroup(1, this._currentBg1);
      const staged = !!(this._computePipelineKey & 32);
      if (stageBindGroup) pass.setBindGroup(2, stageBindGroup);
      pass.dispatchWorkgroups(compactShape ? compactShape.wgX : this._wgX, compactShape ? compactShape.wgY : this._wgY, 1);
      timings.push({ stage: "cloud-raymarch", encodeMs: performance.now() - rayStarted, dispatched: true });
      if (staged) {
        const resolveStarted = performance.now();
        pass.setPipeline(this._ensureFlatStagePipeline("resolveCloudFlat"));
        pass.dispatchWorkgroups(compactShape ? compactShape.wgX : this._wgX, compactShape ? compactShape.wgY : this._wgY, 1);
        timings.push({ stage: "cloud-temporal-resolve", encodeMs: performance.now() - resolveStarted, dispatched: true });
      }
      pass.end();
      this._lastStageTimings = timings;
    }
    encodeDispatchPasses(enc, { coarseFactor = 1, reconstructAtPresentation = false } = {}) {
      if (!enc) throw new Error("encodeDispatchPasses: command encoder required.");
      const cf = Math.max(1, coarseFactor | 0);
      const directCoarse = cf >= 2 && !!reconstructAtPresentation;
      if (!this.outView && !directCoarse)
        throw new Error("encodeDispatchPasses: createOutputTexture/setOutputView first.");
      this._renderSourceView = this.outView;
      if (cf < 2) {
        const layer = this._dvFrame.getInt32(36, true) | 0;
        this.setFrame({
          fullWidth: this.width,
          fullHeight: this.height,
          tileWidth: this.width,
          tileHeight: this.height,
          originX: 0,
          originY: 0,
          originZ: 0,
          layerIndex: layer,
          originXf: 0,
          originYf: 0
        });
      }
      if (cf >= 2 && (this.outTexture || directCoarse)) {
        const cW = Math.max(1, Math.ceil(this.width / cf));
        const cH = Math.max(1, Math.ceil(this.height / cf));
        this._ensureCoarseTexture(cW, cH, this.layers);
        const savedOutTexture = this.outTexture;
        const savedOutView = this.outView;
        const savedWidth = this.width;
        const savedHeight = this.height;
        const savedFormat = this.outFormat;
        const savedLayer = this._dvFrame.getInt32(36, true) | 0;
        this.outTexture = this._coarseTexture;
        this.outView = this._coarseView;
        this.width = cW;
        this.height = cH;
        this.outFormat = savedFormat;
        this._bg0Dirty = true;
        this.setFrame({
          fullWidth: cW,
          fullHeight: cH,
          tileWidth: cW,
          tileHeight: cH,
          originX: 0,
          originY: 0,
          originZ: 0,
          layerIndex: savedLayer,
          originXf: 0,
          originYf: 0
        });
        const curFW = this._dvReproj.getUint32(32, true) || 0;
        const curFH = this._dvReproj.getUint32(36, true) || 0;
        if (curFW !== cW >>> 0 || curFH !== cH >>> 0) {
          this._dvReproj.setUint32(32, cW >>> 0, true);
          this._dvReproj.setUint32(36, cH >>> 0, true);
          this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
        }
        this._encodeCurrentComputePass(enc);
        this.outTexture = savedOutTexture;
        this.outView = savedOutView;
        this.width = savedWidth;
        this.height = savedHeight;
        this.outFormat = savedFormat;
        this._bg0Dirty = true;
        if (reconstructAtPresentation) {
          this._renderSourceView = this._coarseView;
        } else {
          const preparedUpsample = this._prepareUpsamplePass({
            srcW: cW,
            srcH: cH,
            dstX: 0,
            dstY: 0,
            dstW: savedWidth,
            dstH: savedHeight
          });
          this._encodeUpsamplePass(enc, preparedUpsample);
          this._renderSourceView = this.outView;
        }
        this._lastHadWork = true;
        return {
          coarseFactor: cf,
          directFullResReconstruction: !!reconstructAtPresentation,
          previewView: this._renderSourceView,
          interleaveStats: this._lastInterleaveStats,
          stageTimings: this._lastStageTimings,
          restoreAfterSubmit: () => {
            this._bg0Dirty = true;
          }
        };
      }
      this._encodeCurrentComputePass(enc);
      this._lastHadWork = true;
      return {
        coarseFactor: 1,
        restoreAfterSubmit: null,
        interleaveStats: this._lastInterleaveStats,
        stageTimings: this._lastStageTimings
      };
    }
    async _dispatchComputeInternal({ wait = false } = {}) {
      const enc = this.device.createCommandEncoder();
      this.encodeDispatchPasses(enc, { coarseFactor: 1 });
      this.queue.submit([enc.finish()]);
      if (wait && typeof this.queue.onSubmittedWorkDone === "function")
        await this.queue.onSubmittedWorkDone();
    }
    // -------------------- coarse helpers --------------------
    _ensureCoarseTexture(w, h, layers = 1) {
      if (this._coarseTexture && this._coarseW === w && this._coarseH === h && this._coarseLayers === layers && this._coarseFormat === this.outFormat) {
        return;
      }
      const old = this._coarseTexture;
      this._coarseTexture = null;
      this._coarseView = null;
      if (old) {
        try {
          this._retireTexture(old);
        } catch (_) {
        }
      }
      this._coarseW = w;
      this._coarseH = h;
      this._coarseLayers = layers;
      this._coarseFormat = this.outFormat;
      this._coarseTexture = this.device.createTexture({
        size: [w, h, layers],
        format: this.outFormat,
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
      });
      this._coarseView = this._coarseTexture.createView({
        dimension: "2d-array",
        arrayLayerCount: layers
      });
      this._bg0Dirty = true;
      this._bg1Dirty = true;
    }
    // -------------------- coarse upsample pipeline --------------------
    _ensureUpsamplePipeline(format = this.outFormat) {
      if (this._upsample && this._upsample.format === format)
        return this._upsample;
      const fmt = format || "rgba16float";
      const deviceCache = getCloudGpuCache(this.device);
      const cachedUpsample = deviceCache.upsampleByFormat.get(fmt);
      if (cachedUpsample) {
        this._upsample = { ...cachedUpsample, bgCache: /* @__PURE__ */ new Map() };
        return this._upsample;
      }
      const wgsl = `
      struct UpsampleParams {
        srcW : u32,
        srcH : u32,
        dstX : u32,
        dstY : u32,
        dstW : u32,
        dstH : u32,
        layer: u32,
        _pad0: u32,
      }

      @group(0) @binding(0) var samp : sampler;
      @group(0) @binding(1) var srcTex : texture_2d_array<f32>;
      @group(0) @binding(2) var dstTex : texture_storage_2d_array<${fmt}, write>;
      @group(0) @binding(3) var<uniform> P : UpsampleParams;

      @compute @workgroup_size(16, 16, 1)
      fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
        let x = gid.x;
        let y = gid.y;
        if (x >= P.dstW || y >= P.dstH) { return; }

        let uv = (vec2<f32>(f32(x) + 0.5, f32(y) + 0.5)) / vec2<f32>(max(f32(P.dstW), 1.0), max(f32(P.dstH), 1.0));
        let srcDim = vec2<f32>(max(f32(P.srcW), 1.0), max(f32(P.srcH), 1.0));
        let dstDim = vec2<f32>(max(f32(P.dstW), 1.0), max(f32(P.dstH), 1.0));
        let texel = 1.0 / srcDim;
        let c0 = textureSampleLevel(srcTex, samp, uv, i32(P.layer), 0.0);
        let c1 = textureSampleLevel(srcTex, samp, uv + vec2<f32>( texel.x, 0.0), i32(P.layer), 0.0);
        let c2 = textureSampleLevel(srcTex, samp, uv + vec2<f32>(-texel.x, 0.0), i32(P.layer), 0.0);
        let c3 = textureSampleLevel(srcTex, samp, uv + vec2<f32>(0.0,  texel.y), i32(P.layer), 0.0);
        let c4 = textureSampleLevel(srcTex, samp, uv + vec2<f32>(0.0, -texel.y), i32(P.layer), 0.0);
        let a0 = clamp(c0.a, 0.0, 1.0);
        let w0 = 0.48;
        let w1 = 0.13 / (1.0 + abs(clamp(c1.a, 0.0, 1.0) - a0) * 16.0);
        let w2 = 0.13 / (1.0 + abs(clamp(c2.a, 0.0, 1.0) - a0) * 16.0);
        let w3 = 0.13 / (1.0 + abs(clamp(c3.a, 0.0, 1.0) - a0) * 16.0);
        let w4 = 0.13 / (1.0 + abs(clamp(c4.a, 0.0, 1.0) - a0) * 16.0);
        let wSum = max(w0 + w1 + w2 + w3 + w4, 1e-5);
        let crossAvg = (c0 * w0 + c1 * w1 + c2 * w2 + c3 * w3 + c4 * w4) / wSum;
        let divider = max(dstDim.x / srcDim.x, dstDim.y / srcDim.y);
        let resolveF = smoothstep(2.0, 4.5, divider) * smoothstep(0.02, 0.40, a0);
        let c = mix(c0, crossAvg, resolveF * 0.22);

        let outX = i32(P.dstX + x);
        let outY = i32(P.dstY + y);
        textureStore(dstTex, vec2<i32>(outX, outY), i32(P.layer), c);
      }
    `;
      const mod = this.device.createShaderModule({ code: wgsl });
      const bgl = this.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            sampler: { type: "filtering" }
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "2d-array" }
          },
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              access: "write-only",
              format: fmt,
              viewDimension: "2d-array"
            }
          },
          {
            binding: 3,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          }
        ]
      });
      const pipe = this.device.createComputePipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
        compute: { module: mod, entryPoint: "main" }
      });
      const samp = this.device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      deviceCache.upsampleByFormat.set(fmt, { pipe, bgl, samp, format: fmt });
      this._upsample = { ...deviceCache.upsampleByFormat.get(fmt), bgCache: /* @__PURE__ */ new Map() };
      return this._upsample;
    }
    _getOrCreateUpsampleBindGroup(srcView, dstView) {
      const u = this._upsample;
      const key = `${this._getResId(srcView)}|${this._getResId(dstView)}|${this._getResId(u.samp)}|${this._getResId(this._upsampleParamsBuffer)}`;
      const map = u.bgCache;
      if (map.has(key)) return map.get(key);
      const bg = this.device.createBindGroup({
        layout: u.bgl,
        entries: [
          { binding: 0, resource: u.samp },
          { binding: 1, resource: srcView },
          { binding: 2, resource: dstView },
          { binding: 3, resource: { buffer: this._upsampleParamsBuffer } }
        ]
      });
      map.set(key, bg);
      if (map.size > 16) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
      }
      return bg;
    }
    _prepareUpsamplePass({ srcW, srcH, dstX, dstY, dstW, dstH } = {}) {
      if (!this._coarseView || !this.outView) return null;
      const u = this._ensureUpsamplePipeline(this.outFormat);
      const dv = this._dvUpsample;
      dv.setUint32(0, srcW >>> 0, true);
      dv.setUint32(4, srcH >>> 0, true);
      dv.setUint32(8, dstX >>> 0, true);
      dv.setUint32(12, dstY >>> 0, true);
      dv.setUint32(16, dstW >>> 0, true);
      dv.setUint32(20, dstH >>> 0, true);
      const layer = (this._dvFrame.getInt32(36, true) | 0) >>> 0;
      dv.setUint32(24, layer >>> 0, true);
      dv.setUint32(28, 0, true);
      this.queue.writeBuffer(
        this._upsampleParamsBuffer,
        0,
        this._u8(this._abUpsample)
      );
      const bg = this._getOrCreateUpsampleBindGroup(
        this._coarseView,
        this.outView
      );
      return {
        pipe: u.pipe,
        bg,
        wgX: Math.max(1, Math.ceil(dstW / 16)),
        wgY: Math.max(1, Math.ceil(dstH / 16))
      };
    }
    _encodeUpsamplePass(enc, prepared) {
      if (!prepared) return;
      const pass = enc.beginComputePass();
      pass.setPipeline(prepared.pipe);
      pass.setBindGroup(0, prepared.bg);
      pass.dispatchWorkgroups(prepared.wgX, prepared.wgY, 1);
      pass.end();
    }
    // -------------------- preview render --------------------
    _createRenderPipelineSetup(format = "bgra8unorm") {
      const deviceCache = getCloudGpuCache(this.device);
      if (!deviceCache.previewModule) {
        deviceCache.previewModule = this.device.createShaderModule({ code: cloudsRender_default });
      }
      const bgl = this.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "filtering" }
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d-array" }
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" }
          }
        ]
      });
      const descriptor = {
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
        vertex: { module: deviceCache.previewModule, entryPoint: "vs_main" },
        fragment: { module: deviceCache.previewModule, entryPoint: "fs_main", targets: [{ format }] },
        primitive: { topology: "triangle-list" }
      };
      const samp = this.device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      return { descriptor, bgl, samp };
    }
    _ensureRenderPipeline(format = "bgra8unorm") {
      if (this._render && this._render.format === format) return this._render;
      const deviceCache = getCloudGpuCache(this.device);
      const cachedRender = deviceCache.previewByFormat.get(format);
      if (cachedRender) {
        this._render = cachedRender;
        return this._render;
      }
      const { descriptor, bgl, samp } = this._createRenderPipelineSetup(format);
      const pipe = this.device.createRenderPipeline(descriptor);
      deviceCache.previewByFormat.set(format, { pipe, bgl, samp, format });
      this._render = deviceCache.previewByFormat.get(format);
      return this._render;
    }
    async ensureRenderPipelineReadyAsync(format = "bgra8unorm") {
      if (this._render && this._render.format === format) return this._render;
      const renderAtStart = this._render;
      const deviceCache = getCloudGpuCache(this.device);
      const cachedRender = deviceCache.previewByFormat.get(format);
      if (cachedRender) {
        this._render = cachedRender;
        return this._render;
      }
      let pending = deviceCache.previewPromises.get(format);
      if (!pending) {
        const { descriptor, bgl, samp } = this._createRenderPipelineSetup(format);
        const create = async () => {
          const pipe = typeof this.device.createRenderPipelineAsync === "function" ? await this.device.createRenderPipelineAsync(descriptor) : this.device.createRenderPipeline(descriptor);
          const installed = deviceCache.previewByFormat.get(format);
          if (installed) return installed;
          const render = { pipe, bgl, samp, format };
          deviceCache.previewByFormat.set(format, render);
          return render;
        };
        pending = create();
        deviceCache.previewPromises.set(format, pending);
      }
      try {
        const render = await pending;
        if (this._render === renderAtStart || this._render?.format === format) {
          this._render = render;
        }
        return render;
      } finally {
        if (deviceCache.previewPromises.get(format) === pending) {
          deviceCache.previewPromises.delete(format);
        }
      }
    }
    _getRenderSourceView() {
      return this._renderSourceView || this.outView;
    }
    _getOrCreateRenderBindGroup(canvas, bgl, samp) {
      let map = this._renderBgCache.get(canvas);
      if (!map) {
        map = /* @__PURE__ */ new Map();
        this._renderBgCache.set(canvas, map);
      }
      const sourceView = this._getRenderSourceView();
      const key = this._getResId(sourceView) + "|" + this._getResId(samp) + "|" + this._getResId(this.renderParams);
      if (map.has(key)) return map.get(key);
      const bg = this.device.createBindGroup({
        layout: bgl,
        entries: [
          { binding: 0, resource: samp },
          { binding: 1, resource: sourceView },
          {
            binding: 2,
            resource: { buffer: this.renderParams, offset: 0, size: this._abRender.byteLength }
          }
        ]
      });
      map.set(key, bg);
      if (map.size > 8) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
      }
      return bg;
    }
    _getOrCreateRenderBundle(canvas, pipe, bgl, samp) {
      let map = this._renderBundleCache.get(canvas);
      if (!map) {
        map = /* @__PURE__ */ new Map();
        this._renderBundleCache.set(canvas, map);
      }
      const key = this._getResId(this._getRenderSourceView()) + "|" + this._getResId(samp) + "|" + this._getResId(this.renderParams) + "|" + this._getResId(pipe);
      if (map.has(key)) return map.get(key);
      const bg = this._getOrCreateRenderBindGroup(canvas, bgl, samp);
      const format = this._render.format;
      const rbe = this.device.createRenderBundleEncoder({
        colorFormats: [format]
      });
      rbe.setPipeline(pipe);
      rbe.setBindGroup(0, bg);
      rbe.draw(6, 1, 0, 0);
      const bundle = rbe.finish();
      map.set(key, bundle);
      if (map.size > 8) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
      }
      return bundle;
    }
    _writeRenderUniforms(opts = {}) {
      const dv = this._dvRender;
      const layerIndex = (opts.layerIndex ?? 0) >>> 0;
      const exposure = opts.exposure ?? 1.28;
      const sunBloom = opts.sunBloom ?? 0;
      const skyColor = opts.skyColor ?? [0.55, 0.7, 0.95];
      const gradeStyle = (opts.gradeStyle ?? 0) >>> 0;
      const sunColorTint = opts.sunColorTint ?? [1, 1, 1];
      const lightTint = opts.lightTint ?? [1, 1, 1];
      const shadowTint = opts.shadowTint ?? [0, 0, 0];
      const edgeTint = opts.edgeTint ?? [1, 1, 1];
      const styleShadowStrength = opts.styleShadowStrength ?? 0.96;
      const styleShadowEdge = opts.styleShadowEdge ?? 0;
      const styleShadowDarkness = opts.styleShadowDarkness ?? 0.06;
      const styleColorLift = opts.styleColorLift ?? 1.08;
      const styleSaturation = opts.styleSaturation ?? 1.02;
      const styleRimStrength = opts.styleRimStrength ?? 0.86;
      const styleSunBleed = opts.styleSunBleed ?? 0.82;
      const styleMidLift = opts.styleMidLift ?? 0.88;
      const silverIntensity = opts.silverIntensity ?? 1.15;
      const silverExponent = opts.silverExponent ?? 1.65;
      const outputWidth = Math.max(1, opts.outputWidth ?? this.width ?? 1);
      const outputHeight = Math.max(1, opts.outputHeight ?? this.height ?? 1);
      const godRaysEnabled = opts.godRaysEnabled ?? false;
      const godRayStrength = opts.godRayStrength ?? 0;
      const godRayLength = opts.godRayLength ?? 1;
      const godRayFalloff = opts.godRayFalloff ?? 1.55;
      const fogDensity = Math.max(0, Math.min(2, opts.fogDensity ?? 0.34));
      const fogHorizon = Math.max(0, Math.min(2, opts.fogHorizon ?? 0.3));
      const fogSun = Math.max(0, Math.min(2, opts.fogSun ?? 1.5));
      const renderBox = opts.box ?? this._state.box ?? { center: [0, 0, 0], half: [18, 0.6, 18] };
      const boxCenter = renderBox.center ?? [0, 0, 0];
      const boxHalf = renderBox.half ?? [18, 0.6, 18];
      let camPos, right, up, fwd, fovYRad, aspect, sunDir;
      if (opts.cam && opts.cam.camPos && opts.cam.right && opts.cam.up && opts.cam.fwd) {
        camPos = opts.cam.camPos;
        right = opts.cam.right;
        up = opts.cam.up;
        fwd = opts.cam.fwd;
        fovYRad = radDeg(opts.cam.fovYDeg ?? 60);
        aspect = opts.cam.aspect ?? 1;
        sunDir = opts.sunDir ?? [0, 1, 0];
      } else {
        const yaw = radDeg(opts.yawDeg ?? 0);
        const pitch = radDeg(opts.pitchDeg ?? 0);
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        fwd = norm3([sy * cp, sp, cy * cp]);
        const upRef = Math.abs(dot3(fwd, [0, 1, 0])) > 0.999 ? [0, 0, 1] : [0, 1, 0];
        right = norm3(cross3(upRef, fwd));
        up = cross3(fwd, right);
        const zoom = opts.zoom ?? 3;
        camPos = [-fwd[0] * zoom, -fwd[1] * zoom, -fwd[2] * zoom];
        fovYRad = radDeg(opts.fovYDeg ?? 60);
        aspect = opts.aspect ?? 1;
        const sAz = radDeg(opts.sunAzimuthDeg ?? 45);
        const sEl = radDeg(opts.sunElevationDeg ?? 20);
        const cel = Math.cos(sEl);
        sunDir = norm3([cel * Math.sin(sAz), Math.sin(sEl), cel * Math.cos(sAz)]);
      }
      const compositeQuality = Math.max(0, Math.min(2, opts.compositeQuality ?? 2)) >>> 0;
      const alphaFloor = Math.max(0, Math.min(1, opts.alphaFloor ?? 0.12));
      dv.setUint32(0, layerIndex, true);
      dv.setUint32(4, compositeQuality, true);
      dv.setFloat32(8, styleShadowDarkness, true);
      dv.setFloat32(12, (this._currentComputeVariantKey() & 64) !== 0 ? 1 : 0, true);
      writeVec3Padded(dv, 16, camPos);
      dv.setFloat32(28, Math.max(0, Math.min(1, opts.nightAmount ?? 0)), true);
      writeVec3Padded(dv, 32, right);
      writeVec3Padded(dv, 48, up);
      writeVec3Padded(dv, 64, fwd);
      dv.setFloat32(80, fovYRad, true);
      dv.setFloat32(84, aspect, true);
      dv.setFloat32(88, exposure, true);
      dv.setFloat32(92, sunBloom, true);
      writeVec3Padded(dv, 96, sunDir);
      dv.setFloat32(108, Math.max(0, Math.min(1, opts.celestialVisibility ?? 1)), true);
      writeVec3Padded(dv, 112, skyColor);
      dv.setFloat32(124, opts.skyCycle ? 1 : 0, true);
      dv.setUint32(128, gradeStyle, true);
      dv.setFloat32(132, styleShadowStrength, true);
      dv.setFloat32(136, styleColorLift, true);
      dv.setFloat32(140, styleSaturation, true);
      writeVec3Padded(dv, 144, sunColorTint);
      writeVec3Padded(dv, 160, lightTint);
      writeVec3Padded(dv, 176, shadowTint);
      writeVec3Padded(dv, 192, edgeTint);
      dv.setFloat32(208, styleRimStrength, true);
      dv.setFloat32(212, styleSunBleed, true);
      dv.setFloat32(216, styleShadowEdge, true);
      dv.setFloat32(220, styleMidLift, true);
      dv.setFloat32(224, godRaysEnabled ? 1 : 0, true);
      dv.setFloat32(228, godRayStrength, true);
      dv.setFloat32(232, godRayLength, true);
      dv.setFloat32(236, godRayFalloff, true);
      dv.setFloat32(240, alphaFloor, true);
      dv.setFloat32(244, fogDensity, true);
      dv.setFloat32(248, fogHorizon, true);
      dv.setFloat32(252, fogSun, true);
      dv.setFloat32(256, silverIntensity, true);
      dv.setFloat32(260, silverExponent, true);
      dv.setFloat32(264, outputWidth, true);
      dv.setFloat32(268, outputHeight, true);
      writeVec3Padded(dv, 272, boxCenter);
      writeVec3Padded(dv, 288, boxHalf);
      this._writeIfChanged("render", this.renderParams, this._abRender);
    }
    _ensureCanvasConfigured(canvas, format = "bgra8unorm", opts = {}) {
      if (!canvas) throw new Error("_ensureCanvasConfigured: canvas required");
      const max2D = this.device && this.device.limits && this.device.limits.maxTextureDimension2D || 16384;
      const cssW0 = opts.cssWidth ?? canvas.clientWidth ?? canvas.width ?? 1;
      const cssH0 = opts.cssHeight ?? canvas.clientHeight ?? canvas.height ?? 1;
      const cssW = Math.max(1, Math.round(cssW0));
      const cssH = Math.max(1, Math.round(cssH0));
      const dprRaw = opts.dpr ?? (window.devicePixelRatio || 1);
      const dpr = Math.max(1, Math.floor(dprRaw));
      let displayW = opts.pixelWidth != null ? Math.max(1, opts.pixelWidth | 0) : Math.max(1, Math.floor(cssW * dpr));
      let displayH = opts.pixelHeight != null ? Math.max(1, opts.pixelHeight | 0) : Math.max(1, Math.floor(cssH * dpr));
      if (displayW > max2D || displayH > max2D) {
        const s = Math.min(max2D / displayW, max2D / displayH);
        displayW = Math.max(1, Math.floor(displayW * s));
        displayH = Math.max(1, Math.floor(displayH * s));
      }
      let ctxRec = this._ctxCache.get(canvas);
      if (!ctxRec) {
        const ctx2 = canvas.getContext("webgpu");
        if (!ctx2) throw new Error("failed to get webgpu context");
        ctxRec = { ctx: ctx2, format: null };
        this._ctxCache.set(canvas, ctxRec);
      }
      const { ctx } = ctxRec;
      let state = this._canvasStates.get(canvas);
      if (!state) {
        state = { lastSize: [0, 0], hasContent: false };
        this._canvasStates.set(canvas, state);
      }
      if (state.lastSize[0] !== displayW || state.lastSize[1] !== displayH || ctxRec.format !== format) {
        ctx.configure({
          device: this.device,
          format,
          alphaMode: "opaque",
          size: [displayW, displayH]
        });
        state.lastSize = [displayW, displayH];
        state.hasContent = false;
        ctxRec.format = format;
      }
      return { ctx, state, displayW, displayH };
    }
    renderToCanvas(canvas, opts = {}) {
      if (!this.outView)
        throw new Error(
          "Nothing to render: run dispatch() first or setOutputView()."
        );
      const { pipe, bgl, samp, format } = this._ensureRenderPipeline("bgra8unorm");
      if (opts.displayWidth || opts.displayHeight) {
        const w = opts.displayWidth || Math.round(opts.displayHeight * this.width / this.height);
        const h = opts.displayHeight || Math.round(opts.displayWidth * this.height / this.width);
        canvas.style.width = `${Math.max(1, Math.floor(w))}px`;
        canvas.style.height = `${Math.max(1, Math.floor(h))}px`;
        canvas.style.removeProperty("aspect-ratio");
      }
      const { ctx, state, displayW, displayH } = this._ensureCanvasConfigured(
        canvas,
        format,
        opts
      );
      const skyColor = opts.skyColor ?? [0.55, 0.7, 0.95];
      if (!this._lastHadWork || !this.outView) {
        const enc2 = this.device.createCommandEncoder();
        const tex2 = ctx.getCurrentTexture();
        const pass2 = enc2.beginRenderPass({
          colorAttachments: [
            {
              view: tex2.createView(),
              loadOp: "clear",
              clearValue: {
                r: skyColor[0],
                g: skyColor[1],
                b: skyColor[2],
                a: 1
              },
              storeOp: "store"
            }
          ]
        });
        pass2.end();
        this.queue.submit([enc2.finish()]);
        state.hasContent = true;
        return;
      }
      const inferredAspect = (displayH > 0 ? displayW / displayH : 1) || 1;
      let renderOpts = opts;
      const hasAspect = Object.prototype.hasOwnProperty.call(opts || {}, "aspect") || opts.cam && Object.prototype.hasOwnProperty.call(opts.cam, "aspect");
      if (!hasAspect) {
        renderOpts = { ...opts, aspect: inferredAspect };
        if (opts.cam && opts.cam.camPos && opts.cam.right && opts.cam.up && opts.cam.fwd) {
          renderOpts.cam = { ...opts.cam, aspect: inferredAspect };
          delete renderOpts.aspect;
        }
      }
      this._writeRenderUniforms(renderOpts);
      const bundle = this._getOrCreateRenderBundle(canvas, pipe, bgl, samp);
      const enc = this.device.createCommandEncoder();
      const tex = ctx.getCurrentTexture();
      const loadOp = state.hasContent ? "load" : "clear";
      const pass = enc.beginRenderPass({
        colorAttachments: [
          {
            view: tex.createView(),
            loadOp,
            clearValue: { r: skyColor[0], g: skyColor[1], b: skyColor[2], a: 1 },
            storeOp: "store"
          }
        ]
      });
      pass.executeBundles([bundle]);
      pass.end();
      this.queue.submit([enc.finish()]);
      state.hasContent = true;
    }
  };

  // tools/clouds/cloudTiming.js
  function timingNow() {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }
  function cloneDetail(detail) {
    if (detail === void 0) return void 0;
    if (detail === null || typeof detail !== "object") return detail;
    try {
      return structuredClone(detail);
    } catch {
    }
    try {
      return JSON.parse(JSON.stringify(detail));
    } catch {
    }
    return String(detail);
  }
  var CloudTimingReport = class {
    constructor(label = "cloud", metadata = {}) {
      this.label = String(label || "cloud");
      this.metadata = cloneDetail(metadata) || {};
      this.startedAt = timingNow();
      this.finishedAt = null;
      this.stages = [];
      this.milestones = [];
      this._openStages = /* @__PURE__ */ new Map();
      this._nextStageId = 1;
    }
    start(name, detail = void 0, category = "work") {
      const id = this._nextStageId++;
      const stage = {
        id,
        name: String(name),
        category: String(category || "work"),
        startMs: timingNow() - this.startedAt,
        endMs: null,
        durationMs: null,
        status: "running"
      };
      const cloned = cloneDetail(detail);
      if (cloned !== void 0) stage.detail = cloned;
      this.stages.push(stage);
      this._openStages.set(id, stage);
      return id;
    }
    end(id, detail = void 0, status = "ok") {
      const stage = this._openStages.get(id);
      if (!stage) return null;
      stage.endMs = timingNow() - this.startedAt;
      stage.durationMs = Math.max(0, stage.endMs - stage.startMs);
      stage.status = String(status || "ok");
      const cloned = cloneDetail(detail);
      if (cloned !== void 0) {
        stage.detail = stage.detail && typeof stage.detail === "object" && cloned && typeof cloned === "object" ? { ...stage.detail, ...cloned } : cloned;
      }
      this._openStages.delete(id);
      return stage;
    }
    fail(id, error, detail = void 0) {
      const message = String(error?.message || error || "Unknown error");
      return this.end(id, { ...detail || {}, error: message }, "error");
    }
    mark(name, detail = void 0) {
      const milestone = {
        name: String(name),
        atMs: timingNow() - this.startedAt
      };
      const cloned = cloneDetail(detail);
      if (cloned !== void 0) milestone.detail = cloned;
      this.milestones.push(milestone);
      return milestone;
    }
    record(name, durationMs, detail = void 0, category = "work", startMs = void 0) {
      const duration = Math.max(0, Number(durationMs) || 0);
      const endMs = timingNow() - this.startedAt;
      const stage = {
        id: this._nextStageId++,
        name: String(name),
        category: String(category || "work"),
        startMs: Number.isFinite(startMs) ? Math.max(0, Number(startMs)) : Math.max(0, endMs - duration),
        endMs: Number.isFinite(startMs) ? Math.max(0, Number(startMs)) + duration : endMs,
        durationMs: duration,
        status: "ok"
      };
      const cloned = cloneDetail(detail);
      if (cloned !== void 0) stage.detail = cloned;
      this.stages.push(stage);
      return stage;
    }
    async measure(name, work, detail = void 0, category = "work") {
      const id = this.start(name, detail, category);
      try {
        const value = await work();
        this.end(id);
        return value;
      } catch (error) {
        this.fail(id, error);
        throw error;
      }
    }
    finish(metadata = void 0) {
      const endedAt = timingNow();
      for (const [id] of this._openStages) this.end(id, void 0, "unfinished");
      this.finishedAt = endedAt;
      const cloned = cloneDetail(metadata);
      if (cloned && typeof cloned === "object") this.metadata = { ...this.metadata, ...cloned };
      return this.snapshot();
    }
    snapshot() {
      const end = this.finishedAt ?? timingNow();
      const stages = this.stages.map((stage) => cloneDetail(stage));
      const byName = {};
      for (const stage of stages) {
        if (!Number.isFinite(stage.durationMs)) continue;
        byName[stage.name] = (byName[stage.name] || 0) + stage.durationMs;
      }
      return {
        label: this.label,
        metadata: cloneDetail(this.metadata) || {},
        totalMs: Math.max(0, end - this.startedAt),
        complete: this.finishedAt !== null,
        stages,
        milestones: this.milestones.map((milestone) => cloneDetail(milestone)),
        byName
      };
    }
  };

  // tools/clouds/weather/cloudAnvilLook.js
  var ANVIL_FORM = Object.freeze({ type: 3, halfY: 5.8, puffScale: 7, ao: 0.82, heightVariation: 0.18 });
  var ANVIL_PARAMS = Object.freeze({
    globalCoverage: 0.94,
    globalDensity: 11.8,
    cloudAnvilAmount: 1.15,
    cloudBeer: 6,
    silverIntensity: 1.15,
    silverExponent: 1.65
  });
  var ANVIL_TUNING = Object.freeze({
    puffScale: ANVIL_FORM.puffScale,
    aoStrength: ANVIL_FORM.ao,
    towerHeightVariation: ANVIL_FORM.heightVariation,
    fluffFactor: 4.9,
    sparsity: 0.44,
    definition: 0.72,
    raySmoothDens: 0.23,
    baseJitterFrac: 0.045,
    topJitterFrac: 0.32,
    verticalTextureHomogeneity: 1,
    verticalLayerDecorrelation: 1,
    sliceJitterStrength: 0.14,
    alphaCutoff: 0.965,
    alphaBoostThreshold: 0.2,
    alphaBoostAmount: 0.14,
    minOutputAlpha: 0.12,
    outputAlphaFeather: 0.52
  });
  var ANVIL_PRESET_VALUES = Object.freeze({
    "p-coverage": ANVIL_PARAMS.globalCoverage,
    "p-density": ANVIL_PARAMS.globalDensity,
    "p-anvil": ANVIL_PARAMS.cloudAnvilAmount,
    "p-beer": ANVIL_PARAMS.cloudBeer,
    "p-sI": ANVIL_PARAMS.silverIntensity,
    "p-sE": ANVIL_PARAMS.silverExponent,
    ...Object.fromEntries(Object.entries(ANVIL_TUNING).filter(([key]) => !["puffScale", "aoStrength", "towerHeightVariation"].includes(key)).map(([key, value]) => [`t-${key === "baseJitterFrac" ? "baseJitter" : key === "topJitterFrac" ? "topJitter" : key}`, value]))
  });

  // tools/clouds/weather/cloudWeatherCycle.js
  var clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  var smooth = (x) => {
    x = clamp(x, 0, 1);
    return x * x * (3 - 2 * x);
  };
  var mix = (a, b, t) => a + (b - a) * t;
  var color = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
  var wrap = (x, n) => (x % n + n) % n;
  var finite = (x, fallback) => Number.isFinite(Number(x)) ? Number(x) : fallback;
  var WEATHER_MAP_COUNT = 6;
  var WEATHER_STATES = Object.freeze([
    { name: "Broken cumulus", coverage: 0.64, density: 8.5, storm: 0, sparsity: 0.58, definition: 0.7, shelf: 0, deck: 0, wisps: 0 },
    { name: "Fair cumulus", coverage: 0.88, density: 9, storm: 0.08, sparsity: 0.4, definition: 0.62, shelf: 0, deck: 0, wisps: 0 },
    { name: "Building towers", coverage: 0.94, density: 10.5, storm: 0.65, sparsity: 0.34, definition: 0.68, shelf: 0, deck: 0, wisps: 0 },
    { name: "Anvil storms", coverage: ANVIL_PARAMS.globalCoverage, density: ANVIL_PARAMS.globalDensity, storm: ANVIL_PARAMS.cloudAnvilAmount, sparsity: ANVIL_TUNING.sparsity, definition: ANVIL_TUNING.definition, shelf: 0, deck: 0, wisps: 0 },
    { name: "Rain Shelf", coverage: 1.06, density: 11.5, storm: 0.85, sparsity: 0.18, definition: 0.64, shelf: 1, deck: 0, wisps: 0 },
    { name: "Widespread rain banks", coverage: 1.12, density: 12, storm: 0.75, sparsity: 0.1, definition: 0.55, shelf: 0.65, deck: 0.35, wisps: 0 },
    { name: "Asperitas waves", coverage: 1.04, density: 10.5, storm: 0.35, sparsity: 0.12, definition: 0.64, shelf: 0, deck: 0, wisps: 0, asperitas: 1 },
    { name: "Overcast stratus", coverage: 1.1, density: 9, storm: 0.3, sparsity: 0.06, definition: 0.42, shelf: 0, deck: 1, wisps: 0 },
    { name: "Breaking stratus", coverage: 0.77, density: 7, storm: 0.12, sparsity: 0.35, definition: 0.55, shelf: 0, deck: 0.65, wisps: 0 },
    { name: "Wispy high", coverage: 0.7, density: 4, storm: 0, sparsity: 0.58, definition: 0.48, shelf: 0, deck: 0, wisps: 1 },
    { name: "Feather cirrus", coverage: 0.82, density: 4.5, storm: 0, sparsity: 0.5, definition: 0.56, shelf: 0, deck: 0, wisps: 0, cirrus: 1 },
    { name: "Clearing cumulus", coverage: 0.8, density: 9, storm: 0.04, sparsity: 0.46, definition: 0.66, shelf: 0, deck: 0, wisps: 0.15 }
  ]);
  function normalizeWeatherCycle(config = {}) {
    return {
      enabled: config.enabled === true,
      timeOfDay: config.timeOfDay !== false,
      weatherSeconds: clamp(finite(config.weatherSeconds, 420), 30, 7200),
      daySeconds: clamp(finite(config.daySeconds, 180), 12, 7200),
      startHour: wrap(finite(config.startHour, 9), 24)
    };
  }
  function sampleWeatherCycle(seconds, options = {}) {
    const config = normalizeWeatherCycle(options);
    const elapsed = Math.max(0, finite(seconds, 0));
    const position = wrap(elapsed / config.weatherSeconds, 1) * WEATHER_STATES.length;
    const index = Math.floor(position), next = (index + 1) % WEATHER_STATES.length;
    const blend = smooth(position - index);
    const a = WEATHER_STATES[index], b = WEATHER_STATES[next];
    const weather = Object.fromEntries(["coverage", "density", "storm", "sparsity", "definition", "shelf", "deck", "wisps", "cirrus", "fluctus", "asperitas"].map((k) => [k, mix(a[k] ?? 0, b[k] ?? 0, blend)]));
    const mapPosition = wrap(elapsed / config.weatherSeconds, 1) * WEATHER_MAP_COUNT;
    const mapIndex = Math.floor(mapPosition), mapBlend = smooth(mapPosition - mapIndex);
    const hour = wrap(config.startHour + elapsed / config.daySeconds * 24, 24);
    const solar = Math.sin((hour - 6) / 24 * Math.PI * 2);
    const day = smooth((solar + 0.12) / 0.32);
    const dusk = Math.exp(-Math.pow(solar / 0.22, 2));
    const moon = solar < 0;
    const visibility = smooth(Math.abs(solar) / 0.18);
    const light = color([0.48, 0.65, 1], color([1, 0.38, 0.13], [1, 0.97, 0.9], smooth(solar / 0.5)), day);
    const intensity = visibility * (moon ? 0.3 : 1.45);
    const sky = color([0.01, 0.018, 0.045], color([0.08, 0.13, 0.28], [0.24, 0.48, 0.76], smooth(solar / 0.5)), day);
    const stormShade = 1 - weather.storm * 0.18;
    const greyAmount = clamp(weather.shelf * 0.45 + weather.deck * 0.55, 0, 0.65);
    const weatherSky = color(sky, sky.map(() => sky.reduce((sum, v) => sum + v, 0) / 3), greyAmount);
    return {
      index,
      next,
      blend,
      mapIndex,
      mapBlend,
      weather,
      hour,
      moon,
      day,
      dusk,
      visibility,
      label: `${a.name} \u2192 ${b.name}`,
      sun: { azDeg: wrap(90 + (hour - 6) * 15 + (moon ? 180 : 0), 360), elDeg: Math.asin(Math.abs(solar) * 0.9) * 180 / Math.PI, bloom: moon ? 0.03 : 0.22 },
      sky: weatherSky.map((v) => v * stormShade),
      lightColor: light.map((v) => v * intensity),
      shadowColor: color([0.1, 0.16, 0.28], [0.31, 0.4, 0.57], day),
      celestialColor: light.map((v) => v * (moon ? 0.22 : 1)),
      // Keep cell scale/height variation fixed during the loop: switching their
      // domain as a storm approaches would move/rebuild the entire population.
      // At mature anvil weather this is the exact standalone density/lighting look.
      tuning: { ...ANVIL_TUNING, formType: 4, sparsity: weather.sparsity, definition: weather.definition },
      cloudParams: { ...ANVIL_PARAMS, globalCoverage: weather.coverage, globalDensity: weather.density, cloudAnvilAmount: weather.storm },
      fieldProfile: { shelf: weather.shelf, deck: weather.deck, wisps: weather.wisps, cirrus: weather.cirrus, fluctus: weather.fluctus, asperitas: weather.asperitas }
    };
  }
  function cyclePreview(base, state, timeOfDay) {
    const preview = { ...base, weatherCycle: true, volumeShape: "box", box: { center: [base.box?.center?.[0] || 0, ANVIL_FORM.halfY - 0.3, base.box?.center?.[2] || 0], half: [base.box?.half?.[0] || 18, ANVIL_FORM.halfY, base.box?.half?.[2] || 18], uvScale: base.box?.uvScale || 1 } };
    if (timeOfDay) Object.assign(preview, {
      sun: state.sun,
      sky: state.sky,
      gradeStyle: 0,
      skyCycle: true,
      nightAmount: 1 - state.day,
      celestialVisibility: state.visibility,
      sunTint: state.celestialColor,
      cloudLitTint: [1, 1, 1],
      cloudShadowTint: [0.7, 0.8, 1],
      edgeTint: [1, 1, 1],
      exposure: mix(2.2, 1.1, state.day),
      fogDensity: 0.1,
      fogSun: 0.1,
      styleShadowStrength: 0.75,
      styleShadowDarkness: 0,
      styleColorLift: 1,
      styleSaturation: 1,
      godRaysEnabled: !state.moon,
      godRayStrength: 0.12 * state.visibility
    });
    return preview;
  }

  // tools/clouds/shaders/cloudWeatherBlend.wgsl
  var cloudWeatherBlend_default = "struct BlendParams { amount:f32, _padding:vec3<f32> };\n@group(0) @binding(0) var first: texture_2d_array<f32>;\n@group(0) @binding(1) var second: texture_2d_array<f32>;\n@group(0) @binding(2) var output: texture_storage_2d<rgba16float,write>;\n@group(0) @binding(3) var<uniform> blend: BlendParams;\n@compute @workgroup_size(8,8,1)\nfn blendWeather(@builtin(global_invocation_id) id:vec3<u32>) {\n  let dims=textureDimensions(output);\n  if(any(id.xy>=dims)) { return; }\n  let p=vec2<i32>(id.xy);\n  textureStore(output,p,mix(textureLoad(first,p,0,0),textureLoad(second,p,0,0),clamp(blend.amount,0.0,1.0)));\n}\n";

  // tools/clouds/weather/cloudWeatherGPU.js
  var CloudWeatherGPU = class {
    constructor(device2) {
      this.device = device2;
      this.size = 256;
      this.groups = [];
      this.signature = "";
    }
    async prepare(views, signature) {
      if (this.signature === signature && this.groups.length) return false;
      this.pipeline ||= await this.device.createComputePipelineAsync({ label: "weather-map-blend", layout: "auto", compute: { module: this.device.createShaderModule({ code: cloudWeatherBlend_default }), entryPoint: "blendWeather" } });
      this.texture ||= this.device.createTexture({ label: "weather-cycle-blend", size: [this.size, this.size, 1], format: "rgba16float", usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
      this.view ||= this.texture.createView({ dimension: "2d-array" });
      this.uniform ||= this.device.createBuffer({ label: "weather-cycle-blend-weight", size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const out = this.texture.createView({ dimension: "2d" });
      this.groups = views.map((view, i) => this.device.createBindGroup({ layout: this.pipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: view },
        { binding: 1, resource: views[(i + 1) % views.length] },
        { binding: 2, resource: out },
        { binding: 3, resource: { buffer: this.uniform } }
      ] }));
      this.signature = signature;
      this.lastTick = -1;
      return true;
    }
    blend(state, seconds) {
      const tick = Math.floor(seconds * 10);
      if (tick === this.lastTick) return false;
      this.lastTick = tick;
      this.device.queue.writeBuffer(this.uniform, 0, new Float32Array([state.mapBlend ?? state.blend]));
      const encoder = this.device.createCommandEncoder({ label: "weather-cycle-map-blend" }), pass = encoder.beginComputePass();
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.groups[state.mapIndex ?? state.index]);
      pass.dispatchWorkgroups(32, 32);
      pass.end();
      this.device.queue.submit([encoder.finish()]);
      return true;
    }
  };

  // tools/clouds/cloudTest.worker.js
  var device = null;
  var queue = null;
  var nb = null;
  var cb = null;
  var canvasMain = null;
  var ctxMain = null;
  var dbg = {
    weather: null,
    weatherG: null,
    weatherB: null,
    shapeR: null,
    detailR: null,
    blue: null
  };
  var MAIN_W = 1;
  var MAIN_H = 1;
  var PRESENT_W = 1;
  var PRESENT_H = 1;
  var DBG_W = 1;
  var DBG_H = 1;
  var SHAPE_SIZE = 128;
  var DETAIL_SIZE = 32;
  var WEATHER_W = 512;
  var WEATHER_H = 512;
  var BN_W = 256;
  var BN_H = 256;
  var BOOTSTRAP_LIMITS = Object.freeze({
    weather: 128,
    blue: 64,
    shape: 32,
    detail: 16,
    coarseFactor: 8
  });
  function bootstrapBakeOptions() {
    return {
      weather: {
        width: Math.max(16, Math.min(WEATHER_W, BOOTSTRAP_LIMITS.weather)),
        height: Math.max(16, Math.min(WEATHER_H, BOOTSTRAP_LIMITS.weather)),
        key: "weather2d-bootstrap",
        waitForGpu: true,
        debug: false
      },
      blue: {
        width: Math.max(16, Math.min(BN_W, BOOTSTRAP_LIMITS.blue)),
        height: Math.max(16, Math.min(BN_H, BOOTSTRAP_LIMITS.blue)),
        key: "blue2d-bootstrap",
        waitForGpu: true,
        debug: false
      },
      shape: {
        size: Math.max(8, Math.min(SHAPE_SIZE, BOOTSTRAP_LIMITS.shape)),
        id: "shape-bootstrap",
        waitForGpu: true,
        debug: false
      },
      detail: {
        size: Math.max(8, Math.min(DETAIL_SIZE, BOOTSTRAP_LIMITS.detail)),
        id: "detail-bootstrap",
        waitForGpu: true,
        debug: false
      }
    };
  }
  var debugPreviewEnabled = true;
  var mobileProfileEnabled = false;
  var lastResizeProfile = null;
  var noise = {
    weather: { arrayView: null, dirty: false, gCleared: false, bCleared: false },
    blue: { arrayView: null, dirty: false },
    shape128: { view3D: null, size: 128, dirty: false },
    detail32: { view3D: null, size: 32, dirty: false }
  };
  var BLUE_NOISE_SHARPNESS = 0.08;
  var BLUE_NOISE_CONTRAST = 0.62;
  var blueBlurPipeline = null;
  var blueBlurSampler = null;
  var blueBlurUniform = null;
  var blueBlurTexture = null;
  var blueBlurView = null;
  var blueBlurW = 0;
  var blueBlurH = 0;
  var currentShapeSlice = 0;
  var currentDetailSlice = 0;
  var historyTexA = null;
  var historyTexB = null;
  var historyViewA = null;
  var historyViewB = null;
  var historyPrevView = null;
  var historyOutView = null;
  var historyUsesAasOut = true;
  var historyAllocated = false;
  var historyTexWidth = 0;
  var historyTexHeight = 0;
  var historyTexLayers = 0;
  var motionTex = null;
  var motionView = null;
  var depthTex = null;
  var depthView = null;
  var workerReproj = null;
  var workerPerf = null;
  var workerTuning = null;
  var workerTuningVersion = 0;
  var lastAppliedTuningSignature = "";
  var loopEnabled = false;
  var loopRunning = false;
  var lastRunPayload = null;
  var emaSubmitFps = null;
  var emaLoopFps = null;
  var emaMaxRoundTripFps = null;
  var pendingResizePayload = null;
  var pendingResizeSerial = 0;
  var loopStopWaiters = [];
  var volumeRotationAngle = 1.05;
  var lastVolumeShape = "box";
  var weatherCycle = normalizeWeatherCycle();
  var weatherCycleSeconds = 0;
  var weatherCycleGPU = null;
  var weatherCycleState = null;
  var weatherCycleLastPost = -1;
  var weatherCycleBlendCount = 0;
  async function configureWeatherCycle(config) {
    const next = normalizeWeatherCycle(config);
    if (next.enabled) {
      if (!lastRunPayload) throw new Error("Render a scene before starting the weather cycle");
      weatherCycleGPU ||= new CloudWeatherGPU(device);
      const base = lastRunPayload.weatherParams || {};
      const billow = lastRunPayload.billowParams || {};
      const weatherB = lastRunPayload.weatherBParams || null;
      const signature = JSON.stringify({ base, billow, weatherB });
      if (weatherCycleGPU.signature !== signature) {
        const report = new CloudTimingReport("weather-cycle-prebake", { maps: WEATHER_MAP_COUNT, size: weatherCycleGPU.size });
        const views = [];
        for (let i = 0; i < WEATHER_MAP_COUNT; i++) {
          const key = "weather-cycle-" + i;
          const stage = report.start("weather-map-" + i, void 0, "gpu-submit");
          await bakeWeather2D({ ...base, time: (base.time || 0) + i * 1.25 }, true, billow, weatherB, {
            key,
            width: weatherCycleGPU.size,
            height: weatherCycleGPU.size,
            assign: false,
            debug: false,
            waitForGpu: false
          });
          views.push(nb.get2DView(key, { dimension: "2d-array" }));
          report.end(stage);
        }
        await weatherCycleGPU.prepare(views, signature);
        log("[WEATHER CYCLE PREBAKE]", report.finish());
      }
      if (!weatherCycle.enabled || next.startHour !== weatherCycle.startHour) weatherCycleSeconds = 0;
      weatherCycleGPU.lastTick = -1;
    }
    weatherCycle = next;
    weatherCycleState = null;
    lastAppliedTuningSignature = "";
    cb?.invalidateCloudFields();
    invalidateReprojectionHistory();
    return { enabled: next.enabled, cachedMaps: weatherCycleGPU?.groups.length || 0, weatherSeconds: next.weatherSeconds, daySeconds: next.daySeconds };
  }
  var shapeOffsetWorld = [0, 0, 0];
  var detailOffsetWorld = [0, 0, 0];
  var weatherOffsetWorld = [0, 0, 0];
  var shapeVel = [0.2, 0, 0];
  var detailVel = [0.05, 0, 0];
  var weatherVel = [0.01, 0, 0];
  var shapeScale = 0.13;
  var detailScale = 1.35;
  var weatherScale = 1;
  var shapeBias = 0;
  var detailBias = 0;
  var weatherBias = 0;
  var shapeAxisScale = [1, 1.22, 1];
  var detailAxisScale = [1, 1.48, 1];
  var weatherAxisScale = [1, 1, 1];
  var renderBundleCache = /* @__PURE__ */ new Map();
  var log = (...a) => postMessage({ type: "log", data: a });
  function emitTimingProgress(report, phase) {
    try {
      postMessage({
        type: "timing",
        data: { phase: String(phase || "working"), report: report?.snapshot?.() || report || null }
      });
    } catch {
    }
  }
  var lastPermSeed = null;
  var cachedEntryPointsRef = null;
  var cachedEntrySet = null;
  var LOOP_TARGET_MS = 1e3 / 60;
  var FRAME_LOG_EVERY = 240;
  var LOOP_MAX_GPU_FRAMES_IN_FLIGHT = 3;
  var CAMERA_RESET_FRAMES = 1;
  var submittedFrameCount = 0;
  var loopGpuFences = [];
  var lastViewSignature = null;
  var lastCloudSceneSignature = "";
  var lastCloudViewSignature = "";
  var lastRenderUniformSignature = "";
  var lastNoiseTransformSignature = "";
  var lastBaseWeatherView = null;
  var lastBaseBlueView = null;
  var lastBaseShapeView = null;
  var lastBaseDetailView = null;
  var reprojResetFrames = 0;
  var cloudPipelineWarmupPromise = null;
  var cloudPipelineWarmupState = "idle";
  var cloudPipelineWarmupTimings = null;
  var noisePipelineWarmupPromise = null;
  var noisePipelineWarmupState = "idle";
  var noisePipelineWarmupTimings = null;
  function deferToBrowser(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async function progressiveYield(enabled, message = "Working...") {
    if (!enabled) return;
    try {
      postMessage({ type: "progress", data: { message } });
    } catch {
    }
    await deferToBrowser();
  }
  function renderDebugIfEnabled(kind = "all") {
    if (!debugPreviewEnabled) return;
    if (kind === "weather") {
      renderWeatherDebug();
      return;
    }
    if (kind === "slices") {
      renderDebugSlices();
      return;
    }
    if (kind === "blue") {
      renderBlueDebug();
      return;
    }
    renderWeatherDebug();
    renderDebugSlices();
    renderBlueDebug();
  }
  async function ensureDevice() {
    if (device) return;
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: mobileProfileEnabled ? "low-power" : "high-performance" });
    if (!adapter) throw new Error("No suitable GPU adapter (worker)");
    try {
      device = await adapter.requestDevice();
    } catch (err) {
      console.warn("requestDevice failed", err);
      throw err;
    }
    queue = device.queue;
    nb = new NoiseComputeBuilder(device, queue);
    nb.initBlitRender?.();
    try {
      nb.buildPermTable(Date.now());
    } catch (e) {
      console.warn("nb.buildPermTable initial failed", e);
    }
    startCloudPipelineWarmup();
    startNoisePipelineWarmup();
  }
  function ensureCloudBuilder() {
    if (cb) return cb;
    cb = new CloudComputeBuilder(device, queue);
    lastNoiseTransformSignature = "";
    lastAppliedTuningSignature = "";
    pushTransformsToCloudBuilder();
    try {
      applyWorkerTuning(previewCloudBox(lastRunPayload?.preview || {}));
    } catch (e) {
      console.warn("Initial cb.setTuning failed", e);
    }
    renderBundleCache.clear();
    return cb;
  }
  function startCloudPipelineWarmup() {
    if (cloudPipelineWarmupPromise) return cloudPipelineWarmupPromise;
    const totalStarted = performance.now();
    const builderStarted = performance.now();
    const builder = ensureCloudBuilder();
    const builderMs = performance.now() - builderStarted;
    const asyncCompute = typeof device?.createComputePipelineAsync === "function";
    const asyncPreview = typeof device?.createRenderPipelineAsync === "function";
    cloudPipelineWarmupState = "running";
    const computeTask = (async () => {
      const started = performance.now();
      if (typeof builder.ensureComputePipelineReadyAsync === "function") {
        await builder.ensureComputePipelineReadyAsync();
      } else {
        builder.ensureComputePipelineReady();
      }
      return performance.now() - started;
    })();
    const previewTask = (async () => {
      const started = performance.now();
      if (typeof builder.ensureRenderPipelineReadyAsync === "function") {
        await builder.ensureRenderPipelineReadyAsync("bgra8unorm");
      } else {
        builder._ensureRenderPipeline("bgra8unorm");
      }
      return performance.now() - started;
    })();
    cloudPipelineWarmupPromise = Promise.allSettled([computeTask, previewTask]).then((results) => {
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
      const computeMs = results[0].value;
      const previewMs = results[1].value;
      cloudPipelineWarmupState = "ready";
      cloudPipelineWarmupTimings = {
        ok: true,
        asyncCompute,
        asyncPreview,
        builderMs,
        computeMs,
        computePipelines: builder.getComputePipelineTimings?.(),
        previewMs,
        totalMs: performance.now() - totalStarted
      };
      log("[BENCH] cloud pipeline warmup:", cloudPipelineWarmupTimings);
      return cloudPipelineWarmupTimings;
    }).catch((err) => {
      cloudPipelineWarmupState = "failed";
      cloudPipelineWarmupTimings = {
        ok: false,
        asyncCompute,
        asyncPreview,
        builderMs,
        totalMs: performance.now() - totalStarted,
        computePipelines: builder.getComputePipelineTimings?.(),
        error: String(err?.message || err)
      };
      console.warn("Cloud pipeline async warmup failed; falling back to on-demand creation", err);
      return cloudPipelineWarmupTimings;
    });
    return cloudPipelineWarmupPromise;
  }
  function startNoisePipelineWarmup() {
    if (noisePipelineWarmupPromise) return noisePipelineWarmupPromise;
    const entries = [
      "clearTexture",
      "computeFBM4D",
      "computeBillow4D",
      "computeBlueNoise",
      "computeAntiWorley4D",
      "computeWorley4D"
    ];
    const started = performance.now();
    const asyncSupported = typeof device?.createComputePipelineAsync === "function";
    noisePipelineWarmupState = asyncSupported ? "running" : "on-demand";
    if (!asyncSupported || !nb?.pipelineLayout || !nb?.shaderModule || !nb?.pipelines) {
      noisePipelineWarmupTimings = {
        ok: true,
        asyncSupported,
        deferredToFirstUse: true,
        entries,
        totalMs: performance.now() - started
      };
      noisePipelineWarmupPromise = Promise.resolve(noisePipelineWarmupTimings);
      return noisePipelineWarmupPromise;
    }
    const entryTimings = {};
    noisePipelineWarmupPromise = Promise.all(entries.map(async (entryPoint) => {
      if (nb.pipelines.has(entryPoint)) {
        entryTimings[entryPoint] = 0;
        return;
      }
      const entryStarted = performance.now();
      const pipeline = await device.createComputePipelineAsync({
        layout: nb.pipelineLayout,
        compute: { module: nb.shaderModule, entryPoint }
      });
      if (!nb.pipelines.has(entryPoint)) nb.pipelines.set(entryPoint, pipeline);
      entryTimings[entryPoint] = performance.now() - entryStarted;
    })).then(() => {
      noisePipelineWarmupState = "ready";
      noisePipelineWarmupTimings = {
        ok: true,
        asyncSupported,
        entries: entryTimings,
        totalMs: performance.now() - started
      };
      log("[BENCH] noise pipeline warmup:", noisePipelineWarmupTimings);
      return noisePipelineWarmupTimings;
    }).catch((error) => {
      noisePipelineWarmupState = "failed";
      noisePipelineWarmupTimings = {
        ok: false,
        asyncSupported,
        entries: entryTimings,
        error: String(error?.message || error),
        totalMs: performance.now() - started
      };
      console.warn("Noise pipeline async warmup failed; using on-demand compilation", error);
      return noisePipelineWarmupTimings;
    });
    return noisePipelineWarmupPromise;
  }
  function configureMainContext(width = MAIN_W, height = MAIN_H) {
    if (!canvasMain) return;
    const w = Math.max(1, width | 0);
    const h = Math.max(1, height | 0);
    ctxMain = canvasMain.getContext("webgpu");
    if (!ctxMain) throw new Error("Failed to get webgpu context for main canvas");
    if (canvasMain.width !== w) canvasMain.width = w;
    if (canvasMain.height !== h) canvasMain.height = h;
    const fmt = "bgra8unorm";
    ctxMain.configure({
      device,
      format: fmt,
      alphaMode: "opaque",
      size: [w, h]
    });
    PRESENT_W = w;
    PRESENT_H = h;
    renderBundleCache.clear();
    return ctxMain;
  }
  function normalizeResizePayload(payload = {}) {
    const main = payload.main || {};
    const dbgSize = payload.dbg || {};
    return {
      main: {
        width: Math.max(1, main.width | 0),
        height: Math.max(1, main.height | 0)
      },
      dbg: {
        width: Math.max(1, dbgSize.width | 0),
        height: Math.max(1, dbgSize.height | 0)
      },
      profile: payload.profile || null,
      serial: payload.serial || 0
    };
  }
  function resizePayloadSignature(payload = {}) {
    const p = normalizeResizePayload(payload);
    const dpr = Number(p.profile?.dpr || 0).toFixed(4);
    const cssW = p.profile?.cssWidth | 0;
    const cssH = p.profile?.cssHeight | 0;
    return [p.main.width, p.main.height, p.dbg.width, p.dbg.height, dpr, cssW, cssH].join("x");
  }
  async function applyResizePayloadNow(payload = {}) {
    const p = normalizeResizePayload(payload);
    const sameSize = MAIN_W === p.main.width && MAIN_H === p.main.height && DBG_W === p.dbg.width && DBG_H === p.dbg.height && canvasMain?.width === p.main.width && canvasMain?.height === p.main.height && PRESENT_W === p.main.width && PRESENT_H === p.main.height;
    lastResizeProfile = p.profile;
    if (sameSize) {
      return { ok: true, unchanged: true, serial: p.serial };
    }
    MAIN_W = p.main.width;
    MAIN_H = p.main.height;
    DBG_W = p.dbg.width;
    DBG_H = p.dbg.height;
    if (canvasMain) {
      canvasMain.width = MAIN_W;
      canvasMain.height = MAIN_H;
      PRESENT_W = MAIN_W;
      PRESENT_H = MAIN_H;
    }
    Object.values(dbg).forEach((c) => {
      if (c) {
        c.width = DBG_W;
        c.height = DBG_H;
      }
    });
    if (ctxMain) {
      configureMainContext(MAIN_W, MAIN_H);
    }
    renderBundleCache.clear();
    resetFrameStateCaches();
    if (cb) cb._bg0Dirty = cb._bg1Dirty = true;
    invalidateReprojectionHistory();
    renderDebugIfEnabled();
    return { ok: true, resized: true, serial: p.serial, width: MAIN_W, height: MAIN_H };
  }
  async function applyPendingResizeIfAny() {
    if (!pendingResizePayload) return null;
    const payload = pendingResizePayload;
    pendingResizePayload = null;
    return applyResizePayloadNow(payload);
  }
  function ensureMainPresentSize(width = MAIN_W, height = MAIN_H) {
    const w = Math.max(1, width | 0);
    const h = Math.max(1, height | 0);
    if (!ctxMain || PRESENT_W !== w || PRESENT_H !== h || canvasMain?.width !== w || canvasMain?.height !== h) {
      configureMainContext(w, h);
    }
    return ctxMain;
  }
  async function clearMainFrame(payload = {}) {
    await ensureDevice();
    const report = new CloudTimingReport("cloud-loading-sky");
    const sky = Array.isArray(payload?.sky) ? payload.sky : [0.5, 0.6, 0.8];
    const clearValue = {
      r: finiteNumber(sky[0], 0.5),
      g: finiteNumber(sky[1], 0.6),
      b: finiteNumber(sky[2], 0.8),
      a: 1
    };
    let stage = report.start("configure-main-presentation", { width: MAIN_W, height: MAIN_H }, "buffering");
    ensureMainPresentSize(MAIN_W, MAIN_H);
    report.end(stage);
    stage = report.start("encode-sky-clear", { clearValue }, "dispatch");
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: ctxMain.getCurrentTexture().createView(),
        loadOp: "clear",
        clearValue,
        storeOp: "store"
      }]
    });
    pass.end();
    const commandBuffer = encoder.finish();
    report.end(stage);
    stage = report.start("submit-sky-clear", void 0, "gpu-submit");
    queue.submit([commandBuffer]);
    report.end(stage);
    if (payload?.waitForGpu !== false && typeof queue.onSubmittedWorkDone === "function") {
      stage = report.start("wait-for-sky-visible", void 0, "gpu-wait");
      await queue.onSubmittedWorkDone();
      report.end(stage);
    }
    report.mark("loading-sky-visible");
    return report.finish({ clearValue });
  }
  function renderDebugSlices() {
    if (!nb) return;
    const s = Math.max(0, Math.min(SHAPE_SIZE - 1, currentShapeSlice | 0));
    const d = Math.max(0, Math.min(DETAIL_SIZE - 1, currentDetailSlice | 0));
    if (dbg.shapeR && noise.shape128.view3D) {
      nb.renderTexture3DSliceToCanvas(noise.shape128.view3D, dbg.shapeR, {
        depth: SHAPE_SIZE,
        slice: s,
        channel: 1,
        clear: true,
        width: DBG_W,
        height: DBG_H
      });
    }
    if (dbg.detailR && noise.detail32.view3D) {
      nb.renderTexture3DSliceToCanvas(noise.detail32.view3D, dbg.detailR, {
        depth: DETAIL_SIZE,
        slice: d,
        channel: 1,
        clear: true,
        width: DBG_W,
        height: DBG_H
      });
    }
  }
  function renderWeatherDebug() {
    if (!nb || !noise.weather.arrayView) return;
    if (dbg.weather) {
      nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weather, {
        preserveCanvasSize: true,
        clear: true,
        channel: 1,
        width: DBG_W,
        height: DBG_H
      });
    }
    if (dbg.weatherG) {
      nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weatherG, {
        preserveCanvasSize: true,
        clear: true,
        channel: 2,
        width: DBG_W,
        height: DBG_H
      });
    }
    if (dbg.weatherB) {
      nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weatherB, {
        preserveCanvasSize: true,
        clear: true,
        channel: 3,
        width: DBG_W,
        height: DBG_H
      });
    }
  }
  function renderBlueDebug() {
    if (!nb || !noise.blue.arrayView || !dbg.blue) return;
    nb.renderTextureToCanvas(noise.blue.arrayView, dbg.blue, {
      preserveCanvasSize: true,
      clear: true,
      width: DBG_W,
      height: DBG_H
    });
  }
  function maybeApplySeedToPermTable(params) {
    if (!params) return;
    const seedVal = params.seed;
    if (seedVal === void 0 || seedVal === null) return;
    const s = typeof seedVal === "string" ? Number(seedVal) || 0 : Number(seedVal) || 0;
    if (!Number.isFinite(s) || s === 0) return;
    if (lastPermSeed === s) return;
    try {
      nb.buildPermTable?.(s);
      lastPermSeed = s;
    } catch (e) {
      console.warn("buildPermTable(seed) failed", e);
    }
  }
  function isEntry4D(ep) {
    return typeof ep === "string" && /4D/.test(ep);
  }
  function getEntrySet() {
    const eps = Array.isArray(nb?.entryPoints) ? nb.entryPoints : [];
    if (cachedEntryPointsRef === eps && cachedEntrySet) return cachedEntrySet;
    cachedEntryPointsRef = eps;
    cachedEntrySet = new Set(eps.filter((x) => typeof x === "string" && x.length));
    return cachedEntrySet;
  }
  function sanitizeEntry(entry, fallback, opts = {}) {
    const { require4D = false } = opts;
    const set = getEntrySet();
    let s = typeof entry === "string" ? entry : "";
    if (s === "computeBillow4D" && !set.has(s) && set.has("computeBillow")) s = "computeBillow";
    if (!s) return fallback;
    if (!set.has(s)) return fallback;
    if (require4D && !isEntry4D(s)) return fallback;
    return s;
  }
  function stripKeys(src, keys) {
    const out = {};
    const o = src && typeof src === "object" ? src : {};
    for (const k of Object.keys(o)) {
      if (keys.has(k)) continue;
      out[k] = o[k];
    }
    return out;
  }
  function withToroidalFromMode(params, mode) {
    const p = params && typeof params === "object" ? { ...params } : {};
    p.toroidal = isEntry4D(mode) ? 1 : 0;
    return p;
  }
  async function bakeWeather2D(weatherParams = {}, force = false, billowParams = {}, weatherBParams = null, bakeOptions = {}) {
    const width = Math.max(1, (bakeOptions.width ?? WEATHER_W) | 0);
    const height = Math.max(1, (bakeOptions.height ?? WEATHER_H) | 0);
    const key = String(bakeOptions.key || "weather2d");
    const assign = bakeOptions.assign !== false;
    const showDebug = bakeOptions.debug !== false;
    const waitForGpu = !!bakeOptions.waitForGpu;
    if (assign && noise.weather.arrayView && !force && !noise.weather.dirty) {
      if (showDebug) renderDebugIfEnabled("weather");
      noise.weather.dirty = false;
      return { width, height, key, baseMs: 0, gMs: 0, bMs: 0, gpuWaitMs: 0, totalMs: 0 };
    }
    if (assign) cb?.invalidateCloudFields?.();
    const T0 = performance.now();
    const WEATHER_DROP = /* @__PURE__ */ new Set(["mode"]);
    const baseMode = sanitizeEntry(weatherParams.mode, "computeFBM", { require4D: false });
    const baseParamsRaw = stripKeys(weatherParams, WEATHER_DROP);
    const baseParams = withToroidalFromMode(baseParamsRaw, baseMode);
    maybeApplySeedToPermTable(baseParams);
    const t0 = performance.now();
    const baseView = await nb.computeToTexture(width, height, baseParams, {
      noiseChoices: ["clearTexture", baseMode],
      outputChannel: 1,
      textureKey: key,
      viewDimension: "2d-array"
    });
    const baseMs = performance.now() - t0;
    await deferToBrowser();
    const enabledG = !!(billowParams && billowParams.enabled === true);
    let gMs = 0;
    if (enabledG) {
      const G_DROP = /* @__PURE__ */ new Set(["mode", "enabled"]);
      const gMode = sanitizeEntry(billowParams.mode, "computeBillow", { require4D: false });
      const gParamsRaw = stripKeys(billowParams, G_DROP);
      const gParams = withToroidalFromMode(gParamsRaw, gMode);
      maybeApplySeedToPermTable(gParams);
      const tg0 = performance.now();
      await nb.computeToTexture(width, height, gParams, {
        noiseChoices: ["clearTexture", gMode],
        outputChannel: 2,
        textureKey: key,
        viewDimension: "2d-array"
      });
      gMs = performance.now() - tg0;
      await deferToBrowser();
      noise.weather.gCleared = false;
    } else if (!noise.weather.gCleared) {
      const tc0 = performance.now();
      await nb.computeToTexture(
        width,
        height,
        { zoom: 1 },
        {
          noiseChoices: ["clearTexture"],
          outputChannel: 2,
          textureKey: key,
          viewDimension: "2d-array"
        }
      );
      noise.weather.gCleared = true;
      gMs = performance.now() - tc0;
    }
    const enabledB = !!(weatherBParams && typeof weatherBParams === "object" && weatherBParams.enabled === true);
    let bMs = 0;
    if (enabledB) {
      const B_DROP = /* @__PURE__ */ new Set(["mode", "enabled"]);
      const bMode = sanitizeEntry(weatherBParams.mode, "computeBillow", { require4D: false });
      const bParamsRaw = stripKeys(weatherBParams, B_DROP);
      const bParams = withToroidalFromMode(bParamsRaw, bMode);
      maybeApplySeedToPermTable(bParams);
      const tb0 = performance.now();
      await nb.computeToTexture(width, height, bParams, {
        noiseChoices: ["clearTexture", bMode],
        outputChannel: 3,
        textureKey: key,
        viewDimension: "2d-array"
      });
      bMs = performance.now() - tb0;
      await deferToBrowser();
      noise.weather.bCleared = false;
    } else if (!noise.weather.bCleared) {
      const tc0 = performance.now();
      await nb.computeToTexture(
        width,
        height,
        { zoom: 1 },
        {
          noiseChoices: ["clearTexture"],
          outputChannel: 3,
          textureKey: key,
          viewDimension: "2d-array"
        }
      );
      noise.weather.bCleared = true;
      bMs = performance.now() - tc0;
    }
    const finalView = (typeof nb.get2DView === "function" ? nb.get2DView(key, { dimension: "2d-array" }) : baseView) || baseView;
    if (assign) {
      noise.weather.arrayView = finalView;
      noise.weather.dirty = false;
    }
    let gpuWaitMs = 0;
    if (waitForGpu && typeof queue?.onSubmittedWorkDone === "function") {
      const waitStarted = performance.now();
      await queue.onSubmittedWorkDone();
      gpuWaitMs = performance.now() - waitStarted;
    }
    if (assign && showDebug) renderDebugIfEnabled("weather");
    const totalMs = performance.now() - T0;
    log(
      "[BENCH] weather base(ms):",
      baseMs.toFixed(2),
      " g(ms):",
      gMs.toFixed(2),
      " b(ms):",
      bMs.toFixed(2),
      " total(ms):",
      totalMs.toFixed(2),
      " baseMode:",
      baseMode,
      " gEnabled:",
      enabledG,
      " bEnabled:",
      enabledB
    );
    return { width, height, key, baseMs, gMs, bMs, gpuWaitMs, totalMs };
  }
  function getBlueBlurPipeline() {
    if (blueBlurPipeline) return blueBlurPipeline;
    blueBlurSampler = blueBlurSampler || device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat"
    });
    blueBlurUniform = blueBlurUniform || device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const code = `
struct BlueBlurParams {
  dim: vec2<f32>,
  sharpness: f32,
  contrast: f32,
};

@group(0) @binding(0) var inTex: texture_2d_array<f32>;
@group(0) @binding(1) var inSamp: sampler;
@group(0) @binding(2) var outTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var<uniform> P: BlueBlurParams;

fn wrapCoord(p: vec2<i32>) -> vec2<i32> {
  let d = vec2<i32>(max(i32(P.dim.x), 1), max(i32(P.dim.y), 1));
  return vec2<i32>(((p.x % d.x) + d.x) % d.x, ((p.y % d.y) + d.y) % d.y);
}

fn readBlue(p: vec2<i32>) -> f32 {
  let q = wrapCoord(p);
  let uv = (vec2<f32>(q) + vec2<f32>(0.5, 0.5)) / max(P.dim, vec2<f32>(1.0, 1.0));
  return textureSampleLevel(inTex, inSamp, uv, 0i, 0.0).r;
}

fn blueWeight1D(o: i32) -> f32 {
  let a = abs(o);
  if (a == 0) { return 6.0; }
  if (a == 1) { return 4.0; }
  return 1.0;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let w = u32(max(P.dim.x, 1.0));
  let h = u32(max(P.dim.y, 1.0));
  if (gid.x >= w || gid.y >= h) { return; }

  let p = vec2<i32>(i32(gid.x), i32(gid.y));
  let c = readBlue(p);
  var gaussian = 0.0;

  for (var oy = -2; oy <= 2; oy = oy + 1) {
    for (var ox = -2; ox <= 2; ox = ox + 1) {
      let w2 = blueWeight1D(ox) * blueWeight1D(oy);
      gaussian = gaussian + readBlue(p + vec2<i32>(ox, oy)) * w2;
    }
  }

  gaussian = gaussian / 256.0;
  let softened = mix(gaussian, c, clamp(P.sharpness, 0.0, 1.0));
  let v = clamp((softened - 0.5) * clamp(P.contrast, 0.0, 2.0) + 0.5, 0.0, 1.0);
  textureStore(outTex, vec2<i32>(i32(gid.x), i32(gid.y)), vec4<f32>(v, v, v, 1.0));
}
`;
    blueBlurPipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code }),
        entryPoint: "main"
      }
    });
    return blueBlurPipeline;
  }
  function blurBlueNoiseView(inputView, width, height, sharpness = BLUE_NOISE_SHARPNESS) {
    if (!device || !queue || !inputView) return inputView;
    try {
      const pipeline = getBlueBlurPipeline();
      const w = Math.max(1, width | 0);
      const h = Math.max(1, height | 0);
      if (!blueBlurTexture || blueBlurW !== w || blueBlurH !== h) {
        if (blueBlurTexture) {
          try {
            blueBlurTexture.destroy?.();
          } catch {
          }
        }
        blueBlurTexture = device.createTexture({
          size: [w, h, 1],
          format: "rgba16float",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        });
        blueBlurW = w;
        blueBlurH = h;
        blueBlurView = blueBlurTexture.createView({
          dimension: "2d-array",
          baseArrayLayer: 0,
          arrayLayerCount: 1
        });
      }
      const storageView = blueBlurTexture.createView({ dimension: "2d" });
      const params = new Float32Array([
        w,
        h,
        Math.max(0, Math.min(1, sharpness)),
        BLUE_NOISE_CONTRAST
      ]);
      queue.writeBuffer(blueBlurUniform, 0, params.buffer, params.byteOffset, params.byteLength);
      const bg = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: inputView },
          { binding: 1, resource: blueBlurSampler },
          { binding: 2, resource: storageView },
          { binding: 3, resource: { buffer: blueBlurUniform } }
        ]
      });
      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bg);
      pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8), 1);
      pass.end();
      queue.submit([enc.finish()]);
      return blueBlurView || inputView;
    } catch (err) {
      try {
        console.warn("blue noise blur preprocess failed", err);
      } catch {
      }
      return inputView;
    }
  }
  async function bakeBlue2D(blueParams = {}, force = false, bakeOptions = {}) {
    const width = Math.max(1, (bakeOptions.width ?? BN_W) | 0);
    const height = Math.max(1, (bakeOptions.height ?? BN_H) | 0);
    const key = String(bakeOptions.key || "blue2d");
    const assign = bakeOptions.assign !== false;
    const showDebug = bakeOptions.debug !== false;
    const waitForGpu = !!bakeOptions.waitForGpu;
    maybeApplySeedToPermTable(blueParams);
    if (assign && noise.blue.arrayView && !force && !noise.blue.dirty) {
      noise.blue.dirty = false;
      if (showDebug && debugPreviewEnabled && dbg.blue) {
        nb.renderTextureToCanvas(noise.blue.arrayView, dbg.blue, {
          preserveCanvasSize: true,
          clear: true,
          width: DBG_W,
          height: DBG_H
        });
      }
      return { width, height, key, blueMs: 0, blurMs: 0, gpuWaitMs: 0, totalMs: 0 };
    }
    const T0 = performance.now();
    const t0 = performance.now();
    const arrView = await nb.computeToTexture(width, height, blueParams, {
      noiseChoices: ["clearTexture", "computeBlueNoise"],
      outputChannel: 0,
      textureKey: key
    });
    const blueMs = performance.now() - t0;
    const rawBlueView = (typeof nb.get2DView === "function" ? nb.get2DView(key) : arrView) || arrView;
    const blurT0 = performance.now();
    const filteredBlueView = blurBlueNoiseView(rawBlueView, width, height, BLUE_NOISE_SHARPNESS);
    const blurMs = performance.now() - blurT0;
    const finalView = filteredBlueView || rawBlueView;
    if (assign) {
      noise.blue.arrayView = finalView;
      noise.blue.dirty = false;
    }
    let gpuWaitMs = 0;
    if (waitForGpu && typeof queue?.onSubmittedWorkDone === "function") {
      const waitStarted = performance.now();
      await queue.onSubmittedWorkDone();
      gpuWaitMs = performance.now() - waitStarted;
    }
    if (assign && showDebug && debugPreviewEnabled && dbg.blue) {
      nb.renderTextureToCanvas(noise.blue.arrayView, dbg.blue, {
        preserveCanvasSize: true,
        clear: true,
        width: DBG_W,
        height: DBG_H
      });
    }
    const totalMs = performance.now() - T0;
    log("[BENCH] blue noise(ms):", blueMs.toFixed(2), " blur(ms):", blurMs.toFixed(2), " total(ms):", totalMs.toFixed(2));
    return { width, height, key, blueMs, blurMs, gpuWaitMs, totalMs };
  }
  async function bakeShape128(shapeParams = {}, force = false, bakeOptions = {}) {
    const size = Math.max(1, (bakeOptions.size ?? SHAPE_SIZE) | 0);
    const id = String(bakeOptions.id || "shape128");
    const assign = bakeOptions.assign !== false;
    const showDebug = bakeOptions.debug !== false;
    const waitForGpu = bakeOptions.waitForGpu !== false;
    maybeApplySeedToPermTable(shapeParams);
    if (assign && noise.shape128.view3D && !force && !noise.shape128.dirty) {
      noise.shape128.dirty = false;
      if (showDebug) renderDebugIfEnabled("slices");
      return { size, id, baseMs: 0, bandsMs: [0, 0, 0], gpuWaitMs: 0, totalMs: 0 };
    }
    if (assign) cb?.invalidateCloudFields?.();
    const T0 = performance.now();
    const drop = /* @__PURE__ */ new Set(["baseModeA", "baseModeB", "bandMode2", "bandMode3", "bandMode4"]);
    const baseParamsRaw = stripKeys(shapeParams, drop);
    const baseParams = { ...baseParamsRaw, toroidal: 1, band: "base" };
    const baseModeA = sanitizeEntry(shapeParams.baseModeA, "computePerlin4D", { require4D: true });
    const baseModeB = sanitizeEntry(shapeParams.baseModeB, "computeAntiWorley4D", { require4D: true });
    const baseChoices = ["clearTexture", baseModeA];
    if (baseModeB && baseModeB !== baseModeA) baseChoices.push(baseModeB);
    const t0 = performance.now();
    await nb.computeToTexture3D(size, size, size, baseParams, {
      noiseChoices: baseChoices,
      outputChannel: 1,
      id
    });
    const baseMs = performance.now() - t0;
    await deferToBrowser();
    const z = Number(shapeParams.zoom) || 1;
    const bandSpecs = [
      { ch: 2, zm: z / 2, mode: sanitizeEntry(shapeParams.bandMode2, "computeWorley4D", { require4D: true }) },
      { ch: 3, zm: z / 4, mode: sanitizeEntry(shapeParams.bandMode3, "computeWorley4D", { require4D: true }) },
      { ch: 4, zm: z / 8, mode: sanitizeEntry(shapeParams.bandMode4, "computeWorley4D", { require4D: true }) }
    ];
    const bandsMs = [];
    for (const b of bandSpecs) {
      const tb0 = performance.now();
      await nb.computeToTexture3D(
        size,
        size,
        size,
        { ...baseParamsRaw, zoom: b.zm, toroidal: 1 },
        {
          noiseChoices: ["clearTexture", b.mode],
          outputChannel: b.ch,
          id
        }
      );
      bandsMs.push(performance.now() - tb0);
      await deferToBrowser();
    }
    const finalView = nb.get3DView(id);
    if (assign) {
      noise.shape128.view3D = finalView;
      noise.shape128.size = size;
      noise.shape128.dirty = false;
    }
    let gpuWaitMs = 0;
    if (waitForGpu && typeof queue?.onSubmittedWorkDone === "function") {
      const waitStarted = performance.now();
      await queue.onSubmittedWorkDone();
      gpuWaitMs = performance.now() - waitStarted;
    }
    if (assign && showDebug) renderDebugIfEnabled("slices");
    const totalMs = performance.now() - T0;
    log(
      "[BENCH] shape base(ms):",
      baseMs.toFixed(2),
      " bands(ms):",
      bandsMs.map((x) => x.toFixed(2)).join(", "),
      " total(ms):",
      totalMs.toFixed(2),
      " base:",
      baseModeA,
      "+",
      baseModeB,
      " bands:",
      bandSpecs.map((b) => `${b.ch}:${b.mode}`).join(" ")
    );
    return { size, id, baseMs, bandsMs, gpuWaitMs, totalMs };
  }
  async function bakeDetail32(detailParams = {}, force = false, bakeOptions = {}) {
    const size = Math.max(1, (bakeOptions.size ?? DETAIL_SIZE) | 0);
    const id = String(bakeOptions.id || "detail32");
    const assign = bakeOptions.assign !== false;
    const showDebug = bakeOptions.debug !== false;
    const waitForGpu = bakeOptions.waitForGpu !== false;
    maybeApplySeedToPermTable(detailParams);
    if (assign && noise.detail32.view3D && !force && !noise.detail32.dirty) {
      noise.detail32.dirty = false;
      if (showDebug) renderDebugIfEnabled("slices");
      return { size, id, bandsMs: [0, 0, 0], gpuWaitMs: 0, totalMs: 0 };
    }
    if (assign) cb?.invalidateCloudFields?.();
    const T0 = performance.now();
    const drop = /* @__PURE__ */ new Set(["mode1", "mode2", "mode3"]);
    const baseParamsRaw = stripKeys(detailParams, drop);
    const z = Number(detailParams.zoom) || 1;
    const m1 = sanitizeEntry(detailParams.mode1, "computeAntiWorley4D", { require4D: true });
    const m2 = sanitizeEntry(detailParams.mode2, "computeAntiWorley4D", { require4D: true });
    const m3 = sanitizeEntry(detailParams.mode3, "computeAntiWorley4D", { require4D: true });
    const bands = [
      { ch: 1, zm: z, mode: m1 },
      { ch: 2, zm: z / 2, mode: m2 },
      { ch: 3, zm: z / 4, mode: m3 }
    ];
    const bandsMs = [];
    for (const b of bands) {
      const tb0 = performance.now();
      await nb.computeToTexture3D(
        size,
        size,
        size,
        { ...baseParamsRaw, zoom: b.zm, toroidal: 1 },
        {
          noiseChoices: ["clearTexture", b.mode],
          outputChannel: b.ch,
          id
        }
      );
      bandsMs.push(performance.now() - tb0);
      await deferToBrowser();
    }
    const finalView = nb.get3DView(id);
    if (assign) {
      noise.detail32.view3D = finalView;
      noise.detail32.size = size;
      noise.detail32.dirty = false;
    }
    let gpuWaitMs = 0;
    if (waitForGpu && typeof queue?.onSubmittedWorkDone === "function") {
      const waitStarted = performance.now();
      await queue.onSubmittedWorkDone();
      gpuWaitMs = performance.now() - waitStarted;
    }
    if (assign && showDebug) renderDebugIfEnabled("slices");
    const totalMs = performance.now() - T0;
    log(
      "[BENCH] detail bands(ms):",
      bandsMs.map((x) => x.toFixed(2)).join(", "),
      " total(ms):",
      totalMs.toFixed(2),
      " modes:",
      `${m1},${m2},${m3}`
    );
    return { size, id, bandsMs, gpuWaitMs, totalMs };
  }
  function ensureHistoryTextures(w, h, layers = 1) {
    if (historyAllocated && historyTexWidth === w && historyTexHeight === h && historyTexLayers === layers) return;
    historyTexWidth = w;
    historyTexHeight = h;
    historyTexLayers = layers;
    try {
      historyTexA?.destroy?.();
    } catch {
    }
    try {
      historyTexB?.destroy?.();
    } catch {
    }
    historyTexA = historyTexB = null;
    historyViewA = historyViewB = null;
    historyPrevView = null;
    historyOutView = null;
    const desc = {
      size: [w, h, layers],
      format: "rgba16float",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
    };
    historyTexA = device.createTexture(desc);
    historyTexB = device.createTexture(desc);
    historyViewA = historyTexA.createView({ dimension: "2d-array", arrayLayerCount: layers });
    historyViewB = historyTexB.createView({ dimension: "2d-array", arrayLayerCount: layers });
    historyUsesAasOut = true;
    historyOutView = historyViewA;
    historyPrevView = null;
    historyAllocated = true;
  }
  function toVec3(v, fallback = null) {
    if (Array.isArray(v)) {
      const x = Number(v[0]), y = Number(v[1]), z = Number(v[2] ?? 0);
      if ([x, y, z].some((n) => Number.isNaN(n))) return fallback;
      return [x, y, z];
    }
    if (v && typeof v === "object") {
      const x = Number(v.x), y = Number(v.y), z = Number(v.z ?? 0);
      if ([x, y, z].some((n) => Number.isNaN(n))) return fallback;
      return [x, y, z];
    }
    return fallback;
  }
  function applyNoiseTransforms(nt, opts = {}) {
    if (!nt || typeof nt !== "object") return;
    const allowPositions = opts.allowPositions !== void 0 ? !!opts.allowPositions : true;
    const allowScale = opts.allowScale !== void 0 ? !!opts.allowScale : true;
    const allowVel = opts.allowVel !== void 0 ? !!opts.allowVel : true;
    const additive = !!opts.additive || !!nt.additive;
    const readScale = (x, fb) => {
      const v = Number(x);
      return Number.isFinite(v) ? v : fb;
    };
    const pickOffset = (o, legacy) => {
      const a = toVec3(o, null);
      if (a) return a;
      const b = toVec3(legacy, null);
      if (b) return b;
      return null;
    };
    const pickAxis = (v) => {
      const a = toVec3(v, null);
      return a ? a : null;
    };
    if (allowPositions) {
      const sOff = pickOffset(nt.shapeOffsetWorld, nt.shapeOffset);
      if (sOff) {
        if (additive) {
          shapeOffsetWorld[0] += sOff[0];
          shapeOffsetWorld[1] += sOff[1];
          shapeOffsetWorld[2] += sOff[2];
        } else {
          shapeOffsetWorld = sOff;
        }
      }
      const dOff = pickOffset(nt.detailOffsetWorld, nt.detailOffset);
      if (dOff) {
        if (additive) {
          detailOffsetWorld[0] += dOff[0];
          detailOffsetWorld[1] += dOff[1];
          detailOffsetWorld[2] += dOff[2];
        } else {
          detailOffsetWorld = dOff;
        }
      }
      const wOff = pickOffset(nt.weatherOffsetWorld, nt.weatherOffset);
      if (wOff) {
        if (additive) {
          weatherOffsetWorld[0] += wOff[0];
          weatherOffsetWorld[1] += wOff[1];
          weatherOffsetWorld[2] += wOff[2];
        } else {
          weatherOffsetWorld = wOff;
        }
      }
    }
    if (allowScale) {
      if (nt.shapeScale !== void 0) shapeScale = readScale(nt.shapeScale, shapeScale);
      if (nt.detailScale !== void 0) detailScale = readScale(nt.detailScale, detailScale);
      if (nt.weatherScale !== void 0) weatherScale = readScale(nt.weatherScale, weatherScale);
    }
    if (nt.shapeBias !== void 0) shapeBias = Number(nt.shapeBias) || 0;
    if (nt.detailBias !== void 0) detailBias = Number(nt.detailBias) || 0;
    if (nt.weatherBias !== void 0) weatherBias = Number(nt.weatherBias) || 0;
    if (allowVel) {
      const sv = toVec3(nt.shapeVel, null);
      if (sv) shapeVel = sv;
      const dv = toVec3(nt.detailVel, null);
      if (dv) detailVel = dv;
      const wv = toVec3(nt.weatherVel, null);
      if (wv) weatherVel = wv;
    }
    const sAx = pickAxis(nt.shapeAxisScale);
    if (sAx) shapeAxisScale = sAx;
    const dAx = pickAxis(nt.detailAxisScale);
    if (dAx) detailAxisScale = dAx;
    const wAx = pickAxis(nt.weatherAxisScale);
    if (wAx) weatherAxisScale = wAx;
  }
  function transformStateSignature() {
    return [
      shapeOffsetWorld[0],
      shapeOffsetWorld[1],
      shapeOffsetWorld[2],
      detailOffsetWorld[0],
      detailOffsetWorld[1],
      detailOffsetWorld[2],
      weatherOffsetWorld[0],
      weatherOffsetWorld[1],
      weatherOffsetWorld[2],
      shapeScale,
      detailScale,
      weatherScale,
      shapeAxisScale[0],
      shapeAxisScale[1],
      shapeAxisScale[2],
      detailAxisScale[0],
      detailAxisScale[1],
      detailAxisScale[2],
      weatherAxisScale[0],
      weatherAxisScale[1],
      weatherAxisScale[2],
      shapeBias,
      detailBias,
      weatherBias
    ].map((v) => signatureScalar(v, 6)).join("|");
  }
  function pushTransformsToCloudBuilder() {
    if (!cb) return;
    const sig = transformStateSignature();
    if (sig === lastNoiseTransformSignature) return;
    const t = {
      shapeOffsetWorld,
      detailOffsetWorld,
      weatherOffsetWorld,
      shapeScale,
      detailScale,
      weatherScale,
      shapeAxisScale,
      detailAxisScale,
      weatherAxisScale,
      shapeBias,
      detailBias,
      weatherBias
    };
    if (typeof cb.setNoiseTransforms === "function") cb.setNoiseTransforms(t);
    else if (typeof cb.setTileScaling === "function") cb.setTileScaling(t);
    else cb.noiseTransforms = t;
    lastNoiseTransformSignature = sig;
  }
  function syncBaseInputMaps() {
    if (!cb) return;
    const weatherView = weatherCycle.enabled && weatherCycleGPU?.view ? weatherCycleGPU.view : noise.weather.arrayView;
    const blueView = noise.blue.arrayView;
    const shape3DView = noise.shape128.view3D;
    const detail3DView = noise.detail32.view3D;
    if (weatherView === lastBaseWeatherView && blueView === lastBaseBlueView && shape3DView === lastBaseShapeView && detail3DView === lastBaseDetailView) {
      return;
    }
    cb.setInputMaps({
      weatherView,
      blueView,
      shape3DView,
      detail3DView
    });
    lastBaseWeatherView = weatherView;
    lastBaseBlueView = blueView;
    lastBaseShapeView = shape3DView;
    lastBaseDetailView = detail3DView;
  }
  function snapshotTransforms() {
    return {
      shapeOffsetWorld: shapeOffsetWorld.slice(0, 3),
      detailOffsetWorld: detailOffsetWorld.slice(0, 3),
      weatherOffsetWorld: weatherOffsetWorld.slice(0, 3),
      shapeScale,
      detailScale,
      weatherScale,
      shapeAxisScale: shapeAxisScale.slice(0, 3),
      detailAxisScale: detailAxisScale.slice(0, 3),
      weatherAxisScale: weatherAxisScale.slice(0, 3),
      shapeBias,
      detailBias,
      weatherBias,
      shapeVel: shapeVel.slice(0, 3),
      detailVel: detailVel.slice(0, 3),
      weatherVel: weatherVel.slice(0, 3)
    };
  }
  function normalizeTemporalCellRate(value) {
    const n = Math.max(1, Number(value) | 0);
    if (n >= 64) return 64;
    if (n >= 32) return 32;
    if (n >= 16) return 16;
    if (n >= 8) return 8;
    if (n >= 4) return 4;
    if (n >= 2) return 2;
    return 1;
  }
  function normalizeReproj(r) {
    if (!r) return null;
    const out = {
      enabled: (r.enabled ? 1 : 0) >>> 0,
      subsample: (r.subsample ? r.subsample >>> 0 : 0) >>> 0,
      sampleOffset: (r.sampleOffset ? r.sampleOffset >>> 0 : 0) >>> 0,
      motionIsNormalized: (r.motionIsNormalized ? 1 : 0) >>> 0,
      temporalBlend: typeof r.temporalBlend === "number" ? r.temporalBlend : r.enabled ? 0.9 : 0,
      depthTest: (r.depthTest ? 1 : 0) >>> 0,
      depthTolerance: typeof r.depthTolerance === "number" ? r.depthTolerance : 0,
      frameIndex: (r.frameIndex ? r.frameIndex >>> 0 : 0) >>> 0,
      fullWidth: r.fullWidth ? r.fullWidth >>> 0 : void 0,
      fullHeight: r.fullHeight ? r.fullHeight >>> 0 : void 0,
      temporalCellRate: normalizeTemporalCellRate(r.temporalCellRate),
      temporalCellPhase: r.temporalCellPhase ? r.temporalCellPhase >>> 0 : 0,
      compactInterleave: r.compactInterleave ? 1 : 0,
      scale: typeof r.scale === "number" ? r.scale : void 0,
      coarseFactor: typeof r.coarseFactor === "number" ? Math.max(1, r.coarseFactor | 0) : void 0
    };
    if (out.coarseFactor !== void 0) out.subsample = out.coarseFactor >>> 0;
    else if (out.scale !== void 0) {
      const s = Math.max(1e-6, out.scale);
      const ss = Math.max(1, Math.round(Math.sqrt(1 / s)));
      out.subsample = ss >>> 0;
    }
    if (!out.subsample || out.subsample < 1) out.subsample = 1;
    out.sampleOffset = out.sampleOffset >>> 0;
    return out;
  }
  function normalizeRenderScaleDivider(value, fallback = 3) {
    const v = Number.isFinite(+value) ? Math.floor(+value) : fallback;
    return Math.max(1, Math.min(8, v));
  }
  function previewRenderScaleDivider(preview) {
    return normalizeRenderScaleDivider(preview?.renderScaleDivider, 3);
  }
  function finiteNumber(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  function previewCloudBox(preview = {}) {
    const box = preview.box || {};
    const center = Array.isArray(box.center) ? box.center : [0, 0, 0];
    const half = Array.isArray(box.half) ? box.half : [18, 0.3, 18];
    return {
      center: [
        finiteNumber(center[0], 0),
        finiteNumber(center[1], 0),
        finiteNumber(center[2], 0)
      ],
      half: [
        Math.max(1e-3, finiteNumber(half[0], 18)),
        Math.max(1e-3, finiteNumber(half[1], 0.3)),
        Math.max(1e-3, finiteNumber(half[2], 18))
      ],
      uvScale: Math.max(1e-3, finiteNumber(box.uvScale, 1))
    };
  }
  function signatureScalar(v, digits = 5) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    const scale = 10 ** digits;
    return Math.round(n * scale) / scale;
  }
  function signatureVec3(v, fallback) {
    const a = Array.isArray(v) ? v : fallback;
    return `${signatureScalar(a?.[0] ?? fallback[0])},${signatureScalar(a?.[1] ?? fallback[1])},${signatureScalar(a?.[2] ?? fallback[2])}`;
  }
  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj || {}, key);
  }
  function signatureParam(params, key) {
    return hasOwn(params, key) ? signatureScalar(params[key]) : "";
  }
  function signatureParamVec3(params, key, fallback) {
    return hasOwn(params, key) ? signatureVec3(params[key], fallback) : "";
  }
  function cloudParamSignature(params = {}) {
    return [
      signatureParam(params, "globalCoverage"),
      signatureParam(params, "globalDensity"),
      signatureParam(params, "cloudAnvilAmount"),
      signatureParam(params, "cloudBeer"),
      signatureParam(params, "attenuationClamp"),
      signatureParam(params, "inScatterG"),
      signatureParam(params, "silverIntensity"),
      signatureParam(params, "silverExponent"),
      signatureParam(params, "outScatterG"),
      signatureParam(params, "inVsOut"),
      signatureParam(params, "outScatterAmbientAmt"),
      signatureParam(params, "ambientMinimum"),
      signatureParamVec3(params, "sunColor", [1, 0.985, 0.95]),
      signatureParam(params, "densityDivMin"),
      signatureParam(params, "silverDirectionBias"),
      signatureParam(params, "silverHorizonBoost"),
      signatureParamVec3(params, "frontLightColor", [1, 1, 1]),
      signatureParamVec3(params, "shadowLightColor", [0.62, 0.68, 0.78])
    ].join("|");
  }
  function cloudSceneSignature(box, params) {
    return [
      signatureVec3(box.center, [0, 0, 0]),
      signatureVec3(box.half, [18, 0.3, 18]),
      signatureScalar(box.uvScale ?? 1),
      cloudParamSignature(params || {})
    ].join("|");
  }
  function cloudViewSignature(preview, box, aspect) {
    const cam = preview?.cam || {};
    const sun = preview?.sun || {};
    return [
      signatureScalar(cam.x || 0),
      signatureScalar(cam.y || 0),
      signatureScalar(cam.z || 0),
      signatureScalar(cam.yawDeg || 0),
      signatureScalar(cam.pitchDeg || 0),
      signatureScalar(cam.fovYDeg || 60),
      signatureScalar(aspect),
      signatureScalar(sun.azDeg || 0),
      signatureScalar(sun.elDeg || 0),
      signatureScalar(box.center[1] - box.half[1]),
      signatureScalar(box.center[1] + box.half[1]),
      signatureScalar(box.uvScale)
    ].join("|");
  }
  function renderUniformSignature(preview, aspect, layerIndex, cloudParams = {}, cloudBox = null, outputWidth = MAIN_W, outputHeight = MAIN_H, fieldLighting = false) {
    const cam = preview?.cam || {};
    const sun = preview?.sun || {};
    const renderBox = cloudBox || previewCloudBox(preview || {});
    return [
      layerIndex,
      fieldLighting ? 1 : 0,
      preview?.skyCycle ? 1 : 0,
      signatureScalar(preview?.nightAmount || 0),
      signatureScalar(preview?.celestialVisibility ?? 1),
      signatureScalar(cam.x || 0),
      signatureScalar(cam.y || 0),
      signatureScalar(cam.z || 0),
      signatureScalar(cam.yawDeg || 0),
      signatureScalar(cam.pitchDeg || 0),
      signatureScalar(cam.fovYDeg || 60),
      signatureScalar(sun.azDeg || 0),
      signatureScalar(sun.elDeg || 0),
      signatureScalar(sun.bloom || 0),
      signatureScalar(aspect),
      signatureScalar(preview?.exposure || 1),
      signatureVec3(preview?.sky, [0.5, 0.6, 0.8]),
      preview?.gradeStyle ?? 1,
      signatureVec3(preview?.sunTint, [1, 1, 1]),
      signatureVec3(preview?.cloudLitTint, [1, 1, 1]),
      signatureVec3(preview?.cloudShadowTint, [1, 1, 1]),
      signatureVec3(preview?.edgeTint, [1, 1, 1]),
      signatureVec3(renderBox.center, [0, 0, 0]),
      signatureVec3(renderBox.half, [18, 0.6, 18]),
      signatureScalar(preview?.styleShadowStrength ?? 0.88),
      signatureScalar(preview?.styleShadowEdge ?? 0),
      signatureScalar(preview?.styleShadowDarkness ?? 0),
      signatureScalar(preview?.styleColorLift ?? 1.08),
      signatureScalar(preview?.styleSaturation ?? 1.02),
      signatureScalar(preview?.styleRimStrength ?? 0.86),
      signatureScalar(preview?.styleSunBleed ?? 0.82),
      signatureScalar(preview?.styleMidLift ?? 0.88),
      preview?.godRaysEnabled ? 1 : 0,
      signatureScalar(preview?.godRayStrength ?? 0),
      signatureScalar(preview?.godRayLength ?? 1),
      signatureScalar(preview?.godRayFalloff ?? 1.55),
      signatureScalar(preview?.alphaFloor ?? 0),
      signatureScalar(preview?.fogDensity ?? 0.34),
      signatureScalar(preview?.fogHorizon ?? 0.3),
      signatureScalar(preview?.fogSun ?? 1.5),
      signatureScalar(cloudParams?.silverIntensity ?? 1.15),
      signatureScalar(cloudParams?.silverExponent ?? 1.65),
      outputWidth | 0,
      outputHeight | 0
    ].join("|");
  }
  function resetFrameStateCaches() {
    lastCloudSceneSignature = "";
    lastCloudViewSignature = "";
    lastRenderUniformSignature = "";
    lastNoiseTransformSignature = "";
    lastBaseWeatherView = null;
    lastBaseBlueView = null;
    lastBaseShapeView = null;
    lastBaseDetailView = null;
  }
  function smoothstep01(edge0, edge1, x) {
    if (edge0 === edge1) return x >= edge1 ? 1 : 0;
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
  function autoThickBoxTuning(box) {
    const half = Array.isArray(box?.half) ? box.half : [18, 0.3, 18];
    const hx = Math.max(1e-3, finiteNumber(half[0], 18));
    const hy = Math.max(1e-3, finiteNumber(half[1], 0.3));
    const hz = Math.max(1e-3, finiteNumber(half[2], 18));
    const xz = Math.max(hx, hz, 1e-3);
    const height = Math.max(hy * 2, 1e-3);
    const heightF = smoothstep01(0.85, 5.5, height);
    const aspectF = smoothstep01(0.045, 0.28, height / xz);
    const horizonF = smoothstep01(24, 120, xz);
    const thickF = Math.max(heightF, aspectF);
    const reachF = Math.max(thickF, horizonF * 0.85);
    return {
      thickBoxPerf: +(0.6 + reachF * 1.9).toFixed(4),
      thickStepBoost: +(1.5 + reachF * 2.45).toFixed(4),
      thickDetailSkip: +(0.04 + thickF * 0.15).toFixed(4),
      thickLightSkip: +(0.58 + reachF * 1.55).toFixed(4)
    };
  }
  function getDispatchReprojSettings(r, coarseFactor = 1) {
    if (!r) return null;
    const out = Object.assign({}, r);
    if (coarseFactor >= 2) {
      out.subsample = 1;
      out.sampleOffset = 0;
      out.temporalCellRate = normalizeTemporalCellRate(out.temporalCellRate);
      out.temporalCellPhase = out.temporalCellRate > 1 ? (out.temporalCellPhase >>> 0) % out.temporalCellRate : 0;
      out.compactInterleave = out.temporalCellRate > 1 ? 1 : 0;
      out.temporalBlend = 0;
      out.enabled = 0;
    }
    return out;
  }
  function makeRenderBundleKey(pipe, bg, samp, paramsBuffer, outView) {
    const getId = cb && typeof cb._getResId === "function" ? cb._getResId.bind(cb) : (o) => String(o);
    return [pipe, bg, samp, paramsBuffer, outView].map(getId).join("|");
  }
  function getOrCreateRenderBundle(pipe, bgl, samp, format) {
    const bg = cb._getOrCreateRenderBindGroup(canvasMain, bgl, samp);
    const sourceView = typeof cb._getRenderSourceView === "function" ? cb._getRenderSourceView() : cb.outView;
    const bundleKey = makeRenderBundleKey(pipe, bg, samp, cb.renderParams, sourceView);
    if (renderBundleCache.has(bundleKey)) return { bundle: renderBundleCache.get(bundleKey), bg };
    const rbe = device.createRenderBundleEncoder({ colorFormats: [format] });
    rbe.setPipeline(pipe);
    rbe.setBindGroup(0, bg);
    rbe.draw(6, 1, 0, 0);
    const bundle = rbe.finish();
    renderBundleCache.set(bundleKey, bundle);
    if (renderBundleCache.size > 12) {
      const first = renderBundleCache.keys().next().value;
      renderBundleCache.delete(first);
    }
    return { bundle, bg };
  }
  function mergeTuningPatch(patch) {
    if (!patch) return;
    if (!workerTuning) workerTuning = {};
    let changed = false;
    for (const k of Object.keys(patch)) {
      const newRaw = patch[k];
      const v = typeof newRaw === "string" && newRaw.trim() !== "" && !Number.isNaN(Number(newRaw)) ? Number(newRaw) : newRaw;
      const prev = workerTuning[k];
      const isDifferent = prev !== v && !(Number.isNaN(prev) && Number.isNaN(v));
      if (isDifferent) {
        workerTuning[k] = v;
        changed = true;
      } else {
        workerTuning[k] = v;
      }
    }
    if (changed) workerTuningVersion = workerTuningVersion + 1 >>> 0;
  }
  function applyWorkerTuning(cloudBox = null) {
    const base = workerTuning && typeof workerTuning === "object" ? workerTuning : {};
    const autoThick = autoThickBoxTuning(cloudBox || previewCloudBox(lastRunPayload?.preview || {}));
    const tuningSignature = [
      workerTuningVersion,
      autoThick.thickBoxPerf,
      autoThick.thickStepBoost,
      autoThick.thickDetailSkip,
      autoThick.thickLightSkip
    ].join("|");
    if (tuningSignature === lastAppliedTuningSignature) return false;
    try {
      if (cb && typeof cb.setTuning === "function") {
        const appliedTuning = Object.assign({}, autoThick, base);
        cb.setTuning(appliedTuning);
        lastAppliedTuningSignature = tuningSignature;
        if (typeof appliedTuning.lodBiasWeather === "number" && typeof cb?.setPerfParams === "function") {
          cb.setPerfParams({
            lodBiasMul: appliedTuning.lodBiasWeather,
            coarseMipBias: 0
          });
        }
        return true;
      }
      return false;
    } catch (e) {
      console.warn("applyWorkerTuning failed", e);
      log("[TUNING] apply failed", String(e));
      return false;
    }
  }
  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }
  function norm(a) {
    const L = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / L, a[1] / L, a[2] / L];
  }
  function roundSig(v, scale = 1e4) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * scale) / scale : 0;
  }
  function makeColorSignature(arr, fallback = [1, 1, 1]) {
    const a = Array.isArray(arr) ? arr : fallback;
    return `${roundSig(a[0], 1e3)},${roundSig(a[1], 1e3)},${roundSig(a[2], 1e3)}`;
  }
  function makeViewSignature(preview, w, h) {
    const cam = preview?.cam || {};
    const sun = preview?.sun || {};
    if (preview?.weatherCycle) return ["weather-cycle", w, h, cam.x, cam.y, cam.z, cam.yawDeg, cam.pitchDeg, cam.fovYDeg, previewRenderScaleDivider(preview), preview.temporalCellRate, preview.fieldQuality || "balanced"].join("|");
    return [
      roundSig(cam.x),
      roundSig(cam.y),
      roundSig(cam.z),
      roundSig(cam.yawDeg),
      roundSig(cam.pitchDeg),
      roundSig(cam.fovYDeg),
      roundSig(sun.azDeg),
      roundSig(sun.elDeg),
      roundSig(sun.bloom, 1e3),
      roundSig(preview?.exposure, 1e3),
      previewRenderScaleDivider(preview),
      preview?.fieldQuality || "balanced",
      preview?.gradeStyle ?? 0,
      makeColorSignature(preview?.sky, [0.5, 0.6, 0.8]),
      makeColorSignature(preview?.sunTint, [1, 1, 1]),
      makeColorSignature(preview?.cloudLitTint, [1, 1, 1]),
      makeColorSignature(preview?.cloudShadowTint, [1, 1, 1]),
      makeColorSignature(preview?.edgeTint, [1, 1, 1]),
      roundSig(preview?.styleShadowStrength ?? 0.88, 1e3),
      roundSig(preview?.styleShadowEdge ?? 0, 1e3),
      roundSig(preview?.styleShadowDarkness ?? 0, 1e3),
      roundSig(preview?.styleColorLift ?? 1.12, 1e3),
      roundSig(preview?.styleSaturation ?? 1.1, 1e3),
      roundSig(preview?.styleRimStrength ?? 0.86, 1e3),
      roundSig(preview?.styleSunBleed ?? 0.82, 1e3),
      roundSig(preview?.styleMidLift ?? 1.1, 1e3),
      preview?.godRaysEnabled ? 1 : 0,
      normalizeTemporalCellRate(preview?.temporalCellRate ?? 1),
      roundSig(preview?.godRayStrength ?? 0, 1e3),
      roundSig(preview?.godRayLength ?? 1, 1e3),
      roundSig(preview?.godRayFalloff ?? 1.55, 1e3),
      w | 0,
      h | 0
    ].join("|");
  }
  function invalidateReprojectionHistory() {
    historyPrevView = null;
    historyOutView = historyUsesAasOut ? historyViewA : historyViewB;
    reprojResetFrames = Math.max(reprojResetFrames, CAMERA_RESET_FRAMES);
    if (workerReproj) {
      workerReproj.frameIndex = 0;
      workerReproj.sampleOffset = 0;
      workerReproj.temporalCellPhase = 0;
    }
  }
  function updateViewInvalidation(preview) {
    const sig = makeViewSignature(preview, MAIN_W, MAIN_H);
    if (lastViewSignature === null) {
      lastViewSignature = sig;
      return false;
    }
    if (sig !== lastViewSignature) {
      lastViewSignature = sig;
      invalidateReprojectionHistory();
      return true;
    }
    return false;
  }
  function cloneReprojForReset(r) {
    if (!r) return null;
    return Object.assign({}, r, {
      enabled: r.enabled ? 1 : 0,
      sampleOffset: 0,
      temporalBlend: 0,
      frameIndex: 0,
      temporalCellPhase: 0,
      compactInterleave: 0
    });
  }
  async function runFrame({
    weatherParams,
    billowParams,
    weatherBParams,
    shapeParams,
    detailParams,
    tileTransforms,
    noiseTransforms,
    preview,
    cloudParams,
    reproj = null,
    perf = null,
    motionImage = null,
    depthImage = null,
    coarseFactor = 1,
    tuning = null,
    waitForGpu = false,
    logFrame = false,
    bootstrapPreview = false
  } = {}) {
    const frameStarted = performance.now();
    const frameReport = new CloudTimingReport("cloud-frame", {
      requestedCoarseFactor: coarseFactor,
      requestedWaitForGpu: !!waitForGpu,
      bootstrapPreview: !!bootstrapPreview,
      outputSize: [MAIN_W, MAIN_H]
    });
    emitTimingProgress(frameReport, "frame:start");
    const deviceStage = frameReport.start("ensure-device", void 0, "setup");
    await ensureDevice();
    frameReport.end(deviceStage);
    try {
      const loopSafeReproj = reproj && typeof reproj === "object" ? Object.assign({}, reproj, { resetHistory: false }) : reproj;
      lastRunPayload = {
        weatherParams,
        billowParams,
        weatherBParams,
        shapeParams,
        detailParams,
        tileTransforms,
        noiseTransforms,
        preview,
        cloudParams,
        reproj: loopSafeReproj,
        perf,
        motionImage,
        depthImage,
        coarseFactor,
        tuning,
        waitForGpu,
        logFrame,
        bootstrapPreview
      };
    } catch {
    }
    if (weatherCycle.enabled && weatherCycleGPU?.groups.length) {
      weatherCycleState = sampleWeatherCycle(weatherCycleSeconds, weatherCycle);
      preview = cyclePreview(preview || {}, weatherCycleState, weatherCycle.timeOfDay);
      cloudParams = { ...cloudParams, ...weatherCycleState.cloudParams };
      if (weatherCycle.timeOfDay) Object.assign(cloudParams, {
        frontLightColor: weatherCycleState.lightColor,
        sunColor: weatherCycleState.lightColor,
        shadowLightColor: weatherCycleState.shadowColor
      });
      const stage = frameReport.start("weather-map-blend", void 0, "gpu-submit");
      const blended = weatherCycleGPU.blend(weatherCycleState, weatherCycleSeconds);
      if (blended) {
        weatherCycleBlendCount++;
        cb?.invalidateCloudFields();
      }
      frameReport.end(stage, { cached: !blended, maps: 6 });
    }
    const setupStage = frameReport.start("builder-uniform-buffer-setup", void 0, "buffering");
    if (tuning && typeof tuning === "object") mergeTuningPatch(tuning);
    const cloudBox = previewCloudBox(preview);
    const builderStarted = performance.now();
    ensureCloudBuilder();
    const builderMs = performance.now() - builderStarted;
    applyWorkerTuning(cloudBox);
    if (weatherCycle.enabled && weatherCycleState) {
      cb.setTuning({ ...autoThickBoxTuning(cloudBox), ...workerTuning, ...weatherCycleState.tuning });
      lastAppliedTuningSignature = "";
    }
    let outputAllocationMs = 0;
    let historyAllocationMs = 0;
    if (tileTransforms && typeof tileTransforms === "object") {
      applyNoiseTransforms(tileTransforms, {
        allowPositions: tileTransforms.explicit ? true : false,
        allowScale: true,
        allowVel: true,
        additive: !!tileTransforms.additive
      });
    }
    if (noiseTransforms && typeof noiseTransforms === "object") {
      applyNoiseTransforms(noiseTransforms, {
        allowPositions: true,
        allowScale: true,
        allowVel: true,
        additive: !!noiseTransforms.additive
      });
    }
    pushTransformsToCloudBuilder();
    frameReport.end(setupStage, { builderMs });
    const renderingFirstFrame = !ctxMain || cb.width !== MAIN_W || cb.height !== MAIN_H || cb.layers !== 1;
    if (renderingFirstFrame) await progressiveYield(true, "Rendering first frame...");
    const cameraChanged = updateViewInvalidation(preview);
    if (reproj) {
      const nextReproj = normalizeReproj(reproj);
      if (workerReproj && nextReproj && !reproj.resetHistory && nextReproj.enabled && nextReproj.frameIndex === 0 && workerReproj.frameIndex > 0) {
        nextReproj.frameIndex = workerReproj.frameIndex >>> 0;
        nextReproj.sampleOffset = workerReproj.sampleOffset >>> 0;
        nextReproj.temporalCellPhase = workerReproj.temporalCellPhase >>> 0;
      }
      workerReproj = nextReproj;
      if (reproj.resetHistory) invalidateReprojectionHistory();
    }
    if (perf) workerPerf = perf;
    const hasTemporalHistory = !!(workerReproj && workerReproj.temporalBlend > 1e-4);
    if (cameraChanged && hasTemporalHistory) invalidateReprojectionHistory();
    const fallbackStage = frameReport.start("fallback-resource-bakes", void 0, "gpu-submit");
    if (!noise.weather.arrayView) await bakeWeather2D(weatherParams, true, billowParams, weatherBParams);
    if (!noise.blue.arrayView) await bakeBlue2D({}, true);
    if (!noise.shape128.view3D) await bakeShape128(shapeParams, true);
    if (!noise.detail32.view3D) await bakeDetail32(detailParams, true);
    frameReport.end(fallbackStage);
    const inputBindingStage = frameReport.start("input-texture-bindings", void 0, "buffering");
    syncBaseInputMaps();
    frameReport.end(inputBindingStage);
    const workerTemporalCellRate = normalizeTemporalCellRate(workerReproj?.temporalCellRate);
    let effectiveCoarseFactor = Math.max(1, coarseFactor | 0, previewRenderScaleDivider(preview));
    const coarseComputeMode = effectiveCoarseFactor >= 2;
    const bootstrapPreviewMode = !!bootstrapPreview;
    const useReproj = !!(!bootstrapPreviewMode && workerReproj && workerReproj.enabled && !coarseComputeMode);
    const useTemporalCells = !bootstrapPreviewMode && workerTemporalCellRate > 1;
    const useFullResTemporalBlend = !!(!bootstrapPreviewMode && workerReproj && !coarseComputeMode && workerReproj.temporalBlend > 1e-4);
    const useCoarseInterleave = !!(!bootstrapPreviewMode && workerReproj && coarseComputeMode && useTemporalCells);
    const useTemporalHistory = !!(workerReproj && (useFullResTemporalBlend || useTemporalCells || useCoarseInterleave));
    const resetReprojThisFrame = useTemporalHistory && reprojResetFrames > 0;
    let effectiveReproj = workerReproj;
    if (resetReprojThisFrame) {
      effectiveReproj = cloneReprojForReset(workerReproj);
      historyPrevView = null;
    }
    if (useTemporalHistory) {
      if (!workerReproj && reproj) workerReproj = normalizeReproj(reproj);
      if (!effectiveReproj) effectiveReproj = workerReproj;
      if (effectiveReproj) {
        const ss = Math.max(1, effectiveReproj.subsample || 1);
        const cells = ss * ss;
        if (!(effectiveReproj.frameIndex === 0 && !historyPrevView)) {
          effectiveReproj.frameIndex = (effectiveReproj.frameIndex || 0) + 1 >>> 0;
          effectiveReproj.sampleOffset = effectiveReproj.frameIndex % cells >>> 0;
          const temporalCellRate = normalizeTemporalCellRate(effectiveReproj.temporalCellRate);
          effectiveReproj.temporalCellRate = temporalCellRate;
          effectiveReproj.temporalCellPhase = temporalCellRate > 1 ? effectiveReproj.frameIndex % temporalCellRate >>> 0 : 0;
          if (workerReproj) {
            workerReproj.frameIndex = effectiveReproj.frameIndex >>> 0;
            workerReproj.sampleOffset = effectiveReproj.sampleOffset >>> 0;
            workerReproj.temporalCellRate = effectiveReproj.temporalCellRate >>> 0;
            workerReproj.temporalCellPhase = effectiveReproj.temporalCellPhase >>> 0;
          }
        }
      }
    }
    if (useTemporalHistory) {
      if (!workerReproj && reproj) workerReproj = normalizeReproj(reproj);
      if (!effectiveReproj) effectiveReproj = workerReproj;
      if (useReproj && motionImage) {
        try {
          motionTex?.destroy?.();
          motionTex = device.createTexture({
            size: [motionImage.width, motionImage.height, 1],
            format: "rg8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
          });
          queue.copyExternalImageToTexture({ source: motionImage }, { texture: motionTex }, [motionImage.width, motionImage.height, 1]);
          motionView = motionTex.createView({ dimension: "2d" });
        } catch (e) {
          console.warn("Failed to upload motionImage", e);
          motionView = null;
        }
      } else {
        motionView = null;
      }
      if (useReproj && depthImage) {
        try {
          depthTex?.destroy?.();
          depthTex = device.createTexture({
            size: [depthImage.width, depthImage.height, 1],
            format: "r8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
          });
          queue.copyExternalImageToTexture({ source: depthImage }, { texture: depthTex }, [depthImage.width, depthImage.height, 1]);
          depthView = depthTex.createView({ dimension: "2d" });
        } catch (e) {
          console.warn("Failed to upload depthImage", e);
          depthView = null;
        }
      } else {
        depthView = null;
      }
      const outputNeedsSetup = cb.width !== MAIN_W || cb.height !== MAIN_H || cb.layers !== 1 || !coarseComputeMode && !cb.outTexture || coarseComputeMode && !!cb.outTexture;
      if (outputNeedsSetup) await progressiveYield(mobileProfileEnabled, "Allocating cloud render targets...");
      const outputAllocationStarted = performance.now();
      if (outputNeedsSetup) {
        if (coarseComputeMode && typeof cb.setOutputExtent === "function") {
          cb.setOutputExtent(MAIN_W, MAIN_H, 1, "rgba16float", { releaseOutput: true });
        } else cb.createOutputTexture(MAIN_W, MAIN_H, 1);
        outputAllocationMs += performance.now() - outputAllocationStarted;
      }
      const historyW = effectiveCoarseFactor >= 2 ? Math.max(1, Math.ceil(MAIN_W / effectiveCoarseFactor)) : cb.width || MAIN_W;
      const historyH = effectiveCoarseFactor >= 2 ? Math.max(1, Math.ceil(MAIN_H / effectiveCoarseFactor)) : cb.height || MAIN_H;
      const historyL = cb.layers || 1;
      const historyNeedsAlloc = !historyAllocated || historyTexWidth !== historyW || historyTexHeight !== historyH || historyTexLayers !== historyL;
      if (historyNeedsAlloc) await progressiveYield(mobileProfileEnabled, "Allocating temporal history...");
      const historyAllocationStarted = performance.now();
      ensureHistoryTextures(historyW, historyH, historyL);
      if (historyNeedsAlloc) historyAllocationMs += performance.now() - historyAllocationStarted;
      historyOutView = historyUsesAasOut ? historyViewA : historyViewB;
      cb.setInputMaps({
        motionView: motionView || null,
        depthPrevView: depthView || null,
        historyPrevView: historyPrevView || null
      });
      cb.setHistoryOutView(historyOutView);
      if (workerPerf) cb.setPerfParams(workerPerf);
      if (effectiveReproj) {
        effectiveReproj.coarseFactor = 1;
        effectiveReproj.scale = 1;
        effectiveReproj.temporalCellRate = normalizeTemporalCellRate(effectiveReproj.temporalCellRate);
        effectiveReproj.temporalCellPhase = effectiveReproj.temporalCellRate > 1 ? effectiveReproj.frameIndex % effectiveReproj.temporalCellRate >>> 0 : 0;
        cb.setReprojSettings(getDispatchReprojSettings(effectiveReproj, effectiveCoarseFactor));
      }
    } else {
      cb.setInputMaps({
        motionView: null,
        depthPrevView: null,
        historyPrevView: null
      });
      cb.setHistoryOutView(null);
      cb.setReprojSettings({
        enabled: 0,
        subsample: 1,
        sampleOffset: 0,
        temporalBlend: 0,
        frameIndex: 0,
        fullWidth: MAIN_W,
        fullHeight: MAIN_H,
        temporalCellRate: 1,
        temporalCellPhase: 0,
        compactInterleave: 0
      });
    }
    const cloudSig = cloudSceneSignature(cloudBox, cloudParams || {});
    const volumeShape = preview?.volumeShape || "box";
    if (volumeShape !== lastVolumeShape) {
      if (volumeShape === "torus") volumeRotationAngle = 1.05;
      if (volumeShape === "gallery") volumeRotationAngle = 2;
      lastVolumeShape = volumeShape;
    }
    cb.setVolumeMask({ shape: volumeShape, rotationAngle: volumeRotationAngle });
    cb.setWeatherProfile(weatherCycle.enabled ? weatherCycleState?.fieldProfile : void 0);
    cb.setFieldQuality(preview?.fieldQuality || "balanced");
    if (cloudSig !== lastCloudSceneSignature) {
      cb.setBox(cloudBox);
      cb.setParams(cloudParams || {});
      lastCloudSceneSignature = cloudSig;
    }
    const deg2rad = (d) => d * Math.PI / 180;
    const yaw = deg2rad(preview?.cam?.yawDeg || 0);
    const pit = deg2rad(preview?.cam?.pitchDeg || 0);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
    const fwd = norm([sy * cp, sp, cy * cp]);
    const upRef = Math.abs(dot(fwd, [0, 1, 0])) > 0.999 ? [0, 0, 1] : [0, 1, 0];
    const right = norm(cross(upRef, fwd));
    const up = cross(fwd, right);
    const aspect = Math.max(1e-6, MAIN_W / Math.max(1, MAIN_H));
    const sAz = deg2rad(preview?.sun?.azDeg || 0);
    const sEl = deg2rad(preview?.sun?.elDeg || 0);
    const cel = Math.cos(sEl);
    const sunDir = norm([cel * Math.sin(sAz), Math.sin(sEl), cel * Math.cos(sAz)]);
    const viewSig = cloudViewSignature(preview, cloudBox, aspect);
    if (viewSig !== lastCloudViewSignature) {
      cb.setViewFromCamera({
        camPos: [preview?.cam?.x || 0, preview?.cam?.y || 0, preview?.cam?.z || 0],
        right,
        up,
        fwd,
        fovYDeg: preview?.cam?.fovYDeg || 60,
        aspect,
        planetRadius: 0,
        cloudBottom: cloudBox.center[1] - cloudBox.half[1],
        cloudTop: cloudBox.center[1] + cloudBox.half[1],
        worldToUV: cloudBox.uvScale,
        stepBase: 0.02,
        stepInc: 0.04,
        volumeLayers: 1
      });
      cb.setLight({
        sunDir,
        camPos: [preview?.cam?.x || 0, preview?.cam?.y || 0, preview?.cam?.z || 0]
      });
      cb.setOptions({ writeRGB: true, outputChannel: 0, debugForceFog: 0 });
      lastCloudViewSignature = viewSig;
    }
    if (!useTemporalHistory) {
      const targetWidth = bootstrapPreviewMode ? Math.max(1, Math.ceil(MAIN_W / Math.max(1, effectiveCoarseFactor))) : MAIN_W;
      const targetHeight = bootstrapPreviewMode ? Math.max(1, Math.ceil(MAIN_H / Math.max(1, effectiveCoarseFactor))) : MAIN_H;
      const outputNeedsSetup = cb.width !== targetWidth || cb.height !== targetHeight || cb.layers !== 1 || bootstrapPreviewMode && !cb.outTexture || !bootstrapPreviewMode && !coarseComputeMode && !cb.outTexture || !bootstrapPreviewMode && coarseComputeMode && !!cb.outTexture;
      if (outputNeedsSetup) await progressiveYield(mobileProfileEnabled, "Allocating cloud render target...");
      const outputAllocationStarted = performance.now();
      if (outputNeedsSetup) {
        if (bootstrapPreviewMode) {
          cb.createOutputTexture(targetWidth, targetHeight, 1, "rgba16float");
        } else if (coarseComputeMode && typeof cb.setOutputExtent === "function") {
          cb.setOutputExtent(MAIN_W, MAIN_H, 1, "rgba16float", { releaseOutput: true });
        } else cb.createOutputTexture(MAIN_W, MAIN_H, 1);
        outputAllocationMs += performance.now() - outputAllocationStarted;
      }
    }
    const shouldWaitForGpu = !!waitForGpu;
    if (!bootstrapPreviewMode && cloudPipelineWarmupState === "running") {
      try {
        postMessage({ type: "progress", data: { message: "Finishing cloud shader compilation..." } });
      } catch {
      }
    }
    const tWarmupWait0 = performance.now();
    let warmupTimings;
    if (bootstrapPreviewMode) {
      const bootstrapWarmupStarted = performance.now();
      await Promise.all([
        cb.ensureBootstrapComputePipelineReadyAsync?.("rgba16float"),
        cb.ensureBootstrapRenderPipelineReadyAsync?.("bgra8unorm")
      ]);
      warmupTimings = {
        ok: true,
        bootstrapPreview: true,
        totalMs: performance.now() - bootstrapWarmupStarted,
        fullPipelineState: cloudPipelineWarmupState
      };
    } else {
      warmupTimings = await startCloudPipelineWarmup();
      const variantStarted = performance.now();
      await cb.ensureComputePipelineReadyAsync({ coarseFactor: effectiveCoarseFactor });
      warmupTimings = {
        ...warmupTimings,
        currentVariantWaitMs: performance.now() - variantStarted,
        computePipelines: cb.getComputePipelineTimings?.()
      };
    }
    const tWarmupWait1 = performance.now();
    const tP0 = performance.now();
    if (bootstrapPreviewMode && typeof cb._ensureBootstrapComputePipeline === "function") {
      cb._ensureBootstrapComputePipeline("rgba16float");
    } else if (typeof cb.ensureComputePipelineReady === "function") {
      cb.ensureComputePipelineReady({ coarseFactor: effectiveCoarseFactor });
    }
    const tP1 = performance.now();
    const tAll0 = performance.now();
    const tPreDrain0 = performance.now();
    if (shouldWaitForGpu && typeof queue.onSubmittedWorkDone === "function") {
      frameReport.mark("pre-dispatch-queue-drain-start");
      emitTimingProgress(frameReport, "frame:pre-dispatch-queue-drain");
      await queue.onSubmittedWorkDone();
    }
    const tPreDrain1 = performance.now();
    const cf = Math.max(1, effectiveCoarseFactor | 0);
    const tEncoder0 = performance.now();
    const enc = device.createCommandEncoder();
    const tEncoder1 = performance.now();
    const tC0 = performance.now();
    const reconstructAtPresentation = cf >= 2;
    const encodedDispatch = bootstrapPreviewMode ? cb.encodeBootstrapPreviewPass?.(enc) : typeof cb.encodeDispatchPasses === "function" ? cb.encodeDispatchPasses(enc, { coarseFactor: cf, reconstructAtPresentation }) : null;
    if (!encodedDispatch) {
      throw new Error("CloudComputeBuilder.encodeDispatchPasses is required for fused frame submission.");
    }
    const tC1 = performance.now();
    ensureMainPresentSize(MAIN_W, MAIN_H);
    const clearValue = {
      r: preview?.sky?.[0] ?? 0.5,
      g: preview?.sky?.[1] ?? 0.6,
      b: preview?.sky?.[2] ?? 0.8,
      a: 1
    };
    const tRenderPipeline0 = performance.now();
    let regularRenderPipeline = null;
    if (bootstrapPreviewMode) {
      cb._ensureBootstrapRenderPipeline?.("bgra8unorm");
    } else {
      regularRenderPipeline = cb._ensureRenderPipeline("bgra8unorm");
    }
    const tRenderPipeline1 = performance.now();
    const tR0 = performance.now();
    const tex = ctxMain.getCurrentTexture();
    if (bootstrapPreviewMode) {
      const encodedBootstrapRender = cb.encodeBootstrapRenderPass?.(
        enc,
        tex.createView(),
        { format: "bgra8unorm", clearValue }
      );
      if (!encodedBootstrapRender) {
        throw new Error("CloudComputeBuilder.encodeBootstrapRenderPass is required for bootstrap presentation.");
      }
    } else {
      const { pipe, bgl, samp, format } = regularRenderPipeline;
      const layerIndex = Math.max(0, Math.min((cb?.layers || 1) - 1, preview?.layer || 0));
      const renderSig = renderUniformSignature(preview, aspect, layerIndex, cloudParams || {}, cloudBox, MAIN_W, MAIN_H, (cb._currentComputeVariantKey() & 64) !== 0);
      if (renderSig !== lastRenderUniformSignature) {
        cb._writeRenderUniforms({
          layerIndex,
          cam: {
            camPos: [preview?.cam?.x || 0, preview?.cam?.y || 0, preview?.cam?.z || 0],
            right,
            up,
            fwd,
            fovYDeg: preview?.cam?.fovYDeg || 60,
            aspect
          },
          sunDir,
          box: cloudBox,
          exposure: preview?.exposure || 1,
          skyColor: preview?.sky || [0.5, 0.6, 0.8],
          skyCycle: !!preview?.skyCycle,
          nightAmount: preview?.nightAmount || 0,
          celestialVisibility: preview?.celestialVisibility ?? 1,
          sunBloom: preview?.sun?.bloom || 0,
          compositeQuality: 2,
          gradeStyle: preview?.gradeStyle ?? 1,
          sunColorTint: preview?.sunTint || [1, 1, 1],
          lightTint: preview?.cloudLitTint || [1, 1, 1],
          shadowTint: preview?.cloudShadowTint || [1, 1, 1],
          edgeTint: preview?.edgeTint || [1, 1, 1],
          styleShadowStrength: preview?.styleShadowStrength ?? 0.88,
          styleShadowEdge: preview?.styleShadowEdge ?? 0,
          styleShadowDarkness: preview?.styleShadowDarkness ?? 0,
          styleColorLift: preview?.styleColorLift ?? 1.08,
          styleSaturation: preview?.styleSaturation ?? 1.02,
          styleRimStrength: preview?.styleRimStrength ?? 0.86,
          styleSunBleed: preview?.styleSunBleed ?? 0.82,
          styleMidLift: preview?.styleMidLift ?? 0.88,
          silverIntensity: cloudParams?.silverIntensity ?? 1.15,
          silverExponent: cloudParams?.silverExponent ?? 1.65,
          outputWidth: MAIN_W,
          outputHeight: MAIN_H,
          godRaysEnabled: !!preview?.godRaysEnabled,
          godRayStrength: preview?.godRayStrength ?? 0,
          godRayLength: preview?.godRayLength ?? 1,
          godRayFalloff: preview?.godRayFalloff ?? 1.55,
          alphaFloor: preview?.alphaFloor ?? 0,
          fogDensity: preview?.fogDensity ?? 0.34,
          fogHorizon: preview?.fogHorizon ?? 0.3,
          fogSun: preview?.fogSun ?? 1.5
        });
        lastRenderUniformSignature = renderSig;
      }
      const { bundle } = getOrCreateRenderBundle(pipe, bgl, samp, format);
      const pass = enc.beginRenderPass({
        colorAttachments: [{
          view: tex.createView(),
          loadOp: "clear",
          clearValue,
          storeOp: "store"
        }]
      });
      pass.executeBundles([bundle]);
      pass.end();
    }
    const tSubmit0 = performance.now();
    const tFinish0 = performance.now();
    const commandBuffer = enc.finish();
    const tFinish1 = performance.now();
    queue.submit([commandBuffer]);
    const tQueueSubmit1 = performance.now();
    encodedDispatch.restoreAfterSubmit?.();
    if (useTemporalHistory && historyAllocated) {
      historyPrevView = historyOutView;
      historyUsesAasOut = !historyUsesAasOut;
      historyOutView = historyUsesAasOut ? historyViewA : historyViewB;
      cb.setInputMaps({ historyPrevView });
      cb.setHistoryOutView(historyOutView);
      if (resetReprojThisFrame) {
        reprojResetFrames = Math.max(0, reprojResetFrames - 1);
        if (workerReproj) {
          workerReproj.frameIndex = 0;
          workerReproj.sampleOffset = 0;
          workerReproj.temporalCellPhase = 0;
        }
      }
    }
    const tSubmit1 = performance.now();
    const tR1 = performance.now();
    const tWait0 = performance.now();
    if (shouldWaitForGpu && typeof queue.onSubmittedWorkDone === "function") {
      frameReport.mark("post-submit-queue-wait-start");
      emitTimingProgress(frameReport, "frame:post-submit-queue-wait");
      await queue.onSubmittedWorkDone();
    }
    const tWait1 = performance.now();
    const tAll1 = performance.now();
    submittedFrameCount = submittedFrameCount + 1 >>> 0;
    const timings = {
      computeMs: tC1 - tC0,
      renderMs: tR1 - tR0,
      submitMs: tSubmit1 - tSubmit0,
      gpuWaitMs: tWait1 - tWait0,
      preDispatchQueueDrainMs: tPreDrain1 - tPreDrain0,
      commandEncoderMs: tEncoder1 - tEncoder0,
      commandFinishMs: tFinish1 - tFinish0,
      queueSubmitMs: tQueueSubmit1 - tFinish1,
      totalMs: tAll1 - tAll0,
      pipelineMs: tP1 - tP0,
      pipelineWarmupWaitMs: tWarmupWait1 - tWarmupWait0,
      pipelineWarmup: warmupTimings,
      renderPipelineMs: tRenderPipeline1 - tRenderPipeline0,
      builderMs,
      outputAllocationMs,
      historyAllocationMs,
      startupToSubmitMs: tSubmit1 - frameStarted,
      waitedForGpu: shouldWaitForGpu,
      coarseFactor: cf,
      directFullResReconstruction: !!encodedDispatch.directFullResReconstruction,
      presentDivider: 1,
      presentWidth: MAIN_W,
      presentHeight: MAIN_H,
      resetReprojection: resetReprojThisFrame,
      temporalCellRate: workerTemporalCellRate,
      temporalCellPhase: workerReproj?.temporalCellPhase ?? 0,
      interleaveStats: encodedDispatch.interleaveStats || null,
      computeStages: encodedDispatch.stageTimings || [],
      frame: submittedFrameCount
    };
    frameReport.record("pipeline-warmup-wait", timings.pipelineWarmupWaitMs, warmupTimings, "pipeline");
    frameReport.record("compute-pipeline-ready", timings.pipelineMs, void 0, "pipeline");
    frameReport.record("pre-dispatch-queue-drain", timings.preDispatchQueueDrainMs, { waited: shouldWaitForGpu }, "gpu-wait");
    frameReport.record("output-texture-allocation", outputAllocationMs, void 0, "buffering");
    frameReport.record("history-texture-allocation", historyAllocationMs, void 0, "buffering");
    frameReport.record("command-encoder-create", timings.commandEncoderMs, void 0, "dispatch");
    frameReport.record("cloud-dispatch-encode", timings.computeMs, { coarseFactor: cf }, "dispatch");
    for (const stage of timings.computeStages) {
      frameReport.record(stage.stage, stage.encodeMs, stage, "dispatch");
    }
    frameReport.record("render-pipeline-ready", timings.renderPipelineMs, void 0, "pipeline");
    frameReport.record("preview-render-encode", timings.renderMs, void 0, "dispatch");
    frameReport.record("command-buffer-finish", timings.commandFinishMs, void 0, "dispatch");
    frameReport.record("queue-submit", timings.queueSubmitMs, void 0, "dispatch");
    frameReport.record("post-submit-queue-wait", timings.gpuWaitMs, { waited: shouldWaitForGpu }, "gpu-wait");
    frameReport.mark("frame-submitted", { frame: submittedFrameCount, coarseFactor: cf });
    timings.timingReport = frameReport.finish({
      effectiveCoarseFactor: cf,
      waitedForGpu: shouldWaitForGpu,
      directFullResReconstruction: !!encodedDispatch.directFullResReconstruction
    });
    emitTimingProgress(timings.timingReport, "frame:complete");
    if (shouldWaitForGpu || logFrame || submittedFrameCount % FRAME_LOG_EVERY === 0) {
      log(
        shouldWaitForGpu ? "[BENCH waited]" : "[BENCH submitted]",
        "compute(ms):",
        timings.computeMs.toFixed(2),
        "render-encode(ms):",
        timings.renderMs.toFixed(2),
        "pipeline(ms):",
        (timings.pipelineMs || 0).toFixed(2),
        "submit(ms):",
        (timings.submitMs || 0).toFixed(2),
        "gpu-wait(ms):",
        (timings.gpuWaitMs || 0).toFixed(2),
        "total(ms):",
        timings.totalMs.toFixed(2),
        "coarseFactor:",
        cf,
        "directFullResReconstruction:",
        !!encodedDispatch.directFullResReconstruction,
        "temporalCellRate:",
        workerTemporalCellRate,
        "interleave:",
        timings.interleaveStats ? `${timings.interleaveStats.updatedPixels}/${timings.interleaveStats.totalPixels} tile=${timings.interleaveStats.tile}` : "n/a"
      );
    }
    return timings;
  }
  function enqueueLoopGpuFence() {
    if (!queue || typeof queue.onSubmittedWorkDone !== "function") return;
    const fence = queue.onSubmittedWorkDone().catch(() => {
    });
    loopGpuFences.push(fence);
    if (loopGpuFences.length > LOOP_MAX_GPU_FRAMES_IN_FLIGHT + 2) {
      loopGpuFences.splice(0, loopGpuFences.length - (LOOP_MAX_GPU_FRAMES_IN_FLIGHT + 2));
    }
  }
  async function waitForLoopGpuBackpressure(targetInFlight = LOOP_MAX_GPU_FRAMES_IN_FLIGHT - 1) {
    if (!loopGpuFences.length) return;
    const target = Math.max(0, targetInFlight | 0);
    while (loopGpuFences.length > target) {
      const fence = loopGpuFences.shift();
      try {
        await fence;
      } catch {
      }
    }
  }
  function startLoop() {
    if (loopRunning) return;
    if (!lastRunPayload) {
      log("startLoop: no last run payload; call runFrame once first.");
      loopEnabled = true;
      return;
    }
    loopEnabled = true;
    loopGpuFences.length = 0;
    loopRunning = true;
    if (workerReproj && workerReproj.temporalBlend > 1e-4 && !historyPrevView) {
      invalidateReprojectionHistory();
      reprojResetFrames = Math.max(reprojResetFrames, 1);
    }
    (async () => {
      log("animation loop started");
      let prevTime = performance.now();
      let lastPresentedTime = prevTime;
      let submitWindowStart = prevTime;
      let submitWindowFrames = 0;
      let lastStatsPostTime = 0;
      emaLoopFps = null;
      emaMaxRoundTripFps = null;
      if (workerReproj && workerReproj.enabled) {
        workerReproj = normalizeReproj(workerReproj);
        workerReproj.frameIndex = workerReproj.frameIndex >>> 0;
        workerReproj.sampleOffset = workerReproj.sampleOffset >>> 0;
      }
      while (loopEnabled) {
        if (pendingResizePayload) {
          try {
            await waitForLoopGpuBackpressure(1);
            await applyPendingResizeIfAny();
          } catch (resizeErr) {
            postMessage({ type: "log", data: ["animation resize apply failed", String(resizeErr)] });
          }
        }
        const t0 = performance.now();
        let timings = null;
        let submitFrameMs = Number.NaN;
        let frameOk = false;
        let workerFrameMs = Number.NaN;
        try {
          const dt = Math.max(0, (t0 - prevTime) / 1e3);
          prevTime = t0;
          if (weatherCycle.enabled) weatherCycleSeconds += Math.min(dt, 0.25);
          volumeRotationAngle += dt * (lastVolumeShape === "gallery" ? 1 : 0.22);
          shapeOffsetWorld[0] += shapeVel[0] * dt;
          shapeOffsetWorld[1] += shapeVel[1] * dt;
          shapeOffsetWorld[2] += shapeVel[2] * dt;
          detailOffsetWorld[0] += detailVel[0] * dt;
          detailOffsetWorld[1] += detailVel[1] * dt;
          detailOffsetWorld[2] += detailVel[2] * dt;
          weatherOffsetWorld[0] += weatherVel[0] * dt;
          weatherOffsetWorld[1] += weatherVel[1] * dt;
          weatherOffsetWorld[2] += weatherVel[2] * dt;
          if (workerReproj && workerReproj.enabled) {
            workerReproj = normalizeReproj(workerReproj);
          }
          if (lastRunPayload) {
            lastRunPayload.tileTransforms = null;
            lastRunPayload.noiseTransforms = null;
            const qCoarse = previewRenderScaleDivider(lastRunPayload.preview);
            if (workerReproj) {
              lastRunPayload.reproj = Object.assign({}, workerReproj, { resetHistory: false });
              lastRunPayload.coarseFactor = Math.max(1, qCoarse | 0);
              lastRunPayload.reproj.coarseFactor = lastRunPayload.coarseFactor;
              lastRunPayload.reproj.scale = 1 / Math.max(1, lastRunPayload.coarseFactor * lastRunPayload.coarseFactor);
            } else {
              lastRunPayload.coarseFactor = Math.max(1, qCoarse | 0);
            }
            lastRunPayload.waitForGpu = false;
            lastRunPayload.logFrame = false;
          }
          await waitForLoopGpuBackpressure();
          timings = await runFrame(lastRunPayload);
          enqueueLoopGpuFence();
          submitFrameMs = performance.now() - t0 || timings.totalMs || 1;
          workerFrameMs = Math.max(
            1e-3,
            timings?.totalMs || 0,
            (timings?.computeMs || 0) + (timings?.renderMs || 0) + (timings?.submitMs || 0),
            submitFrameMs
          );
          frameOk = true;
          const maxWorkerFpsInst = 1e3 / workerFrameMs;
          emaMaxRoundTripFps = emaMaxRoundTripFps === null ? maxWorkerFpsInst : emaMaxRoundTripFps * 0.82 + maxWorkerFpsInst * 0.18;
          submitWindowFrames += 1;
          const nowForSubmit = performance.now();
          if (nowForSubmit - submitWindowStart >= 250) {
            const submitFpsInst = submitWindowFrames * 1e3 / Math.max(1, nowForSubmit - submitWindowStart);
            emaSubmitFps = emaSubmitFps === null ? submitFpsInst : emaSubmitFps * 0.85 + submitFpsInst * 0.15;
            submitWindowStart = nowForSubmit;
            submitWindowFrames = 0;
          }
        } catch (err) {
          postMessage({ type: "log", data: ["animation loop error", String(err)] });
        }
        const elapsed = performance.now() - t0;
        const delay = Math.max(0, LOOP_TARGET_MS - elapsed);
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        else await Promise.resolve();
        const presentedTime = performance.now();
        const cadenceMs = Math.max(1e-3, presentedTime - lastPresentedTime);
        lastPresentedTime = presentedTime;
        const loopFpsInst = 1e3 / cadenceMs;
        emaLoopFps = emaLoopFps === null ? loopFpsInst : emaLoopFps * 0.78 + loopFpsInst * 0.22;
        const nowForStats = performance.now();
        if (nowForStats - lastStatsPostTime >= 250) {
          lastStatsPostTime = nowForStats;
          postMessage({
            type: "frame",
            data: {
              fps: emaLoopFps,
              loopFps: emaLoopFps,
              maxRoundTripFps: emaMaxRoundTripFps,
              submitFps: emaSubmitFps,
              submitFrameMs,
              loopFrameMs: cadenceMs,
              workFrameMs: workerFrameMs,
              presentDivider: timings?.presentDivider,
              presentWidth: timings?.presentWidth,
              presentHeight: timings?.presentHeight,
              capFps: LOOP_TARGET_MS > 0 ? 1e3 / LOOP_TARGET_MS : 0,
              frameOk,
              gpuQueueDepth: loopGpuFences.length,
              resetReprojection: lastRunPayload?.reproj?.resetHistory
            }
          });
          if (weatherCycle.enabled && weatherCycleState && Math.floor(weatherCycleSeconds) !== weatherCycleLastPost) {
            weatherCycleLastPost = Math.floor(weatherCycleSeconds);
            postMessage({ type: "weather-cycle-state", data: { label: weatherCycleState.label, hour: weatherCycleState.hour, moon: weatherCycleState.moon, elapsed: weatherCycleSeconds, cachedMaps: weatherCycleGPU.groups.length, blendCount: weatherCycleBlendCount } });
          }
        }
      }
      loopRunning = false;
      log("animation loop stopped");
      postMessage({ type: "loop-stopped" });
      const waiters = loopStopWaiters;
      loopStopWaiters = [];
      for (const resolve of waiters) {
        try {
          resolve();
        } catch {
        }
      }
    })();
  }
  function stopLoop() {
    loopEnabled = false;
    loopGpuFences.length = 0;
  }
  function waitForLoopStopped() {
    if (!loopRunning) return Promise.resolve();
    return new Promise((resolve) => loopStopWaiters.push(resolve));
  }
  async function bakeCloudNoiseSet(payload = {}) {
    const quality = payload?.quality === "bootstrap" ? "bootstrap" : "full";
    const sizes = quality === "bootstrap" ? bootstrapBakeOptions() : {
      weather: { width: WEATHER_W, height: WEATHER_H, key: "weather2d", waitForGpu: true, debug: false },
      blue: { width: BN_W, height: BN_H, key: "blue2d", waitForGpu: true, debug: false },
      shape: { size: SHAPE_SIZE, id: "shape128", waitForGpu: true, debug: false },
      detail: { size: DETAIL_SIZE, id: "detail32", waitForGpu: true, debug: false }
    };
    const report = new CloudTimingReport(`cloud-noise-${quality}`, {
      quality,
      sizes: {
        weather: [sizes.weather.width, sizes.weather.height],
        blue: [sizes.blue.width, sizes.blue.height],
        shape: sizes.shape.size,
        detail: sizes.detail.size
      },
      timingNote: "Each bake reports CPU encoding/submission and a separate gpuWaitMs queue-completion boundary; frame dispatch reports its own pre/post-submit GPU waits."
    });
    const progressive = !!payload?.progressive;
    const prevDebugEnabled = debugPreviewEnabled;
    if (payload?.skipDebug === true || quality === "bootstrap") debugPreviewEnabled = false;
    emitTimingProgress(report, `${quality}:start`);
    try {
      await report.measure("ensure-device", () => ensureDevice(), void 0, "setup");
      const pipelineStage = report.start("noise-pipeline-warmup-wait", void 0, "pipeline");
      emitTimingProgress(report, `${quality}:pipeline-warmup`);
      const pipelineWarmup = await startNoisePipelineWarmup();
      report.end(pipelineStage, pipelineWarmup);
      const transformStage = report.start("apply-noise-transforms", void 0, "buffering");
      if (payload?.tileTransforms) applyNoiseTransforms(payload.tileTransforms, { allowPositions: !!payload.tileTransforms.explicit, allowScale: true, allowVel: true, additive: !!payload.tileTransforms.additive });
      if (payload?.noiseTransforms) applyNoiseTransforms(payload.noiseTransforms, { allowPositions: true, allowScale: true, allowVel: true, additive: !!payload.noiseTransforms.additive });
      pushTransformsToCloudBuilder();
      report.end(transformStage);
      await progressiveYield(progressive, quality === "bootstrap" ? "Baking quick weather map..." : "Baking full weather map...");
      let stage = report.start("weather-buffer-and-dispatch", { size: [sizes.weather.width, sizes.weather.height] }, "gpu-submit");
      emitTimingProgress(report, `${quality}:weather`);
      const weather = await bakeWeather2D(
        payload.weatherParams || {},
        true,
        payload.billowParams || {},
        payload.weatherBParams || payload.weatherB || null,
        sizes.weather
      );
      report.end(stage, weather);
      emitTimingProgress(report, `${quality}:weather-complete`);
      await progressiveYield(progressive, quality === "bootstrap" ? "Baking quick blue noise..." : "Baking full blue noise...");
      stage = report.start("blue-buffer-and-dispatch", { size: [sizes.blue.width, sizes.blue.height] }, "gpu-submit");
      emitTimingProgress(report, `${quality}:blue`);
      const blue = await bakeBlue2D(payload.blueParams || {}, true, sizes.blue);
      report.end(stage, blue);
      emitTimingProgress(report, `${quality}:blue-complete`);
      await progressiveYield(progressive, quality === "bootstrap" ? `Baking quick shape volume ${sizes.shape.size}\xB3...` : `Baking full shape volume ${sizes.shape.size}\xB3...`);
      stage = report.start("shape-buffer-and-dispatch", { size: sizes.shape.size }, "gpu-submit");
      emitTimingProgress(report, `${quality}:shape`);
      const shape = await bakeShape128(payload.shapeParams || {}, true, sizes.shape);
      report.end(stage, shape);
      emitTimingProgress(report, `${quality}:shape-complete`);
      await progressiveYield(progressive, quality === "bootstrap" ? `Baking quick detail volume ${sizes.detail.size}\xB3...` : `Baking full detail volume ${sizes.detail.size}\xB3...`);
      stage = report.start("detail-buffer-and-dispatch", { size: sizes.detail.size }, "gpu-submit");
      emitTimingProgress(report, `${quality}:detail`);
      const detail = await bakeDetail32(payload.detailParams || {}, true, sizes.detail);
      report.end(stage, detail);
      emitTimingProgress(report, `${quality}:detail-complete`);
      stage = report.start("bind-baked-textures", void 0, "buffering");
      syncBaseInputMaps();
      invalidateReprojectionHistory();
      report.end(stage);
      report.mark("resources-submitted", { quality });
      const timingReport = report.finish();
      emitTimingProgress(timingReport, `${quality}:complete`);
      return { weather, blue, shape, detail, totalMs: timingReport.totalMs, quality, timingReport };
    } catch (error) {
      report.mark("failed", { error: String(error?.message || error) });
      throw error;
    } finally {
      debugPreviewEnabled = prevDebugEnabled;
      if (debugPreviewEnabled && !payload?.skipFinalDebug && quality === "full") renderDebugIfEnabled();
    }
  }
  var _serial = Promise.resolve();
  self.onmessage = (ev) => {
    _serial = _serial.then(() => _handleMessage(ev)).catch((err) => {
      try {
        console.error(err);
      } catch {
      }
      try {
        postMessage({ type: "log", data: ["worker message error", String(err)] });
      } catch {
      }
    });
  };
  async function _handleMessage(ev) {
    const { id, type, payload } = ev.data || {};
    const respond = (ok, dataOrErr) => postMessage({ id, ok, ...ok ? { data: dataOrErr } : { error: String(dataOrErr) } });
    try {
      if (type === "init") {
        const initReport = new CloudTimingReport("cloud-worker-init");
        let initStage = initReport.start("receive-offscreen-canvases", void 0, "setup");
        const { canvases, constants } = payload;
        canvasMain = canvases.main;
        dbg.weather = canvases.dbg.weather;
        dbg.weatherG = canvases.dbg.weatherG;
        dbg.weatherB = canvases.dbg.weatherB || null;
        dbg.shapeR = canvases.dbg.shapeR;
        dbg.detailR = canvases.dbg.detailR;
        dbg.blue = canvases.dbg.blue;
        SHAPE_SIZE = constants.SHAPE_SIZE;
        DETAIL_SIZE = constants.DETAIL_SIZE;
        WEATHER_W = constants.WEATHER_W;
        WEATHER_H = constants.WEATHER_H;
        BN_W = constants.BN_W;
        BN_H = constants.BN_H;
        debugPreviewEnabled = constants.DEBUG_ENABLED !== false;
        mobileProfileEnabled = !!constants.MOBILE_PROFILE;
        initReport.end(initStage, {
          shapeSize: SHAPE_SIZE,
          detailSize: DETAIL_SIZE,
          weatherSize: [WEATHER_W, WEATHER_H],
          blueSize: [BN_W, BN_H]
        });
        await progressiveYield(true, "Starting WebGPU worker...");
        initStage = initReport.start("adapter-device-builders-and-pipeline-kickoff", void 0, "setup");
        await ensureDevice();
        initReport.end(initStage, {
          cloudPipelineWarmupState,
          noisePipelineWarmupState
        });
        await progressiveYield(mobileProfileEnabled, "Configuring canvas...");
        initStage = initReport.start("configure-main-canvas", void 0, "buffering");
        configureMainContext();
        renderBundleCache.clear();
        resetFrameStateCaches();
        initReport.end(initStage, { width: MAIN_W, height: MAIN_H });
        initReport.mark("worker-ready");
        respond(true, {
          ok: true,
          entryPoints: Array.isArray(nb?.entryPoints) ? nb.entryPoints.slice() : [],
          timingReport: initReport.finish()
        });
        return;
      }
      if (type === "resize") {
        const incoming = Object.assign({}, payload || {}, { serial: ++pendingResizeSerial });
        const incomingSig = resizePayloadSignature(incoming);
        const currentSig = resizePayloadSignature({
          main: { width: MAIN_W, height: MAIN_H },
          dbg: { width: DBG_W, height: DBG_H },
          profile: lastResizeProfile
        });
        if (incomingSig === currentSig && !pendingResizePayload) {
          respond(true, { ok: true, unchanged: true, serial: incoming.serial });
          return;
        }
        if (loopRunning) {
          pendingResizePayload = incoming;
          respond(true, { ok: true, queued: true, serial: incoming.serial });
          return;
        }
        const result = await applyResizePayloadNow(incoming);
        respond(true, result);
        return;
      }
      if (type === "clearMain") {
        const timingReport = await clearMainFrame(payload || {});
        respond(true, { ok: true, timingReport });
        return;
      }
      if (type === "bakeWeather") {
        await ensureDevice();
        const timings = await bakeWeather2D(
          payload.weatherParams || {},
          true,
          payload.billowParams || {},
          payload.weatherBParams || payload.weatherB || null
        );
        invalidateReprojectionHistory();
        respond(true, { baked: "weather", timings });
        return;
      }
      if (type === "bakeBlue") {
        await ensureDevice();
        const timings = await bakeBlue2D(payload.blueParams || {}, true);
        invalidateReprojectionHistory();
        respond(true, { baked: "blue", timings });
        return;
      }
      if (type === "bakeShape") {
        await ensureDevice();
        if (payload?.tileTransforms) applyNoiseTransforms(payload.tileTransforms, { allowPositions: !!payload.tileTransforms.explicit, allowScale: true, allowVel: true, additive: !!payload.tileTransforms.additive });
        if (payload?.noiseTransforms) applyNoiseTransforms(payload.noiseTransforms, { allowPositions: true, allowScale: true, allowVel: true, additive: !!payload.noiseTransforms.additive });
        pushTransformsToCloudBuilder();
        noise.shape128.dirty = true;
        const timings = await bakeShape128(payload.shapeParams || {}, true);
        invalidateReprojectionHistory();
        respond(true, { baked: "shape128", timings });
        return;
      }
      if (type === "bakeDetail") {
        await ensureDevice();
        if (payload?.tileTransforms) applyNoiseTransforms(payload.tileTransforms, { allowPositions: !!payload.tileTransforms.explicit, allowScale: true, allowVel: true, additive: !!payload.tileTransforms.additive });
        if (payload?.noiseTransforms) applyNoiseTransforms(payload.noiseTransforms, { allowPositions: true, allowScale: true, allowVel: true, additive: !!payload.noiseTransforms.additive });
        pushTransformsToCloudBuilder();
        noise.detail32.dirty = true;
        const timings = await bakeDetail32(payload.detailParams || {}, true);
        invalidateReprojectionHistory();
        respond(true, { baked: "detail32", timings });
        return;
      }
      if (type === "bakeAll") {
        const timings = await bakeCloudNoiseSet(payload || {});
        await progressiveYield(!!payload?.progressive, payload?.quality === "bootstrap" ? "Rendering quick first frame..." : "Preparing first cloud frame...");
        respond(true, { baked: "all", timings });
        return;
      }
      if (type === "setTileTransforms" || type === "setNoiseTransforms") {
        await ensureDevice();
        try {
          const tObj = type === "setNoiseTransforms" ? payload?.noiseTransforms || payload?.tileTransforms || payload || {} : payload?.tileTransforms || payload?.noiseTransforms || payload || {};
          applyNoiseTransforms(tObj, {
            allowPositions: true,
            allowScale: true,
            allowVel: true,
            additive: !!tObj.additive
          });
          pushTransformsToCloudBuilder();
          try {
            if (lastRunPayload && !loopRunning) {
              const merged = Object.assign({}, lastRunPayload.tileTransforms || {});
              Object.assign(merged, snapshotTransforms(), { explicit: true });
              lastRunPayload.tileTransforms = merged;
            }
          } catch {
          }
          respond(true, { ok: true, transforms: snapshotTransforms() });
        } catch (err) {
          console.warn("setTileTransforms/setNoiseTransforms failed", err);
          respond(false, err);
        }
        return;
      }
      if (type === "setSlice") {
        currentShapeSlice = Math.max(0, Math.min(SHAPE_SIZE - 1, payload.slice | 0));
        currentDetailSlice = Math.max(0, Math.min(DETAIL_SIZE - 1, Math.floor(currentShapeSlice * DETAIL_SIZE / Math.max(1, SHAPE_SIZE))));
        renderDebugSlices();
        respond(true, { shapeSlice: currentShapeSlice, detailSlice: currentDetailSlice });
        return;
      }
      if (type === "setDebugSlice") {
        const target = String(payload?.target || "shape");
        const slice = Math.max(0, payload?.slice | 0);
        if (target === "detail") {
          currentDetailSlice = Math.min(DETAIL_SIZE - 1, slice);
        } else {
          currentShapeSlice = Math.min(SHAPE_SIZE - 1, slice);
        }
        renderDebugSlices();
        respond(true, { shapeSlice: currentShapeSlice, detailSlice: currentDetailSlice });
        return;
      }
      if (type === "refreshDebug") {
        renderDebugIfEnabled(payload?.kind || "all");
        respond(true, { ok: true, kind: payload?.kind || "all" });
        return;
      }
      if (type === "setReproj") {
        workerReproj = normalizeReproj(payload.reproj || null);
        workerPerf = payload.perf || workerPerf;
        if (workerReproj && workerReproj.temporalBlend > 1e-4 && payload?.reproj?.resetHistory) {
          workerReproj.frameIndex = 0;
          workerReproj.sampleOffset = 0;
          workerReproj.temporalCellPhase = 0;
          invalidateReprojectionHistory();
        }
        if (lastRunPayload) {
          lastRunPayload.reproj = workerReproj ? Object.assign({}, workerReproj, { resetHistory: false }) : workerReproj;
          const qCoarse = previewRenderScaleDivider(lastRunPayload.preview);
          if (workerReproj) {
            lastRunPayload.coarseFactor = Math.max(1, qCoarse | 0);
            lastRunPayload.reproj.coarseFactor = lastRunPayload.coarseFactor;
            lastRunPayload.reproj.scale = 1 / Math.max(1, lastRunPayload.coarseFactor * lastRunPayload.coarseFactor);
          } else {
            lastRunPayload.coarseFactor = Math.max(1, qCoarse | 0);
          }
        }
        if (cb) {
          if (workerPerf) cb.setPerfParams(workerPerf);
          if (workerReproj) {
            const qCoarse = previewRenderScaleDivider(lastRunPayload?.preview);
            const cf = Math.max(1, qCoarse | 0);
            workerReproj.coarseFactor = cf;
            workerReproj.scale = 1 / Math.max(1, cf * cf);
            cb.setReprojSettings(getDispatchReprojSettings(workerReproj, cf));
          }
        }
        renderBundleCache.clear();
        if (!workerReproj || !workerReproj.enabled && normalizeTemporalCellRate(workerReproj.temporalCellRate) <= 1) stopLoop();
        respond(true, { ok: true, reproj: workerReproj, perf: workerPerf });
        return;
      }
      if (type === "setWeatherCycle") {
        await ensureDevice();
        respond(true, await configureWeatherCycle(payload));
        return;
      }
      if (type === "setLiveFrameState") {
        await ensureDevice();
        try {
          const incomingPreview = payload?.preview || null;
          const incomingCloudParams = payload?.cloudParams || null;
          const incomingTuning = payload?.tuning || null;
          const incomingTransforms = payload?.tileTransforms || payload?.noiseTransforms || null;
          const incomingReproj = payload?.reproj || null;
          if (!lastRunPayload) {
            lastRunPayload = {
              preview: incomingPreview || {},
              cloudParams: incomingCloudParams || {},
              tileTransforms: incomingTransforms || null,
              reproj: incomingReproj || workerReproj || null,
              coarseFactor: previewRenderScaleDivider(incomingPreview || {})
            };
          }
          if (incomingPreview && typeof incomingPreview === "object") {
            lastRunPayload.preview = Object.assign({}, lastRunPayload.preview || {}, incomingPreview);
          }
          if (incomingCloudParams && typeof incomingCloudParams === "object") {
            lastRunPayload.cloudParams = incomingCloudParams;
          }
          if (incomingTuning && typeof incomingTuning === "object") {
            mergeTuningPatch(incomingTuning);
            lastRunPayload.tuning = Object.assign({}, lastRunPayload.tuning || {}, incomingTuning);
            try {
              applyWorkerTuning(previewCloudBox(lastRunPayload.preview || {}));
            } catch (e) {
              console.warn("setLiveFrameState tuning apply failed", e);
            }
          }
          if (incomingTransforms && typeof incomingTransforms === "object") {
            applyNoiseTransforms(incomingTransforms, {
              allowPositions: true,
              allowScale: true,
              allowVel: true,
              additive: !!incomingTransforms.additive
            });
            pushTransformsToCloudBuilder();
            if (!loopRunning) {
              const merged = Object.assign({}, lastRunPayload.tileTransforms || {});
              Object.assign(merged, snapshotTransforms(), { explicit: true });
              lastRunPayload.tileTransforms = merged;
            }
          }
          if (incomingReproj && typeof incomingReproj === "object") {
            const nextReproj = normalizeReproj(incomingReproj);
            if (workerReproj && nextReproj && !incomingReproj.resetHistory) {
              nextReproj.frameIndex = workerReproj.frameIndex >>> 0;
              nextReproj.sampleOffset = workerReproj.sampleOffset >>> 0;
              nextReproj.temporalCellPhase = workerReproj.temporalCellPhase >>> 0;
            }
            workerReproj = nextReproj;
          }
          const previewForCoarse = lastRunPayload.preview || incomingPreview || {};
          const qCoarse = previewRenderScaleDivider(previewForCoarse);
          lastRunPayload.coarseFactor = Math.max(1, qCoarse);
          if (workerReproj) {
            workerReproj.coarseFactor = lastRunPayload.coarseFactor;
            workerReproj.scale = 1 / Math.max(1, workerReproj.coarseFactor * workerReproj.coarseFactor);
            lastRunPayload.reproj = Object.assign({}, workerReproj, { resetHistory: false });
          }
          lastRunPayload.waitForGpu = false;
          lastRunPayload.logFrame = false;
          respond(true, {
            ok: true,
            seq: payload?.seq || 0,
            coarseFactor: lastRunPayload.coarseFactor,
            temporalCellRate: normalizeTemporalCellRate(workerReproj?.temporalCellRate)
          });
        } catch (err) {
          console.warn("setLiveFrameState failed", err);
          respond(false, err);
        }
        return;
      }
      if (type === "setTuning") {
        const incoming = payload?.tuning || {};
        mergeTuningPatch(incoming);
        try {
          applyWorkerTuning();
        } catch (e) {
          console.warn("setTuning apply failed", e);
        }
        respond(true, { ok: true, tuning: workerTuning, version: workerTuningVersion, autoThick: autoThickBoxTuning(previewCloudBox(lastRunPayload?.preview || {})) });
        return;
      }
      if (type === "startLoop") {
        loopEnabled = true;
        startLoop();
        respond(true, { ok: true });
        return;
      }
      if (type === "stopLoop") {
        stopLoop();
        await waitForLoopStopped();
        respond(true, { ok: true });
        return;
      }
      if (type === "runFrame") {
        if (payload?.tuning) mergeTuningPatch(payload.tuning);
        const timings = await runFrame(payload);
        respond(true, { timings });
        return;
      }
      respond(false, new Error("Unknown worker message: " + type));
    } catch (err) {
      console.error(err);
      respond(false, err);
    }
  }
  var cloudTest_worker_default = self;
;if(typeof import_meta !== 'undefined')import_meta.url=location.origin+"/dist/";})();
