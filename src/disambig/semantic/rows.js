/**
 * Disambiguates 'rows' (encoding 114, NN2|VVZ) four ways:
 *   rows — /roʊz/ plural noun (lines, ranks)
 *   ruws — /raʊz/ plural noun (quarrels, noisy disputes)
 *   rowz — /roʊz/ 3rd-sg-pres verb ("she rows the boat")
 *   ruwz — /raʊz/ 3rd-sg-pres verb ("he rows with his neighbours")
 * Corpus: disambig/rows.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'rows' | 'ruws' | 'rowz' | 'ruwz' | null}  null = unable to determine
 */
export function disambiguate_rows(tokens, idx) {
  // TODO: implement using rules derived from disambig/rows.txt corpus
  return null;
}
