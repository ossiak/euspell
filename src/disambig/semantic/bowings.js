/**
 * Disambiguates 'bowings' (encoding 202, NN2) — the plural of "bowing", two
 * pronunciations:
 *   buwings — /baʊ/ (rhymes with "now") the bending-gesture nouns ("bowings and
 *             scrapings", deferential bows)
 *   bowings — /boʊ/ (rhymes with "going") the string-instrument technique
 *             ("his bowings", violin bowings)
 * Corpus: none — mirrors the base verb "bowing".
 *
 * As with "bowing", the bending sense dominates, so 'buwings' is the unmarked
 * default; 'bowings' (/boʊ/) is taken only with explicit string-instrument
 * evidence. The decision rests only on neighbouring words, never the NN2 tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { INSTRUMENT_FIELD } from './bowing.js';

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bowings' | 'buwings'}
 */
export function disambiguate_bowings(tokens, idx) {
  // A bowed string instrument in the clause → the violin technique, /boʊ/.
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && INSTRUMENT_FIELD.has(wordOf(tokens[j]))) return 'bowings';
  }
  // Otherwise the unmarked /baʊ/: bending gestures.
  return 'buwings';
}
