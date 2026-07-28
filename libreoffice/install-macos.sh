#!/usr/bin/env bash
#
# Install (or remove) the Euspell LibreOffice add-in on macOS.
#
# macOS ships LibreOffice as a single application bundle
# (/Applications/LibreOffice.app), which bundles its own Python — so unlike
# native Linux there is no separate script-provider package to install. unopkg
# and soffice live inside the bundle at Contents/MacOS.
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
#   libreoffice/install-macos.sh [--app /path/to/LibreOffice.app] [--uninstall]
#   libreoffice/install-macos.sh --help
#
# With no --app it looks in /Applications and ~/Applications.
set -euo pipefail

OXT_ID="org.euspell.libreoffice"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_MACRO="$SCRIPT_DIR/Scripts/python/euspell_convert.py"
SRC_ENGINE="$SCRIPT_DIR/euspell"
OXT="$REPO_ROOT/dict/euspell-libreoffice.oxt"

# The macOS user profile is under ~/Library/Application Support (not ~/.config
# as on Linux, nor %APPDATA% as on Windows).
PROFILE="$HOME/Library/Application Support/LibreOffice/4/user"
SCRIPTS_DIR="$PROFILE/Scripts/python"

APP=""
UNINSTALL=0

log()  { printf '\033[1;34m[euspell]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[euspell] warning:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[euspell] error:\033[0m %s\n' "$*" >&2; exit 1; }

# Print the leading comment block (everything after the shebang, up to the first
# non-comment line) as help text, stripping the "# " prefix.
usage() { awk 'NR==1{next} /^#/{sub(/^# ?/,"");print;next} {exit}' "${BASH_SOURCE[0]}"; exit 0; }

while [ $# -gt 0 ]; do
  case "$1" in
    --app)       APP="${2:-}"; shift ;;
    --uninstall) UNINSTALL=1 ;;
    -h|--help)   usage ;;
    *)           die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

# --- locate LibreOffice.app -------------------------------------------------
if [ -z "$APP" ]; then
  for cand in "/Applications/LibreOffice.app" "$HOME/Applications/LibreOffice.app"; do
    if [ -d "$cand" ]; then APP="$cand"; break; fi
  done
fi
[ -n "$APP" ] || die "LibreOffice.app not found in /Applications or ~/Applications — pass --app /path/to/LibreOffice.app"
[ -d "$APP" ] || die "no such app bundle: $APP"
UNOPKG="$APP/Contents/MacOS/unopkg"
[ -x "$UNOPKG" ] || die "unopkg not found in the bundle at $UNOPKG — is this a LibreOffice.app?"
log "LibreOffice: $APP"

# --- LibreOffice must be closed (profile writes + unopkg take a lock) --------
if pgrep -x soffice.bin >/dev/null 2>&1; then
  die "LibreOffice is running — quit it completely (⌘Q, including the Start Center) and rerun"
fi

# --- uninstall path ---------------------------------------------------------
if [ "$UNINSTALL" -eq 1 ]; then
  log "Removing menu extension ($OXT_ID)…"
  "$UNOPKG" remove "$OXT_ID" 2>/dev/null || warn "extension was not registered (already removed?)"
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
"$UNOPKG" add --force "$OXT" || die "unopkg failed to register $OXT"

log "Installed. Restart LibreOffice — you'll get a top-level Euspell menu"
log "(Convert Document / Convert Selection, and the Revert entries)."
