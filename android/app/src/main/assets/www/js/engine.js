import { getSound, click } from './sounds.js';

// Look-ahead scheduler: a 25 ms timer schedules every event up to 150 ms ahead on the audio clock,
// so timing never depends on the JS timer and the loop wraps with no gap. The loop runs until stop().

export const MAX_STEPS = 32;
export const emptyPattern = () => new Array(MAX_STEPS).fill(0);
const VEL = [0, 0.65, 1.0]; // 0 = off, 1 = normal, 2 = accent

export class Engine {
  constructor() {
    this.ctx = null;
    this.bpm = 100;
    this.steps = 16; // steps per bar (4 beats per bar)
    this.metronome = true;
    this.masterVol = 0.9;
    this.tracks = [];
    this.clips = []; // recorded loops: {id,name,bars,bpm,phase,vol,mute,buffer,file}
    this.samples = new Map(); // id -> {id,name,buffer}
    this.playing = false;
    this.step = 0;
    this.bar = 0;
    this.nextNoteTime = 0;
    this.queue = [];
    this.activeClips = new Set();
    this._uid = 1;
  }

  uid() { return this._uid++; }

  // Creates the context without resuming it (allowed before a user gesture, enough for decoding).
  ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVol;
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -10;
      this.comp.ratio.value = 4;
      this.master.connect(this.comp);
      this.comp.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async init() {
    this.ensureCtx();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    return this.ctx;
  }

  setMaster(v) { this.masterVol = v; if (this.master) this.master.gain.value = v; }
  setBpm(v) { this.bpm = Math.max(40, Math.min(240, Math.round(v))); }
  stepsPerBeat() { return this.steps / 4; }
  stepDur() { return 60 / this.bpm / this.stepsPerBeat(); }
  barDuration() { return this.stepDur() * this.steps; }

  // Audio-clock time at which the next bar starts (step 0), and its bar index.
  nextBarStartTime() {
    const remaining = (this.steps - this.step) % this.steps;
    return this.nextNoteTime + remaining * this.stepDur();
  }
  nextBarIndex() { return this.step === 0 ? this.bar : this.bar + 1; }

  resolveSound(id) {
    if (id.startsWith('sample:')) return this.samples.get(id);
    return getSound(id);
  }

  addSample(id, name, buffer) {
    this.samples.set(id, {
      id, name, buffer,
      play: (ctx, t, out, v) => {
        const s = ctx.createBufferSource();
        s.buffer = buffer;
        const g = ctx.createGain();
        g.gain.value = v;
        s.connect(g); g.connect(out);
        s.start(t);
      },
    });
  }

  trigger(soundId, vel = 1) {
    if (!this.ctx) return;
    const snd = this.resolveSound(soundId);
    if (snd) snd.play(this.ctx, this.ctx.currentTime + 0.005, this.master, vel);
  }

  addClip(c) {
    const clip = { id: this.uid(), vol: 0.9, mute: false, phase: 0, ...c };
    this.clips.push(clip);
    return clip;
  }
  removeClip(id) { this.clips = this.clips.filter((c) => c.id !== id); }

  // ---- scheduling (shared by live playback and offline render) ------------------------------
  _scheduleStep(ctx, out, step, bar, t, live) {
    for (const tr of this.tracks) {
      const v = VEL[tr.pattern[step]] || 0;
      if (!v || tr.mute) continue;
      const snd = this.resolveSound(tr.soundId);
      if (!snd) continue;
      const g = ctx.createGain();
      g.gain.value = tr.vol;
      g.connect(out);
      snd.play(ctx, t, g, v);
    }
    if (step === 0) {
      for (const c of this.clips) {
        if (c.mute) continue;
        if ((((bar - c.phase) % c.bars) + c.bars) % c.bars !== 0) continue;
        const src = ctx.createBufferSource();
        src.buffer = c.buffer;
        src.playbackRate.value = this.bpm / c.bpm; // keeps the take on the grid (pitch follows tempo)
        const g = ctx.createGain();
        g.gain.value = c.vol;
        src.connect(g); g.connect(out);
        src.start(t);
        if (live) {
          this.activeClips.add(src);
          src.onended = () => this.activeClips.delete(src);
        }
      }
    }
    if (live && this.metronome && step % this.stepsPerBeat() === 0) click(ctx, t, out, step === 0);
  }

  _tick() {
    const ctx = this.ctx;
    while (this.nextNoteTime < ctx.currentTime + 0.15) {
      this._scheduleStep(ctx, this.session, this.step, this.bar, this.nextNoteTime, true);
      this.queue.push({ step: this.step, time: this.nextNoteTime });
      if (this.queue.length > 64) this.queue.shift(); // UI may be paused while the app is hidden
      this.nextNoteTime += this.stepDur(); // read each step: BPM changes apply instantly
      if (++this.step >= this.steps) { this.step = 0; this.bar++; }
    }
  }

  async start() {
    await this.init();
    if (this.playing) return;
    this.session = this.ctx.createGain();
    this.session.connect(this.master);
    this.step = 0;
    this.bar = 0;
    this.queue = [];
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.playing = true;
    this.timer = setInterval(() => this._tick(), 25);
    this._tick();
    try { this.wake = await navigator.wakeLock?.request('screen'); } catch (e) { /* optional */ }
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const s = this.session;
    const t = this.ctx.currentTime;
    s.gain.cancelScheduledValues(t);
    s.gain.setValueAtTime(s.gain.value, t);
    s.gain.linearRampToValueAtTime(0, t + 0.04); // short fade, no click, cancels pre-scheduled events
    setTimeout(() => { try { s.disconnect(); } catch (e) { /* noop */ } }, 120);
    this.activeClips.forEach((src) => { try { src.stop(t + 0.05); } catch (e) { /* noop */ } });
    this.activeClips.clear();
    this.queue = [];
    try { this.wake?.release(); } catch (e) { /* noop */ }
  }

  // Render `bars` bars (metronome excluded) to an AudioBuffer.
  async render(bars) {
    const sr = this.ctx ? this.ctx.sampleRate : 44100;
    const total = Math.ceil(bars * this.steps * this.stepDur() * sr);
    const off = new OfflineAudioContext(2, total, sr);
    const out = off.createGain();
    out.gain.value = this.masterVol;
    out.connect(off.destination);
    const sd = this.stepDur();
    let t = 0;
    for (let b = 0; b < bars; b++) {
      for (let s = 0; s < this.steps; s++) {
        this._scheduleStep(off, out, s, b, t, false);
        t += sd;
      }
    }
    return off.startRendering();
  }

  cycleBars() { return Math.max(1, ...this.clips.map((c) => c.bars)); }
}
