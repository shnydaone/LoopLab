/**
 * Global contextual help. Any element with `data-help="<id>"` gets a tooltip
 * on hover or keyboard focus, sized to the user's help level. On touch,
 * long-press shows it; in Learn mode a tap explains a control instead of
 * using it. One listener for the whole app: components only add data-help.
 */
import { useEffect, useRef, useState } from 'react';
import { HELP, type HelpEntry } from './content';
import { useHelp, type HelpLevel } from './helpStore';

interface Shown {
  id: string;
  entry: HelpEntry;
  rect: DOMRect;
  pinned: boolean;
  extra?: string;
}

const DELAY: Record<HelpLevel, number> = { beginner: 380, standard: 520, expert: 1000 };
const TOOLTIP_ID = 'looplab-help-tooltip';

function helpTarget(el: EventTarget | null): HTMLElement | null {
  if (!(el instanceof Element)) return null;
  return el.closest<HTMLElement>('[data-help]');
}

export function HelpLayer() {
  const level = useHelp((s) => s.level);
  const learnMode = useHelp((s) => s.learnMode);
  const [shown, setShown] = useState<Shown | null>(null);
  const timer = useRef<number | null>(null);
  const current = useRef<HTMLElement | null>(null);
  const longPress = useRef<{ timer: number; fired: boolean } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(false);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
    };
    const hide = () => {
      clear();
      current.current?.removeAttribute('aria-describedby');
      current.current = null;
      setShown(null);
    };
    const show = (el: HTMLElement, pinned: boolean) => {
      const id = el.dataset.help!;
      const entry = HELP[id];
      if (!entry) return;
      current.current?.removeAttribute('aria-describedby');
      current.current = el;
      el.setAttribute('aria-describedby', TOOLTIP_ID);
      setShown({ id, entry, rect: el.getBoundingClientRect(), pinned, extra: el.dataset.helpExtra });
    };
    const schedule = (el: HTMLElement, delay: number) => {
      clear();
      timer.current = window.setTimeout(() => show(el, false), delay);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = helpTarget(e.target);
      if (!el) return;
      if (el === current.current) return;
      if (shownPinned()) return;
      schedule(el, DELAY[useHelp.getState().level]);
    };
    const onOut = (e: PointerEvent) => {
      if (shownPinned()) return;
      const to = helpTarget(e.relatedTarget);
      if (to && to === current.current) return;
      const from = helpTarget(e.target);
      if (from && from.contains(e.relatedTarget as Node)) return;
      hide();
    };
    const onFocus = (e: FocusEvent) => {
      const el = helpTarget(e.target);
      if (el && (e.target as HTMLElement).matches(':focus-visible')) schedule(el, 250);
    };
    const onBlur = () => {
      if (!shownPinned()) hide();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    const onScroll = () => {
      if (!shownPinned()) hide();
    };
    const onDown = (e: PointerEvent) => {
      // Any pointer down elsewhere dismisses a pinned tooltip.
      if (shownPinned() && !tipRef.current?.contains(e.target as Node)) hide();
      if (e.pointerType !== 'touch') {
        clear();
        return;
      }
      const el = helpTarget(e.target);
      if (!el) return;
      const lp = { timer: 0, fired: false };
      lp.timer = window.setTimeout(() => {
        lp.fired = true;
        show(el, true);
      }, 520);
      longPress.current = lp;
    };
    const onUp = () => {
      if (longPress.current && !longPress.current.fired) window.clearTimeout(longPress.current.timer);
    };
    const onClick = (e: MouseEvent) => {
      // Long-press already explained the control: swallow the click it would cause.
      if (longPress.current?.fired) {
        longPress.current = null;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!useHelp.getState().learnMode) return;
      const target = e.target as Element;
      if (target.closest('.learn-exempt')) return;
      const el = helpTarget(target);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      show(el, true);
    };

    const shownPinned = () => pinnedRef.current;

    document.addEventListener('pointerover', onOver, true);
    document.addEventListener('pointerout', onOut, true);
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('focusout', onBlur, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('click', onClick, true);
    return () => {
      clear();
      document.removeEventListener('pointerover', onOver, true);
      document.removeEventListener('pointerout', onOut, true);
      document.removeEventListener('focusin', onFocus, true);
      document.removeEventListener('focusout', onBlur, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  useEffect(() => {
    pinnedRef.current = !!shown?.pinned;
  }, [shown]);

  // Position after render so we know the tooltip's size; keep it on screen.
  useEffect(() => {
    if (!shown || !tipRef.current) {
      setPos(null);
      return;
    }
    const tip = tipRef.current.getBoundingClientRect();
    const r = shown.rect;
    const margin = 10;
    let left = r.left + r.width / 2 - tip.width / 2;
    left = Math.max(margin, Math.min(window.innerWidth - tip.width - margin, left));
    let top = r.bottom + 10;
    let above = false;
    if (top + tip.height > window.innerHeight - margin) {
      top = r.top - tip.height - 10;
      above = true;
    }
    top = Math.max(margin, top);
    setPos({ left, top, above });
  }, [shown, level]);

  if (!shown) return null;
  const { entry } = shown;
  const rich = level === 'beginner' || shown.pinned;
  return (
    <div
      ref={tipRef}
      id={TOOLTIP_ID}
      role="tooltip"
      className={`help-tip ${rich ? 'rich' : 'brief'} ${shown.pinned ? 'pinned' : ''} ${pos?.above ? 'above' : ''}`}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
    >
      <div className="help-tip-title">{entry.title}</div>
      <p className="help-tip-what">{entry.what}</p>
      {shown.extra && <p className="help-tip-extra">{shown.extra}</p>}
      {entry.status && <p className="help-tip-status">{entry.status}</p>}
      {rich && entry.does && <p className="help-tip-row"><b>What it does</b> {entry.does}</p>}
      {rich && entry.how && <p className="help-tip-row"><b>How</b> {entry.how}</p>}
      {rich && entry.when && <p className="help-tip-row"><b>When</b> {entry.when}</p>}
      {!rich && (entry.how || entry.does) && level === 'standard' && <p className="help-tip-more">Switch help to Beginner for more detail.</p>}
      {learnMode && <p className="help-tip-more">Learn mode is on: tap controls to read about them.</p>}
    </div>
  );
}
