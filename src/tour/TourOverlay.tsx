/**
 * Spotlight + coach-mark card for the active tour. The dimming layer never
 * blocks clicks, so the user works with the real controls (and the music
 * keeps playing) while the card explains what to do.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLive } from '@/engine/live';
import { useHelp } from '@/help/helpStore';
import { useStore } from '@/state/store';
import { currentTour, returnToPreviousProject, useTour } from './tourStore';
import type { TaskCtx } from './tours';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 8;
const MARGIN = 12;

function findTarget(id: string | undefined): HTMLElement | null {
  if (!id) return null;
  const els = document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(id)}"]`);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function sameRect(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b;
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
}

/** Place the card beside the target, flipping and clamping to stay on screen. */
function place(t: Rect | null, cw: number, ch: number): { left: number; top: number; side: string } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(vw - cw - MARGIN, Math.max(MARGIN, x));
  const clampY = (y: number) => Math.min(vh - ch - MARGIN, Math.max(MARGIN, y));
  if (!t) return { left: (vw - cw) / 2, top: Math.max(MARGIN, (vh - ch) / 2), side: 'center' };
  const gap = 16;
  if (t.x + t.w + gap + cw <= vw - MARGIN) return { left: t.x + t.w + gap, top: clampY(t.y + t.h / 2 - ch / 2), side: 'right' };
  if (t.x - gap - cw >= MARGIN) return { left: t.x - gap - cw, top: clampY(t.y + t.h / 2 - ch / 2), side: 'left' };
  if (t.y + t.h + gap + ch <= vh - MARGIN) return { left: clampX(t.x + t.w / 2 - cw / 2), top: t.y + t.h + gap, side: 'bottom' };
  if (t.y - gap - ch >= MARGIN) return { left: clampX(t.x + t.w / 2 - cw / 2), top: t.y - gap - ch, side: 'top' };
  // Large target (a whole panel): float inside its lower-right corner.
  return { left: clampX(t.x + t.w - cw - gap), top: clampY(t.y + t.h - ch - gap), side: 'inside' };
}

export function TourOverlay() {
  const active = useTour((s) => s.active);
  const stepIndex = useTour((s) => s.step);
  const seen = useTour((s) => s.seen);
  const baseline = useTour((s) => s.baseline);
  const snapshot = useTour((s) => s.snapshot);
  const prevProjectId = useTour((s) => s.prevProjectId);
  const { next, back, exit, finish, retryStep, markSeen } = useTour.getState();
  const project = useStore((s) => s.project);
  const events = useStore((s) => s.events);
  const toast = useStore((s) => s.toast);
  const playing = useLive((s) => s.playing);
  const fillQueued = useLive((s) => s.fillQueued);
  const building = useLive((s) => s.building);
  const buildQueued = useLive((s) => s.buildQueued);
  const dropQueued = useLive((s) => s.dropQueued);
  const openHelp = useHelp((s) => s.openCenter);

  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; side: string }>({ left: -9999, top: 0, side: 'center' });
  const [missing, setMissing] = useState(false);

  const tour = active ? currentTour() : undefined;
  const step = tour?.steps[stepIndex];

  // Track the target every frame (layouts animate, panels resize, the page scrolls).
  useEffect(() => {
    if (!step) return;
    let raf = 0;
    let last: Rect | null = null;
    let scrolled = false;
    const tick = () => {
      const el = findTarget(step.target);
      let r: Rect | null = null;
      if (el) {
        if (!scrolled) {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          scrolled = true;
        }
        const b = el.getBoundingClientRect();
        r = { x: b.left - PAD, y: b.top - PAD, w: b.width + PAD * 2, h: b.height + PAD * 2 };
      }
      if (!sameRect(r, last)) {
        last = r;
        setRect(r);
      }
      setMissing(!!step.target && !el);
      const card = cardRef.current;
      if (card) {
        const p = place(r, card.offsetWidth, card.offsetHeight);
        setPos((old) => (Math.abs(old.left - p.left) < 0.5 && Math.abs(old.top - p.top) < 0.5 && old.side === p.side ? old : p));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // Move keyboard focus to the card when the step changes.
  useLayoutEffect(() => {
    if (step) titleRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useHelp.getState().centerOpen) {
        exit();
        toast('Lesson paused. Resume it any time from Help.');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, exit, toast]);

  const ctx: TaskCtx | null =
    step && snapshot
      ? {
          project,
          snapshot,
          playing,
          ev: (n) => (events[n] ?? 0) - (baseline[n] ?? 0),
          seen: (k) => seen.includes(k),
          live: { fillQueued, building, buildQueued, dropQueued },
        }
      : null;

  // Tasks stay ticked once done, even if the state later changes back.
  const tasks = step?.tasks ?? [];
  const doneNow = tasks.map((t, i) => seen.includes(`task:${step!.id}:${i}`) || (ctx ? t.done(ctx) : false));
  const doneKey = doneNow.join();
  useEffect(() => {
    if (!step) return;
    const keys = doneNow.flatMap((d, i) => (d ? [`task:${step.id}:${i}`] : []));
    if (keys.length) markSeen(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey, step]);

  if (!tour || !step || !ctx) return null;

  const allDone = doneNow.every(Boolean);
  const total = tour.steps.length;
  const body = typeof step.body === 'function' ? step.body(ctx) : step.body;
  const titleId = 'tour-step-title';

  const leave = () => {
    exit();
    toast('Lesson paused. Resume it any time from Help.');
  };

  return (
    <div className="tour-root learn-exempt" aria-live="polite">
      {rect ? (
        <div className="tour-spot" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} aria-hidden />
      ) : (
        <div className="tour-dim" aria-hidden />
      )}
      <div ref={cardRef} className={`tour-card side-${pos.side} ${step.final ? 'final' : ''}`} style={{ left: pos.left, top: pos.top }} role="dialog" aria-modal="false" aria-labelledby={titleId}>
        <div className="tour-top">
          <span className="tour-lesson">{tour.title}</span>
          <span className="tour-count">
            Step {stepIndex + 1} of {total}
          </span>
        </div>
        <div className="tour-progress" aria-hidden>
          {tour.steps.map((s, i) => (
            <i key={s.id} className={i < stepIndex ? 'past' : i === stepIndex ? 'on' : ''} />
          ))}
        </div>
        {step.final && <div className="tour-confetti" aria-hidden>{'★ ✦ ★'}</div>}
        <h3 id={titleId} ref={titleRef} tabIndex={-1}>
          {step.title}
        </h3>
        <p className="tour-body">{body}</p>
        {missing && <p className="tour-warn">This control is hidden right now. Open the panel from the ☰ menu, or widen the window.</p>}
        {tasks.length > 0 && (
          <ul className="tour-tasks" aria-label="To do">
            {tasks.map((t, i) => (
              <li key={i} className={doneNow[i] ? 'done' : ''}>
                <span className="tick" aria-hidden>{doneNow[i] ? '✓' : ''}</span>
                {t.label}
                <span className="sr-only">{doneNow[i] ? ' (done)' : ' (to do)'}</span>
              </li>
            ))}
          </ul>
        )}
        {tasks.length > 0 && allDone && <p className="tour-success">Nice work! Press Next when you are ready.</p>}
        {step.tip && !allDone && <p className="tour-tip">Tip: {step.tip}</p>}
        <div className="tour-actions">
          {step.final ? (
            <>
              <button className="btn accent" onClick={finish}>Keep jamming</button>
              {prevProjectId && (
                <button className="btn" onClick={() => { finish(); void returnToPreviousProject(); }}>Back to my project</button>
              )}
              <button className="btn ghost" onClick={() => { finish(); openHelp('lessons'); }}>More lessons</button>
            </>
          ) : (
            <>
              {stepIndex > 0 && <button className="btn ghost" onClick={back}>Back</button>}
              {tasks.length > 0 && !allDone && (
                <button className="btn ghost" onClick={retryStep} title="Start this step again">Retry</button>
              )}
              <span className="tour-spacer" />
              <button className="btn ghost" onClick={leave}>Exit</button>
              {tasks.length > 0 && !allDone ? (
                <button key={`skip-${step.id}`} className="btn" onClick={next}>Skip step</button>
              ) : (
                <button key={`next-${step.id}`} className={`btn accent ${tasks.length ? 'pulse' : ''}`} onClick={next}>
                  {stepIndex === 0 ? 'Let’s go' : 'Next'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
