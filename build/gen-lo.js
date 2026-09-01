// Prepares the data files the LibreOffice euspell extension ships and loads at
// runtime (the Python engine in libreoffice/euspell/engine.py reads them):
//
//   libreoffice/euspell/data/lexicon.csv        — Word,PoS,Encoding,euspelling
//   libreoffice/euspell/data/abbreviations.csv  — same shape (PoS for tagging)
//   libreoffice/euspell/data/contractions.csv   — Contraction,PoS,Encoding,euspelling
//   libreoffice/euspell/data/vvz_svm.tsv        — <feature>\t<weight> (NN2|VVZ SVM)
//
// The lexicon/abbreviation/contraction CSVs are copied verbatim from data/ so
// the Python tagger sees the exact same PoS sets as the JS engine. The SVM
// weights are exported from the generated src/disambig/vvz-svm.js (a JS Map) to
// a plain TSV the Python loads without a JS runtime.
//
// Run: npm run gen:lo   (then npm run gen:lo:oxt to package the .oxt)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { VVZ_SVM } from '../src/disambig/vvz-svm.js';
import { data as compiled } from '../dist/lexicon.js';
import { accentAliases, aliasCsvLines } from './lib/accents.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(root, 'data');
const OUT = join(root, 'libreoffice', 'euspell', 'data');
mkdirSync(OUT, { recursive: true });

// 1. Copy the CSVs the engine reads for spellings + PoS tagging.
const copies = [
  ['euspell_lexicon.csv', 'lexicon.csv'],
  ['euspell_lexicon_abbreviations.csv', 'abbreviations.csv'],
  ['euspell_lexicon_contractions.csv', 'contractions.csv'],
];
for (const [src, dst] of copies) {
  copyFileSync(join(DATA, src), join(OUT, dst));
}

// 1b. Append the accented spellings to the copied lexicon, so the Python engine
// here — and the Apps Script engine that Docs, Pages and the Word add-in are all
// generated from — convert `façade` too. The extension and Eupub get these from
// the compiled Map; these engines parse a CSV, so they need them as rows.
//
// The aliases are derived against the compiled Map, which already contains them,
// so `has` is asked of the CSV rows alone — otherwise every alias would be
// rejected as shadowing itself.
const lexPath = join(OUT, 'lexicon.csv');
const csvWords = new Set(
  readFileSync(join(DATA, 'euspell_lexicon.csv'), 'utf8')
    .split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.slice(0, l.indexOf(','))),
);
const aliasLines = aliasCsvLines(
  accentAliases(join(DATA, 'euspell_lexicon_accents.csv'), compiled, (k) => csvWords.has(k)),
);
const lexText = readFileSync(lexPath, 'utf8');
writeFileSync(
  lexPath,
  `${lexText.replace(/\r?\n$/, '')}\n${aliasLines.join('\n')}\n`,
  'utf8',
);

// 2. Export the SVM weights to TSV. Feature keys never contain a tab or newline
// (they are 'bias', 'cap', '<int>=<FAMILY>', 'w=<lowercase-word>').
const lines = [];
for (const [feat, weight] of VVZ_SVM) lines.push(`${feat}\t${weight}`);
writeFileSync(join(OUT, 'vvz_svm.tsv'), `${lines.join('\n')}\n`, 'utf8');

console.log(`[gen-lo] data ready in ${OUT}`);
console.log(`[gen-lo]   lexicon.csv (+${aliasLines.length} accented aliases), abbreviations.csv, contractions.csv copied`);
console.log(`[gen-lo]   vvz_svm.tsv — ${lines.length} weights`);
