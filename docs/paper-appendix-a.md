# Appendix A. Getting Euspell

*Draft for the white paper (*Spelling Reform: An Engineering Approach*). It
replaces Appendices A, B and C of the published paper — the browser extension,
Eupub, and the word-processor add-ins — with a single pointer to the maintained
instructions online.*

*This is a deliberate reduction in what the paper claims. The published
appendices ran to several pages of install steps and were wrong in both
directions within weeks: they walked readers through SmartScreen and Gatekeeper
overrides for binaries that are now signed and notarized, while announcing an App
Store listing and a Firefox listing that were never submitted. Install routes
change on store-review time and platform time, neither of which is paper time.
The instructions now live beside the code, are updated in the same commit as the
thing they describe, and are quoted here only far enough to tell a reader where
to go.*

*Three claims in the paper's body are outside this appendix's reach and still
need correcting: §Browser extensions says the extension is "available for Chrome,
Edge, Firefox, and Safari", §Epub and text says Eupub is "available for … iOS"
and "also handles PDF files on mobile devices" — PDF is handled on all five
platforms, not only mobile, and the iOS build has not been published.*

*Every URL in this appendix was checked and resolves, with one dependency: the
conversion game is staged into the website at `/game/` and goes live with the
site deploy. Until the content pages are up, that address 404s along with the
rest of them.*

---

Everything described in this paper is free software under **GPL-3.0-or-later**,
and everything runs on the reader's own device. There is no account, no server,
and no telemetry: each tool carries its own copy of the lexicon, and every
conversion is performed locally.

## A.1 Where to start

**[euspell.org](https://euspell.org)** is the front door. It carries the current
download links for whichever tools have reached a store or a release, and it is
the one address worth writing down.

The browser extension is on the **Chrome Web Store**, which also covers Edge,
Brave, Opera and other Chromium browsers:
<https://chromewebstore.google.com/detail/euspell/jijbndkdmbmomfmgblomkkejjgdnemja>

The software and its documentation are in two public repositories:

| Repository | What it holds |
| --- | --- |
| [github.com/ossiak/euspell](https://github.com/ossiak/euspell) | The lexicon, the conversion engine, the browser extension, and the word-processor add-ins |
| [github.com/ossiak/eupub](https://github.com/ossiak/eupub) | Eupub, the standalone EPUB, PDF and plain-text reader |

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

Released Eupub builds — a signed Windows installer, a notarized macOS disk image,
a Linux AppImage, and a signed Android APK — are attached to each release at
[github.com/ossiak/eupub/releases](https://github.com/ossiak/eupub/releases).

## A.3 What a reader can expect to find there

Stated as of **August 2026**, and deliberately not in detail, because this is the
part that dates fastest.

- **The browser extension** is on the Chrome Web Store, which also serves Edge,
  Brave, Opera and other Chromium browsers. Safari has no store listing but does
  have a signed, notarized app to download, drag to Applications, and switch on
  in Safari's settings. Firefox has neither a listing nor a build step: its
  Mozilla-signed `.xpi` is published with the releases, and opening that file in
  Firefox installs it permanently.
- **The word-processor add-ins** have no marketplace listing on any of the four
  platforms. Three are built from source; Word can instead be pointed at a hosted
  manifest and needs no build at all. They are one-pass converters rather than
  live spell-checkers: a command rewrites the document, and nothing is underlined
  as you type.
- **Eupub** ships prebuilt for the three desktop platforms and for Android, whose
  APK is signed with the release key and installs directly. iOS is the exception:
  it is in App Store review, and until that clears, an iPhone build has to be made
  from source on your own hardware.
- **The conversion game** is the one item with nothing to install: a single web
  page that asks the reader to rewrite a passage in euspell by hand and scores
  what they produce against the engine's own output. It needs no server, no
  build, and no network, and it is the quickest way to find out whether the
  reform is learnable — which is a claim this paper makes and a reader is
  entitled to test.

## A.4 If a link has moved

The repositories are the durable anchor, and each is self-sufficient: the
instructions live in the `docs/` directory of the repository they describe, so a
clone or a downloaded ZIP carries the software and its documentation together. A
reader who can reach either repository needs nothing else from this appendix, and
one who can reach neither will find the project's current address through a
search for *euspell*.
