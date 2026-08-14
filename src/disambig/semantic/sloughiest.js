/**
 * Disambiguates 'sloughiest' (encoding 103, JJT — superlative adjective) three ways:
 *   sluffiest — /ˈslʌfiəst/ most covered in shed / dead skin
 *   slouhiest — /ˈslaʊiəst/ most boggy or mire-like
 *   sluhiest  — /ˈsluːiəst/ most swamp-like (chiefly N. American)
 * Corpus: none — rules from register/collocation (see slough-sense.js).
 *
 * Superlative of "sloughy": same three senses and the same mire fallback (the
 * traditional boggy adjective), with wound-care vocabulary flipping to the shed
 * sense and navigable-water vocabulary to the backwater sense. The decision
 * rests only on neighbouring words.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { sloughSense } from './slough-sense.js';

const SPELLING = { shed: 'sluffiest', mire: 'slouhiest', backwater: 'sluhiest' };

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sluffiest' | 'slouhiest' | 'sluhiest'}
 */
export function disambiguate_sloughiest(tokens, idx) {
  return SPELLING[sloughSense(tokens, idx, 'mire')];
}
