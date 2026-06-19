/**
 * Disambiguates 'misread': /ˌmɪsˈriːd/ (present/base) vs /ˌmɪsˈrɛd/ (past tense/participle).
 * Corpus: disambig/misread.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'misread' | 'misredd' | null}  null = unable to determine
 */
export function disambiguate_misread(tokens, idx) {
  // TODO: implement using rules derived from disambig/misread.txt corpus
  return null;
}
