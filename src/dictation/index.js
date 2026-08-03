// Dictation controller for the browser extension: speech -> standard English ->
// euspell -> inserted at the caret. See docs/dictation.md for the design.
//
// The recognizer only ever yields standard English; the euspell respelling is
// done by the reader's own engine (convertText routes an utterance through the
// exact same block pipeline the page reader uses), so dictation reuses all of
// the disambiguation rules and adds no spelling logic of its own.

import { convert } from '../content/converter.js';
import { convertText } from '../content/dom-walker.js';
import { normalize } from './normalize.js';
import { ensureLexicon } from '../content/lexicon-load.js';
import { insertText, isEditableTarget } from './insert.js';
import { createRecognizer, isSupported } from './recognizer.js';
import { createOverlay } from './overlay.js';
import { browser } from '../lib/browser.js';

// Recognizer errors that mean "can't listen at all" — stop rather than restart.
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

const ERROR_MESSAGE = {
  'not-allowed': 'Microphone blocked — allow mic access for this site.',
  'service-not-allowed': 'Microphone blocked — allow mic access for this site.',
  'audio-capture': 'No microphone found.',
  network: 'Speech service unavailable.',
};

// The editable most recently focused, used as the insertion target when
// dictation is started from the popup (which takes focus off the page, so
// document.activeElement is no longer the field at start time).
/** @type {HTMLElement | null} */
let lastEditable = null;
document.addEventListener(
  'focusin',
  (e) => {
    if (isEditableTarget(/** @type {Element} */ (e.target))) lastEditable = /** @type {HTMLElement} */ (e.target);
  },
  true,
);

let active = false;
let stoppedByUser = false;
/**
 * Identity of the listening session that currently owns the recognizer.
 *
 * A recognizer keeps delivering events after it has been asked to stop —
 * `onend` in particular arrives asynchronously — so a stop followed quickly by
 * a start leaves the OLD session's callbacks firing while the NEW one is live.
 * Without an identity to check they act on module state that no longer belongs
 * to them: the old onEnd saw `active && !stoppedByUser`, restarted what it
 * thought was its own recognizer (in fact the new one, already started), got
 * InvalidStateError, and ran finish() — clearing the state and hiding the pill
 * while the new session's microphone stayed open and kept inserting text.
 * @type {object | null}
 */
let currentSession = null;
/** Delayed overlay-hide from a failOut, cancelled if a new session starts. */
let hideTimer = 0;
/** @type {ReturnType<typeof createRecognizer> | null} */
let recognizer = null;
/** @type {ReturnType<typeof createOverlay> | null} */
let overlay = null;
/** @type {HTMLElement | null} */
let target = null;

function ui() {
  return (overlay ??= createOverlay());
}

/** The element to insert into: the focused editable if any, else the captured target. */
function insertionTarget() {
  const focused = document.activeElement;
  return isEditableTarget(focused) ? /** @type {HTMLElement} */ (focused) : target;
}

function handleFinal(transcript) {
  const euspell = convertText(normalize(transcript), convert);
  const dest = insertionTarget();
  if (dest) insertText(dest, euspell.endsWith(' ') ? euspell : euspell + ' ');
  ui().show('Listening…');
}

function start() {
  if (active) return;
  if (!isSupported()) {
    ui().error('Speech recognition is not available in this browser.');
    return;
  }
  const focused = document.activeElement;
  target = isEditableTarget(focused) ? /** @type {HTMLElement} */ (focused) : lastEditable;
  if (!target) {
    ui().error('Click into a text field, then start dictation.');
    return;
  }

  // The lexicon loads lazily (a page on a disabled site never fetches it), and
  // dictation converts text — so start the load now, in parallel with the mic
  // spin-up; it lands well inside the seconds before a first final result. On
  // failure dictated text stays in standard spelling (lookups just miss).
  ensureLexicon().catch(() => {});

  stoppedByUser = false;
  clearTimeout(hideTimer); // a pending failOut hide must not kill this session's pill
  // This session's identity, checked by every callback below so a superseded
  // recognizer's late events can never act on its successor's state.
  const session = {};
  currentSession = session;
  const mine = () => currentSession === session;
  // Circuit breaker for the restart-on-end loop below: a persistent failure
  // (e.g. 'network' while offline) otherwise cycles error → end → restart
  // forever. Consecutive errors trip it; any successful result resets it.
  // 'no-speech' is just Chrome's silence timeout, so it never counts.
  let consecutiveErrors = 0;
  recognizer = createRecognizer({
    onInterim: (text) => {
      if (!mine()) return;
      consecutiveErrors = 0;
      ui().show(text);
    },
    onFinal: (transcript) => {
      if (!mine()) return;
      consecutiveErrors = 0;
      handleFinal(transcript);
    },
    onError: (error) => {
      if (!mine()) return;
      if (error === 'aborted') return; // our own stop()
      if (error !== 'no-speech') consecutiveErrors++;
      if (ERROR_MESSAGE[error]) ui().error(ERROR_MESSAGE[error]);
      if (FATAL.has(error)) failOut();
    },
    onEnd: () => {
      if (!mine()) return;
      // Chrome ends a session after silence or its own time limit; keep the
      // mic open while the user still wants it, unless a fatal error stopped
      // us or errors keep recurring with no successful result between them.
      if (active && !stoppedByUser && consecutiveErrors < 3) {
        try {
          recognizer.start();
        } catch {
          finish();
        }
      } else if (active) {
        failOut();
      }
    },
  });

  try {
    recognizer.start();
  } catch {
    currentSession = null; // never listened, so it owns nothing
    recognizer = null;
    ui().error('Could not start dictation.');
    return;
  }
  active = true;
  ui().show('Listening…');
}

/** Stop at the user's request (or on a fatal error). */
function stop() {
  if (!active) return;
  stoppedByUser = true;
  try {
    recognizer?.stop();
  } catch {
    /* already stopped */
  }
  finish();
}

/** Tear down listening state and hide the overlay. */
function finish() {
  active = false;
  currentSession = null; // the recognizer's remaining events are now nobody's
  recognizer = null;
  overlay?.hide();
}

/**
 * Stop because of an error, leaving the error pill visible long enough to read
 * (a user-initiated stop hides it immediately via finish()).
 */
function failOut() {
  stoppedByUser = true;
  try {
    recognizer?.stop();
  } catch {
    /* already stopped */
  }
  active = false;
  currentSession = null;
  recognizer = null;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => overlay?.hide(), 4000);
}

function toggle() {
  if (active) stop();
  else start();
  return active;
}

/**
 * Installs the dictation message listener. Started/stopped from the popup button
 * or the keyboard command (both routed as runtime messages). Safe to call once
 * per content-script load; independent of the page-conversion state.
 */
export function initDictation() {
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'euspell:dictation:toggle') {
      sendResponse({ active: toggle(), supported: isSupported() });
    } else if (msg.type === 'euspell:dictation:status') {
      sendResponse({ active, supported: isSupported() });
    }
  });
}
