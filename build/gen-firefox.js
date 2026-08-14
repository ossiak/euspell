// Stage a Firefox (Gecko) build of the extension into build/firefox/ and zip it
// to build/euspell-firefox.zip for AMO upload.
//
// The staged file set is shared with the Chrome packager (build/gen-chrome.js);
// the two builds differ only in the manifest. Firefox needs a tailored one: a
// gecko id (required for signing) and an ES-module background *event page*
// (background.scripts) instead of Chrome's background.service_worker, which
// Firefox reads from the root manifest.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { stageRuntime } from './lib/runtime-files.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build/firefox');

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
    // Marks the add-on installable on Firefox for Android. Without this key AMO
    // signs it desktop-only and the listing shows no Android install button, no
    // matter how well the code runs on a phone. The empty object means "every
    // Android version Firefox supports" — the real floor is gecko's
    // strict_min_version above, which applies to both platforms. (gecko_android
    // is unknown to Firefox < 78; harmless here, the floor is already 128.)
    gecko_android: {},
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

stageRuntime(root, out);

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(toFirefox(manifest), null, 2)}\n`);

const zip = new AdmZip();
zip.addLocalFolder(out);
const zipPath = join(root, 'build/euspell-firefox.zip');
zip.writeZip(zipPath);

console.log('[euspell-build] Staged Firefox build -> build/firefox/ and zipped -> build/euspell-firefox.zip');
