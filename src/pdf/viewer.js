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
 *
 * KNOWN LIMITATION — a reform can need a glyph the PDF does not contain. An
 * embedded font is usually SUBSETTED to the characters the document actually
 * uses, and euspell introduces letters the original text may never have had:
 * research -> reserqh needs a q, Physics -> Physicz needs a z. Where the subset
 * lacks the glyph the browser substitutes that ONE letter from the fallback
 * family, so a reformed word can carry a single odd-looking character. This is
 * unfixable by font selection — the outline is simply not in the file — and it
 * shows up mainly in headings, whose display fonts are subsetted hardest (in
 * Hsu et al.'s SVM guide the heading face carries 52 glyphs and the body face
 * 81, and only the body has q and z).
 *
 * The substitute is made to blend in where we can. pdf.js reports fallbackName
 * 'sans-serif' for Computer Modern — a serif face — because CM declares itself
 * Symbolic and never sets the Serif flag, so isSerifFont is false. But the font
 * NAME is honest where the flags are not (RYDCUL+CMBX12), so fontFace derives the
 * generic AND the weight AND the slant from it (see font-style.js): the stray
 * sans-serif q becomes a serif one, bold in a bold heading and slanted in an
 * italic run, so it reads almost as the heading's own glyph. That is cosmetic,
 * not a fix — the outline is still not in the file.
 *
 * Family and weight match; SIZE does not, and cannot here. The generic resolves
 * to a different face per platform (Times on Chrome, Noto/Roboto Serif on
 * Android), none matching CM's proportions — measured, the Android serif's
 * x-height is ~1.17x CM's, so the substitute is a touch large there and a touch
 * small on Chrome. CSS font-size-adjust would normalise it, but canvas 2D has no
 * such control, and the whole word is one ctx.font, so the substitute cannot be
 * sized apart from the real glyphs around it. Left as-is (2026-07): the only
 * closes are a bundled metric-matched webfont (weight, and only helps TeX PDFs)
 * or per-glyph drawing (the thing this file avoids), neither worth it for a
 * substitute this rare.
 *
 * Decided (2026-07) to accept the substituted glyph rather than suppress the
 * reform for that word: this is a spelling-reform tool, and a heading that
 * quietly fails to reform costs more than a letter that looks slightly off.
 */

import './polyfills.js'; // shim toHex / getOrInsert for older WebViews — must precede pdf.js
import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs';
import { convert } from '../content/converter.js';
import { walkTextNodes } from '../content/dom-walker.js';
import { fileParam, isAllowedViewerUrl, pdfFileName } from './pdf-url.js';
import { padToFit } from './fit-text.js';
import { sampleColors } from './sample-colors.js';
import { createPageState } from './render-state.js';
import { texGeneric, nameBold, nameBlack, nameItalic } from './font-style.js';
import {
  assetURL, prepareLexicon, renderScale, wantsNav, reportNav, onNavCommand, bypassNextRedirect,
  conversionEnabled, onConversionChange,
} from './host.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = assetURL('dist/pdfjs/pdf.worker.min.mjs');

const root = document.getElementById('pages');
const status = document.getElementById('status');

function setStatus(msg) {
  if (!status) return;
  status.textContent = msg;
  // The loading line is REMOVED once the document opens, so a failure reported
  // after that point would be written into a detached node and seen by nobody —
  // a blank grey page with the reason nowhere on it. Put the element back.
  if (!status.isConnected) (root ?? document.body)?.prepend(status);
}

// ?debug=1 turns on per-phase timings for each page. Off by default: the marks
// are only useful when you are asking where a page's time goes, and on Android
// the host forwards console output to logcat, so leaving them on would be noise
// in every session.
const DEBUG = new URLSearchParams(location.search).has('debug');

/**
 * Time the phases of one page and report them as a single line, so a slow page
 * says which part was slow rather than just that it was slow.
 */
function phaseTimer(pageNum) {
  if (!DEBUG) return { mark() {}, done() {} };
  const t0 = performance.now();
  let last = t0;
  const parts = [];
  return {
    mark(name) {
      const now = performance.now();
      parts.push(`${name} ${Math.round(now - last)}`);
      last = now;
    },
    done() {
      console.info(`[eupub-pdf] page ${pageNum}: ${parts.join('  ')}  TOTAL ${Math.round(performance.now() - t0)}ms`);
    },
  };
}

/** The width pages are laid out into, in CSS px — #pages minus its own padding. */
function containerWidth() {
  const cs = getComputedStyle(root);
  return root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

// User zoom, applied on top of whatever the host's renderScale decides. It is
// kept HERE rather than in host.renderScale because that function is the shared
// contract with the embedding host (Eupub), which strips this bar and drives its
// own scale — folding a viewer-only control into it would change that build too.
//
// A fixed ladder rather than a multiplier. Repeatedly multiplying and dividing
// by a step is only symmetric until it meets a bound: four steps out from 1.0
// lands on the 0.5 floor, and four steps back in reaches 1.22, so zooming out
// and back never returns to 100%. Stepping an index cannot drift, and every
// stop is a round percentage instead of 156%.
//
// The top is bounded because the raster grows with the square of the zoom: the
// canvas is viewport.width * dpr, so 3x on a 2x-dpr display is 9x the linear
// size of scale 1 and ~81x the pixels, which is where large pages start meeting
// the browser's maximum canvas dimensions.
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const ZOOM_DEFAULT = ZOOM_LEVELS.indexOf(1);
let zoomIdx = ZOOM_DEFAULT;
let zoom = ZOOM_LEVELS[zoomIdx];

/**
 * The scale to rasterize a page at. Asked per page rather than fixed once: pages
 * within one PDF can differ in size and rotation, and getViewport({scale:1})
 * already accounts for both.
 *
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @returns {number}
 */
function scaleFor(page) {
  return zoom * renderScale({
    naturalWidth: page.getViewport({ scale: 1 }).width,
    containerWidth: containerWidth(),
  });
}

/**
 * The face PDF.js actually drew this run with, mirroring how its own canvas
 * renderer builds ctx.font: weight/slant are baked into the face rather than
 * carried as CSS, and the family is the @font-face it registered (loadedName)
 * with its chosen generic as the fallback.
 *
 * The family must come from HERE and not from the span's computed style. The
 * text layer's font-family is textContent.styles[...].fontFamily, which for an
 * embedded font is only a generic ("sans-serif" for this paper's Computer
 * Modern) — drawing with that paints reformed words in a different typeface
 * from the page they sit on, and measures them at widths the real glyphs never
 * had. commonObjs carries the real loadedName.
 *
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {string} fontName  the item's loaded font name (commonObjs key)
 * @returns {{ weight: string, style: string, family: string }}
 */
function fontFace(page, fontName) {
  try {
    const f = page.commonObjs.get(fontName);
    const fallback = texGeneric(f.name) || f.fallbackName || 'sans-serif';
    // Flags first, name second: pdf.js sets f.bold/f.italic/f.black for some
    // faces and leaves them undefined for most embedded subsets, where the name
    // is all we have. Without the name fallback an italic or black face resolved
    // to normal/normal, and every letter a reform introduced that the subset
    // lacked was drawn upright and regular beside the page's own glyphs.
    const black = f.black || nameBlack(f.name);
    const bold = black || f.bold || nameBold(f.name);
    return {
      weight: black ? '900' : bold ? 'bold' : 'normal',
      style: f.italic || nameItalic(f.name) ? 'italic' : 'normal',
      // Quoted, then the fallback — the same shape pdf.js gives its own ctx.font,
      // so an unloaded face degrades exactly the way the rest of the page does.
      family: `"${f.loadedName}", ${fallback}`,
    };
  } catch {
    return { weight: 'normal', style: 'normal', family: 'sans-serif' };
  }
}



// Whether pages render reformed. Seeded from the host before the first render
// and updated live when the setting changes (see the wiring near the observers,
// which re-renders the pages already on screen). Read at render time rather than
// captured, so a page rasterized after a toggle uses the current answer.
let converting = true;

async function renderPage(pdf, n, dpr, wrap) {
  const t = phaseTimer(n);
  const page = await pdf.getPage(n);
  t.mark('getPage');
  const scale = scaleFor(page);
  const viewport = page.getViewport({ scale });

  // Correct the placeholder's estimated size (page 1's) to this page's real one.
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
  // These MUST be this page's scale: the spans' geometry is what the reformed
  // words are measured and drawn from, so a stale factor mis-sizes them.
  textLayerDiv.style.setProperty('--scale-factor', String(scale));
  textLayerDiv.style.setProperty('--total-scale-factor', String(scale));

  // replaceChildren, not append: this must leave the wrapper holding exactly one
  // canvas and one text layer however it was called. A page can be rendered onto
  // a wrapper that is not empty — a render already in flight when the scale
  // changes is re-queued — and appending there stacked a second canvas below the
  // first (.page canvas is display:block), overflowing into the page beneath it,
  // with two absolutely-positioned text layers so selection returned every word
  // twice.
  wrap.replaceChildren(canvas, textLayerDiv);

  // Opaque white background so blank areas are sampled as paper, not transparent.
  await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;
  t.mark('raster');

  // Build the (transparent) text layer: one span per glyph run, with the font and
  // box PDF.js laid out. We read its text/geometry, reform it, then redraw the
  // changed words on the canvas. The spans stay invisible but hold the reformed
  // text, so selection and copy return the reformed spelling.
  const textContent = await page.getTextContent();
  const layer = new pdfjsLib.TextLayer({ textContentSource: textContent, container: textLayerDiv, viewport });
  await layer.render();
  t.mark('textLayer');
  // Make sure the embedded fonts PDF.js registered are ready for canvas drawing.
  await document.fonts.ready;
  t.mark('fonts');

  // Each str-bearing text item produces one span, in order; pair each span with
  // its item's face and advance width (skipping marked-content boundary items,
  // which produce no span).
  const bySpan = [];
  let spanIdx = 0;
  for (const it of textContent.items) {
    if (it.str === undefined) continue;
    // The item's transform translation is the text origin, which in PDF is ON
    // the baseline; pushing it through the viewport transform gives that
    // baseline in the same CSS-px space this canvas draws in (ctx is scaled by
    // dpr, so drawing coordinates are viewport units). This is the exact figure
    // the page itself used, so a redrawn word sits on the same line as the
    // glyphs around it.
    const origin = [it.transform[4], it.transform[5]];
    pdfjsLib.Util.applyTransform(origin, viewport.transform); // mutates in place
    bySpan[spanIdx++] = { face: fontFace(page, it.fontName), width: it.width, baseline: origin[1] };
  }

  // Record each span's original text, laid-out box, and resolved font BEFORE
  // reforming (which changes the span's text and measured width). The font keeps
  // the original size/family and the detected weight/slant, so a reformed word
  // drawn in a bold or italic run stays bold or italic.
  const spans = layer.textDivs;
  const originals = spans.map((s, i) => {
    const cs = getComputedStyle(s);
    const info = bySpan[i]
      || { face: { weight: 'normal', style: 'normal', family: 'sans-serif' }, width: 0, baseline: null };
    // The extent the original glyphs occupy comes from the PDF's own advance
    // width, NOT from the span's offsetWidth. The span is laid out in the text
    // layer's font-family, which is a generic fallback whenever the page uses an
    // embedded face — so its measured width is the fallback's idea of the string
    // and can be far from what was actually painted. (pdf.js compensates with a
    // --scale-x on the span, but only sets it when it decides it is needed, so
    // it cannot be relied on either.) item.width is in PDF units at scale 1.
    return {
      text: s.textContent,
      x: s.offsetLeft, y: s.offsetTop, w: info.width * scale, h: s.offsetHeight,
      baseline: info.baseline,
      font: `${info.face.style} ${info.face.weight} ${cs.fontSize} ${info.face.family}`,
    };
  });
  // With conversion switched off the page is done: the text layer keeps the
  // PDF's own words and the canvas keeps its own glyphs. Returning here also
  // skips the full-page getImageData below, which is the expensive part of the
  // reform and would otherwise be paid to repaint nothing.
  if (!converting) {
    t.done();
    page.cleanup();
    return;
  }

  // Make this page's words looked-up-able before converting them. The extension
  // has one resident table and does this once; a mobile host with no resident
  // table fetches just this page's vocabulary. Must complete before convert(),
  // since an unknown word silently passes through unchanged.
  await prepareLexicon(textLayerDiv);
  t.mark('lexicon');
  walkTextNodes(textLayerDiv, convert);
  t.mark('convert');

  // Snapshot the pristine raster once so each changed word's ink/paper colours are
  // sampled from the original glyphs, before any are painted over.
  const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  t.mark('snapshot');

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

    // Pad a slightly shorter reform so it need not stretch to fill the slot —
    // see padToFit for where the spaces go and why.
    const drawText = padToFit(o.text, text);

    // Draw the reformed word in the original ink colour with the original font,
    // fitting it to the original word's box width. A shorter or longer reform then
    // keeps the same horizontal extent, so lines don't shrink or overrun — the
    // same way PDF.js fits the original glyphs to the PDF's advance width.
    ctx.fillStyle = ink;
    ctx.font = o.font;
    const m = ctx.measureText(drawText);
    // Sit on the PDF's own baseline for this run. Deriving it instead from the
    // span's top plus fontBoundingBoxAscent made the position depend on the FONT
    // rather than the page: that ascent is a design metric of whichever face
    // canvas resolves (often a generic fallback, since the page's embedded face
    // is not what measureText is using), and where it disagrees with the ascent
    // pdf.js used to place the span, every redrawn word lands a little off the
    // line its untouched neighbours sit on.
    const baseline = o.baseline ?? o.y + m.fontBoundingBoxAscent;
    ctx.save();
    ctx.translate(o.x, baseline);
    if (m.width > 0) ctx.scale(o.w / m.width, 1);
    ctx.fillText(drawText, 0, 0);
    ctx.restore();
  }
  t.mark('repaint');
  t.done();

  page.cleanup();
}

async function main() {
  const fileUrl = fileParam(location.search);
  if (!fileUrl) {
    setStatus('No PDF was specified.');
    return;
  }
  if (!isAllowedViewerUrl(fileUrl)) {
    setStatus('This isn’t a fetchable PDF address.');
    return;
  }

  // The document's filename, shared by the tab title, the bar and the download.
  // Derived from the URL's path (see pdfFileName), so a query string can neither
  // contribute to it nor replace it outright.
  const name = pdfFileName(fileUrl);
  // The tab title doubles as the default filename when the page is printed or
  // saved as PDF, so title it "<base>.eu" — a Save-as-PDF then yields
  // "<base>.eu.pdf" (e.g. report.pdf → report.eu.pdf).
  document.title = `${name.replace(/\.pdf$/i, '')}.eu`;
  const filenameEl = document.getElementById('filename');
  if (filenameEl) {
    filenameEl.textContent = name;
    // The address bar shows this viewer's own chrome-extension:// URL, with the
    // real one percent-encoded in ?file=, and it cannot show anything else: a
    // redirect is the only way past the browser's built-in PDF plugin, and
    // history.replaceState may not cross to another origin. So the document's
    // actual URL is put where it can be read — hovering the filename, which is
    // itself already truncated with an ellipsis when the name is long.
    filenameEl.title = fileUrl;
  }
  // "Open original" escape hatch — the redirect captures every PDF, so the
  // unconverted file must stay one click away.
  const originalEl = document.getElementById('original');
  if (originalEl) {
    originalEl.href = fileUrl;
    // Arm a one-shot redirect bypass BEFORE navigating: this very URL is what
    // the service worker redirects into this viewer, so an unarmed click would
    // bounce straight back here — the escape hatch escaping to itself.
    originalEl.addEventListener('click', (e) => {
      e.preventDefault();
      bypassNextRedirect(fileUrl).then(() => location.assign(fileUrl));
    });
  }

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({
      url: fileUrl,
      // The browser's own navigation to this PDF carried the site's cookies;
      // fetching here without them would 401 every login-gated PDF (statements,
      // intranet docs) that the original tab would have rendered fine. Host
      // permissions make the credentialed fetch legitimate.
      withCredentials: true,
      // Errors only: real-world PDFs routinely trip PDF.js's spec-compliance
      // warnings (over-long /Name tokens, malformed objects, …) which it recovers
      // from. They are noise for a reader, so keep just genuine errors.
      verbosity: pdfjsLib.VerbosityLevel.ERRORS,
      // Where the bundled WebAssembly image/colour decoders live (trailing slash
      // required) — without this PDF.js can't decode JBIG2/JPEG2000 images.
      wasmUrl: assetURL('dist/pdfjs/wasm/'),
      // Where the bundled standard substitute fonts live (trailing slash
      // required) — lets PDF.js render non-embedded fonts (e.g. Goudy-Bold) with
      // a matching Foxit/Liberation face instead of warning and falling back.
      standardFontDataUrl: assetURL('dist/pdfjs/standard_fonts/'),
    }).promise;
  } catch (e) {
    setStatus(`Couldn’t open this PDF (${e?.message ?? e}). You can open the original instead.`);
    return;
  }

  if (status) status.remove();
  const dpr = window.devicePixelRatio || 1;

  // Settle the conversion state BEFORE any page renders, so a viewer opened
  // while the switch is off never shows a reformed page and then correct itself.
  converting = await conversionEnabled();

  // Lazy rendering: a placeholder per page (sized from page 1, corrected when
  // the page really renders), rasterized only as it approaches the viewport.
  // Rendering everything up front made a long PDF pay its whole rasterization
  // cost — canvas, text layer, and a full-page getImageData snapshot per page —
  // before the reader got past page 1.
  const firstPage = await pdf.getPage(1);
  let estimate = firstPage.getViewport({ scale: scaleFor(firstPage) });
  const wraps = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const wrap = document.createElement('div');
    wrap.className = 'page';
    wrap.style.width = `${estimate.width}px`;
    wrap.style.height = `${estimate.height}px`;
    root.append(wrap);
    wraps.push(wrap);
  }

  // A rendered canvas is backed at scale x dpr and is the dominant cost here —
  // several MB per page — so pages that scroll far enough away are thrown back to
  // being empty placeholders and re-rendered if the reader returns. Without this,
  // memory grows for the whole length of the document and a long PDF eventually
  // takes the renderer down with it.
  //
  // The tracker also knows which pages have a render IN FLIGHT, which is what
  // keeps zoom and the conversion toggle honest: both invalidate every raster,
  // and a page rasterizing at that moment is finishing at the old scale (or the
  // old spelling). See render-state.js.
  const pages = createPageState();

  // Printing needs every page on screen at once, which is exactly what the lazy
  // renderer is built to avoid — so eviction is suspended for the duration and
  // the keep window re-applied afterwards.
  let printing = false;

  /** Back to an empty, still-correctly-sized placeholder. */
  function evict(wrap) {
    if (printing) return;
    if (!pages.isRendered(wrap)) return;
    pages.clear(wrap);
    // Keep the width/height renderPage corrected: an emptied page must still
    // occupy its own space, or everything below it jumps as you scroll.
    wrap.replaceChildren();
    renderIO.observe(wrap); // re-arm — coming back into view renders it again
  }

  /** Drop every raster: they are all at the wrong scale, or the wrong spelling. */
  function invalidateAll() {
    for (const wrap of wraps) {
      pages.invalidate(wrap); // a render in flight finishes stale and is re-done
      evict(wrap); // no-op for a page not currently holding a canvas
    }
  }

  // Serialize renders so a fast scroll queues pages instead of rasterizing many
  // at once (each render holds a full-page snapshot while it works).
  let queue = Promise.resolve();
  function enqueueRender(wrap, n) {
    // Claimed at QUEUE time, not when the render starts: everything that decides
    // whether a page still needs rendering (the observer re-arm in observe(),
    // printAllPages) runs while this is only queued, and would otherwise queue
    // it a second time.
    pages.begin(wrap);
    queue = queue.then(async () => {
      try {
        await renderPage(pdf, n, dpr, wrap);
        // Two reasons to throw the fresh canvas away immediately. It may be
        // stale on arrival — the scale or the conversion setting changed while
        // it rendered — in which case evicting re-arms the observer and renders
        // it again at the current one. Or a fast scroll left it queued until it
        // was already far behind, and evictIO won't fire again for something
        // that never re-entered the keep window, so it would be kept forever.
        const fresh = pages.finish(wrap);
        if (!fresh || !pages.isNear(wrap)) evict(wrap);
      } catch (e) {
        pages.clear(wrap); // failed, so it holds no canvas — relayout may retry
        const err = document.createElement('div');
        err.className = 'page-error';
        err.textContent = `Page ${n} could not be rendered (${e?.message ?? e}).`;
        wrap.replaceChildren(err);
      }
    });
  }

  /** @type {IntersectionObserver | undefined} */ let renderIO;
  /** @type {IntersectionObserver | undefined} */ let evictIO;

  // Rebuilt whenever the page size changes: both margins are page-heights, so a
  // rotation leaves them measuring the old layout.
  function observe() {
    renderIO?.disconnect();
    evictIO?.disconnect();

    // ~2 estimated pages of lookahead, so reading pace never catches the renderer.
    renderIO = new IntersectionObserver(
      // Unobserve through the callback's OWN observer, not the renderIO binding:
      // relayout replaces it, and a queued callback from the old one would
      // otherwise unobserve its target from the new observer — quietly ensuring
      // that page never renders.
      (entries, obs) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          obs.unobserve(entry.target);
          enqueueRender(entry.target, wraps.indexOf(entry.target) + 1);
        }
      },
      { rootMargin: `${Math.ceil(estimate.height * 2)}px 0px` },
    );

    // The keep window is deliberately WIDER than the render lookahead. If they
    // were equal, a page hovering at the boundary would be evicted and
    // re-rendered on every small scroll; the gap is the hysteresis that stops
    // that thrash.
    evictIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          pages.setNear(entry.target, entry.isIntersecting);
          if (!entry.isIntersecting) evict(entry.target);
        }
      },
      { rootMargin: `${Math.ceil(estimate.height * 3)}px 0px` },
    );

    for (const wrap of wraps) {
      // needsRender, not "holds no canvas": a page whose render is already
      // queued must not be armed, or the immediate initial notification an
      // intersecting target gets would queue the very same page again.
      if (pages.needsRender(wrap)) renderIO.observe(wrap);
      evictIO.observe(wrap); // observed for the whole session, unlike renderIO
    }
  }
  observe();

  // The toolbar the browser's own PDF viewer would have shown. Redirecting the
  // tab replaces that chrome wholesale, so the page readout and the download and
  // print actions have to be provided here or they are simply lost. Each element
  // is optional: an embedding host (Eupub) generates its own header without
  // them, and owns those affordances itself.
  setUpBar();

  function setUpBar() {
    // --- page readout -------------------------------------------------------
    const counter = document.getElementById('pagecount');
    if (counter) {
      const update = () => {
        // The page straddling the viewport's middle is the one being read —
        // the same rule the nav channel reports to an embedding host.
        const mid = window.scrollY + window.innerHeight / 2;
        let i = wraps.findIndex((w) => w.offsetTop + w.offsetHeight > mid);
        if (i < 0) i = wraps.length - 1;
        counter.textContent = `${i + 1} of ${wraps.length}`;
      };
      counter.hidden = false;
      update();
      let timer = 0;
      window.addEventListener(
        'scroll',
        () => {
          clearTimeout(timer);
          timer = setTimeout(update, 120);
        },
        { passive: true },
      );
    }

    // --- download -----------------------------------------------------------
    const downloadBtn = document.getElementById('download');
    if (downloadBtn) {
      downloadBtn.hidden = false;
      downloadBtn.addEventListener('click', async () => {
        // pdf.js already holds the file's bytes, so this neither refetches nor
        // depends on the network. A blob URL is same-origin, which is what makes
        // the download attribute work at all — pointed at the original
        // cross-origin URL the browser ignores it and navigates instead, and the
        // service worker would then redirect that navigation back into here.
        //
        // These are the ORIGINAL bytes: the reform is painted onto canvases at
        // render time and was never written back into a PDF, so there is no
        // reformed file to offer. The button says "original" for that reason.
        downloadBtn.disabled = true;
        try {
          const data = await pdf.getData();
          const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
          const a = document.createElement('a');
          a.href = url;
          // The ORIGINAL filename, deliberately without the ".eu" the tab title
          // carries. That suffix marks euspell output — a Save-as-PDF from Print
          // renders the reformed canvases and earns it — whereas these are the
          // published bytes, unreformed. Naming them "report.eu.pdf" would
          // promise a reform the file does not contain.
          a.download = name;
          // In the document, not detached: a programmatic click on an anchor
          // that was never inserted is ignored by some engines.
          a.style.display = 'none';
          document.body.append(a);
          a.click();
          a.remove();
          // Revoked on a timer, not immediately: the click starts the download
          // asynchronously and a revoked URL would cancel it.
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (e) {
          console.warn('Euspell: could not prepare the download.', e);
        } finally {
          downloadBtn.disabled = false;
        }
      });
    }

    // --- print --------------------------------------------------------------
    const printBtn = document.getElementById('print');

    /**
     * Rasterize every page, print, then let the keep window take over again.
     *
     * Pages are rendered only as they near the viewport, so printing without
     * this emits blank sheets for everything off screen.
     */
    async function printAllPages() {
      if (printing) return;
      const label = printBtn?.textContent;
      if (printBtn) {
        printBtn.disabled = true;
        printBtn.textContent = 'Preparing…';
      }
      printing = true;
      try {
        for (let n = 1; n <= wraps.length; n++) {
          const wrap = wraps[n - 1];
          if (!pages.needsRender(wrap)) continue; // rendered, or already queued
          // Take it off the render observer first: rendering it here would
          // otherwise leave it armed, and scrolling past it later would
          // rasterize the same page a second time.
          renderIO?.unobserve(wrap);
          enqueueRender(wrap, n);
        }
        await queue; // the render queue is serial; this settles when all are done
        window.print();
      } finally {
        printing = false;
        if (printBtn) {
          printBtn.disabled = false;
          printBtn.textContent = label;
        }
        // Drop everything outside the keep window again — holding every page's
        // canvas is precisely the memory cost lazy rendering exists to avoid.
        for (const wrap of wraps) if (!pages.isNear(wrap)) evict(wrap);
      }
    }

    // Both bound only when the bar exists, i.e. in the standalone viewer. An
    // embedding host (Eupub) strips the bar and owns its own chrome — taking its
    // Ctrl+P and printing just this frame would be hijacking a key in someone
    // else's window.
    if (printBtn) {
      printBtn.hidden = false;
      printBtn.addEventListener('click', printAllPages);

      // Ctrl/Cmd+P goes straight to the browser's print flow without touching
      // the button, and `beforeprint` fires too late to help — it is
      // synchronous, so there is no rasterizing the rest of the document before
      // the dialog opens. Take the shortcut over instead and run the same
      // prepare-then-print path, which is what it was meant to do.
      //
      // The browser's own menu (⋮ → Print) cannot be intercepted at all. For
      // that route the print stylesheet drops pages that never rendered, so the
      // output is short rather than padded with blank sheets.
      window.addEventListener('keydown', (e) => {
        if (e.key !== 'p' && e.key !== 'P') return;
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
        e.preventDefault();
        printAllPages();
      });
    }
  }

  // "Convert pages" flipped while this PDF is open. A rendered page is a raster
  // plus a text layer, both already committed to one spelling, so the only way
  // to switch is to render again: invalidate every page and let the observers
  // re-render the ones on screen. evict() re-arms renderIO, and observing an
  // element that is already intersecting fires the callback immediately, so
  // visible pages come back at once while the rest stay placeholders until
  // scrolled to.
  //
  // Invalidating rather than only evicting is what catches the page that is
  // rasterizing at the moment of the flip: `converting` is read at render time,
  // so that page is committing to the OLD spelling and its canvas is wrong the
  // instant it lands.
  //
  // Evicting keeps each wrap's corrected width/height, so nothing below moves
  // and the reading position holds.
  onConversionChange((enabled) => {
    if (enabled === converting) return;
    converting = enabled;
    invalidateAll();
  });

  // A host that fits pages to the screen (see host.mobile.js) changes scale when
  // the window does — a phone rotating is the real case. Every rendered canvas is
  // then at the wrong scale: rotating to a NARROWER screen leaves pages wider
  // than the viewport and scrolling sideways, and to a wider one leaves them
  // stranded at half the available width.
  //
  // Where renderScale ignores the container (the extension's fixed 1.5) the width
  // never changes and this is a no-op, so no host needs to opt out.
  function relayout() {
    const next = firstPage.getViewport({ scale: scaleFor(firstPage) });
    if (Math.abs(next.width - estimate.width) < 1) return;

    // Remember the reading position as a page plus a fraction into it — pixel
    // offsets mean nothing once every page changes height.
    const anchor = wraps.find((w) => w.offsetTop + w.offsetHeight > window.scrollY) ?? wraps[0];
    const into = anchor && anchor.offsetHeight
      ? (window.scrollY - anchor.offsetTop) / anchor.offsetHeight
      : 0;

    estimate = next;
    invalidateAll(); // every canvas, and every render in flight, is at the old scale
    for (const wrap of wraps) {
      wrap.style.width = `${estimate.width}px`;
      wrap.style.height = `${estimate.height}px`;
    }
    observe();

    if (anchor) window.scrollTo(0, anchor.offsetTop + into * anchor.offsetHeight);
  }

  // Rotation fires several resizes as the viewport settles, and each one would
  // otherwise evict and re-render everything.
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(relayout, 200);
  });

  // --- zoom -----------------------------------------------------------------
  // Re-rasterizing is the whole per-page pipeline (render, text layer, convert,
  // snapshot, redraw each changed word), not just a resize, so held-down clicks
  // are coalesced the way rotation's resizes are. relayout() already evicts every
  // canvas, keeps the reading position as a page plus a fraction, and re-arms the
  // lazy observer, so zoom only has to move the number and call it.
  const zoomOutBtn = document.getElementById('zoom-out');
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomLevelBtn = document.getElementById('zoom-level');
  let zoomTimer = 0;

  function setZoom(idx) {
    const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, idx));
    if (next === zoomIdx) return; // already at that stop, or at a bound
    zoomIdx = next;
    zoom = ZOOM_LEVELS[zoomIdx];
    if (zoomLevelBtn) zoomLevelBtn.textContent = `${Math.round(zoom * 100)}%`;
    if (zoomOutBtn) zoomOutBtn.disabled = zoomIdx === 0;
    if (zoomInBtn) zoomInBtn.disabled = zoomIdx === ZOOM_LEVELS.length - 1;
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(relayout, 150);
  }

  if (zoomOutBtn && zoomInBtn && zoomLevelBtn) {
    for (const b of [zoomOutBtn, zoomInBtn, zoomLevelBtn]) b.hidden = false;
    zoomOutBtn.addEventListener('click', () => setZoom(zoomIdx - 1));
    zoomInBtn.addEventListener('click', () => setZoom(zoomIdx + 1));
    zoomLevelBtn.addEventListener('click', () => setZoom(ZOOM_DEFAULT));

    // Ctrl/Cmd +/-/0. Taken over only in the standalone viewer, for the same
    // reason as Ctrl+P below: in an embedding host these keys belong to the host.
    // Browser zoom would scale the bar and blur the canvas; this re-rasterizes.
    window.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      // '=' is the unshifted key that carries '+' on most layouts.
      const step = e.key === '+' || e.key === '=' ? 1
        : e.key === '-' || e.key === '_' ? -1
          : 0;
      if (step) {
        e.preventDefault();
        setZoom(zoomIdx + step);
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(ZOOM_DEFAULT);
      }
    });
  }

  // Navigation channel — only when an embedding host wants it (Eupub's reader).
  // The extension viewer has no TOC/status chrome, so wantsNav is false there and
  // none of this runs. The host owns the sidebar and status bar; we feed it the
  // outline and the current page, and take jump commands back.
  //
  // Caught on its own because it is NOT awaited: a rejection would escape
  // main()'s catch entirely. And logged rather than surfaced — the document
  // reads perfectly well without a table of contents, so a host that cannot
  // supply one must not cost the reader the PDF.
  if (wantsNav) {
    setUpNav().catch((e) => console.warn('Euspell: navigation channel unavailable.', e));
  }

  async function setUpNav() {
    // Current page: the wrap straddling the viewport's vertical middle.
    function reportPosition() {
      const mid = window.scrollY + window.innerHeight / 2;
      let page = wraps.findIndex((w) => w.offsetTop + w.offsetHeight > mid);
      if (page < 0) page = wraps.length - 1;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.round((window.scrollY / max) * 100) : 0;
      reportNav('position', { page, pages: wraps.length, pct });
    }
    let posTimer = 0;
    window.addEventListener(
      'scroll',
      () => {
        clearTimeout(posTimer);
        posTimer = setTimeout(reportPosition, 120);
      },
      { passive: true },
    );

    // Jump to a page (TOC click or position restore). Scrolling to a placeholder
    // works before it renders — the render observer fills it in. Registered
    // BEFORE reporting 'ready', so a restore command can't outrun the listener.
    onNavCommand((c) => {
      if (c.goto != null && wraps[c.goto]) {
        wraps[c.goto].scrollIntoView();
        reportPosition();
      }
    });

    // Flatten pdf.js's outline tree to [{ title, page, depth }], resolving each
    // destination to a page index. Entries whose dest doesn't resolve are dropped
    // (their children still walk); a PDF with no outline yields [].
    async function flattenOutline(nodes, depth, out) {
      for (const node of nodes || []) {
        try {
          const dest = typeof node.dest === 'string' ? await pdf.getDestination(node.dest) : node.dest;
          if (dest && dest[0]) out.push({ title: node.title, page: await pdf.getPageIndex(dest[0]), depth });
        } catch {
          /* unresolved destination — skip this heading, keep its children */
        }
        if (node.items?.length) await flattenOutline(node.items, depth + 1, out);
      }
    }
    const outline = [];
    try {
      await flattenOutline(await pdf.getOutline(), 0, outline);
    } catch {
      /* no outline / malformed — report an empty one */
    }
    reportNav('ready', { pages: wraps.length, outline });
    reportPosition(); // starting page, before any scroll
  }
}

// Everything main() does after the document opens runs unguarded — page 1's
// viewport, the placeholder layout, the observers, the bar. A throw in any of it
// (a malformed page tree, a host seam that rejects) became an unhandled
// rejection behind a blank grey page: the loading line had already been removed,
// so the viewer showed nothing at all and said nothing about why.
//
// The escape hatch survives this, which is what makes the message honest: the
// "Open original" link is wired up before the document is even fetched.
main().catch((e) => {
  console.error('Euspell: the PDF viewer failed to start.', e);
  setStatus(`Couldn’t display this PDF (${e?.message ?? e}). You can open the original instead.`);
});
