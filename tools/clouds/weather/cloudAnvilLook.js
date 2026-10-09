// One authored anvil look for the standalone preset and the weather director.
// The cycle changes coverage/development, not the mature cloud's anatomy.
export const ANVIL_FORM = Object.freeze({type:3,halfY:5.8,puffScale:7,ao:.82,heightVariation:.18});
export const ANVIL_PARAMS = Object.freeze({
  globalCoverage:.94,globalDensity:11.8,cloudAnvilAmount:1.15,
  cloudBeer:6,silverIntensity:1.15,silverExponent:1.65,
});
export const ANVIL_TUNING = Object.freeze({
  puffScale:ANVIL_FORM.puffScale,aoStrength:ANVIL_FORM.ao,towerHeightVariation:ANVIL_FORM.heightVariation,
  fluffFactor:4.9,sparsity:.44,definition:.72,raySmoothDens:.23,
  baseJitterFrac:.045,topJitterFrac:.32,verticalTextureHomogeneity:1,verticalLayerDecorrelation:1,
  sliceJitterStrength:.14,alphaCutoff:.965,alphaBoostThreshold:.20,alphaBoostAmount:.14,
  minOutputAlpha:.12,outputAlphaFeather:.52,
});

export const ANVIL_PRESET_VALUES = Object.freeze({
  'p-coverage':ANVIL_PARAMS.globalCoverage,'p-density':ANVIL_PARAMS.globalDensity,'p-anvil':ANVIL_PARAMS.cloudAnvilAmount,
  'p-beer':ANVIL_PARAMS.cloudBeer,'p-sI':ANVIL_PARAMS.silverIntensity,'p-sE':ANVIL_PARAMS.silverExponent,
  ...Object.fromEntries(Object.entries(ANVIL_TUNING)
    .filter(([key])=>!['puffScale','aoStrength','towerHeightVariation'].includes(key))
    .map(([key,value])=>[`t-${key==='baseJitterFrac'?'baseJitter':key==='topJitterFrac'?'topJitter':key}`,value])),
});
