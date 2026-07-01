# Euspell for Google Docs (Apps Script)

Converts a Google Doc (or selection) into euspell reformed spelling from an
**Extensions ▸ Euspell** menu, using the euspell engine ported to Apps Script in
[`euspell-engine.gs`](euspell-engine.gs).

The browser extension can't do this — Google Docs renders the document text to
`<canvas>`, so a DOM-walking content script never sees it. Apps Script goes
through Google's document API (`DocumentApp`) instead, so it can read and replace
the actual text. It also **reverts** euspell back to English (Extensions ▸
Euspell ▸ Revert Document / Selection), a lexicon-based reverse conversion. Like
the LibreOffice converter, it's a one-pass command (Docs
exposes no live third-party spell/grammar hook).

The engine is a self-contained port (CSV-driven, no DOM) validated against the
real JS engine: **35/35 fixtures** (`npm run test:gas`).

## Files

| File | |
|---|---|
| `euspell-engine.gs` | the conversion engine (`Euspell.convertText`) |
| `euspell-data.gs` | generated dictionary data (~5 MB) — `npm run gen:gas` |
| `Code.gs` | the `onOpen` menu + `DocumentApp` conversion |
| `appsscript.json` | project manifest (V8, OAuth scopes) |

## Build

```
npm run gen:gas    # -> apps-script/euspell-data.gs (needs the gen:lo data)
npm run test:gas   # validate the engine against the JS-engine fixtures
```

## Deploy (clasp — the 5 MB data file rules out copy-paste)

This installs the add-on **bound to one document** (its menu appears in that
doc). Reusing it across all your docs means publishing an editor add-on, which
is out of scope here.

1. Open the target Google Doc ▸ **Extensions ▸ Apps Script** (creates a bound
   project). In **Project Settings**, copy the **Script ID**.
2. Locally:
   ```
   npm install -g @google/clasp
   clasp login
   npm run gen:gas                       # from the repo root
   cd apps-script
   printf '{"scriptId":"YOUR_SCRIPT_ID","rootDir":"."}' > .clasp.json
   clasp push -f                         # pushes the 4 files incl. the 5 MB data
   ```
3. Reload the Google Doc. An **Euspell** menu appears → **Convert Document** /
   **Convert Selection**. The first run prompts for authorization (it only
   touches the current document — scope `documents.currentonly`).

## What is and isn't handled

| | Status |
|---|---|
| Context-free reforms (*above → abov*, *night → niht*) | converted |
| NN2\|VVZ diatones, 702 plurals, 102 heteronyms | converted from context (SVM + POS rules) |
| ~70 semantic homographs (*read, bow, tear, are, …*) | left unchanged |
| Multi-word phrases | not collapsed |
| Paragraphs containing an image/footnote/other inline object | skipped (to avoid deleting the object) |
| Inline character formatting | a converted paragraph resets to its default run formatting |

Notes:
- **Run once.** A few reforms aren't idempotent, so converting an already-euspell
  document again can over-transform those words.
- First conversion in a session parses ~5 MB of dictionary data (Apps Script
  doesn't keep memory between runs), so expect a few seconds before it acts.
