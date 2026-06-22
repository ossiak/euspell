/**
 * Disambiguates 'wicked': /ˈwɪkɪd/ (2-syllable adjective → 'wicked', e.g. "the
 * wicked witch", "a wicked grin") vs /wɪkt/ (1-syllable past tense of the rare
 * verb "wick", to draw off moisture → 'wickd', e.g. "the fabric wicked it away").
 * Corpus: disambig/wicked.txt
 *
 * Like jagged, 'wicked' is adjective-dominant — its verb is rare (the corpus is
 * 204/204 adjective) — so it uses the conservative active-transitive test rather
 * than the fuller '-ed' engine, staying adjective (also the lexicon's
 * spellings[0]) unless a clear active verb use holds.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */
import { edActiveTransitive } from './ed-adj-verb.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'wicked' | 'wickd'}
 */
export function disambiguate_wicked(tokens, idx) {
  return edActiveTransitive(tokens, idx) ? 'wickd' : 'wicked';
}
