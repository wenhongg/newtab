#!/usr/bin/env bash
# Build release.zip for the Chrome Web Store.
#
# - Strips the "key" field from manifest.json (the store rejects it; it only
#   pins the ID during unpacked development).
# - With --with-key, includes the private key as key.pem in the zip root so
#   the store keeps our extension ID. ONLY needed on the very first upload.
#
# Usage: ./pack.sh [--with-key]

set -euo pipefail
cd "$(dirname "$0")"

KEY_FILE="$HOME/projects/newtab-key.pem"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# Allowlist on purpose (never ship stray dev files) — UPDATE THIS LIST when
# adding a top-level module folder or asset, or the release will omit it.
cp -R newtab.html styles.css icons calendar todo scratchpad weather shared "$STAGE/"

python3 - "$STAGE/manifest.json" <<'EOF'
import json, sys
with open("manifest.json") as f:
    manifest = json.load(f)
manifest.pop("key", None)
with open(sys.argv[1], "w") as f:
    json.dump(manifest, f, indent=2)
    f.write("\n")
EOF

if [[ "${1:-}" == "--with-key" ]]; then
  if [[ ! -f "$KEY_FILE" ]]; then
    echo "error: $KEY_FILE not found" >&2
    exit 1
  fi
  cp "$KEY_FILE" "$STAGE/key.pem"
  echo "included key.pem (first-upload ID preservation)"
fi

rm -f release.zip
(cd "$STAGE" && zip -qr - .) > release.zip
echo "wrote release.zip ($(du -h release.zip | cut -f1 | tr -d ' '))"
unzip -l release.zip
