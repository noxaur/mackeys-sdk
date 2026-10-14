//! # mackeys-gpui
//!
//! GPUI components for MacKeys: interactive Mac keyboards ([`MacKeyboard`]), MacBooks with the open
//! lid ([`MacBook`]) and Force Touch trackpads ([`MacTrackpad`]), drawn from the geometry and themes of
//! [`mackeys_core`].
//!
//! The views draw full-color raster art: every part is an SVG document ([`art`], [`lid`]) that
//! `resvg` rasterizes ([`raster`]) on a background thread; [`scene`] places the images. On macOS a
//! native event monitor ([`native`]) adds physical key codes and Force Touch pressure.
//!
//! ```no_run
//! use gpui::{prelude::*, Application};
//! use mackeys_gpui::{MacBook, MacKeysAssets};
//!
//! Application::new().with_assets(MacKeysAssets::new()).run(|cx| {
//!     cx.open_window(Default::default(), |window, cx| {
//!         cx.new(|cx| MacBook::new(window, cx).finish("air-midnight").layout("de").scale(0.8))
//!     })
//!     .unwrap();
//! });
//! ```
pub mod art;
pub mod assets;
pub mod css;
mod device;
pub mod grain;
pub mod keycodes;
pub mod keymap;
pub mod lid;
pub mod native;
pub mod paint;
pub mod painter;
pub mod raster;
pub mod render;
pub mod scene;
pub mod sound;
mod timer;
pub mod text;
mod trackpad;

pub use assets::MacKeysAssets;
pub use device::{Backlight, DeviceCore, MacBook, MacKeyboard};
pub use sound::ClickSound;
pub use trackpad::MacTrackpad;

pub use gpui;
pub use mackeys_core;
pub use mackeys_core::{
    finish_ids, idle_delay, layout_ids, CustomLayoutPatch, InputSource, KeyEvent, KeyEventType, Room, TrackpadEvent,
    TrackpadEventType, TrackpadPhase,
};
