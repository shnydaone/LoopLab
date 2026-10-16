/**
 * Guided-tour state. A tour is a list of steps; each step may spotlight a
 * control and may require real actions ("tasks") before it can complete.
 *
 * Tasks are detected from the real app state, never simulated:
 *  - `events` counters bumped by store actions (loadGroove, section, save…)
 *  - a `seen` set filled by diffing the project on every change
 *    (volume, mute, solo, pattern:<role>, name, bpm…)
 *  - the live engine state (playing)
 *
 * Every tour runs in its own practice project, so lessons never modify the
 * user's saved work. The previous project can be reopened at the end.
 */
import { create } from 'zustand';
import { newProject, openProject, saveNow } from '@/state/persistence';
import { useStore } from '@/state/store';
import type { Project } from '@/project/types';
import { TOURS, type Tour } from './tours';

const KEY = 'looplab:tour';
let lastGoto = 0;

interface Persisted {
  completed: Record<string, number>;
  /** Unfinished tour to offer to resume. */
  pending: { id: string; step: number; projectId: string; prevProjectId: string | null } | null;
  /** First-visit welcome dismissed. */
  welcomed: boolean;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { completed: {}, pending: null, welcomed: false, ...(JSON.parse(raw) as Partial<Persisted>) };
  } catch {
    /* ignore */
  }
  return { completed: {}, pending: null, welcomed: false };
}

interface TourState extends Persisted {
  active: string | null;
  step: number;
  projectId: string | null;
  prevProjectId: string | null;
  /** Event counters when the current step began. */
  baseline: Record<string, number>;
  /** Project when the current step began. */
  snapshot: Project | null;
  seen: string[];
  starting: boolean;
  next: () => void;
  back: () => void;
  goto: (i: number) => void;
  retryStep: () => void;
  /** Leave the tour; progress is kept so it can be resumed. */
  exit: () => void;
  finish: () => void;
  dismissWelcome: () => void;
  markSeen: (keys: string[]) => void;
}

export const useTour = create<TourState>((set, get) => ({
  ...load(),
  active: null,
  step: 0,
  projectId: null,
  prevProjectId: null,
  baseline: {},
  snapshot: null,
  seen: [],
  starting: false,
  next: () => get().goto(get().step + 1),
  back: () => get().goto(Math.max(0, get().step - 1)),
  goto: (i) => {
    const tour = currentTour();
    if (!tour) return;
    // A double-click on Next must not skip the following step.
    const now = performance.now();
    if (now - lastGoto < 400) return;
    lastGoto = now;
    if (i >= tour.steps.length) {
      get().finish();
      return;
    }
    set({ step: i, ...stepBaseline() });
    tour.steps[i].onEnter?.();
    persist();
  },
  retryStep: () => {
    set(stepBaseline());
    currentTour()?.steps[get().step].onEnter?.();
  },
  exit: () => {
    set({ active: null });
    persist();
  },
  finish: () => {
    const id = get().active;
    if (!id) return;
    set({ active: null, completed: { ...get().completed, [id]: Date.now() }, pending: null });
    persist();
  },
  dismissWelcome: () => {
    set({ welcomed: true });
    persist();
  },
  markSeen: (keys) => {
    const seen = get().seen;
    const add = keys.filter((k) => !seen.includes(k));
    if (add.length) set({ seen: [...seen, ...add] });
  },
}));

function stepBaseline() {
  const s = useStore.getState();
  return { baseline: { ...s.events }, snapshot: s.project, seen: [] as string[] };
}

export function currentTour(): Tour | undefined {
  const id = useTour.getState().active;
  return id ? TOURS.find((t) => t.id === id) : undefined;
}

function persist() {
  const s = useTour.getState();
  const pending =
    s.active && s.projectId
      ? { id: s.active, step: s.step, projectId: s.projectId, prevProjectId: s.prevProjectId }
      : s.pending;
  useTour.setState({ pending });
  try {
    localStorage.setItem(KEY, JSON.stringify({ completed: s.completed, pending, welcomed: s.welcomed }));
  } catch {
    /* progress just won't persist */
  }
}

/** Start a tour from the beginning in a fresh practice project. */
export async function startTour(id: string) {
  const tour = TOURS.find((t) => t.id === id);
  if (!tour || useTour.getState().starting) return;
  useTour.setState({ starting: true });
  try {
    await saveNow();
    const prev = useStore.getState().project;
    // Don't treat a previous practice project as "your project" to return to.
    const st = useTour.getState();
    const isPractice = TOURS.some((t) => t.projectName === prev.name) || prev.id === st.pending?.projectId;
    const prevProjectId = isPractice ? (st.prevProjectId ?? st.pending?.prevProjectId ?? null) : prev.id;
    await newProject(tour.packId, tour.projectName, true);
    useTour.setState({
      active: id,
      step: 0,
      projectId: useStore.getState().project.id,
      prevProjectId,
      welcomed: true,
      ...stepBaseline(),
    });
    tour.steps[0].onEnter?.();
    persist();
  } finally {
    useTour.setState({ starting: false });
  }
}

/** Resume the unfinished tour saved in local storage. */
export async function resumeTour() {
  const p = useTour.getState().pending;
  if (!p) return;
  const tour = TOURS.find((t) => t.id === p.id);
  if (!tour) return;
  if (useStore.getState().project.id !== p.projectId) await openProject(p.projectId);
  if (useStore.getState().project.id !== p.projectId) {
    // The practice project is gone: start over.
    await startTour(p.id);
    return;
  }
  useTour.setState({ active: p.id, step: p.step, projectId: p.projectId, prevProjectId: p.prevProjectId, ...stepBaseline() });
  tour.steps[p.step]?.onEnter?.();
  persist();
}

export function discardPending() {
  useTour.setState({ pending: null });
  persist();
}

/** Reopen the project the user had before the lesson began. */
export async function returnToPreviousProject() {
  const prev = useTour.getState().prevProjectId;
  if (prev) await openProject(prev);
}

// Detect what the user changed, for task checks.
useStore.subscribe((s, prev) => {
  if (!useTour.getState().active || s.project === prev.project) return;
  const a = prev.project;
  const b = s.project;
  const keys: string[] = [];
  if (a.name !== b.name) keys.push('name');
  if (a.bpm !== b.bpm) keys.push('bpm');
  if (a.quantize !== b.quantize) keys.push('quantize');
  if (a.compat !== b.compat) keys.push('compat');
  if (a.swing !== b.swing) keys.push('swing');
  if (a.masterVolume !== b.masterVolume) keys.push('master');
  if (a.harmony.root !== b.harmony.root || a.harmony.mode !== b.harmony.mode) keys.push('key');
  for (const t of b.tracks) {
    const o = a.tracks.find((x) => x.id === t.id);
    if (!o) continue;
    if (o.volume !== t.volume) keys.push('volume', `volume:${t.role}`);
    if (o.mute !== t.mute) keys.push('mute');
    if (o.solo !== t.solo) keys.push('solo');
    if (o.locked !== t.locked) keys.push('lock');
    if (o.pan !== t.pan) keys.push('pan');
    if (o.patternId !== t.patternId) keys.push('pattern', `pattern:${t.role}`);
    if (JSON.stringify(o.fx) !== JSON.stringify(t.fx)) keys.push('fx');
  }
  if (keys.length) useTour.getState().markSeen(keys);
});
