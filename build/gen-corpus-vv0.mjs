// Extracts the training/eval corpus for the POS-heteronym decision (is_verb_VV0)
// from the CLAWS-tagged corpora: every sentence containing one of the target
// words, copied verbatim (word_TAG tokens, one sentence per line) — the same
// shape as the NN2|VVZ corpora that build/gen-vvz-svm.py consumes.
//
// Targets default to encoding 152 (the 17 non "-ate" heteronyms: use, house,
// live, bear, refuse, …), the class with enough corpus support to learn from.
// Pass an encoding to extract another: `node build/gen-corpus-vv0.mjs 102`.
//
// Output (gitignored, regenerable):
//   disambig/_corpus_vv0_<enc>.txt      fiction
//   disambig/_corpus_vv0_<enc>_nf.txt   non-fiction
//
// Run: npm run gen:corpus:vv0
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLAWS = path.resolve(ROOT, '..', 'CLAWS-tagged-data');
const SOURCES = [
  ['', path.join(CLAWS, 'corpus', 'txt')], // fiction
  ['_nf', path.join(CLAWS, 'corpusNF', 'txt')], // non-fiction
];
const ENC = process.argv[2] || '152';

const targets = new Set(
  fs
    .readFileSync(path.join(ROOT, 'data', 'euspell_lexicon.csv'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, '').split(','))
    .filter((c) => c[2] === ENC)
    .map((c) => c[0].toLowerCase())
);
if (!targets.size) throw new Error(`no lexicon entries with encoding ${ENC}`);
console.log(`encoding ${ENC}: ${targets.size} target words`);

const outDir = path.join(ROOT, 'disambig');
fs.mkdirSync(outDir, { recursive: true });

for (const [suffix, dir] of SOURCES) {
  if (!fs.existsSync(dir)) {
    console.warn(`  skip ${dir} (not found)`);
    continue;
  }
  const out = path.join(outDir, `_corpus_vv0_${ENC}${suffix}.txt`);
  const fd = fs.openSync(out, 'w');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt'));
  let kept = 0;
  let buf = [];
  for (const f of files) {
    let text;
    try {
      text = fs.readFileSync(path.join(dir, f), 'utf8');
    } catch {
      continue; // unreadable file — skip rather than abort a long run
    }
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      // Cheap pre-filter before the per-token scan: most lines have no target.
      let hit = false;
      for (const tk of line.split(/\s+/)) {
        const i = tk.lastIndexOf('_');
        if (i <= 0) continue;
        if (targets.has(tk.slice(0, i).toLowerCase())) { hit = true; break; }
      }
      if (!hit) continue;
      buf.push(line.trim());
      kept++;
      if (buf.length >= 4096) { fs.writeSync(fd, `${buf.join('\n')}\n`); buf = []; }
    }
  }
  if (buf.length) fs.writeSync(fd, `${buf.join('\n')}\n`);
  fs.closeSync(fd);
  const mb = (fs.statSync(out).size / 1048576).toFixed(1);
  console.log(`  ${path.basename(out)} — ${kept.toLocaleString()} lines from ${files.length.toLocaleString()} files (${mb} MB)`);
}
