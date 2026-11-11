fn studio_wind_dir(seed:u32)->vec3<f32>{
  let heading=6.283185307*f32(seed&65535u)/65536.0;
  return vec3<f32>(cos(heading),0.0,sin(heading));
}

fn studio_dryness(dir:vec3<f32>,rock:vec4<f32>,seed:u32)->f32{
  let phase=6.283185307*f32(seed>>16u)/65536.0;
  let belt=1.0-smoothstep(.43,.81,abs(dir.y));
  let lee=.78*sin(dot(dir,vec3<f32>(4.0,2.0,-5.52))+phase)+
    .40*sin(dot(dir,vec3<f32>(-8.7,3.3,-5.4))-.71*phase);
  let supply=min(1.0,1.42*(rock.y+.78*rock.w+.36*rock.z));
  return belt*supply*smoothstep(-.67,.47,lee);
}
