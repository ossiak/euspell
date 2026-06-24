/**
 * Disambiguates 'chis' (encoding 202, NN2|ZZ2) — the plural of "chi", two
 * pronunciations:
 *   chis  — /tʃiːz/ (rhymes with "cheese") the life energy/qi plural, and name
 *           syllables — the unmarked default
 *   qhis  — /kaɪz/ (rhymes with "skies") the Greek letter Χ plural (Greek-letter
 *           names, "chi-squares")
 * Corpus: none — mirrors the base "chi".
 *
 * The /tʃiː/ energy sense dominates, so 'chis' is the default; 'qhis' (/kaɪ/) is
 * the Greek letter, taken only with explicit Greek evidence (an adjacent
 * Greek-letter name, a "chi-square" statistics phrase, or "Greek" nearby). The
 * decision rests only on neighbouring words, never the NN2|ZZ2 tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

const GREEK_LETTERS = new Set([
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota',
  'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau',
  'upsilon', 'phi', 'psi', 'omega',
]);
const STATS_HEAD = new Set(['square', 'squares', 'squared', 'distribution', 'distributions', 'statistic', 'statistics', 'test', 'tests']);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'qhis' | 'chis'}
 */
export function disambiguate_chis(tokens, idx) {
  if (STATS_HEAD.has(wordOf(tokens[idx + 1]))) return 'qhis';
  for (let j = idx - 2; j <= idx + 2; j++) {
    if (j !== idx && tokens[j] && GREEK_LETTERS.has(wordOf(tokens[j]))) return 'qhis';
  }
  for (let j = idx - 3; j <= idx + 3; j++) {
    if (j !== idx && wordOf(tokens[j]) === 'greek') return 'qhis';
  }
  return 'chis';
}
