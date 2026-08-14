# Chrome Web Store submission

Everything the dashboard asks for, written out. The listing copy below is meant
to be pasted; the justifications are the fields most first submissions get
returned on, so they are written to be read by a reviewer who has never heard of
the project.

**Package:** `npm run build:chrome` → `build/euspell-chrome.zip` (2.7 MB, 64
files). It stages the same allowlist the Firefox and Safari builds use and ships
`manifest.json` byte-for-byte, then verifies that every path the manifest names
is actually inside the package before writing the zip. `build/chrome/` is left
behind as a loadable unpacked copy — load *that* once via `chrome://extensions`
before uploading, so what you test is what you ship.

---

## Before uploading

| | |
| --- | --- |
| `npm test` | 299 tests, including *the version is one the stores will accept* |
| `manifest.json` version | Chrome takes 1–4 dotted integers, no suffix, no zero-padding. **A version cannot be reused** — a rejected upload burns that number |
| Load `build/chrome/` unpacked | convert a page, open a PDF, toggle from the popup, check the toolbar icon greys out |
| Developer account | one-time US$5 registration fee, paid before the first submission |

---

## Store listing

**Name** — `Euspell`

**Summary** (132 characters max; this one is 113):

> Read the web in euspell, a regular English spelling reform. Converts pages and PDFs in place, on your own device.

**Description:**

> Euspell rewrites English web pages into euspell — a conservative, regular
> spelling reform designed so that a reader who has never seen it can still read
> it at first sight.
>
> Four fifths of the dictionary is untouched. What changes, changes for a reason:
> silent letters that mislead, one sound spelled six ways, and the handful of
> homographs English writes identically and pronounces differently — `records`
> the nouns and `recordz` the verb, `wind` the air and `wynd` the turn.
>
> • Converts any web page as you read it, and switches off per page or entirely
> • Opens PDFs in a bundled viewer that converts them the same way
> • Look up any word from the toolbar popup — what it becomes, and why
> • Dictate straight into a page in euspell, using your browser's speech recognition
>
> The conversion runs inside your browser. There is no account, no server, and no
> telemetry: the 205,000-word lexicon ships inside the extension, and no page text
> is ever transmitted anywhere. (Dictation is the one exception — see Privacy.)
>
> The reform, the lexicon and every tool are open source (GPL-3.0), and the
> engineering behind them is set out in a published white paper.

**Category** — *Functionality & UI* is the best fit; *Education* is defensible if
you would rather be shelved next to language tools.

**Language** — English.

**Store icon** — `icons/128.png` (already in the package).

**Screenshots** — 1280×800 or 640×400, at least one, up to five. ⚠ **These do
not exist yet** and are a hard blocker. The obvious four:

1. A news article, half converted — the before/after split is the whole pitch.
2. The popup's word lookup, showing an encoding and its reason.
3. The bundled PDF viewer on a converted paper.
4. The options page, to show it switches off.

---

## Privacy tab

### Single purpose

Chrome requires one narrow purpose, and a reviewer will test the other features
against it. Stated so that the PDF viewer, the popup and dictation all fall
inside it rather than reading as three extra products:

> Euspell renders English text in euspell, a reformed spelling. Every feature
> serves that one purpose: the content script converts the page you are reading,
> the bundled viewer does the same for PDFs, the popup explains what a single
> word becomes, and dictation writes euspell into the page you are typing in.

### Permission justifications

**`storage`**

> Stores one setting — whether conversion is currently on — in
> `chrome.storage.sync`, so the choice survives a restart and follows the user's
> profile. No page content, browsing history, or personal data is stored.

**`scripting`**

> The service worker injects the content bundle into a tab when conversion is
> switched on, and re-injects after an update or after being re-enabled
> mid-session, so pages that are already open convert without needing a reload.

**`webNavigation`**

> `onBeforeNavigate` is filtered to URLs ending in `.pdf` and is used only to
> hand the tab to the extension's bundled PDF viewer before the request goes
> out. Catching it there means the file is never downloaded into Chrome's native
> viewer first, so there is no flash of the wrong renderer and no wasted fetch.

**`webRequest`**

> Observation only — no blocking, no modification, and no
> `webRequestBlocking`. `onHeadersReceived` identifies PDFs that the URL does not
> reveal: an extensionless URL whose `Content-Type` or `Content-Disposition` says
> PDF, and a PDF served inside a first-level iframe (which a content script
> cannot reach, because Chrome renders it in a native plugin). Any other response
> returns on the first line. This cannot be done with
> `declarativeNetRequest`, which cannot read response headers.

**`activeTab`**

> The toolbar popup acts on the tab the user just clicked from — reading whether
> conversion is on there, and toggling it.

**Host permission `<all_urls>`**

> A spelling reform has no site list: it applies to any page written in English,
> and the user chooses which ones by switching conversion off, not by granting
> access site by site. The content script therefore has to be able to run
> anywhere. All conversion happens inside the page — the lexicon is bundled in
> the extension, and no page text is sent anywhere.

### Remote code

**No.** All code is in the package. The `wasm-unsafe-eval` in the manifest's CSP
is for the WebAssembly image decoders bundled with PDF.js in `dist/pdfjs/`
(JPEG 2000 and JBIG2), which are shipped files, not fetched ones. Say this in
the justification box if there is one — an unexplained `wasm-unsafe-eval` is a
common reason for a review round-trip.

### Data usage

The extension transmits nothing. Answer **No** to every collection category —
personally identifiable information, health, financial, authentication, personal
communications, location, web history, and user activity — and to *website
content*: page text is read and rewritten inside the page and never leaves it.
The three certifications (no selling, no unrelated use, no creditworthiness) all
hold.

**One judgement call, made deliberately.** Dictation calls the browser's Web
Speech API, and in Chrome that streams the microphone audio to Google's speech
service. The extension neither collects nor transmits that audio — the browser
does — so the collection answers above stay *No*. But it is user speech leaving
the device, so it belongs in the privacy policy in plain words rather than being
left for someone to discover. If a reviewer disagrees and treats it as personal
communications, the fix is to check that box, not to argue.

### Privacy policy URL

⚠ **Required, and does not exist yet.** Draft text, to be published at
`euspell.org/privacy` before submitting:

> **Euspell collects nothing.** There is no account, no server, and no
> analytics. The extension makes no network request to us, because there is
> nothing on our side to request from.
>
> **Page content stays in the page.** Converting a page means rewriting text in
> the browser, using a lexicon that ships inside the extension. The text of what
> you read is never sent anywhere.
>
> **Your settings.** One preference — whether conversion is on — is stored in
> Chrome's own `storage.sync`, which syncs through your Google account, not
> through us. Removing the extension removes it.
>
> **Dictation is the exception.** When you start dictation, the extension uses
> your browser's built-in speech recognition. In Chrome, that sends the audio to
> Google's speech service for transcription, under Google's privacy policy, not
> ours — the same as any site that uses the Web Speech API. We never receive the
> audio or the transcript; the text is converted to euspell locally and typed
> into the page. Dictation runs only while you have started it.

---

## Known review risks

- **`<all_urls>` plus `webRequest`** is the combination that draws the longest
  look. The justifications above are written to be read together: the host
  permission is what the product *is*, and `webRequest` is observation-only for
  one narrow test.
- **Single purpose vs. four features.** Dictation is the one most likely to be
  read as a separate product. The framing above ties it to the same purpose;
  keep that framing consistent with the listing description.
- **13 MB of `dist/lexicon.data`** in a 2.7 MB zip is unusual enough to notice.
  It is a compiled word list, not code — worth one sentence to the reviewer if
  asked.
- **Review takes days, not hours,** and a rejection costs a version number and
  another wait. Submit with the whole listing complete rather than uploading
  early to "get in the queue".

## Blockers, in the order they bind

1. **Screenshots** — at least one, and they need product that looks finished.
2. **Privacy policy at a live URL** — the text above needs `euspell.org` to serve
   a real page, which currently returns the coming-soon splash. This makes the
   site deploy a dependency of the Chrome submission, not a parallel task.
3. **Developer account registration** (US$5, one-time) if not already done.
