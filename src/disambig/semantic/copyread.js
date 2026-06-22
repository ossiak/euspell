/**
 * Disambiguates 'copyread': /riːd/ (present/base/infinitive → 'copyread') vs /rɛd/
 * (past tense/participle, incl. attributive → 'copyredd').
 *
 * Shares the context rules with the 'read' family via read-verb.js.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */
import { readVerbReading } from './read-verb.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'copyread' | 'copyredd' | null}  null = unable to determine (use default)
 */
export function disambiguate_copyread(tokens, idx) {
  const r = readVerbReading(tokens, idx);
  return r === 'past' ? 'copyredd' : r === 'base' ? 'copyread' : null;
}
