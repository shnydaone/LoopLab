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
      expect(r.picks[tracks.findIndex((t) => t.role === 'drums')]).toBeTruthy();
      expect(r.picks[tracks.findIndex((t) => t.role === 'bass')]).toBeTruthy();
    }
  });
});

describe('flexible tracks', () => {
  const drums = () => s().project.tracks.filter((t) => t.role === 'drums');

  it('adds a second track of a type with its own name and a different part', () => {
    s().addTrack('drums');
    const [a, b] = drums();
    expect(s().project.tracks).toHaveLength(7);
    expect(b.name).toBe('Drums 2');
    expect(b.patternId).toBeTruthy();
    expect(b.patternId).not.toBe(a.patternId);
    expect(s().selectedTrackId).toBe(b.id);
  });

  it('gives extra tracks of a type a different part when a groove or section loads', () => {
    s().addTrack('drums');
    s().loadGroove('two-tone-ska');
    const [a, b] = drums();
    expect(a.patternId).not.toBe(b.patternId);
    expect(b.patternId?.startsWith('tt-')).toBe(true);
    s().launchSection('two-tone-ska', 'chorus');
    expect(drums()[0].patternId).not.toBe(drums()[1].patternId);
  });

  it('changes a track to another type in place, and undo brings it back', () => {
    const before = s().project.tracks.map((t) => t.role);
    s().selectTrack('trk-horns');
    s().setTrackRole('trk-horns', 'drums');
    const t = s().project.tracks[4];
    expect(t.role).toBe('drums');
    expect(t.name).toBe('Drums 2');
    expect(t.id).not.toBe('trk-horns');
    expect(s().selectedTrackId).toBe(t.id);
    s().undo();
    expect(s().project.tracks.map((x) => x.role)).toEqual(before);
  });

  it('removes and reorders tracks but never removes the last one', () => {
    s().moveTrack('trk-bass', -1);
    expect(s().project.tracks[0].id).toBe('trk-bass');
    for (const t of [...s().project.tracks]) s().removeTrack(t.id);
    expect(s().project.tracks).toHaveLength(1);
  });

  it('stops at the track limit', () => {
    for (let i = 0; i < 10; i++) s().addTrack('perc');
    expect(s().project.tracks).toHaveLength(12);
  });

  it('lets Surprise Me pick different parts for two tracks of one type', () => {
    s().addTrack('drums');
    const tracks = s().project.tracks.map((t) => ({ role: t.role, locked: false, patternId: t.patternId }));
    const idx = tracks.flatMap((t, i) => (t.role === 'drums' ? [i] : []));
    for (let seed = 1; seed < 30; seed++) {
      const r = surprise(seed, tracks, 'wild');
      expect(r.picks).toHaveLength(tracks.length);
      expect(r.picks[idx[0]]).not.toBe(r.picks[idx[1]]);
    }
  });
});
