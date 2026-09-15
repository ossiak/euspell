# Evaluation — draft section for the paper

Draft prose and tables for the section the paper does not yet have. Every number
here was measured on 3 September 2026 against the committed lexicon and the
committed `src/disambig/vvz-svm.js`, and each is regenerable by the command named
beside it. Nothing is hand-copied from an older draft, which is the failure mode
this document exists to prevent — see [corrections](#6-corrections-made-while-measuring)
at the end.

```bash
npm run eval:vvz                    # NN2|VVZ — prior, rule, SVM, veto ablation
VETO_SWEEP=1 npm run eval:vvz       # the RULE_VETO trade-off curve
npm run eval:shift                  # trained on modern prose, tested on Gutenberg
npm run eval:natural                # the same books, WITHOUT the class enrichment
npm run eval:vv0                    # VV0 heteronyms
npm run eval:clitic-s               # the clitic 's
npm run eval:debouches              # a worked 3-way sense split
npm run gen:svm                     # retrains; prints the model's own held-out score
```

---

## 1. What is being measured, and against what

Most of the reform is a lookup. Of the 205,505 lexicon entries, **5,920 (2.88%)
carry more than one spelling** and cannot be resolved by the lexicon alone: the
surrounding words have to decide. Those are the entries this section is about,
and **5,677 of them — 95.9% — fall under one of the decisions measured below.**

| Encoding | Entries | Decision | Measured |
| --- | ---: | --- | --- |
| 012, 112 | 5,662 | `NN2\|VVZ` — plural noun vs third-person verb | yes |
| 152 | 15 | `VV0` heteronyms — *use*, *house*, *live*, *bear* | yes |
| 102, 202, 702, 022, 114, 103, 113, 123 | 243 | residual ambiguity classes | no |

The clitic `'s` is measured too. It is not a lexicon encoding — it is a single
token type resolved by rule — but it is the highest-frequency ambiguity in the
system by a wide margin, and the reform spells the genitive and the contracted
*is/has* differently, so an error is visible in every paragraph.

**The baseline matters more than the headline.** A reader assumes accuracy is
measured against "always guess the commoner reading", and on `NN2|VVZ` that is
52.8% — which would make any result look extraordinary. It is the wrong bar. The
lexicon already knows every target word, so the honest baseline is a **per-word
prior**: each word's majority reading, counted on the training portion and
applied unseen to the test portion, with no context at all. That scores 88.8%,
and every context model below is reported against it.

The split is by line, index mod 5, held out; `build/rule-vvz.mjs` and
`build/gen-vvz-svm.py` walk the corpora in the same order on a shared counter, so
the two score identical targets. Neighbor tags come from the lexicon candidate
set (`tagWord`), never from the corpus gold tag, and the target's own tag is
blanked — the runtime has no gold tags at conversion time, and scoring against
them would flatter every method in the table.

## 2. Results

> **Read section 4 before quoting anything here.** The corpora these figures are
> measured on, `_corpus_012_112*.txt`, were assembled from separate per-class
> pools and are about seven times verb-enriched relative to the books they came
> from — 52.8% verb against 2.6% in running text. Enriching *training* data for a
> class this skewed is reasonable; the problem is that the same file is split
> 80/20, so the evaluation inherited it. Everything in section 2 is therefore a
> **stress test on a constructed distribution**, which oversamples the hard class
> and is a legitimate thing to report, but it is not what a reader meets.
> Section 4 is the running-text measurement.

### 2.1 The plural/verb decision (`NN2|VVZ`)

289,471 held-out targets over 3,891 distinct word forms; 52.8% gold `VVZ`.
Precision and recall are on the verb reading.

| Method | Accuracy | vs prior | Verb P | Verb R |
| --- | ---: | ---: | ---: | ---: |
| Always the commoner class | 52.8% | — | — | — |
| **Per-word prior (no context)** | **88.8%** | — | 87.5% | 91.9% |
| `vvzScore` — hand-written context rule | 75.9% | −12.9 pt | 90.5% | 60.7% |
| Linear SVM alone | 94.1% | +5.3 pt | 97.2% | 91.4% |
| `is_VVZ_svm` — SVM with the rule's noun vetoes (**shipped**) | 93.2% | +4.4 pt | 97.8% | 89.0% |

The shipped decision **removes 39.1% of the error a context-free lookup makes**,
and the model without the veto removes 47.3%. Those are the claims the system
supports; the +40 points over "always the commoner class" is not a claim worth
making.

Both learned rows sit below where they did before `VERB_THRESHOLD` was
introduced (94.6% and 93.8%). That is the expected direction and it is only true
here: on a set that is 52.8% verb, a threshold of zero is the right cut, and
raising it can only cost. Section 4 is where that constant is derived and where
it pays.

Two findings deserve more than a row.

**The hand-written rule loses to the lookup table.** At 75.9% it is 12.9 points
*below* the per-word prior — it more than doubles that error — and its verb
recall is 60.7%, missing two verbs in five. This is not a failure of its cues,
which are precise (90.5%): it is that the rule carries **no per-word bias at
all**, applying one noun-first default to *makes* (99.8% verb) and *eyes* (0.6%
verb) alike. Context alone is not enough, and a per-word prior alone is not
enough. Only the model, which has both, clears the line. That is the substantive
result about the architecture, and it is worth stating plainly rather than
burying: a spelling reform of this shape cannot be driven by hand-written
grammar rules, and it cannot be driven by word frequencies either.

**The veto is not tuned on accuracy, and the paper should say so.** Blending the
rule's negative votes into the SVM score costs 0.93 points of accuracy and moves
verb precision from 97.2% to 97.8%, recall 91.4% to 89.0%. By held-out accuracy
alone the correct setting for `RULE_VETO` would be zero — accuracy falls
monotonically as it rises. It is set instead from a small set of regression
frames (headlines, noun compounds, clipped noun phrases) that the corpus
*structurally* under-represents, because it is running prose. The binding case is
"The phone calls stopped at midnight", which the SVM alone gets wrong at +0.50
and which needs a veto of at least 0.084 to resolve; the shipped constant is
0.12. This is a real limitation to disclose: **a held-out corpus drawn from prose
cannot score the cases the veto exists for**, so one component of the system is
tuned against judgment rather than measurement.

**Where context earns its place.** The gain is concentrated, as it should be, on
words the prior cannot help with — those near a 50/50 split:

| Word | n | Gold VVZ | Prior | Shipped | Gain |
| --- | ---: | ---: | ---: | ---: | ---: |
| *locks* | 130 | 49.2% | 49.2% | 93.1% | +43.8 |
| *shares* | 375 | 46.4% | 53.6% | 95.5% | +41.9 |
| *plans* | 610 | 48.4% | 48.4% | 89.7% | +41.3 |
| *desires* | 363 | 48.5% | 51.5% | 92.0% | +40.5 |
| *drinks* | 242 | 52.1% | 52.1% | 89.7% | +37.6 |

And it costs where the prior was already near-decisive, the model second-guessing
a word that is effectively unambiguous — *tires* (n=465, −11.8) is the largest
real instance, the rest being small and scattered:

| Word | n | Gold VVZ | Prior | Shipped | Cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| *transforms* | 106 | 100.0% | 100.0% | 87.7% | −12.3 |
| *tires* | 465 | 74.4% | 74.4% | 62.6% | −11.8 |
| *boils* | 115 | 94.8% | 94.8% | 83.5% | −11.3 |
| *pops* | 190 | 98.9% | 98.9% | 87.9% | −11.1 |

This suggests an improvement that is not implemented: **gate the model on the
prior**, letting context override only where a word's base rate is not already
decisive. The material for it is in the lexicon, which knows every one of these
words. It is the clearest piece of future work the evaluation identifies, though
a smaller prize than it first appeared — see the note on *makes* under
[corrections](#6-corrections-made-while-measuring).

### 2.2 The `VV0` heteronyms

81,204 held-out targets across the 15 encoding-152 words. The per-word majority
here is read off the test set, so it is an oracle and slightly optimistic.

| Method | Accuracy | Verb P | Verb R |
| --- | ---: | ---: | ---: |
| Always the commoner class | 63.3% | — | — |
| Per-word majority (oracle, no context) | 85.3% | — | — |
| **`is_verb_VV0` — the shipped rule** | **94.7%** | 95.3% | 89.9% |

63.9% of the oracle baseline's error removed. Unlike the `NN2|VVZ` rule, this one
clears the lookup table comfortably — the class is small enough that its cues
were written against the words that actually occur.

The per-word breakdown shows the same shape and should be reported rather than
hidden in the aggregate. The rule wins large on balanced words, loses small on
skewed ones:

| Wins | Gain | | Losses | Cost |
| --- | ---: | --- | --- | ---: |
| *sow* (49.2% verb) | +35.9 | | *barre* (0% verb, n=5) | −20.0 |
| *misuse* (27.6%) | +26.0 | | *disuse* (0% verb) | −6.3 |
| *reuse* (58.3%) | +25.0 | | *mow* (97.8% verb) | −4.3 |
| *use* (65.2%) | +24.9 | | *buffet* (0.6% verb) | −1.8 |
| *overuse* (33.3%) | +23.5 | | *mouth* (0.2% verb) | −0.7 |
| *bear* (68.4%) | +20.2 | | *house* (1.0% verb) | −0.2 |

*house* is 25,761 of the 81,204 targets and 99.0% noun; the rule costs 0.2 points
on it. The same prior-gating fix applies.

### 2.3 The clitic `'s`

479,290 held-out occurrences. CLAWS labels the clitic itself, so no
hand-annotation is required: `GE` is the genitive, `VBZ`/`VHZ`/`VDZ` the
contracted *is*/*has*/*does*.

| Method | Accuracy | Verbal P | Verbal R |
| --- | ---: | ---: | ---: |
| Always genitive | 60.33% | — | — |
| **`is_verbal_s` — the shipped rule** | **93.12%** | 94.74% | 87.51% |

82.7% of the baseline error removed, on the highest-frequency ambiguity in the
system. There is no per-word prior to beat here — it is one token type — so
"always genitive" is the correct baseline rather than a straw man.

The residual is structured: the commonest word two positions after a *missed*
verbal is sentence-final punctuation, the attributive case the rule cannot see
past.

### 2.4 A worked sense split

The `debouches` three-way split (`debooshehs` / `debouqhes` / `debouqhez`),
300 held-out sentences, 100 per sense, as an example of the per-word semantic
rules:

| Gold | → *debooshehs* | → *debouqhes* | → *debouqhez* | Correct |
| --- | ---: | ---: | ---: | ---: |
| *debooshehs* | 69 | 23 | 8 | 69% |
| *debouqhes* | 1 | 91 | 8 | 91% |
| *debouqhez* | 0 | 2 | 98 | 98% |

86% overall. The confusion is asymmetric and concentrated in one cell, which is
the honest thing to show about a hand-written sense rule at this scale.

## 3. Distribution shift: trained on modern prose, tested on Gutenberg

Everything above is measured in domain — the held-out fifth is the same kind of
text as the training portion. This section is the harder question, and it is the
one an NLP reviewer will ask first: does any of it transfer?

`../CLAWS-tagged-data/gut/` holds 700 CLAWS-tagged Project Gutenberg texts in the
same format, which nothing in the pipeline has ever read. Six were dropped as
duplicates of the fiction corpus under different ids — a content check, not an id
check, because `Epub2_269402p` and `Epub2_269302` are the same book — leaving
**694 texts, 461,245 targets over 3,721 word forms**, all of them unseen.

The class prior moves violently. Contemporary prose runs 52.8% verb over the
target set; Gutenberg runs **10.2%**, a shift of 42.6 points, because
nineteenth-century narrative is past-tense: *his eyes*, *her hands*, *the things*
are everywhere and *she makes* is rare. Per-word tagging rates agree closely
between the two corpora, so this is composition and era, not a tagger artifact.

| Method | Accuracy | Verb P | Verb R |
| --- | ---: | ---: | ---: |
| Always the commoner class (here: always noun) | 89.8% | — | — |
| Per-word prior, **transferred** from modern prose | 87.4% | 44.2% | 92.4% |
| `vvzScore` — hand-written context rule | 92.8% | 63.8% | 67.7% |
| Linear SVM alone | 97.8% | 87.1% | 91.4% |
| `is_VVZ_svm` (**shipped**) | **98.0%** | 90.4% | 89.8% |

Accuracy cannot be compared across the shift — the majority baseline moved 37
points with the prior — so the comparable quantity is error reduction. The
shipped decision removes **80.2%** of the trivial baseline's error here, and
**53.4%** of the error left by a per-word prior *refitted in domain*. That second
figure is the one to quote: in domain the same system removed 44.9%. **Its
contribution is stable across a 42-point shift in the class prior.**

Three findings, and none of them was the expected one.

**Context transfers; word frequencies do not.** The transferred prior scores
87.4% — *worse than the trivial always-noun baseline of 89.8%* — and its verb
precision collapses to 44.2%, meaning more than half of what it calls a verb is a
noun. It fails exactly where you would predict: *matters*, *lives* and *faces*
lean verb in modern prose and noun in Victorian prose, so the table confidently
answers verb and is wrong 93%, 72% and 95% of the time on them. Refitting the
prior in domain recovers 8.2 points. A lookup table is not a portable artifact;
the context model is.

**The rule's in-domain weakness is its out-of-domain strength.** In domain the
hand rule scored 12.9 points *below* the per-word prior. Here it scores 5.4
points *above* it. Nothing about the rule changed — having no per-word bias means
having none to transfer wrongly. This is worth stating in the paper because it
inverts the obvious reading of section 2.1: the rule is not simply the weaker
method, it is the method that degrades least.

**The veto is worth more out of domain than at home**, which is the first direct
measurement of a component that section 2.1 had to describe as tuned against
judgment:

| | SVM alone | Blended | Accuracy | Verb P |
| --- | ---: | ---: | ---: | ---: |
| In domain | 94.1% | 93.2% | **−0.93 pt** | 97.2% → 97.8% |
| Gutenberg | 97.8% | 98.0% | **+0.24 pt** | 87.1% → 90.4% |

The veto exists for shapes the training corpus under-represents. On text the
model has never seen it buys accuracy *and* 3.3 points of precision, where at
home it costs accuracy for 0.6. That is the argument for keeping it, and it is
now evidence rather than assertion.

**What this is not.** Gutenberg is pre-1929 literary fiction, so it cannot
replace either half of the in-domain evaluation: it carries archaic spellings,
its register is narrow, and the genre-robustness result in 2.1 depends on having
contemporary non-fiction. Report it as a transfer experiment, never merged with
or substituted for the numbers in section 2.

## 4. The natural distribution

Sections 2 and 3 both measure on extracted corpora. This one measures on the
books themselves.

`_corpus_012_112*.txt` were assembled from per-class pools — `all_NN2_f.txt`
(1 GB), `all_VVZ_f.txt`, and the per-word `bows_NN2.txt` / `bows_VVZ.txt` pairs
beside them — and the result is far from the source distribution:

| | Targets | Verb rate |
| --- | ---: | ---: |
| `corpus/txt` — raw tagged fiction | 181,078 | **8.6%** |
| `corpusNF/txt` — raw tagged non-fiction | 406,544 | **15.4%** |
| `_corpus_012_112.txt` — extracted fiction | 717,180 | **61.2%** |
| `_corpus_012_112_nf.txt` — extracted non-fiction | 728,479 | **44.7%** |

`build/natural-vvz.mjs` re-extracts every target-bearing sentence from all 12,388
raw files (3.6 GB) with no per-class selection, hashing and excluding every
sentence in the enriched *training* portion so nothing leaks. That yields
5,058,083 sentences, 719,330 of them dropped as training text, and **1,180,299
scored targets over 4,303 word forms at a 2.6% verb rate.**

| Method | Verb F1 | Verb P | Verb R | Accuracy | Errors/10k |
| --- | ---: | ---: | ---: | ---: | ---: |
| Always the commoner class (here: always noun) | 0.0 | — | — | 97.4% | 258 |
| Per-word prior, fitted on the **enriched** corpus | 28.2 | 16.6% | 92.1% | 87.9% | 1,210 |
| Per-word prior, fitted on **running text** | 58.3 | 87.9% | 43.6% | **98.4%** | **161** |
| `vvzScore` — hand rule | 33.0 | 22.8% | 59.9% | 93.7% | 627 |
| Linear SVM alone | 70.7 | 58.3% | 90.1% | 98.1% | 192 |
| `is_VVZ_svm` (**shipped**) | **75.6** | 66.5% | 87.6% | **98.5%** | **146** |

**Accuracy stops discriminating.** "Always noun" scores 97.4%, so accuracy is
dominated by the majority class and section 2's error-reduction framing carries
over badly: the shipped system removes **9.5%** of the natural-fit prior's error
here against 39.1% there. Verb F1 is the metric that survives, and on it the
model is clearly ahead — **75.6 against 58.3** — because it catches 87.6% of
verbs where the prior catches 43.6%.

**This is where `VERB_THRESHOLD` comes from.** At a threshold of zero the same
system scored 71.9 F1, 180 errors per 10,000, and **−12.0%** against the prior —
it made *more* errors than a lookup table. The cause was calibration, not the
model: it was fitted where verbs are 52.8% and asked about text where they are
2.6%, so it said "verb" far too readily. **A false verb is the visible error** —
*recordz* where *records* was right — and at zero it produced 18,036 of them
against the prior's 1,826.

### 4.1 The threshold, and why it is 0.15 rather than 0.75

The model was fitted where verbs are 52.8% and is asked about text where they are
2.6%, so its zero threshold is far too generous. Sweeping the decision threshold
on the natural corpus, with no retraining:

| t | Verb F1 | Verb P | Verb R | False verbs | Errors/10k |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0.00 | 72.6 | 61.2% | 89.1% | 17,192 | 174 |
| **0.15** (**shipped**) | 75.1 | 65.5% | 88.0% | 14,128 | 151 |
| 0.25 | 77.8 | 71.1% | 86.0% | 10,643 | 126 |
| 0.50 | 80.4 | 78.9% | 81.9% | 6,671 | 103 |
| *0.75* (F1 optimum) | *81.1* | *85.3%* | *77.3%* | *4,048* | *93* |
| 1.00 | 79.9 | 90.0% | 71.9% | 2,436 | 93 |
| 1.50 | 74.0 | 95.2% | 60.5% | 932 | 110 |

The sweep bins scores at 0.05, so its rows are marginally more conservative than
the live decision; the shipped row in the table above (75.6 F1, 146 errors) is
the exact figure.

**0.75 is the optimum and is not what ships**, because the regression frames in
`tests/pos.test.js` cap the threshold far below it:

```text
lowest verb frame    0.167   "which records the data"
then                 0.643   "John records"
then                 0.872   "the device records everything"
highest noun frame  -0.217   "The phone calls stopped at midnight"
usable range        -0.217 < t < 0.167
```

Those assertions are correct, but the frames are genuinely borderline, and the
obvious explanation for their low scores is wrong. It is **not** that they are
short:

| Words | Features fired | Score | Frame |
| ---: | ---: | ---: | --- |
| 4 | 5 | 0.167 | *which records the data* |
| 4 | 5 | 2.798 | *she records the song* |
| 2 | 3 | 1.695 | *He records* |

*He records* fires three features and scores 1.695; *which records the data*
fires five and scores 0.167. What separates them is **which cue fires**. *she*
contributes `-1=SUBJ3SG` at +2.07; *which* contributes `-1=DET` at −0.56,
because a determiner before the target is a *noun* cue and "which records…" is a
question at least as often as a relative clause. The model is being
appropriately unconfident, and the test asserts a reading a human takes from
wider context. No threshold recovers that.

So the shipped value is **0.15**, the largest the suite permits: errors per
10,000 fall from 180 to 146, false verbs from 18,036 to 13,431, and the sign
against the prior flips from −12.0% to +9.5%. Raising it further would not trade
away noise — it would trade away genuinely ambiguous constructions the tests have
decided in the verb's favour.

Like `RULE_VETO`, `VERB_THRESHOLD` is tuned against one set of weights and does
not retune itself: re-derive it with `npm run eval:natural` after every
`npm run gen:svm`.

### 4.2 Retraining on the deployment prior does not help

The obvious alternative to a threshold is to fit the model for the distribution
it will meet. `DEPLOY_VERB_RATE` in `build/gen-vvz-svm.py` does that, weighting
each example by *P*(class | deployment) / *P*(class | training) — at the true
rate, verbs ×0.049 against nouns ×2.06. **It was tried and it does not work**,
and the negative result is worth recording because the idea will occur to anyone
reading section 4.

It fails for a specific reason: it shifts every score down together rather than
re-ranking them, so it is *the same lever* as the threshold. The regression
frames move but keep their order — *which records the data* goes from +0.167 to
−1.165 while *The phone calls stopped at midnight* goes from −0.217 to −1.411,
leaving a usable window of −1.411 < t < −1.165 rather than removing the
constraint.

And on running text the reweighted model is no better at any operating point:

| Model | Best F1 (unconstrained) | Errors/10k | Within the test-permitted window |
| --- | ---: | ---: | --- |
| Unweighted | **81.1** at t = 0.75 | **93** | 75.6 F1, 146 err at t = 0.15 |
| Reweighted to 0.026 | 79.6 at t = −1.00 | 99 | 75.0 F1, 140 err at t = −1.20 |

Inside the window the two are a wash; unconstrained the unweighted model is
better. The option stays in the trainer, documented and defaulted off.

**What this leaves.** Both levers tried so far are a single scalar applied to
every decision. The constraint is that some frames are ambiguous on their
evidence, and no global constant distinguishes those from confident ones. A
context-sensitive decision — one that asks how strong the fired cues are, not
just what they sum to — is the remaining direction, and it is untried.


### 4.3 Two further findings

**A lookup table built from the training corpus would be far worse than useless.**
The enriched-fit prior scores 87.9% accuracy and 1,210 errors per 10,000, with
verb precision of 16.6%: it learned a 52.8% verb prior for text that is 97.4%
nouns. That matters for the prior-gating improvement proposed in 2.1 — fit it on
running text, never on the training corpus.

**The veto helps here too**, F1 70.7 → 75.6 and errors 192 → 146. That is now
four corpora where it earns its place and one, the enriched set, where it costs.
Both arms are scored at the same threshold, so that gap is the veto alone.

Per genre: fiction 98.3%, non-fiction 97.9% accuracy — the effect is not
genre-specific.

## 5. Limitations

Four, and all four belong in the paper rather than in a reviewer's report.

**The labels are tagger output, not human annotation.** Gold tags come from
CLAWS7, whose published accuracy is around 96–97%. The measured 93.2% is
therefore close to the label ceiling, and differences of a point or less between
methods in section 2.1 may not be resolvable with this data at all. A stratified
hand-checked sample of the held-out targets, reporting agreement with CLAWS, is
required before any of these numbers can be called precise. **Until that exists
every figure here should be read as accuracy *against CLAWS*, not against
truth,** and the paper should say so in those words.

**The in-domain corpus cannot be redistributed.** The fiction and non-fiction
corpora are built from copyrighted ebooks, and the wider collection includes BNC
and COCA material, licensed against redistribution. So sections 2.1–2.4 are not
reproducible by a reader, which is a genuine weakness.

Section 3 is the partial answer, and it is worth saying so explicitly: the
Gutenberg set is public-domain text with the Project Gutenberg boilerplate
already stripped, so **the transfer experiment can be released as a benchmark
even though the in-domain evaluation cannot.** Two things have to happen first.
The 694 texts need whitelisting against a public-domain determination — the 2006
DVD carries a small number of copyrighted-with-permission works, and stripping
the boilerplate also stripped the marker identifying them, so the filter has to
come from the `GUTINDEX` files. And the de-duplication in `build/shift-vvz.mjs`
must ship with it, since six of the 700 are training text under other ids.

MASC 3.0.0 and OANC are also on hand and also redistributable. They would supply
the contemporary register Gutenberg lacks, which is the remaining gap.

**Two constants are tuned against judgment rather than accuracy — and both now
have measurements.** `RULE_VETO` is set from regression frames, for the reason
given in 2.1, and in domain that costs 0.93 points. Sections 3 and 4 supply the
missing evidence: on Gutenberg the same veto *gains* 0.24 points and 3.3 of
precision, and on running text it moves F1 70.7 → 75.6 and errors 192 → 146. Four
corpora where it earns its place, one where it costs.

`VERB_THRESHOLD` is the same shape of constant and is capped by the regression
frames rather than chosen freely (4.1). Both should be re-derived after any
retrain; neither does so on its own.

**The residual 243 entries are unmeasured.** 4.1% of the context-dependent
entries fall outside every harness. They are a long tail of small classes, but
the paper should state coverage as 95.9% rather than implying completeness.

## 6. Corrections made while measuring

Recorded because they are the reason this document exists, and because the same
drift will recur.

1. **`pos.js` overstated the hand rule; fixed.** The docstring on `is_VVZ_svm`
   read "94.6% held-out accuracy alone vs the rule's 88.5%". Measured, `is_VVZ`
   scores **75.9%** — the 88.5% is within rounding of the per-word prior (88.8%),
   so the prior appears to have been recorded under the rule's name. The
   docstring now carries the full measured table.

2. **The shipped weights were two months stale; regenerated.**
   `src/disambig/vvz-svm.js` had not been rebuilt since 5 July 2026 (`ae392b2`)
   and carried 5,275 weights against a lexicon that had moved on; it now carries
   5,228. The retrained model is markedly more precise on its own (96.5% vs the
   July model's 93.5%).

3. **`RULE_VETO` was re-derived: 0.16 → 0.12.** The old constant was tuned
   against the July weights. Against the current, more precise ones it cost
   1.09 points of accuracy for 1.0 of precision. The new value is the smallest on
   the sweep grid that clears the binding regression case ("The phone calls
   stopped at midnight", threshold 0.084) with headroom rather than hugging it —
   headroom matters because raw scores move between retrains: "the call records
   between…" went from +0.3 under the July weights to −0.33 under these. Those
   figures were measured before `VERB_THRESHOLD` existed; at the shipped
   threshold the veto costs 0.93 points (7).

4. **The retrained model absorbed most of the prior-gating prize.** Under the
   July weights *makes* alone (99.8% verb) cost 11.6 points and ~810 errors; it
   now costs 0.4. The prior-gating improvement proposed in 2.1 is still real but
   is worth considerably less than it looked before the retrain — which is itself
   the argument for regenerating weights before measuring anything.

5. **`build/rule-vvz.mjs` did not exist** until now, though `gen-vvz-svm.py` and
   `rule-vv0.mjs` had both referenced it by name. That is why 1–3 went unnoticed:
   the rule-versus-model comparison had no harness.

6. **`VERB_THRESHOLD` was added at 0.15, not the 0.75 the sweep wanted.** The
   regression frames cap it at 0.167, and those assertions are correct: the
   frames they protect are genuinely ambiguous, not merely short. The first
   diagnosis in this document said they scored low because they were short
   fragments; that was **wrong**, and measuring feature counts is what disproved
   it — *He records* fires three features and scores 1.695 while *which records
   the data* fires five and scores 0.167. See 4.1.

7. **The veto ablation was briefly measuring the threshold too.** When
   `VERB_THRESHOLD` was introduced, the "SVM alone" arm in all three harnesses
   still cut at zero while production cut at 0.15, so the gap between them
   carried both changes — it reported the veto costing 1.40 points in domain
   when the true figure is 0.93. All three now score the raw arm at the same
   threshold. A reminder that an ablation has to hold everything else fixed,
   including the thing you just added.

8. **`build/shift-vvz.mjs` printed one figure from a hardcoded string** rather
   than measuring it, so its "at home" comparison went stale the moment the
   threshold moved. Updated, and commented as the one number on that report that
   can drift on its own.

9. **`rule-vv0.mjs` and `rule-clitic-s.mjs` skip blank lines without advancing
   the split counter**, where `gen-vvz-svm.py` advances on every line. Each is
   self-consistent so their own numbers stand, but if a learned model is ever
   built for either decision its split will not match theirs. `rule-vvz.mjs`
   follows the Python convention deliberately, and says so. **Not fixed.**
