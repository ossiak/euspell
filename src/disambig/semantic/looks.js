/**
 * Disambiguates 'looks' (encoding 202): the plural noun /lʊks/ ("good looks",
 * "her looks" → 'looks') vs the 3rd-sg-present verb ("she looks tired" → 'lookz').
 * Corpus: disambig/_corpus_012_112.txt
 *
 * A high-frequency light/intransitive verb: the verb reading dominates, so it is
 * the default. The noun is taken only on a clear noun-phrase cue immediately
 * before the target — an article, possessive/genitive, cardinal, plural
 * quantifier, attributive adjective, or any preposition — none of which a finite
 * verb can follow.
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
 * @returns {'looks' | 'lookz'}
 */
export function disambiguate_looks(tokens, idx) {
  return isNounContext(tokens[idx - 1]) ? 'looks' : 'lookz';
}
