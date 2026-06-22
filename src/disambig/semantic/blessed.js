/**
 * Disambiguates 'blessed': /ˈblɛsɪd/ (2-syllable adjective → 'blessed', e.g. "the
 * blessed event", "truly blessed") vs /blɛst/ (1-syllable past tense/participle
 * verb → 'blessd', e.g. "she blessed him", "blessed by the priest").
 * Corpus: disambig/blessed.txt
 *
 * Decided from the immediate neighbors, ordered by corpus precision: a
 * determiner/preposition before or a noun after marks the attributive/predicative
 * adjective; a be/have auxiliary or pronoun before, or a determiner/pronoun/
 * preposition after (object NP or by/with agent), marks the verb. The residual
 * defaults to the adjective, the majority reading (118 vs 75).
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const tagsOf = (tok) => (tok && tok.tag ? tok.tag.split('|') : []);
const isPre = (tok, prefixes) => tagsOf(tok).some((t) => prefixes.some((p) => t.startsWith(p)));

const DET = ['AT', 'DD', 'APPGE', 'DA', 'DB', 'MC'];   // the/a/every/his/one
const NOUN = ['NN', 'NP'];
const PREP = ['II', 'IO', 'IW', 'IF'];

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'blessed' | 'blessd'}
 */
export function disambiguate_blessed(tokens, idx) {
  const w1b = tokens[idx - 1];
  const w1a = tokens[idx + 1];

  // Proper name "Blessed" (capitalized mid-sentence beside another proper noun,
  // e.g. "Blessed Tregesser", "wife Blessed Alice") is a name — keep it.
  if (/^[A-Z]/.test(tokens[idx]?.word ?? '') && idx > 0 && !tokens[idx - 1]?.breakAfter &&
      (isPre(w1a, ['NP']) || isPre(w1b, ['NP']))) {
    return 'blessed';
  }

  // --- Left neighbor (highest precision) -----------------------------------
  if (isPre(w1b, ['VH', 'VB'])) return 'blessd';   // "was/has/been blessed" (verb)
  if (isPre(w1b, ['PP'])) return 'blessd';         // "he/she blessed" (verb, subject)
  if (isPre(w1b, DET)) return 'blessed';           // "the/a/every/one blessed" (attributive)
  if (isPre(w1b, PREP)) return 'blessed';          // "of blessed memory"

  // Subject + blessed + object ⇒ past verb ("God blessed Abraham/them/the people").
  if (isPre(w1b, NOUN) && (isPre(w1a, NOUN) || isPre(w1a, ['PP', 'AT', 'DD', 'APPGE']))) {
    return 'blessd';
  }

  // --- Right neighbor -------------------------------------------------------
  if (isPre(w1a, ['AT', 'DD', 'APPGE'])) return 'blessd';  // "blessed the/his people" (object)
  if (isPre(w1a, ['PP'])) return 'blessd';                 // "blessed them/him"
  if (isPre(w1a, PREP)) return 'blessd';                   // "blessed by/with/in" (passive/idiom)
  if (isPre(w1a, ['VH', 'VB'])) return 'blessed';          // "blessed be/is" (subject NP)
  if (isPre(w1a, NOUN)) return 'blessed';                  // "blessed instant" (attributive)
  if (isPre(w1a, ['JJ', 'VV'])) return 'blessed';          // "blessed green eyes" / "blessed Virgin appeared"

  // Sentence-initial "Blessed …" is adjectival; so is the residual (majority).
  return 'blessed';
}
