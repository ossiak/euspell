/**
 * Disambiguates 'winding': /ˈwaɪndɪŋ/ (the participle/adjective/noun of the coil
 * verb "wind" → 'wynding' — twisting and turning: "a winding road", "a winding
 * staircase", "winding up the clock", "winding down", "winding their way", and
 * the coil nouns "winding gear / energy / sheet") vs /ˈwɪndɪŋ/ (the breath verb,
 * to knock the wind out of someone → 'winding', e.g. "I hit the ground, winding
 * myself"). Corpus: disambig/winding.txt
 *
 * The twisting /waɪnd/ sense overwhelmingly dominates — the moving-air / breath
 * sense barely appears — so here, unlike bare "wind", 'wynding' is the unmarked
 * default. The /ˈwɪndɪŋ/ 'winding' is taken only on the narrow breath pattern:
 * "winding <person>" with the person as a bare object and no following particle,
 * which knocks the wind out of them (vs "winding him up" = teasing, /waɪnd/).
 * The decision rests only on neighbouring words, never the target's own
 * JJ|NN|NN1|VVG tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Bare object/reflexive pronouns naming a person. "winding <one of these>" with
// no continuation particle is the breath sense — knocking the wind out of them.
// Possessive/ambiguous forms (her/his/your/you) are excluded: "winding her
// crossbow" / "winding you up" are the twisting /waɪnd/ sense.
const BREATH_OBJECT = new Set([
  'myself', 'himself', 'herself', 'themselves', 'yourself', 'yourselves',
  'ourselves', 'oneself', 'me', 'him', 'them', 'us',
]);

// Particles/prepositions that, after the object, make it the twisting phrasal
// "winding him up / winding them into …" rather than the breath sense.
const CONTINUATION = new Set([
  'up', 'down', 'in', 'out', 'back', 'around', 'round', 'about', 'through',
  'along', 'between', 'among', 'over', 'into', 'on', 'off', 'toward', 'towards',
  'across', 'past', 'and',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'winding' | 'wynding'}
 */
export function disambiguate_winding(tokens, idx) {
  const next = wordOf(tokens[idx + 1]);
  const next2 = wordOf(tokens[idx + 2]);

  // "winding myself / him / them" as a bare object — the breath verb /ˈwɪndɪŋ/.
  // A continuation particle ("winding him up") turns it back into the twisting
  // sense, so it is excluded.
  if (BREATH_OBJECT.has(next) && !CONTINUATION.has(next2)) return 'winding';

  // Otherwise the unmarked /ˈwaɪndɪŋ/: twisting, coiling, "wind up/down".
  return 'wynding';
}
