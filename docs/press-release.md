# Press release — launch day

*Draft. Everything in `[BRACKETS]` must be filled or removed before this is sent.
Companion to [press-kit.md](press-kit.md), which stays the reference document;
this is the announcement. The quotes below are proposed wording for Kamran Ossia
to approve, edit, or replace — they are not statements anyone has made yet.*

---

<!-- markdownlint-disable-next-line MD036 -->
**FOR IMMEDIATE RELEASE**

## English spelling gets a software update

### Euspell, a conservative reform of English spelling, launches as a free browser extension, e-reader and word-processor add-ins — with the whole system open source

**[CITY, COUNTRY] — [DAY MONTH 2026]** — Four hundred years of proposals to fix
English spelling have failed for the same two reasons: they asked people to apply
rules by hand, and they had no way to decide whether *read* rhymes with *reed* or
*red*. Euspell, released today, treats both as engineering problems and solves
them in software.

Euspell is a reformed English spelling that arrives as working programs rather
than a manifesto. A browser extension rewrites web pages and PDFs as you read
them; the Eupub e-reader does the same for EPUBs; add-ins convert documents in
Microsoft Word, LibreOffice Writer, Google Docs and Apple Pages. Every conversion
runs on the user's own device. There is no account, no server and no telemetry,
and no text is ever uploaded. All of it is free, and the source and lexicons are
published under the GPL-3.

At the centre is a 205,500-word lexicon in which each word carries its parts of
speech alongside its reformed spelling, plus a classifier that reads surrounding
words to settle the cases a rule cannot. That is what lets *records* the noun and
*recordz* the verb come out right without anyone intervening — a distinction no
previous reform could make, because no previous reform could see context.

"Spelling reform never failed on the idea. It failed on delivery," said Kamran
Ossia, who created the project. "Ask a million people to apply a table of rules
consistently and they won't, so the reform fragments. Ask a program and it is
consistent by construction. The interesting work stopped being linguistic and
became computational some time ago — the reform just hadn't noticed."

The reform is deliberately restrained. There are no new letters and no
diacritics, proper nouns are left alone, and 164,190 of the lexicon's entries —
almost exactly four fifths — are not touched at all. *School*, *knife*,
*because*, *said* and *psychology* are all unchanged. Words that do change keep
their silhouette: *night* becomes *niht*, *friend* becomes *frend*, *people*
becomes *peeple*. Some changes are restorations of spellings English used to
have, including *debt → dett*, *tongue → tung* and *build → bild*.

The most visible change is that third-person verbs end in `-z` while plural nouns
keep `-s` — which means *it's* ceases to exist, becoming *it'z*, while *its*
stays as it is. The confusion behind one of English's most-corrected errors
disappears by construction rather than by instruction.

Conversion is also reversible. Because the reform is applied at reading time and
can be switched off, adopting it is closer to changing a rendering preference
than to changing a language, and it requires no one else's agreement.

"You can turn it off," Ossia said. "That is the whole argument. Every earlier
reform needed the world to agree before anyone could benefit. This one needs one
person to click a button, and if they hate it they click it again."

The project also publishes machine-readable outputs: a 34,000-word pronunciation
lexicon with IPA for speech synthesis, and a 46,000-entry part-of-speech lexicon
for grammar checkers — addressing a cost of English orthography that falls on
software as much as on readers.

Euspell and Eupub are available today at
[euspell.org](https://euspell.org). The browser extension is on the
[Chrome Web Store](https://chromewebstore.google.com/detail/euspell/jijbndkdmbmomfmgblomkkejjgdnemja),
which also serves Edge, Brave and Opera; Eupub for Windows, macOS, Linux and
Android is at
[github.com/ossiak/eupub/releases](https://github.com/ossiak/eupub/releases). The
source is at [github.com/ossiak/euspell](https://github.com/ossiak/euspell). The
white paper describing the reform in full, *Spelling Reform: An Engineering
Approach*, is at `[PAPER URL]`.

### About Euspell

Euspell is a reformed English spelling delivered as software rather than a
proposal. A 205,000-word lexicon and a context-aware converter rewrite English
into a more predictable spelling — in the browser, in EPUBs and PDFs, and in
Word, LibreOffice and Apple Pages. Everything runs locally; no text is ever
uploaded. Euspell is free and open source under the GPL-3.

### Media contact

Kamran Ossia
[kamran@euspell.org](mailto:kamran@euspell.org)
[euspell.org](https://euspell.org)

Press kit, logo, screenshots and demo video: `[URL]`

<!-- markdownlint-disable-next-line MD036 -->
**###**

---

## Notes to editors

*Not part of the release. Delete before sending, or keep as a fact annex —
journalists generally welcome it.*

- **Key figures.** 205,500 lexicon entries · 41,310 spellings change (about 1 in
  5) · 164,190 unchanged (79.9%) · 5,905 words need context to choose between
  spellings · noun/verb `-s` disambiguation is 94% accurate (SVM) · pronunciation
  lexicon 34,000+ words · POS lexicon 46,000+ entries, Penn Treebank tags ·
  tagset CLAWS-7 (138 tags, University of Lancaster).
- **Reform revision r1.** The spelling standard is versioned independently of the
  software, so every product declares which revision it was built against.
- **Ports are pinned.** The reform is re-implemented in Python and Apps Script
  for the non-JavaScript hosts, and each port is locked to the JavaScript engine
  by a shared fixture suite — the same sentence cannot reform differently in Word
  than in the browser.
- **AI assistance is disclosed.** The white paper credits Claude Opus 4.8 and
  Fable 5 for software development, website design and video. The lexicon itself
  is authored, not generated; machine learning is used narrowly, to choose which
  of two existing spellings applies in context.
- **Contributors.** Kevin Ossia (first browser-extension version) and Roya Ossia
  (lexicon), both also testing.
- **Logo.** ჱ — Unicode U+10F1, the Georgian letter "archaic he", in blue
  (#0000FF).

## Pre-send checklist

- [ ] Dateline city and launch date filled in
- [ ] Both quotes approved or rewritten by Kamran Ossia
- [x] Repositories actually public — the release links to them
- [x] Extension live in the Chrome Web Store (published 17 August 2026)
- [ ] `[PAPER URL]` filled in — depends on the site deploy below
- [ ] Website content pages deployed (currently 404 — see
      [launch-readiness.md](launch-readiness.md#availability-the-honest-status))
- [ ] White paper published at a real URL
- [ ] Logo as SVG/transparent PNG, screenshots and demo video hosted somewhere
      linkable
- [ ] Eupub download reachable without a private-repo login

## Alternate headlines

Headlines get rewritten by the outlet anyway, but the one you lead with sets the
angle:

| Headline | Angle |
| --- | --- |
| English spelling gets a software update | Neutral, tech-desk framing |
| The spelling reform you can switch off | Leads with reversibility — the strongest single differentiator |
| "It's" is abolished | Leads with the most relatable hook; risks looking gimmicky in a trade outlet |
| Four hundred years of failed spelling reforms had a software problem | Leads with history; best for features and long-form |
