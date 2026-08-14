// Generates dict/euspell-harper.json: a part-of-speech metadata map for Harper
// (the Rust offline grammar checker), keyed by new euspell spelling.
//
// Unlike LanguageTool, Harper carries structured per-word metadata (noun/verb/
// adjective… with sub-features) rather than a flat POS tag. This emitter reuses
// the SAME per-spelling POS derivation as the LanguageTool export (build/lib/
// euspell-pos.js) and reshapes each spelling's CLAWS7 tags into a Harper-style
// WordMetadata object. See docs/pos-lexicon-for-grammar-checkers.md.
//
// PROTOTYPE / FORMAT CAVEAT. Harper's exact WordMetadata schema and its dictionary
// ingestion path evolve; this emits a descriptive, Harper-shaped JSON (a superset
// that maps cleanly onto Harper's noun/verb/adjective/… structs) as a reviewable
// intermediate. Adapt the field names to the Harper version you target before
// loading — the linguistic content (which spelling is a plural noun, a 3rd-sing
// verb, …) is what matters and is what this derives.
//
// Run: npm run gen:harper
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { newSpellings, resolveTag } from './lib/euspell-pos.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'dict/euspell-harper.json');

// CLAWS7 base tag -> a metadata descriptor { pos, ...attrs }. Merged per spelling
// into one WordMetadata object (a spelling can be several parts of speech, and a
// verb can carry several forms). CLAWS7 "MD" is an ordinal, not a modal.
const C7_TO_META = {
  // Nouns
  NN: { pos: 'noun' }, NN1: { pos: 'noun' }, NNU: { pos: 'noun' }, NNU1: { pos: 'noun' },
  NNT1: { pos: 'noun' }, NNO: { pos: 'noun' }, NNL1: { pos: 'noun' }, NNB: { pos: 'noun' },
  NNA: { pos: 'noun' }, ZZ1: { pos: 'noun' },
  NN2: { pos: 'noun', plural: true }, NNU2: { pos: 'noun', plural: true },
  NNT2: { pos: 'noun', plural: true }, NNO2: { pos: 'noun', plural: true },
  NNL2: { pos: 'noun', plural: true }, ZZ2: { pos: 'noun', plural: true },
  NP: { pos: 'noun', proper: true }, NP1: { pos: 'noun', proper: true },
  NPM1: { pos: 'noun', proper: true }, NPD1: { pos: 'noun', proper: true },
  NP2: { pos: 'noun', proper: true, plural: true },
  // Verbs (form accumulates into verb.forms)
  VV0: { pos: 'verb', form: 'present' }, VD0: { pos: 'verb', form: 'present' }, VH0: { pos: 'verb', form: 'present' },
  VBM: { pos: 'verb', form: 'present' }, VBR: { pos: 'verb', form: 'present' },
  VVZ: { pos: 'verb', form: 'third_person_singular' }, VDZ: { pos: 'verb', form: 'third_person_singular' },
  VHZ: { pos: 'verb', form: 'third_person_singular' }, VBZ: { pos: 'verb', form: 'third_person_singular' },
  VVD: { pos: 'verb', form: 'past' }, VDD: { pos: 'verb', form: 'past' }, VHD: { pos: 'verb', form: 'past' },
  VBDR: { pos: 'verb', form: 'past' }, VBDZ: { pos: 'verb', form: 'past' },
  VVN: { pos: 'verb', form: 'past_participle' }, VDN: { pos: 'verb', form: 'past_participle' },
  VHN: { pos: 'verb', form: 'past_participle' }, VBN: { pos: 'verb', form: 'past_participle' },
  VVG: { pos: 'verb', form: 'gerund' }, VDG: { pos: 'verb', form: 'gerund' },
  VHG: { pos: 'verb', form: 'gerund' }, VBG: { pos: 'verb', form: 'gerund' },
  VVI: { pos: 'verb', form: 'infinitive' }, VDI: { pos: 'verb', form: 'infinitive' },
  VHI: { pos: 'verb', form: 'infinitive' }, VBI: { pos: 'verb', form: 'infinitive' }, VB0: { pos: 'verb', form: 'infinitive' },
  VM: { pos: 'modal' }, VMK: { pos: 'modal' },
  // Adjectives (and ordinals)
  JJ: { pos: 'adjective' }, Jj: { pos: 'adjective' },
  JJR: { pos: 'adjective', degree: 'comparative' }, JJT: { pos: 'adjective', degree: 'superlative' },
  MD: { pos: 'adjective', ordinal: true },
  // Adverbs
  RR: { pos: 'adverb' }, RRR: { pos: 'adverb', degree: 'comparative' }, RRT: { pos: 'adverb', degree: 'superlative' },
  RRQ: { pos: 'adverb', interrogative: true }, RRQV: { pos: 'adverb', interrogative: true },
  RG: { pos: 'adverb' }, RGR: { pos: 'adverb', degree: 'comparative' }, RGT: { pos: 'adverb', degree: 'superlative' },
  RGQ: { pos: 'adverb', interrogative: true }, RGQV: { pos: 'adverb', interrogative: true },
  RL: { pos: 'adverb' }, RT: { pos: 'adverb' }, RA: { pos: 'adverb' }, REX: { pos: 'adverb' }, XX: { pos: 'adverb' },
  RP: { pos: 'particle' },
  // Pronouns
  PPY: { pos: 'pronoun' }, PPH1: { pos: 'pronoun' }, PPHS1: { pos: 'pronoun' }, PPHS2: { pos: 'pronoun' },
  PPHO1: { pos: 'pronoun' }, PPHO2: { pos: 'pronoun' }, PPIS1: { pos: 'pronoun' }, PPIS2: { pos: 'pronoun' },
  PPX1: { pos: 'pronoun', reflexive: true }, PPX2: { pos: 'pronoun', reflexive: true }, PNX1: { pos: 'pronoun', reflexive: true },
  PPGE: { pos: 'pronoun', possessive: true }, APPGE: { pos: 'pronoun', possessive: true },
  PN: { pos: 'pronoun' }, PN1: { pos: 'pronoun' },
  PNQ: { pos: 'pronoun', interrogative: true }, PNQS: { pos: 'pronoun', interrogative: true },
  PNQV: { pos: 'pronoun', interrogative: true }, PNQO: { pos: 'pronoun', interrogative: true },
  // Determiners
  AT: { pos: 'determiner' }, AT1: { pos: 'determiner' }, DD: { pos: 'determiner' }, DD1: { pos: 'determiner' },
  DD2: { pos: 'determiner' }, DDQ: { pos: 'determiner', interrogative: true }, DDQV: { pos: 'determiner', interrogative: true },
  DDQGE: { pos: 'determiner', interrogative: true, possessive: true },
  DA: { pos: 'determiner' }, DA1: { pos: 'determiner' }, DA2: { pos: 'determiner' }, DAR: { pos: 'determiner' }, DAT: { pos: 'determiner' },
  DB: { pos: 'determiner', predeterminer: true }, DB2: { pos: 'determiner', predeterminer: true },
  // Conjunctions
  CC: { pos: 'conjunction', kind: 'coordinating' }, CCB: { pos: 'conjunction', kind: 'coordinating' },
  CS: { pos: 'conjunction', kind: 'subordinating' }, CSA: { pos: 'conjunction', kind: 'subordinating' },
  CSN: { pos: 'conjunction', kind: 'subordinating' }, CST: { pos: 'conjunction', kind: 'subordinating' },
  CSW: { pos: 'conjunction', kind: 'subordinating' },
  // Prepositions
  II: { pos: 'preposition' }, IO: { pos: 'preposition' }, IF: { pos: 'preposition' }, IW: { pos: 'preposition' },
  // Numbers / misc
  MC: { pos: 'number' }, MC1: { pos: 'number' }, MC2: { pos: 'number' }, MF: { pos: 'number' },
  UH: { pos: 'interjection' }, EX: { pos: 'existential' }, TO: { pos: 'particle' }, GE: { pos: 'possessive_marker' },
};

/** Merge a descriptor into a spelling's accumulating WordMetadata object. */
function apply(meta, d) {
  switch (d.pos) {
    case 'noun':
      meta.noun ??= {};
      if (d.plural) meta.noun.plural = true;
      if (d.proper) meta.noun.proper = true;
      break;
    case 'verb':
      meta.verb ??= { forms: [] };
      if (d.form && !meta.verb.forms.includes(d.form)) meta.verb.forms.push(d.form);
      break;
    case 'modal':
      meta.modal = true;
      break;
    case 'adjective':
      meta.adjective ??= {};
      if (d.degree) meta.adjective.degree = d.degree;
      if (d.ordinal) meta.adjective.ordinal = true;
      break;
    case 'adverb':
      meta.adverb ??= {};
      if (d.degree) meta.adverb.degree = d.degree;
      if (d.interrogative) meta.adverb.interrogative = true;
      break;
    case 'pronoun':
      meta.pronoun ??= {};
      if (d.possessive) meta.pronoun.possessive = true;
      if (d.reflexive) meta.pronoun.reflexive = true;
      if (d.interrogative) meta.pronoun.interrogative = true;
      break;
    case 'determiner':
      meta.determiner ??= {};
      if (d.interrogative) meta.determiner.interrogative = true;
      if (d.possessive) meta.determiner.possessive = true;
      if (d.predeterminer) meta.determiner.predeterminer = true;
      break;
    case 'conjunction':
      meta.conjunction ??= {};
      meta.conjunction.kind = d.kind;
      break;
    default:
      meta[d.pos] = true; // preposition, number, interjection, particle, existential, possessive_marker
  }
}

// Accumulate the CLAWS7 tags per spelling (a spelling may recur across headwords),
// then reshape into one metadata object each.
const tagsBySpelling = new Map();
for (const { spelling, tags } of newSpellings()) {
  let set = tagsBySpelling.get(spelling);
  if (!set) tagsBySpelling.set(spelling, (set = new Set()));
  for (const t of tags) set.add(t);
}

const out = {};
const unmapped = new Map();
for (const spelling of [...tagsBySpelling.keys()].sort((a, b) => a.localeCompare(b))) {
  const meta = {};
  for (const c7 of tagsBySpelling.get(spelling)) {
    const d = resolveTag(c7, C7_TO_META);
    if (!d) {
      unmapped.set(c7, (unmapped.get(c7) || 0) + 1);
      continue;
    }
    apply(meta, d);
  }
  if (Object.keys(meta).length) out[spelling] = meta;
}

writeFileSync(OUT, `${JSON.stringify(out, null, 0)}\n`, 'utf8');

console.log(`[gen-harper] wrote ${OUT}`);
console.log(`[gen-harper]   ${Object.keys(out).length} spellings with metadata`);
if (unmapped.size) {
  const top = [...unmapped].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}(${n})`).join(' ');
  console.warn(`[gen-harper]   unmapped CLAWS7 tags: ${top}`);
}
