import { packAccent, patternsForRole } from '@/content/library';
import { engine } from '@/engine/engine';
import { presetById, PRESETS } from '@/engine/instruments/presetInfo';
import { useLive } from '@/engine/live';
import { COMPAT_INFO } from '@/music/compat';
import { ROLE_META } from '@/project/factory';
import { lookupPattern, useStore } from '@/state/store';
import { EnergyDots, Knob } from './controls';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const panFmt = (v: number) => (Math.abs(v) < 0.02 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`);
const filterFmt = (v: number) => {
  const hz = 80 * Math.pow(2, v * 8);
  return v >= 0.995 ? 'Open' : hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`;
};

export function Inspector() {
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedTrackId);
  const lastSeed = useStore((s) => s.lastSeed);
  const playing = useLive((s) => s.playing);
  const soundMode = useLive((s) => s.soundMode);
  const { setTrack, setFx, setTrackPattern, mutateTrack, revertTrack, surpriseMe, remixParts, evolveEnergy, setSwing } =
    useStore.getState();
  const t = project.tracks.find((x) => x.id === selectedId) ?? project.tracks[0];
  const pattern = lookupPattern(project, t.patternId);
  const pool = patternsForRole(t.role, project.userPatterns);
  const kind = t.role === 'drums' || t.role === 'perc' ? 'drum' : 'pitched';
  const instruments = PRESETS.filter((p) => p.kind === kind);
  const currentInst = t.instrument ?? pattern?.instrument ?? '';

  return (
    <div className="panel inspector" style={{ ['--role' as string]: t.color }}>
      <div className="panel-head">
        <h2>
          <span style={{ color: t.color }}>{ROLE_META[t.role].icon}</span> {ROLE_META[t.role].name}
        </h2>
        <span className="muted small">Inspector</span>
      </div>
      <div className="panel-scroll">
        <section className="insp-sec">
          <h3>Current part</h3>
          {pattern ? (
            <div className="insp-part">
              <div className="insp-part-name">{pattern.name}</div>
              <div className="insp-part-meta">
                <span className="genre-tag" style={{ ['--accent' as string]: packAccent(pattern.packId) }}>{pattern.genre}</span>
                <span className="mono small">{pattern.bars} bar{pattern.bars > 1 ? 's' : ''} · {pattern.bpm} BPM native</span>
                <EnergyDots energy={pattern.energy} color={t.color} />
              </div>
              {pattern.description && <p className="muted small">{pattern.description}</p>}
              <div className="row gap">
                <button className="btn accent" onClick={() => mutateTrack(t.id)}>✦ New variation</button>
                {pattern.sourceId && (
                  <button className="btn ghost" onClick={() => revertTrack(t.id)} title="Back to the original this variation came from">
                    ↺ Original
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="muted small">This track is silent. Choose a part below.</p>
          )}
        </section>

        <section className="insp-sec">
          <h3>Swap part <span className="muted small">lands on the next {project.quantize === 'beat' ? 'beat' : 'boundary'}</span></h3>
          <div className="swap-list">
            <button className={`swap-item ${!t.patternId ? 'on' : ''}`} onClick={() => setTrackPattern(t.id, null)}>
              <span className="swap-name">— Silence —</span>
            </button>
            {pool.map((p) => (
              <button
                key={p.id}
                className={`swap-item ${p.id === t.patternId ? 'on' : ''}`}
                onClick={() => setTrackPattern(t.id, p.id)}
                title={p.description}
              >
                <span className="swap-dot" style={{ background: packAccent(p.packId) }} />
                <span className="swap-name">{p.name}</span>
                <span className="swap-genre">{p.sourceId ? '✦ variation' : p.genre}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="insp-sec">
          <h3>Sound</h3>
          <label className="field">
            <span>Instrument</span>
            <select
              value={t.instrument ?? ''}
              onChange={(e) => setTrack(t.id, { instrument: e.target.value || null })}
              aria-label="Instrument"
            >
              <option value="">Part default ({presetById.get(pattern?.instrument ?? '')?.name ?? 'none'})</option>
              {instruments.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <p className="muted small">{presetById.get(currentInst)?.description}</p>
          {presetById.get(currentInst)?.sampled && (
            <p className={`small sample-src ${soundMode === 'sampled' ? 'on' : ''}`}>
              {soundMode === 'sampled' ? '● Studio sound: ' : '○ Studio version available (switch Sound to Studio): '}
              {presetById.get(currentInst)?.sampled}
            </p>
          )}
          <div className="knob-row">
            <Knob label="Volume" value={t.volume} max={1.2} defaultValue={0.8} color={t.color} format={(v) => (v < 0.005 ? '−∞' : `${(20 * Math.log10(v / 0.8)).toFixed(1)}dB`)} onChange={(v) => setTrack(t.id, { volume: v }, true)} />
            <Knob label="Pan" value={t.pan} min={-1} max={1} defaultValue={0} color={t.color} format={panFmt} onChange={(v) => setTrack(t.id, { pan: v }, true)} />
            <Knob
              label="Density"
              value={t.density ?? 1}
              defaultValue={1}
              color={t.color}
              format={pct}
              onChange={(v) => setTrack(t.id, { density: v }, true)}
            />
          </div>
          <p className="muted small">Density thins the part: ghost notes and soft offbeats go first, downbeats and accents stay.</p>
        </section>

        <section className="insp-sec">
          <h3>Effects</h3>
          <div className="knob-row">
            <Knob label="Reverb" value={t.fx.reverb} defaultValue={0} color={t.color} format={pct} onChange={(v) => setFx(t.id, { reverb: v })} />
            <Knob label="Dub echo" value={t.fx.delay} defaultValue={0} color={t.color} format={pct} onChange={(v) => setFx(t.id, { delay: v })} />
            <Knob label="Filter" value={t.fx.filter} defaultValue={1} color={t.color} format={filterFmt} onChange={(v) => setFx(t.id, { filter: v })} />
            <Knob label="Resonance" value={t.fx.resonance ?? 0} defaultValue={0} color={t.color} format={pct} onChange={(v) => setFx(t.id, { resonance: v })} />
            <Knob label="Drive" value={t.fx.drive} defaultValue={0} color={t.color} format={pct} onChange={(v) => setFx(t.id, { drive: v })} />
          </div>
        </section>

        <section className="insp-sec">
          <h3>Creative tools</h3>
          <div className="tool-grid">
            <button className="btn surprise" onClick={() => surpriseMe()}>🎲 Surprise Me</button>
            <button className="btn" onClick={remixParts}>Remix unlocked</button>
            <button className="btn" onClick={() => evolveEnergy(-1)}>Energy −</button>
            <button className="btn" onClick={() => evolveEnergy(1)}>Energy +</button>
            <button className="btn" disabled={!playing} onClick={() => engine.queueFill()}>Drum fill</button>
            <button className="btn" disabled={!playing} onClick={() => engine.queueBuild(2)}>Build ↗</button>
            <button className="btn" disabled={!playing} onClick={() => engine.queueDrop()}>Drop ⚡</button>
            <button className="btn" disabled={!pattern} onClick={() => mutateTrack(t.id)}>✦ Mutate {t.name}</button>
          </div>
          {lastSeed !== null && <div className="muted small mono">Last seed: {lastSeed.toString(36)}</div>}
          <div className="knob-row">
            <Knob label="Global swing" value={project.swing} max={0.5} defaultValue={0} color="#8ea2ff" format={pct} onChange={setSwing} />
          </div>
          <p className="muted small compat-note">
            <b>{project.compat[0].toUpperCase() + project.compat.slice(1)} mode:</b> {COMPAT_INFO[project.compat]}
          </p>
        </section>
      </div>
    </div>
  );
}
