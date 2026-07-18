// Copies the PDF.js runtime assets that can't be bundled — the worker, the
// WebAssembly image/colour decoders (JBIG2, OpenJPEG, QCMS, QuickJS), and the
// standard substitute fonts (Foxit/Liberation, used when a PDF references a
// non-embedded font such as Goudy-Bold) — from the installed pdfjs-dist package
// into dist/pdfjs/. The viewer points PDF.js at these via chrome.runtime.getURL
// (worker) and the wasmUrl / standardFontDataUrl options. The main library is
// bundled into dist/pdf-viewer.js by rollup.
import { mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = join(root, 'node_modules/pdfjs-dist');
const destDir = join(root, 'dist/pdfjs');
const wasmDir = join(destDir, 'wasm');
const fontDir = join(destDir, 'standard_fonts');

// PDF.js 6 targets a very recent JS baseline (Uint8Array.prototype.toHex,
// Map.prototype.getOrInsert[Computed]) that older engines — notably Android
// System WebView 128 — lack, so a PDF fails to open or render there. The viewer
// imports src/pdf/polyfills.js to shim the page's main thread; the worker runs
// in its own global that a page-level shim can't reach, so prepend the SAME
// file to the worker as we copy it. Both shims are feature-detected, hence inert
// where the engine already ships the methods.
const polyfills = readFileSync(join(root, 'src/pdf/polyfills.js'), 'utf8');

mkdirSync(wasmDir, { recursive: true });
mkdirSync(fontDir, { recursive: true });
const worker = readFileSync(join(pkg, 'build/pdf.worker.min.mjs'), 'utf8');
writeFileSync(join(destDir, 'pdf.worker.min.mjs'), polyfills + '\n' + worker);

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
console.log(`[euspell-build] Copied pdf.worker.min.mjs (+toHex shim) + ${wasmCount} wasm + ${fontCount} font files -> dist/pdfjs/`);
