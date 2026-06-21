import { tagWord } from './tagger.js';
import { isContraction, contractionComponents } from './contractions.js';

/** @typedef {import('./context.js').Token} Token */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);

// Tags that start a new block-level context. Text under different blocks is
// tokenized independently so a sentence never draws context across a structural
// boundary; inline elements (SPAN, EM, A, B, …) are deliberately absent so a
// sentence split by markup is still tagged as one stream.
const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BODY', 'DD', 'DETAILS', 'DIV',
  'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2',
  'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'HTML', 'LI', 'MAIN', 'NAV', 'OL', 'P',
  'SECTION', 'TABLE', 'TD', 'TH', 'TR', 'UL',
]);

// A "run" is a word that may carry apostrophes (contractions, clitics): an
// optional leading apostrophe ('tis, 'em), word chars, and any number of
// apostrophe-joined word chars (don't, couldn't've), plus an optional trailing
// apostrophe (James'). Everything between runs is a separator.
const RUN = /['’ʼ]?\w+(?:['’ʼ]\w+)*['’ʼ]?/g;
const GENITIVE = /^(\w+)(['’ʼ]s)$/i;
const SENTENCE_BREAK = /[.!?]/;

/**
 * Walks all text under `root`, grouping it into block-level units and converting
 * each unit as one token stream so disambiguation has cross-text-node context.
 * @param {Node} root
 * @param {(word: string, tokens: Token[], idx: number) => string} convertFn
 */
export function walkTextNodes(root, convertFn) {
  for (const textNodes of collectBlocks(root)) {
    convertBlock(textNodes, convertFn);
  }
}

/**
 * Groups the convertible text nodes under `root` by their nearest block-level
 * ancestor, preserving document order within each group.
 * @param {Node} root
 * @returns {Text[][]}
 */
function collectBlocks(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (node.nodeValue.trim() === '') return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  /** @type {Map<Node, Text[]>} */
  const groups = new Map();
  while (walker.nextNode()) {
    const node = /** @type {Text} */ (walker.currentNode);
    const block = nearestBlock(node.parentElement, root);
    let group = groups.get(block);
    if (!group) groups.set(block, (group = []));
    group.push(node);
  }
  return [...groups.values()];
}

/**
 * Climbs from `el` to the nearest block-level ancestor, stopping at `root`.
 * @param {Element | null} el
 * @param {Node} root
 * @returns {Node}
 */
function nearestBlock(el, root) {
  for (let cur = el; cur; cur = cur.parentElement) {
    if (cur === root || BLOCK_TAGS.has(cur.tagName)) return cur;
  }
  return root;
}

/**
 * Splits text into ordered segments. A segment is a separator, a plain word, or
 * a contraction surface form. A productive clitic ("cat's") is split into its
 * stem plus the "'s" contraction; surrounding apostrophes on a non-contraction
 * (quotes) are peeled off as separators.
 *
 * @param {string} text
 * @returns {Generator<{ text: string, kind: 'sep' | 'word' | 'contraction' }>}
 */
export function* tokenize(text) {
  let last = 0;
  for (const m of text.matchAll(RUN)) {
    if (m.index > last) yield { text: text.slice(last, m.index), kind: 'sep' };
    yield* classifyRun(m[0]);
    last = m.index + m[0].length;
  }
  if (last < text.length) yield { text: text.slice(last), kind: 'sep' };
}

/** @param {string} run @returns {Generator<{ text: string, kind: string }>} */
function* classifyRun(run) {
  if (isContraction(run)) {
    yield { text: run, kind: 'contraction' };
    return;
  }
  // Productive genitive/verbal clitic, e.g. "cat's" -> "cat" + "'s".
  const gen = GENITIVE.exec(run);
  if (gen && isContraction("'s")) {
    yield { text: gen[1], kind: 'word' };
    yield { text: gen[2], kind: 'contraction' };
    return;
  }
  // Otherwise peel surrounding apostrophes (quotes) off as separators.
  const lead = run.match(/^['’ʼ]+/)?.[0] ?? '';
  const trail = run.slice(lead.length).match(/['’ʼ]+$/)?.[0] ?? '';
  const core = run.slice(lead.length, run.length - trail.length);
  if (lead) yield { text: lead, kind: 'sep' };
  if (core) yield { text: core, kind: 'word' };
  if (trail) yield { text: trail, kind: 'sep' };
}

/**
 * Tokenizes a block's text nodes into a single stream, converts each word with
 * full in-block context, then writes the result back to its originating node.
 * Contractions occupy one surface piece but expand to one pseudo-token per PoS
 * position, so neighbors see correct left/right adjacency.
 *
 * @param {Text[]} textNodes
 * @param {(word: string, tokens: Token[], idx: number) => string} convertFn
 */
function convertBlock(textNodes, convertFn) {
  /** @type {{ node: Text, text: string, wordIdx: number }[]} */
  const pieces = [];
  /** @type {Token[]} */
  const tokens = [];

  for (const node of textNodes) {
    for (const seg of tokenize(node.nodeValue)) {
      if (seg.kind === 'sep') {
        pieces.push({ node, text: seg.text, wordIdx: -1 });
        // A separator carrying ./!/? ends the preceding word's sentence.
        if (tokens.length && SENTENCE_BREAK.test(seg.text)) {
          tokens[tokens.length - 1].breakAfter = true;
        }
      } else if (seg.kind === 'contraction') {
        const components = contractionComponents(seg.text);
        pieces.push({ node, text: seg.text, wordIdx: tokens.length });
        if (components.length) {
          // One pseudo-token per sequence position; identity rides on the first.
          components.forEach((tag, i) =>
            tokens.push({ word: i === 0 ? seg.text : '', tag, breakAfter: false }));
        } else {
          tokens.push({ word: seg.text, tag: tagWord(seg.text), breakAfter: false });
        }
      } else {
        pieces.push({ node, text: seg.text, wordIdx: tokens.length });
        tokens.push({ word: seg.text, tag: tagWord(seg.text), breakAfter: false });
      }
    }
  }
  if (tokens.length === 0) return;
  tokens[tokens.length - 1].breakAfter = true; // end of block === end of sentence

  // Convert each word/contraction piece from its surface text at its token slot.
  for (const piece of pieces) {
    if (piece.wordIdx !== -1) {
      piece.text = convertFn(piece.text, tokens, piece.wordIdx);
    }
  }

  // Reassemble each node from its (possibly rewritten) fragments.
  /** @type {Map<Text, string[]>} */
  const byNode = new Map();
  for (const piece of pieces) {
    let parts = byNode.get(piece.node);
    if (!parts) byNode.set(piece.node, (parts = []));
    parts.push(piece.text);
  }
  for (const [node, parts] of byNode) {
    const joined = parts.join('');
    if (joined !== node.nodeValue) node.nodeValue = joined;
  }
}
