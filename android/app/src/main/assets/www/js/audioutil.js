export function abToB64(ab) {
  const b = new Uint8Array(ab);
  let s = '';
  const C = 0x8000;
  for (let i = 0; i < b.length; i += C) s += String.fromCharCode.apply(null, b.subarray(i, i + C));
  return btoa(s);
}

export function b64ToAb(b64) {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}

// channels: array of Float32Array (same length). Returns a 16-bit PCM WAV as ArrayBuffer.
export function channelsToWav(chs, sr) {
  const n = chs[0].length;
  const nc = chs.length;
  const ab = new ArrayBuffer(44 + n * nc * 2);
  const v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * nc * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nc, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nc * 2, true); v.setUint16(32, nc * 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * nc * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nc; c++) {
      const s = Math.max(-1, Math.min(1, chs[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return ab;
}

export function bufferToWav(buf) {
  const chs = [];
  for (let i = 0; i < buf.numberOfChannels; i++) chs.push(buf.getChannelData(i));
  return channelsToWav(chs, buf.sampleRate);
}

export const safeName = (s) => (s || 'untitled').trim().replace(/[^\p{L}\p{N}_\- ]+/gu, '').replace(/\s+/g, '_').slice(0, 60) || 'untitled';
