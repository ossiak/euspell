/**
 * Disambiguates 'tearing': /ˈtɛərɪŋ/ (rhymes with "airing" → 'taering' — ripping:
 * "tearing the paper", "tearing at it", "a tearing sound") vs /ˈtɪərɪŋ/ (rhymes
 * with "earring" → 'tearing' — eyes welling with tears: "his eyes were tearing",
 * "my tearing eyes"). Corpus: disambig/tearing.txt
 *
 * The ripping sense overwhelmingly dominates, so 'taering' is the unmarked
 * default. The watery-eyes /tɪər/ sense is taken only with eye evidence: "eyes
 * tearing" (the eyes as subject) or attributive "my/his tearing eyes". The
 * possessive requirement keeps the rip reading of "tearing eyes out" (gouging)
 * as 'taering'. The decision rests only on neighbouring words, never the
 * target's own JJ|NN|VVG tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

const EYE = new Set(['eye', 'eyes', 'eyelid', 'eyelids']);
const POSSESSIVE = new Set(['my', 'his', 'her', 'the', 'your', 'their', 'its', 'a']);
// Copula/aux that can stand between an eye subject and "tearing" ("eyes were
// tearing", "eyes began tearing", "eyes kept tearing").
const EYE_AUX = new Set(['were', 'was', 'are', 'is', 'be', 'been', 'began', 'kept', 'started', 'still', 'now', 'already']);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'taering' | 'tearing'}
 */
export function disambiguate_tearing(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);
  const next = wordOf(tokens[idx + 1]);

  // "(his) eyes tearing (up)" — the eyes as subject, welling with tears, with an
  // optional copula/aux between ("eyes were tearing", "eyes began tearing").
  if (EYE.has(prev)) return 'tearing';
  if (EYE_AUX.has(prev) && EYE.has(wordOf(tokens[idx - 2]))) return 'tearing';
  // Attributive "my/his tearing eyes" — watery eyes. The possessive keeps the
  // gouging "tearing eyes out" (no possessive before) as the rip default.
  if (EYE.has(next) && POSSESSIVE.has(prev)) return 'tearing';

  // Otherwise the unmarked /tɛər/: ripping.
  return 'taering';
}
