import { describe, expect, it } from 'vitest';
import { effectiveHarmony, feelFactor, resolveNote } from './compat';
import { mutatePattern } from './mutate';
import { compilePattern, eventsInWindow, swingTime } from './pattern';
import { chordAt, chordName, degreeToSemis, progressionSteps } from './theory';
import type { Harmony, Pattern } from './types';

const aDorian: Harmony = {
  root: 9,
  mode: 'dorian',
  progression: [
    { deg: 0, bars: 2 },
    { deg: 3, bars: 2 },
  ],
};

describe('theory', () => {
  it('maps scale degrees to semitones across octaves', () => {
    expect(degreeToSemis(2, 'major')).toBe(4);
    expect(degreeToSemis(7, 'major')).toBe(12);
    expect(degreeToSemis(-1, 'major')).toBe(-1);
    expect(degreeToSemis(-3, 'dorian')).toBe(-5);
  });

  it('names diatonic chords', () => {
    expect(chordName({ deg: 0, bars: 1 }, aDorian)).toBe('Am');
    expect(chordName({ deg: 3, bars: 1 }, aDorian)).toBe('D');
    expect(chordName({ deg: 6, bars: 1 }, aDorian)).toBe('G');
    expect(chordName({ deg: 4, bars: 1 }, { root: 7, mode: 'major' })).toBe('D');
  });

  it('finds the chord at a step and loops the progression', () => {
    expect(progressionSteps(aDorian.progression)).toBe(64);
    expect(chordAt(aDorian.progression, 31).deg).toBe(0);
    expect(chordAt(aDorian.progression, 32).deg).toBe(3);
    expect(chordAt(aDorian.progression, 64).deg).toBe(0);
    expect(chordAt(aDorian.progression, -1).deg).toBe(3);
  });
});

describe('timing', () => {
  it('swings only exact odd 16ths', () => {
    expect(swingTime(3, 0.6)).toBeCloseTo(3.2);
    expect(swingTime(2, 0.6)).toBe(2);
    expect(swingTime(3.5, 0.6)).toBe(3.5);
    expect(swingTime(3, 0)).toBe(3);
  });

  const p: Pattern = {
    id: 't', name: 't', role: 'drums', packId: 'x', genre: 'x', kind: 'drum', bars: 1, bpm: 100, swing: 0,
    instrument: 'kit-roots', energy: 1, tags: [],
    hits: [
      { t: 0, v: 1, voice: 'kick' },
      { t: 8, v: 1, voice: 'snare' },
      { t: 15, v: 1, voice: 'hatC' },
    ],
  };

  it('returns events inside a window and wraps around the loop', () => {
    const cp = compilePattern(p);
    const w = eventsInWindow(cp, 15, 2);
    expect(w.map((x) => x.ev.hit!.voice)).toEqual(['hatC', 'kick']);
    expect(w[1].rel).toBeCloseTo(1);
  });

  it('supports half-steps (double-time feel) and long windows (half-time)', () => {
    const cp = compilePattern(p);
    expect(eventsInWindow(cp, 7.5, 0.5)).toHaveLength(0);
    expect(eventsInWindow(cp, 8, 0.5)).toHaveLength(1);
    expect(eventsInWindow(cp, 32, 2)).toHaveLength(1);
  });

  it('never returns the same event in two adjacent windows', () => {
    const cp = compilePattern({ ...p, swing: 0.7 });
    let count = 0;
    for (let s = 0; s < 64; s += 0.5) count += eventsInWindow(cp, s, 0.5).length;
    expect(count).toBe(3 * 4);
  });

  it('clips mono note lengths before the next note', () => {
    const bass: Pattern = { ...p, kind: 'pitched', hits: undefined, notes: [{ t: 0, d: 6, v: 1, s: 0 }, { t: 4, d: 2, v: 1, s: 2 }] };
    const cp = compilePattern(bass);
    expect(cp.events[0].monoDur).toBeLessThan(4);
    expect(cp.events[1].monoDur).toBe(2);
  });
});

describe('compatibility engine', () => {
  it('picks half/double-time feel from native tempo', () => {
    expect(feelFactor(76, 168, 'safe')).toBe(0.5);
    expect(feelFactor(168, 76, 'safe')).toBe(2);
    expect(feelFactor(100, 104, 'safe')).toBe(1);
    expect(feelFactor(120, 168, 'creative')).toBe(1);
    expect(feelFactor(76, 168, 'wild')).toBe(1);
  });

  it('resolves chord-relative bass into the bass register', () => {
    const th = effectiveHarmony('safe', aDorian, undefined);
    const ctx = { harmony: th, chord: { deg: 0, bars: 2 }, role: 'bass' as const, ref: 'chord' as const, voicing: 'close' as const };
    expect(resolveNote({ t: 0, d: 1, v: 1, s: 0 }, ctx)).toEqual([33]);
    expect(resolveNote({ t: 0, d: 1, v: 1, s: 4 }, ctx)).toEqual([40]);
    expect(resolveNote({ t: 0, d: 1, v: 1, s: 0, o: 1 }, ctx)).toEqual([45]);
  });

  it('folds chords into a close voicing (auto inversions)', () => {
    const th = effectiveHarmony('safe', aDorian, undefined);
    const midis = resolveNote(
      { t: 4, d: 1, v: 1, s: [0, 2, 4] },
      { harmony: th, chord: { deg: 0, bars: 2 }, role: 'guitar', ref: 'chord', voicing: 'close' },
    );
    expect(midis).toEqual([60, 64, 69]);
  });

  it('snaps clashing strong melody notes to chord tones only in Safe mode', () => {
    const note = { t: 8, d: 4, v: 1, s: 4 };
    const chord = { deg: 6, bars: 1 };
    const safe = resolveNote(note, { harmony: effectiveHarmony('safe', aDorian, undefined), chord, role: 'horns', ref: 'key', voicing: 'close' });
    const creative = resolveNote(note, { harmony: effectiveHarmony('creative', aDorian, undefined), chord, role: 'horns', ref: 'key', voicing: 'close' });
    expect(safe).toEqual([74]);
    expect(creative).toEqual([76]);
  });

  it('Wild mode keeps the part in its own key', () => {
    const gMajor: Harmony = { root: 7, mode: 'major', progression: [{ deg: 0, bars: 1 }] };
    const th = effectiveHarmony('wild', aDorian, gMajor);
    expect(th.root).toBe(7);
    expect(th.progression).toBe(gMajor.progression);
  });
});

describe('variation generator', () => {
  const src: Pattern = {
    id: 'src', name: 'One Drop A', role: 'drums', packId: 'x', genre: 'x', kind: 'drum', bars: 1, bpm: 76, swing: 0.4,
    instrument: 'kit-roots', energy: 2, tags: [],
    hits: [
      { t: 8, v: 1, voice: 'kick' },
      { t: 8, v: 1, voice: 'rim' },
      ...[0, 2, 4, 6, 8, 10, 12, 14].map((t) => ({ t, v: 0.6, voice: 'hatC' as const })),
    ],
  };

  it('is deterministic for a seed and never edits the source', () => {
    const before = JSON.stringify(src);
    const a = mutatePattern(src, 42);
    const b = mutatePattern(src, 42);
    expect(a).toEqual(b);
    expect(JSON.stringify(src)).toBe(before);
    expect(a.sourceId).toBe('src');
    expect(a.id).not.toBe('src');
    expect(a.name).toBe('One Drop A v2');
  });

  it('keeps anchor hits (the drop on beat 3)', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const v = mutatePattern(src, seed);
      expect(v.hits!.some((h) => h.voice === 'kick' && h.t === 8)).toBe(true);
      expect(v.hits!.some((h) => h.voice === 'rim' && h.t === 8)).toBe(true);
    }
  });

  it('keeps generated notes inside the pattern length', () => {
    const bass: Pattern = { ...src, kind: 'pitched', role: 'bass', hits: undefined, bars: 2, notes: [{ t: 2, d: 6, v: 0.9, s: 0 }, { t: 16, d: 4, v: 0.9, s: 4 }, { t: 30, d: 2, v: 0.6, s: 2 }] };
    for (let seed = 0; seed < 30; seed++) {
      const v = mutatePattern(bass, seed);
      expect(v.notes!.every((n) => n.t >= 0 && n.t < 32)).toBe(true);
    }
  });
});
