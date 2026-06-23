/**
 * Disambiguates 'shower' (encoding 102, NN1|VV0) two ways:
 *   shower — /ˈʃoʊər/ the agent of "show", one who shows (e.g. exhibits dogs)
 *   shuwer — /ˈʃaʊər/ rain / spray / bathing — the noun and the verb "to shower"
 * Corpus: disambig/shower.txt
 *
 * The /ʃaʊər/ rain/bath sense overwhelmingly dominates (the corpus is entirely
 * this sense), so 'shuwer' is the unmarked default. The agentive /ʃoʊər/ "one
 * who shows" is vanishingly rare and is taken only when an exhibit noun sits
 * right before the word inside a show-competition context — distinct from "a
 * shower of leaves/sparks" (spray). The decision rests only on neighbouring
 * words, never the target's own NN1|VV0 tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Animals one "shows" competitively — a preceding one can mark the agent noun.
export const EXHIBIT = new Set([
  'dog', 'dogs', 'cat', 'cats', 'cattle', 'livestock', 'poultry', 'pigeon',
  'pigeons', 'horse', 'horses', 'pony', 'ponies', 'rabbit', 'rabbits',
]);
// Show / competition vocabulary that confirms the "one who shows" sense.
export const SHOW_FIELD = new Set([
  'show', 'shows', 'showed', 'showing', 'exhibitor', 'exhibitors', 'exhibit',
  'exhibition', 'judge', 'judges', 'judging', 'breed', 'breeds', 'pedigree',
  'championship', 'kennel', 'handler', 'ribbon', 'ribbons', 'rosette', 'rosettes',
  'ring',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'shower' | 'shuwer'}
 */
export function disambiguate_shower(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);

  // Agentive "one who shows": "<animal> shower" within a show-competition
  // context. Both signals are required so it never fires on "a shower of …".
  if (EXHIBIT.has(prev)) {
    for (let j = idx - 4; j <= idx + 4; j++) {
      if (j !== idx && tokens[j] && SHOW_FIELD.has(wordOf(tokens[j]))) return 'shower';
    }
  }

  // Otherwise the dominant /ʃaʊər/: rain, spray, or bathing.
  return 'shuwer';
}
