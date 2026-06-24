/**
 * Disambiguates 'means' (encoding 202): the noun /miːnz/ ("the means", "a means
 * to an end") and the prepositional/adverbial idioms ("by means of", "by no
 * means"), all spelled 'means', vs the 3rd-sg-present verb ("it means" →
 * 'meanz'). Corpus: disambig/_corpus_012_112.txt
 *
 * A high-frequency light verb: the verb reading dominates, so it is the default.
 * The noun is taken only on a clear noun-phrase cue immediately before the
 * target — an article, possessive/genitive, cardinal, plural quantifier,
 * attributive adjective, or any preposition. The preposition cue also captures
 * "by means of" (means tagged II32, after "by"), and the article "no" captures
 * "by no means"; a finite verb can follow none of these.
 *
 * @typedef {import('../../content/context.js').Token} Token
 */

const tagsOf = (tok) => (tok && tok.tag ? tok.tag.split('|') : []);
// Noun-phrase cues that cannot be immediately followed by a finite verb.
const NOUN_CUE = ['AT', 'AT1', 'APPGE', 'GE', 'MC', 'MC2', 'DA2', 'DB2', 'JJ', 'JJR', 'JJT'];
const PREP = ['II', 'IO', 'IF', 'IW'];
const isNounContext = (tok) =>
  tagsOf(tok).some((t) => NOUN_CUE.includes(t) || PREP.some((p) => t.startsWith(p)));

/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'means' | 'meanz'}
 */
export function disambiguate_means(tokens, idx) {
  return isNounContext(tokens[idx - 1]) ? 'means' : 'meanz';
}
