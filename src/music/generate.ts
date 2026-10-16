/**
 * Surprise Me / Remix / Evolve. Musically-informed selection (pack affinity,
 * energy targets per section, sensible silences), seeded and reproducible.
 */
import { getPack, PACKS, patternsForRole } from '@/content/library';
import type { CompatMode } from './compat';
import { makeRng } from './rng';
import type { GenrePack, Harmony, Pattern, Role, SectionDef } from './types';

export interface TrackPick {
  role: Role;
  locked: boolean;
  patternId: string | null;
}

export interface GrooveResult {
  basePackId: string;
  sectionId: string;
  bpm: number;
  harmony: Harmony;
  picks: Record<Role, string | null>;
}

const SECTION_ENERGY: Record<string, number> = {
  intro: 2,
  verse: 3,
  chorus: 4,
  breakdown: 1.5,
  bridge: 3,
  outro: 2.5,
};

const OPTIONAL_ROLE_SILENCE: Partial<Record<Role, number>> = { horns: 0.35, perc: 0.2, keys: 0.08 };

function choosePattern(
  role: Role,
  basePack: GenrePack,
  energy: number,
  compat: CompatMode,
  rng: ReturnType<typeof makeRng>,
  user: Pattern[],
  crossBias: number,
  exclude?: string | null,
): Pattern | null {
  const pool = patternsForRole(role, user).filter((p) => !p.tags.includes('fill') && p.id !== exclude);
  if (pool.length === 0) return null;
  const sameBoost = compat === 'safe' ? 3 : compat === 'creative' ? 1.6 : 1;
  return rng.weighted(pool, (p) => {
    const affinity = p.packId === basePack.id ? sameBoost : crossBias;
    const fit = 1 / (1 + Math.abs(p.energy - energy));
    const breakdownPenalty = energy > 2.5 && p.tags.includes('breakdown') ? 0.25 : 1;
    return affinity * fit * breakdownPenalty;
  });
}

export function surprise(
  seed: number,
  tracks: TrackPick[],
  compat: CompatMode,
  user: Pattern[] = [],
): GrooveResult {
  const rng = makeRng(seed);
  const pack = rng.pick(PACKS);
  const sections = pack.sections.filter((s) => s.kind !== 'outro');
  const section: SectionDef = rng.weighted(sections, (s) => (s.kind === 'verse' || s.kind === 'chorus' ? 3 : 1));
  const energy = SECTION_ENERGY[section.kind] ?? 3;
  const picks = {} as Record<Role, string | null>;
  for (const t of tracks) {
    if (t.locked) {
      picks[t.role] = t.patternId;
      continue;
    }
    const silence = OPTIONAL_ROLE_SILENCE[t.role] ?? 0;
    if (rng.chance(silence * (energy < 3 ? 1.5 : 0.7))) {
      picks[t.role] = null;
      continue;
    }
    picks[t.role] = choosePattern(t.role, pack, energy, compat, rng, user, 1.2)?.id ?? null;
  }
  const jitter = compat === 'safe' ? 0 : rng.int(-4, 4);
  return {
    basePackId: pack.id,
    sectionId: section.id,
    bpm: pack.bpm + jitter,
    harmony: { ...pack.harmony, progression: section.progression },
    picks,
  };
}

/** Re-pick unlocked parts, keeping tempo and harmony, favouring cross-genre mixes. */
export function remix(
  seed: number,
  tracks: TrackPick[],
  basePackId: string,
  compat: CompatMode,
  user: Pattern[] = [],
): Record<Role, string | null> {
  const rng = makeRng(seed);
  const pack = getPack(basePackId) ?? PACKS[0];
  const picks = {} as Record<Role, string | null>;
  for (const t of tracks) {
    if (t.locked) {
      picks[t.role] = t.patternId;
      continue;
    }
    const energy = 2.5 + rng.next() * 2;
    picks[t.role] = choosePattern(t.role, pack, energy, compat, rng, user, 2, t.patternId)?.id ?? t.patternId;
  }
  return picks;
}

/** Step the arrangement's energy up or down by swapping to neighbouring parts. */
export function evolve(
  seed: number,
  tracks: TrackPick[],
  basePackId: string,
  direction: 1 | -1,
  lookup: (id: string) => Pattern | undefined,
  user: Pattern[] = [],
): Record<Role, string | null> {
  const rng = makeRng(seed);
  const pack = getPack(basePackId) ?? PACKS[0];
  const picks = {} as Record<Role, string | null>;
  for (const t of tracks) {
    picks[t.role] = t.patternId;
    if (t.locked) continue;
    const cur = t.patternId ? lookup(t.patternId) : undefined;
    if (!cur) {
      if (direction > 0 && rng.chance(0.6)) {
        const pool = patternsForRole(t.role, user).filter((p) => p.packId === pack.id && p.energy <= 3);
        if (pool.length) picks[t.role] = rng.pick(pool).id;
      }
      continue;
    }
    const target = cur.energy + direction;
    if (direction < 0 && cur.energy <= 1 && (t.role === 'horns' || t.role === 'perc' || t.role === 'keys')) {
      picks[t.role] = null;
      continue;
    }
    const pool = patternsForRole(t.role, user).filter(
      (p) => p.id !== cur.id && (direction > 0 ? p.energy > cur.energy : p.energy < cur.energy),
    );
    if (pool.length === 0) continue;
    const pick = rng.weighted(pool, (p) => (p.packId === cur.packId ? 2.5 : 1) / (1 + Math.abs(p.energy - target)));
    picks[t.role] = pick.id;
  }
  return picks;
}
