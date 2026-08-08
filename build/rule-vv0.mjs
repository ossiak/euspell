// Measures the hand-written POS-heteronym rule (is_verb_VV0) against the
// CLAWS-tagged corpus, per word. The companion of build/gen-vvz-svm.py's probe
// for the NN2|VVZ decision — and the baseline any learned replacement has to beat.
//
// Faithfulness matters more than convenience here, so the harness scores the
// REAL runtime function on the token representation the runtime actually sees:
//   - neighbour tags come from the LEXICON candidate set (tagWord), never from
//     the corpus gold tag, because that is all the runtime has at conversion
//     time. Scoring against gold neighbour tags would flatter the rule.
//   - the target's own tag is '' , as convert() passes it.
//   - the corpus gold tag is used ONLY as the label.
//
// Labels: VV0|VVI = verb (both take the full-vowel spelling: "to separate" is
// VVI), NN1|NN|JJ = noun/adjective. Anything else is skipped.
//
// Reported per word, because aggregate accuracy is meaningless on a class this
// imbalanced ("house" is ~99% noun, so always-noun already scores 99%): each
// row shows the majority-class baseline next to the rule, and precision/recall
// on the VERB reading, which is what the rule has to earn.
//
// Run: npm run eval:vv0          (needs npm run gen:corpus:vv0 first)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { is_verb_VV0 } from '../src/disambig/pos.js';
import { tagWord } from '../src/content/tagger.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENC = process.argv[2] || '152';
const ONLY = process.argv.slice(3).map((w) => w.toLowerCase());

const files = [
  path.join(ROOT, 'disambig', `_corpus_vv0_${ENC}.txt`),
  path.join(ROOT, 'disambig', `_corpus_vv0_${ENC}_nf.txt`),
].filter((f) => fs.existsSync(f));
if (!files.length) throw new Error(`no corpus — run "node build/gen-corpus-vv0.mjs ${ENC}" first`);

const targets = new Set(
  fs
    .readFileSync(path.join(ROOT, 'data', 'euspell_lexicon.csv'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, '').split(','))
    .filter((c) => c[2] === ENC)
    .map((c) => c[0].toLowerCase())
    .filter((w) => !ONLY.length || ONLY.includes(w))
);

const VERB = new Set(['VV0', 'VVI']);
const NOUNADJ = new Set(['NN1', 'NN', 'JJ']);
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

// word -> confusion counts. tp/fn are on the VERB class.
const stat = new Map();
const bump = (w, k) => {
  let s = stat.get(w);
  if (!s) stat.set(w, (s = { tp: 0, fp: 0, tn: 0, fn: 0 }));
  s[k]++;
};

let lineNo = 0;
for (const f of files) {
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    // Held-out fifth, matching gen-vvz-svm.py's by-line split so a future model
    // and this rule are scored on exactly the same targets.
    const held = lineNo++ % 5 === 0;
    if (!held) continue;
    const raw = parse(line);
    if (!raw.length) continue;
    for (let i = 0; i < raw.length; i++) {
      const w = raw[i].word.toLowerCase();
      if (!targets.has(w)) continue;
      const gold = raw[i].gold;
      const isVerb = VERB.has(gold);
      if (!isVerb && !NOUNADJ.has(gold)) continue; // unlabelable reading
      // Build the runtime's view: candidate tags for context, '' for the target.
      const tokens = raw.map((t, k) => ({
        word: t.word,
        tag: k === i ? '' : tagWord(t.word),
        breakAfter: t.breakAfter,
      }));
      const pred = is_verb_VV0(tokens, i);
      bump(w, pred ? (isVerb ? 'tp' : 'fp') : isVerb ? 'fn' : 'tn');
    }
  }
}

const pct = (x) => (x * 100).toFixed(1).padStart(5);
const rows = [...stat.entries()].sort((a, b) => {
  const n = (s) => s.tp + s.fp + s.tn + s.fn;
  return n(b[1]) - n(a[1]);
});

console.log(`held-out fifth of ${files.length} corpus file(s), encoding ${ENC}\n`);
console.log(
  'word'.padEnd(11),
  'n'.padStart(7),
  'verb%'.padStart(6),
  'baseline'.padStart(9),
  'rule'.padStart(6),
  'gain'.padStart(6),
  ' verbP'.padStart(7),
  'verbR'.padStart(6)
);
const T = { tp: 0, fp: 0, tn: 0, fn: 0 };
for (const [w, s] of rows) {
  const n = s.tp + s.fp + s.tn + s.fn;
  const verbs = s.tp + s.fn;
  const acc = (s.tp + s.tn) / n;
  const base = Math.max(verbs, n - verbs) / n; // always-majority
  const p = s.tp + s.fp ? s.tp / (s.tp + s.fp) : NaN;
  const r = verbs ? s.tp / verbs : NaN;
  for (const k of ['tp', 'fp', 'tn', 'fn']) T[k] += s[k];
  const g = (acc - base) * 100;
  console.log(
    w.padEnd(11),
    String(n).padStart(7),
    pct(verbs / n),
    pct(base),
    pct(acc),
    (g >= 0 ? '+' : '') + g.toFixed(1).padStart(5),
    Number.isNaN(p) ? '    — ' : pct(p),
    Number.isNaN(r) ? '    — ' : pct(r)
  );
}
// Per-word majority: what a model that memorizes each word's base rate and
// ignores context entirely would score. The rule has no per-word bias at all —
// it applies one noun-first default to every word — so this is the line it must
// clear to be worth more than a lookup table.
let perWordMajority = 0;
for (const [, s] of rows) {
  const n = s.tp + s.fp + s.tn + s.fn;
  const v = s.tp + s.fn;
  perWordMajority += Math.max(v, n - v);
}

const N = T.tp + T.fp + T.tn + T.fn;
const verbs = T.tp + T.fn;
console.log(
  '\nTOTAL'.padEnd(11),
  String(N).padStart(7),
  pct(verbs / N),
  pct(Math.max(verbs, N - verbs) / N),
  pct((T.tp + T.tn) / N),
  '',
  `  verbP ${pct(T.tp / (T.tp + T.fp))}`,
  ` verbR ${pct(T.tp / verbs)}`
);
console.log(`\nconfusion: tp ${T.tp}  fp ${T.fp}  tn ${T.tn}  fn ${T.fn}`);
console.log(`\nglobal majority (always the commoner reading overall): ${pct(Math.max(verbs, N - verbs) / N)}`);
console.log(`per-word majority (base rate per word, no context):     ${pct(perWordMajority / N)}`);
console.log(`is_verb_VV0 (the current rule):                         ${pct((T.tp + T.tn) / N)}`);
