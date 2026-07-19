// Generates dict/euspell_tts.pls: a W3C Pronunciation Lexicon (PLS 1.0) mapping
// euspell graphemes to IPA, for reading already-converted euspell text aloud.
//
// Input: data/changed_words_IPA.csv (traditional_word,IPA) lists every
// traditional word that gains a new spelling (or splits into 2-4 spellings).
// The new spellings come from the lexicon (data/euspell_lexicon.csv, column 4,
// "euspelling", pipe-separated). For each traditional word we emit one <lexeme>
// per NEW spelling (a euspelling that differs from the traditional headword);
// a reading that keeps the traditional spelling is not emitted. So a word with
// a single new spelling yields one lexeme; "bear" -> bair|baer (both new)
// yields two; a 3-4 way split yields one lexeme per new spelling.
//
// Every new spelling of a word shares that word's IPA from the CSV. For true
// homographs (tears, bows, ...) the distinct spellings really need distinct
// phonemes; those are adjusted by hand afterward. The traditional spelling is
// preserved in a trailing comment on each lexeme.
//
// Run: npm run gen:pls
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEXICON = join(root, 'data/euspell_lexicon.csv');
const IPA_CSV = join(root, 'data/changed_words_IPA.csv');
const OUT = join(root, 'dict/euspell_tts.pls');

// traditional headword -> its euspellings (lexicon column 4, pipe-separated),
// plus the set of every headword (a "primary" / standard dictionary word).
const spellings = new Map();
const headwords = new Set();
for (const raw of readFileSync(LEXICON, 'utf8').split('\n')) {
  const c = raw.replace(/\r$/, '').split(',');
  if (c.length < 4 || Number.isNaN(+c[2])) continue; // skip header / blank rows
  headwords.add(c[0]);
  const sp = c[3];
  // Units digit 0 = no euspelling; abbreviations (9xx) hold an expansion in
  // column 4 rather than a spelling. No abbreviation currently appears in the
  // IPA source, so nothing leaked here, but the guard belongs with the others.
  if (+c[2] % 10 === 0) continue;
  if (!sp || sp === '[]') continue;
  spellings.set(c[0], sp.split('|'));
}

// Most CSV rows are "word,IPA", but homographs carry several pronunciations
// with sense labels (read,riːd,(present),or,rɛd,(past)), some rows use "-" as a
// placeholder (stopgapped,-,ˈstɑpˌɡæpt), and a few hold stray editorial tokens
// (sermonizes,alignment,ˈsɜːrməˌlaɪzəz / synthesises,...,alignment,with,GA,...).
// Extract the pronunciation field(s) per row:
//   1. drop fields that are empty, "-", "or", or a parenthetical sense label;
//   2. if any survivor carries a non-ASCII char (stress/length mark or phonetic
//      vowel) it is a real IPA -- prefer those, which also discards the stray
//      ASCII editorial words that only ever sit beside a diacritic-bearing IPA;
//   3. otherwise the row is a pure-ASCII IPA ("bjut", "strikt") -- the survivor
//      is the IPA. (Pure-ASCII rows are only "word,IPA" or "word,-,IPA".)
// The FIRST surviving reading is attached to every new spelling; homographs
// with a second reading (records, read, tears, ...) are reported for hand-tuning.
const ipasOf = (fields) => {
  const kept = fields.slice(1).map((f) => f.trim())
    .filter((f) => f && f !== '-' && f !== 'or' && !/[()]/.test(f));
  const phon = kept.filter((f) => /[^\x00-\x7f]/.test(f));
  return phon.length ? phon : kept;
};

// Walk the changed-words list. For each traditional word, look up its
// euspellings and emit a lexeme for each one that differs from the headword.
const entries = new Map(); // grapheme -> { grapheme, ipa, word }
const multiIpa = []; // [{ word, ipas: [...] }] homographs needing manual tuning
let missing = 0;
let noIpa = 0;
let conflicts = 0;
let primary = 0;
for (const raw of readFileSync(IPA_CSV, 'utf8').split('\n')) {
  const fields = raw.replace(/\r$/, '').split(',');
  const word = fields[0];
  if (!word || word === 'Word') continue; // blank / header guard
  const ipas = ipasOf(fields);
  if (!ipas.length) { noIpa++; continue; }
  if (ipas.length > 1) multiIpa.push({ word, ipas });
  const ipa = ipas[0]; // primary reading
  const sp = spellings.get(word) || spellings.get(word.toLowerCase());
  if (!sp) { missing++; continue; }
  // New spellings only, and never a "primary" word: a grapheme that is itself a
  // lexicon headword (e.g. "programs", the standard form, from British
  // "programmes") is an existing word, not a euspell reform, so it needs no
  // pronunciation entry. Only the genuine novel spelling (e.g. "programz") is kept.
  const news = sp.filter((s) => {
    if (s === word) return false;
    if (headwords.has(s)) { primary++; return false; }
    return true;
  });
  for (const grapheme of news) {
    const prev = entries.get(grapheme);
    if (prev) {
      if (prev.ipa !== ipa) {
        console.warn(`[gen-pls] conflict: "${grapheme}" has ${prev.ipa} (${prev.word}) and ${ipa} (${word}); keeping the first`);
        conflicts++;
      }
      continue;
    }
    entries.set(grapheme, { grapheme, ipa, word });
  }
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lexeme = ({ grapheme, ipa, word }) =>
  `  <lexeme><grapheme>${esc(grapheme)}</grapheme><phoneme>${esc(ipa)}</phoneme></lexeme> <!-- ${esc(word)} -->`;

const body = [...entries.values()]
  .sort((a, b) => a.grapheme.localeCompare(b.grapheme))
  .map(lexeme)
  .join('\n');

const pls = `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by build/gen-pls.js from data/changed_words_IPA.csv + the lexicon. -->
<!-- Pronunciation lexicon for reading euspell-converted text aloud. IPA. -->
<lexicon version="1.0"
    xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.w3.org/2005/01/pronunciation-lexicon
      http://www.w3.org/TR/2008/REC-pronunciation-lexicon-20081014/pls.xsd"
    alphabet="ipa" xml:lang="en">
${body}
</lexicon>
`;

writeFileSync(OUT, pls, 'utf8');
console.log(`[gen-pls] wrote ${OUT} (${entries.size} lexemes)`);
console.log(`[gen-pls]   ${multiIpa.length} words have multiple readings (primary used; tune by hand)`);
console.log(`[gen-pls]   ${primary} primary-word graphemes dropped (grapheme is a lexicon headword)`);
console.log(`[gen-pls]   ${missing} CSV words absent from lexicon; ${noIpa} rows with no IPA; ${conflicts} grapheme conflicts`);
