/**
 * Loads the bundled sample manifest and decodes audio files on demand.
 * Each instrument's buffers are fetched once and shared; progress is
 * published to liveStore so the UI can show a loading indicator.
 */
import * as Tone from 'tone';
import { liveStore } from '../live';

export interface SampleLayer {
  files: string[];
  /** Average loudness (dBFS) of the layer's takes. */
  mean: number;
  peak: number;
}

export interface DrumVoiceSamples {
  layers: SampleLayer[];
}

export interface BassZone {
  midi: number;
  cents: number;
  layers: SampleLayer[];
}

export interface SampleInstrument {
  type: 'drums' | 'bass';
  voices?: Record<string, DrumVoiceSamples>;
  zones?: BassZone[];
  staccato?: BassZone[];
}

export interface SampleManifest {
  version: number;
  credits: { id: string; credit: string; license: string; repo: string }[];
  instruments: Record<string, SampleInstrument>;
}

const BASE = `${import.meta.env.BASE_URL}samples/`;
let manifestPromise: Promise<SampleManifest | null> | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let pending = 0;
let loaded = 0;

function publish() {
  liveStore.setState({ samplesPending: pending, samplesLoaded: loaded });
}

export function loadManifest(): Promise<SampleManifest | null> {
  if (!manifestPromise) {
    manifestPromise = fetch(`${BASE}manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SampleManifest>) : null))
      .catch((err) => {
        console.warn('[samples] manifest unavailable, using synth sounds', err);
        return null;
      });
  }
  return manifestPromise;
}

/** Decode one file (cached). Resolves null on failure so playback never breaks. */
export function loadBuffer(path: string): Promise<AudioBuffer | null> {
  let p = buffers.get(path);
  if (!p) {
    pending++;
    publish();
    p = fetch(BASE + path)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${path}`);
        return r.arrayBuffer();
      })
      .then((ab) => Tone.getContext().decodeAudioData(ab))
      .catch((err) => {
        console.warn('[samples] failed', path, err);
        return null;
      })
      .finally(() => {
        pending--;
        loaded++;
        publish();
      });
    buffers.set(path, p);
  }
  return p;
}

/** Decode a list of files with limited concurrency. */
export async function loadAll(paths: string[], concurrency = 6): Promise<Map<string, AudioBuffer>> {
  const out = new Map<string, AudioBuffer>();
  const queue = [...new Set(paths)];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const path = queue.shift()!;
        const buf = await loadBuffer(path);
        if (buf) out.set(path, buf);
      }
    }),
  );
  return out;
}
