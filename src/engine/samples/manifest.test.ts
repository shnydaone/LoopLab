/** Validates the generated sample manifest against the files on disk. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SampleManifest } from './loader';

const dir = join(process.cwd(), 'public', 'samples');
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as SampleManifest;

describe('bundled sample manifest', () => {
  it('keeps a licence record that names every source library', () => {
    const licences = readFileSync(join(dir, 'LICENSES.md'), 'utf8');
    for (const c of manifest.credits) expect(licences, c.repo).toContain(c.repo);
  });

  it('credits only CC0 sources', () => {
    expect(manifest.credits.length).toBeGreaterThan(0);
    for (const c of manifest.credits) expect(c.license).toBe('CC0-1.0');
  });

  it('references files that exist', () => {
    const files: string[] = [];
    for (const inst of Object.values(manifest.instruments)) {
      for (const v of Object.values(inst.voices ?? {})) for (const l of v.layers) files.push(...l.files);
      for (const z of [...(inst.zones ?? []), ...(inst.staccato ?? [])]) for (const l of z.layers) files.push(...l.files);
    }
    expect(files.length).toBeGreaterThan(400);
    for (const f of files) expect(existsSync(join(dir, f)), f).toBe(true);
  });

  it('has the core drum voices in both kits with several layers', () => {
    for (const kit of ['kit-roots', 'kit-twotone']) {
      const voices = manifest.instruments[kit].voices!;
      for (const v of ['kick', 'snare', 'rimshot', 'rim', 'hatC', 'hatO', 'ride', 'crash', 'tomH', 'tomL']) {
        expect(voices[v], `${kit}.${v}`).toBeDefined();
      }
      expect(voices.snare.layers.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('orders velocity layers from soft to loud for the main drums', () => {
    for (const kit of ['kit-roots', 'kit-twotone']) {
      for (const v of ['kick', 'snare']) {
        const means = manifest.instruments[kit].voices![v].layers.map((l) => l.mean);
        expect(means[means.length - 1]).toBeGreaterThan(means[0] + 6);
      }
    }
  });

  it('has guitar notes, string-mute releases and muted strums', () => {
    const g = manifest.instruments.guitar;
    expect(g.zones!.length).toBeGreaterThanOrEqual(12);
    expect(g.release!.length).toBeGreaterThanOrEqual(12);
    expect(g.noises!.muted.layers[0].files.length).toBeGreaterThan(4);
    // Skank voicings live around E4; make sure that register is covered closely.
    const midis = g.zones!.map((z) => z.midi);
    expect(Math.min(...midis)).toBeLessThanOrEqual(52);
    expect(Math.max(...midis)).toBeGreaterThanOrEqual(76);
  });

  it('has a full horn section with sustained and staccato notes', () => {
    const ranges: Record<string, [number, number]> = { trumpet: [58, 80], 'tenor-sax': [48, 77], trombone: [41, 65] };
    for (const [id, [lo, hi]] of Object.entries(ranges)) {
      const inst = manifest.instruments[id];
      expect(inst.zones!.length, id).toBeGreaterThan(5);
      expect(inst.staccato!.length, id).toBeGreaterThan(5);
      const midis = inst.zones!.map((z) => z.midi);
      expect(Math.min(...midis), id).toBeLessThanOrEqual(lo);
      expect(Math.max(...midis), id).toBeGreaterThanOrEqual(hi);
    }
  });

  it('covers the reggae bass register without big gaps', () => {
    for (const id of ['bass-dub', 'bass-round']) {
      const zones = manifest.instruments[id].zones!;
      const midis = zones.map((z) => z.midi);
      expect(Math.min(...midis)).toBeLessThanOrEqual(31);
      for (let i = 1; i < midis.length; i++) expect(midis[i] - midis[i - 1]).toBeLessThanOrEqual(4);
      for (const z of zones) expect(Math.abs(z.cents)).toBeLessThanOrEqual(25);
    }
  });
});
