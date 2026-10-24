// Sample-accurate microphone capture tied to the AudioContext clock.
// An AudioWorklet reports `currentFrame` for each block, so a take can be cut exactly on bar
// boundaries of the loop instead of relying on MediaRecorder start-up time.
const WORKLET = `
class RecProc extends AudioWorkletProcessor {
  constructor() { super(); this.on = false; this.port.onmessage = (e) => { this.on = e.data === 'start'; }; }
  process(inputs) {
    const i = inputs[0];
    if (this.on && i && i[0]) this.port.postMessage({ frame: currentFrame, data: i[0].slice() });
    return true;
  }
}
registerProcessor('rec-proc', RecProc);`;

const loadedCtx = new WeakSet();

export class Recorder {
  constructor(ctx) {
    this.ctx = ctx;
    this.chunks = [];
    this.capturing = false;
  }

  async open() {
    const ctx = this.ctx;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    this.src = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.src.connect(this.analyser);
    this.mute = ctx.createGain();
    this.mute.gain.value = 0; // keep the graph pulled without monitoring the mic (avoids feedback)
    this.mute.connect(ctx.destination);

    if (ctx.audioWorklet) {
      if (!loadedCtx.has(ctx)) {
        const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
        await ctx.audioWorklet.addModule(url);
        loadedCtx.add(ctx);
      }
      this.node = new AudioWorkletNode(ctx, 'rec-proc', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      this.node.port.onmessage = (e) => { if (this.capturing) this.chunks.push(e.data); };
    } else {
      // Fallback for engines without AudioWorklet
      this.node = ctx.createScriptProcessor(2048, 1, 1);
      this.node.onaudioprocess = (e) => {
        if (this.capturing) {
          this.chunks.push({ frame: Math.round(e.playbackTime * ctx.sampleRate), data: new Float32Array(e.inputBuffer.getChannelData(0)) });
        }
      };
    }
    this.src.connect(this.node);
    this.node.connect(this.mute);
  }

  get isOpen() { return !!this.stream; }

  begin() {
    this.chunks = [];
    this.capturing = true;
    this.node.port?.postMessage('start');
  }
  end() {
    this.capturing = false;
    this.node.port?.postMessage('stop');
  }

  // Samples [startFrame, startFrame+length) on the AudioContext timeline (zero-padded if missing).
  extract(startFrame, length) {
    const out = new Float32Array(length);
    for (const c of this.chunks) {
      const s = c.frame - startFrame;
      const lo = Math.max(0, s);
      const hi = Math.min(length, s + c.data.length);
      for (let i = lo; i < hi; i++) out[i] = c.data[i - s];
    }
    return out;
  }

  // Everything captured between begin() and end(), in order.
  extractAll() {
    if (!this.chunks.length) return new Float32Array(0);
    const first = Math.min(...this.chunks.map((c) => c.frame));
    const last = Math.max(...this.chunks.map((c) => c.frame + c.data.length));
    return this.extract(first, last - first);
  }

  level() {
    if (!this.analyser) return 0;
    const d = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(d);
    let m = 0;
    for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
    return m;
  }

  close() {
    this.stream?.getTracks().forEach((t) => t.stop());
    try { this.node?.disconnect(); this.src?.disconnect(); } catch (e) { /* noop */ }
    this.stream = null;
  }
}
