/**
 * Disambiguates 'lead': /lɛd/ (the metal) vs /liːd/ (verb/noun: to guide).
 * Corpus: disambig/lead.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'ledd' | 'lead' | null}  null = unable to determine
 */
export function disambiguate_lead(tokens, idx) {
  // TODO: implement using rules derived from disambig/lead.txt corpus
  return null;
}
