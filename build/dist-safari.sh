#!/usr/bin/env bash
#
# Package the macOS Safari host app (safari/Euspell.xcodeproj) for DIRECT
# distribution: archive -> export with Developer ID -> notarize -> staple.
# The result is a Gatekeeper-approved Euspell.app users can double-click to
# install, with the extension already signed (no "Allow Unsigned Extensions").
#
# Run the whole pipeline (stages the extension payload first):
#
#     npm run build:safari:dist
#
# or, if the payload is already staged (safari/Euspell Extension/Resources):
#
#     bash build/dist-safari.sh
#
# Notarization credentials are taken from the environment and referenced by
# PATH only -- no secret is ever written into the repo. Provide either an
# App Store Connect API key:
#
#     EUSPELL_NOTARY_KEY      path to the .p8 key file
#     EUSPELL_NOTARY_KEY_ID   the key's ID
#     EUSPELL_NOTARY_ISSUER   the issuer UUID
#
# or a stored notarytool profile (xcrun notarytool store-credentials):
#
#     EUSPELL_NOTARY_PROFILE  the profile name
#
# The signing team defaults to the one in the project; override with
# EUSPELL_TEAM_ID.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

TEAM="${EUSPELL_TEAM_ID:-5ZTUW79KSB}"
PROJECT="safari/Euspell.xcodeproj"
SCHEME="Euspell"
RESOURCES="safari/Euspell Extension/Resources/manifest.json"
OUT="dist/safari"
ARCHIVE="$OUT/Euspell.xcarchive"
EXPORT="$OUT/export"
APP="$EXPORT/Euspell.app"

# The extension payload is generated (git-ignored). Without it the app would
# ship with an empty extension, so refuse rather than build a dud.
if [[ ! -f "$RESOURCES" ]]; then
  echo "error: $RESOURCES missing -- run 'npm run build:safari' first (or use 'npm run build:safari:dist')." >&2
  exit 1
fi

# Assemble the notarytool auth flags from whichever credentials are provided.
NOTARY_AUTH=()
if [[ -n "${EUSPELL_NOTARY_PROFILE:-}" ]]; then
  NOTARY_AUTH=(--keychain-profile "$EUSPELL_NOTARY_PROFILE")
elif [[ -n "${EUSPELL_NOTARY_KEY:-}" && -n "${EUSPELL_NOTARY_KEY_ID:-}" && -n "${EUSPELL_NOTARY_ISSUER:-}" ]]; then
  NOTARY_AUTH=(--key "$EUSPELL_NOTARY_KEY" --key-id "$EUSPELL_NOTARY_KEY_ID" --issuer "$EUSPELL_NOTARY_ISSUER")
else
  echo "error: no notarization credentials. Set EUSPELL_NOTARY_PROFILE, or all of" >&2
  echo "       EUSPELL_NOTARY_KEY / EUSPELL_NOTARY_KEY_ID / EUSPELL_NOTARY_ISSUER." >&2
  exit 1
fi

echo "==> Euspell for Safari  (team $TEAM)"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "==> Archiving"
xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Release \
  -archivePath "$ARCHIVE" archive \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" >/dev/null

echo "==> Exporting (Developer ID)"
cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>developer-id</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>automatic</string>
</dict>
</plist>
PLIST
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" \
  -exportPath "$EXPORT" \
  -allowProvisioningUpdates >/dev/null

echo "==> Notarizing (this waits for Apple; usually 1-5 min)"
ditto -c -k --keepParent "$APP" "$OUT/Euspell-notarize.zip"
xcrun notarytool submit "$OUT/Euspell-notarize.zip" "${NOTARY_AUTH[@]}" --wait

echo "==> Stapling"
xcrun stapler staple "$APP"

echo "==> Verifying"
xcrun stapler validate "$APP"
spctl -a -vvv -t exec "$APP" 2>&1 || true

# Zip the stapled app for handing out (the staple travels inside the .app).
# Name it by the version the app actually reports, so it can't drift from the
# project's MARKETING_VERSION.
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")"
DIST_ZIP="$OUT/Euspell-$VERSION-macos.zip"
ditto -c -k --keepParent "$APP" "$DIST_ZIP"
rm -f "$OUT/Euspell-notarize.zip"

echo
echo "Done. Distributable, notarized + stapled:"
echo "  app: $APP"
echo "  zip: $DIST_ZIP"
