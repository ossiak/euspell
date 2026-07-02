---
name: euspell
description: >
  Use this skill for any work on the euspell Chrome extension — spelling conversion logic,
  lexicon lookup, disambiguation functions, DOM walking, PDF.js integration, or the build
  pipeline. Triggers include: euspell_lexicon, euspell_encoding, CLAWS7, VVZ, VVD, VVN,
  PoS disambiguation, is_VVZ, is_past_tense, converter.js, dom-walker.js, pdf/viewer.js,
  compile-lexicon, euspelling, or any of the encoding codes (011, 012, 021,
  022, 041, 101–114, 121, 123, 131, 202, 500–511). Also loads the [[chrome-extension]]
  skill for MV3, ES2023, and Chrome API patterns.
---

# Euspell Chrome Extension — Developer Skill

Euspell converts English webpages (including PDF renderings) to a reformed spelling system.
The lexicon (~205 000 entries) is pre-compiled to a JS `Map` at build time. No TypeScript;
JSDoc for type annotations. Chrome Manifest V3 only.

---

## Architecture

```
data/*.csv  →  node build/compile-lexicon.js  →  dist/lexicon.js
                                               →  dist/abbreviations.js
                                               →  dist/contractions.js
                                               →  dist/phrases.js

src/content/content.js  +  dist/*.js  →  Rollup (iife)  →  dist/content-bundle.js
src/background/service-worker.js  (ES module, no bundling needed)
```

**manifest.json loads:**
- `dist/content-bundle.js` as the content script
- `src/background/service-worker.js` as the service worker (`type: module`)
- `src/popup/popup.html` for the toolbar popup

---

## Directory Structure

```
euspell_ext/
├── src/
│   ├── content/
│   │   ├── content.js          # Entry point — observer setup, init
│   │   ├── converter.js        # word → euspelling (lexicon + disambig)
│   │   ├── context.js          # Token type, BOUNDARY sentinel, contextWindow()
│   │   ├── tagger.js           # tagWord() — lexical CLAWS7 tags from the lexicon
│   │   ├── contractions.js     # contraction lookup + component PoS expansion
│   │   └── dom-walker.js       # Block-level tokenisation + writeback
│   ├── pdf/                    # Own PDF.js viewer (service worker redirects to it)
│   │   ├── viewer.js           # Render pages, reform text layer, redraw on canvas
│   │   ├── pdf-url.js          # URL/header/byte-sniff helpers (unit-tested)
│   │   └── sample-colors.js    # Per-word ink/paper colour sampling
│   ├── background/
│   │   └── service-worker.js   # Storage init + PDF navigation redirect
│   ├── disambig/
│   │   ├── pos.js              # is_VVZ(), is_past_tense() etc. (~6 000-word coverage)
│   │   └── semantic/           # One file per semantically ambiguous word (~30 total)
│   │       └── read.js         # e.g. read → 'reed' vs 'red'
│   ├── popup/                  # popup.html / popup.js / popup.css
│   ├── options/                # options.html / options.js / options.css
│   └── shared/utils.js
├── data/                       # Source CSVs (version-controlled)
│   ├── euspell_lexicon.csv
│   ├── euspell_encoding.csv
│   ├── euspell_lexicon_abbreviations.csv
│   ├── euspell_lexicon_contractions.csv
│   └── euspell_lexicon_phrase.csv
├── build/
│   ├── compile-lexicon.js      # CSV → dist/ Map modules
│   └── gen-vvz-svm.py          # trains the NN2|VVZ SVM → src/disambig/vvz-svm.js
├── dist/                       # Compiled output — gitignored
├── disambig/                   # CLAWS7-tagged corpus .txt files (one per ambiguous word)
├── tests/
│   ├── unit/
│   └── disambig/               # Corpus-driven disambiguation tests
└── icons/
```

---

## Data File Schemas

### euspell_lexicon.csv (and abbreviations / phrases)

| Column | Type | Notes |
|---|---|---|
| Word | string | Source spelling; proper nouns may be mixed-case |
| PoS | string | Pipe-separated CLAWS7 tags, e.g. `NN2\|VVZ` |
| Encoding | string | Three-digit code; `000` = unchanged |
| euspelling | string | Pipe-separated new spellings; `[]` = unchanged |

### euspell_lexicon_contractions.csv

Same four columns as the lexicon (`Contraction,PoS,Encoding,euspelling`).

### Compiled dist/ format

```js
// dist/lexicon.js — auto-generated, do not edit
export const data = new Map([
  ['aahs', { pos: ['NN2', 'VVZ'], encoding: 12, spellings: ['aahs', 'aahz'] }],
  // …
]);
```

---

## Encoding Table

First digit = number of euspelings produced (0 = none/unchanged, 1–4 = count).

| Code | Disambiguation needed | Morphological context |
|---|---|---|
| `000` | No | Common word, no change |
| `011` | No | VVZ (3rd-sg-pres) ending change |
| `012` | **Yes** | NN2 vs VVZ — two different endings |
| `021` | No | JJ/VVD/VVN ending change |
| `022` | **Yes** | JJ vs VVD/VVN |
| `041` | No | Doubled consonant before ending |
| `101`–`103` | No | Stem change; 1–3 spellings |
| `111`–`114` | No | Stem + NN2/VVZ ending |
| `121`/`123` | No | Stem + JJ/VVD/VVN ending |
| `131` | No | Stem + undoubled consonant |
| `202` | **Yes** | Case-by-case; semantic or POS |
| `500`/`501`/`511` | No | Rare/archaic words |

**Rule:** `encoding % 10 >= 2` requires a disambiguation function.

When there are two spellings, `spellings[0]` is the default (no-context fallback);
the order matches the POS tags in the `pos` array of the entry.

---

## CLAWS7 Tags — Disambiguation-Relevant Subset

| Tag | Description | Example words |
|---|---|---|
| VV0 | Base form verb | *read, run, go* |
| VVZ | 3rd-sg-pres verb | *reads, runs, goes* |
| VVD | Past tense verb | *read, ran, went* |
| VVN | Past participle | *read, run, gone* |
| VVG | Present participle | *reading, running* |
| VVI | Infinitive | *to read, to run* |
| NN1 | Singular common noun | *bass, lead, wind* |
| NN2 | Plural common noun | *bows, tears, winds* |
| JJ | Adjective | *beloved, blessed, dogged* |
| RR | Adverb | *cleanly, close* |
| NP1 | Singular proper noun | *London, Bass (brand)* |

Full tagset reference: https://ucrel.lancs.ac.uk/claws7tags.html

---

## Disambiguation Architecture

### POS Disambiguation (`src/disambig/pos.js`)

Words whose euspelling depends on grammatical role (noun vs verb, plural-s vs verbal-s, …)
are resolved by a **small set of hand-written, general predicates** — not one function per
word. `converter.js` `route()` dispatches to them by the entry's encoding/PoS:

```js
// src/disambig/pos.js — general predicates over the token window
/**
 * @param {Token[]} tokens  — full sentence token array
 * @param {number} idx      — index of the target word
 * @returns {boolean}
 */
export function is_VVZ_svm(tokens, idx) { … }   // NN2|VVZ via the trained SVM (vvz-svm.js)
export function is_verbal_s(tokens, idx) { … }  // genitive 's vs contracted is/has 'z
export function is_verb_VV0(tokens, idx) { … }  // heteronym noun/adj vs verb reading
export function is_plural_noun(tokens, idx) { … }
export function is_past_tense(tokens, idx) { … }
export function is_past_participle(tokens, idx) { … }
export function is_adjective(tokens, idx) { … }
```

The dominant case — the NN2|VVZ diatone decision — is a learned linear model: retrain it with
`npm run gen:svm` (writes `src/disambig/vvz-svm.js`, consumed by `is_VVZ_svm`/`vvzScore`).
Add a new general predicate only when a whole grammatical class needs one; per-word sense
splits go in `semantic/` (below).

### Semantic Disambiguation (`src/disambig/semantic/*.js`)

~30 words whose correct euspelling depends on pronunciation (not just grammar).
Each gets its own file named after the word, matching the corpus file in `disambig/`.

```js
// src/disambig/semantic/read.js
/**
 * @param {Token[]} tokens
 * @param {number} idx
 * @returns {'reed' | 'red' | null}   null = unable to determine, use fallback
 */
export function disambiguate_read(tokens, idx) { … }
```

Corpus files in `disambig/` contain CLAWS7-tagged sentences. Use them to develop rules
and as regression fixtures.

---

## Converter Flow

```js
// src/content/converter.js  — high-level logic
function convert(word, tokens, idx) {
  const key = word.toLowerCase();
  // Abbreviations supply PoS only (via tagger.js), never replacements.
  const entry = lexicon.get(key) ?? contractions.get(key);
  if (!entry) return word;

  // encoding % 10 is the euspelling count: 0 ⇒ unchanged, 1 ⇒ single, ≥2 ⇒ disambiguate.
  const variants = entry.encoding % 10;
  if (variants === 0) return word;
  if (variants === 1) return matchCase(word, entry.spellings[0]);

  const spellingIdx = disambiguate(entry, tokens, idx);   // routes to pos.js or semantic/
  return matchCase(word, entry.spellings[spellingIdx] ?? word);
}
```

`matchCase()` preserves ALL-CAPS, Title Case, and lowercase of the original word.
The "unchanged" test is `encoding % 10 === 0`, **not** an empty euspelling field — the
encoding is authoritative.

### Token context & boundaries

`dom-walker.js` tokenises text **per block-level element** (not per text node), so a
sentence split across inline markup (`I <em>record</em> this`) is tagged as one stream.
Each `Token` is `{ word, tag, breakAfter }`; `breakAfter` marks a sentence end (`.!?` or
the block edge).

`dom-walker.js` tags each token via `tagWord()` (`tagger.js`), which returns the word's
full candidate CLAWS7 set from the lexicon as a pipe-joined string (e.g. `the` →
`AT|AT1|…`, `records` → `NN2|VVZ`) — a *lexical* tag set, not a single resolved tag.

A rule then builds its fixed two-before / two-after view with `contextWindow(tokens, idx)`
from `context.js`. Slots past a text edge **or across a sentence boundary** arrive as the
frozen `BOUNDARY` sentinel (tag `ZB`) — so a missing neighbour is a positive clause-edge
signal, and the rule sees a uniform 5-slot shape `[w-2, w-1, target, w+1, w+2]`. Rules
test candidate sets with prefix/exact matching (see `is_VVZ` in `disambig/pos.js`, which
votes noun-vs-verb for `NN2|VVZ` diatones). `converter.js` `route()` dispatches on the
entry's POS pair — `NN2|VVZ` → `is_VVZ`, and the clitic `'s` (`GE|VBZ|…`) → `is_verbal_s`
(genitive `'s` vs contracted is/has `'z`) — returning a spelling index. Encoding-202
semantic words dispatch by surface word through the `disambig/semantic/index.js` registry:
each rule returns a euspelling (e.g. `read` → `'read'`/`'redd'`/`null`) which `route()` maps
back to its index, falling back to the default on `null`. The `read` heteronym family
(`read`, `reread`, `misread`, `proofread`, `copyread`, `foreread`, `outread`, `sightread`)
shares one context engine, `disambig/semantic/read-verb.js` (`readVerbReading` → base/past/null);
each word maps the result to its own euspellings, and `reread` defaults its ambiguous
residual to past.

### Contractions (multi-PoS)

`dom-walker.js`'s tokeniser is contraction-aware (`contractions.js`): runs may carry
apostrophes (`don't`, `'tis`, `couldn't've`), a productive clitic is split (`cat's` →
`cat` + `'s`), and lookups are case/curly-apostrophe-insensitive (`I'll`, `don’t`).

A contraction is **one surface piece** (replaced once via its euspelling) but the
`PoS` field encodes a *sequence* of grammatical words — spaces separate sequence
positions, pipes separate alternative analyses (`anybody's` = `PN1 GE|PN1 VBZ|PN1 VHZ`).
`contractionComponents()` collapses that to per-position tag unions (`['PN1', 'GE|VBZ|VHZ']`),
and the tokeniser pushes **one pseudo-token per position** into the stream. So a neighbour
to the left of `he's` sees `PPHS1` and one to the right sees `VBZ|VHZ` — correct adjacency,
with `contextWindow` and the rules unchanged. Untagged contractions (empty `PoS`, e.g.
`that's`) degrade to a single empty-tag token.

---

## PDF Integration

Chrome's built-in PDF viewer is a native plugin content scripts can't touch, so the
extension ships its OWN PDF.js viewer instead. The service worker
(`src/background/service-worker.js`) detects PDF navigations — by `.pdf` URL suffix
(`webNavigation.onBeforeNavigate`), by `Content-Type` / `Content-Disposition`
headers, or by sniffing the leading bytes for `%PDF-`
(`webRequest.onHeadersReceived`) — and redirects the tab to
`src/pdf/viewer.html?file=<original url>`.

The viewer (`src/pdf/viewer.js`, bundled to `dist/pdf-viewer.js`) renders each page
with PDF.js to a canvas, runs the invisible text layer through the same
`walkTextNodes(textLayerDiv, convert)` as page conversion, and redraws each changed
word onto the canvas in the page's own font/ink/paper colours (`sample-colors.js`).
URL helpers live in `src/pdf/pdf-url.js` (unit-tested in `tests/pdf.test.js`).

---

## Build Commands

```bash
npm run build          # full build: compile CSVs + Rollup bundle
npm run build:lexicon  # recompile data/*.csv → dist/*.js only
npm run build:ext      # Rollup only (after lexicon is already compiled)
npm run gen:svm        # retrain the NN2|VVZ SVM → src/disambig/vvz-svm.js
npm run watch          # Rollup watch mode for development
```

---

## Testing Approach

- **Unit tests** (`tests/unit/`): converter.js, dom-walker.js, matchCase, individual POS functions.
- **Corpus tests** (`tests/disambig/`): parse each `disambig/*.txt`, locate the ambiguous word,
  call its disambiguation function, assert correct output.
- **Manual tests**: load the unpacked extension at `chrome://extensions` → Developer mode →
  Load unpacked.

---

## ES2023 Conventions (project-specific additions to [[chrome-extension]])

```js
// Named exports only — no default exports
export function is_VVZ(tokens, idx) { … }

// Encoding compared as integer
if (entry.encoding >= 200) { … }          // not: entry.encoding >= '200'

// Lexicon lookup always lowercase
const entry = lexicon.get(word.toLowerCase());

// Shared Token type defined once in src/content/context.js
/** @typedef {{ word: string, tag: string, breakAfter: boolean }} Token */
```

---

## Log Namespace

```js
console.warn('[euspell] Unknown word:', word);
console.error('[euspell] PDF hook failed:', err);
```

Always prefix with `[euspell]` for easy DevTools filtering.
