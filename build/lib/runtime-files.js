// The extension's runtime file set, shared by the Chrome and Firefox packagers.
//
// Kept in one place because the two builds ship the SAME files and differ only
// in the manifest: a file added to one and forgotten in the other produces a
// store build that is broken on that browser alone, which no test here catches.
//
// It is an explicit allowlist rather than "copy the tree" because dist/ is
// shared output holding artifacts for other targets — the 4.6 MB sqlite lexicon,
// the 13 MB standalone lexicon.js, the hunspell .aff/.dic — none of which the
// web extension loads (the bundles fetch dist/lexicon.data at runtime). Copying
// dist/ wholesale would multiply the upload several times over.
import { mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Every path here is reachable from the manifest: the content bundle, the PDF
// viewer bundle, the raw ES modules the service worker / popup / options pages
// import (they are loaded directly, not bundled), and the popup/options/viewer
// HTML + CSS + icons.
export const FILES = [
  // Both icon states: the service worker swaps to the "-off" set when
  // conversion is switched off, so omitting them breaks the indicator —
  // setIcon fails silently on a missing path.
  'icons/16.png', 'icons/48.png', 'icons/128.png',
  'icons/16-off.png', 'icons/48-off.png', 'icons/128-off.png',
  'dist/content-bundle.js',
  'dist/pdf-viewer.js',
  'dist/lexicon.data',
  // The popup's lookup imports the three small tables outright rather than
  // fetching them; they are ~53 KB together, against 13 MB for the lexicon.
  'dist/abbreviations.js', 'dist/contractions.js', 'dist/phrases.js',
  'src/lib/browser.js',
  'src/lib/action-icon.js',
  'src/background/service-worker.js',
  'src/pdf/pdf-url.js', 'src/pdf/viewer.html', 'src/pdf/viewer.css',
  'src/popup/popup.html', 'src/popup/popup.js', 'src/popup/popup.css',
  'src/popup/lookup.js', 'src/popup/render.js', 'src/popup/encodings.js',
  'src/options/options.html', 'src/options/options.js', 'src/options/options.css',
  'src/onboarding/onboarding.html', 'src/onboarding/onboarding.js', 'src/onboarding/onboarding.css',
];

// Directory trees copied whole (the PDF.js worker, wasm decoders, and fonts).
export const DIRS = ['dist/pdfjs'];

/**
 * Copy FILES + DIRS from the repo root into a clean `out` directory.
 * Exits non-zero listing everything absent, rather than producing a package
 * that is quietly missing a file — a store upload is expensive to redo.
 */
export function stageRuntime(root, out) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const missing = [];
  for (const rel of FILES) {
    const from = join(root, rel);
    if (!existsSync(from)) { missing.push(rel); continue; }
    const to = join(out, rel);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
  }
  if (missing.length) {
    console.error(
      `[euspell-build] Missing runtime files (run "npm run build" first):\n  ${missing.join('\n  ')}`,
    );
    process.exit(1);
  }

  for (const rel of DIRS) {
    cpSync(join(root, rel), join(out, rel), { recursive: true });
  }
}
