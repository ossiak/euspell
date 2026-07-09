// Runtime-loaded lexicon source. A rollup alias (see rollup.config.js) swaps
// this file in for lexicon-source.js when building the browser extension and PDF
// viewer bundles, so the ~14 MB baked-in Map is never inlined. Instead the table
// is fetched once at runtime from dist/lexicon.data (a web-accessible resource)
// and installed via setLexicon() by lexicon-load.js — shipping the lexicon a
// single time rather than duplicating it into both bundles.
//
// Same API and entry shape as lexicon-source.js. Until setLexicon() runs every
// lookup misses, so words pass through unchanged. (Structurally this mirrors
// lexicon-source.mobile.js, which Eupub's mobile engine uses to install
// per-chapter subsets; kept separate so each host's intent stays legible.)

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
 * Install the active lexicon (the full table for the extension; a subset for a
 * chapter-at-a-time host).
 * @param {{ get(key: string): LexiconEntry | undefined }} lex
 */
export function setLexicon(lex) {
  current = lex;
}

/** Clear the active lexicon (back to empty — no words reform). */
export function resetLexicon() {
  current = new Map();
}
