//! Checks that `data/` (the copy that `cargo publish` ships) is the same as `spec/`.
//! Run `scripts/vendor-data.sh` to update `data/`.
use std::path::PathBuf;

#[test]
fn vendored_data_matches_spec() {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    for f in ["mackeys-data.json", "keyboard-clicks.json", "trackpad-clicks.json"] {
        let spec = std::fs::read(dir.join("../../../spec").join(f)).unwrap_or_else(|e| panic!("read spec/{f}: {e}"));
        let data = std::fs::read(dir.join("data").join(f)).unwrap_or_else(|e| panic!("read data/{f}: {e}"));
        assert!(spec == data, "data/{f} differs from spec/{f}; run scripts/vendor-data.sh");
    }
}
