// Measures is_verbal_s (the clitic 's: genitive 's vs contracted is/has 'z)
// against the CLAWS-tagged corpus. Companion to build/rule-vv0.mjs, and built
// the same way — faithfulness over convenience:
//   - neighbour tags come from the LEXICON candidate set (tagWord), never the
//     corpus gold tag, because that is all the runtime has at conversion time;
//   - the target's own tag is '', as convert() passes it;
//   - the corpus gold tag is used ONLY as the label.
//
// CLAWS labels the clitic itself, so no hand-labelling is needed: GE is the
// genitive marker, VBZ/VHZ/VDZ the contracted is/has/does.
//
// Reported with precision and recall on the VERBAL reading, which is the one
// the rule has to earn — the genitive is the default it falls back to.
//
// Run: npm run eval:clitic-s     (needs npm run gen:corpus:clitic-s first)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { is_verbal_s } from '../src/disambig/pos.js';
import { tagWord } from '../src/content/tagger.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'disambig', '_corpus_clitic_s.txt');
if (!fs.existsSync(FILE)) throw new Error('no corpus — run "node build/gen-corpus-clitic-s.mjs" first');

const VERBAL = new Set(['VBZ', 'VHZ', 'VDZ']);
const BREAK = new Set(['.', '!', '?']);
const isClitic = (w) => w === "'s" || w === '’s';

let tp = 0, fp = 0, tn = 0, fn = 0, n = 0;
/** @type {Map<string, {tp:number,fp:number,tn:number,fn:number}>} following-word tally for the misses */
const missAfter = new Map();

const lines = fs.readFileSync(FILE, 'utf8').split('\n');
for (let li = 0; li < lines.length; li++) {
  if (li % 5 !== 0) continue; // held-out fifth, matching the other harnesses
  const raw = lines[li];
  if (!raw) continue;

  const toks = [];
  for (const tk of raw.split(/\s+/)) {
    const i = tk.lastIndexOf('_');
    if (i <= 0) continue;
    const word = tk.slice(0, i);
    toks.push({ word, gold: tk.slice(i + 1), breakAfter: BREAK.has(word) });
  }

  for (let idx = 0; idx < toks.length; idx++) {
    if (!isClitic(toks[idx].word)) continue;
    const gold = toks[idx].gold;
    if (gold !== 'GE' && !VERBAL.has(gold)) continue;

    // Exactly what the runtime sees: lexicon tags for context, '' for the target.
    const view = toks.map((t, i) => ({
      word: t.word,
      tag: i === idx ? '' : tagWord(t.word),
      breakAfter: t.breakAfter,
    }));

    const want = VERBAL.has(gold);
    const got = is_verbal_s(view, idx);
    n++;
    if (got && want) tp++;
    else if (got && !want) fp++;
    else if (!got && !want) tn++;
    else {
      fn++;
      const after2 = (toks[idx + 2]?.word ?? '<end>').toLowerCase();
      missAfter.set(after2, (missAfter.get(after2) ?? 0) + 1);
    }
  }
}

const pct = (x) => (100 * x).toFixed(2);
console.log(`clitic 's, held-out fifth: ${n.toLocaleString()} occurrences`);
console.log(`  gold verbal ${tp + fn} (${pct((tp + fn) / n)}%)   gold genitive ${tn + fp} (${pct((tn + fp) / n)}%)`);
console.log(`  accuracy            ${pct((tp + tn) / n)}`);
console.log(`  verbal precision    ${pct(tp / (tp + fp))}`);
console.log(`  verbal recall       ${pct(tp / (tp + fn))}`);
console.log(`  always-genitive     ${pct((tn + fp) / n)}   (the baseline to beat)`);
console.log(`  confusion: tp ${tp}  fp ${fp}  tn ${tn}  fn ${fn}`);

console.log('\n  commonest word two after the clitic on a MISSED verbal (the attributive test):');
for (const [w, c] of [...missAfter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`    ${String(c).padStart(6)}  ${w}`);
}
