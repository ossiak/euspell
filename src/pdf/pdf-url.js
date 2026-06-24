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

/** The original PDF URL carried in the viewer's `?file=` query, or null. */
export function fileParam(search) {
  return new URLSearchParams(search).get('file');
}
