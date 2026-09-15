// Distribution-shift test for the NN2|VVZ decision: train on contemporary
// prose, test on Project Gutenberg.
//
// The model and the per-word prior are both fitted on the fiction and
// non-fiction corpora, which are present-day ebooks. This scores them on
// ../CLAWS-tagged-data/gut/, 700 CLAWS-tagged Gutenberg texts that nothing in
// the pipeline has ever read. Two things shift at once, and the report
// separates them:
//
//   the PRIOR shifts, hard. Contemporary prose runs 52.8% verb over the target
//     set; Gutenberg runs about 10%, because nineteenth-century narrative is
//     past-tense — "his eyes", "her hands", "the things" are everywhere and
//     "she makes" is rare. So "always the commoner class" flips from meaning
//     VERB to meaning NOUN, and its score flips with it.
//   the CONTEXT may or may not shift. Whether "the <noun> <target> <preposition>"
//     still means a noun in 1890 is the actual question, and it is the one the
//     rule and the SVM answer.
//
// Hence three baselines, not one. The transferred prior is what a shipped
// lookup table would score out of domain; the in-domain prior is what one
// refitted on Gutenberg would score, so the gap between them is the price of
// the prior shift alone, with context held out of it.
//
// De-duplication is not optional. A handful of Gutenberg texts also sit in the
// fiction corpus under different ids (Epub2_269402p / Epub2_269302), so without
// a content check some of this "unseen" test set is training data. Files are
// fingerprinted by their first long sentences and any collision drops the file.
//
// Run: npm run eval:shift
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { is_VVZ, is_VVZ_svm, svmFeatures, VERB_THRESHOLD } from '../src/disambig/pos.js';
import { VVZ_SVM } from '../src/disambig/vvz-svm.js';
import { tagWord } from '../src/content/tagger.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLAWS = path.resolve(ROOT, '..', 'CLAWS-tagged-data');
const GUT = path.join(CLAWS, 'gut', 'txt');
const TRAIN = [
  path.join(ROOT, 'disambig', '_corpus_012_112.txt'),
  path.join(ROOT, 'disambig', '_corpus_012_112_nf.txt'),
];
if (!fs.existsSync(GUT)) throw new Error(`no Gutenberg corpus at ${GUT}`);

const targets = new Set(
  fs
    .readFileSync(path.join(ROOT, 'data', 'euspell_lexicon.csv'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, '').split(','))
    .filter((c) => c[2] === '012' || c[2] === '112')
    .map((c) => c[0].toLowerCase())
);

const BREAK = new Set(['.', '!', '?']);
function parse(line) {
  const out = [];
  for (const tk of line.split(/\s+/)) {
    const i = tk.lastIndexOf('_');
    if (i <= 0) continue;
    const word = tk.slice(0, i);
    out.push({ word, gold: tk.slice(i + 1), breakAfter: BREAK.has(word) });
  }
  return out;
}

// --- de-duplication ----------------------------------------------------------
// The same book under a different id is still the same book, so ids cannot do
// this. Long sentences make near-unique fingerprints; five per file is enough
// to catch a duplicate and cheap enough to run over 13k files.
function fingerprints(file) {
  const out = [];
  const text = fs.readFileSync(file, 'utf8');
  let from = 0;
  while (out.length < 5) {
    const nl = text.indexOf('\n', from);
    const line = (nl < 0 ? text.slice(from) : text.slice(from, nl)).trim();
    if (line) {
      const w = line.split(/\s+/);
      if (w.length > 25) out.push(crypto.createHash('md5').update(w.slice(0, 20).join(' ')).digest('hex'));
    }
    if (nl < 0) break;
    from = nl + 1;
  }
  return out;
}

/** Files only — both corpus dirs carry a `words/` subdirectory alongside the texts. */
const filesIn = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.join(dir, e.name));

process.stderr.write('fingerprinting the training corpora… ');
const seen = new Set();
for (const dir of [path.join(CLAWS, 'corpus', 'txt'), path.join(CLAWS, 'corpusNF', 'txt')]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of filesIn(dir)) for (const h of fingerprints(f)) seen.add(h);
}
process.stderr.write(`${seen.size.toLocaleString()} fingerprints\n`);

const gutFiles = [];
let dropped = 0;
for (const f of filesIn(GUT)) {
  if (fingerprints(f).some((h) => seen.has(h))) dropped++;
  else gutFiles.push(f);
}
process.stderr.write(`gutenberg: ${gutFiles.length} files kept, ${dropped} dropped as duplicates of training text\n`);

// --- the two priors ----------------------------------------------------------
// Transferred: fitted on the contemporary TRAINING portion, exactly as the
// shipped model was, so the pair is a fair comparison.
const trPrior = new Map();
let lineNo = 0;
for (const file of TRAIN) {
  if (!fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  for (const line of lines) {
    const held = lineNo++ % 5 === 0;
    if (held || !line.trim()) continue;
    for (const tk of line.split(/\s+/)) {
      const i = tk.lastIndexOf('_');
      if (i <= 0) continue;
      const w = tk.slice(0, i).toLowerCase();
      const gold = tk.slice(i + 1);
      if ((gold !== 'NN2' && gold !== 'VVZ') || !targets.has(w)) continue;
      let c = trPrior.get(w);
      if (!c) trPrior.set(w, (c = [0, 0]));
      c[gold === 'VVZ' ? 1 : 0]++;
    }
  }
}

// In-domain: fitted on four fifths of Gutenberg, scored on the fifth, so it is
// an honest refit rather than an oracle read off its own answers.
const gutPrior = new Map();
{
  let ln = 0;
  for (const file of gutFiles) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    for (const line of lines) {
      const held = ln++ % 5 === 0;
      if (held || !line.trim()) continue;
      for (const tk of line.split(/\s+/)) {
        const i = tk.lastIndexOf('_');
        if (i <= 0) continue;
        const w = tk.slice(0, i).toLowerCase();
        const gold = tk.slice(i + 1);
        if ((gold !== 'NN2' && gold !== 'VVZ') || !targets.has(w)) continue;
        let c = gutPrior.get(w);
        if (!c) gutPrior.set(w, (c = [0, 0]));
        c[gold === 'VVZ' ? 1 : 0]++;
      }
    }
  }
}

// --- score -------------------------------------------------------------------
const zero = () => ({ tp: 0, fp: 0, tn: 0, fn: 0 });
const METHODS = ['tprior', 'gprior', 'rule', 'raw', 'svm'];
const all = Object.fromEntries(METHODS.map((m) => [m, zero()])); // whole kept set
const fifth = Object.fromEntries(METHODS.map((m) => [m, zero()])); // the held-out fifth only
const byWord = new Map();
let unseenInTrain = 0;

let ln = 0;
for (const file of gutFiles) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  for (const line of lines) {
    const held = ln++ % 5 === 0;
    if (!line.trim()) continue;
    const raw = parse(line);
    for (let i = 0; i < raw.length; i++) {
      const word = raw[i].word.toLowerCase();
      if (!targets.has(word)) continue;
      const { gold } = raw[i];
      if (gold !== 'NN2' && gold !== 'VVZ') continue;
      const isVerb = gold === 'VVZ';

      const tokens = raw.map((t, k) => ({
        word: t.word,
        tag: k === i ? '' : tagWord(t.word),
        breakAfter: t.breakAfter,
      }));
      let rawScore = 0;
      for (const f of svmFeatures(tokens, i)) rawScore += VVZ_SVM.get(f) ?? 0;

      const t = trPrior.get(word);
      const g = gutPrior.get(word);
      if (!t) unseenInTrain++;
      const pred = {
        tprior: t ? t[1] > t[0] : false,
        gprior: g ? g[1] > g[0] : false,
        rule: is_VVZ(tokens, i),
        // Same threshold as production, so the gap to is_VVZ_svm is the VETO
    // alone. Leaving this at 0 would fold the threshold into the ablation.
    raw: rawScore > VERB_THRESHOLD,
        svm: is_VVZ_svm(tokens, i),
      };

      let w = byWord.get(word);
      if (!w) byWord.set(word, (w = { n: 0, verbs: 0, ...Object.fromEntries(METHODS.map((m) => [m, zero()])) }));
      w.n++;
      if (isVerb) w.verbs++;
      for (const m of METHODS) {
        const k = pred[m] ? (isVerb ? 'tp' : 'fp') : isVerb ? 'fn' : 'tn';
        all[m][k]++;
        w[m][k]++;
        if (held) fifth[m][k]++;
      }
    }
  }
}

// --- report ------------------------------------------------------------------
const pct = (x) => (100 * x).toFixed(1).padStart(5);
const n_ = (s) => s.tp + s.fp + s.tn + s.fn;
const acc = (s) => (s.tp + s.tn) / n_(s);
const prec = (s) => (s.tp + s.fp ? s.tp / (s.tp + s.fp) : NaN);
const rec = (s) => (s.tp + s.fn ? s.tp / (s.tp + s.fn) : NaN);
const or_ = (x) => (Number.isNaN(x) ? '    — ' : pct(x));

const N = n_(all.rule);
const verbs = all.rule.tp + all.rule.fn;
const maj = Math.max(verbs, N - verbs) / N;

console.log('\nDISTRIBUTION SHIFT: trained on contemporary prose, tested on Project Gutenberg\n');
console.log(`  ${N.toLocaleString()} targets over ${byWord.size.toLocaleString()} word forms, from ${gutFiles.length} texts`);
console.log(
  `  gold VVZ ${verbs.toLocaleString()} (${pct(verbs / N).trim()}%)   ` +
    `gold NN2 ${(N - verbs).toLocaleString()} (${pct((N - verbs) / N).trim()}%)`
);
console.log(`  in-domain training prose ran 52.8% verb, so the class prior moved by ${(52.8 - (100 * verbs) / N).toFixed(1)} points`);
console.log(`  targets whose word never appears in the training corpora: ${unseenInTrain.toLocaleString()}\n`);

const LABEL = {
  tprior: 'per-word prior (transferred)',
  rule: 'is_VVZ (hand rule)',
  raw: 'SVM alone (no veto)',
  svm: 'is_VVZ_svm (production)',
};
console.log('method'.padEnd(31), 'acc'.padStart(6), 'verbP'.padStart(6), 'verbR'.padStart(6));
console.log('always the commoner class'.padEnd(31), pct(maj), '     —', '     —');
for (const m of ['tprior', 'rule', 'raw', 'svm']) {
  const s = all[m];
  console.log(LABEL[m].padEnd(31), pct(acc(s)), or_(prec(s)), or_(rec(s)));
}

// The prior shift and the context shift, separated. Both priors are scored on
// the same fifth so the difference is the refit and nothing else.
const f = n_(fifth.rule);
const fv = fifth.rule.tp + fifth.rule.fn;
console.log(`\nprior shift alone, on the held-out fifth (${f.toLocaleString()} targets, ${pct(fv / f).trim()}% verb):`);
console.log(`  per-word prior, transferred from contemporary prose  ${pct(acc(fifth.tprior))}`);
console.log(`  per-word prior, refitted in domain                   ${pct(acc(fifth.gprior))}`);
console.log(
  `  cost of not refitting                               ${((acc(fifth.gprior) - acc(fifth.tprior)) * 100).toFixed(1)} pt`
);
console.log(`  is_VVZ_svm on the same fifth                         ${pct(acc(fifth.svm))}`);

// Accuracy alone cannot be compared across the shift, because the majority
// baseline moved 37 points with the class prior. Error reduction can.
const red = (from, to) => `${(((to - from) / (1 - from)) * 100).toFixed(1)}%`;
console.log('\nerror reduction by the shipped decision, against each baseline:');
console.log(`  vs always the commoner class (${pct(maj).trim()}%)          ${red(maj, acc(all.svm))}`);
console.log(`  vs the transferred prior (${pct(acc(all.tprior)).trim()}%)              ${red(acc(all.tprior), acc(all.svm))}`);
console.log(
  `  vs an in-domain refit prior (${pct(acc(fifth.gprior)).trim()}%), on the fifth  ${red(acc(fifth.gprior), acc(fifth.svm))}`
);

// The veto was tuned on regression frames precisely because in-domain accuracy
// could not score the out-of-distribution shapes it exists for. This is that
// score: if the veto is worth anything, it is worth more here than at home.
console.log('\nthe rule veto, out of domain vs in domain:');
console.log(
  `  here      SVM alone ${pct(acc(all.raw)).trim()} -> blended ${pct(acc(all.svm)).trim()}   ` +
    `acc ${((acc(all.svm) - acc(all.raw)) * 100 >= 0 ? '+' : '') + ((acc(all.svm) - acc(all.raw)) * 100).toFixed(2)} pt   ` +
    `verbP ${pct(prec(all.raw)).trim()} -> ${pct(prec(all.svm)).trim()}`
);
// Hand-copied from `npm run eval:vvz`, and therefore the one number on this
// page that can go stale on its own. Re-check it whenever that harness is run.
console.log('  at home   SVM alone 94.1 -> blended 93.2   acc -0.93 pt   verbP 97.2 -> 97.8   (eval:vvz)');

console.log('\nper word, top 20 by frequency in Gutenberg:');
console.log(
  'word'.padEnd(14),
  'n'.padStart(8),
  'VVZ%'.padStart(6),
  'tprior'.padStart(7),
  'rule'.padStart(6),
  'svm'.padStart(6)
);
for (const [word, w] of [...byWord.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 20)) {
  console.log(
    word.padEnd(14),
    String(w.n).padStart(8),
    pct(w.verbs / w.n),
    pct(acc(w.tprior)),
    pct(acc(w.rule)),
    pct(acc(w.svm))
  );
}

console.log(`\nconfusion (is_VVZ_svm): tp ${all.svm.tp}  fp ${all.svm.fp}  tn ${all.svm.tn}  fn ${all.svm.fn}`);
console.log(
  `false verbs — the visible error for a converter — are ${((100 * all.svm.fp) / (N - verbs)).toFixed(2)}% of all nouns\n`
);
