#!/bin/sh
# Copies the spec data that mackeys-core needs into rust/crates/mackeys-core/data/.
#
# Usage: scripts/vendor-data.sh [--check]
#   No argument copies the files.
#   --check    copies nothing, and fails when a file in data/ is missing or differs from spec/.
#
# A published crate has no spec/ folder, so build.rs reads data/. The files in data/ are committed,
# so `cargo publish` works from a clean tree. scripts/release.sh runs this script before the release commit.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPEC="$ROOT/spec"
DATA="$ROOT/rust/crates/mackeys-core/data"
FILES="mackeys-data.json keyboard-clicks.json trackpad-clicks.json"

CHECK=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=1 ;;
    -h|--help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "error: unknown argument: $arg" >&2; exit 1 ;;
  esac
done

if [ "$CHECK" = 1 ]; then
  status=0
  for f in $FILES; do
    if ! cmp -s "$SPEC/$f" "$DATA/$f"; then
      echo "rust/crates/mackeys-core/data/$f differs from spec/$f" >&2
      status=1
    fi
  done
  [ "$status" = 0 ] || echo "Run scripts/vendor-data.sh to update data/." >&2
  exit "$status"
fi

mkdir -p "$DATA"
for f in $FILES; do
  cp "$SPEC/$f" "$DATA/$f"
done
echo "Copied $FILES to rust/crates/mackeys-core/data/."
