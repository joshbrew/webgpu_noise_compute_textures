// Static filterable planet-noise mip chains; refreshed after a noise bake,
// never from the camera/animation loop.
const SOURCE = `
@group(0) @binding(0) var src:texture_3d<f32>;
@group(0) @binding(1) var dst:texture_storage_3d<rgba16float,write>;
@compute @workgroup_size(4,4,4) fn copyVolume(@builtin(global_invocation_id) id:vec3<u32>) {
 if(any(id>=textureDimensions(dst))){return;}
 textureStore(dst,vec3<i32>(id),textureLoad(src,vec3<i32>(id),0));
}
@compute @workgroup_size(4,4,4) fn filterVolume(@builtin(global_invocation_id) id:vec3<u32>) {
 if(any(id>=textureDimensions(dst))){return;}
 let dims=textureDimensions(src);var value=vec4<f32>(0.0);
 if(all(dims==textureDimensions(dst)*2u)) {
  for(var z=0;z<2;z++){for(var y=0;y<2;y++){for(var x=0;x<2;x++){
   value+=textureLoad(src,vec3<i32>(id)*2+vec3<i32>(x,y,z),0);
  }}}
  value*=0.125;
 } else {
  // Odd sizes include their last texel rather than cropping the periodic field.
  let span=vec3<f32>(dims)/vec3<f32>(textureDimensions(dst));
  let lo=vec3<f32>(id)*span;let hi=lo+span;
  let first=vec3<i32>(floor(lo));let end=vec3<i32>(ceil(hi));
  for(var z=first.z;z<end.z;z++){for(var y=first.y;y<end.y;y++){for(var x=first.x;x<end.x;x++){
   let p=vec3<i32>(x,y,z);let pf=vec3<f32>(p);
   let weight=max(min(pf+1.0,hi)-max(pf,lo),vec3<f32>(0.0));
   value+=textureLoad(src,min(p,vec3<i32>(dims)-1),0)*weight.x*weight.y*weight.z;
  }}}
  value/=span.x*span.y*span.z;
 }
 textureStore(dst,vec3<i32>(id),value);
}`;
export class CloudVolumeMips {
  constructor(device) {
    this.device = device;
    this.resources = new Map();
    this.ready = null;
  }

  async prepare() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      const device = this.device;
      this.layout = device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: 'unfilterable-float', viewDimension: '3d' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE,
          storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '3d' } },
      ] });
      const layout = device.createPipelineLayout({ bindGroupLayouts: [this.layout] });
      const module = device.createShaderModule({ code: SOURCE });
      [this.copy, this.filter] = await Promise.all(
        ['copyVolume', 'filterVolume'].map(entryPoint => device.createComputePipelineAsync({
          layout, compute: { module, entryPoint },
        })),
      );
    })().catch(error => {
      this.ready = null;
      throw error;
    });
    return this.ready;
  }

  async bake(view, size, key) {
    if (!Number.isInteger(size) || size < 1) throw new RangeError('Volume size must be a positive integer');
    await this.prepare();
    const device = this.device;
    const levels = 1 + Math.floor(Math.log2(size));
    let resource = this.resources.get(key);
    if (resource?.size !== size) {
      resource?.texture.destroy();
      const texture = device.createTexture({
        label: `planet-noise-mips-${key}`,
        dimension: '3d', size: [size, size, size], mipLevelCount: levels,
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      });
      resource = { texture, size, view: texture.createView() };
      this.resources.set(key, resource);
    }
    const encoder = device.createCommandEncoder({ label: 'planet-noise-mip-bake' });
    for (let mip = 0; mip < levels; mip++) {
      const src = mip ? resource.texture.createView({ baseMipLevel: mip - 1, mipLevelCount: 1 }) : view;
      const dst = resource.texture.createView({ baseMipLevel: mip, mipLevelCount: 1 });
      const group = device.createBindGroup({ layout: this.layout, entries: [
        { binding: 0, resource: src }, { binding: 1, resource: dst },
      ] });
      const pass = encoder.beginComputePass();
      pass.setPipeline(mip ? this.filter : this.copy);
      pass.setBindGroup(0, group);
      const groups = Math.ceil(Math.max(1, size >> mip) / 4);
      pass.dispatchWorkgroups(groups, groups, groups);
      pass.end();
    }
    device.queue.submit([encoder.finish()]);
    return resource.view;
  }

  release(key) {
    this.resources.get(key)?.texture.destroy();
    this.resources.delete(key);
  }

  destroy() {
    for (const key of this.resources.keys()) this.release(key);
  }
}
