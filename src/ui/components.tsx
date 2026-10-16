/**
 * Premium control library: rotary knob, vertical fader, level meter,
 * segmented switch, icon button. Every control:
 *  - mouse wheel adjusts (Shift = fine), drag adjusts, double-click resets
 *  - arrow keys / Page keys adjust when focused (role="slider")
 *  - shows its current value
 *  - accepts a `help` id for contextual help
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useMeter } from './hooks';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Non-passive wheel listener so adjusting a control never scrolls the page. */
function useWheel(ref: React.RefObject<HTMLElement | null>, handler: (deltaSign: number, fine: boolean) => void) {
  const h = useRef(handler);
  h.current = handler;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (d === 0) return;
      h.current(d < 0 ? 1 : -1, e.shiftKey);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref]);
}

export interface KnobProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  defaultValue?: number;
  help?: string;
  /** Bipolar knobs (pan) draw their arc from the centre. */
  bipolar?: boolean;
  hideLabel?: boolean;
  tour?: string;
}

export function Knob({ label, value, min = 0, max = 1, onChange, format, color = '#8ea2ff', size = 'md', defaultValue, help, bipolar, hideLabel, tour }: KnobProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; v: number } | null>(null);
  const range = max - min;
  const norm = clamp((value - min) / range, 0, 1);
  const step = range / 100;
  const set = (v: number) => onChange(clamp(v, min, max));
  useWheel(dialRef, (dir, fine) => set(value + dir * step * (fine ? 0.5 : 3)));

  // Arc geometry: 270° sweep starting at 135°.
  const R = 16;
  const C = 2 * Math.PI * R;
  const sweep = 0.75;
  const startNorm = bipolar ? 0.5 : 0;
  const a0 = Math.min(startNorm, norm);
  const a1 = Math.max(startNorm, norm);
  const angle = -135 + norm * 270;
  const text = format ? format(value) : `${Math.round(norm * 100)}`;

  return (
    <div className={`knob knob-${size}`} style={{ ['--k' as string]: color }} data-tour={tour}>
      <div
        ref={dialRef}
        className="knob-dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(3))}
        aria-valuetext={text}
        data-help={help}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, v: value };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dy = drag.current.y - e.clientY;
          set(drag.current.v + (dy / 170) * range * (e.shiftKey ? 0.25 : 1));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onDoubleClick={() => defaultValue !== undefined && set(defaultValue)}
        onKeyDown={(e) => {
          const fine = e.shiftKey ? 0.5 : 2;
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(value + step * fine);
          else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(value - step * fine);
          else if (e.key === 'PageUp') set(value + step * 10);
          else if (e.key === 'PageDown') set(value - step * 10);
          else if (e.key === 'Home') set(min);
          else if (e.key === 'End') set(max);
          else if (e.key === 'Delete' || e.key === 'Backspace') defaultValue !== undefined && set(defaultValue);
          else return;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <svg viewBox="0 0 40 40" aria-hidden>
          <circle className="knob-ring" cx="20" cy="20" r={R} strokeDasharray={`${C * sweep} ${C}`} transform="rotate(135 20 20)" />
          <circle
            className="knob-arc"
            cx="20"
            cy="20"
            r={R}
            strokeDasharray={`${C * sweep * (a1 - a0)} ${C}`}
            strokeDashoffset={-C * sweep * a0}
            transform="rotate(135 20 20)"
          />
          <circle className="knob-cap" cx="20" cy="20" r="11.5" />
          <line className="knob-pointer" x1="20" y1="20" x2="20" y2="11" transform={`rotate(${angle} 20 20)`} />
        </svg>
      </div>
      {!hideLabel && <div className="knob-label">{label}</div>}
      <div className="knob-value">{text}</div>
    </div>
  );
}

export const faderDb = (v: number) => (v < 0.005 ? '−∞' : `${(20 * Math.log10(v / 0.8)).toFixed(1)} dB`);

interface FaderProps {
  value: number;
  onChange: (v: number) => void;
  label: string;
  color?: string;
  max?: number;
  defaultValue?: number;
  help?: string;
  meterId?: string;
}

/** Vertical fader with a built-in level meter. */
export function VFader({ value, onChange, label, color = '#8ea2ff', max = 1.2, defaultValue = 0.8, help, meterId }: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  useMeter(meterRef, meterId ?? '__none__');
  const set = (v: number) => onChange(clamp(v, 0, max));
  useWheel(trackRef, (dir, fine) => set(value + dir * (fine ? 0.005 : 0.025)));
  const pct = (value / max) * 100;
  const fromPointer = (clientY: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    set(((r.bottom - clientY) / r.height) * max);
  };
  return (
    <div className="vfader" style={{ ['--k' as string]: color }}>
      {meterId && (
        <div className="vmeter" ref={meterRef} aria-hidden>
          <i />
        </div>
      )}
      <div
        ref={trackRef}
        className="vfader-track"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(3))}
        aria-valuetext={faderDb(value)}
        data-help={help}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          fromPointer(e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons) fromPointer(e.clientY);
        }}
        onDoubleClick={() => set(defaultValue)}
        onKeyDown={(e) => {
          const s = e.shiftKey ? 0.005 : 0.025;
          if (e.key === 'ArrowUp') set(value + s);
          else if (e.key === 'ArrowDown') set(value - s);
          else return;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="vfader-fill" style={{ height: `${pct}%` }} />
        <div className="vfader-zero" style={{ bottom: `${(0.8 / max) * 100}%` }} />
        <div className="vfader-cap" style={{ bottom: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Stand-alone vertical meter (e.g. master, track lanes). */
export function Meter({ id, className = '' }: { id: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useMeter(ref, id);
  return (
    <div className={`vmeter ${className}`} ref={ref} aria-hidden data-help="meter">
      <i />
    </div>
  );
}

interface SegProps<T extends string> {
  value: T;
  options: { value: T; label: ReactNode; help?: string; tour?: string }[];
  onChange: (v: T) => void;
  label: string;
  help?: string;
  className?: string;
}

export function Segmented<T extends string>({ value, options, onChange, label, help, className = '' }: SegProps<T>) {
  return (
    <div className={`seg ${className}`} role="radiogroup" aria-label={label} data-help={help}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          data-help={o.help}
          data-tour={o.tour}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface IconButtonProps {
  label: string;
  help?: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  tour?: string;
  tone?: 'mute' | 'solo' | 'lock' | 'accent' | 'ghost';
  pressed?: boolean;
}

export function IconButton({ label, help, onClick, active, disabled, className = '', children, tour, tone, pressed }: IconButtonProps) {
  return (
    <button
      className={`ibtn ${tone ? `tone-${tone}` : ''} ${active ? 'on' : ''} ${className}`}
      aria-label={label}
      aria-pressed={pressed ?? (active === undefined ? undefined : active)}
      data-help={help}
      data-tour={tour}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function EnergyDots({ energy, color }: { energy: number; color?: string }) {
  return (
    <span className="energy" aria-label={`Energy ${energy} of 5`} style={{ ['--dot' as string]: color }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= energy ? 'on' : ''} />
      ))}
    </span>
  );
}
