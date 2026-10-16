import { beforeEach, describe, expect, it } from 'vitest';
import { PACKS, patternsForRole } from '@/content/library';
import { surprise } from '@/music/generate';
import { createProject } from '@/project/factory';
import { useStore } from './store';

const s = () => useStore.getState();
const track = (role: string) => s().project.tracks.find((t) => t.role === role)!;

beforeEach(() => {
  s().replaceProject(createProject('roots-reggae'));
});

describe('live mix state', () => {
  it('launches a section: swaps parts and restarts the progression', () => {
    const stamp = s().project.harmonyStamp;
    s().launchSection('roots-reggae', 'chorus');
    expect(s().project.sectionId).toBe('chorus');
    expect(track('horns').patternId).toBe('rr-horns-melody');
    expect(s().project.harmonyStamp).toBe(stamp + 1);
    expect(s().project.harmony.progression[0].deg).toBe(6);
  });

  it('keeps locked tracks when sections or Surprise Me change everything else', () => {
    s().setTrackPattern('trk-drums', 'tt-drums-a');
    s().toggleLock('trk-drums');
    s().launchSection('roots-reggae', 'breakdown');
    expect(track('drums').patternId).toBe('tt-drums-a');
    s().surpriseMe(1234);
    expect(track('drums').patternId).toBe('tt-drums-a');
  });

  it('saves and recalls scenes', () => {
    s().saveScene();
    const scene = s().project.scenes[0];
    s().setTrackPattern('trk-bass', 'tt-bass-walk-a');
    s().toggleMute('trk-guitar');
    s().launchScene(scene.id);
    expect(track('bass').patternId).toBe('rr-bass-classic');
    expect(track('guitar').mute).toBe(false);
  });

  it('undoes and redoes edits, coalescing slider drags', () => {
    const v0 = track('keys').volume;
    s().setTrack('trk-keys', { volume: 0.5 }, true);
    s().setTrack('trk-keys', { volume: 0.4 }, true);
    s().setTrack('trk-keys', { volume: 0.3 }, true);
    s().undo();
    expect(track('keys').volume).toBe(v0);
    s().redo();
    expect(track('keys').volume).toBe(0.3);
  });

  it('creates a variation as a new user pattern and can revert to the original', () => {
    s().mutateTrack('trk-bass');
    const id = track('bass').patternId!;
    expect(id).not.toBe('rr-bass-classic');
    expect(s().project.userPatterns.find((p) => p.id === id)?.sourceId).toBe('rr-bass-classic');
    s().revertTrack('trk-bass');
    expect(track('bass').patternId).toBe('rr-bass-classic');
  });

  it('cycles parts across every genre for a role and wraps around', () => {
    const first = track('drums').patternId;
    const pool = patternsForRole('drums');
    const seen = new Set<string | null>([first]);
    for (let i = 0; i < pool.length; i++) {
      s().cyclePattern('trk-drums', 1);
      seen.add(track('drums').patternId);
    }
    const packs = new Set([...seen].map((id) => pool.find((p) => p.id === id)?.packId));
    expect(packs.size).toBe(PACKS.length);
    expect(track('drums').patternId).toBe(first); // full loop returns to the start
  });
});

describe('Surprise Me', () => {
  it('is reproducible from its seed', () => {
    const tracks = createProject().tracks.map((t) => ({ role: t.role, locked: false, patternId: t.patternId }));
    expect(surprise(777, tracks, 'safe')).toEqual(surprise(777, tracks, 'safe'));
  });

  it('always includes drums and bass so the groove holds together', () => {
    const tracks = createProject().tracks.map((t) => ({ role: t.role, locked: false, patternId: t.patternId }));
    for (let seed = 1; seed < 40; seed++) {
      const r = surprise(seed, tracks, 'safe');
      expect(r.picks.drums).toBeTruthy();
      expect(r.picks.bass).toBeTruthy();
    }
  });
});
