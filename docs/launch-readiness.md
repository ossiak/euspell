# Launch readiness — internal

**Not for distribution.** This is the working note behind
[press-kit.md](press-kit.md) and [press-release.md](press-release.md): what still
has to be true before either of those can be sent. Nothing here should ever reach
a journalist — it is an inventory of gaps, and reads like one.

**Last updated:** 15 August 2026

---

## Availability: the honest status

Two of the three blocking gaps closed on 15 August. What a journalist can read,
download, or link to as of that date:

| | |
| --- | --- |
| Website | [euspell.org](https://euspell.org) is **live**, but still serves only a "Coming soon" splash. `www.euspell.org` now resolves too (it did not on 31 July) |
| Shop | [shop.euspell.org](https://shop.euspell.org) is **live** — a Fourthwall storefront selling logo tees and hoodies. It carries no explanation of what euspell is |
| Privacy policy | **Live** at [euspell.org/privacy/](https://euspell.org/privacy/), deployed ahead of the reveal as a standalone page so the Chrome listing could cite it. It is the only content page currently reachable |
| Site content | **Written but not deployed** — 17 pages (rationale, principles, encoding, disambiguation, per-tool guides) exist in the codebase; every one still returns 404 |
| Source repositories | `ossiak/euspell` is **public** (GPL-3.0-or-later) as of 15 August. `ossiak/eupub` is a separate repository and remains **private** |
| Browser extension | **Submitted** to the Chrome Web Store on 15 August, v0.3.0, with publishing deferred so approval does not put the listing live before the reveal. Review pending. The Safari build is development-signed only: no notarized or App Store build exists |
| Eupub v0.2.3 | Released, but **on a private repo**, so downloads are not publicly reachable |

**The site deploy is now the critical path.** It was already "the cheapest fix by
far" — the writing is done — and with the repository and the extension both
handled it is the only remaining gap that is fully within our control. The
extension is out of our hands until review returns.

**The paper's hold condition is satisfied.** It was deliberately held until the
repositories were public, which was the right order; `ossiak/euspell` now is. The
kit becomes sendable once the content pages are deployed.

**Minimum before outreach:** deploy the content pages, and put real product links
in the kit (the store URL exists only once the listing is published). Until then
the strongest realistic play is a private preview — the kit, the white paper, and
a demo video, sent directly.

**One claim to keep honest.** The live privacy policy says the source for *every*
tool is at `github.com/ossiak/euspell`. That is not true of Eupub, which is a
separate private repository — the sentence is being narrowed rather than left to
be discovered. Publishing Eupub would also make it true, but that has its own
prerequisites: it has **no LICENSE file** despite declaring GPL-3.0-or-later, and
it is not independently buildable, importing the engine across the repo boundary
(`../../../euspell_ext/src/content/converter.js`), so a fresh clone cannot build
without `euspell` checked out as a sibling.

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
| Product screenshots | ✅ Four at 1280×800 plus a 440×280 promo tile, in `euspell_game/screenshots/`. Shot for the store listing, but they are the press screenshots too — the hero is the conversion drill scored, which carries before, after and the reason in one frame |
| Demo video / GIF | ❌ **Needed** — the reform is best understood in motion, and this is the asset with the longest lead time. The likeliest thing to slip |
| Founder bio | ❌ Needed — text only; no photographs of the founder |

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
- **Placeholders in the release.** [press-release.md](press-release.md) carries a
  bracketed dateline, store URL, repository URL and paper URL, plus two proposed
  quotes that need approving or rewriting. Its own pre-send checklist tracks
  these. The repository URL can now be filled in; the store URL cannot, until the
  listing is published.
- **Version numbers.** Reconciled on 15 August: the kit states browser extension
  0.3.0 and Eupub 0.2.3, which match `manifest.json` and Eupub's `package.json`.
  Re-check both against the shipped builds on launch day — a rejected store
  upload burns a version number, so the extension's could still move.
