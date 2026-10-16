//! Copies the MacKeys spec data into `OUT_DIR`.
//!
//! In the repository the files come from `../../../spec/`. A published crate has no `spec/` folder, so
//! the build falls back to `data/`, which is committed. `scripts/vendor-data.sh` updates `data/` from `spec/`;
//! `scripts/release.sh` runs it before the release commit, and `tests/vendored_data.rs` fails when they differ.
use std::{env, fs, path::PathBuf};

const FILES: [&str; 3] = ["mackeys-data.json", "keyboard-clicks.json", "trackpad-clicks.json"];

fn main() {
    let dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let out = PathBuf::from(env::var("OUT_DIR").unwrap());
    println!("cargo:rerun-if-changed=build.rs");
    for f in FILES {
        let spec = dir.join("../../../spec").join(f);
        let vendored = dir.join("data").join(f);
        // Cargo treats a missing rerun-if-changed path as changed and reruns on every build, so watch
        // only the files that exist. A published crate has no spec/ folder.
        for p in [&spec, &vendored] {
            if p.exists() {
                println!("cargo:rerun-if-changed={}", p.display());
            }
        }
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
