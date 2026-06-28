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
  const m = /filename\*?=(?:[^']*'')?"?([^";]+)/i.exec(value);
  if (!m) return false;
  const name = m[1].trim();
  try {
    return /\.pdf$/i.test(decodeURIComponent(name));
  } catch {
    return /\.pdf$/i.test(name);
  }
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
