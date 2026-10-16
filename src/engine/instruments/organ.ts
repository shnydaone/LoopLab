/**
 * Modelled organs.
 *
 * A Hammond-style tonewheel organ *is* additive synthesis: spinning wheels
 * generate near-sine tones that the drawbars mix together. So instead of
 * samples we model the parts that give it character:
 *   - nine drawbars at their real footages (16' … 1') in one periodic wave
 *   - key click (contact bounce) on note-on/off
 *   - single-trigger percussion on the 2nd or 3rd harmonic
 *   - a rotating Leslie speaker: separate horn and drum rotors with
 *     amplitude, Doppler-pitch and stereo movement at slow/fast speeds
 *   - gentle tube overdrive
 *
 * The transistor "combo" organ (Farfisa / Vox style, two-tone ska) is
 * modelled as bright divide-down tones with a formant filter and fast
 * pitch vibrato instead of a Leslie.
 */
import * as Tone from 'tone';
import { midiToFreq } from '@/music/theory';
import type { Instrument } from './types';

/** Drawbar footages as harmonics of the 16' sub-fundamental. */
const DRAWBAR_HARMONICS = [1, 3, 2, 4, 6, 8, 10, 12, 16]; // 16' 5⅓' 8' 4' 2⅔' 2' 1⅗' 1⅓' 1'

/** "88 8000 000" style string → periodic wave partials (each drawbar step ≈ 3 dB). */
export function drawbarPartials(reg: string): number[] {
  const levels = reg.replace(/\s/g, '').split('').map(Number);
  const partials = new Array(16).fill(0);
  levels.forEach((lvl, i) => {
    if (!lvl || i >= DRAWBAR_HARMONICS.length) return;
    const amp = Math.pow(10, ((lvl - 8) * 3) / 20);
    partials[DRAWBAR_HARMONICS[i] - 1] += amp;
  });
  return partials;
}

interface OrganConfig {
  registration: string;
  /** Percussion harmonic relative to the 8' fundamental: 2 (4') or 3 (2⅔'), 0 = off. */
  percussion: 0 | 2 | 3;
  percDecay: number;
  percLevel: number;
  click: number;
  leslie: 'slow' | 'fast' | 'off';
  drive: number;
  level: number;
}

interface OrganVoice {
  osc: OscillatorNode;
  gain: GainNode;
  perc?: { osc: OscillatorNode; gain: GainNode };
  end: number;
}

export class TonewheelOrgan implements Instrument {
  readonly output = new Tone.Gain(1);
  readonly mono = false;
  private input = new Tone.Gain(1);
  private wave: PeriodicWave;
  private nodes: Tone.ToneAudioNode[] = [];
  private voices: OrganVoice[] = [];
  private clickNoise: Tone.NoiseSynth;
  private lastClick = -1;

  constructor(
    readonly id: string,
    private cfg: OrganConfig,
  ) {
    this.output.gain.value = cfg.level;
    const ctx = Tone.getContext();
    const partials = drawbarPartials(cfg.registration);
    const real = new Float32Array(partials.length + 1);
    const imag = new Float32Array([0, ...partials]);
    this.wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });

    // Preamp: gentle tube-style saturation and the cabinet's natural top-end roll-off.
    const pre = this.track(new Tone.Distortion({ distortion: cfg.drive, wet: Math.min(1, cfg.drive * 2.5), oversample: '2x' }));
    const cab = this.track(new Tone.Filter({ type: 'lowpass', frequency: 5200, Q: 0.5 }));
    this.input.chain(pre, cab);

    if (cfg.leslie === 'off') {
      cab.connect(this.output);
    } else {
      // Leslie: crossover splits treble horn and bass drum rotors.
      const fast = cfg.leslie === 'fast';
      const hornHz = fast ? 6.7 : 0.82;
      const drumHz = fast ? 5.8 : 0.68;
      const lo = this.track(new Tone.Filter({ type: 'lowpass', frequency: 800, rolloff: -24 }));
      const hi = this.track(new Tone.Filter({ type: 'highpass', frequency: 800, rolloff: -24 }));
      cab.fan(lo, hi);
      const hornDoppler = this.track(new Tone.Vibrato({ frequency: hornHz, depth: 0.12, maxDelay: 0.005 }));
      const hornAm = this.track(new Tone.Tremolo({ frequency: hornHz, depth: 0.35, spread: 160 }).start());
      const hornPan = this.track(new Tone.AutoPanner({ frequency: hornHz, depth: 0.55 }).start());
      const drumDoppler = this.track(new Tone.Vibrato({ frequency: drumHz, depth: 0.04, maxDelay: 0.005 }));
      const drumAm = this.track(new Tone.Tremolo({ frequency: drumHz, depth: 0.18, spread: 90 }).start());
      hi.chain(hornDoppler, hornAm, hornPan, this.output);
      lo.chain(drumDoppler, drumAm, this.output);
    }

    // Key click: a very short band-passed noise burst.
    const clickBp = this.track(new Tone.Filter({ type: 'bandpass', frequency: 3200, Q: 0.8 }));
    const clickGain = this.track(new Tone.Gain(cfg.click));
    this.clickNoise = this.track(
      new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.0005, decay: 0.006, sustain: 0, release: 0.002 } }),
    );
    this.clickNoise.chain(clickBp, clickGain, this.input);
  }

  private track<T extends Tone.ToneAudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }

  private click(time: number, v: number) {
    if (this.cfg.click <= 0) return;
    const t = time <= this.lastClick ? this.lastClick + 0.001 : time;
    this.lastClick = t;
    this.clickNoise.triggerAttackRelease(0.006, t, v);
  }

  notes(midis: number[], duration: number, velocity: number, time: number) {
    const ctx = Tone.getContext();
    const t = Math.max(time, ctx.currentTime);
    const end = t + Math.max(0.03, duration);
    // Percussion is single-trigger: only sounds if no other key is still held.
    const legato = this.voices.some((v) => v.end > t + 0.002);
    // Organs aren't touch-sensitive; velocity only nudges the expression pedal a little.
    const level = (0.11 / Math.sqrt(Math.max(1, midis.length))) * (0.85 + 0.15 * velocity);
    this.click(t, 0.5 + 0.5 * velocity);
    for (const m of midis) {
      const f8 = midiToFreq(m);
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(this.wave);
      osc.frequency.value = f8 / 2; // wave is built on the 16' sub-fundamental
      // Tonewheels aren't perfectly tuned: a tiny per-note offset keeps chords alive.
      osc.detune.value = (Math.random() - 0.5) * 3;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(level, t + 0.004);
      gain.gain.setValueAtTime(level, end);
      gain.gain.linearRampToValueAtTime(0, end + 0.012);
      osc.connect(gain);
      Tone.connect(gain, this.input);
      osc.start(t);
      osc.stop(end + 0.05);
      const voice: OrganVoice = { osc, gain, end };
      if (this.cfg.percussion && !legato) {
        const p = ctx.createOscillator();
        p.type = 'sine';
        p.frequency.value = f8 * this.cfg.percussion;
        const pg = ctx.createGain();
        const pl = level * this.cfg.percLevel;
        pg.gain.setValueAtTime(pl, t);
        pg.gain.setTargetAtTime(0, t + 0.002, this.cfg.percDecay / 4);
        pg.gain.setTargetAtTime(0, end, 0.004); // key released: damp quickly
        p.connect(pg);
        Tone.connect(pg, this.input);
        p.start(t);
        p.stop(Math.min(end + 0.05, t + this.cfg.percDecay * 2));
        voice.perc = { osc: p, gain: pg };
      }
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
        if (voice.perc) {
          voice.perc.osc.disconnect();
          voice.perc.gain.disconnect();
        }
        this.voices = this.voices.filter((v) => v !== voice);
      };
      this.voices.push(voice);
    }
    this.click(end, 0.35);
  }

  releaseAll(time?: number) {
    const t = time ?? Tone.now();
    for (const v of this.voices) {
      try {
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setTargetAtTime(0, t, 0.005);
        v.osc.stop(t + 0.05);
        v.perc?.osc.stop(t + 0.05);
      } catch {
        /* already stopped */
      }
    }
    this.voices = [];
  }

  dispose() {
    this.releaseAll();
    for (const n of this.nodes) n.dispose();
    this.input.dispose();
    this.output.dispose();
  }
}

/**
 * Transistor combo organ (Farfisa / Vox Continental flavour): bright,
 * reedy divide-down tones, a formant "voice" filter and fast pitch vibrato.
 */
export class ComboOrgan implements Instrument {
  readonly output = new Tone.Gain(1);
  readonly mono = false;
  private input = new Tone.Gain(1);
  private wave: PeriodicWave;
  private nodes: Tone.ToneAudioNode[] = [];
  private voices: { osc: OscillatorNode; gain: GainNode }[] = [];

  constructor(readonly id: string, level: number) {
    this.output.gain.value = level;
    const ctx = Tone.getContext();
    // "Reed 8' + 4'" tabs: a pulse-like spectrum with strong odd harmonics plus the octave.
    const n = 24;
    const imag = new Float32Array(n + 1);
    for (let h = 1; h <= n; h++) {
      const odd = h % 2 === 1 ? 1 : 0.35;
      imag[h] = (odd / Math.pow(h, 0.85)) * (h === 2 ? 1.6 : 1);
    }
    this.wave = ctx.createPeriodicWave(new Float32Array(n + 1), imag);
    const formant = this.track(new Tone.Filter({ type: 'peaking', frequency: 1800, Q: 1.2, gain: 5 }));
    const tame = this.track(new Tone.Filter({ type: 'lowpass', frequency: 6500, Q: 0.6 }));
    const lowCut = this.track(new Tone.Filter({ type: 'highpass', frequency: 160, Q: 0.6 }));
    const vibrato = this.track(new Tone.Vibrato({ frequency: 6.6, depth: 0.09 }));
    const amp = this.track(new Tone.Distortion({ distortion: 0.12, wet: 0.35 }));
    this.input.chain(lowCut, formant, tame, vibrato, amp, this.output);
  }

  private track<T extends Tone.ToneAudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }

  notes(midis: number[], duration: number, velocity: number, time: number) {
    const ctx = Tone.getContext();
    const t = Math.max(time, ctx.currentTime);
    const end = t + Math.max(0.03, duration);
    const level = (0.1 / Math.sqrt(Math.max(1, midis.length))) * (0.85 + 0.15 * velocity);
    for (const m of midis) {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(this.wave);
      osc.frequency.value = midiToFreq(m);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(level, t + 0.003);
      gain.gain.setValueAtTime(level, end);
      gain.gain.linearRampToValueAtTime(0, end + 0.02);
      osc.connect(gain);
      Tone.connect(gain, this.input);
      osc.start(t);
      osc.stop(end + 0.06);
      const v = { osc, gain };
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
        this.voices = this.voices.filter((x) => x !== v);
      };
      this.voices.push(v);
    }
  }

  releaseAll(time?: number) {
    const t = time ?? Tone.now();
    for (const v of this.voices) {
      try {
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setTargetAtTime(0, t, 0.005);
        v.osc.stop(t + 0.05);
      } catch {
        /* already stopped */
      }
    }
    this.voices = [];
  }

  dispose() {
    this.releaseAll();
    for (const n of this.nodes) n.dispose();
    this.input.dispose();
    this.output.dispose();
  }
}
