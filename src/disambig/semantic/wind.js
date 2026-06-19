/**
 * Disambiguates 'wind': /wɪnd/ (moving air) vs /waɪnd/ (verb: to coil or turn).
 * Corpus: disambig/wind.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'wind' | 'wynd' | null}  null = unable to determine
 */
export function disambiguate_wind(tokens, idx) {
  // TODO: implement using rules derived from disambig/wind.txt corpus
  return null;
}
