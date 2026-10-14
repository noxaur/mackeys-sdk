//! Native macOS input that GPUI 0.2.2 does not report: physical key codes (with left and right
//! modifiers) and Force Touch pressure stages.
//!
//! [`Monitor::install`] adds an `NSEvent` local monitor for key down, key up, flags changed and
//! pressure events. It only looks at events of the view's own window and never consumes them. Each
//! event goes to the view through a channel; the view applies it only while it has focus (keys) or
//! while its trackpad is pressed (pressure).
use crate::keycodes::{code_for_keycode, modifier_bit};
use futures::channel::mpsc::{unbounded, UnboundedReceiver};

/// One native input event, already mapped to `KeyboardEvent.code`.
#[derive(Clone, Debug, PartialEq)]
pub enum NativeEvent {
    KeyDown { code: &'static str, repeat: bool, meta: bool, ctrl: bool },
    KeyUp { code: &'static str },
    /// A modifier key changed. `down` is its new state. Caps lock reports each toggle as a down.
    Modifier { code: &'static str, down: bool, meta: bool, ctrl: bool, caps: bool },
    /// Force Touch pressure stage: 0 (none), 1 (click), 2 (force click).
    Pressure { stage: i64 },
}

/// Maps a flags-changed event (key code and device-dependent modifier flags) to an event.
pub fn modifier_event(key_code: u16, flags: u64, iso: bool) -> Option<NativeEvent> {
    let code = code_for_keycode(key_code, iso)?;
    let meta = flags & (1 << 20) != 0;
    let ctrl = flags & (1 << 18) != 0;
    let caps = flags & (1 << 16) != 0;
    let down = match modifier_bit(key_code) {
        Some(bit) => flags & bit != 0,
        None if code == "CapsLock" => true,
        None => return None,
    };
    Some(NativeEvent::Modifier { code, down, meta, ctrl, caps })
}

#[cfg(target_os = "macos")]
mod imp {
    use super::*;
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2_app_kit::{
        NSEvent, NSEventMask, NSEventType, NSHapticFeedbackManager, NSHapticFeedbackPattern, NSHapticFeedbackPerformanceTime,
        NSHapticFeedbackPerformer, NSView,
    };
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use std::ptr::NonNull;

    #[link(name = "Carbon", kind = "framework")]
    extern "C" {
        fn KBGetLayoutType(keyboard_type: i16) -> u32;
        fn LMGetKbdType() -> u8;
    }

    /// True when the current keyboard is an ISO keyboard (`kKeyboardISO`).
    pub fn iso_keyboard() -> bool {
        // SAFETY: plain C calls without pointers; they read the current keyboard type.
        unsafe { KBGetLayoutType(LMGetKbdType() as i16) == u32::from_be_bytes(*b"ISO ") }
    }

    /// An installed local event monitor. Dropping it removes the monitor.
    pub struct Monitor {
        token: Retained<AnyObject>,
    }

    impl Drop for Monitor {
        fn drop(&mut self) {
            // SAFETY: the token came from addLocalMonitorForEventsMatchingMask.
            unsafe { NSEvent::removeMonitor(&self.token) };
        }
    }

    impl Monitor {
        /// Installs a monitor for the window of `window` and returns it with its event stream.
        /// Returns `None` when the window is not an AppKit window (for example, in tests).
        pub fn install(window: &gpui::Window) -> Option<(Monitor, UnboundedReceiver<NativeEvent>)> {
            // GPUI's test windows panic in `window_handle`; treat that as "no AppKit window".
            let prev = std::panic::take_hook();
            std::panic::set_hook(Box::new(|_| {}));
            let raw = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| HasWindowHandle::window_handle(window).ok().map(|h| h.as_raw())));
            std::panic::set_hook(prev);
            let RawWindowHandle::AppKit(h) = raw.ok()?? else { return None };
            // SAFETY: GPUI's AppKit handle points to its live NSView; we are on the main thread.
            let view: &NSView = unsafe { h.ns_view.cast::<NSView>().as_ref() };
            let number = view.window()?.windowNumber();
            let (tx, rx) = unbounded();
            let block = RcBlock::new(move |ev: NonNull<NSEvent>| -> *mut NSEvent {
                // SAFETY: AppKit passes a valid event.
                let e = unsafe { ev.as_ref() };
                if e.windowNumber() == number {
                    let flags = e.modifierFlags().0 as u64;
                    let t = e.r#type();
                    let out = if t == NSEventType::KeyDown || t == NSEventType::KeyUp {
                        code_for_keycode(e.keyCode(), iso_keyboard()).map(|code| {
                            if t == NSEventType::KeyDown {
                                NativeEvent::KeyDown { code, repeat: e.isARepeat(), meta: flags & (1 << 20) != 0, ctrl: flags & (1 << 18) != 0 }
                            } else {
                                NativeEvent::KeyUp { code }
                            }
                        })
                    } else if t == NSEventType::FlagsChanged {
                        modifier_event(e.keyCode(), flags, iso_keyboard())
                    } else if t == NSEventType::Pressure {
                        Some(NativeEvent::Pressure { stage: e.stage() as i64 })
                    } else {
                        None
                    };
                    if let Some(o) = out {
                        let _ = tx.unbounded_send(o);
                    }
                }
                ev.as_ptr()
            });
            let mask = NSEventMask::KeyDown | NSEventMask::KeyUp | NSEventMask::FlagsChanged | NSEventMask::Pressure;
            // SAFETY: the block returns the event it got (valid, not consumed).
            let token = unsafe { NSEvent::addLocalMonitorForEventsMatchingMask_handler(mask, &block) }?;
            Some((Monitor { token }, rx))
        }
    }

    /// Plays the generic haptic feedback on the Force Touch trackpad.
    pub fn haptic() {
        let p = NSHapticFeedbackManager::defaultPerformer();
        p.performFeedbackPattern_performanceTime(NSHapticFeedbackPattern::Generic, NSHapticFeedbackPerformanceTime::Now);
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    use super::*;

    /// No native monitor on this platform.
    pub struct Monitor;

    impl Monitor {
        pub fn install(_window: &gpui::Window) -> Option<(Monitor, UnboundedReceiver<NativeEvent>)> {
            None
        }
    }

    pub fn haptic() {}

    pub fn iso_keyboard() -> bool {
        false
    }
}

pub use imp::{haptic, iso_keyboard, Monitor};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn modifier_sides() {
        // Right shift down: device bit 0x4 plus the shift flag.
        assert_eq!(
            modifier_event(60, 0x4 | (1 << 17), false),
            Some(NativeEvent::Modifier { code: "ShiftRight", down: true, meta: false, ctrl: false, caps: false })
        );
        // Right shift up while left shift stays down.
        assert_eq!(
            modifier_event(60, 0x2 | (1 << 17), false),
            Some(NativeEvent::Modifier { code: "ShiftRight", down: false, meta: false, ctrl: false, caps: false })
        );
        assert_eq!(
            modifier_event(54, 0x10 | (1 << 20), false),
            Some(NativeEvent::Modifier { code: "MetaRight", down: true, meta: true, ctrl: false, caps: false })
        );
        assert_eq!(
            modifier_event(57, 1 << 16, false),
            Some(NativeEvent::Modifier { code: "CapsLock", down: true, meta: false, ctrl: false, caps: true })
        );
        assert_eq!(modifier_event(0, 0, false), None);
    }
}
