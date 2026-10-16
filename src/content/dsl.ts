/**
 * Tiny authoring notation for groove content.
 *
 * Drum grids: one character per 16th step, '|' and spaces are ignored.
 *   X = accent (1.0)  x = normal (0.8)  m = medium (0.6)  - = soft (0.45)  g = ghost (0.3)  . = rest
 */
import type { DrumHit, DrumVoice, NoteEvent, Pattern } from '@/music/types';

const VEL: Record<string, number> = { X: 1, x: 0.8, m: 0.6, '-': 0.45, g: 0.3 };

export function grid(lines: Partial<Record<DrumVoice, string>>): DrumHit[] {
  const hits: DrumHit[] = [];
  for (const [voice, raw] of Object.entries(lines) as [DrumVoice, string][]) {
    const s = raw.replace(/[|\s]/g, '');
    if (s.length % 16 !== 0) {
      throw new Error(`grid(${voice}) length ${s.length} is not a multiple of 16`);
    }
    for (let t = 0; t < s.length; t++) {
      const v = VEL[s[t]];
      if (v !== undefined) hits.push({ t, v, voice });
    }
  }
  return hits.sort((a, b) => a.t - b.t);
}

export const hit = (voice: DrumVoice, t: number, v = 0.8): DrumHit => ({ voice, t, v });

/** Single note: time, scale step, duration, velocity, octave, chromatic. */
export const n = (t: number, s: number, d: number, v = 0.8, o?: number, c?: number): NoteEvent => ({
  t,
  s,
  d,
  v,
  ...(o ? { o } : {}),
  ...(c ? { c } : {}),
});

/**
 * Approach note into the NEXT bar's chord: scale step `s` (+ chromatic `c`)
 * relative to the upcoming root. e.g. ap(12, 0, 3.5, 0.7, 0, -1) = a semitone
 * below the next chord's root on beat 4: the classic walking-bass approach.
 */
export const ap = (t: number, s: number, d: number, v = 0.75, o?: number, c?: number): NoteEvent => ({
  ...n(t, s, d, v, o, c),
  nx: true,
});

/** Chord: time, scale steps, duration, velocity, octave. */
export const ch = (t: number, s: number[], d: number, v = 0.8, o?: number): NoteEvent => ({
  t,
  s,
  d,
  v,
  ...(o ? { o } : {}),
});

/** Repeat a figure `times`, each copy shifted by `every` steps. */
export function rep<T extends { t: number }>(events: T[], times: number, every = 16): T[] {
  const out: T[] = [];
  for (let i = 0; i < times; i++) for (const e of events) out.push({ ...e, t: e.t + i * every });
  return out;
}

/** Shift a figure to start at bar `b`. */
export const atBar = <T extends { t: number }>(b: number, events: T[]): T[] =>
  events.map((e) => ({ ...e, t: e.t + b * 16 }));

type PackDefaults = Pick<Pattern, 'packId' | 'genre' | 'bpm'>;

export function makePatternFactory(defaults: PackDefaults) {
  return (p: Omit<Pattern, 'packId' | 'genre' | 'bpm' | 'kind' | 'tags'> & {
    tags?: string[];
    bpm?: number;
  }): Pattern => ({
    ...defaults,
    ...p,
    kind: p.hits ? 'drum' : 'pitched',
    tags: p.tags ?? [],
  });
}
