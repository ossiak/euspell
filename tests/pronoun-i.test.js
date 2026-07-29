import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPronounI } from '../src/disambig/pronoun-i.js';

/**
 * Builds a token stream from words. A trailing '.' marks a sentence break, and
 * `word|X` sets sepAfter to X — the character following the word in the source.
 */
const toks = (...words) =>
  words.map((w) => {
    const [raw, sep] = w.split('|');
    const breakAfter = raw.endsWith('.');
    return {
      word: raw.replace(/\.$/, ''),
      tag: '',
      breakAfter,
      sepAfter: sep ?? (breakAfter ? '.' : ' '),
    };
  });
const pronoun = (...words) => {
  const t = toks(...words);
  return isPronounI(t, t.findIndex((x) => x.word === 'I'));
};

test('a free-standing I is the pronoun', () => {
  // "WHAT SHOULD I DO IF I HAVE AN…" — a genuine pronoun in an all-caps heading,
  // from the same PDF page as the SECTION I below.
  assert.equal(pronoun('WHAT', 'SHOULD', 'I', 'DO'), true);
  assert.equal(pronoun('you', 'and', 'I', 'agree'), true);
  assert.equal(pronoun('I', 'am', 'here'), true);
});

test('a pronoun may still close a clause or sentence', () => {
  // Terminal punctuation does not bind: "he is taller than I."
  assert.equal(pronoun('taller', 'than', 'I.'), true);
  assert.equal(pronoun('taller', 'than', 'I|,', 'she', 'said'), true);
  assert.equal(pronoun('than', 'I|;', 'however'), true);
});

test('an I bound to the next characters is the letter, not the pronoun', () => {
  assert.equal(pronoun('local', 'I|&', 'A', 'Unit'), false); // I&A Unit
  assert.equal(pronoun('The', 'I|-', 'beam', 'was', 'steel'), false); // I-beam
  assert.equal(pronoun('an', 'I|/', 'O', 'error'), false); // I/O
  assert.equal(pronoun('sections', 'I|)', 'a', 'snapshot'), false); // "I) a snapshot"
});

test('a capitalized label noun marks the Roman numeral', () => {
  assert.equal(pronoun('SECTION', 'I', 'This', 'notice'), false);
  assert.equal(pronoun('Section', 'I', 'applies'), false);
  assert.equal(pronoun('Appendix', 'I', 'lists'), false);
  assert.equal(pronoun('Part', 'I'), false);
});

test('a lowercase label noun, or a determiner before it, keeps the pronoun', () => {
  assert.equal(pronoun('the', 'section', 'I', 'wrote'), true);
  assert.equal(pronoun('the', 'Section', 'I', 'refer', 'to'), true);
  assert.equal(pronoun('The', 'Part', 'I', 'played'), true);
});

test('label evidence is not drawn across a sentence break', () => {
  assert.equal(pronoun('amend', 'the', 'Section.', 'I', 'agree'), true);
});
