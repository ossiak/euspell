/**
 * Disambiguates 'rowed': /roʊd/ (rhymes with "road" → 'rowd' — propelled a boat
 * with oars: "rowed across the lake") vs /raʊd/ (rhymes with "loud" → 'ruwd' —
 * the British colloquial "had a row", quarrelled: "they rowed about money").
 * Corpus: disambig/rowed.txt
 *
 * The boat sense dominates entirely, so 'rowd' is the unmarked default. 'ruwd'
 * is the quarrel, taken only with clear argument vocabulary in the clause
 * (argued, quarrel, bickered…). The decision rests only on neighbouring words,
 * never the target's own VVD|VVN tag (both senses are verbs).
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Anywhere in the clause window: quarrel vocabulary, which marks "rowed" as the
// "had a row" sense → /raʊd/ ('ruwd').
// Only words that unambiguously denote a verbal dispute — generic anger or
// intensity words (furiously, stormed, screamed) are excluded because they also
// describe vigorous rowing ("the oarsmen rowed furiously").
const QUARREL_FIELD = new Set([
  'argue', 'argued', 'argues', 'arguing', 'argument', 'arguments', 'quarrel',
  'quarrels', 'quarrelled', 'quarreled', 'quarrelling', 'quarreling', 'quarrelsome',
  'bicker', 'bickered', 'bickering', 'squabble', 'squabbled', 'squabbling',
  'feud', 'feuded', 'feuding', 'tiff', 'tiffs',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'rowd' | 'ruwd'}
 */
export function disambiguate_rowed(tokens, idx) {
  // Quarrel vocabulary in the clause → the "had a row" sense, /raʊd/ ('ruwd').
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && QUARREL_FIELD.has(wordOf(tokens[j]))) return 'ruwd';
  }

  // Otherwise the unmarked /roʊd/: propelled a boat.
  return 'rowd';
}
