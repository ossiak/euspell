# Appendix A. Installing the browser extension

*Draft for the white paper (*Spelling Reform: An Engineering Approach*),
replacing the current Appendix A. Condensed from
[installing.md](installing.md), which stays the maintained version — update that
first, then re-condense here.*

*The version in the published paper describes install routes that do not exist:
a Chrome Web Store listing (submitted 15 August 2026, in review), a Firefox
listing on addons.mozilla.org (never submitted — the URL 404s), and a Safari
Extensions gallery entry (there is none; Safari is built from source). It also
repeats one sentence twice in the Firefox paragraph. This draft states what a
reader can do today and is written so the Chrome section can be switched on with
a URL when review completes.*

---

Euspell is a browser extension that rewrites English web pages — and PDFs — into
reformed spelling, entirely on the reader's own device. There is no account and
no server: the whole lexicon ships inside the extension, and every conversion
happens locally.

## A.1 Availability

| Browser | Status |
| --- | --- |
| **Chrome** (and Chromium browsers) | Submitted to the Chrome Web Store; in review |
| **Firefox** | Not submitted to addons.mozilla.org |
| **Safari** (macOS) | Built from source; no store listing |

Until the Chrome listing is approved, every browser installs the same way: build
the extension and load it unpacked. The source is at
[github.com/ossiak/euspell](https://github.com/ossiak/euspell) under GPL-3.0-or-later.

**Not the Google Play Store.** Play distributes Android apps, not browser
extensions. Eupub, the standalone euspell e-reader, is a separate product with
its own install (Appendix B).

## A.2 Installing from source

Node 24 or newer is required.

```bash
npm install
npm run build:chrome     # → build/chrome/ and build/euspell-chrome.zip
```

Then, in Chrome, Edge, Brave, Opera, Vivaldi, or another Chromium browser:

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`, …).
2. Turn on **Developer mode**. In Edge the toggle is at the bottom left rather
   than the top right.
3. Click **Load unpacked** and select `build/chrome/`.

**Firefox** needs its own build (`npm run build:firefox`), loaded from
`about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → pick
`build/firefox/manifest.json`. Temporary add-ons are removed when Firefox
restarts; for a permanent unsigned install, use Developer Edition, Nightly, or
ESR, set `xpinstall.signatures.required` to `false` in `about:config`, and
install `build/euspell-firefox.zip`.

**Safari** (macOS) ships as a small app that is built once and enabled in
Safari's settings. Web pages and remote PDFs convert as they do on Chrome; the
platform limits are that Safari extensions cannot read local `file://` pages or
PDFs, which stay in Safari's own viewer. Full steps are in `safari/README.md`.

## A.3 Installing from the store, once the listing is live

1. Open the Euspell listing on the **Chrome Web Store**.
2. Click **Add to Chrome**. Chrome asks for confirmation, warning that Euspell
   can *"Read and change all your data on the websites you visit"* — click **Add
   extension**.

   That permission is what conversion *is*: to show a page in reformed spelling,
   Euspell has to read the page's text and replace it. Nothing is uploaded — the
   lexicon is bundled in the extension and every conversion happens locally.
3. A welcome tab confirms the setup. Any English page then appears in euspell.
4. Click the puzzle-piece **Extensions** button in the toolbar and click the
   **pin** beside Euspell, so its icon stays visible. The icon is how the reader
   reaches the on/off switches, and it inverts when conversion is off.

The same listing installs on Edge, Brave, Opera, Vivaldi, and other Chromium
browsers; Edge may first ask permission to accept extensions from other stores.

## A.4 The popup

Clicking the toolbar icon opens the popup. Changes take effect immediately on the
page being viewed, with no reload.

| Control | What it does |
| --- | --- |
| Word lookup | Type a word in either spelling to see the alternative(s) |
| Convert pages | Global on/off switch — Euspell converts everything or nothing |
| Dictate euspell | Start/stop speech-to-text that types in reformed spelling at the cursor. Shown only where the browser supports speech recognition |
| Options | Opens the settings page |

If the popup reports *"This page can't be converted"*, the tab is one no
extension may touch — `chrome://` pages, the Web Store itself, and similar. The
switch still governs every other tab. A PDF opened before conversion was enabled
may need reloading.

**Keyboard shortcut.** Ctrl+Shift+9 (macOS: Cmd+Shift+9) starts and stops
dictation without opening the popup. It can be changed at
`chrome://extensions/shortcuts`.

## A.5 The Options page

Settings are stored in the browser profile and sync across devices, so switching
Euspell off on one machine switches it off on another.

- **Convert pages** — the same switch as the popup, kept in sync.
- **Site access** — whether Euspell can currently read pages. If access was
  revoked, or on Firefox where it is opt-in, a **Grant access** button appears
  here. This is the recovery path when conversion stops working everywhere at
  once.
- **PDF conversion** — opening a PDF hands it to Euspell's own viewer, which
  reforms the text while keeping the page's real layout, graphics, and fonts.
  The switch reaches an open PDF: turning it off redraws the pages in their
  original spelling, and on redraws them reformed. A PDF opened while Euspell was
  off is in the browser's own viewer, which no extension can reach — the popup
  notices and offers a **Reload** to hand it over.
- **Local files** — to convert pages or PDFs stored on the reader's own computer
  (`file://` URLs), open `chrome://extensions` → Euspell → **Details** and enable
  **Allow access to file URLs**. Chrome withholds this by default.

**Privacy.** No account, no server, no telemetry. Dictation is the one exception
and is described in §A.6.

## A.6 Dictation

Dictation uses the browser's own Web Speech API. In Chrome that is implemented by
streaming the microphone audio to Google's speech service; Safari uses Apple's
equivalent. That audio is handled by the browser vendor under their privacy
policy. The extension never receives the audio, and the euspell conversion is
still performed locally on the returned transcript. Nothing is captured unless a
dictation session has been started.

## A.7 Troubleshooting

| Symptom | Try |
| --- | --- |
| Nothing converts, on any site | Check the toolbar icon — inverted means Euspell is off. If it is on, open Options → Site access and click **Grant access** if offered |
| A page converts only partly | Text added after load is converted as it appears, but a page that redraws its own text can win the race. Reloading usually settles it |
| Dictation row is missing | The browser lacks speech recognition, or the tab has no content script (`chrome://`, the Web Store) |
| A word looks wrong | Reforms are context-sensitive, and disambiguation is about 94% accurate — errors concentrate in headlines and short phrases, where there is little context to read |
