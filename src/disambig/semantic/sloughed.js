/**
 * Disambiguates 'sloughed' (encoding 123, JJ|VVD|VVN) three ways:
 *   sloffd — /slʌft/ shed/cast off (dead skin)
 *   slouhd — /slaʊd/ relating to a bog or mire
 *   sluhd  — /sluːd/ relating to a backwater swamp (chiefly N. American)
 * Corpus: none yet
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sloffd' | 'slouhd' | 'sluhd' | null}  null = unable to determine
 */
export function disambiguate_sloughed(tokens, idx) {
  // TODO: implement (no corpus yet — derive rules from POS/semantic context)
  return null;
}
