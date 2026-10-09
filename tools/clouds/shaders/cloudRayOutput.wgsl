// The staged raymarch module contains no temporal blending call graph.
fn beginLayerSample(pix: vec2<i32>) {
  let index = (u32(frame.layerIndex) * frame.fullHeight + u32(pix.y)) * frame.fullWidth + u32(pix.x);
  cloudResolveSamples[index].valid = 0u;
}
fn storeLayerSample(pix: vec2<i32>, color: vec4<f32>, farHistory: f32, historyActive: bool) {
  let index = (u32(frame.layerIndex) * frame.fullHeight + u32(pix.y)) * frame.fullWidth + u32(pix.x);
  cloudResolveSamples[index].color = color;
  cloudResolveSamples[index].farHistory = farHistory;
  cloudResolveSamples[index].valid = 1u;
}
