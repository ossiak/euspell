/**
 * Disambiguates 'winding': /ˈwɪndɪŋ/ (air-related) vs /ˈwaɪndɪŋ/ (twisting/turning).
 * Corpus: disambig/winding.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'winding' | 'wynding' | null}  null = unable to determine
 */
export function disambiguate_winding(tokens, idx) {
  // TODO: implement using rules derived from disambig/winding.txt corpus
  return null;
}
