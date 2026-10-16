/** Help preferences: how much guidance to show, tap-to-learn mode, Help Center visibility. */
import { create } from 'zustand';

export type HelpLevel = 'beginner' | 'standard' | 'expert';

interface HelpState {
  level: HelpLevel;
  /** Touch-friendly "Learn mode": tapping a control explains it instead of using it. */
  learnMode: boolean;
  centerOpen: boolean;
  centerSection: string | null;
  setLevel: (l: HelpLevel) => void;
  setLearnMode: (on: boolean) => void;
  openCenter: (section?: string | null) => void;
  closeCenter: () => void;
}

const KEY = 'looplab:help-level';

function initialLevel(): HelpLevel {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'standard' || v === 'expert' ? v : 'beginner';
  } catch {
    return 'beginner';
  }
}

export const useHelp = create<HelpState>((set) => ({
  level: initialLevel(),
  learnMode: false,
  centerOpen: false,
  centerSection: null,
  setLevel: (level) => {
    try {
      localStorage.setItem(KEY, level);
    } catch {
      /* preference won't persist */
    }
    set({ level });
  },
  setLearnMode: (learnMode) => set({ learnMode }),
  openCenter: (section = null) => set({ centerOpen: true, centerSection: section }),
  closeCenter: () => set({ centerOpen: false }),
}));
