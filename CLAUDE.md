# LoopLab Studio — project guide

Browser-based music playground: Fuser-style live mixing of independent instrument parts
across genres, growing into a sound editor (Sound Lab) and arranger (Song Studio).
Product owner: Eric. Philosophy: *easy to play, deep enough to master, fun enough to get lost in.*

## Commands

```bash
npm run dev        # Vite dev server on http://localhost:5173
npm test           # Vitest unit tests (pure logic, no audio)
npm run typecheck  # TypeScript (tsc 7) strict check
npm run build      # production build to dist/
```

Windows note: Git and Node live in `C:\Program Files\Git\cmd` / the Node install; if a fresh
shell can't find them, refresh PATH from the registry first.

## Architecture (src/)

| Module | Folder | Responsibility |
|---|---|---|
| Music model | `music/types.ts` | Plain-JSON data model: Pattern, NoteEvent, DrumHit, Harmony, GenrePack |
| Theory | `music/theory.ts` | Scales/modes, degree→semitone, chord names, progression lookup |
| Pattern engine | `music/pattern.ts` | Compile patterns (swing, mono note clipping), windowed event lookup |
| Compatibility engine | `music/compat.ts` | Tempo-feel (½×/1×/2×), Safe/Creative/Wild harmony, note resolution, registers |
| Variation / generation | `music/mutate.ts`, `music/generate.ts`, `music/rng.ts` | Seeded Mutate, Surprise Me, Remix, Evolve |
| Groove library | `content/` | Authoring DSL + genre packs + registry (`library.ts`) |
| Audio engine | `engine/engine.ts` | Singleton; transport tick, quantized swaps, fills, mixer routing, meters |
| Instruments | `engine/instruments/` | Synth drum kits, bass, Karplus guitar, organs, FM keys, brass. `presetInfo.ts` is Tone-free metadata |
| Live state | `engine/live.ts` | What's actually sounding/queued (engine → UI) |
| Project engine | `project/` | Types, zod schema + migrations, factory, IndexedDB storage |
| App state | `state/store.ts` | Zustand project store = user intent, undo/redo, all musical actions |
| Persistence | `state/persistence.ts` | Autosave (700 ms debounce), new/open/duplicate/delete/import/export |
| UI workspace | `ui/` | TopBar, Library, LiveMix (lanes / Pattern / FX Sends / Arrange), SoundLab, Dock (master, mixer, sections, scenes, export), App shell. `components.tsx` = Knob / VFader / Meter / Segmented; `icons.tsx`; `art/PackArt.tsx` |
| Workspace state | `state/ui.ts` | Panels, tabs, density, scale, favourites (localStorage `looplab:ui`); never part of a project |
| Help | `help/` | `content.ts` (HELP entries keyed by `data-help` id, glossary, shortcuts), `HelpLayer` (hover / focus / long-press tooltips, Learn mode), `HelpCenter` |
| Guided tours | `tour/` | `tours.ts` (lesson scripts), `tourStore.ts` (progress, resume, practice projects, change detection), `TourOverlay` (spotlight + coach card) |

### Key design decisions

1. **Intent vs reality.** The zustand store holds what the user *wants*; the engine subscribes
   (`main.tsx`) and reconciles. Musical changes queue to the next quantize boundary
   (`project.quantize`: beat / bar / 2 bars / 4 bars) and apply inside the transport callback at
   audio time. The engine publishes what's actually playing to `liveStore`. React never touches
   Tone.js and never recreates the engine.
2. **Harmony-relative patterns.** Pitched notes store scale steps relative to the *current chord
   root* (`harmony: 'chord'`, default) or the *key tonic* (`harmony: 'key'`, melodies). One
   global progression drives everything, so a reggae bassline works over a ska progression.
   Chord events (`s: [0,2,4]`) are folded into the instrument register = automatic inversions.
3. **Tempo feel.** Every pattern keeps its native BPM. `feelFactor` picks k ∈ {0.5, 1, 2} so
   a 168 BPM ska beat dropped into a 76 BPM reggae project plays double-time (and vice versa).
   Wild mode disables this.
4. **Compatibility modes.** Safe = project key/mode/chords + strong-beat melody snapping to chord
   tones. Creative = project key/chords but the part's own mode colour, no snapping. Wild = the
   part's own key, progression and tempo.
5. **Step grid.** 1 step = a 16th at the pattern's native tempo; 16 steps = 4/4 bar; fractional
   steps allowed (triplets/flams). Swing delays odd 16ths by up to ⅓ step.
6. **Hybrid audio engine (samples + synthesis).** Drums, percussion and bass play real CC0
   recordings; guitar, organ, keys and horns are still Tone.js synths (to be upgraded next).
   The top-bar **Sound: Sampled / Synth** switch (A/B) swaps every track instantly; both
   versions are cached per track (`TrackRuntime.insts` keyed `presetId|mode`). Sampled
   instruments keep their synth twin as a fallback, used while buffers load and for voices
   with no recordings (dub siren, claps). See "Sample pipeline" below.
   Licences live in `public/samples/LICENSES.md`; only add assets whose licence is verified.
7. **Persistence.** IndexedDB via idb-keyval (`looplab` db). Projects are versioned
   (`SCHEMA_VERSION`); add a step to `MIGRATIONS` in `project/schema.ts` whenever the shape changes.
   Imports are always zod-validated. Workspace prefs (panel visibility, UI scale) are in
   localStorage; panel sizes persist via react-resizable-panels `autoSaveId`.
8. **Layout.** Root font size follows viewport CSS width (`clamp(12px, 0.4vw + 7px, 22px)`) ×
   user UI scale; everything is sized in rem. Desktop = Library | Live Mix | Sound Lab over the
   Dock (react-resizable-panels, `autoSaveId` looplab:h2 / looplab:v2); hidden panels leave a
   rail to reopen them. ≤820px switches to the phone layout with bottom tabs.
9. **Help and tours.** Any element with `data-help="<id>"` gets a tooltip from `HELP[id]`; add an
   entry whenever you add a control. Tour spotlights target `data-tour="<id>"`. Tour tasks are
   detected from real state only: `useStore().events` counters (call `bump(name)` from new
   actions a lesson should detect), a diff of the project (`seen` keys such as `volume:bass`,
   `mute`, `pattern:drums`), and `liveStore`. Every lesson runs in its own practice project.
   `?notour` suppresses the first-visit prompt (used for screenshots).

### Sample pipeline

```
scripts/samples/manifest.mjs   which files to take from each CC0 repo (regex per path)
scripts/samples/fetch.mjs      download them to .sample-cache/ (git-ignored, raw, untrusted)
scripts/samples/build.mjs      mix mics, trim+fade, 16-bit FLAC → public/samples/ + manifest.json
scripts/samples/pitch.mjs      pitch detection used to verify bass note mapping
```

- Run `npm run samples:fetch` then `npm run samples:build` (uses the `ffmpeg-static` dev dependency).
- **Drums:** each hit = the library's close + overhead mics premixed (Virtuosity: kick mic + snare
  mic + OH; Big Rusty: kick/snare top/bottom/OH). Layers are ordered by the libraries' velocity index;
  measured loudness (`mean`, `peak`) is stored per layer.
- **Bass:** Karoryfer names notes an octave above sounding pitch (verified by measurement:
  `a1` = MIDI 21, Growlybass `e2` = MIDI 28, its SFZ maps it an octave off). Tuning corrections
  are applied only ≥ MIDI 40 and only within ±25 cents (low strings fool pitch detection).
- **Runtime:** `engine/samples/loader.ts` fetches/decodes on demand (shared cache, progress in
  `liveStore`). `engine/samples/select.ts` is the pure logic: velocity → layer (with slight
  boundary wobble), round robin without immediate repeats, nearest pitch zone (ties → lower).
- `SampledKit` (`engine/instruments/sampledDrums.ts`): accents ≥0.93 on `snare` play rimshots,
  `tomM` = high tom pitched −3 st, closed/pedal hat chokes the open hat, kit voices keep the
  recording's natural balance (normalised as a group to the kick), percussion is normalised per voice.
- `SampledBass` (`engine/instruments/sampledBass.ts`): monophonic like a real player (new note
  mutes the previous with a 6 ms fade), short release at note end, staccato samples for notes
  < 0.16 s (Growlybass), per-zone level normalisation, EQ + compression chain per preset.
- **Note-name octaves differ per library** (all verified by measuring pitch): Karoryfer basses
  name an octave high (−12), Emilyguitar is scientific (0), VSCO 2 CE and VCSL name an octave
  low (+12). These offsets are hard-coded in `build.mjs`; re-measure before adding a library.
- `SampledGuitar` (`engine/instruments/sampledGuitar.ts`): chords strummed from single-note
  samples (down = low→high, up = high→low, ~5 ms/string), ring clamped to 60–200 ms (players
  can't damp faster), real string-mute release sample at chord end = the skank "chk",
  muted-strum noise for chops/ghosts. Voice cap 36.
- `SampledHorns` (`engine/instruments/sampledHorns.ts`): trumpet / tenor sax / trombone players
  with ranges, pans and small lags. Single notes doubled per preset (`melody` shifts); chords
  voiced top-to-bottom across `chordOrder`. Staccato samples below `staccatoBelow` seconds.
- The engine wraps every instrument trigger in try/catch (`reportError`, logged once per
  instrument) so one failing instrument can't abort the tick for the others. Always call
  `src.start()` before `src.stop()` on buffer sources.
- **Modelled organs** (`engine/instruments/organ.ts`, Studio mode only): no CC0 tonewheel
  recordings exist, and a tonewheel organ is itself additive, so it is modelled: nine drawbars
  in one PeriodicWave on the 16' sub-fundamental, key click, single-trigger percussion,
  two-rotor Leslie (AM + Doppler + pan), tube drive. Combo organ = reed-like divide-down
  spectrum, formant peak, fast vibrato.
- **Mix glue** (`engine/engine.ts`): drums + perc → drum bus compressor; every track sends
  a fixed amount (`ROOM_SEND`) to a short shared room reverb; per-role low-cut (`CARVE_HZ`);
  master = 24 Hz sub-cut → gentle glue compressor → limiter. Applies in both sound modes.
- The UI calls the modes **Studio** (internal `sampled`) and **Classic** (internal `synth`).
- **Player feel** (`engine/feel.ts`): per-genre timing offsets + human jitter (roots reggae
  snare/hats/skank/bass lay back 5–12 ms; two-tone pushes 2–3 ms) and velocity spread.

### Electronic engine (Stage A: Jungle, Trip-Hop, Classic House)

- **Drum machines** (`engine/instruments/electroKit.ts`, presets `dm-909`, `dm-808`, `perc-fx`):
  analog-style models built per hit from Web Audio nodes: pitch-drop sine kick + click, triangle
  + noise snare, multi-burst clap, an always-running 6-square 808 metal bank feeding hat/cymbal
  VCAs (closed hat chokes open), toms/congas/cowbell/claves, and FX voices `riser`, `downer`,
  `impact`, `revcrash`, `crackle`, `zap`, `siren`. Kit bus = drive + glue compressor.
- **Break kits** (`kit-break`, `kit-dusty`): SampledKit with `pitch` (whole-kit semitones) and a
  `chain` "break processor" (jungle: +2 st, hard fast compression, crunch; trip-hop: −1.5 st,
  6 kHz roll-off, low boost, tape drive). Breaks are programmed hit-by-hit (`tags: ['break']`),
  never loops; the ✦ variation button runs `chopBreak()` (8th-slice re-sequencing, stutters,
  32nd snare-roll splice, bar downbeats preserved).
- **Synths** (`engine/instruments/synths.ts`): sub, Reese, house pulse bass, organ bass, Moog-ish
  bass, FM house piano, stab organ, smoky organ, moody Rhodes, supersaw pad, synth strings,
  theremin, mono lead. `BassInst` now takes an effects chain. Sampled extras: `gtr-clean`
  (tremolo guitar), `horns-trumpet` (lone dark trumpet).
- **Classic-mode stand-ins**: `SYNTH_ALIAS` in `presets.ts` maps sample-only presets to synths.
- **Build/Drop** (engine): `queueBuild(bars)` starts on the next bar: master `macroHP` high-pass
  sweeps 20→900 Hz, the engine-owned FX box plays a riser of the exact build length, drums play
  `buildRollPattern()` (8ths→16ths→32nds crescendo); at the end (or `queueDrop()`) the filter
  snaps open with an impact + crash on the downbeat. UI: Build/Drop pads in the Dock, Sound Lab global buttons, B / D keys.
- **Density** (`music/density.ts`): per-track 0..1; events below an importance threshold
  (velocity + on-beat bonus) are skipped, so ghosts go first. **Resonance**: per-track filter Q.
  Both live in project schema v2 (migration 1→2 in `schema.ts`).
- Track roles double up for electronic parts: `guitar` = "Guitar / Pad", `horns` = "Horns / Lead".
- Measure levels in **Studio** mode (Sound switch); Classic uses the synth stand-ins. The sound-mode
  preference is per browser (localStorage), so check it before trusting meter readings.
- Vite watches with polling (`vite.config.ts`) because the native Windows watcher missed edits.

### Adding a genre pack

1. Create `src/content/packs/<name>.ts` using the DSL in `content/dsl.ts`
   (`grid()` for drums, `n()`/`ch()` for notes, `makePatternFactory` for defaults).
2. Give every role at least one pattern, a `fills` entry, and ≥2 sections.
3. Use existing instrument preset ids or add new ones in `engine/instruments/` **and**
   `presetInfo.ts`.
4. Register it in `content/library.ts` `PACKS`. `content.test.ts` validates it automatically.
5. Write *authored* material (real grooves, idiomatic voicings), not random notes.

### Musical conventions in the packs

Counting convention: reggae-family packs are written at the slow tempo (70–85 BPM) with the
drop on beat 3, so the skank on steps 4/12 (beats 2 & 4) *is* the offbeat. Ska packs are written
at full tempo, so their chops sit on every eighth-note "and" (2, 6, 10, 14). An external review
(ChatGPT) flagged the reggae skank as misplaced; that was this counting mix-up, not a bug.

- **Roots Reggae** — 76 BPM, A Dorian. Swing 0.45 on drums/organ/perc, 0.25 on bass/guitar
  (players' looseness comes from feel.ts). One drop = kick + cross-stick on beat 3 only.
  Verse bass is the sparse "Deep Roots Classic". "Double Skank" = rockers-style eighth offbeats.
- **Militant Steppers** — 78 BPM, D minor. Four-on-floor kick, rimshot on 3, double skank,
  double bubble, driving/roller bass.
- **Dub** — 72 BPM, E minor. Space as a sound: "Empty Drop", single echo chops and stabs,
  very long bass notes, siren throws.
- **Rocksteady** — 82 BPM, D major. Soft kick 1 & 3, cross-stick 2 & 4, melodic lead bass with
  anticipations, muted guitar picking that doubles the bass.
- **Early Ska (Kingston Shuffle)** — 132 BPM, F major. Shuffle written as exact triplets
  (`sh(b) = b*4 + 8/3`), soft four-on-floor kick, cross-stick backbeat, shuffling ride, walking
  bass with skip notes, piano/guitar on the swung "and".
- **Two-Tone Ska** — 168 BPM, G major, straight. Main beat kicks 1, &2, 3, 4 with a hard backbeat;
  four-on-floor lives in "Ska-Punk Stomp". Walking basses use approach notes (`ap()`).
- `ap(t, s, d, v, o, c)` in the DSL marks an approach note (`nx: true`): it resolves against the
  NEXT bar's chord (e.g. `ap(12, 0, 3.4, 0.75, 0, -1)` = semitone below the coming root).

## Testing

- `npm test` covers theory, timing windows, swing, tempo feel, note resolution and snapping,
  mutation determinism/anchors, content integrity, project schema round-trips, store actions
  (sections, locks, scenes, undo, variations), Surprise Me reproducibility.
- Browser checks are done manually / with the built-in browser: in dev, `window.__looplab`
  (engine) and `window.__store` (zustand) are exposed for inspection; engine meters
  (`trackLevel`, `masterLevel`) are used to verify signal and balance without listening.
- Vite 8's TS transform can drop an import whose value is only used inside a type assertion
  (`X as T`); keep such values used outside casts (see `DRUM_VOICES` in `schema.ts`).
- Playwright is planned but not installed yet (large browser download). Add `@playwright/test`
  when we start Phase 2 browser tests.
- Claude cannot hear audio: musical quality must be judged by Eric.

## Roadmap

- **Phase 1 (current): Playable Mix Engine** — done: two packs, live deck, quantized swaps,
  tempo feel, sections, fills, variations, Surprise/Remix/Evolve, locks, scenes, mixer + FX,
  autosave/projects/import/export, undo/redo, resizable panels, phone layout.
  Not yet: part preview/audition, capture, workspace layout presets.
- **Sound quality track** — done: sampled drums (2 kits), hand percussion, timbales, both
  basses, sampled guitar (skank/muted/ska), sampled horn section, modelled tonewheel + combo
  organs, player feel, mix glue, Studio/Classic A/B. Still synthesised: Bright Keys (FM piano),
  Tine EP, dub siren, claps. Next: Eric's listening review, then piano/EP samples
  (e.g. Salamander/VSCO upright, jRhodes — check licences) and per-instrument polish.
- **Electronic collection** — Stage A done (Old-School Jungle 165, Trip-Hop 88, Classic House 124),
  awaiting Eric's audition. Stage B next: Acid House (expressive 303-style bass with filter/accent/
  slide), Old-School Rave, Breakbeat Hardcore, Happy Hardcore, Hardcore Techno/Gabber.
- **Phase 2: Groove library & playground** — rock, funk, punk, hip-hop, pop, electronic,
  synthwave, jazz packs; One Drop / Rockers / Steppers / Dub / Dancehall sub-packs; trad ska,
  ska-punk, rocksteady; mood/energy filters for Surprise Me; key/chord compatibility scoring;
  audition; capture of live sessions; Playwright tests.
- **Phase 3: Song Studio** — multitrack timeline from captured performances, clip editing,
  Sound Lab (step sequencer, piano roll, synth controls), offline render → WAV export.
- **Phase 4** — sampled instruments (with licence tracking), automation, MIDI in/out,
  dockable panels and layout presets (Live Mix / Producer / Composer / Sound Designer).

## Working agreements

- Commit working milestones with Git. Ask before destructive operations, publishing, or paid services.
- Don't fake functionality: every visible control must work or not be shown.
- Keep audio scheduling out of React render paths.
