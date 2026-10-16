import { useRef } from 'react';
import { getPack, packAccent } from '@/content/library';
import { useLive } from '@/engine/live';
import { feelLabel } from '@/music/compat';
import { chordIndexAt, chordName, keyName, progressionSteps } from '@/music/theory';
import { presetById } from '@/engine/instruments/presetInfo';
import { ROLE_META } from '@/project/factory';
import type { TrackState } from '@/project/types';
import { lookupPattern, useStore } from '@/state/store';
import { EnergyDots, Fader, IconBtn } from './controls';
import { useMeter } from './hooks';
import { PatternView } from './PatternView';

function ChordStrip() {
  const harmony = useStore((s) => s.project.harmony);
  const playing = useLive((s) => s.playing);
  const step = useLive((s) => s.step);
  const progStart = useLive((s) => s.progStart);
  const pending = useLive((s) => s.harmonyPending);
  const total = progressionSteps(harmony.progression);
  const idx = playing && !pending ? chordIndexAt(harmony.progression, step - progStart) : -1;
  const bar = playing ? Math.floor(step / 16) + 1 : 1;
  const beat = playing ? (Math.floor(step / 4) % 4) + 1 : 1;
  return (
    <div className="chord-strip">
      <div className="counter mono" aria-label="Bar and beat">
        <span>{String(bar).padStart(3, '0')}</span>
        <i>.</i>
        <span>{beat}</span>
      </div>
      <div className="beats" aria-hidden>
        {[1, 2, 3, 4].map((b) => (
          <i key={b} className={playing && b === beat ? 'on' : ''} />
        ))}
      </div>
      <div className={`chords ${pending ? 'pending' : ''}`}>
        {harmony.progression.map((c, i) => (
          <div
            key={i}
            className={`chord ${i === idx ? 'on' : ''}`}
            style={{ flexGrow: c.bars }}
            title={`${c.bars} bar${c.bars === 1 ? '' : 's'}`}
          >
            {chordName(c, harmony)}
          </div>
        ))}
      </div>
      <div className="muted small mono">{keyName(harmony)} · {total / 16} bars</div>
    </div>
  );
}

function PendingTag({ trackId }: { trackId: string }) {
  const lt = useLive((s) => s.tracks[trackId]);
  const playing = useLive((s) => s.playing);
  const project = useStore((s) => s.project);
  if (!playing || !lt || lt.pendingId === undefined) return null;
  const p = lookupPattern(project, lt.pendingId);
  return (
    <div className="pending-tag">
      <span className="pulse" /> Queued: {p ? p.name : 'silence'}
    </div>
  );
}

function TrackCard({ t, index }: { t: TrackState; index: number }) {
  const project = useStore((s) => s.project);
  const selected = useStore((s) => s.selectedTrackId === t.id);
  const lt = useLive((s) => s.tracks[t.id]);
  const playing = useLive((s) => s.playing);
  const anySolo = project.tracks.some((x) => x.solo);
  const { selectTrack, cyclePattern, toggleMute, toggleSolo, toggleLock, mutateTrack, setTrack, setTrackPattern } =
    useStore.getState();
  const ref = useRef<HTMLDivElement>(null);
  useMeter(ref, t.id);

  // Show what is actually sounding while playing, the target otherwise.
  const shownId = playing && lt ? lt.activeId : t.patternId;
  const pattern = lookupPattern(project, shownId);
  const target = lookupPattern(project, t.patternId);
  const inst = presetById.get(t.instrument ?? target?.instrument ?? '')?.name;
  const accent = target ? packAccent(target.packId) : '#556';
  const silent = t.mute || (anySolo && !t.solo);
  const meta = ROLE_META[t.role];

  return (
    <div
      ref={ref}
      className={`track-card ${selected ? 'selected' : ''} ${silent ? 'silent' : ''} ${!t.patternId ? 'empty' : ''} ${lt?.filling ? 'filling' : ''}`}
      style={{ ['--role' as string]: t.color }}
      onClick={() => selectTrack(t.id)}
      role="group"
      aria-label={`${t.name} track`}
    >
      <div className="tc-glow" aria-hidden />
      <header className="tc-head">
        <span className="tc-icon" aria-hidden>{meta.icon}</span>
        <div className="tc-title">
          <span className="tc-name">{t.name}</span>
          <span className="tc-inst">{inst ?? 'No instrument'}</span>
        </div>
        <span className="tc-key mono" title="Keyboard: select track">{index + 1}</span>
      </header>

      <div className="tc-part">
        <button className="tc-arrow" aria-label="Previous part" onClick={(e) => { e.stopPropagation(); cyclePattern(t.id, -1); }}>‹</button>
        <div className="tc-part-info">
          <div className="tc-part-name">{target?.name ?? 'Empty'}</div>
          <div className="tc-part-meta">
            {target && <span className="genre-tag" style={{ ['--accent' as string]: accent }}>{target.sourceId ? '✦ ' : ''}{target.genre}</span>}
            {lt && lt.k !== 1 && playing && <span className="feel-tag">{feelLabel(lt.k)}</span>}
            {target && <EnergyDots energy={target.energy} color={t.color} />}
          </div>
        </div>
        <button className="tc-arrow" aria-label="Next part" onClick={(e) => { e.stopPropagation(); cyclePattern(t.id, 1); }}>›</button>
      </div>

      <PatternView pattern={pattern ?? target} color={t.color} trackId={t.id} />
      <PendingTag trackId={t.id} />

      <footer className="tc-foot" onClick={(e) => e.stopPropagation()}>
        <IconBtn title={`Mute ${t.name} (M)`} tone="mute" active={t.mute} onClick={() => toggleMute(t.id)}>M</IconBtn>
        <IconBtn title={`Solo ${t.name} (S)`} tone="solo" active={t.solo} onClick={() => toggleSolo(t.id)}>S</IconBtn>
        <IconBtn title={`Lock ${t.name}: Surprise/Remix leave it alone (L)`} tone="lock" active={t.locked} onClick={() => toggleLock(t.id)}>
          {t.locked ? '🔒' : '🔓'}
        </IconBtn>
        <IconBtn title="Generate a variation (V)" tone="accent" disabled={!target} onClick={() => mutateTrack(t.id)}>✦</IconBtn>
        <IconBtn
          title={t.patternId ? `Remove ${t.name} part` : `Add a ${t.name} part`}
          onClick={() => {
            if (t.patternId) setTrackPattern(t.id, null);
            else cyclePattern(t.id, 1);
          }}
        >
          {t.patternId ? '⏻' : '+'}
        </IconBtn>
        <div className="tc-vol">
          <Fader label={`${t.name} volume`} value={t.volume} color={t.color} onChange={(v) => setTrack(t.id, { volume: v }, true)} />
        </div>
        <div className="tc-meter" aria-hidden><i /></div>
      </footer>
    </div>
  );
}

export function Deck() {
  const project = useStore((s) => s.project);
  const { surpriseMe, remixParts, evolveEnergy } = useStore.getState();
  const pack = getPack(project.basePackId);
  const section = pack?.sections.find((s) => s.id === project.sectionId);

  return (
    <div className="panel deck">
      <div className="deck-head">
        <div className="deck-title">
          <div className="muted small">Live Mix</div>
          <h1>
            <span style={{ color: pack?.accent }}>{pack?.name ?? 'Custom'}</span>
            {section && <span className="deck-section"> · {section.name}</span>}
          </h1>
        </div>
        <ChordStrip />
        <div className="deck-actions">
          <button className="btn surprise" onClick={() => surpriseMe()} title="Build a fresh, coherent band (Shift+S)">
            <span aria-hidden>🎲</span> Surprise Me
          </button>
          <button className="btn" onClick={remixParts} title="Re-pick every unlocked part, keep tempo and chords (R)">Remix</button>
          <button className="btn" onClick={() => evolveEnergy(-1)} title="Calmer: lower-energy parts ([)">Energy −</button>
          <button className="btn" onClick={() => evolveEnergy(1)} title="Bigger: higher-energy parts (])">Energy +</button>
        </div>
      </div>
      <div className="deck-grid">
        {project.tracks.map((t, i) => (
          <TrackCard key={t.id} t={t} index={i} />
        ))}
      </div>
      <StartHint />
    </div>
  );
}

function StartHint() {
  const ready = useLive((s) => s.ready);
  const playing = useLive((s) => s.playing);
  const error = useLive((s) => s.error);
  if (error) return <div className="start-hint error">Audio could not start: {error}</div>;
  if (ready || playing) return null;
  return (
    <div className="start-hint">
      Press <kbd>Space</kbd> or the ▶ button to start the band. Then swap parts with the ‹ › arrows; changes land on the next bar.
    </div>
  );
}
