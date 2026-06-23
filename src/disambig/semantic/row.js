/**
 * Disambiguates 'row' (encoding 102, NN1|VV0) two ways:
 *   row — /roʊ/ a line or rank ("the front row", "a row of houses"), and the
 *         verb to row a boat
 *   ruw — /raʊ/ a noisy quarrel or commotion ("a blazing row", "a row about
 *         money"), chiefly British
 *
 * The /roʊ/ line/boat sense is by far the most common, so 'row' is the unmarked
 * default. The /raʊ/ quarrel 'ruw' is taken on dispute evidence: a quarrel
 * adjective ("blazing/furious row"), "have/had a row", "a row about …", a
 * "row broke out / erupted" frame, or quarrel/din vocabulary in the clause. The
 * frame "a row of …" is always the line sense and is guarded first. The decision
 * rests only on neighbouring words, never the target's own NN1|VV0 tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Adjectives that pick out the noisy-quarrel sense (/raʊ/).
export const QUARREL_ADJ = new Set([
  'blazing', 'blistering', 'furious', 'almighty', 'slanging', 'screaming',
  'ferocious', 'raging', 'heated', 'almighty', 'blistering',
]);
// Verbs of having / starting a row, found two before ("had a row", "start a row").
const HAVE = new Set([
  'have', 'had', 'has', 'having', 'make', 'made', 'making', 'start', 'started',
  'starts', 'provoke', 'provoked', 'cause', 'caused', 'pick', 'picked',
]);
// Verbs that follow "row" when a quarrel erupts.
export const ERUPT = new Set([
  'broke', 'erupted', 'ensued', 'flared', 'raged', 'developed', 'blew',
  'escalated', 'ignited', 'started',
]);
// Quarrel / din vocabulary anywhere in the clause.
export const QUARREL_FIELD = new Set([
  'argue', 'argued', 'argues', 'arguing', 'argument', 'arguments', 'quarrel',
  'quarrelled', 'quarreled', 'quarrelling', 'quarreling', 'dispute', 'disputed',
  'disagreement', 'squabble', 'squabbled', 'bicker', 'bickered', 'spat', 'feud',
  'shouting', 'yelling', 'slanging', 'din', 'racket', 'commotion', 'uproar',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'row' | 'ruw'}
 */
export function disambiguate_row(tokens, idx) {
  const prev = wordOf(tokens[idx - 1]);
  const prev2 = wordOf(tokens[idx - 2]);
  const next = wordOf(tokens[idx + 1]);

  // "a row of houses / seats / teeth" — always the line, never a quarrel.
  if (next === 'of') return 'row';

  // "a blazing / furious row" — a quarrel.
  if (QUARREL_ADJ.has(prev)) return 'ruw';
  // "a row about / over …" — a public dispute.
  if (next === 'about') return 'ruw';
  // "a row broke out / erupted / flared".
  if (ERUPT.has(next)) return 'ruw';
  // "have / had / start a row".
  if (prev === 'a' && HAVE.has(prev2)) return 'ruw';
  // Quarrel / din vocabulary in the clause.
  for (let j = idx - 4; j <= idx + 4; j++) {
    if (j !== idx && tokens[j] && QUARREL_FIELD.has(wordOf(tokens[j]))) return 'ruw';
  }

  // Otherwise the dominant /roʊ/: a line/rank, or to row a boat.
  return 'row';
}
