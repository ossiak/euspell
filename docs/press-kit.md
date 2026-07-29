# Euspell — Press Kit

**Last updated:** 28 July 2026 · **Status:** pre-launch — see
[Availability](#availability-the-honest-status) before pitching. Every figure
here is generated from the repository and can be re-derived on request.

---

## Boilerplate

Three lengths, ready to paste.

**One line**

> Euspell is a reformed English spelling that exists as working software — a
> browser extension, an e-reader, and word-processor add-ins that convert what
> you read and write, entirely on your own device.

**Short (≈50 words)**

> Euspell is a reformed English spelling delivered as software rather than a
> proposal. A 205,000-entry lexicon and a context-aware converter rewrite English
> into a more predictable spelling — in the browser, in EPUBs and PDFs, and in
> Word, LibreOffice, Google Docs and Apple Pages. Everything runs locally; no text
> is ever uploaded.

**Full (≈110 words)**

> Euspell is a reform of English spelling built as an engineering project rather
> than a manifesto. Where past reforms handed people tables of rules to apply by
> hand, Euspell compiles the reform into a program: a 205,000-entry lexicon in
> which every word carries its part-of-speech tags and its reformed spelling, plus
> a disambiguator that reads the surrounding words to decide the hard cases — so
> *records* the noun and *recordz* the verb come out right automatically. It is
> deliberately conservative, changing about one word in five and preserving each
> word's silhouette (*night → niht*). One engine drives a browser extension, the
> Eupub e-reader, and add-ins for four word processors. It is open source under the
> GPL, and every conversion happens on the user's own device.

---

## Fact sheet

| | |
|---|---|
| **Name** | Euspell (the reform and the browser extension); **Eupub** (the e-reader) |
| **What it is** | A reformed English spelling, implemented as software |
| **Creator** | Kamran Ossia |
| **In development since** | June 2026 |
| **License** | GPL-3.0-or-later (all components) |
| **Price** | Free |
| **Privacy** | No account, no server, no telemetry. The dictionary ships inside each product; text never leaves the device |
| **Reform revision** | r1 — the spelling standard is versioned independently of the apps |
| **Tagline** | Spelling Reform: An Engineering Approach |
| **Website** | [euspell.org](https://euspell.org) — live, currently serving a splash page |

---

## The story

**The problem.** English spelling records history, not pronunciation. You have to
already know a word to say it. The canonical demonstration is the `-ough`
family — six words that share four letters and almost nothing else.

**Why past reforms stalled.** Serious proposals go back to Webster and the
Simplified Spelling Board. Most share two weaknesses. They are *rule-tables, not
systems*: a human is handed principles and expected to apply them consistently,
and people don't, so the reform fragments. And they *ignore ambiguity*: a
phonetic respelling must decide whether *read* rhymes with *reed* or *red*, and a
context-free rule simply can't. Proposals either punt on homographs or respell so
aggressively the text becomes unreadable.

**What's different here.** Both failures are software problems. Consistency
becomes free, because no human is in the loop at conversion time — the same
lexicon applies identically to every word, in every tool. And ambiguity becomes a
tagging problem: deciding which spelling *read* takes is exactly the
part-of-speech and sense disambiguation that NLP already does.

The project's own framing: **reform as a reversible function, not a manifesto.**

---

## Show, don't tell

Every spelling below is taken directly from the shipping lexicon.

**The `-ough` problem, resolved**

| Traditional | Euspell |
|---|---|
| through | thruh |
| though | thoh |
| tough | tuff |
| cough | coff |
| thought | thoht |
| bough | bouh |
| rough | ruff |
| enough | enuff |

**Homographs — decided from context, not guessed**

| Traditional | Euspell | Decided by |
|---|---|---|
| the *records* (noun) / he *records* (verb) | records / recordz | part-of-speech model |
| I *read* (present) / I *read* (past) | read / redd | per-word sense rules |
| a *bow* (knot) / to *bow* (bend) | bow / buw | per-word sense rules |
| a *tear* (drop) / to *tear* (rip) | taer / tear | per-word sense rules |

**Most words don't change at all** — *school, knife, because, said, psychology,
record, color* are all untouched.

**Silhouette preserved** — *night → niht*, *friend → frend*, *people → peeple*,
*business → bisness*, *one → wun*. Reformed words stay recognisable at a glance,
which is why fluent readers adapt in minutes.

---

## By the numbers

Computed from `data/euspell_lexicon.csv` on 28 July 2026.

| | |
|---|---|
| Lexicon entries | **205,484** |
| Words that get a new spelling | **41,291** — about **1 in 5** (20.1%) |
| Words left exactly as they are | **164,193** (79.9%) |
| Words needing context to choose between spellings | **5,904** |
| British→American forms merged (*colour → color*) | **6,051** |
| Multi-word phrases · contractions · abbreviations | 542 · 158 · 45 |
| Automated tests in the main repo | **187** |
| Cross-engine validation | 35/35 fixtures per port |

That last line matters more than it looks: the reform is re-implemented in
Python (LibreOffice) and Apps Script (Google Docs, Apple Pages), and each port is
pinned to the JavaScript engine by a shared fixture suite — so the same sentence
cannot reform differently in Word than in the browser.

---

## The product family

One engine, many surfaces. None of them re-implement the reform.

| Product | Platforms | Status |
|---|---|---|
| **Browser extension** | Chrome, Edge, Brave, Opera, Vivaldi; separate Firefox build | Built, **not yet published to any store** |
| **Built-in PDF viewer** | Same — reforms PDFs while keeping real layout, graphics and fonts | Ships with the extension |
| **Eupub e-reader** | Windows, macOS (signed + notarized), Linux, Android; iOS in progress | **v0.2.1 released** |
| **Microsoft Word** | Windows, macOS, web (Office.js task pane) | Built, source-install |
| **LibreOffice Writer** | Windows, Linux, macOS | Built, source-install |
| **Google Docs** | Any browser (Apps Script) | Built, source-install |
| **Apple Pages** | macOS (JXA automation) | Built, source-install |
| **Dictionary exports** | Hunspell, LibreOffice `.oxt`, Word custom dictionary, Harper, TTS `.pls` | Generated from the lexicon |

Also notable: speech-to-text that types in reformed spelling, and a revert
command in all four word-processor tools that converts back to standard English
(in the browser extension, a single switch restores the original spelling).

---

## Angles for journalists

- **Spelling reform's failure mode was never the idea — it was the delivery.**
  The interesting claim isn't "English spelling is bad" (everyone agrees); it's
  that consistency and ambiguity are now solved engineering problems.
- **A reform you can switch off.** Conversion is reversible and local, so this is
  closer to a rendering preference than a language change. Nobody has to agree
  for it to be useful to one reader.
- **Restraint as the design story.** Four fifths of the dictionary is untouched.
  The engineering effort went into deciding what *not* to change.
- **The homograph problem.** Most reform proposals quietly skip it. This one
  treats it as the central task, with a trained model plus per-word rules.
- **Accessibility and literacy.** Predictable sound-from-spelling is most
  valuable to learners, dyslexic readers, and non-native speakers — a natural
  angle for education coverage.

---

## Anticipated questions

**Isn't this just phonetic spelling?** No — it's deliberately not maximal. A
naive phonetic respelling is unreadable and politically dead on arrival. Euspell
trades phonetic purity for legibility: change only what earns it, keep the word's
shape.

**Who decides the spellings?** One author, encoded in a versioned lexicon. The
reform standard carries its own revision number (currently r1) so any change is
explicit and every product declares which revision it was built against.

**Does it break search, copy-paste, or accessibility?** Conversion happens in the
page, and every tool ships a revert. The reform is designed to round-trip back to
standard English.

**Why not just fix the dictionary?** Because spelling reform's hard part is
consistency across every surface a reader touches. That's why the same engine
drives the browser, the e-reader, and four word processors.

**Is this AI-generated spelling?** No. The lexicon is authored. Machine learning
is used narrowly — a part-of-speech model that decides which of two *existing*
spellings applies in context.

---

## Assets

| Asset | Status |
|---|---|
| Logo (800×800 JPG) | ✅ Available |
| Logo — SVG / transparent PNG | ❌ **Needed** — a JPG on a white field is a weak press asset |
| Product screenshots | ❌ **Needed** — before/after web page, Eupub, Word task pane |
| Demo video / GIF | ❌ **Needed** — the reform is best understood in motion |
| Founder photo + bio | ❌ Needed |

---

## Availability: the honest status

As of 28 July 2026 the project has a live domain but **nothing a journalist can
read, download, or link to beyond the front page**:

| | |
|---|---|
| Website | [euspell.org](https://euspell.org) is **live**, but serves only a "Coming soon" splash |
| Site content | **Written but not deployed** — 17 pages (rationale, principles, encoding, disambiguation, per-tool guides) exist in the codebase; every one currently returns 404 |
| Source repositories | **Private** (`ossiak/euspell`, `ossiak/eupub`) — despite the GPL license |
| Browser extension | **Not published** — the Chrome Web Store link in the docs is still a placeholder |
| Eupub v0.2.1 | Released, but **on a private repo**, so the download links are not publicly reachable |

**The cheapest fix by far is deploying the site.** The hard part — the writing —
is already done and sitting in the repository; publishing it turns euspell.org
from a placeholder into somewhere press can actually be sent. That alone makes
this kit usable, before any decision about opening the repos or shipping to the
Chrome Web Store.

**Minimum before outreach:** deploy the content pages, then make at least one
repository public *or* publish the extension, and put the real product links in
this kit. Until then the strongest realistic play is a private preview — this kit
plus a demo video, sent directly.

---

## Contact

- **Press contact:** *TBD* — worth setting up `press@euspell.org` rather than
  publishing a personal address.
- **Website:** [euspell.org](https://euspell.org)
- **Source:** github.com/ossiak/euspell *(currently private)*

*Press are welcome to quote any text in this kit verbatim.*
