# Installing Euspell, and what its settings do

Euspell rewrites English web pages — and PDFs — into reformed euspell spelling,
entirely on your own device. This page is for people installing it from a
browser store. If you want to build it from source instead, see "Build & load"
in the [README](../README.md).

## Install

1. Open the Euspell listing on the **Chrome Web Store**:
   <https://chromewebstore.google.com/detail/euspell> *(replace with the real
   listing URL once published)*
2. Click **Add to Chrome**.
3. Chrome asks you to confirm. It will say Euspell can **"Read and change all
   your data on the websites you visit"** — click **Add extension**.

   That permission is what conversion *is*: to show a page in reformed spelling,
   Euspell has to read the page's text and replace it. Nothing is uploaded — the
   whole lexicon ships inside the extension and every conversion happens locally.
4. A welcome tab opens confirming you're set up. Open any English page and it
   appears in euspell.
5. Optional but recommended: click the puzzle-piece **Extensions** button in the
   toolbar and click the **pin** next to Euspell, so its icon stays visible. The
   icon is how you reach the on/off switches.

### Other browsers

The same Chrome Web Store listing installs on **Edge**, **Brave**, **Opera**,
**Vivaldi**, and other Chromium browsers — Edge may first ask you to allow
extensions from other stores. **Firefox** needs a different build (see
`npm run build:firefox`), published separately on addons.mozilla.org; on Firefox
site access is opt-in, so the welcome tab shows a **Grant access** button you
must click before pages convert.

> **Not the Google Play Store.** Play distributes Android apps, not browser
> extensions. (Eupub, the standalone euspell e-reader, *is* an Android app — a
> separate product with its own install.)

## The popup — everyday switches

Click the Euspell toolbar icon. Changes take effect **immediately on the page
you're looking at** — no reload.

| Control | What it does |
|---|---|
| **Convert pages** | The one switch. Off means Euspell converts nothing, anywhere. |
| **Dictate euspell** | **Start**/**Stop** speech-to-text that types in reformed spelling at your cursor. Appears only on pages where your browser supports speech recognition. Click into a text box first, then press Start. |
| **Options** | Opens the settings page below. |

**The toolbar icon tells you the state at a glance**, so you don't have to open
the popup to check: the normal blue mark while Euspell is converting, and the
same mark inverted — a solid blue disc with the design knocked out — while it's
off. Hovering the icon says which in words.

If the popup says *"This page can't be converted"*, you're on a page no
extension may touch — `chrome://` pages, the Web Store itself, and similar. The
switch itself still works; it governs every other tab.

**Keyboard shortcut.** `Ctrl+Shift+9` (macOS: `Cmd+Shift+9`) starts and stops
dictation without opening the popup. Change it at `chrome://extensions/shortcuts`.

## The Options page — settings that stick

Reach it from the popup's **Options** button, or via `chrome://extensions` →
Euspell → **Details** → **Extension options**.

**Convert pages** — the same switch as the popup, kept in sync.

**Site access** — tells you whether Euspell can currently read pages. Normally
it says *"Euspell can read and convert the pages you visit."* If you've revoked
access (or you're on Firefox and haven't granted it), a **Grant access** button
appears here to restore it. This is the recovery path if conversion stops
working everywhere at once.

Settings are stored with your browser profile and **sync across the computers
you're signed into**, so switching Euspell off on your laptop switches it off on
your desktop too.

## Good to know

- **PDFs convert too.** Opening a PDF hands it to Euspell's own viewer, which
  reforms the text while keeping the page's real layout, graphics, and fonts.
- **Local files.** To convert pages or PDFs stored on your own computer
  (`file://` URLs), go to `chrome://extensions` → Euspell → **Details** and turn
  on **Allow access to file URLs**. Chrome withholds this by default.
- **Privacy.** No account, no server, no telemetry. The dictionary is bundled in
  the extension and text never leaves your machine — including dictation, whose
  transcript is converted locally.
- **Turning it off temporarily** is better done with the popup's switch than by
  uninstalling — and the toolbar icon then shows, inverted, that it's off.

## If something looks wrong

| Symptom | Try |
|---|---|
| Nothing converts, on any site | Check the toolbar icon — inverted means Euspell is switched off. If it's on, go to Options → **Site access** and click **Grant access** if it's offered. |
| A page converts only partly | Text added by the page after loading is converted as it appears; a page that redraws its own text (some web apps) can win a race. Reloading usually settles it. |
| Dictation row is missing | Your browser lacks speech recognition, or you're on a page with no content script (`chrome://`, the Web Store). |
| A word looks wrong | Reforms are context-sensitive and a handful of ambiguous words are left alone deliberately. See the reform notes in the [README](../README.md). |
