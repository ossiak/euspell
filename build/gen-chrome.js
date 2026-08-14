// Stage a Chrome build of the extension into build/chrome/ and zip it to
// build/euspell-chrome.zip for Chrome Web Store upload.
//
// Loading the extension locally needs none of this — Chrome reads the repo root
// directly (manifest.json + src/ + dist/ + icons/), which is what
// chrome://extensions "Load unpacked" is pointed at during development. The
// store, though, takes a ZIP, and a ZIP of the repo root would carry
// node_modules/, data/, tests/, the other targets' build output, and the 13 MB
// standalone lexicon.js. So this stages the same allowlist the Firefox build
// uses (build/lib/runtime-files.js) and ships the root manifest verbatim, since
// that manifest already *is* the Chrome one.
//
// After staging, every path the manifest names is verified to exist inside the
// package. A store upload costs a review cycle to redo; a missing popup script
// or icon is exactly the kind of fault that survives a local unpacked load —
// where the file is still there in the repo — and only appears once installed
// from the store.
import { readFileSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { stageRuntime } from './lib/runtime-files.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build/chrome');

/** Every extension-relative path the manifest points at, for the check below. */
function manifestPaths(m) {
  const paths = [
    m.background?.service_worker,
    m.action?.default_popup,
    m.options_ui?.page,
    ...Object.values(m.action?.default_icon ?? {}),
    ...Object.values(m.icons ?? {}),
    ...(m.content_scripts ?? []).flatMap((cs) => [...(cs.js ?? []), ...(cs.css ?? [])]),
  ];
  for (const war of m.web_accessible_resources ?? []) {
    // Resources may be glob patterns; only literal paths can be checked.
    paths.push(...war.resources.filter((r) => !r.includes('*')));
  }
  return paths.filter(Boolean);
}

stageRuntime(root, out);

// Copied byte-for-byte rather than re-serialised: the root manifest IS the
// Chrome manifest, and a reformat would show up as noise in a store diff.
const manifestSrc = join(root, 'manifest.json');
copyFileSync(manifestSrc, join(out, 'manifest.json'));
const manifest = JSON.parse(readFileSync(manifestSrc, 'utf8'));

const declared = manifestPaths(manifest);
const absent = declared.filter((p) => !existsSync(join(out, p)));
if (absent.length) {
  console.error(
    `[euspell-build] manifest.json names files the package does not contain:\n  ${absent.join('\n  ')}\n` +
      'Add them to FILES in build/lib/runtime-files.js.',
  );
  process.exit(1);
}

// build/chrome/ is now a complete unpacked extension in its own right — worth
// loading once via chrome://extensions before uploading the zip beside it.
const zip = new AdmZip();
zip.addLocalFolder(out);
const zipPath = join(root, 'build/euspell-chrome.zip');
zip.writeZip(zipPath);

const mb = (readFileSync(zipPath).length / 1024 / 1024).toFixed(1);
console.log(
  `[euspell-build] Staged Chrome build -> build/chrome/ and zipped -> build/euspell-chrome.zip ` +
    `(${mb} MB, v${manifest.version}, ${declared.length} manifest paths verified)`,
);
