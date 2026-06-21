import { data as phrases } from '../../dist/phrases.js';

/** @typedef {import('../../dist/lexicon.js').LexiconEntry} LexiconEntry */

// Case-normalized view of the phrase map. Keys are space-separated multi-word
// expressions; the longest one bounds the tokenizer's match lookahead.
const byKey = new Map();
let maxWords = 1;
for (const [key, entry] of phrases) {
  const k = key.toLowerCase();
  byKey.set(k, entry);
  const n = k.split(' ').length;
  if (n > maxWords) maxWords = n;
}

/** Largest word count among known phrases — the greedy match lookahead. */
export const MAX_PHRASE_WORDS = maxWords;

/**
 * Returns the phrase entry for `key` (a space-separated, case-insensitive
 * multi-word string), or undefined.
 * @param {string} key
 * @returns {LexiconEntry | undefined}
 */
export function getPhrase(key) {
  return byKey.get(key.toLowerCase());
}
