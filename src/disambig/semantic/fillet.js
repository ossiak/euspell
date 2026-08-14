/**
 * Disambiguates 'fillet' (encoding 202, NN1|VV0): /fɪˈleɪ/ the boneless cut of
 * fish or meat and the verb for cutting one → 'filleh', vs /ˈfɪlɪt/ the
 * engineering rounded corner, the fillet weld and the architectural band, which
 * keep the traditional spelling → 'fillet'.
 *
 * The whole decision is the shared sense test in fillet-sense.js; the food
 * reading is the unmarked default. See filleh/fillet in the PLS for the two
 * pronunciations — this is the pair the split exists for.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { isMachineFillet } from './fillet-sense.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'filleh' | 'fillet'}
 */
export function disambiguate_fillet(tokens, idx) {
  return isMachineFillet(tokens, idx) ? 'fillet' : 'filleh';
}
