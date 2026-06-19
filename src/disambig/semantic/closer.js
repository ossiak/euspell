/**
 * Disambiguates 'closer': /ˈkloʊsər/ (comparative: nearer) vs /ˈkloʊzər/ (one who closes).
 * Corpus: disambig/closer.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'closer' | 'clozer' | null}  null = unable to determine
 */
export function disambiguate_closer(tokens, idx) {
  // TODO: implement using rules derived from disambig/closer.txt corpus
  return null;
}
