---
name: euspell
description: >
  Use this skill for any work on the euspell Chrome extension — spelling conversion logic,
  lexicon lookup, disambiguation functions, DOM walking, PDF.js integration, or the build
  pipeline. Triggers include: euspell_lexicon, euspell_encoding, CLAWS7, VVZ, VVD, VVN,
  PoS disambiguation, is_VVZ, is_past_tense, converter.js, dom-walker.js, pdf-handler.js,
  compile-lexicon, gen-disambig, euspelling, or any of the encoding codes (011, 012, 021,
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
│   │   ├── dom-walker.js       # Text node traversal
│   │   └── pdf-handler.js      # PDF.js hook via MAIN-world script injection
│   ├── background/
│   │   └── service-worker.js   # On/off toggle, storage init
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
│   └── gen-disambig.js         # Generates skeleton stubs in src/disambig/pos.js
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

Same four columns plus a fifth: `full form` (e.g. `is|has|does|was`).

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

**Rule:** `encoding >= 200` requires a disambiguation function.

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

Covers ~6 000 lexicon entries where the correct euspelling depends on whether the word is
acting as a noun, verb, adjective, etc.

**Do not hand-write 6 000 stubs.** Instead:
1. Run `npm run gen:disambig` to generate skeletons for all entries with `encoding >= 200`.
2. Implement each function body using context heuristics (surrounding tags, syntax patterns).
3. Re-running `gen:disambig` is safe — it skips functions already present in the file.

```js
// src/disambig/pos.js signature pattern
/**
 * @param {Token[]} tokens  — full sentence token array
 * @param {number} idx      — index of the target word
 * @returns {boolean}
 */
export function is_VVZ(tokens, idx) { … }
export function is_past_tense(tokens, idx) { … }
export function is_past_participle(tokens, idx) { … }
export function is_plural_noun(tokens, idx) { … }
export function is_adjective(tokens, idx) { … }
```

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
  const entry = lexicon.get(key) ?? abbreviations.get(key) ?? contractions.get(key);

  if (!entry || entry.encoding === 0 || entry.spellings.length === 0) return word;
  if (entry.spellings.length === 1) return matchCase(word, entry.spellings[0]);

  const spellingIdx = disambiguate(entry, tokens, idx);   // routes to pos.js or semantic/
  return matchCase(word, entry.spellings[spellingIdx] ?? word);
}
```

`matchCase()` preserves ALL-CAPS, Title Case, and lowercase of the original word.

---

## PDF.js Integration

Chrome's built-in PDF viewer embeds PDF.js. The text layer runs in the MAIN world;
content scripts run in an ISOLATED world. Bridge the gap by injecting a small script
into the MAIN world via `chrome.runtime.getURL('dist/pdf-hook.js')`.

```js
// dist/pdf-hook.js runs in MAIN world — hooks PDFViewerApplication.eventBus
window.PDFViewerApplication.eventBus.on('textlayerrendered', (event) => {
  // event.source.textLayer.textItems contains the rendered spans
});
```

Only activate `pdf-handler.js` when `document.contentType === 'application/pdf'`.

---

## Build Commands

```bash
npm run build          # full build: compile CSVs + Rollup bundle
npm run build:lexicon  # recompile data/*.csv → dist/*.js only
npm run build:ext      # Rollup only (after lexicon is already compiled)
npm run gen:disambig   # add new stubs to src/disambig/pos.js
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

// Shared Token type defined once in converter.js
/** @typedef {{ word: string, tag: string }} Token */
```

---

## Log Namespace

```js
console.warn('[euspell] Unknown word:', word);
console.error('[euspell] PDF hook failed:', err);
```

Always prefix with `[euspell]` for easy DevTools filtering.
