// Emits dict/ExcludeDictionaryEN0409.lex: a Microsoft Word exclusion dictionary
// listing the traditional English spellings euspell reforms away, so Word flags
// them as misspellings and offers the euspelling as a correction — the mirror of
// the custom dictionary (gen-word-dict.js), which stops Word flagging the
// reformed spellings. Use the two together: the custom dictionary accepts the
// new spellings, the exclusion dictionary rejects the old ones.
//
// Install it by copying the file, unchanged in name, into Word's proofing folder
//   %AppData%\Microsoft\UProof\ExcludeDictionaryEN0409.lex
// and restarting Word. The 0409 is the LCID for English (United States); for a
// different proofing language use its LCID (e.g. EN0809 for English (UK)) — the
// reformed word list itself is the same, only the file name's locale changes.
//
// Only words euspell ALWAYS reforms are excluded: a head word is listed only
// when its own spelling is not one of its euspellings. That deliberately skips
// homographs that keep the traditional spelling in some sense (e.g. "records" →
// "records" the noun / "recordz" the verb), so Word is never made to flag a form
// that euspell itself leaves unchanged.
//
// Word's own exclusion files are Unicode, so this is written UTF-16 LE with a
// BOM and CRLF line endings; entries are lowercased (Word matches them without
// regard to case) and sorted. Contractions are listed with both a straight and
// a curly apostrophe — see apostropheVariants below.
//
// Run: npm run gen:word-exclude
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// The main lexicon holds no apostrophe words at all — every contraction lives
// in its own file, so both are needed for the list to cover "could've" and the
// rest.
const SOURCES = ['data/euspell_lexicon.csv', 'data/euspell_lexicon_contractions.csv'];
const OUT = join(root, 'dict/ExcludeDictionaryEN0409.lex');

/**
 * Both apostrophe forms of a word, or just the word when it has none. The data
 * is entirely straight-apostrophe while Word AutoCorrects to curly U+2019, and
 * a .lex file cannot normalize the way the engine does, so a straight-only
 * entry would likely never match. Listing both flags the traditional
 * contraction however the apostrophe reached the document.
 */
function apostropheVariants(word) {
  return word.includes("'") ? [word, word.replace(/'/g, '’')] : [word];
}

const words = new Set();
for (const src of SOURCES) {
  for (const line of readFileSync(join(root, src), 'utf8').split('\n')) {
    const c = line.replace(/\r$/, '').split(',');
    if (c.length < 4 || !/^[0-9]+$/.test(c[2])) continue; // skip header / blanks
    const head = c[0];
    const sp = c[3];
    // The units digit decides whether column 4 holds euspellings at all. A 0 there
    // means the word is never reformed, so it must not be flagged — abbreviations
    // (9xx) carry an expansion in that column, and reading it as a euspelling put
    // every one of dr, mr, mrs, etc … into the exclusion list, making Word mark
    // them as misspellings.
    if (+c[2] % 10 === 0) continue;
    if (!sp || sp === '[]') continue; // no reform → nothing to flag
    const spellings = sp.split('|');
    // Flag the traditional spelling only when euspell never leaves it as written,
    // i.e. the head is not itself one of the euspellings (skips homographs).
    if (spellings.includes(head)) continue;
    for (const v of apostropheVariants(head.toLowerCase())) words.add(v);
  }
}

const sorted = [...words].sort((a, b) => a.localeCompare(b));
// UTF-16 LE + BOM, CRLF — matching the exclusion dictionaries Word writes itself.
const body = sorted.join('\r\n') + '\r\n';
// Prepend the UTF-16 LE byte-order mark (FF FE) explicitly, then the body.
writeFileSync(OUT, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(body, 'utf16le')]));
console.log(`[gen-word-exclude] wrote ${OUT} — ${sorted.length} words`);
