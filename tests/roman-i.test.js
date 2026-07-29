import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRomanNumeralI } from '../src/disambig/roman-i.js';

/** Builds a token stream from words; `.` on a word marks a sentence break after it. */
const toks = (...words) =>
  words.map((w) => ({ word: w.replace(/\.$/, ''), tag: '', breakAfter: w.endsWith('.') }));
/** Index of the standalone "I" in the stream. */
const at = (t) => t.findIndex((x) => x.word === 'I');
const roman = (...words) => {
  const t = toks(...words);
  return isRomanNumeralI(t, at(t));
};

test('a capitalized label noun marks the Roman numeral', () => {
  // "SECTION I  This notice…" — the case reported from the StateFund PDF.
  assert.equal(roman('SECTION', 'I', 'This', 'notice'), true);
  assert.equal(roman('Section', 'I', 'applies'), true);
  assert.equal(roman('Part', 'I'), true);
  assert.equal(roman('Appendix', 'I', 'lists'), true);
  assert.equal(roman('Chapter', 'I'), true);
});

test('a lowercase label noun is an ordinary noun, so "I" stays the pronoun', () => {
  assert.equal(roman('the', 'section', 'I', 'wrote'), false);
  assert.equal(roman('a', 'chapter', 'I', 'read'), false);
});

test('a determiner before the noun rules out the numeral', () => {
  // Capitalized mid-sentence in legal prose, but still an ordinary noun phrase.
  assert.equal(roman('the', 'Section', 'I', 'refer', 'to'), false);
  assert.equal(roman('The', 'Part', 'I', 'played'), false);
  assert.equal(roman('this', 'Article', 'I', 'signed'), false);
});

test('an unrelated preceding word leaves the pronoun alone', () => {
  // "WHAT SHOULD I DO IF I HAVE AN…" — a genuine pronoun in an all-caps heading,
  // from the same page as the SECTION I above.
  assert.equal(roman('WHAT', 'SHOULD', 'I', 'DO'), false);
  assert.equal(roman('you', 'and', 'I', 'agree'), false);
  assert.equal(roman('I', 'am', 'here'), false);
});

test('evidence is not drawn across a sentence break', () => {
  // "…amend the Section." then a new sentence starting "I ..." must stay pronoun.
  assert.equal(roman('amend', 'the', 'Section.', 'I', 'agree'), false);
});
