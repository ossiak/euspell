import { nodeResolve } from '@rollup/plugin-node-resolve';
import { fileURLToPath } from 'node:url';

// Mobile PDF-viewer build: the same entry as rollup.config.js's PDF bundle, with
// two resolver aliases that swap the extension's host assumptions for a WebView
// host's (Eupub Android). Nothing else differs.
//
// It lives HERE rather than in Eupub because viewer.js imports the bare specifier
// 'pdfjs-dist/build/pdf.min.mjs', and pdfjs-dist is a devDependency of this repo,
// not Eupub's. Building it from Eupub would only resolve by nodeResolve walking up
// into this repo's node_modules — an undeclared cross-repo dependency. Eupub
// consumes the built artifact instead (android/prepare-assets.mjs), the same way
// it already shells out to build/compile-lexicon-sqlite.mjs for the lexicon.

// 1. No baked-in lexicon: the ~14 MB compiled Map is never referenced, so it
//    tree-shakes out. The host installs each page's subset instead, fetched from
//    the on-disk SQLite lexicon. Both consumers (converter.js, tagger.js) plus
//    host.mobile.js import "./lexicon-source.js" — this catches every specifier,
//    so they all share one module instance and setLexicon() is visible to lookups.
const MOBILE_LEXICON_SOURCE = fileURLToPath(
  new URL('src/content/lexicon-source.mobile.js', import.meta.url),
);

// 2. No extension APIs: assets resolve against the host's asset route and the
//    lexicon comes through the host bridge, rather than chrome.runtime.getURL and
//    a 12.8 MB resident table.
const MOBILE_HOST = fileURLToPath(new URL('src/pdf/host.mobile.js', import.meta.url));

const aliasMobile = {
  name: 'euspell-pdf-mobile-alias',
  resolveId(source, importer) {
    if (!importer) return null;
    if (/(^|[\\/])lexicon-source\.js$/.test(source)) return MOBILE_LEXICON_SOURCE;
    // Only viewer.js imports ./host.js; guard on the filename so host.mobile.js's
    // own imports can never be caught by this.
    if (/(^|[\\/])host\.js$/.test(source)) return MOBILE_HOST;
    return null;
  },
};

export default {
  input: 'src/pdf/viewer.js',
  output: {
    file: 'dist/pdf-viewer.mobile.js',
    format: 'es',
    sourcemap: false,
  },
  plugins: [aliasMobile, nodeResolve()],
};
