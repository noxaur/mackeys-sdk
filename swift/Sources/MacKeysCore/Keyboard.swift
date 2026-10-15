import Foundation

// The keyboard layout engine, a 1:1 port of `packages/core/src/keyboard.ts`. It turns a finish and a
// layout into key caps with absolute geometry: every legend, icon, LED and home bar has a resolved
// position, so a renderer only draws.

/// Key pitch across (19.0 mm) in px.
public let UNIT: Double = 64
/// Row pitch (18.5 mm) in px.
public let ROW_PITCH: Double = 62.3

/// `mb` = MacBook Pro and Air legend metrics, `mk` = MacBook Neo and Magic Keyboard.
public enum LegendStyle: String, Codable, Sendable { case mb, mk }

public enum KeyKind: String, Codable, Sendable {
    case char, dual, quad, jis, word, icon, mod, fn, fkey, touchid, space, arrow, kana
}

/// The click recording a key plays. The classes come from the Norwegian (ISO) MacBook keyboard, where each
/// one was recorded: `key` (letters, F keys, fn, control, option), `mod` (command and left shift, 1.25u),
/// `tab` (tab, escape and delete, 1.25u to 1.5u), `caps` (caps lock), `wide` (right shift, 2.25u),
/// `enter` (return), `space`, `arrow` (half-height arrows) and `power` (Touch ID).
public enum KeySound: String, Codable, Sendable, CaseIterable { case key, mod, tab, caps, wide, enter, space, arrow, power }

/// Picks the recording for a key on any layout. Keys with a role on the Norwegian keyboard keep it
/// (return, caps lock, tab, escape, space, Touch ID, half-height arrows). Every other key goes by its
/// width in key units: 1.75u and up `wide`, 1.4u and up `tab`, 1.15u and up `mod`, else `key`.
public func keySound(id: String, kind: KeyKind, units: Double, halfHeight: Bool) -> KeySound {
    if kind == .touchid { return .power }
    if kind == .space { return .space }
    if kind == .arrow && halfHeight { return .arrow }
    if id == "Enter" { return .enter }
    if id == "CapsLock" { return .caps }
    if id == "Tab" || id == "Escape" { return .tab }
    if units >= 1.75 { return .wide }
    if units >= 1.4 { return .tab }
    if units >= 1.15 { return .mod }
    return .key
}

public struct Legend: Codable, Sendable, Equatable {
    public enum Align: String, Codable, Sendable { case left, center, right }
    /// Which slot the legend came from: t = top, b = bottom, c = bottom right, d = top right.
    public enum Slot: String, Codable, Sendable { case t, b, c, d }
    public var text: String
    /// Font size in px. The line box is one font size high (line-height 1).
    public var size: Double
    /// Letter spacing in em.
    public var tracking: Double
    public var align: Align
    public var inset: Double
    /// Top of the line box, from the top of the key.
    public var top: Double
    public var slot: Slot
}

public struct KeyIcon: Codable, Sendable, Equatable {
    public var x: Double
    public var y: Double
    public var w: Double
    public var h: Double
    /// The glyph's viewBox, mapped into the rect with uniform scale ("meet").
    public var viewBox: [Double]
    public var stroke: String
    public var fill: String
    /// Stroke width in viewBox units.
    public var strokeWidth: Double
}

/// The outline of an L-shaped ISO or JIS return key, in key coordinates.
public struct IsoShape: Codable, Sendable, Equatable {
    public var path: String
    /// The top highlight line.
    public var highlight: String
}

public struct CapsLed: Codable, Sendable, Equatable {
    public var x: Double
    public var y: Double
    public var d: Double
}

public struct TouchIdSpec: Codable, Sendable, Equatable {
    public var d: Double
}

public struct KeyCap: Codable, Sendable, Equatable, Identifiable {
    /// `KeyboardEvent.code` for the key, or `Fn` and `TouchID`.
    public var id: String
    /// Accessible name.
    public var label: String
    public var kind: KeyKind
    public var row: Int
    public var x: Double
    public var y: Double
    public var w: Double
    public var h: Double
    public var radius: Double
    public var sound: KeySound
    public var legends: [Legend]
    public var icon: KeyIcon?
    public var iso: IsoShape?
    public var homeBar: Rect?
    /// The caps lock LED: top-left corner and diameter.
    public var capsLed: CapsLed?
    public var touchId: TouchIdSpec?

    enum CodingKeys: String, CodingKey {
        case id, label, kind, row, x, y, w, h, radius, sound, legends, icon, iso, homeBar, capsLed, touchId
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(label, forKey: .label)
        try c.encode(kind, forKey: .kind)
        try c.encode(row, forKey: .row)
        try c.encode(x, forKey: .x)
        try c.encode(y, forKey: .y)
        try c.encode(w, forKey: .w)
        try c.encode(h, forKey: .h)
        try c.encode(radius, forKey: .radius)
        try c.encode(sound, forKey: .sound)
        try c.encode(legends, forKey: .legends)
        try c.encode(icon, forKey: .icon)
        try c.encode(iso, forKey: .iso)
        try c.encode(homeBar, forKey: .homeBar)
        try c.encode(capsLed, forKey: .capsLed)
        try c.encode(touchId, forKey: .touchId)
    }
}

public struct KeyboardGeometry: Codable, Sendable, Equatable {
    public var finish: FinishID
    public var layout: LayoutID
    public var model: ModelID
    public var style: LegendStyle
    /// Light key caps with dark legends (MacBook Neo, Magic Keyboard).
    public var lightKeys: Bool
    /// MacBook Pro and Air have a backlight; Neo and Magic Keyboard have none.
    public var backlit: Bool
    public var width: Double
    public var height: Double
    public var gap: Double
    public var capHeight: Double
    public var keys: [KeyCap]

    public func key(_ id: String) -> KeyCap? { keys.first { $0.id == id } }
}

struct Metrics {
    var ws, wb, dt, db, fb, cx, cy, fnr, symTop, symSide, side, icB, fIcon: Double
    var globeLeft, globeBottom: Double
}

struct StyleSpec {
    enum Fn { case top, pair, globe }
    var mb: Bool
    var words: Bool
    var inner: Bool
    var fn: Fn
    var lrFull: Bool
}

// Legend style per model, from Apple's images.
func styleSpec(_ m: ModelID) -> StyleSpec {
    switch m {
    case .pro: return StyleSpec(mb: true, words: true, inner: true, fn: .top, lrFull: false)
    case .air: return StyleSpec(mb: true, words: true, inner: false, fn: .pair, lrFull: false)
    case .neo: return StyleSpec(mb: false, words: false, inner: false, fn: .pair, lrFull: false)
    case .mk: return StyleSpec(mb: false, words: false, inner: false, fn: .globe, lrFull: true)
    }
}

func metrics(_ model: ModelID) -> Metrics {
    let st = styleSpec(model)
    if st.mb {
        let top = st.fn == .top
        return Metrics(ws: 9.6, wb: 7.15, dt: 8.1, db: 7.9, fb: 8.6, cx: 10.8, cy: 11.1, fnr: 9.3, symTop: 8.7, symSide: 9.3, side: 9.6, icB: 9.0, fIcon: 19.6,
                       globeLeft: top ? 10.6 : 9.6, globeBottom: top ? 8.6 : 8.4)
    }
    if model == .mk {
        return Metrics(ws: 10.1, wb: 7.9, dt: 9.7, db: 6.7, fb: 8.8, cx: 10, cy: 10.6, fnr: 9.6, symTop: 10.3, symSide: 10, side: 9.8, icB: 9.2, fIcon: 19.3,
                       globeLeft: 11, globeBottom: 10.5)
    }
    return Metrics(ws: 10.9, wb: 8, dt: 9.8, db: 7.8, fb: 8.5, cx: 11, cy: 11, fnr: 9.7, symTop: 10.3, symSide: 11, side: 11, icB: 9.6, fIcon: 20.6,
                   globeLeft: 11, globeBottom: 9.6)
}

/// Splits a string into Unicode code points (JavaScript `Array.from` semantics).
public func codePoints(_ s: String) -> [String] {
    s.unicodeScalars.map { String($0) }
}

/// True when the string holds any letter (`\p{L}`).
func hasLetter(_ s: String) -> Bool {
    s.unicodeScalars.contains { sc in
        switch sc.properties.generalCategory {
        case .uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter: return true
        default: return false
        }
    }
}

typealias IconRecipe = (Double, Double) -> KeyIcon

/// One key before placement: legends by slot, CSS-like class tags and an optional icon recipe.
public struct KeyProto {
    var u: Double?
    var tags: [String]
    var kind: KeyKind
    var t: String = ""
    var b: String = ""
    var c: String = ""
    var d: String = ""
    var label: String
    var code: String = ""
    var home: Bool = false
    var touchId: Bool = false
    var icon: IconRecipe?

    /// Public view of the parse result (for tests).
    public var slots: (t: String, b: String, c: String, d: String) { (t, b, c, d) }
    public var protoTags: [String] { tags }
    public var protoKind: KeyKind { kind }
    public var protoLabel: String { label }
    public var isHome: Bool { home }
}

func iconFrom(_ g: Glyph, _ x: Double, _ y: Double, _ w: Double? = nil, _ h: Double? = nil) -> KeyIcon {
    KeyIcon(x: x, y: y, w: w ?? g.w, h: h ?? g.h, viewBox: g.viewBox, stroke: g.stroke, fill: g.fill, strokeWidth: g.strokeWidth)
}

/// Parses one legend token. See `LayoutSpec` for the syntax.
public func parseToken(_ s: String) -> KeyProto {
    let cs = codePoints(s)
    if let sep = cs.firstIndex(of: "¦"), sep > 0 {
        let lc = cs[..<sep].map { $0 == "·" ? "" : $0 }
        let rc = cs[(sep + 1)...].map { $0 == "·" ? "" : $0 }
        let tl = lc.first ?? ""
        let bl = lc.count > 1 ? lc[1] : ""
        let tr = rc.count > 1 ? rc[0] : ""
        let br = rc.count > 1 ? rc[1] : (rc.first ?? "")
        let big = hasLetter(tl + bl + tr + br)
        let lat = [tl, bl, tr, br].first { ch in
            ch.unicodeScalars.count == 1 && ch.unicodeScalars.first!.value >= 65 && ch.unicodeScalars.first!.value <= 90
        } ?? ""
        return KeyProto(tags: big ? ["quad", "qbig"] : ["quad"], kind: .quad, t: tl, b: bl, c: br, d: tr,
                        label: [tl, bl, tr, br].filter { !$0.isEmpty }.joined(separator: " "), home: lat == "F" || lat == "J")
    }
    if cs.count == 1 || (cs.count > 1 && cs[1] == "|") {
        let first = cs.first ?? ""
        return KeyProto(tags: ["char"], kind: .char, t: first, c: cs.dropFirst(2).joined(),
                        label: first.isEmpty ? "blank" : first, home: s == "F" || s == "J")
    }
    let t0 = cs.first ?? ""
    let b0 = cs.count > 1 ? cs[1] : ""
    let brk = !t0.isEmpty && "{}|".contains(t0)
    return KeyProto(tags: brk ? ["dual", "brk"] : ["dual"], kind: .dual, t: t0, b: b0, c: cs.dropFirst(2).joined(),
                    label: (cs.count > 1 ? b0 : "undefined") + " " + (cs.isEmpty ? "undefined" : t0))
}

func fitRow(_ str: String, _ n: Int) -> String {
    var a = str.split(whereSeparator: { $0.isWhitespace }).map(String.init).filter { !$0.isEmpty }
    while a.count < n { a.append("·") }
    return a.prefix(n).joined(separator: " ")
}

struct ResolvedLayout {
    var spec: LayoutSpec
    var custom: Bool
}

func resolveLayout(_ layout: String, _ custom: CustomLayout?) -> ResolvedLayout {
    if layout == "custom" || layout == "Custom" {
        let c = custom ?? CustomLayout()
        let iso = c.kind != .ANSI
        let spec = LayoutSpec(id: .enUS, name: "Custom", iso: iso, en: false, jis: nil, caps: nil,
                              num: fitRow(c.num, 13), q: fitRow(c.q, iso ? 12 : 13), a: fitRow(c.a, iso ? 12 : 11),
                              x: fitRow(c.x, 1), z: fitRow(c.z, 10))
        return ResolvedLayout(spec: spec, custom: true)
    }
    return ResolvedLayout(spec: getLayout(layout), custom: false)
}

/// Builds the full key geometry for one finish and layout.
public func buildKeyboard(finish: FinishID = .proSpaceBlack, layout: LayoutID = .enUS, custom: CustomLayout? = nil) -> KeyboardGeometry {
    buildKeyboard(finish: finish.rawValue, layout: layout.rawValue, custom: custom)
}

/// Builds the full key geometry. Accepts finish and layout ids or names; unknown ids fall back to the defaults.
public func buildKeyboard(finish: String, layout: String, custom: CustomLayout? = nil) -> KeyboardGeometry {
    let data = MacKeysData.shared
    let f = getFinish(finish)
    let RL = resolveLayout(layout, custom)
    let L = RL.spec
    let model = f.model
    let ST = styleSpec(model)
    let LM = metrics(model)
    let style: LegendStyle = ST.mb ? .mb : .mk
    let mb = style == .mb
    let lightKeys = model == .neo || model == .mk

    let U = UNIT, V = ROW_PITCH
    let G: Double = ST.mb ? 7 : model == .mk ? 8.6 : 7.3
    let KH: Double = ST.mb ? 55.4 : model == .mk ? 53.8 : 55.2
    func kw(_ u: Double) -> Double { u * U - G }
    var keys: [KeyCap] = []
    let en = L.en && ST.words

    // ---- Legend placement: the cascade of the canvas's CSS, resolved to numbers. ----
    func place(_ tags: [String], _ slot: Legend.Slot, _ text: String, _ w: Double, _ h: Double) -> Legend? {
        if text.isEmpty { return nil }
        func has(_ t: String) -> Bool { tags.contains(t) }
        func L0(_ size: Double, _ align: Legend.Align, _ inset: Double, _ top: Double, _ tracking: Double = 0) -> Legend {
            Legend(text: text, size: size, tracking: tracking, align: align, inset: inset, top: top, slot: slot)
        }
        func bottom(_ size: Double, _ align: Legend.Align, _ inset: Double, _ b: Double, _ tracking: Double = 0) -> Legend {
            L0(size, align, inset, h - b - size, tracking)
        }
        switch slot {
        case .t:
            if has("jisL") { return L0(16, .left, 10, h / 2 - 10) }
            if has("jis") { return L0(10.5, .center, 0, 7) }
            if has("quad") { return L0(has("qbig") ? 15 : 12, .left, 9, 8) }
            if has("fnt") { return L0(12.2, .right, 9.2, 7.25) }
            if has("brk") { return L0(mb ? 15.5 : 13.6, .center, 0, mb ? 7.5 : 8.4) }
            if has("dual") { return L0(mb ? 14.4 : 12.6, .center, 0, LM.dt) }
            if has("char") { return L0(mb ? 18.4 : 17.6, .center, 0, mb ? 18.7 : 18.8) }
            return L0(12, .left, 0, 0)
        case .b:
            if has("jis") { return L0(16, .left, 10, h / 2 - 8) }
            if has("quad") { return bottom(has("qbig") ? 15 : 13.5, .left, 9, 8) }
            if has("cent") { return L0(12.5, .center, 0, h / 2 - 6.5) }
            if has("fkey") { return bottom(mb ? 7.6 : 7.5, .center, 0, LM.fb, 0.02) }
            if has("wl") || has("wr") || has("fnb") {
                let size = mb ? 12.2 : 11.2, tr = mb ? 0.005 : 0.02
                if has("fnb") { return bottom(size, .right, LM.fnr, LM.wb, tr) }
                return bottom(size, has("wl") ? .left : .right, LM.ws, LM.wb, tr)
            }
            if has("brk") { return bottom(mb ? 16 : 14.6, .center, 0, mb ? 8.4 : 7.4) }
            if has("dual") { return bottom(mb ? 17.8 : 17.6, .center, 0, LM.db) }
            return L0(12, .left, 0, 0)
        case .c:
            if has("jis") { return bottom(10.5, .center, 0, 7) }
            if has("quad") { return bottom(has("qbig") ? 15 : 13.5, .right, 9, 8) }
            if has("dual") { return bottom(10.5, .right, 9, 11) }
            return bottom(10.5, .right, 9, 9)
        case .d:
            if has("jis") { return L0(9.5, .right, 9, h / 2 - 5) }
            return L0(has("qbig") ? 15 : 12, .right, 9, 8)
        }
    }

    @discardableResult
    func add(_ p: KeyProto, _ x: Double, _ y: Double, _ w: Double, _ h: Double, _ row: Int) -> Int {
        let tags = p.tags
        let legends = [(Legend.Slot.t, p.t), (.b, p.b), (.c, p.c), (.d, p.d)].compactMap { place(tags, $0.0, $0.1, w, h) }
        var homeBar: Rect?
        if p.home {
            if tags.contains("jis") { homeBar = Rect(x: w * 0.55 - 3, y: h / 2 - 1, w: 6, h: 1.6) }
            else if tags.contains("quad") { homeBar = Rect(x: w / 2 - 4.5, y: h / 2 - 1, w: 9, h: 1.6) }
            else { homeBar = Rect(x: w / 2 - 5.4, y: 43.3, w: 10.8, h: 1.6) }
        }
        var capsLed: CapsLed?
        if tags.contains("caps") { capsLed = CapsLed(x: LM.cx, y: tags.contains("capsj") ? h / 2 - 1.9 : LM.cy, d: 3.8) }
        let id = !p.code.isEmpty ? p.code : (p.touchId ? "TouchID" : "k\(keys.count)")
        let k = KeyCap(
            id: id, label: p.label, kind: p.kind, row: row, x: x, y: y, w: w, h: h,
            radius: p.kind == .arrow ? 4 : 5,
            sound: keySound(id: id, kind: p.kind, units: (w + G) / U, halfHeight: h < KH * 0.75),
            legends: legends,
            icon: p.icon.map { $0(w, h) },
            iso: nil, homeBar: homeBar, capsLed: capsLed,
            touchId: p.touchId ? TouchIdSpec(d: model == .neo ? 34.4 : lightKeys ? 33.2 : 33.3) : nil)
        keys.append(k)
        return keys.count - 1
    }

    @discardableResult
    func row(_ r: Int, _ items: [KeyProto], _ codes: [String]) -> Double {
        var x: Double = 0
        for (i, it) in items.enumerated() {
            let u = it.u ?? 1
            var p = it
            let c = i < codes.count ? codes[i] : ""
            p.code = !c.isEmpty ? c : it.code
            add(p, x, Double(r) * V, kw(u), KH, r)
            x += u * U
        }
        return x
    }

    let icons = data.glyphs.icons
    func iconAt(_ name: String, _ side: Character, _ top: Double? = nil) -> IconRecipe {
        { w, h in
            let g = icons[name]!
            let x = side == "l" ? LM.side : w - LM.side - g.w
            let y = top ?? (h - LM.icB - g.h)
            return iconFrom(g, x, y)
        }
    }
    func word(_ u: Double, _ side: Character, _ enWord: String, _ icName: String, _ label: String, _ extra: [String] = []) -> KeyProto {
        if en { return KeyProto(u: u, tags: [side == "l" ? "wl" : "wr"] + extra, kind: .word, b: enWord, label: label) }
        if icName == "caps", let caps = L.caps { return KeyProto(u: u, tags: ["wl"] + extra, kind: .word, b: caps, label: label) }
        return KeyProto(u: u, tags: extra, kind: .icon, label: label, icon: iconAt(icName, side))
    }
    func modKey(_ kind: String, _ side: Character, _ word: String, _ label: String, _ u: Double = 1) -> KeyProto {
        let g = data.glyphs.mods[kind]!
        let symRight = (side == "l") == ST.inner
        return KeyProto(u: u, tags: [symRight ? "wr" : "wl"], kind: .mod, b: word, label: label,
                        icon: { w, _ in iconFrom(g, symRight ? w - LM.symSide - g.w : LM.symSide, LM.symTop) })
    }
    let globeG = data.glyphs.globe
    let globe: IconRecipe = { _, h in iconFrom(globeG, LM.globeLeft, h - LM.globeBottom - globeG.h) }
    func lshape(_ w: Double, _ h: Double, _ topW: Double, _ botW: Double, _ j: Double) -> IsoShape {
        let e = 0.5, r: Double = 5, R: Double = 5
        let xT = w - topW + e, xB = w - botW + e, rt = w - e, tp = e, bt = h - e
        let n = fmt
        let rs = "5", Rs = "5"
        var d = "M" + n(xT + r) + " " + n(tp) + "H" + n(rt - r) + "A" + rs + " " + rs + " 0 0 1 " + n(rt) + " " + n(tp + r)
            + "V" + n(bt - r) + "A" + rs + " " + rs + " 0 0 1 " + n(rt - r) + " " + n(bt) + "H" + n(xB + r)
            + "A" + rs + " " + rs + " 0 0 1 " + n(xB) + " " + n(bt - r)
        if xB > xT {
            d += "V" + n(j + R) + "A" + Rs + " " + Rs + " 0 0 0 " + n(xB - R) + " " + n(j) + "H" + n(xT + r)
                + "A" + rs + " " + rs + " 0 0 1 " + n(xT) + " " + n(j - r)
        } else {
            d += "V" + n(j + r) + "A" + rs + " " + rs + " 0 0 1 " + n(xB + r) + " " + n(j) + "H" + n(xT - R)
                + "A" + Rs + " " + Rs + " 0 0 0 " + n(xT) + " " + n(j - R)
        }
        d += "V" + n(tp + r) + "A" + rs + " " + rs + " 0 0 1 " + n(xT + r) + " " + n(tp) + "Z"
        return IsoShape(path: d, highlight: "M" + n(xT + 3) + " 1.4H" + n(rt - 3))
    }
    func LET(_ s: String) -> [String] { s.map { "Key" + String($0) } }
    let DIG = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"]
    func toks(_ s: String?) -> [KeyProto] {
        (s ?? "").split(separator: " ", omittingEmptySubsequences: false).map { parseToken(String($0)) }
    }

    // Row 0: escape, F1 to F12, Touch ID.
    var frow: [KeyProto] = [KeyProto(u: 1.5, tags: ["wl"], kind: .word, b: "esc", label: "escape")]
    for (i, g) in data.glyphs.fkeys.enumerated() {
        let w = g.drawW!, h = g.drawH!
        frow.append(KeyProto(tags: ["fkey"], kind: .fkey, b: "F\(i + 1)", label: "F\(i + 1), " + g.name,
                             icon: { kwid, _ in iconFrom(g, kwid / 2 - w / 2, LM.fIcon - h / 2, w, h) }))
    }
    frow.append(KeyProto(tags: ["touch"], kind: .touchid, label: "Touch ID", touchId: true))
    row(0, frow, ["Escape"] + (1...12).map { "F\($0)" })

    if L.jis == true {
        let JT = data.jis
        func J(_ arr: [JISEntry]) -> [KeyProto] {
            arr.map { a in
                KeyProto(u: (a.width ?? 0) != 0 ? a.width! : 1, tags: ["jis"], kind: .jis, t: a[0], b: a[1], c: a[2], d: a[3],
                         label: (a[1].isEmpty ? a[0] : a[1]) + " " + a[2])
            }
        }
        func JL(_ arr: [JISEntry]) -> [KeyProto] {
            arr.map { a in
                KeyProto(tags: ["jis", "jisL"], kind: .jis, t: a[0], c: a[1], d: a[2], label: a[0] + " " + a[1], home: a[0] == "F" || a[0] == "J")
            }
        }
        row(1, J(JT.num) + [word(1.25, "r", "delete", "del", "delete")], DIG + ["Minus", "Equal", "IntlYen", "Backspace"])
        row(2, [word(1, "l", "tab", "tab", "tab")] + JL(JT.qLetters) + J(JT.qSymbols), ["Tab"] + LET("QWERTYUIOP") + ["BracketLeft", "BracketRight"])
        var ret = word(1.5, "r", "return", "ret", "return")
        ret.code = "Enter"; ret.tags.append("iso")
        let ki = add(ret, 13 * U, 2 * V, kw(1.5), KH + V, 2)
        keys[ki].iso = lshape(kw(1.5), KH + V, kw(1.5), kw(1.25), KH)
        row(3, [modKey("ctrl", "l", "control", "control", 1.25)] + JL(JT.aLetters) + J(JT.aSymbols), ["ControlLeft"] + LET("ASDFGHJKL") + ["Semicolon", "Quote", "Backslash"])
        row(4, [word(1.75, "l", "shift", "shift", "shift")] + JL(JT.zLetters) + J(JT.zSymbols) + [word(1.75, "r", "shift", "shift", "right shift")],
            ["ShiftLeft"] + LET("ZXCVBNM") + ["Comma", "Period", "Slash", "IntlRo", "ShiftRight"])
    } else if !L.iso {
        row(1, toks(L.num) + [word(1.5, "r", "delete", "del", "delete")], ["Backquote"] + DIG + ["Minus", "Equal", "Backspace"])
        row(2, [word(1.5, "l", "tab", "tab", "tab")] + toks(L.q), ["Tab"] + LET("QWERTYUIOP") + ["BracketLeft", "BracketRight", "Backslash"])
        row(3, [word(1.75, "l", "caps lock", "caps", "caps lock", ["caps"])] + toks(L.a) + [word(1.75, "r", "return", "ret", "return")],
            ["CapsLock"] + LET("ASDFGHJKL") + ["Semicolon", "Quote", "Enter"])
        row(4, [word(2.25, "l", "shift", "shift", "shift")] + toks(L.z) + [word(2.25, "r", "shift", "shift", "right shift")],
            ["ShiftLeft"] + LET("ZXCVBNM") + ["Comma", "Period", "Slash", "ShiftRight"])
    } else {
        row(1, toks(L.num) + [word(1.5, "r", "delete", "del", "delete")], ["IntlBackslash"] + DIG + ["Minus", "Equal", "Backspace"])
        let x = row(2, [word(1.25, "l", "tab", "tab", "tab")] + toks(L.q), ["Tab"] + LET("QWERTYUIOP") + ["BracketLeft", "BracketRight"])
        var ret = word(1.25, "r", "return", "ret", "return")
        ret.code = "Enter"; ret.tags.append("iso")
        let ki = add(ret, x, 2 * V, kw(1.25), KH + V, 2)
        keys[ki].iso = lshape(kw(1.25), KH + V, kw(1.25), kw(1), KH)
        row(3, [word(1.5, "l", "caps lock", "caps", "caps lock", ["caps"])] + toks(L.a), ["CapsLock"] + LET("ASDFGHJKL") + ["Semicolon", "Quote", "Backslash"])
        row(4, [word(1.25, "l", "shift", "shift", "shift")] + toks(L.x) + toks(L.z) + [word(2.25, "r", "shift", "shift", "right shift")],
            ["ShiftLeft", "Backquote"] + LET("ZXCVBNM") + ["Comma", "Period", "Slash", "ShiftRight"])
    }

    let fnKey: KeyProto
    switch ST.fn {
    case .top: fnKey = KeyProto(tags: ["fnt"], kind: .fn, t: "fn", label: "fn, globe", code: "Fn", icon: globe)
    case .pair: fnKey = KeyProto(tags: ["fnb"], kind: .fn, b: "fn", label: "fn, globe", code: "Fn", icon: globe)
    case .globe: fnKey = KeyProto(tags: [], kind: .fn, label: "globe", code: "Fn", icon: globe)
    }
    let ax: Double
    if L.jis == true {
        let capsIcon = iconAt("caps", "l", 21)
        ax = row(5, [
            KeyProto(tags: ["caps", "capsj"], kind: .icon, label: "caps lock", icon: { w, h in var i = capsIcon(w, h); i.x = 20; return i }),
            modKey("opt", "l", "option", "option"),
            modKey("cmd", "l", "command", "command", 1.25),
            KeyProto(u: 1.25, tags: ["cent"], kind: .kana, b: "英数", label: "eisu"),
            KeyProto(u: 3.5, tags: ["space"], kind: .space, label: "space"),
            KeyProto(u: 1.25, tags: ["cent"], kind: .kana, b: "かな", label: "kana"),
            modKey("cmd", "r", "command", "right command", 1.25),
            fnKey
        ], ["CapsLock", "AltLeft", "MetaLeft", "Lang2", "Space", "Lang1", "MetaRight", "Fn"])
    } else {
        ax = row(5, [
            fnKey,
            modKey("ctrl", "l", "control", "control"),
            modKey("opt", "l", "option", "option"),
            modKey("cmd", "l", "command", "command", 1.25),
            KeyProto(u: 5, tags: ["space"], kind: .space, label: "space"),
            modKey("cmd", "r", "command", "right command", 1.25),
            modKey("opt", "r", "option", "right option")
        ], ["Fn", "ControlLeft", "AltLeft", "MetaLeft", "Space", "MetaRight", "AltRight"])
    }

    // Inverted T. Up and down share one cap height with a hairline between them.
    let ah = (KH - 1.6) / 2, y5 = 5 * V
    func arrow(_ x: Double, _ y: Double, _ h: Double, _ dir: String, _ code: String) {
        let g = data.glyphs.arrows[dir]!
        add(KeyProto(tags: ["arrow"], kind: .arrow, label: dir + " arrow", code: code,
                     icon: { w, hh in iconFrom(g, w / 2 - g.w / 2, hh / 2 - g.h / 2) }), x, y, kw(1), h, 5)
    }
    arrow(ax, ST.lrFull ? y5 : y5 + ah + 1.6, ST.lrFull ? KH : ah, "left", "ArrowLeft")
    arrow(ax + U, y5, ah, "up", "ArrowUp")
    arrow(ax + U, y5 + ah + 1.6, ah, "down", "ArrowDown")
    arrow(ax + 2 * U, ST.lrFull ? y5 : y5 + ah + 1.6, ST.lrFull ? KH : ah, "right", "ArrowRight")

    return KeyboardGeometry(
        finish: f.id, layout: RL.custom ? .custom : L.id, model: model, style: style,
        lightKeys: lightKeys, backlit: !lightKeys,
        width: 14.5 * U - G, height: 5 * V + KH, gap: G, capHeight: KH, keys: keys)
}
