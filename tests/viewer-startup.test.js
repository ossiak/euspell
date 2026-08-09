// What the viewer does when it cannot start.
//
// Opening the document is guarded, and each page's render is guarded, but
// everything BETWEEN them ran unguarded: page 1's viewport, the placeholder
// layout, the observers, the bar. A throw there became an unhandled rejection
// behind a blank grey page — the loading line had already been removed, so the
// viewer showed nothing and said nothing about why.
//
// viewer.js pulls in pdf.js and cannot be imported outside a browser, so the
// reporting function is lifted out of the source and run against stubs (the
// technique ui.test.js and content-mode.test.js use on whole scripts); the
// wiring around it is asserted against the source itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync(new URL('../src/pdf/viewer.js', import.meta.url), 'utf8');

/** The real setStatus body, bound to stub elements. */
function loadSetStatus({ status, root }) {
  const src = /function setStatus\([\s\S]*?\n\}/.exec(js);
  assert.ok(src, 'setStatus must be declared at the top level of viewer.js');
  // eslint-disable-next-line no-new-func
  return new Function('status', 'root', 'document', `${src[0]}\nreturn setStatus;`)(
    status, root, { body: null },
  );
}

const mkStatus = (isConnected) => ({ textContent: '', isConnected });
const mkRoot = () => ({
  prepended: [],
  prepend(node) {
    this.prepended.push(node);
    node.isConnected = true;
  },
});

test('a message reaches a status line that is still on the page', () => {
  const status = mkStatus(true);
  const root = mkRoot();
  loadSetStatus({ status, root })('No PDF was specified.');

  assert.equal(status.textContent, 'No PDF was specified.');
  assert.deepEqual(root.prepended, [], 'nothing to re-attach — it never left');
});

test('a message reaches a status line that was already removed', () => {
  // The case that made a late failure invisible: once the document opens the
  // loading line is removed, so writing to it afterwards updated a detached node
  // nobody could see.
  const status = mkStatus(false);
  const root = mkRoot();
  loadSetStatus({ status, root })('Couldn’t display this PDF (bad XRef). You can open the original instead.');

  assert.match(status.textContent, /Couldn’t display this PDF/);
  assert.deepEqual(root.prepended, [status], 'the status line must be put back to be read');
});

test('re-attaching happens once, not on every message', () => {
  const status = mkStatus(false);
  const root = mkRoot();
  const setStatus = loadSetStatus({ status, root });
  setStatus('first');
  setStatus('second');

  assert.equal(status.textContent, 'second');
  assert.equal(root.prepended.length, 1, 'prepend must be guarded by isConnected');
});

test('a build with no status element reports without throwing', () => {
  // An embedding host (Eupub) generates its own shell, so #status may be absent
  // exactly as the bar's controls may be.
  const root = mkRoot();
  assert.doesNotThrow(() => loadSetStatus({ status: null, root })('anything'));
});

test('main() reports its failures instead of rejecting into the void', () => {
  const call = /main\(\)\s*\.catch\(([\s\S]*?)\n\}\);/.exec(js);
  assert.ok(call, 'main() must be called with a .catch');
  assert.match(call[1], /setStatus\(/, 'the reader must be told, not just the console');
  assert.match(call[1], /console\.error\(/, 'and the error must be logged for diagnosis');
});

test('the failure message can honestly point at the escape hatch', () => {
  // "You can open the original instead" is only true if the link is wired up
  // before anything that can fail — it is the one way out of a viewer that
  // cannot render, and the redirect means the address bar cannot offer another.
  const wiring = js.indexOf("getElementById('original')");
  const fetching = js.indexOf('pdfjsLib.getDocument(');
  assert.ok(wiring > 0, 'the Open original link must be wired somewhere');
  assert.ok(fetching > wiring, 'it must be wired BEFORE the document is fetched');

  const call = /main\(\)\s*\.catch\(([\s\S]*?)\n\}\);/.exec(js)[1];
  assert.match(call, /open the original/i, 'the message must name the way out');
});

test('the nav channel is caught separately, being unawaited', () => {
  // setUpNav() is fired and forgotten, so its rejection never reaches main()'s
  // catch. It is auxiliary — the document reads fine with no table of contents —
  // so it must fail quietly rather than take the viewer down.
  const calls = [...js.matchAll(/(?<!function\s)setUpNav\(\)([\s\S]{0,16})/g)];
  assert.ok(calls.length > 0, 'setUpNav must be called');
  for (const c of calls) {
    assert.match(c[1], /\.catch\(/, 'every setUpNav() call needs its own catch');
  }
});
