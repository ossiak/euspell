# Installing the Euspell word-processor add-ins

The browser extension reforms **web pages** (see [installing.md](installing.md)).
These four tools reform **documents** — in Microsoft Word, LibreOffice Writer,
Google Docs, and Apple Pages — all driven by the same euspell engine.

Two things to know before you pick one:

- **They are built from source, not installed from a store.** Each needs a
  one-time build on your machine (Node ≥ 24). There is no marketplace listing.
- **They are one-pass converters, not live spell-checkers.** You click a command
  and the document is rewritten, the same way "translate this document" works.
  Nothing underlines as you type. (Word and LibreOffice both refuse to host a
  live third-party checker — see the notes at the end of their READMEs.)

Everything runs locally. No account, no server, no telemetry; the dictionary is
bundled into each tool.

## Which tool does what

| Word processor | Platforms | Whole document | Selection | Revert to traditional | Setup |
|---|---|---|---|---|---|
| **Microsoft Word** | Windows, macOS, web | ✅ | ✅ | ✅ | hardest — HTTPS cert + a server that stays running |
| **LibreOffice Writer** | Windows, Linux, macOS | ✅ | ✅ | ✅ | copy two things into your profile |
| **Google Docs** | any browser | ✅ | ✅ | ✅ | `clasp` upload, **per document** |
| **Apple Pages** | macOS only | ✅ | ❌ | ✅ | copy one file |

"Revert" is a lexicon-based reverse conversion — euspell back to traditional
English. Apple Pages can't do selections because Pages exposes no scriptable
text selection.

## Before you start

Clone the repo and install dependencies once:

```
npm install
```

Each tool then has its own build command, listed below. These regenerate a ~5 MB
dictionary payload from the tracked lexicon, so re-run them only when the lexicon
changes.

## Microsoft Word

**Build, trust a certificate, serve, sideload.** An Office add-in is a small web
app, so Word loads it over HTTPS from a server on your own machine.

```powershell
npm run gen:word                        # engine + data + icons
npx office-addin-dev-certs install      # one time — accept the Windows prompt
npm run word:serve                      # leave this window running
```

Then, in a second terminal:

```powershell
npx office-addin-debugging start word-addin\manifest.xml
```

Word opens with the add-in loaded. On the **Home** ribbon click **Euspell** to
open the taskpane, then use **Convert document** / **Convert selection**, or
**Revert document / selection to traditional**.

> **The dev server must stay running** the whole time you use the add-in. To
> avoid that — and to use Word on the web, which usually blocks a `localhost`
> taskpane — host the add-in instead: the repo's
> [pages.yml](../.github/workflows/pages.yml) workflow publishes it to GitHub
> Pages and rewrites the manifest URLs for you.

**Stop Word underlining euspell words.** Pick one:

1. **The taskpane's checkbox** (on by default, zero setup) marks converted text
   as "do not proof". Blunt — it also stops Word catching real typos there, and
   it's desktop-only.
2. **Install the euspell custom dictionary**, which keeps real typo-checking:
   `npm run gen:word-dict`, then **File ▸ Options ▸ Proofing ▸ Custom
   Dictionaries ▸ Add…** and choose `dict/euspell-word.dic`. Global, one-time —
   and **uncheck** the taskpane box if you use it.

Full guide, including the manual shared-folder method, Word on Mac/web, and
troubleshooting: [word-addin/INSTALL.md](../word-addin/INSTALL.md).

## LibreOffice Writer

**Two parts:** the macro + engine go into your LibreOffice user profile, and an
optional small extension adds the **Euspell** menu. Close LibreOffice first.

On **Linux**, one command does both and auto-detects native vs Flatpak:

```bash
npm run gen:lo && npm run gen:lo:oxt
libreoffice/install-linux.sh
```

On **macOS**, one command does both and finds `LibreOffice.app` automatically
(the macOS build bundles its own Python — nothing extra to install):

```bash
npm run gen:lo && npm run gen:lo:oxt
libreoffice/install-macos.sh
```

On **Windows**:

```powershell
$dst = "$env:APPDATA\LibreOffice\4\user\Scripts\python"
New-Item -ItemType Directory -Force $dst | Out-Null
Copy-Item ".\libreoffice\Scripts\python\euspell_convert.py" $dst -Force
Copy-Item ".\libreoffice\euspell" $dst -Recurse -Force
unopkg add --force .\dict\euspell-libreoffice.oxt
```

Restart LibreOffice, then use **Euspell ▸ Convert Document** / **Convert
Selection**, or **Revert Document / Selection to Traditional**.

> **Native Linux builds need the Python script provider** (Flatpak bundles it).
> If the Euspell menu never appears, install
> `libreoffice-script-provider-python` (Debian/Ubuntu), `libreoffice-pyuno`
> (Fedora/openSUSE) — Arch already includes it.

The menu deliberately calls the copy in your user profile, so **part one is a
prerequisite for part two**. Details, profile paths, and the Plasma notes:
[libreoffice/README.md](../libreoffice/README.md).

## Google Docs

Docs renders text to `<canvas>`, so the browser extension can't see it — this
goes through Google's document API instead. Note the big caveat: **the add-on
binds to a single document**, so its menu appears only in the doc you install it
into. Making it available everywhere means publishing a real editor add-on,
which is out of scope.

1. Open the target Doc ▸ **Extensions ▸ Apps Script**, and copy the **Script ID**
   from **Project Settings**.
2. Locally:

   ```
   npm install -g @google/clasp
   clasp login
   npm run gen:gas
   cd apps-script
   printf '{"scriptId":"YOUR_SCRIPT_ID","rootDir":"."}' > .clasp.json
   clasp push -f
   ```

3. Reload the Doc. An **Euspell** menu appears — **Convert Document** /
   **Convert Selection**. The first run asks for authorization; the scope is
   `documents.currentonly`, so it can only touch that one document.

The 5 MB data file is why this needs `clasp` rather than copy-paste. Details:
[apps-script/README.md](../apps-script/README.md).

## Apple Pages

**macOS only.** Pages has no add-in model at all, so instead of running *inside*
Pages, a script drives it from outside through macOS automation.

```
npm run gen:pages       # writes the single ~5 MB pages/euspell-pages.js
mkdir -p ~/Library/Scripts/Applications/Pages
cp pages/euspell-pages.js ~/Library/Scripts/Applications/Pages/Euspell.js
```

Turn on the Script menu — **Script Editor ▸ Settings ▸ General ▸ Show Script menu
in menu bar** — then open a Pages document and choose **Euspell** from that menu
(top-right of the screen). A dialog offers **Convert to euspell** or **Revert to
traditional**.

The first run asks permission to control Pages (**System Settings ▸ Privacy &
Security ▸ Automation**). Whole document only, and only the main body flow — text
in text boxes, shapes, and table cells isn't reached. Details:
[pages/README.md](../pages/README.md).

## What they all share

- **Run the conversion once.** A few reforms aren't idempotent, so converting
  already-euspell text again can over-transform those words. That's what Revert
  is for.
- **Converted paragraphs lose inline formatting.** Each tool replaces a
  paragraph's text wholesale, which resets bold/italic runs to the paragraph's
  default. Best on plain-text documents. (In Pages the *whole body* becomes one
  run.)
- **Paragraphs holding images or other inline objects are skipped**, so replacing
  text can't delete the object.
- **About 70 semantic homographs are deliberately left alone** — *read, bow,
  tear, are, …* — because choosing between their spellings needs per-word rules
  the ports don't carry. Context-decided cases (*records*, *anchors*) *are*
  converted, via the same SVM and POS rules the extension uses.
- **Multi-word phrases aren't collapsed.**
- **The first conversion in a session takes a few seconds** while ~5 MB of
  dictionary data loads. Later ones are quick.

## If something looks wrong

| Symptom | Try |
|---|---|
| **Word:** taskpane blank, or "can't load add-in" | The dev server isn't running, or the certificate isn't trusted. Re-run steps 2–3 and confirm `https://localhost:3000/src/taskpane.html` loads cleanly in a browser. |
| **Word:** no Euspell button on the Home tab | The manifest didn't register. Try the manual shared-folder method, and make sure you reopened Word. |
| **LibreOffice:** no Euspell menu | On native Linux, install the Python script provider (above). Otherwise the user-profile copy is missing — redo part one, and confirm LibreOffice was closed when you copied. |
| **Google Docs:** no Euspell menu | You're in a different document — the add-on is bound to the one you pushed it to. Reload the page after `clasp push`. |
| **Pages:** "could not rewrite the document" | Grant automation permission in System Settings ▸ Privacy & Security. If it persists, your Pages version may name the text suite differently — see the text-suite note in `pages/README.md`. |
| Words that should have changed didn't | Probably one of the ~70 semantic homographs left unchanged on purpose. See [encoding.md](encoding.md) for the scheme. |
| Text converted twice looks mangled | Revert, then convert once. |
