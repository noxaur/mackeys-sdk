# mackeys-gpui

[GPUI](https://gpui.rs) components for interactive Mac keyboards, MacBook top cases and Force Touch
trackpads. The views support 17 finishes, 17 layouts, backlight and recorded click sounds.

```toml
[dependencies]
mackeys-gpui = "0.1"
```

```rust
use mackeys_gpui::{Backlight, MacBook, MacKeysAssets, Room};
// Register MacKeysAssets as the asset source, then create a view with
// MacBook::new(window, cx).finish("pro-silver").layout("en-gb").backlight(Backlight::lit(12.0, Room::Dark))
```

Requirements: Rust 1.88 or later, and macOS. The crate uses the system SF Pro font.

The repository has the full documentation and a runnable showcase: <https://github.com/noxaur/mackeys-sdk/tree/main/rust>.

License: MIT.
