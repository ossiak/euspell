/**
 * Disambiguates 'does': /dʌz/ (3rd-sg-present of "do" → 'duz', e.g. "she does
 * it", "what does he want") vs /doʊz/ (plural of "doe", female deer → 'does').
 * Corpus: disambig/does.txt
 *
 * The verb is overwhelmingly dominant (the corpus is 205/205 verb); the deer
 * noun is rare and appears only as the head of a plural NP — an article, number,
 * quantifier, or possessive immediately before ("the/two/several/her does"). In
 * the corpus none of those ever precede the verb, so flag the noun only there;
 * everything else is the verb. The default is the verb 'duz', which is
 * spellings[1] — NOT the lexicon's noun-first spellings[0] — so this rule must
 * return the spelling explicitly (never null).
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const tagsOf = (tok) => (tok && tok.tag ? tok.tag.split('|') : []);
const isPre = (tok, prefixes) => tagsOf(tok).some((t) => prefixes.some((p) => t.startsWith(p)));

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'does' | 'duz'}
 */
export function disambiguate_does(tokens, idx) {
  return isPre(tokens[idx - 1], ['AT', 'MC', 'DA2', 'APPGE']) ? 'does' : 'duz';
}
