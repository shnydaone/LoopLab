/**
 * Fully synthesised drum & percussion kits. Each voice is a small Tone.js
 * patch; kits differ in tuning, decay and level so reggae and ska feel apart
 * (high tight "timbale" snare and deep kick for roots, brighter punchier kit for ska).
 */
import * as Tone from 'tone';
import type { DrumVoice } from '@/music/types';
import type { Instrument } from './types';

export interface KitConfig {
  kick: { freq: number; decay: number; octaves: number; click: number };
  snare: { body: number; bodyDecay: number; noiseDecay: number; hp: number; noiseLevel: number };
  rim: { freq: number; decay: number };
  hat: { hp: number; closedDecay: number; openDecay: number };
  toms: [number, number, number];
  hand: { lo: number; hi: number };
  levels: Partial<Record<DrumVoice, number>>;
}

type Trigger = (vel: number, time: number) => void;

/** Synth stand-ins for voices that only exist in the sampled kits. */
const SYNTH_ALIAS: Partial<Record<DrumVoice, DrumVoice>> = {
  hatP: 'hatC',
  timbH: 'tomH',
  timbL: 'tomM',
  claves: 'rim',
  congaO: 'handHi',
  congaM: 'handHi',
  bongoL: 'handHi',
};

export class DrumKit implements Instrument {
  readonly output = new Tone.Gain(1);
  readonly mono = false;
  private voices = new Map<DrumVoice, Trigger>();
  private last = new Map<DrumVoice, number>();
  private nodes: Tone.ToneAudioNode[] = [];
  private openHat?: Tone.NoiseSynth;

  constructor(
    readonly id: string,
    cfg: KitConfig,
    level = 1,
  ) {
    this.output.gain.value = level;
    const L = (v: DrumVoice, def: number) => Tone.dbToGain(cfg.levels[v] ?? def);
    const bus = (v: DrumVoice, def: number) => this.track(new Tone.Gain(L(v, def)).connect(this.output));

    // Kick: pitched membrane + noise click
    {
      const out = bus('kick', 0);
      const body = this.track(
        new Tone.MembraneSynth({
          pitchDecay: 0.045,
          octaves: cfg.kick.octaves,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: cfg.kick.decay, sustain: 0, release: 0.05 },
        }).connect(out),
      );
      const clickF = this.track(new Tone.Filter(3200, 'bandpass').connect(out));
      const click = this.track(
        new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.0005, decay: 0.008, sustain: 0 } }).connect(clickF),
      );
      this.voices.set('kick', (v, t) => {
        body.triggerAttackRelease(cfg.kick.freq, cfg.kick.decay, t, v);
        click.triggerAttackRelease(0.01, t, v * cfg.kick.click);
      });
    }

    // Snare: tuned body + filtered noise
    {
      const out = bus('snare', -3);
      const body = this.track(
        new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.001, decay: cfg.snare.bodyDecay, sustain: 0, release: 0.02 },
        }).connect(out),
      );
      const hp = this.track(new Tone.Filter(cfg.snare.hp, 'highpass').connect(out));
      const noise = this.track(
        new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: cfg.snare.noiseDecay, sustain: 0 } }).connect(hp),
      );
      this.voices.set('snare', (v, t) => {
        body.triggerAttackRelease(cfg.snare.body, cfg.snare.bodyDecay, t, v * 0.9);
        noise.triggerAttackRelease(cfg.snare.noiseDecay, t, v * cfg.snare.noiseLevel);
      });
    }

    // Cross-stick / rimshot: woody click
    {
      const out = bus('rim', -6);
      const body = this.track(
        new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.0005, decay: cfg.rim.decay, sustain: 0, release: 0.01 },
        }).connect(out),
      );
      const bp = this.track(new Tone.Filter({ frequency: 2600, type: 'bandpass', Q: 2 }).connect(out));
      const noise = this.track(
        new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.0005, decay: 0.02, sustain: 0 } }).connect(bp),
      );
      this.voices.set('rim', (v, t) => {
        body.triggerAttackRelease(cfg.rim.freq, cfg.rim.decay, t, v);
        noise.triggerAttackRelease(0.02, t, v * 0.7);
      });
    }

    // Hi-hats with choke
    {
      const out = bus('hatC', -13);
      const hp = this.track(new Tone.Filter(cfg.hat.hp, 'highpass').connect(out));
      const peak = this.track(new Tone.Filter({ frequency: 10000, type: 'peaking', gain: 4 }).connect(hp));
      const closed = this.track(
        new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.0005, decay: cfg.hat.closedDecay, sustain: 0, release: 0.01 } }).connect(peak),
      );
      const outO = bus('hatO', -15);
      const hpO = this.track(new Tone.Filter(cfg.hat.hp - 800, 'highpass').connect(outO));
      const open = this.track(
        new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: cfg.hat.openDecay, sustain: 0, release: 0.04 } }).connect(hpO),
      );
      this.openHat = open;
      this.voices.set('hatC', (v, t) => {
        open.triggerRelease(t);
        closed.triggerAttackRelease(cfg.hat.closedDecay, t, v);
      });
      this.voices.set('hatO', (v, t) => open.triggerAttackRelease(cfg.hat.openDecay, t, v));
    }

    // Ride
    {
      const out = bus('ride', -24);
      const ride = this.track(
        new Tone.MetalSynth({
          harmonicity: 5.1,
          modulationIndex: 16,
          resonance: 5200,
          octaves: 1.1,
          envelope: { attack: 0.001, decay: 0.9, release: 0.3 },
        }).connect(out),
      );
      this.voices.set('ride', (v, t) => ride.triggerAttackRelease(320, 0.6, t, v));
    }

    // Toms
    const tomNames: DrumVoice[] = ['tomH', 'tomM', 'tomL'];
    tomNames.forEach((name, i) => {
      const out = bus(name, -5);
      const tom = this.track(
        new Tone.MembraneSynth({
          pitchDecay: 0.03,
          octaves: 1.8,
          envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.05 },
        }).connect(out),
      );
      this.voices.set(name, (v, t) => tom.triggerAttackRelease(cfg.toms[i], 0.3, t, v));
    });

    // Crash
    {
      const out = bus('crash', -16);
      const hp = this.track(new Tone.Filter(4500, 'highpass').connect(out));
      const crash = this.track(
        new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 1.8, sustain: 0, release: 0.3 } }).connect(hp),
      );
      this.voices.set('crash', (v, t) => crash.triggerAttackRelease(1.6, t, v));
    }

    // Clap: three quick bursts
    {
      const out = bus('clap', 0);
      const bp = this.track(new Tone.Filter({ frequency: 1300, type: 'bandpass', Q: 0.9 }).connect(out));
      const clap = this.track(
        new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.0005, decay: 0.09, sustain: 0 } }).connect(bp),
      );
      this.voices.set('clap', (v, t) => {
        clap.triggerAttackRelease(0.01, t, v * 0.7);
        clap.triggerAttackRelease(0.01, t + 0.011, v * 0.8);
        clap.triggerAttackRelease(0.09, t + 0.023, v);
      });
    }

    // Shaker
    {
      const out = bus('shaker', -5);
      const hp = this.track(new Tone.Filter(6000, 'highpass').connect(out));
      const sh = this.track(
        new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.006, decay: 0.05, sustain: 0 } }).connect(hp),
      );
      this.voices.set('shaker', (v, t) => sh.triggerAttackRelease(0.05, t, v));
    }

    // Tambourine
    {
      const out = bus('tamb', -8);
      const hp = this.track(new Tone.Filter(7500, 'highpass').connect(out));
      const tb = this.track(
        new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0 } }).connect(hp),
      );
      this.voices.set('tamb', (v, t) => {
        tb.triggerAttackRelease(0.01, t, v * 0.6);
        tb.triggerAttackRelease(0.14, t + 0.018, v);
      });
    }

    // Hand drums (nyabinghi funde / repeater, congas)
    {
      const outLo = bus('handLo', -2);
      const lo = this.track(
        new Tone.MembraneSynth({
          pitchDecay: 0.04,
          octaves: 2.2,
          envelope: { attack: 0.002, decay: 0.55, sustain: 0, release: 0.1 },
        }).connect(outLo),
      );
      const outHi = bus('handHi', -8);
      const hi = this.track(
        new Tone.MembraneSynth({
          pitchDecay: 0.015,
          octaves: 1.4,
          envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.05 },
        }).connect(outHi),
      );
      this.voices.set('handLo', (v, t) => lo.triggerAttackRelease(cfg.hand.lo, 0.4, t, v));
      this.voices.set('handHi', (v, t) => hi.triggerAttackRelease(cfg.hand.hi, 0.12, t, v));
    }

    // Cowbell: two detuned squares through a band-pass
    {
      const out = bus('cowbell', -18);
      const bp = this.track(new Tone.Filter({ frequency: 1100, type: 'bandpass', Q: 1.2 }).connect(out));
      const mk = () =>
        this.track(
          new Tone.Synth({
            oscillator: { type: 'square' },
            envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.05 },
          }).connect(bp),
        );
      const a = mk();
      const b = mk();
      this.voices.set('cowbell', (v, t) => {
        a.triggerAttackRelease(562, 0.2, t, v);
        b.triggerAttackRelease(845, 0.2, t, v);
      });
    }

    // Dub siren: rising/falling square sweep
    {
      const out = bus('siren', -16);
      const lp = this.track(new Tone.Filter(2400, 'lowpass').connect(out));
      const siren = this.track(
        new Tone.Synth({
          oscillator: { type: 'square' },
          envelope: { attack: 0.02, decay: 0.1, sustain: 0.9, release: 0.4 },
        }).connect(lp),
      );
      this.voices.set('siren', (v, t) => {
        siren.triggerAttack(380, t, v);
        siren.frequency.setValueAtTime(380, t);
        siren.frequency.exponentialRampToValueAtTime(1150, t + 0.55);
        siren.frequency.exponentialRampToValueAtTime(520, t + 1.1);
        siren.frequency.exponentialRampToValueAtTime(1300, t + 1.6);
        siren.triggerRelease(t + 1.7);
      });
    }
  }

  private track<T extends Tone.ToneAudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  hit(voice: DrumVoice, velocity: number, time: number) {
    const fn = this.voices.get(voice) ?? this.voices.get(SYNTH_ALIAS[voice] ?? voice);
    if (!fn) return;
    if (!this.voices.has(voice)) voice = SYNTH_ALIAS[voice] ?? voice;
    // Monophonic voices must not be retriggered at the exact same instant.
    const prev = this.last.get(voice) ?? -1;
    const t = time <= prev ? prev + 0.002 : time;
    this.last.set(voice, t);
    try {
      fn(Math.max(0.01, Math.min(1, velocity)), t);
    } catch (err) {
      console.warn('[drums] trigger failed', voice, err);
    }
  }

  releaseAll(time?: number) {
    this.openHat?.triggerRelease(time);
  }

  dispose() {
    for (const n of this.nodes) n.dispose();
    this.output.dispose();
  }
}

export const KITS: Record<string, KitConfig> = {
  'kit-roots': {
    kick: { freq: 47, decay: 0.55, octaves: 5, click: 0.25 },
    snare: { body: 330, bodyDecay: 0.07, noiseDecay: 0.11, hp: 2600, noiseLevel: 0.75 },
    rim: { freq: 760, decay: 0.05 },
    hat: { hp: 7800, closedDecay: 0.04, openDecay: 0.32 },
    toms: [240, 185, 140],
    hand: { lo: 62, hi: 240 },
    levels: { kick: 0, rim: -4, snare: -4, hatC: -14 },
  },
  'kit-twotone': {
    kick: { freq: 56, decay: 0.32, octaves: 6, click: 0.55 },
    snare: { body: 205, bodyDecay: 0.09, noiseDecay: 0.18, hp: 1600, noiseLevel: 1 },
    rim: { freq: 900, decay: 0.04 },
    hat: { hp: 7000, closedDecay: 0.05, openDecay: 0.26 },
    toms: [200, 150, 110],
    hand: { lo: 90, hi: 300 },
    levels: { kick: -1, snare: -2, hatC: -12, hatO: -14 },
  },
  'perc-roots': {
    kick: { freq: 50, decay: 0.4, octaves: 4, click: 0.1 },
    snare: { body: 300, bodyDecay: 0.06, noiseDecay: 0.1, hp: 2500, noiseLevel: 0.6 },
    rim: { freq: 800, decay: 0.04 },
    hat: { hp: 7800, closedDecay: 0.04, openDecay: 0.3 },
    toms: [240, 185, 140],
    hand: { lo: 58, hi: 230 },
    levels: { handLo: -6, handHi: -10 },
  },
  'perc-ska': {
    kick: { freq: 55, decay: 0.3, octaves: 5, click: 0.3 },
    snare: { body: 210, bodyDecay: 0.08, noiseDecay: 0.15, hp: 1800, noiseLevel: 1 },
    rim: { freq: 900, decay: 0.04 },
    hat: { hp: 7000, closedDecay: 0.05, openDecay: 0.25 },
    toms: [200, 150, 110],
    hand: { lo: 95, hi: 320 },
    levels: {},
  },
};
