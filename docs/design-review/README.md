# LoopLab Studio: premium UI redesign and First Mix tutorial

Branch: `design/premium-ui-onboarding`. This is the first complete milestone (A–D) of the UI redesign spec. No genres were added and the music engine was not rewritten.

## Screenshots

| File | What it shows |
|---|---|
| `looplab-5120x2160.png` | Ultrawide workspace (headless Edge, 5120 × 2160 CSS px) |
| `looplab-1920x1080.png` | Standard desktop |
| `looplab-1920x1080-first-visit.png` | First visit: the "New to making music?" prompt |
| `looplab-tour-welcome.jpg` | First Mix lesson, step 1 (welcome card over the live app) |
| `looplab-tour-complete.jpg` | First Mix lesson, completion card |
| `looplab-phone-live-mix.jpg` | Phone layout (375 px) with bottom tabs |

The headless screenshots use `?notour` so the first-visit prompt does not cover the layout. The "Saving…" label in them comes from headless IndexedDB being slow; in a normal browser it reads "Saved just now".

## How the layout maps to the reference image

- **Top bar:** logo with the "Mix / Match / Make Music" tagline; transport (back to start, play, stop, capture marked *soon*); BPM card; key and scale; Compatibility (Safe / Creative / Wild); Studio / Classic sound; project card with genre tags and a project menu; "Saved X ago" (click to save); undo/redo; Learn mode; Help; workspace menu.
- **Groove Library (left):** tabs (Packs, Parts, Favourites, Yours), search, a genre filter, pack rows with SVG artwork, a tagline, part count, BPM and a favourite star. Opening a row shows Load and the section chips. A "Make your first mix" call-to-action sits at the bottom.
- **Live Mix (centre):** tabs (Live Mix, Pattern, FX Sends, Arrange *soon*), a bar.beat counter with beat dots, the chord strip (current chord lit), the key, and Quantize. Each of the six lanes has:
  - a number, a coloured icon box, the name and current instrument, M/S, and a volume knob;
  - a clip card with the part name, genre chip, variation and feel badges, "N Bars", the pattern drawn as a waveform (drums) or note blocks (pitched) and a live playhead;
  - pack artwork, « (previous part), Swap, and ⋯ (more).
- **Track colours:** drums red, bass amber, guitar green, keys blue, horns purple, perc/FX cyan.
- **Sound Lab (right):**
  - Tabs: Instrument, Effects, Variation, plus Modulation marked *soon*.
  - An instrument header with pack art and a track picker.
  - Filter section: a live filter curve with Cutoff, Resonance and Drive.
  - Level and space: Volume, Pan and Density.
  - Global column: Energy dots with −/+, Swing, Fill/Build/Drop, Surprise Me, and an explanation of the compatibility mode.
- **Dock (bottom):** Master meter and knob; Channel Mixer with vertical faders, live meters, pan and M/S; Scenes & Song Sections (section pads, Fill/Build/Drop, scenes with an active indicator, and a timeline of the sections actually played); Export & Share (export/import project, copy mix recipe, export audio and video preview marked *soon*).

### Deliberate differences from the reference
- **Sound Lab tabs.** "AI Tools" became **Variation**. Every control on it is real (new variation, back to original, lock, remix, variation amount).
- **Envelope.** There are no ADSR parameters in the engine yet, so the envelope panel is a clearly labelled *Phase 3* note instead of fake knobs.
- **Global knobs.** Energy is a −/+ stepper (it swaps parts up or down a level) and Mutation is the Variation amount knob. There is no "Surprise amount" parameter, so that knob was left out instead of faked.
- **Clip waveforms** are drawn from the pattern data, not audio.
- **Arrange** is a placeholder that shows the live arrangement history. Song Studio is Phase 3.

## Controls
- **Knobs.** Every knob supports:
  - mouse wheel, with Shift for fine steps (0.5 % vs 3 %);
  - vertical drag (Shift is fine);
  - double-click to reset;
  - arrow and Page keys, Home/End, and Delete to reset;
  - `role="slider"` with a readable `aria-valuetext`, and its value is always shown.
- **Faders** support wheel, drag, keys and double-click.
- **Unavailable controls** are disabled and marked *soon* with a tooltip.

## Learning experience
- **Tooltips.** Every meaningful control has a `data-help` entry: what it is, what it does, how, and when. They appear on hover and keyboard focus, and pin on a touch long-press. **Learn mode** makes a tap explain a control instead of using it.
- **Help levels.** Beginner (default), Standard and Expert, which change the tooltip delay and detail.
- **Help Center** (`?` key or the Help button) has five sections:
  - Lessons (with completion ticks and resume);
  - a searchable reference of every control;
  - a glossary of 30 terms;
  - keyboard shortcuts;
  - help settings.
- **Tour engine.** A spotlight with dimming that never blocks clicks, so the music keeps playing and the real controls are used. The coach card:
  - stays inside the screen edges and follows the target as panels resize;
  - has a progress bar and Back / Retry / Exit / Skip step / Next;
  - moves keyboard focus to the step title, and Esc pauses.
- **Progress** is saved locally and can be resumed from the welcome prompt or the Help Center. A double-click on Next cannot skip a step.
- **First Mix (11 steps)** runs in a fresh practice project "My First Mix", so the user's saved projects are never changed. Steps: welcome, load Roots Reggae or Two-Tone Ska, press Play, meet the band, swap drums, combine two genres, turn a knob plus mute or solo, launch a section, Surprise Me or Remix, name and save, completion. The completion card offers Keep jamming, Back to my project, and More lessons.
- **Five shorter lessons:** Mixer, Rhythm & BPM, Mixing genres, Song sections, Variations.
- **Detection uses real state only:** store event counters, a diff of the project, and the live engine.
- **Visual feedback:**
  - "Next: … in N beats" on a queued swap, and a lane flash when the swap lands;
  - a striped "Muted" overlay and dimmed silent lanes;
  - queued section pads blink; the active scene glows;
  - knob values are always shown; the save icon pops on save;
  - toasts mention Undo after Surprise and Remix.

## Workspace
- Library, Sound Lab and Dock are resizable (sizes saved) and can be hidden from the ☰ menu or their own chevrons. A hidden panel leaves a rail to bring it back.
- Focus mode, an interface size slider (80–160 %), Comfortable / Compact density, and Reset layout. All of these are saved per browser and never inside a project.
- The root font size scales with viewport width, with extra lane and art sizing at 2400 px and wider. Phones (820 px and narrower) get a stacked layout with Live Mix / Library / Sound Lab / Mixer tabs.

## Engine and state changes (kept small and separate)
- `engine/live.ts`, `engine/engine.ts`: a session section history for the arrangement timeline, and `restart()`.
- `state/store.ts`: `events` counters (`bump`) for lesson detection, and `variationAmount`.
- `state/persistence.ts`: `saveManually()`, and a quiet option for `newProject`.

## Verification
- `tsc --noEmit` is clean, 93/93 Vitest tests pass, and `vite build` succeeds.
- **First Mix** was walked end to end in the browser by clicking the real controls. Every task ticked from real state: load, play, swap with queued countdown, two genres, wheel on a knob, mute (overlay shown), chorus pad queued, Surprise Me, rename plus save (toast "Saved “Sunset Skank”"), completion stored.
- **Resume** after a page reload works.
- **Spotlight targets** for all six lessons are present on screen.
- **Tooltip** on hover sets `aria-describedby`.
- **Knob** responds to keyboard, double-click reset, and fine vs coarse wheel.
- **`?`** opens the Help Center and Esc closes it.
- **Phone layout** at 375 px has no horizontal overflow.

## Known gaps / next
- Envelope and modulation editing, the Arrange timeline editor, and audio/video export are Phase 3.
- The bundle is over 500 kB (Tone.js); code-splitting could come later.
- Not yet tested on a real touch device. Long-press tooltips and Learn mode were only exercised with emulation.
