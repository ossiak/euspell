// The Firefox and Safari builds both stage an explicit FILES list rather than
// copying the tree, so adding a module that the popup/options/service-worker
// imports is a two-place change. Forgetting the second place breaks that target
// alone, at runtime, with a bare-module resolution error nobody sees until they
// load the add-on — Chrome keeps working, because it loads the repo root
// directly. The -off toolbar icons carry the same silent-failure risk (setIcon
// does nothing on a path it can't load, so the indicator just never changes).
//
// Rather than test the staged output (which requires having run the build), read
// each build's FILES list and check that every relative import reachable from it
// is listed too. The two scripts also document being kept in sync, so assert
// that as well — that drift is exactly what once left the Safari list missing
// action-icon.js and the -off icons while Firefox had them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../', import.meta.url);

const BUILDS = [
  { name: 'Firefox', script: 'build/gen-firefox.js' },
  { name: 'Safari', script: 'build/gen-safari.js' },
];

/** The FILES array from a build script, as literal paths. */
function stagedFiles(script) {
  const src = fs.readFileSync(new URL(script, root), 'utf8');
  const block = /const FILES = \[([\s\S]*?)\n\];/.exec(src);
  assert.ok(block, `${script} must declare a FILES array`);
  // Strip line comments first: a comment inside the block may contain an
  // apostrophe (e.g. "a path it can't load") that would otherwise be mistaken
  // for a string delimiter and swallow the real path that follows.
  const body = block[1].replace(/\/\/.*$/gm, '');
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

for (const { name, script } of BUILDS) {
  test(`every module the ${name} build stages has its imports staged too`, () => {
    const files = new Set(stagedFiles(script));
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
}

test('the Firefox and Safari builds stage the same runtime allowlist', () => {
  // Both scripts are documented as kept in sync; the Safari list falling behind
  // is what motivated this guard. If a target ever legitimately needs a file the
  // other doesn't, replace this exact match with per-target expectations rather
  // than deleting the check.
  const [firefox, safari] = BUILDS.map((b) => stagedFiles(b.script).sort());
  assert.deepEqual(safari, firefox);
});

/* --------------------------------------------------------------- word manifest */

test('the Word manifest points at the dev server, not a published host', () => {
  // pages.yml publishes word-addin/ and rewrites this file to the Pages origin at
  // deploy time, by replacing the literal https://localhost:3000. Committing a
  // rewritten copy back breaks that in the quietest possible way: the replacement
  // then matches nothing and silently succeeds, while Word loads the hosted copy
  // and ignores the dev server the install guides tell you to run — so editing
  // local files appears to do nothing. That is exactly what happened in ddd4623,
  // whose subject was about the spell checker, and it went unnoticed for months.
  const xml = fs.readFileSync(new URL('word-addin/manifest.xml', root), 'utf8');

  assert.ok(
    xml.includes('https://localhost:3000'),
    'manifest.xml must carry the localhost URLs pages.yml rewrites — a published copy has been committed back',
  );

  // SourceLocation is the one Word actually loads, so pin it by name rather than
  // trusting the count above.
  const source = /<SourceLocation DefaultValue="([^"]+)"/.exec(xml)?.[1];
  assert.equal(source, 'https://localhost:3000/src/taskpane.html');
});

/* -------------------------------------------------------------------- version */

const readJson = (rel) => JSON.parse(fs.readFileSync(new URL(rel, root), 'utf8'));

test('manifest.json and package.json agree on the version', () => {
  // manifest.json is the version users and both stores see; package.json is the
  // one npm bumps. Nothing else ties them together, and they sat at 0.2.0 through
  // fifty-odd commits — two features, a new opt-out, redrawn icons and a respelled
  // lexicon — because a stale version breaks nothing locally and is invisible
  // until two different builds claim the same number in a bug report.
  assert.equal(readJson('manifest.json').version, readJson('package.json').version);
});

test('the version is one the stores will accept', () => {
  // Chrome requires one to four dot-separated integers, each 0–65535, and no
  // pre-release suffix: "0.3.0-beta" is rejected at upload, having passed every
  // test here. AMO is laxer but refuses a version it has already accepted, and
  // neither store lets you replace one — so a bad version costs a number.
  const { version } = readJson('manifest.json');
  const parts = version.split('.');
  assert.match(version, /^\d+(\.\d+){0,3}$/, `"${version}" is not a plain dotted-integer version`);
  assert.ok(parts.length <= 4, `"${version}" has more than four parts`);
  for (const p of parts) {
    assert.ok(Number(p) <= 65535, `"${version}" has a part above 65535`);
    assert.ok(!/^0\d/.test(p), `"${version}" has a zero-padded part, which Chrome rejects`);
  }
});
