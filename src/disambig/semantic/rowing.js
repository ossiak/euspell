/**
 * Disambiguates 'rowing': /roʊ/ (propelling a boat) vs /raʊ/ (quarrelling).
 * Corpus: disambig/rowing.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'rowing' | 'ruwing' | null}  null = unable to determine
 */
export function disambiguate_rowing(tokens, idx) {
  // TODO: implement using rules derived from disambig/rowing.txt corpus
  return null;
}
