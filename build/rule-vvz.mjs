// Measures the NN2|VVZ decision — "the records" vs "she recordz" — against the
// CLAWS-tagged corpus, scoring every method on one split so they are directly
// comparable. The companion build/gen-vvz-svm.py has always named this file;
// until now it did not exist, so the learned model's headline number had no
// rule to sit beside.
//
// Faithfulness over convenience, exactly as build/rule-vv0.mjs:
//   - neighbor tags come from the LEXICON candidate set (tagWord), never from
//     the corpus gold tag, because that is all the runtime has at conversion
//     time. Scoring against gold neighbor tags would flatter every method here.
//   - the target's own tag is '', as convert() passes it.
//   - the corpus gold tag is used ONLY as the label.
//
// Four methods, weakest first:
//
//   global majority     always the commoner class. Reported because it is what
//                       a reader assumes "accuracy" is measured against, and it
//                       is far too low a bar on this task.
//   per-word prior      each word's majority reading, COUNTED ON TRAIN and
//                       applied to test — a lookup table that ignores context
//                       entirely. This is the real baseline: the lexicon
//                       already knows each word, so any context model has to
//                       earn its place above this line, not above 52.8%.
//   is_VVZ              the hand-written context rule (vvzScore > 0), with no
//                       per-word bias at all.
//   raw SVM sign        the learned model alone, no veto. Scored here rather
//                       than only in gen-vvz-svm.py so the veto ablation reads
//                       off ONE table, and so it is scored against the weights
//                       that actually ship rather than ones just retrained.
//   is_VVZ_svm          what production actually runs: the learned score
//                       blended with the rule's negative votes.
//
// The last two differ only by RULE_VETO, so the gap between them is the whole
// value of the veto — worth watching, because RULE_VETO is a constant tuned
// against one set of weights and does not retune itself when they change.
//
// The split is by line, index % 5 === 0 held out, on a counter running across
// both corpora in the order gen-vvz-svm.py reads them. That is what makes the
// two harnesses score identical targets — change the order and the numbers stop
// being comparable to the model's.
//
// Run: node build/rule-vvz.mjs          (needs npm run gen:corpus:vv0's sibling
//                                        corpora, _corpus_012_112*.txt)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  is_VVZ,
  is_VVZ_svm,
  svmFeatures,
  vvzScore,
  endsIsolatedNounPhrase,
  RULE_VETO,
  VERB_THRESHOLD,
} from '../src/disambig/pos.js';
import { VVZ_SVM } from '../src/disambig/vvz-svm.js';
import { tagWord } from '../src/content/tagger.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOP = Number(process.env.TOP ?? 25); // per-word rows to print

// Genre-labelled, in gen-vvz-svm.py's CORPORA order. The per-genre split is
// worth keeping: a model that only works on fiction would be a real finding.
const SOURCES = [
  ['fic', path.join(ROOT, 'disambig', '_corpus_012_112.txt')],
  ['nf', path.join(ROOT, 'disambig', '_corpus_012_112_nf.txt')],
].filter(([, f]) => fs.existsSync(f));
if (!SOURCES.length) throw new Error('no corpus — run build/gen-corpus-vv0.mjs\'s NN2|VVZ sibling first');

// Targets: the two encodings whose spelling turns on the noun/verb reading.
const targets = new Set(
  fs
    .readFileSync(path.join(ROOT, 'data', 'euspell_lexicon.csv'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, '').split(','))
    .filter((c) => c[2] === '012' || c[2] === '112')
    .map((c) => c[0].toLowerCase())
);

const BREAK = new Set(['.', '!', '?']);

/** word_TAG … -> [{ word, gold, breakAfter }] */
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

/** Walks the held-out (or training) targets of every corpus, in split order. */
function* walk(wantHeldOut) {
  let lineNo = 0;
  for (const [genre, file] of SOURCES) {
    // Python's `for line in open(path)` yields no final empty string after a
    // trailing newline, but split('\n') does — and that phantom line would
    // shift the counter by one for every corpus after the first, silently
    // scoring a DIFFERENT fifth than gen-vvz-svm.py. A blank line elsewhere in
    // the file still advances the counter, because Python's does.
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    for (const line of lines) {
      const held = lineNo++ % 5 === 0;
      if (!line.trim()) continue;
      if (held !== wantHeldOut) continue;
      const raw = parse(line);
      for (let i = 0; i < raw.length; i++) {
        const w = raw[i].word.toLowerCase();
        if (!targets.has(w)) continue;
        const { gold } = raw[i];
        if (gold !== 'NN2' && gold !== 'VVZ') continue; // unlabelable reading
        yield { raw, i, word: w, isVerb: gold === 'VVZ', genre };
      }
    }
  }
}

// --- pass 1: the per-word prior, counted on TRAIN only -----------------------
//
// Counting it on the test set instead would be an oracle — it reads the answer
// off the data it is scored on — and on this task that is not a rounding error:
// it is the difference between a baseline you could ship and one you could not.
const prior = new Map(); // word -> [nn2, vvz]
for (const { word, isVerb } of walk(false)) {
  let c = prior.get(word);
  if (!c) prior.set(word, (c = [0, 0]));
  c[isVerb ? 1 : 0]++;
}

// --- pass 2: score every method on the held-out fifth -------------------------
const zero = () => ({ tp: 0, fp: 0, tn: 0, fn: 0 });
const METHODS = ['prior', 'rule', 'raw', 'svm'];
const overall = Object.fromEntries(METHODS.map((m) => [m, zero()]));
const byGenre = new Map(); // genre -> { method -> counts }
const byWord = new Map(); // word -> { n, verbs, method -> counts }
let unseen = 0;

// VETO_SWEEP=1 re-decides the held-out set across a range of RULE_VETO values.
// The constant trades verb recall for verb precision, and the right setting
// depends on the weights it sits in front of — so it has to be re-swept after
// every retrain rather than carried forward.
const SWEEP = process.env.VETO_SWEEP === '1';
const sweepRows = [];

for (const { raw, i, word, isVerb, genre } of walk(true)) {
  // Exactly what the runtime sees: lexicon tags for context, '' for the target.
  const tokens = raw.map((t, k) => ({
    word: t.word,
    tag: k === i ? '' : tagWord(t.word),
    breakAfter: t.breakAfter,
  }));

  const seen = prior.get(word);
  if (!seen) unseen++;
  // An unseen word falls back to the noun, which is the lexicon's default and
  // the safe spelling for a converter — not to a coin flip.
  // The SVM score before the veto. The plain name is taken by the token array,
  // and the two mean quite different things, so this one is spelled out.
  let rawScore = 0;
  for (const f of svmFeatures(tokens, i)) rawScore += VVZ_SVM.get(f) ?? 0;
  const pred = {
    prior: seen ? seen[1] > seen[0] : false,
    rule: is_VVZ(tokens, i),
    // Same threshold as production, so the gap to is_VVZ_svm is the VETO
    // alone. Leaving this at 0 would fold the threshold into the ablation.
    raw: rawScore > VERB_THRESHOLD,
    svm: is_VVZ_svm(tokens, i),
  };

  // Retained only for the veto sweep, which has to re-decide every target at
  // many constants and cannot afford a second pass over 800 MB of corpus. The
  // three values are exactly what is_VVZ_svm consumes, so replaying them
  // reproduces it rather than approximating it.
  if (SWEEP) sweepRows.push([isVerb, rawScore, vvzScore(tokens, i), endsIsolatedNounPhrase(tokens, i)]);

  let g = byGenre.get(genre);
  if (!g) byGenre.set(genre, (g = Object.fromEntries(METHODS.map((m) => [m, zero()]))));
  let w = byWord.get(word);
  if (!w) byWord.set(word, (w = { n: 0, verbs: 0, ...Object.fromEntries(METHODS.map((m) => [m, zero()])) }));
  w.n++;
  if (isVerb) w.verbs++;

  for (const m of METHODS) {
    const k = pred[m] ? (isVerb ? 'tp' : 'fp') : isVerb ? 'fn' : 'tn';
    overall[m][k]++;
    g[m][k]++;
    w[m][k]++;
  }
}

// --- report -------------------------------------------------------------------
const pct = (x) => (100 * x).toFixed(1).padStart(5);
const n_ = (s) => s.tp + s.fp + s.tn + s.fn;
const acc = (s) => (s.tp + s.tn) / n_(s);
const prec = (s) => (s.tp + s.fp ? s.tp / (s.tp + s.fp) : NaN);
const rec = (s) => (s.tp + s.fn ? s.tp / (s.tp + s.fn) : NaN);
const or_ = (x) => (Number.isNaN(x) ? '    — ' : pct(x));

const N = n_(overall.rule);
const verbs = overall.rule.tp + overall.rule.fn;
const globalMaj = Math.max(verbs, N - verbs) / N;

console.log(`NN2|VVZ, held-out fifth of ${SOURCES.length} corpus file(s)`);
console.log(
  `${N.toLocaleString()} targets over ${byWord.size.toLocaleString()} word forms  ` +
    `(${targets.size.toLocaleString()} in the lexicon at 012/112)`
);
console.log(
  `gold VVZ ${verbs.toLocaleString()} (${pct(verbs / N).trim()}%)   ` +
    `gold NN2 ${(N - verbs).toLocaleString()} (${pct((N - verbs) / N).trim()}%)   ` +
    `unseen in train ${unseen.toLocaleString()}\n`
);

const LABEL = {
  prior: 'per-word prior (train)',
  rule: 'is_VVZ (hand rule)',
  raw: 'SVM alone (no veto)',
  svm: 'is_VVZ_svm (production)',
};
console.log('method'.padEnd(25), 'acc'.padStart(6), 'gain'.padStart(6), 'verbP'.padStart(6), 'verbR'.padStart(6));
console.log('global majority'.padEnd(25), pct(globalMaj), '     —', '     —', '     —');
for (const m of METHODS) {
  const s = overall[m];
  const g = (acc(s) - globalMaj) * 100;
  console.log(
    LABEL[m].padEnd(25),
    pct(acc(s)),
    ((g >= 0 ? '+' : '') + g.toFixed(1)).padStart(6),
    or_(prec(s)),
    or_(rec(s))
  );
}

// The line the paper turns on: context is only worth reporting to the extent it
// beats the lookup table, so state that step explicitly rather than leaving a
// reader to subtract it from the global-majority row.
const a = acc(overall.prior);
console.log('\nover the per-word prior — the headroom a context model has to win:');
for (const m of ['rule', 'raw', 'svm']) {
  const b = acc(overall[m]);
  const red = ((b - a) / (1 - a)) * 100;
  console.log(
    `  ${LABEL[m].padEnd(25)} ${((b - a) * 100 >= 0 ? '+' : '') + ((b - a) * 100).toFixed(1)} pt   ` +
      `${red >= 0 ? 'error reduction' : 'error INCREASE'} ${Math.abs(red).toFixed(1)}%`
  );
}

console.log('\nper genre:');
for (const [genre, ms] of byGenre) {
  const parts = METHODS.map((m) => `${m} ${pct(acc(ms[m])).trim()}`).join('  ');
  console.log(`  ${genre.padEnd(4)} n=${String(n_(ms.rule)).padStart(7)}  ${parts}`);
}

console.log(`\nper word, top ${TOP} by held-out frequency:`);
console.log(
  'word'.padEnd(14),
  'n'.padStart(7),
  'VVZ%'.padStart(6),
  'prior'.padStart(6),
  'rule'.padStart(6),
  'svm'.padStart(6),
  'svm-prior'.padStart(10)
);
const rows = [...byWord.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, TOP);
for (const [word, w] of rows) {
  const d = (acc(w.svm) - acc(w.prior)) * 100;
  console.log(
    word.padEnd(14),
    String(w.n).padStart(7),
    pct(w.verbs / w.n),
    pct(acc(w.prior)),
    pct(acc(w.rule)),
    pct(acc(w.svm)),
    ((d >= 0 ? '+' : '') + d.toFixed(1)).padStart(10)
  );
}

// Where the learned model actually pays for itself. A word the prior already
// gets right is not evidence for context; a word it gets wrong is.
const helped = [...byWord.entries()]
  .filter(([, w]) => w.n >= 100)
  .map(([word, w]) => [word, w, (acc(w.svm) - acc(w.prior)) * 100]);
helped.sort((x, y) => y[2] - x[2]);
const line = ([word, w, d]) =>
  console.log(
    `  ${word.padEnd(14)} n=${String(w.n).padStart(6)}  VVZ ${pct(w.verbs / w.n)}%  ` +
      `prior ${pct(acc(w.prior))}  svm ${pct(acc(w.svm))}  ${(d >= 0 ? '+' : '') + d.toFixed(1)}`
  );
console.log('\nwhere context earns its place (n >= 100), best 10 by svm - prior:');
helped.slice(0, 10).forEach(line);
console.log('\nwhere it costs (n >= 100), worst 10:');
helped.slice(-10).reverse().forEach(line);

// The veto's whole contribution, stated as a delta rather than left to the
// reader to subtract two rows. RULE_VETO is a constant tuned against one set of
// weights and does not retune itself when they are regenerated, so this line is
// the thing to check after any retrain: it should buy precision at a small
// accuracy cost, and if it stops doing that the constant has drifted.
{
  const r = overall.raw;
  const v = overall.svm;
  const d = (acc(v) - acc(r)) * 100;
  console.log(
    `\nrule veto (RULE_VETO=${RULE_VETO}), SVM alone -> blended:  ` +
      `acc ${(d >= 0 ? '+' : '') + d.toFixed(2)} pt   ` +
      `verbP ${pct(prec(r)).trim()} -> ${pct(prec(v)).trim()}   ` +
      `verbR ${pct(rec(r)).trim()} -> ${pct(rec(v)).trim()}`
  );
}

console.log(`\nconfusion (is_VVZ_svm): tp ${overall.svm.tp}  fp ${overall.svm.fp}  tn ${overall.svm.tn}  fn ${overall.svm.fn}`);

if (SWEEP) {
  // veto = 0 is the SVM alone; larger values let the rule's noun evidence veto
  // progressively more of the model's verb confidence. Accuracy peaks near 0
  // and falls away slowly; precision climbs the whole time. The choice is not
  // "highest accuracy" — it is the most precision buyable inside an accuracy
  // budget, because for a converter a false verb is the visible error and the
  // noun spelling is the safe default.
  console.log('\nRULE_VETO sweep (held-out; veto=0 is the SVM alone):');
  console.log('  veto'.padEnd(9), 'acc'.padStart(7), 'verbP'.padStart(7), 'verbR'.padStart(7), 'acc cost'.padStart(9));
  let base = null;
  for (const veto of [0, 0.04, 0.08, 0.12, 0.16, 0.2, 0.25, 0.3, 0.4, 0.5, 0.7, 1]) {
    const s = zero();
    for (const [isVerb, raw, rule, isolated] of sweepRows) {
      const pred = isolated ? false : raw + veto * Math.min(0, rule) > 0;
      s[pred ? (isVerb ? 'tp' : 'fp') : isVerb ? 'fn' : 'tn']++;
    }
    if (base === null) base = acc(s);
    const cost = (acc(s) - base) * 100;
    console.log(
      `  ${String(veto).padEnd(7)}`,
      pct(acc(s)),
      or_(prec(s)),
      or_(rec(s)),
      ((cost >= 0 ? '+' : '') + cost.toFixed(2)).padStart(9)
    );
  }
}
