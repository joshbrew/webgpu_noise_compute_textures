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
  _pad1 : f32,
  _pad2 : f32,
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
  edgeK:     f32
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

fn fetchPos(fx: i32, fy: i32, fz: i32) -> vec3<f32> {
  if (options.useCustomPos == 1u) {
    let use3D = writeTo3D() || readFrom3D();
    let slice_i = select(frame.layerIndex, clampZ(fz), use3D);
    let slice = u32(max(slice_i, 0));
    let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);
    let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);
    let idx = slice * frame.fullWidth * frame.fullHeight + u32(cy) * frame.fullWidth + u32(cx);
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
  let needsAccum = (overwrite == 0u);
  let writesAll = (channel == 0u);
  let skipRead = (!needsAccum) && (writesAll || channel == 5u);
  var inCol = vec4<f32>(0.0);
  if (!skipRead) { inCol = loadPrevRGBA(fx, fy, fz); }
  var outCol = inCol;

  if (channel == 0u)      { let h = select(v0 + inCol.x, v0, overwrite == 1u); outCol = vec4<f32>(h, h, h, h); }
  else if (channel == 1u) { let h = select(v0 + inCol.x, v0, overwrite == 1u); outCol.x = h; }
  else if (channel == 2u) { let h = select(v0 + inCol.y, v0, overwrite == 1u); outCol.y = h; }
  else if (channel == 3u) { let h = select(v0 + inCol.z, v0, overwrite == 1u); outCol.z = h; }
  else if (channel == 4u) { let h = select(v0 + inCol.w, v0, overwrite == 1u); outCol.w = h; }
  else if (channel == 5u) { let p = fetchPos(fx, fy, fz); let h = select(v0 + inCol.w, v0, overwrite == 1u); outCol = vec4<f32>(p.x, p.y, p.z, h); }
  else if (channel == 6u) { let p = fetchPos(fx, fy, fz); let h = select(v0 + inCol.w, v0, overwrite == 1u); outCol = vec4<f32>(p.x, p.y, h, inCol.w); }

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
struct Voro3DMetrics { f1Sq: f32, f2Sq: f32, cellVal: f32 };
struct Voro4DMetrics { f1Sq: f32, f2Sq: f32, cellVal: f32 };

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


// Sphere normals with shared tile and wrapped longitude
@compute @workgroup_size(WGX, WGY, 1)
fn computeSphereNormal(@builtin(global_invocation_id) gid: vec3<u32>,
                       @builtin(local_invocation_id)  lid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let fz = i32(frame.originZ) + i32(gid.z);
    let w  = i32(frame.fullWidth);
    let h  = i32(frame.fullHeight);

    // wrap longitude, clamp latitude
    let wrapX  = ((fx % w) + w) % w;
    let clampY = clamp(fy, 0, h - 1);

    let tx = i32(lid.x) + 1;
    let ty = i32(lid.y) + 1;

    // center
    sphereTile[u32(ty)][u32(tx)] =
        textureLoad(inputTex, vec2<i32>(wrapX, clampY), frame.layerIndex, 0).x;

    // halo
    if (lid.x == 0u) {
        let lx = ((wrapX - 1) % w + w) % w;
        sphereTile[u32(ty)][0u] =
            textureLoad(inputTex, vec2<i32>(lx, clampY), frame.layerIndex, 0).x;
    }
    if (lid.x == WGX - 1u) {
        let rx = ((wrapX + 1) % w + w) % w;
        sphereTile[u32(ty)][TILE_W - 1u] =
            textureLoad(inputTex, vec2<i32>(rx, clampY), frame.layerIndex, 0).x;
    }
    if (lid.y == 0u) {
        let dy = clamp(clampY - 1, 0, h - 1);
        sphereTile[0u][u32(tx)] =
            textureLoad(inputTex, vec2<i32>(wrapX, dy), frame.layerIndex, 0).x;
    }
    if (lid.y == WGY - 1u) {
        let uy = clamp(clampY + 1, 0, h - 1);
        sphereTile[TILE_H - 1u][u32(tx)] =
            textureLoad(inputTex, vec2<i32>(wrapX, uy), frame.layerIndex, 0).x;
    }
    // corners
    if (lid.x == 0u && lid.y == 0u) {
        let lx = ((wrapX - 1) % w + w) % w;
        let dy = clamp(clampY - 1, 0, h - 1);
        sphereTile[0u][0u] =
            textureLoad(inputTex, vec2<i32>(lx, dy), frame.layerIndex, 0).x;
    }
    if (lid.x == WGX - 1u && lid.y == 0u) {
        let rx = ((wrapX + 1) % w + w) % w;
        let dy = clamp(clampY - 1, 0, h - 1);
        sphereTile[0u][TILE_W - 1u] =
            textureLoad(inputTex, vec2<i32>(rx, dy), frame.layerIndex, 0).x;
    }
    if (lid.x == 0u && lid.y == WGY - 1u) {
        let lx = ((wrapX - 1) % w + w) % w;
        let uy = clamp(clampY + 1, 0, h - 1);
        sphereTile[TILE_H - 1u][0u] =
            textureLoad(inputTex, vec2<i32>(lx, uy), frame.layerIndex, 0).x;
    }
    if (lid.x == WGX - 1u && lid.y == WGY - 1u) {
        let rx = ((wrapX + 1) % w + w) % w;
        let uy = clamp(clampY + 1, 0, h - 1);
        sphereTile[TILE_H - 1u][TILE_W - 1u] =
            textureLoad(inputTex, vec2<i32>(rx, uy), frame.layerIndex, 0).x;
    }

    workgroupBarrier();

    // fetch
    let baseH = sphereTile[u32(ty)][u32(tx)];
    let hL    = sphereTile[u32(ty)][u32(tx - 1)];
    let hR    = sphereTile[u32(ty)][u32(tx + 1)];
    let hD    = sphereTile[u32(ty - 1)][u32(tx)];
    let hU    = sphereTile[u32(ty + 1)][u32(tx)];

    // radii
    let r0 = options.baseRadius + baseH * options.heightScale;
    let rL = options.baseRadius + hL    * options.heightScale;
    let rR = options.baseRadius + hR    * options.heightScale;
    let rD = options.baseRadius + hD    * options.heightScale;
    let rU = options.baseRadius + hU    * options.heightScale;

    // spherical angles and increments
    let theta  = f32(clampY) / f32(h - 1) * PI;
    let phi    = f32(wrapX)  / f32(w - 1) * 2.0 * PI;
    let dTheta = PI / f32(h - 1);
    let dPhi   = 2.0 * PI / f32(w - 1);

    // precompute sines and cosines
    let sTh  = sin(theta);
    let cTh  = cos(theta);
    let sPh  = sin(phi);
    let cPh  = cos(phi);
    let sThU = sin(theta + dTheta);
    let cThU = cos(theta + dTheta);
    let sPhE = sin(phi + dPhi);
    let cPhE = cos(phi + dPhi);

    // positions on the sphere
    let p0 = vec3<f32>(r0 * sTh * cPh,
                       r0 * sTh * sPh,
                       r0 * cTh);

    let pE = vec3<f32>(rR * sTh * cPhE,
                       rR * sTh * sPhE,
                       rR * cTh);

    let pN = vec3<f32>(rU * sThU * cPh,
                       rU * sThU * sPh,
                       rU * cThU);

    // normal
    let tE = pE - p0;
    let tN = pN - p0;
    let n  = normalize(cross(tE, tN));
    let enc = n * 0.5 + vec3<f32>(0.5);

    // pack and store
    let outCol = vec4<f32>(baseH, enc.x, enc.y, enc.z);
    textureStore(outputTex, vec2<i32>(wrapX, clampY), frame.layerIndex, outCol);
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
        size: 22 * 4,
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
      this.queue.writeBuffer(this.paramsBuffer, 0, new ArrayBuffer(22 * 4));
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
        ioFlags = 0
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
      dv.setFloat32(24, 0, true);
      dv.setFloat32(28, 0, true);
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
      const buf = new ArrayBuffer(22 * 4);
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
        edgeK
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
      const devMax = this.device?.limits?.maxBufferSize ?? 2147483648;
      const safeMax = Math.floor(devMax * 0.98);
      if (customData.byteLength > safeMax) {
        throw new Error(
          `_buildPosBuffer: ${customData.byteLength} bytes exceeds maxBufferSize ${devMax} (w=${w}, h=${h})`
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
      const wantsCustomPos = ((options.useCustomPos ?? 0) | 0) !== 0;
      const customData = wantsCustomPos && options.customData instanceof Float32Array ? options.customData : null;
      const hasCustomData = !!customData;
      const hadCustomBefore = Array.isArray(pair.tiles) && pair.tiles.some((t) => t && t.posIsCustom);
      if (!hasCustomData && hadCustomBefore) {
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
          } else if (existingTile && existingTile.posBuf && !existingTile.posIsCustom) {
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
      const wantsCustomPos = ((origOpts.useCustomPos ?? 0) | 0) !== 0;
      const customData = wantsCustomPos && origOpts.customData instanceof Float32Array ? origOpts.customData : null;
      const useCustomPos = customData ? 1 : 0;
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

  // tools/clouds/clouds.wgsl
  var clouds_default = 'const PI: f32 = 3.141592653589793;\nconst EPS: f32 = 1e-6;\nconst LN2: f32 = 0.6931471805599453;\nconst INV_LN2: f32 = 1.4426950408889634;\nconst VIEW_EXTINCTION_SCALE: f32 = 0.075;\nconst SUN_EXTINCTION_SCALE: f32 = 0.014;\nconst DENSITY_LIGHT_SCALE: f32 = 0.01;\n\n// ---------------------- TUNING UNIFORM\nstruct CloudTuning {\n  maxSteps: i32,\n  sunSteps: i32,\n  sunStride: i32,\n  _pad0_i: i32,\n\n  minStep: f32,\n  maxStep: f32,\n  sunMinTr: f32,\n  phaseJitter: f32,\n\n  stepJitter: f32,\n  baseJitterFrac: f32,\n  topJitterFrac: f32,\n  lodBiasWeather: f32,\n\n  aabbFaceOffset: f32,\n  weatherRejectGate: f32,\n  weatherRejectMip: f32,\n  emptySkipMult: f32,\n\n  nearFluffDist: f32,\n  nearStepScale: f32,\n  nearLodBias: f32,\n  nearDensityMult: f32,\n\n  nearDensityRange: f32,\n  lodBlendThreshold: f32,\n  sunDensityGate: f32,\n  fflyRelClamp: f32,\n\n  fflyAbsFloor: f32,\n  taaRelMin: f32,\n  taaRelMax: f32,\n  taaAbsEps: f32,\n\n  farStart: f32,\n  farFull: f32,\n  farLodPush: f32,\n  farDetailAtten: f32,\n\n  farStepMult: f32,\n  bnFarScale: f32,\n  farTaaHistoryBoost: f32,\n  raySmoothDens: f32,\n\n  raySmoothSun: f32,\n  _pad1: f32,\n  _pad2: f32,\n  _pad3: f32\n};\n@group(0) @binding(10) var<uniform> TUNE: CloudTuning;\n\n// ---------------------- existing uniforms / resources (preserved layout)\nstruct CloudOptions {\n  useCustomPos: u32,\n  outputChannel: u32,\n  writeRGB: u32,\n  _p0: u32,\n  _r0: f32,\n  _r1: f32,\n  _r2: f32,\n  _r3: f32\n};\n@group(0) @binding(0) var<uniform> opt: CloudOptions;\n\nstruct CloudParams {\n  globalCoverage: f32,\n  globalDensity: f32,\n  cloudAnvilAmount: f32,\n  cloudBeer: f32,\n  attenuationClamp: f32,\n  inScatterG: f32,\n  silverIntensity: f32,\n  silverExponent: f32,\n  outScatterG: f32,\n  inVsOut: f32,\n  outScatterAmbientAmt: f32,\n  ambientMinimum: f32,\n  sunColor: vec3<f32>,\n  _sunColorPad: f32,\n\n  densityDivMin: f32,\n  silverDirectionBias: f32,\n  silverHorizonBoost: f32,\n  _pad0: f32\n};\n@group(0) @binding(1) var<uniform> C: CloudParams;\n\nstruct Dummy { _pad: u32 };\n@group(0) @binding(2) var<storage, read> unused: Dummy;\n\n// ---------------------- NoiseTransforms (binding 3)\nstruct NoiseTransforms {\n  shapeOffsetWorld: vec3<f32>,\n  _pad0: f32,\n\n  detailOffsetWorld: vec3<f32>,\n  _pad1: f32,\n\n  shapeScale: f32,\n  detailScale: f32,\n  weatherScale: f32,\n  _pad2: f32,\n\n  shapeAxisScale: vec3<f32>,\n  _pad3: f32,\n\n  detailAxisScale: vec3<f32>,\n  _pad4: f32,\n\n  weatherOffsetWorld: vec3<f32>,\n  _pad5: f32,\n\n  weatherAxisScale: vec3<f32>,\n  _pad6: f32\n};\n@group(0) @binding(3) var<uniform> NTransform: NoiseTransforms;\n\n@group(0) @binding(4) var outTex: texture_storage_2d_array<rgba16float, write>;\n@group(0) @binding(5) var<storage, read> posBuf: array<vec4<f32>>;\n\nstruct Frame {\n  fullWidth: u32, fullHeight: u32,\n  tileWidth: u32, tileHeight: u32,\n  originX: i32, originY: i32, originZ: i32,\n  fullDepth: u32, tileDepth: u32,\n  layerIndex: i32, layers: u32,\n  _pad0: u32,\n  originXf: f32, originYf: f32, _pad1: f32, _pad2: f32\n};\n@group(0) @binding(6) var<uniform> frame: Frame;\n\n@group(0) @binding(7) var historyOut: texture_storage_2d_array<rgba16float, write>;\n\nstruct ReprojSettings {\n  enabled: u32,\n  subsample: u32,\n  sampleOffset: u32,\n  motionIsNormalized: u32,\n  temporalBlend: f32,\n  depthTest: u32,\n  depthTolerance: f32,\n  frameIndex: u32,\n  fullWidth: u32,\n  fullHeight: u32\n};\n@group(0) @binding(8) var<uniform> reproj: ReprojSettings;\n\nstruct PerfParams {\n  lodBiasMul: f32,\n  coarseMipBias: f32,\n  _pad0: f32,\n  _pad1: f32\n};\n@group(0) @binding(9) var<uniform> perf: PerfParams;\n\n// ---------------------- textures/samplers (preserved layout)\n@group(1) @binding(0) var weather2D: texture_2d_array<f32>;\n@group(1) @binding(1) var samp2D: sampler;\n\n@group(1) @binding(2) var shape3D: texture_3d<f32>;\n@group(1) @binding(3) var sampShape: sampler;\n\n@group(1) @binding(4) var blueTex: texture_2d_array<f32>;\n@group(1) @binding(5) var sampBN: sampler;\n\n@group(1) @binding(6) var detail3D: texture_3d<f32>;\n@group(1) @binding(7) var sampDetail: sampler;\n\nstruct LightInputs { sunDir: vec3<f32>, _0: f32, camPos: vec3<f32>, _1: f32 };\n@group(1) @binding(8) var<uniform> L: LightInputs;\n\nstruct View {\n  camPos: vec3<f32>, _v0: f32,\n  right: vec3<f32>, _v1: f32,\n  up: vec3<f32>, _v2: f32,\n  fwd: vec3<f32>, _v3: f32,\n  fovY: f32, aspect: f32, stepBase: f32, stepInc: f32,\n  planetRadius: f32, cloudBottom: f32, cloudTop: f32, volumeLayers: f32,\n  worldToUV: f32, _a: f32, _b: f32, _c: f32\n};\n@group(1) @binding(9) var<uniform> V: View;\n\nstruct Box {\n  center: vec3<f32>, _b0: f32,\n  half: vec3<f32>, uvScale: f32\n};\n@group(1) @binding(10) var<uniform> B: Box;\n\n@group(1) @binding(11) var historyPrev: texture_2d_array<f32>;\n@group(1) @binding(12) var sampHistory: sampler;\n\n@group(1) @binding(13) var motionTex: texture_2d<f32>;\n@group(1) @binding(14) var sampMotion: sampler;\n\n@group(1) @binding(15) var depthPrev: texture_2d<f32>;\n@group(1) @binding(16) var sampDepth: sampler;\n\n// ---------------------- Workgroup cache\nvar<workgroup> wg_weatherDim: vec2<f32>;\nvar<workgroup> wg_blueDim: vec2<f32>;\nvar<workgroup> wg_shapeDim: vec3<f32>;\nvar<workgroup> wg_detailDim: vec3<f32>;\nvar<workgroup> wg_maxMipW: f32;\nvar<workgroup> wg_maxMipS: f32;\nvar<workgroup> wg_maxMipD: f32;\nvar<workgroup> wg_scaleS: f32;\nvar<workgroup> wg_scaleD: f32;\nvar<workgroup> wg_scaleS_effMax: f32;\nvar<workgroup> wg_scaleD_effMax: f32;\nvar<workgroup> wg_finestWorld: f32;\n\n// ---------------------- helpers\nfn saturate(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }\nfn mix_f(a: f32, b: f32, t: f32) -> f32 { return a * (1.0 - t) + b * t; }\nfn mix_v3(a: vec3<f32>, b: vec3<f32>, t: f32) -> vec3<f32> { return a * (1.0 - t) + b * t; }\nfn mix_v4(a: vec4<f32>, b: vec4<f32>, t: f32) -> vec4<f32> { return a * (1.0 - t) + b * t; }\nfn remap(v: f32, a: f32, b: f32, c: f32, d: f32) -> f32 { return c + (v - a) * (d - c) / max(b - a, EPS); }\nfn luminance(c: vec3<f32>) -> f32 { return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722)); }\n\nfn clamp_luma_to(val: vec3<f32>, refc: vec3<f32>, rel: f32, abs_eps: f32) -> vec3<f32> {\n  let tL = luminance(refc);\n  let vL = max(luminance(val), 1e-6);\n  let hi = tL * (1.0 + rel) + abs_eps;\n  let lo = max(tL * (1.0 - rel) - abs_eps, 0.0);\n  if (vL > hi) { return val * (hi / vL); }\n  if (vL < lo) { return val * (max(lo, 1e-6) / vL); }\n  return val;\n}\n\nfn axisOrOne3(v: vec3<f32>) -> vec3<f32> {\n  return select(v, vec3<f32>(1.0), abs(v) < vec3<f32>(EPS));\n}\n\nfn axisMaxAbs3(v: vec3<f32>) -> f32 {\n  let a = abs(v);\n  return max(a.x, max(a.y, a.z));\n}\n\n// tiny hash\nfn hash13_i(p: vec3<i32>) -> f32 {\n  var h: u32 = 374761393u * u32(p.x) + 668265263u * u32(p.y) + 362437u * u32(p.z);\n  h = (h ^ (h >> 13u)) * 1274126177u;\n  h = h ^ (h >> 16u);\n  return f32(h) * 2.3283064365386963e-10;\n}\n\nfn smoothCellHash2D(p: vec2<f32>, freq: f32) -> f32 {\n  let uv = p * freq;\n  let i = floor(uv);\n  let f = fract(uv);\n  let h00 = hash13_i(vec3<i32>(i32(i.x), i32(i.y), 0));\n  let h10 = hash13_i(vec3<i32>(i32(i.x) + 1, i32(i.y), 0));\n  let h01 = hash13_i(vec3<i32>(i32(i.x), i32(i.y) + 1, 0));\n  let h11 = hash13_i(vec3<i32>(i32(i.x) + 1, i32(i.y) + 1, 0));\n  let u = f * f * (3.0 - 2.0 * f);\n  return mix_f(mix_f(h00, h10, u.x), mix_f(h01, h11, u.x), u.y);\n}\n\n// texture wrappers\nfn wrap2D(tex: texture_2d_array<f32>, samp: sampler, uv: vec2<f32>, layer_idx: i32, lod: f32) -> vec4<f32> {\n  let d = wg_weatherDim;\n  let ep = vec2<f32>(0.5 / max(d.x, 1.0), 0.5 / max(d.y, 1.0));\n  let u = uv * (vec2<f32>(1.0) - 2.0 * ep) + ep;\n  return textureSampleLevel(tex, samp, u, layer_idx, lod);\n}\n\nfn wrap3D_shape(tex: texture_3d<f32>, samp: sampler, uvw: vec3<f32>, lod: f32) -> vec4<f32> {\n  let d = wg_shapeDim;\n  let ep = vec3<f32>(0.5 / max(d.x, 1.0), 0.5 / max(d.y, 1.0), 0.5 / max(d.z, 1.0));\n  let u = uvw * (vec3<f32>(1.0) - 2.0 * ep) + ep;\n  return textureSampleLevel(tex, samp, u, lod);\n}\n\nfn wrap3D_detail(tex: texture_3d<f32>, samp: sampler, uvw: vec3<f32>, lod: f32) -> vec4<f32> {\n  let d = wg_detailDim;\n  let ep = vec3<f32>(0.5 / max(d.x, 1.0), 0.5 / max(d.y, 1.0), 0.5 / max(d.z, 1.0));\n  let u = uvw * (vec3<f32>(1.0) - 2.0 * ep) + ep;\n  return textureSampleLevel(tex, samp, u, lod);\n}\n\n// blue noise\nfn frameBlueOffset() -> vec2<i32> {\n  let bnW = max(i32(wg_blueDim.x), 1);\n  let bnH = max(i32(wg_blueDim.y), 1);\n  let fi = i32(reproj.frameIndex);\n  let so = i32(reproj.sampleOffset);\n  let ox = (fi * 73 + fi * fi * 19 + so * 31) % bnW;\n  let oy = (fi * 151 + fi * fi * 27 + so * 17) % bnH;\n  return vec2<i32>(ox, oy);\n}\n\nfn sampleBlueScreen(pixI: vec2<i32>) -> f32 {\n  let bnW = max(i32(wg_blueDim.x), 1);\n  let bnH = max(i32(wg_blueDim.y), 1);\n  let baseOff = frameBlueOffset();\n  let p0 = vec2<i32>((pixI.x + baseOff.x) % bnW, (pixI.y + baseOff.y) % bnH);\n  let p1 = vec2<i32>((pixI.x + baseOff.x * 3 + 17) % bnW, (pixI.y + baseOff.y * 5 + 29) % bnH);\n  let uv0 = (vec2<f32>(p0) + 0.5) / wg_blueDim;\n  let uv1 = (vec2<f32>(p1) + 0.5) / wg_blueDim;\n  let a = textureSampleLevel(blueTex, sampBN, uv0, 0i, 0.0).r;\n  let b = textureSampleLevel(blueTex, sampBN, uv1, 0i, 0.0).r;\n  let mixT = fract(0.61803398875 * f32(reproj.frameIndex) + 0.41421356237 * f32(reproj.sampleOffset));\n  return mix_f(a, b, mixT);\n}\n\n// box helpers\nfn boxMin() -> vec3<f32> { return B.center - B.half; }\nfn boxMax() -> vec3<f32> { return B.center + B.half; }\n\n// robust AABB intersect\nfn intersectAABB_robust(ro: vec3<f32>, rd: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>) -> vec2<f32> {\n  let parallel = abs(rd) <= vec3<f32>(EPS);\n\n  if (\n    (parallel.x && (ro.x < bmin.x || ro.x > bmax.x)) ||\n    (parallel.y && (ro.y < bmin.y || ro.y > bmax.y)) ||\n    (parallel.z && (ro.z < bmin.z || ro.z > bmax.z))\n  ) {\n    return vec2<f32>(1.0, -1.0);\n  }\n\n  let epsSigned = select(vec3<f32>(-EPS), vec3<f32>(EPS), rd >= vec3<f32>(0.0));\n  let rdSafe = select(epsSigned, rd, abs(rd) > vec3<f32>(EPS));\n  let inv = vec3<f32>(1.0) / rdSafe;\n  let t0 = (bmin - ro) * inv;\n  let t1 = (bmax - ro) * inv;\n  let tmin3 = min(t0, t1);\n  let tmax3 = max(t0, t1);\n  let tmin = max(max(tmin3.x, tmin3.y), tmin3.z);\n  let tmax = min(min(tmax3.x, tmax3.y), tmax3.z);\n  return vec2<f32>(tmin, tmax);\n}\n\n// world warp in XZ\nfn worldWarpXZ(pos_xz: vec2<f32>, ph: f32, boxMaxXZ: f32) -> vec2<f32> {\n  let normv = max(boxMaxXZ, 1.0);\n  let p = pos_xz / normv;\n\n  let warpAmp = TUNE.baseJitterFrac * boxMaxXZ * 0.5;\n\n  let s1x = smoothCellHash2D(p + vec2<f32>(12.34, 78.9), 4.0);\n  let s1y = smoothCellHash2D(p + vec2<f32>(98.7, 6.54), 4.0);\n  let s2x = smoothCellHash2D(p * 1.73 + vec2<f32>(3.21, 4.56), 8.28);\n  let s2y = smoothCellHash2D(p * 1.91 + vec2<f32>(7.89, 1.23), 8.28);\n\n  let ox = (s1x - 0.5) + 0.5 * (s2x - 0.5);\n  let oz = (s1y - 0.5) + 0.5 * (s2y - 0.5);\n\n  let ang = smoothCellHash2D(p * 3.0 + vec2<f32>(9.7, 2.3), 16.0) * 2.0 * PI;\n  let rad = (smoothCellHash2D(p * 3.0 + vec2<f32>(1.1, 7.7), 16.0) - 0.5) * (TUNE.baseJitterFrac * 0.4 * boxMaxXZ);\n  let rot = vec2<f32>(cos(ang), sin(ang)) * rad;\n\n  let user = vec2<f32>(cos(opt._r3), sin(opt._r3)) * opt._r2 * 0.001;\n\n  return vec2<f32>(ox, oz) * warpAmp + rot * mix_f(0.3, 1.2, ph) + user;\n}\n\n// shape & detail samplers\nfn shapeUVW_fromWarp(pos: vec3<f32>, ph: f32, w: vec2<f32>) -> vec3<f32> {\n  let scaleS = max(wg_scaleS, EPS);\n  let pW = vec3<f32>(\n    pos.x + w.x + NTransform.shapeOffsetWorld.x,\n    pos.y + ph * 7.0 + NTransform.shapeOffsetWorld.y,\n    pos.z + w.y + NTransform.shapeOffsetWorld.z\n  );\n\n  let axis = axisOrOne3(NTransform.shapeAxisScale);\n  let sMul = select(NTransform.shapeScale, 1.0, NTransform.shapeScale == 0.0);\n  return (pW * axis) * (scaleS * max(sMul, EPS));\n}\n\nfn detailUVW_fromWarp(pos: vec3<f32>, ph: f32, w: vec2<f32>) -> vec3<f32> {\n  let scaleD = max(wg_scaleD, EPS);\n  let pW = vec3<f32>(\n    pos.x + w.x + NTransform.detailOffsetWorld.x,\n    pos.y + NTransform.detailOffsetWorld.y,\n    pos.z + w.y + NTransform.detailOffsetWorld.z\n  );\n\n  let axis = axisOrOne3(NTransform.detailAxisScale);\n  let dMul = select(NTransform.detailScale, 1.0, NTransform.detailScale == 0.0);\n  return (pW * axis) * (scaleD * max(dMul, EPS));\n}\n\nfn sampleShapeRGBAWarp(pos: vec3<f32>, ph: f32, lod: f32, w: vec2<f32>) -> vec4<f32> {\n  return wrap3D_shape(shape3D, sampShape, shapeUVW_fromWarp(pos, ph, w), lod);\n}\n\nfn sampleDetailRGBWarp(pos: vec3<f32>, ph: f32, lod: f32, w: vec2<f32>) -> vec3<f32> {\n  return wrap3D_detail(detail3D, sampDetail, detailUVW_fromWarp(pos, ph, w), lod).rgb;\n}\n\nfn sampleShapeRGBA(pos: vec3<f32>, ph: f32, lod: f32) -> vec4<f32> {\n  let boxMaxXZ = max(B.half.x, B.half.z);\n  let w = worldWarpXZ(pos.xz, ph, boxMaxXZ);\n  return sampleShapeRGBAWarp(pos, ph, lod, w);\n}\n\nfn sampleDetailRGB(pos: vec3<f32>, ph: f32, lod: f32) -> vec3<f32> {\n  let boxMaxXZ = max(B.half.x, B.half.z);\n  let w = worldWarpXZ(pos.xz, ph, boxMaxXZ);\n  return sampleDetailRGBWarp(pos, ph, lod, w);\n}\n\n// ---------------------- weather mapping\nfn weatherUV_from(pos_world: vec3<f32>, squareOrigin_xz: vec2<f32>, invSide: f32, wScale: f32) -> vec2<f32> {\n  let wAxis = axisOrOne3(NTransform.weatherAxisScale);\n  let p = pos_world + NTransform.weatherOffsetWorld;\n  let rel = (p.xz - squareOrigin_xz) * vec2<f32>(wAxis.x, wAxis.z);\n  return rel * invSide * wScale;\n}\n\n// ---------------------- height shape and density\nfn heightShape(ph: f32, wBlue: f32) -> f32 {\n  let sr_bottom = saturate(remap(ph, 0.0, 0.07, 0.0, 1.0));\n  let stop_h = saturate(wBlue + 0.12);\n  let sr_top = saturate(remap(ph, stop_h * 0.2, stop_h, 1.0, 0.0));\n  var base = sr_bottom * sr_top;\n  let anvilFactor = saturate(C.cloudAnvilAmount) * saturate(C.globalCoverage);\n  let expo = saturate(remap(ph, 0.65, 0.95, 1.0, 1.0 - anvilFactor * 0.9));\n  return pow(base, expo);\n}\n\n// wm.r and wm.g still drive base/top jitter.\n// wm.b is a per-column CUTOUT fraction of the box height:\n//   - 0.0 means no cutout\n//   - 0.5 means the bottom half is forbidden (only top half can render)\n//   - 1.0 means the whole column is forbidden\nfn weatherBaseTopY(wm: vec4<f32>) -> vec2<f32> {\n  let boxH = max(B.half.y * 2.0, EPS);\n  let boxBottom = (B.center.y - B.half.y);\n  let boxTop = (B.center.y + B.half.y);\n\n  let jBase = (wm.r * 2.0 - 1.0) * (TUNE.baseJitterFrac * boxH);\n  let jTop = (wm.g * 2.0 - 1.0) * (TUNE.topJitterFrac * boxH);\n\n  let baseY = boxBottom + jBase;\n  let topY = boxTop + jTop;\n\n  return vec2<f32>(baseY, topY);\n}\n\nfn weatherCutY(wm: vec4<f32>) -> f32 {\n  let boxH = max(B.half.y * 2.0, EPS);\n  let boxBottom = (B.center.y - B.half.y);\n  let b = clamp(wm.b, 0.0, 1.0);\n  return boxBottom + b * boxH;\n}\n\nfn computePH(p_world: vec3<f32>, wm: vec4<f32>) -> f32 {\n  if (wm.b >= 1.0) { return -1.0; }\n\n  let bt = weatherBaseTopY(wm);\n  let baseY = bt.x;\n  let topY = bt.y;\n  if (topY - baseY <= EPS) { return -1.0; }\n\n  // null outside the jittered slab\n  if (p_world.y < baseY || p_world.y > topY) { return -1.0; }\n\n  // hard cutout: forbid everything below wm.b cut height, without renormalizing ph\n  let cutY = weatherCutY(wm);\n  if (p_world.y < cutY) { return -1.0; }\n\n  let wAxisY = max(abs(axisOrOne3(NTransform.weatherAxisScale).y), EPS);\n  let denom = max(topY - baseY, EPS) * wAxisY;\n\n  return saturate((p_world.y - baseY) / denom);\n}\n\n\n\nfn contrast01(x: f32, k: f32) -> f32 {\n  return saturate((x - 0.5) * k + 0.5);\n}\n\nfn ridge01(x: f32) -> f32 {\n  return 1.0 - abs(x * 2.0 - 1.0);\n}\n\nfn detailMod(ph: f32, d: vec3<f32>) -> f32 {\n  // robust "one channel or many channels"\n  var x = max(d.r, max(d.g, d.b));\n  x = saturate(x);\n\n  // make detail bite: ridge + contrast\n  x = contrast01(x, 1.75);\n  let r = ridge01(x);\n  let crisp = pow(saturate(r), 1.6);\n\n  // more detail in the body of the cloud, less near the very bottom\n  let h = saturate(remap(ph, 0.06, 0.85, 0.0, 1.0));\n\n  // keep some erosion even at high coverage, but reduce it a bit for overcast\n  let cov = saturate(C.globalCoverage);\n  let covAtten = exp(-cov * 0.55);\n\n  // output is a threshold in [~0.12 .. ~0.65]\n  return saturate(0.12 + (0.55 * covAtten) * crisp * h);\n}\n\n\nfn densityHeight(ph: f32) -> f32 {\n  var ret = ph;\n  ret *= saturate(remap(ph, 0.0, 0.2, 0.0, 1.0));\n  ret *= mix_f(1.0, saturate(remap(sqrt(max(ph, 0.0)), 0.4, 0.95, 1.0, 0.2)), saturate(C.cloudAnvilAmount));\n  ret *= saturate(remap(ph, 0.9, 1.0, 1.0, 0.0));\n  ret *= max(C.globalDensity * 10.0, 0.0);\n  return ret;\n}\n\nfn weatherCoverageGate(wm: vec4<f32>) -> f32 {\n  if (wm.b >= 1.0) { return 1.0; }\n  let wHi = saturate(remap(C.globalCoverage, 0.0, 1.0, 0.0, 1.0) - 0.5) * wm.g * 2.0;\n  let WMc = max(wm.r, wHi);\n  return 1.0 - C.globalCoverage * saturate(WMc - opt._r1);\n}\n\nfn densityFromSamples(ph: f32, wm: vec4<f32>, s: vec4<f32>, det: vec3<f32>) -> f32 {\n  if (ph < 0.0) { return 0.0; }\n  if (wm.b >= 1.0) { return 0.0; }\n\n  // base shape\n  var shape = saturate(s.r);\n  shape = contrast01(shape, 1.35);\n\n  // "fbm" from the other channels if present, otherwise still sane\n  let fbm_s = saturate(s.g * 0.625 + s.b * 0.25 + s.a * 0.125);\n\n  // treat fbm_s as an erosion threshold for the base shape\n  let SNsample = saturate(remap(shape, fbm_s, 1.0, 0.0, 1.0));\n\n  var SA = saturate(heightShape(ph, 1.0));\n  let wVar = fract(wm.r * 1.7 + wm.g * 2.3);\n  let bulge = 1.0 + 0.22 * (abs(fract(ph * (1.0 + wVar * 1.7)) - 0.5) * 2.0 - 0.5) * 0.5;\n  SA = saturate(SA * bulge);\n\n  let gate = weatherCoverageGate(wm);\n  let SNnd = saturate(remap(SNsample * SA, gate, 1.0, 0.0, 1.0));\n\n  // detail-driven erosion threshold (stronger than before)\n  let DN = detailMod(ph, det);\n\n  // sharper transition from empty -> dense\n  var core = saturate(remap(SNnd, DN, 1.0, 0.0, 1.0));\n  core = pow(core, 1.35);\n\n  return max(core * densityHeight(ph), 0.0);\n}\n\nfn densityMacroFromSamples(ph: f32, wm: vec4<f32>, s: vec4<f32>) -> f32 {\n  if (ph < 0.0) { return 0.0; }\n  if (wm.b >= 1.0) { return 0.0; }\n\n  var shape = saturate(s.r);\n  shape = contrast01(shape, 1.18);\n\n  let fbm_s = saturate(s.g * 0.625 + s.b * 0.25 + s.a * 0.125);\n  let SNsample = saturate(remap(shape, fbm_s * 0.68, 1.0, 0.0, 1.0));\n\n  var SA = saturate(heightShape(ph, 1.0));\n  let wVar = fract(wm.r * 1.7 + wm.g * 2.3);\n  let bulge = 1.0 + 0.18 * (abs(fract(ph * (1.0 + wVar * 1.7)) - 0.5) * 2.0 - 0.5) * 0.5;\n  SA = saturate(SA * bulge);\n\n  let gate = weatherCoverageGate(wm);\n  let SNnd = saturate(remap(SNsample * SA, gate * 0.88, 1.0, 0.0, 1.0));\n\n  let core = pow(SNnd, 1.1);\n  return max(core * densityHeight(ph), 0.0);\n}\n\n\nfn sampleLightingDensity(\n  pos: vec3<f32>,\n  wm: vec4<f32>,\n  lodShape: f32,\n  lodDetail: f32\n) -> f32 {\n  let phL = computePH(pos, wm);\n  if (phL < 0.0) { return 0.0; }\n\n  let w = worldWarpXZ(pos.xz, phL, max(B.half.x, B.half.z));\n  let s = sampleShapeRGBAWarp(pos, phL, lodShape, w);\n  let det = sampleDetailRGBWarp(pos, phL, lodDetail, w);\n\n  var d = densityFromSamples(phL, wm, s, det);\n  d *= insideFaceFade(pos, boxMin(), boxMax());\n  return max(d, 0.0);\n}\n\nfn approxLightingNormal(\n  pos: vec3<f32>,\n  wm: vec4<f32>,\n  lodShape: f32,\n  lodDetail: f32\n) -> vec3<f32> {\n  let probe = max(wg_finestWorld * 0.9, 1e-3);\n\n  let dx =\n    sampleLightingDensity(pos + vec3<f32>(probe, 0.0, 0.0), wm, lodShape, lodDetail) -\n    sampleLightingDensity(pos - vec3<f32>(probe, 0.0, 0.0), wm, lodShape, lodDetail);\n\n  let dy =\n    sampleLightingDensity(pos + vec3<f32>(0.0, probe, 0.0), wm, lodShape, lodDetail) -\n    sampleLightingDensity(pos - vec3<f32>(0.0, probe, 0.0), wm, lodShape, lodDetail);\n\n  let dz =\n    sampleLightingDensity(pos + vec3<f32>(0.0, 0.0, probe), wm, lodShape, lodDetail) -\n    sampleLightingDensity(pos - vec3<f32>(0.0, 0.0, probe), wm, lodShape, lodDetail);\n\n  let g = vec3<f32>(dx, dy, dz);\n  if (dot(g, g) < 1e-8) { return vec3<f32>(0.0, 1.0, 0.0); }\n\n  return normalize(-g);\n}\n\nfn directionalExposure(\n  pos: vec3<f32>,\n  wm: vec4<f32>,\n  lodShape: f32,\n  lodDetail: f32,\n  sunDir: vec3<f32>\n) -> f32 {\n  let probe = max(wg_finestWorld * 2.25, 2e-3);\n\n  let d0 = sampleLightingDensity(pos, wm, lodShape, lodDetail);\n  if (d0 <= 1e-5) { return 0.0; }\n\n  let dFront = sampleLightingDensity(pos + sunDir * probe, wm, lodShape, lodDetail);\n  let dBack = sampleLightingDensity(pos - sunDir * probe, wm, lodShape, lodDetail);\n\n  let opensToSun = saturate((d0 - dFront) / max(d0, 0.06));\n  let buriedFromBehind = saturate((dBack - d0) / max(max(dBack, d0), 0.06));\n\n  return saturate(opensToSun * (1.0 - 0.65 * buriedFromBehind));\n}\n\n// ---------------------- scattering and lighting\nfn BeerLaw(opticalDepth: f32, absorption: f32) -> f32 {\n  return exp2(-max(opticalDepth, 0.0) * max(absorption, EPS) * INV_LN2);\n}\n\n// Henyey-Greenstein phase, scaled so g = 0 returns 1.0 instead of 1 / 4PI.\n// The scale keeps the UI energy range practical while preserving the angular lobe.\nfn HG(cos_angle: f32, g: f32) -> f32 {\n  let gg = clamp(g, -0.92, 0.92);\n  let g2 = gg * gg;\n  let ca = clamp(cos_angle, -1.0, 1.0);\n  let denom = pow(max(1.0 + g2 - 2.0 * gg * ca, 1e-5), 1.5);\n  return (1.0 - g2) / denom;\n}\n\nfn CloudPhase(cos_angle: f32) -> f32 {\n  let ca = clamp(cos_angle, -1.0, 1.0);\n  let towardSun = saturate(ca * 0.5 + 0.5);\n\n  let forwardG = clamp(C.inScatterG, 0.0, 0.92);\n  let backwardG = -clamp(C.outScatterG, 0.0, 0.92);\n\n  let forwardPhase = HG(ca, forwardG);\n  let backwardPhase = HG(ca, backwardG);\n  let balance = saturate(C.inVsOut);\n\n  let raw = max(mix_f(backwardPhase, forwardPhase, balance), 0.0);\n  let normalized = raw / (1.0 + raw * 0.42);\n  let forwardBoost = mix_f(1.0, 1.18, pow(towardSun, 2.0));\n  return normalized * forwardBoost;\n}\n\nfn SilverSharpness() -> f32 {\n  return mix_f(3.0, 24.0, saturate(max(C.silverExponent, 0.0) / 24.0));\n}\n\nfn SilverControl() -> f32 {\n  let x = max(C.silverIntensity, 0.0);\n  return saturate(x / (x + 6.0));\n}\n\nfn BeerPowderBand(occlusion: f32) -> f32 {\n  let occ = saturate(occlusion);\n  let band = occ * (1.0 - occ) * 4.0;\n  return mix_f(0.18, 1.0, pow(saturate(band), 0.64));\n}\n\nfn SilverPhase(\n  cos_angle: f32,\n  sunVisibility: f32,\n  sampleAlpha: f32,\n  viewRim: f32,\n  sunRim: f32,\n  percent_height: f32,\n  shapeUp: f32\n) -> f32 {\n  let towardSun = saturate(cos_angle * 0.5 + 0.5);\n  let awaySun = 1.0 - towardSun;\n  let bias01 = saturate(C.silverDirectionBias * 0.5 + 0.5);\n\n  let sharpness = SilverSharpness();\n  let towardLobe = pow(max(towardSun, 0.08), sharpness);\n  let awayLobe = pow(max(awaySun, 0.08), sharpness);\n  let directional = mix_f(awayLobe, towardLobe, bias01);\n  let angular = max(directional, towardLobe * 0.72);\n\n  let upness = saturate(shapeUp * 0.5 + 0.5);\n  let upperExposure = smoothstep(0.52, 0.92, upness);\n  let exposedSun = mix_f(0.30, 1.0, pow(saturate(sunVisibility), 0.30));\n\n  let viewEdge = smoothstep(0.14, 0.96, pow(saturate(viewRim), 0.58));\n  let lightEdge = smoothstep(0.12, 0.96, pow(saturate(sunRim), 0.78));\n  let edge = viewEdge * mix_f(0.22, 1.0, lightEdge) * mix_f(0.18, 1.0, upperExposure);\n\n  let thin = pow(saturate(1.0 - sampleAlpha), 0.72);\n  let thinGate = smoothstep(0.05, 0.88, thin);\n  let sunOcc = 1.0 - saturate(sunVisibility);\n  let powder = mix_f(0.42, 1.0, BeerPowderBand(sunOcc));\n  let heightGate = smoothstep(0.06, 0.96, saturate(percent_height));\n  let horizonMix = saturate(C.silverHorizonBoost);\n  let horizon = mix_f(1.0, pow(1.0 - abs(cos_angle), 0.75), horizonMix);\n\n  let strength = SilverControl() * 1.85;\n  return strength * angular * edge * thinGate * powder * heightGate * horizon * exposedSun;\n}\n\nfn AmbientVisibility(density: f32, sunVisibility: f32, sunSide: f32, dist_along_ray: f32) -> f32 {\n  let d = max(density, 0.0);\n\n  let localExtinction = BeerLaw(d * DENSITY_LIGHT_SCALE * 0.55, max(C.cloudBeer * 0.16, 0.03));\n  let densityLift = mix_f(0.64, 1.0, localExtinction);\n  let sunLift = mix_f(0.82, 1.0, pow(saturate(sunVisibility), 0.55));\n  let sideLift = mix_f(0.86, 1.0, pow(saturate(sunSide), 0.45));\n  let distanceFade = mix_f(1.0, 0.94, pow(saturate(dist_along_ray / 4500.0), 1.10));\n\n  return densityLift * sunLift * sideLift * distanceFade;\n}\n\nfn CalculateLight(\n  density: f32,\n  sampleAlpha: f32,\n  Tsun: f32,\n  cos_angle: f32,\n  percent_height: f32,\n  bluenoise: f32,\n  dist_along_ray: f32,\n  rimBoost: f32,\n  sunSide: f32,\n  sunRim: f32,\n  viewTransmittance: f32,\n  sunExposure: f32,\n  upperExposure: f32\n) -> vec3<f32> {\n  let ca = clamp(cos_angle, -1.0, 1.0);\n  let rawSunVisibility = saturate(Tsun);\n  let shadowFloor = clamp(C.attenuationClamp * 5.0, 0.075, 0.22);\n  let sunVisibility = mix_f(shadowFloor, 1.0, pow(rawSunVisibility, 0.86));\n\n  let phase = CloudPhase(ca);\n  let towardSun = saturate(ca * 0.5 + 0.5);\n  let awaySun = 1.0 - towardSun;\n\n  let lightDensity = saturate(max(density, 0.0) * DENSITY_LIGHT_SCALE * 0.10);\n  let lightSideRaw = saturate(sunSide);\n  let lightSide = mix_f(0.56, 1.0, pow(lightSideRaw, 0.62));\n\n  let body = pow(saturate(sampleAlpha), 0.38);\n  let thin = pow(saturate(1.0 - sampleAlpha), 0.86);\n  let edgeThin = pow(saturate(1.0 - sampleAlpha), 0.34);\n  let rim = pow(saturate(rimBoost), 0.58);\n\n  let frontShell = pow(saturate(viewTransmittance), 0.42);\n  let exposedToSun = saturate(sunExposure);\n  let upperGate = saturate(upperExposure);\n\n  let phaseGlow = phase * mix_f(0.15, 0.42, pow(towardSun, 1.10));\n  let broadDirect = 0.22 + 0.38 * lightDensity * mix_f(0.84, 1.10, lightSideRaw);\n\n  let reliefDiffuse = sunVisibility\n    * mix_f(0.035, 0.28, exposedToSun)\n    * pow(lightSideRaw, 0.82)\n    * pow(body, 0.58)\n    * mix_f(0.72, 1.0, frontShell);\n\n  let silhouetteCore = pow(body, 1.18) * pow(towardSun, 1.05);\n  let reliefShadow = silhouetteCore\n    * mix_f(0.28, 0.90, 1.0 - lightSideRaw)\n    * mix_f(0.48, 0.96, 1.0 - rim)\n    * mix_f(0.48, 0.92, 1.0 - rawSunVisibility);\n\n  let cavityShadow = pow(1.0 - lightSideRaw, 1.45)\n    * mix_f(0.035, 0.22, body)\n    * mix_f(0.52, 0.90, 1.0 - exposedToSun);\n\n  let bodyShadow = clamp(mix_f(0.0, 0.44, reliefShadow) + cavityShadow, 0.0, 0.74);\n\n  let direct = sunVisibility * lightSide * (broadDirect + phaseGlow + reliefDiffuse) * (1.0 - bodyShadow);\n\n  let multiScatter = mix_f(0.16, 0.34, body)\n    * mix_f(0.70, 1.0, rawSunVisibility)\n    * (1.0 - bodyShadow * 0.55);\n\n  let forwardWrap = pow(towardSun, 0.62)\n    * mix_f(0.02, 0.11, thin)\n    * mix_f(0.78, 1.0, exposedToSun)\n    * sunVisibility;\n\n  let backWrap = pow(awaySun, 0.55)\n    * 0.028\n    * mix_f(1.0, 0.62, body)\n    * (1.0 - reliefShadow * 0.22);\n\n  let ambientBase = 0.13 + max(C.ambientMinimum, 0.0) * 0.95;\n  let ambientEdgeFill = max(C.outScatterAmbientAmt, 0.0)\n    * mix_f(0.22, 1.0, edgeThin)\n    * mix_f(0.48, 1.0, 1.0 - bodyShadow);\n\n  let ambientRelief = mix_f(0.0, 0.06, exposedToSun) * mix_f(1.0, 0.76, bodyShadow);\n  let ambientHeight = mix_f(0.86, 1.05, saturate(percent_height));\n  let ambientVis = AmbientVisibility(density, rawSunVisibility, lightSide, dist_along_ray);\n  let ambientOcclusion = 1.0 - bodyShadow * 0.42;\n  let ambient = (ambientBase + ambientEdgeFill + ambientRelief) * ambientHeight * ambientVis * ambientOcclusion;\n\n  let bodyLift = 0.052\n    * pow(lightSideRaw, 1.02)\n    * pow(body, 0.78)\n    * mix_f(0.60, 1.0, 1.0 - bodyShadow)\n    * mix_f(0.78, 1.0, rawSunVisibility);\n\n  let silverSharpness = SilverSharpness();\n  let exposedShell = smoothstep(0.05, 0.82, exposedToSun) * pow(frontShell, 0.48) * mix_f(0.42, 1.0, upperGate);\n  let silverBase = SilverPhase(ca, rawSunVisibility, sampleAlpha, rimBoost, sunRim, percent_height, upperGate * 2.0 - 1.0) * exposedShell;\n  let sunEdge = pow(saturate(rimBoost * sunRim), 0.42);\n\n  let silverCrest = silverBase\n    * mix_f(0.78, 1.12, edgeThin)\n    * mix_f(0.78, 1.04, lightSideRaw)\n    * mix_f(0.55, 1.0, sunEdge);\n\n  let throughSunGlint = SilverControl()\n    * 0.34\n    * exposedShell\n    * pow(max(towardSun, 0.10), 1.80 + silverSharpness * 0.10)\n    * mix_f(0.35, 1.0, sunEdge)\n    * mix_f(0.82, 1.0, rawSunVisibility);\n\n  let silver = silverCrest + throughSunGlint;\n\n  let lowSunRaw = 1.0 - saturate((L.sunDir.y + 0.08) / 0.82);\n  let lowSun = lowSunRaw * 0.42;\n\n  let sunCol = C.sunColor * mix_v3(vec3<f32>(1.0, 0.98, 0.96), vec3<f32>(1.0, 0.90, 0.84), lowSun);\n  let silverCol = mix_v3(vec3<f32>(1.0, 0.985, 0.97), vec3<f32>(1.0, 0.92, 0.89), lowSun);\n  let skyCol = mix_v3(vec3<f32>(0.54, 0.64, 0.79), vec3<f32>(0.60, 0.61, 0.82), lowSun * 0.35);\n  let shadowCol = mix_v3(vec3<f32>(0.73, 0.79, 0.89), vec3<f32>(0.72, 0.74, 0.87), lowSun * 0.35);\n\n  let directEnergy = direct + multiScatter + forwardWrap + backWrap;\n  let silverEnergy = silver + bodyLift * mix_f(0.72, 1.02, pow(towardSun, 1.10));\n  let ambientEnergy = ambient;\n\n  let shadowTint = shadowCol * (bodyShadow * 0.14 + reliefShadow * 0.06 + cavityShadow * 0.14);\n  let radiance = sunCol * directEnergy + silverCol * silverEnergy + skyCol * ambientEnergy - shadowTint;\n  let noiseLift = (bluenoise - 0.5) * 0.00010;\n\n  return max(radiance + vec3<f32>(noiseLift), vec3<f32>(0.0));\n}\n// approximate surface normal from coarse shape mip\nfn approxShapeNormal(pos: vec3<f32>, ph: f32, lodShape: f32) -> vec3<f32> {\n  let probe = max(wg_finestWorld * 1.25, 1e-3);\n\n  let c = sampleShapeRGBA(pos, ph, lodShape).r;\n  let px = sampleShapeRGBA(pos + vec3<f32>(probe, 0.0, 0.0), ph, lodShape).r;\n  let nx = sampleShapeRGBA(pos - vec3<f32>(probe, 0.0, 0.0), ph, lodShape).r;\n  let pz = sampleShapeRGBA(pos + vec3<f32>(0.0, 0.0, probe), ph, lodShape).r;\n  let nz = sampleShapeRGBA(pos - vec3<f32>(0.0, 0.0, probe), ph, lodShape).r;\n  let py = sampleShapeRGBA(pos + vec3<f32>(0.0, probe, 0.0), ph, lodShape).r;\n\n  let gy = (py - c) / probe;\n  let gx = (px - nx) * 0.5 / probe;\n  let gz = (pz - nz) * 0.5 / probe;\n\n  var n = normalize(vec3<f32>(-gx, -gy, -gz));\n  if (length(n) < 1e-4) { return vec3<f32>(0.0, 1.0, 0.0); }\n  return n;\n}\n\nfn approxShapeNormalFast(pos: vec3<f32>, ph: f32, lodShape: f32) -> vec3<f32> {\n  let probe = max(wg_finestWorld * 1.5, 1e-3);\n  let c = sampleShapeRGBA(pos, ph, lodShape).r;\n  let px = sampleShapeRGBA(pos + vec3<f32>(probe, 0.0, 0.0), ph, lodShape).r;\n  let pz = sampleShapeRGBA(pos + vec3<f32>(0.0, 0.0, probe), ph, lodShape).r;\n  let py = sampleShapeRGBA(pos + vec3<f32>(0.0, probe, 0.0), ph, lodShape).r;\n\n  let g = vec3<f32>((px - c) / probe, (py - c) / probe, (pz - c) / probe);\n  if (dot(g, g) < 1e-8) { return vec3<f32>(0.0, 1.0, 0.0); }\n  return normalize(-g);\n}\n\n// reprojection helpers\nfn fullPixFromCurrent(pix: vec2<i32>) -> vec2<i32> {\n  let res = vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));\n  let fullRes = vec2<f32>(f32(reproj.fullWidth), f32(reproj.fullHeight));\n  let xf = floor((vec2<f32>(pix) + 0.5) * (fullRes / res));\n  return vec2<i32>(\n    i32(clamp(xf.x, 0.0, fullRes.x - 1.0)),\n    i32(clamp(xf.y, 0.0, fullRes.y - 1.0))\n  );\n}\n\nfn store_history_full_res_if_owner(pixCurr: vec2<i32>, layer: i32, color: vec4<f32>) {\n  if (reproj.enabled == 0u) {\n    textureStore(historyOut, fullPixFromCurrent(pixCurr), layer, color);\n    return;\n  }\n\n  let ss = i32(max(reproj.subsample, 1u));\n  let off = i32(reproj.sampleOffset % u32(ss * ss));\n  let sx = off % ss;\n  let sy = off / ss;\n\n  let fullPix = fullPixFromCurrent(pixCurr);\n  if ((fullPix.x % ss) == sx && (fullPix.y % ss) == sy) {\n    textureStore(historyOut, fullPix, layer, color);\n  }\n}\n\n// fade near AABB faces\nfn insideFaceFade(p: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>) -> f32 {\n  let dmin = p - bmin;\n  let dmax = bmax - p;\n  let edge = min(dmin, dmax);\n  let closest = min(min(edge.x, edge.y), edge.z);\n  let soft = max(0.75 * wg_finestWorld, 0.25);\n  return saturate(closest / soft);\n}\n\n// ---------------------- sun march\nfn sampleCloudDensityAt(\n  p: vec3<f32>,\n  weatherLOD: f32,\n  lodShapeBase: f32,\n  lodDetailBase: f32,\n  squareOrigin_xz: vec2<f32>,\n  invSide: f32,\n  wScale: f32,\n  stepIndex: i32\n) -> f32 {\n  let uv = weatherUV_from(p, squareOrigin_xz, invSide, wScale);\n  let wm = wrap2D(weather2D, samp2D, uv, 0i, weatherLOD);\n\n  let ph = computePH(p, wm);\n  if (ph < 0.0 || wm.b >= 1.0) { return 0.0; }\n\n  let lodShape = clamp(lodShapeBase + f32(stepIndex) * 0.35 + 0.50, 0.0, wg_maxMipS);\n  let s = sampleShapeRGBA(p, ph, lodShape);\n  let d = densityMacroFromSamples(ph, wm, s) * insideFaceFade(p, boxMin(), boxMax());\n\n  return max(d, 0.0);\n}\n\nfn sunTransmittance(\n  p0: vec3<f32>,\n  sunDir: vec3<f32>,\n  weatherLOD: f32,\n  lodShapeBase: f32,\n  lodDetailBase: f32,\n  nominalStepLen: f32,\n  squareOrigin_xz: vec2<f32>,\n  invSide: f32,\n  wScale: f32,\n  stepsIn: i32\n) -> f32 {\n  let steps = max(stepsIn, 1);\n  let start = p0 + sunDir * max(TUNE.aabbFaceOffset, EPS);\n  let hit = intersectAABB_robust(start, sunDir, boxMin(), boxMax());\n  let availableDist = max(hit.y, nominalStepLen * f32(steps));\n  let lightStep = clamp(availableDist / f32(steps), max(nominalStepLen * 0.5, TUNE.minStep), max(nominalStepLen * 4.0, TUNE.maxStep));\n\n  var opticalDepth = 0.0;\n  var p = start + sunDir * (0.5 * lightStep);\n\n  for (var i: i32 = 0; i < steps; i = i + 1) {\n    let d = sampleCloudDensityAt(\n      p, weatherLOD, lodShapeBase, lodDetailBase,\n      squareOrigin_xz, invSide, wScale, i\n    );\n    opticalDepth += d * lightStep * SUN_EXTINCTION_SCALE;\n    if (BeerLaw(opticalDepth, C.cloudBeer) < TUNE.sunMinTr) { break; }\n    p += sunDir * lightStep;\n  }\n\n  return BeerLaw(opticalDepth, C.cloudBeer);\n}\n\n// quick empty probe\nfn weatherProbeEmpty(\n  p_start: vec3<f32>,\n  rd: vec3<f32>,\n  stepLen: f32,\n  nProbes: i32,\n  coarseMip: f32,\n  squareOrigin_xz: vec2<f32>,\n  invSide: f32,\n  wScale: f32\n) -> bool {\n  var pos = p_start;\n  var emptyCount: i32 = 0;\n\n  for (var i: i32 = 0; i < nProbes; i = i + 1) {\n    let uv = weatherUV_from(pos, squareOrigin_xz, invSide, wScale);\n    let wm = wrap2D(weather2D, samp2D, uv, 0i, coarseMip);\n    if (weatherCoverageGate(wm) >= TUNE.weatherRejectGate) { emptyCount = emptyCount + 1; }\n    pos = pos + rd * stepLen;\n  }\n\n  return (f32(emptyCount) / f32(nProbes)) > 0.66;\n}\n\n// ---------------------- Main compute\n@compute @workgroup_size(8, 8, 1)\nfn computeCloud(\n  @builtin(global_invocation_id) gid_in: vec3<u32>,\n  @builtin(local_invocation_id) local_id: vec3<u32>\n) {\n  // workgroup cache\n  if (local_id.x == 0u && local_id.y == 0u) {\n    let wd = textureDimensions(weather2D, 0);\n    wg_weatherDim = vec2<f32>(f32(wd.x), f32(wd.y));\n\n    let bd = textureDimensions(blueTex, 0);\n    wg_blueDim = vec2<f32>(f32(bd.x), f32(bd.y));\n\n    let sd = textureDimensions(shape3D);\n    wg_shapeDim = vec3<f32>(f32(sd.x), f32(sd.y), f32(sd.z));\n\n    let dd = textureDimensions(detail3D);\n    wg_detailDim = vec3<f32>(f32(dd.x), f32(dd.y), f32(dd.z));\n\n    wg_maxMipW = f32(textureNumLevels(weather2D)) - 1.0;\n    wg_maxMipS = f32(textureNumLevels(shape3D)) - 1.0;\n    wg_maxMipD = f32(textureNumLevels(detail3D)) - 1.0;\n\n    let scaleS_local = max(V.worldToUV * B.uvScale, EPS);\n    wg_scaleS = scaleS_local;\n    wg_scaleD = max(scaleS_local * (128.0 / 32.0), EPS);\n\n    let sAxis = axisOrOne3(NTransform.shapeAxisScale);\n    let dAxis = axisOrOne3(NTransform.detailAxisScale);\n\n    let sMul = select(NTransform.shapeScale, 1.0, NTransform.shapeScale == 0.0);\n    let dMul = select(NTransform.detailScale, 1.0, NTransform.detailScale == 0.0);\n\n    wg_scaleS_effMax = wg_scaleS * max(sMul, EPS) * axisMaxAbs3(sAxis);\n    wg_scaleD_effMax = wg_scaleD * max(dMul, EPS) * axisMaxAbs3(dAxis);\n\n    wg_finestWorld = min(1.0 / wg_scaleS_effMax, 1.0 / wg_scaleD_effMax) * 0.6;\n  }\n  workgroupBarrier();\n\n  // pixel and guard\n  let pixI = vec2<i32>(i32(gid_in.x), i32(gid_in.y)) + vec2<i32>(frame.originX, frame.originY);\n  if (pixI.x < 0 || pixI.y < 0 || pixI.x >= i32(frame.fullWidth) || pixI.y >= i32(frame.fullHeight)) {\n    return;\n  }\n\n  let fullResF = vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));\n  let uvPix = (vec2<f32>(pixI) + 0.5) / fullResF;\n\n  // camera basis\n  let camFwd = normalize(V.fwd);\n\n  var basisRight = normalize(V.right);\n  if (length(basisRight) < EPS) { basisRight = vec3<f32>(1.0, 0.0, 0.0); }\n\n  var basisUp = normalize(V.up);\n  if (length(basisUp) < EPS) { basisUp = vec3<f32>(0.0, 1.0, 0.0); }\n\n  // ray origin\n  var rayRo = V.camPos;\n  if (opt.useCustomPos == 1u) {\n    let idx = u32(pixI.x) + u32(pixI.y) * frame.fullWidth;\n    rayRo = posBuf[idx].xyz;\n  }\n\n  // ray direction\n  let ndc = uvPix * 2.0 - vec2<f32>(1.0, 1.0);\n  let tanY = tan(0.5 * V.fovY);\n\n  let rd_camera = normalize(vec3<f32>(ndc.x * V.aspect * tanY, -ndc.y * tanY, -1.0));\n  let rayRd = normalize(basisRight * rd_camera.x + basisUp * rd_camera.y - camFwd * rd_camera.z);\n\n  // intersect volume\n  let bmin = boxMin();\n  let bmax = boxMax();\n  let ti = intersectAABB_robust(rayRo, rayRd, bmin, bmax);\n\n  if (ti.x > ti.y || ti.y <= 0.0) {\n    let z = vec4<f32>(0.0);\n    textureStore(outTex, pixI, frame.layerIndex, z);\n    if (reproj.enabled == 1u) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }\n    return;\n  }\n\n  var t0 = max(ti.x - TUNE.aabbFaceOffset, 0.0);\n  var t1 = ti.y + TUNE.aabbFaceOffset;\n  if (t0 >= t1) {\n    let z = vec4<f32>(0.0);\n    textureStore(outTex, pixI, frame.layerIndex, z);\n    if (reproj.enabled == 1u) { store_history_full_res_if_owner(pixI, frame.layerIndex, z); }\n    return;\n  }\n\n  // ---------------------- precompute weather mapping and LOD\n  let aabb = max(bmax - bmin, vec3<f32>(EPS, EPS, EPS));\n  let side = max(aabb.x, aabb.z);\n  let invSide = 1.0 / max(side, EPS);\n  let squareOrigin_xz = B.center.xz - vec2<f32>(0.5 * side);\n\n  let wScale = select(NTransform.weatherScale, 1.0, NTransform.weatherScale == 0.0);\n  let wAxis = axisOrOne3(NTransform.weatherAxisScale);\n\n  let texelsPerWorld_u = wg_weatherDim.x * abs(wAxis.x) * wScale * invSide;\n  let texelsPerWorld_v = wg_weatherDim.y * abs(wAxis.z) * wScale * invSide;\n  let fp = max(texelsPerWorld_u, texelsPerWorld_v);\n\n  let weatherLOD_base = clamp(\n    log2(max(fp, 1.0)) + TUNE.lodBiasWeather * max(perf.lodBiasMul, 0.0001),\n    0.0,\n    wg_maxMipW\n  );\n\n  // noise and jitter\n  let bnPix = sampleBlueScreen(pixI);\n  let rand0 = fract(bnPix + 0.61803398875 * f32(reproj.frameIndex));\n\n  // step sizing\n  let viewDir = normalize(-rayRd);\n  let cosVF = max(dot(rayRd, camFwd), EPS);\n\n  let voxelBound = wg_finestWorld / max(abs(dot(rayRd, basisUp)), 0.15);\n\n  var baseStep = clamp(V.stepBase, TUNE.minStep, TUNE.maxStep);\n  baseStep = min(baseStep, voxelBound);\n  baseStep = baseStep * mix_f(1.0, 1.0 + TUNE.stepJitter, rand0 * 2.0 - 1.0);\n\n  let entryDepth = dot((rayRo + rayRd * t0) - V.camPos, camFwd);\n  let nearFactor = saturate(1.0 - entryDepth / TUNE.nearFluffDist);\n  baseStep = clamp(baseStep * mix_f(1.0, TUNE.nearStepScale, nearFactor), TUNE.minStep, TUNE.maxStep);\n\n  let rayExitDepth = max(dot((rayRo + rayRd * t1) - V.camPos, camFwd), entryDepth);\n  let rayFarHistoryF = saturate(remap(rayExitDepth, TUNE.farStart, TUNE.farFull, 0.0, 1.0));\n\n  var t = clamp(t0 + (rand0 * TUNE.phaseJitter) * baseStep, t0, t1);\n\n  // lighting setup. rayRd points from camera into the volume, matching the blog-style phase convention.\n  let sunDir = normalize(L.sunDir);\n  let cosVS = dot(rayRd, sunDir);\n\n  // sun shadowing samples should cover neighboring cloud volume, not only the vertical slab thickness.\n  let sunNominalSpan = max(length(B.half * 2.0) * 0.5, EPS);\n  let sunStepLen = clamp(\n    sunNominalSpan / f32(max(TUNE.sunSteps, 1)),\n    TUNE.minStep,\n    max(TUNE.maxStep, sunNominalSpan)\n  );\n\n  // accumulators\n  var Tr = 1.0;\n  var rgb = vec3<f32>(0.0);\n\n  var Tsun_cached = 1.0;\n  var prevDens: f32 = 0.0;\n  var prevMacroDens: f32 = 0.0;\n  var prevTsun: f32 = 1.0;\n\n  var shapeN_cached = vec3<f32>(0.0, 1.0, 0.0);\n  var lightN_cached = vec3<f32>(0.0, 1.0, 0.0);\n  var rim_cached: f32 = 0.0;\n  var sunSide_cached: f32 = 0.5;\n  var sunRim_cached: f32 = 0.0;\n  var sunExposure_cached: f32 = 0.0;\n  var upperExposure_cached: f32 = 1.0;\n\n  var runMeanL: f32 = 0.0;\n  var runN: f32 = 0.0;\n\n  var iter: i32 = 0;\n\n  loop {\n    if (iter >= TUNE.maxSteps) { break; }\n    if (t >= t1 || Tr < 0.001) { break; }\n\n    let p = rayRo + rayRd * t;\n    let sampleViewDepth = max(dot(p - V.camPos, camFwd), 0.0);\n    let farF = saturate(remap(sampleViewDepth, TUNE.farStart, TUNE.farFull, 0.0, 1.0));\n    let stepLen = clamp(baseStep * mix_f(1.0, TUNE.farStepMult, farF), TUNE.minStep, TUNE.maxStep);\n    let weatherLOD = min(wg_maxMipW, weatherLOD_base + TUNE.farLodPush * farF);\n\n    // coarse weather skip\n    let subsample = f32(max(reproj.subsample, 1u));\n    let coarsePenalty = log2(max(subsample, 1.0));\n    var coarseMip = max(0.0, wg_maxMipW - (TUNE.weatherRejectMip + max(perf.coarseMipBias, 0.0) + coarsePenalty));\n    coarseMip = min(wg_maxMipW, coarseMip + farF * 1.0);\n\n    // Single weather proxy for this step. Shape/detail volumes carry the high-frequency structure,\n    // so this can use the reject mip instead of doing both a coarse and a full weather fetch.\n    let uv_coarse = weatherUV_from(p, squareOrigin_xz, invSide, wScale);\n    let wm_coarse = wrap2D(weather2D, samp2D, uv_coarse, 0i, clamp(max(weatherLOD, coarseMip), 0.0, wg_maxMipW));\n\n    if (weatherCoverageGate(wm_coarse) >= TUNE.weatherRejectGate) {\n      t = min(t + stepLen * TUNE.emptySkipMult, t1);\n      prevDens = 0.0;\n      prevMacroDens = 0.0;\n      prevTsun = 1.0;\n      Tsun_cached = 1.0;\n      iter = iter + 1;\n      continue;\n    }\n\n    if (wm_coarse.b >= 1.0) {\n      t = min(t + stepLen * 2.0, t1);\n      prevDens = 0.0;\n      prevMacroDens = 0.0;\n      prevTsun = 1.0;\n      Tsun_cached = 1.0;\n      iter = iter + 1;\n      continue;\n    }\n\n    let ph_coarse = computePH(p, wm_coarse);\n    let quickCoverage = saturate((wm_coarse.r - 0.35) * 2.5);\n    if (quickCoverage < 0.01 && (ph_coarse < 0.02)) {\n      t = min(t + stepLen * 2.0, t1);\n      prevDens = 0.0;\n      prevMacroDens = 0.0;\n      prevTsun = 1.0;\n      Tsun_cached = 1.0;\n      iter = iter + 1;\n      continue;\n    }\n\n    // LOD from step\n    let baseLOD = clamp(log2(max(stepLen / wg_finestWorld, 1.0)), 0.0, wg_maxMipS);\n    let nearDepth = max(cosVF * (t - t0), 0.0);\n    let nearSmooth = pow(saturate(1.0 - nearDepth / TUNE.nearFluffDist), 0.85);\n\n    let lodBias = mix_f(0.0, TUNE.nearLodBias, nearSmooth);\n    let lodShapeBase = clamp(baseLOD + lodBias + TUNE.farLodPush * farF, 0.0, wg_maxMipS);\n    let lodDetailBase = clamp(baseLOD + lodBias + TUNE.farLodPush * farF, 0.0, wg_maxMipD);\n\n    let wm = wm_coarse;\n    let ph = ph_coarse;\n    if (ph < 0.0) {\n      t = min(t + stepLen * 2.0, t1);\n      prevDens = 0.0;\n      prevMacroDens = 0.0;\n      prevTsun = 1.0;\n      Tsun_cached = 1.0;\n      iter = iter + 1;\n      continue;\n    }\n\n    let stepWarp = worldWarpXZ(p.xz, ph, max(B.half.x, B.half.z));\n\n    // mip hysteresis\n    let sL: f32 = floor(lodShapeBase);\n    let sF: f32 = saturate(lodShapeBase - sL);\n    let dL: f32 = floor(lodDetailBase);\n    let dF: f32 = saturate(lodDetailBase - dL);\n\n    var s: vec4<f32>;\n    if (sF > TUNE.lodBlendThreshold) {\n      let s_lo = sampleShapeRGBAWarp(p, ph, sL, stepWarp);\n      let s_hi = sampleShapeRGBAWarp(p, ph, min(sL + 1.0, wg_maxMipS), stepWarp);\n      s = mix_v4(s_lo, s_hi, sF);\n    } else {\n      s = sampleShapeRGBAWarp(p, ph, sL, stepWarp);\n    }\n\n    let faceFade = insideFaceFade(p, bmin, bmax);\n    let nearDense = mix_f(TUNE.nearDensityMult, 1.0, saturate(nearDepth / TUNE.nearDensityRange));\n\n    var densMacro = densityMacroFromSamples(ph, wm, s) * faceFade * nearDense;\n\n    if (densMacro <= 0.00004 && prevMacroDens <= 0.00004) {\n      prevDens = 0.0;\n      prevMacroDens = 0.0;\n      prevTsun = 1.0;\n      Tsun_cached = 1.0;\n      t = min(t + stepLen * 1.5, t1);\n      iter = iter + 1;\n      continue;\n    }\n\n    let farMacroOnly = saturate(remap(farF, 0.62, 1.0, 0.0, 1.0));\n    let denseMacroOnly = saturate(remap(max(densMacro, prevMacroDens), 0.08, 0.26, 0.0, 1.0));\n    let macroOnly = (farMacroOnly * denseMacroOnly) > 0.55;\n\n    var det: vec3<f32> = vec3<f32>(0.5, 0.5, 0.5);\n    var dens: f32 = densMacro;\n    if (!macroOnly) {\n      if (dF > TUNE.lodBlendThreshold) {\n        let d_lo = sampleDetailRGBWarp(p, ph, dL, stepWarp);\n        let d_hi = sampleDetailRGBWarp(p, ph, min(dL + 1.0, wg_maxMipD), stepWarp);\n        det = mix_v3(d_lo, d_hi, dF);\n      } else {\n        det = sampleDetailRGBWarp(p, ph, dL, stepWarp);\n      }\n      det = mix_v3(det, det * TUNE.farDetailAtten, farF);\n      dens = densityFromSamples(ph, wm, s, det) * faceFade * nearDense;\n    }\n\n    let bodySmooth = smoothstep(0.08, 0.42, max(densMacro, prevMacroDens));\n    let raySmoothDensAdaptive = saturate(mix_f(TUNE.raySmoothDens * 0.30, TUNE.raySmoothDens, bodySmooth));\n    let densSmoothed = mix_f(dens, prevDens, raySmoothDensAdaptive);\n    let densMacroSmoothed = mix_f(densMacro, prevMacroDens, saturate(raySmoothDensAdaptive * 0.90));\n\n    if (densSmoothed > 0.00008) {\n      let shadowInteriorProbe = saturate(remap(densMacroSmoothed, 0.05, 0.32, 0.0, 1.0));\n      let adaptiveStrideAdd = i32(floor(farF * 3.0 + shadowInteriorProbe * farF * 2.0));\n      let sunStrideSafe = max(TUNE.sunStride + adaptiveStrideAdd, 1);\n      if ((iter % sunStrideSafe) == 0) {\n        if (densMacroSmoothed * stepLen > TUNE.sunDensityGate) {\n          let sunStepsAdaptive = max(2, TUNE.sunSteps - i32(floor(farF * 2.0)) - i32(floor(shadowInteriorProbe * farF * 1.5)));\n          let sunStepAdaptive = sunStepLen * mix_f(1.0, 1.35, farF);\n          Tsun_cached = sunTransmittance(\n            p, sunDir, weatherLOD, lodShapeBase, lodDetailBase, sunStepAdaptive,\n            squareOrigin_xz, invSide, wScale, sunStepsAdaptive\n          );\n        } else {\n          Tsun_cached = 1.0;\n        }\n\n        let fastLighting = (sunStrideSafe > TUNE.sunStride) || macroOnly || (farF > 0.40);\n        if (!fastLighting && sunStrideSafe <= 1) {\n          shapeN_cached = approxShapeNormal(p, ph, max(0.0, lodShapeBase));\n        } else {\n          shapeN_cached = approxShapeNormalFast(p, ph, max(0.0, lodShapeBase + 0.35));\n        }\n\n        if (!fastLighting && sunStrideSafe <= 1) {\n          let densityN = approxLightingNormal(\n            p,\n            wm,\n            max(0.0, lodShapeBase + 0.65),\n            max(0.0, lodDetailBase + 1.25)\n          );\n          lightN_cached = normalize(mix_v3(shapeN_cached, densityN, mix_f(0.65, 0.25, shadowInteriorProbe)));\n          sunExposure_cached = directionalExposure(\n            p,\n            wm,\n            max(0.0, lodShapeBase + 0.50),\n            max(0.0, lodDetailBase + 1.00),\n            sunDir\n          );\n        } else {\n          lightN_cached = normalize(mix_v3(shapeN_cached, vec3<f32>(0.0, 1.0, 0.0), 0.18 * shadowInteriorProbe));\n          sunExposure_cached = saturate(dot(lightN_cached, sunDir) * 0.72 + 0.28);\n        }\n\n        rim_cached = pow(1.0 - saturate(dot(lightN_cached, viewDir)), 1.7);\n\n        let sunFacing = saturate(dot(lightN_cached, sunDir));\n        sunSide_cached = sunFacing;\n        sunRim_cached = pow(1.0 - sunFacing, 1.30);\n\n        upperExposure_cached = smoothstep(\n          0.42,\n          0.78,\n          saturate(lightN_cached.y * 0.5 + 0.5)\n        );\n      }\n\n      let raySmoothSunAdaptive = saturate(mix_f(TUNE.raySmoothSun * 0.35, TUNE.raySmoothSun, bodySmooth));\n      let TsunSmoothed = mix_f(Tsun_cached, prevTsun, raySmoothSunAdaptive);\n      let shadowInterior = saturate(remap(densMacroSmoothed, 0.05, 0.32, 0.0, 1.0)) * (1.0 - saturate(TsunSmoothed * 1.35));\n      let bnScaled = mix_f(bnPix, bnPix * TUNE.bnFarScale, farF) * mix_f(1.0, 0.18, shadowInterior);\n\n      let rawSampleODFine = densSmoothed * stepLen * VIEW_EXTINCTION_SCALE;\n      let rawSampleODMacro = densMacroSmoothed * stepLen * VIEW_EXTINCTION_SCALE;\n      let sampleOD = min(mix_f(rawSampleODFine, rawSampleODMacro, 0.58 * shadowInterior), max(C.attenuationClamp, 0.001));\n      let absorb = BeerLaw(sampleOD, C.cloudBeer);\n      let alpha = 1.0 - absorb;\n\n      let lightDensity = mix_f(densSmoothed, densMacroSmoothed, 0.82 * shadowInterior);\n      let rimEffective = rim_cached * mix_f(1.0, 0.20, shadowInterior);\n      let exposureEffective = sunExposure_cached * mix_f(1.0, 0.28, shadowInterior);\n      let sideEffective = mix_f(sunSide_cached, 0.62, 0.35 * shadowInterior);\n\n      var lightCol = CalculateLight(\n        lightDensity,\n        alpha,\n        TsunSmoothed,\n        cosVS,\n        ph,\n        bnScaled,\n        t - t0,\n        rimEffective,\n        sideEffective,\n        sunRim_cached,\n        Tr,\n        exposureEffective,\n        upperExposure_cached\n      );\n\n      let shadowLift = vec3<f32>(0.045, 0.050, 0.058) * shadowInterior;\n      lightCol = lightCol + shadowLift * alpha;\n\n      let lNow = luminance(lightCol);\n      let meanL = select(lNow, runMeanL / max(runN, 1.0), runN > 0.0);\n      let allow = max(meanL * (1.0 + TUNE.fflyRelClamp), TUNE.fflyAbsFloor);\n      if (lNow > allow) { lightCol *= allow / max(lNow, 1e-6); }\n\n      rgb += Tr * lightCol * alpha;\n      Tr *= absorb;\n\n      runMeanL += lNow;\n      runN += 1.0;\n\n      if (Tr < 0.002) { break; }\n    }\n\n    prevDens = densSmoothed;\n    prevMacroDens = densMacroSmoothed;\n    prevTsun = Tsun_cached;\n\n    t = min(t + stepLen, t1);\n    iter = iter + 1;\n  }\n\n  // compose\n  var newCol: vec4<f32>;\n  if (opt.writeRGB == 1u) {\n    newCol = vec4<f32>(rgb, 1.0 - Tr);\n  } else {\n    let a = 1.0 - Tr;\n    if (opt.outputChannel == 0u) { newCol = vec4<f32>(a, 0.0, 0.0, 1.0); }\n    else if (opt.outputChannel == 1u) { newCol = vec4<f32>(0.0, a, 0.0, 1.0); }\n    else if (opt.outputChannel == 2u) { newCol = vec4<f32>(0.0, 0.0, a, 1.0); }\n    else { newCol = vec4<f32>(0.0, 0.0, 0.0, a); }\n  }\n\n  // Preserve compute output as premultiplied volumetric radiance.\n  // The preview pass composites this over the procedural sky.\n  newCol = vec4<f32>(max(newCol.rgb, vec3<f32>(0.0)), clamp(newCol.a, 0.0, 1.0));\n\n  // TAA with variance clamp\n  let temporalActive = reproj.temporalBlend > 0.0001;\n  if (temporalActive) {\n    let fullRes = vec2<f32>(f32(reproj.fullWidth), f32(reproj.fullHeight));\n    let uv_full = (vec2<f32>(fullPixFromCurrent(pixI)) + 0.5) / fullRes;\n\n    var motion = vec2<f32>(0.0, 0.0);\n    var prevUV = uv_full;\n    if (reproj.enabled == 1u) {\n      motion = textureSampleLevel(motionTex, sampMotion, uv_full, 0.0).rg;\n      if (reproj.motionIsNormalized == 0u) { motion = motion / fullRes; }\n      prevUV = uv_full - motion;\n    }\n\n    if (prevUV.x < 0.0 || prevUV.y < 0.0 || prevUV.x > 1.0 || prevUV.y > 1.0) {\n      textureStore(outTex, pixI, frame.layerIndex, newCol);\n      store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);\n    } else {\n      let prevCol = textureSampleLevel(historyPrev, sampHistory, prevUV, frame.layerIndex, 0.0);\n      if (reproj.frameIndex == 0u || prevCol.a < 1e-5) {\n        textureStore(outTex, pixI, frame.layerIndex, newCol);\n        store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);\n      } else {\n        let motionPix = motion * fullRes;\n        let motionMag = length(motionPix);\n        let alphaDiff = abs(prevCol.a - newCol.a);\n        let rgbDiff = length(prevCol.rgb - newCol.rgb);\n\n        var stability = exp(-motionMag * 0.9) * exp(-alphaDiff * 6.0) * exp(-rgbDiff * 3.5);\n        let bodyStable = smoothstep(0.38, 0.95, min(prevCol.a, newCol.a)) * exp(-motionMag * 0.35) * exp(-alphaDiff * 3.5);\n        let speckleStable = bodyStable * exp(-motionMag * 1.8) * (1.0 - smoothstep(0.02, 0.16, rgbDiff));\n        let convFrames = min(f32(reproj.frameIndex), 4.0);\n        let convWarm = saturate((convFrames - 1.0) / 3.0);\n        let staticConv = exp(-motionMag * 2.7) * exp(-alphaDiff * 9.0) * exp(-rgbDiff * 6.5);\n        let stableBody = smoothstep(0.50, 0.98, bodyStable);\n        let stableSpeckle = smoothstep(0.35, 0.96, speckleStable);\n        var tb = clamp(reproj.temporalBlend * stability, 0.0, 0.985);\n        tb *= mix_f(1.0, TUNE.farTaaHistoryBoost, rayFarHistoryF);\n        tb = clamp(tb * mix_f(1.0, 1.34, bodyStable), 0.0, 0.993);\n        tb = max(tb, 0.76 * speckleStable);\n        let fastConvLo = mix_f(0.62, 0.76, stableBody);\n        let fastConvHi = mix_f(0.84, 0.94, max(stableBody, stableSpeckle));\n        let fastConvFloor = mix_f(fastConvLo, fastConvHi, convWarm) * staticConv;\n        tb = max(tb, fastConvFloor * mix_f(1.0, 1.08, rayFarHistoryF));\n        tb = max(tb, 0.72 * stableBody * convWarm);\n        tb = max(tb, 0.84 * stableSpeckle * convWarm);\n        tb = clamp(tb, 0.0, 0.996);\n\n        if (reproj.enabled == 1u && reproj.depthTest == 1u) {\n          let prevDepth = textureSampleLevel(depthPrev, sampDepth, prevUV, 0.0).r;\n          tb *= select(1.0 - saturate(reproj.depthTolerance), 0.25, prevDepth < 1e-6 || prevDepth > 1.0);\n        }\n\n        let relBase = mix_f(TUNE.taaRelMax, TUNE.taaRelMin, saturate(stability));\n        let relBody = mix_f(relBase, max(TUNE.taaRelMin * 0.60, 0.035), stableBody);\n        let rel = relBody * mix_f(1.0, 0.74, rayFarHistoryF);\n\n        let newClampedRGB0 = clamp_luma_to(newCol.rgb, prevCol.rgb, rel, TUNE.taaAbsEps);\n        let newClampedRGB = mix_v3(newClampedRGB0, prevCol.rgb, 0.18 * stableSpeckle + 0.10 * stableBody * convWarm);\n        let newClamped = vec4<f32>(newClampedRGB, mix_f(newCol.a, prevCol.a, 0.10 * stableBody * convWarm));\n\n        let blended = mix_v4(newClamped, prevCol, tb);\n        textureStore(outTex, pixI, frame.layerIndex, blended);\n        store_history_full_res_if_owner(pixI, frame.layerIndex, blended);\n      }\n    }\n  } else {\n    textureStore(outTex, pixI, frame.layerIndex, newCol);\n    store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);\n  }\n}\n';

  // tools/clouds/cloudsRender.wgsl
  var cloudsRender_default = "// cloudsRender.wgsl - preview: world-space camera + directional sun,\n// tone-map and composite the cloud layer over a procedural sky.\n// Uses explicit-LOD sampling so textureSample* calls are valid in\n// non-uniform control flow.\n\nconst PI : f32 = 3.141592653589793;\nconst SUN_UV_RADIUS : f32 = 0.018;\nconst SUN_GLOW_RADIUS : f32 = 0.075;\nconst SUN_EDGE_GLOW_RADIUS : f32 = 0.42;\n\n// ---------- I/O ----------\nstruct RenderParams {\n  layerIndex:u32,\n  renderQuality:u32,\n  _pad1:u32,\n  _pad2:u32,\n\n  // camera in world space\n  camPos:vec3<f32>, _p3:f32,\n  right:vec3<f32>,  _p4:f32,\n  up:vec3<f32>,     _p5:f32,\n  fwd:vec3<f32>,    _p6:f32,\n\n  // frustum + exposure\n  fovY:f32,\n  aspect:f32,\n  exposure:f32,\n  sunBloom:f32,\n\n  sunDir:vec3<f32>, _p7:f32,\n  sky:vec3<f32>,    _p8:f32,\n\n  gradeStyle:u32,\n  _p9:u32,\n  _p10:u32,\n  _p11:u32,\n\n  sunColorTint:vec3<f32>, _p12:f32,\n  lightTint:vec3<f32>, _p13:f32,\n  shadowTint:vec3<f32>, _p14:f32,\n  edgeTint:vec3<f32>, _p15:f32,\n};\n@group(0) @binding(0) var samp : sampler;\n@group(0) @binding(1) var tex  : texture_2d_array<f32>;\n@group(0) @binding(2) var<uniform> R : RenderParams;\n\nstruct VSOut { @builtin(position) pos:vec4<f32>, @location(0) uv:vec2<f32>, };\n\n@vertex\nfn vs_main(@builtin(vertex_index) vid:u32)->VSOut {\n  var p = array<vec2<f32>,6>(\n    vec2<f32>(-1.0,-1.0), vec2<f32>( 1.0,-1.0), vec2<f32>(-1.0, 1.0),\n    vec2<f32>(-1.0, 1.0), vec2<f32>( 1.0,-1.0), vec2<f32>( 1.0, 1.0)\n  );\n  var t = array<vec2<f32>,6>(\n    vec2<f32>(0.0,1.0), vec2<f32>(1.0,1.0), vec2<f32>(0.0,0.0),\n    vec2<f32>(0.0,0.0), vec2<f32>(1.0,1.0), vec2<f32>(1.0,0.0)\n  );\n  var o : VSOut;\n  o.pos = vec4<f32>(p[vid], 0.0, 1.0);\n  o.uv  = t[vid];\n  return o;\n}\n\n// ---------- helpers ----------\nfn toneMapFilmic(c:vec3<f32>)->vec3<f32> {\n  let a = 2.51;\n  let b = 0.03;\n  let c1 = 2.43;\n  let d = 0.59;\n  let e = 0.14;\n\n  let x = max(c, vec3<f32>(0.0));\n  return clamp((x * (a * x + b)) / (x * (c1 * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));\n}\n\nfn luma(c:vec3<f32>)->f32 {\n  return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));\n}\n\nfn applyStyleGrade(cIn:vec3<f32>, style:u32, cloudMask:f32)->vec3<f32> {\n  var c = clamp(cIn, vec3<f32>(0.0), vec3<f32>(1.0));\n  let lum = luma(c);\n  let hi = smoothstep(0.42, 0.96, lum);\n  let mid = smoothstep(0.10, 0.58, lum) * (1.0 - smoothstep(0.58, 0.90, lum));\n  let sh = 1.0 - smoothstep(0.16, 0.48, lum);\n  let gradeAmt = mix(0.24, 0.78, clamp(cloudMask, 0.0, 1.0));\n\n  var shadowTint = vec3<f32>(0.96, 0.96, 1.00);\n  var midTint = vec3<f32>(1.0, 1.0, 1.0);\n  var highTint = vec3<f32>(1.0, 1.0, 1.0);\n  var contrast = 1.0;\n  var saturation = 1.0;\n\n  if (style == 1u) {\n    shadowTint = vec3<f32>(0.84, 0.80, 0.98);\n    midTint = vec3<f32>(0.97, 0.92, 0.94);\n    highTint = vec3<f32>(1.08, 0.98, 0.92);\n    contrast = mix(1.03, 1.10, gradeAmt);\n    saturation = mix(1.01, 1.08, gradeAmt);\n  } else if (style == 2u) {\n    shadowTint = vec3<f32>(0.78, 0.74, 1.02);\n    midTint = vec3<f32>(0.94, 0.88, 0.98);\n    highTint = vec3<f32>(1.06, 0.94, 1.04);\n    contrast = mix(1.03, 1.10, gradeAmt);\n    saturation = mix(1.02, 1.10, gradeAmt);\n  } else if (style == 3u) {\n    shadowTint = vec3<f32>(0.84, 0.90, 1.02);\n    midTint = vec3<f32>(0.92, 0.96, 1.00);\n    highTint = vec3<f32>(1.02, 1.04, 1.06);\n    contrast = mix(1.01, 1.06, gradeAmt);\n    saturation = mix(1.00, 1.03, gradeAmt);\n  }\n\n  c = mix(c, c * highTint, (0.28 * hi + 0.10 * mid) * gradeAmt);\n  c = mix(c, c * midTint, 0.24 * mid * gradeAmt);\n  c = mix(c, c * shadowTint, (0.34 * sh + 0.10 * mid) * gradeAmt);\n\n  let pivot = vec3<f32>(0.50, 0.50, 0.50);\n  c = clamp((c - pivot) * contrast + pivot, vec3<f32>(0.0), vec3<f32>(1.0));\n\n  let gray = vec3<f32>(luma(c));\n  c = mix(gray, c, saturation);\n\n  if (style == 1u) {\n    c += (vec3<f32>(0.016, 0.006, 0.003) * hi + vec3<f32>(0.010, 0.006, 0.018) * sh) * gradeAmt;\n  } else if (style == 2u) {\n    c += (vec3<f32>(0.010, 0.004, 0.014) * hi + vec3<f32>(0.004, 0.002, 0.022) * sh) * gradeAmt;\n  }\n\n  return clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));\n}\n\nfn stableSunHintUV(uvSun: vec2<f32>) -> vec2<f32> {\n  return clamp(uvSun, vec2<f32>(-0.18, -0.18), vec2<f32>(1.18, 1.18));\n}\n\nfn stableSunProximity(uv: vec2<f32>, uvSun: vec2<f32>, towardSun: f32, fwdDot: f32) -> f32 {\n  let sunHint = stableSunHintUV(uvSun);\n  let screenNear = exp(-pow(distance(uv, sunHint) / 0.34, 2.0));\n  let angular = smoothstep(0.18, 0.985, towardSun);\n  let frontHemisphere = smoothstep(-0.10, 0.22, fwdDot);\n  let offscreenFloor = 0.28 * angular * frontHemisphere;\n  return max(screenNear * frontHemisphere, offscreenFloor);\n}\n\n// project a world-space direction onto the screen using camera basis + FOV\nfn projectDirToUV(dirWS:vec3<f32>)->vec2<f32> {\n  // unchanged\n  let sx = dot(dirWS, R.right);\n  let sy = dot(dirWS, R.up);\n  let sz = dot(dirWS, R.fwd);\n\n  let tanHalfY = tan(0.5 * R.fovY);\n  let tanHalfX = tanHalfY * max(R.aspect, 0.000001);\n\n  let invSz = 1.0 / max(sz, 0.000001);\n  let ndc = vec2<f32>((sx * invSz) / tanHalfX, (sy * invSz) / tanHalfY);\n\n  return vec2<f32>(0.5 + 0.5 * ndc.x, 0.5 - 0.5 * ndc.y);\n}\n\nfn rayDirFromUV(uv:vec2<f32>)->vec3<f32> {\n  let ndc = vec2<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);\n  let tanHalfY = tan(0.5 * R.fovY);\n  let tanHalfX = tanHalfY * max(R.aspect, 0.000001);\n  let dir = R.fwd + R.right * (ndc.x * tanHalfX) + R.up * (ndc.y * tanHalfY);\n  return normalize(dir);\n}\n\n// ---- faster alpha gather: fewer samples, lower LOD, and early-out ----\n// - Uses LOD = 1 to sample a smaller mip (cheaper/more cache-friendly).\n// - Uses 5 samples (center + 4 cardinal neighbors). You can reduce to 4 if needed.\n// - Caller should skip this when sun is far from pixel (d > some threshold) or when clouds are fully opaque/clear.\nfn alphaGatherFast(uv:vec2<f32>, layer:i32)->f32 {\n  // precomputed radius in uv space\n  let r = SUN_UV_RADIUS;\n  // quick 5-sample kernel (center + 4)\n  let k0 = vec2<f32>(0.0, 0.0);\n  let k1 = vec2<f32>( r, 0.0);\n  let k2 = vec2<f32>(-r, 0.0);\n  let k3 = vec2<f32>(0.0, r);\n  let k4 = vec2<f32>(0.0, -r);\n\n  // sample at a lower LOD (1.0) to reduce cost & aggregate over a coarser area\n  // note: textureSampleLevel returns a vec4; we only read .a\n  var sum = 0.0;\n  sum += clamp(textureSampleLevel(tex, samp, uv + k0, layer, 1.0).a, 0.0, 1.0);\n  sum += clamp(textureSampleLevel(tex, samp, uv + k1, layer, 1.0).a, 0.0, 1.0);\n  sum += clamp(textureSampleLevel(tex, samp, uv + k2, layer, 1.0).a, 0.0, 1.0);\n  sum += clamp(textureSampleLevel(tex, samp, uv + k3, layer, 1.0).a, 0.0, 1.0);\n  sum += clamp(textureSampleLevel(tex, samp, uv + k4, layer, 1.0).a, 0.0, 1.0);\n\n  return sum * 0.2; // divide by 5\n}\n\nfn alphaGradAt(uv:vec2<f32>, layer:i32)->vec2<f32> {\n  let dims = vec2<f32>(textureDimensions(tex, 0));\n  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));\n\n  let r1 = px * 1.5;\n  let r2 = px * 3.0;\n\n  let aL1 = textureSampleLevel(tex, samp, uv - vec2<f32>(r1.x, 0.0), layer, 0.0).a;\n  let aR1 = textureSampleLevel(tex, samp, uv + vec2<f32>(r1.x, 0.0), layer, 0.0).a;\n  let aD1 = textureSampleLevel(tex, samp, uv - vec2<f32>(0.0, r1.y), layer, 0.0).a;\n  let aU1 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, r1.y), layer, 0.0).a;\n\n  let aL2 = textureSampleLevel(tex, samp, uv - vec2<f32>(r2.x, 0.0), layer, 1.0).a;\n  let aR2 = textureSampleLevel(tex, samp, uv + vec2<f32>(r2.x, 0.0), layer, 1.0).a;\n  let aD2 = textureSampleLevel(tex, samp, uv - vec2<f32>(0.0, r2.y), layer, 1.0).a;\n  let aU2 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, r2.y), layer, 1.0).a;\n\n  let g1 = vec2<f32>(aR1 - aL1, aU1 - aD1);\n  let g2 = vec2<f32>(aR2 - aL2, aU2 - aD2);\n\n  return g1 * 0.72 + g2 * 0.28;\n}\n\nfn alphaGradLite(uv:vec2<f32>, layer:i32)->vec2<f32> {\n  let dims = vec2<f32>(textureDimensions(tex, 0));\n  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));\n  let r = px * 2.0;\n  let aL = textureSampleLevel(tex, samp, uv - vec2<f32>(r.x, 0.0), layer, 0.0).a;\n  let aR = textureSampleLevel(tex, samp, uv + vec2<f32>(r.x, 0.0), layer, 0.0).a;\n  let aD = textureSampleLevel(tex, samp, uv - vec2<f32>(0.0, r.y), layer, 0.0).a;\n  let aU = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, r.y), layer, 0.0).a;\n  return vec2<f32>(aR - aL, aU - aD);\n}\n\nfn alphaOccLite(uv:vec2<f32>, layer:i32)->f32 {\n  let dims = vec2<f32>(textureDimensions(tex, 0));\n  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));\n  let r = px * 3.0;\n  let c = textureSampleLevel(tex, samp, uv, layer, 1.0).a;\n  let e = textureSampleLevel(tex, samp, uv + vec2<f32>(r.x, 0.0), layer, 1.0).a;\n  let w = textureSampleLevel(tex, samp, uv - vec2<f32>(r.x, 0.0), layer, 1.0).a;\n  let n = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, r.y), layer, 1.0).a;\n  let so = textureSampleLevel(tex, samp, uv - vec2<f32>(0.0, r.y), layer, 1.0).a;\n  return clamp(c * 0.42 + (e + w + n + so) * 0.145, 0.0, 1.0);\n}\n\nfn alphaOpenTowardSoft(uv:vec2<f32>, dir:vec2<f32>, layer:i32)->f32 {\n  let dims = vec2<f32>(textureDimensions(tex, 0));\n  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));\n  let pix = max(px.x, px.y);\n  let lenDir = max(length(dir), 1e-5);\n  let d = dir / lenDir;\n\n  let a0 = textureSampleLevel(tex, samp, uv + d * pix * 5.0, layer, 1.0).a;\n  let a1 = textureSampleLevel(tex, samp, uv + d * pix * 11.0, layer, 2.0).a;\n  let a2 = textureSampleLevel(tex, samp, uv + d * pix * 22.0, layer, 3.0).a;\n  let a3 = textureSampleLevel(tex, samp, uv + d * pix * 40.0, layer, 3.0).a;\n\n  let blocking = clamp(max(max(a0, a1 * 0.92), max(a2 * 0.78, a3 * 0.62)), 0.0, 1.0);\n  let open = 1.0 - blocking;\n  return smoothstep(0.18, 0.86, open);\n}\n\nfn alphaReliefStats(uv:vec2<f32>, layer:i32)->vec2<f32> {\n  let dims = vec2<f32>(textureDimensions(tex, 0));\n  let px = 1.0 / max(dims, vec2<f32>(1.0, 1.0));\n\n  let r1 = px * 2.0;\n  let r2 = px * 4.0;\n\n  let c = textureSampleLevel(tex, samp, uv, layer, 0.0).a;\n\n  let n1 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0,  r1.y), layer, 0.0).a;\n  let s1 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, -r1.y), layer, 0.0).a;\n  let e1 = textureSampleLevel(tex, samp, uv + vec2<f32>( r1.x, 0.0), layer, 0.0).a;\n  let w1 = textureSampleLevel(tex, samp, uv + vec2<f32>(-r1.x, 0.0), layer, 0.0).a;\n\n  let n2 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0,  r2.y), layer, 1.0).a;\n  let s2 = textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, -r2.y), layer, 1.0).a;\n  let e2 = textureSampleLevel(tex, samp, uv + vec2<f32>( r2.x, 0.0), layer, 1.0).a;\n  let w2 = textureSampleLevel(tex, samp, uv + vec2<f32>(-r2.x, 0.0), layer, 1.0).a;\n\n  let mean1 = (n1 + s1 + e1 + w1) * 0.25;\n  let mean2 = (n2 + s2 + e2 + w2) * 0.25;\n  let mean = mix(mean1, mean2, 0.35);\n\n  let cavity = clamp(mean - c, 0.0, 1.0);\n  let ridge = clamp(c - mean, 0.0, 1.0);\n  return vec2<f32>(cavity, ridge);\n}\n\nfn silverEdgeBand(alpha: f32) -> f32 {\n  let enter = smoothstep(0.035, 0.180, alpha);\n  let leave = 1.0 - smoothstep(0.30, 0.62, alpha);\n  return enter * leave;\n}\n\nfn cloudCoreMask(alpha: f32, occ: f32, edge: f32) -> f32 {\n  let body = smoothstep(0.44, 0.92, alpha);\n  let dense = smoothstep(0.52, 0.96, occ);\n  return body * dense * (1.0 - edge);\n}\n\n@fragment\nfn fs_main(in:VSOut)->@location(0) vec4<f32> {\n  let layer = i32(R.layerIndex);\n  let texel = textureSampleLevel(tex, samp, in.uv, layer, 0.0);\n  let cloudRGB = texel.rgb;\n  let cloudA = clamp(texel.a, 0.0, 1.0);\n\n  let rayDir = rayDirFromUV(in.uv);\n  let sunDir = normalize(R.sunDir);\n  let uvSun = projectDirToUV(sunDir);\n\n  let v = in.uv.y;\n  let horizon = pow(clamp(1.0 - abs(v - 0.5) * 2.0, 0.0, 1.0), 1.25);\n  let lowSunRaw = 1.0 - clamp((sunDir.y + 0.08) / 0.82, 0.0, 1.0);\n  let lowSun = clamp(pow(lowSunRaw, 0.72) * 1.18, 0.0, 1.0);\n  let towardSunSky = clamp(dot(rayDir, sunDir), 0.0, 1.0);\n\n  let style = R.gradeStyle;\n  var zenithSky = mix(R.sky * 1.00 + vec3<f32>(0.012, 0.018, 0.032), vec3<f32>(0.58, 0.60, 0.82), lowSun * 0.22);\n  var horizonSky = mix(R.sky * 0.70 + vec3<f32>(0.050, 0.060, 0.080), vec3<f32>(0.88, 0.76, 0.82), lowSun * 0.26);\n  var sunWash = mix(vec3<f32>(1.0, 0.94, 0.88), vec3<f32>(1.0, 0.86, 0.90), lowSun);\n  var sunColor = mix(vec3<f32>(1.0, 0.92, 0.80), vec3<f32>(1.0, 0.86, 0.88), lowSun * 0.35);\n  var shadowCool = mix(vec3<f32>(0.92, 0.96, 1.0), vec3<f32>(0.88, 0.90, 0.99), lowSun * 0.30);\n  var edgeWarm = mix(vec3<f32>(1.0, 0.97, 0.92), vec3<f32>(1.0, 0.89, 0.91), lowSun * 0.40);\n  var litTintBase = vec3<f32>(1.0, 1.0, 1.0);\n  var shadowTintBase = vec3<f32>(0.98, 0.99, 1.0);\n\n  if (style == 1u) {\n    zenithSky = mix(R.sky * 0.90 + vec3<f32>(0.016, 0.014, 0.036), vec3<f32>(0.36, 0.28, 0.56), lowSun * 0.56);\n    horizonSky = mix(R.sky * 0.66 + vec3<f32>(0.070, 0.044, 0.082), vec3<f32>(1.12, 0.56, 0.48), lowSun * 0.92);\n    sunWash = mix(vec3<f32>(1.0, 0.94, 0.88), vec3<f32>(1.22, 0.54, 0.44), lowSun * 1.00);\n    sunColor = mix(vec3<f32>(1.0, 0.94, 0.86), vec3<f32>(1.22, 0.58, 0.42), lowSun * 1.00);\n    shadowCool = mix(vec3<f32>(0.92, 0.96, 1.0), vec3<f32>(0.74, 0.66, 0.90), lowSun * 1.00);\n    edgeWarm = mix(vec3<f32>(1.0, 0.97, 0.92), vec3<f32>(1.18, 0.76, 0.62), lowSun * 0.98);\n    litTintBase = mix(vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(1.18, 0.96, 0.86), lowSun * 0.96);\n    shadowTintBase = mix(vec3<f32>(0.98, 0.99, 1.0), vec3<f32>(0.60, 0.54, 0.76), lowSun * 1.00);\n  } else if (style == 2u) {\n    zenithSky = mix(R.sky * 0.88 + vec3<f32>(0.014, 0.012, 0.040), vec3<f32>(0.28, 0.22, 0.52), lowSun * 0.70);\n    horizonSky = mix(R.sky * 0.64 + vec3<f32>(0.042, 0.040, 0.076), vec3<f32>(0.84, 0.54, 0.82), lowSun * 0.74);\n    sunWash = mix(vec3<f32>(0.96, 0.92, 0.96), vec3<f32>(0.98, 0.70, 1.06), lowSun * 0.96);\n    sunColor = mix(vec3<f32>(0.98, 0.92, 0.96), vec3<f32>(1.00, 0.74, 1.08), lowSun * 0.90);\n    shadowCool = mix(vec3<f32>(0.88, 0.90, 0.99), vec3<f32>(0.66, 0.58, 0.96), lowSun * 1.00);\n    edgeWarm = mix(vec3<f32>(0.98, 0.94, 0.98), vec3<f32>(1.02, 0.80, 1.04), lowSun * 0.88);\n    litTintBase = mix(vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(1.08, 0.92, 1.04), lowSun * 0.82);\n    shadowTintBase = mix(vec3<f32>(0.96, 0.97, 1.0), vec3<f32>(0.52, 0.46, 0.88), lowSun * 1.00);\n  } else if (style == 3u) {\n    zenithSky = mix(R.sky * 0.94 + vec3<f32>(0.010, 0.016, 0.030), vec3<f32>(0.42, 0.48, 0.62), lowSun * 0.18);\n    horizonSky = mix(R.sky * 0.66 + vec3<f32>(0.030, 0.042, 0.060), vec3<f32>(0.62, 0.68, 0.78), lowSun * 0.16);\n    sunWash = mix(vec3<f32>(0.90, 0.94, 1.00), vec3<f32>(0.82, 0.88, 0.98), lowSun * 0.20);\n    sunColor = mix(vec3<f32>(0.94, 0.96, 1.00), vec3<f32>(0.88, 0.92, 0.98), lowSun * 0.18);\n    shadowCool = mix(vec3<f32>(0.90, 0.94, 1.0), vec3<f32>(0.78, 0.84, 0.96), lowSun * 0.42);\n    edgeWarm = mix(vec3<f32>(0.96, 0.97, 1.0), vec3<f32>(0.88, 0.90, 0.96), lowSun * 0.22);\n    litTintBase = vec3<f32>(0.98, 0.99, 1.0);\n    shadowTintBase = vec3<f32>(0.84, 0.89, 0.97);\n  }\n\n  sunColor *= R.sunColorTint;\n  sunWash *= mix(vec3<f32>(1.0, 1.0, 1.0), R.sunColorTint, 0.55);\n  shadowCool *= R.shadowTint;\n  edgeWarm *= R.edgeTint;\n  litTintBase *= R.lightTint;\n  shadowTintBase *= R.shadowTint;\n\n  var sky = mix(horizonSky, zenithSky, pow(clamp(v, 0.0, 1.0), 1.35));\n  sky += vec3<f32>(0.010, 0.014, 0.025) * horizon;\n  sky += sunWash * pow(towardSunSky, 5.0) * mix(0.030, 0.145, lowSun);\n\n  var sunGlow = 0.0;\n  var sunDisk = 0.0;\n  let fwdDot = dot(sunDir, R.fwd);\n\n  if (fwdDot > 0.0 && all(uvSun >= vec2<f32>(-0.25, -0.25)) && all(uvSun <= vec2<f32>(1.25, 1.25))) {\n    let d = distance(in.uv, uvSun);\n    if (d <= SUN_GLOW_RADIUS) {\n      var centerOcc = 0.0;\n      if (d <= SUN_UV_RADIUS * 3.0) {\n        centerOcc = alphaGatherFast(uvSun, layer);\n      } else {\n        centerOcc = textureSampleLevel(tex, samp, uvSun, layer, 2.0).a;\n      }\n\n      let localThrough = pow(max(1.0 - cloudA, 0.0), 0.9);\n      let centerThrough = pow(max(1.0 - clamp(centerOcc, 0.0, 1.0), 0.0), 1.35);\n      let diskGate = smoothstep(SUN_UV_RADIUS * 3.0, SUN_UV_RADIUS * 0.8, d);\n      let sunThrough = mix(localThrough, centerThrough, diskGate);\n\n      let core = smoothstep(SUN_UV_RADIUS, SUN_UV_RADIUS * 0.25, d);\n      let innerGlow = exp(-pow(d / (SUN_UV_RADIUS * 1.55), 2.0));\n      let outerGlow = exp(-pow(d / SUN_GLOW_RADIUS, 2.3));\n\n      sunDisk = core * sunThrough;\n      sunGlow = (innerGlow * (0.18 + 0.18 * R.sunBloom) + outerGlow * (0.03 + 0.15 * R.sunBloom)) * sunThrough;\n    }\n  }\n\n  if (cloudA < 0.003) {\n    let clearLinear = sky + sunColor * (1.18 * sunDisk + 0.22 * sunGlow);\n    let clearMapped = toneMapFilmic(clearLinear * max(R.exposure * 0.80, 0.0));\n    let clearStyled = applyStyleGrade(clearMapped, style, 0.0);\n    return vec4<f32>(pow(clearStyled, vec3<f32>(0.99, 0.995, 1.0)), 1.0);\n  }\n\n  var sunEdgeSilver = 0.0;\n  var bodyShadow = 0.0;\n  var cavity = 0.0;\n  var ridge = 0.0;\n\n  if (R.renderQuality >= 1u) {\n    let grad = alphaGradLite(in.uv, layer);\n    let gradLen = length(grad);\n    let towardSun = clamp(dot(rayDir, sunDir), 0.0, 1.0);\n    var facing = 0.0;\n    var upperExposure = 0.55;\n    if (gradLen > 1e-5) {\n      let gradDir = grad / gradLen;\n      let outward = -gradDir;\n      let toSunScreen = normalize(uvSun - in.uv + vec2<f32>(1e-5, 0.0));\n      facing = clamp(dot(outward, toSunScreen), 0.0, 1.0);\n      upperExposure = smoothstep(-0.22, 0.52, dot(outward, vec2<f32>(0.0, -1.0)));\n    }\n\n    let edge = smoothstep(0.012, 0.065, gradLen);\n    let edgeBand = silverEdgeBand(cloudA);\n    let occ = alphaOccLite(in.uv, layer);\n    let powder = 0.34 + 0.66 * pow(clamp(occ * (1.0 - occ) * 4.0, 0.0, 1.0), 0.72);\n    let nearSun = stableSunProximity(in.uv, uvSun, towardSun, fwdDot);\n    let forwardCone = smoothstep(0.55, 0.985, towardSun);\n    sunEdgeSilver = edge * edgeBand * mix(0.42, 1.0, facing) * powder * nearSun * forwardCone * mix(0.82, 1.0, upperExposure);\n\n    let coreMask = cloudCoreMask(cloudA, occ, edge);\n    let awayFromSun = 1.0 - towardSun;\n    bodyShadow = coreMask * mix(0.055, 0.18, awayFromSun) * mix(1.0, 0.72, facing);\n    ridge = edge * edgeBand * 0.55;\n    cavity = smoothstep(0.55, 0.96, occ) * smoothstep(0.35, 0.98, cloudA) * 0.22;\n  } else {\n    if (fwdDot > -0.10) {\n      let sunHint = stableSunHintUV(uvSun);\n      let dSun = distance(in.uv, sunHint);\n      let grad = alphaGradAt(in.uv, layer);\n      let gradLen = length(grad);\n      let towardSun = clamp(dot(rayDir, sunDir), 0.0, 1.0);\n\n      var facing = 0.0;\n      var openSoft = 1.0;\n      var upperExposure = 0.55;\n      if (gradLen > 1e-5 && dSun > 1e-5) {\n        let toSun = (uvSun - in.uv) / dSun;\n        let gradDir = grad / gradLen;\n        let outward = -gradDir;\n        facing = clamp(dot(outward, toSun), 0.0, 1.0);\n        openSoft = alphaOpenTowardSoft(in.uv, toSun, layer);\n        upperExposure = smoothstep(-0.22, 0.52, dot(outward, vec2<f32>(0.0, -1.0)));\n      }\n\n      let edge = smoothstep(0.016, 0.072, gradLen);\n      let edgeBand = silverEdgeBand(cloudA);\n      let occ = clamp(alphaGatherFast(in.uv, layer), 0.0, 1.0);\n      let powder = 0.34 + 0.66 * pow(clamp(occ * (1.0 - occ) * 4.0, 0.0, 1.0), 0.72);\n      let nearSun = stableSunProximity(in.uv, uvSun, towardSun, fwdDot);\n      let forwardCone = smoothstep(0.55, 0.985, towardSun);\n      let exposedGate = openSoft * mix(0.74, 1.0, upperExposure);\n\n      sunEdgeSilver = edge * edgeBand * facing * powder * nearSun * forwardCone * exposedGate;\n\n      let coreMask = cloudCoreMask(cloudA, occ, edge);\n      let sunFacing = smoothstep(0.38, 0.96, towardSun);\n      let silhouette = coreMask * sunFacing * nearSun * mix(0.10, 0.32, 1.0 - facing) * smoothstep(0.12, 0.92, 1.0 - openSoft);\n      let awayFromSun = 1.0 - towardSun;\n      bodyShadow = coreMask * mix(0.06, 0.20, awayFromSun) + silhouette;\n    }\n\n    let relief = alphaReliefStats(in.uv, layer);\n    cavity = smoothstep(0.015, 0.110, relief.x) * smoothstep(0.22, 0.92, cloudA);\n    ridge = smoothstep(0.010, 0.080, relief.y) * smoothstep(0.16, 0.86, cloudA);\n  }\n\n  let bodyMask = smoothstep(0.22, 0.92, cloudA);\n  let bodyCore = smoothstep(0.48, 0.96, cloudA) * (1.0 - smoothstep(0.010, 0.050, length(alphaGradLite(in.uv, layer))));\n  let cavityShadow = cavity * bodyMask * mix(0.08, 0.22, bodyShadow) * mix(1.0, 0.82, bodyCore);\n  let ridgeLift = ridge * (1.0 - cavity) * (0.030 + 0.060 * (1.0 - bodyShadow));\n  let finalShadow = clamp(bodyShadow + cavityShadow, 0.0, mix(0.72, 0.62, bodyCore));\n\n  var styleWarmBoost = 1.0;\n  var styleShadowBoost = 1.0;\n  var styleShadowColor = 0.16;\n  var styleRimBoost = 1.0;\n  var styleLightColorMix = 0.08;\n  var styleShadowDarkness = 0.10;\n  var styleShadowSaturation = 0.10;\n  var midTintBase = mix(litTintBase, shadowTintBase, 0.46);\n  var shadowAccent = vec3<f32>(0.66, 0.62, 0.86);\n  if (style == 1u) {\n    styleWarmBoost = 1.34;\n    styleShadowBoost = 1.34;\n    styleShadowColor = 0.60;\n    styleRimBoost = 1.28;\n    styleLightColorMix = 0.22;\n    styleShadowDarkness = 0.30;\n    styleShadowSaturation = 0.40;\n    midTintBase = vec3<f32>(0.82, 0.74, 0.78) * mix(vec3<f32>(1.0, 1.0, 1.0), R.lightTint, 0.22) * mix(vec3<f32>(1.0, 1.0, 1.0), R.shadowTint, 0.28);\n    shadowAccent = vec3<f32>(0.54, 0.50, 0.72);\n  } else if (style == 2u) {\n    styleWarmBoost = 1.16;\n    styleShadowBoost = 1.44;\n    styleShadowColor = 0.72;\n    styleRimBoost = 1.12;\n    styleLightColorMix = 0.18;\n    styleShadowDarkness = 0.38;\n    styleShadowSaturation = 0.48;\n    midTintBase = vec3<f32>(0.80, 0.68, 0.86) * mix(vec3<f32>(1.0, 1.0, 1.0), R.lightTint, 0.24) * mix(vec3<f32>(1.0, 1.0, 1.0), R.shadowTint, 0.26);\n    shadowAccent = vec3<f32>(0.44, 0.38, 0.76);\n  } else if (style == 3u) {\n    styleWarmBoost = 0.94;\n    styleShadowBoost = 1.18;\n    styleShadowColor = 0.34;\n    styleRimBoost = 0.92;\n    styleLightColorMix = 0.05;\n    styleShadowDarkness = 0.22;\n    styleShadowSaturation = 0.18;\n    midTintBase = vec3<f32>(0.82, 0.84, 0.90) * mix(vec3<f32>(1.0, 1.0, 1.0), R.lightTint, 0.16) * mix(vec3<f32>(1.0, 1.0, 1.0), R.shadowTint, 0.18);\n    shadowAccent = vec3<f32>(0.58, 0.62, 0.74);\n  }\n\n  let warmPenetrationBase = clamp(1.0 - finalShadow * 1.12 - cavity * 0.42 + sunEdgeSilver * 0.18 + ridgeLift * 0.10, 0.0, 1.0);\n  let warmPenetration = pow(warmPenetrationBase, 1.0 / styleWarmBoost);\n  let coolDepth = clamp(bodyCore * 0.34 + finalShadow * 0.88 + cavity * 0.52, 0.0, 1.0);\n  let shadowDepth = clamp(finalShadow * styleShadowBoost + cavity * (0.10 + 0.16 * styleShadowColor), 0.0, 1.0);\n  let lightMix = clamp(styleLightColorMix + 0.12 * (1.0 - warmPenetration), 0.0, 0.58);\n  let litCloudTint = mix(litTintBase, litTintBase * sunColor, lightMix);\n  let deepShadowTint = mix(shadowTintBase, shadowAccent * R.shadowTint, styleShadowSaturation);\n  let midCloudTint = mix(midTintBase, mix(litCloudTint, deepShadowTint, 0.58), 0.32 + 0.20 * styleShadowColor);\n\n  let rawLum = max(luma(cloudRGB), 1e-4);\n  let unpremulCloud = cloudRGB / max(cloudA, 0.10);\n  let structureLum = clamp(mix(rawLum * 1.12, luma(unpremulCloud), 0.68), 0.04, 1.35);\n  let detailTint = clamp(unpremulCloud / max(vec3<f32>(luma(unpremulCloud)), vec3<f32>(0.001)), vec3<f32>(0.72), vec3<f32>(1.28));\n\n  let lightBand = clamp(warmPenetration * (0.64 + 0.36 * bodyMask) + sunEdgeSilver * 0.34 + ridgeLift * 0.24, 0.0, 1.0);\n  let darkBand = clamp(shadowDepth * (0.78 + 0.22 * bodyCore) + coolDepth * 0.26, 0.0, 1.0);\n  let midBand = clamp(1.0 - max(lightBand * 0.88, 0.0) - max(darkBand * 0.82, 0.0), 0.0, 1.0);\n  let bandSum = max(lightBand + midBand + darkBand, 1e-4);\n  let rampTint = (litCloudTint * lightBand + midCloudTint * midBand + deepShadowTint * darkBand) / bandSum;\n  let shadowDarken = mix(1.0, 1.0 - styleShadowDarkness, clamp(darkBand * (0.72 + 0.28 * coolDepth), 0.0, 1.0));\n  let rampCloud = rampTint * structureLum * shadowDarken * detailTint;\n  let retainOriginal = cloudRGB * mix(vec3<f32>(0.24), vec3<f32>(0.34), bodyCore);\n\n  var cloudShaded = mix(retainOriginal, rampCloud, 0.76);\n  cloudShaded *= mix(vec3<f32>(1.0, 1.0, 1.0), shadowCool, clamp(darkBand * (0.18 + 0.40 * styleShadowColor) + cavity * 0.10 + coolDepth * (0.14 + 0.32 * styleShadowColor), 0.0, 1.0));\n  cloudShaded += sunColor * ridgeLift * cloudA * (1.04 + 0.44 * styleLightColorMix);\n  cloudShaded += edgeWarm * sunEdgeSilver * (0.56 + 0.48 * R.sunBloom) * styleRimBoost;\n  cloudShaded += sunColor * sunEdgeSilver * (0.08 + 0.12 * R.sunBloom + 0.08 * styleLightColorMix);\n  cloudShaded += midCloudTint * bodyCore * (0.030 + 0.040 * midBand);\n  cloudShaded += deepShadowTint * coolDepth * bodyCore * (0.030 + 0.070 * styleShadowColor);\n  cloudShaded += sunWash * sunGlow * (0.035 + 0.060 * R.sunBloom);\n\n  var linear = sky * (1.0 - cloudA) + cloudShaded;\n  linear += sunColor * (1.18 * sunDisk + (0.22 + 0.24 * R.sunBloom) * sunGlow + (1.20 + 0.18 * R.sunBloom) * sunEdgeSilver);\n\n  let mapped = toneMapFilmic(linear * max(R.exposure * 0.80, 0.0));\n  let styled = applyStyleGrade(mapped, style, clamp(cloudA * 1.15 + bodyCore * 0.35, 0.0, 1.0));\n  let graded = pow(styled, vec3<f32>(0.99, 0.995, 1.0));\n  return vec4<f32>(graded, 1.0);\n}\n";

  // tools/clouds/clouds.js
  var _has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
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
      this.bgl0 = null;
      this.bgl1 = null;
      this._samp2D = null;
      this._sampShape = null;
      this._sampDetail = null;
      this._sampBN = null;
      this._abOptions = new ArrayBuffer(32);
      this._dvOptions = new DataView(this._abOptions);
      this._abParams = new ArrayBuffer(80);
      this._dvParams = new DataView(this._abParams);
      this._abNTransform = new ArrayBuffer(112);
      this._dvNTransform = new DataView(this._abNTransform);
      this._abFrame = new ArrayBuffer(64);
      this._dvFrame = new DataView(this._abFrame);
      this._abLight = new ArrayBuffer(32);
      this._dvLight = new DataView(this._abLight);
      this._abView = new ArrayBuffer(128);
      this._dvView = new DataView(this._abView);
      this._abBox = new ArrayBuffer(32);
      this._dvBox = new DataView(this._abBox);
      this._abReproj = new ArrayBuffer(48);
      this._dvReproj = new DataView(this._abReproj);
      this._abPerf = new ArrayBuffer(16);
      this._dvPerf = new DataView(this._abPerf);
      this._abTuning = new ArrayBuffer(256);
      this._dvTuning = new DataView(this._abTuning);
      this._abRender = new ArrayBuffer(224);
      this._dvRender = new DataView(this._abRender);
      this._abUpsample = new ArrayBuffer(32);
      this._dvUpsample = new DataView(this._abUpsample);
      this.optionsBuffer = null;
      this.paramsBuffer = null;
      this.nTransformBuffer = null;
      this.dummyBuffer = null;
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
      this._render = null;
      this._renderSourceView = null;
      this._ctxCache = /* @__PURE__ */ new WeakMap();
      this._canvasStates = /* @__PURE__ */ new WeakMap();
      this._renderBgCache = /* @__PURE__ */ new WeakMap();
      this._renderBundleCache = /* @__PURE__ */ new WeakMap();
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
          silverIntensity: 12,
          silverExponent: 5,
          outScatterG: 0.08,
          inVsOut: 0.55,
          outScatterAmbientAmt: 0.12,
          ambientMinimum: 0.075,
          sunColor: [1, 0.96, 0.9],
          densityDivMin: 1e-3,
          silverDirectionBias: 0.9,
          silverHorizonBoost: 0.35
        },
        ntransform: {
          shapeOffsetWorld: [0, 0, 0],
          detailOffsetWorld: [0, 0, 0],
          shapeScale: 0.1,
          detailScale: 1,
          weatherScale: 1,
          shapeAxisScale: [1, 1, 1],
          detailAxisScale: [1, 1, 1],
          weatherOffsetWorld: [0, 0, 0],
          weatherAxisScale: [1, 1, 1]
        },
        reproj: {
          enabled: 0,
          subsample: 1,
          sampleOffset: 0,
          motionIsNormalized: 0,
          temporalBlend: 0.9,
          depthTest: 0,
          depthTolerance: 0,
          frameIndex: 0,
          fullWidth: 0,
          fullHeight: 0
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
          half: [1, 0.6, 1],
          uvScale: 1.5
        },
        tuning: {
          maxSteps: 256,
          minStep: 3e-3,
          maxStep: 0.16,
          sunSteps: 5,
          sunStride: 5,
          sunMinTr: 3e-3,
          phaseJitter: 1,
          stepJitter: 0.08,
          baseJitterFrac: 0.15,
          topJitterFrac: 0.1,
          lodBiasWeather: 1.5,
          aabbFaceOffset: 15e-4,
          weatherRejectGate: 0.99,
          weatherRejectMip: 1,
          emptySkipMult: 3.8,
          nearFluffDist: 60,
          nearStepScale: 0.3,
          nearLodBias: -1.5,
          nearDensityMult: 2.5,
          nearDensityRange: 45,
          lodBlendThreshold: 0.38,
          sunDensityGate: 25e-4,
          fflyRelClamp: 1.6,
          fflyAbsFloor: 0.85,
          taaRelMin: 0.22,
          taaRelMax: 1.1,
          taaAbsEps: 0.02,
          farStart: 0.65,
          farFull: 2.4,
          farLodPush: 1.1,
          farDetailAtten: 0.38,
          farStepMult: 2.25,
          bnFarScale: 0.28,
          farTaaHistoryBoost: 1.8,
          raySmoothDens: 0.42,
          raySmoothSun: 0.28
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
    _sum32(ab) {
      const u = new Uint32Array(ab);
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
        this.queue.writeBuffer(gpuBuf, 0, new Uint8Array(ab));
        this._lastSums.set(tag, { sum, len: ab.byteLength });
      }
    }
    _ensureComputeFormat(format) {
      const fmt = format || this.outFormat;
      if (fmt === this.outFormat && this.pipeline && this.bgl0) return;
      this.outFormat = fmt;
      const d = this.device;
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
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "read-only-storage" }
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
      this.pipeline = d.createComputePipeline({
        layout: d.createPipelineLayout({
          bindGroupLayouts: [this.bgl0, this.bgl1]
        }),
        compute: { module: this.module, entryPoint: "computeCloud" }
      });
      this._destroyDummyHistory();
      this._createDummyHistory();
      this._bg0Cache.clear();
      this._bg0Keys.length = 0;
      this._bg0Dirty = true;
      this._currentBg0 = null;
      this._ensureUpsamplePipeline(this.outFormat);
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
      this.module = d.createShaderModule({ code: clouds_default });
      this.bgl1 = d.createBindGroupLayout({
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
            binding: 12,
            visibility: GPUShaderStage.COMPUTE,
            sampler: { type: "filtering" }
          },
          {
            binding: 13,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "2d" }
          },
          {
            binding: 14,
            visibility: GPUShaderStage.COMPUTE,
            sampler: { type: "filtering" }
          },
          {
            binding: 15,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "2d" }
          },
          {
            binding: 16,
            visibility: GPUShaderStage.COMPUTE,
            sampler: { type: "filtering" }
          }
        ]
      });
      this._samp2D = d.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "repeat",
        addressModeV: "repeat"
      });
      this._sampShape = d.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "repeat",
        addressModeV: "repeat",
        addressModeW: "repeat"
      });
      this._sampDetail = d.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "repeat",
        addressModeV: "repeat",
        addressModeW: "repeat"
      });
      this._sampBN = d.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "repeat",
        addressModeV: "repeat"
      });
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
        new Uint8Array([128]),
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
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      this.paramsBuffer = d.createBuffer({
        size: 80,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      this.nTransformBuffer = d.createBuffer({
        size: 112,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.dummyBuffer = d.createBuffer({
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
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
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
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
        size: 48,
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
        size: 224,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this._upsampleParamsBuffer = d.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.queue.writeBuffer(this.dummyBuffer, 0, new Uint8Array(4));
    }
    // -------------------- UBO setters --------------------
    setOptions(opts = {}) {
      const s = this._state.options;
      if (_has(opts, "useCustomPos")) s.useCustomPos = !!opts.useCustomPos;
      if (_has(opts, "outputChannel"))
        s.outputChannel = opts.outputChannel >>> 0 || 0;
      if (_has(opts, "writeRGB")) s.writeRGB = !!opts.writeRGB;
      if (_has(opts, "r0")) s.r0 = +opts.r0 || 0;
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
      dv.setUint32(40, 0, true);
      dv.setUint32(44, 0, true);
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
        volumeLayers = 1
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
        0,
        0,
        0,
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
      putF(148, 0);
      putF(152, 0);
      putF(156, 0);
      for (let i = 160; i < this._abTuning.byteLength; i += 4)
        dv.setUint32(i, 0, true);
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
    createOutputTexture(width, height, layers = 1, format = "rgba16float") {
      this._ensureComputeFormat(format);
      if (this.outTexture && this.width === width && this.height === height && this.layers === layers && this.outFormat === format) {
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
        const curFW = this._dvReproj.getUint32(32, true) || 0;
        const curFH = this._dvReproj.getUint32(36, true) || 0;
        if (curFW !== this._reprojFullW >>> 0 || curFH !== this._reprojFullH >>> 0) {
          this._dvReproj.setUint32(32, this._reprojFullW >>> 0, true);
          this._dvReproj.setUint32(36, this._reprojFullH >>> 0, true);
          this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
          this._bg0Dirty = true;
        }
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
      this.outTexture = this.device.createTexture({
        size: [width, height, layers],
        format: this.outFormat,
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT
      });
      this.outView = this.outTexture.createView({
        dimension: "2d-array",
        arrayLayerCount: layers
      });
      this.width = width;
      this.height = height;
      this.layers = layers;
      this._reprojFullW = width;
      this._reprojFullH = height;
      this._dvReproj.setUint32(32, this._reprojFullW >>> 0, true);
      this._dvReproj.setUint32(36, this._reprojFullH >>> 0, true);
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
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
      this._bg0Dirty = true;
      this._bg1Dirty = true;
      this._renderBgCache = /* @__PURE__ */ new WeakMap();
      this._renderBundleCache = /* @__PURE__ */ new WeakMap();
      this._lastHadWork = false;
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
        this._getResId(this.dummyBuffer),
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
        this._getResId(this._samp2D),
        this._getResId(this.motionView || this._dummy2DMotionView),
        this._getResId(this._samp2D),
        this._getResId(this.depthPrevView || this._dummy2DDepthView),
        this._getResId(this._samp2D)
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
          { binding: 2, resource: { buffer: this.dummyBuffer } },
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
          { binding: 12, resource: this._samp2D },
          { binding: 13, resource: motionView2 },
          { binding: 14, resource: this._samp2D },
          { binding: 15, resource: depthView2 },
          { binding: 16, resource: this._samp2D }
        ]
      });
    }
    _makeBindGroups() {
      const k0 = this._buildBg0Key();
      if (this._bg0Cache.has(k0)) {
        this._currentBg0 = this._bg0Cache.get(k0);
        this._bg0Dirty = false;
      } else {
        const bg0 = this._createBg0ForKey();
        this._bg0Cache.set(k0, bg0);
        this._bg0Keys.push(k0);
        this._currentBg0 = bg0;
        this._bg0Dirty = false;
        while (this._bg0Keys.length > 16) {
          const oldest = this._bg0Keys.shift();
          this._bg0Cache.delete(oldest);
        }
      }
      const k1 = this._buildBg1Key();
      if (this._bg1Cache.has(k1)) {
        this._currentBg1 = this._bg1Cache.get(k1);
        this._bg1Dirty = false;
      } else {
        const bg1 = this._createBg1ForKey();
        this._bg1Cache.set(k1, bg1);
        this._bg1Keys.push(k1);
        this._currentBg1 = bg1;
        this._bg1Dirty = false;
        while (this._bg1Keys.length > 16) {
          const oldest = this._bg1Keys.shift();
          this._bg1Cache.delete(oldest);
        }
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
        return await this.dispatchRectNoCoarse({
          x: baseX,
          y: baseY,
          w: tw,
          h: th,
          wait
        });
      const cW = Math.max(1, Math.ceil(tw / cf));
      const cH = Math.max(1, Math.ceil(th / cf));
      this._ensureCoarseTexture(cW, cH, this.layers);
      const savedFullW = this._reprojFullW || this.width;
      const savedFullH = this._reprojFullH || this.height;
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
      if (curFW !== savedFullW >>> 0 || curFH !== savedFullH >>> 0) {
        this._dvReproj.setUint32(32, savedFullW >>> 0, true);
        this._dvReproj.setUint32(36, savedFullH >>> 0, true);
        this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
        this._bg0Dirty = true;
      }
      const enc = this.device.createCommandEncoder();
      this._encodeCurrentComputePass(enc);
      this.outTexture = savedOutTexture;
      this.outView = savedOutView;
      this.width = savedWidth;
      this.height = savedHeight;
      this.outFormat = savedFormat;
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
        const pass = enc.beginComputePass();
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this._currentBg0);
        pass.setBindGroup(1, this._currentBg1);
        pass.dispatchWorkgroups(this._wgX, this._wgY, 1);
        pass.end();
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
    _encodeCurrentComputePass(enc) {
      this._writeCommonComputeUniforms();
      this._makeBindGroups();
      const pass = enc.beginComputePass();
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this._currentBg0);
      pass.setBindGroup(1, this._currentBg1);
      pass.dispatchWorkgroups(this._wgX, this._wgY, 1);
      pass.end();
    }
    encodeDispatchPasses(enc, { coarseFactor = 1, skipUpsampleForPreview = false } = {}) {
      if (!enc) throw new Error("encodeDispatchPasses: command encoder required.");
      if (!this.outView)
        throw new Error("encodeDispatchPasses: createOutputTexture/setOutputView first.");
      const cf = Math.max(1, coarseFactor | 0);
      this._renderSourceView = this.outView;
      if (cf >= 2 && this.outTexture) {
        const cW = Math.max(1, Math.ceil(this.width / cf));
        const cH = Math.max(1, Math.ceil(this.height / cf));
        this._ensureCoarseTexture(cW, cH, this.layers);
        const savedFullW = this._reprojFullW || this.width;
        const savedFullH = this._reprojFullH || this.height;
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
        if (curFW !== savedFullW >>> 0 || curFH !== savedFullH >>> 0) {
          this._dvReproj.setUint32(32, savedFullW >>> 0, true);
          this._dvReproj.setUint32(36, savedFullH >>> 0, true);
          this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
        }
        this._encodeCurrentComputePass(enc);
        this.outTexture = savedOutTexture;
        this.outView = savedOutView;
        this.width = savedWidth;
        this.height = savedHeight;
        this.outFormat = savedFormat;
        var usedDirectPreview = false;
        if (skipUpsampleForPreview) {
          this._renderSourceView = this._coarseView;
          usedDirectPreview = true;
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
          directPreview: usedDirectPreview,
          previewView: this._renderSourceView,
          restoreAfterSubmit: () => {
            this.setFrame({
              fullWidth: savedWidth,
              fullHeight: savedHeight,
              tileWidth: savedWidth,
              tileHeight: savedHeight,
              originX: 0,
              originY: 0,
              originZ: 0,
              layerIndex: savedLayer,
              originXf: 0,
              originYf: 0
            });
          }
        };
      }
      this._encodeCurrentComputePass(enc);
      this._lastHadWork = true;
      return { coarseFactor: 1, restoreAfterSubmit: null };
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
        let c = textureSampleLevel(srcTex, samp, uv, i32(P.layer), 0.0);

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
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      this._upsample = { pipe, bgl, samp, format: fmt, bgCache: /* @__PURE__ */ new Map() };
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
        new Uint8Array(this._abUpsample)
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
    async _upsampleCoarseToOut({
      srcW,
      srcH,
      dstX,
      dstY,
      dstW,
      dstH,
      wait = false
    } = {}) {
      const prepared = this._prepareUpsamplePass({ srcW, srcH, dstX, dstY, dstW, dstH });
      if (!prepared) return;
      const enc = this.device.createCommandEncoder();
      this._encodeUpsamplePass(enc, prepared);
      this.queue.submit([enc.finish()]);
      if (wait && typeof this.queue.onSubmittedWorkDone === "function")
        await this.queue.onSubmittedWorkDone();
    }
    // -------------------- preview render --------------------
    _ensureRenderPipeline(format = "bgra8unorm") {
      if (this._render && this._render.format === format) return this._render;
      const mod = this.device.createShaderModule({ code: cloudsRender_default });
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
      const pipe = this.device.createRenderPipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
        vertex: { module: mod, entryPoint: "vs_main" },
        fragment: { module: mod, entryPoint: "fs_main", targets: [{ format }] },
        primitive: { topology: "triangle-list" }
      });
      const samp = this.device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      this._render = { pipe, bgl, samp, format };
      return this._render;
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
            resource: { buffer: this.renderParams, offset: 0, size: 224 }
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
      const exposure = opts.exposure ?? 1.2;
      const sunBloom = opts.sunBloom ?? 0;
      const skyColor = opts.skyColor ?? [0.55, 0.7, 0.95];
      const gradeStyle = (opts.gradeStyle ?? 0) >>> 0;
      const sunColorTint = opts.sunColorTint ?? [1, 1, 1];
      const lightTint = opts.lightTint ?? [1, 1, 1];
      const shadowTint = opts.shadowTint ?? [1, 1, 1];
      const edgeTint = opts.edgeTint ?? [1, 1, 1];
      const rad = (d) => d * Math.PI / 180;
      const cross2 = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
      const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const len = (a) => Math.hypot(a[0], a[1], a[2]) || 1;
      const norm2 = (a) => {
        const L = len(a);
        return [a[0] / L, a[1] / L, a[2] / L];
      };
      const wv3 = (ofs, v) => {
        dv.setFloat32(ofs, v[0], true);
        dv.setFloat32(ofs + 4, v[1], true);
        dv.setFloat32(ofs + 8, v[2], true);
        dv.setFloat32(ofs + 12, 0, true);
      };
      let camPos, right, up, fwd, fovYRad, aspect, sunDir;
      if (opts.cam && opts.cam.camPos && opts.cam.right && opts.cam.up && opts.cam.fwd) {
        camPos = opts.cam.camPos;
        right = opts.cam.right;
        up = opts.cam.up;
        fwd = opts.cam.fwd;
        fovYRad = (opts.cam.fovYDeg ?? 60) * Math.PI / 180;
        aspect = opts.cam.aspect ?? 1;
        sunDir = opts.sunDir ?? [0, 1, 0];
      } else {
        const yaw = rad(opts.yawDeg ?? 0);
        const pitch = rad(opts.pitchDeg ?? 0);
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        fwd = norm2([sy * cp, sp, cy * cp]);
        const upRef = Math.abs(dot2(fwd, [0, 1, 0])) > 0.999 ? [0, 0, 1] : [0, 1, 0];
        right = norm2(cross2(upRef, fwd));
        up = cross2(fwd, right);
        const zoom = opts.zoom ?? 3;
        camPos = [-fwd[0] * zoom, -fwd[1] * zoom, -fwd[2] * zoom];
        fovYRad = rad(opts.fovYDeg ?? 60);
        aspect = opts.aspect ?? 1;
        const sAz = rad(opts.sunAzimuthDeg ?? 45);
        const sEl = rad(opts.sunElevationDeg ?? 20);
        const cel = Math.cos(sEl);
        sunDir = norm2([cel * Math.sin(sAz), Math.sin(sEl), cel * Math.cos(sAz)]);
      }
      const renderQuality = Math.max(0, Math.min(2, opts.renderQuality ?? 1)) >>> 0;
      dv.setUint32(0, layerIndex, true);
      dv.setUint32(4, renderQuality, true);
      dv.setUint32(8, 0, true);
      dv.setUint32(12, 0, true);
      wv3(16, camPos);
      wv3(32, right);
      wv3(48, up);
      wv3(64, fwd);
      dv.setFloat32(80, fovYRad, true);
      dv.setFloat32(84, aspect, true);
      dv.setFloat32(88, exposure, true);
      dv.setFloat32(92, sunBloom, true);
      wv3(96, sunDir);
      wv3(112, skyColor);
      dv.setUint32(128, gradeStyle, true);
      dv.setUint32(132, 0, true);
      dv.setUint32(136, 0, true);
      dv.setUint32(140, 0, true);
      wv3(144, sunColorTint);
      wv3(160, lightTint);
      wv3(176, shadowTint);
      wv3(192, edgeTint);
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
  var DBG_W = 1;
  var DBG_H = 1;
  var SHAPE_SIZE = 128;
  var DETAIL_SIZE = 32;
  var WEATHER_W = 512;
  var WEATHER_H = 512;
  var BN_W = 256;
  var BN_H = 256;
  var noise = {
    weather: { arrayView: null, dirty: false, gCleared: false, bCleared: false },
    blue: { arrayView: null, dirty: false },
    shape128: { view3D: null, size: 128, dirty: false },
    detail32: { view3D: null, size: 32, dirty: false }
  };
  var currentSlice = 0;
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
  var lastAppliedTuningVersion = -1;
  var loopEnabled = false;
  var loopRunning = false;
  var lastRunPayload = null;
  var emaSubmitFps = null;
  var emaGpuFps = null;
  var shapeOffsetWorld = [0, 0, 0];
  var detailOffsetWorld = [0, 0, 0];
  var weatherOffsetWorld = [0, 0, 0];
  var shapeVel = [0.2, 0, 0];
  var detailVel = [-0.02, 0, 0];
  var weatherVel = [0, 0, 0];
  var shapeScale = 0.1;
  var detailScale = 1;
  var weatherScale = 1;
  var shapeAxisScale = [1, 1, 1];
  var detailAxisScale = [1, 1, 1];
  var weatherAxisScale = [1, 1, 1];
  var renderBundleCache = /* @__PURE__ */ new Map();
  var log = (...a) => postMessage({ type: "log", data: a });
  var LOOP_TARGET_MS = 1e3 / 60;
  var LOOP_BACKPRESSURE_EVERY = 3;
  var FRAME_LOG_EVERY = 60;
  var CAMERA_RESET_FRAMES = 1;
  var submittedFrameCount = 0;
  var completedFrameCount = 0;
  var lastFenceTime = 0;
  var framesSinceFence = 0;
  var lastViewSignature = null;
  var reprojResetFrames = 0;
  var lastGpuFrameMs = 0;
  async function ensureDevice() {
    if (device) return;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("No suitable GPU adapter (worker)");
    const max = adapter.limits.maxBufferSize;
    const wantMaxBufferSize = Math.min(max, 1024 * 1024 * 1024);
    device = await adapter.requestDevice({
      requiredLimits: {
        maxBufferSize: wantMaxBufferSize
      }
    });
    queue = device.queue;
    nb = new NoiseComputeBuilder(device, queue);
    cb = new CloudComputeBuilder(device, queue);
    nb.initBlitRender?.();
    try {
      nb.buildPermTable(Date.now());
    } catch (e) {
      console.warn("nb.buildPermTable initial failed", e);
    }
    try {
      cb.setTuning?.();
    } catch (e) {
      console.warn("Initial cb.setTuning failed", e);
    }
  }
  function configureMainContext() {
    if (!canvasMain) return;
    ctxMain = canvasMain.getContext("webgpu");
    if (!ctxMain) throw new Error("Failed to get webgpu context for main canvas");
    const fmt = cb?._ensureRenderPipeline?.("bgra8unorm")?.format ?? "bgra8unorm";
    ctxMain.configure({
      device,
      format: fmt,
      alphaMode: "opaque",
      size: [MAIN_W, MAIN_H]
    });
    return ctxMain;
  }
  function renderDebugSlices() {
    if (!nb) return;
    const s = Math.max(0, Math.min(SHAPE_SIZE - 1, currentSlice | 0));
    const d = Math.max(0, Math.min(DETAIL_SIZE - 1, Math.floor(s * DETAIL_SIZE / SHAPE_SIZE)));
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
  function maybeApplySeedToPermTable(params) {
    if (!params) return;
    const seedVal = params.seed;
    if (seedVal === void 0 || seedVal === null) return;
    const s = typeof seedVal === "string" ? Number(seedVal) || 0 : Number(seedVal) || 0;
    if (!Number.isFinite(s) || s === 0) return;
    try {
      nb.buildPermTable?.(s);
    } catch (e) {
      console.warn("buildPermTable(seed) failed", e);
    }
  }
  function isEntry4D(ep) {
    return typeof ep === "string" && /4D/.test(ep);
  }
  function getEntrySet() {
    const eps = Array.isArray(nb?.entryPoints) ? nb.entryPoints : [];
    return new Set(eps.filter((x) => typeof x === "string" && x.length));
  }
  function sanitizeEntry(entry, fallback, opts = {}) {
    const { require4D = false } = opts;
    const set = getEntrySet();
    const s = typeof entry === "string" ? entry : "";
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
  async function bakeWeather2D(weatherParams = {}, force = false, billowParams = {}, weatherBParams = null) {
    if (noise.weather.arrayView && !force && !noise.weather.dirty) {
      renderWeatherDebug();
      noise.weather.dirty = false;
      return { baseMs: 0, gMs: 0, bMs: 0, totalMs: 0 };
    }
    const T0 = performance.now();
    const WEATHER_DROP = /* @__PURE__ */ new Set(["mode"]);
    const baseMode = sanitizeEntry(weatherParams.mode, "computeFBM", { require4D: false });
    const baseParamsRaw = stripKeys(weatherParams, WEATHER_DROP);
    const baseParams = withToroidalFromMode(baseParamsRaw, baseMode);
    maybeApplySeedToPermTable(baseParams);
    const t0 = performance.now();
    const baseView = await nb.computeToTexture(WEATHER_W, WEATHER_H, baseParams, {
      noiseChoices: ["clearTexture", baseMode],
      outputChannel: 1,
      textureKey: "weather2d",
      viewDimension: "2d-array"
    });
    const baseMs = performance.now() - t0;
    const enabledG = !!(billowParams && billowParams.enabled === true);
    let gMs = 0;
    if (enabledG) {
      const G_DROP = /* @__PURE__ */ new Set(["mode", "enabled"]);
      const gMode = sanitizeEntry(billowParams.mode, "computeBillow", { require4D: false });
      const gParamsRaw = stripKeys(billowParams, G_DROP);
      const gParams = withToroidalFromMode(gParamsRaw, gMode);
      maybeApplySeedToPermTable(gParams);
      const tg0 = performance.now();
      await nb.computeToTexture(WEATHER_W, WEATHER_H, gParams, {
        noiseChoices: ["clearTexture", gMode],
        outputChannel: 2,
        textureKey: "weather2d",
        viewDimension: "2d-array"
      });
      gMs = performance.now() - tg0;
      noise.weather.gCleared = false;
    } else if (!noise.weather.gCleared) {
      const tc0 = performance.now();
      await nb.computeToTexture(
        WEATHER_W,
        WEATHER_H,
        { zoom: 1 },
        {
          noiseChoices: ["clearTexture"],
          outputChannel: 2,
          textureKey: "weather2d",
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
      await nb.computeToTexture(WEATHER_W, WEATHER_H, bParams, {
        noiseChoices: ["clearTexture", bMode],
        outputChannel: 3,
        textureKey: "weather2d",
        viewDimension: "2d-array"
      });
      bMs = performance.now() - tb0;
      noise.weather.bCleared = false;
    } else if (!noise.weather.bCleared) {
      const tc0 = performance.now();
      await nb.computeToTexture(
        WEATHER_W,
        WEATHER_H,
        { zoom: 1 },
        {
          noiseChoices: ["clearTexture"],
          outputChannel: 3,
          textureKey: "weather2d",
          viewDimension: "2d-array"
        }
      );
      noise.weather.bCleared = true;
      bMs = performance.now() - tc0;
    }
    noise.weather.arrayView = (typeof nb.get2DView === "function" ? nb.get2DView("weather2d", { dimension: "2d-array" }) : baseView) || baseView;
    noise.weather.dirty = false;
    renderWeatherDebug();
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
    return { baseMs, gMs, bMs, totalMs };
  }
  async function bakeBlue2D(blueParams = {}, force = false) {
    maybeApplySeedToPermTable(blueParams);
    if (noise.blue.arrayView && !force && !noise.blue.dirty) {
      noise.blue.dirty = false;
      if (dbg.blue) {
        nb.renderTextureToCanvas(noise.blue.arrayView, dbg.blue, {
          preserveCanvasSize: true,
          clear: true,
          width: DBG_W,
          height: DBG_H
        });
      }
      return { blueMs: 0, totalMs: 0 };
    }
    const T0 = performance.now();
    const t0 = performance.now();
    const arrView = await nb.computeToTexture(BN_W, BN_H, blueParams, {
      noiseChoices: ["clearTexture", "computeBlueNoise"],
      outputChannel: 0,
      textureKey: "blue2d"
    });
    const blueMs = performance.now() - t0;
    noise.blue.arrayView = (typeof nb.get2DView === "function" ? nb.get2DView("blue2d") : arrView) || arrView;
    noise.blue.dirty = false;
    if (dbg.blue) {
      nb.renderTextureToCanvas(arrView, dbg.blue, {
        preserveCanvasSize: true,
        clear: true,
        width: DBG_W,
        height: DBG_H
      });
    }
    const totalMs = performance.now() - T0;
    log("[BENCH] blue noise(ms):", blueMs.toFixed(2), " total(ms):", totalMs.toFixed(2));
    return { blueMs, totalMs };
  }
  async function bakeShape128(shapeParams = {}, force = false) {
    maybeApplySeedToPermTable(shapeParams);
    if (noise.shape128.view3D && !force && !noise.shape128.dirty) {
      noise.shape128.dirty = false;
      if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
      renderDebugSlices();
      return { baseMs: 0, bandsMs: [0, 0, 0], totalMs: 0 };
    }
    const T0 = performance.now();
    const drop = /* @__PURE__ */ new Set(["baseModeA", "baseModeB", "bandMode2", "bandMode3", "bandMode4"]);
    const baseParamsRaw = stripKeys(shapeParams, drop);
    const baseParams = { ...baseParamsRaw, toroidal: 1, band: "base" };
    const baseModeA = sanitizeEntry(shapeParams.baseModeA, "computePerlin4D", { require4D: true });
    const baseModeB = sanitizeEntry(shapeParams.baseModeB, "computeAntiWorley4D", { require4D: true });
    const baseChoices = ["clearTexture", baseModeA];
    if (baseModeB && baseModeB !== baseModeA) baseChoices.push(baseModeB);
    const t0 = performance.now();
    await nb.computeToTexture3D(SHAPE_SIZE, SHAPE_SIZE, SHAPE_SIZE, baseParams, {
      noiseChoices: baseChoices,
      outputChannel: 1,
      id: "shape128"
    });
    const baseMs = performance.now() - t0;
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
        SHAPE_SIZE,
        SHAPE_SIZE,
        SHAPE_SIZE,
        { ...baseParamsRaw, zoom: b.zm, toroidal: 1 },
        {
          noiseChoices: ["clearTexture", b.mode],
          outputChannel: b.ch,
          id: "shape128"
        }
      );
      bandsMs.push(performance.now() - tb0);
    }
    noise.shape128.view3D = nb.get3DView("shape128");
    noise.shape128.dirty = false;
    if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
    renderDebugSlices();
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
    return { baseMs, bandsMs, totalMs };
  }
  async function bakeDetail32(detailParams = {}, force = false) {
    maybeApplySeedToPermTable(detailParams);
    if (noise.detail32.view3D && !force && !noise.detail32.dirty) {
      noise.detail32.dirty = false;
      if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
      renderDebugSlices();
      return { bandsMs: [0, 0, 0], totalMs: 0 };
    }
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
        DETAIL_SIZE,
        DETAIL_SIZE,
        DETAIL_SIZE,
        { ...baseParamsRaw, zoom: b.zm, toroidal: 1 },
        {
          noiseChoices: ["clearTexture", b.mode],
          outputChannel: b.ch,
          id: "detail32"
        }
      );
      bandsMs.push(performance.now() - tb0);
    }
    noise.detail32.view3D = nb.get3DView("detail32");
    noise.detail32.dirty = false;
    if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
    renderDebugSlices();
    const totalMs = performance.now() - T0;
    log(
      "[BENCH] detail bands(ms):",
      bandsMs.map((x) => x.toFixed(2)).join(", "),
      " total(ms):",
      totalMs.toFixed(2),
      " modes:",
      `${m1},${m2},${m3}`
    );
    return { bandsMs, totalMs };
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
  function pushTransformsToCloudBuilder() {
    if (!cb) return;
    const t = {
      shapeOffsetWorld,
      detailOffsetWorld,
      weatherOffsetWorld,
      shapeScale,
      detailScale,
      weatherScale,
      shapeAxisScale,
      detailAxisScale,
      weatherAxisScale
    };
    if (typeof cb.setNoiseTransforms === "function") cb.setNoiseTransforms(t);
    else if (typeof cb.setTileScaling === "function") cb.setTileScaling(t);
    else cb.noiseTransforms = t;
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
      shapeVel: shapeVel.slice(0, 3),
      detailVel: detailVel.slice(0, 3),
      weatherVel: weatherVel.slice(0, 3)
    };
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
  function applyWorkerTuning() {
    if (!workerTuning) return false;
    if (workerTuningVersion === lastAppliedTuningVersion) return false;
    try {
      if (cb && typeof cb.setTuning === "function") {
        cb.setTuning(Object.assign({}, workerTuning));
        lastAppliedTuningVersion = workerTuningVersion;
        if (typeof workerTuning.lodBiasWeather === "number" && typeof cb?.setPerfParams === "function") {
          cb.setPerfParams({
            lodBiasMul: workerTuning.lodBiasWeather,
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
  function makeViewSignature(preview, w, h) {
    const cam = preview?.cam || {};
    const sun = preview?.sun || {};
    return [
      roundSig(cam.x),
      roundSig(cam.y),
      roundSig(cam.z),
      roundSig(cam.yawDeg),
      roundSig(cam.pitchDeg),
      roundSig(cam.fovYDeg),
      roundSig(sun.azDeg),
      roundSig(sun.elDeg),
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
      frameIndex: 0
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
    logFrame = false
  } = {}) {
    await ensureDevice();
    try {
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
        reproj,
        perf,
        motionImage,
        depthImage,
        coarseFactor,
        tuning,
        waitForGpu,
        logFrame
      };
    } catch {
    }
    if (tuning && typeof tuning === "object") mergeTuningPatch(tuning);
    applyWorkerTuning();
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
    const cameraChanged = updateViewInvalidation(preview);
    if (reproj) workerReproj = normalizeReproj(reproj);
    if (perf) workerPerf = perf;
    const hasTemporalHistory = !!(workerReproj && workerReproj.temporalBlend > 1e-4);
    if (cameraChanged && hasTemporalHistory) invalidateReprojectionHistory();
    if (!noise.weather.arrayView) await bakeWeather2D(weatherParams, true, billowParams, weatherBParams);
    if (!noise.blue.arrayView) await bakeBlue2D({}, true);
    if (!noise.shape128.view3D) await bakeShape128(shapeParams, true);
    if (!noise.detail32.view3D) await bakeDetail32(detailParams, true);
    cb.setInputMaps({
      weatherView: noise.weather.arrayView,
      blueView: noise.blue.arrayView,
      shape3DView: noise.shape128.view3D,
      detail3DView: noise.detail32.view3D
    });
    const useReproj = !!(workerReproj && workerReproj.enabled);
    const useTemporalHistory = !!(workerReproj && workerReproj.temporalBlend > 1e-4);
    const resetReprojThisFrame = useTemporalHistory && reprojResetFrames > 0;
    let effectiveReproj = workerReproj;
    let effectiveCoarseFactor = Math.max(1, coarseFactor | 0);
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
          if (workerReproj) {
            workerReproj.frameIndex = effectiveReproj.frameIndex >>> 0;
            workerReproj.sampleOffset = effectiveReproj.sampleOffset >>> 0;
          }
        }
      }
    }
    if (useReproj) {
      if (!workerReproj && reproj) workerReproj = normalizeReproj(reproj);
      if (!effectiveReproj) effectiveReproj = workerReproj;
      if (motionImage) {
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
      if (depthImage) {
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
      cb.createOutputTexture(MAIN_W, MAIN_H, 1);
      ensureHistoryTextures(cb.width || MAIN_W, cb.height || MAIN_H, cb.layers || 1);
      historyOutView = historyUsesAasOut ? historyViewA : historyViewB;
      cb.setInputMaps({
        motionView: motionView || void 0,
        depthPrevView: depthView || void 0,
        historyPrevView: historyPrevView || void 0
      });
      cb.setHistoryOutView(historyOutView);
      if (workerPerf) cb.setPerfParams(workerPerf);
      if (effectiveReproj) cb.setReprojSettings(effectiveReproj);
    } else {
      cb.setInputMaps({
        motionView: null,
        depthPrevView: null,
        historyPrevView: null
      });
      cb.setHistoryOutView(null);
    }
    cb.setBox({ center: [0, 0, 0], half: [1, 0.3, 1], uvScale: 1 });
    cb.setParams(cloudParams || {});
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
    cb.setViewFromCamera({
      camPos: [preview?.cam?.x || 0, preview?.cam?.y || 0, preview?.cam?.z || 0],
      right,
      up,
      fwd,
      fovYDeg: preview?.cam?.fovYDeg || 60,
      aspect,
      planetRadius: 0,
      cloudBottom: -1,
      cloudTop: 1,
      worldToUV: 1,
      stepBase: 0.02,
      stepInc: 0.04,
      volumeLayers: 1
    });
    cb.setLight({
      sunDir,
      camPos: [preview?.cam?.x || 0, preview?.cam?.y || 0, preview?.cam?.z || 0]
    });
    cb.setOptions({ writeRGB: true, outputChannel: 0, debugForceFog: 0 });
    if (!useReproj) cb.createOutputTexture(MAIN_W, MAIN_H, 1);
    const shouldWaitForGpu = !!waitForGpu;
    const tAll0 = performance.now();
    if (shouldWaitForGpu && typeof queue.onSubmittedWorkDone === "function") {
      await queue.onSubmittedWorkDone();
    }
    const cf = effectiveCoarseFactor;
    const enc = device.createCommandEncoder();
    const tC0 = performance.now();
    const encodedDispatch = typeof cb.encodeDispatchPasses === "function" ? cb.encodeDispatchPasses(enc, { coarseFactor: cf, skipUpsampleForPreview: true }) : null;
    if (!encodedDispatch) {
      throw new Error("CloudComputeBuilder.encodeDispatchPasses is required for fused frame submission.");
    }
    const tC1 = performance.now();
    const { pipe, bgl, samp, format } = cb._ensureRenderPipeline("bgra8unorm");
    if (!ctxMain) configureMainContext();
    cb._writeRenderUniforms({
      layerIndex: Math.max(0, Math.min((cb?.layers || 1) - 1, preview?.layer || 0)),
      cam: {
        camPos: [preview?.cam?.x || 0, preview?.cam?.y || 0, preview?.cam?.z || 0],
        right,
        up,
        fwd,
        fovYDeg: preview?.cam?.fovYDeg || 60,
        aspect
      },
      sunDir,
      exposure: preview?.exposure || 1,
      skyColor: preview?.sky || [0.5, 0.6, 0.8],
      sunBloom: preview?.sun?.bloom || 0,
      renderQuality: preview?.renderQuality ?? 1,
      gradeStyle: preview?.gradeStyle ?? 1,
      sunColorTint: preview?.sunTint || [1, 1, 1],
      lightTint: preview?.cloudLitTint || [1, 1, 1],
      shadowTint: preview?.cloudShadowTint || [1, 1, 1],
      edgeTint: preview?.edgeTint || [1, 1, 1]
    });
    const tR0 = performance.now();
    const { bundle } = getOrCreateRenderBundle(pipe, bgl, samp, format);
    const tex = ctxMain.getCurrentTexture();
    const pass = enc.beginRenderPass({
      colorAttachments: [
        {
          view: tex.createView(),
          loadOp: "clear",
          clearValue: {
            r: preview?.sky?.[0] ?? 0.5,
            g: preview?.sky?.[1] ?? 0.6,
            b: preview?.sky?.[2] ?? 0.8,
            a: 1
          },
          storeOp: "store"
        }
      ]
    });
    pass.executeBundles([bundle]);
    pass.end();
    const tSubmit0 = performance.now();
    queue.submit([enc.finish()]);
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
        }
      }
    }
    const tSubmit1 = performance.now();
    const tR1 = performance.now();
    const tWait0 = performance.now();
    if (shouldWaitForGpu && typeof queue.onSubmittedWorkDone === "function") {
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
      totalMs: tAll1 - tAll0,
      waitedForGpu: shouldWaitForGpu,
      coarseFactor: cf,
      directPreview: !!encodedDispatch.directPreview,
      resetReprojection: resetReprojThisFrame,
      frame: submittedFrameCount
    };
    if (shouldWaitForGpu || logFrame || submittedFrameCount % FRAME_LOG_EVERY === 0) {
      log(
        shouldWaitForGpu ? "[BENCH waited]" : "[BENCH submitted]",
        "compute(ms):",
        timings.computeMs.toFixed(2),
        "render-encode(ms):",
        timings.renderMs.toFixed(2),
        "submit(ms):",
        (timings.submitMs || 0).toFixed(2),
        "gpu-wait(ms):",
        (timings.gpuWaitMs || 0).toFixed(2),
        "total(ms):",
        timings.totalMs.toFixed(2),
        "coarseFactor:",
        cf,
        "directPreview:",
        !!encodedDispatch.directPreview
      );
    }
    return timings;
  }
  function startLoop() {
    if (loopRunning) return;
    if (!lastRunPayload) {
      log("startLoop: no last run payload; call runFrame once first.");
      loopEnabled = true;
      return;
    }
    loopEnabled = true;
    loopRunning = true;
    (async () => {
      log("animation loop started");
      let prevTime = performance.now();
      let submitWindowStart = prevTime;
      let submitWindowFrames = 0;
      lastFenceTime = prevTime;
      framesSinceFence = 0;
      if (workerReproj && workerReproj.enabled) {
        workerReproj = normalizeReproj(workerReproj);
        if (!workerReproj.frameIndex) workerReproj.frameIndex = 0;
      }
      while (loopEnabled) {
        const t0 = performance.now();
        try {
          const dt = Math.max(0, (t0 - prevTime) / 1e3);
          prevTime = t0;
          shapeOffsetWorld[0] += shapeVel[0] * dt;
          shapeOffsetWorld[1] += shapeVel[1] * dt;
          shapeOffsetWorld[2] += shapeVel[2] * dt;
          detailOffsetWorld[0] += detailVel[0] * dt;
          detailOffsetWorld[1] += detailVel[1] * dt;
          detailOffsetWorld[2] += detailVel[2] * dt;
          weatherOffsetWorld[0] += weatherVel[0] * dt;
          weatherOffsetWorld[1] += weatherVel[1] * dt;
          weatherOffsetWorld[2] += weatherVel[2] * dt;
          pushTransformsToCloudBuilder();
          if (workerReproj && workerReproj.enabled) {
            const ss = Math.max(1, workerReproj.subsample || 1);
            const cells = ss * ss;
            workerReproj.frameIndex = (workerReproj.frameIndex || 0) + 1 >>> 0;
            workerReproj.sampleOffset = workerReproj.frameIndex % cells >>> 0;
            try {
              cb?.setReprojSettings?.(workerReproj);
              if (workerPerf) cb?.setPerfParams?.(workerPerf);
            } catch (e) {
              console.warn("startLoop reproj apply failed", e);
            }
          }
          if (workerTuningVersion !== lastAppliedTuningVersion) applyWorkerTuning();
          if (lastRunPayload) {
            const merged = Object.assign({}, lastRunPayload.tileTransforms || {});
            Object.assign(merged, snapshotTransforms(), { explicit: true });
            lastRunPayload.tileTransforms = merged;
            lastRunPayload.waitForGpu = false;
            lastRunPayload.logFrame = false;
          }
          const timings = await runFrame(lastRunPayload);
          const submitFrameMs = performance.now() - t0 || timings.totalMs || 1;
          submitWindowFrames += 1;
          framesSinceFence += 1;
          const nowForSubmit = performance.now();
          if (nowForSubmit - submitWindowStart >= 250) {
            const submitFpsInst = submitWindowFrames * 1e3 / Math.max(1, nowForSubmit - submitWindowStart);
            emaSubmitFps = emaSubmitFps === null ? submitFpsInst : emaSubmitFps * 0.85 + submitFpsInst * 0.15;
            submitWindowStart = nowForSubmit;
            submitWindowFrames = 0;
          }
          postMessage({
            type: "frame",
            data: {
              timings,
              fps: emaGpuFps ?? emaSubmitFps,
              submitFps: emaSubmitFps,
              gpuFps: emaGpuFps,
              submitFrameMs,
              gpuFrameMs: lastGpuFrameMs,
              resetReprojection: timings.resetReprojection
            }
          });
        } catch (err) {
          postMessage({ type: "log", data: ["animation loop error", String(err)] });
        }
        const elapsed = performance.now() - t0;
        const delay = Math.max(0, LOOP_TARGET_MS - elapsed);
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        else await Promise.resolve();
        if (typeof queue?.onSubmittedWorkDone === "function" && framesSinceFence >= LOOP_BACKPRESSURE_EVERY) {
          const fenceStart = performance.now();
          await queue.onSubmittedWorkDone();
          const fenceEnd = performance.now();
          const elapsedSinceFence = Math.max(1, fenceEnd - lastFenceTime);
          const completedNow = framesSinceFence;
          completedFrameCount += completedNow;
          const gpuFpsInst = completedNow * 1e3 / elapsedSinceFence;
          emaGpuFps = emaGpuFps === null ? gpuFpsInst : emaGpuFps * 0.8 + gpuFpsInst * 0.2;
          lastGpuFrameMs = elapsedSinceFence / Math.max(1, completedNow);
          lastFenceTime = fenceEnd;
          framesSinceFence = 0;
          postMessage({
            type: "frame",
            data: {
              fps: emaGpuFps,
              gpuFps: emaGpuFps,
              submitFps: emaSubmitFps,
              gpuFrameMs: lastGpuFrameMs,
              fenceWaitMs: fenceEnd - fenceStart,
              completedFrames: completedFrameCount
            }
          });
        }
      }
      loopRunning = false;
      log("animation loop stopped");
      postMessage({ type: "loop-stopped" });
    })();
  }
  function stopLoop() {
    loopEnabled = false;
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
        await ensureDevice();
        configureMainContext();
        renderBundleCache.clear();
        respond(true, {
          ok: true,
          entryPoints: Array.isArray(nb?.entryPoints) ? nb.entryPoints.slice() : []
        });
        return;
      }
      if (type === "resize") {
        const { main, dbg: dbgSize } = payload;
        MAIN_W = Math.max(1, main.width | 0);
        MAIN_H = Math.max(1, main.height | 0);
        DBG_W = Math.max(1, dbgSize.width | 0);
        DBG_H = Math.max(1, dbgSize.height | 0);
        if (canvasMain) {
          canvasMain.width = MAIN_W;
          canvasMain.height = MAIN_H;
        }
        Object.values(dbg).forEach((c) => {
          if (c) {
            c.width = DBG_W;
            c.height = DBG_H;
          }
        });
        if (ctxMain) {
          ctxMain.configure({
            device,
            format: cb?._ensureRenderPipeline?.("bgra8unorm")?.format ?? "bgra8unorm",
            alphaMode: "opaque",
            size: [MAIN_W, MAIN_H]
          });
        }
        renderBundleCache.clear();
        if (cb) cb._bg0Dirty = cb._bg1Dirty = true;
        invalidateReprojectionHistory();
        respond(true, { ok: true });
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
        await ensureDevice();
        const t0 = performance.now();
        if (payload?.tileTransforms) applyNoiseTransforms(payload.tileTransforms, { allowPositions: !!payload.tileTransforms.explicit, allowScale: true, allowVel: true, additive: !!payload.tileTransforms.additive });
        if (payload?.noiseTransforms) applyNoiseTransforms(payload.noiseTransforms, { allowPositions: true, allowScale: true, allowVel: true, additive: !!payload.noiseTransforms.additive });
        pushTransformsToCloudBuilder();
        const weather = await bakeWeather2D(
          payload.weatherParams || {},
          true,
          payload.billowParams || {},
          payload.weatherBParams || payload.weatherB || null
        );
        const blue = await bakeBlue2D(payload.blueParams || {}, true);
        const shape = await bakeShape128(payload.shapeParams || {}, true);
        const detail = await bakeDetail32(payload.detailParams || {}, true);
        const t1 = performance.now();
        invalidateReprojectionHistory();
        respond(true, { baked: "all", timings: { weather, blue, shape, detail, totalMs: t1 - t0 } });
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
            if (lastRunPayload) {
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
        currentSlice = Math.max(0, Math.min(SHAPE_SIZE - 1, payload.slice | 0));
        renderDebugSlices();
        respond(true, { slice: currentSlice });
        return;
      }
      if (type === "setReproj") {
        workerReproj = normalizeReproj(payload.reproj || null);
        workerPerf = payload.perf || workerPerf;
        if (workerReproj && workerReproj.temporalBlend > 1e-4 && (workerReproj.frameIndex === 0 || typeof workerReproj.frameIndex === "undefined")) {
          workerReproj.frameIndex = 0;
          workerReproj.sampleOffset = 0;
          invalidateReprojectionHistory();
        }
        if (cb) {
          if (workerPerf) cb.setPerfParams(workerPerf);
          if (workerReproj) {
            cb.setReprojSettings(workerReproj);
          }
        }
        renderBundleCache.clear();
        if (workerReproj && workerReproj.enabled) startLoop();
        else stopLoop();
        respond(true, { ok: true, reproj: workerReproj, perf: workerPerf });
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
        respond(true, { ok: true, tuning: workerTuning, version: workerTuningVersion });
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
