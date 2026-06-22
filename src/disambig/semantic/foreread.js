/**
 * Disambiguates 'foreread': /riːd/ (present/base/infinitive → 'foreread') vs /rɛd/
 * (past tense/participle, incl. attributive → 'foreredd').
 *
 * Shares the context rules with the 'read' family via read-verb.js.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */
import { readVerbReading } from './read-verb.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'foreread' | 'foreredd' | null}  null = unable to determine (use default)
 */
export function disambiguate_foreread(tokens, idx) {
  const r = readVerbReading(tokens, idx);
  return r === 'past' ? 'foreredd' : r === 'base' ? 'foreread' : null;
}
