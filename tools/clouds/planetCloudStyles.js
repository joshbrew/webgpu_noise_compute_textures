// Radius-relative raymarch styles. Shared noise modes mean switching styles
// changes a one-time bake and uniforms, not shader variants or per-frame work.
export const PLANET_CLOUD_STYLES = Object.freeze([
  {id:'legacy',label:'Current / custom clouds'},
  {id:'realistic',label:'Thin realistic layer'},
  {id:'diorama',label:'Big diorama clouds'},
  {id:'hemisphere',label:'Cloudy hemisphere'},
  {id:'scattered',label:'A few puffy clouds'},
  {id:'gas_giant',label:'Jupiter / curled storms'},
  {id:'neptune',label:'Neptune / blue storm bands'},
  {id:'hail_mary',label:'Hail Mary / green-orange swirls'},
]);

export function planetCloudStyleOptions(style, radius = 50) {
  if (style === 'legacy') return {};
  if (!PLANET_CLOUD_STYLES.some(s=>s.id===style)) throw new RangeError(`Unknown planet cloud style: ${style}`);
  const r = Number.isFinite(radius) && radius > 0 ? radius : 50;
  const cute = style !== 'realistic',gas=['gas_giant','neptune','hail_mary'].includes(style);
  const gasForm=style==='neptune'?6:style==='hail_mary'?7:5;
  const translucent = style === 'hail_mary';
  return {
    cloudStyle:style,cloudRenderMode:'raymarch',progressiveStartup:false,bootstrapFrames:0,
    cloudBottom:r*(cute?.025:.012),cloudTop:r*(gas?.055:style==='diorama'?.225:cute?.155:.032),
    worldToUV:2.4/r,stepBase:r*(cute?.0018:.00065),stepInc:.025,
    maxHalfHeight:r*(cute?.065:.01),opacity:translucent?.78:.98,surfaceOpacity:translucent?.72:.995,alphaPower:1,alphaCutoff:.003,
    spinSpeed:.00065,evolutionSpeed:.03,nearSurfaceAdaptiveQuality:true,
    params:{globalCoverage:style==='scattered'?.60:style==='hemisphere'?.98:gas?1.12:cute?.82:.90,globalDensity:translucent?8:cute?36:42,cloudAnvilAmount:0,cloudBeer:cute?3.8:5.0,
      frontLightColor:cute?[1.5,1.43,1.32]:[1.24,1.27,1.30],shadowLightColor:cute?[.42,.50,.66]:[.32,.40,.55]},
    tuning:{formType:style==='hemisphere'?3:style==='scattered'?4:gas?gasForm:cute?2:1,maxSteps:96,sunSteps:3,sunStride:8,
      nearDensityMult:1.15,raySmoothDens:.20,raySmoothSun:.55,
      nearFluffDist:r*.35,nearDensityRange:r*.20,nearLodBias:-.5,
      fluffFactor:cute?3.5:2.2,definition:cute?.38:.66,sparsity:cute?.40:.22,
      minOutputAlpha:.003,alphaBoostAmount:0,outputAlphaFeather:.25,
      baseJitterFrac:.008,topJitterFrac:.025},
    transforms:{shapeScale:cute?.44:1.35,detailScale:cute?.65:1.5,
      shapeAxisScale:[1,1,1],detailAxisScale:[1,1,1],weatherAxisScale:[1,1,1],
      shapeBias:0,detailBias:0,weatherScale:1,weatherBias:.22},
  };
}
