/**
 * Contextual help for every meaningful control. Each entry answers:
 * what is it, what does it do, how do I use it, when would I use it.
 * Beginner help shows all of it; Standard shows title + what; Expert shows
 * title + what only after a longer hover.
 */

export interface HelpEntry {
  title: string;
  what: string;
  does?: string;
  how?: string;
  when?: string;
  /** Extra detail shown in the Help Center glossary. */
  more?: string;
  /** Set when a control is not available yet. */
  status?: string;
}

export const HELP: Record<string, HelpEntry> = {
  // ───── transport & project ─────
  play: {
    title: 'Play / Stop',
    what: 'Starts and stops the band.',
    does: 'Every track loops its part in perfect time with the others.',
    how: 'Click, or press Space anywhere.',
    when: 'Start here. You can keep swapping parts while the music plays.',
  },
  restart: {
    title: 'Back to start',
    what: 'Restarts the music from bar 1.',
    does: 'Stops and immediately plays again, so every part and chord progression starts from the top.',
    how: 'Click while playing (or stopped).',
    when: 'When you want to hear your mix from the beginning of a phrase.',
  },
  stop: {
    title: 'Stop',
    what: 'Stops playback and returns to bar 1.',
    how: 'Click, or press Space while playing.',
  },
  record: {
    title: 'Capture (coming soon)',
    what: 'Will record your live mixing so you can turn it into a song.',
    status: 'Not available yet: arrives with Song Studio (Phase 3). For now, save Scenes to remember combinations.',
  },
  bpm: {
    title: 'Tempo (BPM)',
    what: 'How fast the music plays, in Beats Per Minute.',
    does: 'Higher numbers play faster; every track speeds up or slows down together, so nothing goes out of sync.',
    how: 'Drag the number up or down, scroll the mouse wheel over it, click − / +, or type a value.',
    when: 'Reggae feels right around 70–80, ska around 150–170, house around 120–128, jungle around 160–175.',
  },
  key: {
    title: 'Key and scale',
    what: 'The musical "home" note and the family of notes the song uses.',
    does: 'Changing it moves every melodic part (bass, guitar, keys, horns) to the new key together, so they stay in tune with each other.',
    how: 'Pick a root note and a scale. Minor sounds darker, major brighter, Dorian and Mixolydian are in between.',
    when: 'To change the mood, or to match a singer or another song.',
  },
  compat: {
    title: 'Mixing mode: Safe / Creative / Wild',
    what: 'How strictly parts borrowed from other genres are adapted to fit.',
    does: 'Safe: every part follows the song\'s key and chords, and clashing melody notes are nudged into harmony. Creative: parts follow the key and chords but keep their own scale colour. Wild: parts keep their original key, chords and tempo feel, so clashes can happen.',
    how: 'Click a mode. The change applies immediately.',
    when: 'Stay on Safe while learning. Try Creative for surprising colours, Wild for experimental mashups.',
  },
  quantize: {
    title: 'Launch timing (quantize)',
    what: 'When a swapped part or section actually starts playing.',
    does: 'Changes wait for the next beat, bar or phrase instead of jumping in mid-rhythm, so everything stays locked together.',
    how: 'Choose Next beat, Next bar (recommended), 2 bars or a 4-bar phrase.',
    when: 'Longer settings make big changes land on musical phrase boundaries, like a DJ would.',
  },
  'sound-mode': {
    title: 'Sound: Studio / Classic',
    what: 'Switches between the upgraded instruments and the original synth sounds.',
    does: 'Studio uses real recorded drums, bass, guitar and horns plus modelled organs and electronic synths. Classic uses the first-version synthesisers.',
    how: 'Click to compare. The switch is instant, even while playing.',
    when: 'Use Studio for the best sound; Classic is there for comparison.',
  },
  project: {
    title: 'Project name',
    what: 'The name of the song you are working on.',
    how: 'Click to rename, then press Enter.',
    when: 'Give each idea its own name so you can find it in the Project menu.',
  },
  'genre-tags': {
    title: 'Genres in this mix',
    what: 'The genres your current parts come from.',
    does: 'Updates automatically as you swap parts between genres.',
  },
  save: {
    title: 'Save status',
    what: 'Shows whether your latest changes are stored.',
    does: 'LoopLab autosaves to this browser about a second after every change. Saved projects include every track\'s part, sound, mixer and effect settings, tempo, key, sections, scenes and your variations.',
    how: 'Click to save immediately (or press Ctrl+S). Use the menu to export a file you can back up.',
    when: 'Always on. Export a JSON file if you want a copy outside this browser.',
  },
  menu: {
    title: 'Project menu',
    what: 'New, open, rename, duplicate, delete, import and export projects.',
    when: 'To start a fresh idea, reopen an old one, or back up your work.',
  },
  undo: { title: 'Undo', what: 'Takes back your last change.', how: 'Click, or press Ctrl+Z.', when: 'After any change you don\'t like, including Surprise Me.' },
  redo: { title: 'Redo', what: 'Brings back a change you undid.', how: 'Click, or press Ctrl+Shift+Z.' },
  help: {
    title: 'Help Center',
    what: 'Guided lessons, a glossary of music terms, shortcuts and help settings.',
    how: 'Click any time. You can restart the tutorial from here.',
  },
  'learn-mode': {
    title: 'Learn mode',
    what: 'Tap or click any control to see what it does, without changing anything.',
    how: 'Turn it on, explore, then turn it off to play again.',
    when: 'Great on touch screens, or when you want to explore safely.',
  },
  layout: {
    title: 'Workspace layout',
    what: 'Show or hide the Groove Library, Sound Lab and bottom dock, or focus on the Live Mix.',
    how: 'Drag the edges between panels to resize them; your layout is remembered.',
  },
  'ui-scale': {
    title: 'Interface size and density',
    what: 'Makes everything larger or smaller, and spacing roomier or tighter.',
    when: 'Increase on very large screens or if text feels small.',
  },

  // ───── library ─────
  library: {
    title: 'Groove Library',
    what: 'All the musical styles, each a band of coordinated parts.',
    does: 'Load a groove to hear a complete band, or pick individual parts from any genre.',
    how: 'Click Load on a pack, or open it to launch a section.',
  },
  'pack-card': {
    title: 'Groove pack',
    what: 'A genre: drums, bass, chords, melodies and percussion written to work together, plus song sections.',
    how: 'Load replaces every unlocked track with this genre\'s band. The section chips launch intros, verses, choruses and more.',
    when: 'To start a new idea in a style, or to jump to a different part of the song.',
  },
  favorite: { title: 'Favourite', what: 'Star a pack to find it quickly in the Favourites tab.' },
  search: { title: 'Search', what: 'Filter packs and parts by name, genre or instrument.', how: 'Type words like "bass", "dub" or "organ".' },
  family: { title: 'Genre family', what: 'Show only one family of styles: Reggae, Ska, Electronic…' },
  'library-tabs': {
    title: 'Library views',
    what: 'Packs shows whole genres; Parts lists every individual part; Favourites shows starred packs; Yours shows variations you created.',
  },
  part: {
    title: 'Part (pattern)',
    what: 'A reusable musical phrase for one instrument, from one genre.',
    how: 'Click to send it to the matching track. It starts at the next bar.',
    when: 'To build your own combination part by part.',
  },

  // ───── live mix ─────
  'live-mix': {
    title: 'Live Mix',
    what: 'Your band: one lane per instrument, each playing a part in sync.',
    how: 'Swap parts with « and Swap, adjust volume with the knob, mute or solo with M and S.',
  },
  'center-tabs': {
    title: 'Workspace views',
    what: 'Live Mix (perform), Pattern (see the selected part up close), FX Sends (effect amounts for every track), Arrange (coming soon).',
  },
  arrange: {
    title: 'Arrange (coming soon)',
    what: 'A timeline for building a full song from your sections.',
    status: 'Song Studio arrives in Phase 3. Today you can perform an arrangement live with the section pads.',
  },
  track: {
    title: 'Instrument track',
    what: 'One member of your band.',
    does: 'Drums keep the beat, bass holds the low groove, guitar/pads add rhythm or texture, keys play chords, horns/lead carry melodies, percussion/FX add sparkle.',
    how: 'Click a track to edit it in Sound Lab.',
  },
  clip: {
    title: 'Clip (the part playing now)',
    what: 'Shows the pattern this track is playing, with a moving playhead.',
    does: 'When you queue a new part, a countdown shows exactly when it will start.',
    how: 'Use the ‹ › arrows to step through parts, or Swap to pick from a list.',
  },
  swap: {
    title: 'Swap part',
    what: 'Choose a different part for this instrument from any genre.',
    does: 'The new part waits for the next bar, then joins in perfect sync. The music never stops.',
    how: 'Click Swap to choose, or « to go back to the previous part.',
    when: 'Whenever you want to change the feel: try ska drums under reggae bass!',
  },
  'prev-part': { title: 'Previous part', what: 'Steps back to the previous part in the list for this instrument.', how: 'Click, or press ← with the track selected.' },
  'next-part': { title: 'Next part', what: 'Steps to the next part for this instrument (across all genres).', how: 'Click, or press → with the track selected.' },
  volume: {
    title: 'Volume',
    what: 'How loud this track is in the mix.',
    how: 'Scroll the mouse wheel over the knob (hold Shift for fine steps), drag up/down, or use arrow keys. Double-click resets to 0 dB.',
    when: 'Balance the band so every instrument can be heard.',
  },
  mute: {
    title: 'Mute (M)',
    what: 'Silences this track temporarily.',
    does: 'The part keeps playing silently, so unmuting brings it back in time.',
    how: 'Click M, or press M with the track selected.',
    when: 'To hear the mix without an instrument, or to drop it out for drama.',
  },
  solo: {
    title: 'Solo (S)',
    what: 'Listens to this track alone.',
    does: 'Every track that is not soloed goes quiet. Solo several tracks to hear them together.',
    how: 'Click S, or press S with the track selected. Click again to release.',
    when: 'To focus on one part while you adjust it.',
  },
  lock: {
    title: 'Lock',
    what: 'Protects this track from Surprise Me, Remix and section changes.',
    when: 'Found a part you love? Lock it, then let Surprise Me rebuild everything around it.',
  },
  variation: {
    title: 'Variation (✦)',
    what: 'Creates a new version of this part.',
    does: 'Keeps the important hits and adds or moves the decoration. Breakbeats are re-chopped like a jungle producer would. The original is kept, and you can return to it.',
    how: 'Click ✦, or press V with the track selected.',
  },
  'track-more': { title: 'More track options', what: 'Variation, original part, lock, instrument sound, track type, rename, move or remove the track.' },
  'track-type': {
    title: 'Change track type',
    what: 'Turns this track into a different kind of instrument track: drums, bass, guitar or pad, keys, horns or lead, or percussion and FX.',
    does: 'The track gets parts and sounds of the new type, a fitting part from the current groove, and that type’s mix settings.',
    how: 'Open ⋯ on the track and pick a type. Undo (Ctrl+Z) puts it back.',
    when: 'When you want two drum tracks layered, a second bassline, or no horns at all.',
  },
  'add-track': {
    title: 'Add track',
    what: 'Adds another instrument track (up to 12).',
    does: 'The new track starts with a part from the current groove that no other track of that type is playing.',
    how: 'Click, then choose what kind of track.',
    when: 'Layer a second drum groove, add an extra keys part, or stack percussion.',
  },
  'remove-track': { title: 'Remove track', what: 'Deletes this track from the project. Undo (Ctrl+Z) brings it back. A project always keeps at least one track.' },
  'rename-track': { title: 'Rename track', what: 'Give the track your own name, such as "Shaker" or "Dub bass".' },
  'move-track': { title: 'Move track', what: 'Moves the track up or down the list. The order also sets the 1–9 keyboard shortcuts.' },
  'genre-chip': { title: 'Genre of this part', what: 'Which pack this part comes from.' },
  feel: {
    title: 'Tempo feel',
    what: 'This part is playing at double-time (2×) or half-time (½×) to fit the song tempo.',
    does: 'LoopLab keeps every part\'s natural feel: a 168 BPM ska beat in a 76 BPM reggae song plays double-time instead of crawling.',
  },
  queued: {
    title: 'Queued change',
    what: 'A new part is waiting to start.',
    does: 'It joins at the next bar (or your launch setting) so it lands exactly in time.',
  },

  // ───── sound lab ─────
  'sound-lab': {
    title: 'Sound Lab',
    what: 'Edit the selected track: its instrument, tone, effects and variations.',
    how: 'Select a track in the Live Mix, then adjust here.',
  },
  instrument: {
    title: 'Instrument sound',
    what: 'The sound this track plays its part with.',
    does: 'Change it to hear the same notes on a different instrument, e.g. a reggae bassline on a house synth.',
  },
  filter: {
    title: 'Filter cutoff',
    what: 'Makes the sound brighter or darker.',
    does: 'A low-pass filter removes high frequencies above the cutoff. Fully open = the natural sound; turning it down = muffled, distant, underwater.',
    how: 'Scroll or drag the knob. Combine with Resonance for classic filter sweeps.',
    when: 'Builds and breakdowns, taming harsh sounds, or making a part sit further back.',
  },
  resonance: {
    title: 'Resonance',
    what: 'Emphasises the frequencies right at the filter cutoff.',
    does: 'Adds a ringing, whistling peak that becomes dramatic as you move the cutoff. It is the "acid" sound of electronic music.',
    how: 'Raise it a little, then sweep the Filter knob.',
    when: 'For squelchy basses and expressive filter sweeps. Keep it low for natural sounds.',
  },
  drive: { title: 'Drive', what: 'Adds saturation and grit.', does: 'Gently distorts the sound, making it warmer, louder-feeling and edgier.', when: 'To make a bass growl or a guitar bite.' },
  reverb: { title: 'Reverb', what: 'Adds space, as if the track were played in a room or hall.', when: 'A little makes parts sit together; a lot makes them distant and dreamy.' },
  delay: {
    title: 'Dub echo (delay)',
    what: 'Repeats the sound in time with the music.',
    does: 'Each echo comes a dotted eighth later and fades away, the signature of dub reggae.',
    when: 'Throw a guitar chop or horn stab into the echo for drama.',
  },
  pan: {
    title: 'Pan',
    what: 'Where the track sits between the left and right speakers.',
    how: 'Turn left or right; double-click to centre.',
    when: 'Spread instruments apart so each one is easier to hear.',
  },
  density: {
    title: 'Density',
    what: 'How busy the part is.',
    does: 'Turning it down removes the quietest notes first (ghost notes and soft offbeats), keeping the main beats.',
    when: 'To simplify a busy part, or to build up energy gradually.',
  },
  swing: {
    title: 'Swing',
    what: 'Changes the rhythmic feel from straight to bouncy.',
    does: 'Delays every other sixteenth note slightly, making the groove lilt or shuffle.',
    when: 'Hip-hop, trip-hop and reggae love a little swing; techno and two-tone usually stay straight.',
  },
  'variation-amount': {
    title: 'Variation amount',
    what: 'How different a new variation is from the original.',
    does: 'Low keeps variations subtle; high makes bolder changes.',
  },
  energy: {
    title: 'Energy',
    what: 'Makes the whole band calmer or more intense.',
    does: 'Swaps unlocked parts for lower- or higher-energy versions and adds or removes layers.',
    how: 'Click − or +. Undo if you liked it better before.',
  },
  'surprise-me': {
    title: 'Surprise Me',
    what: 'Builds a fresh, musically coherent band from all the packs.',
    does: 'Picks a genre, tempo, chord progression and a part for every unlocked track. Locked tracks are kept.',
    how: 'Click, or press Shift+S. Changed your mind? Undo (Ctrl+Z) restores your previous mix.',
    when: 'When you want inspiration, or a happy accident.',
  },
  remix: {
    title: 'Remix',
    what: 'Re-picks every unlocked part from any genre, keeping your tempo and chords.',
    how: 'Click, or press R. Undo brings back the previous parts.',
  },

  // ───── sections, scenes, mixer ─────
  sections: {
    title: 'Song sections',
    what: 'The parts of a song: intro, verse, chorus, breakdown, outro.',
    does: 'Launching a section switches every unlocked track and the chord progression together at the next boundary.',
    how: 'Click a section pad. Fill, Build and Drop add transitions.',
    when: 'Perform a song live: intro → verse → chorus → breakdown → chorus → outro.',
  },
  'section-intro': { title: 'Intro', what: 'The opening: usually sparse, introducing the groove gently.' },
  'section-verse': { title: 'Verse / Main groove', what: 'The main groove, where the story is told. Steady and repeatable.' },
  'section-chorus': { title: 'Chorus / Drop', what: 'The high point: fuller, catchier, more energy.' },
  'section-bridge': { title: 'Bridge / Main groove B', what: 'A contrasting groove that adds variety before returning.' },
  'section-breakdown': { title: 'Breakdown', what: 'Instruments drop out for contrast and tension, making the return hit harder.' },
  'section-outro': { title: 'Outro', what: 'The ending: winds the energy down.' },
  fill: {
    title: 'Fill',
    what: 'A one-bar drum flourish leading into the next bar.',
    how: 'Press while playing (or press F). It lands on the next bar, then the groove returns.',
    when: 'To signal a change, like moving into the chorus.',
  },
  build: {
    title: 'Build-up',
    what: 'Two bars of rising tension: the whole mix gets thinner, a riser swells and the snare speeds up.',
    does: 'Then it drops automatically, with the filter snapping open and an impact on the downbeat.',
    how: 'Press while playing (or press B).',
    when: 'Before a chorus or drop, especially in electronic music.',
  },
  drop: {
    title: 'Drop',
    what: 'An impact and crash on the next bar.',
    does: 'Ends a build early, or simply adds a big hit.',
    how: 'Press while playing (or press D).',
  },
  scenes: {
    title: 'Scenes',
    what: 'Snapshots of your mix: which part each track plays, plus mute and volume.',
    does: 'Launching a scene brings that whole combination back at the next boundary.',
    how: '+ Save scene captures the current mix. Click a scene to recall it.',
    when: 'Save combinations you love, then jump between them like song sections.',
  },
  history: {
    title: 'Arrangement preview',
    what: 'A record of the sections you have played in this session, in order.',
    does: 'Shows how your live performance is shaping into a song.',
    status: 'Editing this timeline arrives with Song Studio (Phase 3).',
  },
  master: {
    title: 'Master',
    what: 'The final output of the whole mix.',
    does: 'A gentle compressor glues the band together and a limiter prevents distortion.',
    how: 'Use the knob to set overall loudness. Keep the meter out of the red.',
  },
  mixer: {
    title: 'Channel mixer',
    what: 'One strip per instrument with a volume fader, level meter, mute and solo.',
    how: 'Drag faders, or scroll over them. Double-click resets.',
  },
  meter: { title: 'Level meter', what: 'Shows how loud the track is right now.', when: 'If a track barely moves, it may be too quiet; if it is always at the top, too loud.' },
  sends: {
    title: 'FX Sends',
    what: 'How much of each track goes to the shared reverb and echo.',
    when: 'Set space and echo for every instrument in one place.',
  },
  'export-json': { title: 'Export project', what: 'Downloads your project as a .json file you can back up or open on another computer.' },
  'import-json': { title: 'Import project', what: 'Opens a .json project file exported from LoopLab.' },
  share: { title: 'Share (copy project)', what: 'Copies your project data to the clipboard so you can paste it to a friend or into a file.' },
  'export-audio': { title: 'Export audio (coming soon)', what: 'Will render your song to a WAV file.', status: 'Arrives with Song Studio (Phase 3).' },
  'video-preview': { title: 'Video preview (coming soon)', what: 'Will create a shareable video of your mix.', status: 'Planned for a later phase.' },
};

export const GLOSSARY: { term: string; def: string }[] = [
  { term: 'Beat', def: 'The steady pulse you tap your foot to. Four beats make one bar in most music.' },
  { term: 'Bar (measure)', def: 'A group of beats, usually four. Parts loop in whole bars, and changes land on bar lines.' },
  { term: 'BPM', def: 'Beats per minute: the tempo. 120 BPM = two beats every second.' },
  { term: 'Tempo', def: 'The speed of the music.' },
  { term: 'Key', def: 'The home note a song feels like it returns to, plus the set of notes (scale) it uses.' },
  { term: 'Scale / mode', def: 'A family of notes. Major sounds bright, minor darker; Dorian and Mixolydian are colours in between.' },
  { term: 'Chord', def: 'Several notes played together. A chord progression is the sequence of chords under a song.' },
  { term: 'Pattern / part', def: 'A short musical phrase for one instrument that loops.' },
  { term: 'Groove', def: 'How the rhythm feels: where the accents fall and how the instruments lock together.' },
  { term: 'One drop', def: 'The classic reggae drum beat: kick and cross-stick together on beat 3 only.' },
  { term: 'Skank', def: 'The short offbeat guitar or keyboard chop at the heart of reggae and ska.' },
  { term: 'Offbeat', def: 'The "and" between beats (1 and 2 and…). Ska and reggae accent the offbeats.' },
  { term: 'Breakbeat', def: 'A drum pattern originally sampled from a funk record\'s drum break. Jungle chops and rearranges breaks.' },
  { term: 'Four-on-the-floor', def: 'A kick drum on every beat: the heartbeat of house and disco.' },
  { term: 'Swing', def: 'Delaying every other subdivision so the rhythm bounces instead of marching.' },
  { term: 'Quantize', def: 'Snapping events to a grid. In LoopLab, changes wait for the next beat or bar.' },
  { term: 'Section', def: 'A part of a song: intro, verse, chorus, breakdown, outro.' },
  { term: 'Arrangement', def: 'The order of sections that makes a complete song.' },
  { term: 'Fill', def: 'A short drum flourish that signals a change.' },
  { term: 'Build-up / drop', def: 'Rising tension (filters, risers, snare rolls) followed by the release of the full groove.' },
  { term: 'Filter', def: 'Removes some frequencies. A low-pass filter removes highs, making sounds darker.' },
  { term: 'Resonance', def: 'A boost right at a filter\'s cutoff frequency, giving a ringing or squelchy tone.' },
  { term: 'Reverb', def: 'Simulated room or hall reflections that add space.' },
  { term: 'Delay / echo', def: 'Repeats of the sound in time with the music. Central to dub.' },
  { term: 'Pan', def: 'Left–right placement of a sound between the speakers.' },
  { term: 'Mute / solo', def: 'Mute silences a track; solo silences everything else.' },
  { term: 'Sub bass', def: 'Very low bass you feel as much as hear, important in jungle and dub.' },
  { term: 'Velocity', def: 'How hard a note is played. Harder hits are louder and often brighter.' },
  { term: 'Half-time / double-time', def: 'Playing a part at half or twice the speed of the main tempo while staying in sync.' },
  { term: 'Scene', def: 'A saved snapshot of which parts are playing, so you can recall a combination.' },
];

export const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / stop'],
  ['1 – 6', 'Select a track'],
  ['← / →', 'Previous / next part on the selected track'],
  ['M / S / L', 'Mute / solo / lock the selected track'],
  ['V', 'New variation of the selected part'],
  ['F', 'Drum fill on the next bar'],
  ['B / D', 'Build-up / drop'],
  ['R', 'Remix unlocked parts'],
  ['Shift + S', 'Surprise Me'],
  ['[ / ]', 'Energy down / up'],
  ['Ctrl + Z / Ctrl + Shift + Z', 'Undo / redo'],
  ['Ctrl + S', 'Save now'],
  ['?', 'Open the Help Center'],
  ['Mouse wheel', 'Turn a knob or fader (hold Shift for fine steps)'],
  ['Double-click a knob', 'Reset it to its default'],
  ['Esc', 'Close menus, tooltips or the tour'],
];
