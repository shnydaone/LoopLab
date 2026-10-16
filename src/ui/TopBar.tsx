import { useEffect, useRef, useState } from 'react';
import { engine } from '@/engine/engine';
import { useLive, type SoundMode } from '@/engine/live';
import { COMPAT_INFO, type CompatMode } from '@/music/compat';
import { MODE_LABEL, NOTE_NAMES } from '@/music/theory';
import type { Mode } from '@/music/types';
import type { Quantize } from '@/project/types';
import {
  duplicateProject,
  exportCurrent,
  importFile,
  newProject,
  openProject,
  removeProject,
  saveNow,
  useProjects,
} from '@/state/persistence';
import { useStore } from '@/state/store';
import { Fader, Segmented } from './controls';

export type PanelId = 'browser' | 'inspector' | 'bottom';

interface Props {
  panels: Record<PanelId, boolean>;
  onTogglePanel: (p: PanelId) => void;
  focus: boolean;
  onToggleFocus: () => void;
  scale: number;
  onScale: (s: number) => void;
  onHelp: () => void;
  compact?: boolean;
}

function BpmControl() {
  const bpm = useStore((s) => s.project.bpm);
  const setBpm = useStore((s) => s.setBpm);
  const [draft, setDraft] = useState<string | null>(null);
  const drag = useRef<{ y: number; v: number } | null>(null);
  return (
    <div className="bpm" title="Tempo: drag up/down, scroll, or type">
      <button className="bpm-step" aria-label="Tempo down" onClick={() => setBpm(bpm - 1)}>
        −
      </button>
      <input
        className="bpm-input mono"
        aria-label="Tempo in BPM"
        value={draft ?? String(bpm)}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => {
          if (draft) setBpm(Number(draft));
          setDraft(null);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'ArrowUp') setBpm(bpm + 1);
          if (e.key === 'ArrowDown') setBpm(bpm - 1);
        }}
        onWheel={(e) => setBpm(bpm - Math.sign(e.deltaY))}
        onPointerDown={(e) => {
          drag.current = { y: e.clientY, v: bpm };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dy = drag.current.y - e.clientY;
          if (Math.abs(dy) > 3) setBpm(drag.current.v + Math.round(dy / 4));
        }}
        onPointerUp={() => (drag.current = null)}
      />
      <span className="bpm-unit">BPM</span>
      <button className="bpm-step" aria-label="Tempo up" onClick={() => setBpm(bpm + 1)}>
        +
      </button>
    </div>
  );
}

function ProjectMenu() {
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const list = useProjects((s) => s.list);
  const project = useStore((s) => s.project);
  const rename = useStore((s) => s.renameProject);
  const fileRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirmId(null);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="menu-wrap" ref={ref}>
      <button className="btn ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
        Project ▾
      </button>
      {open && (
        <div className="menu" role="menu">
          <button role="menuitem" onClick={() => { void newProject(); setOpen(false); }}>New project</button>
          <button role="menuitem" onClick={() => { void saveNow(); setOpen(false); }}>Save now <kbd>Ctrl S</kbd></button>
          <button role="menuitem" onClick={() => { void duplicateProject(); setOpen(false); }}>Duplicate</button>
          <button
            role="menuitem"
            onClick={() => {
              const name = window.prompt('Rename project', project.name);
              if (name !== null) rename(name);
              setOpen(false);
            }}
          >
            Rename…
          </button>
          <hr />
          <button role="menuitem" onClick={() => { exportCurrent(); setOpen(false); }}>Export JSON</button>
          <button role="menuitem" onClick={() => fileRef.current?.click()}>Import JSON…</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = '';
              setOpen(false);
            }}
          />
          <hr />
          <div className="menu-label">Your projects</div>
          <div className="menu-list">
            {list.map((m) => (
              <div key={m.id} className={`menu-proj ${m.id === project.id ? 'current' : ''}`}>
                <button className="menu-proj-open" onClick={() => { void openProject(m.id); setOpen(false); }}>
                  <span>{m.name}</span>
                  <small>{new Date(m.updatedAt).toLocaleString()}</small>
                </button>
                {confirmId === m.id ? (
                  <button className="menu-del confirm" onClick={() => { void removeProject(m.id); setConfirmId(null); }}>
                    Delete?
                  </button>
                ) : (
                  <button className="menu-del" aria-label={`Delete ${m.name}`} onClick={() => setConfirmId(m.id)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {list.length === 0 && <div className="menu-empty">No saved projects yet</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function SoundSwitch() {
  const mode = useLive((s) => s.soundMode);
  const pending = useLive((s) => s.samplesPending);
  const loaded = useLive((s) => s.samplesLoaded);
  return (
    <div className="tb-field sound-switch" title="A/B: recorded instruments vs the original synthesised sounds. Switches instantly while playing.">
      <span>Sound</span>
      <Segmented<SoundMode>
        label="Sound engine"
        value={mode}
        onChange={(m) => engine.setSoundMode(m)}
        options={[
          { value: 'sampled', label: 'Sampled', title: 'Real recorded drums and bass (CC0 libraries)' },
          { value: 'synth', label: 'Synth', title: 'Original all-synthesis sounds' },
        ]}
      />
      {mode === 'sampled' && pending > 0 && (
        <span className="loading-badge mono" aria-live="polite">
          Loading {loaded}/{loaded + pending}
        </span>
      )}
    </div>
  );
}

function ProjectName({ name, onRename }: { name: string; onRename: (n: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  return (
    <input
      className="proj-name"
      value={draft ?? name}
      aria-label="Project name"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (!cancelled.current && draft !== null && draft !== name) onRename(draft);
        cancelled.current = false;
        setDraft(null);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          cancelled.current = true;
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function SaveBadge() {
  const status = useStore((s) => s.saveStatus);
  const label = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved', error: 'Not saved' }[status];
  return (
    <span className={`save-badge s-${status}`} title={status === 'error' ? 'Browser storage unavailable' : 'Autosaves locally'}>
      <i />
      {label}
    </span>
  );
}

export function TopBar({ panels, onTogglePanel, focus, onToggleFocus, scale, onScale, onHelp, compact }: Props) {
  const playing = useLive((s) => s.playing);
  const fillQueued = useLive((s) => s.fillQueued);
  const project = useStore((s) => s.project);
  const { setKeyRoot, setMode, setCompat, setQuantize, setMasterVolume, undo, redo, renameProject } = useStore.getState();
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);

  return (
    <header className={`topbar ${compact ? 'compact' : ''}`}>
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          <i />
        </span>
        <span className="brand-name">
          LoopLab<b>Studio</b>
        </span>
      </div>

      <div className="transport">
        <button
          className={`play ${playing ? 'on' : ''}`}
          onClick={() => void engine.toggle()}
          aria-label={playing ? 'Stop' : 'Play'}
          title={playing ? 'Stop (Space)' : 'Play (Space)'}
        >
          {playing ? <span className="ico-stop" /> : <span className="ico-play" />}
        </button>
        <button
          className={`btn fill-btn ${fillQueued ? 'queued' : ''}`}
          disabled={!playing}
          onClick={() => engine.queueFill()}
          title="Drum fill on the next bar (F)"
        >
          Fill
        </button>
        <BpmControl />
        <SoundSwitch />
      </div>

      {!compact && (
        <div className="tb-group">
          <label className="tb-field">
            <span>Key</span>
            <select value={project.harmony.root} onChange={(e) => setKeyRoot(Number(e.target.value))} aria-label="Key">
              {NOTE_NAMES.map((n, i) => (
                <option key={n} value={i}>{n}</option>
              ))}
            </select>
            <select value={project.harmony.mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label="Mode">
              {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
                <option key={m} value={m}>{MODE_LABEL[m]}</option>
              ))}
            </select>
          </label>
          <span className="tb-field static mono" title="Time signature">4/4</span>
          <label className="tb-field">
            <span>Launch</span>
            <select value={project.quantize} onChange={(e) => setQuantize(e.target.value as Quantize)} aria-label="Launch quantize">
              <option value="beat">Next beat</option>
              <option value="bar">Next bar</option>
              <option value="2bar">Next 2 bars</option>
              <option value="4bar">Next phrase (4)</option>
            </select>
          </label>
          <div className="tb-field" title={COMPAT_INFO[project.compat]}>
            <span>Mix mode</span>
            <Segmented<CompatMode>
              label="Compatibility mode"
              value={project.compat}
              onChange={setCompat}
              options={[
                { value: 'safe', label: 'Safe', title: COMPAT_INFO.safe },
                { value: 'creative', label: 'Creative', title: COMPAT_INFO.creative },
                { value: 'wild', label: 'Wild', title: COMPAT_INFO.wild },
              ]}
            />
          </div>
        </div>
      )}

      <div className="tb-spacer" />

      {!compact && (
        <div className="tb-group">
          <label className="tb-field master">
            <span>Master</span>
            <Fader label="Master volume" value={project.masterVolume} onChange={setMasterVolume} color="#e7ecf7" />
          </label>
          <button className="ibtn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">↶</button>
          <button className="ibtn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">↷</button>
        </div>
      )}

      <div className="tb-group project">
        <ProjectName name={project.name} onRename={renameProject} />
        <SaveBadge />
        <ProjectMenu />
      </div>

      {!compact && (
        <div className="tb-group panels">
          <button className={`ibtn ${panels.browser ? 'on' : ''}`} onClick={() => onTogglePanel('browser')} title="Toggle groove browser" aria-label="Toggle groove browser">◧</button>
          <button className={`ibtn ${panels.bottom ? 'on' : ''}`} onClick={() => onTogglePanel('bottom')} title="Toggle mixer" aria-label="Toggle mixer">⬓</button>
          <button className={`ibtn ${panels.inspector ? 'on' : ''}`} onClick={() => onTogglePanel('inspector')} title="Toggle inspector" aria-label="Toggle inspector">◨</button>
          <button className={`ibtn ${focus ? 'on' : ''}`} onClick={onToggleFocus} title="Maximise the deck" aria-label="Maximise the deck">⛶</button>
          <select className="scale-select" value={scale} onChange={(e) => onScale(Number(e.target.value))} aria-label="Interface scale" title="Interface scale">
            {[0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6].map((s) => (
              <option key={s} value={s}>{Math.round(s * 100)}%</option>
            ))}
          </select>
          <button className="ibtn" onClick={onHelp} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">?</button>
        </div>
      )}
    </header>
  );
}
