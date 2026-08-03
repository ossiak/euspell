import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPdfUrl,
  fileParam,
  isPdfContentType,
  isPdfDisposition,
  isAttachmentDisposition,
  looksLikePdfBytes,
  isAllowedViewerUrl,
  canViewFileUrls,
  pdfFileName,
} from '../src/pdf/pdf-url.js';

test('isAllowedViewerUrl: accepts fetchable document schemes only', () => {
  assert.equal(isAllowedViewerUrl('https://example.com/report'), true);
  assert.equal(isAllowedViewerUrl('http://example.com/doc.pdf'), true);
  assert.equal(isAllowedViewerUrl('file:///home/u/manual.pdf'), true);
});

test('isAllowedViewerUrl: rejects script/data/extension URLs and junk (?file= is page-controlled)', () => {
  assert.equal(isAllowedViewerUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedViewerUrl('data:application/pdf;base64,JVBERi0='), false);
  assert.equal(isAllowedViewerUrl('chrome-extension://abcdef/page.html'), false);
  assert.equal(isAllowedViewerUrl('blob:https://example.com/uuid'), false);
  assert.equal(isAllowedViewerUrl('not a url'), false);
  assert.equal(isAllowedViewerUrl(''), false);
});

test('isPdfUrl: matches http(s) and file PDFs by path', () => {
  assert.equal(isPdfUrl('https://example.com/doc.pdf'), true);
  assert.equal(isPdfUrl('http://example.com/DOC.PDF'), true);
  assert.equal(isPdfUrl('https://example.com/a/b/report.pdf?download=1'), true);
  assert.equal(isPdfUrl('file:///C:/docs/manual.pdf'), true);
  assert.equal(isPdfUrl('https://example.com/path%2Freport.pdf'), true);
});

test('isPdfUrl: rejects non-PDF paths and unsupported schemes', () => {
  assert.equal(isPdfUrl('https://example.com/page'), false);
  assert.equal(isPdfUrl('https://example.com/file.pdf.html'), false);
  assert.equal(isPdfUrl('chrome://extensions'), false);
  assert.equal(isPdfUrl('data:application/pdf;base64,AAetc'), false);
  assert.equal(isPdfUrl('not a url'), false);
  assert.equal(isPdfUrl(''), false);
});

test('isPdfContentType: matches the PDF MIME types, ignoring parameters', () => {
  assert.equal(isPdfContentType('application/pdf'), true);
  assert.equal(isPdfContentType('Application/PDF; charset=binary'), true);
  assert.equal(isPdfContentType('application/x-pdf'), true);
  assert.equal(isPdfContentType('application/octet-stream'), false);
  assert.equal(isPdfContentType('text/html'), false);
  assert.equal(isPdfContentType(''), false);
  assert.equal(isPdfContentType(undefined), false);
});

test('isPdfDisposition: detects a .pdf attachment filename', () => {
  assert.equal(isPdfDisposition('attachment; filename="report.pdf"'), true);
  assert.equal(isPdfDisposition('inline; filename=report.PDF'), true);
  assert.equal(isPdfDisposition("attachment; filename*=UTF-8''my%20report.pdf"), true);
  assert.equal(isPdfDisposition('attachment; filename="data.csv"'), false);
  assert.equal(isPdfDisposition('attachment'), false);
  assert.equal(isPdfDisposition(undefined), false);
  // RFC 6266: filename* wins over filename when both are present, in either order.
  assert.equal(isPdfDisposition('inline; filename="export.bin"; filename*=UTF-8\'\'report.pdf'), true);
  assert.equal(isPdfDisposition("inline; filename*=UTF-8''export.bin; filename=report.pdf"), false);
});

test('isAttachmentDisposition: detects the attachment disposition-type', () => {
  assert.equal(isAttachmentDisposition('attachment; filename="report.pdf"'), true);
  assert.equal(isAttachmentDisposition('Attachment; filename=report.pdf'), true);
  assert.equal(isAttachmentDisposition('attachment'), true);
  assert.equal(isAttachmentDisposition('inline; filename="report.pdf"'), false);
  assert.equal(isAttachmentDisposition('inline'), false);
  assert.equal(isAttachmentDisposition(undefined), false);
  assert.equal(isAttachmentDisposition(''), false);
});

test('looksLikePdfBytes: finds the %PDF- signature in a leading prefix', () => {
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  assert.equal(looksLikePdfBytes(new Uint8Array(sig)), true);
  // tolerates a BOM / junk before the header
  assert.equal(looksLikePdfBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...sig])), true);
  assert.equal(looksLikePdfBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), false); // a zip
  assert.equal(looksLikePdfBytes(new Uint8Array()), false);
  // signature past the 1 KB scan window is not matched
  const far = new Uint8Array(1100);
  far.set(sig, 1050);
  assert.equal(looksLikePdfBytes(far), false);
});

test('fileParam: extracts and decodes the ?file= query', () => {
  const raw = 'https://example.com/a.pdf?x=1';
  assert.equal(fileParam('?file=' + encodeURIComponent(raw)), raw);
  assert.equal(fileParam(''), null);
  assert.equal(fileParam('?foo=bar'), null);
});

test('canViewFileUrls: only Chromium extension pages may fetch file://', () => {
  assert.equal(canViewFileUrls('chrome-extension://abc/src/pdf/viewer.html'), true);
  assert.equal(canViewFileUrls('moz-extension://abc/src/pdf/viewer.html'), false);
  assert.equal(canViewFileUrls('safari-web-extension://abc/src/pdf/viewer.html'), false);
});

test('pdfFileName: names the document from the URL path', () => {
  assert.equal(pdfFileName('https://example.com/docs/report.pdf'), 'report.pdf');
  assert.equal(pdfFileName('https://example.com/DOC.PDF'), 'DOC.PDF'); // extension left alone
  assert.equal(pdfFileName('file:///home/u/manual.pdf'), 'manual.pdf');
  assert.equal(pdfFileName('file:///C:/My%20Docs/annual%20report.pdf'), 'annual report.pdf');
});

test('pdfFileName: the query string can neither supply nor replace the name', () => {
  // The bug this function exists for. Slicing the raw URL at its last "/" let a
  // query containing a slash decide the filename: this one was named "a", so the
  // tab read "a.eu" and Download original saved a file called "a".
  assert.equal(pdfFileName('https://example.com/get.pdf?redirect=/home/a'), 'get.pdf');
  assert.equal(pdfFileName('https://example.com/a/b.pdf#page=3'), 'b.pdf');
  // …and a query that merely mentions a .pdf does not get to name the download.
  assert.equal(pdfFileName('https://example.com/download?path=/files/report.pdf'), 'download.pdf');
});

test('pdfFileName: an extensionless PDF still downloads as one', () => {
  // Extensionless PDFs are a whole detection path in the service worker, and a
  // saved file the OS cannot recognise is not much use.
  assert.equal(pdfFileName('https://example.com/download'), 'download.pdf');
  assert.equal(pdfFileName('https://example.com/view/1234'), '1234.pdf');
  assert.equal(pdfFileName('https://example.com/paper.php?id=7'), 'paper.php.pdf');
});

test('pdfFileName: a decoded separator cannot turn a name into a path', () => {
  // %2F is a literal slash inside ONE path segment (isPdfUrl already handles
  // these), so decoding has to be followed by another split or the download
  // name carries a directory in it.
  assert.equal(pdfFileName('https://example.com/path%2Freport.pdf'), 'report.pdf');
  assert.equal(pdfFileName('https://example.com/dir%5Cfile.pdf'), 'file.pdf');
});

test('pdfFileName: falls back rather than producing an empty name', () => {
  assert.equal(pdfFileName('https://example.com/files/'), 'PDF.pdf');
  assert.equal(pdfFileName('https://example.com'), 'PDF.pdf');
  assert.equal(pdfFileName('not a url'), 'PDF.pdf');
  // A literal % that is not an escape must not throw — keep the raw segment.
  assert.equal(pdfFileName('https://example.com/100%discount.pdf'), '100%discount.pdf');
});

test('pdfFileName: always yields a name the tab title can build on', () => {
  // viewer.js titles the tab `${name.replace(/\.pdf$/i, '')}.eu`, so that a
  // Save-as-PDF lands on "<base>.eu.pdf". That only holds if every name ends in
  // .pdf and has something in front of it.
  for (const url of [
    'https://example.com/docs/report.pdf',
    'https://example.com/get.pdf?redirect=/home/a',
    'https://example.com/download',
    'https://example.com/files/',
    'not a url',
  ]) {
    const name = pdfFileName(url);
    assert.match(name, /\.pdf$/i, `${url} -> ${name} must end in .pdf`);
    assert.ok(name.replace(/\.pdf$/i, '').length > 0, `${url} -> ${name} must have a base`);
  }
});
