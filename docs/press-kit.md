# Euspell — Press Kit

**Last updated:** 16 August 2026 · **Reform revision:** r1

The primary source document is the white paper, *Spelling Reform: An Engineering
Approach* (Kamran Ossia). Every spelling and figure below was read from the
shipping lexicon and cross-checked against the paper.

---

## Boilerplate

Three lengths, ready to paste.

### One line

> Euspell is a conservative reform of English spelling that exists as working
> software — a browser extension, an e-reader, and word-processor add-ins that
> convert what you read and write, entirely on your own device.

### Short (≈50 words)

> Euspell is a reformed English spelling delivered as software rather than a
> proposal. A 205,000-word lexicon and a context-aware converter rewrite English
> into a more predictable spelling — in the browser, in EPUBs and PDFs, and in
> Word, LibreOffice and Apple Pages. Everything runs locally; no text is ever
> uploaded.

### Full (≈120 words)

> Euspell is a reform of English spelling built as an engineering project rather
> than a manifesto. Where past reforms handed people tables of rules to apply by
> hand, Euspell compiles the reform into a program: a 205,000-word lexicon in
> which every word carries its parts of speech and its reformed spelling, plus a
> classifier that reads the surrounding words to settle the hard cases — so
> *records* the noun and *recordz* the verb come out right automatically. It is
> deliberately conservative: no diacritics, no new letters, most words untouched,
> and each word's silhouette preserved (*night → niht*). One engine drives a
> browser extension, the Eupub e-reader, and word-processor add-ins, plus
> machine-readable lexicons for speech synthesis and grammar checking. It is open
> source under the GPL, and every conversion happens on the user's own device.

---

## Fact sheet

| | |
| --- | --- |
| **Name** | Euspell (the reform and the browser extension); **Eupub** (the e-reader) |
| **Tagline** | Spelling Reform: An Engineering Approach |
| **Creator** | Kamran Ossia |
| **Contributors** | Kevin Ossia (first browser-extension version), Roya Ossia (lexicon), both testing |
| **In development since** | June 2026 |
| **License** | GPL-3.0-or-later (all source and lexicons) |
| **Price** | Free |
| **Privacy** | No account, no server, no telemetry. The lexicon ships inside each product; text never leaves the device. Dictation is the one exception — it uses the browser's built-in speech recognition, which transcribes in the cloud |
| **Logo** | ჱ — Unicode U+10F1, the Georgian letter "archaic he", in blue (#0000FF) |
| **Reform revision** | r1 — the spelling standard is versioned independently of the apps |
| **Website** | [euspell.org](https://euspell.org) — live, currently a splash page |
| **Shop** | [shop.euspell.org](https://shop.euspell.org) — live; logo tees and hoodies, fulfilled by Fourthwall |
| **Current versions** | Browser extension 0.3.0 (unreleased); Eupub 0.2.3 |
| **Contact** | [kamran@euspell.org](mailto:kamran@euspell.org) |

---

## The story

**The problem.** English spelling records history, not pronunciation — you must
already know a word to say it. The canonical demonstration is the `-ough` family:
six words sharing four letters and almost nothing else. The cost falls hardest on
learners and readers with difficulties, and on machines: speech synthesisers
mispronounce homographs, and part-of-speech taggers must guess where the
orthography gives no signal.

**Why past reforms stalled.** Proposals go back to Mulcaster (1582), Webster,
Shaw's Shavian alphabet, Carnegie's Simplified Spelling Board, and the Spelling
Society's Cut Spelling. Most share two weaknesses. They are *rule-tables, not
systems* — a human is expected to apply principles consistently, and people
don't, so the reform fragments. And they *ignore ambiguity*: a phonetic
respelling must decide whether *read* rhymes with *reed* or *red*, and a
context-free rule cannot. Some also introduce collisions (*guild → gild*,
*write → rite*) or respell proper nouns, creating legal and administrative
problems.

**What's different here.** Both failures are software problems. Consistency
becomes free, because no human is in the loop at conversion time. And ambiguity
becomes a classification problem — exactly what NLP already does. Conversion is a
deterministic pipeline over a lexicon, so the same input always yields the same
output, and it is applied **reversibly**, so a reader loses nothing by trying it.

---

## Show, don't tell

Every spelling below was read from the shipping lexicon.

**The biggest single change: `-s` → `-z` for third-person verbs.** Plural nouns
keep `-s`; third-person-singular verbs take `-z`. This one change carries most of
the reform's disambiguation value, and it produces the most quotable line in the
project:

| Traditional | Euspell | |
| --- | --- | --- |
| Jim's home | Jim's home | the house of Jim (possessive — unchanged) |
| Jim's home | Jim'z home | Jim has returned (contraction) |
| it's | **it'z** | *it's* ceases to exist; **its** stays as it is |
| is | iz | for consistency with other third-person verbs |

**The `-ough` problem, resolved**

| Traditional | Euspell | | Traditional | Euspell |
| --- | --- | --- | --- | --- |
| through | thruh | | thought | thoht |
| though | thoh | | bough | bouh |
| tough | tuff | | rough | ruff |
| cough | coff | | enough | enuff |

**Two new graphemes — no new letters, no diacritics.** `qh` takes the *tʃ* sound
(so *church → qhurqh*), leaving `ch` unambiguously the *k* sound and keeping
Greek-derived scientific vocabulary untouched. `uw` takes the *aʊ* sound
(*cow → cuw*), inspired by Dutch *ouw*. Both replace ambiguity rather than adding
notation.

**Homographs, decided from context.** *records* / *recordz* is the common case.
The extreme case is four spellings for one written form:

> **tears** → `tears` · `tearz` · `taers` · `taerz`

(likewise *bows*, *rows*, and *sloughs*). The noun/verb `-s` split is resolved by
a support-vector classifier with **94% accuracy**; the paper is candid that it
struggles with minimalist headlines and short phrases where context is thin.

A neat case of the reform choosing meaning over etymology: **bear** splits into
`baer` for the animal — which is what German already writes — and `behr` for
*carry* or *tolerate*, a single letter apart.

**Some reforms are restorations.** A number of words simply revert to spellings
English once used: *debt → dett*, *tongue → tung*, *aghast → agast*,
*anchor → ancor*, *build → bild*, *guard → gard*, *victual → vittle*.

**Most words don't change at all** — *school, knife, because, said, psychology,
record, color* are untouched. Reformed words keep their silhouette: *night →
niht*, *friend → frend*, *people → peeple*, *one → wun*.

---

## By the numbers

| | |
| --- | --- |
| Lexicon entries | **205,500** |
| Entries whose spelling changes | **41,310** — about **1 in 5** |
| — of which merge into an existing American spelling (*colour → color*) | 6,065 |
| — leaving genuinely **new** spellings | ≈ 35,000 |
| Entries left exactly as they are | **164,190** (79.9%) |
| Words needing context to choose between spellings | **5,905** |
| Noun/verb `-s` disambiguation accuracy | **94%** (SVM) |
| Pronunciation lexicon (PLS/XML, with IPA) | **34,000+** words |
| Part-of-speech lexicon (Penn Treebank, for grammar checkers) | **46,000+** entries |
| Part-of-speech tagset | CLAWS-7 (138 tags), University of Lancaster |
| Automated tests · cross-engine fixtures | 251 · 43/43 per port |

The reform is re-implemented in Python (LibreOffice) and Apps Script (Google
Docs, Apple Pages), and each port is pinned to the JavaScript engine by a shared
fixture suite — so the same sentence cannot reform differently in Word than in
the browser.

---

## The product family

One engine, many surfaces. None of them re-implement the reform.

| Product | Platforms | Status |
| --- | --- | --- |
| **Browser extension** | Chrome, Edge, Brave, Opera, Vivaldi; separate Firefox build | Built, **not yet published to any store** |
| **Safari extension** | macOS — an Xcode host app built once and enabled in Safari's settings | Built; **not distributed** (no notarized or App Store build) |
| **Built-in PDF viewer** | Desktop, inside the extension — reforms PDFs while keeping real layout, graphics and fonts, with its own zoom and print | Ships with the extension |
| **Eupub e-reader** | Windows (signed), macOS (signed + notarized), Linux, Android (preview); iOS in progress | **v0.2.3 released** |
| **Microsoft Word** | Windows, macOS, web (Office.js task pane) | Built, source-install |
| **LibreOffice Writer** | Windows, Linux, macOS | Built, source-install |
| **Google Docs** | Any browser (Apps Script) | Built, source-install |
| **Apple Pages** | macOS (JXA automation) | Built, source-install |
| **Dictionary exports** | Hunspell, LibreOffice `.oxt`, Word custom dictionary, Harper, TTS `.pls` | Generated from the lexicon |

Also notable: **in-browser dictation** that types in reformed spelling at the
cursor, and a revert command in all four word-processor tools (in the extension, a
single switch restores original spelling).

---

## Angles for journalists

- **Spelling reform's failure mode was never the idea — it was the delivery.**
  The claim isn't "English spelling is bad"; it's that consistency and ambiguity
  are now solved engineering problems.
- **"It's" is abolished.** The *its/it's* confusion disappears by construction —
  a small, concrete, endlessly relatable hook into the whole system.
- **A reform you can switch off.** Conversion is local and reversible, closer to
  a rendering preference than a language change. Nobody else has to agree.
- **Restraint as the design story.** Four fifths of the dictionary is untouched;
  the engineering went into deciding what *not* to change. No new letters, no
  diacritics, proper nouns left alone.
- **The machine-readability angle.** A 34,000-word IPA pronunciation lexicon and
  a 46,000-entry Penn Treebank POS lexicon make this a text-to-speech and NLP
  story, not only a literacy one.
- **Built with AI assistance, disclosed.** The paper credits Claude Opus 4.8 and
  Fable 5 for software development, website design and video — unusually explicit
  provenance for a project of this scope.

---

## Anticipated questions

**Isn't this just phonetic spelling?** No — deliberately not maximal. A naive
phonetic respelling is unreadable and dead on arrival. Euspell trades phonetic
purity for legibility: change only what earns it, keep the word's shape, and
leave scientific and technical vocabulary largely alone.

**Doesn't it create new confusions?** Collisions are treated as disqualifying. Of
roughly 35,000 new spellings, only a couple collide with rare existing words
(*heart → hart*, *weather → wether*), and both are separable from context. Where
a collision threatened, the spelling was changed to avoid it — *could/should/
would* become *coodd/shoodd/woodd* precisely so they don't collide.

**What about names?** Proper nouns and place names are left alone, explicitly to
avoid legal and administrative problems. Transliterated foreign names may be
respelled; Latin-alphabet names are not.

**Who decides the spellings?** One author, encoded in a versioned lexicon. The
standard carries its own revision number (currently r1), so any change is
explicit and every product declares which revision it was built against.

**Is this AI-generated spelling?** No. The lexicon is authored. Machine learning
is used narrowly — a classifier choosing which of two *existing* spellings applies
in context.

**Is anything still unresolved?** Yes, and the paper says so: distinguishing the
two short *u* sounds (*put* vs *putt*), and the hard/soft *g* problem, where
phonetic spelling would disrupt hundreds of scientific words.

---

## Assets

| Asset | |
| --- | --- |
| White paper — *Spelling Reform: An Engineering Approach* | The primary press document |
| Logo — vector | SVG, transparent, no embedded fonts |
| Logo — raster | PNG, 1250×1248, transparent background |
| Founder bio | Text, in three lengths — [founder-bio.md](founder-bio.md) |
| Animation — the reform in one loop | Animated GIF, 4 seconds, 1200 px, silent. 142 common words in traditional spelling, morphing to euspell and back |
| Animation — long form | 7:13, scored, 142 words one at a time; and a 1:26 cut of 48, with a silent twin |

Product screenshots are available on request. There is no founder photograph.

---

## Founder

Kamran Ossia created Euspell. He received his Bachelor's degree from Sharif
University of Technology and his Master's and PhD from the University of Toronto,
all in Electrical Engineering, specializing in Control Systems, and holds a
second Master's degree in Applied Mathematics from California State University,
Fullerton. He worked as a software engineer in the nuclear power and medical
device industries, and is now retired.

*Longer and shorter forms are in [founder-bio.md](founder-bio.md), which is the
maintained version.*

---

## Contact

- **Press contact:** [kamran@euspell.org](mailto:kamran@euspell.org)
- **Website:** [euspell.org](https://euspell.org)
- **Shop:** [shop.euspell.org](https://shop.euspell.org)
- **Source:** github.com/ossiak/euspell *(public — GPL-3.0-or-later)*. Eupub lives
  in a separate repository that is still private.

*Press are welcome to quote any text in this kit verbatim.*
