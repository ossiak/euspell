// A minimal DOM, enough for src/content/dom-walker.js to run under Node with no
// jsdom dependency.
//
// This existed twice — in tests/dom-walker.test.js and build/gen-lo-fixtures.mjs,
// whose header admitted copying the first — and a third consumer was about to
// arrive. Two copies had already diverged: the fixtures' version ignored the
// TreeWalker's `show` mask entirely, so a SHOW_ELEMENT walk silently saw no
// elements. Harmless for single-line sentences, wrong in general, and invisible
// either way. This is the fuller of the two.
//
// Usage — install BEFORE importing anything that touches the DOM:
//
//   import { installDomShim, el, tx } from './lib/dom-shim.js';
//   installDomShim();
//   const { walkTextNodes } = await import('../src/content/dom-walker.js');

export const NodeFilter = {
  SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3,
};
export const Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

export class TextNode {
  constructor(value) { this.nodeType = 3; this.nodeValue = value; this.parentElement = null; }
}

export class ElementNode {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.childNodes = [];
    this.parentElement = null;
    this._editable = false;
    this._attrs = {};
  }

  append(...kids) {
    for (const k of kids) { k.parentElement = this; this.childNodes.push(k); }
    return this;
  }

  getAttribute(name) { return this._attrs[name] ?? null; }

  // Mirror the DOM: contenteditable is inherited by descendants.
  get isContentEditable() {
    return this._editable || (this.parentElement?.isContentEditable ?? false);
  }

  get textContent() {
    return this.childNodes
      .map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent))
      .join('');
  }
}

export const el = (tag, ...kids) => new ElementNode(tag).append(...kids);
export const tx = (v) => new TextNode(v);
export const editable = (elem) => { elem._editable = true; return elem; };
export const optOut = (elem, value = 'off') => { elem._attrs['data-euspell'] = value; return elem; };

export function createTreeWalker(root, show, filter) {
  const out = [];
  const wantElements = (show & NodeFilter.SHOW_ELEMENT) !== 0;
  (function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (filter.acceptNode(node) === NodeFilter.FILTER_ACCEPT) out.push(node);
      return;
    }
    // An accepted element is emitted before its children, matching TreeWalker's
    // document order; SKIP still descends, which is how non-<br> elements behave.
    if (wantElements && node !== root && filter.acceptNode(node) === NodeFilter.FILTER_ACCEPT) {
      out.push(node);
    }
    for (const c of node.childNodes) visit(c);
  })(root);
  let i = -1;
  return { currentNode: root, nextNode() { return (this.currentNode = out[++i] ?? null); } };
}

/** Put the shim on globalThis. Call before importing dom-walker.js. */
export function installDomShim() {
  globalThis.NodeFilter = NodeFilter;
  globalThis.Node = Node;
  globalThis.document = {
    createTreeWalker,
    createElement: (tag) => new ElementNode(tag),
  };
}
