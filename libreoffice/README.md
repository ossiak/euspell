# Euspell for LibreOffice

Converts a Writer document (or selection) from traditional English into euspell
reformed spelling, using the same engine the browser extension uses — ported to
Python in [`euspell/engine.py`](euspell/engine.py) and validated against the
JavaScript engine (35/35 fixtures, `npm run test:lo`).

## Supported path: the converter macro

A one-pass converter run from a top-level **Euspell** menu (or the macro
organizer). It does **not** register any linguistic spell/grammar service, so it
never touches LibreOffice's Writing Aids machinery.

### Install (two parts)

1. **The macro + engine** go in your LibreOffice user profile. With LibreOffice
   closed:

   ```powershell
   $dst = "$env:APPDATA\LibreOffice\4\user\Scripts\python"
   New-Item -ItemType Directory -Force $dst | Out-Null
   Copy-Item ".\libreoffice\Scripts\python\euspell_convert.py" $dst -Force
   Copy-Item ".\libreoffice\euspell" $dst -Recurse -Force
   ```

   You can already run it now: **Tools ▸ Macros ▸ Organize Macros ▸ Python ▸
   My Macros ▸ euspell_convert ▸ `convert_document` ▸ Run**.

2. **The menu** (optional, nicer) is a tiny extension that adds a top-level
   **Euspell** menu calling the user-profile macro above:

   ```powershell
   unopkg add --force .\dict\euspell-libreoffice.oxt
   ```

   Restart, then use **Euspell ▸ Convert Document** / **Convert Selection**.

The menu deliberately invokes the script via `location=user` (the user-profile
copy), because LibreOffice 26.2's script provider fails to register scripts
bundled *inside* an extension (`location=user:uno_packages` →
`mapPackageName2Path` KeyError). So the user-profile install in step 1 is a
prerequisite for the menu in step 2.

## Build

```
npm run gen:lo        # copy lexicon/abbrev/contraction CSVs + export SVM weights
npm run gen:lo:oxt    # -> dict/euspell-libreoffice.oxt (the menu extension)
npm run test:lo       # regenerate JS-engine fixtures, run the Python engine test
```

## What is and isn't handled

| | Status |
|---|---|
| Context-free reforms (*above → abov*, *night → niht*) | converted |
| NN2\|VVZ diatones (*records*, *anchors*), 702 plurals, 102 heteronyms | converted from context (linear SVM + POS rules) |
| ~70 semantic homographs (*read, bow, tear, are, …*) | left unchanged (need per-word rules not ported) |
| Multi-word phrases | not collapsed |
| Inline character formatting | a converted paragraph resets to its default run formatting |

## Parked: linguistic spell/grammar services

`euspell/spellchecker.py` (`XSpellChecker`) and `euspell/proofreader.py`
(`XProofreader`) implement euspell as live spelling/grammar checkers. They are
**not shipped**: on LibreOffice 26.2, a passively-registered Python linguistic
component **crashes the Writing Aids dialog** during service enumeration —
reproduced across spell-checker-only, proofreader-only, a private `en-x-euspell`
tagged locale, and standard `en-US` locales. The crash is in LibreOffice's
handling of the component, not in the Python (the engine is unit-tested), and
isn't fixable from the extension side. They remain here for reference and in
case a future LibreOffice release fixes the enumeration crash. The converter
macro delivers the same conversion as an explicit command instead.
