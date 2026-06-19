import { data as lexicon } from '../../dist/lexicon.js';
import { data as abbreviations } from '../../dist/abbreviations.js';
import { data as contractions } from '../../dist/contractions.js';
import { contextWindow } from './context.js';

/** @typedef {import('./context.js').Token} Token */

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
  const ctx = contextWindow(tokens, idx);
  return route(entry, ctx);
}

/**
 * Maps a built context window to a spelling index. Dispatches on
 * `entry.encoding` to the relevant pos.js / semantic rules; each rule reads
 * positionally from the window, where `ctx[2]` is the target word.
 * @param {import('../../dist/lexicon.js').LexiconEntry} entry
 * @param {[Token, Token, Token, Token, Token]} ctx  [w-2, w-1, target, w+1, w+2]
 * @returns {number}
 */
function route(entry, ctx) {
  // TODO: dispatch on entry.encoding to pos.js / semantic rules.
  // Until the PoS tagger populates token.tag, every tag is '' so no rule can
  // fire — fall back to the default spelling (spellings[0]).
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
