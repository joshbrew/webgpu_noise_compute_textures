const kQuad : array<vec2<f32>, 6> = array<vec2<f32>, 6>(
  vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
  vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
);

struct VsOut {
  @builtin(position) pos : vec4<f32>,
  @location(0)       uv  : vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) i : u32) -> VsOut {
  let p = kQuad[i];
  var o : VsOut;
  o.pos = vec4<f32>(p, 0.0, 1.0);
  o.uv  = p * 0.5 + vec2<f32>(0.5, 0.5);
  return o;
}

@group(0) @binding(0) var samp : sampler;
@group(0) @binding(1) var tex3d : texture_3d<f32>;

struct UBlit3D {
  zNorm   : f32,  // normalized depth [0..1]
  channel : u32,
  _pad0   : u32,
  _pad1   : u32,
};
@group(0) @binding(2) var<uniform> U : UBlit3D;

@fragment
fn fs_main(in : VsOut) -> @location(0) vec4<f32> {
  let coord = vec3<f32>(in.uv, clamp(U.zNorm, 0.0, 1.0));
  let c = textureSample(tex3d, samp, coord);

  // display a single channel directly
  var v = c.r;
  if (U.channel == 2u) { v = c.g; }
  if (U.channel == 3u) { v = c.b; }
  if (U.channel == 4u) { v = c.a; }

  return vec4<f32>(clamp(v, 0.0, 1.0));
}
