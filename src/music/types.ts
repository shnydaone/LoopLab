/**
 * Core musical data model. Everything here is plain data (JSON-serialisable)
 * so packs, user patterns and projects share one format.
 *
 * Time is measured in STEPS: one step = one 16th note at the pattern's native
 * tempo. A 4/4 bar is 16 steps. Fractional steps are allowed (triplets, flams).
 */

export const STEPS_PER_BAR = 16;
export const STEPS_PER_BEAT = 4;

export type Role = 'drums' | 'bass' | 'guitar' | 'keys' | 'horns' | 'perc';

export const ROLES: Role[] = ['drums', 'bass', 'guitar', 'keys', 'horns', 'perc'];

export type DrumVoice =
  | 'kick'
  | 'snare'
  | 'rim'
  | 'hatC'
  | 'hatO'
  | 'ride'
  | 'tomH'
  | 'tomM'
  | 'tomL'
  | 'crash'
  | 'clap'
  | 'shaker'
  | 'tamb'
  | 'handLo'
  | 'handHi'
  | 'cowbell'
  | 'siren'
  | 'hatP'
  | 'timbH'
  | 'timbL'
  | 'claves'
  | 'congaO'
  | 'congaM'
  | 'bongoL'
  // electronic FX
  | 'riser'
  | 'downer'
  | 'impact'
  | 'revcrash'
  | 'crackle'
  | 'zap';

export const DRUM_VOICES = [
  'kick', 'snare', 'rim', 'hatC', 'hatO', 'hatP', 'ride', 'tomH', 'tomM', 'tomL', 'crash', 'clap', 'shaker', 'tamb',
  'handLo', 'handHi', 'cowbell', 'siren', 'timbH', 'timbL', 'claves', 'congaO', 'congaM', 'bongoL',
  'riser', 'downer', 'impact', 'revcrash', 'crackle', 'zap',
] as const satisfies readonly DrumVoice[];

export interface DrumHit {
  t: number;
  v: number;
  voice: DrumVoice;
}

/**
 * A pitched note. `s` is a scale-step offset (or several, for a chord):
 *  - harmony 'chord': relative to the root of the chord sounding at that moment
 *  - harmony 'key':   relative to the key tonic (melodies)
 * `o` shifts by octaves, `c` by semitones (chromatic colour / approach notes).
 */
export interface NoteEvent {
  t: number;
  d: number;
  v: number;
  s: number | number[];
  o?: number;
  c?: number;
  /**
   * Resolve against the NEXT bar's chord instead of the current one. Used for
   * approach notes and anticipations (a bassist leading into the change).
   */
  nx?: boolean;
}

export type HarmonyRef = 'chord' | 'key';

export type Mode = 'major' | 'minor' | 'dorian' | 'mixolydian';

export interface Chord {
  /** Scale degree of the chord root, 0-based (0 = I/i). */
  deg: number;
  /** Length in bars (may be 0.5 for half-bar changes). */
  bars: number;
  /** Add the diatonic 7th to chord-tone sets (affects Safe-mode snapping). */
  seventh?: boolean;
}

export interface Harmony {
  /** Key tonic pitch class, 0 = C. */
  root: number;
  mode: Mode;
  progression: Chord[];
}

export type SectionKind =
  | 'intro'
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'breakdown'
  | 'solo'
  | 'outro';

export interface Pattern {
  id: string;
  name: string;
  role: Role;
  packId: string;
  genre: string;
  kind: 'drum' | 'pitched';
  /** Length in bars of 16 steps. */
  bars: number;
  /** Native tempo the part was written for. */
  bpm: number;
  /** 0..1 swing applied to off-16ths (1 = full triplet feel). */
  swing: number;
  harmony?: HarmonyRef;
  /** Instrument preset id. */
  instrument: string;
  /** 1 (sparse) .. 5 (intense). */
  energy: number;
  tags: string[];
  hits?: DrumHit[];
  notes?: NoteEvent[];
  /** 'close' folds chords into the instrument's register (auto-inversions). */
  voicing?: 'close' | 'open';
  description?: string;
  /** Set on generated variations so the original stays recoverable. */
  sourceId?: string;
  seed?: number;
}

export interface SectionDef {
  id: string;
  kind: SectionKind;
  name: string;
  progression: Chord[];
  /** Pattern id (or null = silent) per role. Roles omitted keep playing. */
  parts: Partial<Record<Role, string | null>>;
}

export interface GenrePack {
  id: string;
  name: string;
  genre: string;
  family: string;
  description: string;
  bpm: number;
  harmony: Harmony;
  timeSig: [number, number];
  accent: string;
  patterns: Pattern[];
  sections: SectionDef[];
  /** Fill pattern ids keyed by role (drums fills by default). */
  fills: string[];
}
