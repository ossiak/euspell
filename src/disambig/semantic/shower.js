/**
 * Disambiguates 'shower' (encoding 102, NN1|VV0) two ways:
 *   shower — /ˈʃoʊər/ singular noun "one who shows" (agent of 'show')
 *   shuwer — /ˈʃaʊər/ rain/bathing sense (noun, or verb "to shower")
 * Corpus: disambig/shower.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'shower' | 'shuwer' | null}  null = unable to determine
 */
export function disambiguate_shower(tokens, idx) {
  // TODO: implement using rules derived from disambig/shower.txt corpus
  return null;
}
