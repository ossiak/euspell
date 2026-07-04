// Mobile variant of lexicon-source.js — same API, but with NO baked-in lexicon
// import, so the ~14 MB compiled Map is never pulled into the bundle (a rollup
// alias swaps this file in for the mobile engine build; see Eupub's
// rollup.engine.mobile.config.mjs).
//
// The host MUST call setLexicon() with each chapter's subset — fetched from the
// on-disk SQLite lexicon (build/compile-lexicon-sqlite.mjs) — before converting
// that chapter. Until then every lookup misses, so words pass through unchanged.
// See docs/android-port.md (Eupub) for the per-chapter flow.

/** @typedef {import('../../dist/lexicon.js').LexiconEntry} LexiconEntry */

/** @type {{ get(key: string): LexiconEntry | undefined }} */
let current = new Map();

/**
 * @param {string} key
 * @returns {LexiconEntry | undefined}
 */
export function lookupEntry(key) {
  return current.get(key);
}

/**
 * Install the active lexicon (e.g. a per-chapter subset Map).
 * @param {{ get(key: string): LexiconEntry | undefined }} lex
 */
export function setLexicon(lex) {
  current = lex;
}

/** Clear the active lexicon (back to empty — no words reform). */
export function resetLexicon() {
  current = new Map();
}
