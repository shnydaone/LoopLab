/**
 * Build LoopLab's bundled sample set from the raw CC0 downloads.
 *
 *   node scripts/samples/build.mjs
 *
 * For every drum hit it blends the library's microphones (close + overhead)
 * into one stereo file, trims the tail with a fade, and encodes 16-bit FLAC.
 * Bass notes are converted to mono FLAC. Each file's loudness is measured so
 * the app can map playing strength to velocity layers. Output:
 *   public/samples/<instrument>/<voice>/<file>.flac
 *   public/samples/manifest.json
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';
import { decodeMono, detectPitch } from './pitch.mjs';
import { SOURCES } from './manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE = join(ROOT, '.sample-cache');
const OUT = join(ROOT, 'public', 'samples');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

function run(args) {
  return new Promise((res, rej) => {
    const p = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? res(err) : rej(new Error(err.slice(-800)))));
  });
}

async function measure(file) {
  const log = await run(['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const mean = Number(/mean_volume: (-?[\d.]+) dB/.exec(log)?.[1] ?? -90);
  const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(log)?.[1] ?? -90);
  return { mean, peak };
}

/** Mix several mic files (gains) into one stereo FLAC, trimmed with a fade. */
async function mixTo(out, inputs, { dur, fade, mono = false, hp = 0 }) {
  await mkdir(dirname(out), { recursive: true });
  const args = ['-hide_banner', '-y'];
  for (const i of inputs) args.push('-i', i.file);
  const chans = mono ? 'mono' : 'stereo';
  const parts = inputs.map((i, k) => `[${k}:a]aformat=sample_rates=44100:channel_layouts=${chans},volume=${i.gain}[m${k}]`);
  const mixIn = inputs.map((_, k) => `[m${k}]`).join('');
  const post = [
    inputs.length > 1 ? `${mixIn}amix=inputs=${inputs.length}:normalize=0:duration=longest` : `${mixIn}anull`,
    hp ? `highpass=f=${hp}` : null,
    `atrim=0:${dur}`,
    `afade=t=out:st=${Math.max(0, dur - fade)}:d=${fade}`,
  ]
    .filter(Boolean)
    .join(',');
  args.push('-filter_complex', `${parts.join(';')};${post}[out]`, '-map', '[out]', '-sample_fmt', 's16', '-c:a', 'flac', '-compression_level', '8', out);
  await run(args);
}

async function pool(items, n, fn) {
  const q = [...items];
  let done = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (q.length) {
        const it = q.shift();
        await fn(it);
        done++;
        if (done % 100 === 0) console.log(`  ${done}/${items.length}`);
      }
    }),
  );
}

// ─────────────────────────── drum specs ───────────────────────────

const VD_MICS = {
  kick: { kickmic: 1, oh: 0.5, snaremic: 0.22 },
  snare: { snaremic: 1, oh: 0.55, kickmic: 0.18 },
  hh: { oh: 0.95, snaremic: 0.4 },
  cym: { oh: 1, snaremic: 0.22 },
  tom: { oh: 0.8, snaremic: 0.35, kickmic: 0.25 },
};

/** Virtuosity kit voices: [voice, piece folder, articulation, mic set, dur, fade, rr?] */
const VD_KIT = [
  ['kick', 'kick', 'kick_snoff', 'kick', 0.9, 0.35],
  ['snare', 'snare', 'snare_center', 'snare', 0.8, 0.35],
  ['rimshot', 'snare', 'snare_rimshot', 'snare', 0.9, 0.4],
  ['rim', 'snare', 'snare_crossstick', 'snare', 0.45, 0.2],
  ['hatC', 'hh', 'hh_closed', 'hh', 0.45, 0.2],
  ['hatO', 'hh', 'hh_open', 'hh', 1.4, 0.5],
  ['hatP', 'hh', 'hh_pedal', 'hh', 0.5, 0.2],
  ['ride', 'ride', 'ride_ride', 'cym', 2.4, 1.0],
  ['crash', 'crash', 'crash_crash', 'cym', 3.0, 1.4],
  ['tomH', 'htom', 'htom_center', 'tom', 1.3, 0.5],
  ['tomL', 'ltom', 'ltom_center', 'tom', 1.5, 0.6],
];

const BR_KIT = [
  ['kick', 'kick_24/kick', 'k', { kick: 1, oh: 0.5, sn: 0.22 }, 0.9, 0.35],
  ['snare', 'snare_14/center', 'sn_center', { top: 1, btm: 0.35, oh: 0.5 }, 0.9, 0.4],
  ['rimshot', 'snare_14/rimshot', 'sn_rims', { top: 1, btm: 0.3, oh: 0.5 }, 1.0, 0.45],
  ['rim', 'snare_14/sidestick', 'sn_ss', { top: 1, btm: 0.2, oh: 0.45 }, 0.45, 0.2],
  ['hatC', 'hihat_14/tc', 'ht_tc', { cl: 1, oh: 0.6 }, 0.45, 0.2],
  ['hatO', 'hihat_14/open', 'ht_open', { cl: 1, oh: 0.6 }, 1.3, 0.5],
  ['hatP', 'hihat_14/chik', 'ht_chik', { cl: 1, oh: 0.6 }, 0.5, 0.2],
  ['ride', 'ride_22/rd', 'rd', { cl: 0.6, oh: 1 }, 2.4, 1.0],
  ['crash', 'crash_17/cr', 'cr', { cl: 0.6, oh: 1 }, 3.0, 1.4],
  ['tomH', 'tom_14/center', 't14', { cl: 1, oh: 0.6 }, 1.2, 0.5],
  ['tomL', 'tom_18/center', 't18', { cl: 1, oh: 0.6 }, 1.5, 0.6],
];

/** Hand percussion from Virtuosity's close mic: [voice, filename regex, layer key fn, dur, fade]. */
const PERC = [
  ['handLo', /Tumba_24_HitN_(\d+)_\d+_rr(\d)_Close\.wav$/, 0.9, 0.4],
  ['handHi', /BongoH_Hit1_v(\d+)_rr(\d)_Close\.wav$/, 0.5, 0.25],
  ['congaO', /Conga_22_HitN_(\d+)_\d+_rr(\d)_Close\.wav$/, 0.8, 0.35],
  ['congaM', /Conga_17_HitHM1_(\d+)_\d+_rr(\d)_Close\.wav$/, 0.5, 0.25],
  ['bongoL', /BongoL_Hit1_v(\d+)_rr(\d)_Close\.wav$/, 0.5, 0.25],
  ['claves', /Claves1_Hit_v(\d+)_rr(\d)_Close\.wav$/, 0.4, 0.2],
  ['cowbell', /Cowbell1_Normal_v(\d+)_rr(\d)_Close\.wav$/, 0.6, 0.3],
  ['shaker', /LShaker_Shake1([DU])_rr(\d)_Close\.wav$/, 0.35, 0.15],
  ['tamb', /Tamb1_Shake_()rr(\d)_Close\.wav$/, 0.5, 0.25],
  ['timbH', /timb13_vl(\d+)_rr(\d)\.wav$/, 1.0, 0.45],
  ['timbL', /timb14_vl(\d+)_rr(\d)\.wav$/, 1.1, 0.5],
];

// ─────────────────────────── helpers ───────────────────────────

const rel = (p) => relative(OUT, p).split('\\').join('/');

function layersFrom(entries, chunkIfNoRR = 2) {
  // entries: { vl:number, rr:number|null, out:string, mean, peak }
  const hasRR = entries.some((e) => e.rr !== null);
  const byVl = new Map();
  for (const e of entries) {
    if (!byVl.has(e.vl)) byVl.set(e.vl, []);
    byVl.get(e.vl).push(e);
  }
  let groups = [...byVl.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g);
  if (!hasRR) {
    const chunked = [];
    for (let i = 0; i < groups.length; i += chunkIfNoRR) chunked.push(groups.slice(i, i + chunkIfNoRR).flat());
    groups = chunked;
  }
  return groups.map((g) => ({
    files: g.map((e) => rel(e.out)),
    mean: +(g.reduce((a, e) => a + e.mean, 0) / g.length).toFixed(1),
    peak: +Math.max(...g.map((e) => e.peak)).toFixed(1),
  }));
}

// ─────────────────────────── build ───────────────────────────

async function buildVirtuosityKit(manifest) {
  const files = await walk(join(CACHE, 'virtuosity', 'Samples'));
  const jobs = [];
  const voices = {};
  for (const [voice, piece, art, micSet, dur, fade] of VD_KIT) {
    const mics = VD_MICS[micSet];
    const re = new RegExp(`[\\\\/](kickmic|snaremic|oh)[\\\\/]${piece}[\\\\/]\\w+?_${art}_vl(\\d+)(?:_rr(\\d+))?\\.flac$`);
    const groups = new Map();
    for (const f of files) {
      const m = re.exec(f);
      if (!m) continue;
      const key = `${m[2]}_${m[3] ?? 0}`;
      if (!groups.has(key)) groups.set(key, { vl: +m[2], rr: m[3] ? +m[3] : null, inputs: [] });
      if (mics[m[1]]) groups.get(key).inputs.push({ file: f, gain: mics[m[1]] });
    }
    voices[voice] = [];
    for (const g of groups.values()) {
      const out = join(OUT, 'kit-roots', voice, `vl${g.vl}${g.rr ? `_rr${g.rr}` : ''}.flac`);
      const entry = { vl: g.vl, rr: g.rr, out };
      voices[voice].push(entry);
      jobs.push({ entry, inputs: g.inputs, opts: { dur, fade, hp: 25 } });
    }
  }
  return { id: 'kit-roots', jobs, voices };
}

async function buildRustyKit() {
  const files = await walk(join(CACHE, 'bigrusty', 'Samples'));
  const jobs = [];
  const voices = {};
  for (const [voice, folder, prefix, mics, dur, fade] of BR_KIT) {
    const re = new RegExp(`${folder.replace('/', '[\\\\/]')}[\\\\/](\\w+)[\\\\/]${prefix}_vl(\\d+)_rr(\\d+)\\.flac$`);
    const groups = new Map();
    for (const f of files) {
      const m = re.exec(f);
      if (!m || !mics[m[1]]) continue;
      const key = `${m[2]}_${m[3]}`;
      if (!groups.has(key)) groups.set(key, { vl: +m[2], rr: +m[3], inputs: [] });
      groups.get(key).inputs.push({ file: f, gain: mics[m[1]] });
    }
    voices[voice] = [];
    for (const g of groups.values()) {
      const out = join(OUT, 'kit-twotone', voice, `vl${g.vl}_rr${g.rr}.flac`);
      const entry = { vl: g.vl, rr: g.rr, out };
      voices[voice].push(entry);
      jobs.push({ entry, inputs: g.inputs, opts: { dur, fade, hp: 25 } });
    }
  }
  return { id: 'kit-twotone', jobs, voices };
}

async function buildPerc() {
  const files = await walk(join(CACHE, 'virtuosity', 'Samples', 'perc'));
  const jobs = [];
  const voices = {};
  for (const [voice, re, dur, fade] of PERC) {
    voices[voice] = [];
    const matched = files.filter((f) => re.test(f));
    const layerKeys = [...new Set(matched.map((f) => re.exec(f)[1]))].sort((a, b) =>
      isNaN(+a) || isNaN(+b) ? a.localeCompare(b) : +a - +b,
    );
    const singleLayer = voice === 'shaker'; // up/down strokes are variations, not dynamics
    for (const f of matched) {
      const m = re.exec(f);
      const vl = singleLayer ? 1 : layerKeys.indexOf(m[1]) + 1;
      const rr = singleLayer ? layerKeys.indexOf(m[1]) * 10 + +m[2] : +m[2];
      const out = join(OUT, 'perc', voice, `vl${vl}_rr${rr}.flac`);
      const entry = { vl, rr, out };
      voices[voice].push(entry);
      jobs.push({ entry, inputs: [{ file: f, gain: 1 }], opts: { dur, fade, hp: 30 } });
    }
  }
  return { id: 'perc', jobs, voices };
}

const NOTE_PC = { c: 0, db: 1, d: 2, eb: 3, e: 4, f: 5, gb: 6, g: 7, ab: 8, a: 9, bb: 10, b: 11 };
/** Karoryfer names notes an octave above sounding pitch (measured): a1 → MIDI 21. */
function nameToMidi(name) {
  const m = /^([a-g]b?)(\d)$/.exec(name);
  return m ? 12 * (+m[2] + 1) + NOTE_PC[m[1]] - 12 : null;
}

async function buildBass(id, source, folder, dynOrder, extra = {}) {
  const files = await walk(join(CACHE, source, folder));
  const re = /[\\/]([a-g]b?\d)_(\w+?)_rr(\d)\.wav$/;
  const zones = new Map();
  const jobs = [];
  for (const f of files) {
    const m = re.exec(f);
    if (!m || !dynOrder.includes(m[2])) continue;
    const midi = nameToMidi(m[1]);
    if (midi === null) continue;
    if (!zones.has(midi)) zones.set(midi, []);
    const vl = dynOrder.indexOf(m[2]) + 1;
    const out = join(OUT, id, folder, `${m[1]}_${m[2]}_rr${m[3]}.flac`);
    const entry = { vl, rr: +m[3], out, src: f };
    zones.get(midi).push(entry);
    jobs.push({ entry, inputs: [{ file: f, gain: 1 }], opts: { dur: extra.dur ?? 3.6, fade: extra.fade ?? 0.4, mono: true, hp: 28 } });
  }
  return { id, jobs, zones };
}

async function main() {
  if (!existsSync(CACHE)) throw new Error('Run scripts/samples/fetch.mjs first');
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const vd = await buildVirtuosityKit();
  const br = await buildRustyKit();
  const perc = await buildPerc();
  const dub = await buildBass('bass-dub', 'swagbass', 'notes', ['p', 'f', 'fff']);
  const round = await buildBass('bass-round', 'growlybass', 'sustain', ['p', 'f', 'ff']);
  const stac = await buildBass('bass-round', 'growlybass', 'staccato', ['staccato'], { dur: 1.2, fade: 0.25 });

  const all = [vd, br, perc, dub, round, stac].flatMap((b) => b.jobs);
  console.log(`Converting ${all.length} files…`);
  await pool(all, 8, async (job) => {
    await mixTo(job.entry.out, job.inputs, job.opts);
    Object.assign(job.entry, await measure(job.entry.out));
  });

  // Pitch-verify bass zones (tuning correction, clamped to ±40 cents)
  const tuneOf = (entries) => {
    try {
      const p = detectPitch(decodeMono(entries[0].src));
      return p ? p.midi : null;
    } catch {
      return null;
    }
  };

  const drumVoices = (voices) =>
    Object.fromEntries(Object.entries(voices).filter(([, e]) => e.length).map(([v, e]) => [v, { layers: layersFrom(e) }]));

  const bassZones = (zones) =>
    [...zones.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([midi, entries]) => {
        // Low strings have sharp overtones that bias pitch detection, so only
        // correct tuning from the low E up, and only small deviations.
        const measured = midi >= 40 ? tuneOf(entries) : null;
        const cents = measured === null ? 0 : Math.round((measured - midi) * 100);
        return { midi, cents: Math.abs(cents) <= 25 ? cents : 0, layers: layersFrom(entries) };
      });

  const manifest = {
    version: 1,
    generated: new Date().toISOString(),
    credits: SOURCES.map((s) => ({ id: s.id, credit: s.credit, license: s.license, repo: `https://github.com/${s.repo}` })),
    instruments: {
      'kit-roots': { type: 'drums', voices: drumVoices(vd.voices) },
      'kit-twotone': { type: 'drums', voices: drumVoices(br.voices) },
      perc: { type: 'drums', voices: drumVoices(perc.voices) },
      'bass-dub': { type: 'bass', zones: bassZones(dub.zones) },
      'bass-round': { type: 'bass', zones: bassZones(round.zones), staccato: bassZones(stac.zones) },
    },
  };
  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  const outFiles = await walk(OUT);
  const { statSync } = await import('node:fs');
  const total = outFiles.reduce((a, f) => a + statSync(f).size, 0);
  console.log(`Wrote ${outFiles.length} files, ${(total / 1048576).toFixed(1)} MB → public/samples`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
