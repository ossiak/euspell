/**
 * Disambiguates 'chi': /tʃiː/ (rhymes with "tea" → 'chi' — the life energy/qi
 * of "tai chi", and the syllable in names like "Ho Chi Minh" or "Professor
 * Chi") vs /kaɪ/ (rhymes with "eye" → 'qhi' — the Greek letter Χ, as in Greek
 * fraternity/sorority names and "chi-square"). Corpus: disambig/chi.txt
 *
 * The /tʃiː/ energy and name sense dominates the data, so 'chi' is the unmarked
 * default. 'qhi' (/kaɪ/) is the Greek letter, taken only with explicit Greek
 * evidence: an adjacent Greek-letter name (Sigma Delta Chi, Chi Omega), a
 * "chi square/distribution" statistics phrase, or the word "Greek" nearby. The
 * decision rests only on neighbouring words, never the target's own tag.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const wordOf = (tok) => (tok?.word ?? '').toLowerCase().replace(/[.,!?;:'"]+$/, '');

// Greek-letter names: an adjacent one marks "chi" as the letter Χ in a
// fraternity/sorority chapter name (Sigma Delta Chi, Lambda Chi, Chi Omega).
const GREEK_LETTERS = new Set([
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota',
  'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau',
  'upsilon', 'phi', 'psi', 'omega',
]);
// Immediately after "chi": the statistics term ("chi square/squared/distribution").
const STATS_HEAD = new Set(['square', 'squared', 'squares', 'distribution', 'distributions', 'statistic', 'statistics', 'test']);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'qhi' | 'chi'}
 */
export function disambiguate_chi(tokens, idx) {
  // "chi square/distribution" — the statistics term, the Greek letter /kaɪ/.
  if (STATS_HEAD.has(wordOf(tokens[idx + 1]))) return 'qhi';

  // An adjacent Greek-letter name (fraternity chapter), or "Greek" nearby → /kaɪ/.
  for (let j = idx - 2; j <= idx + 2; j++) {
    if (j !== idx && tokens[j] && GREEK_LETTERS.has(wordOf(tokens[j]))) return 'qhi';
  }
  for (let j = idx - 3; j <= idx + 3; j++) {
    if (j !== idx && wordOf(tokens[j]) === 'greek') return 'qhi';
  }

  // Otherwise the unmarked /tʃiː/: the life energy or a name syllable.
  return 'chi';
}
