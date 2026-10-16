/**
 * Sample-playback bass guitar. Notes play real recordings of a bassist:
 *   pitch → nearest recorded note (retuned a semitone or so)
 *   velocity → soft / medium / hard recording, round-robin takes
 * It behaves like one player on one instrument: a new note mutes the
 * previous one (as fingers do), and note ends get a short, natural release.
 * Very short notes use dedicated staccato recordings when the library has them.
 */
import * as Tone from 'tone';
import { loadAll, loadManifest, type BassZone } from '../samples/loader';
import { nearestZone, pickLayer, RoundRobin, semitonesToRate, velocityGain } from '../samples/select';
import type { Instrument } from './types';

export interface BassSampleDef {
  set: string;
  /** Target loudness (dBFS, average) for the middle layer; evens out the range. */
  levelDb: number;
  /** Release time constant in seconds when a note ends. */
  release: number;
  /** Notes shorter than this (seconds) use staccato samples if available. */
  staccatoBelow?: number;
  /** Tone shaping chain after the sampler (EQ / compression). */
  chain: () => Tone.ToneAudioNode[];
}

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

export class SampledBass implements Instrument {
  readonly output = new Tone.Gain(1);
  readonly mono = true;
  private input = new Tone.Gain(1);
  private chainNodes: Tone.ToneAudioNode[] = [];
  private zones: (BassZone & { norm: number })[] = [];
  private staccato: (BassZone & { norm: number })[] = [];
  private buffers = new Map<string, AudioBuffer>();
  private ready = false;
  private rr = new RoundRobin();
  private current: Voice | null = null;
  private lastStart = -1;
  private disposed = false;

  constructor(
    readonly id: string,
    private def: BassSampleDef,
    private fallback: Instrument | null,
  ) {
    this.chainNodes = def.chain();
    if (this.chainNodes.length) this.input.chain(...this.chainNodes, this.output);
    else this.input.connect(this.output);
    if (fallback) fallback.output.connect(this.output);
    void this.load();
  }

  private async load() {
    const manifest = await loadManifest();
    const inst = manifest?.instruments[this.def.set];
    if (!inst?.zones || this.disposed) return;
    const norm = (z: BassZone) => {
      const mid = z.layers[Math.floor(z.layers.length / 2)] ?? z.layers[0];
      return { ...z, norm: Tone.dbToGain(this.def.levelDb - mid.mean) };
    };
    this.zones = inst.zones.map(norm);
    this.staccato = (inst.staccato ?? []).map(norm);
    const files = [...this.zones, ...this.staccato].flatMap((z) => z.layers.flatMap((l) => l.files));
    const bufs = await loadAll(files);
    if (this.disposed) return;
    this.buffers = bufs;
    this.ready = true;
  }

  notes(midis: number[], duration: number, velocity: number, time: number) {
    const midi = midis[0];
    if (midi === undefined) return;
    if (!this.ready) {
      this.fallback?.notes?.(midis, duration, velocity, time);
      return;
    }
    const useStaccato = this.staccato.length > 0 && duration < (this.def.staccatoBelow ?? 0);
    const zone = nearestZone(useStaccato ? this.staccato : this.zones, midi);
    if (!zone) return;
    const layer = zone.layers[pickLayer(velocity, zone.layers.length)];
    const file = layer.files[this.rr.next(`${zone.midi}:${layer.files[0]}`, layer.files.length)];
    const buf = this.buffers.get(file);
    if (!buf) {
      this.fallback?.notes?.(midis, duration, velocity, time);
      return;
    }

    const ctx = Tone.getContext();
    const t = Math.max(time, ctx.currentTime, this.lastStart + 0.002);
    this.lastStart = t;

    // One string, one player: the new note mutes the old one.
    if (this.current) {
      const prev = this.current;
      try {
        prev.gain.gain.cancelScheduledValues(t);
        prev.gain.gain.setTargetAtTime(0, t, 0.006);
        prev.src.stop(t + 0.06);
      } catch {
        /* already stopped */
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = semitonesToRate(midi - zone.midi - zone.cents / 100);
    const gain = ctx.createGain();
    const level = zone.norm * velocityGain(velocity);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.002);
    const end = t + Math.max(0.05, duration);
    gain.gain.setValueAtTime(level, end);
    gain.gain.setTargetAtTime(0, end, this.def.release / 3);
    src.connect(gain);
    Tone.connect(gain, this.input);
    src.start(t);
    src.stop(Math.min(t + buf.duration / src.playbackRate.value, end + this.def.release + 0.1));
    const voice: Voice = { src, gain };
    this.current = voice;
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
      if (this.current === voice) this.current = null;
    };
  }

  releaseAll(time?: number) {
    const t = time ?? Tone.now();
    if (this.current) {
      try {
        this.current.gain.gain.cancelScheduledValues(t);
        this.current.gain.gain.setTargetAtTime(0, t, 0.02);
        this.current.src.stop(t + 0.15);
      } catch {
        /* already stopped */
      }
    }
    this.fallback?.releaseAll(time);
  }

  dispose() {
    this.disposed = true;
    this.fallback?.dispose();
    for (const n of this.chainNodes) n.dispose();
    this.input.dispose();
    this.output.dispose();
  }
}
