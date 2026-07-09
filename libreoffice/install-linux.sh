#!/usr/bin/env bash
#
# Install (or remove) the Euspell LibreOffice add-in on Linux / KDE Plasma.
#
# Handles both LibreOffice flavors:
#   - native   distro package (profile under ~/.config/libreoffice)
#   - flatpak  org.libreoffice.LibreOffice (sandboxed profile under ~/.var/app;
#              unopkg is run through `flatpak run`)
#
# It performs the README's two-part install — because LibreOffice's Python script
# provider can't run scripts bundled *inside* an .oxt, the macro + engine are
# copied into the user profile, and a small menu extension (the .oxt) is added on
# top:
#   1. copy Scripts/python/euspell_convert.py + the euspell/ engine into the
#      profile's Scripts/python/
#   2. unopkg add the menu extension
#
# Usage:
#   libreoffice/install-linux.sh [--native | --flatpak] [--uninstall]
#   libreoffice/install-linux.sh --help
#
# With no flavor flag it auto-detects; if both flavors are installed it asks you
# to pick one explicitly.
set -euo pipefail

OXT_ID="org.euspell.libreoffice"
FLATPAK_APP="org.libreoffice.LibreOffice"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_MACRO="$SCRIPT_DIR/Scripts/python/euspell_convert.py"
SRC_ENGINE="$SCRIPT_DIR/euspell"
OXT="$REPO_ROOT/dict/euspell-libreoffice.oxt"

FLAVOR=""
UNINSTALL=0

log()  { printf '\033[1;34m[euspell]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[euspell] warning:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[euspell] error:\033[0m %s\n' "$*" >&2; exit 1; }

# Print the leading comment block (everything after the shebang, up to the first
# non-comment line) as help text, stripping the "# " prefix.
usage() { awk 'NR==1{next} /^#/{sub(/^# ?/,"");print;next} {exit}' "${BASH_SOURCE[0]}"; exit 0; }

while [ $# -gt 0 ]; do
  case "$1" in
    --native)    FLAVOR="native" ;;
    --flatpak)   FLAVOR="flatpak" ;;
    --uninstall) UNINSTALL=1 ;;
    -h|--help)   usage ;;
    *)           die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

have_native()  { command -v libreoffice >/dev/null 2>&1 || command -v soffice >/dev/null 2>&1; }
have_flatpak() { command -v flatpak >/dev/null 2>&1 && flatpak info "$FLATPAK_APP" >/dev/null 2>&1; }

# --- pick a flavor ----------------------------------------------------------
if [ -z "$FLAVOR" ]; then
  if have_native && have_flatpak; then
    die "both native and Flatpak LibreOffice are installed — rerun with --native or --flatpak"
  elif have_native; then
    FLAVOR="native"
  elif have_flatpak; then
    FLAVOR="flatpak"
  else
    die "no LibreOffice found (looked for the 'libreoffice'/'soffice' command and the $FLATPAK_APP Flatpak)"
  fi
fi
log "LibreOffice flavor: $FLAVOR"

# Profile dir and the unopkg invocation differ per flavor.
if [ "$FLAVOR" = "flatpak" ]; then
  PROFILE="$HOME/.var/app/$FLATPAK_APP/config/libreoffice/4/user"
  unopkg_run() { flatpak run --command=unopkg "$FLATPAK_APP" "$@"; }
else
  PROFILE="$HOME/.config/libreoffice/4/user"
  unopkg_run() { unopkg "$@"; }
fi
SCRIPTS_DIR="$PROFILE/Scripts/python"

# --- LibreOffice must be closed (profile writes + unopkg take a lock) --------
if pgrep -x soffice.bin >/dev/null 2>&1; then
  die "LibreOffice is running — close it completely (including the Start Center) and rerun"
fi

# --- uninstall path ---------------------------------------------------------
if [ "$UNINSTALL" -eq 1 ]; then
  log "Removing menu extension ($OXT_ID)…"
  unopkg_run remove "$OXT_ID" 2>/dev/null || warn "extension was not registered (already removed?)"
  log "Removing macro + engine from $SCRIPTS_DIR…"
  rm -f  "$SCRIPTS_DIR/euspell_convert.py"
  rm -rf "$SCRIPTS_DIR/euspell"
  log "Done. Restart LibreOffice."
  exit 0
fi

# --- preflight: sources must be built --------------------------------------
[ -f "$SRC_MACRO" ] || die "missing $SRC_MACRO"
if [ ! -f "$SRC_ENGINE/data/lexicon.csv" ]; then
  die "engine data not built — run:  npm run gen:lo   (generates $SRC_ENGINE/data/)"
fi
if [ ! -f "$OXT" ]; then
  die "menu extension not built — run:  npm run gen:lo:oxt   (generates $OXT)"
fi

# --- 1. copy macro + engine into the profile -------------------------------
log "Installing macro + engine into $SCRIPTS_DIR…"
mkdir -p "$SCRIPTS_DIR"
cp -f "$SRC_MACRO" "$SCRIPTS_DIR/"
rm -rf "$SCRIPTS_DIR/euspell"
# Copy the engine package without editor/byte-code cruft.
cp -r "$SRC_ENGINE" "$SCRIPTS_DIR/euspell"
find "$SCRIPTS_DIR/euspell" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true

# --- 2. add the menu extension ---------------------------------------------
log "Registering the Euspell menu extension…"
if ! unopkg_run add --force "$OXT"; then
  if [ "$FLAVOR" = "flatpak" ]; then
    die "unopkg failed — the Flatpak may lack access to $OXT. Grant it and retry:
       flatpak override --user --filesystem=host $FLATPAK_APP"
  fi
  die "unopkg failed to register $OXT"
fi

# --- native: best-effort check that the Python script provider is present ---
if [ "$FLAVOR" = "native" ]; then
  if python3 -c "import uno" >/dev/null 2>&1; then
    log "python-uno detected."
  else
    pkg="the LibreOffice Python script-provider package"
    if [ -r /etc/os-release ]; then
      . /etc/os-release
      case "${ID:-}${ID_LIKE:-}" in
        *debian*|*ubuntu*) pkg="libreoffice-script-provider-python" ;;
        *fedora*|*rhel*)   pkg="libreoffice-pyuno" ;;
        *suse*)            pkg="libreoffice-pyuno" ;;
        *arch*)            pkg="(bundled in libreoffice-fresh/-still — no separate package)" ;;
      esac
    fi
    warn "could not import 'uno' with system python3. If the Euspell menu doesn't
       appear after restarting LibreOffice, install: $pkg"
  fi
fi

log "Installed. Restart LibreOffice — you'll get a top-level Euspell menu"
log "(Convert Document / Convert Selection, and the Revert entries)."
