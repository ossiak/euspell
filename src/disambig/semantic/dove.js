/**
 * Disambiguates 'dove' (encoding 202, NN1|VVD|VVN) two ways:
 *   dov  — /dʌv/ noun (the bird)
 *   dove — /doʊv/ past tense / past participle of 'dive' ("he dove in")
 * Corpus: disambig/dove.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'dov' | 'dove' | null}  null = unable to determine
 */
export function disambiguate_dove(tokens, idx) {
  // TODO: implement using rules derived from disambig/dove.txt corpus
  return null;
}
