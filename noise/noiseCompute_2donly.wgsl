/*───────────────────────  Noise utils — WGSL  ───────────────────────
   • Uses a permutation table supplied from JavaScript.
   • Gradient set is fixed (identical to JS version).
   ----------------------------------------------------------------- */


// Roll your own PI constant
const PI : f32 = 3.141592653589793;
const ANGLE_INCREMENT : f32 = PI / 4.0;

struct NoiseComputeOptions {
    getGradient   : u32,  // offset 0
    useCustomPos  : u32,  // offset 4
    outputChannel : u32,  // offset 8
    _pad0         : u32,  // offset 12
    baseRadius    : f32,  // offset 16
    heightScale   : f32,  // offset 20
    _pad1         : f32,  // offset 24
    _pad2         : f32   // offset 28
    };
@group(0) @binding(0) var<uniform> options : NoiseComputeOptions;

// your old fields, plus explicit pads
struct NoiseParams {
    seed       : u32,   // offset 0 
    zoom       : f32,   // offset 4
    freq       : f32,   // offset 8
    octaves    : u32,   // offset 12

    lacunarity : f32,   // 16
    gain       : f32,   // 20
    xShift     : f32,   // 24
    yShift     : f32,   // 28

    zShift     : f32,   // 32
    turbulence : u32,   // 36
    seedAngle  : f32,   // 40
    exp1       : f32,   // 44

    exp2       : f32,   // 48
    threshold  : f32,   // 52
    rippleFreq : f32,   // for ripple variants
    time       : f32,   // global time for ripple

    warpAmp     : f32,   // 64  (domain-warp displacement)
    gaborRadius : f32,   // 68  (kernel radius, ~2–8)
    terraceStep : f32,   // 72  (# steps, 2–64)

};
@group(0) @binding(1) var<uniform> paramsArray : NoiseParams;

struct PermTable {
    values : array<u32, 512>,
};

@group(0) @binding(2) var<storage, read> permTable : PermTable; //this is what actually seeds the noise

@group(0) @binding(3)
var inputTex : texture_2d_array<f32>;

@group(0) @binding(4)
var outputTex : texture_storage_2d_array<rgba16float, write>;

@group(0) @binding(5) 
var<storage, read> posBuf : array<vec4<f32>>;

// binding(6): absolute pixel width/height uniform
struct Frame {
  fullWidth:  u32,  // offset 0
  fullHeight: u32,  // offset 4
  tileWidth:  u32,  // offset 8
  tileHeight: u32,  // offset 12
  originX:    i32,  // offset 16
  originY:    i32,  // offset 20
  layerIndex: i32,  // offset 24
};
@group(0) @binding(6) var<uniform> frame : Frame;


/* 12 gradient directions */
fn gradient(idx : u32) -> vec3<f32> {
    switch(idx & 11u) {          // idx % 12
        case  0u { return vec3<f32>( 1.0,  1.0,  0.0); }
        case  1u { return vec3<f32>(-1.0,  1.0,  0.0); }
        case  2u { return vec3<f32>( 1.0, -1.0,  0.0); }
        case  3u { return vec3<f32>(-1.0, -1.0,  0.0); }
        case  4u { return vec3<f32>( 1.0,  0.0,  1.0); }
        case  5u { return vec3<f32>(-1.0,  0.0,  1.0); }
        case  6u { return vec3<f32>( 1.0,  0.0, -1.0); }
        case  7u { return vec3<f32>(-1.0,  0.0, -1.0); }
        case  8u { return vec3<f32>( 0.0,  1.0,  1.0); }
        case  9u { return vec3<f32>( 0.0, -1.0,  1.0); }
        case 10u { return vec3<f32>( 0.0,  1.0, -1.0); }
        default  { return vec3<f32>( 0.0, -1.0, -1.0); }
    }
}

fn fade(t : f32) -> f32 {
    return t * t * t * t * (t * (t * (70.0 - 20.0 * t) - 84.0) + 35.0);
}

fn lerp(a : f32, b : f32, t : f32) -> f32 {
    return a + t * (b - a);
}

fn perm(idx : u32) -> u32 {
    return permTable.values[idx & 511u];   // table was duplicated in JS
}

// Euclidean distance helper
fn euclideanDist(a: vec3<f32>, b: vec3<f32>) -> f32 {
    return length(a - b);
}

// Zero-out narrow edges: if val < threshold ⇒ clamp to 0
fn edgeCut(val : f32, threshold : f32) -> f32 {
    return select(val, 0.0, val < threshold);
}


// helper to pick pos
fn fetchPos(fx: i32, fy: i32) -> vec3<f32> {
  if (options.useCustomPos == 1u) {
    let idx = u32(fy) * frame.fullWidth + u32(fx);
    return posBuf[idx].xyz;
  }
  // default: normalized xy in [0,1], z=0
  return vec3<f32>(
    f32(fx) / f32(frame.fullWidth),
    f32(fy) / f32(frame.fullHeight),
    0.0
  );
}

// ────────────────────────────────────────────────────────────
// Helper: finish a compute pass given fx,fy and the new noise v0
// ────────────────────────────────────────────────────────────
fn writeChannel(
    fx: i32, fy: i32, 
    v0: f32, channel: u32, 
    overwrite: u32
) {
    // 1) load all four previous channels
    let inCol: vec4<f32> = textureLoad(inputTex, vec2<i32>(fx, fy), frame.layerIndex, 0);

    // 2) start with a copy so we preserve untouched channels
    var outCol: vec4<f32> = inCol;

    // 3) branch on outputChannel
    if (channel == 0u) {
        // “all”: use red for prev, write to every component
        var h = v0;
        if(overwrite == 0) {h += inCol.x;}
        outCol = vec4<f32>(h);
    } else if (channel == 1u) {
        // red
        var h = v0;
        if(overwrite == 0) {h += inCol.x;}
        outCol.x = h;
    } else if (channel == 2u) {
        // green
        var h = v0;
        if(overwrite == 0) {h += inCol.y;}
        outCol.y = h;
    } else if (channel == 3u) {
        // blue
        var h = v0;
        if(overwrite == 0) {h += inCol.z;}
        outCol.z = h;
    } else if (channel == 4u) {
        // alpha
        var h = v0;
        if(overwrite == 0) {h += inCol.w;}
        outCol.w = h;
    } else if (channel == 5u) { //write position in xyz and noise result in w, this if for 3d generation purposes
        var h = v0;
        if(overwrite == 0) {h += inCol.w;}
        let p = fetchPos(fx, fy);
        outCol.x = p.x;
        outCol.y = p.y;
        outCol.z = p.z;
        outCol.w = h; 
        // put the heightmap reading in the h channel
    } else if (channel == 6u) { //heightmap vertices with z as height and x and y as the current xy positions
        var h = v0;
        if(overwrite == 0) {h += inCol.w;}
        let p = fetchPos(fx, fy);
        outCol.x = p.x;
        outCol.y = p.y;
        outCol.z = h; //z heightmap 
        // put the heightmap reading in the h channel
    }

    // 4) store back
    textureStore(outputTex, vec2<i32>(fx, fy), frame.layerIndex, outCol);
}


/*──────────────────────────  3-D Perlin  ──────────────────────────*/
fn noise3D(pos : vec3<f32>) -> f32 {
    let X : u32 = u32(floor(pos.x)) & 255u;
    let Y : u32 = u32(floor(pos.y)) & 255u;
    let Z : u32 = u32(floor(pos.z)) & 255u;

    let xf = pos.x - floor(pos.x);
    let yf = pos.y - floor(pos.y);
    let zf = pos.z - floor(pos.z);

    let u = fade(xf);
    let v = fade(yf);
    let w = fade(zf);

    /* hash through helper that reads storage buffer */
    let A  = perm(X) + Y;
    let AA = perm(A & 255u) + Z;
    let AB = perm((A + 1u) & 255u) + Z;
    let B  = perm((X + 1u) & 255u) + Y;
    let BA = perm(B & 255u) + Z;
    let BB = perm((B + 1u) & 255u) + Z;

    /* eight hashed gradients */
    let gAA  = gradient(perm(AA & 255u) % 12u);
    let gBA  = gradient(perm(BA & 255u) % 12u);
    let gAB  = gradient(perm(AB & 255u) % 12u);
    let gBB  = gradient(perm(BB & 255u) % 12u);
    let gAA1 = gradient(perm((AA + 1u) & 255u) % 12u);
    let gBA1 = gradient(perm((BA + 1u) & 255u) % 12u);
    let gAB1 = gradient(perm((AB + 1u) & 255u) % 12u);
    let gBB1 = gradient(perm((BB + 1u) & 255u) % 12u);

    /* blend */
    let x1 = lerp(dot(gAA , vec3<f32>(xf      , yf      , zf)),
                  dot(gBA , vec3<f32>(xf - 1.0, yf      , zf)), u);
    let x2 = lerp(dot(gAB , vec3<f32>(xf      , yf - 1.0, zf)),
                  dot(gBB , vec3<f32>(xf - 1.0, yf - 1.0, zf)), u);
    let y1 = lerp(x1, x2, v);

    let x3 = lerp(dot(gAA1, vec3<f32>(xf      , yf      , zf - 1.0)),
                  dot(gBA1, vec3<f32>(xf - 1.0, yf      , zf - 1.0)), u);
    let x4 = lerp(dot(gAB1, vec3<f32>(xf      , yf - 1.0, zf - 1.0)),
                  dot(gBB1, vec3<f32>(xf - 1.0, yf - 1.0, zf - 1.0)), u);
    let y2 = lerp(x3, x4, v);

    return lerp(y1, y2, w);
}

/*──────────────────────────  2-D Simplex  ─────────────────────────*/
fn simplex2D(p : vec2<f32>) -> f32 {
    let F2 : f32 = 0.3660254037844386;    // (√3-1)/2
    let G2 : f32 = 0.2113248654051871;    // (3-√3)/6

    /* skew to simplex grid */
    let s  = (p.x + p.y) * F2;
    let i  = floor(p.x + s);
    let j  = floor(p.y + s);
    let t  = (i + j) * G2;

    let X0 = i - t;
    let Y0 = j - t;
    let x0 = p.x - X0;
    let y0 = p.y - Y0;

    /* simplex corner order */
    var i1 : f32 = 0.0;
    var j1 : f32 = 0.0;
    if (x0 > y0) { i1 = 1.0; } else { j1 = 1.0; }

    /* offsets for remaining corners */
    let x1 = x0 - i1 + G2;
    let y1 = y0 - j1 + G2;
    let x2 = x0 - 1.0 + 2.0 * G2;
    let y2 = y0 - 1.0 + 2.0 * G2;

    /* hashed gradients */
    let ii  = u32(i) & 255u;
    let jj  = u32(j) & 255u;
    let gi0 = perm(ii + perm(jj)) % 12u;
    let gi1 = perm(ii + u32(i1) + perm((jj + u32(j1)) & 255u)) % 12u;
    let gi2 = perm((ii + 1u) + perm((jj + 1u) & 255u)) % 12u;

    /* contributions from each corner */
    var t0 = 0.5 - x0 * x0 - y0 * y0;
    var n0 : f32 = 0.0;
    if (t0 > 0.0) {
        t0 *= t0;
        n0 = t0 * t0 * dot(gradient(gi0), vec3<f32>(x0, y0, 0.0));
    }

    var t1 = 0.5 - x1 * x1 - y1 * y1;
    var n1 : f32 = 0.0;
    if (t1 > 0.0) {
        t1 *= t1;
        n1 = t1 * t1 * dot(gradient(gi1), vec3<f32>(x1, y1, 0.0));
    }

    var t2 = 0.5 - x2 * x2 - y2 * y2;
    var n2 : f32 = 0.0;
    if (t2 > 0.0) {
        t2 *= t2;
        n2 = t2 * t2 * dot(gradient(gi2), vec3<f32>(x2, y2, 0.0));
    }

    return 70.0 * (n0 + n1 + n2);        // ~[-1,1] range
}


// ──────────────────────── 3-D Simplex Noise ────────────────────────────
// Call it like: let v = simplex3D(vec3<f32>(x,y,z));

fn simplex3D(pos : vec3<f32>) -> f32 {
    // Skew/​unskew factors for 3D
    let F3 : f32 = 1.0 / 3.0;
    let G3 : f32 = 1.0 / 6.0;

    // Skew the input space to find the simplex cell
    let s  = (pos.x + pos.y + pos.z) * F3;
    let i_f = floor(pos.x + s);
    let j_f = floor(pos.y + s);
    let k_f = floor(pos.z + s);

    let i = i32(i_f);
    let j = i32(j_f);
    let k = i32(k_f);

    // Unskew back to (x,y,z) space
    let t0 = f32(i + j + k) * G3;
    let X0 = f32(i) - t0;
    let Y0 = f32(j) - t0;
    let Z0 = f32(k) - t0;

    var x0 = pos.x - X0;
    var y0 = pos.y - Y0;
    var z0 = pos.z - Z0;

    // Determine which simplex we are in
    var i1: i32; var j1: i32; var k1: i32;
    var i2: i32; var j2: i32; var k2: i32;
    if (x0 >= y0) {
        if (y0 >= z0) {
            // X Y Z
            i1 = 1; j1 = 0; k1 = 0;
            i2 = 1; j2 = 1; k2 = 0;
        } else if (x0 >= z0) {
            // X Z Y
            i1 = 1; j1 = 0; k1 = 0;
            i2 = 1; j2 = 0; k2 = 1;
        } else {
            // Z X Y
            i1 = 0; j1 = 0; k1 = 1;
            i2 = 1; j2 = 0; k2 = 1;
        }
    } else {
        if (y0 < z0) {
            // Z Y X
            i1 = 0; j1 = 0; k1 = 1;
            i2 = 0; j2 = 1; k2 = 1;
        } else if (x0 < z0) {
            // Y Z X
            i1 = 0; j1 = 1; k1 = 0;
            i2 = 0; j2 = 1; k2 = 1;
        } else {
            // Y X Z
            i1 = 0; j1 = 1; k1 = 0;
            i2 = 1; j2 = 1; k2 = 0;
        }
    }

    // Offsets for the other three corners
    let x1 = x0 - f32(i1) + G3;
    let y1 = y0 - f32(j1) + G3;
    let z1 = z0 - f32(k1) + G3;

    let x2 = x0 - f32(i2) + 2.0 * G3;
    let y2 = y0 - f32(j2) + 2.0 * G3;
    let z2 = z0 - f32(k2) + 2.0 * G3;

    let x3 = x0 - 1.0 + 3.0 * G3;
    let y3 = y0 - 1.0 + 3.0 * G3;
    let z3 = z0 - 1.0 + 3.0 * G3;

    // Hash the corner indices to get gradient indices
    let ii = u32(i) & 255u;
    let jj = u32(j) & 255u;
    let kk = u32(k) & 255u;

    let gi0 = perm(ii + perm(jj + perm(kk)))        % 12u;
    let gi1 = perm(ii + u32(i1) + perm((jj + u32(j1)) + perm((kk + u32(k1))))) % 12u;
    let gi2 = perm(ii + u32(i2) + perm((jj + u32(j2)) + perm((kk + u32(k2))))) % 12u;
    let gi3 = perm(ii + 1u      + perm((jj + 1u     ) + perm((kk + 1u     )))) % 12u;

    // Compute contributions from each corner
    var n0: f32;
    var t_0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (t_0 < 0.0) {
        n0 = 0.0;
    } else {
        let t2 = t_0 * t_0;
        n0 = t2 * t2 * dot(gradient(gi0), vec3<f32>(x0, y0, z0));
    }

    var n1: f32;
    var t_1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t_1 < 0.0) {
        n1 = 0.0;
    } else {
        let t2 = t_1 * t_1;
        n1 = t2 * t2 * dot(gradient(gi1), vec3<f32>(x1, y1, z1));
    }

    var n2: f32;
    var t_2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t_2 < 0.0) {
        n2 = 0.0;
    } else {
        let t2 = t_2 * t_2;
        n2 = t2 * t2 * dot(gradient(gi2), vec3<f32>(x2, y2, z2));
    }

    var n3: f32;
    var t_3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t_3 < 0.0) {
        n3 = 0.0;
    } else {
        let t2 = t_3 * t_3;
        n3 = t2 * t2 * dot(gradient(gi3), vec3<f32>(x3, y3, z3));
    }

    // Final scale to match [-1,1]
    return 32.0 * (n0 + n1 + n2 + n3);
}

/*────────────────────────  helpers  ────────────────────────*/
const INV_255 : f32 = 1.0 / 127.5;      // 2/255  (scale to [-1,1])

fn cubicInterpolate(p0 : f32, p1 : f32, p2 : f32, p3 : f32, t : f32) -> f32 {
    return p1 + 0.5 * t *
        (p2 - p0 + t *
        (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3 + t *
        (3.0 * (p1 - p2) + p3 - p0)));
}

/* hashed value in [-1,1] — 2-D */
fn rand2(ix : i32, iy : i32) -> f32 {
    let idx = perm(
                (u32(ix) & 255u)
              + perm(u32(iy) & 255u)
            ) & 255u;
    return f32(perm(idx)) * INV_255 - 1.0;
}

// hashed value in [-1,1] — 3-D
fn rand3(ix : i32, iy : i32, iz : i32) -> f32 {
    let idx = perm(
                (u32(ix) & 255u)
              + perm((u32(iy) & 255u)
                     + perm(u32(iz) & 255u))
            ) & 255u;
    return f32(perm(idx)) * INV_255 - 1.0;
}

// hashed value in [0,1] — 2-D
fn rand2u(ix: i32, iy: i32) -> f32 {
    let idx = perm((u32(ix) & 255u) + perm(u32(iy) & 255u)) & 255u;
    return f32(perm(idx)) / 255.0;
}

fn rand3u(ix: i32, iy: i32, iz: i32) -> f32 {
    let idx = perm(
                (u32(ix) & 255u)
              + perm((u32(iy) & 255u)
                     + perm(u32(iz) & 255u))
            ) & 255u;
    return f32(perm(idx)) / 255.0;
}

/*──────────────────────  Fast Lanczos 2-D  ──────────────────────*/
fn lanczos2D(pos : vec2<f32>) -> f32 {
    let ix  : i32 = i32(floor(pos.x));
    let iy  : i32 = i32(floor(pos.y));
    let dx  : f32 = pos.x - f32(ix);
    let dy  : f32 = pos.y - f32(iy);

    /* 4×4 neighbourhood hashed once — unrolled for speed */
    let n00 = rand2(ix - 1, iy - 1);
    let n10 = rand2(ix + 0, iy - 1);
    let n20 = rand2(ix + 1, iy - 1);
    let n30 = rand2(ix + 2, iy - 1);

    let n01 = rand2(ix - 1, iy + 0);
    let n11 = rand2(ix + 0, iy + 0);
    let n21 = rand2(ix + 1, iy + 0);
    let n31 = rand2(ix + 2, iy + 0);

    let n02 = rand2(ix - 1, iy + 1);
    let n12 = rand2(ix + 0, iy + 1);
    let n22 = rand2(ix + 1, iy + 1);
    let n32 = rand2(ix + 2, iy + 1);

    let n03 = rand2(ix - 1, iy + 2);
    let n13 = rand2(ix + 0, iy + 2);
    let n23 = rand2(ix + 1, iy + 2);
    let n33 = rand2(ix + 2, iy + 2);

    /* cubic along x (columns) */
    let col0 = cubicInterpolate(n00, n10, n20, n30, dx);
    let col1 = cubicInterpolate(n01, n11, n21, n31, dx);
    let col2 = cubicInterpolate(n02, n12, n22, n32, dx);
    let col3 = cubicInterpolate(n03, n13, n23, n33, dx);

    /* cubic along y (rows)  */
    return cubicInterpolate(col0, col1, col2, col3, dy);
}


/* helper to fetch one z-slice and cubic-interpolate along x/y */
fn slice(ix : i32, iy : i32, iz : i32, dx : f32, dy : f32) -> f32 {
    let n00 = rand3(ix - 1, iy - 1, iz);
    let n10 = rand3(ix + 0, iy - 1, iz);
    let n20 = rand3(ix + 1, iy - 1, iz);
    let n30 = rand3(ix + 2, iy - 1, iz);

    let n01 = rand3(ix - 1, iy + 0, iz);
    let n11 = rand3(ix + 0, iy + 0, iz);
    let n21 = rand3(ix + 1, iy + 0, iz);
    let n31 = rand3(ix + 2, iy + 0, iz);

    let n02 = rand3(ix - 1, iy + 1, iz);
    let n12 = rand3(ix + 0, iy + 1, iz);
    let n22 = rand3(ix + 1, iy + 1, iz);
    let n32 = rand3(ix + 2, iy + 1, iz);

    let n03 = rand3(ix - 1, iy + 2, iz);
    let n13 = rand3(ix + 0, iy + 2, iz);
    let n23 = rand3(ix + 1, iy + 2, iz);
    let n33 = rand3(ix + 2, iy + 2, iz);

    let col0 = cubicInterpolate(n00, n10, n20, n30, dx);
    let col1 = cubicInterpolate(n01, n11, n21, n31, dx);
    let col2 = cubicInterpolate(n02, n12, n22, n32, dx);
    let col3 = cubicInterpolate(n03, n13, n23, n33, dx);

    return cubicInterpolate(col0, col1, col2, col3, dy);
}


/*──────────────────────  Fast Lanczos 3-D  ──────────────────────*/
fn lanczos3D(pos : vec3<f32>) -> f32 {
    let ix : i32 = i32(floor(pos.x));
    let iy : i32 = i32(floor(pos.y));
    let iz : i32 = i32(floor(pos.z));
    let dx : f32 = pos.x - f32(ix);
    let dy : f32 = pos.y - f32(iy);
    let dz : f32 = pos.z - f32(iz);

    /* 4×4×4 neighbourhood — fetch & interpolate on-the-fly */

    let row0 = slice(ix, iy, iz - 1, dx, dy);
    let row1 = slice(ix, iy, iz + 0, dx, dy);
    let row2 = slice(ix, iy, iz + 1, dx, dy);
    let row3 = slice(ix, iy, iz + 2, dx, dy);

    return cubicInterpolate(row0, row1, row2, row3, dz);
}


/*──────────────────────────  Voronoi 2-D  ─────────────────────────────*/
fn voronoi2D(pos : vec2<f32>) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));

    var minDist : f32 = 1e9;
    var minVal  : f32 = 0.0;

    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
            let xi = fx + dx;
            let yi = fy + dy;

            let px = f32(xi) + rand2u(xi, yi);
            let py = f32(yi) + rand2u(yi, xi);

            let dist = (px - pos.x) * (px - pos.x) +
                       (py - pos.y) * (py - pos.y);

            if (dist < minDist) {
                minDist = dist;
                minVal  = rand2u(xi, yi);
            }
        }
    }
    return minVal;          // in [0,1]
}

/*──────────────────────────  Voronoi 3-D  ─────────────────────────────*/
fn voronoi3D(pos : vec3<f32>) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));
    let fz : i32 = i32(floor(pos.z));

    var minDist : f32 = 1e9;
    var minVal  : f32 = 0.0;

    for (var dz : i32 = -1; dz <= 1; dz = dz + 1) {
        for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
            for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
                let xi = fx + dx;
                let yi = fy + dy;
                let zi = fz + dz;

                let px = f32(xi) + rand3u(xi, yi, zi);
                let py = f32(yi) + rand3u(yi, zi, xi);
                let pz = f32(zi) + rand3u(zi, xi, yi);

                let dist = (px - pos.x) * (px - pos.x) +
                           (py - pos.y) * (py - pos.y) +
                           (pz - pos.z) * (pz - pos.z);

                if (dist < minDist) {
                    minDist = dist;
                    minVal  = rand3u(xi, yi, zi);
                }
            }
        }
    }
    return minVal;          // in [0,1]
}

/*──────────────────────────  Cellular 2-D  ─────────────────────────────*/
fn cellular2D(pos : vec2<f32>) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));

    var minDist1 : f32 = 1e9;
    var minDist2 : f32 = 1e9;

    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
            let xi = fx + dx;
            let yi = fy + dy;

            /* feature point */
            let px = f32(xi) + rand2u(xi, yi);
            let py = f32(yi) + rand2u(yi, xi);

            /* squared distance */
            let d = (px - pos.x) * (px - pos.x)
                  + (py - pos.y) * (py - pos.y);

            /* keep two smallest distances */
            if (d < minDist1) {
                minDist2 = minDist1;
                minDist1 = d;
            } else if (d < minDist2) {
                minDist2 = d;
            }
        }
    }
    /* return difference of 1st and 2nd nearest feature distances */
    return minDist2 - minDist1;
}

/*──────────────────────────  Cellular 3-D  ─────────────────────────────*/
fn cellular3D(pos : vec3<f32>) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));
    let fz : i32 = i32(floor(pos.z));

    var minDist1 : f32 = 1e9;
    var minDist2 : f32 = 1e9;

    for (var dz : i32 = -1; dz <= 1; dz = dz + 1) {
        for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
            for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
                let xi = fx + dx;
                let yi = fy + dy;
                let zi = fz + dz;

                /* feature point */
                let px = f32(xi) + rand3u(xi, yi, zi);
                let py = f32(yi) + rand3u(yi, zi, xi);
                let pz = f32(zi) + rand3u(zi, xi, yi);

                /* squared distance */
                let d = (px - pos.x) * (px - pos.x)
                      + (py - pos.y) * (py - pos.y)
                      + (pz - pos.z) * (pz - pos.z);

                /* keep two smallest distances */
                if (d < minDist1) {
                    minDist2 = minDist1;
                    minDist1 = d;
                } else if (d < minDist2) {
                    minDist2 = d;
                }
            }
        }
    }
    /* return difference of 1st and 2nd nearest feature distances */
    return minDist2 - minDist1;
}

/*──────────────────────────  Worley (F1) Noise  ───────────────────────────*/
/* Assumes rand2u(), rand3u() helpers (returning [0,1]) are already defined. */

/*──────────────────────────  Worley 2-D  ────────────────────────────────*/
fn worley2D(pos : vec2<f32>) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));

    var minDist : f32 = 1e9;

    for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
        for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
            let xi = fx + dx;
            let yi = fy + dy;

            /* feature point */
            let px = f32(xi) + rand2u(xi, yi);
            let py = f32(yi) + rand2u(yi, xi);

            /* squared distance */
            let d = (px - pos.x) * (px - pos.x)
                  + (py - pos.y) * (py - pos.y);

            if (d < minDist) {
                minDist = d;
            }
        }
    }

    return sqrt(minDist);    // Euclidean distance to nearest feature
}

/*──────────────────────────  Worley 3-D  ────────────────────────────────*/
fn worley3D(pos : vec3<f32>) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));
    let fz : i32 = i32(floor(pos.z));

    var minDist : f32 = 1e9;

    for (var dz : i32 = -1; dz <= 1; dz = dz + 1) {
        for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
            for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
                let xi = fx + dx;
                let yi = fy + dy;
                let zi = fz + dz;

                /* feature point */
                let px = f32(xi) + rand3u(xi, yi, zi);
                let py = f32(yi) + rand3u(yi, zi, xi);
                let pz = f32(zi) + rand3u(zi, xi, yi);

                /* squared distance */
                let d = (px - pos.x) * (px - pos.x)
                      + (py - pos.y) * (py - pos.y)
                      + (pz - pos.z) * (pz - pos.z);

                if (d < minDist) {
                    minDist = d;
                }
            }
        }
    }

    return sqrt(minDist);    // Euclidean distance to nearest feature
}

/*────────────────────  Curl-noise (vector)  ───────────────────*/
fn curlNoise3D(p: vec3<f32>, eps: f32) -> vec3<f32> {
    let e = vec3<f32>(eps, 0.0, 0.0);
    let dFdy = generatePerlin(p + e.yxz, paramsArray) - generatePerlin(p - e.yxz, paramsArray);
    let dFdz = generatePerlin(p + e.zxy, paramsArray) - generatePerlin(p - e.zxy, paramsArray);
    let dFdx = generatePerlin(p + e,      paramsArray) - generatePerlin(p - e,      paramsArray);
    return normalize(vec3<f32>(dFdy - dFdz, dFdz - dFdx, dFdx - dFdy));
}

/*────────────────────  Domain-warp FBM  ───────────────────────*/
fn domainWarpFBM(p: vec3<f32>, params: NoiseParams,
                 warpAmp: f32, stages: u32) -> f32 {
    var q = p;
    for (var i: u32 = 0u; i < stages; i = i + 1u) {
        let w = fbm3D(q, params) * warpAmp;
        q = q + vec3<f32>(w, w, w);
    }
    return fbm3D(q, params);
}

/*────────────────────  Gabor sparse-convolution  ──────────────*/
fn gaborNoise3D(p: vec3<f32>, params: NoiseParams) -> f32 {
    // very light GPU version: 3 psf taps around p
    let R = params.gaborRadius;
    var sum : f32 = 0.0;
    for (var i = -1; i <= 1; i = i + 1) {
        for (var j = -1; j <= 1; j = j + 1) {
            let xi = vec3<f32>(f32(i), f32(j), 0.0);
            let w  = exp(-dot(xi, xi) / (R*R));
            let n  = simplex3D(p + xi, );   // carrier
            sum += w * n;
        }
    }
    return sum * 0.75;                     // stay roughly in [-1,1]
}

/*────────────────────  Terrace & Foam filters  ───────────────*/
fn terrace(v:f32, steps:f32)  -> f32 { return floor(v*steps)/steps; }
fn foamify(v:f32)             -> f32 { return pow(abs(v), 3.0)*sign(v); }
fn turbulence(v:f32)          -> f32 { return abs(v); }

/*────────────────────  Simplex-only generators  ───────────────*/
fn generateSimplex(pos: vec3<f32>, p: NoiseParams) -> f32 {
    let q = (pos / p.zoom) * p.freq + vec3<f32>(p.xShift, p.yShift, p.zShift);
    let v = simplex3D(q);
    return v;
}

fn generateSimplexFBM(pos: vec3<f32>, p: NoiseParams) -> f32 {
    // fbm3D internally uses simplex3D
    let v = fbm3D(pos, p);
    return v;
}

/*────────────────────  Wrapper generators  ───────────────────*/
fn generateCurlNoise3D(pos: vec3<f32>, p: NoiseParams) -> f32 {
    // If you store RGB as the curl vector elsewhere, this returns the magnitude only.
    let curl = curlNoise3D(pos, 0.01);
    let m = length(curl);
    return m;
}

fn generateDomainWarpFBM1(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let v = domainWarpFBM(pos, par, par.warpAmp, 1u);
    return v;
}

fn generateDomainWarpFBM2(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let v = domainWarpFBM(pos, par, par.warpAmp, 2u);
    return v;
}

fn generateGaborAniso(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let v = gaborNoise3D(pos, par);
    return v;
}

fn generateTerraceNoise(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let base = generatePerlin(pos, par);
    let v = terrace(base, par.terraceStep);
    return v;
}

fn generateFoamNoise(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let base = generateBillow(pos, par);
    let v = foamify(base);
    return v;
}

fn generateTurbulence(pos: vec3<f32>, par: NoiseParams) -> f32 {
    let base = generatePerlin(pos, par);
    let v = turbulence(base);
    return v;
}



// ────────────────────────── Perlin Noise Generator ──────────────────────────
fn generatePerlin(pos : vec3<f32>, params:NoiseParams) -> f32 {
    // initial coords scaled by zoom
    var x = pos.x / params.zoom * params.freq + params.xShift;
    var y = pos.y / params.zoom * params.freq + params.yShift;
    var z = pos.z / params.zoom * params.freq + params.zShift;

    var sum : f32 = 0.0;
    var amp : f32 = 1.0;
    var freqLoc : f32 = params.freq;
    var angle : f32 = params.seedAngle;

    // accumulate octaves
    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        // sample base noise
        var n : f32 = noise3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)) * amp;
        // optional billow / turbulence
        if (params.turbulence == 1u) {
            n = abs(n);
        }
        sum = sum + n;

        // update frequency & amplitude
        freqLoc = freqLoc * params.lacunarity;
        amp     = amp     * params.gain;

        // rotate coords in XY plane + push into Z
        let c = cos(angle);
        let s = sin(angle);
        let nx = x * c - y * s;
        let ny = x * s + y * c;
        let nz = y * s + z * c;

        // apply shifts
        x = nx + params.xShift;
        y = ny + params.yShift;
        z = nz + params.zShift;

        // increment angle
        angle = angle + ANGLE_INCREMENT;
    }

    // final tweak for turbulence mode
    if (params.turbulence == 1u) {
        sum = sum - 1.0;
    }
    return sum;
}

// ──────────────────────── Billow Noise Generator ────────────────────────
fn generateBillow(pos : vec3<f32>, params:NoiseParams) -> f32 {
    var x = pos.x / params.zoom * params.freq + params.xShift;
    var y = pos.y / params.zoom * params.freq + params.yShift;
    var z = pos.z / params.zoom * params.freq + params.zShift;
    var sum     : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = params.freq;
    var angle   : f32 = params.seedAngle;

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        let n = noise3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));
        sum = sum + (2.0 * abs(n) - 1.0) * amp;

        freqLoc = freqLoc * params.lacunarity;
        amp     = amp     * params.gain;

        let c  = cos(angle);
        let s  = sin(angle);
        let nx = x * c - y * s;
        let ny = x * s + y * c;
        let nz = y * s + z * c;

        x = nx + params.xShift;
        y = ny + params.yShift;
        z = nz + params.zShift;

        angle = angle + ANGLE_INCREMENT;
    }

    sum = sum + 1.0;
    return sum;
}

// ─────────────────────── Anti-Billow Noise Generator ──────────────────────
fn generateAntiBillow(pos : vec3<f32>, params:NoiseParams) -> f32 {
    return -generateBillow(pos, params);
}

// ──────────────────────── Ridge Noise Generator ────────────────────────
// basic ridge transform of gradient noise
fn ridgeNoise(pos : vec3<f32>) -> f32 {
    let v = noise3D(pos);
    let w = 1.0 - abs(v);
    return w * w;
}

// octave‐sum generator using ridge noise
// sample like: let r = generateRidge(vec3<f32>(x,y,z));
fn generateRidge(pos : vec3<f32>, params:NoiseParams) -> f32 {
    var x = pos.x / params.zoom * params.freq + params.xShift;
    var y = pos.y / params.zoom * params.freq + params.yShift;
    var z = pos.z / params.zoom * params.freq + params.zShift;
    var sum     : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = params.freq;

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        sum = sum + ridgeNoise(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)) * amp;
        freqLoc = freqLoc * params.lacunarity;
        amp     = amp     * params.gain;
        x = x + params.xShift;
        y = y + params.yShift;
        z = z + params.zShift;
    }

    // JS did: sum -= 1; return -sum;
    sum = sum - 1.0;
    return -sum;
}

// ────────────────────── Anti‐Ridge Noise Generator ──────────────────────
// identical ridge transform, but flips sign at output
fn generateAntiRidge(pos : vec3<f32>, params:NoiseParams) -> f32 {
    // reuse generateRidge and negate its result
    return -generateRidge(pos, params);
}

// ─────────────── Ridged Multifractal Noise (Fast Lanczos) ───────────────
// ─────────────── Ridged Multifractal Noise (Fast Lanczos) ───────────────
fn generateRidgedMultifractal(pos : vec3<f32>, params:NoiseParams) -> f32 {
    // initial coords: zoom + freq
    var x = pos.x / params.zoom * params.freq + params.xShift;
    var y = pos.y / params.zoom * params.freq + params.yShift;
    var z = pos.z / params.zoom * params.freq + params.zShift;

    // first octave
    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x, y, z)));
    var amp : f32 = 1.0;

    // subsequent octaves
    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {
        x = x * params.lacunarity;
        y = y * params.lacunarity;
        z = z * params.lacunarity;
        amp = amp * params.gain;

        var n : f32 = abs(lanczos3D(vec3<f32>(x, y, z)));
        if (params.exp2 != 0.0) {
            n = 1.0 - pow(n, params.exp2);
        }
        if (params.exp1 != 0.0) {
            n = pow(n, params.exp1);
        }

        sum = sum - n * amp;

        x = x + params.xShift;
        y = y + params.yShift;
        z = z + params.zShift;
    }

    return sum;
}

// ───────────── Ridged Multifractal Noise 2 (Fast Lanczos + Rotation) ────────────
fn generateRidgedMultifractal2(pos : vec3<f32>, params:NoiseParams) -> f32 {
    // zoom + freq
    var x = (pos.x + params.xShift) / params.zoom * params.freq;
    var y = (pos.y + params.yShift) / params.zoom * params.freq;
    var z = (pos.z + params.zShift) / params.zoom * params.freq;

    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x, y, z)));
    var amp : f32 = 1.0;
    var angle : f32 = params.seedAngle;

    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {
        x = x * params.lacunarity;
        y = y * params.lacunarity;
        z = z * params.lacunarity;
        amp = amp * params.gain;

        var n : f32 = abs(lanczos3D(vec3<f32>(x, y, z)));
        if (params.exp2 != 0.0) {
            n = 1.0 - pow(n, params.exp2);
        }
        if (params.exp1 != 0.0) {
            n = pow(n, params.exp1);
        }

        sum = sum - n * amp;

        // proper 2D rotation around Z:
        let c = cos(angle);
        let s = sin(angle);
        let nx = x * c - y * s;
        let ny = x * s + y * c;
        let nz = z;

        x = nx + params.xShift;
        y = ny + params.yShift;
        z = nz + params.zShift;

        angle = angle + ANGLE_INCREMENT;
    }

    return sum;
}

// ──────────────── Ridged Multifractal Noise 3 ─────────────────
fn generateRidgedMultifractal3(pos : vec3<f32>, params:NoiseParams) -> f32 {
    // zoom + freq
    var x = (pos.x + params.xShift) / params.zoom * params.freq;
    var y = (pos.y + params.yShift) / params.zoom * params.freq;
    var z = (pos.z + params.zShift) / params.zoom * params.freq;
    var sum : f32 = 0.0;
    var amp : f32 = 1.0;

    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {
        var n : f32 = lanczos3D(vec3<f32>(x, y, z));
        n = max(1e-7, n + 1.0);
        n = 2.0 * pow(n * 0.5, params.exp2+1.5) - 1.0;
        n = 1.0 - abs(n);
        if (params.exp1 - 1.0 != 0.0) {
            n = 1.0 - pow(n, params.exp1 - 1.0);
        }

        sum = sum + n * amp;

        x = x * params.lacunarity + params.xShift;
        y = y * params.lacunarity + params.yShift;
        z = z * params.lacunarity + params.zShift;
        amp = amp * params.gain;
    }

    return sum - 1.0;
}

// ──────────────── Ridged Multifractal Noise 4 ─────────────────
fn generateRidgedMultifractal4(pos : vec3<f32>, params:NoiseParams) -> f32 {
    var x = (pos.x + params.xShift) / params.zoom * params.freq;
    var y = (pos.y + params.yShift) / params.zoom * params.freq;
    var z = (pos.z + params.zShift) / params.zoom * params.freq;
    var sum : f32 = 0.0;
    var amp : f32 = 1.0;

    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {
        var n : f32 = abs(lanczos3D(vec3<f32>(x, y, z)));
        if (params.exp2 != 0.0) {
            n = 1.0 - pow(n, params.exp2);
        }
        if (params.exp1 != 0.0) {
            n = pow(n, params.exp1);
        }

        sum = sum + n * amp;

        x = x * params.lacunarity + params.xShift;
        y = y * params.lacunarity + params.yShift;
        z = z * params.lacunarity + params.zShift;
        amp = amp * params.gain;
    }

    return sum - 1.0;
}

// ──────────────── Anti‐Ridged Multifractal Noise ────────────────
fn generateAntiRidgedMultifractal(pos : vec3<f32>, params:NoiseParams) -> f32 {
    var x = (pos.x + params.xShift) / params.zoom * params.freq;
    var y = (pos.y + params.yShift) / params.zoom * params.freq;
    var z = (pos.z + params.zShift) / params.zoom * params.freq;

    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x, y, z)));
    var amp : f32 = 1.0;

    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {
        x = x * params.lacunarity;
        y = y * params.lacunarity;
        z = z * params.lacunarity;
        amp = amp * params.gain;

        var n : f32 = abs(lanczos3D(vec3<f32>(x, y, z)));
        if (params.exp2 != 0.0) {
            n = 1.0 - pow(n, params.exp2);
        }
        if (params.exp1 != 0.0) {
            n = pow(n, params.exp1);
        }

        sum = sum - n * amp;

        x = x + params.xShift;
        y = y + params.yShift;
        z = z + params.zShift;
    }

    return -sum;
}

// ────────────── Anti‐Ridged Multifractal Noise 2 ────────────────
fn generateAntiRidgedMultifractal2(pos : vec3<f32>, params:NoiseParams) -> f32 {
    var x = (pos.x + params.xShift) / params.zoom * params.freq;
    var y = (pos.y + params.yShift) / params.zoom * params.freq;
    var z = (pos.z + params.zShift) / params.zoom * params.freq;

    var sum : f32 = 1.0 - abs(lanczos3D(vec3<f32>(x, y, z)));
    var amp : f32 = 1.0;
    var angle : f32 = params.seedAngle;

    for (var i:u32 = 1u; i < params.octaves; i = i + 1u) {
        x = x * params.lacunarity;
        y = y * params.lacunarity;
        z = z * params.lacunarity;
        amp = amp * params.gain;

        var n : f32 = abs(lanczos3D(vec3<f32>(x, y, z)));
        if (params.exp2 != 0.0) {
            n = 1.0 - pow(n, params.exp2);
        }
        if (params.exp1 != 0.0) {
            n = pow(n, params.exp1);
        }

        sum = sum - n * amp;

        // proper XY rotation
        let c = cos(angle);
        let s = sin(angle);
        let nx = x * c - y * s;
        let ny = x * s + y * c;
        let nz = z;

        x = nx + params.xShift;
        y = ny + params.yShift;
        z = nz + params.zShift;
        angle = angle + ANGLE_INCREMENT;
    }

    return -sum;
}

// ─────────────── Anti‐Ridged Multifractal Noise 3 ───────────────
fn generateAntiRidgedMultifractal3(pos : vec3<f32>, params:NoiseParams) -> f32 {
    var x = (pos.x + params.xShift) / params.zoom * params.freq;
    var y = (pos.y + params.yShift) / params.zoom * params.freq;
    var z = (pos.z + params.zShift) / params.zoom * params.freq;
    var sum : f32 = 0.0;
    var amp : f32 = 1.0;

    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {
        var n : f32 = lanczos3D(vec3<f32>(x, y, z));
        n = max(1e-7, n + 1.0);
        n = 2.0 * pow(n * 0.5, params.exp2+1.5) - 1.0;
        n = 1.0 - abs(n);
        if (params.exp1 - 1.0 != 0.0) {
            n = 1.0 - pow(n, params.exp1 - 1.0);
        }

        sum = sum + n * amp;

        x = x * params.lacunarity + params.xShift;
        y = y * params.lacunarity + params.yShift;
        z = z * params.lacunarity + params.zShift;
        amp = amp * params.gain;
    }

    return -(sum - 1.0);
}

// ─────────────── Anti‐Ridged Multifractal Noise 4 ───────────────
fn generateAntiRidgedMultifractal4(pos : vec3<f32>, params:NoiseParams) -> f32 {
    var x = (pos.x + params.xShift) / params.zoom * params.freq;
    var y = (pos.y + params.yShift) / params.zoom * params.freq;
    var z = (pos.z + params.zShift) / params.zoom * params.freq;
    var sum : f32 = 0.0;
    var amp : f32 = 1.0;

    for (var i:u32 = 0u; i < params.octaves; i = i + 1u) {
        var n : f32 = abs(lanczos3D(vec3<f32>(x, y, z)));
        if (params.exp2 != 0.0) {
            n = 1.0 - pow(n, params.exp2);
        }
        if (params.exp1 != 0.0) {
            n = pow(n, params.exp1);
        }

        sum = sum + n * amp;

        x = x * params.lacunarity + params.xShift;
        y = y * params.lacunarity + params.yShift;
        z = z * params.lacunarity + params.zShift;
        amp = amp * params.gain;
    }

    return -(sum - 1.0);
}

// ───────────────  Fractal Brownian Motion (3D Simplex) ────────────────

// 3-D FBM helper: sums octaves of simplex noise with rotating shifts
fn fbm3D(pos : vec3<f32>, params:NoiseParams) -> f32 {
    // apply zoom
    var x       = (pos.x + params.xShift) / params.zoom;
    var y       = (pos.y + params.yShift) / params.zoom;
    var z       = (pos.z + params.zShift) / params.zoom;
    var sum       : f32 = 0.0;
    var amplitude : f32 = 1.0;
    var maxValue  : f32 = 0.0;
    var freqLoc   : f32 = params.freq;
    // start angle from uniform seedAngle
    var angle     : f32 = params.seedAngle;
    let angleInc  : f32 = 2.0 * PI / f32(params.octaves);

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        // accumulate weighted noise
        sum = sum + amplitude * simplex3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));
        maxValue = maxValue + amplitude;

        // next freq & amp
        freqLoc   = freqLoc * params.lacunarity;
        amplitude = amplitude * params.gain;

        // advance rotation
        angle = angle + angleInc;
        let offX = params.xShift * cos(angle);
        let offY = params.yShift * cos(angle);
        let offZ = params.zShift * cos(angle);

        // apply shift
        x = x + offX;
        y = y + offY;
        z = z + offZ;
    }
    // normalize
    return sum / maxValue;
}

// ──────────────── FBM Generator #1 ────────────────
// two‐stage fbm, then doubled
fn generateFBM(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let fbm1 = fbm3D(pos, params);
    let fbm2 = fbm3D(vec3<f32>(fbm1, fbm1, fbm1), params);
    return 2.0 * fbm2;
}

// ──────────────── FBM Generator #2 ────────────────
// chained fbm with scaling by zoom
fn generateFBM2(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let fbm1 = fbm3D(pos, params);
    let s    = params.zoom;
    let fbm2 = fbm3D(vec3<f32>(fbm1 * s, fbm1 * s, fbm1 * s), params);
    let fbm3 = fbm3D(vec3<f32>(pos.x + fbm2 * s,
                               pos.y + fbm2 * s,
                               pos.z + fbm2 * s), params);
    return 2.0 * fbm3;
}

// ──────────────── FBM Generator #3 ────────────────
// three‐step chaining of fbm with offset
fn generateFBM3(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let fbm1 = fbm3D(pos, params);
    let s    = params.zoom;
    let fbm2 = fbm3D(vec3<f32>(pos.x + fbm1 * s,
                               pos.y + fbm1 * s,
                               pos.z + fbm1 * s), params);
    let fbm3 = fbm3D(vec3<f32>(pos.x + fbm2 * s,
                               pos.y + fbm2 * s,
                               pos.z + fbm2 * s), params);
    return 2.0 * fbm3;
}

/*==============================================================================
  Cellular Brownian-Motion FBM helpers & generators
==============================================================================*/

// 3-D Cellular FBM helper: sums octaves of cellular3D with rotating shifts
fn fbmCellular3D(pos : vec3<f32>, params : NoiseParams) -> f32 {
    var x = (pos.x + params.xShift) / params.zoom;
    var y = (pos.y + params.yShift) / params.zoom;
    var z = (pos.z + params.zShift) / params.zoom;

    var sum     : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = params.freq;

    var angle   : f32 = params.seedAngle;
    let angleInc: f32 = 2.0 * PI / f32(params.octaves);

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        let n = edgeCut(cellular3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)),
                        params.threshold);
        sum = sum + amp * n;

        freqLoc = freqLoc * params.lacunarity;
        amp     = amp     * params.gain;

        angle = angle + angleInc;
        let offX = params.xShift * cos(angle);
        let offY = params.yShift * cos(angle);
        let offZ = params.zShift * cos(angle);

        x = x + offX;
        y = y + offY;
        z = z + offZ;
    }
    return sum;
}

/* ---- Three cellular FBM flavours ---------------------------------------- */
fn generateCellularBM1(pos : vec3<f32>, params : NoiseParams) -> f32 {
    let f1 = fbmCellular3D(pos, params);
    let f2 = fbmCellular3D(vec3<f32>(f1 * params.zoom), params);
    return 1.5 * f2 - 1.0;
}

fn generateCellularBM2(pos : vec3<f32>, params : NoiseParams) -> f32 {
    let f1 = fbmCellular3D(pos, params);
    let f2 = fbmCellular3D(vec3<f32>(f1 * params.zoom), params);
    let f3 = fbmCellular3D(vec3<f32>(pos + f2 * params.zoom), params);
    return 1.5 * f3 - 1.0;
}

fn generateCellularBM3(pos : vec3<f32>, params : NoiseParams) -> f32 {
    let f1 = fbmCellular3D(pos, params);
    let f2 = fbmCellular3D(vec3<f32>(pos + f1 * params.zoom), params);
    let f3 = fbmCellular3D(vec3<f32>(pos + f2 * params.zoom), params);
    return 1.5 * f3 - 1.0;
}

/*==============================================================================
  Voronoi Brownian-Motion FBM helpers & generators
==============================================================================*/

fn fbmVoronoi3D(pos : vec3<f32>, params : NoiseParams) -> f32 {
    var x = (pos.x + params.xShift) / params.zoom;
    var y = (pos.y + params.yShift) / params.zoom;
    var z = (pos.z + params.zShift) / params.zoom;

    var sum     : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = params.freq;

    var angle   : f32 = params.seedAngle;
    let angleInc: f32 = 2.0 * PI / f32(params.octaves);

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        let n = edgeCut(voronoi3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc)),
                        params.threshold);
        sum = sum + amp * n;

        freqLoc = freqLoc * params.lacunarity;
        amp     = amp     * params.gain;

        angle = angle + angleInc;
        let offX = params.xShift * cos(angle);
        let offY = params.yShift * cos(angle);
        let offZ = params.zShift * cos(angle);

        x = x + offX;
        y = y + offY;
        z = z + offZ;
    }
    return sum - 1.0;
}

/* ---- Three Voronoi FBM flavours ---------------------------------------- */
fn generateVoronoiBM1(p : vec3<f32>, par : NoiseParams) -> f32 {
    let f1 = fbmVoronoi3D(p, par);
    return fbmVoronoi3D(vec3<f32>(f1 * par.zoom), par);
}

fn generateVoronoiBM2(p : vec3<f32>, par : NoiseParams) -> f32 {
    let f1 = fbmVoronoi3D(p, par);
    let f2 = fbmVoronoi3D(vec3<f32>(f1 * par.zoom), par);
    return fbmVoronoi3D(vec3<f32>(p + f2 * par.zoom), par);
}

fn generateVoronoiBM3(p : vec3<f32>, par : NoiseParams) -> f32 {
    let f1 = fbmVoronoi3D(p, par);
    let f2 = fbmVoronoi3D(vec3<f32>(p + f1 * par.zoom), par);
    return fbmVoronoi3D(vec3<f32>(p + f2 * par.zoom), par);
}

/*==============================================================================
  Single-stage Cellular & Worley patterns
==============================================================================*/

fn generateCellular(pos : vec3<f32>, params : NoiseParams) -> f32 {
    var x = (pos.x + params.xShift) / params.zoom;
    var y = (pos.y + params.yShift) / params.zoom;
    var z = (pos.z + params.zShift) / params.zoom;

    var sum     : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = params.freq;
    var angle   : f32 = params.seedAngle;

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        var n = cellular3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));
        if (params.turbulence == 1u) { n = abs(n); }
        n = edgeCut(n, params.threshold);              
        sum = sum + n * amp;

        freqLoc = freqLoc * params.lacunarity;
        amp     = amp     * params.gain;

        let c = cos(angle);
        let s = sin(angle);
        let nx = x * c - y * s;
        let ny = x * s + y * c;
        let nz = y * s + z * c;

        x = nx + params.xShift;
        y = ny + params.yShift;
        z = nz + params.zShift;
        angle = angle + ANGLE_INCREMENT;
    }

    if (params.turbulence == 1u) { sum = sum - 1.0; }
    return 2.0 * sum - 1.0;
}

fn generateWorley(pos : vec3<f32>, params : NoiseParams) -> f32 {
    var x = (pos.x + params.xShift) / params.zoom;
    var y = (pos.y + params.yShift) / params.zoom;
    var z = (pos.z + params.zShift) / params.zoom;

    var sum     : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = params.freq;
    var angle   : f32 = params.seedAngle;

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        var n = worley3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));
        if (params.turbulence == 1u) { n = abs(n); }
        n = edgeCut(n, params.threshold);              
        sum = sum + n * amp;

        freqLoc = freqLoc * params.lacunarity;
        amp     = amp     * params.gain;

        let c = cos(angle);
        let s = sin(angle);
        let nx = x * c - y * s;
        let ny = x * s + y * c;
        let nz = y * s + z * c;

        x = nx + params.xShift;
        y = ny + params.yShift;
        z = nz + params.zShift;
        angle = angle + ANGLE_INCREMENT;
    }

    if (params.turbulence == 1u) { sum = sum - 1.0; }
    return sum - 1.0;
}

// ─────────────── Voronoi Tile Noise (Edge-Aware) ────────────────────

// Raw Voronoi‐tile cell value with edge threshold
fn voronoiTileRaw(pos : vec3<f32>, params:NoiseParams) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));
    let fz : i32 = i32(floor(pos.z));

    var minDist    : f32 = 1e9;
    var secondDist : f32 = 1e9;

    // search neighbouring cells
    for (var dz : i32 = -1; dz <= 1; dz = dz + 1) {
        for (var dy : i32 = -1; dy <= 1; dy = dy + 1) {
            for (var dx : i32 = -1; dx <= 1; dx = dx + 1) {
                let xi = fx + dx;
                let yi = fy + dy;
                let zi = fz + dz;

                // random feature point in [0,1]
                let px = f32(xi) + rand3u(xi, yi, zi);
                let py = f32(yi) + rand3u(yi, zi, xi);
                let pz = f32(zi) + rand3u(zi, xi, yi);

                // Euclidean distance
                let dx_ = px - pos.x;
                let dy_ = py - pos.y;
                let dz_ = pz - pos.z;
                let d = sqrt(dx_*dx_ + dy_*dy_ + dz_*dz_);

                // track two smallest distances
                if (d < minDist) {
                    secondDist = minDist;
                    minDist    = d;
                } else if (d < secondDist) {
                    secondDist = d;
                }
            }
        }
    }

    // if the edge is too narrow, zero it out
    let edgeDist      = secondDist - minDist;
    let edgeGradient  = select(1.0, 0.0, edgeDist < params.threshold);
    return edgeDist * edgeGradient;
}

// Generator: sums octaves of Voronoi‐tile noise
fn generateVoronoiTileNoise(pos : vec3<f32>, params:NoiseParams) -> f32 {
    // apply zoom
    var x       = (pos.x + params.xShift) / params.zoom;
    var y       = (pos.y + params.yShift) / params.zoom;
    var z       = (pos.z + params.zShift) / params.zoom;
    var total   : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = params.freq;
    // fixed edge threshold matching JS default
    let threshold : f32 = params.threshold;

    for (var i : u32 = 0u; i < params.octaves; i = i + 1u) {
        // sample and weight
        total = total + voronoiTileRaw(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc), params) * amp;

        // update amplitude & frequency
        amp     = amp     * params.gain;
        freqLoc = freqLoc * params.lacunarity;

        // apply shifts
        x = x + params.xShift;
        y = y + params.yShift;
        z = z + params.zShift;
    }
    // scale to [-1,1]
    return 2.0 * total - 1.0;
}

// ─────────────── Lanczos Billow Noise ─────────────────
fn generateLanczosBillow(pos : vec3<f32>, p : NoiseParams) -> f32 {
    var x       = (pos.x + p.xShift) / p.zoom;
    var y       = (pos.y + p.yShift) / p.zoom;
    var z       = (pos.z + p.zShift) / p.zoom;
    var sum     : f32 = 0.0;
    var maxAmp  : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = p.freq;
    var angle   : f32 = p.seedAngle;

    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {
        let n = lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));
        sum = sum + (2.0 * abs(n) - 1.0) * amp;
        maxAmp = maxAmp + amp;

        freqLoc = freqLoc * p.lacunarity;
        amp     = amp     * p.gain;

        // rotation around Z
        let c = cos(angle);
        let s = sin(angle);
        var newX = x * c - y * s;
        var newY = x * s + y * c;
        var newZ = z;

        // rotate in XZ plane
        let rX = newX * c + newZ * s;
        let rZ = -newX * s + newZ * c;
        newX = rX; newZ = rZ;

        // rotate in YZ plane
        let rY = newY * c - newZ * s;
        let rZ2 = newY * s + newZ * c;
        newY = rY; newZ = rZ2;

        // apply shift
        x = newX + p.xShift;
        y = newY + p.yShift;
        z = newZ + p.zShift;

        angle = angle + ANGLE_INCREMENT;
    }

    return sum / maxAmp;
}

// ─────────────── Lanczos Anti-Billow Noise ─────────────────
fn generateLanczosAntiBillow(pos : vec3<f32>, p : NoiseParams) -> f32 {
    var x       = (pos.x + p.xShift) / p.zoom;
    var y       = (pos.y + p.yShift) / p.zoom;
    var z       = (pos.z + p.zShift) / p.zoom;
    var sum     : f32 = 0.0;
    var maxAmp  : f32 = 0.0;
    var amp     : f32 = 1.0;
    var freqLoc : f32 = p.freq;
    var angle   : f32 = p.seedAngle;

    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {
        let n = lanczos3D(vec3<f32>(x * freqLoc, y * freqLoc, z * freqLoc));
        sum = sum + (2.0 * abs(n) - 1.0) * amp;
        maxAmp = maxAmp + amp;

        freqLoc = freqLoc * p.lacunarity;
        amp     = amp     * p.gain;

        // simple Z‐axis rotation + tilt into Z
        let c = cos(angle);
        let s = sin(angle);
        var newX = x * c - y * s;
        var newY = x * s + y * c;
        var newZ = y * s + z * c;

        x = newX + p.xShift;
        y = newY + p.yShift;
        z = newZ + p.zShift;

        angle = angle + ANGLE_INCREMENT;
    }

    return -sum / maxAmp;
}


// Raw Voronoi circle‐gradient cell value
fn voronoiCircleGradient(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));
    let fz : i32 = i32(floor(pos.z));
    var minDist    : f32 = 1e9;
    var secondDist : f32 = 1e9;
    var centerVal  : f32 = 0.0;

    // search the 3×3×3 neighborhood
    for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {
        for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {
            for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {
                let xi = fx + dx;
                let yi = fy + dy;
                let zi = fz + dz;

                // pseudo‐random feature point within the cell
                let r0 = rand3u(xi, yi, zi);
                let r1 = rand3u(yi, zi, xi);
                let r2 = rand3u(zi, xi, yi);
                let px = f32(xi) + r0;
                let py = f32(yi) + r1;
                let pz = f32(zi) + r2;

                // Euclidean distance
                let dx_ = px - pos.x;
                let dy_ = py - pos.y;
                let dz_ = pz - pos.z;
                let d   = sqrt(dx_*dx_ + dy_*dy_ + dz_*dz_);

                // track the two smallest distances
                if (d < minDist) {
                    secondDist = minDist;
                    minDist    = d;
                    centerVal  = r0;           // store the cell’s “value”
                } else if (d < secondDist) {
                    secondDist = d;
                }
            }
        }
    }

    // build the circle gradient: fall‐off from cell center
    let centerGrad = 1.0 - min(minDist, 1.0);
    // edge mask: if the ridge is too thin, kill it
    let edgeDist   = secondDist - minDist;
    let edgeGrad   = select(1.0, 0.0, edgeDist < params.threshold);

    return centerGrad * edgeGrad;
}

// Octaved generator matching your JS .generateNoise()
fn generateVoronoiCircleNoise(pos: vec3<f32>, params: NoiseParams) -> f32 {
    // zoom in/out
    var x       = (pos.x + params.xShift) / params.zoom;
    var y       = (pos.y + params.yShift) / params.zoom;
    var z       = (pos.z + params.zShift) / params.zoom;
    var total : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = params.freq;

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let samplePos = vec3<f32>(x * freq, y * freq, z * freq);
        total = total + voronoiCircleGradient(samplePos, params) * amp;

        // next octave
        amp  = amp  * params.gain;
        freq = freq * params.lacunarity;
        x    = x + params.xShift;
        y    = y + params.yShift;
        z    = z + params.zShift;
    }

    // match JS: return ∑noise − 1.0
    return total - 1.0;
}


// ───── 1. Voronoi Circle‐Gradient Tile Noise 2 ─────

fn voronoiCircleGradient2Raw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));
    let fz : i32 = i32(floor(pos.z));
    var minDist : f32 = 1e9;
    var minVal  : f32 = 0.0;
    var closest : vec3<f32> = vec3<f32>(0.0);

    for(var dz = -1; dz <= 1; dz = dz + 1) {
        for(var dy = -1; dy <= 1; dy = dy + 1) {
            for(var dx = -1; dx <= 1; dx = dx + 1) {
                let xi = fx + dx;
                let yi = fy + dy;
                let zi = fz + dz;
                let r0 = rand3u(xi, yi, zi);
                let feature = vec3<f32>(f32(xi) + r0,
                                        f32(yi) + rand3u(yi, zi, xi),
                                        f32(zi) + rand3u(zi, xi, yi));
                let d = euclideanDist(feature, pos);
                if(d < minDist) {
                    minDist = d;
                    minVal = rand3u(xi, yi, zi);
                    closest = feature;
                }
            }
        }
    }
    let centerDist = euclideanDist(closest, pos);
    let gradient = sin(centerDist * PI);
    return minVal * gradient;
}

fn generateVoronoiCircle2(pos: vec3<f32>, params: NoiseParams) -> f32 {
    var x = pos.x + params.xShift;
    var y = pos.y + params.yShift;
    var z = pos.z + params.zShift;
    var total : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = params.freq;
    var angle     : f32 = params.seedAngle;
    let angleInc  : f32 = 2.0 * PI / f32(params.octaves);

    for(var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let samplePos = vec3<f32>(x * freq / params.zoom,
                                  y * freq / params.zoom,
                                  z * freq / params.zoom);
        total = total + voronoiCircleGradient2Raw(samplePos, params) * amp;
        amp   = amp * params.gain;
        freq  = freq * params.lacunarity;
        angle = angle + angleInc;
        x = x + params.xShift * cos(angle) + params.xShift;
        y = y + params.yShift * cos(angle) + params.yShift;
        z = z + params.zShift * cos(angle) + params.zShift;
    }
    return total - 1.0;
}

// ───── 2. Voronoi Flat‐Shade Tile Noise ─────

fn voronoiFlatShadeRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));
    let fz : i32 = i32(floor(pos.z));
    var minDist    : f32 = 1e9;
    var secondDist : f32 = 1e9;

    for(var dz = -1; dz <= 1; dz = dz + 1) {
        for(var dy = -1; dy <= 1; dy = dy + 1) {
            for(var dx = -1; dx <= 1; dx = dx + 1) {
                let xi = fx + dx;
                let yi = fy + dy;
                let zi = fz + dz;
                let feature = vec3<f32>(f32(xi) + rand3u(xi, yi, zi),
                                        f32(yi) + rand3u(yi, zi, xi),
                                        f32(zi) + rand3u(zi, xi, yi));
                let d = euclideanDist(feature, pos);
                if(d < minDist) {
                    secondDist = minDist;
                    minDist    = d;
                } else if(d < secondDist) {
                    secondDist = d;
                }
            }
        }
    }
    let edgeDist = secondDist - minDist;
    return select(1.0, 0.0, edgeDist < params.threshold);
}

fn generateVoronoiFlatShade(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    var pos = posIn / params.zoom;
    var total : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = params.freq;
    for(var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        total = total + voronoiFlatShadeRaw(pos * freq, params) * amp;
        amp  = amp * params.gain;
        freq = freq * params.lacunarity;
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);
    }
    return total;
}

// ───── 3. Voronoi Ripple 3D ─────

fn voronoiRipple3DRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));
    let fz : i32 = i32(floor(pos.z));
    var minDist    : f32 = 1e9;
    var secondDist : f32 = 1e9;
    var minVal     : f32 = 0.0;

    for(var dz=-1; dz<=1; dz=dz+1) {
        for(var dy=-1; dy<=1; dy=dy+1) {
            for(var dx=-1; dx<=1; dx=dx+1) {
                let xi = fx+dx;
                let yi = fy+dy;
                let zi = fz+dz;
                let feature = vec3<f32>(f32(xi)+rand3u(xi,yi,zi),
                                        f32(yi)+rand3u(yi,zi,xi),
                                        f32(zi)+rand3u(zi,xi,yi));
                let d = euclideanDist(feature, pos);
                if(d < minDist) {
                    secondDist = minDist;
                    minDist    = d;
                    minVal     = rand3u(xi, yi, zi);
                } else if(d < secondDist) {
                    secondDist = d;
                }
            }
        }
    }
    let edgeDist = secondDist - minDist;
    let ripple   = sin(PI + edgeDist * PI * params.rippleFreq + params.time);
    return minVal * (1.0 + ripple) * 0.5;
}

fn generateVoronoiRipple3D(pos: vec3<f32>, params: NoiseParams) -> f32 {
    var x = pos.x + params.xShift;
    var y = pos.y + params.yShift;
    var z = pos.z + params.zShift;
    var total : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = params.freq;
    for(var i: u32=0u; i<params.octaves; i=i+1u) {
        let sample = vec3<f32>(x * freq / params.zoom,
                               y * freq / params.zoom,
                               z * freq / params.zoom);
        total = total + voronoiRipple3DRaw(sample, params) * amp;
        amp   = amp * params.gain;
        freq  = freq * params.lacunarity;
        let angle = params.seedAngle * 2.0 * PI;
        x = x + params.xShift * cos(angle + f32(i));
        y = y + params.yShift * cos(angle + f32(i));
        z = z + params.zShift * cos(angle + f32(i));
    }
    return 2.0 * total - 1.0;
}


// ───── 4. Voronoi Ripple 3D 2 ─────
fn voronoiRipple3D2Raw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));
    let fz : i32 = i32(floor(pos.z));
    var minDist: f32 = 1e9;
    var secondDist: f32 = 1e9;
    var minVal: f32 = 0.0;

    for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {
        for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {
            for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {
                let xi = fx + dx;
                let yi = fy + dy;
                let zi = fz + dz;
                let feature = vec3<f32>(f32(xi) + rand3u(xi, yi, zi),
                                        f32(yi) + rand3u(yi, zi, xi),
                                        f32(zi) + rand3u(zi, xi, yi));
                let d = euclideanDist(feature, pos);
                if (d < minDist) {
                    secondDist = minDist;
                    minDist = d;
                    minVal = rand3u(xi, yi, zi);
                } else if (d < secondDist) {
                    secondDist = d;
                }
            }
        }
    }
    let edgeDist = secondDist - minDist;
    let ripple = sin(PI + params.zoom * edgeDist * PI * params.rippleFreq + params.time);
    return minVal * (1.0 + ripple) * 0.5;
}

fn generateVoronoiRipple3D2(pos: vec3<f32>, params: NoiseParams) -> f32 {
    var x = pos.x + params.xShift;
    var y = pos.y + params.yShift;
    var z = pos.z + params.zShift;
    var total: f32 = 0.0;
    var amp: f32 = 1.0;
    var freq: f32 = params.freq;

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let sample = vec3<f32>(x * freq / params.zoom,
                               y * freq / params.zoom,
                               z * freq / params.zoom);
        total = total + voronoiRipple3D2Raw(sample, params) * amp;
        amp = amp * params.gain;
        freq = freq * params.lacunarity;
        let angle = params.seedAngle * 2.0 * PI;
        x = x + params.xShift * cos(angle + f32(i));
        y = y + params.yShift * cos(angle + f32(i));
        z = z + params.zShift * cos(angle + f32(i));
    }
    return 2.0 * total - 1.0;
}

// ───── 5. Voronoi Circular Ripple 3D ─────
fn voronoiCircularRippleRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let fx : i32 = i32(floor(pos.x));
    let fy : i32 = i32(floor(pos.y));
    let fz : i32 = i32(floor(pos.z));
    var minDist: f32 = 1e9;
    var minVal: f32 = 0.0;
    for (var dz: i32 = -1; dz <= 1; dz = dz + 1) {
        for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {
            for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {
                let xi = fx + dx;
                let yi = fy + dy;
                let zi = fz + dz;
                let feature = vec3<f32>(f32(xi) + rand3u(xi, yi, zi),
                                        f32(yi) + rand3u(yi, zi, xi),
                                        f32(zi) + rand3u(zi, xi, yi));
                let d = euclideanDist(feature, pos);
                if (d < minDist) {
                    minDist = d;
                    minVal = rand3u(xi, yi, zi);
                }
            }
        }
    }
    let ripple = sin(PI + minDist * PI * params.rippleFreq + params.time);
    return minVal * (1.0 + ripple) * 0.5;
}

fn generateVoronoiCircularRipple(pos: vec3<f32>, params: NoiseParams) -> f32 {
    var x = pos.x + params.xShift;
    var y = pos.y + params.yShift;
    var z = pos.z + params.zShift;
    var total: f32 = 0.0;
    var amp: f32 = 1.0;
    var freq: f32 = params.freq;

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        let sample = vec3<f32>(x * freq / params.zoom,
                               y * freq / params.zoom,
                               z * freq / params.zoom);
        total = total + voronoiCircularRippleRaw(sample, params) * amp;
        amp = amp * params.gain;
        freq = freq * params.lacunarity;
        let angle = params.seedAngle * 2.0 * PI;
        x = x + params.xShift * cos(angle + f32(i));
        y = y + params.yShift * cos(angle + f32(i));
        z = z + params.zShift * cos(angle + f32(i));
    }
    return 2.0 * total - 1.0;
}

// 6a. Fractal Voronoi Ripple 3D
fn generateFVoronoiRipple3D(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    // first FBM pass
    let fbm1 = generateVoronoiRipple3D(posIn, params);

    // prepare second‐pass params: keep everything the same except zoom=1
    var p2 = params;
    p2.zoom = 1.0;

    // second FBM pass, feeding the scalar result back into xyz
    let sample = vec3<f32>(fbm1, fbm1, fbm1);
    let fbm2   = generateVoronoiRipple3D(sample, p2);

    return 2.0 * fbm2;
}

// 6b. Fractal Voronoi Circular Ripple 3D
fn generateFVoronoiCircularRipple(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    // first FBM pass
    let fbm1 = generateVoronoiCircularRipple(posIn, params);

    // second‐pass with zoom=1
    var p2 = params;
    p2.zoom = 1.0;

    let sample = vec3<f32>(fbm1, fbm1, fbm1);
    let fbm2   = generateVoronoiCircularRipple(sample, p2);

    return 2.0 * fbm2;
}

// ——— continuousPermutation ———
fn continuousPermutation(value: f32) -> f32 {
    let iVal    = floor(value);
    let frac    = value - iVal;
    let i0      = i32(iVal);
    let idx1    = u32((i0 % 256 + 256) % 256);
    let idx2    = u32(((i0 + 1) % 256 + 256) % 256);
    let v1      = f32(perm(idx1));
    let v2      = f32(perm(idx2));
    return v1 + frac * (v2 - v1);
}

// ——— calculateRippleEffect ———
fn calculateRippleEffect(pos: vec3<f32>,
                         rippleFreq: f32,
                         neighborhoodSize: i32) -> f32 {
    var sum: f32 = 0.0;
    var count: f32 = 0.0;
    for (var dz = -neighborhoodSize; dz <= neighborhoodSize; dz = dz + 1) {
        for (var dy = -neighborhoodSize; dy <= neighborhoodSize; dy = dy + 1) {
            for (var dx = -neighborhoodSize; dx <= neighborhoodSize; dx = dx + 1) {
                let sample = vec3<f32>(
                    continuousPermutation(pos.x + f32(dx)),
                    continuousPermutation(pos.y + f32(dy)),
                    continuousPermutation(pos.z + f32(dz))
                );
                let d = length(sample - pos);
                sum = sum + sin(d * PI * rippleFreq);
                count = count + 1.0;
            }
        }
    }
    return sum / count;
}

// ——— generateRippleNoise ———
fn generateRippleNoise(pos: vec3<f32>, p: NoiseParams) -> f32 {
    var x = (pos.x + p.xShift) / p.zoom;
    var y = (pos.y + p.yShift) / p.zoom;
    var z = (pos.z + p.zShift) / p.zoom;
    var sum: f32 = 0.0;
    var amp: f32 = 1.0;
    var freq: f32 = p.freq;
    var angle: f32 = p.seedAngle * 2.0 * PI;
    let angleInc = 2.0 * PI / f32(p.octaves);
    let rippleFreqScaled = p.rippleFreq / p.zoom;
    let neigh = i32(p.exp1);

    for (var i: u32 = 0u; i < p.octaves; i = i + 1u) {
        var n = /* your base noise fn */ lanczos3D(vec3<f32>(x * freq, y * freq, z * freq)) * amp;
        if (p.turbulence == 1u) {
            n = abs(n);
        }
        let rip = calculateRippleEffect(vec3<f32>(x * freq, y * freq, z * freq),
                                        rippleFreqScaled,
                                        neigh);
        sum = sum + n * rip;

        freq   = freq * p.lacunarity;
        amp    = amp * p.gain;
        angle  = angle + angleInc;

        // simple phase offset; replace 0.0 with a hash if desired
        let phase: f32 = 0.0;
        x = x + p.xShift * cos(angle + phase);
        y = y + p.yShift * cos(angle + phase);
        z = z + p.zShift * cos(angle + phase);
    }

    if (p.turbulence == 1u) {
        sum = sum - 1.0;
    }
    return f32(p.octaves) * sum;
}

// ——— generateFractalRipples ———
fn generateFractalRipples(posIn: vec3<f32>, p: NoiseParams) -> f32 {
    // first pass at zoom scaled by exp2
    var p1 = p;
    p1.zoom = p.zoom * p.exp2+1.5;
    let fbm1 = generateRippleNoise(posIn, p1);

    // second pass feeding fbm1 back into xyz
    var p2 = p;
    let sample = vec3<f32>(fbm1, fbm1, fbm1);
    let fbm2   = generateRippleNoise(sample, p2);

    return 2.0 * fbm2;
}

// ——— 1. HexWorms Raw ———
fn hexWormsRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let steps       : u32 = 5u;
    let persistence : f32 = 0.5;
    var total       : f32 = 0.0;
    var frequency   : f32 = 1.0;
    var amplitude   : f32 = 1.0;

    for (var i: u32 = 0u; i < steps; i = i + 1u) {
        // base cellular noise for direction
        let angle = generateCellular(pos * frequency, params) * 2.0 * PI;

        // step along the “worm”
        let offset = vec3<f32>(
            cos(angle),
            sin(angle),
            sin(angle)
        ) * 0.5;
        let samplePos = pos + offset;

        // accumulate
        total = total + generateCellular(samplePos, params) * amplitude;

        amplitude = amplitude * persistence;
        frequency = frequency * 2.0;
    }

    // match JS: subtract 1 at the end
    return total - 1.0;
}

// ——— 2. HexWorms Generator ———
fn generateHexWormsNoise(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    var pos   = posIn / params.zoom;
    var sum   : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = params.freq;

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        sum = sum + hexWormsRaw(pos * freq, params) * amp;
        freq = freq * params.lacunarity;
        amp  = amp * params.gain;
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);
    }

    return sum;
}

// ——— 3. PerlinWorms Raw ———
fn perlinWormsRaw(pos: vec3<f32>, params: NoiseParams) -> f32 {
    let steps       : u32 = 5u;
    let persistence : f32 = 0.5;
    var total       : f32 = 0.0;
    var frequency   : f32 = 1.0;
    var amplitude   : f32 = 1.0;

    for (var i: u32 = 0u; i < steps; i = i + 1u) {
        // base Perlin noise for direction
        let angle = generatePerlin(pos * frequency, params) * 2.0 * PI;

        // step along the “worm”
        let offset = vec3<f32>(
            cos(angle),
            sin(angle),
            sin(angle)
        ) * 0.5;
        let samplePos = pos + offset;

        // accumulate
        total = total + generatePerlin(samplePos, params) * amplitude;

        amplitude = amplitude * persistence;
        frequency = frequency * 2.0;
    }

    return total;
}

// ——— PerlinWorms Generator ———
fn generatePerlinWormsNoise(posIn: vec3<f32>, params: NoiseParams) -> f32 {
    var pos   = posIn / params.zoom;
    var sum   : f32 = 0.0;
    var amp   : f32 = 1.0;
    var freq  : f32 = params.freq;

    for (var i: u32 = 0u; i < params.octaves; i = i + 1u) {
        sum = sum + perlinWormsRaw(pos * freq, params) * amp;
        freq = freq * params.lacunarity;
        amp  = amp * params.gain;
        pos  = pos + vec3<f32>(params.xShift, params.yShift, params.zShift);
    }

    return sum;
}

// small helper: derive a few pseudorandom offsets from params.seed (u32)
fn seedOffsets(seed: u32) -> vec3<f32> {
  // produce several pseudo-random floats in [0,1)
  let s = f32(seed);
  let a = fract(sin(s * 12.9898) * 43758.5453);
  let b = fract(sin((s + 17.0) * 78.233) * 23421.631);
  let c = fract(sin((s + 31.0) * 37.719) * 97531.135);
  // shift into a useful range (small offsets)
  return vec3<f32>(a, b, c) * 0.5;
}

// --- helper: map pos -> integer pixel coords (uses frame uniform) ----------
fn posToPixelCoords(p : vec3<f32>) -> vec3<u32> {
  // Convert normalized [0,1] positions to pixel coordinates.
  // If pos is already in pixel-space this still works (it will scale but cast floor keeps integer)
  let fx = p.x * f32(frame.fullWidth);
  let fy = p.y * f32(frame.fullHeight);

  // clamp origin to non-negative and cast safely
  let ox_i : i32 = max(frame.originX, 0);
  let oy_i : i32 = max(frame.originY, 0);

  let pxu : u32 = u32(floor(fx)) + u32(ox_i);
  let pyu : u32 = u32(floor(fy)) + u32(oy_i);

  // layer index: use frame.layerIndex (clamp to >=0)
  let layer_i = max(frame.layerIndex, 0);
  let layer_u : u32 = u32(layer_i);

  return vec3<u32>(pxu & 511u, pyu & 511u, layer_u & 511u);
}

// --- deterministic integer hash that mixes params.seed (uses permTable) ---
fn hashed_with_seed(ix: u32, iy: u32, iz: u32, seed: u32) -> u32 {
  // small integer mix constants (primes) to decorrelate, then perm lookup
  let a = perm((ix + seed * 1664525u) & 511u);
  let b = perm((a + (iy + seed * 22695477u)) & 511u);
  let c = perm((b + (iz + seed * 1103515245u)) & 511u);
  return c & 511u;
}

// map integer hash -> [0,1)
fn hashTo01_seeded(ix: u32, iy: u32, iz: u32, seed: u32) -> f32 {
  return f32(hashed_with_seed(ix, iy, iz, seed)) / 511.0;
}

// map integer hash -> [-1,1)
fn hashToSigned01_seeded(ix: u32, iy: u32, iz: u32, seed: u32) -> f32 {
  return hashTo01_seeded(ix, iy, iz, seed) * 2.0 - 1.0;
}

// value-noise 2D using the seeded integer hash (smooth)
fn valueNoise2D_seeded(p : vec2<f32>, freq: f32, seed: u32, sx: f32, sy: f32) -> f32 {
  let f = max(freq, 1e-6);
  let fx = p.x * f + sx;
  let fy = p.y * f + sy;
  let ix_f = floor(fx);
  let iy_f = floor(fy);
  let tx = fx - ix_f;
  let ty = fy - iy_f;
  let ix = u32(ix_f) & 511u;
  let iy = u32(iy_f) & 511u;

  let h00 = hashToSigned01_seeded(ix,     iy,     0u, seed);
  let h10 = hashToSigned01_seeded(ix + 1u, iy,     0u, seed);
  let h01 = hashToSigned01_seeded(ix,     iy + 1u, 0u, seed);
  let h11 = hashToSigned01_seeded(ix + 1u, iy + 1u, 0u, seed);

  let sx_f = fade(tx);
  let sy_f = fade(ty);
  let a = lerp(h00, h10, sx_f);
  let b = lerp(h01, h11, sx_f);
  return lerp(a, b, sy_f);
}

// integer lattice helper consistent with the perm table
fn posToIntsForHash(p: vec3<f32>, freq: f32, sx: f32, sy: f32, sz: f32) -> vec3<u32> {
  let fx = floor(p.x * freq + sx);
  let fy = floor(p.y * freq + sy);
  let fz = floor(p.z * freq + sz);
  return vec3<u32>(u32(fx) & 511u, u32(fy) & 511u, u32(fz) & 511u);
}


// ---------------------- White Noise (pure per-pixel, seeded, contrast/gain) ----
fn generateWhiteNoise(pos : vec3<f32>, params: NoiseParams) -> f32 {
  // explicit u32 seed field expected in NoiseParams
  let seed : u32 = params.seed;

  // integer pixel coords (x,y,layer)
  let ip = posToPixelCoords(pos);

  // If caller wants blocky subsampling, use integer freq; else keep per-pixel
  let subs = max(u32(max(params.freq, 1.0)), 1u);
  let sx = (ip.x / subs) & 511u;
  let sy = (ip.y / subs) & 511u;
  let sz = ip.z & 511u;

  // deterministic hash -> [0,1)
  var v01 = hashTo01_seeded(sx, sy, sz, seed);

  // apply contrast/brightness around 0.5 using params.gain
  // gain=0 => no change; gain>0 => more contrast; gain<0 => softer
  let contrast = 1.0 + params.gain; // safe default: gain typically in [-0.9 .. +3]
  // apply contrast about mid-gray
  v01 = (v01 - 0.5) * contrast + 0.5;

  // optional global bias (use params.seedAngle or other param if you want), not applied here

  // clamp to full 0..1 range for strong blacks/whites
  return clamp(v01, 0.0, 1.0);
}


// ──────────────────────── Blue Noise Generator (seeded, blobby, 0..1) ──────
fn generateBlueNoise(pos : vec3<f32>, params: NoiseParams) -> f32 {
  let seed : u32 = params.seed;

  // Convert normalized pos -> pixel space (if pos already pixel-space this still works)
  let px = pos.xy * vec2<f32>(f32(frame.fullWidth), f32(frame.fullHeight));

  // Sensible scaling: params.freq now controls amount of detail relative to pixel-size.
  // Make "scale" be number of value-noise cells across the texture: larger => finer detail.
  // Tune multiplier (0.02) to turn the user-facing params.freq into useful detail sizes.
  let pixelBase = max(min(f32(frame.fullWidth), f32(frame.fullHeight)), 1.0);
  let highScale = max(params.freq * 0.02 * pixelBase, 1e-6);  // high-frequency sampling scale
  // lowScale controls blob size; choose small fraction of highScale so low-frequency is much coarser
  let lowScaleFactor = 0.12; // try 0.08..0.25; smaller => bigger blobs
  let lowScale = max(highScale * lowScaleFactor, 1e-6);

  // Optional domain warp (seeded, subtle): scale warp relative to pixelBase so it doesn't dominate
  var wp = px;
  if (params.warpAmp > 0.0) {
    // produce two seeded jitter values in [-1,1]
    let ip0 = posToIntsForHash(pos, params.freq, params.xShift, params.yShift, params.zShift);
    let jx = hashToSigned01_seeded(ip0.x + 5u, ip0.y + 11u, ip0.z + 17u, seed);
    let jy = hashToSigned01_seeded(ip0.x + 19u, ip0.y + 23u, ip0.z + 29u, seed);
    // scale warp to be a small fraction of the pixelBase so it remains subtle
    let warpScale = params.warpAmp * pixelBase * 0.0025; // tweak multiplier if needed
    wp = px + vec2<f32>(jx, jy) * warpScale;
  }

  // Use seeded value-noise at the chosen scales. Pass freq=1.0 because we pre-scaled coords to "cells".
  let high = valueNoise2D_seeded(wp, 1.0, seed, 0.0, 0.0);   // smooth HF band [-1,1]
  let low  = valueNoise2D_seeded(wp, 1.0, seed, 0.0, 0.0);   // we'll sample at a different scale below

  // To sample low at a coarser scale, call with downscaled coords:
  // (avoid modifying the helper; just scale wp down by ratio)
  let lowCoord = wp * (lowScale / highScale);
  let lowSample = valueNoise2D_seeded(lowCoord, 1.0, seed, 0.0, 0.0);

  // subtract low-frequency content and renormalize
  let suppress = max(params.gain, 0.0);
  // after computing `high` and `lowSample` and `suppress`:
    var result = high - lowSample * suppress;

    // amplify difference to increase contrast
    let contrastFactor = 2.0; // try 1.5..3.0
    result = result * contrastFactor;

    // keep dynamic-range stable-ish (optional): you can remove this if you want more extreme values
    result = result * (1.0 / (1.0 + suppress));

    // clamp & map
    let rClamped = clamp(result, -1.0, 1.0);
    return rClamped * 0.5 + 0.5;

}




@compute @workgroup_size(8, 8, 1)
fn computeNormal(@builtin(global_invocation_id) gid: vec3<u32>) {
    // pixel coords
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);

    // clamp at edges to avoid out‐of‐bounds
    let w = i32(frame.fullWidth) - 1;
    let h = i32(frame.fullHeight) - 1;
    let xL = clamp(fx - 1, 0, w);
    let xR = clamp(fx + 1, 0, w);
    let yD = clamp(fy - 1, 0, h);
    let yU = clamp(fy + 1, 0, h);

    // sample height/density from inputTex
    let zL = textureLoad(inputTex, vec2<i32>(xL, fy), frame.layerIndex, 0).x;
    let zR = textureLoad(inputTex, vec2<i32>(xR, fy), frame.layerIndex, 0).x;
    let zD = textureLoad(inputTex, vec2<i32>(fx, yD), frame.layerIndex, 0).x;
    let zU = textureLoad(inputTex, vec2<i32>(fx, yU), frame.layerIndex, 0).x;

    // compute central‐difference gradient
    let dx = (zR - zL) * 0.5;
    let dy = (zU - zD) * 0.5;

    // assemble normal (Z up) and normalize
    let n = normalize(vec3<f32>(dx, dy, 1.0));

    // encode from [-1,1] to [0,1]
    let enc = n * 0.5 + vec3<f32>(0.5);

    // preserve original red channel
    let base = textureLoad(inputTex, vec2<i32>(fx, fy), frame.layerIndex, 0).r;

    // pack: .r = original, .g = enc.y, .b = enc.x, .a = enc.z
    let outCol = vec4<f32>( base, enc.y, enc.x, enc.z );

    textureStore(outputTex, vec2<i32>(fx, fy), frame.layerIndex, outCol);
}

@compute @workgroup_size(8, 8, 1)
fn computeNormal8(@builtin(global_invocation_id) gid: vec3<u32>) {
    // 1) pixel coords
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);

    // 2) clamp at edges
    let w  = i32(frame.fullWidth)  - 1;
    let h  = i32(frame.fullHeight) - 1;
    let xL = clamp(fx - 1, 0, w);
    let xR = clamp(fx + 1, 0, w);
    let yD = clamp(fy - 1, 0, h);
    let yU = clamp(fy + 1, 0, h);

    // 3) sample all eight neighbors
    let zC  = textureLoad(inputTex, vec2<i32>(fx,  fy), frame.layerIndex, 0).x;
    let zL  = textureLoad(inputTex, vec2<i32>(xL, fy), frame.layerIndex, 0).x;
    let zR  = textureLoad(inputTex, vec2<i32>(xR, fy), frame.layerIndex, 0).x;
    let zD  = textureLoad(inputTex, vec2<i32>(fx,  yD), frame.layerIndex, 0).x;
    let zU  = textureLoad(inputTex, vec2<i32>(fx,  yU), frame.layerIndex, 0).x;
    let zUL = textureLoad(inputTex, vec2<i32>(xL, yU), frame.layerIndex, 0).x;
    let zUR = textureLoad(inputTex, vec2<i32>(xR, yU), frame.layerIndex, 0).x;
    let zDL = textureLoad(inputTex, vec2<i32>(xL, yD), frame.layerIndex, 0).x;
    let zDR = textureLoad(inputTex, vec2<i32>(xR, yD), frame.layerIndex, 0).x;

    // 4) approximate derivatives by averaging 3-point differences
    let dx = ((zR  + zUR + zDR)
            - (zL  + zUL + zDL)) / 3.0;
    let dy = ((zU  + zUR + zUL)
            - (zD  + zDR + zDL)) / 3.0;

    // 5) assemble, normalize, encode
    let n   = normalize(vec3<f32>(dx, dy, 1.0));
    let enc = n * 0.5 + vec3<f32>(0.5);

    // 6) pack: .r = original height, .g = enc.y, .b = enc.x, .a = enc.z
    let outCol = vec4<f32>(zC, enc.y, enc.x, enc.z);

    // 7) store
    textureStore(outputTex, vec2<i32>(fx, fy), frame.layerIndex, outCol);
}


@compute @workgroup_size(8, 8, 1)
fn computeSphereNormal(@builtin(global_invocation_id) gid: vec3<u32>) {
    // 1) determine indices in the lat/lon grid
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let w  = i32(frame.fullWidth);
    let h  = i32(frame.fullHeight);

    // wrap longitude, clamp latitude
    let lonL = (fx - 1 + w) % w;
    let lonR = (fx + 1) % w;
    let latD = clamp(fy - 1, 0, h - 1);
    let latU = clamp(fy + 1, 0, h - 1);

    // 2) convert to spherical angles
    let theta = f32(fy) / f32(h - 1) * PI;         // latitude [0..π]
    let phi   = f32(fx) / f32(w - 1) * 2.0 * PI;   // longitude [0..2π]

    // 3) sample heights
    let baseH = textureLoad(inputTex, vec2<i32>(fx, fy), frame.layerIndex, 0).r;
    let hL    = textureLoad(inputTex, vec2<i32>(lonL, fy), frame.layerIndex, 0).r;
    let hR    = textureLoad(inputTex, vec2<i32>(lonR, fy), frame.layerIndex, 0).r;
    let hD    = textureLoad(inputTex, vec2<i32>(fx, latD), frame.layerIndex, 0).r;
    let hU    = textureLoad(inputTex, vec2<i32>(fx, latU), frame.layerIndex, 0).r;

    // 4) compute sphere+height positions
    let r0 = options.baseRadius + baseH * options.heightScale;
    let rL = options.baseRadius + hL    * options.heightScale;
    let rR = options.baseRadius + hR    * options.heightScale;
    let rD = options.baseRadius + hD    * options.heightScale;
    let rU = options.baseRadius + hU    * options.heightScale;

    // central point
    let p0 = vec3<f32>(
        r0 * sin(theta) * cos(phi),
        r0 * sin(theta) * sin(phi),
        r0 * cos(theta)
    );
    // neighbor east
    let pE = vec3<f32>(
        rR * sin(theta) * cos(phi + 1.0/f32(w-1)*2.0*PI),
        rR * sin(theta) * sin(phi + 1.0/f32(w-1)*2.0*PI),
        rR * cos(theta)
    );
    // neighbor north
    let pN = vec3<f32>(
        rU * sin(theta + 1.0/f32(h-1)*PI) * cos(phi),
        rU * sin(theta + 1.0/f32(h-1)*PI) * sin(phi),
        rU * cos(theta + 1.0/f32(h-1)*PI)
    );

    // 5) tangent vectors & normal
    let tE = pE - p0;
    let tN = pN - p0;
    let n  = normalize(cross(tE, tN));

    // 6) encode normal into [0,1]
    let enc = n * 0.5 + vec3<f32>(0.5);

    // 7) preserve original height in R, store normal in G,B,A
    let outCol = vec4<f32>( baseH, enc.x, enc.y, enc.z );
    textureStore(outputTex, vec2<i32>(fx, fy), frame.layerIndex, outCol);
}

// Texture clear to reset channel(s)
@compute @workgroup_size(8, 8, 1)
fn clearTexture(@builtin(global_invocation_id) gid : vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);

    // add it into the selected channel (or all channels) of the output
    writeChannel(fx, fy, 0.0, options.outputChannel, 1);
}

// ————————————————————————————————————————————————————————————————————————
// 0) Perlin
// ————————————————————————————————————————————————————————————————————————
@compute @workgroup_size(8, 8, 1)
fn computePerlin(@builtin(global_invocation_id) gid : vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);

    // fetch the 3D position for this pixel
    let p  = fetchPos(fx, fy);

    // generate one sample of Perlin noise
    let v0 = generatePerlin(p, paramsArray);

    // add it into the selected channel (or all channels) of the output
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}
// ────────────────────────────────────────────────────────────
// 1) Billow
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeBillow(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateBillow(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 2) AntiBillow
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeAntiBillow(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateAntiBillow(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 3) Ridge
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeRidge(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateRidge(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 4) AntiRidge
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidge(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateAntiRidge(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 5) RidgedMultifractal
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeRidgedMultifractal(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateRidgedMultifractal(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 6) RidgedMultifractal2
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeRidgedMultifractal2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateRidgedMultifractal2(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}
// ────────────────────────────────────────────────────────────
// 7) RidgedMultifractal3
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeRidgedMultifractal3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateRidgedMultifractal3(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 8) RidgedMultifractal4
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeRidgedMultifractal4(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateRidgedMultifractal4(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 9) AntiRidgedMultifractal
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidgedMultifractal(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateAntiRidgedMultifractal(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 10) AntiRidgedMultifractal2
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidgedMultifractal2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateAntiRidgedMultifractal2(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 11) AntiRidgedMultifractal3
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidgedMultifractal3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateAntiRidgedMultifractal3(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 12) AntiRidgedMultifractal4
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeAntiRidgedMultifractal4(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateAntiRidgedMultifractal4(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}
// ────────────────────────────────────────────────────────────
// 13) FBM (2·simplex chain)
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeFBM(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateFBM(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 14) FBM2 (chain+zoom FBM)
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeFBM2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateFBM2(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 15) FBM3 (three-stage FBM chain)
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeFBM3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateFBM3(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 16) CellularBM1
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeCellularBM1(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateCellularBM1(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 17) CellularBM2
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeCellularBM2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateCellularBM2(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 18) CellularBM3
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeCellularBM3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateCellularBM3(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 19) VoronoiBM1
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM1(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateVoronoiBM1(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 20) VoronoiBM2
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateVoronoiBM2(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 21) VoronoiBM3
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiBM3(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateVoronoiBM3(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 22) CellularPattern
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeCellular(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateCellular(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 23) WorleyPattern
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeWorley(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateWorley(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 24) VoronoiTileNoise
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiTileNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateVoronoiTileNoise(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 25) LanczosBillow
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeLanczosBillow(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateLanczosBillow(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 26) LanczosAntiBillow
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeLanczosAntiBillow(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateLanczosAntiBillow(p, paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 27) Voronoi Circle-Gradient Noise
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiCircleNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateVoronoiCircleNoise(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 28) Voronoi Circle-Gradient Tile Noise 2
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiCircle2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateVoronoiCircle2(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 29) Voronoi Flat-Shade Tile Noise
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiFlatShade(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateVoronoiFlatShade(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 30) Voronoi Ripple 3D
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiRipple3D(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateVoronoiRipple3D(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 31) Voronoi Ripple 3D 2
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiRipple3D2(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateVoronoiRipple3D2(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 32) Voronoi Circular Ripple 3D
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeVoronoiCircularRipple(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateVoronoiCircularRipple(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 33) Fractal Voronoi Ripple 3D
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeFVoronoiRipple3D(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateFVoronoiRipple3D(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 34) Fractal Voronoi Circular Ripple 3D
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeFVoronoiCircularRipple(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateFVoronoiCircularRipple(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 35) Ripple Noise
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeRippleNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateRippleNoise(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 36) Fractal Ripples
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeFractalRipples(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateFractalRipples(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 37) HexWorms
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeHexWorms(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateHexWormsNoise(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 38) PerlinWorms
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computePerlinWorms(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generatePerlinWormsNoise(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 39) White Noise
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeWhiteNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateWhiteNoise(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// ────────────────────────────────────────────────────────────
// 40) Blue Noise
// ────────────────────────────────────────────────────────────
@compute @workgroup_size(8, 8, 1)
fn computeBlueNoise(@builtin(global_invocation_id) gid: vec3<u32>) {
    let fx = i32(frame.originX) + i32(gid.x);
    let fy = i32(frame.originY) + i32(gid.y);
    let p  = fetchPos(fx, fy);
    let v0 = generateBlueNoise(vec3<f32>(p.xyz), paramsArray);
    writeChannel(fx, fy, v0, options.outputChannel, 0);
}

// 41) Simplex
@compute @workgroup_size(8,8,1)
fn computeSimplex(@builtin(global_invocation_id) gid: vec3<u32>){
    let fx = i32(frame.originX)+i32(gid.x);
    let fy = i32(frame.originY)+i32(gid.y);
    let p  = fetchPos(fx,fy);
    writeChannel(fx,fy,generateSimplex(p,paramsArray),
                 options.outputChannel,0);
}

// 42) Simplex FBM
@compute @workgroup_size(8,8,1)
fn computeSimplexFBM(@builtin(global_invocation_id) gid: vec3<u32>){
    let fx=i32(frame.originX)+i32(gid.x); let fy=i32(frame.originY)+i32(gid.y);
    let p=fetchPos(fx,fy);
    writeChannel(fx,fy,generateSimplexFBM(p,paramsArray),
                 options.outputChannel,0);
}

// 43) Curl-noise (vec3 encoded RGB)
@compute @workgroup_size(8,8,1)
fn computeCurlNoise3D(@builtin(global_invocation_id) gid: vec3<u32>){
    let fx=i32(frame.originX)+i32(gid.x); let fy=i32(frame.originY)+i32(gid.y);
    let p=fetchPos(fx,fy);
    let v=curlNoise3D(p,0.01);             // raw vec3
    // pack xyz→rgb, alpha=1
    textureStore(outputTex,vec2<i32>(fx,fy),frame.layerIndex,
                 vec4<f32>(v.xy,v.z,1.0));
}

// 44) Domain-warp FBM ×1
@compute @workgroup_size(8,8,1)
fn computeDomainWarpFBM1(@builtin(global_invocation_id) gid: vec3<u32>){
    let fx=i32(frame.originX)+i32(gid.x); let fy=i32(frame.originY)+i32(gid.y);
    let p=fetchPos(fx,fy);
    writeChannel(fx,fy,generateDomainWarpFBM1(p,paramsArray),
                 options.outputChannel,0);
}

// 45) Domain-warp FBM ×2
@compute @workgroup_size(8,8,1)
fn computeDomainWarpFBM2(@builtin(global_invocation_id) gid: vec3<u32>){
    let fx=i32(frame.originX)+i32(gid.x); let fy=i32(frame.originY)+i32(gid.y);
    let p=fetchPos(fx,fy);
    writeChannel(fx,fy,generateDomainWarpFBM2(p,paramsArray),
                 options.outputChannel,0);
}

// 46) Gabor anisotropic
@compute @workgroup_size(8,8,1)
fn computeGaborAnisotropic(@builtin(global_invocation_id) gid: vec3<u32>){
    let fx=i32(frame.originX)+i32(gid.x); let fy=i32(frame.originY)+i32(gid.y);
    let p=fetchPos(fx,fy);
    writeChannel(fx,fy,generateGaborAniso(p,paramsArray),
                 options.outputChannel,0);
}

// 47) Terrace
@compute @workgroup_size(8,8,1)
fn computeTerraceNoise(@builtin(global_invocation_id) gid: vec3<u32>){
    let fx=i32(frame.originX)+i32(gid.x); let fy=i32(frame.originY)+i32(gid.y);
    let p=fetchPos(fx,fy);
    writeChannel(fx,fy,generateTerraceNoise(p,paramsArray),
                 options.outputChannel,0);
}

// 48) Foam
@compute @workgroup_size(8,8,1)
fn computeFoamNoise(@builtin(global_invocation_id) gid: vec3<u32>){
    let fx=i32(frame.originX)+i32(gid.x); let fy=i32(frame.originY)+i32(gid.y);
    let p=fetchPos(fx,fy);
    writeChannel(fx,fy,generateFoamNoise(p,paramsArray),
                 options.outputChannel,0);
}

// 49) Turbulence (abs-FBM)
@compute @workgroup_size(8,8,1)
fn computeTurbulence(@builtin(global_invocation_id) gid: vec3<u32>){
    let fx=i32(frame.originX)+i32(gid.x); let fy=i32(frame.originY)+i32(gid.y);
    let p=fetchPos(fx,fy);
    writeChannel(fx,fy,generateTurbulence(p,paramsArray),
                 options.outputChannel,0);
}












// too slow to compile all at once due to branching, had to write new entry point logic
// fn computeMixedNoise(pos : vec3<f32>) -> f32 {
//     var result   : f32 = 0.0;
//     var paramIdx : u32 = 0u;

//     // copy the mask so we can eat bits out of it
//     var bits : u32 = options.mask;

//     // while there's still a set bit, handle just that one
//     loop {
//         // bail as soon as we've consumed all bits
//         if (bits == 0u) {
//             break;
//         }

//         // find the lowest set bit index
//         let i : u32 = firstTrailingBit(bits);

//         // clear that bit so next iteration finds the next one
//         bits = bits & (bits - 1u);

//         // load this algo's params
//         let p = paramsArray[paramIdx];
//         paramIdx = paramIdx + 1u;

//         // dispatch the one selected generator
//         var v : f32 = 0.0;
//         switch(i) {
//             case 0u:  { v = generatePerlin(pos, p); }
//             // case 1u:  { v = generateBillow(pos, p); }
//             // case 2u:  { v = generateAntiBillow(pos, p); }
//             // case 3u:  { v = generateRidge(pos, p); }
//             // case 4u:  { v = generateAntiRidge(pos, p); }
//             // case 5u:  { v = generateRidgedMultifractal(pos, p); }
//             // case 6u:  { v = generateRidgedMultifractal2(pos, p); }
//             // case 7u:  { v = generateRidgedMultifractal3(pos, p); }
//             // case 8u:  { v = generateRidgedMultifractal4(pos, p); }
//             // case 9u:  { v = generateAntiRidgedMultifractal(pos, p); }
//             // case 10u: { v = generateAntiRidgedMultifractal2(pos, p); }
//             // case 11u: { v = generateAntiRidgedMultifractal3(pos, p); }
//             // case 12u: { v = generateAntiRidgedMultifractal4(pos, p); }
//             // case 13u: { v = generateFBM(pos, p); }
//             // case 14u: { v = generateFBM2(pos, p); }
//             // case 15u: { v = generateFBM3(pos, p); }
//             // case 16u: { v = generateCellularBM1(pos, p); }
//             // case 17u: { v = generateCellularBM2(pos, p); }
//             // case 18u: { v = generateCellularBM3(pos, p); }
//             // case 19u: { v = generateVoronoiBM1(pos, p); }
//             // case 20u: { v = generateVoronoiBM2(pos, p); }
//             // case 21u: { v = generateVoronoiBM3(pos, p); }
//             // case 22u: { v = generateCellular(pos, p); }
//             // case 23u: { v = generateWorley(pos, p); }
//             // case 24u: { v = generateVoronoiTileNoise(pos, p); }
//             // case 25u: { v = generateLanczosBillow(pos, p); }
//             // case 26u: { v = generateLanczosAntiBillow(pos, p); }
//             //todo port the rest, also more generic ones like white/blue noise
//             default:  { /* unsupported bit → no contribution */ }
//         }

//         result = result + v;

//         // stop if we've reached the max slots you filled
//         if (paramIdx >= MAX_NOISE_CONFIGS) {
//             break;
//         }
//     }

//     return result;
// }

// ───────────────────────── Compute Entry ─────────────────────────
// @compute @workgroup_size(8, 8, 1)
// fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
//     // 2) compute absolute pixel coords in the full output
//     let fx = i32(frame.originX) + i32(gid.x);
//     let fy = i32(frame.originY) + i32(gid.y);
//     let p = fetchPos(fx, fy);

//     // 4) compute the mixed noise height
//     let h = computeMixedNoise(p);

//     // 5) (optional) finite-difference normal
//     var out: vec4<f32>;
//     if (options.getGradient == 1u) {
//         // let ex = options.epsilon.x;
//         // let ey = options.epsilon.y;
//         // let ez = options.epsilon.z;

//         // let hx = computeMixedNoise(p + vec3<f32>(ex, 0.0, 0.0));
//         // let lx = computeMixedNoise(p - vec3<f32>(ex, 0.0, 0.0));
//         // let hy = computeMixedNoise(p + vec3<f32>(0.0, ey, 0.0));
//         // let ly = computeMixedNoise(p - vec3<f32>(0.0, ey, 0.0));
//         // let hz = computeMixedNoise(p + vec3<f32>(0.0, 0.0, ez));
//         // let lz = computeMixedNoise(p - vec3<f32>(0.0, 0.0, ez));

//         // var dx = (hx - lx) / (2.0 * ex);
//         // var dy = (hy - ly) / (2.0 * ey);
//         // var dz = (hz - lz) / (2.0 * ez);
//         // let invLen = 1.0 / max(1e-6, sqrt(dx*dx + dy*dy + dz*dz));
//         // dx *= invLen; dy *= invLen; dz *= invLen;

//         // out = vec4<f32>(h, dx, dy, dz);
//     } else {
//         out = vec4<f32>(h, h, h, h);
//     }

//   // 6) write into the layer of the 2D-array texture
//   textureStore(
//     outputTex,
//     vec2<i32>(fx, fy),
//     frame.layerIndex,      
//     out
//   );
// }
