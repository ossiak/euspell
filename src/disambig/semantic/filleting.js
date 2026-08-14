/**
 * Disambiguates 'filleting' (encoding 202, JJ|NN|VVG): /fɪˈleɪɪŋ/ the boning of
 * fish or meat → 'fillehing', vs /ˈfɪlɪtɪŋ/ the engineering operation of adding
 * a rounded corner → 'filleting', which keeps the traditional spelling.
 *
 * Same axis and same default as fillet.js. The gerund is the one form where the
 * machine sense is reasonably common in running text ("filleting the edges" in
 * CAD documentation), but it is still marked, and the shared field scan is what
 * catches it.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { isMachineFillet } from './fillet-sense.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'fillehing' | 'filleting'}
 */
export function disambiguate_filleting(tokens, idx) {
  return isMachineFillet(tokens, idx) ? 'filleting' : 'fillehing';
}
