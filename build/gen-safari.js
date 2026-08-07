// Stage the Safari (WebKit) web extension straight into the committed Xcode
// project at safari/Euspell Extension/Resources/. Running `npm run build:safari`
// refreshes the app's extension payload in place — no converter step needed for
// day-to-day updates.
//
// Unlike Chrome (which loads the repo root directly) and Firefox (which needs a
// tailored gecko manifest — see build/gen-firefox.js), Safari accepts the
// Chrome MV3 manifest essentially verbatim:
//   - Safari 16.4+ runs an MV3 `background.service_worker` (incl. ES modules),
//     so no background rewrite is needed.
//   - `browser.*` is the native namespace on Safari, which src/lib/browser.js
//     already prefers over `chrome.*`.
// We stage an explicit allowlist (not the whole repo / whole dist/) for the same
// reason as Firefox: dist/ is shared output holding artifacts for other targets
// — the 13 MB standalone lexicon.js, the sqlite lexicon, the hunspell .aff/.dic
// — none of which the web extension loads, so they must not bloat the app bundle.
//
// The Resources folder is gitignored (regenerable), exactly like dist/ at the
// repo root. Xcode references dist/, src/, icons/ inside it as *folder*
// references, so it copies whatever we drop here at build time — a fresh clone
// just needs `npm run build:safari` before the first Xcode build.
//
// The one-time Xcode host-app wrapper was generated with (kept for reference —
// only needed to regenerate the whole project from scratch, which would reset
// the signing config):
//   xcrun safari-web-extension-converter <staged-dir> \
//     --macos-only --app-name Euspell --bundle-identifier org.euspell.Euspell \
//     --swift --copy-resources --no-open --no-prompt
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'safari/Euspell Extension/Resources');

// Runtime files, relative to the repo root — kept in sync with gen-firefox.js's
// allowlist. Every path here is reachable from the manifest: the content
// bundle, the PDF viewer bundle, the shared lexicon.data, the raw ES modules
// the service worker / popup / options pages import directly (not bundled), and
// the popup/options/onboarding/viewer HTML + CSS + icons.
const FILES = [
  // Both icon states: the service worker swaps to the "-off" set when
  // conversion is off. Omitting them fails silently — setIcon does nothing on a
  // path it can't load — so the indicator would just never change.
  'icons/16.png', 'icons/48.png', 'icons/128.png',
  'icons/16-off.png', 'icons/48-off.png', 'icons/128-off.png',
  'dist/content-bundle.js',
  'dist/pdf-viewer.js',
  'dist/lexicon.data',
  // The popup's lookup imports the three small tables outright rather than
  // fetching them; they are ~53 KB together, against 12 MB for the lexicon.
  'dist/abbreviations.js', 'dist/contractions.js', 'dist/phrases.js',
  'src/lib/browser.js',
  // The on/off toolbar-icon logic, imported by the service worker, popup and
  // options page. Not bundled — those are loaded as raw ES modules — so it must
  // be staged or every one of them throws on the missing import.
  'src/lib/action-icon.js',
  'src/background/service-worker.js',
  'src/pdf/pdf-url.js', 'src/pdf/viewer.html', 'src/pdf/viewer.css',
  'src/popup/popup.html', 'src/popup/popup.js', 'src/popup/popup.css',
  'src/popup/lookup.js', 'src/popup/render.js', 'src/popup/encodings.js',
  'src/options/options.html', 'src/options/options.js', 'src/options/options.css',
  'src/onboarding/onboarding.html', 'src/onboarding/onboarding.js', 'src/onboarding/onboarding.css',
];

// Directory trees copied whole (the PDF.js worker, wasm decoders, and fonts).
const DIRS = ['dist/pdfjs'];

/** Adapt the Chrome manifest for Safari (currently near-identity). */
function toSafari(manifest) {
  const m = structuredClone(manifest);
  // Source maps are dev-only and not staged, so drop any web_accessible_resources
  // entry that would point at a missing .map (defensive — the Chrome manifest
  // lists none today, but this keeps us honest if one is ever added).
  for (const war of m.web_accessible_resources ?? []) {
    war.resources = war.resources.filter((r) => !r.endsWith('.map'));
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
writeFileSync(join(out, 'manifest.json'), JSON.stringify(toSafari(manifest), null, 2) + '\n');

console.log('[euspell-build] Staged Safari web extension -> safari/Euspell Extension/Resources/');
console.log('[euspell-build] Build the app: open safari/Euspell.xcodeproj in Xcode (or xcodebuild).');
