/**
 * Download the selected CC0 sample files into .sample-cache/<source>/
 * (raw, untouched, git-ignored). Re-running skips files already present.
 *
 *   node scripts/samples/fetch.mjs [--dry]
 */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES } from './manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE = join(ROOT, '.sample-cache');
const dry = process.argv.includes('--dry');
const headers = { 'User-Agent': 'looplab-sample-fetch' };

async function exists(p) {
  try {
    return (await stat(p)).size > 0;
  } catch {
    return false;
  }
}

async function listFiles(src) {
  const res = await fetch(`https://api.github.com/repos/${src.repo}/git/trees/${src.branch}?recursive=1`, { headers });
  if (!res.ok) throw new Error(`${src.repo}: tree request failed ${res.status}`);
  const tree = await res.json();
  return tree.tree.filter((f) => f.type === 'blob' && src.include.some((re) => re.test(f.path)));
}

async function download(src, file) {
  const out = join(CACHE, src.id, ...file.path.split('/'));
  if (await exists(out)) return 0;
  const url = `https://raw.githubusercontent.com/${src.repo}/${src.branch}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, buf);
      return buf.length;
    } catch (err) {
      if (attempt === 3) throw new Error(`${file.path}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  return 0;
}

let grand = 0;
for (const src of SOURCES) {
  const files = await listFiles(src);
  const bytes = files.reduce((a, f) => a + (f.size ?? 0), 0);
  grand += bytes;
  console.log(`${src.id}: ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB`);
  if (dry) continue;
  let done = 0;
  let fetched = 0;
  const queue = [...files];
  const worker = async () => {
    while (queue.length) {
      const f = queue.shift();
      const n = await download(src, f);
      fetched += n;
      done++;
      if (done % 50 === 0) console.log(`  ${done}/${files.length}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`  done (${(fetched / 1048576).toFixed(1)} MB downloaded this run)`);
}
console.log(`TOTAL selected: ${(grand / 1048576).toFixed(1)} MB${dry ? ' (dry run)' : ''}`);
