// Engine for euspell.org/try: paste text, read it in euspell, nothing installed.
//
// Built by rollup.config.js against the runtime lexicon source, exactly like the
// content script, so the ~14 MB Map is not inlined; the page fetches the same
// [key, entry] JSON the extension ships as dist/lexicon.data and hands it to
// load(). Conversion is convertText() from the DOM walker — the pipeline a web
// page goes through — so the page shows what the extension would do, not an
// approximation of it. Nothing leaves the browser.
import { convert } from '../content/converter.js';
import { convertText } from '../content/dom-walker.js';
import { setLexicon } from '../content/lexicon-source.js';

// Private-use characters that cannot occur in pasted text, so a changed word can
// be returned inside one string and split out again by the page.
const OPEN = '';
const MID = '';
const CLOSE = '';

/** @type {Promise<void> | null} */
let loading = null;

/**
 * Fetch the lexicon JSON at `url` and install it. Memoised; a failed load is
 * forgotten so the page can offer to retry.
 * @param {string} url
 * @returns {Promise<void>}
 */
function load(url) {
  if (!loading) {
    loading = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`lexicon fetch failed: ${res.status}`);
        return res.json();
      })
      .then((entries) => setLexicon(new Map(entries)))
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

/**
 * Convert `text` and return it as segments: plain runs, and changed words with
 * the spelling they replaced. Each line is converted on its own, the way a <br>
 * or a new block ends a run on a page, so a heading line does not lend context
 * to the paragraph under it.
 *
 * Phrases ("a great deal") are rendered whole by the walker without passing
 * through convert(), so they come back as plain text rather than as a change.
 *
 * @param {string} text
 * @returns {({ text: string } | { text: string, was: string })[]}
 */
function convertSegments(text) {
  /** @type {(word: string, tokens: any[], idx: number) => string} */
  const marking = (word, tokens, idx) => {
    const out = convert(word, tokens, idx);
    return out === word ? out : OPEN + out + MID + word + CLOSE;
  };
  const marked = text
    .split('\n')
    .map((line) => (line.trim() ? convertText(line, marking) : line))
    .join('\n');

  /** @type {({ text: string } | { text: string, was: string })[]} */
  const segments = [];
  const re = /([^]*)([^]*)/g;
  let last = 0;
  for (const m of marked.matchAll(re)) {
    if (m.index > last) segments.push({ text: marked.slice(last, m.index) });
    segments.push({ text: m[1], was: m[2] });
    last = m.index + m[0].length;
  }
  if (last < marked.length) segments.push({ text: marked.slice(last) });
  return segments;
}

window.EuspellTry = { load, convertSegments };
