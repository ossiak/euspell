/**
 * Disambiguates 'primates': /ˈpraɪməts/ (archbishops) vs /ˈpraɪmeɪts/ (mammals).
 * Corpus: disambig/primates.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'primats' | 'primates' | null}  null = unable to determine
 */
export function disambiguate_primates(tokens, idx) {
  // TODO: implement using rules derived from disambig/primates.txt corpus
  return null;
}
