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

// Word-level candidates (parity with the Python port's checks).
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const checks = [
  ['above', ['abov']], ['records', ['records', 'recordz']], ['cat', []],
  ['Above', ['Abov']], ['are', ['are', 'ar']], ['read', ['read', 'redd']],
];
let cfail = 0;
for (const [w, exp] of checks) if (!eq(Euspell.wordCandidates(w), exp)) { cfail++; console.log('CAND FAIL', w, Euspell.wordCandidates(w)); }
if (Euspell.convertText('They are here.') !== 'They are here.') { cfail++; console.log('semantic-unchanged FAIL'); }

console.log(`\nGAS engine: ${fixtures.length - fail}/${fixtures.length} fixtures pass; candidate checks ${cfail ? cfail + ' FAILED' : 'pass'}`);
process.exit(fail || cfail ? 1 : 0);
