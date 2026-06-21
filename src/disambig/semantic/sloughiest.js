/**
 * Disambiguates 'sloughiest' (encoding 103, JJT — superlative adjective) three ways:
 *   sloffiest — /ˈslʌfiəst/ most covered in shed/dead skin
 *   slouhiest — /ˈslaʊiəst/ most boggy or mire-like
 *   sluhiest  — /ˈsluːiəst/ most swamp-like (chiefly N. American)
 * Corpus: none yet
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sloffiest' | 'slouhiest' | 'sluhiest' | null}  null = unable to determine
 */
export function disambiguate_sloughiest(tokens, idx) {
  // TODO: implement (no corpus yet — derive rules from POS/semantic context)
  return null;
}
