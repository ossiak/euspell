/**
 * Disambiguates 'chi': /kaɪ/ (Greek letter Χ) vs /tʃiː/ (life energy, qi).
 * Corpus: disambig/chi.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'qhi' | 'chi' | null}  null = unable to determine
 */
export function disambiguate_chi(tokens, idx) {
  // TODO: implement using rules derived from disambig/chi.txt corpus
  return null;
}
