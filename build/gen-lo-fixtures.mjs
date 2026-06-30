// Generates libreoffice/tests/fixtures.tsv: <input>\t<expected> pairs produced
// by the REAL JS engine (walkTextNodes + convert over a <p>), so the Python port
// in libreoffice/euspell/engine.py can be checked against ground truth.
//
// Uses the same minimal DOM shim as tests/dom-walker.test.js (no jsdom). The
// sentences deliberately avoid the ~70 semantic homographs and multi-word
// phrases, which the v1 Python port does not handle.
//
// Run: node build/gen-lo-fixtures.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// --- minimal DOM shim (mirrors tests/dom-walker.test.js) --------------------
const NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 };
const Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
class TextNode { constructor(v) { this.nodeType = 3; this.nodeValue = v; this.parentElement = null; } }
class ElementNode {
  constructor(tag) { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.childNodes = []; this.parentElement = null; this._editable = false; }
  append(...kids) { for (const k of kids) { k.parentElement = this; this.childNodes.push(k); } return this; }
  get isContentEditable() { return this._editable || (this.parentElement?.isContentEditable ?? false); }
}
const el = (tag, ...kids) => new ElementNode(tag).append(...kids);
const tx = (v) => new TextNode(v);
function createTreeWalker(root, _show, filter) {
  const out = [];
  (function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) { if (filter.acceptNode(node) === NodeFilter.FILTER_ACCEPT) out.push(node); return; }
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
const { SEMANTIC } = await import('../src/disambig/semantic/index.js');

// A sentence is in v1 scope only if it contains no semantic homograph (those are
// left to the user as choices, not auto-converted) — skip any that do.
const hasSemantic = (text) =>
  text.toLowerCase().match(/[a-z']+/g)?.some((w) => SEMANTIC.has(w)) ?? false;

function jsConvert(text) {
  const p = el('p', tx(text));
  walkTextNodes(p, convert);
  return p.childNodes.map((c) => c.nodeValue).join('');
}

// Ground-truth sentences: unchanged words, single-spelling reforms, NN2|VVZ
// diatones (noun & verb), 702 French plurals, 102 heteronyms, contractions,
// genitive 's, the pronoun I, capitalization, multi-sentence context.
const SENTENCES = [
  'The cat sat on the mat.',
  'They aahed at the view.',
  'Two records exist in the archive.',
  'She records the song every week.',
  'The anchors of ships are heavy.',
  'He anchors the boat each night.',
  'First aids were given.',
  'She aids him daily.',
  'The new machine records the data.',
  'John records his notes.',
  'Learning tools are useful.',
  'The chassis is broken.',
  'Two chassis were delivered.',
  'They separate the papers.',
  'The separate rooms were cold.',
  'I will separate them now.',
  'We use the tools.',
  'The use of force was wrong.',
  'I think it is fine.',
  'I am here.',
  'She is above the law.',
  'The above text is wrong.',
  'It could have been worse.',
  "The cat's tail is long.",
  "He's gone already.",
  'Above all, they thought it through.',
  'The rough night was long.',
  'People thought they could read it.',
  'The device which records sound is new.',
  'The committee debates the issue today.',
  'He debates whether to go.',
  'The permits expired last year.',
  'The city permits new building.',
  'Eight ounces of flour is enough.',
  'The night was rough and cold.',
  'Through the door they walked.',
  'Enough is enough, she thought.',
  'The daughter caught the ball.',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'libreoffice', 'tests');
mkdirSync(outDir, { recursive: true });
const kept = SENTENCES.filter((s) => !hasSemantic(s));
const skipped = SENTENCES.length - kept.length;
const rows = kept.map((s) => `${s}\t${jsConvert(s)}`);
writeFileSync(join(outDir, 'fixtures.tsv'), rows.join('\n') + '\n', 'utf8');
console.log(`[gen-lo-fixtures] wrote ${rows.length} fixtures (skipped ${skipped} with semantic words)`);
for (const r of rows) console.log('  ' + r.replace('\t', '  =>  '));
