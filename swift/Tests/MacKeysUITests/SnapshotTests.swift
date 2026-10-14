import Foundation
import SwiftUI
import AppKit
import Testing
@testable import MacKeysUI
import MacKeysCore

/// Renders views to PNG in `swift/.build/snapshots/` for a visual check.
@MainActor
@Suite("Snapshots", .serialized)
struct SnapshotTests {
    static var outDir: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent(".build/snapshots", isDirectory: true)
    }

    func render<V: View>(_ view: V, _ name: String, background: Color) throws -> URL {
        try FileManager.default.createDirectory(at: Self.outDir, withIntermediateDirectories: true)
        let r = ImageRenderer(content: view.background(background))
        r.scale = 1
        let img = try #require(r.cgImage, "render \(name)")
        let rep = NSBitmapImageRep(cgImage: img)
        let data = try #require(rep.representation(using: .png, properties: [:]))
        let url = Self.outDir.appendingPathComponent(name + ".png")
        try data.write(to: url)
        #expect(img.width > 100 && img.height > 100)
        return url
    }

    @Test func macBooks() throws {
        _ = try render(MacBookView(finish: .proSpaceBlack, layout: .enUS, sound: false, captureKeyboard: false, sizing: .scale(1.5)),
                       "macbook-pro-space-black", background: Color(mk: "#f2f2f2"))
        _ = try render(MacBookView(finish: .airStarlight, layout: .de, sound: false, captureKeyboard: false, sizing: .scale(1.5)),
                       "macbook-air-starlight-de", background: Color(mk: "#f2f2f2"))
        _ = try render(MacBookView(finish: .neoCitrus, layout: .ja, sound: false, captureKeyboard: false, sizing: .scale(1.5)),
                       "macbook-neo-citrus-ja", background: Color(mk: "#f2f2f2"))
        let lit = BacklightOptions(on: true, level: 16, room: .dark, bleed: 1, color: "#fff4e3")
        _ = try render(MacBookView(finish: .proSpaceBlack, layout: .enUS, backlight: lit, sound: false, captureKeyboard: false, sizing: .scale(1.5)),
                       "macbook-pro-space-black-dark-lit", background: Color(mk: "#060607"))
    }

    @Test func keyboardAndTrackpad() throws {
        _ = try render(MacKeyboardView(finish: .imacBlue, layout: .ru, sound: false, captureKeyboard: false, sizing: .scale(1.5)),
                       "keyboard-imac-blue-ru", background: Color(mk: "#f2f2f2"))
        _ = try render(MacKeyboardView(finish: .airMidnight, layout: .ko, sound: false, captureKeyboard: false, sizing: .scale(1.5)),
                       "keyboard-air-midnight-ko", background: Color(mk: "#f2f2f2"))
        _ = try render(MacTrackpadView(finish: .proSilver, sound: false, sizing: .scale(1.5)),
                       "trackpad-pro-silver", background: Color(mk: "#f2f2f2"))
    }

    @Test func pressedKeyAndForceTrackpad() throws {
        let kc = KeyboardController()
        let tc = TrackpadController()
        let view = MacBookView(finish: .proSilver, layout: .enGB, sound: false, captureKeyboard: false, sizing: .scale(1.5),
                               controller: kc, trackpadController: tc)
        kc.setKeys(buildKeyboard(finish: .proSilver, layout: .enGB).keys)
        kc.press("KeyA")
        kc.press("CapsLock")
        kc.press("Enter")
        tc.press(timedForce: false)
        tc.force()
        _ = try render(view, "macbook-pro-silver-gb-pressed", background: Color(mk: "#f2f2f2"))
        #expect(kc.caps)
    }

    @Test func svgPathConversion() {
        let p = svgPath("M0 0H10V10H0Z")
        #expect(p.boundingRect == CGRect(x: 0, y: 0, width: 10, height: 10))
        let ring = svgPath("M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0")
        #expect(abs(ring.boundingRect.width - 18) < 0.01 && abs(ring.boundingRect.height - 18) < 0.01)
        #expect(svgPath("garbage").isEmpty)
    }

    @Test func colorConversion() {
        let c = NSColor(Color(mk: "#ff800080")).usingColorSpace(.sRGB)!
        #expect(abs(c.redComponent - 1) < 0.01 && abs(c.greenComponent - 128.0 / 255) < 0.01 && abs(c.alphaComponent - 128.0 / 255) < 0.01)
    }

    @Test func soundNeverCrashes() {
        let s = ClickSound()
        s.key(.key, up: false)
        s.key(.space, up: false)
        s.key(.wide, up: true)
        s.trackpad(.press)
        s.trackpad(.force)
        s.trackpad(.release)
        s.close()
    }
}
