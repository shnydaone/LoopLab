/**
 * Groove library: registry of genre packs plus lookup helpers.
 * New packs are added by importing them into PACKS — everything else
 * (browser, Surprise Me, compatibility) picks them up automatically.
 */
import type { GenrePack, Pattern, Role } from '@/music/types';
import { acidHouse } from './packs/acidHouse';
import { breakbeatHardcore } from './packs/breakbeatHardcore';
import { classicHouse } from './packs/classicHouse';
import { dub } from './packs/dub';
import { happyHardcore } from './packs/happyHardcore';
import { hardcoreTechno } from './packs/hardcoreTechno';
import { jungle } from './packs/jungle';
import { oldSchoolRave } from './packs/oldSchoolRave';
import { tripHop } from './packs/tripHop';
import { kingstonSka } from './packs/kingstonSka';
import { rocksteady } from './packs/rocksteady';
import { rootsReggae } from './packs/rootsReggae';
import { steppers } from './packs/steppers';
import { twoToneSka } from './packs/twoToneSka';

/** Grouped by family; the browser filters by `family`. */
export const PACKS: GenrePack[] = [
  rootsReggae,
  steppers,
  dub,
  rocksteady,
  kingstonSka,
  twoToneSka,
  jungle,
  tripHop,
  classicHouse,
  acidHouse,
  oldSchoolRave,
  breakbeatHardcore,
  happyHardcore,
  hardcoreTechno,
];

export const FAMILIES = Array.from(new Set(PACKS.map((p) => p.family)));

const packById = new Map(PACKS.map((p) => [p.id, p]));
const builtinPatterns = new Map<string, Pattern>();
for (const pack of PACKS) for (const p of pack.patterns) builtinPatterns.set(p.id, p);

export function getPack(id: string | undefined): GenrePack | undefined {
  return id ? packById.get(id) : undefined;
}

export function getBuiltinPattern(id: string): Pattern | undefined {
  return builtinPatterns.get(id);
}

export function allBuiltinPatterns(): Pattern[] {
  return Array.from(builtinPatterns.values());
}

export function patternsForRole(role: Role, extra: Pattern[] = []): Pattern[] {
  return [...allBuiltinPatterns(), ...extra].filter((p) => p.role === role && !p.tags.includes('fill'));
}

export function packAccent(packId: string): string {
  return packById.get(packId)?.accent ?? '#8ea2ff';
}
