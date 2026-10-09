// Temporal resolve has its own pipeline. The regular raymarch writes f32
// radiance into scratch so this split does not quantize before history blending.
fn resolveCloudColor(pixI: vec2<i32>, newCol: vec4<f32>, rayFarHistoryF: f32, temporalHistoryActive: bool) {
  // TAA with variance clamp
  let temporalActive = reproj.temporalBlend > 0.0001;
  if (temporalActive) {
    let fullRes = vec2<f32>(f32(reproj.fullWidth), f32(reproj.fullHeight));
    let uv_full = (vec2<f32>(fullPixFromCurrent(pixI)) + 0.5) / fullRes;

    var motion = vec2<f32>(0.0, 0.0);
    var prevUV = uv_full;
    if (reproj.enabled == 1u) {
      motion = textureSampleLevel(motionTex, samp2D, uv_full, 0.0).rg;
      if (reproj.motionIsNormalized == 0u) { motion = motion / fullRes; }
      prevUV = uv_full - motion;
    }

    if (prevUV.x < 0.0 || prevUV.y < 0.0 || prevUV.x > 1.0 || prevUV.y > 1.0) {
      textureStore(outTex, pixI, frame.layerIndex, newCol);
      store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);
    } else {
      let prevCol = textureSampleLevel(historyPrev, samp2D, prevUV, frame.layerIndex, 0.0);
      if (reproj.frameIndex == 0u || prevCol.a < 1e-5) {
        textureStore(outTex, pixI, frame.layerIndex, newCol);
        store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);
      } else {
        let motionPix = motion * fullRes;
        let motionMag = length(motionPix);
        let alphaDiff = abs(prevCol.a - newCol.a);
        let rgbDiff = length(prevCol.rgb - newCol.rgb);

        var stability = exp(-motionMag * 0.9) * exp(-alphaDiff * 6.0) * exp(-rgbDiff * 3.5);
        let bodyStable = smoothstep(0.38, 0.95, min(prevCol.a, newCol.a)) * exp(-motionMag * 0.35) * exp(-alphaDiff * 3.5);
        let speckleStable = bodyStable * exp(-motionMag * 1.8) * (1.0 - smoothstep(0.02, 0.16, rgbDiff));
        let convFrames = min(f32(reproj.frameIndex), 4.0);
        let convWarm = saturate((convFrames - 1.0) / 3.0);
        let staticConv = exp(-motionMag * 2.7) * exp(-alphaDiff * 9.0) * exp(-rgbDiff * 6.5);
        let stableBody = smoothstep(0.50, 0.98, bodyStable);
        let stableSpeckle = smoothstep(0.35, 0.96, speckleStable);
        var tb = clamp(reproj.temporalBlend * stability, 0.0, 0.985);
        tb *= mix_f(1.0, min(TUNE.farTaaHistoryBoost, 1.18), rayFarHistoryF);
        tb = clamp(tb * mix_f(1.0, 1.34, bodyStable), 0.0, 0.993);
        tb = max(tb, 0.76 * speckleStable);
        let fastConvLo = mix_f(0.62, 0.76, stableBody);
        let fastConvHi = mix_f(0.84, 0.94, max(stableBody, stableSpeckle));
        let fastConvFloor = mix_f(fastConvLo, fastConvHi, convWarm) * staticConv;
        tb = max(tb, fastConvFloor * mix_f(1.0, 1.08, rayFarHistoryF));
        tb = max(tb, 0.62 * stableBody * convWarm);
        tb = max(tb, 0.74 * stableSpeckle * convWarm);
        tb = clamp(tb, 0.0, 0.94);

        if (reproj.enabled == 1u && reproj.depthTest == 1u) {
          let prevDepth = textureSampleLevel(depthPrev, samp2D, prevUV, 0.0).r;
          tb *= select(1.0 - saturate(reproj.depthTolerance), 0.25, prevDepth < 1e-6 || prevDepth > 1.0);
        }

        let relBase = mix_f(TUNE.taaRelMax, TUNE.taaRelMin, saturate(stability));
        let relBody = mix_f(relBase, max(TUNE.taaRelMin * 0.95, 0.070), stableBody);
        let rel = relBody * mix_f(1.0, 0.92, rayFarHistoryF);

        let newLum = luminance(newCol.rgb);
        let prevLum = luminance(prevCol.rgb);
        let currentIsBrighter = smoothstep(0.010, 0.160, newLum - prevLum) * smoothstep(0.08, 0.80, newCol.a);
        let currentIsDarker = smoothstep(0.020, 0.180, prevLum - newLum) * smoothstep(0.08, 0.80, newCol.a);

        let histMinLum = newLum * mix_f(0.52, 0.86, stableBody) * currentIsBrighter;
        let histLift = max(prevLum, histMinLum) / max(prevLum, 1e-5);
        let liftedPrevRGB = prevCol.rgb * mix_f(1.0, histLift, currentIsBrighter);
        let prevClampedRGB = clamp_luma_to(liftedPrevRGB, newCol.rgb, rel, max(TUNE.taaAbsEps, 0.035));

        var tbSafe = tb;
        tbSafe *= mix_f(1.0, 0.42, currentIsBrighter);
        tbSafe *= mix_f(1.0, 0.72, currentIsDarker);
        tbSafe = min(tbSafe, mix_f(0.78, 0.46, currentIsBrighter));
        tbSafe = min(tbSafe, mix_f(0.88, 0.58, currentIsDarker));
        let auroraHistoryFloor = auroraModeF32(0.0, 0.18 * stableBody * convWarm);
        tbSafe = max(tbSafe, auroraHistoryFloor);
        let historyMaxLo = auroraModeF32(0.90, 0.42);
        let historyMaxHi = auroraModeF32(0.985, 0.64);
        tbSafe = min(tbSafe, mix_f(historyMaxLo, historyMaxHi, stableBody));

        let historyAlphaWindow = auroraModeF32(0.12, 0.08);
        let historyA = clamp(prevCol.a, newCol.a - historyAlphaWindow, newCol.a + historyAlphaWindow);
        let historyCol = vec4<f32>(prevClampedRGB, historyA);
        let blended = mix_v4(newCol, historyCol, tbSafe);
        textureStore(outTex, pixI, frame.layerIndex, blended);
        store_history_full_res_if_owner(pixI, frame.layerIndex, blended);
      }
    }
  } else {
    textureStore(outTex, pixI, frame.layerIndex, newCol);
    if (temporalHistoryActive) {
      store_history_full_res_if_owner(pixI, frame.layerIndex, newCol);
    }
  }
}

@compute @workgroup_size(8, 8, 1)
fn resolveCloudFlat(@builtin(global_invocation_id) gid: vec3<u32>) {
  var pixI = vec2<i32>(gid.xy) + vec2<i32>(frame.originX, frame.originY);
  if (reproj.compactInterleave != 0u && temporalCellRateNormalized() > 1u && reproj.frameIndex > 0u) {
    let mapped = compactTemporalPixel(gid.xy, temporalCellRateNormalized());
    if (mapped.z == 0u) { return; }
    pixI = vec2<i32>(mapped.xy);
  }
  if (any(pixI < vec2<i32>(0)) || any(pixI >= vec2<i32>(i32(frame.fullWidth), i32(frame.fullHeight)))) { return; }
  let index = (u32(frame.layerIndex) * frame.fullHeight + u32(pixI.y)) * frame.fullWidth + u32(pixI.x);
  let sample = cloudResolveSamples[index];
  if (sample.valid == 0u) { return; } // Misses already wrote transparent output/history.
  let historyActive = reproj.enabled == 1u || temporalCellRateNormalized() > 1u || reproj.temporalBlend > 0.0001;
  resolveCloudColor(pixI, sample.color, sample.farHistory, historyActive);
}
