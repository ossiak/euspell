// Injectable lexicon source. Both the spelling lookup (converter.js) and the
// lexical tagger (tagger.js) read entries through here instead of importing the
// compiled Map directly, so a host can swap the active lexicon at runtime.
//
// The default is the baked-in ~205k-entry Map, so the browser extension, PDF
// viewer, dictation, and desktop reader keep working with no change. A host that
// can't afford the full table resident — notably a mobile reader that fetches
// only the current chapter's vocabulary from an on-disk store (SQLite) — calls
// setLexicon() with a per-chapter subset before converting that chapter. The
// subset need only be a Map-like with .get(key) returning the same
// { pos, encoding, spellings } entry shape.
//
// Swapping is synchronous and process-global: convert a chapter to completion
// (walkTextNodes is synchronous) before swapping in the next chapter's subset.
import { data as bakedIn } from '../../dist/lexicon.js';

/** @typedef {import('../../dist/lexicon.js').LexiconEntry} LexiconEntry */

/** @type {{ get(key: string): LexiconEntry | undefined }} */
let current = bakedIn;

/**
 * Look up a lexicon entry by its lowercase key.
 * @param {string} key
 * @returns {LexiconEntry | undefined}
 */
export function lookupEntry(key) {
  return current.get(key);
}

/**
 * Replace the active lexicon. Pass any object exposing `.get(key)` that returns
 * the { pos, encoding, spellings } entry shape (e.g. a per-chapter subset Map).
 * @param {{ get(key: string): LexiconEntry | undefined }} lex
 */
export function setLexicon(lex) {
  current = lex;
}

/** Restore the baked-in full lexicon. */
export function resetLexicon() {
  current = bakedIn;
}
