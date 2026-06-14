/*
 * Volumetric Atmospheric Scattering Shader for Babylon.js
 *
 * Borrowed from Barthélemy Paléologue's volumetric atmospheric scattering project:
 * https://github.com/BarthPaleologue/volumetric-atmospheric-scattering
 *
 * Shader notes also credit Sebastian Lague's atmospheric scattering walkthrough.
 */

import {
  Camera,
  Light,
  Texture,
  Effect,
  Matrix,
  Mesh,
  TransformNode,
  PostProcess,
  Scene,
  DepthRenderer,
} from 'babylonjs';

//@ts-ignore - project bundler already imports GLSL shader strings in the planet stack.
import atmosphereFragment from './glsl/atmosphericScattering.glsl';

const shaderName = 'planetAtmosphereScattering';
Effect.ShadersStore[`${shaderName}FragmentShader`] = atmosphereFragment;

export interface AtmosphereSettings {
  planetRadius: number;
  atmosphereRadius: number;
  falloffFactor: number;
  intensity: number;
  scatteringStrength: number;
  densityModifier: number;
  redWaveLength: number;
  greenWaveLength: number;
  blueWaveLength: number;
}

export interface AtmosphericScatteringOptions {
  falloffFactor?: number;
  intensity?: number;
  scatteringStrength?: number;
  densityModifier?: number;
  redWaveLength?: number;
  greenWaveLength?: number;
  blueWaveLength?: number;
}

export class AtmosphericScatteringPostProcess extends PostProcess {
  settings: AtmosphereSettings;
  camera: Camera;
  sun: TransformNode | Light;
  planet: TransformNode;
  depthRenderer: DepthRenderer;

  constructor(
    name: string,
    planet: Mesh | TransformNode,
    planetRadius: number,
    atmosphereRadius: number,
    sun: TransformNode | Light,
    camera: Camera,
    depthRenderer: DepthRenderer,
    scene: Scene,
    redWaveLength = 700,
    greenWaveLength = 530,
    blueWaveLength = 440,
    options: AtmosphericScatteringOptions = {},
  ) {
    super(
      name,
      shaderName,
      [
        'sunPosition',
        'cameraPosition',
        'inverseProjection',
        'inverseView',
        'cameraNear',
        'cameraFar',
        'planetPosition',
        'planetRadius',
        'atmosphereRadius',
        'falloffFactor',
        'sunIntensity',
        'scatteringStrength',
        'densityModifier',
        'redWaveLength',
        'greenWaveLength',
        'blueWaveLength',
      ],
      ['textureSampler', 'depthSampler'],
      1,
      camera,
      Texture.BILINEAR_SAMPLINGMODE,
      scene.getEngine(),
      false,
    );

    this.settings = {
      planetRadius,
      atmosphereRadius,
      falloffFactor: options.falloffFactor ?? 15,
      intensity: options.intensity ?? 15,
      scatteringStrength: options.scatteringStrength ?? 1,
      densityModifier: options.densityModifier ?? 1,
      redWaveLength: options.redWaveLength ?? redWaveLength,
      greenWaveLength: options.greenWaveLength ?? greenWaveLength,
      blueWaveLength: options.blueWaveLength ?? blueWaveLength,
    };

    this.camera = camera;
    this.sun = sun;
    this.planet = planet;
    this.depthRenderer = depthRenderer;

    this.onApplyObservable.add((effect: Effect) => {
      effect.setTexture('depthSampler', this.depthRenderer.getDepthMap());

      effect.setVector3('sunPosition', this.sun.getAbsolutePosition());
      effect.setVector3('cameraPosition', this.camera.position);
      effect.setVector3('planetPosition', this.planet.absolutePosition);

      effect.setMatrix('inverseProjection', Matrix.Invert(this.camera.getProjectionMatrix()));
      effect.setMatrix('inverseView', Matrix.Invert(this.camera.getViewMatrix()));

      effect.setFloat('cameraNear', this.camera.minZ);
      effect.setFloat('cameraFar', this.camera.maxZ);

      effect.setFloat('planetRadius', this.settings.planetRadius);
      effect.setFloat('atmosphereRadius', this.settings.atmosphereRadius);
      effect.setFloat('falloffFactor', this.settings.falloffFactor);
      effect.setFloat('sunIntensity', this.settings.intensity);
      effect.setFloat('scatteringStrength', this.settings.scatteringStrength);
      effect.setFloat('densityModifier', this.settings.densityModifier);
      effect.setFloat('redWaveLength', this.settings.redWaveLength);
      effect.setFloat('greenWaveLength', this.settings.greenWaveLength);
      effect.setFloat('blueWaveLength', this.settings.blueWaveLength);
    });
  }
}
