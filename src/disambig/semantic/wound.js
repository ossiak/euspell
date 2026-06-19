/**
 * Disambiguates 'wound': /wuːnd/ (an injury) vs /waʊnd/ (past tense of wind).
 * Corpus: disambig/wound.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'woond' | 'wound' | null}  null = unable to determine
 */
export function disambiguate_wound(tokens, idx) {
  // TODO: implement using rules derived from disambig/wound.txt corpus
  return null;
}
