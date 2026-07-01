// Shared per-spelling POS derivation for the euspell lexicon, used by every
// grammar-checker export (LanguageTool tagger dict, Harper metadata, …).
//
// For each NEW euspell spelling it yields the CLAWS7 tag(s) that spelling
// carries. "New" = differs from its headword and is not itself a headword (the
// same test gen-pls.js uses); the unchanged member of a split is excluded, since
// a supplemental dictionary can only add tags, never remove a checker's wrong one.
//
// POS is assigned by how the reform split the word (the last digit of the
// encoding is the spelling count):
//   - single spelling: the one new spelling carries the word's full tag set;
//   - verb heteronym (012/112/102): the verb reading is spelling[1] (converter.js
//     route()), so verb tags -> [1], the rest -> [0];
//   - number pair (702): the plural is spelling[1], so NN2 -> [1], the rest -> [0];
//   - sense/semantic split (202/022/103/113/114): readings share a POS, so each
//     new spelling gets the full tag set (a known-word entry, no false split).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const LEXICON = join(root, 'data/euspell_lexicon.csv');

const isVerbTag = (t) => t.startsWith('VV') || t.startsWith('VD') || t.startsWith('VH');
const VERB_SPLIT = new Set([12, 112, 102]);
const PLURAL_SPLIT = new Set([702]);

/**
 * Reads data/euspell_lexicon.csv and returns one record per new euspell spelling.
 * @returns {{ word: string, spelling: string, tags: string[] }[]}
 */
export function newSpellings() {
  const raw = readFileSync(LEXICON, 'utf8').split('\n');

  const headwords = new Set();
  for (const line of raw) {
    const c = line.replace(/\r$/, '').split(',');
    if (c.length < 4 || Number.isNaN(+c[2])) continue;
    headwords.add(c[0]);
  }
  const isNew = (spelling, word) => spelling !== word && !headwords.has(spelling);

  const out = [];
  for (const line of raw) {
    const c = line.replace(/\r$/, '').split(',');
    if (c.length < 4 || Number.isNaN(+c[2])) continue; // header / blank guard
    const [word, pos, encStr, euspelling] = c;
    const enc = +encStr;
    const variants = enc % 10;
    if (variants === 0 || euspelling === '[]') continue; // unchanged

    const spellings = euspelling.split('|');
    const tags = pos.split('|');

    let perSpelling;
    if (variants === 1) {
      perSpelling = [[spellings[0], tags]];
    } else if (VERB_SPLIT.has(enc)) {
      perSpelling = [
        [spellings[0], tags.filter((t) => !isVerbTag(t))],
        [spellings[1], tags.filter(isVerbTag)],
      ];
    } else if (PLURAL_SPLIT.has(enc)) {
      perSpelling = [
        [spellings[0], tags.filter((t) => t !== 'NN2')],
        [spellings[1], tags.filter((t) => t === 'NN2')],
      ];
    } else {
      perSpelling = spellings.map((s) => [s, tags]);
    }

    for (const [spelling, c7tags] of perSpelling) {
      if (isNew(spelling, word)) out.push({ word, spelling, tags: c7tags });
    }
  }
  return out;
}

/**
 * Recovers a CLAWS7 base tag from a ditto tag (II32 -> II, NN121 -> NN1) when the
 * exact tag isn't in `known`; returns the mapped value or undefined.
 * @param {string} c7
 * @param {Record<string, unknown>} known  a tag -> value map to test membership
 */
export function resolveTag(c7, known) {
  if (c7 in known) return known[c7];
  const base = /^([A-Za-z]+[0-9]?)[1-9][1-9]$/.exec(c7);
  if (base && base[1] in known) return known[base[1]];
  return undefined;
}
