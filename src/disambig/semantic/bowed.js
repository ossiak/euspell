/**
 * Disambiguates 'bowed': /boʊd/ (tied a bow / played with a bow) vs /baʊd/ (bent forward).
 * Corpus: disambig/bowed.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bowd' | 'buwd' | null}  null = unable to determine
 */
export function disambiguate_bowed(tokens, idx) {
  // TODO: implement using rules derived from disambig/bowed.txt corpus
  return null;
}
