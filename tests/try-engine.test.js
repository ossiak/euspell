import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- Minimal DOM shim: just enough for convertText()'s detached <div> ---------
// Unbundled, try-engine.js imports the baked-in lexicon, so no load() is needed.
const NodeFilter = { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 };
const Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

class TextNode {
  constructor(value, parent) { this.nodeType = 3; this.nodeValue = value; this.parentElement = parent; }
}
class ElementNode {
  constructor(tag) { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.childNodes = []; this.parentElement = null; }
  getAttribute() { return null; }
  get isContentEditable() { return false; }
  set textContent(v) { this.childNodes = [new TextNode(v, this)]; }
  get textContent() { return this.childNodes.map((n) => n.nodeValue).join(''); }
}
function createTreeWalker(root) {
  const out = root.childNodes.slice();
  let i = -1;
  return { currentNode: root, nextNode() { return (this.currentNode = out[++i] ?? null); } };
}

globalThis.NodeFilter = NodeFilter;
globalThis.Node = Node;
globalThis.document = { createTreeWalker, createElement: (tag) => new ElementNode(tag) };
globalThis.window = globalThis;

await import('../src/web/try-engine.js');
const { convertText } = await import('../src/content/dom-walker.js');
const { convert } = await import('../src/content/converter.js');
const { convertSegments } = globalThis.EuspellTry;

const joined = (segments) => segments.map((s) => s.text).join('');

test('the segments read exactly what the page pipeline produces', () => {
  const text = 'I thought the knight would laugh at the doubt in his voice.';
  assert.equal(joined(convertSegments(text)), convertText(text, convert));
});

test('a changed word carries the spelling it replaced; an unchanged one does not', () => {
  const segments = convertSegments('The knight laughed.');
  const changed = segments.filter((s) => 'was' in s);
  assert.ok(changed.length > 0, 'expected at least one change');
  for (const s of changed) assert.notEqual(s.text, s.was);
  assert.ok(changed.some((s) => s.was === 'knight'));
});

test('text with nothing to reform comes back as one plain segment', () => {
  assert.deepEqual(convertSegments('A cat sat on a mat.'), [{ text: 'A cat sat on a mat.' }]);
});

test('the noun and the verb records are told apart by their sentence', () => {
  const changed = (text) => convertSegments(text).some((s) => s.was === 'records');
  assert.equal(changed('She kept the records in a box.'), false);
  assert.equal(changed('She records every meeting.'), true);
});

test('each line is converted on its own, and line breaks survive', () => {
  const text = 'The knight\n\nlaughed at the doubt';
  const segments = convertSegments(text);
  assert.equal(joined(segments).split('\n').length, 3);
  assert.equal(
    joined(segments),
    text.split('\n').map((l) => (l.trim() ? convertText(l, convert) : l)).join('\n'),
  );
});
