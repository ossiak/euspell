#!/usr/bin/env python
"""Train a linear SVM (PEGASOS, hinge + L2) for the NN2|VVZ diatone decision and
emit src/disambig/vvz-svm.js (a feature->weight Map consumed by is_VVZ_svm).

The model is a faithful swap-in for is_VVZ_resolved: it scores the SAME token
representation the runtime sees. Neighbor tags are therefore taken from the
LEXICON candidate set (mirroring tagger.js / tagWord), never from the corpus
gold tag — gold tags are used only to label the target word. Features:

  bias, cap (target capitalized), w=<lowercased target word>  [the prior],
  and, for each of the 6 window slots (+/-3, sentence-bounded), one
  "<offset>=<tag-family>" per candidate tag of that neighbor (multi-hot), or
  "<offset>=BOUND" past a sentence edge.

Train/eval split is BY LINE (index % 5 == 0 -> held-out test), matching the
companion rule_vvz.mjs harness so the two methods score identical targets.

Usage:  python build/gen-vvz-svm.py        (needs disambig/_corpus_012_112.txt)
"""
import sys, os, re, numpy as np

ROOT = "."
LEX = f"{ROOT}/data/euspell_lexicon.csv"
ABBR = f"{ROOT}/data/euspell_lexicon_abbreviations.csv"
CONTR = f"{ROOT}/data/euspell_lexicon_contractions.csv"
# Training corpora, tagged with a genre label for the per-genre test breakdown.
# Override with CORPORA="fic:path,nf:path,..." ; default is fiction + non-fiction.
CORPORA = [("fic", f"{ROOT}/disambig/_corpus_012_112.txt"),
           ("nf", f"{ROOT}/disambig/_corpus_012_112_nf.txt")]
OUT = f"{ROOT}/src/disambig/vvz-svm.js"
LAMBDA, EPOCHS, SEED = 1e-5, 12, 0

# --- lexicon: word -> candidate tag string (mirrors tagger.js tagWord) --------
def load_tags(path, into):
    for line in open(path, encoding="utf-8"):
        p = line.rstrip("\n").split(",")
        if len(p) >= 2 and p[0] and p[0].lower() not in into:
            into[p[0].lower()] = p[1]
wordtags, vocab = {}, set()
load_tags(LEX, wordtags)          # lexicon first
load_tags(ABBR, wordtags)         # then abbreviations
load_tags(CONTR, wordtags)        # then contractions  (?? order of tagWord)
for line in open(LEX, encoding="utf-8"):
    p = line.rstrip("\n").split(",")
    if len(p) >= 3 and p[2] in ("012", "112"):
        vocab.add(p[0].lower())

def fam(tag):
    if tag.startswith("NP"): return "NP"
    if tag.startswith("NN"): return "NN"
    if tag in ("PPHS1", "PPH1"): return "SUBJ3SG"
    if tag.startswith(("PPHO", "PPIO", "PPX", "PPY")): return "OBJPRON"
    if tag in ("AT", "AT1") or tag.startswith(("DD", "DA", "DB")): return "DET"
    if tag.startswith("APPGE"): return "POSS"
    if tag.startswith(("II", "IO", "IF", "IW")): return "PREP"
    if tag.startswith(("JJ", "MC", "MD", "MF")): return "PREMOD"
    if tag in ("VV0", "VBR", "VBDR", "VH0", "VD0"): return "PLVERB"
    if tag.startswith(("VV", "VB", "VH", "VD", "VM")): return "VERB"
    if tag.startswith(("RR", "RG", "RP", "RL", "RT", "RA")): return "ADV"
    if tag in ("PNQS", "DDQ", "CST"): return "RELSUBJ"
    return tag[:2]

BREAK = {".", "!", "?"}
tok_re = re.compile(r"^(.*)_([^_]+)$")
def parse(line):
    out = []
    for tk in line.split():
        m = tok_re.match(tk)
        if m:
            w = m.group(1)
            out.append((w, m.group(2), w in BREAK))  # (word, goldtag, breakAfter)
    return out

# contextWindow(idx): the 6 neighbor slots at offsets (-3,-2,-1,1,2,3),
# stopping at a sentence break (mirrors context.js).
OFFS = (-3, -2, -1, 1, 2, 3)
def neighbor(toks, idx, off):
    step = 1 if off > 0 else -1
    j = idx
    for _ in range(abs(off)):
        # a break on the token we step OFF marks the boundary between it and next
        cur = j
        j += step
        if j < 0 or j >= len(toks):
            return None
        lo, hi = (cur, j) if step > 0 else (j, cur)
        # crossesSentenceBreak: any token in [min,max) has breakAfter
        if any(toks[k][2] for k in range(min(cur, j), max(cur, j))):
            return None
    return toks[j]

# WORD_SCALE down-weights the lexical "w=<word>" feature relative to context.
# The word feature otherwise soaks up credit by collinearity, leaving context
# cues (a determiner before, etc.) too weak to override a verb-leaning word —
# so "the anchors of ships" mis-resolved to the verb. Scaling the word feature
# (and folding the scale into the exported weight, so the runtime is unchanged)
# forces the optimizer to put more weight on context, restoring those vetoes.
LAMBDA = float(os.environ.get("LAMBDA", LAMBDA))
EPOCHS = int(os.environ.get("EPOCHS", EPOCHS))
WORD_SCALE = float(os.environ.get("WORD_SCALE", 0.45))
# Experiment toggle: map a lexicon-unknown neighbor to the NN family instead of
# its own UNK feature. OUT override lets an experiment run avoid clobbering the
# production weights file.
MAP_UNK_TO_NN = bool(os.environ.get("MAP_UNK_TO_NN"))
# DIGIT_MC (default on) tags a digit-initial neighbor as a cardinal (MC),
# mirroring tagWord; set DIGIT_MC=0 to leave digits unknown for a comparison.
DIGIT_MC = os.environ.get("DIGIT_MC", "1") != "0"
OUT = os.environ.get("OUT", OUT)
print(f"LAMBDA={LAMBDA} EPOCHS={EPOCHS} WORD_SCALE={WORD_SCALE} "
      f"MAP_UNK_TO_NN={MAP_UNK_TO_NN} DIGIT_MC={DIGIT_MC}", file=sys.stderr)

feat_idx = {}
def fid(s): return feat_idx.setdefault(s, len(feat_idx))

def featurize(toks, i):
    """Returns (word_col, context_cols). The word column is scored at WORD_SCALE."""
    w = toks[i][0]
    wcol = fid("w=" + w.lower())
    ctx = [fid("bias")]
    if w[:1].isupper(): ctx.append(fid("cap"))
    for off in OFFS:
        nb = neighbor(toks, i, off)
        if nb is None:
            # A boundary slot is ABSENCE of context, not evidence. Firing a
            # feature for it lets the model learn a sentence-position prior
            # (a verb-leaning "nothing after" weight) that swamps the real cues
            # in short sentences. So an empty slot contributes nothing; the bias
            # term carries the overall base rate.
            continue
        nbl = nb[0].lower()
        # Mirror tagWord: a digit-initial neighbor is a cardinal numeral (MC).
        tags = "MC" if (DIGIT_MC and nbl[:1].isdigit()) else wordtags.get(nbl, "")
        if not tags:
            ctx.append(fid(f"{off}=NN" if MAP_UNK_TO_NN else f"{off}=UNK")); continue
        for fm in {fam(t) for t in tags.split("|")}:
            ctx.append(fid(f"{off}={fm}"))
    return wcol, ctx

if os.environ.get("CORPORA"):
    CORPORA = [tuple(spec.split(":", 1)) for spec in os.environ["CORPORA"].split(",")]

tr, te = [], []   # tr: (label, wcol, ctx)   te: (label, wcol, ctx, genre)
ln = 0
for genre, path in CORPORA:
    n0 = ln
    for line in open(path, encoding="utf-8"):
        toks = parse(line)
        test = (ln % 5 == 0)   # deterministic 80/20 split by line, per corpus
        ln += 1
        for i, (w, tag, _) in enumerate(toks):
            if w.lower() not in vocab or tag not in ("NN2", "VVZ"): continue
            label = 1 if tag == "VVZ" else -1
            wcol, ctx = featurize(toks, i)
            if test:
                te.append((label, wcol, ctx, genre))
            else:
                tr.append((label, wcol, ctx))
    print(f"  read {genre}: {ln - n0} lines from {path}", file=sys.stderr)

D = len(feat_idx)
print(f"corpora={[g for g, _ in CORPORA]}  features={D}  train={len(tr)}  test={len(te)}", file=sys.stderr)

def score_of(w, wcol, ctx):
    return WORD_SCALE * w[wcol] + w[ctx].sum()

def pegasos(data):
    rng = np.random.default_rng(SEED)
    w = np.zeros(D); n = len(data); t = 0
    for ep in range(EPOCHS):
        for k in rng.permutation(n):
            t += 1; eta = 1.0 / (LAMBDA * t)
            label, wcol, ctx = data[k]
            w *= (1 - eta * LAMBDA)
            if label * score_of(w, wcol, ctx) < 1:
                w[ctx] += eta * label
                w[wcol] += eta * label * WORD_SCALE
        print(f"  epoch {ep+1}/{EPOCHS}", file=sys.stderr)
    return w

w = pegasos(tr)

def evaluate(data, genre=None):
    tp = fp = tn = fn = 0
    for label, wcol, ctx, g in data:
        if genre and g != genre: continue
        p = 1 if score_of(w, wcol, ctx) > 0 else -1
        if p > 0 and label > 0: tp += 1
        elif p > 0: fp += 1
        elif label < 0: tn += 1
        else: fn += 1
    n = tp + fp + tn + fn
    acc = (tp + tn) / n
    return acc, tp / (tp + fp or 1), tp / (tp + fn or 1), (tp, fp, tn, fn)

print(f"\nWord+context linear SVM (lexicon-tagged, production-faithful)")
for g in [None] + sorted({g for *_, g in te}):
    acc, prec, rec, cm = evaluate(te, g)
    label = "overall" if g is None else f"{g:>7} held-out"
    print(f"  {label:18}  acc={acc*100:.1f}%  precision={prec*100:.1f}%  recall={rec*100:.1f}%  tp/fp/tn/fn={cm}")

# --- probes: strong-context grammatical cases that must resolve correctly -----
def probe(words, idx):
    toks = [(wd, "", wd in BREAK) for wd in words]
    wcol, ctx = featurize(toks, idx)
    s = score_of(w, wcol, ctx)
    return ("VVZ" if s > 0 else "NN2"), s
for words, idx, want in [
    (["the", "anchors", "of", "ships"], 1, "NN2"),
    (["first", "aids"], 1, "NN2"),
    (["she", "records", "the", "song"], 1, "VVZ"),
    (["two", "records", "exist"], 1, "NN2"),
    (["he", "loves", "anything"], 1, "VVZ"),
]:
    got, s = probe(words, idx)
    flag = "ok " if got == want else "XX "
    print(f"  probe {flag}{got} (want {want}, score {s:+.3f})  {' '.join(words)}")

# --- emit src/disambig/vvz-svm.js --------------------------------------------
# Fold WORD_SCALE into the exported "w=" weights so the runtime sums plainly.
inv = {v: k for k, v in feat_idx.items()}
entries = []
for c in range(D):
    raw = w[c] * WORD_SCALE if inv[c].startswith("w=") else w[c]
    val = round(float(raw), 4)
    if val != 0.0:
        entries.append((inv[c], val))
# stable, compact: bias/cap/context first, word features after, each sorted
def keyrank(name):
    return (0 if name in ("bias", "cap") or "=" in name and not name.startswith("w=") else 1, name)
entries.sort(key=lambda e: keyrank(e[0]))
body = ",".join(f'["{k}",{v}]' for k, v in entries)
js = (
    "// GENERATED by build/gen-vvz-svm.py — do not edit by hand.\n"
    "// Linear-SVM weights for the NN2|VVZ diatone decision (is_VVZ_svm in pos.js).\n"
    "// Feature keys: 'bias', 'cap', '<offset>=<tag-family|BOUND|UNK>', 'w=<word>'.\n"
    f"// {len(entries)} nonzero weights; trained on disambig/_corpus_012_112.txt.\n"
    f"export const VVZ_SVM = new Map([{body}]);\n"
)
open(OUT, "w", encoding="utf-8", newline="\n").write(js)
print(f"\nwrote {OUT}  ({len(entries)} weights, {len(js)//1024} KB)")
