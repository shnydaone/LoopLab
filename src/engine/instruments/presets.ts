import * as Tone from 'tone';
import type { SoundMode } from '../live';
import { DrumKit, KITS } from './drumKit';
import { ComboOrgan, TonewheelOrgan } from './organ';
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

export function hasSamples(id: string): boolean {
  return id in SAMPLED_KITS || id in SAMPLED_BASS || id in MODELLED;
}

function createSynth(id: string): Instrument | null {
  if (KITS[id]) return new DrumKit(id, KITS[id], id.startsWith('perc') ? 0.9 : 1);
  return createPitched(id);
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
  }
  return createSynth(id);
}
