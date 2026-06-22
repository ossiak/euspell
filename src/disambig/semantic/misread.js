/**
 * Disambiguates 'misread': /riːd/ (present/base/infinitive → 'misread') vs /rɛd/
 * (past tense/participle, incl. attributive → 'misredd').
 * Corpus: disambig/misread.txt
 *
 * Shares the context rules with the 'read' family via read-verb.js.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */
import { readVerbReading } from './read-verb.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'misread' | 'misredd' | null}  null = unable to determine (use default)
 */
export function disambiguate_misread(tokens, idx) {
  const r = readVerbReading(tokens, idx);
  return r === 'past' ? 'misredd' : r === 'base' ? 'misread' : null;
}
