//! Maps GPUI keystrokes to W3C `KeyboardEvent.code` ids.
//!
//! GPUI reports the character a key types (`Keystroke.key`), not the physical key. For a single
//! character, this module first looks for a key of the drawn layout whose legend shows that character
//! (so a German "ö" finds `Semicolon` and "z" finds `KeyY` on the German layout). Then it uses the US
//! ANSI map (characters and their shifted forms, plus GPUI's named keys).
//!
//! Limits: the result is only right when the drawn layout matches the macOS input source. A character
//! that is on two keys maps to the first. Dead keys report no character on macOS, so they are not
//! found. Modifier keys arrive as `ModifiersChangedEvent` without a left or right side, so they map to
//! the left key.
use mackeys_core::{KeyboardGeometry, Slot};

/// The US mapping of a GPUI key name to a code.
pub fn us_code(key: &str) -> Option<&'static str> {
    let k = key;
    let named = match k {
        "escape" => "Escape",
        "backspace" | "delete" => "Backspace",
        "tab" => "Tab",
        "enter" => "Enter",
        "space" => "Space",
        "up" => "ArrowUp",
        "down" => "ArrowDown",
        "left" => "ArrowLeft",
        "right" => "ArrowRight",
        "f1" => "F1",
        "f2" => "F2",
        "f3" => "F3",
        "f4" => "F4",
        "f5" => "F5",
        "f6" => "F6",
        "f7" => "F7",
        "f8" => "F8",
        "f9" => "F9",
        "f10" => "F10",
        "f11" => "F11",
        "f12" => "F12",
        "`" | "~" => "Backquote",
        "1" | "!" => "Digit1",
        "2" | "@" => "Digit2",
        "3" | "#" => "Digit3",
        "4" | "$" => "Digit4",
        "5" | "%" => "Digit5",
        "6" | "^" => "Digit6",
        "7" | "&" => "Digit7",
        "8" | "*" => "Digit8",
        "9" | "(" => "Digit9",
        "0" | ")" => "Digit0",
        "-" | "_" => "Minus",
        "=" | "+" => "Equal",
        "[" | "{" => "BracketLeft",
        "]" | "}" => "BracketRight",
        "\\" | "|" => "Backslash",
        ";" | ":" => "Semicolon",
        "'" | "\"" => "Quote",
        "," | "<" => "Comma",
        "." | ">" => "Period",
        "/" | "?" => "Slash",
        "§" | "±" => "IntlBackslash",
        _ => "",
    };
    if !named.is_empty() {
        return Some(named);
    }
    let mut cs = k.chars();
    if let (Some(c), None) = (cs.next(), cs.next()) {
        if c.is_ascii_alphabetic() {
            const LETTERS: [&str; 26] = [
                "KeyA", "KeyB", "KeyC", "KeyD", "KeyE", "KeyF", "KeyG", "KeyH", "KeyI", "KeyJ", "KeyK", "KeyL", "KeyM", "KeyN", "KeyO", "KeyP",
                "KeyQ", "KeyR", "KeyS", "KeyT", "KeyU", "KeyV", "KeyW", "KeyX", "KeyY", "KeyZ",
            ];
            return Some(LETTERS[(c.to_ascii_lowercase() as u8 - b'a') as usize]);
        }
    }
    None
}

/// Finds the code of a key: a key of the drawn layout whose main legend (then option legend) shows
/// the typed character, then the US map.
pub fn code_for_key(key: &str, kb: &KeyboardGeometry) -> Option<String> {
    if key.chars().count() == 1 {
        let lower = key.to_lowercase();
        for slots in [[Slot::T, Slot::B], [Slot::C, Slot::D]] {
            for k in &kb.keys {
                if k.legends.iter().any(|l| slots.contains(&l.slot) && l.text.to_lowercase() == lower) {
                    return Some(k.id.clone());
                }
            }
        }
    }
    us_code(key).map(String::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use mackeys_core::{build_keyboard, KeyboardOptions};

    #[test]
    fn maps() {
        let us = build_keyboard(&KeyboardOptions::default());
        assert_eq!(code_for_key("a", &us).as_deref(), Some("KeyA"));
        assert_eq!(code_for_key("!", &us).as_deref(), Some("Digit1"));
        assert_eq!(code_for_key("space", &us).as_deref(), Some("Space"));
        let de = build_keyboard(&KeyboardOptions::new("pro-space-black", "de"));
        assert_eq!(code_for_key("ö", &de).as_deref(), Some("Semicolon"));
        assert_eq!(code_for_key("ü", &de).as_deref(), Some("BracketLeft"));
        assert_eq!(code_for_key("z", &de).as_deref(), Some("KeyY"));
        assert_eq!(code_for_key("é", &us), None);
    }
}
