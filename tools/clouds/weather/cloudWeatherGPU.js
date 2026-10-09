import blendWGSL from "../shaders/cloudWeatherBlend.wgsl";

// One lazily allocated 256² blend target. The six baked maps live in the noise
// builder's existing bounded named slots; shape/detail are never baked per tick.
export class CloudWeatherGPU {
  constructor(device) { this.device=device; this.size=256; this.groups=[]; this.signature=''; }
  async prepare(views, signature) {
    if(this.signature===signature && this.groups.length) return false;
    this.pipeline ||= await this.device.createComputePipelineAsync({label:'weather-map-blend',layout:'auto',compute:{module:this.device.createShaderModule({code:blendWGSL}),entryPoint:'blendWeather'}});
    this.texture ||= this.device.createTexture({label:'weather-cycle-blend',size:[this.size,this.size,1],format:'rgba16float',usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});
    this.view ||= this.texture.createView({dimension:'2d-array'});
    this.uniform ||= this.device.createBuffer({label:'weather-cycle-blend-weight',size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    const out=this.texture.createView({dimension:'2d'});
    this.groups=views.map((view,i)=>this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[
      {binding:0,resource:view},{binding:1,resource:views[(i+1)%views.length]},
      {binding:2,resource:out},{binding:3,resource:{buffer:this.uniform}},
    ]}));
    this.signature=signature; this.lastTick=-1;
    return true;
  }
  blend(state, seconds) {
    // Weather changes over minutes, not milliseconds. 10 Hz map blending is
    // ample; geometry/wind and smoothly interpolated TOD still update per frame.
    const tick=Math.floor(seconds*10);
    if(tick===this.lastTick) return false;
    this.lastTick=tick;
    this.device.queue.writeBuffer(this.uniform,0,new Float32Array([state.mapBlend ?? state.blend]));
    const encoder=this.device.createCommandEncoder({label:'weather-cycle-map-blend'}), pass=encoder.beginComputePass();
    pass.setPipeline(this.pipeline); pass.setBindGroup(0,this.groups[state.mapIndex ?? state.index]); pass.dispatchWorkgroups(32,32); pass.end();
    this.device.queue.submit([encoder.finish()]);
    return true;
  }
}
