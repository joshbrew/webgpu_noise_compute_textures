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
// lit finish, shadow finish, transmitted light / rim.
export const REFERENCE_LOOK_PRESETS = Object.freeze({
  16: look('Cobalt Moon', [
    [.13,.25,.52], [.76,.88,1.12], [.58,.78,1.16], [.045,.075,.20],
    [.75,.87,1.10], [.12,.20,.46], [.65,.88,1.22],
  ], {styleShadowStrength:2.3, styleShadowDarkness:.35, styleSaturation:1.22}),
  17: look('Rosewater Dusk', [
    [.64,.37,.34], [1.12,.96,.72], [1.32,.91,.73], [.20,.075,.13],
    [1.18,.91,.82], [.46,.20,.30], [1.34,1.10,.70],
  ], {exposure:1.2, fogDensity:.18, styleSaturation:.92, styleMidLift:1.12}),
  18: look('Porcelain Daylight', [
    [.34,.43,.60], [1.02,1.02,1.04], [1.40,1.43,1.48], [.42,.49,.62],
    [1.12,1.14,1.18], [.64,.71,.83], [1.26,1.30,1.36],
  ], {exposure:1.3, styleShadowStrength:1.1, styleSaturation:.72, directLightBoost:.85, godRayStrength:.06}),
  19: look('Molten Gold · Sculpted', [
    [.62,.29,.25], [1.30,1.08,.54], [1.42,.62,.18], [.065,.020,.012],
    [1.55,.72,.22], [.065,.023,.018], [2.10,1.48,.38],
  ], {exposure:1.15, styleShadowStrength:3.8, styleShadowEdge:1.6, styleShadowDarkness:1.1,
    styleSaturation:1.65, styleRimStrength:1.10, styleSunBleed:.65, styleMidLift:.68, fogDensity:.04, godRayStrength:.24}),
  20: look('Gilded Violet · Sculpted', [
    [.47,.27,.49], [1.24,1.10,.70], [1.40,1.02,.47], [.08,.04,.15],
    [1.45,1.13,.60], [.14,.075,.27], [2.05,1.68,.65],
  ], {exposure:1.25, styleShadowStrength:3.1, styleShadowEdge:1.1, styleShadowDarkness:.7,
    styleSaturation:1.28, styleRimStrength:.95, styleSunBleed:.55, styleMidLift:.84, fogDensity:.05, godRayStrength:.18}),
  21: look('Electric Cyan · Sculpted', [
    [.075,.37,.52], [.62,1.06,1.30], [.25,.90,1.26], [.006,.025,.045],
    [.38,1.12,1.46], [.015,.060,.11], [.50,1.70,2.05],
  ], {styleShadowStrength:4, styleShadowEdge:1.5, styleShadowDarkness:1.3,
    styleSaturation:1.45, styleRimStrength:.95, styleSunBleed:.45, styleMidLift:.65, fogDensity:.03, godRayStrength:.08}),
  22: look('Lavender Pearl', [
    [.38,.46,.62], [1.05,1.04,.93], [1.28,1.16,1.37], [.36,.34,.53],
    [1.08,.96,1.18], [.68,.63,.88], [1.38,1.34,1.05],
  ], {exposure:1.35, styleShadowStrength:.85, styleColorLift:1.3, styleSaturation:.78, styleMidLift:1.4, fogDensity:.20}),
  23: look('Solar Copper Classic · Sculpted', [
    [.80,.37,.105], [1.20,1.02,.64], [1.45,.70,.26], [.10,.033,.014],
    [1.38,.81,.39], [.16,.055,.025], [1.82,1.38,.74],
  ], {exposure:1.05, styleShadowStrength:3.3, styleShadowEdge:.85, styleShadowDarkness:.7,
    styleSaturation:1.32, styleRimStrength:.65, styleSunBleed:.35, styleMidLift:.80, fogDensity:.06, godRayStrength:.10}),
  24: look('Silver Indigo', [
    [.34,.41,.57], [1.04,1.06,.91], [.85,.91,1.16], [.075,.085,.20],
    [.83,.88,1.11], [.24,.25,.45], [1.40,1.40,.98],
  ], {styleShadowStrength:2.3, styleShadowDarkness:.3, styleSaturation:.85, styleRimStrength:.65}),
  25: look('Copper Atmosphere', [
    [.65,.30,.16], [1.16,.94,.67], [1.45,.93,.51], [.22,.095,.055],
    [1.20,.97,.74], [.42,.24,.19], [1.45,1.16,.72],
  ], {exposure:1.2, styleShadowStrength:1.45, styleSaturation:1.05, fogDensity:.22, fogSun:.24, godRayStrength:.16}),
  26: look('Lavender Ink · Sculpted', [
    [.40,.48,.63],[1.02,1.00,.86],[1.22,1.06,1.34],[.23,.24,.39],
    [1.06,.94,1.20],[.30,.31,.50],[1.50,1.45,1.08],
  ],{exposure:1.2,styleShadowStrength:1.8,styleShadowEdge:.8,styleShadowDarkness:.1,styleRimStrength:.55,styleMidLift:1.2,styleSaturation:.85,fogDensity:.06}),
  27: look('Silver Outline · Sculpted', [
    [.36,.43,.58],[1.04,1.04,.90],[.92,.96,1.18],[.035,.04,.11],
    [.83,.90,1.15],[.07,.09,.20],[1.52,1.50,1.06],
  ],{styleShadowStrength:3.0,styleShadowEdge:1.3,styleShadowDarkness:.8,styleRimStrength:.85,styleMidLift:.72,fogDensity:.04}),
  28: look('Cobalt Ink · Sculpted', [
    [.12,.25,.49],[.75,.87,1.18],[.52,.70,1.14],[.012,.027,.08],
    [.50,.70,1.10],[.025,.050,.14],[.75,1.10,1.60],
  ],{styleShadowStrength:3.0,styleShadowEdge:1.2,styleShadowDarkness:.7,styleRimStrength:.70,styleMidLift:.75,fogDensity:.03}),
});

export const SCULPTED_LOOK_IDS = Object.freeze([19,20,21,23,26,27,28]);
export function intendedCloudShading(style) {
  return SCULPTED_LOOK_IDS.includes(Number(style)) ? 'sculpted' : Object.hasOwn(REFERENCE_LOOK_PRESETS,style) ? 'soft' : 'auto';
}
