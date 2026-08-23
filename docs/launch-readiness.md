# Launch readiness — internal

**Not for distribution.** This is the working note behind
[press-kit.md](press-kit.md) and [press-release.md](press-release.md): what still
has to be true before either of those can be sent. Nothing here should ever reach
a journalist — it is an inventory of gaps, and reads like one.

**Last updated:** 23 August 2026 — launch moved to 28 August

---

## Availability: the honest status

All three blocking gaps are closed. What a journalist can read, download, or
link to today:

| | |
| --- | --- |
| Website | [euspell.org](https://euspell.org) is **live**. The home page is still the "Coming soon" splash, but three things now sit behind it: [/game/](https://euspell.org/game/), [/privacy/](https://euspell.org/privacy/) and `/downloads/`. `www.euspell.org` resolves too (it did not on 31 July) |
| Shop | [shop.euspell.org](https://shop.euspell.org) is **live** — a Fourthwall storefront selling logo tees and hoodies. It carries no explanation of what euspell is |
| Privacy policy | **Live** at [euspell.org/privacy/](https://euspell.org/privacy/), deployed ahead of the reveal as a standalone page so the Chrome listing could cite it. It is the only content page currently reachable |
| Site content | **Deployed 23 August** — all 22 routes return 200, checked after upload. The deploy also carried the republished paper with the corrected Appendix D counts, the Safari 0.3.2 disk image, and an `.htaccess` that fixes the disk-image MIME type and points 404s at the site's own page rather than the host's |
| Source repositories | Both **public** under GPL-3.0-or-later: `ossiak/euspell` since 15 August, `ossiak/eupub` since 16 August |
| Browser extension | **Live** on the [Chrome Web Store](https://chromewebstore.google.com/detail/euspell/jijbndkdmbmomfmgblomkkejjgdnemja) since 17 August, which also serves Edge, Brave and Opera. The store now serves **0.3.1** (listing checked 23 August), so the `bear` fix is out and adjective-preceded nouns no longer convert to the verb sense. **0.3.2**, built from the corrected lexicon, was submitted 23 August and is in review; the same permission set cleared review for 0.3.1, so the host-permission warning on submission is routine rather than new. The Safari build is a signed, **Apple-notarized** DMG at [euspell.org/downloads](https://euspell.org/downloads/Euspell-Safari-0.3.2-macOS.dmg), rebuilt from the settled lexicon; no App Store listing |
| Eupub | **v0.3.1 released and publicly downloadable** — four signed assets per release: Windows installer (Authenticode), macOS disk image (notarized), Linux AppImage, and an Android APK. **iOS is live on the [App Store](https://apps.apple.com/us/app/eupub/id6801994679)** since 20 August — free, iPhone-only, iOS 17+. The listing reads 0.2.3 against 0.3.1 elsewhere: the same iOS sources, submitted before the mobile version strings were derived from `package.json` |

**The site is deployed, so nothing is on the critical path that we control.**
What remains is waiting: the Chrome store is reviewing 0.3.2, and Eupub 0.3.2
is committed but untagged — pushing the tag is a decision rather than work,
since CI builds and publishes all four signed assets on its own. The two extra
days bought by moving to 28 August are slack against Chrome review, which is
the one queue nobody here can hurry.

**The paper's hold condition is satisfied.** It was deliberately held until the
repositories were public, which was the right order; `ossiak/euspell` now is. The
kit is sendable: the content pages are live, and its licensing and repository
claims were corrected on 23 August.

**Minimum before outreach:** deploy the content pages. That is now the whole
list — the product links the kit was waiting for exist: the Chrome listing is
live, Eupub ships four signed assets per release, and both repositories are
public. Until the pages are up, the strongest realistic play is a private
preview — the kit, the white paper, and the animation, sent directly.

**One claim to keep honest.** The live privacy policy says the source for *every*
tool is at `github.com/ossiak/euspell`. Eupub is a second public repository, so
the sentence is narrow rather than untrue — but it still names one address for
two. Worth widening when the privacy page is next touched.

**One thing Eupub still is not.** It is public and it carries its LICENSE, but it
is not independently buildable: it imports the engine across the repo boundary
(`../../../euspell_ext/...`), so a fresh clone cannot build without `euspell`
checked out as a sibling. That blocks nothing today and is the one real obstacle
to an F-Droid listing.

---

## Asset gaps

The kit's [Assets](press-kit.md#assets) section now lists only what actually
exists, and promises the rest "on request" — which becomes a liability the moment
someone asks. These are what that promise owes:

| Asset | Status |
| --- | --- |
| White paper (*Spelling Reform: An Engineering Approach*) | ✅ The primary press document |
| Logo (800×800 JPG) | ✅ Available |
| Logo — SVG | ✅ `euspell_ext/icons/euspell_logo.svg` — potrace paths, no `<text>`, so no font dependency |
| Logo — transparent PNG | ✅ `euspell_ext/icons/euspell_logo.png` — 1250×1248 RGBA, 91 KB (re-encoded 31 July from an uncompressed 6.0 MB export; alpha unchanged) |
| Product screenshots | ✅ Four at 1280×800 plus a 440×280 promo tile, in `euspell_game/screenshots/`. Shot for the store listing, but they are the press screenshots too — the hero is the conversion game scored, which carries before, after and the reason in one frame |
| Demo video / GIF | ✅ **`Videos/euspell_two_state.gif`** — 142 words in traditional spelling, a half-second morph, the same 142 in euspell, and a morph back. 4.0 s, 1.58 MB, 1200 px, silent, loops. Rendered by [`euspell_yt/render_two_state.py`](../../euspell_yt/render_two_state.py). Two longer cuts of the sequential animation exist as well — `Euspell_word_animation.mp4` (7:13, the standalone YouTube piece) and `Euspell_word_animation_cutB_48.mp4` (1:26, scored, with a silent twin) |
| Founder bio | ✅ [founder-bio.md](founder-bio.md) — three lengths (one line, ~50 words, ~120 words), meant to be sent verbatim. Text only; no photographs of the founder |

Two of the four screenshots were captured by hand from a real Chrome, because
rendering the popup or the PDF viewer headless gives UI with no browser around
it. The sizer resizes whatever file is sitting there and cannot tell a stale
capture from a fresh one, so **those two need re-taking whenever the extension
changes**.

---

## Loose ends in the kit itself

- **Brand blue is `#0000FF` everywhere,** as of 31 July 2026. The kit and release
  had always said `#0000FF`; the `#0000F0` found in the artwork was drift from
  potrace tracing, since the Illustrator originals (`Logo/euspell.ai.svg`) were
  `#0000FF` all along. Corrected in the press logo pair
  (`euspell_ext/icons/euspell_logo.{svg,png}`), all six `Logo/*.svg` tracings,
  the `BLUE` constant in `euspell_ext/build/gen-icons.js`, the six regenerated
  toolbar icons, and the palette comment in
  `euspell_website/src/app/globals.css`. No `#0000F0` remains in any source file.
  Two caches still hold the old value and clear themselves on the next build:
  `euspell_ext/build/firefox/icons/` (refreshed by `npm run build:firefox`) and
  `euspell_website/.next/`, whose stale chunks contain a `text-[#0000f0]` class
  from a superseded version of the home page.
- **No founder photograph.** Deliberate — the kit and release offer a written bio
  only. Do not add one, and decline photo requests rather than treating them as a
  gap to fill.
- **Placeholders in the release.** [press-release.md](press-release.md) is down to
  three: the dateline city, the launch date, and `[PAPER URL]` — which depends on
  the site deploy. The store, download and repository URLs are filled in. Two
  proposed quotes still need approving or rewriting; its own pre-send checklist
  tracks all of it.
- **Version numbers.** Re-reconciled on 23 August: the kit states browser
  extension **0.3.2** and Eupub **0.3.1**. Eupub 0.3.1 is released and downloadable.
  The extension's 0.3.1 cleared review and the Chrome Web Store now serves it, so
  the `bear` fix is out; 0.3.2 was submitted on 23 August and is in
  review. Until it clears, the kit's 0.3.2 describes the Safari download and the
  source release rather than what a Chrome user receives — worth a glance before
  the kit is sent.
  Re-check both against the shipped builds on launch day — a rejected store
  upload burns a version number, so the extension's could still move.
