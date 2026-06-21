/**
 * Disambiguates 'ragged' (encoding 022, JJ|VVD|VVN) two ways:
 *   ragged — /ˈrægɪd/ adjective ("ragged clothes")
 *   ragd   — /rægd/ past tense / past participle verb ("they ragged him")
 * Corpus: disambig/ragged.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'ragged' | 'ragd' | null}  null = unable to determine
 */
export function disambiguate_ragged(tokens, idx) {
  // TODO: implement using rules derived from disambig/ragged.txt corpus
  return null;
}
