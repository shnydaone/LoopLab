import type { CompatMode } from '@/music/compat';
import type { Harmony, Pattern, Role } from '@/music/types';

export const SCHEMA_VERSION = 1;

export type Quantize = 'beat' | 'bar' | '2bar' | '4bar';

export const QUANTIZE_STEPS: Record<Quantize, number> = {
  beat: 4,
  bar: 16,
  '2bar': 32,
  '4bar': 64,
};

export interface TrackFx {
  /** 0..1 send levels. */
  reverb: number;
  delay: number;
  /** 0..1 low-pass position (1 = fully open). */
  filter: number;
  /** 0..1 drive amount. */
  drive: number;
}

export interface TrackState {
  id: string;
  role: Role;
  name: string;
  color: string;
  patternId: string | null;
  /** Instrument override; null uses the pattern's own instrument. */
  instrument: string | null;
  /** Fader 0..1 (0.8 ≈ 0 dB). */
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  locked: boolean;
  fx: TrackFx;
}

export interface SceneTrack {
  patternId: string | null;
  mute: boolean;
  volume: number;
}

export interface Scene {
  id: string;
  name: string;
  color: string;
  bpm: number;
  harmony: Harmony;
  tracks: Record<string, SceneTrack>;
}

export interface Project {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  bpm: number;
  /** Extra swing added on top of each pattern's own swing (0..0.5). */
  swing: number;
  masterVolume: number;
  harmony: Harmony;
  /** Bumped whenever the progression should restart from its first chord. */
  harmonyStamp: number;
  compat: CompatMode;
  quantize: Quantize;
  basePackId: string;
  sectionId: string | null;
  tracks: TrackState[];
  userPatterns: Pattern[];
  scenes: Scene[];
}

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  basePackId: string;
}
