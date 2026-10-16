import { useEffect, useRef, useState } from 'react';
import { engine } from '@/engine/engine';
import { useLive, type SoundMode } from '@/engine/live';
import { useHelp } from '@/help/helpStore';
import type { CompatMode } from '@/music/compat';
import { MODE_LABEL, NOTE_NAMES } from '@/music/theory';
import type { Mode } from '@/music/types';
import { lookupPattern, useStore } from '@/state/store';
import { useUi } from '@/state/ui';
import { saveManually } from '@/state/persistence';
import { Segmented } from './components';
import {
  IconChevronDown,
  IconCloud,
  IconHelp,
  IconMenu,
  IconNote,
  IconPlay,
  IconRecord,
  IconRedo,
  IconRestart,
  IconStop,
  IconUndo,
} from './icons';
import { ProjectMenu } from './ProjectMenu';
import { WorkspaceMenu } from './WorkspaceMenu';

function Logo() {
  return (
    <div className="brand" aria-label="LoopLab Studio">
      <svg className="brand-mark" viewBox="0 0 40 32" aria-hidden>
        <defs>
          <linearGradient id="brandg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7c5cff" />
            <stop offset="0.5" stopColor="#c86bff" />
            <stop offset="1" stopColor="#ff6bd5" />
          </linearGradient>
        </defs>
        {[4, 10, 18, 26, 14, 22, 30, 12, 6].map((h, i) => (
          <rect key={i} x={i * 4.4 + 1} y={16 - h / 2} width="2.6" height={h} rx="1.3" fill="url(#brandg)" />
        ))}
      </svg>
      <div className="brand-text">
        <div className="brand-name">
          LoopLab <span>Studio</span>
        </div>
        <div className="brand-tag">Mix / Match / Make Music</div>
      </div>
    </div>
  );
}

function Transport() {
  const playing = useLive((s) => s.playing);
  return (
    <div className="transport" role="group" aria-label="Transport">
      <button className="tbtn" aria-label="Back to start" data-help="restart" onClick={() => void engine.restart()}>
        <IconRestart />
      </button>
      <button
        className={`tbtn play ${playing ? 'on' : ''}`}
        aria-label={playing ? 'Stop' : 'Play'}
        aria-pressed={playing}
        data-help="play"
        data-tour="play"
        onClick={() => void engine.toggle()}
      >
        <IconPlay size={22} />
      </button>
      <button className="tbtn" aria-label="Stop" data-help="stop" onClick={() => engine.stop()}>
        <IconStop />
      </button>
      <button className="tbtn record" aria-label="Capture (coming soon)" data-help="record" aria-disabled="true" disabled>
        <IconRecord />
      </button>
    </div>
  );
}

function Bpm() {
  const bpm = useStore((s) => s.project.bpm);
  const setBpm = useStore((s) => s.setBpm);
  const [draft, setDraft] = useState<string | null>(null);
  const drag = useRef<{ y: number; v: number; moved: boolean } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useStore.getState();
      s.setBpm(s.project.bpm + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.5 : 1));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  return (
    <div className="tb-card bpm" ref={boxRef} data-help="bpm" data-tour="bpm">
      <button className="bpm-step" aria-label="Slower" onClick={() => setBpm(bpm - 1)}>−</button>
      <input
        className="bpm-value"
        aria-label="Tempo in beats per minute"
        inputMode="numeric"
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
        onPointerDown={(e) => {
          drag.current = { y: e.clientY, v: bpm, moved: false };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dy = drag.current.y - e.clientY;
          if (Math.abs(dy) > 3) {
            drag.current.moved = true;
            setBpm(drag.current.v + Math.round(dy / 4));
          }
        }}
        onPointerUp={() => (drag.current = null)}
      />
      <span className="bpm-unit">BPM</span>
      <button className="bpm-step" aria-label="Faster" onClick={() => setBpm(bpm + 1)}>+</button>
    </div>
  );
}

function KeySelect() {
  const harmony = useStore((s) => s.project.harmony);
  const { setKeyRoot, setMode } = useStore.getState();
  return (
    <div className="tb-card key" data-help="key">
      <IconNote size={16} />
      <select value={harmony.root} onChange={(e) => setKeyRoot(Number(e.target.value))} aria-label="Key root note">
        {NOTE_NAMES.map((n, i) => (
          <option key={n} value={i}>{n}</option>
        ))}
      </select>
      <select value={harmony.mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label="Scale">
        {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
          <option key={m} value={m}>{MODE_LABEL[m]}</option>
        ))}
      </select>
    </div>
  );
}

function relTime(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

function SaveStatus() {
  const status = useStore((s) => s.saveStatus);
  const updatedAt = useStore((s) => s.project.updatedAt);
  const [, tick] = useState(0);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => tick((x) => x + 1), 20000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (status !== 'saved') return;
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 900);
    return () => window.clearTimeout(t);
  }, [status, updatedAt]);
  const label = status === 'saving' ? 'Saving…' : status === 'unsaved' ? 'Unsaved changes' : status === 'error' ? 'Not saved' : `Saved ${relTime(updatedAt)}`;
  return (
    <button className={`save-status s-${status} ${pulse ? 'pulse' : ''}`} onClick={() => void saveManually()} data-help="save" data-tour="save" aria-label={`${label}. Click to save now.`}>
      <IconCloud size={20} />
      <span>{label}</span>
    </button>
  );
}

function ProjectCard() {
  const project = useStore((s) => s.project);
  const rename = useStore((s) => s.renameProject);
  const [draft, setDraft] = useState<string | null>(null);
  const cancel = useRef(false);
  const genres = Array.from(
    new Set(project.tracks.map((t) => lookupPattern(project, t.patternId)?.genre).filter(Boolean) as string[]),
  ).slice(0, 3);
  const [open, setOpen] = useState(false);
  return (
    <div className="tb-card project">
      <div className="project-main">
        <input
          className="project-name"
          aria-label="Project name"
          data-help="project"
          data-tour="project-name"
          value={draft ?? project.name}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (!cancel.current && draft !== null && draft.trim() && draft !== project.name) rename(draft);
            cancel.current = false;
            setDraft(null);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              cancel.current = true;
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <div className="project-tags" data-help="genre-tags">
          {genres.map((g) => (
            <span key={g} className="tag">{g}</span>
          ))}
        </div>
      </div>
      <button className="ibtn ghost" aria-label="Project menu" aria-expanded={open} data-help="menu" onClick={() => setOpen(!open)}>
        <IconChevronDown />
      </button>
      {open && <ProjectMenu onClose={() => setOpen(false)} />}
    </div>
  );
}

function SoundSwitch() {
  const mode = useLive((s) => s.soundMode);
  const pending = useLive((s) => s.samplesPending);
  return (
    <div className="tb-card sound">
      <Segmented<SoundMode>
        label="Sound engine"
        help="sound-mode"
        value={mode}
        onChange={(m) => engine.setSoundMode(m)}
        options={[
          { value: 'sampled', label: 'Studio' },
          { value: 'synth', label: 'Classic' },
        ]}
      />
      {mode === 'sampled' && pending > 0 && <span className="loading-dot" aria-label="Loading sounds" />}
    </div>
  );
}

export function TopBar({ compact = false }: { compact?: boolean }) {
  const compat = useStore((s) => s.project.compat);
  const { setCompat, undo, redo } = useStore.getState();
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const openHelp = useHelp((s) => s.openCenter);
  const learnMode = useHelp((s) => s.learnMode);
  const setLearnMode = useHelp((s) => s.setLearnMode);
  const [menu, setMenu] = useState(false);
  const focus = useUi((s) => s.focus);

  return (
    <header className={`topbar ${compact ? 'compact' : ''}`}>
      <Logo />
      <Transport />
      <Bpm />
      {!compact && <KeySelect />}
      {!compact && (
        <div className="tb-card compat" data-tour="compat">
          <span className="tb-label">Compatibility</span>
          <Segmented<CompatMode>
            label="Mixing mode"
            help="compat"
            value={compat}
            onChange={setCompat}
            options={[
              { value: 'safe', label: 'Safe', help: 'compat' },
              { value: 'creative', label: 'Creative', help: 'compat' },
              { value: 'wild', label: 'Wild', help: 'compat' },
            ]}
          />
        </div>
      )}
      {!compact && <SoundSwitch />}
      <div className="tb-spacer" />
      <ProjectCard />
      <SaveStatus />
      {!compact && (
        <div className="tb-group">
          <button className="ibtn ghost" onClick={undo} disabled={!canUndo} aria-label="Undo" data-help="undo" data-tour="undo">
            <IconUndo />
          </button>
          <button className="ibtn ghost" onClick={redo} disabled={!canRedo} aria-label="Redo" data-help="redo">
            <IconRedo />
          </button>
        </div>
      )}
      <button
        className={`learn-toggle learn-exempt ${learnMode ? 'on' : ''}`}
        aria-pressed={learnMode}
        onClick={() => setLearnMode(!learnMode)}
        data-help="learn-mode"
      >
        {learnMode ? 'Learn mode on' : 'Learn'}
      </button>
      <button className="help-btn learn-exempt" aria-label="Help Center" data-help="help" data-tour="help" onClick={() => openHelp()}>
        <IconHelp size={20} />
        {!compact && <span>Help</span>}
      </button>
      <div className="menu-wrap">
        <button className={`ibtn ghost ${focus ? 'on' : ''}`} aria-label="Workspace menu" aria-expanded={menu} data-help="layout" onClick={() => setMenu(!menu)}>
          <IconMenu />
        </button>
        {menu && <WorkspaceMenu onClose={() => setMenu(false)} />}
      </div>
    </header>
  );
}
