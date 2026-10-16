/** Small deterministic PRNG (mulberry32) so generated results are reproducible. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: (p: number) => next() < p,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    weighted: <T,>(items: readonly T[], weight: (t: T) => number): T => {
      const total = items.reduce((s, i) => s + Math.max(0, weight(i)), 0);
      if (total <= 0) return items[Math.floor(next() * items.length)];
      let r = next() * total;
      for (const i of items) {
        r -= Math.max(0, weight(i));
        if (r <= 0) return i;
      }
      return items[items.length - 1];
    },
  };
}

export type Rng = ReturnType<typeof makeRng>;

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);
