import { tagWord } from './tagger.js';
import { isContraction, contractionComponents } from './contractions.js';
import { getPhrase, MAX_PHRASE_WORDS } from './phrases.js';

/** @typedef {import('./context.js').Token} Token */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);

/**
 * True when text under `el` is user-editable — inside a contenteditable region
 * (isContentEditable is true for any descendant and respects nested
 * contenteditable="false"), or in a design-mode document. Such text is the user's
 * input: reforming it would corrupt what they type and collapse the caret, so it
 * is left untouched. (Plain <input>/<textarea> are already in SKIP_TAGS.)
 * @param {Element} el
 * @returns {boolean}
 */
function isEditable(el) {
  return el.isContentEditable === true || document.designMode === 'on';
}

/**
 * True when `el` or any ancestor is a skipped tag. The direct parent alone is
 * not enough: syntax-highlighted code is `<pre><span>…</span></pre>` (every
 * Prism/highlight.js page), and reforming span-wrapped code would corrupt what
 * a reader copies. Climbs the full chain — past the walk root too, so re-walking
 * a subtree that lives inside a skipped region stays skipped.
 * @param {Element} el
 * @returns {boolean}
 */
function inSkippedTag(el) {
  for (let cur = el; cur; cur = cur.parentElement) {
    if (SKIP_TAGS.has(cur.tagName)) return true;
  }
  return false;
}

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

// Elements that end a line without being a block of their own. A <br> holds no
// text, so it can never fall out of the text-node grouping below on its own —
// but the text on either side of it is NOT contiguous, and concatenating across
// it glues the last word of one line to the first of the next ("Guide
// to<br>Workers'" -> "toWorkers'", which then matches nothing in the lexicon and
// silently passes through unreformed). This matters most in the PDF viewer,
// where pdf.js emits one absolutely-positioned span per text item and a
// <br role="presentation"> after every item whose hasEOL is set, so EVERY line
// boundary on the page is exactly this shape.
const LINE_BREAK_TAGS = new Set(['BR']);

// A "run" is a word that may carry apostrophes (contractions, clitics): an
// optional leading apostrophe ('tis, 'em), word chars, and any number of
// apostrophe-joined word chars (don't, couldn't've), plus an optional trailing
// apostrophe (James'). Everything between runs is a separator. Word chars are
// Unicode letters/digits (not \w, which is ASCII-only): an accented word must
// tokenize whole ("naïve", not "na"+"ïve"), so it misses the ASCII lexicon and
// passes through unchanged by design — never converted piecemeal because an
// ASCII fragment of it happened to be an English word.
const RUN = /['’ʼ]?[\p{L}\p{N}_]+(?:['’ʼ][\p{L}\p{N}_]+)*['’ʼ]?/gu;
const GENITIVE = /^([\p{L}\p{N}_]+)(['’ʼ]s)$/iu;
const SENTENCE_BREAK = /[.!?]/;

// Per text node, the original source text we tokenized and the euspelled string
// we wrote back. On a re-walk (the MutationObserver re-applying after a page
// re-render), a node still holding exactly our output is reconverted from its
// ORIGINAL source, not from the euspelled text. This keeps neighbour context
// correct (euspellings aren't in the lexicon, so re-tagging them would corrupt
// the window) and makes conversion idempotent — without it the few non-idempotent
// words ("cached"→"cashed"→"cashd") would drift on every pass. A node the page
// has since edited (value no longer our output) is treated as fresh source.
/** @type {WeakMap<Text, { src: string, out: string }>} */
const memory = new WeakMap();

/**
 * The text to tokenize for `node`: its remembered original source if the node
 * still holds our last output, otherwise the node's current (page-set) value.
 * @param {Text} node
 * @returns {string}
 */
function sourceOf(node) {
  const rec = memory.get(node);
  return rec && rec.out === node.nodeValue ? rec.src : node.nodeValue;
}

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
 * Restores every converted text node under `root` to its remembered original
 * source — a lossless "show original" (the euspell view is re-applied by calling
 * walkTextNodes again). Only nodes that still hold exactly our output are
 * touched, so page-edited nodes are left alone.
 * @param {Node} root
 */
export function restoreOriginals(root) {
  for (const textNodes of collectBlocks(root)) {
    for (const node of textNodes) {
      const rec = memory.get(node);
      if (rec && rec.out === node.nodeValue) node.nodeValue = rec.src;
    }
  }
}

/**
 * Converts a plain string through the exact same block pipeline the reader uses
 * on the page — tokenization, tagging, phrase matching, contraction handling and
 * context-aware disambiguation — by running it through a detached container.
 *
 * Dictation has a recognized utterance (text), not page nodes, but wants
 * identical spelling behaviour; routing through a throwaway <div> reuses the
 * whole engine with no duplicated logic. The node is discarded on return, so its
 * transient `memory` entry is released with it.
 *
 * @param {string} text
 * @param {(word: string, tokens: Token[], idx: number) => string} convertFn
 * @returns {string}
 */
export function convertText(text, convertFn) {
  const holder = document.createElement('div');
  holder.textContent = text;
  walkTextNodes(holder, convertFn);
  return holder.textContent;
}

/**
 * Groups the convertible text nodes under `root` by their nearest block-level
 * ancestor, preserving document order within each group.
 * @param {Node} root
 * @returns {Text[][]}
 */
function collectBlocks(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      // Elements are visited only to notice line breaks; SKIP (not REJECT) so
      // the walk still descends into every other element's text.
      if (node.nodeType === Node.ELEMENT_NODE) {
        return LINE_BREAK_TAGS.has(node.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
      const parent = node.parentElement;
      if (!parent || inSkippedTag(parent) || isEditable(parent)) return NodeFilter.FILTER_REJECT;
      if (node.nodeValue.trim() === '') return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  // Each block holds one or more RUNS of contiguous text; a <br> closes the open
  // run so the next text starts a fresh one. Runs, not blocks, are what get
  // concatenated into a single token stream, so a line break stops words meeting
  // across it while inline splits within a line still join.
  /** @type {Map<Node, Text[][]>} */
  const runsByBlock = new Map();
  /** Blocks whose open run was just ended by a <br>. */
  const broken = new Set();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const block = nearestBlock(node.parentElement, root);
    if (node.nodeType === Node.ELEMENT_NODE) {
      broken.add(block);
      continue;
    }
    let runs = runsByBlock.get(block);
    if (!runs) runsByBlock.set(block, (runs = [[]]));
    if (broken.delete(block)) runs.push([]);
    runs[runs.length - 1].push(/** @type {Text} */ (node));
  }
  return [...runsByBlock.values()].flat().filter((run) => run.length);
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
  /** @type {{ start: number, origLen: number, text: string, wordIdx: number }[]} */
  const pieces = [];
  /** @type {Token[]} */
  const tokens = [];
  // Source piece index for each token's primary slot (-1 for a contraction's
  // continuation pseudo-tokens, which have no piece of their own).
  /** @type {number[]} */
  const pieceOfToken = [];
  // The text each node was tokenized from (its original source on a re-walk),
  // so the write-back can record the source→output mapping for next time.
  /** @type {Map<Text, string>} */
  const sourceByNode = new Map();

  // Concatenate the block's nodes into ONE source and tokenize that, so a word
  // split across text-node boundaries — a drop-cap "<span>I</span>celand", inline
  // styling mid-word — stays one token ("Iceland") instead of the fragments
  // "I" (which alone reforms to the pronoun "Ih") + "celand". Each piece remembers
  // its offset and original length in the block; the write-back below maps it back
  // to the node(s) it came from, splitting a spanning word by prefix.
  let blockText = '';
  /** @type {{ node: Text, start: number }[]} */
  const bounds = [];
  for (const node of textNodes) {
    const source = sourceOf(node);
    sourceByNode.set(node, source);
    bounds.push({ node, start: blockText.length });
    blockText += source;
  }

  let off = 0;
  for (const seg of tokenize(blockText)) {
    const start = off;
    off += seg.text.length;
    const origLen = seg.text.length;
    if (seg.kind === 'sep') {
      pieces.push({ start, origLen, text: seg.text, wordIdx: -1 });
      // A separator carrying ./!/? ends the preceding word's sentence.
      if (tokens.length && SENTENCE_BREAK.test(seg.text)) {
        tokens[tokens.length - 1].breakAfter = true;
      }
      // The character immediately after the word. A word followed by punctuation
      // with no space is BOUND to what comes next (I&A, I-beam, I)) rather than
      // standing alone, which is how the pronoun "I" is told from the letter and
      // the numeral. Only the first separator after a word is its own.
      if (tokens.length && tokens[tokens.length - 1].sepAfter === '') {
        tokens[tokens.length - 1].sepAfter = seg.text.charAt(0);
      }
    } else if (seg.kind === 'contraction') {
      const pieceIdx = pieces.push({ start, origLen, text: seg.text, wordIdx: tokens.length }) - 1;
      const components = contractionComponents(seg.text);
      if (components.length) {
        // One pseudo-token per sequence position; identity rides on the first.
        components.forEach((tag, i) => {
          pieceOfToken.push(i === 0 ? pieceIdx : -1);
          tokens.push({ word: i === 0 ? seg.text : '', tag, breakAfter: false, sepAfter: '' });
        });
      } else {
        pieceOfToken.push(pieceIdx);
        tokens.push({ word: seg.text, tag: tagWord(seg.text), breakAfter: false, sepAfter: '' });
      }
    } else {
      const pieceIdx = pieces.push({ start, origLen, text: seg.text, wordIdx: tokens.length }) - 1;
      pieceOfToken.push(pieceIdx);
      tokens.push({ word: seg.text, tag: tagWord(seg.text), breakAfter: false, sepAfter: '' });
    }
  }
  if (tokens.length === 0) return;
  tokens[tokens.length - 1].breakAfter = true; // end of block === end of sentence

  // Match multi-word phrases as a greedy longest-match override pass, then build
  // a collapsed token stream where each phrase is one token. Neighbors thus see
  // a phrase's reduced PoS, and its component words are converted as a unit.
  const spans = collectPhraseSpans(tokens, pieces, pieceOfToken);
  const { collapsed, collapsedOf } = collapseTokens(tokens, spans);
  renderPhraseSpans(pieces, tokens, pieceOfToken, spans);

  // Convert each remaining word/contraction piece from its surface text, using
  // its slot in the collapsed stream (phrase pieces were handled above and now
  // carry wordIdx -1, so they are skipped).
  for (const piece of pieces) {
    if (piece.wordIdx !== -1) {
      piece.text = convertFn(piece.text, collapsed, collapsedOf[piece.wordIdx]);
    }
  }

  // Reassemble each node from the pieces (or piece fragments) that originally fell
  // in it. A piece whose original span crosses a node boundary — a word split by
  // inline markup — is divided by prefix: each node takes a share of the converted
  // text proportional to its share of the original characters. So a drop-cap "I"
  // keeps the reformed word's first letter and the rest lands in the next node.
  /** @type {Map<Text, string[]>} */
  const byNode = new Map();
  for (const b of bounds) byNode.set(b.node, []);

  const nodeIndexAt = (offset) => {
    let idx = 0;
    for (let i = 0; i < bounds.length; i++) {
      if (bounds[i].start <= offset) idx = i;
      else break;
    }
    return idx;
  };
  const nodeEnd = (i) => (i + 1 < bounds.length ? bounds[i + 1].start : blockText.length);

  for (const piece of pieces) {
    const startIdx = nodeIndexAt(piece.start);
    const endIdx = nodeIndexAt(piece.start + Math.max(1, piece.origLen) - 1);
    if (startIdx === endIdx) {
      byNode.get(bounds[startIdx].node).push(piece.text);
      continue;
    }
    let taken = 0;
    for (let i = startIdx; i <= endIdx; i++) {
      const origInNode = Math.min(nodeEnd(i), piece.start + piece.origLen) - Math.max(bounds[i].start, piece.start);
      const share =
        i === endIdx ? piece.text.length - taken : Math.round((origInNode / piece.origLen) * piece.text.length);
      byNode.get(bounds[i].node).push(piece.text.slice(taken, taken + share));
      taken += share;
    }
  }

  for (const [node, parts] of byNode) {
    const joined = parts.join('');
    if (joined !== node.nodeValue) node.nodeValue = joined;
    // Remember source→output so a later re-walk reconverts from source, not from
    // this (euspelled) output. ?? guards nodes that produced no piece of their own.
    memory.set(node, { src: sourceByNode.get(node) ?? node.nodeValue, out: joined });
  }
}

/**
 * @typedef {{ start: number, end: number, entry: import('./phrases.js').LexiconEntry }} PhraseSpan
 *   Inclusive token-index range [start, end] covered by a matched phrase.
 */

/**
 * Finds the non-overlapping, greedy-longest phrase matches over the token
 * stream. A candidate span matches only when every token in it is a primary
 * word token and the separators between those words are whitespace-only — so a
 * comma or sentence break inside the run blocks the match and is never deleted.
 *
 * @param {Token[]} tokens
 * @param {{ text: string }[]} pieces
 * @param {number[]} pieceOfToken
 * @returns {PhraseSpan[]}
 */
function collectPhraseSpans(tokens, pieces, pieceOfToken) {
  /** @type {PhraseSpan[]} */
  const spans = [];
  let i = 0;
  while (i < tokens.length) {
    const span = longestPhraseAt(tokens, pieces, pieceOfToken, i);
    if (span) {
      spans.push(span);
      i = span.end + 1;
    } else {
      i++;
    }
  }
  return spans;
}

/**
 * Longest phrase starting at token `start`, or null.
 * @param {Token[]} tokens
 * @param {{ text: string }[]} pieces
 * @param {number[]} pieceOfToken
 * @param {number} start
 * @returns {PhraseSpan | null}
 */
function longestPhraseAt(tokens, pieces, pieceOfToken, start) {
  const maxLen = Math.min(MAX_PHRASE_WORDS, tokens.length - start);
  for (let len = maxLen; len >= 2; len--) {
    const end = start + len - 1;
    const words = [];
    let ok = true;
    for (let k = start; k <= end; k++) {
      if (pieceOfToken[k] === -1 || tokens[k].word === '') {
        ok = false;
        break;
      }
      words.push(tokens[k].word.toLowerCase());
    }
    if (!ok) continue;
    const entry = getPhrase(words.join(' '));
    if (!entry) continue;
    if (!innerSepsBlank(pieces, pieceOfToken, start, end)) continue;
    return { start, end, entry };
  }
  return null;
}

/**
 * True when every separator piece sitting between the words of span
 * [start, end] is whitespace-only.
 * @param {{ text: string }[]} pieces
 * @param {number[]} pieceOfToken
 * @param {number} start
 * @param {number} end
 * @returns {boolean}
 */
function innerSepsBlank(pieces, pieceOfToken, start, end) {
  for (let k = start; k < end; k++) {
    for (let p = pieceOfToken[k] + 1; p < pieceOfToken[k + 1]; p++) {
      if (!/^\s+$/.test(pieces[p].text)) return false;
    }
  }
  return true;
}

/**
 * Builds the collapsed token stream (each phrase span -> one token carrying its
 * reduced PoS) plus a map from each original token index to its collapsed slot.
 * @param {Token[]} tokens
 * @param {PhraseSpan[]} spans
 * @returns {{ collapsed: Token[], collapsedOf: number[] }}
 */
function collapseTokens(tokens, spans) {
  /** @type {(PhraseSpan | null)[]} */
  const spanAt = new Array(tokens.length).fill(null);
  for (const s of spans) {
    for (let k = s.start; k <= s.end; k++) spanAt[k] = s;
  }

  /** @type {Token[]} */
  const collapsed = [];
  /** @type {number[]} */
  const collapsedOf = new Array(tokens.length);
  for (let k = 0; k < tokens.length; k++) {
    const s = spanAt[k];
    if (s && k === s.start) {
      const word = tokens.slice(s.start, s.end + 1).map((t) => t.word).join(' ');
      collapsed.push({ word, tag: s.entry.pos.join('|'), breakAfter: tokens[s.end].breakAfter });
      for (let j = s.start; j <= s.end; j++) collapsedOf[j] = collapsed.length - 1;
    } else if (!s) {
      collapsed.push(tokens[k]);
      collapsedOf[k] = collapsed.length - 1;
    }
  }
  return { collapsed, collapsedOf };
}

/**
 * Writes each matched phrase's output onto the first piece of its span and
 * blanks the rest (inner separators included), marking them wordIdx -1 so the
 * per-word loop skips them. Encoding 000 phrases keep their original surface;
 * single-variant phrases use the phrase euspelling with the span's leading
 * capitalization preserved.
 * @param {{ text: string, wordIdx: number }[]} pieces
 * @param {Token[]} tokens
 * @param {number[]} pieceOfToken
 * @param {PhraseSpan[]} spans
 */
function renderPhraseSpans(pieces, tokens, pieceOfToken, spans) {
  for (const s of spans) {
    const first = pieceOfToken[s.start];
    const last = pieceOfToken[s.end];
    const original = pieces.slice(first, last + 1).map((p) => p.text).join('');
    pieces[first].text =
      s.entry.encoding === 0
        ? original
        : matchPhraseCase(tokens[s.start].word, s.entry.spellings[0] ?? original);
    pieces[first].wordIdx = -1;
    for (let p = first + 1; p <= last; p++) {
      pieces[p].text = '';
      pieces[p].wordIdx = -1;
    }
  }
}

/**
 * Applies the span's leading capitalization to a phrase replacement: ALL-CAPS
 * first word uppercases the whole phrase; a Title-cased first word capitalizes
 * the replacement's first letter. A single uppercase letter (e.g. "A") counts
 * as Title, not ALL-CAPS.
 * @param {string} firstWord  original first word of the span
 * @param {string} replacement
 * @returns {string}
 */
function matchPhraseCase(firstWord, replacement) {
  if (firstWord.length > 1 && firstWord === firstWord.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (firstWord[0] === firstWord[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
