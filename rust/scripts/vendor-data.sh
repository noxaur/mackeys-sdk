#!/bin/sh
# Copies the spec data into mackeys-core/data so the crate builds outside this repository (cargo publish).
set -e
here="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$here/crates/mackeys-core/data"
for f in mackeys-data.json keyboard-clicks.json trackpad-clicks.json; do
  cp "$here/../spec/$f" "$here/crates/mackeys-core/data/$f"
done
echo "copied spec data to crates/mackeys-core/data"
