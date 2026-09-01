// Turns data/euspell_lexicon_accents.csv into lexicon rows, so an accented
// spelling converts instead of passing through untouched.
//
// The map was added on 31 Aug 2026 and nothing read it: no module in src/ loaded
// it and it was not in any package, so `façade` reached the converter, missed a
// lexicon keyed on ASCII, and came out unchanged. The tokenizer is not the
// problem — its RUN pattern is `\p{L}`-based, so `façade` arrives as one whole
// token; there was simply nothing to look it up in.
//
// **Resolved at compile time, as alias keys, rather than at lookup time.** The
// alternative was a second table consulted by converter.js on a miss, and it
// would have had to be repeated in three places: this project runs three
// independent engines — the JS one in src/content (extension, PDF viewer, Eupub
// on all five platforms), the Python one in libreoffice/, and the Apps Script
// one that Google Docs, Apple Pages and the Word add-in share. Every one of them
// resolves a word by looking it up in the lexicon. Put the accented spellings
// *in* the lexicon and all three convert them with no engine change at all, and
// so does the mobile path, because build/compile-lexicon-sqlite.mjs builds
// lexicon.db out of the compiled Map rather than out of the CSV.
//
// Nothing is added to data/euspell_lexicon.csv itself. That file is the source of
// record and its row count is quoted in the paper, the encoding table and the
// video scripts; an accented spelling is a way in, not a new lexeme. So the
// aliases exist only in the compiled outputs, and every generator that reads the
// CSV directly — the Hunspell wordlist, the PoS lexicon, Harper, the diatones —
// is unaffected, which is right: no accented form ever appears in euspelled
// output, so none of them belongs in a spellchecker's dictionary.

import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';

/** Encodings whose spelling choice is dispatched on the surface word. */
const SEMANTIC_ENCODINGS = new Set([202, 22, 103, 113, 114]);

// A pinned alias is one spelling and a French loanword, which is exactly what
// 701 means — "changed word, French pronunciation". Using the headword's own
// encoding would be wrong twice over: `attaches` is 112, so the converter would
// go back to choosing between the two spellings the pin exists to settle, and
// 113 for `debouches` would send it to a semantic rule keyed on a spelling the
// accented form does not have.
const PINNED_ENCODING = 701;

/**
 * @typedef {{ pos: string[], encoding: number, spellings: string[] }} LexiconEntry
 */

/**
 * Alias rows for the accented spellings, as [key, entry] pairs to append to the
 * compiled lexicon.
 *
 * Unpinned rows share the headword's entry object outright, so an accented word
 * carries the same PoS and reaches the same disambiguation as its ASCII form —
 * `échelons` is a plural noun or a third-person verb exactly as `echelons` is,
 * and the accent is not evidence either way (*he flambés the dish* is written
 * with the accent). Pinned rows are the three where it is: the accent settles a
 * reading the ASCII form leaves open.
 *
 * @param {string} csvPath  data/euspell_lexicon_accents.csv
 * @param {Map<string, LexiconEntry>|{get(k: string): LexiconEntry|undefined}} lexicon
 * @param {(key: string) => boolean} has  whether the compiled lexicon already has a key
 * @returns {[string, LexiconEntry][]}
 */
export function accentAliases(csvPath, lexicon, has) {
  const rows = parse(readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const out = [];
  const problems = [];
  for (const row of rows) {
    const accented = (row.Accented ?? '').trim();
    const word = (row.Word ?? '').trim();
    const pin = (row.euspelling ?? '').trim();
    if (!accented || !word) continue;

    if (accented !== accented.toLowerCase()) {
      problems.push(`${accented}: key is not lowercase`);
      continue;
    }
    if (has(accented)) {
      problems.push(`${accented}: already a lexicon key — an alias would shadow it`);
      continue;
    }
    const head = lexicon.get(word);
    if (!head) {
      problems.push(`${accented}: headword "${word}" is not in the lexicon`);
      continue;
    }

    if (pin) {
      if (!head.spellings.includes(pin)) {
        problems.push(`${accented}: pinned to "${pin}", which is not one of ${word}'s spellings (${head.spellings.join('|') || 'none'})`);
        continue;
      }
      out.push([accented, { pos: head.pos, encoding: PINNED_ENCODING, spellings: [pin] }]);
      continue;
    }

    // No pin and more than one spelling: the accented form inherits the choice,
    // which only works while that choice is made from context rather than from
    // the word itself. Today every such row is 112 (plural noun vs third-person
    // verb), decided by the tagger. A semantic encoding would be dispatched on
    // the surface word, and SEMANTIC has no rule registered under an accented
    // spelling — the accented form would silently fall through to spellings[0].
    // Fail the build instead: the row needs a pin, or a rule under its own key.
    if (head.spellings.length > 1 && SEMANTIC_ENCODINGS.has(head.encoding)) {
      problems.push(`${accented}: headword "${word}" is ${head.encoding}, dispatched on the surface word, and this row has no pin`);
      continue;
    }
    out.push([accented, head]);
  }

  if (problems.length) {
    throw new Error(`accent aliases refused (${problems.length}):\n  ${problems.join('\n  ')}`);
  }
  return out;
}

/**
 * The same aliases as `Word,PoS,Encoding,euspelling` CSV lines, for the engines
 * that parse a lexicon CSV rather than importing the compiled Map — the
 * LibreOffice extension, and the Apps Script engine that Docs, Pages and the
 * Word add-in are all built from.
 * @param {[string, LexiconEntry][]} aliases
 * @returns {string[]}
 */
export function aliasCsvLines(aliases) {
  return aliases.map(([key, e]) =>
    `${key},${e.pos.join('|')},${String(e.encoding).padStart(3, '0')},${e.spellings.length ? e.spellings.join('|') : '[]'}`);
}
