import { test } from 'node:test';
import assert from 'node:assert/strict';
import { is_VVZ, is_VVZ_svm, is_verb_VV0, is_plural_noun, is_verbal_s } from '../src/disambig/pos.js';
import { tagWord } from '../src/content/tagger.js';
import { t } from './helpers.js';

/** Tokens with the REAL lexicon candidate tags (what the page pipeline sees). */
const tagged = (words) => words.map((w) => t(w, tagWord(w)));

test('is_VVZ_svm: the production linear-SVM decision (vvz-svm.js)', () => {
  // Verb readings: a 3rd-sg subject before, or a verb complement after.
  assert.equal(is_VVZ_svm([t('it', 'PPH1'), t('records', ''), t('the', 'AT'), t('data', 'NN1')], 1), true);
  assert.equal(is_VVZ_svm([t('she', 'PPHS1'), t('tracks', ''), t('them', 'PPHO2')], 1), true);
  assert.equal(is_VVZ_svm([t('he', 'PPHS1'), t('loves', ''), t('anything', 'PN1')], 1), true);
  // Noun readings: a determiner/quantifier or a compound-noun modifier before.
  assert.equal(is_VVZ_svm([t('the', 'AT'), t('records', ''), t('of', 'IO')], 1), false);
  assert.equal(is_VVZ_svm([t('two', 'MC'), t('records', ''), t('exist', 'VV0')], 1), false);
  assert.equal(is_VVZ_svm([t('learning', 'NN1'), t('tools', ''), t('for', 'IF')], 1), false);
  // Robust at array boundaries and always boolean.
  assert.equal(typeof is_VVZ_svm([t('records', '')], 0), 'boolean');
  assert.doesNotThrow(() => is_VVZ_svm([t('records', '')], 0));
});

test('is_VVZ_svm: noun-compound frames with real lexicon tags (regression)', () => {
  // These use the full candidate tag sets the page pipeline sees — the messy
  // multi-tag neighbors ("all" DB|JJ21|RR|…, "between" II|II22|JJ22|RL|RL22)
  // are what made these frames misresolve to the verb ("…domestic call
  // recordz…" in the Snowden book). The rule-veto blend must keep the noun.
  const verizon = tagged(['to', 'hand', 'over', 'all', 'domestic', 'call', 'records',
    'between', 'the', 'dates', 'of', 'April', '25', 'to', 'July', '19']);
  assert.equal(is_VVZ_svm(verizon, 6), false); // "call records" — compound noun
  const domestic = tagged(['The', 'order', 'covered', 'all', 'domestic', 'calls',
    'between', 'April', '25', 'and', 'July', '19']);
  assert.equal(is_VVZ_svm(domestic, 5), false); // "domestic calls" — NP head
  const stopped = tagged(['The', 'phone', 'calls', 'stopped', 'at', 'midnight']);
  assert.equal(is_VVZ_svm(stopped, 2), false); // "calls stopped" — subject of VVD
  const govt = tagged(['Government', 'records', 'between', '2001', 'and', '2013', 'were', 'released']);
  assert.equal(is_VVZ_svm(govt, 1), false); // "government records" — NP head
  // Verb readings with the same words must survive the veto:
  assert.equal(is_VVZ_svm(tagged(['she', 'records', 'the', 'song']), 1), true);
  assert.equal(is_VVZ_svm(tagged(['he', 'calls', 'his', 'mother', 'every', 'day']), 1), true);
  assert.equal(is_VVZ_svm(tagged(['the', 'device', 'records', 'everything']), 2), true);
  assert.equal(is_VVZ_svm(tagged(['every', 'morning', 'she', 'calls', 'for', 'backup']), 3), true);
});

test('is_VVZ: subject pronoun before marks a verb', () => {
  // "she records" -> verb
  assert.equal(is_VVZ([t('she', 'PPHS1'), t('records', ''), t('it', 'PPH1')], 1), true);
});

test('is_VVZ: a determiner/quantifier before marks a plural noun', () => {
  // "two records" -> noun
  assert.equal(is_VVZ([t('two', 'MC'), t('records', ''), t('exist', 'VV0')], 1), false);
});

test('is_VVZ: a common-noun modifier before marks a compound noun (NN2)', () => {
  // "free learning tools" — "learning" modifies "tools", it is not a subject
  assert.equal(is_VVZ([t('free', 'JJ'), t('learning', 'NN1'), t('tools', ''), t('for', 'IF')], 2), false);
  // "...of computer functions" (header)
  assert.equal(is_VVZ([t('of', 'IO'), t('computer', 'NN1'), t('functions', '')], 2), false);
  // "the bank accounts of children"
  assert.equal(is_VVZ([t('the', 'AT'), t('bank', 'NN1'), t('accounts', ''), t('of', 'IO')], 2), false);
});

test('is_VVZ: a confirmed subject still marks the verb', () => {
  // pronoun subject
  assert.equal(is_VVZ([t('it', 'PPH1'), t('records', ''), t('the', 'AT'), t('data', 'NN1')], 1), true);
  // proper-noun subject + object
  assert.equal(is_VVZ([t('John', 'NP1'), t('records', ''), t('his', 'APPGE'), t('notes', 'NN2')], 1), true);
  // determiner + common-noun subject + particle
  assert.equal(is_VVZ([t('the', 'AT'), t('mucosa', 'NN1'), t('sloughs', ''), t('off', 'RP')], 2), true);
});

test('is_VVZ: a proper-noun subject marks the verb without needing a complement', () => {
  // "John runs" / "Mary walks" — proper noun subject, nothing after
  assert.equal(is_VVZ([t('John', 'NP1'), t('runs', '')], 1), true);
  assert.equal(is_VVZ([t('Mary', 'NP1'), t('walks', ''), t('.', '.')], 1), true);
  // through an adverb: "John regularly speaks"
  assert.equal(is_VVZ([t('John', 'NP1'), t('regularly', 'RR'), t('speaks', '')], 2), true);
  // ...but a following plural-agreeing verb still marks the noun:
  // "John records show errors" — "John records" is the subject NP of "show"
  assert.equal(is_VVZ([t('John', 'NP1'), t('records', ''), t('show', 'VV0'), t('errors', 'NN2')], 1), false);
});

test('is_VVZ: a proper-noun object marks the verb', () => {
  // bare verb + proper-noun object: "calls Mary"
  assert.equal(is_VVZ([t('calls', ''), t('Mary', 'NP1')], 0), true);
  // common-noun subject + verb + proper-noun object: "the device tracks Bob"
  assert.equal(is_VVZ([t('the', 'AT'), t('device', 'NN1'), t('tracks', ''), t('Bob', 'NP1')], 2), true);
  // ...but a determiner before still wins: "the records Smith kept" -> noun
  assert.equal(is_VVZ([t('the', 'AT'), t('records', ''), t('Smith', 'NP1'), t('kept', 'VVD')], 1), false);
});

test('is_VVZ: wider window — adverb look-through and determiner across an adjective', () => {
  // adverb between subject and verb: "John regularly records his notes"
  assert.equal(is_VVZ([t('John', 'NP1'), t('regularly', 'RR'), t('records', ''), t('his', 'APPGE'), t('notes', 'NN2')], 2), true);
  // determiner two words ahead of the subject noun: "the new machine records the data"
  assert.equal(is_VVZ([t('the', 'AT'), t('new', 'JJ'), t('machine', 'NN1'), t('records', ''), t('the', 'AT'), t('data', 'NN1')], 3), true);
  // plural verb after an adverb keeps the noun: "the records also show errors"
  assert.equal(is_VVZ([t('the', 'AT'), t('records', ''), t('also', 'RR'), t('show', 'VV0'), t('errors', 'NN2')], 1), false);
  // still a compound noun, not a verb: "the computer functions list"
  assert.equal(is_VVZ([t('the', 'AT'), t('computer', 'NN1'), t('functions', ''), t('list', 'NN1')], 2), false);
});

test('is_VVZ: a determiner/adjective with a stray adverb tag is not skipped (lexical tags)', () => {
  // The tagger is lexical: it reports every candidate tag, so "large" carries
  // ditto-adverb tags (RR22/RR33) and "on"/"the" carry RP/RR. The adverb
  // look-through must NOT treat those as adverbs and skip past them, or the
  // adjective/determiner cue is lost. "large 'bumps' on the edge" -> NN2.
  const bumps = [
    t('tubercles', 'NN2'), t('or', 'CC'), t('large', 'JJ|NN1|RR22|RR33'),
    t('bumps', ''), t('on', 'II|II21|RP|RR22|RR33'), t('the', 'AT|RR22'), t('edge', 'NN1|VV0'),
  ];
  assert.equal(is_VVZ(bumps, 3), false);
  // A determiner carrying a ditto-adverb tag still blocks the verb: "the records".
  assert.equal(is_VVZ([t('the', 'AT|RR22'), t('records', ''), t('show', 'VV0|NN1')], 1), false);
  // A genuinely pure adverb is still looked through: "it never records the data".
  assert.equal(is_VVZ([t('it', 'PPH1'), t('never', 'RR'), t('records', ''), t('the', 'AT'), t('data', 'NN1')], 2), true);
});

test('is_verb_VV0: subject pronoun + object marks a verb', () => {
  // "they use it" -> verb
  assert.equal(is_verb_VV0([t('they', 'PPHS2'), t('use', ''), t('it', 'PPH1')], 1), true);
});

test('is_verb_VV0: determiner before marks a noun', () => {
  // "the use of" -> noun
  assert.equal(is_verb_VV0([t('the', 'AT'), t('use', ''), t('of', 'IO')], 1), false);
});

test('is_verbal_s: an attributive participle + noun keeps the genitive', () => {
  // "today's featured article" — 's is genitive; "featured" modifies "article"
  assert.equal(is_verbal_s([t('today', 'NNT1'), t("'s", 'GE'), t('featured', 'VVN'), t('article', 'NN1')], 1), false);
  // "the author's published works" — genitive (the published works of the author)
  assert.equal(is_verbal_s([t('the', 'AT'), t('author', 'NN1'), t("'s", 'GE'), t('published', 'VVN'), t('works', 'NN2')], 2), false);
});

test('is_verbal_s: a predicative participle or pronoun marks the contracted verb', () => {
  // "he's gone" — contracted has
  assert.equal(is_verbal_s([t('he', 'PPHS1'), t("'s", 'GE'), t('gone', 'VVN')], 1), true);
  // "the bus's arriving late" — contracted is (no noun after the participle)
  assert.equal(is_verbal_s([t('the', 'AT'), t('bus', 'NN1'), t("'s", 'GE'), t('arriving', 'VVG'), t('late', 'RR')], 2), true);
  // "the author's published a book" — contracted has (article, not noun, after)
  assert.equal(is_verbal_s([t('author', 'NN1'), t("'s", 'GE'), t('published', 'VVN'), t('a', 'AT1'), t('book', 'NN1')], 1), true);
});

test('is_plural_noun: a cardinal before marks a plural', () => {
  // "two chassis" -> plural
  assert.equal(is_plural_noun([t('two', 'MC'), t('chassis', '')], 1), true);
});

test('is_plural_noun: a singular article before marks a singular', () => {
  // "a chassis" -> singular
  assert.equal(is_plural_noun([t('a', 'AT1'), t('chassis', '')], 1), false);
});

test('detectors are robust at array boundaries', () => {
  assert.doesNotThrow(() => is_VVZ([t('records', '')], 0));
  assert.doesNotThrow(() => is_verb_VV0([t('use', '')], 0));
  assert.doesNotThrow(() => is_plural_noun([t('chassis', '')], 0));
});
