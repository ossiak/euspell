/**
 * Disambiguates 'jagged': /ˈdʒæɡɪd/ (2-syllable adjective → 'jagged', e.g.
 * "jagged rocks", "a jagged scar") vs /dʒæɡd/ (1-syllable past tense of the rare
 * verb "jag", to cut/notch → 'jagd'). Corpus: disambig/jagged.txt
 *
 * Unlike blessed/dogged, 'jagged' is adjective-dominant — its verb is archaic
 * (the corpus is 200/200 adjective) — so the shared '-ed' engine's verb cues
 * (e.g. "were jagged", attributive "[noun] jagged [noun]") over-fire. Here we
 * keep the adjective unless there is an unambiguous *active transitive* use: a
 * pronoun or proper-noun subject immediately before AND an object right after
 * ("he jagged his thumb"). Adjective is also the lexicon's spellings[0].
 *
 * @typedef {import('../../content/context.js').Token} Token
 */
import { edActiveTransitive } from './ed-adj-verb.js';

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'jagged' | 'jagd'}
 */
export function disambiguate_jagged(tokens, idx) {
  return edActiveTransitive(tokens, idx) ? 'jagd' : 'jagged';
}
