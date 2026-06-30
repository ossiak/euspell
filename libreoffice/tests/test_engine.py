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

    # Word-level candidate API (spell checker surface).
    assert engine.word_candidates("above") == ["abov"], engine.word_candidates("above")
    assert engine.word_candidates("records") == ["records", "recordz"], engine.word_candidates("records")
    assert engine.word_candidates("cat") == [], engine.word_candidates("cat")
    assert engine.word_candidates("Above") == ["Abov"], engine.word_candidates("Above")
    # Semantic homographs are left unchanged by auto-conversion but offered as
    # choices (the components surface these for the user to pick).
    assert engine.convert_text("They are here.") == "They are here.", "semantic left unchanged"
    assert engine.word_candidates("are") == ["are", "ar"], engine.word_candidates("are")
    assert engine.word_candidates("read") == ["read", "redd"], engine.word_candidates("read")

    print()
    print(f"engine fixtures: {len(fixtures) - len(fails)}/{len(fixtures)} pass; "
          f"word_candidates checks pass")
    if fails:
        print("SOME FAILED")
        sys.exit(1)
    print("ALL PASS")


if __name__ == "__main__":
    main()
