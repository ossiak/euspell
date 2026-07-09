# Running Euspell on a KDE (Linux) box

There's no KDE-specific extension format — on a Plasma desktop (including the
immutable **KDE Linux** distro, which ships Firefox by default) the extension
runs in **Firefox** or in the **Chromium family** (Chromium / Chrome / Brave /
Vivaldi). This covers both the "just use it" and the "develop/test the build"
paths.

## Prerequisites (Node 20+, npm, git)

On a normal KDE distro, install from the package manager:

```bash
# openSUSE (KDE)          sudo zypper install nodejs20 npm git
# Fedora KDE              sudo dnf install nodejs npm git
# Arch / KDE              sudo pacman -S nodejs npm git
# KDE neon / *buntu       sudo apt install nodejs npm git
```

On the **immutable KDE Linux distro** (read-only base) don't install Node into
the system — use a container or a user-level Node:

```bash
# Option 1: distrobox (recommended on immutable bases)
distrobox create --name dev --image fedora:latest
distrobox enter dev
sudo dnf install nodejs npm git      # inside the box

# Option 2: user-level Node, no root
curl -fsSL https://fnm.vercel.app/install | bash && exec $SHELL
fnm install 20 && fnm use 20
```

## Get the code and build

```bash
git clone https://github.com/ossiak/euspell.git
cd euspell            # the euspell_ext project
npm install
npm run build         # compiles the lexicon + PDF.js assets + bundles
```

## Firefox — the KDE default browser (recommended)

Auto-run in a scratch profile (hot-reloads on rebuild):

```bash
npm run build:firefox     # stages build/firefox/ + build/euspell-firefox.zip
npm run run:firefox       # launches Firefox with the extension loaded
```

`web-ext` finds a normal Firefox on `PATH`. If your Firefox is a **Flatpak**
(common on KDE Linux) and isn't found, load it manually instead:

1. `npm run build:firefox`
2. Firefox → `about:debugging#/runtime/this-firefox`
3. **Load Temporary Add-on…** → pick `build/firefox/manifest.json`

Temporary add-ons are removed on restart. For a **permanent** unsigned install,
use Firefox Developer Edition / Nightly / ESR, set
`xpinstall.signatures.required = false` in `about:config`, then install
`build/euspell-firefox.zip`. For everyday use the real path is installing the
**signed** build from addons.mozilla.org (see the sign workflow in
`.github/workflows/firefox-sign.yml`).

## Chromium family on KDE (Chromium / Chrome / Brave / Vivaldi)

The **repo root** is the Chromium manifest — no separate build beyond
`npm run build`:

1. `chrome://extensions` (or `brave://extensions`, etc.)
2. Toggle **Developer mode** (top-right)
3. **Load unpacked** → select the repo root folder (`euspell`)

## Verify it's working

Open any English news article — the body text should re-spell to euspell
(e.g. *neighbours → neihbors, colour → color*). Click the toolbar icon for the
on/off and per-site toggles; open a `.pdf` to see the reformed PDF viewer.

## KDE-specific notes

- **Dictation** (Web Speech) is unsupported on Firefox and usually broken on
  Linux Chromium (no Google speech keys) — the extension detects this and hides
  the dictation button. Page conversion, the PDF viewer, and the popup all work
  regardless.
- **Dictation shortcut** is `Ctrl+Shift+9` (moved off `Ctrl+Shift+U`, which
  KDE/IBus captures for Unicode entry). Rebind it at `about:addons` ⚙️ → *Manage
  Extension Shortcuts* (Firefox) or `chrome://extensions/shortcuts` (Chromium).
