/**
 * Disambiguates 'conch' (encoding 202, NN1) two ways — same noun, two
 * pronunciations:
 *   conch — /kɒntʃ/ ("conch" with a soft ending)
 *   conqh — /kɒŋk/ ("conk")
 * Corpus: disambig/conch.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'conch' | 'conqh' | null}  null = unable to determine
 */
export function disambiguate_conch(tokens, idx) {
  // TODO: implement using rules derived from disambig/conch.txt corpus
  return null;
}
