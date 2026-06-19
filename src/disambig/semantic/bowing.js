/**
 * Disambiguates 'bowing': /boʊ/ (bow-tying / string-playing) vs /baʊ/ (bending forward).
 * Corpus: disambig/bowing.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bowing' | 'buwing' | null}  null = unable to determine
 */
export function disambiguate_bowing(tokens, idx) {
  // TODO: implement using rules derived from disambig/bowing.txt corpus
  return null;
}
