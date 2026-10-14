//! # mackeys-core
//!
//! The engine of MacKeys: geometry, themes and state machines for interactive Mac keyboards (MacBook
//! Pro, Air, Neo and the iMac Magic Keyboard) and Force Touch trackpads. It is a one-to-one port of the
//! canonical TypeScript engine in `packages/core/src` and passes the fixtures in `spec/fixtures`.
//!
//! It has no UI dependencies. Renderers (for example `mackeys-gpui`) only draw what it returns.
//!
//! ```
//! use mackeys_core::*;
//! let kb = build_keyboard(&KeyboardOptions::new("air-midnight", "de"));
//! let theme = keyboard_theme(&kb.finish, &BacklightOptions::lit(12.0, Room::Dark));
//! assert_eq!(kb.keys.len(), 79);
//! assert!(theme.glow > 0.0);
//! ```
pub mod audio;
pub mod controller;
pub mod data;
pub mod keyboard;
pub mod theme;
pub mod util;

pub use audio::*;
pub use controller::*;
pub use data::*;
pub use keyboard::*;
pub use theme::*;
pub use util::*;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct MacDeviceOptions {
    #[serde(flatten)]
    pub keyboard: KeyboardOptions,
    /// `Full` = MacBook top case with trackpad; `Keyboard` = keyboard deck only. Magic Keyboard is always
    /// `Keyboard`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parts: Option<Parts>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub backlight: Option<BacklightOptions>,
}

/// Everything a renderer needs to draw one device.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MacDevice {
    pub keyboard: KeyboardGeometry,
    pub theme: KeyboardTheme,
    pub top_case: TopCaseGeometry,
}

/// Key geometry, key theme and top case of one device.
pub fn mac_device(opts: &MacDeviceOptions) -> MacDevice {
    let keyboard = build_keyboard(&opts.keyboard);
    let bl = opts.backlight.clone().unwrap_or_default();
    let theme = keyboard_theme(&keyboard.finish, &bl);
    let top_case = top_case(&keyboard.finish, &keyboard, &TopCaseOptions { parts: opts.parts, backlight: Some(bl) });
    MacDevice { keyboard, theme, top_case }
}
