import { getPack } from '@/content/library';
import { engine } from '@/engine/engine';
import { presetById, PRESETS } from '@/engine/instruments/presetInfo';
import { useLive } from '@/engine/live';
import { COMPAT_INFO } from '@/music/compat';
import { ROLE_META } from '@/project/factory';
import { lookupPattern, useStore } from '@/state/store';
import { useUi, type LabTab } from '@/state/ui';
import { PackArt } from './art/PackArt';
import { EnergyDots, faderDb, Knob } from './components';
import { IconChevronRight, IconDice, IconSparkle, IconLock, IconUnlock } from './icons';
import { ROLE_ICON } from './LiveMix';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const panFmt = (v: number) => (Math.abs(v) < 0.02 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`);
const filterHz = (v: number) => 80 * Math.pow(2, v * 8);
const filterFmt = (v: number) => {
  const hz = filterHz(v);
  return v >= 0.995 ? 'Open' : hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`;
};

/** Live picture of the low-pass filter: cutoff position and resonance peak. */
function FilterCurve({ cutoff, resonance, color }: { cutoff: number; resonance: number; color: string }) {
  const W = 240;
  const H = 70;
  const fx = 12 + cutoff * (W - 30);
  const peak = 8 + resonance * 26;
  const base = 34;
  const d = cutoff >= 0.995 ? `M0 ${base} L${W} ${base}` : `M0 ${base} L${Math.max(0, fx - 34)} ${base} Q${fx - 8} ${base} ${fx} ${base - peak} Q${fx + 10} ${base} ${Math.min(W, fx + 46)} ${H - 2}`;
  return (
    <svg className="filter-curve" viewBox={`0 0 ${W} ${H}`} aria-hidden style={{ ['--k' as string]: color }}>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={g * W} x2={g * W} y1={0} y2={H} className="fc-grid" />
      ))}
      <path d={`${d} L${cutoff >= 0.995 ? W : Math.min(W, fx + 46)} ${H} L0 ${H} Z`} className="fc-fill" />
      <path d={d} className="fc-line" />
    </svg>
  );
}

function InstrumentTab() {
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedTrackId);
  const soundMode = useLive((s) => s.soundMode);
  const { setTrack, setFx } = useStore.getState();
  const t = project.tracks.find((x) => x.id === selectedId) ?? project.tracks[0];
  const pattern = lookupPattern(project, t.patternId);
  const kind = t.role === 'drums' || t.role === 'perc' ? 'drum' : 'pitched';
  const instruments = PRESETS.filter((p) => p.kind === kind);
  const current = presetById.get(t.instrument ?? pattern?.instrument ?? '');
  const color = ROLE_META[t.role].color;
  return (
    <div className="lab-body">
      <label className="field" data-help="instrument">
        <span>Instrument sound</span>
        <select value={t.instrument ?? ''} onChange={(e) => setTrack(t.id, { instrument: e.target.value || null })} aria-label="Instrument">
          <option value="">Part default ({presetById.get(pattern?.instrument ?? '')?.name ?? 'none'})</option>
          {instruments.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      {current && <p className="lab-note">{current.description}</p>}
      {current?.sampled && (
        <p className={`lab-src ${soundMode === 'sampled' ? 'on' : ''}`} data-help="sound-mode">
          {soundMode === 'sampled' ? 'Studio sound: ' : 'Studio version available (switch Sound to Studio): '}
          {current.sampled}
        </p>
      )}
      <div className="lab-group">
        <div className="lab-group-head">
          <h4 data-help="filter">Filter</h4>
          <span className="mono small">{filterFmt(t.fx.filter)}</span>
        </div>
        <FilterCurve cutoff={t.fx.filter} resonance={t.fx.resonance ?? 0} color={color} />
        <div className="knob-row">
          <Knob label="Cutoff" value={t.fx.filter} defaultValue={1} color={color} format={filterFmt} onChange={(v) => setFx(t.id, { filter: v })} help="filter" tour="lab-filter" />
          <Knob label="Resonance" value={t.fx.resonance ?? 0} defaultValue={0} color={color} format={pct} onChange={(v) => setFx(t.id, { resonance: v })} help="resonance" />
          <Knob label="Drive" value={t.fx.drive} defaultValue={0} color={color} format={pct} onChange={(v) => setFx(t.id, { drive: v })} help="drive" />
        </div>
      </div>
      <div className="lab-group">
        <div className="lab-group-head">
          <h4>Level and space</h4>
        </div>
        <div className="knob-row">
          <Knob label="Volume" value={t.volume} max={1.2} defaultValue={0.8} color={color} format={faderDb} onChange={(v) => setTrack(t.id, { volume: v }, true)} help="volume" />
          <Knob label="Pan" value={t.pan} min={-1} max={1} defaultValue={0} bipolar color={color} format={panFmt} onChange={(v) => setTrack(t.id, { pan: v }, true)} help="pan" />
          <Knob label="Density" value={t.density ?? 1} defaultValue={1} color={color} format={pct} onChange={(v) => setTrack(t.id, { density: v }, true)} help="density" />
        </div>
      </div>
      <p className="lab-note unavailable">Envelope (attack, decay, sustain, release) editing arrives with the Phase 3 sound editor.</p>
    </div>
  );
}

function EffectsTab() {
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedTrackId);
  const setFx = useStore((s) => s.setFx);
  const t = project.tracks.find((x) => x.id === selectedId) ?? project.tracks[0];
  const color = ROLE_META[t.role].color;
  return (
    <div className="lab-body">
      <div className="lab-group">
        <div className="lab-group-head">
          <h4>Space</h4>
        </div>
        <div className="knob-row">
          <Knob label="Reverb" value={t.fx.reverb} defaultValue={0} color={color} format={pct} onChange={(v) => setFx(t.id, { reverb: v })} help="reverb" />
          <Knob label="Dub echo" value={t.fx.delay} defaultValue={0} color={color} format={pct} onChange={(v) => setFx(t.id, { delay: v })} help="delay" />
        </div>
      </div>
      <div className="lab-group">
        <div className="lab-group-head">
          <h4>Tone</h4>
        </div>
        <div className="knob-row">
          <Knob label="Filter" value={t.fx.filter} defaultValue={1} color={color} format={filterFmt} onChange={(v) => setFx(t.id, { filter: v })} help="filter" />
          <Knob label="Resonance" value={t.fx.resonance ?? 0} defaultValue={0} color={color} format={pct} onChange={(v) => setFx(t.id, { resonance: v })} help="resonance" />
          <Knob label="Drive" value={t.fx.drive} defaultValue={0} color={color} format={pct} onChange={(v) => setFx(t.id, { drive: v })} help="drive" />
        </div>
      </div>
      <p className="lab-note">Every track feeds the shared reverb and dub-echo busses. Turn a send up to place the sound further back in the room.</p>
    </div>
  );
}

function VariationTab() {
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedTrackId);
  const lastSeed = useStore((s) => s.lastSeed);
  const amount = useStore((s) => s.variationAmount);
  const { mutateTrack, revertTrack, remixParts, toggleLock, setVariationAmount } = useStore.getState();
  const t = project.tracks.find((x) => x.id === selectedId) ?? project.tracks[0];
  const p = lookupPattern(project, t.patternId);
  const color = ROLE_META[t.role].color;
  return (
    <div className="lab-body">
      <p className="lab-note">A variation keeps the feel of the part but changes some notes and hits. You can always go back to the original.</p>
      <div className="knob-row">
        <Knob label="Variation amount" value={amount} min={0.2} max={2} defaultValue={1} color={color} format={(v) => (v < 0.7 ? 'Subtle' : v < 1.4 ? 'Medium' : 'Bold')} onChange={setVariationAmount} help="variation-amount" />
      </div>
      <div className="lab-actions">
        <button className="btn accent" disabled={!p} onClick={() => mutateTrack(t.id)} data-help="variation" data-tour="variation-btn">
          <IconSparkle size={16} /> New variation
        </button>
        <button className="btn" disabled={!p?.sourceId} onClick={() => revertTrack(t.id)}>↺ Original</button>
        <button className="btn" onClick={() => toggleLock(t.id)} data-help="lock" aria-pressed={t.locked}>
          {t.locked ? <IconUnlock size={16} /> : <IconLock size={16} />} {t.locked ? 'Unlock' : 'Lock'} {ROLE_META[t.role].name}
        </button>
        <button className="btn" onClick={remixParts} data-help="remix" data-tour="remix-btn">Remix unlocked parts</button>
      </div>
      {lastSeed !== null && <div className="muted small mono">Last seed: {lastSeed.toString(36)}</div>}
    </div>
  );
}

function GlobalControls() {
  const project = useStore((s) => s.project);
  const playing = useLive((s) => s.playing);
  const { surpriseMe, evolveEnergy, setSwing } = useStore.getState();
  const parts = project.tracks.map((t) => lookupPattern(project, t.patternId)).filter(Boolean);
  const energy = parts.length ? Math.round(parts.reduce((a, p) => a + p!.energy, 0) / parts.length) : 0;
  return (
    <aside className="global" aria-label="Global controls">
      <h4>Global</h4>
      <div className="global-energy" data-help="energy">
        <span className="global-label">Energy</span>
        <EnergyDots energy={energy} color="#ffb547" />
        <div className="global-pm">
          <button className="ibtn" aria-label="Energy down" onClick={() => evolveEnergy(-1)}>−</button>
          <button className="ibtn" aria-label="Energy up" onClick={() => evolveEnergy(1)}>+</button>
        </div>
      </div>
      <Knob label="Swing" size="sm" value={project.swing} max={0.5} defaultValue={0} color="#8ea2ff" format={pct} onChange={setSwing} help="swing" tour="swing" />
      <div className="global-fx">
        <button className="btn small" disabled={!playing} onClick={() => engine.queueFill()} data-help="fill">Fill</button>
        <button className="btn small" disabled={!playing} onClick={() => engine.queueBuild(2)} data-help="build">Build</button>
        <button className="btn small" disabled={!playing} onClick={() => engine.queueDrop()} data-help="drop">Drop</button>
      </div>
      <button className="btn surprise" onClick={() => surpriseMe()} data-help="surprise-me" data-tour="surprise">
        <IconDice size={18} /> Surprise Me
      </button>
      <p className="global-compat" data-help="compat">
        <b>{project.compat[0].toUpperCase() + project.compat.slice(1)}:</b> {COMPAT_INFO[project.compat]}
      </p>
    </aside>
  );
}

export function SoundLab() {
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedTrackId);
  const tab = useUi((s) => s.labTab);
  const setUi = useUi((s) => s.set);
  const togglePanel = useUi((s) => s.togglePanel);
  const t = project.tracks.find((x) => x.id === selectedId) ?? project.tracks[0];
  const p = lookupPattern(project, t.patternId);
  const meta = ROLE_META[t.role];
  const Icon = ROLE_ICON[t.role];
  const inst = presetById.get(t.instrument ?? p?.instrument ?? '');
  const tabs: { id: LabTab; label: string }[] = [
    { id: 'instrument', label: 'Instrument' },
    { id: 'effects', label: 'Effects' },
    { id: 'variation', label: 'Variation' },
  ];
  return (
    <section className="panel lab" aria-label="Sound Lab" style={{ ['--role' as string]: meta.color }} data-tour="sound-lab">
      <header className="panel-head">
        <h2 data-help="sound-lab">Sound Lab</h2>
        <button className="ibtn ghost" aria-label="Hide Sound Lab" onClick={() => togglePanel('lab')}>
          <IconChevronRight />
        </button>
      </header>
      <nav className="tabs" role="tablist" aria-label="Sound Lab views">
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setUi({ labTab: x.id })}>
            {x.label}
          </button>
        ))}
        <button role="tab" aria-disabled className="soon-tab" data-help="arrange" title="Modulation: coming soon" disabled>
          Modulation <span className="soon">soon</span>
        </button>
      </nav>
      <div className="lab-split">
        <div className="lab-main panel-scroll">
          <div className="lab-hero">
            <div className="lab-hero-art">{p ? <PackArt packId={p.packId} /> : <div className="art-empty" />}</div>
            <div className="lab-hero-text">
              <div className="lab-hero-role">
                <span className="lane-icon small" aria-hidden>
                  <Icon size={16} />
                </span>
                {meta.name}
              </div>
              <div className="lab-hero-inst">{inst?.name ?? 'No instrument'}</div>
              <div className="lab-hero-part">{p ? `${p.name} · ${getPack(p.packId)?.name ?? p.genre}` : 'Silent'}</div>
            </div>
          </div>
          <div className="lab-track-pick" role="group" aria-label="Choose track to edit">
            {project.tracks.map((x) => (
              <button key={x.id} className={x.id === t.id ? 'on' : ''} style={{ ['--role' as string]: ROLE_META[x.role].color }} onClick={() => useStore.getState().selectTrack(x.id)} aria-pressed={x.id === t.id}>
                {ROLE_META[x.role].name}
              </button>
            ))}
          </div>
          {tab === 'instrument' && <InstrumentTab />}
          {tab === 'effects' && <EffectsTab />}
          {tab === 'variation' && <VariationTab />}
        </div>
        <GlobalControls />
      </div>
    </section>
  );
}
