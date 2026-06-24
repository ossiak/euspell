/**
 * Disambiguates 'ravined' (encoding 022, JJ|VVD|VVN), two pronunciations:
 *   ravind  — /rəˈviːnd/ (one syllable ending) — the everyday adjective/verb
 *             (cut by ravines; rare) — the default
 *   ravined — /rəˈviːnɪd/ (extra syllable) — the archaic/poetic disyllabic form
 * Corpus: none.
 *
 * As with barred/longed, both the ordinary adjective and verb take the shorter
 * form, so the only contrast is register; the disyllabic /-ɪd/ survives solely
 * in metered verse and carries no lexical cue. 'ravind' is therefore the default
 * in all running text. spellings[0] = 'ravind'.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'ravind' | 'ravined'}
 */
export function disambiguate_ravined(tokens, idx) {
  return 'ravind';
}
