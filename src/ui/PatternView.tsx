import { memo, useMemo } from 'react';
import { useLive } from '@/engine/live';
import { patternLength } from '@/music/pattern';
import { mod } from '@/music/theory';
import type { DrumVoice, Pattern } from '@/music/types';

const VOICE_ORDER: DrumVoice[] = [
  'crash', 'ride', 'hatO', 'hatC', 'shaker', 'tamb', 'cowbell', 'clap', 'siren', 'tomH', 'tomM', 'tomL', 'handHi', 'snare', 'rim', 'handLo', 'kick',
];

const PatternSvg = memo(function PatternSvg({ pattern, color }: { pattern: Pattern; color: string }) {
  const len = patternLength(pattern);
  const content = useMemo(() => {
    const W = 1000;
    const H = 100;
    const x = (t: number) => (t / len) * W;
    const beatLines = [];
    for (let s = 0; s <= len; s += 4) {
      beatLines.push(
        <line key={`b${s}`} x1={x(s)} x2={x(s)} y1={0} y2={H} className={s % 16 === 0 ? 'pv-bar' : 'pv-beat'} />,
      );
    }
    if (pattern.kind === 'drum') {
      const voices = VOICE_ORDER.filter((v) => pattern.hits?.some((h) => h.voice === v));
      const rowH = H / Math.max(voices.length, 1);
      return (
        <>
          {beatLines}
          {(pattern.hits ?? []).map((h, i) => {
            const row = voices.indexOf(h.voice);
            const w = Math.max(6, (W / len) * 0.62);
            return (
              <rect
                key={i}
                x={x(h.t) + 1}
                y={row * rowH + rowH * 0.18}
                width={w}
                height={rowH * 0.64}
                rx={2}
                fill={color}
                opacity={0.25 + h.v * 0.75}
              />
            );
          })}
        </>
      );
    }
    const pitches = (pattern.notes ?? []).flatMap((n) =>
      (Array.isArray(n.s) ? n.s : [n.s]).map((s) => s + (n.o ?? 0) * 7),
    );
    const lo = Math.min(...pitches, 0) - 1;
    const hi = Math.max(...pitches, 4) + 1;
    const y = (p: number) => H - ((p - lo) / (hi - lo)) * H;
    const noteH = Math.max(5, H / (hi - lo) - 1.5);
    return (
      <>
        {beatLines}
        {(pattern.notes ?? []).flatMap((n, i) =>
          (Array.isArray(n.s) ? n.s : [n.s]).map((s, j) => (
            <rect
              key={`${i}-${j}`}
              x={x(n.t) + 1}
              y={y(s + (n.o ?? 0) * 7) - noteH / 2}
              width={Math.max(5, x(n.d) - 2)}
              height={noteH}
              rx={2}
              fill={color}
              opacity={0.35 + n.v * 0.65}
            />
          )),
        )}
      </>
    );
  }, [pattern, color, len]);

  return (
    <svg className="pv-svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden>
      {content}
    </svg>
  );
});

function Playhead({ trackId, len }: { trackId: string; len: number }) {
  const playing = useLive((s) => s.playing);
  const step = useLive((s) => s.step);
  const lt = useLive((s) => s.tracks[trackId]);
  if (!playing || !lt) return null;
  const frac = mod((step - lt.start) / lt.k, len) / len;
  return <div className="pv-head" style={{ left: `${frac * 100}%` }} />;
}

export function PatternView({ pattern, color, trackId }: { pattern: Pattern | undefined; color: string; trackId?: string }) {
  if (!pattern) {
    return (
      <div className="pv pv-empty">
        <span>Empty: pick a part</span>
      </div>
    );
  }
  return (
    <div className="pv">
      <PatternSvg pattern={pattern} color={color} />
      {trackId && <Playhead trackId={trackId} len={patternLength(pattern)} />}
    </div>
  );
}
