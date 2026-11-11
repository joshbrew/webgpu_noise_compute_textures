// Shared cloud coordinates for raymarch, mesh extraction and mesh color.
// Two smooth spherical twists carry the baked curls through one another.
// No noise evaluation, simulation grid, texture rebake or additional reads.
fn gasZonalAngle(latitude:f32,wind:f32)->f32 {
 return wind+sin(wind*.7)*sin(latitude*14.0)*.12;
}
fn gasFlowTwist(d:vec3<f32>,axis:vec3<f32>,angle:f32)->vec3<f32> {
 // Small bounded angles permit a second-order rotation, avoiding
 // another sin/cos pair per twist. Normalize to keep the domain on the shell.
 return normalize(d+cross(axis,d)*angle+(axis*dot(axis,d)-d)*(angle*angle*.5));
}
fn planetWarpDirection(direction:vec3<f32>,wind:f32,form:f32,amount:f32,phase:f32)->vec3<f32> {
 let ordinary=form>=.5 && form<4.5;
 // Puffy/realistic clouds use gentle eddies without the gas giants' jet belts.
 let angle=select(wind+(gasZonalAngle(direction.y,phase)-phase)*amount,wind,ordinary);
 var d=vec3<f32>(direction.x*cos(angle)-direction.z*sin(angle),direction.y,direction.x*sin(angle)+direction.z*cos(angle));
 if(amount<=0.0 || phase==0.0){return d;}
 // Neptune retains its quiet zonal streaks. Hail Mary gets stronger eddies;
 // Jupiter's smaller cross-jet displacement preserves its broad belts.
 if(ordinary || form>=6.5 || (form>=4.5 && form<5.5)){
  let strength=select(select(.55,1.0,form>=6.5),.38,ordinary)*amount;
  let a=vec3<f32>(.31045048,.91132238,.27039235);
  let b=vec3<f32>(-.73157458,.28060395,.62133731);
  let phaseA=dot(d,a)*11.0;
  d=gasFlowTwist(d,a,(sin(phaseA+phase*10.0)-sin(phaseA))*.065*strength);
  let phaseB=dot(d,b)*17.0;
  return gasFlowTwist(d,b,(sin(phaseB-phase*7.7)-sin(phaseB))*.040*strength);
 }
 return d;
}

// Ordinary clouds carry their 3D billows and fine erosion with the same flow
// as coverage. Preserve radius and the existing custom/gas shape rotation.
fn planetWarpPosition(p:vec3<f32>,wind:f32,form:f32,amount:f32,phase:f32)->vec3<f32> {
 if(form>=.5 && form<4.5){
  let radius=max(length(p),.000001);
  return planetWarpDirection(p/radius,wind,form,amount,phase)*radius;
 }
 return vec3<f32>(p.x*cos(wind)-p.z*sin(wind),p.y,p.x*sin(wind)+p.z*cos(wind));
}

// Default wrappers preserve external callers and the GPU benchmark baseline.
fn gasWeatherDirection(d:vec3<f32>,wind:f32,form:f32)->vec3<f32> {
 return planetWarpDirection(d,wind,form,1.0,wind);
}
fn planetCloudFlowPosition(p:vec3<f32>,wind:f32,form:f32)->vec3<f32> {
 return planetWarpPosition(p,wind,form,1.0,wind);
}
