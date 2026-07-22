// The Firefox build stages an explicit FILES list rather than copying the tree,
// so adding a module that the popup/options/service-worker imports is a
// two-place change. Forgetting the second place breaks Firefox alone, at
// runtime, with a bare-module resolution error nobody sees until they load the
// add-on — Chrome keeps working, because it loads the repo root directly.
//
// Rather than test the staged output (which requires having run the build), read
// the FILES list and check that every relative import reachable from it is
// listed too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const src = fs.readFileSync(new URL('build/gen-firefox.js', root), 'utf8');

/** The FILES array, as literal paths. */
function stagedFiles() {
  const block = /const FILES = \[([\s\S]*?)\n\];/.exec(src);
  assert.ok(block, 'gen-firefox.js must declare a FILES array');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('every module the Firefox build stages has its imports staged too', () => {
  const files = new Set(stagedFiles());
  const missing = [];
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    const full = new URL(file, root);
    if (!fs.existsSync(full)) continue; // generated bundles may not be built yet
    const text = fs.readFileSync(full, 'utf8');
    for (const m of text.matchAll(/from\s+'(\.[^']+)'/g)) {
      const dep = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1]));
      if (!files.has(dep)) missing.push(`${file} imports ${m[1]} → ${dep} is not in FILES`);
    }
  }
  assert.deepEqual(missing, []);
});
