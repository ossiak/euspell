/**
 * Disambiguates 'leads' (encoding 113, NN2|VVZ) three ways:
 *   leads — /liːdz/ plural noun (a clue, a leash, a theatrical lead)
 *   ledds — /lɛdz/  plural noun of the metal/graphite 'lead'
 *   leadz — /liːdz/ 3rd-sg-pres verb ("she leads")
 * Corpus: disambig/leads.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'leads' | 'ledds' | 'leadz' | null}  null = unable to determine
 */
export function disambiguate_leads(tokens, idx) {
  // TODO: implement using rules derived from disambig/leads.txt corpus
  return null;
}
