import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {REFERENCE_LOOK_PRESETS,intendedCloudShading,SCULPTED_LOOK_IDS} from '../cloudLookPresets.js';
import {sampleWeatherCycle,cyclePreview,cycleCloudParams} from '../weather/cloudWeatherCycle.js';

const ui=await readFile(new URL('../cloudTestThreaded.js',import.meta.url),'utf8');
const registry=ui.slice(ui.indexOf('const GRADE_PRESETS ='),ui.indexOf('\nfunction colorVec3('));
const grades=new Function('REFERENCE_LOOK_PRESETS',`${registry};return GRADE_PRESETS;`)(REFERENCE_LOOK_PRESETS);
const apply=ui.slice(ui.indexOf('function applyGradePreset('),ui.indexOf('\nconst safeClone ='));

test('reference groups declare a default finish while legacy palettes retain form-based auto',()=>{
  for(const id of Object.keys(REFERENCE_LOOK_PRESETS))assert.equal(intendedCloudShading(id),SCULPTED_LOOK_IDS.includes(Number(id))?'sculpted':'soft');
  assert.equal(intendedCloudShading(6),'auto');assert.equal(intendedCloudShading(0),'auto');
});

test('switching looks preserves anatomy, camera, sun direction, wind and render budgets',()=>{
  const preview={cam:{x:2,y:3,z:4},box:{half:[20,6,20]},sun:{azDeg:140,elDeg:22},cloudShading:'sculpted',cloudTurbulence:1.25,
    layerPreset:'towering_cu',volumeShape:'box',renderScaleDivider:2,temporalCellRate:8,fieldQuality:'high',exposure:1};
  const scene=structuredClone(preview);
  const applyLook=new Function('preview','GRADE_PRESETS','normalizeRenderScaleDivider','lightingProfileForGrade','fogProfileForGrade',
    `${apply};return applyGradePreset;`)(preview,grades,x=>x,id=>grades[id],id=>grades[id]);
  // Repeat in reverse as well to catch appearance leaking between looks.
  for(const id of [...Object.keys(REFERENCE_LOOK_PRESETS),...Object.keys(REFERENCE_LOOK_PRESETS).reverse()]) {
    applyLook(Number(id),false);
    for(const key of ['cam','box','cloudShading','cloudTurbulence','layerPreset','volumeShape','renderScaleDivider','temporalCellRate','fieldQuality'])
      assert.deepEqual(preview[key],scene[key],key);
    assert.equal(preview.sun.azDeg,scene.sun.azDeg);assert.equal(preview.sun.elDeg,scene.sun.elDeg);
    const expected=grades[id];
    for(const key of Object.keys(expected).filter(k=>k!=='label'&&k!=='sunBloom'))assert.deepEqual(preview[key],expected[key],key);
  }
});

test('every look overrides both live sky and light without changing weather or puffiness',()=>{
  for(const [id,preset] of Object.entries(REFERENCE_LOOK_PRESETS)) {
    const base={...structuredClone(preset),gradeStyle:Number(id),cycleStyleOverride:true,
      sun:{azDeg:17,elDeg:20,bloom:preset.sunBloom},box:{center:[3,1,-2],half:[18,6,18]},cloudShading:'sculpted',cloudTurbulence:.75};
    const saved=structuredClone(base);
    for(const seconds of [0,35,105,175,245,315,419.9]) for(const startHour of [0,6,12,18]) {
      const state=sampleWeatherCycle(seconds,{startHour});
      const natural=cyclePreview({...base,cycleStyleOverride:false},state,true);
      const styled=cyclePreview(base,state,true);
      const params=cycleCloudParams({},state,true,base);
      assert.equal(styled.gradeStyle,Number(id));assert.equal(styled.styleSkyOverride,true);
      assert.equal(styled.cloudShading,'sculpted');
      assert.equal(styled.cloudTurbulence,.75);
      assert.deepEqual(styled.box,natural.box);assert.equal(styled.sun.azDeg,natural.sun.azDeg);assert.equal(styled.sun.elDeg,natural.sun.elDeg);
      assert.deepEqual(styled.cloudLitTint,base.cloudLitTint);assert.deepEqual(styled.cloudShadowTint,base.cloudShadowTint);
      for(const [key,value] of Object.entries(state.cloudParams))assert.deepEqual(params[key],value,key);
      for(const value of [...styled.sky,...params.frontLightColor,...params.shadowLightColor,styled.exposure])assert.ok(Number.isFinite(value)&&value>=0);
      const source=base.frontLightTint[0]*base.sunTint[0]*state.lightIntensity;
      assert.ok(params.frontLightColor[0]>=0&&params.frontLightColor[0]<=source+1e-12);
    }
    assert.deepEqual(base,saved);
  }
});

test('selected palettes retain warm dawn and evening light while noon and moonlight stay stable',()=>{
  const base={...REFERENCE_LOOK_PRESETS[18],cycleStyleOverride:true,gradeStyle:18};
  const saved=structuredClone(base);
  const lightAt=hour=>{
    const state=sampleWeatherCycle(0,{startHour:hour});
    const params=cycleCloudParams({},state,true,base);
    return params.frontLightColor.map((v,i)=>v/(base.frontLightTint[i]*base.sunTint[i]*state.lightIntensity));
  };
  const morning=lightAt(6.6),evening=lightAt(17.4),noon=lightAt(12),moon=lightAt(0);
  assert.ok(morning[2]/morning[0]<.9,'morning light gains peach/gold warmth');
  assert.ok(evening[2]/evening[0]<morning[2]/morning[0],'evening light is more copper than morning');
  for(const v of noon)assert.ok(Math.abs(v-1)<1e-8);
  for(const v of moon)assert.equal(v,1);
  const dawn=sampleWeatherCycle(0,{startHour:6.6}),styled=cyclePreview(base,dawn,true);
  assert.ok(styled.sunTint[2]/styled.sunTint[0]<base.sunTint[2]/base.sunTint[0]);
  assert.deepEqual(base,saved);
});

test('automatic colors and manual TOD retain their existing behavior; styled light fades at handoff',()=>{
  const base={...REFERENCE_LOOK_PRESETS[23],gradeStyle:23,cycleStyleOverride:true,sun:{elDeg:20},sky:[.7,.3,.1]};
  const naturalBase={...base,cycleStyleOverride:false};
  const state=sampleWeatherCycle(0,{startHour:12});
  assert.equal(cyclePreview(naturalBase,state,true).gradeStyle,0);
  assert.deepEqual(cycleCloudParams({},state,true,naturalBase).frontLightColor,state.lightColor);
  assert.deepEqual(cyclePreview(base,state,false).sun,base.sun);
  assert.deepEqual(cyclePreview(base,state,false).sky,base.sky);
  assert.deepEqual(cycleCloudParams({sunColor:[1,2,3]},state,false,base).sunColor,[1,2,3]);
  for(const hour of [6,18])for(const offset of [-1e-5,0,1e-5]) {
    const s=sampleWeatherCycle(0,{startHour:hour+offset});
    assert.ok(Math.max(...cycleCloudParams({},s,true,base).frontLightColor)<1e-7);
  }
});
