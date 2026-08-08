// Emits dict/euspell-word.dic: a Microsoft Word custom dictionary listing every
// euspell reformed spelling (the words that differ from traditional English).
// Standard English words are already in Word's main dictionary, so only the
// reformed forms are needed. Add it in Word via
//   File > Options > Proofing > Custom Dictionaries > Add...
// so Word stops flagging euspell words as misspellings — while still checking
// for real typos (unlike turning proofing off).
//
// Plain text, one word per line, sorted, UTF-8. Entries are lowercased so Word
// accepts any capitalization ("abov", "Abov", "ABOV"). Contractions are listed
// with both a straight and a curly apostrophe — see apostropheVariants below.
//
// Run: npm run gen:word-dict
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Contractions live in their own file and are the only source of apostrophe
// words — the main lexicon has none — so both must be read or the dictionary
// silently covers no contraction at all.
const SOURCES = ['data/euspell_lexicon.csv', 'data/euspell_lexicon_contractions.csv'];
const OUT = join(root, 'dict/euspell-word.dic');

/**
 * Both apostrophe forms of a word, or just the word when it has none.
 *
 * The engine normalizes curly to straight at lookup time (normalizeApostrophes
 * in src/content/contractions.js), but a .dic file is a literal string list and
 * cannot. The data is entirely straight-apostrophe, while Word's AutoCorrect
 * turns what the user types into curly U+2019 — so listing only the data's form
 * would likely match nothing in practice. Emitting both costs a few hundred
 * lines and is correct either way, which beats guessing which one Word presents.
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
    // Units digit 0 = no euspelling, whatever column 4 holds. Abbreviations (9xx)
    // keep an expansion there, which otherwise entered the dictionary as if it
    // were a reformed spelling ("Doctor", "also known as").
    if (+c[2] % 10 === 0) continue;
    if (!sp || sp === '[]') continue;
    for (const w of sp.split('|')) {
      if (!w || w === head) continue; // reformed spellings only
      for (const v of apostropheVariants(w.toLowerCase())) words.add(v);
    }
  }
}

const sorted = [...words].sort((a, b) => a.localeCompare(b));
// CRLF line endings, matching Word's own dictionary files.
writeFileSync(OUT, `${sorted.join('\r\n')}\r\n`, 'utf8');
console.log(`[gen-word-dict] wrote ${OUT} — ${sorted.length} words`);
