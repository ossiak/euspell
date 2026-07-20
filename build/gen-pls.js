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
  spellings.set(c[0], { list: sp.split('|'), enc: +c[2] });
}

// Most CSV rows are "word,IPA", but homographs carry several pronunciations
// with sense labels (read,riːd,(present),or,rɛd,(past)), some rows use "-" as a
// placeholder (stopgapped,-,ˈstɑpˌɡæpt), and a few hold stray editorial tokens
// (sermonizes,alignment,ˈsɜːrməˌlaɪzəz / synthesises,...,alignment,with,GA,...).
//
// Parse the row into [{ ipa, sense }] pairs. An IPA is a field carrying a
// non-ASCII char (a stress/length mark or phonetic vowel), which also discards
// stray ASCII editorial words. A "(noun)" / "(verb)" label immediately after an
// IPA tags its sense; other parentheticals (present/past, sense glosses) are
// dropped. Pure-ASCII rows ("bjut", "strikt") are handled by the ASCII branch.
const NOUN_LABEL = new Set(['(noun)', '(nounadj)']);
const VERB_LABEL = new Set(['(verb)']);
function readingsOf(fields) {
  const out = [];
  for (const raw of fields.slice(1)) {
    const f = raw.trim();
    if (!f || f === '-' || f === 'or') continue;
    if (/^\(.*\)$/.test(f)) {
      if (out.length && NOUN_LABEL.has(f)) out[out.length - 1].sense = 'noun';
      else if (out.length && VERB_LABEL.has(f)) out[out.length - 1].sense = 'verb';
      continue; // a bare sense gloss, no IPA of its own
    }
    if (/[^\x00-\x7f]/.test(f)) out.push({ ipa: f, sense: null });
  }
  if (out.length) return out;
  // Pure-ASCII fallback: the row is "word,IPA" or "word,-,IPA" with an ASCII IPA.
  const ascii = fields.slice(1).map((x) => x.trim())
    .filter((x) => x && x !== '-' && x !== 'or' && !/[()]/.test(x));
  return ascii.map((ipa) => ({ ipa, sense: null }));
}

// A euspelling's grammatical sense from its ending: -z is the 3rd-sg verb, -s
// the plural noun (see the encoding doc). Only these carry a noun/verb contrast.
const spellingSense = (s) => (s.endsWith('z') ? 'verb' : s.endsWith('s') ? 'noun' : null);

// A reading's sense, when it can be told. A "(noun)"/"(verb)" label is
// authoritative. Failing that, for an "-ate" pair the vowel carries it: the verb
// is /…eɪt(s)/ (advocate /-eɪt/), the noun the reduced /…ɪt(s)|…ət(s)/
// (advocate /-ət/). This is the ONE regular alternation safe to read off the
// IPA; every other pair (tools/toolz, /tuːlz/ either way) returns null so the
// reading is used for both spellings rather than guessed at.
function readingSense(reading, isAtePair) {
  if (reading.sense) return reading.sense;
  if (!isAtePair) return null;
  if (/eɪts?$/.test(reading.ipa)) return 'verb';
  if (/[ɪəiʊ]ts?$/.test(reading.ipa)) return 'noun';
  return null;
}

// Walk the changed-words list. For each traditional word, look up its
// euspellings and emit a lexeme for each one that differs from the headword.
const entries = new Map(); // grapheme -> { grapheme, ipa, word }
const multiIpa = []; // [{ word, ipas: [...] }] homographs needing manual tuning
let missing = 0;
let noIpa = 0;
let conflicts = 0;
let primary = 0;
let senseGaps = 0;
const senseGapList = [];
for (const raw of readFileSync(IPA_CSV, 'utf8').split('\n')) {
  const fields = raw.replace(/\r$/, '').split(',');
  const word = fields[0];
  if (!word || word === 'Word') continue; // blank / header guard
  const readings = readingsOf(fields);
  if (!readings.length) { noIpa++; continue; }
  if (readings.length > 1) multiIpa.push({ word, ipas: readings.map((r) => r.ipa) });
  const entry = spellings.get(word) || spellings.get(word.toLowerCase());
  if (!entry) { missing++; continue; }
  // New spellings only, and never a "primary" word: a grapheme that is itself a
  // lexicon headword (e.g. "programs", the standard form, from British
  // "programmes") is an existing word, not a euspell reform, so it needs no
  // pronunciation entry. Only the genuine novel spelling (e.g. "programz") is kept.
  const news = entry.list.filter((s) => {
    if (s === word) return false;
    if (headwords.has(s)) { primary++; return false; }
    return true;
  });

  // Does this word emit a noun/verb pair whose stem is the "-ate" stress
  // alternation, so the two spellings are genuinely different pronunciations
  // (graduats /-ɪts/ vs graduatez /-eɪts/)? Then a single reading fits only one.
  const isNounVerbPair = news.length === 2
    && news.some((s) => s.endsWith('z')) && news.some((s) => s.endsWith('s'));
  const isAtePair = isNounVerbPair && /ates?$/.test(word);

  for (const grapheme of news) {
    // Pick the reading whose sense matches this spelling. A spelling with a
    // definite sense takes only a reading of that sense; if the sole reading is
    // the OTHER sense, the spelling gets no entry — a gap beats a wrong
    // pronunciation (the -z verb must never inherit the -s noun's vowel).
    const want = spellingSense(grapheme);
    let ipa;
    if (want) {
      const match = readings.find((r) => readingSense(r, isAtePair) === want);
      if (match) ipa = match.ipa;
      else if (readings.length === 1 && readingSense(readings[0], isAtePair) && readingSense(readings[0], isAtePair) !== want) {
        senseGaps++;
        senseGapList.push(`${grapheme} (${want}) — only reading is the ${readingSense(readings[0], isAtePair)} of ${word}: ${readings[0].ipa}`);
        continue; // leave it for a hand-added second reading
      } else ipa = readings[0].ipa; // sense undeterminable → the primary reading
    } else {
      ipa = readings[0].ipa;
    }

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
console.log(`[gen-pls]   ${multiIpa.length} words have multiple readings (routed by sense where labelled/-ate)`);
console.log(`[gen-pls]   ${primary} primary-word graphemes dropped (grapheme is a lexicon headword)`);
console.log(`[gen-pls]   ${missing} CSV words absent from lexicon; ${noIpa} rows with no IPA; ${conflicts} grapheme conflicts`);
if (senseGaps) {
  console.log(`[gen-pls]   ${senseGaps} noun/verb spellings left unwritten (source has only the other sense — add the second reading):`);
  for (const g of senseGapList.slice(0, 8)) console.log(`[gen-pls]     ${g}`);
  if (senseGapList.length > 8) console.log(`[gen-pls]     … and ${senseGapList.length - 8} more`);
}
