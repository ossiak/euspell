/**
 * Shared sense classifier for 'moire' and its plural 'moires', which split on
 * one axis:
 *   pattern — /mwɑˈreɪ/  the interference pattern: overlaid grids, halftone
 *                        screens, digital sensors, textile weave optics
 *                        ('mwareh…')
 *   fabric  — /mwɑr/     watered silk, the cloth itself ('mwar…')
 *
 * The pattern reading is the unmarked default. That is the opposite of what the
 * spelling history suggests — 'moire' was the cloth and 'moiré' the effect — but
 * the effect is what modern text overwhelmingly means, and euspell has one
 * headword covering both. The fabric sense is therefore taken only on positive
 * textile evidence. The decision rests only on neighbouring words.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Immediately after "moire": the cloth being named ("moire silk/taffeta").
const FABRIC_HEAD = new Set([
  'silk', 'silks', 'taffeta', 'ribbon', 'ribbons', 'dress', 'dresses', 'gown',
  'gowns', 'fabric', 'fabrics', 'cloth', 'sash', 'sashes', 'binding', 'satin',
  'antique', 'faille',
]);
// Immediately after "moire": the optical effect ("moire pattern/fringes").
const PATTERN_HEAD = new Set([
  'pattern', 'patterns', 'patterning', 'effect', 'effects', 'fringe', 'fringes',
  'artifact', 'artifacts', 'artefact', 'artefacts', 'interference', 'aliasing',
  'distortion', 'noise',
]);
// Anywhere in the clause window: textile vocabulary fixing the cloth sense.
const FABRIC_FIELD = new Set([
  'silk', 'silks', 'taffeta', 'satin', 'velvet', 'wool', 'cotton', 'ribbon',
  'ribbons', 'dress', 'dresses', 'gown', 'gowns', 'skirt', 'bodice', 'cloth',
  'textile', 'textiles', 'upholstery', 'watered', 'weave', 'woven', 'loom',
  'curtain', 'curtains', 'drapery', 'garment', 'garments', 'sewn', 'seam',
  'tailor', 'dressmaker', 'yardage', 'bolt',
]);

/**
 * True when the surrounding clause marks the watered-silk sense.
 * @param {Token[]} tokens
 * @param {number} idx
 */
export function isFabricMoire(tokens, idx) {
  const after = wordOf(tokens[idx + 1]);
  if (PATTERN_HEAD.has(after)) return false;
  if (FABRIC_HEAD.has(after)) return true;

  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && FABRIC_FIELD.has(wordOf(tokens[j]))) return true;
  }
  return false; // unmarked: the interference pattern
}
