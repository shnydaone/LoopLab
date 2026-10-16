import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { engine } from '@/engine/engine';
import { saveNow } from '@/state/persistence';
import { useStore } from '@/state/store';
import { BottomPanel } from './BottomPanel';
import { Browser } from './Browser';
import { Deck } from './Deck';
import { useMediaQuery, usePref } from './hooks';
import { Inspector } from './Inspector';
import { TopBar, type PanelId } from './TopBar';

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / stop'],
  ['1 – 6', 'Select track'],
  ['← / →', 'Previous / next part on the selected track'],
  ['M / S / L', 'Mute / solo / lock selected track'],
  ['V', 'Generate a variation of the selected part'],
  ['F', 'Drum fill on the next bar'],
  ['B / D', 'Build-up (2 bars, then drop) / Drop now'],
  ['Wheel (+ Shift)', 'Turn a knob (fine steps with Shift)'],
  ['R', 'Remix unlocked parts'],
  ['Shift + S', 'Surprise Me'],
  ['[ / ]', 'Energy down / up'],
  ['Ctrl + Z / Ctrl + Shift + Z', 'Undo / redo'],
  ['Ctrl + S', 'Save now'],
  ['?', 'Show this help'],
];

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function useShortcuts(onHelp: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveNow();
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod || e.altKey || isTyping(e)) return;
      const tracks = s.project.tracks;
      const sel = s.selectedTrackId;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          void engine.toggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          s.cyclePattern(sel, -1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          s.cyclePattern(sel, 1);
          break;
        case 'm':
        case 'M':
          s.toggleMute(sel);
          break;
        case 's':
          s.toggleSolo(sel);
          break;
        case 'S':
          s.surpriseMe();
          break;
        case 'l':
        case 'L':
          s.toggleLock(sel);
          break;
        case 'v':
        case 'V':
          s.mutateTrack(sel);
          break;
        case 'f':
        case 'F':
          engine.queueFill();
          break;
        case 'b':
        case 'B':
          engine.queueBuild(2);
          break;
        case 'd':
        case 'D':
          engine.queueDrop();
          break;
        case 'r':
        case 'R':
          s.remixParts();
          break;
        case '[':
          s.evolveEnergy(-1);
          break;
        case ']':
          s.evolveEnergy(1);
          break;
        case '?':
          onHelp();
          break;
        default:
          if (/^[1-9]$/.test(e.key)) {
            const t = tracks[Number(e.key) - 1];
            if (t) s.selectTrack(t.id);
          }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onHelp]);
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast t-${t.tone}`} onClick={() => dismiss(t.id)}>
          {t.text}
        </button>
      ))}
    </div>
  );
}

function Help({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <h2>Keyboard shortcuts</h2>
        <dl className="shortcuts">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k}>
              <dt><kbd>{k}</kbd></dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
        <button className="btn accent" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

type MobileTab = 'deck' | 'grooves' | 'mixer' | 'tools';

export function App() {
  const mobile = useMediaQuery('(max-width: 820px)');
  const [panels, setPanels] = usePref<Record<PanelId, boolean>>('panels', { browser: true, inspector: true, bottom: true });
  const [focus, setFocus] = usePref('focus', false);
  const [scale, setScale] = usePref('ui-scale', 1);
  const [help, setHelp] = useState(false);
  const [tab, setTab] = useState<MobileTab>('deck');
  useShortcuts(() => setHelp(true));

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(scale));
  }, [scale]);

  const toggle = (p: PanelId) => setPanels({ ...panels, [p]: !panels[p] });
  const show = (p: PanelId) => panels[p] && !focus;

  if (mobile) {
    return (
      <div className="app mobile">
        <TopBar
          compact
          panels={panels}
          onTogglePanel={toggle}
          focus={focus}
          onToggleFocus={() => setFocus(!focus)}
          scale={scale}
          onScale={setScale}
          onHelp={() => setHelp(true)}
        />
        <main className="mobile-main">
          {tab === 'deck' && <Deck />}
          {tab === 'grooves' && <Browser />}
          {tab === 'mixer' && <BottomPanel />}
          {tab === 'tools' && <Inspector />}
        </main>
        <nav className="mobile-tabs" aria-label="Sections">
          {(
            [
              ['deck', 'Deck'],
              ['grooves', 'Grooves'],
              ['mixer', 'Mixer'],
              ['tools', 'Track'],
            ] as [MobileTab, string][]
          ).map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <Toasts />
        {help && <Help onClose={() => setHelp(false)} />}
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar
        panels={panels}
        onTogglePanel={toggle}
        focus={focus}
        onToggleFocus={() => setFocus(!focus)}
        scale={scale}
        onScale={setScale}
        onHelp={() => setHelp(true)}
      />
      <main className="workspace">
        <PanelGroup direction="vertical" autoSaveId="looplab:v">
          <Panel id="top" order={1} minSize={35}>
            <PanelGroup direction="horizontal" autoSaveId="looplab:h">
              {show('browser') && (
                <>
                  <Panel id="browser" order={1} defaultSize={19} minSize={12} maxSize={35}>
                    <Browser />
                  </Panel>
                  <PanelResizeHandle className="resize-h" />
                </>
              )}
              <Panel id="deck" order={2} minSize={30}>
                <Deck />
              </Panel>
              {show('inspector') && (
                <>
                  <PanelResizeHandle className="resize-h" />
                  <Panel id="inspector" order={3} defaultSize={20} minSize={13} maxSize={35}>
                    <Inspector />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
          {show('bottom') && (
            <>
              <PanelResizeHandle className="resize-v" />
              <Panel id="bottom" order={2} defaultSize={30} minSize={16} maxSize={55}>
                <BottomPanel />
              </Panel>
            </>
          )}
        </PanelGroup>
      </main>
      <Toasts />
      {help && <Help onClose={() => setHelp(false)} />}
    </div>
  );
}
