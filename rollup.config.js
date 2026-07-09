import { nodeResolve } from '@rollup/plugin-node-resolve';
import { fileURLToPath } from 'node:url';

// Redirect the baked-in lexicon-source.js to its runtime-loaded variant, so the
// ~14 MB compiled Map is never inlined into these bundles. Both consumers
// (converter.js, tagger.js) and lexicon-load.js import "./lexicon-source.js";
// each fetches the shared dist/lexicon.data once at runtime instead. (Eupub's
// desktop build keeps the baked-in default; only these extension bundles alias.)
const RUNTIME_LEXICON_SOURCE = fileURLToPath(
  new URL('src/content/lexicon-source.runtime.js', import.meta.url),
);
const aliasRuntimeLexicon = {
  name: 'euspell-runtime-lexicon-alias',
  resolveId(source, importer) {
    if (importer && /(^|[\\/])lexicon-source\.js$/.test(source)) return RUNTIME_LEXICON_SOURCE;
    return null;
  },
};

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
    plugins: [aliasRuntimeLexicon, nodeResolve()],
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
    plugins: [aliasRuntimeLexicon, nodeResolve()],
  },
];
