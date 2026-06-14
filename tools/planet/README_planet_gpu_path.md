# GPU planet mesh path

The GPU planet path mirrors the old worker workflow while using `noiseCompute.wgsl` for height generation:

1. Build a spherical custom-position texture from `lat/lon` samples.
2. Apply the old worker-style tectonic sine/cosine offsets to the noise sample coordinates.
3. Clear the output texture.
4. Accumulate each configured noise layer in ordered compute passes.
5. Run `computeSphereNormal` to pack height and normal data.
6. Read back the compact height/normal texture.
7. Canonicalize duplicate seam and pole samples.
8. Build Babylon mesh buffers with vertex colors, UVs, normals, and partition-safe indices.

The default partition cap is now `8_000_000` vertices, not `8_000_000` position floats. This keeps a 2000 segment planet in one Babylon mesh and avoids a visible draw-call seam. Larger planets still partition, and internal partition edges get hidden with inward skirts.

The test entrypoint is side-effect based:

```js
import './tools/noise/noisePlanetTest.js';
```

## Atmosphere module

Atmospheric scattering is planet-local now:

```ts
import { AtmosphericScatteringPostProcess } from './atmosphericScattering';
```

Shader path:

```txt
tools/planet/glsl/atmosphericScattering.glsl
```

The credit from the original source is preserved in the shader and wrapper.
