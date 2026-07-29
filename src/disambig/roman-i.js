import { contextWindow } from '../content/context.js';

/** @typedef {import('../content/context.js').Token} Token */

// A standalone capital "I" is usually the pronoun, which reforms to "ih". But it
// is also the Roman numeral one, and reforming a section number produces
// nonsense: "SECTION I" became "SECTION ih". The two readings are not separable
// from the letter alone, so this decides from the word before it.
//
// The signal is a title-style label: "Section I", "Part II", "Appendix I" name a
// division of a document, and a label like that is capitalized and takes no
// article. The same noun with an article is an ordinary noun phrase whose "I" is
// the pronoun — "the section I wrote", "the part I played" — so a determiner
// before the noun rules the numeral reading out. Both tests are needed:
// capitalization alone would misread "The Section I refer to", and the noun
// alone would misread "the chapter I read".
//
// Deliberately conservative — the pronoun is the default and a numeral is only
// recognised on positive evidence, because a missed numeral leaves one label
// looking odd while a wrongly-suppressed pronoun mis-spells ordinary prose.
const LABEL_NOUNS = new Set([
  'act', 'annex', 'appendix', 'article', 'book', 'chapter', 'class', 'clause',
  'division', 'edition', 'exhibit', 'figure', 'form', 'grade', 'group', 'item',
  'level', 'paragraph', 'part', 'phase', 'round', 'schedule', 'section',
  'series', 'stage', 'step', 'table', 'tier', 'title', 'type', 'unit',
  'volume', 'war',
]);

// An article or demonstrative before the noun makes it an ordinary noun phrase,
// so the "I" after it is the pronoun.
const DETERMINERS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'each', 'every', 'any',
  'some', 'which', 'whichever', 'another',
]);

/**
 * True when the standalone "I" at `idx` reads as the Roman numeral one — a
 * document label such as "Section I" — rather than the first-person pronoun.
 *
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function isRomanNumeralI(tokens, idx) {
  // contextWindow fills slots past a sentence break with BOUNDARY, so a label
  // never draws its evidence from the previous sentence.
  const [, before, prev] = contextWindow(tokens, idx);
  const noun = prev.word;
  if (!noun || !LABEL_NOUNS.has(noun.toLowerCase())) return false;
  // Title-style: "Section I", not "section I". An all-caps heading ("SECTION I")
  // satisfies this too.
  if (noun[0] !== noun[0].toUpperCase()) return false;
  if (before.word && DETERMINERS.has(before.word.toLowerCase())) return false;
  return true;
}
