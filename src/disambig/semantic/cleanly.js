/**
 * Disambiguates 'cleanly': /ˈkliːnli/ (manner adverb → 'cleanly', e.g. "cut
 * cleanly", "caught it cleanly") vs /ˈklɛnli/ (the archaic adjective "habitually
 * clean" → 'clenly', e.g. "a cleanly diet", "cleanly animals").
 * Corpus: disambig/cleanly.txt
 *
 * The adverb dominates (197 vs 5) and the attributive adjective has one clean
 * signal: cleanly immediately before a noun (0 adverbs in the corpus precede a
 * noun). So flag the adjective only there; otherwise the adverb. The default is
 * the adverb — note that is spellings[1], NOT the lexicon's adjective-first
 * spellings[0], so this rule must return the spelling explicitly (never null).
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const tagsOf = (tok) => (tok && tok.tag ? tok.tag.split('|') : []);
const isPre = (tok, prefixes) => tagsOf(tok).some((t) => prefixes.some((p) => t.startsWith(p)));

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'clenly' | 'cleanly'}
 */
export function disambiguate_cleanly(tokens, idx) {
  // The following noun only counts as the modified head if cleanly is genuinely
  // attributive — not when it ends a clause ("…cleanly. Fu Manchu") or is
  // coordinated with another adverb ("quickly and cleanly, Fu Manchu …").
  if (tokens[idx]?.breakAfter || isPre(tokens[idx - 1], ['CC'])) return 'cleanly';
  return isPre(tokens[idx + 1], ['NN', 'NP']) ? 'clenly' : 'cleanly';
}
