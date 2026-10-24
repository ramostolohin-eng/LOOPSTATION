import { Engine, emptyPattern } from './engine.js';
import { SOUNDS, GROUPS } from './sounds.js';
import * as store from './storage.js';
import { Recorder } from './recorder.js';
import * as sep from './separate.js';
import { bufferToWav, safeName } from './audioutil.js';
import { t, setLang, applyI18n, lang } from './i18n.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e[k] = v;
    else e.setAttribute(k, v);
  }
  kids.flat().forEach((c) => e.append(c));
  return e;
};

const engine = new Engine();
let rec = null;
let recBusy = false;
let oneShot = false;

let toastTimer;
function toast(msg) {
  const e = $('toast');
  e.textContent = msg;
  e.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => e.classList.remove('show'), 2600);
}
const ready = () => engine.init();
const errMsg = (e) => t('t_err') + (e && e.message ? e.message : e);

// ---- Presets ---------------------------------------------------------------------------------
const pat = (pos, v = 1) => { const p = emptyPattern(); pos.forEach((i) => { p[i] = v; }); return p; };
const PRESETS = [
  { steps: 16, tracks: [
    ['hat-closed', pat([0, 2, 4, 6, 8, 10, 12, 14])],
    ['djembe-bass', pat([0, 6, 10], 2)],
    ['djembe-slap', pat([4, 12])],
    ['shekere', pat([1, 3, 5, 7, 9, 11, 13, 15])],
    ['gangan-high', pat([14])],
  ] },
  { steps: 12, tracks: [
    ['hat-closed', pat([0, 3, 6, 9])],
    ['conga-low', pat([0, 6], 2)],
    ['agogo-high', pat([0, 3, 6, 9])],
    ['shekere', pat([1, 2, 4, 5, 7, 8, 10, 11])],
  ] },
  { steps: 16, tracks: [
    ['kick', pat([0, 8], 2)],
    ['hat-closed', pat([4, 12])],
    ['gong-medium', pat([0], 2)],
  ] },
];

const newTrack = (soundId, pattern = emptyPattern()) => ({ id: engine.uid(), soundId, vol: 0.8, mute: false, pattern });

function loadPreset(i) {
  const p = PRESETS[i];
  engine.steps = p.steps;
  $('selSteps').value = String(p.steps);
  engine.tracks = p.tracks.map(([id, pattern]) => newTrack(id, pattern.slice()));
  renderTracks();
  renderPads();
}

// ---- Instruments dropdown ----------------------------------------------------------------------------
function fillInstruments(sel, selected) {
  sel.innerHTML = '';
  for (const g of GROUPS) {
    const og = el('optgroup', { label: t(g.labelKey) });
    SOUNDS.filter((s) => s.group === g.id).forEach((s) => og.append(el('option', { value: s.id }, s.name)));
    sel.append(og);
  }
  if (engine.samples.size) {
    const og = el('optgroup', { label: t('grp_samples') });
    engine.samples.forEach((s) => og.append(el('option', { value: s.id }, s.name)));
    sel.append(og);
  }
  if (selected) sel.value = selected;
}

// ---- Tracks / pads / clips ---------------------------------------------------------------------------
const cellCls = (tr, s, spb) => 'cell v' + tr.pattern[s] + (s > 0 && s % spb === 0 ? ' beat' : '');

function renderTracks() {
  const box = $('tracks');
  box.innerHTML = '';
  const spb = engine.stepsPerBeat();
  engine.tracks.forEach((tr) => {
    const sel = el('select');
    fillInstruments(sel, tr.soundId);
    sel.onchange = () => { tr.soundId = sel.value; renderPads(); };
    const prev = el('button', { class: 'mini' }, '♪');
    prev.onclick = async () => { await ready(); engine.trigger(tr.soundId, 1); };
    const mute = el('button', { class: 'mini' + (tr.mute ? ' on' : '') }, 'M');
    mute.onclick = () => { tr.mute = !tr.mute; mute.classList.toggle('on', tr.mute); };
    const vol = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: tr.vol });
    vol.oninput = () => { tr.vol = +vol.value; };
    const del = el('button', { class: 'mini' }, '✕');
    del.onclick = () => { engine.tracks = engine.tracks.filter((x) => x !== tr); renderTracks(); renderPads(); };
    const grid = el('div', { class: 'grid' });
    for (let s = 0; s < engine.steps; s++) {
      const c = el('button', { class: cellCls(tr, s, spb), 'data-step': s });
      c.onclick = async () => {
        tr.pattern[s] = (tr.pattern[s] + 1) % 3; // off -> normal -> accent -> off
        c.className = cellCls(tr, s, spb);
        if (tr.pattern[s] && !engine.playing) { await ready(); engine.trigger(tr.soundId, tr.pattern[s] === 2 ? 1 : 0.65); }
      };
      grid.append(c);
    }
    box.append(el('div', { class: 'track' }, el('div', { class: 'thead' }, sel, prev, mute, vol, del), grid));
  });
}

function renderPads() {
  const box = $('pads');
  box.innerHTML = '';
  [...new Set(engine.tracks.map((x) => x.soundId))].forEach((id) => {
    const s = engine.resolveSound(id);
    if (!s) return;
    const b = el('button', { class: 'pad' }, s.name);
    b.addEventListener('pointerdown', async (e) => { e.preventDefault(); await ready(); engine.trigger(id, 1); });
    box.append(b);
  });
}

function renderClips() {
  const box = $('clips');
  box.innerHTML = '';
  if (!engine.clips.length) { box.append(el('p', { class: 'empty' }, t('no_clips'))); return; }
  engine.clips.forEach((c) => {
    const vol = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: c.vol });
    vol.oninput = () => { c.vol = +vol.value; };
    const mute = el('button', { class: 'mini' + (c.mute ? ' on' : '') }, 'M');
    mute.onclick = () => { c.mute = !c.mute; mute.classList.toggle('on', c.mute); };
    const del = el('button', { class: 'mini' }, '✕');
    del.onclick = () => { engine.removeClip(c.id); renderClips(); };
    box.append(el('div', { class: 'clip' },
      el('div', { class: 'nm' }, c.name, el('br'), el('small', {}, `${c.bars} bar · ${c.bpm} BPM`)),
      vol, mute, del));
  });
}

// ---- Transport -------------------------------------------------------------------------------------
function setPlayUi() {
  $('btnPlay').classList.toggle('on', engine.playing);
  $('btnPlay').textContent = engine.playing ? '■' : '▶';
}
async function togglePlay() {
  if (engine.playing) engine.stop(); else await engine.start();
  setPlayUi();
}
function syncBpm() {
  $('bpmNum').value = engine.bpm;
  $('bpmRange').value = engine.bpm;
}
let pitchHinted = false;
function changeBpm(v) {
  if (recBusy) { toast(t('t_lock')); syncBpm(); return; }
  engine.setBpm(v);
  syncBpm();
  if (!pitchHinted && engine.clips.some((c) => c.bpm !== engine.bpm)) { pitchHinted = true; toast(t('t_clip_pitch')); }
}
const taps = [];
function tap() {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
  taps.push(now);
  if (taps.length > 5) taps.shift();
  if (taps.length >= 2) {
    const iv = [];
    for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
    changeBpm(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length));
  }
}

// ---- Samples -----------------------------------------------------------------------------------------
async function registerSample(fileName, ab) {
  const buf = await engine.ctx.decodeAudioData(ab.slice(0));
  engine.addSample('sample:' + fileName, fileName.replace(/\.[^.]+$/, ''), buf);
}
async function loadSamples() {
  for (const f of await store.list('samples')) {
    if (f.type === 'directory') continue;
    try { await registerSample(f.name, await store.readBuffer('samples/' + f.name)); } catch (e) { /* undecodable file */ }
  }
  refreshInstrumentLists();
}
function refreshInstrumentLists() {
  fillInstruments($('selAdd'), $('selAdd').value || 'gangan-high');
  renderTracks();
  renderPads();
}
async function importSamples(files) {
  engine.ensureCtx();
  for (const f of files) {
    try {
      const ab = await f.arrayBuffer();
      const m = f.name.match(/\.[a-z0-9]+$/i);
      const fileName = safeName(f.name.replace(/\.[^.]+$/, '')) + (m ? m[0].toLowerCase() : '.wav');
      await store.writeBuffer('samples/' + fileName, ab);
      await registerSample(fileName, ab);
    } catch (e) { toast(errMsg(e)); }
  }
  refreshInstrumentLists();
  refreshLibrary();
  toast(t('t_imported'));
}

// ---- Projects / export -----------------------------------------------------------------------------------
async function saveProject() {
  try {
    const name = safeName($('projName').value);
    await store.writeJSON(`projects/${name}.json`, {
      v: 1, name, bpm: engine.bpm, steps: engine.steps, metronome: engine.metronome, master: engine.masterVol,
      tracks: engine.tracks.map(({ soundId, vol, mute, pattern }) => ({ soundId, vol, mute, pattern })),
      clips: engine.clips.map((c) => ({ name: c.name, bars: c.bars, bpm: c.bpm, phase: c.phase, vol: c.vol, mute: c.mute, file: c.file })),
    });
    toast(t('t_saved'));
    refreshLibrary();
  } catch (e) { toast(errMsg(e)); }
}

async function loadProject(file) {
  try {
    await ready();
    if (engine.playing) { engine.stop(); setPlayUi(); }
    const d = await store.readJSON('projects/' + file);
    engine.setBpm(d.bpm);
    engine.steps = d.steps;
    engine.metronome = d.metronome !== false;
    engine.setMaster(d.master ?? 0.9);
    engine.tracks = d.tracks.map((x) => ({ id: engine.uid(), ...x }));
    engine.clips = [];
    for (const c of d.clips || []) {
      try {
        const buffer = await engine.ctx.decodeAudioData(await store.readBuffer(c.file));
        engine.addClip({ ...c, buffer });
      } catch (e) { /* missing take: skip */ }
    }
    $('projName').value = d.name || '';
    $('selSteps').value = String(engine.steps);
    $('master').value = engine.masterVol;
    $('btnMetro').classList.toggle('on', engine.metronome);
    syncBpm(); renderTracks(); renderPads(); renderClips();
    toast(t('t_loaded'));
  } catch (e) { toast(errMsg(e)); }
}

async function exportLoop() {
  try {
    await ready();
    const buf = await engine.render(engine.cycleBars());
    await store.writeBuffer(`loops/${safeName($('projName').value)}_${engine.bpm}bpm.wav`, bufferToWav(buf));
    toast(t('t_exported'));
    refreshLibrary();
  } catch (e) { toast(errMsg(e)); }
}

// ---- Recording ------------------------------------------------------------------------------------------
async function openMic() {
  await ready();
  if (!rec) rec = new Recorder(engine.ctx);
  if (!rec.isOpen) {
    try { await rec.open(); toast(t('t_mic_ok')); } catch (e) { toast(t('t_mic_fail')); throw e; }
  }
}
function lockUi() {
  const lock = recBusy;
  ['selSteps', 'bpmRange', 'bpmNum', 'bpmUp', 'bpmDown', 'btnRecLoop'].forEach((id) => { $(id).disabled = lock || (id === 'selSteps' && engine.playing); });
  $('selSteps').disabled = lock || engine.playing;
}

async function recordLoop() {
  if (recBusy) return;
  try { await openMic(); } catch (e) { return; }
  recBusy = true;
  lockUi();
  try {
    const ctx = engine.ctx;
    const sr = ctx.sampleRate;
    const bars = +$('recBars').value;
    const countIn = +$('recCount').value;
    if (!engine.playing) { await engine.start(); setPlayUi(); }
    const barDur = engine.barDuration();
    const beat = 60 / engine.bpm;
    const startBarIdx = engine.nextBarIndex() + countIn;
    const recStart = engine.nextBarStartTime() + countIn * barDur;
    const recEnd = recStart + bars * barDur;
    const lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0) + (+$('recLat').value) / 1000;
    rec.begin();
    while (ctx.currentTime < recEnd + Math.max(lat, 0) + 0.25) {
      $('recStatus').textContent = ctx.currentTime < recStart
        ? `${t('t_countin')} ${Math.ceil((recStart - ctx.currentTime) / beat)}`
        : t('t_recording');
      await new Promise((r) => setTimeout(r, 50));
    }
    rec.end();
    const data = rec.extract(Math.round((recStart + lat) * sr), Math.round(bars * barDur * sr));
    const buffer = ctx.createBuffer(1, data.length, sr);
    buffer.copyToChannel(data, 0);
    const name = 'take_' + Date.now().toString(36).slice(-5);
    const file = `recordings/${name}.wav`;
    await store.writeBuffer(file, bufferToWav(buffer));
    engine.addClip({ name, bars, bpm: engine.bpm, phase: ((startBarIdx % bars) + bars) % bars, buffer, file });
    renderClips();
    refreshLibrary();
    $('recStatus').textContent = t('t_done');
  } catch (e) {
    toast(errMsg(e));
  } finally {
    recBusy = false;
    lockUi();
  }
}

async function oneShotStart() {
  if (oneShot || recBusy) return;
  try { await openMic(); } catch (e) { return; }
  oneShot = true;
  rec.begin();
  $('recStatus').textContent = t('t_recording');
}
async function oneShotStop() {
  if (!oneShot) return;
  oneShot = false;
  rec.end();
  try {
    const data = rec.extractAll();
    const buf = engine.ctx.createBuffer(1, Math.max(1, data.length), engine.ctx.sampleRate);
    if (data.length) buf.copyToChannel(data, 0);
    const label = $('oneName').value.trim() || 'sample_' + Date.now().toString(36).slice(-4);
    const fileName = safeName(label) + '.wav';
    await store.writeBuffer('samples/' + fileName, bufferToWav(buf));
    engine.addSample('sample:' + fileName, fileName.replace(/\.wav$/, ''), buf);
    refreshInstrumentLists();
    refreshLibrary();
    $('recStatus').textContent = t('t_imported');
  } catch (e) { toast(errMsg(e)); }
}

// ---- Library ----------------------------------------------------------------------------------------
async function previewFile(path) {
  try {
    await ready();
    const buf = await engine.ctx.decodeAudioData(await store.readBuffer(path));
    const s = engine.ctx.createBufferSource();
    s.buffer = buf;
    s.connect(engine.master);
    s.start();
  } catch (e) { toast(errMsg(e)); }
}

async function fillList(boxId, dir, filter, actions) {
  const box = $(boxId);
  box.innerHTML = '';
  const items = (await store.list(dir)).filter(filter);
  if (!items.length) { box.append(el('p', { class: 'empty' }, t('empty'))); return; }
  items.forEach((it) => {
    const row = el('div', { class: 'row-item' }, el('div', { class: 'nm' }, it.name));
    actions.forEach((a) => {
      const b = el('button', {}, t(a.key));
      b.onclick = () => a.fn(it.name);
      row.append(b);
    });
    const dl = el('button', {}, '⬇');
    dl.title = t('dl');
    dl.onclick = async () => {
      try { await store.exportPublic(`${dir}/${it.name}`); toast(t('t_dl')); } catch (e) { toast(errMsg(e)); }
    };
    row.append(dl);
    box.append(row);
  });
}

async function remove(path) {
  await store.remove(path);
  refreshLibrary();
}

async function refreshLibrary() {
  const isFile = (f) => f.type !== 'directory';
  await fillList('libProjects', 'projects', isFile, [
    { key: 'load', fn: loadProject }, { key: 'del', fn: (n) => remove('projects/' + n) }]);
  await fillList('libLoops', 'loops', isFile, [
    { key: 'play_btn', fn: (n) => previewFile('loops/' + n) }, { key: 'del', fn: (n) => remove('loops/' + n) }]);
  await fillList('libSamples', 'samples', isFile, [
    { key: 'play_btn', fn: (n) => previewFile('samples/' + n) },
    { key: 'del', fn: async (n) => { engine.samples.delete('sample:' + n); await remove('samples/' + n); refreshInstrumentLists(); } }]);
  await fillList('libRecs', 'recordings', isFile, [
    { key: 'play_btn', fn: (n) => previewFile('recordings/' + n) }, { key: 'del', fn: (n) => remove('recordings/' + n) }]);
  await fillList('libStems', 'separated', (f) => f.type === 'directory', [
    { key: 'open', fn: (n) => { openStems(n); showTab('sep'); } }, { key: 'del', fn: (n) => remove('separated/' + n) }]);
}

// ---- Separation + stem player ----------------------------------------------------------------------------
async function runSeparation() {
  const file = $('sepFile').files[0];
  const url = $('sepUrl').value.trim();
  const token = $('sepToken').value;
  if (!file) { toast(t('t_pick')); return; }
  localStorage.setItem('sepUrl', url);
  localStorage.setItem('sepToken', token);
  const btn = $('btnSep');
  btn.disabled = true;
  const status = (m) => { $('sepStatus').textContent = m; };
  try {
    status(t('t_uploading'));
    const id = await sep.startJob(url, token, file, $('sepModel').value, $('sepFmt').value);
    const t0 = Date.now();
    const job = await sep.waitJob(url, token, id, () => status(t('t_working', Math.round((Date.now() - t0) / 1000))));
    const song = safeName(file.name.replace(/\.[^.]+$/, ''));
    for (const stem of job.stems) {
      status(t('t_downloading', stem));
      await store.writeBuffer(`separated/${song}/${stem}`, await sep.downloadStem(url, token, id, stem));
    }
    sep.deleteJob(url, token, id);
    status(t('t_sep_done'));
    refreshLibrary();
    openStems(song);
  } catch (e) {
    status(errMsg(e));
  } finally {
    btn.disabled = false;
  }
}

let stemEls = [];
let stemTimer = null;
let stemUrls = [];
function stopStems() {
  clearInterval(stemTimer);
  stemEls.forEach((a) => { a.pause(); a.src = ''; });
  stemUrls.forEach((u) => URL.revokeObjectURL(u));
  stemEls = []; stemUrls = [];
}

async function openStems(song) {
  stopStems();
  const box = $('stemPlayer');
  box.innerHTML = '';
  try {
    const files = (await store.list('separated/' + song)).filter((f) => f.type !== 'directory' && /\.(wav|mp3)$/i.test(f.name));
    if (!files.length) { box.append(el('p', { class: 'empty' }, t('empty'))); return; }
    box.append(el('p', { class: 'hint' }, song));
    for (const f of files) {
      const ab = await store.readBuffer(`separated/${song}/${f.name}`);
      const url = URL.createObjectURL(new Blob([ab], { type: /mp3$/i.test(f.name) ? 'audio/mpeg' : 'audio/wav' }));
      stemUrls.push(url);
      const a = new Audio(url);
      a.preload = 'auto';
      stemEls.push(a);
      const vol = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: 1 });
      vol.oninput = () => { a.volume = +vol.value; };
      const mute = el('button', { class: 'mini' }, 'M');
      mute.onclick = () => { a.muted = !a.muted; mute.classList.toggle('on', a.muted); };
      box.append(el('div', { class: 'stem' }, el('div', { class: 'nm' }, f.name.replace(/\.[^.]+$/, '')), vol, mute));
    }
    const ref = stemEls[0];
    const seek = el('input', { type: 'range', min: 0, max: 1, step: 0.1, value: 0 });
    ref.addEventListener('loadedmetadata', () => { seek.max = ref.duration; });
    ref.addEventListener('timeupdate', () => { seek.value = ref.currentTime; });
    seek.oninput = () => stemEls.forEach((a) => { a.currentTime = +seek.value; });
    const play = el('button', { class: 'btn' }, '▶ / ■');
    let on = false;
    play.onclick = async () => {
      on = !on;
      if (on) {
        stemEls.forEach((a) => { a.currentTime = ref.currentTime; });
        await Promise.all(stemEls.map((a) => a.play()));
        // keep the stems aligned: <audio> elements can drift slightly over time
        stemTimer = setInterval(() => stemEls.forEach((a) => {
          if (a !== ref && Math.abs(a.currentTime - ref.currentTime) > 0.04) a.currentTime = ref.currentTime;
        }), 1500);
      } else {
        clearInterval(stemTimer);
        stemEls.forEach((a) => a.pause());
      }
    };
    box.append(el('div', { class: 'panel' }, play, seek));
  } catch (e) { toast(errMsg(e)); }
}

// ---- UI loop -------------------------------------------------------------------------------------------
let lastCur = -1;
function frame() {
  if (engine.ctx && engine.playing) {
    const now = engine.ctx.currentTime;
    let cur = null;
    while (engine.queue.length && engine.queue[0].time <= now) cur = engine.queue.shift();
    if (cur && cur.step !== lastCur) {
      lastCur = cur.step;
      document.querySelectorAll('.cell.cur').forEach((c) => c.classList.remove('cur'));
      document.querySelectorAll(`.cell[data-step="${cur.step}"]`).forEach((c) => c.classList.add('cur'));
    }
  } else if (lastCur !== -1) {
    document.querySelectorAll('.cell.cur').forEach((c) => c.classList.remove('cur'));
    lastCur = -1;
  }
  if (rec && rec.isOpen) $('meterBar').style.width = Math.min(100, rec.level() * 140) + '%';
  requestAnimationFrame(frame);
}

function showTab(name) {
  document.querySelectorAll('.tab').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + name));
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'lib') refreshLibrary();
}

// ---- Boot ----------------------------------------------------------------------------------------------
function bind() {
  document.querySelectorAll('#tabs button').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });
  $('btnPlay').onclick = togglePlay;
  $('bpmUp').onclick = () => changeBpm(engine.bpm + 1);
  $('bpmDown').onclick = () => changeBpm(engine.bpm - 1);
  $('bpmNum').onchange = () => changeBpm(+$('bpmNum').value || engine.bpm);
  $('bpmRange').oninput = () => changeBpm(+$('bpmRange').value);
  $('btnTap').addEventListener('pointerdown', tap);
  $('btnMetro').onclick = () => { engine.metronome = !engine.metronome; $('btnMetro').classList.toggle('on', engine.metronome); };
  $('btnLang').onclick = () => {
    setLang(lang() === 'fr' ? 'en' : 'fr');
    $('btnLang').textContent = lang() === 'fr' ? 'EN' : 'FR';
    refreshInstrumentLists(); renderClips(); refreshLibrary();
  };
  $('selSteps').onchange = () => {
    if (engine.playing || recBusy) { $('selSteps').value = String(engine.steps); toast(t('t_lock')); return; }
    engine.steps = +$('selSteps').value;
    renderTracks();
  };
  $('selPreset').onchange = () => {
    if (engine.playing) { engine.stop(); setPlayUi(); }
    loadPreset(+$('selPreset').value);
  };
  $('master').oninput = () => engine.setMaster(+$('master').value);
  $('btnAdd').onclick = () => { engine.tracks.push(newTrack($('selAdd').value)); renderTracks(); renderPads(); };
  $('btnClear').onclick = () => { engine.tracks.forEach((x) => x.pattern.fill(0)); renderTracks(); };
  $('btnSave').onclick = saveProject;
  $('btnExport').onclick = exportLoop;
  $('fileSample').onchange = (e) => { importSamples([...e.target.files]); e.target.value = ''; };
  $('btnMic').onclick = () => openMic().catch(() => {});
  $('btnRecLoop').onclick = recordLoop;
  $('recLat').oninput = () => { $('latVal').textContent = $('recLat').value; };
  $('btnOneStart').onclick = oneShotStart;
  $('btnOneStop').onclick = oneShotStop;
  $('btnTest').onclick = async () => {
    try { await sep.testServer($('sepUrl').value.trim(), $('sepToken').value); toast(t('t_srv_ok')); } catch (e) { toast(errMsg(e)); }
  };
  $('btnSep').onclick = runSeparation;
  $('btnRefresh').onclick = refreshLibrary;
  $('permOk').onclick = async () => {
    await store.requestStoragePermissions();
    await store.requestMicPermission();
    localStorage.setItem('permAsked', '1');
    $('permModal').hidden = true;
  };
  $('permLater').onclick = () => { $('permModal').hidden = true; };
}

(async function boot() {
  applyI18n();
  $('btnLang').textContent = lang() === 'fr' ? 'EN' : 'FR';
  $('sepUrl').value = localStorage.getItem('sepUrl') || '';
  $('sepToken').value = localStorage.getItem('sepToken') || '';
  const syncHeader = () => document.documentElement.style.setProperty('--th', $('transport').offsetHeight + 'px');
  syncHeader();
  window.addEventListener('resize', syncHeader);
  fillInstruments($('selAdd'), 'gangan-high');
  loadPreset(0);
  renderClips();
  bind();
  requestAnimationFrame(frame);
  if (!localStorage.getItem('permAsked')) $('permModal').hidden = false;
  try {
    await store.initStorage();
    engine.ensureCtx();
    await loadSamples();
    refreshLibrary();
  } catch (e) { toast(errMsg(e)); }
})();
