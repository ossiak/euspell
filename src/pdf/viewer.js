/**
 * Euspell PDF viewer. The service worker redirects top-level navigations to a
 * .pdf onto this page (?file=<original url>). We render each page with PDF.js to
 * a canvas (full visual fidelity: graphics, images, background), then run each
 * word of the (invisible) text layer through the same euspell converter the rest
 * of the extension uses.
 *
 * For every word whose spelling actually changed we redraw it ONTO THE CANVAS:
 * the original glyphs are painted over with the page's own background colour, and
 * the reformed word is drawn in the original ink colour using the SAME font
 * PDF.js loaded and drew the rest of the page with. Because changed and unchanged
 * words are then rendered by one engine with one font, they stay visually
 * consistent — instead of the reformed words showing in a substitute web font.
 * The text layer is kept transparent (it carries the reformed text, so selection
 * and copy still work). Ink/paper are sampled per word, so coloured text and
 * non-white backgrounds are handled; heavily textured backgrounds remain a
 * known limitation.
 */

import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs';
import { convert } from '../content/converter.js';
import { walkTextNodes } from '../content/dom-walker.js';
import { fileParam } from './pdf-url.js';
import { sampleColors } from './sample-colors.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('dist/pdfjs/pdf.worker.min.mjs');

const RENDER_SCALE = 1.5;

const root = document.getElementById('pages');
const status = document.getElementById('status');

function setStatus(msg) {
  if (status) status.textContent = msg;
}

async function renderPage(pdf, n, dpr) {
  const page = await pdf.getPage(n);
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  const wrap = document.createElement('div');
  wrap.className = 'page';
  wrap.style.width = `${viewport.width}px`;
  wrap.style.height = `${viewport.height}px`;

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const textLayerDiv = document.createElement('div');
  textLayerDiv.className = 'textLayer';
  // PDF.js stores each span's font height in the --font-height variable and
  // expects the stylesheet to turn it into font-size via the scale factor (see
  // viewer.css). It uses --total-scale-factor; we set both names for safety.
  textLayerDiv.style.setProperty('--scale-factor', String(RENDER_SCALE));
  textLayerDiv.style.setProperty('--total-scale-factor', String(RENDER_SCALE));

  wrap.append(canvas, textLayerDiv);
  root.append(wrap);

  // Opaque white background so blank areas are sampled as paper, not transparent.
  await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;

  // Build the (transparent) text layer: one span per glyph run, with the font and
  // box PDF.js laid out. We read its text/geometry, reform it, then redraw the
  // changed words on the canvas. The spans stay invisible but hold the reformed
  // text, so selection and copy return the reformed spelling.
  const textContent = await page.getTextContent();
  const layer = new pdfjsLib.TextLayer({ textContentSource: textContent, container: textLayerDiv, viewport });
  await layer.render();
  // Make sure the embedded fonts PDF.js registered are ready for canvas drawing.
  await document.fonts.ready;

  // Record each span's original text, laid-out box, and resolved font BEFORE
  // reforming (which changes the span's text and measured width).
  const spans = layer.textDivs;
  const originals = spans.map((s) => {
    const cs = getComputedStyle(s);
    return {
      text: s.textContent,
      x: s.offsetLeft, y: s.offsetTop, w: s.offsetWidth, h: s.offsetHeight,
      font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
    };
  });
  walkTextNodes(textLayerDiv, convert);

  // Snapshot the pristine raster once so each changed word's ink/paper colours are
  // sampled from the original glyphs, before any are painted over.
  const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < spans.length; i++) {
    const o = originals[i];
    const text = spans[i].textContent;
    if (text === o.text || o.w <= 0 || o.h <= 0) continue;

    const { ink, paper } = sampleColors(
      snapshot.data, canvas.width, canvas.height,
      Math.round(o.x * dpr), Math.round(o.y * dpr),
      Math.round(o.w * dpr), Math.round(o.h * dpr),
    );

    // Paint over the original glyphs with the page's own background colour.
    ctx.fillStyle = paper;
    ctx.fillRect(o.x - 1, o.y - 1, o.w + 2, o.h + 2);

    // Draw the reformed word in the original ink colour with the original font.
    // Compress to the original slot only when the reformed word is wider, so it
    // never overruns the next word; otherwise keep the font's natural width.
    ctx.fillStyle = ink;
    ctx.font = o.font;
    const m = ctx.measureText(text);
    const baseline = o.y + m.fontBoundingBoxAscent;
    if (m.width > o.w) {
      ctx.save();
      ctx.translate(o.x, baseline);
      ctx.scale(o.w / m.width, 1);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(text, o.x, baseline);
    }
  }

  page.cleanup();
}

async function main() {
  const fileUrl = fileParam(location.search);
  if (!fileUrl) {
    setStatus('No PDF was specified.');
    return;
  }

  // "Open original" escape hatch — the redirect captures every PDF, so the
  // unconverted file must stay one click away.
  const name = decodeURIComponent(fileUrl.split('/').pop() || 'PDF');
  document.title = `${name} — Euspell`;
  const filenameEl = document.getElementById('filename');
  if (filenameEl) filenameEl.textContent = name;
  const originalEl = document.getElementById('original');
  if (originalEl) originalEl.href = fileUrl;

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({
      url: fileUrl,
      // Errors only: real-world PDFs routinely trip PDF.js's spec-compliance
      // warnings (over-long /Name tokens, malformed objects, …) which it recovers
      // from. They are noise for a reader, so keep just genuine errors.
      verbosity: pdfjsLib.VerbosityLevel.ERRORS,
      // Where the bundled WebAssembly image/colour decoders live (trailing slash
      // required) — without this PDF.js can't decode JBIG2/JPEG2000 images.
      wasmUrl: chrome.runtime.getURL('dist/pdfjs/wasm/'),
      // Where the bundled standard substitute fonts live (trailing slash
      // required) — lets PDF.js render non-embedded fonts (e.g. Goudy-Bold) with
      // a matching Foxit/Liberation face instead of warning and falling back.
      standardFontDataUrl: chrome.runtime.getURL('dist/pdfjs/standard_fonts/'),
    }).promise;
  } catch (e) {
    setStatus(`Couldn’t open this PDF (${e?.message ?? e}). You can open the original instead.`);
    return;
  }

  if (status) status.remove();
  const dpr = window.devicePixelRatio || 1;
  for (let n = 1; n <= pdf.numPages; n++) {
    try {
      await renderPage(pdf, n, dpr);
    } catch (e) {
      const err = document.createElement('div');
      err.className = 'page-error';
      err.textContent = `Page ${n} could not be rendered (${e?.message ?? e}).`;
      root.append(err);
    }
  }
}

main();
