import Foundation
import SwiftUI
import AppKit
import Testing
@testable import MacKeysUI
import MacKeysCore

/// `MacKeyboardDeckView` + `MacKeyCap` must draw the same keyboard as `MacKeyboardView`.
/// Images go to `swift/.build/snapshots/parts/`.
@MainActor
@Suite("Per-key views", .serialized)
struct PartsTests {
    static var outDir: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent(".build/snapshots/parts", isDirectory: true)
    }

    func pixels<V: View>(_ view: V, _ name: String) throws -> (CGImage, [UInt8]) {
        try FileManager.default.createDirectory(at: Self.outDir, withIntermediateDirectories: true)
        let r = ImageRenderer(content: view.background(Color(mk: "#f2f2f2")))
        r.scale = 2
        let img = try #require(r.cgImage, "render \(name)")
        try #require(NSBitmapImageRep(cgImage: img).representation(using: .png, properties: [:])).write(to: Self.outDir.appendingPathComponent(name + ".png"))
        let w = img.width, h = img.height
        var buf = [UInt8](repeating: 0, count: w * h * 4)
        let ctx = CGContext(data: &buf, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
        return (img, buf)
    }

    func composed(_ device: MacDevice, legends: Bool = true, pressed: Set<String> = []) -> some View {
        let layout = MacDeckLayout(device)
        return ZStack(alignment: .topLeading) {
            MacKeyboardDeckView(device: device)
            ForEach(device.keyboard.keys) { k in
                let f = layout.frame(of: k)
                MacKeyCap(key: k, theme: device.theme, pressed: pressed.contains(k.id), legends: legends)
                    .offset(x: f.minX - MacKeyCap.padding, y: f.minY - MacKeyCap.padding)
            }
        }
        .frame(width: layout.size.width, height: layout.size.height, alignment: .topLeading)
    }

    func meanDiff(_ a: [UInt8], _ b: [UInt8]) -> Double {
        var sum = 0.0
        for i in 0..<min(a.count, b.count) where i % 4 != 3 { sum += abs(Double(a[i]) - Double(b[i])) }
        return sum / Double(a.count) * 4 / 3
    }

    @Test(arguments: [(FinishID.proSpaceBlack, LayoutID.enUS), (.airStarlight, .de), (.neoCitrus, .ja), (.imacBlue, .ru)])
    func matchesMacKeyboardView(finish: FinishID, layout: LayoutID) throws {
        let device = macDevice(finish: finish, layout: layout)
        let whole = try pixels(MacKeyboardView(finish: finish, layout: layout, sound: false, captureKeyboard: false), "whole-\(finish.rawValue)-\(layout.rawValue)")
        let parts = try pixels(composed(device), "parts-\(finish.rawValue)-\(layout.rawValue)")
        #expect(whole.0.width == parts.0.width && whole.0.height == parts.0.height)
        let d = meanDiff(whole.1, parts.1)
        print("mean difference \(finish.rawValue) \(layout.rawValue): \(String(format: "%.3f", d)) of 255")
        // The parts do not snap key faces to device pixels as `MacKeyboardView` does, so edges differ by up to 1 px.
        #expect(d < 3.0)
    }

    @Test func legendsOffAndPressedChangeTheDrawing() throws {
        let device = macDevice(finish: .proSpaceBlack, layout: .enUS)
        let normal = try pixels(composed(device), "legends-on")
        let bare = try pixels(composed(device, legends: false), "legends-off")
        let down = try pixels(composed(device, pressed: ["KeyA", "Enter"]), "pressed")
        #expect(meanDiff(normal.1, bare.1) > 0.3)
        #expect(meanDiff(normal.1, down.1) > 0)
    }

    @Test func layoutFramesAreInsideTheDeckAndOutlinesMatchKeys() {
        for layout in [LayoutID.enUS, .de, .ja] {
            let device = macDevice(finish: .airMidnight, layout: layout)
            let l = MacDeckLayout(device)
            for k in device.keyboard.keys {
                #expect(l.deck.contains(l.frame(of: k)), "\(layout.rawValue) \(k.id)")
                #expect(MacKeyCap.outline(of: k).boundingRect.width <= k.w + 0.5)
            }
        }
    }
}
