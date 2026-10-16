import { describe, expect, it } from 'vitest';
import { getBuiltinPattern } from '@/content/library';
import { buildRollPattern } from './builds';
import { feelFactor } from './compat';
import { eventImportance, keepAtDensity } from './density';
import { chopBreak, mutatePattern } from './mutate';
import { patternLength } from './pattern';

describe('pattern density', () => {
  it('keeps everything at full density', () => {
    expect(keepAtDensity(1, 3, 0.1)).toBe(true);
  });

  it('drops ghost notes before downbeats and accents', () => {
    expect(keepAtDensity(0.5, 7, 0.3)).toBe(false); // ghost on an off-16th
    expect(keepAtDensity(0.5, 4, 0.8)).toBe(true); // backbeat
    expect(keepAtDensity(0, 0, 1)).toBe(true); // accented downbeat survives even at zero
    expect(keepAtDensity(0, 2, 0.8)).toBe(false);
  });

  it('ranks on-beat events above off-beat ones of equal velocity', () => {
    expect(eventImportance(0, 0.6)).toBeGreaterThan(eventImportance(2, 0.6));
    expect(eventImportance(2, 0.6)).toBeGreaterThan(eventImportance(3, 0.6));
  });

  it('thins a real break progressively', () => {
    const p = getBuiltinPattern('jg-break-roller')!;
    const count = (d: number) => p.hits!.filter((h) => keepAtDensity(d, h.t, h.v)).length;
    expect(count(1)).toBeGreaterThan(count(0.6));
    expect(count(0.6)).toBeGreaterThan(count(0.2));
    expect(count(0.2)).toBeGreaterThan(0);
  });
});

describe('break chopping', () => {
  const brk = getBuiltinPattern('jg-break-roller')!;

  it('is deterministic per seed and keeps every bar downbeat', () => {
    const a = chopBreak(brk, 1, 99);
    expect(chopBreak(brk, 1, 99)).toEqual(a);
    for (const bar of [0, 16]) {
      const orig = brk.hits!.filter((h) => h.t >= bar && h.t < bar + 2).map((h) => `${h.voice}@${h.t}`).sort();
      const chopped = a.filter((h) => h.t >= bar && h.t < bar + 2).map((h) => `${h.voice}@${h.t}`).sort();
      expect(chopped).toEqual(orig);
    }
  });

  it('actually re-sequences the break for some seeds', () => {
    const sig = (hits: { t: number; voice: string }[]) => hits.map((h) => `${h.voice}@${h.t}`).join(',');
    const differs = [1, 2, 3, 4, 5, 6].some((s) => sig(chopBreak(brk, 1, s)) !== sig(brk.hits!));
    expect(differs).toBe(true);
  });

  it('stays inside the pattern and is used by the variation button for breaks', () => {
    for (let s = 0; s < 20; s++) expect(chopBreak(brk, 1, s).every((h) => h.t >= 0 && h.t < patternLength(brk))).toBe(true);
    const v = mutatePattern(brk, 7);
    expect(v.hits).toEqual(chopBreak(brk, 1, 7));
  });
});

describe('build-up roll', () => {
  it('accelerates and crescendos over the build', () => {
    const p = buildRollPattern(2, 124, 'dm-909');
    const snares = p.hits!.filter((h) => h.voice === 'snare');
    expect(p.bars).toBe(2);
    const firstGap = snares[1].t - snares[0].t;
    const lastGap = snares[snares.length - 1].t - snares[snares.length - 2].t;
    expect(firstGap).toBe(2);
    expect(lastGap).toBe(0.5);
    expect(snares[snares.length - 1].v).toBeGreaterThan(snares[0].v);
    expect(p.tags).toContain('build');
    expect(snares.every((h) => h.t < 32)).toBe(true);
  });
});

describe('cross-genre tempo feel', () => {
  it('maps reggae parts to half-time under jungle and house parts sensibly', () => {
    expect(feelFactor(165, 76, 'safe')).toBe(2); // reggae bass under a jungle break = classic half-time
    expect(feelFactor(76, 165, 'safe')).toBe(0.5); // jungle break in a reggae project runs double-time
    expect(feelFactor(124, 124, 'safe')).toBe(1);
    expect(feelFactor(88, 124, 'safe')).toBe(1); // house parts in trip-hop stay straight
  });
});
