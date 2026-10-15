#!/bin/sh
# Bumps the version of every package (npm, Rust crates, Swift), commits and tags the release.
#
# Usage: scripts/release.sh [major|minor|patch|X.Y.Z] [--dry-run] [--push] [--yes]
#   No bump argument shows a menu.
#   --dry-run  shows the new version and the files to change, and changes nothing.
#   --push     pushes the commit and the tag to origin.
#   --yes      skips the confirmation prompt.
#
# The tag has no "v" prefix (for example 0.2.0), because SwiftPM resolves versions from plain semver tags.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NPM_PACKAGES="packages/core/package.json packages/react/package.json packages/svelte/package.json"
CARGO_WORKSPACE="rust/Cargo.toml"
CARGO_GPUI="rust/crates/mackeys-gpui/Cargo.toml"
CARGO_LOCK="rust/Cargo.lock"
CARGO_CORE_DATA="rust/crates/mackeys-core/data"
SWIFT_README="swift/README.md"

BUMP=""
DRY_RUN=0
PUSH=0
YES=0

die() { echo "error: $*" >&2; exit 1; }

for arg in "$@"; do
  case "$arg" in
    major|minor|patch) BUMP="$arg" ;;
    [0-9]*.[0-9]*.[0-9]*) BUMP="$arg" ;;
    --dry-run) DRY_RUN=1 ;;
    --push) PUSH=1 ;;
    --yes|-y) YES=1 ;;
    -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown argument: $arg" ;;
  esac
done

# Current version: every package must have the same version.
CURRENT="$(sed -n 's/^  "version": "\(.*\)",$/\1/p' packages/core/package.json)"
[ -n "$CURRENT" ] || die "cannot read the version from packages/core/package.json"
for f in $NPM_PACKAGES; do
  v="$(sed -n 's/^  "version": "\(.*\)",$/\1/p' "$f")"
  [ "$v" = "$CURRENT" ] || die "$f has version $v, expected $CURRENT"
done
v="$(sed -n 's/^version = "\(.*\)"$/\1/p' "$CARGO_WORKSPACE" | head -n 1)"
[ "$v" = "$CURRENT" ] || die "$CARGO_WORKSPACE has version $v, expected $CURRENT"

MAJOR="${CURRENT%%.*}"
REST="${CURRENT#*.}"
MINOR="${REST%%.*}"
PATCH="${REST#*.}"
PATCH="${PATCH%%[-+]*}"

if [ -z "$BUMP" ]; then
  echo "Current version: $CURRENT"
  echo "  1) patch  -> $MAJOR.$MINOR.$((PATCH + 1))"
  echo "  2) minor  -> $MAJOR.$((MINOR + 1)).0"
  echo "  3) major  -> $((MAJOR + 1)).0.0"
  echo "  4) custom version"
  printf "Select [1-4]: "
  read -r choice
  case "$choice" in
    1|patch) BUMP=patch ;;
    2|minor) BUMP=minor ;;
    3|major) BUMP=major ;;
    4|custom) printf "New version (X.Y.Z): "; read -r BUMP ;;
    *) die "invalid selection: $choice" ;;
  esac
fi

case "$BUMP" in
  patch) NEW="$MAJOR.$MINOR.$((PATCH + 1))" ;;
  minor) NEW="$MAJOR.$((MINOR + 1)).0" ;;
  major) NEW="$((MAJOR + 1)).0.0" ;;
  *) NEW="$BUMP" ;;
esac

echo "$NEW" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$' || die "invalid version: $NEW"
[ "$NEW" != "$CURRENT" ] || die "new version is the same as the current version ($CURRENT)"
git rev-parse -q --verify "refs/tags/$NEW" >/dev/null && die "tag $NEW already exists"

FILES="$NPM_PACKAGES $CARGO_WORKSPACE $CARGO_GPUI $CARGO_LOCK $SWIFT_README"

echo "Release: $CURRENT -> $NEW"
echo "Files:"
for f in $FILES; do echo "  $f"; done
if scripts/vendor-data.sh --check 2>/dev/null; then
  echo "  ($CARGO_CORE_DATA is up to date)"
else
  echo "  $CARGO_CORE_DATA (refreshed from spec/)"
fi

if [ "$DRY_RUN" = 1 ]; then
  echo "Dry run: no changes made."
  exit 0
fi

[ -z "$(git status --porcelain)" ] || die "the working tree is not clean; commit or remove the changes first"

if [ "$YES" = 0 ]; then
  printf "Continue? [y/N] "
  read -r answer
  case "$answer" in y|Y|yes) ;; *) echo "Cancelled."; exit 1 ;; esac
fi

# npm packages: the first "version" key only.
for f in $NPM_PACKAGES; do
  perl -0pi -e "s/\"version\": \"\Q$CURRENT\E\"/\"version\": \"$NEW\"/" "$f"
done

# Rust: the workspace version, the path dependency on mackeys-core, and the lockfile entries of the workspace crates.
perl -0pi -e "s/^version = \"\Q$CURRENT\E\"/version = \"$NEW\"/m" "$CARGO_WORKSPACE"
perl -0pi -e "s/(mackeys-core = \{[^}]*version = )\"[^\"]+\"/\${1}\"$NEW\"/" "$CARGO_GPUI"
perl -0pi -e "s/(name = \"mackeys-(?:core|gpui)\"\nversion = )\"[^\"]+\"/\${1}\"$NEW\"/g" "$CARGO_LOCK"

# Swift: SwiftPM uses the git tag; update the install snippet in the README.
perl -0pi -e "s/(mackeys-sdk\.git\", from: )\"[^\"]+\"/\${1}\"$NEW\"/" "$SWIFT_README"

# Check that every file changed.
for f in $FILES; do
  git diff --quiet -- "$f" && die "$f did not change; check the file format"
done

# Rust: refresh the spec data that the published mackeys-core crate ships (it has no spec/ folder).
scripts/vendor-data.sh
scripts/vendor-data.sh --check

git add $FILES "$CARGO_CORE_DATA"
git commit -q -m "Release $NEW"
git tag -a "$NEW" -m "Release $NEW"
echo "Committed and tagged $NEW."

if [ "$PUSH" = 1 ]; then
  git push origin HEAD
  git push origin "$NEW"
else
  echo "Push with: git push origin HEAD && git push origin $NEW"
fi

cat <<EOF
Publish with (from a clean checkout of the tag):
  pnpm -r build && pnpm -r publish --access public
  (cd rust && cargo publish -p mackeys-core && cargo publish -p mackeys-gpui)
Notes:
  - pnpm -r publish refuses a branch that is not main. From a worktree branch, add --no-git-checks.
  - cargo publish needs no --allow-dirty: rust/crates/mackeys-core/data/ is committed and refreshed above.
  - Publish mackeys-core first; mackeys-gpui depends on the published mackeys-core $NEW.
EOF
