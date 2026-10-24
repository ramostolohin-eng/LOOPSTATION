// Dedicated app storage: everything lives in LoopStation/ inside the app's private folder.
//  - In the Android app, files go through the native bridge window.AndroidFS (see MainActivity.java).
//  - In a desktop browser (for testing), the same API is backed by IndexedDB.
import { abToB64, b64ToAb } from './audioutil.js';

export const ROOT = 'LoopStation';
export const DIRS = ['samples', 'loops', 'projects', 'recordings', 'separated'];

const N = () => window.AndroidFS;
export const isNative = () => typeof window.AndroidFS !== 'undefined';
const CH = 768 * 1024; // bytes per bridge call
const tick = () => new Promise((r) => setTimeout(r, 0));

// ---- IndexedDB fallback (browser testing) -------------------------------------------------------
const P = (p) => `${ROOT}/${p}`;
let dbp = null;
function db() {
  return (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('loopstation', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'path' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction('files', mode);
    const out = fn(tx.objectStore('files'));
    tx.oncomplete = () => res(out.result);
    tx.onerror = () => rej(tx.error);
  });
}

// ---- Permissions ---------------------------------------------------------------------------------
// On Android this shows the system dialogs: microphone, plus storage on Android 9 and older.
// Android 10+ needs no storage permission for the app's private folder.
export async function requestStoragePermissions() {
  if (!isNative()) return 'web';
  N().requestPermissions();
  return 'requested';
}

export async function requestMicPermission() {
  if (isNative()) return 'requested'; // already included in the native request above
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch (e) {
    return 'denied';
  }
}

export async function initStorage() {
  if (!isNative()) return;
  for (const d of DIRS) N().mkdirs(d);
}

// ---- File API -----------------------------------------------------------------------------------------
export async function writeBuffer(path, ab) {
  if (isNative()) {
    const u8 = new Uint8Array(ab);
    if (u8.length === 0 && !N().writeChunk(path, '', false)) throw new Error('write failed: ' + path);
    for (let o = 0; o < u8.length; o += CH) {
      if (!N().writeChunk(path, abToB64(u8.subarray(o, o + CH)), o > 0)) throw new Error('write failed: ' + path);
      await tick();
    }
  } else {
    await idb('readwrite', (s) => s.put({ path: P(path), data: abToB64(ab) }));
  }
}

export async function readBuffer(path) {
  if (isNative()) {
    const size = N().size(path);
    if (size < 0) throw new Error('not found: ' + path);
    const out = new Uint8Array(size);
    for (let o = 0; o < size; o += CH) {
      const b64 = N().readChunk(path, o, CH);
      if (b64 === null) throw new Error('read failed: ' + path);
      out.set(new Uint8Array(b64ToAb(b64)), o);
      await tick();
    }
    return out.buffer;
  }
  const rec = await idb('readonly', (s) => s.get(P(path)));
  if (!rec) throw new Error('not found: ' + path);
  return b64ToAb(rec.data);
}

export const writeJSON = (path, obj) => writeBuffer(path, new TextEncoder().encode(JSON.stringify(obj)).buffer);
export async function readJSON(path) {
  return JSON.parse(new TextDecoder().decode(await readBuffer(path)));
}

export async function remove(path) {
  if (isNative()) { N().remove(path); return; }
  const all = await idb('readonly', (s) => s.getAllKeys());
  for (const k of all.filter((k) => k === P(path) || k.startsWith(P(path) + '/'))) {
    await idb('readwrite', (s) => s.delete(k));
  }
}

// Returns [{name, type:'file'|'directory'}] for one directory level.
export async function list(dir) {
  if (isNative()) {
    try { return JSON.parse(N().list(dir)); } catch (e) { return []; }
  }
  const keys = await idb('readonly', (s) => s.getAllKeys());
  const prefix = P(dir) + '/';
  const seen = new Map();
  for (const k of keys) {
    if (!k.startsWith(prefix)) continue;
    const rest = k.slice(prefix.length);
    const i = rest.indexOf('/');
    if (i === -1) seen.set(rest, 'file');
    else seen.set(rest.slice(0, i), 'directory');
  }
  return [...seen].map(([name, type]) => ({ name, type }));
}

// Copies a file (or all files of a folder) out of the private space so other apps can see it:
// Android -> Downloads/LoopStation ; browser -> normal download (single files only).
export async function exportPublic(path) {
  if (isNative()) {
    const r = N().exportPublic(path);
    if (!r.startsWith('ok:')) throw new Error(r.replace(/^error:/, ''));
    return +r.slice(3);
  }
  const ab = await readBuffer(path);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ab]));
  a.download = path.split('/').pop();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 1;
}
