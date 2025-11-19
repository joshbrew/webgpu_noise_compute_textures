// Bindings:
//  @binding(0) uniforms: k, invX/Y/Z, r2, gx, gy, gz, fieldOff
//  @binding(1) storage_read:   points : array<vec3<f32>>
//  @binding(2) storage_read_write: field: array<f32>

struct MetaBallUniforms {
    k        : f32,   // falloff constant in exp(-k * r²)
    invX     : f32,   // 1/(gx-1)
    invY     : f32,   // 1/(gy-1)
    invZ     : f32,   // 1/(gz-1)
    r2       : f32,   // squared radius of influence
    nPts     : u32,   // how many points are in `points`[]
    gx       : u32,   // voxel count in X
    gy       : u32,   // voxel count in Y
    gz       : u32,   // brick depth in Z
    fieldOff : u32,   // offset into the global field[]

    ox : f32,  oy : f32,  oz : f32,
    sx : f32,  sy : f32,  sz : f32,
}

@group(0) @binding(0) var<uniform>             u      : MetaBallUniforms;
@group(0) @binding(1) var<storage, read>       points : array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> field  : array<f32>;

@compute @workgroup_size(8,8,2)
fn cs(@builtin(global_invocation_id) gid: vec3<u32>) {
    // bounds within this brick
    if (gid.x >= u.gx || gid.y >= u.gy || gid.z >= u.gz) {
        return;
    }

    /* world‑space voxel centre */
    let pos = vec3<f32>(
        u.ox + f32(gid.x) * u.invX * u.sx,
        u.oy + f32(gid.y) * u.invY * u.sy,
        u.oz + f32(gid.z) * u.invZ * u.sz
    );

    // accumulate
    var sum: f32 = 0.0;
    let len = arrayLength(&points);
    for (var i = 0u; i < len; i = i + 1u) {
        let d     = pos - points[i].xyz;
        let dist2 = dot(d, d);
        if (dist2 <= u.r2) {
            sum = sum + exp(-u.k * dist2);
        }
    }

    // compute global index and write
    let localIdx = (gid.x * u.gy + gid.y) * u.gz + gid.z;
    let globalIdx = u.fieldOff + localIdx;
    field[globalIdx] = sum;
}

//todo: optimize