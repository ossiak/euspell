/**
 * Disambiguates 'sightread': /riːd/ (present/base/infinitive → 'sihtread') vs /rɛd/
 * (past tense/participle, incl. attributive → 'sihtredd').
 *
 * Shares the context rules with the 'read' family via read-verb.js.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */
import { readVerbReading } from './read-verb.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'sihtread' | 'sihtredd' | null}  null = unable to determine (use default)
 */
export function disambiguate_sightread(tokens, idx) {
  const r = readVerbReading(tokens, idx);
  return r === 'past' ? 'sihtredd' : r === 'base' ? 'sihtread' : null;
}
