// Emits dict/euspell-word.dic: a Microsoft Word custom dictionary listing every
// euspell reformed spelling (the words that differ from traditional English).
// Standard English words are already in Word's main dictionary, so only the
// reformed forms are needed. Add it in Word via
//   File > Options > Proofing > Custom Dictionaries > Add...
// so Word stops flagging euspell words as misspellings — while still checking
// for real typos (unlike turning proofing off).
//
// Plain text, one word per line, sorted, UTF-8. Entries are lowercased so Word
// accepts any capitalization ("abov", "Abov", "ABOV").
//
// Run: npm run gen:word-dict
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEXICON = join(root, 'data/euspell_lexicon.csv');
const OUT = join(root, 'dict/euspell-word.dic');

const words = new Set();
for (const line of readFileSync(LEXICON, 'utf8').split('\n')) {
  const c = line.replace(/\r$/, '').split(',');
  if (c.length < 4 || !/^[0-9]+$/.test(c[2])) continue; // skip header / blanks
  const head = c[0];
  const sp = c[3];
  // Units digit 0 = no euspelling, whatever column 4 holds. Abbreviations (9xx)
  // keep an expansion there, which otherwise entered the dictionary as if it
  // were a reformed spelling ("Doctor", "also known as").
  if (+c[2] % 10 === 0) continue;
  if (!sp || sp === '[]') continue;
  for (const w of sp.split('|')) {
    if (w && w !== head) words.add(w.toLowerCase()); // reformed spellings only
  }
}

const sorted = [...words].sort((a, b) => a.localeCompare(b));
// CRLF line endings, matching Word's own dictionary files.
writeFileSync(OUT, sorted.join('\r\n') + '\r\n', 'utf8');
console.log(`[gen-word-dict] wrote ${OUT} — ${sorted.length} words`);
