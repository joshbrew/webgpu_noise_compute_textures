struct CanyonBed {
  displacement:f32,
  phase:f32,
  cement:f32,
  iron:f32,
  thickness:f32,
  lowerShelf:f32,
}

fn canyon_bed_random(layer:i32,seed:u32)->f32{
  var h=bitcast<u32>(layer)*0x9e3779b9u+seed;
  h=(h^(h>>16u))*0x7feb352du;
  h=(h^(h>>15u))*0x846ca68bu;
  return f32((h^(h>>16u))>>8u)/16777216.0;
}

fn canyon_contact(layer:i32,seed:u32)->f32{
  // Every contact stays inside its interval, so even the thinnest beds
  // stay in order as a formation dips and changes thickness.
  return f32(layer)+mix(.10,.76,canyon_bed_random(layer,seed));
}

fn canyon_bed(dir:vec3<f32>,height:f32,seed:u32)->CanyonBed{
  let salt=6.2831853*canyon_bed_random(11,seed);
  let orientation=seed^(seed>>13u);
  let strike=select(dir,dir.yzx,(orientation&1u)!=0u);
  let p=select(strike,strike.zxy,(orientation&2u)!=0u)*
    vec3<f32>(select(1.0,-1.0,(orientation&4u)!=0u),1.0,select(1.0,-1.0,(orientation&8u)!=0u));
  let fold=sin(dot(p,vec3<f32>(6.4,-8.9,4.8))+salt);
  let bend=sin(dot(p,vec3<f32>(-13.0,3.8,11.0))+.63*fold+salt);
  let province=smoothstep(-.8,.8,fold+.38*bend);
  let datum=dot(p,vec3<f32>(.33,-.27,.16))+.103*fold+.036*bend;
  let spacing=mix(.155,.395,province);
  let column=(height-datum)/spacing;
  var layer=i32(floor(column));
  if(column<canyon_contact(layer,seed)){layer-=1;}
  let bottom=canyon_contact(layer,seed);
  let top=canyon_contact(layer+1,seed);
  let phase=clamp((column-bottom)/(top-bottom),0.0,1.0);
  let cement=canyon_bed_random(layer,seed+3931u);
  let resistance=smoothstep(.16,.84,cement);
  let center=mix(.34,.67,canyon_bed_random(layer,seed+7207u));
  let transition=mix(.30,.075,resistance);
  let ramp=smoothstep(center-transition,center+transition,phase);
  // Where a bed is strongly cemented, a thinner ledge can split away from
  // the main face. It pinches back into the formation across the fold.
  let split=smoothstep(-.40,.61,bend-.31*fold)*smoothstep(.40,.85,cement);
  let lower=center-mix(.12,.21,province);
  let lowerRamp=smoothstep(lower-.053,lower+.072,phase);
  let profile=mix(ramp,lowerRamp,.44*split);
  let shelf=split*smoothstep(lower-.11,lower-.025,phase)*
    (1.0-smoothstep(lower+.048,lower+.126,phase));
  let thickness=(top-bottom)*spacing;
  let displacement=(profile-phase)*thickness*mix(.21,.98,resistance)*mix(.72,1.0,province);
  let iron=canyon_bed_random(layer,seed+19687u);
  let below=canyon_bed_random(layer-1,seed+19687u);
  let above=canyon_bed_random(layer+1,seed+19687u);
  let stain=iron+.5*(below-iron)*(1.0-smoothstep(0.0,.19,phase))+
    .5*(above-iron)*smoothstep(.81,1.0,phase);
  return CanyonBed(displacement,phase,cement,stain,thickness,shelf);
}

fn canyon_gully_wear(slope:vec2<f32>,bend:vec2<f32>,grade:f32,cut:f32)->f32{
  // Estimate the hollow across the fall line. Bends down the slope alone
  // often mark intact rock steps and should keep their profile.
  let crossSlope=slope.yx*slope.yx;
  let hollow=dot(bend,crossSlope)/max(dot(slope,slope),.001);
  return smoothstep(.016,.12,hollow)*smoothstep(.019,.155,cut)*smoothstep(.09,.38,grade);
}

struct BasaltFlow {
  displacement:f32,
  cap:f32,
  ash:f32,
  thickness:f32,
}

// Lava flows pond and thicken unevenly. Thin ash beds weather back between
// the hardened flows, especially where runoff already incises the slope.
fn basalt_flow(dir:vec3<f32>,height:f32,seed:u32)->BasaltFlow{
  let salt=6.2831853*canyon_bed_random(29,seed);
  let bend=sin(dot(dir,vec3<f32>(8.5,-5.2,11.3))+salt);
  let pond=sin(dot(dir,vec3<f32>(-5.8,11.3,4.6))+.83*bend-salt);
  let bedding=dot(dir,vec3<f32>(.19,.31,-.24))+.088*bend+.032*pond;
  let spacing=mix(.115,.315,smoothstep(-.94,.94,.56*bend+.68*pond));
  let units=(height-bedding)/spacing;
  let contacts=seed+5573u;
  var layer=i32(floor(units));
  if(units<canyon_contact(layer,contacts)){layer-=1;}
  let base=canyon_contact(layer,contacts);
  let top=canyon_contact(layer+1,contacts);
  let phase=clamp((units-base)/(top-base),0.0,1.0);
  let solid=smoothstep(.12,.86,canyon_bed_random(layer,seed+5399u)+.14*pond);
  let lip=mix(.43,.69,canyon_bed_random(layer,seed+7109u));
  let ramp=smoothstep(lip-mix(.29,.16,solid),lip+mix(.23,.08,solid),phase);
  let cap=solid*smoothstep(lip-.07,lip+.09,phase)*(1.0-smoothstep(.89,1.0,phase));
  let ash=mix(.92,.32,solid)*smoothstep(0.0,.13,phase)*(1.0-smoothstep(lip-.13,lip+.03,phase));
  let thickness=(top-base)*spacing;
  return BasaltFlow((ramp-phase)*thickness*mix(.20,.89,solid),cap,ash,thickness);
}
