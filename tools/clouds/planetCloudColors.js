// Separate hue from radiance so the browser's 0–1 color picker does not
// silently clip the HDR cloud lighting colors used by both renderers.
export function cloudColorStrength(rgb) {
  return Math.max(0, ...[0, 1, 2].map(i => Number.isFinite(rgb?.[i]) ? rgb[i] : 0));
}

export function cloudColorHex(rgb) {
  const strength = cloudColorStrength(rgb);
  return '#' + [0, 1, 2].map(i => {
    const channel = strength > 0 ? Math.max(0, Number(rgb?.[i]) || 0) / strength : 1;
    return Math.round(channel * 255).toString(16).padStart(2, '0');
  }).join('');
}

export function cloudColorFromHex(hex, strength = 1) {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new RangeError('Expected a six-digit cloud color.');
  const radiance = Number.isFinite(strength) ? Math.max(0, strength) : 1;
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255 * radiance);
}

export function scaleCloudColor(rgb, strength) {
  const previous = cloudColorStrength(rgb);
  const next = Number.isFinite(strength) ? Math.max(0, strength) : previous;
  return [0, 1, 2].map(i => previous > 0 ? Math.max(0, Number(rgb?.[i]) || 0) / previous * next : next);
}
