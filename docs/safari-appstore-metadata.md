# Euspell for Safari — Mac App Store metadata (draft)

For a **first** submission of the Safari extension to the Mac App Store. Paste
the fields into App Store Connect (which renders no markdown — the values below
are plain text). Build with `npm run build:safari:appstore` after the app record
exists.

Bundle ID: `org.euspell.Euspell` (host) + `org.euspell.Euspell.Extension` ·
Team 5ZTUW79KSB · Platform: macOS · Category: **Productivity** · Price: Free ·
Age rating: 4+ · Version: **0.3.4**

---

## App Name  (≤ 30 chars)
**Euspell for Safari**

*Alternatives:* `Euspell` (7) · `Euspell — reformed spelling` (27)

## Subtitle  (≤ 30 chars)
**Read the web, respelled**

*Alternatives:* `Reformed spelling, in place` (27) · `English, made regular` (21)

## Promotional Text  (≤ 170 chars — editable without a new build)
Turn any English webpage into euspell — a clearer, more regular spelling — right
in Safari. Context-aware, entirely on your Mac, no account and no tracking.

## Keywords  (≤ 100 chars, comma-separated, no spaces)
euspell,spelling,reform,reader,reading,dyslexia,phonetic,literacy,respell,english,web,extension

## Description  (≤ 4000 chars)
Euspell shows any English webpage in **euspell**, a reformed spelling of English
that is more regular and closer to how words sound — reformed in place, right in
Safari, leaving the page's layout, images, and links untouched.

Flip the toolbar switch and the page you're reading is respelled. Every word is
looked up in a 205000-word lexicon bundled inside the extension and converted by
a context-aware engine, so words whose spelling depends on how they're used —
"read", "wind", "bow" — reform correctly for the sentence they're in. It's not a
blind find-and-replace. Turn it off and the page returns to traditional spelling
instantly.

EVERYTHING HAPPENS ON YOUR MAC
There is no account, no sign-in, no server, and no tracking. The whole dictionary
ships inside the extension; the pages you read never leave your Mac.

WHAT IT DOES
• Reforms the text of any English webpage with a single toolbar toggle.
• Context-aware conversion, chosen from the surrounding sentence — not a blind
  replace.
• Renders remote (http/s) PDFs in a bundled viewer with their text reformed in
  place, keeping the original layout, figures, and fonts.
• Turn reforming on or off per page, instantly, with no reload.
• Fully offline. No permissions beyond reading the pages you choose to convert,
  and no data collection.

ABOUT EUSPELL
euspell is a spelling reform designed to make written English more consistent and
easier to learn, while staying readable at a glance. It falls hardest on people
learning English and readers with reading difficulties that traditional spelling,
which records history rather than pronunciation, asks the most of. This extension
is the easiest way to read the web in it.

USING IT
After installing, open **Safari ▸ Settings ▸ Extensions**, turn on **Euspell**,
and allow it on the websites you want (or every website). Then open any English
page and click the toolbar icon to reform it.

Note: Safari extensions cannot read local files, so pages and PDFs opened from
your own disk (file:// URLs) stay in Safari's own viewer.

## What's New  (release notes, first version)
First release. Read any English webpage — and remote PDFs — in euspell reformed
spelling, right in Safari, entirely on your Mac with no account and no tracking.

## Support URL
https://euspell.org

## Marketing URL  (optional)
https://euspell.org

## Copyright
2026 Kamran Ossia

## Version
`0.3.4` — must match the uploaded build's CFBundleShortVersionString (the Safari
project's MARKETING_VERSION). CURRENT_PROJECT_VERSION (build number) must rise on
every upload of the same version.

---

## App Privacy  (the questionnaire)
**Data collection: NO — "Data Not Collected."** No account, analytics,
identifiers, contact info, usage data, diagnostics, or location. Everything runs
locally. Answer "No, we do not collect data from this app."

## Privacy Policy  (required — already live)
https://euspell.org/privacy/

## Age Rating
**4+** — no objectionable content. Answer "None" to every content-descriptor
question. (The extension displays whatever page the user chooses to visit; that
is Safari's content, not the app's.)

## Export Compliance
**Uses non-exempt encryption: No.** No custom cryptography. Add
`ITSAppUsesNonExemptEncryption = false` to the host app's Info.plist to skip the
prompt on every upload (I can add it).

## App Review notes  (paste into the reviewer Notes — do not skip this)
Euspell is a Safari web extension delivered inside a small macOS host app.

TO ENABLE AND TEST:
1. Open the app once (this registers the extension), then open Safari.
2. Safari ▸ Settings ▸ Extensions ▸ turn ON "Euspell".
3. Open the "Euspell" entry and set it to "Allow on Every Website" (or allow the
   test site) — without access it can read nothing and pages won't convert.
4. Open any English webpage and click the Euspell toolbar icon to reform it; the
   page text switches to reformed spelling in place. Click again to turn it off.
5. To see PDF support, open any remote (http/s) PDF — it renders in the bundled
   viewer with its text reformed.

There is no account or login. The ~205000-word lexicon is bundled in the
extension and conversion runs locally; the extension makes no analytics or
tracking requests. Safari extensions cannot read local file:// content, so those
stay in Safari's native viewer by design.

---

## Screenshots  (macOS — at least one; 1280×800, 1440×900, 2560×1600, or 2880×1800)
Capture in Safari so it's clearly the Safari extension:
1. An English webpage **reformed** (euspell on) — pick a page where the changed
   words are legible.
2. The same page in **traditional** spelling (euspell off), for contrast.
3. The toolbar **popup** with the on/off switch.
4. A **remote PDF** rendered reformed in the bundled viewer.

Legibility matters more than chrome — a reviewer (and a shopper) should be able
to read the reformed words in the shot.

---

## Likely review snags to pre-empt
- **Host-app minimum functionality (Guideline 4.2) — checked, OK.** The host app
  uses the standard Xcode Safari-extension window: it shows whether Euspell's
  extension is on or off and offers a "Quit and Open Safari Extensions
  Preferences…" button (`Euspell/Resources/Base.lproj/Main.html`). That's the
  Apple-provided template Apple accepts for 4.2, so no extra host-app UI is
  needed.
- **Enable flow.** The review notes above are what stop a reviewer from seeing
  "nothing happens" and rejecting; keep them accurate to the shipping build.
