/**
 * Disambiguates 'reread' (encoding 202, JJ|VV0|VVD|VVN) two ways:
 *   reread — /riːˈriːd/ base/present verb or adjective ("please reread it")
 *   reredd — /riːˈrɛd/ past tense / past participle ("she reread it")
 * Corpus: disambig/reread.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'reread' | 'reredd' | null}  null = unable to determine
 */
export function disambiguate_reread(tokens, idx) {
  // TODO: implement using rules derived from disambig/reread.txt corpus
  return null;
}
