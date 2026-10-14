import Foundation
import Testing
@testable import MacKeysCore

@MainActor
final class SoundSpy: SoundSink {
    var keys: [(KeySound, Bool)] = []
    var pads: [TrackpadSound] = []
    func key(_ kind: KeySound, up: Bool) { keys.append((kind, up)) }
    func trackpad(_ kind: TrackpadSound) { pads.append(kind) }
}

@MainActor
@Suite("Controllers")
struct ControllerTests {
    let kb = buildKeyboard(finish: .proSpaceBlack, layout: .enUS)

    @Test func pressAndRelease() {
        let spy = SoundSpy()
        let c = KeyboardController(keys: kb.keys, sound: spy)
        var events: [KeyEvent] = []
        c.onKey = { events.append($0) }
        c.press("KeyA", source: .pointer)
        c.press("KeyA", source: .pointer)
        #expect(c.isDown("KeyA"))
        #expect(events.count == 1)
        c.press("Space")
        c.release("KeyA")
        c.release("KeyA")
        #expect(!c.isDown("KeyA"))
        #expect(events.map(\.type) == [.press, .press, .release])
        #expect(events[1].sound == .space)
        #expect(spy.keys.count == 3)
        #expect(spy.keys[1].0 == .space && spy.keys[2].1 == true)
        #expect(events[0].label == "A")
    }

    @Test func capsToggleAndTap() async throws {
        let c = KeyboardController(keys: kb.keys, tapMs: 20)
        #expect(c.handleKeyDown(code: "CapsLock"))
        #expect(c.caps)
        #expect(c.isDown("CapsLock"))
        try await Task.sleep(for: .milliseconds(120))
        #expect(!c.isDown("CapsLock"))
        c.handleKeyUp(code: "CapsLock")
        #expect(!c.caps)
    }

    @Test func defaultTapIs110() {
        #expect(KeyboardController().tapMs == 110)
        #expect(TrackpadController().forceDelayMs == 500)
    }

    @Test func preventRules() {
        let c = KeyboardController(keys: kb.keys)
        #expect(c.handleKeyDown(code: "Unknown") == false)
        #expect(c.handleKeyDown(code: "Tab") == false)
        #expect(c.handleKeyDown(code: "KeyC", metaKey: true) == false)
        #expect(c.isDown("KeyC"))
        #expect(c.handleKeyDown(code: "ShiftLeft", metaKey: true) == true)
        #expect(c.handleKeyDown(code: "KeyB") == true)
        // Auto-repeat does not press again.
        c.release("KeyB")
        #expect(c.handleKeyDown(code: "KeyB", isRepeat: true) == true)
        #expect(!c.isDown("KeyB"))
    }

    @Test func metaUpReleasesAll() {
        let spy = SoundSpy()
        let c = KeyboardController(keys: kb.keys, sound: spy)
        c.handleKeyDown(code: "MetaLeft")
        c.handleKeyDown(code: "KeyC", metaKey: true)
        #expect(c.down.count == 2)
        spy.keys.removeAll()
        c.handleKeyUp(code: "MetaLeft")
        #expect(c.down.isEmpty)
        #expect(spy.keys.count == 1)
    }

    @Test func idleTimer() async throws {
        let c = KeyboardController(keys: kb.keys, idleOffMs: 40)
        #expect(!c.idle)
        try await Task.sleep(for: .milliseconds(150))
        #expect(c.idle)
        c.press("KeyA")
        #expect(!c.idle)
        c.setIdleOff(nil)
        try await Task.sleep(for: .milliseconds(100))
        #expect(!c.idle)
    }

    @Test func asyncStream() async throws {
        let c = KeyboardController(keys: kb.keys)
        let stream = c.events()
        c.press("KeyQ")
        c.release("KeyQ")
        c.dispose()
        var got: [KeyEvent.Kind] = []
        for await e in stream { got.append(e.type) }
        #expect(got == [.press, .release])
    }

    @Test func trackpadTimedForce() async throws {
        let spy = SoundSpy()
        let t = TrackpadController(sound: spy, forceDelayMs: 30)
        t.press()
        #expect(t.phase == .down)
        try await Task.sleep(for: .milliseconds(150))
        #expect(t.phase == .force)
        t.release()
        #expect(t.phase == .up)
        #expect(spy.pads == [.press, .force, .release])
    }

    @Test func trackpadHostForce() async throws {
        let t = TrackpadController(forceDelayMs: 20)
        var events: [TrackpadEvent.Kind] = []
        t.onEvent = { events.append($0.type) }
        t.press(source: .pointer, timedForce: false)
        try await Task.sleep(for: .milliseconds(80))
        #expect(t.phase == .down)
        t.force(source: .pointer)
        #expect(t.phase == .force)
        t.force()
        t.release()
        t.release()
        #expect(events == [.press, .force, .release])
    }
}
