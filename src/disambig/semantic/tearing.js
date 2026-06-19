/**
 * Disambiguates 'tearing': /ˈtɛərɪŋ/ (ripping) vs /ˈtɪərɪŋ/ (welling with tears).
 * Corpus: disambig/tearing.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'taering' | 'tearing' | null}  null = unable to determine
 */
export function disambiguate_tearing(tokens, idx) {
  // TODO: implement using rules derived from disambig/tearing.txt corpus
  return null;
}
