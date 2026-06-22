/**
 * Disambiguates 'minute': /ˈmɪnɪt/ (unit of time, incl. duration compounds like
 * "ten minute ride" → 'minut') vs /maɪˈnjuːt/ (the adjective "tiny" → 'minute',
 * e.g. "minute details", "the differences are minute").
 * Corpus: disambig/minute.txt
 *
 * The time sense overwhelmingly dominates (184 vs 8) and is the lexicon's
 * spellings[0], so the rule defaults to it. The tiny adjective is flagged only
 * when attributive (immediately before a noun) or predicative (after a copula),
 * and a number before forces the duration reading ("ten/one minute …"), which
 * otherwise looks attributive.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const tagsOf = (tok) => (tok && tok.tag ? tok.tag.split('|') : []);
const isPre = (tok, prefixes) => tagsOf(tok).some((t) => prefixes.some((p) => t.startsWith(p)));

// Finite verb / modal tags (excludes the -ing/-en non-finite forms).
const FINITE = ['VVD', 'VVZ', 'VV0', 'VBZ', 'VBD', 'VBR', 'VBM', 'VHZ', 'VHD', 'VH0', 'VDZ', 'VDD', 'VD0', 'VM'];

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'minut' | 'minute'}
 */
export function disambiguate_minute(tokens, idx) {
  const w1b = tokens[idx - 1];
  const w1a = tokens[idx + 1];

  if (isPre(w1b, ['MC', 'MD'])) return 'minut';      // "ten/one/last/next minute" (duration)

  // Attributive tiny adjective takes a *common* noun ("minute details") — a
  // proper noun after is a new-clause subject ("wait a minute, Keith said"). And
  // if a finite verb follows that noun, the noun heads its own clause, so
  // "minute" is the clause-final time noun ("a minute, son said"; "the minute
  // hand has …") rather than a premodifier.
  if (isPre(w1a, ['NN'])) {
    return isPre(tokens[idx + 2], FINITE) ? 'minut' : 'minute';
  }
  if (isPre(w1b, ['VB'])) return 'minute';           // "are/is minute" (tiny, predicative)
  return 'minut';                                     // unit of time (majority)
}
