/**
 * Disambiguates 'blessed' (encoding 022, JJ|VVD|VVN) two ways:
 *   blessd  — /blɛst/ past tense / past participle verb ("she blessed them")
 *   blessed — /ˈblɛsɪd/ adjective ("a blessed event", "the blessed")
 * Corpus: disambig/blessed.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'blessd' | 'blessed' | null}  null = unable to determine
 */
export function disambiguate_blessed(tokens, idx) {
  // TODO: implement using rules derived from disambig/blessed.txt corpus
  return null;
}
