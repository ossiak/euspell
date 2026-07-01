"""Validates the Python euspell engine against ground truth produced by the real
JS engine (build/gen-lo-fixtures.mjs -> fixtures.tsv).

Run: python libreoffice/tests/test_engine.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "euspell"))
import engine  # noqa: E402


def load_fixtures():
    path = os.path.join(HERE, "fixtures.tsv")
    pairs = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\n")
            if not line:
                continue
            src, _, expected = line.partition("\t")
            pairs.append((src, expected))
    return pairs


def main():
    fixtures = load_fixtures()
    fails = []
    for src, expected in fixtures:
        got = engine.convert_text(src)
        status = "PASS" if got == expected else "FAIL"
        if got != expected:
            fails.append((src, expected, got))
        print(f"{status}  {src}")
        if got != expected:
            print(f"      expected: {expected}")
            print(f"      got     : {got}")

    # Round-trip: revert(euspell) recovers the original.
    rfails = []
    for src, expected in fixtures:
        back = engine.revert_text(expected)
        if back != src:
            rfails.append((expected, src, back))
            print(f"REVERT FAIL  {expected}\n      expected: {src}\n      got     : {back}")

    # Word-level candidate API (spell checker surface).
    assert engine.word_candidates("above") == ["abov"], engine.word_candidates("above")
    assert engine.word_candidates("records") == ["records", "recordz"], engine.word_candidates("records")
    assert engine.word_candidates("cat") == [], engine.word_candidates("cat")
    assert engine.word_candidates("Above") == ["Abov"], engine.word_candidates("Above")
    # Semantic homographs are left unchanged by auto-conversion but offered as
    # choices (the components surface these for the user to pick).
    assert engine.convert_text("They read it.") == "They read it.", "semantic left unchanged"
    assert engine.word_candidates("read") == ["read", "redd"], engine.word_candidates("read")
    # "are" is now a plain single-spelling verb (encoding 101), not a homograph.
    assert engine.convert_text("They are here.") == "They ar here.", engine.convert_text("They are here.")
    assert engine.word_candidates("are") == ["ar"], engine.word_candidates("are")
    # revert is the inverse of convert.
    assert engine.revert_text("The niht was ruff.") == "The night was rough.", engine.revert_text("The niht was ruff.")
    # revert stays American (never flips to British), and phonetic reforms that
    # coincide with real words still revert.
    for w in ("organizes", "colors", "acknowledgment", "judgment", "defenses", "center", "theater"):
        assert engine.revert_text(engine.convert_text(w)) == w, (w, engine.revert_text(engine.convert_text(w)))
    assert engine.revert_text("ruff") == "rough"
    assert engine.revert_text("dorr") == "door"

    print()
    print(f"engine fixtures: {len(fixtures) - len(fails)}/{len(fixtures)} pass; "
          f"word_candidates checks pass")
    print(f"round-trip revert: {len(fixtures) - len(rfails)}/{len(fixtures)} recover the original")
    if fails or rfails:
        print("SOME FAILED")
        sys.exit(1)
    print("ALL PASS")


if __name__ == "__main__":
    main()
