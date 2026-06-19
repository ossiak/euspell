/**
 * Disambiguates 'secreted': /sɪˈkriːtɪd/ (exuded by a gland) vs /ˈsiːkrətɪd/ (concealed).
 * Corpus: disambig/secreted.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'secreted' | 'secretted' | null}  null = unable to determine
 */
export function disambiguate_secreted(tokens, idx) {
  // TODO: implement using rules derived from disambig/secreted.txt corpus
  return null;
}
