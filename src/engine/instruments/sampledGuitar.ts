/**
 * Sample-playback electric guitar for skanks and chops.
 *
 * Chords are built from real recorded single notes, strummed string by
 * string (low→high for down-strokes, high→low for up-strokes) a few
 * milliseconds apart. A skank's "chk" comes from what the player does next:
 * the fretting hand releases pressure and the strings are damped, so at the
 * end of every chord we play the library's real string-mute recording. For
 * muted chops the notes barely sound and the muted-strum noise dominates.
 */
import * as Tone from 'tone';
import { loadAll, loadManifest, type BassZone, type SampleLayer } from '../samples/loader';
import { nearestZone, pickLayer, RoundRobin, semitonesToRate, velocityGain } from '../samples/select';
import type { Instrument } from './types';

export interface GuitarSampleDef {
  /** Seconds between strings in a strum. */
  strum: number;
  up: boolean;
  /** Left-hand muted chops: notes cut almost instantly. */
  muted: boolean;
  /** Longest a chord note rings before the hand damps it (seconds). */
  maxRing: number;
  levelDb: number;
  releaseGain: number;
  /** Muted-strum noise level mixed with each chord (0 = none). */
  scratch: number;
  chain: () => Tone.ToneAudioNode[];
}

type Zone = BassZone & { norm: number };

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

export class SampledGuitar implements Instrument {
  readonly output = new Tone.Gain(1);
  readonly mono = false;
  private input = new Tone.Gain(1);
  private chainNodes: Tone.ToneAudioNode[] = [];
  private zones: Zone[] = [];
  private release: BassZone[] = [];
  private muted: SampleLayer[] = [];
  private buffers = new Map<string, AudioBuffer>();
  private ready = false;
  private rr = new RoundRobin();
  private voices: Voice[] = [];
  private disposed = false;

  constructor(
    readonly id: string,
    private def: GuitarSampleDef,
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
    const inst = manifest?.instruments.guitar;
    if (!inst?.zones || this.disposed) return;
    this.zones = inst.zones.map((z) => {
      const mid = z.layers[Math.floor(z.layers.length / 2)] ?? z.layers[0];
      return { ...z, norm: Tone.dbToGain(this.def.levelDb - mid.mean) };
    });
    this.release = inst.release ?? [];
    this.muted = inst.noises?.muted?.layers ?? [];
    const files = [
      ...this.zones.flatMap((z) => z.layers.flatMap((l) => l.files)),
      ...this.release.flatMap((z) => z.layers.flatMap((l) => l.files)),
      ...this.muted.flatMap((l) => l.files),
    ];
    const bufs = await loadAll(files);
    if (this.disposed) return;
    this.buffers = bufs;
    this.ready = true;
  }

  private play(buf: AudioBuffer, t: number, level: number, rate: number, ring: number | null): Voice {
    const ctx = Tone.getContext();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.0015);
    src.connect(gain);
    Tone.connect(gain, this.input);
    src.start(t);
    if (ring !== null) {
      const end = t + ring;
      gain.gain.setValueAtTime(level, end);
      gain.gain.setTargetAtTime(0, end, 0.012); // hand damps the strings
      src.stop(end + 0.12);
    }
    const v: Voice = { src, gain };
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
      this.voices = this.voices.filter((x) => x !== v);
    };
    this.voices.push(v);
    if (this.voices.length > 36) {
      const old = this.voices.shift()!;
      try {
        old.gain.gain.setTargetAtTime(0, t, 0.01);
        old.src.stop(t + 0.06);
      } catch {
        /* already stopped */
      }
    }
    return v;
  }

  notes(midis: number[], duration: number, velocity: number, time: number) {
    if (!this.ready) {
      this.fallback?.notes?.(midis, duration, velocity, time);
      return;
    }
    const ctx = Tone.getContext();
    const t0 = Math.max(time, ctx.currentTime);
    const sorted = [...midis].sort((a, b) => a - b);
    const order = this.def.up ? [...sorted].reverse() : sorted;
    // A player can't damp strings much faster than ~60 ms, so very short chops still ring a little.
    const ring = this.def.muted
      ? Math.min(Math.max(duration, 0.03), 0.045)
      : Math.min(Math.max(duration, 0.06), this.def.maxRing);
    const ghost = velocity < 0.45;

    order.forEach((m, i) => {
      const zone = nearestZone(this.zones, m);
      if (!zone) return;
      const layer = zone.layers[pickLayer(velocity, zone.layers.length)];
      const file = layer.files[this.rr.next(`${zone.midi}:${layer.files[0]}`, layer.files.length)];
      const buf = this.buffers.get(file);
      if (!buf) return;
      // Strings later in the strum are hit slightly softer and a touch later.
      const t = t0 + i * this.def.strum * (0.85 + Math.random() * 0.3);
      const accent = 1 - i * (this.def.up ? 0.07 : 0.04);
      const level = zone.norm * velocityGain(velocity) * accent * (this.def.muted ? 0.55 : 1);
      const rate = semitonesToRate(m - zone.midi - zone.cents / 100);
      this.play(buf, t, level, rate, ghost ? Math.min(ring, 0.05) : ring);
    });

    // The damping "chk": a real string-mute recording as the chord is released.
    const top = sorted[sorted.length - 1];
    const rel = nearestZone(this.release, top);
    if (rel && this.def.releaseGain > 0) {
      const layer = rel.layers[0];
      const buf = this.buffers.get(layer.files[this.rr.next(`rel:${rel.midi}`, layer.files.length)]);
      if (buf) this.play(buf, t0 + ring, this.def.releaseGain * velocityGain(velocity), 1, null);
    }
    // Muted-strum scratch layered under chops and ghost strokes.
    const scratch = this.def.scratch * (ghost ? 1.6 : 1);
    if (scratch > 0 && this.muted.length) {
      const layer = this.muted[0];
      const buf = this.buffers.get(layer.files[this.rr.next('muted', layer.files.length)]);
      if (buf) this.play(buf, t0, scratch * velocityGain(velocity), 1, null);
    }
  }

  releaseAll(time?: number) {
    const t = time ?? Tone.now();
    for (const v of this.voices) {
      try {
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setTargetAtTime(0, t, 0.01);
        v.src.stop(t + 0.08);
      } catch {
        /* already stopped */
      }
    }
    this.voices = [];
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
