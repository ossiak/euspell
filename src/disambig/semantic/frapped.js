/**
 * Disambiguates 'frapped' (encoding 202, JJ|VVD|VVN), two unrelated verbs that
 * collided on one spelling:
 *   frappehd — /fræˈpeɪd/ — chilled, or whipped up with ice ("a frappéd
 *              coffee", "frappéd the cream") — the default
 *   frapd    — /fræpt/ — the nautical sense, bound tight with turns of rope
 *              ("frapped the shrouds", "the boom was frapped down")
 * Corpus: none.
 *
 * The drink sense is the one a reader meets; the nautical verb survives mainly
 * in sailing manuals and age-of-sail fiction, and the cues that would mark it —
 * rope, rigging, tackle, spars — are nouns the drink sense simply never appears
 * near, which sounds like a usable signal until you notice how rarely either
 * word appears at all. Guessing from three or four hand-picked nouns would buy
 * a little recall for the rare reading at the cost of misfiring on the common
 * one, which is the wrong trade for a converter whose job is to be right in
 * running text.
 *
 * So 'frappehd' is returned unconditionally, and it is also the lexicon's
 * spellings[0] — a rule that returns null and a rule that is never reached both
 * land on the same reading, which is what keeps the three paths in agreement.
 * If a corpus is ever collected, the nautical sense is the one to detect: it is
 * the marked reading, and a precision-first rule for it can only improve on
 * this without putting the common case at risk.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'frappehd' | 'frapd'}
 */
export function disambiguate_frapped(tokens, idx) {
  return 'frappehd';
}
