import { data as lexicon } from '../../dist/lexicon.js';
import { getContraction } from './contractions.js';
import { is_VVZ, is_verbal_s, is_plural_noun, is_verb_VV0 } from '../disambig/pos.js';
import { SEMANTIC } from '../disambig/semantic/index.js';

/** @typedef {import('./context.js').Token} Token */

// Words carrying a disambiguation encoding (202/022) that should nonetheless be
// left exactly as written — their euspellings aren't worth choosing between, so
// the original surface form is kept regardless of context.
const KEEP_UNCHANGED = new Set(['bach', 'chis', 'conch', 'ravined']);

// Words whose lexicon entry keeps two possible spellings, but where one is far
// more common — so they are treated as a single (101) spelling: disambiguation
// is skipped and the common form is always applied. Both spellings stay in the
// lexicon; this just fixes the choice. Keyed by lowercase word → chosen spelling.
const FORCE_SPELLING = new Map([
  ['are', 'ar'],
  ['barred', 'barrd'],
  ['bowings', 'buwings'],
  ['longed', 'longd'],
  ['unbowed', 'unbuwd'],
  ['unbowing', 'unbuwing'],
  ['uncleanly', 'unclenly'],
]);

/**
 * Converts a single word to its euspelling given surrounding token context.
 * @param {string} word
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {string}
 */
export function convert(word, tokens, idx) {
  // The pronoun "I" reforms to "ih". It is the one word whose case is NOT taken
  // from the source: written English always capitalizes "I", but "ih" is a
  // common word, so it follows normal capitalization — lowercase mid-sentence,
  // capitalized only at the start of a sentence.
  if (word === 'I') {
    return isSentenceStart(tokens, idx) ? 'Ih' : 'ih';
  }

  // Abbreviations are consulted only for their PoS (via tagger.js), never for
  // replacement — so the spelling lookup uses the lexicon and contractions only.
  // getContraction() normalizes case and apostrophe style (I'll, don’t).
  const key = word.toLowerCase();
  if (KEEP_UNCHANGED.has(key)) return word;
  const forced = FORCE_SPELLING.get(key);
  if (forced !== undefined) return matchCase(word, forced);
  const entry = lexicon.get(key) ?? getContraction(word);
  if (!entry) return word;

  // The encoding's last digit is the euspelling count: 0 ⇒ word unchanged,
  // 1 ⇒ one spelling, ≥2 ⇒ disambiguate between spellings. The ?? guards
  // entries whose euspelling field is [] despite a non-zero last digit.
  const variants = entry.encoding % 10;
  if (variants === 0) return word;
  if (variants === 1) return matchCase(word, entry.spellings[0] ?? word);

  const spellingIdx = route(key, entry, tokens, idx);
  return matchCase(word, entry.spellings[spellingIdx] ?? word);
}

/**
 * Selects the spelling index for an entry with multiple euspellings. Dispatches
 * on the POS pair (pos.js rules, which return an index) or the surface word
 * (semantic rules, which return a euspelling mapped back to its index). Each
 * rule reads the lexically-tagged token stream (dom-walker → tagger.js).
 * @param {string} key  lowercase surface word
 * @param {import('../../dist/lexicon.js').LexiconEntry} entry
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {number}
 */
function route(key, entry, tokens, idx) {
  const { pos } = entry;
  // NN2|VVZ diatones (e.g. "records"): plural noun → spellings[0], verb → spellings[1].
  if (pos.length === 2 && pos[0] === 'NN2' && pos[1] === 'VVZ') {
    return is_VVZ(tokens, idx) ? 1 : 0;
  }
  // The clitic 's: genitive ('s, spellings[0]) vs contracted is/has ('z, [1]).
  if (pos.includes('GE')) {
    return is_verbal_s(tokens, idx) ? 1 : 0;
  }
  // French loanwords (encoding 702) whose singular and plural share one current
  // spelling (e.g. "chassis", "corps", "travois"): the reform gives the plural a
  // trailing -s, so spellings[0] = singular, spellings[1] = plural. ("manque" is
  // JJ|NN, not a number pair, so it has no NN2 and keeps the default spelling.)
  if (entry.encoding === 702 && pos.includes('NN2')) {
    return is_plural_noun(tokens, idx) ? 1 : 0;
  }
  // Heteronyms split by part of speech (encoding 102): the verb reading takes
  // the full-vowel spelling (spellings[1], e.g. "separate" /eɪt/, "use" /juːz/),
  // the noun/adjective reading the reduced one (spellings[0]). A handful (row,
  // shower) split by sense rather than POS — those carry a semantic rule, so
  // they are skipped here and fall through to the SEMANTIC dispatch below.
  if (entry.encoding === 102 && pos.includes('VV0') && !SEMANTIC.has(key)) {
    return is_verb_VV0(tokens, idx) ? 1 : 0;
  }
  // Semantic (pronunciation) words, encoding 202 (e.g. "read"): the rule returns
  // a euspelling; map it back to its index, falling back to the default on null.
  const rule = SEMANTIC.get(key);
  if (rule) {
    const i = entry.spellings.indexOf(rule(tokens, idx));
    return i === -1 ? 0 : i;
  }
  return 0;
}

/**
 * True when the token at `idx` begins a sentence — the first token of the block,
 * or the first token after one whose `breakAfter` marks a sentence boundary.
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {boolean}
 */
function isSentenceStart(tokens, idx) {
  return idx === 0 || tokens[idx - 1]?.breakAfter === true;
}

/**
 * Preserves the original word's capitalisation pattern in the replacement.
 * @param {string} original
 * @param {string} replacement
 * @returns {string}
 */
function matchCase(original, replacement) {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
