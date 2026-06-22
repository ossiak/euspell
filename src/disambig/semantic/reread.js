/**
 * Disambiguates 'reread': /riːd/ (present/base/infinitive → 'reread') vs /rɛd/
 * (past tense/participle, incl. attributive → 'reredd').
 * Corpus: disambig/reread.txt
 *
 * Shares the context rules with the 'read' family via read-verb.js. Unlike the
 * rest of the family, an ambiguous residual defaults to the PAST reading:
 * rereading is inherently retrospective, so 83 of 94 locally-undecidable corpus
 * cases are past (default→past gives 93.5% vs 57.5% for base).
 *
 * @typedef {import('../../content/context.js').Token} Token
 */
import { readVerbReading } from './read-verb.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'reread' | 'reredd'}  ambiguous residual defaults to past ('reredd')
 */
export function disambiguate_reread(tokens, idx) {
  return readVerbReading(tokens, idx) === 'base' ? 'reread' : 'reredd';
}
