/**
 * Lesson scripts. Each step names a spotlight target (a `data-tour` value)
 * and optional tasks that are checked against the real app state.
 */
import { getPack } from '@/content/library';
import type { Project } from '@/project/types';
import { lookupPattern } from '@/state/store';
import { useUi, type LabTab, type MobileTab } from '@/state/ui';

export interface TaskCtx {
  project: Project;
  /** Project when this step began. */
  snapshot: Project;
  playing: boolean;
  /** How many times an event fired since this step began. */
  ev: (name: string) => number;
  /** Whether the user changed this since the step began (volume, mute, pattern:drums…). */
  seen: (key: string) => boolean;
  live: { fillQueued: boolean; building: boolean; buildQueued: boolean; dropQueued: boolean };
}

export interface Task {
  label: string;
  done: (c: TaskCtx) => boolean;
}

export interface Step {
  id: string;
  title: string;
  body: string | ((c: TaskCtx) => string);
  /** `data-tour` value to spotlight. Omit for a centred card. */
  target?: string;
  tasks?: Task[];
  tip?: string;
  onEnter?: () => void;
  /** Final celebration step. */
  final?: boolean;
}

export interface Tour {
  id: string;
  title: string;
  description: string;
  minutes: number;
  packId: string;
  projectName: string;
  steps: Step[];
}

/** Make sure the panel a step points at is visible. */
function show(opts: { library?: boolean; lab?: LabTab; dock?: boolean; live?: boolean; mobile?: MobileTab }) {
  return () => {
    const ui = useUi.getState();
    const panels = { ...ui.panels };
    if (opts.library) panels.library = true;
    if (opts.lab) panels.lab = true;
    if (opts.dock) panels.dock = true;
    ui.set({
      panels,
      focus: false,
      ...(opts.live ? { centerTab: 'live' as const } : {}),
      ...(opts.lab ? { labTab: opts.lab } : {}),
      ...(opts.library ? { libraryTab: 'packs' as const, family: 'All', query: '' } : {}),
      ...(opts.mobile ? { mobileTab: opts.mobile } : {}),
    });
  };
}

const genresInMix = (p: Project) => {
  const packs = new Set<string>();
  for (const t of p.tracks) {
    const pat = lookupPattern(p, t.patternId);
    if (pat) packs.add(pat.packId);
  }
  return [...packs];
};

const playTask: Task = { label: 'Press Play (or the Space bar)', done: (c) => c.playing };

const playStep: Step = {
  id: 'play',
  title: 'Start the music',
  body: 'Press Play. Everything you change from now on happens live, while the band keeps playing.',
  target: 'play',
  tasks: [playTask],
};

const FIRST_MIX: Tour = {
  id: 'first-mix',
  title: 'Make your first mix',
  description: 'Build a cross-genre groove, mix it and save it, using the real controls.',
  minutes: 5,
  packId: 'roots-reggae',
  projectName: 'My First Mix',
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to LoopLab Studio',
      body:
        'In about five minutes you will build a groove, swap instruments between genres, mix it and save it. ' +
        'We opened a fresh practice project called “My First Mix”, so your other projects stay exactly as they were. ' +
        'You can leave at any time and pick up where you left off.',
    },
    {
      id: 'groove',
      title: 'Choose a groove',
      body: 'A groove pack is a complete band in one style. Open Roots Reggae or Two-Tone Ska in the Groove Library, then press Load.',
      target: 'library',
      onEnter: show({ library: true, mobile: 'library' }),
      tasks: [
        {
          label: 'Load Roots Reggae or Two-Tone Ska',
          done: (c) => c.ev('loadGroove') > 0 && ['roots-reggae', 'two-tone-ska'].includes(c.project.basePackId),
        },
      ],
      tip: 'Click a pack’s name to open it. The Load button appears underneath.',
    },
    { ...playStep, onEnter: show({ mobile: 'deck' }) },
    {
      id: 'meet',
      title: 'Meet the band',
      body:
        'Each row is one instrument, and each has its own colour: drums red, bass amber, guitar green, keys blue, horns purple, percussion and FX cyan. ' +
        'The card in the middle shows the part it is playing; the moving line is where the band is right now.',
      target: 'lanes',
      onEnter: show({ live: true, mobile: 'deck' }),
    },
    {
      id: 'swap',
      title: 'Swap the drums',
      body: 'Press Swap on the Drums row and pick a different beat. The change waits for the next bar, so it always lands in time.',
      target: 'swap-drums',
      onEnter: show({ live: true, mobile: 'deck' }),
      tasks: [{ label: 'Choose a different drum part', done: (c) => c.seen('pattern:drums') }],
      tip: 'While a swap is waiting you will see “Next: …” on the card with a countdown.',
    },
    {
      id: 'combine',
      title: 'Combine two genres',
      body:
        'Now mix styles. Swap the bass, guitar or keys to a part from a different genre, for example a ska guitar over reggae drums. ' +
        'LoopLab keeps every part in the same key and tempo, so they fit.',
      target: 'lanes',
      onEnter: show({ live: true, mobile: 'deck' }),
      tasks: [{ label: 'Have parts from two different genres playing', done: (c) => genresInMix(c.project).length >= 2 }],
      tip: 'In the Swap list, parts are grouped by genre pack.',
    },
    {
      id: 'mix',
      title: 'Balance the mix',
      body:
        'Hover over a volume knob and roll the mouse wheel (hold Shift for fine steps), or drag it up and down. ' +
        'Then try M (mute: silence a track) or S (solo: hear only that track).',
      target: 'lanes',
      onEnter: show({ live: true, mobile: 'deck' }),
      tasks: [
        { label: 'Turn a volume knob', done: (c) => c.seen('volume') },
        { label: 'Mute or solo a track', done: (c) => c.seen('mute') || c.seen('solo') },
      ],
      tip: 'Double-click any knob to reset it.',
    },
    {
      id: 'sections',
      title: 'Change song section',
      body:
        'Songs move between sections: intro, verse, chorus, breakdown. Press a section pad and the chords and parts change at the next boundary. ' +
        'Fill, Build and Drop add transitions.',
      target: 'sections',
      onEnter: show({ dock: true, mobile: 'mixer' }),
      tasks: [{ label: 'Launch a different section', done: (c) => c.ev('section') > 0 }],
    },
    {
      id: 'surprise',
      title: 'Let LoopLab surprise you',
      body:
        'Surprise Me picks a fresh combination of parts that work together. Remix only changes unlocked tracks. ' +
        'Do not worry about losing your mix: Undo (Ctrl+Z) brings it back.',
      target: 'surprise',
      onEnter: show({ lab: 'variation', mobile: 'lab' }),
      tasks: [{ label: 'Press Surprise Me or Remix', done: (c) => c.ev('surprise') + c.ev('remix') > 0 }],
    },
    {
      id: 'save',
      title: 'Name and save your mix',
      body: 'Click the project name at the top and type a name for your mix, then click the save status next to it (or press Ctrl+S).',
      target: 'project-name',
      onEnter: show({}),
      tasks: [
        { label: 'Give your mix a name', done: (c) => c.project.name !== c.snapshot.name || c.seen('name') },
        { label: 'Save it', done: (c) => c.ev('save') > 0 },
      ],
      tip: 'LoopLab also saves automatically a moment after every change.',
    },
    {
      id: 'done',
      title: 'You made your first mix!',
      final: true,
      body: (c) => {
        const genres = genresInMix(c.project)
          .map((id) => getPack(id)?.name)
          .filter(Boolean);
        return (
          `“${c.project.name}” is saved, mixing ${genres.join(' + ') || 'your chosen parts'}. ` +
          'Keep jamming, explore the short lessons in the Help Center, or go back to the project you had open before.'
        );
      },
    },
  ],
};

const MIXER: Tour = {
  id: 'mixer',
  title: 'Learn the mixer',
  description: 'Volume, mute, solo, faders and the master level.',
  minutes: 3,
  packId: 'roots-reggae',
  projectName: 'Lesson: Mixer',
  steps: [
    { id: 'intro', title: 'Learn the mixer', body: 'Mixing means setting how loud each instrument is so they all sit together. This lesson uses a practice project.' },
    { ...playStep, onEnter: show({ mobile: 'deck' }) },
    {
      id: 'knob',
      title: 'Turn the bass up or down',
      body: 'Roll the mouse wheel over the Bass volume knob, or drag it. Listen to how the low end gets bigger or smaller.',
      target: 'volume-bass',
      onEnter: show({ live: true, mobile: 'deck' }),
      tasks: [{ label: 'Change the bass volume', done: (c) => c.seen('volume:bass') }],
    },
    {
      id: 'ms',
      title: 'Mute and solo',
      body: 'M silences a track. S plays only the soloed tracks. Click again to release.',
      target: 'lanes',
      onEnter: show({ live: true, mobile: 'deck' }),
      tasks: [
        { label: 'Mute a track', done: (c) => c.seen('mute') },
        { label: 'Solo a track', done: (c) => c.seen('solo') },
      ],
    },
    {
      id: 'faders',
      title: 'The channel mixer',
      body: 'The faders here control the same volumes, with a live level meter beside each one. Drag a fader, or roll the wheel over it.',
      target: 'mixer',
      onEnter: show({ dock: true, mobile: 'mixer' }),
      tasks: [{ label: 'Move a fader', done: (c) => c.seen('volume') }],
    },
    {
      id: 'master',
      title: 'Master level',
      body: 'The master knob sets the level of everything together. A limiter stops it from distorting.',
      target: 'master',
      onEnter: show({ dock: true, mobile: 'mixer' }),
      tasks: [{ label: 'Adjust the master level', done: (c) => c.seen('master') }],
    },
    { id: 'done', title: 'Mixer lesson complete', final: true, body: 'You can balance any mix now. Tip: start with drums and bass, then bring the other parts in around them.' },
  ],
};

const RHYTHM: Tour = {
  id: 'rhythm',
  title: 'Rhythm and BPM',
  description: 'Tempo, launch timing and swing.',
  minutes: 3,
  packId: 'kingston-ska',
  projectName: 'Lesson: Rhythm',
  steps: [
    { id: 'intro', title: 'Rhythm and BPM', body: 'BPM (beats per minute) is the speed of the music. Each genre has a natural tempo range.' },
    { ...playStep, onEnter: show({ mobile: 'deck' }) },
    {
      id: 'bpm',
      title: 'Change the tempo',
      body: 'Roll the wheel over the BPM, drag it, or type a number. Parts from other genres adapt their feel to the new tempo.',
      target: 'bpm',
      tasks: [{ label: 'Change the BPM', done: (c) => c.seen('bpm') }],
    },
    {
      id: 'quantize',
      title: 'Launch timing',
      body: 'Quantize decides when a swap lands: on the next beat, bar, or every 2 or 4 bars. Longer values keep phrases intact.',
      target: 'quantize',
      onEnter: show({ live: true, mobile: 'deck' }),
      tasks: [{ label: 'Pick a different launch timing', done: (c) => c.seen('quantize') }],
    },
    {
      id: 'swing',
      title: 'Add swing',
      body: 'Swing delays every other sixteenth note so the rhythm bounces instead of marching. Turn it up a little and listen to the hi-hats.',
      target: 'swing',
      onEnter: show({ lab: 'instrument', mobile: 'lab' }),
      tasks: [{ label: 'Turn the swing knob', done: (c) => c.seen('swing') }],
    },
    { id: 'done', title: 'Rhythm lesson complete', final: true, body: 'Tempo sets the energy, swing sets the bounce, quantize keeps everything in time.' },
  ],
};

const GENRES: Tour = {
  id: 'genres',
  title: 'Mixing genres',
  description: 'Compatibility modes and cross-genre swaps.',
  minutes: 3,
  packId: 'two-tone-ska',
  projectName: 'Lesson: Genres',
  steps: [
    { id: 'intro', title: 'Mixing genres', body: 'LoopLab lets any part play with any other. Compatibility decides how adventurous the suggestions are.' },
    { ...playStep, onEnter: show({ mobile: 'deck' }) },
    {
      id: 'compat',
      title: 'Compatibility mode',
      body: 'Safe keeps to the home genre and its close relatives. Creative mixes nearby styles. Wild lets anything meet anything.',
      target: 'compat',
      tasks: [{ label: 'Try a different mode', done: (c) => c.seen('compat') }],
    },
    {
      id: 'swap',
      title: 'Bring in a bass from another genre',
      body: 'Use Swap on the Bass row and choose a part from a different pack. LoopLab moves it into this song’s key and adapts its feel.',
      target: 'swap-bass',
      onEnter: show({ live: true, mobile: 'deck' }),
      tasks: [
        {
          label: 'Play a bass part from another genre',
          done: (c) => {
            const t = c.project.tracks.find((x) => x.role === 'bass');
            const p = lookupPattern(c.project, t?.patternId);
            return !!p && p.packId !== c.project.basePackId;
          },
        },
      ],
      tip: 'If a part was written at a very different tempo, a “half-time” or “double-time” badge shows how it was adapted.',
    },
    { id: 'done', title: 'Genres lesson complete', final: true, body: 'Try Surprise Me in Wild mode for unexpected combinations, and Undo if you do not like one.' },
  ],
};

const SECTIONS: Tour = {
  id: 'sections',
  title: 'Song sections',
  description: 'Sections, transitions and scenes.',
  minutes: 4,
  packId: 'roots-reggae',
  projectName: 'Lesson: Sections',
  steps: [
    { id: 'intro', title: 'Song sections', body: 'A song is a journey through sections. You perform the arrangement live by launching them.' },
    { ...playStep, onEnter: show({ mobile: 'deck' }) },
    {
      id: 'launch',
      title: 'Launch a section',
      body: 'Press a section pad. It flashes “queued” until the next boundary, then the chords and parts change together.',
      target: 'sections',
      onEnter: show({ dock: true, mobile: 'mixer' }),
      tasks: [{ label: 'Launch a section', done: (c) => c.ev('section') > 0 }],
    },
    {
      id: 'transition',
      title: 'Add a transition',
      body: 'Fill plays a drum flourish on the next bar. Build rises for two bars and then drops. Drop hits on the next bar.',
      target: 'sections',
      onEnter: show({ dock: true, mobile: 'mixer' }),
      tasks: [{ label: 'Use Fill, Build or Drop', done: (c) => c.live.fillQueued || c.live.building || c.live.buildQueued || c.live.dropQueued }],
    },
    {
      id: 'scene',
      title: 'Save and recall a scene',
      body: 'A scene remembers every track’s part, mute and level. Save one, change something, then launch the scene to jump back.',
      target: 'sections',
      onEnter: show({ dock: true, mobile: 'mixer' }),
      tasks: [
        { label: 'Save a scene', done: (c) => c.ev('saveScene') > 0 },
        { label: 'Launch a scene', done: (c) => c.ev('scene') > 0 },
      ],
    },
    { id: 'done', title: 'Sections lesson complete', final: true, body: 'The strip under the pads records the order you played: that is your arrangement.' },
  ],
};

const VARIATIONS: Tour = {
  id: 'variations',
  title: 'Variations',
  description: 'New variations, going back, locking and remixing.',
  minutes: 3,
  packId: 'dub',
  projectName: 'Lesson: Variations',
  steps: [
    { id: 'intro', title: 'Variations', body: 'A variation is a new version of a part that keeps its feel. Every original stays safe.' },
    { ...playStep, onEnter: show({ mobile: 'deck' }) },
    {
      id: 'vary',
      title: 'Make a variation',
      body: 'Press New variation in the Sound Lab. It changes the part on the selected track (choose the track with the buttons above).',
      target: 'variation-btn',
      onEnter: show({ lab: 'variation', mobile: 'lab' }),
      tasks: [{ label: 'Make a variation', done: (c) => c.ev('variation') > 0 }],
    },
    {
      id: 'revert',
      title: 'Go back to the original',
      body: 'Press ↺ Original to return to the part the variation came from.',
      target: 'variation-btn',
      onEnter: show({ lab: 'variation', mobile: 'lab' }),
      tasks: [{ label: 'Return to the original', done: (c) => c.ev('revert') > 0 }],
    },
    {
      id: 'remix',
      title: 'Lock and remix',
      body: 'Lock a track you love, then Remix: only unlocked tracks change.',
      target: 'remix-btn',
      onEnter: show({ lab: 'variation', mobile: 'lab' }),
      tasks: [
        { label: 'Lock a track', done: (c) => c.seen('lock') },
        { label: 'Remix unlocked parts', done: (c) => c.ev('remix') > 0 },
      ],
    },
    {
      id: 'undo',
      title: 'Undo',
      body: 'Not keen on the result? Undo (Ctrl+Z) steps back through every change.',
      target: 'undo',
      tasks: [{ label: 'Undo a change', done: (c) => c.ev('undo') > 0 }],
    },
    { id: 'done', title: 'Variations lesson complete', final: true, body: 'Variations you make are kept in the Library under “Yours”.' },
  ],
};

export const TOURS: Tour[] = [FIRST_MIX, MIXER, RHYTHM, GENRES, SECTIONS, VARIATIONS];
