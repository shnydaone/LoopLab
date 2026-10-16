/**
 * Drum-machine kit modelled on how classic analog machines make sound:
 *   kick   – sine oscillator with a fast pitch drop (909 punch / long 808 boom) + click
 *   snare  – two tuned triangle "drum heads" + high-passed noise "snares"
 *   clap   – several noise bursts a few ms apart through a band-pass, then a tail
 *   hats   – six square oscillators at the 808's inharmonic frequencies, band-passed
 *            (closed and open share one VCA, so a closed hat chokes the open one)
 *   ride / crash, toms, congas, cowbell, claves, rimshot, shaker, tambourine
 * plus electronic FX voices: riser, downlifter, impact, reverse cymbal,
 * vinyl crackle, laser zap and siren. Every hit builds a few Web Audio nodes
 * scheduled sample-accurately at the given time.
 */
import * as Tone from 'tone';
import type { DrumVoice } from '@/music/types';
import type { Instrument } from './types';

export interface ElectroConfig {
  kick: { start: number; end: number; pitchTime: number; decay: number; click: number; level: number };
  snare: { tone: [number, number]; toneDecay: number; noiseDecay: number; noiseHp: number; noise: number; level: number };
  clap: { bp: number; decay: number; level: number };
  hat: { tune: number; closed: number; open: number; level: number };
  cymbal: { ride: number; crash: number; level: number };
  toms: [number, number, number];
  tomDecay: number;
  congas: [number, number, number];
  /** Kit-bus saturation 0..1 (tape/console drive). */
  drive: number;
  /** Output level trims in dB. */
  levels?: Partial<Record<DrumVoice, number>>;
}

const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

let noiseBuf: AudioBuffer | null = null;
let crackleBuf: AudioBuffer | null = null;

function noise(): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const ctx = Tone.getContext();
  const len = ctx.sampleRate * 2;
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = b;
  return b;
}

/** Two seconds of vinyl: soft rumble/hiss plus random clicks and pops. */
function crackle(): AudioBuffer {
  if (crackleBuf) return crackleBuf;
  const ctx = Tone.getContext();
  const sr = ctx.sampleRate;
  const len = sr * 2;
  const b = ctx.createBuffer(1, len, sr);
  const d = b.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    lp = lp * 0.97 + (Math.random() * 2 - 1) * 0.03;
    d[i] = lp * 0.6 + (Math.random() * 2 - 1) * 0.012;
  }
  const pops = 70;
  for (let p = 0; p < pops; p++) {
    const at = Math.floor(Math.random() * (len - 200));
    const amp = (Math.random() < 0.15 ? 0.9 : 0.35) * (Math.random() < 0.5 ? -1 : 1);
    const w = 8 + Math.floor(Math.random() * 40);
    for (let k = 0; k < w; k++) d[at + k] += amp * Math.exp(-k / (w / 4)) * (k % 2 ? -0.6 : 1);
  }
  crackleBuf = b;
  return b;
}

export class ElectroKit implements Instrument {
  readonly output = new Tone.Gain(1);
  readonly mono = false;
  private bus = new Tone.Gain(1);
  private nodes: Tone.ToneAudioNode[] = [];
  private metalOscs: OscillatorNode[] = [];
  private hatVca: GainNode;
  private cymVca: GainNode;
  private live: { src: AudioScheduledSourceNode; gain: GainNode }[] = [];

  constructor(
    readonly id: string,
    private cfg: ElectroConfig,
  ) {
    const drive = this.track(new Tone.Distortion({ distortion: 0.35, wet: cfg.drive, oversample: '2x' }));
    const glue = this.track(new Tone.Compressor({ threshold: -14, ratio: 2.5, attack: 0.004, release: 0.09, knee: 6 }));
    this.bus.chain(drive, glue, this.output);

    // Persistent 808-style metal bank feeding the hat and cymbal VCAs.
    const ctx = Tone.getContext();
    const metalSum = ctx.createGain();
    metalSum.gain.value = 0.16;
    for (const f of METAL) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f * cfg.hat.tune;
      o.connect(metalSum);
      o.start();
      this.metalOscs.push(o);
    }
    const hatBp = ctx.createBiquadFilter();
    hatBp.type = 'bandpass';
    hatBp.frequency.value = 10000;
    hatBp.Q.value = 0.9;
    const hatHp = ctx.createBiquadFilter();
    hatHp.type = 'highpass';
    hatHp.frequency.value = 7000;
    this.hatVca = ctx.createGain();
    this.hatVca.gain.value = 0;
    metalSum.connect(hatBp);
    hatBp.connect(hatHp);
    hatHp.connect(this.hatVca);
    Tone.connect(this.hatVca, this.bus);

    const cymBp = ctx.createBiquadFilter();
    cymBp.type = 'bandpass';
    cymBp.frequency.value = 5200;
    cymBp.Q.value = 0.6;
    this.cymVca = ctx.createGain();
    this.cymVca.gain.value = 0;
    metalSum.connect(cymBp);
    cymBp.connect(this.cymVca);
    Tone.connect(this.cymVca, this.bus);
  }

  private track<T extends Tone.ToneAudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }

  private lvl(v: DrumVoice, def = 0) {
    return Tone.dbToGain(this.cfg.levels?.[v] ?? def);
  }

  /** A gain node wired to the kit bus that cleans itself up. */
  private vca(src: AudioScheduledSourceNode, chainTo?: AudioNode): GainNode {
    const ctx = Tone.getContext();
    const g = ctx.createGain();
    if (chainTo) {
      src.connect(chainTo);
      chainTo.connect(g);
    } else {
      src.connect(g);
    }
    Tone.connect(g, this.bus);
    const entry = { src, gain: g };
    this.live.push(entry);
    src.onended = () => {
      src.disconnect();
      chainTo?.disconnect();
      g.disconnect();
      this.live = this.live.filter((x) => x !== entry);
    };
    return g;
  }

  private osc(type: OscillatorType, f0: number, t: number, len: number, f1?: number, pitchTime = 0.05, filter?: BiquadFilterNode) {
    const ctx = Tone.getContext();
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + pitchTime);
    const g = this.vca(o, filter);
    o.start(t);
    o.stop(t + len);
    return g;
  }

  private noiseHit(t: number, len: number, filterType: BiquadFilterType, freq: number, q = 0.7) {
    const ctx = Tone.getContext();
    const s = ctx.createBufferSource();
    s.buffer = noise();
    s.loop = true;
    s.loopStart = Math.random();
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.vca(s, f);
    s.start(t, Math.random() * 1.5);
    s.stop(t + len);
    return { g, f };
  }

  private decay(g: GainNode, t: number, peak: number, decay: number, attack = 0.001) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + attack, decay / 4);
  }

  private bpm() {
    return Tone.getTransport().bpm.value;
  }

  hit(voice: DrumVoice, velocity: number, time: number) {
    const ctx = Tone.getContext();
    const t = Math.max(time, ctx.currentTime);
    const v = Math.max(0.02, Math.min(1, velocity));
    const c = this.cfg;
    const vel = 0.35 + 0.65 * v;
    switch (voice) {
      case 'kick': {
        const g = this.osc('sine', c.kick.start, t, c.kick.decay + 0.1, c.kick.end, c.kick.pitchTime);
        this.decay(g, t, c.kick.level * vel * this.lvl('kick'), c.kick.decay);
        const h = this.osc('sine', c.kick.start * 2.2, t, 0.03, c.kick.end * 2, 0.012);
        this.decay(h, t, 0.25 * vel, 0.02);
        if (c.kick.click > 0) {
          const { g: cg } = this.noiseHit(t, 0.012, 'highpass', 1200);
          this.decay(cg, t, c.kick.click * vel, 0.006);
        }
        break;
      }
      case 'snare': {
        const [a, b] = c.snare.tone;
        const l = c.snare.level * vel * this.lvl('snare');
        this.decay(this.osc('triangle', a * 1.1, t, c.snare.toneDecay + 0.05, a, 0.02), t, l * 0.8, c.snare.toneDecay);
        this.decay(this.osc('triangle', b * 1.1, t, c.snare.toneDecay + 0.05, b, 0.02), t, l * 0.45, c.snare.toneDecay * 0.8);
        const { g } = this.noiseHit(t, c.snare.noiseDecay + 0.05, 'highpass', c.snare.noiseHp);
        this.decay(g, t, l * c.snare.noise, c.snare.noiseDecay);
        break;
      }
      case 'clap': {
        const l = c.clap.level * vel * this.lvl('clap');
        for (const [dt, peak, dec] of [
          [0, 0.7, 0.008],
          [0.011, 0.8, 0.008],
          [0.022, 0.9, 0.009],
          [0.033, 1, c.clap.decay],
        ] as const) {
          const { g } = this.noiseHit(t + dt, dec + 0.05, 'bandpass', c.clap.bp, 1.3);
          this.decay(g, t + dt, l * peak, dec);
        }
        break;
      }
      case 'rim': {
        const l = 0.45 * vel * this.lvl('rim');
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 500;
        this.decay(this.osc('triangle', 1700, t, 0.05, undefined, 0.05, hp), t, l, 0.025);
        this.decay(this.osc('square', 460, t, 0.04), t, l * 0.35, 0.02);
        break;
      }
      case 'hatC':
      case 'hatP':
      case 'hatO': {
        const open = voice === 'hatO';
        const l = c.hat.level * vel * this.lvl(voice) * (voice === 'hatP' ? 0.6 : 1);
        const g = this.hatVca.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value > 0.0001 ? g.value : 0, t);
        g.linearRampToValueAtTime(l, t + 0.0008);
        g.setTargetAtTime(0, t + 0.001, (open ? c.hat.open : c.hat.closed) / 4);
        break;
      }
      case 'ride':
      case 'crash': {
        const crash = voice === 'crash';
        const l = c.cymbal.level * vel * this.lvl(voice);
        const g = this.cymVca.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(l, t + 0.001);
        g.setTargetAtTime(0, t + 0.002, (crash ? c.cymbal.crash : c.cymbal.ride) / 4);
        if (crash) {
          const { g: ng } = this.noiseHit(t, c.cymbal.crash + 0.2, 'highpass', 5500);
          this.decay(ng, t, l * 0.7, c.cymbal.crash);
        }
        break;
      }
      case 'tomH':
      case 'tomM':
      case 'tomL':
      case 'timbH':
      case 'timbL': {
        const i = voice === 'tomH' || voice === 'timbH' ? 0 : voice === 'tomM' || voice === 'timbL' ? 1 : 2;
        const f = c.toms[i] * (voice.startsWith('timb') ? 1.6 : 1);
        this.decay(this.osc('sine', f * 1.5, t, c.tomDecay + 0.1, f, 0.05), t, 0.7 * vel * this.lvl(voice), c.tomDecay);
        break;
      }
      case 'congaO':
      case 'congaM':
      case 'handHi':
      case 'handLo':
      case 'bongoL': {
        const i = voice === 'congaO' || voice === 'handHi' ? 0 : voice === 'congaM' || voice === 'bongoL' ? 1 : 2;
        const f = c.congas[i];
        this.decay(this.osc('sine', f * 1.08, t, 0.3, f, 0.02), t, 0.6 * vel * this.lvl(voice, -2), 0.17);
        break;
      }
      case 'cowbell': {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2640;
        bp.Q.value = 1.1;
        const l = 0.35 * vel * this.lvl('cowbell', -4);
        this.decay(this.osc('square', 540, t, 0.4, undefined, 0.05, bp), t, l, 0.32);
        this.decay(this.osc('square', 800, t, 0.4), t, l * 0.5, 0.28);
        break;
      }
      case 'claves': {
        this.decay(this.osc('sine', 2500, t, 0.06), t, 0.45 * vel * this.lvl('claves', -3), 0.03);
        break;
      }
      case 'shaker': {
        const { g } = this.noiseHit(t, 0.1, 'highpass', 6500);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.32 * vel * this.lvl('shaker', -4), t + 0.006);
        g.gain.setTargetAtTime(0, t + 0.008, 0.014);
        break;
      }
      case 'tamb': {
        for (const dt of [0, 0.017]) {
          const { g } = this.noiseHit(t + dt, 0.18, 'highpass', 7800);
          this.decay(g, t + dt, 0.35 * vel * this.lvl('tamb', -4) * (dt ? 1 : 0.6), 0.12);
        }
        break;
      }
      // ───── electronic FX ─────
      case 'riser': {
        this.riser(t, (60 / this.bpm()) * 8, vel); // two bars
        break;
      }
      case 'downer': {
        const len = (60 / this.bpm()) * 4;
        const { g, f } = this.noiseHit(t, len + 0.05, 'bandpass', 7000, 1.8);
        f.frequency.setValueAtTime(7000, t);
        f.frequency.exponentialRampToValueAtTime(180, t + len);
        g.gain.setValueAtTime(0.45 * vel * this.lvl('downer', -3), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        break;
      }
      case 'impact': {
        const g = this.osc('sine', 90, t, 2, 32, 0.35);
        this.decay(g, t, 0.9 * vel * this.lvl('impact', -2), 1.6);
        const { g: ng } = this.noiseHit(t, 0.6, 'lowpass', 900);
        this.decay(ng, t, 0.5 * vel, 0.4);
        break;
      }
      case 'revcrash': {
        const len = 60 / this.bpm(); // one beat, swelling into the next downbeat
        const { g } = this.noiseHit(t, len + 0.02, 'highpass', 4200);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.45 * vel * this.lvl('revcrash', -3), t + len);
        g.gain.linearRampToValueAtTime(0, t + len + 0.015);
        break;
      }
      case 'crackle': {
        const len = (60 / this.bpm()) * 4;
        const s = ctx.createBufferSource();
        s.buffer = crackle();
        s.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 2600;
        f.Q.value = 0.5;
        const g = this.vca(s, f);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.5 * vel * this.lvl('crackle', -6), t + 0.02);
        g.gain.setValueAtTime(0.5 * vel * this.lvl('crackle', -6), t + len - 0.02);
        g.gain.linearRampToValueAtTime(0, t + len);
        s.start(t, Math.random() * 1.8);
        s.stop(t + len + 0.01);
        break;
      }
      case 'zap': {
        const g = this.osc('square', 2400, t, 0.2, 90, 0.13);
        this.decay(g, t, 0.18 * vel * this.lvl('zap', -4), 0.14);
        break;
      }
      case 'siren': {
        const o = ctx.createOscillator();
        o.type = 'square';
        const g = this.vca(o);
        o.start(t);
        o.stop(t + 1.8);
        o.frequency.setValueAtTime(380, t);
        o.frequency.exponentialRampToValueAtTime(1150, t + 0.55);
        o.frequency.exponentialRampToValueAtTime(520, t + 1.1);
        o.frequency.exponentialRampToValueAtTime(1300, t + 1.6);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.12 * vel, t + 0.03);
        g.gain.setValueAtTime(0.12 * vel, t + 1.6);
        g.gain.linearRampToValueAtTime(0, t + 1.78);
        break;
      }
      default:
        break;
    }
  }

  /** White-noise sweep plus a rising saw, `len` seconds long, peaking at the end. */
  riser(t: number, len: number, vel: number) {
    const { g, f } = this.noiseHit(t, len + 0.05, 'bandpass', 300, 2.2);
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(9000, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * vel * this.lvl('riser', -3), t + len);
    g.gain.linearRampToValueAtTime(0, t + len + 0.03);
    const tone = this.osc('sawtooth', 110, t, len + 0.05, 880, len);
    tone.gain.setValueAtTime(0.0001, t);
    tone.gain.exponentialRampToValueAtTime(0.06 * vel, t + len);
    tone.gain.linearRampToValueAtTime(0, t + len + 0.03);
  }

  releaseAll(time?: number) {
    const t = time ?? Tone.now();
    for (const { src, gain } of this.live) {
      try {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setTargetAtTime(0, t, 0.02);
        src.stop(t + 0.15);
      } catch {
        /* already stopped */
      }
    }
    this.hatVca.gain.cancelScheduledValues(t);
    this.hatVca.gain.setTargetAtTime(0, t, 0.02);
    this.cymVca.gain.cancelScheduledValues(t);
    this.cymVca.gain.setTargetAtTime(0, t, 0.05);
  }

  dispose() {
    this.releaseAll();
    for (const o of this.metalOscs) {
      try {
        o.stop();
      } catch {
        /* never started */
      }
      o.disconnect();
    }
    this.hatVca.disconnect();
    this.cymVca.disconnect();
    for (const n of this.nodes) n.dispose();
    this.bus.dispose();
    this.output.dispose();
  }
}

export const ELECTRO_KITS: Record<string, ElectroConfig> = {
  // Punchy 909-style: short pitch drop, crisp noise snare, bright hats.
  'dm-909': {
    kick: { start: 210, end: 50, pitchTime: 0.035, decay: 0.42, click: 0.35, level: 1 },
    snare: { tone: [185, 330], toneDecay: 0.09, noiseDecay: 0.17, noiseHp: 1500, noise: 0.8, level: 0.75 },
    clap: { bp: 1150, decay: 0.16, level: 0.85 },
    hat: { tune: 1.1, closed: 0.055, open: 0.36, level: 0.55 },
    cymbal: { ride: 1.1, crash: 1.7, level: 0.35 },
    toms: [220, 165, 120],
    tomDecay: 0.32,
    congas: [330, 245, 180],
    drive: 0.22,
    levels: { kick: 0, clap: -1, hatC: -2, hatO: -3 },
  },
  // Deep 808-style: long boom, softer snare, dark hats; for trip-hop and electro.
  'dm-808': {
    kick: { start: 130, end: 46, pitchTime: 0.05, decay: 1.05, click: 0.12, level: 1 },
    snare: { tone: [170, 260], toneDecay: 0.11, noiseDecay: 0.2, noiseHp: 1100, noise: 0.65, level: 0.75 },
    clap: { bp: 1000, decay: 0.22, level: 0.8 },
    hat: { tune: 0.95, closed: 0.05, open: 0.42, level: 0.45 },
    cymbal: { ride: 1.3, crash: 2, level: 0.3 },
    toms: [180, 135, 100],
    tomDecay: 0.45,
    congas: [310, 230, 165],
    drive: 0.15,
    levels: { hatC: -3, hatO: -4 },
  },
  // Percussion + FX box (house percussion, risers, impacts, crackle).
  'perc-fx': {
    kick: { start: 180, end: 50, pitchTime: 0.03, decay: 0.3, click: 0.2, level: 0.8 },
    snare: { tone: [190, 340], toneDecay: 0.08, noiseDecay: 0.15, noiseHp: 1700, noise: 0.8, level: 0.6 },
    clap: { bp: 1200, decay: 0.15, level: 0.8 },
    hat: { tune: 1.15, closed: 0.05, open: 0.3, level: 0.45 },
    cymbal: { ride: 1, crash: 1.6, level: 0.3 },
    toms: [230, 170, 125],
    tomDecay: 0.3,
    congas: [340, 255, 185],
    drive: 0.1,
  },
};
