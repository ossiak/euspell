// Generates dict/euspell_pos.tsv: a LanguageTool tagger-dictionary source that
// gives every *new* euspell spelling a part of speech.
//
// Why this helps an existing grammar checker: a euspell respelling is a non-word
// to LanguageTool, so it would be flagged as unknown and get no POS at all. This
// dictionary makes each new spelling known and tagged, and — where euspell split
// a POS-ambiguous word into distinct spellings — hands LanguageTool a narrower,
// often unambiguous tag it could not have derived (English "records" is NN2|VVZ;
// euspell "recordz" is only the verb). See docs/pos-lexicon-for-grammar-checkers.md.
//
// The per-spelling POS derivation (new spellings only; how each split assigns POS)
// lives in build/lib/euspell-pos.js, shared with the Harper metadata emitter. This
// file only maps CLAWS7 -> LanguageTool's Penn-Treebank-style tagset and formats
// the Morfologik source lines "form<TAB>lemma<TAB>POStag" (lemma = the form
// itself; POS-driven rules key on the tag, not the lemma). Ditto tags (II32,
// NN121) recover to their base before mapping.
//
// Run: npm run gen:pos
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { newSpellings, resolveTag } from './lib/euspell-pos.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'dict/euspell_pos.tsv');

// CLAWS7 -> LanguageTool (Penn-Treebank-style) tag crosswalk. LanguageTool's
// English rules match on these tags. A CLAWS7 tag maps to one or more LT tags
// (VV0 = base and present-non-3sg -> VB, VBP). NOTE: CLAWS7 "MD" is an ORDINAL
// numeral, not a modal — it maps to JJ (Penn tags ordinals as adjectives); the
// modal is "VM".
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

const lines = new Set(); // deduped "form\tlemma\ttag"
const unmapped = new Map();
const words = new Set();
let newForms = 0;

for (const { word, spelling, tags } of newSpellings()) {
  words.add(word);
  newForms++;
  for (const c7 of tags) {
    const lt = resolveTag(c7, C7_TO_LT);
    if (!lt) {
      unmapped.set(c7, (unmapped.get(c7) || 0) + 1);
      continue;
    }
    for (const tag of lt) lines.add(`${spelling}\t${spelling}\t${tag}`);
  }
}

const body = [...lines].sort((a, b) => a.localeCompare(b)).join('\n');
writeFileSync(OUT, `${body}\n`, 'utf8');

const unmappedTotal = [...unmapped.values()].reduce((a, b) => a + b, 0);
console.log(`[gen-pos] wrote ${OUT}`);
console.log(`[gen-pos]   ${words.size} reformed words -> ${newForms} new spellings -> ${lines.size} tagged lines`);
if (unmapped.size) {
  const top = [...unmapped].sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([t, n]) => `${t}(${n})`).join(' ');
  console.warn(`[gen-pos]   ${unmappedTotal} tag-occurrences unmapped across ${unmapped.size} CLAWS7 tags: ${top}`);
}
