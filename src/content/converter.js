import { data as lexicon } from '../../dist/lexicon.js';
import { data as abbreviations } from '../../dist/abbreviations.js';
import { data as contractions } from '../../dist/contractions.js';

/**
 * @typedef {{ word: string, tag: string }} Token
 */

/**
 * Converts a single word to its euspelling given surrounding token context.
 * @param {string} word
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {string}
 */
export function convert(word, tokens, idx) {
  const key = word.toLowerCase();
  const entry = lexicon.get(key) ?? abbreviations.get(key) ?? contractions.get(key);

  if (!entry || entry.encoding === 0 || entry.spellings.length === 0) return word;
  if (entry.spellings.length === 1) return matchCase(word, entry.spellings[0]);

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
  // TODO: route to pos.js or semantic/*.js based on encoding
  return 0;
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
