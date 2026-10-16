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
| UI workspace | `ui/` | TopBar, Browser, Deck (Live Mix), Inspector, BottomPanel (mixer/sections/scenes), App shell |

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
8. **Layout.** Root font size follows viewport CSS width (`clamp(12px, 0.42vw + 7px, 22px)`) ×
   user UI scale. The deck grid uses container queries: 6 columns ≥108rem (ultrawide),
   3 ≥62rem, 2 ≥36rem. ≤820px switches to the phone layout with bottom tabs.

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
- **Player feel** (`engine/feel.ts`): per-genre timing offsets + human jitter (roots reggae
  snare/hats/skank/bass lay back 5–12 ms; two-tone pushes 2–3 ms) and velocity spread.

### Adding a genre pack

1. Create `src/content/packs/<name>.ts` using the DSL in `content/dsl.ts`
   (`grid()` for drums, `n()`/`ch()` for notes, `makePatternFactory` for defaults).
2. Give every role at least one pattern, a `fills` entry, and ≥2 sections.
3. Use existing instrument preset ids or add new ones in `engine/instruments/` **and**
   `presetInfo.ts`.
4. Register it in `content/library.ts` `PACKS`. `content.test.ts` validates it automatically.
5. Write *authored* material (real grooves, idiomatic voicings), not random notes.

### Musical conventions in the starter packs

- **Roots Reggae** — 76 BPM, A Dorian, swing 0.45 shared by all parts. One drop = kick + cross-stick
  on beat 3 only. Bass leaves the downbeat empty. Skank on 2 & 4; organ bubble on "&"/"a".
- **Two-Tone Ska** — 168 BPM, G major, straight. Four-on-floor or 1&3 kick, hard backbeat,
  upstrokes and combo organ on every offbeat, walking bass, unison octave horns.

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
- **Sound quality track (in progress)** — done: sampled drums (2 kits), hand percussion,
  timbales, both basses, player feel, A/B switch. Next (after Eric's listening review):
  guitar skanks, organ bubble, brass, then mix cohesion (bus EQ/compression, shared room).
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
