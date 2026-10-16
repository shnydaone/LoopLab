/**
 * Build-up drum roll generator: a snare roll that accelerates from eighths
 * to sixteenths to thirty-seconds with a crescendo, over `bars` bars, with
 * the kick holding quarters for the first half. Generated at project tempo.
 */
import type { DrumHit, Pattern } from './types';

export function buildRollPattern(bars: number, bpm: number, instrument: string): Pattern {
  const len = bars * 16;
  const hits: DrumHit[] = [];
  const add = (t: number, voice: DrumHit['voice']) => {
    const progress = t / len;
    hits.push({ t, voice, v: Math.min(1, 0.35 + progress * 0.7) });
  };
  for (let t = 0; t < len; ) {
    const progress = t / len;
    add(t, 'snare');
    if (progress < 0.5 && t % 4 === 0) add(t, 'kick');
    t += progress < 0.5 ? 2 : progress < 0.875 ? 1 : 0.5;
  }
  return {
    id: `build-roll-${bars}`,
    name: 'Build Roll',
    role: 'drums',
    packId: 'build',
    genre: 'Build',
    kind: 'drum',
    bars,
    bpm,
    swing: 0,
    instrument,
    energy: 5,
    tags: ['fill', 'build'],
    hits,
  };
}
