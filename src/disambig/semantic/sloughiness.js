/**
 * Disambiguates 'sloughiness' (encoding 103, NN) three ways:
 *   sluffiness — /ˈslʌfinəs/ the quality of being covered in shed / dead skin
 *   slouhiness — /ˈslaʊinəs/ the quality of being boggy or mire-like
 *   sluhiness  — /ˈsluːinəs/ the quality of being swamp-like (chiefly N. American)
 * Corpus: none — rules from register/collocation (see slough-sense.js).
 *
 * Nominalisation of "sloughy": same three senses and the same mire fallback (the
 * traditional boggy adjective), with wound-care vocabulary flipping to the shed
 * sense and navigable-water vocabulary to the backwater sense. The decision
 * rests only on neighbouring words.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { sloughSense } from './slough-sense.js';

const SPELLING = { shed: 'sluffiness', mire: 'slouhiness', backwater: 'sluhiness' };

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sluffiness' | 'slouhiness' | 'sluhiness'}
 */
export function disambiguate_sloughiness(tokens, idx) {
  return SPELLING[sloughSense(tokens, idx, 'mire')];
}
