/**
 * Disambiguates 'cleanly' (encoding 202, JJ|RR) two ways:
 *   clenly  — /ˈklɛnli/ adjective ("a cleanly animal")
 *   cleanly — /ˈkliːnli/ adverb ("cut cleanly")
 * Corpus: disambig/cleanly.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'clenly' | 'cleanly' | null}  null = unable to determine
 */
export function disambiguate_cleanly(tokens, idx) {
  // TODO: implement using rules derived from disambig/cleanly.txt corpus
  return null;
}
