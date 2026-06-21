/**
 * Token-context utilities shared by the converter and the disambiguation rules.
 *
 * A Token carries its surface word, a CLAWS7 PoS tag (empty until a tagger
 * runs), and `breakAfter` — true when a sentence boundary sits immediately
 * after this token.
 *
 * @typedef {{ word: string, tag: string, breakAfter: boolean }} Token
 */

/**
 * Sentinel used for context slots that fall past a text edge or across a
 * sentence boundary. Its non-CLAWS7 tag ('ZB') lets a rule treat the absence of
 * a real neighbor as a positive signal (e.g. clause-initial position) rather
 * than as missing data it has to guard against.
 * @type {Readonly<Token>}
 */
export const BOUNDARY = Object.freeze({ word: '', tag: 'ZB', breakAfter: true });

/**
 * Builds the fixed `[w-2, w-1, target, w+1, w+2]` context window around `idx`.
 * Slots beyond the token array, or separated from the target by a sentence
 * break, are filled with {@link BOUNDARY} so every rule sees a uniform shape
 * regardless of how much real context is available.
 *
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {[Token, Token, Token, Token, Token]}
 */
export function contextWindow(tokens, idx) {
  const at = (i) =>
    i < 0 || i >= tokens.length || crossesSentenceBreak(tokens, idx, i)
      ? BOUNDARY
      : tokens[i];
  return [at(idx - 2), at(idx - 1), tokens[idx], at(idx + 1), at(idx + 2)];
}

/**
 * True when moving between tokens `from` and `to` crosses a sentence boundary.
 * `breakAfter` on token k marks a boundary between k and k+1, so the half-open
 * span `[min, max)` is scanned — direction does not matter.
 *
 * @param {Token[]} tokens
 * @param {number} from
 * @param {number} to
 * @returns {boolean}
 */
export function crossesSentenceBreak(tokens, from, to) {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  for (let k = lo; k < hi; k++) {
    if (tokens[k]?.breakAfter) return true;
  }
  return false;
}
