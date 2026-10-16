/** Small reusable controls: knob, fader, segmented switch, icon button. */
import { useRef, type ReactNode } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  color?: string;
  size?: 'sm' | 'md';
  defaultValue?: number;
}

/** Drag vertically, scroll the mouse wheel, or use arrow keys. Hold Shift for fine steps. Double-click resets. */
export function Knob({ label, value, min = 0, max = 1, onChange, format, color, size = 'md', defaultValue }: KnobProps) {
  const start = useRef<{ y: number; v: number } | null>(null);
  const norm = (value - min) / (max - min);
  const angle = -135 + norm * 270;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const step = (max - min) / 100;

  return (
    <div className={`knob knob-${size}`} style={{ ['--knob-color' as string]: color }}>
      <div
        className="knob-dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(3))}
        aria-valuetext={format ? format(value) : undefined}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          start.current = { y: e.clientY, v: value };
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const dy = start.current.y - e.clientY;
          const fine = e.shiftKey ? 0.25 : 1;
          onChange(clamp(start.current.v + (dy / 160) * (max - min) * fine));
        }}
        onPointerUp={() => (start.current = null)}
        onPointerCancel={() => (start.current = null)}
        onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
        onWheel={(e) => onChange(clamp(value - Math.sign(e.deltaY) * step * (e.shiftKey ? 0.5 : 3)))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            onChange(clamp(value + step * 2));
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            onChange(clamp(value - step * 2));
          }
        }}
      >
        <svg viewBox="0 0 40 40" aria-hidden>
          <circle cx="20" cy="20" r="16" className="knob-track" pathLength={100} strokeDasharray="75 100" transform="rotate(135 20 20)" />
          <circle
            cx="20"
            cy="20"
            r="16"
            className="knob-value"
            pathLength={100}
            strokeDasharray={`${norm * 75} 100`}
            transform="rotate(135 20 20)"
          />
          <line x1="20" y1="20" x2="20" y2="8" className="knob-pointer" transform={`rotate(${angle} 20 20)`} />
        </svg>
      </div>
      <div className="knob-label">{label}</div>
      <div className="knob-value-text">{format ? format(value) : Math.round(norm * 100)}</div>
    </div>
  );
}

interface FaderProps {
  value: number;
  onChange: (v: number) => void;
  label: string;
  orient?: 'v' | 'h';
  color?: string;
  max?: number;
}

export function Fader({ value, onChange, label, orient = 'h', color, max = 1.2 }: FaderProps) {
  return (
    <input
      className={`fader fader-${orient}`}
      type="range"
      min={0}
      max={max}
      step={0.005}
      value={value}
      aria-label={label}
      style={{ ['--fader-color' as string]: color, ['--fill' as string]: `${(value / max) * 100}%` }}
      onChange={(e) => onChange(Number(e.target.value))}
      onDoubleClick={() => onChange(0.8)}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}

interface SegProps<T extends string> {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegProps<T>) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function IconBtn({
  children,
  title,
  onClick,
  active,
  className = '',
  disabled,
  tone,
}: {
  children: ReactNode;
  title: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  disabled?: boolean;
  tone?: 'mute' | 'solo' | 'lock' | 'accent';
}) {
  return (
    <button
      className={`ibtn ${active ? 'on' : ''} ${tone ? `tone-${tone}` : ''} ${className}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function EnergyDots({ energy, color }: { energy: number; color?: string }) {
  return (
    <span className="energy" title={`Energy ${energy}/5`} style={{ ['--dot' as string]: color }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= energy ? 'on' : ''} />
      ))}
    </span>
  );
}
