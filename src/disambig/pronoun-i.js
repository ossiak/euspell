import { contextWindow } from '../content/context.js';

/** @typedef {import('../content/context.js').Token} Token */

// A standalone capital "I" is usually the first-person pronoun, which reforms to
// "ih". It is also the Roman numeral one and the letter itself, and reforming
// either produces nonsense: "SECTION I" became "SECTION ih", "I&A Unit" became
// "ih&A Unit". Two independent tests rule the pronoun out.
//
// 1. IS IT BOUND TO WHAT FOLLOWS? The pronoun is a free-standing word, so the
//    character after it is whitespace or terminal punctuation. Anything else
//    binds it to the next characters, and a bound "I" is the letter, not the
//    pronoun: I&A, I-beam, I/O, I). This reads a property of the source text
//    rather than guessing from the neighbouring word, which is why it is
//    preferred over testing whether the next token is a lone capital.
//
// 2. IS IT A DOCUMENT LABEL? "Section I", "Part II", "Appendix I" name a
//    division, and such a label is a capitalized noun taking no article. The
//    same noun behind a determiner is an ordinary noun phrase whose "I" is the
//    pronoun — "the section I wrote". Both halves are needed: capitalization
//    alone misreads "The Section I refer to", the noun alone "the chapter I read".
//
// Deliberately conservative — the pronoun is the default and is given up only on
// positive evidence, because a missed label leaves one heading looking odd while
// a wrongly-suppressed pronoun mis-spells ordinary prose.

// Characters that may follow a free-standing word: whitespace, and punctuation
// that closes a clause or sentence. A pronoun legitimately ends a sentence
// ("he is taller than I."), so these must NOT count as binding.
const FREE_AFTER = /[\s.,;:!?]/;

const LABEL_NOUNS = new Set([
  'act', 'annex', 'appendix', 'article', 'book', 'chapter', 'class', 'clause',
  'division', 'edition', 'exhibit', 'figure', 'form', 'grade', 'group', 'item',
  'level', 'paragraph', 'part', 'phase', 'round', 'schedule', 'section',
  'series', 'stage', 'step', 'table', 'tier', 'title', 'type', 'unit',
  'volume', 'war',
]);

const DETERMINERS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'each', 'every', 'any',
  'some', 'which', 'whichever', 'another',
]);

/**
 * True when the "I" at `idx` is bound to the characters after it rather than
 * standing alone as a word — the letter in "I&A", "I-beam", "I/O", "I)".
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
function isBound(tokens, idx) {
  const sep = tokens[idx]?.sepAfter ?? '';
  return sep !== '' && !FREE_AFTER.test(sep);
}

/**
 * True when the "I" at `idx` reads as the Roman numeral one in a document label
 * such as "Section I".
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
function isLabelNumeral(tokens, idx) {
  // contextWindow fills slots past a sentence break with BOUNDARY, so a label
  // never draws its evidence from the previous sentence.
  const [, before, prev] = contextWindow(tokens, idx);
  const noun = prev.word;
  if (!noun || !LABEL_NOUNS.has(noun.toLowerCase())) return false;
  // Title-style: "Section I", not "section I". All-caps headings satisfy this.
  if (noun[0] !== noun[0].toUpperCase()) return false;
  if (before.word && DETERMINERS.has(before.word.toLowerCase())) return false;
  return true;
}

/**
 * True when the standalone "I" at `idx` is the first-person pronoun, and so
 * reforms to "ih". False when it is the letter or the Roman numeral, which are
 * left exactly as written.
 *
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function isPronounI(tokens, idx) {
  return !isBound(tokens, idx) && !isLabelNumeral(tokens, idx);
}
