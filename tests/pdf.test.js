import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPdfUrl, fileParam } from '../src/pdf/pdf-url.js';

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

test('fileParam: extracts and decodes the ?file= query', () => {
  const raw = 'https://example.com/a.pdf?x=1';
  assert.equal(fileParam('?file=' + encodeURIComponent(raw)), raw);
  assert.equal(fileParam(''), null);
  assert.equal(fileParam('?foo=bar'), null);
});
