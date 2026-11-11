import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planetCloudStyleOptions} from '../planetCloudStyles.js';
import {advancePlanetCloudTime,planetCloudWarp,regeneratePlanetCloudWeather} from '../planetCloudMotion.js';

const source=await readFile(new URL('../planetCloudSurface.js',import.meta.url),'utf8');
function functionCode(name,next){return source.slice(source.indexOf(`function ${name}`),source.indexOf(`function ${next}`));}
const finiteNumber=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const normalize3=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
const vectors=source.slice(source.indexOf('function normalizeVectorInput'),source.indexOf('function ensureContext'));

test('MC33 uniforms preserve thin shells and match radius-relative planet morphology',()=>{
  const code=functionCode('writeComputeParams','writeRenderParams')+functionCode('writeRenderParams','normalizeVectorInput')+vectors;
  const [compute,render]=new Function('finiteNumber','clamp','normalize3','computeVisibleFaceMask','countBits32','planetCloudWarp',code+';return [writeComputeParams,writeRenderParams];')(finiteNumber,clamp,normalize3,()=>63,()=>6,planetCloudWarp);
  for(const style of ['realistic','diorama','hemisphere','scattered','gas_giant','neptune','hail_mary']){
    const options={...planetCloudStyleOptions(style,50),surfaceTerrainOcclusionRadius:70,warpAmount:.6,warpSpeed:2};
    let params;
    const layer={options,radius:50,angularCells:64,radialCells:11,maxVertices:399996,maxActiveCells:65000,canvas:{width:1000,height:700},queue:{writeBuffer(_b,_o,v){params=new DataView(v);}}};
    const camera=compute(layer,{},20,0.5);
    assert.equal(params.getFloat32(248,true),options.tuning.formType);
    assert.ok(Math.abs(params.getFloat32(252,true)-options.worldToUV*options.transforms.shapeScale)<1e-7);
    assert.ok(Math.abs(params.getFloat32(28,true)-options.params.globalCoverage)<1e-7);
    assert.ok(Math.abs(params.getFloat32(256,true)-.6)<1e-7);
    assert.ok(Math.abs(params.getFloat32(260,true)-planetCloudWarp(options,20).warpPhase)<1e-7);
    render(layer,camera,[1,1,0],20);
    assert.ok(Math.abs(params.getFloat32(148,true)-.6)<1e-7);
    assert.ok(Math.abs(params.getFloat32(152,true)-planetCloudWarp(options,20).warpPhase)<1e-7);
    assert.ok(Math.abs(params.getFloat32(76,true)-options.surfaceOpacity)<1e-7);
    assert.equal(params.getFloat32(140,true),options.tuning.formType);
    assert.ok(Math.abs(params.getFloat32(144,true)-20*options.spinSpeed*2*Math.PI)<1e-7);
    assert.ok(params.getFloat32(128,true)<50+options.cloudBottom,'highest mountain must not erase the cloud shell');
  }
});

test('MC33 field and mesh refresh together at bounded rates and skip redundant work',async()=>{
  const code=source.slice(source.indexOf('export async function updatePlanetCloudSurfaceLayer'),source.indexOf('export function disposePlanetCloudSurfaceLayer')).replace('export async','async');
  let now=1000;const calls=[];
  const update=new Function('performance','ensureContext','normalizeVectorInput','computeVisibleFaceMask','finiteNumber','writeComputeParams','writeRenderParams','encodeSurfaceCompute','encodeRenderSurface','advancePlanetCloudTime','clamp','normalize3','regeneratePlanetCloudWeather',code+';return updatePlanetCloudSurfaceLayer;')(
    {now:()=>now},()=>{},(v,f)=>v || f,()=>63,finiteNumber,()=>({}),()=>{},(_l,_e,c)=>calls.push(c),()=>{},advancePlanetCloudTime,clamp,normalize3,regeneratePlanetCloudWeather);
  const layer={radius:50,options:{surfaceAnimateTopology:true,surfaceFieldUpdateHz:6,surfaceMeshUpdateHz:6},
    fieldValid:false,topologyDirty:true,lastFieldUpdateTime:-Infinity,lastExtractionTime:-Infinity,currentFieldIndex:0,currentTileIndex:0,
    angularCells:64,radialCells:11,visibleFaceCount:6,visibleFaceMask:63,diagnosticPending:true,
    queue:{writeBuffer(){},submit(){}},device:{createCommandEncoder:()=>({finish(){}})}};
  await update(layer);assert.equal(calls.at(-1).updateField,true);assert.equal(calls.at(-1).updateMesh,true);
  now+=50;await update(layer);assert.equal(calls.at(-1).updateField,false);assert.equal(calls.at(-1).updateMesh,false);
  now+=150;await update(layer);assert.equal(calls.at(-1).updateField,true);assert.equal(calls.at(-1).updateMesh,true);
  layer.computePending=true;now+=1000;await update(layer);assert.equal(calls.at(-1).updateField,false);assert.equal(calls.at(-1).updateMesh,false);
  layer.computePending=false;layer.options.animate=false;await update(layer);assert.equal(calls.at(-1).updateField,false);assert.equal(calls.at(-1).updateMesh,false);
  layer.options.animate=true;layer.computeCompletionMs=120;now+=100;await update(layer);assert.equal(calls.at(-1).updateMesh,true);
  now+=300;await update(layer);assert.equal(calls.at(-1).updateMesh,false,'GPU contention must lower the refresh rate');
  layer.options.animate=false;layer.getCameraState=()=>({camPos:[10,0,200]});await update(layer);
  assert.equal(calls.at(-1).updateMesh,true,'camera movement must refresh visibility even with paused weather');
  layer.styleChanging=true;const n=calls.length;await update(layer);assert.equal(calls.length,n);
});

test('MC33 sampling is periodic in all axes and retains an explicit closed shell',async()=>{
  const shader=await readFile(new URL('../shaders/planetCloudSurfaceMC33.wgsl',import.meta.url),'utf8');
  for(const axis of ['U','V','W'])assert.match(source,new RegExp(`addressMode${axis}: 'repeat'`));
  assert.match(shader,/shapeTex: texture_3d/);
  assert.match(shader,/planetWarpPosition\(pos,params.shapeTime,params.formType,params.warpAmount,params.warpPhase\)\*params.worldScale/);
  assert.match(shader,/min\(ph,1\.0-ph\)/);
  assert.doesNotMatch(shader,/legacy_scalar_field|cloud_blob_field/);
  assert.match(source,/surfaceOcclusionRadiusScale: 1\.0/);
  assert.match(source,/surfaceAnimateTopology: true/);
});

test('MC33 defaults rebuild at display cadence, tolerate RAF jitter and report delivered rates',async()=>{
  const code=source.slice(source.indexOf('export async function updatePlanetCloudSurfaceLayer'),source.indexOf('export function disposePlanetCloudSurfaceLayer')).replace('export async','async');
  let now=1000;const calls=[];
  const update=new Function('performance','ensureContext','normalizeVectorInput','computeVisibleFaceMask','finiteNumber','writeComputeParams','writeRenderParams','encodeSurfaceCompute','encodeRenderSurface','advancePlanetCloudTime','clamp','normalize3','regeneratePlanetCloudWeather',code+';return updatePlanetCloudSurfaceLayer;')(
    {now:()=>now},()=>{},(v,f)=>v || f,()=>63,finiteNumber,()=>({}),()=>{},(_l,_e,c)=>calls.push(c),()=>{},advancePlanetCloudTime,clamp,normalize3,regeneratePlanetCloudWeather);
  const layer={radius:50,options:{surfaceAnimateTopology:true},fieldValid:false,topologyDirty:true,lastFieldUpdateTime:-Infinity,lastExtractionTime:-Infinity,currentFieldIndex:0,currentTileIndex:0,
    angularCells:96,radialCells:11,visibleFaceCount:6,visibleFaceMask:63,diagnosticPending:true,
    queue:{writeBuffer(){},submit(){}},device:{createCommandEncoder:()=>({finish(){}})}};
  await update(layer);
  layer.computeCompletionMs=4;
  for(let i=0;i<60;i++){now+=i%2?16.9:16.4;await update(layer);assert.equal(calls.at(-1).updateMesh,true);}
  now+=16.5;await update(layer);
  assert.ok(layer.performanceStats.observedMeshUpdateHz>58);
  assert.ok(Math.abs(layer.performanceStats.effectiveMeshUpdateHz-60)<1e-9);
  layer.computeCompletionMs=20;
  now+=16.6;await update(layer);assert.equal(calls.at(-1).updateMesh,false);
  assert.ok(layer.performanceStats.effectiveMeshUpdateHz<18);
  layer.computePending=true;now+=100;await update(layer);assert.equal(calls.at(-1).updateMesh,false);
});

test('smooth normal projection runs after fresh extraction, not just on later frames',()=>{
  const code=functionCode('encodeSurfaceCompute','encodeRenderSurface');
  const encode=new Function(code+';return encodeSurfaceCompute;')();
  const labels=[];
  const encoder={beginComputePass({label}){labels.push(label);return {setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},dispatchWorkgroupsIndirect(){},end(){}}}};
  const layer={options:{},pipelines:{},pointsPerFace:12,visibleFaceCount:6,classifyBindGroups:[{}],extractBindGroups:[{}],projectBindGroups:[{}]};
  encode(layer,encoder,{updateField:false,updateMesh:true,projectVertices:true,meshFieldIndex:0,candidateCells:10});
  const extract=labels.findIndex(x=>x.includes('extraction pass')),normals=labels.findIndex(x=>x.includes('projection pass'));
  assert.ok(extract>=0 && normals>extract);
});
