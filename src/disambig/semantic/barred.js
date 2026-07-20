/**
 * Disambiguates 'barred' (encoding 202, JJ|VVD|VVN), two pronunciations:
 *   bardd   — /bɑːrd/ (one syllable) — the everyday adjective and verb ("a
 *             barred door", "they barred the way") — the default
 *   barrehd — /ˈbɑːrɪd/ (two syllables) — the archaic/poetic disyllabic form
 *             ("the barrèd gate")
 * Corpus: none.
 *
 * Both the ordinary adjective and the verb are the one-syllable /bɑːrd/, so the
 * adjective/verb split is NOT the axis here — the only contrast is register, and
 * the disyllabic /-ɪd/ survives solely in metered verse, which carries no
 * lexical cue. 'bardd' is therefore the default in all running text; the marked
 * form is not reachable from context. spellings[0] = 'bardd'.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bardd' | 'barrehd'}
 */
export function disambiguate_barred(tokens, idx) {
  return 'bardd';
}
