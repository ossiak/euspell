// The PDF viewer's padding rule. Small, but it decides where every changed word
// sits inside its slot on a converted page, and it has been got wrong twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { padToFit } from '../src/pdf/fit-text.js';

test('one letter shorter is padded AFTER the word', () => {
  // The commonest case by far — the -ed and silent-e endings, 35% of all
  // reformed spellings. A leading space would push the glyphs right inside their
  // box, indenting any such word that begins a line and breaking the left
  // margin; trailing keeps the left edge where the original word started.
  assert.equal(padToFit('abandoned', 'abandond'), 'abandond ');
  assert.equal(padToFit('aahed', 'aahd'), 'aahd ');
  assert.equal(padToFit('achieved', 'aqhievd'), 'aqhievd ');
});

test('a trailing period keeps the space after it, not before it', () => {
  // A span carries its own punctuation, so the reform already ends with the
  // period and appending puts the space beyond it — where a sentence break
  // wants it, rather than wedged between the word and its full stop.
  assert.equal(padToFit('abandoned.', 'abandond.'), 'abandond. ');
  assert.equal(padToFit('aahed.', 'aahd.'), 'aahd. ');
  assert.equal(padToFit('thought.', 'thoht.'), ' thoht. ');
  for (const out of [padToFit('abandoned.', 'abandond.'), padToFit('thought.', 'thoht.')]) {
    assert.ok(!/\.\S*\s\.$/.test(out), 'no space may separate the word from its period');
    assert.ok(out.endsWith('. '), 'the padding sits after the period');
  }
});

test('two or three letters shorter keep a space on each side', () => {
  assert.equal(padToFit('thought', 'thoht'), ' thoht ');
  assert.equal(padToFit('through', 'thruh'), ' thruh ');
  assert.equal(padToFit('bivouacked', 'bivuacd'), ' bivuacd ');
});

test('same length, longer, or far shorter is left unpadded', () => {
  assert.equal(padToFit('aahs', 'aahz'), 'aahz');            // equal
  assert.equal(padToFit('almost', 'allmoste'), 'allmoste');  // longer
  assert.equal(padToFit('andouille', 'andui'), 'andui');     // four shorter
});

test('padding never alters the word itself', () => {
  for (const [o, r] of [['abandoned', 'abandond'], ['thought', 'thoht'], ['aahs', 'aahz']]) {
    assert.equal(padToFit(o, r).trim(), r);
  }
});
