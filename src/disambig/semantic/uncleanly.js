/**
 * Disambiguates 'uncleanly' (encoding 202, JJ|RR), two readings:
 *   uncleanly — /ʌnˈkliːnli/ the manner adverb ("done uncleanly", "cut
 *               uncleanly") — not in a clean manner
 *   unclenly  — /ʌnˈklɛnli/ the adjective "habitually unclean / dirty"
 *               ("uncleanly habits", "an uncleanly room")
 * Corpus: none — mirrors the base "cleanly".
 *
 * As with "cleanly", the adjective has one clean signal — attributive position
 * immediately before a noun — so flag it only there; otherwise the adverb. The
 * adverb is the default; note that is spellings[1], not the lexicon's
 * adjective-first spellings[0], so the rule returns the spelling explicitly.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const tagsOf = (tok) => (tok && tok.tag ? tok.tag.split('|') : []);
const isPre = (tok, prefixes) => tagsOf(tok).some((t) => prefixes.some((p) => t.startsWith(p)));

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'unclenly' | 'uncleanly'}
 */
export function disambiguate_uncleanly(tokens, idx) {
  // Not attributive when it ends a clause or is coordinated with another adverb.
  if (tokens[idx]?.breakAfter || isPre(tokens[idx - 1], ['CC'])) return 'uncleanly';
  return isPre(tokens[idx + 1], ['NN', 'NP']) ? 'unclenly' : 'uncleanly';
}
