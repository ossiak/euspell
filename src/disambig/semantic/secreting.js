/**
 * Disambiguates 'secreting': /sɪˈkriːtɪŋ/ (exuding) vs /ˈsiːkrətɪŋ/ (concealing).
 * Corpus: disambig/secreting.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'secreting' | 'secretting' | null}  null = unable to determine
 */
export function disambiguate_secreting(tokens, idx) {
  // TODO: implement using rules derived from disambig/secreting.txt corpus
  return null;
}
