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
  const drop = original.length - reformed.length;
  if (drop === 1) return `${reformed} `;
  if (drop === 2 || drop === 3) return ` ${reformed} `;
  return reformed;
}
