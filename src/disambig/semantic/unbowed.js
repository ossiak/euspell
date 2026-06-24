/**
 * Disambiguates 'unbowed' (encoding 202, JJ|VVD|VVN), two pronunciations:
 *   unbuwd — /baʊd/ (rhymes with "loud") not bent/not subdued — the dominant
 *            sense ("bloody but unbowed", "head unbowed", "unbowed by defeat")
 *   unbowd — /boʊd/ (rhymes with "road") not curved like a bow, or (of a string
 *            instrument) not played with a bow (rare)
 * Corpus: none — mirrors the base "bowed".
 *
 * The not-subdued /baʊd/ sense dominates, so 'unbuwd' is the unmarked default;
 * 'unbowd' (/boʊd/) is taken only with explicit curved-shape or string-instrument
 * evidence. The decision rests only on neighbouring words, never the JJ|VVD|VVN
 * tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { CURVED_HEAD } from './bowed.js';
import { INSTRUMENT_FIELD } from './bowing.js';

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'unbowd' | 'unbuwd'}
 */
export function disambiguate_unbowed(tokens, idx) {
  // A curved shape named right after → /boʊd/.
  if (CURVED_HEAD.has(wordOf(tokens[idx + 1]))) return 'unbowd';
  // A bowed string instrument in the clause → /boʊd/.
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && INSTRUMENT_FIELD.has(wordOf(tokens[j]))) return 'unbowd';
  }
  // Otherwise the unmarked /baʊd/: not subdued.
  return 'unbuwd';
}
