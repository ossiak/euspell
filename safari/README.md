# Euspell for Safari (macOS)

The same browser extension that runs on Chrome and Firefox, packaged as a macOS
**Safari web extension**. It reuses the shared `src/` runtime unchanged — Safari
16.4+ accepts the Chrome MV3 manifest essentially verbatim (native `browser.*`,
an MV3 `background.service_worker`), so unlike Firefox there is no manifest
rewrite. A Safari web extension has to be delivered inside a host app, so this
directory is a small Xcode project (Swift, `org.euspell.Euspell`) whose only job
is to carry the extension.

Verified on Safari 26.5. Web-page conversion and remote PDFs work; the platform
limits are listed [below](#what-works).

## Requirements

- **macOS** with **Xcode** (for the host app) and **Safari 16.4+**.
- **Node ≥ 24** to build the extension payload.

## 1. Build the extension payload

```bash
npm install            # once
npm run build:safari   # compiles the lexicon + bundles, then stages into safari/
```

`build:safari` runs the full `npm run build` and then `build/gen-safari.js`,
which copies the runtime into `safari/Euspell Extension/Resources/`. That folder
is git-ignored and regenerable (like `dist/`), so **a fresh clone must run
`npm run build:safari` before the first Xcode build** — otherwise the app builds
with no extension inside it.

Re-run it any time you change anything under `src/` or the lexicon.

## 2. Build & run the host app

```bash
open safari/Euspell.xcodeproj
```

In Xcode, press **Run** (⌘R). This builds the Euspell app, launches it, and
registers its extension with Safari. The project uses **automatic signing** with
a development team; if Xcode complains about signing, pick your own team under
**Signing & Capabilities** for both the *Euspell* and *Euspell Extension*
targets. You can quit the app once it has launched — the extension stays
registered.

> Prefer the command line? `xcodebuild -project safari/Euspell.xcodeproj -scheme
> Euspell build` produces the app under Xcode's DerivedData; open it once to
> register the extension.

## 3. Enable it in Safari

1. **Safari ▸ Settings ▸ Extensions** and turn on **Euspell**.
2. If Euspell isn't listed or can't be enabled, allow development extensions
   first: **Safari ▸ Settings ▸ Advanced**, check **Show features for web
   developers**, then in the new **Develop** menu choose **Allow Unsigned
   Extensions**. This resets every time you quit Safari, so re-enable it after a
   restart (a distribution/App Store build wouldn't need it — this is only for
   the locally-built app).
3. Give it access to pages: open the Euspell entry and set it to **Allow on
   Every Website** (or grant per-site as you browse). Without this it can read
   nothing and pages won't convert.

Open any English page and it appears in euspell. The toolbar icon shows the
state — the normal mark while converting, inverted while off — and clicking it
opens the same popup switches as the other browsers.

## What works

| | Status |
|---|---|
| Web-page conversion | ✅ works |
| Remote (http/s) PDFs | ✅ render in Euspell's viewer |
| Local `file://` pages and PDFs | ⚠️ **not converted** — Safari web extensions cannot read `file://` content, so these stay in Safari's native viewer |
| Extensionless PDFs (no `.pdf` in the URL) | ⚠️ left to Safari's native viewer — the `onHeadersReceived` interception Chrome uses isn't available |

The `file://` limit is a Safari platform restriction, not a bug: there is no
per-extension "allow file access" grant as there is on Chrome. The shared
runtime already detects the `safari-web-extension:` origin and deliberately
leaves local content alone rather than hijacking the native viewer and erroring.

## Distribution (notarized)

To hand the extension to someone who doesn't have Xcode, package the host app
for direct distribution — archive, export with your **Developer ID**, notarize,
and staple — in one command:

```bash
EUSPELL_NOTARY_KEY=/path/to/AuthKey_XXXXXXXXXX.p8 \
EUSPELL_NOTARY_KEY_ID=XXXXXXXXXX \
EUSPELL_NOTARY_ISSUER=<issuer-uuid> \
npm run build:safari:dist
```

This emits two Gatekeeper-approved artifacts in `dist/safari/`, each notarized
and stapled:

- `Euspell-<version>-macos.dmg` — a drag-to-Applications disk image (the
  conventional Mac presentation), signed with Developer ID and notarized as its
  own container.
- `Euspell-<version>-macos.zip` — the same stapled app, zipped with `ditto`.

Recipients open either, move `Euspell.app` to Applications, open it once, and
enable the extension in **Safari ▸ Settings ▸ Extensions** — with no "Allow
Unsigned Extensions" step, because the app and its extension are signed and
notarized.

- Requires a **Developer ID Application** certificate in your keychain.
- Credentials are read **by path**, so nothing secret is written into the repo.
  Instead of the three API-key variables you can point at a stored notarytool
  profile with `EUSPELL_NOTARY_PROFILE` (see `xcrun notarytool
  store-credentials`).
- The signing team defaults to the project's; override with `EUSPELL_TEAM_ID`.
- Both artifacts are named by the app's actual `CFBundleShortVersionString`, so
  they track the project's `MARKETING_VERSION`.
- The disk image is notarized in a **second** submission (a `.dmg` is a new
  signed artifact), so the pipeline waits on Apple twice.

The **Mac App Store** is the alternative route (submit the host app instead of
shipping the `.app`); it needs its own app record and review and isn't covered
here.

## Notes

- **Two ways to install.** Build-from-source (above) for local development, or a
  notarized Developer ID build via `npm run build:safari:dist` for handing out
  — see [Distribution](#distribution-notarized).
- **The Resources folder is generated.** Xcode references `dist/`, `src/`, and
  `icons/` inside it as *folder references*, so it copies whatever
  `build:safari` last staged — no per-file Xcode bookkeeping.
- **Regenerating the whole Xcode project** (only needed to recreate it from
  scratch, which resets the signing config) is documented at the top of
  [`build/gen-safari.js`](../build/gen-safari.js).
