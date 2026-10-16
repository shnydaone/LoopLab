import { getPack, PACKS } from '@/content/library';
import type { GenrePack, Role } from '@/music/types';
import { ROLES } from '@/music/types';
import type { Project, TrackState } from './types';
import { SCHEMA_VERSION } from './types';

export const ROLE_META: Record<Role, { name: string; color: string; icon: string }> = {
  drums: { name: 'Drums', color: '#ff5468', icon: '◉' },
  bass: { name: 'Bass', color: '#ffb02e', icon: '◢' },
  guitar: { name: 'Guitar / Pad', color: '#3ddc84', icon: '≋' },
  keys: { name: 'Keys', color: '#4c9dff', icon: '▤' },
  horns: { name: 'Horns / Lead', color: '#a970ff', icon: '◣' },
  perc: { name: 'Perc / FX', color: '#2fd3e6', icon: '✦' },
};

const DEFAULT_FX: Record<Role, TrackState['fx']> = {
  drums: { reverb: 0.08, delay: 0, filter: 1, resonance: 0, drive: 0 },
  bass: { reverb: 0, delay: 0, filter: 1, resonance: 0, drive: 0 },
  guitar: { reverb: 0.22, delay: 0.08, filter: 1, resonance: 0, drive: 0 },
  keys: { reverb: 0.2, delay: 0, filter: 1, resonance: 0, drive: 0 },
  horns: { reverb: 0.3, delay: 0.1, filter: 1, resonance: 0, drive: 0 },
  perc: { reverb: 0.15, delay: 0.28, filter: 1, resonance: 0, drive: 0 },
};

const DEFAULT_PAN: Record<Role, number> = { drums: 0, bass: 0, guitar: -0.3, keys: 0.28, horns: 0.12, perc: -0.15 };
const DEFAULT_VOL: Record<Role, number> = { drums: 0.8, bass: 0.8, guitar: 0.72, keys: 0.7, horns: 0.72, perc: 0.66 };

export const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function defaultTracks(pack: GenrePack, sectionId = 'verse'): TrackState[] {
  const section = pack.sections.find((s) => s.id === sectionId) ?? pack.sections[0];
  return ROLES.map((role) => ({
    id: `trk-${role}`,
    role,
    name: ROLE_META[role].name,
    color: ROLE_META[role].color,
    patternId: section?.parts[role] ?? null,
    instrument: null,
    volume: DEFAULT_VOL[role],
    pan: DEFAULT_PAN[role],
    mute: false,
    solo: false,
    locked: false,
    density: 1,
    fx: { ...DEFAULT_FX[role] },
  }));
}

export function createProject(packId = PACKS[0].id, name = 'Untitled Jam'): Project {
  const pack = getPack(packId) ?? PACKS[0];
  const section = pack.sections.find((s) => s.id === 'verse') ?? pack.sections[0];
  const now = Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid('prj'),
    name,
    createdAt: now,
    updatedAt: now,
    bpm: pack.bpm,
    swing: 0,
    masterVolume: 0.85,
    harmony: { ...pack.harmony, progression: section.progression },
    harmonyStamp: 0,
    compat: 'safe',
    quantize: 'bar',
    basePackId: pack.id,
    sectionId: section.id,
    tracks: defaultTracks(pack, section.id),
    userPatterns: [],
    scenes: [],
  };
}
