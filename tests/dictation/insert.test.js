// Which elements dictation will write into.
//
// The reader is built never to touch editable text; dictation is the deliberate
// inverse, so the set of valid targets is the whole of its blast radius.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEditableTarget } from '../../src/dictation/insert.js';

/** A stand-in for an <input>; `type` is the IDL property, never null in a browser. */
const input = (type, extra = {}) => ({ tagName: 'INPUT', type, disabled: false, readOnly: false, ...extra });
const textarea = (extra = {}) => ({ tagName: 'TEXTAREA', disabled: false, readOnly: false, ...extra });

test('free-text inputs and textareas are valid targets', () => {
  for (const type of ['text', 'search', 'url', 'tel', 'email', '']) {
    assert.equal(isEditableTarget(input(type)), true, `input[type=${type}] should accept dictation`);
  }
  assert.equal(isEditableTarget(textarea()), true);
  assert.equal(isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);
});

test('a password field is never a dictation target', () => {
  // Two independent reasons, either sufficient. The overlay pill renders the
  // live interim transcript as ordinary on-screen text, so dictating into a
  // masked field would put the secret in plain sight — undoing the masking the
  // field exists for. And the text arrives REFORMED, since every utterance goes
  // through the euspell converter, so the value typed would not be the value
  // spoken: silent corruption of a string whose whole point is exactness.
  assert.equal(isEditableTarget(input('password')), false);
  assert.equal(isEditableTarget(input('PASSWORD')), false, 'the type is matched case-insensitively');
});

test('inputs that hold no prose are not targets', () => {
  // 'number' also rejects the selection API outright, which the manual insertion
  // fallback would trip over.
  for (const type of ['number', 'checkbox', 'radio', 'file', 'range', 'color', 'date', 'submit', 'hidden']) {
    assert.equal(isEditableTarget(input(type)), false, `input[type=${type}] should be refused`);
  }
});

test('a field the user cannot type in is not one dictation may type in', () => {
  assert.equal(isEditableTarget(input('text', { disabled: true })), false);
  assert.equal(isEditableTarget(input('text', { readOnly: true })), false);
  assert.equal(isEditableTarget(textarea({ disabled: true })), false);
  assert.equal(isEditableTarget(textarea({ readOnly: true })), false);
});

test('non-editable elements and nothing at all are refused', () => {
  assert.equal(isEditableTarget({ tagName: 'DIV', isContentEditable: false }), false);
  assert.equal(isEditableTarget({ tagName: 'P' }), false);
  assert.equal(isEditableTarget(null), false);
  assert.equal(isEditableTarget(undefined), false);
});
