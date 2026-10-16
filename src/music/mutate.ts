/**
 * Musically-informed pattern variation. Anchors (downbeat kicks, backbeats,
 * one-drop hits, chord roots on strong beats) are preserved; decoration is
 * added or moved. Deterministic for a given seed.
 */
import type { DrumHit, DrumVoice, NoteEvent, Pattern } from './types';
import { makeRng } from './rng';
import { patternLength } from './pattern';

const DECOR_VOICES: DrumVoice[] = ['hatC', 'shaker', 'tamb', 'ride'];

function isAnchorHit(h: DrumHit) {
  return (h.voice === 'kick' || h.voice === 'snare' || h.voice === 'rim') && h.v >= 0.75;
}

function mutateDrums(p: Pattern, amount: number, seed: number): DrumHit[] {
  const rng = makeRng(seed);
  const len = patternLength(p);
  const hits = (p.hits ?? []).map((h) => ({ ...h }));
  const occupied = (voice: DrumVoice, t: number) =>
    hits.some((h) => h.voice === voice && Math.abs(h.t - t) < 0.01);

  const kept = hits.filter((h) => isAnchorHit(h) || !rng.chance(0.18 * amount));

  const decor = DECOR_VOICES.find((v) => hits.some((h) => h.voice === v)) ?? 'hatC';
  for (let t = 0; t < len; t++) {
    if (t % 2 === 1 && !occupied(decor, t) && rng.chance(0.22 * amount)) {
      kept.push({ t, v: 0.25 + rng.next() * 0.2, voice: decor });
    }
  }
  const ghostVoice: DrumVoice = hits.some((h) => h.voice === 'rim') ? 'rim' : 'snare';
  for (let bar = 0; bar < len / 16; bar++) {
    if (rng.chance(0.55 * amount)) {
      const t = bar * 16 + rng.pick([3, 7, 11, 14, 15]);
      if (!occupied(ghostVoice, t)) kept.push({ t, v: 0.22 + rng.next() * 0.15, voice: ghostVoice });
    }
    if (rng.chance(0.35 * amount)) {
      const t = bar * 16 + rng.pick([6, 10, 14]);
      if (!occupied('kick', t)) kept.push({ t, v: 0.5, voice: 'kick' });
    }
    if (hits.some((h) => h.voice === 'hatO') || rng.chance(0.3 * amount)) {
      if (rng.chance(0.4 * amount)) {
        const t = bar * 16 + rng.pick([6, 14]);
        const i = kept.findIndex((h) => h.voice === 'hatC' && Math.abs(h.t - t) < 0.01);
        if (i >= 0) kept.splice(i, 1);
        if (!occupied('hatO', t)) kept.push({ t, v: 0.55, voice: 'hatO' });
      }
    }
  }
  return kept.sort((a, b) => a.t - b.t);
}

function mutateNotes(p: Pattern, amount: number, seed: number): NoteEvent[] {
  const rng = makeRng(seed);
  const len = patternLength(p);
  const notes = (p.notes ?? []).map((n) => ({ ...n, s: Array.isArray(n.s) ? [...n.s] : n.s }));
  const out: NoteEvent[] = [];
  const isChordal = notes.some((n) => Array.isArray(n.s));

  for (const n of notes) {
    const strong = n.t % 4 === 0;
    if (!strong && n.v < 0.7 && rng.chance(0.15 * amount)) continue;

    if (isChordal) {
      if (!strong && rng.chance(0.25 * amount)) {
        out.push({ ...n, t: Math.min(len - 0.5, n.t + 1), v: n.v * 0.8 });
        out.push({ ...n, d: Math.min(n.d, 0.8) });
      } else out.push(n);
      continue;
    }

    if (n.d >= 4 && rng.chance(0.35 * amount)) {
      const half = n.d / 2;
      out.push({ ...n, d: half });
      const step = rng.pick([1, -1, 2, 4, 7]);
      out.push({ ...n, t: n.t + half, d: half, v: n.v * 0.85, s: (n.s as number) + (step === 7 ? 0 : step), o: (n.o ?? 0) + (step === 7 ? 1 : 0) });
      continue;
    }
    if (!strong && rng.chance(0.2 * amount)) {
      const dir = rng.chance(0.5) ? 1 : -1;
      out.push({ ...n, s: (n.s as number) + dir });
      continue;
    }
    if (p.role === 'bass' && rng.chance(0.12 * amount)) {
      const o = (n.o ?? 0) + (rng.chance(0.5) ? 1 : -1);
      out.push({ ...n, o: Math.max(-1, Math.min(1, o)) });
      continue;
    }
    out.push(n);
  }

  // Passing tones leading into strong notes.
  const strongNotes = out.filter((n) => !Array.isArray(n.s) && n.t % 8 === 0 && n.t > 0);
  for (const n of strongNotes) {
    const t = n.t - 1;
    if (t > 0 && !out.some((o) => Math.abs(o.t - t) < 0.5) && rng.chance(0.3 * amount)) {
      out.push({ t, d: 0.9, v: 0.55, s: (n.s as number) + (rng.chance(0.5) ? 1 : -1), o: n.o });
    }
  }
  return out.filter((n) => n.t < len).sort((a, b) => a.t - b.t);
}

export function mutatePattern(p: Pattern, seed: number, amount = 1, newId?: string): Pattern {
  const generation = (p.name.match(/ v(\d+)$/)?.[1] ?? '1');
  const baseName = p.name.replace(/ v\d+$/, '');
  return {
    ...p,
    id: newId ?? `${p.sourceId ?? p.id}~${seed.toString(36)}`,
    name: `${baseName} v${Number(generation) + 1}`,
    hits: p.kind === 'drum' ? mutateDrums(p, amount, seed) : undefined,
    notes: p.kind === 'pitched' ? mutateNotes(p, amount, seed) : undefined,
    sourceId: p.sourceId ?? p.id,
    seed,
    tags: Array.from(new Set([...p.tags, 'variation'])),
  };
}
