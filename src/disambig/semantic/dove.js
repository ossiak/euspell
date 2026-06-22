/**
 * Disambiguates 'dove': /doʊv/ (past tense/participle of "dive" → 'dove', e.g.
 * "he dove into the pool") vs /dʌv/ (everything else → 'dov': the bird "the
 * white dove", the surname "Miss Dove", the colour "dove grey").
 * Corpus: disambig/dove.txt
 *
 * The split is really "is this the dived-verb?" — only that is /doʊv/. The verb
 * is the majority, but the lexicon is noun-first (dov|dove), so this rule returns
 * the spelling explicitly (never null), defaulting to the verb.
 *
 * Corpus-derived cues: a capitalized "Dove" is never the verb (a name/bird); a
 * determiner/adjective before, or a copula/verb/noun after, marks the /dʌv/
 * reading (it is a noun head); a preposition/particle/adverb after, or a
 * pronoun/conjunction/noun-subject before, marks the dived-verb.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const tagsOf = (tok) => (tok && tok.tag ? tok.tag.split('|') : []);
const isPre = (tok, prefixes) => tagsOf(tok).some((t) => prefixes.some((p) => t.startsWith(p)));

// Directional complements of the dived-verb ("dove into/down/from"). Locational
// of/in/on/at are excluded — they belong to the bird noun ("dove of peace").
const MOTION = new Set([
  'into', 'onto', 'down', 'under', 'underneath', 'off', 'out', 'through',
  'across', 'toward', 'towards', 'beneath', 'below', 'up', 'from', 'to', 'for',
  'past', 'around', 'after',
]);

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'dov' | 'dove'}
 */
export function disambiguate_dove(tokens, idx) {
  const w1b = tokens[idx - 1];
  const w1a = tokens[idx + 1];

  // Capitalized "Dove" is a name or a sentence-initial bird — never the verb.
  if (/^[A-Z]/.test(tokens[idx]?.word ?? '')) return 'dov';

  // Determiner before ⇒ the bird noun, even with a following preposition
  // ("the dove of peace", "a dove in the tree").
  if (isPre(w1b, ['AT', 'DD', 'APPGE'])) return 'dov';

  // Directional preposition/particle after ⇒ the dived verb ("dove into/down").
  if (isPre(w1a, ['RP']) || MOTION.has((w1a?.word ?? '').toLowerCase())) return 'dove';

  // --- /dʌv/ (noun/name/colour → 'dov') ------------------------------------
  if (isPre(w1a, ['VB', 'VH', 'VD', 'VM', 'VVD', 'VVZ', 'VV0', 'GE'])) return 'dov'; // "dove is/flew/'s"
  if (isPre(w1a, ['NN', 'NP'])) return 'dov';            // "dove hunters/feather" (attributive)
  if (isPre(w1b, ['JJ'])) return 'dov';                  // "white/mourning dove"

  // --- /doʊv/ (dived verb → 'dove') ----------------------------------------
  if (isPre(w1b, ['PP', 'CC', 'NN', 'NP'])) return 'dove'; // "he/and/Tom dove" (subject)
  if (isPre(w1a, ['R'])) return 'dove';                  // "dove quickly/deep"
  return 'dove';                                          // verb is the majority
}
