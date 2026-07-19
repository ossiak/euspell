// Emits src/disambig/vv0-prior.js: a per-word bias for the POS-heteronym
// decision (is_verb_VV0), learned from the CLAWS-tagged corpus.
//
// WHY. The context rule (vv0Score) has no per-word bias at all — it applies one
// noun-first default to every word, chosen to match the lexicon's spelling
// order. Measured on the corpus, that single default is the rule's dominant
// error source: 75% of its mistakes are vote == 0, i.e. no contextual evidence
// either way. The default is right for a noun-dominant word ("mouth" is 99.8%
// noun) and badly wrong for a verb-dominant one ("live" is 87.6% verb, where
// the rule scored 46.7% — worse than always guessing). This supplies the
// missing per-word term.
//
// WHAT. A word listed here defaults to the VERB reading when the context vote
// is exactly zero — no evidence either way — instead of the global noun-first
// default. Context still decides whenever it has any opinion at all.
//
// WHY ONLY ON A ZERO VOTE. Adding a scaled bias to the vote instead scores
// better in aggregate (90.6% vs 86.5% held out) and is the wrong trade: a bias
// big enough to fix "live" (+4.4) also outweighs a determiner's -4, so "the
// live broadcast" and "a live wire" became "liv", and a bias big enough to fix
// "house" (-10.4) made its verb reading unreachable, so "they house the
// refugees" stopped reforming. Optimising aggregate accuracy on a 99%-skewed
// word amounts to always predicting the majority, which destroys the minority
// reading and breaks exactly the collocations a reader notices. Letting
// categorical context win is also how the NN2|VVZ model is blended, where the
// rule's negative votes veto the learned score.
//
// GATED. A word is listed ONLY where the verb default beats the noun default on
// the training split, because the balance differs sharply by word — for "use"
// the context rule is already far better than the base rate (80.9% vs 65.2%),
// while for "live" context is nearly useless and the base rate is everything.
// A word absent from the set keeps the noun-first default. That per-word
// variance is also the clearest argument for eventually fitting word and
// context weights jointly, as the NN2|VVZ SVM does.
//
// SPLIT. Base rates, the scale sweep, and the gate are all fitted on the
// TRAINING four-fifths (line index % 5 != 0), leaving the held-out fifth a
// genuine test set — the same split build/gen-vvz-svm.py and build/rule-vv0.mjs
// use, so the rule, this prior, and any future model are all comparable.
//
// Run: npm run gen:vv0-prior     (needs npm run gen:corpus:vv0 first)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vv0Score } from '../src/disambig/pos.js';
import { tagWord } from '../src/content/tagger.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENC = process.argv[2] || '152';
const OUT = path.join(ROOT, 'src', 'disambig', 'vv0-prior.js');

const files = [
  path.join(ROOT, 'disambig', `_corpus_vv0_${ENC}.txt`),
  path.join(ROOT, 'disambig', `_corpus_vv0_${ENC}_nf.txt`),
].filter((f) => fs.existsSync(f));
if (!files.length) throw new Error(`no corpus — run "npm run gen:corpus:vv0" first`);

const targets = new Set(
  fs
    .readFileSync(path.join(ROOT, 'data', 'euspell_lexicon.csv'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, '').split(','))
    .filter((c) => c[2] === ENC)
    .map((c) => c[0].toLowerCase())
);

const VERB = new Set(['VV0', 'VVI']); // "to separate" is VVI — also the verb reading
const NOUNADJ = new Set(['NN1', 'NN', 'JJ']);
const BREAK = new Set(['.', '!', '?']);

// Score every labelled occurrence once; the tagWord pass is the expensive part.
const train = [];
const test = [];
let lineNo = 0;
for (const f of files) {
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const held = lineNo++ % 5 === 0;
    const raw = [];
    for (const tk of line.split(/\s+/)) {
      const i = tk.lastIndexOf('_');
      if (i <= 0) continue;
      const w = tk.slice(0, i);
      raw.push({ word: w, gold: tk.slice(i + 1), breakAfter: BREAK.has(w) });
    }
    for (let i = 0; i < raw.length; i++) {
      const w = raw[i].word.toLowerCase();
      if (!targets.has(w)) continue;
      const isVerb = VERB.has(raw[i].gold);
      if (!isVerb && !NOUNADJ.has(raw[i].gold)) continue;
      // The runtime's own view: candidate tags for context, '' for the target.
      const tokens = raw.map((t, k) => ({
        word: t.word,
        tag: k === i ? '' : tagWord(t.word),
        breakAfter: t.breakAfter,
      }));
      (held ? test : train).push({ w, vote: vv0Score(tokens, i), isVerb });
    }
  }
}

// Base rates, Laplace-smoothed so a word seen in only one reading gets a large
// but finite bias rather than an infinite one.
const counts = new Map();
for (const r of train) {
  let c = counts.get(r.w);
  if (!c) counts.set(r.w, (c = { v: 0, n: 0 }));
  if (r.isVerb) c.v++;
  else c.n++;
}
const pVerb = new Map();
for (const [w, c] of counts) pVerb.set(w, (c.v + 1) / (c.v + c.n + 2));

const acc = (rows, predict) => {
  let ok = 0;
  for (const r of rows) if (predict(r) === r.isVerb) ok++;
  return rows.length ? ok / rows.length : 0;
};
const rule = (r) => r.vote > 0;
// Tie-break semantics: context decides unless it is silent.
const withSet = (set) => (r) => (r.vote === 0 ? set.has(r.w) : r.vote > 0);

// Gate per word on TRAIN: list a word only where defaulting its zero-vote cases
// to the verb reading beats leaving them noun.
const chosen = new Set();
for (const [w] of pVerb) {
  const ties = train.filter((r) => r.w === w && r.vote === 0);
  if (!ties.length) continue;
  const asVerb = ties.filter((r) => r.isVerb).length;
  if (asVerb * 2 > ties.length) chosen.add(w); // strictly better than noun
}

const pc = (x) => (x * 100).toFixed(1);
const final = withSet(chosen);
console.log(`[gen-vv0-prior] encoding ${ENC}: train ${train.length.toLocaleString()}, held-out ${test.length.toLocaleString()}`);
console.log(`[gen-vv0-prior] ${chosen.size} of ${pVerb.size} words default to the verb on a zero vote`);
console.log(`[gen-vv0-prior] held-out accuracy: rule ${pc(acc(test, rule))}% -> with default ${pc(acc(test, final))}%`);

const rows = [...chosen].sort();
const body = `// GENERATED by build/gen-vv0-prior.mjs — do not edit.
//
// Words whose POS-heteronym decision defaults to the VERB reading when the
// context vote is exactly zero (see is_verb_VV0 in pos.js). Every other word —
// and every case where context has any opinion at all — keeps the global
// noun-first default.
//
// Learned from the CLAWS-tagged corpus on the training four-fifths, and listed
// only where the verb default beats the noun default on that split. See the
// generator's header for why the prior is applied only on a zero vote rather
// than as a bias added to the vote.
//
// encoding ${ENC} | ${chosen.size} of ${pVerb.size} words
// held-out accuracy: rule ${pc(acc(test, rule))}% -> with default ${pc(acc(test, final))}%
export const VV0_VERB_DEFAULT = new Set([
${rows.map((w) => `  ${JSON.stringify(w)},`).join('\n')}
]);
`;
fs.writeFileSync(OUT, body, 'utf8');
console.log(`[gen-vv0-prior] wrote ${path.relative(ROOT, OUT)} (${chosen.size} entries)`);
for (const w of rows) {
  const ties = train.filter((r) => r.w === w && r.vote === 0);
  const v = ties.filter((r) => r.isVerb).length;
  console.log(`   ${w.padEnd(11)} p(verb) ${pc(pVerb.get(w)).padStart(5)}%   zero-vote cases ${String(ties.length).padStart(6)}, verb ${pc(v / ties.length).padStart(5)}%`);
}
