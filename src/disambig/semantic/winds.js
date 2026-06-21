/**
 * Disambiguates 'winds' (encoding 113, NN2|VVZ) three ways:
 *   winds — /wɪndz/ plural noun (moving air)
 *   windz — /wɪndz/ 3rd-sg-pres verb of /wɪnd/ ("winds him up", "winds the baby")
 *   wyndz — /waɪndz/ 3rd-sg-pres verb of /waɪnd/ (coils/turns: "the road winds")
 * Corpus: disambig/winds.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'winds' | 'windz' | 'wyndz' | null}  null = unable to determine
 */
export function disambiguate_winds(tokens, idx) {
  // TODO: implement using rules derived from disambig/winds.txt corpus
  return null;
}
