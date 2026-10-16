/** Instrument preset metadata (no Tone.js import, safe for tests and UI). */
import type { PresetInfo } from './types';

export const PRESETS: PresetInfo[] = [
  { id: 'kit-roots', name: 'Roots Kit', role: 'drums', kind: 'drum', description: 'Small club kit: tight high snare, woody cross-stick, deep round kick.', sampled: 'Virtuosity Drums (Versilian Studios / Karoryfer), close + overhead mics, plus timbales and hand percussion' },
  { id: 'kit-twotone', name: 'Two-Tone Kit', role: 'drums', kind: 'drum', description: 'Vintage kit: fatter kick, cracking snare, bright hats.', sampled: 'Big Rusty Drums (Karoryfer), kick/snare/overhead mics' },
  { id: 'bass-dub', name: 'Dub Bass', role: 'bass', kind: 'pitched', description: 'Round, deep and warm.', sampled: 'Swagbass (Karoryfer): old flatwound strings, neck pickup, played with fingers' },
  { id: 'bass-round', name: 'Round Finger Bass', role: 'bass', kind: 'pitched', description: 'Punchy, woody, sits forward in the mix.', sampled: 'Growlybass (Karoryfer): Jazz bass, roundwound strings, with staccato samples' },
  { id: 'gtr-skank', name: 'Skank Guitar', role: 'guitar', kind: 'pitched', description: 'Plucked-string chop with a trebly bite.' },
  { id: 'gtr-muted', name: 'Muted Guitar', role: 'guitar', kind: 'pitched', description: 'Damped strings, percussive scratch.' },
  { id: 'gtr-ska', name: 'Ska Upstroke Guitar', role: 'guitar', kind: 'pitched', description: 'Bright upstroke strum.' },
  { id: 'organ-bubble', name: 'Bubble Organ', role: 'keys', kind: 'pitched', description: 'Drawbar-style tonewheel organ with chorus.' },
  { id: 'organ-combo', name: 'Combo Organ', role: 'keys', kind: 'pitched', description: 'Reedy transistor organ with fast vibrato.' },
  { id: 'ep-tines', name: 'Tine EP', role: 'keys', kind: 'pitched', description: 'FM electric piano with stereo tremolo.' },
  { id: 'piano-bright', name: 'Bright Keys (FM)', role: 'keys', kind: 'pitched', description: 'Percussive FM keys, piano-like attack.' },
  { id: 'horns-roots', name: 'Roots Horns', role: 'horns', kind: 'pitched', description: 'Mellow sax and trombone section in octaves.' },
  { id: 'horns-ska', name: 'Ska Horns', role: 'horns', kind: 'pitched', description: 'Bright trumpet-led section in octaves.' },
  { id: 'perc-roots', name: 'Roots Percussion', role: 'perc', kind: 'drum', description: 'Hand drums, shaker and dub siren.', sampled: 'Virtuosity Drums hand percussion (tumba, bongos, shaker, claves); the dub siren stays synthesised' },
  { id: 'perc-ska', name: 'Ska Percussion', role: 'perc', kind: 'drum', description: 'Tambourine, claps and cowbell.', sampled: 'Virtuosity Drums tambourine, cowbell and shaker; claps stay synthesised' },
];

export const presetById = new Map(PRESETS.map((p) => [p.id, p]));
