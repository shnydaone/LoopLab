import { useRef } from 'react';
import { getPack, PACKS } from '@/content/library';
import { engine } from '@/engine/engine';
import { useLive } from '@/engine/live';
import type { TrackState } from '@/project/types';
import { ROLE_META } from '@/project/factory';
import { useStore } from '@/state/store';
import { Fader, IconBtn, Knob } from './controls';
import { useMeter } from './hooks';

function Strip({ t }: { t: TrackState }) {
  const ref = useRef<HTMLDivElement>(null);
  useMeter(ref, t.id);
  const { setTrack, toggleMute, toggleSolo, selectTrack } = useStore.getState();
  const selected = useStore((s) => s.selectedTrackId === t.id);
  return (
    <div ref={ref} className={`strip ${selected ? 'selected' : ''}`} style={{ ['--role' as string]: t.color }}>
      <button className="strip-name" onClick={() => selectTrack(t.id)} title={ROLE_META[t.role].name}>{ROLE_META[t.role].name}</button>
      <Knob label="Pan" size="sm" value={t.pan} min={-1} max={1} defaultValue={0} color={t.color}
        format={(v) => (Math.abs(v) < 0.02 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)}
        onChange={(v) => setTrack(t.id, { pan: v }, true)} />
      <div className="strip-body">
        <div className="strip-meter" aria-hidden><i /></div>
        <Fader orient="v" label={`${t.name} level`} value={t.volume} color={t.color} onChange={(v) => setTrack(t.id, { volume: v }, true)} />
      </div>
      <div className="strip-btns">
        <IconBtn title={`Mute ${t.name}`} tone="mute" active={t.mute} onClick={() => toggleMute(t.id)}>M</IconBtn>
        <IconBtn title={`Solo ${t.name}`} tone="solo" active={t.solo} onClick={() => toggleSolo(t.id)}>S</IconBtn>
      </div>
    </div>
  );
}

function MasterStrip() {
  const ref = useRef<HTMLDivElement>(null);
  useMeter(ref, 'master');
  const vol = useStore((s) => s.project.masterVolume);
  const setMasterVolume = useStore((s) => s.setMasterVolume);
  return (
    <div ref={ref} className="strip master" style={{ ['--role' as string]: '#e7ecf7' }}>
      <div className="strip-name">Master</div>
      <div className="strip-limiter muted small">Limiter −1 dB</div>
      <div className="strip-body">
        <div className="strip-meter" aria-hidden><i /></div>
        <Fader orient="v" label="Master level" value={vol} color="#e7ecf7" onChange={setMasterVolume} />
      </div>
    </div>
  );
}

function Sections() {
  const project = useStore((s) => s.project);
  const launchSection = useStore((s) => s.launchSection);
  const playing = useLive((s) => s.playing);
  const pending = useLive((s) => s.harmonyPending);
  const fillQueued = useLive((s) => s.fillQueued);
  const building = useLive((s) => s.building);
  const buildQueued = useLive((s) => s.buildQueued);
  const dropQueued = useLive((s) => s.dropQueued);
  const pack = getPack(project.basePackId) ?? PACKS[0];
  return (
    <div className="bp-block sections">
      <div className="bp-head">
        <h3>Sections</h3>
        <span className="muted small" style={{ color: pack.accent }}>{pack.name}</span>
      </div>
      <div className="section-pads">
        {pack.sections.map((s) => {
          const on = project.sectionId === s.id;
          return (
            <button
              key={s.id}
              className={`pad kind-${s.kind} ${on ? 'on' : ''} ${on && pending ? 'queued' : ''}`}
              onClick={() => launchSection(pack.id, s.id)}
            >
              <span className="pad-name">{s.name}</span>
              <span className="pad-sub">{s.progression.reduce((a, c) => a + c.bars, 0)} bars</span>
            </button>
          );
        })}
        <button className={`pad kind-fill ${fillQueued ? 'queued' : ''}`} disabled={!playing} onClick={() => engine.queueFill()} title="Drum fill on the next bar (F)">
          <span className="pad-name">Fill</span>
          <span className="pad-sub">1 bar</span>
        </button>
        <button
          className={`pad kind-build ${buildQueued ? 'queued' : ''} ${building ? 'on' : ''}`}
          disabled={!playing || building}
          onClick={() => engine.queueBuild(2)}
          title="Build-up (B): two bars of rising filter sweep, riser and snare roll, then it drops"
        >
          <span className="pad-name">Build ↗</span>
          <span className="pad-sub">{building ? 'building…' : '2 bars'}</span>
        </button>
        <button
          className={`pad kind-drop ${dropQueued ? 'queued' : ''}`}
          disabled={!playing}
          onClick={() => engine.queueDrop()}
          title="Drop (D): impact + crash on the next bar; ends a build early"
        >
          <span className="pad-name">Drop ⚡</span>
          <span className="pad-sub">next bar</span>
        </button>
      </div>
    </div>
  );
}

function Scenes() {
  const scenes = useStore((s) => s.project.scenes);
  const { saveScene, launchScene, deleteScene } = useStore.getState();
  return (
    <div className="bp-block scenes">
      <div className="bp-head">
        <h3>Scenes</h3>
        <button className="btn small" onClick={saveScene} title="Snapshot every track's part, mute and level">+ Save scene</button>
      </div>
      <div className="scene-grid">
        {scenes.map((s, i) => (
          <div key={s.id} className="scene" style={{ ['--accent' as string]: s.color }}>
            <button className="scene-launch" onClick={() => launchScene(s.id)} title="Launch on the next boundary">
              <span className="mono">{i + 1}</span> {s.name}
            </button>
            <button className="scene-del" aria-label={`Delete ${s.name}`} onClick={() => deleteScene(s.id)}>✕</button>
          </div>
        ))}
        {scenes.length === 0 && <div className="muted small">Build a mix you like, then save it as a scene to jump back to it later.</div>}
      </div>
    </div>
  );
}

function MiniTimeline() {
  const playing = useLive((s) => s.playing);
  const step = useLive((s) => s.step);
  const bars = 16;
  const bar = Math.floor(step / 16) % bars;
  const frac = ((step % 16) / 16) * 100;
  return (
    <div className="bp-block timeline">
      <div className="bp-head">
        <h3>Timeline</h3>
        <span className="muted small">Song Studio arrives in Phase 3</span>
      </div>
      <div className="tl-bars">
        {Array.from({ length: bars }, (_, i) => (
          <div key={i} className={`tl-bar ${playing && i === bar ? 'on' : ''} ${playing && i < bar ? 'past' : ''}`}>
            {playing && i === bar && <i style={{ width: `${frac}%` }} />}
            <span className="mono">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BottomPanel() {
  const tracks = useStore((s) => s.project.tracks);
  return (
    <div className="panel bottom">
      <div className="mixer" role="group" aria-label="Mixer">
        {tracks.map((t) => (
          <Strip key={t.id} t={t} />
        ))}
        <MasterStrip />
      </div>
      <div className="bp-right">
        <Sections />
        <Scenes />
        <MiniTimeline />
      </div>
    </div>
  );
}
