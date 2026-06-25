import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- Minimal DOM shim sufficient for dom-walker.js (no jsdom dependency) ------
const NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 };
const Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

class TextNode {
  constructor(value) { this.nodeType = 3; this.nodeValue = value; this.parentElement = null; }
}
class ElementNode {
  constructor(tag) { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.childNodes = []; this.parentElement = null; this._editable = false; }
  append(...kids) { for (const k of kids) { k.parentElement = this; this.childNodes.push(k); } return this; }
  // Mirror the DOM: contenteditable is inherited by descendants.
  get isContentEditable() { return this._editable || (this.parentElement?.isContentEditable ?? false); }
}
const el = (tag, ...kids) => new ElementNode(tag).append(...kids);
const editable = (elem) => { elem._editable = true; return elem; };
const tx = (v) => new TextNode(v);

function createTreeWalker(root, _show, filter) {
  const out = [];
  (function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (filter.acceptNode(node) === NodeFilter.FILTER_ACCEPT) out.push(node);
      return;
    }
    for (const c of node.childNodes) visit(c);
  })(root);
  let i = -1;
  return { currentNode: root, nextNode() { return (this.currentNode = out[++i] ?? null); } };
}

globalThis.NodeFilter = NodeFilter;
globalThis.Node = Node;
globalThis.document = { createTreeWalker };

const { walkTextNodes } = await import('../src/content/dom-walker.js');
const { convert } = await import('../src/content/converter.js');

test('walkTextNodes converts text in place', () => {
  const node = tx('this is a test');
  walkTextNodes(el('p', node), convert);
  assert.notEqual(node.nodeValue, 'this is a test'); // something changed
  assert.match(node.nodeValue, /\biz\b/);            // "is" -> "iz"
});

test('walkTextNodes leaves contenteditable text untouched (user input)', () => {
  // text directly inside a contenteditable host
  const direct = tx('this is a test');
  walkTextNodes(editable(el('div', direct)), convert);
  assert.equal(direct.nodeValue, 'this is a test');
  // text nested under the editable host (contenteditable is inherited)
  const nested = tx('this is a test');
  walkTextNodes(editable(el('div', el('span', nested))), convert);
  assert.equal(nested.nodeValue, 'this is a test');
});

test('walkTextNodes is idempotent on a normal re-walk', () => {
  const node = tx('this is a test');
  const root = el('p', node);
  walkTextNodes(root, convert);
  const once = node.nodeValue;
  walkTextNodes(root, convert);                       // re-apply (observer would)
  assert.equal(node.nodeValue, once);                 // no drift
});

test('walkTextNodes does not double-convert a non-idempotent word on re-walk', () => {
  // "cached" -> "cashed" in one pass, but "cashed" is itself a source word that
  // would become "cashd". The per-node source memory must prevent that drift.
  const node = tx('cached files');
  const root = el('p', node);
  walkTextNodes(root, convert);
  const once = node.nodeValue;
  assert.doesNotMatch(once, /cashd/);                 // single pass stops at "cashed"
  walkTextNodes(root, convert);
  walkTextNodes(root, convert);
  assert.equal(node.nodeValue, once);                 // still stable after re-walks
});
