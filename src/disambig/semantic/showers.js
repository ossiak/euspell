/**
 * Disambiguates 'showers' (encoding 113, NN2|VVZ) three ways:
 *   showers — /ˈʃoʊərz/ plural noun "ones who show" (agent of 'show')
 *   shuwers — /ˈʃaʊərz/ plural noun (rain, bathing fixtures, parties)
 *   shuwerz — /ˈʃaʊərz/ 3rd-sg-pres verb ("it showers")
 * Corpus: none yet
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'showers' | 'shuwers' | 'shuwerz' | null}  null = unable to determine
 */
export function disambiguate_showers(tokens, idx) {
  // TODO: implement (no corpus yet — derive rules from POS context)
  return null;
}
