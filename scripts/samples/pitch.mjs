/**
 * Measure the fundamental pitch of audio files (autocorrelation), to verify
 * sample-to-MIDI mappings.  node scripts/samples/pitch.mjs <file...>
 */
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

export function decodeMono(file, seconds = 1.2, rate = 22050) {
  const r = spawnSync(ffmpeg, ['-v', 'error', '-i', file, '-t', String(seconds), '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'], {
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(String(r.stderr));
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 4));
}

export function detectPitch(x, rate = 22050, minHz = 25, maxHz = 500) {
  // analyse a window after the attack
  const start = Math.floor(0.15 * rate);
  const n = Math.min(x.length - start, Math.floor(0.5 * rate));
  if (n < rate * 0.1) return null;
  const seg = x.subarray(start, start + n);
  const minLag = Math.floor(rate / maxHz);
  const maxLag = Math.floor(rate / minHz);
  let energy = 0;
  for (let i = 0; i < n; i++) energy += seg[i] * seg[i];
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let ac = 0;
    let m = 0;
    for (let i = 0; i + lag < n; i++) {
      ac += seg[i] * seg[i + lag];
      m += seg[i] * seg[i] + seg[i + lag] * seg[i + lag];
    }
    nsdf[lag] = m > 0 ? (2 * ac) / m : 0;
  }
  // McLeod: first peak above 0.9 * global max
  let globalMax = 0;
  for (let lag = minLag; lag <= maxLag; lag++) globalMax = Math.max(globalMax, nsdf[lag]);
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (nsdf[lag] > 0.9 * globalMax && nsdf[lag] >= nsdf[lag - 1] && nsdf[lag] >= nsdf[lag + 1]) {
      const a = nsdf[lag - 1], b = nsdf[lag], c = nsdf[lag + 1];
      const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
      const hz = rate / (lag + shift);
      return { hz, midi: 69 + 12 * Math.log2(hz / 440), energy };
    }
  }
  return null;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  for (const f of process.argv.slice(2)) {
    const p = detectPitch(decodeMono(f));
    console.log(f.split(/[\\/]/).slice(-2).join('/'), p ? `${p.hz.toFixed(1)} Hz  midi ${p.midi.toFixed(2)}` : 'n/a');
  }
}
