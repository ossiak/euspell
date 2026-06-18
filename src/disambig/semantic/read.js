/**
 * Disambiguates 'read': /riːd/ (present/base/infinitive) vs /rɛd/ (past tense/participle).
 * Corpus: disambig/read.txt
 *
 * @typedef {{ word: string, tag: string }} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'reed' | 'red' | null}  null = unable to determine
 */
export function disambiguate_read(tokens, idx) {
  // TODO: implement using rules derived from disambig/read.txt corpus
  return null;
}
