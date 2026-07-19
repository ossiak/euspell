// Shapes a raw speech-recognition transcript into the text the euspell converter
// expects. The converter's correctness depends on sentence shape: it reads
// sentence boundaries from ./!/? in the separator stream and keys the pronoun
// "I" -> "Ih"/"ih" (and its own case matching) off capitalization. A raw
// transcript from the Web Speech API is largely lowercase and unpunctuated, so
// without this step the whole utterance is one run-on "sentence" with the wrong
// windows and the wrong sentence-initial handling.
//
// This is a pure string -> string transform with no DOM or recognizer
// dependency, so it is unit-tested on its own (tests/dictation/normalize.test.js).

// Spoken punctuation commands -> the mark they insert. Ordered longest-first so
// "new paragraph" is consumed before "new line", and multi-word names before
// their single-word prefixes. This shares dictation's inherent ambiguity: a
// literal spoken word "period"/"comma" becomes a mark — a known trade-off every
// dictation tool makes, documented here rather than worked around.
const SPOKEN = [
  [/\bnew paragraph\b/gi, '\n\n'],
  [/\bnew line\b/gi, '\n'],
  [/\bfull stop\b/gi, '.'],
  [/\bperiod\b/gi, '.'],
  [/\bquestion mark\b/gi, '?'],
  [/\bexclamation (?:mark|point)\b/gi, '!'],
  [/\bsemicolon\b/gi, ';'],
  [/\bcolon\b/gi, ':'],
  [/\bcomma\b/gi, ','],
  [/\b(?:hyphen|dash)\b/gi, '-'],
];

// A letter that opens a sentence: the very start, after a sentence-ending mark
// and its trailing space, or after a newline. Its first letter is capitalized.
const SENTENCE_OPENER = /(^|[.!?]\s+|\n[ \t]*)([a-z])/g;

/**
 * Normalizes a recognized transcript for the converter: applies spoken
 * punctuation, tightens spacing around marks, uppercases the standalone pronoun
 * "i", and capitalizes each sentence's first letter.
 *
 * @param {string} transcript  a final recognition result
 * @returns {string}
 */
export function normalize(transcript) {
  let text = transcript;

  for (const [pattern, mark] of SPOKEN) {
    text = text.replace(pattern, mark);
  }

  // Drop any space the recognizer (or a spoken-mark substitution) left before a
  // punctuation mark: "hello . world" -> "hello. world".
  text = text.replace(/[ \t]+([,.!?;:])/g, '$1');
  // Collapse runs of spaces/tabs, but never across newlines.
  text = text.replace(/[ \t]{2,}/g, ' ');
  // Trim spaces around newlines and leading/trailing whitespace.
  text = text.replace(/[ \t]*\n[ \t]*/g, '\n').trim();

  // The converter maps the pronoun only when it sees exactly "I" (uppercase);
  // recognizers sometimes emit a lowercase "i". Do this before capitalization so
  // a sentence-initial "i" isn't handled twice. The lookahead skips an "i" that
  // opens an abbreviation ("i.e.") — that's not the pronoun; a genuine
  // sentence-final "i." is followed by space or end, not a letter.
  text = text.replace(/\bi\b(?!\.\p{L})/gu, 'I');

  text = text.replace(SENTENCE_OPENER, (_m, lead, letter) => lead + letter.toUpperCase());

  return text;
}
