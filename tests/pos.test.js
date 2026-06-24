import { test } from 'node:test';
import assert from 'node:assert/strict';
import { is_VVZ, is_verb_VV0, is_plural_noun } from '../src/disambig/pos.js';
import { t } from './helpers.js';

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

test('is_verb_VV0: subject pronoun + object marks a verb', () => {
  // "they use it" -> verb
  assert.equal(is_verb_VV0([t('they', 'PPHS2'), t('use', ''), t('it', 'PPH1')], 1), true);
});

test('is_verb_VV0: determiner before marks a noun', () => {
  // "the use of" -> noun
  assert.equal(is_verb_VV0([t('the', 'AT'), t('use', ''), t('of', 'IO')], 1), false);
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
