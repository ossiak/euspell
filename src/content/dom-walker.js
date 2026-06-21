import { tagWord } from './tagger.js';

/** @typedef {import('./context.js').Token} Token */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);

// Tags that start a new block-level context. Text under different blocks is
// tokenised independently so a sentence never draws context across a structural
// boundary; inline elements (SPAN, EM, A, B, …) are deliberately absent so a
// sentence split by markup is still tagged as one stream.
const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BODY', 'DD', 'DETAILS', 'DIV',
  'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2',
  'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'HTML', 'LI', 'MAIN', 'NAV', 'OL', 'P',
  'SECTION', 'TABLE', 'TD', 'TH', 'TR', 'UL',
]);

// Splits a string into alternating non-word / word fragments, keeping both.
const WORD_SPLIT = /(\b\w+\b)/;
const IS_WORD = /^\w+$/;
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
 * Tokenises a block's text nodes into a single stream, converts each word with
 * full in-block context, then writes the result back to its originating node.
 * @param {Text[]} textNodes
 * @param {(word: string, tokens: Token[], idx: number) => string} convertFn
 */
function convertBlock(textNodes, convertFn) {
  /** @type {{ node: Text, text: string, wordIdx: number }[]} */
  const pieces = [];
  /** @type {Token[]} */
  const tokens = [];

  for (const node of textNodes) {
    for (const fragment of node.nodeValue.split(WORD_SPLIT)) {
      if (fragment === '') continue;
      if (IS_WORD.test(fragment)) {
        pieces.push({ node, text: fragment, wordIdx: tokens.length });
        tokens.push({ word: fragment, tag: tagWord(fragment), breakAfter: false });
      } else {
        pieces.push({ node, text: fragment, wordIdx: -1 });
        // A separator carrying ./!/? ends the preceding word's sentence.
        if (tokens.length && SENTENCE_BREAK.test(fragment)) {
          tokens[tokens.length - 1].breakAfter = true;
        }
      }
    }
  }
  if (tokens.length === 0) return;
  tokens[tokens.length - 1].breakAfter = true; // end of block === end of sentence

  for (const piece of pieces) {
    if (piece.wordIdx !== -1) {
      piece.text = convertFn(tokens[piece.wordIdx].word, tokens, piece.wordIdx);
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
