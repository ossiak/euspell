/**
 * Disambiguates 'learned': /ˈlɜːnɪd/ (adjective: erudite) vs /lɜːnd/ (verb past tense).
 * Corpus: disambig/learned.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'lerned' | 'lernd' | null}  null = unable to determine
 */
export function disambiguate_learned(tokens, idx) {
  // TODO: implement using rules derived from disambig/learned.txt corpus
  return null;
}
