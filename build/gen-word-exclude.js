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
// regard to case) and sorted.
//
// Run: npm run gen:word-exclude
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEXICON = join(root, 'data/euspell_lexicon.csv');
const OUT = join(root, 'dict/ExcludeDictionaryEN0409.lex');

const words = new Set();
for (const line of readFileSync(LEXICON, 'utf8').split('\n')) {
  const c = line.replace(/\r$/, '').split(',');
  if (c.length < 4 || !/^[0-9]+$/.test(c[2])) continue; // skip header / blanks
  const head = c[0];
  const sp = c[3];
  if (!sp || sp === '[]') continue; // no reform → nothing to flag
  const spellings = sp.split('|');
  // Flag the traditional spelling only when euspell never leaves it as written,
  // i.e. the head is not itself one of the euspellings (skips homographs).
  if (!spellings.includes(head)) words.add(head.toLowerCase());
}

const sorted = [...words].sort((a, b) => a.localeCompare(b));
// UTF-16 LE + BOM, CRLF — matching the exclusion dictionaries Word writes itself.
const body = sorted.join('\r\n') + '\r\n';
// Prepend the UTF-16 LE byte-order mark (FF FE) explicitly, then the body.
writeFileSync(OUT, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(body, 'utf16le')]));
console.log(`[gen-word-exclude] wrote ${OUT} — ${sorted.length} words`);
