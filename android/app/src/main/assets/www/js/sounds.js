// Synthesized instruments (Web Audio). No audio files are bundled: every sound below is generated
// in real time. Real recordings can be imported as samples (Library / Loop tab) and will appear
// in the instrument dropdown under "My samples".
// Every voice has the signature play(ctx, time, out, velocity) and works with both a live
// AudioContext and an OfflineAudioContext (used for WAV export).

const noiseCache = new WeakMap();
function noiseBuf(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    const len = ctx.sampleRate * 2;
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}
function noise(ctx, t, dur, dest) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf(ctx);
  s.loop = true;
  s.connect(dest);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.02);
  return s;
}
function gainEnv(ctx, t, peak, attack, decay, dest) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(dest);
  return g;
}
function osc(ctx, type, f0, f1, t, dur, dest) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  o.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}
function filter(ctx, type, f, q, dest) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  b.connect(dest);
  return b;
}

// ---- Gongs -----------------------------------------------------------------
function gong(base, decay, ratios, strike = 0.15) {
  return (ctx, t, out, v) => {
    ratios.forEach((r, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * r * (1 + (i % 2 ? 0.0025 : -0.0025));
      const d = decay / (1 + i * 0.28);
      const g = gainEnv(ctx, t, (v * 0.38) / Math.pow(i + 1, 0.7), 0.012, d, out);
      o.connect(g);
      o.start(t);
      o.stop(t + d + 0.1);
    });
    const ng = gainEnv(ctx, t, v * strike, 0.004, 0.25, out);
    noise(ctx, t, 0.3, filter(ctx, 'bandpass', base * 6, 0.8, ng));
  };
}
const GONG_RATIOS = [1, 1.47, 2.09, 2.56, 3.37, 4.2, 5.4];

// ---- Hi-hats ---------------------------------------------------------------
function hat(decay, hp = 7000, level = 0.5) {
  return (ctx, t, out, v) => {
    const g = gainEnv(ctx, t, v * level, 0.001, decay, out);
    const f = filter(ctx, 'highpass', hp, 0.7, g);
    noise(ctx, t, decay + 0.05, f);
    // metallic shimmer
    [8000, 9400, 11200].forEach((fr) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = fr;
      const og = gainEnv(ctx, t, v * 0.04, 0.001, decay * 0.8, out);
      o.connect(filter(ctx, 'highpass', 7000, 0.5, og));
      o.start(t);
      o.stop(t + decay + 0.05);
    });
  };
}

// ---- Talking drum (gangan, Yoruba) ------------------------------------------
// Approximation: a membrane tone whose pitch glides (the squeezed lacing of the hourglass drum)
// plus a short skin/stick noise burst. It is a synthetic model, not a physical simulation.
function gangan({ f0, f1, f2, dur }) {
  return (ctx, t, out, v) => {
    const g = gainEnv(ctx, t, v * 0.9, 0.003, dur, out);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.45);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.1);
    // second partial follows the same glide (hollow, wooden body)
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(f0 * 2.02, t);
    o2.frequency.exponentialRampToValueAtTime(f1 * 2.02, t + dur * 0.45);
    o2.frequency.exponentialRampToValueAtTime(f2 * 2.02, t + dur);
    const g2 = gainEnv(ctx, t, v * 0.25, 0.003, dur * 0.7, out);
    o2.connect(g2);
    o2.start(t);
    o2.stop(t + dur + 0.1);
    // stick on skin
    const ng = gainEnv(ctx, t, v * 0.35, 0.001, 0.05, out);
    noise(ctx, t, 0.08, filter(ctx, 'bandpass', 2600, 1.2, ng));
  };
}

// ---- Djembe / conga ----------------------------------------------------------
const djembeBass = (ctx, t, out, v) => {
  const g = gainEnv(ctx, t, v * 1.0, 0.002, 0.45, out);
  osc(ctx, 'sine', 125, 62, t, 0.4, g);
  const ng = gainEnv(ctx, t, v * 0.3, 0.001, 0.08, out);
  noise(ctx, t, 0.1, filter(ctx, 'lowpass', 500, 0.7, ng));
};
const djembeTone = (ctx, t, out, v) => {
  const g = gainEnv(ctx, t, v * 0.8, 0.002, 0.22, out);
  osc(ctx, 'sine', 260, 200, t, 0.2, g);
  const ng = gainEnv(ctx, t, v * 0.3, 0.001, 0.06, out);
  noise(ctx, t, 0.08, filter(ctx, 'bandpass', 1400, 1.0, ng));
};
const djembeSlap = (ctx, t, out, v) => {
  const ng = gainEnv(ctx, t, v * 0.75, 0.001, 0.13, out);
  noise(ctx, t, 0.15, filter(ctx, 'bandpass', 3200, 0.9, ng));
  const g = gainEnv(ctx, t, v * 0.35, 0.001, 0.09, out);
  osc(ctx, 'sine', 430, 330, t, 0.08, g);
};
const conga = (f, decay) => (ctx, t, out, v) => {
  const g = gainEnv(ctx, t, v * 0.85, 0.002, decay, out);
  osc(ctx, 'sine', f * 1.12, f, t, decay, g);
  const ng = gainEnv(ctx, t, v * 0.2, 0.001, 0.04, out);
  noise(ctx, t, 0.06, filter(ctx, 'bandpass', 1800, 1, ng));
};

// ---- Shaker, bells, misc -------------------------------------------------------
const shekere = (ctx, t, out, v) => {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v * 0.35, t + 0.025);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  g.connect(out);
  noise(ctx, t, 0.2, filter(ctx, 'bandpass', 6200, 1.1, g));
};
const agogo = (f1, f2) => (ctx, t, out, v) => {
  [f1, f2].forEach((f, i) => {
    const g = gainEnv(ctx, t, v * (i ? 0.3 : 0.5), 0.001, 0.35, out);
    osc(ctx, 'triangle', f, f, t, 0.35, g);
  });
};
const cowbell = (ctx, t, out, v) => {
  const g = gainEnv(ctx, t, v * 0.45, 0.001, 0.3, out);
  const bp = filter(ctx, 'bandpass', 800, 1.5, g);
  [540, 800].forEach((f) => osc(ctx, 'square', f, f, t, 0.3, bp));
};
const claves = (ctx, t, out, v) => {
  const g = gainEnv(ctx, t, v * 0.7, 0.001, 0.07, out);
  osc(ctx, 'sine', 2500, 2400, t, 0.07, g);
};
const kick = (ctx, t, out, v) => {
  const g = gainEnv(ctx, t, v * 1.0, 0.002, 0.4, out);
  osc(ctx, 'sine', 150, 45, t, 0.35, g);
};
const snare = (ctx, t, out, v) => {
  const ng = gainEnv(ctx, t, v * 0.7, 0.001, 0.17, out);
  noise(ctx, t, 0.2, filter(ctx, 'bandpass', 1900, 0.8, ng));
  const g = gainEnv(ctx, t, v * 0.5, 0.001, 0.1, out);
  osc(ctx, 'triangle', 190, 150, t, 0.1, g);
};
const clap = (ctx, t, out, v) => {
  [0, 0.011, 0.022].forEach((d) => {
    const ng = gainEnv(ctx, t + d, v * 0.5, 0.001, d === 0.022 ? 0.18 : 0.02, out);
    noise(ctx, t + d, 0.2, filter(ctx, 'bandpass', 1500, 1.2, ng));
  });
};
const tambourine = (ctx, t, out, v) => {
  [0, 0.018, 0.034].forEach((d, i) => {
    const ng = gainEnv(ctx, t + d, v * (0.4 - i * 0.08), 0.001, 0.09, out);
    noise(ctx, t + d, 0.12, filter(ctx, 'highpass', 5500, 0.7, ng));
  });
};

export const GROUPS = [
  { id: 'gongs', labelKey: 'grp_gongs' },
  { id: 'hats', labelKey: 'grp_hats' },
  { id: 'african', labelKey: 'grp_african' },
  { id: 'kit', labelKey: 'grp_kit' },
];

export const SOUNDS = [
  { id: 'gong-large', group: 'gongs', name: 'Gong – large', play: gong(70, 5.5, GONG_RATIOS) },
  { id: 'gong-medium', group: 'gongs', name: 'Gong – medium', play: gong(110, 4, GONG_RATIOS) },
  { id: 'gong-small', group: 'gongs', name: 'Gong – small', play: gong(220, 2.4, GONG_RATIOS.slice(0, 5)) },
  { id: 'tamtam', group: 'gongs', name: 'Tam-tam (noisy)', play: gong(85, 4.5, [1, 1.31, 1.83, 2.4, 3.1, 4.4, 6.1], 0.35) },

  { id: 'hat-closed', group: 'hats', name: 'Hi-hat – closed', play: hat(0.05) },
  { id: 'hat-open', group: 'hats', name: 'Hi-hat – open', play: hat(0.4, 6500, 0.42) },
  { id: 'hat-pedal', group: 'hats', name: 'Hi-hat – pedal', play: hat(0.09, 5500, 0.4) },

  { id: 'gangan-low', group: 'african', name: 'Gangan (talking drum) – low', play: gangan({ f0: 150, f1: 142, f2: 132, dur: 0.55 }) },
  { id: 'gangan-high', group: 'african', name: 'Gangan (talking drum) – high', play: gangan({ f0: 300, f1: 290, f2: 270, dur: 0.45 }) },
  { id: 'gangan-rise', group: 'african', name: 'Gangan (talking drum) – glide up', play: gangan({ f0: 140, f1: 250, f2: 310, dur: 0.6 }) },
  { id: 'gangan-fall', group: 'african', name: 'Gangan (talking drum) – glide down', play: gangan({ f0: 320, f1: 220, f2: 140, dur: 0.6 }) },
  { id: 'gangan-talk', group: 'african', name: 'Gangan (talking drum) – "talk"', play: gangan({ f0: 170, f1: 265, f2: 185, dur: 0.7 }) },
  { id: 'djembe-bass', group: 'african', name: 'Djembe – bass', play: djembeBass },
  { id: 'djembe-tone', group: 'african', name: 'Djembe – tone', play: djembeTone },
  { id: 'djembe-slap', group: 'african', name: 'Djembe – slap', play: djembeSlap },
  { id: 'conga-low', group: 'african', name: 'Conga – low', play: conga(170, 0.4) },
  { id: 'conga-high', group: 'african', name: 'Conga – high', play: conga(260, 0.3) },
  { id: 'shekere', group: 'african', name: 'Shekere (shaker)', play: shekere },
  { id: 'agogo-high', group: 'african', name: 'Agogo bell – high', play: agogo(1180, 1760) },
  { id: 'agogo-low', group: 'african', name: 'Agogo bell – low', play: agogo(880, 1320) },

  { id: 'kick', group: 'kit', name: 'Kick', play: kick },
  { id: 'snare', group: 'kit', name: 'Snare', play: snare },
  { id: 'clap', group: 'kit', name: 'Clap', play: clap },
  { id: 'tambourine', group: 'kit', name: 'Tambourine', play: tambourine },
  { id: 'cowbell', group: 'kit', name: 'Cowbell', play: cowbell },
  { id: 'claves', group: 'kit', name: 'Claves', play: claves },
];

const byId = new Map(SOUNDS.map((s) => [s.id, s]));
export const getSound = (id) => byId.get(id);

// Metronome click
export function click(ctx, t, out, accent) {
  const g = gainEnv(ctx, t, accent ? 0.9 : 0.55, 0.001, 0.04, out);
  osc(ctx, 'sine', accent ? 2200 : 1500, accent ? 2200 : 1500, t, 0.04, g);
}
