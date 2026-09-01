/**
 * Scores disambiguate_debouches against the three labelled corpora, 100
 * sentences per reading, and prints a confusion matrix.
 *
 * The corpus smoke test in tests/disambig.test.js checks only that every token
 * yields a *valid* spelling; it cannot check the right one, because the corpus
 * files carry no labels. The labels live in the filenames here, so this is the
 * harness that says whether a change to the rule helped. Companion to
 * rule-vv0.mjs and rule-clitic-s.mjs.
 *
 * The debooshehs sentences are written with their accents and are de-accented
 * here, exactly as the fixture generator does: written accented they are pinned
 * by euspell_lexicon_accents.csv and never reach the rule at all, so scoring
 * them as written would measure the map, not this file.
 *
 * Usage:  node build/rule-debouches.mjs            (matrix only)
 *         node build/rule-debouches.mjs all        (plus every misclassification)
 *         node build/rule-debouches.mjs debouqhez  (plus that row's)
 */
import fs from 'node:fs';
import { convert } from '../src/content/converter.js';
import { is_VVZ } from '../src/disambig/pos.js';
import { tagWord } from '../src/content/tagger.js';

const READINGS = ['debooshehs', 'debouqhes', 'debouqhez'];
const deaccent = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
const clean = (w) => w.toLowerCase().replace(/[.,!?;:'"]+$/, '');

function tokenize(line) {
  const toks = [];
  for (const raw of line.split(/\s+/)) {
    const [, lead, core, trail] = raw.match(/^([("'“‘]*)(.*?)([)"'”’.,;:!?]*)$/u);
    if (lead) for (const c of lead) toks.push({ word: c, tag: c, breakAfter: false });
    if (core) {
      const w = /d[ée]bouch[ée]s/i.test(core) ? deaccent(core) : core;
      toks.push({ word: w, tag: tagWord(w) || 'XX', breakAfter: false });
    }
    if (trail) for (const c of trail) toks.push({ word: c, tag: c, breakAfter: false });
  }
  return toks;
}

const matrix = new Map(READINGS.map((g) => [g, new Map(READINGS.map((p) => [p, 0]))]));
const vvz = new Map(READINGS.map((g) => [g, 0]));
const wrong = [];

for (const gold of READINGS) {
  const lines = fs.readFileSync(`build/debouches-corpus-${gold}.txt`, 'utf8')
    .split(/\r?\n/).map((l) => l.replace(/^\s*\d+\.\s*/, '').trim()).filter(Boolean);
  for (const line of lines) {
    const toks = tokenize(line);
    const idx = toks.findIndex((t) => clean(t.word) === 'debouches');
    if (idx === -1) {
      console.warn(`no target [${gold}]: ${line}`);
      continue;
    }
    const got = convert('debouches', toks, idx);
    matrix.get(gold).set(got, matrix.get(gold).get(got) + 1);
    if (is_VVZ(toks, idx)) vvz.set(gold, vvz.get(gold) + 1);
    if (got !== gold) wrong.push([gold, got, line]);
  }
}

console.log('gold \\ predicted   debooshehs  debouqhes  debouqhez   correct');
let total = 0;
let right = 0;
for (const g of READINGS) {
  const row = matrix.get(g);
  const n = READINGS.reduce((a, p) => a + row.get(p), 0);
  total += n;
  right += row.get(g);
  const cell = (p) => String(row.get(p));
  console.log(`${g.padEnd(18)}${cell('debooshehs').padStart(8)}`
    + `${cell('debouqhes').padStart(11)}${cell('debouqhez').padStart(11)}`
    + `${cell(g).padStart(10)}/${n}`);
}
console.log(`\noverall: ${right}/${total} = ${Math.round((right / total) * 100)}%`);
console.log(`is_VVZ fires on: ${READINGS.map((g) => `${g} ${vvz.get(g)}/100`).join(', ')}`);

const show = process.argv[2];
if (show) {
  console.log('\n--- misclassified ---');
  for (const [g, p, s] of wrong) {
    if (show !== 'all' && g !== show) continue;
    console.log(`  want ${g}, got ${p}: ${s}`);
  }
}
