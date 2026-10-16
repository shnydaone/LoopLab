import { useRef } from 'react';
import { getPack, PACKS } from '@/content/library';
import { engine } from '@/engine/engine';
import { useLive } from '@/engine/live';
import { keyName } from '@/music/theory';
import { ROLE_META } from '@/project/factory';
import type { TrackState } from '@/project/types';
import { exportCurrent, importFile } from '@/state/persistence';
import { lookupPattern, useStore } from '@/state/store';
import { useUi } from '@/state/ui';
import { Knob, Meter, VFader } from './components';
import { IconExport, IconImport, IconPlus, IconShare, IconVideo } from './icons';

const panFmt = (v: number) => (Math.abs(v) < 0.02 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`);

function Master() {
  const vol = useStore((s) => s.project.masterVolume);
  const setMasterVolume = useStore((s) => s.setMasterVolume);
  return (
    <div className="dock-block master-block" data-help="master" data-tour="master">
      <h3>Master</h3>
      <div className="master-body">
        <Meter id="master" className="master-meter" />
        <Knob label="Master" size="md" value={vol} max={1.2} defaultValue={0.9} color="#e7ecf7" format={(v) => `${Math.round(v * 100)}%`} onChange={setMasterVolume} help="master" />
      </div>
      <small className="muted">Limiter keeps peaks under −1 dB</small>
    </div>
  );
}

function Strip({ t }: { t: TrackState }) {
  const { setTrack, toggleMute, toggleSolo, selectTrack } = useStore.getState();
  const selected = useStore((s) => s.selectedTrackId === t.id);
  const meta = ROLE_META[t.role];
  return (
    <div className={`strip ${selected ? 'selected' : ''} ${t.mute ? 'muted' : ''}`} style={{ ['--role' as string]: meta.color }}>
      <Knob label={`${meta.name} pan`} hideLabel size="xs" value={t.pan} min={-1} max={1} defaultValue={0} bipolar color={meta.color} format={panFmt} onChange={(v) => setTrack(t.id, { pan: v }, true)} help="pan" />
      <VFader label={`${meta.name} level`} value={t.volume} color={meta.color} onChange={(v) => setTrack(t.id, { volume: v }, true)} help="volume" meterId={t.id} />
      <div className="strip-btns">
        <button className={`ms mute ${t.mute ? 'on' : ''}`} aria-pressed={t.mute} aria-label={`Mute ${meta.name}`} data-help="mute" onClick={() => toggleMute(t.id)}>M</button>
        <button className={`ms solo ${t.solo ? 'on' : ''}`} aria-pressed={t.solo} aria-label={`Solo ${meta.name}`} data-help="solo" onClick={() => toggleSolo(t.id)}>S</button>
      </div>
      <button className="strip-name" onClick={() => selectTrack(t.id)}>{meta.name}</button>
    </div>
  );
}

function Mixer() {
  const tracks = useStore((s) => s.project.tracks);
  return (
    <div className="dock-block mixer-block" data-help="mixer" data-tour="mixer">
      <h3>Channel Mixer</h3>
      <div className="mixer" role="group" aria-label="Channel mixer">
        {tracks.map((t) => (
          <Strip key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}

/** The order sections were actually played this session. */
export function History({ large }: { large?: boolean }) {
  const history = useLive((s) => s.history);
  const playing = useLive((s) => s.playing);
  const step = useLive((s) => s.step);
  const bar = Math.floor(step / 16);
  const items = history.slice(-24);
  if (!items.length) {
    return <div className={`history empty ${large ? 'large' : ''}`} data-help="history">Press Play and launch sections: your arrangement appears here.</div>;
  }
  const first = items[0].bar;
  const end = playing ? bar + 1 : items[items.length - 1].bar + 4;
  const total = Math.max(1, end - first);
  return (
    <div className={`history ${large ? 'large' : ''}`} data-help="history" aria-label="Arrangement so far">
      {items.map((h, i) => {
        const next = items[i + 1]?.bar ?? end;
        const len = Math.max(1, next - h.bar);
        const current = playing && i === items.length - 1;
        return (
          <div key={`${h.bar}-${i}`} className={`hist kind-${h.kind} ${current ? 'on' : ''}`} style={{ flexGrow: len, ['--accent' as string]: getPack(h.packId)?.accent }} title={`${h.name}, bar ${h.bar + 1}, ${len} bars`}>
            <span>{h.name}</span>
            {large && <small>{len} bars</small>}
          </div>
        );
      })}
      <span className="hist-total mono">{total} bars</span>
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
  const scenes = project.scenes;
  const activeScene = useUi((s) => s.activeScene);
  const setUi = useUi((s) => s.set);
  const { saveScene, launchScene, deleteScene } = useStore.getState();
  const pack = getPack(project.basePackId) ?? PACKS[0];
  return (
    <div className="dock-block sections-block" data-tour="sections">
      <div className="dock-head">
        <h3 data-help="sections">Scenes &amp; Song Sections</h3>
        <span className="small" style={{ color: pack.accent }}>{pack.name} · {keyName(project.harmony)}</span>
      </div>
      <div className="pads" role="group" aria-label="Song sections">
        {pack.sections.map((s) => {
          const on = project.sectionId === s.id;
          return (
            <button key={s.id} className={`pad kind-${s.kind} ${on ? 'on' : ''} ${on && pending ? 'queued' : ''}`} onClick={() => launchSection(pack.id, s.id)} data-help={`section-${s.kind}`} data-tour={`section-${s.kind}`} aria-pressed={on}>
              <span className="pad-name">{s.name}</span>
              <span className="pad-sub">{on && pending ? 'queued…' : `${s.progression.reduce((a, c) => a + c.bars, 0)} bars`}</span>
            </button>
          );
        })}
        <button className={`pad kind-fill ${fillQueued ? 'queued' : ''}`} disabled={!playing} onClick={() => engine.queueFill()} data-help="fill">
          <span className="pad-name">Fill</span>
          <span className="pad-sub">{fillQueued ? 'queued…' : '1 bar'}</span>
        </button>
        <button className={`pad kind-build ${buildQueued ? 'queued' : ''} ${building ? 'on' : ''}`} disabled={!playing || building} onClick={() => engine.queueBuild(2)} data-help="build">
          <span className="pad-name">Build ↗</span>
          <span className="pad-sub">{building ? 'building…' : buildQueued ? 'queued…' : '2 bars'}</span>
        </button>
        <button className={`pad kind-drop ${dropQueued ? 'queued' : ''}`} disabled={!playing} onClick={() => engine.queueDrop()} data-help="drop">
          <span className="pad-name">Drop ⚡</span>
          <span className="pad-sub">{dropQueued ? 'queued…' : 'next bar'}</span>
        </button>
      </div>
      <div className="scenes" data-help="scenes">
        {scenes.map((s, i) => (
          <div key={s.id} className={`scene ${activeScene === s.id ? 'on' : ''}`} style={{ ['--accent' as string]: s.color }}>
            <button className="scene-launch" onClick={() => { launchScene(s.id); setUi({ activeScene: s.id }); }} aria-pressed={activeScene === s.id}>
              <span className="mono">{i + 1}</span> {s.name}
            </button>
            <button className="scene-del" aria-label={`Delete ${s.name}`} onClick={() => deleteScene(s.id)}>✕</button>
          </div>
        ))}
        <button className="scene-add" onClick={saveScene} data-help="scenes" data-tour="save-scene">
          <IconPlus size={14} /> Save scene
        </button>
      </div>
      <History />
    </div>
  );
}

function ExportShare() {
  const fileRef = useRef<HTMLInputElement>(null);
  const project = useStore((s) => s.project);
  const toast = useStore((s) => s.toast);
  const share = async () => {
    const parts = project.tracks
      .map((t) => lookupPattern(project, t.patternId))
      .filter(Boolean)
      .map((p) => `${ROLE_META[p!.role].name}: ${p!.name} (${p!.genre})`);
    const text = `“${project.name}” made in LoopLab Studio, ${project.bpm} BPM, ${keyName(project.harmony)}\n${parts.join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      toast('Mix recipe copied to the clipboard', 'good');
    } catch {
      toast('Copying is blocked in this browser. Use Export project instead.', 'warn');
    }
  };
  return (
    <div className="dock-block export-block">
      <h3>Export &amp; Share</h3>
      <button className="btn block" onClick={exportCurrent} data-help="export-json"><IconExport size={16} /> Export project</button>
      <button className="btn block" onClick={() => fileRef.current?.click()} data-help="import-json"><IconImport size={16} /> Import project</button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = '';
        }}
      />
      <button className="btn block" onClick={share} data-help="share"><IconShare size={16} /> Copy mix recipe</button>
      <button className="btn block" disabled data-help="export-audio">Export audio <span className="soon">soon</span></button>
      <button className="btn block" disabled data-help="video-preview"><IconVideo size={16} /> Video preview <span className="soon">soon</span></button>
    </div>
  );
}

export function Dock() {
  return (
    <section className="dock" aria-label="Mixer, sections and export">
      <Master />
      <Mixer />
      <Sections />
      <ExportShare />
    </section>
  );
}
