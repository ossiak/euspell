// Thin wrapper over the browser's Web Speech recognizer. It produces *standard
// English* — never euspell — which the caller then converts; the recognizer has
// no knowledge of the reform (see docs/dictation.md). Chromium exposes the API
// as webkitSpeechRecognition; there is no standard SpeechRecognition yet.

const Impl = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;

/** True when this browser exposes a Web Speech recognizer at all. */
export function isSupported() {
  return typeof Impl === 'function';
}

/**
 * Creates a recognizer bound to the given callbacks.
 *
 * Only *final* results are converted and inserted — interim results rewrite
 * themselves as the engine revises its guess, so converting them would show
 * half-respelled churn; they are surfaced via onInterim purely as a live preview.
 * `continuous` keeps the session open across pauses so a user can dictate several
 * sentences; onEnd fires when the session actually stops (and the caller can
 * restart it if it ended unintentionally while still listening).
 *
 * @param {{
 *   lang?: string,
 *   onInterim?: (text: string) => void,
 *   onFinal?: (text: string) => void,
 *   onError?: (error: string) => void,
 *   onEnd?: () => void,
 * }} handlers
 */
export function createRecognizer({ lang = 'en-US', onInterim, onFinal, onError, onEnd } = {}) {
  if (!isSupported()) throw new Error('Web Speech recognition is not available');

  const recognition = new Impl();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      if (result.isFinal) onFinal?.(transcript);
      else interim += transcript;
    }
    if (interim) onInterim?.(interim);
  };

  recognition.onerror = (event) => onError?.(event.error);
  recognition.onend = () => onEnd?.();

  return {
    start() {
      recognition.start();
    },
    stop() {
      recognition.stop();
    },
  };
}
