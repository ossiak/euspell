# Signing Euspell for Windows and Android

Euspell ships as a **browser extension**, not as an installable program, and that
changes what "signing" means. There is no Authenticode certificate to buy and no
keystore to guard: the browser vendors sign the package themselves, and your job
is to hand them a build that passes review and to keep the credentials that prove
the upload came from you.

> **Firefox for Android is deferred, decided 16 August 2026.** The extension is
> not shipping on Android in this release, so everything in the [Android](#android)
> section below is preparation rather than pending work. It is kept because the
> package is already ready for it — `gecko_android` is declared and costs nothing
> to leave in place — and because the AMO steps there are the same ones desktop
> signing uses.
>
> **Eupub is the Android story for this release.** The standalone e-reader is a
> different kind of signing altogether: a real signed binary on both platforms,
> with an Authenticode certificate and an Android keystore to look after. It is
> documented in its own repository — `docs/windows-signing.md`,
> `docs/android-signing.md`, and `docs/android-play-submission.md` for what
> distribution beyond a sideloaded apk requires.

## The short version

| Target | Who signs | What you supply | Status |
| --- | --- | --- | --- |
| Chrome / Edge / Brave / Opera on **Windows** | Google (and Microsoft) sign the packed extension | a `.zip`, a developer account, store credentials | ready to submit |
| Firefox on **Windows** | Mozilla (AMO) | the staged `build/firefox` zip + AMO API keys | ready to sign — needs only the credentials ([Step 1](#step-1--amo-credentials)) |
| Firefox on **Android** | Mozilla (AMO) | the same package, plus the `gecko_android` manifest key | as above; untested on a real phone |
| Chrome on **Android** | — | — | impossible: Chrome for Android has no extension support |
| The LibreOffice / Word / Docs / Pages add-ins | nobody | — | not signed; see [Not signed, and why that's fine](#not-signed-and-why-thats-fine) |

## Windows

### Chrome Web Store (and every other Chromium browser)

The store is the signing authority. You upload a plain zip of the repo's
extension files; Google packs it into a `.crx`, signs it with a key **it** holds,
and derives the permanent 32-character extension ID from that key. Nothing is
signed on your machine, and there is no private key for you to lose.

One-time setup:

1. Register at <https://chrome.google.com/webstore/devconsole> — **US$5**,
   once, for the lifetime of the account.
2. Complete **publisher verification** (an email address on a domain you control
   — `euspell.org` — makes the listing show a verified publisher rather than a
   bare account name).
3. Upload the zip, fill in the listing, and submit. Review for an extension with
   `<all_urls>` host permissions and a `webRequest` permission is not instant;
   allow days, and expect a justification prompt for each permission. The
   rationale already written for users in
   [installing.md](installing.md#install) — conversion *requires* reading and
   replacing page text, nothing is uploaded — is the right answer to give the
   reviewer too.

The zip is the extension's own runtime files:

```powershell
npm run build
Compress-Archive -Path manifest.json, src, dist, icons -DestinationPath build\euspell-chrome.zip -Force
```

> That one-liner ships **all** of `dist/`, which also holds artifacts for other
> targets — the 4.6 MB SQLite lexicon, the 14 MB standalone `lexicon.js`, the
> hunspell `.aff`/`.dic` — none of which the extension loads at runtime. It
> works, but it roughly quadruples the upload. Before the first real submission,
> give Chrome the same treatment Firefox already gets: a `build/gen-chrome.js`
> that stages the explicit file allowlist from
> [`build/gen-firefox.js`](../build/gen-firefox.js) (minus the Gecko manifest
> rewrite) and zips that.

**Edge** is a separate submission to Microsoft Partner Center (free, same zip,
its own review), which is only worth doing if you want an Edge Add-ons listing —
Edge users can already install from the Chrome Web Store after allowing it once.

To automate uploads later, the Chrome Web Store API takes an OAuth client ID,
client secret, and refresh token as repository secrets, driven by
`chrome-webstore-upload-cli` — the same shape as the existing
[`firefox-sign.yml`](../.github/workflows/firefox-sign.yml).

### Self-hosted `.crx` — only for managed Windows fleets

Chrome on Windows refuses to install an extension that didn't come from the Web
Store, *unless* an enterprise policy allowlists it. If Euspell is ever deployed
to a school or organisation's managed machines, that's the mechanism, and there
you do hold the key:

```powershell
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
# Pack a *staged* directory, never the repo root — whatever the folder contains
# ends up in the .crx, node_modules and all.
& $chrome --pack-extension="$PWD\build\chrome"
# That first run also writes build\chrome.pem — the key the extension ID is
# derived from. Reuse it on every later build or the ID changes and installed
# copies stop updating:
& $chrome --pack-extension="$PWD\build\chrome" --pack-extension-key="$PWD\build\chrome.pem"
```

Host the resulting `.crx` plus an update-manifest XML on `euspell.org`, and point
`ExtensionSettings` / `ExtensionInstallForcelist` policy (registry, under
`HKLM\SOFTWARE\Policies\Google\Chrome`) at it. **Guard that `.pem` like a signing
key** — it is one, and it is the only signing key this project would ever own.
For ordinary users, ignore all of this and use the store.

### Firefox on Windows

Identical to Android — one AMO submission covers both. See the next section.

## Android

Firefox is the only browser on Android that runs extensions, so "Euspell for
Android" means "Euspell on Firefox for Android". Release Firefox installs
**signed add-ons only**; AMO does the signing, either after review (listed) or
immediately on upload (unlisted).

### Step 1 — AMO credentials

Create an API key/secret at
<https://addons.mozilla.org/developers/addon/api/key/> and add them as repository
secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`. This is already documented in the
header of [`firefox-sign.yml`](../.github/workflows/firefox-sign.yml), which runs
`web-ext sign` on every published GitHub release.

### Step 2 — Claim the add-on ID

[`build/gen-firefox.js`](../build/gen-firefox.js) writes the gecko id
**`kamran@euspell.org`**, settled on 16 August 2026. It is not a mailbox — a
gecko id is only required to be a unique, stable string in email or GUID form,
and one at a domain you control is the recommended shape.

> **This is a one-way door.** AMO binds the ID to your account on first
> submission and it can never be changed. A later change is not a rename but a
> *different add-on*: installed copies will not update across it, and the old ID
> stays claimed. Confirm it reads as intended before the first signed upload,
> whichever channel that upload uses.

It must also match the ID of the AMO listing if one is created.

### Step 3 — Declare Android compatibility (done)

AMO only marks an add-on installable on Firefox for Android if its manifest
declares `browser_specific_settings.gecko_android`. Without it the signed `.xpi`
is desktop-only and the AMO listing shows no Android install button, regardless
of whether the code runs fine on a phone. `toFirefox()` in
[`build/gen-firefox.js`](../build/gen-firefox.js) now emits it:

```js
  m.browser_specific_settings = {
    gecko: { id: 'kamran@euspell.org', strict_min_version: '128.0' },
    gecko_android: {},
  };
```

The empty object is deliberate: give it a version range and you narrow Android
support for no benefit, since `gecko.strict_min_version` already sets the floor
at 128 for both platforms.

Confirm it after any change to the build:

```powershell
npm run build:firefox
node -p "require('./build/firefox/manifest.json').browser_specific_settings"
```

### Step 4 — Lint before you sign

Declaring Android support makes the AMO linter check the extension against what
Android's Firefox actually implements, so run it first — a signed submission that
fails review costs you a version number, since AMO rejects a version string it
has already seen:

```powershell
npm run build:firefox
npm run lint:firefox      # web-ext lint --source-dir build/firefox
```

As of the `gecko_android` change the linter reports **0 errors** and three
warnings, none of them Android-specific: the known
`MISSING_DATA_COLLECTION_PERMISSIONS` (see the Notes below) and two pre-existing
`UNSAFE_VAR_ASSIGNMENT` notices about dynamic `import()` calls. So nothing blocks
submission — but *lint passing is not the same as working on a phone*. The popup,
the `commands` keyboard shortcut (phones have no `Ctrl+Shift+9`), and the PDF
viewer are the parts most likely to need mobile-specific handling, and none of
them are covered by the desktop test suite. Test on a real device before you
promote the listing.

### Step 5 — Sign

Publish a GitHub release (the workflow fires automatically, **unlisted**), run
the workflow by hand from the **Actions** tab and choose the channel, or do it
locally:

```powershell
npm run build:firefox
npx web-ext sign --source-dir build/firefox --channel unlisted `
  --api-key $env:AMO_JWT_ISSUER --api-secret $env:AMO_JWT_SECRET
```

**Bump `version` in [`manifest.json`](../manifest.json) before every run** — AMO
rejects a version it has already accepted, and there is no way to replace one.
This is also why the workflow never lists automatically: an accidental listed
submission does not go to the wrong place, it spends that version permanently.

### Choosing the channel

| | unlisted | listed |
| --- | --- | --- |
| Signed | immediately on upload, minutes | after review, days to weeks |
| Distribution | you host the `.xpi` | public AMO listing, searchable |
| Updates | manual, unless you serve an `update_url` | automatic through AMO |
| `data_collection_permissions` | not required | **required for new listings** |
| Firefox floor | stays at **128** (current ESR) | forced to **140**, dropping ESR |
| Source-code submission | not required | required — the package contains rollup output |
| Listing metadata | none | name, summary, description, categories, screenshots, icon, licence, privacy policy URL |
| Installable on Android | awkwardly — Firefox for Android cannot install an `.xpi` from a URL; the user downloads the file and installs it from local storage | **yes**, directly from the listing |

**Unlisted is the way to a working Firefox build quickly**, and it is what the
workflow does by default. It is a real install on release Firefox — the signature
is what matters, not the catalogue entry — and it keeps the ESR 128 floor that a
listing would cost.

**Listed is the way to reach people who have not heard of the project**, and the
only practical route on Android. Take it when the two costs below are a
considered choice rather than a deadline's side effect.

### The unlisted route, end to end

1. Set the credentials (Step 1). Nothing else is required.
2. Run **Actions ▸ Sign Firefox add-on ▸ Run workflow**, channel `unlisted`.
3. Download the **`firefox-xpi`** artifact from the run. Listed submissions
   produce no file — this artifact is the point of the unlisted channel.
4. Host the `.xpi` where users can reach it: attached to the GitHub release, or
   under `public/` on the website.
5. Users install it by opening the `.xpi` in Firefox, or dragging it onto the
   window. It stays installed across restarts, which an unsigned temporary
   add-on does not.

> **Serve it as `application/x-xpi`.** A host that sends `text/plain` or
> `application/octet-stream` makes Firefox download the file rather than offer to
> install it, which reads to the user as a broken link. This is the one thing
> that catches people out about self-hosting.

For automatic updates, add `browser_specific_settings.gecko.update_url` pointing
at a JSON manifest you host, listing each version and its `.xpi` URL. Without it
the add-on is installed permanently but never updates itself, and users have to
be told when a new version exists. Worth doing before the second release, not the
first.

### What a listed submission additionally needs

- **`data_collection_permissions` in the manifest.** AMO requires it for new
  listings. The key only exists from Firefox 140, so
  [`build/gen-firefox.js`](../build/gen-firefox.js) omits it deliberately —
  including it makes the add-on fail to load on anything older with "unexpected
  property". Adding it therefore means raising `strict_min_version` from 128 to
  140 in the same change, and **that drops the current ESR line**. Re-run
  `npm run lint:firefox` afterwards; the standing
  `MISSING_DATA_COLLECTION_PERMISSIONS` warning is the one this clears.
- **A source-code submission.** The staged package contains rollup output, which
  AMO treats as machine-generated code a reviewer cannot read. Supply the source
  and the build instructions — `npm ci && npm run build:firefox`, Node 24 — which
  is straightforward here because the repository is public, but it is a step most
  people do not expect.
- **The listing itself**: name, summary, description, categories, screenshots,
  icon, licence (GPL-3.0-or-later), and a live privacy policy URL. Most of this
  exists from the Chrome Web Store submission and can be reused.

## Not signed, and why that's fine

The word-processor add-ins from [installing-addins.md](installing-addins.md) have
no signing step, on any platform:

- **LibreOffice (`.oxt`)** — LibreOffice has no supported toolchain for signing
  an extension package. `unopkg add` installs it unsigned; the security boundary
  is that the user built it from this repo themselves.
- **Microsoft Word** — an Office web add-in is a web page, not code Windows
  executes. What looks like signing there is TLS: `office-addin-dev-certs`
  installs a locally-trusted certificate so `https://localhost:3000` loads, or
  GitHub Pages supplies the certificate when the add-in is hosted. Neither is
  code signing. (A VSTO add-in *would* need Authenticode — that's not what this
  is.)
- **Google Apps Script and Apple Pages** — source pushed to Google's servers, and
  a local JXA script. Nothing to sign.

## Notes

- **Store signatures aren't yours to keep.** If the Chrome listing is ever taken
  down or transferred, the extension ID and its signature go with it. The
  self-hosted `.crx` key in the Windows section is the only signing key this
  project would ever own, and only if you go the enterprise-policy route.
- **`data_collection_permissions` is a listing cost, not a signing cost.** It is
  required for new AMO *listings* and irrelevant to unlisted signing, which is
  the distinction that decides whether the Firefox floor stays at 128. Full
  reasoning in [What a listed submission additionally needs](#what-a-listed-submission-additionally-needs)
  and in the comment in [`build/gen-firefox.js`](../build/gen-firefox.js); decide
  it once, for desktop and Android together.
- **One version number, four stores.** `manifest.json`'s `version` drives Chrome,
  Edge, Firefox desktop and Firefox Android. Bump it once per release and submit
  the same build everywhere, so a bug report's version string means something.

## Sources

- [Firefox Extension Workshop — Developing extensions for Firefox for Android](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/)
- [MDN — `browser_specific_settings`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)
- [Firefox Extension Workshop — Installing self-distributed extensions](https://extensionworkshop.com/documentation/publish/install-self-distributed/)
