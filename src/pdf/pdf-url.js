/**
 * Small URL helpers shared by the service-worker redirect and the viewer.
 * Kept dependency-free and pure so they are unit-testable.
 */

/** True for a top-level navigation that points at a .pdf file we can handle. */
export function isPdfUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== 'file:') return false;
    return /\.pdf$/i.test(decodeURIComponent(u.pathname));
  } catch {
    return false;
  }
}

/**
 * True for a Content-Type header value that names a PDF. Many servers send
 * extensionless PDFs with the correct MIME type, so the response header is the
 * most reliable signal. Parameters (`; charset=…`) are ignored.
 */
export function isPdfContentType(value) {
  if (!value) return false;
  const type = String(value).split(';', 1)[0].trim().toLowerCase();
  return type === 'application/pdf' || type === 'application/x-pdf';
}

/**
 * True when a Content-Disposition header advertises a `.pdf` attachment, e.g.
 * `attachment; filename="report.pdf"` or the RFC 5987 `filename*=UTF-8''…` form.
 * Some download endpoints serve a PDF as octet-stream but name the file here.
 */
export function isPdfDisposition(value) {
  if (!value) return false;
  // RFC 6266: when both forms are present, filename* wins regardless of the
  // order they appear in the header — so try it first, not whichever comes
  // first in the string.
  const m =
    /filename\*=(?:[^']*'')?"?([^";]+)/i.exec(value) ??
    /filename=(?:[^']*'')?"?([^";]+)/i.exec(value);
  if (!m) return false;
  const name = m[1].trim();
  try {
    return /\.pdf$/i.test(decodeURIComponent(name));
  } catch {
    return /\.pdf$/i.test(name);
  }
}

/**
 * True when a Content-Disposition header's disposition-type is `attachment`
 * (vs. `inline` or absent). An attachment response is one the browser's own
 * download manager will save to disk on its own, regardless of what an
 * extension does in `onHeadersReceived` (MV3 that listener can't cancel or
 * block it) — the caller uses this to skip redirecting to our viewer for such
 * a response, since doing so would just fetch a second copy of a file the
 * browser is already saving.
 */
export function isAttachmentDisposition(value) {
  if (!value) return false;
  return /^\s*attachment\b/i.test(value);
}

/**
 * True when a document's leading bytes carry the PDF signature `%PDF-`. The spec
 * allows a little junk (a BOM, stray whitespace) before the header and real
 * files exploit that, so scan a short prefix instead of requiring offset 0. Used
 * as the last-resort check when the headers are an ambiguous binary blob.
 *
 * @param {Uint8Array | number[]} bytes  the document's first bytes
 */
export function looksLikePdfBytes(bytes) {
  if (!bytes || !bytes.length) return false;
  const SIG = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  const last = Math.min(bytes.length, 1024) - SIG.length;
  for (let i = 0; i <= last; i++) {
    let hit = true;
    for (let j = 0; j < SIG.length; j++) {
      if (bytes[i + j] !== SIG[j]) { hit = false; break; }
    }
    if (hit) return true;
  }
  return false;
}

/** The original PDF URL carried in the viewer's `?file=` query, or null. */
export function fileParam(search) {
  return new URLSearchParams(search).get('file');
}

/**
 * The document's filename, for the viewer's tab title, its bar, and the
 * "Download original" button.
 *
 * Taken from the URL's PATH, which is the same rule the browser's own download
 * manager applies in the absence of a Content-Disposition. Slicing the raw URL
 * at the last "/" instead — as the viewer used to — lets the QUERY STRING supply
 * the name whenever it contains a slash of its own, and those are common on
 * exactly the download endpoints this viewer sees:
 * `/get.pdf?redirect=/home/a` came out as "a", so the tab was titled "a.eu" and
 * Download original saved a file called "a" with no extension at all.
 *
 * A `.pdf` suffix is added when the path has none. Extensionless PDFs are a
 * whole detection path in the service worker (`/download`, `/view/1234`), and a
 * downloaded file the OS cannot recognise is not much use — the bytes are a PDF
 * whatever the URL called them.
 *
 * Percent-escapes are decoded, and the result re-split on any separator they
 * reveal: `%2F` is a literal slash INSIDE one path segment, so decoding first
 * and splitting after keeps a path out of a filename.
 *
 * @param {string} url  the document's own URL (not the viewer's)
 * @returns {string} a filename ending in .pdf; "PDF.pdf" when the URL offers none
 */
export function pdfFileName(url) {
  const FALLBACK = 'PDF.pdf';
  let path;
  try {
    path = new URL(url).pathname;
  } catch {
    return FALLBACK; // unparseable — the viewer rejects these before asking
  }
  try {
    path = decodeURIComponent(path);
  } catch {
    /* a literal % that is not an escape — name it from the raw form */
  }
  const base = path.split(/[/\\]/).pop().trim();
  if (!base) return FALLBACK; // a directory-style URL has no last segment
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

/**
 * Whether this browser lets our viewer read `file://` PDFs, decided from the
 * viewer's own extension URL.
 *
 * Firefox and Safari both refuse to let an extension page fetch a file:// URL,
 * so redirecting a local PDF into our viewer there would replace the browser's
 * own native viewer with an error page the user can't escape — Firefox:
 * moz-extension pages may not navigate to file: links; Safari: a file:// fetch
 * from a safari-web-extension page fails with "Unexpected server response (0)",
 * and there is no per-extension "allow file access" grant as on Chrome. On
 * Chrome a file: navigation only reaches us when the user has explicitly
 * enabled "Allow access to file URLs", and the viewer can then fetch it.
 *
 * Shared rather than duplicated because TWO surfaces have to agree: the service
 * worker decides whether to redirect a local PDF, and the popup decides whether
 * to offer "reload and I'll convert this". They drifted — the popup tested only
 * for Firefox — so on Safari the popup offered a reload that the worker then
 * declined to act on, and the offer came back after every reload, forever.
 *
 * @param {string} viewerUrl  runtime.getURL() of any page of this extension
 * @returns {boolean}
 */
export function canViewFileUrls(viewerUrl) {
  return !/^(moz-extension|safari-web-extension):/i.test(viewerUrl);
}

/**
 * True when a viewer `?file=` target is a scheme the viewer may fetch and link
 * to. This keeps `javascript:`/`data:`/extension URLs out of both the PDF.js
 * fetch and the "Open original" anchor (the extension CSP would block a
 * javascript: link's execution anyway, but the URL should never get that far).
 *
 * Defence in depth rather than a live hole: viewer.html is NOT listed in the
 * manifest's web_accessible_resources — only dist/lexicon.data is — so a web
 * page cannot navigate to it and hand it a `?file=` of its own choosing. What it
 * guards is the value's provenance being indirect: the query is assembled by the
 * service worker from whatever URL a tab navigated to, and an embedding host
 * (Eupub) builds the same URL itself. A scheme check at the point of use costs
 * nothing and does not depend on every producer staying careful.
 *
 * Beyond the fetchable web schemes, a target on THIS page's own origin is
 * allowed whatever the scheme: an embedding host may serve both the viewer and
 * the document from a private scheme (Eupub desktop uses app://eupub for
 * both, the way Android uses https://eupub.local), and fetching one's own
 * origin is as safe as the page itself. Guarded for test contexts without a
 * `location`.
 */
export function isAllowedViewerUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'file:') return true;
    return typeof location !== 'undefined' && u.origin !== 'null' && u.origin === location.origin;
  } catch {
    return false;
  }
}
