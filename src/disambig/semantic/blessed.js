/**
 * Disambiguates 'blessed': /ˈblɛsɪd/ (2-syllable adjective → 'blessed', e.g. "the
 * blessed event", "truly blessed") vs /blɛst/ (1-syllable past tense/participle
 * verb → 'blessd', e.g. "she blessed him", "blessed by the priest").
 * Corpus: disambig/blessed.txt (93% accuracy)
 *
 * Shares the adjective/verb cue engine with the rest of the '-ed' family via
 * ed-adj-verb.js; an undecided residual defaults to the adjective (majority
 * reading, 118 vs 75).
 *
 * @typedef {import('../../content/context.js').Token} Token
 */
import { edAdjOrVerb } from './ed-adj-verb.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'blessed' | 'blessd'}
 */
export function disambiguate_blessed(tokens, idx) {
  return edAdjOrVerb(tokens, idx) === 'verb' ? 'blessd' : 'blessed';
}
