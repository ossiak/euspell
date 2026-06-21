/**
 * Disambiguates 'wicked' (encoding 022, JJ|VVD|VVN) two ways:
 *   wicked — /ˈwɪkɪd/ adjective ("the wicked witch")
 *   wickd  — /wɪkt/ past tense / past participle verb ("it wicked away moisture")
 * Corpus: disambig/wicked.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'wicked' | 'wickd' | null}  null = unable to determine
 */
export function disambiguate_wicked(tokens, idx) {
  // TODO: implement using rules derived from disambig/wicked.txt corpus
  return null;
}
