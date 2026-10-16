import Foundation
import Observation

// State machines for the keyboard and the trackpad, a port of `packages/core/src/controller.ts`.
// Both are `@MainActor @Observable`, so SwiftUI views redraw when their state changes.

public enum InputSource: String, Codable, Sendable { case pointer, keyboard, api }

public struct KeyEvent: Sendable, Equatable {
    public enum Kind: String, Sendable { case press, release }
    public var type: Kind
    public var id: String
    public var label: String
    public var sound: KeySound
    public var source: InputSource
}

public enum TrackpadSound: String, Sendable { case press, release, force }

/// Receives sound requests from the controllers. `ClickSound` in MacKeysUI implements it.
@MainActor
public protocol SoundSink: AnyObject {
    func key(_ kind: KeySound, up: Bool)
    func trackpad(_ kind: TrackpadSound)
}

/// System Settings delays for "Turn keyboard backlight off after inactivity".
public enum IdleDelay: String, CaseIterable, Sendable, Identifiable {
    case never, s5 = "5s", s10 = "10s", s30 = "30s", m1 = "1m", m5 = "5m"
    public var id: String { rawValue }
    /// Delay in milliseconds, or nil for never.
    public var milliseconds: Int? {
        switch self {
        case .never: return nil
        case .s5: return 5_000
        case .s10: return 10_000
        case .s30: return 30_000
        case .m1: return 60_000
        case .m5: return 300_000
        }
    }
}

/// A token that removes a listener when you call `cancel()`.
public struct ListenerToken: Hashable, Sendable {
    let id: UUID
}

@MainActor
@Observable
public final class KeyboardController {
    /// Ids of the keys that are down.
    public private(set) var down: Set<String> = []
    public private(set) var caps = false
    /// True while the idle timer has switched the backlight off.
    public private(set) var idle = false

    @ObservationIgnored private var keys: [String: KeyCap] = [:]
    @ObservationIgnored private var timers: [UUID: Task<Void, Never>] = [:]
    @ObservationIgnored private var idleTask: Task<Void, Never>?
    @ObservationIgnored private var listeners: [UUID: (KeyEvent) -> Void] = [:]
    @ObservationIgnored private var streams: [UUID: AsyncStream<KeyEvent>.Continuation] = [:]
    @ObservationIgnored public weak var sound: (any SoundSink)?
    /// Switch the backlight off after this many ms without a key press. Nil or 0 = never.
    @ObservationIgnored public private(set) var idleOffMs: Int?
    /// How long a synthetic tap (caps lock) holds the key down.
    @ObservationIgnored public var tapMs: Int
    /// Called for every key press and release.
    @ObservationIgnored public var onKey: ((KeyEvent) -> Void)?

    public init(keys: [KeyCap] = [], sound: (any SoundSink)? = nil, idleOffMs: Int? = nil, tapMs: Int = 110) {
        self.sound = sound
        self.idleOffMs = idleOffMs
        self.tapMs = tapMs
        setKeys(keys)
        armIdle()
    }

    public func setKeys(_ keys: [KeyCap]) {
        self.keys = Dictionary(keys.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    }

    public func setIdleOff(_ ms: Int?) {
        idleOffMs = ms
        armIdle()
        if (ms ?? 0) <= 0, idle { idle = false }
    }

    public func has(_ id: String) -> Bool { keys[id] != nil }
    public func isDown(_ id: String) -> Bool { down.contains(id) }

    /// Adds a key event listener.
    @discardableResult
    public func addListener(_ fn: @escaping (KeyEvent) -> Void) -> ListenerToken {
        let id = UUID()
        listeners[id] = fn
        return ListenerToken(id: id)
    }

    public func removeListener(_ token: ListenerToken) {
        listeners[token.id] = nil
    }

    /// A stream of key presses and releases. The stream ends when the controller is disposed.
    public func events() -> AsyncStream<KeyEvent> {
        let id = UUID()
        let (stream, cont) = AsyncStream<KeyEvent>.makeStream()
        streams[id] = cont
        cont.onTermination = { [weak self] _ in
            Task { @MainActor in self?.streams[id] = nil }
        }
        return stream
    }

    public func press(_ id: String, source: InputSource = .api) {
        if down.contains(id) { return }
        let k = keys[id]
        let kind = k?.sound ?? .key
        sound?.key(kind, up: false)
        down.insert(id)
        if id == "CapsLock" { caps.toggle() }
        if idle { idle = false }
        emit(KeyEvent(type: .press, id: id, label: k?.label ?? id, sound: kind, source: source))
        armIdle()
    }

    public func release(_ id: String, source: InputSource = .api) {
        if !down.contains(id) { return }
        let k = keys[id]
        let kind = k?.sound ?? .key
        sound?.key(kind, up: true)
        down.remove(id)
        emit(KeyEvent(type: .release, id: id, label: k?.label ?? id, sound: kind, source: source))
    }

    /// Presses a key and lets go after `tapMs`.
    public func tap(_ id: String, source: InputSource = .api) {
        press(id, source: source)
        let tid = UUID()
        let ms = tapMs
        timers[tid] = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(ms))
            guard !Task.isCancelled, let self else { return }
            self.timers[tid] = nil
            self.release(id, source: source)
        }
    }

    public func releaseAll(source: InputSource = .api) {
        releaseAll(after: nil, source: source)
    }

    /// Releases every key with one release sound: the sound class of `lead` when it is down, else `.key`.
    private func releaseAll(after lead: String?, source: InputSource) {
        if down.isEmpty { return }
        let kind = lead.flatMap { down.contains($0) ? keys[$0]?.sound : nil } ?? .key
        sound?.key(kind, up: true)
        let ids = Array(down)
        down.removeAll()
        for id in ids {
            emit(KeyEvent(type: .release, id: id, label: keys[id]?.label ?? id, sound: keys[id]?.sound ?? .key, source: source))
        }
    }

    public func setCaps(_ on: Bool) {
        if caps == on { return }
        caps = on
    }

    /// Feeds a physical key down. Returns true when the host should consume the event:
    /// every known key except Tab and command or control chords.
    @discardableResult
    public func handleKeyDown(code id: String, isRepeat: Bool = false, metaKey: Bool = false, ctrlKey: Bool = false) -> Bool {
        if keys[id] == nil { return false }
        let isMod = ["Meta", "Control", "Alt", "Shift"].contains { id.hasPrefix($0) }
        let chord = (metaKey || ctrlKey) && !isMod
        let prevent = !chord && id != "Tab"
        if isRepeat { return prevent }
        // macOS sends one key down when caps lock turns on and one key up when it turns off.
        if id == "CapsLock" {
            tap(id, source: .keyboard)
            return prevent
        }
        press(id, source: .keyboard)
        return prevent
    }

    public func handleKeyUp(code id: String) {
        if id == "CapsLock" {
            tap(id, source: .keyboard)
            return
        }
        // macOS sends no key up for keys typed while command is held, so command's release lets go of everything.
        if id == "MetaLeft" || id == "MetaRight" {
            releaseAll(after: id, source: .keyboard)
            return
        }
        if keys[id] != nil { release(id, source: .keyboard) }
    }

    public func dispose() {
        timers.values.forEach { $0.cancel() }
        timers.removeAll()
        idleTask?.cancel()
        idleTask = nil
        listeners.removeAll()
        onKey = nil
        streams.values.forEach { $0.finish() }
        streams.removeAll()
    }

    private func armIdle() {
        idleTask?.cancel()
        idleTask = nil
        guard let ms = idleOffMs, ms > 0 else { return }
        idleTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(ms))
            guard !Task.isCancelled, let self else { return }
            self.idle = true
        }
    }

    private func emit(_ ev: KeyEvent) {
        onKey?(ev)
        for fn in listeners.values { fn(ev) }
        for c in streams.values { c.yield(ev) }
    }
}

// ---- Trackpad -----------------------------------------------------------------------------------

public enum TrackpadPhase: String, Sendable { case up, down, force }

public struct TrackpadEvent: Sendable, Equatable {
    public enum Kind: String, Sendable { case press, force, release }
    public var type: Kind
    public var source: InputSource
}

/// The trackpad never moves: a haptic engine clicks it. A press clicks, holding past the force threshold
/// gives a deeper force click, and lifting gives a lighter release click.
@MainActor
@Observable
public final class TrackpadController {
    public private(set) var phase: TrackpadPhase = .up
    @ObservationIgnored private var timer: Task<Void, Never>?
    @ObservationIgnored private var listeners: [UUID: (TrackpadEvent) -> Void] = [:]
    @ObservationIgnored private var streams: [UUID: AsyncStream<TrackpadEvent>.Continuation] = [:]
    @ObservationIgnored public weak var sound: (any SoundSink)?
    /// Hold time before a press becomes a force click. Default 500 ms.
    @ObservationIgnored public var forceDelayMs: Int
    @ObservationIgnored public var onEvent: ((TrackpadEvent) -> Void)?

    public init(sound: (any SoundSink)? = nil, forceDelayMs: Int = 500) {
        self.sound = sound
        self.forceDelayMs = forceDelayMs
    }

    @discardableResult
    public func addListener(_ fn: @escaping (TrackpadEvent) -> Void) -> ListenerToken {
        let id = UUID()
        listeners[id] = fn
        return ListenerToken(id: id)
    }

    public func removeListener(_ token: ListenerToken) { listeners[token.id] = nil }

    public func events() -> AsyncStream<TrackpadEvent> {
        let id = UUID()
        let (stream, cont) = AsyncStream<TrackpadEvent>.makeStream()
        streams[id] = cont
        cont.onTermination = { [weak self] _ in
            Task { @MainActor in self?.streams[id] = nil }
        }
        return stream
    }

    /// Starts a click. `timedForce` = false when the host reports real pressure and calls `force()` itself.
    public func press(source: InputSource = .api, timedForce: Bool = true) {
        if phase != .up { return }
        sound?.trackpad(.press)
        set(.down, TrackpadEvent(type: .press, source: source))
        timer?.cancel()
        timer = nil
        if timedForce {
            let ms = forceDelayMs
            timer = Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(ms))
                guard !Task.isCancelled, let self else { return }
                self.force(source: source)
            }
        }
    }

    /// Stops the timed force click (the host found real pressure input).
    public func cancelTimedForce() {
        timer?.cancel()
        timer = nil
    }

    /// Deepens a held click into a force click.
    public func force(source: InputSource = .api) {
        if phase != .down { return }
        sound?.trackpad(.force)
        set(.force, TrackpadEvent(type: .force, source: source))
    }

    public func release(source: InputSource = .api) {
        if phase == .up { return }
        timer?.cancel()
        timer = nil
        sound?.trackpad(.release)
        set(.up, TrackpadEvent(type: .release, source: source))
    }

    public func dispose() {
        timer?.cancel()
        timer = nil
        listeners.removeAll()
        onEvent = nil
        streams.values.forEach { $0.finish() }
        streams.removeAll()
    }

    private func set(_ p: TrackpadPhase, _ ev: TrackpadEvent) {
        phase = p
        onEvent?(ev)
        for fn in listeners.values { fn(ev) }
        for c in streams.values { c.yield(ev) }
    }
}
