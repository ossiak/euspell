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
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageRuntime } from './lib/runtime-files.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'safari/Euspell Extension/Resources');

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

stageRuntime(root, out);

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(toSafari(manifest), null, 2)}\n`);

console.log('[euspell-build] Staged Safari web extension -> safari/Euspell Extension/Resources/');
console.log('[euspell-build] Build the app: open safari/Euspell.xcodeproj in Xcode (or xcodebuild).');
