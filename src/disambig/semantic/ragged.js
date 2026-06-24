/**
 * Disambiguates 'ragged': /ˈrægɪd/ (2-syllable adjective → 'ragged', e.g.
 * "ragged clothes", "a ragged edge") vs /rægd/ (1-syllable past tense of the
 * rare verb "rag", to tease/scold → 'ragd'). Corpus: disambig/ragged.txt
 *
 * Adjective-dominant — the verb is rare (the corpus is 200/200 adjective) — so,
 * like jagged/wicked, keep the adjective unless there is an unambiguous active
 * transitive use (a subjective-case pronoun or proper-noun subject immediately
 * before AND an object right after, "they ragged the rookie"). Adjective is the
 * lexicon's spellings[0].
 *
 * @typedef {import('../../content/context.js').Token} Token
 */
import { edActiveTransitive } from './ed-adj-verb.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'ragged' | 'ragd'}
 */
export function disambiguate_ragged(tokens, idx) {
  return edActiveTransitive(tokens, idx) ? 'ragd' : 'ragged';
}
