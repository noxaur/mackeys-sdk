//! macOS virtual key codes (`kVK_*` in `HIToolbox/Events.h`) to W3C `KeyboardEvent.code` values,
//! as Chromium maps them. The native key monitor (`native.rs`) uses this table.

/// The `KeyboardEvent.code` of a macOS virtual key code, or `None`.
///
/// On ISO keyboards, macOS reports the key left of 1 as `kVK_ISO_Section` (10) and the key right of
/// left shift as `kVK_ANSI_Grave` (50). Chromium swaps them so the codes follow the key position;
/// pass `iso = true` to do the same.
pub fn code_for_keycode(key_code: u16, iso: bool) -> Option<&'static str> {
    let k = match (iso, key_code) {
        (true, 10) => 50,
        (true, 50) => 10,
        (_, k) => k,
    };
    Some(match k {
        0 => "KeyA",
        1 => "KeyS",
        2 => "KeyD",
        3 => "KeyF",
        4 => "KeyH",
        5 => "KeyG",
        6 => "KeyZ",
        7 => "KeyX",
        8 => "KeyC",
        9 => "KeyV",
        10 => "IntlBackslash",
        11 => "KeyB",
        12 => "KeyQ",
        13 => "KeyW",
        14 => "KeyE",
        15 => "KeyR",
        16 => "KeyY",
        17 => "KeyT",
        18 => "Digit1",
        19 => "Digit2",
        20 => "Digit3",
        21 => "Digit4",
        22 => "Digit6",
        23 => "Digit5",
        24 => "Equal",
        25 => "Digit9",
        26 => "Digit7",
        27 => "Minus",
        28 => "Digit8",
        29 => "Digit0",
        30 => "BracketRight",
        31 => "KeyO",
        32 => "KeyU",
        33 => "BracketLeft",
        34 => "KeyI",
        35 => "KeyP",
        36 => "Enter",
        37 => "KeyL",
        38 => "KeyJ",
        39 => "Quote",
        40 => "KeyK",
        41 => "Semicolon",
        42 => "Backslash",
        43 => "Comma",
        44 => "Slash",
        45 => "KeyN",
        46 => "KeyM",
        47 => "Period",
        48 => "Tab",
        49 => "Space",
        50 => "Backquote",
        51 => "Backspace",
        52 => "NumpadEnter",
        53 => "Escape",
        54 => "MetaRight",
        55 => "MetaLeft",
        56 => "ShiftLeft",
        57 => "CapsLock",
        58 => "AltLeft",
        59 => "ControlLeft",
        60 => "ShiftRight",
        61 => "AltRight",
        62 => "ControlRight",
        63 => "Fn",
        64 => "F17",
        65 => "NumpadDecimal",
        67 => "NumpadMultiply",
        69 => "NumpadAdd",
        71 => "NumLock",
        72 => "AudioVolumeUp",
        73 => "AudioVolumeDown",
        74 => "AudioVolumeMute",
        75 => "NumpadDivide",
        76 => "NumpadEnter",
        78 => "NumpadSubtract",
        79 => "F18",
        80 => "F19",
        81 => "NumpadEqual",
        82 => "Numpad0",
        83 => "Numpad1",
        84 => "Numpad2",
        85 => "Numpad3",
        86 => "Numpad4",
        87 => "Numpad5",
        88 => "Numpad6",
        89 => "Numpad7",
        90 => "F20",
        91 => "Numpad8",
        92 => "Numpad9",
        93 => "IntlYen",
        94 => "IntlRo",
        95 => "NumpadComma",
        96 => "F5",
        97 => "F6",
        98 => "F7",
        99 => "F3",
        100 => "F8",
        101 => "F9",
        102 => "Lang2",
        103 => "F11",
        104 => "Lang1",
        105 => "F13",
        106 => "F16",
        107 => "F14",
        109 => "F10",
        110 => "ContextMenu",
        111 => "F12",
        113 => "F15",
        114 => "Help",
        115 => "Home",
        116 => "PageUp",
        117 => "Delete",
        118 => "F4",
        119 => "End",
        120 => "F2",
        121 => "PageDown",
        122 => "F1",
        123 => "ArrowLeft",
        124 => "ArrowRight",
        125 => "ArrowDown",
        126 => "ArrowUp",
        179 => "Fn",
        _ => return None,
    })
}

/// The device-dependent modifier flag bit (`NX_DEVICE*KEYMASK`) of a modifier key code: it is set
/// while that one key is down. Caps lock has none (it toggles).
pub fn modifier_bit(key_code: u16) -> Option<u64> {
    Some(match key_code {
        59 => 0x0001,          // left control
        56 => 0x0002,          // left shift
        60 => 0x0004,          // right shift
        55 => 0x0008,          // left command
        54 => 0x0010,          // right command
        58 => 0x0020,          // left option
        61 => 0x0040,          // right option
        62 => 0x2000,          // right control
        63 | 179 => 1 << 23,   // fn (NSEventModifierFlagFunction)
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_physical_keys() {
        assert_eq!(code_for_keycode(0, false), Some("KeyA"));
        assert_eq!(code_for_keycode(60, false), Some("ShiftRight"));
        assert_eq!(code_for_keycode(54, false), Some("MetaRight"));
        assert_eq!(code_for_keycode(93, false), Some("IntlYen"));
        assert_eq!(code_for_keycode(102, false), Some("Lang2"));
        assert_eq!(code_for_keycode(10, false), Some("IntlBackslash"));
        assert_eq!(code_for_keycode(10, true), Some("Backquote"));
        assert_eq!(code_for_keycode(50, true), Some("IntlBackslash"));
        assert_eq!(code_for_keycode(122, false), Some("F1"));
        assert_eq!(code_for_keycode(200, false), None);
        assert_eq!(modifier_bit(62), Some(0x2000));
        assert_eq!(modifier_bit(57), None);
    }

    #[test]
    fn covers_every_drawn_key() {
        // Every key a layout draws (except Touch ID) has a key code.
        let mut ids = std::collections::BTreeSet::new();
        for f in ["pro-space-black", "air-midnight", "neo-blush", "imac-blue"] {
            for l in mackeys_core::layout_ids() {
                let kb = mackeys_core::build_keyboard(&mackeys_core::KeyboardOptions::new(f, l));
                ids.extend(kb.keys.into_iter().map(|k| k.id));
            }
        }
        let mapped: std::collections::BTreeSet<&str> = (0..256).filter_map(|c| code_for_keycode(c, false)).collect();
        for id in ids {
            if id != "TouchID" && !id.starts_with('k') {
                assert!(mapped.contains(id.as_str()), "{id} has no key code");
            }
        }
    }
}
