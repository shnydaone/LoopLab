import { describe, expect, it } from 'vitest';
import { nearestZone, pickLayer, RoundRobin, semitonesToRate, velocityGain } from './select';

describe('sample selection', () => {
  it('maps soft hits to soft recordings and hard hits to hard ones', () => {
    expect(pickLayer(0.05, 4, 0.5)).toBe(0);
    expect(pickLayer(1, 4, 0.5)).toBe(3);
    expect(pickLayer(0.5, 1, 0.5)).toBe(0);
    for (let v = 0; v <= 1; v += 0.05) {
      for (const r of [0, 0.5, 0.999]) {
        const l = pickLayer(v, 6, r);
        expect(l).toBeGreaterThanOrEqual(0);
        expect(l).toBeLessThan(6);
      }
    }
  });

  it('only wobbles between neighbouring layers, never jumps', () => {
    for (let v = 0; v <= 1; v += 0.1) {
      const lo = pickLayer(v, 6, 0);
      const hi = pickLayer(v, 6, 0.999);
      expect(hi - lo).toBeLessThanOrEqual(1);
    }
  });

  it('keeps dynamics continuous within a layer', () => {
    expect(velocityGain(1)).toBeCloseTo(1);
    expect(velocityGain(0)).toBeGreaterThan(0.3);
    expect(velocityGain(0.5)).toBeLessThan(velocityGain(0.8));
  });

  it('never plays the same take twice in a row', () => {
    const rr = new RoundRobin();
    let prev = -1;
    for (let i = 0; i < 200; i++) {
      const n = rr.next('snare', 4);
      expect(n).not.toBe(prev);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(4);
      prev = n;
    }
    expect(rr.next('single', 1)).toBe(0);
  });

  it('picks the nearest recorded pitch, preferring the lower one on ties', () => {
    const zones = [{ midi: 21 }, { midi: 24 }, { midi: 27 }, { midi: 30 }];
    expect(nearestZone(zones, 24)?.midi).toBe(24);
    expect(nearestZone(zones, 25)?.midi).toBe(24);
    expect(nearestZone(zones, 26)?.midi).toBe(27);
    expect(nearestZone(zones, 10)?.midi).toBe(21);
    expect(nearestZone([{ midi: 24 }, { midi: 28 }], 26)?.midi).toBe(24);
  });

  it('converts semitones to playback rate', () => {
    expect(semitonesToRate(12)).toBeCloseTo(2);
    expect(semitonesToRate(-12)).toBeCloseTo(0.5);
    expect(semitonesToRate(0)).toBe(1);
  });
});
