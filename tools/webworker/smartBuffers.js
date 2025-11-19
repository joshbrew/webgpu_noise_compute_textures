// smartBuffers.js   (type: module)
export const hasSAB = typeof SharedArrayBuffer !== 'undefined';
// console.log("SharedArrayBuffers enabled:",hasSAB)

export function allocTyped(Type, length) {
  // Create either SAB-backed or ordinary ArrayBuffer-backed view.
  const buf = hasSAB
    ? new SharedArrayBuffer(Type.BYTES_PER_ELEMENT * length)
    : new ArrayBuffer(Type.BYTES_PER_ELEMENT * length);
  return new Type(buf);
}

/**
 * Filters a list of buffers so that we only put *transferable*
 * ones in the transfer-list (SharedArrayBuffer is *not* transferable).
 */
export function transferList(buffers) {
    const filtered = hasSAB ? buffers.filter(b => !(b instanceof SharedArrayBuffer)) : buffers;
    if(filtered.length > 0) return filtered;
    return undefined; //nothing to transfer in this case
}
