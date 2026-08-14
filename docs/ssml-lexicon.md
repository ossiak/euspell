# An SSML Lexicon for Euspell

A design note.

**Purpose.** Read aloud documents that are *already converted to euspell* — so a
text-to-speech (TTS) engine pronounces the reformed spellings correctly,
especially the **new spellings** and the **diatones**. The lexicon is not a
front-end that disambiguates original English; it is a pronunciation dictionary
for euspell orthography.

This purpose matters: reading pre-converted text is a fundamentally easier and
cleaner problem than reading original English, and it makes a standard, role-free
PLS document the ideal mechanism.

## Why a context-free lexicon is enough

The hard problem in English TTS is homographs: `read` (present/past), `records`
(noun/verb), `bass` (fish/music), `wind` (air/turn). The usual difficulty is
that resolving them needs surrounding context, which a context-free lexicon
cannot see.

But **the euspell conversion has already resolved that context** — it baked the
disambiguation into the orthography. Every homograph that mattered has been split
into two **distinct graphemes**, each with exactly one pronunciation:

| Reading | Euspell grapheme | Pronunciation |
| --- | --- | --- |
| `records` noun (NN2) | `records` (unchanged) | `/ˈrɛkɔːdz/` |
| `records` verb (VVZ) | `recordz` (new) | `/rɪˈkɔːdz/` |
| `wind` air (NN) | `wind` (unchanged) | `/wɪnd/` |
| `wind` turn (VV) | `wynd` (new) | `/waɪnd/` |
| `use` noun | `use` (unchanged) | `/juːs/` |
| `use` verb | `uze` (new) | `/juːz/` |

In converted text there is no ambiguity left for the TTS to resolve: `recordz`
means the verb *by construction* — if it were the noun it would be spelled
`records`. So the lexicon is purely **grapheme → phoneme**, which is exactly what
the W3C Pronunciation Lexicon Specification (PLS) is for. No `role` attribute, no
POS taxonomy, no context — one `<lexeme>` per euspell spelling, one `<phoneme>`.

(Contrast: if the lexicon had to read *original* English text, PLS's context-free
design would be a poor fit, especially for the `202` sense pairs and `702`
number pairs that are not part-of-speech distinctions and so cannot be expressed
by a PLS `role`. Reading pre-converted text removes that whole problem.)

## What needs coverage

Exactly the two categories named in the purpose.

### 1. New spellings — mandatory

These are the critical case because they are **non-words** to a standard TTS.
Given `recordz`, `wynd`, `luse`, `iz`, `ih`, `ancorz`, `shassi`, an engine with
no lexicon will spell them out, guess, or mangle them. Every word euspell
respells (encoding `%10 >= 1`) needs an entry, or the audio is wrong. This is the
part that makes the lexicon *essential*, not merely nice to have.

### 2. Diatones — pin both members

A subtlety: for a `012` diatone, only one reading gets a new spelling
(`recordz`); the other keeps the **original English spelling** (`records`). The
new spelling is safe once it is in the lexicon. But the unchanged member is a
real English word that the TTS will pronounce with **its own default**, which is
often the wrong reading.

And the diatone distinction is **stress, not segments**: `records` `/ˈrɛkɔːdz/`
and `recordz` `/rɪˈkɔːdz/` both end in `/dz/`; the difference is which syllable
carries the stress. A TTS cannot infer that from the converted text alone. So the
**base form also needs a lexeme**, pinning `records` to the first-syllable noun.
Per diatone that is two lexemes: the respelled member and the pinned base.

The same applies to every other multi-spelling set — `202` sense pairs (`bass`,
`dove`), `102` heteronyms (`use`), `702` number pairs (`chassis`) — all of which
conversion has already split into distinct graphemes, so they are handled
identically here, with none of the PLS `role` limitations that would block them
when reading original text.

## Scope

Not all ~205K words — only:

- the respelled entries (encodings `011/012/021/022/101/102/111/112/113/114/...`,
  the French `7xx` and Scottish `8xx` classes, etc.), and
- the **unchanged base member** of every multi-spelling set, so the
  still-English-spelled reading is pinned to the intended pronunciation.

Everything at encoding `000` is left to the TTS's native dictionary — those are
ordinary words it already says correctly.

## The one real piece of work: euspell → IPA

Because euspell *is* a phonetic respelling, deriving IPA from the euspell
grapheme is far more regular than English → IPA — largely a rule-based segmental
transduction (`z` -> /z/, `use` -> /juːz/, `wynd` -> /waɪnd/, `iz` -> /ɪz/). Two
things still need per-entry care:

- **Stress** — not recoverable from euspell orthography, and it is the whole game
  for diatones. But it need not be guessed: the lexicon already records which
  member is `NN2` vs `VVZ` (etc.), so stress can be assigned from the POS, or
  hand-authored for the few thousand pairs.
- **Exceptions** — a residue of irregular respellings.

The natural data-model move is an **IPA field indexed to the spellings**:

```text
records,NN2|VVZ,012,records|recordz,ˈrɛkɔːdz|rɪˈkɔːdz
```

Each spelling index already drives conversion; the same index now also yields the
phoneme for that exact grapheme.

## Build path

A `gen-pls.js` reads the lexicon plus the IPA column and emits a single `.pls`
(`alphabet="ipa"`) with one role-free `<lexeme>` per distinct euspell spelling:

```xml
<lexeme><grapheme>recordz</grapheme><phoneme>rɪˈkɔːdz</phoneme></lexeme>
<lexeme><grapheme>records</grapheme><phoneme>ˈrɛkɔːdz</phoneme></lexeme>
<lexeme><grapheme>wynd</grapheme><phoneme>waɪnd</phoneme></lexeme>
<lexeme><grapheme>iz</grapheme><phoneme>ɪz</phoneme></lexeme>
```

The reader (a euspell-document TTS, or any SSML pipeline) references it via
`<lexicon uri="euspell_tts.pls"/>` and feeds it the converted text. Because the
lexicon is context-free, **engine support is also much better** — the patchy
`role`-based homograph handling that varies across Polly / Azure / Google is
never used here, since there are no roles.

## Edge cases

- **Sentence-initial / capitalization** — `Ih`, `Records`. PLS grapheme matching
  is case-sensitive in some engines; emit lowercase entries and rely on
  case-insensitive matching, or add capitalized variants for the high-frequency
  function words (`ih`/`Ih`, `iz`/`Iz`).
- **Homographs euspell did *not* respell** — any homograph left at `000` stays as
  ambiguous to the TTS as normal English; the lexicon cannot fix those without
  context, but they are out of euspell's scope by definition.
- **Alphabet choice** — IPA is the most portable; some engines prefer X-SAMPA or
  a vendor phoneme set, so the generator should be able to emit an alternate
  alphabet from the same IPA source.

## Recommendation

Build a **clean, role-free PLS** over the respelled words plus the pinned diatone
(and other multi-spelling) base forms. The only substantive task is the
euspell → IPA column: rule-based segmental transduction for the regular new
spellings, plus POS-driven (or hand-authored) stress for the diatones, where
stress is the distinguishing feature.

A sensible first step is to prototype `gen-pls.js` together with the euspell → IPA
rules on a small, representative slice — a handful of new spellings and a few
diatone pairs — to validate the segment rules and the stress assignment before
scaling to the full respelled vocabulary.

## Status — what is built

**Rewritten 14 Aug 2026.** This section described a staged pipeline that no
longer exists: the lexicon was once built one encoding category at a time into
`data/euspell_ipa_*.csv` files, which `gen-pls.js` then merged. Those stage files
have been removed — nothing read them any more — and the PLS is no longer
generated at all.

`dict/euspell_tts.pls` is **hand-maintained**, 35,503 lexemes, General American
throughout. `npm run gen:pls` does not write it. What that command now does:

- reads the PLS and the lexicon and prints a **drift report** — spellings the
  lexicon has that the PLS lacks, graphemes the PLS holds that no lexicon row
  mentions, and readings that differ from what it would derive;
- transliterates the PLS into **`dict/euspell_tts_arpabet.pls`**, which *is*
  generated and should never be edited by hand;
- applies **`data/euspell_ipa_overrides.csv`** (155 curated readings) and reads
  **`data/changed_words_IPA.csv`** as its derivation source.

Contractions are covered by **`build/gen-pls-contractions.py`**, because
`gen-pls.js` reads only the main lexicon. Its 104 readings have been merged into
`euspell_tts.pls`; re-running it writes a separate file that is no longer needed.

**`build/derive-ipa.py`** is kept as the tool that derives IPA from CMUdict
(123K entries, ARPABET + stress) if a category ever needs rebuilding, but it is
not part of any build and its outputs are no longer committed.

### Maintaining it by hand

Two invariants catch most faults, and neither is visible by reading:

- **A reform grapheme must match its phoneme.** Every `qh` should have a `tʃ`,
  every `uw` an `aʊ`. Scanning both directions found 49 wrong readings and 44
  suspect spellings — including a whole family where `blowsy` read /oʊ/ while
  `blowzy`, the same word, read /aʊ/ correctly.
- **Only IPA characters.** Latin look-alikes cannot be fixed by eye or by
  find-and-replace — typing `g` produces U+0067, the character already there, not
  IPA `ɡ` U+0261; `ǝ` U+01DD is pixel-identical to schwa. 17 of these were found
  by codepoint scan.

One trap worth stating: the `z` in a euspelling is **grammatical, not phonetic**.
After a voiceless consonant it is /s/ — `getz` is /ɡɛts/ and `it'z` is /ɪts/.
