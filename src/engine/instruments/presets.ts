import * as Tone from 'tone';
import type { SoundMode } from '../live';
import { DrumKit, KITS } from './drumKit';
import { ELECTRO_KITS, ElectroKit } from './electroKit';
import { createElectroSynth } from './synths';
import { ComboOrgan, TonewheelOrgan } from './organ';
import { SampledGuitar, type GuitarSampleDef } from './sampledGuitar';
import { SampledHorns, type HornSectionDef } from './sampledHorns';
import { createPitched } from './pitched';
import { SampledBass, type BassSampleDef } from './sampledBass';
import { SampledKit, type KitSampleDef } from './sampledDrums';
import type { Instrument } from './types';

export { PRESETS, presetById } from './presetInfo';

/** Recorded-instrument definitions for presets that have samples. */
const SAMPLED_KITS: Record<string, KitSampleDef> = {
  'kit-roots': {
    sets: ['kit-roots', 'perc'],
    groupSet: 'kit-roots',
    groupRef: 'kick',
    groupPeakDb: -0.5,
    voicePeakDb: -6.5,
    // Roots: the cross-stick and snare carry the groove; hats sit back.
    trims: { rim: 3, snare: 1, hatC: -2, hatO: -3 },
  },
  'kit-twotone': {
    sets: ['kit-twotone', 'perc'],
    groupSet: 'kit-twotone',
    groupRef: 'kick',
    groupPeakDb: 1,
    voicePeakDb: -6.5,
    trims: { snare: 2, hatO: -2 },
  },
  'perc-roots': { sets: ['perc'], voicePeakDb: -5.5, trims: { handLo: 1, shaker: -4, handHi: -2 } },
  'perc-ska': { sets: ['perc'], voicePeakDb: -5.5, trims: { shaker: -4, tamb: -2, cowbell: -3 } },

  // Jungle "sampled break": the crisp club kit pitched up two semitones (like a
  // sped-up funk break), punched with a fast hard compressor and a touch of crunch.
  'kit-break': {
    sets: ['kit-roots', 'perc'],
    groupSet: 'kit-roots',
    groupRef: 'kick',
    groupPeakDb: -1,
    voicePeakDb: -6.5,
    pitch: 2,
    trims: { snare: 2, hatC: -1, ride: -2 },
    chain: () => [
      new Tone.Filter({ type: 'highpass', frequency: 45, Q: 0.6 }),
      new Tone.Filter({ type: 'peaking', frequency: 4800, Q: 0.8, gain: 4 }),
      new Tone.Compressor({ threshold: -28, ratio: 6, attack: 0.002, release: 0.07, knee: 4 }),
      new Tone.Distortion({ distortion: 0.3, wet: 0.3 }),
      new Tone.Filter({ type: 'lowpass', frequency: 12000, Q: 0.5 }),
      new Tone.Gain(Tone.dbToGain(3)),
    ],
  },
  // Trip-hop "dusty break": the fat vintage kit slowed down, rolled-off top,
  // boosted lows, tape saturation and slow-release compression.
  'kit-dusty': {
    sets: ['kit-twotone', 'perc'],
    groupSet: 'kit-twotone',
    groupRef: 'kick',
    groupPeakDb: 3,
    voicePeakDb: -7,
    pitch: -1.5,
    trims: { snare: 2, hatC: -2, hatO: -3 },
    chain: () => [
      new Tone.Filter({ type: 'highpass', frequency: 35, Q: 0.6 }),
      new Tone.Filter({ type: 'lowshelf', frequency: 100, gain: 4 }),
      new Tone.Filter({ type: 'lowpass', frequency: 6000, Q: 0.6 }),
      new Tone.Distortion({ distortion: 0.35, wet: 0.4 }),
      new Tone.Compressor({ threshold: -24, ratio: 4, attack: 0.008, release: 0.14, knee: 6 }),
      new Tone.Gain(Tone.dbToGain(1.5)),
    ],
  },
  // Recorded hand percussion; FX voices (risers, impacts, crackle) come from the drum-machine fallback.
  'perc-jungle': { sets: ['perc'], voicePeakDb: -7, trims: { shaker: -4, congaO: -1, timbH: -2, timbL: -2 } },
  'perc-trip': { sets: ['perc'], voicePeakDb: -9, trims: { shaker: -5, congaM: -2 } },
};

/** Classic-mode / fallback stand-ins for presets that only exist as samples. */
const SYNTH_ALIAS: Record<string, string> = {
  'kit-break': 'kit-roots',
  'kit-dusty': 'kit-twotone',
  'perc-jungle': 'perc-fx',
  'perc-trip': 'perc-fx',
  'perc-house': 'perc-fx',
  'gtr-clean': 'gtr-skank',
  'horns-trumpet': 'horns-ska',
};

const SAMPLED_BASS: Record<string, BassSampleDef> = {
  'bass-dub': {
    set: 'bass-dub',
    levelDb: -16,
    release: 0.09,
    // Flatwounds on the neck pickup are already dark; keep the low end round
    // and steady, tuck away boxy mids, and level the dynamics like a DI + comp.
    chain: () => [
      new Tone.Filter({ type: 'highpass', frequency: 32, Q: 0.7 }),
      new Tone.Filter({ type: 'lowshelf', frequency: 110, gain: 3 }),
      new Tone.Filter({ type: 'peaking', frequency: 420, Q: 1, gain: -3 }),
      new Tone.Filter({ type: 'lowpass', frequency: 2400, Q: 0.5 }),
      // Fast attack catches the finger transients so the bass sits steady under the mix.
      new Tone.Compressor({ threshold: -27, ratio: 4, attack: 0.004, release: 0.16, knee: 8 }),
    ],
  },
  'bass-round': {
    set: 'bass-round',
    levelDb: -15.5,
    release: 0.06,
    staccatoBelow: 0.16,
    // Roundwound Jazz bass: keep the growl and finger definition for ska drive.
    chain: () => [
      new Tone.Filter({ type: 'highpass', frequency: 38, Q: 0.7 }),
      new Tone.Filter({ type: 'peaking', frequency: 950, Q: 1, gain: 2 }),
      new Tone.Filter({ type: 'lowpass', frequency: 5200, Q: 0.5 }),
      new Tone.Compressor({ threshold: -25, ratio: 3.5, attack: 0.003, release: 0.12, knee: 8 }),
    ],
  },
};

/** Modelled instruments used in Studio mode where no suitable CC0 recordings exist. */
const MODELLED: Record<string, (id: string) => Instrument> = {
  // Reggae bubble: classic "88 8000 000"-style registration with a touch of the
  // 4' and soft fast 3rd-harmonic percussion for the pop, Leslie on slow.
  'organ-bubble': (id) =>
    new TonewheelOrgan(id, {
      registration: '88 8400 000',
      percussion: 3,
      percDecay: 0.22,
      percLevel: 0.55,
      click: 0.35,
      leslie: 'slow',
      drive: 0.14,
      level: 5,
    }),
  'organ-combo': (id) => new ComboOrgan(id, 2.8),
};

const guitarChain = (presence: number, presenceHz: number) => () => [
  new Tone.Filter({ type: 'highpass', frequency: 140, Q: 0.7 }),
  new Tone.Filter({ type: 'peaking', frequency: presenceHz, Q: 0.9, gain: presence }),
  new Tone.Filter({ type: 'lowpass', frequency: 9000, Q: 0.5 }),
  new Tone.Compressor({ threshold: -22, ratio: 3, attack: 0.004, release: 0.1, knee: 6 }),
];

const SAMPLED_GUITAR: Record<string, GuitarSampleDef> = {
  // Roots skank: a quick down-stroke, damped right away; the mute noise is the "chk".
  'gtr-skank': { strum: 0.006, up: false, muted: false, maxRing: 0.2, levelDb: -27, releaseGain: 0.32, scratch: 0.045, chain: guitarChain(3, 2600) },
  // Ska: brighter up-strokes on every offbeat.
  'gtr-ska': { strum: 0.005, up: true, muted: false, maxRing: 0.17, levelDb: -26, releaseGain: 0.3, scratch: 0.055, chain: guitarChain(4, 3200) },
  // Muted chops: fretting hand resting on the strings.
  'gtr-muted': { strum: 0.004, up: false, muted: true, maxRing: 0.05, levelDb: -26, releaseGain: 0.4, scratch: 0.26, chain: guitarChain(2, 2400) },
  // Clean, ringing guitar with tremolo: cinematic trip-hop twang and arpeggios.
  'gtr-clean': {
    strum: 0.012,
    up: false,
    muted: false,
    maxRing: 2.6,
    levelDb: -23,
    releaseGain: 0.12,
    scratch: 0,
    chain: () => [
      new Tone.Filter({ type: 'highpass', frequency: 110, Q: 0.6 }),
      new Tone.Filter({ type: 'peaking', frequency: 1800, Q: 0.9, gain: 3 }),
      new Tone.Tremolo({ frequency: 4.6, depth: 0.45 }).start(),
      new Tone.Compressor({ threshold: -22, ratio: 2.5, attack: 0.006, release: 0.15 }),
    ],
  },
};

const SAMPLED_HORNS: Record<string, HornSectionDef> = {
  // Lone cinematic trumpet, darkened like a muted horn in a smoky room.
  'horns-trumpet': {
    melody: [{ player: 'trumpet', shift: 0 }],
    chordOrder: ['trumpet', 'tenor-sax', 'trombone'],
    staccatoBelow: 0.18,
    release: 0.25,
    chain: () => [
      new Tone.Filter({ type: 'highpass', frequency: 240, Q: 0.6 }),
      new Tone.Filter({ type: 'lowpass', frequency: 3200, Q: 0.7 }),
      new Tone.Compressor({ threshold: -20, ratio: 2.5, attack: 0.01, release: 0.2 }),
      new Tone.Gain(Tone.dbToGain(5)),
    ],
  },
  // Roots: mellow tenor sax with trombone an octave below.
  'horns-roots': {
    melody: [
      { player: 'tenor-sax', shift: 0 },
      { player: 'trombone', shift: -12 },
    ],
    chordOrder: ['tenor-sax', 'trombone'],
    staccatoBelow: 0.22,
    release: 0.12,
    chain: () => [
      new Tone.Filter({ type: 'highpass', frequency: 110, Q: 0.7 }),
      new Tone.Filter({ type: 'lowpass', frequency: 7000, Q: 0.5 }),
      new Tone.Compressor({ threshold: -20, ratio: 2.5, attack: 0.01, release: 0.15, knee: 6 }),
    ],
  },
  // Ska: the classic trumpet + tenor unison with trombone an octave below.
  'horns-ska': {
    melody: [
      { player: 'trumpet', shift: 0 },
      { player: 'tenor-sax', shift: 0 },
      { player: 'trombone', shift: -12 },
    ],
    chordOrder: ['trumpet', 'tenor-sax', 'trombone'],
    staccatoBelow: 0.2,
    release: 0.08,
    chain: () => [
      new Tone.Filter({ type: 'highpass', frequency: 130, Q: 0.7 }),
      new Tone.Filter({ type: 'peaking', frequency: 3000, Q: 1, gain: 1.5 }),
      new Tone.Compressor({ threshold: -20, ratio: 2.5, attack: 0.008, release: 0.12, knee: 6 }),
    ],
  },
};

export function hasSamples(id: string): boolean {
  return id in SAMPLED_KITS || id in SAMPLED_BASS || id in MODELLED || id in SAMPLED_GUITAR || id in SAMPLED_HORNS;
}

function createSynth(id: string): Instrument | null {
  const real = SYNTH_ALIAS[id] ?? id;
  if (ELECTRO_KITS[real]) return new ElectroKit(id, ELECTRO_KITS[real]);
  if (KITS[real]) return new DrumKit(id, KITS[real], real.startsWith('perc') ? 0.9 : 1);
  return createPitched(real) ?? createElectroSynth(real);
}

/**
 * Build an instrument. In 'sampled' mode, presets with recordings become
 * sample players (the synth version plays until the recordings have loaded).
 */
export function createInstrument(id: string, mode: SoundMode = 'synth'): Instrument | null {
  if (mode === 'sampled') {
    const kit = SAMPLED_KITS[id];
    if (kit) return new SampledKit(id, kit, createSynth(id));
    const bass = SAMPLED_BASS[id];
    if (bass) return new SampledBass(id, bass, createSynth(id));
    const modelled = MODELLED[id];
    if (modelled) return modelled(id);
    const guitar = SAMPLED_GUITAR[id];
    if (guitar) return new SampledGuitar(id, guitar, createSynth(id));
    const horns = SAMPLED_HORNS[id];
    if (horns) return new SampledHorns(id, horns, createSynth(id));
  }
  return createSynth(id);
}
