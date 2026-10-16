/**
 * Pure sample-selection logic (no audio): velocity → layer, round-robin
 * rotation, nearest pitch zone. Kept separate so it is unit-testable.
 */

/**
 * Pick a velocity layer (0 = softest). A little randomness near layer
 * boundaries mimics a real player never hitting exactly the same way twice.
 */
export function pickLayer(velocity: number, layerCount: number, rand = Math.random()): number {
  if (layerCount <= 1) return 0;
  const v = Math.min(1, Math.max(0, velocity));
  const x = Math.pow(v, 0.85) * layerCount + (rand - 0.5) * 0.7;
  return Math.min(layerCount - 1, Math.max(0, Math.floor(x)));
}

/** Gain applied on top of the layer choice so dynamics stay continuous. */
export function velocityGain(velocity: number): number {
  const v = Math.min(1, Math.max(0, velocity));
  return 0.42 + 0.58 * v;
}

/** Round-robin chooser that never repeats the previous take for a key. */
export class RoundRobin {
  private last = new Map<string, number>();

  next(key: string, count: number, rand = Math.random()): number {
    if (count <= 1) return 0;
    const prev = this.last.get(key) ?? -1;
    let i = Math.floor(rand * (count - 1));
    if (i >= prev && prev >= 0) i += 1;
    i = Math.min(count - 1, i);
    this.last.set(key, i);
    return i;
  }
}

export interface Zone {
  midi: number;
}

/**
 * Nearest recorded pitch. Ties prefer the lower recording pitched up, which
 * keeps the string's body more natural than pitching a higher note down.
 */
export function nearestZone<T extends Zone>(zones: T[], midi: number): T | undefined {
  let best: T | undefined;
  let bestDist = Infinity;
  for (const z of zones) {
    const d = Math.abs(z.midi - midi);
    if (d < bestDist || (d === bestDist && best && z.midi < best.midi)) {
      best = z;
      bestDist = d;
    }
  }
  return best;
}

export const semitonesToRate = (semis: number) => Math.pow(2, semis / 12);
