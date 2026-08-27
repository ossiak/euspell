# The euspell encoding scheme

Every entry in `data/euspell_lexicon.csv` carries a three-digit **encoding**
alongside its word, part-of-speech tags, and euspelling(s):

```csv
Word,PoS,Encoding,euspelling
records,NN2|VVZ,012,records|recordz
anchors,NN2|VVZ,112,ancors|ancorz
separate,JJ|VV0,102,separat|separate
wind,NN1|VV0,202,wind|wynd
chassis,NN1|NN2,702,shassi|shassis
```

The encoding is not a category label bolted on after the fact. It is the
instruction the conversion engine follows: it says how many spellings the word
has, and therefore whether the engine can substitute blindly or must first work
out which sense is meant. Understanding it is most of understanding how euspell
handles English.

The codes themselves live in `data/euspell_encoding.csv`, one row per code with
a human-readable gloss, so the scheme is data rather than something hard-coded
in the engine.

## Reading the three digits

Each digit answers a separate question, and they are ordered from broadest to
narrowest.

| Digit | Question | Values |
| --- | --- | --- |
| **Hundreds** | What kind of word is this? | `0` core · `1` stem respelled · `2` semantic split · `5` rare or archaic · `6` merges with an existing word · `7` French pronunciation · `8` Scottish pronunciation · `9` abbreviation |
| **Tens** | Which part of the word changes? | `0` the stem itself · `1` an `NN2\|VVZ` ending · `2` a `JJ\|VVD\|VVN` ending · `3` an undoubling consonant before the ending · `4` a doubling consonant before the ending · `5` a non-`-ate` heteronym |
| **Units** | How many euspellings does it have? | `0` none — unchanged · `1` one · `2` two · `3` three · `4` four |

So `112` reads: *stem respelled* (1) *plus an `NN2|VVZ` ending* (1) *with two
spellings* (2) — which is exactly *anchors* → `ancors` (noun) or `ancorz`
(verb).

### The units digit is the one that matters most

The engine branches on the units digit before anything else:

```js
const variants = entry.encoding % 10;
```

- **0** — the word is unchanged. Copy it through and stop.
- **1** — there is exactly one euspelling. Substitute it. No context needed, no
  ambiguity possible; this is the overwhelming majority of reformed words.
- **2, 3, 4** — the word is a homograph. The engine must decide which spelling
  the context calls for, and *that* is where the hundreds and tens digits start
  to matter, because they say what kind of question is being asked.

This split is why conversion is fast despite the lexicon being large. Of 205505
entries, 164100 are unchanged and 35485 have a single spelling — 97% of the
lexicon is resolved without ever consulting a tagger. Only 5920 entries, under
3%, are ambiguous enough to need one.

## The full scheme

Counts are entries in the current lexicon.

### `0xx` — core words, stem unchanged

The regular cases: either nothing changes, or only an inflectional ending does.

| Code | Meaning | Count | Example |
| --- | --- | ---: | --- |
| `000` | no new spelling | 158849 | `cat`, `the` |
| `011` | `VVZ` ending | 5984 | `abandons` → `abandonz` |
| `012` | `NN2\|VVZ` ending — **two spellings** | 4916 | `records` → `records` / `recordz` |
| `021` | `JJ\|VVD\|VVN` ending | 4703 | `abandoned` → `abandond` |
| `022` | `JJ\|VVD\|VVN` ending — **two spellings** | 5 | `blessed` → `blessd` / `blessed` |
| `041` | doubling consonant before the ending | 3 | `reneging` → `renegging` |

`011` is the single most characteristic rule in the reform: the third-person
singular verb ending becomes `-z`. It is a **grammatical** marker, not a
phonetic one — `walks` → `wahkz` and `hits` → `hitz` take the `-z` even though
the sibilant is a plain /s/. What it marks is the verb, and `012` is what
happens when the same surface form is also a plural noun, which keeps its `-s`:
the reason *the records* and *she recordz* diverge, and *hits* the noun sits
beside *hitz* the verb.

This matters when reading the generated pronunciation lexicon: a `-z` spelling
frequently carries an /s/-final IPA, and that is correct rather than a defect.

### `1xx` — the stem is respelled

The stem changes, optionally along with an ending.

| Code | Meaning | Count | Example |
| --- | --- | ---: | --- |
| `101` | stem | 14568 | `abductive` → `abductiv` |
| `102` | stem, **two spellings**, one of them `VV0` | 155 | `separate` → `separat` / `separate` |
| `103` | stem, **three spellings** | 5 | `slough` → `sluff` / `slouh` / `sluh` |
| `111` | stem + `NN2\|VVZ` ending | 1459 | `absolves` → `absolvz` |
| `112` | stem + `NN2\|VVZ` ending, **two spellings** | 746 | `abuses` → `abuses` / `abuzez` |
| `113` | stem + `NN2\|VVZ` ending, **three spellings** | 3 | `winds` → `winds` / `windz` / `wyndz` |
| `114` | stem + `NN2\|VVZ` ending, **four spellings** | 5 | `bows` → `bows` / `bowz` / `buws` / `buwz` |
| `121` | stem + `JJ\|VVD\|VVN` ending | 949 | `achieved` → `aqhievd` |
| `123` | stem + `JJ\|VVD\|VVN` ending, **three spellings** | 1 | `sloughed` → `sluffd` / `slouhd` / `sluhd` |
| `131` | stem + undoubling consonant before the ending | 21 | `channelling` → `qhanneling` |
| `152` | stem, **two spellings**, one `VV0`, *not* the `-ate` pattern | 15 | `abuse` → `abuse` / `abuze` |

`102` and `152` deserve a note, because the split between them is recent and
deliberate. Both are part-of-speech heteronyms where one reading is a base-form
verb (`VV0`), so both ask the engine the same question. `102` is very nearly the
English `-ate` stress alternation — *separate*, *adulterate*, *advocate*, where
the verb ends /eɪt/ and the adjective or noun reduces to /ət/ — a productive,
regular pattern covering 152 of its 155 words. The 15 words in `152` are the
leftovers that merely happen to share the shape: *use*, *abuse*, *bear*, *house*,
*live*, *buffet*. They have nothing in common phonologically and are worth
tracking separately so the regular pattern's statistics aren't polluted by them.

**Three rows in `102` are not `-ate` words**, and they are worth knowing about
because the class is otherwise so uniform:

| Word | Spellings | Why it is here |
| --- | --- | --- |
| `expose` | `exposeh` / `expose` | A French `-e` loanword split from its verb on 26 Aug; the noun takes the `-eh` grapheme, the verb keeps its spelling |
| `resume` | `resumeh` / `resume` | The same split, same day |
| `i` | `ih` / `i` | The *Singletons* pronoun, added 27 Aug: `ih` for the pronoun, `i` for the letter and the Roman numeral |

The first two still ask the `VV0` question and reach `is_verb_VV0` normally. `i`
does not — see the caveat under **Which encodings need disambiguation**.

The tens digit `5` was chosen for this class because `4` was already taken by
"doubling consonant" (`041`, `641`), and reusing it would have made the tens
digit ambiguous.

### `2xx` — semantic splits

| Code | Meaning | Count | Example |
| --- | --- | ---: | --- |
| `202` | stem, **two spellings**, decided case-by-case | 60 | `wind` → `wind` / `wynd` |

This is the escape hatch, and its gloss in the CSV is literally "case-by-case".
These are the words where the spelling follows *meaning* rather than part of
speech, so no grammatical rule can reach them. `bass` the fish and `bass` the
voice are both nouns. `row` (a line) and `row` (a quarrel) are both nouns;
*row* the verb rhymes with the first, not the second — which is precisely why it
does not belong in the part-of-speech classes. Each `202` word gets its own
hand-written rule under `src/disambig/semantic/`.

### `5xx` — rare and archaic words

| Code | Meaning | Count | Example |
| --- | --- | ---: | --- |
| `500` | no new spelling | 5087 | — |
| `501` | one new spelling | 85 | `affright` → `affriht` |
| `511` | `VVZ` ending | 295 | `abegges` → `abeggez` |
| `521` | `JJ\|VVD\|VVN` ending | 131 | — |

These mirror the `0xx` and `1xx` shapes but are flagged as rare or archaic. The
distinction earns its keep in the generated dictionaries: a spell-checker can
accept these spellings without a word-frequency list suggesting them.

### `6xx` — merges with an existing word

| Code | Meaning | Count | Example |
| --- | --- | ---: | --- |
| `601` | merges with an existing word | 5980 | `abolitionise` → `abolitionize` |
| `631` | merge + undoubling consonant | 307 | `anvilling` → `anviling` |
| `641` | merge + doubling consonant | 42 | `alloted` → `allotted` |

The `6xx` class is where the reform *removes* a distinction rather than adding
one: two currently-distinct spellings converge on a single euspelling. Most of
this is the British/American `-ise`/`-ize` and `-ll-`/`-l-` split collapsing in
favour of one form. Worth knowing when reading conversion output — a `6xx` word
can look unreformed, because the euspelling it lands on is already a word.

### `7xx` — French pronunciation

| Code | Meaning | Count | Example |
| --- | --- | ---: | --- |
| `700` | no new spelling | 121 | — |
| `701` | stem | 880 | `aboideau` → `abodeau` |
| `702` | **two spellings**, all `NN1\|NN2` | 9 | `chassis` → `shassi` / `shassis` |
| `711` | `VVZ` ending | 4 | `uncoifs` → `uncwaffz` |
| `721` | `JJ\|VVD\|VVN` ending | 26 | `avalanched` → `avalanqhd` |

`702` is a small but distinctive class: French loanwords whose singular and
plural are spelled identically in English but pronounced differently — *chassis*,
*corps*, *croquis*. Current spelling hides the number; euspell exposes it
(`shassi` vs `shassis`), so the engine has to decide singular or plural.

### `8xx` — Scottish pronunciation

| Code | Meaning | Count | Example |
| --- | --- | ---: | --- |
| `800` | no new spelling | 43 | — |
| `811` | `VVZ` ending | 2 | `scraichs` → `scraichz` |
| `821` | `VVD\|VVN` ending | 6 | `peched` → `pechd` |

The smallest group — words whose `ch`/`gh` keeps a /x/ that the general rules
would otherwise respell.

### `9xx` — abbreviations

| Code | Meaning | Count | Example |
| --- | --- | ---: | --- |
| `900` | abbreviation — column 4 is an **expansion**, not a euspelling | 40 | `dr,NNB,900,Doctor` |

`9xx` is the one category that does not describe a spelling change. It marks the
rows where the fourth column means something else entirely: an expansion of the
abbreviation rather than its euspelling. `converter.js` consults abbreviations
only for their part-of-speech tags and never reforms them, so the units digit is
`0` and *dr* comes out as *dr*.

Before this category existed these rows sat at `000`, and nothing downstream
could tell an expansion from a euspelling. Two consequences worth knowing:

- The units-digit invariant (below) appeared to be violated 40 times, so a
  genuine violation had 40 false positives to hide among — which is how
  `diskettes` and the *frisette* family stayed broken.
- `gen-wordlist.js` reads column 4 without checking the encoding, so expansions
  are still being emitted into the Hunspell dictionary as if they were valid
  euspellings — including five multi-word entries (`also known as`,
  `as soon as possible`, `et cetera`, `exempli gratia`, `id est`) that the
  generator's own header notes Hunspell cannot represent. `900` makes that
  fixable; see the note at the end.

The abbreviation list proper is `data/euspell_lexicon_abbreviations.csv`, whose
45 rows are all `900`. Only 40 of them carry a `900` row in the main lexicon:
*max*, *min*, *sen*, *vol* and *vols* are ordinary words that merely share a
spelling with an abbreviation, so their main-lexicon rows stay `000`.

## Which encodings need disambiguation

Eleven codes reach the disambiguation layer, and each is routed to a
different mechanism:

| Encoding | Question asked | Resolved by |
| --- | --- | --- |
| `012`, `112` | plural noun or third-person verb? | linear SVM over context features (`src/disambig/vvz-svm.js`) |
| `102`, `152` | base-form verb, or noun/adjective? | rule-based POS voting (`is_verb_VV0` in `src/disambig/pos.js`) |
| `022` | past participle or adjective? | rule-based POS voting |
| `202` | which sense? | per-word semantic rules (`src/disambig/semantic/`) |
| `702` | singular or plural? | the tagger's `NN2` reading |
| `103`, `113`, `114`, `123` | three or four ways | per-word semantic rules |

The engine dispatches on the encoding rather than on the tag pattern, because
the same `NN2|VVZ` tag set appears in several classes that need different
handling. `converter.js` documents each branch at its `if`.

**The pronoun `I` is routed by a case of its own**, because it is the one `102`
whose split is not verb-versus-noun: `i,PPIS1|ZZ1,102,ih|i` has no `VV0` reading,
so the `is_verb_VV0` branch cannot reach it. Two things answer it between them:

- `convert()` intercepts the surface form `I` **before** the lexicon is
  consulted, because it is the one word whose capitalization is recomputed rather
  than copied — `ih` mid-sentence, `Ih` at a sentence start — and `isPronounI`
  tells the pronoun from the numeral in *Section I* and the letter in *I-beam*.
- `route()` then answers everything else, which is a lowercase *i*: the letter,
  as in *dot the i* or *i before e*. It keeps its spelling.

Added 27 Aug 2026. Before it, the row fell through to `route()`'s `return 0` and
took `ih` unconditionally, so *dot the i* came out *dot the ih*. The same branch
is mirrored in `libreoffice/euspell/engine.py` and
`apps-script/euspell-engine.gs`, which re-implement the dispatch, and in
`lexicon-integrity.test.js`, which asserts every multi-spelling row reaches a
mechanism.

## Notes for editing the lexicon

- **The units digit must match the number of spellings.** They are two
  statements of the same fact, and the engine trusts the digit. A word with a
  euspelling but a units digit of `0` is silently never reformed — the failure
  is invisible, because a word passing through unchanged is exactly what the
  common case looks like. Worth a periodic sweep:

  ```sh
  awk -F',' 'NR>1 && substr($3,1,1)!="9" {n=split($4,a,"|");
    if($4=="[]") n=0; if(n != substr($3,3,1)+0) print}' data/euspell_lexicon.csv
  ```

  The `9xx` skip is what makes this exact — abbreviations hold an expansion in
  that column, not a spelling, so they are the one class where the count is
  meaningless. Before `900` existed the sweep returned 40 rows of noise and a
  genuine bug could hide in it; excluding them, any output at all is now a real
  defect. It **currently returns nothing**, which is the point.

  It last returned something on 27 Aug 2026, and that row was a real defect:
  `garrote,NN1|VV0,000,garrott` — a units digit of `0` beside a euspelling, so
  column 4 was never read and *garrote* alone passed through unchanged while its
  siblings `garote`, `garotte` and `garrotte` all reformed to `garrott`. It
  arrived with the 23 Aug pronunciation pass and was re-coded `101`, matching
  them, the same day it was found. Worth keeping as the worked example of what
  this sweep is for.
- **Multi-spelling entries are order-sensitive.** The pipe-separated spellings
  line up positionally with what the disambiguation rule returns; reordering
  them inverts the decision.
- **Rebuild everything downstream after a lexicon edit.** Nothing reads
  `euspell_lexicon.csv` at run time, so an edit is inert until each consumer is
  regenerated — and every one of them fails silently, by continuing to serve the
  old value:

  | Run | Or else |
  | --- | --- |
  | `npm run build:lexicon` | the extension, the PDF viewer and `npm test` all keep using the previous `dist/lexicon.js` |
  | `npm run gen:lo` | the LibreOffice extension ships the old data |
  | `npm run gen:gas` | likewise the Apps Script port (and `gen:word`, which is built from it) |

  The test suites are not a safety net here. `test:lo` and `test:gas` rebuild
  their fixtures but not the copied lexicon, and `npm test` reads the compiled
  `dist/`, so all three go green against stale data. Regenerate first, then
  test.

- **Every encoding used must exist in `euspell_encoding.csv`.** A malformed code
  fails the same silent way: `diskettes,NN2,10,disketts` carried a two-digit
  `10`, which `% 10` reduces to `0`, so the row read as "no new spelling" and
  *diskettes* never reformed. Now fixed, and the file is currently clean:

  Run it over **all four** lexicon files, not just the main one — `to've` sat
  malformed in the contractions file for exactly as long as `diskettes` did in
  the main one:

  ```sh
  for f in data/euspell_lexicon*.csv; do
    awk -F, -v f="$f" 'NR>1 && NF>=4 && $3 !~ /^[0-9][0-9][0-9]$/ {print f": "$0}' "$f"
  done
  ```

## For anything that reads column 4

The units digit, not the presence of text in column 4, is what says whether a
row has a euspelling. Every generator that reads that column must check it:

```js
if (+encoding % 10 === 0) continue;   // no euspelling, whatever column 4 holds
```

Skipping the check means reading an abbreviation's expansion as if it were a
spelling. That went wrong in three shipped artifacts before `900` made it
visible:

| Artifact | Symptom |
| --- | --- |
| `dict/euspell.dic` | expansions admitted as valid euspell words, five of them multi-word (`also known as`, `et cetera`, …) which Hunspell cannot represent, while the abbreviations themselves were only added incidentally |
| `dict/euspell-word.dic` | 40 expansions (`doctor`, `april`, `circa`, …) offered as reformed spellings |
| `dict/ExcludeDictionaryEN0409.lex` | all 40 abbreviations listed as words euspell never leaves as written — so Word flagged `dr`, `mr`, `mrs`, `etc` as **misspellings** |

`build/lib/euspell-pos.js` had the check from the start, which is why
`gen-pos-lexicon` and `gen-harper-metadata` were never affected. `gen-pls` was
missing it but no abbreviation reaches its IPA source; it has the guard now
anyway.
