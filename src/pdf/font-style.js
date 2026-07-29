// Deriving a face's generic family, weight and slant from its PostScript NAME.
//
// This exists because pdf.js tells us almost nothing. The font object behind
// commonObjs exposes `bold`, `italic` and `black`, and pdf.js's own canvas
// renderer reads exactly those — but for embedded subset fonts they are
// routinely `undefined`. Across the two California workers'-compensation PDFs
// this was reported against, EVERY face reported undefined for all three:
// Calibri-Italic, Calibri-BoldItalic, AcuminPro-Black included.
//
// That matters because of how a reformed word is drawn. pdf.js registers an
// embedded face as `@font-face {font-family:"g_d0_f8"; src:…}` with no
// font-style and no font-weight, so the family is declared normal/normal and
// carries its slant in the glyph outlines. We draw with that family plus a
// generic fallback — and the fallback is what renders any character the
// document's subset never used, which is exactly the letters a reform
// introduces ("recordz", "niht"). With the slant unknown, those substituted
// letters came out upright and regular in the middle of italic or black text.
//
// So the name is the only honest signal, the same conclusion texGeneric already
// reached about the descriptor flags.

/** Drops a subset prefix ("DHQQTB+Calibri-Bold" -> "calibri-bold"). */
const strip = (name) => name.replace(/^[A-Z]{6}\+/, '').toLowerCase();

/**
 * Whether a font is italic (or oblique), from its NAME.
 * @param {string} name
 * @returns {boolean}
 */
export function nameItalic(name) {
  if (!name) return false;
  return /italic|oblique/.test(strip(name));
}

/**
 * Whether a font is a black/heavy weight, from its NAME — heavier than bold, so
 * it maps to 900 rather than `bold`. Bare "ultra"/"extra" are deliberately not
 * matched on their own: "UltraLight" is the opposite of heavy.
 * @param {string} name
 * @returns {boolean}
 */
export function nameBlack(name) {
  if (!name) return false;
  return /black|heavy|extrabold|ultrabold/.test(strip(name));
}

/**
 * Whether a font is bold, from its NAME. Computer Modern's bold faces (cmb,
 * cmbx, cmbsy, cmssbx) and Latin Modern's (lmbx…) leave the flags unset, as do
 * ordinary named faces ending -Bold/-SemiBold. cmbx12, Calibri-Bold -> bold;
 * cmr12, cmss10, Calibri-Light -> not.
 * @param {string} name
 * @returns {boolean}
 */
export function nameBold(name) {
  if (!name) return false;
  const n = strip(name);
  return /^(cm|lm)(b|ssb)/.test(n) || /bold/.test(n);
}

/**
 * A better generic fallback for a font than pdf.js's fallbackName, read from the
 * font's NAME — or null to keep pdf.js's guess.
 *
 * This exists because the descriptor flags are exactly what is wrong. Computer
 * Modern declares itself Symbolic and never sets the Serif flag, so isSerifFont
 * is false and pdf.js derives fallbackName 'sans-serif' for a serif face. The
 * name is honest where the flags are not: the TeX convention encodes the style,
 * so cmr/cmbx/cmti are roman (serif), cmss is sans, cmtt is typewriter (mono),
 * and Latin Modern (lmroman/lmsans/lmmono) mirrors it. When the name is a family
 * we recognise, trust it over the flags.
 *
 * The generic only ever backs a glyph the embedded subset is MISSING, in a word
 * we draw — the rest of the page is untouched raster. So the blast radius is one
 * substituted letter, and an unrecognised name returns null and keeps today's
 * behaviour. Deliberately narrow: CM and Latin Modern cover almost all academic
 * PDFs, and guessing past them buys little for real risk.
 *
 * @param {string} name  the font's PostScript name, e.g. "RYDCUL+CMBX12"
 * @returns {'serif' | 'sans-serif' | 'monospace' | null}
 */
export function texGeneric(name) {
  if (!name) return null;
  const n = strip(name);
  // Order matters: the mono and sans families also start with cm/lm, so they
  // must be matched before the serif catch-all.
  if (/^(cmtt|cmsltt|cmitt|cmtex|cmvtt|lmmono|lmtt)/.test(n)) return 'monospace';
  if (/^(cmss|lmss|lmsans)/.test(n)) return 'sans-serif';
  if (/^(cm|lm)/.test(n)) return 'serif';
  return null;
}
