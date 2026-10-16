/**
 * Project store (the user's intent) with undo/redo. The audio engine
 * subscribes to this store; components never talk to Tone.js directly.
 */
import { create } from 'zustand';
import { getBuiltinPattern, getPack, patternsForRole, PACKS } from '@/content/library';
import type { CompatMode } from '@/music/compat';
import { evolve, remix, surprise } from '@/music/generate';
import { mutatePattern } from '@/music/mutate';
import { newSeed } from '@/music/rng';
import type { Mode, Pattern, Role } from '@/music/types';
import { createProject, uid } from '@/project/factory';
import type { Project, Quantize, Scene, TrackFx, TrackState } from '@/project/types';

const HISTORY_LIMIT = 120;
const SCENE_COLORS = ['#3df5c4', '#ff5fa2', '#ffc53d', '#8ea2ff', '#ff7a45', '#b37bff', '#5fd4ff', '#c6ff5f'];

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'warn';
}

interface UpdateOpts {
  /** Merge rapid edits with the same key (slider drags) into one undo step. */
  coalesce?: string;
  history?: boolean;
}

export interface StoreState {
  project: Project;
  past: Project[];
  future: Project[];
  lastCoalesce: { key: string; at: number } | null;
  selectedTrackId: string;
  saveStatus: SaveStatus;
  lastSeed: number | null;
  toasts: Toast[];
  /** Count of user actions by name (used by the guided tour to detect real actions). */
  events: Record<string, number>;
  /** Strength of new variations (0.3 subtle … 1.6 bold). */
  variationAmount: number;
  bump: (name: string) => void;
  setVariationAmount: (v: number) => void;

  update: (fn: (p: Project) => Project, opts?: UpdateOpts) => void;
  replaceProject: (p: Project) => void;
  undo: () => void;
  redo: () => void;

  selectTrack: (id: string) => void;
  setSaveStatus: (s: SaveStatus) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;

  loadGroove: (packId: string, sectionId?: string) => void;
  launchSection: (packId: string, sectionId: string) => void;
  setTrackPattern: (trackId: string, patternId: string | null) => void;
  cyclePattern: (trackId: string, dir: 1 | -1) => void;
  setTrack: (trackId: string, patch: Partial<TrackState>, coalesce?: boolean) => void;
  setFx: (trackId: string, patch: Partial<TrackFx>) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  toggleLock: (trackId: string) => void;
  setBpm: (bpm: number) => void;
  setKeyRoot: (root: number) => void;
  setMode: (mode: Mode) => void;
  setCompat: (c: CompatMode) => void;
  setQuantize: (q: Quantize) => void;
  setSwing: (s: number) => void;
  setMasterVolume: (v: number) => void;
  renameProject: (name: string) => void;

  mutateTrack: (trackId: string) => void;
  revertTrack: (trackId: string) => void;
  surpriseMe: (seed?: number) => void;
  remixParts: () => void;
  evolveEnergy: (dir: 1 | -1) => void;

  saveScene: () => void;
  launchScene: (id: string) => void;
  deleteScene: (id: string) => void;
}

export function lookupPattern(project: Project, id: string | null | undefined): Pattern | undefined {
  if (!id) return undefined;
  return getBuiltinPattern(id) ?? project.userPatterns.find((p) => p.id === id);
}

const mapTracks = (p: Project, fn: (t: TrackState) => TrackState): Project => ({
  ...p,
  tracks: p.tracks.map(fn),
});

const applyPicks = (p: Project, picks: Partial<Record<Role, string | null>>): Project =>
  mapTracks(p, (t) => (t.locked || !(t.role in picks) ? t : { ...t, patternId: picks[t.role] ?? null }));

let toastId = 1;

export const useStore = create<StoreState>((set, get) => ({
  project: createProject(),
  past: [],
  future: [],
  lastCoalesce: null,
  selectedTrackId: 'trk-drums',
  saveStatus: 'saved',
  lastSeed: null,
  toasts: [],
  events: {},
  variationAmount: 1,
  bump: (name) => set({ events: { ...get().events, [name]: (get().events[name] ?? 0) + 1 } }),
  setVariationAmount: (variationAmount) => set({ variationAmount }),

  update: (fn, opts = {}) => {
    const { project, past, lastCoalesce } = get();
    const next = fn(project);
    if (next === project) return;
    const now = Date.now();
    const stamped = { ...next, updatedAt: now };
    const merge =
      opts.coalesce && lastCoalesce && lastCoalesce.key === opts.coalesce && now - lastCoalesce.at < 900;
    const recordHistory = opts.history !== false && !merge;
    set({
      project: stamped,
      past: recordHistory ? [...past, project].slice(-HISTORY_LIMIT) : past,
      future: opts.history === false ? get().future : [],
      lastCoalesce: opts.coalesce ? { key: opts.coalesce, at: now } : null,
      saveStatus: 'unsaved',
    });
  },

  replaceProject: (p) =>
    set({ project: p, past: [], future: [], lastCoalesce: null, saveStatus: 'saved', selectedTrackId: p.tracks[0]?.id ?? '' }),

  undo: () => {
    const { past, project, future } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], saveStatus: 'unsaved', lastCoalesce: null });
    get().bump('undo');
  },

  redo: () => {
    const { past, project, future } = get();
    const next = future[0];
    if (!next) return;
    set({ project: next, past: [...past, project], future: future.slice(1), saveStatus: 'unsaved', lastCoalesce: null });
  },

  selectTrack: (id) => set({ selectedTrackId: id }),
  setSaveStatus: (s) => set({ saveStatus: s }),
  toast: (text, tone = 'info') => {
    const id = toastId++;
    set({ toasts: [...get().toasts, { id, text, tone }].slice(-4) });
    setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  loadGroove: (packId, sectionId = 'verse') => {
    const pack = getPack(packId);
    if (!pack) return;
    const section = pack.sections.find((s) => s.id === sectionId) ?? pack.sections[0];
    get().update((p) => ({
      ...applyPicks(p, section.parts),
      bpm: pack.bpm,
      basePackId: pack.id,
      sectionId: section.id,
      harmony: { ...pack.harmony, progression: section.progression },
      harmonyStamp: p.harmonyStamp + 1,
    }));
    get().bump('loadGroove');
  },

  launchSection: (packId, sectionId) => {
    const pack = getPack(packId);
    const section = pack?.sections.find((s) => s.id === sectionId);
    if (!pack || !section) return;
    get().update((p) => {
      const sameKeyFamily = p.basePackId === pack.id;
      return {
        ...applyPicks(p, section.parts),
        sectionId: section.id,
        basePackId: pack.id,
        harmony: sameKeyFamily
          ? { ...p.harmony, progression: section.progression }
          : { ...pack.harmony, progression: section.progression },
        harmonyStamp: p.harmonyStamp + 1,
      };
    });
    get().bump('section');
  },

  setTrackPattern: (trackId, patternId) =>
    get().update((p) => mapTracks(p, (t) => (t.id === trackId ? { ...t, patternId } : t))),

  cyclePattern: (trackId, dir) => {
    const { project } = get();
    const track = project.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const pool = patternsForRole(track.role, project.userPatterns);
    if (pool.length === 0) return;
    const idx = pool.findIndex((p) => p.id === track.patternId);
    const next = pool[(idx + dir + pool.length) % pool.length];
    get().setTrackPattern(trackId, next.id);
  },

  setTrack: (trackId, patch, coalesce) =>
    get().update((p) => mapTracks(p, (t) => (t.id === trackId ? { ...t, ...patch } : t)), {
      coalesce: coalesce ? `track:${trackId}:${Object.keys(patch).join(',')}` : undefined,
    }),

  setFx: (trackId, patch) =>
    get().update((p) => mapTracks(p, (t) => (t.id === trackId ? { ...t, fx: { ...t.fx, ...patch } } : t)), {
      coalesce: `fx:${trackId}:${Object.keys(patch).join(',')}`,
    }),

  toggleMute: (trackId) => get().update((p) => mapTracks(p, (t) => (t.id === trackId ? { ...t, mute: !t.mute } : t))),
  toggleSolo: (trackId) => get().update((p) => mapTracks(p, (t) => (t.id === trackId ? { ...t, solo: !t.solo } : t))),
  toggleLock: (trackId) => get().update((p) => mapTracks(p, (t) => (t.id === trackId ? { ...t, locked: !t.locked } : t))),

  setBpm: (bpm) =>
    get().update((p) => ({ ...p, bpm: Math.round(Math.min(240, Math.max(40, bpm))) }), { coalesce: 'bpm' }),
  setKeyRoot: (root) => get().update((p) => ({ ...p, harmony: { ...p.harmony, root } })),
  setMode: (mode) => get().update((p) => ({ ...p, harmony: { ...p.harmony, mode } })),
  setCompat: (compat) => get().update((p) => ({ ...p, compat })),
  setQuantize: (quantize) => get().update((p) => ({ ...p, quantize })),
  setSwing: (swing) => get().update((p) => ({ ...p, swing }), { coalesce: 'swing' }),
  setMasterVolume: (masterVolume) => get().update((p) => ({ ...p, masterVolume }), { coalesce: 'master' }),
  renameProject: (name) => get().update((p) => ({ ...p, name: name.trim() || 'Untitled Jam' })),

  mutateTrack: (trackId) => {
    const { project } = get();
    const track = project.tracks.find((t) => t.id === trackId);
    const base = lookupPattern(project, track?.patternId);
    if (!track || !base) return;
    const seed = newSeed();
    const v = mutatePattern(base, seed, get().variationAmount);
    get().update((p) => ({
      ...mapTracks(p, (t) => (t.id === trackId ? { ...t, patternId: v.id } : t)),
      userPatterns: [...p.userPatterns.filter((u) => u.id !== v.id), v],
    }));
    set({ lastSeed: seed });
    get().bump('variation');
    get().toast(`New variation: ${v.name}`, 'good');
  },

  revertTrack: (trackId) => {
    const { project } = get();
    const track = project.tracks.find((t) => t.id === trackId);
    const cur = lookupPattern(project, track?.patternId);
    if (!cur?.sourceId) return;
    get().setTrackPattern(trackId, cur.sourceId);
    get().bump('revert');
  },

  surpriseMe: (seed = newSeed()) => {
    const { project } = get();
    const res = surprise(
      seed,
      project.tracks.map((t) => ({ role: t.role, locked: t.locked, patternId: t.patternId })),
      project.compat,
      project.userPatterns,
    );
    get().update((p) => ({
      ...applyPicks(p, res.picks),
      bpm: res.bpm,
      basePackId: res.basePackId,
      sectionId: res.sectionId,
      harmony: res.harmony,
      harmonyStamp: p.harmonyStamp + 1,
    }));
    set({ lastSeed: seed });
    get().bump('surprise');
    const pack = getPack(res.basePackId);
    get().toast(`Surprise! ${pack?.name ?? ''} · Undo (Ctrl+Z) to go back`, 'good');
  },

  remixParts: () => {
    const { project } = get();
    const seed = newSeed();
    const picks = remix(
      seed,
      project.tracks.map((t) => ({ role: t.role, locked: t.locked, patternId: t.patternId })),
      project.basePackId,
      project.compat,
      project.userPatterns,
    );
    get().update((p) => applyPicks(p, picks));
    set({ lastSeed: seed });
    get().bump('remix');
    get().toast('Remixed unlocked parts · Undo to go back', 'good');
  },

  evolveEnergy: (dir) => {
    const { project } = get();
    const picks = evolve(
      newSeed(),
      project.tracks.map((t) => ({ role: t.role, locked: t.locked, patternId: t.patternId })),
      project.basePackId,
      dir,
      (id) => lookupPattern(project, id),
      project.userPatterns,
    );
    get().update((p) => applyPicks(p, picks));
    get().bump('energy');
    get().toast(dir > 0 ? 'Energy up ↑' : 'Energy down ↓');
  },

  saveScene: () => {
    const { project } = get();
    const n = project.scenes.length;
    const scene: Scene = {
      id: uid('scn'),
      name: `Scene ${n + 1}`,
      color: SCENE_COLORS[n % SCENE_COLORS.length],
      bpm: project.bpm,
      harmony: project.harmony,
      tracks: Object.fromEntries(
        project.tracks.map((t) => [t.id, { patternId: t.patternId, mute: t.mute, volume: t.volume }]),
      ),
    };
    get().update((p) => ({ ...p, scenes: [...p.scenes, scene] }));
    get().bump('saveScene');
    get().toast(`Saved ${scene.name}`, 'good');
  },

  launchScene: (id) => {
    const scene = get().project.scenes.find((s) => s.id === id);
    if (!scene) return;
    get().update((p) => ({
      ...mapTracks(p, (t) => {
        const st = scene.tracks[t.id];
        return st ? { ...t, patternId: st.patternId, mute: st.mute, volume: st.volume } : t;
      }),
      bpm: scene.bpm,
      harmony: scene.harmony,
      harmonyStamp: p.harmonyStamp + 1,
    }));
    get().bump('scene');
  },

  deleteScene: (id) => get().update((p) => ({ ...p, scenes: p.scenes.filter((s) => s.id !== id) })),
}));

export const DEFAULT_PACK_ID = PACKS[0].id;
