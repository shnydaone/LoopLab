/** Local-first persistence in IndexedDB (via idb-keyval). */
import { createStore, del, get, set } from 'idb-keyval';
import type { Project, ProjectMeta } from './types';
import { validateProject } from './schema';

const store = createStore('looplab', 'projects');
const INDEX = 'index';
const LAST = 'last-project';

const key = (id: string) => `project:${id}`;

export async function listProjects(): Promise<ProjectMeta[]> {
  const idx = (await get<ProjectMeta[]>(INDEX, store)) ?? [];
  return [...idx].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveProject(p: Project): Promise<void> {
  await set(key(p.id), p, store);
  const idx = (await get<ProjectMeta[]>(INDEX, store)) ?? [];
  const meta: ProjectMeta = { id: p.id, name: p.name, updatedAt: p.updatedAt, basePackId: p.basePackId };
  const next = [meta, ...idx.filter((m) => m.id !== p.id)];
  await set(INDEX, next, store);
  await set(LAST, p.id, store);
}

export async function loadProject(id: string): Promise<Project | null> {
  const raw = await get(key(id), store);
  if (!raw) return null;
  const res = validateProject(raw);
  if (!res.ok) {
    console.warn('[storage] stored project failed validation', id, res.error);
    return null;
  }
  return res.project;
}

export async function deleteProject(id: string): Promise<void> {
  await del(key(id), store);
  const idx = (await get<ProjectMeta[]>(INDEX, store)) ?? [];
  await set(INDEX, idx.filter((m) => m.id !== id), store);
  if ((await get(LAST, store)) === id) await del(LAST, store);
}

export async function lastProjectId(): Promise<string | null> {
  return (await get<string>(LAST, store)) ?? null;
}

export function exportProjectJson(p: Project): string {
  return JSON.stringify(p, null, 2);
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
