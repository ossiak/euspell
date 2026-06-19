/**
 * Disambiguates 'rowed': /roʊd/ (propelled a boat) vs /raʊd/ (had a noisy quarrel).
 * Corpus: disambig/rowed.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'rowd' | 'ruwd' | null}  null = unable to determine
 */
export function disambiguate_rowed(tokens, idx) {
  // TODO: implement using rules derived from disambig/rowed.txt corpus
  return null;
}
