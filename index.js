const demo = new URL(window.location.href).searchParams.get('demo');
if (demo === 'planet') {
  import('./tools/noise/noisePlanetTest.js');
} else {
  import('./tools/noise/noiseComputeTest.js');
}
