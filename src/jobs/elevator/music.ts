import type { Sfx } from '../../audio';

/**
 * Elevator music stations. Station 0 is the engine's own muzak, the others are played
 * here with the shared synth. Each station changes how fast the awkward silence grows.
 */
export const SILENCE_FACTOR = [0.7, 0.55, 0.35, 0.8, 1.5];

const BOSSA = [
  [146.8, 174.6, 220.0, 261.6],
  [130.8, 164.8, 196.0, 246.9],
  [110.0, 146.8, 174.6, 220.0],
  [123.5, 155.6, 185.0, 233.1],
];

export class Radio {
  station = 0;
  private sfx: Sfx;
  private t = 0;
  private step = 0;

  constructor(sfx: Sfx) {
    this.sfx = sfx;
  }

  set(station: number): void {
    this.station = station;
    this.step = 0;
    this.t = 0;
    this.sfx.musicOn = station === 0;
  }

  update(dt: number): void {
    if (this.station === 0 || this.station === 4) return;
    this.t -= dt;
    if (this.t > 0) return;
    const s = this.sfx;
    const k = this.step++;
    switch (this.station) {
      case 1: {
        // Bossa nova: syncopated chords and a walking bass
        this.t = 0.22;
        const chord = BOSSA[Math.floor(k / 16) % BOSSA.length];
        const pat = k % 16;
        if (pat === 0 || pat === 6 || pat === 10) s.tone(chord[0] / 2, 0.4, 'triangle', 0.05);
        if ([2, 5, 8, 11, 14].includes(pat)) for (const f of chord.slice(1)) s.tone(f * 2, 0.18, 'sine', 0.012);
        if (pat % 4 === 0) s.noise(0.04, 0.03, 6000, 0, 1, 'highpass');
        break;
      }
      case 2: {
        // Dubstep for accountants: wobble bass and a clap
        this.t = 0.18;
        const pat = k % 16;
        if (pat % 2 === 0) s.tone(55 * (pat % 8 === 0 ? 1 : 1.5), 0.17, 'sawtooth', 0.07, pat % 4 === 0 ? 40 : 90);
        if (pat === 4 || pat === 12) s.noise(0.12, 0.12, 1600, 0, 0.8, 'bandpass');
        if (pat === 0 || pat === 7 || pat === 10) s.tone(60, 0.15, 'sine', 0.2, 35);
        break;
      }
      case 3: {
        // Whale sounds: long sliding tones
        this.t = 2.6;
        const base = [180, 240, 150, 300][k % 4];
        s.tone(base, 2.4, 'sine', 0.05, base * (k % 2 ? 0.6 : 1.5));
        s.noise(2.2, 0.015, 300, 0.3);
        break;
      }
    }
  }
}
