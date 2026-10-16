import { useEffect, useRef, useState, type RefObject } from 'react';
import { engine } from '@/engine/engine';

/**
 * One shared requestAnimationFrame loop drives every meter. Levels are written
 * straight to a CSS custom property (--level, 0..1) so React never re-renders
 * for metering.
 */
type MeterEntry = { el: HTMLElement; read: () => number; last: number };
const meters = new Set<MeterEntry>();
let raf = 0;

const dbToUnit = (db: number) => (Number.isFinite(db) ? Math.min(1, Math.max(0, (db + 54) / 54)) : 0);

function loop() {
  for (const m of meters) {
    const v = dbToUnit(m.read());
    // fast attack, slower release
    m.last = v > m.last ? v : m.last * 0.86 + v * 0.14;
    m.el.style.setProperty('--level', m.last.toFixed(3));
  }
  raf = meters.size ? requestAnimationFrame(loop) : 0;
}

export function useMeter(ref: RefObject<HTMLElement | null>, trackId: string | 'master') {
  useEffect(() => {
    const el = ref.current;
    if (!el || trackId === '__none__') return;
    const entry: MeterEntry = {
      el,
      read: () => (trackId === 'master' ? engine.masterLevel() : engine.trackLevel(trackId)),
      last: 0,
    };
    meters.add(entry);
    if (!raf) raf = requestAnimationFrame(loop);
    return () => {
      meters.delete(entry);
    };
  }, [ref, trackId]);
}

export function useMediaQuery(q: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return match;
}

/** Persist a small UI preference in localStorage (never required to work). */
export function usePref<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`looplab:${key}`);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (v: T) => {
    setVal(v);
    try {
      localStorage.setItem(`looplab:${key}`, JSON.stringify(v));
    } catch {
      /* storage blocked: preference just won't persist */
    }
  };
  return [val, set];
}

export function useLatest<T>(v: T) {
  const r = useRef(v);
  r.current = v;
  return r;
}
