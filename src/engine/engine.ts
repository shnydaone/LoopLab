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
import { chordAt } from '@/music/theory';
import type { Harmony, Pattern } from '@/music/types';
import { STEPS_PER_BAR } from '@/music/types';
import type { Project, Quantize, TrackState } from '@/project/types';
import { QUANTIZE_STEPS } from '@/project/types';
import { createInstrument } from './instruments/presets';
import type { Instrument } from './instruments/types';
import { liveStore, type LiveTrack } from './live';

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

const faderToDb = (v: number) => (v <= 0.001 ? -Infinity : 20 * Math.log10(v / 0.8));
const filterHz = (x: number) => 80 * Math.pow(2, x * 8);

class TrackRuntime {
  readonly input = new Tone.Gain(1);
  readonly filter = new Tone.Filter({ frequency: 20000, type: 'lowpass', rolloff: -12, Q: 0.7 });
  readonly drive = new Tone.Distortion({ distortion: 0.5, wet: 0 });
  readonly channel = new Tone.Channel({ volume: 0, pan: 0 });
  readonly revSend = new Tone.Gain(0);
  readonly dlySend = new Tone.Gain(0);
  readonly meter = new Tone.Meter({ smoothing: 0.75 });
  private insts = new Map<string, Instrument>();
  inst: Instrument | null = null;
  instId: string | null = null;
  active: ActivePart | null = null;
  pending: { patternId: string | null } | null = null;
  fill: FillPart | null = null;
  state: TrackState;

  constructor(state: TrackState, master: Tone.ToneAudioNode, rev: Tone.ToneAudioNode, dly: Tone.ToneAudioNode) {
    this.state = state;
    this.input.chain(this.filter, this.drive, this.channel, master);
    this.channel.connect(this.revSend);
    this.channel.connect(this.dlySend);
    this.channel.connect(this.meter);
    this.revSend.connect(rev);
    this.dlySend.connect(dly);
  }

  /** Build (but don't activate) an instrument ahead of a queued swap. */
  preload(id: string) {
    if (this.insts.has(id)) return;
    const created = createInstrument(id);
    if (!created) return;
    created.output.connect(this.input);
    this.insts.set(id, created);
    this.trim(new Set([id, this.instId ?? '']));
  }

  useInstrument(id: string) {
    if (this.instId === id && this.inst) return;
    this.preload(id);
    const inst = this.insts.get(id);
    if (!inst) return;
    if (this.inst && this.inst !== inst) this.inst.releaseAll(Tone.now());
    this.inst = inst;
    this.instId = id;
    this.trim(new Set([id]));
  }

  /** Keep the per-track instrument cache small. */
  private trim(keep: Set<string>) {
    const MAX = 3;
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
    for (const n of [this.input, this.filter, this.drive, this.channel, this.revSend, this.dlySend, this.meter]) n.dispose();
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

      this.masterIn = new Tone.Gain(0.9);
      const comp = new Tone.Compressor({ threshold: -16, ratio: 2.5, attack: 0.012, release: 0.2 });
      const limiter = new Tone.Limiter(-1);
      this.masterVol = new Tone.Volume(0);
      this.masterMeter = new Tone.Meter({ smoothing: 0.8 });
      this.analyser = new Tone.Analyser('fft', 64);
      this.masterIn.chain(comp, limiter, this.masterVol, Tone.getDestination());
      this.masterVol.connect(this.masterMeter);
      this.masterVol.connect(this.analyser);

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
        rt = new TrackRuntime(ts, this.masterIn, this.reverbIn, this.delayIn);
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

  private applyPending(rt: TrackRuntime, g: number) {
    if (!rt.pending) return;
    const id = rt.pending.patternId;
    rt.pending = null;
    const p = id ? this.lookup(id) : undefined;
    if (!p) {
      rt.active = null;
      return;
    }
    rt.useInstrument(rt.state.instrument ?? p.instrument);
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
          this.applyPending(rt, g);
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
        const when = time + rel * k * stepSec + Math.random() * 0.003;
        const vel = Math.max(0.02, Math.min(1, (ev.hit?.v ?? ev.note?.v ?? 0.8) * (0.96 + Math.random() * 0.08)));
        if (ev.hit) {
          rt.inst.hit?.(ev.hit.voice, vel, when);
        } else if (ev.note && rt.inst.notes) {
          const gPos = g + rel * k;
          const chord = chordAt(th.progression, gPos - this.progStart);
          const midis = resolveNote(ev.note, {
            harmony: th,
            chord,
            role: pattern.role,
            ref: pattern.harmony ?? 'chord',
            voicing: pattern.voicing ?? 'close',
          });
          const lenSteps = rt.inst.mono ? (ev.monoDur ?? ev.note.d) : ev.note.d;
          rt.inst.notes(midis, lenSteps * k * stepSec, vel, when);
        }
      }
    }

    Tone.getDraw().schedule(() => {
      liveStore.setState({ step: g, progStart: this.progStart });
      if (changed) this.publish();
    }, time);
  }

  private startFill(g: number, bpm: number) {
    const drums = [...this.tracks.values()].find((rt) => rt.state.role === 'drums');
    if (!drums || !drums.active) return;
    const pack = getPack(drums.active.pattern.packId);
    const fillId = pack?.fills[0] ?? 'rr-drums-fill';
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
  (window as unknown as { __looplab: AudioEngine }).__looplab = engine;
}
