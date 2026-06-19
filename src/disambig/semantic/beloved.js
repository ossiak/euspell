/**
 * Disambiguates 'beloved': /bɪˈlʌvd/ (verb past participle) vs /bɪˈlʌvɪd/ (adjective/noun, 3 syllables).
 * Corpus: disambig/beloved.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'belovd' | 'beloved' | null}  null = unable to determine
 */
export function disambiguate_beloved(tokens, idx) {
  // TODO: implement using rules derived from disambig/beloved.txt corpus
  return null;
}
