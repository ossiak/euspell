/**
 * Disambiguates 'rows' (encoding 114, NN2|VVZ) four ways, on two axes — the
 * vowel (/roʊ/ vs /raʊ/) and part of speech (noun vs verb):
 *   rows — /roʊz/ plural noun: lines, ranks ("rows of seats")
 *   rowz — /roʊz/ the verb, /roʊ/ sense (rowing a boat: "she rows across")
 *   ruws — /raʊz/ plural noun: noisy quarrels ("blazing rows", chiefly British)
 *   ruwz — /raʊz/ the verb, /raʊ/ sense (quarrelling: "he rows with them")
 * Corpus: disambig/rows.txt
 *
 * Only the vowel is pronunciation-critical: rows/rowz are homophones (/roʊz/),
 * as are ruws/ruwz (/raʊz/). The /roʊ/ senses — lines and rowing a boat —
 * overwhelmingly dominate (the corpus has no quarrels at all), so /roʊ/ is the
 * unconditional default and a noun misread as a verb cannot flip the vowel. The
 * /raʊ/ quarrel is taken only on dispute evidence: a quarrel adjective ("blazing
 * rows"), "rows about/over …", a "rows broke out / erupted" frame, "had/have
 * rows", or quarrel/din vocabulary in the clause. The line frame "rows of …" (and
 * the "rows and rows" reduplication) is guarded first. The noun/verb split is
 * then resolved by the shared is_VVZ test; because each vowel's two spellings are
 * homophones, a wrong POS guess is only an orthographic slip. The decision rests
 * only on neighbouring words, never the target's own NN2|VVZ tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

import { is_VVZ } from '../pos.js';
import { QUARREL_ADJ, ERUPT, QUARREL_FIELD } from './row.js';

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Quarrel pre-modifiers for the plural — the singular set plus relational and
// intensity adjectives that describe disputes, not physical line layouts
// (physical descriptors like "even/neat/long/straight" stay out). The "rows of"
// guard runs first, so a quarrel adjective can never be read off "blazing rows
// of soldiers".
const QUARREL_MOD = new Set([
  ...QUARREL_ADJ, 'marital', 'domestic', 'family', 'public', 'petty', 'bitter',
  'ugly', 'nasty', 'violent', 'terrible', 'constant', 'frequent', 'occasional',
  'monumental', 'spectacular', 'epic',
]);
// "had / have / start rows" — the dispute as object of a having verb.
const HAVE = new Set([
  'have', 'had', 'has', 'having', 'start', 'started', 'starts', 'provoke',
  'provoked', 'cause', 'caused', 'pick', 'picks', 'picked', 'avoid', 'avoided',
]);
// Physical / extent / count pre-modifiers that fix the line sense — they describe
// a layout, never a quarrel, so "endless/winding/long/few rows" stays /roʊ/ even
// when a locative "about"/"over" follows ("long rows about the ropes").
const LINE_MOD = new Set([
  'long', 'short', 'even', 'uneven', 'neat', 'straight', 'parallel', 'serried',
  'tidy', 'orderly', 'regular', 'winding', 'narrow', 'wide', 'double', 'triple',
  'concentric', 'endless', 'twin', 'staggered', 'successive', 'alternating',
  'tight', 'close', 'deep', 'ragged', 'crooked', 'vertical', 'horizontal',
  'diagonal', 'few', 'several', 'many', 'numerous', 'countless',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'rows' | 'rowz' | 'ruws' | 'ruwz'}
 */
export function disambiguate_rows(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);
  const next = wordOf(tokens[idx + 1]);
  const verb = is_VVZ(tokens, idx);

  // "rows of seats", "rows and rows of …" — always the line, never a quarrel.
  if (next === 'of') return verb ? 'rowz' : 'rows';
  if (next === 'and' && wordOf(tokens[idx + 2]) === 'rows') return 'rows';
  if (prev === 'and' && wordOf(tokens[idx - 2]) === 'rows') return 'rows';
  // "arranged/standing in rows", or a layout pre-modifier ("long/endless rows") —
  // the line sense, guarded before any locative "about"/"over" can be misread.
  if (prev === 'in') return verb ? 'rowz' : 'rows';
  if (LINE_MOD.has(prev)) return verb ? 'rowz' : 'rows';

  let quarrel = false; // /raʊ/

  if (QUARREL_MOD.has(prev)) quarrel = true;
  if (next === 'about' || next === 'over') quarrel = true; // "rows about money"
  if (ERUPT.has(next)) quarrel = true;                     // "rows broke out"
  if (HAVE.has(prev)) quarrel = true;                      // "had rows"
  for (let j = idx - 4; j <= idx + 4; j++) {
    if (j !== idx && tokens[j] && QUARREL_FIELD.has(wordOf(tokens[j]))) quarrel = true;
  }

  // Default to the /roʊ/ line/boat sense; the homophonic noun/verb spelling is
  // picked by is_VVZ.
  if (!quarrel) return verb ? 'rowz' : 'rows';
  return verb ? 'ruwz' : 'ruws';
}
