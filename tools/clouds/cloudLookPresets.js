// Reference-inspired appearance only. No density, morphology, noise, camera,
// wind or sampling settings belong here; these looks also dress live weather.
const look = (label, palette, controls = {}) => ({
  label,
  sky: palette[0], sunTint: palette[1], frontLightTint: palette[2],
  volumeShadowTint: palette[3], cloudLitTint: palette[4],
  cloudShadowTint: palette[5], edgeTint: palette[6],
  transmissiveLightTint: palette[6],
  exposure: 1.1, sunBloom: .18, directLightBlend: .85, directLightBoost: .65,
  styleShadowStrength: 1.5, styleShadowEdge: .12, styleShadowDarkness: 0,
  styleColorLift: 1.1, styleSaturation: 1, styleRimStrength: .1,
  styleSunBleed: .1, styleMidLift: 1,
  fogDensity: .12, fogHorizon: .30, fogSun: .12,
  godRaysEnabled: true, godRayStrength: .12, godRayLength: 1, godRayFalloff: 1.6,
  ...controls,
});

// Seven palette swatches: sky, source, front light, volume ambient,
// lit finish, shadow finish, rim. Each look authors transmitted light separately
// in its controls so backlighting need not share the rim's hue.
export const REFERENCE_LOOK_PRESETS = Object.freeze({
  16: look('Cobalt Moon', [
    [0.12,0.24,0.52],[0.83,0.94,1.14],[0.63,0.86,1.2],[0.07,0.065,0.23],
    [0.84,0.97,1.14],[0.16,0.18,0.49],[0.66,1.04,1.27],
  ], {transmissiveLightTint:[0.7,1.02,1.22],styleShadowStrength:2.3, styleShadowDarkness:.35, styleSaturation:1.22}),
  17: look('Rosewater Dusk', [
    [0.64,0.36,0.4],[1.14,0.97,0.75],[1.36,0.88,0.78],[0.23,0.09,0.22],
    [1.24,0.91,0.84],[0.46,0.23,0.4],[1.43,1.18,0.78],
  ], {transmissiveLightTint:[1.29,0.95,1.11],exposure:1.2, fogDensity:.18, styleSaturation:.92, styleMidLift:1.12}),
  18: look('Porcelain Daylight', [
    [0.34,0.45,0.62],[1.05,1.03,0.98],[1.48,1.43,1.37],[0.39,0.49,0.66],
    [1.18,1.15,1.12],[0.6,0.69,0.86],[1.32,1.32,1.25],
  ], {transmissiveLightTint:[1.1,1.08,0.99],exposure:1.3, styleShadowStrength:1.1, styleSaturation:.72, directLightBoost:.85, godRayStrength:.06}),
  19: look('Molten Gold · Illustrated', [
    [0.62,0.28,0.3],[1.3,1.1,0.62],[1.48,0.68,0.23],[0.09,0.025,0.055],
    [1.55,0.82,0.3],[0.1,0.028,0.065],[2.1,1.57,0.52],
  ], {transmissiveLightTint:[1.44,0.82,0.57],exposure:1.15, styleShadowStrength:3.8, styleShadowEdge:1.6, styleShadowDarkness:1.1,
    styleSaturation:1.65, styleRimStrength:1.10, styleSunBleed:.65, styleMidLift:.68, fogDensity:.04, godRayStrength:.24}),
  20: look('Gilded Violet · Illustrated', [
    [0.45,0.29,0.54],[1.24,1.11,0.76],[1.44,1.02,0.55],[0.1,0.055,0.21],
    [1.43,1.16,0.73],[0.19,0.11,0.36],[2.05,1.77,0.8],
  ], {transmissiveLightTint:[1.18,0.86,1.31],exposure:1.25, styleShadowStrength:3.1, styleShadowEdge:1.1, styleShadowDarkness:.7,
    styleSaturation:1.28, styleRimStrength:.95, styleSunBleed:.55, styleMidLift:.84, fogDensity:.05, godRayStrength:.18}),
  21: look('Electric Cyan · Illustrated', [
    [0.075,0.34,0.53],[0.73,1.12,1.28],[0.3,1.02,1.26],[0.018,0.023,0.065],
    [0.46,1.16,1.4],[0.035,0.055,0.15],[0.7,1.78,1.98],
  ], {transmissiveLightTint:[0.42,1.23,1.38],styleShadowStrength:4, styleShadowEdge:1.5, styleShadowDarkness:1.3,
    styleSaturation:1.45, styleRimStrength:.95, styleSunBleed:.45, styleMidLift:.65, fogDensity:.03, godRayStrength:.08}),
  22: look('Lavender Pearl', [
    [0.38,0.46,0.64],[1.08,1.04,0.94],[1.38,1.12,1.29],[0.36,0.35,0.61],
    [1.18,0.99,1.14],[0.65,0.61,0.92],[1.45,1.36,1.08],
  ], {transmissiveLightTint:[1.2,0.98,1.3],exposure:1.35, styleShadowStrength:.85, styleColorLift:1.3, styleSaturation:.78, styleMidLift:1.4, fogDensity:.20}),
  23: look('Solar Copper Classic · Illustrated', [
    [0.78,0.36,0.15],[1.22,1.04,0.7],[1.48,0.79,0.3],[0.13,0.045,0.085],
    [1.42,0.91,0.48],[0.2,0.075,0.12],[1.87,1.46,0.79],
  ], {transmissiveLightTint:[1.31,0.83,0.7],exposure:1.05, styleShadowStrength:3.3, styleShadowEdge:.85, styleShadowDarkness:.7,
    styleSaturation:1.32, styleRimStrength:.65, styleSunBleed:.35, styleMidLift:.80, fogDensity:.06, godRayStrength:.10}),
  24: look('Silver Indigo', [
    [0.34,0.42,0.6],[1.09,1.07,0.94],[0.98,0.96,1.13],[0.1,0.1,0.26],
    [0.96,0.94,1.1],[0.28,0.27,0.54],[1.49,1.45,1.02],
  ], {transmissiveLightTint:[1.12,1.04,1.26],styleShadowStrength:2.3, styleShadowDarkness:.3, styleSaturation:.85, styleRimStrength:.65}),
  25: look('Copper Atmosphere', [
    [0.64,0.31,0.23],[1.18,0.98,0.71],[1.48,0.95,0.6],[0.24,0.12,0.17],
    [1.26,0.98,0.77],[0.45,0.27,0.32],[1.55,1.24,0.77],
  ], {transmissiveLightTint:[1.3,0.9,1.03],exposure:1.2, styleShadowStrength:1.45, styleSaturation:1.05, fogDensity:.22, fogSun:.24, godRayStrength:.16}),
  26: look('Lavender Ink · Illustrated', [
    [0.4,0.47,0.65],[1.07,1.02,0.89],[1.32,1.01,1.28],[0.23,0.26,0.49],
    [1.18,0.94,1.2],[0.33,0.34,0.62],[1.58,1.48,1.05],
  ],{transmissiveLightTint:[1.08,0.87,1.3],exposure:1.2,styleShadowStrength:1.8,styleShadowEdge:.8,styleShadowDarkness:.1,styleRimStrength:.55,styleMidLift:1.2,styleSaturation:.85,fogDensity:.06}),
  27: look('Silver Outline · Illustrated', [
    [0.36,0.44,0.6],[1.08,1.06,0.92],[1.02,1.02,1.15],[0.06,0.055,0.16],
    [0.94,0.98,1.13],[0.11,0.115,0.28],[1.62,1.56,1.08],
  ],{transmissiveLightTint:[1.13,1.08,1.26],styleShadowStrength:3.0,styleShadowEdge:1.3,styleShadowDarkness:.8,styleRimStrength:.85,styleMidLift:.72,fogDensity:.04}),
  28: look('Cobalt Ink · Illustrated', [
    [0.12,0.26,0.52],[0.84,0.94,1.17],[0.61,0.81,1.17],[0.035,0.033,0.12],
    [0.6,0.83,1.15],[0.06,0.065,0.21],[0.84,1.24,1.62],
  ],{transmissiveLightTint:[0.58,1.02,1.36],styleShadowStrength:3.0,styleShadowEdge:1.2,styleShadowDarkness:.7,styleRimStrength:.70,styleMidLift:.75,fogDensity:.03}),
  29: look('Lavender Gouache', [
    [0.4,0.48,0.64],[1.08,1.04,0.92],[1.23,1.01,1.24],[0.34,0.32,0.51],
    [1.18,0.98,1.18],[0.47,0.43,0.69],[1.56,1.48,1.1],
  ],{transmissiveLightTint:[1.16,0.97,1.25],exposure:1.22,styleShadowStrength:1.25,styleShadowEdge:.65,styleColorLift:1.10,
    styleSaturation:.86,styleRimStrength:.80,styleSunBleed:.12,styleMidLift:1.18,
    fogDensity:.08,fogSun:.06,godRayStrength:.04}),
  30: look('Indigo Gouache', [
    [0.38,0.45,0.63],[1.08,1.04,0.92],[1.06,0.99,1.17],[0.13,0.13,0.32],
    [1.01,0.98,1.16],[0.14,0.14,0.33],[1.65,1.57,1.05],
  ],{transmissiveLightTint:[1.13,0.98,1.28],exposure:1.16,styleShadowStrength:2.0,styleShadowEdge:.90,styleColorLift:1.04,
    styleSaturation:.90,styleRimStrength:1.0,styleSunBleed:.10,styleMidLift:.92,
    fogDensity:.045,fogSun:.04,godRayStrength:.035}),
  31: look('Rose Gold Wash', [
    [0.53,0.37,0.49],[1.14,1.04,0.87],[1.38,0.96,1.04],[0.32,0.19,0.37],
    [1.32,0.98,0.92],[0.43,0.26,0.47],[1.73,1.51,0.99],
  ],{transmissiveLightTint:[1.35,0.94,1.13],exposure:1.20,styleShadowStrength:1.35,styleShadowEdge:.60,styleColorLift:1.12,
    styleSaturation:.95,styleRimStrength:.85,styleSunBleed:.14,styleMidLift:1.15,
    fogDensity:.09,fogSun:.10,godRayStrength:.05}),
  32: look('Copper Ochre Gouache', [
    [0.65,0.34,0.25],[1.18,1.04,0.75],[1.39,0.92,0.56],[0.19,0.08,0.12],
    [1.39,0.94,0.51],[0.27,0.11,0.17],[1.96,1.55,0.84],
  ],{transmissiveLightTint:[1.35,0.83,0.69],exposure:1.12,styleShadowStrength:2.1,styleShadowEdge:.85,styleColorLift:1.08,
    styleSaturation:1.10,styleRimStrength:1.05,styleSunBleed:.15,styleMidLift:.95,
    fogDensity:.055,fogSun:.10,godRayStrength:.06}),
  33: look('Lavender Glaze', [
    [0.4,0.48,0.65],[1.09,1.05,0.95],[1.28,1.06,1.25],[0.4,0.37,0.61],
    [1.24,1.04,1.21],[0.54,0.49,0.78],[1.5,1.42,1.12],
  ],{transmissiveLightTint:[1.17,1,1.27],exposure:1.24,styleShadowStrength:.95,styleShadowEdge:.40,styleColorLift:1.10,
    styleSaturation:1.0,styleRimStrength:.42,styleSunBleed:.08,styleMidLift:1.22,
    fogDensity:.085,fogSun:.05,godRayStrength:.03}),
  34: look('Violet Underpainting', [
    [0.4,0.47,0.65],[1.09,1.04,0.92],[1.3,1,1.25],[0.23,0.25,0.49],
    [1.21,0.95,1.19],[0.29,0.29,0.58],[1.6,1.49,1.06],
  ],{exposure:1.20,transmissiveLightTint:[0.97,0.86,1.32],directLightBlend:.90,directLightBoost:.85,
    styleShadowStrength:1.65,styleShadowEdge:.80,styleColorLift:1.08,
    styleSaturation:1.08,styleRimStrength:.60,styleSunBleed:.09,styleMidLift:1.08,
    fogDensity:.06,fogSun:.05,godRayStrength:.035}),
  35: look('Lavender Sunwash', [
    [0.42,0.48,0.64],[1.12,1.05,0.92],[1.4,1.04,1.17],[0.34,0.28,0.51],
    [1.32,0.99,1.1],[0.45,0.39,0.68],[1.72,1.57,1.05],
  ],{exposure:1.23,transmissiveLightTint:[1.26,0.91,1.16],directLightBlend:.90,directLightBoost:.85,
    styleShadowStrength:1.20,styleShadowEdge:.45,styleColorLift:1.12,
    styleSaturation:1.10,styleRimStrength:.55,styleSunBleed:.12,styleMidLift:1.20,
    fogDensity:.08,fogSun:.08,godRayStrength:.04}),
  36: look('Silver Ink Wash', [
    [0.38,0.45,0.63],[1.09,1.06,0.94],[0.98,0.96,1.16],[0.08,0.07,0.2],
    [0.86,0.87,1.08],[0.08,0.08,0.21],[1.79,1.71,1.1],
  ],{transmissiveLightTint:[1.15,1.06,1.28],exposure:1.18,styleShadowStrength:2.35,styleShadowEdge:1.10,styleColorLift:1.05,
    styleSaturation:1.04,styleRimStrength:1.20,styleSunBleed:.10,styleMidLift:.90,
    fogDensity:.045,fogSun:.04,godRayStrength:.03}),
  37: look('Lilac Ink Wash', [
    [0.4,0.47,0.65],[1.09,1.04,0.94],[1.18,0.94,1.2],[0.19,0.16,0.37],
    [1.16,0.94,1.18],[0.22,0.18,0.41],[1.7,1.62,1.11],
  ],{transmissiveLightTint:[1.14,0.9,1.31],exposure:1.20,styleShadowStrength:1.95,styleShadowEdge:.95,styleColorLift:1.08,
    styleSaturation:.87,styleRimStrength:1.05,styleSunBleed:.09,styleMidLift:1.02,
    fogDensity:.06,fogSun:.045,godRayStrength:.03}),
  38: look('Indigo Ink Currents', [
    [0.38,0.45,0.63],[1.1,1.06,0.94],[0.8,0.77,0.97],[0.16,0.17,0.35],
    [0.79,0.79,0.99],[0.14,0.16,0.31],[1.81,1.74,1.09],
  ],{exposure:1.18,transmissiveLightTint:[1.18,0.98,1.29],styleShadowStrength:1.80,styleShadowEdge:.85,styleColorLift:1.04,
    styleSaturation:1.08,styleRimStrength:1.15,styleSunBleed:.04,styleMidLift:1.0,
    fogDensity:.035,fogSun:.025,godRayStrength:.015}),
  39: look('Pearl Ink Wisps', [
    [0.4,0.47,0.65],[1.09,1.05,0.96],[0.94,0.86,1.02],[0.23,0.24,0.43],
    [0.95,0.89,1.06],[0.22,0.23,0.42],[1.75,1.68,1.12],
  ],{transmissiveLightTint:[1.2,1.02,1.26],exposure:1.20,styleShadowStrength:1.45,styleShadowEdge:.70,styleColorLift:1.06,
    styleSaturation:1.02,styleRimStrength:.95,styleSunBleed:.035,styleMidLift:1.08,
    fogDensity:.045,fogSun:.025,godRayStrength:.015}),
  40: look('Indigo Layered Ink', [
    [0.36,0.43,0.61],[1.1,1.06,0.92],[0.8,0.74,0.89],[0.14,0.14,0.31],
    [0.79,0.75,0.91],[0.16,0.17,0.34],[1.7,1.64,1.04],
  ],{exposure:1.12,transmissiveLightTint:[1.1,0.96,1.29],styleShadowStrength:2.2,styleShadowEdge:.8,styleColorLift:1.0,
    styleSaturation:1.10,styleRimStrength:.85,styleSunBleed:.025,styleMidLift:.94,
    fogDensity:.025,fogSun:.02,godRayStrength:.015}),
  41: look('Lavender Layered Wash', [
    [0.4,0.47,0.64],[1.1,1.04,0.92],[1.4,1.04,1.14],[0.23,0.28,0.5],
    [1.24,0.94,1.08],[0.29,0.32,0.59],[1.59,1.48,1.04],
  ],{exposure:1.22,transmissiveLightTint:[0.94,0.84,1.32],directLightBlend:.90,directLightBoost:.85,
    styleShadowStrength:1.55,styleShadowEdge:.6,styleColorLift:1.08,
    styleSaturation:1.04,styleRimStrength:.65,styleSunBleed:.045,styleMidLift:1.08,
    fogDensity:.045,fogSun:.025,godRayStrength:.02}),
  42: look('Cyan Layered Ink', [
    [0.075,0.34,0.51],[0.79,1.13,1.2],[0.36,0.94,1.1],[0.018,0.02,0.065],
    [0.36,0.94,1.15],[0.02,0.03,0.08],[0.77,1.57,1.77],
  ],{transmissiveLightTint:[0.36,1.22,1.37],exposure:1.12,styleShadowStrength:2.65,styleShadowEdge:.9,styleColorLift:1.0,
    styleSaturation:1.12,styleRimStrength:.92,styleSunBleed:.02,styleMidLift:.90,
    fogDensity:.02,fogSun:.02,godRayStrength:.01}),
  43: look('Indigo Sumi Crests', [
    [0.4,0.46,0.63],[1.1,1.06,0.92],[0.55,0.54,0.73],[0.08,0.065,0.17],
    [0.54,0.55,0.74],[0.09,0.08,0.21],[2.1,2.04,1.24],
  ],{transmissiveLightTint:[1.14,1,1.3],exposure:1.10,styleShadowStrength:2.4,styleShadowEdge:.78,styleColorLift:1.0,
    styleSaturation:1.0,styleRimStrength:1.35,styleSunBleed:.025,styleMidLift:.96,
    fogDensity:.018,fogSun:.02,godRayStrength:.01}),
  44: look('Indigo Sumi Filaments', [
    [0.42,0.49,0.66],[1.02,1.02,0.99],[1.45,1.43,1.33],[0.22,0.29,0.52],
    [0.75,0.8,0.92],[0.13,0.18,0.31],[2.1,2.08,1.02],
  ],{exposure:1.10,transmissiveLightTint:[1.1,1.08,1.2],directLightBlend:.92,directLightBoost:1.02,
    styleShadowStrength:2.4,styleShadowEdge:.78,styleColorLift:1.0,
    styleSaturation:1.12,styleRimStrength:.90,styleSunBleed:.025,styleMidLift:1.0,
    fogDensity:.018,fogSun:.02,godRayStrength:.01}),
  45: look('Blue Sky Dawn', [
    [.18,.43,.76],[1.04,1.00,.90],[1.34,1.29,1.17],[.39,.47,.61],
    [1.15,1.10,.98],[.44,.52,.66],[1.40,1.27,.96],
  ],{transmissiveLightTint:[1.12,1.05,.92],exposure:1.12,sunBloom:.07,
    directLightBlend:.90,directLightBoost:.55,styleShadowStrength:1.25,
    styleShadowEdge:.18,styleColorLift:1.08,styleSaturation:1.02,
    styleRimStrength:.18,styleSunBleed:.035,styleMidLift:1.05,
    fogDensity:.055,fogHorizon:.36,fogSun:.09,godRayStrength:.025}),
  46: look('Sunlit Ivory', [
    [.16,.36,.64],[1.12,1.05,.90],[1.42,1.34,1.18],[.31,.40,.55],
    [1.22,1.17,1.06],[.43,.51,.64],[1.52,1.35,.98],
  ],{transmissiveLightTint:[1.23,1.12,.95],exposure:1.12,sunBloom:.08,
    styleShadowStrength:1.28,styleShadowEdge:.18,styleColorLift:1.08,styleMidLift:1.06,
    styleRimStrength:.24,styleSunBleed:.045,fogDensity:.04,fogSun:.08,godRayStrength:.08}),
  47: look('Storm Silver', [
    [.17,.24,.34],[1.20,1.12,.94],[1.30,1.32,1.30],[.23,.30,.40],
    [1.10,1.14,1.16],[.29,.36,.46],[1.50,1.37,1.05],
  ],{transmissiveLightTint:[1.16,1.17,1.18],exposure:1.12,sunBloom:.07,
    styleShadowStrength:1.65,styleShadowEdge:.24,styleSaturation:.88,styleMidLift:1.02,
    styleRimStrength:.30,styleSunBleed:.05,fogDensity:.055,fogSun:.08,godRayStrength:.14}),
  48: look('Apricot Gouache', [
    [.18,.33,.54],[1.12,1.06,.96],[1.34,1.27,1.13],[.37,.43,.56],
    [1.23,1.17,1.07],[.48,.52,.65],[1.55,1.33,1.02],
  ],{transmissiveLightTint:[1.20,1.12,1.01],exposure:1.10,sunBloom:.08,
    styleShadowStrength:1.20,styleShadowEdge:.18,styleColorLift:1.08,styleMidLift:1.08,
    styleSaturation:1.02,styleRimStrength:.30,styleSunBleed:.04,fogDensity:.035,fogSun:.06,godRayStrength:.07}),
  49: look('Coral Porcelain', [
    [.28,.39,.57],[1.20,1.04,.88],[1.42,1.02,.95],[.31,.32,.46],
    [1.29,.99,.97],[.43,.39,.53],[1.65,1.30,.99],
  ],{transmissiveLightTint:[1.29,1.04,1.06],exposure:1.15,sunBloom:.08,
    styleShadowStrength:1.35,styleShadowEdge:.24,styleColorLift:1.1,styleMidLift:1.10,
    styleSaturation:1.02,styleRimStrength:.35,styleSunBleed:.07,fogDensity:.035,fogSun:.06,godRayStrength:.06}),
});

export const INK_LOOK_IDS = Object.freeze([36,37,38,39,40,42,43,44]);
export const PAINTERLY_LOOK_IDS = Object.freeze([29,33,34,35,30,31,32,41,48,49,...INK_LOOK_IDS]);
export const SCULPTED_LOOK_IDS = Object.freeze([19,20,21,23,26,27,28,...PAINTERLY_LOOK_IDS]);
export function intendedCloudShading(style) {
  return SCULPTED_LOOK_IDS.includes(Number(style)) ? 'sculpted' : Object.hasOwn(REFERENCE_LOOK_PRESETS,style) ? 'soft' : 'auto';
}
