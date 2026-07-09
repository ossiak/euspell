# Dictation for Euspell

A design note.

**Purpose.** Let a user *speak* and have their words inserted **already spelled in
euspell** — an authoring tool, the inverse of the reader. The recognizer produces
ordinary English; the existing euspell converter respells it. This note argues the
feature is small because the hard part (conversion) is already built, and it
specifies the one genuinely new piece: a speech front-end that feeds clean,
sentence-shaped text to `convertText`.

## Why this is not a speech problem

The instinct is that euspell's respellings — `recordz`, `wynd`, `dictatez`, `ih` —
are **non-words to any speech recognizer**, so no engine could ever emit them. That
is true, and it is why dictation must **never ask the recognizer for euspell**. The
pipeline is two stages:

```text
speech → [ASR: standard English] → [euspell convertText] → euspell text
```

The recognizer does what it is good at (standard English, with its own language
model and acoustic training); euspell does the respelling it already does for the
reader. Dictation is therefore a *front-end* bolted onto a converter that exists,
not a phonetic recognizer to be built.

## Why the converter is already enough

The conversion engine is text-in / text-out with no DOM dependency. The reader's
DOM walker is only one driver; there is a second, plain-string entry point already
used by the Word add-in, Google Apps Script, and the test harness:

- **`Euspell.convertText(text)`** / **`revertText(text)`** —
  `word-addin/src/euspell-engine.js`, called from `taskpane.js`, tested in
  `build/test-gas.mjs`.

Underneath it, every stage is a pure string function:

- **`tokenize(text)`** — `src/content/dom-walker.js`: words / separators /
  contractions.
- **`tagWord(word)`** — `src/content/tagger.js`: the lexical CLAWS7 candidate set.
- **`convert(word, tokens, idx)`** — `src/content/converter.js`: context-aware
  respelling with full disambiguation (diatones, heteronyms, semantic rules).

Only `walkTextNodes` is DOM-coupled, and dictation does not use it. So the feature
reduces to: **recognizer → `convertText()` → insert at the caret.** The engine is a
solved dependency, not new work.

## What is actually new

Exactly one component: a **speech front-end** that turns a live recognition stream
into the kind of text `convertText` expects. Three concerns make up that work.

### 1. Sentence-shaped batching — mandatory

The disambiguator reads a fixed ±3-token window (`src/content/context.js`) and
resolves boundaries per block. A word's euspelling can depend on its **right**
context: `records` (noun, `records`) vs `recordz` (verb) is decided by what follows.
Dictation arrives incrementally, so converting a word before its neighbours exist
would pick the wrong spelling.

The rule: **convert only on final results, one sentence (or utterance) at a time.**
Web Speech API emits interim results (show them greyed, unconverted) and then a
`isFinal` result; convert on the final result, buffering to a sentence so
`convertText` sees whole context — the same batching the reader already does per
block. This is the part that makes conversion *correct*, not merely present.

### 2. Punctuation and capitalization — the real code

Web Speech API returns largely **lowercase, unpunctuated** text, but the converter
depends on both:

- Sentence boundaries come from `.!?` in the separator stream
  (`dom-walker.js`, `SENTENCE_BREAK`). No periods ⇒ the whole utterance is one
  sentence ⇒ wrong windows and wrong sentence-initial handling.
- Capitalization drives real decisions — most visibly `I` → `Ih` (sentence-start)
  vs `ih` (`src/content/converter.js`), and case is otherwise preserved by
  `matchCase`.

So the front-end needs a **light pre-normalizer** before `convertText`: map spoken
punctuation ("period", "comma", "new line") to marks, and capitalize
sentence-initial words. This is the main net-new logic; keep it small and testable
as a pure `string → string` step, mirroring how the rest of the engine is written.

### 3. Insertion — a separate, opt-in path

The reader **deliberately never touches editable text**: `isEditable`
(`src/content/dom-walker.js`) rejects `contenteditable` and design-mode nodes,
because reforming what a user types would corrupt their caret. Dictation is the
inverse — it *inserts into* the focused editable element. That makes it a
**distinct authoring path**, not a change to the walker, so there is no conflict
with existing behaviour; it is purely additive. Insert via `execCommand('insertText')`
or a Range write at the caret so native undo works.

## Scope

A first version targets the **browser extension only**, where the engine already
runs and a free, built-in recognizer exists:

- **In scope:** Web Speech API (`webkitSpeechRecognition`) capture; interim/final
  handling; the punctuation/capitalization normalizer; sentence batching through
  `convertText`; caret insertion into the focused editable; a popup/hotkey toggle.
- **Out of scope (first pass):** LibreOffice and Google Apps Script — neither has a
  good in-process recognizer, so they would need an external speech service. The
  Word add-in can follow, reusing the same normalizer inside its webview.

## What it cannot fix

Recognition errors flow straight through. If the ASR hears the wrong homophone
("their" for "there", "to" for "too"), euspell faithfully respells the wrong word —
and because those are `000`/unchanged or independently-spelled words, the euspell
layer neither introduces nor detects the error. `revertText(convertText(x)) === x`
holds, but that only guarantees a clean round-trip of whatever the recognizer
decided, not that the recognizer was right. Set expectations accordingly: euspell
governs *spelling*, never *word choice*.

## Build path

A new module — say `src/dictation/` — with three units mirroring the engine's
pure-function style:

1. **`recognizer.js`** — wraps `webkitSpeechRecognition`: start/stop, continuous
   mode, interim vs final results, error/permission handling.
2. **`normalize.js`** — `string → string`: spoken-punctuation substitution and
   sentence-initial capitalization, producing text shaped for the converter. Unit-
   tested in isolation (no mic, no DOM), like the disambiguation rules.
3. **`insert.js`** — writes converted final text at the caret of the focused
   editable element, preserving undo.

Wiring: a toggle in `src/popup/` (and/or a keyboard command) turns capture on; each
final result runs `normalize → Euspell.convertText → insert`; interim results
render unconverted as a live preview. **No changes to `converter.js`,
`dom-walker.js`, or the disambiguation rules** — dictation only consumes
`convertText`.

## Edge cases

- **Interim churn.** Interim results rewrite themselves as the recognizer
  revises its guess; never convert them — convert only the final, or the preview
  will show half-respelled churn.
- **Cross-utterance context.** A sentence spoken across two `isFinal` chunks loses
  the window between them. Buffer until a sentence-ending mark before converting, or
  accept single-utterance context as the boundary (the reader already treats a block
  edge as a sentence end).
- **Contractions and clitics.** "don't", "cat's" already tokenize correctly
  (`classifyRun` in `dom-walker.js`), but only if the recognizer emits the
  apostrophe; the normalizer may need to restore apostrophes the ASR drops.
- **Non-editable focus.** If nothing editable is focused, capture should no-op with
  feedback rather than silently discard text.
- **Permissions / availability.** `webkitSpeechRecognition` needs mic permission and
  is Chromium-only; fail gracefully where absent.

## Recommendation

Build it as an **additive authoring path in the browser extension**, feeding the
existing `Euspell.convertText`. The only substantive work is the speech front-end —
and within that, the normalizer (punctuation + capitalization) is the piece that
earns its keep, because the converter's correctness depends on the sentence shape it
produces. Estimated scope for a working prototype: one new module (~150–250 lines)
plus a popup/hotkey toggle, with **no changes to the conversion engine**.

A sensible first step is to prototype `normalize.js` against a handful of dictated
sentences run through `convertText` — validating punctuation, capitalization, and
the `I`/`Ih`/`ih` and diatone cases — before wiring the live recognizer, exactly as
the SSML lexicon note prototypes its IPA rules on a small slice first.

## A note on fit

Dictation is **orthogonal to euspell's core mission** of reading and reforming
existing text: it is the first *authoring* capability, and it asks the product to
help users *write* euspell — something the reader today explicitly declines to do
inside editable regions. That is not an objection, but it is a deliberate scope
decision worth making before building, not after.

## Status — what is built

Implemented for the browser extension.

- **`src/content/dom-walker.js`** — adds `convertText(text, convertFn)`, which
  routes a plain string through the reader's own block pipeline via a detached
  container, so dictation reuses every disambiguation rule with no duplicated
  spelling logic.
- **`src/dictation/normalize.js`** — the pure transcript → converter-ready text
  step (spoken punctuation, spacing, sentence-initial capitalization, standalone
  `i` → `I`). Unit-tested in `tests/dictation/normalize.test.js`.
- **`src/dictation/recognizer.js`** — wraps `webkitSpeechRecognition`; continuous,
  interim + final, final-only conversion.
- **`src/dictation/insert.js`** — caret insertion into inputs / textareas /
  contenteditable (execCommand with manual fallbacks), the deliberate inverse of
  the reader's editable-region skip.
- **`src/dictation/overlay.js`** — a shadow-DOM status pill (listening / interim /
  error).
- **`src/dictation/index.js`** — the controller: `speech → normalize → convertText
  → insert`, with the editable-target capture and restart-on-silence logic.
- **Wiring** — `content.js` calls `initDictation()` before the conversion gate (so
  dictation works even where page conversion is off); a `toggle-dictation` command
  in `manifest.json` (default `Ctrl+Shift+9`) handled in the service worker; and a
  **Dictate euspell** Start/Stop button in the popup.

Not done: the Word add-in path (would reuse `normalize.js` in its webview), and any
non-Chromium recognizer.
