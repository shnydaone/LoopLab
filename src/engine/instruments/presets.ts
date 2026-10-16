import { DrumKit, KITS } from './drumKit';
import { createPitched } from './pitched';
import type { Instrument } from './types';

export { PRESETS, presetById } from './presetInfo';

export function createInstrument(id: string): Instrument | null {
  if (KITS[id]) return new DrumKit(id, KITS[id], id.startsWith('perc') ? 0.9 : 1);
  return createPitched(id);
}
