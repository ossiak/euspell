/**
 * Disambiguates 'moires' (encoding 202, NN2): /mwɑˈreɪz/ interference patterns
 * → 'mwarehs', vs /mwɑrz/ watered silks → 'mwars'.
 *
 * Plural noun only — the lexicon gives 'moires' no VVZ reading — so unlike the
 * fillet family there is no noun/verb axis here and the shared sense test is the
 * whole rule.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { isFabricMoire } from './moire-sense.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'mwars' | 'mwarehs'}
 */
export function disambiguate_moires(tokens, idx) {
  return isFabricMoire(tokens, idx) ? 'mwars' : 'mwarehs';
}
