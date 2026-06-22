/**
 * Disambiguates 'dogged': /ˈdɒɡɪd/ (2-syllable adjective → 'dogged', e.g. "dogged
 * determination", "with dogged persistence") vs /dɒɡd/ (1-syllable past tense/
 * participle verb → 'dogd', e.g. "reporters dogged him", "dogged the hatch",
 * "dogged by misfortune"). Corpus: disambig/dogged.txt
 *
 * Shares the adjective/verb cue engine with the rest of the '-ed' family via
 * ed-adj-verb.js; an undecided residual defaults to the verb (majority reading,
 * 112 vs 76), which is also the lexicon's spellings[0].
 *
 * @typedef {import('../../content/context.js').Token} Token
 */
import { edAdjOrVerb } from './ed-adj-verb.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'dogged' | 'dogd'}
 */
export function disambiguate_dogged(tokens, idx) {
  return edAdjOrVerb(tokens, idx) === 'adj' ? 'dogged' : 'dogd';
}
