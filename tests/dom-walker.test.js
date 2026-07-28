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

const { walkTextNodes, tokenize } = await import('../src/content/dom-walker.js');
const { convert } = await import('../src/content/converter.js');

test('tokenize keeps accented words whole (no ASCII-fragment splitting)', () => {
  const words = (s) => [...tokenize(s)].filter((t) => t.kind !== 'sep').map((t) => t.text);
  assert.deepEqual(words('a naïve café'), ['a', 'naïve', 'café']);
  assert.deepEqual(words('señor Álvarez preëmpts'), ['señor', 'Álvarez', 'preëmpts']);
  // ASCII behaviour is unchanged ("don't" is one contraction token; the trailing
  // apostrophe on "James'" peels off as a separator).
  assert.deepEqual(words("don't read James' book"), ["don't", 'read', 'James', 'book']);
});

test('walkTextNodes leaves accented words unconverted as whole tokens', () => {
  // Whole accented words miss the (ASCII) lexicon and must pass through — never
  // converted piecemeal because an ASCII fragment happened to be English.
  const node = tx('the naïve café owner');
  walkTextNodes(el('p', node), convert);
  assert.match(node.nodeValue, /naïve/);
  assert.match(node.nodeValue, /café/);
});

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

test('walkTextNodes skips text nested inside skip tags (syntax-highlighted code)', () => {
  // Direct child of a skip tag.
  const direct = tx('this is a test');
  walkTextNodes(el('pre', direct), convert);
  assert.equal(direct.nodeValue, 'this is a test');
  // Span-wrapped, the shape every highlighter produces: <pre><span>…</span></pre>.
  const nested = tx('this is a test');
  walkTextNodes(el('pre', el('span', nested)), convert);
  assert.equal(nested.nodeValue, 'this is a test');
  const inCode = tx('const is = require("x")');
  walkTextNodes(el('code', el('span', el('span', inCode))), convert);
  assert.equal(inCode.nodeValue, 'const is = require("x")');
  // Re-walking a subtree that lives INSIDE a skipped region (the observer sees
  // the span, not the <pre>) must stay skipped — the climb passes the walk root.
  const span = el('span', tx('this is a test'));
  el('pre', span);
  walkTextNodes(span, convert);
  assert.equal(span.childNodes[0].nodeValue, 'this is a test');
});

test('walkTextNodes keeps a word split across text nodes whole (drop cap)', () => {
  // <p><span class="dropcap">I</span>celand</p> — "Iceland" is split across two
  // text nodes. It must convert as ONE word (unchanged), not the fragments
  // "I" (-> the pronoun "Ih") + "celand" == "Ihceland".
  const cap = tx('I');
  const rest = tx('celand');
  walkTextNodes(el('p', el('span', cap), rest), convert);
  assert.equal(cap.nodeValue + rest.nodeValue, 'Iceland');
  assert.equal(cap.nodeValue, 'I'); // drop-cap letter stays in its own node

  // A split word that DOES reform stays correct: "Island" -> "Ihland".
  const cap2 = tx('I');
  const rest2 = tx('sland');
  walkTextNodes(el('p', el('span', cap2), rest2), convert);
  assert.equal(cap2.nodeValue + rest2.nodeValue, 'Ihland');
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
