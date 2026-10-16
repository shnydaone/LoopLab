/**
 * Player feel: how each genre's musicians sit against the beat.
 * Roots reggae players lean back (snare, skank and bass slightly late);
 * two-tone players push. Offsets are milliseconds; jitter is the natural
 * timing spread of a human player (much smaller than random "humanize").
 */
import type { DrumVoice, Role } from '@/music/types';

export interface FeelProfile {
  drums: Partial<Record<DrumVoice, number>>;
  drumJitter: number;
  roles: Partial<Record<Role, number>>;
  jitter: number;
  /** Velocity spread (fraction). */
  velSpread: number;
}

const DEFAULT: FeelProfile = { drums: {}, drumJitter: 2, roles: {}, jitter: 2, velSpread: 0.05 };

export const FEELS: Record<string, FeelProfile> = {
  'roots-reggae': {
    drums: { snare: 10, rim: 10, hatC: 5, hatO: 5, hatP: 5, handHi: 7, shaker: 6, timbH: 6, timbL: 6 },
    drumJitter: 3.5,
    roles: { bass: 8, guitar: 9, keys: 7, horns: 12 },
    jitter: 3,
    velSpread: 0.07,
  },
  'militant-steppers': {
    drums: { snare: 4, hatC: 2, hatO: 2 },
    drumJitter: 2,
    roles: { bass: 3, guitar: 6, keys: 4, horns: 8 },
    jitter: 2.5,
    velSpread: 0.05,
  },
  dub: {
    drums: { rim: 12, snare: 12, hatC: 6, hatO: 6, timbH: 8, timbL: 8 },
    drumJitter: 4,
    roles: { bass: 10, guitar: 12, keys: 10, horns: 14 },
    jitter: 3.5,
    velSpread: 0.08,
  },
  rocksteady: {
    drums: { rim: 6, hatC: 3, hatO: 3 },
    drumJitter: 3,
    roles: { bass: 5, guitar: 6, keys: 5, horns: 8 },
    jitter: 3,
    velSpread: 0.06,
  },
  'kingston-ska': {
    drums: { rim: -2, ride: 2 },
    drumJitter: 3,
    roles: { bass: 2, guitar: 0, keys: 2, horns: 4 },
    jitter: 3,
    velSpread: 0.07,
  },
  // Jungle breaks push slightly; everything else sits on the grid.
  jungle: {
    drums: { snare: -2, hatC: 1 },
    drumJitter: 2.5,
    roles: { bass: 0, guitar: 0, keys: 3, horns: 3 },
    jitter: 2,
    velSpread: 0.06,
  },
  // Trip-hop is drunk and heavy: the snare lands far behind the beat.
  'trip-hop': {
    drums: { snare: 14, clap: 12, hatC: 8, hatO: 8, kick: 3 },
    drumJitter: 5,
    roles: { bass: 10, guitar: 8, keys: 10, horns: 12 },
    jitter: 4,
    velSpread: 0.1,
  },
  // Drum machines are tight; the bass pushes a hair ahead.
  'classic-house': {
    drums: { clap: 2 },
    drumJitter: 1,
    roles: { bass: -2, guitar: 0, keys: 0, horns: 0 },
    jitter: 1.5,
    velSpread: 0.04,
  },
  'two-tone-ska': {
    drums: { snare: -3, hatC: -2, hatO: -2, ride: -2 },
    drumJitter: 2,
    roles: { bass: 0, guitar: -3, keys: -2, horns: 2 },
    jitter: 2,
    velSpread: 0.05,
  },
};

export function feelFor(packId: string): FeelProfile {
  return FEELS[packId] ?? DEFAULT;
}

/** Roughly normal random in [-1, 1] (sum of uniforms), so most hits are close to centre. */
export function humanRand(): number {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

/** Timing offset in seconds for one event. */
export function timingOffset(packId: string, role: Role, voice?: DrumVoice): number {
  const f = feelFor(packId);
  const base = voice ? (f.drums[voice] ?? 0) : (f.roles[role] ?? 0);
  const jitter = voice ? f.drumJitter : f.jitter;
  return (base + humanRand() * jitter) / 1000;
}

export function velocityFor(packId: string, v: number): number {
  const f = feelFor(packId);
  return Math.max(0.02, Math.min(1, v * (1 + humanRand() * f.velSpread)));
}
