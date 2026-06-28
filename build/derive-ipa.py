#!/usr/bin/env python
"""Derive an IPA category file for the euspell SSML lexicon from CMUdict.

For a 101-encoded entry the euspelling is a homophone of the headword (the only
novel euspell graphemes are `qh` = /tʃ/ and `uw` = /aʊ/), so the pronunciation is
simply the headword's. We look the headword up in CMUdict (General American,
ARPABET + stress), convert to IPA, keep only the requested syllable count (the
number of vowel phonemes), and key the entry on the euspelling grapheme.

Usage:  python build/derive-ipa.py --enc 101 --syllables 1 \
            --out data/euspell_ipa_101.csv
"""
import argparse, csv, sys
from nltk.corpus import cmudict

# ARPABET -> IPA (General American). Vowels carry a stress digit (0/1/2).
VOWEL = {
    "AA": "ɑ", "AE": "æ", "AH": "ʌ", "AO": "ɔ", "AW": "aʊ", "AY": "aɪ",
    # ER is written as an explicit vowel + rhotic (ɜɹ stressed, əɹ unstressed)
    # rather than the r-coloured ɝ/ɚ, so the American /r/ is visible.
    "EH": "ɛ", "ER": "ɜɹ", "EY": "eɪ", "IH": "ɪ", "IY": "iː", "OW": "oʊ",
    "OY": "ɔɪ", "UH": "ʊ", "UW": "uː",
}
CONS = {
    "B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "F": "f", "G": "ɡ", "HH": "h",
    "JH": "dʒ", "K": "k", "L": "l", "M": "m", "N": "n", "NG": "ŋ", "P": "p",
    "R": "ɹ", "S": "s", "SH": "ʃ", "T": "t", "TH": "θ", "V": "v", "W": "w",
    "Y": "j", "Z": "z", "ZH": "ʒ",
}

def syllables(pron):
    return sum(1 for ph in pron if ph[-1].isdigit())

# Valid English onset clusters (ARPABET) for placing the stress mark before the
# stressed syllable's onset (maximal-onset principle), e.g. /əˈbʌv/ not /əbˈʌv/,
# /ˈæbˌstrækt/ not /ˈæbˌstrækt/ with the cluster split correctly.
ONSETS3 = {("S","P","L"),("S","P","R"),("S","T","R"),("S","K","R"),("S","K","W"),
           ("S","K","L"),("S","P","Y"),("S","T","Y"),("S","K","Y"),("S","M","Y")}
ONSETS2 = {("P","L"),("P","R"),("B","L"),("B","R"),("T","R"),("D","R"),("K","L"),
           ("K","R"),("G","L"),("G","R"),("T","W"),("D","W"),("K","W"),("G","W"),
           ("S","P"),("S","T"),("S","K"),("S","M"),("S","N"),("S","L"),("S","W"),
           ("F","L"),("F","R"),("TH","R"),("TH","W"),("SH","R"),("HH","W"),
           ("P","Y"),("B","Y"),("T","Y"),("D","Y"),("K","Y"),("G","Y"),("M","Y"),
           ("N","Y"),("F","Y"),("V","Y"),("HH","Y"),("L","Y"),("S","Y"),("TH","Y")}

def onset_len(cluster):
    """How many trailing consonants of `cluster` form the syllable onset."""
    if len(cluster) >= 3 and tuple(cluster[-3:]) in ONSETS3: return 3
    if len(cluster) >= 2 and tuple(cluster[-2:]) in ONSETS2: return 2
    return 1 if cluster else 0

def to_ipa(pron, mark_stress):
    """ARPABET phoneme list -> IPA string. mark_stress places ˈ/ˌ before the
    onset of each stressed syllable (a monosyllable carries no contrastive
    stress, so it is left unmarked)."""
    marks = {}  # phoneme index -> stress mark to insert before it
    prev_vowel = -1
    primary_used = False
    for i, ph in enumerate(pron):
        if ph[-1].isdigit():
            if mark_stress and ph[-1] in "12":
                cluster = pron[prev_vowel + 1:i]            # onset consonants
                # One primary stress per word: the first stress-1 is primary,
                # any later stress-1 (a g2p artifact on compounds) is demoted.
                if ph[-1] == "1" and not primary_used:
                    mark, primary_used = "ˈ", True
                else:
                    mark = "ˌ"
                marks[i - onset_len(cluster)] = mark
            prev_vowel = i
    out = []
    for i, ph in enumerate(pron):
        if i in marks: out.append(marks[i])
        if ph[-1].isdigit():
            stress, base = ph[-1], ph[:-1]
            ipa = VOWEL.get(base, "")
            if base == "AH" and stress == "0": ipa = "ə"
            if base == "ER" and stress == "0": ipa = "əɹ"  # unstressed lettER
            out.append(ipa)
        else:
            out.append(CONS.get(ph, ""))
    return "".join(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--enc", required=True)
    ap.add_argument("--syllables", type=int, default=0, help="exact count; 0 = any")
    ap.add_argument("--min-syllables", type=int, default=1, dest="min_syllables")
    ap.add_argument("--out", required=True)
    ap.add_argument("--lexicon", default="data/euspell_lexicon.csv")
    ap.add_argument("--fallback-g2p", action="store_true", dest="g2p",
                    help="transcribe CMUdict-OOV headwords with the g2p_en model")
    ap.add_argument("--oov-only", action="store_true", dest="oov_only",
                    help="emit only the OOV (g2p) words, skipping CMUdict-known ones")
    args = ap.parse_args()

    d = cmudict.dict()
    g2p = None
    if args.g2p:
        from g2p_en import G2p
        g2p = G2p()
    def lookup(head):
        """(pron, is_oov) for a headword, or (None, _) if untranscribable."""
        prons = d.get(head.lower())
        if prons:
            return (None, False) if args.oov_only else (prons[0], False)
        if g2p:
            pron = [p for p in g2p(head) if p[-1].isdigit() or p in CONS]
            return (pron if pron else None), True
        return None, True
    rows, missing, conflict = {}, [], []
    seen = 0
    for line in open(args.lexicon, encoding="utf-8"):
        p = line.rstrip("\n").split(",")
        if len(p) < 4 or p[2] != args.enc or not p[3] or p[3] == "[]":
            continue
        seen += 1
        eus = p[3].split("|")[0]
        head = p[0]
        pron, is_oov = lookup(head)
        if pron is None:
            if is_oov: missing.append((eus, head))   # OOV and untranscribable
            continue                                  # else: skipped (oov-only)
        n = syllables(pron)
        if args.syllables and n != args.syllables:
            continue
        if n < args.min_syllables:
            continue
        mark = syllables(pron) > 1
        ipa = to_ipa(pron, mark)
        if not ipa:
            missing.append((eus, head)); continue
        if eus in rows and rows[eus][0] != ipa:
            conflict.append((eus, head, ipa, rows[eus][0]))
            continue
        rows[eus] = (ipa, head)

    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        w = csv.writer(f)
        f.write(f"# GENERATED by build/derive-ipa.py --enc {args.enc} "
                f"--syllables {args.syllables} (CMUdict, General American).\n")
        f.write("# grapheme = euspelling; ipa = headword pronunciation; gloss = headword.\n")
        w.writerow(["grapheme", "ipa", "gloss"])
        for eus in sorted(rows):
            ipa, head = rows[eus]
            w.writerow([eus, ipa, head])

    print(f"enc {args.enc}: {seen} entries, wrote {len(rows)} unique graphemes "
          f"({args.syllables or 'any'}-syllable) -> {args.out}", file=sys.stderr)
    print(f"  not in CMUdict: {len(missing)}   grapheme conflicts: {len(conflict)}",
          file=sys.stderr)
    if missing[:15]:
        print("  sample missing: " + ", ".join(f"{e}({h})" for e, h in missing[:15]),
              file=sys.stderr)

if __name__ == "__main__":
    main()
