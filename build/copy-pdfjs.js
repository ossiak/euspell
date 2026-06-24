// Copies the PDF.js worker (the one runtime asset that can't be bundled) from
// the installed pdfjs-dist package into dist/pdfjs/, where the viewer loads it
// via chrome.runtime.getURL. The main library is bundled into dist/pdf-viewer.js
// by rollup; only the worker needs to ship as a standalone module.
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const destDir = join(root, 'dist/pdfjs');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, 'pdf.worker.min.mjs'));
console.log('[euspell-build] Copied pdf.worker.min.mjs -> dist/pdfjs/');
