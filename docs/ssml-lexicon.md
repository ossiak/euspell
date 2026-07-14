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

The lexicon is built **one encoding category at a time**, in **General American**
(CMUdict's dialect), with one IPA file per stage.

- **`build/derive-ipa.py`** — derives a category's IPA from **CMUdict** (123K
  entries, ARPABET + stress) via an ARPABET→IPA converter. Args
  `--enc <code> --syllables <n>`. For a `101` entry the euspelling is a homophone
  of the headword (only novel euspell graphemes are `qh` = /tʃ/, `uw` = /aʊ/), so
  the pronunciation is the headword's; the CMUdict vowel count also gives a
  correct syllable filter.
- **`data/euspell_ipa_101.csv`** — stage 1: the 568 one-syllable `101`
  euspellings whose headword is in CMUdict.
- **`data/euspell_ipa.csv`** — the dialect-neutral function-word reforms (`iz`,
  `ih`, + sentence-initial capitals). The stress-shifting NN2|VVZ diatones are
  deferred to the **012 stage**, where they will be built from CMUdict's
  noun/verb stress variants.
- **`build/gen-pls.js`** (`npm run gen:pls`) — reads every `data/euspell_ipa*.csv`
  category file, dedups, validates each grapheme against the lexicon's headwords
  and new spellings (allowing sentence-initial capitals), and emits
  **`dict/euspell_tts.pls`** (W3C PLS 1.0, one role-free `<lexeme>` per grapheme).
- **`dict/euspell_tts.pls`** — the generated lexicon (currently 572 lexemes).

Known gaps in stage 1: **286 one-syllable `101` euspellings are missing from
CMUdict** — obscure/archaic stems (`chough`, `gowk`, `qualm`) and inflected forms
(`brights`, `chards`). The regular plurals can be derived from their singular by
the `-s`/`-z`/`-ɪz` rule; the rare stems need manual IPA or another source.
