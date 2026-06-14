import * as BABYLON from 'babylonjs';
import { NoiseComputeBuilder } from './noiseCompute.js';
import {
  PLANET_GRADIENTS,
  generatePlanetMeshGpu,
  createBabylonPlanetMeshes,
} from '../planet/planetGpuMesh';
import { AtmosphericScatteringPostProcess } from '../planet/atmosphericScattering';
import {
  PLANET_CLOUD_FLAT_LAB_PRESET,
  PLANET_CLOUD_NOISE,
  createPlanetCloudLayer,
  updatePlanetCloudLayer,
  updatePlanetCloudLayerOptions,
  disposePlanetCloudLayer,
} from '../clouds/planetClouds.js';

const DEFAULT_SEGMENTS = 1000;
const DEFAULT_RADIUS = 50;
const DEFAULT_HEIGHT_SCALE = 1.15;
const MAX_VERTICES_PER_PARTITION = 8_000_000;
const DEFAULT_RANDOMIZE_NOISE = false;
const DEFAULT_ATMOSPHERE_ENABLED = true;
const DEFAULT_ATMOSPHERE_HEIGHT = 14;
const DEFAULT_ATMOSPHERE_RADIUS_PAD = 4;

function clonePlain(value) {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = clonePlain(v);
    return out;
  }
  return value;
}

function mergePlain(base, override) {
  const out = clonePlain(base || {});
  if (!override || typeof override !== 'object') return out;
  for (const [k, v] of Object.entries(override)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = mergePlain(out[k], v);
    } else {
      out[k] = clonePlain(v);
    }
  }
  return out;
}

export const NOISE_PARAM_FULL_DEFAULTS = Object.freeze({
  seed: 123456789,
  zoom: 1.0,
  freq: 1.0,
  octaves: 6,
  lacunarity: 2.0,
  gain: 0.5,
  xShift: 0.0,
  yShift: 0.0,
  zShift: 0.0,
  turbulence: 0,
  seedAngle: Math.PI / 2,
  exp1: 1.0,
  exp2: 0.0,
  threshold: 0.1,
  rippleFreq: 10.0,
  time: 0.0,
  warpAmp: 0.0,
  gaborRadius: 4.0,
  terraceStep: 8.0,
  toroidal: 0,
  voroMode: 0,
  edgeK: 0.0,
  scalar: 1.0,
  transform: 0.0,
});

export const NOISE_COMPUTE_OPTION_DEFAULTS = Object.freeze({
  getGradient: 0,
  outputChannel: 1,
  baseRadius: 0,
  heightScale: 1,
  useCustomPos: 0,
  ioFlags: 0,
  sphereOffset: 0,
  sphereOffset2: 0,
  toroidal: 0,
  textureKey: null,
  id: null,
  viewDimension: '2d-array',
  frameFullWidth: null,
  frameFullHeight: null,
  frameFullDepth: null,
  worldMode: 'stretch',
  noiseChoices: [],
});

export const NOISE_MODE_OPTIONS = Object.freeze([
  'clearTexture',
  'computePerlin',
  'computeBillow',
  'computeAntiBillow',
  'computeRidge',
  'computeAntiRidge',
  'computeRidgedMultifractal',
  'computeRidgedMultifractal2',
  'computeRidgedMultifractal3',
  'computeRidgedMultifractal4',
  'computeAntiRidgedMultifractal',
  'computeAntiRidgedMultifractal2',
  'computeAntiRidgedMultifractal3',
  'computeAntiRidgedMultifractal4',
  'computeFBM',
  'computeFBM2',
  'computeFBM3',
  'computeCellularBM1',
  'computeCellularBM2',
  'computeCellularBM3',
  'computeVoronoiBM1',
  'computeVoronoiBM2',
  'computeVoronoiBM3',
  'computeCellular',
  'computeWorley',
  'computeAntiCellular',
  'computeAntiWorley',
  'computeLanczosBillow',
  'computeLanczosAntiBillow',
  'computeVoronoiTileNoise',
  'computeVoronoiCircleNoise',
  'computeVoronoiCircle2',
  'computeVoronoiFlatShade',
  'computeVoronoiRipple3D',
  'computeVoronoiRipple3D2',
  'computeVoronoiCircularRipple',
  'computeFVoronoiRipple3D',
  'computeFVoronoiCircularRipple',
  'computeRippleNoise',
  'computeFractalRipples',
  'computeHexWorms',
  'computePerlinWorms',
  'computeWhiteNoise',
  'computeBlueNoise',
  'computeSimplex',
  'computeSimplexFBM',
  'computeCurl2D',
  'computeCurlFBM2D',
  'computeDomainWarpFBM1',
  'computeDomainWarpFBM2',
  'computeGaborAnisotropic',
  'computeGaborMagic',
  'computeGaborFlow',
  'computeTerraceNoise',
  'computeFoamNoise',
  'computeTurbulence',
  'computePerlin4D',
  'computeWorley4D',
  'computeAntiWorley4D',
  'computeCellular4D',
  'computeAntiCellular4D',
  'computeBillow4D',
  'computeAntiBillow4D',
  'computeLanczosBillow4D',
  'computeLanczosAntiBillow4D',
  'computeFBM4D',
  'computeVoronoi4D',
  'computeVoronoiBM1_4D',
  'computeVoronoiBM2_4D',
  'computeVoronoiBM3_4D',
  'computeVoronoiBM1_4D_vec',
  'computeVoronoiBM2_4D_vec',
  'computeVoronoiBM3_4D_vec',
  'computeWorleyBM1_4D',
  'computeWorleyBM2_4D',
  'computeWorleyBM3_4D',
  'computeWorleyBM1_4D_vec',
  'computeWorleyBM2_4D_vec',
  'computeWorleyBM3_4D_vec',
  'computeCellularBM1_4D',
  'computeCellularBM2_4D',
  'computeCellularBM3_4D',
  'computeCellularBM1_4D_vec',
  'computeCellularBM2_4D_vec',
  'computeCellularBM3_4D_vec',
  'computeTerraceNoise4D',
  'computeFoamNoise4D',
  'computeTurbulence4D',
  'computeSmokeNoise',
  'computeTerrainNoise',
  'FractalBrownianMotion',
  'FractalBrownianMotion2',
  'VoronoiTileNoise',
  'RidgedMultifractalNoise4',
  'LanczosBillowNoise',
]);

export const TEXTURE_MODE_OPTIONS = Object.freeze(
  NOISE_MODE_OPTIONS.filter((mode) => mode.startsWith('compute')),
);

export const PLANET_LAYER_MODE_OPTIONS = Object.freeze([
  'FractalBrownianMotion',
  'FractalBrownianMotion2',
  'VoronoiTileNoise',
  'RidgedMultifractalNoise4',
  'LanczosBillowNoise',
]);

export const VORO_MODE_REFERENCE = Object.freeze({
  0: 'cell value / granite',
  1: 'F1 nearest-feature distance',
  2: 'interior gap F2-F1',
  3: 'edges = clamp(gap * edgeK)',
  4: 'edge threshold: gap >= threshold ? gap : 0',
  5: 'flat shade cells=1 edges=0',
  6: 'flat shade inverted',
  7: 'squared interior gap',
  8: 'squared edges',
  9: 'squared edge threshold',
  10: 'squared flat shade',
  11: 'squared flat shade inverted',
  12: 'F1 threshold',
  13: 'F1 mask smooth threshold..threshold+edgeK',
  14: 'inverted F1 mask',
  15: 'reciprocal edge falloff',
  16: 'squared reciprocal edge falloff',
});

export const CLOUD_LIGHTING_COLOR_PRESETS = Object.freeze({
  0: {
    sky: [0.56, 0.72, 1.02],
    sunBloom: 0.18,
    sunTint: [1.00, 0.99, 0.97],
    transmissiveLightTint: [0.96, 0.98, 1.06],
    frontLightTint: [1.22, 1.20, 1.16],
    volumeShadowTint: [0.72, 0.80, 0.94],
    directLightBlend: 0.84,
    directLightBoost: 0.64,
    cloudLitTint: [1.08, 1.08, 1.09],
    cloudShadowTint: [0.80, 0.88, 0.98],
    edgeTint: [1.06, 1.05, 1.03],
    styleShadowStrength: 2.30,
    styleShadowEdge: 0.44,
    styleShadowDarkness: 0.10,
    styleColorLift: 1.18,
    styleSaturation: 0.98,
    styleMidLift: 1.12,
    godRaysEnabled: true,
    godRayStrength: 0.58,
    godRayLength: 1.0,
    godRayFalloff: 1.62,
  },
  1: {
    sky: [0.44, 0.24, 0.56],
    sunBloom: 0.70,
    sunTint: [1.34, 1.04, 0.52],
    transmissiveLightTint: [1.12, 0.70, 0.46],
    frontLightTint: [1.68, 1.34, 0.82],
    volumeShadowTint: [0.18, 0.10, 0.24],
    directLightBlend: 0.84,
    directLightBoost: 0.94,
    cloudLitTint: [1.62, 1.12, 0.62],
    cloudShadowTint: [0.24, 0.12, 0.30],
    edgeTint: [1.42, 1.02, 0.52],
    styleShadowStrength: 2.10,
    styleShadowEdge: 0.56,
    styleShadowDarkness: 0.16,
    styleColorLift: 1.30,
    styleSaturation: 1.78,
    styleMidLift: 0.98,
    godRaysEnabled: true,
    godRayStrength: 0.66,
    godRayLength: 1.10,
    godRayFalloff: 1.18,
  },
  2: {
    sky: [0.46, 0.40, 0.74],
    sunBloom: 0.54,
    sunTint: [1.02, 0.92, 1.06],
    transmissiveLightTint: [0.88, 0.80, 1.10],
    frontLightTint: [1.36, 1.14, 1.40],
    volumeShadowTint: [0.30, 0.26, 0.56],
    directLightBlend: 0.82,
    directLightBoost: 0.84,
    cloudLitTint: [1.20, 0.98, 1.18],
    cloudShadowTint: [0.34, 0.28, 0.66],
    edgeTint: [1.14, 0.96, 1.18],
    styleShadowStrength: 1.70,
    styleShadowEdge: 0.18,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.18,
    styleSaturation: 1.26,
    styleMidLift: 1.18,
    godRaysEnabled: true,
    godRayStrength: 0.70,
    godRayLength: 1.02,
    godRayFalloff: 1.42,
  },
  3: {
    sky: [0.46, 0.56, 0.82],
    sunBloom: 0.34,
    sunTint: [0.96, 1.00, 1.04],
    transmissiveLightTint: [0.96, 1.04, 1.30],
    frontLightTint: [1.44, 1.42, 1.38],
    volumeShadowTint: [0.28, 0.36, 0.52],
    directLightBlend: 0.92,
    directLightBoost: 1.02,
    cloudLitTint: [1.42, 1.34, 1.28],
    cloudShadowTint: [0.72, 0.84, 1.08],
    edgeTint: [1.22, 1.22, 1.18],
    styleShadowStrength: 2.56,
    styleShadowEdge: 0.48,
    styleShadowDarkness: 0.12,
    styleColorLift: 1.18,
    styleSaturation: 1.06,
    styleMidLift: 1.00,
    godRaysEnabled: true,
    godRayStrength: 0.38,
    godRayLength: 0.94,
    godRayFalloff: 1.86,
  },
  4: {
    sky: [0.42, 0.30, 0.42],
    sunBloom: 0.58,
    sunTint: [1.12, 0.82, 0.62],
    transmissiveLightTint: [0.98, 0.54, 0.32],
    frontLightTint: [1.58, 1.04, 0.62],
    volumeShadowTint: [0.18, 0.08, 0.10],
    directLightBlend: 0.88,
    directLightBoost: 1.00,
    cloudLitTint: [1.34, 0.80, 0.42],
    cloudShadowTint: [0.16, 0.08, 0.10],
    edgeTint: [1.34, 0.92, 0.56],
    styleShadowStrength: 2.12,
    styleShadowEdge: 0.34,
    styleShadowDarkness: 0.28,
    styleColorLift: 1.10,
    styleSaturation: 1.74,
    styleMidLift: 1.00,
    godRaysEnabled: true,
    godRayStrength: 0.88,
    godRayLength: 0.96,
    godRayFalloff: 1.36,
  },
  5: {
    sky: [0.50, 0.34, 0.64],
    sunBloom: 0.58,
    sunTint: [1.10, 0.84, 0.86],
    transmissiveLightTint: [0.96, 0.70, 0.98],
    frontLightTint: [1.42, 1.00, 1.20],
    volumeShadowTint: [0.28, 0.18, 0.52],
    directLightBlend: 0.82,
    directLightBoost: 0.86,
    cloudLitTint: [1.26, 0.88, 1.02],
    cloudShadowTint: [0.34, 0.24, 0.60],
    edgeTint: [1.20, 0.86, 1.00],
    styleShadowStrength: 1.24,
    styleShadowEdge: 0.12,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.28,
    styleSaturation: 1.32,
    styleMidLift: 1.30,
    godRaysEnabled: true,
    godRayStrength: 0.72,
    godRayLength: 1.02,
    godRayFalloff: 1.34,
  },
  6: {
    sky: [0.52, 0.42, 0.30],
    sunBloom: 0.62,
    sunTint: [1.24, 0.96, 0.62],
    transmissiveLightTint: [1.04, 0.82, 0.44],
    frontLightTint: [1.54, 1.14, 0.64],
    volumeShadowTint: [0.20, 0.12, 0.08],
    directLightBlend: 0.84,
    directLightBoost: 0.90,
    cloudLitTint: [1.36, 1.00, 0.56],
    cloudShadowTint: [0.20, 0.14, 0.10],
    edgeTint: [1.38, 1.06, 0.64],
    styleShadowStrength: 1.42,
    styleShadowEdge: 0.26,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.22,
    styleSaturation: 1.52,
    styleMidLift: 0.96,
    godRaysEnabled: true,
    godRayStrength: 0.66,
    godRayLength: 1.06,
    godRayFalloff: 1.26,
  },
  7: {
    sky: [0.22, 0.34, 0.54],
    sunBloom: 0.42,
    sunTint: [0.76, 1.06, 1.22],
    transmissiveLightTint: [0.62, 0.98, 1.18],
    frontLightTint: [0.98, 1.40, 1.56],
    volumeShadowTint: [0.08, 0.16, 0.28],
    directLightBlend: 0.82,
    directLightBoost: 0.82,
    cloudLitTint: [0.90, 1.22, 1.42],
    cloudShadowTint: [0.10, 0.18, 0.30],
    edgeTint: [0.84, 1.38, 1.58],
    styleShadowStrength: 1.48,
    styleShadowEdge: 0.30,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.06,
    styleSaturation: 1.46,
    styleMidLift: 1.10,
    godRaysEnabled: true,
    godRayStrength: 0.42,
    godRayLength: 0.94,
    godRayFalloff: 1.66,
  },
  8: {
    sky: [0.22, 0.54, 0.50],
    sunBloom: 0.52,
    sunTint: [0.88, 1.14, 0.98],
    transmissiveLightTint: [0.58, 1.06, 0.92],
    frontLightTint: [1.02, 1.46, 1.16],
    volumeShadowTint: [0.08, 0.24, 0.22],
    directLightBlend: 0.84,
    directLightBoost: 0.88,
    cloudLitTint: [0.92, 1.34, 1.08],
    cloudShadowTint: [0.12, 0.26, 0.24],
    edgeTint: [0.78, 1.52, 1.16],
    styleShadowStrength: 1.22,
    styleShadowEdge: 0.20,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.34,
    styleSaturation: 1.60,
    styleMidLift: 1.20,
    godRaysEnabled: true,
    godRayStrength: 0.58,
    godRayLength: 1.16,
    godRayFalloff: 1.44,
  },
  9: {
    sky: [0.58, 0.50, 0.36],
    sunBloom: 0.46,
    sunTint: [1.18, 1.08, 0.74],
    transmissiveLightTint: [0.98, 0.88, 0.50],
    frontLightTint: [1.44, 1.28, 0.84],
    volumeShadowTint: [0.22, 0.18, 0.12],
    directLightBlend: 0.80,
    directLightBoost: 0.76,
    cloudLitTint: [1.28, 1.10, 0.72],
    cloudShadowTint: [0.26, 0.22, 0.16],
    edgeTint: [1.34, 1.14, 0.78],
    styleShadowStrength: 1.54,
    styleShadowEdge: 0.40,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.00,
    styleSaturation: 1.08,
    styleMidLift: 0.80,
    godRaysEnabled: false,
    godRayStrength: 0.22,
    godRayLength: 0.86,
    godRayFalloff: 1.96,
  },
  10: {
    sky: [0.44, 0.28, 0.38],
    sunBloom: 0.68,
    sunTint: [1.16, 0.82, 0.88],
    transmissiveLightTint: [0.96, 0.60, 0.88],
    frontLightTint: [1.46, 1.04, 1.18],
    volumeShadowTint: [0.18, 0.10, 0.22],
    directLightBlend: 0.84,
    directLightBoost: 0.80,
    cloudLitTint: [1.32, 0.90, 0.98],
    cloudShadowTint: [0.22, 0.12, 0.26],
    edgeTint: [1.40, 0.96, 1.10],
    styleShadowStrength: 1.34,
    styleShadowEdge: 0.26,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.22,
    styleSaturation: 1.42,
    styleMidLift: 1.18,
    godRaysEnabled: true,
    godRayStrength: 0.60,
    godRayLength: 1.00,
    godRayFalloff: 1.34,
  },
  11: {
    sky: [0.14, 0.22, 0.42],
    sunBloom: 0.38,
    sunTint: [0.62, 0.86, 1.30],
    transmissiveLightTint: [0.42, 0.74, 1.18],
    frontLightTint: [0.86, 1.16, 1.56],
    volumeShadowTint: [0.02, 0.06, 0.18],
    directLightBlend: 0.82,
    directLightBoost: 0.80,
    cloudLitTint: [0.78, 1.00, 1.42],
    cloudShadowTint: [0.04, 0.08, 0.20],
    edgeTint: [0.74, 1.02, 1.60],
    styleShadowStrength: 1.70,
    styleShadowEdge: 0.48,
    styleShadowDarkness: 0.0,
    styleColorLift: 0.96,
    styleSaturation: 1.34,
    styleMidLift: 0.72,
    godRaysEnabled: false,
    godRayStrength: 0.18,
    godRayLength: 0.82,
    godRayFalloff: 2.14,
  },
  12: {
    sky: [0.36, 0.66, 1.24],
    sunBloom: 0.26,
    sunTint: [1.16, 1.04, 0.88],
    transmissiveLightTint: [1.16, 1.07, 0.96],
    frontLightTint: [1.42, 1.28, 1.10],
    volumeShadowTint: [0.96, 0.86, 0.74],
    directLightBlend: 0.86,
    directLightBoost: 0.92,
    cloudLitTint: [1.30, 1.18, 1.02],
    cloudShadowTint: [1.02, 0.92, 0.80],
    edgeTint: [1.34, 1.20, 1.02],
    styleShadowStrength: 1.12,
    styleShadowEdge: 0.14,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.42,
    styleSaturation: 1.14,
    styleMidLift: 1.46,
    godRaysEnabled: true,
    godRayStrength: 0.52,
    godRayLength: 0.98,
    godRayFalloff: 1.62,
  },
  13: {
    sky: [0.30, 0.62, 1.28],
    sunBloom: 0.30,
    sunTint: [1.18, 1.05, 0.90],
    transmissiveLightTint: [1.18, 1.08, 0.98],
    frontLightTint: [1.48, 1.32, 1.14],
    volumeShadowTint: [0.98, 0.88, 0.78],
    directLightBlend: 0.90,
    directLightBoost: 1.02,
    cloudLitTint: [1.34, 1.22, 1.06],
    cloudShadowTint: [1.04, 0.94, 0.84],
    edgeTint: [1.38, 1.24, 1.06],
    styleShadowStrength: 1.04,
    styleShadowEdge: 0.12,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.48,
    styleSaturation: 1.14,
    styleMidLift: 1.52,
    godRaysEnabled: true,
    godRayStrength: 0.58,
    godRayLength: 1.02,
    godRayFalloff: 1.48,
  },
  14: {
    sky: [0.70, 0.76, 0.94],
    sunBloom: 0.18,
    sunTint: [0.98, 0.98, 0.98],
    transmissiveLightTint: [0.94, 0.98, 1.08],
    frontLightTint: [1.14, 1.14, 1.14],
    volumeShadowTint: [0.54, 0.60, 0.74],
    directLightBlend: 0.80,
    directLightBoost: 0.54,
    cloudLitTint: [1.06, 1.06, 1.06],
    cloudShadowTint: [0.68, 0.74, 0.86],
    edgeTint: [1.04, 1.04, 1.04],
    styleShadowStrength: 1.92,
    styleShadowEdge: 0.32,
    styleShadowDarkness: 0.10,
    styleColorLift: 1.10,
    styleSaturation: 0.80,
    styleMidLift: 1.00,
    godRaysEnabled: false,
    godRayStrength: 0.18,
    godRayLength: 0.90,
    godRayFalloff: 1.86,
  },
  15: {
    sky: [0.08, 0.18, 0.72],
    sunBloom: 0.42,
    sunTint: [1.24, 0.84, 0.78],
    transmissiveLightTint: [0.06, 1.70, 0.20],
    frontLightTint: [2.20, 0.10, 0.08],
    volumeShadowTint: [0.04, 0.12, 1.70],
    directLightBlend: 0.74,
    directLightBoost: 1.08,
    cloudLitTint: [2.05, 0.12, 0.10],
    cloudShadowTint: [0.04, 0.12, 1.58],
    edgeTint: [0.08, 1.86, 0.18],
    styleShadowStrength: 1.54,
    styleShadowEdge: 0.18,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.18,
    styleSaturation: 2.20,
    styleMidLift: 0.92,
    godRaysEnabled: true,
    godRayStrength: 0.42,
    godRayLength: 1.00,
    godRayFalloff: 1.42,
  },
});

export const CLOUD_COLOR_PRESET_LABELS = Object.freeze({
  0: '0 Default Gray',
  1: '1 Sunset Punch',
  2: '2 Dusky Purple',
  3: '3 Storm Cool',
  4: '4 Firestorm',
  5: '5 Ember Violet',
  6: '6 Solar Copper',
  7: '7 Moonlit Cyan',
  8: '8 Aurora Teal',
  9: '9 Ash Gold',
  10: '10 Rose Storm',
  11: '11 Deep Ocean',
  12: '12 Natural Daylight',
  13: '13 Silver Daylight',
  14: '14 Soft Overcast',
  15: '15 RGB Spectrum',
});





function makeFullNoiseLayer(config = {}) {
  return mergePlain(NOISE_PARAM_FULL_DEFAULTS, config);
}

export const NOISE_PLANET_TEST_NOISE = {
  randomizeNoise: DEFAULT_RANDOMIZE_NOISE,
  zoomFactor: 2.4,
  defaultConfigOverrides: {
    threshold: 0.3,
    voroMode: 2,
  },
  paramDefaults: clonePlain(NOISE_PARAM_FULL_DEFAULTS),
  computeOptions: clonePlain(NOISE_COMPUTE_OPTION_DEFAULTS),
  availableModes: clonePlain(NOISE_MODE_OPTIONS),
  voroModeReference: clonePlain(VORO_MODE_REFERENCE),
  enabled: {
    FractalBrownianMotion: true,
    FractalBrownianMotion2: true,
    VoronoiTileNoise: true,
    RidgedMultifractalNoise4: true,
    LanczosBillowNoise: true,
  },
};

export const NOISE_PLANET_TEST_CLOUDS = {
  enabled: true,

  // Cloud shell thickness above the planet surface.
  shell: {
    cloudBottom: 1.25,
    cloudTop: 3.65,
    maxHalfHeight: 0.25,
  },

  // Texture sizes, cloud render resolution, and update cadence.
  textures: {
    weatherWidth: 1024,
    weatherHeight: 1024,
    shapeSize: 128,
    detailSize: 32,
    blueWidth: 256,
    blueHeight: 256,
    renderScaleDivider: 2,
    updateEvery: 1,
    outputFormat: 'rgba16float',
  },

  // Animation and explicit offset evolution for each texture field.
  // Weather controls coverage motion; shape/detail control the body and edge structure.
  motion: {
    animate: true,
    spinSpeed: 0.001,
    meridionalDrift: 0.0,
    shapeSpinFactor: 0.82,
    detailSpinFactor: 0.93,
    offsets: {
      weatherOffsetWorld: [0.0, 0.0, 0.0],
      shapeOffsetWorld: [0.0, 0.0, 0.0],
      detailOffsetWorld: [0.0, 0.0, 0.0],
    },
    velocities: {
      weather: [0.001, 0.0, 0.0],
      shape: [0.002, 0.0, 0.0],
      detail: [0.001, 0.0, 0.0],
    },
  },

  // Domain transforms and biasing. Axis scales stay explicit so noodly stretch is easy to tame.
  transforms: {
    shapeScale: 0.05,
    detailScale: 1.75,
    weatherScale: 0.92,
    shapeAxisScale: [1.0, 1.0, 1.0],
    detailAxisScale: [1.0, 1.0, 1.0],
    weatherAxisScale: [1.0, 1.0, 1.0],
    shapeBias: 0.08,
    detailBias: 0.02,
    weatherBias: 0.34,
  },

  // Per-texture noise settings, fully decoupled from the planet terrain zoom.
  noise: {
    weather: {
      ...clonePlain(NOISE_PARAM_FULL_DEFAULTS),
      enabled: true,
      mode: 'computeFBM',
      seed: 123456789001,
      zoom: 1.0,
      freq: 1.35,
      octaves: 6,
      lacunarity: 2.0,
      seedAngle: Math.PI / 2,
      gain: 0.5,
      threshold: 0.1,
      time: 0.0,
      voroMode: 4,
      edgeK: 0.0,
      warpAmp: 0.0,
    },
    weatherG: {
      ...clonePlain(NOISE_PARAM_FULL_DEFAULTS),
      enabled: true,
      mode: 'computeBillow',
      seed: 123456789000,
      scale: 1.0,
      zoom: 16.0,
      freq: 1.9,
      octaves: 4,
      lacunarity: 2.0,
      seedAngle: Math.PI / 2,
      gain: 0.5,
      threshold: 0.1,
      time: 0.0,
      voroMode: 4,
      edgeK: 0.0,
      warpAmp: 0.0,
    },
    weatherB: {
      ...clonePlain(NOISE_PARAM_FULL_DEFAULTS),
      enabled: false,
      mode: 'computeBillow',
      seed: 123456789003,
      scale: 1.0,
      zoom: 16.0,
      freq: 1.9,
      octaves: 4,
      lacunarity: 2.0,
      seedAngle: Math.PI / 2,
      gain: 0.5,
      threshold: 0.1,
      time: 0.0,
      voroMode: 4,
      edgeK: 0.0,
      warpAmp: 0.0,
    },
    shape: {
      ...clonePlain(NOISE_PARAM_FULL_DEFAULTS),
      seed: 123456789002,
      zoom: 4.0,
      freq: 1.0,
      octaves: 2,
      lacunarity: 2.0,
      seedAngle: Math.PI / 2,
      gain: 0.5,
      threshold: 0.1,
      time: 0.0,
      voroMode: 4,
      edgeK: 0.0,
      warpAmp: 0.0,
      baseModeA: 'computeAntiWorley4D',
      baseModeB: 'computeAntiWorley4D',
      bandMode2: 'computeAntiWorley4D',
      bandMode3: 'computeAntiWorley4D',
      bandMode4: 'computeAntiWorley4D',
    },
    detail: {
      ...clonePlain(NOISE_PARAM_FULL_DEFAULTS),
      seed: 123456789003,
      zoom: 4.0,
      freq: 1.0,
      octaves: 4,
      lacunarity: 2.0,
      seedAngle: Math.PI / 2,
      gain: 0.5,
      threshold: 0.1,
      time: 0.0,
      voroMode: 4,
      edgeK: 0.0,
      warpAmp: 0.0,
      mode1: 'computeWorley4D',
      mode2: 'computeWorley4D',
      mode3: 'computeWorley4D',
    },
    blue: {
      ...clonePlain(NOISE_PARAM_FULL_DEFAULTS),
      seed: 123456789004,
    },
  },

  // Cloud density, phase, and lighting uniforms from CloudComputeBuilder.setParams.
  params: {
    globalCoverage: 1.0,
    globalDensity: 1325.0,
    cloudAnvilAmount: 0.24,
    cloudBeer: 6.8,
    attenuationClamp: 0.015,
    inScatterG: 0.55,
    silverIntensity: 1.72,
    silverExponent: 2.45,
    outScatterG: 0.08,
    inVsOut: 0.55,
    outScatterAmbientAmt: 0.035,
    ambientMinimum: 0.022,
    sunColor: [1.0, 0.985, 0.95],
    frontLightColor: [1.30, 1.30, 1.22],
    shadowLightColor: [0.34, 0.42, 0.56],
    densityDivMin: 0.001,
    silverDirectionBias: 0.9,
    silverHorizonBoost: 0.35,
  },

  // Marching, LOD, lighting performance, fluff, alpha, and style controls from CloudComputeBuilder.setTuning.
  tuning: {
    maxSteps: 144,
    minStep: 0.0025,
    maxStep: 0.185,
    sunSteps: 3,
    sunStride: 6,
    sunMinTr: 0.003,
    phaseJitter: 0.06,
    stepJitter: 0.008,
    baseJitterFrac: 0.010,
    topJitterFrac: 0.045,
    lodBiasWeather: 1.5,
    aabbFaceOffset: 0.0015,
    weatherRejectGate: 0.985,
    weatherRejectMip: 1.0,
    emptySkipMult: 6.8,
    nearFluffDist: 60.0,
    nearStepScale: 0.30,
    nearLodBias: -1.5,
    nearDensityMult: 2.9,
    nearDensityRange: 45.0,
    lodBlendThreshold: 0.46,
    sunDensityGate: 0.0025,
    fflyRelClamp: 1.6,
    fflyAbsFloor: 0.85,
    taaRelMin: 0.22,
    taaRelMax: 1.1,
    taaAbsEps: 0.02,
    farStart: 1.05,
    farFull: 4.2,
    farLodPush: 0.55,
    farDetailAtten: 0.72,
    farStepMult: 2.55,
    bnFarScale: 0.28,
    farTaaHistoryBoost: 1.8,
    raySmoothDens: 0.46,
    raySmoothSun: 0.54,
    fluffFactor: 3.4,
    anvilLift: 0.6,
    alphaCutoff: 0.985,
    thickBoxPerf: 0.65,
    thickStepBoost: 1.74,
    thickDetailSkip: 0.26,
    thickLightSkip: 0.46,
    verticalStepBoost: 3.0,
    verticalTextureHomogeneity: 0.46,
    verticalLightingStepBoost: 1.35,
    frontOcclusionStrength: 0.82,
    frontOcclusionAlpha: 0.58,
    frontOcclusionStepBoost: 4.2,
    sliceJitterStrength: 0.0008,
    verticalLayerDecorrelation: 0.22,
    directLightBlend: 0.94,
    directLightBoost: 0.96,
    alphaBoostThreshold: 0.20,
    alphaBoostAmount: 0.14,
    minOutputAlpha: 0.18,
    outputAlphaFeather: 0.42,
    sparsity: 0.32,
    definition: 0.76,
  },

  // Flat-demo style x4 temporal interleave is ON by default.
  // First dispatch fills history at full coverage; following frames update 1/4 of pixels.
  reprojection: {
    enabled: 1,
    subsample: 1,
    sampleOffset: 0,
    motionIsNormalized: 0,
    temporalBlend: 0.978,
    depthTest: 0,
    depthTolerance: 0.0,
    frameIndex: 0,
    fullWidth: 0,
    fullHeight: 0,
    temporalCellRate: 4,
    temporalCellPhase: 0,
    compactInterleave: 1,
  },

  // Extra shader performance knobs from CloudComputeBuilder.setPerfParams.
  performance: {
    lodBiasMul: 1.0,
    coarseMipBias: 0.0,
    coarseFactor: 2,
  },

  // Shell ray setup and overlay composite controls.
  render: {
    worldToUV: null,
    stepBase: 0.034,
    stepInc: 0.044,
    opacity: 1.06,
    alphaPower: 1.16,
    alphaCutoff: 0.02,
  },

  // Flat-lab preview/style knobs kept here as notes/targets for matching lighting/color presets.
  style: {
    exposure: 1.18,
    sky: [0.60, 0.75, 0.98],
    colorPresetId: 3,
    sunTint: [1.0, 1.0, 1.0],
    transmissiveLightTint: [0.94, 1.00, 1.08],
    frontLightTint: [1.18, 1.24, 1.32],
    volumeShadowTint: [0.60, 0.68, 0.82],
    cloudLitTint: [1.0, 1.0, 1.0],
    cloudShadowTint: [0.0, 0.0, 0.0],
    edgeTint: [1.0, 1.0, 1.0],
    styleShadowStrength: 1.0,
    styleShadowEdge: 1.0,
    styleShadowDarkness: 0.5,
    styleColorLift: 1.28,
    styleSaturation: 1.24,
    styleRimStrength: 0.1,
    styleSunBleed: 0.1,
    styleMidLift: 1.26,
    alphaFloor: 0.0,
    fogDensity: 0.34,
    fogHorizon: 0.30,
    fogSun: 1.50,
    godRaysEnabled: true,
    godRayStrength: 1.0,
    godRayLength: 1.10,
    godRayFalloff: 1.10,
  },
};


export const NOISE_PLANET_TEST_AURORA = mergePlain(NOISE_PLANET_TEST_CLOUDS, {
  enabled: true,
  shell: {
    cloudBottom: 4.35,
    cloudTop: 6.65,
    maxHalfHeight: 0.25,
  },
  cap: {
    halfAngleDeg: 16.5,
    featherDeg: 9.0,
    hemisphere: 'north',
  },
  textures: {
    weatherWidth: 1024,
    weatherHeight: 1024,
    shapeSize: 96,
    detailSize: 32,
    blueWidth: 256,
    blueHeight: 256,
    renderScaleDivider: 2,
    updateEvery: 2,
  },
  motion: {
    animate: true,
    spinSpeed: 0.0038,
    meridionalDrift: 0.0,
    shapeSpinFactor: 1.12,
    detailSpinFactor: 1.24,
    offsets: {
      weatherOffsetWorld: [0.0, 0.0, 0.0],
      shapeOffsetWorld: [0.0, 0.0, 0.0],
      detailOffsetWorld: [0.0, 0.0, 0.0],
    },
    velocities: {
      weather: [0.0038, 0.0, 0.0],
      shape: [0.0044, 0.0, 0.0],
      detail: [0.0048, 0.0, 0.0],
    },
  },
  transforms: {
    weatherScale: 0.50,
    shapeScale: 0.10,
    detailScale: 2.40,
    weatherAxisScale: [1.0, 1.0, 1.0],
    shapeAxisScale: [1.0, 0.36, 1.0],
    detailAxisScale: [1.0, 0.44, 1.0],
    weatherBias: 0.10,
    shapeBias: 0.10,
    detailBias: 0.01,
  },
  noise: {
    weather: {
      ...clonePlain(NOISE_PARAM_FULL_DEFAULTS),
      enabled: true,
      mode: 'computeFBM4D',
      seed: 123456789101,
      zoom: 0.30,
      freq: 1.22,
      octaves: 8,
      lacunarity: 2.0,
      seedAngle: Math.PI / 2,
      gain: 0.58,
      threshold: 0.06,
      time: 0.0,
      voroMode: 4,
      edgeK: 0.0,
      warpAmp: 0.0,
    },
    weatherG: {
      ...clonePlain(NOISE_PARAM_FULL_DEFAULTS),
      enabled: true,
      mode: 'computeBillow4D',
      seed: 123456789102,
      scale: 1.0,
      zoom: 0.36,
      freq: 1.55,
      octaves: 4,
      lacunarity: 2.0,
      seedAngle: Math.PI / 2,
      gain: 0.5,
      threshold: 0.08,
      time: 0.0,
      voroMode: 4,
      edgeK: 0.0,
      warpAmp: 0.0,
    },
    weatherB: {
      ...clonePlain(NOISE_PARAM_FULL_DEFAULTS),
      enabled: false,
      mode: 'computeBillow4D',
      seed: 123456789103,
      scale: 1.0,
      zoom: 0.46,
      freq: 1.10,
      octaves: 3,
      lacunarity: 2.0,
      seedAngle: Math.PI / 2,
      gain: 0.5,
      threshold: 0.08,
      time: 0.0,
      voroMode: 4,
      edgeK: 0.0,
      warpAmp: 0.0,
    },
    shape: {
      ...clonePlain(NOISE_PARAM_FULL_DEFAULTS),
      seed: 123456789104,
      zoom: 2.2,
      freq: 1.0,
      octaves: 4,
      lacunarity: 2.0,
      seedAngle: Math.PI / 2,
      gain: 0.56,
      threshold: 0.08,
      time: 0.0,
      voroMode: 4,
      edgeK: 0.0,
      warpAmp: 0.0,
      baseModeA: 'computeFBM4D',
      baseModeB: 'computeFBM4D',
      bandMode2: 'computeFBM4D',
      bandMode3: 'computeFBM4D',
      bandMode4: 'computeFBM4D',
    },
    detail: {
      ...clonePlain(NOISE_PARAM_FULL_DEFAULTS),
      seed: 123456789105,
      zoom: 3.4,
      freq: 1.0,
      octaves: 4,
      lacunarity: 2.0,
      seedAngle: Math.PI / 2,
      gain: 0.5,
      threshold: 0.10,
      time: 0.0,
      voroMode: 4,
      edgeK: 0.0,
      warpAmp: 0.0,
      mode1: 'computeBillow4D',
      mode2: 'computeWorley4D',
      mode3: 'computeBillow4D',
    },
    blue: {
      ...clonePlain(NOISE_PARAM_FULL_DEFAULTS),
      seed: 123456789106,
    },
  },
  params: {
    globalCoverage: 1.12,
    globalDensity: 980.0,
    cloudAnvilAmount: 0.0,
    cloudBeer: 4.0,
    attenuationClamp: 0.010,
    inScatterG: 0.18,
    silverIntensity: 0.28,
    silverExponent: 1.20,
    outScatterG: 0.04,
    inVsOut: 0.92,
    outScatterAmbientAmt: 0.24,
    ambientMinimum: 0.12,
    sunColor: [0.70, 1.00, 0.98],
    frontLightColor: [0.40, 1.28, 1.02],
    shadowLightColor: [0.16, 0.26, 0.34],
    densityDivMin: 0.001,
    silverDirectionBias: 0.10,
    silverHorizonBoost: 0.10,
  },
  tuning: {
    maxSteps: 112,
    minStep: 0.0025,
    maxStep: 0.16,
    nearStepScale: 0.32,
    nearDensityMult: 1.85,
    farDetailAtten: 0.82,
    fluffFactor: 1.40,
    anvilLift: 0.34,
    directLightBlend: 0.34,
    directLightBoost: 1.22,
    alphaBoostThreshold: 0.12,
    alphaBoostAmount: 0.22,
    minOutputAlpha: 0.08,
    outputAlphaFeather: 0.58,
    sparsity: 0.66,
    definition: 0.92,
  },
  performance: {
    lodBiasMul: 0.92,
    coarseMipBias: 0.0,
    coarseFactor: 2,
  },
  reprojection: {
    enabled: 1,
    subsample: 1,
    sampleOffset: 0,
    motionIsNormalized: 0,
    temporalBlend: 0.965,
    depthTest: 0,
    depthTolerance: 0.0,
    frameIndex: 0,
    fullWidth: 0,
    fullHeight: 0,
    temporalCellRate: 4,
    temporalCellPhase: 0,
    compactInterleave: 1,
  },
  render: {
    worldToUV: 0.46,
    stepBase: 0.024,
    stepInc: 0.026,
    opacity: 0.84,
    alphaPower: 1.36,
    alphaCutoff: 0.006,
  },
  style: {
    exposure: 1.10,
    sky: [0.16, 0.22, 0.34],
    colorPresetId: 'aurora',
    auroraBrightness: 2.6,
    auroraColor: [0.36, 1.00, 0.78],
    auroraShadowColor: [0.44, 0.36, 1.00],
    sunTint: [0.78, 1.00, 0.96],
    transmissiveLightTint: [0.48, 1.10, 0.90],
    frontLightTint: [0.48, 1.34, 1.02],
    volumeShadowTint: [0.04, 0.12, 0.18],
    cloudLitTint: [0.64, 1.30, 1.08],
    cloudShadowTint: [0.08, 0.20, 0.24],
    edgeTint: [1.12, 0.60, 1.18],
    styleShadowStrength: 0.38,
    styleShadowEdge: 0.18,
    styleShadowDarkness: 0.0,
    styleColorLift: 1.52,
    styleSaturation: 1.76,
    styleRimStrength: 0.32,
    styleSunBleed: 0.0,
    styleMidLift: 1.42,
    alphaFloor: 0.0,
    fogDensity: 0.06,
    fogHorizon: 0.06,
    fogSun: 0.22,
    godRaysEnabled: false,
    godRayStrength: 0.0,
    godRayLength: 1.0,
    godRayFalloff: 1.0,
  },
});

NOISE_PLANET_TEST_CLOUDS.aurora = clonePlain(NOISE_PLANET_TEST_AURORA);

function defaultAuroraConfig() {
  return clonePlain(NOISE_PLANET_TEST_AURORA);
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSignedMagnitude(rng, magnitude) {
  return (rng() < 0.5 ? -1 : 1) * rng() * magnitude;
}

function boolOverride(options, key, fallback) {
  if (typeof options[key] === 'boolean') return options[key];
  if (options.noiseSelection && typeof options.noiseSelection[key] === 'boolean') return options.noiseSelection[key];
  if (options.enabledNoise && typeof options.enabledNoise[key] === 'boolean') return options.enabledNoise[key];
  return fallback;
}

export function createNoisePlanetConfigSet(seed, options = {}) {
  const rng = mulberry32(seed);
  const zoomFactor = options.zoomFactor ?? NOISE_PLANET_TEST_NOISE.zoomFactor;
  const configOverrides = mergePlain(
    NOISE_PLANET_TEST_NOISE.defaultConfigOverrides,
    options.defaultConfigOverrides,
  );
  const paramDefaults = mergePlain(
    NOISE_PLANET_TEST_NOISE.paramDefaults || NOISE_PARAM_FULL_DEFAULTS,
    options.paramDefaults,
  );
  const offset = options.offset ?? pickSignedMagnitude(rng, 0.3);
  const offset2 = options.offset2 ?? pickSignedMagnitude(rng, 0.1);
  const randomizer1 = options.randomizer1 ?? (rng() * 0.4 - 0.2);
  const randomizer2 = options.randomizer2 ?? (rng() * 0.2 - 0.1);
  const randomizer3 = options.randomizer3 ?? (rng() * 0.2 - 0.1);

  const allConfigs = [
    {
      key: 'FractalBrownianMotion',
      config: {
        type: 'FractalBrownianMotion',
        scalar: 0.75,
        zoom: zoomFactor * 0.8,
        octaves: 6,
        lacunarity: 2.0,
        gain: 0.5,
        xShift: randomizer3 + 2.0,
        yShift: randomizer3 + 2.0,
        zShift: randomizer3 + 2.0,
        frequency: 1,
        threshold: configOverrides.threshold,
        voroMode: configOverrides.voroMode,
      },
    },
    {
      key: 'FractalBrownianMotion2',
      config: {
        type: 'FractalBrownianMotion2',
        scalar: 0.75,
        zoom: zoomFactor * 1.0,
        octaves: 8,
        lacunarity: 2.0,
        gain: 0.5,
        xShift: randomizer3 + 1.3,
        yShift: randomizer3 + 1.3,
        zShift: randomizer3 + 1.3,
        frequency: 1,
        threshold: configOverrides.threshold,
        voroMode: configOverrides.voroMode,
      },
    },
    {
      key: 'VoronoiTileNoise',
      config: {
        type: 'VoronoiTileNoise',
        scalar: 0.9,
        zoom: zoomFactor * 0.35,
        octaves: 2,
        lacunarity: 2.0,
        gain: 0.5,
        xShift: randomizer1 + 0.65,
        yShift: randomizer1 + 0.65,
        zShift: randomizer1 + 0.65,
        frequency: 1,
        threshold: configOverrides.threshold,
        voroMode: configOverrides.voroMode,
      },
    },
    {
      key: 'RidgedMultifractalNoise4',
      config: {
        type: 'RidgedMultifractalNoise4',
        zoom: zoomFactor * 0.2,
        octaves: 6,
        lacunarity: 2.1,
        gain: 0.5,
        xShift: randomizer1 + 0.65,
        yShift: randomizer1 + 0.65,
        zShift: randomizer1 + 0.65,
        frequency: 1,
        threshold: configOverrides.threshold,
        voroMode: configOverrides.voroMode,
      },
    },
    {
      key: 'LanczosBillowNoise',
      config: {
        type: 'LanczosBillowNoise',
        zoom: zoomFactor * 0.5,
        octaves: 6,
        lacunarity: 2.0,
        gain: 0.5,
        xShift: randomizer2 + 0.65,
        yShift: randomizer2 + 0.65,
        zShift: randomizer2 + 0.65,
        frequency: 1,
        threshold: configOverrides.threshold,
        voroMode: configOverrides.voroMode,
      },
    },
  ];

  if (Array.isArray(options.noiseConfigs) && options.noiseConfigs.length) {
    return {
      seed,
      noiseConfigs: options.noiseConfigs.map((cfg) => mergePlain(paramDefaults, cfg)),
      offset,
      offset2,
      randomizer1,
      randomizer2,
      randomizer3,
      labels: options.noiseConfigs.map(formatNoiseConfigLabel),
    };
  }

  const randomizeNoise = options.randomizeNoise ?? NOISE_PLANET_TEST_NOISE.randomizeNoise;
  const selection = {};
  for (const item of allConfigs) {
    const defaultEnabled = NOISE_PLANET_TEST_NOISE.enabled[item.key] !== false;
    selection[item.key] = randomizeNoise ? rng() > 0.35 : defaultEnabled;
    selection[item.key] = boolOverride(options, item.key, selection[item.key]);
  }

  if (!Object.values(selection).some(Boolean)) {
    selection.FractalBrownianMotion = true;
    selection.RidgedMultifractalNoise4 = true;
  }

  const noiseConfigs = allConfigs
    .filter((item) => selection[item.key])
    .map((item) => mergePlain(paramDefaults, item.config));

  return {
    seed,
    noiseConfigs,
    offset,
    offset2,
    randomizer1,
    randomizer2,
    randomizer3,
    labels: allConfigs.map((item) => `${item.key}: ${selection[item.key] ? 'on' : 'off'} ${formatNoiseConfigInline(item.config)}`),
  };
}

function formatNoiseConfigInline(config) {
  const parts = [
    `zoom=${Number(config.zoom ?? 1).toFixed(3)}`,
    `oct=${config.octaves ?? 6}`,
    `lac=${Number(config.lacunarity ?? 2).toFixed(2)}`,
    `gain=${Number(config.gain ?? 0.5).toFixed(2)}`,
  ];
  if (config.scalar !== undefined) parts.push(`scalar=${Number(config.scalar).toFixed(2)}`);
  return `(${parts.join(', ')})`;
}

function formatNoiseConfigLabel(config) {
  return `${config.type || 'unknown'} ${formatNoiseConfigInline(config)}`;
}


function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function gradientIndexFromOptions(options = {}, fallback = null) {
  const raw = options.gradientIndex ?? options.gradient ?? fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(PLANET_GRADIENTS.length - 1, Math.floor(n))) : null;
}

function currentGradientForEditors(fallback = null) {
  const candidates = [
    fallback,
    window.noisePlanetTestRender?.currentGradientIndex,
    window.noisePlanetTestLastSnapshot?.gradientIndex,
  ];
  for (const candidate of candidates) {
    const n = Number(candidate);
    if (Number.isFinite(n)) return Math.max(0, Math.min(PLANET_GRADIENTS.length - 1, Math.floor(n)));
  }
  return null;
}

function planetGradientOptions() {
  return PLANET_GRADIENTS.map((g, index) => ({
    value: index,
    label: `${index} ${g?.name || `Gradient ${index}`}`,
  }));
}

function makePlanetRenderEditorOptions(options = {}) {
  return {
    seed: options.seed ?? null,
    segments: options.segments ?? DEFAULT_SEGMENTS,
    heightScale: options.heightScale ?? DEFAULT_HEIGHT_SCALE,
    gradientIndex: gradientIndexFromOptions(options, null),
    normalMode: options.normalMode ?? 'sphere',
    flipGpuNormals: options.flipGpuNormals ?? false,
    canonicalizeSeams: options.canonicalizeSeams ?? true,
    canonicalizePoles: options.canonicalizePoles ?? true,
    polarCapMode: options.polarCapMode ?? 'fan',
    polarBlendRows: options.polarBlendRows ?? 8,
    polarBlendStrength: options.polarBlendStrength ?? 0.90,
    allowFlatHeightmap: options.allowFlatHeightmap ?? false,
    maxVerticesPerPartition: options.maxVerticesPerPartition ?? MAX_VERTICES_PER_PARTITION,
    useGpuSpherePositionMode: options.useGpuSpherePositionMode ?? true,
    partitionSkirts: options.partitionSkirts ?? true,
    partitionSkirtDepth: options.partitionSkirtDepth ?? null,
    doubleSidedPartitionSkirts: options.doubleSidedPartitionSkirts ?? true,
    color: mergePlain({ autoRange: true }, options.color || {}),
    atmosphere: options.atmosphere === false ? false : mergePlain({
      enabled: DEFAULT_ATMOSPHERE_ENABLED,
      height: DEFAULT_ATMOSPHERE_HEIGHT,
      falloffFactor: 15,
      intensity: 15,
      scatteringStrength: 1,
      densityModifier: 1,
      randomizeWavelengths: true,
    }, typeof options.atmosphere === 'object' ? options.atmosphere : {}),
  };
}

function makePlanetNoiseEditorOptions(options = {}) {
  return mergePlain(NOISE_PLANET_TEST_NOISE, options.planetNoise || options.noise || {});
}

function makePlanetNoiseStackEditorOptions(options = {}) {
  if (Array.isArray(options.noiseConfigs)) return clonePlain(options.noiseConfigs.map(makeFullNoiseLayer));
  const seed = Math.floor(options.seed ?? 123456789);
  const generated = createNoisePlanetConfigSet(seed, {
    randomizeNoise: DEFAULT_RANDOMIZE_NOISE,
    ...options,
  });
  return clonePlain(generated.noiseConfigs || []);
}

function makeCloudEditorOptions(options = {}) {
  const merged = mergePlain(NOISE_PLANET_TEST_CLOUDS, typeof options.clouds === 'object' ? options.clouds : {});
  if (!merged.aurora || typeof merged.aurora !== 'object') {
    merged.aurora = defaultAuroraConfig();
  } else {
    merged.aurora = mergePlain(defaultAuroraConfig(), merged.aurora);
  }
  return merged;
}

function makeFullControlReferenceOptions() {
  return {
    noiseComputeBuilder: {
      paramsAcceptedBySetNoiseParams: clonePlain(NOISE_PARAM_FULL_DEFAULTS),
      optionsAcceptedBySetOptions: clonePlain(NOISE_COMPUTE_OPTION_DEFAULTS),
      availableModeNames: clonePlain(NOISE_MODE_OPTIONS),
      voroModeReference: clonePlain(VORO_MODE_REFERENCE),
      note: 'Any of these params can be placed on a planet stack layer or on cloud noise.weather/weatherG/weatherB/shape/detail/blue.',
    },
    auroraCloudConfig: {
      editableBlock: 'clouds.aurora',
      note: 'Aurora is a second spherical cloud volume above the main cloud layer. It has its own shell, cap, weather/shape/detail noise, motion, render, and style blocks.',
    },
    planetNoiseConfig: {
      editableBlock: 'NOISE_PLANET_TEST_NOISE',
      generatedStackUses: ['zoomFactor', 'paramDefaults', 'defaultConfigOverrides', 'enabled'],
      explicitStackOverride: 'NOISE_PLANET_TEST_CLOUDS is independent; planet noise stack non-empty overrides generated stack exactly.',
    },
    cloudComputeBuilder: {
      shell: ['cloudBottom', 'cloudTop'],
      textures: ['weatherWidth', 'weatherHeight', 'shapeSize', 'detailSize', 'blueWidth', 'blueHeight', 'renderScaleDivider', 'updateEvery', 'outputFormat'],
      motion: ['animate', 'spinSpeed', 'meridionalDrift', 'shapeSpinFactor', 'detailSpinFactor', 'offsets.weatherOffsetWorld', 'offsets.shapeOffsetWorld', 'offsets.detailOffsetWorld', 'velocities.weather', 'velocities.shape', 'velocities.detail'],
      transformsAcceptedBySetNoiseTransforms: ['shapeOffsetWorld', 'detailOffsetWorld', 'weatherOffsetWorld', 'shapeScale', 'detailScale', 'weatherScale', 'shapeAxisScale', 'detailAxisScale', 'weatherAxisScale', 'shapeBias', 'detailBias', 'weatherBias'],
      paramsAcceptedBySetParams: Object.keys(PLANET_CLOUD_FLAT_LAB_PRESET.params),
      tuningAcceptedBySetTuning: Object.keys(PLANET_CLOUD_FLAT_LAB_PRESET.tuning),
      reprojectionAcceptedBySetReprojSettings: ['enabled', 'subsample', 'sampleOffset', 'motionIsNormalized', 'temporalBlend', 'depthTest', 'depthTolerance', 'frameIndex', 'fullWidth', 'fullHeight', 'temporalCellRate', 'temporalCellPhase', 'compactInterleave'],
      performanceAcceptedBySetPerfParams: ['lodBiasMul', 'coarseMipBias', 'coarseFactor'],
      overlayRender: ['worldToUV', 'stepBase', 'stepInc', 'opacity', 'alphaPower', 'alphaCutoff'],
    },
  };
}

function checkMissingKeys(label, obj, reference, out = []) {
  if (!reference || typeof reference !== 'object') return out;
  if (!obj || typeof obj !== 'object') {
    out.push(`${label}: missing object`);
    return out;
  }
  for (const key of Object.keys(reference)) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) out.push(`${label}.${key}`);
  }
  return out;
}

function validateTweakCoverageSnapshot(snapshot) {
  const missing = [];
  const warnings = [];
  const stack = Array.isArray(snapshot.planetStack) ? snapshot.planetStack : [];
  stack.forEach((layer, i) => checkMissingKeys(`planetStack[${i}]`, layer, NOISE_PARAM_FULL_DEFAULTS, missing));

  const noise = snapshot.planetNoise || {};
  checkMissingKeys('planetNoise.paramDefaults', noise.paramDefaults, NOISE_PARAM_FULL_DEFAULTS, missing);
  checkMissingKeys('planetNoise.computeOptions', noise.computeOptions, NOISE_COMPUTE_OPTION_DEFAULTS, missing);

  const clouds = snapshot.clouds || {};
  for (const section of ['shell', 'textures', 'motion', 'transforms', 'noise', 'params', 'tuning', 'reprojection', 'performance', 'render', 'style']) {
    if (!clouds[section]) missing.push(`clouds.${section}`);
  }
  if (!clouds.aurora) {
    warnings.push('clouds.aurora block missing');
  } else {
    for (const section of ['shell', 'cap', 'textures', 'motion', 'transforms', 'noise', 'params', 'tuning', 'reprojection', 'performance', 'render', 'style']) {
      if (!clouds.aurora[section]) missing.push(`clouds.aurora.${section}`);
    }
  }
  for (const key of ['weather', 'weatherG', 'weatherB', 'shape', 'detail', 'blue']) {
    checkMissingKeys(`clouds.noise.${key}`, clouds.noise?.[key], NOISE_PARAM_FULL_DEFAULTS, missing);
  }
  checkMissingKeys('clouds.params', clouds.params, NOISE_PLANET_TEST_CLOUDS.params, missing);
  checkMissingKeys('clouds.tuning', clouds.tuning, NOISE_PLANET_TEST_CLOUDS.tuning, missing);
  checkMissingKeys('clouds.reprojection', clouds.reprojection, NOISE_PLANET_TEST_CLOUDS.reprojection, missing);
  checkMissingKeys('clouds.performance', clouds.performance, NOISE_PLANET_TEST_CLOUDS.performance, missing);
  checkMissingKeys('clouds.render', clouds.render, NOISE_PLANET_TEST_CLOUDS.render, missing);
  checkMissingKeys('clouds.style', clouds.style, NOISE_PLANET_TEST_CLOUDS.style, missing);

  if (clouds.shell && Number(clouds.shell.cloudTop) <= Number(clouds.shell.cloudBottom)) {
    warnings.push('clouds.shell.cloudTop should be greater than cloudBottom');
  }
  return { ok: missing.length === 0, missing, warnings };
}

function createEditorBlock(title, description, initialValue, rows = 12) {
  const wrap = document.createElement('details');
  wrap.open = false;
  wrap.style.cssText = [
    'border:1px solid rgba(255,255,255,0.14)',
    'border-radius:7px',
    'background:rgba(255,255,255,0.045)',
    'overflow:hidden',
  ].join(';');

  const summary = document.createElement('summary');
  summary.textContent = title;
  summary.style.cssText = [
    'cursor:pointer',
    'padding:5px 6px',
    'font-weight:700',
    'letter-spacing:0.01em',
    'user-select:none',
  ].join(';');

  const body = document.createElement('div');
  body.style.cssText = 'display:grid;gap:5px;padding:0 6px 6px';

  const desc = document.createElement('div');
  desc.textContent = description;
  desc.style.cssText = 'color:rgba(226,238,255,0.62);font-size:10px;line-height:1.25';

  const textarea = document.createElement('textarea');
  textarea.value = stableJson(initialValue);
  textarea.spellcheck = false;
  textarea.rows = rows;
  textarea.style.cssText = [
    'width:100%',
    'box-sizing:border-box',
    'resize:vertical',
    'min-height:190px',
    'border:1px solid rgba(255,255,255,0.16)',
    'border-radius:6px',
    'background:rgba(0,0,0,0.52)',
    'color:#eaf2ff',
    'padding:5px',
    'font:10px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    'outline:none',
  ].join(';');

  const error = document.createElement('div');
  error.style.cssText = 'display:none;color:#ffaaa8;font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap';

  textarea.addEventListener('input', () => {
    error.style.display = 'none';
    wrap.dataset.dirty = '1';
  });

  body.append(desc, textarea, error);
  wrap.append(summary, body);

  return {
    element: wrap,
    textarea,
    error,
    get value() {
      return JSON.parse(textarea.value);
    },
    setValue(value) {
      textarea.value = stableJson(value);
      error.style.display = 'none';
      delete wrap.dataset.dirty;
    },
    showError(err) {
      error.textContent = err?.message || String(err);
      error.style.display = 'block';
      wrap.open = true;
      textarea.focus();
    },
  };
}

function getPathValue(obj, path, fallback = undefined) {
  const parts = String(path).split('.');
  let cur = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object' || !(part in cur)) return fallback;
    cur = cur[part];
  }
  return cur;
}

function setPathValue(obj, path, value) {
  const parts = String(path).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cur[key] || typeof cur[key] !== 'object' || Array.isArray(cur[key])) cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

function isCloudTextureBakePath(path = '') {
  const p = String(path);
  if (!p) return false;

  // These paths change baked weather/shape/detail/blue textures and should not
  // be live-applied as uniform-only updates.
  if (p === 'seed' || p.startsWith('noise.')) return true;

  const textureBakePaths = new Set([
    'textures.weatherWidth',
    'textures.weatherHeight',
    'textures.shapeSize',
    'textures.detailSize',
    'textures.blueWidth',
    'textures.blueHeight',
    'textures.outputFormat',
  ]);
  return textureBakePaths.has(p);
}

function makeCompactInput({ label, value, type = 'number', step = 'any', min = null, max = null, options = null, onChange }) {
  const isSelect = Array.isArray(options);
  const isCheckbox = type === 'checkbox';
  const wrap = document.createElement('label');
  wrap.style.cssText = isSelect
    ? 'display:grid;gap:2px;min-width:0;grid-column:1/-1;font-size:10px;color:rgba(226,238,255,0.68)'
    : 'display:grid;grid-template-columns:minmax(68px,1fr) minmax(46px,76px);gap:4px;align-items:center;min-width:0;font-size:10px;color:rgba(226,238,255,0.68)';

  const caption = document.createElement('span');
  caption.textContent = label;
  caption.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

  let input;
  if (isSelect) {
    input = document.createElement('select');
    for (const opt of options) {
      const option = document.createElement('option');
      if (typeof opt === 'object' && opt) {
        option.value = String(opt.value);
        option.textContent = String(opt.label ?? opt.value);
      } else {
        option.value = String(opt);
        option.textContent = String(opt);
      }
      input.appendChild(option);
    }
    input.value = String(value ?? (options[0]?.value ?? options[0] ?? ''));
  } else {
    input = document.createElement('input');
    input.type = type;
    if (type === 'number') input.step = step;
    if (min !== null) input.min = String(min);
    if (max !== null) input.max = String(max);
    if (isCheckbox) input.checked = !!value;
    else input.value = value ?? '';
  }

  input.style.cssText = [
    'min-width:0',
    'width:100%',
    'box-sizing:border-box',
    'border:1px solid rgba(255,255,255,0.16)',
    'border-radius:5px',
    'background:rgba(0,0,0,0.42)',
    'color:#e8eefc',
    'padding:2px 4px',
    'font:10px/1.15 system-ui,sans-serif',
    'outline:none',
  ].join(';');
  if (isSelect) input.style.minHeight = '24px';
  if (isCheckbox) {
    input.style.width = '14px';
    input.style.height = '14px';
    input.style.justifySelf = 'end';
    input.style.accentColor = '#84b8ff';
  }

  input.addEventListener('change', () => {
    let next;
    if (isCheckbox) next = !!input.checked;
    else if (type === 'number') {
      next = Number(input.value);
      if (!Number.isFinite(next)) next = 0;
    } else {
      next = input.value;
    }
    onChange?.(next, input);
  });

  wrap.append(caption, input);
  return { wrap, input };
}

function makeCompactControlPanel(title, desc = '') {
  const box = document.createElement('div');
  box.style.cssText = [
    'display:grid',
    'gap:4px',
    'padding:5px',
    'border:1px solid rgba(255,255,255,0.12)',
    'border-radius:7px',
    'background:rgba(255,255,255,0.035)',
    'margin-bottom:5px',
  ].join(';');

  const head = document.createElement('div');
  head.innerHTML = `<b>${title}</b>${desc ? `<br><span>${desc}</span>` : ''}`;
  head.style.cssText = 'font-size:10px;line-height:1.18';
  const span = head.querySelector('span');
  if (span) span.style.cssText = 'color:rgba(226,238,255,0.58);font-size:9px';

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:4px;align-items:start';

  box.append(head, grid);
  return { box, grid };
}


function colorVec3FromPreset(v, fallback) {
  return Array.isArray(v) ? [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0] : fallback.slice();
}

function mulVec3Local(a, b, c = [1, 1, 1]) {
  return [
    (Number(a?.[0]) || 0) * (Number(b?.[0]) || 0) * (Number(c?.[0]) || 0),
    (Number(a?.[1]) || 0) * (Number(b?.[1]) || 0) * (Number(c?.[1]) || 0),
    (Number(a?.[2]) || 0) * (Number(b?.[2]) || 0) * (Number(c?.[2]) || 0),
  ];
}

function cloudColorPresetToConfigPatch(presetId) {
  const id = String(presetId ?? '3').split(':')[0].trim();
  const preset = CLOUD_LIGHTING_COLOR_PRESETS[id] || CLOUD_LIGHTING_COLOR_PRESETS[Number(id)] || CLOUD_LIGHTING_COLOR_PRESETS[3] || {};
  const sunColorByPreset = {
    1: [1.06, 0.82, 0.68],
    2: [1.00, 0.80, 1.00],
    3: [0.92, 0.96, 1.0],
    4: [1.12, 0.74, 0.44],
    5: [1.06, 0.80, 0.76],
    6: [1.18, 0.86, 0.52],
    7: [0.70, 1.02, 1.18],
    8: [0.82, 1.12, 0.94],
    9: [1.12, 1.02, 0.68],
    10: [1.14, 0.74, 0.82],
    11: [0.62, 0.84, 1.22],
    12: [0.86, 0.96, 1.14],
    13: [0.76, 0.92, 1.20],
    14: [0.96, 0.98, 1.02],
    15: [1.34, 0.10, 0.08],
  };
  const baseSun = sunColorByPreset[Number(id)] || [1.0, 0.95, 0.87];
  const sunTint = colorVec3FromPreset(preset.sunTint, [1, 1, 1]);
  const litTint = colorVec3FromPreset(preset.cloudLitTint, [1, 1, 1]);
  const shadowTint = colorVec3FromPreset(preset.cloudShadowTint, [0.62, 0.68, 0.78]);
  const transmissiveTint = colorVec3FromPreset(preset.transmissiveLightTint, sunTint);
  const frontTint = colorVec3FromPreset(preset.frontLightTint, [
    Math.max(1.0, litTint[0] * 0.72 + sunTint[0] * 0.40),
    Math.max(1.0, litTint[1] * 0.72 + sunTint[1] * 0.40),
    Math.max(1.0, litTint[2] * 0.72 + sunTint[2] * 0.40),
  ]);
  const volumeShadowTint = colorVec3FromPreset(preset.volumeShadowTint, shadowTint);

  const tuningPatch = {};
  if (Number.isFinite(Number(preset.directLightBlend))) tuningPatch.directLightBlend = Number(preset.directLightBlend);
  if (Number.isFinite(Number(preset.directLightBoost))) tuningPatch.directLightBoost = Number(preset.directLightBoost);

  return {
    params: {
      sunColor: mulVec3Local(baseSun, sunTint, transmissiveTint),
      frontLightColor: mulVec3Local(baseSun, sunTint, frontTint),
      shadowLightColor: volumeShadowTint,
      sunBloom: preset.sunBloom ?? 0.18,
    },
    tuning: tuningPatch,
    style: {
      colorPresetId: Number(id),
      colorPresetLabel: CLOUD_COLOR_PRESET_LABELS[id] || `Preset ${id}`,
      colorPresetSource: 'flat-cloud-test-v-grade',
      exposure: preset.exposure ?? 1.18,
      sky: colorVec3FromPreset(preset.sky, [0.56, 0.72, 1.02]),
      sunTint,
      transmissiveLightTint: transmissiveTint,
      frontLightTint: frontTint,
      volumeShadowTint,
      directLightBlend: tuningPatch.directLightBlend ?? 0.78,
      directLightBoost: tuningPatch.directLightBoost ?? 0.58,
      cloudLitTint: litTint,
      cloudShadowTint: shadowTint,
      edgeTint: colorVec3FromPreset(preset.edgeTint, [1, 1, 1]),
      styleShadowStrength: preset.styleShadowStrength ?? 1.0,
      styleShadowEdge: preset.styleShadowEdge ?? 1.0,
      styleShadowDarkness: preset.styleShadowDarkness ?? 0.5,
      styleColorLift: preset.styleColorLift ?? 1.0,
      styleSaturation: preset.styleSaturation ?? 1.0,
      styleRimStrength: preset.styleRimStrength ?? 1.0,
      styleSunBleed: preset.styleSunBleed ?? 0.85,
      styleMidLift: preset.styleMidLift ?? 1.0,
      alphaFloor: preset.alphaFloor ?? 0.0,
      fogDensity: preset.fogDensity ?? 0.34,
      fogHorizon: preset.fogHorizon ?? 0.30,
      fogSun: preset.fogSun ?? 1.50,
      godRaysEnabled: preset.godRaysEnabled ?? true,
      godRayStrength: preset.godRayStrength ?? 0.0,
      godRayLength: preset.godRayLength ?? 1.0,
      godRayFalloff: preset.godRayFalloff ?? 1.0,
    },
  };
}

function makeNoiseLayerFromMode(mode, overrides = {}) {
  const templateMap = {
    FractalBrownianMotion: {
      type: 'FractalBrownianMotion',
      scalar: 0.75,
      zoom: 2.4,
      octaves: 6,
      lacunarity: 2.0,
      gain: 0.5,
      xShift: 2.0,
      yShift: 2.0,
      zShift: 2.0,
      frequency: 1,
      threshold: 0.3,
      voroMode: 2,
    },
    FractalBrownianMotion2: {
      type: 'FractalBrownianMotion2',
      scalar: 0.75,
      zoom: 2.4,
      octaves: 8,
      lacunarity: 2.0,
      gain: 0.5,
      xShift: 1.3,
      yShift: 1.3,
      zShift: 1.3,
      frequency: 1,
      threshold: 0.3,
      voroMode: 2,
    },
    VoronoiTileNoise: {
      type: 'VoronoiTileNoise',
      scalar: 0.9,
      zoom: 0.84,
      octaves: 2,
      lacunarity: 2.0,
      gain: 0.5,
      xShift: 0.65,
      yShift: 0.65,
      zShift: 0.65,
      frequency: 1,
      threshold: 0.3,
      voroMode: 2,
    },
    RidgedMultifractalNoise4: {
      type: 'RidgedMultifractalNoise4',
      zoom: 0.48,
      octaves: 6,
      lacunarity: 2.1,
      gain: 0.5,
      xShift: 0.65,
      yShift: 0.65,
      zShift: 0.65,
      frequency: 1,
      threshold: 0.3,
      voroMode: 2,
    },
    LanczosBillowNoise: {
      type: 'LanczosBillowNoise',
      zoom: 1.2,
      octaves: 6,
      lacunarity: 2.0,
      gain: 0.5,
      xShift: 0.65,
      yShift: 0.65,
      zShift: 0.65,
      frequency: 1,
      threshold: 0.3,
      voroMode: 2,
    },
  };
  return makeFullNoiseLayer(mergePlain(templateMap[mode] || { type: mode }, overrides));
}


function createTweakPanel(options = {}) {
  const panel = document.createElement('section');
  panel.id = 'noise-planet-tweak-panel';
  panel.style.cssText = [
    'display:block',
    'gap:4px',
    'margin-top:5px',
    'padding-top:5px',
    'border-top:1px solid rgba(255,255,255,0.14)',
    'color:#e8eefc',
    'box-sizing:border-box',
    'min-height:0',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px';

  const title = document.createElement('div');
  title.innerHTML = '<strong>Planet + Cloud Mixer</strong><br><span>Texture and stack changes rebake manually.</span>';
  title.style.cssText = 'font-size:11px;line-height:1.2';
  title.querySelector('span').style.cssText = 'color:rgba(226,238,255,0.62);font-size:10px';

  const collapse = document.createElement('button');
  collapse.type = 'button';
  collapse.textContent = 'Hide';
  collapse.style.cssText = 'border:1px solid rgba(255,255,255,0.18);border-radius:6px;background:rgba(255,255,255,0.08);color:#e8eefc;padding:3px 6px;font-size:10px;cursor:pointer';

  const body = document.createElement('div');
  body.style.cssText = [
    'display:block',
    'min-height:0',
  ].join(';');

  const tabRow = document.createElement('div');
  tabRow.style.cssText = [
    'display:flex',
    'gap:4px',
    'flex-wrap:wrap',
    'padding:1px 0 3px',
  ].join(';');

  const sectionHost = document.createElement('div');
  sectionHost.style.cssText = [
    'display:block',
    'min-height:0',
    'max-height:none',
    'overflow:visible',
    'padding-right:0',
  ].join(';');

  const planetRender = createEditorBlock(
    'Planet render / mesh / atmosphere',
    'Top-level rebake options. Radius is fixed by scene creation; most mesh/atmosphere settings apply on rebake.',
    makePlanetRenderEditorOptions(options),
    16,
  );
  planetRender.element.open = false;

  const planetNoise = createEditorBlock(
    'Planet noise globals',
    'Global controls used to generate the stack below when the stack is empty or regenerated. Includes zoomFactor, randomizeNoise, threshold/voro defaults, enabled flags.',
    makePlanetNoiseEditorOptions(options),
    12,
  );
  planetNoise.element.open = false;

  const planetStack = createEditorBlock(
    'Advanced planet stack JSON',
    'Exact terrain layer array.',
    makePlanetNoiseStackEditorOptions(options),
    18,
  );
  planetStack.element.open = false;

  const stackTools = document.createElement('div');
  stackTools.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px';

  const stackTemplates = {
    FBM: {
      type: 'FractalBrownianMotion',
      scalar: 0.75,
      zoom: 2.4,
      octaves: 6,
      lacunarity: 2.0,
      gain: 0.5,
      xShift: 2.0,
      yShift: 2.0,
      zShift: 2.0,
      frequency: 1,
      threshold: 0.3,
      voroMode: 2,
    },
    Voronoi: {
      type: 'VoronoiTileNoise',
      scalar: 0.9,
      zoom: 0.84,
      octaves: 2,
      lacunarity: 2.0,
      gain: 0.5,
      xShift: 0.65,
      yShift: 0.65,
      zShift: 0.65,
      frequency: 1,
      threshold: 0.3,
      voroMode: 2,
    },
    Ridged: {
      type: 'RidgedMultifractalNoise4',
      zoom: 0.48,
      octaves: 6,
      lacunarity: 2.1,
      gain: 0.5,
      xShift: 0.65,
      yShift: 0.65,
      zShift: 0.65,
      frequency: 1,
      threshold: 0.3,
      voroMode: 2,
    },
    Billow: {
      type: 'LanczosBillowNoise',
      zoom: 1.2,
      octaves: 6,
      lacunarity: 2.0,
      gain: 0.5,
      xShift: 0.65,
      yShift: 0.65,
      zShift: 0.65,
      frequency: 1,
      threshold: 0.3,
      voroMode: 2,
    },
  };

  function getStackForEdit() {
    const parsed = planetStack.value;
    return Array.isArray(parsed) ? parsed : [];
  }

  function makeSmallButton(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = 'border:1px solid rgba(255,255,255,0.16);border-radius:7px;background:rgba(255,255,255,0.06);color:#e8eefc;padding:5px 7px;font:11px system-ui,sans-serif;cursor:pointer';
    button.addEventListener('click', () => {
      try {
        handler();
        planetStack.error.style.display = 'none';
      } catch (err) {
        planetStack.showError(err);
      }
    });
    return button;
  }

  for (const [label, template] of Object.entries(stackTemplates)) {
    stackTools.appendChild(makeSmallButton(`+ ${label}`, () => {
      const stack = getStackForEdit();
      stack.push(makeFullNoiseLayer(template));
      planetStack.setValue(stack);
      status.textContent = `Added ${label} layer to the planet stack. Click Rebake JSON to apply.`;
    }));
  }

  stackTools.appendChild(makeSmallButton('Duplicate last', () => {
    const stack = getStackForEdit();
    if (!stack.length) throw new Error('Planet stack is empty; add a layer first.');
    stack.push(makeFullNoiseLayer(stack[stack.length - 1]));
    planetStack.setValue(stack);
    status.textContent = 'Duplicated last planet stack layer. Click Rebake JSON to apply.';
  }));

  stackTools.appendChild(makeSmallButton('Clear stack', () => {
    planetStack.setValue([]);
    status.textContent = 'Cleared planet stack. Rebake will regenerate from planet noise globals.';
  }));

  const clouds = createEditorBlock(
    'Spherical cloud settings',
    'All cloud shell, texture, motion, transform, per-texture noise, lighting, marching, interleave, and overlay settings.',
    makeCloudEditorOptions(options),
    24,
  );
  clouds.element.open = false;

  const reference = createEditorBlock(
    'Full noise/cloud control reference',
    'Coverage map for the controls mirrored from the noise and cloud test apps. Reference only; edits here are not applied.',
    makeFullControlReferenceOptions(),
    22,
  );
  reference.element.open = false;
  reference.textarea.readOnly = true;

  let liveCloudApplyHandler = typeof options.onCloudLiveApply === 'function' ? options.onCloudLiveApply : null;
  let liveCloudApplyTimer = 0;
  const editorPathInputs = new WeakMap();

  function registerEditorPathInput(editor, path, control, type = 'number', index = null) {
    if (!editor || !path || !control?.input) return control;
    let map = editorPathInputs.get(editor);
    if (!map) {
      map = new Map();
      editorPathInputs.set(editor, map);
    }
    const key = String(path);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ input: control.input, type, index });
    return control;
  }

  function writeInputValue(input, type, value, index = null) {
    if (!input) return;
    if (type === 'checkbox') {
      input.checked = !!value;
      return;
    }
    if (type === 'vec3') {
      input.value = Array.isArray(value) ? value[index ?? 0] ?? 0 : 0;
      return;
    }
    input.value = value ?? '';
  }

  function syncEditorPathInputs(editor, path = '') {
    const map = editorPathInputs.get(editor);
    if (!map) return;
    let value;
    try {
      value = editor.value;
    } catch {
      return;
    }
    const syncOne = (key) => {
      const entries = map.get(key);
      if (!entries) return;
      const current = getPathValue(value, key, '');
      for (const entry of entries) writeInputValue(entry.input, entry.type, current, entry.index);
    };
    if (path && map.has(path)) {
      syncOne(path);
    } else if (!path) {
      for (const key of map.keys()) syncOne(key);
    }
  }

  function shouldLiveApplyCloudPath(path = '', meta = {}) {
    if (meta.forceCloudLiveApply) return true;
    if (!path) return false;
    return !isCloudTextureBakePath(path);
  }

  function scheduleCloudLiveApply(label, path = '', meta = {}) {
    if (!liveCloudApplyInput?.checked || !liveCloudApplyHandler) return false;
    if (!shouldLiveApplyCloudPath(path, meta)) {
      status.textContent = `${label} updated in JSON. Texture-related change; use Cloud texture rebake or Rebake same seed.`;
      return false;
    }

    window.clearTimeout(liveCloudApplyTimer);
    liveCloudApplyTimer = window.setTimeout(async () => {
      try {
        await liveCloudApplyHandler({ label, path });
        status.textContent = `${label} live-applied to existing cloud uniforms. No planet/noise texture rebake.`;
      } catch (err) {
        console.error(err);
        status.textContent = `Cloud live apply failed: ${err?.message || err}`;
      }
    }, 80);
    return true;
  }

  function updateEditorValue(editor, label, mutator, meta = {}) {
    try {
      const value = editor.value;
      mutator(value);
      editor.setValue(value);
      syncEditorPathInputs(editor, meta.path || '');
      if (editor === clouds && scheduleCloudLiveApply(label, meta.path || '', meta)) {
        status.textContent = `${label} updated; live cloud apply queued.`;
      } else {
        status.textContent = `${label} updated in editor. Click Rebake same seed to apply.`;
      }
      return true;
    } catch (err) {
      editor.showError(new Error(`${label} edit failed:\n${err.message || err}`));
      return false;
    }
  }

  function updateEditorPath(editor, path, next, label) {
    updateEditorValue(editor, label, (obj) => setPathValue(obj, path, next), { path });
  }

  const planetQuick = makeCompactControlPanel(
    'Planet quick controls',
    'Updates the planet noise globals JSON. No rebake until you click Rebake JSON.',
  );

  function addPlanetGlobalControl(path, label, type = 'number', step = 'any', opts = {}) {
    const initial = getPathValue(planetNoise.value, path, opts.fallback ?? '');
    const control = makeCompactInput({
      label,
      value: initial,
      type,
      step,
      min: opts.min ?? null,
      max: opts.max ?? null,
      options: opts.options ?? null,
      onChange: (next) => updateEditorPath(planetNoise, path, next, `Planet ${label}`),
    });
    planetQuick.grid.appendChild(control.wrap);
    registerEditorPathInput(planetNoise, path, control, type);
    return control;
  }

  addPlanetGlobalControl('zoomFactor', 'planet zoomFactor', 'number', '0.01');
  addPlanetGlobalControl('defaultConfigOverrides.threshold', 'default threshold', 'number', '0.01');
  addPlanetGlobalControl('defaultConfigOverrides.voroMode', 'default voroMode', 'number', '1', { min: 0, max: 15 });
  addPlanetGlobalControl('randomizeNoise', 'randomize', 'checkbox');

  const planetColorPanel = makeCompactControlPanel(
    'Planet color controls',
    'Gradient and color range controls used by the terrain material.',
  );

  function addPlanetRenderControl(path, label, type = 'number', step = 'any', opts = {}) {
    const initial = getPathValue(planetRender.value, path, opts.fallback ?? '');
    const control = makeCompactInput({
      label,
      value: initial,
      type,
      step,
      min: opts.min ?? null,
      max: opts.max ?? null,
      options: opts.options ?? null,
      onChange: (next) => updateEditorPath(planetRender, path, next, `Planet ${label}`),
    });
    planetColorPanel.grid.appendChild(control.wrap);
    registerEditorPathInput(planetRender, path, control, type);
    return control;
  }

  const gradientSelect = addPlanetRenderControl('gradientIndex', 'gradient', 'number', '1', {
    options: planetGradientOptions(),
  });
  addPlanetRenderControl('color.autoRange', 'autoRange', 'checkbox');
  addPlanetRenderControl('color.rangePadding', 'rangePad', 'number', '0.005', { fallback: 0.04, min: 0 });
  addPlanetRenderControl('color.minValue', 'minValue', 'number', '0.01');
  addPlanetRenderControl('color.maxValue', 'maxValue', 'number', '0.01');

  const stackQuick = makeCompactControlPanel(
    'Planet stack controls',
    'Add/remove/select explicit terrain noise layers without editing array JSON by hand.',
  );
  stackQuick.grid.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';

  const planetModeSelect = makeCompactInput({
    label: 'add noise function',
    value: 'FractalBrownianMotion',
    options: PLANET_LAYER_MODE_OPTIONS,
  });
  const addPlanetLayerButton = makeSmallButton('Add selected layer', () => {
    const stack = getStackForEdit();
    stack.push(makeNoiseLayerFromMode(planetModeSelect.input.value));
    planetStack.setValue(stack);
    refreshStackSelect(stack.length - 1);
    status.textContent = `Added ${planetModeSelect.input.value}. Click Rebake JSON to apply.`;
  });

  const stackSelectWrap = document.createElement('label');
  stackSelectWrap.style.cssText = 'display:grid;gap:2px;min-width:0;font-size:10px;color:rgba(226,238,255,0.68)';
  const stackSelectCaption = document.createElement('span');
  stackSelectCaption.textContent = 'selected layer';
  const stackSelect = document.createElement('select');
  stackSelect.style.cssText = 'min-width:0;width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,0.16);border-radius:5px;background:rgba(0,0,0,0.42);color:#e8eefc;padding:3px 5px;font:10px/1.2 system-ui,sans-serif;outline:none';
  stackSelectWrap.append(stackSelectCaption, stackSelect);

  function stackLayerLabel(layer, index) {
    return `${index}: ${layer?.type || layer?.mode || 'noise'} z=${Number(layer?.zoom ?? 1).toFixed(2)}`;
  }

  function refreshStackSelect(selectedIndex = Number(stackSelect.value || 0)) {
    const stack = getStackForEdit();
    stackSelect.textContent = '';
    if (!stack.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'empty stack';
      stackSelect.appendChild(option);
      stackSelect.disabled = true;
      return;
    }
    stackSelect.disabled = false;
    stack.forEach((layer, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = stackLayerLabel(layer, index);
      stackSelect.appendChild(option);
    });
    stackSelect.value = String(Math.max(0, Math.min(stack.length - 1, Number(selectedIndex) || 0)));
  }

  function selectedStackIndex() {
    const index = Number(stackSelect.value);
    return Number.isFinite(index) ? index : -1;
  }

  function updateSelectedStackLayer(label, mutator) {
    updateEditorValue(planetStack, label, (stack) => {
      if (!Array.isArray(stack)) throw new Error('Planet stack JSON must be an array.');
      const index = selectedStackIndex();
      if (index < 0 || index >= stack.length) throw new Error('No stack layer selected.');
      mutator(stack[index], stack, index);
    });
    refreshStackSelect(selectedStackIndex());
  }

  const selectedType = makeCompactInput({
    label: 'selected type',
    value: 'FractalBrownianMotion',
    options: PLANET_LAYER_MODE_OPTIONS,
    onChange: (next) => updateSelectedStackLayer('Planet stack type', (layer) => { layer.type = next; }),
  });
  const selectedZoom = makeCompactInput({
    label: 'selected zoom',
    value: 1,
    type: 'number',
    step: '0.01',
    onChange: (next) => updateSelectedStackLayer('Planet stack zoom', (layer) => { layer.zoom = next; }),
  });
  const selectedThreshold = makeCompactInput({
    label: 'selected threshold',
    value: 0.3,
    type: 'number',
    step: '0.01',
    onChange: (next) => updateSelectedStackLayer('Planet stack threshold', (layer) => { layer.threshold = next; }),
  });
  const selectedVoro = makeCompactInput({
    label: 'selected voroMode',
    value: 2,
    type: 'number',
    step: '1',
    min: 0,
    max: 15,
    onChange: (next) => updateSelectedStackLayer('Planet stack voroMode', (layer) => { layer.voroMode = next; }),
  });

  function syncSelectedStackInputs() {
    const stack = getStackForEdit();
    const layer = stack[selectedStackIndex()];
    if (!layer) return;
    selectedType.input.value = layer.type || 'FractalBrownianMotion';
    selectedZoom.input.value = layer.zoom ?? 1;
    selectedThreshold.input.value = layer.threshold ?? 0.3;
    selectedVoro.input.value = layer.voroMode ?? 2;
  }

  stackSelect.addEventListener('change', syncSelectedStackInputs);
  refreshStackSelect();
  syncSelectedStackInputs();

  const removePlanetLayerButton = makeSmallButton('Remove selected', () => {
    const stack = getStackForEdit();
    const index = selectedStackIndex();
    if (index < 0 || index >= stack.length) throw new Error('No stack layer selected.');
    stack.splice(index, 1);
    planetStack.setValue(stack);
    refreshStackSelect(Math.max(0, index - 1));
    syncSelectedStackInputs();
    status.textContent = 'Removed selected planet noise layer. Click Rebake JSON to apply.';
  });

  const movePlanetLayerUp = makeSmallButton('Move up', () => {
    const stack = getStackForEdit();
    const index = selectedStackIndex();
    if (index <= 0 || index >= stack.length) return;
    [stack[index - 1], stack[index]] = [stack[index], stack[index - 1]];
    planetStack.setValue(stack);
    refreshStackSelect(index - 1);
    status.textContent = 'Moved planet noise layer up. Click Rebake JSON to apply.';
  });

  const movePlanetLayerDown = makeSmallButton('Move down', () => {
    const stack = getStackForEdit();
    const index = selectedStackIndex();
    if (index < 0 || index >= stack.length - 1) return;
    [stack[index + 1], stack[index]] = [stack[index], stack[index + 1]];
    planetStack.setValue(stack);
    refreshStackSelect(index + 1);
    status.textContent = 'Moved planet noise layer down. Click Rebake JSON to apply.';
  });

  const duplicatePlanetLayerButton = makeSmallButton('Duplicate selected', () => {
    const stack = getStackForEdit();
    const index = selectedStackIndex();
    if (index < 0 || index >= stack.length) throw new Error('No stack layer selected.');
    stack.splice(index + 1, 0, clonePlain(stack[index]));
    planetStack.setValue(stack);
    refreshStackSelect(index + 1);
    syncSelectedStackInputs();
    status.textContent = 'Duplicated selected planet noise layer. Click Rebake JSON to apply.';
  });

  const clearPlanetStackButton = makeSmallButton('Clear stack', () => {
    planetStack.setValue([]);
    refreshStackSelect();
    status.textContent = 'Cleared planet stack. Rebake will regenerate from planet noise globals.';
  });

  stackQuick.grid.append(
    planetModeSelect.wrap,
    addPlanetLayerButton,
    stackSelectWrap,
    removePlanetLayerButton,
    movePlanetLayerUp,
    movePlanetLayerDown,
    duplicatePlanetLayerButton,
    clearPlanetStackButton,
    selectedType.wrap,
    selectedZoom.wrap,
    selectedThreshold.wrap,
    selectedVoro.wrap,
  );

  const cloudQuick = makeCompactControlPanel(
    'Cloud quick controls',
    'Shell, texture size, motion, and interleave shortcuts.',
  );

  function addCloudControl(path, label, type = 'number', step = 'any', opts = {}) {
    const initial = getPathValue(clouds.value, path, opts.fallback ?? '');
    const control = makeCompactInput({
      label,
      value: initial,
      type,
      step,
      min: opts.min ?? null,
      max: opts.max ?? null,
      options: opts.options ?? null,
      onChange: (next) => updateEditorPath(clouds, path, next, `Cloud ${label}`),
    });
    cloudQuick.grid.appendChild(control.wrap);
    registerEditorPathInput(clouds, path, control, type);
    return control;
  }

  addCloudControl('shell.cloudBottom', 'cloudBottom', 'number', '0.01');
  addCloudControl('shell.cloudTop', 'cloudTop', 'number', '0.01');
  addCloudControl('shell.maxHalfHeight', 'box half height', 'number', '0.01', { min: 0.05 });
  addCloudControl('textures.weatherWidth', 'weather width', 'number', '1');
  addCloudControl('textures.weatherHeight', 'weather height', 'number', '1');
  addCloudControl('textures.renderScaleDivider', 'render divider', 'number', '1', { min: 1 });
  addCloudControl('textures.updateEvery', 'updateEvery', 'number', '1', { min: 1 });
  addCloudControl('performance.coarseFactor', 'coarse x', 'number', '1', { min: 1 });
  addCloudControl('motion.spinSpeed', 'spinSpeed', 'number', '0.001');
  addCloudControl('reprojection.enabled', 'reproj enabled', 'checkbox');
  addCloudControl('reprojection.compactInterleave', 'compact x4', 'checkbox');
  addCloudControl('reprojection.temporalCellRate', 'x interleave', 'number', '1', { min: 1, max: 64 });
  addCloudControl('reprojection.temporalBlend', 'temporalBlend', 'number', '0.01', { min: 0, max: 1 });


const auroraQuick = makeCompactControlPanel(
  'Aurora quick controls',
  'Toggle the fake aurora disc and tweak its shell, cap, motion, and loop density shortcuts.',
);

function addAuroraControl(path, label, type = 'number', step = 'any', opts = {}) {
  const initial = getPathValue(clouds.value, path, opts.fallback ?? '');
  const control = makeCompactInput({
    label,
    value: initial,
    type,
    step,
    min: opts.min ?? null,
    max: opts.max ?? null,
    options: opts.options ?? null,
    onChange: (next) => updateEditorPath(clouds, path, next, `Aurora ${label}`),
  });
  auroraQuick.grid.appendChild(control.wrap);
  registerEditorPathInput(clouds, path, control, type);
  return control;
}

function addAuroraVec3Control(path, label) {
  const current = getPathValue(clouds.value, path, [1, 1, 1]);
  const setChannel = (index, next) => {
    updateEditorValue(clouds, `Aurora ${label}`, (cfg) => {
      const vec = getPathValue(cfg, path, [1, 1, 1]).slice(0, 3);
      while (vec.length < 3) vec.push(1);
      vec[index] = next;
      setPathValue(cfg, path, vec);
    }, { path });
  };
  for (const [index, suffix] of ['R', 'G', 'B'].entries()) {
    const control = makeCompactInput({
      label: `${label} ${suffix}`,
      value: Array.isArray(current) ? current[index] ?? 1 : 1,
      type: 'number',
      step: '0.01',
      onChange: (next) => setChannel(index, next),
    });
    auroraQuick.grid.appendChild(control.wrap);
  }
}

addAuroraControl('aurora.enabled', 'enabled', 'checkbox');
addAuroraControl('aurora.shell.cloudBottom', 'bottom', 'number', '0.01');
addAuroraControl('aurora.shell.cloudTop', 'top', 'number', '0.01');
addAuroraControl('aurora.shell.maxHalfHeight', 'box half height', 'number', '0.01', { min: 0.05 });
addAuroraControl('aurora.textures.renderScaleDivider', 'renderDiv', 'number', '1', { min: 1 });
addAuroraControl('aurora.textures.updateEvery', 'updateEvery', 'number', '1', { min: 1 });
addAuroraControl('aurora.performance.coarseFactor', 'coarse x', 'number', '1', { min: 1 });
addAuroraControl('aurora.reprojection.enabled', 'reproj', 'checkbox');
addAuroraControl('aurora.reprojection.compactInterleave', 'compact x4', 'checkbox');
addAuroraControl('aurora.reprojection.temporalCellRate', 'x interleave', 'number', '1', { min: 1, max: 64 });
addAuroraControl('aurora.reprojection.temporalBlend', 'temporalBlend', 'number', '0.01', { min: 0, max: 1 });
addAuroraControl('aurora.cap.halfAngleDeg', 'capDeg', 'number', '0.1');
addAuroraControl('aurora.cap.featherDeg', 'featherDeg', 'number', '0.1');
addAuroraControl('aurora.motion.spinSpeed', 'spinSpeed', 'number', '0.0001');
addAuroraControl('aurora.transforms.weatherScale', 'weatherScale', 'number', '0.01');
addAuroraControl('aurora.transforms.weatherBias', 'weather bias', 'number', '0.01');
addAuroraControl('aurora.transforms.shapeBias', 'shape bias', 'number', '0.01');
addAuroraControl('aurora.transforms.detailBias', 'detail bias', 'number', '0.01');
addAuroraControl('aurora.params.globalCoverage', 'coverage', 'number', '0.01');
addAuroraControl('aurora.params.globalDensity', 'density', 'number', '1');
addAuroraControl('aurora.style.auroraBrightness', 'brightness', 'number', '0.05', { min: 0 });
addAuroraVec3Control('aurora.style.auroraColor', 'color');

addAuroraVec3Control('aurora.style.auroraShadowColor', 'dark color');

  const auroraParamsPanel = makeCompactControlPanel(
    'Aurora density/scattering params',
    'Coverage, density, anvil, phase, silver, and attenuation params for the aurora volume.',
  );

  function addAuroraParamControl(path, label, type = 'number', step = 'any', opts = {}) {
    const initial = getPathValue(clouds.value, path, opts.fallback ?? '');
    const control = makeCompactInput({
      label,
      value: initial,
      type,
      step,
      min: opts.min ?? null,
      max: opts.max ?? null,
      options: opts.options ?? null,
      onChange: (next) => updateEditorPath(clouds, path, next, `Aurora ${label}`),
    });
    auroraParamsPanel.grid.appendChild(control.wrap);
    registerEditorPathInput(clouds, path, control, type);
    return control;
  }

  addAuroraParamControl('aurora.params.globalCoverage', 'coverage', 'number', '0.01');
  addAuroraParamControl('aurora.params.globalDensity', 'density', 'number', '1');
  addAuroraParamControl('aurora.params.cloudAnvilAmount', 'anvil', 'number', '0.01');
  addAuroraParamControl('aurora.params.cloudBeer', 'beer', 'number', '0.01');
  addAuroraParamControl('aurora.params.attenuationClamp', 'attenClamp', 'number', '0.001');
  addAuroraParamControl('aurora.params.inScatterG', 'inScatterG', 'number', '0.01');
  addAuroraParamControl('aurora.params.silverIntensity', 'silverI', 'number', '0.01');
  addAuroraParamControl('aurora.params.silverExponent', 'silverExp', 'number', '0.01');
  addAuroraParamControl('aurora.params.outScatterG', 'outScatterG', 'number', '0.01');
  addAuroraParamControl('aurora.params.inVsOut', 'inVsOut', 'number', '0.01');
  addAuroraParamControl('aurora.params.outScatterAmbientAmt', 'outAmbient', 'number', '0.01');
  addAuroraParamControl('aurora.params.ambientMinimum', 'ambientMin', 'number', '0.001');
  addAuroraParamControl('aurora.params.densityDivMin', 'densityDivMin', 'number', '0.0001');
  addAuroraParamControl('aurora.params.silverDirectionBias', 'silverDirBias', 'number', '0.01');
  addAuroraParamControl('aurora.params.silverHorizonBoost', 'silverHorizon', 'number', '0.01');

  const auroraLookPanel = makeCompactControlPanel(
    'Aurora lighting/color controls',
    'Aurora preset, self-lit color, fog, shadow, rim, and tint controls.',
  );
  const auroraLookControls = [];

  function addAuroraLookControl(path, label, type = 'number', step = 'any', opts = {}) {
    const initial = getPathValue(clouds.value, path, opts.fallback ?? '');
    const control = makeCompactInput({
      label,
      value: initial,
      type,
      step,
      min: opts.min ?? null,
      max: opts.max ?? null,
      options: opts.options ?? null,
      onChange: (next) => updateEditorPath(clouds, path, next, `Aurora ${label}`),
    });
    auroraLookPanel.grid.appendChild(control.wrap);
    auroraLookControls.push({ path, type, input: control.input });
    registerEditorPathInput(clouds, path, control, type);
    return control;
  }

  function addAuroraLookVec3Control(path, label) {
    const current = getPathValue(clouds.value, path, [0, 0, 0]);
    const setChannel = (index, next) => {
      updateEditorValue(clouds, `Aurora ${label}`, (cfg) => {
        const vec = getPathValue(cfg, path, [0, 0, 0]).slice(0, 3);
        while (vec.length < 3) vec.push(0);
        vec[index] = next;
        setPathValue(cfg, path, vec);
      }, { path });
    };
    for (const [index, suffix] of ['R', 'G', 'B'].entries()) {
      const control = makeCompactInput({
        label: `${label} ${suffix}`,
        value: Array.isArray(current) ? current[index] ?? 0 : 0,
        type: 'number',
        step: '0.01',
        onChange: (next) => setChannel(index, next),
      });
      auroraLookPanel.grid.appendChild(control.wrap);
      auroraLookControls.push({ path, type: 'vec3', index, input: control.input });
    }
  }

  function syncAuroraLookInputs() {
    let cfg;
    try {
      cfg = clouds.value;
    } catch {
      return;
    }
    for (const item of auroraLookControls) {
      if (item.type === 'vec3') {
        const vec = getPathValue(cfg, item.path, [0, 0, 0]);
        item.input.value = Array.isArray(vec) ? vec[item.index] ?? 0 : 0;
      } else if (item.type === 'checkbox') {
        item.input.checked = !!getPathValue(cfg, item.path, false);
      } else {
        item.input.value = getPathValue(cfg, item.path, item.input.value ?? '');
      }
    }
    auroraColorPresetSelect.input.value = String(getPathValue(cfg, 'aurora.style.colorPresetId', auroraColorPresetSelect.input.value || 'aurora'));
  }

  const auroraColorPresetSelect = makeCompactInput({
    label: 'aurora preset',
    value: getPathValue(clouds.value, 'aurora.style.colorPresetId', 'aurora'),
    options: Object.keys(CLOUD_LIGHTING_COLOR_PRESETS).map((key) => ({
      value: key,
      label: CLOUD_COLOR_PRESET_LABELS[key] || `Preset ${key}`,
    })),
  });
  const applyAuroraPresetButton = makeSmallButton('Apply preset to JSON', () => {
    const presetId = auroraColorPresetSelect.input.value || 'aurora';
    const patch = cloudColorPresetToConfigPatch(presetId);
    updateEditorValue(clouds, `Aurora color preset ${presetId}`, (cfg) => {
      cfg.aurora = cfg.aurora || {};
      cfg.aurora.params = mergePlain(cfg.aurora.params || {}, patch.params);
      cfg.aurora.tuning = mergePlain(cfg.aurora.tuning || {}, patch.tuning);
      cfg.aurora.style = mergePlain(cfg.aurora.style || {}, patch.style);
    }, { forceCloudLiveApply: true });
    syncAuroraLookInputs();
    status.textContent = `Aurora lighting/color preset ${presetId} updated in JSON.`;
  });
  const syncAuroraLookButton = makeSmallButton('Sync look controls', () => {
    syncAuroraLookInputs();
    status.textContent = 'Synced aurora lighting/color controls from the JSON editor.';
  });
  auroraLookPanel.grid.append(auroraColorPresetSelect.wrap, applyAuroraPresetButton, syncAuroraLookButton);

  addAuroraLookControl('aurora.style.exposure', 'exposure', 'number', '0.01');
  addAuroraLookControl('aurora.tuning.directLightBlend', 'directBlend', 'number', '0.01');
  addAuroraLookControl('aurora.tuning.directLightBoost', 'directBoost', 'number', '0.01');
  addAuroraLookControl('aurora.style.styleShadowStrength', 'shadowStrength', 'number', '0.01');
  addAuroraLookControl('aurora.style.styleShadowEdge', 'shadowEdge', 'number', '0.01');
  addAuroraLookControl('aurora.style.styleShadowDarkness', 'shadowDark', 'number', '0.01');
  addAuroraLookControl('aurora.style.styleColorLift', 'colorLift', 'number', '0.01');
  addAuroraLookControl('aurora.style.styleSaturation', 'saturation', 'number', '0.01');
  addAuroraLookControl('aurora.style.styleRimStrength', 'rimStrength', 'number', '0.01');
  addAuroraLookControl('aurora.style.styleSunBleed', 'sunBleed', 'number', '0.01');
  addAuroraLookControl('aurora.style.styleMidLift', 'midLift', 'number', '0.01');
  addAuroraLookControl('aurora.style.alphaFloor', 'alphaFloor', 'number', '0.01');
  addAuroraLookControl('aurora.style.fogDensity', 'fogDensity', 'number', '0.01');
  addAuroraLookControl('aurora.style.fogHorizon', 'fogHorizon', 'number', '0.01');
  addAuroraLookControl('aurora.style.fogSun', 'fogSun', 'number', '0.01');
  addAuroraLookControl('aurora.style.godRaysEnabled', 'godRays', 'checkbox');
  addAuroraLookControl('aurora.style.godRayStrength', 'godStrength', 'number', '0.01');
  addAuroraLookControl('aurora.style.godRayLength', 'godLength', 'number', '0.01');
  addAuroraLookControl('aurora.style.godRayFalloff', 'godFalloff', 'number', '0.01');
  addAuroraLookControl('aurora.style.auroraBrightness', 'brightness', 'number', '0.05');

  addAuroraLookVec3Control('aurora.params.sunColor', 'sunColor');
  addAuroraLookVec3Control('aurora.params.frontLightColor', 'frontLight');
  addAuroraLookVec3Control('aurora.params.shadowLightColor', 'shadowLight');
  addAuroraLookVec3Control('aurora.style.sunTint', 'sunTint');
  addAuroraLookVec3Control('aurora.style.transmissiveLightTint', 'transTint');
  addAuroraLookVec3Control('aurora.style.frontLightTint', 'frontTint');
  addAuroraLookVec3Control('aurora.style.volumeShadowTint', 'volShadow');
  addAuroraLookVec3Control('aurora.style.cloudLitTint', 'litTint');
  addAuroraLookVec3Control('aurora.style.cloudShadowTint', 'shadeTint');
  addAuroraLookVec3Control('aurora.style.edgeTint', 'edgeTint');
  addAuroraLookVec3Control('aurora.style.auroraColor', 'auroraColor');
  addAuroraLookVec3Control('aurora.style.auroraShadowColor', 'auroraDark');

  const auroraTexPanel = makeCompactControlPanel(
    'Aurora texture/channel controls',
    'Pick aurora weather/shape/detail channel, then change its generator and core noise params.',
  );

  const auroraTextureSelect = makeCompactInput({
    label: 'texture block',
    value: 'weather',
    options: ['weather', 'weatherG', 'weatherB', 'shape', 'detail', 'blue'],
  });
  const auroraModeSelect = makeCompactInput({
    label: 'noise mode',
    value: 'computeFBM',
    options: TEXTURE_MODE_OPTIONS,
  });
  const auroraEnabledControl = makeCompactInput({ label: 'enabled', value: true, type: 'checkbox' });
  const auroraZoomControl = makeCompactInput({ label: 'zoom', value: 1, type: 'number', step: '0.01' });
  const auroraFreqControl = makeCompactInput({ label: 'freq', value: 1, type: 'number', step: '0.01' });
  const auroraOctavesControl = makeCompactInput({ label: 'octaves', value: 4, type: 'number', step: '1' });
  const auroraThresholdControl = makeCompactInput({ label: 'threshold', value: 0.1, type: 'number', step: '0.01' });
  const auroraVoroControl = makeCompactInput({ label: 'voroMode', value: 4, type: 'number', step: '1', min: 0, max: 15 });
  const auroraWarpControl = makeCompactInput({ label: 'warpAmp', value: 0, type: 'number', step: '0.01' });
  const auroraLacunarityControl = makeCompactInput({ label: 'lacunarity', value: 2, type: 'number', step: '0.01' });
  const auroraGainControl = makeCompactInput({ label: 'gain', value: 0.5, type: 'number', step: '0.01' });
  const auroraEdgeKControl = makeCompactInput({ label: 'edgeK', value: 0, type: 'number', step: '0.01' });

  function selectedAuroraBlockName() { return auroraTextureSelect.input.value || 'weather'; }
  function selectedAuroraBlock() {
    const cfg = clouds.value;
    const name = selectedAuroraBlockName();
    return cfg.aurora?.noise?.[name] || {};
  }
  function syncAuroraTextureInputs() {
    const block = selectedAuroraBlock();
    auroraModeSelect.input.value = block.mode || block.mode1 || block.baseModeA || 'computeFBM';
    auroraEnabledControl.input.checked = block.enabled !== false;
    auroraZoomControl.input.value = block.zoom ?? 1;
    auroraFreqControl.input.value = block.freq ?? 1;
    auroraOctavesControl.input.value = block.octaves ?? 4;
    auroraThresholdControl.input.value = block.threshold ?? 0.1;
    auroraVoroControl.input.value = block.voroMode ?? 0;
    auroraWarpControl.input.value = block.warpAmp ?? 0;
    auroraLacunarityControl.input.value = block.lacunarity ?? 2.0;
    auroraGainControl.input.value = block.gain ?? 0.5;
    auroraEdgeKControl.input.value = block.edgeK ?? 0.0;
  }
  function updateSelectedAuroraBlock(mutator, label = 'Aurora texture') {
    updateEditorValue(clouds, label, (cfg) => {
      const name = selectedAuroraBlockName();
      cfg.aurora = cfg.aurora || {};
      cfg.aurora.noise = cfg.aurora.noise || {};
      cfg.aurora.noise[name] = clonePlain(cfg.aurora.noise[name] || {});
      mutator(cfg.aurora.noise[name], cfg);
    });
  }
  auroraTextureSelect.input.addEventListener('change', syncAuroraTextureInputs);
  auroraModeSelect.input.addEventListener('change', () => updateSelectedAuroraBlock((block) => {
    const modeValue = auroraModeSelect.input.value || 'computeFBM';
    if ('mode' in block || selectedAuroraBlockName().startsWith('weather')) block.mode = modeValue;
    if ('mode1' in block) block.mode1 = modeValue;
    if ('baseModeA' in block) block.baseModeA = modeValue;
  }, 'Aurora noise mode'));
  auroraEnabledControl.input.addEventListener('change', () => updateSelectedAuroraBlock((block) => { block.enabled = auroraEnabledControl.input.checked; }, 'Aurora enabled'));
  auroraZoomControl.input.addEventListener('change', () => updateSelectedAuroraBlock((block) => { block.zoom = Number(auroraZoomControl.input.value); }, 'Aurora zoom'));
  auroraFreqControl.input.addEventListener('change', () => updateSelectedAuroraBlock((block) => { block.freq = Number(auroraFreqControl.input.value); }, 'Aurora freq'));
  auroraOctavesControl.input.addEventListener('change', () => updateSelectedAuroraBlock((block) => { block.octaves = Number(auroraOctavesControl.input.value); }, 'Aurora octaves'));
  auroraThresholdControl.input.addEventListener('change', () => updateSelectedAuroraBlock((block) => { block.threshold = Number(auroraThresholdControl.input.value); }, 'Aurora threshold'));
  auroraVoroControl.input.addEventListener('change', () => updateSelectedAuroraBlock((block) => { block.voroMode = Number(auroraVoroControl.input.value); }, 'Aurora voroMode'));
  auroraWarpControl.input.addEventListener('change', () => updateSelectedAuroraBlock((block) => { block.warpAmp = Number(auroraWarpControl.input.value); }, 'Aurora warpAmp'));
  auroraLacunarityControl.input.addEventListener('change', () => updateSelectedAuroraBlock((block) => { block.lacunarity = Number(auroraLacunarityControl.input.value); }, 'Aurora lacunarity'));
  auroraGainControl.input.addEventListener('change', () => updateSelectedAuroraBlock((block) => { block.gain = Number(auroraGainControl.input.value); }, 'Aurora gain'));
  auroraEdgeKControl.input.addEventListener('change', () => updateSelectedAuroraBlock((block) => { block.edgeK = Number(auroraEdgeKControl.input.value); }, 'Aurora edgeK'));
  auroraTexPanel.grid.append(
    auroraTextureSelect.wrap,
    auroraModeSelect.wrap,
    auroraEnabledControl.wrap,
    auroraZoomControl.wrap,
    auroraFreqControl.wrap,
    auroraOctavesControl.wrap,
    auroraThresholdControl.wrap,
    auroraVoroControl.wrap,
    auroraWarpControl.wrap,
    auroraLacunarityControl.wrap,
    auroraGainControl.wrap,
    auroraEdgeKControl.wrap,
  );
  syncAuroraTextureInputs();

  const auroraChannelPanel = makeCompactControlPanel(
    'Aurora channel mode controls',
    'Shape/detail sub-modes and quick presets for the aurora volume.',
  );
  function addAuroraChannelControl(path, label, type = 'text', step = 'any', opts = {}) {
    const control = makeCompactInput({
      label,
      value: getPathValue(clouds.value, path, opts.fallback ?? ''),
      type,
      step,
      min: opts.min ?? null,
      max: opts.max ?? null,
      options: opts.options ?? null,
      onChange: (next) => updateEditorPath(clouds, path, next, `Aurora ${label}`),
    });
    auroraChannelPanel.grid.appendChild(control.wrap);
    registerEditorPathInput(clouds, path, control, type);
    return control;
  }
  const auroraModeOpts = TEXTURE_MODE_OPTIONS.map((value) => ({ value, label: value }));
  addAuroraChannelControl('aurora.noise.shape.baseModeA', 'shape A', 'select', 'any', { options: auroraModeOpts });
  addAuroraChannelControl('aurora.noise.shape.baseModeB', 'shape B', 'select', 'any', { options: auroraModeOpts });
  addAuroraChannelControl('aurora.noise.shape.bandMode2', 'shape 2', 'select', 'any', { options: auroraModeOpts });
  addAuroraChannelControl('aurora.noise.shape.bandMode3', 'shape 3', 'select', 'any', { options: auroraModeOpts });
  addAuroraChannelControl('aurora.noise.shape.bandMode4', 'shape 4', 'select', 'any', { options: auroraModeOpts });
  addAuroraChannelControl('aurora.noise.detail.mode1', 'detail 1', 'select', 'any', { options: auroraModeOpts });
  addAuroraChannelControl('aurora.noise.detail.mode2', 'detail 2', 'select', 'any', { options: auroraModeOpts });
  addAuroraChannelControl('aurora.noise.detail.mode3', 'detail 3', 'select', 'any', { options: auroraModeOpts });
  const softAuroraButton = makeSmallButton('Soft ribbon channels', () => {
    updateEditorValue(clouds, 'Soft aurora channels', (cfg) => {
      setPathValue(cfg, 'aurora.noise.shape.baseModeA', 'computeBillow4D');
      setPathValue(cfg, 'aurora.noise.shape.baseModeB', 'computeFBM4D');
      setPathValue(cfg, 'aurora.noise.shape.bandMode2', 'computeBillow4D');
      setPathValue(cfg, 'aurora.noise.shape.bandMode3', 'computeFBM4D');
      setPathValue(cfg, 'aurora.noise.shape.bandMode4', 'computeBillow4D');
      setPathValue(cfg, 'aurora.noise.detail.mode1', 'computeBillow4D');
      setPathValue(cfg, 'aurora.noise.detail.mode2', 'computeWorley4D');
      setPathValue(cfg, 'aurora.noise.detail.mode3', 'computeBillow4D');
    });
  });
  const hardAuroraButton = makeSmallButton('Sharper streaks', () => {
    updateEditorValue(clouds, 'Sharper aurora channels', (cfg) => {
      setPathValue(cfg, 'aurora.noise.shape.baseModeA', 'computeAntiWorley4D');
      setPathValue(cfg, 'aurora.noise.shape.baseModeB', 'computeBillow4D');
      setPathValue(cfg, 'aurora.noise.shape.bandMode2', 'computeAntiWorley4D');
      setPathValue(cfg, 'aurora.noise.shape.bandMode3', 'computeBillow4D');
      setPathValue(cfg, 'aurora.noise.shape.bandMode4', 'computeAntiWorley4D');
      setPathValue(cfg, 'aurora.noise.detail.mode1', 'computeWorley4D');
      setPathValue(cfg, 'aurora.noise.detail.mode2', 'computeBillow4D');
      setPathValue(cfg, 'aurora.noise.detail.mode3', 'computeWorley4D');
    });
  });
  auroraChannelPanel.grid.append(softAuroraButton, hardAuroraButton);

  const auroraTransformPanel = makeCompactControlPanel(
    'Aurora transform/motion controls',
    'Texture scale, bias, axis scale, offsets, and motion for the aurora volume.',
  );
  function addAuroraTransformControl(path, label, type = 'number', step = 'any', opts = {}) {
    const control = makeCompactInput({
      label,
      value: getPathValue(clouds.value, path, opts.fallback ?? ''),
      type,
      step,
      min: opts.min ?? null,
      max: opts.max ?? null,
      options: opts.options ?? null,
      onChange: (next) => updateEditorPath(clouds, path, next, `Aurora ${label}`),
    });
    auroraTransformPanel.grid.appendChild(control.wrap);
    registerEditorPathInput(clouds, path, control, type);
    return control;
  }
  function addAuroraVec3Loose(panel, basePath, label, step = '0.01') {
    const current = getPathValue(clouds.value, basePath, [0, 0, 0]);
    for (const [index, suffix] of ['X', 'Y', 'Z'].entries()) {
      const control = makeCompactInput({
        label: `${label} ${suffix}`,
        value: Array.isArray(current) ? current[index] ?? 0 : 0,
        type: 'number',
        step,
        onChange: (next) => updateEditorValue(clouds, `Aurora ${label}`, (cfg) => {
          const vec = getPathValue(cfg, basePath, [0, 0, 0]).slice(0, 3);
          while (vec.length < 3) vec.push(0);
          vec[index] = next;
          setPathValue(cfg, basePath, vec);
        }),
      });
      panel.grid.appendChild(control.wrap);
    }
  }
  addAuroraTransformControl('aurora.transforms.weatherScale', 'weatherScale', 'number', '0.01');
  addAuroraTransformControl('aurora.transforms.shapeScale', 'shapeScale', 'number', '0.01');
  addAuroraTransformControl('aurora.transforms.detailScale', 'detailScale', 'number', '0.01');
  addAuroraTransformControl('aurora.transforms.weatherBias', 'weatherBias', 'number', '0.01');
  addAuroraTransformControl('aurora.transforms.shapeBias', 'shapeBias', 'number', '0.01');
  addAuroraTransformControl('aurora.transforms.detailBias', 'detailBias', 'number', '0.01');
  addAuroraTransformControl('aurora.motion.spinSpeed', 'spinSpeed', 'number', '0.0001');
  addAuroraTransformControl('aurora.motion.shapeSpinFactor', 'shapeSpinF', 'number', '0.01');
  addAuroraTransformControl('aurora.motion.detailSpinFactor', 'detailSpinF', 'number', '0.01');
  addAuroraTransformControl('aurora.motion.meridionalDrift', 'meridDrift', 'number', '0.001');
  addAuroraVec3Loose(auroraTransformPanel, 'aurora.transforms.weatherAxisScale', 'weatherAxis', '0.01');
  addAuroraVec3Loose(auroraTransformPanel, 'aurora.transforms.shapeAxisScale', 'shapeAxis', '0.01');
  addAuroraVec3Loose(auroraTransformPanel, 'aurora.transforms.detailAxisScale', 'detailAxis', '0.01');
  addAuroraVec3Loose(auroraTransformPanel, 'aurora.motion.velocities.weather', 'weatherVel', '0.001');
  addAuroraVec3Loose(auroraTransformPanel, 'aurora.motion.velocities.shape', 'shapeVel', '0.001');
  addAuroraVec3Loose(auroraTransformPanel, 'aurora.motion.velocities.detail', 'detailVel', '0.001');

  const auroraMarchPanel = makeCompactControlPanel(
    'Aurora march/render/tuning controls',
    'March cost, alpha shaping, sparsity, definition, shell, render scale, and cadence.',
  );
  function addAuroraMarchControl(path, label, type = 'number', step = 'any', opts = {}) {
    const control = makeCompactInput({
      label,
      value: getPathValue(clouds.value, path, opts.fallback ?? ''),
      type,
      step,
      min: opts.min ?? null,
      max: opts.max ?? null,
      options: opts.options ?? null,
      onChange: (next) => updateEditorPath(clouds, path, next, `Aurora ${label}`),
    });
    auroraMarchPanel.grid.appendChild(control.wrap);
    registerEditorPathInput(clouds, path, control, type);
    return control;
  }
  addAuroraMarchControl('aurora.textures.renderScaleDivider', 'renderDiv', 'number', '1', { min: 1 });
  addAuroraMarchControl('aurora.textures.updateEvery', 'updateEvery', 'number', '1', { min: 1 });
  addAuroraMarchControl('aurora.reprojection.enabled', 'reproj', 'checkbox');
  addAuroraMarchControl('aurora.reprojection.compactInterleave', 'compact x4', 'checkbox');
  addAuroraMarchControl('aurora.reprojection.temporalCellRate', 'x interleave', 'number', '1', { min: 1, max: 64 });
  addAuroraMarchControl('aurora.reprojection.temporalBlend', 'temporalBlend', 'number', '0.01', { min: 0, max: 1 });
  addAuroraMarchControl('aurora.render.opacity', 'opacity', 'number', '0.01');
  addAuroraMarchControl('aurora.render.alphaPower', 'alphaPower', 'number', '0.01');
  addAuroraMarchControl('aurora.render.alphaCutoff', 'alphaCutoff', 'number', '0.001');
  addAuroraMarchControl('aurora.render.stepBase', 'stepBase', 'number', '0.001');
  addAuroraMarchControl('aurora.render.stepInc', 'stepInc', 'number', '0.001');
  addAuroraMarchControl('aurora.tuning.maxSteps', 'maxSteps', 'number', '1', { min: 1 });
  addAuroraMarchControl('aurora.tuning.minStep', 'minStep', 'number', '0.0005');
  addAuroraMarchControl('aurora.tuning.maxStep', 'maxStep', 'number', '0.001');
  addAuroraMarchControl('aurora.tuning.nearStepScale', 'nearStep', 'number', '0.01');
  addAuroraMarchControl('aurora.tuning.nearDensityMult', 'nearDens', 'number', '0.01');
  addAuroraMarchControl('aurora.tuning.farDetailAtten', 'farDetail', 'number', '0.01');
  addAuroraMarchControl('aurora.tuning.fluffFactor', 'fluff', 'number', '0.01');
  addAuroraMarchControl('aurora.tuning.anvilLift', 'anvilLift', 'number', '0.01');
  addAuroraMarchControl('aurora.tuning.alphaBoostThreshold', 'alphaThres', 'number', '0.01');
  addAuroraMarchControl('aurora.tuning.alphaBoostAmount', 'alphaBoost', 'number', '0.01');
  addAuroraMarchControl('aurora.tuning.minOutputAlpha', 'minOutAlpha', 'number', '0.01');
  addAuroraMarchControl('aurora.tuning.outputAlphaFeather', 'alphaFeather', 'number', '0.01');
  addAuroraMarchControl('aurora.tuning.sparsity', 'sparsity', 'number', '0.01');
  addAuroraMarchControl('aurora.tuning.definition', 'definition', 'number', '0.01');
  addAuroraMarchControl('aurora.performance.lodBiasMul', 'lodBiasMul', 'number', '0.01');
  addAuroraMarchControl('aurora.performance.coarseMipBias', 'coarseMip', 'number', '0.01');
  addAuroraMarchControl('aurora.performance.coarseFactor', 'coarseFactor', 'number', '1', { min: 1 });

  const cloudParamsPanel = makeCompactControlPanel(
    'Cloud density/scattering params',
    'Coverage, density, silver/rim lighting, phase, and attenuation params.',
  );

  function addCloudParamControl(path, label, type = 'number', step = 'any', opts = {}) {
    const initial = getPathValue(clouds.value, path, opts.fallback ?? '');
    const control = makeCompactInput({
      label,
      value: initial,
      type,
      step,
      min: opts.min ?? null,
      max: opts.max ?? null,
      options: opts.options ?? null,
      onChange: (next) => updateEditorPath(clouds, path, next, `Cloud ${label}`),
    });
    cloudParamsPanel.grid.appendChild(control.wrap);
    registerEditorPathInput(clouds, path, control, type);
    return control;
  }

  addCloudParamControl('params.globalCoverage', 'coverage', 'number', '0.01');
  addCloudParamControl('params.globalDensity', 'density', 'number', '1');
  addCloudParamControl('params.cloudAnvilAmount', 'anvil', 'number', '0.01');
  addCloudParamControl('params.cloudBeer', 'beer', 'number', '0.01');
  addCloudParamControl('params.attenuationClamp', 'attenClamp', 'number', '0.001');
  addCloudParamControl('params.inScatterG', 'inScatterG', 'number', '0.01');
  addCloudParamControl('params.silverIntensity', 'silverI', 'number', '0.01');
  addCloudParamControl('params.silverExponent', 'silverExp', 'number', '0.01');
  addCloudParamControl('params.outScatterG', 'outScatterG', 'number', '0.01');
  addCloudParamControl('params.inVsOut', 'inVsOut', 'number', '0.01');
  addCloudParamControl('params.outScatterAmbientAmt', 'outAmbient', 'number', '0.01');
  addCloudParamControl('params.ambientMinimum', 'ambientMin', 'number', '0.001');
  addCloudParamControl('params.densityDivMin', 'densityDivMin', 'number', '0.0001');
  addCloudParamControl('params.silverDirectionBias', 'silverDirBias', 'number', '0.01');
  addCloudParamControl('params.silverHorizonBoost', 'silverHorizon', 'number', '0.01');

  const cloudLookPanel = makeCompactControlPanel(
    'Cloud lighting/color controls',
    'Full flat-demo color preset set plus direct lighting and color controls.',
  );
  const cloudLookControls = [];

  function addCloudLookControl(path, label, type = 'number', step = 'any', opts = {}) {
    const initial = getPathValue(clouds.value, path, opts.fallback ?? '');
    const control = makeCompactInput({
      label,
      value: initial,
      type,
      step,
      min: opts.min ?? null,
      max: opts.max ?? null,
      options: opts.options ?? null,
      onChange: (next) => updateEditorPath(clouds, path, next, `Cloud ${label}`),
    });
    cloudLookPanel.grid.appendChild(control.wrap);
    cloudLookControls.push({ path, type, input: control.input });
    registerEditorPathInput(clouds, path, control, type);
    return control;
  }

  function addCloudVec3Control(path, label) {
    const current = getPathValue(clouds.value, path, [0, 0, 0]);
    const setChannel = (index, next) => {
      updateEditorValue(clouds, `Cloud ${label}`, (cfg) => {
        const vec = getPathValue(cfg, path, [0, 0, 0]).slice(0, 3);
        while (vec.length < 3) vec.push(0);
        vec[index] = next;
        setPathValue(cfg, path, vec);
      });
    };
    for (const [index, suffix] of ['R', 'G', 'B'].entries()) {
      const control = makeCompactInput({
        label: `${label} ${suffix}`,
        value: Array.isArray(current) ? current[index] ?? 0 : 0,
        type: 'number',
        step: '0.01',
        onChange: (next) => setChannel(index, next),
      });
      cloudLookPanel.grid.appendChild(control.wrap);
      cloudLookControls.push({ path, type: 'vec3', index, input: control.input });
    }
  }

  function syncCloudLookInputs() {
    let cfg;
    try {
      cfg = clouds.value;
    } catch {
      return;
    }
    for (const item of cloudLookControls) {
      if (item.type === 'vec3') {
        const vec = getPathValue(cfg, item.path, [0, 0, 0]);
        item.input.value = Array.isArray(vec) ? vec[item.index] ?? 0 : 0;
      } else if (item.type === 'checkbox') {
        item.input.checked = !!getPathValue(cfg, item.path, false);
      } else {
        item.input.value = getPathValue(cfg, item.path, item.input.value ?? '');
      }
    }
    colorPresetSelect.input.value = String(getPathValue(cfg, 'style.colorPresetId', colorPresetSelect.input.value || 3));
  }

  const colorPresetSelect = makeCompactInput({
    label: 'color/lighting preset',
    value: getPathValue(clouds.value, 'style.colorPresetId', 3),
    options: Object.keys(CLOUD_LIGHTING_COLOR_PRESETS).map((key) => ({
      value: key,
      label: CLOUD_COLOR_PRESET_LABELS[key] || `Preset ${key}`,
    })),
  });
  const applyColorPresetButton = makeSmallButton('Apply preset to JSON', () => {
    const presetId = colorPresetSelect.input.value || '3';
    const patch = cloudColorPresetToConfigPatch(presetId);
    updateEditorValue(clouds, `Cloud color preset ${presetId}`, (cfg) => {
      cfg.params = mergePlain(cfg.params || {}, patch.params);
      cfg.tuning = mergePlain(cfg.tuning || {}, patch.tuning);
      cfg.style = mergePlain(cfg.style || {}, patch.style);
    }, { forceCloudLiveApply: true });
    syncCloudLookInputs();
    status.textContent = `Cloud lighting/color preset ${presetId} updated in JSON. Click Rebake JSON to render it with the same seed.`;
  });
  const syncCloudLookButton = makeSmallButton('Sync look controls', () => {
    syncCloudLookInputs();
    status.textContent = 'Synced cloud lighting/color controls from the JSON editor.';
  });
  cloudLookPanel.grid.append(colorPresetSelect.wrap, applyColorPresetButton, syncCloudLookButton);

  addCloudLookControl('style.exposure', 'exposure', 'number', '0.01');
  addCloudLookControl('params.sunBloom', 'sunBloom', 'number', '0.01');
  addCloudLookControl('tuning.directLightBlend', 'directBlend', 'number', '0.01');
  addCloudLookControl('tuning.directLightBoost', 'directBoost', 'number', '0.01');
  addCloudLookControl('style.styleShadowStrength', 'shadowStrength', 'number', '0.01');
  addCloudLookControl('style.styleShadowEdge', 'shadowEdge', 'number', '0.01');
  addCloudLookControl('style.styleShadowDarkness', 'shadowDark', 'number', '0.01');
  addCloudLookControl('style.styleColorLift', 'colorLift', 'number', '0.01');
  addCloudLookControl('style.styleSaturation', 'saturation', 'number', '0.01');
  addCloudLookControl('style.styleRimStrength', 'rimStrength', 'number', '0.01');
  addCloudLookControl('style.styleSunBleed', 'sunBleed', 'number', '0.01');
  addCloudLookControl('style.styleMidLift', 'midLift', 'number', '0.01');
  addCloudLookControl('style.alphaFloor', 'alphaFloor', 'number', '0.01');
  addCloudLookControl('style.fogDensity', 'fogDensity', 'number', '0.01');
  addCloudLookControl('style.fogHorizon', 'fogHorizon', 'number', '0.01');
  addCloudLookControl('style.fogSun', 'fogSun', 'number', '0.01');
  addCloudLookControl('style.godRaysEnabled', 'godRays', 'checkbox');
  addCloudLookControl('style.godRayStrength', 'godStrength', 'number', '0.01');
  addCloudLookControl('style.godRayLength', 'godLength', 'number', '0.01');
  addCloudLookControl('style.godRayFalloff', 'godFalloff', 'number', '0.01');

  addCloudVec3Control('params.sunColor', 'sunColor');
  addCloudVec3Control('params.frontLightColor', 'frontLight');
  addCloudVec3Control('params.shadowLightColor', 'shadowLight');
  addCloudVec3Control('style.sunTint', 'sunTint');
  addCloudVec3Control('style.transmissiveLightTint', 'transTint');
  addCloudVec3Control('style.frontLightTint', 'frontTint');
  addCloudVec3Control('style.volumeShadowTint', 'volShadow');
  addCloudVec3Control('style.cloudLitTint', 'litTint');
  addCloudVec3Control('style.cloudShadowTint', 'shadeTint');
  addCloudVec3Control('style.edgeTint', 'edgeTint');

  const cloudTexPanel = makeCompactControlPanel(
    'Cloud texture/channel controls',
    'Pick weather/shape/detail channel, then change its generator and core noise params.',
  );

  const cloudTextureSelect = makeCompactInput({
    label: 'texture block',
    value: 'weather',
    options: ['weather', 'weatherG', 'weatherB', 'shape', 'detail', 'blue'],
  });
  const cloudModeSelect = makeCompactInput({
    label: 'noise mode',
    value: 'computeFBM',
    options: TEXTURE_MODE_OPTIONS,
  });
  const cloudEnabledControl = makeCompactInput({
    label: 'enabled',
    value: true,
    type: 'checkbox',
  });
  const cloudZoomControl = makeCompactInput({
    label: 'zoom',
    value: 1,
    type: 'number',
    step: '0.01',
  });
  const cloudFreqControl = makeCompactInput({
    label: 'freq',
    value: 1,
    type: 'number',
    step: '0.01',
  });
  const cloudOctavesControl = makeCompactInput({
    label: 'octaves',
    value: 4,
    type: 'number',
    step: '1',
  });
  const cloudThresholdControl = makeCompactInput({
    label: 'threshold',
    value: 0.1,
    type: 'number',
    step: '0.01',
  });
  const cloudVoroControl = makeCompactInput({
    label: 'voroMode',
    value: 4,
    type: 'number',
    step: '1',
    min: 0,
    max: 15,
  });
  const cloudWarpControl = makeCompactInput({
    label: 'warpAmp',
    value: 0,
    type: 'number',
    step: '0.01',
  });

  function selectedCloudBlockName() {
    return cloudTextureSelect.input.value || 'weather';
  }

  function selectedCloudBlock() {
    const cfg = clouds.value;
    const name = selectedCloudBlockName();
    return cfg.noise?.[name] || {};
  }

  function syncCloudTextureInputs() {
    const block = selectedCloudBlock();
    cloudModeSelect.input.value = block.mode || block.mode1 || block.baseModeA || 'computeFBM';
    cloudEnabledControl.input.checked = block.enabled !== false;
    cloudZoomControl.input.value = block.zoom ?? 1;
    cloudFreqControl.input.value = block.freq ?? 1;
    cloudOctavesControl.input.value = block.octaves ?? 4;
    cloudThresholdControl.input.value = block.threshold ?? 0.1;
    cloudVoroControl.input.value = block.voroMode ?? 0;
    cloudWarpControl.input.value = block.warpAmp ?? 0;
  }

  function updateSelectedCloudBlock(label, mutator) {
    updateEditorValue(clouds, label, (cfg) => {
      cfg.noise = cfg.noise || {};
      const name = selectedCloudBlockName();
      cfg.noise[name] = cfg.noise[name] || {};
      mutator(cfg.noise[name], name, cfg);
    });
    syncCloudTextureInputs();
  }

  cloudTextureSelect.input.addEventListener('change', syncCloudTextureInputs);
  cloudModeSelect.input.addEventListener('change', () => updateSelectedCloudBlock('Cloud texture mode', (block, name) => {
    if (name === 'shape') {
      // Primary shape mode only. Use the Shape/Detail channel panel for each band.
      block.baseModeA = cloudModeSelect.input.value;
    } else if (name === 'detail') {
      // Primary detail mode only. Use the Shape/Detail channel panel for each channel.
      block.mode1 = cloudModeSelect.input.value;
    } else if (name !== 'blue') {
      block.mode = cloudModeSelect.input.value;
    }
  }));
  cloudEnabledControl.input.addEventListener('change', () => updateSelectedCloudBlock('Cloud texture enabled', (block) => { block.enabled = !!cloudEnabledControl.input.checked; }));
  cloudZoomControl.input.addEventListener('change', () => updateSelectedCloudBlock('Cloud texture zoom', (block) => { block.zoom = Number(cloudZoomControl.input.value) || 0; }));
  cloudFreqControl.input.addEventListener('change', () => updateSelectedCloudBlock('Cloud texture freq', (block) => { block.freq = Number(cloudFreqControl.input.value) || 0; }));
  cloudOctavesControl.input.addEventListener('change', () => updateSelectedCloudBlock('Cloud texture octaves', (block) => { block.octaves = Math.max(1, Number(cloudOctavesControl.input.value) | 0); }));
  cloudThresholdControl.input.addEventListener('change', () => updateSelectedCloudBlock('Cloud texture threshold', (block) => { block.threshold = Number(cloudThresholdControl.input.value) || 0; }));
  cloudVoroControl.input.addEventListener('change', () => updateSelectedCloudBlock('Cloud texture voroMode', (block) => { block.voroMode = Number(cloudVoroControl.input.value) | 0; }));
  cloudWarpControl.input.addEventListener('change', () => updateSelectedCloudBlock('Cloud texture warpAmp', (block) => { block.warpAmp = Number(cloudWarpControl.input.value) || 0; }));

  syncCloudTextureInputs();
  cloudTexPanel.grid.append(
    cloudTextureSelect.wrap,
    cloudModeSelect.wrap,
    cloudEnabledControl.wrap,
    cloudZoomControl.wrap,
    cloudFreqControl.wrap,
    cloudOctavesControl.wrap,
    cloudThresholdControl.wrap,
    cloudVoroControl.wrap,
    cloudWarpControl.wrap,
  );

  const cloudChannelPanel = makeCompactControlPanel(
    'Shape/detail generator controls',
    'Shape has 4 packed channels; base A/B are two generators for channel 1, then G/B/A bands. Detail is RGB.',
  );
  const channelModeOptions = TEXTURE_MODE_OPTIONS.filter((mode) => mode !== 'clearTexture');

  function addCloudNoiseModeControl(path, label) {
    const control = makeCompactInput({
      label,
      value: getPathValue(clouds.value, path, 'computeWorley4D'),
      options: channelModeOptions,
      onChange: (next) => updateEditorPath(clouds, path, next, `Cloud ${label}`),
    });
    cloudChannelPanel.grid.appendChild(control.wrap);
    registerEditorPathInput(clouds, path, control, 'select');
    return control;
  }

  const cloudChannelControls = [
    addCloudNoiseModeControl('noise.shape.baseModeA', 'shape R primary'),
    addCloudNoiseModeControl('noise.shape.baseModeB', 'shape R blend'),
    addCloudNoiseModeControl('noise.shape.bandMode2', 'shape G band'),
    addCloudNoiseModeControl('noise.shape.bandMode3', 'shape B band'),
    addCloudNoiseModeControl('noise.shape.bandMode4', 'shape A erosion'),
    addCloudNoiseModeControl('noise.detail.mode1', 'detail R'),
    addCloudNoiseModeControl('noise.detail.mode2', 'detail G'),
    addCloudNoiseModeControl('noise.detail.mode3', 'detail B'),
  ];

  function syncCloudChannelInputs() {
    let cfg;
    try {
      cfg = clouds.value;
    } catch {
      return;
    }
    for (const control of cloudChannelControls) {
      const path = control.wrap?.dataset?.path || '';
      if (!path) continue;
      control.input.value = getPathValue(cfg, path, control.input.value);
    }
  }
  for (const control of cloudChannelControls) {
    control.wrap.dataset.path = control.input.closest('label')?.dataset?.path || '';
  }
  cloudChannelControls[0].wrap.dataset.path = 'noise.shape.baseModeA';
  cloudChannelControls[1].wrap.dataset.path = 'noise.shape.baseModeB';
  cloudChannelControls[2].wrap.dataset.path = 'noise.shape.bandMode2';
  cloudChannelControls[3].wrap.dataset.path = 'noise.shape.bandMode3';
  cloudChannelControls[4].wrap.dataset.path = 'noise.shape.bandMode4';
  cloudChannelControls[5].wrap.dataset.path = 'noise.detail.mode1';
  cloudChannelControls[6].wrap.dataset.path = 'noise.detail.mode2';
  cloudChannelControls[7].wrap.dataset.path = 'noise.detail.mode3';

  const copyShapeModesButton = makeSmallButton('Copy shape A to all shape', () => {
    const mode = getPathValue(clouds.value, 'noise.shape.baseModeA', 'computeAntiWorley4D');
    updateEditorValue(clouds, 'Copy shape mode', (cfg) => {
      setPathValue(cfg, 'noise.shape.baseModeA', mode);
      setPathValue(cfg, 'noise.shape.baseModeB', mode);
      setPathValue(cfg, 'noise.shape.bandMode2', mode);
      setPathValue(cfg, 'noise.shape.bandMode3', mode);
      setPathValue(cfg, 'noise.shape.bandMode4', mode);
    });
    syncCloudChannelInputs();
  });
  const copyDetailModesButton = makeSmallButton('Copy detail R to all detail', () => {
    const mode = getPathValue(clouds.value, 'noise.detail.mode1', 'computeWorley4D');
    updateEditorValue(clouds, 'Copy detail mode', (cfg) => {
      setPathValue(cfg, 'noise.detail.mode1', mode);
      setPathValue(cfg, 'noise.detail.mode2', mode);
      setPathValue(cfg, 'noise.detail.mode3', mode);
    });
    syncCloudChannelInputs();
  });
  cloudChannelPanel.grid.append(copyShapeModesButton, copyDetailModesButton);

  const softGlobeChannelsButton = makeSmallButton('Soft globe channels', () => {
    updateEditorValue(clouds, 'Soft globe channel recipe', (cfg) => {
      setPathValue(cfg, 'noise.shape.baseModeA', 'computeAntiWorley4D');
      setPathValue(cfg, 'noise.shape.baseModeB', 'computeAntiWorley4D');
      setPathValue(cfg, 'noise.shape.bandMode2', 'computeAntiWorley4D');
      setPathValue(cfg, 'noise.shape.bandMode3', 'computeAntiWorley4D');
      setPathValue(cfg, 'noise.shape.bandMode4', 'computeAntiWorley4D');
      setPathValue(cfg, 'noise.detail.mode1', 'computeWorley4D');
      setPathValue(cfg, 'noise.detail.mode2', 'computeWorley4D');
      setPathValue(cfg, 'noise.detail.mode3', 'computeWorley4D');
      setPathValue(cfg, 'transforms.shapeAxisScale', [1, 1, 1]);
      setPathValue(cfg, 'transforms.detailAxisScale', [1, 1, 1]);
      setPathValue(cfg, 'transforms.weatherAxisScale', [1, 1, 1]);
      setPathValue(cfg, 'transforms.shapeScale', 0.05);
      setPathValue(cfg, 'transforms.detailScale', 1.35);
      setPathValue(cfg, 'tuning.sparsity', 0.38);
      setPathValue(cfg, 'tuning.definition', 0.58);
    });
    syncCloudChannelInputs();
  });

  const crispCellChannelsButton = makeSmallButton('Crisp cell channels', () => {
    updateEditorValue(clouds, 'Crisp cell channel recipe', (cfg) => {
      setPathValue(cfg, 'noise.shape.baseModeA', 'computeAntiWorley4D');
      setPathValue(cfg, 'noise.shape.baseModeB', 'computeWorley4D');
      setPathValue(cfg, 'noise.shape.bandMode2', 'computeAntiWorley4D');
      setPathValue(cfg, 'noise.shape.bandMode3', 'computeWorley4D');
      setPathValue(cfg, 'noise.shape.bandMode4', 'computeAntiWorley4D');
      setPathValue(cfg, 'noise.detail.mode1', 'computeWorley4D');
      setPathValue(cfg, 'noise.detail.mode2', 'computeBillow4D');
      setPathValue(cfg, 'noise.detail.mode3', 'computeWorley4D');
      setPathValue(cfg, 'tuning.sparsity', 0.48);
      setPathValue(cfg, 'tuning.definition', 0.72);
    });
    syncCloudChannelInputs();
  });

  const lowStreaksButton = makeSmallButton('Low-stretch cleanup', () => {
    updateEditorValue(clouds, 'Low-stretch cleanup', (cfg) => {
      setPathValue(cfg, 'transforms.shapeAxisScale', [1, 1, 1]);
      setPathValue(cfg, 'transforms.detailAxisScale', [1, 1, 1]);
      setPathValue(cfg, 'transforms.weatherAxisScale', [1, 1, 1]);
      setPathValue(cfg, 'motion.meridionalDrift', 0.0);
      setPathValue(cfg, 'tuning.verticalLayerDecorrelation', 0.18);
      setPathValue(cfg, 'tuning.baseJitterFrac', 0.010);
      setPathValue(cfg, 'tuning.topJitterFrac', 0.040);
      setPathValue(cfg, 'tuning.sliceJitterStrength', 0.030);
    });
  });

  const recoverNaturalMarchButton = makeSmallButton('Recover natural march', () => {
    updateEditorValue(clouds, 'Recover natural march', (cfg) => {
      setPathValue(cfg, 'noise.shape.baseModeA', 'computeAntiWorley4D');
      setPathValue(cfg, 'noise.shape.baseModeB', 'computeAntiWorley4D');
      setPathValue(cfg, 'noise.shape.bandMode2', 'computeAntiWorley4D');
      setPathValue(cfg, 'noise.shape.bandMode3', 'computeAntiWorley4D');
      setPathValue(cfg, 'noise.shape.bandMode4', 'computeAntiWorley4D');
      setPathValue(cfg, 'noise.detail.mode1', 'computeWorley4D');
      setPathValue(cfg, 'noise.detail.mode2', 'computeWorley4D');
      setPathValue(cfg, 'noise.detail.mode3', 'computeWorley4D');
      setPathValue(cfg, 'transforms.weatherScale', 0.92);
      setPathValue(cfg, 'transforms.shapeScale', 0.05);
      setPathValue(cfg, 'transforms.detailScale', 1.55);
      setPathValue(cfg, 'transforms.weatherBias', 0.30);
      setPathValue(cfg, 'transforms.shapeBias', 0.05);
      setPathValue(cfg, 'transforms.detailBias', 0.02);
      setPathValue(cfg, 'params.globalCoverage', 0.48);
      setPathValue(cfg, 'params.globalDensity', 1050);
      setPathValue(cfg, 'params.silverIntensity', 1.0);
      setPathValue(cfg, 'params.silverExponent', 2.5);
      setPathValue(cfg, 'tuning.sparsity', 0.42);
      setPathValue(cfg, 'tuning.definition', 0.62);
      setPathValue(cfg, 'tuning.baseJitterFrac', 0.012);
      setPathValue(cfg, 'tuning.topJitterFrac', 0.044);
      setPathValue(cfg, 'tuning.sliceJitterStrength', 0.035);
      setPathValue(cfg, 'tuning.verticalLayerDecorrelation', 0.24);
      setPathValue(cfg, 'render.opacity', 0.92);
      setPathValue(cfg, 'render.alphaPower', 1.10);
      setPathValue(cfg, 'render.alphaCutoff', 0.015);
    });
    syncCloudChannelInputs();
  });

  cloudChannelPanel.grid.append(softGlobeChannelsButton, crispCellChannelsButton, lowStreaksButton, recoverNaturalMarchButton);

  const remixQuickPanel = makeCompactControlPanel(
    'Noise remix shortcuts',
    'Terrain stack, cloud weather, and aurora weather entry points.',
  );
  const cloudWeatherFbm2Button = makeSmallButton('Cloud weather FBM2', () => {
    updateEditorValue(clouds, 'Cloud weather FBM2', (cfg) => {
      setPathValue(cfg, 'noise.weather.mode', 'computeFBM2');
    }, { path: 'noise.weather.mode' });
    cloudTextureSelect.input.value = 'weather';
    syncCloudTextureInputs();
  });
  const auroraWeatherFbm2Button = makeSmallButton('Aurora weather FBM2', () => {
    updateEditorValue(clouds, 'Aurora weather FBM2', (cfg) => {
      setPathValue(cfg, 'aurora.noise.weather.mode', 'computeFBM2');
    }, { path: 'aurora.noise.weather.mode' });
    auroraTextureSelect.input.value = 'weather';
    syncAuroraTextureInputs();
  });
  const cloudWeather4DButton = makeSmallButton('Cloud weather FBM4D', () => {
    updateEditorValue(clouds, 'Cloud weather FBM4D', (cfg) => {
      setPathValue(cfg, 'noise.weather.mode', 'computeFBM4D');
    }, { path: 'noise.weather.mode' });
    cloudTextureSelect.input.value = 'weather';
    syncCloudTextureInputs();
  });
  const auroraWeather4DButton = makeSmallButton('Aurora weather FBM4D', () => {
    updateEditorValue(clouds, 'Aurora weather FBM4D', (cfg) => {
      setPathValue(cfg, 'aurora.noise.weather.mode', 'computeFBM4D');
    }, { path: 'aurora.noise.weather.mode' });
    auroraTextureSelect.input.value = 'weather';
    syncAuroraTextureInputs();
  });
  remixQuickPanel.grid.append(
    cloudWeatherFbm2Button,
    auroraWeatherFbm2Button,
    cloudWeather4DButton,
    auroraWeather4DButton,
  );

  const cloudTransformPanel = makeCompactControlPanel(
    'Cloud transform/motion controls',
    'Texture scale, bias, axis scale, offsets, and channel motion.',
  );

  function addCloudTransformControl(path, label, type = 'number', step = 'any', opts = {}) {
    const control = makeCompactInput({
      label,
      value: getPathValue(clouds.value, path, opts.fallback ?? ''),
      type,
      step,
      min: opts.min ?? null,
      max: opts.max ?? null,
      options: opts.options ?? null,
      onChange: (next) => updateEditorPath(clouds, path, next, `Cloud ${label}`),
    });
    cloudTransformPanel.grid.appendChild(control.wrap);
    registerEditorPathInput(clouds, path, control, type);
    return control;
  }

  function addCloudVec3Loose(panel, basePath, label, step = '0.01') {
    const current = getPathValue(clouds.value, basePath, [0, 0, 0]);
    for (const [index, suffix] of ['X', 'Y', 'Z'].entries()) {
      const control = makeCompactInput({
        label: `${label} ${suffix}`,
        value: Array.isArray(current) ? current[index] ?? 0 : 0,
        type: 'number',
        step,
        onChange: (next) => updateEditorValue(clouds, `Cloud ${label}`, (cfg) => {
          const vec = getPathValue(cfg, basePath, [0, 0, 0]).slice(0, 3);
          while (vec.length < 3) vec.push(0);
          vec[index] = next;
          setPathValue(cfg, basePath, vec);
        }),
      });
      panel.grid.appendChild(control.wrap);
    }
  }

  addCloudTransformControl('transforms.weatherScale', 'weatherScale', 'number', '0.01');
  addCloudTransformControl('transforms.shapeScale', 'shapeScale', 'number', '0.01');
  addCloudTransformControl('transforms.detailScale', 'detailScale', 'number', '0.01');
  addCloudTransformControl('transforms.weatherBias', 'weatherBias', 'number', '0.01');
  addCloudTransformControl('transforms.shapeBias', 'shapeBias', 'number', '0.01');
  addCloudTransformControl('transforms.detailBias', 'detailBias', 'number', '0.01');
  addCloudTransformControl('motion.shapeSpinFactor', 'shapeSpinF', 'number', '0.01');
  addCloudTransformControl('motion.detailSpinFactor', 'detailSpinF', 'number', '0.01');
  addCloudTransformControl('motion.meridionalDrift', 'meridDrift', 'number', '0.001');
  addCloudVec3Loose(cloudTransformPanel, 'transforms.weatherAxisScale', 'weatherAxis', '0.01');
  addCloudVec3Loose(cloudTransformPanel, 'transforms.shapeAxisScale', 'shapeAxis', '0.01');
  addCloudVec3Loose(cloudTransformPanel, 'transforms.detailAxisScale', 'detailAxis', '0.01');
  addCloudVec3Loose(cloudTransformPanel, 'motion.velocities.weather', 'weatherVel', '0.001');
  addCloudVec3Loose(cloudTransformPanel, 'motion.velocities.shape', 'shapeVel', '0.001');
  addCloudVec3Loose(cloudTransformPanel, 'motion.velocities.detail', 'detailVel', '0.001');

  const cloudMarchPanel = makeCompactControlPanel(
    'Cloud march/render/tuning controls',
    'March cost, empty skipping, alpha shaping, sparsity, definition, and overlay.',
  );

  function addCloudMarchControl(path, label, type = 'number', step = 'any', opts = {}) {
    const control = makeCompactInput({
      label,
      value: getPathValue(clouds.value, path, opts.fallback ?? ''),
      type,
      step,
      min: opts.min ?? null,
      max: opts.max ?? null,
      options: opts.options ?? null,
      onChange: (next) => updateEditorPath(clouds, path, next, `Cloud ${label}`),
    });
    cloudMarchPanel.grid.appendChild(control.wrap);
    registerEditorPathInput(clouds, path, control, type);
    return control;
  }

  addCloudMarchControl('render.opacity', 'opacity', 'number', '0.01');
  addCloudMarchControl('render.alphaPower', 'alphaPower', 'number', '0.01');
  addCloudMarchControl('render.alphaCutoff', 'alphaCutoff', 'number', '0.001');
  addCloudMarchControl('render.stepBase', 'stepBase', 'number', '0.001');
  addCloudMarchControl('render.stepInc', 'stepInc', 'number', '0.001');
  addCloudMarchControl('tuning.maxSteps', 'maxSteps', 'number', '1', { min: 1 });
  addCloudMarchControl('tuning.minStep', 'minStep', 'number', '0.0005');
  addCloudMarchControl('tuning.maxStep', 'maxStep', 'number', '0.001');
  addCloudMarchControl('tuning.sunSteps', 'sunSteps', 'number', '1', { min: 1 });
  addCloudMarchControl('tuning.sunStride', 'sunStride', 'number', '1', { min: 1 });
  addCloudMarchControl('tuning.weatherRejectGate', 'rejectGate', 'number', '0.001');
  addCloudMarchControl('tuning.baseJitterFrac', 'baseJitter', 'number', '0.001');
  addCloudMarchControl('tuning.topJitterFrac', 'topJitter', 'number', '0.001');
  addCloudMarchControl('tuning.sliceJitterStrength', 'sliceJitter', 'number', '0.001');
  addCloudMarchControl('tuning.verticalLayerDecorrelation', 'vertDecor', 'number', '0.01');
  addCloudMarchControl('tuning.emptySkipMult', 'emptySkip', 'number', '0.01');
  addCloudMarchControl('tuning.nearDensityMult', 'nearDens', 'number', '0.01');
  addCloudMarchControl('tuning.farDetailAtten', 'farDetail', 'number', '0.01');
  addCloudMarchControl('tuning.alphaBoostThreshold', 'alphaThres', 'number', '0.01');
  addCloudMarchControl('tuning.alphaBoostAmount', 'alphaBoost', 'number', '0.01');
  addCloudMarchControl('tuning.minOutputAlpha', 'minOutAlpha', 'number', '0.01');
  addCloudMarchControl('tuning.outputAlphaFeather', 'alphaFeather', 'number', '0.01');
  addCloudMarchControl('tuning.sparsity', 'sparsity', 'number', '0.01');
  addCloudMarchControl('tuning.definition', 'definition', 'number', '0.01');
  addCloudMarchControl('performance.lodBiasMul', 'lodBiasMul', 'number', '0.01');
  addCloudMarchControl('performance.coarseMipBias', 'coarseMip', 'number', '0.01');
  addCloudMarchControl('performance.coarseFactor', 'coarseFactor', 'number', '1', { min: 1 });

  const overview = document.createElement('div');
  overview.style.cssText = 'display:grid;gap:8px';
  overview.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr;gap:3px;font-size:9px">
      <div style="padding:4px;border:1px solid rgba(255,255,255,0.12);border-radius:8px;background:rgba(255,255,255,0.04)"><b>Planet render</b><br>segments, gradient, height, atmosphere</div>
      <div style="padding:4px;border:1px solid rgba(255,255,255,0.12);border-radius:8px;background:rgba(255,255,255,0.04)"><b>Noise globals</b><br>planet zoom, enabled layers, default overrides</div>
      <div style="padding:4px;border:1px solid rgba(255,255,255,0.12);border-radius:8px;background:rgba(255,255,255,0.04)"><b>Mixer</b><br>terrain layers, cloud texture modes, aurora texture modes</div>
      <div style="padding:4px;border:1px solid rgba(255,255,255,0.12);border-radius:8px;background:rgba(255,255,255,0.04)"><b>Clouds</b><br>shell, lighting, transforms, march, x4 interleave</div>
    </div>
  `;

  const renderSection = document.createElement('div');
  renderSection.style.cssText = 'display:grid;gap:6px';
  renderSection.append(planetColorPanel.box, planetRender.element);

  const noiseSection = document.createElement('div');
  noiseSection.style.cssText = 'display:grid;gap:6px';
  noiseSection.append(planetQuick.box, planetNoise.element);

  const remixSection = document.createElement('div');
  remixSection.style.cssText = 'display:grid;gap:6px';
  remixSection.append(
    remixQuickPanel.box,
    stackQuick.box,
    cloudTexPanel.box,
    cloudChannelPanel.box,
    auroraTexPanel.box,
    auroraChannelPanel.box,
    planetStack.element,
  );

  const cloudSection = document.createElement('div');
  cloudSection.style.cssText = 'display:grid;gap:6px';
  cloudSection.append(
    cloudQuick.box,
    cloudParamsPanel.box,
    cloudLookPanel.box,
    cloudTransformPanel.box,
    cloudMarchPanel.box,
    auroraQuick.box,
    auroraParamsPanel.box,
    auroraLookPanel.box,
    auroraTransformPanel.box,
    auroraMarchPanel.box,
    clouds.element,
  );

  const sections = [
    { key: 'overview', label: 'Overview', node: overview },
    { key: 'render', label: 'Render', node: renderSection },
    { key: 'planetNoise', label: 'Terrain', node: noiseSection },
    { key: 'mixer', label: 'Mixer', node: remixSection },
    { key: 'clouds', label: 'Clouds', node: cloudSection },
    { key: 'reference', label: 'Refs', node: reference.element },
  ];

  const tabButtons = {};
  for (const section of sections) {
    section.node.style.display = 'none';
    sectionHost.appendChild(section.node);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = section.label;
    button.style.cssText = [
      'border:1px solid rgba(255,255,255,0.16)',
      'border-radius:8px',
      'background:rgba(255,255,255,0.06)',
      'color:#e8eefc',
      'padding:3px 5px',
      'font:9px system-ui,sans-serif',
      'cursor:pointer',
    ].join(';');
    button.addEventListener('click', () => setActiveSection(section.key));
    tabButtons[section.key] = button;
    tabRow.appendChild(button);
  }

  function setActiveSection(key) {
    for (const section of sections) {
      const active = section.key === key;
      section.node.style.display = active ? 'block' : 'none';
      const button = tabButtons[section.key];
      if (button) {
        button.style.background = active ? 'rgba(132,184,255,0.24)' : 'rgba(255,255,255,0.06)';
        button.style.borderColor = active ? 'rgba(132,184,255,0.62)' : 'rgba(255,255,255,0.16)';
      }
    }
    sectionHost.scrollTop = 0;
  }

  const actionRow = document.createElement('div');
  actionRow.style.cssText = [
    'display:grid',
    'grid-template-columns:repeat(2,minmax(0,1fr))',
    'gap:4px',
    'padding-top:4px',
    'margin-top:4px',
  ].join(';');

  const rebakeButton = document.createElement('button');
  rebakeButton.type = 'button';
  rebakeButton.textContent = 'Rebake same seed';

  const randomButton = document.createElement('button');
  randomButton.type = 'button';
  randomButton.textContent = 'New seed + rebake';

  const rebakeCloudButton = document.createElement('button');
  rebakeCloudButton.type = 'button';
  rebakeCloudButton.textContent = 'Rebake cloud textures';

  const currentStackButton = document.createElement('button');
  currentStackButton.type = 'button';
  currentStackButton.textContent = 'Use current stack';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.textContent = 'Reset editors';

  const validateButton = document.createElement('button');
  validateButton.type = 'button';
  validateButton.textContent = 'Validate';

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = 'Export';

  const importButton = document.createElement('button');
  importButton.type = 'button';
  importButton.textContent = 'Import';

  const saveLocalButton = document.createElement('button');
  saveLocalButton.type = 'button';
  saveLocalButton.textContent = 'Save local';

  const loadLocalButton = document.createElement('button');
  loadLocalButton.type = 'button';
  loadLocalButton.textContent = 'Load local';

  const deleteLocalButton = document.createElement('button');
  deleteLocalButton.type = 'button';
  deleteLocalButton.textContent = 'Delete local';

  for (const button of [rebakeButton, randomButton, rebakeCloudButton, currentStackButton, resetButton, validateButton, exportButton, importButton, saveLocalButton, loadLocalButton, deleteLocalButton]) {
    button.style.cssText = 'border:1px solid rgba(255,255,255,0.18);border-radius:6px;background:rgba(255,255,255,0.08);color:#e8eefc;padding:4px 5px;font:10px system-ui,sans-serif;cursor:pointer;min-width:0';
  }

  const liveCloudRow = document.createElement('label');
  liveCloudRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:5px;font:10px system-ui,sans-serif;color:rgba(226,238,255,0.76)';
  const liveCloudApplyInput = document.createElement('input');
  liveCloudApplyInput.type = 'checkbox';
  liveCloudApplyInput.checked = true;
  liveCloudApplyInput.style.cssText = 'width:13px;height:13px;accent-color:#84b8ff';
  const liveCloudText = document.createElement('span');
  liveCloudText.textContent = 'live-apply non-texture cloud settings';
  liveCloudRow.append(liveCloudApplyInput, liveCloudText);

  const localRow = document.createElement('div');
  localRow.style.cssText = [
    'display:grid',
    'grid-template-columns:1fr',
    'gap:5px',
    'align-items:center',
  ].join(';');

  const localNameInput = document.createElement('input');
  localNameInput.type = 'text';
  localNameInput.placeholder = 'optional save name';
  localNameInput.style.cssText = 'min-width:0;border:1px solid rgba(255,255,255,0.16);border-radius:6px;background:rgba(0,0,0,0.42);color:#e8eefc;padding:4px 6px;font:10px system-ui,sans-serif;outline:none';

  const savedSelect = document.createElement('select');
  savedSelect.title = 'Saved local tweak snapshots';
  savedSelect.style.cssText = 'min-width:0;border:1px solid rgba(255,255,255,0.16);border-radius:6px;background:rgba(0,0,0,0.42);color:#e8eefc;padding:4px 6px;font:10px system-ui,sans-serif;outline:none';

  localRow.append(localNameInput, savedSelect);

  const status = document.createElement('div');
  status.textContent = 'Ready. Edit JSON, then rebake manually.';
  status.style.cssText = 'font-size:10px;color:rgba(226,238,255,0.68);white-space:pre-wrap';

  actionRow.append(rebakeButton, randomButton, rebakeCloudButton, currentStackButton, resetButton, validateButton, exportButton, importButton, saveLocalButton, loadLocalButton, deleteLocalButton);
  body.append(tabRow, sectionHost, actionRow, liveCloudRow, localRow, status);
  header.append(title, collapse);
  panel.append(header, body);
  setActiveSection('mixer');

  let collapsed = false;
  collapse.addEventListener('click', () => {
    collapsed = !collapsed;
    body.style.display = collapsed ? 'none' : 'block';
    collapse.textContent = collapsed ? 'Show' : 'Hide';
  });

  function readJson(editor, label) {
    try {
      const value = editor.value;
      editor.error.style.display = 'none';
      return value;
    } catch (err) {
      editor.showError(new Error(`${label} JSON error:\n${err.message || err}`));
      throw err;
    }
  }

  function currentSeedForEditors(renderSeed = null) {
    const candidates = [
      renderSeed,
      window.noisePlanetTestRender?.currentSeed,
      window.noisePlanetTestNoiseConfig?.seed,
      window.noisePlanetTestLastSnapshot?.seed,
    ];
    for (const candidate of candidates) {
      const n = Number(candidate);
      if (Number.isFinite(n)) return Math.floor(n);
    }
    return 123456789;
  }

  function pickGradientIndexForSeed(seed, fallback = 0) {
    const n = Number(seed);
    const count = Math.max(1, PLANET_GRADIENTS.length);
    if (!Number.isFinite(n)) return Math.max(0, Math.min(count - 1, fallback | 0));
    const state = (Math.imul((Math.floor(n) >>> 0) ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0;
    return state % count;
  }

  function readOptions({ newSeed = false } = {}) {
    const render = readJson(planetRender, 'Planet render');
    const noise = readJson(planetNoise, 'Planet noise globals');
    const stack = readJson(planetStack, 'Planet noise stack');
    const cloudConfig = readJson(clouds, 'Spherical cloud settings');
    const opts = mergePlain(render, noise);
    opts.clouds = cloudConfig;
    if (noise.enabled && !opts.enabledNoise) opts.enabledNoise = noise.enabled;
    if (Array.isArray(stack) && stack.length) opts.noiseConfigs = stack;

    // Normal Rebake JSON should be exact/repeatable. Only New seed + rebake changes this.
    if (newSeed) {
      opts.seed = Date.now();
      const nextGradient = pickGradientIndexForSeed(opts.seed, currentGradientForEditors(opts.gradientIndex ?? opts.gradient) ?? 0);
      opts.gradientIndex = nextGradient;
      opts.gradient = nextGradient;
      try {
        updateEditorPath(planetRender, 'gradientIndex', nextGradient, 'Planet gradient');
      } catch {}
    } else {
      opts.seed = currentSeedForEditors(opts.seed);
      const currentGradient = currentGradientForEditors(opts.gradientIndex ?? opts.gradient);
      if (currentGradient !== null) {
        opts.gradientIndex = currentGradient;
        opts.gradient = currentGradient;
      }
    }
    return opts;
  }

  function readSnapshot() {
    const mergedOptions = readOptions();
    const snapshot = {
      version: 'noise-planet-tweak-snapshot-v1',
      exportedAt: new Date().toISOString(),
      seed: mergedOptions.seed,
      gradientIndex: mergedOptions.gradientIndex,
      gradientName: PLANET_GRADIENTS[mergedOptions.gradientIndex]?.name,
      planetRender: readJson(planetRender, 'Planet render'),
      planetNoise: readJson(planetNoise, 'Planet noise globals'),
      planetStack: readJson(planetStack, 'Planet noise stack'),
      clouds: readJson(clouds, 'Spherical cloud settings'),
      mergedOptions,
    };
    snapshot.planetRender.seed = mergedOptions.seed;
    snapshot.planetRender.gradientIndex = mergedOptions.gradientIndex;
    snapshot.planetRender.gradient = mergedOptions.gradientIndex;
    return snapshot;
  }

  function applySnapshot(snapshot) {
    const s = snapshot?.version ? snapshot : { mergedOptions: snapshot };
    const merged = s.mergedOptions || s;
    if (Number.isFinite(Number(s.seed)) && !Number.isFinite(Number(merged.seed))) merged.seed = Number(s.seed);
    if (Number.isFinite(Number(s.gradientIndex)) && !Number.isFinite(Number(merged.gradientIndex))) merged.gradientIndex = Number(s.gradientIndex);
    planetRender.setValue(s.planetRender || makePlanetRenderEditorOptions(merged));
    planetNoise.setValue(s.planetNoise || makePlanetNoiseEditorOptions(merged));
    planetStack.setValue(Array.isArray(s.planetStack) ? s.planetStack : makePlanetNoiseStackEditorOptions(merged));
    clouds.setValue(s.clouds || makeCloudEditorOptions(merged));
    status.textContent = 'Imported snapshot into editors. Nothing rebaked yet.';
    refreshStackSelect();
    syncSelectedStackInputs();
    syncEditorPathInputs(planetRender);
    syncEditorPathInputs(planetNoise);
    syncEditorPathInputs(clouds);
    syncCloudTextureInputs();
    syncAuroraTextureInputs();
    syncCloudLookInputs();
    syncAuroraLookInputs();
    syncCloudChannelInputs();
    setActiveSection('overview');
  }

  const LOCAL_SNAPSHOT_KEY = 'noisePlanetTest:tweakSnapshots:v1';

  function loadLocalSnapshots() {
    try {
      const raw = localStorage.getItem(LOCAL_SNAPSHOT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((item) => item && item.snapshot) : [];
    } catch (err) {
      console.warn('Failed to read local tweak snapshots:', err);
      return [];
    }
  }

  function writeLocalSnapshots(items) {
    localStorage.setItem(LOCAL_SNAPSHOT_KEY, stableJson(items));
    window.noisePlanetTestSavedSnapshots = items;
  }

  function formatSavedSnapshotLabel(item, index) {
    const name = item?.name || `Slot ${index + 1}`;
    const when = item?.savedAt ? new Date(item.savedAt) : null;
    const stamp = when && Number.isFinite(when.getTime())
      ? when.toLocaleString()
      : 'unsaved date';
    return `${index + 1}. ${name} — ${stamp}`;
  }

  function refreshSavedSelect(selectedId = savedSelect.value) {
    const items = loadLocalSnapshots();
    savedSelect.textContent = '';
    if (!items.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No local saves yet';
      savedSelect.appendChild(option);
      savedSelect.disabled = true;
      window.noisePlanetTestSavedSnapshots = [];
      return [];
    }

    savedSelect.disabled = false;
    for (const [index, item] of items.entries()) {
      const option = document.createElement('option');
      option.value = item.id || String(index);
      option.textContent = formatSavedSnapshotLabel(item, index);
      savedSelect.appendChild(option);
    }

    const hasSelected = items.some((item, index) => (item.id || String(index)) === selectedId);
    savedSelect.value = hasSelected ? selectedId : (items[items.length - 1].id || String(items.length - 1));
    window.noisePlanetTestSavedSnapshots = items;
    return items;
  }

  function selectedLocalSnapshot() {
    const items = refreshSavedSelect(savedSelect.value);
    const selected = savedSelect.value;
    const index = items.findIndex((item, i) => (item.id || String(i)) === selected);
    return index >= 0 ? { items, item: items[index], index } : { items, item: null, index: -1 };
  }

  function saveLocalSnapshot() {
    const items = loadLocalSnapshots();
    const snapshot = readSnapshot();
    const nextIndex = items.length + 1;
    const name = localNameInput.value.trim() || `Slot ${nextIndex}`;
    const item = {
      id: `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      savedAt: new Date().toISOString(),
      snapshot,
    };
    items.push(item);
    writeLocalSnapshots(items);
    refreshSavedSelect(item.id);
    localNameInput.value = '';
    status.textContent = `Saved local snapshot "${name}" to localStorage. Nothing rebaked.`;
  }

  function loadSelectedLocalSnapshot() {
    const { item } = selectedLocalSnapshot();
    if (!item) {
      status.textContent = 'No local snapshot selected.';
      return;
    }
    applySnapshot(item.snapshot);
    status.textContent = `Loaded local snapshot "${item.name || 'unnamed'}" into editors. Nothing rebaked yet.`;
  }

  function deleteSelectedLocalSnapshot() {
    const { items, item, index } = selectedLocalSnapshot();
    if (!item || index < 0) {
      status.textContent = 'No local snapshot selected.';
      return;
    }
    const label = item.name || `Slot ${index + 1}`;
    const keep = items.filter((_, i) => i !== index);
    writeLocalSnapshots(keep);
    refreshSavedSelect();
    status.textContent = `Deleted local snapshot "${label}".`;
  }

  validateButton.addEventListener('click', () => {
    try {
      const snapshot = readSnapshot();
      const report = validateTweakCoverageSnapshot(snapshot);
      window.noisePlanetTestLastValidation = report;
      if (report.ok && !report.warnings.length) {
        status.textContent = 'Validation OK: all known planet/cloud control blocks are present.';
      } else {
        status.textContent = [
          report.ok ? 'Validation OK with warnings.' : `Validation found ${report.missing.length} missing key(s).`,
          report.missing.length ? `Missing:
- ${report.missing.slice(0, 40).join('\n- ')}${report.missing.length > 40 ? '\n- ...' : ''}` : '',
          report.warnings.length ? `Warnings:
- ${report.warnings.join('\n- ')}` : '',
        ].filter(Boolean).join('\n');
      }
    } catch (err) {
      status.textContent = `Validation failed: ${err?.message || err}`;
    }
  });

  exportButton.addEventListener('click', async () => {
    try {
      const snapshot = readSnapshot();
      const raw = stableJson(snapshot);
      window.noisePlanetTestLastSnapshot = snapshot;
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(raw);
      status.textContent = 'Exported current editors to window.noisePlanetTestLastSnapshot and copied JSON to clipboard.';
    } catch (err) {
      status.textContent = `Export failed: ${err?.message || err}`;
    }
  });

  importButton.addEventListener('click', () => {
    const raw = window.prompt('Paste a noise planet tweak snapshot JSON:');
    if (!raw) return;
    try {
      applySnapshot(JSON.parse(raw));
    } catch (err) {
      status.textContent = `Import failed: ${err?.message || err}`;
    }
  });

  saveLocalButton.addEventListener('click', () => {
    try {
      saveLocalSnapshot();
    } catch (err) {
      status.textContent = `Local save failed: ${err?.message || err}`;
    }
  });

  loadLocalButton.addEventListener('click', () => {
    try {
      loadSelectedLocalSnapshot();
    } catch (err) {
      status.textContent = `Local load failed: ${err?.message || err}`;
    }
  });

  deleteLocalButton.addEventListener('click', () => {
    try {
      deleteSelectedLocalSnapshot();
    } catch (err) {
      status.textContent = `Local delete failed: ${err?.message || err}`;
    }
  });

  refreshSavedSelect();

  function resetEditors(nextOptions = options) {
    planetRender.setValue(makePlanetRenderEditorOptions(nextOptions));
    planetNoise.setValue(makePlanetNoiseEditorOptions(nextOptions));
    planetStack.setValue(makePlanetNoiseStackEditorOptions(nextOptions));
    clouds.setValue(makeCloudEditorOptions(nextOptions));
    status.textContent = 'Editors reset. Nothing rebaked yet.';
    refreshStackSelect();
    syncSelectedStackInputs();
    syncEditorPathInputs(planetRender);
    syncEditorPathInputs(planetNoise);
    syncEditorPathInputs(clouds);
    syncCloudTextureInputs();
    syncAuroraTextureInputs();
    syncCloudLookInputs();
    syncAuroraLookInputs();
    syncCloudChannelInputs();
    setActiveSection('overview');
  }

  return {
    element: panel,
    editors: { planetRender, planetNoise, planetStack, clouds, reference },
    buttons: { rebakeButton, randomButton, rebakeCloudButton, currentStackButton, resetButton, validateButton, exportButton, importButton, saveLocalButton, loadLocalButton, deleteLocalButton },
    setCloudLiveApply(handler) {
      liveCloudApplyHandler = typeof handler === 'function' ? handler : null;
    },
    readSnapshot,
    applySnapshot,
    refreshSavedSelect,
    saveLocalSnapshot,
    loadSelectedLocalSnapshot,
    deleteSelectedLocalSnapshot,
    status,
    readOptions,
    resetEditors,
    setActiveSection,
    setStatus(message) {
      status.textContent = message;
    },
    setCurrentStack(stack) {
      planetStack.setValue(Array.isArray(stack) ? stack : []);
      status.textContent = 'Loaded current baked planet stack into the editor. Click Rebake JSON to apply later.';
      refreshStackSelect();
      syncSelectedStackInputs();
      setActiveSection('mixer');
    },
  };
}

function createContainer(options = {}) {
  const parent = options.parent || document.body;
  document.documentElement.style.height = '100%';
  document.documentElement.style.overflow = 'hidden';
  document.body.style.height = '100%';
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';

  const container = document.createElement('section');
  container.id = options.containerId || 'noise-planet-test';
  container.style.cssText = [
    'position:fixed',
    'inset:0',
    'width:100vw',
    'height:100dvh',
    'min-height:0',
    'overflow:hidden',
    'background:#02040a',
    'color:#e8eefc',
    'font:10px/1.2 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  ].join(';');

  const canvas = document.createElement('canvas');
  canvas.id = options.canvasId || 'noise-planet-canvas';
  canvas.style.cssText = [
    'display:block',
    'width:100%',
    'height:100%',
    'touch-action:none',
    'outline:none',
  ].join(';');

  const hud = document.createElement('aside');
  hud.style.cssText = [
    'position:fixed',
    'left:8px',
    'top:8px',
    'bottom:8px',
    'z-index:5',
    'width:clamp(340px, 32vw, 430px)',
    'min-width:340px',
    'max-width:430px',
    'padding:6px',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:9px',
    'background:rgba(4,8,18,0.80)',
    'backdrop-filter:blur(10px)',
    'box-shadow:0 12px 34px rgba(0,0,0,0.35)',
    'display:block',
    'min-height:0',
    'overflow-y:auto',
    'overflow-x:hidden',
    'box-sizing:border-box',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'WGSL Planet Mesh Test';
  title.style.cssText = 'font-weight:700;font-size:10px;margin-bottom:4px;letter-spacing:0.02em';

  const status = document.createElement('div');
  status.textContent = 'Initializing WebGPU...';
  status.style.cssText = 'opacity:0.82;margin-bottom:4px;white-space:pre-line;font-size:9px';

  const actions = document.createElement('div');
  actions.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;align-items:center';

  const rerenderButton = document.createElement('button');
  rerenderButton.type = 'button';
  rerenderButton.textContent = 'Re-render';

  const disposeButton = document.createElement('button');
  disposeButton.type = 'button';
  disposeButton.textContent = 'Dispose';

  for (const button of [rerenderButton, disposeButton]) {
    button.style.cssText = [
      'appearance:none',
      'border:1px solid rgba(255,255,255,0.22)',
      'border-radius:7px',
      'background:rgba(255,255,255,0.08)',
      'color:#e8eefc',
      'padding:3px 5px',
      'font:inherit',
      'cursor:pointer',
    ].join(';');
  }

  const info = document.createElement('pre');
  info.style.cssText = [
    'margin:10px 0 0',
    'padding-top:8px',
    'border-top:1px solid rgba(255,255,255,0.12)',
    'white-space:pre-wrap',
    'font:9px/1.15 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    'opacity:0.80',
    'max-height:none',
    'overflow:visible',
    'flex:0 0 auto',
  ].join(';');

  const tweakPanel = createTweakPanel(options);

  actions.append(rerenderButton, disposeButton);
  hud.append(title, status, actions, info, tweakPanel.element);
  container.append(canvas, hud);
  parent.appendChild(container);

  return { container, canvas, status, info, rerenderButton, disposeButton, tweakPanel };
}

function getBabylonWebGpuDevice(engine) {
  const device = engine._device || engine._deviceWrapper?.device || engine._deviceManager?._device;
  const queue = device?.queue || engine._queue || engine._deviceQueue;

  if (!device || !queue) {
    throw new Error('Could not find the native GPUDevice/GPUQueue on Babylon WebGPUEngine. Check the engine internals for this Babylon version.');
  }

  return { device, queue };
}

async function withGpuValidationScope(device, label, fn) {
  if (typeof device?.pushErrorScope !== 'function' || typeof device?.popErrorScope !== 'function') {
    return await fn();
  }

  device.pushErrorScope('validation');

  let value;
  let caught = null;
  try {
    value = await fn();
    await device.queue?.onSubmittedWorkDone?.();
  } catch (err) {
    caught = err;
  }

  let scopedError = null;
  try {
    scopedError = await device.popErrorScope();
  } catch (err) {
    if (!caught) caught = err;
  }

  if (scopedError) {
    const message = scopedError.message || String(scopedError);
    throw new Error(`${label}: ${message}`);
  }

  if (caught) throw caught;
  return value;
}

function createScene(engine, canvas, radius, options = {}) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.005, 0.008, 0.018, 1.0);

  const camera = new BABYLON.ArcRotateCamera(
    'planet-camera',
    Math.PI * 0.35,
    Math.PI * 0.38,
    radius * 4.3,
    BABYLON.Vector3.Zero(),
    scene,
  );
  camera.minZ = 0.05;
  camera.maxZ = radius * 32;
  camera.wheelPrecision = 32;
  camera.lowerRadiusLimit = radius * 1.25;
  camera.upperRadiusLimit = radius * 12;
  camera.attachControl(canvas, true);

  const sun = new BABYLON.DirectionalLight('planet-sun', new BABYLON.Vector3(-0.65, -0.28, -0.72), scene);
  sun.position = new BABYLON.Vector3(radius * 4, radius * 2.2, radius * 4);
  sun.intensity = options.sunIntensity ?? 2.4;

  const sunSource = new BABYLON.TransformNode('planet-atmosphere-sun-source', scene);
  sunSource.position.copyFrom(sun.position);

  const fill = new BABYLON.HemisphericLight('planet-fill', new BABYLON.Vector3(0.0, 1.0, 0.0), scene);
  fill.intensity = options.fillIntensity ?? 0.18;
  fill.groundColor = new BABYLON.Color3(0.05, 0.06, 0.12);

  const glow = new BABYLON.GlowLayer('planet-glow', scene, { mainTextureRatio: 0.35, blurKernelSize: 24 });
  glow.intensity = options.glowIntensity ?? 0.12;

  const depthRenderer = options.atmosphere === false
    ? null
    : scene.enableDepthRenderer(camera, false, true);

  return { scene, camera, sun, sunSource, fill, glow, depthRenderer };
}

function addStars(scene, radius) {
  const pcs = new BABYLON.PointsCloudSystem('stars', 1, scene);
  const count = 6000;
  const inner = radius * 7;
  const outer = radius * 11;

  pcs.addPoints(count, (particle) => {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const distance = inner + Math.pow(Math.random(), 0.35) * (outer - inner);

    particle.position = new BABYLON.Vector3(
      distance * Math.sin(phi) * Math.cos(theta),
      distance * Math.sin(phi) * Math.sin(theta),
      distance * Math.cos(phi),
    );

    const c = 0.62 + Math.random() * 0.38;
    particle.color = new BABYLON.Color4(c, c, c + Math.random() * 0.08, 1.0);
  });

  pcs.buildMeshAsync().then(() => {
    if (!pcs.mesh) return;
    pcs.mesh.name = 'stars-mesh';
    pcs.mesh.isPickable = false;
    pcs.mesh.alwaysSelectAsActiveMesh = true;
  });

  return pcs;
}


function vec3Array(v, fallback = [0, 0, 0]) {
  if (!v) return fallback.slice();
  return [
    Number.isFinite(v.x) ? v.x : fallback[0],
    Number.isFinite(v.y) ? v.y : fallback[1],
    Number.isFinite(v.z) ? v.z : fallback[2],
  ];
}

function planetCloudCameraState(runtime) {
  const camera = runtime.camera;
  const canvas = runtime.ui?.canvas;
  const pos = camera.globalPosition || camera.position;
  const forwardRay = camera.getForwardRay?.(1);
  const fwd = forwardRay?.direction || camera.getDirection(BABYLON.Axis.Z);
  const right = camera.getDirection(BABYLON.Axis.X);
  const up = camera.getDirection(BABYLON.Axis.Y);
  const width = Math.max(canvas?.width || canvas?.clientWidth || 1, 1);
  const height = Math.max(canvas?.height || canvas?.clientHeight || 1, 1);

  return {
    camPos: vec3Array(pos, [0, 0, runtime.lastResult?.radius * 4 || 200]),
    right: vec3Array(right, [1, 0, 0]),
    up: vec3Array(up, [0, 1, 0]),
    fwd: vec3Array(fwd, [0, 0, -1]),
    fovYDeg: (camera.fov || Math.PI / 3) * 180 / Math.PI,
    aspect: width / height,
  };
}

function planetCloudSunDir(runtime) {
  const dir = runtime.sun?.direction || new BABYLON.Vector3(-0.65, -0.32, -0.65);
  const n = dir.normalize ? dir.normalize() : dir;
  return vec3Array(n.scale ? n.scale(-1) : { x: -n.x, y: -n.y, z: -n.z }, [0.65, 0.32, 0.65]);
}


function summarizePlanetAuroraSettings(layer, config, startedAt) {
  if (!layer) return null;
  return {
    enabled: true,
    cloudBottom: layer.options.cloudBottom,
    cloudTop: layer.options.cloudTop,
    renderScaleDivider: layer.options.renderScaleDivider,
    weatherSize: [layer.options.weatherWidth, layer.options.weatherHeight],
    shapeSize: layer.options.shapeSize,
    detailSize: layer.options.detailSize,
    elapsedMs: typeof startedAt === 'number' ? performance.now() - startedAt : undefined,
    timings: layer.timings,
    configSummary: layer.configSummary,
    requestedConfig: config,
    effectiveOptions: layer.options,
    resourceNonce: layer.options.resourceNonce,
    cap: clonePlain(config.cap || {}),
  };
}

function buildPlanetAuroraConfig(runtime, result, seed, options = {}) {
  const atmosphereRadius = runtime.atmosphereSettings?.atmosphereRadius ?? (result.radius + 18);
  const cloudsOverride = typeof options.clouds === 'object' ? options.clouds : {};
  const auroraOverride = typeof cloudsOverride.aurora === 'object' ? cloudsOverride.aurora : {};
  const config = mergePlain(defaultAuroraConfig(), auroraOverride);

  const transforms = mergePlain(config.transforms, {
    weatherOffsetWorld: config.motion?.offsets?.weatherOffsetWorld,
    shapeOffsetWorld: config.motion?.offsets?.shapeOffsetWorld,
    detailOffsetWorld: config.motion?.offsets?.detailOffsetWorld,
  });

  const auroraStyle = config.style || {};
  const auroraBrightness = Math.max(0, Number(auroraStyle.auroraBrightness ?? auroraStyle.brightness ?? 2.6) || 0);
  const auroraColor = Array.isArray(auroraStyle.auroraColor) ? auroraStyle.auroraColor : [0.36, 1.0, 0.78];
  const auroraShadowColor = Array.isArray(auroraStyle.auroraShadowColor) ? auroraStyle.auroraShadowColor : auroraColor;
  const colorize = (base, tint, gain = 1.0) => [
    (Number(base?.[0]) || 0) * (Number(tint?.[0]) || 0) * auroraBrightness * gain,
    (Number(base?.[1]) || 0) * (Number(tint?.[1]) || 0) * auroraBrightness * gain,
    (Number(base?.[2]) || 0) * (Number(tint?.[2]) || 0) * auroraBrightness * gain,
  ];
  const auroraParams = {
    ...(config.params || {}),
    sunColor: colorize(config.params?.sunColor || [0.7, 1.0, 0.98], auroraColor, 0.70),
    frontLightColor: colorize(config.params?.frontLightColor || [0.40, 1.28, 1.02], auroraColor, 1.0),
    shadowLightColor: colorize(config.params?.shadowLightColor || [0.16, 0.26, 0.34], auroraShadowColor, 0.90),
  };

  const cloudOptions = {
    seed: seed + 777,
    enabled: config.enabled !== false,
    canvasId: 'planet-spherical-aurora-canvas',
    canvasZIndex: 3,
    canvasBlendMode: 'plus-lighter',
    auroraMode: true,
    auroraCap: config.cap,
    sphereOffset: result.offset ?? options.offset ?? 0,
    sphereOffset2: result.offset2 ?? options.offset2 ?? 0,
    cloudBottom: config.shell?.cloudBottom,
    cloudTop: config.shell?.cloudTop,
    shellMaxHalfHeight: config.shell?.maxHalfHeight,
    weatherWidth: config.textures?.weatherWidth,
    weatherHeight: config.textures?.weatherHeight,
    shapeSize: config.textures?.shapeSize,
    detailSize: config.textures?.detailSize,
    blueWidth: config.textures?.blueWidth,
    blueHeight: config.textures?.blueHeight,
    renderScaleDivider: config.textures?.renderScaleDivider,
    updateEvery: config.textures?.updateEvery,
    outputFormat: config.textures?.outputFormat,
    animate: config.motion?.animate,
    spinSpeed: config.motion?.spinSpeed,
    meridionalDrift: config.motion?.meridionalDrift,
    shapeSpinFactor: config.motion?.shapeSpinFactor,
    detailSpinFactor: config.motion?.detailSpinFactor,
    velocities: config.motion?.velocities,
    transforms,
    weather: config.noise?.weather,
    weatherG: config.noise?.weatherG,
    weatherB: config.noise?.weatherB,
    shape: config.noise?.shape,
    detail: config.noise?.detail,
    blue: config.noise?.blue,
    params: auroraParams,
    tuning: config.tuning,
    reprojection: config.reprojection,
    performance: config.performance,
    style: config.style,
    worldToUV: config.render?.worldToUV,
    stepBase: config.render?.stepBase,
    stepInc: config.render?.stepInc,
    opacity: config.render?.opacity,
    alphaPower: config.render?.alphaPower,
    alphaCutoff: config.render?.alphaCutoff,
  };

  return { atmosphereRadius, config, cloudOptions };
}

async function setupPlanetAurora(runtime, result, seed, options = {}) {
  const auroraOptions = typeof options.clouds === 'object' ? options.clouds.aurora : null;
  if (options.clouds === false || auroraOptions?.enabled === false) {
    disposePlanetCloudLayer(runtime.planetAurora);
    runtime.planetAurora = null;
    runtime.planetAuroraSettings = null;
    window.noisePlanetTestAuroraConfig = null;
    return null;
  }

  disposePlanetCloudLayer(runtime.planetAurora);
  runtime.planetAurora = null;
  runtime.planetAuroraSettings = null;

  const { atmosphereRadius, config, cloudOptions: layerOptions } = buildPlanetAuroraConfig(runtime, result, seed, options);
  runtime.auroraBakeSerial = (runtime.auroraBakeSerial || 0) + 1;
  layerOptions.resourceNonce = `${seed}-aurora-${runtime.auroraBakeSerial}-${Date.now()}`;

  const started = performance.now();
  runtime.ui.status.textContent = 'Baking spherical aurora weather/shape/detail textures...';

  const layer = await createPlanetCloudLayer({
    device: runtime.device,
    queue: runtime.queue,
    parent: runtime.ui.container,
    sourceCanvas: runtime.ui.canvas,
    radius: result.radius,
    atmosphereRadius,
    getCameraState: () => planetCloudCameraState(runtime),
    getSunDir: () => planetCloudSunDir(runtime),
    options: layerOptions,
  });

  runtime.planetAurora = layer;
  runtime.planetAuroraSettings = summarizePlanetAuroraSettings(layer, config, started);
  window.noisePlanetTestAuroraConfig = runtime.planetAuroraSettings;

  await updatePlanetCloudLayer(layer);
  return layer;
}

async function applyPlanetAuroraLiveSettings(runtime, options = {}, meta = {}) {
  if (!runtime?.lastResult) return null;
  const seed = Math.floor(options.seed ?? runtime.currentSeed ?? window.noisePlanetTestCurrentSeed ?? Date.now());
  const auroraOptions = typeof options.clouds === 'object' ? options.clouds.aurora : null;
  if (options.clouds === false || auroraOptions?.enabled === false) {
    disposePlanetCloudLayer(runtime.planetAurora);
    runtime.planetAurora = null;
    runtime.planetAuroraSettings = null;
    window.noisePlanetTestAuroraConfig = null;
    return null;
  }

  const { atmosphereRadius, config, cloudOptions: layerOptions } = buildPlanetAuroraConfig(runtime, runtime.lastResult, seed, options);

  if (!runtime.planetAurora || runtime.planetAurora.disposed) {
    return setupPlanetAurora(runtime, runtime.lastResult, seed, options);
  }

  runtime.planetAurora.radius = runtime.lastResult.radius;
  runtime.planetAurora.atmosphereRadius = atmosphereRadius;

  updatePlanetCloudLayerOptions(runtime.planetAurora, layerOptions, {
    resetHistory: !!meta.resetHistory,
  });

  runtime.planetAuroraSettings = summarizePlanetAuroraSettings(runtime.planetAurora, config);
  window.noisePlanetTestAuroraConfig = runtime.planetAuroraSettings;

  await updatePlanetCloudLayer(runtime.planetAurora);
  return runtime.planetAurora;
}

async function rebakePlanetAuroraTexturesOnly(runtime, options = {}) {
  if (!runtime?.lastResult) return null;
  const seed = Math.floor(options.seed ?? runtime.currentSeed ?? window.noisePlanetTestCurrentSeed ?? Date.now());
  return setupPlanetAurora(runtime, runtime.lastResult, seed, options);
}

function buildPlanetCloudConfig(runtime, result, seed, options = {}) {
  const atmosphereRadius = runtime.atmosphereSettings?.atmosphereRadius ?? (result.radius + 18);
  const cloudOverrides = typeof options.clouds === 'object' ? options.clouds : {};
  const config = mergePlain(NOISE_PLANET_TEST_CLOUDS, cloudOverrides);
  const transforms = mergePlain(config.transforms, {
    weatherOffsetWorld: config.motion?.offsets?.weatherOffsetWorld,
    shapeOffsetWorld: config.motion?.offsets?.shapeOffsetWorld,
    detailOffsetWorld: config.motion?.offsets?.detailOffsetWorld,
  });

  const cloudOptions = {
    seed,
    enabled: config.enabled !== false,
    sphereOffset: result.offset ?? options.offset ?? 0,
    sphereOffset2: result.offset2 ?? options.offset2 ?? 0,
    cloudBottom: config.shell?.cloudBottom,
    cloudTop: config.shell?.cloudTop,
    shellMaxHalfHeight: config.shell?.maxHalfHeight,
    weatherWidth: config.textures?.weatherWidth,
    weatherHeight: config.textures?.weatherHeight,
    shapeSize: config.textures?.shapeSize,
    detailSize: config.textures?.detailSize,
    blueWidth: config.textures?.blueWidth,
    blueHeight: config.textures?.blueHeight,
    renderScaleDivider: config.textures?.renderScaleDivider,
    updateEvery: config.textures?.updateEvery,
    outputFormat: config.textures?.outputFormat,
    animate: config.motion?.animate,
    spinSpeed: config.motion?.spinSpeed,
    meridionalDrift: config.motion?.meridionalDrift,
    shapeSpinFactor: config.motion?.shapeSpinFactor,
    detailSpinFactor: config.motion?.detailSpinFactor,
    velocities: config.motion?.velocities,
    transforms,
    weather: config.noise?.weather,
    weatherG: config.noise?.weatherG,
    weatherB: config.noise?.weatherB,
    shape: config.noise?.shape,
    detail: config.noise?.detail,
    blue: config.noise?.blue,
    params: config.params,
    tuning: config.tuning,
    reprojection: config.reprojection,
    performance: config.performance,
    style: config.style,
    worldToUV: config.render?.worldToUV,
    stepBase: config.render?.stepBase,
    stepInc: config.render?.stepInc,
    opacity: config.render?.opacity,
    alphaPower: config.render?.alphaPower,
    alphaCutoff: config.render?.alphaCutoff,
  };

  return { atmosphereRadius, config, cloudOptions };
}

async function setupPlanetClouds(runtime, result, seed, options = {}) {
  const cloudOptions = options.clouds;
  if (cloudOptions === false || cloudOptions?.enabled === false) {
    disposePlanetCloudLayer(runtime.planetClouds);
    runtime.planetClouds = null;
    runtime.planetCloudSettings = null;
    return null;
  }

  disposePlanetCloudLayer(runtime.planetClouds);
  runtime.planetClouds = null;
  runtime.planetCloudSettings = null;

  const { atmosphereRadius, config, cloudOptions: layerOptions } = buildPlanetCloudConfig(runtime, result, seed, options);
  runtime.cloudBakeSerial = (runtime.cloudBakeSerial || 0) + 1;
  layerOptions.resourceNonce = `${seed}-${runtime.cloudBakeSerial}-${Date.now()}`;

  const started = performance.now();
  runtime.ui.status.textContent = 'Baking spherical cloud weather/shape/detail textures...';

  const layer = await createPlanetCloudLayer({
    device: runtime.device,
    queue: runtime.queue,
    // Use a dedicated noise builder for clouds so rebakes stay deterministic
    // and do not inherit any transient terrain-builder state.
    parent: runtime.ui.container,
    sourceCanvas: runtime.ui.canvas,
    radius: result.radius,
    atmosphereRadius,
    getCameraState: () => planetCloudCameraState(runtime),
    getSunDir: () => planetCloudSunDir(runtime),
    options: layerOptions,
  });

  runtime.planetClouds = layer;
  runtime.planetCloudSettings = {
    enabled: true,
    cloudBottom: layer.options.cloudBottom,
    cloudTop: layer.options.cloudTop,
    renderScaleDivider: layer.options.renderScaleDivider,
    weatherSize: [layer.options.weatherWidth, layer.options.weatherHeight],
    shapeSize: layer.options.shapeSize,
    detailSize: layer.options.detailSize,
    elapsedMs: performance.now() - started,
    timings: layer.timings,
    configSummary: layer.configSummary,
    requestedConfig: config,
    effectiveOptions: layer.options,
    resourceNonce: layer.options.resourceNonce,
  };

  window.noisePlanetTestCloudConfig = {
    requestedConfig: config,
    effectiveOptions: layer.options,
    resourceNonce: layer.options.resourceNonce,
    summary: layer.configSummary,
  };

  await updatePlanetCloudLayer(layer);
  return layer;
}

function cloudOptionsAffectBakedTextures(path = '') {
  const p = String(path || '');
  return isCloudTextureBakePath(p);
}

async function applyPlanetCloudLiveSettings(runtime, options = {}, meta = {}) {
  if (!runtime?.lastResult) return null;
  const seed = Math.floor(options.seed ?? runtime.currentSeed ?? window.noisePlanetTestCurrentSeed ?? Date.now());
  const { atmosphereRadius, config, cloudOptions: layerOptions } = buildPlanetCloudConfig(runtime, runtime.lastResult, seed, options);

  if (!runtime.planetClouds || runtime.planetClouds.disposed) {
    return setupPlanetClouds(runtime, runtime.lastResult, seed, options);
  }

  runtime.planetClouds.radius = runtime.lastResult.radius;
  runtime.planetClouds.atmosphereRadius = atmosphereRadius;

  updatePlanetCloudLayerOptions(runtime.planetClouds, layerOptions, {
    resetHistory: !!meta.resetHistory,
  });

  runtime.planetCloudSettings = {
    ...(runtime.planetCloudSettings || {}),
    enabled: true,
    cloudBottom: runtime.planetClouds.options.cloudBottom,
    cloudTop: runtime.planetClouds.options.cloudTop,
    renderScaleDivider: runtime.planetClouds.options.renderScaleDivider,
    weatherSize: [runtime.planetClouds.options.weatherWidth, runtime.planetClouds.options.weatherHeight],
    shapeSize: runtime.planetClouds.options.shapeSize,
    detailSize: runtime.planetClouds.options.detailSize,
    requestedConfig: config,
    effectiveOptions: runtime.planetClouds.options,
  };

  window.noisePlanetTestCloudConfig = {
    requestedConfig: config,
    effectiveOptions: runtime.planetClouds.options,
    summary: runtime.planetClouds.configSummary,
  };

  await updatePlanetCloudLayer(runtime.planetClouds);
  return runtime.planetClouds;
}

async function rebakePlanetCloudTexturesOnly(runtime, options = {}) {
  if (!runtime?.lastResult) return null;
  const seed = Math.floor(options.seed ?? runtime.currentSeed ?? window.noisePlanetTestCurrentSeed ?? Date.now());
  return setupPlanetClouds(runtime, runtime.lastResult, seed, options);
}

function disposeAtmosphere(runtime) {
  runtime.atmosphere?.dispose?.();
  runtime.atmosphere = null;

  runtime.atmosphereReference?.dispose?.();
  runtime.atmosphereReference = null;
  runtime.atmosphereSettings = null;
}

function createAtmosphereReference(scene, radius) {
  const mesh = BABYLON.MeshBuilder.CreateSphere(
    'planet-atmosphere-reference',
    { segments: 32, radius },
    scene,
  );
  mesh.isVisible = false;
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  return mesh;
}

function pickAtmosphereWavelengths(seed, options = {}) {
  if (options.atmosphere?.redWaveLength || options.atmosphere?.greenWaveLength || options.atmosphere?.blueWaveLength) {
    return {
      red: options.atmosphere.redWaveLength ?? 700,
      green: options.atmosphere.greenWaveLength ?? 530,
      blue: options.atmosphere.blueWaveLength ?? 440,
    };
  }

  if (options.atmosphereRandomizeWavelengths === false || options.atmosphere?.randomizeWavelengths === false) {
    return { red: 700, green: 530, blue: 440 };
  }

  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  return {
    red: 700 - rng() * 300,
    green: 530 - rng() * 200,
    blue: 440 - rng() * 100,
  };
}

function setupAtmosphere(runtime, result, seed, options = {}) {
  disposeAtmosphere(runtime);

  const atmosphereOptions = {
    enabled: DEFAULT_ATMOSPHERE_ENABLED,
    height: DEFAULT_ATMOSPHERE_HEIGHT,
    falloffFactor: 15,
    intensity: 15,
    scatteringStrength: 1,
    densityModifier: 1,
    ...(options.atmosphere || {}),
  };

  if (options.atmosphere === false || atmosphereOptions.enabled === false || !runtime.depthRenderer) {
    return null;
  }

  const terrainFloor = Math.min(0, result.minHeightValue || 0);
  const planetRadius = options.atmospherePlanetRadius
    ?? atmosphereOptions.planetRadius
    ?? result.radius + terrainFloor;
  const atmosphereRadius = options.atmosphereRadius
    ?? atmosphereOptions.atmosphereRadius
    ?? result.radius + (atmosphereOptions.height ?? DEFAULT_ATMOSPHERE_HEIGHT) + DEFAULT_ATMOSPHERE_RADIUS_PAD;

  const reference = createAtmosphereReference(runtime.scene, result.radius);
  runtime.atmosphereReference = reference;

  const wavelengths = pickAtmosphereWavelengths(seed, options);
  const postProcess = new AtmosphericScatteringPostProcess(
    'planet-atmosphere-postprocess',
    reference,
    planetRadius,
    atmosphereRadius,
    runtime.sunSource,
    runtime.camera,
    runtime.depthRenderer,
    runtime.scene,
    wavelengths.red,
    wavelengths.green,
    wavelengths.blue,
    atmosphereOptions,
  );

  runtime.atmosphere = postProcess;
  runtime.atmosphereSettings = {
    planetRadius,
    atmosphereRadius,
    redWaveLength: wavelengths.red,
    greenWaveLength: wavelengths.green,
    blueWaveLength: wavelengths.blue,
    falloffFactor: postProcess.settings.falloffFactor,
    intensity: postProcess.settings.intensity,
    scatteringStrength: postProcess.settings.scatteringStrength,
    densityModifier: postProcess.settings.densityModifier,
  };

  return postProcess;
}

function formatInfo(result, configSet, elapsedMs) {
  return [
    `seed              ${result.seed ?? 'stored in options'}`,
    `segments          ${result.segments}`,
    `vertices          ${result.vertexCount}`,
    `radius            ${result.radius}`,
    `heightScale       ${result.heightScale}`,
    `normalMode        ${result.normalMode || 'sphere'}`,
    `seam canonical    ${result.canonicalizeSeams !== false}`,
    `pole canonical    ${result.canonicalizePoles !== false}`,
    `polar cap mode   ${result.polarCapMode || 'fan'}`,
    `polar blend      ${result.polarBlendRows ?? 8} rows @ ${result.polarBlendStrength ?? 0.9}`,
    `gradient          ${result.gradient.name}`, 
    `mesh partitions   ${result.partitionCount}`,
    `max partition vtx ${result.maxVerticesPerPartition}`,
    `partition skirts  ${result.partitionSkirts ? `${result.partitionSkirtDepth.toFixed(3)} units` : 'off'}`,
    `atmosphere        ${result.atmosphereSettings ? `${result.atmosphereSettings.planetRadius.toFixed(3)} -> ${result.atmosphereSettings.atmosphereRadius.toFixed(3)}` : 'off'}`,
    `spherical clouds  ${result.planetCloudSettings ? `${result.planetCloudSettings.cloudBottom.toFixed(2)} -> ${result.planetCloudSettings.cloudTop.toFixed(2)} @ /${result.planetCloudSettings.renderScaleDivider}` : 'off'}`,
    `noise range       ${result.minNoiseValue.toFixed(4)} .. ${result.maxNoiseValue.toFixed(4)}`,
    `height range      ${result.minHeightValue.toFixed(4)} .. ${result.maxHeightValue.toFixed(4)}`,
    `elapsed           ${(elapsedMs / 1000).toFixed(2)}s`,
    `offset            ${(configSet.offset ?? 0).toFixed(4)}`,
    `offset2           ${(configSet.offset2 ?? 0).toFixed(4)}`,
    `randomizer1       ${(configSet.randomizer1 ?? 0).toFixed(4)}`,
    `randomizer2       ${(configSet.randomizer2 ?? 0).toFixed(4)}`,
    `randomizer3       ${(configSet.randomizer3 ?? 0).toFixed(4)}`,
    '',
    ...(result.noiseLabels || []),
  ].join('\n');
}

export async function noisePlanetTest(options = {}) {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not available in this browser.');
  }

  const mergedOptions = {
    ...(window.NOISE_PLANET_TEST_OPTIONS || {}),
    ...options,
  };

  const radius = mergedOptions.radius ?? DEFAULT_RADIUS;
  const ui = createContainer(mergedOptions);
  const engine = new BABYLON.WebGPUEngine(ui.canvas, {
    antialias: mergedOptions.antialias ?? true,
    adaptToDeviceRatio: mergedOptions.adaptToDeviceRatio ?? true,
  });

  await engine.initAsync();

  const { device, queue } = getBabylonWebGpuDevice(engine);
  const builder = await withGpuValidationScope(
    device,
    'NoiseComputeBuilder initialization',
    async () => new NoiseComputeBuilder(device, queue),
  );
  const { scene, camera, sun, sunSource, depthRenderer } = createScene(engine, ui.canvas, radius, mergedOptions);
  const stars = addStars(scene, radius);

  const runtime = {
    engine,
    device,
    queue,
    scene,
    camera,
    sun,
    sunSource,
    depthRenderer,
    builder,
    atmosphere: null,
    atmosphereReference: null,
    atmosphereSettings: null,
    planetClouds: null,
    planetCloudSettings: null,
    planetAurora: null,
    planetAuroraSettings: null,
    cloudUpdatePending: false,
    cloudUpdateErrorLogged: false,
    auroraUpdatePending: false,
    auroraUpdateErrorLogged: false,
    stars,
    ui,
    tweakPanel: ui.tweakPanel,
    meshes: [],
    renderToken: 0,
    disposed: false,
    lastResult: null,
  };

  async function disposePlanetMeshes({ preserveClouds = false } = {}) {
    disposeAtmosphere(runtime);

    if (!preserveClouds) {
      disposePlanetCloudLayer(runtime.planetClouds);
      runtime.planetClouds = null;
      runtime.planetCloudSettings = null;
      disposePlanetCloudLayer(runtime.planetAurora);
      runtime.planetAurora = null;
      runtime.planetAuroraSettings = null;
      window.noisePlanetTestAuroraConfig = null;
    }

    for (const mesh of runtime.meshes) {
      mesh.material?.dispose?.();
      mesh.dispose();
    }
    runtime.meshes = [];
  }

  async function renderPlanet(renderOptions = {}) {
    const token = ++runtime.renderToken;
    const seed = Math.floor(renderOptions.seed ?? runtime.currentSeed ?? mergedOptions.seed ?? Date.now());
    runtime.currentSeed = seed;
    mergedOptions.seed = seed;
    const segments = Math.max(8, Math.floor(renderOptions.segments ?? mergedOptions.segments ?? DEFAULT_SEGMENTS));
    const heightScale = renderOptions.heightScale ?? mergedOptions.heightScale ?? DEFAULT_HEIGHT_SCALE;
    const gradient = gradientIndexFromOptions(
      { gradient: renderOptions.gradient ?? mergedOptions.gradient, gradientIndex: renderOptions.gradientIndex ?? mergedOptions.gradientIndex },
      runtime.currentGradientIndex ?? (seed % PLANET_GRADIENTS.length),
    );
    runtime.currentGradientIndex = gradient;
    mergedOptions.gradientIndex = gradient;
    mergedOptions.gradient = gradient;
    const configSet = createNoisePlanetConfigSet(seed, {
      randomizeNoise: DEFAULT_RANDOMIZE_NOISE,
      ...mergedOptions,
      ...renderOptions,
    });
    configSet.seed = seed;
    window.noisePlanetTestNoiseConfig = configSet;
    window.noisePlanetTestCurrentSeed = seed;
    window.noisePlanetTestCurrentGradient = {
      index: gradient,
      name: PLANET_GRADIENTS[gradient]?.name || `Gradient ${gradient}`,
    };
    const colorOptions = {
      autoRange: true,
      ...(mergedOptions.color || {}),
      ...(renderOptions.color || {}),
    };

    const preserveCloudTextures = !!renderOptions._preserveCloudTextures
      && !!runtime.planetClouds
      && !runtime.planetClouds.disposed
      && renderOptions.clouds !== false
      && renderOptions.clouds?.enabled !== false;

    ui.rerenderButton.disabled = true;
    ui.status.textContent = preserveCloudTextures
      ? 'Generating GPU planet mesh; preserving existing baked cloud textures...'
      : 'Generating GPU planet mesh...';

    await disposePlanetMeshes({ preserveClouds: preserveCloudTextures });

    const started = performance.now();
    const result = await withGpuValidationScope(
      device,
      'Planet GPU generation',
      async () => generatePlanetMeshGpu(
        builder,
        {
          seed,
          segments,
          radius,
          noiseConfigs: configSet.noiseConfigs,
          offset: configSet.offset,
          offset2: configSet.offset2,
          heightScale,
          gradient,
          color: colorOptions,
          normalMode: renderOptions.normalMode ?? mergedOptions.normalMode ?? 'sphere',
          flipGpuNormals: renderOptions.flipGpuNormals ?? mergedOptions.flipGpuNormals ?? false,
          canonicalizeSeams: renderOptions.canonicalizeSeams ?? mergedOptions.canonicalizeSeams ?? true,
          canonicalizePoles: renderOptions.canonicalizePoles ?? mergedOptions.canonicalizePoles ?? true,
          polarCapMode: renderOptions.polarCapMode ?? mergedOptions.polarCapMode ?? 'fan',
          polarBlendRows: renderOptions.polarBlendRows ?? mergedOptions.polarBlendRows ?? 8,
          polarBlendStrength: renderOptions.polarBlendStrength ?? mergedOptions.polarBlendStrength ?? 0.90,
          allowFlatHeightmap: renderOptions.allowFlatHeightmap ?? mergedOptions.allowFlatHeightmap ?? false,
          maxVerticesPerPartition: renderOptions.maxVerticesPerPartition
            ?? mergedOptions.maxVerticesPerPartition
            ?? MAX_VERTICES_PER_PARTITION,
          maxPositionsPerPartition: renderOptions.maxPositionsPerPartition
            ?? mergedOptions.maxPositionsPerPartition,
          useGpuSpherePositionMode: renderOptions.useGpuSpherePositionMode
            ?? mergedOptions.useGpuSpherePositionMode
            ?? true,
          partitionSkirts: renderOptions.partitionSkirts
            ?? mergedOptions.partitionSkirts
            ?? true,
          partitionSkirtDepth: renderOptions.partitionSkirtDepth
            ?? mergedOptions.partitionSkirtDepth,
          doubleSidedPartitionSkirts: renderOptions.doubleSidedPartitionSkirts
            ?? mergedOptions.doubleSidedPartitionSkirts
            ?? true,
          textureKey: `noise-planet-${seed}-${segments}-${runtime.renderToken}`,
        },
      ),
    );

    if (runtime.disposed || token !== runtime.renderToken) return null;

    const meshes = createBabylonPlanetMeshes(scene, result.partitions, {
      isPickable: false,
      alwaysSelectAsActiveMesh: true,
      specularColor: new BABYLON.Color3(0.015, 0.015, 0.015),
    });

    runtime.meshes = meshes;
    runtime.lastResult = result;
    setupAtmosphere(runtime, result, seed, { ...mergedOptions, ...renderOptions });
    result.atmosphereSettings = runtime.atmosphereSettings;

    if (preserveCloudTextures) {
      await applyPlanetCloudLiveSettings(runtime, { ...mergedOptions, ...renderOptions }, { resetHistory: true });
      await applyPlanetAuroraLiveSettings(runtime, { ...mergedOptions, ...renderOptions }, { resetHistory: true });
      runtime.planetCloudSettings = {
        ...(runtime.planetCloudSettings || {}),
        preservedTexturesOnPlanetRebake: true,
      };
      if (runtime.planetAuroraSettings) {
        runtime.planetAuroraSettings = {
          ...(runtime.planetAuroraSettings || {}),
          preservedTexturesOnPlanetRebake: true,
        };
      }
    } else {
      await setupPlanetClouds(runtime, result, seed, { ...mergedOptions, ...renderOptions });
      await setupPlanetAurora(runtime, result, seed, { ...mergedOptions, ...renderOptions });
    }

    result.planetCloudSettings = runtime.planetCloudSettings;
    result.planetAuroraSettings = runtime.planetAuroraSettings;
    window.noisePlanetTestCloudConfig = runtime.planetCloudSettings;
    window.noisePlanetTestAuroraConfig = runtime.planetAuroraSettings;

    const elapsedMs = performance.now() - started;
    ui.status.textContent = `Rendered in ${(elapsedMs / 1000).toFixed(2)}s`;
    ui.info.textContent = formatInfo({ ...result, seed }, configSet, elapsedMs);
    ui.rerenderButton.disabled = false;

    return meshes;
  }

  async function rebakeFromTweakPanel({ newSeed = false } = {}) {
    const panel = ui.tweakPanel;
    try {
      const nextOptions = panel.readOptions({ newSeed });
      panel.setStatus(newSeed ? 'Rebaking with a new seed...' : `Rebaking seed ${nextOptions.seed} from JSON editors...`);
      await renderPlanet({
        ...nextOptions,
        _fromTweakPanel: true,
        _preserveCloudTextures: !newSeed,
      });
      panel.setStatus(newSeed
        ? `Rebaked ${new Date().toLocaleTimeString()} with new seed and fresh cloud textures.`
        : `Rebaked ${new Date().toLocaleTimeString()} with same seed; preserved existing baked cloud textures. Use Rebake cloud textures for texture/noise changes.`
      );
    } catch (err) {
      console.error(err);
      panel.setStatus(`Rebake failed: ${err?.message || err}`);
      ui.status.textContent = err?.message || String(err);
      ui.rerenderButton.disabled = false;
    }
  }

  ui.tweakPanel.setCloudLiveApply(async () => {
    const nextOptions = ui.tweakPanel.readOptions({ newSeed: false });
    await applyPlanetCloudLiveSettings(runtime, nextOptions, { resetHistory: false });
    await applyPlanetAuroraLiveSettings(runtime, nextOptions, { resetHistory: false });
  });

  ui.rerenderButton.textContent = 'New seed + rebake';
  ui.rerenderButton.addEventListener('click', () => {
    rebakeFromTweakPanel({ newSeed: true });
  });

  ui.tweakPanel.buttons.rebakeButton.addEventListener('click', () => {
    rebakeFromTweakPanel({ newSeed: false });
  });

  ui.tweakPanel.buttons.randomButton.addEventListener('click', () => {
    rebakeFromTweakPanel({ newSeed: true });
  });

  ui.tweakPanel.buttons.rebakeCloudButton.addEventListener('click', async () => {
    try {
      const nextOptions = ui.tweakPanel.readOptions({ newSeed: false });
      ui.tweakPanel.setStatus('Rebaking cloud and aurora weather/shape/detail textures only...');
      await rebakePlanetCloudTexturesOnly(runtime, nextOptions);
      await rebakePlanetAuroraTexturesOnly(runtime, nextOptions);
      ui.tweakPanel.setStatus('Cloud and aurora textures rebaked only. Planet mesh/terrain was not regenerated.');
    } catch (err) {
      console.error(err);
      ui.tweakPanel.setStatus(`Cloud texture rebake failed: ${err?.message || err}`);
    }
  });

  ui.tweakPanel.buttons.currentStackButton.addEventListener('click', () => {
    ui.tweakPanel.setCurrentStack(window.noisePlanetTestNoiseConfig?.noiseConfigs || []);
  });

  ui.tweakPanel.buttons.resetButton.addEventListener('click', () => {
    ui.tweakPanel.resetEditors(window.NOISE_PLANET_TEST_OPTIONS || mergedOptions);
  });

  ui.disposeButton.addEventListener('click', () => {
    clearNoisePlanetTest(runtime);
  });

  const resize = () => engine.resize();
  window.addEventListener('resize', resize);
  runtime.resize = resize;
  runtime.renderPlanet = renderPlanet;

  scene.registerBeforeRender(() => {
    const t = performance.now() * 0.00008;
    sun.direction = new BABYLON.Vector3(-Math.cos(t), -0.32, -Math.sin(t)).normalize();
    sunSource.position.copyFrom(sun.direction.scale(-radius * 8));
    sun.position.copyFrom(sunSource.position);
    if (stars.mesh) stars.mesh.rotation.y += scene.getEngine().getDeltaTime() * 0.000008;

    if (runtime.planetClouds && !runtime.cloudUpdatePending) {
      runtime.cloudUpdatePending = true;
      updatePlanetCloudLayer(runtime.planetClouds)
        .catch((err) => {
          if (!runtime.cloudUpdateErrorLogged) {
            runtime.cloudUpdateErrorLogged = true;
            console.error('Planet cloud update failed', err);
          }
        })
        .finally(() => { runtime.cloudUpdatePending = false; });
    }

    if (runtime.planetAurora && !runtime.auroraUpdatePending) {
      runtime.auroraUpdatePending = true;
      updatePlanetCloudLayer(runtime.planetAurora)
        .catch((err) => {
          if (!runtime.auroraUpdateErrorLogged) {
            runtime.auroraUpdateErrorLogged = true;
            console.error('Planet aurora update failed', err);
          }
        })
        .finally(() => { runtime.auroraUpdatePending = false; });
    }
  });

  engine.runRenderLoop(() => {
    if (!runtime.disposed) scene.render();
  });

  await renderPlanet(mergedOptions);

  window.noisePlanetTestRender = runtime;
  window.noisePlanetTestTweakPanel = ui.tweakPanel;
  return runtime;
}

export async function clearNoisePlanetTest(runtime = window.noisePlanetTestRender) {
  if (!runtime || runtime.disposed) return;

  runtime.disposed = true;
  runtime.renderToken++;

  if (runtime.resize) window.removeEventListener('resize', runtime.resize);

  for (const mesh of runtime.meshes || []) {
    mesh.material?.dispose?.();
    mesh.dispose();
  }

  disposeAtmosphere(runtime);
  disposePlanetCloudLayer(runtime.planetClouds);
  runtime.planetClouds = null;
  disposePlanetCloudLayer(runtime.planetAurora);
  runtime.planetAurora = null;

  runtime.builder?.destroyAllTexturePairs?.();
  runtime.stars?.dispose?.();
  runtime.scene?.dispose?.();
  runtime.engine?.dispose?.();
  runtime.ui?.container?.remove?.();

  if (window.noisePlanetTestRender === runtime) {
    window.noisePlanetTestRender = null;
  }
  if (window.noisePlanetTestTweakPanel === runtime.ui?.tweakPanel) {
    window.noisePlanetTestTweakPanel = null;
  }
}

async function startNoisePlanetTestFromImport() {
  try {
    if (window.noisePlanetTestRender) {
      await clearNoisePlanetTest(window.noisePlanetTestRender);
    }

    await noisePlanetTest(window.NOISE_PLANET_TEST_OPTIONS || {});
  } catch (err) {
    console.error(err);
    const pre = document.createElement('pre');
    pre.textContent = err?.stack || err?.message || String(err);
    pre.style.cssText = [
      'position:fixed',
      'inset:12px',
      'z-index:9999',
      'overflow:auto',
      'padding:12px',
      'background:#14070a',
      'color:#ffd6d6',
      'border:1px solid #ff8f8f',
      'white-space:pre-wrap',
    ].join(';');
    document.body.appendChild(pre);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startNoisePlanetTestFromImport, { once: true });
} else {
  queueMicrotask(startNoisePlanetTestFromImport);
}

export default noisePlanetTest;
