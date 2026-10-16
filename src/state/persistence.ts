/** Autosave + project management actions (IndexedDB backed). */
import { createProject, uid } from '@/project/factory';
import { validateProject } from '@/project/schema';
import {
  deleteProject as dbDelete,
  downloadText,
  exportProjectJson,
  lastProjectId,
  listProjects,
  loadProject,
  saveProject,
} from '@/project/storage';
import type { ProjectMeta } from '@/project/types';
import { useStore } from './store';
import { create } from 'zustand';

export const useProjects = create<{ list: ProjectMeta[]; refresh: () => Promise<void> }>((set) => ({
  list: [],
  refresh: async () => set({ list: await listProjects() }),
}));

let timer: ReturnType<typeof setTimeout> | null = null;
let booted = false;

export async function saveNow() {
  const { project, setSaveStatus } = useStore.getState();
  if (timer) clearTimeout(timer);
  timer = null;
  setSaveStatus('saving');
  try {
    await saveProject(project);
    // Only mark saved if nothing changed while we were writing.
    if (useStore.getState().project === project) setSaveStatus('saved');
    void useProjects.getState().refresh();
  } catch (err) {
    console.error('[autosave] failed', err);
    setSaveStatus('error');
  }
}

/** User-initiated save (Save button / Ctrl+S): counts as a real save action for the tour. */
export async function saveManually() {
  await saveNow();
  useStore.getState().bump('save');
  useStore.getState().toast(`Saved “${useStore.getState().project.name}”`, 'good');
}

export async function bootstrap() {
  if (booted) return;
  booted = true;
  try {
    const last = await lastProjectId();
    const p = last ? await loadProject(last) : null;
    if (p) useStore.getState().replaceProject(p);
    else await saveNow();
  } catch (err) {
    console.warn('[bootstrap] storage unavailable, running unsaved', err);
    useStore.getState().setSaveStatus('error');
  }
  void useProjects.getState().refresh();

  useStore.subscribe((s, prev) => {
    if (s.project === prev.project) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void saveNow(), 700);
  });
  window.addEventListener('beforeunload', () => {
    if (useStore.getState().saveStatus === 'unsaved') void saveNow();
  });
}

export async function newProject(packId?: string, name?: string, quiet = false) {
  await saveNow();
  const p = createProject(packId, name);
  useStore.getState().replaceProject(p);
  await saveNow();
  if (!quiet) useStore.getState().toast('New project created', 'good');
}

export async function openProject(id: string) {
  await saveNow();
  const p = await loadProject(id);
  if (!p) {
    useStore.getState().toast('That project could not be opened', 'warn');
    return;
  }
  useStore.getState().replaceProject(p);
  await saveNow();
  useStore.getState().toast(`Opened “${p.name}”`, 'good');
}

export async function duplicateProject() {
  await saveNow();
  const cur = useStore.getState().project;
  const now = Date.now();
  const copy = { ...structuredClone(cur), id: uid('prj'), name: `${cur.name} (copy)`, createdAt: now, updatedAt: now };
  useStore.getState().replaceProject(copy);
  await saveNow();
  useStore.getState().toast('Project duplicated', 'good');
}

export async function removeProject(id: string) {
  await dbDelete(id);
  const { project } = useStore.getState();
  if (project.id === id) {
    const remaining = await listProjects();
    const next = remaining[0] ? await loadProject(remaining[0].id) : null;
    useStore.getState().replaceProject(next ?? createProject());
    await saveNow();
  }
  await useProjects.getState().refresh();
  useStore.getState().toast('Project deleted');
}

export function exportCurrent() {
  const p = useStore.getState().project;
  const safe = p.name.replace(/[^\w\- ]+/g, '').trim() || 'looplab-project';
  downloadText(`${safe}.looplab.json`, exportProjectJson(p));
}

export async function importFile(file: File) {
  try {
    const text = await file.text();
    const res = validateProject(JSON.parse(text));
    if (!res.ok) {
      useStore.getState().toast(`Import failed: ${res.error}`, 'warn');
      return;
    }
    await saveNow();
    const imported = { ...res.project, id: uid('prj'), updatedAt: Date.now() };
    useStore.getState().replaceProject(imported);
    await saveNow();
    useStore.getState().toast(`Imported “${imported.name}”`, 'good');
  } catch {
    useStore.getState().toast('Import failed: not a valid JSON file', 'warn');
  }
}
