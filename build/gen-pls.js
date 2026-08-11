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
const OVERRIDES = join(root, 'data/euspell_ipa_overrides.csv');
const OUT = join(root, 'dict/euspell_tts.pls');
const OUT_ARPA = join(root, 'dict/euspell_tts_arpabet.pls');

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
  // Column 2 (PoS) is deliberately not read, and must not be paired positionally
  // with the spellings in column 4. The two lists are not parallel arrays: PoS is
  // alphabetical and says which grammatical roles the word can play, while the
  // spelling list says which alternative spellings exist, and the counts often
  // differ. "sloughy,JJ,sluffy|slouhy|sluhy" is one tag against three spellings;
  // "bows,NN2|VVZ,bows|bowz|buws|buwz" is two against four; and slough's three
  // spellings are three MEANINGS (shed, bog, inlet) while its NN|NN1|VV0 is three
  // grammatical roles — orthogonal things that happen to number the same. Sense is
  // inferred from the spelling itself (spellingSense, below) or stated by hand in
  // the overrides; never from this column's order.
  spellings.set(c[0], { list: sp.split('|'), enc: +c[2] });
}

// Most CSV rows are "word,IPA", but homographs carry several pronunciations
// with sense labels (read,riːd,(present),or,rɛd,(past)), some rows use "-" as a
// placeholder (stopgapped,-,ˈstɑpˌɡæpt), and a few hold stray editorial tokens
// (sermonizes,alignment,ˈsɜːrməˌlaɪzəz / synthesises,...,alignment,with,GA,...).
//
// Sense labels are not consistent in the source. Three forms appear, all handled
// here so the reading is tagged rather than mis-parsed:
//   - "IPA,(verb),or,IPA,(noun)"      the standard label after each reading
//   - "IPA,(v.),,IPA,(n.)|(adj.)"     abbreviated (separates, sophisticates)
//   - "-,NOUN_IPA,(V:,VERB_IPA)"      the verb reading embedded in a parenthesis
//                                     (subjects, transfers, subordinates, …);
//                                     the bare leading reading is the noun.
// Parse the row into [{ ipa, sense }]. An IPA is a field with a non-ASCII char (a
// stress/length mark or phonetic vowel), which also discards stray ASCII tokens.
const NOUN_LABEL = /^\((noun|nounadj|n|n\.|adj|adj\.)\)$/;
const VERB_LABEL = /^\((verb|v|v\.)\)$/;
function readingsOf(fields) {
  const out = [];
  const rest = fields.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const f = rest[i].trim();
    if (!f || f === '-' || f === 'or') continue;
    // "(V:,IPA)" — a verb reading inside a parenthesis, possibly split across
    // fields by the comma. Gather until the closing ")".
    if (/^\(V:/i.test(f)) {
      let buf = f.replace(/^\(V:,?/i, '');
      while (!/\)$/.test(buf) && i + 1 < rest.length) buf += ',' + rest[++i].trim();
      buf = buf.replace(/\)$/, '').replace(/^,/, '').trim();
      if (/[^\x00-\x7f]/.test(buf)) out.push({ ipa: buf, sense: 'verb' });
      continue;
    }
    if (/^\(.*\)$/.test(f)) {
      if (out.length && NOUN_LABEL.test(f)) out[out.length - 1].sense = 'noun';
      else if (out.length && VERB_LABEL.test(f)) out[out.length - 1].sense = 'verb';
      continue; // a present/past or sense gloss with no IPA of its own
    }
    if (/[^\x00-\x7f]/.test(f)) out.push({ ipa: f, sense: null });
  }
  if (out.length) return out;
  // Pure-ASCII fallback: the row is "word,IPA" or "word,-,IPA" with an ASCII IPA.
  const ascii = rest.map((x) => x.trim())
    .filter((x) => x && x !== '-' && x !== 'or' && !/[()]/.test(x));
  return ascii.map((ipa) => ({ ipa, sense: null }));
}

// A euspelling's grammatical sense. The plural is unambiguous: -z is the 3rd-sg
// verb, -s the plural noun. The SINGULAR of an "-ate" heteronym is trickier: the
// verb keeps its /eɪt/-signalling 'e' (separate, graduate — usually the
// traditional form, so dropped), while the emitted novel spelling is the reduced
// noun (separat, graduat), ending in the stem consonant. So for a word flagged
// as a noun/verb heteronym, a spelling ending in 'e' is the verb and anything
// else the noun. `isHet` gates this: a non-heteronym's spelling has no sense.
function spellingSense(s, isHet) {
  if (s.endsWith('z')) return 'verb';
  if (s.endsWith('s')) return 'noun';
  if (!isHet) return null;
  return s.endsWith('e') ? 'verb' : 'noun';
}

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
const underdet = [];          // spellings refused for want of a reading
let retained = 0;                  // traditional spellings kept as one half of a split
const knownGraphemes = new Set();  // every grapheme the lexicon can legitimately hold
for (const raw of readFileSync(IPA_CSV, 'utf8').split('\n')) {
  const fields = raw.replace(/\r$/, '').split(',');
  const word = fields[0];
  if (!word || word === 'Word') continue; // blank / header guard
  const readings = readingsOf(fields);
  if (!readings.length) { noIpa++; continue; }
  if (readings.length > 1) multiIpa.push({ word, ipas: readings.map((r) => r.ipa) });
  const entry = spellings.get(word) || spellings.get(word.toLowerCase());
  if (!entry) { missing++; continue; }
  // Every spelling this entry can produce is a legitimate target for a curated
  // override, whether or not it is derived below. Without this, an override for
  // a retained spelling ("live", "tears") is rejected as a grapheme the lexicon
  // never emits, and the only way to state its pronunciation is an inline SSML
  // pin in whatever script happens to say it.
  for (const s of entry.list) knownGraphemes.add(s);

  // A grapheme identical to the headword is normally the word itself rather than
  // a reform of it, and is skipped. The exception is a word carrying two or more
  // readings: there the retained spelling is one half of a split the reform has
  // just made — `records` keeps its spelling for the noun while the verb becomes
  // `recordz` — so in euspell text it is no longer ambiguous, and this file's
  // stated job is "reading euspell-converted text aloud". Saying nothing about it
  // throws away the disambiguation the reform exists to create, and leaves a
  // synthesiser guessing at a word that no longer needs guessing at. The sense
  // routing below places it: the readings for these are labelled, and their order
  // is not reliable — `records` lists the verb first, `projects` the noun.
  //
  // A grapheme that is *another* lexicon headword ("programs" from British
  // "programmes", "color" from "colour") used to be dropped here too, on the
  // reasoning that an existing English word needs no pronunciation entry. That
  // held for the standard forms it was written for and failed for the revivals:
  // Table 1 respells "aghast" to the older "agast", "victual" to "vittle",
  // "boulder" to "bowlder" — all existing words, none of which a synthesiser can
  // be trusted to know. Eleven of Table 1's twenty-four were lost this way,
  // "wynd" among them, which is the one word whose whole purpose is to state a
  // pronunciation the reader cannot otherwise get.
  //
  // Emitting them is safe because euspell text gives each grapheme one reading by
  // construction: a collision is only permitted where the two words are
  // homophones, so the entry the engine already had and the entry we supply
  // agree. Where a grapheme genuinely arrives from two differently-sounding
  // words, the conflict pass below still catches it.
  const news = entry.list.filter((s) => {
    if (s === word) { if (readings.length > 1) retained++; return readings.length > 1; }
    if (headwords.has(s)) primary++; // still counted, no longer discarded
    return true;
  });

  // Does this word emit a noun/verb pair whose stem is the "-ate" stress
  // alternation, so the two spellings are genuinely different pronunciations
  // (graduats /-ɪts/ vs graduatez /-eɪts/)? Then a single reading fits only one.
  // A noun/verb spelling pair whose two forms differ by MORE than the final
  // sibilant is a genuine pronunciation heteronym: the "-ate" stress alternation
  // spells the noun "graduats" (/-əts/) but the verb "graduatez" (/-eɪts/), so
  // stripping the sibilant leaves "graduat" vs "graduate". A single reading fits
  // only one. When the two forms differ ONLY in s↔z ("pirats"/"piratz",
  // "tools"/"toolz") the stem is identical, the pronunciation is the same, and
  // the one reading serves both. This catches "flocculates" (whose singular is
  // 000, not 102) and excludes "pirates" (101) — a stem-encoding test does not.
  const zSp = news.find((s) => s.endsWith('z'));
  const sSp = news.find((s) => s.endsWith('s'));
  const isAtePair = news.length === 2 && zSp && sSp
    && zSp.slice(0, -1) !== sSp.slice(0, -1);
  // A noun/verb heteronym is any word with genuinely distinct readings: an -ate
  // pair, or a row that labels both a noun and a verb reading (which is how a
  // SINGULAR -ate word — "separate", one novel spelling "separat" — is caught).
  const senses = readings.map((r) => r.sense);
  const isHet = isAtePair || (senses.includes('verb') && senses.includes('noun'));

  // Underdetermined: the spellings differ by more than a final sibilant — so
  // they are NOT homophones and genuinely want different sounds — but the source
  // has fewer readings than there are distinct stems. `slough` is the clear case:
  // three spellings, two readings, and no /sluː/ anywhere in the data. Nothing
  // can be routed here because the pronunciation does not exist to route, so the
  // fallback below must not reach for readings[0] — that is what told the
  // synthesiser to pronounce `ledds` (the metal) as "leedz". These are emitted
  // from data/euspell_ipa_overrides.csv instead, keyed by grapheme.
  // Counted over the novel spellings only. Widening it to entry.list also catches
  // the case where a word keeps its traditional spelling for one sense and gains
  // one for another — barre the ballet rail stays "barre", the guitar barre
  // becomes "barreh" — but it then swallows the whole "-ate" class as well
  // (undulat/undulate and ~200 more), where spellingSense CAN tell the two
  // spellings apart and only the second reading is missing. Refusing those
  // trades a correct entry for a missing one, so the narrow test stands and the
  // single-novel-spelling splits are handled by override instead.
  const stems = new Set(news.map((s) => s.replace(/[sz]$/, '')));
  const underdetermined = stems.size > 1 && readings.length < stems.size;

  for (const grapheme of news) {
    // Pick the reading whose sense matches this spelling. A spelling with a
    // definite sense takes only a reading of that sense; if the sole reading is
    // the OTHER sense, the spelling gets no entry — a gap beats a wrong
    // pronunciation (the -z verb must never inherit the -s noun's vowel).
    const want = spellingSense(grapheme, isHet);
    let ipa;
    if (want) {
      const match = readings.find((r) => readingSense(r, isAtePair) === want);
      if (match) ipa = match.ipa;
      else if (readings.length === 1 && readingSense(readings[0], isAtePair) && readingSense(readings[0], isAtePair) !== want) {
        senseGaps++;
        senseGapList.push(`${grapheme} (${want}) — only reading is the ${readingSense(readings[0], isAtePair)} of ${word}: ${readings[0].ipa}`);
        continue; // leave it for a hand-added second reading
      } else if (underdetermined) { underdet.push({ grapheme, word }); continue; }
      else ipa = readings[0].ipa; // sense undeterminable → the primary reading
    } else if (underdetermined) {
      underdet.push({ grapheme, word });
      continue;
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

// ---------------------------------------------------------------------------
// Curated overrides, applied last so they beat anything derived above.
//
// This file is keyed on the GRAPHEME rather than the traditional headword, which
// is what makes it the answer to the underdetermined cases: no sense has to be
// inferred, because the spelling that wants the pronunciation is the key. Its
// header has claimed since it was written that gen-pls.js applies it; until now
// nothing read it at all.
let overrides = 0;
const unknownOverrides = [];
for (const raw of readFileSync(OVERRIDES, 'utf8').split('\n')) {
  const line = raw.replace(/\r$/, '').trim();
  if (!line || line.startsWith('#') || line.startsWith('grapheme,')) continue;
  const [grapheme, ipa, gloss] = line.split(',');
  if (!grapheme || !ipa) continue;
  // A grapheme the lexicon never emits would be dead weight in the shipped file
  // and is much more likely to be a typo, so say so rather than ship it.
  if (!knownGraphemes.has(grapheme)) { unknownOverrides.push(grapheme); continue; }
  entries.set(grapheme, { grapheme, ipa, word: gloss || grapheme });
  overrides++;
}

// ---------------------------------------------------------------------------
// IPA -> CMU Arpabet, for the second lexicon.
//
// ElevenLabs honours a PLS in either alphabet but recommends Arpabet, saying IPA
// is less reliable on its v2 models; Polly and Azure take IPA. So both files are
// written and the engine picks.
//
// This is a reverse map, not a re-derivation: changed_words_IPA.csv is the only
// source in the tree keyed on every reformable headword, and its IPA has been
// hand-repaired over many commits, so it — not CMUdict — is what the shipped
// pronunciations actually are. The cost is that the column is not uniform. It
// carries both rhotic conventions (r and ɹ), the r-coloured ɚ/ɝ that
// derive-ipa.py deliberately avoids, a non-GenAm ɒ, and a few characters that
// are simply wrong: ǝ (U+01DD turned e) where ə (U+0259) was meant, one plain g
// for script ɡ, and stray editorial residue (V, x, >, ø, ā, |).
//
// Everything real is mapped. Anything left unmapped is refused rather than
// guessed at — a wrong phoneme is worse than no entry, since an absent word
// falls back to the engine's own dictionary — and the count is reported.
const ARPABET = [
  // Longest first: diphthongs and r-coloured vowels before their components.
  ['aʊ', 'AW'], ['aɪ', 'AY'], ['eɪ', 'EY'], ['oʊ', 'OW'], ['ɔɪ', 'OY'],
  ['iː', 'IY'], ['uː', 'UW'],
  // ɜːr / ɜr / ər collapse to ER, which is how CMUdict writes the rhotic vowel
  // (bouldered = B OW1 L D ER0). A schwa that merely precedes a syllable-initial
  // r is not caught here, because the stress mark sits between them.
  ['ɜːr', 'ER'], ['ɜɹ', 'ER'], ['ɜr', 'ER'], ['ɜː', 'ER'], ['ɜ', 'ER'],
  ['ər', 'ER'], ['əɹ', 'ER'], ['ɚ', 'ER'], ['ɝ', 'ER'],
  ['ɪ', 'IH'], ['ʊ', 'UH'], ['ɛ', 'EH'], ['æ', 'AE'], ['ʌ', 'AH'],
  ['ə', 'AH'], ['ǝ', 'AH'], ['ɑ', 'AA'], ['ɔ', 'AO'],
  ['ɒ', 'AA'],  // LOT: GenAm has no ɒ, and CMUdict writes cot as K AA1 T
  ['i', 'IY'], ['u', 'UW'], ['e', 'EY'], ['o', 'OW'], ['a', 'AA'],
  ['tʃ', 'CH'], ['dʒ', 'JH'], ['ʃ', 'SH'], ['ʒ', 'ZH'], ['θ', 'TH'],
  ['ð', 'DH'], ['ŋ', 'NG'], ['ɡ', 'G'], ['g', 'G'], ['ɹ', 'R'], ['j', 'Y'],
  ['h', 'HH'], // Arpabet writes /h/ as HH; a bare H is not a phoneme in the set
  ...'bdfklmnpstvwz'.split('').map((c) => [c, c.toUpperCase()]),
  ['r', 'R'],
];
const VOWELS = new Set(['AW', 'AY', 'EY', 'OW', 'OY', 'IY', 'UW', 'ER', 'IH',
  'UH', 'EH', 'AE', 'AH', 'AA', 'AO']);
// Diacritics that carry no phoneme of their own: the syllabic mark and nasal
// tilde ride on the segment before them. Length is ignored too — Arpabet has no
// length distinction, and every vowel here maps the same long or short (ɑː and ɑ
// are both AA, ɔː and ɔ both AO), so dropping the mark loses nothing. The
// explicit iː/uː/ɜː rows above stay only because ɜːr must absorb its r.
const IGNORE = new Set(['̩', '̃', 'ˑ', 'ː']);

function toArpabet(ipa) {
  const out = [];
  let stress = '0'; // set by ˈ/ˌ, spent on the next vowel
  let i = 0;
  while (i < ipa.length) {
    const ch = ipa[i];
    if (ch === 'ˈ') { stress = '1'; i += 1; continue; }
    if (ch === 'ˌ') { stress = '2'; i += 1; continue; }
    if (IGNORE.has(ch) || ch === ' ') { i += 1; continue; }
    const hit = ARPABET.find(([from]) => ipa.startsWith(from, i));
    if (!hit) return null; // unmappable: refuse the whole entry
    const [from, to] = hit;
    out.push(VOWELS.has(to) ? to + stress : to);
    if (VOWELS.has(to)) stress = '0';
    i += from.length;
  }
  if (!out.length) return null;
  // The IPA leaves monosyllables unmarked on purpose — one syllable carries no
  // contrastive stress, so derive-ipa.py writes no ˈ and there is nothing here
  // to read. Arpabet has no such convention: CMUdict writes chum as CH AH1 M,
  // and an engine reading AH0 hears an unstressed syllable. Promote the lone
  // vowel to primary.
  const vowels = out.filter((p) => VOWELS.has(p.slice(0, -1)));
  if (vowels.length === 1 && vowels[0].endsWith('0')) {
    const at = out.indexOf(vowels[0]);
    out[at] = `${vowels[0].slice(0, -1)}1`;
  }
  return out.join(' ');
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

// The Arpabet twin. Same graphemes, same join, same order — only the alphabet
// differs, so the two files can be diffed against each other entry for entry.
const unmappable = [];
const arpaBody = [...entries.values()]
  .sort((a, b) => a.grapheme.localeCompare(b.grapheme))
  .map((e) => {
    const arpa = toArpabet(e.ipa);
    if (!arpa) { unmappable.push(`${e.grapheme} (${e.word}): ${e.ipa}`); return null; }
    return lexeme({ grapheme: e.grapheme, ipa: arpa, word: e.word });
  })
  .filter(Boolean)
  .join('\n');

writeFileSync(OUT_ARPA, `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by build/gen-pls.js from data/changed_words_IPA.csv + the lexicon. -->
<!-- The Arpabet twin of euspell_tts.pls, for engines that prefer it (ElevenLabs
     recommends Arpabet over IPA on its v2 models). Same graphemes, same order. -->
<lexicon version="1.0"
    xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.w3.org/2005/01/pronunciation-lexicon
      http://www.w3.org/TR/2008/REC-pronunciation-lexicon-20081014/pls.xsd"
    alphabet="cmu-arpabet" xml:lang="en">
${arpaBody}
</lexicon>
`, 'utf8');

console.log(`[gen-pls] wrote ${OUT} (${entries.size} lexemes)`);
console.log(`[gen-pls] wrote ${OUT_ARPA} (${entries.size - unmappable.length} lexemes, `
  + `${unmappable.length} refused as unmappable)`);
for (const u of unmappable.slice(0, 12)) console.log(`[gen-pls]     unmappable: ${u}`);
console.log(`[gen-pls]   ${multiIpa.length} words have multiple readings (routed by sense where labelled/-ate)`);
console.log(`[gen-pls]   ${primary} graphemes that are also lexicon headwords (kept; revivals live here)`);
console.log(`[gen-pls]   ${missing} CSV words absent from lexicon; ${noIpa} rows with no IPA; ${conflicts} grapheme conflicts`);
console.log(`[gen-pls]   ${retained} traditional spellings kept as one half of a split (records, presents, …)`);
console.log(`[gen-pls]   ${overrides} curated overrides applied (data/euspell_ipa_overrides.csv)`);
if (unknownOverrides.length) {
  console.warn(`[gen-pls]   ${unknownOverrides.length} override(s) for graphemes the lexicon never emits: ${unknownOverrides.join(', ')}`);
}
// Reported after the override pass, so only the ones still without a
// pronunciation are named — those are the rows somebody has to write.
const stillOpen = underdet.filter((u) => !entries.has(u.grapheme));
console.log(`[gen-pls]   ${underdet.length} spelling(s) had more spellings than readings; `
  + `${underdet.length - stillOpen.length} supplied by override, ${stillOpen.length} left unstated`);
for (const u of stillOpen) console.log(`[gen-pls]       needs an override: ${u.grapheme} (${u.word})`);
if (senseGaps) {
  console.log(`[gen-pls]   ${senseGaps} noun/verb spellings left unwritten (source has only the other sense — add the second reading):`);
  for (const g of senseGapList.slice(0, 8)) console.log(`[gen-pls]     ${g}`);
  if (senseGapList.length > 8) console.log(`[gen-pls]     … and ${senseGapList.length - 8} more`);
}
