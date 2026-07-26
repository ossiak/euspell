// The PDF viewer's toolbar is a two-build contract. The extension needs it:
// redirecting the tab replaces the browser's own PDF chrome, so the page
// readout and the download/print actions exist only because this bar provides
// them. The Eupub/Android build needs it GONE — its generator strips the whole
// <header id="bar"> and the reader supplies its own toolbar.
//
// Both halves break silently. A control added to the markup but never looked up
// simply does nothing; one looked up without a null guard throws in the embedded
// build, where the element was stripped — and that build is not exercised here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../src/pdf/viewer.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../src/pdf/viewer.js', import.meta.url), 'utf8');

/** ids the bar declares */
const barIds = () => {
  const bar = /<header id="bar">([\s\S]*?)<\/header>/.exec(html);
  assert.ok(bar, 'viewer.html must have <header id="bar">');
  return [...bar[1].matchAll(/id="([\w-]+)"/g)].map((m) => m[1]);
};

test('every control in the bar is wired up in viewer.js', () => {
  const unused = barIds().filter((id) => !js.includes(`getElementById('${id}')`));
  assert.deepEqual(unused, [], 'a control nobody looks up is a control that does nothing');
});

test('every bar lookup is null-guarded, for the build that strips the bar', () => {
  // Eupub removes the whole header, so each of these returns null there. The
  // guard is what lets one viewer.js serve both.
  const bad = [];
  for (const id of barIds()) {
    const at = js.indexOf(`getElementById('${id}')`);
    if (at < 0) continue;
    // The lookup must be captured and tested, not used straight away.
    const line = js.slice(js.lastIndexOf('\n', at) + 1, js.indexOf('\n', at));
    const varName = /(?:const|let)\s+(\w+)\s*=/.exec(line)?.[1];
    if (!varName) { bad.push(`${id}: not assigned to a variable`); continue; }
    const after = js.slice(at);
    const guarded = new RegExp(`if\\s*\\(\\s*${varName}\\s*\\)|${varName}\\?\\.|${varName}\\s*&&`).test(after);
    if (!guarded) bad.push(`${id}: '${varName}' is used without a null check`);
  }
  assert.deepEqual(bad, []);
});

test('the bar stays strippable by the Eupub generator', () => {
  // That build finds the header with this exact non-greedy pattern and throws if
  // it is missing, so nesting another </header> inside would silently truncate.
  const stripped = html.replace(/<header id="bar">[\s\S]*?<\/header>\s*/, '');
  assert.ok(!stripped.includes('id="bar"'), 'the whole bar must come out in one match');
  for (const id of barIds()) {
    assert.ok(!stripped.includes(`id="${id}"`), `${id} must be removed with the bar`);
  }
});
