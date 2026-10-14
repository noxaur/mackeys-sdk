//! # mackeys-gpui
//!
//! GPUI components for MacKeys: interactive Mac keyboards ([`MacKeyboard`]), MacBook top cases
//! ([`MacBook`]) and Force Touch trackpads ([`MacTrackpad`]), drawn from the geometry and themes of
//! [`mackeys_core`].
//!
//! Register [`MacKeysAssets`] as the app's asset source: the components draw key glyphs and speaker
//! grilles as generated SVGs.
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
pub mod assets;
mod device;
pub mod keymap;
pub mod paint;
pub mod render;
pub mod sound;
mod timer;
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
