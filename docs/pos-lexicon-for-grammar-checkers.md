# A POS Lexicon to Help Existing Grammar Checkers

A design/feasibility note.

**Question.** Can a custom lexicon of euspell's new spellings, each carrying a
disambiguated part of speech, be built to help *existing* grammar checkers — even
though euspell does not implement its own?

Short answer: **yes — and it is the same move the SSML pronunciation lexicon makes,
just with POS tags instead of phonemes.** But "help existing grammar checkers" only
pays off for the *open, POS-driven* ones (LanguageTool above all), and only if you
speak their tag vocabulary.

## Why euspell is unusually well-suited to this

A grammar checker's first real step is POS tagging, and its hardest tagging cases
are exactly the homographs euspell reforms. English `records` is `NN2|VVZ` —
genuinely ambiguous; a tagger has to *guess* from context. Euspell has **already
resolved that ambiguity into the orthography**:

- `records` (unchanged member) → `NN2` only
- `recordz` (new spelling) → `VVZ` only

So a euspell-grapheme → POS lexicon can hand the tagger a **narrower, often
unambiguous** tag that it could not have derived on its own. That is a real
information gain, not just repackaging. It is the direct analogue of
`docs/ssml-lexicon.md`: there the split graphemes yield one *phoneme* each; here
they yield one *POS* each. Same source data, same "conversion already baked in the
answer" argument.

## The data is already there to derive it

The lexicon rows carry everything needed — `data/euspell_lexicon.csv`:

```text
records,NN2|VVZ,012,records|recordz     # spelling[0]=NN2, spelling[1]=VVZ
use,NN1|VV0,102,use|uze                 # spelling[0]=noun/adj, spelling[1]=verb
dictate,NN1|VV0,000,[]                   # unchanged → keep full POS
```

The "which spelling = which POS reading" mapping is exactly what `route()` in
`src/content/converter.js` encodes per encoding class (012/112 noun-vs-verb, 102
heteronym, 202 sense, 702 number). A `gen-pos-lexicon.js` would invert that: instead
of *choosing* a spelling from context, it *emits each spelling with the POS subset
that spelling represents*. The SSML note already observes the POS is recoverable
this way ("the lexicon records which member is NN2 vs VVZ"). So this is a
build-script exercise, not new linguistics.

## The catch: it only helps checkers that (a) are open and (b) key rules on POS

| Target | Can consume a POS lexicon? | Verdict |
| --- | --- | --- |
| **LanguageTool** | Yes — its tagger *is* a Morfologik `fullform → lemma → POStag` dictionary you can build | **The real "yes."** |
| **Harper** (Rust, offline) | Uses per-word `WordMetadata` (noun/verb/… + sub-features) | **Yes, in principle** — needs a metadata converter, not the Morfologik file |
| nlprule (Rust) | Reimplements LanguageTool rules on LT's tagger data | Yes, via LT's pipeline — but largely unmaintained |
| Hunspell (LO/Firefox spell) | No POS — spelling only | Stops false spell-flags on euspell words, but doesn't help *grammar* |
| LibreOffice Lightproof | Limited rule engine over the dictionary's tags | Marginal |
| **Word Editor, Google Docs, Grammarly** | Closed; no custom POS injection | **No** — can't be helped this way |

**LanguageTool is the one that makes this worthwhile.** You would:

1. Compile euspell fullforms + tags into LanguageTool's tagger dictionary
   (Morfologik `.dict`), so euspell text gets tagged instead of flagged as unknown
   spelling.
2. Map the CLAWS7 tags → LanguageTool's English tagset — because its existing rules
   match on *its* tags. Feed it C7 tags and its rules won't fire; feed it its own
   tagset and its **existing POS-driven rules (subject–verb agreement, etc.) start
   working on euspell text.**

Two honest limits even with LanguageTool:

- **Surface-keyed rules break.** Many rules match literal English words /
  collocations, not POS. Euspell changes the surface form (`recordz`, `wynd`), so
  those rules silently stop matching until adapted. POS-agreement-type rules
  benefit; word-pattern rules degrade.
- **The bigger immediate value is just making euspell legible.** Without *any*
  lexicon, every reformed word is an unknown token, so the checker can barely
  function on euspell text. Supplying the lexicon is what lets a grammar checker run
  at all — the POS-disambiguation refinement rides on top of that.

## Build — the whole lexicon → LanguageTool tagger dictionary

`build/gen-pos-lexicon.js` (`npm run gen:pos`) reads `data/euspell_lexicon.csv` and
emits `dict/euspell_pos.tsv` in LanguageTool's Morfologik tagger-dictionary source
format (`form<TAB>lemma<TAB>POStag`). One line per (new spelling, LanguageTool tag).

**New spellings only.** The reading that keeps its traditional spelling is excluded:
LanguageTool already knows that word, and a supplemental dictionary can only *add*
tags, never remove a wrong one, so a pin for it does nothing. Only genuinely new
spellings — unknown to LanguageTool, so a supplement gives them a clean,
conflict-free tag — are emitted. (This is why the earlier both-spellings version was
discarded.)

**POS per spelling.** The encoding's last digit is the spelling count; POS is
assigned by how the reform split the word:

- **Single-spelling reforms** (the ~29 K majority): the one new spelling carries the
  word's full tag set — one spelling covers every reading, so nothing to
  disambiguate.
- **Verb heteronyms** (`012` / `112` / `102`): the reform's invariant
  (`converter.js` `route()`) puts the verb reading in spelling[1], so verb tags →
  [1], the rest → [0]. This is where the disambiguation is a real gift — `records`
  (NN2|VVZ) becomes `recordz` = VBZ only.
- **Number pairs** (`702`): the plural is spelling[1], so `NN2` → [1], the rest → [0].
- **Sense / semantic splits** (`202` / `022` / `103` / `113` / `114`): the readings
  share a POS, so POS cannot split them; each new spelling gets the full tag set — a
  correct known-word entry, without false disambiguation.

**Tag crosswalk.** CLAWS7 → LanguageTool's Penn-Treebank-style tagset, e.g.
`NN1→NN`, `NN2→NNS`, `JJ→JJ`, `JJT→JJS`, `RR→RB`, `VV0→VB,VBP`, `VVZ→VBZ`,
`VVN→VBN`, `VVD→VBD`, `VVG→VBG`, `VM→MD`. One trap handled: CLAWS7 `MD` is an
*ordinal numeral*, not a modal, so it maps to `JJ` (Penn tags ordinals as
adjectives); the modal is `VM`. CLAWS ditto tags (`II32`, `NN121`) recover to their
base tag before mapping.

Sample output:

```text
recordz    recordz    VBZ      # verb heteronym: unambiguous verb
uze        uze        VB       # (and VBP)
separat    separat    JJ       # heteronym non-verb reading (and NN)
aahz       aahz       VBZ      # single-spelling reform, full POS
aardwolvs  aardwolvs  NNS
```

Current run: **35236 reformed words → 35989 new spellings → 46735 tagged lines**.
**No tag-occurrence is unmapped** — the
non-standard and typo'd tags this once reported (`VVF`, `VVNK`, `1VVG`, `III`,
`N1`) have since been corrected in the lexicon. The build still reports any that
reappear, and `tests/lexicon-integrity.test.js` now validates the whole PoS column
against `data/claws7-tagset.csv`, so a bad tag is caught even when it sits on an
unchanged row the emitter never reaches.

To use it in LanguageTool, compile the source to a binary FSA dictionary and point a
tagger-dictionary `.info` at it, e.g.

```sh
java -jar morfologik-tools.jar fsa_compile \
  -i dict/euspell_pos.tsv -o euspell_pos.dict
```

Remaining limits:

- **Self-lemma.** The lexicon has no base-form euspellings (singular nouns, bare
  verbs), so each form is its own lemma. POS-driven rules key on the tag, not the
  lemma, so the core value holds; a fuller build would derive euspell lemmas.
- **Sense splits are not POS-disambiguated.** The ~70 semantic pairs (`read`, `bow`)
  get the full tag set on each spelling — they are made known and correctly typed,
  but a checker still can't tell the readings apart by tag alone (nor could it in
  English).

Because only new spellings are emitted, the dictionary purely *adds* tags for words
LanguageTool doesn't know — a clean supplement, never an attempted override of its
own dictionary.

## Build — the same derivation → Harper metadata

Harper (the Rust, offline grammar checker) does not use a Morfologik tagger
dictionary; it carries structured per-word `WordMetadata` (noun/verb/adjective/…
with sub-features like number, tense, degree) and runs POS-aware rules locally. The
disambiguation euspell provides maps cleanly onto that model — `recordz` is a verb,
not a noun — so it is worth a second emitter.

`build/gen-harper-metadata.js` (`npm run gen:harper`) reuses the **same** derivation
module (`build/lib/euspell-pos.js`, shared with the LanguageTool emitter) and
reshapes each new spelling's CLAWS7 tags into a Harper-style `WordMetadata` object,
writing `dict/euspell-harper.json` keyed by spelling:

```json
{
  "recordz":   { "verb": { "forms": ["third_person_singular"] } },
  "uze":       { "verb": { "forms": ["present"] } },
  "separat":   { "adjective": {}, "noun": {} },
  "aardwolvs": { "noun": { "plural": true } },
  "ment":      { "verb": { "forms": ["past", "past_participle"] } }
}
```

A verb accumulates every form its readings carry (`ment` = *meant* is past **and**
past-participle); a spelling that is several parts of speech gets one object with
each (`separat` = adjective and noun). Current run: **34398 spellings** (duplicate
spellings across headwords merge to one key), no unmapped tags.

Two caveats specific to Harper:

- **Format is a prototype.** Harper's exact `WordMetadata` schema and its dictionary
  ingestion path evolve; this JSON is a reviewable, Harper-shaped intermediate whose
  field names must be adapted to the targeted Harper version. The linguistic content
  (which spelling is a plural noun, a 3rd-sing verb) is the durable part.
- **Deepest benefit likely means upstreaming.** Harper's richest metadata lives in
  its curated built-in dictionary; user/custom dictionaries historically get thinner
  metadata (often just "valid word"). Full POS benefit may require contributing
  euspell forms upstream rather than shipping a sidecar file.

## Bottom line

- **Feasible and principled:** derive `euspell-grapheme → disambiguated-POS` from
  the existing lexicon, exactly parallel to the PLS pipeline. No own grammar engine
  needed.
- **Genuinely useful only for open, POS-driven checkers — realistically
  LanguageTool** — and only after crosswalking CLAWS7 to that checker's tagset so
  its existing rules apply.
- **No help for closed checkers** (Word, Google), which can't take a custom POS
  lexicon at all.
- The disambiguated POS is a real gift to a tagger, but expect a **mixed net
  effect** in practice: agreement-style rules improve, surface-string rules need
  adapting.
