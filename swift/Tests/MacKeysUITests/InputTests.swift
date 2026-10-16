import AppKit
import Testing
@testable import MacKeysUI
import MacKeysCore

@MainActor
@Suite("Key capture")
struct InputTests {
    @Test func focusLossReleasesKeysAfterARestart() {
        let c = KeyboardController(keys: buildKeyboard(finish: .proSpaceBlack, layout: .enUS).keys)
        let window = NSWindow(contentRect: .init(x: 0, y: 0, width: 10, height: 10), styleMask: .titled, backing: .buffered, defer: true)
        let m = KeyCaptureMonitor()
        m.controller = c
        m.window = window
        m.start()
        // A view that disappears and appears again stops and starts the monitor with the same window.
        m.stop()
        m.start()
        c.press("KeyA")
        NotificationCenter.default.post(name: NSWindow.didResignKeyNotification, object: window)
        #expect(!c.isDown("KeyA"))
        m.stop()
    }
}
