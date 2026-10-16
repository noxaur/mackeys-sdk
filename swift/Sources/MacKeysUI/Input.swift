import SwiftUI
import AppKit
import MacKeysCore

/// Reads the NSWindow that hosts a SwiftUI view.
struct WindowReader: NSViewRepresentable {
    let onWindow: @MainActor (NSWindow?) -> Void

    final class ReaderView: NSView {
        var onWindow: (@MainActor (NSWindow?) -> Void)?
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            onWindow?(window)
        }
    }

    func makeNSView(context: Context) -> ReaderView {
        let v = ReaderView()
        v.onWindow = onWindow
        return v
    }

    func updateNSView(_ v: ReaderView, context: Context) {
        v.onWindow = onWindow
        if v.window != nil { onWindow(v.window) }
    }
}

/// Feeds physical key events of one window into a `KeyboardController`.
/// Key down, key up and modifier changes map through `MacKeyCodes` to `KeyboardEvent.code` ids.
/// Events are left alone while a text field or text view is first responder.
@MainActor
final class KeyCaptureMonitor {
    weak var controller: KeyboardController?
    weak var window: NSWindow? {
        didSet { if window !== oldValue { observeWindow() } }
    }
    private var monitor: Any?
    private var resign: NSObjectProtocol?

    func start() {
        guard monitor == nil else { return }
        // stop() removes the focus observer. The window can be the same one, so its didSet does not run again.
        if resign == nil { observeWindow() }
        monitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown, .keyUp, .flagsChanged]) { [weak self] event in
            nonisolated(unsafe) let e = event
            let consume = MainActor.assumeIsolated { self?.consumes(e) ?? false }
            return consume ? nil : event
        }
    }

    func stop() {
        if let monitor { NSEvent.removeMonitor(monitor) }
        monitor = nil
        if let resign { NotificationCenter.default.removeObserver(resign) }
        resign = nil
        controller?.releaseAll(source: .keyboard)
    }

    private func observeWindow() {
        if let resign { NotificationCenter.default.removeObserver(resign) }
        resign = nil
        guard let window else { return }
        // Focus loss releases every key.
        resign = NotificationCenter.default.addObserver(forName: NSWindow.didResignKeyNotification, object: window, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.controller?.releaseAll(source: .keyboard) }
        }
    }

    /// Feeds the event to the controller. Returns true when the event should be consumed.
    private func consumes(_ event: NSEvent) -> Bool {
        guard let c = controller else { return false }
        if let window, event.window !== window { return false }
        if event.window?.firstResponder is NSText { return false }
        guard let code = MacKeyCodes.code(for: event.keyCode) else { return false }
        let flags = event.modifierFlags
        switch event.type {
        case .keyDown:
            if code == "CapsLock" { return false }
            let consume = c.handleKeyDown(code: code, isRepeat: event.isARepeat,
                                          metaKey: flags.contains(.command), ctrlKey: flags.contains(.control))
            return consume
        case .keyUp:
            if code == "CapsLock" { return false }
            c.handleKeyUp(code: code)
            return false
        case .flagsChanged:
            if code == "CapsLock" {
                // macOS sends one flagsChanged per caps lock toggle: tap the key, then follow the real state.
                c.tap("CapsLock", source: .keyboard)
                c.setCaps(flags.contains(.capsLock))
                return false
            }
            if MacKeyCodes.modifierIsDown(code: code, modifierFlags: flags.rawValue) {
                c.handleKeyDown(code: code, metaKey: flags.contains(.command), ctrlKey: flags.contains(.control))
            } else {
                c.handleKeyUp(code: code)
            }
            return false
        default:
            return false
        }
    }
}

/// Watches Force Touch pressure while the pointer holds a trackpad view down.
/// Stage 2 (deep click) calls `force()` and plays haptic feedback. When pressure events arrive,
/// the 500 ms timer fallback is cancelled.
@MainActor
final class PressureMonitor {
    static let shared = PressureMonitor()
    /// True after any pressure event: the host has Force Touch hardware.
    private(set) var hasPressure = false
    private weak var active: TrackpadController?
    private var monitor: Any?
    private var lastStage = 0

    func begin(_ c: TrackpadController) {
        active = c
        lastStage = 0
        if monitor == nil {
            monitor = NSEvent.addLocalMonitorForEvents(matching: [.pressure]) { [weak self] e in
                let stage = e.stage
                MainActor.assumeIsolated { self?.handle(stage: stage) }
                return e
            }
        }
    }

    func end() {
        active = nil
    }

    private func handle(stage: Int) {
        hasPressure = true
        guard let c = active, c.phase != .up else { return }
        c.cancelTimedForce()
        if stage >= 2 && lastStage < 2 {
            c.force(source: .pointer)
            NSHapticFeedbackManager.defaultPerformer.perform(.levelChange, performanceTime: .now)
        }
        lastStage = stage
    }
}
