import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readLexicon } from './helpers.js';
import { SEMANTIC } from '../src/disambig/semantic/index.js';
import { KEEP_UNCHANGED } from '../src/content/converter.js';
import { VV0_VERB_DEFAULT } from '../src/disambig/vv0-prior.js';

const lex = readLexicon(fs, new URL('../data/euspell_lexicon.csv', import.meta.url));

/** Mirrors route() in converter.js: does this entry reach a real disambiguator? */
function reachesDisambiguator(e) {
  const k = e.word.toLowerCase();
  return (
    ((e.encoding === 12 || e.encoding === 112) && e.pos.includes('VVZ')) ||
    e.pos.includes('GE') ||
    (e.encoding === 702 && e.pos.includes('NN2')) ||
    ((e.encoding === 102 || e.encoding === 152) && e.pos.includes('VV0')) ||
    SEMANTIC.has(k) ||
    KEEP_UNCHANGED.has(k)
  );
}

test('every entry: euspelling count matches the declared variant count', () => {
  const bad = lex.filter((e) => e.encoding % 10 >= 1 && e.spellings.length !== e.encoding % 10
    // encoding%10==0 entries may carry an abbreviation expansion in the field
    && e.encoding % 10 !== 0);
  assert.deepEqual(bad.map((e) => `${e.word}(enc${e.encoding}:${e.spellings.length})`), []);
});

test('encoding%10 < 2 entries carry at most one euspelling', () => {
  const bad = lex.filter((e) => e.encoding % 10 < 2 && e.spellings.length > 1);
  assert.deepEqual(bad.map((e) => e.word), []);
});

test('encoding%10 == 1 entries have exactly one euspelling (no silent no-ops)', () => {
  const bad = lex.filter((e) => e.encoding % 10 === 1 && e.spellings.length !== 1);
  assert.deepEqual(bad.map((e) => e.word), []);
});

test('every entry needing disambiguation (>=2 spellings) reaches a disambiguator', () => {
  const uncovered = lex.filter((e) => e.encoding % 10 >= 2 && !reachesDisambiguator(e));
  // manque (702, JJ|NN) has no NN2/plural reading and intentionally defaults.
  const unexpected = uncovered.filter((e) => e.word !== 'manque');
  assert.deepEqual(unexpected.map((e) => `${e.word}[${e.pos.join('|')}]`), []);
});

test('every 3-/4-way word (>=3 spellings) is in SEMANTIC (a 0/1 branch cannot resolve it)', () => {
  const bad = lex.filter((e) => e.encoding % 10 >= 3 && !SEMANTIC.has(e.word.toLowerCase()) && !KEEP_UNCHANGED.has(e.word.toLowerCase()));
  assert.deepEqual(bad.map((e) => e.word), []);
});

test('KEEP_UNCHANGED words exist in the lexicon and carry a multi-spelling encoding', () => {
  for (const w of KEEP_UNCHANGED) {
    const e = lex.find((x) => x.word === w);
    assert.ok(e, `${w} present in lexicon`);
    assert.ok(e.encoding % 10 >= 2, `${w} has a disambiguation encoding`);
  }
});

test('the ports carry the same VV0 verb-default set as the generated table', () => {
  // The set is generated into src/disambig/vv0-prior.js for the JS engine, and
  // hand-mirrored in the LibreOffice and Apps Script ports, which load neither
  // ES modules nor that file. Three copies drift silently, and a drifted copy
  // would make the SAME sentence reform differently in Word/Docs than in the
  // extension — so pin them to each other here.
  const expected = [...VV0_VERB_DEFAULT].sort();

  const py = fs.readFileSync(new URL('../libreoffice/euspell/engine.py', import.meta.url), 'utf8');
  const pyMatch = /_VV0_VERB_DEFAULT = \{([^}]*)\}/.exec(py);
  assert.ok(pyMatch, 'engine.py: _VV0_VERB_DEFAULT not found');
  const pyWords = [...pyMatch[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(pyWords, expected, 'engine.py is out of step with vv0-prior.js');

  const gas = fs.readFileSync(new URL('../apps-script/euspell-engine.gs', import.meta.url), 'utf8');
  const gasMatch = /var VV0_VERB_DEFAULT = \{([^}]*)\}/.exec(gas);
  assert.ok(gasMatch, 'euspell-engine.gs: VV0_VERB_DEFAULT not found');
  const gasWords = [...gasMatch[1].matchAll(/([a-z]+)\s*:/g)].map((m) => m[1]).sort();
  assert.deepEqual(gasWords, expected, 'euspell-engine.gs is out of step with vv0-prior.js');
});

test('every VV0 verb-default word is a POS-decided heteronym', () => {
  // A word only reaches is_verb_VV0 through the 102/152 branch, so a default for
  // anything else would be dead weight — and a sign the table was generated from
  // a stale lexicon.
  const byWord = new Map(lex.map((e) => [e.word.toLowerCase(), e]));
  for (const w of VV0_VERB_DEFAULT) {
    const e = byWord.get(w);
    assert.ok(e, `${w} is in the lexicon`);
    assert.ok([102, 152].includes(e.encoding), `${w} has a POS-heteronym encoding`);
    assert.ok(e.pos.includes('VV0'), `${w} has a VV0 reading`);
    assert.ok(!SEMANTIC.has(w), `${w} is not semantic (those never reach is_verb_VV0)`);
  }
});
