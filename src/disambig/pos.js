/**
 * POS disambiguation utilities.
 * Generated stubs are produced by: node build/gen-disambig.js
 *
 * Each function receives the full token array for a sentence and the index of
 * the target word. Return true if the word matches the named part-of-speech.
 * Obtain the fixed two-before / two-after view with `contextWindow(tokens, idx)`
 * from ../content/context.js — out-of-range and cross-sentence slots arrive as
 * the BOUNDARY sentinel (tag 'ZB'), so clause edges are signal, not absence.
 *
 * @typedef {import('../content/context.js').Token} Token
 */

/**
 * Returns true if the token at `idx` is functioning as a 3rd-person-singular
 * present-tense verb (CLAWS7: VVZ).
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_VVZ(tokens, idx) {
  // TODO: implement
  return false;
}

/**
 * Returns true if the token at `idx` is functioning as a past-tense verb (VVD).
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_past_tense(tokens, idx) {
  // TODO: implement
  return false;
}

/**
 * Returns true if the token at `idx` is functioning as a past participle (VVN).
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_past_participle(tokens, idx) {
  // TODO: implement
  return false;
}

/**
 * Returns true if the token at `idx` is functioning as a plural noun (NN2).
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_plural_noun(tokens, idx) {
  // TODO: implement
  return false;
}

/**
 * Returns true if the token at `idx` is functioning as an adjective (JJ).
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
export function is_adjective(tokens, idx) {
  // TODO: implement
  return false;
}
