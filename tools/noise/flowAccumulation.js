// Route each height sample to its steepest downhill neighbor. The graph is
// acyclic because every edge drops in elevation, so accumulation is O(n).
export function accumulateDownhill(heights, size) {
  const length = heights.length;
  const receiver = new Int32Array(length).fill(-1);
  const inlets = new Uint8Array(length);
  const area = new Uint32Array(length).fill(1);
  const queue = new Uint32Array(length);

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      let slope = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const next = i + dy * size + dx;
          const drop = (heights[i] - heights[next]) * (dx && dy ? Math.SQRT1_2 : 1);
          if (drop <= slope) continue;
          slope = drop;
          receiver[i] = next;
        }
      }
      if (receiver[i] >= 0) inlets[receiver[i]]++;
    }
  }
  let end = 0;
  for (let i = 0; i < length; i++) if (!inlets[i]) queue[end++] = i;
  for (let head = 0; head < end; head++) {
    const i = queue[head], next = receiver[i];
    if (next < 0) continue;
    area[next] += area[i];
    if (!--inlets[next]) queue[end++] = next;
  }
  return area;
}

const fromHalf = (value) => {
  const exponent = (value >> 10) & 31;
  const fraction = (value & 1023) / 1024;
  if (exponent === 31) return NaN;
  return (value & 32768 ? -1 : 1) *
    (exponent ? (1 + fraction) * 2 ** (exponent - 15) : fraction * 2 ** -14);
};

// Use the GPU heights before the stage preview converts them to 8-bit color.
export async function readDrainageHeights(builder, size) {
  const { device } = builder;
  const { texture } = builder.getCurrentTextureResource();
  const bytesPerRow = Math.ceil((size * 8) / 256) * 256;
  const buffer = device.createBuffer({
    size: bytesPerRow * size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  try {
    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow }, [size, size, 1]);
    device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);
    const samples = new Uint16Array(buffer.getMappedRange());
    const grid = Math.min(size, 512);
    const stride = size / grid;
    const values = new Float32Array(grid * grid);
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const col = Math.floor((x + 0.5) * stride);
        const row = Math.floor((y + 0.5) * stride);
        const height = fromHalf(samples[row * (bytesPerRow / 2) + 4 * col]);
        if (!Number.isFinite(height)) throw new Error("Erosion produced a nonfinite height.");
        values[y * grid + x] = height;
      }
    }
    return { grid, values };
  } finally {
    buffer.destroy();
  }
}
