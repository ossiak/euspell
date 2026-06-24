/**
 * Disambiguates 'gets' (encoding 202): the plural noun (rare — e.g. "good gets"
 * in sport → 'gets') vs the 3rd-sg-present verb ("she gets it" → 'getz').
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
 * @returns {'gets' | 'getz'}
 */
export function disambiguate_gets(tokens, idx) {
  return isNounContext(tokens[idx - 1]) ? 'gets' : 'getz';
}
