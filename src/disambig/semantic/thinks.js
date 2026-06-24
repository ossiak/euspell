/**
 * Disambiguates 'thinks' (encoding 202): the plural noun (rare — "a few quiet
 * thinks" → 'thinks') vs the 3rd-sg-present verb ("she thinks so" → 'thinkz').
 * Corpus: disambig/_corpus_012_112.txt
 *
 * A high-frequency intransitive verb: the verb reading dominates, so it is the
 * default. The noun is taken only on a clear noun-phrase cue immediately before
 * the target — an article, possessive/genitive, cardinal, plural quantifier,
 * attributive adjective, or any preposition — none of which a finite verb can
 * follow.
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
 * @returns {'thinks' | 'thinkz'}
 */
export function disambiguate_thinks(tokens, idx) {
  return isNounContext(tokens[idx - 1]) ? 'thinks' : 'thinkz';
}
