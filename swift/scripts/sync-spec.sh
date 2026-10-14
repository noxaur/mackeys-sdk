#!/bin/sh
# Copies the shared spec files into the Swift package (resources and test fixtures).
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SPEC="$HERE/../spec"
cp "$SPEC/mackeys-data.json" "$SPEC/keyboard-clicks.json" "$SPEC/trackpad-clicks.json" "$HERE/Sources/MacKeysCore/Resources/"
cp "$SPEC"/fixtures/*.json "$HERE/Tests/MacKeysCoreTests/Fixtures/"
echo "synced spec into $HERE"
