const url = new URL(location.href);
const erosion = url.searchParams.get('demo') === 'erosion';
const nav = document.createElement('nav');
nav.id = 'noise-demo-navigation';
nav.setAttribute('aria-label', 'Noise demos');
for (const [demo, label] of [['noise', 'Noise shaders'], ['erosion', 'Erosion terrain']]) {
  const link = document.createElement('a');
  url.searchParams.set('demo', demo);
  link.href = url.href;
  link.textContent = label;
  if ((demo === 'erosion') === erosion) link.setAttribute('aria-current', 'page');
  nav.append(link);
}
const style = document.createElement('style');
style.textContent = `
  #noise-demo-navigation { display: flex; gap: 6px; padding-bottom: 12px; font: 14px system-ui, sans-serif; }
  #noise-demo-navigation a { padding: 6px 9px; border: 1px solid #52657a; border-radius: 6px; color: #dce9f7; text-decoration: none; }
  #noise-demo-navigation a:hover, #noise-demo-navigation a[aria-current="page"] { background: #243951; }
`;
document.head.append(style);
document.body.prepend(nav);
if (erosion) {
  await import('./tools/noise/noiseErosionTest.js');
} else {
  await import('./tools/noise/noiseComputeTest.js');
  document.querySelector('#noise-app .sidebar-header').before(nav);
}
