import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- Minimal DOM shim sufficient for dom-walker.js (no jsdom dependency) ------
const NodeFilter = { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 };
const Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

class TextNode {
  constructor(value) { this.nodeType = 3; this.nodeValue = value; this.parentElement = null; }
}
class ElementNode {
  constructor(tag) { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.childNodes = []; this.parentElement = null; this._editable = false; this._attrs = {}; }
  append(...kids) { for (const k of kids) { k.parentElement = this; this.childNodes.push(k); } return this; }
  getAttribute(name) { return this._attrs[name] ?? null; }
  // Mirror the DOM: contenteditable is inherited by descendants.
  get isContentEditable() { return this._editable || (this.parentElement?.isContentEditable ?? false); }
}
const el = (tag, ...kids) => new ElementNode(tag).append(...kids);
const editable = (elem) => { elem._editable = true; return elem; };
const optOut = (elem, value = 'off') => { elem._attrs['data-euspell'] = value; return elem; };
const tx = (v) => new TextNode(v);

function createTreeWalker(root, show, filter) {
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

test('a <br> stops the line-end word gluing to the next line', () => {
  // The flip side of the drop-cap case: text either side of a <br> is NOT
  // contiguous. Joining it produced "throughnight", which matches nothing, so
  // BOTH words silently passed through unreformed.
  const a = tx('walk through');
  const b = tx('night air');
  walkTextNodes(el('div', a, el('br'), b), convert);
  assert.equal(a.nodeValue, 'wahk thruh');
  assert.equal(b.nodeValue, 'niht air');
});

test('a whitespace-only text node keeps its neighbours apart', () => {
  // The inverse of the drop-cap case. A block's nodes are concatenated into one
  // source string, so a whitespace-only node dropped from the walk takes its
  // space with it and glues the words either side: "<span>The</span> <span>
  // research</span>" tokenized as "Theresearch", matched nothing, and BOTH words
  // passed through unreformed. Pretty-printed markup is the common shape.
  const gap = tx(' ');
  const a = tx('The');
  const b = tx('research');
  walkTextNodes(el('p', el('span', a), gap, el('span', b)), convert);
  assert.equal(a.nodeValue, 'The');
  assert.equal(b.nodeValue, 'reserqh');
  assert.equal(gap.nodeValue, ' '); // the separator itself is written back as-is

  // Newline-indented markup, the same shape as it comes out of a formatter.
  const c = tx('The');
  const d = tx('research');
  walkTextNodes(el('p', tx('\n  '), el('span', c), tx('\n  '), el('span', d), tx('\n')), convert);
  assert.equal(c.nodeValue, 'The');
  assert.equal(d.nodeValue, 'reserqh');

  // The damaging case: a glued pair that DOES hit the lexicon was reformed as one
  // word and split back across the nodes by share, corrupting both.
  const e = tx('book');
  const f = tx('keeper');
  walkTextNodes(el('p', el('b', e), tx(' '), el('b', f)), convert);
  assert.equal(e.nodeValue, 'book');
  assert.equal(f.nodeValue, 'keeper');
});

test("a whole-word possessive contraction decides on its post-clitic context", () => {
  // Driven through the tokenizer, not a hand-built token array: the bug lived in
  // exactly the step a synthetic stream skips. The tokenizer expands a
  // contraction to one pseudo-token per PoS position and puts identity on the
  // FIRST, so "anyone's" occupies [PN1, GE|VBZ|VHZ]. Routing is_verbal_s at that
  // first slot made it read the contraction's own second pseudo-token as the
  // following word, see its VBZ, and answer "contracted verb" every time — every
  // genitive came out as 'z ("Anybody's guess" -> "Anybody'z ghess").
  const conv = (s) => {
    const node = tx(s);
    walkTextNodes(el('p', node), convert);
    return node.nodeValue;
  };
  assert.equal(conv("Anybody's guess is good."), "Anybody's ghess iz good.");
  assert.equal(conv("Anybody's coming along."), "Anybody'z coming along.");
  assert.equal(conv("Everyone's opinion counts."), "Evrywun's opinion counts.");
  assert.equal(conv("Everyone's going home."), "Evrywun'z going home.");
  assert.equal(conv("Nobody's fault but mine."), "Nobody's fault but mine.");
  assert.equal(conv("Nobody's here."), "Nobody'z here.");

  // The bare productive clitic is one component, so its slot is unchanged — it
  // decided correctly before and must still.
  assert.equal(conv("The cat's tail is long."), "The cat's tail iz long.");
  assert.equal(conv("The cat's sleeping."), "The cat'z sleeping.");
});

test('pdf.js text-layer lines convert independently', () => {
  // The PDF viewer's real shape: one absolutely-positioned span per text item,
  // and a <br role="presentation"> after every item whose hasEOL is set — so
  // every line boundary on the page is a <br> between sibling spans, all under
  // one container. "to" ends line 1 and used to glue into "toWorkers'".
  const l1 = tx('Pocket Guide to');
  const l2 = tx("Workers' Compensation");
  walkTextNodes(el('div', el('span', l1), el('br'), el('span', l2), el('br')), convert);
  assert.equal(l1.nodeValue, 'Pocket Ghide tu');
  assert.equal(l2.nodeValue, "Workers' Compensation");
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

// --- the collapsed token stream every rule reads -----------------------------
// A matched phrase becomes ONE token in the stream handed to the converter, so
// its shape is what the neighbouring words' rules see. Assembling that token by
// hand is easy to do incompletely: it carried no sepAfter at all, and nothing
// noticed only because a phrase is rendered whole and never itself converted.
// isPronounI already reads sepAfter; the next rule to read a NEIGHBOUR's would
// have silently got undefined and read a bound word as free-standing.

/** Convert `text` and return every token stream the converter was handed. */
function streamsFor(text) {
  const seen = [];
  walkTextNodes(el('p', tx(text)), (word, tokens, idx) => {
    seen.push(tokens);
    return convert(word, tokens, idx);
  });
  return seen;
}

test('every token in the collapsed stream has the full Token shape', () => {
  // "according to" is a known phrase (encoding 101), so it collapses to one
  // token sitting between two ordinary words.
  const seen = streamsFor('I read according to the plan.');
  assert.ok(seen.length > 0, 'the converter must have been called');

  for (const tokens of seen) {
    for (const t of tokens) {
      const where = JSON.stringify(t);
      assert.equal(typeof t.word, 'string', `word missing on ${where}`);
      assert.equal(typeof t.tag, 'string', `tag missing on ${where}`);
      assert.equal(typeof t.breakAfter, 'boolean', `breakAfter missing on ${where}`);
      assert.equal(typeof t.sepAfter, 'string', `sepAfter missing on ${where}`);
    }
  }
  // …and the phrase really did collapse, or the loop above proved nothing.
  const collapsed = seen.find((tokens) => tokens.some((t) => t.word === 'according to'));
  assert.ok(collapsed, 'the phrase must appear in the stream as a single token');
});

test('a phrase token takes its edge properties from its last word', () => {
  // The phrase ends the sentence here, so the token standing for it must carry
  // the break — a later word would otherwise draw context across the boundary.
  const seen = streamsFor('It went according to. Then it stopped.');
  const stream = seen.find((tokens) => tokens.some((t) => t.word === 'according to'));
  assert.ok(stream, 'the phrase must appear as a single token');
  const phrase = stream.find((t) => t.word === 'according to');
  assert.equal(phrase.breakAfter, true, 'the phrase ends the sentence');
  assert.equal(phrase.sepAfter, '.', 'and the character following it is its own');
});

// --- write-back across many text nodes ---------------------------------------
// Mapping each converted piece back to the node it came from needs the node an
// offset falls in, looked up twice per piece. That lookup is a binary search
// over the block's node boundaries; a linear scan made the write-back quadratic
// in the number of nodes, which is exactly the shape of a PDF text layer —
// pdf.js emits one span, and so one text node, per glyph run.
test('a block split into many text nodes converts as if it were one', () => {
  const words = 'this is a test of the conversion engine and it is a good test '.repeat(12).trim();
  const oneNode = tx(words);
  walkTextNodes(el('p', oneNode), convert);

  // The same text with one node per word — over a hundred boundaries to search.
  const parts = words.split(' ').map((w, i, a) => tx(i === a.length - 1 ? w : `${w} `));
  assert.ok(parts.length > 100, 'enough nodes to exercise the search');
  walkTextNodes(el('p', ...parts), convert);

  assert.equal(parts.map((n) => n.nodeValue).join(''), oneNode.nodeValue);
  assert.match(oneNode.nodeValue, /\biz\b/, 'and it really did convert');

  // Each word must land back in ITS OWN node. The join above cannot see this:
  // characters attributed to the wrong node still concatenate to the same
  // string, so a search that is off by one at a node boundary reads as correct
  // until you look at where the text actually went — and it is the DOM that
  // decides which half of a word is inside the <b> and which is outside.
  parts.forEach((node, i) => {
    assert.match(
      node.nodeValue,
      /^\S+ ?$/,
      `node ${i} should hold exactly one word, got ${JSON.stringify(node.nodeValue)}`,
    );
  });
});

test('a word split across text nodes is still converted whole', () => {
  // The drop-cap shape: one word spanning several nodes. Each node takes a share
  // of the converted text proportional to its share of the original, so the node
  // boundaries fall INSIDE a single piece — the search's awkward case.
  const a = tx('convers');
  const b = tx('at');
  const c = tx('ion is a test');
  walkTextNodes(el('p', el('span', a), el('span', b), c), convert);

  const whole = tx('conversation is a test');
  walkTextNodes(el('p', whole), convert);
  assert.equal(a.nodeValue + b.nodeValue + c.nodeValue, whole.nodeValue,
    'splitting a word by markup must not change what the block converts to');
});

// A page opts a subtree out with data-euspell="off" — the mechanism the euspell
// white paper will use on euspell.org, where converting the text would rewrite
// the traditional spellings it quotes against their reformed counterparts.
test('walkTextNodes leaves a data-euspell="off" subtree in traditional spelling', () => {
  const optedOut = tx('this is a test');
  const normal = tx('this is a test');
  walkTextNodes(el('div', optOut(el('article', el('p', optedOut))), el('p', normal)), convert);
  assert.equal(optedOut.nodeValue, 'this is a test'); // untouched, attribute honoured
  assert.match(normal.nodeValue, /\biz\b/);           // the rest of the page still converts
});

test('the opt-out covers deep descendants and is matched case-insensitively', () => {
  const deep = tx('this is a test');
  walkTextNodes(optOut(el('main', el('section', el('p', el('span', deep)))), 'OFF'), convert);
  assert.equal(deep.nodeValue, 'this is a test');
});

test('data-euspell with any other value does not opt out', () => {
  const node = tx('this is a test');
  walkTextNodes(optOut(el('div', el('p', node)), 'on'), convert);
  assert.match(node.nodeValue, /\biz\b/);
});
