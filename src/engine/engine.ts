/**
 * LoopLab audio engine. A single instance lives for the whole session and is
 * never recreated by React. The UI changes the project store; the engine
 * subscribes and reconciles: mixer changes apply instantly, musical changes
 * (pattern swaps, sections, progressions) are queued to the next quantize
 * boundary and applied sample-accurately inside the transport callback.
 */
import * as Tone from 'tone';
import { getBuiltinPattern, getPack } from '@/content/library';
import { effectiveHarmony, feelFactor, resolveNote, type CompatMode } from '@/music/compat';
import { compilePattern, eventsInWindow, type CompiledPattern } from '@/music/pattern';
import { chordAt, nextBarChord } from '@/music/theory';
import type { Harmony, Pattern, Role } from '@/music/types';
import { STEPS_PER_BAR } from '@/music/types';
import type { Project, Quantize, TrackState } from '@/project/types';
import { QUANTIZE_STEPS } from '@/project/types';
import { createInstrument } from './instruments/presets';
import type { Instrument } from './instruments/types';
import { liveStore, type LiveTrack, type SoundMode } from './live';
import { timingOffset, velocityFor } from './feel';

interface ActivePart {
  pattern: Pattern;
  cp: CompiledPattern;
  start: number;
  k: number;
}

interface FillPart extends ActivePart {
  end: number;
  crash: boolean;
}

const CARVE_HZ: Record<Role, number> = { drums: 28, bass: 30, guitar: 190, keys: 120, horns: 150, perc: 130 };
const ROOM_SEND: Record<Role, number> = { drums: 0.22, bass: 0.04, guitar: 0.16, keys: 0.14, horns: 0.2, perc: 0.24 };
const BUS_ROLES: Role[] = ['drums', 'perc'];

const faderToDb = (v: number) => (v <= 0.001 ? -Infinity : 20 * Math.log10(v / 0.8));
const filterHz = (x: number) => 80 * Math.pow(2, x * 8);

class TrackRuntime {
  readonly input = new Tone.Gain(1);
  /** Fixed low-cut per role so parts don't mask the kick and bass (mix "carving"). */
  readonly carve = new Tone.Filter({ type: 'highpass', frequency: 20, Q: 0.6 });
  readonly filter = new Tone.Filter({ frequency: 20000, type: 'lowpass', rolloff: -12, Q: 0.7 });
  readonly drive = new Tone.Distortion({ distortion: 0.5, wet: 0 });
  readonly channel = new Tone.Channel({ volume: 0, pan: 0 });
  readonly revSend = new Tone.Gain(0);
  readonly dlySend = new Tone.Gain(0);
  /** Every track feeds a little of the shared room, so the band sits in one space. */
  readonly roomSend = new Tone.Gain(0);
  readonly meter = new Tone.Meter({ smoothing: 0.75 });
  /** Instruments cached by `${presetId}|${soundMode}` so A/B switching is instant. */
  private insts = new Map<string, Instrument>();
  inst: Instrument | null = null;
  instId: string | null = null;
  private instKey: string | null = null;
  active: ActivePart | null = null;
  pending: { patternId: string | null } | null = null;
  fill: FillPart | null = null;
  state: TrackState;
  mode: SoundMode;

  constructor(
    state: TrackState,
    mode: SoundMode,
    master: Tone.ToneAudioNode,
    rev: Tone.ToneAudioNode,
    dly: Tone.ToneAudioNode,
    room: Tone.ToneAudioNode,
  ) {
    this.state = state;
    this.mode = mode;
    this.carve.frequency.value = CARVE_HZ[state.role];
    this.roomSend.gain.value = ROOM_SEND[state.role];
    this.input.chain(this.carve, this.filter, this.drive, this.channel, master);
    this.channel.connect(this.revSend);
    this.channel.connect(this.dlySend);
    this.channel.connect(this.roomSend);
    this.channel.connect(this.meter);
    this.revSend.connect(rev);
    this.dlySend.connect(dly);
    this.roomSend.connect(room);
  }

  get instKeyForLog() {
    return this.instKey ?? this.state.id;
  }

  private key(id: string, mode = this.mode) {
    return `${id}|${mode}`;
  }

  /** Build (but don't activate) an instrument ahead of a queued swap. */
  preload(id: string) {
    const key = this.key(id);
    if (this.insts.has(key)) return;
    const created = createInstrument(id, this.mode);
    if (!created) return;
    created.output.connect(this.input);
    this.insts.set(key, created);
    this.trim(new Set([key, this.instKey ?? '']));
  }

  /** `time` must be the transport callback time when called from the scheduler. */
  useInstrument(id: string, time?: number) {
    const key = this.key(id);
    if (this.instKey === key && this.inst) return;
    this.preload(id);
    const inst = this.insts.get(key);
    if (!inst) return;
    if (this.inst && this.inst !== inst) this.inst.releaseAll(time ?? Tone.now());
    this.inst = inst;
    this.instId = id;
    this.instKey = key;
    this.trim(new Set([key]));
  }

  /** Switch between sampled and synth versions of the current instrument. */
  setMode(mode: SoundMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (this.instId) {
      const other = this.key(this.instId, mode === 'sampled' ? 'synth' : 'sampled');
      this.useInstrument(this.instId);
      this.trim(new Set([this.instKey ?? '', other]));
    }
  }

  /** Keep the per-track instrument cache small. */
  private trim(keep: Set<string>) {
    const MAX = 4;
    for (const [key, i] of this.insts) {
      if (this.insts.size <= MAX) break;
      if (keep.has(key)) continue;
      this.insts.delete(key);
      setTimeout(() => i.dispose(), 3000);
    }
  }

  applyMix(s: TrackState) {
    const r = 0.04;
    this.channel.volume.rampTo(faderToDb(s.volume), r);
    this.channel.pan.rampTo(s.pan, r);
    this.channel.mute = s.mute;
    this.channel.solo = s.solo;
    this.filter.frequency.rampTo(filterHz(s.fx.filter), r);
    this.drive.wet.rampTo(s.fx.drive * 0.8, r);
    this.revSend.gain.rampTo(s.fx.reverb, r);
    this.dlySend.gain.rampTo(s.fx.delay, r);
  }

  releaseAll() {
    for (const i of this.insts.values()) i.releaseAll(Tone.now());
  }

  dispose() {
    for (const i of this.insts.values()) i.dispose();
    for (const n of [this.input, this.carve, this.filter, this.drive, this.channel, this.revSend, this.dlySend, this.roomSend, this.meter]) n.dispose();
  }
}

export class AudioEngine {
  private initialised = false;
  private initPromise: Promise<void> | null = null;
  private tracks = new Map<string, TrackRuntime>();
  private project: Project | null = null;
  private step = 0;
  private playing = false;

  private harmony: Harmony | null = null;
  private harmonyStamp = -1;
  private progStart = 0;
  private pendingHarmony: { harmony: Harmony; stamp: number } | null = null;
  private fillQueued = false;
  private compiled = new Map<string, CompiledPattern>();
  private compiledSwing = 0;

  // master graph
  private masterIn!: Tone.Gain;
  private masterVol!: Tone.Volume;
  private masterMeter!: Tone.Meter;
  private analyser!: Tone.Analyser;
  private reverbIn!: Tone.Gain;
  private delayIn!: Tone.Gain;
  private delay!: Tone.FeedbackDelay;
  private drumBus!: Tone.Gain;
  private roomIn!: Tone.Gain;

  get isReady() {
    return this.initialised;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  async init(): Promise<void> {
    if (this.initialised) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      await Tone.start();
      const ctx = Tone.getContext();
      ctx.lookAhead = 0.08;

      // Master: sub-sonic clean-up, gentle "glue" compression, safety limiter.
      this.masterIn = new Tone.Gain(0.9);
      const subCut = new Tone.Filter({ type: 'highpass', frequency: 24, Q: 0.6 });
      const comp = new Tone.Compressor({ threshold: -18, ratio: 2, attack: 0.025, release: 0.22, knee: 10 });
      const limiter = new Tone.Limiter(-1);
      this.masterVol = new Tone.Volume(0);
      this.masterMeter = new Tone.Meter({ smoothing: 0.8 });
      this.analyser = new Tone.Analyser('fft', 64);
      this.masterIn.chain(subCut, comp, limiter, this.masterVol, Tone.getDestination());
      this.masterVol.connect(this.masterMeter);
      this.masterVol.connect(this.analyser);

      // Drum bus: kit and percussion compressed together like one recorded kit.
      this.drumBus = new Tone.Gain(1);
      const drumComp = new Tone.Compressor({ threshold: -16, ratio: 2.2, attack: 0.012, release: 0.12, knee: 6 });
      const drumMakeup = new Tone.Gain(Tone.dbToGain(1.5));
      this.drumBus.chain(drumComp, drumMakeup, this.masterIn);

      // Shared room: a short, darkish ambience every instrument feeds a little of.
      this.roomIn = new Tone.Gain(1);
      const room = new Tone.Reverb({ decay: 0.75, preDelay: 0.006, wet: 1 });
      await room.ready;
      const roomHp = new Tone.Filter(240, 'highpass');
      const roomLp = new Tone.Filter(6500, 'lowpass');
      this.roomIn.chain(roomHp, room, roomLp, this.masterIn);

      this.reverbIn = new Tone.Gain(1);
      const reverb = new Tone.Reverb({ decay: 2.6, preDelay: 0.025, wet: 1 });
      await reverb.ready;
      const revHp = new Tone.Filter(220, 'highpass');
      this.reverbIn.chain(revHp, reverb, this.masterIn);

      this.delayIn = new Tone.Gain(1);
      this.delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.42, wet: 1 });
      const dHp = new Tone.Filter(260, 'highpass');
      const dLp = new Tone.Filter(3600, 'lowpass');
      this.delayIn.chain(this.delay, dHp, dLp, this.masterIn);

      const transport = Tone.getTransport();
      transport.scheduleRepeat((time) => this.tick(time), '16n', 0);

      this.initialised = true;
      liveStore.setState({ ready: true, error: null });
      if (this.project) this.sync(this.project);
    })().catch((err) => {
      console.error(err);
      liveStore.setState({ error: String(err) });
      this.initPromise = null;
      throw err;
    });
    return this.initPromise;
  }

  // ───────────────────────── reconciliation ─────────────────────────

  private lookup(id: string): Pattern | undefined {
    return getBuiltinPattern(id) ?? this.project?.userPatterns.find((p) => p.id === id);
  }

  private compile(p: Pattern): CompiledPattern {
    const swing = this.project?.swing ?? 0;
    if (swing !== this.compiledSwing) {
      this.compiled.clear();
      this.compiledSwing = swing;
    }
    let cp = this.compiled.get(p.id);
    if (!cp) {
      cp = compilePattern(p, swing);
      this.compiled.set(p.id, cp);
    }
    return cp;
  }

  sync(project: Project) {
    const prev = this.project;
    this.project = project;
    if (!this.initialised) return;

    const transport = Tone.getTransport();
    if (!prev || prev.bpm !== project.bpm || !this.playing) {
      transport.bpm.value = project.bpm;
      this.delay.delayTime.rampTo(Tone.Time('8n.').toSeconds(), 0.1);
    }
    this.masterVol.volume.rampTo(faderToDb(project.masterVolume), 0.05);

    if (prev && prev.swing !== project.swing) {
      this.compiled.clear();
      for (const rt of this.tracks.values()) if (rt.active) rt.active.cp = this.compile(rt.active.pattern);
    }

    // Tracks
    const seen = new Set<string>();
    for (const ts of project.tracks) {
      seen.add(ts.id);
      let rt = this.tracks.get(ts.id);
      if (!rt) {
        const dest = BUS_ROLES.includes(ts.role) ? this.drumBus : this.masterIn;
        rt = new TrackRuntime(ts, liveStore.getState().soundMode, dest, this.reverbIn, this.delayIn, this.roomIn);
        this.tracks.set(ts.id, rt);
      }
      rt.state = ts;
      rt.applyMix(ts);

      const current = rt.pending ? rt.pending.patternId : (rt.active?.pattern.id ?? null);
      if (ts.patternId !== current) {
        rt.pending = { patternId: ts.patternId };
        const p = ts.patternId ? this.lookup(ts.patternId) : undefined;
        if (p) rt.preload(ts.instrument ?? p.instrument);
      }
      // Instrument override changes are immediate (sound replacement).
      if (rt.active) {
        const want = ts.instrument ?? rt.active.pattern.instrument;
        if (want !== rt.instId) rt.useInstrument(want);
      }
      if (!this.playing && rt.pending) this.applyPending(rt, this.step);
    }
    for (const [id, rt] of this.tracks) {
      if (!seen.has(id)) {
        rt.releaseAll();
        setTimeout(() => rt.dispose(), 2000);
        this.tracks.delete(id);
      }
    }

    // Harmony
    if (project.harmony !== this.harmony || project.harmonyStamp !== this.harmonyStamp) {
      if (!this.harmony || !this.playing) {
        this.harmony = project.harmony;
        this.harmonyStamp = project.harmonyStamp;
        this.progStart = this.playing ? this.step : 0;
        this.pendingHarmony = null;
      } else if (
        this.pendingHarmony?.harmony !== project.harmony ||
        this.pendingHarmony?.stamp !== project.harmonyStamp
      ) {
        this.pendingHarmony = { harmony: project.harmony, stamp: project.harmonyStamp };
      }
    }
    this.publish();
  }

  private applyPending(rt: TrackRuntime, g: number, time?: number) {
    if (!rt.pending) return;
    const id = rt.pending.patternId;
    rt.pending = null;
    const p = id ? this.lookup(id) : undefined;
    if (!p) {
      rt.active = null;
      return;
    }
    rt.useInstrument(rt.state.instrument ?? p.instrument, time);
    rt.active = {
      pattern: p,
      cp: this.compile(p),
      start: g,
      k: feelFactor(this.project?.bpm ?? p.bpm, p.bpm, this.compat()),
    };
  }

  private compat(): CompatMode {
    return this.project?.compat ?? 'safe';
  }

  private quantize(): Quantize {
    return this.project?.quantize ?? 'bar';
  }

  // ───────────────────────── transport ─────────────────────────

  async play() {
    await this.init();
    if (this.playing) return;
    if (this.project) this.sync(this.project);
    this.step = 0;
    this.progStart = 0;
    if (this.pendingHarmony) {
      this.harmony = this.pendingHarmony.harmony;
      this.harmonyStamp = this.pendingHarmony.stamp;
      this.pendingHarmony = null;
    }
    for (const rt of this.tracks.values()) {
      this.applyPending(rt, 0);
      if (rt.active) rt.active.start = 0;
      rt.fill = null;
    }
    this.playing = true;
    const transport = Tone.getTransport();
    transport.position = 0;
    transport.start('+0.06');
    liveStore.setState({ playing: true, step: 0 });
    this.publish();
  }

  stop() {
    if (!this.initialised) return;
    const transport = Tone.getTransport();
    transport.stop();
    this.playing = false;
    this.fillQueued = false;
    for (const rt of this.tracks.values()) {
      rt.releaseAll();
      rt.fill = null;
      this.applyPending(rt, 0);
    }
    if (this.pendingHarmony) {
      this.harmony = this.pendingHarmony.harmony;
      this.harmonyStamp = this.pendingHarmony.stamp;
      this.pendingHarmony = null;
    }
    this.step = 0;
    liveStore.setState({ playing: false, step: 0, fillQueued: false });
    this.publish();
  }

  async toggle() {
    if (this.playing) this.stop();
    else await this.play();
  }

  get isPlaying() {
    return this.playing;
  }

  /** A/B: switch every track between recorded and synthesised instruments. */
  setSoundMode(mode: SoundMode) {
    liveStore.setState({ soundMode: mode });
    try {
      localStorage.setItem('looplab:sound-mode', JSON.stringify(mode));
    } catch {
      /* preference just won't persist */
    }
    for (const rt of this.tracks.values()) rt.setMode(mode);
  }

  queueFill() {
    if (!this.playing) return;
    this.fillQueued = true;
    liveStore.setState({ fillQueued: true });
  }

  /** Called on the audio thread's schedule, ~lookAhead seconds early. */
  private tick(time: number) {
    if (!this.playing || !this.project) return;
    const g = this.step++;
    const bpm = Tone.getTransport().bpm.value;
    const stepSec = 60 / bpm / 4;
    const q = QUANTIZE_STEPS[this.quantize()];
    let changed = false;

    if (g % q === 0) {
      if (this.pendingHarmony) {
        this.harmony = this.pendingHarmony.harmony;
        this.harmonyStamp = this.pendingHarmony.stamp;
        this.pendingHarmony = null;
        this.progStart = g;
        changed = true;
      }
      for (const rt of this.tracks.values()) {
        if (rt.pending) {
          this.applyPending(rt, g, time);
          changed = true;
        }
      }
    }

    if (g % STEPS_PER_BAR === 0) {
      // Re-evaluate tempo feel (tempo or compat mode may have moved).
      for (const rt of this.tracks.values()) {
        if (rt.active) {
          const k = feelFactor(bpm, rt.active.pattern.bpm, this.compat());
          if (k !== rt.active.k) {
            rt.active.k = k;
            rt.active.start = g;
            changed = true;
          }
        }
        if (rt.fill && g >= rt.fill.end) {
          if (rt.fill.crash) rt.inst?.hit?.('crash', 0.75, time);
          rt.fill = null;
          changed = true;
        }
      }
      if (this.fillQueued) {
        this.fillQueued = false;
        this.startFill(g, bpm);
        changed = true;
      }
    }

    const harmony = this.harmony ?? this.project.harmony;
    for (const rt of this.tracks.values()) {
      const part = rt.fill ?? rt.active;
      if (!part || !rt.inst) continue;
      const { cp, k, start, pattern } = part;
      const local = (g - start) / k;
      const evs = eventsInWindow(cp, local, 1 / k);
      if (evs.length === 0) continue;
      const pack = getPack(pattern.packId);
      const th = effectiveHarmony(this.compat(), harmony, pack?.harmony);
      for (const { ev, rel } of evs) {
        // Each genre's players sit differently against the beat (see feel.ts).
        const offset = timingOffset(pattern.packId, pattern.role, ev.hit?.voice);
        const when = Math.max(time - 0.02, time + rel * k * stepSec + offset);
        const vel = velocityFor(pattern.packId, ev.hit?.v ?? ev.note?.v ?? 0.8);
        // Isolate each instrument: one failing voice must never silence the rest of the band.
        try {
          if (ev.hit) {
            rt.inst.hit?.(ev.hit.voice, vel, when);
          } else if (ev.note && rt.inst.notes) {
            const gPos = g + rel * k;
            const chord = chordAt(th.progression, gPos - this.progStart);
            const nextChord = ev.note.nx ? nextBarChord(th.progression, gPos - this.progStart) : undefined;
            const midis = resolveNote(ev.note, {
              harmony: th,
              chord,
              nextChord,
              role: pattern.role,
              ref: pattern.harmony ?? 'chord',
              voicing: pattern.voicing ?? 'close',
            });
            const lenSteps = rt.inst.mono ? (ev.monoDur ?? ev.note.d) : ev.note.d;
            rt.inst.notes(midis, lenSteps * k * stepSec, vel, when);
          }
        } catch (err) {
          this.reportError(rt.instKeyForLog, err);
        }
      }
    }

    Tone.getDraw().schedule(() => {
      liveStore.setState({ step: g, progStart: this.progStart });
      if (changed) this.publish();
    }, time);
  }

  private errorCounts = new Map<string, number>();

  /** Log instrument failures once (not every 16th note) so the console stays readable. */
  private reportError(key: string, err: unknown) {
    const n = (this.errorCounts.get(key) ?? 0) + 1;
    this.errorCounts.set(key, n);
    if (n === 1) console.error(`[engine] instrument ${key} failed; other tracks keep playing`, err);
  }

  private startFill(g: number, bpm: number) {
    const drums = [...this.tracks.values()].find((rt) => rt.state.role === 'drums');
    if (!drums || !drums.active) return;
    const pack = getPack(drums.active.pattern.packId);
    const fills = pack?.fills.length ? pack.fills : ['rr-drums-fill'];
    const fillId = fills[Math.floor(Math.random() * fills.length)];
    const p = this.lookup(fillId);
    if (!p) return;
    const k = feelFactor(bpm, p.bpm, this.compat());
    const cp = this.compile(p);
    drums.fill = { pattern: p, cp, start: g, k, end: g + cp.len * k, crash: p.tags.includes('crash-after') };
  }

  private publish() {
    const tracks: Record<string, LiveTrack> = {};
    for (const [id, rt] of this.tracks) {
      tracks[id] = {
        activeId: rt.active?.pattern.id ?? null,
        pendingId: rt.pending ? rt.pending.patternId : undefined,
        k: rt.active?.k ?? 1,
        start: rt.active?.start ?? 0,
        filling: !!rt.fill,
      };
    }
    liveStore.setState({
      tracks,
      harmonyPending: !!this.pendingHarmony,
      fillQueued: this.fillQueued,
    });
  }

  // ───────────────────────── metering ─────────────────────────

  trackLevel(id: string): number {
    const rt = this.tracks.get(id);
    if (!rt) return -Infinity;
    const v = rt.meter.getValue();
    return typeof v === 'number' ? v : Math.max(...v);
  }

  masterLevel(): number {
    if (!this.initialised) return -Infinity;
    const v = this.masterMeter.getValue();
    return typeof v === 'number' ? v : Math.max(...v);
  }

  spectrum(): Float32Array | null {
    if (!this.initialised) return null;
    return this.analyser.getValue() as Float32Array;
  }
}

export const engine = new AudioEngine();

if (import.meta.env.DEV) {
  (window as unknown as { __looplab: AudioEngine; __Tone: typeof Tone }).__looplab = engine;
  (window as unknown as { __Tone: typeof Tone }).__Tone = Tone;
}
