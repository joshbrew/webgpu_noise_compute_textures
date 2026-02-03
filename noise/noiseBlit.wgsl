// Fullscreen quad (module-scope constant)
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
@group(0) @binding(1) var tex  : texture_2d_array<f32>;

struct UBlit2D {
  layer   : u32,
  channel : u32,
  _pad0   : u32,
  _pad1   : u32,
};
@group(0) @binding(2) var<uniform> U : UBlit2D;

@fragment
fn fs_main(in : VsOut) -> @location(0) vec4<f32> {
  // For array textures the signature is (tex, sampler, uv, arrayIndex, level)
  let c = textureSampleLevel(tex, samp, in.uv, i32(U.layer), 0.0);

  // display a single channel directly
  var v = c.r;
  if (U.channel == 2u) { v = c.g; }
  if (U.channel == 3u) { v = c.b; }
  if (U.channel == 4u) { v = c.a; }

  return vec4<f32>(clamp(v, 0.0, 1.0));
}
