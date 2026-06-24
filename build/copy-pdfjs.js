// Copies the PDF.js runtime assets that can't be bundled — the worker and the
// WebAssembly image/colour decoders (JBIG2, OpenJPEG, QCMS, QuickJS) — from the
// installed pdfjs-dist package into dist/pdfjs/. The viewer points PDF.js at
// these via chrome.runtime.getURL (worker) and the wasmUrl option. The main
// library is bundled into dist/pdf-viewer.js by rollup.
import { mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = join(root, 'node_modules/pdfjs-dist');
const destDir = join(root, 'dist/pdfjs');
const wasmDir = join(destDir, 'wasm');

mkdirSync(wasmDir, { recursive: true });
copyFileSync(join(pkg, 'build/pdf.worker.min.mjs'), join(destDir, 'pdf.worker.min.mjs'));

let wasmCount = 0;
for (const file of readdirSync(join(pkg, 'wasm'))) {
  if (file.endsWith('.wasm')) {
    copyFileSync(join(pkg, 'wasm', file), join(wasmDir, file));
    wasmCount++;
  }
}
console.log(`[euspell-build] Copied pdf.worker.min.mjs + ${wasmCount} wasm files -> dist/pdfjs/`);
