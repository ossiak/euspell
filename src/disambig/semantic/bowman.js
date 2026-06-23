/**
 * Disambiguates 'bowman': /ˈboʊmən/ ('bowman' — an archer, "a man with a bow",
 * and the surname Bowman) vs /ˈbaʊmən/ ('buwman' — the oarsman who rows at the
 * bow of a boat). Corpus: disambig/bowman.txt
 *
 * The archer and the surname both dominate and are both /boʊ/, so 'bowman' is
 * the unmarked default. 'buwman' (/baʊ/) is the bow-oarsman, taken only with
 * explicit rowing-crew evidence (oars, coxswain, gunwale…); merely being on a
 * boat is not enough, since an archer can stand in one. The decision rests only
 * on neighbouring words, never the target's own NN1 tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Anywhere in the clause window: rowing-crew vocabulary that marks the oarsman
// at the bow of a boat → /baʊ/ ('buwman'). Plain "boat" is excluded on purpose.
const ROWING_FIELD = new Set([
  'oar', 'oars', 'oarsman', 'oarsmen', 'rowed', 'rowing', 'rower', 'rowers',
  'scull', 'sculls', 'sculled', 'sculling', 'stroke', 'stroked', 'coxswain',
  'cox', 'gunwale', 'gunwales', 'thwart', 'thwarts', 'paddle', 'paddled',
  'paddling', 'regatta', 'crew',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bowman' | 'buwman'}
 */
export function disambiguate_bowman(tokens, idx) {
  // Rowing-crew vocabulary in the clause → the bow-oarsman, /baʊ/ ('buwman').
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && ROWING_FIELD.has(wordOf(tokens[j]))) return 'buwman';
  }

  // Otherwise the unmarked /boʊ/: the archer or the surname Bowman.
  return 'bowman';
}
