/**
 * Compatibility engine: decides how a part borrowed from one pack is adapted
 * to the current project (tempo feel, key, mode, progression, note snapping).
 */
import type { Chord, Harmony, Mode, NoteEvent, Pattern, Role } from './types';
import { chordTonePcs, degreeToSemis, mod, placeInWindow } from './theory';

export type CompatMode = 'safe' | 'creative' | 'wild';

export const COMPAT_INFO: Record<CompatMode, string> = {
  safe: 'Every part follows the project key, mode and chords. Melody notes that clash on strong beats are nudged to chord tones.',
  creative: 'Parts follow the project key and chords but keep their own scale colour, and nothing is nudged.',
  wild: "Parts keep their original key, chords and tempo feel. Clashes are yours to enjoy.",
};

/** Allowed tempo-feel multipliers: a pattern step lasts k project steps. */
export const FEELS = [0.5, 1, 2] as const;

/**
 * Pick half-time / normal / double-time so a part written at `patternBpm`
 * sits naturally in a project at `projectBpm`. E.g. a 160 BPM ska beat in a
 * 76 BPM reggae project plays double-time (k = 0.5).
 */
export function feelFactor(projectBpm: number, patternBpm: number, mode: CompatMode): number {
  if (mode === 'wild' || patternBpm <= 0) return 1;
  const ideal = projectBpm / patternBpm;
  let best = 1;
  let bestDist = Infinity;
  for (const k of FEELS) {
    const dist = Math.abs(Math.log2(k / ideal));
    if (dist < bestDist - 1e-9) {
      best = k;
      bestDist = dist;
    }
  }
  return best;
}

export function feelLabel(k: number): string {
  return k === 1 ? '' : k < 1 ? '2× feel' : '½× feel';
}

export interface TrackHarmony {
  root: number;
  mode: Mode;
  progression: Chord[];
  snap: boolean;
}

export function effectiveHarmony(
  mode: CompatMode,
  project: Harmony,
  pack: Harmony | undefined,
): TrackHarmony {
  if (mode === 'wild' && pack) {
    return { root: pack.root, mode: pack.mode, progression: pack.progression, snap: false };
  }
  if (mode === 'creative') {
    return {
      root: project.root,
      mode: pack?.mode ?? project.mode,
      progression: project.progression,
      snap: false,
    };
  }
  return { root: project.root, mode: project.mode, progression: project.progression, snap: true };
}

export const REGISTER: Record<Role, { low: number; center: number }> = {
  drums: { low: 36, center: 48 },
  perc: { low: 48, center: 60 },
  bass: { low: 31, center: 40 },
  guitar: { low: 55, center: 64 },
  keys: { low: 53, center: 62 },
  horns: { low: 58, center: 67 },
};

export interface ResolveCtx {
  harmony: TrackHarmony;
  chord: Chord;
  /** Chord of the next bar, for approach notes (`nx`). Falls back to `chord`. */
  nextChord?: Chord;
  role: Role;
  ref: 'chord' | 'key';
  voicing: 'close' | 'open';
}

function isStrong(n: NoteEvent) {
  return Math.abs(n.t % 4) < 1e-6 || n.d >= 4;
}

/** Resolve one note event to MIDI pitches. */
export function resolveNote(n: NoteEvent, ctx: ResolveCtx): number[] {
  const { harmony: h, role, ref } = ctx;
  const chord = n.nx && ctx.nextChord ? ctx.nextChord : ctx.chord;
  const reg = REGISTER[role];
  const steps = Array.isArray(n.s) ? n.s : [n.s];
  const oct = (n.o ?? 0) * 12 + (n.c ?? 0);
  const out: number[] = [];

  if (ref === 'key') {
    const tonic = placeInWindow(h.root, reg.low);
    const tones = h.snap ? chordTonePcs(chord, h) : null;
    for (const s0 of steps) {
      let s = s0;
      if (tones && steps.length === 1 && isStrong(n)) {
        const pc = mod(h.root + degreeToSemis(s, h.mode), 12);
        if (!tones.includes(pc)) {
          for (const delta of [-1, 1, -2, 2]) {
            const cand = mod(h.root + degreeToSemis(s + delta, h.mode), 12);
            if (tones.includes(cand)) {
              s += delta;
              break;
            }
          }
        }
      }
      out.push(tonic + degreeToSemis(s, h.mode) + oct);
    }
  } else {
    const rootSemis = degreeToSemis(chord.deg, h.mode);
    const rootMidi = placeInWindow(mod(h.root + rootSemis, 12), reg.low);
    const fold = steps.length > 1 && ctx.voicing === 'close';
    for (const s of steps) {
      let m = rootMidi + (degreeToSemis(chord.deg + s, h.mode) - rootSemis);
      if (fold) m = placeInWindow(mod(m, 12), reg.center - 6);
      out.push(m + oct);
    }
  }
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

/** Convenience used by tests and the UI. */
export function resolvePatternRef(p: Pattern): 'chord' | 'key' {
  return p.harmony ?? 'chord';
}
