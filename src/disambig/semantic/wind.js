/**
 * Disambiguates 'wind': /wɪnd/ (rhymes with "tinned" → 'wind' — the moving air,
 * a noun: "the cold wind", "a gust of wind", "get wind of") vs /waɪnd/ (rhymes
 * with "mind" → 'wynd' — the verb to coil or turn, and the phrasals "wind up /
 * wind down": "wind the clock", "they wind up here", "I need to wind down").
 * Corpus: disambig/wind.txt
 *
 * The moving-air noun overwhelmingly dominates, so 'wind' is the unmarked
 * default. The /waɪnd/ verb is taken on verb evidence: the phrasals "wind up /
 * down / back", the infinitive "to wind <object>", or a transitive "wind the
 * clock / their way". A noun premodifier before "wind" (article, possessive, or
 * a wind adjective) suppresses the verb rules so idioms like "got the wind up"
 * stay nouns. The decision rests only on neighbouring words, never the target's
 * own JJ|NN|NN1|VV0 tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Premodifiers that mark "wind" as a (premodified) noun head — the moving-air
// /wɪnd/. When one of these precedes, the verb rules are suppressed so idioms
// like "got the wind up" and "a cold wind" stay the noun.
const NOUN_MARKER = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those',
  'my', 'your', 'his', 'her', 'its', 'their', 'our',
  'some', 'any', 'no', 'much', 'more', 'less', 'every', 'each', 'another', 'enough',
  // adjectives that commonly premodify "wind"
  'cold', 'hot', 'warm', 'cool', 'chill', 'chilly', 'icy', 'freezing', 'frozen',
  'bitter', 'biting', 'keen', 'strong', 'high', 'low', 'light', 'gentle', 'fresh',
  'sharp', 'bleak', 'raw', 'wild', 'fierce', 'howling', 'gusty', 'brisk', 'stiff',
  'steady', 'ill', 'divine', 'black', 'contrary', 'prevailing', 'ferocious',
  'north', 'south', 'east', 'west', 'northern', 'southern', 'eastern', 'western',
  'sea', 'night', 'winter', 'summer', 'autumn', 'morning', 'evening', 'desert',
  'polar', 'arctic', 'ocean', 'mountain', 'hurricane', 'gale', 'good', 'nasty',
]);

// Particles that form the phrasal verbs "wind up / down / back" → /waɪnd/.
const PARTICLE = new Set(['up', 'down', 'back']);

// Objects/determiners that can follow the infinitive "to wind …" or a bare
// transitive "wind …", confirming the coil verb.
const OBJECT_DET = new Set([
  'the', 'a', 'an', 'it', 'them', 'him', 'her', 'my', 'your', 'his', 'its',
  'their', 'our', 'this', 'that', 'one', 'some', 'each', 'another',
]);

// Concrete things one winds (coils) — for "wind the clock", "wind their way".
const COIL_OBJECT = new Set([
  'clock', 'clocks', 'watch', 'watches', 'spring', 'springs', 'thread', 'threads',
  'yarn', 'string', 'strings', 'wool', 'rope', 'ropes', 'cord', 'cords', 'wire',
  'wires', 'bandage', 'bandages', 'handle', 'crank', 'key', 'reel', 'reels', 'tape',
  'bobbin', 'garland', 'scarf', 'ribbon', 'ribbons', 'coil', 'cloth', 'turban',
  'clockwork', 'gramophone', 'way', 'ways', 'path', 'course', 'road',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'wind' | 'wynd'}
 */
export function disambiguate_wind(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);
  const next = wordOf(tokens[idx + 1]);
  const next2 = wordOf(tokens[idx + 2]);

  // Infinitive "to wind <object/particle>" — the coil verb /waɪnd/. Prepositional
  // "to wind" (… and rain) is followed by a conjunction/punctuation, not an
  // object, so it stays the noun.
  if (prev === 'to' && (PARTICLE.has(next) || OBJECT_DET.has(next))) return 'wynd';

  // A noun premodifier before "wind" fixes the moving-air noun /wɪnd/, blocking
  // the phrasal-verb reading of idioms like "got the wind up".
  if (NOUN_MARKER.has(prev)) return 'wind';

  // Phrasal "wind up / wind down / wind back" → /waɪnd/.
  if (PARTICLE.has(next)) return 'wynd';

  // Transitive "wind the clock", "wind a bandage", "wind their way".
  if (OBJECT_DET.has(next) && COIL_OBJECT.has(next2)) return 'wynd';

  // Otherwise the unmarked /wɪnd/: moving air.
  return 'wind';
}
