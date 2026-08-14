/**
 * Disambiguates 'sloughy' (encoding 103, JJ) three ways:
 *   sluffy — /ˈslʌfi/ covered in shed / dead skin (a "sloughy wound")
 *   slouhy — /ˈslaʊi/ boggy or mire-like
 *   sluhy  — /ˈsluːi/ swamp-like (chiefly N. American)
 * Corpus: none — rules from register/collocation (see slough-sense.js).
 *
 * The traditional adjective "sloughy" means boggy/miry, so the fallback is the
 * mire sense; the medical "sloughy wound/ulcer/tissue" reading is taken on
 * wound-care vocabulary, and the backwater reading on navigable-water
 * vocabulary. Flip the fallback to 'shed' if the input is predominantly medical.
 * The decision rests only on neighbouring words.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { sloughSense } from './slough-sense.js';

const SPELLING = { shed: 'sluffy', mire: 'slouhy', backwater: 'sluhy' };

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sluffy' | 'slouhy' | 'sluhy'}
 */
export function disambiguate_sloughy(tokens, idx) {
  return SPELLING[sloughSense(tokens, idx, 'mire')];
}
