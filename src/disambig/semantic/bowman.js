/**
 * Disambiguates 'bowman': /boʊ/ (archer) vs /baʊ/ (oarsman at the bow).
 * Corpus: disambig/bowman.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bowman' | 'buwman' | null}  null = unable to determine
 */
export function disambiguate_bowman(tokens, idx) {
  // TODO: implement using rules derived from disambig/bowman.txt corpus
  return null;
}
