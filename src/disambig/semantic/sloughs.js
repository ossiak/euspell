/**
 * Disambiguates 'sloughs' (encoding 114, NN2|VVZ) four ways:
 *   slouhs — /slaʊz/ plural noun (bogs, mires)
 *   sluhs  — /sluːz/ plural noun (backwater swamps; chiefly N. American)
 *   sloffs — /slʌfs/ plural noun (cast-off layers of dead skin)
 *   sloffz — /slʌfz/ 3rd-sg-pres verb ("the snake sloughs its skin")
 * Corpus: disambig/sloughs.txt
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'slouhs' | 'sluhs' | 'sloffs' | 'sloffz' | null}  null = unable to determine
 */
export function disambiguate_sloughs(tokens, idx) {
  // TODO: implement using rules derived from disambig/sloughs.txt corpus
  return null;
}
