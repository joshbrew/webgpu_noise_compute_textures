(() => {
  // tools/noise/noiseCompute.wgsl
  var noiseCompute_default = `const PI : f32 = 3.141592653589793;\r
const TWO_PI : f32 = 6.283185307179586;\r
\r
const ANGLE_INCREMENT : f32 = PI / 4.0;\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 options UBO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
struct NoiseComputeOptions {\r
  getGradient : u32,\r
  useCustomPos : u32,\r
  outputChannel : u32,\r
  ioFlags : u32,\r
  baseRadius : f32,\r
  heightScale : f32,\r
  _pad1 : f32,\r
  _pad2 : f32,\r
};\r
@group(0) @binding(0) var<uniform> options : NoiseComputeOptions;\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 params UBO (layout kept) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
struct NoiseParams {\r
  seed : u32,\r
  zoom : f32,\r
  freq : f32,\r
  octaves : u32,\r
  lacunarity : f32,\r
  gain : f32,\r
  xShift : f32,\r
  yShift : f32,\r
  zShift : f32,\r
  turbulence : u32,\r
  seedAngle : f32,\r
  exp1 : f32,\r
  exp2 : f32,\r
  threshold : f32,\r
  rippleFreq : f32,\r
  time : f32,\r
  warpAmp : f32,\r
  gaborRadius : f32,\r
  terraceStep : f32,\r
  toroidal : u32,\r
  voroMode : u32,\r
  edgeK:     f32\r
};\r
@group(0) @binding(1) var<uniform> params : NoiseParams;\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 permutation table \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
struct PermTable { values : array<u32, 512>, };\r
const PERM_SIZE : u32 = 512u;\r
const PERM_MASK : u32 = PERM_SIZE - 1u;\r
const INV_255 : f32 = 1.0 / 255.0;\r
const INV_2_OVER_255 : f32 = 2.0 / 255.0;\r
\r
@group(0) @binding(2) var<storage, read> permTable : PermTable;\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 IO resources \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@group(0) @binding(3) var inputTex : texture_2d_array<f32>;\r
@group(0) @binding(4) var outputTex : texture_storage_2d_array<rgba16float, write>;\r
@group(0) @binding(5) var<storage, read> posBuf : array<vec4<f32>>;\r
\r
struct Frame {\r
  fullWidth : u32,\r
  fullHeight : u32,\r
  tileWidth : u32,\r
  tileHeight : u32,\r
\r
  originX : i32,\r
  originY : i32,\r
  originZ : i32,\r
  fullDepth : u32,\r
\r
  tileDepth : u32,\r
  layerIndex : i32,\r
  layers : u32,\r
  _pad : u32,\r
\r
  originXf : f32,\r
  originYf : f32,\r
  originZf : f32,\r
  _pad1    : f32,\r
};\r
@group(0) @binding(6) var<uniform> frame : Frame;\r
\r
@group(0) @binding(7) var inputTex3D : texture_3d<f32>;\r
@group(0) @binding(8) var outputTex3D : texture_storage_3d<rgba16float, write>;\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 small utilities \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn clampZ(z: i32)->i32 {\r
  let depth = i32(max(u32(frame.fullDepth), 1u));\r
  return clamp(z, 0, depth - 1);\r
}\r
fn layerToZ(layerIndex:i32, layers:u32)->f32 {\r
  if (layers <= 1u) { return 0.0; }\r
  let li = max(layerIndex, 0);\r
  return f32(li) / f32(layers - 1u);\r
}\r
fn readFrom3D()->bool { return (options.ioFlags & 0x1u) != 0u; }\r
fn writeTo3D()->bool { return (options.ioFlags & 0x2u) != 0u; }\r
\r
fn loadPrevRGBA(fx:i32, fy:i32, fz:i32)->vec4<f32> {\r
  if (readFrom3D()) { return textureLoad(inputTex3D, vec3<i32>(fx, fy, clampZ(fz)), 0); }\r
  return textureLoad(inputTex, vec2<i32>(fx, fy), frame.layerIndex, 0);\r
}\r
fn storeRGBA(fx:i32, fy:i32, fz:i32, col:vec4<f32>) {\r
  if (writeTo3D()) { textureStore(outputTex3D, vec3<i32>(fx, fy, clampZ(fz)), col); }\r
  else { textureStore(outputTex, vec2<i32>(fx, fy), frame.layerIndex, col); }\r
}\r
\r
const STEREO_SCALE : f32 = 1.8;          // fixed packing scale for Clifford torus\r
const INV_SQRT2    : f32 = 0.7071067811865476; // 1/\u221A2\r
\r
// add next to your other constants\r
const U_SCALE : f32 = 3.0;\r
const V_SCALE : f32 = 3.0;\r
const T_SCALE : f32 = 2.0;\r
const PACK_BIAS : vec4<f32> = vec4<f32>(0.37, 0.21, 0.29, 0.31);\r
\r
fn packPeriodicUV(u: f32, v: f32, theta: f32) -> vec4<f32> {\r
  let aU = fract(u) * TWO_PI;\r
  let aV = fract(v) * TWO_PI;\r
  let aT = fract(theta) * TWO_PI;\r
\r
  let x = cos(aU) * U_SCALE;\r
  let y = sin(aU) * U_SCALE;\r
  let z = cos(aV) * V_SCALE + cos(aT) * T_SCALE;\r
  let w = sin(aV) * V_SCALE + sin(aT) * T_SCALE;\r
\r
  return vec4<f32>(x, y, z, w) + PACK_BIAS;\r
}\r
\r
\r
fn thetaFromDepth(fz: i32) -> f32 {\r
  let uses3D = writeTo3D() || readFrom3D();\r
  if (uses3D) {\r
    let d = max(f32(frame.fullDepth), 1.0);\r
    return (f32(clampZ(fz)) + 0.5) / d; // [0,1)\r
  }\r
  return layerToZ(frame.layerIndex, frame.layers);\r
}\r
\r
fn fetchPos(fx: i32, fy: i32, fz: i32) -> vec3<f32> {\r
  if (options.useCustomPos == 1u) {\r
    let use3D = writeTo3D() || readFrom3D();\r
    let slice_i = select(frame.layerIndex, clampZ(fz), use3D);\r
    let slice = u32(max(slice_i, 0));\r
    let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);\r
    let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);\r
    let idx = slice * frame.fullWidth * frame.fullHeight + u32(cy) * frame.fullWidth + u32(cx);\r
    return posBuf[idx].xyz;\r
  }\r
\r
  if (params.toroidal == 1u) {\r
    let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);\r
    let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);\r
\r
    let invW = 1.0 / max(f32(frame.fullWidth), 1.0);\r
    let invH = 1.0 / max(f32(frame.fullHeight), 1.0);\r
\r
    let U = (f32(cx) + 0.5) * invW;   // [0,1)\r
    let V = (f32(cy) + 0.5) * invH;   // [0,1)\r
    let theta = thetaFromDepth(fz);   // [0,1)\r
\r
    return vec3<f32>(U, V, theta);\r
  }\r
\r
  let invW = 1.0 / max(f32(frame.fullWidth), 1.0);\r
  let invH = 1.0 / max(f32(frame.fullHeight), 1.0);\r
\r
  var ox = frame.originXf;\r
  var oy = frame.originYf;\r
  if (ox == 0.0 && oy == 0.0) {\r
    ox = f32(frame.originX);\r
    oy = f32(frame.originY);\r
  }\r
\r
  let x = (ox + f32(fx)) * invW;\r
  let y = (oy + f32(fy)) * invH;\r
\r
  var z: f32;\r
  let uses3D = writeTo3D() || readFrom3D();\r
  if (uses3D) {\r
    if (frame.fullDepth <= 1u) { z = 0.0; }\r
    else { z = f32(clampZ(fz)) / f32(frame.fullDepth - 1u); }\r
  } else {\r
    z = layerToZ(frame.layerIndex, frame.layers);\r
  }\r
\r
  return vec3<f32>(x, y, z);\r
}\r
\r
\r
\r
\r
fn writeChannel(fx:i32, fy:i32, fz:i32, v0:f32, channel:u32, overwrite:u32) {\r
  let needsAccum = (overwrite == 0u);\r
  let writesAll = (channel == 0u);\r
  let skipRead = (!needsAccum) && (writesAll || channel == 5u);\r
  var inCol = vec4<f32>(0.0);\r
  if (!skipRead) { inCol = loadPrevRGBA(fx, fy, fz); }\r
  var outCol = inCol;\r
\r
  if (channel == 0u)      { let h = select(v0 + inCol.x, v0, overwrite == 1u); outCol = vec4<f32>(h, h, h, h); }\r
  else if (channel == 1u) { let h = select(v0 + inCol.x, v0, overwrite == 1u); outCol.x = h; }\r
  else if (channel == 2u) { let h = select(v0 + inCol.y, v0, overwrite == 1u); outCol.y = h; }\r
  else if (channel == 3u) { let h = select(v0 + inCol.z, v0, overwrite == 1u); outCol.z = h; }\r
  else if (channel == 4u) { let h = select(v0 + inCol.w, v0, overwrite == 1u); outCol.w = h; }\r
  else if (channel == 5u) { let p = fetchPos(fx, fy, fz); let h = select(v0 + inCol.w, v0, overwrite == 1u); outCol = vec4<f32>(p.x, p.y, p.z, h); }\r
  else if (channel == 6u) { let p = fetchPos(fx, fy, fz); let h = select(v0 + inCol.w, v0, overwrite == 1u); outCol = vec4<f32>(p.x, p.y, h, inCol.w); }\r
\r
  storeRGBA(fx, fy, fz, outCol);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 math / noise bits \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
/* gradient tables */\r
const GRAD2 : array<vec2<f32>, 8> = array<vec2<f32>, 8>(\r
  vec2<f32>( 1.0,  1.0), vec2<f32>(-1.0,  1.0),\r
  vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0, -1.0),\r
  vec2<f32>( 1.0,  0.0), vec2<f32>(-1.0,  0.0),\r
  vec2<f32>( 0.0,  1.0), vec2<f32>( 0.0, -1.0)\r
);\r
\r
const GRAD3 : array<vec3<f32>, 12> = array<vec3<f32>, 12>(\r
  vec3<f32>( 1.0,  1.0,  0.0), vec3<f32>(-1.0,  1.0,  0.0),\r
  vec3<f32>( 1.0, -1.0,  0.0), vec3<f32>(-1.0, -1.0,  0.0),\r
  vec3<f32>( 1.0,  0.0,  1.0), vec3<f32>(-1.0,  0.0,  1.0),\r
  vec3<f32>( 1.0,  0.0, -1.0), vec3<f32>(-1.0,  0.0, -1.0),\r
  vec3<f32>( 0.0,  1.0,  1.0), vec3<f32>( 0.0, -1.0,  1.0),\r
  vec3<f32>( 0.0,  1.0, -1.0), vec3<f32>( 0.0, -1.0, -1.0)\r
);\r
const GRAD4 : array<vec4<f32>, 32> = array<vec4<f32>, 32>(\r
  vec4<f32>( 0.0,  1.0,  1.0,  1.0), vec4<f32>( 0.0,  1.0,  1.0, -1.0),\r
  vec4<f32>( 0.0,  1.0, -1.0,  1.0), vec4<f32>( 0.0,  1.0, -1.0, -1.0),\r
  vec4<f32>( 0.0, -1.0,  1.0,  1.0), vec4<f32>( 0.0, -1.0,  1.0, -1.0),\r
  vec4<f32>( 0.0, -1.0, -1.0,  1.0), vec4<f32>( 0.0, -1.0, -1.0, -1.0),\r
\r
  vec4<f32>( 1.0,  0.0,  1.0,  1.0), vec4<f32>( 1.0,  0.0,  1.0, -1.0),\r
  vec4<f32>( 1.0,  0.0, -1.0,  1.0), vec4<f32>( 1.0,  0.0, -1.0, -1.0),\r
  vec4<f32>(-1.0,  0.0,  1.0,  1.0), vec4<f32>(-1.0,  0.0,  1.0, -1.0),\r
  vec4<f32>(-1.0,  0.0, -1.0,  1.0), vec4<f32>(-1.0,  0.0, -1.0, -1.0),\r
\r
  vec4<f32>( 1.0,  1.0,  0.0,  1.0), vec4<f32>( 1.0,  1.0,  0.0, -1.0),\r
  vec4<f32>( 1.0, -1.0,  0.0,  1.0), vec4<f32>( 1.0, -1.0,  0.0, -1.0),\r
  vec4<f32>(-1.0,  1.0,  0.0,  1.0), vec4<f32>(-1.0,  1.0,  0.0, -1.0),\r
  vec4<f32>(-1.0, -1.0,  0.0,  1.0), vec4<f32>(-1.0, -1.0,  0.0, -1.0),\r
\r
  vec4<f32>( 1.0,  1.0,  1.0,  0.0), vec4<f32>( 1.0,  1.0, -1.0,  0.0),\r
  vec4<f32>( 1.0, -1.0,  1.0,  0.0), vec4<f32>( 1.0, -1.0, -1.0,  0.0),\r
  vec4<f32>(-1.0,  1.0,  1.0,  0.0), vec4<f32>(-1.0,  1.0, -1.0,  0.0),\r
  vec4<f32>(-1.0, -1.0,  1.0,  0.0), vec4<f32>(-1.0, -1.0, -1.0,  0.0)\r
);\r
\r
/* Gradient accessors */\r
fn gradient(idx:u32)->vec3<f32> {\r
  return GRAD3[idx % 12u];\r
}\r
fn gradient2(idx:u32)->vec2<f32> {\r
  return GRAD2[idx % 8u];\r
}\r
fn gradient4(idx: u32) -> vec4<f32> {\r
  return GRAD4[idx % 32u];\r
}\r
\r
\r
fn fade(t:f32)->f32 { return t*t*t*(t*(t*6.0 - 15.0) + 10.0); }\r
fn lerp(a:f32, b:f32, t:f32)->f32 { return a + t * (b - a); }\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 perm/hash helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn perm(idx: u32) -> u32 {\r
  return permTable.values[idx & PERM_MASK];\r
}\r
\r
fn rot3(p: vec3<f32>) -> vec3<f32> {\r
  let x = 0.00 * p.x + -0.80 * p.y + -0.60 * p.z;\r
  let y = 0.80 * p.x +  0.36 * p.y + -0.48 * p.z;\r
  let z = 0.60 * p.x + -0.48 * p.y +  0.64 * p.z;\r
  return vec3<f32>(x, y, z);\r
}\r
\r
fn hash2(ix : i32, iy : i32) -> u32 {\r
  return perm((u32(ix) & PERM_MASK) + perm(u32(iy) & PERM_MASK)) & PERM_MASK;\r
}\r
fn rand2(ix : i32, iy : i32) -> f32 {\r
  let idx = hash2(ix, iy);\r
  return f32(perm(idx)) * INV_2_OVER_255 - 1.0;\r
}\r
fn rand2u(ix : i32, iy : i32) -> f32 {\r
  let idx = hash2(ix, iy);\r
  return f32(perm(idx)) * INV_255;\r
}\r
\r
// 3D helpers\r
fn hash3(ix : i32, iy : i32, iz : i32) -> u32 {\r
  return perm((u32(ix) & PERM_MASK)\r
            + perm((u32(iy) & PERM_MASK) + perm(u32(iz) & PERM_MASK)))\r
         & PERM_MASK;\r
}\r
fn rand3(ix : i32, iy : i32, iz : i32) -> f32 {\r
  let idx = hash3(ix, iy, iz);\r
  return f32(perm(idx)) * INV_2_OVER_255 - 1.0;\r
}\r
fn rand3u(ix : i32, iy : i32, iz : i32) -> f32 {\r
  let idx = hash3(ix, iy, iz);\r
  return f32(perm(idx)) * INV_255;\r
}\r
\r
// 4D helpers\r
fn hash4(ix : i32, iy : i32, iz : i32, iw : i32) -> u32 {\r
  let a = perm(u32(ix) & PERM_MASK);\r
  let b = perm((u32(iy) & PERM_MASK) + a);\r
  let c = perm((u32(iz) & PERM_MASK) + b);\r
  return perm((u32(iw) & PERM_MASK) + c) & PERM_MASK;\r
}\r
fn rand4(ix : i32, iy : i32, iz : i32, iw : i32) -> f32 {\r
  let idx = hash4(ix, iy, iz, iw);\r
  return f32(perm(idx)) * INV_2_OVER_255 - 1.0;\r
}\r
fn rand4u(ix : i32, iy : i32, iz : i32, iw : i32) -> f32 {\r
  let idx = hash4(ix, iy, iz, iw);\r
  return f32(perm(idx)) * INV_255;\r
}\r
\r
/* ---------- classic 2D Perlin ---------- */\r
fn noise2D(p : vec2<f32>) -> f32 {\r
  let ix = i32(floor(p.x));\r
  let iy = i32(floor(p.y));\r
  let X: u32 = u32(ix) & PERM_MASK;\r
  let Y: u32 = u32(iy) & PERM_MASK;\r
\r
  let xf = p.x - floor(p.x);\r
  let yf = p.y - floor(p.y);\r
\r
  let u = fade(xf);\r
  let v = fade(yf);\r
\r
  let A  = perm(X) + Y;\r
  let B  = perm((X + 1u) & PERM_MASK) + Y;\r
\r
  let gAA = gradient2(perm(A & PERM_MASK));\r
  let gBA = gradient2(perm(B & PERM_MASK));\r
  let gAB = gradient2(perm((A + 1u) & PERM_MASK));\r
  let gBB = gradient2(perm((B + 1u) & PERM_MASK));\r
\r
  let x1 = lerp(dot(gAA, vec2<f32>(xf,       yf      )),\r
                dot(gBA, vec2<f32>(xf - 1.0, yf      )), u);\r
  let x2 = lerp(dot(gAB, vec2<f32>(xf,       yf - 1.0)),\r
                dot(gBB, vec2<f32>(xf - 1.0, yf - 1.0)), u);\r
  return lerp(x1, x2, v);\r
}\r
\r
//matches 3d z=0 slice, less multiplying\r
fn noise2D_from_3D(p: vec3<f32>) -> f32 {\r
  let ix = i32(floor(p.x));\r
  let iy = i32(floor(p.y));\r
  let X: u32 = u32(ix) & PERM_MASK;\r
  let Y: u32 = u32(iy) & PERM_MASK;\r
\r
  let xf = p.x - floor(p.x);\r
  let yf = p.y - floor(p.y);\r
  let u = fade(xf);\r
  let v = fade(yf);\r
\r
  // 3D hashing path with Z = 0\r
  let A  = perm(X) + Y;\r
  let AA = perm(A & PERM_MASK);                 // + Z(=0)\r
  let AB = perm((A + 1u) & PERM_MASK);          // + Z(=0)\r
  let B  = perm((X + 1u) & PERM_MASK) + Y;\r
  let BA = perm(B & PERM_MASK);                 // + Z(=0)\r
  let BB = perm((B + 1u) & PERM_MASK);          // + Z(=0)\r
\r
  let gAA = gradient(perm(AA & PERM_MASK));\r
  let gBA = gradient(perm(BA & PERM_MASK));\r
  let gAB = gradient(perm(AB & PERM_MASK));\r
  let gBB = gradient(perm(BB & PERM_MASK));\r
\r
  let n00 = dot(gAA, vec3<f32>(xf,       yf,       0.0));\r
  let n10 = dot(gBA, vec3<f32>(xf - 1.0, yf,       0.0));\r
  let n01 = dot(gAB, vec3<f32>(xf,       yf - 1.0, 0.0));\r
  let n11 = dot(gBB, vec3<f32>(xf - 1.0, yf - 1.0, 0.0));\r
\r
  let nx0 = lerp(n00, n10, u);\r
  let nx1 = lerp(n01, n11, u);\r
  return lerp(nx0, nx1, v);\r
}\r
\r
/* ---------- classic 3D Perlin ---------- */\r
fn noise3D(p: vec3<f32>) -> f32 {\r
  if (p.z == 0.0) { return noise2D_from_3D(p); }\r
\r
  let ix = i32(floor(p.x));\r
  let iy = i32(floor(p.y));\r
  let iz = i32(floor(p.z));\r
  let X: u32 = u32(ix) & PERM_MASK;\r
  let Y: u32 = u32(iy) & PERM_MASK;\r
  let Z: u32 = u32(iz) & PERM_MASK;\r
\r
  let xf = p.x - floor(p.x);\r
  let yf = p.y - floor(p.y);\r
  let zf = p.z - floor(p.z);\r
\r
  let u = fade(xf);\r
  let v = fade(yf);\r
  let w = fade(zf);\r
\r
  let A  = perm(X) + Y;\r
  let AA = perm(A & PERM_MASK) + Z;\r
  let AB = perm((A + 1u) & PERM_MASK) + Z;\r
  let B  = perm((X + 1u) & PERM_MASK) + Y;\r
  let BA = perm(B & PERM_MASK) + Z;\r
  let BB = perm((B + 1u) & PERM_MASK) + Z;\r
\r
  let gAA  = gradient(perm(AA & PERM_MASK));\r
  let gBA  = gradient(perm(BA & PERM_MASK));\r
  let gAB  = gradient(perm(AB & PERM_MASK));\r
  let gBB  = gradient(perm(BB & PERM_MASK));\r
  let gAA1 = gradient(perm((AA + 1u) & PERM_MASK));\r
  let gBA1 = gradient(perm((BA + 1u) & PERM_MASK));\r
  let gAB1 = gradient(perm((AB + 1u) & PERM_MASK));\r
  let gBB1 = gradient(perm((BB + 1u) & PERM_MASK));\r
\r
  let x1 = lerp(dot(gAA,  vec3<f32>(xf,       yf,       zf      )),\r
                dot(gBA,  vec3<f32>(xf - 1.0, yf,       zf      )), u);\r
  let x2 = lerp(dot(gAB,  vec3<f32>(xf,       yf - 1.0, zf      )),\r
                dot(gBB,  vec3<f32>(xf - 1.0, yf - 1.0, zf      )), u);\r
  let y1 = lerp(x1, x2, v);\r
\r
  let x3 = lerp(dot(gAA1, vec3<f32>(xf,       yf,       zf - 1.0)),\r
                dot(gBA1, vec3<f32>(xf - 1.0, yf,       zf - 1.0)), u);\r
  let x4 = lerp(dot(gAB1, vec3<f32>(xf,       yf - 1.0, zf - 1.0)),\r
                dot(gBB1, vec3<f32>(xf - 1.0, yf - 1.0, zf - 1.0)), u);\r
  let y2 = lerp(x3, x4, v);\r
\r
  return lerp(y1, y2, w);\r
}\r
\r
\r
/* ---------- 4D Perlin (hypercube corners, gradient-based) ---------- */\r
fn noise4D(p: vec4<f32>) -> f32 {\r
  // integer cell coords\r
  let ix = i32(floor(p.x));\r
  let iy = i32(floor(p.y));\r
  let iz = i32(floor(p.z));\r
  let iw = i32(floor(p.w));\r
\r
  let X: u32 = u32(ix) & PERM_MASK;\r
  let Y: u32 = u32(iy) & PERM_MASK;\r
  let Z: u32 = u32(iz) & PERM_MASK;\r
  let W: u32 = u32(iw) & PERM_MASK;\r
\r
  // fractional part\r
  let xf = p.x - floor(p.x);\r
  let yf = p.y - floor(p.y);\r
  let zf = p.z - floor(p.z);\r
  let wf = p.w - floor(p.w);\r
\r
  let u = fade(xf);\r
  let v = fade(yf);\r
  let t = fade(zf);\r
  let s = fade(wf);\r
\r
  // helper to get corner gradient and dot product\r
  // corner offsets are dx,dy,dz,dw in {0,1}\r
  // for fractional component, use (xf - dx) etc; for dw=1 use (wf - 1.0)\r
  // compute hash for corner using hash4(ix+dx, iy+dy, iz+dz, iw+dw)\r
  let d0000 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 0, iw + 0))), vec4<f32>(xf,       yf,       zf,       wf      ));\r
  let d1000 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 0, iw + 0))), vec4<f32>(xf - 1.0, yf,       zf,       wf      ));\r
  let d0100 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 0, iw + 0))), vec4<f32>(xf,       yf - 1.0, zf,       wf      ));\r
  let d1100 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 0, iw + 0))), vec4<f32>(xf - 1.0, yf - 1.0, zf,       wf      ));\r
\r
  let d0010 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 1, iw + 0))), vec4<f32>(xf,       yf,       zf - 1.0, wf      ));\r
  let d1010 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 1, iw + 0))), vec4<f32>(xf - 1.0, yf,       zf - 1.0, wf      ));\r
  let d0110 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 1, iw + 0))), vec4<f32>(xf,       yf - 1.0, zf - 1.0, wf      ));\r
  let d1110 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 1, iw + 0))), vec4<f32>(xf - 1.0, yf - 1.0, zf - 1.0, wf      ));\r
\r
  let d0001 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 0, iw + 1))), vec4<f32>(xf,       yf,       zf,       wf - 1.0));\r
  let d1001 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 0, iw + 1))), vec4<f32>(xf - 1.0, yf,       zf,       wf - 1.0));\r
  let d0101 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 0, iw + 1))), vec4<f32>(xf,       yf - 1.0, zf,       wf - 1.0));\r
  let d1101 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 0, iw + 1))), vec4<f32>(xf - 1.0, yf - 1.0, zf,       wf - 1.0));\r
\r
  let d0011 = dot(gradient4(perm(hash4(ix + 0, iy + 0, iz + 1, iw + 1))), vec4<f32>(xf,       yf,       zf - 1.0, wf - 1.0));\r
  let d1011 = dot(gradient4(perm(hash4(ix + 1, iy + 0, iz + 1, iw + 1))), vec4<f32>(xf - 1.0, yf,       zf - 1.0, wf - 1.0));\r
  let d0111 = dot(gradient4(perm(hash4(ix + 0, iy + 1, iz + 1, iw + 1))), vec4<f32>(xf,       yf - 1.0, zf - 1.0, wf - 1.0));\r
  let d1111 = dot(gradient4(perm(hash4(ix + 1, iy + 1, iz + 1, iw + 1))), vec4<f32>(xf - 1.0, yf - 1.0, zf - 1.0, wf - 1.0));\r
\r
  // interpolate along x -> y -> z for w=0 layer\r
  let x00 = lerp(d0000, d1000, u);\r
  let x10 = lerp(d0100, d1100, u);\r
  let y0  = lerp(x00, x10, v);\r
\r
  let x01 = lerp(d0010, d1010, u);\r
  let x11 = lerp(d0110, d1110, u);\r
  let y1  = lerp(x01, x11, v);\r
\r
  let zLayer0 = lerp(y0, y1, t);\r
\r
  // interpolate for w=1 layer\r
  let x00w = lerp(d0001, d1001, u);\r
  let x10w = lerp(d0101, d1101, u);\r
  let y0w  = lerp(x00w, x10w, v);\r
\r
  let x01w = lerp(d0011, d1011, u);\r
  let x11w = lerp(d0111, d1111, u);\r
  let y1w  = lerp(x01w, x11w, v);\r
\r
  let zLayer1 = lerp(y0w, y1w, t);\r
\r
  // final interp along w\r
  return lerp(zLayer0, zLayer1, s);\r
}\r
\r
fn worley3D(p : vec3<f32>) -> f32 {\r
    let fx = i32(floor(p.x));\r
    let fy = i32(floor(p.y));\r
    let fz = i32(floor(p.z));\r
    var minD : f32 = 1e9;\r
    for (var dz = -1; dz <= 1; dz = dz + 1) {\r
      for (var dy = -1; dy <= 1; dy = dy + 1) {\r
        for (var dx = -1; dx <= 1; dx = dx + 1) {\r
          let xi = fx + dx;\r
          let yi = fy + dy;\r
          let zi = fz + dz;\r
          let px = f32(xi) + rand3u(xi, yi, zi);\r
          let py = f32(yi) + rand3u(yi, zi, xi);\r
          let pz = f32(zi) + rand3u(zi, xi, yi);\r
          let dxv = px - p.x;\r
          let dyv = py - p.y;\r
          let dzv = pz - p.z;\r
          let d2 = dxv*dxv + dyv*dyv + dzv*dzv;\r
          if (d2 < minD) { minD = d2; }\r
        }\r
      }\r
    }\r
    return sqrt(minD);\r
  \r
}\r
\r
\r
/* ---------- 4D Worley (cellular) ---------- */\r
// fn worley4D(p: vec4<f32>) -> f32 {\r
//   let fx = i32(floor(p.x));\r
//   let fy = i32(floor(p.y));\r
//   let fz = i32(floor(p.z));\r
//   let fw = i32(floor(p.w));\r
\r
//   var minDistSq : f32 = 1e9;\r
\r
//   // iterate neighbor cells in 4D (3^4 = 81)\r
//   for (var dw = -1; dw <= 1; dw = dw + 1) {\r
//     for (var dz = -1; dz <= 1; dz = dz + 1) {\r
//       for (var dy = -1; dy <= 1; dy = dy + 1) {\r
//         for (var dx = -1; dx <= 1; dx = dx + 1) {\r
//           let xi = fx + dx;\r
//           let yi = fy + dy;\r
//           let zi = fz + dz;\r
//           let wi = fw + dw;\r
\r
//           // jitter within each cell using rotated rand4u calls to decorrelate axes\r
//           let rx = rand4u(xi, yi, zi, wi);\r
//           let ry = rand4u(yi, zi, wi, xi);\r
//           let rz = rand4u(zi, wi, xi, yi);\r
//           let rw = rand4u(wi, xi, yi, zi);\r
\r
//           let px = f32(xi) + rx;\r
//           let py = f32(yi) + ry;\r
//           let pz = f32(zi) + rz;\r
//           let pw = f32(wi) + rw;\r
\r
//           let dxv = px - p.x;\r
//           let dyv = py - p.y;\r
//           let dzv = pz - p.z;\r
//           let dwv = pw - p.w;\r
//           let d2 = dxv * dxv + dyv * dyv + dzv * dzv + dwv * dwv;\r
//           if (d2 < minDistSq) { minDistSq = d2; }\r
//         }\r
//       }\r
//     }\r
//   }\r
\r
//   return sqrt(minDistSq);\r
// }\r
\r
\r
fn cellular3D(p : vec3<f32>) -> f32 {\r
    let fx = i32(floor(p.x));\r
    let fy = i32(floor(p.y));\r
    let fz = i32(floor(p.z));\r
    var d1 : f32 = 1e9; var d2 : f32 = 1e9;\r
    for (var dz = -1; dz <= 1; dz++) {\r
      for (var dy = -1; dy <= 1; dy++) {\r
        for (var dx = -1; dx <= 1; dx++) {\r
          let xi = fx + dx; let yi = fy + dy; let zi = fz + dz;\r
          let px = f32(xi) + rand3u(xi, yi, zi);\r
          let py = f32(yi) + rand3u(yi, zi, xi);\r
          let pz = f32(zi) + rand3u(zi, xi, yi);\r
          let dd = (px - p.x)*(px - p.x) + (py - p.y)*(py - p.y) + (pz - p.z)*(pz - p.z);\r
          if (dd < d1) { d2 = d1; d1 = dd; }\r
          else if (dd < d2) { d2 = dd; }\r
        }\r
      }\r
    }\r
    return d2 - d1;\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  2-D Simplex  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn simplex2D(p : vec2<f32>) -> f32 {\r
  let F2 : f32 = 0.3660254037844386;  // (\u221A3-1)/2\r
  let G2 : f32 = 0.2113248654051871;  // (3-\u221A3)/6\r
\r
  // Skew to simplex grid\r
  let s  = (p.x + p.y) * F2;\r
  let i  = i32(floor(p.x + s));\r
  let j  = i32(floor(p.y + s));\r
  let t  = f32(i + j) * G2;\r
\r
  let X0 = f32(i) - t;\r
  let Y0 = f32(j) - t;\r
  let x0 = p.x - X0;\r
  let y0 = p.y - Y0;\r
\r
  // Simplex corner order\r
  var i1u : u32 = 0u;\r
  var j1u : u32 = 0u;\r
  if (x0 > y0) { i1u = 1u; } else { j1u = 1u; }\r
\r
  // Offsets for remaining corners\r
  let x1 = x0 - f32(i1u) + G2;\r
  let y1 = y0 - f32(j1u) + G2;\r
  let x2 = x0 - 1.0 + 2.0 * G2;\r
  let y2 = y0 - 1.0 + 2.0 * G2;\r
\r
  // Hashed gradients (mod 8 for 2D gradient table)\r
  let ii  = u32(i) & PERM_MASK;\r
  let jj  = u32(j) & PERM_MASK;\r
  let gi0 = perm(ii + perm(jj)) & 7u;\r
  let gi1 = perm(ii + i1u + perm((jj + j1u) & PERM_MASK)) & 7u;\r
  let gi2 = perm((ii + 1u) + perm((jj + 1u) & PERM_MASK)) & 7u;\r
\r
  // Contributions from each corner\r
  var t0 = 0.5 - x0 * x0 - y0 * y0;\r
  var n0 : f32 = 0.0;\r
  if (t0 > 0.0) {\r
    t0 *= t0;\r
    n0 = t0 * t0 * dot(gradient2(gi0), vec2<f32>(x0, y0));\r
  }\r
\r
  var t1 = 0.5 - x1 * x1 - y1 * y1;\r
  var n1 : f32 = 0.0;\r
  if (t1 > 0.0) {\r
    t1 *= t1;\r
    n1 = t1 * t1 * dot(gradient2(gi1), vec2<f32>(x1, y1));\r
  }\r
\r
  var t2 = 0.5 - x2 * x2 - y2 * y2;\r
  var n2 : f32 = 0.0;\r
  if (t2 > 0.0) {\r
    t2 *= t2;\r
    n2 = t2 * t2 * dot(gradient2(gi2), vec2<f32>(x2, y2));\r
  }\r
\r
  // Same scale used in the standard reference implementation\r
  return 70.0 * (n0 + n1 + n2);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 3-D Simplex Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// Call it like: let v = simplex3D(vec3<f32>(x,y,z));\r
\r
fn simplex3D(pos : vec3<f32>) -> f32 {\r
    // Skew/\u200Bunskew factors for 3D\r
    let F3 : f32 = 1.0 / 3.0;\r
    let G3 : f32 = 1.0 / 6.0;\r
\r
    // Skew the input space to find the simplex cell\r
    let s  = (pos.x + pos.y + pos.z) * F3;\r
    let i_f = floor(pos.x + s);\r
    let j_f = floor(pos.y + s);\r
    let k_f = floor(pos.z + s);\r
\r
    let i = i32(i_f);\r
    let j = i32(j_f);\r
    let k = i32(k_f);\r
\r
    // Unskew back to (x,y,z) space\r
    let t0 = f32(i + j + k) * G3;\r
    let X0 = f32(i) - t0;\r
    let Y0 = f32(j) - t0;\r
    let Z0 = f32(k) - t0;\r
\r
    var x0 = pos.x - X0;\r
    var y0 = pos.y - Y0;\r
    var z0 = pos.z - Z0;\r
\r
    // Determine which simplex we are in\r
    var i1: i32; var j1: i32; var k1: i32;\r
    var i2: i32; var j2: i32; var k2: i32;\r
    if (x0 >= y0) {\r
        if (y0 >= z0) {\r
            // X Y Z\r
            i1 = 1; j1 = 0; k1 = 0;\r
            i2 = 1; j2 = 1; k2 = 0;\r
        } else if (x0 >= z0) {\r
            // X Z Y\r
            i1 = 1; j1 = 0; k1 = 0;\r
            i2 = 1; j2 = 0; k2 = 1;\r
        } else {\r
            // Z X Y\r
            i1 = 0; j1 = 0; k1 = 1;\r
            i2 = 1; j2 = 0; k2 = 1;\r
        }\r
    } else {\r
        if (y0 < z0) {\r
            // Z Y X\r
            i1 = 0; j1 = 0; k1 = 1;\r
            i2 = 0; j2 = 1; k2 = 1;\r
        } else if (x0 < z0) {\r
            // Y Z X\r
            i1 = 0; j1 = 1; k1 = 0;\r
            i2 = 0; j2 = 1; k2 = 1;\r
        } else {\r
            // Y X Z\r
            i1 = 0; j1 = 1; k1 = 0;\r
            i2 = 1; j2 = 1; k2 = 0;\r
        }\r
    }\r
\r
    // Offsets for the other three corners\r
    let x1 = x0 - f32(i1) + G3;\r
    let y1 = y0 - f32(j1) + G3;\r
    let z1 = z0 - f32(k1) + G3;\r
\r
    let x2 = x0 - f32(i2) + 2.0 * G3;\r
    let y2 = y0 - f32(j2) + 2.0 * G3;\r
    let z2 = z0 - f32(k2) + 2.0 * G3;\r
\r
    let x3 = x0 - 1.0 + 3.0 * G3;\r
    let y3 = y0 - 1.0 + 3.0 * G3;\r
    let z3 = z0 - 1.0 + 3.0 * G3;\r
\r
    // Hash the corner indices to get gradient indices\r
    let ii = u32(i) & PERM_MASK;\r
    let jj = u32(j) & PERM_MASK;\r
    let kk = u32(k) & PERM_MASK;\r
\r
    let gi0 = perm(ii + perm(jj + perm(kk)))        % 12u;\r
    let gi1 = perm(ii + u32(i1) + perm((jj + u32(j1)) + perm((kk + u32(k1))))) % 12u;\r
    let gi2 = perm(ii + u32(i2) + perm((jj + u32(j2)) + perm((kk + u32(k2))))) % 12u;\r
    let gi3 = perm(ii + 1u      + perm((jj + 1u     ) + perm((kk + 1u     )))) % 12u;\r
\r
    // Compute contributions from each corner\r
    var n0: f32;\r
    var t_0 = 0.6 - x0*x0 - y0*y0 - z0*z0;\r
    if (t_0 < 0.0) {\r
        n0 = 0.0;\r
    } else {\r
        let t2 = t_0 * t_0;\r
        n0 = t2 * t2 * dot(gradient(gi0), vec3<f32>(x0, y0, z0));\r
    }\r
\r
    var n1: f32;\r
    var t_1 = 0.6 - x1*x1 - y1*y1 - z1*z1;\r
    if (t_1 < 0.0) {\r
        n1 = 0.0;\r
    } else {\r
        let t2 = t_1 * t_1;\r
        n1 = t2 * t2 * dot(gradient(gi1), vec3<f32>(x1, y1, z1));\r
    }\r
\r
    var n2: f32;\r
    var t_2 = 0.6 - x2*x2 - y2*y2 - z2*z2;\r
    if (t_2 < 0.0) {\r
        n2 = 0.0;\r
    } else {\r
        let t2 = t_2 * t_2;\r
        n2 = t2 * t2 * dot(gradient(gi2), vec3<f32>(x2, y2, z2));\r
    }\r
\r
    var n3: f32;\r
    var t_3 = 0.6 - x3*x3 - y3*y3 - z3*z3;\r
    if (t_3 < 0.0) {\r
        n3 = 0.0;\r
    } else {\r
        let t2 = t_3 * t_3;\r
        n3 = t2 * t2 * dot(gradient(gi3), vec3<f32>(x3, y3, z3));\r
    }\r
\r
    // Final scale to match [-1,1]\r
    return 32.0 * (n0 + n1 + n2 + n3);\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  helpers  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
\r
fn cubicInterpolate(p0 : f32, p1 : f32, p2 : f32, p3 : f32, t : f32) -> f32 {\r
    return p1 + 0.5 * t *\r
        (p2 - p0 + t *\r
        (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3 + t *\r
        (3.0 * (p1 - p2) + p3 - p0)));\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Fast Lanczos 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn lanczos2D(pos : vec2<f32>) -> f32 {\r
    let ix  : i32 = i32(floor(pos.x));\r
    let iy  : i32 = i32(floor(pos.y));\r
    let dx  : f32 = pos.x - f32(ix);\r
    let dy  : f32 = pos.y - f32(iy);\r
\r
    /* 4\xD74 neighbourhood hashed once \u2014 unrolled for speed */\r
    let n00 = rand2(ix - 1, iy - 1);\r
    let n10 = rand2(ix + 0, iy - 1);\r
    let n20 = rand2(ix + 1, iy - 1);\r
    let n30 = rand2(ix + 2, iy - 1);\r
\r
    let n01 = rand2(ix - 1, iy + 0);\r
    let n11 = rand2(ix + 0, iy + 0);\r
    let n21 = rand2(ix + 1, iy + 0);\r
    let n31 = rand2(ix + 2, iy + 0);\r
\r
    let n02 = rand2(ix - 1, iy + 1);\r
    let n12 = rand2(ix + 0, iy + 1);\r
    let n22 = rand2(ix + 1, iy + 1);\r
    let n32 = rand2(ix + 2, iy + 1);\r
\r
    let n03 = rand2(ix - 1, iy + 2);\r
    let n13 = rand2(ix + 0, iy + 2);\r
    let n23 = rand2(ix + 1, iy + 2);\r
    let n33 = rand2(ix + 2, iy + 2);\r
\r
    /* cubic along x (columns) */\r
    let col0 = cubicInterpolate(n00, n10, n20, n30, dx);\r
    let col1 = cubicInterpolate(n01, n11, n21, n31, dx);\r
    let col2 = cubicInterpolate(n02, n12, n22, n32, dx);\r
    let col3 = cubicInterpolate(n03, n13, n23, n33, dx);\r
\r
    /* cubic along y (rows)  */\r
    return cubicInterpolate(col0, col1, col2, col3, dy);\r
}\r
\r
\r
/* helper to fetch one z-slice and cubic-interpolate along x/y */\r
fn slice(ix : i32, iy : i32, iz : i32, dx : f32, dy : f32) -> f32 {\r
    let n00 = rand3(ix - 1, iy - 1, iz);\r
    let n10 = rand3(ix + 0, iy - 1, iz);\r
    let n20 = rand3(ix + 1, iy - 1, iz);\r
    let n30 = rand3(ix + 2, iy - 1, iz);\r
\r
    let n01 = rand3(ix - 1, iy + 0, iz);\r
    let n11 = rand3(ix + 0, iy + 0, iz);\r
    let n21 = rand3(ix + 1, iy + 0, iz);\r
    let n31 = rand3(ix + 2, iy + 0, iz);\r
\r
    let n02 = rand3(ix - 1, iy + 1, iz);\r
    let n12 = rand3(ix + 0, iy + 1, iz);\r
    let n22 = rand3(ix + 1, iy + 1, iz);\r
    let n32 = rand3(ix + 2, iy + 1, iz);\r
\r
    let n03 = rand3(ix - 1, iy + 2, iz);\r
    let n13 = rand3(ix + 0, iy + 2, iz);\r
    let n23 = rand3(ix + 1, iy + 2, iz);\r
    let n33 = rand3(ix + 2, iy + 2, iz);\r
\r
    let col0 = cubicInterpolate(n00, n10, n20, n30, dx);\r
    let col1 = cubicInterpolate(n01, n11, n21, n31, dx);\r
    let col2 = cubicInterpolate(n02, n12, n22, n32, dx);\r
    let col3 = cubicInterpolate(n03, n13, n23, n33, dx);\r
\r
    return cubicInterpolate(col0, col1, col2, col3, dy);\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Fast Lanczos 3-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn lanczos3D(pos : vec3<f32>) -> f32 {\r
    let ix : i32 = i32(floor(pos.x));\r
    let iy : i32 = i32(floor(pos.y));\r
    let iz : i32 = i32(floor(pos.z));\r
    let dx : f32 = pos.x - f32(ix);\r
    let dy : f32 = pos.y - f32(iy);\r
    let dz : f32 = pos.z - f32(iz);\r
\r
    /* 4\xD74\xD74 neighbourhood \u2014 fetch & interpolate on-the-fly */\r
\r
    let row0 = slice(ix, iy, iz - 1, dx, dy);\r
    let row1 = slice(ix, iy, iz + 0, dx, dy);\r
    let row2 = slice(ix, iy, iz + 1, dx, dy);\r
    let row3 = slice(ix, iy, iz + 2, dx, dy);\r
\r
    return cubicInterpolate(row0, row1, row2, row3, dz);\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Voronoi 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn voronoi2D(pos : vec2<f32>) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
\r
    var minDist : f32 = 1e9;\r
    var minVal  : f32 = 0.0;\r
\r
    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {\r
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {\r
            let xi = fx + dx;\r
            let yi = fy + dy;\r
\r
            let px = f32(xi) + rand2u(xi, yi);\r
            let py = f32(yi) + rand2u(yi, xi);\r
\r
            let dist = (px - pos.x) * (px - pos.x) +\r
                       (py - pos.y) * (py - pos.y);\r
\r
            if (dist < minDist) {\r
                minDist = dist;\r
                minVal  = rand2u(xi, yi);\r
            }\r
        }\r
    }\r
    return minVal;          // in [0,1]\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Voronoi 3-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
// fn voronoi3D(pos : vec3<f32>) -> f32 {\r
//     let fx : i32 = i32(floor(pos.x));\r
//     let fy : i32 = i32(floor(pos.y));\r
//     let fz : i32 = i32(floor(pos.z));\r
\r
//     var minDist : f32 = 1e9;\r
//     var minVal  : f32 = 0.0;\r
\r
//     for (var dz : i32 = -1; dz <= 1; dz = dz + 1) {\r
//         for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {\r
//             for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {\r
//                 let xi = fx + dx;\r
//                 let yi = fy + dy;\r
//                 let zi = fz + dz;\r
\r
//                 let px = f32(xi) + rand3u(xi, yi, zi);\r
//                 let py = f32(yi) + rand3u(yi, zi, xi);\r
//                 let pz = f32(zi) + rand3u(zi, xi, yi);\r
\r
//                 let dist = (px - pos.x) * (px - pos.x) +\r
//                            (py - pos.y) * (py - pos.y) +\r
//                            (pz - pos.z) * (pz - pos.z);\r
\r
//                 if (dist < minDist) {\r
//                     minDist = dist;\r
//                     minVal  = rand3u(xi, yi, zi);\r
//                 }\r
//             }\r
//         }\r
//     }\r
//     return minVal;          // in [0,1]\r
// }\r
\r
\r
\r
// ----------------- types & mode constants -----------------\r
struct Voro3DMetrics { f1Sq: f32, f2Sq: f32, cellVal: f32 };\r
struct Voro4DMetrics { f1Sq: f32, f2Sq: f32, cellVal: f32 };\r
\r
// ----------------- voro_eval: pick output depending on mode -----------------\r
\r
\r
const VORO_CELL            : u32 = 0u;\r
const VORO_F1              : u32 = 1u;\r
const VORO_INTERIOR        : u32 = 2u;  // gap = F2 - F1\r
const VORO_EDGES           : u32 = 3u;  // scaled gap\r
const VORO_EDGE_THRESH     : u32 = 4u;  // gate gap >= threshold\r
const VORO_FLAT_SHADE      : u32 = 5u;  // interior = 1, edges = 0 (edges defined by gap < threshold)\r
const VORO_FLAT_SHADE_INV  : u32 = 6u;  // edges = 1, interior = 0 (gap < threshold)\r
\r
// Added: "old cellular3D" compatible squared-gap modes (F2^2 - F1^2)\r
const VORO_INTERIOR_SQ        : u32 = 7u;  // gapSq = F2^2 - F1^2\r
const VORO_EDGES_SQ           : u32 = 8u;  // scaled gapSq\r
const VORO_EDGE_THRESH_SQ     : u32 = 9u;  // gate gapSq >= threshold\r
const VORO_FLAT_SHADE_SQ      : u32 = 10u; // interior = 1, edges = 0 (gapSq < threshold)\r
const VORO_FLAT_SHADE_INV_SQ  : u32 = 11u; // edges = 1, interior = 0 (gapSq < threshold)\r
\r
// Added: F1 threshold and masks (useful for "radius" gates, bubble masks, etc.)\r
const VORO_F1_THRESH      : u32 = 12u; // gate F1 >= threshold, returns F1 * gate\r
const VORO_F1_MASK        : u32 = 13u; // smooth mask: 0 below threshold, 1 above (feather=edgeK)\r
const VORO_F1_MASK_INV    : u32 = 14u; // inverted mask: 1 below threshold, 0 above (feather=edgeK)\r
\r
// Added: softer edge line response (no threshold needed)\r
const VORO_EDGE_RCP       : u32 = 15u; // 1 / (1 + gap*k)\r
const VORO_EDGE_RCP_SQ    : u32 = 16u; // 1 / (1 + gapSq*k)\r
\r
fn voro_edge_dist(f1Sq: f32, f2Sq: f32) -> f32 {\r
  let f1 = sqrt(max(f1Sq, 0.0));\r
  let f2 = sqrt(max(f2Sq, 0.0));\r
  return max(f2 - f1, 0.0);\r
}\r
\r
// edgeDist is gap (or gapSq for *_SQ modes)\r
// returns 1 near edges (small edgeDist), 0 in interior\r
fn voro_edge_mask(edgeDist: f32, threshold: f32, feather: f32) -> f32 {\r
  let t = max(threshold, 0.0);\r
  if (t <= 0.0) { return 0.0; }\r
\r
  let f = max(feather, 0.0);\r
  if (f > 0.0) {\r
    return 1.0 - smoothstep(t, t + f, edgeDist);\r
  }\r
  return select(0.0, 1.0, edgeDist < t);\r
}\r
\r
// returns 0 below threshold, 1 above (optionally smoothed)\r
fn voro_thresh_mask(v: f32, threshold: f32, feather: f32) -> f32 {\r
  let t = max(threshold, 0.0);\r
  if (t <= 0.0) { return 0.0; }\r
\r
  let f = max(feather, 0.0);\r
  if (f > 0.0) {\r
    return smoothstep(t, t + f, v);\r
  }\r
  return select(0.0, 1.0, v >= t);\r
}\r
\r
\r
// f1Sq/f2Sq are squared distances; cellVal in [0,1].\r
// edgeK is scale (edges modes) or feather (mask modes). freqOrScale unused.\r
fn voro_eval(\r
  f1Sq: f32,\r
  f2Sq: f32,\r
  cellVal: f32,\r
  mode: u32,\r
  edgeK: f32,\r
  threshold: f32,\r
  freqOrScale: f32\r
) -> f32 {\r
  let f1 = sqrt(max(f1Sq, 0.0));\r
  let f2 = sqrt(max(f2Sq, 0.0));\r
  let gap = max(f2 - f1, 0.0);\r
\r
  let gapSq = max(f2Sq - f1Sq, 0.0);\r
\r
  switch (mode) {\r
    case VORO_CELL: {\r
      return cellVal;\r
    }\r
    case VORO_F1: {\r
      return f1;\r
    }\r
    case VORO_INTERIOR: {\r
      return gap;\r
    }\r
    case VORO_EDGES: {\r
      let k = max(edgeK, 0.0);\r
      return clamp(gap * select(10.0, k, k > 0.0), 0.0, 1.0);\r
    }\r
    case VORO_EDGE_THRESH: {\r
      let t = max(threshold, 0.0);\r
      let gate = select(0.0, 1.0, gap >= t);\r
      return gap * gate;\r
    }\r
    case VORO_FLAT_SHADE: {\r
      let edge = voro_edge_mask(gap, threshold, edgeK);\r
      return 1.0 - edge;\r
    }\r
    case VORO_FLAT_SHADE_INV: {\r
      let edge = voro_edge_mask(gap, threshold, edgeK);\r
      return edge;\r
    }\r
\r
    case VORO_INTERIOR_SQ: {\r
      return gapSq;\r
    }\r
    case VORO_EDGES_SQ: {\r
      let k = max(edgeK, 0.0);\r
      return clamp(gapSq * select(10.0, k, k > 0.0), 0.0, 1.0);\r
    }\r
    case VORO_EDGE_THRESH_SQ: {\r
      let t = max(threshold, 0.0);\r
      let gate = select(0.0, 1.0, gapSq >= t);\r
      return gapSq * gate;\r
    }\r
    case VORO_FLAT_SHADE_SQ: {\r
      let edge = voro_edge_mask(gapSq, threshold, edgeK);\r
      return 1.0 - edge;\r
    }\r
    case VORO_FLAT_SHADE_INV_SQ: {\r
      let edge = voro_edge_mask(gapSq, threshold, edgeK);\r
      return edge;\r
    }\r
\r
    case VORO_F1_THRESH: {\r
      let t = max(threshold, 0.0);\r
      let gate = select(0.0, 1.0, f1 >= t);\r
      return f1 * gate;\r
    }\r
    case VORO_F1_MASK: {\r
      return voro_thresh_mask(f1, threshold, edgeK);\r
    }\r
    case VORO_F1_MASK_INV: {\r
      return 1.0 - voro_thresh_mask(f1, threshold, edgeK);\r
    }\r
\r
    case VORO_EDGE_RCP: {\r
      let k = max(edgeK, 0.0);\r
      return 1.0 / (1.0 + gap * k*10);\r
    }\r
    case VORO_EDGE_RCP_SQ: {\r
      let k = max(edgeK, 0.0);\r
      return 1.0 / (1.0 + gapSq * k*10);\r
    }\r
\r
    default: {\r
      return gap;\r
    }\r
  }\r
}\r
\r
// ----------------- helpers: metrics -----------------\r
fn voro3D_metrics(pos: vec3<f32>) -> Voro3DMetrics {\r
  let fx = i32(floor(pos.x));\r
  let fy = i32(floor(pos.y));\r
  let fz = i32(floor(pos.z));\r
\r
  var d1 : f32 = 1e9;\r
  var d2 : f32 = 1e9;\r
  var lab: f32 = 0.0;\r
\r
  for (var dz = -1; dz <= 1; dz = dz + 1) {\r
    for (var dy = -1; dy <= 1; dy = dy + 1) {\r
      for (var dx = -1; dx <= 1; dx = dx + 1) {\r
        let xi = fx + dx; let yi = fy + dy; let zi = fz + dz;\r
\r
        let rx = rand3u(xi, yi, zi);\r
        let ry = rand3u(yi, zi, xi);\r
        let rz = rand3u(zi, xi, yi);\r
\r
        let px = f32(xi) + rx;\r
        let py = f32(yi) + ry;\r
        let pz = f32(zi) + rz;\r
\r
        let dxv = px - pos.x;\r
        let dyv = py - pos.y;\r
        let dzv = pz - pos.z;\r
\r
        let d2c = dxv*dxv + dyv*dyv + dzv*dzv;\r
\r
        if (d2c < d1) {\r
          d2 = d1;\r
          d1 = d2c;\r
          lab = rand3u(xi, yi, zi);\r
        } else if (d2c < d2) {\r
          d2 = d2c;\r
        }\r
      }\r
    }\r
  }\r
  return Voro3DMetrics(d1, d2, lab);\r
}\r
\r
fn voro4D_metrics(p: vec4<f32>) -> Voro4DMetrics {\r
  let fx = i32(floor(p.x));\r
  let fy = i32(floor(p.y));\r
  let fz = i32(floor(p.z));\r
  let fw = i32(floor(p.w));\r
\r
  var d1 : f32 = 1e9;\r
  var d2 : f32 = 1e9;\r
  var lab: f32 = 0.0;\r
\r
  for (var dw = -1; dw <= 1; dw = dw + 1) {\r
    for (var dz = -1; dz <= 1; dz = dz + 1) {\r
      for (var dy = -1; dy <= 1; dy = dy + 1) {\r
        for (var dx = -1; dx <= 1; dx = dx + 1) {\r
          let xi = fx + dx; let yi = fy + dy; let zi = fz + dz; let wi = fw + dw;\r
\r
          let rx = rand4u(xi, yi, zi, wi);\r
          let ry = rand4u(yi, zi, wi, xi);\r
          let rz = rand4u(zi, wi, xi, yi);\r
          let rw = rand4u(wi, xi, yi, zi);\r
\r
          let px = f32(xi) + rx;\r
          let py = f32(yi) + ry;\r
          let pz = f32(zi) + rz;\r
          let pw = f32(wi) + rw;\r
\r
          let dxv = px - p.x; let dyv = py - p.y;\r
          let dzv = pz - p.z; let dwv = pw - p.w;\r
\r
          let d2c = dxv*dxv + dyv*dyv + dzv*dzv + dwv*dwv;\r
\r
          if (d2c < d1) {\r
            d2 = d1;\r
            d1 = d2c;\r
            lab = rand4u(xi, yi, zi, wi);\r
          } else if (d2c < d2) {\r
            d2 = d2c;\r
          }\r
        }\r
      }\r
    }\r
  }\r
  return Voro4DMetrics(d1, d2, lab);\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Cellular 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn cellular2D(pos : vec2<f32>) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
\r
    var minDist1 : f32 = 1e9;\r
    var minDist2 : f32 = 1e9;\r
\r
    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {\r
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {\r
            let xi = fx + dx;\r
            let yi = fy + dy;\r
\r
            /* feature point */\r
            let px = f32(xi) + rand2u(xi, yi);\r
            let py = f32(yi) + rand2u(yi, xi);\r
\r
            /* squared distance */\r
            let d = (px - pos.x) * (px - pos.x)\r
                  + (py - pos.y) * (py - pos.y);\r
\r
            /* keep two smallest distances */\r
            if (d < minDist1) {\r
                minDist2 = minDist1;\r
                minDist1 = d;\r
            } else if (d < minDist2) {\r
                minDist2 = d;\r
            }\r
        }\r
    }\r
    /* return difference of 1st and 2nd nearest feature distances */\r
    return minDist2 - minDist1;\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Worley 2-D  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn worley2D(pos : vec2<f32>) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
\r
    var minDist : f32 = 1e9;\r
\r
    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {\r
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {\r
            let xi = fx + dx;\r
            let yi = fy + dy;\r
\r
            /* feature point */\r
            let px = f32(xi) + rand2u(xi, yi);\r
            let py = f32(yi) + rand2u(yi, xi);\r
\r
            /* squared distance */\r
            let d = (px - pos.x) * (px - pos.x)\r
                  + (py - pos.y) * (py - pos.y);\r
\r
            if (d < minDist) {\r
                minDist = d;\r
            }\r
        }\r
    }\r
\r
    return sqrt(minDist);    // Euclidean distance to nearest feature\r
}\r
\r
/* central-diff gradient of scalar simplex */\r
fn gradSimplex2(q: vec2<f32>, eps: f32) -> vec2<f32> {\r
  let dx = (simplex2D(q + vec2<f32>(eps, 0.0)) - simplex2D(q - vec2<f32>(eps, 0.0))) / (2.0 * eps);\r
  let dy = (simplex2D(q + vec2<f32>(0.0, eps)) - simplex2D(q - vec2<f32>(0.0, eps))) / (2.0 * eps);\r
  return vec2<f32>(dx, dy);\r
}\r
\r
/* single-octave curl = grad rotated 90\xB0 (\u2202N/\u2202y, -\u2202N/\u2202x) */\r
fn curl2_simplex2D(pos: vec2<f32>, p: NoiseParams) -> vec2<f32> {\r
  let q = (pos / p.zoom) * p.freq + vec2<f32>(p.xShift, p.yShift);\r
\r
  // choose \u03B5 ~ half a cycle of current scale to avoid lattice aliasing\r
  let cycles_per_world = max(p.freq / max(p.zoom, 1e-6), 1e-6);\r
  let eps = 0.5 / cycles_per_world;\r
\r
  let g = gradSimplex2(q, eps);\r
  return vec2<f32>(g.y, -g.x);\r
}\r
\r
/* multi-octave curl: sum derivatives per octave (no sharp creases) */\r
fn curl2_simplexFBM(pos: vec2<f32>, p: NoiseParams) -> vec2<f32> {\r
  var q      = (pos / p.zoom) * p.freq + vec2<f32>(p.xShift, p.yShift);\r
  var freq   : f32 = p.freq;\r
  var amp    : f32 = 1.0;\r
  var angle  : f32 = p.seedAngle;\r
  var curl   : vec2<f32> = vec2<f32>(0.0);\r
\r
  for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {\r
    // \u03B5 scales with octave so the finite difference stays well-conditioned\r
    let cycles_per_world = max(freq / max(p.zoom, 1e-6), 1e-6);\r
    let eps = 0.5 / cycles_per_world;\r
\r
    let g = gradSimplex2(q * freq, eps * freq);\r
    curl += vec2<f32>(g.y, -g.x) * amp;\r
\r
    // next octave\r
    freq *= p.lacunarity;\r
    amp  *= p.gain;\r
\r
    // decorrelate like your Perlin path (XY rotate + shift bleed into next)\r
    let cA = cos(angle);\r
    let sA = sin(angle);\r
    let nx = q.x * cA - q.y * sA;\r
    let ny = q.x * sA + q.y * cA;\r
    q = vec2<f32>(nx, ny) + vec2<f32>(p.xShift, p.yShift);\r
    angle += ANGLE_INCREMENT;\r
  }\r
  return curl;\r
}\r
\r
/* map a non-negative magnitude to [-1,1] for your writeChannel convention */\r
fn mag_to_signed01(m: f32) -> f32 {\r
  return clamp(m, 0.0, 1.0) * 2.0 - 1.0;\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Domain-warp FBM  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn domainWarpFBM(p: vec3<f32>, params: NoiseParams,\r
                 warpAmp: f32, stages: u32) -> f32 {\r
    var q = p;\r
    for (var i: u32 = 0u; i < stages; i = i + 1u) {\r
        let w = fbm3D(q, params) * warpAmp;\r
        q = q + vec3<f32>(w, w, w);\r
    }\r
    return fbm3D(q, params);\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Gabor sparse-convolution  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn gaborOctave3D(p: vec3<f32>, radius: f32) -> f32 {\r
    // 3 taps in a tiny kernel to keep it cheap\r
    let R = max(0.001, radius);\r
    var sum : f32 = 0.0;\r
    for (var i = -1; i <= 1; i = i + 1) {\r
        for (var j = -1; j <= 1; j = j + 1) {\r
            let xi = vec3<f32>(f32(i), f32(j), 0.0);\r
            let w  = exp(-dot(xi, xi) / (R * R));\r
            let n  = simplex3D(p + xi);  // using simplex as the carrier\r
            sum += w * n;\r
        }\r
    }\r
    return sum * 0.75; // keep in ~[-1,1]\r
}\r
\r
/* Multi-octave Gabor with the same rotate/shift cadence as Perlin */\r
fn gaborNoise3D(p: vec3<f32>, params: NoiseParams) -> f32 {\r
    var x = p.x / params.zoom * params.freq + params.xShift;\r
    var y = p.y / params.zoom * params.freq + params.yShift;\r
    var z = p.z / params.zoom * params.freq + params.zShift;\r
\r
    var sum     : f32 = 0.0;\r
    var amp     : f32 = 1.0;\r
    var freqLoc : f32 = params.freq;\r
    var angle   : f32 = params.seedAngle;\r
\r
    // tie kernel radius to frequency so bandwidth tracks lacunarity\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let radius = max(0.001, params.gaborRadius / freqLoc);\r
        var n = gaborOctave3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc), radius);\r
        if (params.turbulence == 1u) { n = abs(n); }\r
        sum += n * amp;\r
\r
        freqLoc *= params.lacunarity;\r
        amp     *= params.gain;\r
\r
        let c  = cos(angle);\r
        let s  = sin(angle);\r
        let nx = x * c - y * s;\r
        let ny = x * s + y * c;\r
        let nz = y * s + z * c;\r
\r
        x = nx + params.xShift;\r
        y = ny + params.yShift;\r
        z = nz + params.zShift;\r
\r
        angle += ANGLE_INCREMENT;\r
    }\r
\r
    if (params.turbulence == 1u) { sum = sum - 1.0; }\r
    return sum;\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Terrace & Foam filters  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn terrace(v:f32, steps:f32)  -> f32 { return floor(v*steps)/steps; }\r
fn foamify(v:f32)             -> f32 { return pow(abs(v), 3.0)*sign(v); }\r
fn turbulence(v:f32)          -> f32 { return abs(v); }\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Simplex (multi-octave) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn generateSimplex(pos: vec3<f32>, p: NoiseParams) -> f32 {\r
    // start coords (zoom/freq/shift)\r
    var x = pos.x / p.zoom * p.freq + p.xShift;\r
    var y = pos.y / p.zoom * p.freq + p.yShift;\r
    var z = pos.z / p.zoom * p.freq + p.zShift;\r
\r
    var sum     : f32 = 0.0;\r
    var amp     : f32 = 1.0;\r
    var freqLoc : f32 = p.freq;\r
    var angle   : f32 = p.seedAngle;\r
\r
    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {\r
        var n = simplex3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));\r
        if (p.turbulence == 1u) { n = abs(n); }\r
        sum += n * amp;\r
\r
        // advance octave\r
        freqLoc *= p.lacunarity;\r
        amp     *= p.gain;\r
\r
        // rotate in XY and bleed into Z \u2014 matches your Perlin cadence\r
        let c  = cos(angle);\r
        let s  = sin(angle);\r
        let nx = x * c - y * s;\r
        let ny = x * s + y * c;\r
        let nz = y * s + z * c;\r
\r
        x = nx + p.xShift;\r
        y = ny + p.yShift;\r
        z = nz + p.zShift;\r
\r
        angle += ANGLE_INCREMENT;\r
    }\r
\r
    if (p.turbulence == 1u) { sum -= 1.0; }\r
    return sum;\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Simplex-based fBm helper (normalized)  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn sfbm3D(pos : vec3<f32>, params: NoiseParams) -> f32 {\r
    var x = (pos.x + params.xShift) / params.zoom;\r
    var y = (pos.y + params.yShift) / params.zoom;\r
    var z = (pos.z + params.zShift) / params.zoom;\r
\r
    var sum       : f32 = 0.0;\r
    var amplitude : f32 = 1.0;\r
    var maxValue  : f32 = 0.0;\r
    var freqLoc   : f32 = params.freq;\r
\r
    var angle     : f32 = params.seedAngle;\r
    let angleInc  : f32 = 2.0 * PI / max(f32(params.octaves), 1.0);\r
\r
    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {\r
        var n = simplex3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));\r
        if (params.turbulence == 1u) { n = abs(n); }\r
\r
        sum      += amplitude * n;\r
        maxValue += amplitude;\r
\r
        freqLoc   *= params.lacunarity;\r
        amplitude *= params.gain;\r
\r
        // rotate & shift per octave (keeps look consistent with Perlin FBM)\r
        angle += angleInc;\r
        let c = cos(angle);\r
        let s = sin(angle);\r
        let nx = x * c - y * s;\r
        let ny = x * s + y * c;\r
        let nz = y * s + z * c;\r
        x = nx + params.xShift;\r
        y = ny + params.yShift;\r
        z = nz + params.zShift;\r
    }\r
\r
    if (maxValue > 0.0) {\r
        return sum / maxValue;\r
    }\r
    return 0.0;\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Simplex FBM (Perlin-style nested fBm)  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn generateSimplexFBM(pos: vec3<f32>, p: NoiseParams) -> f32 {\r
    // Same  you use for Perlin FBM: fBm once, then feed through again\r
    let fbm1 = sfbm3D(pos, p);\r
    let fbm2 = sfbm3D(vec3<f32>(fbm1, fbm1, fbm1), p);\r
    return 2.0 * fbm2;  // keep roughly in [-1,1]\r
}\r
\r
fn generateDomainWarpFBM1(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
    let v = domainWarpFBM(pos, par, par.warpAmp, 1u);\r
    return v;\r
}\r
\r
fn generateDomainWarpFBM2(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
    let v = domainWarpFBM(pos, par, par.warpAmp, 2u);\r
    return v;\r
}\r
\r
fn generateGaborAniso(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
    let v = gaborNoise3D(pos, par);\r
    return v;\r
}\r
\r
fn generateTerraceNoise(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
    let base = generatePerlin(pos, par);\r
    let v = terrace(base, par.terraceStep);\r
    return v;\r
}\r
\r
fn generateFoamNoise(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
    let base = generateBillow(pos, par);\r
    let v = foamify(base);\r
    return v;\r
}\r
\r
fn generateTurbulence(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
    let base = generatePerlin(pos, par);\r
    let v = turbulence(base);\r
    return v;\r
}\r
\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Perlin Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generatePerlin(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    // initial coords scaled by zoom\r
    var x = pos.x / params.zoom * params.freq + params.xShift;\r
    var y = pos.y / params.zoom * params.freq + params.yShift;\r
    var z = pos.z / params.zoom * params.freq + params.zShift;\r
\r
    var sum : f32 = 0.0;\r
    var amp : f32 = 1.0;\r
    var freqLoc : f32 = params.freq;\r
    var angle : f32 = params.seedAngle;\r
\r
    // accumulate octaves\r
    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {\r
        // sample base noise\r
        var n : f32 = noise3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)) * amp;\r
        // optional billow / turbulence\r
        if (params.turbulence == 1u) {\r
            n = abs(n);\r
        }\r
        sum = sum + n;\r
\r
        // update frequency & amplitude\r
        freqLoc = freqLoc * params.lacunarity;\r
        amp     = amp     * params.gain;\r
\r
        // rotate coords in XY plane + push into Z\r
        let c = cos(angle);\r
        let s = sin(angle);\r
        let nx = x * c - y * s;\r
        let ny = x * s + y * c;\r
        let nz = y * s + z * c;\r
\r
        // apply shifts\r
        x = nx + params.xShift;\r
        y = ny + params.yShift;\r
        z = nz + params.zShift;\r
\r
        // increment angle\r
        angle = angle + ANGLE_INCREMENT;\r
    }\r
\r
    // final tweak for turbulence mode\r
    if (params.turbulence == 1u) {\r
        sum = sum - 1.0;\r
    }\r
    return sum;\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Perlin FBM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generatePerlin4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  // Prepare base coords + starting frequency\r
  var base    : vec4<f32>;\r
  var freqLoc : f32;\r
\r
  if (params.toroidal == 1u) {\r
    // pos = (U,V,\u03B8); HTML-style: apply zoom outside the octave loop\r
    base    = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;\r
    freqLoc = params.freq;                 // (freq/zoom) == (base/zoom * freq)\r
  } else {\r
    // original non-toroidal semantics (note: freq is baked in before the loop)\r
    base = vec4<f32>(\r
      pos.x / zoom * params.freq + params.xShift,\r
      pos.y / zoom * params.freq + params.yShift,\r
      pos.z / zoom * params.freq + params.zShift,\r
      params.time\r
    );\r
    freqLoc = params.freq;\r
  }\r
\r
  var sum   : f32 = 0.0;\r
  var amp   : f32 = 1.0;\r
  var angle : f32 = params.seedAngle;\r
\r
  // Shared octave loop\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    var n = noise4D(base * freqLoc) * amp;\r
    if (params.turbulence == 1u) { n = abs(n); }\r
    sum += n;\r
\r
    freqLoc *= params.lacunarity;\r
    amp     *= params.gain;\r
\r
    // Only the non-toroidal path uses octave rotation/offset churn\r
    if (params.toroidal != 1u) {\r
      let c = cos(angle);\r
      let s = sin(angle);\r
      let xy = vec2<f32>( base.x * c - base.y * s, base.x * s + base.y * c );\r
      let zw = vec2<f32>( base.z * c - base.w * s, base.z * s + base.w * c );\r
      base = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
      angle += ANGLE_INCREMENT;\r
    }\r
  }\r
\r
  if (params.turbulence == 1u) { sum -= 1.0; }\r
  return sum;\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Billow Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateBillow(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    // Base domain mapping\r
    var p = (pos / params.zoom) * params.freq\r
          + vec3<f32>(params.xShift, params.yShift, params.zShift);\r
\r
    var sum: f32     = 0.0;\r
    var amp: f32     = 1.0;\r
    var freqLoc: f32 = 1.0;          // start at base; multiply by lacunarity each octave\r
    var ampSum: f32  = 0.0;\r
    var angle: f32   = params.seedAngle;\r
\r
    // Octave stack\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        // Billow core: absolute value of gradient noise\r
        let n  = noise3D(p * freqLoc);\r
        let b  = pow(abs(n), 0.75);   // gentle gamma (<1) puffs the domes\r
        sum    = sum + b * amp;\r
        ampSum = ampSum + amp;\r
\r
        // Advance octave\r
        freqLoc = freqLoc * params.lacunarity;\r
        amp     = amp     * params.gain;\r
\r
        // Cheap domain rotation (XY) + tiny Z drift to break symmetry\r
        let c  = cos(angle);\r
        let s  = sin(angle);\r
        let xy = vec2<f32>(p.x, p.y);\r
        let r  = vec2<f32>(xy.x * c - xy.y * s, xy.x * s + xy.y * c);\r
        p = vec3<f32>(r.x, r.y, p.z + 0.03125);   // small constant drift\r
\r
        angle = angle + ANGLE_INCREMENT;\r
    }\r
\r
    // Normalize to [0,1]\r
    if (ampSum > 0.0) {\r
        sum = sum / ampSum;\r
    }\r
\r
    // Mild contrast curve around 0.5 so domes pop without creating ridge-like creases\r
    let k: f32 = 1.2;                // 1.0 = linear; >1 increases local contrast\r
    let cMid   = sum - 0.5;\r
    let shaped = 0.5 + cMid * k / (1.0 + abs(cMid) * (k - 1.0));\r
\r
    return clamp(shaped, 0.0, 1.0);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti-Billow Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateAntiBillow(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    return 1.0 - generateBillow(pos, params);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridge Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// basic ridge transform of gradient noise\r
fn ridgeNoise(pos : vec3<f32>) -> f32 {\r
    let v = noise3D(pos);\r
    let w = 1.0 - abs(v);\r
    return w * w;\r
}\r
\r
// octave\u2010sum generator using ridge noise\r
// sample like: let r = generateRidge(vec3<f32>(x,y,z));\r
fn generateRidge(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    var x = pos.x / params.zoom * params.freq + params.xShift;\r
    var y = pos.y / params.zoom * params.freq + params.yShift;\r
    var z = pos.z / params.zoom * params.freq + params.zShift;\r
    var sum     : f32 = 0.0;\r
    var amp     : f32 = 1.0;\r
    var freqLoc : f32 = params.freq;\r
\r
    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {\r
        sum = sum + ridgeNoise(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)) * amp;\r
        freqLoc = freqLoc * params.lacunarity;\r
        amp     = amp     * params.gain;\r
        x = x + params.xShift;\r
        y = y + params.yShift;\r
        z = z + params.zShift;\r
    }\r
\r
    // JS did: sum -= 1; return -sum;\r
    sum = sum - 1.0;\r
    return -sum;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridge Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// identical ridge transform, but flips sign at output\r
fn generateAntiRidge(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    // reuse generateRidge and negate its result\r
    return -generateRidge(pos, params);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise (Fast Lanczos) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateRidgedMultifractal(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    // initial coords: zoom + freq\r
    var x = pos.x / params.zoom * params.freq + params.xShift;\r
    var y = pos.y / params.zoom * params.freq + params.yShift;\r
    var z = pos.z / params.zoom * params.freq + params.zShift;\r
\r
    // first octave\r
    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x, y, z)));\r
    var amp : f32 = 1.0;\r
\r
    // subsequent octaves\r
    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {\r
        x = x * params.lacunarity;\r
        y = y * params.lacunarity;\r
        z = z * params.lacunarity;\r
        amp = amp * params.gain;\r
\r
        var n : f32 = abs(lanczos3D(vec3<f32>(x, y, z)));\r
        if (params.exp2 != 0.0) {\r
            n = 1.0 - pow(n, params.exp2);\r
        }\r
        if (params.exp1 != 0.0) {\r
            n = pow(n, params.exp1);\r
        }\r
\r
        sum = sum - n * amp;\r
\r
        x = x + params.xShift;\r
        y = y + params.yShift;\r
        z = z + params.zShift;\r
    }\r
\r
    return sum;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise 2 (Fast Lanczos + Rotation) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateRidgedMultifractal2(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    // zoom + freq\r
    var x = (pos.x + params.xShift) / params.zoom * params.freq;\r
    var y = (pos.y + params.yShift) / params.zoom * params.freq;\r
    var z = (pos.z + params.zShift) / params.zoom * params.freq;\r
\r
    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x, y, z)));\r
    var amp : f32 = 1.0;\r
    var angle : f32 = params.seedAngle;\r
\r
    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {\r
        x = x * params.lacunarity;\r
        y = y * params.lacunarity;\r
        z = z * params.lacunarity;\r
        amp = amp * params.gain;\r
\r
        var n : f32 = abs(lanczos3D(vec3<f32>(x, y, z)));\r
        if (params.exp2 != 0.0) {\r
            n = 1.0 - pow(n, params.exp2);\r
        }\r
        if (params.exp1 != 0.0) {\r
            n = pow(n, params.exp1);\r
        }\r
\r
        sum = sum - n * amp;\r
\r
        // proper 2D rotation around Z:\r
        let c = cos(angle);\r
        let s = sin(angle);\r
        let nx = x * c - y * s;\r
        let ny = x * s + y * c;\r
        let nz = z;\r
\r
        x = nx + params.xShift;\r
        y = ny + params.yShift;\r
        z = nz + params.zShift;\r
\r
        angle = angle + ANGLE_INCREMENT;\r
    }\r
\r
    return sum;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise 3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateRidgedMultifractal3(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    // zoom + freq\r
    var x = (pos.x + params.xShift) / params.zoom * params.freq;\r
    var y = (pos.y + params.yShift) / params.zoom * params.freq;\r
    var z = (pos.z + params.zShift) / params.zoom * params.freq;\r
    var sum : f32 = 0.0;\r
    var amp : f32 = 1.0;\r
\r
    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {\r
        var n : f32 = lanczos3D(vec3<f32>(x, y, z));\r
        n = max(1e-7, n + 1.0);\r
        n = 2.0 * pow(n * 0.5, params.exp2+1.5) - 1.0;\r
        n = 1.0 - abs(n);\r
        if (params.exp1 - 1.0 != 0.0) {\r
            n = 1.0 - pow(n, params.exp1 - 1.0);\r
        }\r
\r
        sum = sum + n * amp;\r
\r
        x = x * params.lacunarity + params.xShift;\r
        y = y * params.lacunarity + params.yShift;\r
        z = z * params.lacunarity + params.zShift;\r
        amp = amp * params.gain;\r
    }\r
\r
    return sum - 1.0;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise 4 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateRidgedMultifractal4(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    var x = (pos.x + params.xShift) / params.zoom * params.freq;\r
    var y = (pos.y + params.yShift) / params.zoom * params.freq;\r
    var z = (pos.z + params.zShift) / params.zoom * params.freq;\r
    var sum : f32 = 0.0;\r
    var amp : f32 = 1.0;\r
\r
    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {\r
        var n : f32 = abs(lanczos3D(vec3<f32>(x, y, z)));\r
        if (params.exp2 != 0.0) {\r
            n = 1.0 - pow(n, params.exp2);\r
        }\r
        if (params.exp1 != 0.0) {\r
            n = pow(n, params.exp1);\r
        }\r
\r
        sum = sum + n * amp;\r
\r
        x = x * params.lacunarity + params.xShift;\r
        y = y * params.lacunarity + params.yShift;\r
        z = z * params.lacunarity + params.zShift;\r
        amp = amp * params.gain;\r
    }\r
\r
    return sum - 1.0;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateAntiRidgedMultifractal(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    return -generateRidgedMultifractal(pos, params);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise 2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateAntiRidgedMultifractal2(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    return -generateRidgedMultifractal2(pos, params);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise 3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateAntiRidgedMultifractal3(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    return -generateRidgedMultifractal3(pos, params);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Anti\u2010Ridged Multifractal Noise 4 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateAntiRidgedMultifractal4(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    return -generateRidgedMultifractal4(pos, params);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Fractal Brownian Motion (3D Simplex) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
\r
// 3-D FBM helper: sums octaves of simplex noise with rotating shifts\r
fn fbm3D(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    // apply zoom\r
    var x       = (pos.x + params.xShift) / params.zoom;\r
    var y       = (pos.y + params.yShift) / params.zoom;\r
    var z       = (pos.z + params.zShift) / params.zoom;\r
    var sum       : f32 = 0.0;\r
    var amplitude : f32 = 1.0;\r
    var maxValue  : f32 = 0.0;\r
    var freqLoc   : f32 = params.freq;\r
    // start angle from uniform seedAngle\r
    var angle     : f32 = params.seedAngle;\r
    let angleInc  : f32 = 2.0 * PI / f32(params.octaves);\r
\r
    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {\r
        // accumulate weighted noise\r
        sum = sum + amplitude * simplex3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));\r
        maxValue = maxValue + amplitude;\r
\r
        // next freq & amp\r
        freqLoc   = freqLoc * params.lacunarity;\r
        amplitude = amplitude * params.gain;\r
\r
        // advance rotation\r
        angle = angle + angleInc;\r
        let offX = params.xShift * cos(angle);\r
        let offY = params.yShift * cos(angle);\r
        let offZ = params.zShift * cos(angle);\r
\r
        // apply shift\r
        x = x + offX;\r
        y = y + offY;\r
        z = z + offZ;\r
    }\r
    // normalize\r
    return sum / maxValue;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 FBM Generator #1 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// two\u2010stage fbm, then doubled\r
fn generateFBM(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    let fbm1 = fbm3D(pos, params);\r
    let fbm2 = fbm3D(vec3<f32>(fbm1, fbm1, fbm1), params);\r
    return 2.0 * fbm2;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 FBM Generator #2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// chained fbm with scaling by zoom\r
fn generateFBM2(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    let fbm1 = fbm3D(pos, params);\r
    let s    = params.zoom;\r
    let fbm2 = fbm3D(vec3<f32>(fbm1 * s, fbm1 * s, fbm1 * s), params);\r
    let fbm3 = fbm3D(vec3<f32>(pos.x + fbm2 * s,\r
                               pos.y + fbm2 * s,\r
                               pos.z + fbm2 * s), params);\r
    return 2.0 * fbm3;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 FBM Generator #3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// three\u2010step chaining of fbm with offset\r
fn generateFBM3(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    let fbm1 = fbm3D(pos, params);\r
    let s    = params.zoom;\r
    let fbm2 = fbm3D(vec3<f32>(pos.x + fbm1 * s,\r
                               pos.y + fbm1 * s,\r
                               pos.z + fbm1 * s), params);\r
    let fbm3 = fbm3D(vec3<f32>(pos.x + fbm2 * s,\r
                               pos.y + fbm2 * s,\r
                               pos.z + fbm2 * s), params);\r
    return 2.0 * fbm3;\r
}\r
\r
/*==============================================================================\r
  Cellular Brownian-Motion FBM helpers & generators\r
==============================================================================*/\r
\r
fn edgeCut(val: f32, threshold: f32) -> f32 {\r
  // return 0.0 when val < threshold, otherwise return val\r
  return select(val, 0.0, val < threshold);\r
}\r
\r
// 3-D Cellular FBM helper: sums octaves of cellular3D with rotating shifts\r
fn fbmCellular3D(pos : vec3<f32>, params : NoiseParams) -> f32 {\r
    var x = (pos.x + params.xShift) / params.zoom;\r
    var y = (pos.y + params.yShift) / params.zoom;\r
    var z = (pos.z + params.zShift) / params.zoom;\r
\r
    var sum     : f32 = 0.0;\r
    var amp     : f32 = 1.0;\r
    var freqLoc : f32 = params.freq;\r
\r
    var angle   : f32 = params.seedAngle;\r
    let angleInc: f32 = 2.0 * PI / f32(params.octaves);\r
\r
    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let n = edgeCut(cellular3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)),\r
                        params.threshold);\r
        sum = sum + amp * n;\r
\r
        freqLoc = freqLoc * params.lacunarity;\r
        amp     = amp     * params.gain;\r
\r
        angle = angle + angleInc;\r
        let offX = params.xShift * cos(angle);\r
        let offY = params.yShift * cos(angle);\r
        let offZ = params.zShift * cos(angle);\r
\r
        x = x + offX;\r
        y = y + offY;\r
        z = z + offZ;\r
    }\r
    return sum;\r
}\r
\r
/* ---- Three cellular FBM flavours ---------------------------------------- */\r
fn generateCellularBM1(pos : vec3<f32>, params : NoiseParams) -> f32 {\r
    let f1 = fbmCellular3D(pos, params);\r
    let f2 = fbmCellular3D(vec3<f32>(f1 * params.zoom), params);\r
    return 1.5 * f2 - 1.0;\r
}\r
\r
fn generateCellularBM2(pos : vec3<f32>, params : NoiseParams) -> f32 {\r
    let f1 = fbmCellular3D(pos, params);\r
    let f2 = fbmCellular3D(vec3<f32>(f1 * params.zoom), params);\r
    let f3 = fbmCellular3D(vec3<f32>(pos + f2 * params.zoom), params);\r
    return 1.5 * f3 - 1.0;\r
}\r
\r
fn generateCellularBM3(pos : vec3<f32>, params : NoiseParams) -> f32 {\r
    let f1 = fbmCellular3D(pos, params);\r
    let f2 = fbmCellular3D(vec3<f32>(pos + f1 * params.zoom), params);\r
    let f3 = fbmCellular3D(vec3<f32>(pos + f2 * params.zoom), params);\r
    return 1.5 * f3 - 1.0;\r
}\r
\r
/* ---- Voronoi and Voronoi Brownian-Motion flavours ---------------------------------- */\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Voronoi Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateVoronoi4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  var sum: f32 = 0.0;\r
  var amp: f32 = 1.0;\r
  var freqLoc: f32 = params.freq / zoom;\r
\r
  let mode: u32 = params.voroMode;\r
  let edgeK: f32 = max(params.edgeK, 0.0);\r
  let threshold: f32 = max(params.threshold, 0.0);\r
\r
  var base: vec4<f32>;\r
  if (params.toroidal == 1u) {\r
    base = packPeriodicUV(pos.x, pos.y, pos.z + params.time);\r
  } else {\r
    base = vec4<f32>(\r
      (pos.x + params.xShift) / zoom,\r
      (pos.y + params.yShift) / zoom,\r
      (pos.z + params.zShift) / zoom,\r
      params.time\r
    );\r
  }\r
\r
  var angle: f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let P = base * freqLoc;\r
    let m = voro4D_metrics(P);\r
    let v = voro_eval(m.f1Sq, m.f2Sq, m.cellVal, mode, edgeK, threshold, freqLoc);\r
\r
    sum += v * amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp *= params.gain;\r
\r
    if (params.toroidal != 1u) {\r
      let c = cos(angle);\r
      let s = sin(angle);\r
      let xy = vec2<f32>(base.x * c - base.y * s, base.x * s + base.y * c);\r
      let zw = vec2<f32>(base.z * c - base.w * s, base.z * s + base.w * c);\r
      base = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
      angle += ANGLE_INCREMENT;\r
    }\r
  }\r
\r
  return sum;\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Voronoi Tile Noise (Edge-Aware) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateVoronoiTileNoise(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
  // match generateVoronoi zoom handling\r
  let zoom = max(params.zoom, 1e-6);\r
  var sum   : f32 = 0.0;\r
  var amp   : f32 = 1.0;\r
  var freqLoc : f32 = params.freq / zoom;\r
\r
  // always use the edge-threshold mode for this tile-noise helper\r
  let mode : u32 = params.voroMode;\r
  let edgeK : f32 = max(params.edgeK, 0.0);      // kept if you want to tune\r
  let thresh : f32 = max(params.threshold, 0.0);\r
\r
  // initial sample point (match non-toroidal branch of generateVoronoi)\r
  var x = (pos.x + params.xShift) / zoom;\r
  var y = (pos.y + params.yShift) / zoom;\r
  var z = (pos.z + params.zShift) / zoom;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    // build octave sample pos (same convention as generateVoronoi)\r
    let P = vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc);\r
\r
    // get metrics and evaluate using VORO_EDGE_THRESH (voro_eval implements F2-F1 gating)\r
    let m = voro3D_metrics(P);\r
    let v = voro_eval(m.f1Sq, m.f2Sq, m.cellVal, mode, edgeK, thresh, freqLoc);\r
\r
    sum = sum + v * amp;\r
\r
    // octave updates\r
    freqLoc = freqLoc * params.lacunarity;\r
    amp     = amp * params.gain;\r
\r
    // apply simple per-octave drift (matches previous tile-style)\r
    x = x + params.xShift;\r
    y = y + params.yShift;\r
    z = z + params.zShift;\r
  }\r
\r
  // NOTE: generateVoronoi returns the raw sum (not remapped).\r
  // If you need legacy behaviour that remapped to [-1,1], uncomment the next line:\r
  // return 2.0 * sum - 1.0;\r
\r
  return sum;\r
}\r
\r
\r
// BM1: f( f(p) )\r
fn generateVoronoiBM1(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateVoronoiTileNoise(p, par);\r
  return generateVoronoiTileNoise(vec3<f32>(f1 * par.zoom), par);\r
}\r
\r
// BM2: f( p + f(f(p)) )\r
fn generateVoronoiBM2(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateVoronoiTileNoise(p, par);\r
  let f2 = generateVoronoiTileNoise(vec3<f32>(f1 * par.zoom), par);\r
  return generateVoronoiTileNoise(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
// BM3: f( p + f(p + f(p)) )\r
fn generateVoronoiBM3(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateVoronoiTileNoise(p, par);\r
  let f2 = generateVoronoiTileNoise(p + vec3<f32>(f1 * par.zoom), par);\r
  return generateVoronoiTileNoise(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
/* ---- Voronoi Brownian-Motion flavours (4D) ---------------------------------- */\r
\r
// BM1 4D: f( f(p) )  (scalar feedback into XYZ, keep W/time from params)\r
fn generateVoronoiBM1_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateVoronoi4D(p, par);\r
  return generateVoronoi4D(vec3<f32>(f1 * par.zoom), par);\r
}\r
\r
// BM2 4D: f( p + f(f(p)) )\r
fn generateVoronoiBM2_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateVoronoi4D(p, par);\r
  let f2 = generateVoronoi4D(vec3<f32>(f1 * par.zoom), par);\r
  return generateVoronoi4D(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
// BM3 4D: f( p + f(p + f(p)) )\r
fn generateVoronoiBM3_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateVoronoi4D(p, par);\r
  let f2 = generateVoronoi4D(p + vec3<f32>(f1 * par.zoom), par);\r
  return generateVoronoi4D(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
/* ---- vector-feedback variants (stronger, less axis-locked) ---------\r
   These keep it cheap but reduce the "all axes get same scalar" look by building\r
   a 3-vector from 3 decorrelated samples (offsets are constant, no extra params).\r
*/\r
\r
fn _bm4D_vec(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {\r
  let a = generateVoronoi4D(p + vec3<f32>(17.13,  3.71,  9.23), par);\r
  let b = generateVoronoi4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);\r
  let c = generateVoronoi4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);\r
  return vec3<f32>(a, b, c);\r
}\r
\r
// BM1 4D (vec): f( vec(f(p)) )\r
fn generateVoronoiBM1_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec(p, par);\r
  return generateVoronoi4D(v1 * par.zoom, par);\r
}\r
\r
// BM2 4D (vec): f( p + vec(f(vec(f(p)))) )\r
fn generateVoronoiBM2_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec(p, par);\r
  let v2 = _bm4D_vec(v1 * par.zoom, par);\r
  return generateVoronoi4D(p + v2 * par.zoom, par);\r
}\r
\r
// BM3 4D (vec): f( p + vec(f(p + vec(f(p)))) )\r
fn generateVoronoiBM3_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec(p, par);\r
  let v2 = _bm4D_vec(p + v1 * par.zoom, par);\r
  return generateVoronoi4D(p + v2 * par.zoom, par);\r
}\r
\r
// Generic "Voronoi-style" sampler for Cellular/Worley so they can share voro_eval modes.\r
\r
struct VoroSample {\r
  f1Sq    : f32,\r
  f2Sq    : f32,\r
  cellVal : f32,\r
};\r
\r
fn voro_sample3D(p: vec3<f32>) -> VoroSample {\r
  let fx = i32(floor(p.x));\r
  let fy = i32(floor(p.y));\r
  let fz = i32(floor(p.z));\r
\r
  var d1: f32 = 1e9;\r
  var d2: f32 = 1e9;\r
  var cv: f32 = 0.0;\r
\r
  for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {\r
    for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {\r
      for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {\r
        let xi = fx + dx;\r
        let yi = fy + dy;\r
        let zi = fz + dz;\r
\r
        let rx = rand3u(xi, yi, zi);\r
        let ry = rand3u(yi, zi, xi);\r
        let rz = rand3u(zi, xi, yi);\r
\r
        let px = f32(xi) + rx;\r
        let py = f32(yi) + ry;\r
        let pz = f32(zi) + rz;\r
\r
        let dxv = px - p.x;\r
        let dyv = py - p.y;\r
        let dzv = pz - p.z;\r
        let dd  = dxv * dxv + dyv * dyv + dzv * dzv;\r
\r
        if (dd < d1) {\r
          d2 = d1;\r
          d1 = dd;\r
          cv = rand3u(xi, zi, yi);\r
        } else if (dd < d2) {\r
          d2 = dd;\r
        }\r
      }\r
    }\r
  }\r
\r
  return VoroSample(d1, d2, cv);\r
}\r
\r
fn voro_sample4D(p: vec4<f32>) -> VoroSample {\r
  let fx = i32(floor(p.x));\r
  let fy = i32(floor(p.y));\r
  let fz = i32(floor(p.z));\r
  let fw = i32(floor(p.w));\r
\r
  var d1: f32 = 1e9;\r
  var d2: f32 = 1e9;\r
  var cv: f32 = 0.0;\r
\r
  for (var dw: i32 = -1; dw <= 1; dw = dw + 1) {\r
    for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {\r
      for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {\r
        for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {\r
          let xi = fx + dx;\r
          let yi = fy + dy;\r
          let zi = fz + dz;\r
          let wi = fw + dw;\r
\r
          let rx = rand4u(xi, yi, zi, wi);\r
          let ry = rand4u(yi, zi, wi, xi);\r
          let rz = rand4u(zi, wi, xi, yi);\r
          let rw = rand4u(wi, xi, yi, zi);\r
\r
          let px = f32(xi) + rx;\r
          let py = f32(yi) + ry;\r
          let pz = f32(zi) + rz;\r
          let pw = f32(wi) + rw;\r
\r
          let dxv = px - p.x;\r
          let dyv = py - p.y;\r
          let dzv = pz - p.z;\r
          let dwv = pw - p.w;\r
          let dd  = dxv * dxv + dyv * dyv + dzv * dzv + dwv * dwv;\r
\r
          if (dd < d1) {\r
            d2 = d1;\r
            d1 = dd;\r
            cv = rand4u(xi, zi, yi, wi);\r
          } else if (dd < d2) {\r
            d2 = dd;\r
          }\r
        }\r
      }\r
    }\r
  }\r
\r
  return VoroSample(d1, d2, cv);\r
}\r
\r
fn cellular4D(p: vec4<f32>) -> f32 {\r
  let s = voro_sample4D(p);\r
  return voro_edge_dist(s.f1Sq, s.f2Sq);\r
}\r
\r
fn worley4D(p: vec4<f32>) -> f32 {\r
  let s = voro_sample4D(p);\r
  return sqrt(max(s.f1Sq, 0.0));\r
}\r
\r
// Expects you to pass the same controls you use for Voronoi: params.voroMode, params.edgeK, params.threshold.\r
fn generateCellular(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  var x = (pos.x + params.xShift) / params.zoom;\r
  var y = (pos.y + params.yShift) / params.zoom;\r
  var z = (pos.z + params.zShift) / params.zoom;\r
\r
  var sum     : f32 = 0.0;\r
  var amp     : f32 = 1.0;\r
  var freqLoc : f32 = params.freq;\r
  var angle   : f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let s = voro_sample3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));\r
\r
    var n = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);\r
    if (params.turbulence == 1u) { n = abs(n); }\r
    n = clamp(n, 0.0, 1.0);\r
\r
    sum = sum + n * amp;\r
\r
    freqLoc = freqLoc * params.lacunarity;\r
    amp     = amp     * params.gain;\r
\r
    let c = cos(angle);\r
    let sA = sin(angle);\r
    let nx = x * c - y * sA;\r
    let ny = x * sA + y * c;\r
    let nz = y * sA + z * c;\r
\r
    x = nx + params.xShift;\r
    y = ny + params.yShift;\r
    z = nz + params.zShift;\r
    angle = angle + ANGLE_INCREMENT;\r
  }\r
\r
  if (params.turbulence == 1u) { sum = sum - 1.0; }\r
  return 2.0 * sum - 1.0;\r
}\r
\r
fn generateAntiCellular(pos: vec3<f32>, params: NoiseParams) -> f32 { \r
  return -generateCellular(pos,params);\r
}\r
\r
fn generateWorley(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  var x = (pos.x + params.xShift) / params.zoom;\r
  var y = (pos.y + params.yShift) / params.zoom;\r
  var z = (pos.z + params.zShift) / params.zoom;\r
\r
  var sum     : f32 = 0.0;\r
  var amp     : f32 = 1.0;\r
  var freqLoc : f32 = params.freq;\r
  var angle   : f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let s = voro_sample3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));\r
\r
    var n = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);\r
    if (params.turbulence == 1u) { n = abs(n); }\r
    n = clamp(n, 0.0, 1.0);\r
\r
    sum = sum + n * amp;\r
\r
    freqLoc = freqLoc * params.lacunarity;\r
    amp     = amp     * params.gain;\r
\r
    let c = cos(angle);\r
    let sA = sin(angle);\r
    let nx = x * c - y * sA;\r
    let ny = x * sA + y * c;\r
    let nz = y * sA + z * c;\r
\r
    x = nx + params.xShift;\r
    y = ny + params.yShift;\r
    z = nz + params.zShift;\r
    angle = angle + ANGLE_INCREMENT;\r
  }\r
\r
  if (params.turbulence == 1u) { sum = sum - 1.0; }\r
  return sum - 1.0;\r
}\r
\r
fn generateAntiWorley(pos: vec3<f32>, params: NoiseParams) -> f32 { \r
  return -generateWorley(pos,params);\r
}\r
\r
fn generateCellular4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  var base    : vec4<f32>;\r
  var freqLoc : f32;\r
\r
  if (params.toroidal == 1u) {\r
    base    = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;\r
    freqLoc = params.freq;\r
  } else {\r
    base = vec4<f32>(\r
      pos.x / zoom * params.freq + params.xShift,\r
      pos.y / zoom * params.freq + params.yShift,\r
      pos.z / zoom * params.freq + params.zShift,\r
      params.time\r
    );\r
    freqLoc = params.freq;\r
  }\r
\r
  var sum   : f32 = 0.0;\r
  var amp   : f32 = 1.0;\r
  var angle : f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let s = voro_sample4D(base * freqLoc);\r
\r
    var v = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);\r
    if (params.turbulence == 1u) { v = abs(v); }\r
    v = clamp(v, 0.0, 1.0);\r
\r
    sum += v * amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp     *= params.gain;\r
\r
    if (params.toroidal != 1u) {\r
      let c = cos(angle);\r
      let sA = sin(angle);\r
      let xy = vec2<f32>( base.x * c - base.y * sA, base.x * sA + base.y * c );\r
      let zw = vec2<f32>( base.z * c - base.w * sA, base.z * sA + base.w * c );\r
      base = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
      angle += ANGLE_INCREMENT;\r
    }\r
  }\r
\r
  if (params.turbulence == 1u) { sum -= 1.0; }\r
  return 2.0 * sum - 1.0;\r
}\r
\r
fn generateAntiCellular4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  return -generateCellular4D(pos,params);\r
}\r
\r
fn generateWorley4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  var base    : vec4<f32>;\r
  var freqLoc : f32;\r
\r
  if (params.toroidal == 1u) {\r
    base    = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;\r
    freqLoc = params.freq;\r
  } else {\r
    base = vec4<f32>(\r
      pos.x / zoom * params.freq + params.xShift,\r
      pos.y / zoom * params.freq + params.yShift,\r
      pos.z / zoom * params.freq + params.zShift,\r
      params.time\r
    );\r
    freqLoc = params.freq;\r
  }\r
\r
  var sum    : f32 = 0.0;\r
  var amp    : f32 = 1.0;\r
  var ampSum : f32 = 0.0;\r
  var angle  : f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let s = voro_sample4D(base * freqLoc);\r
\r
    var v = voro_eval(s.f1Sq, s.f2Sq, s.cellVal, params.voroMode, params.edgeK, params.threshold, freqLoc);\r
    if (params.turbulence == 1u) { v = abs(v); }\r
    v = clamp(v, 0.0, 1.0);\r
\r
    sum    += v * amp;\r
    ampSum += amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp     *= params.gain;\r
\r
    if (params.toroidal != 1u) {\r
      let c = cos(angle);\r
      let sA = sin(angle);\r
      let xy = vec2<f32>( base.x * c - base.y * sA, base.x * sA + base.y * c );\r
      let zw = vec2<f32>( base.z * c - base.w * sA, base.z * sA + base.w * c );\r
      base = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
      angle += ANGLE_INCREMENT;\r
    }\r
  }\r
\r
  let out = select(0.0, sum / ampSum, ampSum > 0.0);\r
\r
  if (params.turbulence == 1u) { return clamp(out - 1.0, -1.0, 1.0); }\r
  return clamp(1.0 - out, 0.0, 1.0);\r
}\r
\r
fn generateAntiWorley4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  return 1-generateWorley4D(pos,params);\r
}\r
\r
/* ---- Cellular Brownian-Motion flavours (4D) ---------------------------------- */\r
\r
// BM1 4D: f( f(p) )\r
fn generateCellularBM1_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateCellular4D(p, par);\r
  return generateCellular4D(vec3<f32>(f1 * par.zoom), par);\r
}\r
\r
// BM2 4D: f( p + f(f(p)) )\r
fn generateCellularBM2_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateCellular4D(p, par);\r
  let f2 = generateCellular4D(vec3<f32>(f1 * par.zoom), par);\r
  return generateCellular4D(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
// BM3 4D: f( p + f(p + f(p)) )\r
fn generateCellularBM3_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateCellular4D(p, par);\r
  let f2 = generateCellular4D(p + vec3<f32>(f1 * par.zoom), par);\r
  return generateCellular4D(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
\r
/* ---- Worley Brownian-Motion flavours (4D) ----------------------------------- */\r
\r
// BM1 4D: f( f(p) )\r
fn generateWorleyBM1_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateWorley4D(p, par);\r
  return generateWorley4D(vec3<f32>(f1 * par.zoom), par);\r
}\r
\r
// BM2 4D: f( p + f(f(p)) )\r
fn generateWorleyBM2_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateWorley4D(p, par);\r
  let f2 = generateWorley4D(vec3<f32>(f1 * par.zoom), par);\r
  return generateWorley4D(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
// BM3 4D: f( p + f(p + f(p)) )\r
fn generateWorleyBM3_4D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let f1 = generateWorley4D(p, par);\r
  let f2 = generateWorley4D(p + vec3<f32>(f1 * par.zoom), par);\r
  return generateWorley4D(p + vec3<f32>(f2 * par.zoom), par);\r
}\r
\r
\r
/* ---- vector-feedback variants (stronger, less axis-locked) ------------------ */\r
\r
fn _bm4D_vec_cellular(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {\r
  let a = generateCellular4D(p + vec3<f32>(17.13,  3.71,  9.23), par);\r
  let b = generateCellular4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);\r
  let c = generateCellular4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);\r
  return vec3<f32>(a, b, c);\r
}\r
\r
fn _bm4D_vec_worley(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {\r
  let a = generateWorley4D(p + vec3<f32>(17.13,  3.71,  9.23), par);\r
  let b = generateWorley4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);\r
  let c = generateWorley4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);\r
  return vec3<f32>(a, b, c);\r
}\r
\r
\r
// BM1 4D (vec): f( vec(f(p)) )\r
fn generateCellularBM1_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec_cellular(p, par);\r
  return generateCellular4D(v1 * par.zoom, par);\r
}\r
\r
// BM2 4D (vec): f( p + vec(f(vec(f(p)))) )\r
fn generateCellularBM2_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec_cellular(p, par);\r
  let v2 = _bm4D_vec_cellular(v1 * par.zoom, par);\r
  return generateCellular4D(p + v2 * par.zoom, par);\r
}\r
\r
// BM3 4D (vec): f( p + vec(f(p + vec(f(p)))) )\r
fn generateCellularBM3_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec_cellular(p, par);\r
  let v2 = _bm4D_vec_cellular(p + v1 * par.zoom, par);\r
  return generateCellular4D(p + v2 * par.zoom, par);\r
}\r
\r
\r
// BM1 4D (vec): f( vec(f(p)) )\r
fn generateWorleyBM1_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec_worley(p, par);\r
  return generateWorley4D(v1 * par.zoom, par);\r
}\r
\r
// BM2 4D (vec): f( p + vec(f(vec(f(p)))) )\r
fn generateWorleyBM2_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec_worley(p, par);\r
  let v2 = _bm4D_vec_worley(v1 * par.zoom, par);\r
  return generateWorley4D(p + v2 * par.zoom, par);\r
}\r
\r
// BM3 4D (vec): f( p + vec(f(p + vec(f(p)))) )\r
fn generateWorleyBM3_4D_vec(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let v1 = _bm4D_vec_worley(p, par);\r
  let v2 = _bm4D_vec_worley(p + v1 * par.zoom, par);\r
  return generateWorley4D(p + v2 * par.zoom, par);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Billow Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  var base: vec4<f32>;\r
  if (params.toroidal == 1u) {\r
    base = packPeriodicUV(pos.x, pos.y, pos.z + params.time) / zoom;\r
  } else {\r
    base = vec4<f32>(\r
      (pos.x / zoom) * params.freq + params.xShift,\r
      (pos.y / zoom) * params.freq + params.yShift,\r
      (pos.z / zoom) * params.freq + params.zShift,\r
      params.time\r
    );\r
  }\r
\r
  var sum: f32 = 0.0;\r
  var amp: f32 = 1.0;\r
  var freqLoc: f32 = params.freq;\r
  var ampSum: f32 = 0.0;\r
  var angle: f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let n = noise4D(base * freqLoc);\r
    let b = pow(abs(n), 0.75);\r
    sum += b * amp;\r
    ampSum += amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp *= params.gain;\r
\r
    if (params.toroidal != 1u) {\r
      let c = cos(angle);\r
      let s = sin(angle);\r
      let xy = vec2<f32>(base.x * c - base.y * s, base.x * s + base.y * c);\r
      let zw = vec2<f32>(base.z * c - base.w * s, base.z * s + base.w * c);\r
      base = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
      angle += ANGLE_INCREMENT;\r
    }\r
  }\r
\r
  if (ampSum > 0.0) { sum /= ampSum; }\r
\r
  let k: f32 = 1.2;\r
  let cMid = sum - 0.5;\r
  let shaped = 0.5 + cMid * k / (1.0 + abs(cMid) * (k - 1.0));\r
\r
  return clamp(shaped, 0.0, 1.0);\r
}\r
\r
fn generateAntiBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  return 1.0 - generateBillow4D(pos, params);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Terrace + Foam + Turbulence \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateTerraceNoise4D(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  let base = generatePerlin4D(pos, par);\r
  return terrace(base, par.terraceStep);\r
}\r
\r
fn generateFoamNoise4D(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  let base = generateBillow4D(pos, par);\r
  return foamify(base);\r
}\r
\r
fn generateTurbulence4D(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  let base = generatePerlin4D(pos, par);\r
  return turbulence(base);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D "Lanczos-like" Lowpass \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn lowpass4D(p: vec4<f32>) -> f32 {\r
  let o = vec4<f32>(0.37, 0.21, 0.29, 0.31);\r
  let a = noise4D(p);\r
  let b = noise4D(p + vec4<f32>(o.x, 0.0, 0.0, 0.0));\r
  let c = noise4D(p + vec4<f32>(0.0, o.y, 0.0, 0.0));\r
  let d = noise4D(p + vec4<f32>(0.0, 0.0, o.z, 0.0));\r
  let e = noise4D(p + vec4<f32>(0.0, 0.0, 0.0, o.w));\r
  return (a + b + c + d + e) * 0.2;\r
}\r
\r
fn generateLanczosBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  var base: vec4<f32>;\r
  if (params.toroidal == 1u) {\r
    base = packPeriodicUV(pos.x, pos.y, pos.z + params.time) / zoom;\r
  } else {\r
    base = vec4<f32>(\r
      (pos.x / zoom) * params.freq + params.xShift,\r
      (pos.y / zoom) * params.freq + params.yShift,\r
      (pos.z / zoom) * params.freq + params.zShift,\r
      params.time\r
    );\r
  }\r
\r
  var sum: f32 = 0.0;\r
  var amp: f32 = 1.0;\r
  var maxAmp: f32 = 0.0;\r
  var freqLoc: f32 = params.freq;\r
  var angle: f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let n = lowpass4D(base * freqLoc);\r
    sum += (2.0 * abs(n) - 1.0) * amp;\r
    maxAmp += amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp *= params.gain;\r
\r
    if (params.toroidal != 1u) {\r
      let c = cos(angle);\r
      let s = sin(angle);\r
      let xy = vec2<f32>(base.x * c - base.y * s, base.x * s + base.y * c);\r
      let zw = vec2<f32>(base.z * c - base.w * s, base.z * s + base.w * c);\r
      base = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
      angle += ANGLE_INCREMENT;\r
    }\r
  }\r
\r
  return select(0.0, sum / maxAmp, maxAmp > 0.0);\r
}\r
\r
fn generateLanczosAntiBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  return -generateLanczosBillow4D(pos, params);\r
}\r
\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D FBM core + generators \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn fbm4D_core(base: vec4<f32>, params: NoiseParams) -> f32 {\r
  var p = base;\r
\r
  var sum: f32 = 0.0;\r
  var amp: f32 = 1.0;\r
  var maxAmp: f32 = 0.0;\r
  var freqLoc: f32 = params.freq;\r
\r
  var angle: f32 = params.seedAngle;\r
  let angleInc: f32 = 2.0 * PI / max(f32(params.octaves), 1.0);\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    sum += amp * noise4D(p * freqLoc);\r
    maxAmp += amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp *= params.gain;\r
\r
    if (params.toroidal != 1u) {\r
      angle += angleInc;\r
      let c = cos(angle);\r
      let s = sin(angle);\r
      let xy = vec2<f32>(p.x * c - p.y * s, p.x * s + p.y * c);\r
      let zw = vec2<f32>(p.z * c - p.w * s, p.z * s + p.w * c);\r
      p = vec4<f32>(\r
        xy.x + params.xShift,\r
        xy.y + params.yShift,\r
        zw.x + params.zShift,\r
        zw.y + params.time\r
      );\r
    }\r
  }\r
\r
  return select(0.0, sum / maxAmp, maxAmp > 0.0);\r
}\r
\r
fn fbm4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  if (params.toroidal == 1u) {\r
    let base = packPeriodicUV(pos.x, pos.y, pos.z + params.time) / zoom;\r
    return fbm4D_core(base, params);\r
  }\r
\r
  let base = vec4<f32>(\r
    (pos.x + params.xShift) / zoom,\r
    (pos.y + params.yShift) / zoom,\r
    (pos.z + params.zShift) / zoom,\r
    params.time\r
  );\r
  return fbm4D_core(base, params);\r
}\r
\r
fn generateFBM4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let fbm1 = fbm4D(pos, params);\r
  let fbm2 = fbm4D_core(vec4<f32>(fbm1, fbm1, fbm1, fbm1), params);\r
  return 2.0 * fbm2;\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Domain-warp FBM (4D)  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
\r
fn domainWarpFBM4D(p: vec3<f32>, params: NoiseParams, warpAmp: f32, stages: u32) -> f32 {\r
  var q = p;\r
  for (var i: u32 = 0u; i < stages; i = i + 1u) {\r
    let w = fbm4D(q, params) * warpAmp;\r
    q = q + vec3<f32>(w, w, w);\r
  }\r
  return fbm4D(q, params);\r
}\r
\r
fn generateDomainWarpFBM1_4D(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  return domainWarpFBM4D(pos, par, par.warpAmp, 1u);\r
}\r
\r
fn generateDomainWarpFBM2_4D(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  return domainWarpFBM4D(pos, par, par.warpAmp, 2u);\r
}\r
\r
fn _warpVecFrom4D(p: vec3<f32>, par: NoiseParams) -> vec3<f32> {\r
  let a = fbm4D(p + vec3<f32>(17.13,  3.71,  9.23), par);\r
  let b = fbm4D(p + vec3<f32>(-5.41, 11.19,  2.07), par);\r
  let c = fbm4D(p + vec3<f32>( 8.09, -6.77, 13.61), par);\r
  return vec3<f32>(a, b, c);\r
}\r
\r
fn domainWarpFBM4D_vec(p: vec3<f32>, params: NoiseParams, warpAmp: f32, stages: u32) -> f32 {\r
  var q = p;\r
  for (var i: u32 = 0u; i < stages; i = i + 1u) {\r
    let v = _warpVecFrom4D(q, params) * warpAmp;\r
    q = q + v;\r
  }\r
  return fbm4D(q, params);\r
}\r
\r
fn generateDomainWarpFBM1_4D_vec(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  return domainWarpFBM4D_vec(pos, par, par.warpAmp, 1u);\r
}\r
\r
fn generateDomainWarpFBM2_4D_vec(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  return domainWarpFBM4D_vec(pos, par, par.warpAmp, 2u);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Lanczos Billow Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateLanczosBillow(pos : vec3<f32>, p : NoiseParams) -> f32 {\r
    var x       = (pos.x + p.xShift) / p.zoom;\r
    var y       = (pos.y + p.yShift) / p.zoom;\r
    var z       = (pos.z + p.zShift) / p.zoom;\r
    var sum     : f32 = 0.0;\r
    var maxAmp  : f32 = 0.0;\r
    var amp     : f32 = 1.0;\r
    var freqLoc : f32 = p.freq;\r
    var angle   : f32 = p.seedAngle;\r
\r
    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {\r
        let n = lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));\r
        sum = sum + (2.0 * abs(n) - 1.0) * amp;\r
        maxAmp = maxAmp + amp;\r
\r
        freqLoc = freqLoc * p.lacunarity;\r
        amp     = amp     * p.gain;\r
\r
        // rotation around Z\r
        let c = cos(angle);\r
        let s = sin(angle);\r
        var newX = x * c - y * s;\r
        var newY = x * s + y * c;\r
        var newZ = z;\r
\r
        // rotate in XZ plane\r
        let rX = newX * c + newZ * s;\r
        let rZ = -newX * s + newZ * c;\r
        newX = rX; newZ = rZ;\r
\r
        // rotate in YZ plane\r
        let rY = newY * c - newZ * s;\r
        let rZ2 = newY * s + newZ * c;\r
        newY = rY; newZ = rZ2;\r
\r
        // apply shift\r
        x = newX + p.xShift;\r
        y = newY + p.yShift;\r
        z = newZ + p.zShift;\r
\r
        angle = angle + ANGLE_INCREMENT;\r
    }\r
\r
    return sum / maxAmp;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Lanczos Anti-Billow Noise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateLanczosAntiBillow(pos : vec3<f32>, p : NoiseParams) -> f32 {\r
    return -generateLanczosBillow(pos, p);\r
}\r
\r
\r
// Raw Voronoi circle\u2010gradient cell value\r
fn voronoiCircleGradient(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
    let fz : i32 = i32(floor(pos.z));\r
    var minDist    : f32 = 1e9;\r
    var secondDist : f32 = 1e9;\r
    var centerVal  : f32 = 0.0;\r
\r
    // search the 3\xD73\xD73 neighborhood\r
    for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {\r
        for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {\r
            for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {\r
                let xi = fx + dx;\r
                let yi = fy + dy;\r
                let zi = fz + dz;\r
\r
                // pseudo\u2010random feature point within the cell\r
                let r0 = rand3u(xi, yi, zi);\r
                let r1 = rand3u(yi, zi, xi);\r
                let r2 = rand3u(zi, xi, yi);\r
                let px = f32(xi) + r0;\r
                let py = f32(yi) + r1;\r
                let pz = f32(zi) + r2;\r
\r
                // Euclidean distance\r
                let dx_ = px - pos.x;\r
                let dy_ = py - pos.y;\r
                let dz_ = pz - pos.z;\r
                let d   = sqrt(dx_*dx_ + dy_*dy_ + dz_*dz_);\r
\r
                // track the two smallest distances\r
                if (d < minDist) {\r
                    secondDist = minDist;\r
                    minDist    = d;\r
                    centerVal  = r0;           // store the cell\u2019s \u201Cvalue\u201D\r
                } else if (d < secondDist) {\r
                    secondDist = d;\r
                }\r
            }\r
        }\r
    }\r
\r
    // build the circle gradient: fall\u2010off from cell center\r
    let centerGrad = 1.0 - min(minDist, 1.0);\r
    // edge mask: if the ridge is too thin, kill it\r
    let edgeDist   = secondDist - minDist;\r
    let edgeGrad   = select(1.0, 0.0, edgeDist < params.threshold);\r
\r
    return centerGrad * edgeGrad;\r
}\r
\r
// Octaved generator matching your JS .generateNoise()\r
fn generateVoronoiCircleNoise(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    // zoom in/out\r
    var x       = (pos.x + params.xShift) / params.zoom;\r
    var y       = (pos.y + params.yShift) / params.zoom;\r
    var z       = (pos.z + params.zShift) / params.zoom;\r
    var total : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = params.freq;\r
\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let samplePos = vec3<f32>(x * freq, y * freq, z * freq);\r
        total = total + voronoiCircleGradient(samplePos, params) * amp;\r
\r
        // next octave\r
        amp  = amp  * params.gain;\r
        freq = freq * params.lacunarity;\r
        x    = x + params.xShift;\r
        y    = y + params.yShift;\r
        z    = z + params.zShift;\r
    }\r
\r
    // match JS: return \u2211noise \u2212 1.0\r
    return total - 1.0;\r
}\r
\r
\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 distance helpers (add once) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn euclideanDist(a: vec3<f32>, b: vec3<f32>) -> f32 {\r
  return length(a - b);\r
}\r
fn euclideanDistSq(a: vec3<f32>, b: vec3<f32>) -> f32 {\r
  let d = a - b;\r
  return dot(d, d);\r
}\r
\r
fn euclideanDist2(a: vec2<f32>, b: vec2<f32>) -> f32 {\r
  return length(a - b);\r
}\r
fn euclideanDistSq2(a: vec2<f32>, b: vec2<f32>) -> f32 {\r
  let d = a - b;\r
  return dot(d, d);\r
}\r
\r
fn euclideanDist4(a: vec4<f32>, b: vec4<f32>) -> f32 {\r
  return length(a - b);\r
}\r
fn euclideanDistSq4(a: vec4<f32>, b: vec4<f32>) -> f32 {\r
  let d = a - b;\r
  return dot(d, d);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500 1. Voronoi Circle\u2010Gradient Tile Noise 2 \u2500\u2500\u2500\u2500\u2500\r
\r
fn voronoiCircleGradient2Raw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
    let fz : i32 = i32(floor(pos.z));\r
    var minDist : f32 = 1e9;\r
    var minVal  : f32 = 0.0;\r
    var closest : vec3<f32> = vec3<f32>(0.0);\r
\r
    for(var dz = -1; dz <= 1; dz = dz + 1) {\r
        for(var dy = -1; dy <= 1; dy = dy + 1) {\r
            for(var dx = -1; dx <= 1; dx = dx + 1) {\r
                let xi = fx + dx;\r
                let yi = fy + dy;\r
                let zi = fz + dz;\r
                let r0 = rand3u(xi, yi, zi);\r
                let feature = vec3<f32>(f32(xi) + r0,\r
                                        f32(yi) + rand3u(yi, zi, xi),\r
                                        f32(zi) + rand3u(zi, xi, yi));\r
                let d = euclideanDist(feature, pos);\r
                if(d < minDist) {\r
                    minDist = d;\r
                    minVal = rand3u(xi, yi, zi);\r
                    closest = feature;\r
                }\r
            }\r
        }\r
    }\r
    let centerDist = euclideanDist(closest, pos);\r
    let gradient = sin(centerDist * PI);\r
    return minVal * gradient;\r
}\r
\r
fn generateVoronoiCircle2(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    var x = pos.x + params.xShift;\r
    var y = pos.y + params.yShift;\r
    var z = pos.z + params.zShift;\r
    var total : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = params.freq;\r
    var angle     : f32 = params.seedAngle;\r
    let angleInc  : f32 = 2.0 * PI / f32(params.octaves);\r
\r
    for(var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let samplePos = vec3<f32>(x * freq / params.zoom,\r
                                  y * freq / params.zoom,\r
                                  z * freq / params.zoom);\r
        total = total + voronoiCircleGradient2Raw(samplePos, params) * amp;\r
        amp   = amp * params.gain;\r
        freq  = freq * params.lacunarity;\r
        angle = angle + angleInc;\r
        x = x + params.xShift * cos(angle) + params.xShift;\r
        y = y + params.yShift * cos(angle) + params.yShift;\r
        z = z + params.zShift * cos(angle) + params.zShift;\r
    }\r
    return total - 1.0;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500 2. Voronoi Flat\u2010Shade Tile Noise \u2500\u2500\u2500\u2500\u2500\r
\r
fn voronoiFlatShadeRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
    let fz : i32 = i32(floor(pos.z));\r
    var minDist    : f32 = 1e9;\r
    var secondDist : f32 = 1e9;\r
\r
    for(var dz = -1; dz <= 1; dz = dz + 1) {\r
        for(var dy = -1; dy <= 1; dy = dy + 1) {\r
            for(var dx = -1; dx <= 1; dx = dx + 1) {\r
                let xi = fx + dx;\r
                let yi = fy + dy;\r
                let zi = fz + dz;\r
                let feature = vec3<f32>(f32(xi) + rand3u(xi, yi, zi),\r
                                        f32(yi) + rand3u(yi, zi, xi),\r
                                        f32(zi) + rand3u(zi, xi, yi));\r
                let d = euclideanDist(feature, pos);\r
                if(d < minDist) {\r
                    secondDist = minDist;\r
                    minDist    = d;\r
                } else if(d < secondDist) {\r
                    secondDist = d;\r
                }\r
            }\r
        }\r
    }\r
    let edgeDist = secondDist - minDist;\r
    return select(1.0, 0.0, edgeDist < params.threshold);\r
}\r
\r
fn generateVoronoiFlatShade(posIn: vec3<f32>, params: NoiseParams) -> f32 {\r
    var pos = posIn / params.zoom;\r
    var total : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = params.freq;\r
    for(var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        total = total + voronoiFlatShadeRaw(pos * freq, params) * amp;\r
        amp  = amp * params.gain;\r
        freq = freq * params.lacunarity;\r
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);\r
    }\r
    return total;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500 3. Voronoi Ripple 3D \u2500\u2500\u2500\u2500\u2500\r
\r
fn voronoiRipple3DRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
    let fz : i32 = i32(floor(pos.z));\r
    var minDist    : f32 = 1e9;\r
    var secondDist : f32 = 1e9;\r
    var minVal     : f32 = 0.0;\r
\r
    for(var dz=-1; dz<=1; dz=dz+1) {\r
        for(var dy=-1; dy<=1; dy=dy+1) {\r
            for(var dx=-1; dx<=1; dx=dx+1) {\r
                let xi = fx+dx;\r
                let yi = fy+dy;\r
                let zi = fz+dz;\r
                let feature = vec3<f32>(f32(xi)+rand3u(xi,yi,zi),\r
                                        f32(yi)+rand3u(yi,zi,xi),\r
                                        f32(zi)+rand3u(zi,xi,yi));\r
                let d = euclideanDist(feature, pos);\r
                if(d < minDist) {\r
                    secondDist = minDist;\r
                    minDist    = d;\r
                    minVal     = rand3u(xi, yi, zi);\r
                } else if(d < secondDist) {\r
                    secondDist = d;\r
                }\r
            }\r
        }\r
    }\r
    let edgeDist = secondDist - minDist;\r
    let ripple   = sin(PI + edgeDist * PI * params.rippleFreq + params.time);\r
    return minVal * (1.0 + ripple) * 0.5;\r
}\r
\r
fn generateVoronoiRipple3D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    var x = pos.x + params.xShift;\r
    var y = pos.y + params.yShift;\r
    var z = pos.z + params.zShift;\r
    var total : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = params.freq;\r
    for(var i: u32=0u; i<params.octaves; i=i+1u) {\r
        let sample = vec3<f32>(x * freq / params.zoom,\r
                               y * freq / params.zoom,\r
                               z * freq / params.zoom);\r
        total = total + voronoiRipple3DRaw(sample, params) * amp;\r
        amp   = amp * params.gain;\r
        freq  = freq * params.lacunarity;\r
        let angle = params.seedAngle * 2.0 * PI;\r
        x = x + params.xShift * cos(angle + f32(i));\r
        y = y + params.yShift * cos(angle + f32(i));\r
        z = z + params.zShift * cos(angle + f32(i));\r
    }\r
    return 2.0 * total - 1.0;\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500 4. Voronoi Ripple 3D 2 \u2500\u2500\u2500\u2500\u2500\r
fn voronoiRipple3D2Raw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
    let fz : i32 = i32(floor(pos.z));\r
    var minDist: f32 = 1e9;\r
    var secondDist: f32 = 1e9;\r
    var minVal: f32 = 0.0;\r
\r
    for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {\r
        for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {\r
            for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {\r
                let xi = fx + dx;\r
                let yi = fy + dy;\r
                let zi = fz + dz;\r
                let feature = vec3<f32>(f32(xi) + rand3u(xi, yi, zi),\r
                                        f32(yi) + rand3u(yi, zi, xi),\r
                                        f32(zi) + rand3u(zi, xi, yi));\r
                let d = euclideanDist(feature, pos);\r
                if (d < minDist) {\r
                    secondDist = minDist;\r
                    minDist = d;\r
                    minVal = rand3u(xi, yi, zi);\r
                } else if (d < secondDist) {\r
                    secondDist = d;\r
                }\r
            }\r
        }\r
    }\r
    let edgeDist = secondDist - minDist;\r
    let ripple = sin(PI + params.zoom * edgeDist * PI * params.rippleFreq + params.time);\r
    return minVal * (1.0 + ripple) * 0.5;\r
}\r
\r
fn generateVoronoiRipple3D2(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    var x = pos.x + params.xShift;\r
    var y = pos.y + params.yShift;\r
    var z = pos.z + params.zShift;\r
    var total: f32 = 0.0;\r
    var amp: f32 = 1.0;\r
    var freq: f32 = params.freq;\r
\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let sample = vec3<f32>(x * freq / params.zoom,\r
                               y * freq / params.zoom,\r
                               z * freq / params.zoom);\r
        total = total + voronoiRipple3D2Raw(sample, params) * amp;\r
        amp = amp * params.gain;\r
        freq = freq * params.lacunarity;\r
        let angle = params.seedAngle * 2.0 * PI;\r
        x = x + params.xShift * cos(angle + f32(i));\r
        y = y + params.yShift * cos(angle + f32(i));\r
        z = z + params.zShift * cos(angle + f32(i));\r
    }\r
    return 2.0 * total - 1.0;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500 5. Voronoi Circular Ripple 3D \u2500\u2500\u2500\u2500\u2500\r
fn voronoiCircularRippleRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let fx : i32 = i32(floor(pos.x));\r
    let fy : i32 = i32(floor(pos.y));\r
    let fz : i32 = i32(floor(pos.z));\r
    var minDist: f32 = 1e9;\r
    var minVal: f32 = 0.0;\r
    for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {\r
        for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {\r
            for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {\r
                let xi = fx + dx;\r
                let yi = fy + dy;\r
                let zi = fz + dz;\r
                let feature = vec3<f32>(f32(xi) + rand3u(xi, yi, zi),\r
                                        f32(yi) + rand3u(yi, zi, xi),\r
                                        f32(zi) + rand3u(zi, xi, yi));\r
                let d = euclideanDist(feature, pos);\r
                if (d < minDist) {\r
                    minDist = d;\r
                    minVal = rand3u(xi, yi, zi);\r
                }\r
            }\r
        }\r
    }\r
    let ripple = sin(PI + minDist * PI * params.rippleFreq + params.time);\r
    return minVal * (1.0 + ripple) * 0.5;\r
}\r
\r
fn generateVoronoiCircularRipple(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    var x = pos.x + params.xShift;\r
    var y = pos.y + params.yShift;\r
    var z = pos.z + params.zShift;\r
    var total: f32 = 0.0;\r
    var amp: f32 = 1.0;\r
    var freq: f32 = params.freq;\r
\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let sample = vec3<f32>(x * freq / params.zoom,\r
                               y * freq / params.zoom,\r
                               z * freq / params.zoom);\r
        total = total + voronoiCircularRippleRaw(sample, params) * amp;\r
        amp = amp * params.gain;\r
        freq = freq * params.lacunarity;\r
        let angle = params.seedAngle * 2.0 * PI;\r
        x = x + params.xShift * cos(angle + f32(i));\r
        y = y + params.yShift * cos(angle + f32(i));\r
        z = z + params.zShift * cos(angle + f32(i));\r
    }\r
    return 2.0 * total - 1.0;\r
}\r
\r
// 6a. Fractal Voronoi Ripple 3D\r
fn generateFVoronoiRipple3D(posIn: vec3<f32>, params: NoiseParams) -> f32 {\r
    // first FBM pass\r
    let fbm1 = generateVoronoiRipple3D(posIn, params);\r
\r
    // prepare second\u2010pass params: keep everything the same except zoom=1\r
    var p2 = params;\r
    p2.zoom = 1.0;\r
\r
    // second FBM pass, feeding the scalar result back into xyz\r
    let sample = vec3<f32>(fbm1, fbm1, fbm1);\r
    let fbm2   = generateVoronoiRipple3D(sample, p2);\r
\r
    return 2.0 * fbm2;\r
}\r
\r
// 6b. Fractal Voronoi Circular Ripple 3D\r
fn generateFVoronoiCircularRipple(posIn: vec3<f32>, params: NoiseParams) -> f32 {\r
    // first FBM pass\r
    let fbm1 = generateVoronoiCircularRipple(posIn, params);\r
\r
    // second\u2010pass with zoom=1\r
    var p2 = params;\r
    p2.zoom = 1.0;\r
\r
    let sample = vec3<f32>(fbm1, fbm1, fbm1);\r
    let fbm2   = generateVoronoiCircularRipple(sample, p2);\r
\r
    return 2.0 * fbm2;\r
}\r
\r
// \u2014\u2014\u2014 continuousPermutation \u2014\u2014\u2014\r
fn continuousPermutation(value: f32) -> f32 {\r
    let iVal    = floor(value);\r
    let frac    = value - iVal;\r
    let i0      = i32(iVal);\r
    let idx1    = u32((i0 % 256 + 256) % 256);\r
    let idx2    = u32(((i0 + 1) % 256 + 256) % 256);\r
    let v1      = f32(perm(idx1));\r
    let v2      = f32(perm(idx2));\r
    return v1 + frac * (v2 - v1);\r
}\r
\r
// \u2014\u2014\u2014 calculateRippleEffect \u2014\u2014\u2014\r
fn calculateRippleEffect(pos: vec3<f32>,\r
                         rippleFreq: f32,\r
                         neighborhoodSize: i32) -> f32 {\r
    var sum: f32 = 0.0;\r
    var count: f32 = 0.0;\r
    for (var dz = -neighborhoodSize; dz <= neighborhoodSize; dz = dz + 1) {\r
        for (var dy = -neighborhoodSize; dy <= neighborhoodSize; dy = dy + 1) {\r
            for (var dx = -neighborhoodSize; dx <= neighborhoodSize; dx = dx + 1) {\r
                let sample = vec3<f32>(\r
                    continuousPermutation(pos.x + f32(dx)),\r
                    continuousPermutation(pos.y + f32(dy)),\r
                    continuousPermutation(pos.z + f32(dz))\r
                );\r
                let d = length(sample - pos);\r
                sum = sum + sin(d * PI * rippleFreq);\r
                count = count + 1.0;\r
            }\r
        }\r
    }\r
    return sum / count;\r
}\r
\r
// \u2014\u2014\u2014 generateRippleNoise \u2014\u2014\u2014\r
fn generateRippleNoise(pos: vec3<f32>, p: NoiseParams) -> f32 {\r
    var x = (pos.x + p.xShift) / p.zoom;\r
    var y = (pos.y + p.yShift) / p.zoom;\r
    var z = (pos.z + p.zShift) / p.zoom;\r
    var sum: f32 = 0.0;\r
    var amp: f32 = 1.0;\r
    var freq: f32 = p.freq;\r
    var angle: f32 = p.seedAngle * 2.0 * PI;\r
    let angleInc = 2.0 * PI / f32(p.octaves);\r
    let rippleFreqScaled = p.rippleFreq / p.zoom;\r
    let neigh = i32(p.exp1);\r
\r
    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {\r
        var n = /* your base noise fn */ lanczos3D(vec3<f32>(x * freq, y * freq, z * freq)) * amp;\r
        if (p.turbulence == 1u) {\r
            n = abs(n);\r
        }\r
        let rip = calculateRippleEffect(vec3<f32>(x * freq, y * freq, z * freq),\r
                                        rippleFreqScaled,\r
                                        neigh);\r
        sum = sum + n * rip;\r
\r
        freq   = freq * p.lacunarity;\r
        amp    = amp * p.gain;\r
        angle  = angle + angleInc;\r
\r
        // simple phase offset; replace 0.0 with a hash if desired\r
        let phase: f32 = 0.0;\r
        x = x + p.xShift * cos(angle + phase);\r
        y = y + p.yShift * cos(angle + phase);\r
        z = z + p.zShift * cos(angle + phase);\r
    }\r
\r
    if (p.turbulence == 1u) {\r
        sum = sum - 1.0;\r
    }\r
    return f32(p.octaves) * sum;\r
}\r
\r
// \u2014\u2014\u2014 generateFractalRipples \u2014\u2014\u2014\r
fn generateFractalRipples(posIn: vec3<f32>, p: NoiseParams) -> f32 {\r
    // first pass at zoom scaled by exp2\r
    var p1 = p;\r
    p1.zoom = p.zoom * p.exp2+1.5;\r
    let fbm1 = generateRippleNoise(posIn, p1);\r
\r
    // second pass feeding fbm1 back into xyz\r
    var p2 = p;\r
    let sample = vec3<f32>(fbm1, fbm1, fbm1);\r
    let fbm2   = generateRippleNoise(sample, p2);\r
\r
    return 2.0 * fbm2;\r
}\r
\r
// \u2014\u2014\u2014 1. HexWorms Raw \u2014\u2014\u2014\r
fn hexWormsRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let steps       : u32 = 5u;\r
    let persistence : f32 = 0.5;\r
    var total       : f32 = 0.0;\r
    var frequency   : f32 = 1.0;\r
    var amplitude   : f32 = 1.0;\r
\r
    for (var i: u32 = 0u; i < steps; i = i + 1u) {\r
        // base cellular noise for direction\r
        let angle = generateCellular(pos * frequency, params) * 2.0 * PI;\r
\r
        // step along the \u201Cworm\u201D\r
        let offset = vec3<f32>(\r
            cos(angle),\r
            sin(angle),\r
            sin(angle)\r
        ) * 0.5;\r
        let samplePos = pos + offset;\r
\r
        // accumulate\r
        total = total + generateCellular(samplePos, params) * amplitude;\r
\r
        amplitude = amplitude * persistence;\r
        frequency = frequency * 2.0;\r
    }\r
\r
    // match JS: subtract 1 at the end\r
    return total - 1.0;\r
}\r
\r
// \u2014\u2014\u2014 2. HexWorms Generator \u2014\u2014\u2014\r
fn generateHexWormsNoise(posIn: vec3<f32>, params: NoiseParams) -> f32 {\r
    var pos   = posIn / params.zoom;\r
    var sum   : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = params.freq;\r
\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        sum = sum + hexWormsRaw(pos * freq, params) * amp;\r
        freq = freq * params.lacunarity;\r
        amp  = amp * params.gain;\r
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);\r
    }\r
\r
    return sum;\r
}\r
\r
// \u2014\u2014\u2014 3. PerlinWorms Raw \u2014\u2014\u2014\r
fn perlinWormsRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let steps       : u32 = 5u;\r
    let persistence : f32 = 0.5;\r
    var total       : f32 = 0.0;\r
    var frequency   : f32 = 1.0;\r
    var amplitude   : f32 = 1.0;\r
\r
    for (var i: u32 = 0u; i < steps; i = i + 1u) {\r
        // base Perlin noise for direction\r
        let angle = generatePerlin(pos * frequency, params) * 2.0 * PI;\r
\r
        // step along the \u201Cworm\u201D\r
        let offset = vec3<f32>(\r
            cos(angle),\r
            sin(angle),\r
            sin(angle)\r
        ) * 0.5;\r
        let samplePos = pos + offset;\r
\r
        // accumulate\r
        total = total + generatePerlin(samplePos, params) * amplitude;\r
\r
        amplitude = amplitude * persistence;\r
        frequency = frequency * 2.0;\r
    }\r
\r
    return total;\r
}\r
\r
// \u2014\u2014\u2014 PerlinWorms Generator \u2014\u2014\u2014\r
fn generatePerlinWormsNoise(posIn: vec3<f32>, params: NoiseParams) -> f32 {\r
    var pos   = posIn / params.zoom;\r
    var sum   : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = params.freq;\r
\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        sum = sum + perlinWormsRaw(pos * freq, params) * amp;\r
        freq = freq * params.lacunarity;\r
        amp  = amp * params.gain;\r
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);\r
    }\r
\r
    return sum;\r
}\r
\r
// small helper: derive a few pseudorandom offsets from seed (u32)\r
fn seedOffsets(seed: u32) -> vec3<f32> {\r
  let s = f32(seed);\r
  let a = fract(sin(s * 12.9898) * 43758.5453);\r
  let b = fract(sin((s + 17.0) * 78.233) * 23421.631);\r
  let c = fract(sin((s + 31.0) * 37.719) * 97531.135);\r
  return vec3<f32>(a, b, c) * 0.5;\r
}\r
\r
// safe tile sizes (u32) derived from Frame (avoid zero)\r
fn tileSizeX() -> u32 { return max(frame.tileWidth, 1u); }\r
fn tileSizeY() -> u32 { return max(frame.tileHeight, 1u); }\r
fn tileSizeZ() -> u32 { return max(frame.tileDepth, 1u); }\r
\r
// --- helper: map pos -> integer pixel coords (uses frame uniform) ----------\r
// Returns wrapped pixel coords (periodic) so noise will tile across chunks.\r
fn posToPixelCoords_tiled(p : vec3<f32>) -> vec3<u32> {\r
  let fx = p.x * f32(frame.fullWidth);\r
  let fy = p.y * f32(frame.fullHeight);\r
\r
  let ox_i : i32 = max(frame.originX, 0);\r
  let oy_i : i32 = max(frame.originY, 0);\r
\r
  // integer pixel coords (unwrapped)\r
  let pxu : u32 = u32(floor(fx)) + u32(ox_i);\r
  let pyu : u32 = u32(floor(fy)) + u32(oy_i);\r
\r
  let layer_i = max(frame.layerIndex, 0);\r
  let layer_u : u32 = u32(layer_i);\r
\r
  // wrap coordinates into tile using modulo (cheap & correct for arbitrary tile sizes)\r
  let tx = tileSizeX();\r
  let ty = tileSizeY();\r
  let tz = tileSizeZ();\r
  let rx = pxu % tx;\r
  let ry = pyu % ty;\r
  let rz = layer_u % tz;\r
\r
  return vec3<u32>(rx, ry, rz);\r
}\r
\r
// --- deterministic integer hash that mixes seed (uses perm table) ---\r
// perm(...) implementation expected elsewhere (perm indexes 0..511)\r
fn hashed_with_seed(ix: u32, iy: u32, iz: u32, seed: u32) -> u32 {\r
  let a = perm((ix + seed * 1664525u) & 511u);\r
  let b = perm((a + (iy + seed * 22695477u)) & 511u);\r
  let c = perm((b + (iz + seed * 1103515245u)) & 511u);\r
  return c & 511u;\r
}\r
fn hashTo01_seeded(ix: u32, iy: u32, iz: u32, seed: u32) -> f32 {\r
  return f32(hashed_with_seed(ix, iy, iz, seed)) / 511.0;\r
}\r
fn hashToSigned01_seeded(ix: u32, iy: u32, iz: u32, seed: u32) -> f32 {\r
  return hashTo01_seeded(ix, iy, iz, seed) * 2.0 - 1.0;\r
}\r
\r
// integer lattice helper consistent with the perm table, tiled by Frame sizes.\r
// p is continuous; freq and shifts control lattice alignment.\r
fn posToIntsForHash_tiled(p: vec3<f32>, freq: f32, sx: f32, sy: f32, sz: f32) -> vec3<u32> {\r
  let fx = floor(p.x * freq + sx);\r
  let fy = floor(p.y * freq + sy);\r
  let fz = floor(p.z * freq + sz);\r
\r
  // cast and wrap to tile-size\r
  let tx = tileSizeX();\r
  let ty = tileSizeY();\r
  let tz = tileSizeZ();\r
\r
  let ix = u32(fx) % tx;\r
  let iy = u32(fy) % ty;\r
  let iz = u32(fz) % tz;\r
  return vec3<u32>(ix, iy, iz);\r
}\r
\r
// ---------------------- tiled value-noise 2D (smooth) ----------------------\r
// Uses posToIntsForHash_tiled internally => tiled/periodic by Frame tile sizes.\r
fn valueNoise2D_seeded(p : vec2<f32>, freq: f32, seed: u32, sx: f32, sy: f32) -> f32 {\r
  let f = max(freq, 1e-6);\r
  let fx = p.x * f + sx;\r
  let fy = p.y * f + sy;\r
  let ix_f = floor(fx);\r
  let iy_f = floor(fy);\r
  let txf = fx - ix_f;\r
  let tyf = fy - iy_f;\r
\r
  // get tiled integer lattice coords (z = 0)\r
  let base = posToIntsForHash_tiled(vec3<f32>(ix_f, iy_f, 0.0), 1.0, 0.0, 0.0, 0.0);\r
  let ix = base.x;\r
  let iy = base.y;\r
\r
  // neighbors (wrapped by tile in posToIntsForHash_tiled above)\r
  let ix1 = (ix + 1u) % tileSizeX();\r
  let iy1 = (iy + 1u) % tileSizeY();\r
\r
  let h00 = hashToSigned01_seeded(ix,  iy,  0u, seed);\r
  let h10 = hashToSigned01_seeded(ix1, iy,  0u, seed);\r
  let h01 = hashToSigned01_seeded(ix,  iy1, 0u, seed);\r
  let h11 = hashToSigned01_seeded(ix1, iy1, 0u, seed);\r
\r
  let sx_f = fade(txf);\r
  let sy_f = fade(tyf);\r
  let a = lerp(h00, h10, sx_f);\r
  let b = lerp(h01, h11, sx_f);\r
  return lerp(a, b, sy_f);\r
}\r
\r
// ---------------------- White Noise (tiled, seeded, contrast/gain) ----\r
fn generateWhiteNoise(pos : vec3<f32>, params: NoiseParams) -> f32 {\r
  let seed : u32 = params.seed;\r
\r
  // integer pixel coords (wrapped to tile)\r
  let ip = posToPixelCoords_tiled(pos);\r
\r
  // subsampling (blocky) or per-pixel; safe cast\r
  let subs = max(u32(max(params.freq, 1.0)), 1u);\r
  let sx = (ip.x / subs) % tileSizeX();\r
  let sy = (ip.y / subs) % tileSizeY();\r
  let sz = ip.z % tileSizeZ();\r
\r
  var v01 = hashTo01_seeded(sx, sy, sz, seed);\r
\r
  // apply contrast around 0.5 via params.gain\r
  let contrast = 1.0 + params.gain;\r
  v01 = (v01 - 0.5) * contrast + 0.5;\r
\r
  return clamp(v01, 0.0, 1.0);\r
}\r
\r
// ---------------------- Blue Noise Generator (tiled, seeded) -------------\r
fn generateBlueNoise(pos : vec3<f32>, params: NoiseParams) -> f32 {\r
  let seed : u32 = params.seed;\r
\r
  // pixel-space coords\r
  let px = pos.xy * vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));\r
\r
  // scale control (same heuristic you had)\r
  let pixelBase = max(min(f32(frame.fullWidth), f32(frame.fullHeight)), 1.0);\r
  let highScale = max(params.freq * 0.02 * pixelBase, 1e-6);\r
  let lowScaleFactor = 0.12;\r
  let lowScale = max(highScale * lowScaleFactor, 1e-6);\r
\r
  // Optional domain warp (seeded) \u2014 jitter indices with tiled lattice lookups\r
  var wp = px;\r
  if (params.warpAmp > 0.0) {\r
    let ip0 = posToIntsForHash_tiled(pos, params.freq, params.xShift, params.yShift, params.zShift);\r
    let jx = hashToSigned01_seeded(ip0.x + 5u, ip0.y + 11u, ip0.z + 17u, seed);\r
    let jy = hashToSigned01_seeded(ip0.x + 19u, ip0.y + 23u, ip0.z + 29u, seed);\r
    let warpScale = params.warpAmp * pixelBase * 0.0025;\r
    wp = px + vec2<f32>(jx, jy) * warpScale;\r
  }\r
\r
  // Sample HF and LF bands using the tiled value noise (coords pre-scaled)\r
  let high = valueNoise2D_seeded(wp * highScale, 1.0, seed, 0.0, 0.0);\r
  let lowSample = valueNoise2D_seeded(wp * lowScale, 1.0, seed, 0.0, 0.0);\r
\r
  let suppress = max(params.gain, 0.0);\r
  var result = high - lowSample * suppress;\r
\r
  let contrastFactor = 2.0;\r
  result = result * contrastFactor;\r
  result = result * (1.0 / (1.0 + suppress));\r
\r
  let rClamped = clamp(result, -1.0, 1.0);\r
  return rClamped * 0.5 + 0.5;\r
}\r
\r
\r
\r
// Shared tiling constants\r
const WGX : u32 = 8u;\r
const WGY : u32 = 8u;\r
const TILE_W : u32 = WGX + 2u; // 1 texel halo on each side\r
const TILE_H : u32 = WGY + 2u;\r
\r
// Per-kernel workgroup tiles at module scope\r
var<workgroup> normalTile  : array<array<f32, TILE_W>, TILE_H>;\r
var<workgroup> normal8Tile : array<array<f32, TILE_W>, TILE_H>;\r
var<workgroup> volumeTile  : array<array<f32, TILE_W>, TILE_H>;\r
var<workgroup> sphereTile  : array<array<f32, TILE_W>, TILE_H>;\r
\r
// Height fetch \r
fn sampleHeight(x: i32, y: i32, z: i32) -> f32 { if (readFrom3D()) { return textureLoad(inputTex3D, vec3<i32>(x, y, clampZ(z)), 0).x; } return textureLoad(inputTex, vec2<i32>(x, y), frame.layerIndex, 0).x; } fn safeNormalize(v: vec3<f32>) -> vec3<f32> { let len2 = dot(v, v); if (len2 > 1e-12) { return v * inverseSqrt(len2); } return vec3<f32>(0.0, 0.0, 1.0); }\r
\r
@compute @workgroup_size(WGX, WGY, 1)\r
fn computeNormal(@builtin(global_invocation_id) gid: vec3<u32>,\r
                 @builtin(local_invocation_id)  lid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let wMax = i32(frame.fullWidth)  - 1;\r
  let hMax = i32(frame.fullHeight) - 1;\r
\r
  let tx = i32(lid.x) + 1;\r
  let ty = i32(lid.y) + 1;\r
\r
  let cx = clamp(fx, 0, wMax);\r
  let cy = clamp(fy, 0, hMax);\r
\r
  // center\r
  normalTile[u32(ty)][u32(tx)] = sampleHeight(cx, cy, fz);\r
\r
  // 1-texel halo\r
  if (lid.x == 0u)               { normalTile[u32(ty)][0u]               = sampleHeight(clamp(cx - 1, 0, wMax), cy, fz); }\r
  if (lid.x == WGX - 1u)         { normalTile[u32(ty)][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), cy, fz); }\r
  if (lid.y == 0u)               { normalTile[0u][u32(tx)]               = sampleHeight(cx, clamp(cy - 1, 0, hMax), fz); }\r
  if (lid.y == WGY - 1u)         { normalTile[TILE_H - 1u][u32(tx)]      = sampleHeight(cx, clamp(cy + 1, 0, hMax), fz); }\r
  if (lid.x == 0u && lid.y == 0u) {\r
    normalTile[0u][0u]            = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);\r
  }\r
  if (lid.x == WGX - 1u && lid.y == 0u) {\r
    normalTile[0u][TILE_W - 1u]   = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);\r
  }\r
  if (lid.x == 0u && lid.y == WGY - 1u) {\r
    normalTile[TILE_H - 1u][0u]   = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);\r
  }\r
  if (lid.x == WGX - 1u && lid.y == WGY - 1u) {\r
    normalTile[TILE_H - 1u][TILE_W - 1u] = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);\r
  }\r
\r
  workgroupBarrier();\r
\r
  // 4-neighbor central differences\r
  let zC = normalTile[u32(ty)][u32(tx)];\r
  let zL = normalTile[u32(ty)][u32(tx - 1)];\r
  let zR = normalTile[u32(ty)][u32(tx + 1)];\r
  let zD = normalTile[u32(ty - 1)][u32(tx)];\r
  let zU = normalTile[u32(ty + 1)][u32(tx)];\r
\r
  let dx = (zR - zL) * 0.5;\r
  let dy = (zU - zD) * 0.5;\r
\r
  let n   = normalize(vec3<f32>(dx, dy, 1.0));\r
  let enc = n * 0.5 + vec3<f32>(0.5);\r
\r
  // pack: .r = original height, .g = enc.y, .b = enc.x, .a = enc.z\r
  let outCol = vec4<f32>(zC, enc.y, enc.x, enc.z);\r
  storeRGBA(cx, cy, fz, outCol);\r
}\r
\r
// 8-neighbor filtered gradient using the same tile\r
@compute @workgroup_size(WGX, WGY, 1)\r
fn computeNormal8(@builtin(global_invocation_id) gid: vec3<u32>,\r
                  @builtin(local_invocation_id)  lid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let wMax = i32(frame.fullWidth)  - 1;\r
  let hMax = i32(frame.fullHeight) - 1;\r
\r
  let tx = i32(lid.x) + 1;\r
  let ty = i32(lid.y) + 1;\r
\r
  let cx = clamp(fx, 0, wMax);\r
  let cy = clamp(fy, 0, hMax);\r
\r
  // center\r
  normal8Tile[u32(ty)][u32(tx)] = sampleHeight(cx, cy, fz);\r
\r
  // halo\r
  if (lid.x == 0u)                    { normal8Tile[u32(ty)][0u]               = sampleHeight(clamp(cx - 1, 0, wMax), cy, fz); }\r
  if (lid.x == WGX - 1u)              { normal8Tile[u32(ty)][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), cy, fz); }\r
  if (lid.y == 0u)                    { normal8Tile[0u][u32(tx)]               = sampleHeight(cx, clamp(cy - 1, 0, hMax), fz); }\r
  if (lid.y == WGY - 1u)              { normal8Tile[TILE_H - 1u][u32(tx)]      = sampleHeight(cx, clamp(cy + 1, 0, hMax), fz); }\r
  if (lid.x == 0u && lid.y == 0u)     { normal8Tile[0u][0u]                    = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy - 1, 0, hMax), fz); }\r
  if (lid.x == WGX - 1u && lid.y == 0u) {\r
    normal8Tile[0u][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);\r
  }\r
  if (lid.x == 0u && lid.y == WGY - 1u) {\r
    normal8Tile[TILE_H - 1u][0u]      = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);\r
  }\r
  if (lid.x == WGX - 1u && lid.y == WGY - 1u) {\r
    normal8Tile[TILE_H - 1u][TILE_W - 1u] = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);\r
  }\r
\r
  workgroupBarrier();\r
\r
  let zC  = normal8Tile[u32(ty)][u32(tx)];\r
  let zL  = normal8Tile[u32(ty)][u32(tx - 1)];\r
  let zR  = normal8Tile[u32(ty)][u32(tx + 1)];\r
  let zD  = normal8Tile[u32(ty - 1)][u32(tx)];\r
  let zU  = normal8Tile[u32(ty + 1)][u32(tx)];\r
  let zUL = normal8Tile[u32(ty + 1)][u32(tx - 1)];\r
  let zUR = normal8Tile[u32(ty + 1)][u32(tx + 1)];\r
  let zDL = normal8Tile[u32(ty - 1)][u32(tx - 1)];\r
  let zDR = normal8Tile[u32(ty - 1)][u32(tx + 1)];\r
\r
  let dx = ((zR + zUR + zDR) - (zL + zUL + zDL)) / 3.0;\r
  let dy = ((zU + zUR + zUL) - (zD + zDR + zDL)) / 3.0;\r
\r
  let n   = normalize(vec3<f32>(dx, dy, 1.0));\r
  let enc = n * 0.5 + vec3<f32>(0.5);\r
  let outCol = vec4<f32>(zC, enc.y, enc.x, enc.z);\r
  storeRGBA(cx, cy, fz, outCol);\r
}\r
\r
fn encode01(v: vec3<f32>) -> vec3<f32> {\r
    return v * 0.5 + vec3<f32>(0.5);\r
}\r
\r
// Volume normals: tile the XY plane and only sample Z neighbors per pixel\r
@compute @workgroup_size(WGX, WGY, 1)\r
fn computeNormalVolume(@builtin(global_invocation_id) gid: vec3<u32>,\r
                       @builtin(local_invocation_id)  lid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let wMax = i32(frame.fullWidth)  - 1;\r
  let hMax = i32(frame.fullHeight) - 1;\r
\r
  let tx = i32(lid.x) + 1;\r
  let ty = i32(lid.y) + 1;\r
\r
  let cx = clamp(fx, 0, wMax);\r
  let cy = clamp(fy, 0, hMax);\r
\r
  // center slice values once per tile\r
  volumeTile[u32(ty)][u32(tx)] = sampleHeight(cx, cy, fz);\r
  if (lid.x == 0u)                    { volumeTile[u32(ty)][0u]               = sampleHeight(clamp(cx - 1, 0, wMax), cy, fz); }\r
  if (lid.x == WGX - 1u)              { volumeTile[u32(ty)][TILE_W - 1u]      = sampleHeight(clamp(cx + 1, 0, wMax), cy, fz); }\r
  if (lid.y == 0u)                    { volumeTile[0u][u32(tx)]               = sampleHeight(cx, clamp(cy - 1, 0, hMax), fz); }\r
  if (lid.y == WGY - 1u)              { volumeTile[TILE_H - 1u][u32(tx)]      = sampleHeight(cx, clamp(cy + 1, 0, hMax), fz); }\r
  if (lid.x == 0u && lid.y == 0u)     { volumeTile[0u][0u]                    = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy - 1, 0, hMax), fz); }\r
  if (lid.x == WGX - 1u && lid.y == 0u) {\r
    volumeTile[0u][TILE_W - 1u]       = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy - 1, 0, hMax), fz);\r
  }\r
  if (lid.x == 0u && lid.y == WGY - 1u) {\r
    volumeTile[TILE_H - 1u][0u]       = sampleHeight(clamp(cx - 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);\r
  }\r
  if (lid.x == WGX - 1u && lid.y == WGY - 1u) {\r
    volumeTile[TILE_H - 1u][TILE_W - 1u] = sampleHeight(clamp(cx + 1, 0, wMax), clamp(cy + 1, 0, hMax), fz);\r
  }\r
\r
  workgroupBarrier();\r
\r
  let zC = volumeTile[u32(ty)][u32(tx)];\r
  let zL = volumeTile[u32(ty)][u32(tx - 1)];\r
  let zR = volumeTile[u32(ty)][u32(tx + 1)];\r
  let zD = volumeTile[u32(ty - 1)][u32(tx)];\r
  let zU = volumeTile[u32(ty + 1)][u32(tx)];\r
\r
  let dx = (zR - zL) * 0.5;\r
  let dy = (zU - zD) * 0.5;\r
\r
  let zB = sampleHeight(cx, cy, clampZ(fz - 1));\r
  let zF = sampleHeight(cx, cy, clampZ(fz + 1));\r
  let dz = (zF - zB) * 0.5;\r
\r
  let n   = safeNormalize(vec3<f32>(dx, dy, dz));\r
  let enc = encode01(n);\r
  storeRGBA(cx, cy, fz, vec4<f32>(enc, zC));\r
}\r
\r
\r
// Sphere normals with shared tile and wrapped longitude\r
@compute @workgroup_size(WGX, WGY, 1)\r
fn computeSphereNormal(@builtin(global_invocation_id) gid: vec3<u32>,\r
                       @builtin(local_invocation_id)  lid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let w  = i32(frame.fullWidth);\r
    let h  = i32(frame.fullHeight);\r
\r
    // wrap longitude, clamp latitude\r
    let wrapX  = ((fx % w) + w) % w;\r
    let clampY = clamp(fy, 0, h - 1);\r
\r
    let tx = i32(lid.x) + 1;\r
    let ty = i32(lid.y) + 1;\r
\r
    // center\r
    sphereTile[u32(ty)][u32(tx)] =\r
        textureLoad(inputTex, vec2<i32>(wrapX, clampY), frame.layerIndex, 0).x;\r
\r
    // halo\r
    if (lid.x == 0u) {\r
        let lx = ((wrapX - 1) % w + w) % w;\r
        sphereTile[u32(ty)][0u] =\r
            textureLoad(inputTex, vec2<i32>(lx, clampY), frame.layerIndex, 0).x;\r
    }\r
    if (lid.x == WGX - 1u) {\r
        let rx = ((wrapX + 1) % w + w) % w;\r
        sphereTile[u32(ty)][TILE_W - 1u] =\r
            textureLoad(inputTex, vec2<i32>(rx, clampY), frame.layerIndex, 0).x;\r
    }\r
    if (lid.y == 0u) {\r
        let dy = clamp(clampY - 1, 0, h - 1);\r
        sphereTile[0u][u32(tx)] =\r
            textureLoad(inputTex, vec2<i32>(wrapX, dy), frame.layerIndex, 0).x;\r
    }\r
    if (lid.y == WGY - 1u) {\r
        let uy = clamp(clampY + 1, 0, h - 1);\r
        sphereTile[TILE_H - 1u][u32(tx)] =\r
            textureLoad(inputTex, vec2<i32>(wrapX, uy), frame.layerIndex, 0).x;\r
    }\r
    // corners\r
    if (lid.x == 0u && lid.y == 0u) {\r
        let lx = ((wrapX - 1) % w + w) % w;\r
        let dy = clamp(clampY - 1, 0, h - 1);\r
        sphereTile[0u][0u] =\r
            textureLoad(inputTex, vec2<i32>(lx, dy), frame.layerIndex, 0).x;\r
    }\r
    if (lid.x == WGX - 1u && lid.y == 0u) {\r
        let rx = ((wrapX + 1) % w + w) % w;\r
        let dy = clamp(clampY - 1, 0, h - 1);\r
        sphereTile[0u][TILE_W - 1u] =\r
            textureLoad(inputTex, vec2<i32>(rx, dy), frame.layerIndex, 0).x;\r
    }\r
    if (lid.x == 0u && lid.y == WGY - 1u) {\r
        let lx = ((wrapX - 1) % w + w) % w;\r
        let uy = clamp(clampY + 1, 0, h - 1);\r
        sphereTile[TILE_H - 1u][0u] =\r
            textureLoad(inputTex, vec2<i32>(lx, uy), frame.layerIndex, 0).x;\r
    }\r
    if (lid.x == WGX - 1u && lid.y == WGY - 1u) {\r
        let rx = ((wrapX + 1) % w + w) % w;\r
        let uy = clamp(clampY + 1, 0, h - 1);\r
        sphereTile[TILE_H - 1u][TILE_W - 1u] =\r
            textureLoad(inputTex, vec2<i32>(rx, uy), frame.layerIndex, 0).x;\r
    }\r
\r
    workgroupBarrier();\r
\r
    // fetch\r
    let baseH = sphereTile[u32(ty)][u32(tx)];\r
    let hL    = sphereTile[u32(ty)][u32(tx - 1)];\r
    let hR    = sphereTile[u32(ty)][u32(tx + 1)];\r
    let hD    = sphereTile[u32(ty - 1)][u32(tx)];\r
    let hU    = sphereTile[u32(ty + 1)][u32(tx)];\r
\r
    // radii\r
    let r0 = options.baseRadius + baseH * options.heightScale;\r
    let rL = options.baseRadius + hL    * options.heightScale;\r
    let rR = options.baseRadius + hR    * options.heightScale;\r
    let rD = options.baseRadius + hD    * options.heightScale;\r
    let rU = options.baseRadius + hU    * options.heightScale;\r
\r
    // spherical angles and increments\r
    let theta  = f32(clampY) / f32(h - 1) * PI;\r
    let phi    = f32(wrapX)  / f32(w - 1) * 2.0 * PI;\r
    let dTheta = PI / f32(h - 1);\r
    let dPhi   = 2.0 * PI / f32(w - 1);\r
\r
    // precompute sines and cosines\r
    let sTh  = sin(theta);\r
    let cTh  = cos(theta);\r
    let sPh  = sin(phi);\r
    let cPh  = cos(phi);\r
    let sThU = sin(theta + dTheta);\r
    let cThU = cos(theta + dTheta);\r
    let sPhE = sin(phi + dPhi);\r
    let cPhE = cos(phi + dPhi);\r
\r
    // positions on the sphere\r
    let p0 = vec3<f32>(r0 * sTh * cPh,\r
                       r0 * sTh * sPh,\r
                       r0 * cTh);\r
\r
    let pE = vec3<f32>(rR * sTh * cPhE,\r
                       rR * sTh * sPhE,\r
                       rR * cTh);\r
\r
    let pN = vec3<f32>(rU * sThU * cPh,\r
                       rU * sThU * sPh,\r
                       rU * cThU);\r
\r
    // normal\r
    let tE = pE - p0;\r
    let tN = pN - p0;\r
    let n  = normalize(cross(tE, tN));\r
    let enc = n * 0.5 + vec3<f32>(0.5);\r
\r
    // pack and store\r
    let outCol = vec4<f32>(baseH, enc.x, enc.y, enc.z);\r
    textureStore(outputTex, vec2<i32>(wrapX, clampY), frame.layerIndex, outCol);\r
}\r
\r
\r
// Texture clear to reset channel(s)\r
@compute @workgroup_size(8, 8, 1)\r
fn clearTexture(@builtin(global_invocation_id) gid : vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  writeChannel(fx, fy, fz, 0.0, options.outputChannel, 1u);\r
}\r
\r
// \u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\r
// 0) Perlin\r
// \u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\r
@compute @workgroup_size(8, 8, 1)\r
fn computePerlin(@builtin(global_invocation_id) gid : vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
\r
    // fetch the 3D position for this pixel\r
    let p  = fetchPos(fx, fy, fz);\r
\r
    // generate one sample of Perlin noise\r
    let v0 = generatePerlin(p, params);\r
\r
    // add it into the selected channel (or all channels) of the output\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 0.1) Perlin 4D (fBM using time as W)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computePerlin4D(@builtin(global_invocation_id) gid : vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
\r
    // fetch the 3D position for this pixel (w comes from params.time inside the generator)\r
    let p  = fetchPos(fx, fy, fz);\r
\r
    // generate one sample of 4D Perlin fBM (uses params.time as 4th dim)\r
    let v0 = generatePerlin4D(p, params);\r
\r
    // write into output\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 1) Billow\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeBillow(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateBillow(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 2) AntiBillow\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiBillow(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiBillow(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 3) Ridge\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeRidge(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateRidge(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 4) AntiRidge\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiRidge(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiRidge(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 5) RidgedMultifractal\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeRidgedMultifractal(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateRidgedMultifractal(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 6) RidgedMultifractal2\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeRidgedMultifractal2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateRidgedMultifractal2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 7) RidgedMultifractal3\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeRidgedMultifractal3(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateRidgedMultifractal3(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 8) RidgedMultifractal4\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeRidgedMultifractal4(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateRidgedMultifractal4(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 9) AntiRidgedMultifractal\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiRidgedMultifractal(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiRidgedMultifractal(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 10) AntiRidgedMultifractal2\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiRidgedMultifractal2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiRidgedMultifractal2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 11) AntiRidgedMultifractal3\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiRidgedMultifractal3(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiRidgedMultifractal3(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 12) AntiRidgedMultifractal4\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiRidgedMultifractal4(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiRidgedMultifractal4(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 13) FBM (2\xB7simplex chain)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFBM(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateFBM(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 14) FBM2 (chain+zoom FBM)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFBM2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateFBM2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 15) FBM3 (three-stage FBM chain)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFBM3(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateFBM3(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 16) CellularBM1\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM1(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateCellularBM1(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 17) CellularBM2\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateCellularBM2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 18) CellularBM3\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM3(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateCellularBM3(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 19) VoronoiBM1\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM1(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiBM1(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 20) VoronoiBM2\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiBM2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 21) VoronoiBM3\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM3(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiBM3(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 22) Cellular\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellular(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateCellular(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
  22.1) AntiCellular\r
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiCellular(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiCellular(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 22.2) Cellular\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellular4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateCellular4D(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
  22.3) AntiCellular\r
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiCellular4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiCellular4D(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 23) Worley\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorley(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateWorley(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
  23.1) AntiWorley\r
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiWorley(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateAntiWorley(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 23.2) Worley 4D (fBM using time as W)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorley4D(@builtin(global_invocation_id) gid : vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
\r
    // fetch the 3D position for this pixel (w comes from params.time inside the generator)\r
    let p  = fetchPos(fx, fy, fz);\r
\r
    // generate one sample of 4D Worley fBM (uses params.time as 4th dim)\r
    let v0 = generateWorley4D(p, params);\r
\r
    // write into output\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 23.3) Worley 4D (fBM using time as W)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeAntiWorley4D(@builtin(global_invocation_id) gid : vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
\r
    // fetch the 3D position for this pixel (w comes from params.time inside the generator)\r
    let p  = fetchPos(fx, fy, fz);\r
\r
    // generate one sample of 4D Worley fBM (uses params.time as 4th dim)\r
    let v0 = generateAntiWorley4D(p, params);\r
\r
    // write into output\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// Worley 4D BM variants (time as W)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorleyBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateWorleyBM1_4D(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorleyBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateWorleyBM2_4D(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorleyBM3_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateWorleyBM3_4D(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorleyBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateWorleyBM1_4D_vec(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorleyBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateWorleyBM2_4D_vec(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWorleyBM3_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateWorleyBM3_4D_vec(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// Cellular 4D BM variants (time as W)\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateCellularBM1_4D(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateCellularBM2_4D(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM3_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateCellularBM3_4D(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateCellularBM1_4D_vec(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateCellularBM2_4D_vec(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeCellularBM3_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let p = fetchPos(fx, fy, fz);\r
  let v0 = generateCellularBM3_4D_vec(p, params);\r
\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 24) VoronoiTileNoise\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiTileNoise(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiTileNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 25) LanczosBillow\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeLanczosBillow(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateLanczosBillow(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 26) LanczosAntiBillow\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeLanczosAntiBillow(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateLanczosAntiBillow(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 27) Voronoi Circle-Gradient Noise\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiCircleNoise(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiCircleNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 28) Voronoi Circle-Gradient Tile Noise 2\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiCircle2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiCircle2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 29) Voronoi Flat-Shade Tile Noise\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiFlatShade(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiFlatShade(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 30) Voronoi Ripple 3D\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiRipple3D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiRipple3D(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 31) Voronoi Ripple 3D 2\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiRipple3D2(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiRipple3D2(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 32) Voronoi Circular Ripple 3D\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiCircularRipple(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateVoronoiCircularRipple(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 33) Fractal Voronoi Ripple 3D\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFVoronoiRipple3D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateFVoronoiRipple3D(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 34) Fractal Voronoi Circular Ripple 3D\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFVoronoiCircularRipple(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateFVoronoiCircularRipple(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 35) Ripple Noise\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeRippleNoise(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateRippleNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 36) Fractal Ripples\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFractalRipples(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateFractalRipples(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 37) HexWorms\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeHexWorms(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateHexWormsNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 38) PerlinWorms\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computePerlinWorms(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generatePerlinWormsNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 39) White Noise\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeWhiteNoise(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateWhiteNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// 40) Blue Noise\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
@compute @workgroup_size(8, 8, 1)\r
fn computeBlueNoise(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let fz = i32(frame.originZ) + i32(gid.z);\r
    let p  = fetchPos(fx, fy, fz);\r
    let v0 = generateBlueNoise(p, params);\r
    writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
// 41) Simplex\r
@compute @workgroup_size(8,8,1)\r
fn computeSimplex(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  let v0 = generateSimplex(p, params);\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeSimplexFBM(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  let v0 = generateSimplexFBM(p, params);\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeCurl2D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let pos = fetchPos(fx, fy, fz).xy;\r
  let v   = curl2_simplex2D(pos, params);\r
  // gentle gain so it doesn\u2019t clip hard; tweak 0.75 if you like\r
  let m   = mag_to_signed01(length(v) * 0.75);\r
\r
  writeChannel(fx, fy, fz, m, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeCurlFBM2D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  let pos = fetchPos(fx, fy, fz).xy;\r
  let v   = curl2_simplexFBM(pos, params);\r
  let m   = mag_to_signed01(length(v) * 0.75);\r
\r
  writeChannel(fx, fy, fz, m, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeDomainWarpFBM1(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateDomainWarpFBM1(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeDomainWarpFBM2(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateDomainWarpFBM2(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeGaborAnisotropic(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateGaborAniso(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeTerraceNoise(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateTerraceNoise(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeFoamNoise(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateFoamNoise(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeTurbulence(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateTurbulence(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateBillow4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeAntiBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateAntiBillow4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeLanczosBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateLanczosBillow4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeLanczosAntiBillow4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateLanczosAntiBillow4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeFBM4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateFBM4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeVoronoi4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoi4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoiBM1_4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoiBM2_4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM3_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoiBM3_4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoiBM1_4D_vec(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoiBM2_4D_vec(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeVoronoiBM3_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateVoronoiBM3_4D_vec(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeDomainWarpFBM1_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateDomainWarpFBM1_4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeDomainWarpFBM2_4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateDomainWarpFBM2_4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeDomainWarpFBM1_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateDomainWarpFBM1_4D_vec(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeDomainWarpFBM2_4D_vec(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateDomainWarpFBM2_4D_vec(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeTerraceNoise4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateTerraceNoise4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeFoamNoise4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateFoamNoise4D(p, params), options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeTurbulence4D(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateTurbulence4D(p, params), options.outputChannel, 0u);\r
}\r
\r
\r
\r
// too slow to compile all at once due to branching, had to write new entry point logic\r
// fn computeMixedNoise(pos : vec3<f32>) -> f32 {\r
//     var result   : f32 = 0.0;\r
//     var paramIdx : u32 = 0u;\r
\r
//     // copy the mask so we can eat bits out of it\r
//     var bits : u32 = options.mask;\r
\r
//     // while there's still a set bit, handle just that one\r
//     loop {\r
//         // bail as soon as we've consumed all bits\r
//         if (bits == 0u) {\r
//             break;\r
//         }\r
\r
//         // find the lowest set bit index\r
//         let i : u32 = firstTrailingBit(bits);\r
\r
//         // clear that bit so next iteration finds the next one\r
//         bits = bits & (bits - 1u);\r
\r
//         // load this algo's params\r
//         let p = params[paramIdx];\r
//         paramIdx = paramIdx + 1u;\r
\r
//         // dispatch the one selected generator\r
//         var v : f32 = 0.0;\r
//         switch(i) {\r
//             case 0u:  { v = generatePerlin(pos, p); }\r
//             // case 1u:  { v = generateBillow(pos, p); }\r
//             // case 2u:  { v = generateAntiBillow(pos, p); }\r
//             // case 3u:  { v = generateRidge(pos, p); }\r
//             // case 4u:  { v = generateAntiRidge(pos, p); }\r
//             // case 5u:  { v = generateRidgedMultifractal(pos, p); }\r
//             // case 6u:  { v = generateRidgedMultifractal2(pos, p); }\r
//             // case 7u:  { v = generateRidgedMultifractal3(pos, p); }\r
//             // case 8u:  { v = generateRidgedMultifractal4(pos, p); }\r
//             // case 9u:  { v = generateAntiRidgedMultifractal(pos, p); }\r
//             // case 10u: { v = generateAntiRidgedMultifractal2(pos, p); }\r
//             // case 11u: { v = generateAntiRidgedMultifractal3(pos, p); }\r
//             // case 12u: { v = generateAntiRidgedMultifractal4(pos, p); }\r
//             // case 13u: { v = generateFBM(pos, p); }\r
//             // case 14u: { v = generateFBM2(pos, p); }\r
//             // case 15u: { v = generateFBM3(pos, p); }\r
//             // case 16u: { v = generateCellularBM1(pos, p); }\r
//             // case 17u: { v = generateCellularBM2(pos, p); }\r
//             // case 18u: { v = generateCellularBM3(pos, p); }\r
//             // case 19u: { v = generateVoronoiBM1(pos, p); }\r
//             // case 20u: { v = generateVoronoiBM2(pos, p); }\r
//             // case 21u: { v = generateVoronoiBM3(pos, p); }\r
//             // case 22u: { v = generateCellular(pos, p); }\r
//             // case 23u: { v = generateWorley(pos, p); }\r
//             // case 24u: { v = generateVoronoiTileNoise(pos, p); }\r
//             // case 25u: { v = generateLanczosBillow(pos, p); }\r
//             // case 26u: { v = generateLanczosAntiBillow(pos, p); }\r
//             //todo port the rest, also more generic ones like white/blue noise\r
//             default:  { /* unsupported bit \u2192 no contribution */ }\r
//         }\r
\r
//         result = result + v;\r
\r
//         // stop if we've reached the max slots you filled\r
//         if (paramIdx >= MAX_NOISE_CONFIGS) {\r
//             break;\r
//         }\r
//     }\r
\r
//     return result;\r
// }\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Compute Entry \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
// @compute @workgroup_size(8, 8, 1)\r
// fn main(@builtin(global_invocation_id) gid : vec3<u32>) {\r
//     // 2) compute absolute pixel coords in the full output\r
//     let fx = i32(frame.originX) + i32(gid.x);\r
//     let fy = i32(frame.originY) + i32(gid.y);\r
//     let p = fetchPos(fx, fy);\r
\r
//     // 4) compute the mixed noise height\r
//     let h = computeMixedNoise(p);\r
\r
//     // 5) (optional) finite-difference normal\r
//     var out: vec4<f32>;\r
//     if (options.getGradient == 1u) {\r
//         // let ex = options.epsilon.x;\r
//         // let ey = options.epsilon.y;\r
//         // let ez = options.epsilon.z;\r
\r
//         // let hx = computeMixedNoise(p + vec3<f32>(ex, 0.0, 0.0));\r
//         // let lx = computeMixedNoise(p - vec3<f32>(ex, 0.0, 0.0));\r
//         // let hy = computeMixedNoise(p + vec3<f32>(0.0, ey, 0.0));\r
//         // let ly = computeMixedNoise(p - vec3<f32>(0.0, ey, 0.0));\r
//         // let hz = computeMixedNoise(p + vec3<f32>(0.0, 0.0, ez));\r
//         // let lz = computeMixedNoise(p - vec3<f32>(0.0, 0.0, ez));\r
\r
//         // var dx = (hx - lx) / (2.0 * ex);\r
//         // var dy = (hy - ly) / (2.0 * ey);\r
//         // var dz = (hz - lz) / (2.0 * ez);\r
//         // let invLen = 1.0 / max(1e-6, sqrt(dx*dx + dy*dy + dz*dz));\r
//         // dx *= invLen; dy *= invLen; dz *= invLen;\r
\r
//         // out = vec4<f32>(h, dx, dy, dz);\r
//     } else {\r
//         out = vec4<f32>(h, h, h, h);\r
//     }\r
\r
//   // 6) write into the layer of the 2D-array texture\r
//   textureStore(\r
//     outputTex,\r
//     vec2<i32>(fx, fy),\r
//     frame.layerIndex,      \r
//     out\r
//   );\r
// }\r
\r
\r
\r
// 5x5 Gaussian blur (separable weights via shared tile, single-pass)\r
// Applies per-channel convolution on RGBA and writes rgba16f\r
// If options.outputChannel == 0, writes all channels\r
// If 1..4, only that channel is replaced with blurred value, others copied from source\r
\r
const WG_X : u32 = 16u;\r
const WG_Y : u32 = 16u;\r
const R    : u32 = 2u;        // kernel radius for 5x5\r
const TILE_SIZE : u32 = TILE_W * TILE_H;\r
\r
const G5 : array<f32, 5> = array<f32,5>(1.0, 4.0, 6.0, 4.0, 1.0);\r
const G5NORM : f32 = 1.0 / 256.0;\r
\r
var<workgroup> tileRGBA : array<vec4<f32>, TILE_SIZE>;\r
\r
fn tileIndex(x: u32, y: u32)->u32 {\r
  return y * TILE_W + x;\r
}\r
\r
@compute @workgroup_size(WG_X, WG_Y, 1)\r
fn computeGauss5x5(\r
  @builtin(local_invocation_id)  lid: vec3<u32>,\r
  @builtin(workgroup_id)         wid: vec3<u32>,\r
  @builtin(global_invocation_id) gid: vec3<u32>\r
){\r
  // Workgroup top-left in full image space\r
  let wgOx = i32(frame.originX) + i32(wid.x) * i32(WG_X);\r
  let wgOy = i32(frame.originY) + i32(wid.y) * i32(WG_Y);\r
  let fz   = i32(frame.originZ) + i32(gid.z);\r
\r
  // Cooperatively load a (WG_X+4) x (WG_Y+4) tile with a 2px halo\r
  var ty: u32 = lid.y;\r
  loop {\r
    if (ty >= TILE_H) { break; }\r
    var tx: u32 = lid.x;\r
    loop {\r
      if (tx >= TILE_W) { break; }\r
      let sx = clamp(wgOx + i32(tx) - i32(R), 0, i32(frame.fullWidth)  - 1);\r
      let sy = clamp(wgOy + i32(ty) - i32(R), 0, i32(frame.fullHeight) - 1);\r
      tileRGBA[tileIndex(tx, ty)] = loadPrevRGBA(sx, sy, fz);\r
      tx += WG_X;\r
    }\r
    ty += WG_Y;\r
  }\r
  workgroupBarrier();\r
\r
  // Output pixel this thread is responsible for\r
  let fx = wgOx + i32(lid.x);\r
  let fy = wgOy + i32(lid.y);\r
\r
  // Guard writes that might fall off the image on the final groups\r
  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {\r
    return;\r
  }\r
\r
  // Center within the shared tile\r
  let txc = u32(lid.x) + R;\r
  let tyc = u32(lid.y) + R;\r
\r
  // 5x5 Gaussian using separable weights via outer product on the tile\r
  var acc : vec4<f32> = vec4<f32>(0.0);\r
  for (var j: u32 = 0u; j < 5u; j = j + 1u) {\r
    let wy = G5[j];\r
    let tyN = u32(i32(tyc) + i32(j) - 2);\r
    for (var i: u32 = 0u; i < 5u; i = i + 1u) {\r
      let wx = G5[i];\r
      let txN = u32(i32(txc) + i32(i) - 2);\r
      let w = (wx * wy) * G5NORM;\r
      acc += tileRGBA[tileIndex(txN, tyN)] * w;\r
    }\r
  }\r
\r
  // Channel selection: 0 -> write all, 1..4 -> replace that channel only\r
  var outCol = acc;\r
  if (options.outputChannel != 0u) {\r
    let src = loadPrevRGBA(fx, fy, fz);\r
    let c = options.outputChannel;\r
    outCol = src;\r
    if (c == 1u) { outCol.x = acc.x; }\r
    else if (c == 2u) { outCol.y = acc.y; }\r
    else if (c == 3u) { outCol.z = acc.z; }\r
    else if (c == 4u) { outCol.w = acc.w; }\r
  }\r
\r
  storeRGBA(fx, fy, fz, outCol);\r
}\r
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
      const {
        seed = Date.now() | 0,
        zoom = 1,
        freq = 1,
        octaves = 8,
        lacunarity = 2,
        gain = 0.5,
        xShift = 0,
        yShift = 0,
        zShift = 0,
        turbulence = 0,
        seedAngle = 0,
        exp1 = 1,
        exp2 = 0,
        threshold = 0.1,
        rippleFreq = 10,
        time = 0,
        warpAmp = 0.5,
        gaborRadius = 4,
        terraceStep = 8,
        // Toroidal options
        toroidal = 0,
        // (0/1)
        // Voronoi options (new)
        voroMode = 0,
        // u32 mode selector
        edgeK = 0
        // f32 edge strength/scale
      } = params;
      const _zoom = Math.max(zoom, 1e-6);
      const _freq = Math.max(freq, 1e-6);
      const toroFlag = (toroidal ? 1 : 0) >>> 0;
      const buf = new ArrayBuffer(22 * 4);
      const dv = new DataView(buf);
      let base = 0;
      dv.setUint32(base + 0, seed >>> 0, true);
      dv.setFloat32(base + 4, zoom, true);
      dv.setFloat32(base + 8, freq, true);
      dv.setUint32(base + 12, octaves >>> 0, true);
      dv.setFloat32(base + 16, lacunarity, true);
      dv.setFloat32(base + 20, gain, true);
      dv.setFloat32(base + 24, xShift, true);
      dv.setFloat32(base + 28, yShift, true);
      dv.setFloat32(base + 32, zShift, true);
      dv.setUint32(base + 36, turbulence ? 1 : 0, true);
      dv.setFloat32(base + 40, seedAngle, true);
      dv.setFloat32(base + 44, exp1, true);
      dv.setFloat32(base + 48, exp2, true);
      dv.setFloat32(base + 52, threshold, true);
      dv.setFloat32(base + 56, rippleFreq, true);
      dv.setFloat32(base + 60, time, true);
      dv.setFloat32(base + 64, warpAmp, true);
      dv.setFloat32(base + 68, gaborRadius, true);
      dv.setFloat32(base + 72, terraceStep, true);
      dv.setUint32(base + 76, toroFlag >>> 0, true);
      dv.setUint32(base + 80, voroMode >>> 0, true);
      dv.setFloat32(base + 84, edgeK, true);
      this.queue.writeBuffer(this.paramsBuffer, 0, buf);
      for (const pair of this._texPairs.values()) pair.bindGroupDirty = true;
      for (const [key, vol] of this._volumeCache) {
        if (!vol || !Array.isArray(vol.chunks)) continue;
        vol._bindGroupsDirty = true;
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
    _create2DPair(W, H) {
      const t = this._compute2DTiling(W, H);
      const usage = GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST;
      const makeTex = () => this.device.createTexture({
        size: [t.tileW, t.tileH, t.layers],
        format: "rgba16float",
        usage
      });
      const desc = { dimension: "2d-array", arrayLayerCount: t.layers };
      const texA = makeTex();
      const texB = makeTex();
      const viewA = texA.createView(desc);
      const viewB = texB.createView(desc);
      texA.label = `2D texA ${W}x${H}x${t.layers}`;
      texB.label = `2D texB ${W}x${H}x${t.layers}`;
      viewA.label = "2D:viewA";
      viewB.label = "2D:viewB";
      this._tag.set(viewA, "2D:A");
      this._tag.set(viewB, "2D:B");
      const tid = this._texPairs.size;
      this._texPairs.set(tid, {
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
      if (this._tid === null) this.setActiveTexture(tid);
      return tid;
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
      const pair = this._texPairs.get(tid);
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
          if (Array.isArray(tile.frames))
            for (const fb of tile.frames) {
              try {
                fb.destroy();
              } catch {
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
      this._texPairs.delete(tid);
      if (this._tid === tid) {
        this._tid = null;
        this.inputTextureView = null;
        this.outputTextureView = null;
        this.viewA = null;
        this.viewB = null;
      }
    }
    destroyAllTexturePairs() {
      const ids = Array.from(this._texPairs.keys());
      for (const tid of ids) this.destroyTexturePair(tid);
    }
    setActiveTexture(tid) {
      if (!this._texPairs.has(tid))
        throw new Error("setActiveTexture: invalid id");
      this._tid = tid;
      const pair = this._texPairs.get(tid);
      this.viewA = pair.viewA;
      this.viewB = pair.viewB;
      this.width = pair.tileWidth;
      this.height = pair.tileHeight;
      this.layers = pair.layers;
      this.inputTextureView = pair.isA ? pair.viewA : pair.viewB;
      this.outputTextureView = pair.isA ? pair.viewB : pair.viewA;
    }
    _buildPosBuffer(width, height, customData) {
      if ((this.useCustomPos | 0) === 0 && !customData) return this.nullPosBuffer;
      const numPixels = width * height;
      const data = customData instanceof Float32Array && customData.length === numPixels * 4 ? customData : new Float32Array(numPixels * 4);
      const buf = this.device.createBuffer({
        size: data.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      this.queue.writeBuffer(
        buf,
        0,
        data.buffer,
        data.byteOffset,
        data.byteLength
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
    _create2DTileBindGroups(tid, options = {}) {
      const pair = this._texPairs.get(tid);
      if (!pair) throw new Error("_create2DTileBindGroups: invalid tid");
      if (Array.isArray(pair.tiles) && !pair.bindGroupDirty) {
        if (!options.customData) return;
      }
      const tiles = [];
      for (let ty = 0; ty < pair.tilesY; ty++) {
        for (let tx = 0; tx < pair.tilesX; tx++) {
          const layerIndex = ty * pair.tilesX + tx;
          const originX = tx * pair.tileWidth;
          const originY = ty * pair.tileHeight;
          let existingTile = pair.tiles && pair.tiles[layerIndex] || null;
          let posBuf;
          if (existingTile && existingTile.posBuf && !options.customData) {
            posBuf = existingTile.posBuf;
          } else {
            posBuf = this._buildPosBuffer(
              pair.tileWidth,
              pair.tileHeight,
              options.customData
            );
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
          const worldFullW = Number.isFinite(options.frameFullWidth) ? options.frameFullWidth >>> 0 : pair.fullWidth;
          const worldFullH = Number.isFinite(options.frameFullHeight) ? options.frameFullHeight >>> 0 : pair.fullHeight;
          const scaleX = worldFullW / pair.fullWidth;
          const scaleY = worldFullH / pair.fullHeight;
          const originXf = originX * scaleX;
          const originYf = originY * scaleY;
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
            try {
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
                  // 3D unused for 2D path -> provide dummies
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
            } catch (e) {
              throw new Error(
                `_create2DTileBindGroups: createBindGroup failed: ${e?.message || e}`
              );
            }
          }
          tiles.push({
            layerIndex,
            originX,
            originY,
            frames: [fb],
            posBuf,
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
      const W = width | 0, H = height | 0;
      if (!(W > 0 && H > 0))
        throw new Error(`computeToTexture: invalid size ${width}x${height}`);
      if (this._tid == null) this._create2DPair(W, H);
      let pair = this._texPairs.get(this._tid);
      if (!pair || pair.fullWidth !== W || pair.fullHeight !== H) {
        const tid = this._create2DPair(W, H);
        this.setActiveTexture(tid);
        pair = this._texPairs.get(tid);
      }
      if (paramsObj && !Array.isArray(paramsObj)) this.setNoiseParams(paramsObj);
      const origOpts = options || {};
      this.setOptions({
        ...origOpts,
        ioFlags: 0,
        useCustomPos: origOpts.useCustomPos ?? this.useCustomPos
      });
      if (!pair.tiles || pair.bindGroupDirty || origOpts.customData) {
        this._create2DTileBindGroups(this._tid, options);
      }
      const isAStart = pair.isA;
      let finalUsed = null;
      let lastBGs = null;
      for (const tile of pair.tiles) {
        const { bgs } = tile;
        const { bgA, bgB } = bgs[0];
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
      this.isA = resultsInA;
      this.setActiveTexture(this._tid);
      return this.getCurrentView();
    }
    getCurrentView() {
      const p = this._texPairs.get(this._tid);
      if (!p) return null;
      return p.isA ? p.viewA : p.viewB;
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
    // Capture a 2D-array noise texture (one layer/channel) to a PNG Blob.
    // textureView: GPUTextureView for the 2D-array rgba16float texture
    // width/height: desired output resolution in pixels
    // opts: { layer?: number, channel?: number }
    async export2DTextureToPNGBlob(textureView, width, height, opts = {}) {
      if (!textureView) {
        throw new Error("export2DTextureToPNGBlob: textureView is required");
      }
      const W = Math.max(1, width | 0);
      const H = Math.max(1, height | 0);
      const layer = opts.layer ?? 0;
      const channel = opts.channel ?? 0;
      this.initBlitRender();
      if (this.queue && this.queue.onSubmittedWorkDone) {
        try {
          await this.queue.onSubmittedWorkDone();
        } catch (e) {
          console.warn(
            "export2DTextureToPNGBlob: onSubmittedWorkDone before export failed",
            e
          );
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
            clearValue: { r: 0, g: 0, b: 0, a: 1 }
          }
        ]
      });
      rpass.setPipeline(this.pipeline2D);
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
        {
          buffer: readBuffer,
          bytesPerRow,
          rowsPerImage: H
        },
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
      const isBGRA = true;
      let dst = 0;
      for (let y = 0; y < H; y++) {
        const rowStart = y * bytesPerRow;
        for (let x = 0; x < W; x++) {
          const si = rowStart + x * 4;
          if (isBGRA) {
            pixels[dst++] = src[si + 2];
            pixels[dst++] = src[si + 1];
            pixels[dst++] = src[si + 0];
            pixels[dst++] = src[si + 3];
          } else {
            pixels[dst++] = src[si + 0];
            pixels[dst++] = src[si + 1];
            pixels[dst++] = src[si + 2];
            pixels[dst++] = src[si + 3];
          }
        }
      }
      readBuffer.unmap();
      readBuffer.destroy();
      captureTexture.destroy();
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = W;
      tmpCanvas.height = H;
      const ctx2d = tmpCanvas.getContext("2d");
      if (!ctx2d)
        throw new Error("export2DTextureToPNGBlob: unable to get 2D context");
      const imageData = new ImageData(pixels, W, H);
      ctx2d.putImageData(imageData, 0, 0);
      const blob = await new Promise((resolve, reject) => {
        tmpCanvas.toBlob((b) => {
          if (b) resolve(b);
          else
            reject(new Error("export2DTextureToPNGBlob: toBlob returned null"));
        }, "image/png");
      });
      return blob;
    }
    // Convenience wrapper: export the currently active 2D pair view
    // (what getCurrentView() returns) to a PNG Blob.
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
      this.initBlitRender();
      if (this.queue && this.queue.onSubmittedWorkDone) {
        try {
          await this.queue.onSubmittedWorkDone();
        } catch (e) {
          console.warn(
            "export3DSliceToPNGBlob: onSubmittedWorkDone before export failed",
            e
          );
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
            clearValue: { r: 0, g: 0, b: 0, a: 1 }
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
        {
          buffer: readBuffer,
          bytesPerRow,
          rowsPerImage: H
        },
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
      const isBGRA = true;
      let dst = 0;
      for (let y = 0; y < H; y++) {
        const rowStart = y * bytesPerRow;
        for (let x = 0; x < W; x++) {
          const si = rowStart + x * 4;
          if (isBGRA) {
            pixels[dst++] = src[si + 2];
            pixels[dst++] = src[si + 1];
            pixels[dst++] = src[si + 0];
            pixels[dst++] = src[si + 3];
          } else {
            pixels[dst++] = src[si + 0];
            pixels[dst++] = src[si + 1];
            pixels[dst++] = src[si + 2];
            pixels[dst++] = src[si + 3];
          }
        }
      }
      readBuffer.unmap();
      readBuffer.destroy();
      captureTexture.destroy();
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = W;
      tmpCanvas.height = H;
      const ctx2d = tmpCanvas.getContext("2d");
      if (!ctx2d) {
        throw new Error("export3DSliceToPNGBlob: unable to get 2D context");
      }
      const imageData = new ImageData(pixels, W, H);
      ctx2d.putImageData(imageData, 0, 0);
      const blob = await new Promise((resolve, reject) => {
        tmpCanvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("export3DSliceToPNGBlob: toBlob returned null"));
        }, "image/png");
      });
      return blob;
    }
    // Render a single Z slice from a 3D texture view into an RGBA8 pixel buffer (RGBA order).
    // zNorm is in [0,1]. channel selects which packed channel to display.
    async _render3DSliceToRGBA8Pixels(view3D, width, height, zNorm, channel = 0) {
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
            clearValue: { r: 0, g: 0, b: 0, a: 1 }
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
      return pixels;
    }
    // Export a full 3D volume as a single PNG tileset.
    // Tiles are laid out row-major: z=0 is top-left, z increases left->right then top->bottom.
    // target can be a raw 3D view OR your { views: [...], meta: { tile: { d }}} bundle.
    // tileWidth/tileHeight are the per-slice render size in pixels (usually TOROIDAL_SIZE).
    // opts:
    //  - depth (required if target has no meta)
    //  - channel (default 0)
    //  - chunk (default 0, if target is bundle)
    //  - tilesAcross (default 16)
    //  - tilesDown (default ceil(depth/tilesAcross))
    //  - startSlice (default 0)
    //  - sliceCount (default depth-startSlice)
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
      this.initBlitRender();
      if (this.queue && this.queue.onSubmittedWorkDone) {
        try {
          await this.queue.onSubmittedWorkDone();
        } catch (e) {
          console.warn(
            "export3DTilesetToPNGBlob: onSubmittedWorkDone before export failed",
            e
          );
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
          channel
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
  var clouds_default = "const PI  : f32 = 3.141592653589793;\r\nconst EPS : f32 = 1e-6;\r\nconst LN2 : f32 = 0.6931471805599453;\r\nconst INV_LN2 : f32 = 1.4426950408889634;\r\n\r\n// ---------------------- TUNING UNIFORM\r\nstruct CloudTuning {\r\n  // Marching\r\n  maxSteps         : i32,\r\n  _pad0_i          : i32,\r\n  minStep          : f32,\r\n  maxStep          : f32,\r\n\r\n  // Sun marching\r\n  sunSteps         : i32,\r\n  sunStride        : i32,\r\n  sunMinTr         : f32,\r\n  _pad1_f          : f32,\r\n\r\n  // Dither\r\n  phaseJitter      : f32,\r\n  stepJitter       : f32,\r\n  _pad2            : vec2<f32>,\r\n\r\n  // Noise warp\r\n  baseJitterFrac   : f32,\r\n  topJitterFrac    : f32,\r\n  _pad3            : vec2<f32>,\r\n\r\n  // LOD and bounds\r\n  lodBiasWeather   : f32,\r\n  aabbFaceOffset   : f32,\r\n  _pad4            : vec2<f32>,\r\n\r\n  // Weather skipping\r\n  weatherRejectGate: f32,\r\n  weatherRejectMip : f32,\r\n  emptySkipMult    : f32,\r\n  _pad5            : f32,\r\n\r\n  // Near tweaks\r\n  nearFluffDist    : f32,\r\n  nearStepScale    : f32,\r\n  nearLodBias      : f32,\r\n  nearDensityMult  : f32,\r\n  nearDensityRange : f32,\r\n  _pad6            : vec3<f32>,\r\n\r\n  // LOD blending\r\n  lodBlendThreshold: f32,\r\n  _pad7            : vec3<f32>,\r\n\r\n  // Anti-speckle & temporal\r\n  sunDensityGate   : f32,\r\n  fflyRelClamp     : f32,\r\n  fflyAbsFloor     : f32,\r\n  taaRelMin        : f32,\r\n  taaRelMax        : f32,\r\n  taaAbsEps        : f32,\r\n  _pad8            : vec2<f32>,\r\n\r\n  // Far-field calm\r\n  farStart         : f32,\r\n  farFull          : f32,\r\n  farLodPush       : f32,\r\n  farDetailAtten   : f32,\r\n  farStepMult      : f32,\r\n  bnFarScale       : f32,\r\n  farTaaHistoryBoost: f32,\r\n  _pad9            : vec2<f32>,\r\n\r\n  // On-ray smoothing\r\n  raySmoothDens    : f32,\r\n  raySmoothSun     : f32,\r\n  _pad10           : vec2<f32>,\r\n}\r\n@group(0) @binding(10) var<uniform> TUNE : CloudTuning;\r\n\r\n// ---------------------- existing uniforms / resources (preserved layout)\r\nstruct CloudOptions {\r\n  useCustomPos : u32,\r\n  outputChannel: u32,\r\n  writeRGB     : u32,\r\n  _p0          : u32,\r\n  _r0          : f32,\r\n  _r1          : f32,\r\n  _r2          : f32,\r\n  _r3          : f32,\r\n}\r\n@group(0) @binding(0) var<uniform> opt : CloudOptions;\r\n\r\nstruct CloudParams {\r\n  globalCoverage: f32,\r\n  globalDensity : f32,\r\n  cloudAnvilAmount: f32,\r\n  cloudBeer      : f32,\r\n  attenuationClamp: f32,\r\n  inScatterG     : f32,\r\n  silverIntensity: f32,\r\n  silverExponent : f32,\r\n  outScatterG    : f32,\r\n  inVsOut        : f32,\r\n  outScatterAmbientAmt: f32,\r\n  ambientMinimum : f32,\r\n  sunColor       : vec3<f32>,\r\n\r\n  densityDivMin  : f32,\r\n  silverDirectionBias: f32,\r\n  silverHorizonBoost : f32,\r\n  _pad0          : f32,\r\n}\r\n@group(0) @binding(1) var<uniform> C : CloudParams;\r\n\r\nstruct Dummy { _pad: u32, }\r\n@group(0) @binding(2) var<storage, read> unused : Dummy;\r\n\r\nstruct NoiseTransforms {\r\n  shapeOffsetWorld  : vec3<f32>,\r\n  _pad0             : f32,\r\n  detailOffsetWorld : vec3<f32>,\r\n  _pad1             : f32,\r\n  shapeScale        : f32,\r\n  detailScale       : f32,\r\n  _pad2             : vec2<f32>,\r\n}\r\n@group(0) @binding(3) var<uniform> NTransform : NoiseTransforms;\r\n\r\n@group(0) @binding(4) var outTex : texture_storage_2d_array<rgba16float, write>;\r\n@group(0) @binding(5) var<storage, read> posBuf : array<vec4<f32>>;\r\n\r\nstruct Frame {\r\n  fullWidth : u32, fullHeight: u32,\r\n  tileWidth : u32, tileHeight: u32,\r\n  originX   : i32, originY   : i32, originZ: i32,\r\n  fullDepth : u32, tileDepth : u32,\r\n  layerIndex: i32, layers    : u32,\r\n  _pad0     : u32,\r\n  originXf  : f32, originYf : f32, _pad1: f32, _pad2: f32,\r\n}\r\n@group(0) @binding(6) var<uniform> frame : Frame;\r\n\r\n@group(0) @binding(7) var historyOut : texture_storage_2d_array<rgba16float, write>;\r\n\r\nstruct ReprojSettings {\r\n  enabled : u32,\r\n  subsample: u32,\r\n  sampleOffset: u32,\r\n  motionIsNormalized: u32,\r\n  temporalBlend: f32,\r\n  depthTest: u32,\r\n  depthTolerance: f32,\r\n  frameIndex: u32,\r\n  fullWidth: u32,\r\n  fullHeight: u32,\r\n}\r\n@group(0) @binding(8) var<uniform> reproj : ReprojSettings;\r\n\r\nstruct PerfParams {\r\n  lodBiasMul : f32,\r\n  coarseMipBias : f32,\r\n  _pad0: f32,\r\n  _pad1: f32,\r\n}\r\n@group(0) @binding(9) var<uniform> perf : PerfParams;\r\n\r\n@group(1) @binding(0) var weather2D : texture_2d_array<f32>;\r\n@group(1) @binding(1) var samp2D    : sampler;\r\n\r\n@group(1) @binding(2) var shape3D   : texture_3d<f32>;\r\n@group(1) @binding(3) var sampShape : sampler;\r\n\r\n@group(1) @binding(4) var blueTex   : texture_2d_array<f32>;\r\n@group(1) @binding(5) var sampBN    : sampler;\r\n\r\n@group(1) @binding(6) var detail3D  : texture_3d<f32>;\r\n@group(1) @binding(7) var sampDetail: sampler;\r\n\r\nstruct LightInputs { sunDir: vec3<f32>, _0: f32, camPos: vec3<f32>, _1: f32, }\r\n@group(1) @binding(8) var<uniform> L : LightInputs;\r\n\r\nstruct View {\r\n  camPos : vec3<f32>, _v0: f32,\r\n  right  : vec3<f32>, _v1: f32,\r\n  up     : vec3<f32>, _v2: f32,\r\n  fwd    : vec3<f32>, _v3: f32,\r\n  fovY   : f32, aspect: f32, stepBase: f32, stepInc: f32,\r\n  planetRadius: f32, cloudBottom: f32, cloudTop: f32, volumeLayers: f32,\r\n  worldToUV: f32, _a: f32, _b: f32, _c: f32,\r\n}\r\n@group(1) @binding(9) var<uniform> V : View;\r\n\r\nstruct Box {\r\n  center: vec3<f32>, _b0: f32,\r\n  half: vec3<f32>, uvScale: f32,\r\n}\r\n@group(1) @binding(10) var<uniform> B : Box;\r\n\r\n@group(1) @binding(11) var historyPrev : texture_2d_array<f32>;\r\n@group(1) @binding(12) var sampHistory : sampler;\r\n\r\n@group(1) @binding(13) var motionTex : texture_2d<f32>;\r\n@group(1) @binding(14) var sampMotion: sampler;\r\n\r\n@group(1) @binding(15) var depthPrev : texture_2d<f32>;\r\n@group(1) @binding(16) var sampDepth: sampler;\r\n\r\n// Workgroup cache\r\nvar<workgroup> wg_weatherDim : vec2<f32>;\r\nvar<workgroup> wg_blueDim    : vec2<f32>;\r\nvar<workgroup> wg_shapeDim   : vec3<f32>;\r\nvar<workgroup> wg_detailDim  : vec3<f32>;\r\nvar<workgroup> wg_maxMipW    : f32;\r\nvar<workgroup> wg_maxMipS    : f32;\r\nvar<workgroup> wg_maxMipD    : f32;\r\nvar<workgroup> wg_scaleS     : f32;\r\nvar<workgroup> wg_scaleD     : f32;\r\nvar<workgroup> wg_finestWorld: f32;\r\n\r\n// ---------------------- helpers\r\nfn saturate(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }\r\nfn mix_f(a: f32, b: f32, t: f32) -> f32 { return a * (1.0 - t) + b * t; }\r\nfn mix_v3(a: vec3<f32>, b: vec3<f32>, t: f32) -> vec3<f32> { return a * (1.0 - t) + b * t; }\r\nfn mix_v4(a: vec4<f32>, b: vec4<f32>, t: f32) -> vec4<f32> { return a * (1.0 - t) + b * t; }\r\nfn remap(v: f32, a: f32, b: f32, c: f32, d: f32) -> f32 { return c + (v - a) * (d - c) / max(b - a, EPS); }\r\nfn luminance(c: vec3<f32>) -> f32 { return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722)); }\r\n\r\nfn clamp_luma_to(val: vec3<f32>, refc: vec3<f32>, rel: f32, abs_eps: f32) -> vec3<f32> {\r\n  let tL = luminance(refc);\r\n  let vL = max(luminance(val), 1e-6);\r\n  let hi = tL * (1.0 + rel) + abs_eps;\r\n  let lo = max(tL * (1.0 - rel) - abs_eps, 0.0);\r\n  if (vL > hi) { return val * (hi / vL); }\r\n  if (vL < lo) { return val * (max(lo, 1e-6) / vL); }\r\n  return val;\r\n}\r\n\r\n// tiny hash\r\nfn hash13_i(p: vec3<i32>) -> f32 {\r\n  var h: u32 = 374761393u * u32(p.x) + 668265263u * u32(p.y) + 362437u * u32(p.z);\r\n  h = (h ^ (h >> 13u)) * 1274126177u;\r\n  h = h ^ (h >> 16u);\r\n  return f32(h) * 2.3283064365386963e-10;\r\n}\r\nfn smoothCellHash2D(p: vec2<f32>, freq: f32) -> f32 {\r\n  let uv = p * freq;\r\n  let i  = floor(uv);\r\n  let f  = fract(uv);\r\n  let h00 = hash13_i(vec3<i32>(i32(i.x),     i32(i.y),     0));\r\n  let h10 = hash13_i(vec3<i32>(i32(i.x) + 1, i32(i.y),     0));\r\n  let h01 = hash13_i(vec3<i32>(i32(i.x),     i32(i.y) + 1, 0));\r\n  let h11 = hash13_i(vec3<i32>(i32(i.x) + 1, i32(i.y) + 1, 0));\r\n  let u = f * f * (3.0 - 2.0 * f);\r\n  return mix_f(mix_f(h00, h10, u.x), mix_f(h01, h11, u.x), u.y);\r\n}\r\n\r\n// texture wrappers\r\nfn wrap2D(tex: texture_2d_array<f32>, samp: sampler, uv: vec2<f32>, layer_idx: i32, lod: f32) -> vec4<f32> {\r\n  let d = wg_weatherDim;\r\n  let ep = vec2<f32>(0.5 / max(d.x, 1.0), 0.5 / max(d.y, 1.0));\r\n  let u  = uv * (vec2<f32>(1.0) - 2.0 * ep) + ep;\r\n  return textureSampleLevel(tex, samp, u, layer_idx, lod);\r\n}\r\nfn wrap3D_shape(tex: texture_3d<f32>, samp: sampler, uvw: vec3<f32>, lod: f32) -> vec4<f32> {\r\n  let d = wg_shapeDim;\r\n  let ep = vec3<f32>(0.5 / max(d.x,1.0), 0.5 / max(d.y,1.0), 0.5 / max(d.z,1.0));\r\n  let u  = uvw * (vec3<f32>(1.0) - 2.0 * ep) + ep;\r\n  return textureSampleLevel(tex, samp, u, lod);\r\n}\r\nfn wrap3D_detail(tex: texture_3d<f32>, samp: sampler, uvw: vec3<f32>, lod: f32) -> vec4<f32> {\r\n  let d = wg_detailDim;\r\n  let ep = vec3<f32>(0.5 / max(d.x, 1.0), 0.5 / max(d.y, 1.0), 0.5 / max(d.z, 1.0));\r\n  let u  = uvw * (vec3<f32>(1.0) - 2.0 * ep) + ep;\r\n  return textureSampleLevel(tex, samp, u, lod);\r\n}\r\n\r\n// blue noise\r\nfn sampleBlueScreen(pixI: vec2<i32>) -> f32 {\r\n  let res = vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));\r\n  let bnD = wg_blueDim;\r\n  let uvSS = (vec2<f32>(pixI) + 0.5) / res;\r\n  let uvBN = fract(uvSS * res / bnD);\r\n  return textureSampleLevel(blueTex, sampBN, uvBN, 0i, 0.0).r;\r\n}\r\n\r\n// box helpers\r\nfn boxMin() -> vec3<f32> { return B.center - B.half; }\r\nfn boxMax() -> vec3<f32> { return B.center + B.half; }\r\n\r\n// robust AABB intersect\r\nfn intersectAABB_robust(ro: vec3<f32>, rd: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>) -> vec2<f32> {\r\n  let rdSafe = select(vec3<f32>(EPS), rd, vec3<bool>(abs(rd) > vec3<f32>(EPS)));\r\n  let inv = vec3<f32>(1.0) / rdSafe;\r\n  let t0 = (bmin - ro) * inv;\r\n  let t1 = (bmax - ro) * inv;\r\n  let tmin3 = min(t0, t1);\r\n  let tmax3 = max(t0, t1);\r\n  let tmin = max(max(tmin3.x, tmin3.y), tmin3.z);\r\n  let tmax = min(min(tmax3.x, tmax3.y), tmax3.z);\r\n  return vec2<f32>(tmin, tmax);\r\n}\r\n\r\n// world warp in XZ\r\nfn worldWarpXZ(pos_xz: vec2<f32>, ph: f32, boxMaxXZ: f32) -> vec2<f32> {\r\n  let norm = max(boxMaxXZ, 1.0);\r\n  let p = pos_xz / norm;\r\n\r\n  let warpAmp  = TUNE.baseJitterFrac * boxMaxXZ * 0.5;\r\n\r\n  let s1x = smoothCellHash2D(p + vec2<f32>(12.34, 78.9), 4.0);\r\n  let s1y = smoothCellHash2D(p + vec2<f32>(98.7,  6.54), 4.0);\r\n  let s2x = smoothCellHash2D(p * 1.73 + vec2<f32>(3.21, 4.56), 8.28);\r\n  let s2y = smoothCellHash2D(p * 1.91 + vec2<f32>(7.89, 1.23), 8.28);\r\n\r\n  let ox = (s1x - 0.5) + 0.5 * (s2x - 0.5);\r\n  let oz = (s1y - 0.5) + 0.5 * (s2y - 0.5);\r\n\r\n  let ang = smoothCellHash2D(p * 3.0 + vec2<f32>(9.7, 2.3), 16.0) * 2.0 * PI;\r\n  let rad = (smoothCellHash2D(p * 3.0 + vec2<f32>(1.1, 7.7), 16.0) - 0.5) * (TUNE.baseJitterFrac * 0.4 * boxMaxXZ);\r\n  let rot = vec2<f32>(cos(ang), sin(ang)) * rad;\r\n\r\n  let user = vec2<f32>(cos(opt._r3), sin(opt._r3)) * opt._r2 * 0.001;\r\n\r\n  return vec2<f32>(ox, oz) * warpAmp + rot * mix_f(0.3, 1.2, ph) + user;\r\n}\r\n\r\n// shape & detail samplers\r\nfn sampleShapeRGBA(pos: vec3<f32>, ph: f32, lod: f32) -> vec4<f32> {\r\n  let scaleS = max(wg_scaleS, EPS);\r\n  let boxMaxXZ = max(B.half.x, B.half.z);\r\n\r\n  let w = worldWarpXZ(pos.xz, ph, boxMaxXZ);\r\n\r\n  let pW = vec3<f32>(\r\n    pos.x + w.x + NTransform.shapeOffsetWorld.x,\r\n    pos.y + ph * 7.0 + NTransform.shapeOffsetWorld.y,\r\n    pos.z + w.y + NTransform.shapeOffsetWorld.z\r\n  );\r\n\r\n  return wrap3D_shape(shape3D, sampShape, pW * scaleS * NTransform.shapeScale, lod);\r\n}\r\n\r\nfn sampleDetailRGB(pos: vec3<f32>, ph: f32, lod: f32) -> vec3<f32> {\r\n  let scaleD = max(wg_scaleD, EPS);\r\n  let boxMaxXZ = max(B.half.x, B.half.z);\r\n\r\n  let w = worldWarpXZ(pos.xz, ph, boxMaxXZ);\r\n\r\n  let pW = vec3<f32>(\r\n    pos.x + w.x + NTransform.detailOffsetWorld.x,\r\n    pos.y + NTransform.detailOffsetWorld.y,\r\n    pos.z + w.y + NTransform.detailOffsetWorld.z\r\n  );\r\n\r\n  return wrap3D_detail(detail3D, sampDetail, pW * scaleD * NTransform.detailScale, lod).rgb;\r\n}\r\n\r\n// height shape and density\r\nfn heightShape(ph: f32, wBlue: f32) -> f32 {\r\n  let sr_bottom = saturate(remap(ph, 0.0, 0.07, 0.0, 1.0));\r\n  let stop_h = saturate(wBlue + 0.12);\r\n  let sr_top  = saturate(remap(ph, stop_h * 0.2, stop_h, 1.0, 0.0));\r\n  var base = sr_bottom * sr_top;\r\n  let anvilFactor = saturate(C.cloudAnvilAmount) * saturate(C.globalCoverage);\r\n  let expo = saturate(remap(ph, 0.65, 0.95, 1.0, 1.0 - anvilFactor * 0.9));\r\n  return pow(base, expo);\r\n}\r\nfn computePH(p_world: vec3<f32>, wm: vec4<f32>) -> f32 {\r\n  let boxH = max(B.half.y * 2.0, EPS);\r\n  let jBase = (wm.r * 2.0 - 1.0) * (TUNE.baseJitterFrac * boxH);\r\n  let jTop  = (wm.g * 2.0 - 1.0) * (TUNE.topJitterFrac  * boxH);\r\n  let baseY = (B.center.y - B.half.y) + jBase;\r\n  let topY  = (B.center.y + B.half.y) + jTop;\r\n  return saturate((p_world.y - baseY) / max(topY - baseY, EPS));\r\n}\r\nfn detailMod(ph: f32, d: vec3<f32>) -> f32 {\r\n  let fbm = d.r * 0.625 + d.g * 0.25 + d.b * 0.125;\r\n  return 0.35 * exp(-C.globalCoverage * 0.75) * mix_f(fbm, 1.0 - fbm, saturate(ph * 5.0));\r\n}\r\nfn densityHeight(ph: f32) -> f32 {\r\n  var ret = ph;\r\n  ret *= saturate(remap(ph, 0.0, 0.2, 0.0, 1.0));\r\n  ret *= mix_f(1.0, saturate(remap(sqrt(max(ph,0.0)), 0.4, 0.95, 1.0, 0.2)), saturate(C.cloudAnvilAmount));\r\n  ret *= saturate(remap(ph, 0.9, 1.0, 1.0, 0.0));\r\n  ret *= max(C.globalDensity, 0.0);\r\n  return ret;\r\n}\r\nfn weatherCoverageGate(wm: vec4<f32>) -> f32 {\r\n  let wHi = saturate(remap(C.globalCoverage, 0.0, 1.0, 0.0, 1.0) - 0.5) * wm.g * 2.0;\r\n  let WMc = max(wm.r, wHi);\r\n  return 1.0 - C.globalCoverage * saturate(WMc - opt._r1);\r\n}\r\nfn densityFromSamples(ph: f32, wm: vec4<f32>, s: vec4<f32>, det: vec3<f32>) -> f32 {\r\n  let fbm_s = s.g * 0.625 + s.b * 0.25 + s.a * 0.125 - 1.0;\r\n  let SNsample = remap(s.r, fbm_s, 1.0, 0.0, 1.0);\r\n\r\n  var SA = saturate(heightShape(ph, 1.0));\r\n  let wVar = fract(wm.r * 1.7 + wm.g * 2.3);\r\n  let bulge = 1.0 + 0.18 * (abs(fract(ph * (1.0 + wVar * 1.7)) - 0.5) * 2.0 - 0.5) * 0.5;\r\n  SA = saturate(SA * bulge);\r\n\r\n  let gate = weatherCoverageGate(wm);\r\n  let SNnd = saturate(remap(SNsample * SA, gate, 1.0, 0.0, 1.0));\r\n  let DN = detailMod(ph, det);\r\n  let core = saturate(remap(SNnd, DN, 1.0, 0.0, 1.0));\r\n  return max(core * densityHeight(ph), 0.0);\r\n}\r\n\r\n// scattering and lighting\r\nfn HG(cos_angle: f32, g: f32) -> f32 {\r\n  let gg = clamp(g, -0.999, 0.999);\r\n  let g2 = gg * gg;\r\n  let ca = clamp(cos_angle, -1.0, 1.0);\r\n  let denom = pow(max(1.0 + g2 - 2.0 * gg * ca, 1e-6), 1.5);\r\n  return (1.0 - g2) / denom;\r\n}\r\n\r\nfn InOutScatter(cos_angle: f32) -> f32 {\r\n  let ca = clamp(cos_angle, -1.0, 1.0);\r\n\r\n  let in_hg  = HG(ca,  C.inScatterG);\r\n  let out_hg = HG(ca, -C.outScatterG);\r\n\r\n  let absCa = saturate(abs(ca));\r\n  let silverBase = pow(absCa, max(C.silverExponent, 0.0));\r\n\r\n  let horizon = pow(saturate(1.0 - absCa), 2.0);\r\n  let silverH = mix_f(silverBase, max(silverBase, horizon), saturate(C.silverHorizonBoost));\r\n\r\n  let dir01 = saturate(ca * 0.5 + 0.5);\r\n  let bias01 = saturate(C.silverDirectionBias * 0.5 + 0.5);\r\n  let dirPref = mix_f(1.0 - dir01, dir01, bias01) * 2.0;\r\n\r\n  let silver = C.silverIntensity * silverH * dirPref;\r\n\r\n  let in_scatter  = in_hg + silver;\r\n  let out_scatter = out_hg;\r\n\r\n  return mix_f(in_scatter, out_scatter, saturate(C.inVsOut));\r\n}\r\n\r\nfn Attenuation(Tsun: f32, cos_angle: f32) -> f32 {\r\n  let beer = max(C.cloudBeer, EPS);\r\n  let Tprim = clamp(Tsun, 0.0, 1.0);\r\n\r\n  let ca01 = saturate(cos_angle * 0.5 + 0.5);\r\n  let clampScale = mix_f(1.15, 0.70, ca01);\r\n  let clampOD = max(C.attenuationClamp, 0.0) * clampScale;\r\n\r\n  let Tfloor = exp2(- (beer * clampOD) * INV_LN2);\r\n  return max(Tprim, Tfloor);\r\n}\r\n\r\nfn OutScatterAmbient(density: f32, percent_height: f32) -> f32 {\r\n  let d = max(density, 0.0);\r\n  let ph = saturate(percent_height);\r\n\r\n  let h = mix_f(0.35, 1.0, ph);\r\n  let vertical = pow(saturate(remap(ph, 0.0, 0.3, 0.8, 1.0)), 0.8);\r\n\r\n  let depth = C.outScatterAmbientAmt * d * h;\r\n  return exp2(- (depth * vertical) * INV_LN2);\r\n}\r\n\r\nfn surfaceShadowFactor(n: vec3<f32>, sunDir: vec3<f32>, minLit: f32, exponent: f32) -> f32 {\r\n  let s = saturate(dot(n, sunDir) * 0.5 + 0.5);\r\n  return mix_f(minLit, 1.0, pow(s, exponent));\r\n}\r\n\r\nfn CalculateLight(\r\n  density: f32,\r\n  Tsun: f32,\r\n  cos_angle: f32,\r\n  percent_height: f32,\r\n  bluenoise: f32,\r\n  dist_along_ray: f32,\r\n  rimBoost: f32\r\n) -> vec3<f32> {\r\n  let scatter = InOutScatter(cos_angle);\r\n  let attenT  = Attenuation(Tsun, cos_angle);\r\n  let ambT    = OutScatterAmbient(density, percent_height);\r\n\r\n  var atten = attenT * scatter * ambT;\r\n\r\n  let amb = density * C.ambientMinimum * (1.0 - pow(saturate(dist_along_ray / 4000.0), 2.0));\r\n  atten = atten + amb * (1.0 - saturate(atten));\r\n\r\n  atten = atten + bluenoise * 0.0025;\r\n  atten = atten * (1.0 + 0.35 * rimBoost);\r\n\r\n  return atten * C.sunColor;\r\n}\r\n\r\n// ---------- helper: approximate surface normal from coarse shape mip\r\nfn approxShapeNormal(pos: vec3<f32>, ph: f32, lodShape: f32) -> vec3<f32> {\r\n  let probe = max(wg_finestWorld * 1.25, 1e-3);\r\n\r\n  let c  = sampleShapeRGBA(pos, ph, lodShape).r;\r\n  let px = sampleShapeRGBA(pos + vec3<f32>(probe, 0.0, 0.0), ph, lodShape).r;\r\n  let nx = sampleShapeRGBA(pos - vec3<f32>(probe, 0.0, 0.0), ph, lodShape).r;\r\n  let pz = sampleShapeRGBA(pos + vec3<f32>(0.0, 0.0, probe), ph, lodShape).r;\r\n  let nz = sampleShapeRGBA(pos - vec3<f32>(0.0, 0.0, probe), ph, lodShape).r;\r\n  let py = sampleShapeRGBA(pos + vec3<f32>(0.0, probe, 0.0), ph, lodShape).r;\r\n\r\n  let gy = (py - c) / probe;\r\n  let gx = (px - nx) * 0.5 / probe;\r\n  let gz = (pz - nz) * 0.5 / probe;\r\n\r\n  var n = normalize(vec3<f32>(-gx, -gy, -gz));\r\n  if (length(n) < 1e-4) { return vec3<f32>(0.0, 1.0, 0.0); }\r\n  return n;\r\n}\r\n\r\n// weather UV (precomputed parameters)\r\nfn weatherUV_from(pos_world: vec3<f32>, bmin_xz: vec2<f32>, invAabb_xz: vec2<f32>, mul: f32) -> vec2<f32> {\r\n  return (pos_world.xz - bmin_xz) * invAabb_xz * mul;\r\n}\r\n\r\n// sun march\r\nfn sunSingle(\r\n  p0: vec3<f32>,\r\n  sunDir: vec3<f32>,\r\n  weatherLOD: f32,\r\n  lodShapeBase: f32,\r\n  lodDetailBase: f32,\r\n  stepLen: f32,\r\n  bmin_xz: vec2<f32>,\r\n  invAabb_xz: vec2<f32>,\r\n  mulW: f32\r\n) -> f32 {\r\n  var T = 1.0;\r\n  let parity = f32(i32(reproj.frameIndex % 2u));\r\n  var p = p0 + sunDir * (0.5 * stepLen * parity);\r\n\r\n  for (var i: i32 = 0; i < TUNE.sunSteps; i = i + 1) {\r\n    let uv = weatherUV_from(p, bmin_xz, invAabb_xz, mulW);\r\n    let wm = wrap2D(weather2D, samp2D, uv, 0i, weatherLOD);\r\n\r\n    let ph  = computePH(p, wm);\r\n    let s   = sampleShapeRGBA(p, ph, lodShapeBase  + f32(i) * 0.5);\r\n    let det = sampleDetailRGB(p, ph, lodDetailBase + f32(i) * 0.5);\r\n    let d   = densityFromSamples(ph, wm, s, det);\r\n\r\n    T *= exp2(- (C.cloudBeer * d * stepLen) * INV_LN2);\r\n    if (T < TUNE.sunMinTr) { break; }\r\n    p += sunDir * stepLen;\r\n  }\r\n\r\n  return T;\r\n}\r\n\r\nfn sunTransmittance(\r\n  p: vec3<f32>,\r\n  sunDir: vec3<f32>,\r\n  weatherLOD: f32,\r\n  lodShapeBase: f32,\r\n  lodDetailBase: f32,\r\n  stepLen: f32,\r\n  bmin_xz: vec2<f32>,\r\n  invAabb_xz: vec2<f32>,\r\n  mulW: f32\r\n) -> f32 {\r\n  return 0.5 * (\r\n    sunSingle(p, sunDir, weatherLOD, lodShapeBase, lodDetailBase, stepLen, bmin_xz, invAabb_xz, mulW) +\r\n    sunSingle(p, sunDir, weatherLOD, lodShapeBase, lodDetailBase, stepLen, bmin_xz, invAabb_xz, mulW)\r\n  );\r\n}\r\n\r\n// quick empty probe\r\nfn weatherProbeEmpty(\r\n  p_start: vec3<f32>,\r\n  rd: vec3<f32>,\r\n  stepLen: f32,\r\n  nProbes: i32,\r\n  coarseMip: f32,\r\n  bmin_xz: vec2<f32>,\r\n  invAabb_xz: vec2<f32>,\r\n  mulW: f32\r\n) -> bool {\r\n  var pos = p_start;\r\n  var emptyCount: i32 = 0;\r\n\r\n  for (var i: i32 = 0; i < nProbes; i = i + 1) {\r\n    let uv = weatherUV_from(pos, bmin_xz, invAabb_xz, mulW);\r\n    let wm = wrap2D(weather2D, samp2D, uv, 0i, coarseMip);\r\n    if (weatherCoverageGate(wm) >= TUNE.weatherRejectGate) { emptyCount = emptyCount + 1; }\r\n    pos = pos + rd * stepLen;\r\n  }\r\n\r\n  return (f32(emptyCount) / f32(nProbes)) > 0.66;\r\n}\r\n\r\n// reprojection helpers\r\nfn fullPixFromCurrent(pix: vec2<i32>) -> vec2<i32> {\r\n  let res = vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));\r\n  let fullRes = vec2<f32>(f32(reproj.fullWidth), f32(reproj.fullHeight));\r\n  let xf = floor((vec2<f32>(pix) + 0.5) * (fullRes / res));\r\n  return vec2<i32>(\r\n    i32(clamp(xf.x, 0.0, fullRes.x - 1.0)),\r\n    i32(clamp(xf.y, 0.0, fullRes.y - 1.0))\r\n  );\r\n}\r\nfn store_history_full_res_if_owner(pixCurr: vec2<i32>, layer: i32, color: vec4<f32>) {\r\n  if (reproj.enabled == 0u) {\r\n    textureStore(historyOut, fullPixFromCurrent(pixCurr), layer, color);\r\n    return;\r\n  }\r\n\r\n  let ss = i32(max(reproj.subsample, 1u));\r\n  let off = i32(reproj.sampleOffset % u32(ss * ss));\r\n  let sx = off % ss;\r\n  let sy = off / ss;\r\n\r\n  let fullPix = fullPixFromCurrent(pixCurr);\r\n  if ((fullPix.x % ss) == sx && (fullPix.y % ss) == sy) {\r\n    textureStore(historyOut, fullPix, layer, color);\r\n  }\r\n}\r\n\r\n// fade near AABB faces\r\nfn insideFaceFade(p: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>) -> f32 {\r\n  let dmin = p - bmin;\r\n  let dmax = bmax - p;\r\n  let edge = min(dmin, dmax);\r\n  let closest = min(min(edge.x, edge.y), edge.z);\r\n  let soft = max(0.75 * wg_finestWorld, 0.25);\r\n  return saturate(closest / soft);\r\n}\r\n\r\n// ---------------------- Main compute\r\n@compute @workgroup_size(8,8,1)\r\nfn computeCloud(\r\n  @builtin(global_invocation_id) gid_in: vec3<u32>,\r\n  @builtin(local_invocation_id) local_id: vec3<u32>\r\n) {\r\n  // workgroup cache\r\n  if (local_id.x == 0u && local_id.y == 0u) {\r\n    let wd = textureDimensions(weather2D, 0);\r\n    wg_weatherDim = vec2<f32>(f32(wd.x), f32(wd.y));\r\n\r\n    let bd = textureDimensions(blueTex, 0);\r\n    wg_blueDim = vec2<f32>(f32(bd.x), f32(bd.y));\r\n\r\n    let sd = textureDimensions(shape3D);\r\n    wg_shapeDim = vec3<f32>(f32(sd.x), f32(sd.y), f32(sd.z));\r\n\r\n    let dd = textureDimensions(detail3D);\r\n    wg_detailDim = vec3<f32>(f32(dd.x), f32(dd.y), f32(dd.z));\r\n\r\n    wg_maxMipW = f32(textureNumLevels(weather2D)) - 1.0;\r\n    wg_maxMipS = f32(textureNumLevels(shape3D)) - 1.0;\r\n    wg_maxMipD = f32(textureNumLevels(detail3D)) - 1.0;\r\n\r\n    let scaleS_local = max(V.worldToUV * B.uvScale, EPS);\r\n    wg_scaleS = scaleS_local;\r\n    wg_scaleD = max(scaleS_local * (128.0 / 32.0), EPS);\r\n    wg_finestWorld = min(1.0 / wg_scaleS, 1.0 / wg_scaleD) * 0.6;\r\n  }\r\n  workgroupBarrier();\r\n\r\n  // pixel and guard\r\n  let pixI = vec2<i32>(i32(gid_in.x), i32(gid_in.y)) + vec2<i32>(frame.originX, frame.originY);\r\n  if (pixI.x < 0 || pixI.y < 0 || pixI.x >= i32(frame.fullWidth) || pixI.y >= i32(frame.fullHeight)) {\r\n    return;\r\n  }\r\n\r\n  let fullResF = vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));\r\n  let uvPix = (vec2<f32>(pixI) + 0.5) / fullResF;\r\n\r\n  // camera basis\r\n  let camFwd = normalize(V.fwd);\r\n\r\n  var basisRight = normalize(V.right);\r\n  if (length(basisRight) < EPS) { basisRight = vec3<f32>(1.0, 0.0, 0.0); }\r\n\r\n  var basisUp = normalize(V.up);\r\n  if (length(basisUp) < EPS) { basisUp = vec3<f32>(0.0, 1.0, 0.0); }\r\n\r\n  // ray\r\n  var rayRo = V.camPos;\r\n  if (opt.useCustomPos == 1u) {\r\n    let idx = u32(pixI.x) + u32(pixI.y) * frame.fullWidth;\r\n    rayRo = posBuf[idx].xyz;\r\n  }\r\n\r\n  let ndc = uvPix * 2.0 - vec2<f32>(1.0, 1.0);\r\n  let tanY = tan(0.5 * V.fovY);\r\n\r\n  let rd_camera = normalize(vec3<f32>(ndc.x * V.aspect * tanY, -ndc.y * tanY, -1.0));\r\n  let rayRd = normalize(basisRight * rd_camera.x + basisUp * rd_camera.y - camFwd * rd_camera.z);\r\n\r\n  // intersect volume\r\n  let bmin = boxMin();\r\n  let bmax = boxMax();\r\n  let ti = intersectAABB_robust(rayRo, rayRd, bmin, bmax);\r\n\r\n  if (ti.x > ti.y || ti.y <= 0.0) {\r\n    textureStore(outTex, pixI, frame.layerIndex, vec4<f32>(0.0));\r\n    if (reproj.enabled == 1u) { store_history_full_res_if_owner(pixI, frame.layerIndex, vec4<f32>(0.0)); }\r\n    return;\r\n  }\r\n\r\n  var t0 = max(ti.x - TUNE.aabbFaceOffset, 0.0);\r\n  var t1 = ti.y + TUNE.aabbFaceOffset;\r\n  if (t0 >= t1) {\r\n    textureStore(outTex, pixI, frame.layerIndex, vec4<f32>(0.0));\r\n    if (reproj.enabled == 1u) { store_history_full_res_if_owner(pixI, frame.layerIndex, vec4<f32>(0.0)); }\r\n    return;\r\n  }\r\n\r\n  // precompute weather mapping and LOD\r\n  let aabb = max(bmax - bmin, vec3<f32>(EPS, EPS, EPS));\r\n  let bmin_xz = bmin.xz;\r\n  let invAabb_xz = vec2<f32>(1.0, 1.0) / max(aabb.xz, vec2<f32>(EPS));\r\n\r\n  let mulW = select(opt._r0, 0.2, opt._r0 == 0.0);\r\n\r\n  let worldToTex = mulW * vec2<f32>(\r\n    wg_weatherDim.x / max(aabb.x, EPS),\r\n    wg_weatherDim.y / max(aabb.z, EPS)\r\n  );\r\n  let fp = max(worldToTex.x, worldToTex.y);\r\n  let weatherLOD_base = clamp(\r\n    log2(max(fp, 1.0)) + TUNE.lodBiasWeather * max(perf.lodBiasMul, 0.0001),\r\n    0.0,\r\n    wg_maxMipW\r\n  );\r\n\r\n  // noise and jitter\r\n  let bnPix  = sampleBlueScreen(pixI);\r\n  let rand0  = fract(bnPix + 0.61803398875 * f32(reproj.frameIndex));\r\n\r\n  // step sizing\r\n  let viewDir = normalize(-rayRd);\r\n  let cosVF   = max(dot(rayRd, camFwd), EPS);\r\n\r\n  let voxelBound = wg_finestWorld / max(abs(dot(rayRd, basisUp)), 0.15);\r\n\r\n  var baseStep = clamp(V.stepBase, TUNE.minStep, TUNE.maxStep);\r\n  baseStep = min(baseStep, voxelBound);\r\n  baseStep = baseStep * mix_f(1.0, 1.0 + TUNE.stepJitter, rand0 * 2.0 - 1.0);\r\n\r\n  let entryDepth = dot((rayRo + rayRd * t0) - V.camPos, camFwd);\r\n  let nearFactor = saturate(1.0 - entryDepth / TUNE.nearFluffDist);\r\n  baseStep = clamp(baseStep * mix_f(1.0, TUNE.nearStepScale, nearFactor), TUNE.minStep, TUNE.maxStep);\r\n\r\n  let farF = saturate(remap(entryDepth, TUNE.farStart, TUNE.farFull, 0.0, 1.0));\r\n  baseStep = clamp(baseStep * mix_f(1.0, TUNE.farStepMult, farF), TUNE.minStep, TUNE.maxStep);\r\n\r\n  var t = clamp(t0 + (rand0 * TUNE.phaseJitter) * baseStep, t0, t1);\r\n\r\n  // lighting setup\r\n  let sunDir = normalize(L.sunDir);\r\n  let cosVS  = dot(viewDir, sunDir);\r\n\r\n  // sun step length\r\n  let halfSpan = 0.5 * max(B.half.y * 2.0, EPS);\r\n  let sunStepLen = min(\r\n    halfSpan / f32(max(TUNE.sunSteps, 1)),\r\n    min(1.0 / wg_scaleS, 1.0 / wg_scaleD) * 0.6 / max(abs(sunDir.y), 0.15)\r\n  );\r\n\r\n  let weatherLOD = min(wg_maxMipW, weatherLOD_base + TUNE.farLodPush * farF);\r\n\r\n  // accumulators\r\n  var Tr  = 1.0;\r\n  var rgb = vec3<f32>(0.0);\r\n\r\n  var Tsun_cached = 1.0;\r\n  var prevDens : f32 = 0.0;\r\n  var prevTsun : f32 = 1.0;\r\n\r\n  var shapeN_cached = vec3<f32>(0.0, 1.0, 0.0);\r\n  var rim_cached : f32 = 0.0;\r\n\r\n  var runMeanL : f32 = 0.0;\r\n  var runN     : f32 = 0.0;\r\n\r\n  var iter: i32 = 0;\r\n\r\n  loop {\r\n    if (iter >= TUNE.maxSteps) { break; }\r\n    if (t >= t1 || Tr < 0.001) { break; }\r\n\r\n    let p = rayRo + rayRd * t;\r\n\r\n    // coarse weather skip\r\n    let subsample = f32(max(reproj.subsample, 1u));\r\n    let coarsePenalty = log2(max(subsample, 1.0));\r\n    var coarseMip = max(0.0, wg_maxMipW - (TUNE.weatherRejectMip + max(perf.coarseMipBias, 0.0) + coarsePenalty));\r\n    coarseMip = min(wg_maxMipW, coarseMip + farF * 1.0);\r\n\r\n    if (weatherProbeEmpty(p, rayRd, baseStep * 2.0, 3, coarseMip, bmin_xz, invAabb_xz, mulW)) {\r\n      t = min(t + baseStep * TUNE.emptySkipMult, t1);\r\n      iter += 1;\r\n      continue;\r\n    }\r\n\r\n    // quick weather density proxy\r\n    let uv_coarse = weatherUV_from(p, bmin_xz, invAabb_xz, mulW);\r\n    let wm_coarse = wrap2D(weather2D, samp2D, uv_coarse, 0i, min(weatherLOD, max(0.0, wg_maxMipW)));\r\n    let ph_coarse = computePH(p, wm_coarse);\r\n    let quickCoverage = saturate((wm_coarse.r - 0.35) * 2.5);\r\n    if (quickCoverage < 0.01 && (ph_coarse < 0.02)) {\r\n      t = min(t + baseStep * 2.0, t1);\r\n      iter += 1;\r\n      continue;\r\n    }\r\n\r\n    // LOD from step\r\n    let baseLOD  = clamp(log2(max(baseStep / wg_finestWorld, 1.0)), 0.0, wg_maxMipS);\r\n    let nearDepth = max(cosVF * (t - t0), 0.0);\r\n    let nearSmooth = pow(saturate(1.0 - nearDepth / TUNE.nearFluffDist), 0.85);\r\n\r\n    let lodBias  = mix_f(0.0, TUNE.nearLodBias, nearSmooth);\r\n    let lodShapeBase  = clamp(baseLOD + lodBias + TUNE.farLodPush * farF, 0.0, wg_maxMipS);\r\n    let lodDetailBase = clamp(baseLOD + lodBias + TUNE.farLodPush * farF, 0.0, wg_maxMipD);\r\n\r\n    // weather full\r\n    let uv = weatherUV_from(p, bmin_xz, invAabb_xz, mulW);\r\n    let wm = wrap2D(weather2D, samp2D, uv, 0i, weatherLOD);\r\n    let ph = computePH(p, wm);\r\n\r\n    // mip hysteresis\r\n    let sL : f32 = floor(lodShapeBase);\r\n    let sF : f32 = saturate(lodShapeBase - sL);\r\n    let dL : f32 = floor(lodDetailBase);\r\n    let dF : f32 = saturate(lodDetailBase - dL);\r\n\r\n    var s : vec4<f32>;\r\n    if (sF > TUNE.lodBlendThreshold) {\r\n      let s_lo = sampleShapeRGBA(p, ph, sL);\r\n      let s_hi = sampleShapeRGBA(p, ph, min(sL + 1.0, wg_maxMipS));\r\n      s = mix_v4(s_lo, s_hi, sF);\r\n    } else {\r\n      s = sampleShapeRGBA(p, ph, sL);\r\n    }\r\n\r\n    var det : vec3<f32>;\r\n    if (dF > TUNE.lodBlendThreshold) {\r\n      let d_lo = sampleDetailRGB(p, ph, dL);\r\n      let d_hi = sampleDetailRGB(p, ph, min(dL + 1.0, wg_maxMipD));\r\n      det = mix_v3(d_lo, d_hi, dF);\r\n    } else {\r\n      det = sampleDetailRGB(p, ph, dL);\r\n    }\r\n    det = mix_v3(det, det * TUNE.farDetailAtten, farF);\r\n\r\n    // density\r\n    var dens = densityFromSamples(ph, wm, s, det);\r\n    dens *= insideFaceFade(p, bmin, bmax);\r\n    dens *= mix_f(TUNE.nearDensityMult, 1.0, saturate(nearDepth / TUNE.nearDensityRange));\r\n\r\n    let densSmoothed = mix_f(dens, prevDens, saturate(TUNE.raySmoothDens));\r\n\r\n    if (densSmoothed > 0.00008) {\r\n      if ((iter % TUNE.sunStride) == 0) {\r\n        if (densSmoothed * baseStep > TUNE.sunDensityGate) {\r\n          Tsun_cached = sunTransmittance(\r\n            p, sunDir, weatherLOD, lodShapeBase, lodDetailBase, sunStepLen,\r\n            bmin_xz, invAabb_xz, mulW\r\n          );\r\n        } else {\r\n          Tsun_cached = 1.0;\r\n        }\r\n\r\n        shapeN_cached = approxShapeNormal(p, ph, max(0.0, lodShapeBase));\r\n        rim_cached = pow(1.0 - saturate(dot(shapeN_cached, viewDir)), 2.0);\r\n      }\r\n\r\n      let TsunSmoothed = mix_f(Tsun_cached, prevTsun, saturate(TUNE.raySmoothSun));\r\n      let bnScaled = mix_f(bnPix, bnPix * TUNE.bnFarScale, farF);\r\n\r\n      let lightBase = CalculateLight(densSmoothed, TsunSmoothed, cosVS, ph, bnScaled, t - t0, rim_cached);\r\n\r\n      let surfShade = surfaceShadowFactor(shapeN_cached, sunDir, 0.25, 1.15);\r\n      let occlusion = mix_f(0.6, 1.0, saturate(TsunSmoothed));\r\n\r\n      var lightCol = lightBase * surfShade * occlusion;\r\n\r\n      let lNow = luminance(lightCol);\r\n      let meanL = select(lNow, runMeanL / max(runN, 1.0), runN > 0.0);\r\n      let allow = max(meanL * (1.0 + TUNE.fflyRelClamp), TUNE.fflyAbsFloor);\r\n      if (lNow > allow) { lightCol *= allow / max(lNow, 1e-6); }\r\n\r\n      let beer = max(C.cloudBeer, EPS);\r\n      let absorb = exp2(- (beer * densSmoothed * baseStep) * INV_LN2);\r\n      let alpha = 1.0 - absorb;\r\n\r\n      rgb += Tr * lightCol * alpha;\r\n      Tr  *= absorb;\r\n\r\n      runMeanL += lNow;\r\n      runN     += 1.0;\r\n\r\n      if (Tr < 0.002) { break; }\r\n    }\r\n\r\n    prevDens = densSmoothed;\r\n    prevTsun = Tsun_cached;\r\n\r\n    t = min(t + baseStep, t1);\r\n    iter += 1;\r\n  }\r\n\r\n  // compose\r\n  var newCol: vec4<f32>;\r\n  if (opt.writeRGB == 1u) {\r\n    newCol = vec4<f32>(rgb, 1.0 - Tr);\r\n  } else {\r\n    let a = 1.0 - Tr;\r\n    if (opt.outputChannel == 0u)      { newCol = vec4<f32>(a, 0.0, 0.0, 1.0); }\r\n    else if (opt.outputChannel == 1u) { newCol = vec4<f32>(0.0, a, 0.0, 1.0); }\r\n    else if (opt.outputChannel == 2u) { newCol = vec4<f32>(0.0, 0.0, a, 1.0); }\r\n    else                              { newCol = vec4<f32>(0.0, 0.0, 0.0, a); }\r\n  }\r\n\r\n  // soft fluff + ambient tint\r\n  {\r\n    let a = newCol.a;\r\n    let fluff = clamp(0.28 * a * mix_f(1.0, 1.4, saturate(1.0 - cosVS)), 0.02, 0.50);\r\n    let sunTint = mix_v3(vec3<f32>(0.92, 0.93, 0.96), C.sunColor, saturate(0.5 + 0.5 * cosVS));\r\n    let ambientFill = sunTint * 0.06;\r\n    newCol = vec4<f32>(mix_v3(newCol.rgb, newCol.rgb + ambientFill * a, fluff), smoothstep(0.0, 1.0, a * 1.03));\r\n  }\r\n\r\n  // TAA with variance clamp\r\n  if (reproj.enabled == 1u) {\r\n    let fullRes = vec2<f32>(f32(reproj.fullWidth), f32(reproj.fullHeight));\r\n    let uv_full = (vec2<f32>(fullPixFromCurrent(pixI)) + 0.5) / fullRes;\r\n\r\n    var motion = textureSampleLevel(motionTex, sampMotion, uv_full, 0.0).rg;\r\n    if (reproj.motionIsNormalized == 0u) { motion = motion / fullRes; }\r\n    let prevUV = uv_full - motion;\r\n\r\n    if (prevUV.x < 0.0 || prevUV.y < 0.0 || prevUV.x > 1.0 || prevUV.y > 1.0) {\r\n      textureStore(outTex, pixI, frame.layerIndex, newCol);\r\n      store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);\r\n    } else {\r\n      let prevCol = textureSampleLevel(historyPrev, sampHistory, prevUV, frame.layerIndex, 0.0);\r\n      if (reproj.frameIndex == 0u || prevCol.a < 1e-5 || reproj.temporalBlend <= 0.0001) {\r\n        textureStore(outTex, pixI, frame.layerIndex, newCol);\r\n        store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);\r\n      } else {\r\n        let motionPix = motion * fullRes;\r\n        let motionMag = length(motionPix);\r\n        let alphaDiff = abs(prevCol.a - newCol.a);\r\n\r\n        var stability = exp(-motionMag * 0.9) * exp(-alphaDiff * 6.0);\r\n        var tb = clamp(reproj.temporalBlend * stability, 0.0, 0.985);\r\n        tb *= mix_f(1.0, TUNE.farTaaHistoryBoost, farF);\r\n\r\n        if (reproj.depthTest == 1u) {\r\n          let prevDepth = textureSampleLevel(depthPrev, sampDepth, prevUV, 0.0).r;\r\n          tb *= select(1.0 - saturate(reproj.depthTolerance), 0.25, prevDepth < 1e-6 || prevDepth > 1.0);\r\n        }\r\n\r\n        let relBase = mix_f(TUNE.taaRelMax, TUNE.taaRelMin, saturate(stability));\r\n        let rel     = relBase * mix_f(1.0, 0.80, farF);\r\n\r\n        let newClampedRGB = clamp_luma_to(newCol.rgb, prevCol.rgb, rel, TUNE.taaAbsEps);\r\n        let newClamped = vec4<f32>(newClampedRGB, newCol.a);\r\n\r\n        let blended = mix_v4(newClamped, prevCol, tb);\r\n        textureStore(outTex, pixI, frame.layerIndex, blended);\r\n        store_history_full_res_if_owner(pixI, frame.layerIndex, blended);\r\n      }\r\n    }\r\n  } else {\r\n    textureStore(outTex, pixI, frame.layerIndex, newCol);\r\n    store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);\r\n  }\r\n}\r\n";

  // tools/clouds/cloudsRender.wgsl
  var cloudsRender_default = `// cloudsRender.wgsl \u2014 preview: world-space camera + directional sun,\r
// tone-map and composite the cloud layer over a procedural sky.\r
// Uses explicit-LOD sampling so textureSample* calls are valid in\r
// non-uniform control flow.\r
\r
const PI : f32 = 3.141592653589793;\r
const SUN_UV_RADIUS : f32 = 0.02;\r
\r
// ---------- I/O ----------\r
struct RenderParams {\r
  layerIndex:u32,\r
  _pad0:u32,\r
  _pad1:u32,\r
  _pad2:u32,\r
\r
  // camera in world space\r
  camPos:vec3<f32>, _p3:f32,\r
  right:vec3<f32>,  _p4:f32,\r
  up:vec3<f32>,     _p5:f32,\r
  fwd:vec3<f32>,    _p6:f32,\r
\r
  // frustum + exposure\r
  fovY:f32,         // vertical FOV in radians\r
  aspect:f32,       // width / height\r
  exposure:f32,\r
  sunBloom:f32,     // extra sun glow scale\r
\r
  // sun as directional light in world space\r
  sunDir:vec3<f32>, _p7:f32,\r
\r
  // simple sky tint\r
  sky:vec3<f32>,    _p8:f32\r
};\r
@group(0) @binding(0) var samp : sampler;\r
@group(0) @binding(1) var tex  : texture_2d_array<f32>;\r
@group(0) @binding(2) var<uniform> R : RenderParams;\r
\r
struct VSOut { @builtin(position) pos:vec4<f32>, @location(0) uv:vec2<f32>, };\r
\r
@vertex\r
fn vs_main(@builtin(vertex_index) vid:u32)->VSOut {\r
  var p = array<vec2<f32>,6>(\r
    vec2<f32>(-1.0,-1.0), vec2<f32>( 1.0,-1.0), vec2<f32>(-1.0, 1.0),\r
    vec2<f32>(-1.0, 1.0), vec2<f32>( 1.0,-1.0), vec2<f32>( 1.0, 1.0)\r
  );\r
  var t = array<vec2<f32>,6>(\r
    vec2<f32>(0.0,1.0), vec2<f32>(1.0,1.0), vec2<f32>(0.0,0.0),\r
    vec2<f32>(0.0,0.0), vec2<f32>(1.0,1.0), vec2<f32>(1.0,0.0)\r
  );\r
  var o : VSOut;\r
  o.pos = vec4<f32>(p[vid], 0.0, 1.0);\r
  o.uv  = t[vid];\r
  return o;\r
}\r
\r
// ---------- helpers ----------\r
fn toneMapExp(c:vec3<f32>, k:f32)->vec3<f32> {\r
  return vec3<f32>(1.0) - exp(-c * max(k, 0.0));\r
}\r
\r
// project a world-space direction onto the screen using camera basis + FOV\r
fn projectDirToUV(dirWS:vec3<f32>)->vec2<f32> {\r
  // unchanged\r
  let sx = dot(dirWS, R.right);\r
  let sy = dot(dirWS, R.up);\r
  let sz = dot(dirWS, R.fwd);\r
\r
  let tanHalfY = tan(0.5 * R.fovY);\r
  let tanHalfX = tanHalfY * max(R.aspect, 0.000001);\r
\r
  let invSz = 1.0 / max(sz, 0.000001);\r
  let ndc = vec2<f32>((sx * invSz) / tanHalfX, (sy * invSz) / tanHalfY);\r
\r
  return vec2<f32>(0.5 + 0.5 * ndc.x, 0.5 - 0.5 * ndc.y);\r
}\r
\r
// ---- faster alpha gather: fewer samples, lower LOD, and early-out ----\r
// - Uses LOD = 1 to sample a smaller mip (cheaper/more cache-friendly).\r
// - Uses 5 samples (center + 4 cardinal neighbors). You can reduce to 4 if needed.\r
// - Caller should skip this when sun is far from pixel (d > some threshold) or when clouds are fully opaque/clear.\r
fn alphaGatherFast(uv:vec2<f32>, layer:i32)->f32 {\r
  // precomputed radius in uv space\r
  let r = SUN_UV_RADIUS;\r
  // quick 5-sample kernel (center + 4)\r
  let k0 = vec2<f32>(0.0, 0.0);\r
  let k1 = vec2<f32>( r, 0.0);\r
  let k2 = vec2<f32>(-r, 0.0);\r
  let k3 = vec2<f32>(0.0, r);\r
  let k4 = vec2<f32>(0.0, -r);\r
\r
  // sample at a lower LOD (1.0) to reduce cost & aggregate over a coarser area\r
  // note: textureSampleLevel returns a vec4; we only read .a\r
  var sum = 0.0;\r
  sum += clamp(textureSampleLevel(tex, samp, uv + k0, layer, 1.0).a, 0.0, 1.0);\r
  sum += clamp(textureSampleLevel(tex, samp, uv + k1, layer, 1.0).a, 0.0, 1.0);\r
  sum += clamp(textureSampleLevel(tex, samp, uv + k2, layer, 1.0).a, 0.0, 1.0);\r
  sum += clamp(textureSampleLevel(tex, samp, uv + k3, layer, 1.0).a, 0.0, 1.0);\r
  sum += clamp(textureSampleLevel(tex, samp, uv + k4, layer, 1.0).a, 0.0, 1.0);\r
\r
  return sum * 0.2; // divide by 5\r
}\r
\r
@fragment\r
fn fs_main(in:VSOut)->@location(0) vec4<f32> {\r
  // cloud sample (LOD 0 \u2014 compute wrote premultiplied rgb with alpha=1-Tr)\r
  let texel    = textureSampleLevel(tex, samp, in.uv, i32(R.layerIndex), 0.0);\r
  let cloudRGB = texel.rgb;\r
  let cloudA   = clamp(texel.a, 0.0, 1.0);\r
\r
  // procedural sky (linear) \u2014 unchanged\r
  let v = in.uv.y;\r
  let horizon = pow(clamp(1.0 - abs(v - 0.5) * 2.0, 0.0, 1.0), 1.25);\r
  var sky = mix(R.sky * 0.55, R.sky, pow(clamp(v, 0.0, 1.0), 1.6));\r
  sky += vec3<f32>(0.02, 0.03, 0.06) * horizon;\r
\r
  // sun in screen space\r
  let sunDir = normalize(R.sunDir);\r
  let uvSun  = projectDirToUV(sunDir);\r
  var sunGlow = 0.0;\r
  var sunDisk = 0.0;\r
\r
  let fwdDot = dot(sunDir, R.fwd);\r
\r
  // cheap bounding check: is the sun in front and in a small screen box?\r
  if (fwdDot > 0.0 && all(uvSun >= vec2<f32>(-0.2, -0.2)) && all(uvSun <= vec2<f32>(1.2, 1.2))) {\r
    let d = distance(in.uv, uvSun);\r
\r
    // early-out: if pixel is far from sun center, skip expensive gather\r
    // (adjust multiplier to control how far we consider "influence" region)\r
    if (d <= SUN_UV_RADIUS * 2.5) {\r
      // If clouds are nearly fully opaque or fully clear there's no need to gather\r
      if (cloudA < 0.98 && cloudA > 0.02) {\r
        // gather at lower LOD and fewer samples\r
        let aAvg = alphaGatherFast(uvSun, i32(R.layerIndex));\r
        let sunThrough = pow(max(1.0 - aAvg, 0.0), 1.5);\r
        // compute disk/glow using d\r
        sunGlow = exp(-pow(d / (SUN_UV_RADIUS * 1.5), 2.0)) * (0.6 + 0.4 * R.sunBloom) * sunThrough;\r
        sunDisk = smoothstep(SUN_UV_RADIUS, 0.0, d) * sunThrough;\r
      } else {\r
        // either fully clear or fully opaque \u2014 approximate direct effect (fast)\r
        let baseGlow = exp(-pow(d / (SUN_UV_RADIUS * 1.5), 2.0)) * (0.6 + 0.4 * R.sunBloom);\r
        if (cloudA <= 0.02) {\r
          // mostly clear: full glow & disk\r
          sunGlow = baseGlow;\r
          sunDisk = smoothstep(SUN_UV_RADIUS, 0.0, d);\r
        } else {\r
          // mostly opaque: heavily attenuated\r
          sunGlow = baseGlow * 0.05;\r
          sunDisk = 0.0;\r
        }\r
      }\r
    }\r
  }\r
\r
  // linear composite: premult clouds over sky, then add sun energy\r
  var linear = cloudRGB + sky * (1.0 - cloudA);\r
  linear += vec3<f32>(1.0) * (0.9 * sunGlow + 0.7 * sunDisk);\r
\r
  // tone map once at the end\r
  let color = toneMapExp(linear, R.exposure);\r
  return vec4<f32>(color, 1.0);\r
}\r
`;

  // tools/clouds/clouds.js
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
      this._abParams = new ArrayBuffer(96);
      this._dvParams = new DataView(this._abParams);
      this._abOffsets = new ArrayBuffer(48);
      this._dvOffsets = new DataView(this._abOffsets);
      this._abFrame = new ArrayBuffer(64);
      this._dvFrame = new DataView(this._abFrame);
      this._abLight = new ArrayBuffer(32);
      this._dvLight = new DataView(this._abLight);
      this._abView = new ArrayBuffer(128);
      this._dvView = new DataView(this._abView);
      this._abBox = new ArrayBuffer(32);
      this._dvBox = new DataView(this._abBox);
      this._abSampling = new ArrayBuffer(16);
      this._dvSampling = new DataView(this._abSampling);
      this._abReproj = new ArrayBuffer(48);
      this._dvReproj = new DataView(this._abReproj);
      this._abPerf = new ArrayBuffer(16);
      this._dvPerf = new DataView(this._abPerf);
      this._abTuning = new ArrayBuffer(256);
      this._dvTuning = new DataView(this._abTuning);
      this._abRender = new ArrayBuffer(128);
      this._dvRender = new DataView(this._abRender);
      this._abDummy32 = new ArrayBuffer(4);
      this.optionsBuffer = null;
      this.paramsBuffer = null;
      this.offsetsBuffer = null;
      this.dummyBuffer = null;
      this.posBuffer = null;
      this.frameBuffer = null;
      this.lightBuffer = null;
      this.viewBuffer = null;
      this.boxBuffer = null;
      this.samplingBuffer = null;
      this.reprojBuffer = null;
      this.perfBuffer = null;
      this.tuningBuffer = null;
      this.renderParams = null;
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
      this._ctxCache = /* @__PURE__ */ new WeakMap();
      this._canvasStates = /* @__PURE__ */ new WeakMap();
      this._renderBgCache = /* @__PURE__ */ new WeakMap();
      this._renderBundleCache = /* @__PURE__ */ new WeakMap();
      this._upsampleBgCache = /* @__PURE__ */ new Map();
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
      this._initCompute();
      this._initBuffers();
      this.setOptions();
      this.setParams();
      this.setTileScaling({
        shapeOffsetWorld: [0, 0],
        detailOffsetWorld: [0, 0]
      });
      this.setSamplingOpts({ useManualWrap: 0, weatherLayer: 0 });
      this.setReprojSettings({
        enabled: 0,
        subsample: 1,
        sampleOffset: 0,
        motionIsNormalized: 0,
        temporalBlend: 0,
        depthTest: 0,
        depthTolerance: 0,
        frameIndex: 0,
        fullWidth: 0,
        fullHeight: 0
      });
      this.setPerfParams();
      this.setSunByAngles();
      this.setBox();
      this.setTuning();
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
    _forceWrite(tag, gpuBuf, ab) {
      this.queue.writeBuffer(gpuBuf, 0, new Uint8Array(ab));
      const sum = this._sum32(ab);
      this._lastSums.set(tag, { sum, len: ab.byteLength });
    }
    // -------------------- init compute + resources --------------------
    _initCompute() {
      const d = this.device;
      this.module = d.createShaderModule({ code: clouds_default });
      this.bgl0 = d.createBindGroupLayout({
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
          // dummy storage
          {
            binding: 3,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          // offsets
          {
            binding: 4,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              access: "write-only",
              format: this.outFormat,
              viewDimension: "2d-array"
            }
          },
          // out
          {
            binding: 5,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "read-only-storage" }
          },
          // pos
          {
            binding: 6,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          // frame
          {
            binding: 7,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              access: "write-only",
              format: this.outFormat,
              viewDimension: "2d-array"
            }
          },
          // historyOut or dummy
          {
            binding: 8,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          // reproj
          {
            binding: 9,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          // perf
          {
            binding: 10,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          }
          // tuning
        ]
      });
      this.bgl1 = d.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "2d-array" }
          },
          // weather
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
          // shape3D
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
          // blue
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
          // detail3D
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
          // light
          {
            binding: 9,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          // view
          {
            binding: 10,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          },
          // box
          {
            binding: 11,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: "float", viewDimension: "2d-array" }
          },
          // historyPrev
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
          // motion
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
          // depthPrev
          {
            binding: 16,
            visibility: GPUShaderStage.COMPUTE,
            sampler: { type: "filtering" }
          }
        ]
      });
      this.pipeline = d.createComputePipeline({
        layout: d.createPipelineLayout({
          bindGroupLayouts: [this.bgl0, this.bgl1]
        }),
        compute: { module: this.module, entryPoint: "computeCloud" }
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
    _initBuffers() {
      const d = this.device;
      this.optionsBuffer = d.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      this.paramsBuffer = d.createBuffer({
        size: 96,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      this.offsetsBuffer = d.createBuffer({
        size: 48,
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
      this.samplingBuffer = d.createBuffer({
        size: 16,
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
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.queue.writeBuffer(this.dummyBuffer, 0, new Uint8Array(4));
    }
    // -------------------- UBO setters --------------------
    setOptions({
      useCustomPos = false,
      outputChannel = 0,
      writeRGB = true,
      debugForceFog = 0,
      temporalSeed = 0,
      windDisp = 0,
      windAngleRad = 0
    } = {}) {
      const dv = this._dvOptions;
      dv.setUint32(0, useCustomPos ? 1 : 0, true);
      dv.setUint32(4, outputChannel >>> 0, true);
      dv.setUint32(8, writeRGB ? 1 : 0, true);
      dv.setUint32(12, 0, true);
      dv.setFloat32(16, debugForceFog, true);
      dv.setFloat32(20, temporalSeed, true);
      dv.setFloat32(24, windDisp, true);
      dv.setFloat32(28, windAngleRad, true);
      this._writeIfChanged("options", this.optionsBuffer, this._abOptions);
      this._bg0Dirty = true;
    }
    setTemporalSeed(seed = 0) {
      this._dvOptions.setFloat32(20, seed, true);
      this._writeIfChanged("options", this.optionsBuffer, this._abOptions);
      this._bg0Dirty = true;
    }
    setParams(p = {}) {
      const defaults = {
        globalCoverage: 0.6,
        globalDensity: 1,
        cloudAnvilAmount: 0,
        cloudBeer: 6,
        attenuationClamp: 0.2,
        inScatterG: 0.2,
        silverIntensity: 2.5,
        silverExponent: 2,
        outScatterG: 0.1,
        inVsOut: 0.5,
        outScatterAmbientAmt: 0.9,
        ambientMinimum: 0.2,
        sunColor: [1, 0.95, 0.9],
        // new fields (defaults chosen to be sensible; tweak as needed)
        densityDivMin: 1e-3,
        // corresponds to thesis divmin (Eq.36)
        silverDirectionBias: 0,
        // bias applied to silver/backscatter dot
        silverHorizonBoost: 0,
        // tiling scales (new artist controls)
        shapeScale: 1,
        detailScale: 1
      };
      const c = Object.assign({}, defaults, p);
      const dv = this._dvParams;
      dv.setFloat32(0, c.globalCoverage, true);
      dv.setFloat32(4, c.globalDensity, true);
      dv.setFloat32(8, c.cloudAnvilAmount, true);
      dv.setFloat32(12, c.cloudBeer, true);
      dv.setFloat32(16, c.attenuationClamp, true);
      dv.setFloat32(20, c.inScatterG, true);
      dv.setFloat32(24, c.silverIntensity, true);
      dv.setFloat32(28, c.silverExponent, true);
      dv.setFloat32(32, c.outScatterG, true);
      dv.setFloat32(36, c.inVsOut, true);
      dv.setFloat32(40, c.outScatterAmbientAmt, true);
      dv.setFloat32(44, c.ambientMinimum, true);
      dv.setFloat32(48, c.sunColor[0], true);
      dv.setFloat32(52, c.sunColor[1], true);
      dv.setFloat32(56, c.sunColor[2], true);
      dv.setFloat32(60, 0, true);
      dv.setFloat32(64, c.densityDivMin, true);
      dv.setFloat32(68, c.silverDirectionBias, true);
      dv.setFloat32(72, c.silverHorizonBoost, true);
      dv.setFloat32(76, c.shapeScale, true);
      dv.setFloat32(80, c.detailScale, true);
      dv.setFloat32(84, 0, true);
      dv.setFloat32(88, 0, true);
      dv.setFloat32(92, 0, true);
      this._writeIfChanged("params", this.paramsBuffer, this._abParams);
      this._bg0Dirty = true;
    }
    setTileScaling({
      shapeOffsetWorld = [0, 0, 0],
      detailOffsetWorld = [0, 0, 0],
      shapeScale: shapeScale2 = 0.1,
      detailScale: detailScale2 = 1
    } = {}) {
      const dv = this._dvOffsets;
      dv.setFloat32(0, shapeOffsetWorld[0] || 0, true);
      dv.setFloat32(4, shapeOffsetWorld[1] || 0, true);
      dv.setFloat32(8, shapeOffsetWorld[2] || 0, true);
      dv.setFloat32(12, 0, true);
      dv.setFloat32(16, detailOffsetWorld[0] || 0, true);
      dv.setFloat32(20, detailOffsetWorld[1] || 0, true);
      dv.setFloat32(24, detailOffsetWorld[2] || 0, true);
      dv.setFloat32(28, 0, true);
      dv.setFloat32(32, shapeScale2, true);
      dv.setFloat32(36, detailScale2, true);
      dv.setFloat32(40, 0, true);
      dv.setFloat32(44, 0, true);
      this._writeIfChanged("offsets", this.offsetsBuffer, this._abOffsets);
      this._bg0Dirty = true;
    }
    setSamplingOpts({ useManualWrap = 0, weatherLayer = 0 } = {}) {
      const dv = this._dvSampling;
      dv.setUint32(0, useManualWrap >>> 0, true);
      dv.setUint32(4, weatherLayer >>> 0, true);
      dv.setUint32(8, 0, true);
      dv.setUint32(12, 0, true);
      this._writeIfChanged("sampling", this.samplingBuffer, this._abSampling);
    }
    setWeatherLayer(layer = 0) {
      this.setSamplingOpts({
        useManualWrap: this._dvSampling.getUint32(0, true),
        weatherLayer: layer
      });
    }
    setManualWrap(on = true) {
      this.setSamplingOpts({
        useManualWrap: on ? 1 : 0,
        weatherLayer: this.getWeatherLayer()
      });
    }
    getWeatherLayer() {
      return this._dvSampling.getUint32(4, true) || 0;
    }
    setReprojSettings({
      enabled = 0,
      subsample = 1,
      sampleOffset = 0,
      motionIsNormalized = 0,
      temporalBlend = 0,
      depthTest = 0,
      depthTolerance = 0,
      frameIndex = 0,
      fullWidth = 0,
      fullHeight = 0
    } = {}) {
      const dv = this._dvReproj;
      dv.setUint32(0, enabled >>> 0, true);
      dv.setUint32(4, subsample >>> 0, true);
      dv.setUint32(8, sampleOffset >>> 0, true);
      dv.setUint32(12, motionIsNormalized >>> 0, true);
      dv.setFloat32(16, temporalBlend, true);
      dv.setUint32(20, depthTest >>> 0, true);
      dv.setFloat32(24, depthTolerance, true);
      dv.setUint32(28, frameIndex >>> 0, true);
      if (fullWidth) {
        dv.setUint32(32, fullWidth >>> 0, true);
        this._reprojFullW = fullWidth;
      }
      if (fullHeight) {
        dv.setUint32(36, fullHeight >>> 0, true);
        this._reprojFullH = fullHeight;
      }
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
      this._bg0Dirty = true;
    }
    setReprojFullResSize(fullWidth, fullHeight) {
      this._reprojFullW = fullWidth | 0;
      this._reprojFullH = fullHeight | 0;
      this._dvReproj.setUint32(32, this._reprojFullW >>> 0, true);
      this._dvReproj.setUint32(36, this._reprojFullH >>> 0, true);
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
      this._bg0Dirty = true;
    }
    setPerfParams({ lodBiasMul = 1, coarseMipBias = 0 } = {}) {
      const dv = this._dvPerf;
      dv.setFloat32(0, lodBiasMul, true);
      dv.setFloat32(4, coarseMipBias, true);
      dv.setFloat32(8, 0, true);
      dv.setFloat32(12, 0, true);
      this._writeIfChanged("perf", this.perfBuffer, this._abPerf);
      this._bg0Dirty = true;
    }
    setLight({ sunDir = [-0.4, 0.8, 0.45], camPos = [0, 0, 2] } = {}) {
      const dv = this._dvLight;
      dv.setFloat32(0, sunDir[0], true);
      dv.setFloat32(4, sunDir[1], true);
      dv.setFloat32(8, sunDir[2], true);
      dv.setFloat32(12, 0, true);
      dv.setFloat32(16, camPos[0], true);
      dv.setFloat32(20, camPos[1], true);
      dv.setFloat32(24, camPos[2], true);
      dv.setFloat32(28, 0, true);
      this._writeIfChanged("light", this.lightBuffer, this._abLight);
      this._bg1Dirty = true;
    }
    setSunByAngles({
      azimuthDeg = 45,
      elevationDeg = 35,
      camPos = [0, 0, 2]
    } = {}) {
      const az = azimuthDeg * Math.PI / 180, el = elevationDeg * Math.PI / 180;
      const sd = [
        Math.cos(el) * Math.sin(az),
        Math.sin(el),
        Math.cos(el) * Math.cos(az)
      ];
      this.setLight({ sunDir: sd, camPos });
    }
    setBox({ center = [0, 0, 0], half = [1, 0.6, 1], uvScale = 1.5 } = {}) {
      const dv = this._dvBox;
      dv.setFloat32(0, center[0], true);
      dv.setFloat32(4, center[1], true);
      dv.setFloat32(8, center[2], true);
      dv.setFloat32(12, 0, true);
      dv.setFloat32(16, half[0], true);
      dv.setFloat32(20, half[1], true);
      dv.setFloat32(24, half[2], true);
      dv.setFloat32(28, uvScale, true);
      this._writeIfChanged("box", this.boxBuffer, this._abBox);
      this._bg1Dirty = true;
    }
    setFrame({
      fullWidth = 0,
      fullHeight = 0,
      tileWidth = 0,
      tileHeight = 0,
      originX = 0,
      originY = 0,
      originZ = 0,
      fullDepth = 1,
      tileDepth = 1,
      layerIndex = 0,
      layers = 1,
      originXf = 0,
      originYf = 0
    } = {}) {
      const dv = this._dvFrame;
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
      dv.setFloat32(48, originXf ?? 0, true);
      dv.setFloat32(52, originYf ?? 0, true);
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
    setViewFromCamera({
      camPos = [0, 0, 3],
      right = [1, 0, 0],
      up = [0, 1, 0],
      fwd = [0, 0, 1],
      fovYDeg = 60,
      aspect = 1,
      planetRadius = 0,
      cloudBottom = -1,
      cloudTop = 1,
      worldToUV = 1,
      stepBase = 0.02,
      stepInc = 0.04,
      volumeLayers = 1
    } = {}) {
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
        aspect,
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
      this._bg1Dirty = true;
    }
    setSunByDirection({ dir = [0, 1, 0], camPos = [0, 0, 3] } = {}) {
      this.setLight({ sunDir: dir, camPos });
    }
    // -------------------- TUNE setter --------------------
    setTuning(t = {}) {
      const defaults = {
        maxSteps: 256,
        minStep: 3e-3,
        maxStep: 0.1,
        sunSteps: 4,
        sunStride: 4,
        sunMinTr: 5e-3,
        phaseJitter: 1,
        stepJitter: 0.08,
        baseJitterFrac: 0.15,
        topJitterFrac: 0.1,
        lodBiasWeather: 1.5,
        aabbFaceOffset: 15e-4,
        weatherRejectGate: 0.99,
        weatherRejectMip: 1,
        emptySkipMult: 3,
        nearFluffDist: 60,
        nearStepScale: 0.3,
        nearLodBias: -1.5,
        nearDensityMult: 2.5,
        nearDensityRange: 45,
        lodBlendThreshold: 0.05,
        sunDensityGate: 0.015,
        fflyRelClamp: 2.5,
        fflyAbsFloor: 1.5,
        taaRelMin: 0.22,
        taaRelMax: 1.1,
        taaAbsEps: 0.02,
        farStart: 800,
        farFull: 2500,
        farLodPush: 0.8,
        farDetailAtten: 0.5,
        farStepMult: 1.6,
        bnFarScale: 0.35,
        farTaaHistoryBoost: 1.35,
        raySmoothDens: 0.5,
        raySmoothSun: 0.5,
        // NEW: styleBlend slider (0 = old flat, 1 = new bulgy)
        styleBlend: 0
      };
      const c = Object.assign({}, defaults, t);
      const dv = this._dvTuning;
      let o = 0;
      dv.setInt32(o, c.maxSteps | 0, true);
      o += 4;
      dv.setInt32(o, 0, true);
      o += 4;
      dv.setFloat32(o, c.minStep, true);
      o += 4;
      dv.setFloat32(o, c.maxStep, true);
      o += 4;
      dv.setInt32(o, c.sunSteps | 0, true);
      o += 4;
      dv.setInt32(o, c.sunStride | 0, true);
      o += 4;
      dv.setFloat32(o, c.sunMinTr, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, c.phaseJitter, true);
      o += 4;
      dv.setFloat32(o, c.stepJitter, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, c.baseJitterFrac, true);
      o += 4;
      dv.setFloat32(o, c.topJitterFrac, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, c.lodBiasWeather, true);
      o += 4;
      dv.setFloat32(o, c.aabbFaceOffset, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, c.weatherRejectGate, true);
      o += 4;
      dv.setFloat32(o, c.weatherRejectMip, true);
      o += 4;
      dv.setFloat32(o, c.emptySkipMult, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, c.nearFluffDist, true);
      o += 4;
      dv.setFloat32(o, c.nearStepScale, true);
      o += 4;
      dv.setFloat32(o, c.nearLodBias, true);
      o += 4;
      dv.setFloat32(o, c.nearDensityMult, true);
      o += 4;
      dv.setFloat32(o, c.nearDensityRange, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, c.lodBlendThreshold, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, c.sunDensityGate, true);
      o += 4;
      dv.setFloat32(o, c.fflyRelClamp, true);
      o += 4;
      dv.setFloat32(o, c.fflyAbsFloor, true);
      o += 4;
      dv.setFloat32(o, c.taaRelMin, true);
      o += 4;
      dv.setFloat32(o, c.taaRelMax, true);
      o += 4;
      dv.setFloat32(o, c.taaAbsEps, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, c.farStart, true);
      o += 4;
      dv.setFloat32(o, c.farFull, true);
      o += 4;
      dv.setFloat32(o, c.farLodPush, true);
      o += 4;
      dv.setFloat32(o, c.farDetailAtten, true);
      o += 4;
      dv.setFloat32(o, c.farStepMult, true);
      o += 4;
      dv.setFloat32(o, c.bnFarScale, true);
      o += 4;
      dv.setFloat32(o, c.farTaaHistoryBoost, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, c.raySmoothDens, true);
      o += 4;
      dv.setFloat32(o, c.raySmoothSun, true);
      o += 4;
      dv.setFloat32(o, c.styleBlend, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      dv.setFloat32(o, 0, true);
      o += 4;
      this._writeIfChanged("tuning", this.tuningBuffer, this._abTuning);
      this._bg0Dirty = true;
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
            this.blueTex.destroy();
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
      this.historyOutView = view;
      this._bg0Dirty = true;
    }
    // -------------------- outputs --------------------
    createOutputTexture(width, height, layers = 1, format = "rgba16float") {
      if (this.outTexture && this.width === width && this.height === height && this.layers === layers && this.outFormat === format) {
        this.setFrame({
          fullWidth: width,
          fullHeight: height,
          tileWidth: width,
          tileHeight: height,
          originX: 0,
          originY: 0,
          layerIndex: 0,
          originXf: 0,
          originYf: 0
        });
        this._reprojFullW = width;
        this._reprojFullH = height;
        const curFW = this._dvReproj.getUint32(32, true) || 0, curFH = this._dvReproj.getUint32(36, true) || 0;
        if (curFW !== this._reprojFullW >>> 0 || curFH !== this._reprojFullH >>> 0) {
          this._dvReproj.setUint32(32, this._reprojFullW >>> 0, true);
          this._dvReproj.setUint32(36, this._reprojFullH >>> 0, true);
          this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
          this._bg0Dirty = true;
        }
        return this.outView;
      }
      if (this.outTexture)
        try {
          this.outTexture.destroy();
        } catch (_) {
        }
      this.outTexture = null;
      this.outView = null;
      this.outFormat = format;
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
      this.outTexture = null;
      this.outView = view;
      this.outFormat = format;
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
    // -------------------- bind group key building --------------------
    _buildBg0Key() {
      const ids = [
        this._getResId(this.outView),
        this._getResId(this.optionsBuffer),
        this._getResId(this.paramsBuffer),
        this._getResId(this.dummyBuffer),
        this._getResId(this.offsetsBuffer),
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
          { binding: 3, resource: { buffer: this.offsetsBuffer } },
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
      if (!this._bg0Dirty && this._bg0Cache.has(k0))
        this._currentBg0 = this._bg0Cache.get(k0);
      else {
        if (this._bg0Cache.has(k0) && this._bg0Dirty) {
          const idx = this._bg0Keys.indexOf(k0);
          if (idx >= 0) this._bg0Keys.splice(idx, 1);
          this._bg0Cache.delete(k0);
        }
        const bg0 = this._createBg0ForKey();
        this._bg0Cache.set(k0, bg0);
        this._bg0Keys.push(k0);
        this._currentBg0 = bg0;
        this._bg0Dirty = false;
        while (this._bg0Keys.length > 12) {
          const oldest = this._bg0Keys.shift();
          this._bg0Cache.delete(oldest);
        }
      }
      const k1 = this._buildBg1Key();
      if (!this._bg1Dirty && this._bg1Cache.has(k1))
        this._currentBg1 = this._bg1Cache.get(k1);
      else {
        if (this._bg1Cache.has(k1) && this._bg1Dirty) {
          const idx = this._bg1Keys.indexOf(k1);
          if (idx >= 0) this._bg1Keys.splice(idx, 1);
          this._bg1Cache.delete(k1);
        }
        const bg1 = this._createBg1ForKey();
        this._bg1Cache.set(k1, bg1);
        this._bg1Keys.push(k1);
        this._currentBg1 = bg1;
        this._bg1Dirty = false;
        while (this._bg1Keys.length > 12) {
          const oldest = this._bg1Keys.shift();
          this._bg1Cache.delete(oldest);
        }
      }
    }
    // -------------------- rect/visibility helpers --------------------
    _projectWorldToPixel(p, view, width, height) {
      const cx = view.camPos[0], cy = view.camPos[1], cz = view.camPos[2];
      const rx = view.right[0], ry = view.right[1], rz = view.right[2];
      const ux = view.up[0], uy = view.up[1], uz = view.up[2];
      const fx = view.fwd[0], fy = view.fwd[1], fz = view.fwd[2];
      const tanYhalf = Math.tan(0.5 * (view.fovYRad || 0.5));
      const aspect = view.aspect || 1;
      const dx = p[0] - cx, dy = p[1] - cy, dz = p[2] - cz;
      const xCam = dx * rx + dy * ry + dz * rz;
      const yCam = dx * ux + dy * uy + dz * uz;
      const zCam = -(dx * fx + dy * fy + dz * fz);
      const eps = 1e-6;
      if (zCam <= eps) return { ok: false, x: 0, y: 0, zCam };
      const ndcX = xCam / (zCam * aspect * tanYhalf), ndcY = yCam / (zCam * tanYhalf);
      const px = (ndcX * 0.5 + 0.5) * width;
      const py = (ndcY * 0.5 + 0.5) * height;
      return { ok: true, x: px, y: py, zCam };
    }
    _computeAABBScreenRect(view, box, width, height, padPx = 4) {
      const cx = box.center[0], cy = box.center[1], cz = box.center[2];
      const hx = box.half[0], hy = box.half[1], hz = box.half[2];
      const corners = [
        [cx - hx, cy - hy, cz - hz],
        [cx + hx, cy - hy, cz - hz],
        [cx - hx, cy + hy, cz - hz],
        [cx + hx, cy + hy, cz - hz],
        [cx - hx, cy - hy, cz + hz],
        [cx + hx, cy - hy, cz + hz],
        [cx - hx, cy + hy, cz + hz],
        [cx + hx, cy + hy, cz + hz]
      ];
      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      let anyFront = false;
      for (const C of corners) {
        const q = this._projectWorldToPixel(C, view, width, height);
        if (!q.ok) continue;
        anyFront = true;
        if (q.x < minX) minX = q.x;
        if (q.y < minY) minY = q.y;
        if (q.x > maxX) maxX = q.x;
        if (q.y > maxY) maxY = q.y;
      }
      if (!anyFront) return { visible: false };
      minX = Math.max(0, Math.floor(minX) - padPx);
      minY = Math.max(0, Math.floor(minY) - padPx);
      maxX = Math.min(width, Math.ceil(maxX) + padPx);
      maxY = Math.min(height, Math.ceil(maxY) + padPx);
      const w = Math.max(0, maxX - minX), h = Math.max(0, maxY - minY);
      return { visible: w > 0 && h > 0, x: minX, y: minY, w, h };
    }
    // -------------------- dispatch helpers (coarse integrated) --------------------
    async dispatchRect({ x, y, w, h, wait = false, coarseFactor = 1 } = {}) {
      if (!this.outView)
        throw new Error("dispatchRect: createOutputTexture/setOutputView first.");
      const cf = Math.max(1, coarseFactor | 0);
      if (cf < 2) return await this.dispatchRectNoCoarse({ x, y, w, h, wait });
      const cW = Math.max(1, Math.ceil((w || this.width) / cf));
      const cH = Math.max(1, Math.ceil((h || this.height) / cf));
      const baseX = Math.floor((x || 0) / cf), baseY = Math.floor((y || 0) / cf);
      this._ensureCoarseTexture(cW, cH, this.layers);
      const savedFullW = this._reprojFullW || this.width;
      const savedFullH = this._reprojFullH || this.height;
      const savedOutTexture = this.outTexture, savedOutView = this.outView, savedWidth = this.width, savedHeight = this.height, savedFormat = this.outFormat;
      this.outTexture = this._coarseTexture;
      this.outView = this._coarseView;
      this.width = cW;
      this.height = cH;
      this.outFormat = this._coarseTexture?.format || savedFormat;
      this.setFrame({
        fullWidth: cW,
        fullHeight: cH,
        tileWidth: cW,
        tileHeight: cH,
        originX: baseX,
        originY: baseY,
        layerIndex: this._dvFrame.getInt32(36, true) | 0,
        originXf: 0,
        originYf: 0
      });
      const curFW = this._dvReproj.getUint32(32, true) || 0, curFH = this._dvReproj.getUint32(36, true) || 0;
      if (curFW !== savedFullW >>> 0 || curFH !== savedFullH >>> 0) {
        this._dvReproj.setUint32(32, savedFullW >>> 0, true);
        this._dvReproj.setUint32(36, savedFullH >>> 0, true);
        this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
        this._bg0Dirty = true;
      }
      await this._dispatchComputeInternal({ wait });
      this.outTexture = savedOutTexture;
      this.outView = savedOutView;
      this.width = savedWidth;
      this.height = savedHeight;
      this.outFormat = savedFormat;
      this.setFrame({
        fullWidth: savedWidth,
        fullHeight: savedHeight,
        tileWidth: w || savedWidth,
        tileHeight: h || savedHeight,
        originX: x || 0,
        originY: y || 0,
        layerIndex: this._dvFrame.getInt32(36, true) | 0,
        originXf: 0,
        originYf: 0
      });
      await this._upsampleCoarseToOut({
        srcX: baseX,
        srcY: baseY,
        srcW: cW,
        srcH: cH,
        dstX: x || 0,
        dstY: y || 0,
        dstW: w || this.width,
        dstH: h || this.height,
        wait
      });
      this._lastHadWork = true;
      return this.outView;
    }
    async dispatchRectNoCoarse({ x, y, w, h, wait = false } = {}) {
      if (!this.outView)
        throw new Error(
          "dispatchRectNoCoarse: createOutputTexture/setOutputView first."
        );
      const baseX = Math.max(0, Math.floor(x || 0)), baseY = Math.max(0, Math.floor(y || 0));
      const tw = Math.max(0, Math.floor(w || 0)), th = Math.max(0, Math.floor(h || 0));
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
    async dispatchForBox({ padPx = 8, wait = false, coarseFactor = 1 } = {}) {
      if (!this.outView)
        throw new Error(
          "dispatchForBox: createOutputTexture/setOutputView first."
        );
      const view = {
        camPos: [
          this._dvView.getFloat32(0, true),
          this._dvView.getFloat32(4, true),
          this._dvView.getFloat32(8, true)
        ],
        right: [
          this._dvView.getFloat32(16, true),
          this._dvView.getFloat32(20, true),
          this._dvView.getFloat32(24, true)
        ],
        up: [
          this._dvView.getFloat32(32, true),
          this._dvView.getFloat32(36, true),
          this._dvView.getFloat32(40, true)
        ],
        fwd: [
          this._dvView.getFloat32(48, true),
          this._dvView.getFloat32(52, true),
          this._dvView.getFloat32(56, true)
        ],
        fovYRad: this._dvView.getFloat32(64, true),
        aspect: this._dvView.getFloat32(68, true)
      };
      const box = {
        center: [
          this._dvBox.getFloat32(0, true),
          this._dvBox.getFloat32(4, true),
          this._dvBox.getFloat32(8, true)
        ],
        half: [
          this._dvBox.getFloat32(16, true),
          this._dvBox.getFloat32(20, true),
          this._dvBox.getFloat32(24, true)
        ]
      };
      const rect = this._computeAABBScreenRect(
        view,
        box,
        this.width,
        this.height,
        padPx
      );
      if (!rect.visible) {
        this._lastHadWork = false;
        return null;
      }
      const cf = Math.max(1, coarseFactor | 0);
      return await this.dispatchRect({
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        wait,
        coarseFactor: cf
      });
    }
    async dispatch({ wait = false, coarseFactor = 1 } = {}) {
      const cf = Math.max(1, coarseFactor | 0);
      if (cf >= 2) {
        const cW = Math.max(1, Math.ceil(this.width / cf));
        const cH = Math.max(1, Math.ceil(this.height / cf));
        this._ensureCoarseTexture(cW, cH, this.layers);
        const savedFullW = this._reprojFullW || this.width, savedFullH = this._reprojFullH || this.height;
        const savedOutTexture = this.outTexture, savedOutView = this.outView, savedWidth = this.width, savedHeight = this.height, savedFormat = this.outFormat;
        this.outTexture = this._coarseTexture;
        this.outView = this._coarseView;
        this.width = cW;
        this.height = cH;
        this.outFormat = this._coarseTexture?.format || savedFormat;
        this.setFrame({
          fullWidth: cW,
          fullHeight: cH,
          tileWidth: cW,
          tileHeight: cH,
          originX: 0,
          originY: 0,
          layerIndex: 0,
          originXf: 0,
          originYf: 0
        });
        const curFW = this._dvReproj.getUint32(32, true) || 0, curFH = this._dvReproj.getUint32(36, true) || 0;
        if (curFW !== savedFullW >>> 0 || curFH !== savedFullH >>> 0) {
          this._dvReproj.setUint32(32, savedFullW >>> 0, true);
          this._dvReproj.setUint32(36, savedFullH >>> 0, true);
          this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
          this._bg0Dirty = true;
        }
        await this._dispatchComputeInternal({ wait });
        this.outTexture = savedOutTexture;
        this.outView = savedOutView;
        this.width = savedWidth;
        this.height = savedHeight;
        this.outFormat = savedFormat;
        await this._upsampleCoarseToOut({
          srcX: 0,
          srcY: 0,
          srcW: cW,
          srcH: cH,
          dstX: 0,
          dstY: 0,
          dstW: this.width,
          dstH: this.height,
          wait
        });
        this._lastHadWork = true;
        return this.outView;
      }
      await this._dispatchComputeInternal({ wait });
      this._lastHadWork = true;
      return this.outView;
    }
    async dispatchAllLayers({ wait = false } = {}) {
      if (!this.outView)
        throw new Error(
          "Nothing to dispatch: createOutputTexture/setOutputView first."
        );
      this._writeIfChanged("options", this.optionsBuffer, this._abOptions);
      this._writeIfChanged("params", this.paramsBuffer, this._abParams);
      this._writeIfChanged("offsets", this.offsetsBuffer, this._abOffsets);
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
    async _dispatchComputeInternal({ wait = false } = {}) {
      this._writeIfChanged("options", this.optionsBuffer, this._abOptions);
      this._writeIfChanged("params", this.paramsBuffer, this._abParams);
      this._writeIfChanged("offsets", this.offsetsBuffer, this._abOffsets);
      this._writeIfChanged("frame", this.frameBuffer, this._abFrame);
      this._writeIfChanged("reproj", this.reprojBuffer, this._abReproj);
      this._writeIfChanged("perf", this.perfBuffer, this._abPerf);
      this._writeIfChanged("tuning", this.tuningBuffer, this._abTuning);
      this._makeBindGroups();
      const enc = this.device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this._currentBg0);
      pass.setBindGroup(1, this._currentBg1);
      pass.dispatchWorkgroups(this._wgX, this._wgY, 1);
      pass.end();
      this.queue.submit([enc.finish()]);
      if (wait && typeof this.queue.onSubmittedWorkDone === "function")
        await this.queue.onSubmittedWorkDone();
    }
    // -------------------- render / preview blit --------------------
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
    _getOrCreateRenderBindGroup(canvas, bgl, samp) {
      let map = this._renderBgCache.get(canvas);
      if (!map) {
        map = /* @__PURE__ */ new Map();
        this._renderBgCache.set(canvas, map);
      }
      const key = this._getResId(this.outView) + "|" + this._getResId(samp) + "|" + this._getResId(this.renderParams);
      if (map.has(key)) return map.get(key);
      const bg = this.device.createBindGroup({
        layout: bgl,
        entries: [
          { binding: 0, resource: samp },
          { binding: 1, resource: this.outView },
          {
            binding: 2,
            resource: { buffer: this.renderParams, offset: 0, size: 128 }
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
      const key = this._getResId(this.outView) + "|" + this._getResId(samp) + "|" + this._getResId(this.renderParams) + "|" + this._getResId(pipe);
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
        const yaw = rad(opts.yawDeg ?? 0), pitch = rad(opts.pitchDeg ?? 0);
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
        const sAz = rad(opts.sunAzimuthDeg ?? 45), sEl = rad(opts.sunElevationDeg ?? 20);
        const cel = Math.cos(sEl);
        sunDir = norm2([cel * Math.sin(sAz), Math.sin(sEl), cel * Math.cos(sAz)]);
      }
      dv.setUint32(0, layerIndex, true);
      dv.setUint32(4, 0, true);
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
      wv3(96, opts.sunDir ?? [0, 1, 0]);
      wv3(112, skyColor);
      this._writeIfChanged("render", this.renderParams, this._abRender);
    }
    _ensureCanvasConfigured(canvas, format = "bgra8unorm") {
      if (!canvas) throw new Error("_ensureCanvasConfigured: canvas required");
      const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
      const clientW = Math.max(1, Math.round(canvas.clientWidth)), clientH = Math.max(1, Math.round(canvas.clientHeight));
      const displayW = Math.max(1, Math.floor(clientW * dpr)), displayH = Math.max(1, Math.floor(clientH * dpr));
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
      return { ctx, state };
    }
    renderToCanvasWorld(canvas, {
      layerIndex = 0,
      cam,
      sunDir = [0, 1, 0],
      exposure = 1.2,
      skyColor = [0.55, 0.7, 0.95],
      sunBloom = 0
    } = {}) {
      if (!this.outView)
        throw new Error(
          "Nothing to render: run dispatch() first or setOutputView()."
        );
      const { pipe, bgl, samp, format } = this._ensureRenderPipeline("bgra8unorm");
      const { ctx, state } = this._ensureCanvasConfigured(canvas, format);
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
      this._writeRenderUniforms({
        layerIndex,
        cam,
        sunDir,
        exposure,
        skyColor,
        sunBloom
      });
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
      const { ctx, state } = this._ensureCanvasConfigured(canvas, format);
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
      this._writeRenderUniforms(opts);
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
    // -------------------- coarse helpers --------------------
    _ensureCoarseTexture(w, h, layers = 1) {
      if (this._coarseTexture && this._coarseW === w && this._coarseH === h && this._coarseLayers === layers)
        return;
      try {
        if (this._coarseTexture?.destroy) this._coarseTexture.destroy();
      } catch (_) {
      }
      this._coarseW = w;
      this._coarseH = h;
      this._coarseLayers = layers;
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
    // upsample pipeline for coarse->full
    _ensureUpsamplePipeline(format = this.outFormat) {
      if (this._upsample && this._upsample.format === format)
        return this._upsample;
      const blitWGSL = `
      struct RenderParams { layerIndex : u32, _pad:u32, _pad2:u32, _pad3:u32, };
      @group(0) @binding(0) var samp : sampler;
      @group(0) @binding(1) var tex : texture_2d_array<f32>;
      @group(0) @binding(2) var<uniform> R : RenderParams;
      struct VSOut { @builtin(position) pos : vec4<f32>, @location(0) uv : vec2<f32> };
      @vertex fn vs_main(@builtin(vertex_index) vid : u32) -> VSOut {
        var positions = array<vec2<f32>, 6>(vec2<f32>(-1.0,-1.0), vec2<f32>( 1.0,-1.0), vec2<f32>(-1.0, 1.0), vec2<f32>(-1.0, 1.0), vec2<f32>( 1.0,-1.0), vec2<f32>( 1.0, 1.0));
        var uvs = array<vec2<f32>, 6>(vec2<f32>(0.0,1.0), vec2<f32>(1.0,1.0), vec2<f32>(0.0,0.0), vec2<f32>(0.0,0.0), vec2<f32>(1.0,1.0), vec2<f32>(1.0,0.0));
        var o : VSOut; o.pos = vec4<f32>(positions[vid], 0.0, 1.0); o.uv = uvs[vid]; return o;
      }
      @fragment fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
        let layer = i32(R.layerIndex);
        let c = textureSampleLevel(tex, samp, in.uv, layer, 0.0);
        return c;
      }
    `;
      const mod = this.device.createShaderModule({ code: blitWGSL });
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
      this._upsample = { pipe, bgl, samp, format };
      return this._upsample;
    }
    _getOrCreateUpsampleBindGroup(coarseView, layerIndex) {
      const key = this._getResId(coarseView) + "|" + (layerIndex | 0);
      if (this._upsampleBgCache.has(key)) return this._upsampleBgCache.get(key);
      const up = this._ensureUpsamplePipeline(this.outFormat);
      const bg = this.device.createBindGroup({
        layout: up.bgl,
        entries: [
          { binding: 0, resource: up.samp },
          { binding: 1, resource: coarseView },
          {
            binding: 2,
            resource: { buffer: this.renderParams, offset: 0, size: 128 }
          }
        ]
      });
      this._upsampleBgCache.set(key, bg);
      if (this._upsampleBgCache.size > 32) {
        const firstKey = this._upsampleBgCache.keys().next().value;
        this._upsampleBgCache.delete(firstKey);
      }
      return bg;
    }
    async _upsampleCoarseToOut({
      srcX = 0,
      srcY = 0,
      srcW,
      srcH,
      dstX = 0,
      dstY = 0,
      dstW,
      dstH,
      wait = false
    } = {}) {
      if (!this._coarseView || !this.outTexture) return;
      const up = this._ensureUpsamplePipeline(this.outFormat);
      const enc = this.device.createCommandEncoder();
      for (let layer = 0; layer < this.layers; ++layer) {
        this._dvRender.setUint32(0, layer >>> 0, true);
        this._writeIfChanged("render", this.renderParams, this._abRender);
        const bg = this._getOrCreateUpsampleBindGroup(this._coarseView, layer);
        const colorView = this.outTexture.createView({
          baseArrayLayer: layer,
          arrayLayerCount: 1
        });
        const pass = enc.beginRenderPass({
          colorAttachments: [
            { view: colorView, loadOp: "load", storeOp: "store" }
          ]
        });
        pass.setPipeline(up.pipe);
        pass.setBindGroup(0, bg);
        pass.draw(6, 1, 0, 0);
        pass.end();
      }
      this.queue.submit([enc.finish()]);
      if (wait && typeof this.queue.onSubmittedWorkDone === "function")
        await this.queue.onSubmittedWorkDone();
    }
    // -------------------- cleanup --------------------
    destroy() {
      const toDestroy = [
        "optionsBuffer",
        "paramsBuffer",
        "offsetsBuffer",
        "dummyBuffer",
        "posBuffer",
        "frameBuffer",
        "lightBuffer",
        "viewBuffer",
        "boxBuffer",
        "samplingBuffer",
        "reprojBuffer",
        "perfBuffer",
        "renderParams",
        "tuningBuffer"
      ];
      for (const k of toDestroy)
        try {
          if (this[k]?.destroy) this[k].destroy();
        } catch (_) {
        } finally {
          this[k] = null;
        }
      try {
        if (this.outTexture?.destroy) this.outTexture.destroy();
      } catch (_) {
      }
      try {
        if (this._coarseTexture?.destroy) this._coarseTexture.destroy();
      } catch (_) {
      }
      this.outTexture = null;
      this.outView = null;
      this._coarseTexture = null;
      this._coarseView = null;
      if (this._ownsBlue && this.blueTex)
        try {
          this.blueTex.destroy();
        } catch (_) {
        }
      this.blueTex = null;
      this.blueView = null;
      this._ownsBlue = false;
      try {
        if (this._dummy2DMotion?.destroy) this._dummy2DMotion.destroy();
      } catch (_) {
      }
      try {
        if (this._dummy2DDepth?.destroy) this._dummy2DDepth.destroy();
      } catch (_) {
      }
      try {
        if (this._dummyHistoryPrev?.destroy) this._dummyHistoryPrev.destroy();
      } catch (_) {
      }
      try {
        if (this._dummyHistoryOut?.destroy) this._dummyHistoryOut.destroy();
      } catch (_) {
      }
      this._bg0Cache.clear();
      this._bg0Keys.length = 0;
      this._bg1Cache.clear();
      this._bg1Keys.length = 0;
      this._render = null;
      this._currentBg0 = null;
      this._currentBg1 = null;
      this._canvasStates = /* @__PURE__ */ new WeakMap();
      this._ctxCache = /* @__PURE__ */ new WeakMap();
      this._renderBgCache = /* @__PURE__ */ new WeakMap();
      this._renderBundleCache = /* @__PURE__ */ new WeakMap();
      this._upsampleBgCache.clear();
      this._lastSums.clear();
    }
  };

  // tools/clouds/cloudTest.worker.js
  var device = null;
  var queue = null;
  var nb = null;
  var cb = null;
  var canvasMain = null;
  var ctxMain = null;
  var dbg = { weather: null, weatherG: null, shapeR: null, detailR: null, blue: null };
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
    weather: { arrayView: null, dirty: false },
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
  var emaFps = null;
  var shapeScrollPos = [0, 0, 0];
  var shapeScrollVel = [0.2, 0, 0];
  var detailScrollPos = [0, 0, 0];
  var detailScrollVel = [-0.02, 0, 0];
  var shapeScale = 0.1;
  var detailScale = 1;
  var renderBundleCache = /* @__PURE__ */ new Map();
  var log = (...a) => postMessage({ type: "log", data: a });
  async function ensureDevice() {
    if (device) return;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("No suitable GPU adapter (worker)");
    device = await adapter.requestDevice();
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
    const format = cb?._ensureRenderPipeline?.("bgra8unorm")?.format ?? "bgra8unorm";
    ctxMain.configure({ device, format, alphaMode: "opaque", size: [MAIN_W, MAIN_H] });
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
  async function bakeWeather2D(weatherParams = {}, force = false, billowParams = {}) {
    if (noise.weather.arrayView && !force && !noise.weather.dirty) {
      if (dbg.weather) nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weather, { preserveCanvasSize: true, clear: true, channel: 1, width: DBG_W, height: DBG_H });
      if (dbg.weatherG) nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weatherG, { preserveCanvasSize: true, clear: true, channel: 2, width: DBG_W, height: DBG_H });
      noise.weather.dirty = false;
      return { baseMs: 0, gMs: 0, totalMs: 0 };
    }
    const T0 = performance.now();
    const WEATHER_DROP = /* @__PURE__ */ new Set(["mode"]);
    const baseMode = sanitizeEntry(weatherParams.mode, "computeFBM", { require4D: false });
    const baseParamsRaw = stripKeys(weatherParams, WEATHER_DROP);
    const baseParams = withToroidalFromMode(baseParamsRaw, baseMode);
    maybeApplySeedToPermTable(baseParams);
    const t0 = performance.now();
    const baseView = await nb.computeToTexture(
      WEATHER_W,
      WEATHER_H,
      baseParams,
      { noiseChoices: ["clearTexture", baseMode], outputChannel: 1, textureKey: "weather2d", viewDimension: "2d-array" }
    );
    const baseMs = performance.now() - t0;
    const G_DROP = /* @__PURE__ */ new Set(["mode", "enabled"]);
    const enabledG = !!(billowParams && billowParams.enabled === true);
    let gMs = 0;
    if (enabledG) {
      const gMode = sanitizeEntry(billowParams.mode, "computeBillow", { require4D: false });
      const gParamsRaw = stripKeys(billowParams, G_DROP);
      const gParams = withToroidalFromMode(gParamsRaw, gMode);
      maybeApplySeedToPermTable(gParams);
      const tg0 = performance.now();
      await nb.computeToTexture(
        WEATHER_W,
        WEATHER_H,
        gParams,
        { noiseChoices: ["clearTexture", gMode], outputChannel: 2, textureKey: "weather2d", viewDimension: "2d-array" }
      );
      gMs = performance.now() - tg0;
    } else {
      const tc0 = performance.now();
      await nb.computeToTexture(WEATHER_W, WEATHER_H, { zoom: 1 }, { noiseChoices: ["clearTexture"], outputChannel: 2, textureKey: "weather2d", viewDimension: "2d-array" });
      gMs = performance.now() - tc0;
    }
    noise.weather.arrayView = (typeof nb.get2DView === "function" ? nb.get2DView("weather2d", { dimension: "2d-array" }) : baseView) || baseView;
    noise.weather.dirty = false;
    if (noise.weather.arrayView) {
      if (dbg.weather) nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weather, { preserveCanvasSize: true, clear: true, channel: 1, width: DBG_W, height: DBG_H });
      if (dbg.weatherG) nb.renderTextureToCanvas(noise.weather.arrayView, dbg.weatherG, { preserveCanvasSize: true, clear: true, channel: 2, width: DBG_W, height: DBG_H });
    }
    const totalMs = performance.now() - T0;
    log("[BENCH] weather base(ms):", baseMs.toFixed(2), " g(ms):", gMs.toFixed(2), " total(ms):", totalMs.toFixed(2), " baseMode:", baseMode, " gEnabled:", enabledG);
    return { baseMs, gMs, totalMs };
  }
  async function bakeBlue2D(blueParams = {}, force = false) {
    maybeApplySeedToPermTable(blueParams);
    if (noise.blue.arrayView && !force && !noise.blue.dirty) {
      noise.blue.dirty = false;
      if (dbg.blue) nb.renderTextureToCanvas(noise.blue.arrayView, dbg.blue, { preserveCanvasSize: true, clear: true, width: DBG_W, height: DBG_H });
      return { blueMs: 0, totalMs: 0 };
    }
    const T0 = performance.now();
    const t0 = performance.now();
    const arrView = await nb.computeToTexture(BN_W, BN_H, blueParams, { noiseChoices: ["clearTexture", "computeBlueNoise"], outputChannel: 0 });
    const blueMs = performance.now() - t0;
    noise.blue.arrayView = arrView;
    noise.blue.dirty = false;
    if (dbg.blue) nb.renderTextureToCanvas(arrView, dbg.blue, { preserveCanvasSize: true, clear: true, width: DBG_W, height: DBG_H });
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
    await nb.computeToTexture3D(
      SHAPE_SIZE,
      SHAPE_SIZE,
      SHAPE_SIZE,
      baseParams,
      { noiseChoices: baseChoices, outputChannel: 1, id: "shape128" }
    );
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
        { noiseChoices: ["clearTexture", b.mode], outputChannel: b.ch, id: "shape128" }
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
        { noiseChoices: ["clearTexture", b.mode], outputChannel: b.ch, id: "detail32" }
      );
      bandsMs.push(performance.now() - tb0);
    }
    noise.detail32.view3D = nb.get3DView("detail32");
    noise.detail32.dirty = false;
    if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
    renderDebugSlices();
    const totalMs = performance.now() - T0;
    log("[BENCH] detail bands(ms):", bandsMs.map((x) => x.toFixed(2)).join(", "), " total(ms):", totalMs.toFixed(2), " modes:", `${m1},${m2},${m3}`);
    return { bandsMs, totalMs };
  }
  function ensureHistoryTextures(w, h, layers = 1) {
    if (historyAllocated && historyTexWidth === w && historyTexHeight === h && historyTexLayers === layers) return;
    historyTexWidth = w;
    historyTexHeight = h;
    historyTexLayers = layers;
    try {
      historyTexA?.destroy?.();
    } catch (_) {
    }
    try {
      historyTexB?.destroy?.();
    } catch (_) {
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
  function applyTileTransforms(tt, opts = {}) {
    if (!tt || typeof tt !== "object") return;
    const allowPositions = !!opts.allowPositions || !!tt.explicit;
    const allowScale = opts.allowScale !== void 0 ? !!opts.allowScale : true;
    const allowVel = opts.allowVel !== void 0 ? !!opts.allowVel : true;
    const additive = !!opts.additive || !!tt.additive;
    const readVec3 = (v) => {
      if (!Array.isArray(v)) return null;
      const x = Number(v[0]);
      const y = Number(v[1]);
      const z = Number(v[2] ?? 0);
      if ([x, y, z].some((n) => Number.isNaN(n))) return null;
      return [x, y, z];
    };
    if (allowPositions) {
      const shapeOff = readVec3(tt.shapeOffset);
      if (shapeOff) {
        if (additive) {
          shapeScrollPos[0] += shapeOff[0];
          shapeScrollPos[1] += shapeOff[1];
          shapeScrollPos[2] += shapeOff[2];
        } else {
          shapeScrollPos = shapeOff;
        }
      }
      const detailOff = readVec3(tt.detailOffset);
      if (detailOff) {
        if (additive) {
          detailScrollPos[0] += detailOff[0];
          detailScrollPos[1] += detailOff[1];
          detailScrollPos[2] += detailOff[2];
        } else {
          detailScrollPos = detailOff;
        }
      }
    }
    if (allowScale && tt.shapeScale !== void 0) {
      const v = Number(tt.shapeScale);
      if (!Number.isNaN(v)) shapeScale = v;
    }
    if (allowScale && tt.detailScale !== void 0) {
      const v = Number(tt.detailScale);
      if (!Number.isNaN(v)) detailScale = v;
    }
    if (allowVel) {
      const sVel = readVec3(tt.shapeVel);
      if (sVel) shapeScrollVel = sVel;
      const dVel = readVec3(tt.detailVel);
      if (dVel) detailScrollVel = dVel;
    }
    if (cb) {
      cb._bg0Dirty = cb._bg1Dirty = true;
    }
  }
  function normalizeReproj(r) {
    if (!r) return null;
    const out = {
      enabled: (r.enabled ? 1 : 0) >>> 0,
      subsample: (r.subsample ? r.subsample >>> 0 : 0) >>> 0,
      sampleOffset: (r.sampleOffset ? r.sampleOffset >>> 0 : 0) >>> 0,
      motionIsNormalized: (r.motionIsNormalized ? 1 : 0) >>> 0,
      temporalBlend: typeof r.temporalBlend === "number" ? r.temporalBlend : 0,
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
    const bundleKey = makeRenderBundleKey(pipe, bg, samp, cb.renderParams, cb.outView);
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
    if (changed) {
      workerTuningVersion = workerTuningVersion + 1 >>> 0;
    }
  }
  function applyWorkerTuning() {
    if (!workerTuning) return false;
    if (workerTuningVersion === lastAppliedTuningVersion) return false;
    try {
      if (cb && typeof cb.setTuning === "function") {
        cb.setTuning(Object.assign({}, workerTuning));
        if (cb._bg0Dirty !== void 0) cb._bg0Dirty = true;
        lastAppliedTuningVersion = workerTuningVersion;
        if (typeof workerTuning.lodBiasWeather === "number" && typeof cb?.setPerfParams === "function") {
          cb.setPerfParams({ lodBiasMul: workerTuning.lodBiasWeather, coarseMipBias: 0 });
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
  function payloadHasTuning(obj) {
    return !!(obj && obj.tuning && typeof obj.tuning === "object");
  }
  async function runFrame({
    weatherParams,
    billowParams,
    shapeParams,
    detailParams,
    tileTransforms,
    preview,
    cloudParams,
    reproj = null,
    perf = null,
    motionImage = null,
    depthImage = null,
    coarseFactor = 1
  } = {}) {
    await ensureDevice();
    try {
      lastRunPayload = { weatherParams, billowParams, shapeParams, detailParams, tileTransforms, preview, cloudParams, reproj, perf, motionImage, depthImage, coarseFactor };
    } catch {
    }
    if (tileTransforms) {
      applyTileTransforms(tileTransforms, {
        allowPositions: !!tileTransforms.explicit,
        allowScale: true,
        allowVel: true,
        additive: !!tileTransforms.additive
      });
    }
    if (reproj) workerReproj = normalizeReproj(reproj);
    if (perf) workerPerf = perf;
    if (payloadHasTuning(arguments[0])) mergeTuningPatch(arguments[0].tuning);
    applyWorkerTuning();
    if (!noise.weather.arrayView) await bakeWeather2D(weatherParams, true, billowParams);
    if (!noise.blue.arrayView) await bakeBlue2D({}, true);
    if (!noise.shape128.view3D) await bakeShape128(shapeParams, true);
    if (!noise.detail32.view3D) await bakeDetail32(detailParams, true);
    cb.setInputMaps({
      weatherView: noise.weather.arrayView,
      blueView: noise.blue.arrayView,
      shape3DView: noise.shape128.view3D,
      detail3DView: noise.detail32.view3D
    });
    cb.setTileScaling?.({ shapeOffsetWorld: shapeScrollPos, detailOffsetWorld: detailScrollPos, shapeScale, detailScale });
    const useReproj = reproj && reproj.enabled || workerReproj && workerReproj.enabled;
    if (useReproj) {
      if (!workerReproj && reproj) workerReproj = normalizeReproj(reproj);
      if (motionImage) {
        try {
          motionTex?.destroy?.();
          motionTex = device.createTexture({ size: [motionImage.width, motionImage.height, 1], format: "rg8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
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
          depthTex = device.createTexture({ size: [depthImage.width, depthImage.height, 1], format: "r8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
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
      if (workerReproj) cb.setReprojSettings(workerReproj);
      cb._bg0Dirty = true;
      cb._bg1Dirty = true;
    } else {
      cb.setInputMaps({ motionView: void 0, depthPrevView: void 0, historyPrevView: void 0 });
      cb.setHistoryOutView(null);
      cb._bg1Dirty = true;
      cb._bg0Dirty = true;
    }
    cb.setBox({ center: [0, 0, 0], half: [1, 0.3, 1], uvScale: 1 });
    cb.setParams(cloudParams || {});
    const deg2rad = (d) => d * Math.PI / 180;
    const yaw = deg2rad(preview?.cam?.yawDeg || 0), pit = deg2rad(preview?.cam?.pitchDeg || 0);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
    const fwd = norm([sy * cp, sp, cy * cp]);
    const upRef = Math.abs(dot(fwd, [0, 1, 0])) > 0.999 ? [0, 0, 1] : [0, 1, 0];
    const right = norm(cross(upRef, fwd));
    const up = cross(fwd, right);
    const aspect = Math.max(1e-6, MAIN_W / Math.max(1, MAIN_H));
    const sAz = deg2rad(preview?.sun?.azDeg || 0), sEl = deg2rad(preview?.sun?.elDeg || 0), cel = Math.cos(sEl);
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
    cb.setLight({ sunDir, camPos: [preview?.cam?.x || 0, preview?.cam?.y || 0, preview?.cam?.z || 0] });
    cb.setOptions({ writeRGB: true, outputChannel: 0, debugForceFog: 0 });
    if (!useReproj) cb.createOutputTexture(MAIN_W, MAIN_H, 1);
    const tAll0 = performance.now();
    if (typeof queue.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
    const tC0 = performance.now();
    const cf = Math.max(1, coarseFactor | 0);
    await cb.dispatch({ coarseFactor: cf });
    if (typeof queue.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
    else await new Promise((r) => setTimeout(r, 8));
    const tC1 = performance.now();
    if (useReproj && historyAllocated) {
      historyPrevView = historyOutView;
      historyUsesAasOut = !historyUsesAasOut;
      historyOutView = historyUsesAasOut ? historyViewA : historyViewB;
      cb.setInputMaps({ historyPrevView });
      cb.setHistoryOutView(historyOutView);
      cb._bg1Dirty = cb._bg0Dirty = true;
    }
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
      sunBloom: preview?.sun?.bloom || 0
    });
    const { bundle } = getOrCreateRenderBundle(pipe, bgl, samp, format);
    const enc = device.createCommandEncoder();
    const tex = ctxMain.getCurrentTexture();
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: tex.createView(),
        loadOp: "clear",
        clearValue: { r: preview?.sky?.[0] ?? 0.5, g: preview?.sky?.[1] ?? 0.6, b: preview?.sky?.[2] ?? 0.8, a: 1 },
        storeOp: "store"
      }]
    });
    pass.executeBundles([bundle]);
    pass.end();
    queue.submit([enc.finish()]);
    const tR0 = performance.now();
    if (typeof queue.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
    else await new Promise((r) => setTimeout(r, 8));
    const tR1 = performance.now();
    const tAll1 = performance.now();
    const timings = { computeMs: tC1 - tC0, renderMs: tR1 - tR0, totalMs: tAll1 - tAll0 };
    log("[BENCH] compute(waited, ms):", timings.computeMs.toFixed(2), " render(waited, ms):", timings.renderMs.toFixed(2), " total(ms):", timings.totalMs.toFixed(2), " coarseFactor:", cf);
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
      if (workerReproj && workerReproj.enabled) {
        workerReproj = normalizeReproj(workerReproj);
        if (!workerReproj.frameIndex) workerReproj.frameIndex = 0;
      }
      while (loopEnabled) {
        const t0 = performance.now();
        try {
          const dt = Math.max(0, (t0 - prevTime) / 1e3);
          prevTime = t0;
          shapeScrollPos[0] += shapeScrollVel[0] * dt;
          shapeScrollPos[1] += shapeScrollVel[1] * dt;
          shapeScrollPos[2] += shapeScrollVel[2] * dt;
          detailScrollPos[0] += detailScrollVel[0] * dt;
          detailScrollPos[1] += detailScrollVel[1] * dt;
          detailScrollPos[2] += detailScrollVel[2] * dt;
          if (workerReproj && workerReproj.enabled) {
            const ss = Math.max(1, workerReproj.subsample || 1);
            const cells = ss * ss;
            workerReproj.frameIndex = (workerReproj.frameIndex || 0) + 1 >>> 0;
            workerReproj.sampleOffset = workerReproj.frameIndex % cells >>> 0;
            try {
              cb?.setReprojSettings?.(workerReproj);
              if (workerPerf) cb?.setPerfParams?.(workerPerf);
              if (cb) cb._bg0Dirty = cb._bg1Dirty = true;
            } catch (e) {
              console.warn("startLoop reproj apply failed", e);
            }
          }
          if (workerTuningVersion !== lastAppliedTuningVersion) applyWorkerTuning();
          if (lastRunPayload) {
            lastRunPayload.tileTransforms = Object.assign({}, lastRunPayload.tileTransforms || {}, {
              shapeOffset: shapeScrollPos.slice(0, 3),
              detailOffset: detailScrollPos.slice(0, 3),
              shapeVel: shapeScrollVel.slice(0, 3),
              detailVel: detailScrollVel.slice(0, 3),
              shapeScale,
              detailScale
            });
          }
          const timings = await runFrame(lastRunPayload);
          const frameTime = performance.now() - t0 || timings.totalMs || 1;
          const fpsInst = 1e3 / frameTime;
          emaFps = emaFps === null ? fpsInst : emaFps * 0.92 + fpsInst * 0.08;
          postMessage({ type: "frame", data: { timings, fps: emaFps, frameTime } });
        } catch (err) {
          postMessage({ type: "log", data: ["animation loop error", String(err)] });
        }
        await Promise.resolve();
      }
      loopRunning = false;
      log("animation loop stopped");
      postMessage({ type: "loop-stopped" });
    })();
  }
  function stopLoop() {
    loopEnabled = false;
  }
  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function norm(a) {
    const L = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / L, a[1] / L, a[2] / L];
  }
  function toVec3(a) {
    if (!Array.isArray(a)) return null;
    const x = Number(a[0]) || 0;
    const y = Number(a[1]) || 0;
    const z = a.length >= 3 ? Number(a[2]) || 0 : 0;
    return [x, y, z];
  }
  self.onmessage = async (ev) => {
    const { id, type, payload } = ev.data || {};
    const respond = (ok, dataOrErr) => postMessage({ id, ok, ...ok ? { data: dataOrErr } : { error: String(dataOrErr) } });
    try {
      if (type === "init") {
        const { canvases, constants } = payload;
        canvasMain = canvases.main;
        dbg.weather = canvases.dbg.weather;
        dbg.weatherG = canvases.dbg.weatherG;
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
        respond(true, { ok: true, entryPoints: Array.isArray(nb?.entryPoints) ? nb.entryPoints.slice() : [] });
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
        if (ctxMain) ctxMain.configure({ device, format: cb?._ensureRenderPipeline?.("bgra8unorm")?.format ?? "bgra8unorm", alphaMode: "opaque", size: [MAIN_W, MAIN_H] });
        respond(true, { ok: true });
        return;
      }
      if (type === "bakeWeather") {
        await ensureDevice();
        const timings = await bakeWeather2D(payload.weatherParams || {}, true, payload.billowParams || {});
        respond(true, { baked: "weather", timings });
        return;
      }
      if (type === "bakeBlue") {
        await ensureDevice();
        const timings = await bakeBlue2D(payload.blueParams || {}, true);
        respond(true, { baked: "blue", timings });
        return;
      }
      if (type === "bakeShape") {
        await ensureDevice();
        if (payload?.tileTransforms) applyTileTransforms(payload.tileTransforms, { allowPositions: !!payload.tileTransforms.explicit, allowScale: true, allowVel: true, additive: !!payload.tileTransforms.additive });
        noise.shape128.dirty = true;
        const timings = await bakeShape128(payload.shapeParams || {}, true);
        respond(true, { baked: "shape128", timings });
        return;
      }
      if (type === "bakeDetail") {
        await ensureDevice();
        if (payload?.tileTransforms) applyTileTransforms(payload.tileTransforms, { allowPositions: !!payload.tileTransforms.explicit, allowScale: true, allowVel: true, additive: !!payload.tileTransforms.additive });
        noise.detail32.dirty = true;
        const timings = await bakeDetail32(payload.detailParams || {}, true);
        respond(true, { baked: "detail32", timings });
        return;
      }
      if (type === "bakeAll") {
        await ensureDevice();
        const t0 = performance.now();
        if (payload?.tileTransforms) applyTileTransforms(payload.tileTransforms, { allowPositions: !!payload.tileTransforms.explicit, allowScale: true, allowVel: true, additive: !!payload.tileTransforms.additive });
        const weather = await bakeWeather2D(payload.weatherParams || {}, true, payload.billowParams || {});
        const blue = await bakeBlue2D(payload.blueParams || {}, true);
        const shape = await bakeShape128(payload.shapeParams || {}, true);
        const detail = await bakeDetail32(payload.detailParams || {}, true);
        const t1 = performance.now();
        respond(true, { baked: "all", timings: { weather, blue, shape, detail, totalMs: t1 - t0 } });
        return;
      }
      if (type === "setTileTransforms") {
        await ensureDevice();
        try {
          applyTileTransforms(payload?.tileTransforms || {}, { allowPositions: true, allowScale: true, allowVel: true, additive: !!payload?.tileTransforms?.additive });
          try {
            if (lastRunPayload) lastRunPayload.tileTransforms = Object.assign({}, lastRunPayload.tileTransforms || {}, payload?.tileTransforms || {}, { explicit: true });
          } catch {
          }
          if (cb && typeof cb.setTileScaling === "function") {
            cb.setTileScaling({ shapeOffsetWorld: shapeScrollPos, detailOffsetWorld: detailScrollPos, shapeScale, detailScale });
            cb._bg0Dirty = cb._bg1Dirty = true;
          }
          respond(true, { ok: true, tileTransforms: { shapeOffset: shapeScrollPos, detailOffset: detailScrollPos, shapeScale, detailScale, shapeVel: shapeScrollVel, detailVel: detailScrollVel } });
        } catch (err) {
          console.warn("setTileTransforms failed", err);
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
        if (workerReproj && workerReproj.enabled && (workerReproj.frameIndex === 0 || typeof workerReproj.frameIndex === "undefined")) {
          workerReproj.frameIndex = 0;
          workerReproj.sampleOffset = 0;
        }
        if (cb) {
          if (workerPerf) cb.setPerfParams(workerPerf);
          if (workerReproj) {
            cb.setReprojSettings(workerReproj);
            cb._bg0Dirty = true;
          }
        }
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
      if (type === "setShapeScroll" || type === "setDetailScroll" || type === "setScroll") {
        const s = payload?.shape, d = payload?.detail;
        if (type === "setShapeScroll" && payload) {
          const vel3 = toVec3(payload.vel);
          const pos3 = toVec3(payload.pos);
          if (vel3) shapeScrollVel = vel3;
          if (pos3) shapeScrollPos = pos3;
          respond(true, { pos: shapeScrollPos, vel: shapeScrollVel });
          return;
        }
        if (type === "setDetailScroll" && payload) {
          const vel3 = toVec3(payload.vel);
          const pos3 = toVec3(payload.pos);
          if (vel3) detailScrollVel = vel3;
          if (pos3) detailScrollPos = pos3;
          respond(true, { pos: detailScrollPos, vel: detailScrollVel });
          return;
        }
        if (type === "setScroll") {
          if (s) {
            const sVel = toVec3(s.vel);
            const sPos = toVec3(s.pos);
            if (sVel) shapeScrollVel = sVel;
            if (sPos) shapeScrollPos = sPos;
          }
          if (d) {
            const dVel = toVec3(d.vel);
            const dPos = toVec3(d.pos);
            if (dVel) detailScrollVel = dVel;
            if (dPos) detailScrollPos = dPos;
          }
          respond(true, { shape: { pos: shapeScrollPos, vel: shapeScrollVel }, detail: { pos: detailScrollPos, vel: detailScrollVel } });
          return;
        }
      }
      if (type === "runFrame") {
        if (payload?.tuning) {
          mergeTuningPatch(payload.tuning);
        }
        const timings = await runFrame(payload);
        respond(true, { timings });
        return;
      }
      respond(false, new Error("Unknown worker message: " + type));
    } catch (err) {
      console.error(err);
      respond(false, err);
    }
  };
  var cloudTest_worker_default = self;
;if(typeof import_meta !== 'undefined')import_meta.url=location.origin+"/dist/";})();
