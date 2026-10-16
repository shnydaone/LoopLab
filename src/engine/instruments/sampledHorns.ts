/**
 * Sampled horn section: real trumpet, tenor saxophone and trombone players.
 *
 * Melodies are voiced the way ska and reggae sections play them (e.g.
 * trumpet and tenor in unison with trombone an octave below). Chords become
 * a real section voicing: the top note to the highest horn, the bottom note
 * to the trombone. Short notes use staccato recordings, long notes sustained
 * ones. Each player is panned to their own spot and is a few milliseconds
 * looser than the others, as a live section is.
 */
import * as Tone from 'tone';
import { loadAll, loadManifest, type BassZone } from '../samples/loader';
import { nearestZone, pickLayer, RoundRobin, semitonesToRate, velocityGain } from '../samples/select';
import type { Instrument } from './types';

export type HornId = 'trumpet' | 'tenor-sax' | 'trombone';

interface Player {
  id: HornId;
  /** Comfortable sounding range (MIDI). Notes are moved by octaves into it. */
  lo: number;
  hi: number;
  pan: number;
  /** Average timing offset in ms (section looseness). */
  lag: number;
  levelDb: number;
}

export interface HornSectionDef {
  /** Players and how a single melody note is doubled: semitone shift per player. */
  melody: { player: HornId; shift: number }[];
  /** Players for chords, highest first. */
  chordOrder: HornId[];
  /** Notes shorter than this (seconds) use staccato samples. */
  staccatoBelow: number;
  release: number;
  chain: () => Tone.ToneAudioNode[];
}

const PLAYERS: Record<HornId, Player> = {
  trumpet: { id: 'trumpet', lo: 55, hi: 84, pan: 0.28, lag: 0, levelDb: -22.5 },
  'tenor-sax': { id: 'tenor-sax', lo: 46, hi: 77, pan: -0.28, lag: 5, levelDb: -21.5 },
  trombone: { id: 'trombone', lo: 40, hi: 67, pan: 0.04, lag: 8, levelDb: -21 },
};

type Zone = BassZone & { norm: number };

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

export function fitRange(m: number, lo: number, hi: number): number {
  let x = m;
  while (x < lo) x += 12;
  while (x > hi) x -= 12;
  return x < lo ? m : x;
}

export class SampledHorns implements Instrument {
  readonly output = new Tone.Gain(1);
  readonly mono = false;
  private input = new Tone.Gain(1);
  private chainNodes: Tone.ToneAudioNode[] = [];
  private panners = new Map<HornId, Tone.Panner>();
  private sus = new Map<HornId, Zone[]>();
  private stac = new Map<HornId, Zone[]>();
  private buffers = new Map<string, AudioBuffer>();
  private ready = false;
  private rr = new RoundRobin();
  private voices: Voice[] = [];
  private disposed = false;

  constructor(
    readonly id: string,
    private def: HornSectionDef,
    private fallback: Instrument | null,
  ) {
    this.chainNodes = def.chain();
    if (this.chainNodes.length) this.input.chain(...this.chainNodes, this.output);
    else this.input.connect(this.output);
    for (const p of Object.values(PLAYERS)) {
      const pan = new Tone.Panner(p.pan);
      pan.connect(this.input);
      this.panners.set(p.id, pan);
    }
    if (fallback) fallback.output.connect(this.output);
    void this.load();
  }

  private async load() {
    const manifest = await loadManifest();
    if (!manifest || this.disposed) return;
    const used = new Set<HornId>([...this.def.melody.map((m) => m.player), ...this.def.chordOrder]);
    const files: string[] = [];
    for (const id of used) {
      const inst = manifest.instruments[id];
      if (!inst?.zones) continue;
      const norm = (z: BassZone): Zone => {
        const mid = z.layers[Math.floor(z.layers.length / 2)] ?? z.layers[0];
        return { ...z, norm: Tone.dbToGain(PLAYERS[id].levelDb - mid.mean) };
      };
      this.sus.set(id, inst.zones.map(norm));
      this.stac.set(id, (inst.staccato ?? []).map(norm));
      for (const z of [...inst.zones, ...(inst.staccato ?? [])]) for (const l of z.layers) files.push(...l.files);
    }
    const bufs = await loadAll(files);
    if (this.disposed) return;
    this.buffers = bufs;
    this.ready = true;
  }

  private playNote(player: HornId, midi: number, duration: number, velocity: number, time: number) {
    const p = PLAYERS[player];
    const m = fitRange(midi, p.lo, p.hi);
    const short = duration < this.def.staccatoBelow;
    const zones = (short ? this.stac.get(player) : undefined)?.length ? this.stac.get(player)! : this.sus.get(player);
    if (!zones?.length) return;
    const zone = nearestZone(zones, m);
    if (!zone) return;
    const layer = zone.layers[pickLayer(velocity, zone.layers.length)];
    const file = layer.files[this.rr.next(`${player}:${zone.midi}:${layer.files[0]}`, layer.files.length)];
    const buf = this.buffers.get(file);
    if (!buf) return;
    const ctx = Tone.getContext();
    const t = Math.max(ctx.currentTime, time + (p.lag + (Math.random() - 0.5) * 6) / 1000);
    const rate = semitonesToRate(m - zone.midi - zone.cents / 100);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    const level = zone.norm * velocityGain(velocity);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.004);
    const natural = buf.duration / rate;
    const end = t + Math.min(natural, Math.max(0.06, duration));
    if (!short || end < t + natural) {
      gain.gain.setValueAtTime(level, end);
      gain.gain.setTargetAtTime(0, end, this.def.release / 3);
    }
    src.connect(gain);
    Tone.connect(gain, this.panners.get(player)!);
    src.start(t);
    src.stop(Math.min(t + natural, end + this.def.release + 0.1));
    const v: Voice = { src, gain };
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
      this.voices = this.voices.filter((x) => x !== v);
    };
    this.voices.push(v);
  }

  notes(midis: number[], duration: number, velocity: number, time: number) {
    if (!this.ready) {
      this.fallback?.notes?.(midis, duration, velocity, time);
      return;
    }
    const sorted = [...midis].sort((a, b) => b - a); // highest first
    if (sorted.length === 1) {
      for (const { player, shift } of this.def.melody) this.playNote(player, sorted[0] + shift, duration, velocity, time);
      return;
    }
    // Section voicing: top note to the highest horn, bottom note to the lowest.
    const order = this.def.chordOrder;
    order.forEach((player, i) => {
      const note = i === order.length - 1 ? sorted[sorted.length - 1] : sorted[Math.min(i, sorted.length - 1)];
      this.playNote(player, note, duration, velocity, time);
    });
  }

  releaseAll(time?: number) {
    const t = time ?? Tone.now();
    for (const v of this.voices) {
      try {
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setTargetAtTime(0, t, 0.02);
        v.src.stop(t + 0.12);
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
    for (const p of this.panners.values()) p.dispose();
    this.input.dispose();
    this.output.dispose();
  }
}
