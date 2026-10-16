import { describe, expect, it } from 'vitest';
import { presetById } from '@/engine/instruments/presetInfo';
import { patternLength } from '@/music/pattern';
import { ROLES } from '@/music/types';
import { allBuiltinPatterns, getBuiltinPattern, PACKS } from './library';

describe('groove library integrity', () => {
  it('has unique pattern ids', () => {
    const ids = PACKS.flatMap((p) => p.patterns.map((x) => x.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const pack of PACKS) {
    describe(pack.name, () => {
      it('covers every instrument role', () => {
        for (const role of ROLES) {
          expect(pack.patterns.some((p) => p.role === role), role).toBe(true);
        }
      });

      it('has well-formed patterns with known instruments', () => {
        for (const p of pack.patterns) {
          const len = patternLength(p);
          expect(presetById.has(p.instrument), `${p.id} instrument ${p.instrument}`).toBe(true);
          expect(p.kind === 'drum' ? !!p.hits?.length : !!p.notes?.length, p.id).toBe(true);
          for (const h of p.hits ?? []) {
            expect(h.t >= 0 && h.t < len, `${p.id} hit at ${h.t}`).toBe(true);
            expect(h.v > 0 && h.v <= 1).toBe(true);
          }
          for (const n of p.notes ?? []) {
            expect(n.t >= 0 && n.t < len, `${p.id} note at ${n.t}`).toBe(true);
            expect(n.d).toBeGreaterThan(0);
          }
        }
      });

      it('has sections that reference real patterns of the right role', () => {
        expect(pack.sections.length).toBeGreaterThanOrEqual(2);
        for (const s of pack.sections) {
          expect(s.progression.length).toBeGreaterThan(0);
          for (const [role, id] of Object.entries(s.parts)) {
            if (!id) continue;
            const p = getBuiltinPattern(id);
            expect(p, `${s.id}.${role} -> ${id}`).toBeDefined();
            expect(p!.role).toBe(role);
          }
        }
      });

      it('has a working drum fill', () => {
        for (const id of pack.fills) expect(getBuiltinPattern(id)?.tags).toContain('fill');
      });
    });
  }

  it('makes Roots Reggae and Two-Tone Ska genuinely different', () => {
    const reggae = PACKS.find((p) => p.id === 'roots-reggae')!;
    const ska = PACKS.find((p) => p.id === 'two-tone-ska')!;
    expect(ska.bpm).toBeGreaterThan(reggae.bpm * 1.8);
    const oneDrop = getBuiltinPattern('rr-drums-onedrop-a')!;
    const twoTone = getBuiltinPattern('tt-drums-a')!;
    // One drop: nothing on beat 1, kick on 3. Two-tone: kick on every beat.
    expect(oneDrop.hits!.some((h) => h.voice === 'kick' && h.t === 0)).toBe(false);
    expect(oneDrop.hits!.some((h) => h.voice === 'kick' && h.t === 8)).toBe(true);
    expect([0, 4, 8, 12].every((t) => twoTone.hits!.some((h) => h.voice === 'kick' && h.t === t))).toBe(true);
    expect(reggae.harmony.mode).not.toBe(ska.harmony.mode);
  });

  it('exposes every pattern through the registry', () => {
    expect(allBuiltinPatterns().length).toBe(PACKS.reduce((a, p) => a + p.patterns.length, 0));
  });
});
