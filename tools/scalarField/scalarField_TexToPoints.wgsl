/******************************************************************************
 * scalarField_TexToPoints.wgsl
 *
 * One thread  → one “coarse” texel (block of size `step × step` in the source
 * texture array).  Emits **one vec4 point** per block that passes the threshold.
 * ---------------------------------------------------------------------------*/

struct DownInfo {
    srcW        : u32,    // full‑res width   (e.g. 4096)
    srcH        : u32,    // full‑res height  (e.g. 4096)
    step        : u32,    // sub‑sampling factor (e.g. 4 → dst = 1024)
    layers      : u32,    // texture array depth
    channelMode : u32,    // 0‑6  (matches your writer)
    heightScale : f32,    // scales z or w as noted below
    thresh      : f32,    // discard if primary value < thresh


    baseYCoarse : u32,  // first coarse y processed this pass
    dstHCoarse  : u32,  // full coarse‑grid height (for normalisation)
};
@group(0) @binding(0) var<uniform> d : DownInfo;

@group(0) @binding(1)
var myTex : texture_2d_array<f32>;

struct Counter { cnt : atomic<u32> };
@group(0) @binding(2)
var<storage, read_write> c : Counter;

@group(0) @binding(3)
var<storage, read_write> outPts : array<vec4<f32>>;

/* ---- helper: choose one texel in the source block ---------------------- */
fn sampleBlock(base : vec2<i32>, layer : i32) -> vec4<f32> {
    let center = base + vec2<i32>(i32(d.step) >> 1, i32(d.step) >> 1);
    return textureLoad(myTex, center, layer, 0);
}

/* ---- kernel ------------------------------------------------------------ */
@compute @workgroup_size(8, 8, 1)
fn cs(@builtin(global_invocation_id) gid : vec3<u32>) {
    let dstW : u32 = d.srcW / d.step;
    let dstH : u32 = d.srcH / d.step;

    if (gid.x >= dstW || gid.y >= dstH || gid.z >= d.layers) { return; }

    /* sample source block */
    let base  = vec2<i32>(i32(gid.x * d.step), i32(gid.y * d.step));
    let texel = sampleBlock(base, i32(gid.z));

    /* ----- derive primary value v and point xyz ----------------------- */
    var v : f32;
    var pos : vec3<f32>;

    // Normalised XY centre of this coarse cell (0‑1)
    let cx = (f32(gid.x) + 0.5) / f32(dstW);
    let cy = (f32(d.baseYCoarse + gid.y) + 0.5) / f32(d.dstHCoarse);

    //adapted from writeChannel in noiseCompute for parity
    switch(d.channelMode) {
        /* 0 : write same scalar to all rgba, we treat red as primary */
        case 0u, 1u {        // red
            v   = texel.x;
            pos = vec3<f32>(cx, cy, v * d.heightScale);
        }
        case 2u {            // green
            v   = texel.y;
            pos = vec3<f32>(cx, cy, v * d.heightScale);
        }
        case 3u {            // blue
            v   = texel.z;
            pos = vec3<f32>(cx, cy, v * d.heightScale);
        }
        case 4u {            // alpha
            v   = texel.w;
            pos = vec3<f32>(cx, cy, v * d.heightScale);
        }
        /* 5 : tex stores custom xyz, noise in w  → keep xyz, v = w */
        case 5u {
            v   = texel.w * d.heightScale;
            pos = texel.xyz;          // already normalised by writer
        }
        /* 6 : height‑map vertices (x,y from tex, z = h) */
        case 6u {
            v   = texel.z * d.heightScale;            // height value
            pos = vec3<f32>(texel.x, texel.y, v * d.heightScale);
        }
        /* default : treat red like mode 1 */
        default {
            v   = texel.x;
            pos = vec3<f32>(cx, cy, v * d.heightScale);
        }
    }

    /* optional cull */
    if (v < d.thresh) { return; }

    /* emit point ------------------------------------------------------- */
    let idx = atomicAdd(&c.cnt, 1u);
    outPts[idx] = vec4<f32>(pos, v);      // w carries primary value for later
}
