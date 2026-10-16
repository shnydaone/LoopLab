/**
 * Electronic synthesiser presets (bass, pads, keys, leads). Each is a
 * purpose-built patch: oscillator choice, filter + resonance, envelopes,
 * glide, saturation, modulation and effects tuned to the role it plays.
 */
import * as Tone from 'tone';
import { TonewheelOrgan } from './organ';
import { BassInst, PolyInst } from './pitched';
import type { Instrument } from './types';

const db = Tone.dbToGain;

export function createElectroSynth(id: string): Instrument | null {
  switch (id) {
    // ───────── bass ─────────
    case 'sub-bass':
      // Jungle sub: near-pure sine with glide; a little drive adds harmonics small speakers can reproduce.
      return new BassInst(
        id,
        db(-9),
        {
          oscillator: { type: 'sine' },
          filter: { type: 'lowpass', Q: 0.5, rolloff: -12 },
          filterEnvelope: { attack: 0.001, decay: 0.1, sustain: 1, release: 0.1, baseFrequency: 420, octaves: 0.4 },
          envelope: { attack: 0.006, decay: 0.2, sustain: 0.95, release: 0.12 },
          portamento: 0.035,
        },
        0,
        0.12,
      );
    case 'reese-bass':
      // Two detuned saws beating against each other, slow filter swell, sub underneath.
      return new BassInst(
        id,
        db(-11),
        {
          oscillator: { type: 'fatsawtooth', count: 2, spread: 28 },
          filter: { type: 'lowpass', Q: 1.8, rolloff: -24 },
          filterEnvelope: { attack: 0.09, decay: 0.7, sustain: 0.55, release: 0.3, baseFrequency: 170, octaves: 1.7 },
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.9, release: 0.2 },
          portamento: 0.02,
        },
        0.55,
        0.35,
        [new Tone.Chorus({ frequency: 0.25, delayTime: 4, depth: 0.4, wet: 0.35 }).start()],
      );
    case 'house-bass':
      // Plucky pulse-wave bass with a snappy, resonant filter envelope.
      return new BassInst(
        id,
        db(-9),
        {
          oscillator: { type: 'pwm', modulationFrequency: 0.4 },
          filter: { type: 'lowpass', Q: 3.5, rolloff: -24 },
          filterEnvelope: { attack: 0.002, decay: 0.16, sustain: 0.15, release: 0.1, baseFrequency: 140, octaves: 3.6 },
          envelope: { attack: 0.003, decay: 0.25, sustain: 0.5, release: 0.08 },
        },
        0.3,
        0.2,
      );
    case 'organ-bass':
      // The classic early-90s house organ bass: round, percussive, a hint of second harmonic.
      return new BassInst(
        id,
        db(-5),
        {
          oscillator: { type: 'custom', partials: [1, 0.55, 0.3, 0.12] },
          filter: { type: 'lowpass', Q: 0.6, rolloff: -12 },
          filterEnvelope: { attack: 0.002, decay: 0.2, sustain: 0.5, release: 0.1, baseFrequency: 500, octaves: 1.5 },
          envelope: { attack: 0.003, decay: 0.35, sustain: 0.25, release: 0.08 },
        },
        0.2,
        0.1,
      );
    case 'trip-bass':
      // Warm, Moog-like saw bass with glide and a slow filter.
      return new BassInst(
        id,
        db(-9),
        {
          oscillator: { type: 'sawtooth' },
          filter: { type: 'lowpass', Q: 1.4, rolloff: -24 },
          filterEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.35, release: 0.3, baseFrequency: 110, octaves: 2.2 },
          envelope: { attack: 0.01, decay: 0.4, sustain: 0.8, release: 0.25 },
          portamento: 0.06,
        },
        0.4,
        0.2,
      );

    // ───────── keys / pads ─────────
    case 'house-piano':
      // Bright FM piano for stabs: a hard, metallic attack that settles quickly.
      return new PolyInst(
        id,
        db(-3),
        () =>
          new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 1,
            modulationIndex: 11,
            oscillator: { type: 'sine' },
            modulation: { type: 'sine' },
            envelope: { attack: 0.002, decay: 1.4, sustain: 0.18, release: 0.4 },
            modulationEnvelope: { attack: 0.002, decay: 0.22, sustain: 0.04, release: 0.3 },
          }),
        [
          new Tone.Filter({ type: 'highpass', frequency: 170, Q: 0.6 }),
          new Tone.Filter({ type: 'peaking', frequency: 2600, Q: 0.9, gain: 3 }),
          new Tone.Chorus({ frequency: 0.9, delayTime: 2.2, depth: 0.25, wet: 0.25 }).start(),
          new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.003, release: 0.12 }),
        ],
        { strum: 0.003 },
      );
    case 'house-organ':
      // Percussive "stab" organ: full drawbars, 2nd-harmonic percussion, no Leslie, driven.
      return new TonewheelOrgan(id, {
        registration: '888 000 000',
        percussion: 2,
        percDecay: 0.15,
        percLevel: 0.8,
        click: 0.6,
        leslie: 'off',
        drive: 0.22,
        level: 2.5,
      });
    case 'trip-organ':
      // Dark, smoky organ: low drawbars, no percussion, slow Leslie.
      return new TonewheelOrgan(id, {
        registration: '86 5300 000',
        percussion: 0,
        percDecay: 0.2,
        percLevel: 0,
        click: 0.2,
        leslie: 'slow',
        drive: 0.2,
        level: 4.5,
      });
    case 'trip-ep':
      // Moody electric piano: soft FM tines, deep stereo tremolo, a little tape drive, dark top.
      return new PolyInst(
        id,
        db(-2),
        () =>
          new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 1,
            modulationIndex: 4,
            oscillator: { type: 'sine' },
            modulation: { type: 'sine' },
            envelope: { attack: 0.003, decay: 2.6, sustain: 0.3, release: 1.1 },
            modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0.1, release: 0.6 },
          }),
        [
          new Tone.Tremolo({ frequency: 3.2, depth: 0.38, spread: 160 }).start(),
          new Tone.Filter({ type: 'lowpass', frequency: 3600, Q: 0.5 }),
          new Tone.Distortion({ distortion: 0.15, wet: 0.3 }),
          new Tone.Chorus({ frequency: 0.7, delayTime: 3, depth: 0.35, wet: 0.3 }).start(),
        ],
      );
    case 'atmos-pad':
      // Wide supersaw atmosphere: slow attack, long release, dark filter, chorus.
      return new PolyInst(
        id,
        db(-15),
        () =>
          new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'fatsawtooth', count: 3, spread: 32 },
            envelope: { attack: 1.4, decay: 1, sustain: 0.8, release: 2.8 },
          }),
        [
          new Tone.Filter({ type: 'lowpass', frequency: 2200, Q: 0.7 }),
          new Tone.Chorus({ frequency: 0.5, delayTime: 3.5, depth: 0.7, wet: 0.5 }).start(),
        ],
        { minDur: 0.3 },
      );
    case 'string-pad':
      // Synth strings: brighter, faster bow, gentle vibrato.
      return new PolyInst(
        id,
        db(-14),
        () =>
          new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
            envelope: { attack: 0.45, decay: 0.5, sustain: 0.85, release: 1.6 },
          }),
        [
          new Tone.Filter({ type: 'highpass', frequency: 200, Q: 0.5 }),
          new Tone.Filter({ type: 'lowpass', frequency: 4200, Q: 0.6 }),
          new Tone.Vibrato({ frequency: 5, depth: 0.04 }),
          new Tone.Chorus({ frequency: 1.1, delayTime: 2.5, depth: 0.5, wet: 0.45 }).start(),
        ],
        { minDur: 0.25 },
      );

    // ───────── leads ─────────
    case 'theremin-lead':
      // Eerie sine with slow glide and wide vibrato.
      return new BassInst(
        id,
        db(-9),
        {
          oscillator: { type: 'sine' },
          filter: { type: 'lowpass', Q: 0.5, rolloff: -12 },
          filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 1, release: 0.3, baseFrequency: 3000, octaves: 0 },
          envelope: { attack: 0.09, decay: 0.2, sustain: 0.9, release: 0.6 },
          portamento: 0.12,
        },
        0,
        0,
        [new Tone.Vibrato({ frequency: 5.3, depth: 0.16 })],
      );
    case 'mono-lead':
      // Classic mono synth lead: detuned saws, plucky filter, short glide.
      return new BassInst(
        id,
        db(-9),
        {
          oscillator: { type: 'fatsawtooth', count: 2, spread: 12 },
          filter: { type: 'lowpass', Q: 2, rolloff: -24 },
          filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.15, baseFrequency: 600, octaves: 2.5 },
          envelope: { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.15 },
          portamento: 0.02,
        },
        0,
        0.15,
        [new Tone.Chorus({ frequency: 1.4, delayTime: 2, depth: 0.3, wet: 0.3 }).start()],
      );
    default:
      return null;
  }
}
