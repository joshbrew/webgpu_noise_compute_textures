// Closed summit bowls have irregular rims. The same profile can describe
// a low breached shield or a steep cinder cone with a narrow summit vent.
fn volcanic_vent(p:vec2<f32>,shape:vec3<f32>,rimNoise:f32)->f32{
  // The vent is offset from the foot of the cone. In its seeded local
  // orientation, unequal lobes form a broken lip and slump on one flank.
  let drift=vec2<f32>(.13*(shape.z-.5),.09*(shape.y-.5));
  let q=p-drift*(1.0-smoothstep(.22,1.0,length(p)));
  let warped=vec2<f32>(q.x+.24*(shape.z-.5)*q.y,q.y*mix(.68,1.48,shape.y));
  let r=length(warped);
  let heading=warped/max(r,.08);
  let crown=heading.x*(heading.x*heading.x-3.0*heading.y*heading.y);
  let shoulder=2.0*heading.x*heading.y;
  let lip=mix(.35,.25,shape.x)*(1.0+mix(.08,.19,shape.y)*crown+
    mix(-.12,.15,shape.z)*shoulder);
  let d=r+1.34*rimNoise*smoothstep(.08,.30,r)*(1.0-smoothstep(.65,1.25,r));
  let flank=smoothstep(0.0,.09,d-lip)*clamp((d-lip)/(1.36-lip),0.0,1.0);
  let cone=pow(1.0-flank,mix(2.6,1.25,shape.x)+.31*heading.y);
  let bowl=1.0-smoothstep(lip*.26,lip*1.04,d);
  let rim=smoothstep(lip*.69,lip,d)*(1.0-smoothstep(lip*1.05,lip*1.52,d));
  let breach=smoothstep(.42,.91,shape.z)*smoothstep(.045,.34,q.y)*
    (1.0-smoothstep(.06,.36,abs(q.x+.34*q.y)));
  let edge=1.0-smoothstep(1.05,1.45,length(p));
  return edge*(mix(.27,.99,shape.x)*cone-mix(.28,.63,shape.y)*bowl+
    (.12+.045*shoulder)*rim-(.12+.38*rim)*cone*breach);
}

fn volcanic_caldera(p:vec2<f32>,shape:vec3<f32>,rimNoise:f32)->f32{
  let r=length(p*vec2<f32>(1.0,mix(.83,1.23,shape.x)));
  let d=r+rimNoise*smoothstep(.22,.66,r);
  let floor=1.0-smoothstep(.29,.88,d);
  let rim=smoothstep(.68,.96,d)*(1.0-smoothstep(1.0,1.42,d));
  let breach=smoothstep(.60,.92,shape.z)*smoothstep(.28,.78,p.y)*
    (1.0-smoothstep(.14,.46,abs(p.x+.24*p.y)));
  let apron=1.0-smoothstep(.54,1.45,d);
  return .13*apron+mix(.25,.48,shape.x)*rim*(1.0-.68*breach)-mix(.35,.74,shape.y)*floor;
}

fn lava_tube_collapse(p:vec2<f32>,radius:f32,reach:f32,seed:u32,texel:f32)->f32{
  let start=.72*radius;
  if(p.x<start||p.x>=reach||abs(p.y)>.033||texel>=.024){return 0.0;}
  let step=mix(.034,.055,canyon_bed_random(4,seed));
  let along=(p.x-start)/step;
  let segment=i32(floor(along));
  let profile=canyon_bed_random(segment,seed+1723u);
  if(profile<.23){return 0.0;}
  let offset=mix(.39,.61,canyon_bed_random(segment,seed+6857u));
  let width=mix(.008,.016,canyon_bed_random(segment,seed+2671u));
  let taper=smoothstep(start,start+step*.65,p.x)*(1.0-smoothstep(reach-step*.56,reach,p.x));
  let bend=sin(along*1.58+6.2831853*canyon_bed_random(7,seed));
  let cross=abs(p.y-width*(.72*bend+.29*sin(along*3.39+.6*bend)));
  let lengthwise=abs(fract(along)-offset)/mix(.18,.34,profile);
  let d=length(vec2<f32>(lengthwise,cross/width));
  let wall=1.0-smoothstep(.31,1.0,d);
  let resolution=1.0-smoothstep(width*.78,width*1.44,texel);
  return -mix(.055,.205,profile)*wall*taper*resolution;
}
