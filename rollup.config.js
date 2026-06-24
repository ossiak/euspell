import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
  // Content script (classic iife — injected into every page).
  {
    input: 'src/content/content.js',
    output: {
      file: 'dist/content-bundle.js',
      format: 'iife',
      name: 'Euspell',
      sourcemap: true,
    },
    plugins: [nodeResolve()],
  },
  // PDF viewer (ES module — runs as an extension page; bundles PDF.js, the
  // converter, and the DOM walker. The PDF.js worker is shipped separately by
  // build/copy-pdfjs.js and loaded via chrome.runtime.getURL).
  {
    input: 'src/pdf/viewer.js',
    output: {
      file: 'dist/pdf-viewer.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [nodeResolve()],
  },
];
