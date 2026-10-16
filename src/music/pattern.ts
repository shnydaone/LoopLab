import type { DrumHit, NoteEvent, Pattern } from './types';
import { STEPS_PER_BAR } from './types';
import { mod } from './theory';

export interface CompiledEvent {
  /** Swung position in pattern steps. */
  t: number;
  hit?: DrumHit;
  note?: NoteEvent;
  /** Note length clipped so it ends before the next note (for mono instruments). */
  monoDur?: number;
}

export interface CompiledPattern {
  id: string;
  len: number;
  events: CompiledEvent[];
}

/** Delay exact odd 16ths by up to a triplet (swing 1 => +1/3 step). */
export function swingTime(t: number, swing: number): number {
  if (swing <= 0) return t;
  if (Number.isInteger(t) && mod(t, 2) === 1) return t + swing / 3;
  return t;
}

export function patternLength(p: Pattern): number {
  return Math.max(1, Math.round(p.bars * STEPS_PER_BAR));
}

export function compilePattern(p: Pattern, extraSwing = 0): CompiledPattern {
  const len = patternLength(p);
  const swing = Math.min(1, Math.max(0, p.swing + extraSwing));
  const events: CompiledEvent[] = [];
  for (const hit of p.hits ?? []) {
    if (hit.t >= 0 && hit.t < len) events.push({ t: swingTime(hit.t, swing), hit });
  }
  for (const note of p.notes ?? []) {
    if (note.t >= 0 && note.t < len) events.push({ t: swingTime(note.t, swing), note });
  }
  events.sort((a, b) => a.t - b.t);
  const noteEvents = events.filter((e) => e.note);
  noteEvents.forEach((e, i) => {
    const next = noteEvents[(i + 1) % noteEvents.length];
    let gap = next.t - e.t;
    if (gap <= 0) gap += len;
    e.monoDur = Math.max(0.1, Math.min(e.note!.d, gap - 0.08));
  });
  return { id: p.id, len, events };
}

export interface WindowEvent {
  ev: CompiledEvent;
  /** Offset from window start, in pattern steps. */
  rel: number;
}

/**
 * Events whose (looped) position lies in [from, from + span) pattern steps.
 * `from` may be any real number; the pattern loops every `len` steps.
 */
export function eventsInWindow(cp: CompiledPattern, from: number, span: number): WindowEvent[] {
  const out: WindowEvent[] = [];
  if (cp.events.length === 0 || span <= 0) return out;
  const a = mod(from, cp.len);
  const eps = 1e-9;
  for (const ev of cp.events) {
    let rel = ev.t - a;
    if (rel < -eps) rel += cp.len;
    if (rel < 0) rel = 0;
    if (rel < span - eps) out.push({ ev, rel });
  }
  out.sort((x, y) => x.rel - y.rel);
  return out;
}
