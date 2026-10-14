# mackeys-core

Engine of MacKeys: geometry, themes, layouts and state machines for interactive Mac keyboards and
Force Touch trackpads. It has no UI code. It only depends on `serde` and `serde_json`.

Use it with [`mackeys-gpui`](https://crates.io/crates/mackeys-gpui) for GPUI views, or build your own renderer.

```toml
[dependencies]
mackeys-core = "0.1"
```

The crate is a port of the TypeScript engine `@mackeys/core`. It passes the same conformance fixtures.
The repository has the full documentation: <https://github.com/noxaur/mackeys-sdk>.

License: MIT.
