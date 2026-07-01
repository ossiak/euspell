// Generates dict/euspell-pos.txt: a LanguageTool tagger-dictionary source that
// gives every *new* euspell spelling a part of speech.
//
// Why this helps an existing grammar checker: a euspell respelling is a non-word
// to LanguageTool, so it would be flagged as unknown and get no POS at all. This
// dictionary makes each new spelling known and tagged, and — where euspell split
// a POS-ambiguous word into distinct spellings — hands LanguageTool a narrower,
// often unambiguous tag it could not have derived (English "records" is NN2|VVZ;
// euspell "recordz" is only the verb). See docs/pos-lexicon-for-grammar-checkers.md.
//
// NEW SPELLINGS ONLY. The reading that keeps its traditional spelling is excluded:
// LanguageTool already knows that word, and a supplemental dictionary can only ADD
// tags, never remove a wrong one, so a pin for it is futile. A new spelling is
// unknown to LanguageTool, so supplementing is a clean, conflict-free add. "New"
// uses the same test as gen-pls.js: a euspelling that differs from its headword
// and is not itself an existing lexicon headword.
//
// Input: data/euspell_lexicon.csv — "word,PoS,encoding,euspelling". The last digit
// of the encoding is the spelling count: 0 unchanged (skip), 1 a single spelling,
// >=2 a split. For a split the POS is assigned per spelling:
//   - 012/112/102 (verb heteronyms): the reform's invariant (converter.js route())
//     puts the VERB reading in spelling[1], so verb tags -> [1], the rest -> [0].
//   - 702 (number pairs): the plural is spelling[1], so NN2 -> [1], the rest -> [0].
//   - sense/semantic splits (202/022/103/113/114): both/all readings share a POS,
//     so POS cannot split them; each new spelling gets the word's full tag set.
// A single-spelling reform gets the word's full tag set on its one new spelling.
//
// Output: Morfologik source lines "form<TAB>lemma<TAB>POStag" (LanguageTool's
// tagger-dictionary format), one line per (form, LanguageTool tag). Lemma is the
// surface form itself (the lexicon has no base-form euspellings; POS-driven rules
// key on the tag, not the lemma). CLAWS7 tags are mapped to LanguageTool's
// Penn-Treebank-style tagset; ditto tags (II32, NN121) recover to their base.
//
// Run: npm run gen:pos
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN = join(root, 'data/euspell_lexicon.csv');
const OUT = join(root, 'dict/euspell-pos.txt');

// CLAWS7 -> LanguageTool (Penn-Treebank-style) tag crosswalk. LanguageTool's
// English rules match on these tags, so this is what lets its existing rules fire
// on euspell text. A CLAWS7 tag maps to one or more LT tags (VV0 = base and
// present-non-3sg -> VB, VBP). NOTE: CLAWS7 "MD" is an ORDINAL numeral, not a
// modal — it maps to JJ (Penn tags ordinals as adjectives); the modal is "VM".
const C7_TO_LT = {
  // Common nouns
  NN: ['NN'], NN1: ['NN'], NN2: ['NNS'],
  NNU: ['NN'], NNU1: ['NN'], NNU2: ['NNS'], // units of measurement
  NNT1: ['NN'], NNT2: ['NNS'], // temporal nouns
  NNO: ['NN'], NNO2: ['NNS'], // numeral nouns (dozen)
  NNL1: ['NN'], NNL2: ['NNS'], // locative nouns
  NNB: ['NN'], NNA: ['NN'], // titles / following nouns
  ZZ1: ['NN'], ZZ2: ['NNS'], // letters of the alphabet
  // Proper nouns
  NP: ['NNP'], NP1: ['NNP'], NP2: ['NNPS'], NPM1: ['NNP'], NPD1: ['NNP'],
  // Adjectives (and ordinals)
  JJ: ['JJ'], JJR: ['JJR'], JJT: ['JJS'], MD: ['JJ'], MF: ['CD'],
  // Adverbs
  RR: ['RB'], RRR: ['RBR'], RRT: ['RBS'], RRQ: ['WRB'], RRQV: ['WRB'],
  RG: ['RB'], RGR: ['RBR'], RGT: ['RBS'], RGQ: ['WRB'], RGQV: ['WRB'],
  RL: ['RB'], RT: ['RB'], RA: ['RB'], REX: ['RB'], RP: ['RP'], XX: ['RB'],
  // Lexical verbs
  VV0: ['VB', 'VBP'], VVZ: ['VBZ'], VVD: ['VBD'], VVN: ['VBN'], VVG: ['VBG'], VVI: ['VB'],
  // do / have
  VD0: ['VB', 'VBP'], VDZ: ['VBZ'], VDD: ['VBD'], VDN: ['VBN'], VDG: ['VBG'], VDI: ['VB'],
  VH0: ['VB', 'VBP'], VHZ: ['VBZ'], VHD: ['VBD'], VHN: ['VBN'], VHG: ['VBG'], VHI: ['VB'],
  // be
  VB0: ['VB'], VBI: ['VB'], VBM: ['VBP'], VBR: ['VBP'], VBZ: ['VBZ'],
  VBN: ['VBN'], VBG: ['VBG'], VBDR: ['VBD'], VBDZ: ['VBD'],
  // Modals
  VM: ['MD'], VMK: ['MD'],
  // Articles / determiners
  AT: ['DT'], AT1: ['DT'], DD: ['DT'], DD1: ['DT'], DD2: ['DT'],
  DDQ: ['WDT'], DDQV: ['WDT'], DDQGE: ['WDT'],
  DA: ['DT'], DA1: ['DT'], DA2: ['DT'], DAR: ['DT'], DAT: ['DT'],
  DB: ['PDT'], DB2: ['PDT'],
  // Pronouns
  PPY: ['PRP'], PPH1: ['PRP'], PPHS1: ['PRP'], PPHS2: ['PRP'],
  PPHO1: ['PRP'], PPHO2: ['PRP'], PPIS1: ['PRP'], PPIS2: ['PRP'],
  PPX1: ['PRP'], PPX2: ['PRP'], PNX1: ['PRP'],
  PPGE: ['PRP$'], APPGE: ['PRP$'],
  PN: ['NN'], PN1: ['NN'], // indefinite pronouns (anyone) — Penn tags as NN
  PNQ: ['WP'], PNQS: ['WP'], PNQV: ['WP'], PNQO: ['WP'],
  // Conjunctions
  CC: ['CC'], CCB: ['CC'],
  CS: ['IN'], CSA: ['IN'], CSN: ['IN'], CST: ['IN'], CSW: ['IN'],
  // Prepositions
  II: ['IN'], IO: ['IN'], IF: ['IN'], IW: ['IN'],
  // Numbers / misc
  MC: ['CD'], MC1: ['CD'], MC2: ['CD'],
  UH: ['UH'], EX: ['EX'], TO: ['TO'], GE: ['POS'], Jj: ['JJ'],
};

// The reform puts the verb reading in spelling[1] (012/112/102); the plural in
// spelling[1] (702).
const isVerbTag = (t) => t.startsWith('VV') || t.startsWith('VD') || t.startsWith('VH');
const VERB_SPLIT = new Set([12, 112, 102]);
const PLURAL_SPLIT = new Set([702]);

/**
 * LanguageTool tags for a CLAWS7 tag: a direct crosswalk hit, else the tag with a
 * trailing 2-digit CLAWS ditto suffix stripped to its base (II32 -> II, NN121 ->
 * NN1). Unmapped tags return [] and are counted.
 */
function ltTags(c7, unmapped) {
  if (C7_TO_LT[c7]) return C7_TO_LT[c7];
  const base = /^([A-Za-z]+[0-9]?)[1-9][1-9]$/.exec(c7);
  if (base && C7_TO_LT[base[1]]) return C7_TO_LT[base[1]];
  unmapped.set(c7, (unmapped.get(c7) || 0) + 1);
  return [];
}

// Headword set (lexicon column 0), for the "new spelling" test.
const raw = readFileSync(IN, 'utf8').split('\n');
const headwords = new Set();
for (const line of raw) {
  const c = line.replace(/\r$/, '').split(',');
  if (c.length < 4 || Number.isNaN(+c[2])) continue;
  headwords.add(c[0]);
}
const isNew = (spelling, word) => spelling !== word && !headwords.has(spelling);

const lines = new Set(); // deduped "form\tlemma\ttag"
const unmapped = new Map();
let reformed = 0;
let newForms = 0;
let skippedUnchanged = 0;

for (const line of raw) {
  const c = line.replace(/\r$/, '').split(',');
  if (c.length < 4 || Number.isNaN(+c[2])) continue; // header / blank guard
  const [word, pos, encStr, euspelling] = c;
  const enc = +encStr;
  const variants = enc % 10;
  if (variants === 0 || euspelling === '[]') continue; // unchanged

  const spellings = euspelling.split('|');
  const tags = pos.split('|');

  // Assign the POS reading to each spelling index.
  let perSpelling;
  if (variants === 1) {
    perSpelling = [[spellings[0], tags]]; // one spelling carries every reading
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
    // Sense/semantic split: readings share a POS, so give each new spelling the
    // full tag set (no POS disambiguation, but a correct known-word entry).
    perSpelling = spellings.map((s) => [s, tags]);
  }

  let rowHadNew = false;
  for (const [form, c7tags] of perSpelling) {
    if (!isNew(form, word)) {
      skippedUnchanged++;
      continue;
    }
    rowHadNew = true;
    newForms++;
    for (const c7 of c7tags) {
      for (const tag of ltTags(c7, unmapped)) lines.add(`${form}\t${form}\t${tag}`);
    }
  }
  if (rowHadNew) reformed++;
}

const body = [...lines].sort((a, b) => a.localeCompare(b)).join('\n');
writeFileSync(OUT, body + '\n', 'utf8');

const unmappedTotal = [...unmapped.values()].reduce((a, b) => a + b, 0);
console.log(`[gen-pos] wrote ${OUT}`);
console.log(`[gen-pos]   ${reformed} reformed words -> ${newForms} new spellings -> ${lines.size} tagged lines`);
console.log(`[gen-pos]   ${skippedUnchanged} unchanged members skipped (already known to LanguageTool)`);
if (unmapped.size) {
  const top = [...unmapped].sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([t, n]) => `${t}(${n})`).join(' ');
  console.warn(`[gen-pos]   ${unmappedTotal} tag-occurrences unmapped across ${unmapped.size} CLAWS7 tags: ${top}`);
}
