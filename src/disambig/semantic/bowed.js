/**
 * Disambiguates 'bowed': /baʊd/ (rhymes with "loud" → 'buwd' — bent the body,
 * the bowing gesture, a ship's bow; also a stooped head/shoulders) vs /boʊd/
 * (rhymes with "road" → 'bowd' — curved like a bow, and a string instrument
 * played with a bow). Corpus: disambig/bowed.txt
 *
 * The bending-gesture /baʊd/ sense dominates ("bowed his head", "bowed low",
 * "bowed to the king"), and even attributive "bowed head/shoulders" is a person
 * stooping — so 'buwd' is the unmarked default. 'bowd' is the marked sense: a
 * physically curved shape ("bowed legs", "bowed edge") or an instrument played
 * with a bow ("bowed the strings"). The decision rests only on neighbouring
 * words, never on the target's own tag (the lexicon tags it JJ|VVD|VVN).
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Immediately after "bowed": a noun naming a curved physical shape (bandy legs,
// a curved edge/window) or a bowed string instrument — the /boʊd/ sense.
export const CURVED_HEAD = new Set([
  'legs', 'leg', 'limbs', 'plank', 'planks', 'board', 'boards', 'slat', 'slats',
  'stave', 'staves', 'rib', 'ribs', 'edge', 'edges', 'window', 'windows', 'wall',
  'walls', 'ceiling', 'arch', 'arches', 'instrument', 'instruments', 'string',
  'strings', 'violin', 'violins', 'cello', 'cellos', 'fiddle', 'fiddles',
]);

// Anywhere in the clause window: a bowed string instrument being played, which
// makes the verb /boʊd/ ("she bowed the cello", "bowed across the strings").
const INSTRUMENT_FIELD = new Set(['violin', 'violins', 'cello', 'cellos', 'fiddle', 'fiddles', 'viol', 'viola']);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bowd' | 'buwd'}
 */
export function disambiguate_bowed(tokens, idx) {
  // A curved shape or instrument named right after "bowed" → /boʊd/ ('bowd').
  if (CURVED_HEAD.has(wordOf(tokens[idx + 1]))) return 'bowd';

  // An instrument being played anywhere in the clause → /boʊd/ ('bowd').
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && INSTRUMENT_FIELD.has(wordOf(tokens[j]))) return 'bowd';
  }

  // Otherwise the unmarked /baʊd/: the bending gesture or a stooped head.
  return 'buwd';
}
