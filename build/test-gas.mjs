// Validates apps-script/euspell-engine.gs against ground truth from the real JS
// engine (libreoffice/tests/fixtures.tsv). Loads the .gs in a global VM context
// with the data globals set, then compares Euspell.convertText to each fixture.
//
// Run: node build/test-gas.mjs   (needs `npm run gen:lo` data + fixtures.tsv)
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = join(root, 'libreoffice', 'euspell', 'data');

globalThis.EUSPELL_LEXICON_CSV = readFileSync(join(data, 'lexicon.csv'), 'utf8');
globalThis.EUSPELL_ABBR_CSV = readFileSync(join(data, 'abbreviations.csv'), 'utf8');
globalThis.EUSPELL_CONTR_CSV = readFileSync(join(data, 'contractions.csv'), 'utf8');
globalThis.EUSPELL_SVM_TSV = readFileSync(join(data, 'vvz_svm.tsv'), 'utf8');

vm.runInThisContext(readFileSync(join(root, 'apps-script', 'euspell-engine.gs'), 'utf8'));
const { Euspell } = globalThis;

const fixtures = readFileSync(join(root, 'libreoffice', 'tests', 'fixtures.tsv'), 'utf8')
  .split('\n').filter(Boolean)
  .map((l) => { const i = l.indexOf('\t'); return [l.slice(0, i), l.slice(i + 1)]; });

let fail = 0;
for (const [src, expected] of fixtures) {
  const got = Euspell.convertText(src);
  const ok = got === expected;
  if (!ok) { fail++; console.log('FAIL', JSON.stringify(src), '\n   expected', JSON.stringify(expected), '\n   got     ', JSON.stringify(got)); }
}

// The lexicon's headwords, parsed from the same CSV the engine reads. The Python
// port asks engine._LEXICON for this; the .gs closes over its map, and widening
// the engine's public surface for a test's benefit is the worse trade, so the
// CSV is read a second time here.
const HEADWORDS = new Set(
  EUSPELL_LEXICON_CSV.split('\n').map((l) => l.split(',')[0]).filter(Boolean),
);

/**
 * True when every word revert failed to restore is itself a headword — the
 * shape revert declines on purpose. Mirrors _blocked_by_collision in
 * libreoffice/tests/test_engine.py.
 */
function blockedByCollision(src, euspell, back) {
  const a = src.split(/\s+/), b = euspell.split(/\s+/), c = back.split(/\s+/);
  const n = Math.min(a.length, b.length, c.length); // zip(): stop at the shortest
  for (let i = 0; i < n; i++) {
    if (c[i] === a[i]) continue;
    const key = b[i].replace(/^[.,;:!?"']+|[.,;:!?"']+$/g, '').toLowerCase();
    if (!HEADWORDS.has(key)) return false;
  }
  return true;
}

// Round-trip: reverting the euspell output recovers the original text. (These
// curated fixtures avoid the British/American variants where reverse normalizes.)
// EXCEPT across a collision, where the euspelling is a headword in its own right:
// "rough" reforms to "ruff", and "ruff" is also a word, so revert leaves it —
// turning a genuine ruff into a rough is the worse error. Such fixtures are
// counted separately rather than failed, since the shortfall is in the reform and
// not in this port; the Python port counts them the same way.
let rfail = 0;
const collided = [];
for (const [src, expected] of fixtures) {
  const back = Euspell.revertText(expected);
  if (back === src) continue;
  if (blockedByCollision(src, expected, back)) { collided.push(expected); continue; }
  rfail++;
  console.log('REVERT FAIL', JSON.stringify(expected), '\n   expected', JSON.stringify(src), '\n   got     ', JSON.stringify(back));
}
console.log(`round-trip revert: ${fixtures.length - rfail - collided.length}/${fixtures.length} `
  + `recover the original, ${collided.length} blocked by a collision`);

// American-consistent revert: convert -> revert never flips an American spelling
// to British.
let afail = 0;
for (const w of ['organizes', 'colors', 'acknowledgment', 'judgment', 'defenses', 'catalog', 'center', 'theater', 'meter']) {
  if (Euspell.revertText(Euspell.convertText(w)) !== w) { afail++; console.log('AMERICAN FAIL', w, '->', Euspell.revertText(Euspell.convertText(w))); }
}
// revert is the inverse of convert, EXCEPT across a collision: where the
// euspelling is itself a headword, revert cannot know which word produced it and
// leaves it alone. "rough" reforms to "ruff", but "ruff" is also a real word (the
// collar, the bird), so "ruff" stays "ruff". "door" -> "dorr" is the same shape:
// dorr is the beetle. Both rows were re-encoded 101 -> 601 on 14 Aug 2026 so that
// revert would decline them; before that they mapped back, quietly turning a
// beetle into a door. By design, not a gap — and asserted identically in
// libreoffice/tests/test_engine.py, which is the point of running both.
//
// This check read the other way round until 27 Aug 2026, having been written on
// 30 June when reverting them WAS the policy. It went on asserting the
// superseded intent for the thirteen days between the two.
const collisionChecks = [
  ['The niht was ruff.', 'The night was ruff.'], // the rest of the sentence still reverts
  ['ruff', 'ruff'],
  ['dorr', 'dorr'],
];
for (const [input, want] of collisionChecks) {
  const got = Euspell.revertText(input);
  if (got !== want) { afail++; console.log('COLLISION-REVERT FAIL', JSON.stringify(input), '\n   expected', JSON.stringify(want), '\n   got     ', JSON.stringify(got)); }
}
console.log(`american-consistent revert: ${afail === 0 ? 'pass' : `${afail} FAILED`}`);

// Word-level candidates (parity with the Python port's checks).
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const checks = [
  ['above', ['abov']], ['records', ['records', 'recordz']], ['cat', []],
  ['Above', ['Abov']], ['are', ['ar']], ['read', ['read', 'redd']],
];
let cfail = 0;
for (const [w, exp] of checks) if (!eq(Euspell.wordCandidates(w), exp)) { cfail++; console.log('CAND FAIL', w, Euspell.wordCandidates(w)); }
// "read" stays a semantic homograph (left unchanged); "are" is now a plain
// single-spelling verb (encoding 101) and converts to "ar".
if (Euspell.convertText('They read it.') !== 'They read it.') { cfail++; console.log('semantic-unchanged FAIL'); }
if (Euspell.convertText('They are here.') !== 'They ar here.') { cfail++; console.log('are-conversion FAIL'); }

console.log(`\nGAS engine: ${fixtures.length - fail}/${fixtures.length} fixtures pass; candidate checks ${cfail ? `${cfail} FAILED` : 'pass'}`);
process.exit(fail || cfail || rfail || afail ? 1 : 0);
