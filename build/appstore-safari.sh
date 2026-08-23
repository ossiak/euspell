#!/usr/bin/env bash
#
# Build the macOS Safari host app (safari/Euspell.xcodeproj) for the MAC APP
# STORE: archive -> export (app-store-connect, a signed .pkg) -> upload to App
# Store Connect. This is a SEPARATE track from dist-safari.sh, which produces the
# Developer ID + notarized .dmg/.zip for direct download.
#
#     npm run build:safari:appstore
#
# Key differences from the direct-download build:
#   - signs with Apple Distribution (not Developer ID),
#   - ships a .pkg (not a .dmg), uploaded to App Store Connect,
#   - is NOT notarized here (Apple notarizes App Store apps internally),
#   - App Review, not Gatekeeper.
#
# PREREQUISITE: a macOS app record for org.euspell.Euspell must already exist in
# App Store Connect. Without it the upload fails ("no app with bundle id ..."),
# because a build can only be uploaded against an existing app record. Create it
# in the App Store Connect web UI first (the API key can't).
#
# App Store Connect API credentials come from the environment, by PATH only --
# no secret is written into the repo:
#   EUSPELL_ASC_KEY      path to the .p8 key file
#   EUSPELL_ASC_KEY_ID   the key's ID
#   EUSPELL_ASC_ISSUER   the issuer UUID
# The signing team defaults to the project's; override with EUSPELL_TEAM_ID.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

TEAM="${EUSPELL_TEAM_ID:-5ZTUW79KSB}"
PROJECT="safari/Euspell.xcodeproj"
SCHEME="Euspell"
RESOURCES="safari/Euspell Extension/Resources/manifest.json"
OUT="dist/safari-appstore"
ARCHIVE="$OUT/Euspell.xcarchive"
EXPORT="$OUT/export"

# The extension payload is generated (git-ignored); without it the app ships with
# an empty extension. Refuse rather than upload a dud.
if [[ ! -f "$RESOURCES" ]]; then
  echo "error: $RESOURCES missing -- run 'npm run build:safari' first (or use 'npm run build:safari:appstore')." >&2
  exit 1
fi

# App Store Connect API key, required for the upload.
: "${EUSPELL_ASC_KEY:?set EUSPELL_ASC_KEY to the .p8 key path}"
: "${EUSPELL_ASC_KEY_ID:?set EUSPELL_ASC_KEY_ID to the key ID}"
: "${EUSPELL_ASC_ISSUER:?set EUSPELL_ASC_ISSUER to the issuer UUID}"

echo "==> Euspell for Safari -> App Store  (team $TEAM)"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "==> Archiving (App Store distribution)"
xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Release \
  -archivePath "$ARCHIVE" archive \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" >/dev/null

echo "==> Exporting (app-store-connect -> .pkg)"
cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
PLIST
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" \
  -exportPath "$EXPORT" \
  -allowProvisioningUpdates >/dev/null

PKG="$(ls "$EXPORT"/*.pkg 2>/dev/null | head -1 || true)"
[[ -n "$PKG" ]] || { echo "error: export produced no .pkg (check signing/provisioning above)." >&2; exit 1; }

# altool finds the key in ~/.appstoreconnect/private_keys/AuthKey_<id>.p8.
mkdir -p ~/.appstoreconnect/private_keys
cp -f "$EUSPELL_ASC_KEY" ~/.appstoreconnect/private_keys/

echo "==> Validating with App Store Connect"
xcrun altool --validate-app -f "$PKG" -t macos \
  --apiKey "$EUSPELL_ASC_KEY_ID" --apiIssuer "$EUSPELL_ASC_ISSUER"

echo "==> Uploading to App Store Connect"
xcrun altool --upload-app -f "$PKG" -t macos \
  --apiKey "$EUSPELL_ASC_KEY_ID" --apiIssuer "$EUSPELL_ASC_ISSUER"

echo
echo "Uploaded: $PKG"
echo "Next: in App Store Connect, wait for the build to finish processing, attach"
echo "it to the org.euspell.Euspell version, complete the listing, and submit."
