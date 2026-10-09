// Small closed polygonal chase aircraft. Rays hit actual triangles at a world
// distance; the primary cloud march ends there and its remaining transmission
// lights the hull. No screen overlay, extra textures or secondary cloud march.
struct AircraftHit { distance:f32, color:vec3<f32> };
fn aircraftTriangle(ro:vec3<f32>,rd:vec3<f32>,a:vec3<f32>,b:vec3<f32>,c:vec3<f32>)->f32 {
  let e1=b-a; let e2=c-a; let p=cross(rd,e2); let det=dot(e1,p);
  if(abs(det)<0.000001){return 1000000.0;}
  let inv=1.0/det; let s=ro-a; let u=dot(s,p)*inv;
  let q=cross(s,e1); let v=dot(rd,q)*inv; let t=dot(e2,q)*inv;
  if(u<0.0||v<0.0||u+v>1.0||t<=0.0){return 1000000.0;}
  return t;
}
fn sceneAircraft(ro:vec3<f32>,rd:vec3<f32>,center:vec3<f32>,right:vec3<f32>,up:vec3<f32>,fwd:vec3<f32>,enabled:f32,bank:f32,pitch:f32,yaw:f32,sun:vec3<f32>)->AircraftHit {
  var result=AircraftHit(1000000.0,vec3<f32>(0.0));
  if(enabled<0.5){return result;}
  let rel=ro-center;
  let cb=cos(bank); let sb=sin(bank); let cp=cos(pitch); let sp=sin(pitch);
  let heading=fwd*cos(yaw)+right*sin(yaw);let side=right*cos(yaw)-fwd*sin(yaw);
  let ry0=up*cp-heading*sp;let rz=heading*cp+up*sp;
  let rx=side*cb+ry0*sb;let ry=ry0*cb-side*sb;
  let localRo=vec3<f32>(dot(rel,rx),dot(rel,ry),dot(rel,rz));
  let localRd=vec3<f32>(dot(rd,rx),dot(rd,ry),dot(rd,rz));
  let closest=localRo+localRd*max(0.0,-dot(localRo,localRd));
  if(dot(closest,closest)>1.55*0.09){return result;}
  let vertices=array<vec3<f32>,24>(
    vec3<f32>(0.0,0.02,1.05), vec3<f32>(-0.14,0.02,-0.65),vec3<f32>(0.14,0.02,-0.65),
    vec3<f32>(0.0,0.20,-0.12),vec3<f32>(0.0,-0.12,-0.35),
    vec3<f32>(-0.94,-0.01,-0.80),vec3<f32>(0.94,-0.01,-0.80),
    vec3<f32>(-0.68,0.02,-0.48),vec3<f32>(0.68,0.02,-0.48),
    vec3<f32>(-0.13,0.14,0.0),vec3<f32>(0.13,0.14,0.0),vec3<f32>(0.0,0.32,-0.63),
    vec3<f32>(-.72,0.0,-.75),vec3<f32>(.72,0.0,-.75),
    vec3<f32>(-.32,.05,-.80),vec3<f32>(-.18,.05,-.80),vec3<f32>(-.32,.05,.12),vec3<f32>(-.18,.05,.12),vec3<f32>(-.25,.22,-.36),
    vec3<f32>(.18,.05,-.80),vec3<f32>(.32,.05,-.80),vec3<f32>(.18,.05,.12),vec3<f32>(.32,.05,.12),vec3<f32>(.25,.22,-.36));
  let triangles=array<vec3<u32>,26>(
    vec3<u32>(0,1,3),vec3<u32>(0,3,2),vec3<u32>(0,4,1),vec3<u32>(0,2,4),
    vec3<u32>(1,2,3),vec3<u32>(1,4,2),vec3<u32>(0,7,1),vec3<u32>(0,2,8),
    vec3<u32>(7,12,1),vec3<u32>(8,2,13),vec3<u32>(7,5,12),vec3<u32>(8,13,6),
    vec3<u32>(0,1,5),vec3<u32>(0,6,2),vec3<u32>(9,3,10),vec3<u32>(1,11,3),vec3<u32>(2,3,11),vec3<u32>(1,2,11),
    vec3<u32>(14,18,15),vec3<u32>(14,16,18),vec3<u32>(15,18,17),vec3<u32>(16,17,18),
    vec3<u32>(19,23,20),vec3<u32>(19,21,23),vec3<u32>(20,23,22),vec3<u32>(21,22,23));
  for(var i=0u;i<26u;i++){
    let ids=triangles[i];let a=vertices[ids.x]*0.3;let b=vertices[ids.y]*0.3;let c=vertices[ids.z]*0.3;
    let t=aircraftTriangle(localRo,localRd,a,b,c);
    if(t<result.distance){
      let n=normalize(cross(b-a,c-a));let normal=rx*n.x+ry*n.y+rz*n.z;
      let facing=select(normal,-normal,dot(normal,-rd)<0.0);
      let light=0.40+0.60*max(dot(facing,sun),0.0);
      var paint=vec3<f32>(0.85,0.91,1.0);
      if(i==10u||i==11u){paint=vec3<f32>(0.95,0.08,0.12);}
      if(i==14u){paint=vec3<f32>(0.06,0.36,0.68);}
      if(i==5u){paint=vec3<f32>(0.08,0.22,0.34);}
      result=AircraftHit(t,paint*light);
      if(i==18u||i==22u){result.color=vec3<f32>(.05,.65,1.10);}
    }
  }
  return result;
}
