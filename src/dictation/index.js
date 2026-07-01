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
import { insertText, isEditableTarget } from './insert.js';
import { createRecognizer, isSupported } from './recognizer.js';
import { createOverlay } from './overlay.js';

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

  stoppedByUser = false;
  recognizer = createRecognizer({
    onInterim: (text) => ui().show(text),
    onFinal: handleFinal,
    onError: (error) => {
      if (error === 'aborted') return; // our own stop()
      if (ERROR_MESSAGE[error]) ui().error(ERROR_MESSAGE[error]);
      if (FATAL.has(error)) stop();
    },
    onEnd: () => {
      // Chrome ends a session after silence or its own time limit; keep the
      // mic open while the user still wants it, unless a fatal error stopped us.
      if (active && !stoppedByUser) {
        try {
          recognizer.start();
        } catch {
          finish();
        }
      }
    },
  });

  try {
    recognizer.start();
  } catch {
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
  recognizer = null;
  overlay?.hide();
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
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'euspell:dictation:toggle') {
      sendResponse({ active: toggle(), supported: isSupported() });
    } else if (msg.type === 'euspell:dictation:status') {
      sendResponse({ active, supported: isSupported() });
    }
  });
}
