/**
 * Disambiguates 'dogged' (encoding 022, JJ|VVD|VVN) two ways:
 *   dogd   — /dɒgd/ past tense / past participle verb ("trouble dogged him")
 *   dogged — /ˈdɒgɪd/ adjective ("dogged determination")
 * Corpus: disambig/dogged.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'dogd' | 'dogged' | null}  null = unable to determine
 */
export function disambiguate_dogged(tokens, idx) {
  // TODO: implement using rules derived from disambig/dogged.txt corpus
  return null;
}
