/**
 * DUB — original material, written for LoopLab.
 * 72 BPM, E minor. The mixing desk is the instrument: parts drop in and out,
 * single chops and stabs are left for the echo, and the bass carries the
 * weight in long, deep notes. Turn up each track's "Dub echo" knob to throw
 * the skank and stabs into the delay.
 */
import type { GenrePack } from '@/music/types';
import { ap, ch, grid, hit, makePatternFactory, n, rep } from '../dsl';

const PACK = 'dub';
const P = makePatternFactory({ packId: PACK, genre: 'Dub', bpm: 72 });
const SW = 0.4;
const SW_PLAY = 0.2;
const triad = [0, 2, 4];

export const dub: GenrePack = {
  id: PACK,
  name: 'Dub',
  genre: 'Dub',
  family: 'Reggae',
  description: 'Empty space, heavy bass, echo throws. Parts drop out so the ones that stay hit harder.',
  bpm: 72,
  timeSig: [4, 4],
  accent: '#b37bff',
  harmony: {
    root: 4,
    mode: 'minor',
    progression: [
      { deg: 0, bars: 2 },
      { deg: 6, bars: 2 },
    ],
  },
  fills: ['db-drums-fill'],
  patterns: [
    // ───────────── DRUMS ─────────────
    P({
      id: 'db-drums-empty',
      name: 'Empty Drop',
      role: 'drums',
      bars: 2,
      swing: SW,
      instrument: 'kit-roots',
      energy: 1,
      tags: ['breakdown'],
      description: 'The drop on 3 in bar one only; bar two is nearly empty: space as a sound.',
      hits: grid({
        kick: '........X....... ................',
        rim: '........X....... ........x.......',
        hatC: '..g...m......... ..g.......g.....',
      }),
    }),
    P({
      id: 'db-drums-rockers',
      name: 'Dub Rockers',
      role: 'drums',
      bars: 1,
      swing: SW,
      instrument: 'kit-roots',
      energy: 3,
      tags: ['rockers'],
      description: 'Kick on 1 and 3, the rim cracking on 3, sparse hats with soft open lifts.',
      hits: grid({
        kick: 'X.......X.......',
        rim: '........X.....g.',
        hatC: 'x...x...x...x...',
        hatO: '......-.......-.',
      }),
    }),
    P({
      id: 'db-drums-drop',
      name: 'Heavy One Drop',
      role: 'drums',
      bars: 2,
      swing: SW,
      instrument: 'kit-roots',
      energy: 2,
      tags: ['one-drop'],
      description: 'A deep, patient one drop with an open-hat breath at the end of the phrase.',
      hits: grid({
        kick: '........X....... ........X.......',
        rim: '........X....... ........X..g....',
        hatC: 'x.m.x.m.x.m.x.m. x.m.x.m.x.......',
        hatO: '................ ............m...',
      }),
    }),
    P({
      id: 'db-drums-fill',
      name: 'Dub Roll',
      role: 'drums',
      bars: 1,
      swing: SW,
      instrument: 'kit-roots',
      energy: 3,
      tags: ['fill', 'crash-after'],
      description: 'The drop, then a slow triplet roll down the toms into the echo.',
      hits: [
        ...grid({ kick: '........X.......', rim: '........X.......' }),
        hit('tomH', 12, 0.8),
        hit('tomH', 12 + 2 / 3, 0.55),
        hit('tomM', 13 + 1 / 3, 0.75),
        hit('tomM', 14, 0.6),
        hit('tomL', 14 + 2 / 3, 0.85),
        hit('tomL', 15 + 1 / 3, 0.95),
      ],
    }),

    // ───────────── BASS ─────────────
    P({
      id: 'db-bass-deep',
      name: 'Deep Dub',
      role: 'bass',
      bars: 2,
      swing: SW_PLAY,
      instrument: 'bass-dub',
      energy: 2,
      description: 'Two enormous notes and a pickup: the bass as a wall of weight.',
      notes: [n(2, 0, 10, 0.95), n(18, -3, 6, 0.9), n(30, -1, 1, 0.6)],
    }),
    P({
      id: 'db-bass-walk',
      name: 'Dub Walk',
      role: 'bass',
      bars: 2,
      swing: SW_PLAY,
      instrument: 'bass-dub',
      energy: 3,
      description: 'A moving dub line that still leaves the downbeat breathing.',
      notes: [
        n(0, 0, 2, 0.9),
        n(3, 2, 1, 0.6),
        n(4, 4, 3, 0.85),
        n(8, 3, 2, 0.7),
        n(10, 2, 2, 0.75),
        n(14, 0, 2, 0.8),
        n(18, 0, 3, 0.95),
        n(22, -1, 1, 0.6),
        n(24, -3, 4, 0.85),
        ap(30, 0, 1.5, 0.7, 0, -1),
      ],
    }),
    P({
      id: 'db-bass-drop',
      name: 'Bass Drop',
      role: 'bass',
      bars: 4,
      swing: SW_PLAY,
      instrument: 'bass-dub',
      energy: 1,
      tags: ['breakdown', 'sparse'],
      description: 'One note every two bars. Let it hang.',
      notes: [n(2, 0, 12, 0.95), n(34, -3, 10, 0.9)],
    }),

    // ───────────── GUITAR ─────────────
    P({
      id: 'db-gtr-echo',
      name: 'Echo Skank',
      role: 'guitar',
      bars: 2,
      swing: SW_PLAY,
      instrument: 'gtr-skank',
      energy: 1,
      voicing: 'close',
      tags: ['fx'],
      description: 'A single chop every two bars, made for the delay. Turn up Dub echo.',
      notes: [ch(4, triad, 0.5, 0.85), ch(28, triad, 0.5, 0.55)],
    }),
    P({
      id: 'db-gtr-skank',
      name: 'Dub Skank',
      role: 'guitar',
      bars: 1,
      swing: SW_PLAY,
      instrument: 'gtr-skank',
      energy: 2,
      voicing: 'close',
      description: 'The classic chop on 2 and 4, played softer and drier.',
      notes: [ch(4, triad, 0.5, 0.75), ch(12, triad, 0.5, 0.75)],
    }),

    // ───────────── KEYS ─────────────
    P({
      id: 'db-keys-stab',
      name: 'Organ Stab',
      role: 'keys',
      bars: 2,
      swing: SW,
      instrument: 'organ-bubble',
      energy: 1,
      voicing: 'close',
      tags: ['fx'],
      description: 'One organ stab on the last "and" of the phrase, thrown into the echo.',
      notes: [ch(14, triad, 0.5, 0.6)],
    }),
    P({
      id: 'db-keys-bubble',
      name: 'Ghost Bubble',
      role: 'keys',
      bars: 1,
      swing: SW,
      instrument: 'organ-bubble',
      energy: 2,
      voicing: 'close',
      description: 'A barely-there organ bubble under the mix.',
      notes: rep([ch(2, [0, 4], 0.6, 0.45, -1), ch(3, triad, 0.5, 0.35)], 4, 4),
    }),

    // ───────────── HORNS ─────────────
    P({
      id: 'db-horns-echo',
      name: 'Horn Echo',
      role: 'horns',
      bars: 4,
      swing: SW,
      harmony: 'key',
      instrument: 'horns-roots',
      energy: 2,
      description: 'Long, mournful notes with gaps for the echo to answer.',
      notes: [n(2, 4, 4, 0.8), n(12, 3, 2, 0.6), n(16, 2, 8, 0.75), n(36, 3, 6, 0.75), n(48, 1, 2, 0.6), n(52, 0, 8, 0.7)],
    }),
    P({
      id: 'db-horns-stab',
      name: 'Single Stab',
      role: 'horns',
      bars: 2,
      swing: SW,
      instrument: 'horns-roots',
      energy: 1,
      voicing: 'close',
      tags: ['fx'],
      description: 'One horn hit every two bars.',
      notes: [ch(6, triad, 1.5, 0.7)],
    }),

    // ───────────── PERCUSSION / FX ─────────────
    P({
      id: 'db-perc-clicks',
      name: 'Delay Clicks',
      role: 'perc',
      bars: 2,
      swing: SW,
      instrument: 'perc-roots',
      energy: 1,
      description: 'A few claves and shaker taps for the delay to multiply.',
      hits: grid({
        claves: '..........x..... ..............g.',
        shaker: '..g...g...g...g. ..g...g...g...g.',
      }),
    }),
    P({
      id: 'db-perc-siren',
      name: 'Siren Throws',
      role: 'perc',
      bars: 4,
      swing: SW,
      instrument: 'perc-roots',
      energy: 2,
      tags: ['fx'],
      description: 'Siren sweeps every two bars over a soft shaker.',
      hits: [...grid({ shaker: '..g...g...g...g.' }), hit('siren', 12, 0.7), hit('siren', 44, 0.55)],
    }),
  ],
  sections: [
    {
      id: 'intro',
      kind: 'intro',
      name: 'Intro',
      progression: [{ deg: 0, bars: 4 }],
      parts: { drums: 'db-drums-empty', bass: 'db-bass-deep', guitar: null, keys: null, horns: null, perc: 'db-perc-clicks' },
    },
    {
      id: 'verse',
      kind: 'verse',
      name: 'Verse',
      progression: [
        { deg: 0, bars: 2 },
        { deg: 6, bars: 2 },
      ],
      parts: { drums: 'db-drums-rockers', bass: 'db-bass-walk', guitar: 'db-gtr-skank', keys: 'db-keys-bubble', horns: null, perc: 'db-perc-clicks' },
    },
    {
      id: 'chorus',
      kind: 'chorus',
      name: 'Full Dub',
      progression: [
        { deg: 5, bars: 1 },
        { deg: 6, bars: 1 },
        { deg: 0, bars: 2 },
      ],
      parts: { drums: 'db-drums-drop', bass: 'db-bass-walk', guitar: 'db-gtr-echo', keys: 'db-keys-stab', horns: 'db-horns-echo', perc: 'db-perc-siren' },
    },
    {
      id: 'breakdown',
      kind: 'breakdown',
      name: 'Drop Out',
      progression: [
        { deg: 0, bars: 2 },
        { deg: 3, bars: 2 },
      ],
      parts: { drums: 'db-drums-empty', bass: 'db-bass-drop', guitar: 'db-gtr-echo', keys: null, horns: 'db-horns-stab', perc: 'db-perc-siren' },
    },
    {
      id: 'outro',
      kind: 'outro',
      name: 'Outro',
      progression: [
        { deg: 0, bars: 2 },
        { deg: 6, bars: 2 },
      ],
      parts: { drums: 'db-drums-drop', bass: 'db-bass-deep', guitar: 'db-gtr-skank', keys: 'db-keys-stab', horns: 'db-horns-echo', perc: 'db-perc-clicks' },
    },
  ],
};
