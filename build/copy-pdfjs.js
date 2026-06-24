// Copies the PDF.js runtime assets that can't be bundled — the worker, the
// WebAssembly image/colour decoders (JBIG2, OpenJPEG, QCMS, QuickJS), and the
// standard substitute fonts (Foxit/Liberation, used when a PDF references a
// non-embedded font such as Goudy-Bold) — from the installed pdfjs-dist package
// into dist/pdfjs/. The viewer points PDF.js at these via chrome.runtime.getURL
// (worker) and the wasmUrl / standardFontDataUrl options. The main library is
// bundled into dist/pdf-viewer.js by rollup.
import { mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = join(root, 'node_modules/pdfjs-dist');
const destDir = join(root, 'dist/pdfjs');
const wasmDir = join(destDir, 'wasm');
const fontDir = join(destDir, 'standard_fonts');

mkdirSync(wasmDir, { recursive: true });
mkdirSync(fontDir, { recursive: true });
copyFileSync(join(pkg, 'build/pdf.worker.min.mjs'), join(destDir, 'pdf.worker.min.mjs'));

let wasmCount = 0;
for (const file of readdirSync(join(pkg, 'wasm'))) {
  if (file.endsWith('.wasm')) {
    copyFileSync(join(pkg, 'wasm', file), join(wasmDir, file));
    wasmCount++;
  }
}

let fontCount = 0;
for (const file of readdirSync(join(pkg, 'standard_fonts'))) {
  copyFileSync(join(pkg, 'standard_fonts', file), join(fontDir, file));
  fontCount++;
}
console.log(`[euspell-build] Copied pdf.worker.min.mjs + ${wasmCount} wasm + ${fontCount} font files -> dist/pdfjs/`);
