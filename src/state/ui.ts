/**
 * Workspace UI state (layout, panels, tabs, density). Persisted per browser.
 * Kept separate from the project so layout changes never touch saved songs,
 * and so the guided tour can open the panel a lesson needs.
 */
import { create } from 'zustand';

export type CenterTab = 'live' | 'pattern' | 'sends' | 'arrange';
export type LabTab = 'instrument' | 'effects' | 'variation';
export type LibraryTab = 'packs' | 'parts' | 'favorites' | 'yours';
export type MobileTab = 'deck' | 'library' | 'lab' | 'mixer';
export type Density = 'comfortable' | 'compact';

export interface PanelVisibility {
  library: boolean;
  lab: boolean;
  dock: boolean;
}

interface UiState {
  panels: PanelVisibility;
  focus: boolean;
  scale: number;
  density: Density;
  centerTab: CenterTab;
  labTab: LabTab;
  libraryTab: LibraryTab;
  mobileTab: MobileTab;
  family: string;
  /** Library search text (not persisted). */
  query: string;
  favorites: string[];
  /** Brief highlight after a successful swap (track id → timestamp). */
  flash: Record<string, number>;
  /** Last launched scene id, for the active-scene indicator. */
  activeScene: string | null;
  set: (patch: Partial<Omit<UiState, 'set' | 'togglePanel' | 'toggleFavorite' | 'flashTrack'>>) => void;
  togglePanel: (p: keyof PanelVisibility) => void;
  toggleFavorite: (packId: string) => void;
  flashTrack: (trackId: string) => void;
}

const KEY = 'looplab:ui';
const PERSIST: (keyof UiState)[] = ['panels', 'focus', 'scale', 'density', 'centerTab', 'labTab', 'libraryTab', 'family', 'favorites'];

function load(): Partial<UiState> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<UiState>) : {};
  } catch {
    return {};
  }
}

export const useUi = create<UiState>((set, get) => ({
  panels: { library: true, lab: true, dock: true },
  focus: false,
  scale: 1,
  density: 'comfortable',
  centerTab: 'live',
  labTab: 'instrument',
  libraryTab: 'packs',
  mobileTab: 'deck',
  family: 'All',
  query: '',
  favorites: [],
  flash: {},
  activeScene: null,
  ...load(),
  set: (patch) => set(patch),
  togglePanel: (p) => set({ panels: { ...get().panels, [p]: !get().panels[p] } }),
  toggleFavorite: (packId) => {
    const f = get().favorites;
    set({ favorites: f.includes(packId) ? f.filter((x) => x !== packId) : [...f, packId] });
  },
  flashTrack: (trackId) => set({ flash: { ...get().flash, [trackId]: Date.now() } }),
}));

useUi.subscribe((s) => {
  try {
    const out: Record<string, unknown> = {};
    for (const k of PERSIST) out[k] = s[k];
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    /* storage blocked: layout just won't persist */
  }
});
