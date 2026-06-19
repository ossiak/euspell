/**
 * Disambiguates 'bow': /boʊ/ (knot, ribbon, archery, violin) vs /baʊ/ (bend, front of a ship).
 * Corpus: disambig/bow.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bow' | 'buw' | null}  null = unable to determine
 */
export function disambiguate_bow(tokens, idx) {
  // TODO: implement using rules derived from disambig/bow.txt corpus
  return null;
}
