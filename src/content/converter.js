import { data as lexicon } from '../../dist/lexicon.js';
import { getContraction } from './contractions.js';
import { is_VVZ, is_verbal_s } from '../disambig/pos.js';

/** @typedef {import('./context.js').Token} Token */

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
  const entry = lexicon.get(word.toLowerCase()) ?? getContraction(word);
  if (!entry) return word;

  // The encoding's last digit is the euspelling count: 0 ⇒ word unchanged,
  // 1 ⇒ one spelling, ≥2 ⇒ disambiguate between spellings. The ?? guards
  // entries whose euspelling field is [] despite a non-zero last digit.
  const variants = entry.encoding % 10;
  if (variants === 0) return word;
  if (variants === 1) return matchCase(word, entry.spellings[0] ?? word);

  const spellingIdx = disambiguate(entry, tokens, idx);
  return matchCase(word, entry.spellings[spellingIdx] ?? word);
}

/**
 * Selects the correct spelling index when multiple are present.
 * @param {import('../../dist/lexicon.js').LexiconEntry} entry
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {number}
 */
function disambiguate(entry, tokens, idx) {
  return route(entry, tokens, idx);
}

/**
 * Dispatches an ambiguous entry to the rule for its POS pair, returning the
 * chosen spelling index. Each rule reads the two-before / two-after window it
 * builds from the lexically-tagged token stream (dom-walker → tagger.js).
 * @param {import('../../dist/lexicon.js').LexiconEntry} entry
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {number}
 */
function route(entry, tokens, idx) {
  const { pos } = entry;
  // NN2|VVZ diatones (e.g. "records"): plural noun → spellings[0], verb → spellings[1].
  if (pos.length === 2 && pos[0] === 'NN2' && pos[1] === 'VVZ') {
    return is_VVZ(tokens, idx) ? 1 : 0;
  }
  // The clitic 's: genitive ('s, spellings[0]) vs contracted is/has ('z, [1]).
  if (pos.includes('GE')) {
    return is_verbal_s(tokens, idx) ? 1 : 0;
  }
  // TODO: remaining POS pairs and the semantic/*.js words (encoding 202).
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
