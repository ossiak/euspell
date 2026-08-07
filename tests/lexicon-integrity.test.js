import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readLexicon } from './helpers.js';
import { SEMANTIC } from '../src/disambig/semantic/index.js';
import { KEEP_UNCHANGED } from '../src/content/converter.js';
import { VV0_VERB_DEFAULT } from '../src/disambig/vv0-prior.js';

const lex = readLexicon(fs, new URL('../data/euspell_lexicon.csv', import.meta.url));

// The structural invariants hold for EVERY lexicon file, not just the main one.
// Restricting them to euspell_lexicon.csv is how "to've" sat for months with a
// two-digit encoding of 10 — % 10 reduced it to 0, so the row read as "no new
// spelling" and to've never reformed while could've/should've/would've did.
const SOURCES = {
  lexicon: '../data/euspell_lexicon.csv',
  contractions: '../data/euspell_lexicon_contractions.csv',
  abbreviations: '../data/euspell_lexicon_abbreviations.csv',
  phrases: '../data/euspell_lexicon_phrase.csv',
};
/** Every row of every lexicon file, each tagged with the file it came from. */
const all = Object.entries(SOURCES).flatMap(([source, path]) =>
  readLexicon(fs, new URL(path, import.meta.url)).map((e) => ({ ...e, source })));

/** Codes defined in data/euspell_encoding.csv — the authority on what is valid. */
const DEFINED = new Set(
  fs.readFileSync(new URL('../data/euspell_encoding.csv', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(Boolean).map((l) => l.split(',')[0]),
);
/** Raw encoding text per file, to check the literal three digits (not the parsed int). */
const rawCodes = Object.entries(SOURCES).flatMap(([source, path]) =>
  fs.readFileSync(new URL(path, import.meta.url), 'utf8')
    .split(/\r?\n/).filter(Boolean).map((l) => l.split(','))
    .filter((c) => c.length >= 4 && !Number.isNaN(+c[2]))
    .map((c) => ({ source, word: c[0], code: c[2] })));

const label = (e) => `${e.source}:${e.word}`;

/** Mirrors route() in converter.js: does this entry reach a real disambiguator? */
function reachesDisambiguator(e) {
  const k = e.word.toLowerCase();
  return (
    ((e.encoding === 12 || e.encoding === 112) && e.pos.includes('VVZ')) ||
    // The FINAL tag of a reading, exactly as route() tests it. A bare
    // includes('GE') matched only the standalone clitic — the very bug route()
    // was fixed for (whole-word possessives like "anyone's" carry "PN1 GE") — so
    // mirroring it loosely is how this check drifts back out of step with the
    // code it claims to mirror.
    e.pos.some((reading) => reading.split(/\s+/).pop() === 'GE') ||
    (e.encoding === 702 && e.pos.includes('NN2')) ||
    ((e.encoding === 102 || e.encoding === 152) && e.pos.includes('VV0')) ||
    SEMANTIC.has(k) ||
    KEEP_UNCHANGED.has(k)
  );
}

/* ------------------------------------------------------------- PoS column */

/** CLAWS7 tags defined in data/claws7-tagset.csv — the authority on what is
 *  valid, as euspell_encoding.csv is for the encoding column. */
const TAGS = new Set(
  fs.readFileSync(new URL('../data/claws7-tagset.csv', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('Tag,'))
    .map((l) => l.split(',')[0]),
);

/**
 * One tag, with or without a ditto suffix. The tagset allows any tag to carry
 * two extra digits marking a word inside a multiword unit — the first the
 * length of the sequence, the second the position in it, so "in terms of" is
 * in_II31 terms_II32 of_II33. A position outside its own sequence (NN12 on a
 * one-word unit) is malformed, not merely unusual.
 */
function validAtom(tag) {
  if (TAGS.has(tag)) return true;
  const m = /^([A-Z][A-Z0-9$]*?)(\d)(\d)$/.exec(tag);
  if (!m || !TAGS.has(m[1])) return false;
  const [, , total, position] = m;
  return +position >= 1 && +position <= +total;
}

/**
 * One field of the PoS column. Two conventions beyond a bare tag:
 *   - an enclitic carries a tag per part, space-separated ("can't" = VM XX);
 *   - the phrase table appends the word count, which compile-lexicon.js strips
 *     in reducePhraseEntry ("as well as" = II3), so one trailing digit is
 *     allowed there and nowhere else.
 */
function validTag(tag, source) {
  const atoms = tag.split(' ');
  if (atoms.every(validAtom)) return true;
  return source === 'phrases' && atoms.map((a) => a.replace(/\d$/, '')).every(validAtom);
}

test('every PoS tag is a CLAWS7 tag from claws7-tagset.csv', () => {
  // Caught a Penn tag (shem/NNP), four tags run together (JJNN, JJVVD, VVNN,
  // VMXX), truncations (N1, V0, VD, NNT, PNQ), a tag that does not exist
  // (NNM1 for a month, which is NPM1), and six miscased ones (jj, Jj, Nn, Np,
  // Np2, VVg). None of them are visible at conversion time: the encoding
  // decides whether a word changes, so a bad tag simply sits there.
  const bad = all.flatMap((e) => e.pos
    .filter((tag) => !validTag(tag, e.source))
    .map((tag) => `${label(e)}(${tag || 'empty'})`));
  assert.deepEqual(bad, []);
});

test('no entry carries an empty PoS tag', () => {
  // A stray double pipe: "least,DAT||NN1|..." reads as a tag with no name.
  const bad = all.filter((e) => e.pos.some((tag) => tag === ''));
  assert.deepEqual(bad.map(label), []);
});

test('no entry repeats a PoS tag', () => {
  // A repeat is usually a mistyped neighbour rather than a duplicate:
  // "underfunded,JJ|VVD|VVD" wanted JJ|VVD|VVN, and every comparable -ed entry
  // carries both the past tense and the participle.
  const bad = all.filter((e) => new Set(e.pos).size !== e.pos.length);
  assert.deepEqual(bad.map((e) => `${label(e)}(${e.pos.join('|')})`), []);
});

test('every encoding is a three-digit code defined in euspell_encoding.csv', () => {
  // Guards the shape as WRITTEN, before parseInt hides it: "10" parses fine and
  // then behaves as 0. Runs over every file, which is where to've was hiding.
  const bad = rawCodes.filter((c) => !/^[0-9]{3}$/.test(c.code) || !DEFINED.has(c.code));
  assert.deepEqual(bad.map((c) => `${c.source}:${c.word}(${c.code})`), []);
});

test('every entry: euspelling count matches the declared variant count', () => {
  const bad = all.filter((e) => e.encoding % 10 >= 1 && e.spellings.length !== e.encoding % 10
    // encoding%10==0 entries may carry an abbreviation expansion in the field
    && e.encoding % 10 !== 0);
  assert.deepEqual(bad.map((e) => `${label(e)}(enc${e.encoding}:${e.spellings.length})`), []);
});

test('encoding%10 < 2 entries carry at most one euspelling', () => {
  const bad = all.filter((e) => e.encoding % 10 < 2 && e.spellings.length > 1);
  assert.deepEqual(bad.map(label), []);
});

test('encoding%10 == 1 entries have exactly one euspelling (no silent no-ops)', () => {
  const bad = all.filter((e) => e.encoding % 10 === 1 && e.spellings.length !== 1);
  assert.deepEqual(bad.map(label), []);
});

test('a declared euspelling actually differs from its headword', () => {
  // The count check above passes a row whose one "new" spelling IS the word, so
  // the encoding claims a reform that never happens. Multi-spelling rows are
  // exempt: there one reading legitimately keeps the traditional form
  // ("records" the noun beside "recordz" the verb).
  const bad = all.filter((e) => e.encoding % 10 === 1 && e.spellings[0] === e.word);
  assert.deepEqual(bad.map((e) => `${label(e)}(${e.encoding}:${e.raw})`), []);
});

test('no row lists the same euspelling twice', () => {
  // A 2-spelling row whose spellings are identical cannot express its split:
  // putzes was 012 with "putzes|putzes", so its verb reading never took -z.
  const bad = all.filter((e) => e.spellings.length > 1
    && new Set(e.spellings).size !== e.spellings.length);
  assert.deepEqual(bad.map((e) => `${label(e)}(${e.raw})`), []);
});

test('every entry needing disambiguation (>=2 spellings) reaches a disambiguator', () => {
  const uncovered = lex.filter((e) => e.encoding % 10 >= 2 && !reachesDisambiguator(e));
  // manque (702, JJ|NN) has no NN2/plural reading and intentionally defaults.
  const unexpected = uncovered.filter((e) => e.word !== 'manque');
  assert.deepEqual(unexpected.map((e) => `${e.word}[${e.pos.join('|')}]`), []);
});

test('every 3-/4-way word (>=3 spellings) is in SEMANTIC (a 0/1 branch cannot resolve it)', () => {
  const bad = lex.filter((e) => e.encoding % 10 >= 3 && !SEMANTIC.has(e.word.toLowerCase()) && !KEEP_UNCHANGED.has(e.word.toLowerCase()));
  assert.deepEqual(bad.map((e) => e.word), []);
});

test('KEEP_UNCHANGED words exist in the lexicon and carry a multi-spelling encoding', () => {
  for (const w of KEEP_UNCHANGED) {
    const e = lex.find((x) => x.word === w);
    assert.ok(e, `${w} present in lexicon`);
    assert.ok(e.encoding % 10 >= 2, `${w} has a disambiguation encoding`);
  }
});

test('the ports carry the same VV0 verb-default set as the generated table', () => {
  // The set is generated into src/disambig/vv0-prior.js for the JS engine, and
  // hand-mirrored in the LibreOffice and Apps Script ports, which load neither
  // ES modules nor that file. Three copies drift silently, and a drifted copy
  // would make the SAME sentence reform differently in Word/Docs than in the
  // extension — so pin them to each other here.
  const expected = [...VV0_VERB_DEFAULT].sort();

  const py = fs.readFileSync(new URL('../libreoffice/euspell/engine.py', import.meta.url), 'utf8');
  const pyMatch = /_VV0_VERB_DEFAULT = \{([^}]*)\}/.exec(py);
  assert.ok(pyMatch, 'engine.py: _VV0_VERB_DEFAULT not found');
  const pyWords = [...pyMatch[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(pyWords, expected, 'engine.py is out of step with vv0-prior.js');

  const gas = fs.readFileSync(new URL('../apps-script/euspell-engine.gs', import.meta.url), 'utf8');
  const gasMatch = /var VV0_VERB_DEFAULT = \{([^}]*)\}/.exec(gas);
  assert.ok(gasMatch, 'euspell-engine.gs: VV0_VERB_DEFAULT not found');
  const gasWords = [...gasMatch[1].matchAll(/([a-z]+)\s*:/g)].map((m) => m[1]).sort();
  assert.deepEqual(gasWords, expected, 'euspell-engine.gs is out of step with vv0-prior.js');
});

test('every VV0 verb-default word is a POS-decided heteronym', () => {
  // A word only reaches is_verb_VV0 through the 102/152 branch, so a default for
  // anything else would be dead weight — and a sign the table was generated from
  // a stale lexicon.
  const byWord = new Map(lex.map((e) => [e.word.toLowerCase(), e]));
  for (const w of VV0_VERB_DEFAULT) {
    const e = byWord.get(w);
    assert.ok(e, `${w} is in the lexicon`);
    assert.ok([102, 152].includes(e.encoding), `${w} has a POS-heteronym encoding`);
    assert.ok(e.pos.includes('VV0'), `${w} has a VV0 reading`);
    assert.ok(!SEMANTIC.has(w), `${w} is not semantic (those never reach is_verb_VV0)`);
  }
});
