#!/usr/bin/env python3
"""Build dict/euspell_tts_contractions.pls from the contraction lexicon.

Why this exists
---------------
build/gen-pls.js reads exactly one lexicon, data/euspell_lexicon.csv, so the
contraction, abbreviation and phrase lexicons never reach a PLS at all. That
leaves 95 contraction spellings -- it'z, ih'm, anywun's, cooddn't -- with no
pronunciation entry, and an engine free to guess at every one.

How the readings are derived
----------------------------
Not from a dictionary lookup: no source in the repo carries IPA for
contractions (data/changed_words_IPA.csv covers only words whose spelling
changes, and holds no apostrophes at all). They are composed, which is sound
here for one reason: **the euspelling never changes the sound**. `it's` and
`it'z` are homophones; the -s -> -z change is grammatical, marking a verb, not
phonetic. So the reading of a euspelling is the reading of the traditional
contraction it replaces, and that is base + clitic under regular English rules.

The one trap, and it is the same one the main lexicon hit with `getz`: the `z`
in the spelling does NOT mean /z/ in the mouth. After a voiceless consonant it
is /s/ -- `it'z` is /ɪts/, not /ɪtz/.

Everything rests on BASE, a table of ~45 function-word pronunciations written by
hand. They are the commonest words in English and their General American
readings are not in dispute, but they are the part of this file to review: every
output is only as good as its base.

Usage:  python build/gen-pls-contractions.py [--check]
        --check reports what would change without writing.
"""

import argparse
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEXICON = ROOT / "data/euspell_lexicon_contractions.csv"
OUT = ROOT / "dict/euspell_tts_contractions.pls"

# General American readings for the words the contractions are built from.
# Monosyllables carry no stress mark, matching euspell_tts.pls convention.
BASE = {
    "anybody": "ˈɛniˌbɑdi", "anyone": "ˈɛniˌwʌn", "anything": "ˈɛniˌθɪŋ",
    "could": "kʊd", "does": "dʌz", "everybody": "ˈɛvriˌbɑdi",
    "everyone": "ˈɛvriˌwʌn", "everything": "ˈɛvriˌθɪŋ", "has": "hæz",
    "he": "hiː", "here": "hɪr", "how": "haʊ", "i": "aɪ", "is": "ɪz",
    "it": "ɪt", "may": "meɪ", "might": "maɪt", "mine": "maɪn", "must": "mʌst",
    "no one": "ˈnoʊˌwʌn", "nobody": "ˈnoʊˌbɑdi", "nothing": "ˈnʌθɪŋ",
    "ought": "ɔːt", "she": "ʃiː", "should": "ʃʊd", "so": "soʊ",
    "somebody": "ˈsʌmˌbɑdi", "someone": "ˈsʌmˌwʌn", "something": "ˈsʌmθɪŋ",
    "that": "ðæt", "there": "ðɛr", "these": "ðiːz", "they": "ðeɪ",
    "this": "ðɪs", "those": "ðoʊz", "to": "tuː", "we": "wiː", "what": "wʌt",
    "when": "wɛn", "where": "wɛr", "which": "wɪtʃ", "who": "huː",
    "why": "waɪ", "would": "wʊd", "you": "juː",
}

# Contractions that are not base + clitic and are simply stated.
IRREGULAR = {
    "'tis": "tɪz", "'twere": "twɜr", "howdy": "ˈhaʊdi",
    "idunno": "ˌaɪdəˈnoʊ", "imma": "ˈaɪmə", "kinda": "ˈkaɪndə",
    "'s": "z",  # the bare clitic; the verb reading, which is the one that moved
}

VOWELS = set("iɪeɛæaɑɒɔoʊuʌəɜɝɚ")
SIBILANT = ("s", "z", "ʃ", "ʒ", "tʃ", "dʒ")
VOICELESS = ("p", "t", "k", "f", "θ", "s", "ʃ", "tʃ")
# Syllable nuclei, longest first: a diphthong is ONE syllable, and counting its
# two characters separately made every monosyllable look polysyllabic --
# `huw'z` /haʊz/ came out as ˈhaʊz with a stress mark it has no use for.
NUCLEUS = re.compile(r"aɪ|aʊ|eɪ|oʊ|ɔɪ|ɪə|ɛə|ʊə|[iɪeɛæaɑɒɔoʊuʌəɜɝɚ]ː?")


def add_s(ipa):
    """The is/has clitic: /ɪz/ after a sibilant, /s/ after voiceless, else /z/."""
    if ipa.endswith(SIBILANT):
        return ipa + "ɪz"
    return ipa + ("s" if ipa.endswith(VOICELESS) else "z")


def ends_in_vowel(ipa):
    """True if the last segment is a vowel, ignoring a trailing length mark.

    Testing ipa[-1] alone got this wrong for every long vowel: `juː` ends in
    'ː', not in a vowel character, so "you've" came out /ˈjuːəv/ instead of
    /juːv/."""
    return ipa.rstrip("ːˑ")[-1:] in VOWELS


def add_ll(ipa):
    """will: syllabic after a consonant, plain /l/ after a vowel."""
    return ipa + ("l" if ends_in_vowel(ipa) else "əl")


def add_d(ipa):
    """would/had: /əd/ after an alveolar stop, else /d/."""
    return ipa + ("əd" if ipa.endswith(("t", "d")) else "d")


def add_ve(ipa):
    """have: plain /v/ after a vowel (I've /aɪv/), /əv/ after a consonant
    (could've /ˈkʊdəv/)."""
    return ipa + ("v" if ends_in_vowel(ipa) else "əv")


CLITIC = {
    "'s": add_s, "'ve": add_ve, "'re": lambda i: i + "ər",
    "'ll": add_ll, "'d": add_d, "'m": lambda i: i + "m",
    "n't": lambda i: i + "ənt",
}
# Longest first, so "n't" is matched before "'t" could be.
ORDER = ["n't", "'ve", "'re", "'ll", "'s", "'d", "'m"]


def stress(ipa):
    """Give a polysyllable an initial primary stress if it has none."""
    if any(m in ipa for m in "ˈˌ"):
        return ipa
    return ("ˈ" + ipa) if len(NUCLEUS.findall(ipa)) > 1 else ipa


def derive(word):
    """(ipa, note) for a traditional contraction, or (None, reason)."""
    w = word.lower()
    if w in IRREGULAR:
        return IRREGULAR[w], "stated"
    rest, tail = w, []
    while True:
        for c in ORDER:
            if rest.endswith(c) and len(rest) > len(c):
                rest, _ = rest[: -len(c)], tail.insert(0, c)
                break
        else:
            break
    if rest not in BASE:
        return None, f"no base for {rest!r}"
    ipa = BASE[rest]
    for c in tail:
        ipa = CLITIC[c](ipa)
    return stress(ipa), " + ".join([rest] + tail)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true",
                    help="report without writing")
    args = ap.parse_args()

    with LEXICON.open(encoding="utf-8", newline="") as f:
        r = csv.reader(f)
        next(r)
        rows = [x for x in r if len(x) >= 4]

    entries, refused = [], []
    for x in rows:
        spellings = [s for s in x[3].split("|") if s and s != "[]"]
        if not spellings:
            continue
        ipa, how = derive(x[0])
        if ipa is None:
            refused.append((x[0], how))
            continue
        for s in spellings:
            entries.append((s, ipa, x[0]))

    entries.sort(key=lambda e: e[0])
    body = "\n".join(
        f"  <lexeme><grapheme>{g}</grapheme><phoneme>{p}</phoneme></lexeme>"
        f" <!-- {w} -->" for g, p, w in entries)
    out = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<lexicon version="1.0" xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"\n'
        '    alphabet="ipa" xml:lang="en">\n'
        "  <!-- Generated by build/gen-pls-contractions.py from\n"
        "       data/euspell_lexicon_contractions.csv. Do not hand-edit: unlike\n"
        "       dict/euspell_tts.pls this file IS regenerated. -->\n"
        f"{body}\n</lexicon>\n")

    print(f"[contractions] {len(entries)} lexeme(s) from "
          f"{len({w for _, _, w in entries})} contraction(s)")
    for w, why in refused:
        print(f"[contractions]   refused: {w} — {why}")

    if args.check:
        old = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        print("[contractions] " + ("up to date" if old == out else "WOULD CHANGE"))
        return 0 if old == out else 1
    OUT.write_text(out, encoding="utf-8")
    print(f"[contractions] wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
