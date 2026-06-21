/**
 * Disambiguates 'tears' (encoding 114, NN2|VVZ) four ways:
 *   taers — /tɛərz/ plural noun (rips, rents in a surface)
 *   tears — /tɪərz/ plural noun (drops from the eyes)
 *   taerz — /tɛərz/ 3rd-sg-pres verb ("he tears the paper")
 *   tearz — /tɪərz/ 3rd-sg-pres verb ("her eye tears up")
 * Corpus: disambig/tears.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'taers' | 'tears' | 'taerz' | 'tearz' | null}  null = unable to determine
 */
export function disambiguate_tears(tokens, idx) {
  // TODO: implement using rules derived from disambig/tears.txt corpus
  return null;
}
