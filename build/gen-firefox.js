// Stage a Firefox (Gecko) build of the extension into build/firefox/ and zip it
// to build/euspell-firefox.zip for AMO upload.
//
// Chrome loads the repo root directly (manifest.json + src/ + dist/ + icons/).
// Firefox needs two things Chrome doesn't:
//   1. A tailored manifest — a gecko id (required for signing) and an ES-module
//      background *event page* (background.scripts) instead of Chrome's
//      background.service_worker, which Firefox reads from the root manifest.
//   2. Only the extension's own runtime files. dist/ is shared output that also
//      holds artifacts for other targets — the 4.6 MB sqlite lexicon, the 14 MB
//      standalone lexicon.js, the hunspell .aff/.dic — none of which the web
//      extension loads (the bundles fetch their lexicon from dist/lexicon.data
//      at runtime — staged below). Copying dist/ wholesale would bloat the xpi
//      ~4x, so we stage an explicit allowlist instead.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build/firefox');

// Runtime files, relative to the repo root. Every path here is reachable from
// the manifest: the content bundle, the PDF viewer bundle, the raw ES modules
// the service worker / popup / options pages import (they are loaded directly,
// not bundled), and the popup/options/viewer HTML + CSS + icons.
const FILES = [
  // Both icon states: the service worker swaps to the "-off" set when
  // conversion is switched off, so omitting them breaks the indicator on
  // Firefox only — setIcon fails silently on a missing path.
  'icons/16.png', 'icons/48.png', 'icons/128.png',
  'icons/16-off.png', 'icons/48-off.png', 'icons/128-off.png',
  'dist/content-bundle.js',
  'dist/pdf-viewer.js',
  'dist/lexicon.data',
  'src/lib/browser.js',
  'src/lib/action-icon.js',
  'src/background/service-worker.js',
  'src/pdf/pdf-url.js', 'src/pdf/viewer.html', 'src/pdf/viewer.css',
  'src/popup/popup.html', 'src/popup/popup.js', 'src/popup/popup.css',
  'src/options/options.html', 'src/options/options.js', 'src/options/options.css',
  'src/onboarding/onboarding.html', 'src/onboarding/onboarding.js', 'src/onboarding/onboarding.css',
];

// Directory trees copied whole (the PDF.js worker, wasm decoders, and fonts).
const DIRS = ['dist/pdfjs'];

/** Turn the Chrome manifest into a Gecko one (non-destructive). */
function toFirefox(manifest) {
  const m = structuredClone(manifest);
  m.browser_specific_settings = {
    gecko: {
      // Placeholder id — change to your own AMO listing id before publishing.
      id: 'euspell@euspell.org',
      // 128 (the current ESR line) is the real floor, for two reasons: the
      // bundled PDF.js v6 uses Promise.withResolvers (Firefox 121+), and
      // before 128 Firefox treated MV3 host_permissions as opt-in — an AMO
      // install there would never run the content script and look dead.
      strict_min_version: '128.0',
      // NOTE: `data_collection_permissions` is intentionally omitted. It only
      // exists in the manifest schema from Firefox 140+, so including it makes
      // the add-on fail to load on anything older ("unexpected property
      // data_collection_permissions"). AMO wants that key for new listings, so
      // add it back — and raise strict_min_version to 140 — when you publish,
      // building against a 140+ baseline. See https://mzl.la/firefox-builtin-data-consent.
    },
  };
  // Firefox has no extension service worker; it runs the MV3 background as a
  // non-persistent ES-module event page. Chrome keeps using the root manifest's
  // background.service_worker.
  m.background = { scripts: ['src/background/service-worker.js'], type: 'module' };
  // The bundles' .map files are dev-only and not shipped (see below), so drop the
  // web_accessible_resources entry that would otherwise point at a missing file.
  // use_dynamic_url is Chrome's anti-fingerprinting serving mode (Chrome 130+);
  // Firefox doesn't know the key — and doesn't need it, since moz-extension
  // origins are per-install UUIDs already — so drop it too.
  for (const war of m.web_accessible_resources ?? []) {
    war.resources = war.resources.filter((r) => !r.endsWith('.map'));
    delete war.use_dynamic_url;
  }
  return m;
}

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

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
writeFileSync(join(out, 'manifest.json'), JSON.stringify(toFirefox(manifest), null, 2) + '\n');

const zip = new AdmZip();
zip.addLocalFolder(out);
const zipPath = join(root, 'build/euspell-firefox.zip');
zip.writeZip(zipPath);

console.log('[euspell-build] Staged Firefox build -> build/firefox/ and zipped -> build/euspell-firefox.zip');
