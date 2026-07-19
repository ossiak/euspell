import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readLexicon } from './helpers.js';
import { SEMANTIC } from '../src/disambig/semantic/index.js';
import { KEEP_UNCHANGED } from '../src/content/converter.js';

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
