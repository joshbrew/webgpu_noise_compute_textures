// A single rasterized depth lookup, shared by the two cloud marching paths.
fn cloudTerrainDepth(tex:texture_2d<f32>,uv:vec2<f32>,enabled:f32)->f32 {
  if(enabled<0.5){return 1000000.0;}
  let dims=vec2<i32>(textureDimensions(tex));
  let distance=textureLoad(tex,clamp(vec2<i32>(uv*vec2<f32>(dims)),vec2<i32>(0),dims-1),0).a;
  return select(1000000.0,distance,distance>0.0);
}
fn cloudTerrainColor(p:vec3<f32>,n:vec3<f32>,sun:vec3<f32>)->vec3<f32> {
  let slope=clamp(n.y,0.0,1.0);
  let strata=0.5+0.5*sin(p.y*1.3+p.x*0.035+p.z*0.05);
  let stone=mix(vec3<f32>(0.14,0.17,0.20),vec3<f32>(0.25,0.24,0.22),strata*0.45);
  let meadow=mix(vec3<f32>(0.08,0.14,0.12),vec3<f32>(0.16,0.21,0.15),strata);
  let vegetation=smoothstep(0.55,0.92,slope)*(1.0-smoothstep(1.0,7.0,p.y));
  let rock=mix(stone,meadow,vegetation);
  let snowline=p.y+sin(p.x*0.12+p.z*0.08)*0.65;
  let snow=smoothstep(7.0,11.5,snowline)*smoothstep(0.38,0.80,slope);
  let albedo=mix(rock,vec3<f32>(0.79,0.84,0.87),snow);
  let sky=mix(vec3<f32>(0.21,0.27,0.37),vec3<f32>(0.40,0.47,0.54),slope);
  return albedo*(sky+vec3<f32>(1.05,0.93,0.78)*max(dot(n,sun),0.0)*0.90);
}
