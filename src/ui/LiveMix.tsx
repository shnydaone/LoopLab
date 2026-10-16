import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { getPack, patternsForRole } from '@/content/library';
import { presetById } from '@/engine/instruments/presetInfo';
import { useLive } from '@/engine/live';
import { feelLabel } from '@/music/compat';
import { chordIndexAt, chordName, keyName } from '@/music/theory';
import type { Role } from '@/music/types';
import { ROLE_META } from '@/project/factory';
import { QUANTIZE_STEPS, type Quantize, type TrackState } from '@/project/types';
import { lookupPattern, useStore } from '@/state/store';
import { useUi, type CenterTab } from '@/state/ui';
import { PackArt } from './art/PackArt';
import { ClipVisual } from './ClipVisual';
import { EnergyDots, faderDb, Knob } from './components';
import { IconBass, IconDoubleLeft, IconDrums, IconFx, IconGuitar, IconHorn, IconKeys, IconLock, IconMore, IconSparkle } from './icons';
import { useDismiss } from './ProjectMenu';
import { History } from './Dock';

export const ROLE_ICON: Record<Role, (p: { size?: number }) => ReactNode> = {
  drums: IconDrums,
  bass: IconBass,
  guitar: IconGuitar,
  keys: IconKeys,
  horns: IconHorn,
  perc: IconFx,
};

/** Steps until the next launch boundary, as friendly text. */
function useCountdown(): string | null {
  const playing = useLive((s) => s.playing);
  const step = useLive((s) => s.step);
  const quantize = useStore((s) => s.project.quantize);
  if (!playing) return null;
  const q = QUANTIZE_STEPS[quantize];
  const left = q - ((step + 1) % q);
  const beats = Math.ceil(left / 4);
  if (left <= 1) return 'starting now';
  if (beats <= 1) return 'on the next beat';
  return `in ${beats} beats`;
}

/**
 * A popover anchored to a button with fixed positioning, so scrolling
 * containers never clip it. Opens upward near the bottom of the screen.
 */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  useDismiss(ref, () => setOpen(false));
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const up = r.bottom > vh * 0.55;
    setStyle({
      position: 'fixed',
      right: Math.max(8, window.innerWidth - r.right),
      ...(up ? { bottom: vh - r.top + 6, maxHeight: r.top - 16 } : { top: r.bottom + 6, maxHeight: vh - r.bottom - 16 }),
    });
    const close = (e: Event) => {
      if (!(e.target instanceof Node) || !ref.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  return { open, setOpen, ref, style };
}

function SwapMenu({ t, onClose }: { t: TrackState; onClose: () => void }) {
  const project = useStore((s) => s.project);
  const setTrackPattern = useStore((s) => s.setTrackPattern);
  const pool = patternsForRole(t.role, project.userPatterns);
  const byPack = new Map<string, typeof pool>();
  for (const p of pool) {
    const key = p.sourceId ? 'yours' : p.packId;
    if (!byPack.has(key)) byPack.set(key, []);
    byPack.get(key)!.push(p);
  }
  return (
    <div className="popover swap-menu" role="menu" aria-label={`Choose a ${ROLE_META[t.role].name} part`}>
      <div className="swap-head">
        Choose a part <small>It starts on the next {project.quantize === 'beat' ? 'beat' : 'bar'}</small>
      </div>
      <button className={`swap-item ${!t.patternId ? 'on' : ''}`} role="menuitem" onClick={() => { setTrackPattern(t.id, null); onClose(); }}>
        <span className="swap-name">Silence</span>
      </button>
      {[...byPack.entries()].map(([pack, list]) => (
        <div key={pack} className="swap-group">
          <div className="swap-pack">
            {pack !== 'yours' && <PackArt packId={pack} className="swap-art" />}
            {pack === 'yours' ? 'Your variations' : getPack(pack)?.name}
          </div>
          {list.map((p) => (
            <button key={p.id} role="menuitem" className={`swap-item ${p.id === t.patternId ? 'on' : ''}`} onClick={() => { setTrackPattern(t.id, p.id); onClose(); }}>
              <span className="swap-name">{p.name}</span>
              <EnergyDots energy={p.energy} color={ROLE_META[t.role].color} />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function MoreMenu({ t, onClose }: { t: TrackState; onClose: () => void }) {
  const project = useStore((s) => s.project);
  const s = useStore.getState();
  const setUi = useUi((x) => x.set);
  const p = lookupPattern(project, t.patternId);
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };
  return (
    <div className="popover menu more-menu" role="menu">
      <button role="menuitem" disabled={!p} onClick={act(() => s.mutateTrack(t.id))} data-help="variation">✦ New variation</button>
      <button role="menuitem" disabled={!p?.sourceId} onClick={act(() => s.revertTrack(t.id))}>↺ Back to the original part</button>
      <button role="menuitem" onClick={act(() => s.toggleLock(t.id))} data-help="lock">{t.locked ? 'Unlock track' : 'Lock track'}</button>
      <button role="menuitem" onClick={act(() => (t.patternId ? s.setTrackPattern(t.id, null) : s.cyclePattern(t.id, 1)))}>{t.patternId ? 'Remove part (silence)' : 'Add a part'}</button>
      <button role="menuitem" onClick={act(() => { s.selectTrack(t.id); setUi({ labTab: 'instrument' }); })} data-help="instrument">Change instrument sound…</button>
    </div>
  );
}

function TrackLane({ t, index }: { t: TrackState; index: number }) {
  const project = useStore((s) => s.project);
  const selected = useStore((s) => s.selectedTrackId === t.id);
  const lt = useLive((s) => s.tracks[t.id]);
  const playing = useLive((s) => s.playing);
  const countdown = useCountdown();
  const anySolo = project.tracks.some((x) => x.solo);
  const s = useStore.getState();
  const swap = useDropdown();
  const more = useDropdown();
  const meta = ROLE_META[t.role];
  const Icon = ROLE_ICON[t.role];
  const target = lookupPattern(project, t.patternId);
  const shown = playing && lt ? lookupPattern(project, lt.activeId) ?? target : target;
  const pending = playing && lt && lt.pendingId !== undefined ? lookupPattern(project, lt.pendingId) : undefined;
  const isPending = playing && lt && lt.pendingId !== undefined;
  const silent = t.mute || (anySolo && !t.solo);
  const inst = presetById.get(t.instrument ?? target?.instrument ?? '')?.name;
  const pack = target ? getPack(target.packId) : undefined;

  // Briefly highlight the lane when a swap actually lands.
  const [swapped, setSwapped] = useState(false);
  const prevActive = useRef(lt?.activeId);
  useEffect(() => {
    if (prevActive.current !== undefined && lt?.activeId !== prevActive.current && playing) {
      setSwapped(true);
      const tm = window.setTimeout(() => setSwapped(false), 1300);
      prevActive.current = lt?.activeId;
      return () => window.clearTimeout(tm);
    }
    prevActive.current = lt?.activeId;
  }, [lt?.activeId, playing]);

  return (
    <div
      className={`lane ${selected ? 'selected' : ''} ${silent ? 'silent' : ''} ${t.mute ? 'muted' : ''} ${swapped ? 'swapped' : ''} ${!t.patternId ? 'no-part' : ''} ${lt?.filling ? 'filling' : ''}`}
      style={{ ['--role' as string]: meta.color }}
      onClick={() => s.selectTrack(t.id)}
      role="group"
      aria-label={`${meta.name} track`}
      data-tour={`lane-${t.role}`}
      data-help="track"
    >
      <div className="lane-num" aria-hidden>
        <span>{index + 1}</span>
      </div>
      <div className="lane-icon" aria-hidden>
        <Icon size={22} />
      </div>
      <div className="lane-title">
        <div className="lane-name">{meta.name}</div>
        <div className="lane-inst">{inst ?? 'No instrument'}</div>
        {t.locked && (
          <div className="lane-lock" data-help="lock">
            <IconLock size={12} /> locked
          </div>
        )}
      </div>
      <div className="lane-ms" onClick={(e) => e.stopPropagation()}>
        <button className={`ms mute ${t.mute ? 'on' : ''}`} aria-pressed={t.mute} aria-label={`Mute ${meta.name}`} data-help="mute" data-tour={`mute-${t.role}`} onClick={() => s.toggleMute(t.id)}>M</button>
        <button className={`ms solo ${t.solo ? 'on' : ''}`} aria-pressed={t.solo} aria-label={`Solo ${meta.name}`} data-help="solo" data-tour={`solo-${t.role}`} onClick={() => s.toggleSolo(t.id)}>S</button>
      </div>
      <div className="lane-knob" onClick={(e) => e.stopPropagation()}>
        <Knob
          label={`${meta.name} volume`}
          hideLabel
          size="sm"
          value={t.volume}
          max={1.2}
          defaultValue={0.8}
          color={meta.color}
          format={faderDb}
          onChange={(v) => s.setTrack(t.id, { volume: v }, true)}
          help="volume"
          tour={`volume-${t.role}`}
        />
      </div>
      <div className="clip" data-help="clip" data-tour={`clip-${t.role}`}>
        <div className="clip-head">
          <span className="clip-name">{shown?.name ?? 'Silent'}</span>
          {shown?.sourceId && <span className="clip-badge variation" data-help="variation"><IconSparkle size={12} /> variation</span>}
          {lt && lt.k !== 1 && playing && <span className="clip-badge feel" data-help="feel">{feelLabel(lt.k)}</span>}
          <span className="clip-spacer" />
          {pack && <span className="clip-badge genre" style={{ ['--accent' as string]: pack.accent }} data-help="genre-chip">{target?.genre}</span>}
          {shown && <span className="clip-bars">{shown.bars} {shown.bars === 1 ? 'Bar' : 'Bars'}</span>}
        </div>
        <ClipVisual pattern={shown} trackId={t.id} />
        {isPending && (
          <div className="clip-queued" data-help="queued">
            <span className="pulse" /> Next: <b>{pending?.name ?? 'silence'}</b> {countdown}
          </div>
        )}
        {t.mute && <div className="clip-muted">Muted</div>}
      </div>
      <div className="lane-art" aria-hidden>
        {pack ? <PackArt packId={pack.id} /> : <div className="art-empty" />}
      </div>
      <div className="lane-actions" onClick={(e) => e.stopPropagation()}>
        <button className="ibtn" aria-label={`Previous ${meta.name} part`} data-help="prev-part" onClick={() => s.cyclePattern(t.id, -1)}>
          <IconDoubleLeft size={16} />
        </button>
        <div className="menu-wrap" ref={swap.ref}>
          <button className="btn swap-btn" aria-haspopup="menu" aria-expanded={swap.open} data-help="swap" data-tour={`swap-${t.role}`} onClick={() => swap.setOpen(!swap.open)}>
            Swap
          </button>
          {swap.open && (
            <div className="dropdown-anchor" style={swap.style}>
              <SwapMenu t={t} onClose={() => swap.setOpen(false)} />
            </div>
          )}
        </div>
        <div className="menu-wrap" ref={more.ref}>
          <button className="ibtn" aria-label={`More ${meta.name} options`} aria-haspopup="menu" aria-expanded={more.open} data-help="track-more" onClick={() => more.setOpen(!more.open)}>
            <IconMore size={16} />
          </button>
          {more.open && (
            <div className="dropdown-anchor" style={more.style}>
              <MoreMenu t={t} onClose={() => more.setOpen(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChordStrip() {
  const harmony = useStore((s) => s.project.harmony);
  const playing = useLive((s) => s.playing);
  const step = useLive((s) => s.step);
  const progStart = useLive((s) => s.progStart);
  const pending = useLive((s) => s.harmonyPending);
  const idx = playing && !pending ? chordIndexAt(harmony.progression, step - progStart) : -1;
  const bar = playing ? Math.floor(step / 16) + 1 : 1;
  const beat = playing ? (Math.floor(step / 4) % 4) + 1 : 1;
  return (
    <div className="chords" data-help="key">
      <span className="counter mono" aria-label={`Bar ${bar}, beat ${beat}`}>
        {String(bar).padStart(3, '0')}.{beat}
      </span>
      <span className="beat-dots" aria-hidden>
        {[1, 2, 3, 4].map((b) => (
          <i key={b} className={playing && b === beat ? 'on' : ''} />
        ))}
      </span>
      <span className={`chord-row ${pending ? 'pending' : ''}`}>
        {harmony.progression.map((c, i) => (
          <span key={i} className={`chord ${i === idx ? 'on' : ''}`} style={{ flexGrow: c.bars }}>
            {chordName(c, harmony)}
          </span>
        ))}
      </span>
      <span className="key-name">{keyName(harmony)}</span>
    </div>
  );
}

function PatternView() {
  const project = useStore((s) => s.project);
  const sel = useStore((s) => s.selectedTrackId);
  const s = useStore.getState();
  const t = project.tracks.find((x) => x.id === sel) ?? project.tracks[0];
  const p = lookupPattern(project, t.patternId);
  const meta = ROLE_META[t.role];
  const pool = patternsForRole(t.role, project.userPatterns);
  return (
    <div className="pattern-view" style={{ ['--role' as string]: meta.color }}>
      <div className="pv-head">
        <h3>{meta.name}: {p?.name ?? 'Silent'}</h3>
        {p && <p className="muted">{p.genre} · {p.bars} bar{p.bars > 1 ? 's' : ''} · written at {p.bpm} BPM · swing {Math.round(p.swing * 100)}% · {p.description}</p>}
      </div>
      <div className="pv-big clip">
        <ClipVisual pattern={p} trackId={t.id} />
      </div>
      <div className="pv-list">
        {pool.map((x) => (
          <button key={x.id} className={`chip ${x.id === t.patternId ? 'on' : ''}`} onClick={() => s.setTrackPattern(t.id, x.id)} style={{ ['--accent' as string]: getPack(x.packId)?.accent }} data-help="part">
            {x.name}
          </button>
        ))}
      </div>
      <p className="muted small">Editing notes directly (piano roll and step sequencer) arrives with Sound Lab editing in Phase 3. Today, use ✦ variations and the Sound Lab controls.</p>
    </div>
  );
}

function SendsView() {
  const tracks = useStore((s) => s.project.tracks);
  const setFx = useStore((s) => s.setFx);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div className="sends-view" data-help="sends">
      {tracks.map((t) => {
        const meta = ROLE_META[t.role];
        return (
          <div key={t.id} className="send-row" style={{ ['--role' as string]: meta.color }}>
            <span className="send-name">{meta.name}</span>
            <Knob label="Reverb" size="sm" value={t.fx.reverb} color={meta.color} format={pct} defaultValue={0} onChange={(v) => setFx(t.id, { reverb: v })} help="reverb" />
            <Knob label="Dub echo" size="sm" value={t.fx.delay} color={meta.color} format={pct} defaultValue={0} onChange={(v) => setFx(t.id, { delay: v })} help="delay" />
            <Knob label="Filter" size="sm" value={t.fx.filter} color={meta.color} format={(v) => (v > 0.995 ? 'Open' : pct(v))} defaultValue={1} onChange={(v) => setFx(t.id, { filter: v })} help="filter" />
            <Knob label="Resonance" size="sm" value={t.fx.resonance ?? 0} color={meta.color} format={pct} defaultValue={0} onChange={(v) => setFx(t.id, { resonance: v })} help="resonance" />
            <Knob label="Drive" size="sm" value={t.fx.drive} color={meta.color} format={pct} defaultValue={0} onChange={(v) => setFx(t.id, { drive: v })} help="drive" />
          </div>
        );
      })}
    </div>
  );
}

function ArrangeView() {
  return (
    <div className="arrange-view" data-help="arrange">
      <h3>Arrange: coming in Song Studio</h3>
      <p>
        Soon you will be able to lay sections out on a timeline and export a finished song. For now, perform your arrangement live with the
        section pads in the dock below. LoopLab records the order you play them in:
      </p>
      <History large />
    </div>
  );
}

export function LiveMix() {
  const tracks = useStore((s) => s.project.tracks);
  const quantize = useStore((s) => s.project.quantize);
  const setQuantize = useStore((s) => s.setQuantize);
  const tab = useUi((s) => s.centerTab);
  const setUi = useUi((s) => s.set);
  const tabs: { id: CenterTab; label: string; soon?: boolean }[] = [
    { id: 'live', label: 'Live Mix' },
    { id: 'pattern', label: 'Pattern' },
    { id: 'sends', label: 'FX Sends' },
    { id: 'arrange', label: 'Arrange', soon: true },
  ];
  return (
    <section className="panel center" aria-label="Live Mix">
      <header className="center-head">
        <nav className="tabs big" role="tablist" aria-label="Workspace views" data-help="center-tabs">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setUi({ centerTab: t.id })} data-help={t.soon ? 'arrange' : undefined}>
              {t.label}
              {t.soon && <span className="soon">soon</span>}
            </button>
          ))}
        </nav>
        <ChordStrip />
        <label className="quantize" data-help="quantize" data-tour="quantize">
          <span>Quantize</span>
          <select value={quantize} onChange={(e) => setQuantize(e.target.value as Quantize)} aria-label="Launch timing">
            <option value="beat">1 Beat</option>
            <option value="bar">1 Bar</option>
            <option value="2bar">2 Bars</option>
            <option value="4bar">4 Bars</option>
          </select>
        </label>
      </header>
      {tab === 'live' && (
        <div className="lanes" data-tour="lanes" data-help="live-mix">
          {tracks.map((t, i) => (
            <TrackLane key={t.id} t={t} index={i} />
          ))}
        </div>
      )}
      {tab === 'pattern' && <PatternView />}
      {tab === 'sends' && <SendsView />}
      {tab === 'arrange' && <ArrangeView />}
    </section>
  );
}
