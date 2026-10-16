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
