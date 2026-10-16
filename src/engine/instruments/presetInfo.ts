/** Instrument preset metadata (no Tone.js import, safe for tests and UI). */
import type { PresetInfo } from './types';

export const PRESETS: PresetInfo[] = [
  { id: 'kit-roots', name: 'Roots Kit', role: 'drums', kind: 'drum', description: 'Deep kick, tight high snare, woody cross-stick.' },
  { id: 'kit-twotone', name: 'Two-Tone Kit', role: 'drums', kind: 'drum', description: 'Punchy kick, cracking snare, bright hats.' },
  { id: 'bass-dub', name: 'Dub Sub Bass', role: 'bass', kind: 'pitched', description: 'Round, deep and warm with a sub layer.' },
  { id: 'bass-round', name: 'Round Finger Bass', role: 'bass', kind: 'pitched', description: 'Plucky, woody, sits forward in the mix.' },
  { id: 'gtr-skank', name: 'Skank Guitar', role: 'guitar', kind: 'pitched', description: 'Plucked-string chop with a trebly bite.' },
  { id: 'gtr-muted', name: 'Muted Guitar', role: 'guitar', kind: 'pitched', description: 'Damped strings, percussive scratch.' },
  { id: 'gtr-ska', name: 'Ska Upstroke Guitar', role: 'guitar', kind: 'pitched', description: 'Bright upstroke strum.' },
  { id: 'organ-bubble', name: 'Bubble Organ', role: 'keys', kind: 'pitched', description: 'Drawbar-style tonewheel organ with chorus.' },
  { id: 'organ-combo', name: 'Combo Organ', role: 'keys', kind: 'pitched', description: 'Reedy transistor organ with fast vibrato.' },
  { id: 'ep-tines', name: 'Tine EP', role: 'keys', kind: 'pitched', description: 'FM electric piano with stereo tremolo.' },
  { id: 'piano-bright', name: 'Bright Keys (FM)', role: 'keys', kind: 'pitched', description: 'Percussive FM keys, piano-like attack.' },
  { id: 'horns-roots', name: 'Roots Horns', role: 'horns', kind: 'pitched', description: 'Mellow sax and trombone section in octaves.' },
  { id: 'horns-ska', name: 'Ska Horns', role: 'horns', kind: 'pitched', description: 'Bright trumpet-led section in octaves.' },
  { id: 'perc-roots', name: 'Roots Percussion', role: 'perc', kind: 'drum', description: 'Hand drums, shaker and dub siren.' },
  { id: 'perc-ska', name: 'Ska Percussion', role: 'perc', kind: 'drum', description: 'Tambourine, claps and cowbell.' },
];

export const presetById = new Map(PRESETS.map((p) => [p.id, p]));
