import { describe, expect, it } from 'vitest';
import { createProject } from './factory';
import { migrate, validateProject } from './schema';
import { SCHEMA_VERSION } from './types';

describe('project serialization', () => {
  it('creates a valid project from every starter pack', () => {
    for (const pack of ['roots-reggae', 'two-tone-ska']) {
      const res = validateProject(createProject(pack));
      expect(res.ok, res.ok ? '' : res.error).toBe(true);
    }
  });

  it('round-trips through JSON without loss', () => {
    const p = createProject('two-tone-ska', 'Round trip');
    const res = validateProject(JSON.parse(JSON.stringify(p)));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.project).toEqual(p);
  });

  it('rejects malformed or hostile files with a readable reason', () => {
    const p = createProject();
    const bad = validateProject({ ...p, bpm: 9999 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/bpm/);
    expect(validateProject(null).ok).toBe(false);
    expect(validateProject({ hello: 'world' }).ok).toBe(false);
    expect(validateProject({ ...p, tracks: [] }).ok).toBe(false);
  });

  it('migrates version-1 projects (adds resonance and density)', () => {
    const p = createProject();
    const v1 = {
      ...p,
      schemaVersion: 1,
      tracks: p.tracks.map(({ density: _d, fx: { resonance: _r, ...fx }, ...t }) => ({ ...t, fx })),
    };
    const res = validateProject(JSON.parse(JSON.stringify(v1)));
    expect(res.ok, res.ok ? '' : res.error).toBe(true);
    if (res.ok) {
      expect(res.project.schemaVersion).toBe(2);
      expect(res.project.tracks.every((t) => t.density === 1 && t.fx.resonance === 0)).toBe(true);
    }
  });

  it('leaves current-version documents untouched by migration', () => {
    const p = createProject();
    expect(migrate(p)).toEqual(p);
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
  });
});
