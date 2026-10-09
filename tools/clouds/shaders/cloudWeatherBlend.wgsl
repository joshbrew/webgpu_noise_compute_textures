struct BlendParams { amount:f32, _padding:vec3<f32> };
@group(0) @binding(0) var first: texture_2d_array<f32>;
@group(0) @binding(1) var second: texture_2d_array<f32>;
@group(0) @binding(2) var output: texture_storage_2d<rgba16float,write>;
@group(0) @binding(3) var<uniform> blend: BlendParams;
@compute @workgroup_size(8,8,1)
fn blendWeather(@builtin(global_invocation_id) id:vec3<u32>) {
  let dims=textureDimensions(output);
  if(any(id.xy>=dims)) { return; }
  let p=vec2<i32>(id.xy);
  textureStore(output,p,mix(textureLoad(first,p,0,0),textureLoad(second,p,0,0),clamp(blend.amount,0.0,1.0)));
}
