// brickActivity.wgsl
// --------------------------------------------------------------------------
// @binding(0)  storage_read        field      : array<f32>
// @binding(1)  storage_read_write  brickBits  : array<u32>   // 1-bit per brick
// @binding(2)  uniform             params     : BrickParams
//
// BrickParams { iso     : f32        // isovalue (usually 0)
//               brickID : u32        // which brick this dispatch is
//               voxN    : u32 }      // voxels = gx*gy*gz  (<= 512)
struct BrickParams { iso: f32, brickID: u32, voxN: u32 };

@group(0) @binding(0) var<storage, read>       field     : array<f32>;
@group(0) @binding(1) var<storage, read_write> brickBits : array<u32>;
@group(0) @binding(2) var<uniform>             p         : BrickParams;

@compute @workgroup_size(64)
fn brickActivity(@builtin(global_invocation_id) gid : vec3<u32>)
{
    let i = gid.x;
    if (i >= p.voxN) { return; }

    let v = field[p.brickID * p.voxN + i];

    // keep two shared flags in LDS
    var<workgroup> anyPos : atomic<u32>;
    var<workgroup> anyNeg : atomic<u32>;

    if (i == 0u) {            // only one lane resets
        atomicStore(&anyPos, 0u);
        atomicStore(&anyNeg, 0u);
    }
    workgroupBarrier();

    if (v >  p.iso) { atomicStore(&anyPos, 1u); }
    if (v <= p.iso) { atomicStore(&anyNeg, 1u); }
    workgroupBarrier();

    if (i == 0u &&                         // one lane sets the bit
        atomicLoad(&anyPos) == 1u &&
        atomicLoad(&anyNeg) == 1u)
    {
        let w   = p.brickID >> 5u;
        let bit = 1u << (p.brickID & 31u);
        atomicOr(&brickBits[w], bit);
    }
}
