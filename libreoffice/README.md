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

   Restart, then use **Euspell ▸ Convert Document** / **Convert Selection**, or
   **Revert Document / Selection to English** to go back (lexicon-based reverse).

The menu deliberately invokes the script via `location=user` (the user-profile
copy), because LibreOffice 26.2's script provider fails to register scripts
bundled *inside* an extension (`location=user:uno_packages` →
`mapPackageName2Path` KeyError). So the user-profile install in step 1 is a
prerequisite for the menu in step 2.

### Install on Linux / KDE Plasma

One command handles both native and Flatpak LibreOffice. It does the same two
parts — copy the macro + engine into the user profile, then `unopkg add` the
menu — choosing the right profile path and `unopkg` invocation for your setup:

```bash
npm run gen:lo && npm run gen:lo:oxt   # build the engine data + the .oxt (once)
libreoffice/install-linux.sh           # auto-detects native vs Flatpak
```

Close LibreOffice first (the install writes to its profile). Re-run any time to
update; `libreoffice/install-linux.sh --uninstall` removes it. If both flavors
are installed, pass `--native` or `--flatpak`.

| Flavor | Profile it targets |
|---|---|
| native (apt/dnf/zypper/pacman) | `~/.config/libreoffice/4/user` |
| Flatpak (`org.libreoffice.LibreOffice`) | `~/.var/app/org.libreoffice.LibreOffice/config/libreoffice/4/user` |

**Native LibreOffice needs the Python script provider** (Flatpak bundles it). If
the Euspell menu doesn't appear after restarting, install it:

- Debian / Ubuntu / KDE neon: `sudo apt install libreoffice-script-provider-python`
- Fedora KDE: `sudo dnf install libreoffice-pyuno`
- openSUSE: `sudo zypper install libreoffice-pyuno`
- Arch: already included in `libreoffice-fresh` / `-still`

Prefer to do it by hand? The steps mirror the Windows two-part install above with
the Linux profile path — e.g. native:

```bash
dst=~/.config/libreoffice/4/user/Scripts/python
mkdir -p "$dst"
cp libreoffice/Scripts/python/euspell_convert.py "$dst"/
cp -r libreoffice/euspell "$dst"/
unopkg add --force dict/euspell-libreoffice.oxt
```

For Flatpak, use the `~/.var/app/…` profile path and run unopkg through the
sandbox: `flatpak run --command=unopkg org.libreoffice.LibreOffice add --force
dict/euspell-libreoffice.oxt` (if that can't read the file, grant access with
`flatpak override --user --filesystem=host org.libreoffice.LibreOffice`).

Under Plasma the top-level **Euspell** menu also shows in the global-menu applet
if you use one; menus and dialogs render through LibreOffice's KDE (kf5/kf6)
integration with no extra setup. If a dialog ever misbehaves, launch once with
`SAL_USE_VCLPLUGIN=gtk3 libreoffice` as a fallback.

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
