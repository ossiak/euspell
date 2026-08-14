#!/usr/bin/env node
/**
 * Extracts an evaluation corpus for the clitic 's from the CLAWS-tagged sets.
 *
 * CLAWS labels the clitic itself, which is exactly the distinction is_verbal_s
 * has to make: GE is the genitive marker ("the cat's tail"), VBZ/VHZ/VDZ the
 * contracted is/has/does ("he's gone", "the bus's arriving"). So each occurrence
 * arrives with a gold answer and no hand-labelling is needed.
 *
 * Writes disambig/_corpus_clitic_s.txt (gitignored, like the other _corpus_*).
 * Run: npm run gen:corpus:clitic-s
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIRS = [
  'E:/Projects/Euspell/CLAWS-tagged-data/corpus/txt',
  'E:/Projects/Euspell/CLAWS-tagged-data/corpusNF/txt',
];
const OUT = new URL('../disambig/_corpus_clitic_s.txt', import.meta.url);

// The clitic as CLAWS writes it: 's or ’s carrying a genitive or verbal tag.
const CLITIC = /(^|\s)(?:'s|’s)_(GE|VBZ|VHZ|VDZ)(\s|$)/;

const lines = [];
let files = 0;
for (const dir of DIRS) {
  let names;
  try { names = readdirSync(dir).filter((f) => f.endsWith('.txt')); } catch { continue; }
  for (const name of names) {
    let text;
    try { text = readFileSync(join(dir, name), 'utf8'); } catch { continue; }
    files++;
    for (const line of text.split(/\r?\n/)) {
      if (line.length < 4000 && CLITIC.test(line)) lines.push(line.trim());
    }
  }
}
writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(`[gen-corpus-clitic-s] ${files} files -> ${lines.length} lines`);
