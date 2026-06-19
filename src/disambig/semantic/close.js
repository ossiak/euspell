/**
 * Disambiguates 'close': /kloʊs/ (adjective/adverb: near) vs /kloʊz/ (verb: to shut).
 * Corpus: disambig/close.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'close' | 'cloze' | null}  null = unable to determine
 */
export function disambiguate_close(tokens, idx) {
  // TODO: implement using rules derived from disambig/close.txt corpus
  return null;
}
