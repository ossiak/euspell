/**
 * Disambiguates 'read': /riːd/ (present/base/infinitive → 'read') vs /rɛd/
 * (past tense/participle → 'redd'). Corpus: disambig/read.txt
 *
 * Shares the context rules with the rest of the heteronym family via
 * read-verb.js; see readVerbReading for the method and its limits.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */
import { readVerbReading } from './read-verb.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'read' | 'redd' | null}  null = unable to determine (use default)
 */
export function disambiguate_read(tokens, idx) {
  const r = readVerbReading(tokens, idx);
  return r === 'past' ? 'redd' : r === 'base' ? 'read' : null;
}
