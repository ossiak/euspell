/** Rec. 601 luminance of the pixel at byte offset `i` in an RGBA buffer. */
export const lumAt = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/**
 * Samples a glyph box from a page raster, returning the dominant ink (darkest
 * band) and paper (lightest band) colours as CSS strings. This lets a reformed
 * word be painted in the original text colour over the original background,
 * rather than assuming black-on-white — so coloured text and non-white
 * backgrounds survive. A near-flat box (no glyphs to sample) falls back to black
 * ink on whatever colour fills it.
 *
 * @param {Uint8ClampedArray} data  RGBA pixels of the whole canvas (device px)
 * @param {number} W  canvas width in device px (row stride)
 * @param {number} H  canvas height in device px
 * @param {number} bx @param {number} by @param {number} bw @param {number} bh  box, device px
 * @returns {{ ink: string, paper: string }}
 */
export function sampleColors(data, W, H, bx, by, bw, bh) {
  const x0 = Math.max(0, bx), y0 = Math.max(0, by);
  const x1 = Math.min(W, bx + bw), y1 = Math.min(H, by + bh);
  const BLACK = 'rgb(0, 0, 0)', WHITE = 'rgb(255, 255, 255)';
  if (x1 <= x0 || y1 <= y0) return { ink: BLACK, paper: WHITE };

  let min = 255, max = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const l = lumAt(data, (y * W + x) * 4);
      if (l < min) min = l;
      if (l > max) max = l;
    }

  // Average the darkest band (ink) and the lightest band (paper).
  const inkCut = min + (max - min) * 0.3;
  const paperCut = max - (max - min) * 0.3;
  let ir = 0, ig = 0, ib = 0, ic = 0, pr = 0, pg = 0, pb = 0, pc = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      const l = lumAt(data, i);
      if (l <= inkCut) { ir += data[i]; ig += data[i + 1]; ib += data[i + 2]; ic++; }
      if (l >= paperCut) { pr += data[i]; pg += data[i + 1]; pb += data[i + 2]; pc++; }
    }
  const rgb = (r, g, b, c) => `rgb(${Math.round(r / c)}, ${Math.round(g / c)}, ${Math.round(b / c)})`;
  const paper = pc ? rgb(pr, pg, pb, pc) : WHITE;
  // No real contrast → no glyphs to sample; keep black ink on the fill colour.
  if (max - min < 12 || !ic) return { ink: BLACK, paper };
  return { ink: rgb(ir, ig, ib, ic), paper };
}
