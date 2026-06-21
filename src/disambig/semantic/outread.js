/**
 * Disambiguates 'outread' (encoding 202, VV0|VVD|VVN) two ways:
 *   outread — /aʊtˈriːd/ base/present verb ("they outread us")
 *   outredd — /aʊtˈrɛd/ past tense / past participle ("she outread him")
 * Corpus: disambig/outread.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'outread' | 'outredd' | null}  null = unable to determine
 */
export function disambiguate_outread(tokens, idx) {
  // TODO: implement using rules derived from disambig/outread.txt corpus
  return null;
}
