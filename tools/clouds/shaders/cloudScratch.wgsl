// Shared f32 storage between raymarch and temporal resolve (32 bytes/pixel).
struct CloudResolveSample {
  color: vec4<f32>,
  farHistory: f32,
  valid: u32,
  _pad: vec2<u32>,
};
@group(2) @binding(0) var<storage, read_write> cloudResolveSamples: array<CloudResolveSample>;
