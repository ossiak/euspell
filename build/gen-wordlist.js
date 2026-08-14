#!/usr/bin/env node
/**
 * Generates dist/euspell.dic and dist/euspell.aff for Hunspell.
 *
 * Run: node build/gen-wordlist.js
 *
 * .dic  — all words valid in euspell:
 *           • changed words: the new euspelling(s) only, NOT the traditional form
 *           • unchanged words (encoding 0xx/5xx with []): the word itself
 * .aff  — character set, suggestion alphabet, and REP substitution rules
 *         derived automatically from the lexicon (frequency >= MIN_REP_FREQ)
 *
 * Phrases (euspell_lexicon_phrase.csv) are omitted — Hunspell does not support
 * multi-word entries in a basic .dic. Use LanguageTool rules for phrase checking.
 *
 * To install in LibreOffice: Tools → Language → Writing Aids → Add → select .oxt
 * (package dist/euspell.aff + dist/euspell.dic into a .oxt ZIP with a description.xml)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const ROOT = new URL('..', import.meta.url);
const DATA = new URL('data/', ROOT);
const DIST = new URL('dict/', ROOT);

mkdirSync(fileURLToPath(DIST), { recursive: true });

// REP rules are only emitted for patterns appearing in >= MIN_REP_FREQ words.
// High threshold = only systematic morphological patterns (not one-off stem changes).
const MIN_REP_FREQ = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCsv(filename, hasHeader) {
  const raw = readFileSync(new URL(filename, DATA), 'utf8');
  return parse(raw, {
    columns: hasHeader,
    skip_empty_lines: true,
    trim: true,
  });
}

/** Length of the shared leading characters between two strings. */
function commonPrefixLen(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// ---------------------------------------------------------------------------
// Accumulator
// ---------------------------------------------------------------------------

const validWords = new Set();

/**
 * suffixPatterns maps 'before|after' → occurrence count.
 * Only suffix-like changes (both sides ≤ 6 chars) are tracked.
 */
const suffixPatterns = new Map();

function recordPattern(word, euspelling) {
  const pfxLen = commonPrefixLen(word, euspelling);
  const before = word.slice(pfxLen);
  const after = euspelling.slice(pfxLen);
  // Ignore whole-word replacements and very long changes (stem changes are too varied)
  if (pfxLen === 0) return;
  if (before.length === 0 || before.length > 6) return;
  if (after.length > 6) return;
  const key = `${before}|${after}`;
  suffixPatterns.set(key, (suffixPatterns.get(key) ?? 0) + 1);
}

function addEntry(word, euspelling, encoding) {
  if (!word) return;
  const variants = Number(encoding);
  if (!Number.isFinite(variants)) return; // header or malformed row
  // The units digit is what says how many euspellings a row has; column 4 is
  // only a euspelling when that digit is non-zero. Abbreviations (9xx) put an
  // EXPANSION there instead, so trusting the column alone admitted "also known
  // as" to the dictionary while leaving "aka" itself out.
  if (variants % 10 === 0 || !euspelling || euspelling === '[]') {
    validWords.add(word.toLowerCase());
    return;
  }
  for (const spelling of euspelling.split('|').filter(Boolean)) {
    validWords.add(spelling.toLowerCase());
    recordPattern(word.toLowerCase(), spelling.toLowerCase());
  }
}

// ---------------------------------------------------------------------------
// Main lexicon  (has header: Word,PoS,Encoding,euspelling)
// ---------------------------------------------------------------------------

for (const row of parseCsv('euspell_lexicon.csv', true)) {
  addEntry(row.Word, row.euspelling, row.Encoding);
}

// ---------------------------------------------------------------------------
// Abbreviations  (parsed positionally: [0]=abbr [1]=PoS [2]=Enc [3]=expansion)
//
// The file does have a header, which addEntry drops via its non-numeric
// encoding guard. Every row is encoding 900, so only the abbreviation itself is
// added — never the expansion in column 4.
// ---------------------------------------------------------------------------

for (const row of parseCsv('euspell_lexicon_abbreviations.csv', false)) {
  addEntry(row[0], row[3], row[2]);
}

// ---------------------------------------------------------------------------
// Contractions  (header: Contraction,PoS,Encoding,euspelling)
// ---------------------------------------------------------------------------

for (const row of parseCsv('euspell_lexicon_contractions.csv', true)) {
  addEntry(row.Contraction, row.euspelling, row.Encoding);
}

// ---------------------------------------------------------------------------
// Phrases — skipped (Hunspell .dic does not support multi-word entries)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Write .dic
// ---------------------------------------------------------------------------

const sorted = [...validWords].sort((a, b) => a.localeCompare(b, 'en'));
const dicContent = `${[sorted.length.toString(), ...sorted].join('\n')}\n`;
writeFileSync(fileURLToPath(new URL('euspell.dic', DIST)), dicContent, 'utf8');
console.log(`[euspell-build] dict/euspell.dic  — ${sorted.length.toLocaleString()} words`);

// ---------------------------------------------------------------------------
// Derive REP rules from frequency data
// ---------------------------------------------------------------------------

const repRules = [...suffixPatterns.entries()]
  .filter(([, count]) => count >= MIN_REP_FREQ)
  .sort((a, b) => b[1] - a[1])
  .flatMap(([key]) => {
    const [before, after] = key.split('|');
    // Skip empty replacement — Hunspell requires a non-empty target string.
    // Silent-e deletions (e.g. -ive → -iv) are handled by the validator
    // finding the stem in the dictionary after the user is flagged.
    if (after === '') return [];
    // Anchor to end-of-word — euspell changes are almost always suffixes
    return [`REP ${before}$ ${after}`];
  });

// ---------------------------------------------------------------------------
// Write .aff
// ---------------------------------------------------------------------------

const affContent = `SET UTF-8

# Characters to try when generating suggestions (English letter frequency order)
TRY esianrtolcdugmphbyfvkwzxjq'ESIANRTOLCDUGMPHBYFVKWZXJQ

# Allow apostrophe inside words (contractions: 'bout, 'cause, it's etc.)
WORDCHARS '

# ---------------------------------------------------------------------------
# REP rules — auto-derived from euspell_lexicon.csv (min frequency: ${MIN_REP_FREQ})
#
# When the user types a traditional spelling that is NOT in the euspell dictionary,
# these rules help Hunspell suggest the correct euspelling.
# Patterns are end-of-word anchored ($ suffix).
# ---------------------------------------------------------------------------
REP ${repRules.length}
${repRules.join('\n')}
`;

writeFileSync(fileURLToPath(new URL('euspell.aff', DIST)), affContent, 'utf8');
console.log(`[euspell-build] dict/euspell.aff  — ${repRules.length} REP rules`);
