/**
 * Disambiguates 'beloved': /bɪˈlʌvd/ (2-syllable predicative participle →
 * 'belovd', e.g. "she was beloved") vs /bɪˈlʌvɪd/ (3-syllable adjective/noun →
 * 'beloved', e.g. "my beloved wife", "dearly beloved"). Corpus: disambig/beloved.txt
 *
 * The 2-syllable form is taken only in predicative position immediately after
 * the copula "is", "was" or "were" ("is/was/were beloved"); every other use —
 * attributive ("a beloved member"), noun ("his beloved", "dearly beloved"), or
 * preceded by anything else — is the 3-syllable 'beloved'.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const COPULA = new Set(['is', 'was', 'were']);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'belovd' | 'beloved'}
 */
export function disambiguate_beloved(tokens, idx) {
  const prev = (tokens[idx - 1]?.word ?? '').toLowerCase();
  return COPULA.has(prev) ? 'belovd' : 'beloved';
}
