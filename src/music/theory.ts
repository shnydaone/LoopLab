import type { Chord, Harmony, Mode } from './types';
import { STEPS_PER_BAR } from './types';

export const SCALES: Record<Mode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const MODE_LABEL: Record<Mode, string> = {
  major: 'Major',
  minor: 'Minor',
  dorian: 'Dorian',
  mixolydian: 'Mixolydian',
};

export const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Semitones above the tonic for a (possibly negative / >7) scale degree. */
export function degreeToSemis(deg: number, mode: Mode): number {
  const scale = SCALES[mode];
  const oct = Math.floor(deg / 7);
  return scale[mod(deg, 7)] + 12 * oct;
}

/** Diatonic triad (or 7th) quality name for a chord degree. */
export function chordQuality(deg: number, mode: Mode): 'maj' | 'min' | 'dim' {
  const r = degreeToSemis(deg, mode);
  const third = degreeToSemis(deg + 2, mode) - r;
  const fifth = degreeToSemis(deg + 4, mode) - r;
  if (third === 4) return 'maj';
  if (fifth === 6) return 'dim';
  return 'min';
}

export function chordName(chord: Chord, h: Pick<Harmony, 'root' | 'mode'>): string {
  const pc = mod(h.root + degreeToSemis(chord.deg, h.mode), 12);
  const q = chordQuality(chord.deg, h.mode);
  const suffix = q === 'maj' ? '' : q === 'min' ? 'm' : 'dim';
  return NOTE_NAMES[pc] + suffix + (chord.seventh ? '7' : '');
}

export function keyName(h: Pick<Harmony, 'root' | 'mode'>): string {
  return `${NOTE_NAMES[h.root]} ${MODE_LABEL[h.mode]}`;
}

export function progressionSteps(prog: Chord[]): number {
  return Math.max(
    STEPS_PER_BAR,
    Math.round(prog.reduce((a, c) => a + c.bars, 0) * STEPS_PER_BAR),
  );
}

/** Chord sounding `step` steps after the progression started (loops). */
export function chordAt(prog: Chord[], step: number): Chord {
  if (prog.length === 0) return { deg: 0, bars: 1 };
  const total = progressionSteps(prog);
  let pos = mod(step, total);
  for (const c of prog) {
    const len = c.bars * STEPS_PER_BAR;
    if (pos < len) return c;
    pos -= len;
  }
  return prog[prog.length - 1];
}

/** Chord that starts the bar after `step` (for approach notes into the change). */
export function nextBarChord(prog: Chord[], step: number): Chord {
  const nextBar = (Math.floor(step / STEPS_PER_BAR + 1e-9) + 1) * STEPS_PER_BAR;
  return chordAt(prog, nextBar);
}

export function chordIndexAt(prog: Chord[], step: number): number {
  const c = chordAt(prog, step);
  return prog.indexOf(c);
}

/** Pitch classes of the chord tones (relative to C) for Safe-mode snapping. */
export function chordTonePcs(chord: Chord, h: Pick<Harmony, 'root' | 'mode'>): number[] {
  const degs = chord.seventh ? [0, 2, 4, 6] : [0, 2, 4];
  return degs.map((d) => mod(h.root + degreeToSemis(chord.deg + d, h.mode), 12));
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function midiName(m: number): string {
  return NOTE_NAMES[mod(m, 12)] + (Math.floor(m / 12) - 1);
}

/** Place pitch class `pc` in the octave window [low, low+12). */
export function placeInWindow(pc: number, low: number): number {
  return low + mod(pc - low, 12);
}

/** Transpose interval between two keys, choosing the smallest move (-5..+6). */
export function smallestShift(from: number, to: number): number {
  const d = mod(to - from, 12);
  return d > 6 ? d - 12 : d;
}
