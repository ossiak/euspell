// The NN2|VVZ decision measured on the NATURAL distribution of the same books,
// rather than on the class-enriched extraction that training and section 2 use.
//
// Why this exists. disambig/_corpus_012_112*.txt were assembled from separate
// per-class pools (../CLAWS-tagged-data/corpus/all_NN2_f.txt, all_VVZ_f.txt and
// the per-word pairs beside them), which leaves them about seven times
// verb-enriched relative to the books they came from:
//
//   corpus/txt      raw tagged fiction        8.6% verb
//   corpusNF/txt    raw tagged non-fiction   15.4% verb
//   _corpus_012_112.txt     (extracted)     61.2% verb
//   _corpus_012_112_nf.txt  (extracted)     44.7% verb
//
// Enriching TRAINING data for a class this skewed is a reasonable choice. The
// problem is that the same file is then split 80/20, so the evaluation inherited
// the enrichment: every baseline in the results section — "always the commoner
// class" at 52.8%, the per-word prior at 88.8% — describes a constructed set
// rather than running text. This harness re-measures on running text.
//
// Leakage. The natural extraction re-reads the same books, so most sentences in
// the enriched corpus turn up again here. Every sentence in the enriched
// TRAINING portion is therefore hashed and skipped; the held-out fifth's
// sentences are kept, having never been trained on.
//
// Two priors, as in build/shift-vvz.mjs. The enriched-fit prior is the lookup
// table you would actually ship if you built one from the training corpus; the
// natural-fit prior is one fitted on running text. The gap between them is what
// the enrichment costs a frequency table.
//
// Run: npm run eval:natural          (MAX_FILES=200 for a quick pass)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
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
const CLAWS = path.resolve(ROOT, '..', 'CLAWS-tagged-data');
const MAX_FILES = Number(process.env.MAX_FILES ?? 0);

const SOURCES = [
  ['fic', path.join(CLAWS, 'corpus', 'txt')],
  ['nf', path.join(CLAWS, 'corpusNF', 'txt')],
].filter(([, d]) => fs.existsSync(d));
const ENRICHED = [
  path.join(ROOT, 'disambig', '_corpus_012_112.txt'),
  path.join(ROOT, 'disambig', '_corpus_012_112_nf.txt'),
].filter((f) => fs.existsSync(f));

const targets = new Set(
  fs
    .readFileSync(path.join(ROOT, 'data', 'euspell_lexicon.csv'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, '').split(','))
    .filter((c) => c[2] === '012' || c[2] === '112')
    .map((c) => c[0].toLowerCase())
);

const BREAK = new Set(['.', '!', '?']);
const key = (line) => crypto.createHash('md5').update(line.trim()).digest('hex');

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

// --- what the model was trained on: hashes to skip, and the prior it implies --
process.stderr.write('reading the enriched corpora… ');
const trained = new Set();
const enrichedPrior = new Map();
{
  let lineNo = 0;
  for (const file of ENRICHED) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    for (const line of lines) {
      const held = lineNo++ % 5 === 0;
      if (held || !line.trim()) continue;
      trained.add(key(line));
      for (const tk of line.split(/\s+/)) {
        const i = tk.lastIndexOf('_');
        if (i <= 0) continue;
        const w = tk.slice(0, i).toLowerCase();
        const gold = tk.slice(i + 1);
        if ((gold !== 'NN2' && gold !== 'VVZ') || !targets.has(w)) continue;
        let c = enrichedPrior.get(w);
        if (!c) enrichedPrior.set(w, (c = [0, 0]));
        c[gold === 'VVZ' ? 1 : 0]++;
      }
    }
  }
}
process.stderr.write(`${trained.size.toLocaleString()} training sentences to exclude\n`);

// --- one streaming pass over the raw books ------------------------------------
// Only the test fifth is scored; the other four fifths just tally per-word gold
// counts, which is all the natural prior needs. That keeps the expensive part
// (featurizing and running the model) to 20% of the corpus.
const zero = () => ({ tp: 0, fp: 0, tn: 0, fn: 0 });
const METHODS = ['eprior', 'nprior', 'rule', 'raw', 'svm'];
const all = Object.fromEntries(METHODS.map((m) => [m, zero()]));
const byGenre = new Map();
const naturalTrain = new Map(); // word -> [nn2, vvz] over the four fifths
const testTally = new Map(); // word -> [nn2, vvz] over the scored fifth
let sentences = 0;
let skipped = 0;
let scored = 0;

// Score histogram for the threshold sweep. STEP is fine enough to place the
// threshold precisely; BINS clamps the tails, which carry almost nothing.
const STEP = 0.05;
const BINS = 200;
const hist = new Map(); // bin -> [nn2, vvz]
const isoTally = [0, 0]; // short-circuited to noun whatever the threshold

for (const [genre, dir] of SOURCES) {
  let files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.join(dir, e.name))
    .sort();
  if (MAX_FILES) files = files.slice(0, MAX_FILES);
  process.stderr.write(`${genre}: ${files.length} files\n`);

  let lineNo = 0;
  let done = 0;
  for (const file of files) {
    const rl = readline.createInterface({
      input: fs.createReadStream(file, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line.trim()) continue;
      const raw = parse(line);
      let hasTarget = false;
      for (const t of raw) {
        if (targets.has(t.word.toLowerCase()) && (t.gold === 'NN2' || t.gold === 'VVZ')) {
          hasTarget = true;
          break;
        }
      }
      if (!hasTarget) continue;
      sentences++;
      if (trained.has(key(line))) {
        skipped++;
        continue;
      }
      const held = lineNo++ % 5 === 0;

      for (let i = 0; i < raw.length; i++) {
        const word = raw[i].word.toLowerCase();
        if (!targets.has(word)) continue;
        const { gold } = raw[i];
        if (gold !== 'NN2' && gold !== 'VVZ') continue;
        const isVerb = gold === 'VVZ';

        if (!held) {
          let c = naturalTrain.get(word);
          if (!c) naturalTrain.set(word, (c = [0, 0]));
          c[isVerb ? 1 : 0]++;
          continue; // the four fifths are only here to fit the prior
        }

        let c = testTally.get(word);
        if (!c) testTally.set(word, (c = [0, 0]));
        c[isVerb ? 1 : 0]++;

        const tokens = raw.map((t, k) => ({
          word: t.word,
          tag: k === i ? '' : tagWord(t.word),
          breakAfter: t.breakAfter,
        }));
        let rawScore = 0;
        for (const f of svmFeatures(tokens, i)) rawScore += VVZ_SVM.get(f) ?? 0;

        // Histogram the blended score so the decision threshold can be swept
        // afterwards without a second pass over 3.6 GB. The model was fitted on
        // a corpus that is 52.8% verb and is being asked about text that is
        // 2.6% verb, so its threshold is calibrated for the wrong base rate —
        // this is what says how much of that is recoverable by moving it.
        const isolated = endsIsolatedNounPhrase(tokens, i);
        if (isolated) isoTally[isVerb ? 1 : 0]++;
        else {
          const blended = rawScore + RULE_VETO * Math.min(0, vvzScore(tokens, i));
          const bin = Math.max(-BINS, Math.min(BINS, Math.round(blended / STEP)));
          let h = hist.get(bin);
          if (!h) hist.set(bin, (h = [0, 0]));
          h[isVerb ? 1 : 0]++;
        }

        const e = enrichedPrior.get(word);
        const pred = {
          eprior: e ? e[1] > e[0] : false,
          nprior: false, // filled in below, once the natural prior is complete
          rule: is_VVZ(tokens, i),
          // Same threshold as production, so the gap to is_VVZ_svm is the VETO
    // alone. Leaving this at 0 would fold the threshold into the ablation.
    raw: rawScore > VERB_THRESHOLD,
          svm: is_VVZ_svm(tokens, i),
        };

        let g = byGenre.get(genre);
        if (!g) byGenre.set(genre, (g = Object.fromEntries(METHODS.map((m) => [m, zero()]))));
        for (const m of ['eprior', 'rule', 'raw', 'svm']) {
          const k = pred[m] ? (isVerb ? 'tp' : 'fp') : isVerb ? 'fn' : 'tn';
          all[m][k]++;
          g[m][k]++;
        }
        scored++;
      }
    }
    if (++done % 500 === 0) process.stderr.write(`  ${genre} ${done}/${files.length}\n`);
  }
}

// The natural prior is a constant per word, so its confusion follows from the
// test tallies and the fitted direction — no second pass over the corpus.
for (const [word, [nn2, vvz]] of testTally) {
  const f = naturalTrain.get(word);
  const saysVerb = f ? f[1] > f[0] : false;
  if (saysVerb) {
    all.nprior.tp += vvz;
    all.nprior.fp += nn2;
  } else {
    all.nprior.fn += vvz;
    all.nprior.tn += nn2;
  }
}

// --- report --------------------------------------------------------------------
const pct = (x) => (100 * x).toFixed(1).padStart(5);
const n_ = (s) => s.tp + s.fp + s.tn + s.fn;
const acc = (s) => (s.tp + s.tn) / n_(s);
const prec = (s) => (s.tp + s.fp ? s.tp / (s.tp + s.fp) : NaN);
const rec = (s) => (s.tp + s.fn ? s.tp / (s.tp + s.fn) : NaN);
const or_ = (x) => (Number.isNaN(x) ? '    — ' : pct(x));

const N = n_(all.rule);
const verbs = all.rule.tp + all.rule.fn;
const maj = Math.max(verbs, N - verbs) / N;

console.log('\nNATURAL DISTRIBUTION: the same books, without the per-class enrichment\n');
console.log(`  ${sentences.toLocaleString()} target-bearing sentences found, ${skipped.toLocaleString()} skipped as training text`);
console.log(`  ${N.toLocaleString()} scored targets over ${testTally.size.toLocaleString()} word forms`);
console.log(
  `  gold VVZ ${verbs.toLocaleString()} (${pct(verbs / N).trim()}%)   gold NN2 ${(N - verbs).toLocaleString()} (${pct((N - verbs) / N).trim()}%)`
);
console.log(`  the enriched corpus this replaces ran 52.8% verb\n`);

const LABEL = {
  eprior: 'per-word prior (enriched fit)',
  nprior: 'per-word prior (natural fit)',
  rule: 'is_VVZ (hand rule)',
  raw: 'SVM alone (no veto)',
  svm: 'is_VVZ_svm (production)',
};
// At this class balance accuracy is almost uninformative — "always noun" already
// scores in the high nineties — so verb F1 leads, and a converter-facing error
// rate sits beside it. Errors are counted per 10,000 targets rather than as a
// percentage because that is the scale a reader meets them at.
const f1 = (s) => {
  const p = prec(s);
  const r = rec(s);
  return p + r ? (2 * p * r) / (p + r) : NaN;
};
const per10k = (s) => (((s.fp + s.fn) / n_(s)) * 10000).toFixed(0);

console.log(
  'method'.padEnd(32),
  'verb F1'.padStart(8),
  'verbP'.padStart(6),
  'verbR'.padStart(6),
  'acc'.padStart(6),
  'err/10k'.padStart(8)
);
console.log('always the commoner class'.padEnd(32), '    0.0', '     —', '     —', pct(maj), String(Math.round((Math.min(verbs, N - verbs) / N) * 10000)).padStart(8));
for (const m of METHODS) {
  const s = all[m];
  console.log(
    LABEL[m].padEnd(32),
    (Number.isNaN(f1(s)) ? '     — ' : (100 * f1(s)).toFixed(1).padStart(7)),
    or_(prec(s)),
    or_(rec(s)),
    pct(acc(s)),
    per10k(s).padStart(8)
  );
}

const red = (from, to) => `${(((to - from) / (1 - from)) * 100).toFixed(1)}%`;
console.log('\nby verb F1 — the metric that survives a 97% majority class:');
console.log(`  natural-fit prior  ${(100 * f1(all.nprior)).toFixed(1)}      shipped  ${(100 * f1(all.svm)).toFixed(1)}`);
console.log('\nby accuracy, for comparison with the enriched numbers:');
console.log(`  error reduction vs always the commoner class (${pct(maj).trim()}%)   ${red(maj, acc(all.svm))}`);
console.log(`  error reduction vs the natural-fit prior (${pct(acc(all.nprior)).trim()}%)       ${red(acc(all.nprior), acc(all.svm))}`);
console.log('  the same figure on the enriched corpus was 44.9%');

console.log('\nwhat the enrichment costs a frequency table:');
console.log(
  `  prior fitted on the enriched corpus ${pct(acc(all.eprior))}   vs fitted on running text ${pct(acc(all.nprior))}` +
    `   (${((acc(all.nprior) - acc(all.eprior)) * 100).toFixed(1)} pt)`
);

console.log('\nper genre:');
for (const [genre, ms] of byGenre) {
  const cells = METHODS.filter((m) => m !== 'nprior')
    .map((m) => `${m} ${pct(acc(ms[m])).trim()}`)
    .join('  ');
  console.log(`  ${genre.padEnd(4)} n=${String(n_(ms.rule)).padStart(9)}  ${cells}`);
}

// --- decision-threshold sweep --------------------------------------------------
// The model is asked for a verb whenever its blended score clears zero. Zero is
// the right cut for the corpus it was fitted on; on running text, where nouns
// outnumber verbs 37 to 1, it is far too generous. Raising the threshold trades
// verb recall for verb precision — and, because a false verb is the visible
// error for a converter ("recordz" where "records" was right), that is the trade
// worth making. t = 0 reproduces the shipped row above, as a check.
{
  const bins = [...hist.entries()].sort((a, b) => a[0] - b[0]);
  const totV = bins.reduce((s, [, h]) => s + h[1], 0) + isoTally[1];
  const totN = bins.reduce((s, [, h]) => s + h[0], 0) + isoTally[0];
  console.log('\ndecision-threshold sweep on natural text (t = 0 is what ships):');
  console.log(
    '  t'.padEnd(8),
    'verb F1'.padStart(8),
    'verbP'.padStart(7),
    'verbR'.padStart(7),
    'false verbs'.padStart(12),
    'err/10k'.padStart(8)
  );
  for (const t of [-1.5, -1.35, -1.29, -1.2, -1, -0.5, 0, 0.15, 0.25, 0.5, 0.75, 1, 1.5]) {
    let tp = 0;
    let fp = 0;
    for (const [bin, h] of bins) {
      if (bin * STEP > t) {
        tp += h[1];
        fp += h[0];
      }
    }
    const fn = totV - tp;
    const p = tp + fp ? tp / (tp + fp) : NaN;
    const r = tp / totV;
    const F = p + r ? (2 * p * r) / (p + r) : NaN;
    console.log(
      `  ${t.toFixed(2).padEnd(6)}`,
      (100 * F).toFixed(1).padStart(8),
      (100 * p).toFixed(1).padStart(7),
      (100 * r).toFixed(1).padStart(7),
      fp.toLocaleString().padStart(12),
      (((fp + fn) / (totV + totN)) * 10000).toFixed(0).padStart(8)
    );
  }
  console.log(`  (${isoTally[0] + isoTally[1]} targets short-circuit to the noun before the threshold applies)`);
}

console.log(`\nconfusion (is_VVZ_svm): tp ${all.svm.tp}  fp ${all.svm.fp}  tn ${all.svm.tn}  fn ${all.svm.fn}`);
console.log(`false verbs are ${((100 * all.svm.fp) / (N - verbs)).toFixed(2)}% of all nouns\n`);
