/**
 * Shared sense classifier for the 'slough' word family (slough, sloughed,
 * sloughy, sloughier, sloughiest, sloughiness). Each of these splits three ways
 * along the same axis:
 *   'shed'      — /slʌf/  cast-off skin / dead tissue (sloff…)
 *   'mire'      — /slaʊ/  a bog or mire; figurative "Slough of Despond" (slouh…)
 *   'backwater' — /sluː/  a backwater swamp / marshy channel (sluh…)
 *
 * The mire and backwater readings are near-synonyms, so shared topical words
 * (mud, water, marsh) cannot separate them; the classifier leans on a few
 * high-precision collocation fields plus a per-word fallback. The fallback
 * differs by word (e.g. the past participle "sloughed" is almost always the shed
 * verb, while the noun "slough" defaults to the literal backwater), so it is
 * passed in by each caller. The decision rests only on neighbouring words.
 *
 * @typedef {import('../../content/context.js').Token} Token
 * @typedef {'shed' | 'mire' | 'backwater'} SloughSense
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Shedding / wound-care vocabulary fixing the cast-off sense → /slʌf/. ("snake"
// alone is excluded — a snake may equally be in a backwater.)
export const SHED_FIELD = new Set([
  'skin', 'skins', 'cells', 'cell', 'scales', 'scale', 'tissue', 'tissues',
  'epidermis', 'eschar', 'membrane', 'callus', 'scab', 'scabs', 'dead',
  'necrotic', 'necrosis', 'gangrene', 'gangrenous', 'wound', 'wounds', 'ulcer',
  'ulcers', 'sore', 'sores', 'debride', 'debridement', 'fibrin', 'exudate',
  'granulation', 'molt', 'molts', 'molted', 'molting', 'moult', 'moulted',
  'moulting', 'shed', 'sheds', 'shedding',
]);

// Abstract states in the figurative "slough of <state>" idiom → /slaʊ/.
export const DESPOND = new Set([
  'despond', 'despondency', 'despair', 'depression', 'misery', 'self-pity',
  'gloom', 'sorrow', 'melancholy', 'sin', 'vice', 'sloth', 'ignorance',
  'indifference', 'complacency', 'doubt', 'hopelessness', 'apathy', 'grief',
  'sadness', 'desolation', 'wretchedness',
]);

// A slough one sinks into → /slaʊ/.
export const MIRE = new Set([
  'mire', 'quagmire', 'bog', 'bottomless', 'impassable', 'sank', 'sunk', 'sink',
  'sinking', 'stuck', 'mired', 'bogged', 'floundered', 'founder', 'foundered',
  'quag', 'mud', 'muddy',
]);

// A slough that holds navigable water → /sluː/.
export const BACKWATER = new Set([
  'tidal', 'backwater', 'channel', 'channels', 'inlet', 'estuary', 'bayou',
  'levee', 'levees', 'delta', 'paddle', 'paddled', 'canoe', 'canoed', 'kayak',
  'boat', 'boated', 'wade', 'waded', 'ford', 'duck', 'ducks', 'waterfowl',
  'heron', 'herons', 'cattails', 'cattail', 'reeds', 'reedy', 'mudflat',
  'mudflats', 'marsh', 'marshy', 'sloughs',
]);

// Terrain nouns that, beside a "sloughy"-type adjective, mark boggy ground →
// /slaʊ/ (the traditional "miry" adjective sense).
export const GROUND = new Set([
  'ground', 'soil', 'land', 'lands', 'field', 'fields', 'meadow', 'meadows',
  'moor', 'moors', 'moorland', 'terrain', 'footing', 'pasture', 'bottom', 'fen',
]);

/** True if any token in ±span around idx (excluding idx) is in `field`. */
function inWindow(tokens, idx, field, span = 4) {
  for (let j = idx - span; j <= idx + span; j++) {
    if (j !== idx && tokens[j] && field.has(wordOf(tokens[j]))) return true;
  }
  return false;
}

/**
 * Classifies a slough-family token into one of the three senses, falling back
 * to `fallback` when no collocation field fires.
 *
 * @param {Token[]} tokens
 * @param {number} idx
 * @param {SloughSense} fallback
 * @returns {SloughSense}
 */
export function sloughSense(tokens, idx, fallback) {
  // Shed: "X off", or shedding / wound-care vocabulary.
  if (wordOf(tokens[idx + 1]) === 'off') return 'shed';
  if (inWindow(tokens, idx, SHED_FIELD)) return 'shed';

  // Mire: the figurative idiom, or sink/quagmire vocabulary.
  if (inWindow(tokens, idx, DESPOND)) return 'mire';
  if (inWindow(tokens, idx, MIRE)) return 'mire';

  // Backwater: navigable-water vocabulary.
  if (inWindow(tokens, idx, BACKWATER)) return 'backwater';

  // Boggy ground beside an adjective form → the miry sense.
  if (inWindow(tokens, idx, GROUND)) return 'mire';

  return fallback;
}
