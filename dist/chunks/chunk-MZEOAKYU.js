var __create=Object.create;var __defProp=Object.defineProperty;var __getOwnPropDesc=Object.getOwnPropertyDescriptor;var __getOwnPropNames=Object.getOwnPropertyNames;var __getProtoOf=Object.getPrototypeOf;var __hasOwnProp=Object.prototype.hasOwnProperty;var __require=(x=>typeof require!=="undefined"?require:typeof Proxy!=="undefined"?new Proxy(x,{get:(a,b)=>(typeof require!=="undefined"?require:a)[b]}):x)(function(x){if(typeof require!=="undefined")return require.apply(this,arguments);throw Error('Dynamic require of "'+x+'" is not supported')});var __commonJS=(cb,mod)=>function __require2(){try{return mod||(0,cb[__getOwnPropNames(cb)[0]])((mod={exports:{}}).exports,mod),mod.exports}catch(e){throw mod=0,e}};var __copyProps=(to,from,except,desc)=>{if(from&&typeof from==="object"||typeof from==="function"){for(let key of __getOwnPropNames(from))if(!__hasOwnProp.call(to,key)&&key!==except)__defProp(to,key,{get:()=>from[key],enumerable:!(desc=__getOwnPropDesc(from,key))||desc.enumerable})}return to};var __toESM=(mod,isNodeMode,target)=>(target=mod!=null?__create(__getProtoOf(mod)):{},__copyProps(isNodeMode||!mod||!mod.__esModule?__defProp(target,"default",{value:mod,enumerable:true}):target,mod));var noiseCompute_default=`const PI : f32 = 3.141592653589793;\r
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
  sphereOffset : f32,\r
  sphereOffset2 : f32,\r
  sphereBlend : f32,\r
  sphereBlendPhase : f32,\r
  sphereRangeWeight : f32,\r
  spherePolarFade : f32,\r
  sphereLandscape : u32,\r
  sphereLandscapeStrength : f32,\r
  sphereFeatureDensity : f32,\r
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
  edgeK : f32,\r
  scalar : f32,\r
  transform : f32,\r
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
fn rotateXY3(p: vec3<f32>, angle: f32) -> vec3<f32> {\r
  let c = cos(angle);\r
  let s = sin(angle);\r
  return vec3<f32>(\r
    p.x * c - p.y * s,\r
    p.x * s + p.y * c,\r
    p.z\r
  );\r
}\r
\r
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
fn seedOffset3(seed: u32) -> vec3<f32> {\r
  let a = f32((seed * 1664525u + 1013904223u) & 65535u) / 65536.0;\r
  let b = f32((seed * 22695477u + 1u) & 65535u) / 65536.0;\r
  let c = f32((seed * 1103515245u + 12345u) & 65535u) / 65536.0;\r
\r
  return vec3<f32>(\r
    17.173 + a * 131.0,\r
    31.947 + b * 137.0,\r
    47.521 + c * 149.0\r
  );\r
}\r
\r
fn fetchPlanetSpherePos(fx: i32, fy: i32) -> vec3<f32> {\r
  let w = i32(max(frame.fullWidth, 2u));\r
  let h = i32(max(frame.fullHeight, 2u));\r
  let segments = max(w - 1, 1);\r
  let maxLat = max(h - 1, 1);\r
\r
  let lat = clamp(fy, 0, maxLat);\r
  let rawLon = fx;\r
  let lon = ((rawLon % segments) + segments) % segments;\r
\r
  if (lat <= 0) {\r
    // Y-up north pole, matching sphereUVFromWorld() and the Babylon planet.\r
    return vec3<f32>(2.0, 3.0, 2.0);\r
  }\r
\r
  if (lat >= maxLat) {\r
    // Y-up south pole, matching sphereUVFromWorld() and the Babylon planet.\r
    return vec3<f32>(2.0, 1.0, 2.0);\r
  }\r
\r
  let theta = f32(lat) * PI / f32(maxLat);\r
  let phi = f32(lon) * TWO_PI / f32(segments);\r
\r
  let dir=vec3<f32>(sin(theta)*cos(phi),cos(theta),sin(theta)*sin(phi));\r
  return studio_sphere_position(dir,theta,phi);\r
}\r
\r
fn studio_sphere_position(dir:vec3<f32>,theta:f32,phi:f32)->vec3<f32>{\r
  let sinTheta=length(dir.xz);\r
  // The first longitude harmonic is already a smooth tangent displacement.\r
  // Only the second harmonic needs to disappear faster than polar radius.\r
  let offset = options.sphereOffset;\r
  let offset2 = options.sphereOffset2;\r
  let second = vec2<f32>(offset2 * cos(2.0 * phi),offset * sin(2.0 * phi + theta));\r
  var warp=vec3<f32>(offset * sin(phi + theta) + second.x,\r
    offset * cos(theta + phi) + offset2 * sin(2.0 * theta),\r
    second.y + offset2 * cos(2.0 * theta + phi));\r
  if(options.spherePolarFade>0.0){\r
    let fade=1.0-smoothstep(0.0,options.spherePolarFade,sinTheta);\r
    warp-=fade*vec3<f32>(second.x,0.0,second.y);\r
  }\r
  return dir+2.0+sinTheta*warp;\r
}\r
\r
\r
fn fetchAuroraCapPos(fx: i32, fy: i32) -> vec3<f32> {\r
  let w = i32(max(frame.fullWidth, 2u));\r
  let h = i32(max(frame.fullHeight, 2u));\r
  let segments = max(w - 1, 1);\r
  let maxRadial = max(h - 1, 1);\r
\r
  let radialIndex = clamp(fy, 0, maxRadial);\r
  let rawLon = fx;\r
  let lon = ((rawLon % segments) + segments) % segments;\r
\r
  let capHalfAngleDeg = max(options.baseRadius, 0.001);\r
  let capHalfAngle = radians(capHalfAngleDeg);\r
  let hemisphere = select(-1.0, 1.0, options.heightScale >= 0.0);\r
\r
  let radial = f32(radialIndex) * capHalfAngle / f32(maxRadial);\r
  let phi = f32(lon) * TWO_PI / f32(segments);\r
\r
  let sinR = sin(radial);\r
  let cosR = cos(radial);\r
  let sinPhi = sin(phi);\r
  let cosPhi = cos(phi);\r
\r
  let x = sinR * cosPhi;\r
  let y = hemisphere * cosR;\r
  let z = sinR * sinPhi;\r
\r
  let capScale = sinR;\r
  let offset = options.sphereOffset;\r
  let offset2 = options.sphereOffset2;\r
\r
  return vec3<f32>(\r
    x + 2.0 + capScale * (offset * sin(phi + radial) + offset2 * cos(2.0 * phi)),\r
    y + 2.0 + capScale * (offset * cos(radial + phi) + offset2 * sin(2.0 * radial)),\r
    z + 2.0 + capScale * (offset * sin(2.0 * phi + radial) + offset2 * cos(2.0 * radial + phi))\r
  );\r
}\r
\r
fn fetchPos(fx: i32, fy: i32, fz: i32) -> vec3<f32> {\r
  if (options.useCustomPos == 2u) {\r
    return fetchPlanetSpherePos(fx, fy);\r
  }\r
\r
  if (options.useCustomPos == 3u) {\r
    return fetchAuroraCapPos(fx, fy);\r
  }\r
\r
  if (options.useCustomPos == 1u) {\r
    let use3D = writeTo3D() || readFrom3D();\r
    let localX = u32(clamp(fx - frame.originX, 0, i32(max(frame.tileWidth, 1u)) - 1));\r
    let localY = u32(clamp(fy - frame.originY, 0, i32(max(frame.tileHeight, 1u)) - 1));\r
    let localZ = u32(max(select(frame.layerIndex, clampZ(fz) - frame.originZ, use3D), 0));\r
    let idx = localZ * frame.tileWidth * frame.tileHeight + localY * frame.tileWidth + localX;\r
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
    let U = (f32(cx) + 0.5) * invW;\r
    let V = (f32(cy) + 0.5) * invH;\r
    let theta = thetaFromDepth(fz);\r
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
  let x = (ox + f32(fx) + 0.5) * invW;\r
  let y = (oy + f32(fy) + 0.5) * invH;\r
\r
  var z: f32;\r
  let uses3D = writeTo3D() || readFrom3D();\r
  if (uses3D) {\r
    if (frame.fullDepth <= 1u) {\r
      z = 0.0;\r
    } else {\r
      z = (f32(clampZ(fz)) + 0.5) / f32(frame.fullDepth);\r
    }\r
  } else {\r
    z = layerToZ(frame.layerIndex, frame.layers);\r
  }\r
\r
  return vec3<f32>(x, y, z);\r
}\r
\r
\r
\r
fn writeChannel(fx:i32, fy:i32, fz:i32, v0:f32, channel:u32, overwrite:u32) {\r
  if (!writeTo3D()) {\r
    if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) { return; }\r
  }\r
\r
  var v = v0 * params.scalar + params.transform;\r
  if(options.useCustomPos==2u && options.sphereBlend>0.0){\r
    v*=studio_layer_mask(fetchPos(fx,fy,fz));\r
  }\r
  let needsAccum = (overwrite == 0u);\r
  let writesAll = (channel == 0u);\r
  let skipRead = (!needsAccum) && (writesAll || channel == 5u);\r
  var inCol = vec4<f32>(0.0);\r
  if (!skipRead) { inCol = loadPrevRGBA(fx, fy, fz); }\r
  var outCol = inCol;\r
\r
  if (channel == 0u)      { let h = select(v + inCol.x, v, overwrite == 1u); outCol = vec4<f32>(h, h, h, h); }\r
  else if (channel == 1u) { let h = select(v + inCol.x, v, overwrite == 1u); outCol.x = h; }\r
  else if (channel == 2u) { let h = select(v + inCol.y, v, overwrite == 1u); outCol.y = h; }\r
  else if (channel == 3u) { let h = select(v + inCol.z, v, overwrite == 1u); outCol.z = h; }\r
  else if (channel == 4u) { let h = select(v + inCol.w, v, overwrite == 1u); outCol.w = h; }\r
  else if (channel == 5u) { let p = fetchPos(fx, fy, fz); let h = select(v + inCol.w, v, overwrite == 1u); outCol = vec4<f32>(p.x, p.y, p.z, h); }\r
  else if (channel == 6u) { let p = fetchPos(fx, fy, fz); let h = select(v + inCol.w, v, overwrite == 1u); outCol = vec4<f32>(p.x, p.y, h, inCol.w); }\r
\r
  storeRGBA(fx, fy, fz, outCol);\r
}\r
\r
fn studio_layer_mask(p:vec3<f32>)->f32{\r
  let phase=options.sphereBlendPhase;\r
  let province=simplex3D(p*3.1+vec3<f32>(phase,-.51*phase,1.31*phase));\r
  let mask=mix(.36,1.0,smoothstep(-.55,.32,province));\r
  return mix(1.0,mask,clamp(options.sphereBlend,0.0,1.0));\r
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
struct Voro3DMetrics { f1Sq: f32, f2Sq: f32, cellVal: f32, };\r
struct Voro4DMetrics { f1Sq: f32, f2Sq: f32, cellVal: f32, };\r
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
fn voro_eval3D_metrics(m: Voro3DMetrics, params: NoiseParams, freqOrScale: f32) -> f32 {\r
  return voro_eval(\r
    m.f1Sq,\r
    m.f2Sq,\r
    m.cellVal,\r
    params.voroMode,\r
    max(params.edgeK, 0.0),\r
    max(params.threshold, 0.0),\r
    freqOrScale\r
  );\r
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
  let zoom = max(p.zoom, 1e-6);\r
  let freq = max(p.freq, 1e-6);\r
  let base = pos / zoom + vec2<f32>(p.xShift, p.yShift);\r
  let q = base * freq;\r
\r
  // choose \u03B5 ~ half a cycle of current scale to avoid lattice aliasing\r
  let cycles_per_world = max(freq / zoom, 1e-6);\r
  let eps = 0.5 / cycles_per_world;\r
\r
  let g = gradSimplex2(q, eps * freq);\r
  return vec2<f32>(g.y, -g.x);\r
}\r
\r
/* multi-octave curl: sum derivatives per octave (no sharp creases) */\r
fn curl2_simplexFBM(pos: vec2<f32>, p: NoiseParams) -> vec2<f32> {\r
  let zoom = max(p.zoom, 1e-6);\r
  var q      = pos / zoom + vec2<f32>(p.xShift, p.yShift);\r
  var freq   : f32 = max(p.freq, 1e-6);\r
  var amp    : f32 = 1.0;\r
  var angle  : f32 = p.seedAngle;\r
  var curl   : vec2<f32> = vec2<f32>(0.0);\r
\r
  for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {\r
    // \u03B5 scales with octave so the finite difference stays well-conditioned\r
    let cycles_per_world = max(freq / zoom, 1e-6);\r
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
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 gabor utils \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
\r
const TAU : f32 = 6.283185307179586;\r
\r
fn saturate(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }\r
\r
fn hash_u32(x: u32) -> u32 {\r
  var v = x;\r
  v = (v ^ 61u) ^ (v >> 16u);\r
  v = v + (v << 3u);\r
  v = v ^ (v >> 4u);\r
  v = v * 0x27d4eb2du;\r
  v = v ^ (v >> 15u);\r
  return v;\r
}\r
\r
fn hash3_u32(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> u32 {\r
  let x = u32(ix) * 73856093u;\r
  let y = u32(iy) * 19349663u;\r
  let z = u32(iz) * 83492791u;\r
  return hash_u32(x ^ y ^ z ^ seed ^ salt);\r
}\r
\r
fn rnd01(h: u32) -> f32 {\r
  return f32(h) * (1.0 / 4294967295.0);\r
}\r
\r
fn rand3_01(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> f32 {\r
  return rnd01(hash3_u32(ix, iy, iz, seed, salt));\r
}\r
\r
fn rand3_vec3(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> vec3<f32> {\r
  let a = rand3_01(ix, iy, iz, seed, salt + 0u);\r
  let b = rand3_01(ix, iy, iz, seed, salt + 1u);\r
  let c = rand3_01(ix, iy, iz, seed, salt + 2u);\r
  return vec3<f32>(a, b, c);\r
}\r
\r
fn rand_unit_vec3(ix: i32, iy: i32, iz: i32, seed: u32, salt: u32) -> vec3<f32> {\r
  let u = rand3_01(ix, iy, iz, seed, salt + 0u);\r
  let v = rand3_01(ix, iy, iz, seed, salt + 1u);\r
\r
  let z = 1.0 - 2.0 * u;\r
  let r = sqrt(max(0.0, 1.0 - z * z));\r
  let a = TAU * v;\r
\r
  return vec3<f32>(r * cos(a), r * sin(a), z);\r
}\r
\r
fn gabor_kernel3D(d: vec3<f32>, dir: vec3<f32>, waveFreq: f32, sigma: f32, phase: f32) -> f32 {\r
  let s  = max(0.0005, sigma);\r
  let g  = exp(-dot(d, d) / (2.0 * s * s));\r
  let w  = cos(TAU * waveFreq * dot(dir, d) + phase);\r
  return g * w;\r
}\r
\r
fn gaborWarpDomain(p: vec3<f32>, params: NoiseParams) -> vec3<f32> {\r
  let a = params.warpAmp;\r
  if (a <= 0.00001) { return p; }\r
\r
  let w1 = simplex3D(p * 0.75 + vec3<f32>(13.1, 7.7, 19.3));\r
  let w2 = simplex3D(p * 0.75 + vec3<f32>(41.7, 23.9, 5.3));\r
  let w3 = simplex3D(p * 0.75 + vec3<f32>(9.9, 31.3, 17.7));\r
\r
  return p + vec3<f32>(w1, w2, w3) * a;\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Gabor sparse-convolution  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn gaborOctave3D(p: vec3<f32>, waveFreq: f32, sigma: f32, params: NoiseParams) -> f32 {\r
  let base = vec3<i32>(\r
    i32(floor(p.x)),\r
    i32(floor(p.y)),\r
    i32(floor(p.z))\r
  );\r
\r
  var sum: f32 = 0.0;\r
\r
  for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {\r
    for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {\r
      for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {\r
        let cx = base.x + dx;\r
        let cy = base.y + dy;\r
        let cz = base.z + dz;\r
\r
        let jitter = rand3_vec3(cx, cy, cz, params.seed, 11u) - vec3<f32>(0.5, 0.5, 0.5);\r
        let center = vec3<f32>(f32(cx), f32(cy), f32(cz)) + vec3<f32>(0.5, 0.5, 0.5) + jitter * 0.95;\r
\r
        let d     = p - center;\r
        let dir   = rand_unit_vec3(cx, cy, cz, params.seed, 41u);\r
        let phase = TAU * rand3_01(cx, cy, cz, params.seed, 71u);\r
        let amp   = rand3_01(cx, cy, cz, params.seed, 91u) * 2.0 - 1.0;\r
\r
        sum += amp * gabor_kernel3D(d, dir, waveFreq, sigma, phase);\r
      }\r
    }\r
  }\r
\r
  return sum * (1.0 / 9.0);\r
}\r
\r
fn gaborShape(n: f32, params: NoiseParams) -> f32 {\r
  var v = 0.5 + 0.5 * clamp(n, -1.0, 1.0);\r
\r
  let widen = max(0.0, params.gaborRadius) * max(0.0001, params.exp2);\r
  v = pow(saturate(v), 1.0 / (1.0 + widen));\r
\r
  let t    = saturate(params.threshold);\r
  let hard = max(0.0001, params.exp1);\r
\r
  let a = smoothstep(t - hard, t + hard, v);\r
  return a * 2.0 - 1.0;\r
}\r
\r
fn gaborCellEdgeMask2D(cellP: vec2<f32>, edgeK: f32) -> f32 {\r
  let k = max(0.0, edgeK);\r
  if (k <= 0.00001) { return 1.0; }\r
\r
  let width = select(k, 0.5 / k, k > 0.5);\r
  let w = clamp(width, 0.00001, 0.5);\r
\r
  let f  = fract(cellP);\r
  let dx = min(f.x, 1.0 - f.x);\r
  let dy = min(f.y, 1.0 - f.y);\r
  let d  = min(dx, dy);\r
\r
  return smoothstep(0.0, w, d);\r
}\r
\r
/* Multi-octave Gabor with per-octave cell-edge fade */\r
fn gaborNoise3D(p: vec3<f32>, params: NoiseParams) -> f32 {\r
  var x = p.x / params.zoom + params.xShift;\r
  var y = p.y / params.zoom + params.yShift;\r
  var z = p.z / params.zoom + params.zShift;\r
\r
  var sum     : f32 = 0.0;\r
  var amp     : f32 = 1.0;\r
  var freqLoc : f32 = max(params.freq, 1e-6);\r
  var angle   : f32 = params.seedAngle;\r
\r
  let waveFreq = max(0.001, params.rippleFreq);\r
\r
  var minMask : f32 = 1.0;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let sigma = max(0.0005, params.gaborRadius);\r
\r
    var pp = vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc);\r
    pp = gaborWarpDomain(pp, params);\r
\r
    let edgeM = gaborCellEdgeMask2D(pp.xy, params.edgeK);\r
    minMask = min(minMask, edgeM);\r
\r
    var n = gaborOctave3D(pp, waveFreq, sigma, params);\r
\r
    if (params.turbulence == 1u) {\r
      n = abs(n) * edgeM;\r
    } else {\r
      n = (-1.0) + (n + 1.0) * edgeM;\r
    }\r
\r
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
  if (params.turbulence == 1u) {\r
    sum = mix(-1.0, sum, minMask);\r
  }\r
\r
  var out = gaborShape(sum, params);\r
  if (params.turbulence == 1u) { out = out - 1.0; }\r
  return out;\r
}\r
\r
fn gaborFlowKernel3D(r: vec3<f32>, d: vec2<f32>, ex: f32, ey: f32, ez: f32, c: f32, phase: f32) -> f32 {\r
  let rx = dot(r.xy, d);\r
  let ry = dot(r.xy, vec2<f32>(d.y, -d.x));\r
  let g  = exp(ex * rx * rx + ey * ry * ry + ez * r.z * r.z);\r
  let w  = cos(c * rx + phase);\r
  return g * w;\r
}\r
\r
fn gaborMagicNoise3D(p: vec3<f32>, par: NoiseParams) -> f32 {\r
  let sizeF = select(12.0, par.terraceStep, par.terraceStep > 0.00001);\r
  let size  = max(1, i32(clamp(sizeF, 1.0, 48.0) + 0.5));\r
\r
  let zRad  = i32(2u);\r
\r
  let sig = max(0.0005, par.gaborRadius);\r
  let gam = max(0.0001, par.exp2);\r
\r
  let sx = sig;\r
  let sy = sig / gam;\r
  let sz = sig;\r
\r
  let ex = -0.5 / (sx * sx);\r
  let ey = -0.5 / (sy * sy);\r
  let ez = -0.5 / (sz * sz);\r
\r
  let lam = max(0.001, par.rippleFreq);\r
  let c   = TAU / lam;\r
\r
  let P = 0.1963495408; // PI/16\r
\r
  var cs: array<vec2<f32>, 16>;\r
  var ph: array<f32, 16>;\r
  var acc: array<f32, 16>;\r
\r
  for (var k: u32 = 0u; k < 16u; k = k + 1u) {\r
    acc[k] = 0.0;\r
    let a = f32(k) * P;\r
    cs[k] = vec2<f32>(cos(a), sin(a));\r
    ph[k] = TAU * rand3_01(i32(k), 0, 0, par.seed, 71u);\r
  }\r
\r
  let base = vec3<f32>(\r
    p.x / par.zoom + par.xShift,\r
    p.y / par.zoom + par.yShift,\r
    p.z / par.zoom + par.zShift\r
  );\r
\r
  let adv = vec3<f32>(par.time * 10.0, par.time * 10.0, par.time * 3.0);\r
\r
  let seedOff = vec3<f32>(\r
    f32(par.seed & 1023u) * 23.17,\r
    f32((par.seed >> 10u) & 1023u) * 19.73,\r
    f32((par.seed >> 20u) & 1023u) * 17.11\r
  );\r
\r
  let fscale = 0.1 * max(0.0001, par.freq);\r
\r
  let phaseT = TAU * (par.time / lam);\r
\r
  for (var dz: i32 = -zRad; dz <= zRad; dz = dz + 1) {\r
    for (var j: i32 = -size; j <= size; j = j + 1) {\r
      for (var i: i32 = -size; i <= size; i = i + 1) {\r
        let r = vec3<f32>(f32(i), f32(j), f32(dz));\r
\r
        var sp = (base + r + adv + seedOff) * fscale;\r
        sp = gaborWarpDomain(sp, par);\r
\r
        let src = 0.6 * (0.5 + 0.5 * noise3D(sp));\r
\r
        for (var k: u32 = 0u; k < 16u; k = k + 1u) {\r
          acc[k] += src * gaborFlowKernel3D(r, cs[k], ex, ey, ez, c, ph[k] + phaseT);\r
        }\r
      }\r
    }\r
  }\r
\r
  var mx: f32 = 0.0;\r
  for (var k: u32 = 0u; k < 16u; k = k + 1u) {\r
    mx = max(mx, acc[k]);\r
  }\r
\r
  var v01 = saturate((mx / 10.0) * max(0.0001, par.gain));\r
\r
  if (par.threshold > 0.00001) {\r
    let t    = saturate(par.threshold);\r
    let hard = max(0.0001, par.exp1);\r
    v01 = smoothstep(t - hard, t + hard, v01);\r
  }\r
\r
  return v01 * 2.0 - 1.0;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 flow-gabor helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
\r
fn hash2f01(p: vec2<f32>, seed: u32) -> f32 {\r
  let h = sin(dot(p, vec2<f32>(12.9898, 78.233)) + f32(seed) * 0.000123);\r
  return fract(h * 43758.5453);\r
}\r
\r
fn mnoise3D(p: vec3<f32>, mode: u32) -> f32 {\r
  let n = noise3D(p); // ~[-1,1]\r
  if (mode == 1u) { return -1.0 + 2.0 * abs(n); }          // cloud-like\r
  if (mode == 2u) { return -1.0 + 2.0 * (1.0 - abs(n)); }  // flame-like\r
  return n;\r
}\r
\r
fn turb2D(U: vec2<f32>, t: f32, par: NoiseParams) -> f32 {\r
  var u = U;\r
  var tt = t;\r
\r
  var f: f32 = 0.0;\r
  var q: f32 = 1.0;\r
  var s: f32 = 0.0;\r
\r
  let m: f32 = 2.0;\r
  let iters: u32 = clamp(par.octaves, 1u, 4u);\r
\r
  for (var i: u32 = 0u; i < 4u; i = i + 1u) {\r
    if (i >= iters) { break; }\r
\r
    u -= tt * vec2<f32>(0.6, 0.2);\r
    f += q * mnoise3D(vec3<f32>(u, tt), par.voroMode);\r
    s += q;\r
\r
    q *= 0.5;\r
    u *= m;\r
    tt *= 1.71;\r
  }\r
\r
  return f / max(1e-6, s);\r
}\r
\r
fn flowDir2D(U: vec2<f32>, t: f32, par: NoiseParams) -> vec2<f32> {\r
  let eps: f32 = 1e-3;\r
  let S: f32 = max(1e-4, par.freq);\r
\r
  let a = turb2D(S * (U + vec2<f32>(0.0, -eps)), t, par);\r
  let b = turb2D(S * (U + vec2<f32>(0.0,  eps)), t, par);\r
  let c = turb2D(S * (U + vec2<f32>( eps, 0.0)), t, par);\r
  let d = turb2D(S * (U + vec2<f32>(-eps, 0.0)), t, par);\r
\r
  var V = vec2<f32>((a - b), (c - d)) / eps;\r
\r
  let l2 = dot(V, V);\r
  if (l2 < 1e-20) { V = vec2<f32>(1.0, 0.0); }\r
  else { V *= inverseSqrt(l2); }\r
\r
  // optional: rotate into "normal field" (like the shadertoy toggle)\r
  if ((par.voroMode & 4u) != 0u) { V = vec2<f32>(-V.y, V.x); }\r
\r
  return V;\r
}\r
\r
fn gaborPhasorFlow(U: vec2<f32>, V: vec2<f32>, par: NoiseParams) -> vec2<f32> {\r
  let F: f32 = max(1e-4, par.rippleFreq);\r
\r
  let Wf = select(12.0, par.terraceStep, par.terraceStep > 0.00001);\r
  let W  = max(1, i32(clamp(Wf, 1.0, 24.0) + 0.5));\r
\r
  let TG: f32 = par.time * 0.5 * max(0.0, par.warpAmp);\r
\r
  var s: vec2<f32> = vec2<f32>(0.0);\r
  var T: f32 = 0.0;\r
\r
  for (var j: i32 = -W; j <= W; j = j + 1) {\r
    for (var i: i32 = -W; i <= W; i = i + 1) {\r
      let P = vec2<f32>(f32(i), f32(j));\r
\r
      let h = hash2f01(U + P, par.seed);\r
      let ang = TWO_PI * h - F * dot(P, V) + TG;\r
\r
      let v = vec2<f32>(cos(ang), sin(ang));\r
\r
      let d = min(1.0, length(P) / f32(W));\r
      let K = 0.5 + 0.5 * cos(PI * d); // raised-cosine kernel\r
\r
      s += v * K;\r
      T += K;\r
    }\r
  }\r
\r
  return s / max(1e-6, T);\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
\r
fn generateGaborFlow(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  let zoom = max(par.zoom, 1e-6);\r
\r
  // reconstruct pixel-ish domain like shadertoy (centered)\r
  let R = vec2<f32>(max(f32(frame.fullWidth), 1.0), max(f32(frame.fullHeight), 1.0));\r
  let uPix = vec2<f32>(pos.x * R.x, pos.y * R.y);\r
  let Uflow = (uPix - 0.5 * R) / R.y;\r
\r
  // animated flow time\r
  let t = par.time * 0.2;\r
\r
  // flow direction\r
  let V = flowDir2D(Uflow * (1.0 / zoom), t, par);\r
\r
  // gabor phasor (use centered pixel coords like the reference)\r
  let s = gaborPhasorFlow((uPix - 0.5 * R) / zoom, V, par);\r
\r
  // output mode:\r
  //  - turbulence==0: phasor profile (0..1)\r
  //  - turbulence==1: contrast (magnitude)\r
  let l = length(s);\r
  var v01: f32;\r
\r
  if (par.turbulence == 1u) {\r
    v01 = saturate(4.0 * l * max(0.0001, par.gain));\r
  } else {\r
    let nx = select(1.0, s.x / l, l > 1e-8);\r
    v01 = 0.5 + 0.5 * nx;\r
    v01 = saturate(v01 * max(0.0001, par.gain));\r
  }\r
\r
  if (par.threshold > 0.00001) {\r
    let tt = saturate(par.threshold);\r
    let hard = max(0.0001, par.exp1);\r
    v01 = smoothstep(tt - hard, tt + hard, v01);\r
  }\r
\r
  return v01 * 2.0 - 1.0;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 compute entry \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeGaborFlow(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateGaborFlow(p, params), options.outputChannel, 0u);\r
}\r
\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Terrace & Foam filters  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn terrace(v:f32, steps:f32)  -> f32 { return floor(v*steps)/steps; }\r
fn foamify(v: f32) -> f32 {\r
    let x = clamp(v, 0.0, 1.0);\r
\r
    let lo = smoothstep(0.18, 0.48, x);\r
    let hi = 1.0 - smoothstep(0.58, 0.92, x);\r
\r
    let band = clamp(lo * hi, 0.0, 1.0);\r
    return pow(band, 0.6);\r
}\r
fn turbulence(v:f32)          -> f32 { return abs(v); }\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Simplex (multi-octave) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn generateSimplex(pos: vec3<f32>, p: NoiseParams) -> f32 {\r
    let invZoom = 1.0 / max(p.zoom, 1e-6);\r
    let domainOffset = seedOffset3(p.seed);\r
\r
    let base = vec3<f32>(\r
      pos.x * invZoom + p.xShift,\r
      pos.y * invZoom + p.yShift,\r
      pos.z * invZoom + p.zShift\r
    ) + domainOffset;\r
\r
    var sum     : f32 = 0.0;\r
    var amp     : f32 = 1.0;\r
    var ampSum  : f32 = 0.0;\r
    var freqLoc : f32 = max(p.freq, 1e-6);\r
    var angle   : f32 = p.seedAngle;\r
\r
    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {\r
        let samplePos = rotateXY3(base, angle) * freqLoc;\r
        var n = simplex3D(samplePos);\r
        if (p.turbulence == 1u) { n = abs(n); }\r
        sum += n * amp;\r
        ampSum += amp;\r
\r
        freqLoc *= p.lacunarity;\r
        amp     *= p.gain;\r
        angle   += ANGLE_INCREMENT;\r
    }\r
\r
    if (ampSum > 0.0) {\r
        sum = sum / ampSum;\r
    }\r
    if (p.turbulence == 1u) { sum = sum * 2.0 - 1.0; }\r
    return sum;\r
}\r
\r
/*\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  Simplex-based fBm helper (normalized)  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500*/\r
fn sfbm3D(pos : vec3<f32>, params: NoiseParams) -> f32 {\r
    let invZoom = 1.0 / max(params.zoom, 1e-6);\r
    let domainOffset = seedOffset3(params.seed);\r
\r
    let base = vec3<f32>(\r
      pos.x * invZoom + params.xShift,\r
      pos.y * invZoom + params.yShift,\r
      pos.z * invZoom + params.zShift\r
    ) + domainOffset;\r
\r
    var sum       : f32 = 0.0;\r
    var amplitude : f32 = 1.0;\r
    var maxValue  : f32 = 0.0;\r
    var freqLoc   : f32 = max(params.freq, 1e-6);\r
    var angle     : f32 = params.seedAngle;\r
    let angleInc  : f32 = 2.0 * PI / max(f32(params.octaves), 1.0);\r
\r
    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let samplePos = rotateXY3(base, angle) * freqLoc;\r
        var n = simplex3D(samplePos);\r
        if (params.turbulence == 1u) { n = abs(n); }\r
\r
        sum      += amplitude * n;\r
        maxValue += amplitude;\r
\r
        freqLoc   *= params.lacunarity;\r
        amplitude *= params.gain;\r
        angle     += angleInc;\r
    }\r
\r
    if (maxValue > 0.0) {\r
        var out = sum / maxValue;\r
        if (params.turbulence == 1u) {\r
            out = out * 2.0 - 1.0;\r
        }\r
        return out;\r
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
fn generateGaborMagic(pos: vec3<f32>, par: NoiseParams) -> f32 {\r
  return gaborMagicNoise3D(pos, par);\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Perlin Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generatePerlin(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let invZoom = 1.0 / max(params.zoom, 1e-6);\r
  let domainOffset = seedOffset3(params.seed);\r
\r
  let base = vec3<f32>(\r
    pos.x * invZoom + params.xShift,\r
    pos.y * invZoom + params.yShift,\r
    pos.z * invZoom + params.zShift\r
  ) + domainOffset;\r
\r
  var sum: f32 = 0.0;\r
  var amp: f32 = 1.0;\r
  var freqLoc: f32 = max(params.freq, 1e-6);\r
  var angle: f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let samplePos = rotateXY3(base, angle) * freqLoc;\r
\r
    var n: f32 = noise3D(samplePos);\r
    if (params.turbulence == 1u) {\r
      n = abs(n);\r
    }\r
\r
    sum += n * amp;\r
\r
    freqLoc *= params.lacunarity;\r
    amp *= params.gain;\r
    angle += ANGLE_INCREMENT;\r
  }\r
\r
  if (params.turbulence == 1u) {\r
    sum = sum - 1.0;\r
  }\r
\r
  return sum;\r
}\r
\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 4D Perlin FBM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generatePerlin4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  var base: vec4<f32>;\r
  if (params.toroidal == 1u) {\r
    base = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;\r
  } else {\r
    base = vec4<f32>(\r
      pos.x / zoom + params.xShift,\r
      pos.y / zoom + params.yShift,\r
      pos.z / zoom + params.zShift,\r
      params.time\r
    );\r
  }\r
\r
  var sum     : f32 = 0.0;\r
  var amp     : f32 = 1.0;\r
  var freqLoc : f32 = max(params.freq, 1e-6);\r
  var angle   : f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    var n = noise4D(base * freqLoc) * amp;\r
    if (params.turbulence == 1u) { n = abs(n); }\r
    sum += n;\r
\r
    freqLoc *= params.lacunarity;\r
    amp     *= params.gain;\r
\r
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
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Billow Noise Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateBillow(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let zoom = max(params.zoom, 1e-6);\r
\r
    var p = pos / zoom + vec3<f32>(params.xShift, params.yShift, params.zShift);\r
\r
    var sum: f32     = 0.0;\r
    var amp: f32     = 1.0;\r
    var freqLoc: f32 = max(params.freq, 1e-6);\r
    var ampSum: f32  = 0.0;\r
    var angle: f32   = params.seedAngle;\r
\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let n  = noise3D(p * freqLoc);\r
        let b  = pow(abs(n), 0.75);\r
        sum    = sum + b * amp;\r
        ampSum = ampSum + amp;\r
\r
        freqLoc = freqLoc * params.lacunarity;\r
        amp     = amp     * params.gain;\r
\r
        let c  = cos(angle);\r
        let s  = sin(angle);\r
        let xy = vec2<f32>(p.x, p.y);\r
        let r  = vec2<f32>(xy.x * c - xy.y * s, xy.x * s + xy.y * c);\r
        p = vec3<f32>(r.x, r.y, p.z + 0.03125);\r
\r
        angle = angle + ANGLE_INCREMENT;\r
    }\r
\r
    if (ampSum > 0.0) {\r
        sum = sum / ampSum;\r
    }\r
\r
    let k: f32 = 1.2;\r
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
    let zoom = max(params.zoom, 1e-6);\r
\r
    var x = pos.x / zoom + params.xShift;\r
    var y = pos.y / zoom + params.yShift;\r
    var z = pos.z / zoom + params.zShift;\r
    var sum     : f32 = 0.0;\r
    var amp     : f32 = 1.0;\r
    var freqLoc : f32 = max(params.freq, 1e-6);\r
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
    let zoom = max(params.zoom, 1e-6);\r
\r
    var x = pos.x / zoom + params.xShift;\r
    var y = pos.y / zoom + params.yShift;\r
    var z = pos.z / zoom + params.zShift;\r
    var freqLoc : f32 = max(params.freq, 1e-6);\r
\r
    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));\r
    var amp : f32 = 1.0;\r
\r
    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {\r
        freqLoc = freqLoc * params.lacunarity;\r
        amp = amp * params.gain;\r
\r
        var n : f32 = abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));\r
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
    let zoom = max(params.zoom, 1e-6);\r
\r
    var x = (pos.x + params.xShift) / zoom;\r
    var y = (pos.y + params.yShift) / zoom;\r
    var z = (pos.z + params.zShift) / zoom;\r
\r
    var freqLoc : f32 = max(params.freq, 1e-6);\r
    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));\r
    var amp : f32 = 1.0;\r
    var angle : f32 = params.seedAngle;\r
\r
    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {\r
        freqLoc = freqLoc * params.lacunarity;\r
        amp = amp * params.gain;\r
\r
        var n : f32 = abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));\r
        if (params.exp2 != 0.0) {\r
            n = 1.0 - pow(n, params.exp2);\r
        }\r
        if (params.exp1 != 0.0) {\r
            n = pow(n, params.exp1);\r
        }\r
\r
        sum = sum - n * amp;\r
\r
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
    let zoom = max(params.zoom, 1e-6);\r
\r
    var x = (pos.x + params.xShift) / zoom;\r
    var y = (pos.y + params.yShift) / zoom;\r
    var z = (pos.z + params.zShift) / zoom;\r
    var sum : f32 = 0.0;\r
    var amp : f32 = 1.0;\r
    var freqLoc : f32 = max(params.freq, 1e-6);\r
\r
    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {\r
        var n : f32 = lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));\r
        n = max(1e-7, n + 1.0);\r
        n = 2.0 * pow(n * 0.5, params.exp2 + 1.5) - 1.0;\r
        n = 1.0 - abs(n);\r
        if (params.exp1 - 1.0 != 0.0) {\r
            n = 1.0 - pow(n, params.exp1 - 1.0);\r
        }\r
\r
        sum = sum + n * amp;\r
\r
        freqLoc = freqLoc * params.lacunarity;\r
        x = x + params.xShift;\r
        y = y + params.yShift;\r
        z = z + params.zShift;\r
        amp = amp * params.gain;\r
    }\r
\r
    return sum - 1.0;\r
}\r
\r
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Ridged Multifractal Noise 4 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
fn generateRidgedMultifractal4(pos : vec3<f32>, params:NoiseParams) -> f32 {\r
    let zoom = max(params.zoom, 1e-6);\r
\r
    var x = (pos.x + params.xShift) / zoom;\r
    var y = (pos.y + params.yShift) / zoom;\r
    var z = (pos.z + params.zShift) / zoom;\r
    var sum : f32 = 0.0;\r
    var amp : f32 = 1.0;\r
    var freqLoc : f32 = max(params.freq, 1e-6);\r
\r
    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {\r
        var n : f32 = abs(lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)));\r
        if (params.exp2 != 0.0) {\r
            n = 1.0 - pow(n, params.exp2);\r
        }\r
        if (params.exp1 != 0.0) {\r
            n = pow(n, params.exp1);\r
        }\r
\r
        sum = sum + n * amp;\r
\r
        freqLoc = freqLoc * params.lacunarity;\r
        x = x + params.xShift;\r
        y = y + params.yShift;\r
        z = z + params.zShift;\r
        amp = amp * params.gain;\r
    }\r
\r
    return 1.0 - sum;\r
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
    var freqLoc   : f32 = max(params.freq, 1e-6);\r
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
    var freqLoc : f32 = max(params.freq, 1e-6);\r
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
  var freqLoc: f32 = max(params.freq, 1e-6);\r
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
  let zoom = max(params.zoom, 1e-6);\r
  var sum   : f32 = 0.0;\r
  var amp   : f32 = 1.0;\r
  var freqLoc : f32 = max(params.freq, 1e-6);\r
\r
  let mode : u32 = params.voroMode;\r
  let edgeK : f32 = max(params.edgeK, 0.0);\r
  let thresh : f32 = max(params.threshold, 0.0);\r
\r
  var x = (pos.x + params.xShift) / zoom;\r
  var y = (pos.y + params.yShift) / zoom;\r
  var z = (pos.z + params.zShift) / zoom;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let P = vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc);\r
    let m = voro3D_metrics(P);\r
    let v = voro_eval(m.f1Sq, m.f2Sq, m.cellVal, mode, edgeK, thresh, freqLoc);\r
\r
    sum = sum + v * amp;\r
\r
    freqLoc = freqLoc * params.lacunarity;\r
    amp     = amp * params.gain;\r
\r
    x = x + params.xShift;\r
    y = y + params.yShift;\r
    z = z + params.zShift;\r
  }\r
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
  var freqLoc : f32 = max(params.freq, 1e-6);\r
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
fn generateAntiCellular(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
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
  var freqLoc : f32 = max(params.freq, 1e-6);\r
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
fn generateAntiWorley(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  return -generateWorley(pos,params);\r
}\r
\r
fn generateCellular4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  let zoom = max(params.zoom, 1e-6);\r
\r
  var base: vec4<f32>;\r
  if (params.toroidal == 1u) {\r
    base = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;\r
  } else {\r
    base = vec4<f32>(\r
      pos.x / zoom + params.xShift,\r
      pos.y / zoom + params.yShift,\r
      pos.z / zoom + params.zShift,\r
      params.time\r
    );\r
  }\r
\r
  var sum     : f32 = 0.0;\r
  var amp     : f32 = 1.0;\r
  var freqLoc : f32 = max(params.freq, 1e-6);\r
  var angle   : f32 = params.seedAngle;\r
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
  var base: vec4<f32>;\r
  if (params.toroidal == 1u) {\r
    base = packPeriodicUV(pos.x, pos.y, pos.z) / zoom;\r
  } else {\r
    base = vec4<f32>(\r
      pos.x / zoom + params.xShift,\r
      pos.y / zoom + params.yShift,\r
      pos.z / zoom + params.zShift,\r
      params.time\r
    );\r
  }\r
\r
  var sum    : f32 = 0.0;\r
  var amp    : f32 = 1.0;\r
  var ampSum : f32 = 0.0;\r
  var freqLoc : f32 = max(params.freq, 1e-6);\r
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
      pos.x / zoom + params.xShift,\r
      pos.y / zoom + params.yShift,\r
      pos.z / zoom + params.zShift,\r
      params.time\r
    );\r
  }\r
\r
  var sum: f32 = 0.0;\r
  var amp: f32 = 1.0;\r
  var freqLoc: f32 = max(params.freq, 1e-6);\r
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
      pos.x / zoom + params.xShift,\r
      pos.y / zoom + params.yShift,\r
      pos.z / zoom + params.zShift,\r
      params.time\r
    );\r
  }\r
\r
  var sum: f32 = 0.0;\r
  var amp: f32 = 1.0;\r
  var ampSum: f32 = 0.0;\r
  var freqLoc: f32 = max(params.freq, 1e-6);\r
  var angle: f32 = params.seedAngle;\r
\r
  for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
    let n = lowpass4D(base * freqLoc);\r
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
fn generateLanczosAntiBillow4D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
  return 1.0 - generateLanczosBillow4D(pos, params);\r
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
  var freqLoc: f32 = max(params.freq, 1e-6);\r
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
    var freqLoc : f32 = max(p.freq, 1e-6);\r
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
    let m = voro3D_metrics(pos);\r
    let minDist = sqrt(max(m.f1Sq, 0.0));\r
    let secondDist = sqrt(max(m.f2Sq, 0.0));\r
\r
    let centerGrad = 1.0 - min(minDist, 1.0);\r
    let edgeDist = max(secondDist - minDist, 0.0);\r
    let edgeGrad = select(1.0, 0.0, edgeDist < params.threshold);\r
    let modeValue = voro_eval3D_metrics(m, params, max(params.freq, 1e-6));\r
    return select(modeValue, edgeGrad, params.voroMode == VORO_CELL) * centerGrad;\r
}\r
\r
// Octaved generator matching your JS .generateNoise()\r
fn generateVoronoiCircleNoise(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let zoom = max(params.zoom, 1e-6);\r
    var x       = pos.x / zoom + params.xShift;\r
    var y       = pos.y / zoom + params.yShift;\r
    var z       = pos.z / zoom + params.zShift;\r
    var total : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = max(params.freq, 1e-6);\r
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
    let m = voro3D_metrics(pos);\r
    let centerDist = sqrt(max(m.f1Sq, 0.0));\r
    let gradient = sin(centerDist * PI);\r
    let modeValue = voro_eval3D_metrics(m, params, max(params.freq, 1e-6));\r
    return select(modeValue, m.cellVal, params.voroMode == VORO_CELL) * gradient;\r
}\r
\r
fn generateVoronoiCircle2(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let zoom = max(params.zoom, 1e-6);\r
    var x = pos.x / zoom + params.xShift;\r
    var y = pos.y / zoom + params.yShift;\r
    var z = pos.z / zoom + params.zShift;\r
    var total : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = max(params.freq, 1e-6);\r
    var angle     : f32 = params.seedAngle;\r
    let angleInc  : f32 = 2.0 * PI / max(f32(params.octaves), 1.0);\r
\r
    for(var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let samplePos = vec3<f32>(x * freq, y * freq, z * freq);\r
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
    let zoom = max(params.zoom, 1e-6);\r
    var pos = posIn / zoom + vec3<f32>(params.xShift, params.yShift, params.zShift);\r
    var total : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = max(params.freq, 1e-6);\r
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
    let m = voro3D_metrics(pos);\r
    let edgeDist = voro_edge_dist(m.f1Sq, m.f2Sq);\r
    let ripple = sin(PI + edgeDist * PI * params.rippleFreq + params.time);\r
    let rippleAmp = (1.0 + ripple) * 0.5;\r
    let modeValue = voro_eval3D_metrics(m, params, max(params.freq, 1e-6));\r
    return select(modeValue, m.cellVal, params.voroMode == VORO_CELL) * rippleAmp;\r
}\r
\r
fn generateVoronoiRipple3D(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let zoom = max(params.zoom, 1e-6);\r
    var x = pos.x / zoom + params.xShift;\r
    var y = pos.y / zoom + params.yShift;\r
    var z = pos.z / zoom + params.zShift;\r
    var total : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = max(params.freq, 1e-6);\r
    for(var i: u32=0u; i<params.octaves; i=i+1u) {\r
        let sample = vec3<f32>(x * freq, y * freq, z * freq);\r
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
    let m = voro3D_metrics(pos);\r
    let edgeDist = voro_edge_dist(m.f1Sq, m.f2Sq);\r
    let ripple = sin(PI + params.zoom * edgeDist * PI * params.rippleFreq + params.time);\r
    let rippleAmp = (1.0 + ripple) * 0.5;\r
    let modeValue = voro_eval3D_metrics(m, params, max(params.freq, 1e-6));\r
    return select(modeValue, m.cellVal, params.voroMode == VORO_CELL) * rippleAmp;\r
}\r
\r
fn generateVoronoiRipple3D2(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let zoom = max(params.zoom, 1e-6);\r
    var x = pos.x / zoom + params.xShift;\r
    var y = pos.y / zoom + params.yShift;\r
    var z = pos.z / zoom + params.zShift;\r
    var total: f32 = 0.0;\r
    var amp: f32 = 1.0;\r
    var freq: f32 = max(params.freq, 1e-6);\r
\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let sample = vec3<f32>(x * freq, y * freq, z * freq);\r
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
    let m = voro3D_metrics(pos);\r
    let minDist = sqrt(max(m.f1Sq, 0.0));\r
    let ripple = sin(PI + minDist * PI * params.rippleFreq + params.time);\r
    let rippleAmp = (1.0 + ripple) * 0.5;\r
    let modeValue = voro_eval3D_metrics(m, params, max(params.freq, 1e-6));\r
    return select(modeValue, m.cellVal, params.voroMode == VORO_CELL) * rippleAmp;\r
}\r
\r
fn generateVoronoiCircularRipple(pos: vec3<f32>, params: NoiseParams) -> f32 {\r
    let zoom = max(params.zoom, 1e-6);\r
    var x = pos.x / zoom + params.xShift;\r
    var y = pos.y / zoom + params.yShift;\r
    var z = pos.z / zoom + params.zShift;\r
    var total: f32 = 0.0;\r
    var amp: f32 = 1.0;\r
    var freq: f32 = max(params.freq, 1e-6);\r
\r
    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {\r
        let sample = vec3<f32>(x * freq, y * freq, z * freq);\r
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
    let zoom = max(p.zoom, 1e-6);\r
    var x = pos.x / zoom + p.xShift;\r
    var y = pos.y / zoom + p.yShift;\r
    var z = pos.z / zoom + p.zShift;\r
    var sum: f32 = 0.0;\r
    var amp: f32 = 1.0;\r
    var freq: f32 = max(p.freq, 1e-6);\r
    var angle: f32 = p.seedAngle * 2.0 * PI;\r
    let angleInc = 2.0 * PI / max(f32(p.octaves), 1.0);\r
    let rippleFreqScaled = p.rippleFreq;\r
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
    let zoom = max(params.zoom, 1e-6);\r
    var pos   = posIn / zoom + vec3<f32>(params.xShift, params.yShift, params.zShift);\r
    var sum   : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = max(params.freq, 1e-6);\r
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
    let zoom = max(params.zoom, 1e-6);\r
    var pos   = posIn / zoom + vec3<f32>(params.xShift, params.yShift, params.zShift);\r
    var sum   : f32 = 0.0;\r
    var amp   : f32 = 1.0;\r
    var freq  : f32 = max(params.freq, 1e-6);\r
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
fn wrapCoordOffset(base: u32, offset: i32, size: u32) -> u32 {\r
  let s = max(i32(size), 1);\r
  let v = ((i32(base) + offset) % s + s) % s;\r
  return u32(v);\r
}\r
\r
fn blueNoiseLocalRank(ip: vec3<u32>, seed: u32, radius: i32) -> f32 {\r
  let center = hashTo01_seeded(ip.x, ip.y, ip.z, seed);\r
  var lower = 0.0;\r
  var total = 0.0;\r
\r
  for (var dy: i32 = -radius; dy <= radius; dy = dy + 1) {\r
    for (var dx: i32 = -radius; dx <= radius; dx = dx + 1) {\r
      if (dx == 0 && dy == 0) {\r
        continue;\r
      }\r
\r
      let sx = wrapCoordOffset(ip.x, dx, tileSizeX());\r
      let sy = wrapCoordOffset(ip.y, dy, tileSizeY());\r
      let n = hashTo01_seeded(sx, sy, ip.z, seed);\r
      lower += select(0.0, 1.0, n < center);\r
      total += 1.0;\r
    }\r
  }\r
\r
  return (lower + center) / (total + 1.0);\r
}\r
\r
// ---------------------- Blue Noise Generator (tiled, seeded) -------------\r
fn generateBlueNoise(pos : vec3<f32>, params: NoiseParams) -> f32 {\r
  let seed : u32 = params.seed;\r
  let ip0 = posToPixelCoords_tiled(pos);\r
\r
  var ip = ip0;\r
  if (params.warpAmp > 0.0) {\r
    let jx = i32(round(hashToSigned01_seeded(ip0.x + 5u, ip0.y + 11u, ip0.z + 17u, seed) * params.warpAmp * 2.0));\r
    let jy = i32(round(hashToSigned01_seeded(ip0.x + 19u, ip0.y + 23u, ip0.z + 29u, seed) * params.warpAmp * 2.0));\r
    ip = vec3<u32>(\r
      wrapCoordOffset(ip0.x, jx, tileSizeX()),\r
      wrapCoordOffset(ip0.y, jy, tileSizeY()),\r
      ip0.z\r
    );\r
  }\r
\r
  let rankSmall = blueNoiseLocalRank(ip, seed, 1);\r
  let rankLarge = blueNoiseLocalRank(ip, seed ^ 0x9E3779B9u, 2);\r
  var result = mix(rankLarge, rankSmall, 0.65);\r
\r
  let micro = hashTo01_seeded(ip.x + 37u, ip.y + 61u, ip.z + 17u, seed ^ 0x85EBCA6Bu);\r
  result = clamp(result + (micro - 0.5) * (1.0 / 25.0), 0.0, 1.0);\r
\r
  let contrast = max(1.0 + params.gain, 0.05);\r
  result = clamp((result - 0.5) * contrast + 0.5, 0.0, 1.0);\r
  return result;\r
}\r
\r
const HYDRO_TAU : f32 = 6.283185307179586;\r
\r
fn clamp01(x: f32) -> f32 {\r
  return clamp(x, 0.0, 1.0);\r
}\r
\r
fn hydroHash2(p: vec2<f32>) -> vec2<f32> {\r
  let k = vec2<f32>(0.3183099, 0.3678794);\r
  let q = p * k + k.yx;\r
  return -1.0 + 2.0 * fract(16.0 * k * fract(q.x * q.y * (q.x + q.y)));\r
}\r
\r
fn safeNormalize2(v: vec2<f32>) -> vec2<f32> {\r
  let l = length(v);\r
  if (l > 1e-10) {\r
    return v / l;\r
  }\r
  return vec2<f32>(0.0, 0.0);\r
}\r
\r
fn powInv(t: f32, power: f32) -> f32 {\r
  return 1.0 - pow(1.0 - clamp01(t), power);\r
}\r
\r
fn easeOut(t: f32) -> f32 {\r
  let v = 1.0 - clamp01(t);\r
  return 1.0 - v * v;\r
}\r
\r
fn smoothStart(t: f32, smoothing: f32) -> f32 {\r
  let s = max(smoothing, 1e-6);\r
  if (t >= s) {\r
    return t - 0.5 * s;\r
  }\r
  return 0.5 * t * t / s;\r
}\r
\r
fn loadPrevClamped2D(fx: i32, fy: i32, fz: i32) -> vec4<f32> {\r
  let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);\r
  let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);\r
  return loadPrevRGBA(cx, cy, fz);\r
}\r
\r
fn fetchPosClamped2D(fx: i32, fy: i32, fz: i32) -> vec3<f32> {\r
  let cx = clamp(fx, 0, i32(frame.fullWidth) - 1);\r
  let cy = clamp(fy, 0, i32(frame.fullHeight) - 1);\r
  return fetchPos(cx, cy, fz);\r
}\r
\r
fn resolutionScale() -> f32 {\r
  let refRes = 1024.0;\r
  let curRes = max(min(f32(frame.fullWidth), f32(frame.fullHeight)), 1.0);\r
  return curRes / refRes;\r
}\r
\r
fn resolveFiniteSlope2D(fx: i32, fy: i32, fz: i32) -> vec2<f32> {\r
  let hL = loadPrevClamped2D(fx - 1, fy, fz).x;\r
  let hR = loadPrevClamped2D(fx + 1, fy, fz).x;\r
  let hD = loadPrevClamped2D(fx, fy - 1, fz).x;\r
  let hU = loadPrevClamped2D(fx, fy + 1, fz).x;\r
\r
  let pL = fetchPosClamped2D(fx - 1, fy, fz);\r
  let pR = fetchPosClamped2D(fx + 1, fy, fz);\r
  let pD = fetchPosClamped2D(fx, fy - 1, fz);\r
  let pU = fetchPosClamped2D(fx, fy + 1, fz);\r
\r
  let dx = max(abs(pR.x - pL.x), 1e-6);\r
  let dy = max(abs(pU.y - pD.y), 1e-6);\r
\r
  let dHdX = (hR - hL) / dx;\r
  let dHdY = (hU - hD) / dy;\r
\r
  return vec2<f32>(dHdX, dHdY);\r
}\r
\r
fn guideGaussian(dx: i32, dy: i32, sigmaPx: f32) -> f32 {\r
  let s = max(sigmaPx, 0.05);\r
  let d2 = f32(dx * dx + dy * dy);\r
  return exp(-0.5 * d2 / (s * s));\r
}\r
\r
fn guideHeightAt(fx: i32, fy: i32, fz: i32, sigmaWorld: f32) -> f32 {\r
  let sigmaPx = sigmaWorld * resolutionScale();\r
\r
  var sumW = 0.0;\r
  var sumH = 0.0;\r
\r
  for (var j: i32 = -4; j <= 4; j = j + 1) {\r
    for (var i: i32 = -4; i <= 4; i = i + 1) {\r
      let h = loadPrevClamped2D(fx + i, fy + j, fz).x;\r
      let w = guideGaussian(i, j, sigmaPx);\r
      sumW += w;\r
      sumH += h * w;\r
    }\r
  }\r
\r
  return sumH / max(sumW, 1e-6);\r
}\r
\r
fn drainBlurWeight(dx: i32, dy: i32, sigmaPx: f32) -> f32 {\r
  let s = max(sigmaPx, 0.05);\r
  let d2 = f32(dx * dx + dy * dy);\r
  return exp(-0.5 * d2 / (s * s));\r
}\r
\r
fn blurredHeightAt(fx: i32, fy: i32, fz: i32, sigmaWorld: f32) -> f32 {\r
  let sigmaPx = sigmaWorld * resolutionScale();\r
\r
  var sumW = 0.0;\r
  var sumH = 0.0;\r
\r
  for (var j: i32 = -4; j <= 4; j = j + 1) {\r
    for (var i: i32 = -4; i <= 4; i = i + 1) {\r
      let s = loadPrevClamped2D(fx + i, fy + j, fz).x;\r
      let w = drainBlurWeight(i, j, sigmaPx);\r
      sumW += w;\r
      sumH += s * w;\r
    }\r
  }\r
\r
  return sumH / max(sumW, 1e-6);\r
}\r
\r
fn blurredRidgeAt(fx: i32, fy: i32, fz: i32, sigmaWorld: f32) -> f32 {\r
  let sigmaPx = sigmaWorld * resolutionScale();\r
\r
  var sumW = 0.0;\r
  var sumR = 0.0;\r
\r
  for (var j: i32 = -4; j <= 4; j = j + 1) {\r
    for (var i: i32 = -4; i <= 4; i = i + 1) {\r
      let s = loadPrevClamped2D(fx + i, fy + j, fz);\r
      let ridge = s.w * 2.0 - 1.0;\r
      let w = drainBlurWeight(i, j, sigmaPx);\r
      sumW += w;\r
      sumR += ridge * w;\r
    }\r
  }\r
\r
  return sumR / max(sumW, 1e-6);\r
}\r
\r
fn phacelleNoise(\r
  p: vec2<f32>,\r
  normDir: vec2<f32>,\r
  freq: f32,\r
  offset: f32,\r
  normalization: f32\r
) -> vec4<f32> {\r
  let sideDir = normDir.yx * vec2<f32>(-1.0, 1.0) * freq * HYDRO_TAU;\r
  let phaseOffset = offset * HYDRO_TAU;\r
\r
  let pInt = floor(p);\r
  let pFrac = fract(p);\r
\r
  var phaseDir = vec2<f32>(0.0);\r
  var weightSum = 0.0;\r
\r
  for (var j: i32 = -1; j <= 2; j = j + 1) {\r
    for (var i: i32 = -1; i <= 2; i = i + 1) {\r
      let gridOffset = vec2<f32>(f32(i), f32(j));\r
      let gridPoint = pInt + gridOffset;\r
      let randomOffset = hydroHash2(gridPoint) * 0.5;\r
      let v = pFrac - gridOffset - randomOffset;\r
\r
      let sqrDist = dot(v, v);\r
      var weight = exp(-sqrDist * 2.0);\r
      weight = max(0.0, weight - 0.01111);\r
\r
      weightSum += weight;\r
\r
      let waveInput = dot(v, sideDir) + phaseOffset;\r
      phaseDir += vec2<f32>(cos(waveInput), sin(waveInput)) * weight;\r
    }\r
  }\r
\r
  let interpolated = phaseDir / max(weightSum, 1e-6);\r
  let mag = max(1.0 - normalization, length(interpolated));\r
\r
  return vec4<f32>(interpolated / max(mag, 1e-6), sideDir);\r
}\r
\r
fn pixelSpan2D(fx: i32, fy: i32, fz: i32) -> f32 {\r
  let pL = fetchPosClamped2D(fx - 1, fy, fz);\r
  let pR = fetchPosClamped2D(fx + 1, fy, fz);\r
  let pD = fetchPosClamped2D(fx, fy - 1, fz);\r
  let pU = fetchPosClamped2D(fx, fy + 1, fz);\r
\r
  let dx = max(abs(pR.x - pL.x) * 0.5, 1e-6);\r
  let dy = max(abs(pU.y - pD.y) * 0.5, 1e-6);\r
\r
  return max(dx, dy);\r
}\r
\r
\r
fn rotate2(v: vec2<f32>, angle: f32) -> vec2<f32> {\r
  let c = cos(angle);\r
  let s = sin(angle);\r
  return vec2<f32>(v.x * c - v.y * s, v.x * s + v.y * c);\r
}\r
\r
fn signed01(v: f32) -> f32 {\r
  return v * 2.0 - 1.0;\r
}\r
\r
fn terrainDetailMapScalar(uv: vec2<f32>, baseFreq: f32) -> f32 {\r
  var value = 0.0;\r
  var amp = 0.5;\r
  var ampSum = 0.0;\r
  var freqLoc = max(baseFreq, 1e-6);\r
\r
  for (var i: u32 = 0u; i < 8u; i = i + 1u) {\r
    value += noise2D(uv * freqLoc) * amp;\r
    ampSum += amp;\r
    amp *= 0.95;\r
    freqLoc *= 2.0;\r
  }\r
\r
  return value / max(ampSum, 1e-6);\r
}\r
\r
fn generateSmokeNoise(pos: vec3<f32>, paramsIn: NoiseParams) -> f32 {\r
  let baseFreq = max(paramsIn.freq, 0.25);\r
  let baseOctaves = max(paramsIn.octaves, 3u);\r
  let lac = max(paramsIn.lacunarity, 2.0);\r
\r
  var warpParams = paramsIn;\r
  warpParams.freq = baseFreq * 0.9;\r
  warpParams.octaves = max(baseOctaves, 3u);\r
  warpParams.gain = 0.55;\r
  warpParams.lacunarity = lac;\r
\r
  let warpX = signed01(generateSimplex(pos + vec3<f32>(17.31, 9.73, 3.11), warpParams));\r
  let warpY = signed01(generatePerlin(pos + vec3<f32>(-11.37, 14.51, 5.71), warpParams));\r
  let warpZ = signed01(generateSimplex(pos + vec3<f32>(5.91, -7.13, 11.29), warpParams));\r
  let warpAmp = 0.18 + max(paramsIn.warpAmp, 0.0) * 0.35;\r
  let qWarp = pos + vec3<f32>(warpX, warpY, 0.35 * warpZ) * warpAmp;\r
\r
  var macroParams = paramsIn;\r
  macroParams.freq = baseFreq * 0.5;\r
  macroParams.octaves = max(baseOctaves + 1u, 4u);\r
  macroParams.gain = 0.55;\r
  macroParams.lacunarity = lac;\r
  let macroRidge = signed01(generateRidgedMultifractal4(qWarp, macroParams));\r
\r
  var continentalParams = paramsIn;\r
  continentalParams.freq = baseFreq * 0.28;\r
  continentalParams.octaves = max(baseOctaves, 3u);\r
  continentalParams.gain = 0.5;\r
  continentalParams.lacunarity = lac;\r
  let continental = signed01(generateBillow(qWarp + vec3<f32>(2.7, -4.1, 1.3), continentalParams));\r
\r
  var ridgeParams = paramsIn;\r
  ridgeParams.freq = baseFreq * 1.45;\r
  ridgeParams.octaves = max(baseOctaves, 4u);\r
  ridgeParams.gain = 0.52;\r
  ridgeParams.lacunarity = lac;\r
  let detailRidge = signed01(generateRidgedMultifractal2(qWarp * 1.05 + vec3<f32>(4.2, 1.7, 0.0), ridgeParams));\r
\r
  var worleyParams = paramsIn;\r
  worleyParams.freq = baseFreq * 1.75;\r
  worleyParams.octaves = 1u;\r
  worleyParams.gain = 1.0;\r
  worleyParams.lacunarity = 2.0;\r
  let cells = 1.0 - generateWorley(qWarp + vec3<f32>(7.5, -3.2, 0.0), worleyParams);\r
  let cellular = signed01(generateCellular(qWarp * 1.1 + vec3<f32>(-5.3, 6.4, 0.0), worleyParams));\r
\r
  var rippleParams = paramsIn;\r
  rippleParams.freq = baseFreq * 2.25;\r
  rippleParams.octaves = 4u;\r
  rippleParams.gain = 0.7;\r
  rippleParams.lacunarity = max(lac, 2.0);\r
  let rippleWarpX = signed01(generatePerlin(qWarp * 1.9 + vec3<f32>(8.7, 3.1, 0.0), rippleParams));\r
  let rippleWarpY = signed01(generateSimplex(qWarp * 1.9 + vec3<f32>(-6.2, 5.4, 0.0), rippleParams));\r
  let rippleCarrier = signed01(generateBillow(qWarp * 2.3 + vec3<f32>(3.6, -8.9, 0.0), rippleParams));\r
  let rippleAngle = 0.6 + 0.35 * signed01(generatePerlin(qWarp + vec3<f32>(1.9, -2.7, 0.0), warpParams));\r
  let ripplePos = rotate2(qWarp.xy + vec2<f32>(rippleWarpX, rippleWarpY) * 0.08, rippleAngle);\r
  let rippleFreq = max(paramsIn.rippleFreq, 1.0);\r
  let ripple = sin(ripplePos.x * rippleFreq + rippleCarrier * 2.8);\r
  let rippleEnvelope = 0.5 + 0.5 * signed01(generatePerlin(qWarp * 1.35 + vec3<f32>(10.1, 4.8, 0.0), rippleParams));\r
\r
  let cellBlend = clamp01(0.3 + paramsIn.threshold * 0.9);\r
  let rippleBlend = clamp01(0.02 + 0.008 * max(paramsIn.rippleFreq, 1.0));\r
\r
  var terrain = 0.0;\r
  terrain += macroRidge * 0.46;\r
  terrain += continental * 0.14;\r
  terrain += detailRidge * 0.21;\r
  terrain += signed01(cells) * (0.10 * cellBlend);\r
  terrain += cellular * (0.06 * cellBlend);\r
  terrain += ripple * rippleEnvelope * rippleBlend;\r
\r
  let lifted = terrain * 0.5 + 0.5 + paramsIn.zShift;\r
  return clamp01(lifted);\r
}\r
\r
fn terrainVoroModeSample(pos: vec3<f32>, freqLoc: f32, mode: u32, edgeK: f32, threshold: f32) -> f32 {\r
  let s = voro_sample3D(pos * freqLoc);\r
  return clamp01(voro_eval(s.f1Sq, s.f2Sq, s.cellVal, mode, edgeK, threshold, freqLoc));\r
}\r
\r
fn terrainVoroModeSmooth(pos: vec3<f32>, freqLoc: f32, mode: u32, edgeK: f32, threshold: f32) -> f32 {\r
  let step = 0.006;\r
  let center = terrainVoroModeSample(pos, freqLoc, mode, edgeK, threshold);\r
  let x1 = terrainVoroModeSample(pos + vec3<f32>( step, 0.0, 0.0), freqLoc, mode, edgeK, threshold);\r
  let x2 = terrainVoroModeSample(pos + vec3<f32>(-step, 0.0, 0.0), freqLoc, mode, edgeK, threshold);\r
  let y1 = terrainVoroModeSample(pos + vec3<f32>(0.0,  step, 0.0), freqLoc, mode, edgeK, threshold);\r
  let y2 = terrainVoroModeSample(pos + vec3<f32>(0.0, -step, 0.0), freqLoc, mode, edgeK, threshold);\r
  let d1 = terrainVoroModeSample(pos + vec3<f32>( step,  step, 0.0), freqLoc, mode, edgeK, threshold);\r
  let d2 = terrainVoroModeSample(pos + vec3<f32>(-step,  step, 0.0), freqLoc, mode, edgeK, threshold);\r
  let d3 = terrainVoroModeSample(pos + vec3<f32>( step, -step, 0.0), freqLoc, mode, edgeK, threshold);\r
  let d4 = terrainVoroModeSample(pos + vec3<f32>(-step, -step, 0.0), freqLoc, mode, edgeK, threshold);\r
  return clamp01((center * 4.0 + x1 * 2.0 + x2 * 2.0 + y1 * 2.0 + y2 * 2.0 + d1 + d2 + d3 + d4) / 16.0);\r
}\r
\r
fn generateTerrainNoise(pos: vec3<f32>, paramsIn: NoiseParams) -> f32 {\r
  let baseFreq = max(paramsIn.freq, 0.24);\r
  let baseOctaves = max(paramsIn.octaves, 4u);\r
  let lac = max(paramsIn.lacunarity, 2.0);\r
  let warpAmount = 0.035 + max(paramsIn.warpAmp, 0.0) * 0.055;\r
\r
  var warpParams = paramsIn;\r
  warpParams.freq = baseFreq * 0.55;\r
  warpParams.octaves = max(baseOctaves, 3u);\r
  warpParams.gain = 0.52;\r
  warpParams.lacunarity = lac;\r
\r
  let warpA = signed01(generatePerlin(pos + vec3<f32>(7.3, -5.9, 1.7), warpParams));\r
  let warpB = signed01(generateSimplex(pos + vec3<f32>(-3.1, 9.4, 2.6), warpParams));\r
  let q = pos + vec3<f32>(warpA, warpB, 0.0) * warpAmount;\r
\r
  var macroParams = paramsIn;\r
  macroParams.freq = baseFreq * 0.56;\r
  macroParams.octaves = max(baseOctaves + 1u, 5u);\r
  macroParams.gain = 0.58;\r
  macroParams.lacunarity = lac;\r
  let macroRidgeRaw = signed01(generateRidgedMultifractal4(q + vec3<f32>(4.2, 1.9, 0.0), macroParams));\r
  let macroRidge = sign(macroRidgeRaw) * pow(abs(macroRidgeRaw), 1.18);\r
\r
  var sharpParams = paramsIn;\r
  sharpParams.freq = baseFreq * 1.08;\r
  sharpParams.octaves = max(baseOctaves, 5u);\r
  sharpParams.gain = 0.53;\r
  sharpParams.lacunarity = lac;\r
  let sharpRidgeRaw = signed01(generateRidgedMultifractal2(q * 1.04 + vec3<f32>(-3.7, 2.6, 0.0), sharpParams));\r
  let sharpRidge = sign(sharpRidgeRaw) * pow(abs(sharpRidgeRaw), 1.30);\r
\r
  var worleyParams = paramsIn;\r
  worleyParams.freq = baseFreq * 0.82;\r
  worleyParams.octaves = 1u;\r
  worleyParams.gain = 1.0;\r
  worleyParams.lacunarity = 2.0;\r
  let worleyA = 1.0 - generateWorley(q + vec3<f32>(6.3, -1.7, 0.0), worleyParams);\r
  let worleyB = 1.0 - generateWorley(q + vec3<f32>(6.3 + 0.012, -1.7, 0.0), worleyParams);\r
  let worleyC = 1.0 - generateWorley(q + vec3<f32>(6.3 - 0.012, -1.7, 0.0), worleyParams);\r
  let worleyD = 1.0 - generateWorley(q + vec3<f32>(6.3, -1.7 + 0.012, 0.0), worleyParams);\r
  let worleyE = 1.0 - generateWorley(q + vec3<f32>(6.3, -1.7 - 0.012, 0.0), worleyParams);\r
  let smoothedWorley = (worleyA * 4.0 + worleyB + worleyC + worleyD + worleyE) / 8.0;\r
  let worleySignal = signed01(smoothedWorley);\r
  let worleyCarve = smoothstep(0.38, 0.84, smoothedWorley);\r
  let worleyGrad = vec2<f32>(worleyB - worleyC, worleyD - worleyE);\r
  let worleyTangent = safeNormalize2(vec2<f32>(-worleyGrad.y, worleyGrad.x));\r
\r
  var angleParams = paramsIn;\r
  angleParams.freq = baseFreq * 0.72;\r
  angleParams.octaves = max(baseOctaves, 3u);\r
  angleParams.gain = 0.50;\r
  angleParams.lacunarity = lac;\r
  let angleField = signed01(generatePerlin(q + vec3<f32>(2.1, -4.7, 0.0), angleParams));\r
  let baseDir = safeNormalize2(vec2<f32>(cos(angleField * 1.9), sin(angleField * 1.9)));\r
  let joinMix = smoothstep(0.18, 0.82, smoothedWorley);\r
  let lineDir = safeNormalize2(mix(baseDir, worleyTangent, 0.72 * joinMix));\r
  let sideDir = vec2<f32>(-lineDir.y, lineDir.x);\r
\r
  var rippleParams = paramsIn;\r
  rippleParams.freq = baseFreq * 1.7;\r
  rippleParams.octaves = 3u;\r
  rippleParams.gain = 0.62;\r
  rippleParams.lacunarity = max(lac, 2.0);\r
  let rippleWarp = vec2<f32>(\r
    signed01(generatePerlin(q * 1.25 + vec3<f32>(8.7, 1.3, 0.0), rippleParams)),\r
    signed01(generateSimplex(q * 1.25 + vec3<f32>(-6.2, 4.8, 0.0), rippleParams))\r
  ) * 0.024;\r
  let rippleCarrier = signed01(generateBillow(q * 1.85 + vec3<f32>(3.1, -7.2, 0.0), rippleParams));\r
\r
  let detailMap = terrainDetailMapScalar(q.xy * 0.60 + vec2<f32>(11.7, -5.3), 2.0);\r
  let detailSoft = detailMap * detailMap * (3.0 - 2.0 * detailMap);\r
  let detailSignal = signed01(detailSoft);\r
\r
  let joinedCoord = dot(q.xy + rippleWarp, sideDir);\r
  let branchCoord = dot(\r
    q.xy + rippleWarp * 0.7,\r
    safeNormalize2(mix(sideDir, worleyTangent, 0.35))\r
  );\r
  let rippleFreq = max(paramsIn.rippleFreq, 1.0) * 0.42;\r
  let ripplePrimary =\r
    sin(joinedCoord * rippleFreq + smoothedWorley * 4.0 + rippleCarrier * 1.1 + detailSignal * 0.28);\r
  let rippleBranch =\r
    sin(branchCoord * rippleFreq * 1.05 + smoothedWorley * 3.2 + rippleCarrier * 0.7 + detailSignal * 0.18);\r
  let ripple = mix(ripplePrimary, rippleBranch, 0.32 + 0.28 * joinMix);\r
  let rippleMask =\r
    smoothstep(0.08, 0.88, abs(macroRidge)) *\r
    (0.28 + 0.72 * joinMix) *\r
    (0.92 + 0.08 * detailSoft);\r
  let rippleBlend = clamp01(0.026 + 0.006 * max(paramsIn.rippleFreq, 1.0));\r
\r
  let detailMask =\r
    smoothstep(0.12, 0.88, smoothedWorley) *\r
    smoothstep(0.04, 0.72, abs(macroRidge));\r
\r
  var terrain = 0.0;\r
  terrain += macroRidge * 0.40;\r
  terrain += sharpRidge * 0.16;\r
  terrain += worleySignal * 0.11;\r
  terrain -= worleyCarve * 0.10;\r
  terrain += ripple * rippleMask * rippleBlend;\r
  terrain += detailSignal * detailMask * 0.012;\r
\r
  let shaped = sign(terrain) * pow(abs(terrain), 0.96);\r
  let lifted = shaped * 0.5 + 0.5 + paramsIn.zShift;\r
  return clamp01(lifted);\r
}\r
\r
fn erosionFilter(\r
  p: vec2<f32>,\r
  heightAndSlopeIn: vec3<f32>,\r
  fadeTargetIn: f32,\r
  strengthIn: f32,\r
  gullyWeightIn: f32,\r
  carrierWeightIn: f32,\r
  steeringWeightIn: f32,\r
  detailIn: f32,\r
  roundingIn: vec4<f32>,\r
  onsetIn: vec4<f32>,\r
  assumedSlopeIn: vec2<f32>,\r
  scaleIn: f32,\r
  octavesIn: u32,\r
  lacunarityIn: f32,\r
  gainIn: f32,\r
  cellScaleIn: f32,\r
  normalizationIn: f32,\r
  pixelSpanIn: f32,\r
  ridgeMapOut: ptr<function, f32>\r
) -> vec4<f32> {\r
  var heightAndSlope = heightAndSlopeIn;\r
  var fadeTarget = clamp(fadeTargetIn, -1.0, 1.0);\r
\r
  let inputHeightAndSlope = heightAndSlopeIn;\r
\r
  var strength = strengthIn * scaleIn;\r
  var freq = 1.0 / max(scaleIn * cellScaleIn, 1e-6);\r
  let carrierSharpness = 1.75;\r
  let slopeLength = max(length(heightAndSlopeIn.yz), 1e-10);\r
  var magnitude = 0.0;\r
  var roundingMult = 1.0;\r
\r
  let roundingForInput =\r
    mix(roundingIn.y, roundingIn.x, clamp01(fadeTarget * 0.5 + 0.5)) * roundingIn.z;\r
\r
  var combiMask =\r
    easeOut(smoothStart(slopeLength * onsetIn.x, roundingForInput * onsetIn.x));\r
\r
  var ridgeMapCombiMask = easeOut(slopeLength * onsetIn.z);\r
  var ridgeMapFadeTarget = fadeTarget;\r
\r
  var gullySlope =\r
    mix(\r
      heightAndSlopeIn.yz,\r
      safeNormalize2(heightAndSlopeIn.yz) * assumedSlopeIn.x,\r
      assumedSlopeIn.y\r
    );\r
\r
  let pixelSpan = max(pixelSpanIn, 1e-6);\r
\r
  for (var i: u32 = 0u; i < octavesIn; i = i + 1u) {\r
    let stripeStep = freq * cellScaleIn * HYDRO_TAU * pixelSpan;\r
    let stripeMask = 1.0 - smoothstep(1.05, 2.40, stripeStep);\r
\r
    if (stripeMask <= 1e-4) {\r
      break;\r
    }\r
\r
    var phacelle =\r
      phacelleNoise(\r
        p * freq,\r
        safeNormalize2(gullySlope),\r
        cellScaleIn,\r
        0.25,\r
        normalizationIn\r
      );\r
\r
    phacelle = vec4<f32>(phacelle.xy, phacelle.z * -freq, phacelle.w * -freq);\r
    let sloping = abs(phacelle.y);\r
    let carrierRaw = clamp(phacelle.x, -1.0, 1.0);\r
    let carrierPhase = sign(carrierRaw) * pow(abs(carrierRaw), carrierSharpness);\r
\r
    let octaveStrength = strength * stripeMask;\r
\r
    gullySlope += sign(phacelle.y) * phacelle.zw * octaveStrength * gullyWeightIn * steeringWeightIn;\r
\r
    let visibleGullies = vec3<f32>(carrierPhase, phacelle.y * phacelle.zw) * carrierWeightIn;\r
    let fadedGullies =\r
      mix(vec3<f32>(fadeTarget, 0.0, 0.0), visibleGullies, combiMask);\r
\r
    heightAndSlope += fadedGullies * octaveStrength;\r
    magnitude += octaveStrength;\r
    let fadedCarrier = mix(fadeTarget, carrierPhase, combiMask);\r
    fadeTarget = mix(fadeTarget, fadedCarrier, stripeMask);\r
\r
    let roundingForOctave =\r
      mix(roundingIn.y, roundingIn.x, clamp01(carrierPhase * 0.5 + 0.5)) * roundingMult;\r
\r
    let newMask =\r
      easeOut(smoothStart(sloping * onsetIn.y, roundingForOctave * onsetIn.y));\r
\r
    combiMask = powInv(combiMask, detailIn) * mix(1.0, newMask, stripeMask);\r
\r
    ridgeMapFadeTarget = mix(ridgeMapFadeTarget, carrierPhase, ridgeMapCombiMask * stripeMask);\r
\r
    let newRidgeMapMask = easeOut(sloping * onsetIn.w);\r
    ridgeMapCombiMask = ridgeMapCombiMask * mix(1.0, newRidgeMapMask, stripeMask);\r
\r
    strength *= gainIn;\r
    freq *= lacunarityIn;\r
    roundingMult *= roundingIn.w;\r
  }\r
\r
  *ridgeMapOut = ridgeMapFadeTarget * (1.0 - ridgeMapCombiMask);\r
\r
  let delta = heightAndSlope - inputHeightAndSlope;\r
  return vec4<f32>(delta, magnitude);\r
}\r
\r
fn studioSphereHeight(x:i32,y:i32,last:i32)->f32 {\r
  return loadPrevRGBA((x+last)%last,clamp(y,0,last),0).x;\r
}\r
\r
struct StudioErosionChart { position:vec2<f32>, slope:vec2<f32>, pixelSpan:f32 }\r
\r
fn studioErosionChart(\r
  dir:vec3<f32>,gradient:vec3<f32>,hemisphere:f32,pixelSpan:f32\r
)->StudioErosionChart {\r
  // Stereographic charts preserve the downhill angle. Their overlap avoids a\r
  // longitude seam and keeps the noise cells finite at both poles.\r
  let projection=1.0+hemisphere*dir.y;\r
  let uv=dir.xz/projection;\r
  let inverse=2.0/(1.0+dot(uv,uv));\r
  let angular=vec3<f32>(dir.x,hemisphere+dir.y,dir.z);\r
  let du=inverse*(vec3<f32>(1,0,0)-uv.x*angular);\r
  let dv=inverse*(vec3<f32>(0,0,1)-uv.y*angular);\r
  let slope=vec2<f32>(dot(gradient,du),dot(gradient,dv))*.14;\r
  let offset=seedOffset3(params.seed).xy;\r
  return StudioErosionChart(uv+offset,slope,pixelSpan/projection);\r
}\r
\r
fn studioMountainCut(chart:StudioErosionChart,height:f32,ranges:bool)->f32 {\r
  let fade=2.0*smoothstep(.05,select(1.62,1.20,ranges),height)-1.0;\r
  var ridge=0.0;\r
  let mountain=erosionFilter(\r
    chart.position+vec2<f32>(.29,-.44),vec3<f32>(height,chart.slope),fade,\r
    select(4.4,5.8,ranges),.48,select(.76,.55,ranges),1.03,1.40,\r
    vec4<f32>(select(.10,.035,ranges),0,.10,2.0),vec4<f32>(1.10,1.25,2.80,1.50),\r
    vec2<f32>(.70,.88),select(.145,.083,ranges),select(1u,6u,ranges),\r
    2.08,.54,.82,.52,chart.pixelSpan,&ridge\r
  );\r
  if(ranges){\r
    // Preserve the fade contribution at crests. Clipping uplift rounds off\r
    // the exact divides the lower carrier weight is meant to keep.\r
    return mountain.x-.22*max(0.0,-mountain.x);\r
  }\r
  let incision=smoothstep(.065,.52,-mountain.x);\r
  let shoulder=smoothstep(.06,.48,mountain.x);\r
  return .10*shoulder-.55*incision;\r
}\r
\r
fn studioGullyCut(chart:StudioErosionChart,height:f32)->f32 {\r
  let strength=select(3.05,3.55,params.voroMode==1u);\r
  var ridge=0.0;\r
  let erosion=erosionFilter(\r
    chart.position,vec3<f32>(height,chart.slope),-.17,strength,.48,.83,1.03,1.50,\r
    vec4<f32>(.10,0,.10,2.0),vec4<f32>(1.20,1.25,2.80,1.50),\r
    vec2<f32>(.72,.72),.076,3u,2.2,.48,.82,.52,chart.pixelSpan,&ridge\r
  );\r
  // Smaller tributaries start from the coarse pass's eroded slope.\r
  let tributaries=erosionFilter(\r
    chart.position+vec2<f32>(.57,.31),\r
    vec3<f32>(height+erosion.x,chart.slope+.30*erosion.yz),-.10,1.55,.37,.69,.92,1.38,\r
    vec4<f32>(.10,0,.10,1.8),vec4<f32>(1.20,1.25,2.80,1.50),\r
    vec2<f32>(.66,.68),.041,2u,2.1,.47,.83,.52,chart.pixelSpan,&ridge\r
  );\r
  return clamp(erosion.x+tributaries.x,-.265,.16);\r
}\r
\r
fn studioVolcanicRelief(dir:vec3<f32>,texel:f32)->vec2<f32> {\r
  var relief=0.0;\r
  var foundation=0.0;\r
  var collapse=0.0;\r
  let density=options.sphereFeatureDensity;\r
  let vents=u32(clamp(round(12.0*density),5.0,32.0));\r
  for(var i=0u;i<vents;i++){\r
    let seed=params.seed+i*73856093u;\r
    let q=(seedOffset3(seed)-vec3<f32>(17.173,31.947,47.521))/\r
      vec3<f32>(131.0,137.0,149.0);\r
    let y=2.0*q.x-1.0;\r
    let ring=sqrt(max(0.0,1.0-y*y));\r
    let phi=TWO_PI*q.y;\r
    let center=vec3<f32>(ring*cos(phi),y,ring*sin(phi));\r
    let radius=mix(.035,.134,q.z*q.z);\r
    let distance2=max(0.0,2.0-2.0*dot(dir,center));\r
    let reach=mix(.11,.21,q.z)+.44*radius;\r
    let extent=max(radius*1.45,reach+.024);\r
    if(distance2*density*density>extent*extent){continue;}\r
    let east=vec3<f32>(-sin(phi),0,cos(phi));\r
    let north=cross(center,east);\r
    let angle=TWO_PI*canyon_bed_random(19,seed);\r
    let course=east*cos(angle)+north*sin(angle);\r
    let local=density*vec2<f32>(dot(dir,course),dot(dir,cross(center,course)));\r
    if(distance2*density*density<radius*radius*1.45*1.45){\r
      let shape=vec3<f32>(1.0-q.z,canyon_bed_random(23,seed),canyon_bed_random(37,seed));\r
      let profile=local/radius;\r
      let roughness=mix(.105,.040,shape.x)*simplex3D(dir*104.0+q*19.0);\r
      relief+=volcanic_vent(profile,shape,roughness);\r
      // Loose ejecta bury the old relief beneath the crater and upper flank.\r
      foundation=max(foundation,(1.0-smoothstep(.38,1.21,length(profile)))*mix(.45,1.0,shape.x));\r
    }\r
    // Off-axis flank vents and multiple tube directions follow the same\r
    // eruptive center. The world seed controls which branches survive.\r
    if(canyon_bed_random(5,seed)>.33){\r
      let flank=vec2<f32>(local.x*.64+local.y*.77,-local.x*.77+local.y*.64);\r
      let offset=radius*vec2<f32>(mix(.81,1.36,q.x),mix(-.34,.48,q.y));\r
      let smallRadius=clamp(radius*.45,.023,.044);\r
      let vent=(flank-offset)/smallRadius;\r
      if(dot(vent,vent)<1.45*1.45){\r
        let shape=vec3<f32>(mix(.56,.91,q.y),q.x,q.z);\r
        relief+=.62*volcanic_vent(vent,shape,.075*simplex3D(dir*140.0-q*17.0));\r
      }\r
    }\r
    collapse=min(collapse,lava_tube_collapse(local,radius,reach,seed,texel*density));\r
    if(q.x>.63){\r
      let branch=vec2<f32>(local.x*.78-local.y*.626,local.x*.626+local.y*.78);\r
      collapse=min(collapse,lava_tube_collapse(branch,radius*1.33,reach*.78,seed+8009u,texel*density));\r
    }\r
  }\r
  return vec2<f32>(clamp(relief,-.55,1.10)+collapse,foundation);\r
}\r
\r
fn studioVolcanicCraterFields(dir:vec3<f32>,broad:f32,province:f32)->vec2<f32>{\r
  let volcanic=smoothstep(.22,.65,province);\r
  if(volcanic<=0.0){return vec2<f32>(0.0);}\r
  // Jitter vent centers in 3D so the fields wrap over every meridian.\r
  let shellRadius=24.0*options.sphereFeatureDensity;\r
  let position=dir*shellRadius;\r
  let base=vec3<i32>(floor(position));\r
  let next=select(vec3<i32>(1),vec3<i32>(-1),fract(position)<vec3<f32>(.5));\r
  let upland=smoothstep(-.36,.68,broad);\r
  let belt=smoothstep(-.53,.37,simplex3D(dir*11.0*options.sphereFeatureDensity+seedOffset3(params.seed)));\r
  let chance=volcanic*(.17+.31*upland+.21*belt);\r
  var raised=0.0;\r
  var carved=0.0;\r
  var foundation=0.0;\r
  // The radius and jitter bounds let each axis skip its farther neighbor.\r
  for(var i=0u;i<8u;i++){\r
    let cell=base+next*vec3<i32>(i32(i&1u),i32((i>>1u)&1u),i32(i>>2u));\r
    let key=params.seed^(bitcast<u32>(cell.x)*0x8da6b343u)^\r
      (bitcast<u32>(cell.y)*0xd8163841u)^(bitcast<u32>(cell.z)*0xcb1ab31fu);\r
    let activation=1.0-smoothstep(chance-.09,chance,canyon_bed_random(2,key));\r
    if(activation<=0.0){continue;}\r
    let shape=vec3<f32>(canyon_bed_random(5,key),canyon_bed_random(7,key),canyon_bed_random(11,key));\r
    let site=vec3<f32>(cell)+.22+.56*shape;\r
    let offset=site-position;\r
    if(dot(offset,offset)>.49){continue;}\r
    let lengthFromCenter=length(site);\r
    if(abs(lengthFromCenter-shellRadius)>.24){continue;}\r
    let center=site/lengthFromCenter;\r
    let width=mix(.19,.40,canyon_bed_random(19,key));\r
    let distance2=max(0.0,2.0-2.0*dot(dir,center))*shellRadius*shellRadius;\r
    if(distance2>width*width*2.56){continue;}\r
    let axis=select(vec3<f32>(0,1,0),vec3<f32>(1,0,0),abs(center.y)>.9);\r
    let east=normalize(cross(axis,center));\r
    let north=cross(center,east);\r
    let angle=TWO_PI*canyon_bed_random(23,key);\r
    let facing=east*cos(angle)+north*sin(angle);\r
    let point=vec2<f32>(dot(dir,facing),dot(dir,cross(center,facing)))*(shellRadius/width);\r
    let roughness=.064*simplex3D(dir*142.0*options.sphereFeatureDensity+shape*17.0);\r
    let threshold=mix(.63,.38,upland);\r
    let cinder=smoothstep(threshold-.07,threshold+.07,canyon_bed_random(29,key));\r
    var height=0.0;\r
    if(cinder>0.0){\r
      height+=cinder*volcanic_vent(point,vec3<f32>(mix(.70,1.0,shape.x),shape.y,shape.z),roughness);\r
    }\r
    if(cinder<1.0){\r
      height+=(1.0-cinder)*volcanic_caldera(point,shape,roughness);\r
    }\r
    let edge=1.0-smoothstep(1.30,1.55,length(point));\r
    height*=edge*activation*mix(.31,.62,width/.40);\r
    raised=max(raised,height);\r
    carved=min(carved,height);\r
    foundation=max(foundation,activation*(1.0-smoothstep(.28,1.28,length(point))));\r
  }\r
  return vec2<f32>(raised+carved,foundation);\r
}\r
\r
fn studioRidge(value:f32,width:f32)->f32 {\r
  return max(0.0,1.0-abs(value)/width);\r
}\r
\r
fn studioMountainRange(radial:vec3<f32>,height:f32,broad:f32,offset:vec3<f32>)->f32 {\r
  let dir=radial*options.sphereFeatureDensity;\r
  // Fold the mountain belt and rotate the spurs away from the main divide.\r
  let fault=vec3<f32>(\r
    dot(dir,vec3<f32>(4,-20,22)/30.0),\r
    dot(dir,vec3<f32>(28,10,4)/30.0),\r
    dot(dir,vec3<f32>(-10,20,20)/30.0)\r
  );\r
  let province=simplex3D(dir*5.0-offset);\r
  let fold=simplex3D(dir*9.0+offset);\r
  let fracture=smoothstep(-.28,.52,province+.33*fold);\r
  let belt=fault*vec3<f32>(17,6,9)+vec3<f32>(.72*fold,.25*province,.34*fold);\r
  let line=simplex3D(belt+offset);\r
  let flank=abs(line)/(select(.82,1.22,line>0.0)*mix(1.12,.77,fracture));\r
  let crest=max(0.0,1.0-flank);\r
  // Oblique ribs cross the divide and split as the two limbs descend.\r
  // Intersect each rib with a dipping profile to make wedge-shaped faces.\r
  let spurDomain=vec3<f32>(belt.x*.77+1.05*belt.y,belt.y-.30*belt.x,belt.z);\r
  let spurLine=simplex3D(spurDomain*vec3<f32>(1.72,2.58,2.15)-offset)+.31*line;\r
  let opening=smoothstep(.07,.77,flank)*mix(.23,.55,.5+.5*fold);\r
  let fork=min(abs(spurLine-opening),abs(spurLine+.81*opening));\r
  let spur=studioRidge(fork,.53);\r
  let face=max(0.0,min(spur,1.22-1.09*flank));\r
  let ribs=studioRidge(simplex3D(spurDomain*vec3<f32>(3.7,5.6,4.6)+offset.yzx+.24*spurLine),.48);\r
  let relief=crest*(.57+.19*crest)+mix(.34,.55,fracture)*face+\r
    mix(.13,.28,fracture)*ribs*face*crest-.53;\r
  let uplift=smoothstep(-.58,.69,broad)*mix(.39,1.0,smoothstep(-.60,.34,province));\r
  let strength=select(.68,.89,params.voroMode==1u)*options.sphereRangeWeight;\r
  return strength*uplift*(relief+.82*(broad-height));\r
}\r
\r
fn studioProvinces(dir:vec3<f32>,offset:vec3<f32>,hotspot:f32)->vec4<f32>{\r
  var home=vec4<f32>(1,0,0,0);\r
  if(params.voroMode==2u){home=vec4<f32>(0,1,0,0);}\r
  if(params.voroMode==3u){home=vec4<f32>(0,0,0,1);}\r
  if(options.sphereBlend<=0.0){return home;}\r
  let domain=dir*options.sphereFeatureDensity;\r
  let p=domain*3.45;\r
  let warp=.31*simplex3D(domain*6.7+offset.zxy);\r
  let scores=vec4<f32>(\r
    simplex3D(p+offset+warp),\r
    simplex3D(p-offset.yzx+warp),\r
    simplex3D(p*1.13+offset.zxy-warp),\r
    simplex3D(p*.93-offset-warp)+.68*hotspot\r
  )+home*select(.12,.38,params.voroMode!=0u);\r
  let top=max(max(scores.x,scores.y),max(scores.z,scores.w));\r
  let edge=max(vec4<f32>(0),1.0-(top-scores)/.44);\r
  let weights=edge*edge;\r
  var provinces=mix(home,weights/dot(weights,vec4<f32>(1)),smoothstep(0.0,.92,options.sphereBlend));\r
  // Let granite and alpine interiors keep their own profiles. Leave the\r
  // sandstone and volcanic shares intact at contacts with either one.\r
  let upland=provinces.x+provinces.z;\r
  let granite=provinces.z/max(.001,upland);\r
  provinces.z=upland*mix(granite,smoothstep(.12,.88,granite),.82*options.sphereBlend);\r
  provinces.x=upland-provinces.z;\r
  return provinces;\r
}\r
\r
fn studioCanyonRelief(radial:vec3<f32>,height:f32,broad:f32,offset:vec3<f32>)->f32{\r
  let dir=radial*options.sphereFeatureDensity;\r
  let strata=simplex3D(dir*8.0+offset);\r
  let fracture=simplex3D(dir*24.0-offset+strata*.5);\r
  let exposure=smoothstep(-.40,.32,strata)*smoothstep(-.44,.23,broad);\r
  let remnant=smoothstep(-.24,.30,fracture+.24*strata);\r
  // In some formations the same drainage widens into a basin, in others\r
  // it cuts a slot through the plateau. The shelf profile is applied later.\r
  var channel=simplex3D(dir*12.0-offset.zxy+1.55*strata);\r
  let basin=simplex3D(dir*4.1+offset.yzx);\r
  let winding=smoothstep(-.02,.54,basin)*smoothstep(-.48,-.08,broad)*\r
    (1.0-smoothstep(.42,.92,broad));\r
  var curvature=0.0;\r
  if(winding>0.0){\r
    // Bend an elongated channel field through the basin. Two bend scales\r
    // give long sweeps with smaller turns, and the domain stays spherical.\r
    let normal=normalize(fract(offset*vec3<f32>(.093,.127,.079))-.5+vec3<f32>(.001));\r
    let crosswise=normalize(cross(normal,select(vec3<f32>(0,1,0),vec3<f32>(0,0,1),abs(normal.y)>.9)));\r
    let along=dot(dir,crosswise);\r
    let across=dot(dir,normal);\r
    let lengthwise=along*14.0+1.9*basin;\r
    curvature=.72*sin(lengthwise)+.28*sin(lengthwise*2.31+.60*strata);\r
    let meander=vec3<f32>(10.0*across-1.55*curvature,along*6.0,\r
      9.0*dot(dir,cross(crosswise,normal)))+offset.zxy;\r
    channel=mix(channel,simplex3D(meander),winding*.76);\r
  }\r
  // Bedding can dip toward either bank. On the softer side the same\r
  // canyon opens into an apron, while the harder side holds its scarp.\r
  let dip=smoothstep(-.32,.32,strata)*2.0-1.0;\r
  let bend=mix(dip,curvature,winding*.86);\r
  let bank=(smoothstep(-.15,.15,channel)*2.0-1.0)*bend;\r
  let canyon=abs(channel)/mix(.69,1.40,.5+.5*bank);\r
  let narrow=smoothstep(-.49,.57,fracture);\r
  let width=mix(.47,.24,narrow)*(1.0+.46*winding);\r
  let wall=canyon/width;\r
  var tributary=0.0;\r
  var debris=0.0;\r
  var headcut=0.0;\r
  if(wall>.20 && wall<1.91){\r
    // Branches work back from the trunk along fractures. Their width\r
    // narrows upslope and both the cuts and the debris taper into the host.\r
    let joint=fracture+.31*channel+.19*strata;\r
    let head=smoothstep(.68,1.66,wall);\r
    let span=mix(.27,.105,head)*mix(.74,1.20,.5+.5*bank);\r
    let notch=1.0-smoothstep(.20*span,span,abs(joint));\r
    let weathered=smoothstep(-.48,.45,strata+.28*bank);\r
    let apron=smoothstep(.20,.47,wall);\r
    tributary=notch*apron*(1.0-head)*mix(.27,.57,weathered);\r
    debris=.060*notch*apron*(1.0-smoothstep(.43,.76,wall))*(.40+.60*weathered);\r
    if(wall>.67){\r
      // Persistent joints cut back through the upper rim. Where two arms\r
      // split, the strip between them keeps its cap as a spur or butte.\r
      let rim=smoothstep(.67,1.03,wall)*(1.0-smoothstep(1.46,1.91,wall));\r
      let deflect=simplex3D(dir*35.0+offset.yzx+.48*strata);\r
      let opening=.19*smoothstep(.79,1.49,wall)*smoothstep(-.52,.58,deflect);\r
      let fork=abs(abs(joint+.12*deflect)-opening);\r
      let cut=1.0-smoothstep(.042,mix(.16,.27,weathered),fork);\r
      headcut=rim*cut*mix(.19,.52,weathered)*(1.0-.32*exposure);\r
    }\r
  }\r
  let cutWall=wall-tributary;\r
  // A talus ramp leads to a middle bench, then a steeper caprock wall.\r
  // Its flat top follows the broad regional surface above the smaller hills.\r
  let apron=smoothstep(.04,.40,cutWall);\r
  let hardCap=smoothstep(-.18,.49,strata+.24*fracture);\r
  let capWall=mix(smoothstep(.38,1.14,cutWall),smoothstep(.57,.98,cutWall),hardCap);\r
  let ramp=mix(.32,.53,.5+.5*bank);\r
  let profile=ramp*apron+(1.0-ramp)*capWall;\r
  // A resistant cap follows the slow regional bedding, so small changes\r
  // in the underlying relief don't turn the top into a chain of peaks.\r
  let shelf=.24+.19*broad+.24*basin+.067*strata;\r
  let table=shelf+.065*remnant*exposure;\r
  let depth=mix(.30,.86,smoothstep(-.40,.52,broad))*mix(.76,1.0,narrow);\r
  // Cut an inset channel through the broad floor. The inside bench stays\r
  // shallower, leaving room for the sediment and runoff passes downstream.\r
  let inset=winding*.15*(1.0-smoothstep(.045,.23,cutWall));\r
  let pointBar=winding*.074*max(0.0,bank)*smoothstep(.07,.23,cutWall)*\r
    (1.0-smoothstep(.39,.62,cutWall));\r
  let canyonHeight=table-depth*max(1.0-profile,headcut)-inset+pointBar+debris;\r
  // Resistant beds recess softer sections of the wall. Fade them through\r
  // tributaries so the shelves break at gullies and at the foot of the cliff.\r
  let bed=canyon_bed(radial,canyonHeight,params.seed);\r
  let scarp=smoothstep(.19,.47,cutWall)*(1.0-smoothstep(.91,1.22,cutWall));\r
  let ledgeWeight=scarp*mix(.32,1.0,hardCap)*(1.0-smoothstep(.10,.48,max(tributary,headcut)));\r
  let ledges=ledgeWeight*clamp(bed.displacement,-.068,.068);\r
  let fit=smoothstep(-.66,.04,broad)*mix(.56,1.0,exposure);\r
  return fit*(canyonHeight+ledges-height);\r
}\r
\r
fn graniteDome(cell:Voro3DMetrics,spread:f32)->f32{\r
  let center=pow(max(0.0,1.0-cell.f1Sq/spread),1.45);\r
  let interior=smoothstep(0.0,.24,cell.f2Sq-cell.f1Sq);\r
  return center*(.65+interior*mix(.04,.65,cell.cellVal));\r
}\r
\r
fn studioGraniteRelief(radial:vec3<f32>,height:f32,broad:f32,offset:vec3<f32>,granite:f32,texel:f32)->f32{\r
  let dir=radial*options.sphereFeatureDensity;\r
  let intrusion=simplex3D(dir*5.7+offset.zxy);\r
  let strike=normalize(offset.yzx-vec3<f32>(100.447,122.021,82.673));\r
  let along=dot(dir,strike);\r
  let hills=simplex3D(dir*13.0-offset+intrusion*.51);\r
  let knolls=simplex3D(dir*28.0+offset.yzx+hills*.59);\r
  let district=smoothstep(-.38,.46,intrusion+.39*hills);\r
  let field=dir*13.0-2.1*along*strike+offset+\r
    mix(.48,1.20,district)*vec3<f32>(.60*hills,.67*intrusion,.42*knolls);\r
  let coarse=voro3D_metrics(field);\r
  let mass=graniteDome(coarse,.92);\r
  let foothills=.46*broad+.15*hills+.059*knolls-.10;\r
  let outcrop=smoothstep(-.65,.37,intrusion+.28*hills);\r
  let packing=district*mix(.54,1.0,smoothstep(-.43,.52,knolls-.32*intrusion));\r
  var domes=mix(.31,.94,district)*mass;\r
  if(granite>.14 && outcrop>0.0){\r
    let medium=voro3D_metrics(field.yzx*2.14-offset.zxy);\r
    let knoll=graniteDome(medium,.83);\r
    let interstice=1.0-smoothstep(.45,.94,mass);\r
    domes+=smoothstep(.14,.49,granite)*mix(.09,.61,packing)*knoll*mix(.30,1.0,interstice);\r
    let fine=1.0-smoothstep(.004,.013,texel*options.sphereFeatureDensity);\r
    if(granite>.46 && fine>0.0){\r
      let blocks=voro3D_metrics(field.zxy*4.36-offset.yzx);\r
      domes+=fine*smoothstep(.46,.77,granite)*mix(.06,.17,packing)*graniteDome(blocks,.70);\r
    }\r
  }\r
  return foothills+outcrop*domes-height;\r
}\r
\r
fn studio_mosaic(dir:vec3<f32>)->vec2<f32>{\r
  let key=params.seed*1664525u+1013904223u;\r
  let selection=key>>30u;\r
  let phase=f32(key&65535u)*(TWO_PI/65536.0);\r
  let bend=sin(dot(dir,vec3<f32>(-3.4,6.2,4.1))-phase);\r
  let belt=.72*sin(dot(dir,vec3<f32>(7.2,-4.6,3.8))+phase+.94*bend)+\r
    .28*sin(dot(dir,vec3<f32>(11.8,5.7,-7.3))-phase);\r
  return vec2<f32>(select(smoothstep(.15,.78,belt),0.0,selection==1u),\r
    select(smoothstep(.15,.78,-belt),0.0,selection==0u));\r
}\r
\r
fn studioLandscape(dir:vec3<f32>,height:f32,broad:f32,offset:vec3<f32>,canyon:f32)->f32{\r
  let mode=options.sphereLandscape;\r
  var mixWeights=vec2<f32>(select(0.0,1.0,mode==1u),select(0.0,1.0,mode==2u));\r
  if(mode==3u){mixWeights=studio_mosaic(dir);}\r
  if(mixWeights.x+mixWeights.y<=0.0){return height;}\r
  let province=simplex3D(dir*4.1+offset.yzx);\r
  let local=mix(1.0,smoothstep(-.58,.42,province),options.sphereBlend);\r
  let influence=options.sphereLandscapeStrength*select(local,1.0,mode==3u);\r
  let fold=simplex3D(dir*9.0-offset.zxy);\r
  if(mixWeights.x>0.0){\r
    // The broad profile sets the tablelands. Each contact has its own\r
    // elevation and thickness, and folds tilt whole runs of benches.\r
    let tilt=.09*fold+.08*dot(dir,vec3<f32>(.64,-.72,.38));\r
    let spacing=mix(.37,.65,smoothstep(-.65,.65,province+.27*fold));\r
    let column=(mix(broad,height,.80)-tilt)/spacing;\r
    let seed=params.seed+3167u;\r
    var layer=i32(floor(column));\r
    if(column<canyon_contact(layer,seed)){layer-=1;}\r
    let base=canyon_contact(layer,seed);\r
    let top=canyon_contact(layer+1,seed);\r
    let phase=clamp((column-base)/(top-base),0.0,1.0);\r
    let rim=mix(.38,.62,canyon_bed_random(layer,seed+9029u));\r
    let step=mix(phase,smoothstep(rim-.19,rim+.20,phase),.67);\r
    let table=(base+(top-base)*step)*spacing+tilt;\r
    let wash=abs(simplex3D(dir*23.0+offset.zxy+.97*fold));\r
    let cut=(1.0-smoothstep(.045,.32,wash))*.15;\r
    // Resistant horizons cross the region at different elevations. The\r
    // same eroded outline controls the apron, intermediate bench and cap.\r
    let block=simplex3D(dir*14.0+offset.zxy+.70*fold)+.24*simplex3D(dir*33.0-offset.yzx);\r
    let cap=.60+.36*province+.08*fold+tilt;\r
    let interval=mix(.21,.38,smoothstep(-.65,.65,fold-.28*province));\r
    let apron=smoothstep(-.48,-.27,block);\r
    let lowerCliff=smoothstep(-.28,-.10,block);\r
    let upperCliff=smoothstep(-.02,.16,block);\r
    let basin=mix(table-cut,min(table-cut,cap-1.85*interval),apron);\r
    let benchExposure=smoothstep(-.40,.53,fold+.31*province);\r
    let bench=mix(basin,cap-1.70*interval,mix(.24,.76,benchExposure)*apron);\r
    let shoulder=mix(bench,cap-.87*interval,lowerCliff);\r
    var landform=mix(shoulder,cap,upperCliff);\r
    let brokenRim=smoothstep(-.39,-.24,block)*(1.0-smoothstep(-.065,.085,block));\r
    if(brokenRim>0.0){\r
      // Closely spaced gullies isolate resistant fingers along some rims.\r
      // The pinnacles taper into the same bedrock as the adjoining cliffs.\r
      let weathering=smoothstep(-.05,.54,province+.65*fold);\r
      let fractures=abs(simplex3D(dir*47.0-offset.zxy+1.12*block));\r
      let ribs=(1.0-smoothstep(.055,.31,fractures))*brokenRim*weathering;\r
      let remnant=min(cap-.045,landform+interval*(.86+.56*wash));\r
      landform=mix(landform,max(landform,remnant),ribs);\r
    }\r
    let upland=smoothstep(-.98,-.26,broad);\r
    let strength=max(influence,options.sphereLandscapeStrength*smoothstep(.20,.68,canyon));\r
    let plateau=smoothstep(-.35,.45,province+.32*fold);\r
    return mix(height,landform,mixWeights.x*strength*upland*mix(.54,.91,plateau));\r
  }\r
  // Outward billows grow from the same coarse landscape. Smaller octaves\r
  // break up the shoulders while the host valleys remain between them.\r
  let p=dir*12.0+offset+vec3<f32>(.89*fold,.71*province,-.64*fold);\r
  let a=simplex3D(p);\r
  let b=simplex3D(p.yzx*2.07-offset.zxy+.68*a);\r
  let c=simplex3D(p.zxy*4.31+offset.yzx+.56*b);\r
  let d=simplex3D(p*8.91-offset+.51*c);\r
  let fbm=a+.49*b+.235*c+.106*d;\r
  let lobe=max(0.0,fbm+.31);\r
  let face=smoothstep(.04,.62,lobe);\r
  let ribs=1.0-smoothstep(.025,.32,abs(b+.46*c));\r
  return height+mixWeights.y*influence*(.64*lobe*min(.98,lobe)+.27*face*ribs-.10*face);\r
}\r
\r
fn studioWindRelief(dir:vec3<f32>,height:f32,broad:f32,offset:vec3<f32>,rock:vec4<f32>)->f32{\r
  let arid=studio_dryness(dir,rock,params.seed)*options.sphereBlend;\r
  if(arid<.025){return 0.0;}\r
  let wind=studio_wind_dir(params.seed);\r
  let along=dot(dir,wind);\r
  let across=dot(dir,vec3<f32>(-wind.z,0,wind.x));\r
  let warp=simplex3D(dir*11.0-offset.zxy);\r
  let corridor=simplex3D(vec3<f32>(along*10.0,across*37.0,dir.y*19.0)+offset.yzx+.55*warp);\r
  // Sand collects below the harder rock and thins across exposed uplands.\r
  let sediment=(1.0-smoothstep(.13,.58,broad))*(1.0-smoothstep(.10,.39,abs(height-broad)));\r
  let phase=fract(along*36.0+2.3*warp+.58*corridor+.28*cos(across*31.0+warp*3.1));\r
  let crest=mix(.50,.79,smoothstep(-.46,.46,warp));\r
  let dune=min(phase/crest,(1.0-phase)/(1.0-crest));\r
  let sand=sediment*smoothstep(-.63,.17,corridor)*(.37*dune*dune-.074-.75*(height-broad));\r
  // Wind runs along the resistant ribs. The soft material between them\r
  // wears into broad corridors that can still be cut by downstream runoff.\r
  let rib=studioRidge(corridor,.47);\r
  let erodible=smoothstep(-.53,.37,warp)*smoothstep(-.46,.15,broad);\r
  let abrasion=(1.0-sediment)*erodible*(.32*rib*rib-.19);\r
  let mesaRock=rock.y*smoothstep(-.02,.52,broad);\r
  return arid*smoothstep(.025,.13,arid)*(sand+abrasion)*(1.0-.65*mesaRock);\r
}\r
\r
fn studioFaultRelief(dir:vec3<f32>,height:f32,broad:f32,offset:vec3<f32>,rock:vec4<f32>)->f32{\r
  let crystalline=4.0*rock.z*rock.w;\r
  let sedimentary=4.0*rock.y*rock.z;\r
  let susceptible=options.sphereBlend*(.37*rock.w+.67*crystalline+.36*sedimentary);\r
  if(susceptible<.025){return 0.0;}\r
\r
  let strike=normalize(fract(offset*vec3<f32>(.109,.073,.127))-.5+vec3<f32>(.001));\r
  let east=normalize(cross(strike,select(vec3<f32>(0,1,0),vec3<f32>(1,0,0),abs(strike.y)>.9)));\r
  let plane=vec3<f32>(dot(dir,east),dot(dir,strike),dot(dir,cross(east,strike)));\r
  let extension=simplex3D(dir*4.6+offset.zxy);\r
  let activity=smoothstep(-.43,.37,extension);\r
  if(activity<=0.0){return 0.0;}\r
  let blocks=plane*vec3<f32>(15.0,5.0,10.0)+vec3<f32>(.84,.24,.45)*extension;\r
  let trace=simplex3D(blocks-offset);\r
  let relay=simplex3D(blocks*vec3<f32>(.74,2.7,1.6)+offset.yzx);\r
\r
  // The hanging wall drops into the rift. Its footwall has a steep face\r
  // and a long tilted backslope. A relay passes the throw between strands.\r
  let slip=mix(.24,.76,smoothstep(-.56,.57,relay));\r
  let hanging=trace+.19*relay;\r
  let scarp=smoothstep(-.08,.135,hanging);\r
  let backSlope=1.0-smoothstep(.25,.97,hanging);\r
  let floor=1.0-smoothstep(.12,mix(.34,.68,slip),abs(hanging+.21));\r
  let outlet=smoothstep(.13,.57,abs(relay-.25*trace));\r
  let rift=floor*(.72+.28*outlet);\r
  let shoulder=scarp*backSlope*(.29+.17*slip);\r
  let shelf=smoothstep(.04,.20,hanging)*(1.0-smoothstep(.22,.41,hanging));\r
  let tilt=.17*scarp*hanging*smoothstep(-.49,.68,broad);\r
  let incision=(.42+.33*slip)*rift;\r
  // Preserve rough bedrock above the scarp and partially bury it on the\r
  // valley floor, where runoff will cut tributaries into the faulted blocks.\r
  let fill=.58*rift*(broad-height);\r
  return susceptible*activity*(shoulder+.10*shelf*crystalline-tilt-incision+fill);\r
}\r
\r
// The same contact field runs through the whole sphere. It shapes rock\r
// where two provinces meet and leaves each pure province to its own profile.\r
fn studioContactRelief(dir:vec3<f32>,broad:f32,offset:vec3<f32>,rock:vec4<f32>)->f32{\r
  let graniteBelt=4.0*rock.x*rock.z;\r
  let tiltedBeds=4.0*rock.x*rock.y;\r
  let lavaPlateau=4.0*rock.w*rock.y;\r
  let sandstoneFins=4.0*rock.z*rock.y;\r
  let volcanicHighlands=4.0*rock.w*rock.x;\r
  let strength=graniteBelt+tiltedBeds+lavaPlateau+sandstoneFins+volcanicHighlands;\r
  if(strength<.008){return 0.0;}\r
  let uplift=smoothstep(-.57,.32,broad);\r
  if(uplift<=0.0){return 0.0;}\r
\r
  let axis=normalize(fract(offset*vec3<f32>(.071,.113,.137))-.5+vec3<f32>(.001));\r
  let across=normalize(cross(axis,select(vec3<f32>(0,1,0),vec3<f32>(0,0,1),abs(axis.y)>.90)));\r
  let chart=vec3<f32>(dot(dir,across),dot(dir,cross(axis,across)),dot(dir,axis));\r
  let flexure=simplex3D(dir*6.3+offset.zxy);\r
  let belt=chart*vec3<f32>(22.0,8.0,11.0)+vec3<f32>(.68,.23,.39)*flexure;\r
  let line=simplex3D(belt+offset.yzx);\r
  let joints=simplex3D(belt*vec3<f32>(1.39,2.53,2.12)-offset+.24*line);\r
\r
  // Granite ribs survive along the divide. Weathering widens the spaces\r
  // between them toward the domes and breaks their ends into rock steps.\r
  let rib=studioRidge(line,.81);\r
  let joint=1.0-smoothstep(.03,.26,abs(joints));\r
  let granite=.42*(rib*mix(.64,1.0,rib)-.29)-.14*joint*rib;\r
\r
  // Folded beds leave triangular remnants on the softer flanks of a range.\r
  let dip=mix(.53,1.03,smoothstep(-.52,.52,flexure));\r
  let flank=abs(line)/select(dip,1.45-dip,line>0.0);\r
  let jointLine=abs(joints+.41*line);\r
  let wedge=max(0.0,min(1.0-flank,1.02-1.35*jointLine));\r
  let flankGully=smoothstep(.11,.46,flank)*(1.0-smoothstep(.84,1.24,flank))*\r
    smoothstep(.27,.61,jointLine);\r
  let flatiron=.77*wedge-.25*flankGully-.20;\r
\r
  // Resistant lava caps a valley fill. Breaches in the cap become outlets\r
  // for runoff during the following erosion passes.\r
  let flow=smoothstep(-.42,.34,line+.37*flexure);\r
  let breach=1.0-smoothstep(.06,.42,abs(joints+.44*line));\r
  let cap=flow*mix(.19,.43,smoothstep(-.44,.44,flexure))*(1.0-.84*breach);\r
  let terrace=cap-.19*breach*smoothstep(.12,.76,flow)-.12;\r
\r
  // Broken sedimentary ribs taper into the older crystalline floor. The\r
  // crest is offset by joints so the fins bend, break, and vary in length.\r
  let finAxis=abs(line+.21*joints);\r
  let fin=1.0-smoothstep(.08,.42,finAxis);\r
  let cover=smoothstep(-.48,.33,joints+.32*flexure);\r
  let shoulder=1.0-smoothstep(.23,.68,finAxis);\r
  let fins=cover*(.47*fin*fin+.15*shoulder)-.16;\r
\r
  // Solid lava shoulders follow the flanks of the alpine divide. Glancing\r
  // fractures open into gullies while the harder flow tops remain above them.\r
  let flankRock=smoothstep(.14,.52,flank)*(1.0-smoothstep(.78,1.26,flank));\r
  let flowCap=smoothstep(-.42,.24,joints-.51*line)*flankRock;\r
  let spurCut=joint*smoothstep(.27,.93,flank);\r
  let basalt=.49*flowCap-.24*spurCut-.07;\r
  return uplift*smoothstep(.008,.065,strength)*\r
    (graniteBelt*granite+tiltedBeds*flatiron+lavaPlateau*terrace+\r
     sandstoneFins*fins+volcanicHighlands*basalt);\r
}\r
\r
// Hotspots track an oblique arc. Older cones broaden and subside along it.\r
// The surrounding swell is wide enough for islands to emerge in ocean basins.\r
fn studioIslandArc(dir:vec3<f32>,broad:f32,texel:f32)->vec2<f32>{\r
  var height=0.0;\r
  var influence=0.0;\r
  var collapse=0.0;\r
  let density=options.sphereFeatureDensity;\r
  for(var chain=0u;chain<6u;chain++){\r
    let q=(seedOffset3(params.seed+chain*7302013u)-vec3<f32>(17.173,31.947,47.521))/\r
      vec3<f32>(131,137,149);\r
    let y=1.72*q.x-.86;\r
    let ring=sqrt(1.0-y*y);\r
    let angle=TWO_PI*q.y;\r
    let center=vec3<f32>(ring*cos(angle),y,ring*sin(angle));\r
    let span=max(0.0,2.0-2.0*dot(dir,center));\r
    if(span*density*density>.065){continue;}\r
    let east=vec3<f32>(-sin(angle),0,cos(angle));\r
    let course=normalize(east+(q.z-.5)*1.55*cross(center,east));\r
    if(q.z>.30){\r
      let tangent=cross(center,course);\r
      let flow=normalize(tangent+(q.y-.5)*course);\r
      let local=density*vec2<f32>(dot(dir,flow),dot(dir,cross(center,flow)));\r
      collapse=min(collapse,lava_tube_collapse(local,.047,mix(.12,.18,q.z),params.seed+chain*23179u,texel*density));\r
    }\r
    for(var i=0u;i<4u;i++){\r
      let age=f32(i)/3.0;\r
      let vent=normalize(center+course*((age-.50)*.22/density));\r
      let size=mix(.065,.029,age)*mix(.86,1.2,q.z)/density;\r
      let d=sqrt(max(0.0,2.0-2.0*dot(dir,vent)))/size;\r
      let tangent=normalize(course-vent*dot(vent,course));\r
      let local=vec2<f32>(dot(dir,tangent),dot(dir,cross(vent,tangent)))/size;\r
      let young=mix(.91,.37,age)*mix(.90,1.1,q.z);\r
      let shape=vec3<f32>(young,q.z,fract(q.x+age*1.7));\r
      let cone=volcanic_vent(local,shape,.065*simplex3D(dir*96.0+q*17.0));\r
      let pedestal=.32*(1.0-smoothstep(.22,1.64,d))*(1.0-smoothstep(-.60,.28,broad));\r
      height=max(height,cone+pedestal);\r
      influence=max(influence,1.0-smoothstep(.48,1.76,d));\r
    }\r
  }\r
  return vec2<f32>(height+collapse,influence);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeStudioSphereRelief(@builtin(global_invocation_id) gid:vec3<u32>){\r
  let x=i32(gid.x)+frame.originX;\r
  let y=i32(gid.y)+frame.originY;\r
  let last=i32(frame.fullWidth)-1;\r
  if(x>last||y>last){return;}\r
  let col=x%last;\r
  let raw=studioSphereHeight(col,y,last);\r
  let step=PI/f32(last);\r
  let latitude=f32(y)*step;\r
  let longitude=2.0*f32(col)*step;\r
  let radial=sin(latitude);\r
  let dir=vec3<f32>(select(radial*cos(longitude),0.0,y==0||y==last),cos(latitude),\r
    select(radial*sin(longitude),0.0,y==0||y==last));\r
  var broad=raw;\r
  if(params.voroMode!=3u||options.sphereBlend>0.0){\r
    let spanY=max(1,i32(round(f32(last)*.017/options.sphereFeatureDensity)));\r
    let spanX=max(1,i32(round(f32(spanY)/max(.50,2.0*radial))));\r
    let around=studioSphereHeight(col-spanX,y-spanY,last)+studioSphereHeight(col+spanX,y-spanY,last)+\r
      studioSphereHeight(col-spanX,y+spanY,last)+studioSphereHeight(col+spanX,y+spanY,last);\r
    // The longitude box ceases to describe a square near a pole.\r
    broad=mix(raw,.28*raw+.18*around,smoothstep(.035,.155,radial));\r
  }\r
  let texel=step*max(1.0,2.0*radial);\r
  storeRGBA(x,y,0,studio_sphere_relief(dir,raw,broad,texel));\r
}\r
\r
fn studio_sphere_relief(dir:vec3<f32>,raw:f32,broad:f32,texel:f32)->vec4<f32>{\r
  let radial=length(dir.xz);\r
  let offset=seedOffset3(params.seed);\r
  var arc=vec2<f32>(0);\r
  if(options.sphereBlend>0.0){arc=studioIslandArc(dir,broad,texel);}\r
  let weights=studioProvinces(dir,offset,arc.y);\r
  var relief=0.0;\r
  if(weights.x>0.0){relief+=weights.x*studioMountainRange(dir,raw,broad,offset);}\r
  if(weights.z>0.0){relief+=weights.z*studioGraniteRelief(dir,raw,broad,offset,weights.z,texel);}\r
  if(weights.w>0.0){\r
    let volcanic=studioVolcanicRelief(dir,texel);\r
    let craters=studioVolcanicCraterFields(dir,broad,weights.w);\r
    relief+=weights.w*(volcanic.x+craters.x+max(volcanic.y,craters.y)*(broad-raw));\r
  }\r
  if(weights.y>0.0){\r
    // Broad caprock takes over inside sandstone country while the\r
    // existing province weights still blend it into neighboring ranges.\r
    let caprock=smoothstep(.10,.76,weights.y);\r
    relief=relief*((1.0-caprock)/max(.001,1.0-weights.y))+\r
      caprock*studioCanyonRelief(dir,raw,broad,offset);\r
  }\r
  relief+=studioContactRelief(dir,broad,offset,weights);\r
  relief+=studioWindRelief(dir,raw,broad,offset,weights);\r
  relief+=studioFaultRelief(dir,raw,broad,offset,weights);\r
  // A hot island can interrupt its host province without a terrain seam.\r
  relief+=arc.x*options.sphereBlend;\r
  var cap=0.0;\r
  if(radial<.23){\r
    // Reintroduce midsize landforms where longitude-based erosion fades.\r
    // The noise is evaluated in 3D, so ridges continue across the pole.\r
    let folds=simplex3D(dir*27.0+offset.zxy);\r
    let crest=studioRidge(simplex3D(dir*49.0-offset+folds*.69),.75);\r
    let rubble=simplex3D(dir*79.0+offset.yzx);\r
    let sharp=mix(.16,.26,weights.x+weights.y*.6);\r
    cap=(1.0-smoothstep(.075,.23,radial))*(.11*folds+.68*sharp*(crest*crest-.36)+.052*rubble);\r
  }\r
  var height=raw+relief+cap;\r
  if(options.sphereLandscape!=0u&&options.sphereLandscapeStrength>0.0){\r
    height=studioLandscape(dir,height,broad,offset,weights.y);\r
  }\r
  return vec4<f32>(height,weights.yzw);\r
}\r
\r
fn applyStudioSphereErosion(gid:vec3<u32>,mountain:bool){\r
  let x=i32(gid.x)+frame.originX;\r
  let y=i32(gid.y)+frame.originY;\r
  let last=i32(frame.fullWidth)-1;\r
  if(x>last||y>last){return;}\r
  let col=x%last;\r
  let sample=loadPrevRGBA(col,y,0);\r
  let h=sample.x;\r
  let canyon=sample.y;\r
  let regional=options.sphereBlend>0.0;\r
  let ranges=params.voroMode<=1u||regional;\r
  if(y==0||y==last||(!mountain&&ranges&&!regional)){\r
    storeRGBA(x,y,0,sample);\r
    return;\r
  }\r
  let step=PI/f32(last);\r
  let latitude=f32(y)*step;\r
  let longitude=2.0*f32(col)*step;\r
  let radial=sin(latitude);\r
  let dir=vec3<f32>(radial*cos(longitude),cos(latitude),radial*sin(longitude));\r
  let east=vec3<f32>(-sin(longitude),0,cos(longitude));\r
  let north=cross(east,dir);\r
  var rise:vec2<f32>;\r
  var bankBend=vec2<f32>(0);\r
  if(mountain){\r
    // The angular window stays wide on smaller bakes and near the poles.\r
    let guideY=max(2,i32(round(f32(last)*select(.012,.0045,ranges))));\r
    let guideX=max(1,i32(round(f32(guideY)/max(.5,2.0*radial))));\r
    rise=vec2<f32>(\r
      (studioSphereHeight(col+guideX,y,last)-studioSphereHeight(col-guideX,y,last))/f32(guideX),\r
      (studioSphereHeight(col,y-guideY,last)-studioSphereHeight(col,y+guideY,last))/f32(guideY)\r
    );\r
  }else{\r
    // The local gullies read the mountain cuts from the previous dispatch.\r
    let localX=studioSphereHeight(col+1,y,last)-studioSphereHeight(col-1,y,last);\r
    let localY=studioSphereHeight(col,y-1,last)-studioSphereHeight(col,y+1,last);\r
    let wideHigh=vec2<f32>(studioSphereHeight(col+4,y,last),studioSphereHeight(col,y-4,last));\r
    let wideLow=vec2<f32>(studioSphereHeight(col-4,y,last),studioSphereHeight(col,y+4,last));\r
    rise=mix(vec2<f32>(localX,localY),(wideHigh-wideLow)*.25,.76);\r
    if(canyon>0.0){\r
      // Match the angular span along both axes without fetching more heights.\r
      let ratio=max(.5,2.0*radial);\r
      let referenceSpan=(.023/(4.0*step))*(f32(last)/1000.0);\r
      bankBend=(wideHigh+wideLow-2.0*h)*vec2<f32>(1.0/(ratio*ratio),1.0)*referenceSpan;\r
    }\r
  }\r
  let dx=rise.x/(4.0*step*max(radial,.03));\r
  let dy=rise.y/(2.0*step);\r
  let grade=vec2<f32>(dx,dy);\r
  let angularSample=step*max(1.0,2.0*radial);\r
  storeRGBA(x,y,0,vec4<f32>(studio_point_erosion(dir,sample,grade,east*dx+north*dy,bankBend,\r
    angularSample,mountain,ranges),sample.yzw));\r
}\r
\r
fn studio_point_erosion(dir:vec3<f32>,sample:vec4<f32>,rise:vec2<f32>,gradient:vec3<f32>,\r
  bankBend:vec2<f32>,angularSample:f32,mountain:bool,ranges:bool)->f32{\r
  let h=sample.x;\r
  let canyon=sample.y;\r
  let granite=sample.z;\r
  let volcanic=sample.w;\r
  let alpine=clamp(1.0-canyon-granite-volcanic,0.0,1.0);\r
  let grade=.023*length(gradient);\r
  let mountainWear=smoothstep(.042,.25,grade)*select(1.0,.50,params.voroMode==3u);\r
  let rangeWear=smoothstep(-.58,.10,h)*mix(.82,1.0,mountainWear);\r
  let localWear=smoothstep(.06,.43,grade)*(canyon+.55*volcanic+.10*granite);\r
  let wear=select(\r
    select(smoothstep(.06,.43,grade),mountainWear,mountain),\r
    select(localWear,rangeWear*(1.16*alpine+.15*canyon+.45*volcanic+.12*granite),mountain),\r
    ranges);\r
  let polar=smoothstep(.055,.25,length(dir.xz));\r
  if(wear<=0.0){\r
    return h;\r
  }\r
  let blend=smoothstep(-.19,.19,dir.y);\r
  var delta=0.0;\r
  if(blend>0.0){\r
    let chart=studioErosionChart(dir,gradient,1.0,angularSample);\r
    if(mountain){delta+=blend*studioMountainCut(chart,h,ranges);}\r
    else{delta+=blend*studioGullyCut(chart,h);}\r
  }\r
  if(blend<1.0){\r
    let chart=studioErosionChart(dir,gradient,-1.0,angularSample);\r
    if(mountain){delta+=(1.0-blend)*studioMountainCut(chart,h,ranges);}\r
    else{delta+=(1.0-blend)*studioGullyCut(chart,h);}\r
  }\r
  delta*=wear;\r
  if(mountain){\r
    let eroded=h+polar*delta;\r
    let upland=max(0.0,eroded-.42);\r
    // Compress the vertical relief of the upper mountain belt. Crests and\r
    // branch cuts keep their shapes while broad slopes keep a wider base.\r
    let compression=.29*upland*upland/(.34+upland)*polar*alpine;\r
    return eroded-compression;\r
  }\r
  let elevation=h+delta;\r
  var ledge=0.0;\r
  if(canyon>0.0){\r
    let strata=canyon_bed(dir,elevation,params.seed);\r
    let resistant=smoothstep(.25,.83,strata.cement);\r
    let gully=canyon_gully_wear(rise,bankBend,grade,-delta);\r
    let exposure=smoothstep(.075,.49,grade)*\r
      (1.0-mix(.64,.24,resistant)*smoothstep(.025,.22,-delta));\r
    // Recess the shelf through the tributary and leave the adjacent spur proud.\r
    ledge+=canyon*(.72*strata.displacement*exposure*(1.0-mix(.89,.63,resistant)*gully)-.087*gully);\r
  }\r
  if(volcanic>0.0&&grade>.12){\r
    let flowBed=basalt_flow(dir,elevation,params.seed);\r
    let exposure=volcanic*smoothstep(.12,.56,grade);\r
    let scour=smoothstep(.02,.20,-delta);\r
    ledge+=exposure*((1.0+.72*alpine)*flowBed.displacement-.065*flowBed.ash*scour);\r
  }\r
  return h+polar*(delta+ledge);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeStudioSphereMountainErosion(@builtin(global_invocation_id) gid:vec3<u32>){\r
  applyStudioSphereErosion(gid,true);\r
}\r
\r
@compute @workgroup_size(8,8,1)\r
fn computeStudioSphereErosion(@builtin(global_invocation_id) gid:vec3<u32>){\r
  applyStudioSphereErosion(gid,false);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeTerrainNoise(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {\r
    return;\r
  }\r
\r
  let pos = fetchPos(fx, fy, fz);\r
  let v0 = generateTerrainNoise(pos, params);\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeSmokeNoise(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {\r
    return;\r
  }\r
\r
  let pos = fetchPos(fx, fy, fz);\r
  let v0 = generateSmokeNoise(pos, params);\r
  writeChannel(fx, fy, fz, v0, options.outputChannel, 0u);\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeHydrologyErosionHeightfield(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  if (readFrom3D() || writeTo3D()) {\r
    return;\r
  }\r
\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {\r
    return;\r
  }\r
\r
  let src = loadPrevClamped2D(fx, fy, fz);\r
  let pos = fetchPos(fx, fy, fz);\r
\r
  var baseHeight = src.x;\r
  var guideHeight = src.x;\r
  let rawSlope = resolveFiniteSlope2D(fx, fy, fz);\r
  var guideSlope = rawSlope;\r
\r
  if (params.turbulence != 0u) {\r
    baseHeight = src.w;\r
    guideHeight = src.x;\r
    guideSlope = src.yz;\r
\r
    if (length(guideSlope) < 1e-8) {\r
      guideSlope = rawSlope;\r
    }\r
  }\r
\r
  let steerSlope = mix(rawSlope, guideSlope, 0.82);\r
  let fadeHeight = mix(baseHeight, guideHeight, 0.35);\r
\r
  var erosionScale = params.zoom;\r
  if (abs(erosionScale) < 1e-6) {\r
    erosionScale = 0.15;\r
  }\r
\r
  var domainScale = params.freq;\r
  if (abs(domainScale) < 1e-6) {\r
    domainScale = 1.0;\r
  }\r
\r
  var erosionStrength = options.heightScale;\r
  if (abs(erosionStrength) < 1e-6) {\r
    erosionStrength = 1.0;\r
  }\r
  erosionStrength *= 0.22;\r
\r
  var gullyWeight = params.exp1;\r
  if (abs(gullyWeight) < 1e-6) {\r
    gullyWeight = 0.5;\r
  }\r
\r
  var carrierWeight = max(params.edgeK, 0.0);\r
  if (carrierWeight < 1e-6) {\r
    carrierWeight = 0.24;\r
  }\r
  carrierWeight = clamp01(carrierWeight);\r
\r
  var steeringWeight = max(params.time, 0.0);\r
  if (steeringWeight < 1e-6) {\r
    steeringWeight = 1.10;\r
  }\r
\r
  var detail = params.seedAngle;\r
  if (abs(detail) < 1e-6) {\r
    detail = 1.5;\r
  }\r
\r
  var fadeScale = params.exp2;\r
  if (abs(fadeScale) < 1e-6) {\r
    fadeScale = 1.6666667;\r
  }\r
\r
  var cellScale = params.threshold;\r
  if (abs(cellScale) < 1e-6) {\r
    cellScale = 0.7;\r
  }\r
\r
  var normalization = params.rippleFreq;\r
  if (abs(normalization) < 1e-6) {\r
    normalization = 0.5;\r
  }\r
  normalization = clamp01(normalization);\r
\r
  var assumedSlopeValue = params.warpAmp;\r
  if (abs(assumedSlopeValue) < 1e-6) {\r
    assumedSlopeValue = 0.7;\r
  }\r
  assumedSlopeValue = max(assumedSlopeValue, 1e-4);\r
\r
  var assumedSlopeMix = params.gaborRadius;\r
  if (abs(assumedSlopeMix) < 1e-6) {\r
    assumedSlopeMix = 1.0;\r
  }\r
  assumedSlopeMix = clamp01(assumedSlopeMix);\r
\r
  var onsetScale = params.terraceStep;\r
  if (abs(onsetScale) < 1e-6) {\r
    onsetScale = 8.0;\r
  }\r
  onsetScale = max(onsetScale / 8.0, 1e-4);\r
\r
  let rounding = vec4<f32>(\r
    0.10,\r
    0.00,\r
    0.10,\r
    max(params.lacunarity, 1.0)\r
  );\r
\r
  let onset = vec4<f32>(\r
    1.25,\r
    1.25,\r
    2.80,\r
    1.50\r
  ) * onsetScale;\r
\r
  let assumedSlope = vec2<f32>(assumedSlopeValue, assumedSlopeMix);\r
\r
  let seedShift = vec2<f32>(\r
    f32(params.seed & 65535u) * 0.00001173,\r
    f32((params.seed >> 16u) & 65535u) * 0.00000937\r
  );\r
\r
  let domainP =\r
    pos.xy * domainScale +\r
    vec2<f32>(params.xShift, params.yShift) +\r
    seedShift;\r
\r
  let fadeTarget = clamp(((fadeHeight - 0.5 + params.zShift) * 2.0) * fadeScale, -1.0, 1.0);\r
  let pixelSpan = pixelSpan2D(fx, fy, fz);\r
\r
  var ridgeMap = 0.0;\r
  let h = erosionFilter(\r
    domainP,\r
    vec3<f32>(baseHeight, steerSlope.x, steerSlope.y),\r
    fadeTarget,\r
    erosionStrength,\r
    gullyWeight,\r
    carrierWeight,\r
    steeringWeight,\r
    detail,\r
    rounding,\r
    onset,\r
    assumedSlope,\r
    erosionScale,\r
    max(params.octaves, 1u),\r
    max(params.lacunarity, 1.0),\r
    max(params.gain, 1e-4),\r
    cellScale,\r
    normalization,\r
    pixelSpan,\r
    &ridgeMap\r
  );\r
\r
  let terrainHeightOffsetConst = options.baseRadius;\r
\r
  let offset = terrainHeightOffsetConst * h.w;\r
\r
  let erodedHeight = baseHeight + h.x + offset;\r
  let outSlope = steerSlope + h.yz;\r
  let ridgeMapEncoded = clamp01(ridgeMap * 0.5 + 0.5);\r
\r
  storeRGBA(\r
    fx,\r
    fy,\r
    fz,\r
    vec4<f32>(erodedHeight, outSlope.x, outSlope.y, ridgeMapEncoded)\r
  );\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeHydrologyGuideField(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  if (readFrom3D() || writeTo3D()) {\r
    return;\r
  }\r
\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {\r
    return;\r
  }\r
\r
  let src = loadPrevClamped2D(fx, fy, fz);\r
  let rawHeight = src.x;\r
\r
  var sigma = abs(params.threshold);\r
  if (sigma < 1e-6) {\r
    sigma = 0.90;\r
  }\r
\r
  var guideBlend = params.exp1;\r
  if (abs(guideBlend) < 1e-6) {\r
    guideBlend = 0.35;\r
  }\r
  guideBlend = clamp01(guideBlend);\r
\r
  let blurredC = guideHeightAt(fx, fy, fz, sigma);\r
  let blurredL = guideHeightAt(fx - 1, fy, fz, sigma);\r
  let blurredR = guideHeightAt(fx + 1, fy, fz, sigma);\r
  let blurredD = guideHeightAt(fx, fy - 1, fz, sigma);\r
  let blurredU = guideHeightAt(fx, fy + 1, fz, sigma);\r
\r
  let guideHeight = mix(rawHeight, blurredC, guideBlend);\r
  let guideL = mix(loadPrevClamped2D(fx - 1, fy, fz).x, blurredL, guideBlend);\r
  let guideR = mix(loadPrevClamped2D(fx + 1, fy, fz).x, blurredR, guideBlend);\r
  let guideD = mix(loadPrevClamped2D(fx, fy - 1, fz).x, blurredD, guideBlend);\r
  let guideU = mix(loadPrevClamped2D(fx, fy + 1, fz).x, blurredU, guideBlend);\r
\r
  let pL = fetchPosClamped2D(fx - 1, fy, fz);\r
  let pR = fetchPosClamped2D(fx + 1, fy, fz);\r
  let pD = fetchPosClamped2D(fx, fy - 1, fz);\r
  let pU = fetchPosClamped2D(fx, fy + 1, fz);\r
\r
  let dx = max(abs(pR.x - pL.x), 1e-6);\r
  let dy = max(abs(pU.y - pD.y), 1e-6);\r
\r
  let guideSlopeX = (guideR - guideL) / dx;\r
  let guideSlopeY = (guideU - guideD) / dy;\r
\r
  storeRGBA(\r
    fx,\r
    fy,\r
    fz,\r
    vec4<f32>(guideHeight, guideSlopeX, guideSlopeY, rawHeight)\r
  );\r
}\r
\r
fn computeHydroDrainageField(fx: i32, fy: i32, fz: i32) -> vec4<f32> {\r
  let coarseSigma = 1.75;\r
\r
  let hC = blurredHeightAt(fx, fy, fz, coarseSigma);\r
  let hL = blurredHeightAt(fx - 1, fy, fz, coarseSigma);\r
  let hR = blurredHeightAt(fx + 1, fy, fz, coarseSigma);\r
  let hD = blurredHeightAt(fx, fy - 1, fz, coarseSigma);\r
  let hU = blurredHeightAt(fx, fy + 1, fz, coarseSigma);\r
\r
  let pL = fetchPosClamped2D(fx - 1, fy, fz);\r
  let pR = fetchPosClamped2D(fx + 1, fy, fz);\r
  let pD = fetchPosClamped2D(fx, fy - 1, fz);\r
  let pU = fetchPosClamped2D(fx, fy + 1, fz);\r
\r
  let dx = max(abs(pR.x - pL.x), 1e-6);\r
  let dy = max(abs(pU.y - pD.y), 1e-6);\r
\r
  let slope = vec2<f32>(\r
    (hR - hL) / dx,\r
    (hU - hD) / dy\r
  );\r
\r
  let flowDir = -safeNormalize2(slope);\r
\r
  let ridgeBroad = blurredRidgeAt(fx, fy, fz, 1.6);\r
  let valleyPrior = 1.0 - smoothstep(-0.12, 0.08, ridgeBroad);\r
\r
  let valleyDepth = max(0.0, (hL + hR + hD + hU) * 0.25 - hC);\r
  let concavityGain = max(abs(params.edgeK), 1e-4) * 36.0;\r
  let concavityMask = clamp01(valleyDepth * concavityGain);\r
\r
  let slopeOnset = max(abs(params.warpAmp), 1e-4);\r
  let slopeMask = easeOut(clamp01(length(slope) / slopeOnset));\r
\r
  let contrast = max(abs(params.exp1), 1e-4);\r
  let gain = max(abs(params.exp2), 1e-4);\r
\r
  var drainage = valleyPrior * concavityMask * slopeMask;\r
  drainage = pow(clamp01(drainage), contrast);\r
  drainage = clamp01(drainage * gain);\r
\r
  return vec4<f32>(\r
    drainage,\r
    valleyPrior,\r
    flowDir.x * 0.5 + 0.5,\r
    flowDir.y * 0.5 + 0.5\r
  );\r
}\r
\r
@compute @workgroup_size(8, 8, 1)\r
fn computeHydrologyDrainageMask(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  if (readFrom3D() || writeTo3D()) {\r
    return;\r
  }\r
\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
\r
  if (fx < 0 || fy < 0 || fx >= i32(frame.fullWidth) || fy >= i32(frame.fullHeight)) {\r
    return;\r
  }\r
\r
  let outCol = computeHydroDrainageField(fx, fy, fz);\r
  storeRGBA(fx, fy, fz, outCol);\r
}\r
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
// Height fetch\r
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
fn wrapSphereLon(lon: i32, width: i32) -> i32 {\r
    let segments = max(width - 1, 1);\r
    return ((lon % segments) + segments) % segments;\r
}\r
\r
fn loadSphereHeight(lon: i32, lat: i32, width: i32, height: i32, layer: i32) -> f32 {\r
    let x = wrapSphereLon(lon, width);\r
    let y = clamp(lat, 0, height - 1);\r
    return textureLoad(inputTex, vec2<i32>(x, y), layer, 0).x;\r
}\r
\r
fn sphereUnitFromAngles(theta: f32, phi: f32) -> vec3<f32> {\r
    let sTh = sin(theta);\r
    return vec3<f32>(sTh * cos(phi), sTh * sin(phi), cos(theta));\r
}\r
\r
fn sphereSurfacePos(lat: i32, theta: f32, phi: f32, heightValue: f32, maxLat: i32) -> vec3<f32> {\r
    let r = options.baseRadius + heightValue * options.heightScale;\r
\r
    if (lat <= 0) {\r
        return vec3<f32>(0.0, 0.0, r);\r
    }\r
\r
    if (lat >= maxLat) {\r
        return vec3<f32>(0.0, 0.0, -r);\r
    }\r
\r
    return sphereUnitFromAngles(theta, phi) * r;\r
}\r
\r
// Sphere normals with logical longitude wrapping.\r
// The mesh keeps a duplicate seam column at lon == segments for Babylon/UVs, but\r
// the sampler treats longitude as modulo segments. This keeps lon 0 and lon N\r
// numerically identical and avoids the hard normal/color seam that shows up as a\r
// zipper around the planet.\r
@compute @workgroup_size(WGX, WGY, 1)\r
fn computeSphereNormal(@builtin(global_invocation_id) gid: vec3<u32>) {\r
    let fx = i32(frame.originX) + i32(gid.x);\r
    let fy = i32(frame.originY) + i32(gid.y);\r
    let w  = i32(frame.fullWidth);\r
    let h  = i32(frame.fullHeight);\r
\r
    if (fx < 0 || fy < 0 || fx >= w || fy >= h) {\r
        return;\r
    }\r
\r
    let segments = max(w - 1, 1);\r
    let maxLat = h - 1;\r
    let lon = wrapSphereLon(fx, w);\r
    let lat = clamp(fy, 0, maxLat);\r
\r
    let baseH = loadSphereHeight(lon, lat, w, h, frame.layerIndex);\r
    let dPhi = 2.0 * PI / f32(segments);\r
    let dTheta = PI / f32(max(maxLat, 1));\r
    let theta = f32(lat) * dTheta;\r
    let phi = f32(lon) * dPhi;\r
\r
    var n: vec3<f32>;\r
\r
    if (lat <= 0) {\r
        n = vec3<f32>(0.0, 0.0, 1.0);\r
    } else if (lat >= maxLat) {\r
        n = vec3<f32>(0.0, 0.0, -1.0);\r
    } else {\r
        let hW = loadSphereHeight(lon - 1, lat, w, h, frame.layerIndex);\r
        let hE = loadSphereHeight(lon + 1, lat, w, h, frame.layerIndex);\r
        let hS = loadSphereHeight(lon, lat - 1, w, h, frame.layerIndex);\r
        let hN = loadSphereHeight(lon, lat + 1, w, h, frame.layerIndex);\r
\r
        let pW = sphereSurfacePos(lat, theta, phi - dPhi, hW, maxLat);\r
        let pE = sphereSurfacePos(lat, theta, phi + dPhi, hE, maxLat);\r
        let pS = sphereSurfacePos(lat - 1, theta - dTheta, phi, hS, maxLat);\r
        let pN = sphereSurfacePos(lat + 1, theta + dTheta, phi, hN, maxLat);\r
\r
        let tLon = pE - pW;\r
        let tLat = pN - pS;\r
        let radial = sphereUnitFromAngles(theta, phi);\r
        n = safeNormalize(cross(tLat, tLon));\r
\r
        if (dot(n, radial) < 0.0) {\r
            n = -n;\r
        }\r
    }\r
\r
    let enc = n * 0.5 + vec3<f32>(0.5);\r
    textureStore(outputTex, vec2<i32>(fx, fy), frame.layerIndex, vec4<f32>(baseH, enc.x, enc.y, enc.z));\r
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
fn computeGaborMagic(@builtin(global_invocation_id) gid: vec3<u32>){\r
  let fx = i32(frame.originX) + i32(gid.x);\r
  let fy = i32(frame.originY) + i32(gid.y);\r
  let fz = i32(frame.originZ) + i32(gid.z);\r
  let p  = fetchPos(fx, fy, fz);\r
  writeChannel(fx, fy, fz, generateGaborMagic(p, params), options.outputChannel, 0u);\r
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
//     frame.layerIndex,\r
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
`;var canyon_beds_default="struct CanyonBed {\r\n  displacement:f32,\r\n  phase:f32,\r\n  cement:f32,\r\n  iron:f32,\r\n  thickness:f32,\r\n  lowerShelf:f32,\r\n}\r\n\r\nfn canyon_bed_random(layer:i32,seed:u32)->f32{\r\n  var h=bitcast<u32>(layer)*0x9e3779b9u+seed;\r\n  h=(h^(h>>16u))*0x7feb352du;\r\n  h=(h^(h>>15u))*0x846ca68bu;\r\n  return f32((h^(h>>16u))>>8u)/16777216.0;\r\n}\r\n\r\nfn canyon_contact(layer:i32,seed:u32)->f32{\r\n  // Every contact stays inside its interval, so even the thinnest beds\r\n  // stay in order as a formation dips and changes thickness.\r\n  return f32(layer)+mix(.10,.76,canyon_bed_random(layer,seed));\r\n}\r\n\r\nfn canyon_bed(dir:vec3<f32>,height:f32,seed:u32)->CanyonBed{\r\n  let salt=6.2831853*canyon_bed_random(11,seed);\r\n  let orientation=seed^(seed>>13u);\r\n  let strike=select(dir,dir.yzx,(orientation&1u)!=0u);\r\n  let p=select(strike,strike.zxy,(orientation&2u)!=0u)*\r\n    vec3<f32>(select(1.0,-1.0,(orientation&4u)!=0u),1.0,select(1.0,-1.0,(orientation&8u)!=0u));\r\n  let fold=sin(dot(p,vec3<f32>(6.4,-8.9,4.8))+salt);\r\n  let bend=sin(dot(p,vec3<f32>(-13.0,3.8,11.0))+.63*fold+salt);\r\n  let province=smoothstep(-.8,.8,fold+.38*bend);\r\n  let datum=dot(p,vec3<f32>(.33,-.27,.16))+.103*fold+.036*bend;\r\n  let spacing=mix(.155,.395,province);\r\n  let column=(height-datum)/spacing;\r\n  var layer=i32(floor(column));\r\n  if(column<canyon_contact(layer,seed)){layer-=1;}\r\n  let bottom=canyon_contact(layer,seed);\r\n  let top=canyon_contact(layer+1,seed);\r\n  let phase=clamp((column-bottom)/(top-bottom),0.0,1.0);\r\n  let cement=canyon_bed_random(layer,seed+3931u);\r\n  let resistance=smoothstep(.16,.84,cement);\r\n  let center=mix(.34,.67,canyon_bed_random(layer,seed+7207u));\r\n  let transition=mix(.30,.075,resistance);\r\n  let ramp=smoothstep(center-transition,center+transition,phase);\r\n  // Where a bed is strongly cemented, a thinner ledge can split away from\r\n  // the main face. It pinches back into the formation across the fold.\r\n  let split=smoothstep(-.40,.61,bend-.31*fold)*smoothstep(.40,.85,cement);\r\n  let lower=center-mix(.12,.21,province);\r\n  let lowerRamp=smoothstep(lower-.053,lower+.072,phase);\r\n  let profile=mix(ramp,lowerRamp,.44*split);\r\n  let shelf=split*smoothstep(lower-.11,lower-.025,phase)*\r\n    (1.0-smoothstep(lower+.048,lower+.126,phase));\r\n  let thickness=(top-bottom)*spacing;\r\n  let displacement=(profile-phase)*thickness*mix(.21,.98,resistance)*mix(.72,1.0,province);\r\n  let iron=canyon_bed_random(layer,seed+19687u);\r\n  let below=canyon_bed_random(layer-1,seed+19687u);\r\n  let above=canyon_bed_random(layer+1,seed+19687u);\r\n  let stain=iron+.5*(below-iron)*(1.0-smoothstep(0.0,.19,phase))+\r\n    .5*(above-iron)*smoothstep(.81,1.0,phase);\r\n  return CanyonBed(displacement,phase,cement,stain,thickness,shelf);\r\n}\r\n\r\nfn canyon_gully_wear(slope:vec2<f32>,bend:vec2<f32>,grade:f32,cut:f32)->f32{\r\n  // Estimate the hollow across the fall line. Bends down the slope alone\r\n  // often mark intact rock steps and should keep their profile.\r\n  let crossSlope=slope.yx*slope.yx;\r\n  let hollow=dot(bend,crossSlope)/max(dot(slope,slope),.001);\r\n  return smoothstep(.016,.12,hollow)*smoothstep(.019,.155,cut)*smoothstep(.09,.38,grade);\r\n}\r\n\r\nstruct BasaltFlow {\r\n  displacement:f32,\r\n  cap:f32,\r\n  ash:f32,\r\n  thickness:f32,\r\n}\r\n\r\n// Lava flows pond and thicken unevenly. Thin ash beds weather back between\r\n// the hardened flows, especially where runoff already incises the slope.\r\nfn basalt_flow(dir:vec3<f32>,height:f32,seed:u32)->BasaltFlow{\r\n  let salt=6.2831853*canyon_bed_random(29,seed);\r\n  let bend=sin(dot(dir,vec3<f32>(8.5,-5.2,11.3))+salt);\r\n  let pond=sin(dot(dir,vec3<f32>(-5.8,11.3,4.6))+.83*bend-salt);\r\n  let bedding=dot(dir,vec3<f32>(.19,.31,-.24))+.088*bend+.032*pond;\r\n  let spacing=mix(.115,.315,smoothstep(-.94,.94,.56*bend+.68*pond));\r\n  let units=(height-bedding)/spacing;\r\n  let contacts=seed+5573u;\r\n  var layer=i32(floor(units));\r\n  if(units<canyon_contact(layer,contacts)){layer-=1;}\r\n  let base=canyon_contact(layer,contacts);\r\n  let top=canyon_contact(layer+1,contacts);\r\n  let phase=clamp((units-base)/(top-base),0.0,1.0);\r\n  let solid=smoothstep(.12,.86,canyon_bed_random(layer,seed+5399u)+.14*pond);\r\n  let lip=mix(.43,.69,canyon_bed_random(layer,seed+7109u));\r\n  let ramp=smoothstep(lip-mix(.29,.16,solid),lip+mix(.23,.08,solid),phase);\r\n  let cap=solid*smoothstep(lip-.07,lip+.09,phase)*(1.0-smoothstep(.89,1.0,phase));\r\n  let ash=mix(.92,.32,solid)*smoothstep(0.0,.13,phase)*(1.0-smoothstep(lip-.13,lip+.03,phase));\r\n  let thickness=(top-base)*spacing;\r\n  return BasaltFlow((ramp-phase)*thickness*mix(.20,.89,solid),cap,ash,thickness);\r\n}\r\n";var studio_wind_default="fn studio_wind_dir(seed:u32)->vec3<f32>{\r\n  let heading=6.283185307*f32(seed&65535u)/65536.0;\r\n  return vec3<f32>(cos(heading),0.0,sin(heading));\r\n}\r\n\r\nfn studio_dryness(dir:vec3<f32>,rock:vec4<f32>,seed:u32)->f32{\r\n  let phase=6.283185307*f32(seed>>16u)/65536.0;\r\n  let belt=1.0-smoothstep(.43,.81,abs(dir.y));\r\n  let lee=.78*sin(dot(dir,vec3<f32>(4.0,2.0,-5.52))+phase)+\r\n    .40*sin(dot(dir,vec3<f32>(-8.7,3.3,-5.4))-.71*phase);\r\n  let supply=min(1.0,1.42*(rock.y+.78*rock.w+.36*rock.z));\r\n  return belt*supply*smoothstep(-.67,.47,lee);\r\n}\r\n";var volcanic_relief_default="// Closed summit bowls have irregular rims. The same profile can describe\r\n// a low breached shield or a steep cinder cone with a narrow summit vent.\r\nfn volcanic_vent(p:vec2<f32>,shape:vec3<f32>,rimNoise:f32)->f32{\r\n  // The vent is offset from the foot of the cone. In its seeded local\r\n  // orientation, unequal lobes form a broken lip and slump on one flank.\r\n  let drift=vec2<f32>(.13*(shape.z-.5),.09*(shape.y-.5));\r\n  let q=p-drift*(1.0-smoothstep(.22,1.0,length(p)));\r\n  let warped=vec2<f32>(q.x+.24*(shape.z-.5)*q.y,q.y*mix(.68,1.48,shape.y));\r\n  let r=length(warped);\r\n  let heading=warped/max(r,.08);\r\n  let crown=heading.x*(heading.x*heading.x-3.0*heading.y*heading.y);\r\n  let shoulder=2.0*heading.x*heading.y;\r\n  let lip=mix(.35,.25,shape.x)*(1.0+mix(.08,.19,shape.y)*crown+\r\n    mix(-.12,.15,shape.z)*shoulder);\r\n  let d=r+1.34*rimNoise*smoothstep(.08,.30,r)*(1.0-smoothstep(.65,1.25,r));\r\n  let flank=smoothstep(0.0,.09,d-lip)*clamp((d-lip)/(1.36-lip),0.0,1.0);\r\n  let cone=pow(1.0-flank,mix(2.6,1.25,shape.x)+.31*heading.y);\r\n  let bowl=1.0-smoothstep(lip*.26,lip*1.04,d);\r\n  let rim=smoothstep(lip*.69,lip,d)*(1.0-smoothstep(lip*1.05,lip*1.52,d));\r\n  let breach=smoothstep(.42,.91,shape.z)*smoothstep(.045,.34,q.y)*\r\n    (1.0-smoothstep(.06,.36,abs(q.x+.34*q.y)));\r\n  let edge=1.0-smoothstep(1.05,1.45,length(p));\r\n  return edge*(mix(.27,.99,shape.x)*cone-mix(.28,.63,shape.y)*bowl+\r\n    (.12+.045*shoulder)*rim-(.12+.38*rim)*cone*breach);\r\n}\r\n\r\nfn volcanic_caldera(p:vec2<f32>,shape:vec3<f32>,rimNoise:f32)->f32{\r\n  let r=length(p*vec2<f32>(1.0,mix(.83,1.23,shape.x)));\r\n  let d=r+rimNoise*smoothstep(.22,.66,r);\r\n  let floor=1.0-smoothstep(.29,.88,d);\r\n  let rim=smoothstep(.68,.96,d)*(1.0-smoothstep(1.0,1.42,d));\r\n  let breach=smoothstep(.60,.92,shape.z)*smoothstep(.28,.78,p.y)*\r\n    (1.0-smoothstep(.14,.46,abs(p.x+.24*p.y)));\r\n  let apron=1.0-smoothstep(.54,1.45,d);\r\n  return .13*apron+mix(.25,.48,shape.x)*rim*(1.0-.68*breach)-mix(.35,.74,shape.y)*floor;\r\n}\r\n\r\nfn lava_tube_collapse(p:vec2<f32>,radius:f32,reach:f32,seed:u32,texel:f32)->f32{\r\n  let start=.72*radius;\r\n  if(p.x<start||p.x>=reach||abs(p.y)>.033||texel>=.024){return 0.0;}\r\n  let step=mix(.034,.055,canyon_bed_random(4,seed));\r\n  let along=(p.x-start)/step;\r\n  let segment=i32(floor(along));\r\n  let profile=canyon_bed_random(segment,seed+1723u);\r\n  if(profile<.23){return 0.0;}\r\n  let offset=mix(.39,.61,canyon_bed_random(segment,seed+6857u));\r\n  let width=mix(.008,.016,canyon_bed_random(segment,seed+2671u));\r\n  let taper=smoothstep(start,start+step*.65,p.x)*(1.0-smoothstep(reach-step*.56,reach,p.x));\r\n  let bend=sin(along*1.58+6.2831853*canyon_bed_random(7,seed));\r\n  let cross=abs(p.y-width*(.72*bend+.29*sin(along*3.39+.6*bend)));\r\n  let lengthwise=abs(fract(along)-offset)/mix(.18,.34,profile);\r\n  let d=length(vec2<f32>(lengthwise,cross/width));\r\n  let wall=1.0-smoothstep(.31,1.0,d);\r\n  let resolution=1.0-smoothstep(width*.78,width*1.44,texel);\r\n  return -mix(.055,.205,profile)*wall*taper*resolution;\r\n}\r\n";var noiseBlit_default="// Fullscreen quad (module-scope constant)\r\nconst kQuad : array<vec2<f32>, 6> = array<vec2<f32>, 6>(\r\n  vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),\r\n  vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)\r\n);\r\n\r\nstruct VsOut {\r\n  @builtin(position) pos : vec4<f32>,\r\n  @location(0)       uv  : vec2<f32>,\r\n};\r\n\r\n@vertex\r\nfn vs_main(@builtin(vertex_index) i : u32) -> VsOut {\r\n  let p = kQuad[i];\r\n\r\n  var o : VsOut;\r\n  o.pos = vec4<f32>(p, 0.0, 1.0);\r\n  o.uv  = p * 0.5 + vec2<f32>(0.5, 0.5);\r\n  return o;\r\n}\r\n\r\n@group(0) @binding(0) var samp : sampler;\r\n@group(0) @binding(1) var tex  : texture_2d_array<f32>;\r\n\r\nstruct UBlit2D {\r\n  layer   : u32,\r\n  channel : u32,\r\n  _pad0   : u32,\r\n  _pad1   : u32,\r\n};\r\n@group(0) @binding(2) var<uniform> U : UBlit2D;\r\n\r\n@fragment\r\nfn fs_main(in : VsOut) -> @location(0) vec4<f32> {\r\n  // For array textures the signature is (tex, sampler, uv, arrayIndex, level)\r\n  let c = textureSampleLevel(tex, samp, in.uv, i32(U.layer), 0.0);\r\n\r\n  // display a single channel directly\r\n  var v = c.r;\r\n  if (U.channel == 2u) { v = c.g; }\r\n  if (U.channel == 3u) { v = c.b; }\r\n  if (U.channel == 4u) { v = c.a; }\r\n\r\n  return vec4<f32>(clamp(v, 0.0, 1.0));\r\n}\r\n";var noiseBlit3D_default="const kQuad : array<vec2<f32>, 6> = array<vec2<f32>, 6>(\r\n  vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),\r\n  vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)\r\n);\r\n\r\nstruct VsOut {\r\n  @builtin(position) pos : vec4<f32>,\r\n  @location(0)       uv  : vec2<f32>,\r\n};\r\n\r\n@vertex\r\nfn vs_main(@builtin(vertex_index) i : u32) -> VsOut {\r\n  let p = kQuad[i];\r\n  var o : VsOut;\r\n  o.pos = vec4<f32>(p, 0.0, 1.0);\r\n  o.uv  = p * 0.5 + vec2<f32>(0.5, 0.5);\r\n  return o;\r\n}\r\n\r\n@group(0) @binding(0) var samp : sampler;\r\n@group(0) @binding(1) var tex3d : texture_3d<f32>;\r\n\r\nstruct UBlit3D {\r\n  zNorm   : f32,  // normalized depth [0..1]\r\n  channel : u32,\r\n  _pad0   : u32,\r\n  _pad1   : u32,\r\n};\r\n@group(0) @binding(2) var<uniform> U : UBlit3D;\r\n\r\n@fragment\r\nfn fs_main(in : VsOut) -> @location(0) vec4<f32> {\r\n  let coord = vec3<f32>(in.uv, clamp(U.zNorm, 0.0, 1.0));\r\n  let c = textureSample(tex3d, samp, coord);\r\n\r\n  // display a single channel directly\r\n  var v = c.r;\r\n  if (U.channel == 2u) { v = c.g; }\r\n  if (U.channel == 3u) { v = c.b; }\r\n  if (U.channel == 4u) { v = c.a; }\r\n\r\n  return vec4<f32>(clamp(v, 0.0, 1.0));\r\n}\r\n";var MAX_2D_TILE=4096;var MAX_3D_TILE=2048;var BYTES_PER_VOXEL=8;var NoiseComputeBuilder=class{constructor(device,queue){this.device=device;this.queue=queue;this.maxBufferChunkBytes=8e6;this.entryPoints=["computePerlin","computeBillow","computeAntiBillow","computeRidge","computeAntiRidge","computeRidgedMultifractal","computeRidgedMultifractal2","computeRidgedMultifractal3","computeRidgedMultifractal4","computeAntiRidgedMultifractal","computeAntiRidgedMultifractal2","computeAntiRidgedMultifractal3","computeAntiRidgedMultifractal4","computeFBM","computeFBM2","computeFBM3","computeCellularBM1","computeCellularBM2","computeCellularBM3","computeVoronoiBM1","computeVoronoiBM2","computeVoronoiBM3","computeCellular","computeWorley","computeAntiCellular","computeAntiWorley","computeLanczosBillow","computeLanczosAntiBillow","computeVoronoiTileNoise","computeVoronoiCircleNoise","computeVoronoiCircle2","computeVoronoiFlatShade","computeVoronoiRipple3D","computeVoronoiRipple3D2","computeVoronoiCircularRipple","computeFVoronoiRipple3D","computeFVoronoiCircularRipple","computeRippleNoise","computeFractalRipples","computeHexWorms","computePerlinWorms","computeWhiteNoise","computeBlueNoise","computeSimplex","computeSimplexFBM","computeCurl2D","computeCurlFBM2D","computeDomainWarpFBM1","computeDomainWarpFBM2","computeGaborAnisotropic","computeGaborMagic","computeGaborFlow","computeTerraceNoise","computeFoamNoise","computeTurbulence","computePerlin4D","computeWorley4D","computeAntiWorley4D","computeCellular4D","computeAntiCellular4D","computeBillow4D","computeAntiBillow4D","computeLanczosBillow4D","computeLanczosAntiBillow4D","computeFBM4D","computeVoronoi4D","computeVoronoiBM1_4D","computeVoronoiBM2_4D","computeVoronoiBM3_4D","computeVoronoiBM1_4D_vec","computeVoronoiBM2_4D_vec","computeVoronoiBM3_4D_vec","computeWorleyBM1_4D","computeWorleyBM2_4D","computeWorleyBM3_4D","computeWorleyBM1_4D_vec","computeWorleyBM2_4D_vec","computeWorleyBM3_4D_vec","computeCellularBM1_4D","computeCellularBM2_4D","computeCellularBM3_4D","computeCellularBM1_4D_vec","computeCellularBM2_4D_vec","computeCellularBM3_4D_vec","computeTerraceNoise4D","computeFoamNoise4D","computeTurbulence4D","computeSmokeNoise","computeTerrainNoise","computeHydrologyErosionHeightfield","computeHydrologyGuideField","computeHydrologyDrainageMask","computeGauss5x5","computeNormal","computeNormal8","computeSphereNormal","computeNormalVolume","clearTexture","computeStudioSphereErosion","computeStudioSphereRelief","computeStudioSphereMountainErosion"];this.shaderModule=device.createShaderModule({code:canyon_beds_default+studio_wind_default+volcanic_relief_default+noiseCompute_default});this.bindGroupLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float",viewDimension:"2d-array"}},{binding:4,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba16float",viewDimension:"2d-array"}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:6,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:7,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float",viewDimension:"3d"}},{binding:8,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba16float",viewDimension:"3d"}}]});this.pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]});this.pipelines=new Map;this._texPairs=new Map;this._tid=null;this._tag=new WeakMap;this._default2DKey="__default2d";this._volumeCache=new Map;this.viewA=null;this.viewB=null;this.width=0;this.height=0;this.layers=1;this.isA=true;this._initBuffers();this._ensureDummies();this._ctxMap=new WeakMap}_initBuffers(){this.optionsBuffer?.destroy();this.paramsBuffer?.destroy();this.permBuffer?.destroy();this.nullPosBuffer?.destroy();this.optionsBuffer=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.paramsBuffer=this.device.createBuffer({size:24*4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.permBuffer=this.device.createBuffer({size:512*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});this.nullPosBuffer=this.device.createBuffer({size:64,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});this.queue.writeBuffer(this.optionsBuffer,0,new ArrayBuffer(64));this.queue.writeBuffer(this.paramsBuffer,0,new ArrayBuffer(24*4));this.queue.writeBuffer(this.permBuffer,0,new Uint32Array(512))}_ensureDummies(){if(!this._dummy2D_sampleTex){this._dummy2D_sampleTex=this.device.createTexture({size:[1,1,1],format:"rgba16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC});this._dummy2D_sampleView=this._dummy2D_sampleTex.createView({dimension:"2d-array",arrayLayerCount:1})}if(!this._dummy2D_writeTex){this._dummy2D_writeTex=this.device.createTexture({size:[1,1,1],format:"rgba16float",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_DST});this._dummy2D_writeView=this._dummy2D_writeTex.createView({dimension:"2d-array",arrayLayerCount:1})}if(!this._dummy3D_sampleTex){this._dummy3D_sampleTex=this.device.createTexture({size:{width:1,height:1,depthOrArrayLayers:1},dimension:"3d",format:"rgba16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC});this._dummy3D_sampleView=this._dummy3D_sampleTex.createView({dimension:"3d"})}if(!this._dummy3D_writeTex){this._dummy3D_writeTex=this.device.createTexture({size:{width:1,height:1,depthOrArrayLayers:1},dimension:"3d",format:"rgba16float",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_DST});this._dummy3D_writeView=this._dummy3D_writeTex.createView({dimension:"3d"})}}_getMaxBufferChunkBytes(requested){const devMax=this.device?.limits?.maxBufferSize??256*1024*1024;const cap=Math.max(1024*1024,Math.floor(devMax*.9));let want=Number.isFinite(requested)?Math.floor(requested):this.maxBufferChunkBytes;if(!Number.isFinite(want)||want<=0)want=this.maxBufferChunkBytes;want=Math.max(4,want)&~3;return Math.min(cap,want)}_writeBufferChunked(dstBuffer,dstOffsetBytes,srcAB,srcOffsetBytes,byteLength,maxChunkBytes=null){const total=byteLength|0;if(!(total>0))return;const chunk=this._getMaxBufferChunkBytes(maxChunkBytes);let off=0;while(off<total){let n=Math.min(chunk,total-off)|0;n=n&~3;if(n<=0)break;this.queue.writeBuffer(dstBuffer,dstOffsetBytes+off|0,srcAB,srcOffsetBytes+off|0,n);off=off+n|0}if(off!==total){throw new Error(`_writeBufferChunked: incomplete write ${off}/${total} bytes`)}}async _readBGRA8TextureToRGBA8Pixels(texture,W,H,opts={}){const width=Math.max(1,W|0);const height=Math.max(1,H|0);const bytesPerPixel=4;const align=256;const bytesPerRowUnaligned=width*bytesPerPixel;const bytesPerRow=Math.ceil(bytesPerRowUnaligned/align)*align;const maxBuf=this.device?.limits?.maxBufferSize??256*1024*1024;const cap=Math.max(1024*1024,Math.floor(maxBuf*.9));let chunkBytes=this._getMaxBufferChunkBytes(opts.maxBufferChunkBytes);if(chunkBytes<bytesPerRow)chunkBytes=bytesPerRow;if(bytesPerRow>cap){throw new Error(`_readBGRA8TextureToRGBA8Pixels: bytesPerRow=${bytesPerRow} exceeds safe buffer cap=${cap}`)}const rowsPerChunk=Math.max(1,Math.floor(chunkBytes/bytesPerRow))|0;const pixels=new Uint8ClampedArray(width*height*4);const chunks=[];const encoder=this.device.createCommandEncoder();for(let y0=0;y0<height;y0+=rowsPerChunk){const rows=Math.min(rowsPerChunk,height-y0)|0;const bufSize=bytesPerRow*rows|0;const readBuffer=this.device.createBuffer({size:bufSize,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});encoder.copyTextureToBuffer({texture,origin:{x:0,y:y0,z:0}},{buffer:readBuffer,bytesPerRow,rowsPerImage:rows},{width,height:rows,depthOrArrayLayers:1});chunks.push({readBuffer,y0,rows})}this.queue.submit([encoder.finish()]);if(this.queue&&this.queue.onSubmittedWorkDone){try{await this.queue.onSubmittedWorkDone()}catch(e){}}for(const ch of chunks){const{readBuffer,y0,rows}=ch;await readBuffer.mapAsync(GPUMapMode.READ);const mapped=readBuffer.getMappedRange();const src=new Uint8Array(mapped);for(let ry=0;ry<rows;ry++){const srcRow=ry*bytesPerRow;const dstRow=(y0+ry)*width*4;for(let x=0;x<width;x++){const si=srcRow+x*4;const di=dstRow+x*4;pixels[di+0]=src[si+2];pixels[di+1]=src[si+1];pixels[di+2]=src[si+0];pixels[di+3]=src[si+3]}}readBuffer.unmap();readBuffer.destroy()}return pixels}resize(maxConfigs){this.maxConfigs=maxConfigs;this._initBuffers()}setPermTable(permArray){this.queue.writeBuffer(this.permBuffer,0,permArray)}setPosBuffer(posBuffer){this.posBuffer=posBuffer}setInputTextureView(view){try{const usage=view?.texture?.usage??0;if((usage&GPUTextureUsage.TEXTURE_BINDING)===0){console.warn("setInputTextureView: provided texture view not created with TEXTURE_BINDING; ignoring.");return}}catch(e){}this.inputTextureView=view;if(this._tid!==null){const p=this._texPairs.get(this._tid);if(p)p.bindGroupDirty=true}}setOutputTextureView(view){try{const usage=view?.texture?.usage??0;if((usage&GPUTextureUsage.STORAGE_BINDING)===0){console.warn("setOutputTextureView: provided texture view not created with STORAGE_BINDING; ignoring.");return}}catch(e){}this.outputTextureView=view;if(this._tid!==null){const p=this._texPairs.get(this._tid);if(p)p.bindGroupDirty=true}}buildPermTable(seed=Date.now()){const noise=new BaseNoise(seed);const perm8=noise.perm;const perm32=new Uint32Array(512);for(let i=0;i<512;i++)perm32[i]=perm8[i];this.setPermTable(perm32)}setOptions(opts={}){if(Array.isArray(opts.noiseChoices)){this.noiseChoices=opts.noiseChoices}else if(!this.noiseChoices){this.noiseChoices=[0]}const{getGradient=0,outputChannel=1,baseRadius=0,heightScale=1,useCustomPos=0,ioFlags=0,sphereOffset=0,sphereOffset2=0,sphereBlend=0,sphereBlendPhase=0,sphereRangeWeight=1,spherePolarFade=0,sphereLandscape=0,sphereLandscapeStrength=0,sphereFeatureDensity=1}=opts;this.useCustomPos=useCustomPos>>>0;const buf=new ArrayBuffer(64);const dv=new DataView(buf);dv.setUint32(0,getGradient,true);dv.setUint32(4,this.useCustomPos,true);dv.setUint32(8,outputChannel,true);dv.setUint32(12,ioFlags>>>0,true);dv.setFloat32(16,baseRadius,true);dv.setFloat32(20,heightScale,true);dv.setFloat32(24,Number.isFinite(Number(sphereOffset))?Number(sphereOffset):0,true);dv.setFloat32(28,Number.isFinite(Number(sphereOffset2))?Number(sphereOffset2):0,true);dv.setFloat32(32,sphereBlend,true);dv.setFloat32(36,sphereBlendPhase,true);dv.setFloat32(40,sphereRangeWeight,true);dv.setFloat32(44,spherePolarFade,true);dv.setUint32(48,sphereLandscape,true);dv.setFloat32(52,sphereLandscapeStrength,true);dv.setFloat32(56,sphereFeatureDensity,true);this.queue.writeBuffer(this.optionsBuffer,0,buf);for(const pair of this._texPairs.values())pair.bindGroupDirty=true}setNoiseParams(params={}){const p=params||{};const prev=this._lastNoiseParams||{};const has=Object.prototype.hasOwnProperty;const pickNum=(k,fallback)=>{const v=has.call(p,k)?p[k]:prev[k];const n=Number(v);if(Number.isFinite(n))return n;const fb=Number(fallback);return Number.isFinite(fb)?fb:0};const pickU32=(k,fallback)=>{const v=has.call(p,k)?p[k]:prev[k];const n=Number(v);if(Number.isFinite(n))return n>>>0;const fb=Number(fallback);return Number.isFinite(fb)?fb>>>0:0};const pickI32=(k,fallback)=>{const v=has.call(p,k)?p[k]:prev[k];const n=Number(v);if(Number.isFinite(n))return n|0;const fb=Number(fallback);return Number.isFinite(fb)?fb|0:0};const pickBoolU32=(k,fallback)=>{const v=has.call(p,k)?p[k]:prev[k];if(v===void 0)return(fallback?1:0)>>>0;return(v?1:0)>>>0};const seed=pickI32("seed",prev.seed??Date.now()|0);const zoomRaw=pickNum("zoom",prev.zoom??1);const freqRaw=pickNum("freq",prev.freq??1);const _zoom=Math.max(zoomRaw||0,1e-6);const _freq=Math.max(freqRaw||0,1e-6);const octaves=pickU32("octaves",prev.octaves??8);const turbulence=pickBoolU32("turbulence",prev.turbulence??0);const lacunarity=pickNum("lacunarity",prev.lacunarity??2);const gain=pickNum("gain",prev.gain??.5);const xShift=pickNum("xShift",prev.xShift??0);const yShift=pickNum("yShift",prev.yShift??0);const zShift=pickNum("zShift",prev.zShift??0);const seedAngle=pickNum("seedAngle",prev.seedAngle??0);const exp1=pickNum("exp1",prev.exp1??1);const exp2=pickNum("exp2",prev.exp2??0);const threshold=pickNum("threshold",prev.threshold??.1);const rippleFreq=pickNum("rippleFreq",prev.rippleFreq??10);const time=pickNum("time",prev.time??0);const warpAmp=pickNum("warpAmp",prev.warpAmp??.5);const gaborRadius=pickNum("gaborRadius",prev.gaborRadius??4);const terraceStep=pickNum("terraceStep",prev.terraceStep??8);const toroidal=pickBoolU32("toroidal",prev.toroidal??0);const voroMode=pickU32("voroMode",prev.voroMode??0);const edgeK=pickNum("edgeK",prev.edgeK??0);const scalar=pickNum("scalar",prev.scalar??1);const transform=pickNum("transform",prev.transform??0);const buf=new ArrayBuffer(24*4);const dv=new DataView(buf);let base=0;dv.setUint32(base+0,seed>>>0,true);dv.setFloat32(base+4,_zoom,true);dv.setFloat32(base+8,_freq,true);dv.setUint32(base+12,octaves>>>0,true);dv.setFloat32(base+16,lacunarity,true);dv.setFloat32(base+20,gain,true);dv.setFloat32(base+24,xShift,true);dv.setFloat32(base+28,yShift,true);dv.setFloat32(base+32,zShift,true);dv.setUint32(base+36,turbulence>>>0,true);dv.setFloat32(base+40,seedAngle,true);dv.setFloat32(base+44,exp1,true);dv.setFloat32(base+48,exp2,true);dv.setFloat32(base+52,threshold,true);dv.setFloat32(base+56,rippleFreq,true);dv.setFloat32(base+60,time,true);dv.setFloat32(base+64,warpAmp,true);dv.setFloat32(base+68,gaborRadius,true);dv.setFloat32(base+72,terraceStep,true);dv.setUint32(base+76,toroidal>>>0,true);dv.setUint32(base+80,voroMode>>>0,true);dv.setFloat32(base+84,edgeK,true);dv.setFloat32(base+88,scalar,true);dv.setFloat32(base+92,transform,true);this.queue.writeBuffer(this.paramsBuffer,0,buf);this._lastNoiseParams={seed,zoom:_zoom,freq:_freq,octaves,lacunarity,gain,xShift,yShift,zShift,turbulence,seedAngle,exp1,exp2,threshold,rippleFreq,time,warpAmp,gaborRadius,terraceStep,toroidal,voroMode,edgeK,scalar,transform};for(const pair of this._texPairs.values())pair.bindGroupDirty=true;for(const[key,vol]of this._volumeCache){if(!vol||!Array.isArray(vol.chunks))continue;vol._bindGroupsDirty=true}}_numOr0(v){const n=Number(v);return Number.isFinite(n)?n:0}_resolveScroll2D(options,outW,outH,worldFullW,worldFullH,cropMode){const o=options||{};const outw=Math.max(1,outW|0);const outh=Math.max(1,outH|0);const fullw=Math.max(1,(worldFullW??outw)|0);const fullh=Math.max(1,(worldFullH??outh)|0);const w=cropMode?fullw:outw;const h=cropMode?fullh:outh;const offX=this._numOr0(o.offsetX)*w;const offY=this._numOr0(o.offsetY)*h;const baseXf=offX+this._numOr0(o.offsetXf)+this._numOr0(o.originXf)+this._numOr0(o.originX);const baseYf=offY+this._numOr0(o.offsetYf)+this._numOr0(o.originYf)+this._numOr0(o.originY);return{baseXf,baseYf}}_resolveScroll3D(options,outW,outH,outD){const o=options||{};const w=Math.max(1,outW|0);const h=Math.max(1,outH|0);const d=Math.max(1,outD|0);const offX=this._numOr0(o.offsetX)*w;const offY=this._numOr0(o.offsetY)*h;const offZ=this._numOr0(o.offsetZ)*d;const baseXf=offX+this._numOr0(o.offsetXf)+this._numOr0(o.originXf)+this._numOr0(o.originX);const baseYf=offY+this._numOr0(o.offsetYf)+this._numOr0(o.originYf)+this._numOr0(o.originY);const baseZf=offZ+this._numOr0(o.offsetZf)+this._numOr0(o.originZf)+this._numOr0(o.originZ);const baseZ=Math.floor(baseZf)|0;return{baseXf,baseYf,baseZ}}_update2DTileFrames(tid,options={}){const pair=this._texPairs.get(tid);if(!pair||!Array.isArray(pair.tiles)||pair.tiles.length===0)return;let worldFullW=Number.isFinite(options.frameFullWidth)?options.frameFullWidth>>>0:pair.fullWidth;let worldFullH=Number.isFinite(options.frameFullHeight)?options.frameFullHeight>>>0:pair.fullHeight;const cropMode=options.squareWorld||String(options.worldMode||"").toLowerCase()==="crop";if(options.squareWorld){const m=Math.max(worldFullW,worldFullH,pair.fullWidth,pair.fullHeight)>>>0;worldFullW=m;worldFullH=m}const outW=pair.fullWidth>>>0;const outH=pair.fullHeight>>>0;const{baseXf,baseYf}=this._resolveScroll2D(options,outW,outH,worldFullW,worldFullH,cropMode);const scaleX=cropMode?1:worldFullW/Math.max(1,outW);const scaleY=cropMode?1:worldFullH/Math.max(1,outH);for(const tile of pair.tiles){const fb=tile?.frames?.[0];if(!fb)continue;const ox=tile.originX|0;const oy=tile.originY|0;const worldX=(ox+baseXf)*scaleX;const worldY=(oy+baseYf)*scaleY;const originXf=worldFullW>0?worldX/worldFullW:0;const originYf=worldFullH>0?worldY/worldFullH:0;this._writeFrameUniform(fb,{fullWidth:worldFullW,fullHeight:worldFullH,tileWidth:pair.tileWidth,tileHeight:pair.tileHeight,originX:ox,originY:oy,originZ:0,fullDepth:1,tileDepth:1,layerIndex:tile.layerIndex|0,layers:pair.layers>>>0,originXf,originYf})}}_update3DChunkFrames(vol,worldFull=null,options={}){if(!vol||!Array.isArray(vol.chunks)||vol.chunks.length===0)return;const fw=worldFull&&Number.isFinite(worldFull?.w)?worldFull.w>>>0:vol.full.w;const fh=worldFull&&Number.isFinite(worldFull?.h)?worldFull.h>>>0:vol.full.h;const fd=worldFull&&Number.isFinite(worldFull?.d)?worldFull.d>>>0:vol.full.d;const outW=vol.full.w>>>0;const outH=vol.full.h>>>0;const outD=vol.full.d>>>0;const{baseXf,baseYf,baseZ}=this._resolveScroll3D(options,outW,outH,outD);const scaleX=fw/Math.max(1,outW);const scaleY=fh/Math.max(1,outH);for(const c of vol.chunks){if(!c.fb){c.fb=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}const worldX=((c.ox|0)+baseXf)*scaleX;const worldY=((c.oy|0)+baseYf)*scaleY;const originXf=fw>0?worldX/fw:0;const originYf=fh>0?worldY/fh:0;const originZ=(c.oz|0)+baseZ|0;this._writeFrameUniform(c.fb,{fullWidth:fw,fullHeight:fh,tileWidth:c.w,tileHeight:c.h,originX:c.ox|0,originY:c.oy|0,originZ,fullDepth:fd,tileDepth:c.d,layerIndex:0,layers:1,originXf,originYf})}}_compute2DTiling(W,H){const tileW=Math.min(W,MAX_2D_TILE);const tileH=Math.min(H,MAX_2D_TILE);const tilesX=Math.ceil(W/tileW);const tilesY=Math.ceil(H/tileH);const layers=tilesX*tilesY;return{tileW,tileH,tilesX,tilesY,layers}}_create2DPair(W,H,tid=null){const t=this._compute2DTiling(W,H);const usage=GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST;const makeTex=label=>this.device.createTexture({label,size:[t.tileW,t.tileH,t.layers],format:"rgba16float",usage});const desc={dimension:"2d-array",arrayLayerCount:t.layers};const id=tid!==null&&tid!==void 0?String(tid):String(this._texPairs.size);const texA=makeTex(`2D texA ${W}x${H}x${t.layers} (${id})`);const texB=makeTex(`2D texB ${W}x${H}x${t.layers} (${id})`);const viewA=texA.createView(desc);const viewB=texB.createView(desc);viewA.label=`2D:viewA (${id})`;viewB.label=`2D:viewB (${id})`;this._tag.set(viewA,`2D:A (${id})`);this._tag.set(viewB,`2D:B (${id})`);this._texPairs.set(id,{texA,texB,viewA,viewB,fullWidth:W,fullHeight:H,tileWidth:t.tileW,tileHeight:t.tileH,tilesX:t.tilesX,tilesY:t.tilesY,layers:t.layers,isA:true,tiles:null,bindGroupDirty:true});if(this._tid===null)this.setActiveTexture(id);return id}createShaderTextures(width,height){if(this._tid!==null&&this._texPairs.has(this._tid)){this.destroyTexturePair(this._tid)}const tid=this._create2DPair(width,height);this.setActiveTexture(tid);return tid}destroyTexturePair(tid){const id=String(tid);const pair=this._texPairs.get(id);if(!pair)return;try{pair.texA.destroy()}catch{}try{pair.texB.destroy()}catch{}if(Array.isArray(pair.tiles)){for(const tile of pair.tiles){if(Array.isArray(tile.frames)){for(const fb of tile.frames){try{fb.destroy()}catch{}}}if(tile.posBuf&&tile.posBuf!==this.nullPosBuffer){try{tile.posBuf.destroy()}catch{}}}}this._texPairs.delete(id);if(this._tid===id){this._tid=null;this.inputTextureView=null;this.outputTextureView=null;this.viewA=null;this.viewB=null}}destroyAllTexturePairs(){const ids=Array.from(this._texPairs.keys());for(const id of ids)this.destroyTexturePair(id)}dispose(){if(this.disposed)return;this.disposed=true;this.destroyAllTexturePairs();this.destroyAllVolumes();for(const resource of[this.optionsBuffer,this.paramsBuffer,this.permBuffer,this.nullPosBuffer,this._dummy2D_sampleTex,this._dummy2D_writeTex,this._dummy3D_sampleTex,this._dummy3D_writeTex,this.blit2DUbo,this.blit3DUbo])resource?.destroy();this.pipelines.clear()}setActiveTexture(tid){const id=String(tid);if(!this._texPairs.has(id))throw new Error("setActiveTexture: invalid id");this._tid=id;const pair=this._texPairs.get(id);this.viewA=pair.viewA;this.viewB=pair.viewB;this.width=pair.tileWidth;this.height=pair.tileHeight;this.layers=pair.layers;this.inputTextureView=pair.isA?pair.viewA:pair.viewB;this.outputTextureView=pair.isA?pair.viewB:pair.viewA}_buildPosBuffer(width,height,customData){if(!(customData instanceof Float32Array)||customData.byteLength<=0){return this.nullPosBuffer}const w=Math.max(1,Math.floor(width));const h=Math.max(1,Math.floor(height));const numPixels=w*h;const expectedLen=numPixels*4;if(customData.length!==expectedLen){throw new Error(`_buildPosBuffer: customData length ${customData.length} != expected ${expectedLen} (width=${w}, height=${h})`)}const maxBufferSize=this.device?.limits?.maxBufferSize??2147483648;const maxBindingSize=this.device?.limits?.maxStorageBufferBindingSize??134217728;const safeMax=Math.floor(Math.min(maxBufferSize,maxBindingSize)*.98);if(customData.byteLength>safeMax){throw new Error(`_buildPosBuffer: ${customData.byteLength} bytes exceeds the safe storage binding limit ${safeMax} (maxBufferSize=${maxBufferSize}, maxStorageBufferBindingSize=${maxBindingSize}, w=${w}, h=${h})`)}const buf=this.device.createBuffer({size:customData.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});this._writeBufferChunked(buf,0,customData.buffer,customData.byteOffset,customData.byteLength,this.maxBufferChunkBytes);return buf}_writeFrameUniform(frameBuffer,f){const ab=new ArrayBuffer(64);const dv=new DataView(ab);dv.setUint32(0,f.fullWidth>>>0,true);dv.setUint32(4,f.fullHeight>>>0,true);dv.setUint32(8,f.tileWidth>>>0,true);dv.setUint32(12,f.tileHeight>>>0,true);dv.setInt32(16,f.originX|0,true);dv.setInt32(20,f.originY|0,true);dv.setInt32(24,f.originZ|0,true);dv.setUint32(28,f.fullDepth>>>0,true);dv.setUint32(32,f.tileDepth>>>0,true);dv.setInt32(36,f.layerIndex|0,true);dv.setUint32(40,f.layers>>>0,true);dv.setUint32(44,0,true);dv.setFloat32(48,f.originXf??0,true);dv.setFloat32(52,f.originYf??0,true);dv.setFloat32(56,0,true);dv.setFloat32(60,0,true);this.queue.writeBuffer(frameBuffer,0,ab)}_create2DTileBindGroups(tid,options={}){const pair=this._texPairs.get(tid);if(!pair)throw new Error("_create2DTileBindGroups: invalid tid");const requestedCustomPos=((options.useCustomPos??0)|0)>>>0;const wantsProceduralSpherePos=requestedCustomPos===2||requestedCustomPos===3;const wantsCustomBufferPos=requestedCustomPos!==0&&!wantsProceduralSpherePos;const customData=wantsCustomBufferPos&&options.customData instanceof Float32Array?options.customData:null;const hasCustomData=!!customData;const hadCustomBefore=Array.isArray(pair.tiles)&&pair.tiles.some(t=>t&&t.posIsCustom);const wantsReuseExistingCustomPos=wantsCustomBufferPos&&!hasCustomData;if(!hasCustomData&&hadCustomBefore&&!wantsReuseExistingCustomPos){pair.bindGroupDirty=true}if(Array.isArray(pair.tiles)&&!pair.bindGroupDirty&&!hasCustomData){return}const tiles=[];for(let ty=0;ty<pair.tilesY;ty++){for(let tx=0;tx<pair.tilesX;tx++){const layerIndex=ty*pair.tilesX+tx;const originX=tx*pair.tileWidth;const originY=ty*pair.tileHeight;const existingTile=pair.tiles&&pair.tiles[layerIndex]||null;let posBuf=this.nullPosBuffer;let posIsCustom=false;if(hasCustomData){posBuf=this._buildPosBuffer(pair.tileWidth,pair.tileHeight,customData);posIsCustom=posBuf!==this.nullPosBuffer}else if(wantsReuseExistingCustomPos&&existingTile&&existingTile.posBuf&&existingTile.posIsCustom){posBuf=existingTile.posBuf;posIsCustom=true}else if(wantsReuseExistingCustomPos){throw new Error("_create2DTileBindGroups: useCustomPos=1 was requested without customData and no reusable custom position buffer exists.")}else if(!wantsProceduralSpherePos&&existingTile&&existingTile.posBuf&&!existingTile.posIsCustom){posBuf=existingTile.posBuf;posIsCustom=false}else{posBuf=this.nullPosBuffer;posIsCustom=false;if(existingTile&&existingTile.posBuf&&existingTile.posIsCustom){try{existingTile.posBuf.destroy()}catch{}}}let fb;if(existingTile&&existingTile.frames&&existingTile.frames[0]){fb=existingTile.frames[0]}else{fb=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}let worldFullW=Number.isFinite(options.frameFullWidth)?options.frameFullWidth>>>0:pair.fullWidth;let worldFullH=Number.isFinite(options.frameFullHeight)?options.frameFullHeight>>>0:pair.fullHeight;const cropMode=options.squareWorld||String(options.worldMode||"").toLowerCase()==="crop";if(options.squareWorld){const m=Math.max(worldFullW,worldFullH,pair.fullWidth,pair.fullHeight)>>>0;worldFullW=m;worldFullH=m}let originXf,originYf;if(cropMode){originXf=originX;originYf=originY}else{const scaleX=worldFullW/pair.fullWidth;const scaleY=worldFullH/pair.fullHeight;originXf=originX*scaleX;originYf=originY*scaleY}this._writeFrameUniform(fb,{fullWidth:worldFullW,fullHeight:worldFullH,tileWidth:pair.tileWidth,tileHeight:pair.tileHeight,originX,originY,originZ:0,fullDepth:1,tileDepth:1,layerIndex,layers:pair.layers,originXf,originYf});let bgA=existingTile?.bgs?.[0]?.bgA??null;let bgB=existingTile?.bgs?.[0]?.bgB??null;if(!bgA||!bgB||pair.bindGroupDirty){bgA=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:pair.viewA},{binding:4,resource:pair.viewB},{binding:5,resource:{buffer:posBuf}},{binding:6,resource:{buffer:fb}},{binding:7,resource:this._dummy3D_sampleView},{binding:8,resource:this._dummy3D_writeView}]});bgB=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:pair.viewB},{binding:4,resource:pair.viewA},{binding:5,resource:{buffer:posBuf}},{binding:6,resource:{buffer:fb}},{binding:7,resource:this._dummy3D_sampleView},{binding:8,resource:this._dummy3D_writeView}]})}tiles.push({layerIndex,originX,originY,frames:[fb],posBuf,posIsCustom,bgs:[{bgA,bgB}]})}}pair.tiles=tiles;pair.bindGroupDirty=false;if(this._tid===tid)this._tiles=tiles}async _runPipelines(bgA,bgB,tileW,tileH,tileD,paramsArray,dispatchZ=1){let current=bgA;let alternate=bgB;const isArr=Array.isArray(paramsArray);let i=0;const enc=this.device.createCommandEncoder();const pass=enc.beginComputePass();for(const choice of this.noiseChoices){const entry=typeof choice==="number"?this.entryPoints[choice]:choice;let pipe=this.pipelines.get(entry);if(!pipe){pipe=this.device.createComputePipeline({layout:this.pipelineLayout,compute:{module:this.shaderModule,entryPoint:entry}});this.pipelines.set(entry,pipe)}if(isArr)this.setNoiseParams(paramsArray[i++]);pass.setPipeline(pipe);pass.setBindGroup(0,current);pass.dispatchWorkgroups(Math.ceil(tileW/8),Math.ceil(tileH/8),dispatchZ);[current,alternate]=[alternate,current]}pass.end();this.queue.submit([enc.finish()]);return alternate}async computeToTexture(width,height,paramsObj={},options={}){const W=width|0;const H=height|0;if(!(W>0&&H>0)){throw new Error(`computeToTexture: invalid size ${width}x${height}`)}const key=this._get2DKey(options);const existing=this._texPairs.get(key);if(!existing){this._create2DPair(W,H,key)}else if(existing.fullWidth!==W||existing.fullHeight!==H){this.destroyTexturePair(key);this._create2DPair(W,H,key)}this.setActiveTexture(key);const pair=this._texPairs.get(key);if(!pair)throw new Error("computeToTexture: missing pair after ensure");if(paramsObj&&!Array.isArray(paramsObj))this.setNoiseParams(paramsObj);const origOpts=options||{};const requestedCustomPos=((origOpts.useCustomPos??0)|0)>>>0;const wantsProceduralSpherePos=requestedCustomPos===2||requestedCustomPos===3;const wantsCustomBufferPos=requestedCustomPos!==0&&!wantsProceduralSpherePos;const customData=wantsCustomBufferPos&&origOpts.customData instanceof Float32Array?origOpts.customData:null;const useCustomPos=customData?1:wantsProceduralSpherePos?requestedCustomPos:wantsCustomBufferPos?1:0;this.setOptions({...origOpts,ioFlags:0,useCustomPos});const tileOpts={...origOpts,useCustomPos,customData};if(!pair.tiles||pair.bindGroupDirty||!!customData){this._create2DTileBindGroups(key,tileOpts)}this._update2DTileFrames(key,tileOpts);const isAStart=pair.isA;let finalUsed=null;let lastBGs=null;for(const tile of pair.tiles){const{bgA,bgB}=tile.bgs[0];const start=!finalUsed?isAStart?bgA:bgB:finalUsed===bgA?bgA:bgB;const alt=start===bgA?bgB:bgA;finalUsed=await this._runPipelines(start,alt,pair.tileWidth,pair.tileHeight,1,paramsObj,1);lastBGs={bgA,bgB}}const resultsInA=finalUsed===lastBGs.bgB;pair.isA=resultsInA;this.setActiveTexture(key);return this.getCurrentView(key)}_get2DKey(options){const k=options&&options.textureKey!==void 0&&options.textureKey!==null?String(options.textureKey):"";return k&&k.length?k:this._default2DKey}get2DView(key){const id=String(key);const p=this._texPairs.get(id);if(!p)return null;return p.isA?p.viewA:p.viewB}getCurrentView(tid=null){const id=tid!==null&&tid!==void 0?String(tid):this._tid;const p=this._texPairs.get(id);if(!p)return null;return p.isA?p.viewA:p.viewB}getCurrentTextureResource(tid=null){const id=tid!==null&&tid!==void 0?String(tid):this._tid;const p=this._texPairs.get(id);if(!p)return null;return{texture:p.isA?p.texA:p.texB,view:p.isA?p.viewA:p.viewB,width:p.fullWidth,height:p.fullHeight,layers:p.layers,format:"rgba16float"}}_compute3DTiling(W,H,D){const tw=Math.min(W,MAX_3D_TILE);const th=Math.min(H,MAX_3D_TILE);const maxBuf=this.device?.limits?.maxBufferSize??256*1024*1024;const sliceBytes=tw*th*BYTES_PER_VOXEL;const tdByBuf=Math.max(1,Math.floor(maxBuf*.8/Math.max(1,sliceBytes)));const td=Math.min(D,MAX_3D_TILE,tdByBuf);const nx=Math.ceil(W/tw);const ny=Math.ceil(H/th);const nz=Math.ceil(D/td);return{tw,th,td,nx,ny,nz}}_create3DChunks(W,H,D){const t=this._compute3DTiling(W,H,D);const chunks=[];const usage3D=GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST;for(let kz=0;kz<t.nz;kz++){for(let ky=0;ky<t.ny;ky++){for(let kx=0;kx<t.nx;kx++){const ox=kx*t.tw;const oy=ky*t.th;const oz=kz*t.td;const texA=this.device.createTexture({size:{width:t.tw,height:t.th,depthOrArrayLayers:t.td},dimension:"3d",format:"rgba16float",usage:usage3D});const texB=this.device.createTexture({size:{width:t.tw,height:t.th,depthOrArrayLayers:t.td},dimension:"3d",format:"rgba16float",usage:usage3D});const viewA=texA.createView({dimension:"3d"});const viewB=texB.createView({dimension:"3d"});texA.label=`3D texA ${t.tw}x${t.th}x${t.td} @ (${kx},${ky},${kz})`;texB.label=`3D texB ${t.tw}x${t.th}x${t.td} @ (${kx},${ky},${kz})`;viewA.label=`3D:viewA[${kx},${ky},${kz}]`;viewB.label=`3D:viewB[${kx},${ky},${kz}]`;this._tag.set(viewA,`3D:A[${kx},${ky},${kz}]`);this._tag.set(viewB,`3D:B[${kx},${ky},${kz}]`);chunks.push({texA,texB,viewA,viewB,ox,oy,oz,w:t.tw,h:t.th,d:t.td,isA:true,fb:null,posBuf:null,bgA:null,bgB:null})}}}return{chunks,tile:{w:t.tw,h:t.th,d:t.td},full:{w:W,h:H,d:D},grid:{nx:t.nx,ny:t.ny,nz:t.nz}}}_destroy3DSet(vol){if(!vol)return;for(const c of vol.chunks){try{c.texA.destroy()}catch{}try{c.texB.destroy()}catch{}c.viewA=null;c.viewB=null;c.bgA=null;c.bgB=null;if(c.fb){try{c.fb.destroy()}catch{}c.fb=null}if(c.posBuf&&c.posBuf!==this.nullPosBuffer){try{c.posBuf.destroy()}catch{}c.posBuf=null}}}destroyAllVolumes(){for(const[k,v]of this._volumeCache){this._destroy3DSet(v);this._volumeCache.delete(k)}}get3DView(id){const vol=this._volumeCache.get(String(id));if(!vol)return null;const views=vol.chunks.map(c=>c.isA?c.viewA:c.viewB);return views.length===1?views[0]:{views,meta:{full:vol.full,tile:vol.tile,grid:vol.grid}}}destroyVolume(id){const key=String(id);const vol=this._volumeCache.get(key);if(!vol)return;this._destroy3DSet(vol);this._volumeCache.delete(key)}_getOrCreate3DVolume(W,H,D,id=null,worldFull=null){const key=id?String(id):`${W}x${H}x${D}`;let vol=this._volumeCache.get(key);if(vol)return vol;vol=this._create3DChunks(W,H,D);for(const c of vol.chunks){c.fb=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const fw=worldFull&&Number.isFinite(worldFull?.w)?worldFull.w>>>0:vol.full.w;const fh=worldFull&&Number.isFinite(worldFull?.h)?worldFull.h>>>0:vol.full.h;const fd=worldFull&&Number.isFinite(worldFull?.d)?worldFull.d>>>0:vol.full.d;const scaleX=fw/vol.full.w;const scaleY=fh/vol.full.h;const originXf=c.ox*scaleX;const originYf=c.oy*scaleY;this._writeFrameUniform(c.fb,{fullWidth:fw,fullHeight:fh,tileWidth:c.w,tileHeight:c.h,originX:c.ox,originY:c.oy,originZ:c.oz,fullDepth:fd,tileDepth:c.d,layerIndex:0,layers:1,originXf,originYf});const posBuf=this._buildPosBuffer(c.w,c.h,null);c.posBuf=posBuf;try{c.bgA=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:posBuf}},{binding:6,resource:{buffer:c.fb}},{binding:7,resource:c.viewA},{binding:8,resource:c.viewB}]});c.bgB=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:c.posBuf}},{binding:6,resource:{buffer:c.fb}},{binding:7,resource:c.viewB},{binding:8,resource:c.viewA}]})}catch(e){throw new Error(`_getOrCreate3DVolume: createBindGroup failed: ${e?.message||e}`)}}vol._bindGroupsDirty=false;this._volumeCache.set(key,vol);return vol}_recreate3DBindGroups(vol,worldFull=null){if(!vol||!Array.isArray(vol.chunks))return;const fw=worldFull&&Number.isFinite(worldFull.w)?worldFull.w>>>0:vol.full.w;const fh=worldFull&&Number.isFinite(worldFull.h)?worldFull.h>>>0:vol.full.h;const fd=worldFull&&Number.isFinite(worldFull.d)?worldFull.d>>>0:vol.full.d;for(const c of vol.chunks){if(!c.fb){c.fb=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const scaleX=fw/vol.full.w;const scaleY=fh/vol.full.h;const originXf=c.ox*scaleX;const originYf=c.oy*scaleY;this._writeFrameUniform(c.fb,{fullWidth:fw,fullHeight:fh,tileWidth:c.w,tileHeight:c.h,originX:c.ox,originY:c.oy,originZ:c.oz,fullDepth:fd,tileDepth:c.d,layerIndex:0,layers:1,originXf,originYf})}if(!c.posBuf){c.posBuf=this._buildPosBuffer(c.w,c.h,null)}const entriesA=[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:c.posBuf}},{binding:6,resource:{buffer:c.fb}},{binding:7,resource:c.viewA},{binding:8,resource:c.viewB}];const entriesB=[{binding:0,resource:{buffer:this.optionsBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}},{binding:2,resource:{buffer:this.permBuffer}},{binding:3,resource:this._dummy2D_sampleView},{binding:4,resource:this._dummy2D_writeView},{binding:5,resource:{buffer:c.posBuf}},{binding:6,resource:{buffer:c.fb}},{binding:7,resource:c.viewB},{binding:8,resource:c.viewA}];try{c.bgA=this.device.createBindGroup({layout:this.bindGroupLayout,entries:entriesA});c.bgB=this.device.createBindGroup({layout:this.bindGroupLayout,entries:entriesB})}catch(e){throw new Error(`_recreate3DBindGroups: failed to create bind groups: ${e?.message||e}`)}}vol._bindGroupsDirty=false}async computeToTexture3D(width,height,depth,paramsObj={},options={}){const W=width|0,H=height|0,D=depth|0;if(!(W>0&&H>0&&D>0))throw new Error(`computeToTexture3D: invalid size ${width}x${height}x${depth}`);if(paramsObj&&!Array.isArray(paramsObj))this.setNoiseParams(paramsObj);const origOpts=options||{};this.setOptions({...origOpts,ioFlags:3,useCustomPos:origOpts.useCustomPos??this.useCustomPos});const worldFull=(()=>{if(options&&(Number.isFinite(options.frameFullWidth)||Number.isFinite(options.frameFullHeight)||Number.isFinite(options.frameFullDepth))){return{w:Number.isFinite(options.frameFullWidth)?options.frameFullWidth>>>0:W,h:Number.isFinite(options.frameFullHeight)?options.frameFullHeight>>>0:H,d:Number.isFinite(options.frameFullDepth)?options.frameFullDepth>>>0:D}}return null})();const vol=this._getOrCreate3DVolume(W,H,D,options.id,worldFull);if(!vol)throw new Error("computeToTexture3D: failed to create or retrieve volume");if(vol._bindGroupsDirty||!vol.chunks[0].bgA||!vol.chunks[0].bgB){this._recreate3DBindGroups(vol,worldFull)}this._update3DChunkFrames(vol,worldFull,options);let lastBG=null;for(const c of vol.chunks){const start=c.isA?c.bgA:c.bgB;const alt=c.isA?c.bgB:c.bgA;if(!start||!alt){throw new Error("computeToTexture3D: missing bind groups (volume not initialized correctly)")}lastBG=await this._runPipelines(start,alt,c.w,c.h,c.d,paramsObj,c.d);c.isA=lastBG===c.bgB}const views=vol.chunks.map(c=>c.isA?c.viewA:c.viewB);return views.length===1?views[0]:{views,meta:{full:vol.full,tile:vol.tile,grid:vol.grid}}}configureCanvas(canvas){const format=navigator.gpu.getPreferredCanvasFormat&&navigator.gpu.getPreferredCanvasFormat()||"bgra8unorm";const ctx=canvas.getContext("webgpu");ctx.configure({device:this.device,format,alphaMode:"opaque",size:[canvas.width,canvas.height]});this._ctxMap.set(canvas,{ctx,size:[canvas.width,canvas.height]})}initBlitRender(){if(!this.sampler){this.sampler=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})}if(!this.bgl2D){this.bgl2D=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"2d-array"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});this.pipeline2D=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.bgl2D]}),vertex:{module:this.device.createShaderModule({code:noiseBlit_default}),entryPoint:"vs_main"},fragment:{module:this.device.createShaderModule({code:noiseBlit_default}),entryPoint:"fs_main",targets:[{format:"bgra8unorm"}]},primitive:{topology:"triangle-list"}});this.blit2DUbo=this.device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}if(!this.bgl3D){this.bgl3D=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"3d"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});this.pipeline3D=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[this.bgl3D]}),vertex:{module:this.device.createShaderModule({code:noiseBlit3D_default}),entryPoint:"vs_main"},fragment:{module:this.device.createShaderModule({code:noiseBlit3D_default}),entryPoint:"fs_main",targets:[{format:"bgra8unorm"}]},primitive:{topology:"triangle-list"}});this.blit3DUbo=this.device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}}_renderCommonCanvasSetup(canvas,clear){const format="bgra8unorm";let entry=this._ctxMap.get(canvas);if(!entry){const ctx=canvas.getContext("webgpu");const size=[canvas.width|0,canvas.height|0];ctx.configure({device:this.device,format,alphaMode:"opaque",size});entry={ctx,size};this._ctxMap.set(canvas,entry)}else{const curW=canvas.width|0,curH=canvas.height|0;if(entry.size[0]!==curW||entry.size[1]!==curH){entry.size=[curW,curH];entry.ctx.configure({device:this.device,format,alphaMode:"opaque",size:entry.size})}}const enc=this.device.createCommandEncoder();const pass=enc.beginRenderPass({colorAttachments:[{view:entry.ctx.getCurrentTexture().createView(),loadOp:clear?"clear":"load",clearValue:{r:0,g:0,b:0,a:1},storeOp:"store"}]});return{enc,pass,ctxEntry:entry}}renderTextureToCanvas(textureView,canvas,opts={}){const{layer=0,channel=0,preserveCanvasSize=true,clear=true}=opts;this.initBlitRender();if(!preserveCanvasSize){try{const tex=textureView.texture;if(tex&&typeof tex.width==="number"&&typeof tex.height==="number"){canvas.width=tex.width;canvas.height=tex.height}}catch{}}const u=new Uint32Array([layer>>>0,channel>>>0,0,0]);this.queue.writeBuffer(this.blit2DUbo,0,u.buffer,u.byteOffset,u.byteLength);const bg=this.device.createBindGroup({layout:this.bgl2D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:textureView},{binding:2,resource:{buffer:this.blit2DUbo}}]});const{enc,pass}=this._renderCommonCanvasSetup(canvas,clear);pass.setPipeline(this.pipeline2D);pass.setBindGroup(0,bg);pass.draw(6,1,0,0);pass.end();this.queue.submit([enc.finish()])}renderTexture3DSliceToCanvas(target,canvas,opts={}){const{depth,slice=0,zNorm=null,channel=0,chunk=0,preserveCanvasSize=true,clear=true}=opts;this.initBlitRender();let view3D,d;if(target&&target.views&&Array.isArray(target.views)){view3D=target.views[Math.max(0,Math.min(chunk|0,target.views.length-1))];d=target.meta?.tile?.d??depth}else{view3D=target;d=depth}if(!view3D||!d)throw new Error("renderTexture3DSliceToCanvas: need a 3D view and its depth");if(!preserveCanvasSize){try{const tex=view3D.texture;if(tex&&typeof tex.width==="number"&&typeof tex.height==="number"){canvas.width=tex.width;canvas.height=tex.height}}catch{}}let z=zNorm!==null&&zNorm!==void 0?zNorm:(Math.min(Math.max(slice,0),d-1)+.5)/d;z=Math.min(Math.max(z,0),1);const ab=new ArrayBuffer(16);const dv=new DataView(ab);dv.setFloat32(0,z,true);dv.setUint32(4,channel>>>0,true);dv.setUint32(8,0,true);dv.setUint32(12,0,true);this.queue.writeBuffer(this.blit3DUbo,0,ab);const bg=this.device.createBindGroup({layout:this.bgl3D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:view3D},{binding:2,resource:{buffer:this.blit3DUbo}}]});const{enc,pass}=this._renderCommonCanvasSetup(canvas,clear);pass.setPipeline(this.pipeline3D);pass.setBindGroup(0,bg);pass.draw(6,1,0,0);pass.end();this.queue.submit([enc.finish()])}setExportBackground(background="black"){this.exportBackground=background}_resolveExportBackground(background){const bg=background===void 0?this.exportBackground:background;if(bg==null)return{r:0,g:0,b:0,a:1,transparent:false};if(typeof bg==="string"){const s=bg.trim().toLowerCase();if(s==="transparent")return{r:0,g:0,b:0,a:0,transparent:true};if(s==="black")return{r:0,g:0,b:0,a:1,transparent:false};if(s==="white")return{r:1,g:1,b:1,a:1,transparent:false};if(s[0]==="#")return this._parseHexBackground(s)}const norm01=v=>{const n=Number(v);if(!Number.isFinite(n))return 0;const x=n>1?n/255:n;return Math.min(Math.max(x,0),1)};if(Array.isArray(bg)){const r=norm01(bg[0]);const g=norm01(bg[1]);const b=norm01(bg[2]);const a=bg.length>=4?norm01(bg[3]):1;return{r,g,b,a,transparent:a<=0}}if(typeof bg==="object"){const r=norm01(bg.r);const g=norm01(bg.g);const b=norm01(bg.b);const a=bg.a===void 0?1:norm01(bg.a);return{r,g,b,a,transparent:a<=0}}return{r:0,g:0,b:0,a:1,transparent:false}}_parseHexBackground(hex){const h=String(hex).trim().replace(/^#/,"");const expand=c=>c+c;let r=0,g=0,b=0,a=255;if(h.length===3||h.length===4){r=parseInt(expand(h[0]),16);g=parseInt(expand(h[1]),16);b=parseInt(expand(h[2]),16);if(h.length===4)a=parseInt(expand(h[3]),16)}else if(h.length===6||h.length===8){r=parseInt(h.slice(0,2),16);g=parseInt(h.slice(2,4),16);b=parseInt(h.slice(4,6),16);if(h.length===8)a=parseInt(h.slice(6,8),16)}else{return{r:0,g:0,b:0,a:1,transparent:false}}const rf=r/255;const gf=g/255;const bf=b/255;const af=a/255;return{r:rf,g:gf,b:bf,a:af,transparent:af<=0}}_applyExportBackground(pixelsRGBA,bg){if(!pixelsRGBA||!bg||bg.transparent)return;const br=Math.round(bg.r*255);const bgc=Math.round(bg.g*255);const bb=Math.round(bg.b*255);const ba=Math.round((bg.a??1)*255);if(ba<=0)return;const n=pixelsRGBA.length|0;if(ba>=255){for(let i=0;i<n;i+=4){const a=pixelsRGBA[i+3]|0;if(a===255)continue;if(a===0){pixelsRGBA[i+0]=br;pixelsRGBA[i+1]=bgc;pixelsRGBA[i+2]=bb;pixelsRGBA[i+3]=255;continue}const ia=255-a;pixelsRGBA[i+0]=(pixelsRGBA[i+0]*a+br*ia)/255|0;pixelsRGBA[i+1]=(pixelsRGBA[i+1]*a+bgc*ia)/255|0;pixelsRGBA[i+2]=(pixelsRGBA[i+2]*a+bb*ia)/255|0;pixelsRGBA[i+3]=255}return}for(let i=0;i<n;i+=4){const fr=pixelsRGBA[i+0]|0;const fg=pixelsRGBA[i+1]|0;const fb=pixelsRGBA[i+2]|0;const fa=pixelsRGBA[i+3]|0;const outA=fa+ba*(255-fa)/255|0;if(outA<=0){pixelsRGBA[i+0]=0;pixelsRGBA[i+1]=0;pixelsRGBA[i+2]=0;pixelsRGBA[i+3]=0;continue}const brp=br*ba|0;const bgp=bgc*ba|0;const bbp=bb*ba|0;const frp=fr*fa|0;const fgp=fg*fa|0;const fbp=fb*fa|0;const bgScale=255-fa|0;const outRp=frp+brp*bgScale/255|0;const outGp=fgp+bgp*bgScale/255|0;const outBp=fbp+bbp*bgScale/255|0;pixelsRGBA[i+0]=Math.min(255,Math.max(0,outRp*255/outA|0));pixelsRGBA[i+1]=Math.min(255,Math.max(0,outGp*255/outA|0));pixelsRGBA[i+2]=Math.min(255,Math.max(0,outBp*255/outA|0));pixelsRGBA[i+3]=Math.min(255,Math.max(0,outA))}}_forceOpaqueAlpha(pixelsRGBA){const n=pixelsRGBA.length|0;for(let i=3;i<n;i+=4)pixelsRGBA[i]=255}async export2DTextureToPNGBlob(textureView,width,height,opts={}){if(!textureView){throw new Error("export2DTextureToPNGBlob: textureView is required")}const W=Math.max(1,width|0);const H=Math.max(1,height|0);const layer=opts.layer??0;const channel=opts.channel??0;const bgSpec=this._resolveExportBackground(opts.background);this.initBlitRender();if(this.queue&&this.queue.onSubmittedWorkDone){try{await this.queue.onSubmittedWorkDone()}catch(e){}}const format="bgra8unorm";const captureTexture=this.device.createTexture({size:[W,H,1],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});const u=new Uint32Array([layer>>>0,channel>>>0,0,0]);this.queue.writeBuffer(this.blit2DUbo,0,u.buffer,u.byteOffset,u.byteLength);const bg=this.device.createBindGroup({layout:this.bgl2D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:textureView},{binding:2,resource:{buffer:this.blit2DUbo}}]});const encoder=this.device.createCommandEncoder();const rpass=encoder.beginRenderPass({colorAttachments:[{view:captureTexture.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:0}}]});rpass.setPipeline(this.pipeline2D);rpass.setBindGroup(0,bg);rpass.draw(6,1,0,0);rpass.end();this.queue.submit([encoder.finish()]);if(this.queue&&this.queue.onSubmittedWorkDone){try{await this.queue.onSubmittedWorkDone()}catch(e){}}const pixels=await this._readBGRA8TextureToRGBA8Pixels(captureTexture,W,H,{maxBufferChunkBytes:opts.maxBufferChunkBytes??this.maxBufferChunkBytes});captureTexture.destroy();const useAlphaForBackground=opts.useAlphaForBackground===true;if(bgSpec.transparent||useAlphaForBackground){this._applyExportBackground(pixels,bgSpec)}else{this._forceOpaqueAlpha(pixels)}const tmpCanvas=document.createElement("canvas");tmpCanvas.width=W;tmpCanvas.height=H;const ctx2d=tmpCanvas.getContext("2d");if(!ctx2d){throw new Error("export2DTextureToPNGBlob: unable to get 2D context")}ctx2d.putImageData(new ImageData(pixels,W,H),0,0);const blob=await new Promise((resolve,reject)=>{tmpCanvas.toBlob(b=>{if(b)resolve(b);else reject(new Error("export2DTextureToPNGBlob: toBlob returned null"))},"image/png")});return blob}async exportCurrent2DToPNGBlob(width,height,opts={}){const view=this.getCurrentView();if(!view){throw new Error("exportCurrent2DToPNGBlob: no active 2D texture view")}return this.export2DTextureToPNGBlob(view,width,height,opts)}async export3DSliceToPNGBlob(target,width,height,opts={}){if(!target){throw new Error("export3DSliceToPNGBlob: target is required")}const W=Math.max(1,width|0);const H=Math.max(1,height|0);const{depth,slice=0,zNorm=null,channel=0,chunk=0}=opts;if(!depth||depth<=0){throw new Error("export3DSliceToPNGBlob: depth must be provided and > 0")}const bgSpec=this._resolveExportBackground(opts.background);this.initBlitRender();if(this.queue&&this.queue.onSubmittedWorkDone){try{await this.queue.onSubmittedWorkDone()}catch(e){}}let view3D;let d;if(target&&target.views&&Array.isArray(target.views)){const idx=Math.max(0,Math.min(chunk|0,target.views.length-1));view3D=target.views[idx];d=target.meta?.tile?.d??depth}else{view3D=target;d=depth}if(!view3D||!d){throw new Error("export3DSliceToPNGBlob: need a 3D view and its depth")}let z=zNorm!==null&&zNorm!==void 0?zNorm:(Math.min(Math.max(slice,0),d-1)+.5)/d;z=Math.min(Math.max(z,0),1);const format="bgra8unorm";const captureTexture=this.device.createTexture({size:[W,H,1],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});const ab=new ArrayBuffer(16);const dv=new DataView(ab);dv.setFloat32(0,z,true);dv.setUint32(4,channel>>>0,true);dv.setUint32(8,0,true);dv.setUint32(12,0,true);this.queue.writeBuffer(this.blit3DUbo,0,ab);const bg=this.device.createBindGroup({layout:this.bgl3D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:view3D},{binding:2,resource:{buffer:this.blit3DUbo}}]});const encoder=this.device.createCommandEncoder();const rpass=encoder.beginRenderPass({colorAttachments:[{view:captureTexture.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:0}}]});rpass.setPipeline(this.pipeline3D);rpass.setBindGroup(0,bg);rpass.draw(6,1,0,0);rpass.end();const bytesPerPixel=4;const align=256;const bytesPerRowUnaligned=W*bytesPerPixel;const bytesPerRow=Math.ceil(bytesPerRowUnaligned/align)*align;const bufferSize=bytesPerRow*H;const readBuffer=this.device.createBuffer({size:bufferSize,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});encoder.copyTextureToBuffer({texture:captureTexture},{buffer:readBuffer,bytesPerRow,rowsPerImage:H},{width:W,height:H,depthOrArrayLayers:1});this.queue.submit([encoder.finish()]);if(this.queue&&this.queue.onSubmittedWorkDone){await this.queue.onSubmittedWorkDone()}await readBuffer.mapAsync(GPUMapMode.READ);const mapped=readBuffer.getMappedRange();const src=new Uint8Array(mapped);const pixels=new Uint8ClampedArray(W*H*bytesPerPixel);let dst=0;for(let y=0;y<H;y++){const rowStart=y*bytesPerRow;for(let x=0;x<W;x++){const si=rowStart+x*4;pixels[dst++]=src[si+2];pixels[dst++]=src[si+1];pixels[dst++]=src[si+0];pixels[dst++]=src[si+3]}}readBuffer.unmap();readBuffer.destroy();captureTexture.destroy();this._applyExportBackground(pixels,bgSpec);const tmpCanvas=document.createElement("canvas");tmpCanvas.width=W;tmpCanvas.height=H;const ctx2d=tmpCanvas.getContext("2d");if(!ctx2d){throw new Error("export3DSliceToPNGBlob: unable to get 2D context")}ctx2d.putImageData(new ImageData(pixels,W,H),0,0);const blob=await new Promise((resolve,reject)=>{tmpCanvas.toBlob(b=>{if(b)resolve(b);else reject(new Error("export3DSliceToPNGBlob: toBlob returned null"))},"image/png")});return blob}async _render3DSliceToRGBA8Pixels(view3D,width,height,zNorm,channel=0,bgSpec=null){if(!view3D)throw new Error("_render3DSliceToRGBA8Pixels: view3D is required");const W=Math.max(1,width|0);const H=Math.max(1,height|0);this.initBlitRender();const z=Math.min(Math.max(Number(zNorm)||0,0),1);const format="bgra8unorm";const captureTexture=this.device.createTexture({size:[W,H,1],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});const ab=new ArrayBuffer(16);const dv=new DataView(ab);dv.setFloat32(0,z,true);dv.setUint32(4,channel>>>0,true);dv.setUint32(8,0,true);dv.setUint32(12,0,true);this.queue.writeBuffer(this.blit3DUbo,0,ab);const bg=this.device.createBindGroup({layout:this.bgl3D,entries:[{binding:0,resource:this.sampler},{binding:1,resource:view3D},{binding:2,resource:{buffer:this.blit3DUbo}}]});const encoder=this.device.createCommandEncoder();const rpass=encoder.beginRenderPass({colorAttachments:[{view:captureTexture.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:0}}]});rpass.setPipeline(this.pipeline3D);rpass.setBindGroup(0,bg);rpass.draw(6,1,0,0);rpass.end();const bytesPerPixel=4;const align=256;const bytesPerRowUnaligned=W*bytesPerPixel;const bytesPerRow=Math.ceil(bytesPerRowUnaligned/align)*align;const bufferSize=bytesPerRow*H;const readBuffer=this.device.createBuffer({size:bufferSize,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});encoder.copyTextureToBuffer({texture:captureTexture},{buffer:readBuffer,bytesPerRow,rowsPerImage:H},{width:W,height:H,depthOrArrayLayers:1});this.queue.submit([encoder.finish()]);if(this.queue&&this.queue.onSubmittedWorkDone){await this.queue.onSubmittedWorkDone()}await readBuffer.mapAsync(GPUMapMode.READ);const mapped=readBuffer.getMappedRange();const src=new Uint8Array(mapped);const pixels=new Uint8ClampedArray(W*H*bytesPerPixel);let dst=0;for(let y=0;y<H;y++){const rowStart=y*bytesPerRow;for(let x=0;x<W;x++){const si=rowStart+x*4;pixels[dst++]=src[si+2];pixels[dst++]=src[si+1];pixels[dst++]=src[si+0];pixels[dst++]=src[si+3]}}readBuffer.unmap();readBuffer.destroy();captureTexture.destroy();if(bgSpec)this._applyExportBackground(pixels,bgSpec);return pixels}async export3DTilesetToPNGBlob(target,tileWidth,tileHeight,opts={}){if(!target)throw new Error("export3DTilesetToPNGBlob: target is required");const TW=Math.max(1,tileWidth|0);const TH=Math.max(1,(tileHeight??tileWidth)|0);const{depth,channel=0,chunk=0,tilesAcross=16,tilesDown=null,startSlice=0,sliceCount=null}=opts;const bgSpec=this._resolveExportBackground(opts.background);this.initBlitRender();if(this.queue&&this.queue.onSubmittedWorkDone){try{await this.queue.onSubmittedWorkDone()}catch(e){}}let view3D;let d;if(target&&target.views&&Array.isArray(target.views)){const idx=Math.max(0,Math.min(chunk|0,target.views.length-1));view3D=target.views[idx];d=target.meta?.tile?.d??depth}else{view3D=target;d=depth}if(!view3D)throw new Error("export3DTilesetToPNGBlob: missing 3D view");if(!d||d<=0)throw new Error("export3DTilesetToPNGBlob: depth must be provided and > 0");const across=Math.max(1,tilesAcross|0);const down=tilesDown!==null&&tilesDown!==void 0?Math.max(1,tilesDown|0):Math.ceil(d/across);const start=Math.min(Math.max(startSlice|0,0),d-1);const count=sliceCount!==null&&sliceCount!==void 0?Math.max(0,sliceCount|0):d-start;const outW=TW*across;const outH=TH*down;const outPixels=new Uint8ClampedArray(outW*outH*4);const maxZ=Math.min(d,start+count);for(let z=start;z<maxZ;z++){const rel=z-start;const col=rel%across;const row=rel/across|0;if(row>=down)break;const zNorm=(z+.5)/d;const tilePixels=await this._render3DSliceToRGBA8Pixels(view3D,TW,TH,zNorm,channel,bgSpec);const dstBaseX=col*TW;const dstBaseY=row*TH;for(let y=0;y<TH;y++){const srcRowStart=y*TW*4;const dstRowStart=((dstBaseY+y)*outW+dstBaseX)*4;outPixels.set(tilePixels.subarray(srcRowStart,srcRowStart+TW*4),dstRowStart)}}const tmpCanvas=document.createElement("canvas");tmpCanvas.width=outW;tmpCanvas.height=outH;const ctx2d=tmpCanvas.getContext("2d");if(!ctx2d)throw new Error("export3DTilesetToPNGBlob: unable to get 2D context");ctx2d.putImageData(new ImageData(outPixels,outW,outH),0,0);const blob=await new Promise((resolve,reject)=>{tmpCanvas.toBlob(b=>{if(b)resolve(b);else reject(new Error("export3DTilesetToPNGBlob: toBlob returned null"))},"image/png")});return blob}};var BaseNoise=class{constructor(seed=Date.now()){if(seed<1e7)seed*=1e7;this.seedN=seed;this.seedK=seed;this.perm=new Uint8Array(512);this.seed(seed)}seed(seed){const random=this.xorshift(seed);for(let i=0;i<256;i++){this.perm[i]=i}for(let i=255;i>0;i--){const j=Math.floor(random()*(i+1));[this.perm[i],this.perm[j]]=[this.perm[j],this.perm[i]]}for(let i=0;i<256;i++){this.perm[i+256]=this.perm[i]}}setSeed(seed){this.seedN=seed;this.seed(seed);this.resetSeed()}random(x,y,z){let idx;if(typeof z==="number"){idx=this.perm[(x&255)+this.perm[(y&255)+this.perm[z&255]]]&255}else{idx=this.perm[(x&255)+this.perm[y&255]]&255}return this.perm[idx]/255*2-1}seededRandom(){this.seedK+=Math.E;const x=1e9*Math.sin(this.seedK);return x-Math.floor(x)}resetSeed(){this.seedK=this.seedN}xorshift(seed){let x=seed;return function(){x^=x<<13;x^=x>>17;x^=x<<5;return(x<0?1+~x:x)/4294967295}}dot(g,x=0,y=0,z=0){return g[0]*x+g[1]*y+g[2]*z}};export{__require,__commonJS,__toESM,NoiseComputeBuilder};
