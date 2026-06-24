/**
 * Disambiguates 'sounds' (encoding 202): the plural noun ("strange sounds",
 * "the sounds of the city" → 'sounds') vs the 3rd-sg-present verb ("it sounds
 * good" → 'soundz'). Corpus: disambig/_corpus_012_112.txt
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
 * @returns {'sounds' | 'soundz'}
 */
export function disambiguate_sounds(tokens, idx) {
  return isNounContext(tokens[idx - 1]) ? 'sounds' : 'soundz';
}
