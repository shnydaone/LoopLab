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
  /** One pick per input track, in the same order. */
  picks: (string | null)[];
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
  exclude: Set<string | null> = new Set(),
): Pattern | null {
  let pool = patternsForRole(role, user).filter((p) => !p.tags.includes('fill') && !exclude.has(p.id));
  // Several tracks of one type should play different parts, unless nothing else is left.
  if (pool.length === 0) pool = patternsForRole(role, user).filter((p) => !p.tags.includes('fill'));
  if (pool.length === 0) return null;
  const sameBoost = compat === 'safe' ? 3 : compat === 'creative' ? 1.6 : 1;
  return rng.weighted(pool, (p) => {
    const affinity = p.packId === basePack.id ? sameBoost : crossBias;
    const fit = 1 / (1 + Math.abs(p.energy - energy));
    const breakdownPenalty = energy > 2.5 && p.tags.includes('breakdown') ? 0.25 : 1;
    return affinity * fit * breakdownPenalty;
  });
}

/** Parts already taken by locked tracks of each type, extended as picks are made. */
function usedByRole(tracks: TrackPick[]) {
  const sets = new Map<Role, Set<string | null>>();
  for (const t of tracks) if (t.locked) get(t.role).add(t.patternId);
  function get(role: Role) {
    let s = sets.get(role);
    if (!s) sets.set(role, (s = new Set()));
    return s;
  }
  return get;
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
  const picks: (string | null)[] = [];
  const used = usedByRole(tracks);
  for (const t of tracks) {
    if (t.locked) {
      picks.push(t.patternId);
      continue;
    }
    const silence = OPTIONAL_ROLE_SILENCE[t.role] ?? 0;
    if (rng.chance(silence * (energy < 3 ? 1.5 : 0.7))) {
      picks.push(null);
      continue;
    }
    const id = choosePattern(t.role, pack, energy, compat, rng, user, 1.2, used(t.role))?.id ?? null;
    used(t.role).add(id);
    picks.push(id);
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
): (string | null)[] {
  const rng = makeRng(seed);
  const pack = getPack(basePackId) ?? PACKS[0];
  const picks: (string | null)[] = [];
  const used = usedByRole(tracks);
  for (const t of tracks) {
    if (t.locked) {
      picks.push(t.patternId);
      continue;
    }
    const energy = 2.5 + rng.next() * 2;
    const id = choosePattern(t.role, pack, energy, compat, rng, user, 2, new Set([...used(t.role), t.patternId]))?.id ?? t.patternId;
    used(t.role).add(id);
    picks.push(id);
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
): (string | null)[] {
  const rng = makeRng(seed);
  const pack = getPack(basePackId) ?? PACKS[0];
  const picks: (string | null)[] = tracks.map((t) => t.patternId);
  tracks.forEach((t, i) => {
    if (t.locked) return;
    const cur = t.patternId ? lookup(t.patternId) : undefined;
    if (!cur) {
      if (direction > 0 && rng.chance(0.6)) {
        const pool = patternsForRole(t.role, user).filter((p) => p.packId === pack.id && p.energy <= 3);
        if (pool.length) picks[i] = rng.pick(pool).id;
      }
      return;
    }
    const target = cur.energy + direction;
    if (direction < 0 && cur.energy <= 1 && (t.role === 'horns' || t.role === 'perc' || t.role === 'keys')) {
      picks[i] = null;
      return;
    }
    const pool = patternsForRole(t.role, user).filter(
      (p) => p.id !== cur.id && (direction > 0 ? p.energy > cur.energy : p.energy < cur.energy),
    );
    if (pool.length === 0) return;
    const pick = rng.weighted(pool, (p) => (p.packId === cur.packId ? 2.5 : 1) / (1 + Math.abs(p.energy - target)));
    picks[i] = pick.id;
  });
  return picks;
}
