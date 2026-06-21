/**
 * Disambiguates 'sloughiness' (encoding 103, NN) three ways:
 *   sloffiness — /ˈslʌfinəs/ the quality of being covered in shed/dead skin
 *   slouhiness — /ˈslaʊinəs/ the quality of being boggy or mire-like
 *   sluhiness  — /ˈsluːinəs/ the quality of being swamp-like (chiefly N. American)
 * Corpus: none yet
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sloffiness' | 'slouhiness' | 'sluhiness' | null}  null = unable to determine
 */
export function disambiguate_sloughiness(tokens, idx) {
  // TODO: implement (no corpus yet — derive rules from POS/semantic context)
  return null;
}
