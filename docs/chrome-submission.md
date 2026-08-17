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

**Screenshots** — 1280×800, four of them, in `euspell_game/screenshots/`:

| File | What it shows |
| --- | --- |
| `01-game-scored.png` | The conversion game, scored — every legend state in one frame, with the explanation panel open. The shot that has to teach |
| `02-popup-records.png` | The popup over a converted page carrying both readings of `records`, next to the `012` encoding |
| `03-pdf-viewer.png` | The bundled viewer converting a document live, toolbar intact |
| `04-options.png` | The off switch, and the privacy note with its dictation exception |

Plus `promo-tile.png` at 440×280 — optional, but required for any chance of
being featured.

Shot at 2× and downscaled. Reproduce with
`tools/capture-shots.cjs` in `euspell_game`; the brief behind the choices is in
`euspell_game/store-screenshots.md`.

Two were captured by hand from a real Chrome, because rendering the popup or the
viewer headless gives UI with no browser around it. **If the extension changes,
re-capture those two before re-running the sizer** — the script resizes whatever
file is there and cannot tell a stale capture from a fresh one.

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

`https://euspell.org/privacy/`

**Written, not yet live.** The page exists in the website repo at
`src/app/privacy/page.tsx` and builds into the static export; the trailing slash
is not optional, since the site exports each route as a folder. It covers every
tool rather than the extension alone — what each one stores and where, that page
text never leaves the device, the dictation exception in full, and the fact that
the web host keeps ordinary access logs. It also explains the `<all_urls>`
request in the same terms as the justification above, which is worth keeping
consistent if either is reworded.

⚠ **Deploying it publishes the whole site.** The export contains all 20 routes,
and only `/` is the coming-soon splash — so uploading `out/` reveals the 17
content pages at the same moment. That is a launch decision, not a side effect
to stumble into. To put the policy up alone, upload `out/privacy/` by itself.

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

1. **Deploying the privacy policy** — the page is written; `euspell.org/privacy/`
   still 404s until the export is uploaded. It goes up with the site reveal, so
   this is not a separate task, but it is the one thing left that the listing
   cannot be submitted without.
2. **Developer account registration** (US$5, one-time) if not already done.

~~Screenshots~~ — done, four of them, above. They were parked behind the
disambiguation demo on the theory that it would produce a better first image
than a converted web page could, and it did: the hero shot is the game's own
scored view.
