/**
 * Disambiguates 'bowmen': /boʊ/ (archers) vs /baʊ/ (oarsmen at the bow).
 * Corpus: disambig/bowmen.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bowmen' | 'buwmen' | null}  null = unable to determine
 */
export function disambiguate_bowmen(tokens, idx) {
  // TODO: implement using rules derived from disambig/bowmen.txt corpus
  return null;
}
