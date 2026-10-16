/** Inline SVG icon set (stroke icons, currentColor). Decorative: always pair with a label or aria-label. */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 18): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

const mk = (d: React.ReactNode) =>
  function Icon({ size, ...rest }: P) {
    return (
      <svg {...base(size)} {...rest}>
        {d}
      </svg>
    );
  };

export const IconPlay = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}>
    <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none" />
  </svg>
);
export const IconStop = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
  </svg>
);
export const IconRecord = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />
  </svg>
);
export const IconRestart = mk(
  <>
    <path d="M6 5v14" />
    <path d="M18 6l-8 6 8 6z" fill="currentColor" />
  </>,
);
export const IconNote = mk(
  <>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </>,
);
export const IconCloud = mk(<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.6 4.2 4.2 0 0 0 7 18z" fill="currentColor" stroke="none" />);
export const IconMenu = mk(
  <>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </>,
);
export const IconSearch = mk(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </>,
);
export const IconStar = mk(<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" />);
export const IconStarFilled = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}>
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" fill="currentColor" />
  </svg>
);
export const IconChevronLeft = mk(<path d="M15 5l-7 7 7 7" />);
export const IconChevronRight = mk(<path d="M9 5l7 7-7 7" />);
export const IconChevronDown = mk(<path d="M6 9l6 6 6-6" />);
export const IconDoubleLeft = mk(
  <>
    <path d="M12 6l-6 6 6 6" />
    <path d="M19 6l-6 6 6 6" />
  </>,
);
export const IconMore = mk(
  <>
    <circle cx="12" cy="5.5" r="1.3" fill="currentColor" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    <circle cx="12" cy="18.5" r="1.3" fill="currentColor" />
  </>,
);
export const IconClose = mk(
  <>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </>,
);
export const IconSparkle = mk(
  <>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" stroke="none" />
    <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" fill="currentColor" stroke="none" />
  </>,
);
export const IconHelp = mk(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.8" />
    <circle cx="12" cy="17.3" r="0.6" fill="currentColor" />
  </>,
);
export const IconLock = mk(
  <>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </>,
);
export const IconUnlock = mk(
  <>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 7.5-1.8" />
  </>,
);
export const IconPlus = mk(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
);
export const IconMinus = mk(<path d="M5 12h14" />);
export const IconUndo = mk(
  <>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </>,
);
export const IconRedo = mk(
  <>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </>,
);
export const IconExport = mk(
  <>
    <path d="M12 3v12" />
    <path d="M7 8l5-5 5 5" />
    <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
  </>,
);
export const IconShare = mk(
  <>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="M8.2 10.8l7.6-4.4" />
    <path d="M8.2 13.2l7.6 4.4" />
  </>,
);
export const IconVideo = mk(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M10 9v6l5-3z" fill="currentColor" />
  </>,
);
export const IconImport = mk(
  <>
    <path d="M12 15V3" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
  </>,
);
export const IconWave = mk(
  <>
    <path d="M3 12h2" />
    <path d="M7 8v8" />
    <path d="M11 4v16" />
    <path d="M15 7v10" />
    <path d="M19 10v4" />
    <path d="M21 12h0" />
  </>,
);
export const IconDice = mk(
  <>
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    <circle cx="9" cy="9" r="1.2" fill="currentColor" />
    <circle cx="15" cy="15" r="1.2" fill="currentColor" />
    <circle cx="15" cy="9" r="1.2" fill="currentColor" />
    <circle cx="9" cy="15" r="1.2" fill="currentColor" />
  </>,
);
export const IconLayout = mk(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
    <path d="M15 4v16" />
  </>,
);
export const IconFocus = mk(
  <>
    <path d="M4 9V5a1 1 0 0 1 1-1h4" />
    <path d="M15 4h4a1 1 0 0 1 1 1v4" />
    <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
    <path d="M9 20H5a1 1 0 0 1-1-1v-4" />
  </>,
);
export const IconGraduation = mk(
  <>
    <path d="M2 9l10-5 10 5-10 5z" />
    <path d="M6 11v5c3 2 9 2 12 0v-5" />
  </>,
);
export const IconBolt = mk(<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none" />);
export const IconTrendUp = mk(
  <>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </>,
);

// ───── instrument role icons ─────
export const IconDrums = mk(
  <>
    <ellipse cx="12" cy="8" rx="8" ry="3" />
    <path d="M4 8v7c0 1.7 3.6 3 8 3s8-1.3 8-3V8" />
    <path d="M8 3l3 4" />
    <path d="M16 3l-3 4" />
  </>,
);
export const IconBass = mk(
  <>
    <path d="M14 4l6 6" />
    <path d="M17 7L8.5 15.5" />
    <path d="M9.5 14.5c-1.8-1.8-5-1-5.5 1.5s1.5 4.5 4 4 3.3-3.7 1.5-5.5z" />
    <path d="M18.5 3.5l2 2" />
  </>,
);
export const IconGuitar = mk(
  <>
    <path d="M13 11l7-7" />
    <path d="M18 3l3 3" />
    <path d="M11 9.5a3 3 0 0 0-4.2.3C4.3 12.3 3 14.6 4.6 17.4c1.6 2.8 4.5 2.5 7 0 1-1 1.3-2.3.7-3.4a2.6 2.6 0 0 0 .7-3.3z" />
    <circle cx="9" cy="15" r="1" fill="currentColor" />
  </>,
);
export const IconKeys = mk(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M8 5v9" />
    <path d="M12 5v9" />
    <path d="M16 5v9" />
    <path d="M3 14h18" />
  </>,
);
export const IconHorn = mk(
  <>
    <path d="M3 10v4h3l7 5V5l-7 5z" />
    <path d="M17 8.5a5 5 0 0 1 0 7" />
    <path d="M19.5 6a8.5 8.5 0 0 1 0 12" />
  </>,
);
export const IconFx = mk(
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4v4" />
    <path d="M12 16v4" />
    <path d="M4 12h4" />
    <path d="M16 12h4" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </>,
);
