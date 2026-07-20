/**
 * Disambiguates 'putting': the gerund of "putt" (/ˈpʌtɪŋ/, golf → 'putting',
 * unreformed) vs the gerund of "put" (/ˈpʊtɪŋ/ → 'pooting', since "put" itself
 * reforms to "poot" alongside foot and soot). Corpus: disambig/putting.txt
 *
 * The "put" sense overwhelms the data: of 16,852 corpus lines containing
 * "putting", fewer than fifty are golf, and the words that follow are the
 * placing sense's own furniture — "putting the/it/a/his", "putting on/up/out/
 * in/together/down". So 'pooting' is the unmarked default and 'putting' is
 * taken only on explicit golf evidence.
 *
 * That evidence is dominated by one fixed collocation. "putting green(s)"
 * accounts for 35 of the golf lines on its own; the rest are a golf noun the
 * gerund modifies ("putting stroke", "putting average") or a genuinely
 * golf-specific word close by. The window is deliberately tight — a line like
 * "putting up several hotels and a golf course" has "golf" six tokens away and
 * must NOT be read as golf, which is why "golf" is not enough at any distance.
 *
 * The decision rests only on neighbouring words, never on the target's NN|VVG
 * tag: both senses are gerunds and carry the same tags.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Immediately after "putting": the head noun of a golf compound. "green" is by
// far the commonest ("the putting green"), the rest are the gerund used
// attributively of the stroke itself.
const GOLF_HEAD = new Set([
  'green', 'greens', 'stroke', 'strokes', 'practice', 'style', 'surface',
  'average', 'averages', 'contest', 'contests', 'competition', 'ability', 'stats',
]);

// Unambiguously golf, and only counted within a few tokens. Words that merely
// co-occur with golf writing ("green", "hole", "stroke", "links", "course") are
// excluded — they are common enough elsewhere to swamp a 0.3% sense.
const GOLF_NEAR = new Set([
  'putt', 'putts', 'putted', 'putter', 'putters',
  'golfer', 'golfers', 'birdie', 'birdies', 'bogey', 'bogeys',
  'fairway', 'fairways', 'caddie', 'caddies',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'putting' | 'pooting'}
 */
export function disambiguate_putting(tokens, idx) {
  // "putting green", "putting stroke" — the gerund modifying a golf noun.
  if (GOLF_HEAD.has(wordOf(tokens[idx + 1]))) return 'putting';

  // A golf-specific word within a tight window: "his putting was poor" beside
  // putts/putter, "practising his putting" near a caddie.
  for (let j = idx - 4; j <= idx + 4; j++) {
    if (j !== idx && tokens[j] && GOLF_NEAR.has(wordOf(tokens[j]))) return 'putting';
  }

  // Otherwise the unmarked sense: placing something somewhere.
  return 'pooting';
}
