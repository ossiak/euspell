# Euspell for Apple Pages (JXA)

Converts the frontmost Pages document from traditional English into euspell
reformed spelling — or back again — using the same engine the browser extension
and the Google Docs add-on use. Pages has **no add-in or menu API**, so this
ships as a standalone **JXA** (JavaScript for Automation) script you run from
macOS rather than as an in-app command.

It's the least battle-tested of the euspell office tools (Word, LibreOffice,
Google Docs, Pages): Pages' scripting dictionary exposes a finicky text suite, so
if a run fails see [Fallback: whole-body replace](#fallback-whole-body-replace).

## The script

[`euspell-pages.js`](euspell-pages.js) (committed, ~5 MB) is the whole thing: the
euspell dictionary data and engine — the same `euspell-data.gs` + `euspell-engine.gs`
the Google Docs port uses — with a small JXA glue layer at the end that defines
the `run()` entry point. It's already built; you don't generate anything to use
it.

## Run it

You need a Mac with Pages, and a Pages document open and frontmost.

**Script Editor (simplest):**

1. Open `euspell-pages.js` in **Script Editor**. Its language menu (top-left of
   the editor) should read *JavaScript*, not *AppleScript*.
2. With a Pages document frontmost, click **Run** (▶).
3. Pick **Convert to euspell** or **Revert to English** in the dialog. A
   notification reports how many paragraphs changed.

The first run triggers a macOS **Automation** permission prompt (allow the
runner — Script Editor / `osascript` — to control Pages). If you dismissed it,
re-enable it under **System Settings ▸ Privacy & Security ▸ Automation**.

**System Script menu** (run without opening the editor): copy `euspell-pages.js`
into `~/Library/Scripts/`, turn on *Show Script menu in menu bar* (Script Editor
▸ Settings ▸ General), then choose it from that menu with Pages frontmost.

**Automator Quick Action / Shortcuts:** wrap the script in a **Run Shell Script**
step so it becomes a right-click Quick Action or a Shortcut:

```sh
osascript -l JavaScript ~/Library/Scripts/euspell-pages.js
```

> Use *Run Shell Script* + `osascript`, **not** Automator's *Run JavaScript*
> action — that action supplies its own `run(input, parameters)` wrapper, which
> collides with the script's top-level `run()`.

JXA treats a top-level `run` function as the implicit entry handler, so Script
Editor, the Script menu, and `osascript` all invoke it for you — no explicit
`run();` call is needed.

## What it does

After you choose Convert or Revert, it walks the document's **body paragraphs**
and rewrites each one in place with `Euspell.convertText` / `Euspell.revertText`,
skipping blank lines and paragraphs that don't change. A reform never adds or
removes a paragraph break, so the paragraph list stays stable as it goes.

## Fallback: whole-body replace

Access to individual paragraphs (`bodyText.paragraphs`, `para.text()`) is the one
fragile part — JXA's text suite behaviour varies between Pages versions. If a run
fails with a *"could not rewrite the document"* alert, switch the `try` block in
`run()` from the per-paragraph loop to a single whole-body replace, which leans on
the text suite far more lightly:

```js
  try {
    var body = Pages.documents[0].bodyText;
    var before = body.text();                // read the whole body once
    var after = transform(before);
    if (after !== before) body.text = after; // write it back once
  } catch (e) {
    Pages.displayAlert('Euspell — could not rewrite the document', {
      message: String(e),
    });
    return;
  }
```

Paragraph breaks survive, because the engine preserves newlines (and every other
separator) as it converts. The trade-off: this rewrites the **entire** body in one
assignment, so it resets inline formatting across the whole document rather than
only the paragraphs that changed, and there's no per-paragraph "changed" count.

To see which layer is failing, open Pages' scripting dictionary in **Script
Editor ▸ File ▸ Open Dictionary… ▸ Pages** and check the text-suite terms
(`body text`, `paragraph`, `text`).

## What is and isn't handled

| | Status |
|---|---|
| Context-free reforms (*above → abov*, *night → niht*) | converted |
| NN2\|VVZ diatones, 702 plurals, 102 heteronyms | converted from context (linear SVM + POS rules) |
| ~70 semantic homographs (*read, bow, tear, are, …*) | left unchanged |
| Selection / partial document | not supported — Pages exposes no scriptable selection, so it's whole-document only |
| Text in text boxes, shapes, table cells | not reached — main body flow only |
| Inline character formatting | rewriting a paragraph resets it to that paragraph's default run formatting |

- **Run once** — a few reforms aren't idempotent.
- **Body only** — put anything you want converted in the main text flow.

This is the same one-pass shape as the [LibreOffice](../libreoffice/README.md)
and Google Docs converters; the [Word add-in](../word-addin/README.md) adds
selection scope and a custom-dictionary option.

## Rebuilding

The committed `euspell-pages.js` is what you run, so you only rebuild it after the
lexicon or engine changes. Its header marks it `GENERATED` — it's assembled by
prepending the shared Google-Docs engine artifacts (`euspell-data.gs` +
`euspell-engine.gs`, produced by `npm run gen:gas`) to the JXA glue. Regenerate
those artifacts first, then re-concatenate.
