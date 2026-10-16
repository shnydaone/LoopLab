/**
 * Pitched synthesised instruments. Each preset is an original patch; none
 * pretends to be a sampled real instrument.
 */
import * as Tone from 'tone';
import { midiToFreq } from '@/music/theory';
import type { Instrument } from './types';

abstract class BaseInst implements Instrument {
  readonly output = new Tone.Gain(1);
  abstract readonly mono: boolean;
  protected nodes: Tone.ToneAudioNode[] = [];
  constructor(readonly id: string, level: number) {
    this.output.gain.value = level;
  }
  protected track<T extends Tone.ToneAudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
  abstract notes(midis: number[], duration: number, velocity: number, time: number): void;
  abstract releaseAll(time?: number): void;
  dispose() {
    for (const n of this.nodes) n.dispose();
    this.output.dispose();
  }
}

/** Monophonic bass on a MonoSynth with a parallel sub-sine layer. */
export class BassInst extends BaseInst {
  readonly mono = true;
  private synth: Tone.MonoSynth;
  private sub?: Tone.Synth;
  private last = -1;

  constructor(
    id: string,
    level: number,
    opts: ConstructorParameters<typeof Tone.MonoSynth>[0],
    subLevel = 0,
    drive = 0,
  ) {
    super(id, level);
    let dest: Tone.ToneAudioNode = this.output;
    if (drive > 0) {
      dest = this.track(new Tone.Distortion({ distortion: drive, wet: 0.35 }).connect(this.output));
    }
    this.synth = this.track(new Tone.MonoSynth(opts).connect(dest));
    if (subLevel > 0) {
      const g = this.track(new Tone.Gain(subLevel).connect(this.output));
      this.sub = this.track(
        new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.9, release: 0.12 },
        }).connect(g),
      );
    }
  }

  notes(midis: number[], duration: number, velocity: number, time: number) {
    const m = midis[0];
    if (m === undefined) return;
    const t = time <= this.last ? this.last + 0.002 : time;
    this.last = t;
    const f = midiToFreq(m);
    this.synth.triggerAttackRelease(f, duration, t, velocity);
    this.sub?.triggerAttackRelease(f, duration, t, velocity);
  }

  releaseAll(time?: number) {
    this.synth.triggerRelease(time);
    this.sub?.triggerRelease(time);
  }
}

/** Generic polyphonic wrapper with optional strum and octave layering. */
export class PolyInst extends BaseInst {
  readonly mono = false;
  private poly: Tone.PolySynth;

  constructor(
    id: string,
    level: number,
    make: () => Tone.PolySynth,
    chain: Tone.ToneAudioNode[] = [],
    private opts: { strum?: number; layers?: number[]; minDur?: number } = {},
  ) {
    super(id, level);
    this.poly = this.track(make());
    this.poly.maxPolyphony = 24;
    for (const c of chain) this.track(c);
    if (chain.length) {
      this.poly.chain(...chain, this.output);
    } else {
      this.poly.connect(this.output);
    }
  }

  notes(midis: number[], duration: number, velocity: number, time: number) {
    const layers = this.opts.layers ?? [0];
    const strum = this.opts.strum ?? 0;
    const dur = Math.max(this.opts.minDur ?? 0.03, duration);
    midis.forEach((m, i) => {
      const freqs = layers.map((l) => midiToFreq(m + l));
      this.poly.triggerAttackRelease(freqs, dur, time + i * strum, velocity);
    });
  }

  releaseAll(time?: number) {
    this.poly.releaseAll(time);
  }
}

/**
 * Plucked guitar: a Karplus-Strong voice pool (Tone.PluckSynth) plus a short
 * band-passed "chk" transient. Strums in either direction.
 */
export class GuitarInst extends BaseInst {
  readonly mono = false;
  private pool: { pluck: Tone.PluckSynth; vel: Tone.Gain; busyUntil: number }[] = [];
  private chk: Tone.PolySynth;
  private next = 0;

  constructor(
    id: string,
    level: number,
    private cfg: {
      dampening: number;
      resonance: number;
      release: number;
      chk: number;
      strum: number;
      up: boolean;
      hp: number;
      bright: number;
    },
  ) {
    super(id, level);
    const hp = this.track(new Tone.Filter(cfg.hp, 'highpass'));
    const presence = this.track(new Tone.Filter({ frequency: 2800, type: 'peaking', gain: cfg.bright, Q: 0.8 }));
    const chorus = this.track(new Tone.Chorus({ frequency: 1.2, delayTime: 3, depth: 0.25, wet: 0.25 }).start());
    hp.chain(presence, chorus, this.output);
    for (let i = 0; i < 12; i++) {
      const vel = this.track(new Tone.Gain(0).connect(hp));
      const pluck = this.track(
        new Tone.PluckSynth({
          attackNoise: 1.4,
          dampening: cfg.dampening,
          resonance: cfg.resonance,
          release: cfg.release,
        }).connect(vel),
      );
      this.pool.push({ pluck, vel, busyUntil: 0 });
    }
    const bp = this.track(new Tone.Filter({ frequency: 1900, type: 'bandpass', Q: 1.1 }).connect(hp));
    this.chk = this.track(
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 },
      }).connect(bp),
    );
    this.chk.maxPolyphony = 16;
  }

  notes(midis: number[], duration: number, velocity: number, time: number) {
    const order = this.cfg.up ? [...midis].reverse() : midis;
    order.forEach((m, i) => {
      const t = time + i * this.cfg.strum;
      let voice = this.pool.find((p) => p.busyUntil <= t);
      if (!voice) {
        voice = this.pool[this.next % this.pool.length];
        this.next++;
      }
      voice.busyUntil = t + duration + this.cfg.release + 0.02;
      voice.vel.gain.setValueAtTime(velocity, t);
      voice.pluck.triggerAttack(midiToFreq(m), t);
      voice.pluck.triggerRelease(t + Math.max(0.04, duration));
    });
    if (this.cfg.chk > 0) {
      this.chk.triggerAttackRelease(
        order.map((m) => midiToFreq(m)),
        0.03,
        time,
        velocity * this.cfg.chk,
      );
    }
  }

  releaseAll(time?: number) {
    const t = time ?? Tone.now();
    for (const p of this.pool) p.pluck.triggerRelease(t);
    this.chk.releaseAll(t);
  }
}

const organPartials = [1, 0.75, 0.55, 0.4, 0, 0.28, 0, 0.18];
const comboPartials = [1, 0.1, 0.45, 0.05, 0.28, 0, 0.18, 0, 0.12];

export function createPitched(id: string): Instrument | null {
  switch (id) {
    case 'bass-dub':
      return new BassInst(
        id,
        Tone.dbToGain(-7.5),
        {
          oscillator: { type: 'custom', partials: [1, 0.32, 0.12, 0.05] },
          filter: { type: 'lowpass', Q: 0.7, rolloff: -24 },
          filterEnvelope: { attack: 0.006, decay: 0.3, sustain: 0.45, release: 0.15, baseFrequency: 160, octaves: 2 },
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.8, release: 0.12 },
        },
        0.35,
        0.12,
      );
    case 'bass-round':
      return new BassInst(
        id,
        Tone.dbToGain(-7.5),
        {
          oscillator: { type: 'custom', partials: [1, 0.55, 0.36, 0.25, 0.18, 0.1] },
          filter: { type: 'lowpass', Q: 1.4, rolloff: -24 },
          filterEnvelope: { attack: 0.003, decay: 0.2, sustain: 0.25, release: 0.1, baseFrequency: 220, octaves: 2.6 },
          envelope: { attack: 0.004, decay: 0.38, sustain: 0.45, release: 0.08 },
        },
        0.2,
        0.08,
      );
    case 'gtr-skank':
      return new GuitarInst(id, Tone.dbToGain(2), {
        dampening: 4800,
        resonance: 0.92,
        release: 0.07,
        chk: 0.12,
        strum: 0.007,
        up: false,
        hp: 280,
        bright: 5,
      });
    case 'gtr-muted':
      return new GuitarInst(id, Tone.dbToGain(2), {
        dampening: 2200,
        resonance: 0.6,
        release: 0.03,
        chk: 0.3,
        strum: 0.005,
        up: false,
        hp: 220,
        bright: 3,
      });
    case 'gtr-ska':
      return new GuitarInst(id, Tone.dbToGain(4), {
        dampening: 6200,
        resonance: 0.9,
        release: 0.05,
        chk: 0.18,
        strum: 0.006,
        up: true,
        hp: 350,
        bright: 6,
      });
    case 'organ-bubble':
      return new PolyInst(
        id,
        Tone.dbToGain(-6),
        () =>
          new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'custom', partials: organPartials },
            envelope: { attack: 0.004, decay: 0.06, sustain: 0.85, release: 0.05 },
          }),
        [
          new Tone.Filter(3800, 'lowpass'),
          new Tone.Vibrato({ frequency: 5.8, depth: 0.06 }),
          new Tone.Chorus({ frequency: 0.8, delayTime: 3.5, depth: 0.5, wet: 0.45 }).start(),
        ],
      );
    case 'organ-combo':
      return new PolyInst(
        id,
        Tone.dbToGain(-9),
        () =>
          new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'custom', partials: comboPartials },
            envelope: { attack: 0.003, decay: 0.05, sustain: 0.9, release: 0.04 },
          }),
        [new Tone.Filter(4500, 'lowpass'), new Tone.Vibrato({ frequency: 6.4, depth: 0.1 })],
      );
    case 'ep-tines':
      return new PolyInst(
        id,
        Tone.dbToGain(-11),
        () =>
          new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 1,
            modulationIndex: 5,
            oscillator: { type: 'sine' },
            modulation: { type: 'sine' },
            envelope: { attack: 0.002, decay: 2.2, sustain: 0.25, release: 0.9 },
            modulationEnvelope: { attack: 0.002, decay: 0.45, sustain: 0.08, release: 0.5 },
          }),
        [new Tone.Tremolo({ frequency: 3.6, depth: 0.3, spread: 140 }).start(), new Tone.Chorus(1, 2.5, 0.3).start()],
      );
    case 'piano-bright':
      return new PolyInst(
        id,
        Tone.dbToGain(-12),
        () =>
          new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 2,
            modulationIndex: 3.5,
            oscillator: { type: 'sine' },
            modulation: { type: 'triangle' },
            envelope: { attack: 0.002, decay: 1.1, sustain: 0.12, release: 0.35 },
            modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0.05, release: 0.3 },
          }),
        [new Tone.Filter(5200, 'lowpass')],
        { strum: 0.004 },
      );
    case 'horns-roots':
      return new PolyInst(
        id,
        Tone.dbToGain(-5),
        () =>
          new Tone.PolySynth(Tone.MonoSynth, {
            oscillator: { type: 'fatsawtooth', count: 2, spread: 14 },
            filter: { type: 'lowpass', Q: 1.2, rolloff: -24 },
            filterEnvelope: { attack: 0.05, decay: 0.3, sustain: 0.55, release: 0.2, baseFrequency: 260, octaves: 2.3 },
            envelope: { attack: 0.035, decay: 0.2, sustain: 0.85, release: 0.16 },
          }),
        [new Tone.Vibrato({ frequency: 5, depth: 0.05 })],
        { layers: [0, -12], minDur: 0.08 },
      );
    case 'horns-ska':
      return new PolyInst(
        id,
        Tone.dbToGain(-7),
        () =>
          new Tone.PolySynth(Tone.MonoSynth, {
            oscillator: { type: 'fatsawtooth', count: 2, spread: 18 },
            filter: { type: 'lowpass', Q: 1.6, rolloff: -24 },
            filterEnvelope: { attack: 0.03, decay: 0.22, sustain: 0.6, release: 0.15, baseFrequency: 420, octaves: 2.9 },
            envelope: { attack: 0.02, decay: 0.15, sustain: 0.85, release: 0.1 },
          }),
        [new Tone.Vibrato({ frequency: 5.6, depth: 0.04 })],
        { layers: [0, -12], minDur: 0.06 },
      );
    default:
      return null;
  }
}
