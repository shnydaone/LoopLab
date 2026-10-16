/**
 * Live playback state published by the engine for the UI (what is actually
 * sounding, what is queued, where the playhead is). The project store holds
 * the user's intent; this store holds reality.
 */
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export interface LiveTrack {
  activeId: string | null;
  /** undefined = nothing queued; null = queued to silence. */
  pendingId?: string | null;
  /** Tempo-feel multiplier currently applied. */
  k: number;
  /** Step at which the active pattern started (for playheads). */
  start: number;
  filling: boolean;
}

export interface LiveState {
  ready: boolean;
  playing: boolean;
  step: number;
  progStart: number;
  harmonyPending: boolean;
  fillQueued: boolean;
  building: boolean;
  buildQueued: boolean;
  dropQueued: boolean;
  tracks: Record<string, LiveTrack>;
  error: string | null;
  /** 'sampled' = recorded instruments where available, 'synth' = original synths (A/B). */
  soundMode: SoundMode;
  samplesPending: number;
  samplesLoaded: number;
}

export type SoundMode = 'sampled' | 'synth';

function initialSoundMode(): SoundMode {
  try {
    return localStorage.getItem('looplab:sound-mode') === '"synth"' ? 'synth' : 'sampled';
  } catch {
    return 'sampled';
  }
}

export const liveStore = createStore<LiveState>(() => ({
  ready: false,
  playing: false,
  step: 0,
  progStart: 0,
  harmonyPending: false,
  fillQueued: false,
  building: false,
  buildQueued: false,
  dropQueued: false,
  tracks: {},
  error: null,
  soundMode: initialSoundMode(),
  samplesPending: 0,
  samplesLoaded: 0,
}));

export function useLive<T>(selector: (s: LiveState) => T): T {
  return useStore(liveStore, selector);
}
