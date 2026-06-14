import * as BABYLON from 'babylonjs';
import { NoiseComputeBuilder } from '../noise/noiseCompute';
import * as colorGrads from './planetGradients';

export interface Range {
  start: number;
  end: number;
}

export interface NoiseConfig {
  type: string;
  zoom?: number;
  octaves?: number;
  lacunarity?: number;
  gain?: number;
  xShift?: number;
  yShift?: number;
  zShift?: number;
  frequency?: number;
  xRange?: Range;
  yRange?: Range;
  zRange?: Range;
  seed?: number;
  transform?: number;
  scalar?: number;
  turbulence?: number | boolean;
  seedAngle?: number;
  exp1?: number;
  exp2?: number;
  threshold?: number;
  rippleFreq?: number;
  time?: number;
  warpAmp?: number;
  gaborRadius?: number;
  terraceStep?: number;
  toroidal?: number | boolean;
  voroMode?: number;
  edgeK?: number;
}

export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];
export type PlanetGradientInput = string | number | RGB[] | PlanetGradientChoice | undefined | null;
export type PlanetNormalMode = 'gpu' | 'sphere';
export type PlanetPolarCapMode = 'fan' | 'grid';

export interface PlanetGradientChoice {
  name: string;
  colors: RGB[];
}

export interface PlanetColorOptions {
  gradient?: PlanetGradientInput;
  minValue?: number;
  maxValue?: number;
  autoRange?: boolean;
  rangePadding?: number;
  blendClamp?: false | [number, number];
  invalidColor?: RGB;
}

export interface PlanetGpuOptions {
  seed: number;
  segments: number;
  radius: number;
  noiseConfigs?: NoiseConfig[];
  offset?: number;
  offset2?: number;
  heightScale?: number;
  maxVerticesPerPartition?: number;
  maxPositionsPerPartition?: number;
  partitionSkirts?: boolean;
  partitionSkirtDepth?: number;
  doubleSidedPartitionSkirts?: boolean;
  textureKey?: string;
  gradient?: PlanetGradientInput;
  color?: PlanetColorOptions;
  getColor?: (value: number) => RGB;
  normalMode?: PlanetNormalMode;
  flipGpuNormals?: boolean;
  includeHeightNormalData?: boolean;
  destroyTextureAfterRead?: boolean;
  maxTextureSideForCustomPositions?: number;
  useGpuSpherePositionMode?: boolean;
  allowFlatHeightmap?: boolean;
  canonicalizeSeams?: boolean;
  canonicalizePoles?: boolean;
  polarCapMode?: PlanetPolarCapMode;
  polarBlendRows?: number;
  polarBlendStrength?: number;
}

export interface PlanetMeshPartition {
  splitPositions: Float32Array;
  splitNormals: Float32Array;
  splitColors: Float32Array;
  splitUvs: Float32Array;
  splitIndices: Uint32Array;
  startLat: number;
  endLat: number;
  vertexCount: number;
  indexCount: number;
  minNoiseValue: number;
  maxNoiseValue: number;
  minHeightValue: number;
  maxHeightValue: number;
}

export interface PlanetHeightNormalMap {
  data: Float32Array;
  width: number;
  height: number;
  textureKey: string;
}

export interface PlanetNoiseConfigSet {
  noiseConfigs: NoiseConfig[];
  labels?: string[];
  offset?: number;
  offset2?: number;
  randomizer1?: number;
  randomizer2?: number;
  randomizer3?: number;
}

export interface PlanetGpuResult {
  seed: number;
  offset?: number;
  offset2?: number;
  randomizer1?: number;
  randomizer2?: number;
  randomizer3?: number;
  partitions: PlanetMeshPartition[];
  width: number;
  height: number;
  segments: number;
  radius: number;
  heightScale: number;
  normalMode: PlanetNormalMode;
  flipGpuNormals: boolean;
  canonicalizeSeams: boolean;
  canonicalizePoles: boolean;
  polarCapMode: PlanetPolarCapMode;
  polarBlendRows: number;
  polarBlendStrength: number;
  maxVerticesPerPartition: number;
  partitionSkirts: boolean;
  partitionSkirtDepth: number;
  gradient: PlanetGradientChoice;
  noiseConfigs: NoiseConfig[];
  noiseLabels: string[];
  textureKey: string;
  vertexCount: number;
  partitionCount: number;
  minNoiseValue: number;
  maxNoiseValue: number;
  minHeightValue: number;
  maxHeightValue: number;
  heightNormal?: PlanetHeightNormalMap;
}

export interface BabylonPlanetMeshOptions {
  shadowGenerator?: BABYLON.ShadowGenerator;
  materialFactory?: (partition: PlanetMeshPartition, index: number, scene: BABYLON.Scene) => BABYLON.Material;
  materialNamePrefix?: string;
  meshNamePrefix?: string;
  receiveShadows?: boolean;
  freezeMaterials?: boolean;
  freezeWorldMatrix?: boolean;
  alwaysSelectAsActiveMesh?: boolean;
  isPickable?: boolean;
  specularColor?: BABYLON.Color3;
}

const VERTEX_SIZE = 3;
const NORMAL_SIZE = 3;
const UV_SIZE = 2;
const COLOR_SIZE = 4;
const INDEX_SIZE = 6;
const DEFAULT_MAX_VERTICES_PER_PARTITION = 8_000_000;
const DEFAULT_HEIGHT_SCALE = 1.5;
const DEFAULT_MAX_TEXTURE_SIDE_FOR_CUSTOM_POSITIONS = 4096;
const DEFAULT_POLAR_CAP_MODE: PlanetPolarCapMode = 'fan';
const DEFAULT_POLAR_BLEND_ROWS = 8;
const DEFAULT_POLAR_BLEND_STRENGTH = 0.90;
const DEFAULT_PARTITION_SKIRTS = true;
const DEFAULT_PARTITION_SKIRT_DEPTH_FACTOR = 0.003;
const DEFAULT_MIN_PARTITION_SKIRT_DEPTH = 0.08;

export const PLANET_GRADIENTS: PlanetGradientChoice[] = [
  { name: 'Utahish', colors: colorGrads.gradientColorsUtah as RGB[] },
  { name: 'Volcanic', colors: colorGrads.gradientColorsVolcanic as RGB[] },
  { name: 'Desert', colors: colorGrads.gradientColorsDesert as RGB[] },
  { name: 'Forest', colors: colorGrads.gradientColorsForest as RGB[] },
  { name: 'Oceanic', colors: colorGrads.gradientColorsOceanic as RGB[] },
  { name: 'Ice', colors: colorGrads.gradientColorsIce as RGB[] },
  { name: 'Ice2', colors: colorGrads.gradientColorsIce2 as RGB[] },
  { name: 'Mars Dawn', colors: colorGrads.gradientColorsMarsDawn as RGB[] },
  { name: 'Badlands', colors: colorGrads.gradientColorsBadlands as RGB[] },
  { name: 'Jungle', colors: colorGrads.gradientColorsJungle as RGB[] },
  { name: 'Toxic', colors: colorGrads.gradientColorsToxic as RGB[] },
  { name: 'Lavender Dusk', colors: colorGrads.gradientColorsLavenderDusk as RGB[] },
  { name: 'Gas Giant', colors: colorGrads.gradientColorsGasGiant as RGB[] },
  { name: 'Copper Oxide', colors: colorGrads.gradientColorsCopperOxide as RGB[] },
  { name: 'Moon Dust', colors: colorGrads.gradientColorsMoonDust as RGB[] },
  { name: 'Coral Sea', colors: colorGrads.gradientColorsCoralSea as RGB[] },
];

export const noiseEntryPointByType: Record<string, string> = {
  PerlinNoise: 'computePerlin',
  BillowNoise: 'computeBillow',
  AntiBillowNoise: 'computeAntiBillow',
  RidgeNoise: 'computeRidge',
  AntiRidgeNoise: 'computeAntiRidge',
  RidgedMultifractalNoise: 'computeRidgedMultifractal',
  RidgedMultifractalNoise2: 'computeRidgedMultifractal2',
  RidgedMultifractalNoise3: 'computeRidgedMultifractal3',
  RidgedMultifractalNoise4: 'computeRidgedMultifractal4',
  AntiRidgedMultifractalNoise: 'computeAntiRidgedMultifractal',
  AntiRidgedMultifractalNoise2: 'computeAntiRidgedMultifractal2',
  AntiRidgedMultifractalNoise3: 'computeAntiRidgedMultifractal3',
  AntiRidgedMultifractalNoise4: 'computeAntiRidgedMultifractal4',
  FractalBrownianMotion: 'computeFBM',
  FractalBrownianMotion2: 'computeFBM2',
  FractalBrownianMotion3: 'computeFBM3',
  CellularNoise: 'computeCellular',
  WorleyNoise: 'computeWorley',
  AntiCellularNoise: 'computeAntiCellular',
  AntiWorleyNoise: 'computeAntiWorley',
  VoronoiTileNoise: 'computeVoronoiTileNoise',
  VoronoiCircleNoise: 'computeVoronoiCircleNoise',
  VoronoiCircle2: 'computeVoronoiCircle2',
  VoronoiFlatShade: 'computeVoronoiFlatShade',
  LanczosBillowNoise: 'computeLanczosBillow',
  LanczosAntiBillowNoise: 'computeLanczosAntiBillow',
  SimplexNoise: 'computeSimplex',
  SimplexFBM: 'computeSimplexFBM',
  TerrainNoise: 'computeTerrainNoise',
  TerraceNoise: 'computeTerraceNoise',
  FoamNoise: 'computeFoamNoise',
  TurbulenceNoise: 'computeTurbulence',
  SmokeNoise: 'computeSmokeNoise',
  FBM4D: 'computeFBM4D',
  Perlin4D: 'computePerlin4D',
  Worley4D: 'computeWorley4D',
  Cellular4D: 'computeCellular4D',
  Billow4D: 'computeBillow4D',
  LanczosBillow4D: 'computeLanczosBillow4D',
  Voronoi4D: 'computeVoronoi4D',
};

function halfToFloat32(h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;

  if (e === 0) {
    if (f === 0) return s ? -0 : 0;
    return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  }

  if (e === 31) return f ? NaN : (s ? -Infinity : Infinity);
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

function safeFinite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeRgb(color: number[]): RGB {
  return [
    Math.max(0, Math.min(255, Math.round(color[0] ?? 0))),
    Math.max(0, Math.min(255, Math.round(color[1] ?? 0))),
    Math.max(0, Math.min(255, Math.round(color[2] ?? 0))),
  ];
}

export function getPlanetGradient(input: PlanetGradientInput = 'Utahish'): PlanetGradientChoice {
  if (Array.isArray(input)) {
    return { name: 'Custom', colors: input.map(normalizeRgb) };
  }

  if (typeof input === 'object' && input && Array.isArray(input.colors)) {
    return {
      name: input.name || 'Custom',
      colors: input.colors.map(normalizeRgb),
    };
  }

  if (typeof input === 'number' && Number.isFinite(input)) {
    const index = Math.abs(Math.floor(input)) % PLANET_GRADIENTS.length;
    return PLANET_GRADIENTS[index];
  }

  if (typeof input === 'string') {
    const needle = input.trim().toLowerCase();
    const found = PLANET_GRADIENTS.find((entry) => entry.name.toLowerCase() === needle);
    if (found) return found;
  }

  return PLANET_GRADIENTS[0];
}

export function interpolatePlanetColor(colorA: RGB, colorB: RGB, amount: number): RGB {
  const t = clamp01(amount);
  return [
    Math.round(colorA[0] + t * (colorB[0] - colorA[0])),
    Math.round(colorA[1] + t * (colorB[1] - colorA[1])),
    Math.round(colorA[2] + t * (colorB[2] - colorA[2])),
  ];
}

export function createPlanetColorSampler(options: PlanetColorOptions = {}): (value: number) => RGB {
  const gradient = getPlanetGradient(options.gradient ?? 'Utahish');
  const colors = gradient.colors.length > 1 ? gradient.colors : PLANET_GRADIENTS[0].colors;
  const minValue = Number.isFinite(options.minValue) ? Number(options.minValue) : -1;
  const maxValue = Number.isFinite(options.maxValue) ? Number(options.maxValue) : 1;
  const invalidColor = normalizeRgb(options.invalidColor ?? [255, 255, 255]);
  const blendClamp = options.blendClamp === undefined ? [0.1, 0.9] : options.blendClamp;

  return (value: number): RGB => {
    if (!Number.isFinite(value)) return invalidColor;

    const denom = Math.max(1e-8, maxValue - minValue);
    const normalized = clamp01((value - minValue) / denom);
    const scaled = normalized * (colors.length - 1);
    const lowerIndex = Math.max(0, Math.min(colors.length - 2, Math.floor(scaled)));
    const upperIndex = Math.min(lowerIndex + 1, colors.length - 1);
    let t = scaled - lowerIndex;

    if (Array.isArray(blendClamp)) {
      t = Math.max(blendClamp[0], Math.min(blendClamp[1], t));
    }

    return interpolatePlanetColor(colors[lowerIndex], colors[upperIndex], t);
  };
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSignedMagnitude(rng: () => number, magnitude: number): number {
  return (rng() < 0.5 ? -1 : 1) * rng() * magnitude;
}

export function createDefaultPlanetNoiseConfigSet(seed: number, options: Record<string, any> = {}): PlanetNoiseConfigSet {
  const rng = mulberry32(seed);
  const offset = options.offset ?? pickSignedMagnitude(rng, 0.3);
  const offset2 = options.offset2 ?? pickSignedMagnitude(rng, 0.1);
  const randomizer1 = rng() * 0.4 - 0.2;
  const randomizer2 = rng() * 0.2 - 0.1;
  const randomizer3 = rng() * 0.2 - 0.1;
  const zoomFactor = options.zoomFactor ?? 1.3;

  const allConfigs: NoiseConfig[] = [
    {
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
    },
    {
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
    },
    {
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
    },
    {
      type: 'RidgedMultifractalNoise4',
      zoom: zoomFactor * 0.2,
      octaves: 6,
      lacunarity: 2.1,
      gain: 0.5,
      xShift: randomizer1 + 0.65,
      yShift: randomizer1 + 0.65,
      zShift: randomizer1 + 0.65,
      frequency: 1,
    },
    {
      type: 'LanczosBillowNoise',
      zoom: zoomFactor * 0.5,
      octaves: 6,
      lacunarity: 2.0,
      gain: 0.5,
      xShift: randomizer2 + 0.65,
      yShift: randomizer2 + 0.65,
      zShift: randomizer2 + 0.65,
      frequency: 1,
    },
  ];

  if (Array.isArray(options.noiseConfigs) && options.noiseConfigs.length) {
    return {
      noiseConfigs: options.noiseConfigs as NoiseConfig[],
      offset,
      offset2,
      randomizer1,
      randomizer2,
      randomizer3,
      labels: options.noiseConfigs.map((config: NoiseConfig) => config.type || 'unknown'),
    };
  }

  const enabled = options.randomizeNoise === false
    ? [true, true, true, true, true]
    : [rng() > 0.35, rng() > 0.45, rng() > 0.55, rng() > 0.35, rng() > 0.45];

  if (!enabled.some(Boolean)) {
    enabled[0] = true;
    enabled[3] = true;
  }

  const noiseConfigs = allConfigs.filter((_, index) => enabled[index]);
  const labels = allConfigs.map((config, index) => `${config.type}: ${enabled[index] ? 'on' : 'off'}`);

  return { noiseConfigs, offset, offset2, randomizer1, randomizer2, randomizer3, labels };
}

function validatePlanetOptions(builder: NoiseComputeBuilder, options: PlanetGpuOptions): void {
  if (!builder?.device || !builder?.queue) throw new Error('generatePlanetMeshGpu needs a NoiseComputeBuilder with a GPUDevice and GPUQueue.');
  if (!Number.isFinite(options.seed)) throw new Error('Planet seed must be a finite number.');
  if (!Number.isFinite(options.segments) || options.segments < 8) throw new Error('Planet segments must be at least 8.');
  if (!Number.isFinite(options.radius) || options.radius <= 0) throw new Error('Planet radius must be greater than zero.');
  if (Number.isFinite(options.maxVerticesPerPartition) && Number(options.maxVerticesPerPartition) < 1) {
    throw new Error('maxVerticesPerPartition must be greater than zero.');
  }
  if (Number.isFinite(options.maxPositionsPerPartition) && Number(options.maxPositionsPerPartition) < VERTEX_SIZE) {
    throw new Error('maxPositionsPerPartition must contain at least one vec3 position.');
  }

  if (options.useGpuSpherePositionMode === false) {
    const side = Math.floor(options.segments) + 1;
    const maxSide = Math.min(
      options.maxTextureSideForCustomPositions ?? DEFAULT_MAX_TEXTURE_SIDE_FOR_CUSTOM_POSITIONS,
      builder.device.limits?.maxTextureDimension2D ?? DEFAULT_MAX_TEXTURE_SIDE_FOR_CUSTOM_POSITIONS,
    );

    if (side > maxSide) {
      throw new Error(
        `Planet segments=${options.segments} needs a ${side}x${side} custom-position texture. `
        + `The legacy custom-position-buffer path is capped at ${maxSide} per side. `
        + 'Leave useGpuSpherePositionMode enabled to avoid the large storage buffer entirely.',
      );
    }
  }

  const configs = options.noiseConfigs ?? [];
  if (!configs.length) throw new Error('Planet GPU generation needs at least one noise config.');

  for (const config of configs) {
    if (!config?.type) throw new Error('Every noise config needs a type.');
    if (config.xRange || config.yRange || config.zRange) {
      throw new Error(`Noise config ${config.type} uses xRange/yRange/zRange. Per-config spatial gating is not available in the GPU accumulation path yet.`);
    }
  }
}

function buildSphereNoisePositions(segments: number, offset = 0, offset2 = 0): Float32Array {
  const side = segments + 1;
  const positions = new Float32Array(side * side * 4);
  let out = 0;

  for (let lat = 0; lat <= segments; lat++) {
    const atNorthPole = lat === 0;
    const atSouthPole = lat === segments;
    const theta = atNorthPole ? 0 : atSouthPole ? Math.PI : lat * Math.PI / segments;
    const sinTheta = atNorthPole || atSouthPole ? 0 : Math.sin(theta);
    const cosTheta = atNorthPole ? 1 : atSouthPole ? -1 : Math.cos(theta);
    const poleScaleLat = sinTheta;

    for (let lon = 0; lon <= segments; lon++) {
      const canonicalLon = lon === segments ? 0 : lon;
      const phi = canonicalLon * 2 * Math.PI / segments;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const poleScaleLon = sinPhi;
      const poleScale = poleScaleLat * poleScaleLon;

      const x = sinTheta * cosPhi;
      const y = sinTheta * sinPhi;
      const z = cosTheta;

      positions[out++] = x + 2 + poleScale * (offset * Math.sin(phi + theta) + offset2 * Math.cos(2 * phi));
      positions[out++] = y + 2 + poleScale * (offset * Math.cos(theta + phi) + offset2 * Math.sin(2 * theta));
      positions[out++] = z + 2 + poleScale * (offset * Math.sin(2 * phi + theta) + offset2 * Math.cos(2 * theta + phi));
      positions[out++] = 1;
    }
  }

  return positions;
}

function normalizedSeedAngle(seed: number): number {
  const s = Number.isFinite(seed) ? seed : 1;
  const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453123;
  return (x - Math.floor(x)) * Math.PI * 2;
}

function toNoiseParams(config: NoiseConfig, seed: number) {
  const noiseSeed = typeof config.seed === 'number' ? config.seed : seed;
  const isVoronoiTile = config.type === 'VoronoiTileNoise';

  return {
    seed: noiseSeed,
    zoom: config.zoom ?? 1.0,
    freq: config.frequency ?? 1.0,
    octaves: config.octaves ?? 6,
    lacunarity: config.lacunarity ?? 2.0,
    gain: config.gain ?? 0.5,
    xShift: config.xShift ?? 0,
    yShift: config.yShift ?? 0,
    zShift: config.zShift ?? 0,
    turbulence: config.turbulence ?? 0,
    seedAngle: config.seedAngle ?? normalizedSeedAngle(noiseSeed),
    exp1: config.exp1 ?? 1,
    exp2: config.exp2 ?? 0,
    threshold: config.threshold ?? (isVoronoiTile ? 0.05 : 0.1),
    rippleFreq: config.rippleFreq ?? 10,
    time: config.time ?? 0,
    warpAmp: config.warpAmp ?? 0.5,
    gaborRadius: config.gaborRadius ?? 4,
    terraceStep: config.terraceStep ?? 8,
    toroidal: config.toroidal ?? 0,
    voroMode: config.voroMode ?? (isVoronoiTile ? 4 : 0),
    edgeK: config.edgeK ?? 0,
    scalar: config.scalar ?? 1,
    transform: config.transform ?? 0,
  };
}

function measureNoiseRangeFromHeightNormalMap(heightNormal: Float32Array): { minValue: number; maxValue: number } {
  let minValue = Infinity;
  let maxValue = -Infinity;

  for (let i = 0; i < heightNormal.length; i += 4) {
    const value = heightNormal[i];
    if (!Number.isFinite(value)) continue;
    if (value < minValue) minValue = value;
    if (value > maxValue) maxValue = value;
  }

  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return { minValue: -1, maxValue: 1 };
  }

  if (Math.abs(maxValue - minValue) < 1e-8) {
    const center = minValue;
    return { minValue: center - 1, maxValue: center + 1 };
  }

  return { minValue, maxValue };
}

function copyHeightNormalPixel(data: Float32Array, dstPixel: number, srcPixel: number): void {
  const dst = dstPixel * 4;
  const src = srcPixel * 4;
  data[dst + 0] = data[src + 0];
  data[dst + 1] = data[src + 1];
  data[dst + 2] = data[src + 2];
  data[dst + 3] = data[src + 3];
}

export function canonicalizePlanetHeightNormalMap(
  data: Float32Array,
  segments: number,
  options: Pick<PlanetGpuOptions, 'canonicalizeSeams' | 'canonicalizePoles' | 'polarBlendRows' | 'polarBlendStrength'> = {},
): void {
  const side = segments + 1;
  if (data.length < side * side * 4) return;

  if (options.canonicalizeSeams ?? true) {
    for (let lat = 0; lat <= segments; lat++) {
      const row = lat * side;
      copyHeightNormalPixel(data, row + segments, row);
    }
  }

  if (options.canonicalizePoles ?? true) {
    const north = 0;
    const south = segments * side;
    for (let lon = 1; lon <= segments; lon++) {
      copyHeightNormalPixel(data, lon, north);
      copyHeightNormalPixel(data, south + lon, south);
    }
  }

  const polarBlendRows = Math.max(0, Math.floor(options.polarBlendRows ?? DEFAULT_POLAR_BLEND_ROWS));
  const polarBlendStrength = Math.max(0, Math.min(1, options.polarBlendStrength ?? DEFAULT_POLAR_BLEND_STRENGTH));
  if (polarBlendRows <= 0 || polarBlendStrength <= 0) return;

  const blendPolarRow = (lat: number, amount: number): void => {
    if (lat <= 0 || lat >= segments || amount <= 0) return;

    let meanHeight = 0;
    for (let lon = 0; lon < segments; lon++) {
      meanHeight += data[(lat * side + lon) * 4];
    }
    meanHeight /= Math.max(1, segments);

    for (let lon = 0; lon <= segments; lon++) {
      const i = (lat * side + lon) * 4;
      data[i] = data[i] + (meanHeight - data[i]) * amount;
    }

    if (options.canonicalizeSeams ?? true) {
      copyHeightNormalPixel(data, lat * side + segments, lat * side);
    }
  };

  const rows = Math.min(polarBlendRows, Math.max(0, Math.floor(segments / 8)));
  for (let r = 1; r <= rows; r++) {
    const falloff = 1 - r / (rows + 1);
    const amount = polarBlendStrength * falloff * falloff;
    blendPolarRow(r, amount);
    blendPolarRow(segments - r, amount);
  }
}

function applyAutoColorRange(options: PlanetGpuOptions, heightNormal: Float32Array): PlanetGpuOptions {
  if (!options.color?.autoRange) return options;

  const measured = measureNoiseRangeFromHeightNormalMap(heightNormal);
  const padding = Math.max(0, options.color.rangePadding ?? 0.04);
  const span = measured.maxValue - measured.minValue;

  return {
    ...options,
    color: {
      ...options.color,
      minValue: options.color.minValue ?? measured.minValue - span * padding,
      maxValue: options.color.maxValue ?? measured.maxValue + span * padding,
    },
  };
}

function getSphereUnit(lat: number, lon: number, segments: number) {
  if (lat <= 0) return { x: 0, y: 0, z: 1 };
  if (lat >= segments) return { x: 0, y: 0, z: -1 };

  const theta = lat * Math.PI / segments;
  const phi = (lon === segments ? 0 : lon) * 2 * Math.PI / segments;
  const x = Math.sin(theta) * Math.cos(phi);
  const y = Math.sin(theta) * Math.sin(phi);
  const z = Math.cos(theta);
  return { x, y, z };
}

function normalizeVector3(x: number, y: number, z: number, fallback: { x: number; y: number; z: number }) {
  const len = Math.hypot(x, y, z);
  if (!Number.isFinite(len) || len < 1e-8) return fallback;
  return { x: x / len, y: y / len, z: z / len };
}

function resolveMaxVerticesPerPartition(options: PlanetGpuOptions): number {
  if (Number.isFinite(options.maxVerticesPerPartition)) {
    return Math.max(1, Math.floor(Number(options.maxVerticesPerPartition)));
  }

  if (Number.isFinite(options.maxPositionsPerPartition)) {
    return Math.max(1, Math.floor(Number(options.maxPositionsPerPartition) / VERTEX_SIZE));
  }

  return DEFAULT_MAX_VERTICES_PER_PARTITION;
}

function resolvePartitionSkirtDepth(radius: number, heightScale: number, options: Pick<PlanetGpuOptions, 'partitionSkirtDepth'>): number {
  if (Number.isFinite(options.partitionSkirtDepth)) return Math.max(0, Number(options.partitionSkirtDepth));
  return Math.max(DEFAULT_MIN_PARTITION_SKIRT_DEPTH, radius * DEFAULT_PARTITION_SKIRT_DEPTH_FACTOR, Math.abs(heightScale) * 0.08);
}

async function readRGBA16FloatTextureLayer(
  device: any,
  queue: any,
  texture: any,
  layer: number,
  width: number,
  height: number,
  writePixel: (x: number, y: number, rgba: [number, number, number, number]) => void,
  maxBufferChunkBytes = 64 * 1024 * 1024,
): Promise<void> {
  const bytesPerPixel = 8;
  const unalignedBytesPerRow = width * bytesPerPixel;
  const bytesPerRow = Math.ceil(unalignedBytesPerRow / 256) * 256;
  const rowsPerChunk = Math.max(1, Math.floor(maxBufferChunkBytes / bytesPerRow));

  for (let y0 = 0; y0 < height; y0 += rowsPerChunk) {
    const rows = Math.min(rowsPerChunk, height - y0);
    const buffer = device.createBuffer({
      size: bytesPerRow * rows,
      usage: (globalThis as any).GPUBufferUsage.COPY_DST | (globalThis as any).GPUBufferUsage.MAP_READ,
    });

    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer(
      { texture, origin: { x: 0, y: y0, z: layer } },
      { buffer, bytesPerRow, rowsPerImage: rows },
      { width, height: rows, depthOrArrayLayers: 1 },
    );
    queue.submit([encoder.finish()]);
    await queue.onSubmittedWorkDone();

    await buffer.mapAsync((globalThis as any).GPUMapMode.READ);
    const src = new Uint16Array(buffer.getMappedRange());

    for (let row = 0; row < rows; row++) {
      const srcRow = (row * bytesPerRow) >> 1;
      for (let x = 0; x < width; x++) {
        const si = srcRow + x * 4;
        writePixel(x, y0 + row, [
          halfToFloat32(src[si + 0]),
          halfToFloat32(src[si + 1]),
          halfToFloat32(src[si + 2]),
          halfToFloat32(src[si + 3]),
        ]);
      }
    }

    buffer.unmap();
    buffer.destroy();
  }
}

async function readCurrentRGBA16FloatTexture(
  builder: NoiseComputeBuilder,
  textureKey: string,
): Promise<{ data: Float32Array; width: number; height: number }> {
  const internalPairs = (builder as any)._texPairs;
  const pair = internalPairs?.get?.(String(textureKey));
  const resource = builder.getCurrentTextureResource(textureKey);

  if (!resource?.texture) throw new Error(`Texture ${textureKey} was not created.`);

  const fullWidth = pair?.fullWidth ?? resource.width;
  const fullHeight = pair?.fullHeight ?? resource.height;
  const tileWidth = pair?.tileWidth ?? resource.width;
  const tileHeight = pair?.tileHeight ?? resource.height;
  const tilesX = pair?.tilesX ?? 1;
  const tilesY = pair?.tilesY ?? 1;
  const texture = resource.texture;
  const out = new Float32Array(fullWidth * fullHeight * 4);

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const layer = ty * tilesX + tx;
      const originX = tx * tileWidth;
      const originY = ty * tileHeight;
      const copyWidth = Math.min(tileWidth, fullWidth - originX);
      const copyHeight = Math.min(tileHeight, fullHeight - originY);

      await readRGBA16FloatTextureLayer(
        builder.device,
        builder.queue,
        texture,
        layer,
        copyWidth,
        copyHeight,
        (x, y, rgba) => {
          const dst = ((originY + y) * fullWidth + (originX + x)) * 4;
          out[dst + 0] = rgba[0];
          out[dst + 1] = rgba[1];
          out[dst + 2] = rgba[2];
          out[dst + 3] = rgba[3];
        },
      );
    }
  }

  return { data: out, width: fullWidth, height: fullHeight };
}

export async function generatePlanetHeightNormalMapGpu(
  builder: NoiseComputeBuilder,
  options: PlanetGpuOptions,
): Promise<PlanetHeightNormalMap> {
  const normalized: PlanetGpuOptions = {
    ...options,
    segments: Math.floor(options.segments),
    heightScale: options.heightScale ?? DEFAULT_HEIGHT_SCALE,
    polarBlendRows: options.polarBlendRows ?? DEFAULT_POLAR_BLEND_ROWS,
    polarBlendStrength: options.polarBlendStrength ?? DEFAULT_POLAR_BLEND_STRENGTH,
    polarCapMode: options.polarCapMode ?? DEFAULT_POLAR_CAP_MODE,
    noiseConfigs: options.noiseConfigs ?? createDefaultPlanetNoiseConfigSet(options.seed).noiseConfigs,
  };

  validatePlanetOptions(builder, normalized);

  const side = normalized.segments + 1;
  const textureKey = normalized.textureKey ?? `planet-height-normal-${normalized.seed}-${side}-${Math.random().toString(36).slice(2)}`;
  const useGpuSpherePositionMode = normalized.useGpuSpherePositionMode ?? true;
  const sphereNoisePositions = useGpuSpherePositionMode
    ? null
    : buildSphereNoisePositions(normalized.segments, normalized.offset ?? 0, normalized.offset2 ?? 0);
  const noiseChoices = normalized.noiseConfigs!.map((config) => noiseEntryPointByType[config.type] ?? config.type);
  const noiseParams = normalized.noiseConfigs!.map((config) => toNoiseParams(config, normalized.seed));
  const spherePositionOptions = useGpuSpherePositionMode
    ? { useCustomPos: 2, sphereOffset: normalized.offset ?? 0, sphereOffset2: normalized.offset2 ?? 0 }
    : { useCustomPos: 1, customData: sphereNoisePositions as Float32Array };

  builder.destroyTexturePair?.(textureKey);
  builder.buildPermTable(normalized.seed);
  await builder.computeToTexture(side, side, { scalar: 1, transform: 0 }, {
    textureKey,
    noiseChoices: ['clearTexture'],
    useCustomPos: 0,
    outputChannel: 1,
  });

  for (let i = 0; i < noiseChoices.length; i++) {
    const config = normalized.noiseConfigs![i];
    builder.buildPermTable(typeof config.seed === 'number' ? config.seed : normalized.seed);

    await builder.computeToTexture(side, side, noiseParams[i], {
      textureKey,
      noiseChoices: [noiseChoices[i]],
      ...spherePositionOptions,
      outputChannel: 1,
    });
  }

  await builder.computeToTexture(side, side, { scalar: 1, transform: 0 }, {
    textureKey,
    noiseChoices: ['computeSphereNormal'],
    outputChannel: 1,
    baseRadius: normalized.radius,
    heightScale: normalized.heightScale,
  });

  const readback = await readCurrentRGBA16FloatTexture(builder, textureKey);
  canonicalizePlanetHeightNormalMap(readback.data, normalized.segments, normalized);

  return { data: readback.data, width: readback.width, height: readback.height, textureKey };
}

function resolvePartitionColorSampler(options: PlanetGpuOptions): { gradient: PlanetGradientChoice; getColor: (value: number) => RGB } {
  const gradient = getPlanetGradient(options.color?.gradient ?? options.gradient ?? 'Utahish');

  if (options.getColor) {
    return { gradient, getColor: options.getColor };
  }

  return {
    gradient,
    getColor: createPlanetColorSampler({
      gradient,
      minValue: options.color?.minValue ?? -1,
      maxValue: options.color?.maxValue ?? 1,
      blendClamp: options.color?.blendClamp,
      invalidColor: options.color?.invalidColor,
    }),
  };
}

export function createPlanetMeshPartitionsFromHeightNormalMap(
  heightNormal: Float32Array,
  segments: number,
  radius: number,
  getColor: (value: number) => RGB,
  maxVerticesPerPartition = DEFAULT_MAX_VERTICES_PER_PARTITION,
  heightScale = DEFAULT_HEIGHT_SCALE,
  options: Pick<PlanetGpuOptions, 'normalMode' | 'flipGpuNormals' | 'polarCapMode' | 'partitionSkirts' | 'partitionSkirtDepth' | 'doubleSidedPartitionSkirts'> = {},
): PlanetMeshPartition[] {
  const side = segments + 1;
  const partitionSkirts = options.partitionSkirts ?? DEFAULT_PARTITION_SKIRTS;
  const partitionSkirtDepth = resolvePartitionSkirtDepth(radius, heightScale, options);
  const doubleSidedPartitionSkirts = options.doubleSidedPartitionSkirts ?? true;
  const maxMainRows = Math.max(2, Math.floor(maxVerticesPerPartition / side) - (partitionSkirts ? 2 : 0));
  const rowsPerSplit = Math.max(2, maxMainRows);
  const meshes: PlanetMeshPartition[] = [];
  const normalMode = options.normalMode ?? 'sphere';
  const flipGpuNormals = options.flipGpuNormals ?? false;
  const polarCapMode = options.polarCapMode ?? DEFAULT_POLAR_CAP_MODE;
  let partitionIndex = 0;
  let startLat = 0;

  while (startLat < segments) {
    const endLat = Math.min(startLat + rowsPerSplit - 1, segments);
    const mainVertexCount = (endLat - startLat + 1) * side;
    const hasNorthSkirt = partitionSkirts && startLat > 0 && partitionSkirtDepth > 0;
    const hasSouthSkirt = partitionSkirts && endLat < segments && partitionSkirtDepth > 0;
    const skirtVertexCount = (hasNorthSkirt ? side : 0) + (hasSouthSkirt ? side : 0);
    const numVertsInSegment = mainVertexCount + skirtVertexCount;
    const splitPositions = new Float32Array(numVertsInSegment * VERTEX_SIZE);
    const splitNormals = new Float32Array(numVertsInSegment * NORMAL_SIZE);
    const splitColors = new Float32Array(numVertsInSegment * COLOR_SIZE);
    const splitUvs = new Float32Array(numVertsInSegment * UV_SIZE);

    let triangleCount = 0;
    for (let lat = startLat; lat < endLat; lat++) {
      triangleCount += polarCapMode === 'fan' && (lat === 0 || lat === segments - 1) ? segments : segments * 2;
    }
    const skirtTriangleMultiplier = doubleSidedPartitionSkirts ? 4 : 2;
    if (hasNorthSkirt) triangleCount += segments * skirtTriangleMultiplier;
    if (hasSouthSkirt) triangleCount += segments * skirtTriangleMultiplier;
    const splitIndices = new Uint32Array(triangleCount * 3);

    let vertexOffset = 0;
    let writeIndex = 0;
    let minNoiseValue = Infinity;
    let maxNoiseValue = -Infinity;
    let minHeightValue = Infinity;
    let maxHeightValue = -Infinity;

    for (let lat = startLat; lat <= endLat; lat++) {
      for (let lon = 0; lon <= segments; lon++) {
        const noiseIndex = lat * side + lon;
        const texIndex = noiseIndex * 4;
        const rawNoiseValue = heightNormal[texIndex];
        const noiseValue = safeFinite(rawNoiseValue, 0);
        const heightValue = noiseValue * heightScale;
        const unit = getSphereUnit(lat, lon, segments);

        minNoiseValue = Math.min(minNoiseValue, noiseValue);
        maxNoiseValue = Math.max(maxNoiseValue, noiseValue);
        minHeightValue = Math.min(minHeightValue, heightValue);
        maxHeightValue = Math.max(maxHeightValue, heightValue);

        const index3 = vertexOffset * VERTEX_SIZE;
        splitPositions[index3 + 0] = unit.x * radius + unit.x * heightValue;
        splitPositions[index3 + 1] = unit.z * radius + unit.z * heightValue;
        splitPositions[index3 + 2] = unit.y * radius + unit.y * heightValue;

        if (normalMode === 'sphere') {
          splitNormals[index3 + 0] = unit.x;
          splitNormals[index3 + 1] = unit.z;
          splitNormals[index3 + 2] = unit.y;
        } else {
          const normalSign = flipGpuNormals ? -1 : 1;
          const normalX = (safeFinite(heightNormal[texIndex + 1], 0.5) * 2 - 1) * normalSign;
          const normalY = (safeFinite(heightNormal[texIndex + 2], 0.5) * 2 - 1) * normalSign;
          const normalZ = (safeFinite(heightNormal[texIndex + 3], 0.5) * 2 - 1) * normalSign;
          const normal = normalizeVector3(normalX, normalY, normalZ, unit);
          splitNormals[index3 + 0] = normal.x;
          splitNormals[index3 + 1] = normal.z;
          splitNormals[index3 + 2] = normal.y;
        }

        const index4 = vertexOffset * COLOR_SIZE;
        const [r, g, b] = getColor(noiseValue);
        splitColors[index4 + 0] = r / 255;
        splitColors[index4 + 1] = g / 255;
        splitColors[index4 + 2] = b / 255;
        splitColors[index4 + 3] = 1;

        const index2 = vertexOffset * UV_SIZE;
        splitUvs[index2 + 0] = lon / segments;
        splitUvs[index2 + 1] = lat / segments;

        vertexOffset++;
      }
    }

    const appendSkirtRing = (sourceLocalRow: number): number => {
      const skirtStart = vertexOffset;
      const sourceStart = sourceLocalRow * side;

      for (let lon = 0; lon <= segments; lon++) {
        const srcVertex = sourceStart + lon;
        const src3 = srcVertex * VERTEX_SIZE;
        const dst3 = vertexOffset * VERTEX_SIZE;
        const normal = normalizeVector3(
          splitNormals[src3 + 0],
          splitNormals[src3 + 1],
          splitNormals[src3 + 2],
          { x: 0, y: 1, z: 0 },
        );

        splitPositions[dst3 + 0] = splitPositions[src3 + 0] - normal.x * partitionSkirtDepth;
        splitPositions[dst3 + 1] = splitPositions[src3 + 1] - normal.y * partitionSkirtDepth;
        splitPositions[dst3 + 2] = splitPositions[src3 + 2] - normal.z * partitionSkirtDepth;

        splitNormals[dst3 + 0] = splitNormals[src3 + 0];
        splitNormals[dst3 + 1] = splitNormals[src3 + 1];
        splitNormals[dst3 + 2] = splitNormals[src3 + 2];

        const src4 = srcVertex * COLOR_SIZE;
        const dst4 = vertexOffset * COLOR_SIZE;
        splitColors[dst4 + 0] = splitColors[src4 + 0];
        splitColors[dst4 + 1] = splitColors[src4 + 1];
        splitColors[dst4 + 2] = splitColors[src4 + 2];
        splitColors[dst4 + 3] = splitColors[src4 + 3];

        const src2 = srcVertex * UV_SIZE;
        const dst2 = vertexOffset * UV_SIZE;
        splitUvs[dst2 + 0] = splitUvs[src2 + 0];
        splitUvs[dst2 + 1] = splitUvs[src2 + 1];

        vertexOffset++;
      }

      return skirtStart;
    };

    const northSkirtStart = hasNorthSkirt ? appendSkirtRing(0) : -1;
    const southSkirtStart = hasSouthSkirt ? appendSkirtRing(endLat - startLat) : -1;

    const appendPartitionSkirtIndices = (boundaryStart: number, skirtStart: number): void => {
      for (let lon = 0; lon < segments; lon++) {
        const b0 = boundaryStart + lon;
        const b1 = boundaryStart + lon + 1;
        const s0 = skirtStart + lon;
        const s1 = skirtStart + lon + 1;

        splitIndices[writeIndex++] = b0;
        splitIndices[writeIndex++] = s0;
        splitIndices[writeIndex++] = b1;
        splitIndices[writeIndex++] = b1;
        splitIndices[writeIndex++] = s0;
        splitIndices[writeIndex++] = s1;

        if (doubleSidedPartitionSkirts) {
          splitIndices[writeIndex++] = b1;
          splitIndices[writeIndex++] = s0;
          splitIndices[writeIndex++] = b0;
          splitIndices[writeIndex++] = s1;
          splitIndices[writeIndex++] = s0;
          splitIndices[writeIndex++] = b1;
        }
      }
    };

    for (let lat = startLat; lat < endLat; lat++) {
      for (let lon = 0; lon < segments; lon++) {
        const first = (lat - startLat) * side + lon;
        const second = first + side;

        if (polarCapMode === 'fan' && lat === 0) {
          const north = 0;
          splitIndices[writeIndex++] = second;
          splitIndices[writeIndex++] = second + 1;
          splitIndices[writeIndex++] = north;
        } else if (polarCapMode === 'fan' && lat === segments - 1) {
          const south = (segments - startLat) * side;
          splitIndices[writeIndex++] = first;
          splitIndices[writeIndex++] = south;
          splitIndices[writeIndex++] = first + 1;
        } else {
          splitIndices[writeIndex++] = first;
          splitIndices[writeIndex++] = second;
          splitIndices[writeIndex++] = first + 1;
          splitIndices[writeIndex++] = second;
          splitIndices[writeIndex++] = second + 1;
          splitIndices[writeIndex++] = first + 1;
        }
      }
    }

    if (hasNorthSkirt) appendPartitionSkirtIndices(0, northSkirtStart);
    if (hasSouthSkirt) appendPartitionSkirtIndices((endLat - startLat) * side, southSkirtStart);

    if (writeIndex !== splitIndices.length) {
      throw new Error(`Planet partition ${partitionIndex} wrote ${writeIndex} indices but allocated ${splitIndices.length}.`);
    }

    meshes.push({
      splitPositions,
      splitNormals,
      splitColors,
      splitUvs,
      splitIndices,
      startLat,
      endLat,
      vertexCount: numVertsInSegment,
      indexCount: splitIndices.length,
      minNoiseValue,
      maxNoiseValue,
      minHeightValue,
      maxHeightValue,
    });

    partitionIndex++;
    if (endLat >= segments) break;
    startLat = endLat;
  }

  return meshes;
}

export async function generatePlanetMeshGpu(
  builder: NoiseComputeBuilder,
  options: PlanetGpuOptions,
): Promise<PlanetGpuResult> {
  const noiseSet: PlanetNoiseConfigSet = options.noiseConfigs?.length
    ? { noiseConfigs: options.noiseConfigs, labels: options.noiseConfigs.map((config) => config.type) }
    : createDefaultPlanetNoiseConfigSet(options.seed, options);

  const normalized: PlanetGpuOptions = {
    ...options,
    segments: Math.floor(options.segments),
    heightScale: options.heightScale ?? DEFAULT_HEIGHT_SCALE,
    noiseConfigs: noiseSet.noiseConfigs,
    offset: options.offset ?? noiseSet.offset,
    offset2: options.offset2 ?? noiseSet.offset2,
  };

  const heightNormal = await generatePlanetHeightNormalMapGpu(builder, normalized);
  const rangedOptions = applyAutoColorRange(normalized, heightNormal.data);
  const color = resolvePartitionColorSampler(rangedOptions);
  const partitions = createPlanetMeshPartitionsFromHeightNormalMap(
    heightNormal.data,
    rangedOptions.segments,
    rangedOptions.radius,
    color.getColor,
    resolveMaxVerticesPerPartition(rangedOptions),
    rangedOptions.heightScale,
    rangedOptions,
  );

  const minNoiseValue = Math.min(...partitions.map((partition) => partition.minNoiseValue));
  const maxNoiseValue = Math.max(...partitions.map((partition) => partition.maxNoiseValue));
  const minHeightValue = Math.min(...partitions.map((partition) => partition.minHeightValue));
  const maxHeightValue = Math.max(...partitions.map((partition) => partition.maxHeightValue));

  const noiseSpan = maxNoiseValue - minNoiseValue;
  if (!(rangedOptions.allowFlatHeightmap ?? false) && noiseSet.noiseConfigs.length > 0 && (!Number.isFinite(noiseSpan) || Math.abs(noiseSpan) < 1e-7)) {
    throw new Error(
      `Planet GPU heightmap is flat (${minNoiseValue} .. ${maxNoiseValue}). `
      + 'The compute path probably failed before meaningful noise was written.',
    );
  }

  const result: PlanetGpuResult = {
    seed: normalized.seed,
    offset: normalized.offset,
    offset2: normalized.offset2,
    randomizer1: noiseSet.randomizer1,
    randomizer2: noiseSet.randomizer2,
    randomizer3: noiseSet.randomizer3,
    partitions,
    width: heightNormal.width,
    height: heightNormal.height,
    segments: rangedOptions.segments,
    radius: rangedOptions.radius,
    heightScale: rangedOptions.heightScale!,
    normalMode: rangedOptions.normalMode ?? 'sphere',
    flipGpuNormals: rangedOptions.flipGpuNormals ?? false,
    canonicalizeSeams: rangedOptions.canonicalizeSeams ?? true,
    canonicalizePoles: rangedOptions.canonicalizePoles ?? true,
    polarCapMode: rangedOptions.polarCapMode ?? DEFAULT_POLAR_CAP_MODE,
    polarBlendRows: rangedOptions.polarBlendRows ?? DEFAULT_POLAR_BLEND_ROWS,
    polarBlendStrength: rangedOptions.polarBlendStrength ?? DEFAULT_POLAR_BLEND_STRENGTH,
    maxVerticesPerPartition: resolveMaxVerticesPerPartition(rangedOptions),
    partitionSkirts: rangedOptions.partitionSkirts ?? DEFAULT_PARTITION_SKIRTS,
    partitionSkirtDepth: resolvePartitionSkirtDepth(rangedOptions.radius, rangedOptions.heightScale!, rangedOptions),
    gradient: color.gradient,
    noiseConfigs: noiseSet.noiseConfigs,
    noiseLabels: noiseSet.labels ?? noiseSet.noiseConfigs.map((config: NoiseConfig) => config.type),
    textureKey: heightNormal.textureKey,
    vertexCount: (rangedOptions.segments + 1) * (rangedOptions.segments + 1),
    partitionCount: partitions.length,
    minNoiseValue,
    maxNoiseValue,
    minHeightValue,
    maxHeightValue,
  };

  if (normalized.includeHeightNormalData) result.heightNormal = heightNormal;
  if (normalized.destroyTextureAfterRead ?? true) builder.destroyTexturePair?.(heightNormal.textureKey);

  return result;
}

export async function generatePlanetMeshPartitionsGpu(
  builder: NoiseComputeBuilder,
  options: PlanetGpuOptions,
  getColor?: (value: number) => RGB,
): Promise<PlanetMeshPartition[]> {
  const result = await generatePlanetMeshGpu(builder, { ...options, getColor });
  return result.partitions;
}

function normalizeBabylonMeshOptions(arg?: BABYLON.ShadowGenerator | BabylonPlanetMeshOptions): BabylonPlanetMeshOptions {
  if (!arg) return {};
  if (arg instanceof BABYLON.ShadowGenerator) return { shadowGenerator: arg };
  return arg;
}

export function createBabylonPlanetMeshes(
  scene: BABYLON.Scene,
  partitions: PlanetMeshPartition[],
  optionsOrShadowGenerator?: BABYLON.ShadowGenerator | BabylonPlanetMeshOptions,
): BABYLON.Mesh[] {
  const options = normalizeBabylonMeshOptions(optionsOrShadowGenerator);

  return partitions.map((partition, index) => {
    const mesh = new BABYLON.Mesh(`${options.meshNamePrefix ?? 'planet-partition'}-${index}`, scene);
    const vertexData = new BABYLON.VertexData();

    vertexData.positions = partition.splitPositions;
    vertexData.indices = partition.splitIndices;
    vertexData.normals = partition.splitNormals;
    vertexData.colors = partition.splitColors;
    vertexData.uvs = partition.splitUvs;
    vertexData.applyToMesh(mesh);

    const material = options.materialFactory
      ? options.materialFactory(partition, index, scene)
      : new BABYLON.StandardMaterial(`${options.materialNamePrefix ?? 'planet-material'}-${index}`, scene);

    if (material instanceof BABYLON.StandardMaterial) {
      material.vertexColorEnabled = true;
      material.specularColor = options.specularColor ?? new BABYLON.Color3(0.015, 0.015, 0.015);
    }

    mesh.material = material;
    mesh.receiveShadows = options.receiveShadows ?? true;
    mesh.alwaysSelectAsActiveMesh = options.alwaysSelectAsActiveMesh ?? false;
    mesh.isPickable = options.isPickable ?? true;

    if (options.freezeMaterials ?? true) material.freeze?.();
    if (options.freezeWorldMatrix ?? true) mesh.freezeWorldMatrix();
    options.shadowGenerator?.addShadowCaster(mesh);

    return mesh;
  });
}
