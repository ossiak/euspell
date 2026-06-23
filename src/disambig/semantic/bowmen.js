/**
 * Disambiguates 'bowmen' (plural of bowman): /ˈboʊmən/ ('bowmen' — archers,
 * "men with bows") vs /ˈbaʊmən/ ('buwmen' — the oarsmen who row at the bow of a
 * boat). Corpus: disambig/bowmen.txt
 *
 * The archers dominate and are /boʊ/, so 'bowmen' is the unmarked default.
 * 'buwmen' (/baʊ/) is taken only with explicit rowing-crew evidence (oars,
 * coxswain, gunwale…); merely being on a boat is not enough, since archers can
 * stand in one. The decision rests only on neighbouring words, never the
 * target's own NN2 tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Anywhere in the clause window: rowing-crew vocabulary that marks oarsmen at
// the bow of a boat → /baʊ/ ('buwmen'). Plain "boat" is excluded on purpose.
const ROWING_FIELD = new Set([
  'oar', 'oars', 'oarsman', 'oarsmen', 'rowed', 'rowing', 'rower', 'rowers',
  'scull', 'sculls', 'sculled', 'sculling', 'stroke', 'stroked', 'coxswain',
  'cox', 'gunwale', 'gunwales', 'thwart', 'thwarts', 'paddle', 'paddled',
  'paddling', 'regatta', 'crew',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bowmen' | 'buwmen'}
 */
export function disambiguate_bowmen(tokens, idx) {
  // Rowing-crew vocabulary in the clause → the bow-oarsmen, /baʊ/ ('buwmen').
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && ROWING_FIELD.has(wordOf(tokens[j]))) return 'buwmen';
  }

  // Otherwise the unmarked /boʊ/: the archers.
  return 'bowmen';
}
