import SwiftUI
import MacKeysCore

/// One key cap, without input handling, for apps that compose their own keyboard (key hints, tutorials,
/// custom press states). The view's frame is the key plus `MacKeyCap.padding` on each side, for the shadows
/// and the backlight glow. It does not take pointer or keyboard events.
public struct MacKeyCap: View {
    /// Space around the key inside the view, in px at scale 1.
    public static let padding: CGFloat = keyPad

    let key: KeyCap
    let theme: KeyboardTheme
    let scale: CGFloat
    let pressed: Bool
    let caps: Bool
    let legends: Bool

    /// - Parameters:
    ///   - pressed: draws the pressed look, animated as on `MacKeyboardView`.
    ///   - caps: lights the caps lock LED of the caps lock key.
    ///   - legends: false leaves out the legends, icon, caps lock LED and home bar, and keeps the cap, its shadows and Touch ID.
    public init(key: KeyCap, theme: KeyboardTheme, scale: CGFloat = 1, pressed: Bool = false, caps: Bool = false, legends: Bool = true) {
        self.key = key; self.theme = theme; self.scale = scale; self.pressed = pressed; self.caps = caps; self.legends = legends
    }

    public var body: some View {
        KeyCapCanvas(key: key, theme: theme, press: pressed ? 1 : 0, caps: caps, scale: scale, art: KeyArt(key), legends: legends)
            .animation(.timingCurve(0.2, 0.75, 0.3, 1, duration: pressed ? 0.026 : 0.095), value: pressed)
            .allowsHitTesting(false)
    }

    /// The outline of a key in its own coordinates (origin at the key's top-left, px at scale 1): the L of an
    /// ISO or JIS return key, a rounded rectangle for every other key.
    public static func outline(of key: KeyCap) -> Path {
        if let iso = key.iso { return svgPath(iso.path) }
        return Path(roundedRect: CGRect(x: 0, y: 0, width: key.w, height: key.h), cornerRadius: key.radius, style: .circular)
    }
}

/// Where the parts of a keyboard deck sit in a `MacKeyboardDeckView`, in px at scale 1.
public struct MacDeckLayout: Sendable, Equatable {
    /// The whole view, with room for the deck's shadows.
    public let size: CGSize
    /// The aluminium deck inside it.
    public let deck: CGRect
    let keyboardOrigin: CGPoint

    public init(_ device: MacDevice) {
        let tc = device.topCase, m = Margins.device
        size = DeviceView.natural(tc)
        deck = CGRect(x: m.left, y: m.top, width: tc.width, height: tc.height)
        keyboardOrigin = CGPoint(x: m.left + tc.keyboard.x, y: m.top + tc.keyboard.y)
    }

    /// The key's face in the view.
    public func frame(of key: KeyCap) -> CGRect {
        CGRect(x: keyboardOrigin.x + key.x, y: keyboardOrigin.y + key.y, width: key.w, height: key.h)
    }
}

/// The deck, its keyboard well and the speaker grilles of a device, without keys. Lay `MacKeyCap` views over it
/// at `MacDeckLayout.frame(of:)`, each offset by `MacKeyCap.padding` outwards.
public struct MacKeyboardDeckView: View {
    let device: MacDevice
    let scale: CGFloat

    public init(device: MacDevice, scale: CGFloat = 1) {
        self.device = device; self.scale = scale
    }

    public var body: some View {
        let tc = device.topCase, s = scale, layout = MacDeckLayout(device)
        ZStack(alignment: .topLeading) {
            Canvas { ctx, _ in
                ctx.scaleBy(x: s, y: s)
                ctx.translateBy(x: layout.deck.minX, y: layout.deck.minY)
                TopCaseDrawing.drawBack(&ctx, tc)
                TopCaseDrawing.drawFront(&ctx, tc)
            }
        }
        .frame(width: layout.size.width * s, height: layout.size.height * s, alignment: .topLeading)
        .allowsHitTesting(false)
    }
}
