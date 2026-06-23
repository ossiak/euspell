/**
 * Disambiguates 'bow': /boʊ/ (rhymes with "go" → 'bow', kept — the archery
 * weapon, a ribbon/knot, a violin bow) vs /baʊ/ (rhymes with "cow" → 'buw' —
 * bending at the waist, and a ship's front). Corpus: disambig/bow.txt
 *
 * The /boʊ/ object senses carry distinctive vocabulary (arrows, quiver, string,
 * yew, ribbon, violin, Cupid's …); the /baʊ/ senses — the verb "to bow", the
 * bending gesture, and the ship's bow — are the unmarked default. So: a ship's
 * bow is /baʊ/; explicit /boʊ/ vocabulary makes it /boʊ/; otherwise it falls to
 * /baʊ/ ('buw'). The decision rests only on neighbouring words, not on the
 * target's own tag (the lexicon tags 'bow' as both NN1 and VV0).
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// /boʊ/ vocabulary — archery, ribbon/knot, violin, the "Cupid's bow" of lips.
const BOW = new Set([
  // archery
  'arrow', 'arrows', 'quiver', 'quivers', 'bowstring', 'string', 'strings', 'strung',
  'slung', 'nock', 'nocked', 'shaft', 'shafts', 'shoot', 'shoots', 'shot', 'shooting',
  'fire', 'fired', 'firing', 'aim', 'aimed', 'arrowhead', 'archer', 'archers', 'archery',
  'yew', 'ash', 'longbow', 'crossbow', 'quarrel', 'fletching', 'unlimbering', 'unlimbered',
  'drew', 'draw', 'drawn', 'notch', 'notched', 'tension', 'range', 'weapon', 'weapons',
  'tulwar', 'six-foot', 'seven-foot', 'curved', 'stubby', 'bigger', 'broken',
  'ordinary', 'tuchuk', 'zen', 'chakra', 'recurve', 'shoulder',
  // ribbon / knot
  'ribbon', 'ribbons', 'satin', 'silk', 'lace', 'velvet', 'tie', 'ties', 'tied', 'knot',
  'bowtie', 'floppy', 'hair', 'lipstick',
  // violin
  'violin', 'violins', 'fiddle', 'fiddles', 'cello', 'cellos', 'strad',
  // Cupid's bow / bow of the lips
  'cupid', 'lips', 'lip', 'mouth',
]);

// Unambiguous ship vocabulary — the ship's bow is /baʊ/, and overrides an
// archery adjective ("broken bow to shattered stern").
const SHIP = new Set(['stern', 'prow', 'hull', 'deck', 'vessel', 'starboard', 'keel', 'rudder', 'forecastle', 'gunwale', 'amidships', 'heeling', 'aft', 'helm']);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'bow' | 'buw'}
 */
export function disambiguate_bow(tokens, idx) {
  // A ship's bow is /baʊ/ — checked first so it wins over an archery adjective.
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && SHIP.has(wordOf(tokens[j]))) return 'buw';
  }

  // Explicit /boʊ/ vocabulary in the clause → the weapon/ribbon/violin.
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && BOW.has(wordOf(tokens[j]))) return 'bow';
  }

  // Otherwise the unmarked /baʊ/: the bending gesture or the ship's bow.
  return 'buw';
}
