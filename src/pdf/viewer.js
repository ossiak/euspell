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
 * generic AND the weight from it (see texGeneric/texBold): the stray sans-serif q
 * becomes a serif one, bold in a bold heading, that reads almost as the heading's
 * own glyph. That is cosmetic, not a fix — the outline is still not in the file.
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

import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs';
import { convert } from '../content/converter.js';
import { walkTextNodes } from '../content/dom-walker.js';
import { fileParam, isAllowedViewerUrl } from './pdf-url.js';
import { sampleColors } from './sample-colors.js';
import { assetURL, prepareLexicon, renderScale, wantsNav, reportNav, onNavCommand } from './host.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = assetURL('dist/pdfjs/pdf.worker.min.mjs');

const root = document.getElementById('pages');
const status = document.getElementById('status');

function setStatus(msg) {
  if (status) status.textContent = msg;
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

/**
 * The scale to rasterize a page at. Asked per page rather than fixed once: pages
 * within one PDF can differ in size and rotation, and getViewport({scale:1})
 * already accounts for both.
 *
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @returns {number}
 */
function scaleFor(page) {
  return renderScale({
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
    const bold = f.black || f.bold || texBold(f.name);
    return {
      weight: f.black ? '900' : bold ? 'bold' : 'normal',
      style: f.italic ? 'italic' : 'normal',
      // Quoted, then the fallback — the same shape pdf.js gives its own ctx.font,
      // so an unloaded face degrades exactly the way the rest of the page does.
      family: `"${f.loadedName}", ${fallback}`,
    };
  } catch {
    return { weight: 'normal', style: 'normal', family: 'sans-serif' };
  }
}

/**
 * Whether a TeX font is bold, from its NAME — same reasoning as texGeneric.
 * Computer Modern's bold faces (cmb, cmbx, cmbsy, cmssbx) and Latin Modern's
 * (lmbx…, or a human name ending -Bold) leave fontObj.bold unset, so the weight
 * has to come from the name too. cmbx12 -> bold; cmr12, cmss10 -> not.
 *
 * @param {string} name
 * @returns {boolean}
 */
function texBold(name) {
  if (!name) return false;
  const n = name.replace(/^[A-Z]{6}\+/, '').toLowerCase();
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
 * we draw (see fontFace) — the rest of the page is untouched raster. So the blast
 * radius is one substituted letter, and an unrecognised name returns null and
 * keeps today's behaviour. Deliberately narrow: CM and Latin Modern cover almost
 * all academic PDFs, and guessing past them buys little for real risk.
 *
 * @param {string} name  the font's PostScript name, e.g. "RYDCUL+CMBX12"
 * @returns {'serif' | 'sans-serif' | 'monospace' | null}
 */
function texGeneric(name) {
  if (!name) return null;
  const n = name.replace(/^[A-Z]{6}\+/, '').toLowerCase(); // drop the subset prefix
  // Order matters: the mono and sans families also start with cm/lm, so they
  // must be matched before the serif catch-all.
  if (/^(cmtt|cmsltt|cmitt|cmtex|cmvtt|lmmono|lmtt)/.test(n)) return 'monospace';
  if (/^(cmss|lmss|lmsans)/.test(n)) return 'sans-serif';
  if (/^(cm|lm)/.test(n)) return 'serif';
  return null;
}

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

  wrap.append(canvas, textLayerDiv);

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
    bySpan[spanIdx++] = { face: fontFace(page, it.fontName), width: it.width };
  }

  // Record each span's original text, laid-out box, and resolved font BEFORE
  // reforming (which changes the span's text and measured width). The font keeps
  // the original size/family and the detected weight/slant, so a reformed word
  // drawn in a bold or italic run stays bold or italic.
  const spans = layer.textDivs;
  const originals = spans.map((s, i) => {
    const cs = getComputedStyle(s);
    const info = bySpan[i] || { face: { weight: 'normal', style: 'normal', family: 'sans-serif' }, width: 0 };
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
      font: `${info.face.style} ${info.face.weight} ${cs.fontSize} ${info.face.family}`,
    };
  });
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

    // When the reform is a little shorter, pad it with spaces so it keeps near
    // its natural proportions (the spaces take up the slack) instead of being
    // stretched to fill the slot: one letter shorter gets a single leading space;
    // two or three shorter get a leading and trailing space. Larger differences
    // fall through to plain width-fitting.
    const drop = o.text.length - text.length;
    const drawText =
      drop === 1 ? ` ${text}` : drop === 2 || drop === 3 ? ` ${text} ` : text;

    // Draw the reformed word in the original ink colour with the original font,
    // fitting it to the original word's box width. A shorter or longer reform then
    // keeps the same horizontal extent, so lines don't shrink or overrun — the
    // same way PDF.js fits the original glyphs to the PDF's advance width.
    ctx.fillStyle = ink;
    ctx.font = o.font;
    const m = ctx.measureText(drawText);
    const baseline = o.y + m.fontBoundingBoxAscent;
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

  // "Open original" escape hatch — the redirect captures every PDF, so the
  // unconverted file must stay one click away.
  let name = (fileUrl.split('/').pop() || 'PDF').replace(/[?#].*$/, '');
  try {
    name = decodeURIComponent(name);
  } catch {
    /* a literal % in the filename — keep it as-is rather than die before the
       escape-hatch link below is wired up */
  }
  // The tab title doubles as the default filename when the page is printed or
  // saved as PDF, so title it "<base>.eu" — a Save-as-PDF then yields
  // "<base>.eu.pdf" (e.g. report.pdf → report.eu.pdf).
  document.title = `${name.replace(/\.pdf$/i, '')}.eu`;
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
  const rendered = new WeakSet(); // holds a canvas right now
  const near = new WeakSet(); // inside the keep window (per evictIO, below)

  /** Back to an empty, still-correctly-sized placeholder. */
  function evict(wrap) {
    if (!rendered.has(wrap)) return;
    rendered.delete(wrap);
    // Keep the width/height renderPage corrected: an emptied page must still
    // occupy its own space, or everything below it jumps as you scroll.
    wrap.replaceChildren();
    renderIO.observe(wrap); // re-arm — coming back into view renders it again
  }

  // Serialize renders so a fast scroll queues pages instead of rasterizing many
  // at once (each render holds a full-page snapshot while it works).
  let queue = Promise.resolve();
  function enqueueRender(wrap, n) {
    queue = queue.then(async () => {
      try {
        await renderPage(pdf, n, dpr, wrap);
        rendered.add(wrap);
        // A fast scroll can leave a page queued until it is already far behind,
        // and evictIO won't fire again for something that never re-entered the
        // keep window — so a page that finished out of view is dropped here
        // rather than kept forever.
        if (!near.has(wrap)) evict(wrap);
      } catch (e) {
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
          if (entry.isIntersecting) {
            near.add(entry.target);
          } else {
            near.delete(entry.target);
            evict(entry.target);
          }
        }
      },
      { rootMargin: `${Math.ceil(estimate.height * 3)}px 0px` },
    );

    for (const wrap of wraps) {
      if (!rendered.has(wrap)) renderIO.observe(wrap);
      evictIO.observe(wrap); // observed for the whole session, unlike renderIO
    }
  }
  observe();

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
    for (const wrap of wraps) {
      evict(wrap); // every canvas is at the old scale
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

  // Navigation channel — only when an embedding host wants it (Eupub's reader).
  // The extension viewer has no TOC/status chrome, so wantsNav is false there and
  // none of this runs. The host owns the sidebar and status bar; we feed it the
  // outline and the current page, and take jump commands back.
  if (wantsNav) setUpNav();

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

main();
