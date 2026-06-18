const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);

/**
 * Walks all text nodes under `root`, applying `convertFn` word-by-word.
 * @param {Node} root
 * @param {(word: string, tokens: import('./converter.js').Token[], idx: number) => string} convertFn
 */
export function walkTextNodes(root, convertFn) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (node.nodeValue?.trim() === '') return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    const converted = convertText(node.nodeValue, convertFn);
    if (converted !== node.nodeValue) node.nodeValue = converted;
  }
}

/**
 * Tokenises a text string, converts each word token, and reassembles.
 * @param {string} text
 * @param {(word: string, tokens: import('./converter.js').Token[], idx: number) => string} convertFn
 * @returns {string}
 */
function convertText(text, convertFn) {
  // Splits on word boundaries, preserving spaces/punctuation as non-word tokens
  const tokens = text.split(/(\b\w+\b)/);
  return tokens
    .map((token, i) => {
      if (!/^\w+$/.test(token)) return token;
      // TODO: pass real POS-tagged token array once tagger is integrated
      return convertFn(token, [], i);
    })
    .join('');
}
