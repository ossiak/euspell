/**
 * Disambiguates 'proofread': /riːd/ (present/base/infinitive → 'proofread') vs /rɛd/
 * (past tense/participle, incl. attributive → 'proofredd').
 * Corpus: disambig/proofread.txt
 *
 * Shares the context rules with the 'read' family via read-verb.js.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */
import { readVerbReading } from './read-verb.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'proofread' | 'proofredd' | null}  null = unable to determine (use default)
 */
export function disambiguate_proofread(tokens, idx) {
  const r = readVerbReading(tokens, idx);
  return r === 'past' ? 'proofredd' : r === 'base' ? 'proofread' : null;
}
