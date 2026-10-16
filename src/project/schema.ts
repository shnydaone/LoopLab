/**
 * Runtime validation + migrations for project files. Imported JSON is never
 * trusted: it is parsed against this schema after migrating to the current
 * version. Add a migration step whenever SCHEMA_VERSION is bumped.
 */
import { z } from 'zod';
import type { Project } from './types';
import { SCHEMA_VERSION } from './types';

const role = z.enum(['drums', 'bass', 'guitar', 'keys', 'horns', 'perc']);
const mode = z.enum(['major', 'minor', 'dorian', 'mixolydian']);
const chord = z.object({ deg: z.number().int().min(-14).max(14), bars: z.number().positive().max(16), seventh: z.boolean().optional() });
const harmony = z.object({
  root: z.number().int().min(0).max(11),
  mode,
  progression: z.array(chord).min(1).max(32),
});

const drumVoice = z.enum([
  'kick', 'snare', 'rim', 'hatC', 'hatO', 'ride', 'tomH', 'tomM', 'tomL', 'crash', 'clap', 'shaker', 'tamb', 'handLo', 'handHi', 'cowbell', 'siren',
]);

const pattern = z.object({
  id: z.string().min(1).max(200),
  name: z.string().max(200),
  role,
  packId: z.string(),
  genre: z.string(),
  kind: z.enum(['drum', 'pitched']),
  bars: z.number().positive().max(64),
  bpm: z.number().min(20).max(400),
  swing: z.number().min(0).max(1),
  harmony: z.enum(['chord', 'key']).optional(),
  instrument: z.string(),
  energy: z.number().min(0).max(5),
  tags: z.array(z.string()),
  hits: z.array(z.object({ t: z.number().min(0), v: z.number().min(0).max(1), voice: drumVoice })).optional(),
  notes: z
    .array(
      z.object({
        t: z.number().min(0),
        d: z.number().positive(),
        v: z.number().min(0).max(1),
        s: z.union([z.number(), z.array(z.number()).max(8)]),
        o: z.number().optional(),
        c: z.number().optional(),
      }),
    )
    .optional(),
  voicing: z.enum(['close', 'open']).optional(),
  description: z.string().optional(),
  sourceId: z.string().optional(),
  seed: z.number().optional(),
});

const track = z.object({
  id: z.string(),
  role,
  name: z.string().max(80),
  color: z.string().max(32),
  patternId: z.string().nullable(),
  instrument: z.string().nullable(),
  volume: z.number().min(0).max(1.2),
  pan: z.number().min(-1).max(1),
  mute: z.boolean(),
  solo: z.boolean(),
  locked: z.boolean(),
  fx: z.object({
    reverb: z.number().min(0).max(1),
    delay: z.number().min(0).max(1),
    filter: z.number().min(0).max(1),
    drive: z.number().min(0).max(1),
  }),
});

const scene = z.object({
  id: z.string(),
  name: z.string().max(80),
  color: z.string().max(32),
  bpm: z.number().min(40).max(240),
  harmony,
  tracks: z.record(
    z.string(),
    z.object({ patternId: z.string().nullable(), mute: z.boolean(), volume: z.number().min(0).max(1.2) }),
  ),
});

export const projectSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  createdAt: z.number(),
  updatedAt: z.number(),
  bpm: z.number().min(40).max(240),
  swing: z.number().min(0).max(0.5),
  masterVolume: z.number().min(0).max(1.2),
  harmony,
  harmonyStamp: z.number(),
  compat: z.enum(['safe', 'creative', 'wild']),
  quantize: z.enum(['beat', 'bar', '2bar', '4bar']),
  basePackId: z.string(),
  sectionId: z.string().nullable(),
  tracks: z.array(track).min(1).max(32),
  userPatterns: z.array(pattern).max(2000),
  scenes: z.array(scene).max(64),
});

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** MIGRATIONS[n] upgrades a version-n document to version n+1. */
const MIGRATIONS: Record<number, Migration> = {};

export function migrate(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  let doc = { ...(raw as Record<string, unknown>) };
  let v = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) break;
    doc = step(doc);
    v += 1;
    doc.schemaVersion = v;
  }
  return doc;
}

export type ValidationResult = { ok: true; project: Project } | { ok: false; error: string };

export function validateProject(raw: unknown): ValidationResult {
  const migrated = migrate(raw);
  const res = projectSchema.safeParse(migrated);
  if (!res.success) {
    const issue = res.error.issues[0];
    return { ok: false, error: `${issue.path.join('.') || 'file'}: ${issue.message}` };
  }
  return { ok: true, project: res.data as Project };
}
