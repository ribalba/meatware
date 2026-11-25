// All sounds are synthesized, so there are no asset files yet.

const CHORDS = [
  [261.6, 329.6, 392.0, 493.9],
  [220.0, 261.6, 329.6, 392.0],
  [293.7, 349.2, 440.0, 523.3],
  [196.0, 246.9, 293.7, 349.2],
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];

export class Sfx {
  muted = false;
  voice = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicStep = 0;

  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    window.setInterval(() => this.musicTick(), 340);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    if (this.muted && 'speechSynthesis' in window) speechSynthesis.cancel();
    return this.muted;
  }

  toggleVoice(): boolean {
    this.voice = !this.voice;
    if (!this.voice && 'speechSynthesis' in window) speechSynthesis.cancel();
    return this.voice;
  }

  /** A simple synth tone. Jobs may use it for their own sounds. */
  tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.12, slideTo?: number, delay = 0): void {
    const ctx = this.ctx;
    const m = this.master;
    if (!ctx || !m) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(m);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /** Filtered noise burst. Jobs may use it for their own sounds. */
  noise(dur: number, vol: number, freq: number, delay = 0, q = 1, type: BiquadFilterType = 'lowpass'): void {
    const ctx = this.ctx;
    const m = this.master;
    if (!ctx || !m || !this.noiseBuf) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(m);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  beep() { this.tone(1046, 0.07, 'square', 0.05); this.tone(784, 0.07, 'square', 0.05, undefined, 0.08); }
  click() { this.tone(420, 0.05, 'triangle', 0.12); }
  ding() { this.tone(660, 0.12, 'sine', 0.15); this.tone(990, 0.2, 'sine', 0.15, undefined, 0.1); }
  buzz() { this.tone(110, 0.3, 'sawtooth', 0.1); }
  alarm() {
    for (let i = 0; i < 3; i++) {
      this.tone(880, 0.15, 'square', 0.07, undefined, i * 0.3);
      this.tone(660, 0.15, 'square', 0.07, undefined, i * 0.3 + 0.15);
    }
  }
  knock() { this.noise(0.08, 0.6, 260); this.noise(0.08, 0.6, 260, 0.18); }
  splash() { this.noise(1.6, 0.22, 1800, 0, 0.7); }
  thud() { this.tone(90, 0.18, 'sine', 0.3, 45); }
  whoosh() { this.noise(0.3, 0.15, 900, 0, 0.6, 'bandpass'); }
  pop() { this.tone(1600, 0.04, 'sine', 0.025); }
  pocket() { this.tone(500, 0.08, 'triangle', 0.1); this.tone(350, 0.12, 'triangle', 0.1, undefined, 0.09); }
  overheat() { this.tone(500, 1.8, 'sawtooth', 0.1, 40); this.noise(2, 0.15, 3000, 0.3, 0.5, 'highpass'); }
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'square', 0.05, undefined, i * 0.1)); }
  slip() { this.tone(900, 0.4, 'sine', 0.12, 200); this.tone(90, 0.2, 'sine', 0.3, 45, 0.4); }
  glug() {
    for (let i = 0; i < 3; i++) {
      this.noise(0.1, 0.35, 320, 0.25 + i * 0.32, 4, 'bandpass');
      this.tone(150, 0.09, 'sine', 0.14, 90, 0.25 + i * 0.32);
    }
  }
  smash() { this.noise(0.5, 0.5, 4200, 0, 0.8, 'highpass'); this.noise(0.25, 0.6, 600); this.tone(90, 0.3, 'square', 0.12, 40); }
  clink() { this.tone(2600, 0.06, 'triangle', 0.05); this.tone(3100, 0.08, 'triangle', 0.04, undefined, 0.05); }
  unlock() { this.tone(1200, 0.05, 'square', 0.06); this.tone(1500, 0.08, 'square', 0.06, undefined, 0.07); }

  // ---------------------------------------------------------------- intro

  /** Low, ominous synth pad for the intro. */
  drone(on: boolean): void {
    const ctx = this.ctx;
    const m = this.master;
    if (!ctx || !m) return;
    if (!on) {
      if (this.droneGain) {
        this.droneGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
        const nodes = this.droneNodes;
        setTimeout(() => nodes.forEach((n) => n.stop()), 4000);
      }
      this.droneGain = null;
      this.droneNodes = [];
      return;
    }
    if (this.droneGain) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 3);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    f.connect(g).connect(m);
    for (const [freq, det] of [[55, -6], [55, 7], [82.4, 0], [110, 4]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(f);
      o.start();
      this.droneNodes.push(o);
    }
    // Slow filter sweep so it breathes
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(f.frequency);
    lfo.start();
    this.droneNodes.push(lfo);
    this.droneGain = g;
  }
  private droneGain: GainNode | null = null;
  private droneNodes: OscillatorNode[] = [];

  /** Cinematic low hit. */
  boom() { this.tone(70, 1.6, 'sine', 0.5, 28); this.noise(0.9, 0.25, 220); }
  /** Rubber stamp on paper. */
  stamp() { this.noise(0.12, 0.7, 500); this.tone(120, 0.25, 'square', 0.15, 60); }
  typeTick() { this.noise(0.02, 0.08, 3000, 0, 1, 'highpass'); }

  /** Muzak is off during the intro. */
  musicOn = true;

  /** Elevator muzak. Very quiet. Very corporate. */
  private musicTick(): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.musicOn) return;
    const step = this.musicStep++;
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
    this.tone(chord[ARP[step % 8]] * 2, 0.32, 'sine', 0.016);
    if (step % 8 === 0) this.tone(chord[0] / 2, 2.6, 'triangle', 0.03);
  }

  say(text: string, who: 'boss' | 'other' | 'narrator' = 'boss'): void {
    if (this.muted || !this.voice || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    if (who === 'narrator') {
      // The deep "in a world where..." trailer voice, as deep as the browser allows.
      const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
      const deep = voices.find((v) => /male|daniel|david|fred|alex|george/i.test(v.name) && !/female/i.test(v.name));
      if (deep) u.voice = deep;
      u.pitch = 0.5;
      u.rate = 0.92;
    } else {
      u.pitch = who === 'boss' ? 0.2 : 1.5;
      u.rate = who === 'boss' ? 1.1 : 1.2;
    }
    speechSynthesis.speak(u);
  }

  stopVoice(): void {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
}
