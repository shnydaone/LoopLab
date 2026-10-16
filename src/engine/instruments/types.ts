import type * as Tone from 'tone';
import type { DrumVoice, Role } from '@/music/types';

export interface Instrument {
  readonly id: string;
  readonly output: Tone.Gain;
  /** Monophonic instruments get note lengths clipped to avoid cutting the next note. */
  readonly mono: boolean;
  hit?(voice: DrumVoice, velocity: number, time: number): void;
  notes?(midis: number[], duration: number, velocity: number, time: number): void;
  releaseAll(time?: number): void;
  dispose(): void;
}

export interface PresetInfo {
  id: string;
  name: string;
  role: Role;
  kind: 'drum' | 'pitched';
  description: string;
}
