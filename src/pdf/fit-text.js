// How a reformed word is padded before being fitted to the original word's box.
//
// The viewer draws each changed span scaled to span exactly the width the
// original occupied, so a shorter reform would otherwise be stretched to fill
// the slot. Padding it with spaces takes up the slack instead, keeping the
// glyphs near their natural proportions.
//
// Split out of viewer.js so it can be tested: viewer.js pulls in pdf.js and
// cannot be imported outside a browser, and this rule is fiddly enough to have
// been changed more than once.

/**
 * The string to draw for a reform, padded so it need not stretch far.
 *
 * The padding lands AFTER the word. Whatever is drawn spans exactly the
 * original's box, so the spaces move nothing on the line — they only decide
 * where the glyphs sit INSIDE that box. A leading space pushes them right,
 * indenting any word that begins a line and breaking the left margin the reader
 * returns to; a trailing one keeps the left edge where the original started and
 * lets the slack fall at the right, where a left-aligned page is ragged anyway.
 *
 * A two- or three-letter drop keeps a space on each side: the deficit is large
 * enough that centring distributes it better than a single edge would, and at
 * 4% of reformed spellings against 35% for the one-letter case, its
 * line-initial indent is both rarer and half the size.
 *
 * Punctuation needs no special handling. A span carries its own trailing
 * punctuation ("abandoned." converts to "abandond."), so appending the space
 * puts it after the period, which is where a sentence break wants it.
 *
 * Larger differences fall through unpadded — a reform that far from the
 * original is fitted by scaling alone.
 *
 * @param {string} original  the word as the PDF has it
 * @param {string} reformed  its euspelling
 * @returns {string} the text to measure and draw
 */
export function padToFit(original, reformed) {
  // A span is often a whole line, so the padding is decided WORD BY WORD. On the
  // span as a whole it is not just imprecise but wrong: two words that each lose
  // one letter make a span two letters shorter, which took the two-or-three rule
  // and put a space at the FRONT of the line. A real page showed it —
  //   "MacOS / Linux), immensely flexible, and easy to use and learn. … are"
  // is one text item in which "learn"→"lern" and "are"→"ar" each drop one, and
  // the line came out indented.
  //
  // Conversion never touches whitespace, so splitting both strings on runs of it
  // yields matching arrays and each word can be paired with its own original.
  const oParts = original.split(/(\s+)/);
  const rParts = reformed.split(/(\s+)/);
  const parts = oParts.length === rParts.length
    ? rParts.map((part, i) => (/^\s*$/.test(part) ? part : padWord(oParts[i], part)))
    : [padWord(original, reformed)]; // shape changed — fall back to the whole string
  // Whatever the per-word rule decided, the span may not BEGIN with padding: a
  // span starts at the left margin often enough that a leading space reads as an
  // indented line. Only the first word can be affected, and only when it is two
  // or three letters shorter — the case that pads on both sides. Its leading
  // space is MOVED to the end rather than dropped, so the word still gets the
  // same total slack and is fitted at the same scale; only the side changes.
  const out = parts.join('');
  return out.startsWith(' ') ? `${out.slice(1)} ` : out;
}

/**
 * The padding rule for a single word.
 * @param {string} original
 * @param {string} reformed
 * @returns {string}
 */
function padWord(original, reformed) {
  const drop = original.length - reformed.length;
  if (drop === 1) return `${reformed} `;
  if (drop === 2 || drop === 3) return ` ${reformed} `;
  return reformed;
}
