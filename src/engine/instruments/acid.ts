/**
 * Acid bass modelled on how the TB-303 behaves (an original synthesis patch,
 * no samples):
 *  - one saw or square oscillator into a resonant 24 dB low-pass
 *  - a fast-decaying filter envelope ("env mod") on every new note
 *  - ACCENT (velocity ≥ 0.88): louder, brighter, snappier filter envelope
 *  - SLIDE: when a note is still held as the next one starts (the pattern
 *    writes it overlapping, like a 303 tie), the pitch glides ~60 ms and
 *    neither envelope retriggers
 *  - optional slow cutoff sweep over N bars, so a loop evolves like a
 *    producer riding the cutoff knob
 * The track's own Filter / Resonance / Drive knobs sit after this voice, so
 * the user can still tweak the acid in real time.
 */
import * as Tone from 'tone';
import { midiToFreq } from '@/music/theory';
import type { Instrument } from './types';

export interface AcidOptions {
  wave: 'sawtooth' | 'square';
  /** Resting cutoff, Hz. */
  cutoff: number;
  /** Filter-envelope depth in octaves above the cutoff. */
  envMod: number;
  /** Filter-envelope decay, seconds (accents decay faster). */
  decay: number;
  /** Filter Q per stage (two stages: resonance compounds). */
  resonance: number;
  /** Waveshaper gain; 0 = clean. */
  drive: number;
  level: number;
  /** Cutoff sweep: period in bars and depth in octaves (± around the cutoff). */
  sweep?: { bars: number; depth: number };
}

const SLIDE_TIME = 0.06;

export class AcidBass implements Instrument {
  readonly output = new Tone.Gain(1);
  /** Not clipped by the engine: overlapping notes are how slides are written. */
  readonly mono = false;
  private osc: Tone.Oscillator;
  private filter: Tone.Filter;
  private amp = new Tone.Gain(0);
  private nodes: Tone.ToneAudioNode[] = [];
  private endAt = 0;
  private lastT = 0;

  constructor(
    readonly id: string,
    private o: AcidOptions,
  ) {
    this.output.gain.value = o.level;
    this.osc = new Tone.Oscillator({ type: o.wave, frequency: 55 });
    this.filter = new Tone.Filter({ type: 'lowpass', rolloff: -24, frequency: o.cutoff, Q: o.resonance });
    // A gentle high-pass keeps the resonant low end from booming on low notes.
    const hp = new Tone.Filter({ type: 'highpass', frequency: 38, Q: 0.5 });
    this.nodes.push(this.osc, this.filter, this.amp, hp);
    let last: Tone.ToneAudioNode = this.amp;
    this.osc.chain(hp, this.filter, this.amp);
    if (o.drive > 0) {
      const k = o.drive;
      const norm = Math.tanh(k);
      const shaper = new Tone.WaveShaper((x) => Math.tanh(x * k) / norm, 4096);
      shaper.oversample = '4x';
      const tame = new Tone.Filter({ type: 'lowpass', frequency: 7500, Q: 0.5 });
      this.nodes.push(shaper, tame);
      last.chain(shaper, tame);
      last = tame;
    }
    last.connect(this.output);
    this.osc.start();
  }

  /** Cutoff at a given time, including the slow sweep. */
  private cutoffAt(t: number) {
    const sw = this.o.sweep;
    if (!sw) return this.o.cutoff;
    const bpm = Tone.getTransport().bpm.value || 120;
    const period = (sw.bars * 4 * 60) / bpm;
    // Starts low, opens over the first half of the cycle, closes again.
    const phase = (t % period) / period;
    return this.o.cutoff * Math.pow(2, sw.depth * -Math.cos(phase * 2 * Math.PI));
  }

  notes(midis: number[], duration: number, velocity: number, time: number) {
    const m = midis[0];
    if (m === undefined) return;
    const t = Math.max(time, this.lastT + 0.001);
    this.lastT = t;
    const f = midiToFreq(m);
    const accent = velocity >= 0.88;
    const slide = t < this.endAt - 0.004;
    const end = t + Math.max(0.03, duration);
    const freq = this.osc.frequency;
    const gain = this.amp.gain;
    const cut = this.filter.frequency;

    if (slide) {
      freq.cancelAndHoldAtTime(t);
      freq.exponentialRampToValueAtTime(f, t + SLIDE_TIME);
      gain.cancelAndHoldAtTime(t);
      if (accent) gain.linearRampToValueAtTime(0.95, t + 0.01);
    } else {
      freq.cancelScheduledValues(t);
      freq.setValueAtTime(f, t);
      const peak = (accent ? 0.95 : 0.6) * (0.75 + 0.25 * velocity);
      gain.cancelAndHoldAtTime(t);
      gain.linearRampToValueAtTime(peak, t + 0.003);
      gain.setTargetAtTime(peak * 0.7, t + 0.003, accent ? 0.12 : 0.3);

      const base = this.cutoffAt(t);
      const oct = this.o.envMod * (accent ? 1.45 : 1) * (0.65 + 0.35 * velocity);
      const top = Math.min(16000, base * Math.pow(2, oct));
      const decay = accent ? this.o.decay * 0.55 : this.o.decay;
      cut.cancelAndHoldAtTime(t);
      cut.linearRampToValueAtTime(top, t + 0.002);
      cut.setTargetAtTime(base, t + 0.002, decay / 3);
    }
    // Release (a slide into the next note cancels this).
    gain.setTargetAtTime(0, end, 0.007);
    this.endAt = end;
  }

  releaseAll(time?: number) {
    const t = time ?? Tone.now();
    this.amp.gain.cancelAndHoldAtTime(t);
    this.amp.gain.setTargetAtTime(0, t, 0.01);
    this.endAt = 0;
  }

  dispose() {
    this.osc.stop();
    for (const n of this.nodes) n.dispose();
    this.output.dispose();
  }
}

/** Hoover: the early-90s rave "whoop" lead. */
export class HooverInst implements Instrument {
  readonly output = new Tone.Gain(1);
  readonly mono = true;
  private saws: Tone.FatOscillator;
  private pulse: Tone.PulseOscillator;
  private pwm: Tone.LFO;
  private amp = new Tone.Gain(0);
  private nodes: Tone.ToneAudioNode[] = [];
  private lastT = 0;

  constructor(
    readonly id: string,
    level: number,
  ) {
    this.output.gain.value = level;
    // Detuned saw stack plus a pulse an octave down with its width swept: the
    // thick, phasey hoover body.
    this.saws = new Tone.FatOscillator({ type: 'sawtooth', count: 4, spread: 48, frequency: 220 });
    this.pulse = new Tone.PulseOscillator({ frequency: 110, width: 0.3 });
    this.pwm = new Tone.LFO({ frequency: 1.6, min: -0.6, max: 0.6 });
    this.pwm.connect(this.pulse.width);
    const pulseGain = new Tone.Gain(0.55);
    const mix = new Tone.Gain(0.3);
    const lp = new Tone.Filter({ type: 'lowpass', frequency: 5200, Q: 1.2 });
    const chorus = new Tone.Chorus({ frequency: 0.8, delayTime: 4.5, depth: 0.8, wet: 0.6 }).start();
    const drive = new Tone.Distortion({ distortion: 0.3, wet: 0.35 });
    this.nodes.push(this.saws, this.pulse, this.pwm, pulseGain, mix, lp, chorus, drive, this.amp);
    this.saws.connect(mix);
    this.pulse.chain(pulseGain, mix);
    mix.chain(lp, this.amp, drive, chorus, this.output);
    this.saws.start();
    this.pulse.start();
    this.pwm.start();
  }

  notes(midis: number[], duration: number, velocity: number, time: number) {
    const m = midis[0];
    if (m === undefined) return;
    const t = Math.max(time, this.lastT + 0.001);
    this.lastT = t;
    const f = midiToFreq(m);
    const end = t + Math.max(0.05, duration);
    // Swoop up into the note from a fourth below, dive an octave on release.
    for (const [p, mul] of [
      [this.saws.frequency, 1],
      [this.pulse.frequency, 0.5],
    ] as const) {
      p.cancelScheduledValues(t);
      p.setValueAtTime(f * mul * 0.75, t);
      p.exponentialRampToValueAtTime(f * mul, t + 0.09);
      p.setValueAtTime(f * mul, end);
      p.exponentialRampToValueAtTime(f * mul * 0.5, end + 0.22);
    }
    const g = this.amp.gain;
    const peak = 0.55 + 0.45 * velocity;
    g.cancelAndHoldAtTime(t);
    g.linearRampToValueAtTime(peak, t + 0.012);
    g.setValueAtTime(peak, end);
    g.linearRampToValueAtTime(0, end + 0.22);
  }

  releaseAll(time?: number) {
    const t = time ?? Tone.now();
    this.amp.gain.cancelAndHoldAtTime(t);
    this.amp.gain.setTargetAtTime(0, t, 0.02);
  }

  dispose() {
    this.saws.stop();
    this.pulse.stop();
    this.pwm.stop();
    for (const n of this.nodes) n.dispose();
    this.output.dispose();
  }
}
