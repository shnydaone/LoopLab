import { useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { engine } from '@/engine/engine';
import { HelpCenter, WelcomePrompt } from '@/help/HelpCenter';
import { HelpLayer } from '@/help/HelpLayer';
import { useHelp } from '@/help/helpStore';
import { saveManually } from '@/state/persistence';
import { useStore } from '@/state/store';
import { useUi, type MobileTab } from '@/state/ui';
import { TourOverlay } from '@/tour/TourOverlay';
import { Dock } from './Dock';
import { useMediaQuery } from './hooks';
import { IconChevronLeft, IconChevronRight, IconChevronDown } from './icons';
import { Library } from './Library';
import { LiveMix } from './LiveMix';
import { SoundLab } from './SoundLab';
import { TopBar } from './TopBar';

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Space / Enter on a focused button should press that button, not the transport. */
function onControl(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el?.closest('button, a, [role="slider"], [role="tab"], [role="radio"], [role="menuitem"]');
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveManually();
        return;
      }
      if (mod && e.key.toLowerCase() === 'z' && !isTyping(e)) {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y' && !isTyping(e)) {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod || e.altKey || isTyping(e) || useHelp.getState().centerOpen) return;
      const sel = s.selectedTrackId;
      switch (e.key) {
        case ' ':
          if (onControl(e)) return;
          e.preventDefault();
          void engine.toggle();
          break;
        case 'ArrowLeft':
          if (onControl(e)) return;
          e.preventDefault();
          s.cyclePattern(sel, -1);
          break;
        case 'ArrowRight':
          if (onControl(e)) return;
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
          useHelp.getState().openCenter();
          break;
        default:
          if (/^[1-9]$/.test(e.key)) {
            const t = s.project.tracks[Number(e.key) - 1];
            if (t) s.selectTrack(t.id);
          }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
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

function Overlays() {
  return (
    <>
      <Toasts />
      <WelcomePrompt />
      <TourOverlay />
      <HelpCenter />
      <HelpLayer />
    </>
  );
}

const MOBILE_TABS: [MobileTab, string][] = [
  ['deck', 'Live Mix'],
  ['library', 'Library'],
  ['lab', 'Sound Lab'],
  ['mixer', 'Mixer'],
];

export function App() {
  const mobile = useMediaQuery('(max-width: 820px)');
  const panels = useUi((s) => s.panels);
  const focus = useUi((s) => s.focus);
  const scale = useUi((s) => s.scale);
  const density = useUi((s) => s.density);
  const mobileTab = useUi((s) => s.mobileTab);
  const setUi = useUi((s) => s.set);
  const togglePanel = useUi((s) => s.togglePanel);
  useShortcuts();

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(scale));
    document.documentElement.dataset.density = density;
  }, [scale, density]);

  if (mobile) {
    return (
      <div className="app mobile">
        <TopBar compact />
        <main className="mobile-main">
          {mobileTab === 'deck' && <LiveMix />}
          {mobileTab === 'library' && <Library />}
          {mobileTab === 'lab' && <SoundLab />}
          {mobileTab === 'mixer' && <Dock />}
        </main>
        <nav className="mobile-tabs" aria-label="Views">
          {MOBILE_TABS.map(([id, label]) => (
            <button key={id} className={mobileTab === id ? 'on' : ''} aria-current={mobileTab === id ? 'page' : undefined} onClick={() => setUi({ mobileTab: id })}>
              {label}
            </button>
          ))}
        </nav>
        <Overlays />
      </div>
    );
  }

  const show = (p: keyof typeof panels) => panels[p] && !focus;

  return (
    <div className="app">
      <TopBar />
      <main className="workspace">
        {!show('library') && (
          <button className="rail rail-left" onClick={() => (focus ? setUi({ focus: false }) : togglePanel('library'))} aria-label="Show Groove Library">
            <IconChevronRight size={16} />
            <span>Groove Library</span>
          </button>
        )}
        <PanelGroup direction="vertical" autoSaveId="looplab:v2" className="ws-v">
          <Panel id="top" order={1} minSize={40}>
            <PanelGroup direction="horizontal" autoSaveId="looplab:h2">
              {show('library') && (
                <>
                  <Panel id="library" order={1} defaultSize={17} minSize={12} maxSize={30}>
                    <Library />
                  </Panel>
                  <PanelResizeHandle className="resize-h" />
                </>
              )}
              <Panel id="center" order={2} minSize={35}>
                <LiveMix />
              </Panel>
              {show('lab') && (
                <>
                  <PanelResizeHandle className="resize-h" />
                  <Panel id="lab" order={3} defaultSize={24} minSize={16} maxSize={38}>
                    <SoundLab />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
          {show('dock') && (
            <>
              <PanelResizeHandle className="resize-v" />
              <Panel id="dock" order={2} defaultSize={27} minSize={18} maxSize={50}>
                <Dock />
              </Panel>
            </>
          )}
        </PanelGroup>
        {!show('lab') && (
          <button className="rail rail-right" onClick={() => (focus ? setUi({ focus: false }) : togglePanel('lab'))} aria-label="Show Sound Lab">
            <IconChevronLeft size={16} />
            <span>Sound Lab</span>
          </button>
        )}
      </main>
      {!show('dock') && (
        <button className="rail rail-bottom" onClick={() => (focus ? setUi({ focus: false }) : togglePanel('dock'))} aria-label="Show mixer and sections">
          <IconChevronDown size={16} style={{ transform: 'rotate(180deg)' }} /> Mixer, sections and export
        </button>
      )}
      <Overlays />
    </div>
  );
}
