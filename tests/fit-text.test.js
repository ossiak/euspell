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
  assert.equal(padToFit('thought.', 'thoht.'), 'thoht.  ');
  for (const out of [
    padToFit('abandoned.', 'abandond.'),
    padToFit('thought.', 'thoht.'),
    padToFit('he thought.', 'he thoht.'),
  ]) {
    assert.ok(!/\s\.\s*$/.test(out), 'no space may separate the word from its period');
    assert.match(out, /\. +$/, 'the padding sits after the period');
  }
});

test('two or three letters shorter get two spaces of slack', () => {
  // A space each side, EXCEPT that a span may not begin with one — that would
  // indent the line. For a word at the start the leading space moves to the end,
  // so the slack (and therefore the fitted scale) is the same either way.
  assert.equal(padToFit('a thought', 'a thoht'), 'a  thoht ');
  assert.equal(padToFit('thought', 'thoht'), 'thoht  ');
  assert.equal(padToFit('bivouacked', 'bivuacd'), 'bivuacd  ');
  // Moving the space must not lose it: the slack decides the fitted scale, so a
  // word at the start of a span has to be padded by the same amount as one in
  // the middle, or it would be drawn wider than its neighbours.
  const spaces = (s) => (s.match(/ /g) ?? []).length;
  for (const [o, r] of [['thought', 'thoht'], ['a thought', 'a thoht']]) {
    const drawn = padToFit(o, r);
    assert.equal(spaces(drawn) - spaces(r), 2, `${o}: two spaces of slack either way`);
    assert.ok(!drawn.startsWith(' '), 'never indented');
  }
});

test('same length, longer, or far shorter is left unpadded', () => {
  assert.equal(padToFit('aahs', 'aahz'), 'aahz');            // equal
  assert.equal(padToFit('almost', 'allmoste'), 'allmoste');  // longer
  assert.equal(padToFit('andouille', 'andui'), 'andui');     // four shorter
});

test('a multi-word span is padded word by word, never at the front', () => {
  // A PDF text item is often a whole line. Judged as one string, two words that
  // each lose a letter make the SPAN two shorter, which took the two-or-three
  // rule and indented the line. This is the real line from page 3 of
  // sites.engineering.ucsb.edu/~shell/che210d/python.pdf that showed it:
  // "learn"→"lern" and "are"→"ar" each drop one.
  const original = 'and easy to use and learn. Programs written in Python are';
  const reformed = 'and easy tu uze and lern. Programs written in Python ar';
  const drawn = padToFit(original, reformed);

  assert.ok(!drawn.startsWith(' '), 'a leading space would indent the line');
  // Each shortened word carries its own slack, so the words after it stay near
  // where they were rather than all shifting to make room at one end.
  assert.ok(drawn.includes('lern. '), 'the space follows the word that shrank');
  assert.ok(drawn.endsWith('ar '), 'and the last one keeps its own');
  assert.equal(drawn.replace(/\s+/g, ' ').trim(), reformed, 'no word is altered');
});

test('a leading word that shrinks does not push the line right', () => {
  // The first word losing a letter is the case a whole-span rule got wrong most
  // visibly, since its padding landed before everything else on the line.
  const drawn = padToFit('learned the answer', 'lernd the answer');
  assert.ok(!drawn.startsWith(' '));
  assert.ok(drawn.startsWith('lernd '));
});

test('padding never alters the word itself', () => {
  for (const [o, r] of [['abandoned', 'abandond'], ['thought', 'thoht'], ['aahs', 'aahz']]) {
    assert.equal(padToFit(o, r).trim(), r);
  }
});
