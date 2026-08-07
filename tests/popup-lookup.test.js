// The popup's word lookup. Two things are worth pinning down here.
//
// First, that a lookup never has to choose: for the 5,905 entries carrying more
// than one spelling the converter runs a classifier, but the popup shows every
// spelling instead, so it cannot be wrong in the way the converter can. The
// tests below assert every spelling survives to the result.
//
// Second, that every result states its parts of speech, and states them truly.
// Position in `spellings` only means something for the encodings route() in
// converter.js dispatches on — 012/112 and 102/152 (everything-but-the-verb,
// then the verb) and 702 (singular, then plural). None of those words are in
// the semantic layer, so the encoding alone decides. For 202 and the 3-/4-way
// splits the division is by sound and sense, and each spelling carries every
// tag the entry has: 'bow' and 'buw' are both noun and verb. Labelling those by
// index would state something false.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { setLexicon, lookup, normalise } from '../src/popup/lookup.js';
import { renderResult } from '../src/popup/render.js';
import { descriptions, pad } from '../src/popup/encodings.js';
import { data as contractions } from '../dist/contractions.js';

/** A hand-built stand-in, so these tests do not move when the lexicon does. */
const fixture = new Map([
  ['garden', { pos: ['NN1', 'VV0'], encoding: 0, spellings: [] }],
  ['heavy', { pos: ['JJ', 'NN1', 'RR'], encoding: 101, spellings: ['hevvy'] }],
  ['works', { pos: ['NN', 'VVZ'], encoding: 12, spellings: ['works', 'workz'] }],
  ['leads', { pos: ['NN2', 'VVZ'], encoding: 113, spellings: ['leads', 'ledds', 'leadz'] }],
  ['acts', { pos: ['NN1', 'NN2'], encoding: 702, spellings: ['acts', 'actz'] }],
  ['bow', { pos: ['NN1', 'VV0'], encoding: 202, spellings: ['bow', 'buw'] }],
  ['separate', { pos: ['JJ', 'NN1', 'VV0'], encoding: 102, spellings: ['seprat', 'seprate'] }],
  ['least', { pos: ['DAT', '', 'NN1', 'RGT'], encoding: 0, spellings: [] }],
  // Enclitics: one tag per fused part, space-separated.
  ['cannot', { pos: ['VM XX'], encoding: 0, spellings: [] }],
  ["anybody's", {
    pos: ['PN1 GE', 'PN1 VBZ', 'PN1 VHZ'], encoding: 12,
    spellings: ["anybody's", "anybody'z"],
  }],
]);
setLexicon(fixture);

test('an unchanged word says so, and carries its code and parts of speech', () => {
  const r = lookup('garden');
  assert.equal(r.kind, 'unchanged');
  assert.equal(r.code, '000');
  assert.equal(r.description, 'unchanged common word');
  assert.equal(r.pos, 'noun, verb');
});

test('a single reformed spelling is answered outright', () => {
  const r = lookup('heavy');
  assert.equal(r.kind, 'spellings');
  assert.deepEqual(r.senses.map((s) => s.spelling), ['hevvy']);
  assert.equal(r.code, '101');
  assert.equal(r.pos, 'adjective, noun, adverb');
});

test('tags collapse to one name each: NN, NN1 and NN2 are all "noun"', () => {
  assert.equal(lookup('acts').pos, 'noun');
  // CLAWS7 runs to 270 tags, so the names come from prefix rules; an entry
  // carrying a stray empty tag must not produce an empty name in the list.
  assert.equal(lookup('least').pos, 'determiner, noun, adverb');
});

test('an enclitic states both of its parts, not just the first', () => {
  // "cannot" is VM XX — a modal fused with "not". Naming the tag whole reads it
  // from the V and reports only "verb", losing the negation entirely.
  assert.equal(lookup('cannot').pos, 'verb, negation');
});

test("the clitic 's is split by which 's it is, not by the pronoun in front", () => {
  // The reform's headline case: the genitive 's stays, the contracted is/has
  // becomes 'z. Every reading here is PN1-something, so testing the tag whole
  // finds no verb, collapses the 012 split and labels both spellings the same —
  // which states that Euspell changes the possessive, and it does not.
  const r = lookup("anybody's");
  assert.deepEqual(r.senses.map((s) => s.spelling), ["anybody's", "anybody'z"]);
  assert.deepEqual(r.senses.map((s) => s.label), ['pronoun, possessive', 'pronoun, verb']);
  assert.deepEqual(r.senses.map((s) => s.same), [true, false]);
});

test('two senses keep both spellings and are labelled from their PoS tags', () => {
  const r = lookup('works');
  assert.equal(r.kind, 'spellings');
  assert.deepEqual(r.senses.map((s) => s.spelling), ['works', 'workz']);
  assert.deepEqual(r.senses.map((s) => s.label), ['noun', 'verb']);
  // The noun keeps the traditional spelling; marking it lets the UI mute it
  // rather than presenting an unchanged word as a reform.
  assert.deepEqual(r.senses.map((s) => s.same), [true, false]);
});

test('102 splits everything-but-the-verb from the verb, however many tags there are', () => {
  // Three tags, two spellings: an index-by-index pairing would drop the label
  // entirely. route() says [0] is the noun/adjective reading and [1] the verb.
  const r = lookup('separate');
  assert.deepEqual(r.senses.map((s) => s.label), ['adjective, noun', 'verb']);
});

test('702 splits by number, not by part of speech', () => {
  const r = lookup('acts');
  assert.deepEqual(r.senses.map((s) => s.label), ['noun, singular', 'noun, plural']);
});

test('a 202 split is by sound, so every spelling keeps every part of speech', () => {
  // The bug this guards: 'bow' is NN1|VV0 with two spellings, so pairing by
  // index reads as bow=noun, buw=verb. Both are in fact noun and verb — the
  // split is /boʊ/ against /baʊ/. src/disambig/semantic/bow.js says so outright.
  const r = lookup('bow');
  assert.deepEqual(r.senses.map((s) => s.spelling), ['bow', 'buw']);
  assert.deepEqual(r.senses.map((s) => s.label), ['noun, verb', 'noun, verb']);
});

test('a three-way split labels every spelling, rather than none of them', () => {
  const r = lookup('leads');
  assert.deepEqual(r.senses.map((s) => s.spelling), ['leads', 'ledds', 'leadz']);
  assert.deepEqual(r.senses.map((s) => s.label), ['noun, verb', 'noun, verb', 'noun, verb']);
});

test('queries are normalised: case, surrounding space, inner runs of space', () => {
  assert.equal(normalise('  HEAVY '), 'heavy');
  assert.equal(normalise('a   bit'), 'a bit');
  assert.equal(lookup('  HeAvY  ').senses[0].spelling, 'hevvy');
});

test('a euspelling resolves backwards to the word it came from', () => {
  const r = lookup('hevvy');
  assert.equal(r.kind, 'reverse');
  assert.deepEqual(r.sources.map((s) => s.word), ['heavy']);
  assert.equal(r.sources[0].code, '101');
  assert.equal(r.sources[0].description, 'stem change');
});

test('a sense that keeps its spelling is not indexed backwards', () => {
  // "works" is both the headword and one of its own spellings; a reverse hit on
  // it would answer a question nobody asked, and the forward lookup wins anyway.
  assert.equal(lookup('works').kind, 'spellings');
  assert.equal(lookup('workz').kind, 'reverse');
});

test('an unknown word is a miss, not an error', () => {
  assert.equal(lookup('snorkulate').kind, 'miss');
  assert.equal(lookup('').kind, 'empty');
  assert.equal(lookup('   ').kind, 'empty');
});

test('the contractions table is searched too, not just the main lexicon', () => {
  // Picked from the shipped table rather than hard-coded, so this does not break
  // when a contraction is respelled.
  const [word] = [...contractions].find(([, e]) => e.encoding % 10 === 1) ?? [];
  assert.ok(word, 'expected at least one reformed contraction');
  assert.equal(lookup(word).kind, 'spellings');
});

/* ------------------------------------------------------------ generated table */

test('src/popup/encodings.js still matches data/euspell_encoding.csv', () => {
  // encodings.js is generated by build/gen-popup-encodings.mjs, and the tooltip
  // quotes it verbatim as the meaning of a code. Nothing re-runs the generator,
  // so without this the popup would keep describing an encoding the way the CSV
  // used to — which is how the "exisiting" typo could have outlived its fix.
  // Split on the first and last comma: the description sits between them and is
  // free to contain either.
  const rows = fs
    .readFileSync(new URL('../data/euspell_encoding.csv', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^\d{3},/.test(l))
    .map((l) => [l.slice(0, l.indexOf(',')), l.slice(l.indexOf(',') + 1, l.lastIndexOf(','))]);

  assert.ok(rows.length >= 30, `only ${rows.length} rows parsed — the CSV shape has changed`);
  assert.deepEqual(
    rows.map(([code, description]) => `${code} ${description}`),
    rows.map(([code]) => `${code} ${descriptions.get(Number(code)) ?? '<missing>'}`),
    'run `npm run gen:popup-encodings`',
  );
  // Keyed numerically, printed with pad(): "012" must survive the round trip.
  for (const [code] of rows) assert.equal(pad(Number(code)), code);
  assert.equal(descriptions.size, rows.length, 'encodings.js has codes the CSV does not');
});

/* ---------------------------------------------------------------- rendering */

/** The narrowest document the renderer will accept, serialisable to HTML. */
function stubDoc() {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  class N {
    constructor(tag) { this.tag = tag; this.className = ''; this.kids = []; this.t = null; }
    set textContent(v) { this.t = v; this.kids = []; }
    get textContent() { return this.t; }
    append(...k) { this.kids.push(...k); }
    get html() {
      const cls = this.className ? ` class="${this.className}"` : '';
      return `<${this.tag}${cls}>${(this.t != null ? esc(this.t) : '') + this.kids.map((k) => k.html).join('')}</${this.tag}>`;
    }
  }
  return { createElement: (tag) => new N(tag) };
}

const html = (result) => renderResult(result, stubDoc()).map((n) => n.html).join('');

test('the code chip carries its description verbatim, for the tooltip', () => {
  const out = html(lookup('leads'));
  assert.match(out, /<span class="code">113<span class="tip">stem change \+ NN2\|VVZ ending: disambiguated three ways<\/span>/);
});

test('the chip sits on the last sense row, with the column held open above it', () => {
  const out = html(lookup('leads'));
  assert.equal((out.match(/class="gutter"/g) ?? []).length, 2); // two rows above
  assert.equal((out.match(/class="code"/g) ?? []).length, 1);
});

test('a query is rendered as text, never as markup', () => {
  const out = html(lookup('<img src=x onerror=alert(1)>'));
  assert.doesNotMatch(out, /<img/);
  assert.equal(lookup('<img src=x onerror=alert(1)>').kind, 'miss');
});

test('an empty query renders nothing at all', () => {
  assert.equal(renderResult({ kind: 'empty' }, stubDoc()).length, 0);
});
