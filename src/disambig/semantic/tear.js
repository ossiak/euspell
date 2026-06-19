/**
 * Disambiguates 'tear': /tɛər/ (to rip) vs /tɪər/ (a teardrop).
 * Corpus: disambig/tear.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'taer' | 'tear' | null}  null = unable to determine
 */
export function disambiguate_tear(tokens, idx) {
  // TODO: implement using rules derived from disambig/tear.txt corpus
  return null;
}
