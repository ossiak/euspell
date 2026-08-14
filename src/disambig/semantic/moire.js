/**
 * Disambiguates 'moire' (encoding 202, JJ|NN|NN1): /mwɑˈreɪ/ the interference
 * pattern → 'mwareh', vs /mwɑr/ the watered-silk cloth → 'mwar'.
 *
 * Both readings are commonly attributive ("moire pattern", "moire silk"), which
 * is why the head noun immediately after is tested before anything else. The
 * pattern sense is the default; see moire-sense.js for why.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { isFabricMoire } from './moire-sense.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'mwar' | 'mwareh'}
 */
export function disambiguate_moire(tokens, idx) {
  return isFabricMoire(tokens, idx) ? 'mwar' : 'mwareh';
}
