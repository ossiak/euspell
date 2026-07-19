import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../../src/dictation/normalize.js';

test('spoken punctuation becomes marks with tightened spacing', () => {
  assert.equal(normalize('hello period'), 'Hello.');
  assert.equal(normalize('wait comma then go'), 'Wait, then go');
  assert.equal(normalize('really question mark'), 'Really?');
  assert.equal(normalize('stop exclamation mark'), 'Stop!');
  assert.equal(normalize('one full stop two'), 'One. Two');
});

test('sentences after a mark are capitalized', () => {
  assert.equal(normalize('one period two period'), 'One. Two.');
  assert.equal(normalize('go home question mark yes'), 'Go home? Yes');
});

test('new line and new paragraph insert breaks and capitalize the next line', () => {
  assert.equal(normalize('first line new line second line'), 'First line\nSecond line');
  assert.equal(normalize('a new paragraph b'), 'A\n\nB');
});

test('the standalone pronoun i is uppercased for the converter', () => {
  assert.equal(normalize('i think i can'), 'I think I can');
  // not inside another word
  assert.equal(normalize('this is fine'), 'This is fine');
});

test('an "i" opening an abbreviation is not the pronoun', () => {
  // (the capital C is the sentence-opener rule seeing "e. c" — longstanding,
  // separate behavior; the point here is the lowercase "i.e.")
  assert.equal(normalize('they varied i.e. changed'), 'They varied i.e. Changed');
  // a genuine sentence-final "i" still uppercases (next char is space, not a letter)
  assert.equal(normalize('so did i period then we left'), 'So did I. Then we left');
});

test('multi-word marks win over their prefixes', () => {
  assert.equal(normalize('a new paragraph b new line c'), 'A\n\nB\nC');
});

test('leading and collapsed whitespace is cleaned', () => {
  assert.equal(normalize('  hello    there  '), 'Hello there');
});

test('empty input stays empty', () => {
  assert.equal(normalize(''), '');
});
