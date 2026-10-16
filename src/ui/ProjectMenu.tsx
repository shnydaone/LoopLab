import { useEffect, useRef, useState } from 'react';
import {
  duplicateProject,
  exportCurrent,
  importFile,
  newProject,
  openProject,
  removeProject,
  saveManually,
  useProjects,
} from '@/state/persistence';
import { useStore } from '@/state/store';

/** Close a popover on outside click or Escape. */
export function useDismiss(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const t = window.setTimeout(() => window.addEventListener('mousedown', down), 0);
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('mousedown', down);
      window.removeEventListener('keydown', key);
    };
  }, [ref, onClose]);
}

export function ProjectMenu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const list = useProjects((s) => s.list);
  const project = useStore((s) => s.project);
  const rename = useStore((s) => s.renameProject);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  useDismiss(ref, onClose);

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <div className="popover menu project-menu" ref={ref} role="menu" aria-label="Project">
      <button role="menuitem" onClick={act(() => void newProject())}>New project</button>
      <button role="menuitem" onClick={act(() => void saveManually())}>
        Save now <kbd>Ctrl S</kbd>
      </button>
      <button role="menuitem" onClick={act(() => void duplicateProject())}>Duplicate</button>
      <button
        role="menuitem"
        onClick={act(() => {
          const name = window.prompt('Rename project', project.name);
          if (name !== null && name.trim()) rename(name);
        })}
      >
        Rename…
      </button>
      <hr />
      <button role="menuitem" data-help="export-json" onClick={act(exportCurrent)}>Export project file</button>
      <button role="menuitem" data-help="import-json" onClick={() => fileRef.current?.click()}>Import project file…</button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = '';
          onClose();
        }}
      />
      <hr />
      <div className="menu-label">Your projects</div>
      <div className="menu-list">
        {list.map((m) => (
          <div key={m.id} className={`menu-proj ${m.id === project.id ? 'current' : ''}`}>
            <button className="menu-proj-open" onClick={act(() => void openProject(m.id))}>
              <span>{m.name}</span>
              <small>{new Date(m.updatedAt).toLocaleString()}</small>
            </button>
            {confirmId === m.id ? (
              <button className="menu-del confirm" onClick={() => { void removeProject(m.id); setConfirmId(null); }}>
                Delete?
              </button>
            ) : (
              <button className="menu-del" aria-label={`Delete ${m.name}`} onClick={() => setConfirmId(m.id)}>✕</button>
            )}
          </div>
        ))}
        {list.length === 0 && <div className="menu-empty">No saved projects yet</div>}
      </div>
    </div>
  );
}
