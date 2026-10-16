/**
 * Sample-playback drum kit. Every hit plays a real recording:
 *   velocity → which recorded strength (layer) → which take (round robin).
 * Accented snares become rimshots, closed hats choke the open hat, and any
 * voice without recordings (e.g. the dub siren) is played by the synth kit.
 */
import * as Tone from 'tone';
import type { DrumVoice } from '@/music/types';
import { loadAll, loadManifest, type DrumVoiceSamples } from '../samples/loader';
import { pickLayer, RoundRobin, semitonesToRate, velocityGain } from '../samples/select';
import type { Instrument } from './types';

export interface KitSampleDef {
  /** Manifest instrument ids to merge (e.g. a drum kit plus the percussion set). */
  sets: string[];
  /** Voices in these sets are normalised as one group (natural kit balance), keyed to this voice's loudest layer. */
  groupSet?: string;
  groupRef?: DrumVoice;
  groupPeakDb?: number;
  /** Everything else is normalised voice-by-voice to this peak. */
  voicePeakDb?: number;
  /** Fine trims in dB per voice, applied after normalisation. */
  trims?: Partial<Record<DrumVoice, number>>;
}

interface LiveVoice {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

export class SampledKit implements Instrument {
  readonly output = new Tone.Gain(1);
  readonly mono = false;
  private voices = new Map<string, DrumVoiceSamples & { gain: number }>();
  private buffers = new Map<string, AudioBuffer>();
  private ready = false;
  private rr = new RoundRobin();
  private openHats: LiveVoice[] = [];
  private disposed = false;

  constructor(
    readonly id: string,
    private def: KitSampleDef,
    private fallback: Instrument | null,
  ) {
    if (fallback) fallback.output.connect(this.output);
    void this.load();
  }

  get isReady() {
    return this.ready;
  }

  private async load() {
    const manifest = await loadManifest();
    if (!manifest || this.disposed) return;
    const files: string[] = [];
    for (const setId of this.def.sets) {
      const inst = manifest.instruments[setId];
      if (!inst?.voices) continue;
      const isGroup = setId === this.def.groupSet;
      let groupGain = 1;
      if (isGroup && this.def.groupRef) {
        const ref = inst.voices[this.def.groupRef];
        const refPeak = ref ? Math.max(...ref.layers.map((l) => l.peak)) : -12;
        groupGain = Tone.dbToGain((this.def.groupPeakDb ?? -4) - refPeak);
      }
      for (const [voice, vs] of Object.entries(inst.voices)) {
        if (this.voices.has(voice)) continue; // earlier sets win (kit before percussion)
        let gain = groupGain;
        if (!isGroup) {
          const peak = Math.max(...vs.layers.map((l) => l.peak));
          gain = Tone.dbToGain((this.def.voicePeakDb ?? -8) - peak);
        }
        gain *= Tone.dbToGain(this.def.trims?.[voice as DrumVoice] ?? 0);
        this.voices.set(voice, { ...vs, gain });
        for (const l of vs.layers) files.push(...l.files);
      }
    }
    const bufs = await loadAll(files);
    if (this.disposed) return;
    this.buffers = bufs;
    this.ready = true;
  }

  hit(voice: DrumVoice, velocity: number, time: number) {
    let v: string = voice;
    let rate = 1;
    if (voice === 'snare' && velocity >= 0.93 && this.voices.has('rimshot')) v = 'rimshot';
    if (voice === 'tomM') {
      v = 'tomH';
      rate = semitonesToRate(-3);
    }
    const vs = this.voices.get(v);
    if (!this.ready || !vs) {
      this.fallback?.hit?.(voice, velocity, time);
      return;
    }
    const layer = vs.layers[pickLayer(velocity, vs.layers.length)];
    const file = layer.files[this.rr.next(`${v}:${layer.files[0]}`, layer.files.length)];
    const buf = this.buffers.get(file);
    if (!buf) {
      this.fallback?.hit?.(voice, velocity, time);
      return;
    }
    const ctx = Tone.getContext();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = vs.gain * velocityGain(velocity);
    src.connect(gain);
    Tone.connect(gain, this.output);
    const start = Math.max(time, ctx.currentTime);
    src.start(start);
    const lv: LiveVoice = { src, gain };
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
      this.openHats = this.openHats.filter((h) => h !== lv);
    };
    if (v === 'hatC' || v === 'hatP') {
      // A drummer closing the hi-hat cuts the open ring short.
      for (const h of this.openHats) h.gain.gain.setTargetAtTime(0, start, 0.012);
      this.openHats = [];
    } else if (v === 'hatO') {
      this.openHats.push(lv);
    }
  }

  releaseAll(time?: number) {
    const t = time ?? Tone.now();
    for (const h of this.openHats) h.gain.gain.setTargetAtTime(0, t, 0.02);
    this.openHats = [];
    this.fallback?.releaseAll(time);
  }

  dispose() {
    this.disposed = true;
    this.fallback?.dispose();
    this.output.dispose();
  }
}
