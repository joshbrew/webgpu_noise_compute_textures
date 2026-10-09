// Adapter for the planet test's nested JSON controls. Keep preset values in
// one place: the simulation uses exactly the same cloud styles as the lab.
import {planetCloudStyleOptions} from './planetCloudStyles.js';
export {PLANET_CLOUD_STYLES} from './planetCloudStyles.js';

export function planetCloudSimStylePatch(style='realistic',radius=50) {
 const p=planetCloudStyleOptions(style,radius);
 const base={cloudStyle:style,cloudRenderMode:'raymarch',showCloudStyleControl:false,
  progressiveStartup:false,bootstrapFrames:0};
 if(style==='legacy')return base;
 return {...base,nearSurfaceAdaptiveQuality:p.nearSurfaceAdaptiveQuality,surface:{surfaceOpacity:p.surfaceOpacity},
  shell:{cloudBottom:p.cloudBottom,cloudTop:p.cloudTop,maxHalfHeight:p.maxHalfHeight},
  render:{worldToUV:p.worldToUV,stepBase:p.stepBase,stepInc:p.stepInc,opacity:p.opacity,alphaPower:p.alphaPower,alphaCutoff:p.alphaCutoff},
  motion:{spinSpeed:p.spinSpeed},params:p.params,tuning:p.tuning,transforms:p.transforms};
}
