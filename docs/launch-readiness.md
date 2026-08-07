# Launch readiness — internal

**Not for distribution.** This is the working note behind
[press-kit.md](press-kit.md) and [press-release.md](press-release.md): what still
has to be true before either of those can be sent. Nothing here should ever reach
a journalist — it is an inventory of gaps, and reads like one.

**Last updated:** 31 July 2026

---

## Availability: the honest status

As of 31 July 2026 the project has a live domain but **little a journalist can
read, download, or link to**:

| | |
| --- | --- |
| Website | [euspell.org](https://euspell.org) is **live**, but serves only a "Coming soon" splash. `www.euspell.org` does not resolve at all |
| Shop | [shop.euspell.org](https://shop.euspell.org) is **live** — a Fourthwall storefront selling logo tees and hoodies. It is currently the only public page with real content on it, and it carries no explanation of what euspell is |
| Site content | **Written but not deployed** — 17 pages (rationale, principles, encoding, disambiguation, per-tool guides) exist in the codebase; every one currently returns 404 |
| Source repositories | **Private** — although the white paper states the source and lexicons are GPL-3 and available at `github.com/ossiak/` |
| Browser extension | **Not published** — the Chrome Web Store link is still a placeholder. The Safari build is development-signed only: no notarized or App Store build exists |
| Eupub v0.2.2 | Released, but **on a private repo**, so downloads are not publicly reachable |

**The cheapest fix by far is deploying the site**, whose writing is already done.
The most urgent, though, is the repository visibility: the white paper publicly
promises GPL-3 source at a URL that currently 404s for everyone but the author.
Anyone who reads the paper and follows that link will conclude the project is
vapourware.

**The paper is deliberately being held until the repositories are public**, which
is the right order — publishing it first would spend credibility that is hard to
win back. The kit becomes sendable at the same moment the paper does, and the
table above is what has to change before then.

**Minimum before outreach:** deploy the content pages, make the repositories
public (or publish the extension), and put real product links in the kit. Until
then the strongest realistic play is a private preview — the kit, the white
paper, and a demo video, sent directly.

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
| Product screenshots | ❌ **Needed** — before/after web page, Eupub, Word task pane |
| Demo video / GIF | ❌ **Needed** — the reform is best understood in motion |
| Founder bio | ❌ Needed — text only; no photographs of the founder |

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
  quotes that need approving or rewriting. Its own pre-send checklist tracks these.
- **Version numbers drift.** The kit states browser extension 0.2.0 (unreleased)
  and Eupub 0.2.2. Re-check both against the shipped builds on launch day.
