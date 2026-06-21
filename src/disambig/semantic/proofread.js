/**
 * Disambiguates 'proofread' (encoding 202, JJ|VV0|VVD|VVN) two ways:
 *   proofread — /ˈpruːfriːd/ base/present verb or adjective ("please proofread")
 *   proofredd — /ˈpruːfrɛd/ past tense / past participle ("he proofread it")
 * Corpus: disambig/proofread.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'proofread' | 'proofredd' | null}  null = unable to determine
 */
export function disambiguate_proofread(tokens, idx) {
  // TODO: implement using rules derived from disambig/proofread.txt corpus
  return null;
}
