/**
 * Disambiguates 'longed' (encoding 202, VVD|VVN), two pronunciations:
 *   longd  — /lɔːŋd/ (one syllable) — the everyday past tense/participle ("she
 *            longed for home") — the default
 *   longed — /ˈlɒŋɪd/ (two syllables) — the archaic/poetic disyllabic form
 * Corpus: none.
 *
 * Both tags are the same verb, so there is no part-of-speech axis; the only
 * contrast is register, and the disyllabic /-ɪd/ survives solely in metered
 * verse, which carries no lexical cue. 'longd' is therefore the default in all
 * running text. spellings[0] = 'longd'.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'longd' | 'longed'}
 */
export function disambiguate_longed(tokens, idx) {
  return 'longd';
}
