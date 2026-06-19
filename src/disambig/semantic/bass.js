/**
 * Disambiguates 'bass': /bæs/ (the fish) vs /beɪs/ (low musical register).
 * Corpus: disambig/bass.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bass' | 'basse' | null}  null = unable to determine
 */
export function disambiguate_bass(tokens, idx) {
  // TODO: implement using rules derived from disambig/bass.txt corpus
  return null;
}
