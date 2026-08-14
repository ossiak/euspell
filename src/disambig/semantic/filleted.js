/**
 * Disambiguates 'filleted' (encoding 202, JJ|VVD|VVN): /fɪˈleɪd/ boned, of fish
 * or meat → 'fillehd', vs /ˈfɪlɪtɪd/ given a rounded corner, of an engineered
 * edge → 'filleted', which keeps the traditional spelling.
 *
 * Same axis and same default as fillet.js — the past participle is if anything
 * more strongly food ("filleted the salmon", "filleted and skinned"), so nothing
 * per-form is needed beyond the shared sense test.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { isMachineFillet } from './fillet-sense.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'fillehd' | 'filleted'}
 */
export function disambiguate_filleted(tokens, idx) {
  return isMachineFillet(tokens, idx) ? 'filleted' : 'fillehd';
}
