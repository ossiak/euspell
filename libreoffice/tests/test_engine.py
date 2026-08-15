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


def _blocked_by_collision(src, euspell, back):
    """True when every word revert failed to restore is itself a headword.

    `rough` reforms to `ruff`, and `ruff` is a word in its own right — the
    collar, the bird — so revert leaves it alone rather than turning a genuine
    ruff into a rough. Reads engine._LEXICON directly: this is a white-box check
    on a port, and the alternative is widening the engine's public surface for a
    test's benefit.
    """
    words = zip(src.split(), euspell.split(), back.split())
    for original, reformed, reverted in words:
        if reverted == original:
            continue
        key = reformed.strip(".,;:!?\"'").lower()
        if engine._LEXICON.get(key) is None:  # noqa: SLF001
            return False
    return True


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

    # Round-trip: revert(euspell) recovers the original — except across a
    # collision, where the euspelling is a headword in its own right. "rough"
    # reforms to "ruff", and "ruff" is also a word, so revert leaves it: turning
    # a genuine ruff into a rough is the worse error. Such fixtures are counted
    # separately rather than failed, since the shortfall is in the reform, not
    # in this port — the JS engine does the same thing.
    rfails, collided = [], []
    for src, expected in fixtures:
        back = engine.revert_text(expected)
        if back == src:
            continue
        if _blocked_by_collision(src, expected, back):
            collided.append((expected, src, back))
            continue
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
    # revert is the inverse of convert, EXCEPT across a collision: where the
    # euspelling is itself a headword, revert cannot know which word produced it
    # and leaves it alone. "rough" reforms to "ruff", but "ruff" is also a real
    # word (the collar, the bird), so "ruff" stays "ruff" — turning a genuine
    # ruff into a rough would be the worse error. This is by design, not a gap.
    assert engine.revert_text("The niht was ruff.") == "The night was ruff.", engine.revert_text("The niht was ruff.")
    assert engine.revert_text("ruff") == "ruff"
    # revert stays American, never flipping to British.
    for w in ("organizes", "colors", "acknowledgment", "judgment", "defenses", "center", "theater"):
        assert engine.revert_text(engine.convert_text(w)) == w, (w, engine.revert_text(engine.convert_text(w)))
    # "door" -> "dorr" is the same shape, and now behaves the same way: dorr is
    # a headword too (the beetle), and the row was re-encoded 101 -> 601 so that
    # revert declines it. Before that it mapped back, quietly turning a beetle
    # into a door — the corruption the ruff rule exists to prevent.
    assert engine.revert_text("dorr") == "dorr"

    print()
    print(f"engine fixtures: {len(fixtures) - len(fails)}/{len(fixtures)} pass; "
          f"word_candidates checks pass")
    print(f"round-trip revert: {len(fixtures) - len(rfails) - len(collided)}/{len(fixtures)} "
          f"recover the original, {len(collided)} blocked by a collision")
    if fails or rfails:
        print("SOME FAILED")
        sys.exit(1)
    print("ALL PASS")


if __name__ == "__main__":
    main()
