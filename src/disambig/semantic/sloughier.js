/**
 * Disambiguates 'sloughier' (encoding 103, JJR — comparative adjective) three ways:
 *   sloffier — /ˈslʌfiər/ more covered in shed / dead skin
 *   slouhier — /ˈslaʊiər/ more boggy or mire-like
 *   sluhier  — /ˈsluːiər/ more swamp-like (chiefly N. American)
 * Corpus: none — rules from register/collocation (see slough-sense.js).
 *
 * Comparative of "sloughy": same three senses and the same mire fallback (the
 * traditional boggy adjective), with wound-care vocabulary flipping to the shed
 * sense and navigable-water vocabulary to the backwater sense. The decision
 * rests only on neighbouring words.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { sloughSense } from './slough-sense.js';

const SPELLING = { shed: 'sloffier', mire: 'slouhier', backwater: 'sluhier' };

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sloffier' | 'slouhier' | 'sluhier'}
 */
export function disambiguate_sloughier(tokens, idx) {
  return SPELLING[sloughSense(tokens, idx, 'mire')];
}
