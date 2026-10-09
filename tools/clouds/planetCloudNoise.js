// Small, independent setup-only stages. Periodic value FBM has a continuous
// Cartesian domain, signed-safe integer hashing and no longitude seams.
const SOURCE=`
struct Settings { size:vec4<u32>, seed:vec4<u32> };
@group(0) @binding(0) var<uniform> settings:Settings;
@group(0) @binding(1) var shape:texture_storage_3d<rgba16float,write>;
@group(0) @binding(2) var weather:texture_storage_2d_array<rgba16float,write>;
fn hash(p:vec3<i32>,seed:u32)->f32 {
 var h=(bitcast<u32>(p.x)*0x9e3779b9u) ^ (bitcast<u32>(p.y)*0x85ebca6bu) ^ (bitcast<u32>(p.z)*0xc2b2ae35u) ^ seed;
 h=(h^(h>>16u))*0x7feb352du;h=(h^(h>>15u))*0x846ca68bu;h=h^(h>>16u);
 return f32(h>>8u)*(1.0/16777216.0);
}
fn value(p:vec3<f32>,period:i32,seed:u32)->f32 {
 let cell=vec3<i32>(floor(p));let f=fract(p);let t=f*f*f*(f*(f*6.0-15.0)+10.0);var sum=0.0;
 for(var z=0;z<2;z++){for(var y=0;y<2;y++){for(var x=0;x<2;x++){
  let offset=vec3<i32>(x,y,z);let q=((cell+offset)%vec3<i32>(period)+vec3<i32>(period))%vec3<i32>(period);
  let weight=select(vec3<f32>(1.0)-t,t,vec3<bool>(x==1,y==1,z==1));sum+=hash(q,seed)*weight.x*weight.y*weight.z;
 }}}return sum;
}
fn fbm(p:vec3<f32>,frequency:i32,seed:u32)->f32 {
 var sum=0.0;var amp=1.0;var total=0.0;var frequencyNow=frequency;
 for(var o=0u;o<3u;o++){sum+=value(p*f32(frequencyNow),frequencyNow,seed+o*1973u)*amp;total+=amp;amp*=0.45;frequencyNow*=2;}
 return sum/total;
}
// Analytic smooth-noise gradient: the sphere equivalent of curl-FBM's
// rotated gradient, without a flat longitude-domain discontinuity.
fn valueGradient(p:vec3<f32>,seed:u32)->vec3<f32> {
 let cell=vec3<i32>(floor(p));let f=fract(p);
 let t=f*f*f*(f*(f*6.0-15.0)+10.0);let dt=30.0*f*f*(f-1.0)*(f-1.0);
 var gradient=vec3<f32>(0);
 for(var z=0;z<2;z++){for(var y=0;y<2;y++){for(var x=0;x<2;x++){
  let offset=vec3<i32>(x,y,z);let positive=vec3<bool>(x==1,y==1,z==1);
  let w=select(vec3<f32>(1)-t,t,positive);let dw=select(-dt,dt,positive);
  gradient+=hash(cell+offset,seed)*vec3<f32>(dw.x*w.y*w.z,w.x*dw.y*w.z,w.x*w.y*dw.z);
 }}}return gradient;
}
fn sphereCurl(direction:vec3<f32>,seed:u32)->vec3<f32> {
 let gradient=valueGradient(direction*3.1+vec3<f32>(.31,.79,.53),seed)*3.1
  +valueGradient(direction*6.3+vec3<f32>(1.17,.43,.91),seed+1973u)*2.2;
 return cross(direction,gradient);
}
fn gasCurl(direction:vec3<f32>,seed:u32,mode:u32)->vec3<f32> {
 var curl=sphereCurl(direction,seed);
 if(mode==3u){
  // Smaller eddies fold into the broad swirls; only evaluated in the bake.
  curl+=cross(direction,valueGradient(direction*12.7+vec3<f32>(.63,.27,.91),seed+7919u))*.55;
 }
 return curl;
}
fn vortex(direction:vec3<f32>,axis:vec3<f32>,strength:f32)->vec3<f32> {
 let n=normalize(axis);let angle=strength*exp(-max(1.0-dot(direction,n),0.0)*38.0);
 return direction*cos(angle)+cross(n,direction)*sin(angle)+n*dot(n,direction)*(1.0-cos(angle));
}
// Smaller, uneven vortices fill the alien atmosphere, without adding runtime
// simulation or longitude-domain stripes. Jupiter keeps its original eddies.
fn hailMaryVortices(input:vec3<f32>,seed:u32)->vec3<f32> {
 var direction=input;
 for(var i=0u;i<18u;i++){
  let cell=vec3<i32>(i32(i),41,67);
  let axis=normalize(vec3<f32>(hash(cell,seed),hash(cell,seed+173u),hash(cell,seed+347u))*2.0-1.0+vec3<f32>(.001));
  let reach=mix(55.0,140.0,hash(cell,seed+719u));
  let angle=(hash(cell,seed+523u)-.5)*6.0*exp(-max(1.0-dot(direction,axis),0.0)*reach);
  direction=direction*cos(angle)+cross(axis,direction)*sin(angle)+axis*dot(axis,direction)*(1.0-cos(angle));
 }
 return direction;
}
// Elliptical anticyclone in a tangent frame, continuous across longitude/poles.
fn stormFrame(direction:vec3<f32>,axis:vec3<f32>)->vec2<f32> {
 let east=normalize(cross(vec3<f32>(0,1,0),axis));let north=cross(axis,east);
 return vec2<f32>(dot(direction,east),dot(direction,north));
}
fn stormMask(direction:vec3<f32>,axis:vec3<f32>)->f32 {
 let q=stormFrame(direction,axis)/vec2<f32>(.42,.18);
 return exp(-dot(q,q)*2.0)*smoothstep(.70,.90,dot(direction,axis));
}
fn stormWarp(direction:vec3<f32>,axis:vec3<f32>)->vec3<f32> {
 let east=normalize(cross(vec3<f32>(0,1,0),axis));let north=cross(axis,east);
 let q=stormFrame(direction,axis)/vec2<f32>(1.8,1);
 let angle=stormMask(direction,axis)*4.2;
 let spun=vec2<f32>(q.x*cos(angle)-q.y*sin(angle),q.x*sin(angle)+q.y*cos(angle))*vec2<f32>(1.8,1);
 return normalize(axis*dot(direction,axis)+east*spun.x+north*spun.y);
}
@compute @workgroup_size(4,4,4) fn shapeNoise(@builtin(global_invocation_id) id:vec3<u32>) {
 if(any(id>=vec3<u32>(settings.size.x))){return;}
 let p=(vec3<f32>(id)+0.5)/f32(settings.size.x);let seed=settings.seed.x;
 textureStore(shape,vec3<i32>(id),vec4<f32>(fbm(p,4,seed),fbm(p,8,seed+173u),fbm(p,16,seed+347u),fbm(p,2,seed+523u)));
}
@compute @workgroup_size(8,8,1) fn weatherNoise(@builtin(global_invocation_id) id:vec3<u32>) {
 if(any(id.xy>=settings.size.yz)){return;}
 let uv=(vec2<f32>(id.xy)+0.5)/vec2<f32>(settings.size.yz);
 // Same convention as sphereUVFromWorld: atan2(z,x)/(2*pi), no half-turn.
 let longitude=uv.x*6.283185307;let latitude=uv.y*3.141592654;
 let direction=vec3<f32>(sin(latitude)*cos(longitude),cos(latitude),sin(latitude)*sin(longitude));
 let p=direction*0.36+vec3<f32>(0.5);let a=fbm(p,4,settings.seed.x+911u);let b=fbm(p,8,settings.seed.x+1237u);
 let hemisphere=smoothstep(-0.12,0.16,dot(direction,normalize(vec3<f32>(1.0,0.10,0.0)))+(b-0.5)*0.32);
 textureStore(weather,vec2<i32>(id.xy),0,vec4<f32>(a,b,0.0,hemisphere));
}
// Setup-only backtracing. Keep ordinary cloud setup on its small entry point;
// gas turbulence is baked once and simply sampled in the animation loop.
@compute @workgroup_size(8,8,1) fn gasWeatherNoise(@builtin(global_invocation_id) id:vec3<u32>) {
 if(any(id.xy>=settings.size.yz)){return;}
 let uv=(vec2<f32>(id.xy)+.5)/vec2<f32>(settings.size.yz);
 let longitude=uv.x*6.283185307;let latitude=uv.y*3.141592654;
 var direction=vec3<f32>(sin(latitude)*cos(longitude),cos(latitude),sin(latitude)*sin(longitude));
 let originalDirection=direction;
 let seed=settings.seed.x;
 let mode=settings.seed.y;
 // A prominent oval storm and a smaller counter-eddy beneath the fine curls.
 // Seed varies the longitude slightly; these are not per-frame simulations.
 let stormLongitude=1.27+(hash(vec3<i32>(7,11,19),seed)-.5)*.65;
 let stormAxis=normalize(vec3<f32>(cos(stormLongitude),-.25,sin(stormLongitude)));
 if(mode==2u){
  // Neptune is a smooth blue atmosphere, not Jupiter recolored blue. Sparse,
  // slender ice-cloud streaks cross gentle jets around one small dark oval.
  let cloudDirection=normalize(direction+sphereCurl(direction,seed+3191u)*.007);
  let p=cloudDirection*.36+vec3<f32>(.5);
  let broad=fbm(p,4,seed+911u);let fine=fbm(p,64,seed+1237u);
  let banks=fbm(p,8,seed+5711u);
  let laneLatitude=cloudDirection.y+(broad-.5)*.045;
  let ridge=exp(-pow((laneLatitude-.59)/.006,2.0))*.6
   +exp(-pow((laneLatitude-.14)/.004,2.0))*.8+exp(-pow((laneLatitude+.37)/.008,2.0))*.4;
  let local=stormFrame(direction,stormAxis);
  let stormWisps=exp(-pow((local.y-.10-(fine-.5)*.025)/.008,2.0))*exp(-pow(local.x/.32,4.0));
  let streak=clamp((ridge+stormWisps)*smoothstep(.47,.65,banks)*(.55+fine*.45),0.0,1.0);
  let q=local/vec2<f32>(.24,.095);
  let darkSpot=exp(-dot(q,q)*2.0)*smoothstep(.70,.90,dot(direction,stormAxis));
  let pigment=clamp(.52+(broad-.5)*.22+(fine-.5)*.08+sin(direction.y*48.0)*.012,0.0,1.0);
  textureStore(weather,vec2<i32>(id.xy),0,vec4<f32>(broad,streak,darkSpot,pigment));
  return;
 }
 direction=stormWarp(direction,stormAxis);
 for(var i=0u;i<7u;i++){
  let cell=vec3<i32>(i32(i),13,29);
  let axis=normalize(vec3<f32>(hash(cell,seed),hash(cell,seed+173u),hash(cell,seed+347u))*2.0-1.0+vec3<f32>(.001));
  direction=vortex(direction,axis,(hash(cell,seed+523u)-.5)*5.8);
 }
 for(var i=0;i<10;i++){
  // Gentler alien backtracing keeps the fine strands resolvable instead of
  // folding them into sub-texel speckles. Local vortices provide the curls.
  let curlStep=select(.020,.012,mode==3u);
  let midpoint=normalize(direction-gasCurl(direction,seed+3191u,mode)*curlStep*.5);
  direction=normalize(direction-gasCurl(midpoint,seed+3191u,mode)*curlStep);
 }
 if(mode==3u){direction=hailMaryVortices(direction,seed+15401u);}
 let p=direction*.36+vec3<f32>(.5);
 let broad=fbm(p,8,seed+911u);let fine=fbm(p,32,seed+1237u);
 if(mode==3u){
  // Green dominates. Separate low-frequency weather selects scattered rusty
  // regions, rather than coloring an entire hemisphere with a direction dot.
  let regions=fbm(p,4,seed+6029u);
  let rustPatches=smoothstep(.53,.66,regions+(broad-.5)*.18);
  // Long oblique threads transported through all the vortices. Fine FBM
  // modulates them gently instead of breaking the strands into noisy dots.
  // They have no special relationship to the planet's latitude or seam.
  let threadPhase=dot(direction,vec3<f32>(.37,.83,-.41))*98.0+broad*6.0+(fine-.5)*.9;
  let thread=pow(.5+.5*cos(threadPhase),8.0);
  let smaller=pow(.5+.5*cos(threadPhase*1.93+broad*3.0),12.0)*.32;
  let filaments=clamp((thread+smaller)*(.75+fine*.25),0.0,1.0);
  textureStore(weather,vec2<i32>(id.xy),0,vec4<f32>(broad,fine,filaments,1.0-rustPatches));
  return;
 }
 let bandPhase=direction.y*46.0+(broad-.5)*9.0+(fine-.5)*3.0;
 let filaments=.5+.5*sin(bandPhase*3.7+(fine-.5)*14.0);
 // Unequal Jovian belts: two disturbed broad belts, weaker narrow banks,
 // pale equatorial zones and quieter ochre poles. No repeated sine stripes.
 let beltLatitude=originalDirection.y+(direction.y-originalDirection.y)*.16+(broad-.5)*.065;
 let northBelt=exp(-pow((beltLatitude-.27)/(.042+broad*.10),2.0));
 let southBelt=exp(-pow((beltLatitude+.24)/(.045+fine*.08),2.0));
 let smallBanks=exp(-pow((beltLatitude-.54)/.027,2.0))*.25+exp(-pow((beltLatitude+.51)/(.025+broad*.024),2.0))*.34;
 let belts=clamp(northBelt*.85+southBelt+smallBanks,0.0,1.0);
 let poles=smoothstep(.60,.91,abs(originalDirection.y));
 let edgeBreakup=(filaments-.5)*.16*(.18+belts*.82)+(fine-.5)*.09;
 let pigment=clamp(.85-belts*.61-poles*.34+edgeBreakup,0.0,1.0);
 // The turbulent wake is much larger than its colored storm core.
 let stormCore=stormFrame(originalDirection,stormAxis)/vec2<f32>(.24,.11);
 let accent=exp(-dot(stormCore,stormCore)*2.0)*smoothstep(.70,.90,dot(originalDirection,stormAxis))*(.72+fine*.28);
 textureStore(weather,vec2<i32>(id.xy),0,vec4<f32>(broad,fine,accent,pigment));
}`;

export class PlanetCloudNoise {
 constructor(device){this.device=device;this.resources=new Map();this.ready=null;}
 async prepare(){
  if(this.ready)return this.ready;
  this.ready=(async()=>{
   const d=this.device;this.layout=d.createBindGroupLayout({entries:[
    {binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:'uniform'}},
    {binding:1,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:'write-only',format:'rgba16float',viewDimension:'3d'}},
    {binding:2,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:'write-only',format:'rgba16float',viewDimension:'2d-array'}},
   ]});const layout=d.createPipelineLayout({bindGroupLayouts:[this.layout]}),module=d.createShaderModule({code:SOURCE});
   this.pipelineLayout=layout;this.module=module;
   [this.shapePipeline,this.weatherPipeline]=await Promise.all(['shapeNoise','weatherNoise'].map(entryPoint=>d.createComputePipelineAsync({layout,compute:{module,entryPoint}})));
  })().catch(error=>{this.ready=null;throw error;});return this.ready;
 }
 async bake({key,seed=1,shapeSize=128,weatherWidth=1024,weatherHeight=512,gas=false,weatherStyle='legacy'}){
  for(const size of [shapeSize,weatherWidth,weatherHeight])if(!Number.isInteger(size)||size<1)throw new RangeError('Planet noise dimensions must be positive integers');
  const gasMode=weatherStyle==='neptune'?2:weatherStyle==='hail_mary'?3:weatherStyle==='gas_giant'||gas?1:0;
  gas=gasMode>0;
  await this.prepare();this.release(key);const d=this.device,usage=GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING;
  if(gas && !this.gasPipelineReady)this.gasPipelineReady=d.createComputePipelineAsync({layout:this.pipelineLayout,compute:{module:this.module,entryPoint:'gasWeatherNoise'}}).catch(error=>{this.gasPipelineReady=null;throw error;});
  const weatherPipeline=gas?await this.gasPipelineReady:this.weatherPipeline;
  const shape=d.createTexture({dimension:'3d',size:[shapeSize,shapeSize,shapeSize],format:'rgba16float',usage});
  const weather=d.createTexture({size:[weatherWidth,weatherHeight,1],format:'rgba16float',usage});
  const uniform=d.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const shapeView=shape.createView(),weatherView=weather.createView({dimension:'2d-array'});
  const resource={shape,weather,shapeView,weatherView,uniform};this.resources.set(key,resource);
  d.queue.writeBuffer(uniform,0,new Uint32Array([shapeSize,weatherWidth,weatherHeight,0,seed>>>0,gasMode,0,0]));
  const group=d.createBindGroup({layout:this.layout,entries:[{binding:0,resource:{buffer:uniform}},{binding:1,resource:shapeView},{binding:2,resource:weatherView}]});
  const encoder=d.createCommandEncoder();
  for(const [pipeline,groups] of [[this.shapePipeline,[Math.ceil(shapeSize/4),Math.ceil(shapeSize/4),Math.ceil(shapeSize/4)]],[weatherPipeline,[Math.ceil(weatherWidth/8),Math.ceil(weatherHeight/8),1]]]){
   const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(...groups);pass.end();
  }d.queue.submit([encoder.finish()]);return resource;
 }
 release(key){const r=this.resources.get(key);if(r){r.shape.destroy();r.weather.destroy();r.uniform.destroy();this.resources.delete(key);}}
 destroy(){for(const key of this.resources.keys())this.release(key);}
}
