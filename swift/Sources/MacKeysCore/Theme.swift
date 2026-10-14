import Foundation

// Colors and lighting for key caps, the keyboard well and the top case, including the backlight model.
// A 1:1 port of `packages/core/src/theme.ts`.

public enum Room: String, Codable, Sendable, CaseIterable { case daylight, dark }

public struct BacklightOptions: Codable, Sendable, Equatable, Hashable {
    /// The backlight switch. Only MacBook Pro and Air have a backlight. Default false.
    public var on: Bool?
    /// Brightness in sixteenths, 0 to 16, as macOS steps it. Default 12.
    public var level: Double?
    /// The room: daylight lowers the eye's exposure, so the same light reads weaker. Default daylight.
    public var room: Room?
    /// How much light spills out around each cap, 0 to 1. Default 0.5.
    public var bleed: Double?
    /// Light color. Default `#f2f5ff`.
    public var color: String?
    /// True while the idle timer has switched the light off.
    public var idle: Bool?

    public init(on: Bool? = nil, level: Double? = nil, room: Room? = nil, bleed: Double? = nil, color: String? = nil, idle: Bool? = nil) {
        self.on = on; self.level = level; self.room = room; self.bleed = bleed; self.color = color; self.idle = idle
    }
}

public struct TextGlow: Codable, Sendable, Equatable, Hashable {
    public var blur: Double
    public var color: MKColor
    public init(blur: Double, color: MKColor) { self.blur = blur; self.color = color }
}

public enum TouchIdStyle: String, Codable, Sendable { case dark, light, flush }

public struct KeyboardTheme: Codable, Sendable, Equatable {
    /// Key cap face: a radial gradient (125% x 110% at bottom center) from `face1` at the center to `face0` at the edge.
    public var face0: MKColor
    public var face1: MKColor
    /// 1 px inner outline of every cap.
    public var outline: MKColor
    /// 1.8 px inner highlight along the top edge of every cap.
    public var highlight: MKColor
    /// Outer shadows of every cap (drop shadow, and backlight bleed when lit).
    public var capShadows: [Shadow]
    public var legend: MKColor
    /// Glow around legend text when the backlight is on.
    public var legendGlow: [TextGlow]
    /// Glow around icon legends when the backlight is on.
    public var iconGlow: [TextGlow]
    /// Brightness factor for a pressed key (1 = unchanged).
    public var pressedBrightness: Double
    public var capsLedOff: MKColor
    public var capsLedOn: MKColor
    public var capsLedGlow: [TextGlow]
    public var homeBar: MKColor
    public var touchId: TouchIdStyle
    /// Brightness factor for the Touch ID button (dimmed in a dark room).
    public var touchIdBrightness: Double
    /// Lit backlight level after the room's exposure, 0 to 1.
    public var glow: Double
}

let DEFAULT_GLOW = "#f2f5ff"

func lightRgb(_ c: String?) -> [Double] {
    let hx = c ?? DEFAULT_GLOW
    if let p = try? parseColor(hx), !p.r.isNaN, !p.g.isNaN, !p.b.isNaN { return [p.r, p.g, p.b] }
    var h = hx.replacingOccurrences(of: "#", with: "")
    while h.count < 6 { h += "f" }
    let a = Array(h.prefix(6))
    return [0, 2, 4].map { i in Double(Int(String(a[i..<i + 2]), radix: 16) ?? 0) }
}

func clamp01(_ v: Double?, _ d: Double) -> Double {
    let x = (v.map { $0.isFinite ? $0 : d }) ?? d
    return max(0, min(1, x))
}

/// Backlight level after the room's exposure, 0 to 1. Zero on models with no backlight.
public func backlightGlow(_ finish: String, _ bl: BacklightOptions = BacklightOptions()) -> Double {
    let f = getFinish(finish)
    let backlit = f.model == .pro || f.model == .air
    let on = backlit && (bl.on ?? false) && !(bl.idle ?? false)
    let raw = (bl.level.map { $0.isFinite ? $0 : 12 }) ?? 12
    let step = max(0, min(16, jsRound(raw)))
    let g = on ? step / 16 : 0
    let E = bl.room == .dark ? 1 : 0.42
    return g * E
}

private func addLightFn(_ LC: [Double]) -> ([Double], Double) -> MKColor {
    { base, k in
        let v = (0..<3).map { i in min(255, jsRound(base[i] + LC[i] * k)) }
        return rgba(v[0], v[1], v[2])
    }
}

func darken(_ hex: String, _ k: Double) -> MKColor {
    let p = (try? parseColor(hex)) ?? RGBA(r: 0, g: 0, b: 0)
    return rgba(jsRound(p.r * k), jsRound(p.g * k), jsRound(p.b * k), 1)
}

public func keyboardTheme(finish: FinishID, backlight: BacklightOptions = BacklightOptions()) -> KeyboardTheme {
    keyboardTheme(finish: finish.rawValue, backlight: backlight)
}

public func keyboardTheme(finish: String, backlight bl: BacklightOptions = BacklightOptions()) -> KeyboardTheme {
    let f = getFinish(finish)
    let lightKeys = f.model == .neo || f.model == .mk
    let backlit = !lightKeys
    let dark = bl.room == .dark
    let e = backlightGlow(finish, bl)
    let bleed = clamp01(bl.bleed, 0.5)
    let LC = lightRgb(bl.color)
    func glowA(_ a: Double) -> MKColor { rgba(LC[0], LC[1], LC[2], max(0, a)) }
    let addLight = addLightFn(LC)

    var t: KeyboardTheme
    if lightKeys {
        t = KeyboardTheme(
            face0: color(f.kf!), face1: darken(f.kf!, 0.965),
            outline: color("rgba(0,0,0,.8)"), highlight: color("rgba(255,255,255,.5)"),
            capShadows: [shadow(0, 1, 1.5, 0, "rgba(0,0,0,.14)")],
            legend: color(f.kl!), legendGlow: [], iconGlow: [], pressedBrightness: 0.93,
            capsLedOff: color("rgba(0,0,0,.36)"), capsLedOn: color("#3ddc5c"), capsLedGlow: [],
            homeBar: color(f.kl!), touchId: f.model == .neo ? .flush : .light, touchIdBrightness: 1, glow: 0)
    } else {
        t = KeyboardTheme(
            face0: color("#1c1c1e"), face1: color("#2e2e30"),
            outline: color("#050506"), highlight: color("rgba(255,255,255,.15)"),
            capShadows: [shadow(0, 1, 1.5, 0, "rgba(0,0,0,.5)")],
            legend: color("#dcdcdf"), legendGlow: [], iconGlow: [], pressedBrightness: 0.84,
            capsLedOff: color("#8e8e93"), capsLedOn: color("#3ddc5c"), capsLedGlow: [],
            homeBar: color("rgba(222,222,226,.55)"), touchId: .dark, touchIdBrightness: 1, glow: e)
    }
    t.capsLedGlow = [
        TextGlow(blur: 2, color: color("rgba(61,220,92,.9)")),
        TextGlow(blur: 6, color: color("rgba(61,220,92,.45)"))
    ]
    if backlit && dark {
        t.face0 = color("#0b0b0c")
        t.face1 = color("#141416")
        t.highlight = color("rgba(255,255,255,.03)")
        t.capsLedOff = color("#2c2c2e")
        t.homeBar = color("rgba(60,60,64,.6)")
        t.touchIdBrightness = 0.32
    }
    if backlit && e > 0 {
        t.legend = addLight(dark ? [40, 40, 43] : [220, 220, 223], pow(e, 0.6))
        t.legendGlow = [
            TextGlow(blur: 0.6, color: glowA(0.9 * e)),
            TextGlow(blur: 2, color: glowA(0.55 * e)),
            TextGlow(blur: 5, color: glowA(0.25 * e))
        ]
        t.iconGlow = [
            TextGlow(blur: 0.6, color: glowA(0.85 * e)),
            TextGlow(blur: 2.5, color: glowA(0.4 * e))
        ]
        t.capShadows = [
            shadow(0, 0, 1 + 1.5 * bleed, 0, glowA(0.95 * e * bleed)),
            shadow(0, 0, 3 + 5 * bleed, 0, glowA(0.45 * e * bleed)),
            shadow(0, 1, 1.5, 0, "rgba(0,0,0,.6)")
        ]
        t.face1 = addLight(dark ? [20, 20, 22] : [46, 46, 48], 0.05 * e * bleed)
    }
    return t
}

// ---- Top case -----------------------------------------------------------------------------------

public enum Parts: String, Codable, Sendable { case full, keyboard }

public struct WellGeometry: Codable, Sendable, Equatable {
    public var x: Double
    public var y: Double
    public var w: Double
    public var h: Double
    public var radius: Double
    public var pad: Double
    public var fill: MKColor
    public var shadows: [Shadow]
}

public struct Point: Codable, Sendable, Equatable {
    public var x: Double
    public var y: Double
}

public struct Grille: Codable, Sendable, Equatable {
    public var x: Double
    public var y: Double
    public var w: Double
    public var h: Double
    public var dot: MKColor
    public var pitch: Double
    public var dotRadius: Double
}

public struct TrackpadRect: Codable, Sendable, Equatable {
    public var x: Double
    public var y: Double
    public var w: Double
    public var h: Double
    public var radius: Double
}

public struct Hinge: Codable, Sendable, Equatable {
    public var x: Double
    public var w: Double
    public var h: Double
    public var barrelW: Double
    public var barrel: Gradient
}

public struct Notch: Codable, Sendable, Equatable {
    public var x: Double
    public var y: Double
    public var w: Double
    public var h: Double
    public var fill: Gradient
    public var scoopOpacity: Double
}

public struct TopCaseGeometry: Codable, Sendable, Equatable {
    public var model: ModelID
    public var full: Bool
    public var width: Double
    public var height: Double
    /// Corner radii: top-left, top-right, bottom-right, bottom-left.
    public var radius: [Double]
    public var deck: Gradient
    public var deckShadows: [Shadow]
    /// The base under the deck, offset 10 px down: the visible side wall.
    public var side: Gradient
    public var sideShadows: [Shadow]
    /// Opacity of the aluminium grain overlay.
    public var grain: Double
    /// Black overlay on the deck in a dark room.
    public var dim: Double
    public var well: WellGeometry
    /// Origin of the keyboard inside the top case.
    public var keyboard: Point
    public var grilles: [Grille]
    public var trackpad: TrackpadRect?
    public var hinge: Hinge?
    /// The finger notch at the front edge.
    public var notch: Notch?
    /// Page background behind the device, as on the canvas.
    public var pageBackground: MKColor
}

public func topCase(finish: FinishID, keyboard kb: KeyboardGeometry, parts: Parts = .keyboard, backlight: BacklightOptions = BacklightOptions()) -> TopCaseGeometry {
    topCase(finish: finish.rawValue, keyboard: kb, parts: parts, backlight: backlight)
}

public func topCase(finish: String, keyboard kb: KeyboardGeometry, parts: Parts = .keyboard, backlight bl: BacklightOptions = BacklightOptions()) -> TopCaseGeometry {
    let f = getFinish(finish)
    let M = MacKeysData.shared.model(f.model)
    let full = parts == .full && f.model != .mk
    let backlit = f.model == .pro || f.model == .air
    let dark = bl.room == .dark
    let e = backlightGlow(finish, bl)
    let bleed = clamp01(bl.bleed, 0.5)
    let LC = lightRgb(bl.color)
    let wellGlow = backlit && e > 0 ? 0.07 * e * bleed : 0
    let isPro = f.model == .pro
    let pad = M.wellPad
    let W = M.W
    let kbX = (W - kb.width) / 2
    let wellH = kb.height + 2 * pad
    let H = full || f.model == .mk ? M.H : M.kbY * 2 + kb.height
    let r = full || f.model == .mk ? M.radius : [22, 22, 22, 22]
    let addLight = addLightFn(LC)
    let edge = f.edge
    let wellFill: MKColor = isPro
        ? addLight(dark ? [6, 6, 7] : [18, 20, 22], wellGlow)
        : (f.model == .air && wellGlow > 0 ? rgba(LC[0], LC[1], LC[2], wellGlow) : color("transparent"))
    let wellShadows: [Shadow]
    if f.model == .mk {
        wellShadows = []
    } else if isPro {
        wellShadows = [shadow(0, 0, 0, 1, "#000", true), shadow(0, 1, 3, 0, "rgba(0,0,0,.8)", true), shadow(0, 0, 0, 1, edge)]
    } else {
        wellShadows = [
            shadow(0, 1.5, 2.5, 0, f.dark ? "rgba(0,0,0,.45)" : "rgba(0,0,0,.16)", true),
            shadow(0, 0, 0, 1, f.dark ? "rgba(0,0,0,.28)" : "rgba(0,0,0,.07)", true),
            shadow(0, -1, 0, 0, edge, true),
            shadow(0, 1, 0, 0, edge),
            shadow(0, -1, 0, 0, f.dark ? "rgba(0,0,0,.18)" : "rgba(0,0,0,.05)")
        ]
    }
    let lid = f.lid
    return TopCaseGeometry(
        model: f.model, full: full, width: W, height: H, radius: r,
        deck: grad2(f.deck),
        deckShadows: [shadow(0, 0, 0, 1, edge, true), shadow(0, -1, 1, 0, f.dark ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.06)", true)],
        side: grad2(f.side),
        sideShadows: [shadow(0, 1, 1, 0, "rgba(0,0,0,.22)"), shadow(0, 12, 24, 0, "rgba(0,0,0,.10)"), shadow(0, 40, 70, -26, "rgba(0,0,0,.40)")],
        grain: isPro && f.dark ? 0.25 : 0.14,
        dim: backlit && dark ? 0.8 : 0,
        well: WellGeometry(x: kbX - pad, y: M.kbY - pad, w: kb.width + 2 * pad, h: wellH, radius: 12, pad: pad, fill: wellFill, shadows: wellShadows),
        keyboard: Point(x: kbX, y: M.kbY),
        grilles: M.grille ? [
            Grille(x: 5, y: M.kbY + 7, w: 45, h: wellH - 28, dot: color(f.dot), pitch: 3.3, dotRadius: 0.75),
            Grille(x: W - 5 - 45, y: M.kbY + 7, w: 45, h: wellH - 28, dot: color(f.dot), pitch: 3.3, dotRadius: 0.75)
        ] : [],
        trackpad: full ? TrackpadRect(x: (W - M.padW) / 2, y: M.padY, w: M.padW, h: M.padH, radius: 9) : nil,
        hinge: full ? Hinge(x: M.hingeX, w: W - 2 * M.hingeX, h: 14, barrelW: 52,
                            barrel: Gradient(stops: [GradientStop(color: color(lid[1]), at: 0), GradientStop(color: color(lid[2]), at: 0.7),
                                                     GradientStop(color: color(f.dark ? "#141315" : f.side[1]), at: 1)])) : nil,
        notch: full ? Notch(x: W / 2 - 88, y: H, w: 176, h: 10,
                            fill: Gradient(stops: [GradientStop(color: color(lid[2]), at: 0), GradientStop(color: color(lid[1]), at: 0.6), GradientStop(color: color(lid[0]), at: 1)]),
                            scoopOpacity: f.dark ? 0.35 : 0.1) : nil,
        pageBackground: color(backlit && dark ? "#060607" : "#f2f2f2"))
}

// ---- Trackpad -----------------------------------------------------------------------------------

public struct TrackpadGeometry: Codable, Sendable, Equatable {
    public var width: Double
    public var height: Double
    public var radius: Double
    public var surface: Gradient
    public var side: Gradient
    /// Depth of the visible side under the glass.
    public var sideDepth: Double
    public var shadows: [Shadow]
    public var sideShadows: [Shadow]
    public var grain: Double
    public var label: String
}

public func trackpad(finish: FinishID) -> TrackpadGeometry { trackpad(finish: finish.rawValue) }

/// The standalone Force Touch trackpad of a MacBook finish (Magic Keyboard finishes fall back to Space Black).
public func trackpad(finish: String) -> TrackpadGeometry {
    var f = getFinish(finish)
    if f.model == .mk { f = getFinish("pro-space-black") }
    let w = f.model == .neo ? 390.5 : f.model == .pro ? 437 : 432.5
    let h = f.model == .neo ? 243.5 : f.model == .pro ? 272.7 : 270.1
    return TrackpadGeometry(
        width: w, height: h, radius: 10,
        surface: grad2(f.pad), side: grad2(f.side), sideDepth: 6,
        shadows: trackpadShadows(finish: f.id.rawValue),
        sideShadows: [shadow(0, 1, 1, 0, "rgba(0,0,0,.2)"), shadow(0, 10, 20, 0, "rgba(0,0,0,.10)"), shadow(0, 30, 50, -18, "rgba(0,0,0,.38)")],
        grain: f.model == .pro && f.dark ? 0.25 : 0.14,
        label: f.name + " Force Touch trackpad. Click, or press and hold for a force click.")
}

/// Shadows of the built-in trackpad inside a MacBook top case (same as the standalone one).
public func trackpadShadows(finish: String) -> [Shadow] {
    let f = getFinish(finish)
    return [shadow(0, 0, 0, 1, f.edge), shadow(0, 0, 0, 1, f.dark ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.13)", true), shadow(0, 2, 0, 0, f.edge, true)]
}

// ---- Device -------------------------------------------------------------------------------------

/// Everything a renderer needs to draw one device: key geometry, key theme and top case.
public struct MacDevice: Codable, Sendable, Equatable {
    public var keyboard: KeyboardGeometry
    public var theme: KeyboardTheme
    public var topCase: TopCaseGeometry
}

public func macDevice(finish: FinishID = .proSpaceBlack, layout: LayoutID = .enUS, custom: CustomLayout? = nil,
                      parts: Parts = .keyboard, backlight: BacklightOptions = BacklightOptions()) -> MacDevice {
    macDevice(finish: finish.rawValue, layout: layout.rawValue, custom: custom, parts: parts, backlight: backlight)
}

public func macDevice(finish: String, layout: String, custom: CustomLayout? = nil,
                      parts: Parts = .keyboard, backlight: BacklightOptions = BacklightOptions()) -> MacDevice {
    let kb = buildKeyboard(finish: finish, layout: layout, custom: custom)
    return MacDevice(keyboard: kb,
                     theme: keyboardTheme(finish: kb.finish.rawValue, backlight: backlight),
                     topCase: topCase(finish: kb.finish.rawValue, keyboard: kb, parts: parts, backlight: backlight))
}
