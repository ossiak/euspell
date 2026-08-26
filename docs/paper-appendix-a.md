# Appendix A. Getting Euspell

*Draft for the white paper (*Spelling Reform: An Engineering Approach*). It
replaces Appendices A, B and C of the published paper — the browser extension,
Eupub, and the word-processor add-ins — with a single pointer to the maintained
instructions online.*

*This is a deliberate reduction in what the paper claims. The published
appendices ran to several pages of install steps and were wrong in both
directions within weeks: they walked readers through SmartScreen and Gatekeeper
overrides for binaries that are now signed and notarized, while announcing a
Firefox listing that was never submitted and an App Store listing that arrived
only later. Install routes change on store-review time and platform time,
neither of which is paper time.
The instructions now live beside the code, are updated in the same commit as the
thing they describe, and are quoted here only far enough to tell a reader where
to go.*

*Nothing in the paper's body is left for this appendix to flag. The three claims
earlier drafts listed have all been settled: §Browser extensions promising the
extension "available for Chrome, Edge, Firefox, and Safari" and §Epub and text
promising Eupub "available for … iOS" have both come true, and §Epub and text no
longer confines PDF handling to mobile devices.*

*Every URL in this appendix — the conversion game and each download link
included — was checked against the live site on 25 August 2026 and resolves.*

---

Everything described in this paper is free software under **GPL-3.0-or-later**,
and everything runs on the reader's own device. There is no account, no server,
and no telemetry: each tool carries its own copy of the lexicon, and every
conversion is performed locally.

## A.1 Where to start

**[euspell.org](https://euspell.org)** is the front door, and for most readers
the only address worth writing down: every build is downloaded from the site
itself rather than from a repository, and the two store listings are linked from
the same page.

The browser extension is on the **Chrome Web Store**, which also covers Edge,
Brave, Opera and other Chromium browsers:
<https://chromewebstore.google.com/detail/euspell/jijbndkdmbmomfmgblomkkejjgdnemja>

The software and its documentation are in three public repositories:

| Repository | What it holds |
| --- | --- |
| [github.com/ossiak/euspell](https://github.com/ossiak/euspell) | The lexicon, the conversion engine, the browser extension, and the word-processor add-ins |
| [github.com/ossiak/eupub](https://github.com/ossiak/eupub) | Eupub, the standalone EPUB, PDF and plain-text reader |
| [github.com/ossiak/euspell-game](https://github.com/ossiak/euspell-game) | The conversion game served at [euspell.org/game/](https://euspell.org/game/) |

## A.2 The maintained instructions

Each tool has one install document, kept current with the code it describes.
These are the authoritative versions; where they disagree with this paper, they
are right and the paper is out of date.

| To install | Read |
| --- | --- |
| The **browser extension** — Chrome, Edge, Brave, Opera, Vivaldi, Firefox, Safari | [`docs/installing.md`](https://github.com/ossiak/euspell/blob/master/docs/installing.md) in `ossiak/euspell` |
| The **word-processor add-ins** — Microsoft Word, LibreOffice Writer, Google Docs, Apple Pages | [`docs/installing-addins.md`](https://github.com/ossiak/euspell/blob/master/docs/installing-addins.md) in `ossiak/euspell` |
| **Eupub**, the e-reader — Windows, macOS, Linux, Android, iOS | [`docs/installing.md`](https://github.com/ossiak/eupub/blob/main/docs/installing.md) in `ossiak/eupub` |
| **The conversion game** — any modern browser | Nothing to install: [euspell.org/game/](https://euspell.org/game/) |

The builds themselves come from the site.
[euspell.org/downloads](https://euspell.org/downloads/) gathers every one of them
on a single page: for the browser extension, the Mozilla-signed Firefox `.xpi`
and the notarized Safari disk image, beside a link to the Chrome Web Store
listing; for Eupub, a signed Windows installer, a notarized macOS disk image, a
Linux AppImage and a signed Android APK, beside a link to the App Store listing
for iPhone. The same files stay attached to the tagged release in each
repository, which is where the site takes them from, so a reader who prefers the
repository loses nothing by going there instead.

## A.3 What a reader can expect to find there

Stated as of **August 2026**, and deliberately not in detail, because this is the
part that dates fastest.

- **The browser extension** is on the Chrome Web Store, which also serves Edge,
  Brave, Opera and other Chromium browsers. Safari has no store listing but does
  have a signed, notarized app to download from the site, drag to Applications,
  and switch on in Safari's settings. Firefox has neither a listing nor a build
  step: its Mozilla-signed `.xpi` comes off the same page, and opening that file
  in Firefox installs it permanently.
- **The word-processor add-ins** have no marketplace listing on any of the four
  platforms. Three are built from source; Word can instead be pointed at a hosted
  manifest and needs no build at all. They are one-pass converters rather than
  live spell-checkers: a command rewrites the document, and nothing is underlined
  as you type.
- **Eupub** ships prebuilt for the three desktop platforms and for Android,
  whose APK is signed with the release key and installs directly — all four
  downloaded from the site — and for iPhone from the App Store, free, on iOS 17
  or later.
- **The conversion game** is the one item with nothing to install: a single web
  page that asks the reader to rewrite a passage in euspell by hand and scores
  what they produce against the engine's own output. It needs no server, no
  build, and no network, and it is the quickest way to find out whether the
  reform is learnable — which is a claim this paper makes and a reader is
  entitled to test.

## A.4 If a link has moved

The repositories are the durable anchor, and each is self-sufficient: the
instructions live in the `docs/` directory of the repository they describe, so a
clone or a downloaded ZIP carries the software and its documentation together,
and each tagged release carries the same signed builds the site serves. A reader
who can reach any one of them needs nothing else from this appendix, and one who
can reach none will find the project's current address through a search for
*euspell*.
