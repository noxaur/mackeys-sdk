//! Copies the MacKeys spec data into `OUT_DIR`.
//!
//! In the repository the files come from `../../../spec/`. A published crate has no `spec/` folder, so
//! the build falls back to `data/`. Run `scripts/vendor-data.sh` (or copy the three files by hand) into
//! `crates/mackeys-core/data/` before `cargo publish`.
use std::{env, fs, path::PathBuf};

const FILES: [&str; 3] = ["mackeys-data.json", "keyboard-clicks.json", "trackpad-clicks.json"];

fn main() {
    let dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let out = PathBuf::from(env::var("OUT_DIR").unwrap());
    for f in FILES {
        let spec = dir.join("../../../spec").join(f);
        let vendored = dir.join("data").join(f);
        println!("cargo:rerun-if-changed={}", spec.display());
        println!("cargo:rerun-if-changed={}", vendored.display());
        let src = if spec.exists() {
            spec
        } else if vendored.exists() {
            vendored
        } else {
            panic!("mackeys-core: {f} not found in ../../../spec or data/");
        };
        fs::copy(&src, out.join(f)).expect("copy spec file");
    }
}
