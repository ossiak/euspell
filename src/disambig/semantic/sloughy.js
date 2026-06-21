/**
 * Disambiguates 'sloughy' (encoding 103, JJ) three ways:
 *   sloffy — /ˈslʌfi/ covered in shed/dead skin
 *   slouhy — /ˈslaʊi/ boggy or mire-like
 *   sluhy  — /ˈsluːi/ swamp-like (chiefly N. American)
 * Corpus: none yet
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sloffy' | 'slouhy' | 'sluhy' | null}  null = unable to determine
 */
export function disambiguate_sloughy(tokens, idx) {
  // TODO: implement (no corpus yet — derive rules from POS/semantic context)
  return null;
}
