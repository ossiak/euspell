/**
 * Disambiguates 'sloughed' (encoding 123, JJ|VVD|VVN) three ways:
 *   sloffd — /slʌft/ shed / cast off (dead skin, "sloughed off")
 *   slouhd — /slaʊd/ relating to a bog or mire
 *   sluhd  — /sluːd/ relating to a backwater swamp (chiefly N. American)
 * Corpus: none — rules from register/collocation (see slough-sense.js).
 *
 * As a past tense / participle, "sloughed" is almost always the shed verb (the
 * swamp senses are nouns, with no past-tense form), so the fallback is the shed
 * sense; the rare adjectival mire/backwater readings are taken only on explicit
 * swamp collocation. The decision rests only on neighbouring words.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { sloughSense } from './slough-sense.js';

const SPELLING = { shed: 'sloffd', mire: 'slouhd', backwater: 'sluhd' };

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sloffd' | 'slouhd' | 'sluhd'}
 */
export function disambiguate_sloughed(tokens, idx) {
  return SPELLING[sloughSense(tokens, idx, 'shed')];
}
