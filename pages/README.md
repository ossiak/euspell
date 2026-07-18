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
| Inline character formatting | a converted paragraph resets to its default run formatting |

- **Run once.** A few reforms aren't idempotent, so converting an already-euspell
  document again can over-transform those words.
- Correctness of the reform itself is covered by the shared engine's fixtures
  (`npm run test:gas`, 35/35); only the thin Pages glue is new here.

## If the document doesn't change (text-suite note)

The one unproven line is how the glue reads and writes paragraph text
(`bodyText` / `paragraphs` / `.text()` in
[`euspell-pages-glue.js`](euspell-pages-glue.js)). JXA's text suite is finicky
and the exact specifier can vary by Pages version. If a run pops an **"Euspell —
could not rewrite the document"** alert, note the error it shows and:

1. Confirm the names against Pages' real dictionary: **Script Editor ▸ File ▸
   Open Dictionary… ▸ Pages**, and look at the *Text Suite* (`body text`,
   `paragraph`, `text`).
2. **Whole-body fallback** (reliable, but resets *all* body formatting): replace
   the per-paragraph loop with a single get/set —
   ```js
   var body = Pages.documents[0].bodyText;
   body.text = transform(body.text());
   ```
   `Euspell.convertText` handles the embedded newlines itself, so this converts
   the entire body in one shot; the cost is that the whole body collapses to one
   formatting run.

Report back what the dictionary shows and we can lock the specifier in.
