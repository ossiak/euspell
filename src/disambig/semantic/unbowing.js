/**
 * Disambiguates 'unbowing' (encoding 202, JJ|NN|VVG), two pronunciations:
 *   unbuwing — /baʊ/ (rhymes with "now") unyielding, not bending/submitting
 *              ("unbowing resolve", "stood unbowing")
 *   unbowing — /boʊ/ (rhymes with "going") not curving like a bow, or not
 *              playing a string instrument with a bow (rare)
 * Corpus: none — mirrors the base "bowing".
 *
 * "unbowing" almost always means unyielding (the bending/submission sense), so
 * 'unbuwing' is the unmarked default; 'unbowing' (/boʊ/) is taken only with
 * explicit string-instrument evidence. The decision rests only on neighbouring
 * words, never the target's own tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { INSTRUMENT_FIELD } from './bowing.js';

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'unbowing' | 'unbuwing'}
 */
export function disambiguate_unbowing(tokens, idx) {
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && INSTRUMENT_FIELD.has(wordOf(tokens[j]))) return 'unbowing';
  }
  return 'unbuwing';
}
