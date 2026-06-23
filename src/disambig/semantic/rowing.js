/**
 * Disambiguates 'rowing': /roʊ/ (rhymes with "going" → 'rowing' — propelling a
 * boat with oars: "a rowing boat", "rowing across the lake") vs /raʊ/ (rhymes
 * with "now" → 'ruwing' — the British colloquial "having a row", quarrelling:
 * "they were rowing about money"). Corpus: disambig/rowing.txt
 *
 * The boat sense dominates entirely, so 'rowing' is the unmarked default.
 * 'ruwing' is the quarrel, taken only with vocabulary that unambiguously denotes
 * a verbal dispute (argued, quarrel, bickered…) — generic anger/intensity words
 * are excluded because they also describe vigorous rowing. The decision rests
 * only on neighbouring words, never the target's own NN|VVG tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Anywhere in the clause window: words that unambiguously denote a verbal
// dispute, marking "rowing" as the "having a row" sense → /raʊ/ ('ruwing').
const QUARREL_FIELD = new Set([
  'argue', 'argued', 'argues', 'arguing', 'argument', 'arguments', 'quarrel',
  'quarrels', 'quarrelled', 'quarreled', 'quarrelling', 'quarreling', 'quarrelsome',
  'bicker', 'bickered', 'bickering', 'squabble', 'squabbled', 'squabbling',
  'feud', 'feuded', 'feuding', 'tiff', 'tiffs',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'rowing' | 'ruwing'}
 */
export function disambiguate_rowing(tokens, idx) {
  // Quarrel vocabulary in the clause → the "having a row" sense, /raʊ/ ('ruwing').
  for (let j = idx - 5; j <= idx + 5; j++) {
    if (j !== idx && tokens[j] && QUARREL_FIELD.has(wordOf(tokens[j]))) return 'ruwing';
  }

  // Otherwise the unmarked /roʊ/: propelling a boat.
  return 'rowing';
}
