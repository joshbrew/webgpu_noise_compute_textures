struct RenderParams {
  camPos: vec3<f32>,
  tanHalfFovY: f32,
  camRight: vec3<f32>,
  aspect: f32,
  camUp: vec3<f32>,
  nearPlane: f32,
  camFwd: vec3<f32>,
  farPlane: f32,
  sunDir: vec3<f32>,
  opacity: f32,
  lightColor: vec3<f32>,
  silverStrength: f32,
  shadowColor: vec3<f32>,
  ambient: f32,
  planetRadius: f32,
  detailScale: f32,
  detailStrength: f32,
  detailTime: f32,
  terrainOcclusionRadius: f32,
  terrainDepthBias: f32,
  evolutionPhase: f32,
  formType: f32,
  weatherTime: f32,
  warpAmount: f32,
  warpPhase: f32,
  _padding: f32,
}

struct VertexOut {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) worldPosition: vec3<f32>,
  @location(1) worldNormal: vec3<f32>,
  @location(2) viewDepth: f32,
}

@group(0) @binding(0) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> normals: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: RenderParams;
@group(0) @binding(3) var detailTex: texture_3d<f32>;
@group(0) @binding(4) var linearSampler: sampler;
@group(0) @binding(5) var weatherTex: texture_2d_array<f32>;

const PI: f32 = 3.141592653589793;

fn direction_to_uv(dir: vec3<f32>) -> vec2<f32> {
  let lon = atan2(dir.z, dir.x);
  let lat = asin(clamp(dir.y, -1.0, 1.0));
  return vec2<f32>(fract(lon / (2.0 * PI) + 0.5), clamp(0.5 - lat / PI, 0.001, 0.999));
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  let worldPosition = positions[vertexIndex].xyz;
  let worldNormal = normalize(normals[vertexIndex].xyz);
  let rel = worldPosition - params.camPos;
  let viewX = dot(rel, params.camRight);
  let viewY = dot(rel, params.camUp);
  // Let homogeneous clipping reject geometry behind/through the near plane;
  // clamping W projected behind-camera triangles onto the screen while flying.
  let viewZ = dot(rel, params.camFwd);
  let x = viewX / max(params.tanHalfFovY * params.aspect, 1e-5);
  let y = viewY / max(params.tanHalfFovY, 1e-5);
  let z = (params.farPlane / (params.farPlane - params.nearPlane)) * viewZ -
    (params.nearPlane * params.farPlane / (params.farPlane - params.nearPlane));

  var out: VertexOut;
  out.clipPosition = vec4<f32>(x, y, z, viewZ);
  out.worldPosition = worldPosition;
  out.worldNormal = worldNormal;
  out.viewDepth = viewZ;
  return out;
}

fn segment_hits_planet(ro: vec3<f32>, point: vec3<f32>, radius: f32) -> bool {
  let segment = point - ro;
  let distanceToPoint = length(segment);
  let rd = segment / max(distanceToPoint, 1e-6);
  let b = dot(ro, rd);
  let c = dot(ro, ro) - radius * radius;
  let h = b * b - c;
  if (h <= 0.0) {
    return false;
  }
  let nearest = -b - sqrt(h);
  return nearest > 0.0 && nearest < distanceToPoint - 0.03;
}

@fragment
fn fs_main(input: VertexOut) -> @location(0) vec4<f32> {
  let occlusionRadius = max(params.planetRadius,params.terrainOcclusionRadius);
  if (segment_hits_planet(params.camPos, input.worldPosition, occlusionRadius)) {
    discard;
  }

  let viewDir = normalize(params.camPos - input.worldPosition);
  let radial = normalize(input.worldPosition);
  let smoothNormal = normalize(input.worldNormal);
  var geometricNormal = normalize(cross(dpdx(input.worldPosition), dpdy(input.worldPosition)));
  if (dot(geometricNormal, smoothNormal) < 0.0) {
    geometricNormal = -geometricNormal;
  }
  let surfaceNormal = normalize(mix(geometricNormal, smoothNormal, 0.84));
  if (dot(surfaceNormal, viewDir) <= 0.0) {
    discard;
  }
  let outerSurfaceGate = 1.0;
  let baseNormal = normalize(mix(radial, surfaceNormal, 0.90));
  let angle=params.detailTime;
  let p=input.worldPosition;
  let rawDomain=planetWarpPosition(p,angle,params.formType,params.warpAmount,params.warpPhase)*params.detailScale;
  let phase=params.evolutionPhase;
  let warp=vec3<f32>(sin(rawDomain.y*5.7+phase),sin(rawDomain.z*6.3-phase*.71),sin(rawDomain.x*5.1+phase*.47));
  let domain=rawDomain+vec3<f32>(.018,.011,-.014)*phase+warp*.055;
  let detailSample0 = textureSampleLevel(detailTex,linearSampler,domain,0.0);
  let detailSample1 = textureSampleLevel(detailTex,linearSampler,domain*2.17+vec3<f32>(0.31,0.19,0.43),0.0);
  let baseNdotV = clamp(dot(baseNormal, viewDir), 0.0, 1.0);
  let detailFade = smoothstep(0.06, 0.30, baseNdotV);
  // Screen derivatives of continuous 3D noise give subtle hull breakup with
  // two filtered texture reads, no pole tangent switch or extra light march.
  let bump=detailSample0.g*0.72+detailSample1.b*0.28;
  let px=dpdx(input.worldPosition);let py=dpdy(input.worldPosition);
  let rx=cross(py,baseNormal);let ry=cross(baseNormal,px);
  let determinant=dot(px,rx);
  let gradient=(rx*dpdx(bump)+ry*dpdy(bump))/max(abs(determinant),1e-5)*sign(determinant);
  let detailNormal=normalize(baseNormal-gradient*params.detailStrength*detailFade*0.12*select(1.0,.25,params.formType>=4.5));
  let shadedNormal = normalize(mix(radial, detailNormal, 0.84 + 0.16 * detailFade));

  let sunDir = normalize(params.sunDir);
  let neptune=params.formType>=5.5&&params.formType<6.5;
  let lightingNormal = normalize(mix(radial, shadedNormal, select(.88,.06,neptune)));
  let nDotL = dot(lightingNormal, sunDir);
  let nDotV = clamp(dot(shadedNormal, viewDir), 0.0, 1.0);
  let radialSun = dot(radial, sunDir);
  let lightGate = smoothstep(-0.12, 0.08, radialSun) * outerSurfaceGate;
  let transmissionGate = smoothstep(-0.02, 0.22, radialSun) * outerSurfaceGate;
  let viewSun = clamp(dot(viewDir, sunDir), 0.0, 1.0);
  let wrappedLight = clamp((nDotL + 0.34) / 1.34, 0.0, 1.0) * lightGate;
  let diffuse = pow(wrappedLight, 0.72);
  let rim = pow(1.0 - nDotV, 2.55);
  let litRim = rim * smoothstep(-0.10, 0.48, nDotL) * lightGate;
  let halfVec = normalize(sunDir + viewDir);
  let specular = pow(max(dot(shadedNormal, halfVec), 0.0), 18.0) * 0.025 * params.silverStrength * lightGate;
  let forwardScatter = pow(viewSun, 8.0) * rim * transmissionGate;
  let backTransmission = pow(clamp(-nDotL, 0.0, 1.0), 1.5) * rim * transmissionGate * smoothstep(0.35, 0.85, viewSun);
  let fineNoise = mix(detailSample0.r, detailSample1.r, 0.34);

  let warmLight = params.lightColor * vec3<f32>(1.03, 1.00, 0.94);
  let coolShadow = params.shadowColor;
  var body = coolShadow * (0.52 + params.ambient * 0.28);
  body = mix(body, warmLight, clamp(diffuse * 1.10, 0.0, 1.0));
  body *= 0.92 + fineNoise * 0.13;
  body += warmLight * litRim * (0.28 + 0.34 * params.silverStrength);
  body += warmLight * specular;
  body += warmLight * forwardScatter * 0.055;
  body += mix(coolShadow, warmLight, 0.34) * backTransmission * 0.035;
  body += coolShadow * params.ambient * 0.14;
  if(params.formType>=4.5){
    let d=planetWarpDirection(radial,params.weatherTime,params.formType,params.warpAmount,params.warpPhase);
    let inset=.5/f32(textureDimensions(weatherTex).y);
    let uv=vec2<f32>(fract(atan2(d.z,d.x)/(2.0*PI)),clamp(acos(clamp(d.y,-1.0,1.0))/PI,inset,1.0-inset));
    let weather=textureSampleLevel(weatherTex,linearSampler,uv,0,0.0);
    body*=gasWeatherColor(weather,params.formType);
  }
  body = body / (vec3<f32>(1.0) + body * 0.22);
  body = clamp(body, vec3<f32>(0.0), vec3<f32>(1.18));

  let alpha = clamp(params.opacity * (0.982 + litRim * 0.018), 0.0, 1.0);
  return vec4<f32>(body * alpha, alpha);
}
