/**
 * Disambiguates 'are' (encoding 202, NNU1|VBR), two readings:
 *   ar  — the present-tense verb "are" (you/we/they are) — the everyday word,
 *         and the unmarked default
 *   are — the metric unit of area (100 m²), as in "an are", "per are"
 * Corpus: none.
 *
 * The verb is essentially the whole distribution, so 'ar' is the default; the
 * area unit ('are') is taken only in its unambiguous frames, where the verb
 * reading is impossible — directly after the article "an" or the distributive
 * "per". The decision rests only on neighbouring words, never the NNU1|VBR tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'are' | 'ar'}
 */
export function disambiguate_are(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);
  // "an are", "per are" — the area unit; the verb can never follow these.
  if (prev === 'an' || prev === 'per') return 'are';
  return 'ar';
}
