#!/usr/bin/env python
"""Build data/euspell_lexicon_accents.csv from build/french-words-accented.txt.

The output is a spelling bridge and nothing else: `Accented` is a spelling
euspell must be able to *read*, `Word` is the ASCII headword already in
euspell_lexicon.csv that it resolves to. Every one of the source's ASCII forms
is an existing headword, so nothing here is a new lexeme -- no count moves and
no script that quotes one needs re-verifying.

Design notes, and why:

  * **The paper's rule is about output, not input.** *Rules* opens "No
    diacritical marks or new apostrophes will be added", and the abstract says
    none are "introduced". Reading `cafe` and writing `cafeh` removes a
    diacritic; it never adds one. The invariant this file must hold is
    therefore narrow: accents may appear in `Accented` and nowhere else, which
    is checked below.

  * **An explicit map, not a de-accenting rule.** NFD mark-stripping does not
    touch the `oe` ligature, so a normaliser built on unicodedata alone would
    silently miss `boeuf`. As data, the ligature is just another row.

  * **The euspelling column is empty on all but three rows.** A row resolves
    through `Word` and inherits whatever the lexicon says, disambiguation
    included, so nothing is duplicated and nothing can drift. It is filled only
    where the accent settles a reading the ASCII form leaves ambiguous -- see
    PINS.

  * **Accented plurals are derived, never typed.** The source names some
    plurals and not others; the pass below adds every plural noun the lexicon
    already carries, so the file does not inherit the source's gaps.

Usage:  python build/gen-lexicon-accents.py
"""
import collections
import csv
import re
import sys
import unicodedata

ROOT = "."
LEX = f"{ROOT}/data/euspell_lexicon.csv"
SRC = f"{ROOT}/build/french-words-accented.txt"
OUT = f"{ROOT}/data/euspell_lexicon_accents.csv"

# NFD leaves these joined, so they are expanded before the marks are stripped.
LIGATURES = {"œ": "oe", "Œ": "OE", "æ": "ae", "Æ": "AE"}

# The source claims a circumflex these words do not carry: `coteau` is plain in
# modern French, and the dish is named for the surname Chateaubriand, which
# takes no accent either. Dropped with every inflection -- a base with no
# circumflex has no accented plural.
EXCLUDE = {"coteau", "coteaus", "coteaux", "chateaubriand", "chateaubriands"}

# Where the accent settles a reading the ASCII form leaves ambiguous, the row
# carries the euspelling outright instead of deferring to its headword.
#
#   attaches   112  attashehs|attaqhez   -- the VVZ is the verb `attach`
#   manque     702  manq|manqeh          -- the JJ is the accented one
#   debouches  112  debouqhes|debouqhez  -- BOTH alternatives are the verb
#       `debouch` (debouqh, debouqhd, debouqhing). The noun plural of
#       `deboosheh` is absent from that row, so this pin deliberately matches
#       neither; the `112` row has conflated two lexemes and the noun's `sh`
#       was lost to the verb's `qh`. Fixing the row is a lexicon change, not
#       one this file can make -- until then the pin carries the noun.
PINS = {"attaches": "attashehs",
        "debouches": "debooshehs",
        "manque": "manqeh"}


def deaccent(s):
    s = "".join(LIGATURES.get(c, c) for c in s)
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if not unicodedata.combining(c))


def read_lexicon():
    by_word = collections.defaultdict(list)
    with open(LEX, encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            by_word[row["Word"]].append(row)
    return by_word


def read_source():
    """[(ascii forms, accented candidates)] per bullet.

    Any token in the line carrying a non-ASCII letter is a candidate, rather
    than only the parenthetical: the `toupee` bullet states its accented form
    mid-sentence, and `boutonnieres` is quoted there with a typo that the
    de-accent check below rejects in favour of the derived spelling.
    """
    out = []
    with open(SRC, encoding="utf-8") as fh:
        for line in fh:
            m = re.match(r"\*\s+\*\*(.+?)\*\*", line)
            if not m:
                continue
            forms = [w.strip() for w in m.group(1).split("/")]
            cands = [t for t in re.findall(r"[^\W\d_]+", line, flags=re.UNICODE)
                     if any(ord(c) > 127 for c in t)]
            out.append((forms, cands))
    return out


def main():
    by_word = read_lexicon()
    pairs, unaccented, derived = {}, [], []

    for forms, cands in read_source():
        matched = {}
        for c in cands:
            base = deaccent(c).lower()
            if base in forms:
                matched[base] = c.lower()
        for f in forms:
            if f in matched:
                pairs[f] = matched[f]
                continue
            # Derive: substitute the longest matched base found inside the form.
            hit = max((b for b in matched if b in f), key=len, default=None)
            if hit is None:
                unaccented.append(f)       # the source says it takes no accent
                continue
            acc = f.replace(hit, matched[hit])
            if deaccent(acc).lower() != f:
                print(f"  derivation disagrees: {f} -> {acc}", file=sys.stderr)
                continue
            pairs[f] = acc
            derived.append((f, acc, hit))

    flat = {f: a for f, a in pairs.items() if a != f and f not in EXCLUDE}

    # --- plural nouns the source does not name ---------------------------
    added = []
    for f in sorted(flat):
        if not any("NN" in r["PoS"] for r in by_word.get(f, [])):
            continue                   # adjectives and participles take no plural
        # A base ending in -e pluralises with -s alone. Without this, `fiance`
        # + `es` picks up `fiancees` -- the plural of *fiancee*, a lexeme the
        # source never names -- rather than of *fiance*.
        cands = [f + "s"] + ([] if f.endswith("e") else [f + "es"])
        cands += [f + "x"] if f.endswith("au") else []
        for cand in cands:
            if cand in flat or cand in EXCLUDE or cand not in by_word:
                continue
            if not any("NN2" in r["PoS"] for r in by_word[cand]):
                continue
            flat[cand] = flat[f] + cand[len(f):]
            added.append((flat[cand], cand, f))

    rows = sorted((a, w) for w, a in flat.items())

    # --- checks -----------------------------------------------------------
    bad = []
    for a, w in rows:
        if w not in by_word:
            bad.append(f"{a} -> {w}: not a lexicon headword")
        if not any(ord(c) > 127 for c in a):
            bad.append(f"{a}: key carries no diacritic")
        if deaccent(a).lower() != w:
            bad.append(f"{a} -> {w}: key does not de-accent to its headword")
        if any(ord(c) > 127 for c in PINS.get(w, "")):
            bad.append(f"{a} -> {w}: euspelling is not ASCII")
    for w in PINS:
        if w not in flat:
            bad.append(f"{w}: pinned but not a row")
    if bad:
        print("CHECKS FAILED:", file=sys.stderr)
        for b in bad:
            print(f"  {b}", file=sys.stderr)
        return 1

    with open(OUT, "w", encoding="utf-8", newline="") as fh:
        fh.write("Accented,Word,euspelling\n")
        for a, w in rows:
            fh.write(f"{a},{w},{PINS.get(w, '')}\n")

    print(f"{OUT}: {len(rows)} rows")
    print(f"  {len(added)} plural nouns the source does not name: "
          + ", ".join(a for a, _, _ in added))
    print(f"  {len(derived)} accented forms derived rather than quoted")
    print(f"  {len(unaccented)} named forms carry no accent, so are not mapped: "
          + ", ".join(sorted(unaccented)))
    for w, pin in sorted(PINS.items()):
        alts = by_word[w][0]["euspelling"].split("|")
        where = ("alternative %d of the base row" % (alts.index(pin) + 1)
                 if pin in alts else
                 "NOT in the base row (%s) -- see PINS" % by_word[w][0]["euspelling"])
        print(f"  pinned {flat[w]} -> {pin}: {where}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
