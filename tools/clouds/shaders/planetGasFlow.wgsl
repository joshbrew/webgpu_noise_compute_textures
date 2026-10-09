// Shared weather coordinates for raymarch, mesh extraction and mesh color.
// Two smooth spherical twists carry the baked curls through one another.
// No noise evaluation, simulation grid, texture rebake or additional reads.
fn gasZonalAngle(latitude:f32,wind:f32)->f32 {
 return wind+sin(wind*.7)*sin(latitude*14.0)*.12;
}
fn gasFlowTwist(d:vec3<f32>,axis:vec3<f32>,angle:f32)->vec3<f32> {
 // Bounded angles (< .13 radians) permit a second-order rotation, avoiding
 // another sin/cos pair per twist. Normalize to keep the domain on the shell.
 return normalize(d+cross(axis,d)*angle+(axis*dot(axis,d)-d)*(angle*angle*.5));
}
fn gasWeatherDirection(direction:vec3<f32>,wind:f32,form:f32)->vec3<f32> {
 let angle=gasZonalAngle(direction.y,wind);
 var d=vec3<f32>(direction.x*cos(angle)-direction.z*sin(angle),direction.y,direction.x*sin(angle)+direction.z*cos(angle));
 // Neptune retains its quiet zonal streaks. Hail Mary gets stronger eddies;
 // Jupiter's smaller cross-jet displacement preserves its broad belts.
 if(form>=6.5 || (form>=4.5 && form<5.5)){
  let strength=select(.55,1.0,form>=6.5);
  let a=vec3<f32>(.31045048,.91132238,.27039235);
  let b=vec3<f32>(-.73157458,.28060395,.62133731);
  let phaseA=dot(d,a)*11.0;
  d=gasFlowTwist(d,a,(sin(phaseA+wind*10.0)-sin(phaseA))*.065*strength);
  let phaseB=dot(d,b)*17.0;
  return gasFlowTwist(d,b,(sin(phaseB-wind*7.7)-sin(phaseB))*.040*strength);
 }
 return d;
}
