/**
 * Euspell PDF viewer. The service worker redirects top-level navigations to a
 * .pdf onto this page (?file=<original url>). We render each page with PDF.js to
 * a canvas (full visual fidelity: graphics, images, background), then overlay a
 * VISIBLE text layer whose words have been run through the same euspell
 * converter the rest of the extension uses — so the reader sees reformed text.
 *
 * The original glyphs baked into the canvas are painted over (using the exact
 * geometry PDF.js gives the text spans) so they don't show through. This assumes
 * a light page background; coloured/dark backgrounds are a known limitation.
 */

import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs';
import { convert } from '../content/converter.js';
import { walkTextNodes } from '../content/dom-walker.js';
import { fileParam } from './pdf-url.js';

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
  textLayerDiv.style.setProperty('--scale-factor', String(RENDER_SCALE));

  wrap.append(canvas, textLayerDiv);
  root.append(wrap);

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Build the selectable text layer (positions/sizes the spans over the glyphs).
  const textContent = await page.getTextContent();
  const layer = new pdfjsLib.TextLayer({ textContentSource: textContent, container: textLayerDiv, viewport });
  await layer.render();

  // Paint over the original glyphs on the canvas using the spans' laid-out boxes,
  // then reform the (now visible) overlay text in place.
  ctx.fillStyle = '#ffffff';
  for (const span of layer.textDivs) {
    const w = span.offsetWidth;
    const h = span.offsetHeight;
    if (w > 0 && h > 0) ctx.fillRect(span.offsetLeft - 1, span.offsetTop - 1, w + 2, h + 2);
  }
  walkTextNodes(textLayerDiv, convert);

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
      // Where the bundled WebAssembly image/colour decoders live (trailing slash
      // required) — without this PDF.js can't decode JBIG2/JPEG2000 images.
      wasmUrl: chrome.runtime.getURL('dist/pdfjs/wasm/'),
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
