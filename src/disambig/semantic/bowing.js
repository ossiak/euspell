/**
 * Disambiguates 'bowing': /baʊ/ (rhymes with "now" → 'buwing' — bending the
 * body in a bow, and any bending/curving under load) vs /boʊ/ (rhymes with
 * "going" → 'bowing' — playing a string instrument with a bow, the violin
 * technique). Corpus: disambig/bowing.txt
 *
 * The bending sense overwhelms the data ("bowing to", "bowing low/deeply/
 * politely", "a bowing of the head"); even an inanimate "ribs bowing in" is
 * bending under load — all /baʊ/. So 'buwing' is the unmarked default and
 * 'bowing' (/boʊ/) is taken only with explicit string-instrument evidence. The
 * decision rests only on neighbouring words, never the target's JJ|NN1|VVG tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Anywhere in the clause window: a bowed string instrument being played, which
// makes "bowing" the violin technique → /boʊ/ ("his bowing", "bowing the cello").
const INSTRUMENT_FIELD = new Set([
  'violin', 'violins', 'cello', 'cellos', 'fiddle', 'fiddles', 'viol', 'viola',
  'violinist', 'cellist', 'bowstring', 'arco', 'staccato', 'legato', 'vibrato',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bowing' | 'buwing'}
 */
export function disambiguate_bowing(tokens, idx) {
  // A string instrument being played anywhere in the clause → /boʊ/ ('bowing').
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && INSTRUMENT_FIELD.has(wordOf(tokens[j]))) return 'bowing';
  }

  // Otherwise the unmarked /baʊ/: the bowing gesture or bending under load.
  return 'buwing';
}
