import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPdfUrl,
  fileParam,
  isPdfContentType,
  isPdfDisposition,
  isAttachmentDisposition,
  looksLikePdfBytes,
} from '../src/pdf/pdf-url.js';

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
