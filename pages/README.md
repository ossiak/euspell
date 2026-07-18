# Euspell for Apple Pages (JXA)

Converts the frontmost Pages document into euspell reformed spelling — or reverts
it back to English — from a single script, using the euspell engine ported to
Apps Script and reused verbatim under **JavaScript for Automation (JXA)**.

Pages has no add-in model (no equivalent of Word's Office.js or Google Docs'
Apps Script), so euspell can't hook the document from *inside* Pages. Instead a
JXA script drives Pages from *outside* through its scripting dictionary — the
same one-pass "convert the whole document" shape as the LibreOffice and Google
Docs converters. **macOS only.**

## Build (on the Mac)

Needs Node ≥ 24. From the repo root:

```
npm install
npm run gen:pages
```

`gen:pages` runs the whole chain (`gen:lo` → `gen:gas` → `gen:pages`) from
tracked data — no Python required — and writes the single, self-contained,
~5 MB script:

```
pages/euspell-pages.js
```

That file is `euspell-data.gs` + `euspell-engine.gs` + `euspell-pages-glue.js`
concatenated: the dictionary data, the engine (defining the global `Euspell`),
then the Pages glue. It's gitignored and regenerated.

## Install & run

Because Pages has no menu to hang a command on, invoke the script from one of:

**A. Script menu (simplest)**

1. Copy the built script into your user Scripts folder:
   ```
   mkdir -p ~/Library/Scripts/Applications/Pages
   cp pages/euspell-pages.js ~/Library/Scripts/Applications/Pages/Euspell.js
   ```
2. Turn on the Script menu: open **Script Editor ▸ Settings ▸ General ▸ Show
   Script menu in menu bar**.
3. Open a Pages document, then from the Script menu (top-right of the screen)
   choose **Euspell**. A dialog asks **Convert to euspell** or **Revert to
   English**; pick one and it rewrites the body in place.

**B. Terminal (for quick testing)**

```
osascript -l JavaScript pages/euspell-pages.js
```

**C. Automator Quick Action / Shortcut** — wrap the same file in a "Run
JavaScript for Automation" step if you want a right-click or keyboard-shortcut
trigger.

The first run prompts once for permission to control Pages (System Settings ▸
Privacy & Security ▸ Automation). First conversion in a session parses ~5 MB of
dictionary data, so expect a couple of seconds before it acts.

## What is and isn't handled

| | Status |
|---|---|
| Context-free reforms (*above → abov*, *night → niht*) | converted |
| NN2\|VVZ diatones, 702 plurals, 102 heteronyms | converted from context (SVM + POS rules) |
| ~70 semantic homographs (*read, bow, tear, are, …*) | left unchanged |
| Revert (euspell → English) | supported (lexicon reverse) |
| Selection only | **not** supported — Pages exposes no scriptable text selection; whole document only |
| Text in text boxes / shapes / table cells | not reached (only the main body flow) |
| Inline character formatting | the whole body resets to its default run formatting (whole-document rewrite, see below) |

- **Run once.** A few reforms aren't idempotent, so converting an already-euspell
  document again can over-transform those words.
- Correctness of the reform itself is covered by the shared engine's fixtures
  (`npm run test:gas`, 35/35); only the thin Pages glue is new here.

## Text-suite note

Per-paragraph access (`bodyText.paragraphs[i].text()` / `.text = …`) throws
**"Error: Can't convert types"** on Pages 15.3 — JXA's text suite is finicky
and that specifier doesn't work at least on that version. The glue therefore
reads and writes the whole body in one shot instead:

```js
var doc = Pages.documents[0];
doc.bodyText = transform(String(doc.bodyText()));
```

Calling `bodyText` as a function reads the text; assigning to the property
directly writes it — confirmed working via a probe against a live document
(`osascript -l JavaScript`). `Euspell.convertText` handles the embedded
newlines itself, so this converts the entire body in one shot; the cost is
that the whole body collapses to one formatting run.

If a run still pops an **"Euspell — could not rewrite the document"** alert
on some other Pages version, confirm the names against Pages' real
dictionary: **Script Editor ▸ File ▸ Open Dictionary… ▸ Pages**, and look at
the *Text Suite* (`body text`, `paragraph`, `text`).
