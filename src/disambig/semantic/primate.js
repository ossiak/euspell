/**
 * Disambiguates 'primate': /ˈpraɪmət/ (archbishop) vs /ˈpraɪmeɪt/ (mammal).
 * Corpus: disambig/primate.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'primat' | 'primate' | null}  null = unable to determine
 */
export function disambiguate_primate(tokens, idx) {
  // TODO: implement using rules derived from disambig/primate.txt corpus
  return null;
}
