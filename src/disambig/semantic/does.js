/**
 * Disambiguates 'does' (encoding 202, NN2|VDZ) two ways:
 *   does — /doʊz/ plural noun (female deer, plural of 'doe')
 *   duz  — /dʌz/ 3rd-sg-pres of 'do' ("she does")
 * Corpus: disambig/does.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'does' | 'duz' | null}  null = unable to determine
 */
export function disambiguate_does(tokens, idx) {
  // TODO: implement using rules derived from disambig/does.txt corpus
  return null;
}
