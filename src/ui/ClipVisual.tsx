/**
 * Visualisation of a pattern inside a clip card. Drum patterns render as a
 * mirrored, waveform-style display (bar height = drum weight × velocity);
 * pitched parts render as note blocks. A playhead follows the live position.
 */
import { memo, useMemo } from 'react';
import { useLive } from '@/engine/live';
import { patternLength } from '@/music/pattern';
import { mod } from '@/music/theory';
import type { DrumVoice, Pattern } from '@/music/types';

const WEIGHT: Partial<Record<DrumVoice, number>> = {
  kick: 1,
  snare: 0.86,
  clap: 0.8,
  rim: 0.62,
  tomH: 0.72,
  tomM: 0.76,
  tomL: 0.8,
  timbH: 0.66,
  timbL: 0.7,
  crash: 0.9,
  impact: 1,
  riser: 0.55,
  handLo: 0.74,
  congaO: 0.6,
  congaM: 0.5,
  handHi: 0.5,
  bongoL: 0.5,
  ride: 0.42,
  hatO: 0.45,
  hatC: 0.3,
  hatP: 0.25,
  shaker: 0.26,
  tamb: 0.34,
  cowbell: 0.4,
  claves: 0.38,
  siren: 0.6,
  zap: 0.5,
  crackle: 0.2,
  revcrash: 0.6,
  downer: 0.5,
};

const Visual = memo(function Visual({ pattern }: { pattern: Pattern }) {
  const len = patternLength(pattern);
  return useMemo(() => {
    const W = 1000;
    const H = 100;
    const x = (t: number) => (t / len) * W;
    const grid = [];
    for (let s = 0; s <= len; s += 4) {
      grid.push(<line key={`g${s}`} x1={x(s)} x2={x(s)} y1={0} y2={H} className={s % 16 === 0 ? 'cv-bar' : 'cv-beat'} />);
    }
    if (pattern.kind === 'drum') {
      // Merge hits on the same step into one waveform column.
      const cols = new Map<number, number>();
      for (const h of pattern.hits ?? []) {
        const key = Math.round(h.t * 4) / 4;
        const amp = (WEIGHT[h.voice] ?? 0.4) * (0.35 + 0.65 * h.v);
        cols.set(key, Math.min(1, (cols.get(key) ?? 0) + amp * (cols.has(key) ? 0.45 : 1)));
      }
      const bw = Math.max(4, (W / len) * 0.55);
      return (
        <>
          {grid}
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="cv-axis" />
          {[...cols.entries()].map(([t, a]) => {
            const h = Math.max(4, a * (H - 8));
            return <rect key={t} x={x(t)} y={H / 2 - h / 2} width={bw} height={h} rx={bw / 2} className="cv-hit" opacity={0.45 + a * 0.55} />;
          })}
        </>
      );
    }
    const steps = (pattern.notes ?? []).flatMap((n) => (Array.isArray(n.s) ? n.s : [n.s]).map((s) => s + (n.o ?? 0) * 7));
    const lo = Math.min(...steps, 0) - 1;
    const hi = Math.max(...steps, 4) + 1;
    const y = (p: number) => H - ((p - lo) / (hi - lo)) * H;
    const nh = Math.max(6, H / (hi - lo) - 2);
    return (
      <>
        {grid}
        {(pattern.notes ?? []).flatMap((n, i) =>
          (Array.isArray(n.s) ? n.s : [n.s]).map((s, j) => (
            <rect key={`${i}-${j}`} x={x(n.t) + 1} y={y(s + (n.o ?? 0) * 7) - nh / 2} width={Math.max(6, x(n.d) - 3)} height={nh} rx={2.5} className="cv-note" opacity={0.45 + n.v * 0.55} />
          )),
        )}
      </>
    );
  }, [pattern, len]);
});

function Playhead({ trackId, len }: { trackId: string; len: number }) {
  const playing = useLive((s) => s.playing);
  const step = useLive((s) => s.step);
  const lt = useLive((s) => s.tracks[trackId]);
  if (!playing || !lt) return null;
  const frac = mod((step - lt.start) / lt.k, len) / len;
  return <div className="cv-head" style={{ left: `${frac * 100}%` }} />;
}

export function ClipVisual({ pattern, trackId }: { pattern: Pattern | undefined; trackId?: string }) {
  if (!pattern) return <div className="cv cv-empty">Silent: choose a part with Swap</div>;
  return (
    <div className="cv">
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden>
        <Visual pattern={pattern} />
      </svg>
      {trackId && <Playhead trackId={trackId} len={patternLength(pattern)} />}
    </div>
  );
}
