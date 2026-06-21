/**
 * Disambiguates 'jagged' (encoding 022, JJ|VVD|VVN) two ways:
 *   jagged — /ˈdʒægɪd/ adjective ("jagged rocks")
 *   jagd   — /dʒægd/ past tense / past participle verb
 * Corpus: disambig/jagged.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'jagged' | 'jagd' | null}  null = unable to determine
 */
export function disambiguate_jagged(tokens, idx) {
  // TODO: implement using rules derived from disambig/jagged.txt corpus
  return null;
}
