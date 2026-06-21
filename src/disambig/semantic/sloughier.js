/**
 * Disambiguates 'sloughier' (encoding 103, JJR — comparative adjective) three ways:
 *   sloffier — /ˈslʌfiər/ more covered in shed/dead skin
 *   slouhier — /ˈslaʊiər/ more boggy or mire-like
 *   sluhier  — /ˈsluːiər/ more swamp-like (chiefly N. American)
 * Corpus: none yet
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sloffier' | 'slouhier' | 'sluhier' | null}  null = unable to determine
 */
export function disambiguate_sloughier(tokens, idx) {
  // TODO: implement (no corpus yet — derive rules from POS/semantic context)
  return null;
}
