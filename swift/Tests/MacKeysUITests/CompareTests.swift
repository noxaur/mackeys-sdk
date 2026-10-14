import Foundation
import SwiftUI
import AppKit
import CoreGraphics
import ImageIO
import Testing
@testable import MacKeysUI
import MacKeysCore

/// Renders the 8 configurations of `spec/reference/screens` (made by `scripts/capture-refs.sh`) at 2x device
/// scale on the same page, and writes comparison images to `swift/.build/snapshots/compare/`:
/// `<name>.png` (the Swift render, same size as the reference), `<name>-side.png` (reference left, Swift right),
/// `<name>-diff.png` (absolute difference x4) and `<name>-crop<N>.png` (reference above Swift, native pixels).
@MainActor
@Suite("Reference comparison", .serialized)
final class CompareTests {
    static var root: URL {
        URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    }
    static var outDir: URL { root.appendingPathComponent(".build/snapshots/compare", isDirectory: true) }
    static var refDir: URL { root.deletingLastPathComponent().appendingPathComponent("spec/reference/screens", isDirectory: true) }

    /// Renders `view` at 2x, places its device origin (`swiftOrigin`, px at scale 1) on the reference's device
    /// origin (`refOrigin`), and writes the comparison images. Returns the mean absolute difference (0...255).
    @discardableResult
    func compare<V: View>(_ view: V, _ name: String, page: MKColor, swiftOrigin: CGPoint, refOrigin: CGPoint,
                          crops: [CGRect] = []) throws -> Double {
        try FileManager.default.createDirectory(at: Self.outDir, withIntermediateDirectories: true)
        let refURL = Self.refDir.appendingPathComponent(name + ".png")
        let src = try #require(CGImageSourceCreateWithURL(refURL as CFURL, nil), "reference \(name)")
        let ref = try #require(CGImageSourceCreateImageAtIndex(src, 0, nil))
        let W = ref.width, H = ref.height

        let r = ImageRenderer(content: view.environment(\.displayScale, 2))
        r.scale = 2
        let img = try #require(r.cgImage, "render \(name)")

        let cs = CGColorSpace(name: CGColorSpace.sRGB)!
        func canvas(_ w: Int, _ h: Int) -> CGContext {
            CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: cs,
                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        }
        let pc = (try? parseColor(page)) ?? RGBA(r: 242, g: 242, b: 242, a: 1)
        let ctx = canvas(W, H)
        ctx.setFillColor(CGColor(srgbRed: pc.r / 255, green: pc.g / 255, blue: pc.b / 255, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
        let ox = (refOrigin.x - swiftOrigin.x) * 2, oy = (refOrigin.y - swiftOrigin.y) * 2
        ctx.draw(img, in: CGRect(x: ox, y: CGFloat(H) - oy - CGFloat(img.height), width: CGFloat(img.width), height: CGFloat(img.height)))
        let mine = ctx.makeImage()!
        try write(mine, name)

        // Side by side.
        let side = canvas(2 * W + 20, H)
        side.setFillColor(CGColor(srgbRed: 1, green: 0, blue: 1, alpha: 1))
        side.fill(CGRect(x: 0, y: 0, width: 2 * W + 20, height: H))
        side.draw(ref, in: CGRect(x: 0, y: 0, width: W, height: H))
        side.draw(mine, in: CGRect(x: W + 20, y: 0, width: W, height: H))
        try write(side.makeImage()!, name + "-side")

        // Diff.
        let a = pixels(ref, W, H), b = pixels(mine, W, H)
        var d = [UInt8](repeating: 255, count: W * H * 4)
        var sum = 0.0
        for i in 0..<(W * H) {
            for c in 0..<3 {
                let v = abs(Int(a[i * 4 + c]) - Int(b[i * 4 + c]))
                sum += Double(v)
                d[i * 4 + c] = UInt8(min(255, v * 4))
            }
        }
        let dctx = CGContext(data: &d, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: cs,
                             bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        try write(dctx.makeImage()!, name + "-diff")

        // Crops (css px relative to the reference page), reference above Swift.
        for (i, c) in crops.enumerated() {
            let px = c.applying(CGAffineTransform(scaleX: 2, y: 2)).integral
            let w = Int(px.width), h = Int(px.height)
            let cc = canvas(w, 2 * h + 6)
            cc.setFillColor(CGColor(srgbRed: 1, green: 0, blue: 1, alpha: 1))
            cc.fill(CGRect(x: 0, y: 0, width: w, height: 2 * h + 6))
            if let rc = ref.cropping(to: px) { cc.draw(rc, in: CGRect(x: 0, y: h + 6, width: w, height: h)) }
            if let mc = mine.cropping(to: px) { cc.draw(mc, in: CGRect(x: 0, y: 0, width: w, height: h)) }
            try write(cc.makeImage()!, name + "-crop\(i + 1)")
        }
        let mean = sum / Double(W * H * 3)
        print("compare \(name): mean abs diff \(String(format: "%.2f", mean))")
        lastPixels = (a, b, W, H)
        return mean
    }

    var lastPixels: ([UInt8], [UInt8], Int, Int)?

    /// Compares the ink (legends and icons) of each key in the last comparison: the ink-weighted centroid
    /// offset (Swift minus reference, css px) and the ink mass ratio. `keyOrigin` is the keyboard origin on the page.
    func legendReport(_ name: String, keys: [KeyCap], keyOrigin: CGPoint) {
        guard let (a, b, W, H) = lastPixels else { return }
        func lum(_ p: [UInt8], _ x: Int, _ y: Int) -> Double {
            let i = (y * W + x) * 4
            return 0.299 * Double(p[i]) + 0.587 * Double(p[i + 1]) + 0.114 * Double(p[i + 2])
        }
        func ink(_ p: [UInt8], _ r: CGRect) -> (CGPoint, Double)? {
            let x0 = max(0, Int(r.minX * 2)), x1 = min(W, Int(r.maxX * 2)), y0 = max(0, Int(r.minY * 2)), y1 = min(H, Int(r.maxY * 2))
            guard x1 > x0, y1 > y0 else { return nil }
            var vals: [Double] = []
            for y in y0..<y1 { for x in x0..<x1 { vals.append(lum(p, x, y)) } }
            let med = vals.sorted()[vals.count / 2]
            var m = 0.0, sx = 0.0, sy = 0.0
            for y in y0..<y1 {
                for x in x0..<x1 {
                    let d = abs(lum(p, x, y) - med)
                    guard d > 25 else { continue }
                    m += d; sx += d * Double(x); sy += d * Double(y)
                }
            }
            guard m > 0 else { return nil }
            return (CGPoint(x: sx / m / 2, y: sy / m / 2), m)
        }
        var dxs: [Double] = [], dys: [Double] = [], ratios: [Double] = []
        var worst: (String, Double, Double) = ("", 0, 0)
        for k in keys where !k.legends.isEmpty || k.icon != nil {
            let r = CGRect(x: keyOrigin.x + k.x + 3, y: keyOrigin.y + k.y + 3, width: k.w - 6, height: k.h - 6)
            guard let (ca, ma) = ink(a, r), let (cb, mb) = ink(b, r) else { continue }
            let dx = cb.x - ca.x, dy = cb.y - ca.y
            dxs.append(dx); dys.append(dy); ratios.append(mb / ma)
            if hypot(dx, dy) > hypot(worst.1, worst.2) { worst = (k.id, dx, dy) }
        }
        func avg(_ v: [Double]) -> Double { v.isEmpty ? 0 : v.reduce(0, +) / Double(v.count) }
        print(String(format: "legends \(name): n=%d dx=%.2f dy=%.2f ink=%.2f worst=\(worst.0) (%.2f, %.2f)",
                     dxs.count, avg(dxs), avg(dys), avg(ratios), worst.1, worst.2))
    }

    func pixels(_ img: CGImage, _ w: Int, _ h: Int) -> [UInt8] {
        var p = [UInt8](repeating: 0, count: w * h * 4)
        let ctx = CGContext(data: &p, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
        return p
    }

    func write(_ img: CGImage, _ name: String) throws {
        let rep = NSBitmapImageRep(cgImage: img)
        let data = try #require(rep.representation(using: .png, properties: [:]))
        try data.write(to: Self.outDir.appendingPathComponent(name + ".png"))
    }

    func macBook(_ finish: FinishID, _ layout: LayoutID, _ name: String, crops: [CGRect]) throws {
        let view = MacBookView(finish: finish, layout: layout, sound: false, captureKeyboard: false)
        let tc = topCase(finish: finish, keyboard: buildKeyboard(finish: finish, layout: layout), parts: .full)
        let o = DeviceView.deckOrigin(tc, lid: true)
        let mean = try compare(view, name, page: tc.pageBackground, swiftOrigin: o, refOrigin: CGPoint(x: 16 + 120, y: 16 + 200), crops: crops)
        legendReport(name, keys: buildKeyboard(finish: finish, layout: layout).keys,
                     keyOrigin: CGPoint(x: 136 + tc.keyboard.x, y: 216 + tc.keyboard.y))
        #expect(mean < 40)
    }

    func keyboard(_ finish: FinishID, _ layout: LayoutID, _ bl: BacklightOptions, press: [String] = [], _ name: String, crops: [CGRect]) throws {
        let kc = KeyboardController()
        let kb = buildKeyboard(finish: finish, layout: layout)
        kc.setKeys(kb.keys)
        for p in press { kc.press(p) }
        let view = MacKeyboardView(finish: finish, layout: layout, backlight: bl, sound: false, captureKeyboard: false, controller: kc)
        let tc = topCase(finish: finish, keyboard: kb, parts: .keyboard, backlight: bl)
        let o = DeviceView.deckOrigin(tc, lid: false)
        let mean = try compare(view, name, page: tc.pageBackground, swiftOrigin: o, refOrigin: CGPoint(x: 16, y: 16), crops: crops)
        legendReport(name, keys: kb.keys.filter { !press.contains($0.id) }, keyOrigin: CGPoint(x: 16 + tc.keyboard.x, y: 16 + tc.keyboard.y))
        #expect(mean < 40)
    }

    /// Set `MACKEYS_REF_FONT=Helvetica Neue` to render legends in the font the reference screenshots fell back to
    /// (headless Chrome did not resolve `-apple-system`), to check legend placement glyph for glyph.
    init() {
        CSSText.familyOverride = ProcessInfo.processInfo.environment["MACKEYS_REF_FONT"]
    }

    // Crops in css px of the reference page.
    static let deckCrops = [CGRect(x: 16, y: 16, width: 330, height: 200), CGRect(x: 380, y: 300, width: 300, height: 140)]

    @Test func macbookProSpaceBlackUS() throws {
        try macBook(.proSpaceBlack, .enUS, "macbook-pro-space-black-us",
                    crops: [CGRect(x: 0, y: 30, width: 520, height: 230), CGRect(x: 780, y: 30, width: 520, height: 230),
                            CGRect(x: 136, y: 200, width: 400, height: 220), CGRect(x: 640, y: 700, width: 560, height: 240)])
    }

    @Test func macbookAirStarlightDE() throws {
        try macBook(.airStarlight, .de, "macbook-air-starlight-de",
                    crops: [CGRect(x: 0, y: 30, width: 520, height: 230), CGRect(x: 136, y: 200, width: 400, height: 220)])
    }

    @Test func macbookNeoBlushJA() throws {
        try macBook(.neoBlush, .ja, "macbook-neo-blush-ja",
                    crops: [CGRect(x: 0, y: 30, width: 520, height: 230), CGRect(x: 136, y: 200, width: 400, height: 220)])
    }

    @Test func keyboardProDarkLitPressed() throws {
        try keyboard(.proSpaceBlack, .enUS, BacklightOptions(on: true, level: 16, room: .dark), press: ["KeyA", "ShiftLeft"],
                     "keyboard-pro-space-black-dark-lit-pressed",
                     crops: [CGRect(x: 60, y: 60, width: 330, height: 200), CGRect(x: 60, y: 250, width: 330, height: 140)])
    }

    @Test func keyboardAirMidnightLitKO() throws {
        try keyboard(.airMidnight, .ko, BacklightOptions(on: true, level: 12), "keyboard-air-midnight-lit-ko",
                     crops: [CGRect(x: 60, y: 60, width: 330, height: 200), CGRect(x: 600, y: 250, width: 330, height: 140)])
    }

    @Test func keyboardImacBlueRU() throws {
        try keyboard(.imacBlue, .ru, BacklightOptions(), "keyboard-imac-blue-ru",
                     crops: [CGRect(x: 16, y: 16, width: 330, height: 200), CGRect(x: 600, y: 200, width: 330, height: 140)])
    }

    @Test func keyboardImacGreenFR() throws {
        try keyboard(.imacGreen, .fr, BacklightOptions(), "keyboard-imac-green-fr",
                     crops: [CGRect(x: 16, y: 16, width: 330, height: 200), CGRect(x: 600, y: 200, width: 330, height: 140)])
    }

    @Test func trackpadProSilver() throws {
        let view = MacTrackpadView(finish: .proSilver, sound: false)
        let m = Margins.trackpad
        let mean = try compare(view, "trackpad-pro-silver", page: "#f2f2f2ff", swiftOrigin: CGPoint(x: m.left, y: m.top),
                               refOrigin: CGPoint(x: 16, y: 16), crops: [CGRect(x: 0, y: 0, width: 250, height: 165)])
        #expect(mean < 40)
    }
}
