/**
 * Disambiguates 'outread': /riːd/ (present/base/infinitive → 'outread') vs /rɛd/
 * (past tense/participle, incl. attributive → 'outredd').
 * Corpus: disambig/outread.txt
 *
 * Shares the context rules with the 'read' family via read-verb.js.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */
import { readVerbReading } from './read-verb.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'outread' | 'outredd' | null}  null = unable to determine (use default)
 */
export function disambiguate_outread(tokens, idx) {
  const r = readVerbReading(tokens, idx);
  return r === 'past' ? 'outredd' : r === 'base' ? 'outread' : null;
}
