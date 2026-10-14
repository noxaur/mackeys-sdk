import SwiftUI
import AppKit
import Observation
import MacKeysCore
import MacKeysUI

// MacKeys demo: pick a finish, layout, backlight and view. Run with `swift run MacKeysDemo`.

@MainActor
@Observable
final class DemoModel {
    enum Kind: String, CaseIterable, Identifiable {
        case macbook = "MacBook", keyboard = "Keyboard", trackpad = "Trackpad"
        var id: String { rawValue }
    }
    var kind: Kind = .macbook
    var finish: FinishID = .proSpaceBlack
    var layout: LayoutID = .enUS
    var on = false
    var level: Double = 12
    var room: Room = .daylight
    var bleed: Double = 0.5
    var color: Color = Color(mk: "#f2f5ff")
    var idle: IdleDelay = .never
    var sound = true
    var capture = true
    var lid = true
    var lastEvent = "Click a key or type."
    let keyboard = KeyboardController()
    let trackpad = TrackpadController()

    init() {
        keyboard.onKey = { [weak self] e in self?.lastEvent = "\(e.type.rawValue) \(e.id) (\(e.label)) from \(e.source.rawValue)" }
        trackpad.onEvent = { [weak self] e in self?.lastEvent = "trackpad \(e.type.rawValue) from \(e.source.rawValue)" }
    }

    var backlight: BacklightOptions {
        BacklightOptions(on: on, level: level, room: room, bleed: bleed, color: hex(color))
    }

    func hex(_ c: Color) -> String {
        guard let n = NSColor(c).usingColorSpace(.sRGB) else { return "#f2f5ff" }
        return rgba(Double(n.redComponent) * 255, Double(n.greenComponent) * 255, Double(n.blueComponent) * 255)
    }
}

struct DemoView: View {
    // Explicit State (not @State): the macOS 27 SDK makes @State a macro that Command Line Tools cannot expand.
    private let modelState = State(initialValue: DemoModel())
    private var model: DemoModel { modelState.wrappedValue }

    private func bind<T>(_ kp: ReferenceWritableKeyPath<DemoModel, T>) -> Binding<T> {
        let m = model
        return Binding(get: { m[keyPath: kp] }, set: { m[keyPath: kp] = $0 })
    }

    var body: some View {
        let m = model
        let dark = m.room == .dark && m.on
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 16) {
                Picker("View", selection: bind(\.kind)) {
                    ForEach(DemoModel.Kind.allCases) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.segmented).frame(width: 300)
                Picker("Finish", selection: bind(\.finish)) {
                    ForEach(FinishID.allCases) { Text($0.name).tag($0) }
                }.frame(width: 300)
                Picker("Layout", selection: bind(\.layout)) {
                    ForEach(LayoutID.allCases) { Text($0.name).tag($0) }
                }.frame(width: 240)
            }
            HStack(spacing: 16) {
                Toggle("Backlight", isOn: bind(\.on))
                HStack { Text("Level"); Slider(value: bind(\.level), in: 0...16, step: 1).frame(width: 120) }
                Picker("Room", selection: bind(\.room)) {
                    ForEach(Room.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }.frame(width: 160)
                HStack { Text("Bleed"); Slider(value: bind(\.bleed), in: 0...1).frame(width: 100) }
                ColorPicker("Color", selection: bind(\.color))
                Picker("Idle off", selection: bind(\.idle)) {
                    ForEach(IdleDelay.allCases) { Text($0.rawValue).tag($0) }
                }.frame(width: 140)
                Toggle("Sound", isOn: bind(\.sound))
                Toggle("Capture keyboard", isOn: bind(\.capture))
                Toggle("Lid", isOn: bind(\.lid))
            }
            Text(m.lastEvent).font(.system(.body, design: .monospaced)).foregroundStyle(dark ? .white : .secondary)
            ScrollView {
                Group {
                    switch m.kind {
                    case .macbook:
                        MacBookView(finish: m.finish, layout: m.layout, backlight: m.backlight, sound: m.sound,
                                    captureKeyboard: m.capture, idleOff: m.idle, sizing: .fitWidth, showLid: m.lid,
                                    controller: m.keyboard, trackpadController: m.trackpad)
                    case .keyboard:
                        MacKeyboardView(finish: m.finish, layout: m.layout, backlight: m.backlight, sound: m.sound,
                                        captureKeyboard: m.capture, idleOff: m.idle, sizing: .fitWidth, controller: m.keyboard)
                    case .trackpad:
                        MacTrackpadView(finish: m.finish, sound: m.sound, sizing: .scale(1), controller: m.trackpad)
                    }
                }
                .padding(20)
            }
        }
        .padding(16)
        .frame(minWidth: 1100, minHeight: 760)
        .background(Color(mk: dark ? "#060607" : "#f2f2f2"))
    }
}

struct MacKeysDemoApp: App {
    init() {
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    var body: some Scene {
        WindowGroup("MacKeys") { DemoView() }
    }
}

MacKeysDemoApp.main()
