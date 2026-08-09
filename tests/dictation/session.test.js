// Dictation session ownership. A recognizer keeps delivering events after it has
// been asked to stop — `onend` in particular arrives asynchronously — so stopping
// and restarting quickly leaves an OLD session's callbacks firing while a NEW one
// is live. They ran against module state that was no longer theirs, and the
// damage was silent: the pill said "stopped" while the microphone stayed open.
//
// Runs the real dictation controller with its imports stripped and mocks
// injected, the same way ui.test.js runs the popup and content-mode.test.js the
// content script.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function makeEnv() {
  const state = {
    recognizers: [], // every recognizer created, in order
    inserted: [], // text handed to insertText
    shown: [], // overlay messages
    errors: [], // overlay error messages
    hidden: 0, // overlay hide() calls
    listeners: [], // runtime.onMessage listeners
  };

  // Models the Web Speech API's real behaviour on the point that matters: start()
  // on a recognizer that is already listening throws InvalidStateError. That
  // throw is what the old code turned into a teardown of the wrong session.
  const createRecognizer = (handlers) => {
    const rec = {
      handlers,
      listening: false,
      starts: 0,
      stops: 0,
      start() {
        if (this.listening) throw new Error('InvalidStateError: recognition has already started');
        this.listening = true;
        this.starts++;
      },
      stop() {
        this.listening = false;
        this.stops++;
      },
    };
    state.recognizers.push(rec);
    return rec;
  };

  const env = {
    state,
    // A focused editable, so start() always has an insertion target and never
    // bails with "click into a text field".
    document: { addEventListener() {}, activeElement: { tagName: 'TEXTAREA' } },
    browser: { runtime: { onMessage: { addListener: (fn) => state.listeners.push(fn) } } },
    // The engine seam: dictation converts through the page pipeline, which these
    // tests are not about, so it passes text through unchanged.
    convert: (w) => w,
    convertText: (text) => text,
    normalize: (text) => text,
    ensureLexicon: async () => {},
    insertText: (_target, text) => {
      state.inserted.push(text);
      return true;
    },
    // A target is always available, so start() never bails for want of a field.
    isEditableTarget: (el) => el !== null && el !== undefined,
    createRecognizer,
    isSupported: () => true,
    createOverlay: () => ({
      show: (m) => state.shown.push(m),
      error: (m) => state.errors.push(m),
      hide: () => {
        state.hidden++;
      },
    }),
  };
  return env;
}

/** Load the controller and return its exports, wired to `env`. */
function runController(env) {
  let src = fs.readFileSync(new URL('../../src/dictation/index.js', import.meta.url), 'utf8');
  src = src.replace(/^\s*import\b[\s\S]*?;$/gm, '');
  src = src.replace(/^export /gm, ''); // not a module here — surfaced via the return below
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'document', 'browser', 'convert', 'convertText', 'normalize', 'ensureLexicon',
    'insertText', 'isEditableTarget', 'createRecognizer', 'isSupported', 'createOverlay',
    `${src}\nreturn { initDictation };`,
  );
  const api = factory(
    env.document, env.browser, env.convert, env.convertText, env.normalize, env.ensureLexicon,
    env.insertText, env.isEditableTarget, env.createRecognizer, env.isSupported, env.createOverlay,
  );
  api.initDictation();
  return api;
}

/** Drive the controller the way the popup and the keyboard command do. */
function send(env, type) {
  let reply;
  for (const fn of env.state.listeners) fn({ type }, null, (r) => { reply = r; });
  return reply;
}
const toggle = (env) => send(env, 'euspell:dictation:toggle');
const status = (env) => send(env, 'euspell:dictation:status');

test('a superseded session cannot tear down the one that replaced it', async () => {
  const env = makeEnv();
  runController(env);

  toggle(env); // start session A
  const [a] = env.state.recognizers;
  assert.equal(a.listening, true);

  toggle(env); // the user stops
  assert.equal(a.listening, false);
  assert.equal(status(env).active, false);

  toggle(env); // and immediately starts again — session B
  const b = env.state.recognizers[1];
  assert.ok(b && b !== a, 'a second recognizer was created');
  assert.equal(b.listening, true);

  // Only NOW does session A's end event arrive. Before the session guard it saw
  // a live session with stoppedByUser cleared, called start() on what it thought
  // was its own recognizer — in fact B, already listening — and turned the
  // resulting InvalidStateError into finish(), which cleared the state and hid
  // the pill while B's microphone stayed open.
  a.handlers.onEnd();

  assert.equal(status(env).active, true, 'the live session must still be live');
  assert.equal(b.listening, true, 'and still listening');
  assert.equal(b.starts, 1, 'the stale onEnd must not restart it');
  assert.equal(env.state.recognizers.length, 2, 'nor create a third');
});

test('a superseded session cannot insert text or repaint the pill', async () => {
  const env = makeEnv();
  runController(env);

  toggle(env);
  const [a] = env.state.recognizers;
  toggle(env); // stop
  toggle(env); // start B
  const before = env.state.inserted.length;

  a.handlers.onFinal('late words from the old session');
  a.handlers.onInterim('and a late preview');

  assert.equal(env.state.inserted.length, before, 'a dead session must not write at the caret');
  assert.ok(
    !env.state.shown.includes('and a late preview'),
    'nor push its transcript into the live session’s pill',
  );
});

test('a stopped session that is never restarted stays stopped', async () => {
  // The plain case the guard must not break: stop, then the end event arrives
  // with nothing having replaced it.
  const env = makeEnv();
  runController(env);

  toggle(env);
  const [a] = env.state.recognizers;
  toggle(env);
  a.handlers.onEnd();

  assert.equal(status(env).active, false);
  assert.equal(env.state.recognizers.length, 1, 'no phantom restart');
});

test('the live session still restarts itself after a silence timeout', async () => {
  // Chrome ends a continuous session on its own after silence; keeping the mic
  // open across that is the whole point of the restart-on-end path, so the
  // session guard must leave it working.
  const env = makeEnv();
  runController(env);

  toggle(env);
  const [a] = env.state.recognizers;
  a.stop(); // the engine's own timeout, not a user stop
  a.handlers.onEnd();

  assert.equal(a.starts, 2, 'the same recognizer is restarted');
  assert.equal(a.listening, true);
  assert.equal(status(env).active, true);
});

test('a start that throws leaves no session behind', async () => {
  // If start() fails outright there is nothing listening, so no later event may
  // be treated as belonging to a live session.
  const env = makeEnv();
  const realFactory = env.createRecognizer;
  env.createRecognizer = (handlers) => {
    const rec = realFactory(handlers);
    rec.start = () => {
      throw new Error('mic busy');
    };
    return rec;
  };
  runController(env);

  toggle(env);
  assert.equal(status(env).active, false);
  assert.ok(env.state.errors.length > 0, 'the failure is surfaced');

  // A later end event from that dead recognizer must not resurrect anything.
  env.state.recognizers[0].handlers.onEnd();
  assert.equal(status(env).active, false);
});
