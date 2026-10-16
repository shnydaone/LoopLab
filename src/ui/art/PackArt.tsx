/**
 * Original vector artwork for each groove pack (no image assets, no licensing,
 * crisp at any size). Each scene is a small SVG illustration that captures the
 * genre's mood. Used on pack cards, clip cards and instrument headers.
 */
import { memo, useId } from 'react';

interface ArtProps {
  packId: string;
  className?: string;
  /** Optional title for screen readers; omit when the art is decorative. */
  title?: string;
}

function Palm({ x, y, s = 1, flip = false, color = '#140a1c' }: { x: number; y: number; s?: number; flip?: boolean; color?: string }) {
  const f = flip ? -1 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${f * s} ${s})`} fill={color}>
      <path d="M0 0 C 3 -18, 2 -36, 8 -52 L 11 -51 C 6 -35, 7 -18, 4 0 Z" />
      <g transform="translate(9 -52)">
        <path d="M0 0 C -10 -6, -22 -4, -30 4 C -20 -1, -10 -1, 0 2 Z" />
        <path d="M0 0 C -6 -10, -16 -14, -26 -12 C -16 -9, -8 -6, 0 2 Z" />
        <path d="M0 0 C 4 -10, 12 -16, 24 -16 C 14 -11, 7 -6, 1 2 Z" />
        <path d="M0 0 C 10 -4, 22 -2, 30 6 C 20 2, 10 2, 0 3 Z" />
        <path d="M0 0 C 2 -8, 0 -16, -4 -22 C -1 -15, -1 -8, -1 2 Z" />
      </g>
    </g>
  );
}

function Leaf({ x, y, r, s, color }: { x: number; y: number; r: number; s: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 0 C 14 -6, 30 -4, 40 8 C 28 14, 12 12, 0 0 Z" fill={color} />
      <path d="M0 0 C 14 2, 26 4, 38 8" stroke="rgba(0,0,0,.35)" strokeWidth="0.8" fill="none" />
    </g>
  );
}

function Checker({ id, x0, y0, w, h, size, a, b }: { id: string; x0: number; y0: number; w: number; h: number; size: number; a: string; b: string }) {
  return (
    <>
      <defs>
        <pattern id={id} width={size * 2} height={size * 2} patternUnits="userSpaceOnUse">
          <rect width={size * 2} height={size * 2} fill={a} />
          <rect width={size} height={size} fill={b} />
          <rect x={size} y={size} width={size} height={size} fill={b} />
        </pattern>
      </defs>
      <rect x={x0} y={y0} width={w} height={h} fill={`url(#${id})`} />
    </>
  );
}

function Scene({ packId, uid }: { packId: string; uid: string }) {
  const g = (n: string) => `${uid}-${n}`;
  switch (packId) {
    case 'roots-reggae':
      return (
        <>
          <defs>
            <linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3b0f4f" />
              <stop offset="0.45" stopColor="#c2265a" />
              <stop offset="0.75" stopColor="#ff8a3d" />
              <stop offset="1" stopColor="#ffd36b" />
            </linearGradient>
            <linearGradient id={g('sea')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff7a3d" />
              <stop offset="1" stopColor="#3a0d3e" />
            </linearGradient>
          </defs>
          <rect width="160" height="120" fill={`url(#${g('sky')})`} />
          <circle cx="98" cy="72" r="28" fill="#ffe08a" opacity="0.95" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="66" y={78 + i * 5} width="64" height="1.6" fill="#ff8a3d" opacity="0.8" />
          ))}
          <rect y="86" width="160" height="34" fill={`url(#${g('sea')})`} />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={70 + i * 3} y={90 + i * 6} width={56 - i * 8} height="1.2" fill="#ffe08a" opacity={0.6 - i * 0.1} />
          ))}
          <path d="M0 96 C 30 90, 50 92, 70 100 L 70 120 L 0 120 Z" fill="#1a0820" />
          <Palm x={22} y={104} s={1.15} />
          <Palm x={46} y={110} s={0.85} flip />
          <Palm x={140} y={112} s={0.9} flip />
        </>
      );
    case 'militant-steppers':
      return (
        <>
          <rect width="160" height="120" fill="#120a08" />
          <g transform="rotate(-18 80 60)">
            <rect x="-40" y="10" width="260" height="22" fill="#d6262c" />
            <rect x="-40" y="34" width="260" height="22" fill="#f2b31b" />
            <rect x="-40" y="58" width="260" height="22" fill="#1f8a3c" />
          </g>
          <g fill="#0d0d10" stroke="#2a2a33" strokeWidth="1">
            <rect x="96" y="40" width="44" height="74" rx="3" />
            <circle cx="118" cy="62" r="13" fill="#17171d" />
            <circle cx="118" cy="62" r="5" fill="#2b2b35" />
            <circle cx="118" cy="96" r="13" fill="#17171d" />
            <circle cx="118" cy="96" r="5" fill="#2b2b35" />
          </g>
          <g fill="#0d0d10" opacity="0.9">
            <rect x="20" y="70" width="34" height="44" rx="3" />
            <circle cx="37" cy="92" r="11" fill="#1b1b22" />
          </g>
        </>
      );
    case 'dub':
      return (
        <>
          <defs>
            <radialGradient id={g('bg')} cx="0.5" cy="0.55" r="0.75">
              <stop offset="0" stopColor="#5b2a9a" />
              <stop offset="1" stopColor="#0d0820" />
            </radialGradient>
          </defs>
          <rect width="160" height="120" fill={`url(#${g('bg')})`} />
          {[64, 52, 40, 29, 19].map((r, i) => (
            <circle key={r} cx="80" cy="64" r={r} fill="none" stroke="#c39bff" strokeOpacity={0.15 + i * 0.12} strokeWidth={1.2 + i * 0.3} />
          ))}
          <circle cx="80" cy="64" r="12" fill="#1a0f30" stroke="#d9c2ff" strokeWidth="1.5" />
          <circle cx="80" cy="64" r="4" fill="#d9c2ff" />
          {[
            [18, 18],
            [140, 22],
            [130, 100],
            [28, 98],
            [60, 12],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1" fill="#fff" opacity="0.7" />
          ))}
        </>
      );
    case 'rocksteady':
      return (
        <>
          <defs>
            <radialGradient id={g('glow')} cx="0.5" cy="0.5" r="0.7">
              <stop offset="0" stopColor="#ffcf5a" />
              <stop offset="1" stopColor="#5a2b07" />
            </radialGradient>
          </defs>
          <rect width="160" height="120" fill={`url(#${g('glow')})`} />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d={`M80 60 L ${80 + 140 * Math.cos((i * Math.PI) / 6)} ${60 + 140 * Math.sin((i * Math.PI) / 6)} L ${80 + 140 * Math.cos((i * Math.PI) / 6 + 0.18)} ${60 + 140 * Math.sin((i * Math.PI) / 6 + 0.18)} Z`} fill="#fff3c4" opacity="0.12" />
          ))}
          <circle cx="80" cy="60" r="42" fill="#111" />
          {[38, 33, 28, 23].map((r) => (
            <circle key={r} cx="80" cy="60" r={r} fill="none" stroke="#2a2a2a" strokeWidth="0.8" />
          ))}
          <circle cx="80" cy="60" r="14" fill="#e8a33a" />
          <circle cx="80" cy="60" r="2" fill="#111" />
          <path d="M58 38 A 30 30 0 0 1 96 32" stroke="#fff" strokeOpacity="0.25" strokeWidth="2" fill="none" />
        </>
      );
    case 'kingston-ska':
      return (
        <>
          <defs>
            <linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0b2a5a" />
              <stop offset="1" stopColor="#1a6fb5" />
            </linearGradient>
          </defs>
          <rect width="160" height="120" fill={`url(#${g('sky')})`} />
          <g transform="translate(80 120) scale(1 0.42) translate(-80 -120)">
            <Checker id={g('ck')} x0={-40} y0={60} w={240} h={60} size={14} a="#f2f2f2" b="#101418" />
          </g>
          <g fill="#0a1224" transform="translate(30 30) rotate(-12)">
            <path d="M0 22 L 62 22 L 62 30 L 0 30 Z" />
            <path d="M62 14 L 96 4 L 96 48 L 62 38 Z" />
            <rect x="18" y="12" width="6" height="12" rx="2" />
            <rect x="28" y="12" width="6" height="12" rx="2" />
            <rect x="38" y="12" width="6" height="12" rx="2" />
          </g>
        </>
      );
    case 'two-tone-ska':
      return (
        <>
          <Checker id={g('ck')} x0={0} y0={0} w={160} h={120} size={16} a="#f4f4f4" b="#0d0d0f" />
          <rect x="0" y="0" width="160" height="120" fill="#000" opacity="0.15" />
          <path d="M0 98 L 160 54 L 160 70 L 0 114 Z" fill="#ff5fa2" />
          <g transform="translate(104 18) rotate(32)" fill="#141414" stroke="#f4f4f4" strokeWidth="1.5">
            <path d="M0 0 L 8 0 L 8 46 L 0 46 Z" />
            <path d="M-12 46 C -20 54, -18 74, -4 78 C 2 80, 6 80, 12 78 C 26 74, 28 54, 20 46 Z" />
            <circle cx="4" cy="62" r="4" fill="#f4f4f4" />
          </g>
        </>
      );
    case 'jungle':
      return (
        <>
          <defs>
            <linearGradient id={g('bg')} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0f3b1a" />
              <stop offset="1" stopColor="#03140a" />
            </linearGradient>
          </defs>
          <rect width="160" height="120" fill={`url(#${g('bg')})`} />
          <path d="M60 0 L 90 0 L 140 120 L 70 120 Z" fill="#b6ff3b" opacity="0.08" />
          <Leaf x={-6} y={30} r={-20} s={1.6} color="#1f7a33" />
          <Leaf x={10} y={90} r={-40} s={1.9} color="#2c9a42" />
          <Leaf x={150} y={20} r={160} s={1.7} color="#237f38" />
          <Leaf x={168} y={92} r={200} s={2} color="#30a84a" />
          <Leaf x={70} y={118} r={-80} s={1.4} color="#1b6b2d" />
          <Leaf x={40} y={8} r={30} s={1.1} color="#3fc25a" />
          <Leaf x={120} y={60} r={140} s={1.2} color="#46d062" />
          <circle cx="80" cy="56" r="3" fill="#b6ff3b" opacity="0.8" />
        </>
      );
    case 'trip-hop':
      return (
        <>
          <defs>
            <linearGradient id={g('bg')} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1b2b5e" />
              <stop offset="0.6" stopColor="#0c1230" />
              <stop offset="1" stopColor="#2a1408" />
            </linearGradient>
          </defs>
          <rect width="160" height="120" fill={`url(#${g('bg')})`} />
          <circle cx="112" cy="36" r="18" fill="#e2c49a" opacity="0.85" />
          <circle cx="104" cy="32" r="18" fill="#101834" opacity="0.6" />
          <path
            d="M44 120 C 40 104, 30 96, 34 84 C 30 80, 32 76, 36 74 C 34 70, 36 66, 40 64 C 38 54, 42 40, 56 34 C 72 28, 90 36, 92 54 C 94 66, 88 74, 86 82 C 84 92, 90 104, 92 120 Z"
            fill="#05070f"
          />
          <path d="M60 50 C 66 46, 74 48, 76 54" stroke="#3b5bbf" strokeWidth="1.2" fill="none" opacity="0.6" />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={120 + i * 8} cy={84 - i * 14} r={6 + i * 3} fill="none" stroke="#e2a46b" strokeOpacity={0.25 - i * 0.06} />
          ))}
        </>
      );
    case 'classic-house':
      return (
        <>
          <defs>
            <linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#12062e" />
              <stop offset="0.55" stopColor="#5b1a8e" />
              <stop offset="1" stopColor="#ff4fd8" />
            </linearGradient>
          </defs>
          <rect width="160" height="120" fill={`url(#${g('sky')})`} />
          <circle cx="80" cy="66" r="26" fill="#ffb347" opacity="0.85" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="50" y={70 + i * 5} width="60" height="2" fill="#5b1a8e" />
          ))}
          <path d="M80 22 L 112 78 L 48 78 Z" fill="none" stroke="#5ff2ff" strokeWidth="2.5" />
          <path d="M80 22 L 112 78 L 48 78 Z" fill="none" stroke="#5ff2ff" strokeWidth="7" strokeOpacity="0.2" />
          <rect y="82" width="160" height="38" fill="#14052e" />
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M80 82 L ${-60 + i * 35} 120`} stroke="#ff4fd8" strokeOpacity="0.55" strokeWidth="0.8" />
          ))}
          {[86, 92, 100, 110].map((y) => (
            <path key={y} d={`M0 ${y} L 160 ${y}`} stroke="#ff4fd8" strokeOpacity="0.45" strokeWidth="0.8" />
          ))}
        </>
      );
    default:
      return (
        <>
          <rect width="160" height="120" fill="#1b2340" />
          <circle cx="80" cy="60" r="30" fill="#8ea2ff" opacity="0.4" />
        </>
      );
  }
}

export const PackArt = memo(function PackArt({ packId, className = '', title }: ArtProps) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      className={`pack-art ${className}`}
      viewBox="0 0 160 120"
      preserveAspectRatio="xMidYMid slice"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <Scene packId={packId} uid={uid} />
    </svg>
  );
});
