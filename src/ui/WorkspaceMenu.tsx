import { useRef } from 'react';
import { useHelp, type HelpLevel } from '@/help/helpStore';
import { startTour } from '@/tour/tourStore';
import { useUi, type Density } from '@/state/ui';
import { Segmented } from './components';
import { useDismiss } from './ProjectMenu';

export function WorkspaceMenu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  const ui = useUi();
  const level = useHelp((s) => s.level);
  const setLevel = useHelp((s) => s.setLevel);
  const openHelp = useHelp((s) => s.openCenter);

  return (
    <div className="popover menu workspace-menu" ref={ref} role="dialog" aria-label="Workspace">
      <div className="menu-label">Panels</div>
      <label className="menu-check">
        <input type="checkbox" checked={ui.panels.library} onChange={() => ui.togglePanel('library')} /> Groove Library
      </label>
      <label className="menu-check">
        <input type="checkbox" checked={ui.panels.lab} onChange={() => ui.togglePanel('lab')} /> Sound Lab
      </label>
      <label className="menu-check">
        <input type="checkbox" checked={ui.panels.dock} onChange={() => ui.togglePanel('dock')} /> Mixer &amp; sections dock
      </label>
      <label className="menu-check">
        <input type="checkbox" checked={ui.focus} onChange={() => ui.set({ focus: !ui.focus })} /> Focus on Live Mix
      </label>
      <hr />
      <div className="menu-label">Interface size</div>
      <div className="menu-row" data-help="ui-scale">
        <input
          type="range"
          min={0.8}
          max={1.6}
          step={0.05}
          value={ui.scale}
          aria-label="Interface size"
          onChange={(e) => ui.set({ scale: Number(e.target.value) })}
        />
        <span className="mono">{Math.round(ui.scale * 100)}%</span>
      </div>
      <div className="menu-label">Density</div>
      <Segmented<Density>
        label="Density"
        value={ui.density}
        onChange={(d) => ui.set({ density: d })}
        options={[
          { value: 'comfortable', label: 'Comfortable' },
          { value: 'compact', label: 'Compact' },
        ]}
      />
      <hr />
      <div className="menu-label">Help level</div>
      <Segmented<HelpLevel>
        label="Help level"
        value={level}
        onChange={setLevel}
        options={[
          { value: 'beginner', label: 'Beginner' },
          { value: 'standard', label: 'Standard' },
          { value: 'expert', label: 'Expert' },
        ]}
      />
      <hr />
      <button className="menu-item" onClick={() => { startTour('first-mix'); onClose(); }}>Restart the guided tour</button>
      <button className="menu-item" onClick={() => { openHelp('shortcuts'); onClose(); }}>Keyboard shortcuts</button>
      <button className="menu-item" onClick={() => { ui.set({ panels: { library: true, lab: true, dock: true }, focus: false, scale: 1, density: 'comfortable' }); onClose(); }}>
        Reset layout
      </button>
    </div>
  );
}
